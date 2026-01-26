# Stage 3: Flight Core

## Goal

Implement the aircraft state and arcade flight physics engine. After this stage, you'll have a flying object that responds to physics, though not yet controllable by keyboard.

**Estimated time:** 20-30 minutes

---

## Prerequisites

- Stage 2 completed and verified
- SF tiles rendering correctly
- OrbitControls working (will be replaced in Stage 4)

---

## Context from Stage 2

You have SF tiles rendering with orbit controls. In this stage, you will:
1. Create the Aircraft class (state management)
2. Create the Physics engine (arcade flight model)
3. Create the GameLoop module
4. Integrate physics with the scene
5. Have the aircraft move autonomously (for testing)

**Note:** OrbitControls will remain for now - we'll observe the aircraft moving while we can still orbit around to inspect it.

---

## Tasks

### Task 3.1: Create Aircraft Class

Create `src/player/Aircraft.js` with:

**State properties:**
- `position` (THREE.Vector3) - World position
- `rotation` (THREE.Euler) - Aircraft orientation
- `velocity` (THREE.Vector3) - Current velocity
- `throttle` (number 0-1) - Current throttle setting
- `forward` (THREE.Vector3) - Forward direction vector (computed)

**Methods:**
- `constructor(initialPosition)` - Initialize at starting position
- `getForwardVector()` - Returns normalized forward direction
- `getSpeed()` - Returns velocity magnitude in m/s
- `getAltitude(ellipsoid)` - Returns height above ellipsoid in meters
- `updateMatrices()` - Updates forward vector from rotation

**Optional mesh:**
- For now, use a simple arrow helper or box to visualize the aircraft
- A proper model can be added later

```javascript
// Simple visualization
const geometry = new THREE.ConeGeometry(5, 20, 8);
geometry.rotateX(Math.PI / 2);  // Point forward
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
this.mesh = new THREE.Mesh(geometry, material);
```

### Task 3.2: Create Physics Engine

Create `src/player/Physics.js` with:

**Constants (tunable):**
```javascript
const PHYSICS = {
  maxSpeed: 150,        // m/s (~290 knots)
  throttleAccel: 30,    // m/s² at full throttle
  drag: 0.02,           // velocity decay per frame
  gravity: 9.81,        // m/s²
  liftFactor: 0.015,    // lift per velocity unit
  turnRate: 1.5,        // rad/s at max bank
  pitchRate: 1.0,       // rad/s at max pitch input
  rollRate: 2.0,        // rad/s
  autoLevelRate: 0.5,   // how fast aircraft levels when no input
  minAltitude: 10       // meters - forgiving ground collision
};
```

**Main update function:**
```javascript
function updatePhysics(aircraft, input, deltaTime) {
  // input = { pitch, roll, yaw, throttle } each -1 to 1

  // 1. Apply thrust along forward vector
  // 2. Apply drag (proportional to velocity)
  // 3. Calculate lift (opposes gravity when moving)
  // 4. Apply gravity, offset by lift
  // 5. Apply rotation from controls
  // 6. Bank causes turn (yaw follows roll)
  // 7. Auto-level when no input
  // 8. Update position
  // 9. Clamp minimum altitude (forgiving collision)
}
```

**Key physics behaviors:**
- Thrust adds velocity in forward direction
- Drag reduces velocity each frame (multiplicative)
- Lift increases with speed, counters gravity
- Roll input banks the aircraft
- Banking causes turning (yaw follows roll angle)
- Pitch input changes climb/dive angle
- When no input, aircraft gradually levels out
- If altitude drops below minimum, bounce gently

### Task 3.3: Create Game Loop Module

Create `src/core/GameLoop.js` with:

**Responsibilities:**
- Manage requestAnimationFrame
- Calculate delta time (capped at 100ms to prevent jumps)
- Call update functions in correct order
- Track elapsed time

**Pattern:**
```javascript
class GameLoop {
  constructor() {
    this.lastTime = 0;
    this.callbacks = [];
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(currentTime) {
    if (!this.running) return;

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    for (const callback of this.callbacks) {
      callback(deltaTime);
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  addCallback(fn) {
    this.callbacks.push(fn);
  }
}
```

### Task 3.4: Integrate into Main

Update `src/main.js` to:

1. Create Aircraft instance at starting position
2. Add aircraft mesh to scene
3. Create GameLoop instance
4. Add update callback that:
   - Calls physics with test input (constant forward movement)
   - Updates aircraft mesh position/rotation
   - Updates camera matrix
   - Updates tiles
   - Renders

**Test input for this stage:**
```javascript
const testInput = {
  pitch: 0,
  roll: 0.1,    // Gentle turn to see it working
  yaw: 0,
  throttle: 0.5
};
```

This makes the aircraft fly in a gentle circle, visible while you use OrbitControls to observe.

### Task 3.5: Add Debug Visualization (Optional but Recommended)

Add helpers to visualize:
- Velocity vector (arrow showing direction of movement)
- Forward vector (arrow showing aircraft heading)
- A grid or reference plane (optional)

This helps debug physics issues.

---

## Acceptance Criteria

After this stage, verify:

- [ ] Aircraft mesh is visible in the scene
- [ ] Aircraft moves continuously (following physics)
- [ ] Aircraft turns gently (from test input roll)
- [ ] Can use OrbitControls to observe aircraft from different angles
- [ ] Aircraft maintains altitude (lift counters gravity)
- [ ] Physics feel smooth (no jittering)
- [ ] Delta time is capped (no huge jumps on tab switch)

---

## Verification Steps

1. Run `npm run dev`
2. Confirm aircraft mesh is visible near Golden Gate
3. Observe aircraft moving and turning
4. Use orbit controls to follow/observe aircraft
5. Check that altitude is stable (not falling through earth)
6. Switch tabs for a few seconds, return - should not have teleported far
7. Check console for errors

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/player/Aircraft.js` | Create | Aircraft state and mesh |
| `src/player/Physics.js` | Create | Arcade flight physics |
| `src/core/GameLoop.js` | Create | Animation loop management |
| `src/main.js` | Modify | Integrate new components |
| `src/config.js` | Modify | Add physics constants |

---

## Physics Implementation Details

### Thrust

```javascript
const thrustMagnitude = aircraft.throttle * PHYSICS.throttleAccel * deltaTime;
aircraft.velocity.addScaledVector(aircraft.forward, thrustMagnitude);
```

### Drag

```javascript
aircraft.velocity.multiplyScalar(1 - PHYSICS.drag);
```

### Lift and Gravity

```javascript
const speed = aircraft.velocity.length();
const lift = speed * PHYSICS.liftFactor;
const gravityEffect = (PHYSICS.gravity - lift) * deltaTime;
aircraft.velocity.y -= gravityEffect;
```

### Rotation from Input

```javascript
// Roll (bank)
aircraft.rotation.z += input.roll * PHYSICS.rollRate * deltaTime;

// Pitch
aircraft.rotation.x += input.pitch * PHYSICS.pitchRate * deltaTime;

// Yaw from bank angle
const bankAngle = aircraft.rotation.z;
aircraft.rotation.y += Math.sin(bankAngle) * PHYSICS.turnRate * deltaTime;
```

### Auto-Level

```javascript
if (input.roll === 0) {
  aircraft.rotation.z *= (1 - PHYSICS.autoLevelRate * deltaTime);
}
if (input.pitch === 0) {
  aircraft.rotation.x *= (1 - PHYSICS.autoLevelRate * deltaTime);
}
```

### Altitude Clamp

```javascript
const altitude = aircraft.getAltitude(ellipsoid);
if (altitude < PHYSICS.minAltitude) {
  // Bounce gently
  const correction = latLonAltToCartesian(
    currentLat, currentLon, PHYSICS.minAltitude, ellipsoid
  );
  aircraft.position.copy(correction);
  aircraft.velocity.y = Math.max(0, aircraft.velocity.y);
}
```

---

## What NOT to Do in This Stage

- ❌ Do not implement keyboard controls yet (Stage 4)
- ❌ Do not implement the follow camera yet (Stage 4)
- ❌ Do not remove OrbitControls yet (Stage 4)
- ❌ Do not add the HUD yet (Stage 5)
- ❌ Do not add touch controls yet (Stage 5)
- ❌ Do not add a detailed aircraft model (keep it simple for now)

---

## Common Issues

### Aircraft falls through earth

- Check lift calculation
- Check altitude is being computed correctly from ellipsoid
- Increase liftFactor

### Aircraft accelerates infinitely

- Check drag is being applied
- Check maxSpeed is being enforced

### Rotation feels wrong

- Remember: roll (z), pitch (x), yaw (y) in Three.js Euler
- Bank angle should cause yaw, not direct yaw from roll input
- Check rotation order if using Euler angles

### Physics are jittery

- Check deltaTime is capped
- Check updates are happening every frame
- Ensure physics doesn't depend on frame rate

---

## Handoff to Stage 4

After completing this stage:

1. Commit the code:
   ```bash
   git add .
   git commit -m "Stage 3: Flight core - Aircraft and arcade physics engine"
   ```

2. Update CLAUDE.md:
   - Note Stage 3 is complete
   - Document the physics tuning constants
   - Note that test input is hardcoded (will be replaced by keyboard)

3. **Take video for build-in-public (optional):**
   - Short clip of aircraft flying over SF
   - Save for later or post as teaser

---

## Suggested Build-in-Public Content

**Optional tweet after Stage 3:**

```
Day 2: Basic flight physics working.

Flying from Golden Gate to downtown SF. The physics are intentionally arcade-y—fun over realism.

All of this is real Google Maps 3D data streaming into Three.js. 🛩️

[Attach short video clip]
```

---

## Physics Tuning Notes

The constants provided are starting points. They may need adjustment:

| If | Then |
|----|------|
| Too slow | Increase maxSpeed, throttleAccel |
| Too fast | Decrease maxSpeed, throttleAccel |
| Falls too quickly | Increase liftFactor |
| Floats unnaturally | Decrease liftFactor |
| Turns too sharply | Decrease turnRate |
| Turns too slowly | Increase turnRate |
| Levels out too fast | Decrease autoLevelRate |
| Doesn't level out | Increase autoLevelRate |

Document any changes in config.js for future reference.
