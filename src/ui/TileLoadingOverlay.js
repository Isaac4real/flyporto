/**
 * TileLoadingOverlay - Visual feedback when tile loading is behind
 *
 * Shows a non-intrusive loading indicator when many tiles are pending,
 * helping users understand why terrain might look incomplete.
 */
export class TileLoadingOverlay {
  /**
   * @param {HTMLElement} container - The container to append the overlay to
   * @param {Object} config - Configuration options
   */
  constructor(container, config = {}) {
    this.container = container;

    // Configuration
    this.showThreshold = config.showThreshold ?? 35;  // Show when this many tiles pending
    this.hideThreshold = config.hideThreshold ?? 15;  // Hide when drops below this
    this.fadeTime = config.fadeTime ?? 300;           // Fade animation duration in ms

    // State
    this.visible = false;
    this.pendingCount = 0;

    // Create DOM elements
    this.createOverlay();
  }

  /**
   * Create the overlay DOM element
   */
  createOverlay() {
    this.element = document.createElement('div');
    this.element.id = 'tile-loading-overlay';
    this.element.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transition: opacity ${this.fadeTime}ms ease-out;
      pointer-events: none;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 10px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Spinner and text
    this.element.innerHTML = `
      <div class="loading-spinner" style="
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: tile-spinner 0.8s linear infinite;
      "></div>
      <span class="loading-text">Loading terrain...</span>
    `;

    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tile-spinner {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    this.styleElement = style;

    this.container.appendChild(this.element);
    this.textElement = this.element.querySelector('.loading-text');
  }

  /**
   * Update overlay based on tile loading state
   * @param {number} downloadQueueSize - Tiles waiting to download
   * @param {number} parseQueueSize - Tiles being parsed
   */
  update(downloadQueueSize, parseQueueSize) {
    const totalPending = downloadQueueSize + parseQueueSize;
    this.pendingCount = totalPending;

    // Use hysteresis to prevent flickering
    // Show when above showThreshold, hide when below hideThreshold
    const shouldShow = this.visible
      ? totalPending > this.hideThreshold
      : totalPending > this.showThreshold;

    if (shouldShow && !this.visible) {
      this.show();
    } else if (!shouldShow && this.visible) {
      this.hide();
    }

    // Update text with current count
    if (this.visible && this.textElement) {
      this.textElement.textContent = `Loading terrain... (${totalPending})`;
    }
  }

  /**
   * Show the overlay with fade-in animation
   */
  show() {
    this.visible = true;
    this.element.style.opacity = '1';
  }

  /**
   * Hide the overlay with fade-out animation
   */
  hide() {
    this.visible = false;
    this.element.style.opacity = '0';
  }

  /**
   * Check if overlay is currently visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Get the current pending tile count
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingCount;
  }

  /**
   * Force show/hide (for debugging)
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Clean up DOM elements
   */
  destroy() {
    this.element.remove();
    if (this.styleElement) {
      this.styleElement.remove();
    }
  }
}
