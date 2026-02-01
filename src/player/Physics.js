import { CONFIG } from '../config.js';

const PHYSICS = CONFIG.physics;

/**
 * Frame-rate independent exponential smoothing (smooth damp)
 * Only used when directInput is false (legacy mode)
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} rate - Smoothing rate (higher = faster convergence)
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {number} Smoothed value
 */
function smoothDamp(current, target, rate, deltaTime) {
  return target + (current - target) * Math.exp(-rate * deltaTime);
}

/**
 * Update aircraft physics based on input
 * V2 OVERHAUL: Deep match to fly.pieter.com - NO INPUT SMOOTHING
 * @param {Aircraft} aircraft - The aircraft to update
 * @param {Object} input - Input state { pitch, roll, yaw, throttle, autoLevel } each -1 to 1
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updatePhysics(aircraft, input, deltaTime) {
  // Ensure forward vector is current
  aircraft.updateMatrices();

  // Get current speed for speed-dependent calculations
  const speed = aircraft.getSpeed();

  // 1. Apply throttle (direct, like fly.pieter.com)
  applyThrottle(aircraft, input, deltaTime, speed);

  // 2. Apply thrust along forward vector
  const thrustMagnitude = aircraft.throttle * PHYSICS.throttleAccel * deltaTime;
  aircraft.velocity.addScaledVector(aircraft.forward, thrustMagnitude);

  // 3. Apply drag (proportional to velocity, multiplicative)
  aircraft.velocity.multiplyScalar(1 - PHYSICS.drag);

  // 4. Apply simplified gravity/lift (fly.pieter.com style)
  applyGravityAndLift(aircraft, speed, deltaTime);

  // 5. Clamp to max speed
  if (speed > PHYSICS.maxSpeed) {
    aircraft.velocity.setLength(PHYSICS.maxSpeed);
  }

  // 6. Apply rotation from controls (DIRECT - no smoothing!)
  applyRotation(aircraft, input, deltaTime, speed);

  // 7. Update position from velocity
  aircraft.position.addScaledVector(aircraft.velocity, deltaTime);

  // 8. Clamp minimum altitude (forgiving collision)
  enforceMinAltitude(aircraft, deltaTime);

  // 9. Final matrix update
  aircraft.updateMatrices();
}

/**
 * Apply throttle with fly.pieter.com-style acceleration/deceleration
 * Key insight: deceleration is 8x faster than acceleration
 */
function applyThrottle(aircraft, input, deltaTime, speed) {
  const decelMultiplier = PHYSICS.decelMultiplier || 8;

  if (input.throttle > 0.1) {
    // Accelerating - normal rate
    aircraft.throttle = Math.min(1, aircraft.throttle + input.throttle * deltaTime * 2);
  } else if (input.throttle < -0.1) {
    // Braking - 8x faster deceleration like fly.pieter.com
    aircraft.throttle = Math.max(0, aircraft.throttle + input.throttle * deltaTime * 2 * decelMultiplier);
  } else {
    // No input - gradual decay
    aircraft.throttle = Math.max(0, aircraft.throttle - deltaTime * 0.5);
  }

  // Keep legacy properties in sync
  aircraft.targetThrottle = aircraft.throttle;
  aircraft.actualThrottle = aircraft.throttle;
}

/**
 * Simplified gravity and lift for velocity-based physics
 * Key insights from fly.pieter.com:
 * - Simple model (lift counters gravity based on speed)
 * - Hard speed gate for lift
 * - Roll reduces lift via cos(roll)
 *
 * But adapted for our velocity-based system (not position-based)
 */
function applyGravityAndLift(aircraft, speed, deltaTime) {
  const gravity = PHYSICS.gravity || 9.81;
  const cruiseSpeed = PHYSICS.cruiseSpeed || 80;
  const takeoffSpeed = PHYSICS.takeoffSpeed || 40;

  // Calculate lift factor based on speed
  // At cruise speed, lift = gravity (equilibrium)
  // Below takeoff speed, no lift (hard gate like fly.pieter.com)
  let liftFactor = 0;
  if (speed >= takeoffSpeed) {
    // Linear lift curve: full lift at cruise speed
    liftFactor = Math.min(1.2, speed / cruiseSpeed);
  }

  // Roll reduces lift (banking = less vertical lift component)
  const rollAngle = aircraft.rotation.z;
  const rollLiftReduction = Math.cos(rollAngle);

  // Final lift calculation
  const lift = gravity * liftFactor * rollLiftReduction;

  // Net vertical acceleration: gravity pulls down, lift pushes up
  const netVerticalAccel = gravity - lift;
  aircraft.velocity.y -= netVerticalAccel * deltaTime;
}

/**
 * Apply rotation with DIRECT input (no smoothing!) - fly.pieter.com style
 * Key insights:
 * - NO smoothDamp, NO lerp - just direct add/subtract each frame
 * - Yaw happens WHILE rolling, not from bank angle
 * - Linear auto-level (subtraction toward zero, not exponential)
 * - Hard speed gate for pitch control
 */
function applyRotation(aircraft, input, deltaTime, speed) {
  const pitchSpeed = PHYSICS.pitchRate || 0.9;
  const rollSpeed = PHYSICS.rollRate || 1.44;
  const yawRate = PHYSICS.turnRate || 5;
  const autoLevelSpeed = PHYSICS.autoLevelRate || 0.9;
  const maxRoll = PHYSICS.maxRoll || Math.PI / 2;  // 90 degrees
  const maxPitch = PHYSICS.maxPitch || 1.5;        // ~86 degrees
  const takeoffSpeed = PHYSICS.takeoffSpeed || 40;

  // Speed authority for yaw (like fly.pieter.com: currentSpeed / maxSpeed)
  const maxSpeed = PHYSICS.maxSpeed || 150;
  const speedRatio = Math.min(1.0, speed / maxSpeed);

  // ============== ROLL ==============
  // DIRECT roll application (no smoothing!)
  if (Math.abs(input.roll) > 0.1) {
    // Apply roll directly
    aircraft.rotation.z += input.roll * rollSpeed * deltaTime;

    // Clamp roll
    aircraft.rotation.z = Math.max(-maxRoll, Math.min(maxRoll, aircraft.rotation.z));

    // Yaw WHILE rolling (fly.pieter.com style - not from bank angle)
    aircraft.rotation.y += -input.roll * yawRate * deltaTime * speedRatio;
  } else {
    // Linear auto-level roll (not exponential!)
    // Just subtract toward zero at a constant rate
    if (Math.abs(aircraft.rotation.z) > 0.01) {
      const levelAmount = autoLevelSpeed * deltaTime;
      if (aircraft.rotation.z > 0) {
        aircraft.rotation.z = Math.max(0, aircraft.rotation.z - levelAmount);
      } else {
        aircraft.rotation.z = Math.min(0, aircraft.rotation.z + levelAmount);
      }
    } else {
      aircraft.rotation.z = 0;
    }
  }

  // ============== PITCH ==============
  // Only allow pitch control above takeoff speed (HARD gate like fly.pieter.com)
  if (speed >= takeoffSpeed) {
    if (Math.abs(input.pitch) > 0.1) {
      // DIRECT pitch application (no smoothing!)
      aircraft.rotation.x += input.pitch * pitchSpeed * deltaTime;

      // Clamp pitch
      aircraft.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, aircraft.rotation.x));
    } else {
      // Linear auto-level pitch (not exponential!)
      if (Math.abs(aircraft.rotation.x) > 0.01) {
        const levelAmount = autoLevelSpeed * deltaTime;
        if (aircraft.rotation.x > 0) {
          aircraft.rotation.x = Math.max(0, aircraft.rotation.x - levelAmount);
        } else {
          aircraft.rotation.x = Math.min(0, aircraft.rotation.x + levelAmount);
        }
      } else {
        aircraft.rotation.x = 0;
      }
    }
  }
  // Below takeoff speed: pitch control is locked (gravity dominates)

  // Direct yaw input (optional, for rudder-like control)
  if (input.yaw !== 0) {
    aircraft.rotation.y += input.yaw * yawRate * 0.3 * deltaTime;
  }

  // Normalize yaw to [-π, π]
  while (aircraft.rotation.y > Math.PI) aircraft.rotation.y -= Math.PI * 2;
  while (aircraft.rotation.y < -Math.PI) aircraft.rotation.y += Math.PI * 2;

  // Keep legacy properties in sync (for any code that reads them)
  aircraft.targetPitch = input.pitch;
  aircraft.targetRoll = input.roll;
  aircraft.actualPitch = input.pitch;
  aircraft.actualRoll = input.roll;
}

/**
 * Enforce minimum altitude with gentle bounce
 * @param {Aircraft} aircraft
 * @param {number} deltaTime - Time since last frame
 */
function enforceMinAltitude(aircraft, deltaTime) {
  const altitude = aircraft.getAltitude();
  const minAltitude = PHYSICS.minAltitude || 10;

  if (altitude < minAltitude) {
    // Set to minimum altitude (like fly.pieter.com: Math.max(position.y, 36))
    aircraft.position.y = minAltitude;

    // Bounce: reverse and dampen vertical velocity
    if (aircraft.velocity.y < 0) {
      aircraft.velocity.y = Math.abs(aircraft.velocity.y) * 0.3;  // 30% bounce
    }

    // Linear level-out when near ground (faster than normal auto-level)
    const groundLevelRate = 2.0;
    const levelAmount = groundLevelRate * deltaTime;

    if (Math.abs(aircraft.rotation.x) > 0.01) {
      if (aircraft.rotation.x > 0) {
        aircraft.rotation.x = Math.max(0, aircraft.rotation.x - levelAmount);
      } else {
        aircraft.rotation.x = Math.min(0, aircraft.rotation.x + levelAmount);
      }
    }

    if (Math.abs(aircraft.rotation.z) > 0.01) {
      if (aircraft.rotation.z > 0) {
        aircraft.rotation.z = Math.max(0, aircraft.rotation.z - levelAmount);
      } else {
        aircraft.rotation.z = Math.min(0, aircraft.rotation.z + levelAmount);
      }
    }
  }
}
