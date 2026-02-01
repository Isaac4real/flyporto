import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Create and configure the Three.js scene
 * @returns {THREE.Scene}
 */
export function createScene() {
  const scene = new THREE.Scene();

  // Sky blue background
  const skyColor = 0x87CEEB;
  scene.background = new THREE.Color(skyColor);

  // Distance fog - fades to sky color to hide unloaded tiles
  // Near: start fade at 4000m, Far: fully fogged at 10000m
  if (CONFIG.fog?.enabled) {
    scene.fog = new THREE.Fog(skyColor, 4000, 10000);
  }

  return scene;
}

/**
 * Create camera with globe-appropriate settings
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far  // 1e12 - CRITICAL for globe viewing
  );
  return camera;
}

/**
 * Create and configure the WebGL renderer
 * @returns {THREE.WebGLRenderer}
 */
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true  // Required for extreme near/far ratio (1e12)
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
  return renderer;
}

/**
 * Setup lighting for the scene
 * @param {THREE.Scene} scene
 */
export function setupLighting(scene) {
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Directional light for shadows/depth
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);
}

/**
 * Setup window resize handler
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 */
export function setupResizeHandler(camera, renderer) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
