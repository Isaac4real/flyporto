/**
 * AdaptiveQuality - Dynamically adjusts tile quality based on flight speed
 *
 * The core insight: when moving fast, tiles need to load quickly even at lower
 * quality. When slow/stationary, we can demand higher quality since tiles have
 * time to stream in at full resolution.
 *
 * Speed thresholds and error targets:
 * - Slow (0-50 m/s): errorTarget 2-4 (max quality)
 * - Cruise (50-100 m/s): errorTarget 4-10 (balanced)
 * - Fast (100-150 m/s): errorTarget 10-20 (prioritize loading)
 * - Very fast (150+ m/s): errorTarget 20-24 (accept lower quality)
 */
export class AdaptiveQuality {
  /**
   * @param {TilesRenderer} tilesRenderer - The 3D tiles renderer instance
   * @param {Object} config - Configuration options
   */
  constructor(tilesRenderer, config = {}) {
    this.tilesRenderer = tilesRenderer;

    // Quality bounds
    this.minErrorTarget = config.minErrorTarget ?? 2;    // Best quality (slow/stationary)
    this.maxErrorTarget = config.maxErrorTarget ?? 24;   // Fastest loading (high speed)

    // Speed thresholds in m/s
    this.speedThresholdLow = config.speedThresholdLow ?? 50;    // Below this = max quality
    this.speedThresholdHigh = config.speedThresholdHigh ?? 150; // Above this = min quality

    // Smoothing to prevent rapid oscillation
    this.currentErrorTarget = this.minErrorTarget;
    this.smoothingRate = config.smoothingRate ?? 3.0;  // Units per second

    // Progressive quality improvement when stationary
    this.stationaryTime = 0;
    this.stationaryThreshold = 10;  // m/s - considered stationary below this

    // Track for debugging
    this.lastSpeed = 0;
    this.targetErrorTarget = this.minErrorTarget;
  }

  /**
   * Update adaptive quality based on current aircraft speed
   * @param {number} speed - Current aircraft speed in m/s
   * @param {number} deltaTime - Frame delta time in seconds
   */
  update(speed, deltaTime) {
    this.lastSpeed = speed;

    // Calculate target error based on speed
    let targetError;

    if (speed <= this.speedThresholdLow) {
      // Slow - demand high quality
      targetError = this.minErrorTarget;
    } else if (speed >= this.speedThresholdHigh) {
      // Fast - accept lower quality for faster loading
      targetError = this.maxErrorTarget;
    } else {
      // Interpolate between thresholds (linear mapping)
      const t = (speed - this.speedThresholdLow) /
                (this.speedThresholdHigh - this.speedThresholdLow);
      targetError = this.minErrorTarget + t * (this.maxErrorTarget - this.minErrorTarget);
    }

    // Track stationary time for progressive quality boost
    if (speed < this.stationaryThreshold) {
      this.stationaryTime += deltaTime;

      // When stationary for a while, progressively demand even higher quality
      if (this.stationaryTime > 2.0) {
        const extraQuality = (this.stationaryTime - 2.0) * 0.3;
        targetError = Math.max(1, targetError - extraQuality);
      }
    } else {
      this.stationaryTime = 0;
    }

    this.targetErrorTarget = targetError;

    // Smooth the transition
    // Increase errorTarget (lower quality) faster than decrease (higher quality)
    // This ensures we don't demand quality we can't deliver when speeding up
    const diff = targetError - this.currentErrorTarget;
    const rate = diff > 0
      ? this.smoothingRate * 2  // Faster when reducing quality (speeding up)
      : this.smoothingRate;     // Slower when increasing quality (slowing down)

    this.currentErrorTarget += Math.sign(diff) * Math.min(Math.abs(diff), rate * deltaTime);

    // Clamp to bounds
    this.currentErrorTarget = Math.max(
      this.minErrorTarget,
      Math.min(this.maxErrorTarget, this.currentErrorTarget)
    );

    // Apply to tiles renderer
    this.tilesRenderer.errorTarget = Math.round(this.currentErrorTarget);
  }

  /**
   * Get current error target (for debugging/HUD)
   * @returns {number}
   */
  getErrorTarget() {
    return Math.round(this.currentErrorTarget);
  }

  /**
   * Get target error target before smoothing (for debugging)
   * @returns {number}
   */
  getTargetErrorTarget() {
    return Math.round(this.targetErrorTarget);
  }

  /**
   * Get current quality level as a descriptive string
   * @returns {string}
   */
  getQualityLevel() {
    const error = this.currentErrorTarget;
    if (error <= 4) return 'Ultra';
    if (error <= 8) return 'High';
    if (error <= 14) return 'Medium';
    if (error <= 20) return 'Low';
    return 'Minimum';
  }

  /**
   * Force a specific error target (for debugging)
   * @param {number} errorTarget
   */
  forceErrorTarget(errorTarget) {
    this.currentErrorTarget = errorTarget;
    this.tilesRenderer.errorTarget = errorTarget;
  }

  /**
   * Reset to default state
   */
  reset() {
    this.currentErrorTarget = this.minErrorTarget;
    this.stationaryTime = 0;
    this.tilesRenderer.errorTarget = this.minErrorTarget;
  }
}
