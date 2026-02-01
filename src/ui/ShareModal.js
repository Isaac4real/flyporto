/**
 * ShareModal.js
 * Post-race share modal with image preview and share buttons
 *
 * Features:
 * - Large preview of composited screenshot
 * - One-click Twitter share button
 * - Download button for manual sharing
 * - Copy to clipboard button
 * - Native share (mobile)
 * - Close/dismiss option
 */
export class ShareModal {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.previewUrl = null;
    this.raceData = null;

    // Callbacks
    this.onShareTwitter = null;
    this.onDownload = null;
    this.onCopy = null;
    this.onNativeShare = null;
    this.onClose = null;
    this.onPlayAgain = null;

    // Event handlers (stored for cleanup)
    this._escHandler = null;

    this._injectStyles();
  }

  /**
   * Show the share modal with captured screenshot
   *
   * @param {Object} captureResult - From ShareManager.captureRaceCompletion
   * @param {Blob} captureResult.blob
   * @param {string} captureResult.dataUrl
   * @param {Object} captureResult.raceData
   */
  show(captureResult) {
    this.previewUrl = captureResult.dataUrl;
    this.raceData = captureResult.raceData;

    // Create modal HTML
    this.element = document.createElement('div');
    this.element.className = 'share-modal';

    // Check if native share is available (mobile)
    const hasNativeShare = navigator.share && navigator.canShare;

    this.element.innerHTML = `
      <div class="share-modal-backdrop"></div>
      <div class="share-modal-content">
        <button class="share-modal-close" aria-label="Close">&times;</button>

        <h2 class="share-modal-title">Share Your Achievement!</h2>

        <div class="share-modal-preview">
          <img src="${this.previewUrl}" alt="Race screenshot" />
        </div>

        <div class="share-modal-stats">
          <div class="share-stat">
            <span class="share-stat-value">${this._formatTime(this.raceData.totalTime)}</span>
            <span class="share-stat-label">Time</span>
          </div>
          <div class="share-stat">
            <span class="share-stat-value">${this.raceData.checkpointCount}</span>
            <span class="share-stat-label">Checkpoints</span>
          </div>
          ${this.raceData.medal ? `
            <div class="share-stat">
              <span class="share-stat-value share-stat-medal share-stat-medal-${this.raceData.medal}">
                ${this._getMedalEmoji(this.raceData.medal)}
              </span>
              <span class="share-stat-label">${this.raceData.medal}</span>
            </div>
          ` : ''}
        </div>

        <div class="share-modal-actions">
          <button class="share-btn share-btn-twitter" data-action="twitter">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share to X
          </button>

          ${hasNativeShare ? `
            <button class="share-btn share-btn-native" data-action="native">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
              </svg>
              Share
            </button>
          ` : ''}

          <button class="share-btn share-btn-download" data-action="download">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download
          </button>

          <button class="share-btn share-btn-copy" data-action="copy">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>

        <p class="share-modal-hint">
          Download or copy the image, then paste it into your post!
        </p>

        <button class="share-btn share-btn-play-again" data-action="play-again">
          Race Again
        </button>
      </div>
    `;

    // Add to DOM
    this.container.appendChild(this.element);

    // Bind events
    this._bindEvents();

    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    // Close button
    this.element.querySelector('.share-modal-close').addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });

    // Backdrop click
    this.element.querySelector('.share-modal-backdrop').addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });

    // Action buttons
    this.element.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this._handleAction(e));
    });

    // ESC to close
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
        this.onClose?.();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  /**
   * Handle button actions
   * @private
   */
  async _handleAction(e) {
    const action = e.currentTarget.dataset.action;

    switch (action) {
      case 'twitter':
        this.onShareTwitter?.();
        break;

      case 'native':
        await this.onNativeShare?.();
        break;

      case 'download':
        this.onDownload?.();
        break;

      case 'copy':
        const copyBtn = e.currentTarget;
        const success = await this.onCopy?.();

        if (success) {
          const originalHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Copied!
          `;
          copyBtn.classList.add('success');

          setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
            copyBtn.classList.remove('success');
          }, 2000);
        }
        break;

      case 'play-again':
        this.hide();
        this.onPlayAgain?.();
        break;
    }
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.element) return;

    this.element.classList.remove('visible');

    setTimeout(() => {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }, 300);

    // Clean up event listener
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    // Clean up preview URL
    // Note: Don't revoke here as ShareManager may still need it
  }

  /**
   * Check if modal is visible
   * @returns {boolean}
   */
  isVisible() {
    return this.element !== null && this.element.classList.contains('visible');
  }

  /**
   * Format time for display
   * @private
   */
  _formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}:${seconds.padStart(5, '0')}`;
    }
    return `${seconds}s`;
  }

  /**
   * Get medal emoji
   * @private
   */
  _getMedalEmoji(medal) {
    const emojis = {
      gold: '\u{1F947}',
      silver: '\u{1F948}',
      bronze: '\u{1F949}'
    };
    return emojis[medal] || '';
  }

  /**
   * Inject styles
   * @private
   */
  _injectStyles() {
    if (document.getElementById('share-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'share-modal-styles';
    style.textContent = `
      .share-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .share-modal.visible {
        opacity: 1;
      }

      .share-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .share-modal-content {
        position: relative;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 20px;
        padding: 28px;
        max-width: 480px;
        width: 92%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform: translateY(20px);
        transition: transform 0.3s ease;
      }

      .share-modal.visible .share-modal-content {
        transform: translateY(0);
      }

      .share-modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        font-size: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        line-height: 1;
      }

      .share-modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .share-modal-title {
        text-align: center;
        color: #00ff88;
        font-size: 24px;
        margin: 0 0 20px;
        font-weight: 700;
      }

      .share-modal-preview {
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .share-modal-preview img {
        width: 100%;
        height: auto;
        display: block;
      }

      .share-modal-stats {
        display: flex;
        justify-content: center;
        gap: 32px;
        margin-bottom: 24px;
        padding: 16px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
      }

      .share-stat {
        text-align: center;
      }

      .share-stat-value {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #00ff88;
        font-variant-numeric: tabular-nums;
      }

      .share-stat-medal {
        font-size: 32px;
      }

      .share-stat-medal-gold { color: #ffd700; }
      .share-stat-medal-silver { color: #c0c0c0; }
      .share-stat-medal-bronze { color: #cd7f32; }

      .share-stat-label {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
      }

      .share-modal-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .share-btn {
        flex: 1;
        min-width: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px 18px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .share-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      }

      .share-btn:active {
        transform: translateY(0);
      }

      .share-btn-twitter {
        background: #000;
        color: white;
      }

      .share-btn-twitter:hover {
        background: #1a1a1a;
      }

      .share-btn-native {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .share-btn-download,
      .share-btn-copy {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .share-btn-download:hover,
      .share-btn-copy:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .share-btn-copy.success {
        background: rgba(74, 222, 128, 0.2);
        border-color: rgba(74, 222, 128, 0.4);
        color: #4ade80;
      }

      .share-modal-hint {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
        margin: 0 0 20px;
      }

      .share-btn-play-again {
        width: 100%;
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        color: #000;
        font-size: 16px;
        font-weight: 700;
        padding: 16px;
      }

      .share-btn-play-again:hover {
        box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
      }

      /* Mobile adjustments */
      @media (max-width: 480px) {
        .share-modal-content {
          padding: 20px;
          border-radius: 16px;
        }

        .share-modal-title {
          font-size: 20px;
        }

        .share-modal-actions {
          flex-direction: column;
        }

        .share-btn {
          min-width: auto;
        }

        .share-modal-stats {
          gap: 20px;
        }

        .share-stat-value {
          font-size: 24px;
        }
      }

      /* Scrollbar */
      .share-modal-content::-webkit-scrollbar {
        width: 6px;
      }

      .share-modal-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }

      .share-modal-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.hide();
    document.getElementById('share-modal-styles')?.remove();
  }
}
