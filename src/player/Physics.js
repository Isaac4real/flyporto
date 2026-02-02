import * as THREE from 'three';
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
  // 1. Smooth throttle response (target -> actual)
  const throttleActive = input.throttleActive ?? true;
  let targetThrottle = input.throttle;
  if (throttleActive) {
    aircraft.trimSpeed = aircraft.speed;
  } else {
    const holdSpeed = Math.max(0, aircraft.trimSpeed ?? (PHYSICS.cruiseSpeed ?? aircraft.speed));
    const drag = PHYSICS.drag ?? 0;
    const throttleAccel = PHYSICS.throttleAccel ?? 20;
    const holdGain = PHYSICS.speedHoldGain ?? 0.6;
    const baseThrottle = throttleAccel > 0 ? (drag * holdSpeed) / throttleAccel : 0;
    const normalizedError = holdSpeed > 1 ? (holdSpeed - aircraft.speed) / holdSpeed : 0;
    targetThrottle = baseThrottle + normalizedError * holdGain;
    targetThrottle = Math.max(0, Math.min(1, targetThrottle));
  }
  aircraft.targetThrottle = targetThrottle;
  aircraft.actualThrottle = smoothDamp(
    aircraft.actualThrottle,
    aircraft.targetThrottle,
    PHYSICS.throttleSmoothRate || 2.5,
    deltaTime
  );
  aircraft.throttle = aircraft.actualThrottle; // Keep legacy property in sync

  // 2. Speed update (arcade kinematic model)
  const accel = aircraft.actualThrottle * (PHYSICS.throttleAccel ?? 20);
  aircraft.speed += accel * deltaTime;

  // Drag: proportional speed decay (frame-rate independent)
  const drag = PHYSICS.drag ?? 0;
  if (drag > 0) {
    aircraft.speed = Math.max(0, aircraft.speed - aircraft.speed * drag * deltaTime);
  }

  // Clamp to speed limits
  const minSpeed = PHYSICS.minSpeed ?? 0;
  const maxSpeed = PHYSICS.maxSpeed ?? 150;
  aircraft.speed = Math.max(minSpeed, Math.min(maxSpeed, aircraft.speed));

  // 3. Apply rotation from controls
  applyRotation(aircraft, input, deltaTime, aircraft.speed);

  // 4. Calculate lift + gravity (arcade)
  const takeoffSpeed = PHYSICS.takeoffSpeed ?? 25;
  let verticalDelta = 0;
  if (aircraft.speed >= takeoffSpeed) {
    const liftFactor = PHYSICS.liftFactor ?? 0.12;
    const lift = aircraft.speed * liftFactor * Math.cos(aircraft.roll);
    verticalDelta += lift * deltaTime;
  }

  const gravity = PHYSICS.gravityFactor ?? 9.81;
  verticalDelta -= gravity * deltaTime;

  aircraft.position.y += verticalDelta;
  aircraft.verticalSpeed = verticalDelta / Math.max(1e-6, deltaTime);

  // 5. Forward movement based on orientation
  const forwardDelta = new THREE.Vector3(0, 0, -1)
    .applyEuler(aircraft.rotation)
    .normalize()
    .multiplyScalar(aircraft.speed * deltaTime);
  aircraft.position.add(forwardDelta);

  // 6. Update velocity estimate for networking/FX
  aircraft.velocity.copy(forwardDelta).multiplyScalar(1 / Math.max(1e-6, deltaTime));
  aircraft.velocity.y += aircraft.verticalSpeed;

  // 7. Clamp minimum altitude (forgiving collision)
  enforceMinAltitude(aircraft, deltaTime);

  // 8. Final matrix update
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
  const inputSmoothRate = PHYSICS.inputSmoothRate || 6.0;
  const curvePower = PHYSICS.inputCurvePower || 0.4;
  const cruiseSpeed = PHYSICS.cruiseSpeed || 100;
  const minSpeedFactor = PHYSICS.minSpeedFactor || 0.4;
  const takeoffSpeed = PHYSICS.takeoffSpeed ?? 25;

  // Speed-dependent control authority
  const speedAuthority = Math.max(minSpeedFactor, Math.min(1.0, speed / cruiseSpeed));
  const yawAuthority = Math.min(1.0, speed / cruiseSpeed);
  const yawEnabled = speed >= takeoffSpeed;

  // Apply response curves to raw input
  const curvedPitch = applyResponseCurve(input.pitch, curvePower);
  const curvedRoll = applyResponseCurve(input.roll, curvePower);

  // Smooth actual input values toward targets
  aircraft.targetPitch = curvedPitch;
  aircraft.targetRoll = curvedRoll;
  aircraft.actualPitch = smoothDamp(aircraft.actualPitch, aircraft.targetPitch, inputSmoothRate, deltaTime);
  aircraft.actualRoll = smoothDamp(aircraft.actualRoll, aircraft.targetRoll, inputSmoothRate, deltaTime);

  const pitchAuthority = Math.max(0.2, Math.min(1.0, speed / cruiseSpeed));
  const pitchRate = (PHYSICS.pitchRate ?? 1.6) * pitchAuthority;
  const rollRate = (PHYSICS.rollRate ?? 2.8) * speedAuthority;
  const maxPitch = PHYSICS.maxPitch ?? 0.6;
  const maxRoll = PHYSICS.maxRoll ?? 1.2;
  const rollRecoveryRate = PHYSICS.rollRecoveryRate ?? 3.0;

  // Pitch (positive = nose up). Always respond, weaker at low speed.
  aircraft.pitch += aircraft.actualPitch * pitchRate * deltaTime;
  aircraft.pitch = Math.max(-maxPitch, Math.min(maxPitch, aircraft.pitch));

  // Roll (bank)
  aircraft.roll += aircraft.actualRoll * rollRate * deltaTime;
  aircraft.roll = Math.max(-maxRoll, Math.min(maxRoll, aircraft.roll));

  if (Math.abs(aircraft.actualRoll) < 0.01) {
    aircraft.roll = smoothDamp(aircraft.roll, 0, rollRecoveryRate, deltaTime);
  }

  // Yaw from bank (coordinated turn)
  const turnRate = PHYSICS.turnRate ?? 2.4;
  const bankFactor = maxRoll > 0 ? aircraft.roll / maxRoll : 0;
  if (yawEnabled) {
    aircraft.yaw += bankFactor * turnRate * yawAuthority * deltaTime;
  }

  // Direct yaw input (optional)
  if (yawEnabled && input.yaw !== 0) {
    aircraft.yaw += input.yaw * turnRate * 0.3 * deltaTime;
  }

  // Normalize yaw
  while (aircraft.yaw > Math.PI) aircraft.yaw -= Math.PI * 2;
  while (aircraft.yaw < -Math.PI) aircraft.yaw += Math.PI * 2;

  // Apply to aircraft.rotation (Three.js: +X = nose down, so invert pitch)
  aircraft.rotation.set(-aircraft.pitch, aircraft.yaw, aircraft.roll, 'YXZ');
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

    // Cancel downward vertical speed on ground contact
    if (aircraft.verticalSpeed < 0) {
      aircraft.verticalSpeed = 0;
    }

    // Soft roll recovery near ground to prevent perpetual banking
    const groundLevelRate = 4.0;
    aircraft.roll = smoothDamp(aircraft.roll, 0, groundLevelRate, deltaTime);
    aircraft.rotation.z = aircraft.roll;
  }
}
