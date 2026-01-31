import * as THREE from 'three';
import { BulletEffects } from './BulletEffects.js';
import { SoundManager } from './SoundManager.js';
import { CONFIG } from '../config.js';

/**
 * CombatManager - handles shooting and hit detection
 */
export class CombatManager {
  /**
   * @param {THREE.Scene} scene
   * @param {Aircraft} localAircraft
   * @param {PlayerSync} playerSync
   * @param {NetworkManager} networkManager
   */
  constructor(scene, localAircraft, playerSync, networkManager) {
    this.scene = scene;
    this.localAircraft = localAircraft;
    this.playerSync = playerSync;
    this.networkManager = networkManager;

    // Effects
    this.bulletEffects = new BulletEffects(scene);

    // Sound effects
    this.soundManager = new SoundManager();

    // Raycaster for hit detection
    this.raycaster = new THREE.Raycaster();
    this.raycaster.near = 0;
    this.raycaster.far = CONFIG.combat?.bulletRange || 800;

    // Fire rate control
    this.fireCooldown = CONFIG.combat?.fireCooldown || 200;  // 200ms = 5 shots/second
    this.lastFireTime = 0;

    // Score tracking (local copy)
    this.myScore = 0;
    this.scores = {};  // playerId -> score

    // Callbacks
    this.onHit = null;       // Called when we hit someone
    this.onGotHit = null;    // Called when someone hits us

    // Set up network handlers
    this.setupNetworkHandlers();
  }

  /**
   * Set up handlers for combat-related network messages
   */
  setupNetworkHandlers() {
    // Store original handler to extend it
    const originalHandler = this.networkManager.handleMessage.bind(this.networkManager);

    this.networkManager.handleMessage = (msg) => {
      // Call original handler first
      originalHandler(msg);

      // Handle combat messages
      switch (msg.type) {
        case 'player_shoot':
          this.onRemoteShoot(msg);
          break;

        case 'hit_confirmed':
          this.onHitConfirmed(msg);
          break;

        case 'players':
          // Update scores from player data
          if (msg.scores) {
            this.scores = msg.scores;
            this.myScore = msg.scores[this.networkManager.getPlayerId()] || 0;
          }
          break;
      }
    };
  }

  /**
   * Attempt to fire - call this when fire button is pressed
   * @returns {boolean} True if shot was fired
   */
  fire() {
    const now = performance.now();

    // Check cooldown
    if (now - this.lastFireTime < this.fireCooldown) {
      return false;
    }
    this.lastFireTime = now;

    // Initialize audio on first fire (user gesture required)
    this.soundManager.init();

    // Get fire origin and direction from aircraft
    const origin = this.localAircraft.position.clone();
    const direction = this.localAircraft.getForwardVector();

    // Send shoot event to server (for other players to see effects)
    this.networkManager.send({
      type: 'shoot',
      position: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: Date.now()
    });

    // Create local visual effects
    this.bulletEffects.createMuzzleFlash(origin, direction);
    this.bulletEffects.createTracer(origin, direction);

    // Play gunfire sound
    this.soundManager.playGunfire();

    // Perform hit detection via raycasting
    this.checkHit(origin, direction);

    return true;
  }

  /**
   * Check for hit using raycasting
   */
  checkHit(origin, direction) {
    // Get all hitbox meshes from player sync
    const hitboxes = this.playerSync.getHitboxMeshes();

    if (hitboxes.length === 0) {
      return;  // No targets
    }

    // Set up raycaster
    this.raycaster.set(origin, direction);

    // Check intersections
    const intersects = this.raycaster.intersectObjects(hitboxes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const targetId = hit.object.userData.playerId;

      if (targetId) {
        // Send hit event to server
        this.networkManager.send({
          type: 'hit',
          targetId: targetId,
          timestamp: Date.now()
        });

        // Create hit marker
        this.bulletEffects.createHitMarker(hit.point);

        console.log(`[Combat] Hit ${targetId}!`);
      }
    }
  }

  /**
   * Handle remote player shooting (show their effects)
   */
  onRemoteShoot(msg) {
    // Validate message structure
    if (!msg.shooterId || !msg.position || !msg.direction) {
      return;
    }

    if (msg.shooterId === this.networkManager.getPlayerId()) {
      return;  // Ignore our own shots (already showed effects)
    }

    const origin = new THREE.Vector3(msg.position.x, msg.position.y, msg.position.z);
    const direction = new THREE.Vector3(msg.direction.x, msg.direction.y, msg.direction.z);

    // Show their tracer
    this.bulletEffects.createTracer(origin, direction);
  }

  /**
   * Handle hit confirmation from server
   */
  onHitConfirmed(msg) {
    // Validate message structure
    if (!msg.shooterId || !msg.targetId) {
      return;
    }

    // Update scores
    if (msg.shooterScore !== undefined) {
      this.scores[msg.shooterId] = msg.shooterScore;
    }

    const myId = this.networkManager.getPlayerId();
    if (!myId) {
      return;  // Not yet connected
    }

    if (msg.shooterId === myId) {
      // We hit someone!
      this.myScore = msg.shooterScore || 0;
      const target = this.playerSync.getPlayer(msg.targetId);
      const targetName = target?.playerName || 'Unknown';

      // Play hit confirmation sound
      this.soundManager.playHit();

      this.onHit?.(msg.targetId, targetName, this.myScore);
    }

    if (msg.targetId === myId) {
      // We got hit!
      const shooter = this.playerSync.getPlayer(msg.shooterId);
      const shooterName = shooter?.playerName || 'Unknown';

      // Play got hit sound
      this.soundManager.playGotHit();

      this.onGotHit?.(msg.shooterId, shooterName);
    }
  }

  /**
   * Update effects (call every frame)
   */
  update(deltaTime) {
    this.bulletEffects.update();
  }

  /**
   * Get current score
   */
  getScore() {
    return this.myScore;
  }

  /**
   * Get all scores
   */
  getScores() {
    return this.scores;
  }

  /**
   * Clean up
   */
  dispose() {
    this.bulletEffects.dispose();
  }
}
