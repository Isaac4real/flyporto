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

    // 10Hz broadcast loop
    this.broadcastInterval = setInterval(() => this.broadcast(), 100);

    // Cleanup stale players every second
    this.cleanupInterval = setInterval(() => this.cleanup(), 1000);

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    console.log(`[GameServer] Running on port ${port}`);
    console.log(`[GameServer] Broadcast rate: 10Hz (100ms)`);
    console.log(`[GameServer] Player timeout: 10 seconds`);
    console.log(`[GameServer] Rate limit: 20 messages/second`);
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
      if (messageCount > 20) {
        console.log(`[RateLimit] Disconnecting ${ip} - exceeded 20 msg/sec`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      try {
        const msg = JSON.parse(data);
        this.handleMessage(ws, msg, playerId, (id) => { playerId = id; });
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

  handleMessage(ws, msg, playerId, setPlayerId) {
    if (msg.type === 'join') {
      playerId = msg.id;
      setPlayerId(playerId);

      // Validate name
      const name = this.sanitizeName(msg.name) || 'Anonymous';

      this.players.set(playerId, {
        ws,
        name,
        position: { x: 0, y: 500, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        throttle: 0.5,
        lastUpdate: Date.now()
      });

      console.log(`[Join] ${name} (${playerId}) joined. Players: ${this.players.size}`);
      this.broadcastPlayerJoined(playerId, name);
    }

    if (msg.type === 'position' && playerId) {
      const player = this.players.get(playerId);
      if (player && this.validatePosition(msg)) {
        player.position = msg.position;
        player.rotation = msg.rotation;
        player.velocity = msg.velocity || { x: 0, y: 0, z: 0 };
        player.throttle = typeof msg.throttle === 'number' ? msg.throttle : 0.5;
        player.lastUpdate = Date.now();
      }
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    }
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
   * Validate position data is within reasonable bounds
   */
  validatePosition(msg) {
    if (!msg.position || !msg.rotation) return false;

    const { x, y, z } = msg.position;

    // Check for NaN or undefined
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return false;
    }
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      return false;
    }

    // Basic bounds check (within reasonable flying area)
    // These are world coordinates, not lat/lon
    if (Math.abs(x) > 100000 || y < -100 || y > 50000 || Math.abs(z) > 100000) {
      return false;
    }

    return true;
  }

  /**
   * Broadcast all player positions to all clients (10Hz)
   */
  broadcast() {
    if (this.players.size === 0) return;

    // Build players data (without ws references)
    const playersData = {};
    for (const [id, player] of this.players) {
      playersData[id] = {
        name: player.name,
        position: player.position,
        rotation: player.rotation,
        velocity: player.velocity,
        throttle: player.throttle,
        lastUpdate: player.lastUpdate
      };
    }

    const message = JSON.stringify({
      type: 'players',
      players: playersData,
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
    const message = JSON.stringify({
      type: 'player_joined',
      id: playerId,
      name: name,
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
