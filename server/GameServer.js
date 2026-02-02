import { WebSocketServer } from 'ws';

/**
 * GameServer - WebSocket server for multiplayer flight simulator
 *
 * Features:
 * - Player management (join, position updates, leave)
 * - 10Hz broadcast loop (every 100ms)
 * - Rate limiting (20 messages/second per connection)
 * - Player timeout (10 seconds of inactivity)
 * - Position validation (bounds checking)
 */
export class GameServer {
  constructor(port) {
    this.wss = new WebSocketServer({ port });
    this.players = new Map(); // id -> { ws, name, position, rotation, velocity, throttle, lastUpdate }
    this.joinRateLimits = new Map(); // ip -> { windowStart, count, lastJoinAt }

    // Join rate limit settings (per IP)
    this.joinWindowMs = Number(process.env.JOIN_WINDOW_MS || 10 * 60 * 1000); // 10 min
    this.joinMaxPerWindow = Number(process.env.JOIN_MAX_PER_WINDOW || 5);
    this.joinCooldownMs = Number(process.env.JOIN_COOLDOWN_MS || 10000); // 10 sec

    // 10Hz broadcast loop
    this.broadcastInterval = setInterval(() => this.broadcast(), 100);

    // Cleanup stale players every second
    this.cleanupInterval = setInterval(() => this.cleanup(), 1000);

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    console.log(`[GameServer] Running on port ${port}`);
    console.log(`[GameServer] Broadcast rate: 10Hz (100ms)`);
    console.log(`[GameServer] Player timeout: 10 seconds`);
    console.log(`[GameServer] Rate limit: 30 messages/second (combat enabled)`);
    console.log(`[GameServer] Join rate limit: ${this.joinMaxPerWindow}/${Math.round(this.joinWindowMs / 60000)}min, cooldown ${Math.round(this.joinCooldownMs / 1000)}s`);
  }

  handleConnection(ws, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let playerId = null;
    let messageCount = 0;
    let lastReset = Date.now();

    console.log(`[Connection] New connection from ${ip}`);

    ws.on('message', (data) => {
      // Rate limiting
      const now = Date.now();
      if (now - lastReset > 1000) {
        messageCount = 0;
        lastReset = now;
      }
      messageCount++;
      if (messageCount > 30) {
        console.log(`[RateLimit] Disconnecting ${ip} - exceeded 30 msg/sec`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      try {
        const msg = JSON.parse(data);
        this.handleMessage(ws, msg, playerId, (id) => { playerId = id; }, ip);
      } catch (e) {
        console.error(`[Error] Invalid message from ${ip}:`, e.message);
      }
    });

    ws.on('close', () => {
      if (playerId) {
        const player = this.players.get(playerId);
        const name = player?.name || 'Unknown';
        this.players.delete(playerId);
        this.broadcastPlayerLeft(playerId);
        console.log(`[Leave] ${name} (${playerId}) disconnected. Players: ${this.players.size}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Error] WebSocket error from ${ip}:`, err.message);
    });
  }

  handleMessage(ws, msg, playerId, setPlayerId, ip) {
    if (msg.type === 'join') {
      if (!this.allowJoin(ip)) {
        console.log(`[JoinRateLimit] Rejecting join from ${ip}`);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'join_rate_limited',
            message: 'Join rate limit exceeded. Please wait and try again.'
          }));
        } catch (e) {
          // Ignore send errors - connection may already be closing
        }
        ws.close(1008, 'Join rate limit exceeded');
        return;
      }

      // Validate player ID
      if (!msg.id || typeof msg.id !== 'string' || msg.id.length < 5 || msg.id.length > 50) {
        console.log('[Join] Invalid player ID rejected');
        return;
      }

      // Prevent duplicate joins from same connection
      if (playerId) {
        console.log('[Join] Duplicate join attempt rejected');
        return;
      }

      // Check if ID is already in use by another connection
      const existingPlayer = this.players.get(msg.id);
      if (existingPlayer && existingPlayer.ws !== ws) {
        // ID collision - generate a new unique suffix
        msg.id = msg.id + '-' + Math.random().toString(36).substr(2, 4);
      }

      playerId = msg.id;
      setPlayerId(playerId);

      // Validate name
      const name = this.sanitizeName(msg.name) || 'Anonymous';

      // Extract aircraft customization
      const planeType = this.sanitizePlaneType(msg.planeType) || 'jet1';
      const planeColor = this.sanitizePlaneColor(msg.planeColor) || 'blue';

      this.players.set(playerId, {
        ws,
        name,
        planeType,
        planeColor,
        position: { x: 0, y: 500, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        throttle: 0.5,
        lastUpdate: Date.now(),
        // Combat stats
        score: 0,
        lastHitTime: 0
      });

      console.log(`[Join] ${name} (${playerId}) joined. Players: ${this.players.size}`);
      this.broadcastPlayerJoined(playerId, name);
    }

    if (msg.type === 'position' && playerId) {
      const player = this.players.get(playerId);
      if (player) {
        // Always update lastUpdate to prevent timeout - player is still connected
        player.lastUpdate = Date.now();

        // Only update position data if validation passes
        if (this.validatePosition(msg)) {
          player.position = msg.position;
          player.rotation = msg.rotation;
          player.velocity = msg.velocity || { x: 0, y: 0, z: 0 };
          player.throttle = typeof msg.throttle === 'number' ? msg.throttle : 0.5;
        }
      }
    }

    if (msg.type === 'ping') {
      // Update lastUpdate to act as keepalive
      if (playerId) {
        const player = this.players.get(playerId);
        if (player) {
          player.lastUpdate = Date.now();
        }
      }
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }

    // Combat: Player shooting
    if (msg.type === 'shoot' && playerId) {
      if (this.validateShootData(msg)) {
        this.broadcastShoot(playerId, msg.position, msg.direction);
      }
    }

    // Combat: Hit registered
    if (msg.type === 'hit' && playerId) {
      this.handleHit(playerId, msg.targetId);
    }
  }

  /**
   * Per-IP join rate limiting to protect tile/API usage.
   */
  allowJoin(ip) {
    if (!ip) return true;
    const now = Date.now();
    const entry = this.joinRateLimits.get(ip);

    if (!entry) {
      this.joinRateLimits.set(ip, { windowStart: now, count: 1, lastJoinAt: now });
      return true;
    }

    // Cooldown between joins
    if (now - entry.lastJoinAt < this.joinCooldownMs) {
      return false;
    }

    // Reset window
    if (now - entry.windowStart > this.joinWindowMs) {
      entry.windowStart = now;
      entry.count = 0;
    }

    entry.count += 1;
    entry.lastJoinAt = now;
    return entry.count <= this.joinMaxPerWindow;
  }

  /**
   * Sanitize player name to prevent XSS and limit length
   */
  sanitizeName(name) {
    if (!name || typeof name !== 'string') return null;
    // Remove HTML tags and limit to 20 characters
    return name.replace(/<[^>]*>/g, '').trim().slice(0, 20);
  }

  /**
   * Sanitize plane type to only allow valid types
   */
  sanitizePlaneType(planeType) {
    const validTypes = ['jet1', 'jet2', 'plane1', 'plane2', 'plane3'];
    if (!planeType || typeof planeType !== 'string') return null;
    return validTypes.includes(planeType) ? planeType : null;
  }

  /**
   * Sanitize plane color to only allow valid colors
   */
  sanitizePlaneColor(planeColor) {
    const validColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
    if (!planeColor || typeof planeColor !== 'string') return null;
    return validColors.includes(planeColor) ? planeColor : null;
  }

  /**
   * Validate shoot message data
   */
  validateShootData(msg) {
    if (!msg.position || !msg.direction) return false;

    // Check position values are numbers
    const { x, y, z } = msg.position;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return false;
    }

    // Check direction values are numbers
    const { x: dx, y: dy, z: dz } = msg.direction;
    if (typeof dx !== 'number' || typeof dy !== 'number' || typeof dz !== 'number') {
      return false;
    }
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) {
      return false;
    }

    return true;
  }

  /**
   * Broadcast shoot event to all other players (for visual effects)
   */
  broadcastShoot(shooterId, position, direction) {
    const message = JSON.stringify({
      type: 'player_shoot',
      shooterId,
      position,
      direction,
      timestamp: Date.now()
    });

    for (const [id, player] of this.players) {
      if (id !== shooterId && player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  /**
   * Handle hit event - validate and update scores
   */
  handleHit(shooterId, targetId) {
    const shooter = this.players.get(shooterId);
    const target = this.players.get(targetId);

    // Validation
    if (!shooter || !target) {
      return;
    }

    // Can't shoot yourself
    if (shooterId === targetId) {
      return;
    }

    // Rate limiting: max 10 hits per second per player
    const now = Date.now();
    if (now - shooter.lastHitTime < 100) {
      return;
    }
    shooter.lastHitTime = now;

    // Increment score
    shooter.score = (shooter.score || 0) + 1;

    console.log(`[Hit] ${shooter.name} hit ${target.name}. Score: ${shooter.score}`);

    // Broadcast hit confirmation to all players
    this.broadcastHitConfirmed(shooterId, targetId, shooter.score);
  }

  /**
   * Broadcast hit confirmation to all players
   */
  broadcastHitConfirmed(shooterId, targetId, shooterScore) {
    const message = JSON.stringify({
      type: 'hit_confirmed',
      shooterId,
      targetId,
      shooterScore,
      timestamp: Date.now()
    });

    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  /**
   * Validate position and rotation data
   */
  validatePosition(msg) {
    if (!msg.position || !msg.rotation) return false;

    const { x, y, z } = msg.position;

    // Check position for NaN or undefined
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return false;
    }

    // Basic bounds check (within reasonable flying area)
    if (Math.abs(x) > 100000 || y < -100 || y > 50000 || Math.abs(z) > 100000) {
      return false;
    }

    // Validate rotation values
    const { x: rx, y: ry, z: rz } = msg.rotation;
    if (typeof rx !== 'number' || typeof ry !== 'number' || typeof rz !== 'number') {
      return false;
    }
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz)) {
      return false;
    }

    // Rotation should be reasonable
    // Pitch (rx) and roll (rz) are clamped on client, but yaw (ry) can accumulate
    // Use a very large limit to catch obvious bad data while allowing normal play
    const maxRotation = Math.PI * 100;  // ~18000 degrees - catches NaN-adjacent issues
    if (Math.abs(rx) > maxRotation || Math.abs(ry) > maxRotation || Math.abs(rz) > maxRotation) {
      return false;
    }

    return true;
  }

  /**
   * Broadcast all player positions to all clients (10Hz)
   */
  broadcast() {
    if (this.players.size === 0) return;

    // Build players data (without ws references) and scores
    const playersData = {};
    const scoresData = {};
    for (const [id, player] of this.players) {
      playersData[id] = {
        name: player.name,
        planeType: player.planeType,
        planeColor: player.planeColor,
        position: player.position,
        rotation: player.rotation,
        velocity: player.velocity,
        throttle: player.throttle,
        lastUpdate: player.lastUpdate
      };
      scoresData[id] = player.score || 0;
    }

    const message = JSON.stringify({
      type: 'players',
      players: playersData,
      scores: scoresData,
      count: this.players.size,
      timestamp: Date.now()
    });

    let sentCount = 0;
    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) { // WebSocket.OPEN
        player.ws.send(message);
        sentCount++;
      }
    }

    // Log player count periodically (every 10 seconds)
    if (Date.now() % 10000 < 100 && this.players.size > 0) {
      console.log(`[Broadcast] ${this.players.size} players, ${sentCount} messages sent`);
    }
  }

  /**
   * Notify all players that a new player joined
   */
  broadcastPlayerJoined(playerId, name) {
    const player = this.players.get(playerId);
    const message = JSON.stringify({
      type: 'player_joined',
      id: playerId,
      name: name,
      planeType: player?.planeType || 'jet1',
      planeColor: player?.planeColor || 'blue',
      timestamp: Date.now()
    });

    for (const [id, player] of this.players) {
      if (id !== playerId && player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  /**
   * Notify all players that a player left
   */
  broadcastPlayerLeft(playerId) {
    const message = JSON.stringify({
      type: 'player_left',
      id: playerId,
      timestamp: Date.now()
    });

    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  /**
   * Remove players who haven't sent updates in 10 seconds
   */
  cleanup() {
    const now = Date.now();
    const timeout = 10000; // 10 seconds

    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > timeout) {
        console.log(`[Timeout] ${player.name} (${id}) timed out after 10s`);
        player.ws.close(1000, 'Timeout');
        this.players.delete(id);
        this.broadcastPlayerLeft(id);
      }
    }
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('[GameServer] Shutting down...');
    clearInterval(this.broadcastInterval);
    clearInterval(this.cleanupInterval);

    // Close all connections
    for (const [id, player] of this.players) {
      player.ws.close(1001, 'Server shutting down');
    }

    this.wss.close(() => {
      console.log('[GameServer] Shutdown complete');
    });
  }
}
