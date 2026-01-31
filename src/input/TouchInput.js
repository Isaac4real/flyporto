/**
 * TouchInput - Mobile touch controls using nipplejs
 * Left joystick for pitch/roll, right side for throttle
 */

import nipplejs from 'nipplejs';

export class TouchInput {
  constructor(container) {
    this.pitch = 0;
    this.roll = 0;
    this.throttle = 0.7;  // Start at 70% to match keyboard
    this.throttleInput = 0;  // -1, 0, or 1
    this.firing = false;  // Fire button state
    this.enabled = false;
    this.leftJoystick = null;

    // Only enable on touch devices
    if (!this.isTouchDevice()) {
      return;
    }

    this.enabled = true;
    this.setupTouchZones(container);
    this.setupJoystick();
    this.setupThrottleZones();
    this.setupFireButton(container);
  }

  /**
   * Detect if device supports touch
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Create touch zone elements
   */
  setupTouchZones(container) {
    // Left zone for joystick
    this.leftZone = document.createElement('div');
    this.leftZone.id = 'touch-left';
    container.appendChild(this.leftZone);

    // Right zone for throttle
    this.rightZone = document.createElement('div');
    this.rightZone.id = 'touch-right';
    this.rightZone.innerHTML = `
      <div id="throttle-up" class="throttle-zone">
        <span>+</span>
      </div>
      <div id="throttle-down" class="throttle-zone">
        <span>-</span>
      </div>
    `;
    container.appendChild(this.rightZone);
  }

  /**
   * Setup left joystick using nipplejs
   */
  setupJoystick() {
    this.leftJoystick = nipplejs.create({
      zone: this.leftZone,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 120,
      threshold: 0.1,
      fadeTime: 100,
      restJoystick: true
    });

    this.leftJoystick.on('move', (evt, data) => {
      // data.vector.x: -1 to 1 (left to right)
      // data.vector.y: -1 to 1 (down to up)
      // In Three.js: positive rotation.z = bank LEFT, so invert for intuitive controls
      this.roll = -data.vector.x;  // Inverted: push right = bank right
      this.pitch = -data.vector.y;  // Inverted: push forward = pitch down (dive)
    });

    this.leftJoystick.on('end', () => {
      this.roll = 0;
      this.pitch = 0;
    });
  }

  /**
   * Setup throttle up/down zones
   */
  setupThrottleZones() {
    const throttleUp = document.getElementById('throttle-up');
    const throttleDown = document.getElementById('throttle-down');

    // Throttle up
    throttleUp.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.throttleInput = 1;
      throttleUp.classList.add('active');
    });
    throttleUp.addEventListener('touchend', () => {
      this.throttleInput = 0;
      throttleUp.classList.remove('active');
    });
    throttleUp.addEventListener('touchcancel', () => {
      this.throttleInput = 0;
      throttleUp.classList.remove('active');
    });

    // Throttle down
    throttleDown.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.throttleInput = -1;
      throttleDown.classList.add('active');
    });
    throttleDown.addEventListener('touchend', () => {
      this.throttleInput = 0;
      throttleDown.classList.remove('active');
    });
    throttleDown.addEventListener('touchcancel', () => {
      this.throttleInput = 0;
      throttleDown.classList.remove('active');
    });
  }

  /**
   * Update throttle based on input (call each frame)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (!this.enabled) return;

    // Accumulate throttle based on input
    if (this.throttleInput > 0) {
      this.throttle = Math.min(1, this.throttle + deltaTime);
    } else if (this.throttleInput < 0) {
      this.throttle = Math.max(0, this.throttle - deltaTime);
    }
  }

  /**
   * Setup fire button for combat
   */
  setupFireButton(container) {
    this.fireButton = document.createElement('div');
    this.fireButton.id = 'touch-fire';
    this.fireButton.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 50%;
      transform: translateY(50%);
      width: 80px;
      height: 80px;
      background: rgba(255, 50, 50, 0.5);
      border: 3px solid rgba(255, 100, 100, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      font-weight: bold;
      color: white;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      user-select: none;
      touch-action: none;
      z-index: 100;
    `;
    this.fireButton.textContent = 'FIRE';
    container.appendChild(this.fireButton);

    this.fireButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.firing = true;
      this.fireButton.style.background = 'rgba(255, 100, 100, 0.8)';
    });
    this.fireButton.addEventListener('touchend', () => {
      this.firing = false;
      this.fireButton.style.background = 'rgba(255, 50, 50, 0.5)';
    });
    this.fireButton.addEventListener('touchcancel', () => {
      this.firing = false;
      this.fireButton.style.background = 'rgba(255, 50, 50, 0.5)';
    });
  }

  /**
   * Check if fire button is being held
   * @returns {boolean}
   */
  isFiring() {
    return this.firing;
  }

  /**
   * Get current touch input state
   * @returns {Object} { pitch, roll, throttle }
   */
  getState() {
    return {
      pitch: this.pitch,
      roll: this.roll,
      throttle: this.throttle
    };
  }

  /**
   * Clean up touch controls
   */
  destroy() {
    if (this.leftJoystick) {
      this.leftJoystick.destroy();
    }
    if (this.leftZone && this.leftZone.parentNode) {
      this.leftZone.parentNode.removeChild(this.leftZone);
    }
    if (this.rightZone && this.rightZone.parentNode) {
      this.rightZone.parentNode.removeChild(this.rightZone);
    }
    if (this.fireButton && this.fireButton.parentNode) {
      this.fireButton.parentNode.removeChild(this.fireButton);
    }
  }
}
