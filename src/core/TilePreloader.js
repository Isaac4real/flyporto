/**
 * TilePreloader - Monitors tile loading progress and notifies when ready
 * Used during the entry screen to ensure tiles are loaded before gameplay starts
 */
export class TilePreloader {
  constructor(tilesRenderer, options = {}) {
    this.tilesRenderer = tilesRenderer;
    this.isRootLoaded = false;
    this.isReady = false;
    this.tileCount = 0;

    // Configuration
    this.minLoadTime = options.minLoadTime || 10000;  // Minimum 10 seconds
    this.minTiles = options.minTiles || 15;           // Minimum tiles before ready
    this.maxWaitTime = options.maxWaitTime || 60000;  // Force ready after 60s

    this.startTime = Date.now();

    // Callbacks
    this.onProgress = null;  // (progress: number, text: string) => void
    this.onReady = null;     // () => void

    // Bound event handlers (stored for cleanup)
    this.boundOnTileSetLoad = this.handleTileSetLoad.bind(this);
    this.boundOnModelLoad = this.handleModelLoad.bind(this);

    this.setupListeners();
    this.startProgressUpdates();
  }

  /**
   * Handle root tileset load event
   */
  handleTileSetLoad() {
    console.log('[Preloader] Root tileset loaded');
    this.isRootLoaded = true;
    this.checkReady();
  }

  /**
   * Handle individual tile/model load event
   */
  handleModelLoad() {
    this.tileCount++;
    this.checkReady();
  }

  setupListeners() {
    // Track root tileset load
    this.tilesRenderer.addEventListener('load-tileset', this.boundOnTileSetLoad);

    // Track individual tile loads
    this.tilesRenderer.addEventListener('load-model', this.boundOnModelLoad);
  }

  /**
   * Remove event listeners from tiles renderer
   */
  removeListeners() {
    if (this.tilesRenderer) {
      this.tilesRenderer.removeEventListener('load-tileset', this.boundOnTileSetLoad);
      this.tilesRenderer.removeEventListener('load-model', this.boundOnModelLoad);
    }
  }

  /**
   * Start periodic progress updates
   */
  startProgressUpdates() {
    this.progressInterval = setInterval(() => {
      this.updateProgress();
    }, 200);  // Update 5 times per second

    // Timeout fallback - force ready after max wait time
    this.timeoutId = setTimeout(() => {
      console.log('[Preloader] Timeout reached, forcing ready');
      this.forceReady();
    }, this.maxWaitTime);
  }

  /**
   * Update and broadcast progress
   */
  updateProgress() {
    if (this.isReady) return;

    const elapsed = Date.now() - this.startTime;

    // Calculate progress components
    const timeProgress = Math.min(1, elapsed / this.minLoadTime);
    const tileProgress = Math.min(1, this.tileCount / this.minTiles);

    // Combined progress (weighted average)
    // Time is more predictable, so weight it more heavily initially
    const progress = Math.min(
      0.99,  // Cap at 99% until actually ready
      (timeProgress * 0.4) + (tileProgress * 0.6)
    );

    // Generate engaging status text based on progress stages
    let statusText = 'Initializing...';
    if (this.isRootLoaded) {
      if (elapsed < 2000) {
        statusText = 'Connecting to satellite imagery...';
      } else if (elapsed < 4000) {
        statusText = `Rendering San Francisco... (${this.tileCount} tiles)`;
      } else if (elapsed < 6000) {
        statusText = `Loading Golden Gate Bridge... (${this.tileCount} tiles)`;
      } else if (elapsed < 8000) {
        statusText = `Enhancing terrain detail... (${this.tileCount} tiles)`;
      } else {
        statusText = `Preparing for takeoff... (${this.tileCount} tiles)`;
      }
    }

    if (this.onProgress) {
      this.onProgress(progress, statusText);
    }
  }

  /**
   * Check if we're ready to start the game
   */
  checkReady() {
    if (this.isReady) return;

    const elapsed = Date.now() - this.startTime;

    // Ready when: root loaded + minimum tiles + minimum time
    const hasEnoughTiles = this.tileCount >= this.minTiles;
    const hasEnoughTime = elapsed >= this.minLoadTime;

    if (this.isRootLoaded && hasEnoughTiles && hasEnoughTime) {
      this.setReady();
    }
  }

  /**
   * Set ready state and notify
   */
  setReady() {
    if (this.isReady) return;

    this.isReady = true;
    this.cleanup();

    console.log(`[Preloader] Ready! Loaded ${this.tileCount} tiles in ${Date.now() - this.startTime}ms`);

    // Final progress update
    if (this.onProgress) {
      this.onProgress(1, 'Ready to fly!');
    }

    // Notify ready callback
    if (this.onReady) {
      this.onReady();
    }
  }

  /**
   * Force ready state (e.g., after timeout)
   */
  forceReady() {
    if (!this.isReady) {
      console.log(`[Preloader] Force ready with ${this.tileCount} tiles`);
      this.setReady();
    }
  }

  /**
   * Clean up intervals and timeouts
   */
  cleanup() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Dispose of the preloader (full cleanup including event listeners)
   */
  dispose() {
    this.cleanup();
    this.removeListeners();
    this.onProgress = null;
    this.onReady = null;
  }
}
