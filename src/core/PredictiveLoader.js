import * as THREE from 'three';

/**
 * PredictiveLoader - Pre-requests tiles in the direction of flight
 *
 * Since 3DTilesRendererJS has no built-in predictive loading, this system
 * creates virtual "look-ahead" cameras positioned ahead of the aircraft.
 * Running tile updates with these cameras triggers tile requests before
 * the main camera reaches those areas.
 *
 * This is critical for a flight simulator where the aircraft moves faster
 * than tiles can stream in reactively.
 */
export class PredictiveLoader {
  /**
   * @param {TilesRenderer} tilesRenderer - The 3D tiles renderer instance
   * @param {THREE.Camera} mainCamera - The main rendering camera
   * @param {Object} config - Configuration options
   */
  constructor(tilesRenderer, mainCamera, config = {}) {
    this.tilesRenderer = tilesRenderer;
    this.mainCamera = mainCamera;

    // Configuration
    this.enabled = config.enabled ?? true;
    this.updateInterval = config.updateInterval ?? 300;  // ms between predictive updates
    this.minSpeedThreshold = config.minSpeedThreshold ?? 30;  // Don't predict below this speed

    // Base look-ahead distances (will be scaled by speed)
    this.baseLookAheadDistances = config.lookAheadDistances ?? [400, 800, 1500];

    // Create look-ahead cameras
    this.lookAheadCameras = this.baseLookAheadDistances.map(distance =>
      this.createLookAheadCamera(distance)
    );

    // Timing
    this.lastUpdateTime = 0;

    // Reusable vectors (avoid allocations in update loop)
    this._forward = new THREE.Vector3();
    this._position = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();

    // Track original camera for restoration
    this._originalCamera = mainCamera;
  }

  /**
   * Create a look-ahead camera for predictive loading
   * @param {number} distance - Look-ahead distance in meters
   * @returns {THREE.PerspectiveCamera}
   */
  createLookAheadCamera(distance) {
    const camera = new THREE.PerspectiveCamera(
      100,  // Wider FOV to catch more tiles in peripheral areas
      this.mainCamera.aspect,
      this.mainCamera.near,
      this.mainCamera.far
    );

    // Store the look-ahead distance on the camera
    camera.userData.lookAheadDistance = distance;
    camera.userData.baseDistance = distance;

    return camera;
  }

  /**
   * Update predictive loading based on aircraft state
   * Should be called each frame, but internally throttles updates
   *
   * @param {Aircraft} aircraft - The player aircraft
   * @param {number} timestamp - Current timestamp (performance.now())
   */
  update(aircraft, timestamp) {
    if (!this.enabled) return;

    // Throttle updates to avoid excessive tile requests
    if (timestamp - this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = timestamp;

    // Get flight direction from velocity
    const speed = aircraft.velocity.length();

    // Don't predict when nearly stationary
    if (speed < this.minSpeedThreshold) return;

    // Calculate normalized flight direction
    this._forward.copy(aircraft.velocity).normalize();

    // Adjust look-ahead distances based on current speed
    // At higher speeds, look further ahead
    this.adjustDistancesForSpeed(speed);

    // Update each look-ahead camera and trigger tile requests
    for (const camera of this.lookAheadCameras) {
      this.updateLookAheadCamera(camera, aircraft.position, this._forward);
    }

    // Restore main camera after all look-ahead updates
    this.tilesRenderer.setCamera(this.mainCamera);
  }

  /**
   * Update a single look-ahead camera and trigger tile loading
   * @param {THREE.PerspectiveCamera} camera - The look-ahead camera
   * @param {THREE.Vector3} aircraftPosition - Current aircraft position
   * @param {THREE.Vector3} forward - Normalized flight direction
   */
  updateLookAheadCamera(camera, aircraftPosition, forward) {
    const distance = camera.userData.lookAheadDistance;

    // Position camera ahead of aircraft in flight direction
    this._position.copy(aircraftPosition);
    this._position.addScaledVector(forward, distance);

    // Maintain minimum altitude (don't look underground)
    this._position.y = Math.max(this._position.y, 50);

    // Point camera in flight direction
    this._lookAt.copy(this._position);
    this._lookAt.addScaledVector(forward, 100);

    camera.position.copy(this._position);
    camera.lookAt(this._lookAt);
    camera.updateMatrixWorld();

    // Temporarily set this camera for tile updates
    // This queues tile requests without affecting rendering
    this.tilesRenderer.setCamera(camera);
    this.tilesRenderer.update();
  }

  /**
   * Adjust look-ahead distances based on current speed
   * At higher speeds, we need to look further ahead
   * @param {number} speed - Current speed in m/s
   */
  adjustDistancesForSpeed(speed) {
    // Scale factor: at 60 m/s use base distance, at 120 m/s use 2x
    const speedFactor = Math.max(1, speed / 60);

    for (const camera of this.lookAheadCameras) {
      camera.userData.lookAheadDistance = camera.userData.baseDistance * speedFactor;
    }
  }

  /**
   * Update camera aspect ratio (call when window resizes)
   * @param {number} aspect - New aspect ratio
   */
  updateAspect(aspect) {
    for (const camera of this.lookAheadCameras) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Enable or disable predictive loading
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      // Restore main camera when disabled
      this.tilesRenderer.setCamera(this.mainCamera);
    }
  }

  /**
   * Check if predictive loading is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get look-ahead distances for debugging
   * @returns {number[]}
   */
  getLookAheadDistances() {
    return this.lookAheadCameras.map(c => Math.round(c.userData.lookAheadDistance));
  }
}
