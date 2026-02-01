# Stage 19: Landmark Checkpoint Racing System

## Overview

Create a checkpoint racing system around San Francisco landmarks that generates shareable completion times. This is a **high-priority viral feature** that creates screenshot-ready competitive moments.

**Why This Matters:**
- Creates competitive, shareable content ("I flew from Alcatraz to Golden Gate in 47s!")
- Leverages the photorealistic landmarks as a unique selling point
- Drives replay value and social sharing
- Generates leaderboard competition

**Estimated Time:** 6-8 hours

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  CHECKPOINT RACING SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  LANDMARKS  │───▶│   ROUTES    │───▶│   TIMER     │         │
│  │  DATABASE   │    │   SYSTEM    │    │   SYSTEM    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  TRIGGER    │    │ CHECKPOINT  │    │ COMPLETION  │         │
│  │  VOLUMES    │    │  PROGRESS   │    │   SCREEN    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                  │                 │
│                            ▼                  ▼                 │
│                     ┌─────────────┐    ┌─────────────┐         │
│                     │ LEADERBOARD │    │   SHARE     │         │
│                     │   SYSTEM    │    │   BUTTON    │         │
│                     └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Landmark Data Reference

### San Francisco Landmarks with Coordinates

Use these precise coordinates. Note: The game uses ReorientationPlugin which places the Golden Gate Bridge at origin (0,0,0) with Y-up. All positions need to be converted from lat/lon to local coordinates.

| Landmark | Latitude | Longitude | Height (m) | Checkpoint Type |
|----------|----------|-----------|------------|-----------------|
| **Golden Gate Bridge (South Tower)** | 37.8107 | -122.4738 | 227 | Fly-through |
| **Golden Gate Bridge (Center)** | 37.8199 | -122.4783 | 67 (clearance) | Fly-under |
| **Golden Gate Bridge (North Tower)** | 37.8291 | -122.4824 | 227 | Fly-through |
| **Alcatraz Island** | 37.8267 | -122.4233 | 12 | Fly-over |
| **Coit Tower** | 37.8024 | -122.4059 | 64 | Fly-around |
| **Transamerica Pyramid** | 37.7952 | -122.4029 | 260 | Fly-past |
| **Salesforce Tower** | 37.7899 | -122.3969 | 326 | Fly-past |
| **Ferry Building** | 37.7955 | -122.3937 | 75 | Fly-over |
| **Oracle Park** | 37.7786 | -122.3897 | 0 | Fly-over |
| **Treasure Island** | 37.8236 | -122.3706 | 11 | Fly-over |
| **Bay Bridge (SF Side)** | 37.7983 | -122.3778 | 55 (clearance) | Fly-under |
| **Palace of Fine Arts** | 37.8029 | -122.4486 | 49 | Fly-around |

### Coordinate Conversion Formula

The ReorientationPlugin places Golden Gate Bridge center at origin. To convert lat/lon to local XZ coordinates:

```javascript
// Reference point (Golden Gate Bridge center)
const REF_LAT = 37.8199;
const REF_LON = -122.4783;

// Earth radius in meters
const EARTH_RADIUS = 6371000;

function latLonToLocal(lat, lon) {
  // Convert degrees to radians
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const refLatRad = REF_LAT * Math.PI / 180;
  const refLonRad = REF_LON * Math.PI / 180;

  // Calculate local X (east-west) and Z (north-south) in meters
  const x = EARTH_RADIUS * (lonRad - refLonRad) * Math.cos(refLatRad);
  const z = -EARTH_RADIUS * (latRad - refLatRad);  // Negative because +Z is south

  return { x, z };
}
```

---

## Implementation Tasks

### Task 19.1: Create Landmark Database

**File:** `src/data/landmarks.js`

Create a data file containing all landmarks with their properties:

```javascript
/**
 * San Francisco Landmarks Database
 * All coordinates are lat/lon, converted to local at runtime
 */
export const LANDMARKS = {
  goldenGateSouth: {
    id: 'golden-gate-south',
    name: 'Golden Gate Bridge (South)',
    shortName: 'GG South',
    lat: 37.8107,
    lon: -122.4738,
    altitude: 227,        // meters - tower height
    triggerRadius: 100,   // meters
    triggerType: 'sphere',
    description: 'South tower of the Golden Gate Bridge'
  },

  goldenGateCenter: {
    id: 'golden-gate-center',
    name: 'Golden Gate Bridge (Under)',
    shortName: 'GG Under',
    lat: 37.8199,
    lon: -122.4783,
    altitude: 40,         // meters - fly under the deck
    triggerRadius: 150,
    triggerType: 'box',
    triggerSize: { x: 300, y: 60, z: 100 },  // Wide gate to fly through
    description: 'Fly under the Golden Gate Bridge'
  },

  alcatraz: {
    id: 'alcatraz',
    name: 'Alcatraz Island',
    shortName: 'Alcatraz',
    lat: 37.8267,
    lon: -122.4233,
    altitude: 50,         // meters - fly over the island
    triggerRadius: 200,
    triggerType: 'sphere',
    description: 'The infamous prison island'
  },

  coitTower: {
    id: 'coit-tower',
    name: 'Coit Tower',
    shortName: 'Coit',
    lat: 37.8024,
    lon: -122.4059,
    altitude: 100,        // meters - above the tower
    triggerRadius: 80,
    triggerType: 'sphere',
    description: 'Telegraph Hill landmark'
  },

  transamerica: {
    id: 'transamerica',
    name: 'Transamerica Pyramid',
    shortName: 'Pyramid',
    lat: 37.7952,
    lon: -122.4029,
    altitude: 280,        // meters - near the top
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'The iconic pyramid building'
  },

  salesforceTower: {
    id: 'salesforce-tower',
    name: 'Salesforce Tower',
    shortName: 'Salesforce',
    lat: 37.7899,
    lon: -122.3969,
    altitude: 350,        // meters - above the crown
    triggerRadius: 120,
    triggerType: 'sphere',
    description: 'Tallest building in San Francisco'
  },

  ferryBuilding: {
    id: 'ferry-building',
    name: 'Ferry Building',
    shortName: 'Ferry',
    lat: 37.7955,
    lon: -122.3937,
    altitude: 80,
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'Historic waterfront building'
  },

  oraclePark: {
    id: 'oracle-park',
    name: 'Oracle Park',
    shortName: 'Oracle',
    lat: 37.7786,
    lon: -122.3897,
    altitude: 60,
    triggerRadius: 150,
    triggerType: 'sphere',
    description: 'Home of the SF Giants'
  },

  treasureIsland: {
    id: 'treasure-island',
    name: 'Treasure Island',
    shortName: 'Treasure',
    lat: 37.8236,
    lon: -122.3706,
    altitude: 50,
    triggerRadius: 300,
    triggerType: 'sphere',
    description: 'Artificial island in the bay'
  },

  bayBridge: {
    id: 'bay-bridge',
    name: 'Bay Bridge',
    shortName: 'Bay Bridge',
    lat: 37.7983,
    lon: -122.3778,
    altitude: 40,
    triggerRadius: 120,
    triggerType: 'box',
    triggerSize: { x: 200, y: 50, z: 80 },
    description: 'Fly under the Bay Bridge'
  },

  palaceOfFineArts: {
    id: 'palace-fine-arts',
    name: 'Palace of Fine Arts',
    shortName: 'Palace',
    lat: 37.8029,
    lon: -122.4486,
    altitude: 60,
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'Classical rotunda in the Marina'
  }
};

/**
 * Pre-defined racing routes
 */
export const ROUTES = {
  goldenGateChallenge: {
    id: 'golden-gate-challenge',
    name: 'Golden Gate Challenge',
    description: 'Start at Alcatraz, fly under the bridge, end at Palace of Fine Arts',
    checkpoints: ['alcatraz', 'goldenGateCenter', 'palaceOfFineArts'],
    difficulty: 'easy',
    estimatedTime: 45,  // seconds
    medalTimes: {
      gold: 40,
      silver: 50,
      bronze: 65
    }
  },

  bayTour: {
    id: 'bay-tour',
    name: 'Bay Area Tour',
    description: 'Complete circuit of major landmarks',
    checkpoints: [
      'goldenGateSouth',
      'alcatraz',
      'coitTower',
      'ferryBuilding',
      'oraclePark',
      'bayBridge',
      'treasureIsland'
    ],
    difficulty: 'medium',
    estimatedTime: 120,
    medalTimes: {
      gold: 100,
      silver: 130,
      bronze: 160
    }
  },

  downtownDash: {
    id: 'downtown-dash',
    name: 'Downtown Dash',
    description: 'Navigate through the skyscrapers',
    checkpoints: [
      'ferryBuilding',
      'transamerica',
      'salesforceTower',
      'oraclePark'
    ],
    difficulty: 'hard',
    estimatedTime: 60,
    medalTimes: {
      gold: 50,
      silver: 70,
      bronze: 90
    }
  },

  bridgeRun: {
    id: 'bridge-run',
    name: 'Bridge Run',
    description: 'Fly under both bridges',
    checkpoints: [
      'goldenGateCenter',
      'alcatraz',
      'treasureIsland',
      'bayBridge'
    ],
    difficulty: 'medium',
    estimatedTime: 90,
    medalTimes: {
      gold: 75,
      silver: 95,
      bronze: 120
    }
  }
};
```

---

### Task 19.2: Create Trigger Volume System

**File:** `src/race/TriggerVolume.js`

Implement invisible trigger volumes using Three.js Box3 and Sphere:

```javascript
import * as THREE from 'three';

/**
 * TriggerVolume - Invisible collision zone for checkpoint detection
 *
 * Supports both sphere and box triggers.
 * Uses swept-sphere detection for fast-moving aircraft.
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
   */
  constructor(config) {
    this.id = config.id;
    this.position = config.position.clone();
    this.type = config.type || 'sphere';
    this.radius = config.radius || 100;
    this.size = config.size || { x: 100, y: 100, z: 100 };
    this.triggered = false;
    this.enabled = true;

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

    // Reusable vectors for calculations
    this._prevPosition = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._testPoint = new THREE.Vector3();
  }

  /**
   * Create debug visualization mesh
   */
  createDebugMesh() {
    let geometry;
    if (this.type === 'sphere') {
      geometry = new THREE.SphereGeometry(this.radius, 16, 16);
    } else {
      geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });

    this.debugMesh = new THREE.Mesh(geometry, material);
    this.debugMesh.position.copy(this.position);

    return this.debugMesh;
  }

  /**
   * Check if an aircraft has entered this trigger volume
   * Uses swept-sphere detection for fast-moving objects
   *
   * @param {THREE.Vector3} currentPos - Current aircraft position
   * @param {THREE.Vector3} prevPos - Previous frame position
   * @param {number} aircraftRadius - Aircraft bounding radius
   * @returns {boolean} True if triggered
   */
  check(currentPos, prevPos, aircraftRadius = 20) {
    if (!this.enabled || this.triggered) {
      return false;
    }

    // Quick containment check first (handles slow movement)
    if (this.containsPoint(currentPos)) {
      this.triggered = true;
      this.onTrigger();
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
          this.onTrigger();
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
   * Called when trigger is activated
   * Override in subclass or set callback
   */
  onTrigger() {
    // Override or set via callback
  }

  /**
   * Reset trigger state (for replay)
   */
  reset() {
    this.triggered = false;
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0x00ff00);
    }
  }

  /**
   * Set triggered state visually
   */
  markTriggered() {
    this.triggered = true;
    if (this.debugMesh) {
      this.debugMesh.material.color.setHex(0xffff00);
    }
  }

  /**
   * Enable/disable the trigger
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.debugMesh) {
      this.debugMesh.visible = enabled;
    }
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.debugMesh) {
      this.debugMesh.geometry.dispose();
      this.debugMesh.material.dispose();
    }
  }
}
```

---

### Task 19.3: Create Checkpoint Manager

**File:** `src/race/CheckpointManager.js`

Manages all checkpoints for a race route:

```javascript
import * as THREE from 'three';
import { TriggerVolume } from './TriggerVolume.js';
import { LANDMARKS } from '../data/landmarks.js';
import { CONFIG } from '../config.js';

/**
 * Coordinate conversion helper
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
  const z = -EARTH_RADIUS * (latRad - refLatRad);

  return new THREE.Vector3(x, 0, z);
}

/**
 * CheckpointManager - Manages a sequence of checkpoints for a race
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

    this.checkpoints = [];
    this.currentCheckpointIndex = 0;
    this.raceActive = false;
    this.raceStartTime = 0;
    this.raceEndTime = 0;
    this.checkpointTimes = [];

    // Callbacks
    this.onCheckpointReached = null;  // (checkpoint, index, splitTime) => void
    this.onRaceComplete = null;       // (totalTime, checkpointTimes) => void
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

    // Create checkpoints from route
    route.checkpoints.forEach((landmarkId, index) => {
      const landmark = LANDMARKS[landmarkId];
      if (!landmark) {
        console.warn(`[Checkpoints] Unknown landmark: ${landmarkId}`);
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
        debug: this.debug
      });

      // Set up callback
      trigger.onTrigger = () => {
        this.handleCheckpointReached(index);
      };

      // Initially disable all except first
      trigger.setEnabled(index === 0);

      this.checkpoints.push({
        trigger,
        landmark,
        index,
        reached: false
      });

      // Add debug mesh to scene
      if (trigger.debugMesh) {
        this.scene.add(trigger.debugMesh);
      }
    });

    console.log(`[Checkpoints] Loaded route: ${route.name} with ${this.checkpoints.length} checkpoints`);
  }

  /**
   * Start the race
   */
  startRace() {
    if (this.checkpoints.length === 0) {
      console.warn('[Checkpoints] No route loaded');
      return;
    }

    this.raceActive = true;
    this.raceStartTime = performance.now();
    this.currentCheckpointIndex = 0;
    this.checkpointTimes = [];

    // Reset all checkpoints
    this.checkpoints.forEach((cp, index) => {
      cp.trigger.reset();
      cp.reached = false;
      cp.trigger.setEnabled(index === 0);  // Only first enabled
    });

    console.log(`[Checkpoints] Race started: ${this.routeName}`);

    if (this.onRaceStart) {
      this.onRaceStart();
    }
  }

  /**
   * Handle checkpoint reached
   */
  handleCheckpointReached(index) {
    if (!this.raceActive) return;
    if (index !== this.currentCheckpointIndex) return;

    const checkpoint = this.checkpoints[index];
    const currentTime = performance.now();
    const splitTime = (currentTime - this.raceStartTime) / 1000;  // seconds

    checkpoint.reached = true;
    this.checkpointTimes.push(splitTime);

    console.log(`[Checkpoints] Checkpoint ${index + 1}/${this.checkpoints.length}: ${checkpoint.landmark.shortName} at ${splitTime.toFixed(2)}s`);

    // Notify callback
    if (this.onCheckpointReached) {
      this.onCheckpointReached(checkpoint, index, splitTime);
    }

    // Check if race complete
    if (index === this.checkpoints.length - 1) {
      this.completeRace(splitTime);
    } else {
      // Enable next checkpoint
      this.currentCheckpointIndex++;
      this.checkpoints[this.currentCheckpointIndex].trigger.setEnabled(true);
    }
  }

  /**
   * Complete the race
   */
  completeRace(totalTime) {
    this.raceActive = false;
    this.raceEndTime = performance.now();

    // Determine medal
    let medal = null;
    if (this.medalTimes) {
      if (totalTime <= this.medalTimes.gold) medal = 'gold';
      else if (totalTime <= this.medalTimes.silver) medal = 'silver';
      else if (totalTime <= this.medalTimes.bronze) medal = 'bronze';
    }

    console.log(`[Checkpoints] Race complete! Time: ${totalTime.toFixed(2)}s, Medal: ${medal || 'none'}`);

    if (this.onRaceComplete) {
      this.onRaceComplete({
        routeId: this.routeId,
        routeName: this.routeName,
        totalTime,
        checkpointTimes: this.checkpointTimes,
        medal
      });
    }
  }

  /**
   * Update - check all active triggers
   * Call this every frame with current aircraft position
   *
   * @param {THREE.Vector3} aircraftPos - Current aircraft position
   */
  update(aircraftPos) {
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

    // Update previous position
    this._prevAircraftPos.copy(aircraftPos);
  }

  /**
   * Get current race state for UI
   */
  getRaceState() {
    if (!this.raceActive) {
      return {
        active: false,
        routeName: this.routeName,
        totalCheckpoints: this.checkpoints.length
      };
    }

    const currentTime = (performance.now() - this.raceStartTime) / 1000;
    const currentCheckpoint = this.checkpoints[this.currentCheckpointIndex];

    return {
      active: true,
      routeName: this.routeName,
      currentCheckpoint: this.currentCheckpointIndex + 1,
      totalCheckpoints: this.checkpoints.length,
      currentTime,
      nextCheckpointName: currentCheckpoint?.landmark.shortName || null,
      checkpointTimes: [...this.checkpointTimes]
    };
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
    });
    this.checkpoints = [];
    this.currentCheckpointIndex = 0;
    this.raceActive = false;
  }

  /**
   * Clean up
   */
  dispose() {
    this.clearCheckpoints();
  }
}
```

---

### Task 19.4: Create Race HUD Overlay

**File:** `src/ui/RaceHUD.js`

Display race progress, timer, and checkpoint notifications:

```javascript
/**
 * RaceHUD - Displays race information overlay
 */
export class RaceHUD {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.visible = false;

    this.createElements();
  }

  createElements() {
    // Main container
    this.element = document.createElement('div');
    this.element.id = 'race-hud';
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 20px;
      transform: translateY(-50%);
      pointer-events: none;
      z-index: 500;
      display: none;
    `;

    // Race info panel
    this.element.innerHTML = `
      <div class="race-panel" style="
        background: rgba(0, 0, 0, 0.7);
        border-radius: 12px;
        padding: 20px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 200px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <div class="race-title" style="
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">Golden Gate Challenge</div>

        <div class="race-timer" style="
          font-size: 48px;
          font-weight: bold;
          font-variant-numeric: tabular-nums;
          margin-bottom: 12px;
        ">00:00.00</div>

        <div class="checkpoint-progress" style="
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        "></div>

        <div class="next-checkpoint" style="
          font-size: 16px;
          color: #4ade80;
        ">
          <span style="opacity: 0.6">Next:</span>
          <span class="checkpoint-name">Alcatraz</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    // Get references
    this.titleEl = this.element.querySelector('.race-title');
    this.timerEl = this.element.querySelector('.race-timer');
    this.progressEl = this.element.querySelector('.checkpoint-progress');
    this.nextCheckpointEl = this.element.querySelector('.checkpoint-name');

    // Checkpoint notification (center screen)
    this.notification = document.createElement('div');
    this.notification.id = 'checkpoint-notification';
    this.notification.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: system-ui, sans-serif;
      font-size: 32px;
      font-weight: bold;
      color: #4ade80;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 600;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
    `;
    this.container.appendChild(this.notification);
  }

  /**
   * Show the race HUD
   * @param {string} routeName - Name of the race
   * @param {number} totalCheckpoints - Total number of checkpoints
   */
  show(routeName, totalCheckpoints) {
    this.visible = true;
    this.element.style.display = 'block';
    this.titleEl.textContent = routeName;

    // Create checkpoint dots
    this.progressEl.innerHTML = '';
    for (let i = 0; i < totalCheckpoints; i++) {
      const dot = document.createElement('div');
      dot.className = 'checkpoint-dot';
      dot.dataset.index = i;
      dot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transition: background 0.3s, transform 0.3s;
      `;
      this.progressEl.appendChild(dot);
    }
  }

  /**
   * Hide the race HUD
   */
  hide() {
    this.visible = false;
    this.element.style.display = 'none';
  }

  /**
   * Update timer display
   * @param {number} timeSeconds - Elapsed time in seconds
   */
  updateTimer(timeSeconds) {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    const centiseconds = Math.floor((timeSeconds % 1) * 100);

    this.timerEl.textContent =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update checkpoint progress
   * @param {number} currentIndex - Current checkpoint index (0-based)
   * @param {string} nextName - Name of next checkpoint
   */
  updateProgress(currentIndex, nextName) {
    // Update dots
    const dots = this.progressEl.querySelectorAll('.checkpoint-dot');
    dots.forEach((dot, i) => {
      if (i < currentIndex) {
        dot.style.background = '#4ade80';
        dot.style.transform = 'scale(1)';
      } else if (i === currentIndex) {
        dot.style.background = '#fbbf24';
        dot.style.transform = 'scale(1.3)';
      } else {
        dot.style.background = 'rgba(255, 255, 255, 0.3)';
        dot.style.transform = 'scale(1)';
      }
    });

    // Update next checkpoint name
    if (nextName) {
      this.nextCheckpointEl.textContent = nextName;
    }
  }

  /**
   * Show checkpoint reached notification
   * @param {string} name - Checkpoint name
   * @param {number} splitTime - Time at this checkpoint
   */
  showCheckpointNotification(name, splitTime) {
    this.notification.innerHTML = `
      <div style="color: #4ade80;">✓ ${name}</div>
      <div style="font-size: 24px; color: white;">${splitTime.toFixed(2)}s</div>
    `;
    this.notification.style.opacity = '1';
    this.notification.style.transform = 'translate(-50%, -50%) scale(1)';

    setTimeout(() => {
      this.notification.style.opacity = '0';
      this.notification.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }, 1500);
  }

  /**
   * Show race complete screen
   * @param {Object} result - Race result
   */
  showRaceComplete(result) {
    // Medal colors
    const medalColors = {
      gold: '#ffd700',
      silver: '#c0c0c0',
      bronze: '#cd7f32'
    };

    const medalEmoji = {
      gold: '🥇',
      silver: '🥈',
      bronze: '🥉'
    };

    this.notification.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.85);
        padding: 30px 50px;
        border-radius: 16px;
        text-align: center;
        border: 2px solid ${result.medal ? medalColors[result.medal] : '#4ade80'};
      ">
        <div style="font-size: 24px; margin-bottom: 10px; color: rgba(255,255,255,0.7);">
          RACE COMPLETE!
        </div>
        <div style="font-size: 56px; margin-bottom: 10px;">
          ${result.medal ? medalEmoji[result.medal] : '🏁'}
        </div>
        <div style="font-size: 42px; color: white; margin-bottom: 20px;">
          ${result.totalTime.toFixed(2)}s
        </div>
        <div style="font-size: 18px; color: ${result.medal ? medalColors[result.medal] : '#4ade80'};">
          ${result.medal ? result.medal.toUpperCase() + ' MEDAL!' : 'Finished!'}
        </div>
        <button id="share-race-btn" style="
          margin-top: 20px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: bold;
          background: #1da1f2;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          pointer-events: auto;
        ">
          Share on X
        </button>
        <button id="retry-race-btn" style="
          margin-top: 10px;
          margin-left: 10px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: bold;
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          pointer-events: auto;
        ">
          Try Again
        </button>
      </div>
    `;
    this.notification.style.opacity = '1';
    this.notification.style.transform = 'translate(-50%, -50%) scale(1)';

    // Wire up buttons
    document.getElementById('share-race-btn')?.addEventListener('click', () => {
      this.onShareClick?.(result);
    });

    document.getElementById('retry-race-btn')?.addEventListener('click', () => {
      this.hideRaceComplete();
      this.onRetryClick?.();
    });
  }

  /**
   * Hide race complete screen
   */
  hideRaceComplete() {
    this.notification.style.opacity = '0';
  }

  // Callbacks - set these
  onShareClick = null;
  onRetryClick = null;
}
```

---

### Task 19.5: Create Route Selection UI

**File:** `src/ui/RouteSelector.js`

Let players choose which race to run:

```javascript
import { ROUTES } from '../data/landmarks.js';

/**
 * RouteSelector - UI for choosing a race route
 */
export class RouteSelector {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.onRouteSelected = null;
    this.visible = false;

    this.createUI();
  }

  createUI() {
    this.element = document.createElement('div');
    this.element.id = 'route-selector';
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      border-radius: 20px;
      padding: 30px;
      color: white;
      font-family: system-ui, sans-serif;
      z-index: 1000;
      display: none;
      max-width: 500px;
      width: 90%;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    this.element.innerHTML = `
      <h2 style="margin: 0 0 10px 0; font-size: 24px;">Choose Your Route</h2>
      <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.6); font-size: 14px;">
        Race through San Francisco landmarks!
      </p>
      <div class="routes-list"></div>
      <button class="close-btn" style="
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        color: rgba(255,255,255,0.6);
        font-size: 24px;
        cursor: pointer;
      ">×</button>
    `;

    // Populate routes
    const routesList = this.element.querySelector('.routes-list');
    Object.values(ROUTES).forEach(route => {
      const routeCard = document.createElement('div');
      routeCard.className = 'route-card';
      routeCard.dataset.routeId = route.id;
      routeCard.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.2s;
        border: 2px solid transparent;
      `;

      const difficultyColors = {
        easy: '#4ade80',
        medium: '#fbbf24',
        hard: '#ef4444'
      };

      routeCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">
              ${route.name}
            </div>
            <div style="font-size: 13px; color: rgba(255,255,255,0.6);">
              ${route.checkpoints.length} checkpoints • ~${route.estimatedTime}s
            </div>
          </div>
          <div style="
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            background: ${difficultyColors[route.difficulty]}22;
            color: ${difficultyColors[route.difficulty]};
            text-transform: uppercase;
          ">
            ${route.difficulty}
          </div>
        </div>
        <div style="font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 8px;">
          ${route.description}
        </div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 8px;">
          🥇 ${route.medalTimes.gold}s • 🥈 ${route.medalTimes.silver}s • 🥉 ${route.medalTimes.bronze}s
        </div>
      `;

      routeCard.addEventListener('mouseenter', () => {
        routeCard.style.background = 'rgba(255, 255, 255, 0.15)';
        routeCard.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      });

      routeCard.addEventListener('mouseleave', () => {
        routeCard.style.background = 'rgba(255, 255, 255, 0.1)';
        routeCard.style.borderColor = 'transparent';
      });

      routeCard.addEventListener('click', () => {
        this.selectRoute(route);
      });

      routesList.appendChild(routeCard);
    });

    // Close button
    this.element.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    this.container.appendChild(this.element);
  }

  selectRoute(route) {
    this.hide();
    if (this.onRouteSelected) {
      this.onRouteSelected(route);
    }
  }

  show() {
    this.visible = true;
    this.element.style.display = 'block';
  }

  hide() {
    this.visible = false;
    this.element.style.display = 'none';
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}
```

---

### Task 19.6: Integration with Main Game

**File:** `src/main.js` (modifications)

Add race system to the main game loop:

```javascript
// Add imports
import { CheckpointManager } from './race/CheckpointManager.js';
import { RaceHUD } from './ui/RaceHUD.js';
import { RouteSelector } from './ui/RouteSelector.js';
import { ROUTES } from './data/landmarks.js';

// In startGame() function:

// Initialize race system
const checkpointManager = new CheckpointManager(scene, {
  debug: CONFIG.debug.showCheckpoints || false
});

const raceHUD = new RaceHUD(container);
const routeSelector = new RouteSelector(container);

// Wire up route selection
routeSelector.onRouteSelected = (route) => {
  checkpointManager.loadRoute(route);
  checkpointManager.startRace();
  raceHUD.show(route.name, route.checkpoints.length);
};

// Wire up checkpoint callbacks
checkpointManager.onCheckpointReached = (checkpoint, index, splitTime) => {
  raceHUD.showCheckpointNotification(checkpoint.landmark.shortName, splitTime);
  raceHUD.updateProgress(index + 1, checkpointManager.checkpoints[index + 1]?.landmark.shortName);
};

checkpointManager.onRaceComplete = (result) => {
  raceHUD.showRaceComplete(result);
};

// Wire up race HUD callbacks
raceHUD.onShareClick = (result) => {
  // Will be implemented in Stage 20
  shareRaceResult(result);
};

raceHUD.onRetryClick = () => {
  checkpointManager.startRace();
  raceHUD.show(checkpointManager.routeName, checkpointManager.checkpoints.length);
};

// Add keyboard shortcut to open route selector
keyboardInput.onKeyDown = (key) => {
  if (key === 'r' || key === 'R') {
    routeSelector.toggle();
  }
};

// In update() function, add:
// Update race system
checkpointManager.update(aircraft.position);

// Update race HUD timer
if (checkpointManager.raceActive) {
  const state = checkpointManager.getRaceState();
  raceHUD.updateTimer(state.currentTime);
}
```

---

## Testing Checklist

### Checkpoint Detection
- [ ] Aircraft triggers checkpoint when flying through
- [ ] Fast-moving aircraft doesn't tunnel through checkpoints
- [ ] Only the current checkpoint is active
- [ ] Checkpoints enable in sequence

### Race Flow
- [ ] Route loads correctly from ROUTES data
- [ ] Race timer starts on first checkpoint
- [ ] Split times recorded accurately
- [ ] Race completes on final checkpoint
- [ ] Medal assigned based on time

### UI/UX
- [ ] Race HUD shows correctly
- [ ] Timer updates in real-time
- [ ] Checkpoint notifications appear
- [ ] Progress dots update
- [ ] Race complete screen shows
- [ ] Share and retry buttons work

### Coordinate Conversion
- [ ] Landmarks appear at correct locations
- [ ] Trigger volumes match visual landmarks
- [ ] Flying to landmarks triggers checkpoints

---

## Files to Create

1. `src/data/landmarks.js` - Landmark and route database
2. `src/race/TriggerVolume.js` - Invisible collision detection
3. `src/race/CheckpointManager.js` - Race logic manager
4. `src/ui/RaceHUD.js` - Race UI overlay
5. `src/ui/RouteSelector.js` - Route selection UI

## Files to Modify

1. `src/main.js` - Integrate race system
2. `src/config.js` - Add debug.showCheckpoints option

---

## Success Metrics

- Players complete races and see their times
- Medal system creates replayability
- Share button generates engagement (Stage 20)
- Checkpoint locations feel accurate to landmarks
- No tunneling issues at any speed

---

## Dependencies

- **Stage 20 (Share System)** - Share button integration
- **Stage 18 (Tile Performance)** - Landmarks must load for races to work

---

## Future Enhancements (Post-Launch)

- Ghost racing (compete against your best time)
- Multiplayer racing (race against other players)
- Custom route creation
- Weekly challenges
- Persistent leaderboards
