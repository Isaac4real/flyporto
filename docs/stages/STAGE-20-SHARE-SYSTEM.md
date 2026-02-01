# Stage 20: One-Click Share System

## Overview

This stage implements a complete share system that allows players to capture their race achievements as images and share them to Twitter/X with one click. Due to Twitter Web Intent API limitations (cannot upload images directly), we implement a dual approach: beautiful downloadable images with pre-filled tweet text linking back to the game.

## Technical Constraints

### Twitter Web Intent API Limitations
The Twitter Web Intent API (`https://twitter.com/intent/tweet`) only supports:
- `text` - Pre-filled tweet text (max 280 chars)
- `url` - Link to share
- `hashtags` - Comma-separated hashtags
- `via` - Attribution handle

**Critical Limitation**: Cannot upload images directly. Images must be:
1. Downloaded by user and manually attached, OR
2. Served via URL with Open Graph meta tags for link previews

### WebGL Screenshot Constraints
- Must set `preserveDrawingBuffer: true` on WebGLRenderer (performance cost ~5-10%)
- Canvas must be captured AFTER render, BEFORE next frame
- `toBlob()` is async - need to handle timing carefully
- Large canvases may cause memory pressure on mobile

## Architecture

```
src/
├── share/
│   ├── ScreenshotCapture.js   # WebGL canvas capture
│   ├── ShareImageCompositor.js # Add overlays to screenshots
│   ├── ShareManager.js         # Orchestrates capture → composite → share
│   └── TwitterIntent.js        # Twitter Web Intent URL builder
├── ui/
│   └── ShareModal.js           # Share UI after race completion
```

## Implementation Files

### 1. ScreenshotCapture.js

Captures the WebGL canvas as an image blob. Must handle the async nature of toBlob() and the timing relative to the render loop.

```javascript
/**
 * ScreenshotCapture.js
 * Captures WebGL canvas to image blob
 *
 * CRITICAL: Renderer must be created with { preserveDrawingBuffer: true }
 * This has a ~5-10% performance cost but is required for screenshots.
 */

export class ScreenshotCapture {
  /**
   * @param {THREE.WebGLRenderer} renderer - Must have preserveDrawingBuffer: true
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;

    // Verify preserveDrawingBuffer is enabled
    const gl = renderer.getContext();
    const contextAttributes = gl.getContextAttributes();
    if (!contextAttributes.preserveDrawingBuffer) {
      console.warn('[ScreenshotCapture] preserveDrawingBuffer is false - screenshots may be blank!');
    }
  }

  /**
   * Capture current canvas state as blob
   * MUST be called immediately after renderer.render(), before next frame
   *
   * @param {string} format - 'image/png' or 'image/jpeg'
   * @param {number} quality - JPEG quality 0-1 (ignored for PNG)
   * @returns {Promise<Blob>}
   */
  capture(format = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
      try {
        this.canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          format,
          quality
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Capture as data URL (for immediate display)
   * @returns {string} Base64 data URL
   */
  captureDataURL(format = 'image/png', quality = 0.92) {
    return this.canvas.toDataURL(format, quality);
  }

  /**
   * Get canvas dimensions
   * @returns {{width: number, height: number}}
   */
  getDimensions() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }
}
```

### 2. ShareImageCompositor.js

Composites the game screenshot with race results overlay. Creates a beautiful shareable image with time, route name, and branding.

```javascript
/**
 * ShareImageCompositor.js
 * Composites game screenshot with race results overlay
 *
 * Creates a branded image suitable for social sharing with:
 * - Semi-transparent overlay at bottom
 * - Route name and completion time
 * - Game branding/logo
 * - Optional player name
 */

export class ShareImageCompositor {
  constructor(options = {}) {
    this.options = {
      overlayHeight: 120,           // Height of bottom overlay in pixels
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      primaryFont: 'bold 36px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      secondaryFont: '24px "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      accentColor: '#00ff88',       // Neon green for times
      textColor: '#ffffff',
      brandingText: 'FLYSF.IO',     // Game branding
      ...options
    };

    // Create offscreen canvas for compositing
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Composite screenshot with race results
   *
   * @param {Blob|HTMLCanvasElement|HTMLImageElement} screenshot - Base image
   * @param {Object} raceData - Race completion data
   * @param {string} raceData.routeName - Name of the route completed
   * @param {number} raceData.totalTime - Total time in milliseconds
   * @param {number} raceData.checkpointCount - Number of checkpoints
   * @param {string} [raceData.playerName] - Optional player name
   * @returns {Promise<Blob>} Composited image blob
   */
  async composite(screenshot, raceData) {
    // Load screenshot into image element
    const img = await this._loadImage(screenshot);

    // Set canvas to match screenshot dimensions
    this.canvas.width = img.width;
    this.canvas.height = img.height;

    // Draw base screenshot
    this.ctx.drawImage(img, 0, 0);

    // Draw overlay
    this._drawOverlay(raceData);

    // Return as blob
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Composite toBlob failed')),
        'image/png'
      );
    });
  }

  /**
   * Load various image sources into HTMLImageElement
   * @private
   */
  _loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;

      if (source instanceof Blob) {
        img.src = URL.createObjectURL(source);
        img.onload = () => {
          URL.revokeObjectURL(img.src);  // Clean up
          resolve(img);
        };
      } else if (source instanceof HTMLCanvasElement) {
        img.src = source.toDataURL();
      } else if (source instanceof HTMLImageElement) {
        resolve(source);
        return;
      } else if (typeof source === 'string') {
        img.src = source;  // Data URL or regular URL
      } else {
        reject(new Error('Unknown image source type'));
      }
    });
  }

  /**
   * Draw the results overlay on the canvas
   * @private
   */
  _drawOverlay(raceData) {
    const { width, height } = this.canvas;
    const { overlayHeight, overlayColor, primaryFont, secondaryFont, accentColor, textColor, brandingText } = this.options;

    // Semi-transparent bottom overlay
    const gradient = this.ctx.createLinearGradient(0, height - overlayHeight - 40, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.3, overlayColor);
    gradient.addColorStop(1, overlayColor);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, height - overlayHeight - 40, width, overlayHeight + 40);

    // Format time
    const timeStr = this._formatTime(raceData.totalTime);

    // Route name (left side)
    this.ctx.font = secondaryFont;
    this.ctx.fillStyle = textColor;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(raceData.routeName.toUpperCase(), 30, height - overlayHeight + 30);

    // Large time display (center-left)
    this.ctx.font = primaryFont;
    this.ctx.fillStyle = accentColor;
    this.ctx.fillText(timeStr, 30, height - 35);

    // Checkpoint count
    this.ctx.font = secondaryFont;
    this.ctx.fillStyle = textColor;
    const checkpointText = `${raceData.checkpointCount} CHECKPOINTS`;
    this.ctx.fillText(checkpointText, 30, height - 75);

    // Branding (right side)
    this.ctx.font = 'bold 28px "SF Pro Display", -apple-system, sans-serif';
    this.ctx.fillStyle = accentColor;
    this.ctx.textAlign = 'right';
    this.ctx.fillText(brandingText, width - 30, height - 35);

    // Optional: Player name
    if (raceData.playerName) {
      this.ctx.font = secondaryFont;
      this.ctx.fillStyle = textColor;
      this.ctx.fillText(`Pilot: ${raceData.playerName}`, width - 30, height - 75);
    }

    // Top-left corner badge
    this._drawCornerBadge();
  }

  /**
   * Draw a small corner badge for branding
   * @private
   */
  _drawCornerBadge() {
    const badgeSize = 60;
    const margin = 20;

    // Semi-transparent background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.beginPath();
    this.ctx.roundRect(margin, margin, badgeSize * 2, badgeSize, 10);
    this.ctx.fill();

    // Aircraft icon (simple triangle)
    this.ctx.fillStyle = this.options.accentColor;
    this.ctx.beginPath();
    const cx = margin + badgeSize;
    const cy = margin + badgeSize / 2;
    this.ctx.moveTo(cx - 15, cy + 10);
    this.ctx.lineTo(cx + 15, cy);
    this.ctx.lineTo(cx - 15, cy - 10);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Format milliseconds to MM:SS.mmm
   * @private
   */
  _formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((ms % 1000));

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Get the composited canvas (for preview)
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }
}
```

### 3. TwitterIntent.js

Builds Twitter Web Intent URLs with proper encoding and character limits.

```javascript
/**
 * TwitterIntent.js
 * Builds Twitter Web Intent URLs for sharing
 *
 * Twitter Web Intent API Reference:
 * https://developer.twitter.com/en/docs/twitter-for-websites/tweet-button/guides/web-intent
 *
 * Supported parameters:
 * - text: Pre-filled tweet text (max ~250 chars to leave room for URL)
 * - url: Link to share
 * - hashtags: Comma-separated (no # symbol)
 * - via: Attribution handle (no @ symbol)
 */

export class TwitterIntent {
  constructor(options = {}) {
    this.options = {
      baseUrl: 'https://twitter.com/intent/tweet',
      defaultHashtags: ['flysf', 'flightsim'],
      via: null,  // Set to your Twitter handle without @
      gameUrl: 'https://flysf.io',  // Update to actual game URL
      ...options
    };
  }

  /**
   * Build tweet URL for race completion
   *
   * @param {Object} raceData
   * @param {string} raceData.routeName - Route completed
   * @param {number} raceData.totalTime - Time in milliseconds
   * @param {number} raceData.checkpointCount - Number of checkpoints
   * @param {string} [raceData.playerName] - Optional player name
   * @returns {string} Twitter intent URL
   */
  buildRaceShareUrl(raceData) {
    const timeStr = this._formatTime(raceData.totalTime);

    // Craft engaging tweet text
    // Keep under ~230 chars to leave room for URL and t.co wrapping
    let text = `✈️ Just flew the ${raceData.routeName} route in ${timeStr}!\n\n`;
    text += `${raceData.checkpointCount} checkpoints over San Francisco 🌉\n\n`;
    text += `Can you beat my time?`;

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('url', this._buildShareUrl(raceData));
    params.set('hashtags', this.options.defaultHashtags.join(','));

    if (this.options.via) {
      params.set('via', this.options.via);
    }

    return `${this.options.baseUrl}?${params.toString()}`;
  }

  /**
   * Build a deep link URL that could load the same route
   * @private
   */
  _buildShareUrl(raceData) {
    // Could include route ID for deep linking
    // e.g., https://flysf.io/?route=golden-gate-tour
    const url = new URL(this.options.gameUrl);

    // Add route parameter if we want deep linking
    if (raceData.routeId) {
      url.searchParams.set('route', raceData.routeId);
    }

    return url.toString();
  }

  /**
   * Build generic share URL (not race-specific)
   */
  buildGenericShareUrl(customText = null) {
    const text = customText || '✈️ Flying over San Francisco in photorealistic 3D! Come join me:';

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('url', this.options.gameUrl);
    params.set('hashtags', this.options.defaultHashtags.join(','));

    if (this.options.via) {
      params.set('via', this.options.via);
    }

    return `${this.options.baseUrl}?${params.toString()}`;
  }

  /**
   * Open Twitter intent in new window
   * @param {string} intentUrl
   */
  openIntent(intentUrl) {
    // Twitter recommends specific window dimensions
    const width = 550;
    const height = 420;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    window.open(
      intentUrl,
      'twitter-share',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  /**
   * Format milliseconds to readable time
   * @private
   */
  _formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}
```

### 4. ShareManager.js

Orchestrates the entire share flow: capture → composite → present options.

```javascript
/**
 * ShareManager.js
 * Orchestrates screenshot capture, compositing, and sharing
 *
 * Flow:
 * 1. Capture WebGL canvas immediately after race completion render
 * 2. Composite with race results overlay
 * 3. Present share modal with options
 */

import { ScreenshotCapture } from './ScreenshotCapture.js';
import { ShareImageCompositor } from './ShareImageCompositor.js';
import { TwitterIntent } from './TwitterIntent.js';

export class ShareManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {Object} options
   */
  constructor(renderer, options = {}) {
    this.screenshotCapture = new ScreenshotCapture(renderer);
    this.compositor = new ShareImageCompositor(options.compositor);
    this.twitterIntent = new TwitterIntent(options.twitter);

    // Store last capture for sharing
    this.lastCapture = null;
    this.lastRaceData = null;
    this.lastCompositedBlob = null;

    // Callbacks
    this.onCaptureReady = null;  // Called when image is ready for preview
  }

  /**
   * Capture and prepare share image
   * Call this immediately after the final render of the race
   *
   * @param {Object} raceData - Race completion data
   * @returns {Promise<{blob: Blob, dataUrl: string}>}
   */
  async captureRaceCompletion(raceData) {
    console.log('[ShareManager] Capturing race completion screenshot');

    try {
      // 1. Capture raw screenshot
      const rawBlob = await this.screenshotCapture.capture('image/png');
      this.lastCapture = rawBlob;
      this.lastRaceData = raceData;

      // 2. Composite with overlay
      this.lastCompositedBlob = await this.compositor.composite(rawBlob, raceData);

      // 3. Generate preview URL
      const dataUrl = URL.createObjectURL(this.lastCompositedBlob);

      // Notify listeners
      if (this.onCaptureReady) {
        this.onCaptureReady({
          blob: this.lastCompositedBlob,
          dataUrl,
          raceData
        });
      }

      return { blob: this.lastCompositedBlob, dataUrl };

    } catch (error) {
      console.error('[ShareManager] Capture failed:', error);
      throw error;
    }
  }

  /**
   * Open Twitter share intent
   * Note: User must manually attach the downloaded image
   */
  shareToTwitter() {
    if (!this.lastRaceData) {
      console.warn('[ShareManager] No race data to share');
      return;
    }

    const intentUrl = this.twitterIntent.buildRaceShareUrl(this.lastRaceData);
    this.twitterIntent.openIntent(intentUrl);
  }

  /**
   * Download the composited image
   * User can then manually upload to Twitter
   */
  downloadImage(filename = 'flysf-race.png') {
    if (!this.lastCompositedBlob) {
      console.warn('[ShareManager] No image to download');
      return;
    }

    const url = URL.createObjectURL(this.lastCompositedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy image to clipboard (modern browsers)
   * Allows paste directly into Twitter compose
   */
  async copyToClipboard() {
    if (!this.lastCompositedBlob) {
      console.warn('[ShareManager] No image to copy');
      return false;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': this.lastCompositedBlob
        })
      ]);
      console.log('[ShareManager] Image copied to clipboard');
      return true;
    } catch (error) {
      console.error('[ShareManager] Clipboard copy failed:', error);
      return false;
    }
  }

  /**
   * Get share URLs for other platforms
   */
  getShareUrls() {
    if (!this.lastRaceData) return null;

    const gameUrl = encodeURIComponent(this.twitterIntent.options.gameUrl);
    const text = encodeURIComponent(
      `Just flew the ${this.lastRaceData.routeName} in ${this._formatTime(this.lastRaceData.totalTime)}!`
    );

    return {
      twitter: this.twitterIntent.buildRaceShareUrl(this.lastRaceData),
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${gameUrl}`,
      reddit: `https://reddit.com/submit?url=${gameUrl}&title=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${gameUrl}`
    };
  }

  _formatTime(ms) {
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  }

  /**
   * Clean up object URLs
   */
  dispose() {
    this.lastCapture = null;
    this.lastCompositedBlob = null;
    this.lastRaceData = null;
  }
}
```

### 5. ShareModal.js

The UI component shown after race completion with share options.

```javascript
/**
 * ShareModal.js
 * Post-race share modal with image preview and share buttons
 *
 * Features:
 * - Large preview of composited screenshot
 * - One-click Twitter share button
 * - Download button for manual sharing
 * - Copy to clipboard button
 * - Close/dismiss option
 */

export class ShareModal {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.previewUrl = null;

    // Callbacks
    this.onShareTwitter = null;
    this.onDownload = null;
    this.onCopy = null;
    this.onClose = null;
    this.onPlayAgain = null;
  }

  /**
   * Show the share modal with race results
   *
   * @param {Object} captureResult - From ShareManager.captureRaceCompletion
   * @param {Blob} captureResult.blob
   * @param {string} captureResult.dataUrl
   * @param {Object} captureResult.raceData
   */
  show(captureResult) {
    this.previewUrl = captureResult.dataUrl;
    const { raceData } = captureResult;

    // Create modal HTML
    this.element = document.createElement('div');
    this.element.className = 'share-modal';
    this.element.innerHTML = `
      <div class="share-modal-backdrop"></div>
      <div class="share-modal-content">
        <button class="share-modal-close" aria-label="Close">×</button>

        <h2 class="share-modal-title">🏆 Race Complete!</h2>

        <div class="share-modal-preview">
          <img src="${this.previewUrl}" alt="Race screenshot" />
        </div>

        <div class="share-modal-stats">
          <div class="stat">
            <span class="stat-value">${this._formatTime(raceData.totalTime)}</span>
            <span class="stat-label">Time</span>
          </div>
          <div class="stat">
            <span class="stat-value">${raceData.checkpointCount}</span>
            <span class="stat-label">Checkpoints</span>
          </div>
          <div class="stat">
            <span class="stat-value">${raceData.routeName}</span>
            <span class="stat-label">Route</span>
          </div>
        </div>

        <div class="share-modal-actions">
          <button class="share-btn share-btn-twitter">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share to X
          </button>

          <button class="share-btn share-btn-download">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download
          </button>

          <button class="share-btn share-btn-copy">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>

        <p class="share-modal-hint">
          💡 Tip: Download or copy the image, then paste it into your tweet!
        </p>

        <button class="share-btn share-btn-play-again">
          Play Again
        </button>
      </div>
    `;

    // Add styles
    this._injectStyles();

    // Add to DOM
    this.container.appendChild(this.element);

    // Bind events
    this._bindEvents();

    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
  }

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

    // Twitter share
    this.element.querySelector('.share-btn-twitter').addEventListener('click', () => {
      this.onShareTwitter?.();
    });

    // Download
    this.element.querySelector('.share-btn-download').addEventListener('click', () => {
      this.onDownload?.();
    });

    // Copy
    this.element.querySelector('.share-btn-copy').addEventListener('click', async () => {
      const success = await this.onCopy?.();
      const btn = this.element.querySelector('.share-btn-copy');
      if (success) {
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          `;
        }, 2000);
      }
    });

    // Play again
    this.element.querySelector('.share-btn-play-again').addEventListener('click', () => {
      this.hide();
      this.onPlayAgain?.();
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

  hide() {
    if (!this.element) return;

    this.element.classList.remove('visible');

    setTimeout(() => {
      this.element.remove();
      this.element = null;
    }, 300);

    document.removeEventListener('keydown', this._escHandler);

    // Clean up preview URL
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  _formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}:${seconds.padStart(5, '0')}`;
    }
    return `${seconds}s`;
  }

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
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
      }

      .share-modal-content {
        position: relative;
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform: translateY(20px);
        transition: transform 0.3s ease;
      }

      .share-modal.visible .share-modal-content {
        transform: translateY(0);
      }

      .share-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .share-modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .share-modal-title {
        text-align: center;
        color: #00ff88;
        font-size: 28px;
        margin: 0 0 20px;
        font-weight: 700;
      }

      .share-modal-preview {
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }

      .share-modal-preview img {
        width: 100%;
        height: auto;
        display: block;
      }

      .share-modal-stats {
        display: flex;
        justify-content: space-around;
        margin-bottom: 24px;
        padding: 16px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
      }

      .share-modal-stats .stat {
        text-align: center;
      }

      .share-modal-stats .stat-value {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: #00ff88;
      }

      .share-modal-stats .stat-label {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        margin-top: 4px;
      }

      .share-modal-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }

      .share-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .share-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .share-btn:active {
        transform: translateY(0);
      }

      .share-btn-twitter {
        background: #000;
        color: white;
      }

      .share-btn-download {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .share-btn-copy {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .share-modal-hint {
        text-align: center;
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin-bottom: 20px;
      }

      .share-btn-play-again {
        width: 100%;
        background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
        color: #000;
        font-size: 16px;
        padding: 14px;
      }

      @media (max-width: 480px) {
        .share-modal-content {
          padding: 16px;
        }

        .share-modal-actions {
          flex-direction: column;
        }

        .share-modal-stats .stat-value {
          font-size: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
```

## Integration Points

### 1. Renderer Configuration

Update `src/core/Scene.js` to enable `preserveDrawingBuffer`:

```javascript
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true  // REQUIRED for screenshots (Stage 20)
  });

  // ... rest of setup
  return renderer;
}
```

### 2. Main.js Integration

Wire up ShareManager with CheckpointManager:

```javascript
// In startGame() function, after creating checkpointManager:

import { ShareManager } from './share/ShareManager.js';
import { ShareModal } from './ui/ShareModal.js';

// Initialize share system
const shareManager = new ShareManager(renderer, {
  twitter: {
    gameUrl: 'https://flysf.io',
    defaultHashtags: ['flysf', 'flightsim', 'sanfrancisco'],
    via: 'flysfgame'  // Optional Twitter handle
  }
});

const shareModal = new ShareModal(container);

// Wire up race completion to share flow
checkpointManager.onRaceComplete = async (raceData) => {
  // Pause game loop briefly for clean screenshot
  gameLoop.pause();

  // Render one clean frame
  renderer.render(scene, camera);

  // Capture and composite
  const captureResult = await shareManager.captureRaceCompletion(raceData);

  // Show share modal
  shareModal.show(captureResult);

  // Wire up modal actions
  shareModal.onShareTwitter = () => shareManager.shareToTwitter();
  shareModal.onDownload = () => shareManager.downloadImage(`flysf-${raceData.routeId}.png`);
  shareModal.onCopy = () => shareManager.copyToClipboard();
  shareModal.onPlayAgain = () => {
    checkpointManager.reset();
    gameLoop.resume();
  };
  shareModal.onClose = () => {
    gameLoop.resume();
  };
};
```

### 3. Race Data Format

The share system expects race data in this format (provided by CheckpointManager):

```javascript
{
  routeId: 'golden-gate-tour',      // URL-safe route identifier
  routeName: 'Golden Gate Tour',     // Display name
  totalTime: 127450,                 // Milliseconds
  checkpointCount: 5,
  checkpoints: [                     // Individual checkpoint times
    { name: 'Start', time: 0 },
    { name: 'Golden Gate Bridge', time: 32100 },
    // ...
  ],
  playerName: 'MaverickPilot'        // From entry screen
}
```

## Mobile Considerations

### Touch-Friendly Share Modal
- Large tap targets (minimum 44x44px)
- Full-width buttons on small screens
- Swipe-to-dismiss support (optional enhancement)

### Native Share API Fallback
For mobile browsers, consider using the Web Share API when available:

```javascript
async function nativeShare(blob, raceData) {
  if (!navigator.canShare) return false;

  const file = new File([blob], 'flysf-race.png', { type: 'image/png' });

  if (!navigator.canShare({ files: [file] })) return false;

  try {
    await navigator.share({
      title: 'My FlySF Race',
      text: `Just flew the ${raceData.routeName} in ${formatTime(raceData.totalTime)}!`,
      url: 'https://flysf.io',
      files: [file]
    });
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Share failed:', e);
    }
    return false;
  }
}
```

## Testing Checklist

- [ ] Screenshot captures correctly after race completion
- [ ] Screenshot is not blank (preserveDrawingBuffer working)
- [ ] Overlay composites correctly with time/route/branding
- [ ] Twitter intent opens with correct text
- [ ] Download saves PNG file with correct name
- [ ] Copy to clipboard works in Chrome/Firefox
- [ ] Modal displays correctly on desktop
- [ ] Modal displays correctly on mobile
- [ ] ESC key closes modal
- [ ] Click outside modal closes it
- [ ] "Play Again" resets race and resumes game
- [ ] Memory cleanup (no blob URL leaks)
- [ ] Performance: screenshot capture < 100ms

## Performance Notes

1. **preserveDrawingBuffer Cost**: ~5-10% framerate reduction. Acceptable for this game type.

2. **Screenshot Timing**: Capture immediately after render, before next frame. The game loop should be paused during capture.

3. **Blob Memory**: Always revoke object URLs after use to prevent memory leaks.

4. **Mobile Memory**: Large screenshots can cause memory pressure. Consider scaling down for mobile:
   ```javascript
   const maxDimension = 1920;
   if (canvas.width > maxDimension || canvas.height > maxDimension) {
     // Scale down before capture
   }
   ```

## Future Enhancements

1. **Server-Side Image Hosting**: Upload screenshots to a server, get permanent URL, include in Open Graph tags for proper Twitter image previews.

2. **Leaderboard Integration**: Submit times to server, show position on leaderboard in share image.

3. **Replay System**: Record flight path, allow sharing replay links.

4. **Custom Watermarks**: Let players customize the share image overlay.
