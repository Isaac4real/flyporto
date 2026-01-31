# Stage 8: Multiplayer Client (NetworkManager)

## Goal

Create the client-side networking layer that connects to the WebSocket server and sends local player position updates.

**Estimated time:** 20-30 minutes

---

## Prerequisites

- Stage 7 complete (server running)
- Server URL available (e.g., `wss://flysf-server.fly.dev`)

---

## Tasks

### Task 8.1: Add Environment Variable

Add to `.env`:
```
VITE_WS_URL=wss://flysf-server.fly.dev
```

Add to `.env.example`:
```
VITE_WS_URL=ws://localhost:8080
```

### Task 8.2: Create NetworkManager.js

Create `src/network/NetworkManager.js`:

```javascript
/**
 * NetworkManager - handles WebSocket connection to game server
 */
export class NetworkManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.playerId = this.getOrCreatePlayerId();
    this.playerName = this.getOrCreatePlayerName();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;

    // Callbacks
    this.onPlayersUpdate = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onConnectionChange = null;

    // Position send throttling
    this.lastSendTime = 0;
    this.sendInterval = 100;  // 10Hz

    this.connect();
  }

  /**
   * Get or create persistent player ID
   */
  getOrCreatePlayerId() {
    let id = localStorage.getItem('flysf-player-id');
    if (!id) {
      id = 'player-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('flysf-player-id', id);
    }
    return id;
  }

  /**
   * Get or create player name
   */
  getOrCreatePlayerName() {
    let name = localStorage.getItem('flysf-player-name');
    if (!name) {
      name = 'Pilot-' + Math.floor(Math.random() * 9999);
      localStorage.setItem('flysf-player-name', name);
    }
    return name;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected to game server');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);

        // Send join message
        this.send({
          type: 'join',
          id: this.playerId,
          name: this.playerName
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Disconnected from server:', event.code, event.reason);
        this.connected = false;
        this.onConnectionChange?.(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (e) {
      console.error('Failed to connect:', e);
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
          this.onPlayerJoined?.(msg.id, msg.name);
        }
        break;

      case 'player_left':
        this.onPlayerLeft?.(msg.id);
        break;

      case 'pong':
        // Keepalive response, ignore
        break;

      default:
        console.log('Unknown message type:', msg.type);
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
   */
  sendPosition(aircraft) {
    const now = performance.now();
    if (now - this.lastSendTime < this.sendInterval) {
      return;
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
      throttle: aircraft.throttle,
      timestamp: Date.now()
    });
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Check if connected
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
    localStorage.setItem('flysf-player-name', name);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### Task 8.3: Integrate with main.js

Update `src/main.js`:

```javascript
// Add import
import { NetworkManager } from './network/NetworkManager.js';

// After creating aircraft, create network manager
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const networkManager = new NetworkManager(wsUrl);

// In update function, send position
function update(deltaTime) {
  // ... existing code ...

  // Send position to server (throttled internally to 10Hz)
  networkManager.sendPosition(aircraft);

  // ... rest of update ...
}

// Handle visibility change (reconnect when tab becomes visible)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !networkManager.isConnected()) {
    networkManager.connect();
  }
});
```

### Task 8.4: Add Connection Status to HUD

Update `src/ui/HUD.js` to show connection status:

```javascript
// Add to constructor
this.connectionStatus = document.createElement('div');
this.connectionStatus.style.cssText = `
  position: absolute;
  top: 10px;
  right: 10px;
  color: #ff4444;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
`;
this.connectionStatus.textContent = 'Connecting...';
container.appendChild(this.connectionStatus);

// Add method
updateConnectionStatus(connected, playerCount = 0) {
  if (connected) {
    this.connectionStatus.style.color = '#44ff44';
    this.connectionStatus.textContent = `Online: ${playerCount} players`;
  } else {
    this.connectionStatus.style.color = '#ff4444';
    this.connectionStatus.textContent = 'Disconnected';
  }
}
```

Wire it up in main.js:

```javascript
networkManager.onConnectionChange = (connected) => {
  hud.updateConnectionStatus(connected);
};

networkManager.onPlayersUpdate = (players, count) => {
  hud.updateConnectionStatus(true, count);
};
```

---

## Acceptance Criteria

- [ ] Client connects to server automatically on load
- [ ] "Online: X players" shows in top-right when connected
- [ ] "Disconnected" shows in red when not connected
- [ ] Position sent every 100ms (check Network tab)
- [ ] Closing server shows "Disconnected", then reconnects when server returns
- [ ] Player ID persists across page reloads (check localStorage)
- [ ] Opening new tab increments player count

---

## Code Patterns

### Throttled Position Send

```javascript
// Check time since last send
const now = performance.now();
if (now - this.lastSendTime < this.sendInterval) {
  return;  // Skip, too soon
}
this.lastSendTime = now;
// ... send position
```

### Exponential Backoff Reconnect

```javascript
const delay = baseDelay * Math.pow(1.5, attemptNumber);
// Attempt 0: 1000ms
// Attempt 1: 1500ms
// Attempt 2: 2250ms
// etc.
```

### Visibility Change Handler

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !connected) {
    reconnect();
  }
});
```

---

## What NOT to Do

- ❌ Don't send position on every frame (use 10Hz throttle)
- ❌ Don't block on WebSocket operations
- ❌ Don't store player state in NetworkManager (that's PlayerSync's job)
- ❌ Don't add chat or other features (future stages)

---

## Handoff to Stage 9

After this stage:
- Client connects and sends positions
- Server receives positions and broadcasts
- But you can't SEE other players yet
- Stage 9 adds PlayerSync to render other aircraft

---

## Troubleshooting

### "WebSocket connection failed"
- Check VITE_WS_URL is correct
- Check server is running (`fly status`)
- Check using `wss://` not `ws://` for production

### Position not sending
- Check browser Network tab → WS tab
- Should see messages every 100ms
- Check console for errors

### "Disconnected" stays red
- Check server logs: `fly logs`
- May be rate limited if spamming refresh
