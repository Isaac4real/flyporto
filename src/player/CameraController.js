import * as THREE from 'three';
import { CONFIG } from '../config.js';

const FOLLOW = CONFIG.camera.follow;

/**
 * CameraController - Smooth follow camera with damping
 * Follows behind and above the aircraft, looking ahead
 */
export class CameraController {
  constructor(camera, aircraft) {
    this.camera = camera;
    this.aircraft = aircraft;

    // Reusable vectors for calculations
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.offset = new THREE.Vector3();

    // Initialize camera position behind aircraft
    this.initializePosition();
  }

  /**
   * Set initial camera position behind aircraft
   */
  initializePosition() {
    const yawOnly = new THREE.Euler(0, this.aircraft.rotation.y, 0, 'XYZ');
    this.offset.set(0, FOLLOW.height, FOLLOW.distance);
    this.offset.applyEuler(yawOnly);
    this.camera.position.copy(this.aircraft.position).add(this.offset);

    // Look at aircraft
    this.camera.lookAt(this.aircraft.position);
  }

  /**
   * Update camera position and orientation
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Create yaw-only rotation for camera positioning
    // This prevents camera from banking/pitching with the aircraft
    const yawOnly = new THREE.Euler(0, this.aircraft.rotation.y, 0, 'XYZ');

    // Calculate ideal camera position (behind and above aircraft)
    this.offset.set(0, FOLLOW.height, FOLLOW.distance);
    this.offset.applyEuler(yawOnly);  // Only rotate by yaw
    this.targetPosition.copy(this.aircraft.position).add(this.offset);

    // Calculate look-at point (ahead of aircraft)
    this.offset.set(0, 0, -FOLLOW.lookAhead);
    this.offset.applyEuler(yawOnly);
    this.targetLookAt.copy(this.aircraft.position).add(this.offset);

    // Smooth interpolation using exponential decay
    // t = 1 - e^(-damping * dt) gives frame-rate independent smoothing
    const t = 1 - Math.exp(-FOLLOW.damping * deltaTime);
    this.camera.position.lerp(this.targetPosition, t);

    // Look at target ahead of aircraft
    this.camera.lookAt(this.targetLookAt);
  }
}
