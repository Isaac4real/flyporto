/**
 * InputHandler - Normalizes keyboard, touch, and mouse input to physics-ready state
 * Combines inputs from all sources into standard format for the physics engine.
 *
 * Priority order:
 * 1. Keyboard (direct control - overrides mouse aim when WASD pressed)
 * 2. Touch (mobile - overrides everything when active)
 * 3. Mouse aim (instructor autopilot - active when pointer locked)
 */

import { MouseAimController } from './MouseAimController.js';

export class InputHandler {
  constructor(keyboardInput, touchInput = null, mouseInput = null) {
    this.keyboard = keyboardInput;
    this.touch = touchInput;
    this.mouse = mouseInput;
    this.throttle = 0.7;  // Track throttle internally (0-1 range) - start high

    // Fire state tracking
    this.firePressed = false;
    this.fireJustPressed = false;

    // Mouse aim controller (instructor autopilot)
    this.mouseAimController = new MouseAimController({
      pitchGain: 2.0,
      rollGain: 2.5,
      responseSmoothing: 0.15,
      deadZone: 0.03
    });

    // Track whether keyboard is actively being used for flight control
    this.keyboardFlightActive = false;
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

    // Track if keyboard is being used for flight control
    this.keyboardFlightActive =
      this.keyboard.isActionActive('pitchDown') ||
      this.keyboard.isActionActive('pitchUp') ||
      this.keyboard.isActionActive('rollLeft') ||
      this.keyboard.isActionActive('rollRight');

    // Update fire state (keyboard, touch, or mouse)
    const wasPressed = this.firePressed;
    this.firePressed = this.keyboard.isActionActive('fire') ||
                       (this.touch?.enabled && this.touch.isFiring?.()) ||
                       (this.mouse?.isFiring?.());
    this.fireJustPressed = this.firePressed && !wasPressed;

    // Update touch input (handles its own throttle)
    if (this.touch && this.touch.enabled) {
      this.touch.update(deltaTime);
    }

    // Update mouse input
    if (this.mouse && this.mouse.enabled) {
      this.mouse.update(deltaTime);
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
    let usingKeyboard = false;

    // Pitch: In Three.js, positive rotation.x = nose UP
    // So pitchDown (dive) needs NEGATIVE value, pitchUp (climb) needs POSITIVE
    if (this.keyboard.isActionActive('pitchDown')) {
      pitch = -1;  // W = dive = nose down
      usingKeyboard = true;
    }
    if (this.keyboard.isActionActive('pitchUp')) {
      pitch = 1;   // S = climb = nose up
      usingKeyboard = true;
    }

    // Roll: In Three.js with -Z forward, positive rotation.z = bank LEFT
    // So rollLeft needs POSITIVE, rollRight needs NEGATIVE
    if (this.keyboard.isActionActive('rollLeft')) {
      roll = 1;    // A = bank left
      usingKeyboard = true;
    }
    if (this.keyboard.isActionActive('rollRight')) {
      roll = -1;   // D = bank right
      usingKeyboard = true;
    }

    // Get throttle value
    let throttle = this.throttle;

    // Merge with touch input if active (highest priority on mobile)
    if (this.touch && this.touch.enabled) {
      const touchState = this.touch.getState();

      // Touch overrides keyboard for pitch/roll when joystick is active
      if (touchState.pitch !== 0 || touchState.roll !== 0) {
        pitch = touchState.pitch;
        roll = touchState.roll;
        usingKeyboard = true;  // Treat touch like keyboard (overrides mouse aim)
      }

      // Use touch throttle when touch is enabled
      throttle = touchState.throttle;
    }

    // Apply mouse aim if active AND keyboard is not overriding
    if (!usingKeyboard && this.mouse && this.mouse.enabled && this.mouse.isPointerLocked()) {
      const aimOffset = this.mouse.getAimOffset();
      const mouseCommands = this.mouseAimController.calculate(aimOffset, 1/60);  // Approximate deltaTime

      pitch = mouseCommands.pitch;
      roll = mouseCommands.roll;
    } else if (usingKeyboard) {
      // Reset mouse aim controller when keyboard takes over
      // This prevents sudden jumps when switching back to mouse
      this.mouseAimController.reset();
    }

    return {
      pitch,
      roll,
      yaw: 0,  // No direct yaw control (comes from banking)
      throttle,  // Now absolute value (0-1)
      autoLevel: false  // Deprecated - Space is now fire
    };
  }

  /**
   * Check if fire button is being held
   * @returns {boolean}
   */
  isFiring() {
    return this.firePressed;
  }

  /**
   * Check if fire button was just pressed this frame
   * @returns {boolean}
   */
  isFireJustPressed() {
    return this.fireJustPressed;
  }

  /**
   * Get mouse aim offset for HUD display
   * @returns {Object|null} { pitch, yaw } in degrees, or null if mouse not active
   */
  getMouseAimOffset() {
    if (this.mouse && this.mouse.enabled && this.mouse.isPointerLocked()) {
      return this.mouse.getAimOffsetDegrees();
    }
    return null;
  }

  /**
   * Check if mouse pointer is locked
   * @returns {boolean}
   */
  isMouseLocked() {
    return this.mouse?.isPointerLocked() ?? false;
  }

  /**
   * Check if keyboard is currently controlling flight
   * @returns {boolean}
   */
  isKeyboardFlightActive() {
    return this.keyboardFlightActive;
  }
}
