/**
 * PositionBuffer - buffers position updates for smooth interpolation
 *
 * Renders slightly in the past to always have two points to interpolate between,
 * eliminating jitter caused by network timing variations.
 */
export class PositionBuffer {
  /**
   * @param {number} bufferSize - Number of samples to keep in buffer
   */
  constructor(bufferSize = 4) {
    this.bufferSize = bufferSize;
    this.buffer = [];  // Array of { position, rotation, velocity, timestamp }
  }

  /**
   * Add a new position update to the buffer
   * @param {Object} state - { position, rotation, velocity, timestamp }
   */
  push(state) {
    this.buffer.push({
      position: { ...state.position },
      rotation: { ...state.rotation },
      velocity: state.velocity ? { ...state.velocity } : { x: 0, y: 0, z: 0 },
      timestamp: state.timestamp || Date.now()
    });

    // Keep buffer size limited
    while (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get interpolated state at current render time
   * Renders slightly in the past to have two points to interpolate between
   * @param {number} renderDelay - How far in the past to render (ms)
   * @returns {Object|null} Interpolated state or null if buffer empty
   */
  getInterpolatedState(renderDelay = 100) {
    if (this.buffer.length === 0) {
      return null;
    }

    if (this.buffer.length === 1) {
      return this.buffer[0];
    }

    // Render time is slightly in the past
    const renderTime = Date.now() - renderDelay;

    // Find the two states to interpolate between
    let older = null;
    let newer = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime &&
          this.buffer[i + 1].timestamp >= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1];
        break;
      }
    }

    // If we're ahead of all buffered states, extrapolate from the latest
    if (!older && !newer && this.buffer.length >= 2) {
      const latest = this.buffer[this.buffer.length - 1];

      // Extrapolate using velocity
      const dt = (renderTime - latest.timestamp) / 1000;
      const maxExtrapolate = 0.2;  // Max 200ms extrapolation

      if (dt > 0 && dt < maxExtrapolate) {
        return {
          position: {
            x: latest.position.x + latest.velocity.x * dt,
            y: latest.position.y + latest.velocity.y * dt,
            z: latest.position.z + latest.velocity.z * dt
          },
          rotation: latest.rotation,
          velocity: latest.velocity,
          timestamp: renderTime
        };
      }

      return latest;
    }

    // If we're behind all buffered states, return oldest
    if (!older) {
      return this.buffer[0];
    }

    // Interpolate between older and newer
    const t = (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      position: {
        x: this.lerp(older.position.x, newer.position.x, clampedT),
        y: this.lerp(older.position.y, newer.position.y, clampedT),
        z: this.lerp(older.position.z, newer.position.z, clampedT)
      },
      rotation: {
        x: this.lerpAngle(older.rotation.x, newer.rotation.x, clampedT),
        y: this.lerpAngle(older.rotation.y, newer.rotation.y, clampedT),
        z: this.lerpAngle(older.rotation.z, newer.rotation.z, clampedT)
      },
      velocity: newer.velocity,
      timestamp: renderTime
    };
  }

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Angle interpolation with wraparound handling
   */
  lerpAngle(a, b, t) {
    let delta = b - a;
    // Handle angle wraparound
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return a + delta * t;
  }

  /**
   * Check if buffer has recent data
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean}
   */
  hasRecentData(maxAge = 2000) {
    if (this.buffer.length === 0) return false;
    const latest = this.buffer[this.buffer.length - 1];
    return Date.now() - latest.timestamp < maxAge;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
  }
}
