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

// Initialize scene components
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Add renderer to DOM
document.getElementById('container').appendChild(renderer.domElement);

// Setup lighting
setupLighting(scene);

// Add fallback ground plane (visible when tiles haven't loaded)
// Uses forest green - more natural than ocean blue when flying over land
const fallbackGroundGeometry = new THREE.PlaneGeometry(20000, 20000);
const fallbackGroundMaterial = new THREE.MeshBasicMaterial({
  color: 0x1a4d2e,  // Forest green
  side: THREE.DoubleSide
});
const fallbackGround = new THREE.Mesh(fallbackGroundGeometry, fallbackGroundMaterial);
fallbackGround.rotation.x = -Math.PI / 2;  // Rotate to horizontal
fallbackGround.position.y = -10;  // Slightly below sea level to avoid z-fighting
scene.add(fallbackGround);

// Initialize tiles renderer (includes ReorientationPlugin for Golden Gate Bridge)
const tilesRenderer = createTilesRenderer(camera, renderer);
scene.add(tilesRenderer.group);

// Create aircraft at starting position
// ReorientationPlugin places Golden Gate at origin with Y-up
// So starting position is at origin X/Z, with altitude as Y
const startPosition = new THREE.Vector3(0, CONFIG.startPosition.altitude, 0);
const aircraft = new Aircraft(startPosition);
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

// Create attribution (legally required)
createAttribution();

// Create HUD
const hud = new HUD(container);

// Initialize network manager for multiplayer
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const networkManager = new NetworkManager(wsUrl);

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
  // Player will be added on next updatePlayers call
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

  // 9. Update leaderboard periodically (every 500ms, not every frame)
  const now = performance.now();
  if (now - lastLeaderboardUpdate > 500) {
    lastLeaderboardUpdate = now;
    leaderboard.update(combatManager.getScores(), getAllPlayersData());
    hud.updateScore(combatManager.getScore());
  }

  // 10. Move fallback ground to follow aircraft (prevents seeing edge of plane)
  fallbackGround.position.x = aircraft.position.x;
  fallbackGround.position.z = aircraft.position.z;

  // 11. Update tile loading indicator
  hud.updateTileLoading(tilesRenderer);

  // 12. Debug mode: show tile stats
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
