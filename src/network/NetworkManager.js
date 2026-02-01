/**
 * NetworkManager - handles WebSocket connection to multiplayer game server
 *
 * Features:
 * - Auto-connect on initialization (or deferred if playerName provided)
 * - Auto-reconnect with exponential backoff
 * - Throttled position updates (10Hz)
 * - Persistent player ID (localStorage)
 * - Visibility change handling (reconnect when tab becomes visible)
 */
export class NetworkManager {
  /**
   * @param {string} url - WebSocket server URL (ws:// or wss://)
   * @param {string} [playerName] - Optional player name (used in join message, persisted to localStorage)
   */
  constructor(url, playerName = null) {
    this.url = url;
    this.ws = null;
    this.playerId = this.getOrCreatePlayerId();
    // Use provided name or fall back to stored/generated name
    this.playerName = playerName || this.getOrCreatePlayerName();
    // If a name was provided, save it
    if (playerName) {
      this.setPlayerName(playerName);
    }
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;

    // Aircraft customization
    this.planeType = 'f16';
    this.planeColor = 'red';

    // Callbacks (set by consumer)
    this.onPlayersUpdate = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onConnectionChange = null;
    this.onPingUpdate = null;

    // Position send throttling (10Hz = 100ms intervals)
    this.lastSendTime = 0;
    this.sendInterval = 100;

    // Ping measurement
    this.pingSentTime = 0;
    this.lastPing = 0;
    this.pingInterval = null;

    // Handle visibility change (reconnect when tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.connected) {
        console.log('[Network] Tab visible, reconnecting...');
        this.connect();
      }
    });

    // Connect immediately
    this.connect();
  }

  /**
   * Get or create persistent player ID from localStorage
   */
  getOrCreatePlayerId() {
    try {
      let id = localStorage.getItem('flysf-player-id');
      if (!id) {
        id = 'player-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('flysf-player-id', id);
      }
      return id;
    } catch (e) {
      // localStorage may be disabled (private browsing)
      return 'player-' + Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * Get or create player name from localStorage
   */
  getOrCreatePlayerName() {
    try {
      let name = localStorage.getItem('flysf-player-name');
      if (!name) {
        name = 'Pilot-' + Math.floor(Math.random() * 9999);
        localStorage.setItem('flysf-player-name', name);
      }
      return name;
    } catch (e) {
      // localStorage may be disabled (private browsing)
      return 'Pilot-' + Math.floor(Math.random() * 9999);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      console.log('[Network] Connecting to', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[Network] Connected to game server');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);

        // Send join message with aircraft customization
        this.send({
          type: 'join',
          id: this.playerId,
          name: this.playerName,
          planeType: this.planeType,
          planeColor: this.planeColor
        });

        // Start keepalive ping every 30 seconds
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Network] Failed to parse message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[Network] Disconnected:', event.code, event.reason || '');
        this.connected = false;
        this.onConnectionChange?.(false);
        this.stopPingInterval();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Network] WebSocket error:', error);
      };

    } catch (e) {
      console.error('[Network] Failed to connect:', e);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming message from server
   */
  handleMessage(msg) {
    switch (msg.type) {
      case 'players':
        // Remove self from players list before passing to callback
        const otherPlayers = { ...msg.players };
        delete otherPlayers[this.playerId];
        this.onPlayersUpdate?.(otherPlayers, msg.count);
        break;

      case 'player_joined':
        if (msg.id !== this.playerId) {
          console.log('[Network] Player joined:', msg.name);
          this.onPlayerJoined?.(msg.id, msg.name);
        }
        break;

      case 'player_left':
        console.log('[Network] Player left:', msg.id);
        this.onPlayerLeft?.(msg.id);
        break;

      case 'pong':
        // Calculate round-trip time
        if (this.pingSentTime > 0) {
          this.lastPing = Date.now() - this.pingSentTime;
          this.onPingUpdate?.(this.lastPing);
        }
        break;

      default:
        console.log('[Network] Unknown message type:', msg.type);
    }
  }

  /**
   * Send message to server
   */
  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Send position update (throttled to 10Hz)
   * @param {Aircraft} aircraft - The aircraft object with position, rotation, velocity
   */
  sendPosition(aircraft) {
    const now = performance.now();
    if (now - this.lastSendTime < this.sendInterval) {
      return; // Too soon, skip this update
    }
    this.lastSendTime = now;

    this.send({
      type: 'position',
      id: this.playerId,
      position: {
        x: aircraft.position.x,
        y: aircraft.position.y,
        z: aircraft.position.z
      },
      rotation: {
        x: aircraft.rotation.x,
        y: aircraft.rotation.y,
        z: aircraft.rotation.z
      },
      velocity: {
        x: aircraft.velocity.x,
        y: aircraft.velocity.y,
        z: aircraft.velocity.z
      },
      speed: aircraft.getSpeed?.() ?? aircraft.speed ?? 0,
      verticalSpeed: aircraft.verticalSpeed ?? 0,
      throttle: aircraft.throttle,
      timestamp: Date.now()
    });
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Network] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      30000 // Cap at 30 seconds
    );
    this.reconnectAttempts++;

    console.log(`[Network] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Start keepalive and ping measurement interval
   * Runs every 5 seconds - serves as both keepalive and latency measurement
   */
  startPingInterval() {
    this.stopPingInterval();

    // Single interval for both keepalive and ping measurement (every 5 seconds)
    this.pingInterval = setInterval(() => {
      this.measurePing();
    }, 5000);

    // Initial ping measurement
    this.measurePing();
  }

  /**
   * Stop keepalive ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send a ping to measure latency
   */
  measurePing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.pingSentTime = Date.now();
      this.send({ type: 'ping' });
    }
  }

  /**
   * Get the last measured ping in milliseconds
   */
  getPing() {
    return this.lastPing;
  }

  /**
   * Check if connected to server
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get player ID
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get player name
   */
  getPlayerName() {
    return this.playerName;
  }

  /**
   * Set player name (persists to localStorage)
   */
  setPlayerName(name) {
    this.playerName = name;
    try {
      localStorage.setItem('flysf-player-name', name);
    } catch (e) {
      // localStorage may be disabled
    }
  }

  /**
   * Set plane type
   * @param {string} planeType - Aircraft type ('f16', 'f22', 'f18', 'cessna')
   */
  setPlaneType(planeType) {
    this.planeType = planeType;
    try {
      localStorage.setItem('flysf-plane-type', planeType);
    } catch (e) {
      // localStorage may be disabled
    }
  }

  /**
   * Get plane type
   * @returns {string}
   */
  getPlaneType() {
    return this.planeType;
  }

  /**
   * Set plane color
   * @param {string} planeColor - Accent color ('red', 'blue', 'green', etc.)
   */
  setPlaneColor(planeColor) {
    this.planeColor = planeColor;
    try {
      localStorage.setItem('flysf-plane-color', planeColor);
    } catch (e) {
      // localStorage may be disabled
    }
  }

  /**
   * Get plane color
   * @returns {string}
   */
  getPlaneColor() {
    return this.planeColor;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
