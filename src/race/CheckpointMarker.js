import * as THREE from 'three';

/**
 * CheckpointMarker - Visible 3D marker for race checkpoints
 *
 * Creates a glowing ring with a vertical beacon that's visible from far away.
 * The marker pulses and rotates to draw attention.
 */
export class CheckpointMarker {
  /**
   * @param {Object} config
   * @param {THREE.Vector3} config.position - World position
   * @param {number} config.radius - Marker radius
   * @param {string} config.type - 'sphere' or 'box' (affects shape)
   * @param {Object} config.size - Size for box type {x, y, z}
   */
  constructor(config) {
    this.position = config.position.clone();
    this.radius = config.radius || 100;
    this.type = config.type || 'sphere';
    this.size = config.size || { x: 100, y: 100, z: 100 };

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // State
    this.state = 'upcoming'; // 'upcoming', 'active', 'completed'
    this._time = 0;

    // Create visuals
    this.createRing();
    this.createBeacon();
    this.createGlow();

    // Start hidden
    this.group.visible = false;
  }

  /**
   * Create the main checkpoint ring
   */
  createRing() {
    const ringRadius = this.type === 'box'
      ? Math.max(this.size.x, this.size.z) / 2
      : this.radius;

    // Main ring
    const geometry = new THREE.TorusGeometry(ringRadius, ringRadius * 0.03, 8, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    this.ring = new THREE.Mesh(geometry, material);
    this.ring.rotation.x = Math.PI / 2; // Horizontal ring
    this.group.add(this.ring);

    // Inner ring for depth
    const innerGeometry = new THREE.TorusGeometry(ringRadius * 0.9, ringRadius * 0.02, 8, 64);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ffcc,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });

    this.innerRing = new THREE.Mesh(innerGeometry, innerMaterial);
    this.innerRing.rotation.x = Math.PI / 2;
    this.group.add(this.innerRing);
  }

  /**
   * Create vertical beacon pillar
   */
  createBeacon() {
    const beaconHeight = 500; // Tall beacon visible from far away
    const beaconWidth = 3;

    const geometry = new THREE.CylinderGeometry(beaconWidth, beaconWidth, beaconHeight, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3
    });

    this.beacon = new THREE.Mesh(geometry, material);
    this.beacon.position.y = beaconHeight / 2; // Extend upward from ring
    this.group.add(this.beacon);

    // Downward beacon too (store reference for color updates)
    this.downBeacon = new THREE.Mesh(geometry.clone(), material.clone());
    this.downBeacon.position.y = -beaconHeight / 2;
    this.group.add(this.downBeacon);
  }

  /**
   * Create glow sphere at center
   */
  createGlow() {
    const glowRadius = 15;
    const geometry = new THREE.SphereGeometry(glowRadius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6
    });

    this.glow = new THREE.Mesh(geometry, material);
    this.group.add(this.glow);
  }

  /**
   * Set marker state
   * @param {'upcoming' | 'active' | 'completed'} state
   */
  setState(state) {
    this.state = state;

    switch (state) {
      case 'upcoming':
        this.setColor(0x666666); // Gray, dim
        this.ring.material.opacity = 0.3;
        this.beacon.material.opacity = 0.1;
        this.downBeacon.material.opacity = 0.1;
        this.glow.material.opacity = 0.2;
        break;

      case 'active':
        this.setColor(0x00ff88); // Green, bright
        this.ring.material.opacity = 0.9;
        this.beacon.material.opacity = 0.4;
        this.downBeacon.material.opacity = 0.4;
        this.glow.material.opacity = 0.8;
        break;

      case 'completed':
        this.setColor(0x4ade80); // Completed green
        this.ring.material.opacity = 0.3;
        this.beacon.material.opacity = 0.05;
        this.downBeacon.material.opacity = 0.05;
        this.glow.material.opacity = 0.2;
        break;
    }
  }

  /**
   * Set marker color
   * @param {number} color - Hex color
   */
  setColor(color) {
    this.ring.material.color.setHex(color);
    this.innerRing.material.color.setHex(color);
    this.beacon.material.color.setHex(color);
    this.downBeacon.material.color.setHex(color);
    this.glow.material.color.setHex(color);
  }

  /**
   * Show the marker
   */
  show() {
    this.group.visible = true;
  }

  /**
   * Hide the marker
   */
  hide() {
    this.group.visible = false;
  }

  /**
   * Update animation
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    this._time += deltaTime;

    if (this.state === 'active') {
      // Pulse effect
      const pulse = Math.sin(this._time * 4) * 0.3 + 0.7;
      this.glow.material.opacity = pulse * 0.8;
      this.glow.scale.setScalar(1 + Math.sin(this._time * 3) * 0.2);

      // Rotate ring slowly
      this.ring.rotation.z = this._time * 0.5;
      this.innerRing.rotation.z = -this._time * 0.3;
    }
  }

  /**
   * Get the Three.js group for adding to scene
   * @returns {THREE.Group}
   */
  getObject() {
    return this.group;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

/**
 * DirectionIndicator - HUD element pointing to next checkpoint
 *
 * Shows an arrow at the edge of the screen pointing toward the next checkpoint.
 */
export class DirectionIndicator {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.visible = false;

    this.createUI();
  }

  createUI() {
    this.element = document.createElement('div');
    this.element.id = 'direction-indicator';
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 60px;
      height: 60px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 450;
      display: none;
    `;

    // Arrow SVG (unique filter ID to avoid conflicts)
    this.element.innerHTML = `
      <svg viewBox="0 0 60 60" width="60" height="60">
        <defs>
          <filter id="direction-indicator-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon
          points="30,5 50,55 30,45 10,55"
          fill="#00ff88"
          stroke="#ffffff"
          stroke-width="2"
          filter="url(#direction-indicator-glow)"
        />
      </svg>
    `;

    // Distance label
    this.distanceLabel = document.createElement('div');
    this.distanceLabel.style.cssText = `
      position: absolute;
      bottom: -25px;
      left: 50%;
      transform: translateX(-50%);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: bold;
      color: #00ff88;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      white-space: nowrap;
    `;
    this.element.appendChild(this.distanceLabel);

    this.container.appendChild(this.element);
  }

  /**
   * Update the indicator position and rotation
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} targetPosition - Checkpoint position
   * @param {THREE.Vector3} aircraftPosition - Player position
   */
  update(camera, targetPosition, aircraftPosition) {
    if (!this.visible) return;

    // Project target to screen
    const screenPos = targetPosition.clone().project(camera);

    // Check if on screen
    const onScreen = (
      screenPos.z < 1 &&
      Math.abs(screenPos.x) < 0.9 &&
      Math.abs(screenPos.y) < 0.9
    );

    if (onScreen) {
      // Target is visible, hide indicator
      this.element.style.display = 'none';
      return;
    }

    this.element.style.display = 'block';

    // Calculate angle to target
    const angle = Math.atan2(screenPos.y, screenPos.x);

    // Position indicator at edge of screen in direction of target
    const padding = 80;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxRadius = Math.min(centerX, centerY) - padding;

    const indicatorX = centerX + Math.cos(angle) * maxRadius;
    const indicatorY = centerY - Math.sin(angle) * maxRadius; // Flip Y

    this.element.style.left = `${indicatorX}px`;
    this.element.style.top = `${indicatorY}px`;

    // Rotate arrow to point toward target
    // Arrow SVG points up, so adjust angle
    const rotation = -angle * (180 / Math.PI) - 90;
    this.element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    // Update distance
    const distance = aircraftPosition.distanceTo(targetPosition);
    if (distance > 1000) {
      this.distanceLabel.textContent = `${(distance / 1000).toFixed(1)} km`;
    } else {
      this.distanceLabel.textContent = `${Math.round(distance)} m`;
    }
  }

  /**
   * Show the indicator
   */
  show() {
    this.visible = true;
    this.element.style.display = 'block';
  }

  /**
   * Hide the indicator
   */
  hide() {
    this.visible = false;
    this.element.style.display = 'none';
  }

  /**
   * Dispose
   */
  dispose() {
    this.element?.remove();
  }
}
