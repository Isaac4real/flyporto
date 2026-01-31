/**
 * MouseAimController - "Instructor" autopilot for mouse aim
 *
 * Converts mouse aim offset into pitch/roll commands that steer
 * the aircraft toward where the player is pointing.
 *
 * Similar to War Thunder's mouse aim system:
 * - Player points where they want to go
 * - Controller calculates optimal pitch/roll to get there
 * - Uses banking for horizontal turns (roll to turn)
 */

export class MouseAimController {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Control gains (how aggressively to steer)
    this.pitchGain = options.pitchGain ?? 2.0;   // Pitch response strength
    this.rollGain = options.rollGain ?? 2.5;     // Roll response strength

    // Smoothing
    this.responseSmoothing = options.responseSmoothing ?? 0.2;

    // Output limits
    this.maxPitchOutput = options.maxPitchOutput ?? 1.0;
    this.maxRollOutput = options.maxRollOutput ?? 1.0;

    // Dead zone - ignore very small offsets
    this.deadZone = options.deadZone ?? 0.02;

    // Smoothed outputs
    this.smoothedPitch = 0;
    this.smoothedRoll = 0;

    // Last calculated outputs (before smoothing)
    this.rawPitch = 0;
    this.rawRoll = 0;
  }

  /**
   * Calculate pitch/roll commands from mouse aim offset
   *
   * @param {Object} aimOffset - { pitch, yaw } normalized -1 to 1
   * @param {number} deltaTime - Time since last frame in seconds
   * @returns {Object} { pitch, roll } commands -1 to 1
   */
  calculate(aimOffset, deltaTime) {
    const { pitch: aimPitch, yaw: aimYaw } = aimOffset;

    // Apply dead zone
    const effectivePitch = Math.abs(aimPitch) > this.deadZone ? aimPitch : 0;
    const effectiveYaw = Math.abs(aimYaw) > this.deadZone ? aimYaw : 0;

    // Calculate raw control outputs
    // Pitch: Direct proportional control
    // Negative aim pitch (pointing down) = positive pitch input (dive)
    // The sign depends on the coordinate system - adjust as needed
    this.rawPitch = -effectivePitch * this.pitchGain;

    // Roll: Bank toward the aim direction
    // Positive aim yaw (pointing right) = negative roll input (bank right)
    // Roll creates coordinated turns via the physics system
    this.rawRoll = -effectiveYaw * this.rollGain;

    // Clamp to output limits
    this.rawPitch = Math.max(-this.maxPitchOutput, Math.min(this.maxPitchOutput, this.rawPitch));
    this.rawRoll = Math.max(-this.maxRollOutput, Math.min(this.maxRollOutput, this.rawRoll));

    // Apply smoothing for less twitchy response
    const smoothFactor = 1 - Math.pow(this.responseSmoothing, deltaTime * 60);
    this.smoothedPitch += (this.rawPitch - this.smoothedPitch) * smoothFactor;
    this.smoothedRoll += (this.rawRoll - this.smoothedRoll) * smoothFactor;

    return {
      pitch: this.smoothedPitch,
      roll: this.smoothedRoll
    };
  }

  /**
   * Reset controller state
   */
  reset() {
    this.smoothedPitch = 0;
    this.smoothedRoll = 0;
    this.rawPitch = 0;
    this.rawRoll = 0;
  }

  /**
   * Check if the controller is outputting significant values
   * @returns {boolean}
   */
  isActive() {
    return Math.abs(this.smoothedPitch) > 0.01 || Math.abs(this.smoothedRoll) > 0.01;
  }
}
