# SF Flight Simulator: Multiplayer Implementation Plan

## Executive Summary

This document outlines the implementation of multiplayer functionality for the SF Flight Simulator. The architecture is based on proven patterns from fly.pieter.com (26K+ concurrent players) and industry best practices.

**Key Decision:** We're using a **simple WebSocket broadcast server** like Levelsio, not complex P2P or game engine frameworks. This is validated to scale to 26K+ players with minimal infrastructure.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MULTIPLAYER ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Browser Clients                    WebSocket Server                │
│   ┌─────────────┐                   ┌─────────────────┐             │
│   │  Client A   │◄─────────────────►│                 │             │
│   │  - Local    │    WebSocket      │  Node.js        │             │
│   │    physics  │                   │  - Receives     │             │
│   │  - Renders  │                   │    positions    │             │
│   │    others   │                   │  - Broadcasts   │             │
│   └─────────────┘                   │    to all       │             │
│   ┌─────────────┐                   │  - 10Hz tick    │             │
│   │  Client B   │◄─────────────────►│  - Player       │             │
│   └─────────────┘                   │    timeout      │             │
│   ┌─────────────┐                   │                 │             │
│   │  Client N   │◄─────────────────►│                 │             │
│   └─────────────┘                   └─────────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **Proven at scale** - Levelsio's fly.pieter.com uses exactly this pattern
2. **Simple to implement** - No complex state synchronization or physics authority
3. **Client-authoritative** - Each client runs its own physics, just shares position
4. **Cheap to host** - Single $5-20/month server can handle thousands of players
5. **Fast to build** - Can be MVP-ready in 1-2 days of Claude Code work

---

## Technical Decisions

### Protocol: WebSocket (not WebRTC)

| Factor | WebSocket | WebRTC |
|--------|-----------|--------|
| Browser support | 97% | 92% |
| Server complexity | Simple | Complex (STUN/TURN) |
| Latency | 10-20ms overhead | 5-15ms lower |
| Scaling | Easy horizontal | P2P mesh breaks at 8+ |
| Levelsio used | ✅ Yes | ❌ Tried, abandoned |

**Decision:** WebSocket. The latency difference is negligible for flight position updates, and the simplicity is worth it.

### Update Rate: 10Hz (100ms intervals)

- **Why 10Hz?** Levelsio proved this works for flight sims
- Aircraft movements are smooth enough that 10Hz + client interpolation looks good
- Keeps bandwidth low: ~880 bytes/sec per player at 10Hz
- Can increase to 20Hz later if needed

### Serialization: JSON (MVP) → Binary (optimization)

- **MVP:** JSON for simplicity and debugging
- **Later:** Switch to binary (MessagePack or custom) for 50%+ bandwidth savings
- Position data per player: ~100-200 bytes JSON, ~44 bytes binary

### Hosting: Fly.io (MVP) → Cloudflare Durable Objects (scale)

| Scale | Hosting | Cost/month |
|-------|---------|------------|
| MVP (0-100 players) | Fly.io shared-cpu | $5-10 |
| Growth (100-1000) | Fly.io dedicated | $20-50 |
| Scale (1000+) | Cloudflare DO or multi-region Fly.io | $20-100 |

---

## Data Structures

### Player State (sent from client to server)

```javascript
{
  type: 'position',
  id: 'player-uuid',
  name: 'PlayerName',
  position: { x: 0, y: 500, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },  // Euler angles (radians)
  velocity: { x: 0, y: 0, z: -60 },
  throttle: 0.7,
  timestamp: 1706300000000
}
```

### Server Broadcast (sent to all clients)

```javascript
{
  type: 'players',
  players: {
    'player-uuid-1': {
      name: 'Player1',
      position: { x: 0, y: 500, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: -60 },
      throttle: 0.7,
      lastUpdate: 1706300000000
    },
    'player-uuid-2': { ... }
  }
}
```

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `join` | Client → Server | Player joining with name |
| `position` | Client → Server | Position update (10Hz) |
| `leave` | Client → Server | Player leaving (optional, timeout handles) |
| `players` | Server → Client | All player positions (10Hz broadcast) |
| `player_joined` | Server → Client | New player notification |
| `player_left` | Server → Client | Player left notification |
| `chat` | Bidirectional | Chat messages (future) |

---

## Client-Side Architecture

### New Files to Create

```
src/
├── network/
│   ├── NetworkManager.js    # WebSocket connection, send/receive
│   ├── PlayerSync.js        # Manages other players' aircraft
│   └── Interpolation.js     # Smooth position interpolation
```

### NetworkManager.js

Responsibilities:
- Establish WebSocket connection
- Send local player position at 10Hz
- Receive and dispatch server messages
- Handle reconnection on disconnect
- Generate unique player ID

### PlayerSync.js

Responsibilities:
- Maintain map of remote player Aircraft instances
- Create/destroy aircraft meshes as players join/leave
- Update remote aircraft positions with interpolation
- Use different color for remote aircraft (blue vs local red)

### Interpolation.js

Responsibilities:
- Buffer incoming position updates
- Interpolate between known positions for smooth movement
- Extrapolate using velocity when no update received
- Handle timestamp ordering

### Integration with Existing Code

```javascript
// main.js additions

import { NetworkManager } from './network/NetworkManager.js';
import { PlayerSync } from './network/PlayerSync.js';

// After creating local aircraft
const networkManager = new NetworkManager('wss://your-server.fly.dev');
const playerSync = new PlayerSync(scene);

// In update loop
function update(deltaTime) {
  // ... existing code ...

  // Send local position to server
  networkManager.sendPosition(aircraft);

  // Update remote players with interpolation
  playerSync.update(deltaTime);
}

// Handle incoming player data
networkManager.onPlayersUpdate((players) => {
  playerSync.updatePlayers(players);
});
```

---

## Server-Side Architecture

### Technology Stack

- **Runtime:** Node.js 20+
- **WebSocket:** `ws` library (fastest, most lightweight)
- **No framework needed** - raw WebSocket server is sufficient

### Server Structure

```
server/
├── package.json
├── index.js          # Entry point
├── GameServer.js     # WebSocket server, player management
└── Player.js         # Player state class
```

### GameServer.js Core Logic

```javascript
import { WebSocketServer } from 'ws';

class GameServer {
  constructor(port) {
    this.wss = new WebSocketServer({ port });
    this.players = new Map();  // id -> { ws, name, position, rotation, velocity, lastUpdate }

    // Broadcast loop - 10Hz
    setInterval(() => this.broadcast(), 100);

    // Cleanup loop - remove stale players
    setInterval(() => this.cleanup(), 1000);

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  handleConnection(ws) {
    let playerId = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data);

      if (msg.type === 'join') {
        playerId = msg.id;
        this.players.set(playerId, {
          ws,
          name: msg.name,
          position: { x: 0, y: 500, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          lastUpdate: Date.now()
        });
        this.notifyPlayerJoined(playerId, msg.name);
      }

      if (msg.type === 'position' && playerId) {
        const player = this.players.get(playerId);
        if (player) {
          player.position = msg.position;
          player.rotation = msg.rotation;
          player.velocity = msg.velocity;
          player.throttle = msg.throttle;
          player.lastUpdate = Date.now();
        }
      }
    });

    ws.on('close', () => {
      if (playerId) {
        this.players.delete(playerId);
        this.notifyPlayerLeft(playerId);
      }
    });
  }

  broadcast() {
    // Build players object (excluding ws references)
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
      players: playersData
    });

    // Send to all connected clients
    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) {  // OPEN
        player.ws.send(message);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    const timeout = 10000;  // 10 seconds

    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > timeout) {
        player.ws.close();
        this.players.delete(id);
        this.notifyPlayerLeft(id);
      }
    }
  }
}
```

---

## Implementation Stages

### Stage 7: Multiplayer Foundation (Server)

**Goal:** Create working WebSocket server that can receive and broadcast positions.

**Tasks:**
1. Create `server/` directory with package.json
2. Implement GameServer.js with WebSocket handling
3. Implement join/position/leave message handling
4. Implement 10Hz broadcast loop
5. Implement 10-second player timeout
6. Add rate limiting (1000 messages/second per connection)
7. Deploy to Fly.io

**Acceptance Criteria:**
- Server starts and listens on port
- Can connect with wscat and send/receive messages
- Broadcast happens every 100ms
- Stale players are cleaned up after 10s

**Estimated Time:** 30-45 minutes

---

### Stage 8: Multiplayer Client (NetworkManager)

**Goal:** Client can connect to server and send position updates.

**Tasks:**
1. Create `src/network/NetworkManager.js`
2. Implement WebSocket connection with auto-reconnect
3. Implement `sendPosition(aircraft)` at 10Hz
4. Implement message handlers for server events
5. Generate and persist player ID (localStorage)
6. Add connection status to HUD

**Acceptance Criteria:**
- Client connects to server on load
- Position sent 10 times per second
- Reconnects automatically on disconnect
- Player ID persists across page reloads

**Estimated Time:** 20-30 minutes

---

### Stage 9: Remote Players (PlayerSync)

**Goal:** See other players' aircraft flying around.

**Tasks:**
1. Create `src/network/PlayerSync.js`
2. Manage Map of remote player Aircraft instances
3. Create/destroy aircraft meshes on join/leave
4. Use blue color for remote aircraft
5. Implement basic position lerping
6. Add player name labels (optional, can defer)

**Acceptance Criteria:**
- Opening two browser tabs shows two aircraft
- Remote aircraft positions update smoothly
- Aircraft disappear when tab closes
- Local aircraft is red, remote is blue

**Estimated Time:** 30-45 minutes

---

### Stage 10: Interpolation & Polish

**Goal:** Remote aircraft movement looks smooth and natural.

**Tasks:**
1. Create `src/network/Interpolation.js`
2. Buffer 2-3 position updates per remote player
3. Interpolate between buffered positions
4. Extrapolate using velocity when buffer empty
5. Handle out-of-order packets gracefully
6. Add player count to HUD

**Acceptance Criteria:**
- Remote aircraft move smoothly (no jitter)
- Brief network hiccups don't cause teleporting
- Player count shows in HUD

**Estimated Time:** 30-45 minutes

---

## Deployment

### Server Deployment (Fly.io)

```bash
cd server
fly launch --name flysf-server
fly deploy
```

**fly.toml:**
```toml
app = "flysf-server"
primary_region = "sjc"  # San Jose (close to SF theme!)

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false  # Keep running for WebSocket
  auto_start_machines = true

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Environment Variables

**Client (.env):**
```
VITE_WS_URL=wss://flysf-server.fly.dev
```

**Server:**
```
PORT=8080
```

---

## Security Considerations

### Rate Limiting

```javascript
// Simple rate limiter
const rateLimits = new Map();  // ip -> { count, resetTime }

function checkRateLimit(ip, maxPerSecond = 20) {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { count: 0, resetTime: now + 1000 };

  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 1000;
  }

  limit.count++;
  rateLimits.set(ip, limit);

  return limit.count <= maxPerSecond;
}
```

### Input Validation

```javascript
function validatePosition(msg) {
  // Check required fields
  if (!msg.position || !msg.rotation) return false;

  // Check position is reasonable (within SF area)
  const { x, y, z } = msg.position;
  if (Math.abs(x) > 100000 || y < -100 || y > 50000 || Math.abs(z) > 100000) {
    return false;
  }

  return true;
}
```

### Future: Anti-Cheat (Not MVP)

- Speed validation (compare position delta to max speed)
- Position smoothing (reject teleportation)
- Behavioral analysis (superhuman inputs)

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Message latency | < 100ms | Chrome DevTools Network |
| Broadcast tick | 10Hz ± 5% | Server logs |
| Client FPS impact | < 5% drop | Before/after comparison |
| Memory per player | < 1KB server | Process memory / player count |
| Max players (MVP) | 100 concurrent | Load test with artillery |

---

## Known Gotchas

### 1. WebSocket URL Protocol

```javascript
// Must use wss:// for HTTPS sites
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//your-server.fly.dev`;
```

### 2. Fly.io WebSocket Timeout

Fly.io may close idle WebSocket connections. Send keepalive:

```javascript
// Client-side keepalive
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

### 3. Browser Tab Throttling

Background tabs reduce timer precision. Use `requestAnimationFrame` for send timing:

```javascript
let lastSendTime = 0;
function maybeSpendPosition(timestamp) {
  if (timestamp - lastSendTime >= 100) {
    sendPosition();
    lastSendTime = timestamp;
  }
  requestAnimationFrame(maybeSpendPosition);
}
```

### 4. Mobile Background Behavior

iOS Safari may disconnect WebSocket when backgrounded. Handle reconnection gracefully:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ws.readyState !== WebSocket.OPEN) {
    reconnect();
  }
});
```

---

## Future Enhancements (Post-MVP)

1. **Chat system** - Text chat between players
2. **Player names above aircraft** - 3D text labels
3. **Binary protocol** - MessagePack for bandwidth savings
4. **Regional servers** - Multiple Fly.io regions
5. **Spatial partitioning** - Only sync nearby players
6. **Voice chat** - WebRTC for proximity voice

---

## Testing Checklist

### Before Launch

- [ ] Two tabs on same machine see each other
- [ ] Two different devices see each other
- [ ] Closing tab removes player within 10s
- [ ] Network disconnect triggers reconnection
- [ ] No memory leaks after 10 minutes
- [ ] Server handles 50 concurrent connections
- [ ] No console errors in production build

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create test script
# artillery-test.yml
# Run: artillery run artillery-test.yml
```

---

## Summary

This plan provides a clear path from single-player to multiplayer:

1. **Stage 7:** Server foundation (30-45 min)
2. **Stage 8:** Client networking (20-30 min)
3. **Stage 9:** Remote players (30-45 min)
4. **Stage 10:** Polish & interpolation (30-45 min)

**Total estimated time: 2-3 hours of Claude Code work**

The architecture is deliberately simple - a broadcast server that just relays positions. This is exactly what Levelsio used to serve 26K+ concurrent players. Complexity can be added later if needed.
