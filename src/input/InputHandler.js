/**
 * InputHandler - Normalizes keyboard and touch input to physics-ready state
 * Combines inputs from keyboard and touch into standard format
 */

export class InputHandler {
  constructor(keyboardInput, touchInput = null) {
    this.keyboard = keyboardInput;
    this.touch = touchInput;
    this.throttle = 0.7;  // Track throttle internally (0-1 range) - start high
  }

  /**
   * Update input state (call each frame)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Update keyboard throttle
    if (this.keyboard.isActionActive('throttleUp')) {
      this.throttle = Math.min(1, this.throttle + deltaTime);
    }
    if (this.keyboard.isActionActive('throttleDown')) {
      this.throttle = Math.max(0, this.throttle - deltaTime);
    }

    // Update touch input (handles its own throttle)
    if (this.touch && this.touch.enabled) {
      this.touch.update(deltaTime);
    }
  }

  /**
   * Get normalized input state for physics engine
   * @returns {Object} { pitch, roll, yaw, throttle, autoLevel }
   */
  getState() {
    // Start with keyboard input
    let pitch = 0;
    let roll = 0;

    // Pitch: In Three.js, positive rotation.x = nose UP
    // So pitchDown (dive) needs NEGATIVE value, pitchUp (climb) needs POSITIVE
    if (this.keyboard.isActionActive('pitchDown')) pitch = -1;  // W = dive = nose down
    if (this.keyboard.isActionActive('pitchUp')) pitch = 1;     // S = climb = nose up

    // Roll: In Three.js with -Z forward, positive rotation.z = bank LEFT
    // So rollLeft needs POSITIVE, rollRight needs NEGATIVE
    if (this.keyboard.isActionActive('rollLeft')) roll = 1;     // A = bank left
    if (this.keyboard.isActionActive('rollRight')) roll = -1;   // D = bank right

    // Get throttle value
    let throttle = this.throttle;

    // Merge with touch input if active
    if (this.touch && this.touch.enabled) {
      const touchState = this.touch.getState();

      // Touch overrides keyboard for pitch/roll when joystick is active
      if (touchState.pitch !== 0 || touchState.roll !== 0) {
        pitch = touchState.pitch;
        roll = touchState.roll;
      }

      // Use touch throttle when touch is enabled
      throttle = touchState.throttle;
    }

    const autoLevel = this.keyboard.isActionActive('autoLevel');

    return {
      pitch,
      roll,
      yaw: 0,  // No direct yaw control (comes from banking)
      throttle,  // Now absolute value (0-1)
      autoLevel
    };
  }
}
