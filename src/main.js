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
import { ModelManager } from './core/ModelManager.js';

// Stage 18: Tile streaming performance systems
import { AdaptiveQuality } from './core/AdaptiveQuality.js';
import { PredictiveLoader } from './core/PredictiveLoader.js';
import { FogManager } from './core/FogManager.js';
import { TileLoadingOverlay } from './ui/TileLoadingOverlay.js';

// Stage 19: Landmark checkpoint racing
import { CheckpointManager } from './race/CheckpointManager.js';
import { DirectionIndicator } from './race/CheckpointMarker.js';
import { RaceHUD } from './ui/RaceHUD.js';
import { RouteSelector } from './ui/RouteSelector.js';

// Stage 20: Share system
import { ShareManager } from './share/ShareManager.js';
import { ShareModal } from './ui/ShareModal.js';

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

// ============================================================================
// PRELOAD AIRCRAFT MODELS - Load GLTF models in background
// ============================================================================
const modelManager = ModelManager.getInstance();

// Start preloading models (non-blocking)
modelManager.preloadAll((loaded, total, id) => {
  console.log(`[Models] Loaded ${id} (${loaded}/${total})`);
}).catch(err => {
  console.warn('[Models] Preload error:', err);
});

// ============================================================================
// DEMO AIRCRAFT - Show gameplay while loading
// ============================================================================
function createDemoAircraft() {
  // Try to use loaded model, fall back to primitives
  let group = modelManager.getAircraftMesh('f16', 'orange');

  if (!group) {
    // Fall back to primitive geometry
    group = createFallbackDemoAircraft();
  } else {
    group.scale.setScalar(2.0);
  }

  return group;
}

function createFallbackDemoAircraft() {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 }); // Orange

  // Fuselage
  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 15), bodyMaterial);
  group.add(fuselage);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 4, 8), accentMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -9.5;
  group.add(nose);

  // Main wings
  const wings = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 4), bodyMaterial);
  wings.position.z = 1;
  group.add(wings);

  // Wing tips
  const leftWingTip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 4), accentMaterial);
  leftWingTip.position.set(-11, 0, 1);
  group.add(leftWingTip);

  const rightWingTip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 4), accentMaterial);
  rightWingTip.position.set(11, 0, 1);
  group.add(rightWingTip);

  // Tail fin
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 3), accentMaterial);
  tailFin.position.set(0, 2, 6);
  group.add(tailFin);

  // Horizontal stabilizer
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 2), bodyMaterial);
  hStab.position.set(0, 0, 6.5);
  group.add(hStab);

  group.scale.setScalar(2.0);
  return group;
}

// Demo aircraft flying a scenic figure-8 path
const demoAircraft = createDemoAircraft();
scene.add(demoAircraft);

// ============================================================================
// CINEMATIC APPROACH - Slow pan toward Golden Gate Bridge
// Tiles load to high quality since camera direction stays consistent
// ============================================================================
const cinematicPath = {
  // Start position: far from bridge, approaching from the ocean side
  startPos: new THREE.Vector3(800, 400, 1200),
  // End position: close to bridge
  endPos: new THREE.Vector3(-200, 350, -400),
  // Duration: 60 seconds for full journey (but user will likely start before)
  duration: 60000,
  startTime: performance.now()
};

// Camera follows behind and above the aircraft
const cinematicCamera = {
  followDistance: 120,
  followHeight: 35,
  lookAheadDistance: 200
};

// Start tiles loading with slow cinematic approach
let preloadAnimationId = null;
function preloadUpdate() {
  const elapsed = performance.now() - cinematicPath.startTime;
  // Progress from 0 to 1, clamped
  const progress = Math.min(1, elapsed / cinematicPath.duration);

  // Smooth easing for natural motion (ease-out)
  const eased = 1 - Math.pow(1 - progress, 2);

  // Interpolate position along path
  const x = cinematicPath.startPos.x + (cinematicPath.endPos.x - cinematicPath.startPos.x) * eased;
  const y = cinematicPath.startPos.y + (cinematicPath.endPos.y - cinematicPath.startPos.y) * eased;
  const z = cinematicPath.startPos.z + (cinematicPath.endPos.z - cinematicPath.startPos.z) * eased;

  // Position demo aircraft
  demoAircraft.position.set(x, y, z);

  // Calculate flight direction (toward end point)
  const direction = new THREE.Vector3()
    .subVectors(cinematicPath.endPos, cinematicPath.startPos)
    .normalize();

  // Orient aircraft to face flight direction
  const yaw = Math.atan2(-direction.x, -direction.z);
  const pitch = Math.asin(direction.y) * 0.3; // Subtle pitch
  demoAircraft.rotation.set(pitch, yaw, 0);

  // Camera position: behind and above aircraft
  const cameraPos = new THREE.Vector3(
    x - direction.x * cinematicCamera.followDistance,
    y + cinematicCamera.followHeight,
    z - direction.z * cinematicCamera.followDistance
  );
  camera.position.copy(cameraPos);

  // Look ahead of aircraft toward the bridge
  const lookTarget = new THREE.Vector3(
    x + direction.x * cinematicCamera.lookAheadDistance,
    y - 20, // Look slightly down toward the ground/bridge
    z + direction.z * cinematicCamera.lookAheadDistance
  );
  camera.lookAt(lookTarget);

  camera.updateMatrixWorld();
  tilesRenderer.update();
  renderer.render(scene, camera);
  preloadAnimationId = requestAnimationFrame(preloadUpdate);
}

// Initialize camera
camera.position.copy(cinematicPath.startPos);
camera.lookAt(cinematicPath.endPos);

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

entryScreen.onReady = ({ name, planeType, planeColor }) => {
  // Stop preload loop
  if (preloadAnimationId) {
    cancelAnimationFrame(preloadAnimationId);
    preloadAnimationId = null;
  }

  // Remove demo aircraft from scene
  scene.remove(demoAircraft);
  demoAircraft.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });

  // Clean up preloader
  preloader.dispose();

  // Start the actual game with player settings
  startGame(name, planeType, planeColor);
};

/**
 * Start the game with the given player settings
 * @param {string} playerName - Player's chosen name
 * @param {string} planeType - Player's chosen aircraft type (f16, f22, f18, cessna)
 * @param {string} planeColor - Player's chosen accent color (red, blue, green, etc.)
 */
function startGame(playerName, planeType, planeColor) {
  console.log(`[Game] Starting game as "${playerName}" with ${planeType} plane (${planeColor})`);

  // Create aircraft at starting position with chosen plane type and color
  const startPosition = new THREE.Vector3(0, CONFIG.startPosition.altitude, 0);
  const aircraft = new Aircraft(startPosition, planeColor, planeType);
  scene.add(aircraft.mesh);

  // Initialize input system
  const container = document.getElementById('container');
  const keyboardInput = new KeyboardInput();
  const touchInput = new TouchInput(container);
  const inputHandler = new InputHandler(keyboardInput, touchInput);

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

  // Initialize network manager with player name and aircraft settings
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
  const networkManager = new NetworkManager(wsUrl, playerName);
  networkManager.setPlaneType(planeType);
  networkManager.setPlaneColor(planeColor);

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

  // ====== STAGE 19: Checkpoint Racing System ======

  const checkpointManager = new CheckpointManager(scene, {
    debug: CONFIG.debug?.showCheckpoints ?? false
  });

  const raceHUD = new RaceHUD(container);
  const routeSelector = new RouteSelector(container);
  const directionIndicator = new DirectionIndicator(container);

  /**
   * Helper: Teleport player to race starting position
   * Positions player 400m before checkpoint 1, aligned to fly toward checkpoint 2
   */
  function teleportToRaceStart() {
    const firstCheckpoint = checkpointManager.checkpoints[0];
    const secondCheckpoint = checkpointManager.checkpoints[1];
    if (!firstCheckpoint) return;

    const cp1Pos = firstCheckpoint.trigger.position;
    const distFromCheckpoint = 400;

    let approachDir;

    if (secondCheckpoint) {
      // Calculate direction from checkpoint 1 toward checkpoint 2
      const cp2Pos = secondCheckpoint.trigger.position;
      approachDir = new THREE.Vector3().subVectors(cp2Pos, cp1Pos).normalize();
    } else {
      // Single checkpoint race: approach from a default direction (from south)
      approachDir = new THREE.Vector3(0, 0, -1);
    }

    // Start position: 400m BEFORE checkpoint 1 (opposite of approach direction)
    const startPos = cp1Pos.clone().sub(
      approachDir.clone().multiplyScalar(distFromCheckpoint)
    );

    // Ensure reasonable altitude
    startPos.y = Math.max(cp1Pos.y, Math.min(cp1Pos.y + 100, 500));

    // Teleport aircraft to start position, facing checkpoint 1
    aircraft.teleportTo(startPos, cp1Pos, 80);

    console.log(`[Race] Teleported to start: (${startPos.x.toFixed(0)}, ${startPos.y.toFixed(0)}, ${startPos.z.toFixed(0)})`);
  }

  /**
   * Helper: Start or restart a race with full UI setup
   */
  function startRaceWithUI() {
    teleportToRaceStart();
    checkpointManager.startRace();
    raceHUD.show(checkpointManager.routeName, checkpointManager.checkpoints.length);
    raceHUD.updateProgress(0, checkpointManager.checkpoints[0]?.landmark.shortName);
    directionIndicator.show();
    // First checkpoint is the start gate - timer starts when you fly through it
    hud.showNotification(`Fly through ${checkpointManager.checkpoints[0]?.landmark.shortName} to start!`, 4000);
  }

  // Wire up route selection
  routeSelector.onRouteSelected = (route) => {
    checkpointManager.loadRoute(route);
    startRaceWithUI();
  };

  // Wire up checkpoint callbacks
  checkpointManager.onCheckpointReached = (checkpoint, index, splitTime) => {
    const nextCheckpoint = checkpointManager.checkpoints[index + 1];
    raceHUD.showCheckpointNotification(
      checkpoint.landmark.shortName,
      splitTime,
      index + 1,
      checkpointManager.checkpoints.length
    );
    raceHUD.updateProgress(
      index + 1,
      nextCheckpoint?.landmark.shortName || null,
      null
    );
  };

  // ====== STAGE 20: Share System ======

  const shareManager = new ShareManager(renderer, {
    twitter: {
      gameUrl: CONFIG.share?.gameUrl ?? 'https://flysf.io',
      defaultHashtags: CONFIG.share?.twitterHashtags ?? ['flysf', 'flightsim'],
      via: CONFIG.share?.twitterVia ?? null
    },
    compositor: {
      brandingText: CONFIG.share?.brandingText ?? 'FLYSF.IO'
    }
  });

  const shareModal = new ShareModal(container);

  // Wire up share modal callbacks
  shareModal.onShareTwitter = () => shareManager.shareToTwitter();
  shareModal.onDownload = () => shareManager.downloadImage();
  shareModal.onCopy = async () => await shareManager.copyToClipboard();
  shareModal.onNativeShare = async () => await shareManager.nativeShare();
  shareModal.onPlayAgain = () => {
    startRaceWithUI();
  };
  shareModal.onClose = () => {
    // Continue flying without race
  };

  // Wire up race completion -> share flow
  checkpointManager.onRaceComplete = async (result) => {
    // Hide direction indicator
    directionIndicator.hide();

    // Hide race HUD, show completion
    raceHUD.showRaceComplete(result);

    // Capture screenshot after render (next frame)
    requestAnimationFrame(async () => {
      try {
        const captureResult = await shareManager.captureRaceCompletion(result, playerName);
        // Store for later sharing
        console.log('[Game] Race screenshot captured');
      } catch (error) {
        console.error('[Game] Failed to capture screenshot:', error);
      }
    });
  };

  // Wire up race HUD share button -> share modal
  raceHUD.onShareClick = async (result) => {
    raceHUD.hideRaceComplete();
    if (shareManager.hasCapture()) {
      shareModal.show({
        blob: shareManager.getBlob(),
        dataUrl: shareManager.getPreviewUrl(),
        raceData: result
      });
    } else {
      // If no capture, try to capture now
      try {
        const captureResult = await shareManager.captureRaceCompletion(result, playerName);
        shareModal.show(captureResult);
      } catch (error) {
        console.error('[Game] Failed to capture for share:', error);
        hud.showNotification('Could not capture screenshot');
      }
    }
  };

  raceHUD.onRetryClick = () => {
    startRaceWithUI();
  };

  // Add keyboard shortcuts for race system
  document.addEventListener('keydown', (e) => {
    // Only handle if not typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // R key - Open route selector
    if (e.key === 'r' || e.key === 'R') {
      // Don't open if race is active or modals are open
      if (checkpointManager.isRaceActive()) {
        hud.showNotification('Press ESC to cancel race', 2000);
        return;
      }
      if (raceHUD.isShowingComplete() || shareModal.isVisible()) {
        return;
      }
      routeSelector.toggle();
    }

    // ESC key - Cancel active race (but not if modals are open - they handle ESC themselves)
    if (e.key === 'Escape') {
      if (checkpointManager.isRaceActive() && !raceHUD.isShowingComplete() && !shareModal.isVisible() && !routeSelector.isVisible()) {
        checkpointManager.cancelRace();
        raceHUD.hide();
        directionIndicator.hide();
        hud.showNotification('Race cancelled', 2000);
      }
    }
  });

  console.log('[Game] Stage 19-20 race and share systems initialized');

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

    // 6.5. Update checkpoint racing (Stage 19)
    if (checkpointManager.isRaceActive()) {
      checkpointManager.update(aircraft.position, deltaTime);

      // Update race HUD timer and distance
      const raceState = checkpointManager.getRaceState();
      raceHUD.updateTimer(raceState.currentTime, raceState.started);

      const distance = checkpointManager.getDistanceToCheckpoint(aircraft.position);
      if (distance !== null) {
        raceHUD.updateProgress(
          raceState.currentCheckpoint - 1,
          raceState.nextCheckpointName,
          distance
        );
      }

      // Update direction indicator pointing to next checkpoint
      const targetPos = checkpointManager.getCurrentCheckpointPosition();
      if (targetPos) {
        directionIndicator.update(camera, targetPos, aircraft.position);
      }
    }

    // 7. Update camera to follow local aircraft
    cameraController.update(deltaTime);

    // 8. Update HUD
    hud.update(aircraft.getSpeed(), aircraft.getAltitude());
    hud.updateCrosshair(camera, aircraft, THREE);

    // 9. Update leaderboard periodically (every 500ms, not every frame)
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
