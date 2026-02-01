import * as THREE from 'three';

/**
 * TriggerVolume - Invisible collision zone for checkpoint detection
 *
 * Supports both sphere and box triggers.
 * Uses swept-sphere detection for fast-moving aircraft to prevent tunneling.
 */
export class TriggerVolume {
  /**
   * @param {Object} config - Trigger configuration
   * @param {string} config.id - Unique identifier
   * @param {THREE.Vector3} config.position - World position
   * @param {string} config.type - 'sphere' or 'box'
   * @param {number} [config.radius] - Radius for sphere triggers
   * @param {Object} [config.size] - {x, y, z} for box triggers
   * @param {boolean} [config.debug] - Show debug visualization
   * @param {Function} [config.onTrigger] - Callback when triggered
   */
  constructor(config) {
    this.id = config.id;
    this.position = config.position.clone();
    this.type = config.type || 'sphere';
    this.radius = config.radius || 100;
    this.size = config.size || { x: 100, y: 100, z: 100 };
    this.triggered = false;
    this.enabled = true;
    this.onTriggerCallback = config.onTrigger || null;

    // Create collision primitive
    if (this.type === 'sphere') {
      this.bounds = new THREE.Sphere(this.position, this.radius);
    } else {
      const halfSize = new THREE.Vector3(
        this.size.x / 2,
        this.size.y / 2,
        this.size.z / 2
      );
      this.bounds = new THREE.Box3(
        this.position.clone().sub(halfSize),
        this.position.clone().add(halfSize)
      );
    }

    // Debug visualization (optional)
    this.debugMesh = null;
    if (config.debug) {
      this.createDebugMesh();
    }

    // Reusable vectors for calculations (avoid allocations in hot path)
    this._prevPosition = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._testPoint = new THREE.Vector3();
  }

  /**
   * Create debug visualization mesh
   * @returns {THREE.Mesh} Debug mesh
   */
  createDebugMesh() {
    let geometry;
    if (this.type === 'sphere') {
      geometry = new THREE.SphereGeometry(this.radius, 16, 12);
    } else {
      geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
      depthWrite: false
    });

    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.position.copy(this.position);
    this.debugMesh.renderOrder = 999;

    return this.debugMesh;
  }

  /**
   * Check if an aircraft has entered this trigger volume
   * Uses swept-sphere detection for fast-moving objects
   *
   * @param {THREE.Vector3} currentPos - Current aircraft position
   * @param {THREE.Vector3} prevPos - Previous frame position
   * @param {number} aircraftRadius - Aircraft bounding radius
   * @returns {boolean} True if triggered this frame
   */
  check(currentPos, prevPos, aircraftRadius = 20) {
    if (!this.enabled || this.triggered) {
      return false;
    }

    // Quick containment check first (handles slow movement)
    if (this.containsPoint(currentPos)) {
      this.triggered = true;
      this._notifyTrigger();
      return true;
    }

    // Swept-sphere check for fast movement (anti-tunneling)
    const distance = currentPos.distanceTo(prevPos);
    if (distance > aircraftRadius) {
      // Aircraft moved more than its radius - check intermediate points
      const steps = Math.ceil(distance / aircraftRadius);
      this._direction.subVectors(currentPos, prevPos).normalize();

      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        this._testPoint.lerpVectors(prevPos, currentPos, t);

        if (this.containsPoint(this._testPoint)) {
          this.triggered = true;
          this._notifyTrigger();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a point is inside the trigger volume
   * @param {THREE.Vector3} point
   * @returns {boolean}
   */
  containsPoint(point) {
    if (this.type === 'sphere') {
      return this.bounds.containsPoint(point);
    } else {
      return this.bounds.containsPoint(point);
    }
  }

  /**
   * Notify trigger callback
   * @private
   */
  _notifyTrigger() {
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0xffff00);
      this.debugMesh.material.opacity = 0.4;
    }

    if (this.onTriggerCallback) {
      this.onTriggerCallback(this);
    }

    // Also call instance method if overridden
    this.onTrigger();
  }

  /**
   * Called when trigger is activated
   * Override in subclass or set via onTriggerCallback
   */
  onTrigger() {
    // Override or set via callback
  }

  /**
   * Reset trigger state (for replay/restart)
   */
  reset() {
    this.triggered = false;
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0x00ff00);
      this.debugMesh.material.opacity = 0.2;
    }
  }

  /**
   * Mark as already triggered (for checkpoints behind current)
   */
  markTriggered() {
    this.triggered = true;
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0x888888);
      this.debugMesh.material.opacity = 0.1;
    }
  }

  /**
   * Set as active/next checkpoint (visual highlight)
   */
  markActive() {
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0x00ffff);
      this.debugMesh.material.opacity = 0.3;
    }
  }

  /**
   * Enable/disable the trigger
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.debugMesh) {
      this.debugMesh.visible = enabled;
    }
  }

  /**
   * Get distance from a point to this trigger's center
   * @param {THREE.Vector3} point
   * @returns {number} Distance in meters
   */
  distanceTo(point) {
    return point.distanceTo(this.position);
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.debugMesh) {
      this.debugMesh.geometry.dispose();
      this.debugMesh.material.dispose();
      this.debugMesh = null;
    }
  }
}

/**
 * Create a checkpoint ring mesh for visual representation
 * This is a torus (ring) that players fly through
 *
 * @param {THREE.Vector3} position - Center position
 * @param {number} radius - Ring radius
 * @param {number} [rotation=0] - Y-axis rotation in radians
 * @returns {THREE.Mesh} Ring mesh
 */
export function createCheckpointRing(position, radius, rotation = 0) {
  const geometry = new THREE.TorusGeometry(radius, radius * 0.05, 8, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;  // Lay flat initially
  ring.rotation.y = rotation;

  return ring;
}
