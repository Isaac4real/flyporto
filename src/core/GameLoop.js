/**
 * GameLoop - manages the animation frame loop with delta time
 */
export class GameLoop {
  constructor() {
    this.lastTime = 0;
    this.callbacks = [];
    this.running = false;
    this.animationFrameId = null;
  }

  /**
   * Add a callback to be called each frame
   * @param {Function} fn - Callback receiving (deltaTime) in seconds
   */
  addCallback(fn) {
    this.callbacks.push(fn);
  }

  /**
   * Remove a callback
   * @param {Function} fn - The callback to remove
   */
  removeCallback(fn) {
    const index = this.callbacks.indexOf(fn);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Start the game loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Internal loop function
   * @param {number} currentTime - Current timestamp from requestAnimationFrame
   */
  loop(currentTime) {
    if (!this.running) return;

    // Calculate delta time in seconds, capped at 100ms to prevent huge jumps
    // (e.g., when tab is backgrounded)
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    // Call all registered callbacks
    for (const callback of this.callbacks) {
      callback(deltaTime);
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }
}
