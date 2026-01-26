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

// Initialize scene components
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Add renderer to DOM
document.getElementById('container').appendChild(renderer.domElement);

// Setup lighting
setupLighting(scene);

// Add ground fallback plane (dark ocean blue, visible when tiles haven't loaded)
const groundGeometry = new THREE.PlaneGeometry(100000, 100000);
const groundMaterial = new THREE.MeshBasicMaterial({
  color: 0x1a3d5c,  // Dark ocean blue
  side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;  // Rotate to horizontal
ground.position.y = 0;  // At sea level
scene.add(ground);

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

// Create game loop
const gameLoop = new GameLoop();

// Main update callback
function update(deltaTime) {
  // 1. Process input
  inputHandler.update(deltaTime);
  const input = inputHandler.getState();

  // 2. Update physics with player input
  updatePhysics(aircraft, input, deltaTime);

  // 3. Update camera to follow aircraft
  cameraController.update(deltaTime);

  // 4. Update HUD with current speed and altitude
  hud.update(aircraft.getSpeed(), aircraft.getAltitude());

  // CRITICAL ORDER - camera matrix MUST update BEFORE tiles
  camera.updateMatrixWorld();
  tilesRenderer.update();

  // Render
  renderer.render(scene, camera);
}

// Add update callback and start loop
gameLoop.addCallback(update);
gameLoop.start();
