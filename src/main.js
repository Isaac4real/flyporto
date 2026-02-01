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
import { MouseInput } from './input/MouseInput.js';
import { CameraController } from './player/CameraController.js';
import { NetworkManager } from './network/NetworkManager.js';
import { PlayerSync } from './network/PlayerSync.js';
import { CombatManager } from './combat/CombatManager.js';
import { Leaderboard } from './combat/Leaderboard.js';
import { EntryScreen } from './ui/EntryScreen.js';
import { TilePreloader } from './core/TilePreloader.js';

// Stage 18: Tile streaming performance systems
import { AdaptiveQuality } from './core/AdaptiveQuality.js';
import { PredictiveLoader } from './core/PredictiveLoader.js';
import { FogManager } from './core/FogManager.js';
import { TileLoadingOverlay } from './ui/TileLoadingOverlay.js';

// ============================================================================
// PHASE 1: Initialize rendering (runs in background while entry screen shows)
// ============================================================================

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Add renderer to DOM
document.getElementById('container').appendChild(renderer.domElement);

// Setup lighting
setupLighting(scene);

// NO FALLBACK GROUND PLANE - this was causing the "underwater buildings" bug!
// The entry screen will hide any gaps until tiles are loaded.

// Initialize tiles renderer (includes ReorientationPlugin for Golden Gate Bridge)
const tilesRenderer = createTilesRenderer(camera, renderer);
scene.add(tilesRenderer.group);

// Position camera for initial tile loading (looking at Golden Gate area)
// This ensures tiles start loading even before player starts
camera.position.set(0, CONFIG.startPosition.altitude, 0);
camera.lookAt(0, 0, -1000);  // Look forward

// Start tiles loading immediately (runs in background)
let preloadAnimationId = null;
function preloadUpdate() {
  camera.updateMatrixWorld();
  tilesRenderer.update();
  renderer.render(scene, camera);
  preloadAnimationId = requestAnimationFrame(preloadUpdate);
}
preloadUpdate();

// ============================================================================
// PHASE 2: Show entry screen with loading progress
// ============================================================================

const entryScreen = new EntryScreen();
const preloader = new TilePreloader(tilesRenderer, {
  minLoadTime: 4000,    // Minimum 4 seconds to ensure tiles load
  minTiles: 15,         // Wait for at least 15 tiles
  maxWaitTime: 60000    // Force ready after 60 seconds max
});

// Wire up progress updates to entry screen
preloader.onProgress = (progress, text) => {
  entryScreen.updateProgress(progress, text);
};

preloader.onReady = () => {
  entryScreen.setLoadingComplete();
};

// ============================================================================
// PHASE 3: Start game when user clicks "Take Off!"
// ============================================================================

entryScreen.onReady = ({ name, plane }) => {
  // Stop preload loop
  if (preloadAnimationId) {
    cancelAnimationFrame(preloadAnimationId);
    preloadAnimationId = null;
  }

  // Clean up preloader
  preloader.dispose();

  // Start the actual game with player settings
  startGame(name, plane);
};

/**
 * Start the game with the given player settings
 * @param {string} playerName - Player's chosen name
 * @param {string} planeType - Player's chosen plane type
 */
function startGame(playerName, planeType) {
  console.log(`[Game] Starting game as "${playerName}" with ${planeType} plane`);

  // Create aircraft at starting position with chosen plane type
  const startPosition = new THREE.Vector3(0, CONFIG.startPosition.altitude, 0);
  const aircraft = new Aircraft(startPosition, planeType);
  scene.add(aircraft.mesh);

  // Initialize input system
  const container = document.getElementById('container');
  const keyboardInput = new KeyboardInput();
  const touchInput = new TouchInput(container);
  const mouseInput = new MouseInput(container, {
    sensitivity: CONFIG.mouse?.sensitivity ?? 0.15,
    smoothing: CONFIG.mouse?.smoothing ?? 0.15,
    maxPitchOffset: CONFIG.mouse?.maxPitchOffset ?? 45,
    maxYawOffset: CONFIG.mouse?.maxYawOffset ?? 60,
    invertY: CONFIG.mouse?.invertY ?? false
  });
  const inputHandler = new InputHandler(keyboardInput, touchInput, mouseInput);

  // Initialize camera controller (follow camera)
  const cameraController = new CameraController(camera, aircraft);

  // Setup resize handler
  setupResizeHandler(camera, renderer);

  // Create attribution (legally required for Google tiles)
  createAttribution();

  // Create HUD
  const hud = new HUD(container);

  // ====== STAGE 18: Tile Streaming Performance Systems ======

  // Adaptive quality - adjusts tile quality based on flight speed
  const adaptiveQuality = new AdaptiveQuality(tilesRenderer, {
    minErrorTarget: CONFIG.adaptiveQuality?.minErrorTarget ?? 2,
    maxErrorTarget: CONFIG.adaptiveQuality?.maxErrorTarget ?? 20,
    speedThresholdLow: CONFIG.adaptiveQuality?.speedThresholdLow ?? 40,
    speedThresholdHigh: CONFIG.adaptiveQuality?.speedThresholdHigh ?? 130,
    smoothingRate: CONFIG.adaptiveQuality?.smoothingRate ?? 3.0
  });

  // Predictive loader - pre-requests tiles in flight direction
  const predictiveLoader = new PredictiveLoader(tilesRenderer, camera, {
    enabled: CONFIG.predictiveLoading?.enabled ?? true,
    updateInterval: CONFIG.predictiveLoading?.updateInterval ?? 300,
    minSpeedThreshold: CONFIG.predictiveLoading?.minSpeedThreshold ?? 30,
    lookAheadDistances: CONFIG.predictiveLoading?.lookAheadDistances ?? [400, 800, 1500]
  });

  // Fog manager - dynamic fog to hide unloaded tiles
  const fogManager = new FogManager(scene, {
    enabled: CONFIG.fog?.enabled ?? true,
    baseFogNear: CONFIG.fog?.baseFogNear ?? 4000,
    baseFogFar: CONFIG.fog?.baseFogFar ?? 10000,
    minFogNear: CONFIG.fog?.minFogNear ?? 1500,
    minFogFar: CONFIG.fog?.minFogFar ?? 4000
  });

  // Tile loading overlay - visual feedback when tiles are loading
  const tileLoadingOverlay = new TileLoadingOverlay(container);

  console.log('[Game] Stage 18 tile streaming systems initialized');

  // Initialize network manager with player name
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const networkManager = new NetworkManager(wsUrl, playerName);

  // Initialize player sync for rendering remote players
  const playerSync = new PlayerSync(scene);

  // Store players data for leaderboard
  let playersData = {};

  // Wire up network callbacks
  networkManager.onConnectionChange = (connected) => {
    hud.updateConnectionStatus(connected, 0);
  };

  networkManager.onPlayersUpdate = (players, count) => {
    playersData = players;  // Store for leaderboard
    playerSync.updatePlayers(players);
    hud.updateConnectionStatus(true, count);
  };

  networkManager.onPlayerJoined = (id, name) => {
    console.log(`${name} joined the game`);
    hud.showNotification(`${name} joined`);
  };

  networkManager.onPlayerLeft = (id) => {
    // Get player name before removing
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

  // Helper to get all players data including local player for leaderboard
  function getAllPlayersData() {
    const allPlayers = { ...playersData };
    // Add local player
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

  // Leaderboard update throttling
  let lastLeaderboardUpdate = 0;

  // Main update callback
  function update(deltaTime) {
    // 1. Process input
    inputHandler.update(deltaTime);
    const input = inputHandler.getState();

    // 2. Update local physics
    updatePhysics(aircraft, input, deltaTime);

    // 3. Check for firing (after input update)
    if (inputHandler.isFiring()) {
      combatManager.fire();
    }

    // 4. Send local position to server (throttled to 10Hz internally)
    networkManager.sendPosition(aircraft);

    // 5. Update remote players (interpolation)
    playerSync.update(deltaTime);

    // 6. Update combat effects
    combatManager.update(deltaTime);

    // 7. Update camera to follow local aircraft
    cameraController.update(deltaTime);

    // 8. Update HUD
    hud.update(aircraft.getSpeed(), aircraft.getAltitude());
    hud.updateCrosshair(camera, aircraft, THREE);

    // 9. Update mouse aim reticle
    const mouseAimOffset = inputHandler.getMouseAimOffset();
    hud.updateMouseAimReticle(
      mouseAimOffset,
      inputHandler.isMouseLocked(),
      inputHandler.isKeyboardFlightActive()
    );

    // 10. Update leaderboard periodically (every 500ms, not every frame)
    const now = performance.now();
    if (now - lastLeaderboardUpdate > 500) {
      lastLeaderboardUpdate = now;
      leaderboard.update(combatManager.getScores(), getAllPlayersData());
      hud.updateScore(combatManager.getScore());
    }

    // 11. Debug mode: show tile stats
    if (CONFIG.debug.showTileStats) {
      hud.showTileStats(tilesRenderer);
    }

    // ====== STAGE 18: Tile Streaming Updates ======

    // 12. Update adaptive quality based on flight speed
    const currentSpeed = aircraft.getSpeed();
    adaptiveQuality.update(currentSpeed, deltaTime);

    // 13. Pre-load tiles in flight direction (BEFORE main tile update)
    predictiveLoader.update(aircraft, now);

    // 14. Update dynamic fog based on speed and tile loading state
    const downloadQueueSize = tilesRenderer.downloadQueue?.itemsInList ?? 0;
    const parseQueueSize = tilesRenderer.parseQueue?.itemsInList ?? 0;
    fogManager.update(currentSpeed, downloadQueueSize, deltaTime);

    // 15. Update tile loading overlay
    tileLoadingOverlay.update(downloadQueueSize, parseQueueSize);

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
