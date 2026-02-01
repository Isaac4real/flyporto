# Stage 18: Tile Streaming Performance Overhaul

## Overview

This is a **critical, high-priority stage** addressing the most significant technical challenge in the project: tiles loading too slowly when flying to new areas, resulting in low-quality or missing terrain.

**Problem Statement:**
- When flying to new areas, tiles either don't load or take far too long to transition from low to high quality
- This breaks immersion and makes the game feel unpolished
- Current max speed (200 m/s) far exceeds tile streaming capability

**Estimated Time:** 4-6 hours (complex systems work)

---

## Root Cause Analysis

Based on extensive research, the following issues have been identified:

### 1. Speed vs. Tile Loading Mismatch

| Factor | Current Value | Issue |
|--------|---------------|-------|
| Max Speed | 200 m/s (390 knots) | Aircraft can travel 200m per second |
| errorTarget | 2 pixels | Very aggressive - demands high quality quickly |
| No predictive loading | N/A | Tiles only load when camera sees them |

**Result:** At 200 m/s, aircraft enters new tile areas faster than tiles can load.

### 2. Missing Optimized Load Strategy

The 3DTilesRendererJS library has an `optimizedLoadStrategy` flag (added in v0.4.20) that we are **NOT using**:

- **Standard Strategy (current):** Loads parent tiles before children - slower initial loads
- **Optimized Strategy:** Loads tiles independently based on screen space error - much faster

### 3. No Predictive/Prefetch Loading

The library has **no built-in predictive loading**. All tile loading is reactive to current camera position. For a flight sim moving at 200 m/s, this is inadequate.

### 4. Auto-Acceleration Without Player Input

The aircraft currently starts with velocity and maintains throttle automatically, which:
- Removes player control over speed
- Makes it impossible to slow down to let tiles load
- Creates expectation mismatch (arcade feel but realistic terrain streaming)

---

## Solution Architecture

### Multi-Pronged Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                    TILE STREAMING PERFORMANCE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ADAPTIVE QUALITY SYSTEM                                     │
│     └─ Dynamically adjust errorTarget based on speed            │
│                                                                 │
│  2. OPTIMIZED LOAD STRATEGY                                     │
│     └─ Enable optimizedLoadStrategy flag                        │
│                                                                 │
│  3. PREDICTIVE TILE LOADING                                     │
│     └─ Custom system to pre-request tiles in flight direction   │
│                                                                 │
│  4. FLIGHT SPEED REBALANCING                                    │
│     └─ Reduce max speed, add proper throttle control            │
│                                                                 │
│  5. VISUAL MASKING                                              │
│     └─ Distance fog to hide loading transitions                 │
│                                                                 │
│  6. PROGRESSIVE QUALITY                                         │
│     └─ Accept low quality initially, refine over time           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 18.1: Enable Optimized Load Strategy

**File:** `src/core/TilesManager.js`

The `optimizedLoadStrategy` flag fundamentally changes how tiles are loaded:
- Tiles load independently without waiting for parents
- Much faster initial loads to new areas
- Prevents gaps and flashing

```javascript
// Add after other settings
tilesRenderer.optimizedLoadStrategy = true;
tilesRenderer.loadSiblings = true;  // Prevent gaps during camera movement
```

**Important:** This is incompatible with some plugins. Need to verify TilesFadePlugin still works.

**Acceptance Criteria:**
- [ ] optimizedLoadStrategy enabled
- [ ] loadSiblings enabled
- [ ] No visual regressions with existing plugins
- [ ] Measurably faster tile loading to new areas

---

### Task 18.2: Implement Adaptive Error Target System

**Files:** `src/core/TilesManager.js`, `src/core/AdaptiveQuality.js` (new)

Create a system that dynamically adjusts `errorTarget` based on aircraft speed:

| Speed Range | errorTarget | Rationale |
|-------------|-------------|-----------|
| 0-50 m/s (hovering/slow) | 2 | Max quality when slow |
| 50-100 m/s (cruising) | 6 | Balanced quality/loading |
| 100-150 m/s (fast) | 12 | Prioritize loading over quality |
| 150+ m/s (diving/racing) | 20 | Accept lower quality for speed |

**New File:** `src/core/AdaptiveQuality.js`

```javascript
/**
 * AdaptiveQuality - Dynamically adjusts tile quality based on flight speed
 *
 * The core insight: when moving fast, we need tiles to load quickly even if
 * they're lower quality. When slow, we can demand higher quality.
 */
export class AdaptiveQuality {
  constructor(tilesRenderer, config = {}) {
    this.tilesRenderer = tilesRenderer;

    // Configuration
    this.minErrorTarget = config.minErrorTarget || 2;   // Best quality
    this.maxErrorTarget = config.maxErrorTarget || 24;  // Fastest loading
    this.speedThresholdLow = config.speedThresholdLow || 50;   // m/s
    this.speedThresholdHigh = config.speedThresholdHigh || 150; // m/s

    // Smoothing to prevent rapid oscillation
    this.currentErrorTarget = this.minErrorTarget;
    this.smoothingRate = config.smoothingRate || 2.0;  // Units per second

    // Track for gradual quality improvement when stationary
    this.lastSpeed = 0;
    this.stationaryTime = 0;
  }

  /**
   * Update adaptive quality based on current speed
   * @param {number} speed - Current aircraft speed in m/s
   * @param {number} deltaTime - Frame delta time in seconds
   */
  update(speed, deltaTime) {
    // Calculate target error based on speed
    let targetError;

    if (speed <= this.speedThresholdLow) {
      // Slow - demand high quality
      targetError = this.minErrorTarget;
    } else if (speed >= this.speedThresholdHigh) {
      // Fast - accept lower quality
      targetError = this.maxErrorTarget;
    } else {
      // Interpolate between thresholds
      const t = (speed - this.speedThresholdLow) /
                (this.speedThresholdHigh - this.speedThresholdLow);
      targetError = this.minErrorTarget + t * (this.maxErrorTarget - this.minErrorTarget);
    }

    // Track stationary time for progressive quality improvement
    if (speed < 10) {
      this.stationaryTime += deltaTime;
      // When stationary for a while, progressively demand higher quality
      if (this.stationaryTime > 2.0) {
        targetError = Math.max(1, targetError - (this.stationaryTime - 2.0) * 0.5);
      }
    } else {
      this.stationaryTime = 0;
    }

    // Smooth the transition (faster when increasing error, slower when decreasing)
    const direction = targetError > this.currentErrorTarget ? 1 : -1;
    const rate = direction > 0 ? this.smoothingRate * 2 : this.smoothingRate;

    this.currentErrorTarget += direction * rate * deltaTime;
    this.currentErrorTarget = Math.max(this.minErrorTarget,
                               Math.min(this.maxErrorTarget, this.currentErrorTarget));

    // Apply to tiles renderer
    this.tilesRenderer.errorTarget = Math.round(this.currentErrorTarget);

    this.lastSpeed = speed;
  }

  /**
   * Get current error target for debugging
   */
  getErrorTarget() {
    return Math.round(this.currentErrorTarget);
  }
}
```

**Acceptance Criteria:**
- [ ] AdaptiveQuality class created
- [ ] Integrated into main game loop
- [ ] errorTarget decreases when slow, increases when fast
- [ ] Smooth transitions (no jarring quality changes)
- [ ] Debug display shows current error target

---

### Task 18.3: Implement Predictive Tile Loading

**Files:** `src/core/PredictiveLoader.js` (new), `src/core/TilesManager.js`

Since 3DTilesRendererJS has no built-in predictive loading, we need to implement our own system that pre-requests tiles in the flight direction.

**Concept:**
1. Create a "look-ahead camera" positioned ahead of the aircraft
2. Run a separate tile update pass with this camera to trigger tile requests
3. The main camera then benefits from tiles already being queued

**New File:** `src/core/PredictiveLoader.js`

```javascript
import * as THREE from 'three';

/**
 * PredictiveLoader - Pre-requests tiles in the direction of flight
 *
 * Creates virtual cameras ahead of the aircraft to trigger tile loading
 * before the main camera reaches those areas.
 */
export class PredictiveLoader {
  constructor(tilesRenderer, mainCamera) {
    this.tilesRenderer = tilesRenderer;
    this.mainCamera = mainCamera;

    // Create look-ahead cameras at different distances
    this.lookAheadCameras = [
      this.createLookAheadCamera(500),   // 500m ahead (~2.5s at 200m/s)
      this.createLookAheadCamera(1000),  // 1000m ahead (~5s at 200m/s)
      this.createLookAheadCamera(2000),  // 2000m ahead (~10s at 200m/s)
    ];

    // Configuration
    this.enabled = true;
    this.updateInterval = 500;  // ms between predictive updates
    this.lastUpdateTime = 0;

    // Reusable vectors
    this._forward = new THREE.Vector3();
    this._position = new THREE.Vector3();
  }

  /**
   * Create a look-ahead camera for predictive loading
   */
  createLookAheadCamera(distance) {
    const camera = new THREE.PerspectiveCamera(
      90,  // Wider FOV to catch more tiles
      this.mainCamera.aspect,
      this.mainCamera.near,
      this.mainCamera.far
    );
    camera.lookAheadDistance = distance;
    return camera;
  }

  /**
   * Update predictive loading based on aircraft state
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
    if (speed < 20) return;  // Don't predict when nearly stationary

    this._forward.copy(aircraft.velocity).normalize();

    // Update each look-ahead camera and trigger tile requests
    for (const camera of this.lookAheadCameras) {
      // Position camera ahead of aircraft
      this._position.copy(aircraft.position);
      this._position.addScaledVector(this._forward, camera.lookAheadDistance);

      // Maintain minimum altitude (don't look underground)
      this._position.y = Math.max(this._position.y, 50);

      camera.position.copy(this._position);
      camera.lookAt(
        this._position.x + this._forward.x * 100,
        this._position.y + this._forward.y * 100,
        this._position.z + this._forward.z * 100
      );
      camera.updateMatrixWorld();

      // Temporarily set this camera for tile updates
      // This queues tile requests without affecting rendering
      this.tilesRenderer.setCamera(camera);
      this.tilesRenderer.update();
    }

    // Restore main camera
    this.tilesRenderer.setCamera(this.mainCamera);
  }

  /**
   * Adjust prediction distance based on speed
   */
  adjustForSpeed(speed) {
    // At higher speeds, look further ahead
    const speedFactor = Math.max(1, speed / 100);
    this.lookAheadCameras[0].lookAheadDistance = 500 * speedFactor;
    this.lookAheadCameras[1].lookAheadDistance = 1000 * speedFactor;
    this.lookAheadCameras[2].lookAheadDistance = 2000 * speedFactor;
  }

  /**
   * Enable/disable predictive loading
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
```

**Acceptance Criteria:**
- [ ] PredictiveLoader class created
- [ ] Integrated into main game loop (called before main tile update)
- [ ] Look-ahead cameras positioned correctly in flight direction
- [ ] Tiles noticeably pre-loaded when flying straight
- [ ] Minimal performance impact (throttled updates)

---

### Task 18.4: Rebalance Flight Speed and Throttle

**Files:** `src/config.js`, `src/player/Physics.js`

The current physics model has issues:
1. Max speed (200 m/s) is too fast for tile streaming
2. Aircraft auto-accelerates without player input
3. No intuitive throttle control

**Config Changes:** `src/config.js`

```javascript
physics: {
  // REBALANCED for tile streaming
  maxSpeed: 120,          // Reduced from 200 m/s (~230 knots)
  cruiseSpeed: 80,        // Comfortable cruise where tiles keep up
  minSpeed: 30,           // Stall speed - can't go slower

  // Throttle behavior
  throttleAccel: 30,      // Reduced from 50 - gentler acceleration
  idleThrottle: 0.3,      // Throttle when no input (maintains ~60 m/s)

  drag: 0.008,            // Increased from 0.005 - more natural deceleration

  // ... rest of physics config
}
```

**Physics.js Changes:**

```javascript
// Remove auto-acceleration behavior
// Player should control throttle explicitly

// Add throttle management
if (input.throttleUp) {
  aircraft.targetThrottle = Math.min(1.0, aircraft.targetThrottle + deltaTime);
} else if (input.throttleDown) {
  aircraft.targetThrottle = Math.max(0.0, aircraft.targetThrottle - deltaTime);
} else {
  // Drift toward idle throttle (not full throttle)
  const idle = CONFIG.physics.idleThrottle;
  if (aircraft.targetThrottle > idle) {
    aircraft.targetThrottle -= deltaTime * 0.5;
  }
}

// Enforce minimum speed (stall protection)
const speed = aircraft.velocity.length();
if (speed < CONFIG.physics.minSpeed) {
  // Gently push nose down and add speed
  aircraft.velocity.addScaledVector(aircraft.forward, CONFIG.physics.minSpeed - speed);
}
```

**Acceptance Criteria:**
- [ ] Max speed reduced to 120 m/s
- [ ] Aircraft does not auto-accelerate to max speed
- [ ] W/S keys control throttle up/down
- [ ] Comfortable cruise speed (~80 m/s) where tiles keep up
- [ ] Stall protection prevents going too slow

---

### Task 18.5: Add Distance Fog for Visual Masking

**Files:** `src/core/Scene.js`, `src/core/FogManager.js` (new)

Distance fog serves two purposes:
1. Hides the horizon where tiles haven't loaded yet
2. Creates depth and atmosphere

**Scene.js Changes:**

```javascript
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);  // Sky blue

  // Add distance fog - fades to sky color
  // Near: start fade at 3000m, Far: fully fogged at 8000m
  scene.fog = new THREE.Fog(0x87CEEB, 3000, 8000);

  return scene;
}
```

**New File:** `src/core/FogManager.js`

```javascript
/**
 * FogManager - Dynamically adjusts fog based on flight conditions
 */
export class FogManager {
  constructor(scene) {
    this.scene = scene;
    this.baseFogNear = 3000;
    this.baseFogFar = 8000;
  }

  /**
   * Update fog based on speed and tile loading state
   * @param {number} speed - Current speed in m/s
   * @param {number} downloadQueueSize - Tiles waiting to download
   */
  update(speed, downloadQueueSize) {
    if (!this.scene.fog) return;

    // When moving fast or many tiles loading, bring fog closer
    let fogMultiplier = 1.0;

    // Speed factor: faster = closer fog
    if (speed > 80) {
      fogMultiplier *= Math.max(0.5, 1 - (speed - 80) / 200);
    }

    // Loading factor: more tiles loading = closer fog
    if (downloadQueueSize > 20) {
      fogMultiplier *= Math.max(0.6, 1 - (downloadQueueSize - 20) / 100);
    }

    // Apply with smoothing
    const targetNear = this.baseFogNear * fogMultiplier;
    const targetFar = this.baseFogFar * fogMultiplier;

    this.scene.fog.near += (targetNear - this.scene.fog.near) * 0.1;
    this.scene.fog.far += (targetFar - this.scene.fog.far) * 0.1;
  }
}
```

**Acceptance Criteria:**
- [ ] Distance fog added to scene
- [ ] Fog color matches sky background
- [ ] Distant unloaded tiles hidden by fog
- [ ] Dynamic fog adjustment based on speed/loading (optional enhancement)

---

### Task 18.6: Enhanced Tile Loading Feedback

**Files:** `src/ui/HUD.js`, `src/ui/TileLoadingOverlay.js` (new)

When tiles are loading heavily, provide clear visual feedback:

**New File:** `src/ui/TileLoadingOverlay.js`

```javascript
/**
 * TileLoadingOverlay - Visual feedback when tile loading is behind
 */
export class TileLoadingOverlay {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.visible = false;
    this.createOverlay();
  }

  createOverlay() {
    this.element = document.createElement('div');
    this.element.id = 'tile-loading-overlay';
    this.element.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    this.element.innerHTML = `
      <div class="spinner" style="
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>Loading terrain...</span>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    this.container.appendChild(this.element);
  }

  /**
   * Update overlay based on tile loading state
   * @param {number} downloadQueueSize - Tiles waiting to download
   * @param {number} parseQueueSize - Tiles being parsed
   */
  update(downloadQueueSize, parseQueueSize) {
    const totalPending = downloadQueueSize + parseQueueSize;
    const shouldShow = totalPending > 30;

    if (shouldShow && !this.visible) {
      this.element.style.opacity = '1';
      this.visible = true;
    } else if (!shouldShow && this.visible) {
      this.element.style.opacity = '0';
      this.visible = false;
    }

    if (shouldShow) {
      this.element.querySelector('span').textContent =
        `Loading terrain... (${totalPending} tiles)`;
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Loading overlay appears when many tiles pending
- [ ] Shows tile count
- [ ] Smooth fade in/out
- [ ] Non-intrusive positioning

---

### Task 18.7: Increase Cache and Queue Sizes

**File:** `src/config.js`

Based on research, current cache may be too conservative:

```javascript
tiles: {
  errorTarget: 2,              // Will be managed by AdaptiveQuality
  errorThreshold: Infinity,
  maxDownloadJobs: 60,         // Increased from 50
  maxParseJobs: 10,            // Keep - CPU bound
  cacheMinBytes: 400 * 1e6,    // 400MB - increased from 250MB
  cacheMaxBytes: 700 * 1e6,    // 700MB - increased from 500MB

  // New: optimized strategy settings
  optimizedLoadStrategy: true,
  loadSiblings: true
}
```

**Acceptance Criteria:**
- [ ] Cache sizes increased
- [ ] Download jobs increased to 60
- [ ] New flags added to config
- [ ] No memory issues on desktop browsers

---

### Task 18.8: Integration and Testing

**File:** `src/main.js`

Integrate all new systems into the main game loop:

```javascript
import { AdaptiveQuality } from './core/AdaptiveQuality.js';
import { PredictiveLoader } from './core/PredictiveLoader.js';
import { FogManager } from './core/FogManager.js';
import { TileLoadingOverlay } from './ui/TileLoadingOverlay.js';

// In startGame():

// Initialize new systems
const adaptiveQuality = new AdaptiveQuality(tilesRenderer, {
  minErrorTarget: 2,
  maxErrorTarget: 24,
  speedThresholdLow: 40,
  speedThresholdHigh: 120
});

const predictiveLoader = new PredictiveLoader(tilesRenderer, camera);
const fogManager = new FogManager(scene);
const tileLoadingOverlay = new TileLoadingOverlay(container);

// In update():

// Update adaptive quality based on speed
adaptiveQuality.update(aircraft.getSpeed(), deltaTime);

// Pre-load tiles in flight direction (before main tile update)
predictiveLoader.update(aircraft, performance.now());
predictiveLoader.adjustForSpeed(aircraft.getSpeed());

// Update fog based on conditions
const downloadQueue = tilesRenderer.downloadQueue?.itemsInList || 0;
fogManager.update(aircraft.getSpeed(), downloadQueue);

// Update loading overlay
const parseQueue = tilesRenderer.parseQueue?.itemsInList || 0;
tileLoadingOverlay.update(downloadQueue, parseQueue);
```

**Acceptance Criteria:**
- [ ] All systems integrated without errors
- [ ] No performance regression (maintain 30+ fps)
- [ ] Systems work together harmoniously
- [ ] Debug mode shows all system states

---

## Testing Checklist

### Performance Testing

- [ ] Fly straight at max speed (120 m/s) - tiles load ahead
- [ ] Dive toward downtown SF - terrain loads before arrival
- [ ] Circle Golden Gate Bridge - tiles stay cached
- [ ] Quick 180° turn - tiles load from new direction within 3s
- [ ] Sustained flight (10+ minutes) - no memory leaks or degradation

### Quality Testing

- [ ] When slow/stationary - tiles reach max quality (errorTarget ~2)
- [ ] When cruising - acceptable quality (errorTarget ~8)
- [ ] When fast - lower quality but no holes (errorTarget ~16)
- [ ] Fog masks distant low-quality transitions

### Edge Cases

- [ ] Flying toward ocean (less tile data) - graceful handling
- [ ] Flying to edge of SF coverage - fog hides boundary
- [ ] Rapid altitude changes - tiles keep up
- [ ] Multiple players in same area - no conflicts

---

## Configuration Reference

### Final Recommended Settings

```javascript
// config.js
tiles: {
  errorTarget: 2,              // Base quality (managed by AdaptiveQuality)
  errorThreshold: Infinity,
  maxDownloadJobs: 60,
  maxParseJobs: 10,
  cacheMinBytes: 400 * 1e6,
  cacheMaxBytes: 700 * 1e6,
  optimizedLoadStrategy: true,
  loadSiblings: true
},

physics: {
  maxSpeed: 120,               // Reduced for tile streaming
  cruiseSpeed: 80,
  minSpeed: 30,
  throttleAccel: 30,
  idleThrottle: 0.3,
  drag: 0.008,
  // ... rest unchanged
}
```

---

## Success Metrics

After implementing this stage:

1. **Time to acceptable quality:** < 2 seconds when flying to new area at cruise speed
2. **Holes/missing tiles:** Never visible during normal gameplay
3. **Quality at cruise (80 m/s):** errorTarget 6-8 (good quality)
4. **Quality when slow (< 40 m/s):** errorTarget 2 (max quality)
5. **Frame rate:** Maintained 30+ fps
6. **Memory usage:** Stable under 800MB

---

## Rollback Plan

If any component causes issues:

1. **AdaptiveQuality:** Set to always return errorTarget=6 (static)
2. **PredictiveLoader:** Disable with `predictiveLoader.setEnabled(false)`
3. **FogManager:** Remove fog from scene `scene.fog = null`
4. **Speed changes:** Revert to previous physics values

All systems are designed to be independently toggleable.

---

## Files to Create

1. `src/core/AdaptiveQuality.js` - Dynamic error target
2. `src/core/PredictiveLoader.js` - Look-ahead tile loading
3. `src/core/FogManager.js` - Dynamic fog control
4. `src/ui/TileLoadingOverlay.js` - Loading feedback UI

## Files to Modify

1. `src/config.js` - New tile and physics settings
2. `src/core/TilesManager.js` - Enable optimized strategy
3. `src/core/Scene.js` - Add base fog
4. `src/player/Physics.js` - Throttle behavior changes
5. `src/main.js` - Integrate all systems

---

## References

- [3DTilesRendererJS optimizedLoadStrategy](https://github.com/NASA-AMMOS/3DTilesRendererJS)
- [Cesium 3D Tiles Streaming Optimizations](https://cesium.com/blog/2019/05/07/faster-3d-tiles/)
- [Google 3D Tiles Overview](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
