import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * ModelManager - Singleton for loading and caching GLTF aircraft models
 *
 * Uses Ikram's "Low poly Fighter Jets" model (CC-BY-4.0)
 * Credit: https://sketchfab.com/3d-models/low-poly-fighter-jets-71505a45880c40eebe964c6e3c4bdc11
 * Author: Ikram (https://sketchfab.com/IkramBandagi)
 */

// Aircraft definitions - maps our IDs to node names in the GLB
// rotationY: correction to face -Z (forward in Three.js)
const MODEL_DEFINITIONS = {
  jet1: {
    name: 'Fighter Jet',
    description: 'Sleek combat fighter',
    nodeName: 'FighterJet1_4',
    rotationY: 0  // Faces correct direction
  },
  jet2: {
    name: 'Strike Fighter',
    description: 'Heavy attack fighter',
    nodeName: 'FighterJet2_3',
    rotationY: Math.PI  // Needs 180° rotation
  },
  plane1: {
    name: 'Light Aircraft',
    description: 'Agile propeller plane',
    nodeName: 'Plane1_0',
    rotationY: 0  // Faces correct direction
  },
  plane2: {
    name: 'Sport Plane',
    description: 'Fast sport aircraft',
    nodeName: 'Plane2_1',
    rotationY: 0  // Faces correct direction
  },
  plane3: {
    name: 'Trainer',
    description: 'Versatile trainer',
    nodeName: 'Plane3_2',
    rotationY: Math.PI  // Needs 180° rotation
  }
};

// Team color tint values (applied as subtle overlay)
const TEAM_COLORS = {
  red: new THREE.Color(0.9, 0.3, 0.3),
  blue: new THREE.Color(0.3, 0.5, 0.9),
  green: new THREE.Color(0.3, 0.8, 0.4),
  yellow: new THREE.Color(0.9, 0.8, 0.2),
  purple: new THREE.Color(0.7, 0.3, 0.9),
  orange: new THREE.Color(0.95, 0.5, 0.2)
};

// Path to the model file
const MODEL_PATH = '/models/fighter-jets-ikram.glb';

let instance = null;

export class ModelManager {
  constructor() {
    if (instance) {
      return instance;
    }
    instance = this;

    this.models = new Map(); // modelId -> THREE.Group (cached original)
    this.collectionScene = null;
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;

    // Setup loaders
    this.gltfLoader = new GLTFLoader();

    // Setup DRACO decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!instance) {
      instance = new ModelManager();
    }
    return instance;
  }

  /**
   * Get model definitions
   */
  getModelDefinitions() {
    return MODEL_DEFINITIONS;
  }

  /**
   * Preload all aircraft models from the collection
   */
  async preloadAll(onProgress) {
    if (this.loaded) return;
    if (this.loading) return this.loadPromise;

    this.loading = true;

    this.loadPromise = new Promise(async (resolve) => {
      try {
        console.log('[ModelManager] Loading aircraft from', MODEL_PATH);
        const gltf = await this.loadGLTF(MODEL_PATH);
        this.collectionScene = gltf.scene;

        // Debug: print scene structure
        console.log('[ModelManager] Model loaded, extracting aircraft...');
        this.debugPrintScene(gltf.scene);

        // Extract individual aircraft
        const modelIds = Object.keys(MODEL_DEFINITIONS);
        let loaded = 0;

        for (const modelId of modelIds) {
          const extracted = this.extractAircraft(modelId);
          if (extracted) {
            this.models.set(modelId, extracted);
            console.log(`[ModelManager] Extracted: ${modelId}`);
          } else {
            console.warn(`[ModelManager] Could not find: ${modelId}`);
          }
          loaded++;
          if (onProgress) {
            onProgress(loaded, modelIds.length, modelId);
          }
        }

        this.loaded = true;
        this.loading = false;
        console.log(`[ModelManager] Preload complete: ${this.models.size}/${modelIds.length} aircraft`);
        resolve();
      } catch (error) {
        console.error('[ModelManager] Failed to load models:', error);
        this.loading = false;
        resolve(); // Don't reject - we'll use fallbacks
      }
    });

    return this.loadPromise;
  }

  /**
   * Load a GLTF file
   */
  loadGLTF(path) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }

  /**
   * Debug print scene structure
   */
  debugPrintScene(node, depth = 0) {
    if (depth > 3) return;
    const indent = '  '.repeat(depth);
    const type = node.isMesh ? 'MESH' : 'NODE';
    console.log(`${indent}[${type}] "${node.name}"`);
    node.children.forEach(child => this.debugPrintScene(child, depth + 1));
  }

  /**
   * Extract a specific aircraft from the loaded collection
   */
  extractAircraft(modelId) {
    if (!this.collectionScene) return null;

    const definition = MODEL_DEFINITIONS[modelId];
    if (!definition) return null;

    // Find the node by name
    let foundNode = null;
    this.collectionScene.traverse((node) => {
      if (node.name === definition.nodeName) {
        foundNode = node;
      }
    });

    if (!foundNode) {
      console.warn(`[ModelManager] Node "${definition.nodeName}" not found for ${modelId}`);
      return null;
    }

    // Clone the node and all its children
    const clone = foundNode.clone(true);

    // Create a wrapper group
    const wrapper = new THREE.Group();
    wrapper.name = modelId;
    wrapper.add(clone);

    // Center the model
    const box = new THREE.Box3().setFromObject(wrapper);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);

    // Scale to consistent size (target wingspan ~20 units)
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 20 / maxDim;
      wrapper.scale.setScalar(scale);
    }

    // Apply per-model rotation to face -Z (forward in Three.js)
    clone.rotation.y = definition.rotationY ?? Math.PI;

    return wrapper;
  }

  /**
   * Get a cloned aircraft mesh (preserves original texture colors)
   * Team color parameter is kept for API compatibility but not applied
   * since the model has proper baked-in colors
   */
  getAircraftMesh(modelId, teamColor = 'blue') {
    const original = this.models.get(modelId);

    if (!original) {
      console.warn(`[ModelManager] Model not loaded: ${modelId}, using fallback`);
      return null;
    }

    // Clone the model
    const clone = original.clone(true);

    // Clone materials and enable shadows (preserve original colors)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }

  /**
   * Create fallback primitive geometry aircraft
   */
  createFallbackMesh(teamColor = 'blue') {
    const group = new THREE.Group();
    const tint = TEAM_COLORS[teamColor] || TEAM_COLORS.blue;

    // Body material with team color
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b7280,
      metalness: 0.6,
      roughness: 0.4,
      emissive: tint,
      emissiveIntensity: 0.2
    });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 15), bodyMaterial);
    fuselage.castShadow = true;
    group.add(fuselage);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 4, 8), bodyMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -9.5;
    group.add(nose);

    // Wings
    const wings = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 4), bodyMaterial);
    wings.position.z = 1;
    wings.castShadow = true;
    group.add(wings);

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 3), bodyMaterial);
    tail.position.set(0, 2, 6);
    group.add(tail);

    // Horizontal stabilizer
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 2), bodyMaterial);
    hStab.position.set(0, 0, 6.5);
    group.add(hStab);

    return group;
  }

  /**
   * Check if models are loaded
   */
  isLoaded() {
    return this.loaded;
  }

  /**
   * Check if a specific model is available
   */
  hasModel(modelId) {
    return this.models.has(modelId);
  }

  /**
   * Get list of available model IDs
   */
  getAvailableModels() {
    return Array.from(this.models.keys());
  }
}
