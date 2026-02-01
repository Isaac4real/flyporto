import * as THREE from 'three';
import { PositionBuffer } from './Interpolation.js';
import { CONFIG } from '../config.js';
import { ModelManager } from '../core/ModelManager.js';

const AIRCRAFT_SCALE = CONFIG.aircraft?.scale || 2.0;

// Plane type color palette (for fallback meshes)
const PLANE_COLORS = {
  red: { body: 0xcccccc, accent: 0xef4444 },
  blue: { body: 0xcccccc, accent: 0x3b82f6 },
  green: { body: 0xcccccc, accent: 0x22c55e },
  yellow: { body: 0xcccccc, accent: 0xeab308 },
  purple: { body: 0xcccccc, accent: 0xa855f7 },
  orange: { body: 0xcccccc, accent: 0xf97316 }
};

/**
 * RemoteAircraft - visual representation of another player's aircraft
 * No physics - just mesh that gets updated from network with buffered interpolation
 */
export class RemoteAircraft {
  /**
   * @param {string} playerId - Unique player identifier
   * @param {string} playerName - Display name for the player
   * @param {string} planeColor - Accent color ('red', 'blue', etc.)
   * @param {string} planeType - Aircraft type ('f16', 'f22', 'f18', 'cessna')
   */
  constructor(playerId, playerName, planeColor = 'blue', planeType = 'f16') {
    this.playerId = playerId;
    this.playerName = playerName;
    this.planeColor = planeColor;
    this.planeType = planeType;

    // Current interpolated state
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    this.velocity = new THREE.Vector3();

    // Buffered interpolation for smooth movement
    this.positionBuffer = new PositionBuffer(4);  // 4 samples
    this.lastUpdateTime = 0;

    // Create visual mesh with model and color
    this.mesh = this.createMesh(planeType, planeColor);

    // Create floating name label (position adjusted for scale)
    this.label = this.createLabel(playerName);
    this.mesh.add(this.label);

    // Create hitbox mesh for raycasting (added to scene by PlayerSync)
    this.hitboxMesh = this.createHitboxMesh();
  }

  /**
   * Create airplane mesh - uses GLTF model if available, falls back to primitives
   * @param {string} planeType - Aircraft type
   * @param {string} planeColor - Accent color
   * @returns {THREE.Group}
   */
  createMesh(planeType = 'f16', planeColor = 'blue') {
    const modelManager = ModelManager.getInstance();

    // Try to get GLTF model
    let group = modelManager.getAircraftMesh(planeType, planeColor);

    if (!group) {
      // Fall back to primitive geometry
      console.log(`[RemoteAircraft] Using fallback mesh for ${planeType}`);
      group = this.createFallbackMesh(planeColor);
    }

    // Scale up the entire aircraft
    group.scale.setScalar(AIRCRAFT_SCALE);

    return group;
  }

  /**
   * Create fallback airplane mesh using primitives
   * @param {string} planeColor - Accent color
   * @returns {THREE.Group}
   */
  createFallbackMesh(planeColor = 'blue') {
    const group = new THREE.Group();

    // Get colors for this plane color
    const colors = PLANE_COLORS[planeColor] || PLANE_COLORS.blue;

    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: colors.body,
      roughness: 0.4
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: colors.accent,
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

    // Wing tips with accent color
    const leftWingTip = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 4),
      accentMaterial
    );
    leftWingTip.position.set(-11, 0, 1);
    group.add(leftWingTip);

    const rightWingTip = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 4),
      accentMaterial
    );
    rightWingTip.position.set(11, 0, 1);
    group.add(rightWingTip);

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
   * Get hitbox radius for collision detection
   * @returns {number} Hitbox radius in meters
   */
  getHitboxRadius() {
    const baseRadius = CONFIG.aircraft?.hitboxRadius || 15;
    return baseRadius;
  }

  /**
   * Get bounding sphere for hit detection
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
      opacity: CONFIG.debug?.showHitboxes ? 0.3 : 0.0,
      wireframe: true,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.playerId = this.playerId;
    mesh.userData.isHitbox = true;

    return mesh;
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
    // Position above aircraft - divide by scale since label is child of scaled group
    sprite.position.set(0, 8 / AIRCRAFT_SCALE, 0);

    return sprite;
  }

  /**
   * Update state from network data - pushes to interpolation buffer
   * @param {Object} data - Network state { position, rotation, velocity, timestamp }
   */
  setNetworkState(data) {
    // Push to buffer for smooth interpolation
    this.positionBuffer.push({
      position: data.position,
      rotation: data.rotation,
      velocity: data.velocity || { x: 0, y: 0, z: 0 },
      timestamp: data.lastUpdate || Date.now()
    });
    this.lastUpdateTime = Date.now();
  }

  /**
   * Update mesh position using buffered interpolation
   * Renders slightly in the past (100ms) for smoothness
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Get interpolated state from buffer (100ms render delay)
    const state = this.positionBuffer.getInterpolatedState(100);

    if (state) {
      this.position.set(state.position.x, state.position.y, state.position.z);
      this.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
      if (state.velocity) {
        this.velocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
      }
    }

    // Sync mesh with interpolated state
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);

    // Sync hitbox mesh position (hitbox doesn't rotate, stays as sphere)
    if (this.hitboxMesh) {
      this.hitboxMesh.position.copy(this.position);
    }

    // Note: Sprite label automatically faces camera
  }

  /**
   * Check if aircraft data is stale (no updates received recently)
   * @param {number} timeout - Staleness threshold in milliseconds
   * @returns {boolean}
   */
  isStale(timeout = 5000) {
    return !this.positionBuffer.hasRecentData(timeout);
  }

  /**
   * Clean up Three.js resources
   */
  dispose() {
    // Dispose aircraft mesh and children
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

    // Dispose hitbox mesh
    if (this.hitboxMesh) {
      this.hitboxMesh.geometry.dispose();
      this.hitboxMesh.material.dispose();
    }
  }
}
