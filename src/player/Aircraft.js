import * as THREE from 'three';
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
 * Aircraft - manages aircraft state and mesh
 */
export class Aircraft {
  /**
   * Create an aircraft at the specified position
   * @param {THREE.Vector3} initialPosition - Starting position in world coordinates
   * @param {string} planeColor - Color of plane ('red', 'blue', 'green', etc.)
   * @param {string} planeType - Type of plane ('f16', 'f22', 'f18', 'cessna')
   */
  constructor(initialPosition, planeColor = 'red', planeType = 'f16') {
    // Store plane type and color
    this.planeType = planeType;
    this.planeColor = planeColor;

    // State
    this.position = initialPosition.clone();
    this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    // Start with forward velocity - plane should already be flying!
    this.velocity = new THREE.Vector3(0, 0, -60);  // 60 m/s forward (-Z is forward)

    // Throttle with smoothing (target = input, actual = smoothed)
    this.targetThrottle = 0.7;
    this.actualThrottle = 0.7;
    this.throttle = 0.7;  // Legacy - kept for compatibility

    // Smoothed input state for responsive but not twitchy controls
    // Target values come from raw input, actual values are smoothed
    this.targetPitch = 0;
    this.targetRoll = 0;
    this.actualPitch = 0;
    this.actualRoll = 0;

    // Computed forward vector (updated by updateMatrices)
    this.forward = new THREE.Vector3(0, 0, -1);

    // Create visual mesh with selected plane type and color
    this.mesh = this.createMesh(planeType, planeColor);

    // Set initial position
    this.mesh.position.copy(this.position);
  }

  /**
   * Create an airplane mesh - uses GLTF model if available, falls back to primitives
   * @param {string} planeType - The aircraft type (f16, f22, etc.)
   * @param {string} planeColor - The accent color
   * @returns {THREE.Group}
   */
  createMesh(planeType = 'f16', planeColor = 'red') {
    const modelManager = ModelManager.getInstance();

    // Try to get GLTF model
    let innerMesh = modelManager.getAircraftMesh(planeType, planeColor);

    if (!innerMesh) {
      // Fall back to primitive geometry
      console.log(`[Aircraft] Using fallback mesh for ${planeType}`);
      innerMesh = this.createFallbackMesh(planeColor);
    }

    // Scale and rotate the inner mesh
    innerMesh.scale.setScalar(AIRCRAFT_SCALE);
    innerMesh.rotation.y = Math.PI;  // Rotate 180° so nose points forward

    // Wrap in outer group - this group's rotation is controlled by physics
    // The inner mesh rotation is purely visual orientation
    const wrapper = new THREE.Group();
    wrapper.add(innerMesh);

    return wrapper;
  }

  /**
   * Create fallback airplane mesh using Three.js primitives
   * @param {string} planeColor - The plane color for styling
   * @returns {THREE.Group}
   */
  createFallbackMesh(planeColor = 'red') {
    const group = new THREE.Group();

    // Get colors for this plane type (fallback to red)
    const colors = PLANE_COLORS[planeColor] || PLANE_COLORS.red;

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
   * Based on scaled aircraft size (wingspan is largest dimension)
   * @returns {number} Hitbox radius in meters
   */
  getHitboxRadius() {
    const baseRadius = CONFIG.aircraft?.hitboxRadius || 15;
    return baseRadius * AIRCRAFT_SCALE;
  }

  /**
   * Get the forward direction vector (normalized)
   * @returns {THREE.Vector3}
   */
  getForwardVector() {
    return this.forward.clone();
  }

  /**
   * Get current speed in m/s
   * @returns {number}
   */
  getSpeed() {
    return this.velocity.length();
  }

  /**
   * Get altitude above ground
   * With ReorientationPlugin, altitude is simply the Y coordinate
   * @returns {number} Altitude in meters
   */
  getAltitude() {
    return this.position.y;
  }

  /**
   * Update the forward vector based on current rotation
   * Also syncs mesh transform with state
   */
  updateMatrices() {
    // Calculate forward vector from rotation
    // Default forward is -Z in Three.js
    this.forward.set(0, 0, -1);
    this.forward.applyEuler(this.rotation);
    this.forward.normalize();

    // Sync mesh with state
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
  }

  /**
   * Teleport aircraft to a new position, facing a target
   * @param {THREE.Vector3} newPosition - Position to teleport to
   * @param {THREE.Vector3} lookAtTarget - Point to face toward
   * @param {number} [speed=80] - Initial forward speed in m/s
   */
  teleportTo(newPosition, lookAtTarget, speed = 80) {
    // Set position
    this.position.copy(newPosition);

    // Calculate direction to target
    const direction = new THREE.Vector3()
      .subVectors(lookAtTarget, newPosition)
      .normalize();

    // Calculate yaw (Y rotation) to face target
    const yaw = Math.atan2(-direction.x, -direction.z);

    // Calculate pitch based on vertical component
    const horizontalDist = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    const pitch = Math.atan2(direction.y, horizontalDist);

    // Set rotation (no roll)
    this.rotation.set(pitch, yaw, 0, 'XYZ');

    // Set velocity in forward direction
    this.velocity.copy(direction).multiplyScalar(speed);

    // Reset control inputs
    this.targetPitch = 0;
    this.targetRoll = 0;
    this.actualPitch = 0;
    this.actualRoll = 0;

    // Update forward vector and mesh
    this.updateMatrices();
  }
}

// Export PLANE_COLORS for use by RemoteAircraft
export { PLANE_COLORS };
