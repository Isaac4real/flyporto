/**
 * Configuration constants for SF Flight Simulator
 */
export const CONFIG = {
  // Starting position: ~1.3km northwest of Golden Gate Bridge (facing it)
  startPosition: {
    lat: 37.8297,
    lon: -122.4895,
    altitude: 400,  // meters
    heading: 225    // degrees clockwise from north (225 = southwest, toward bridge)
  },

  // Camera settings
  camera: {
    fov: 60,
    near: 1,       // 1 meter
    far: 1e12,     // CRITICAL: Must be very large for globe viewing
    follow: {
      distance: 150,   // meters behind aircraft
      height: 40,      // meters above aircraft
      damping: 2.0,    // smoothing factor (higher = faster follow)
      lookAhead: 120   // meters ahead to look at
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
  physics: {
    maxSpeed: 150,           // m/s (~290 knots) - cap for gameplay + streaming
    cruiseSpeed: 80,         // m/s - comfortable cruise for tiles
    minSpeed: 0,             // m/s - allow full stop on runway
    takeoffSpeed: 25,        // m/s - lift/pitch authority below this is limited
    startSpeed: 60,          // m/s - initial spawn speed

    throttleAccel: 25,       // m/s² at full throttle
    throttleChangeRate: 3.0, // Throttle change per second from key input
    drag: 0.06,              // Proportional speed decay per second
    gravityFactor: 9.81,     // m/s² applied as downward velocity change
    liftFactor: 0.12,        // Lift scalar (speed * liftFactor ~= gravity at cruise)
    minAltitude: 10,         // meters - forgiving ground collision

    // Rotation rates (arcade feel)
    turnRate: 2.4,           // rad/s at max bank (coordinated turn)
    pitchRate: 1.6,          // rad/s at max pitch input
    rollRate: 2.8,           // rad/s at max roll input
    maxPitch: 0.6,           // radians (~34°)
    maxRoll: 1.2,            // radians (~69°)
    rollRecoveryRate: 3.0,   // How fast roll returns to level when no input

    // Input smoothing rates (higher = faster response, lower = smoother)
    inputSmoothRate: 12.0,   // Smooth but responsive
    autoLevelRate: 3.0,      // Reserved for future auto-leveling
    throttleSmoothRate: 4.0, // How fast throttle responds

    // Response curve (reduces sensitivity near center for precision)
    inputCurvePower: 0.15,   // Nearly linear for direct control feel

    // Speed-dependent control authority
    minSpeedFactor: 0.7,     // Minimum control authority at low speeds (70%)

    // Fixed timestep settings (physics determinism)
    fixedStep: 1 / 60,
    maxSubSteps: 5
  },

  // Aircraft visual settings
  aircraft: {
    scale: 0.075,             // Scale factor for aircraft meshes (reduced from 0.15)
    mobileScaleMultiplier: 0.7,  // 30% smaller on mobile devices
    hitboxRadius: 25,         // Base hitbox radius in meters (before scale)

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
    enabled: false,
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
    showFlightStats: false    // Set to true to see pitch/roll/vertical speed
  },

  // Share settings (for social sharing)
  share: {
    gameUrl: 'https://fly.alistairmcleay.com',
    twitterHashtags: ['flysf', 'flightsim', 'sanfrancisco'],
    twitterVia: 'alistairmcleay',
    brandingText: 'FLY.ALISTAIRMCLEAY.COM'
  }
};
