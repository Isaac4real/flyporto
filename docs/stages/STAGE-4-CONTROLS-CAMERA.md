# Stage 4: Controls & Camera

## Goal

Implement keyboard controls and a follow camera. After this stage, you'll have a playable flight experience on desktop.

**Estimated time:** 15-20 minutes

---

## Prerequisites

- Stage 3 completed and verified
- Aircraft flying with physics
- OrbitControls still in place (will be removed this stage)

---

## Context from Stage 3

You have an aircraft flying autonomously with hardcoded test input. In this stage, you will:
1. Create the KeyboardInput handler
2. Create the InputHandler (normalizer)
3. Create the CameraController (follow camera)
4. Remove OrbitControls
5. Connect keyboard input to physics

---

## Tasks

### Task 4.1: Create Keyboard Input Handler

Create `src/input/KeyboardInput.js` with:

**Responsibilities:**
- Listen for keydown/keyup events
- Track which keys are currently pressed
- Map keys to actions
- Provide current key state

**Key mappings:**
```javascript
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
```

**Implementation pattern:**
```javascript
class KeyboardInput {
  constructor() {
    this.pressedKeys = new Set();
    this.actions = {};

    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  onKeyDown(event) {
    // Prevent default for game keys (avoid scrolling, etc.)
    if (KEY_MAPPINGS[event.code]) {
      event.preventDefault();
      this.pressedKeys.add(event.code);
    }
  }

  onKeyUp(event) {
    this.pressedKeys.delete(event.code);
  }

  isActionActive(action) {
    // Check if any key mapped to this action is pressed
    for (const [code, mappedAction] of Object.entries(KEY_MAPPINGS)) {
      if (mappedAction === action && this.pressedKeys.has(code)) {
        return true;
      }
    }
    return false;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
```

### Task 4.2: Create Input Handler

Create `src/input/InputHandler.js` with:

**Responsibilities:**
- Combine inputs from keyboard (and later touch)
- Normalize to standard format: { pitch, roll, yaw, throttle }
- Handle throttle as accumulated value (not direct)

**Implementation:**
```javascript
class InputHandler {
  constructor(keyboardInput) {
    this.keyboard = keyboardInput;
    this.throttle = 0.5;  // Start at 50%
  }

  update(deltaTime) {
    // Throttle accumulates rather than being instant
    if (this.keyboard.isActionActive('throttleUp')) {
      this.throttle = Math.min(1, this.throttle + deltaTime);
    }
    if (this.keyboard.isActionActive('throttleDown')) {
      this.throttle = Math.max(0, this.throttle - deltaTime);
    }
  }

  getState() {
    let pitch = 0;
    let roll = 0;

    if (this.keyboard.isActionActive('pitchDown')) pitch = 1;
    if (this.keyboard.isActionActive('pitchUp')) pitch = -1;
    if (this.keyboard.isActionActive('rollLeft')) roll = -1;
    if (this.keyboard.isActionActive('rollRight')) roll = 1;

    const autoLevel = this.keyboard.isActionActive('autoLevel');

    return {
      pitch,
      roll,
      yaw: 0,  // No direct yaw control (comes from banking)
      throttle: this.throttle,
      autoLevel
    };
  }
}
```

### Task 4.3: Create Camera Controller

Create `src/player/CameraController.js` with:

**Responsibilities:**
- Follow behind and above the aircraft
- Smooth movement (damping)
- Look ahead of aircraft

**Parameters:**
```javascript
const CAMERA_CONFIG = {
  followDistance: 30,    // meters behind aircraft
  followHeight: 10,      // meters above aircraft
  damping: 3.0,          // smoothing factor (higher = faster follow)
  lookAheadDistance: 50  // meters ahead to look at
};
```

**Implementation:**
```javascript
class CameraController {
  constructor(camera, aircraft) {
    this.camera = camera;
    this.aircraft = aircraft;
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
  }

  update(deltaTime) {
    // Calculate ideal camera position
    const offset = new THREE.Vector3(0, CAMERA_CONFIG.followHeight, -CAMERA_CONFIG.followDistance);
    offset.applyEuler(this.aircraft.rotation);
    this.targetPosition.copy(this.aircraft.position).add(offset);

    // Calculate look-at point (ahead of aircraft)
    const lookAheadOffset = new THREE.Vector3(0, 0, CAMERA_CONFIG.lookAheadDistance);
    lookAheadOffset.applyEuler(this.aircraft.rotation);
    this.targetLookAt.copy(this.aircraft.position).add(lookAheadOffset);

    // Smooth interpolation
    const t = 1 - Math.exp(-CAMERA_CONFIG.damping * deltaTime);
    this.camera.position.lerp(this.targetPosition, t);

    // Look at target
    this.camera.lookAt(this.targetLookAt);
  }
}
```

### Task 4.4: Handle Auto-Level

Update `src/player/Physics.js` to handle the autoLevel input:

```javascript
function updatePhysics(aircraft, input, deltaTime) {
  // If autoLevel is pressed, aggressively level the aircraft
  if (input.autoLevel) {
    aircraft.rotation.z *= (1 - 5.0 * deltaTime);  // Fast roll correction
    aircraft.rotation.x *= (1 - 5.0 * deltaTime);  // Fast pitch correction
    return;  // Skip normal input processing
  }

  // ... rest of physics
}
```

### Task 4.5: Update Main.js

Refactor `src/main.js` to:

1. Remove OrbitControls import and usage
2. Create KeyboardInput instance
3. Create InputHandler instance
4. Create CameraController instance
5. Update game loop to:
   - Call inputHandler.update(deltaTime)
   - Get input state from inputHandler.getState()
   - Pass real input to physics (remove test input)
   - Call cameraController.update(deltaTime)

**New game loop structure:**
```javascript
function update(deltaTime) {
  // Input
  inputHandler.update(deltaTime);
  const input = inputHandler.getState();

  // Physics
  updatePhysics(aircraft, input, deltaTime);
  aircraft.updateMesh();

  // Camera
  cameraController.update(deltaTime);

  // Tiles (must be after camera update)
  camera.updateMatrixWorld();
  tilesManager.update();

  // Render
  renderer.render(scene, camera);
}
```

---

## Acceptance Criteria

After this stage, verify:

- [ ] W/Up Arrow pitches aircraft down (dive)
- [ ] S/Down Arrow pitches aircraft up (climb)
- [ ] A/Left Arrow rolls aircraft left (banks left)
- [ ] D/Right Arrow rolls aircraft right (banks right)
- [ ] Shift increases throttle
- [ ] Ctrl decreases throttle
- [ ] Space auto-levels the aircraft
- [ ] Camera follows behind aircraft smoothly
- [ ] Camera doesn't jitter during maneuvers
- [ ] Multiple keys can be pressed simultaneously
- [ ] OrbitControls are completely removed

---

## Verification Steps

1. Run `npm run dev`
2. Press W - aircraft should dive
3. Press S - aircraft should climb
4. Press A - aircraft should bank and turn left
5. Press D - aircraft should bank and turn right
6. Hold Shift - should accelerate
7. Hold Ctrl - should decelerate
8. Press Space during a bank - should level out
9. Press W+A together - should dive while turning left
10. Observe camera following smoothly
11. Do a rapid maneuver - camera should smooth out
12. Check console for errors

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/input/KeyboardInput.js` | Create | Keyboard event handling |
| `src/input/InputHandler.js` | Create | Input normalization |
| `src/player/CameraController.js` | Create | Follow camera |
| `src/player/Physics.js` | Modify | Add autoLevel handling |
| `src/main.js` | Modify | Wire up controls, remove OrbitControls |
| `src/config.js` | Modify | Add camera config |

---

## Input Handling Details

### Why Separate KeyboardInput and InputHandler?

- **KeyboardInput** deals with raw browser events and key codes
- **InputHandler** normalizes to game-meaningful values
- This separation allows adding TouchInput later (Stage 5) without changing physics

### Throttle Behavior

Throttle is **not** direct control - it accumulates over time:
- Holding Shift gradually increases throttle
- Holding Ctrl gradually decreases throttle
- This feels more like a real throttle lever

### Key Event Prevention

Prevent default on game keys to avoid:
- Scrolling from arrow keys
- Browser shortcuts from Ctrl
- Focus changes from Tab

```javascript
if (KEY_MAPPINGS[event.code]) {
  event.preventDefault();
}
```

---

## Camera Implementation Details

### Why Damping?

Without damping, the camera would rigidly follow the aircraft, which feels:
- Mechanical and unnatural
- Jarring during rapid maneuvers

With damping, the camera:
- Lags slightly behind
- Catches up smoothly
- Creates a more cinematic feel

### Damping Factor

The formula `t = 1 - Math.exp(-damping * deltaTime)` creates frame-rate-independent smoothing:
- Higher damping = faster follow (more rigid)
- Lower damping = slower follow (more cinematic)

Start with `damping: 3.0` and adjust based on feel.

### Look-Ahead

The camera looks at a point ahead of the aircraft, not at the aircraft itself. This:
- Shows where the aircraft is going
- Feels more natural for flight
- Helps players anticipate turns

---

## What NOT to Do in This Stage

- ❌ Do not implement touch controls yet (Stage 5)
- ❌ Do not implement HUD yet (Stage 5)
- ❌ Do not add sounds
- ❌ Do not add multiple camera modes (cockpit view, etc.)
- ❌ Do not implement joystick/gamepad support

---

## Common Issues

### Controls feel inverted

- Check the sign of pitch input
- W should be positive pitch (nose down) for most flight games
- Some players prefer inverted - consider making this configurable later

### Camera inside terrain

The current implementation doesn't prevent camera-terrain collision. Options:
- Accept it for MVP (terrain is usually below)
- Add raycast collision later
- Adjust follow distance/height

### Keyboard input not registering

- Check that keydown/keyup listeners are on `window`, not a specific element
- Check that preventDeafault isn't blocking needed keys
- Check that focus is on the page (click on the game first)

### Camera oscillates

- Damping factor too high can cause oscillation
- Reduce damping if camera bounces back and forth

---

## Handoff to Stage 5

After completing this stage:

1. Commit the code:
   ```bash
   git add .
   git commit -m "Stage 4: Controls & camera - Keyboard input and follow camera"
   ```

2. Update CLAUDE.md:
   - Note Stage 4 is complete
   - Document control mappings
   - Note that touch controls coming in Stage 5

3. **This is a major milestone!**
   - You now have a playable flight experience
   - Consider taking a video for build-in-public

---

## Suggested Build-in-Public Content

**Tweet after Stage 4 (the big one):**

```
Day 3: The moment I was building toward.

Flying through the Golden Gate Bridge. In your browser. Using real Google Maps data.

This is what's possible with AI-assisted development in 2026. 🌁✈️

[Attach video of Golden Gate fly-through]
```

This is your most shareable moment. Make sure to:
- Record a smooth fly-through of the bridge
- Keep video 15-20 seconds
- Add captions if possible

---

## Control Feel Tuning

If controls don't feel right, adjust in this order:

1. **Physics constants** (Stage 3) - pitchRate, rollRate, turnRate
2. **Input sensitivity** - multiply input values by a factor
3. **Camera damping** - adjust how tightly camera follows

Document any changes for consistency.
