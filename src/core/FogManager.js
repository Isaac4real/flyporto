/**
 * FogManager - Dynamically adjusts fog based on flight conditions
 *
 * Distance fog serves two purposes:
 * 1. Hides the horizon where tiles haven't loaded yet
 * 2. Creates depth and atmosphere
 *
 * The fog distance adjusts based on:
 * - Flight speed (faster = closer fog to hide unloaded tiles)
 * - Tile download queue (more tiles loading = closer fog)
 */
export class FogManager {
  /**
   * @param {THREE.Scene} scene - The scene containing the fog
   * @param {Object} config - Configuration options
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Base fog distances (when slow and tiles loaded)
    this.baseFogNear = config.baseFogNear ?? 4000;
    this.baseFogFar = config.baseFogFar ?? 10000;

    // Minimum fog distances (when fast or many tiles loading)
    this.minFogNear = config.minFogNear ?? 1500;
    this.minFogFar = config.minFogFar ?? 4000;

    // Current fog multiplier (1.0 = base distances)
    this.currentMultiplier = 1.0;

    // Smoothing rate (how fast fog adjusts)
    this.smoothingRate = config.smoothingRate ?? 2.0;

    // Speed threshold above which fog starts pulling in
    this.speedThreshold = config.speedThreshold ?? 60;  // m/s

    // Download queue threshold above which fog pulls in
    this.queueThreshold = config.queueThreshold ?? 25;

    // Enabled state
    this.enabled = config.enabled ?? true;
  }

  /**
   * Update fog based on current flight conditions
   * @param {number} speed - Current aircraft speed in m/s
   * @param {number} downloadQueueSize - Number of tiles waiting to download
   * @param {number} deltaTime - Frame delta time in seconds
   */
  update(speed, downloadQueueSize, deltaTime) {
    if (!this.enabled || !this.scene.fog) return;

    // Calculate target fog multiplier based on conditions
    let targetMultiplier = 1.0;

    // Speed factor: faster = closer fog (lower multiplier)
    if (speed > this.speedThreshold) {
      const speedExcess = speed - this.speedThreshold;
      const speedFactor = Math.max(0.4, 1 - speedExcess / 150);
      targetMultiplier *= speedFactor;
    }

    // Queue factor: more tiles loading = closer fog
    if (downloadQueueSize > this.queueThreshold) {
      const queueExcess = downloadQueueSize - this.queueThreshold;
      const queueFactor = Math.max(0.5, 1 - queueExcess / 80);
      targetMultiplier *= queueFactor;
    }

    // Smooth the transition
    const diff = targetMultiplier - this.currentMultiplier;
    const maxDelta = this.smoothingRate * deltaTime;
    this.currentMultiplier += Math.sign(diff) * Math.min(Math.abs(diff), maxDelta);

    // Clamp multiplier
    this.currentMultiplier = Math.max(0.3, Math.min(1.0, this.currentMultiplier));

    // Calculate actual fog distances
    const nearRange = this.baseFogNear - this.minFogNear;
    const farRange = this.baseFogFar - this.minFogFar;

    const targetNear = this.minFogNear + nearRange * this.currentMultiplier;
    const targetFar = this.minFogFar + farRange * this.currentMultiplier;

    // Apply to scene fog
    this.scene.fog.near = targetNear;
    this.scene.fog.far = targetFar;
  }

  /**
   * Get current fog distances for debugging
   * @returns {{ near: number, far: number }}
   */
  getFogDistances() {
    if (!this.scene.fog) return { near: 0, far: 0 };
    return {
      near: Math.round(this.scene.fog.near),
      far: Math.round(this.scene.fog.far)
    };
  }

  /**
   * Enable or disable dynamic fog adjustment
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.scene.fog) {
      // Reset to base distances when disabled
      this.scene.fog.near = this.baseFogNear;
      this.scene.fog.far = this.baseFogFar;
      this.currentMultiplier = 1.0;
    }
  }

  /**
   * Remove fog entirely from the scene
   */
  removeFog() {
    this.scene.fog = null;
  }

  /**
   * Restore fog to the scene
   */
  restoreFog() {
    if (!this.scene.fog) {
      const skyColor = 0x87CEEB;
      this.scene.fog = new THREE.Fog(skyColor, this.baseFogNear, this.baseFogFar);
    }
  }
}
