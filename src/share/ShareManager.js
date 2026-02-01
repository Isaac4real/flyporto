/**
 * ShareManager.js
 * Orchestrates screenshot capture, compositing, and sharing
 *
 * Flow:
 * 1. Capture WebGL canvas immediately after race completion render
 * 2. Composite with race results overlay
 * 3. Present share modal with options (Twitter, download, copy)
 *
 * Note: Twitter Web Intent API cannot upload images directly.
 * User must download/copy the image and attach it manually.
 */

import { ScreenshotCapture } from './ScreenshotCapture.js';
import { ShareImageCompositor } from './ShareImageCompositor.js';
import { TwitterIntent } from './TwitterIntent.js';

export class ShareManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {Object} options
   * @param {Object} [options.compositor] - ShareImageCompositor options
   * @param {Object} [options.twitter] - TwitterIntent options
   */
  constructor(renderer, options = {}) {
    this.screenshotCapture = new ScreenshotCapture(renderer);
    this.compositor = new ShareImageCompositor(options.compositor);
    this.twitterIntent = new TwitterIntent(options.twitter);

    // Store last capture for sharing
    this.lastCapture = null;
    this.lastRaceData = null;
    this.lastCompositedBlob = null;
    this.lastCompositedUrl = null;

    // Callbacks
    this.onCaptureReady = null;  // Called when image is ready for preview
    this.onCaptureError = null;  // Called if capture fails
  }

  /**
   * Capture and prepare share image
   * Call this immediately after the final render of the race
   *
   * @param {Object} raceData - Race completion data
   * @param {string} [playerName] - Optional player name to include
   * @returns {Promise<{blob: Blob, dataUrl: string, raceData: Object}>}
   */
  async captureRaceCompletion(raceData, playerName = null) {
    console.log('[ShareManager] Capturing race completion screenshot');

    try {
      // Clean up previous capture
      this._cleanup();

      // Add player name to race data if provided
      const fullRaceData = { ...raceData };
      if (playerName) {
        fullRaceData.playerName = playerName;
      }

      // 1. Capture raw screenshot
      const rawBlob = await this.screenshotCapture.capture('image/png');
      this.lastCapture = rawBlob;
      this.lastRaceData = fullRaceData;

      // 2. Composite with overlay
      this.lastCompositedBlob = await this.compositor.composite(rawBlob, fullRaceData);

      // 3. Generate preview URL
      this.lastCompositedUrl = URL.createObjectURL(this.lastCompositedBlob);

      const result = {
        blob: this.lastCompositedBlob,
        dataUrl: this.lastCompositedUrl,
        raceData: fullRaceData
      };

      // Notify listeners
      if (this.onCaptureReady) {
        this.onCaptureReady(result);
      }

      console.log('[ShareManager] Screenshot captured and composited successfully');
      return result;

    } catch (error) {
      console.error('[ShareManager] Capture failed:', error);

      if (this.onCaptureError) {
        this.onCaptureError(error);
      }

      throw error;
    }
  }

  /**
   * Check if a capture is ready
   * @returns {boolean}
   */
  hasCapture() {
    return this.lastCompositedBlob !== null;
  }

  /**
   * Open Twitter share intent
   * Note: User must manually attach the downloaded/copied image
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
   *
   * @param {string} [filename] - Custom filename (default: flysf-{routeId}.png)
   */
  downloadImage(filename = null) {
    if (!this.lastCompositedBlob) {
      console.warn('[ShareManager] No image to download');
      return;
    }

    const name = filename || `flysf-${this.lastRaceData?.routeId || 'race'}.png`;

    const url = URL.createObjectURL(this.lastCompositedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ShareManager] Image downloaded:', name);
  }

  /**
   * Copy image to clipboard (modern browsers)
   * Allows paste directly into Twitter compose
   *
   * @returns {Promise<boolean>} True if successful
   */
  async copyToClipboard() {
    if (!this.lastCompositedBlob) {
      console.warn('[ShareManager] No image to copy');
      return false;
    }

    // Check if Clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.write) {
      console.warn('[ShareManager] Clipboard API not available');
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
   * Use native Web Share API (mobile browsers)
   * Allows sharing image directly to apps
   *
   * @returns {Promise<boolean>} True if shared successfully
   */
  async nativeShare() {
    if (!this.lastCompositedBlob || !this.lastRaceData) {
      console.warn('[ShareManager] No image/data to share');
      return false;
    }

    // Check if Web Share API is available
    if (!navigator.share || !navigator.canShare) {
      console.warn('[ShareManager] Web Share API not available');
      return false;
    }

    // Create a File from the blob
    const file = new File(
      [this.lastCompositedBlob],
      `flysf-${this.lastRaceData.routeId}.png`,
      { type: 'image/png' }
    );

    // Check if we can share files
    const shareData = {
      title: `FlySF - ${this.lastRaceData.routeName}`,
      text: `I flew the ${this.lastRaceData.routeName} in ${this._formatTime(this.lastRaceData.totalTime)}! Can you beat my time?`,
      url: this.twitterIntent.options.gameUrl,
      files: [file]
    };

    if (!navigator.canShare(shareData)) {
      // Try without files
      delete shareData.files;
      if (!navigator.canShare(shareData)) {
        console.warn('[ShareManager] Cannot share this content');
        return false;
      }
    }

    try {
      await navigator.share(shareData);
      console.log('[ShareManager] Shared via native share');
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[ShareManager] Native share failed:', error);
      }
      return false;
    }
  }

  /**
   * Get share URLs for multiple platforms
   * @returns {Object|null} URLs for different platforms, or null if no data
   */
  getShareUrls() {
    if (!this.lastRaceData) return null;
    return this.twitterIntent.getMultiPlatformUrls(this.lastRaceData);
  }

  /**
   * Get the composited image URL (for preview)
   * @returns {string|null}
   */
  getPreviewUrl() {
    return this.lastCompositedUrl;
  }

  /**
   * Get the composited blob
   * @returns {Blob|null}
   */
  getBlob() {
    return this.lastCompositedBlob;
  }

  /**
   * Format time for display
   * @private
   */
  _formatTime(totalSeconds) {
    const seconds = totalSeconds.toFixed(2);
    return `${seconds}s`;
  }

  /**
   * Clean up previous capture resources
   * @private
   */
  _cleanup() {
    if (this.lastCompositedUrl) {
      URL.revokeObjectURL(this.lastCompositedUrl);
      this.lastCompositedUrl = null;
    }
    this.lastCapture = null;
    this.lastCompositedBlob = null;
    this.lastRaceData = null;
  }

  /**
   * Clean up all resources
   */
  dispose() {
    this._cleanup();
  }
}
