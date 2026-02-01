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

    this.mode = 'follow';
    this.followFov = CONFIG.camera?.fov ?? 60;
    this.cockpitFov = CONFIG.camera?.cockpit?.fov ?? 72;
    this.fovDamping = CONFIG.camera?.fovDamping ?? 10;

    // Reusable vectors for calculations
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);

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
    this.camera.fov = this.followFov;
    this.camera.updateProjectionMatrix();

    // Look at aircraft
    this.camera.lookAt(this.aircraft.position);
  }

  toggleMode() {
    this.mode = this.mode === 'follow' ? 'cockpit' : 'follow';
  }

  getMode() {
    return this.mode;
  }

  /**
   * Update camera position and orientation
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (this.mode === 'cockpit') {
      this.updateCockpit(deltaTime);
      return;
    }

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
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.targetLookAt);

    this.updateFov(deltaTime, this.followFov);
  }

  updateCockpit(deltaTime) {
    const radius = this.aircraft.getHitboxRadius?.() ?? 2;
    const cockpitOffset = CONFIG.camera?.cockpit?.offsetScale ?? { x: 0, y: 0.2, z: -0.6 };
    const seatOffset = CONFIG.camera?.cockpit?.seatOffset ?? null;
    const lookAhead = CONFIG.camera?.cockpit?.lookAhead ?? 200;

    if (seatOffset) {
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.aircraft.rotation).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyEuler(this.aircraft.rotation).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyEuler(this.aircraft.rotation).normalize();
      const seatDistance = radius;

      this.targetPosition.copy(this.aircraft.position)
        .add(forward.multiplyScalar(seatOffset.forward * seatDistance))
        .add(right.multiplyScalar(seatOffset.right * seatDistance))
        .add(up.multiplyScalar(seatOffset.up * seatDistance));
    } else {
      this.offset.set(
        cockpitOffset.x * radius,
        cockpitOffset.y * radius,
        cockpitOffset.z * radius
      );
      this.offset.applyEuler(this.aircraft.rotation);
      this.targetPosition.copy(this.aircraft.position).add(this.offset);
    }

    this.offset.set(0, 0, -lookAhead);
    this.offset.applyEuler(this.aircraft.rotation);
    this.targetLookAt.copy(this.aircraft.position).add(this.offset);

    const t = 1 - Math.exp(-FOLLOW.damping * deltaTime);
    this.camera.position.lerp(this.targetPosition, t);

    this.up.set(0, 1, 0).applyEuler(this.aircraft.rotation);
    this.camera.up.copy(this.up);
    this.camera.lookAt(this.targetLookAt);

    this.updateFov(deltaTime, this.cockpitFov);
  }

  updateFov(deltaTime, targetFov) {
    const t = 1 - Math.exp(-this.fovDamping * deltaTime);
    this.camera.fov += (targetFov - this.camera.fov) * t;
    this.camera.updateProjectionMatrix();
  }
}
