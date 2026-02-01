import { CONFIG } from '../config.js';

const PHYSICS = CONFIG.physics;

/**
 * Frame-rate independent exponential smoothing (smooth damp)
 * Properly handles variable deltaTime unlike naive lerp
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} rate - Smoothing rate (higher = faster convergence)
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {number} Smoothed value
 */
function smoothDamp(current, target, rate, deltaTime) {
  // Exponential decay: approaches target asymptotically
  // At rate=1, moves ~63% toward target per second
  // At rate=5, moves ~99% toward target per second
  return target + (current - target) * Math.exp(-rate * deltaTime);
}

/**
 * Apply response curve to input for better control feel
 * Reduces sensitivity near center while maintaining full authority at extremes
 * Formula: y = a(x³) + (1-a)x where a is curve power
 * @param {number} input - Raw input value (-1 to 1)
 * @param {number} curvePower - Curve strength (0 = linear, 1 = full cubic)
 * @returns {number} Curved input value
 */
function applyResponseCurve(input, curvePower) {
  const sign = Math.sign(input);
  const abs = Math.abs(input);
  // Blend between linear (abs) and cubic (abs³) based on curvePower
  return sign * (curvePower * abs * abs * abs + (1 - curvePower) * abs);
}

/**
 * Legacy lerp - kept for compatibility but prefer smoothDamp
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
  // Ensure forward vector is current
  aircraft.updateMatrices();

  // Get current speed for speed-dependent calculations
  const speed = aircraft.getSpeed();

  // 1. Smooth throttle response (target -> actual)
  aircraft.targetThrottle = input.throttle;
  aircraft.actualThrottle = smoothDamp(
    aircraft.actualThrottle,
    aircraft.targetThrottle,
    PHYSICS.throttleSmoothRate || 2.5,
    deltaTime
  );
  aircraft.throttle = aircraft.actualThrottle;  // Keep legacy property in sync

  // 2. Apply thrust along forward vector using smoothed throttle
  const thrustMagnitude = aircraft.actualThrottle * PHYSICS.throttleAccel * deltaTime;
  aircraft.velocity.addScaledVector(aircraft.forward, thrustMagnitude);

  // 2b. Gradually align velocity with forward direction (arcade flight feel)
  // This prevents drift when turning - velocity follows the nose
  if (speed > 5) {  // Only when moving
    const alignmentRate = 2.0;  // How fast velocity follows nose (per second)
    const targetVelocity = aircraft.forward.clone().multiplyScalar(speed);
    aircraft.velocity.lerp(targetVelocity, 1 - Math.exp(-alignmentRate * deltaTime));
  }

  // 3. Apply drag (proportional to velocity, multiplicative)
  aircraft.velocity.multiplyScalar(1 - PHYSICS.drag);

  // 4. Calculate lift based on speed and pitch angle
  const pitch = aircraft.rotation.x;  // + = nose down, - = nose up

  // Speed-based lift foundation (equilibrium at cruiseSpeed when level)
  const cruiseSpeed = PHYSICS.cruiseSpeed || 100;
  const speedFactor = Math.min(speed / cruiseSpeed, 1.2);

  // Pitch modifier: nose up (negative pitch) increases lift, nose down decreases it
  const pitchMod = 1 - Math.sin(pitch) * 2;

  // Final lift calculation (clamped to prevent negative lift)
  const lift = PHYSICS.gravity * speedFactor * Math.max(0.1, pitchMod);
  const gravityEffect = (PHYSICS.gravity - lift) * deltaTime;
  aircraft.velocity.y -= gravityEffect;

  // 5. Clamp to max speed
  if (speed > PHYSICS.maxSpeed) {
    aircraft.velocity.setLength(PHYSICS.maxSpeed);
  }

  // 6. Apply rotation from controls (with smoothing and response curves)
  applyRotation(aircraft, input, deltaTime, speed);

  // 7. Update position from velocity
  aircraft.position.addScaledVector(aircraft.velocity, deltaTime);

  // 8. Clamp minimum altitude (forgiving collision)
  enforceMinAltitude(aircraft, deltaTime);

  // 9. Final matrix update
  aircraft.updateMatrices();
}

/**
 * Apply rotation based on input with smoothing, response curves, and auto-level
 * @param {Aircraft} aircraft
 * @param {Object} input
 * @param {number} deltaTime
 * @param {number} speed - Current aircraft speed for speed-dependent control
 */
function applyRotation(aircraft, input, deltaTime, speed) {
  // Get config values with defaults
  const inputSmoothRate = PHYSICS.inputSmoothRate || 6.0;
  const autoLevelRate = PHYSICS.autoLevelRate || 3.0;
  const curvePower = PHYSICS.inputCurvePower || 0.4;
  const cruiseSpeed = PHYSICS.cruiseSpeed || 100;
  const minSpeedFactor = PHYSICS.minSpeedFactor || 0.4;

  // Calculate speed-dependent control authority
  // At cruiseSpeed, full authority. Below that, reduced authority (but never below minSpeedFactor)
  const speedAuthority = Math.max(minSpeedFactor, Math.min(1.0, speed / cruiseSpeed));

  // Apply response curves to raw input (reduces sensitivity near center)
  const curvedPitch = applyResponseCurve(input.pitch, curvePower);
  const curvedRoll = applyResponseCurve(input.roll, curvePower);

  // Set target values from curved input
  aircraft.targetPitch = curvedPitch;
  aircraft.targetRoll = curvedRoll;

  // Smooth actual input values toward targets (frame-rate independent)
  aircraft.actualPitch = smoothDamp(aircraft.actualPitch, aircraft.targetPitch, inputSmoothRate, deltaTime);
  aircraft.actualRoll = smoothDamp(aircraft.actualRoll, aircraft.targetRoll, inputSmoothRate, deltaTime);

  // Calculate effective rotation rates with speed authority
  const effectivePitchRate = PHYSICS.pitchRate * speedAuthority;
  const effectiveRollRate = PHYSICS.rollRate * speedAuthority;

  // Apply roll (bank) - Z rotation
  if (Math.abs(aircraft.actualRoll) > 0.01) {
    // Apply smoothed roll input with speed-dependent rate
    aircraft.rotation.z += aircraft.actualRoll * effectiveRollRate * deltaTime;
    // Clamp roll to prevent excessive banking (±70 degrees)
    aircraft.rotation.z = Math.max(-Math.PI * 0.39, Math.min(Math.PI * 0.39, aircraft.rotation.z));
  } else {
    // Fast auto-level roll when no input
    const rollAutoLevelRate = 4.0;
    aircraft.rotation.z = smoothDamp(aircraft.rotation.z, 0, rollAutoLevelRate, deltaTime);
  }

  // Apply pitch - X rotation
  if (Math.abs(aircraft.actualPitch) > 0.01) {
    // Apply smoothed pitch input with speed-dependent rate
    aircraft.rotation.x += aircraft.actualPitch * effectivePitchRate * deltaTime;
  }
  // NO auto-level for pitch - aircraft maintains its pitch angle

  // Clamp pitch to prevent over-rotation (±60 degrees - allows steep dives/climbs)
  aircraft.rotation.x = Math.max(-Math.PI * 0.33, Math.min(Math.PI * 0.33, aircraft.rotation.x));

  // Yaw from bank angle (coordinated turn)
  // Use sin(2*bank) instead of tan(bank) for smoother, bounded behavior
  // sin(2x) gives good turn response: peaks at 45° bank, returns toward 0 at 90°
  const bankAngle = aircraft.rotation.z;
  const turnFactor = Math.sin(bankAngle * 2);
  const effectiveTurnRate = PHYSICS.turnRate * speedAuthority;
  aircraft.rotation.y += turnFactor * effectiveTurnRate * deltaTime;

  // Direct yaw input (optional, for rudder-like control)
  if (input.yaw !== 0) {
    aircraft.rotation.y += input.yaw * effectiveTurnRate * 0.3 * deltaTime;
  }

  // Normalize yaw to [-π, π] to prevent accumulation over time
  while (aircraft.rotation.y > Math.PI) aircraft.rotation.y -= Math.PI * 2;
  while (aircraft.rotation.y < -Math.PI) aircraft.rotation.y += Math.PI * 2;
}

/**
 * Enforce minimum altitude with gentle bounce
 * @param {Aircraft} aircraft
 * @param {number} deltaTime - Time since last frame
 */
function enforceMinAltitude(aircraft, deltaTime) {
  const altitude = aircraft.getAltitude();

  if (altitude < PHYSICS.minAltitude) {
    // Set to minimum altitude
    aircraft.position.y = PHYSICS.minAltitude;

    // Bounce: reverse and dampen vertical velocity
    if (aircraft.velocity.y < 0) {
      aircraft.velocity.y = Math.abs(aircraft.velocity.y) * 0.3;  // 30% bounce
    }

    // Gently level out when near ground (frame-rate independent)
    const groundLevelRate = 5.0;  // Aggressive leveling near ground
    aircraft.rotation.x = smoothDamp(aircraft.rotation.x, 0, groundLevelRate, deltaTime);
    aircraft.rotation.z = smoothDamp(aircraft.rotation.z, 0, groundLevelRate, deltaTime);
  }
}
