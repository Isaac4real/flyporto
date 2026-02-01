/**
 * KeyboardInput - Raw keyboard event handling with key-to-action mapping
 */

const KEY_MAPPINGS = {
  // Pitch
  'KeyW': 'pitchDown',
  'KeyS': 'pitchUp',

  // Roll
  'KeyA': 'rollLeft',
  'KeyD': 'rollRight',

  // Throttle (arrows, shift, ctrl)
  'ArrowUp': 'throttleUp',
  'ShiftLeft': 'throttleUp',
  'ShiftRight': 'throttleUp',
  'ArrowDown': 'throttleDown',
  'ControlLeft': 'throttleDown',
  'ControlRight': 'throttleDown',

  // Combat
  'Space': 'fire',
  'KeyF': 'fire'
};

export class KeyboardInput {
  constructor() {
    this.pressedKeys = new Set();

    // Bind handlers to preserve 'this' context
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleBlur);
  }

  handleKeyDown(event) {
    // Prevent default for game keys (avoid scrolling, browser shortcuts)
    if (KEY_MAPPINGS[event.code]) {
      event.preventDefault();
      this.pressedKeys.add(event.code);
    }
  }

  handleKeyUp(event) {
    this.pressedKeys.delete(event.code);
  }

  handleBlur() {
    // Clear stuck keys when focus is lost or tab is hidden
    this.pressedKeys.clear();
  }

  /**
   * Check if any key mapped to this action is currently pressed
   * @param {string} action - Action name (e.g., 'pitchDown', 'rollLeft')
   * @returns {boolean}
   */
  isActionActive(action) {
    for (const [code, mappedAction] of Object.entries(KEY_MAPPINGS)) {
      if (mappedAction === action && this.pressedKeys.has(code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a specific key code is currently pressed
   * @param {string} code - Key code (e.g., 'Space', 'KeyF')
   * @returns {boolean}
   */
  isKeyDown(code) {
    return this.pressedKeys.has(code);
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleBlur);
  }
}
