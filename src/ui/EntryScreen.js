/**
 * Entry Screen - Name entry, plane selection, and loading progress
 * Shows while tiles preload in the background
 */
export class EntryScreen {
  constructor() {
    this.selectedPlane = 'red';  // Default plane
    this.playerName = '';
    this.isReady = false;
    this.onReady = null;  // Callback when user clicks "Take Off!"

    this.createUI();
  }

  createUI() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'entry-screen';
    this.overlay.innerHTML = `
      <div class="entry-container">
        <h1>🛩️ SF Flight Sim</h1>
        <p class="subtitle">Multiplayer dogfighting over San Francisco</p>

        <div class="input-group">
          <label for="player-name">Callsign</label>
          <input type="text" id="player-name" maxlength="16" placeholder="Enter your name..." autocomplete="off" spellcheck="false">
        </div>

        <div class="plane-selection">
          <label>Aircraft</label>
          <div class="plane-options">
            <div class="plane-option selected" data-plane="red">
              <div class="plane-preview red"></div>
              <span>Red Baron</span>
            </div>
            <div class="plane-option" data-plane="blue">
              <div class="plane-preview blue"></div>
              <span>Blue Angel</span>
            </div>
            <div class="plane-option" data-plane="green">
              <div class="plane-preview green"></div>
              <span>Green Hornet</span>
            </div>
          </div>
        </div>

        <div class="loading-section">
          <div class="progress-bar">
            <div class="progress-fill" id="loading-progress"></div>
          </div>
          <div class="loading-text" id="loading-text">Initializing...</div>
        </div>

        <button class="fly-button" id="fly-button" disabled>
          <span class="loading-spinner" id="loading-spinner"></span>
          <span class="button-text" id="button-text">Loading terrain...</span>
        </button>

        <div class="controls-hint">
          <p><strong>WASD</strong> to fly • <strong>Space/F</strong> to fire</p>
        </div>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.overlay);

    this.setupEventListeners();

    // Focus name input after a short delay
    setTimeout(() => {
      document.getElementById('player-name')?.focus();
    }, 100);
  }

  addStyles() {
    const style = document.createElement('style');
    style.id = 'entry-screen-styles';
    style.textContent = `
      #entry-screen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: opacity 0.6s ease-out;
      }

      #entry-screen.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .entry-container {
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 24px;
        padding: 40px 50px;
        max-width: 480px;
        width: 90%;
        text-align: center;
        color: white;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      .entry-container h1 {
        font-size: 2.2em;
        margin: 0 0 8px 0;
        font-weight: 700;
        background: linear-gradient(135deg, #fff 0%, #a8edea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        margin: 0 0 30px 0;
      }

      .input-group {
        margin-bottom: 24px;
        text-align: left;
      }

      .input-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .input-group input {
        width: 100%;
        padding: 16px 18px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        color: white;
        font-size: 18px;
        font-weight: 500;
        outline: none;
        transition: all 0.3s ease;
        box-sizing: border-box;
      }

      .input-group input:focus {
        border-color: rgba(168, 237, 234, 0.6);
        background: rgba(255, 255, 255, 0.1);
        box-shadow: 0 0 0 4px rgba(168, 237, 234, 0.1);
      }

      .input-group input::placeholder {
        color: rgba(255, 255, 255, 0.3);
        font-weight: 400;
      }

      .plane-selection {
        margin-bottom: 28px;
        text-align: left;
      }

      .plane-selection > label {
        display: block;
        margin-bottom: 12px;
        font-weight: 600;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .plane-options {
        display: flex;
        gap: 12px;
      }

      .plane-option {
        flex: 1;
        padding: 16px 12px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: center;
        background: rgba(255, 255, 255, 0.03);
      }

      .plane-option:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-2px);
      }

      .plane-option.selected {
        border-color: #4ade80;
        background: rgba(74, 222, 128, 0.15);
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.2);
      }

      .plane-preview {
        width: 50px;
        height: 35px;
        margin: 0 auto 10px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .plane-preview.red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
      .plane-preview.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
      .plane-preview.green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }

      .plane-option span {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
      }

      .loading-section {
        margin-bottom: 24px;
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4ade80, #22d3ee);
        border-radius: 3px;
        transition: width 0.4s ease-out;
      }

      .loading-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        min-height: 20px;
      }

      .fly-button {
        width: 100%;
        padding: 18px 24px;
        border: none;
        border-radius: 14px;
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
        color: white;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 4px 15px rgba(74, 222, 128, 0.3);
      }

      .fly-button:disabled {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.4);
        cursor: not-allowed;
        box-shadow: none;
      }

      .fly-button:not(:disabled):hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(74, 222, 128, 0.4);
      }

      .fly-button:not(:disabled):active {
        transform: translateY(-1px);
      }

      .loading-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .fly-button:not(:disabled) .loading-spinner {
        display: none;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .controls-hint {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .controls-hint p {
        margin: 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);
      }

      .controls-hint strong {
        color: rgba(255, 255, 255, 0.7);
      }

      /* Mobile adjustments */
      @media (max-width: 500px) {
        .entry-container {
          padding: 30px 25px;
        }

        .entry-container h1 {
          font-size: 1.8em;
        }

        .plane-options {
          gap: 8px;
        }

        .plane-option {
          padding: 12px 8px;
        }

        .plane-preview {
          width: 40px;
          height: 28px;
        }

        .plane-option span {
          font-size: 11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Name input
    const nameInput = document.getElementById('player-name');
    nameInput.addEventListener('input', (e) => {
      this.playerName = e.target.value.trim();
      this.checkReady();
    });

    // Enter key to start game
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.isReady && this.playerName) {
        this.triggerStart();
      }
    });

    // Plane selection
    const planeOptions = this.overlay.querySelectorAll('.plane-option');
    planeOptions.forEach(option => {
      option.addEventListener('click', () => {
        planeOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedPlane = option.dataset.plane;
      });
    });

    // Fly button
    const flyButton = document.getElementById('fly-button');
    flyButton.addEventListener('click', () => this.triggerStart());
  }

  /**
   * Trigger game start if ready
   */
  triggerStart() {
    if (this.isReady && this.playerName) {
      this.hide();
      if (this.onReady) {
        this.onReady({
          name: this.playerName,
          plane: this.selectedPlane
        });
      }
    }
  }

  /**
   * Update loading progress
   * @param {number} progress - 0 to 1
   * @param {string} text - Status text
   */
  updateProgress(progress, text = 'Loading terrain...') {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');

    if (progressBar) {
      progressBar.style.width = `${Math.min(100, progress * 100)}%`;
    }
    if (loadingText) {
      loadingText.textContent = text;
    }
  }

  /**
   * Mark loading as complete - enables the fly button if name is entered
   */
  setLoadingComplete() {
    this.isReady = true;
    this.updateProgress(1, 'Ready to fly!');
    this.checkReady();
  }

  /**
   * Check if we can enable the fly button
   */
  checkReady() {
    const flyButton = document.getElementById('fly-button');
    const buttonText = document.getElementById('button-text');
    const spinner = document.getElementById('loading-spinner');

    if (!flyButton || !buttonText) return;

    if (this.isReady && this.playerName) {
      flyButton.disabled = false;
      buttonText.textContent = 'Take Off!';
      if (spinner) spinner.style.display = 'none';
    } else if (!this.isReady) {
      flyButton.disabled = true;
      buttonText.textContent = 'Loading terrain...';
      if (spinner) spinner.style.display = 'block';
    } else {
      flyButton.disabled = true;
      buttonText.textContent = 'Enter callsign above';
      if (spinner) spinner.style.display = 'none';
    }
  }

  /**
   * Hide the entry screen with animation
   */
  hide() {
    this.overlay.classList.add('hidden');
    setTimeout(() => {
      this.overlay.remove();
      // Also remove the styles
      document.getElementById('entry-screen-styles')?.remove();
    }, 600);
  }
}
