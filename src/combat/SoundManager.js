/**
 * SoundManager - handles combat sound effects
 * Uses Web Audio API for low-latency synthesized sounds
 */
export class SoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.3;

    // Initialize on first user interaction (required by browsers)
    this.initialized = false;
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.initialized = true;
      console.log('[Sound] Audio initialized');
    } catch (e) {
      console.warn('[Sound] Web Audio not available:', e.message);
      this.enabled = false;
    }
  }

  /**
   * Play gunfire sound (synthesized "pew" sound)
   */
  playGunfire() {
    if (!this.enabled || !this.audioContext) return;

    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      // Sawtooth wave with quick frequency drop for "pew" effect
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);

      gain.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.1);
    } catch (e) {
      // Ignore audio errors
    }
  }

  /**
   * Play hit confirmation sound (synthesized "ping" sound)
   */
  playHit() {
    if (!this.enabled || !this.audioContext) return;

    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      // Sine wave with slight frequency drop for "ping" effect
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);

      gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.15);
    } catch (e) {
      // Ignore audio errors
    }
  }

  /**
   * Play "got hit" sound (synthesized low thump)
   */
  playGotHit() {
    if (!this.enabled || !this.audioContext) return;

    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      // Low frequency sine wave for impact thump
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);

      gain.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {
      // Ignore audio errors
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Toggle sound on/off
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Check if sound is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}
