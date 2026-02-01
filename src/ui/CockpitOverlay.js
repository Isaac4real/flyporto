/**
 * CockpitOverlay - Immersive cockpit frame + simple instrument panel
 * Pure HTML/CSS overlay for cockpit view mode.
 */

export class CockpitOverlay {
  constructor(container) {
    this.container = container;
    this.createUI();
  }

  createUI() {
    this.element = document.createElement('div');
    this.element.id = 'cockpit-overlay';
    this.element.innerHTML = `
      <div class="cockpit-canopy">
        <div class="canopy-bar left"></div>
        <div class="canopy-bar right"></div>
        <div class="canopy-arch"></div>
        <div class="canopy-strut left"></div>
        <div class="canopy-strut right"></div>
      </div>
      <div class="cockpit-dashboard"></div>
      <div class="cockpit-hud">
        <div class="hud-tape">
          <div class="tape-label">SPD</div>
          <div class="tape-value" id="cockpit-speed">---</div>
          <div class="tape-unit">KTS</div>
        </div>
        <div class="hud-center">
          <div class="reticle"></div>
          <div class="heading-strip">
            <span>270</span><span>300</span><span>330</span><span>360</span><span>030</span><span>060</span><span>090</span>
          </div>
        </div>
        <div class="hud-tape">
          <div class="tape-label">ALT</div>
          <div class="tape-value" id="cockpit-altitude">---</div>
          <div class="tape-unit">M</div>
        </div>
      </div>
      <div class="cockpit-panel">
        <div class="panel-title">FLIGHT SYSTEMS</div>
        <div class="panel-row">
          <div class="panel-gauge">
            <div class="gauge-label">THR</div>
            <div class="gauge-bar"><span id="cockpit-throttle"></span></div>
          </div>
          <div class="panel-gauge">
            <div class="gauge-label">ENG</div>
            <div class="gauge-bar"><span class="ok"></span></div>
          </div>
          <div class="panel-gauge">
            <div class="gauge-label">HYD</div>
            <div class="gauge-bar"><span class="ok"></span></div>
          </div>
        </div>
        <div class="panel-row">
          <div class="panel-chip">AUTO-TRIM</div>
          <div class="panel-chip">RADAR</div>
          <div class="panel-chip">V: VIEW</div>
        </div>
      </div>
      <div class="cockpit-glass"></div>
    `;

    this.container.appendChild(this.element);
    this.speedEl = this.element.querySelector('#cockpit-speed');
    this.altitudeEl = this.element.querySelector('#cockpit-altitude');
    this.throttleEl = this.element.querySelector('#cockpit-throttle');

    this.addStyles();
    this.setVisible(false);
  }

  addStyles() {
    if (document.getElementById('cockpit-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'cockpit-overlay-styles';
    style.textContent = `
      #cockpit-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9000;
        font-family: "SF Pro Display", "Segoe UI", system-ui, sans-serif;
        color: rgba(210, 255, 235, 0.9);
        opacity: 0;
        transition: opacity 0.25s ease;
      }

      #cockpit-overlay.visible {
        opacity: 1;
      }

      .cockpit-canopy {
        position: absolute;
        inset: 0;
      }

      .canopy-bar {
        position: absolute;
        top: 0;
        width: 20%;
        height: 100%;
        background: linear-gradient(180deg, rgba(16, 22, 28, 0.95) 0%, rgba(12, 18, 22, 0.82) 45%, rgba(10, 16, 20, 0.7) 100%);
        border-left: 1px solid rgba(160, 190, 210, 0.18);
        border-right: 1px solid rgba(160, 190, 210, 0.18);
      }

      .canopy-bar.left {
        left: 0;
      }

      .canopy-bar.right {
        right: 0;
      }

      .canopy-arch {
        position: absolute;
        top: -10%;
        left: 50%;
        width: 125%;
        height: 52%;
        transform: translateX(-50%);
        border: 2px solid rgba(170, 210, 230, 0.25);
        border-radius: 50%;
        box-shadow: inset 0 0 30px rgba(170, 210, 230, 0.12);
      }

      .canopy-strut {
        position: absolute;
        top: 10%;
        width: 3px;
        height: 58%;
        background: linear-gradient(180deg, rgba(190, 210, 220, 0.35), rgba(120, 150, 165, 0.55));
        box-shadow: 0 0 12px rgba(90, 110, 120, 0.35);
      }

      .canopy-strut.left {
        left: 38%;
        transform: rotate(6deg);
      }

      .canopy-strut.right {
        right: 38%;
        transform: rotate(-6deg);
      }

      .cockpit-dashboard {
        position: absolute;
        left: 50%;
        bottom: -6%;
        transform: translateX(-50%);
        width: min(900px, 110%);
        height: 38%;
        background: radial-gradient(circle at 50% 0%, rgba(26, 34, 40, 0.9), rgba(10, 14, 18, 0.98));
        border-top: 2px solid rgba(170, 200, 220, 0.25);
        border-radius: 32px 32px 0 0;
        box-shadow: 0 -30px 50px rgba(0, 0, 0, 0.6);
      }

      .cockpit-glass {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 20%, rgba(120, 200, 220, 0.06), transparent 45%),
          radial-gradient(circle at 80% 30%, rgba(120, 200, 220, 0.05), transparent 40%),
          linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 100%);
        mix-blend-mode: screen;
      }

      .cockpit-hud {
        position: absolute;
        top: 12%;
        left: 50%;
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: 120px 240px 120px;
        align-items: center;
        gap: 18px;
        text-shadow: 0 0 12px rgba(110, 255, 160, 0.45);
      }

      .hud-tape {
        border: 1px solid rgba(160, 240, 200, 0.35);
        padding: 10px 12px;
        background: rgba(8, 16, 14, 0.45);
        backdrop-filter: blur(4px);
        border-radius: 8px;
        text-align: center;
      }

      .tape-label {
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        opacity: 0.7;
      }

      .tape-value {
        font-size: 26px;
        font-weight: 700;
      }

      .tape-unit {
        font-size: 10px;
        letter-spacing: 2px;
        opacity: 0.6;
      }

      .hud-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .reticle {
        width: 42px;
        height: 42px;
        border: 1px solid rgba(170, 255, 210, 0.7);
        border-radius: 50%;
        position: relative;
      }

      .reticle::before,
      .reticle::after {
        content: '';
        position: absolute;
        background: rgba(160, 255, 200, 0.8);
      }

      .reticle::before {
        width: 1px;
        height: 100%;
        left: 50%;
        top: 0;
        transform: translateX(-50%);
      }

      .reticle::after {
        height: 1px;
        width: 100%;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
      }

      .heading-strip {
        display: flex;
        gap: 12px;
        font-size: 11px;
        letter-spacing: 1px;
        opacity: 0.7;
      }

      .cockpit-panel {
        position: absolute;
        left: 50%;
        bottom: 2%;
        transform: translateX(-50%);
        width: min(720px, 90%);
        background: linear-gradient(180deg, rgba(14, 20, 26, 0.85), rgba(6, 10, 14, 0.95));
        border-top: 2px solid rgba(120, 160, 180, 0.35);
        border-radius: 18px 18px 0 0;
        padding: 16px 22px 24px;
        box-shadow: 0 -20px 40px rgba(0, 0, 0, 0.5);
      }

      .panel-title {
        font-size: 12px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: rgba(180, 220, 230, 0.6);
        margin-bottom: 12px;
      }

      .panel-row {
        display: flex;
        gap: 14px;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .panel-gauge {
        flex: 1;
        background: rgba(8, 14, 16, 0.7);
        border: 1px solid rgba(80, 140, 160, 0.3);
        border-radius: 10px;
        padding: 10px 12px;
      }

      .gauge-label {
        font-size: 11px;
        letter-spacing: 2px;
        opacity: 0.6;
        margin-bottom: 6px;
      }

      .gauge-bar {
        height: 8px;
        background: rgba(20, 30, 35, 0.9);
        border-radius: 999px;
        overflow: hidden;
      }

      .gauge-bar span {
        display: block;
        height: 100%;
        width: 80%;
        background: linear-gradient(90deg, rgba(80, 255, 160, 0.2), rgba(80, 255, 160, 0.8));
      }

      .gauge-bar span.ok {
        width: 90%;
      }

      .panel-chip {
        flex: 1;
        text-align: center;
        padding: 8px 10px;
        font-size: 11px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        background: rgba(10, 16, 18, 0.8);
        border: 1px solid rgba(80, 140, 160, 0.4);
        border-radius: 8px;
        color: rgba(160, 220, 200, 0.8);
      }

      @media (max-width: 720px) {
        .cockpit-hud {
          grid-template-columns: 90px 180px 90px;
        }

        .cockpit-panel {
          width: 96%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  setVisible(isVisible) {
    this.element.classList.toggle('visible', isVisible);
  }

  update(speed, altitude, throttle = 0.4) {
    if (!this.speedEl || !this.altitudeEl || !this.throttleEl) return;

    const knots = Math.round(speed * 1.944);
    this.speedEl.textContent = knots.toString().padStart(3, '0');
    this.altitudeEl.textContent = Math.round(altitude).toString().padStart(4, '0');
    this.throttleEl.style.width = `${Math.round(throttle * 100)}%`;
  }
}
