import { ROUTES, getAllRoutes } from '../data/landmarks.js';

/**
 * RouteSelector - UI for choosing a race route
 *
 * Displays available routes with:
 * - Route name and description
 * - Difficulty indicator (easy/medium/hard)
 * - Checkpoint count and estimated time
 * - Medal time thresholds
 */
export class RouteSelector {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.onRouteSelected = null;
    this.onClose = null;
    this.visible = false;

    this.createUI();
    this.addStyles();
  }

  createUI() {
    this.element = document.createElement('div');
    this.element.id = 'route-selector';
    this.element.className = 'route-selector';

    const routes = getAllRoutes();

    this.element.innerHTML = `
      <div class="route-selector-backdrop"></div>
      <div class="route-selector-content">
        <button class="route-selector-close" aria-label="Close">&times;</button>

        <h2 class="route-selector-title">Choose Your Route</h2>
        <p class="route-selector-subtitle">
          Race through San Francisco landmarks!
        </p>

        <div class="routes-list">
          ${routes.map(route => this.createRouteCard(route)).join('')}
        </div>

        <p class="route-selector-hint">
          Press <kbd>R</kbd> anytime to open this menu
        </p>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  createRouteCard(route) {
    const difficultyColors = {
      easy: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80', border: 'rgba(74, 222, 128, 0.3)' },
      medium: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
      hard: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }
    };

    const colors = difficultyColors[route.difficulty];

    return `
      <div class="route-card" data-route-id="${route.id}">
        <div class="route-card-header">
          <div class="route-card-info">
            <div class="route-card-name">${route.name}</div>
            <div class="route-card-stats">
              ${route.checkpoints.length} checkpoints
            </div>
          </div>
          <div class="route-card-difficulty" style="
            background: ${colors.bg};
            color: ${colors.text};
            border: 1px solid ${colors.border};
          ">
            ${route.difficulty}
          </div>
        </div>

        <div class="route-card-description">${route.description}</div>

        <div class="route-card-medals">
          <span class="medal gold" title="Gold medal time">&#129351; ${route.medalTimes.gold}s</span>
          <span class="medal silver" title="Silver medal time">&#129352; ${route.medalTimes.silver}s</span>
          <span class="medal bronze" title="Bronze medal time">&#129353; ${route.medalTimes.bronze}s</span>
        </div>
      </div>
    `;
  }

  addStyles() {
    if (document.getElementById('route-selector-styles')) return;

    const style = document.createElement('style');
    style.id = 'route-selector-styles';
    style.textContent = `
      .route-selector {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .route-selector.visible {
        display: flex;
      }

      .route-selector-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .route-selector-content {
        position: relative;
        background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 35, 0.98) 100%);
        border-radius: 20px;
        padding: 32px;
        max-width: 520px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      }

      .route-selector-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 50%;
        color: rgba(255, 255, 255, 0.6);
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        line-height: 1;
      }

      .route-selector-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .route-selector-title {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
        color: white;
        text-align: center;
      }

      .route-selector-subtitle {
        margin: 0 0 28px;
        font-size: 15px;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
      }

      .routes-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .route-card {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 18px;
        cursor: pointer;
        transition: all 0.25s ease;
      }

      .route-card:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      }

      .route-card:active {
        transform: translateY(0);
      }

      .route-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
      }

      .route-card-info {
        flex: 1;
      }

      .route-card-name {
        font-size: 18px;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
      }

      .route-card-stats {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
      }

      .route-card-difficulty {
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .route-card-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
        margin-bottom: 12px;
      }

      .route-card-medals {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
      }

      .route-card-medals .medal {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .route-card-medals .medal.gold { color: #ffd700; }
      .route-card-medals .medal.silver { color: #c0c0c0; }
      .route-card-medals .medal.bronze { color: #cd7f32; }

      .route-selector-hint {
        margin: 24px 0 0;
        text-align: center;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.35);
      }

      .route-selector-hint kbd {
        display: inline-block;
        padding: 3px 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
      }

      /* Mobile adjustments */
      @media (max-width: 500px) {
        .route-selector-content {
          padding: 24px 20px;
          border-radius: 16px;
        }

        .route-selector-title {
          font-size: 24px;
        }

        .route-card {
          padding: 14px;
        }

        .route-card-name {
          font-size: 16px;
        }

        .route-card-medals {
          flex-wrap: wrap;
          gap: 10px;
        }
      }

      /* Scrollbar styling */
      .route-selector-content::-webkit-scrollbar {
        width: 8px;
      }

      .route-selector-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }

      .route-selector-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      .route-selector-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents() {
    // Close button
    this.element.querySelector('.route-selector-close').addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });

    // Backdrop click
    this.element.querySelector('.route-selector-backdrop').addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });

    // Route card clicks
    const cards = this.element.querySelectorAll('.route-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const routeId = card.dataset.routeId;
        const route = Object.values(ROUTES).find(r => r.id === routeId);
        if (route) {
          this.selectRoute(route);
        }
      });
    });

    // ESC to close
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.visible) {
        this.hide();
        this.onClose?.();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  selectRoute(route) {
    this.hide();
    if (this.onRouteSelected) {
      this.onRouteSelected(route);
    }
  }

  show() {
    this.visible = true;
    this.element.classList.add('visible');
  }

  hide() {
    this.visible = false;
    this.element.classList.remove('visible');
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if selector is visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    document.removeEventListener('keydown', this._escHandler);
    this.element?.remove();
    document.getElementById('route-selector-styles')?.remove();
  }
}
