/**
 * MouseInput - Handles mouse input for flight control
 *
 * Uses Pointer Lock API for smooth, unlimited mouse movement.
 * Accumulates mouse deltas into aim pitch/yaw offsets that represent
 * where the player wants to fly (relative to current heading).
 */

export class MouseInput {
  /**
   * @param {HTMLElement} container - The game container element
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.enabled = true;

    // Configuration
    this.sensitivity = options.sensitivity ?? 0.15;  // Degrees per pixel
    this.smoothing = options.smoothing ?? 0.15;      // Input smoothing (0-1)
    this.invertY = options.invertY ?? false;
    this.maxPitchOffset = options.maxPitchOffset ?? 45;  // Max degrees from center
    this.maxYawOffset = options.maxYawOffset ?? 60;      // Max degrees from center
    this.returnSpeed = options.returnSpeed ?? 2.0;       // Speed aim returns to center

    // Current aim offset (where player is pointing relative to center)
    // These represent the "desired" direction as offset from current heading
    this.aimPitch = 0;  // Positive = up, negative = down
    this.aimYaw = 0;    // Positive = right, negative = left

    // Smoothed values for less twitchy response
    this.smoothedPitch = 0;
    this.smoothedYaw = 0;

    // Raw mouse delta accumulator (for this frame)
    this.deltaX = 0;
    this.deltaY = 0;

    // Pointer lock state
    this.isLocked = false;

    // Mouse button state
    this.leftButtonDown = false;
    this.rightButtonDown = false;

    // Bind handlers
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
    this.handleClick = this.handleClick.bind(this);

    // Set up event listeners
    this.setupListeners();
  }

  setupListeners() {
    // Mouse movement (only works when pointer is locked)
    document.addEventListener('mousemove', this.handleMouseMove);

    // Mouse buttons
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Click to request pointer lock
    this.container.addEventListener('click', this.handleClick);

    // Pointer lock state changes
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  /**
   * Request pointer lock on click
   */
  handleClick() {
    if (!this.isLocked && this.enabled) {
      this.container.requestPointerLock();
    }
  }

  /**
   * Handle pointer lock state changes
   */
  handlePointerLockChange() {
    this.isLocked = document.pointerLockElement === this.container;

    if (this.isLocked) {
      console.log('[MouseInput] Pointer locked - mouse control active');
    } else {
      console.log('[MouseInput] Pointer unlocked');
      // Reset aim to center when unlocked
      this.aimPitch = 0;
      this.aimYaw = 0;
    }
  }

  /**
   * Handle pointer lock errors
   */
  handlePointerLockError() {
    console.error('[MouseInput] Pointer lock failed');
  }

  /**
   * Handle mouse movement
   */
  handleMouseMove(event) {
    if (!this.isLocked || !this.enabled) return;

    // Accumulate movement for this frame
    this.deltaX += event.movementX;
    this.deltaY += event.movementY;
  }

  /**
   * Handle mouse button press
   */
  handleMouseDown(event) {
    if (event.button === 0) this.leftButtonDown = true;
    if (event.button === 2) this.rightButtonDown = true;
  }

  /**
   * Handle mouse button release
   */
  handleMouseUp(event) {
    if (event.button === 0) this.leftButtonDown = false;
    if (event.button === 2) this.rightButtonDown = false;
  }

  /**
   * Update mouse input state (call once per frame)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.enabled) return;

    // Convert accumulated mouse delta to aim offset
    if (this.isLocked) {
      // Apply sensitivity and invert Y if needed
      const yMultiplier = this.invertY ? 1 : -1;

      // Update aim offset (degrees)
      this.aimYaw += this.deltaX * this.sensitivity;
      this.aimPitch += this.deltaY * this.sensitivity * yMultiplier;

      // Clamp to max offset
      this.aimPitch = Math.max(-this.maxPitchOffset, Math.min(this.maxPitchOffset, this.aimPitch));
      this.aimYaw = Math.max(-this.maxYawOffset, Math.min(this.maxYawOffset, this.aimYaw));
    }

    // Reset delta accumulator for next frame
    this.deltaX = 0;
    this.deltaY = 0;

    // Smooth the aim values
    const smoothFactor = 1 - Math.pow(this.smoothing, deltaTime * 60);
    this.smoothedPitch += (this.aimPitch - this.smoothedPitch) * smoothFactor;
    this.smoothedYaw += (this.aimYaw - this.smoothedYaw) * smoothFactor;

    // Gradually return aim to center when no input (optional - creates "sticky" feel)
    // Disabled for now - let the instructor handle this
    // this.aimPitch *= Math.pow(0.95, deltaTime * 60);
    // this.aimYaw *= Math.pow(0.95, deltaTime * 60);
  }

  /**
   * Get normalized aim offset (-1 to 1 range)
   * @returns {Object} { pitch, yaw } normalized to -1 to 1
   */
  getAimOffset() {
    return {
      pitch: this.smoothedPitch / this.maxPitchOffset,
      yaw: this.smoothedYaw / this.maxYawOffset
    };
  }

  /**
   * Get raw aim offset in degrees
   * @returns {Object} { pitch, yaw } in degrees
   */
  getAimOffsetDegrees() {
    return {
      pitch: this.smoothedPitch,
      yaw: this.smoothedYaw
    };
  }

  /**
   * Check if mouse is providing active input
   * @returns {boolean}
   */
  isActive() {
    return this.isLocked && (
      Math.abs(this.smoothedPitch) > 0.5 ||
      Math.abs(this.smoothedYaw) > 0.5
    );
  }

  /**
   * Check if fire button (left click) is pressed
   * @returns {boolean}
   */
  isFiring() {
    return this.isLocked && this.leftButtonDown;
  }

  /**
   * Check if pointer is locked
   * @returns {boolean}
   */
  isPointerLocked() {
    return this.isLocked;
  }

  /**
   * Reset aim to center
   */
  resetAim() {
    this.aimPitch = 0;
    this.aimYaw = 0;
    this.smoothedPitch = 0;
    this.smoothedYaw = 0;
  }

  /**
   * Set sensitivity
   * @param {number} value - Sensitivity multiplier
   */
  setSensitivity(value) {
    this.sensitivity = value;
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    this.container.removeEventListener('click', this.handleClick);

    // Exit pointer lock if active
    if (this.isLocked) {
      document.exitPointerLock();
    }
  }
}
