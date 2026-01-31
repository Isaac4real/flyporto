import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * BulletEffects - manages visual effects for shooting
 * - Tracer lines
 * - Muzzle flash
 * - Hit markers
 */
export class BulletEffects {
  constructor(scene) {
    this.scene = scene;
    this.activeEffects = [];
    this.maxEffects = 20;  // Limit concurrent effects
  }

  /**
   * Create tracer line from origin in direction
   * Fades out over duration specified in config
   */
  createTracer(origin, direction) {
    // Limit active tracers to prevent performance issues
    const tracerCount = this.activeEffects.filter(e => e.type === 'tracer').length;
    if (tracerCount > 10) {
      return null;
    }

    const tracerLength = CONFIG.combat?.tracerLength || 400;
    const duration = CONFIG.combat?.tracerDuration || 150;

    // Calculate end point
    const end = origin.clone().add(direction.clone().multiplyScalar(tracerLength));

    // Create line geometry
    const points = [origin.clone(), end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Yellow/orange tracer
    const material = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Animate fade out
    const startTime = performance.now();

    const effect = {
      type: 'tracer',
      mesh: line,
      geometry,
      material,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;  // Done, remove
        }
        material.opacity = 1 - (elapsed / duration);
        return false;
      }
    };

    this.addEffect(effect);
    return line;
  }

  /**
   * Create muzzle flash at position
   * Quick flash that fades immediately
   */
  createMuzzleFlash(position, direction) {
    // Small sphere for flash
    const geometry = new THREE.SphereGeometry(3, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1
    });

    const flash = new THREE.Mesh(geometry, material);

    // Position slightly in front of aircraft
    const flashPos = position.clone().add(direction.clone().multiplyScalar(20));
    flash.position.copy(flashPos);

    this.scene.add(flash);

    // Very quick fade (50ms)
    const startTime = performance.now();
    const duration = 50;

    const effect = {
      type: 'muzzle',
      mesh: flash,
      geometry,
      material,
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;
        }
        material.opacity = 1 - (elapsed / duration);
        const scale = 1 + (elapsed / duration) * 2;  // Grow as it fades
        flash.scale.setScalar(scale);
        return false;
      }
    };

    this.addEffect(effect);
  }

  /**
   * Create hit marker at impact point
   * Red cross that fades
   */
  createHitMarker(position) {
    const duration = CONFIG.combat?.hitMarkerDuration || 300;

    // Create a cross pattern using two planes
    const group = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Horizontal bar
    const hBar = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2),
      material
    );
    group.add(hBar);

    // Vertical bar
    const vBarMaterial = material.clone();
    const vBar = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 10),
      vBarMaterial
    );
    group.add(vBar);

    group.position.copy(position);
    this.scene.add(group);

    const startTime = performance.now();

    const effect = {
      type: 'hitmarker',
      mesh: group,
      geometry: [hBar.geometry, vBar.geometry],
      material: [material, vBarMaterial],
      startTime,
      duration,
      update: (now) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          return true;
        }
        const opacity = 1 - (elapsed / duration);
        material.opacity = opacity;
        vBarMaterial.opacity = opacity;
        const scale = 1 + (elapsed / duration);
        group.scale.setScalar(scale);
        return false;
      }
    };

    this.addEffect(effect);
  }

  /**
   * Add effect with cleanup on limit
   */
  addEffect(effect) {
    this.activeEffects.push(effect);

    // Remove oldest if at limit
    while (this.activeEffects.length > this.maxEffects) {
      const oldest = this.activeEffects.shift();
      this.removeEffect(oldest);
    }
  }

  /**
   * Remove and dispose effect
   */
  removeEffect(effect) {
    this.scene.remove(effect.mesh);

    // Handle both single and array geometries/materials
    if (Array.isArray(effect.geometry)) {
      effect.geometry.forEach(g => g.dispose());
    } else {
      effect.geometry.dispose();
    }

    if (Array.isArray(effect.material)) {
      effect.material.forEach(m => m.dispose());
    } else {
      effect.material.dispose();
    }
  }

  /**
   * Update all active effects (call every frame)
   */
  update() {
    const now = performance.now();
    const toRemove = [];

    for (const effect of this.activeEffects) {
      const done = effect.update(now);
      if (done) {
        toRemove.push(effect);
      }
    }

    // Remove completed effects
    for (const effect of toRemove) {
      const index = this.activeEffects.indexOf(effect);
      if (index > -1) {
        this.activeEffects.splice(index, 1);
      }
      this.removeEffect(effect);
    }
  }

  /**
   * Clean up all effects
   */
  dispose() {
    for (const effect of this.activeEffects) {
      this.removeEffect(effect);
    }
    this.activeEffects = [];
  }
}
