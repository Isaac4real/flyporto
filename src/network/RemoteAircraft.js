import * as THREE from 'three';

/**
 * RemoteAircraft - visual representation of another player's aircraft
 * No physics - just mesh that gets updated from network with interpolation
 */
export class RemoteAircraft {
  /**
   * @param {string} playerId - Unique player identifier
   * @param {string} playerName - Display name for the player
   */
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;

    // Current interpolated state
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    this.velocity = new THREE.Vector3();

    // Target state (from network updates)
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Euler(0, 0, 0, 'XYZ');
    this.lastUpdateTime = 0;

    // Create visual mesh
    this.mesh = this.createMesh();

    // Create floating name label
    this.label = this.createLabel(playerName);
    this.mesh.add(this.label);
  }

  /**
   * Create airplane mesh with BLUE color to distinguish from local player
   * @returns {THREE.Group}
   */
  createMesh() {
    const group = new THREE.Group();

    // Materials - BLUE for remote players (local is gray/red)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,  // Light blue fuselage
      roughness: 0.4
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x2255cc,  // Darker blue accents
      roughness: 0.4
    });

    // Fuselage - elongated box (length along -Z)
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 15),
      bodyMaterial
    );
    fuselage.position.z = 0;
    group.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(1, 4, 8),
      accentMaterial
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -9.5;
    group.add(nose);

    // Main wings - wide flat box
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.3, 4),
      bodyMaterial
    );
    wings.position.z = 1;
    group.add(wings);

    // Tail fin (vertical stabilizer)
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
   * Create floating name label above aircraft using Canvas texture
   * @param {string} name - Player name to display
   * @returns {THREE.Sprite}
   */
  createLabel(name) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.font = 'bold 32px system-ui, sans-serif';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    // Create sprite from canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(20, 5, 1);
    sprite.position.set(0, 8, 0);  // Float above aircraft

    return sprite;
  }

  /**
   * Update target state from network data
   * @param {Object} data - Network state { position, rotation, velocity }
   */
  setNetworkState(data) {
    this.targetPosition.set(data.position.x, data.position.y, data.position.z);
    this.targetRotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
    if (data.velocity) {
      this.velocity.set(data.velocity.x, data.velocity.y, data.velocity.z);
    }
    this.lastUpdateTime = Date.now();
  }

  /**
   * Update mesh position with smooth interpolation toward target
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Interpolation factor for smooth catch-up
    // Math.pow(0.001, deltaTime) gives exponential decay
    const lerpFactor = 1 - Math.pow(0.001, deltaTime);

    // Lerp position toward target
    this.position.lerp(this.targetPosition, lerpFactor);

    // Lerp rotation (component-wise for Euler angles)
    this.rotation.x += (this.targetRotation.x - this.rotation.x) * lerpFactor;
    this.rotation.y += (this.targetRotation.y - this.rotation.y) * lerpFactor;
    this.rotation.z += (this.targetRotation.z - this.rotation.z) * lerpFactor;

    // Sync mesh with interpolated state
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);

    // Note: Sprite label automatically faces camera
  }

  /**
   * Check if aircraft data is stale (no updates received recently)
   * @param {number} timeout - Staleness threshold in milliseconds
   * @returns {boolean}
   */
  isStale(timeout = 5000) {
    return Date.now() - this.lastUpdateTime > timeout;
  }

  /**
   * Clean up Three.js resources
   */
  dispose() {
    this.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (child.material.map) {
          child.material.map.dispose();
        }
        child.material.dispose();
      }
    });
  }
}
