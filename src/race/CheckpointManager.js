import * as THREE from 'three';
import { TriggerVolume } from './TriggerVolume.js';
import { CheckpointMarker } from './CheckpointMarker.js';
import { LANDMARKS, getLandmark } from '../data/landmarks.js';
import { CONFIG } from '../config.js';

/**
 * Coordinate conversion helper
 * Converts lat/lon to local XZ coordinates relative to Golden Gate Bridge center
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @returns {THREE.Vector3} Local position (x, 0, z)
 */
function latLonToLocal(lat, lon) {
  const REF_LAT = CONFIG.startPosition.lat;
  const REF_LON = CONFIG.startPosition.lon;
  const EARTH_RADIUS = 6371000;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const refLatRad = REF_LAT * Math.PI / 180;
  const refLonRad = REF_LON * Math.PI / 180;

  const x = EARTH_RADIUS * (lonRad - refLonRad) * Math.cos(refLatRad);
  const z = -EARTH_RADIUS * (latRad - refLatRad);  // Negative because +Z is south

  return new THREE.Vector3(x, 0, z);
}

/**
 * CheckpointManager - Manages a sequence of checkpoints for a race
 *
 * Handles:
 * - Loading race routes and creating trigger volumes
 * - Tracking race progress and timing
 * - Calculating split times and medals
 * - Providing callbacks for UI updates
 */
export class CheckpointManager {
  /**
   * @param {THREE.Scene} scene - Scene to add debug meshes to
   * @param {Object} options
   * @param {boolean} options.debug - Show debug visualization
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.debug = options.debug || false;

    // Race state
    this.checkpoints = [];
    this.currentCheckpointIndex = 0;
    this.raceActive = false;
    this.raceStarted = false;  // True once player crosses first checkpoint
    this.raceStartTime = 0;
    this.raceEndTime = 0;
    this.checkpointTimes = [];

    // Route info
    this.routeId = null;
    this.routeName = null;
    this.routeDescription = null;
    this.medalTimes = null;

    // Callbacks
    this.onCheckpointReached = null;  // (checkpoint, index, splitTime) => void
    this.onRaceComplete = null;       // (result) => void
    this.onRaceStart = null;          // () => void

    // Previous position tracking for swept detection
    this._prevAircraftPos = new THREE.Vector3();
    this._initialized = false;
  }

  /**
   * Load a race route
   * @param {Object} route - Route definition from ROUTES
   */
  loadRoute(route) {
    this.clearCheckpoints();

    this.routeId = route.id;
    this.routeName = route.name;
    this.routeDescription = route.description;
    this.medalTimes = route.medalTimes;

    console.log(`[CheckpointManager] Loading route: ${route.name}`);

    // Create checkpoints from route
    route.checkpoints.forEach((landmarkKey, index) => {
      const landmark = getLandmark(landmarkKey);
      if (!landmark) {
        console.warn(`[CheckpointManager] Unknown landmark: ${landmarkKey}`);
        return;
      }

      // Convert lat/lon to local coordinates
      const localPos = latLonToLocal(landmark.lat, landmark.lon);
      localPos.y = landmark.altitude;

      // Create trigger volume
      const trigger = new TriggerVolume({
        id: landmark.id,
        position: localPos,
        type: landmark.triggerType,
        radius: landmark.triggerRadius,
        size: landmark.triggerSize,
        debug: this.debug,
        onTrigger: () => {
          this._handleCheckpointReached(index);
        }
      });

      // Initially disable all except first
      trigger.setEnabled(index === 0);
      if (index === 0) {
        trigger.markActive();
      }

      // Create visible marker
      const marker = new CheckpointMarker({
        position: localPos,
        radius: landmark.triggerRadius,
        type: landmark.triggerType,
        size: landmark.triggerSize
      });

      // Set initial state
      if (index === 0) {
        marker.setState('active');
      } else {
        marker.setState('upcoming');
      }
      marker.show();

      // Add marker to scene
      this.scene.add(marker.getObject());

      this.checkpoints.push({
        trigger,
        marker,
        landmark,
        index,
        reached: false,
        splitTime: 0
      });

      // Add debug mesh to scene (optional)
      if (trigger.debugMesh) {
        this.scene.add(trigger.debugMesh);
      }
    });

    console.log(`[CheckpointManager] Loaded ${this.checkpoints.length} checkpoints`);
  }

  /**
   * Start the race
   */
  startRace() {
    if (this.checkpoints.length === 0) {
      console.warn('[CheckpointManager] No route loaded');
      return;
    }

    this.raceActive = true;
    this.raceStarted = false;  // Timer starts when first checkpoint is crossed
    this.raceStartTime = 0;
    this.currentCheckpointIndex = 0;
    this.checkpointTimes = [];
    this._initialized = false;

    // Reset all checkpoints
    this.checkpoints.forEach((cp, index) => {
      cp.trigger.reset();
      cp.reached = false;
      cp.splitTime = 0;
      cp.trigger.setEnabled(index === 0);
      if (index === 0) {
        cp.trigger.markActive();
        if (cp.marker) {
          cp.marker.setState('active');
          cp.marker.show();
        }
      } else {
        if (cp.marker) {
          cp.marker.setState('upcoming');
          cp.marker.show();
        }
      }
    });

    console.log(`[CheckpointManager] Race started: ${this.routeName}`);

    if (this.onRaceStart) {
      this.onRaceStart();
    }
  }

  /**
   * Handle checkpoint reached
   * @private
   */
  _handleCheckpointReached(index) {
    if (!this.raceActive) return;
    if (index !== this.currentCheckpointIndex) return;

    const checkpoint = this.checkpoints[index];
    const currentTime = performance.now();

    // First checkpoint = start gate, begins the timer
    if (index === 0) {
      this.raceStarted = true;
      this.raceStartTime = currentTime;
      checkpoint.reached = true;
      checkpoint.splitTime = 0;

      console.log(`[CheckpointManager] Race timer started at ${checkpoint.landmark.shortName}`);

      // Update marker state
      if (checkpoint.marker) {
        checkpoint.marker.setState('completed');
      }

      // Notify callback with 0 split time for start gate
      if (this.onCheckpointReached) {
        this.onCheckpointReached(checkpoint, index, 0);
      }

      // Enable next checkpoint
      this.currentCheckpointIndex++;
      const nextCheckpoint = this.checkpoints[this.currentCheckpointIndex];
      if (nextCheckpoint) {
        nextCheckpoint.trigger.setEnabled(true);
        nextCheckpoint.trigger.markActive();
        if (nextCheckpoint.marker) {
          nextCheckpoint.marker.setState('active');
        }
      }
      return;
    }

    // Subsequent checkpoints - calculate split time from race start
    const splitTime = (currentTime - this.raceStartTime) / 1000;  // seconds

    checkpoint.reached = true;
    checkpoint.splitTime = splitTime;
    this.checkpointTimes.push(splitTime);

    console.log(
      `[CheckpointManager] Checkpoint ${index + 1}/${this.checkpoints.length}: ` +
      `${checkpoint.landmark.shortName} at ${splitTime.toFixed(2)}s`
    );

    // Update marker state
    if (checkpoint.marker) {
      checkpoint.marker.setState('completed');
    }

    // Notify callback
    if (this.onCheckpointReached) {
      this.onCheckpointReached(checkpoint, index, splitTime);
    }

    // Check if race complete
    if (index === this.checkpoints.length - 1) {
      this._completeRace(splitTime);
    } else {
      // Enable and highlight next checkpoint
      this.currentCheckpointIndex++;
      const nextCheckpoint = this.checkpoints[this.currentCheckpointIndex];
      nextCheckpoint.trigger.setEnabled(true);
      nextCheckpoint.trigger.markActive();

      // Update next marker to active
      if (nextCheckpoint.marker) {
        nextCheckpoint.marker.setState('active');
      }
    }
  }

  /**
   * Complete the race
   * @private
   */
  _completeRace(totalTime) {
    this.raceActive = false;
    this.raceEndTime = performance.now();

    // Determine medal
    let medal = null;
    if (this.medalTimes) {
      if (totalTime <= this.medalTimes.gold) medal = 'gold';
      else if (totalTime <= this.medalTimes.silver) medal = 'silver';
      else if (totalTime <= this.medalTimes.bronze) medal = 'bronze';
    }

    console.log(
      `[CheckpointManager] Race complete! Time: ${totalTime.toFixed(2)}s, ` +
      `Medal: ${medal || 'none'}`
    );

    const result = {
      routeId: this.routeId,
      routeName: this.routeName,
      totalTime,
      totalTimeMs: totalTime * 1000,
      checkpointTimes: [...this.checkpointTimes],
      checkpointCount: this.checkpoints.length,
      medal,
      medalTimes: this.medalTimes
    };

    if (this.onRaceComplete) {
      this.onRaceComplete(result);
    }

    return result;
  }

  /**
   * Update - check all active triggers
   * Call this every frame with current aircraft position
   *
   * @param {THREE.Vector3} aircraftPos - Current aircraft position
   * @param {number} [deltaTime=0.016] - Time since last frame
   */
  update(aircraftPos, deltaTime = 0.016) {
    if (!this.raceActive) return;

    // Initialize previous position on first frame
    if (!this._initialized) {
      this._prevAircraftPos.copy(aircraftPos);
      this._initialized = true;
      return;
    }

    // Check current checkpoint
    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];
    if (currentCheckpoint && !currentCheckpoint.reached) {
      currentCheckpoint.trigger.check(
        aircraftPos,
        this._prevAircraftPos,
        20  // Aircraft bounding radius
      );
    }

    // Update marker animations
    this.checkpoints.forEach(cp => {
      if (cp.marker) {
        cp.marker.update(deltaTime);
      }
    });

    // Update previous position
    this._prevAircraftPos.copy(aircraftPos);
  }

  /**
   * Get the current checkpoint's position for direction indicator
   * @returns {THREE.Vector3|null}
   */
  getCurrentCheckpointPosition() {
    if (!this.raceActive) return null;
    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];
    if (!currentCheckpoint) return null;
    return currentCheckpoint.trigger.position;
  }

  /**
   * Get current race state for UI
   * @returns {Object} Race state object
   */
  getRaceState() {
    if (!this.raceActive) {
      return {
        active: false,
        started: false,
        routeId: this.routeId,
        routeName: this.routeName,
        totalCheckpoints: this.checkpoints.length
      };
    }

    // Timer only runs after crossing first checkpoint
    const currentTime = this.raceStarted
      ? (performance.now() - this.raceStartTime) / 1000
      : 0;

    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];
    const nextCheckpoint = this.checkpoints[this.currentCheckpointIndex + 1];

    return {
      active: true,
      started: this.raceStarted,
      routeId: this.routeId,
      routeName: this.routeName,
      currentCheckpoint: this.currentCheckpointIndex + 1,
      totalCheckpoints: this.checkpoints.length,
      currentTime,
      nextCheckpointName: currentCheckpoint?.landmark.shortName || null,
      upcomingCheckpointName: nextCheckpoint?.landmark.shortName || null,
      checkpointTimes: [...this.checkpointTimes],
      distanceToNext: currentCheckpoint
        ? currentCheckpoint.trigger.distanceTo(this._prevAircraftPos)
        : null
    };
  }

  /**
   * Get distance to current checkpoint
   * @param {THREE.Vector3} position - Position to measure from
   * @returns {number|null} Distance in meters or null if no active checkpoint
   */
  getDistanceToCheckpoint(position) {
    if (!this.raceActive) return null;
    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];
    if (!currentCheckpoint) return null;
    return currentCheckpoint.trigger.distanceTo(position);
  }

  /**
   * Get direction to current checkpoint
   * @param {THREE.Vector3} position - Position to measure from
   * @returns {THREE.Vector3|null} Normalized direction or null
   */
  getDirectionToCheckpoint(position) {
    if (!this.raceActive) return null;
    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];
    if (!currentCheckpoint) return null;

    const direction = new THREE.Vector3();
    direction.subVectors(currentCheckpoint.trigger.position, position);
    direction.normalize();
    return direction;
  }

  /**
   * Cancel the current race
   */
  cancelRace() {
    if (!this.raceActive) return;

    this.raceActive = false;
    console.log('[CheckpointManager] Race cancelled');

    // Reset visual state
    this.checkpoints.forEach(cp => {
      cp.trigger.reset();
      cp.trigger.setEnabled(false);
      // Hide markers when race is cancelled
      if (cp.marker) {
        cp.marker.hide();
      }
    });
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints() {
    this.checkpoints.forEach(cp => {
      if (cp.trigger.debugMesh) {
        this.scene.remove(cp.trigger.debugMesh);
      }
      cp.trigger.dispose();

      // Remove and dispose markers
      if (cp.marker) {
        this.scene.remove(cp.marker.getObject());
        cp.marker.dispose();
      }
    });

    this.checkpoints = [];
    this.currentCheckpointIndex = 0;
    this.raceActive = false;
    this.routeId = null;
    this.routeName = null;
    this._initialized = false;
  }

  /**
   * Reset race (for retry) - keeps the same route loaded
   */
  reset() {
    if (this.checkpoints.length === 0) return;

    this.raceActive = false;
    this.currentCheckpointIndex = 0;
    this.checkpointTimes = [];
    this._initialized = false;

    this.checkpoints.forEach((cp, index) => {
      cp.trigger.reset();
      cp.reached = false;
      cp.splitTime = 0;
      cp.trigger.setEnabled(false);
      // Reset marker states
      if (cp.marker) {
        cp.marker.setState('upcoming');
        cp.marker.hide();
      }
    });
  }

  /**
   * Check if a route is currently loaded
   * @returns {boolean}
   */
  hasRoute() {
    return this.checkpoints.length > 0;
  }

  /**
   * Check if a race is currently active
   * @returns {boolean}
   */
  isRaceActive() {
    return this.raceActive;
  }

  /**
   * Clean up
   */
  dispose() {
    this.clearCheckpoints();
  }
}
