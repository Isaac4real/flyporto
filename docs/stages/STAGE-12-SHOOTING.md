# Stage 12: Shooting Mechanics (Client)

## Goal

Implement shooting with visual effects and client-side hit detection via raycasting.

**Estimated time:** 45-60 minutes

---

## Prerequisites

- Stage 11 complete (aircraft scaled, hitboxes ready)
- `playerSync.getHitboxMeshes()` returns hitbox meshes

---

## Tasks

### Task 12.1: Create Combat Directory

Create `src/combat/` directory with three files.

### Task 12.2: Create BulletEffects.js

Create `src/combat/BulletEffects.js`:

```javascript
import * as THREE from 'three';

/**
 * BulletEffects - manages visual effects for shooting
 * - Tracer lines
 * - Muzzle flash
 * - Hit markers
 */
export class BulletEffects {
  constructor(scene) {
    this.scene = scene;
    this.activeEffects = [];
    this.maxEffects = 20;  // Limit concurrent effects
  }

  /**
   * Create tracer line from origin in direction
   * Fades out over 150ms
   */
  createTracer(origin, direction) {
    // Calculate end point (500m range visual)
    const end = origin.clone().add(direction.clone().multiplyScalar(500));

    // Create line geometry
    const points = [origin.clone(), end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Yellow/orange tracer
    const material = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1,
      linewidth: 2  // Note: linewidth > 1 only works on some systems
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Animate fade out
    const startTime = performance.now();
    const duration = 150;  // ms

    const effect = {
      mesh: line,
      geometry,
      material,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;  // Done, remove
        }
        material.opacity = 1 - (elapsed / duration);
        return false;
      }
    };

    this.addEffect(effect);
    return line;
  }

  /**
   * Create muzzle flash at position
   * Quick flash that fades immediately
   */
  createMuzzleFlash(position, direction) {
    // Small sphere for flash
    const geometry = new THREE.SphereGeometry(2, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1
    });

    const flash = new THREE.Mesh(geometry, material);

    // Position slightly in front of aircraft
    const flashPos = position.clone().add(direction.clone().multiplyScalar(20));
    flash.position.copy(flashPos);

    this.scene.add(flash);

    // Very quick fade (50ms)
    const startTime = performance.now();
    const duration = 50;

    const effect = {
      mesh: flash,
      geometry,
      material,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;
        }
        material.opacity = 1 - (elapsed / duration);
        const scale = 1 + (elapsed / duration) * 2;  // Grow as it fades
        flash.scale.setScalar(scale);
        return false;
      }
    };

    this.addEffect(effect);
  }

  /**
   * Create hit marker at impact point
   * Red X or circle that fades
   */
  createHitMarker(position) {
    // Ring geometry for hit marker
    const geometry = new THREE.RingGeometry(2, 4, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });

    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);

    // Face the camera (will be updated in render)
    marker.lookAt(0, 0, 0);  // Will update properly when camera is available

    this.scene.add(marker);

    const startTime = performance.now();
    const duration = 300;

    const effect = {
      mesh: marker,
      geometry,
      material,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;
        }
        material.opacity = 1 - (elapsed / duration);
        const scale = 1 + (elapsed / duration);
        marker.scale.setScalar(scale);
        return false;
      }
    };

    this.addEffect(effect);
  }

  /**
   * Add effect with cleanup on limit
   */
  addEffect(effect) {
    this.activeEffects.push(effect);

    // Remove oldest if at limit
    while (this.activeEffects.length > this.maxEffects) {
      const oldest = this.activeEffects.shift();
      this.removeEffect(oldest);
    }
  }

  /**
   * Remove and dispose effect
   */
  removeEffect(effect) {
    this.scene.remove(effect.mesh);
    effect.geometry.dispose();
    effect.material.dispose();
  }

  /**
   * Update all active effects (call every frame)
   */
  update() {
    const now = performance.now();
    const toRemove = [];

    for (const effect of this.activeEffects) {
      const done = effect.update(now);
      if (done) {
        toRemove.push(effect);
      }
    }

    // Remove completed effects
    for (const effect of toRemove) {
      const index = this.activeEffects.indexOf(effect);
      if (index > -1) {
        this.activeEffects.splice(index, 1);
      }
      this.removeEffect(effect);
    }
  }

  /**
   * Clean up all effects
   */
  dispose() {
    for (const effect of this.activeEffects) {
      this.removeEffect(effect);
    }
    this.activeEffects = [];
  }
}
```

### Task 12.3: Create CombatManager.js

Create `src/combat/CombatManager.js`:

```javascript
import * as THREE from 'three';
import { BulletEffects } from './BulletEffects.js';

/**
 * CombatManager - handles shooting and hit detection
 */
export class CombatManager {
  constructor(scene, localAircraft, playerSync, networkManager) {
    this.scene = scene;
    this.localAircraft = localAircraft;
    this.playerSync = playerSync;
    this.networkManager = networkManager;

    // Effects
    this.bulletEffects = new BulletEffects(scene);

    // Raycaster for hit detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0;
    this.raycaster.far = 1000;  // 1km range

    // Fire rate control
    this.canFire = true;
    this.fireCooldown = 200;  // 200ms = 5 shots/second
    this.lastFireTime = 0;

    // Score tracking (local copy)
    this.myScore = 0;
    this.scores = {};  // playerId -> score

    // Callbacks
    this.onHit = null;       // Called when we hit someone
    this.onGotHit = null;    // Called when someone hits us

    // Set up network handlers
    this.setupNetworkHandlers();
  }

  /**
   * Set up handlers for combat-related network messages
   */
  setupNetworkHandlers() {
    // Store original handler to extend it
    const originalHandler = this.networkManager.handleMessage.bind(this.networkManager);

    this.networkManager.handleMessage = (msg) => {
      // Call original handler first
      originalHandler(msg);

      // Handle combat messages
      switch (msg.type) {
        case 'player_shoot':
          this.onRemoteShoot(msg);
          break;

        case 'hit_confirmed':
          this.onHitConfirmed(msg);
          break;

        case 'players':
          // Update scores from player data
          if (msg.scores) {
            this.scores = msg.scores;
            this.myScore = msg.scores[this.networkManager.playerId] || 0;
          }
          break;
      }
    };
  }

  /**
   * Attempt to fire - call this when fire button is pressed
   */
  fire() {
    const now = performance.now();

    // Check cooldown
    if (now - this.lastFireTime < this.fireCooldown) {
      return false;
    }
    this.lastFireTime = now;

    // Get fire origin and direction from aircraft
    const origin = this.localAircraft.position.clone();
    const direction = this.localAircraft.getForwardVector();

    // Send shoot event to server (for other players to see effects)
    this.networkManager.send({
      type: 'shoot',
      position: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: Date.now()
    });

    // Create local visual effects
    this.bulletEffects.createMuzzleFlash(origin, direction);
    this.bulletEffects.createTracer(origin, direction);

    // Perform hit detection via raycasting
    this.checkHit(origin, direction);

    return true;
  }

  /**
   * Check for hit using raycasting
   */
  checkHit(origin, direction) {
    // Get all hitbox meshes from player sync
    const hitboxes = this.playerSync.getHitboxMeshes();

    if (hitboxes.length === 0) {
      return;  // No targets
    }

    // Set up raycaster
    this.raycaster.set(origin, direction);

    // Check intersections
    const intersects = this.raycaster.intersectObjects(hitboxes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const targetId = hit.object.userData.playerId;

      if (targetId) {
        // Send hit event to server
        this.networkManager.send({
          type: 'hit',
          targetId: targetId,
          timestamp: Date.now()
        });

        // Create hit marker
        this.bulletEffects.createHitMarker(hit.point);

        // Local feedback (will be confirmed by server)
        console.log(`[Combat] Hit ${targetId}!`);
      }
    }
  }

  /**
   * Handle remote player shooting (show their effects)
   */
  onRemoteShoot(msg) {
    if (msg.shooterId === this.networkManager.playerId) {
      return;  // Ignore our own shots
    }

    const origin = new THREE.Vector3(msg.position.x, msg.position.y, msg.position.z);
    const direction = new THREE.Vector3(msg.direction.x, msg.direction.y, msg.direction.z);

    // Show their tracer
    this.bulletEffects.createTracer(origin, direction);
  }

  /**
   * Handle hit confirmation from server
   */
  onHitConfirmed(msg) {
    // Update scores
    if (msg.shooterScore !== undefined) {
      this.scores[msg.shooterId] = msg.shooterScore;
    }

    const myId = this.networkManager.playerId;

    if (msg.shooterId === myId) {
      // We hit someone!
      this.myScore = msg.shooterScore;
      const targetName = this.playerSync.getPlayer(msg.targetId)?.playerName || 'Unknown';
      this.onHit?.(msg.targetId, targetName, this.myScore);
    }

    if (msg.targetId === myId) {
      // We got hit!
      const shooterName = this.playerSync.getPlayer(msg.shooterId)?.playerName || 'Unknown';
      this.onGotHit?.(msg.shooterId, shooterName);
    }
  }

  /**
   * Update effects (call every frame)
   */
  update(deltaTime) {
    this.bulletEffects.update();
  }

  /**
   * Get current score
   */
  getScore() {
    return this.myScore;
  }

  /**
   * Get all scores
   */
  getScores() {
    return this.scores;
  }

  /**
   * Clean up
   */
  dispose() {
    this.bulletEffects.dispose();
  }
}
```

### Task 12.4: Add Fire Input

Update `src/input/InputHandler.js` to track fire state:

```javascript
// Add to constructor
this.firePressed = false;
this.fireJustPressed = false;

// Add to update() or create new method
updateFireState() {
  const wasPressed = this.firePressed;
  this.firePressed = this.keyboardInput.isKeyDown('Space') ||
                     this.keyboardInput.isKeyDown('KeyF') ||
                     this.touchInput?.isFiring?.();  // If touch has fire

  // Detect "just pressed" for single-shot control
  this.fireJustPressed = this.firePressed && !wasPressed;
}

// Add getter
isFiring() {
  return this.firePressed;
}

isFireJustPressed() {
  return this.fireJustPressed;
}
```

Update `src/input/KeyboardInput.js` to track all key states:

```javascript
// In constructor
this.keysDown = new Set();

// In setupListeners
window.addEventListener('keydown', (e) => {
  this.keysDown.add(e.code);
  // ... existing code
});

window.addEventListener('keyup', (e) => {
  this.keysDown.delete(e.code);
  // ... existing code
});

// Add method
isKeyDown(code) {
  return this.keysDown.has(code);
}
```

### Task 12.5: Integrate with main.js

Update `src/main.js`:

```javascript
// Add import
import { CombatManager } from './combat/CombatManager.js';

// After creating playerSync and networkManager
const combatManager = new CombatManager(scene, aircraft, playerSync, networkManager);

// Set up combat callbacks
combatManager.onHit = (targetId, targetName, score) => {
  hud.showHitNotification(targetName, score);
};

combatManager.onGotHit = (shooterId, shooterName) => {
  hud.showGotHitEffect();
};

// In update function
function update(deltaTime) {
  // ... existing input/physics code ...

  // Check for firing (after input update)
  if (inputHandler.isFiring()) {
    combatManager.fire();
  }

  // Update combat effects
  combatManager.update(deltaTime);

  // ... rest of update (camera, tiles, render) ...
}
```

### Task 12.6: Add Basic HUD Methods

Update `src/ui/HUD.js` to add combat notifications:

```javascript
/**
 * Show "+1" popup when hitting someone
 */
showHitNotification(targetName, score) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #44ff44;
    font-family: system-ui, sans-serif;
    font-size: 48px;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    pointer-events: none;
    z-index: 1000;
  `;
  notification.textContent = `+1`;
  document.body.appendChild(notification);

  // Animate up and fade
  let opacity = 1;
  let offsetY = 0;
  const animate = () => {
    opacity -= 0.02;
    offsetY -= 2;
    if (opacity <= 0) {
      notification.remove();
      return;
    }
    notification.style.opacity = opacity;
    notification.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

/**
 * Flash screen red when hit
 */
showGotHitEffect() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 0, 0, 0.3);
    pointer-events: none;
    z-index: 999;
  `;
  document.body.appendChild(flash);

  // Quick fade
  let opacity = 0.3;
  const fade = () => {
    opacity -= 0.02;
    if (opacity <= 0) {
      flash.remove();
      return;
    }
    flash.style.background = `rgba(255, 0, 0, ${opacity})`;
    requestAnimationFrame(fade);
  };
  requestAnimationFrame(fade);
}
```

---

## Acceptance Criteria

- [ ] Spacebar or F key fires
- [ ] 200ms cooldown between shots (5/second max)
- [ ] Yellow/orange tracer line visible, fades over 150ms
- [ ] Muzzle flash visible at aircraft nose
- [ ] Raycasting detects hits on remote aircraft hitboxes
- [ ] Red hit marker appears at impact point
- [ ] `shoot` message sent to server
- [ ] `hit` message sent to server when hit detected
- [ ] Remote player tracers visible
- [ ] No console errors
- [ ] Effects clean up properly (no memory leak)

---

## Code Patterns

### Fire Rate Limiting

```javascript
const now = performance.now();
if (now - this.lastFireTime < this.fireCooldown) {
  return false;  // Still cooling down
}
this.lastFireTime = now;
```

### Raycasting Against Hitbox Meshes

```javascript
this.raycaster.set(origin, direction);
const intersects = this.raycaster.intersectObjects(hitboxMeshes, false);
if (intersects.length > 0) {
  const hit = intersects[0];
  const targetId = hit.object.userData.playerId;
}
```

### Extending NetworkManager Handler

```javascript
const originalHandler = this.networkManager.handleMessage.bind(this.networkManager);
this.networkManager.handleMessage = (msg) => {
  originalHandler(msg);  // Keep original behavior
  // Add new behavior
  if (msg.type === 'new_type') { ... }
};
```

---

## What NOT to Do

- ❌ Don't create new WebSocket connection (use existing NetworkManager)
- ❌ Don't fire every frame (use cooldown)
- ❌ Don't forget to clean up effects
- ❌ Don't validate hits on client beyond basic raycast

---

## Troubleshooting

### Raycast not hitting anything
- Check hitbox meshes are in scene
- Check `userData.playerId` is set on hitbox meshes
- Enable debug hitboxes to see if positions are correct
- Check raycaster far distance (should be 1000)

### Tracer not visible
- Check scene.add(line) is called
- Check material opacity starts at 1
- Check tracer end point is far enough from origin

### Fire rate too fast/slow
- Adjust `fireCooldown` in CombatManager
- Check performance.now() is being used (not Date.now())

---

## Handoff to Stage 13

After completing this stage:
- Client can fire and see effects
- Hits detected via raycasting
- Messages sent to server (`shoot`, `hit`)
- Ready for server to validate and track scores
