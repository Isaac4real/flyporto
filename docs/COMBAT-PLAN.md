# SF Flight Simulator: Combat System Implementation Plan

## Executive Summary

This document outlines the implementation of a shooting/combat system with scoring. Based on research into fly.pieter.com and multiplayer game best practices, we're implementing a **client-side hit detection** model with **server-validated scoring** - the same pattern Levelsio uses.

**Key Insight:** Levelsio admitted he "hadn't figured out how to make bullets register" initially - hit detection in browser games is tricky. We'll solve this properly from the start.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        COMBAT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Client A (Shooter)                    Server                       │
│   ┌─────────────────┐                  ┌─────────────────┐          │
│   │ 1. Fire bullet  │                  │                 │          │
│   │ 2. Raycast check│──── shoot ──────►│ Broadcast to    │          │
│   │ 3. Hit detected │                  │ all clients     │          │
│   │ 4. Send hit msg │──── hit ────────►│                 │          │
│   └─────────────────┘                  │ Validate hit:   │          │
│                                        │ - Players exist │          │
│   Client B (Target)                    │ - Rate limit    │          │
│   ┌─────────────────┐                  │ - Update scores │          │
│   │ See bullet      │◄── shoot ────────│                 │          │
│   │ flash/effect    │                  │ Broadcast:      │          │
│   │ See hit marker  │◄── hit_confirm ──│ - Scores        │          │
│   │ if hit          │                  │ - Hit events    │          │
│   └─────────────────┘                  └─────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Client-Side Hit Detection?

1. **Zero latency for shooter** - Shots feel instant and responsive
2. **Simpler server** - No physics simulation needed
3. **Levelsio's approach** - "The client is completely trusted"
4. **Good enough for casual game** - Not competitive esports

### Server's Role

Server validates and prevents obvious cheating:
- Rate limiting hits (max 10 hits per second)
- Check both shooter and target exist
- Track and broadcast scores
- No physics/position validation (too complex for MVP)

---

## Technical Decisions

### Hit Detection: Raycasting (Hitscan)

**Not projectile-based.** Reasons:
- Simpler to implement
- Zero network overhead (no bullet sync)
- Instant feedback
- Works at 10Hz update rate

```javascript
// Raycast from aircraft nose in forward direction
const raycaster = new THREE.Raycaster(
  aircraft.position.clone(),
  aircraft.getForwardVector(),
  0,           // near
  1000         // max range (1km)
);

// Check against all remote aircraft hitboxes
const hits = raycaster.intersectObjects(targetHitboxes);
```

### Hitboxes: Bounding Spheres

Use spheres not boxes because:
- Rotation-invariant (no need to update orientation)
- Faster intersection test
- Good enough for aircraft-sized targets

```javascript
// Current aircraft dimensions: ~20m wingspan, ~15m length
// Use sphere radius ~15m for generous hitbox
const hitboxRadius = 15;  // meters
```

### Aircraft Scale: 2x Current Size

You mentioned planes need to feel bigger. Current dimensions:
- Fuselage: 2 × 2 × 15 units
- Wingspan: 20 units

**Recommendation:** Scale all aircraft meshes by 2x
- Makes them more visible at distance
- Bigger targets = more satisfying hits
- Better matches camera follow distance (80m)

### Fire Rate: 5 shots/second

- 200ms between shots (prevents spam)
- Each shot is a raycast
- Visual: tracer line + muzzle flash

### Scoring

- **+1 point per hit**
- Scores persist for session only (no database)
- Leaderboard in HUD shows top 5 players
- Scores reset on disconnect

---

## Data Structures

### New Message Types

```javascript
// Client → Server: Player fired
{
  type: 'shoot',
  shooterId: 'player-xxx',
  position: { x, y, z },      // Where shot originated
  direction: { x, y, z },     // Normalized direction
  timestamp: Date.now()
}

// Client → Server: Hit registered
{
  type: 'hit',
  shooterId: 'player-xxx',
  targetId: 'player-yyy',
  timestamp: Date.now()
}

// Server → All: Broadcast shot (for visual effects)
{
  type: 'player_shoot',
  shooterId: 'player-xxx',
  position: { x, y, z },
  direction: { x, y, z }
}

// Server → All: Confirmed hit
{
  type: 'hit_confirmed',
  shooterId: 'player-xxx',
  targetId: 'player-yyy',
  shooterScore: 5,
  targetScore: 2
}

// Server → All: Scores update (with regular broadcast)
{
  type: 'players',
  players: { ... },
  scores: {
    'player-xxx': 5,
    'player-yyy': 2
  },
  count: 10
}
```

### Client State

```javascript
// Combat state
const combatState = {
  canFire: true,
  lastFireTime: 0,
  fireRate: 5,              // shots per second
  fireCooldown: 200,        // ms between shots
  myScore: 0,
  scores: {}                // playerId -> score
};
```

### Server State

```javascript
// Add to player object
{
  ws,
  name,
  position,
  rotation,
  velocity,
  score: 0,                 // NEW
  lastHitTime: 0,           // NEW: for rate limiting
  lastUpdate: Date.now()
}
```

---

## New Files

```
src/combat/
├── CombatManager.js      # Shooting, hit detection, score tracking
├── BulletEffects.js      # Tracer lines, muzzle flash, hit markers
└── Leaderboard.js        # HUD leaderboard display

server/
└── GameServer.js         # (modify) Add combat message handling
```

---

## Implementation Stages

### Stage 11: Aircraft Scale & Hitboxes

**Goal:** Make aircraft bigger and add collision detection infrastructure.

**Tasks:**
1. Scale aircraft mesh by 2x in `Aircraft.js` and `RemoteAircraft.js`
2. Adjust camera follow distance proportionally
3. Add `getHitbox()` method returning `THREE.Sphere`
4. Add hitbox visualization (debug mode)

**Estimated time:** 20-30 minutes

---

### Stage 12: Shooting Mechanics (Client)

**Goal:** Player can fire bullets with visual effects.

**Tasks:**
1. Create `src/combat/CombatManager.js`
   - Handle fire input (mouse click or spacebar)
   - Enforce fire rate cooldown
   - Perform raycast against remote aircraft
   - Send `shoot` and `hit` messages to server
2. Create `src/combat/BulletEffects.js`
   - Tracer line (fades over 200ms)
   - Muzzle flash (particle burst)
   - Hit marker (X or circle at impact point)
3. Add fire control to `InputHandler.js`
4. Integrate with main.js update loop

**Estimated time:** 45-60 minutes

---

### Stage 13: Combat Server

**Goal:** Server validates hits and tracks scores.

**Tasks:**
1. Add `score` field to player state
2. Handle `shoot` message (broadcast to others)
3. Handle `hit` message:
   - Validate shooter and target exist
   - Rate limit (max 10 hits/second per player)
   - Increment shooter's score
   - Broadcast `hit_confirmed` to all
4. Include scores in `players` broadcast
5. Reset score on player disconnect

**Estimated time:** 30-45 minutes

---

### Stage 14: Score Display & Leaderboard

**Goal:** Show scores in HUD with real-time leaderboard.

**Tasks:**
1. Create `src/combat/Leaderboard.js`
   - Top 5 players by score
   - Highlight local player
   - Update on score changes
2. Add hit feedback to HUD:
   - "+1" popup when you hit someone
   - Flash when you get hit
3. Update HUD.js to receive score updates
4. Show own score prominently

**Estimated time:** 30-45 minutes

---

### Stage 15: Polish & Balance

**Goal:** Tune combat feel and add polish.

**Tasks:**
1. Tune fire rate, bullet range, hitbox size
2. Add sound effects (optional but impactful)
   - Gunfire sound on shoot
   - Hit sound on successful hit
3. Add hit notification ("You hit PlayerName!")
4. Add death/respawn (optional):
   - After 10 hits, aircraft "explodes"
   - Respawn at start position
5. Performance test with 10+ players shooting

**Estimated time:** 30-45 minutes

---

## Code Patterns

### Raycasting for Hit Detection

```javascript
// In CombatManager.js
import * as THREE from 'three';

export class CombatManager {
  constructor(scene, localAircraft, playerSync, networkManager) {
    this.scene = scene;
    this.localAircraft = localAircraft;
    this.playerSync = playerSync;
    this.networkManager = networkManager;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 1000; // 1km range

    this.canFire = true;
    this.fireCooldown = 200; // ms
    this.lastFireTime = 0;
  }

  fire() {
    const now = performance.now();
    if (now - this.lastFireTime < this.fireCooldown) {
      return; // Still cooling down
    }
    this.lastFireTime = now;

    // Get fire origin and direction
    const origin = this.localAircraft.position.clone();
    const direction = this.localAircraft.getForwardVector();

    // Send shoot event to server (for other players to see)
    this.networkManager.send({
      type: 'shoot',
      position: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z }
    });

    // Create visual effect
    this.createTracerEffect(origin, direction);

    // Raycast against remote aircraft
    this.raycaster.set(origin, direction);
    const hitboxes = this.playerSync.getHitboxMeshes();
    const intersects = this.raycaster.intersectObjects(hitboxes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const targetId = hit.object.userData.playerId;

      // Send hit event
      this.networkManager.send({
        type: 'hit',
        targetId: targetId
      });

      // Create hit effect
      this.createHitEffect(hit.point);
    }
  }
}
```

### Bounding Sphere Hitbox

```javascript
// In RemoteAircraft.js

getHitbox() {
  // Return bounding sphere centered on aircraft
  return new THREE.Sphere(this.position.clone(), 15); // 15m radius
}

// For raycasting, we need a mesh
createHitboxMesh() {
  const geometry = new THREE.SphereGeometry(15, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    visible: false // Invisible hitbox
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.playerId = this.playerId;
  return mesh;
}
```

### Tracer Effect

```javascript
// In BulletEffects.js

createTracer(origin, direction, scene) {
  const end = origin.clone().add(direction.clone().multiplyScalar(500));

  const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 1
  });

  const line = new THREE.Line(geometry, material);
  scene.add(line);

  // Fade out over 200ms
  const startTime = performance.now();
  const animate = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed > 200) {
      scene.remove(line);
      geometry.dispose();
      material.dispose();
      return;
    }
    material.opacity = 1 - (elapsed / 200);
    requestAnimationFrame(animate);
  };
  animate();
}
```

### Server Hit Validation

```javascript
// In GameServer.js

handleMessage(ws, msg, playerId, setPlayerId) {
  // ... existing code ...

  if (msg.type === 'shoot' && playerId) {
    // Broadcast shot to all other players (for visual effects)
    this.broadcastShot(playerId, msg.position, msg.direction);
  }

  if (msg.type === 'hit' && playerId) {
    this.handleHit(playerId, msg.targetId);
  }
}

handleHit(shooterId, targetId) {
  const shooter = this.players.get(shooterId);
  const target = this.players.get(targetId);

  // Validation
  if (!shooter || !target) return;
  if (shooterId === targetId) return; // Can't shoot yourself

  // Rate limit: max 10 hits per second
  const now = Date.now();
  if (now - shooter.lastHitTime < 100) return;
  shooter.lastHitTime = now;

  // Increment score
  shooter.score = (shooter.score || 0) + 1;

  // Broadcast hit confirmation
  this.broadcastHitConfirmed(shooterId, targetId, shooter.score);

  console.log(`[Hit] ${shooter.name} hit ${target.name}. Score: ${shooter.score}`);
}

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

---

## Performance Considerations

### Raycast Optimization

- Only raycast when fire is pressed (not every frame)
- Limit to nearby aircraft (< 1km away)
- Use simple sphere hitboxes, not mesh geometry

### Effect Cleanup

- Dispose tracer geometry/material after fade
- Pool and reuse particle systems
- Limit max concurrent effects (10-20)

### Network Bandwidth

- `shoot` messages: ~100 bytes × 5/sec = 500 bytes/sec max
- `hit` messages: ~50 bytes × occasional = negligible
- Total added bandwidth: < 1 KB/sec per player

---

## What NOT to Build (MVP Scope)

- ❌ Projectile physics (use hitscan)
- ❌ Different weapons/aircraft
- ❌ Health system (just score on hits)
- ❌ Persistent leaderboards (database)
- ❌ Teams/team scoring
- ❌ Damage falloff by distance
- ❌ Server-side hit validation (trust client)

---

## Testing Checklist

### Stage 11: Scale & Hitboxes
- [ ] Aircraft visually 2x larger
- [ ] Camera still follows at appropriate distance
- [ ] Hitbox sphere visible in debug mode
- [ ] Hitbox moves with aircraft

### Stage 12: Shooting
- [ ] Click/spacebar fires
- [ ] 200ms cooldown enforced
- [ ] Tracer line visible and fades
- [ ] Hit detection works on remote aircraft
- [ ] No console errors

### Stage 13: Server
- [ ] `shoot` message broadcast to others
- [ ] `hit` message updates score
- [ ] Score included in player data
- [ ] Rate limiting prevents spam

### Stage 14: Leaderboard
- [ ] Scores visible in HUD
- [ ] Leaderboard shows top 5
- [ ] Own score highlighted
- [ ] "+1" popup on hit

### Stage 15: Polish
- [ ] Combat feels responsive
- [ ] 10+ players can shoot simultaneously
- [ ] No performance issues
- [ ] Sound effects work (if added)

---

## Summary

| Stage | Goal | Time |
|-------|------|------|
| Stage 11 | Scale aircraft, add hitboxes | 20-30 min |
| Stage 12 | Shooting mechanics (client) | 45-60 min |
| Stage 13 | Combat server (validation, scores) | 30-45 min |
| Stage 14 | Score display & leaderboard | 30-45 min |
| Stage 15 | Polish & balance | 30-45 min |
| **Total** | | **~3-4 hours** |

The architecture prioritizes simplicity and responsiveness over anti-cheat. For a casual, viral game like fly.pieter.com, this is the right tradeoff.
