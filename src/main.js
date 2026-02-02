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
import { CockpitOverlay } from './ui/CockpitOverlay.js';
import { createBlimpBanner } from './world/BlimpBanner.js';

// Stage 18: Tile streaming performance systems
import { AdaptiveQuality } from './core/AdaptiveQuality.js';
import { PredictiveLoader } from './core/PredictiveLoader.js';
import { FogManager } from './core/FogManager.js';
import { TileLoadingOverlay } from './ui/TileLoadingOverlay.js';

function createRateLimitBanner() {
  const banner = document.createElement('div');
  banner.id = 'rate-limit-banner';
  banner.textContent = 'We’re battling rate limits. Tiles may or may not load right now — we’re working on it.';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    text-align: center;
    background: rgba(153, 27, 27, 0.92);
    color: #fff4f4;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.2px;
    z-index: 20000;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  `;

  document.body.appendChild(banner);

  const updateBannerHeight = () => {
    const height = banner.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--top-banner-height', `${height}px`);
  };

  updateBannerHeight();
  window.addEventListener('resize', updateBannerHeight);
}

// ============================================================================
// PHASE 1: Initialize rendering (runs in background while entry screen shows)
// ============================================================================

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Add renderer to DOM
document.getElementById('container').appendChild(renderer.domElement);
createRateLimitBanner();

// Setup lighting
setupLighting(scene);

// NO FALLBACK GROUND PLANE - this was causing the "underwater buildings" bug!
// The entry screen will hide any gaps until tiles are loaded.

// Initialize tiles renderer (includes ReorientationPlugin for Golden Gate Bridge)
const tilesRenderer = createTilesRenderer(camera, renderer);
scene.add(tilesRenderer.group);

// Force highest quality tiles during preload (errorTarget = 1 means maximum detail)
const originalErrorTarget = tilesRenderer.errorTarget;
tilesRenderer.errorTarget = 1;

// ============================================================================
// PRELOAD AIRCRAFT MODELS - Load GLTF models in background
// ============================================================================
const modelManager = ModelManager.getInstance();

// Start preloading models (non-blocking) - store promise for later use
const modelsLoadPromise = modelManager.preloadAll((loaded, total, id) => {
  console.log(`[Models] Loaded ${id} (${loaded}/${total})`);
}).catch(err => {
  console.warn('[Models] Preload error:', err);
});

// ============================================================================
// DEMO AIRCRAFT - Show gameplay while loading
// ============================================================================
function createDemoAircraft() {
  // Try to use loaded model, fall back to primitives
  let innerMesh = modelManager.getAircraftMesh('f16', 'orange');

  if (!innerMesh) {
    // Fall back to primitive geometry
    innerMesh = createFallbackDemoAircraft();
    // Fallback meshes need 180° rotation (GLTF models already rotated by ModelManager)
    innerMesh.rotation.y = Math.PI;
  }

  // Scale the inner mesh (rotation already handled by ModelManager for GLTF models)
  innerMesh.scale.setScalar(0.15);

  // Wrap in outer group for cinematic animation
  const wrapper = new THREE.Group();
  wrapper.add(innerMesh);

  return wrapper;
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

  return group;
}

// Demo aircraft flying a scenic figure-8 path
const demoAircraft = createDemoAircraft();
scene.add(demoAircraft);

// ============================================================================
// CINEMATIC APPROACH - Slow pan toward Golden Gate Bridge
// Tiles load to high quality since camera direction stays consistent
// ============================================================================

// Calculate gameplay camera position based on CONFIG
// This ensures the cinematic ends at the exact position where gameplay starts
const FOLLOW = CONFIG.camera.follow;
const headingRad = (CONFIG.startPosition.heading || 0) * Math.PI / 180;

const cinematicPath = {
  // Start position: far from bridge, approaching from the ocean side
  startPos: new THREE.Vector3(800, 400, 1200),
  // End at gameplay camera position: behind and above aircraft at origin
  // Aircraft starts at (0, altitude, 0), camera is behind based on heading
  endPos: new THREE.Vector3(
    Math.sin(headingRad) * FOLLOW.distance,
    CONFIG.startPosition.altitude + FOLLOW.height,
    Math.cos(headingRad) * FOLLOW.distance
  ),
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
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const networkManager = new NetworkManager(wsUrl, { autoJoin: false });

networkManager.onNameUpdate = (name) => {
  entryScreen.setCallsign(name);
};

networkManager.onError = (msg) => {
  if (msg?.code === 'join_rate_limited') {
    entryScreen.showError('Join rate limited. Please wait and try again.');
  } else if (msg?.code === 'assign_rate_limited') {
    entryScreen.showError('Please wait before requesting a new callsign.');
  } else if (msg?.message) {
    entryScreen.showError(msg.message);
  }
};

entryScreen.onReroll = () => {
  entryScreen.showError('');
  networkManager.requestCallsign();
};

// Refresh preview when models finish loading (fixes initial fallback issue)
modelsLoadPromise.then(() => {
  if (entryScreen && typeof entryScreen.updatePreviewModel === 'function') {
    entryScreen.updatePreviewModel();
  }
});

const preloader = new TilePreloader(tilesRenderer, {
  minLoadTime: 4000,    // Minimum 4 seconds to load tiles
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

entryScreen.onReady = ({ planeType, planeColor }) => {
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

  // Restore original errorTarget (AdaptiveQuality manages from here)
  tilesRenderer.errorTarget = originalErrorTarget;

  // Clean up preloader
  preloader.dispose();

  // Start the actual game with player settings
  startGame(planeType, planeColor);
};

/**
 * Start the game with the given player settings
 * @param {string} planeType - Player's chosen aircraft type (f16, f22, f18, cessna)
 * @param {string} planeColor - Player's chosen accent color (red, blue, green, etc.)
 */
function startGame(planeType, planeColor) {
  console.log(`[Game] Starting game with ${planeType} plane (${planeColor})`);

  // Create aircraft at starting position with chosen plane type and color
  const startPosition = new THREE.Vector3(0, CONFIG.startPosition.altitude, 0);
  const initialHeading = CONFIG.startPosition.heading || 0;
  const aircraft = new Aircraft(startPosition, planeColor, planeType, initialHeading);
  scene.add(aircraft.mesh);

  // Initialize input system
  const container = document.getElementById('container');
  const keyboardInput = new KeyboardInput();
  const touchInput = new TouchInput(container);
  const inputHandler = new InputHandler(keyboardInput, touchInput);

  // Initialize camera controller (follow camera)
  const cameraController = new CameraController(camera, aircraft);

  // Spawn promotional blimp banner in front and above the player
  const blimp = createBlimpBanner({ text: 'www.grw.ai' });
  scene.add(blimp.group);
  blimp.group.scale.setScalar(0.55);
  const blimpForward = new THREE.Vector3(0, 0, -1).applyEuler(aircraft.rotation).normalize();
  const blimpUp = new THREE.Vector3(0, 1, 0);
  const blimpRight = new THREE.Vector3().crossVectors(blimpForward, blimpUp).normalize();
  blimp.group.position.copy(aircraft.position)
    .add(blimpForward.multiplyScalar(620))
    .add(blimpUp.multiplyScalar(150))
    .add(blimpRight.multiplyScalar(80));

  const blimpToPlayer = new THREE.Vector3()
    .subVectors(aircraft.position, blimp.group.position)
    .normalize();
  const blimpFlightDir = new THREE.Vector3().crossVectors(blimpUp, blimpToPlayer).normalize();
  const blimpBasis = new THREE.Matrix4().makeBasis(blimpToPlayer, blimpUp, blimpFlightDir);
  blimp.group.setRotationFromMatrix(blimpBasis);
  const blimpBaseQuaternion = blimp.group.quaternion.clone();
  const blimpBasePosition = blimp.group.position.clone();

  // Setup resize handler
  setupResizeHandler(camera, renderer);

  // Create attribution (legally required for Google tiles)
  createAttribution();

  // Create HUD
  const hud = new HUD(container);
  const cockpitOverlay = new CockpitOverlay(container);

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
    minFogFar: CONFIG.fog?.minFogFar ?? 4000,
    speedThreshold: CONFIG.fog?.speedThreshold ?? 60,
    queueThreshold: CONFIG.fog?.queueThreshold ?? 25,
    smoothingRate: CONFIG.fog?.smoothingRate ?? 2.0
  });

  // Tile loading overlay - visual feedback when tiles are loading
  const tileLoadingOverlay = new TileLoadingOverlay(container);

  console.log('[Game] Stage 18 tile streaming systems initialized');

  networkManager.setPlaneType(planeType);
  networkManager.setPlaneColor(planeColor);
  networkManager.join();

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

  networkManager.onNameUpdate = (name) => {
    hud.showNotification(`Callsign assigned: ${name}`);
  };

  networkManager.onError = (msg) => {
    if (msg?.code === 'join_rate_limited') {
      hud.showNotification('Join rate limited. Please wait and try again.');
    } else if (msg?.code === 'assign_rate_limited') {
      hud.showNotification('Please wait before requesting a new callsign.');
    } else if (msg?.message) {
      hud.showNotification(msg.message);
    }
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
  const fixedStep = CONFIG.physics?.fixedStep ?? (1 / 60);
  const maxSubSteps = CONFIG.physics?.maxSubSteps ?? 5;
  let physicsAccumulator = 0;
  let viewTogglePressed = false;

  // Main update callback
  function update(deltaTime) {
    // 1. Process input
    inputHandler.update(deltaTime);
    const input = inputHandler.getState();

    // 2. Fixed timestep physics update
    physicsAccumulator += deltaTime;
    let subSteps = 0;
    while (physicsAccumulator >= fixedStep && subSteps < maxSubSteps) {
      updatePhysics(aircraft, input, fixedStep);
      physicsAccumulator -= fixedStep;
      subSteps += 1;
    }
    if (subSteps === maxSubSteps) {
      // Prevent spiral of death by dropping leftover time
      physicsAccumulator = 0;
    }

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

    // 6.5 Toggle cockpit view
    const viewToggleActive = keyboardInput.isActionActive('viewToggle');
    if (viewToggleActive && !viewTogglePressed) {
      cameraController.toggleMode();
    }
    viewTogglePressed = viewToggleActive;

    const inCockpit = cameraController.getMode() === 'cockpit';

    // 7. Update camera to follow local aircraft
    cameraController.update(deltaTime);

    // Keep the blimp banner readable at spawn
    if (blimp) {
      const nowMs = performance.now();
      const floatOffset = Math.sin(nowMs * 0.00035) * 2.0;
      const forwardOffset = Math.sin(nowMs * 0.00005) * 90;
      const lateralOffset = Math.cos(nowMs * 0.00005) * 26;
      const roll = Math.sin(nowMs * 0.00022) * 0.035;
      const yaw = Math.sin(nowMs * 0.00014) * 0.03;

      blimp.group.position.copy(blimpBasePosition)
        .addScaledVector(blimpFlightDir, forwardOffset)
        .addScaledVector(blimpToPlayer, lateralOffset);
      blimp.group.position.y = blimpBasePosition.y + floatOffset;

      blimp.group.quaternion.copy(blimpBaseQuaternion);
      blimp.group.rotateZ(roll);
      blimp.group.rotateY(yaw);
    }

    // 8. Update HUD
    hud.update(aircraft.getSpeed(), aircraft.getAltitude());
    cockpitOverlay.setVisible(inCockpit);
    cockpitOverlay.update(aircraft.getSpeed(), aircraft.getAltitude(), aircraft.throttle ?? 0);
    hud.updateCrosshair(camera, aircraft, THREE);
    hud.updateFlightStats(aircraft, CONFIG.debug.showFlightStats);

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
