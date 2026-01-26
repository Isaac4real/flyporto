/**
 * KeyboardInput - Raw keyboard event handling with key-to-action mapping
 */

const KEY_MAPPINGS = {
  // Pitch
  'KeyW': 'pitchDown',
  'ArrowUp': 'pitchDown',
  'KeyS': 'pitchUp',
  'ArrowDown': 'pitchUp',

  // Roll
  'KeyA': 'rollLeft',
  'ArrowLeft': 'rollLeft',
  'KeyD': 'rollRight',
  'ArrowRight': 'rollRight',

  // Throttle
  'ShiftLeft': 'throttleUp',
  'ShiftRight': 'throttleUp',
  'ControlLeft': 'throttleDown',
  'ControlRight': 'throttleDown',

  // Special
  'Space': 'autoLevel'
};

export class KeyboardInput {
  constructor() {
    this.pressedKeys = new Set();

    // Bind handlers to preserve 'this' context
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
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
   * Clean up event listeners
   */
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
