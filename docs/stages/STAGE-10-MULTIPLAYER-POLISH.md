# Stage 10: Multiplayer Polish

## Goal

Improve interpolation quality, add visual polish, and ensure a smooth multiplayer experience.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Stage 9 complete (remote players visible)
- Basic multiplayer working

---

## Tasks

### Task 10.1: Improve Interpolation

Create `src/network/Interpolation.js`:

Better interpolation that buffers updates and handles network jitter:

```javascript
/**
 * PositionBuffer - buffers position updates for smooth interpolation
 */
export class PositionBuffer {
  constructor(bufferSize = 3) {
    this.bufferSize = bufferSize;
    this.buffer = [];  // Array of { position, rotation, velocity, timestamp }
  }

  /**
   * Add a new position update to the buffer
   */
  push(state) {
    this.buffer.push({
      position: { ...state.position },
      rotation: { ...state.rotation },
      velocity: { ...state.velocity },
      timestamp: state.timestamp || Date.now()
    });

    // Keep buffer size limited
    while (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get interpolated state at current render time
   * Renders slightly in the past to have two points to interpolate between
   */
  getInterpolatedState(renderDelay = 100) {
    if (this.buffer.length === 0) {
      return null;
    }

    if (this.buffer.length === 1) {
      return this.buffer[0];
    }

    // Render time is slightly in the past
    const renderTime = Date.now() - renderDelay;

    // Find the two states to interpolate between
    let older = null;
    let newer = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime &&
          this.buffer[i + 1].timestamp >= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1];
        break;
      }
    }

    // If we're ahead of all buffered states, extrapolate from the latest
    if (!older && !newer && this.buffer.length >= 2) {
      const latest = this.buffer[this.buffer.length - 1];
      const prev = this.buffer[this.buffer.length - 2];

      // Extrapolate using velocity
      const dt = (renderTime - latest.timestamp) / 1000;
      const maxExtrapolate = 0.2;  // Max 200ms extrapolation

      if (dt > 0 && dt < maxExtrapolate) {
        return {
          position: {
            x: latest.position.x + latest.velocity.x * dt,
            y: latest.position.y + latest.velocity.y * dt,
            z: latest.position.z + latest.velocity.z * dt
          },
          rotation: latest.rotation,
          velocity: latest.velocity,
          timestamp: renderTime
        };
      }

      return latest;
    }

    // If we're behind all buffered states, return oldest
    if (!older) {
      return this.buffer[0];
    }

    // Interpolate between older and newer
    const t = (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      position: {
        x: this.lerp(older.position.x, newer.position.x, clampedT),
        y: this.lerp(older.position.y, newer.position.y, clampedT),
        z: this.lerp(older.position.z, newer.position.z, clampedT)
      },
      rotation: {
        x: this.lerpAngle(older.rotation.x, newer.rotation.x, clampedT),
        y: this.lerpAngle(older.rotation.y, newer.rotation.y, clampedT),
        z: this.lerpAngle(older.rotation.z, newer.rotation.z, clampedT)
      },
      velocity: newer.velocity,
      timestamp: renderTime
    };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpAngle(a, b, t) {
    // Handle angle wraparound
    let delta = b - a;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return a + delta * t;
  }

  /**
   * Check if buffer has recent data
   */
  hasRecentData(maxAge = 2000) {
    if (this.buffer.length === 0) return false;
    const latest = this.buffer[this.buffer.length - 1];
    return Date.now() - latest.timestamp < maxAge;
  }
}
```

### Task 10.2: Update RemoteAircraft to Use Buffer

Update `src/network/RemoteAircraft.js`:

```javascript
import { PositionBuffer } from './Interpolation.js';

export class RemoteAircraft {
  constructor(playerId, playerName) {
    // ... existing code ...

    // Replace simple interpolation with buffer
    this.positionBuffer = new PositionBuffer(4);  // 4 samples
  }

  setNetworkState(data) {
    // Push to buffer instead of setting target directly
    this.positionBuffer.push({
      position: data.position,
      rotation: data.rotation,
      velocity: data.velocity,
      timestamp: data.timestamp || Date.now()
    });
    this.lastUpdateTime = Date.now();
  }

  update(deltaTime) {
    // Get interpolated state from buffer
    const state = this.positionBuffer.getInterpolatedState(100);  // 100ms render delay

    if (state) {
      this.position.set(state.position.x, state.position.y, state.position.z);
      this.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
      this.velocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
    }

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
  }

  isStale(timeout = 5000) {
    return !this.positionBuffer.hasRecentData(timeout);
  }
}
```

### Task 10.3: Add Player Trails (Visual Polish)

Optional but cool - add fading trails behind aircraft:

```javascript
// In RemoteAircraft.js

createTrail() {
  const points = [];
  for (let i = 0; i < 50; i++) {
    points.push(new THREE.Vector3(0, 0, i * 2));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.3
  });

  this.trail = new THREE.Line(geometry, material);
  this.trailPositions = [];
  this.maxTrailLength = 50;

  return this.trail;
}

updateTrail() {
  if (!this.trail) return;

  // Add current position to trail
  this.trailPositions.unshift(this.position.clone());

  // Limit trail length
  while (this.trailPositions.length > this.maxTrailLength) {
    this.trailPositions.pop();
  }

  // Update geometry
  const positions = this.trail.geometry.attributes.position.array;
  for (let i = 0; i < this.trailPositions.length; i++) {
    positions[i * 3] = this.trailPositions[i].x;
    positions[i * 3 + 1] = this.trailPositions[i].y;
    positions[i * 3 + 2] = this.trailPositions[i].z;
  }
  this.trail.geometry.attributes.position.needsUpdate = true;
}
```

### Task 10.4: Add Network Stats to HUD

Update `src/ui/HUD.js`:

```javascript
// Add ping/latency display
createNetworkStats() {
  this.networkStats = document.createElement('div');
  this.networkStats.style.cssText = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    color: rgba(255,255,255,0.6);
    font-family: system-ui, sans-serif;
    font-size: 12px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  `;
  this.container.appendChild(this.networkStats);
}

updateNetworkStats(ping, packetLoss) {
  if (this.networkStats) {
    this.networkStats.textContent = `Ping: ${ping}ms`;
  }
}
```

### Task 10.5: Add Simple Ping Measurement

Update `src/network/NetworkManager.js`:

```javascript
constructor(url) {
  // ... existing code ...

  this.lastPing = 0;
  this.pingInterval = null;
}

connect() {
  // ... existing code ...

  this.ws.onopen = () => {
    // ... existing code ...

    // Start ping measurement
    this.pingInterval = setInterval(() => this.measurePing(), 5000);
  };

  this.ws.onclose = () => {
    // ... existing code ...
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  };
}

measurePing() {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.pingSentTime = Date.now();
    this.send({ type: 'ping' });
  }
}

handleMessage(msg) {
  switch (msg.type) {
    // ... existing cases ...

    case 'pong':
      this.lastPing = Date.now() - this.pingSentTime;
      this.onPingUpdate?.(this.lastPing);
      break;
  }
}

getPing() {
  return this.lastPing;
}
```

### Task 10.6: Hide Controls Hint After First Input

Update `src/ui/HUD.js`:

```javascript
hideControlsHint() {
  if (this.controlsHint) {
    this.controlsHint.style.transition = 'opacity 0.5s';
    this.controlsHint.style.opacity = '0';
    setTimeout(() => {
      if (this.controlsHint) {
        this.controlsHint.remove();
        this.controlsHint = null;
      }
    }, 500);
  }
}
```

Wire up in InputHandler when first input received.

### Task 10.7: Add Player Join/Leave Notifications

```javascript
// In main.js or HUD.js

function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 1000;
    animation: fadeInOut ${duration}ms ease-in-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), duration);
}

// Wire up
networkManager.onPlayerJoined = (id, name) => {
  showNotification(`${name} joined`);
};

networkManager.onPlayerLeft = (id) => {
  const player = playerSync.remotePlayers.get(id);
  if (player) {
    showNotification(`${player.playerName} left`);
  }
  playerSync.removePlayer(id);
};
```

---

## Acceptance Criteria

- [ ] Remote aircraft movement is smooth (no jitter)
- [ ] Brief network hiccups don't cause teleporting
- [ ] Ping shows in HUD (bottom right)
- [ ] Player join/leave notifications appear
- [ ] Controls hint fades after first input
- [ ] Player count accurate in HUD

---

## Code Patterns

### Buffered Interpolation

```javascript
// Buffer incoming states
buffer.push(newState);

// Render from past (100ms delay)
const renderTime = Date.now() - 100;

// Find two states to interpolate between
// Interpolate with clamped t value
```

### Angle Interpolation

```javascript
// Handle wraparound for angles
let delta = b - a;
while (delta > Math.PI) delta -= 2 * Math.PI;
while (delta < -Math.PI) delta += 2 * Math.PI;
return a + delta * t;
```

### Extrapolation with Velocity

```javascript
// When no new data, extrapolate using velocity
const dt = (now - lastUpdate) / 1000;
position.x += velocity.x * dt;
position.y += velocity.y * dt;
position.z += velocity.z * dt;
```

---

## What NOT to Do

- ❌ Don't over-engineer the interpolation (simple is fine)
- ❌ Don't add complex prediction (not needed for flight sim)
- ❌ Don't add collision detection between players yet
- ❌ Don't add chat system yet (future feature)

---

## Completion

After this stage, multiplayer is complete for MVP!

**Final Checklist:**
- [ ] Multiple players visible and smooth
- [ ] Connection status in HUD
- [ ] Player count accurate
- [ ] Join/leave notifications
- [ ] Ping display
- [ ] No console errors
- [ ] Works on mobile
- [ ] 10+ minute session stable

---

## Post-MVP Ideas

Things to add later:
1. **Chat system** - Text chat between players
2. **Voice chat** - WebRTC proximity voice
3. **Mini-map** - Show other players on radar
4. **Different aircraft** - Let players choose color/type
5. **Leaderboards** - Time in air, distance traveled
6. **Regions** - Spatial partitioning for many players
