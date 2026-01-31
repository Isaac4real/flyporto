# Stage 17: Entry Screen with Preloading

## Goal

Create an entry page where users enter their name, choose their plane, and wait while the map preloads. This solves the "jank" issues by ensuring tiles are loaded before gameplay starts.

**Estimated time:** 2-3 hours

---

## Problems Being Solved

1. **Green fallback plane rendering ON TOP of buildings** - Depth buffer issue
2. **Tiles not loaded when gameplay starts** - Need preloading with progress
3. **No player customization** - Add name entry and plane selection
4. **Jarring start** - Need smooth transition from loading to gameplay

---

## Architecture

### Current Flow
```
index.html → main.js → Game starts immediately
```

### New Flow
```
index.html → EntryScreen (name + plane + loading) → main.js (game starts when ready)
```

---

## Tasks

### Task 17.1: Fix Fallback Ground Plane Rendering

**Root Cause:** The fallback plane is rendering ON TOP of tiles because:
1. It was added AFTER tiles in scene graph (render order)
2. The plane follows the aircraft, moving it through the tile geometry

**Solution:** Make the fallback plane only visible when tiles haven't loaded, then hide it.

**src/main.js changes:**

```javascript
// REMOVE the fallback ground plane entirely - it causes more problems than it solves
// The loading screen will hide the "holes" until tiles are ready

// Instead, we'll use a simple background color approach:
// Scene background stays sky blue
// When tiles load, they naturally fill in

// If we MUST have a ground plane, use this approach:
const fallbackGround = new THREE.Mesh(
  new THREE.PlaneGeometry(50000, 50000),
  new THREE.MeshBasicMaterial({
    color: 0x1a3d5c,  // Ocean blue
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true
  })
);
fallbackGround.rotation.x = -Math.PI / 2;
fallbackGround.position.y = -50;  // Much further below sea level
fallbackGround.renderOrder = -100;  // Render FIRST (before tiles)
scene.add(fallbackGround);

// CRITICAL: Add tiles AFTER ground plane
const tilesRenderer = createTilesRenderer(camera, renderer);
tilesRenderer.group.renderOrder = 0;  // Render after ground
scene.add(tilesRenderer.group);

// Hide fallback ground once tiles are visible
tilesRenderer.addEventListener('load-tile-set', () => {
  // Fade out the fallback ground
  fallbackGround.visible = false;
});
```

**Better Solution:** Remove fallback ground entirely and use loading screen instead.

### Task 17.2: Create Entry Screen Component

Create `src/ui/EntryScreen.js`:

```javascript
/**
 * Entry Screen - Name entry, plane selection, and loading progress
 */
export class EntryScreen {
  constructor() {
    this.selectedPlane = 'red';  // Default plane
    this.playerName = '';
    this.isReady = false;
    this.onReady = null;  // Callback when user clicks "Fly!"

    this.createUI();
  }

  createUI() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'entry-screen';
    this.overlay.innerHTML = `
      <div class="entry-container">
        <h1>SF Flight Simulator</h1>

        <div class="input-group">
          <label for="player-name">Your Name</label>
          <input type="text" id="player-name" maxlength="20" placeholder="Enter your callsign">
        </div>

        <div class="plane-selection">
          <label>Choose Your Aircraft</label>
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
          <div class="loading-text" id="loading-text">Loading terrain...</div>
        </div>

        <button class="fly-button" id="fly-button" disabled>
          <span class="loading-spinner"></span>
          <span class="button-text">Loading...</span>
        </button>

        <div class="controls-hint">
          <p>Controls: WASD to fly | Space or F to fire</p>
        </div>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(this.overlay);

    this.setupEventListeners();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #entry-screen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        transition: opacity 0.5s ease-out;
      }

      #entry-screen.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .entry-container {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        color: white;
      }

      .entry-container h1 {
        font-size: 2.5em;
        margin-bottom: 30px;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }

      .input-group {
        margin-bottom: 25px;
        text-align: left;
      }

      .input-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: rgba(255,255,255,0.8);
      }

      .input-group input {
        width: 100%;
        padding: 15px;
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 10px;
        background: rgba(255,255,255,0.1);
        color: white;
        font-size: 16px;
        outline: none;
        transition: border-color 0.3s;
      }

      .input-group input:focus {
        border-color: rgba(255,255,255,0.5);
      }

      .input-group input::placeholder {
        color: rgba(255,255,255,0.4);
      }

      .plane-selection {
        margin-bottom: 25px;
        text-align: left;
      }

      .plane-selection label {
        display: block;
        margin-bottom: 12px;
        font-weight: 500;
        color: rgba(255,255,255,0.8);
      }

      .plane-options {
        display: flex;
        gap: 15px;
        justify-content: center;
      }

      .plane-option {
        flex: 1;
        padding: 15px;
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        text-align: center;
      }

      .plane-option:hover {
        border-color: rgba(255,255,255,0.4);
        background: rgba(255,255,255,0.05);
      }

      .plane-option.selected {
        border-color: #4CAF50;
        background: rgba(76, 175, 80, 0.2);
      }

      .plane-preview {
        width: 60px;
        height: 40px;
        margin: 0 auto 10px;
        border-radius: 5px;
      }

      .plane-preview.red { background: #e74c3c; }
      .plane-preview.blue { background: #3498db; }
      .plane-preview.green { background: #22c55e; }

      .plane-option span {
        font-size: 14px;
        color: rgba(255,255,255,0.9);
      }

      .loading-section {
        margin-bottom: 25px;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(255,255,255,0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4CAF50, #8BC34A);
        border-radius: 4px;
        transition: width 0.3s ease-out;
      }

      .loading-text {
        font-size: 14px;
        color: rgba(255,255,255,0.6);
      }

      .fly-button {
        width: 100%;
        padding: 18px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        font-size: 20px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .fly-button:disabled {
        background: rgba(255,255,255,0.2);
        cursor: not-allowed;
      }

      .fly-button:not(:disabled):hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
      }

      .loading-spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .fly-button:not(:disabled) .loading-spinner {
        display: none;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .controls-hint {
        margin-top: 20px;
        font-size: 13px;
        color: rgba(255,255,255,0.5);
      }

      .controls-hint p {
        margin: 5px 0;
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
    flyButton.addEventListener('click', () => {
      if (this.isReady && this.playerName) {
        this.hide();
        if (this.onReady) {
          this.onReady({
            name: this.playerName,
            plane: this.selectedPlane
          });
        }
      }
    });
  }

  /**
   * Update loading progress
   * @param {number} progress - 0 to 1
   * @param {string} text - Status text
   */
  updateProgress(progress, text = 'Loading terrain...') {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');

    progressBar.style.width = `${Math.min(100, progress * 100)}%`;
    loadingText.textContent = text;
  }

  /**
   * Mark loading as complete
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
    const buttonText = flyButton.querySelector('.button-text');

    if (this.isReady && this.playerName) {
      flyButton.disabled = false;
      buttonText.textContent = 'Take Off!';
    } else if (!this.playerName) {
      flyButton.disabled = true;
      buttonText.textContent = 'Enter your name';
    } else {
      flyButton.disabled = true;
      buttonText.textContent = 'Loading...';
    }
  }

  /**
   * Hide the entry screen with animation
   */
  hide() {
    this.overlay.classList.add('hidden');
    setTimeout(() => {
      this.overlay.remove();
    }, 500);
  }
}
```

### Task 17.3: Implement Tile Preloading Logic

Create `src/core/TilePreloader.js`:

```javascript
/**
 * TilePreloader - Monitors tile loading progress and notifies when ready
 */
export class TilePreloader {
  constructor(tilesRenderer) {
    this.tilesRenderer = tilesRenderer;
    this.isRootLoaded = false;
    this.isReady = false;
    this.minLoadTime = 3000;  // Minimum 3 seconds to ensure tiles load
    this.startTime = Date.now();

    this.onProgress = null;
    this.onReady = null;

    this.setupListeners();
  }

  setupListeners() {
    // Track root tileset load
    this.tilesRenderer.addEventListener('load-tile-set', () => {
      console.log('[Preloader] Root tileset loaded');
      this.isRootLoaded = true;
    });

    // Track individual tile loads
    let tileCount = 0;
    this.tilesRenderer.addEventListener('load-model', () => {
      tileCount++;
      this.updateProgress(tileCount);
    });
  }

  /**
   * Update progress based on loaded tiles
   */
  updateProgress(loadedTiles) {
    const elapsed = Date.now() - this.startTime;
    const timeProgress = Math.min(1, elapsed / this.minLoadTime);

    // Estimate tile progress (assume ~50 tiles for initial view)
    const tileProgress = Math.min(1, loadedTiles / 30);

    // Combined progress
    const progress = Math.min(timeProgress, tileProgress);

    if (this.onProgress) {
      this.onProgress(progress, `Loading terrain... (${loadedTiles} tiles)`);
    }

    // Check if ready
    this.checkReady(loadedTiles, elapsed);
  }

  /**
   * Check if we're ready to start the game
   */
  checkReady(loadedTiles, elapsed) {
    if (this.isReady) return;

    // Ready when: root loaded + minimum tiles + minimum time
    const hasEnoughTiles = loadedTiles >= 20;
    const hasEnoughTime = elapsed >= this.minLoadTime;

    if (this.isRootLoaded && hasEnoughTiles && hasEnoughTime) {
      this.isReady = true;
      if (this.onReady) {
        this.onReady();
      }
    }
  }

  /**
   * Force ready (e.g., after timeout)
   */
  forceReady() {
    if (!this.isReady) {
      this.isReady = true;
      if (this.onReady) {
        this.onReady();
      }
    }
  }
}
```

### Task 17.4: Refactor main.js for Deferred Start

Update `src/main.js` to use the entry screen:

```javascript
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createScene, createCamera, createRenderer, setupLighting, setupResizeHandler } from './core/Scene.js';
import { createTilesRenderer } from './core/TilesManager.js';
import { createAttribution } from './ui/Attribution.js';
import { HUD } from './ui/HUD.js';
import { GameLoop } from './core/GameLoop.js';
import { Aircraft } from './player/Aircraft.js';
import { updatePhysics } from './player/Physics.js';
import { KeyboardInput } from './input/KeyboardInput.js';
import { InputHandler } from './input/InputHandler.js';
import { TouchInput } from './input/TouchInput.js';
import { CameraController } from './player/CameraController.js';
import { NetworkManager } from './network/NetworkManager.js';
import { PlayerSync } from './network/PlayerSync.js';
import { CombatManager } from './combat/CombatManager.js';
import { Leaderboard } from './combat/Leaderboard.js';
import { EntryScreen } from './ui/EntryScreen.js';
import { TilePreloader } from './core/TilePreloader.js';

// ===== PHASE 1: Initialize rendering (background, while entry screen shows) =====

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

document.getElementById('container').appendChild(renderer.domElement);
setupLighting(scene);

// Initialize tiles renderer FIRST (no fallback plane!)
const tilesRenderer = createTilesRenderer(camera, renderer);
scene.add(tilesRenderer.group);

// Position camera for initial tile loading (looking at Golden Gate area)
camera.position.set(0, CONFIG.startPosition.altitude, 0);
camera.lookAt(0, 0, 0);

// Start tiles loading immediately (in background)
function preloadUpdate() {
  camera.updateMatrixWorld();
  tilesRenderer.update();
  renderer.render(scene, camera);
}

// Run preload updates while entry screen is showing
const preloadInterval = setInterval(preloadUpdate, 100);  // 10 FPS during preload

// ===== PHASE 2: Show entry screen =====

const entryScreen = new EntryScreen();
const preloader = new TilePreloader(tilesRenderer);

preloader.onProgress = (progress, text) => {
  entryScreen.updateProgress(progress, text);
};

preloader.onReady = () => {
  entryScreen.setLoadingComplete();
};

// Timeout fallback - force ready after 60 seconds
setTimeout(() => {
  preloader.forceReady();
}, 60000);

// ===== PHASE 3: Start game when user clicks "Fly!" =====

entryScreen.onReady = ({ name, plane }) => {
  // Stop preload loop
  clearInterval(preloadInterval);

  // Start the actual game with player settings
  startGame(name, plane);
};

function startGame(playerName, planeType) {
  // Create aircraft at starting position
  const startPosition = new THREE.Vector3(0, CONFIG.startPosition.altitude, 0);
  const aircraft = new Aircraft(startPosition, planeType);
  scene.add(aircraft.mesh);

  // Initialize input system
  const container = document.getElementById('container');
  const keyboardInput = new KeyboardInput();
  const touchInput = new TouchInput(container);
  const inputHandler = new InputHandler(keyboardInput, touchInput);

  // Initialize camera controller
  const cameraController = new CameraController(camera, aircraft);

  // Setup resize handler
  setupResizeHandler(camera, renderer);

  // Create attribution
  createAttribution();

  // Create HUD
  const hud = new HUD(container);

  // Initialize network manager with player name
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const networkManager = new NetworkManager(wsUrl);
  networkManager.setPlayerName(playerName);

  // Initialize player sync
  const playerSync = new PlayerSync(scene);

  // Store players data for leaderboard
  let playersData = {};

  // Wire up network callbacks
  networkManager.onConnectionChange = (connected) => {
    hud.updateConnectionStatus(connected, 0);
  };

  networkManager.onPlayersUpdate = (players, count) => {
    playersData = players;
    playerSync.updatePlayers(players);
    hud.updateConnectionStatus(true, count);
  };

  networkManager.onPlayerJoined = (id, name) => {
    console.log(`${name} joined the game`);
    hud.showNotification(`${name} joined`);
  };

  networkManager.onPlayerLeft = (id) => {
    const player = playerSync.getPlayer(id);
    if (player) {
      hud.showNotification(`${player.playerName} left`);
    }
    playerSync.removePlayer(id);
  };

  networkManager.onPingUpdate = (ping) => {
    hud.updatePing(ping);
  };

  // Initialize combat system
  const combatManager = new CombatManager(scene, aircraft, playerSync, networkManager);

  // Helper to get all players data for leaderboard
  function getAllPlayersData() {
    const allPlayers = { ...playersData };
    const myId = networkManager.getPlayerId();
    if (myId) {
      allPlayers[myId] = { name: networkManager.getPlayerName() };
    }
    return allPlayers;
  }

  // Wire up combat callbacks
  combatManager.onHit = (targetId, targetName, score) => {
    hud.showHitNotification(targetName, score);
    hud.updateScore(score);
    leaderboard.update(combatManager.getScores(), getAllPlayersData());
  };

  combatManager.onGotHit = (shooterId, shooterName) => {
    hud.showGotHitEffect();
  };

  // Initialize leaderboard
  const leaderboard = new Leaderboard(container, networkManager);

  // Wire up sound toggle
  hud.onSoundToggle = () => {
    const enabled = combatManager.soundManager.toggle();
    hud.updateSoundToggle(enabled);
  };

  // Create game loop
  const gameLoop = new GameLoop();
  let lastLeaderboardUpdate = 0;

  // Main update callback
  function update(deltaTime) {
    // 1. Process input
    inputHandler.update(deltaTime);
    const input = inputHandler.getState();

    // 2. Update local physics
    updatePhysics(aircraft, input, deltaTime);

    // 3. Check for firing
    if (inputHandler.isFiring()) {
      combatManager.fire();
    }

    // 4. Send local position to server
    networkManager.sendPosition(aircraft);

    // 5. Update remote players
    playerSync.update(deltaTime);

    // 6. Update combat effects
    combatManager.update(deltaTime);

    // 7. Update camera
    cameraController.update(deltaTime);

    // 8. Update HUD
    hud.update(aircraft.getSpeed(), aircraft.getAltitude());
    hud.updateCrosshair(camera, aircraft, THREE);

    // 9. Update leaderboard periodically
    const now = performance.now();
    if (now - lastLeaderboardUpdate > 500) {
      lastLeaderboardUpdate = now;
      leaderboard.update(combatManager.getScores(), getAllPlayersData());
      hud.updateScore(combatManager.getScore());
    }

    // 10. Update tile loading indicator (debug)
    if (CONFIG.debug.showTileStats) {
      hud.showTileStats(tilesRenderer);
    }

    // CRITICAL ORDER - camera matrix MUST update BEFORE tiles
    camera.updateMatrixWorld();
    tilesRenderer.update();

    // Render
    renderer.render(scene, camera);
  }

  // Add update callback and start loop
  gameLoop.addCallback(update);
  gameLoop.start();
}
```

### Task 17.5: Update Aircraft to Support Plane Types

Update `src/player/Aircraft.js` constructor:

```javascript
constructor(position, planeType = 'red') {
  this.planeType = planeType;
  // ... rest of constructor
  this.createMesh(planeType);
}

createMesh(planeType) {
  // Color based on plane type
  const colors = {
    red: 0xe74c3c,
    blue: 0x3498db,
    yellow: 0xf1c40f
  };
  const color = colors[planeType] || colors.red;

  // ... use color in mesh material
}
```

---

## Testing Checklist

### Entry Screen
- [ ] Entry screen appears on load
- [ ] Name input works correctly
- [ ] Plane selection highlights selected plane
- [ ] Progress bar updates as tiles load
- [ ] "Take Off!" button enables after loading + name entered
- [ ] Screen fades out smoothly when clicking button

### Tile Loading
- [ ] Tiles start loading while entry screen shows
- [ ] No green plane visible at any time
- [ ] Buildings render correctly (not underwater)
- [ ] Minimum wait time ensures tiles are loaded
- [ ] Timeout fallback works after 60 seconds

### Gameplay
- [ ] Player name appears in multiplayer
- [ ] Selected plane color is used
- [ ] All existing features work (flight, combat, etc.)

---

## Acceptance Criteria

- [ ] Entry screen with name input and plane selection
- [ ] Progress bar showing tile loading status
- [ ] Minimum 3 second load time (configurable)
- [ ] "Take Off!" button only enabled when ready
- [ ] No fallback green plane (removed entirely)
- [ ] No buildings appearing underwater
- [ ] Smooth transition from entry to gameplay
- [ ] Player name passed to network manager
- [ ] Plane type affects aircraft color

---

## Fallback Strategy

If tile preloading doesn't fully solve the "jank":

1. **Increase minimum load time** to 5-10 seconds
2. **Add camera orbit animation** during loading to pre-request more tiles
3. **Reduce errorTarget** further (to 1) for faster quality convergence
4. **Consider hybrid approach** - procedural ground until tiles load

---

## Benefits

1. **No more green plane bug** - Removed entirely
2. **Tiles loaded before gameplay** - No holes or low-quality tiles at start
3. **Better user experience** - Clear loading state, customization options
4. **Professional feel** - Matches fly.pieter.com's entry experience
5. **Player identity** - Name displayed to other players
