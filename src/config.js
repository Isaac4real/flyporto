/**
 * Configuration constants for SF Flight Simulator
 */
export const CONFIG = {
  // Starting position: Golden Gate Bridge
  startPosition: {
    lat: 37.8199,
    lon: -122.4783,
    altitude: 500  // meters
  },

  // Camera settings
  camera: {
    fov: 60,
    near: 1,       // 1 meter
    far: 1e12,     // CRITICAL: Must be very large for globe viewing
    follow: {
      distance: 80,    // meters behind aircraft
      height: 25,      // meters above aircraft
      damping: 2.0,    // smoothing factor (higher = faster follow)
      lookAhead: 100   // meters ahead to look at
    }
  },

  // 3D Tiles renderer settings - OPTIMIZED for Stage 16 + Stage 18
  tiles: {
    errorTarget: 2,              // Base quality (managed by AdaptiveQuality at runtime)
    errorThreshold: Infinity,    // Prevents tiles disappearing during camera movement
    maxDownloadJobs: 60,         // Increased from 50 for faster tile loading
    maxParseJobs: 10,            // Keep - GPU parsing is the bottleneck
    cacheMinBytes: 400 * 1e6,    // 400MB - increased from 250MB
    cacheMaxBytes: 700 * 1e6,    // 700MB - increased from 500MB

    // Stage 18: Optimized load strategy
    optimizedLoadStrategy: true, // Tiles load independently (faster for flight)
    loadSiblings: true           // Prevent gaps during camera movement
  },

  // Physics constants for arcade flight model
  // V2 OVERHAUL - Deep match to fly.pieter.com (NO INPUT SMOOTHING)
  physics: {
    maxSpeed: 150,        // m/s (~540 km/h)
    cruiseSpeed: 80,      // Comfortable cruise where tiles load smoothly
    minSpeed: 0,          // Allow full stop like fly.pieter.com

    // Throttle - direct increment style like fly.pieter.com
    throttleAccel: 50,        // Base acceleration
    decelMultiplier: 8,       // 8x faster decel when releasing throttle (fly.pieter.com)
    drag: 0.005,              // Light drag

    // Gravity/lift - velocity-based physics
    gravity: 9.81,            // m/s²
    takeoffSpeed: 40,         // m/s - hard gate for lift and pitch control
    minAltitude: 10,          // meters - forgiving ground collision

    // Rotation - match fly.pieter.com exactly
    pitchRate: 0.9,           // rad/s - fly.pieter.com pitchSpeed
    rollRate: 1.44,           // rad/s - fly.pieter.com rollSpeed
    turnRate: 5,              // rad/s - fly.pieter.com yawRate (yaw while rolling)
    autoLevelRate: 0.9,       // rad/s - fly.pieter.com rollRecoverySpeed (linear, not exponential)

    // Rotation limits - fly.pieter.com values
    maxRoll: Math.PI / 2,     // 90 degrees
    maxPitch: 1.5,            // ~86 degrees

    // NO INPUT SMOOTHING - direct input like fly.pieter.com
    directInput: true,        // Flag: use direct input mode (no smoothDamp)

    // Legacy values (kept for compatibility but not used when directInput=true)
    inputSmoothRate: 10.0,
    pitchSmoothMultiplier: 1.5,
    inputCurvePower: 0,       // Linear input - no response curve
    minSpeedFactor: 0.2
  },

  // Aircraft visual settings
  aircraft: {
    scale: 2.0,           // Scale factor for aircraft meshes
    hitboxRadius: 25,     // Base hitbox radius in meters (before scale)

    // Available aircraft types (Ikram's Low Poly Fighter Jets - CC-BY-4.0)
    types: {
      jet1: { id: 'jet1', name: 'Fighter Jet', description: 'Sleek combat fighter' },
      jet2: { id: 'jet2', name: 'Strike Fighter', description: 'Heavy attack fighter' },
      plane1: { id: 'plane1', name: 'Light Aircraft', description: 'Agile propeller plane' },
      plane2: { id: 'plane2', name: 'Sport Plane', description: 'Fast sport aircraft' },
      plane3: { id: 'plane3', name: 'Trainer', description: 'Versatile trainer' }
    },

    defaultType: 'jet1',

    // Available accent colors
    colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
  },

  // Combat settings - fly.pieter.com values
  combat: {
    fireRate: 10,           // shots per second (fly.pieter.com: FIRE_RATE = 10)
    fireCooldown: 100,      // ms between shots (1000 / 10)
    bulletRange: 800,       // meters
    tracerDuration: 150,    // ms
    tracerLength: 400,      // meters
    hitMarkerDuration: 300  // ms
  },

  // Adaptive quality settings (Stage 18)
  // Dynamically adjusts tile quality based on flight speed
  adaptiveQuality: {
    minErrorTarget: 2,          // Best quality (when slow/stationary)
    maxErrorTarget: 20,         // Fastest loading (when flying fast)
    speedThresholdLow: 40,      // Below this speed = max quality
    speedThresholdHigh: 130,    // Above this speed = min quality
    smoothingRate: 3.0          // How fast quality adjusts (units/second)
  },

  // Predictive tile loading (Stage 18)
  // Pre-loads tiles in flight direction
  predictiveLoading: {
    enabled: true,
    updateInterval: 300,        // ms between predictive updates
    minSpeedThreshold: 30,      // Don't predict below this speed (m/s)
    lookAheadDistances: [400, 800, 1500]  // Base look-ahead distances in meters
  },

  // Dynamic fog (Stage 18)
  // Hides unloaded tiles at the horizon
  fog: {
    enabled: true,
    baseFogNear: 4000,          // Start fog at 4km when slow
    baseFogFar: 10000,          // Full fog at 10km when slow
    minFogNear: 1500,           // Closest fog starts (when fast)
    minFogFar: 4000             // Closest full fog (when fast)
  },

  // Mouse aim settings (War Thunder-style mouse flight control)
  mouse: {
    sensitivity: 0.15,       // Degrees per pixel of mouse movement
    smoothing: 0.15,         // Input smoothing (0 = none, 1 = very smooth)
    maxPitchOffset: 45,      // Max vertical aim offset in degrees
    maxYawOffset: 60,        // Max horizontal aim offset in degrees
    invertY: false,          // Invert vertical mouse axis
    instructorPitchGain: 2.0, // How aggressively to pitch toward aim
    instructorRollGain: 2.5   // How aggressively to bank toward aim
  },

  // Debug settings
  debug: {
    showHitboxes: false,      // Set to true to see hitbox wireframes
    showTileStats: false,     // Set to true to see tile loading stats
    showCheckpoints: false    // Set to true to see checkpoint trigger volumes
  },

  // Checkpoint racing settings (Stage 19)
  checkpoints: {
    enabled: true,
    triggerRadius: 100,       // Default trigger radius in meters
    aircraftRadius: 20        // Aircraft bounding radius for collision
  },

  // Share settings (Stage 20)
  share: {
    gameUrl: 'https://flysf.io',
    twitterHashtags: ['flysf', 'flightsim', 'sanfrancisco'],
    twitterVia: null,         // Set to Twitter handle without @ (optional)
    brandingText: 'FLYSF.IO'
  }
};
