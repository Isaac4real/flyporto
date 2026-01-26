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

  // 3D Tiles renderer settings
  tiles: {
    errorTarget: 6,            // Lower = more detail at close range
    errorThreshold: Infinity,  // Prevents tiles disappearing during camera movement
    maxDownloadJobs: 30,
    maxParseJobs: 10,
    cacheMinBytes: 100 * 1e6,  // 100MB - keep more tiles in memory
    cacheMaxBytes: 400 * 1e6   // 400MB - allow more tiles to be cached
  },

  // Physics constants for arcade flight model
  // Tuned for "holy shit" factor - fake it, don't simulate it
  physics: {
    maxSpeed: 200,        // m/s (~390 knots) - faster feels better
    throttleAccel: 50,    // m/s² at full throttle - snappy response
    drag: 0.005,          // velocity-squared coefficient - much lower
    gravity: 9.81,        // m/s²
    liftFactor: 0.35,     // lift per velocity unit (equilibrium at ~28 m/s)
    turnRate: 1.5,        // rad/s at max bank
    pitchRate: 1.0,       // rad/s at max pitch input
    rollRate: 2.0,        // rad/s
    autoLevelRate: 1.0,   // snappier auto-level
    minAltitude: 10       // meters - forgiving ground collision
  }
};
