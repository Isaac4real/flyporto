# Stage 7: Multiplayer Server

## Goal

Create a WebSocket server that receives player positions and broadcasts them to all connected clients at 10Hz.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Node.js 18+ installed
- Fly.io CLI installed (`brew install flyctl` or `curl -L https://fly.io/install.sh | sh`)
- Fly.io account (free tier is fine)

---

## Tasks

### Task 7.1: Create Server Directory Structure

Create a separate `server/` directory in the project root:

```
server/
├── package.json
├── index.js
├── GameServer.js
└── fly.toml
```

**package.json:**
```json
{
  "name": "flysf-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  }
}
```

### Task 7.2: Implement GameServer.js

Create the WebSocket server with these features:

1. **Player management:**
   - Map of player ID → player state
   - Handle join, position, leave messages
   - Auto-remove players after 10 seconds of no updates

2. **Broadcast loop:**
   - Every 100ms (10Hz), send all player positions to all clients
   - Exclude the player's own data when sending to them (optional optimization)

3. **Rate limiting:**
   - Max 20 messages per second per connection
   - Disconnect abusers

**Core structure:**
```javascript
import { WebSocketServer } from 'ws';

export class GameServer {
  constructor(port) {
    this.wss = new WebSocketServer({ port });
    this.players = new Map();

    // 10Hz broadcast
    setInterval(() => this.broadcast(), 100);

    // Cleanup stale players every second
    setInterval(() => this.cleanup(), 1000);

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    console.log(`Game server running on port ${port}`);
  }

  handleConnection(ws, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let playerId = null;
    let messageCount = 0;
    let lastReset = Date.now();

    ws.on('message', (data) => {
      // Rate limiting
      const now = Date.now();
      if (now - lastReset > 1000) {
        messageCount = 0;
        lastReset = now;
      }
      messageCount++;
      if (messageCount > 20) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      try {
        const msg = JSON.parse(data);
        this.handleMessage(ws, msg, playerId, (id) => { playerId = id; });
      } catch (e) {
        console.error('Invalid message:', e.message);
      }
    });

    ws.on('close', () => {
      if (playerId) {
        this.players.delete(playerId);
        this.broadcastPlayerLeft(playerId);
        console.log(`Player left: ${playerId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  }

  handleMessage(ws, msg, playerId, setPlayerId) {
    if (msg.type === 'join') {
      playerId = msg.id;
      setPlayerId(playerId);

      this.players.set(playerId, {
        ws,
        name: msg.name || 'Anonymous',
        position: { x: 0, y: 500, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        throttle: 0.5,
        lastUpdate: Date.now()
      });

      console.log(`Player joined: ${msg.name} (${playerId})`);
      this.broadcastPlayerJoined(playerId, msg.name);
    }

    if (msg.type === 'position' && playerId) {
      const player = this.players.get(playerId);
      if (player && this.validatePosition(msg)) {
        player.position = msg.position;
        player.rotation = msg.rotation;
        player.velocity = msg.velocity;
        player.throttle = msg.throttle;
        player.lastUpdate = Date.now();
      }
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  validatePosition(msg) {
    if (!msg.position || !msg.rotation) return false;
    const { x, y, z } = msg.position;
    // Basic bounds check (within reasonable flying area)
    if (Math.abs(x) > 100000 || y < -100 || y > 50000 || Math.abs(z) > 100000) {
      return false;
    }
    return true;
  }

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
      count: this.players.size
    });

    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) {  // WebSocket.OPEN
        player.ws.send(message);
      }
    }
  }

  broadcastPlayerJoined(playerId, name) {
    const message = JSON.stringify({
      type: 'player_joined',
      id: playerId,
      name: name
    });

    for (const [id, player] of this.players) {
      if (id !== playerId && player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  broadcastPlayerLeft(playerId) {
    const message = JSON.stringify({
      type: 'player_left',
      id: playerId
    });

    for (const [id, player] of this.players) {
      if (player.ws.readyState === 1) {
        player.ws.send(message);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    const timeout = 10000;  // 10 seconds

    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > timeout) {
        console.log(`Player timed out: ${id}`);
        player.ws.close(1000, 'Timeout');
        this.players.delete(id);
        this.broadcastPlayerLeft(id);
      }
    }
  }
}
```

### Task 7.3: Create index.js Entry Point

```javascript
import { GameServer } from './GameServer.js';

const port = process.env.PORT || 8080;
new GameServer(port);
```

### Task 7.4: Create fly.toml for Deployment

```toml
app = "flysf-server"
primary_region = "sjc"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[checks]
  [checks.health]
    type = "tcp"
    port = 8080
    interval = "10s"
    timeout = "2s"
```

### Task 7.5: Test Locally

```bash
cd server
npm install
npm run dev
```

Test with wscat:
```bash
# Install: npm install -g wscat
wscat -c ws://localhost:8080

# Send join message
{"type":"join","id":"test-123","name":"TestPlayer"}

# Send position
{"type":"position","id":"test-123","position":{"x":0,"y":500,"z":0},"rotation":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":-60},"throttle":0.7}
```

### Task 7.6: Deploy to Fly.io

```bash
cd server
fly auth login
fly launch --name flysf-server --region sjc --no-deploy
# Edit fly.toml if needed
fly deploy
```

Note the URL: `wss://flysf-server.fly.dev`

---

## Acceptance Criteria

- [ ] `npm run dev` starts server on port 8080
- [ ] Can connect with wscat and send join message
- [ ] Receive player broadcasts every ~100ms
- [ ] Second wscat connection sees first player
- [ ] Closing connection removes player within 10s
- [ ] Spamming 100 messages/second gets disconnected
- [ ] Server deployed to Fly.io and accessible

---

## Code Patterns

### Rate Limiting Pattern

```javascript
let messageCount = 0;
let lastReset = Date.now();

// In message handler
const now = Date.now();
if (now - lastReset > 1000) {
  messageCount = 0;
  lastReset = now;
}
messageCount++;
if (messageCount > 20) {
  ws.close(1008, 'Rate limit exceeded');
  return;
}
```

### Player Timeout Pattern

```javascript
cleanup() {
  const now = Date.now();
  for (const [id, player] of this.players) {
    if (now - player.lastUpdate > 10000) {
      player.ws.close();
      this.players.delete(id);
    }
  }
}
```

---

## What NOT to Do

- ❌ Don't use Socket.IO (overhead we don't need)
- ❌ Don't add database storage (not needed for MVP)
- ❌ Don't add authentication (future enhancement)
- ❌ Don't add rooms/lobbies (all players in one world)
- ❌ Don't add binary protocol yet (JSON is fine for MVP)

---

## Handoff to Stage 8

After completing this stage:

1. Note the server URL (e.g., `wss://flysf-server.fly.dev`)
2. Add to client `.env`: `VITE_WS_URL=wss://flysf-server.fly.dev`
3. Server is ready for client connections

---

## Troubleshooting

### "Address already in use"
```bash
lsof -i :8080
kill -9 <PID>
```

### Fly.io deployment fails
```bash
fly logs  # Check what went wrong
fly status  # Check machine status
```

### WebSocket not connecting from browser
- Check CORS (ws library handles this automatically)
- Ensure using `wss://` for HTTPS sites
- Check Fly.io logs for connection attempts
