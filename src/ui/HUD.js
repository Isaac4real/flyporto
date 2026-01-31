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
      <div id="hud-hints">WASD to fly | Space to level out</div>
    `;
    container.appendChild(this.element);

    this.speedEl = document.getElementById('hud-speed');
    this.altitudeEl = document.getElementById('hud-altitude');
    this.hintsEl = document.getElementById('hud-hints');

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

    // Fade out control hints after 10 seconds
    setTimeout(() => {
      this.hintsEl.classList.add('hidden');
    }, 10000);
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
}
