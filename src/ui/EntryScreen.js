import * as THREE from 'three';
import { ModelManager } from '../core/ModelManager.js';
import { CONFIG } from '../config.js';

/**
 * Entry Screen - Name entry, aircraft selection, and loading progress
 * Shows while tiles preload in the background
 */
export class EntryScreen {
  constructor() {
    this.selectedType = CONFIG.aircraft?.defaultType || 'jet1';
    this.selectedColor = 'red';
    this.playerName = '';
    this.isReady = false;
    this.onReady = null;  // Callback when user clicks "Take Off!"

    // 3D Preview rendering
    this.previewScene = null;
    this.previewCamera = null;
    this.previewRenderer = null;
    this.previewMesh = null;

    this.createUI();
    this.setupPreview();
  }

  createUI() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'entry-screen';

    // Get aircraft types from config or ModelManager
    const aircraftTypes = CONFIG.aircraft?.types || {
      jet1: { id: 'jet1', name: 'Fighter Jet', description: 'Sleek combat fighter' },
      jet2: { id: 'jet2', name: 'Strike Fighter', description: 'Heavy attack fighter' },
      plane1: { id: 'plane1', name: 'Light Aircraft', description: 'Agile propeller plane' }
    };

    // Build aircraft type options HTML
    const typeOptionsHtml = Object.entries(aircraftTypes).map(([id, type], index) => `
      <div class="aircraft-option${index === 0 ? ' selected' : ''}" data-type="${id}">
        <div class="aircraft-name">${type.name}</div>
        <div class="aircraft-desc">${type.description}</div>
      </div>
    `).join('');


    this.overlay.innerHTML = `
      <div class="entry-container">
        <h1>SF Flight Sim</h1>
        <p class="subtitle">Multiplayer dogfighting over photorealistic San Francisco</p>
        <p class="demo-hint">Watch the aircraft fly while we load...</p>

        <div class="input-group">
          <label for="player-name">Callsign</label>
          <input type="text" id="player-name" maxlength="16" placeholder="Enter your name..." autocomplete="off" spellcheck="false">
        </div>

        <div class="aircraft-selection">
          <label>Aircraft</label>
          <div class="aircraft-options">
            ${typeOptionsHtml}
          </div>
        </div>

        <div class="preview-section">
          <div class="preview-container" id="aircraft-preview"></div>
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
          <p><strong>W/S</strong> - Throttle &bull; <strong>A/D</strong> - Rudder &bull; <strong>Arrows</strong> - Roll + Pitch &bull; <strong>Space</strong> - Fire &bull; <strong>V</strong> - View</p>
          <p class="tile-hint">Tiles stream in HD as you fly - new areas may take a moment to sharpen</p>
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
      :root {
        --color-red: #ef4444;
        --color-blue: #3b82f6;
        --color-green: #22c55e;
        --color-yellow: #eab308;
        --color-purple: #a855f7;
        --color-orange: #f97316;
      }

      #entry-screen {
        position: fixed;
        top: var(--top-banner-height, 0px);
        left: 0;
        right: 0;
        bottom: 0;
        height: calc(100% - var(--top-banner-height, 0px));
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: opacity 0.6s ease-out;
      }

      /* Subtle vignette for depth and focus on card */
      #entry-screen::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.5) 100%);
        pointer-events: none;
      }

      #entry-screen.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .entry-container {
        position: relative;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 24px;
        padding: 32px 40px;
        max-width: 520px;
        width: 90%;
        text-align: center;
        color: white;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
        animation: fadeInUp 0.8s ease-out;
        max-height: 90vh;
        overflow-y: auto;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .entry-container h1 {
        font-size: 2em;
        margin: 0 0 6px 0;
        font-weight: 700;
        background: linear-gradient(135deg, #fff 0%, #a8edea 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin: 0 0 6px 0;
      }

      .demo-hint {
        color: rgba(255, 255, 255, 0.35);
        font-size: 11px;
        font-style: italic;
        margin: 0 0 20px 0;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 0.6; }
      }

      .input-group {
        margin-bottom: 18px;
        text-align: left;
      }

      .input-group label,
      .aircraft-selection > label,
      .color-selection > label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .input-group input {
        width: 100%;
        padding: 14px 16px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        color: white;
        font-size: 16px;
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

      .aircraft-selection {
        margin-bottom: 16px;
        text-align: left;
      }

      .aircraft-options {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .aircraft-option {
        padding: 12px 10px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: center;
        background: rgba(255, 255, 255, 0.03);
      }

      .aircraft-option:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-1px);
      }

      .aircraft-option.selected {
        border-color: #4ade80;
        background: rgba(74, 222, 128, 0.15);
        box-shadow: 0 0 15px rgba(74, 222, 128, 0.2);
      }

      .aircraft-name {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 2px;
      }

      .aircraft-desc {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
      }

      .color-selection {
        margin-bottom: 16px;
        text-align: left;
      }

      .color-options {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .color-dot {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.25s ease;
        border: 3px solid transparent;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .color-dot:hover {
        transform: scale(1.15);
      }

      .color-dot.selected {
        border-color: white;
        transform: scale(1.1);
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
      }

      .preview-section {
        margin-bottom: 16px;
      }

      .preview-container {
        width: 100%;
        height: 120px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .preview-container canvas {
        width: 100% !important;
        height: 100% !important;
      }

      .loading-section {
        margin-bottom: 18px;
      }

      .progress-bar {
        width: 100%;
        height: 5px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4ade80, #22d3ee);
        border-radius: 3px;
        transition: width 0.4s ease-out;
      }

      .loading-text {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        min-height: 18px;
      }

      .fly-button {
        width: 100%;
        padding: 16px 20px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
        color: white;
        font-size: 16px;
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
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(74, 222, 128, 0.4);
      }

      .fly-button:not(:disabled):active {
        transform: translateY(-1px);
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
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
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .controls-hint p {
        margin: 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
      }

      .controls-hint strong {
        color: rgba(255, 255, 255, 0.7);
      }

      .tile-hint {
        margin-top: 10px;
        padding: 8px 12px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        background: rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        border-left: 2px solid rgba(168, 237, 234, 0.5);
      }

      /* Mobile adjustments */
      @media (max-width: 500px) {
        .entry-container {
          padding: 24px 20px;
        }

        .entry-container h1 {
          font-size: 1.6em;
        }

        .aircraft-options {
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .aircraft-option {
          padding: 10px 8px;
        }

        .aircraft-name {
          font-size: 11px;
        }

        .aircraft-desc {
          font-size: 9px;
        }

        .color-dot {
          width: 28px;
          height: 28px;
        }

        .preview-container {
          height: 100px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup 3D preview renderer
   */
  setupPreview() {
    const container = document.getElementById('aircraft-preview');
    if (!container) return;

    // Create scene
    this.previewScene = new THREE.Scene();

    // Create camera (will be positioned per-model)
    this.previewCamera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);

    // Create renderer
    this.previewRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.previewRenderer.setSize(container.clientWidth, container.clientHeight);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.previewRenderer.setClearColor(0x000000, 0);
    container.appendChild(this.previewRenderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.previewScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7);
    this.previewScene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-5, 5, -7);
    this.previewScene.add(backLight);

    // Load initial preview model
    this.updatePreviewModel();

    // Render once (no animation loop - static view)
    this.renderPreview();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        this.previewCamera.aspect = container.clientWidth / container.clientHeight;
        this.previewCamera.updateProjectionMatrix();
        this.previewRenderer.setSize(container.clientWidth, container.clientHeight);
        this.renderPreview();
      }
    });
    resizeObserver.observe(container);
  }

  /**
   * Update the preview model based on current selection
   */
  updatePreviewModel() {
    // Remove old mesh
    if (this.previewMesh) {
      this.previewScene.remove(this.previewMesh);
      this.previewMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    // Get new mesh from ModelManager
    const modelManager = ModelManager.getInstance();
    let mesh = modelManager.getAircraftMesh(this.selectedType, this.selectedColor);

    if (!mesh) {
      mesh = modelManager.createFallbackMesh(this.selectedColor);
    }

    this.previewMesh = mesh;
    this.previewScene.add(mesh);

    // Frame the camera to fit this specific model
    this.frameCameraToModel(mesh);
    this.renderPreview();
  }

  /**
   * Position camera to properly frame the model
   */
  frameCameraToModel(mesh) {
    // Calculate bounding box of the mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Get the maximum dimension
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate distance needed to fit the model in view
    const fov = this.previewCamera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.3; // 1.3x for slight padding

    // Position camera at 3/4 view angle (front-right, slightly above)
    const angle = Math.PI / 5; // 36 degrees from front
    const elevation = 0.3; // slight elevation

    this.previewCamera.position.set(
      center.x + distance * Math.sin(angle),
      center.y + distance * elevation,
      center.z + distance * Math.cos(angle)
    );
    this.previewCamera.lookAt(center);
    this.previewCamera.updateProjectionMatrix();
  }

  /**
   * Render the preview (single frame, no animation)
   */
  renderPreview() {
    if (this.previewRenderer && this.previewScene && this.previewCamera) {
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    }
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

    // Aircraft type selection
    const aircraftOptions = this.overlay.querySelectorAll('.aircraft-option');
    aircraftOptions.forEach(option => {
      option.addEventListener('click', () => {
        aircraftOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedType = option.dataset.type;
        this.updatePreviewModel();
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
          planeType: this.selectedType,
          planeColor: this.selectedColor
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
    // Dispose preview resources
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
    }
    if (this.previewMesh) {
      this.previewScene.remove(this.previewMesh);
      this.previewMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.overlay.classList.add('hidden');
    setTimeout(() => {
      this.overlay.remove();
      // Also remove the styles
      document.getElementById('entry-screen-styles')?.remove();
    }, 600);
  }
}
