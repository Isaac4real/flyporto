/**
 * HUD - Heads-Up Display for flight information
 * Shows speed (knots), altitude (meters), connection status, ping, and control hints
 */

export class HUD {
  constructor(container) {
    this.container = container;

    this.element = document.createElement('div');
    this.element.id = 'hud';
    this.element.innerHTML = `
      <div id="hud-speed">0 kts</div>
      <div id="hud-altitude">0m</div>
      <div id="hud-hints">WASD: Pitch & Roll | Up/Down Arrows: Throttle | Space: Fire</div>
    `;
    container.appendChild(this.element);

    this.speedEl = document.getElementById('hud-speed');
    this.altitudeEl = document.getElementById('hud-altitude');
    this.hintsEl = document.getElementById('hud-hints');

    // Score display (below altitude)
    this.scoreDisplay = document.createElement('div');
    this.scoreDisplay.id = 'hud-score';
    this.scoreDisplay.style.cssText = `
      position: absolute;
      top: 70px;
      left: 10px;
      color: #ffff00;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    `;
    this.scoreDisplay.textContent = 'Score: 0';
    container.appendChild(this.scoreDisplay);

    // Flight debug stats (hidden by default)
    this.flightStats = document.createElement('div');
    this.flightStats.id = 'hud-flight-stats';
    this.flightStats.style.cssText = `
      position: absolute;
      top: 100px;
      left: 10px;
      color: rgba(255,255,255,0.8);
      font-family: monospace;
      font-size: 12px;
      white-space: pre;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      display: none;
    `;
    container.appendChild(this.flightStats);

    // Create connection status element (top-right corner)
    this.connectionStatus = document.createElement('div');
    this.connectionStatus.id = 'hud-connection';
    this.connectionStatus.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      color: #ff4444;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
      z-index: 1000;
    `;
    this.connectionStatus.textContent = 'Connecting...';
    container.appendChild(this.connectionStatus);

    // Create ping display (bottom-right corner)
    this.pingDisplay = document.createElement('div');
    this.pingDisplay.id = 'hud-ping';
    this.pingDisplay.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      color: rgba(255,255,255,0.6);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      z-index: 1000;
    `;
    container.appendChild(this.pingDisplay);

    // Crosshair (shows where aircraft is pointing)
    this.createCrosshair();

    // Mouse aim reticle (shows where mouse is pointing)
    this.createMouseAimReticle();

    // Sound toggle
    this.createSoundToggle();

    // Tile loading indicator
    this.createLoadingIndicator();

  }

  /**
   * Create crosshair that follows aircraft aim direction
   */
  createCrosshair() {
    this.crosshair = document.createElement('div');
    this.crosshair.id = 'crosshair';
    this.crosshair.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 24px;
      pointer-events: none;
      z-index: 100;
    `;

    // Simple crosshair using SVG
    this.crosshair.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="2" fill="white" stroke="black" stroke-width="0.5"/>
        <line x1="12" y1="2" x2="12" y2="8" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="16" x2="12" y2="22" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="2" y1="12" x2="8" y2="12" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="12" x2="22" y2="12" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;

    this.container.appendChild(this.crosshair);

    // Reusable vector for aim point calculation
    this._aimPoint = null;
  }

  /**
   * Create mouse aim reticle (shows where mouse is pointing - the target)
   * This is the outer circle that the player controls with mouse movement.
   * The crosshair (aircraft heading) will chase this reticle.
   */
  createMouseAimReticle() {
    this.mouseAimReticle = document.createElement('div');
    this.mouseAimReticle.id = 'mouse-aim-reticle';
    this.mouseAimReticle.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      pointer-events: none;
      z-index: 99;
      opacity: 0;
      transition: opacity 0.2s;
    `;

    // Circle reticle design (War Thunder style)
    this.mouseAimReticle.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40">
        <!-- Outer circle -->
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
        <!-- Small tick marks -->
        <line x1="20" y1="2" x2="20" y2="6" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
        <line x1="20" y1="34" x2="20" y2="38" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
        <line x1="2" y1="20" x2="6" y2="20" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
        <line x1="34" y1="20" x2="38" y2="20" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
        <!-- Center dot -->
        <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.5)"/>
      </svg>
    `;

    this.container.appendChild(this.mouseAimReticle);
  }

  /**
   * Update mouse aim reticle position
   * @param {Object} aimOffset - { pitch, yaw } in degrees from InputHandler
   * @param {boolean} isLocked - Whether pointer is locked
   * @param {boolean} keyboardActive - Whether keyboard is overriding
   */
  updateMouseAimReticle(aimOffset, isLocked, keyboardActive = false) {
    if (!this.mouseAimReticle) return;

    if (!isLocked || !aimOffset) {
      // Hide when not using mouse aim
      this.mouseAimReticle.style.opacity = '0';
      return;
    }

    // Show the reticle
    this.mouseAimReticle.style.opacity = keyboardActive ? '0.3' : '1';

    // Convert aim offset (degrees) to screen position
    // Center of screen = 0,0 offset
    // Max offset = edge of screen (roughly)
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Scale factor: how many pixels per degree
    // Adjusted so max offset (~45°) reaches about 40% from center to edge
    const pixelsPerDegree = Math.min(window.innerWidth, window.innerHeight) * 0.008;

    const offsetX = aimOffset.yaw * pixelsPerDegree;
    const offsetY = -aimOffset.pitch * pixelsPerDegree;  // Negative because screen Y is inverted

    const screenX = screenCenterX + offsetX;
    const screenY = screenCenterY + offsetY;

    // Clamp to screen bounds with padding
    const padding = 30;
    const clampedX = Math.max(padding, Math.min(window.innerWidth - padding, screenX));
    const clampedY = Math.max(padding, Math.min(window.innerHeight - padding, screenY));

    this.mouseAimReticle.style.left = `${clampedX}px`;
    this.mouseAimReticle.style.top = `${clampedY}px`;
  }

  /**
   * Update crosshair position based on aircraft aim direction
   * Projects where the aircraft is pointing onto the screen
   * @param {THREE.Camera} camera - The game camera
   * @param {Aircraft} aircraft - The player's aircraft
   * @param {THREE} THREE - Three.js library reference
   */
  updateCrosshair(camera, aircraft, THREE) {
    if (!this._aimPoint) {
      this._aimPoint = new THREE.Vector3();
    }

    // Calculate aim point: aircraft position + forward direction * distance
    const aimDistance = 500; // Project aim point 500m ahead
    const forward = aircraft.getForwardVector();
    this._aimPoint.copy(aircraft.position)
      .add(forward.multiplyScalar(aimDistance));

    // Project to screen coordinates
    this._aimPoint.project(camera);

    // Convert from normalized device coordinates (-1 to 1) to screen pixels
    const screenX = (this._aimPoint.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-this._aimPoint.y * 0.5 + 0.5) * window.innerHeight;

    // Check if aim point is in front of camera (z < 1 in NDC)
    if (this._aimPoint.z < 1) {
      // Clamp to screen bounds with some padding
      const padding = 50;
      const clampedX = Math.max(padding, Math.min(window.innerWidth - padding, screenX));
      const clampedY = Math.max(padding, Math.min(window.innerHeight - padding, screenY));

      this.crosshair.style.left = `${clampedX}px`;
      this.crosshair.style.top = `${clampedY}px`;
      this.crosshair.style.opacity = '1';
    } else {
      // Aim point is behind camera, hide or center crosshair
      this.crosshair.style.left = '50%';
      this.crosshair.style.top = '50%';
      this.crosshair.style.opacity = '0.3';
    }
  }

  /**
   * Create sound toggle button
   */
  createSoundToggle() {
    this.soundToggle = document.createElement('div');
    this.soundToggle.id = 'sound-toggle';
    this.soundToggle.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      cursor: pointer;
      padding: 5px 10px;
      background: rgba(0,0,0,0.5);
      border-radius: 4px;
      user-select: none;
    `;
    this.soundToggle.textContent = 'Sound: ON';
    this.soundToggle.onclick = () => this.onSoundToggle?.();
    this.container.appendChild(this.soundToggle);
  }

  /**
   * Update sound toggle display
   * @param {boolean} enabled - Whether sound is enabled
   */
  updateSoundToggle(enabled) {
    this.soundToggle.textContent = enabled ? 'Sound: ON' : 'Sound: OFF';
  }

  /**
   * Update HUD display
   * @param {number} speed - Speed in m/s
   * @param {number} altitude - Altitude in meters
   */
  update(speed, altitude) {
    // Speed: m/s to knots (1 m/s = 1.944 knots)
    const knots = Math.round(speed * 1.944);
    this.speedEl.textContent = `${knots} kts`;

    // Altitude: meters (rounded)
    const alt = Math.round(altitude);
    this.altitudeEl.textContent = `${alt}m`;
  }

  /**
   * Update optional flight debug stats
   * @param {Aircraft} aircraft
   * @param {boolean} enabled
   */
  updateFlightStats(aircraft, enabled) {
    if (!this.flightStats) return;
    if (!enabled) {
      this.flightStats.style.display = 'none';
      return;
    }

    const pitchDeg = Math.round((aircraft.pitch ?? 0) * (180 / Math.PI));
    const rollDeg = Math.round((aircraft.roll ?? 0) * (180 / Math.PI));
    const yawDeg = Math.round((aircraft.yaw ?? 0) * (180 / Math.PI));
    const verticalSpeed = Math.round((aircraft.verticalSpeed ?? 0) * 10) / 10;

    this.flightStats.style.display = 'block';
    this.flightStats.textContent =
      `Pitch: ${pitchDeg}°\n` +
      `Roll:  ${rollDeg}°\n` +
      `Yaw:   ${yawDeg}°\n` +
      `V/S:   ${verticalSpeed} m/s`;
  }

  /**
   * Update score display
   * @param {number} score - Current player score
   */
  updateScore(score) {
    this.scoreDisplay.textContent = `Score: ${score}`;
  }

  /**
   * Update connection status display
   * @param {boolean} connected - Whether connected to server
   * @param {number} playerCount - Number of players online
   */
  updateConnectionStatus(connected, playerCount = 0) {
    if (connected) {
      this.connectionStatus.style.color = '#44ff44';
      this.connectionStatus.textContent = `Online: ${playerCount} player${playerCount !== 1 ? 's' : ''}`;
    } else {
      this.connectionStatus.style.color = '#ff4444';
      this.connectionStatus.textContent = 'Disconnected';
    }
  }

  /**
   * Update ping display
   * @param {number} ping - Ping in milliseconds
   */
  updatePing(ping) {
    if (ping > 0) {
      // Color code ping: green < 100ms, yellow < 200ms, red >= 200ms
      let color = '#44ff44';
      if (ping >= 200) {
        color = '#ff4444';
      } else if (ping >= 100) {
        color = '#ffff44';
      }
      this.pingDisplay.style.color = color;
      this.pingDisplay.textContent = `${ping}ms`;
    }
  }

  /**
   * Show a notification that fades out
   * @param {string} message - Notification message
   * @param {number} duration - Duration in milliseconds (minimum 1000ms)
   */
  showNotification(message, duration = 3000) {
    // Ensure minimum duration for fade animation
    const safeDuration = Math.max(1000, duration);
    const fadeTime = 500;

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 1000;
      opacity: 1;
      transition: opacity ${fadeTime}ms ease-out;
      pointer-events: none;
    `;
    notification.textContent = message;
    this.container.appendChild(notification);

    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), fadeTime);
    }, safeDuration - fadeTime);
  }

  /**
   * Show "+1" popup when hitting someone
   * @param {string} targetName - Name of player hit
   * @param {number} newScore - New score after hit
   */
  showHitNotification(targetName, newScore) {
    // "+1" popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #44ff44;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 48px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 1000;
    `;
    popup.textContent = '+1';
    document.body.appendChild(popup);

    // Target name below
    const namePopup = document.createElement('div');
    namePopup.style.cssText = `
      position: fixed;
      top: 55%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 18px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 1000;
    `;
    namePopup.textContent = `Hit ${targetName}!`;
    document.body.appendChild(namePopup);

    // Animate both up and fade
    let opacity = 1;
    let offsetY = 0;
    const animate = () => {
      opacity -= 0.015;
      offsetY -= 1.5;
      if (opacity <= 0) {
        popup.remove();
        namePopup.remove();
        return;
      }
      popup.style.opacity = String(opacity);
      popup.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
      namePopup.style.opacity = String(opacity);
      namePopup.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /**
   * Flash screen red when hit by another player
   */
  showGotHitEffect() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 0, 0, 0.3);
      pointer-events: none;
      z-index: 999;
    `;
    document.body.appendChild(flash);

    // Quick fade
    let opacity = 0.3;
    const fade = () => {
      opacity -= 0.02;
      if (opacity <= 0) {
        flash.remove();
        return;
      }
      flash.style.background = `rgba(255, 0, 0, ${opacity})`;
      requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  /**
   * Create loading indicator for tile loading state
   * Shows centered message when many tiles are loading
   */
  createLoadingIndicator() {
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.id = 'loading-indicator';
    this.loadingIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16px;
      background: rgba(0,0,0,0.7);
      padding: 10px 20px;
      border-radius: 8px;
      pointer-events: none;
      display: none;
      z-index: 1000;
    `;
    this.loadingIndicator.textContent = 'Loading terrain...';
    this.container.appendChild(this.loadingIndicator);

    // Track tile stats element (created lazily)
    this.tileStats = null;
  }

  /**
   * Update tile loading indicator based on queue state
   * Shows indicator when many tiles are downloading/parsing
   * @param {TilesRenderer} tilesRenderer - The 3D tiles renderer
   */
  updateTileLoading(tilesRenderer) {
    if (!tilesRenderer || !this.loadingIndicator) return;

    // Safely access queue sizes (API may vary between versions)
    const downloading = tilesRenderer.downloadQueue?.itemsInList ?? 0;
    const parsing = tilesRenderer.parseQueue?.itemsInList ?? 0;

    // Show indicator if many tiles loading (thresholds tuned for good UX)
    if (downloading > 20 || parsing > 5) {
      this.loadingIndicator.textContent = `Loading terrain... (${downloading} tiles)`;
      this.loadingIndicator.style.display = 'block';
    } else {
      this.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * Show debug tile statistics (call when CONFIG.debug.showTileStats is true)
   * Creates element lazily on first call
   * @param {TilesRenderer} tilesRenderer - The 3D tiles renderer
   */
  showTileStats(tilesRenderer) {
    if (!tilesRenderer) return;

    // Create stats element on first call
    if (!this.tileStats) {
      this.tileStats = document.createElement('div');
      this.tileStats.id = 'tile-stats';
      this.tileStats.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 10px;
        color: #aaa;
        font-family: monospace;
        font-size: 12px;
        background: rgba(0,0,0,0.5);
        padding: 5px 8px;
        border-radius: 4px;
        pointer-events: none;
      `;
      this.container.appendChild(this.tileStats);
    }

    // Safely access cache and queue stats
    const cache = tilesRenderer.lruCache;
    const cachedBytes = cache?.cachedBytes ?? 0;
    const maxBytes = cache?.maxBytesSize ?? 0;
    const cacheMB = (cachedBytes / 1e6).toFixed(1);
    const maxMB = (maxBytes / 1e6).toFixed(0);
    const downloading = tilesRenderer.downloadQueue?.itemsInList ?? 0;
    const parsing = tilesRenderer.parseQueue?.itemsInList ?? 0;

    this.tileStats.innerHTML = `Cache: ${cacheMB}/${maxMB} MB | Queue: ${downloading}↓ ${parsing}⚙`;
  }
}
