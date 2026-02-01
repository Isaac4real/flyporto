/**
 * ShareImageCompositor.js
 * Composites game screenshot with race results overlay
 *
 * Creates a branded image suitable for social sharing with:
 * - Semi-transparent gradient overlay at bottom
 * - Route name and completion time
 * - Game branding/logo
 * - Medal indicator (if earned)
 * - Optional player name
 */
export class ShareImageCompositor {
  constructor(options = {}) {
    this.options = {
      overlayHeight: 140,           // Height of bottom overlay in pixels
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      accentColor: '#00ff88',       // Neon green for times/branding
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
   * @param {Blob|HTMLCanvasElement|HTMLImageElement|string} screenshot - Base image
   * @param {Object} raceData - Race completion data
   * @param {string} raceData.routeName - Name of the route completed
   * @param {number} raceData.totalTime - Total time in seconds
   * @param {number} raceData.checkpointCount - Number of checkpoints
   * @param {string} [raceData.medal] - 'gold', 'silver', 'bronze', or null
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
   * Composite and return as data URL (for preview)
   *
   * @param {Blob|HTMLCanvasElement|HTMLImageElement|string} screenshot
   * @param {Object} raceData
   * @returns {Promise<string>} Data URL
   */
  async compositeToDataURL(screenshot, raceData) {
    await this.composite(screenshot, raceData);
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Load various image sources into HTMLImageElement
   * @private
   */
  _loadImage(source) {
    return new Promise((resolve, reject) => {
      // If already an image, resolve immediately
      if (source instanceof HTMLImageElement && source.complete) {
        resolve(source);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (source instanceof Blob) {
          URL.revokeObjectURL(img.src);  // Clean up blob URL
        }
        resolve(img);
      };

      img.onerror = (e) => {
        if (source instanceof Blob) {
          URL.revokeObjectURL(img.src);
        }
        reject(new Error('Failed to load image: ' + e));
      };

      if (source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else if (source instanceof HTMLCanvasElement) {
        img.src = source.toDataURL();
      } else if (source instanceof HTMLImageElement) {
        img.src = source.src;
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
    const { overlayHeight, overlayColor, accentColor, textColor, brandingText } = this.options;

    // Semi-transparent bottom gradient overlay
    const gradient = this.ctx.createLinearGradient(0, height - overlayHeight - 60, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.4, overlayColor);
    gradient.addColorStop(1, overlayColor);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, height - overlayHeight - 60, width, overlayHeight + 60);

    // Format time
    const timeStr = this._formatTime(raceData.totalTime);

    // Scale font sizes based on canvas size
    const scale = Math.min(width / 1920, height / 1080);
    const baseFontSize = Math.max(24, Math.round(32 * scale));
    const largeFontSize = Math.max(36, Math.round(48 * scale));
    const smallFontSize = Math.max(18, Math.round(24 * scale));

    const padding = Math.max(20, Math.round(30 * scale));

    // Route name (top-left of overlay)
    this.ctx.font = `600 ${baseFontSize}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(
      raceData.routeName.toUpperCase(),
      padding,
      height - overlayHeight + baseFontSize
    );

    // Checkpoint count
    this.ctx.font = `500 ${smallFontSize}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.fillText(
      `${raceData.checkpointCount} CHECKPOINTS`,
      padding,
      height - overlayHeight + baseFontSize + smallFontSize + 8
    );

    // Large time display
    this.ctx.font = `bold ${largeFontSize}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = accentColor;
    this.ctx.fillText(timeStr, padding, height - padding);

    // Medal indicator (if present)
    if (raceData.medal) {
      const medalEmoji = {
        gold: '\u{1F947}',    // Gold medal
        silver: '\u{1F948}',  // Silver medal
        bronze: '\u{1F949}'   // Bronze medal
      };
      const medalText = medalEmoji[raceData.medal] || '';

      this.ctx.font = `${largeFontSize}px system-ui`;
      const timeWidth = this.ctx.measureText(timeStr).width;
      this.ctx.fillText(medalText, padding + timeWidth + 20, height - padding);
    }

    // Branding (right side)
    this.ctx.font = `bold ${Math.round(largeFontSize * 0.8)}px system-ui, -apple-system, sans-serif`;
    this.ctx.fillStyle = accentColor;
    this.ctx.textAlign = 'right';
    this.ctx.fillText(brandingText, width - padding, height - padding);

    // Optional player name
    if (raceData.playerName) {
      this.ctx.font = `500 ${smallFontSize}px system-ui, -apple-system, sans-serif`;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.fillText(
        `Pilot: ${raceData.playerName}`,
        width - padding,
        height - padding - largeFontSize - 8
      );
    }

    // Top-left corner badge/logo
    this._drawCornerBadge(scale);
  }

  /**
   * Draw a small corner badge for branding
   * @private
   */
  _drawCornerBadge(scale = 1) {
    const badgeWidth = Math.round(100 * scale);
    const badgeHeight = Math.round(40 * scale);
    const margin = Math.round(20 * scale);
    const radius = Math.round(8 * scale);

    // Semi-transparent background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this._roundRect(margin, margin, badgeWidth, badgeHeight, radius);
    this.ctx.fill();

    // Aircraft icon (simple triangle)
    this.ctx.fillStyle = this.options.accentColor;
    this.ctx.beginPath();
    const cx = margin + badgeWidth / 2;
    const cy = margin + badgeHeight / 2;
    const size = Math.round(12 * scale);
    this.ctx.moveTo(cx - size, cy + size * 0.6);
    this.ctx.lineTo(cx + size, cy);
    this.ctx.lineTo(cx - size, cy - size * 0.6);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Draw a rounded rectangle path
   * @private
   */
  _roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  /**
   * Format seconds to readable time string
   * @private
   */
  _formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((totalSeconds % 1) * 100);

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}.${centiseconds.toString().padStart(2, '0')}s`;
  }

  /**
   * Get the composited canvas (for preview)
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Get canvas as data URL
   * @returns {string}
   */
  getDataURL() {
    return this.canvas.toDataURL('image/png');
  }
}
