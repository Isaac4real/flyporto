import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * ModelManager - Singleton for loading and caching GLTF aircraft models
 *
 * Features:
 * - Preloads all models on initialization
 * - Caches loaded models to avoid re-fetching
 * - Clones models with accent color applied
 * - Falls back to primitive geometry on load failure
 */

// Model definitions
const MODEL_DEFINITIONS = {
  f16: {
    path: '/models/f16.glb',
    name: 'F-16 Falcon',
    description: 'Agile multirole fighter'
  },
  f22: {
    path: '/models/f22.glb',
    name: 'F-22 Raptor',
    description: 'Stealth air superiority'
  },
  f18: {
    path: '/models/f18.glb',
    name: 'F-18 Hornet',
    description: 'Naval strike fighter'
  },
  cessna: {
    path: '/models/cessna.glb',
    name: 'Cessna 172',
    description: 'Light civilian aircraft'
  }
};

// Color palette for accent colors
const ACCENT_COLORS = {
  red: 0xef4444,
  blue: 0x3b82f6,
  green: 0x22c55e,
  yellow: 0xeab308,
  purple: 0xa855f7,
  orange: 0xf97316
};

let instance = null;

export class ModelManager {
  constructor() {
    if (instance) {
      return instance;
    }
    instance = this;

    this.models = new Map(); // modelId -> THREE.Group (cached original)
    this.loadingPromises = new Map(); // modelId -> Promise
    this.loaded = false;

    // Setup loaders
    this.gltfLoader = new GLTFLoader();

    // Setup DRACO decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  /**
   * Get singleton instance
   * @returns {ModelManager}
   */
  static getInstance() {
    if (!instance) {
      instance = new ModelManager();
    }
    return instance;
  }

  /**
   * Get model definitions
   * @returns {Object}
   */
  getModelDefinitions() {
    return MODEL_DEFINITIONS;
  }

  /**
   * Get accent color hex value
   * @param {string} colorName - Color name (red, blue, green, etc.)
   * @returns {number} Hex color value
   */
  getAccentColor(colorName) {
    return ACCENT_COLORS[colorName] || ACCENT_COLORS.red;
  }

  /**
   * Preload all aircraft models
   * @param {Function} onProgress - Callback (loaded, total, modelId)
   * @returns {Promise<void>}
   */
  async preloadAll(onProgress) {
    const modelIds = Object.keys(MODEL_DEFINITIONS);
    let loaded = 0;

    const promises = modelIds.map(async (modelId) => {
      try {
        await this.loadModel(modelId);
        loaded++;
        if (onProgress) {
          onProgress(loaded, modelIds.length, modelId);
        }
      } catch (error) {
        console.warn(`[ModelManager] Failed to load ${modelId}:`, error.message);
        loaded++;
        if (onProgress) {
          onProgress(loaded, modelIds.length, modelId);
        }
      }
    });

    await Promise.all(promises);
    this.loaded = true;
    console.log(`[ModelManager] Preload complete: ${this.models.size}/${modelIds.length} models loaded`);
  }

  /**
   * Load a single model
   * @param {string} modelId - Model identifier (f16, f22, etc.)
   * @returns {Promise<THREE.Group>}
   */
  async loadModel(modelId) {
    // Return cached model if already loaded
    if (this.models.has(modelId)) {
      return this.models.get(modelId);
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(modelId)) {
      return this.loadingPromises.get(modelId);
    }

    const definition = MODEL_DEFINITIONS[modelId];
    if (!definition) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Create loading promise
    const loadPromise = new Promise((resolve, reject) => {
      this.gltfLoader.load(
        definition.path,
        (gltf) => {
          const model = gltf.scene;

          // Prepare model: compute bounding box, normalize
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Store in cache
          this.models.set(modelId, model);
          this.loadingPromises.delete(modelId);

          console.log(`[ModelManager] Loaded: ${modelId}`);
          resolve(model);
        },
        undefined, // onProgress - not used
        (error) => {
          this.loadingPromises.delete(modelId);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(modelId, loadPromise);
    return loadPromise;
  }

  /**
   * Get a cloned aircraft mesh with accent color applied
   * @param {string} modelId - Model identifier
   * @param {string} accentColor - Color name (red, blue, etc.)
   * @returns {THREE.Group|null}
   */
  getAircraftMesh(modelId, accentColor = 'red') {
    const originalModel = this.models.get(modelId);

    if (!originalModel) {
      console.warn(`[ModelManager] Model not loaded: ${modelId}, using fallback`);
      return null;
    }

    // Clone the model
    const clone = originalModel.clone(true);

    // Apply accent color to appropriate materials
    const accentHex = ACCENT_COLORS[accentColor] || ACCENT_COLORS.red;

    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone material to avoid affecting other instances
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => {
            const clonedMat = mat.clone();
            if (this.isAccentMaterial(mat)) {
              clonedMat.color.setHex(accentHex);
            }
            return clonedMat;
          });
        } else {
          child.material = child.material.clone();
          if (this.isAccentMaterial(child.material)) {
            child.material.color.setHex(accentHex);
          }
        }
      }
    });

    return clone;
  }

  /**
   * Check if a material should receive the accent color
   * Materials are considered "accent" if:
   * - Name contains 'accent', 'detail', 'highlight', 'trim', 'stripe'
   * - OR the original color is close to red/bright colors
   * @param {THREE.Material} material
   * @returns {boolean}
   */
  isAccentMaterial(material) {
    if (!material.name) return false;

    const name = material.name.toLowerCase();
    const accentKeywords = ['accent', 'detail', 'highlight', 'trim', 'stripe', 'color', 'paint'];

    return accentKeywords.some((keyword) => name.includes(keyword));
  }

  /**
   * Create fallback primitive geometry aircraft
   * Used when GLTF model fails to load
   * @param {string} accentColor - Color name
   * @returns {THREE.Group}
   */
  createFallbackMesh(accentColor = 'red') {
    const group = new THREE.Group();

    const accentHex = ACCENT_COLORS[accentColor] || ACCENT_COLORS.red;

    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.4
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.4
    });

    // Fuselage - elongated box (length along -Z)
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 15), bodyMaterial);
    fuselage.position.z = 0;
    group.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 4, 8), accentMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -9.5;
    group.add(nose);

    // Main wings - wide flat box
    const wings = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 4), bodyMaterial);
    wings.position.z = 1;
    group.add(wings);

    // Wing tips with accent color
    const leftWingTip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 4), accentMaterial);
    leftWingTip.position.set(-11, 0, 1);
    group.add(leftWingTip);

    const rightWingTip = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 4), accentMaterial);
    rightWingTip.position.set(11, 0, 1);
    group.add(rightWingTip);

    // Tail fin (vertical stabilizer)
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 3), accentMaterial);
    tailFin.position.set(0, 2, 6);
    group.add(tailFin);

    // Horizontal stabilizer
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 2), bodyMaterial);
    hStab.position.set(0, 0, 6.5);
    group.add(hStab);

    return group;
  }

  /**
   * Check if models are loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Check if a specific model is available
   * @param {string} modelId
   * @returns {boolean}
   */
  hasModel(modelId) {
    return this.models.has(modelId);
  }

  /**
   * Get list of available model IDs
   * @returns {string[]}
   */
  getAvailableModels() {
    return Array.from(this.models.keys());
  }
}
