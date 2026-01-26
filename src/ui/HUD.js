/**
 * HUD - Heads-Up Display for flight information
 * Shows speed (knots), altitude (meters), and control hints
 */

export class HUD {
  constructor(container) {
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
}
