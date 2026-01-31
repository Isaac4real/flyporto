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

  // 3D Tiles renderer settings - OPTIMIZED for Stage 16
  tiles: {
    errorTarget: 2,              // Lower = faster high quality (was 6)
    errorThreshold: Infinity,    // Prevents tiles disappearing during camera movement
    maxDownloadJobs: 50,         // More parallel downloads (was 30)
    maxParseJobs: 10,            // Keep - GPU parsing is the bottleneck
    cacheMinBytes: 250 * 1e6,    // 250MB - bigger minimum cache (was 100MB)
    cacheMaxBytes: 500 * 1e6     // 500MB - allow more tiles in memory (was 400MB)
  },

  // Physics constants for arcade flight model
  // Tuned for smooth, responsive controls that feel good
  physics: {
    maxSpeed: 200,        // m/s (~390 knots) - faster feels better
    throttleAccel: 50,    // m/s² at full throttle - snappy response
    drag: 0.005,          // velocity-squared coefficient - much lower
    gravity: 9.81,        // m/s²
    liftFactor: 0.35,     // lift per velocity unit (equilibrium at ~28 m/s)
    minAltitude: 10,      // meters - forgiving ground collision

    // Base rotation rates (reduced - smoothing adds responsiveness)
    turnRate: 1.2,        // rad/s at max bank (coordinated turn)
    pitchRate: 0.8,       // rad/s at max pitch input
    rollRate: 1.8,        // rad/s at max roll input

    // Input smoothing rates (higher = faster response, lower = smoother)
    inputSmoothRate: 6.0,     // How fast actual input follows target (6 = ~85% in 0.3s)
    autoLevelRate: 3.0,       // How fast aircraft levels when no input
    throttleSmoothRate: 2.5,  // How fast throttle responds

    // Response curve (reduces sensitivity near center for precision)
    inputCurvePower: 0.4,     // 0 = linear, 1 = full cubic (0.4 is good balance)

    // Speed-dependent control authority
    cruiseSpeed: 100,         // Speed for full control authority
    minSpeedFactor: 0.4       // Minimum control authority at low speeds (40%)
  },

  // Aircraft visual settings
  aircraft: {
    scale: 2.0,           // Scale factor for aircraft meshes
    hitboxRadius: 25      // Base hitbox radius in meters (before scale)
  },

  // Combat settings
  combat: {
    fireRate: 5,            // shots per second
    fireCooldown: 200,      // ms between shots (1000 / fireRate)
    bulletRange: 800,       // meters
    tracerDuration: 150,    // ms
    tracerLength: 400,      // meters
    hitMarkerDuration: 300  // ms
  },

  // Debug settings
  debug: {
    showHitboxes: false,    // Set to true to see hitbox wireframes
    showTileStats: false    // Set to true to see tile loading stats
  }
};
