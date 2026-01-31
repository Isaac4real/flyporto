# Stage 11: Aircraft Scale & Hitboxes

## Goal

Scale up aircraft to be more visible and add collision detection infrastructure with bounding sphere hitboxes.

**Estimated time:** 20-30 minutes

---

## Prerequisites

- Stages 7-10 complete (multiplayer working)
- Remote players visible in game

---

## Context

Current aircraft dimensions are small relative to the world and camera distance:
- Fuselage: 2 × 2 × 15 units
- Wingspan: 20 units
- Camera follow distance: 80 meters

After scaling 2x:
- Fuselage: 4 × 4 × 30 units
- Wingspan: 40 units
- Aircraft will be more visible and satisfying targets

---

## Tasks

### Task 11.1: Scale Local Aircraft

Update `src/player/Aircraft.js`:

1. Add a scale constant at the top of the file:
```javascript
const AIRCRAFT_SCALE = 2.0;
```

2. Apply scale to the mesh group after creation:
```javascript
createMesh() {
  const group = new THREE.Group();
  // ... existing mesh creation code ...

  // Scale up the entire aircraft
  group.scale.setScalar(AIRCRAFT_SCALE);

  return group;
}
```

3. Add a `getHitboxRadius()` method:
```javascript
/**
 * Get hitbox radius for collision detection
 * Based on scaled aircraft size (wingspan is largest dimension)
 */
getHitboxRadius() {
  // Base wingspan is 20, scaled by AIRCRAFT_SCALE
  // Use slightly smaller than half wingspan for hitbox
  return 15 * AIRCRAFT_SCALE;  // 30 meters
}
```

### Task 11.2: Scale Remote Aircraft

Update `src/network/RemoteAircraft.js`:

1. Add same scale constant:
```javascript
const AIRCRAFT_SCALE = 2.0;
```

2. Apply scale in `createMesh()`:
```javascript
createMesh() {
  const group = new THREE.Group();
  // ... existing mesh creation code ...

  // Scale up the entire aircraft
  group.scale.setScalar(AIRCRAFT_SCALE);

  return group;
}
```

3. Add hitbox methods:
```javascript
/**
 * Get hitbox radius for collision detection
 */
getHitboxRadius() {
  return 15 * AIRCRAFT_SCALE;  // 30 meters
}

/**
 * Get bounding sphere for raycasting
 * @returns {THREE.Sphere}
 */
getHitbox() {
  return new THREE.Sphere(this.position.clone(), this.getHitboxRadius());
}

/**
 * Create invisible hitbox mesh for raycasting
 * The mesh is added to scene separately from aircraft mesh
 * @returns {THREE.Mesh}
 */
createHitboxMesh() {
  const geometry = new THREE.SphereGeometry(this.getHitboxRadius(), 8, 6);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.0,  // Invisible by default
    wireframe: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.playerId = this.playerId;
  mesh.userData.isHitbox = true;

  return mesh;
}
```

4. Update the `update()` method to sync hitbox position:
```javascript
update(deltaTime) {
  // ... existing interpolation code ...

  // Sync hitbox mesh position if it exists
  if (this.hitboxMesh) {
    this.hitboxMesh.position.copy(this.position);
  }
}
```

5. Add hitbox mesh storage:
```javascript
constructor(playerId, playerName) {
  // ... existing code ...

  // Create hitbox mesh (added to scene by PlayerSync)
  this.hitboxMesh = this.createHitboxMesh();
}
```

6. Update dispose to clean up hitbox:
```javascript
dispose() {
  // ... existing dispose code ...

  // Dispose hitbox mesh
  if (this.hitboxMesh) {
    this.hitboxMesh.geometry.dispose();
    this.hitboxMesh.material.dispose();
  }
}
```

### Task 11.3: Update PlayerSync for Hitboxes

Update `src/network/PlayerSync.js`:

1. Track hitbox meshes:
```javascript
constructor(scene) {
  this.scene = scene;
  this.remotePlayers = new Map();
  this.hitboxMeshes = [];  // Array for raycasting
}
```

2. Update `addPlayer()` to add hitbox mesh:
```javascript
addPlayer(playerId, playerName, initialData) {
  // ... existing code ...

  // Add hitbox mesh to scene
  if (aircraft.hitboxMesh) {
    this.scene.add(aircraft.hitboxMesh);
    this.hitboxMeshes.push(aircraft.hitboxMesh);
  }

  this.remotePlayers.set(playerId, aircraft);
  this.scene.add(aircraft.mesh);
}
```

3. Update `removePlayer()` to remove hitbox mesh:
```javascript
removePlayer(playerId) {
  const aircraft = this.remotePlayers.get(playerId);
  if (aircraft) {
    // Remove hitbox mesh
    if (aircraft.hitboxMesh) {
      this.scene.remove(aircraft.hitboxMesh);
      const index = this.hitboxMeshes.indexOf(aircraft.hitboxMesh);
      if (index > -1) {
        this.hitboxMeshes.splice(index, 1);
      }
    }

    // ... existing removal code ...
  }
}
```

4. Add method to get hitbox meshes for raycasting:
```javascript
/**
 * Get all hitbox meshes for raycasting
 * @returns {THREE.Mesh[]}
 */
getHitboxMeshes() {
  return this.hitboxMeshes;
}
```

5. Update `dispose()`:
```javascript
dispose() {
  for (const [id, aircraft] of this.remotePlayers) {
    if (aircraft.hitboxMesh) {
      this.scene.remove(aircraft.hitboxMesh);
    }
    this.scene.remove(aircraft.mesh);
    aircraft.dispose();
  }
  this.remotePlayers.clear();
  this.hitboxMeshes = [];
}
```

### Task 11.4: Adjust Camera (Optional)

The current camera settings in `config.js` should still work, but if aircraft feel too close or far, adjust:

```javascript
camera: {
  // ...
  follow: {
    distance: 100,   // Increased from 80 to account for larger aircraft
    height: 35,      // Increased from 25
    damping: 2.0,
    lookAhead: 120   // Increased from 100
  }
}
```

### Task 11.5: Add Debug Hitbox Visualization

Add a debug flag to show hitboxes (useful for testing):

In `src/config.js`:
```javascript
export const CONFIG = {
  // ... existing config ...

  debug: {
    showHitboxes: false  // Set to true to see hitbox wireframes
  }
};
```

In `RemoteAircraft.js`, update `createHitboxMesh()`:
```javascript
import { CONFIG } from '../config.js';

createHitboxMesh() {
  const geometry = new THREE.SphereGeometry(this.getHitboxRadius(), 8, 6);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: CONFIG.debug?.showHitboxes ? 0.3 : 0.0,
    wireframe: true
  });
  // ...
}
```

---

## Acceptance Criteria

- [ ] Local aircraft is visually 2x larger
- [ ] Remote aircraft are visually 2x larger
- [ ] Camera still follows at appropriate distance
- [ ] Aircraft name labels still positioned correctly above aircraft
- [ ] `playerSync.getHitboxMeshes()` returns array of hitbox meshes
- [ ] Setting `debug.showHitboxes = true` shows red wireframe spheres
- [ ] Hitboxes move with aircraft position
- [ ] No console errors
- [ ] Performance unchanged (no FPS drop)

---

## Code Patterns

### Extracting Scale Constant

```javascript
// At top of file
const AIRCRAFT_SCALE = 2.0;

// In createMesh()
group.scale.setScalar(AIRCRAFT_SCALE);

// Hitbox uses same scale
getHitboxRadius() {
  return 15 * AIRCRAFT_SCALE;
}
```

### Invisible Mesh for Raycasting

```javascript
const material = new THREE.MeshBasicMaterial({
  visible: false  // Alternative to opacity: 0
});
// OR
const material = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0
});
```

### Sync Hitbox Position

```javascript
update(deltaTime) {
  // ... update position from interpolation ...

  // Hitbox follows aircraft
  if (this.hitboxMesh) {
    this.hitboxMesh.position.copy(this.position);
  }
}
```

---

## What NOT to Do

- ❌ Don't scale the scene/camera (only aircraft)
- ❌ Don't change physics values (speed, acceleration)
- ❌ Don't make hitboxes too large (should be slightly smaller than visual)
- ❌ Don't forget to update both Aircraft.js AND RemoteAircraft.js

---

## Troubleshooting

### Aircraft looks stretched
- Check scale is applied to entire group, not individual meshes
- Use `setScalar()` not `set(x, y, z)`

### Label position wrong after scale
- Label is child of group, so it inherits scale
- May need to adjust `sprite.position.set(0, 8, 0)` → `(0, 4, 0)` since it's now scaled
- Actually: since label is inside scaled group, divide by scale: `(0, 8/AIRCRAFT_SCALE, 0)`

### Hitbox not moving with aircraft
- Make sure hitboxMesh.position is updated in `update()` method
- Check hitboxMesh is added to scene, not aircraft group

---

## Handoff to Stage 12

After completing this stage:
- Aircraft are 2x larger and more visible
- Hitbox infrastructure is ready for raycasting
- `playerSync.getHitboxMeshes()` available for CombatManager
- Ready to implement shooting mechanics
