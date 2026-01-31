# Stage 9: Remote Players (PlayerSync)

## Goal

Render other players' aircraft in the scene, creating/destroying them as players join/leave.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Stage 8 complete (NetworkManager connected and sending)
- Server broadcasting player positions

---

## Tasks

### Task 9.1: Create RemoteAircraft.js

Create `src/network/RemoteAircraft.js`:

This is a simpler version of Aircraft.js for remote players - no physics, just visual representation.

```javascript
import * as THREE from 'three';

/**
 * RemoteAircraft - visual representation of another player's aircraft
 * No physics - just mesh that gets updated from network
 */
export class RemoteAircraft {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;

    // Current state (from network)
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    this.velocity = new THREE.Vector3();

    // Interpolation state
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Euler(0, 0, 0, 'XYZ');
    this.lastUpdateTime = 0;

    // Create mesh
    this.mesh = this.createMesh();

    // Create name label
    this.label = this.createLabel(playerName);
    this.mesh.add(this.label);
  }

  /**
   * Create airplane mesh (blue color to distinguish from local player)
   */
  createMesh() {
    const group = new THREE.Group();

    // Materials - BLUE for remote players
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,  // Blue fuselage
      roughness: 0.4
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x2255cc,  // Darker blue accents
      roughness: 0.4
    });

    // Fuselage
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 15),
      bodyMaterial
    );
    group.add(fuselage);

    // Nose
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(1, 4, 8),
      accentMaterial
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -9.5;
    group.add(nose);

    // Wings
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.3, 4),
      bodyMaterial
    );
    wings.position.z = 1;
    group.add(wings);

    // Tail fin
    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 4, 3),
      accentMaterial
    );
    tailFin.position.set(0, 2, 6);
    group.add(tailFin);

    // Horizontal stabilizer
    const hStab = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.3, 2),
      bodyMaterial
    );
    hStab.position.set(0, 0, 6.5);
    group.add(hStab);

    return group;
  }

  /**
   * Create floating name label above aircraft
   */
  createLabel(name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    // Draw text
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 32px sans-serif';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(20, 5, 1);
    sprite.position.set(0, 8, 0);  // Above aircraft

    return sprite;
  }

  /**
   * Update target state from network data
   */
  setNetworkState(data) {
    this.targetPosition.set(data.position.x, data.position.y, data.position.z);
    this.targetRotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
    this.velocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
    this.lastUpdateTime = Date.now();
  }

  /**
   * Update mesh with interpolation toward target
   */
  update(deltaTime) {
    // Interpolation factor (smooth catch-up)
    const lerpFactor = 1 - Math.pow(0.001, deltaTime);

    // Lerp position
    this.position.lerp(this.targetPosition, lerpFactor);

    // Lerp rotation (simple component-wise for Euler)
    this.rotation.x += (this.targetRotation.x - this.rotation.x) * lerpFactor;
    this.rotation.y += (this.targetRotation.y - this.rotation.y) * lerpFactor;
    this.rotation.z += (this.targetRotation.z - this.rotation.z) * lerpFactor;

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);

    // Make label always face camera (done automatically by Sprite)
  }

  /**
   * Check if this aircraft is stale (no updates in a while)
   */
  isStale(timeout = 5000) {
    return Date.now() - this.lastUpdateTime > timeout;
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Dispose geometries and materials
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
```

### Task 9.2: Create PlayerSync.js

Create `src/network/PlayerSync.js`:

```javascript
import { RemoteAircraft } from './RemoteAircraft.js';

/**
 * PlayerSync - manages all remote player aircraft
 */
export class PlayerSync {
  constructor(scene) {
    this.scene = scene;
    this.remotePlayers = new Map();  // playerId -> RemoteAircraft
  }

  /**
   * Update all remote players from server data
   * @param {Object} playersData - Map of playerId -> player state
   */
  updatePlayers(playersData) {
    const receivedIds = new Set(Object.keys(playersData));

    // Update existing or create new
    for (const [id, data] of Object.entries(playersData)) {
      if (this.remotePlayers.has(id)) {
        // Update existing
        this.remotePlayers.get(id).setNetworkState(data);
      } else {
        // Create new
        this.addPlayer(id, data.name, data);
      }
    }

    // Remove players no longer in server data
    for (const [id, aircraft] of this.remotePlayers) {
      if (!receivedIds.has(id)) {
        this.removePlayer(id);
      }
    }
  }

  /**
   * Add a new remote player
   */
  addPlayer(playerId, playerName, initialData) {
    console.log(`Adding remote player: ${playerName} (${playerId})`);

    const aircraft = new RemoteAircraft(playerId, playerName);
    if (initialData) {
      aircraft.setNetworkState(initialData);
      // Set initial position immediately (no lerp for first frame)
      aircraft.position.copy(aircraft.targetPosition);
      aircraft.rotation.copy(aircraft.targetRotation);
      aircraft.mesh.position.copy(aircraft.position);
      aircraft.mesh.rotation.copy(aircraft.rotation);
    }

    this.remotePlayers.set(playerId, aircraft);
    this.scene.add(aircraft.mesh);
  }

  /**
   * Remove a remote player
   */
  removePlayer(playerId) {
    const aircraft = this.remotePlayers.get(playerId);
    if (aircraft) {
      console.log(`Removing remote player: ${playerId}`);
      this.scene.remove(aircraft.mesh);
      aircraft.dispose();
      this.remotePlayers.delete(playerId);
    }
  }

  /**
   * Update all remote aircraft (interpolation)
   * Call this every frame
   */
  update(deltaTime) {
    for (const [id, aircraft] of this.remotePlayers) {
      aircraft.update(deltaTime);
    }
  }

  /**
   * Get count of remote players
   */
  getPlayerCount() {
    return this.remotePlayers.size;
  }

  /**
   * Clean up all remote players
   */
  dispose() {
    for (const [id, aircraft] of this.remotePlayers) {
      this.scene.remove(aircraft.mesh);
      aircraft.dispose();
    }
    this.remotePlayers.clear();
  }
}
```

### Task 9.3: Integrate with main.js

Update `src/main.js`:

```javascript
// Add import
import { PlayerSync } from './network/PlayerSync.js';

// After creating NetworkManager
const playerSync = new PlayerSync(scene);

// Set up network callbacks
networkManager.onPlayersUpdate = (players, count) => {
  playerSync.updatePlayers(players);
  hud.updateConnectionStatus(true, count);
};

networkManager.onPlayerJoined = (id, name) => {
  console.log(`Player joined: ${name}`);
  // Player will be added on next updatePlayers call
};

networkManager.onPlayerLeft = (id) => {
  playerSync.removePlayer(id);
};

// In update function
function update(deltaTime) {
  // ... existing code ...

  // Update remote players (interpolation)
  playerSync.update(deltaTime);

  // ... rest of update (camera, tiles, render) ...
}
```

### Task 9.4: Verify Integration Order

Ensure the update order in main.js is:

```javascript
function update(deltaTime) {
  // 1. Process local input
  inputHandler.update(deltaTime);
  const input = inputHandler.getState();

  // 2. Update local physics
  updatePhysics(aircraft, input, deltaTime);

  // 3. Send local position to server
  networkManager.sendPosition(aircraft);

  // 4. Update remote players (interpolation)
  playerSync.update(deltaTime);

  // 5. Update camera to follow local aircraft
  cameraController.update(deltaTime);

  // 6. Update HUD
  hud.update(aircraft.getSpeed(), aircraft.getAltitude());

  // 7. Update tiles and render
  camera.updateMatrixWorld();
  tilesRenderer.update();
  renderer.render(scene, camera);
}
```

---

## Acceptance Criteria

- [ ] Opening two browser tabs shows both aircraft
- [ ] Local aircraft is RED, remote aircraft is BLUE
- [ ] Remote aircraft has name label floating above it
- [ ] Remote aircraft moves smoothly (no teleporting)
- [ ] Closing a tab removes that aircraft from other tabs
- [ ] HUD shows correct player count

---

## Code Patterns

### Smooth Interpolation

```javascript
// Lerp factor based on deltaTime
// Math.pow(0.001, deltaTime) gives smooth exponential decay
const lerpFactor = 1 - Math.pow(0.001, deltaTime);
position.lerp(targetPosition, lerpFactor);
```

### Set Operations for Diff

```javascript
const receivedIds = new Set(Object.keys(newData));
for (const [id, obj] of existingMap) {
  if (!receivedIds.has(id)) {
    // This ID is no longer in new data, remove it
  }
}
```

### Canvas Texture for Labels

```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Draw text...
const texture = new THREE.CanvasTexture(canvas);
const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
```

---

## What NOT to Do

- ❌ Don't run physics for remote players (just use interpolation)
- ❌ Don't create complex entity-component systems
- ❌ Don't worry about LOD for remote players yet
- ❌ Don't add collision between players (future)

---

## Handoff to Stage 10

After this stage:
- Multiple players visible and moving
- But interpolation may still have rough edges
- Stage 10 polishes interpolation and adds extra features

---

## Troubleshooting

### Remote players not appearing
- Check console for "Adding remote player" logs
- Check NetworkManager.onPlayersUpdate is being called
- Check playerSync.updatePlayers is receiving data

### Remote players jittering
- Check interpolation is running every frame
- May need to adjust lerp factor
- Stage 10 adds better interpolation

### Wrong player count
- HUD might be counting local player
- Check we're excluding local ID from players data
