import * as THREE from 'three';

/**
 * Aircraft - manages aircraft state and mesh
 */
export class Aircraft {
  /**
   * Create an aircraft at the specified position
   * @param {THREE.Vector3} initialPosition - Starting position in world coordinates
   */
  constructor(initialPosition) {
    // State
    this.position = initialPosition.clone();
    this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    // Start with forward velocity - plane should already be flying!
    this.velocity = new THREE.Vector3(0, 0, -60);  // 60 m/s forward (-Z is forward)
    this.throttle = 0.7;  // Start at 70% throttle

    // Computed forward vector (updated by updateMatrices)
    this.forward = new THREE.Vector3(0, 0, -1);

    // Create visual mesh
    this.mesh = this.createMesh();

    // Set initial position
    this.mesh.position.copy(this.position);
  }

  /**
   * Create an airplane-shaped mesh using Three.js primitives
   * @returns {THREE.Group}
   */
  createMesh() {
    const group = new THREE.Group();

    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,  // Light gray fuselage
      roughness: 0.4
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,  // Red accents
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
}
