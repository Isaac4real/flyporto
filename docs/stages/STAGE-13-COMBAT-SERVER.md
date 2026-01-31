# Stage 13: Combat Server

## Goal

Add server-side handling for shooting and hits, with score tracking and validation.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Stage 12 complete (client shooting works)
- Client sends `shoot` and `hit` messages

---

## Tasks

### Task 13.1: Add Score Field to Player State

Update `server/GameServer.js`:

In `handleMessage()` where player is created (type === 'join'):

```javascript
this.players.set(playerId, {
  ws,
  name,
  position: { x: 0, y: 500, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  throttle: 0.5,
  lastUpdate: Date.now(),
  // NEW: Combat stats
  score: 0,
  lastHitTime: 0  // For rate limiting hits
});
```

### Task 13.2: Handle Shoot Message

Add to `handleMessage()`:

```javascript
if (msg.type === 'shoot' && playerId) {
  // Validate shoot data
  if (!this.validateShootData(msg)) {
    return;
  }

  // Broadcast to all other players (for visual effects)
  this.broadcastShoot(playerId, msg.position, msg.direction);
}
```

Add the validation and broadcast methods:

```javascript
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

  // Check direction values are numbers
  const { x: dx, y: dy, z: dz } = msg.direction;
  if (typeof dx !== 'number' || typeof dy !== 'number' || typeof dz !== 'number') {
    return false;
  }

  return true;
}

/**
 * Broadcast shoot event to all other players
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
```

### Task 13.3: Handle Hit Message

Add to `handleMessage()`:

```javascript
if (msg.type === 'hit' && playerId) {
  this.handleHit(playerId, msg.targetId);
}
```

Add the hit handling method:

```javascript
/**
 * Handle hit event - validate and update scores
 */
handleHit(shooterId, targetId) {
  // Get both players
  const shooter = this.players.get(shooterId);
  const target = this.players.get(targetId);

  // Validation
  if (!shooter || !target) {
    console.log(`[Hit] Rejected: player not found (shooter: ${!!shooter}, target: ${!!target})`);
    return;
  }

  // Can't shoot yourself
  if (shooterId === targetId) {
    console.log(`[Hit] Rejected: self-hit attempt`);
    return;
  }

  // Rate limiting: max 10 hits per second per player
  const now = Date.now();
  if (now - shooter.lastHitTime < 100) {
    console.log(`[Hit] Rejected: rate limited`);
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
```

### Task 13.4: Include Scores in Player Broadcast

Update the `broadcast()` method to include scores:

```javascript
broadcast() {
  if (this.players.size === 0) return;

  // Build players data (without ws references)
  const playersData = {};
  const scoresData = {};  // NEW: separate scores object

  for (const [id, player] of this.players) {
    playersData[id] = {
      name: player.name,
      position: player.position,
      rotation: player.rotation,
      velocity: player.velocity,
      throttle: player.throttle,
      lastUpdate: player.lastUpdate
    };

    // Add score to scores object
    scoresData[id] = player.score || 0;
  }

  const message = JSON.stringify({
    type: 'players',
    players: playersData,
    scores: scoresData,  // NEW
    count: this.players.size,
    timestamp: Date.now()
  });

  // ... rest of broadcast unchanged
}
```

### Task 13.5: Reset Score on Disconnect

The score is already ephemeral (stored in player object), so it's automatically cleared when player disconnects. No changes needed.

### Task 13.6: Update Rate Limit for Combat

With shooting, players send more messages. Update rate limit:

```javascript
// In handleConnection(), change rate limit from 20 to 30
if (messageCount > 30) {  // Was 20
  console.log(`[RateLimit] Disconnecting ${ip} - exceeded 30 msg/sec`);
  ws.close(1008, 'Rate limit exceeded');
  return;
}
```

---

## Complete Updated handleMessage()

Here's the full updated `handleMessage()` method:

```javascript
handleMessage(ws, msg, playerId, setPlayerId) {
  if (msg.type === 'join') {
    // ... existing join code (unchanged) ...
  }

  if (msg.type === 'position' && playerId) {
    // ... existing position code (unchanged) ...
  }

  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
  }

  // NEW: Combat messages
  if (msg.type === 'shoot' && playerId) {
    if (this.validateShootData(msg)) {
      this.broadcastShoot(playerId, msg.position, msg.direction);
    }
  }

  if (msg.type === 'hit' && playerId) {
    this.handleHit(playerId, msg.targetId);
  }
}
```

---

## Testing

### Test with wscat

```bash
# Terminal 1: Player 1
wscat -c ws://localhost:8080
{"type":"join","id":"player-1","name":"Alice"}
# Wait for join confirmation

# Terminal 2: Player 2
wscat -c ws://localhost:8080
{"type":"join","id":"player-2","name":"Bob"}

# From Player 1, send shoot:
{"type":"shoot","position":{"x":0,"y":100,"z":0},"direction":{"x":0,"y":0,"z":-1}}
# Player 2 should receive player_shoot message

# From Player 1, send hit:
{"type":"hit","targetId":"player-2"}
# Both should receive hit_confirmed with shooterScore: 1
```

### Server Log Output

You should see:
```
[Hit] Alice hit Bob. Score: 1
```

---

## Acceptance Criteria

- [ ] Player objects have `score` field initialized to 0
- [ ] `shoot` messages broadcast to other players
- [ ] Invalid shoot data rejected
- [ ] `hit` messages validate both players exist
- [ ] Self-hits rejected
- [ ] Hit rate limited to 10/second
- [ ] Score incremented on valid hit
- [ ] `hit_confirmed` broadcast to all players
- [ ] Scores included in regular player broadcast
- [ ] Rate limit increased to 30 msg/sec
- [ ] Server logs show hit events

---

## Code Patterns

### Rate Limiting Hits

```javascript
const now = Date.now();
if (now - shooter.lastHitTime < 100) {  // 100ms = 10 hits/sec max
  return;  // Rate limited
}
shooter.lastHitTime = now;
```

### Including Scores in Broadcast

```javascript
const scoresData = {};
for (const [id, player] of this.players) {
  scoresData[id] = player.score || 0;
}
// Add to message: scores: scoresData
```

---

## What NOT to Do

- ❌ Don't validate hit positions (trust client raycasting)
- ❌ Don't store scores in database (ephemeral only)
- ❌ Don't add death/health system yet (Stage 15)
- ❌ Don't add teams or complex scoring

---

## Security Notes

This is a trust-the-client model. Potential exploits:
- Spam hit messages (mitigated by rate limiting)
- Claim hits without actually hitting (no server validation)

For a casual viral game, this is acceptable. Competitive games need server-side hit validation with lag compensation.

---

## Handoff to Stage 14

After completing this stage:
- Server validates and tracks scores
- All players receive hit confirmations
- Scores broadcast to all clients
- Ready to display leaderboard in HUD
