import { CONFIG } from '../config.js';

const PHYSICS = CONFIG.physics;

/**
 * Linear interpolation toward target
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(current, target, t) {
  return current + (target - current) * Math.min(t, 1);
}

/**
 * Update aircraft physics based on input
 * @param {Aircraft} aircraft - The aircraft to update
 * @param {Object} input - Input state { pitch, roll, yaw, throttle, autoLevel } each -1 to 1
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updatePhysics(aircraft, input, deltaTime) {
  // Handle auto-level (panic button) - aggressively level the aircraft
  if (input.autoLevel) {
    // Use lerp for smooth, controlled leveling
    aircraft.rotation.z = lerp(aircraft.rotation.z, 0, 5.0 * deltaTime);
    aircraft.rotation.x = lerp(aircraft.rotation.x, 0, 5.0 * deltaTime);
    aircraft.updateMatrices();

    // Still apply velocity and position updates
    aircraft.velocity.multiplyScalar(1 - PHYSICS.drag);
    aircraft.position.addScaledVector(aircraft.velocity, deltaTime);
    enforceMinAltitude(aircraft);
    aircraft.updateMatrices();
    return;
  }

  // Ensure forward vector is current
  aircraft.updateMatrices();

  // 1. Update throttle from input (now absolute value 0-1 from InputHandler)
  aircraft.throttle = input.throttle;

  // 2. Apply thrust along forward vector
  const thrustMagnitude = aircraft.throttle * PHYSICS.throttleAccel * deltaTime;
  aircraft.velocity.addScaledVector(aircraft.forward, thrustMagnitude);

  // 3. Apply drag (proportional to velocity, multiplicative)
  aircraft.velocity.multiplyScalar(1 - PHYSICS.drag);

  // 4. Calculate lift based on speed and pitch angle
  const speed = aircraft.getSpeed();
  const pitch = aircraft.rotation.x;  // + = nose down, - = nose up

  // Speed-based lift foundation (equilibrium at ~100 m/s when level)
  const cruiseSpeed = 100;
  const speedFactor = Math.min(speed / cruiseSpeed, 1.2);

  // Pitch modifier: nose up (negative pitch) increases lift, nose down decreases it
  // sin(-0.3) ≈ -0.3, so pitchMod ≈ 1.6 (more lift, climb)
  // sin(+0.3) ≈ +0.3, so pitchMod ≈ 0.4 (less lift, descend)
  const pitchMod = 1 - Math.sin(pitch) * 2;

  // Final lift calculation (clamped to prevent negative lift)
  const lift = PHYSICS.gravity * speedFactor * Math.max(0.1, pitchMod);
  const gravityEffect = (PHYSICS.gravity - lift) * deltaTime;
  aircraft.velocity.y -= gravityEffect;

  // 5. Clamp to max speed
  if (speed > PHYSICS.maxSpeed) {
    aircraft.velocity.setLength(PHYSICS.maxSpeed);
  }

  // 6. Apply rotation from controls
  applyRotation(aircraft, input, deltaTime);

  // 7. Update position from velocity
  aircraft.position.addScaledVector(aircraft.velocity, deltaTime);

  // 8. Clamp minimum altitude (forgiving collision)
  enforceMinAltitude(aircraft);

  // 9. Final matrix update
  aircraft.updateMatrices();
}

/**
 * Apply rotation based on input with auto-level behavior
 * @param {Aircraft} aircraft
 * @param {Object} input
 * @param {number} deltaTime
 */
function applyRotation(aircraft, input, deltaTime) {
  // Roll (bank) - Z rotation
  if (input.roll !== 0) {
    // Apply roll input
    aircraft.rotation.z += input.roll * PHYSICS.rollRate * deltaTime;
    // Clamp roll to prevent excessive banking
    aircraft.rotation.z = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, aircraft.rotation.z));
  } else {
    // Auto-level roll when no input (use lerp for smooth return)
    aircraft.rotation.z = lerp(aircraft.rotation.z, 0, PHYSICS.autoLevelRate * deltaTime);
  }

  // Pitch - X rotation
  if (input.pitch !== 0) {
    // Apply pitch input
    aircraft.rotation.x += input.pitch * PHYSICS.pitchRate * deltaTime;
  } else {
    // Auto-level pitch when no input
    aircraft.rotation.x = lerp(aircraft.rotation.x, 0, PHYSICS.autoLevelRate * deltaTime);
  }

  // Clamp pitch to prevent over-rotation (±60 degrees)
  aircraft.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, aircraft.rotation.x));

  // Yaw from bank angle (coordinated turn)
  // Use tan(bank) for more realistic turn rate - steeper bank = tighter turn
  // Clamp to prevent extreme values at high bank angles
  const bankAngle = aircraft.rotation.z;
  const clampedTan = Math.max(-2, Math.min(2, Math.tan(bankAngle)));
  const turnRate = clampedTan * PHYSICS.turnRate * 0.5;
  aircraft.rotation.y += turnRate * deltaTime;

  // Direct yaw input (optional, for rudder-like control)
  if (input.yaw !== 0) {
    aircraft.rotation.y += input.yaw * PHYSICS.turnRate * 0.3 * deltaTime;
  }
}

/**
 * Enforce minimum altitude with gentle bounce
 * @param {Aircraft} aircraft
 */
function enforceMinAltitude(aircraft) {
  const altitude = aircraft.getAltitude();

  if (altitude < PHYSICS.minAltitude) {
    // Set to minimum altitude
    aircraft.position.y = PHYSICS.minAltitude;

    // Bounce: reverse and dampen vertical velocity
    if (aircraft.velocity.y < 0) {
      aircraft.velocity.y = Math.abs(aircraft.velocity.y) * 0.3;  // 30% bounce
    }

    // Gently level out when near ground
    aircraft.rotation.x = lerp(aircraft.rotation.x, 0, 0.1);
    aircraft.rotation.z = lerp(aircraft.rotation.z, 0, 0.1);
  }
}
