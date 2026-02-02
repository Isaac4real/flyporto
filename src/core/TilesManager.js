import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  CesiumIonAuthPlugin,
  TilesFadePlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  ReorientationPlugin
} from '3d-tiles-renderer/plugins';
import { CONFIG } from '../config.js';

// Storage keys for key rotation state
const STORAGE_KEY_INDEX = 'flysf_api_key_index';
const STORAGE_FAILED_KEYS = 'flysf_failed_keys';
const STORAGE_LAST_SUCCESS = 'flysf_last_success';

/**
 * Get all available Google API keys
 * @returns {string[]} Array of API keys
 */
function getAllGoogleApiKeys() {
  const keys = [];

  // Check for multiple keys first (comma-separated)
  const multipleKeys = import.meta.env.VITE_GOOGLE_API_KEYS;
  if (multipleKeys && multipleKeys.length > 0) {
    const parsed = multipleKeys.split(',').map(k => k.trim()).filter(k => k && k !== 'your_api_key_here');
    keys.push(...parsed);
  }

  // Also add single key if exists and not already included
  const singleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (singleKey && singleKey !== 'your_api_key_here' && !keys.includes(singleKey)) {
    keys.push(singleKey);
  }

  return keys;
}

/**
 * Select a Google API key with smart rotation and failover
 * - First load: random key for distribution
 * - On failure: tries next key in rotation
 * - Tracks failed keys to avoid them
 * @returns {{key: string|null, index: number, total: number}}
 */
function selectGoogleApiKey() {
  const keys = getAllGoogleApiKeys();
  if (keys.length === 0) {
    return { key: null, index: -1, total: 0 };
  }

  // Get current state from sessionStorage
  let currentIndex = parseInt(sessionStorage.getItem(STORAGE_KEY_INDEX) || '-1', 10);
  const failedKeysStr = sessionStorage.getItem(STORAGE_FAILED_KEYS) || '[]';
  let failedKeys = [];
  try {
    failedKeys = JSON.parse(failedKeysStr);
  } catch (e) {
    failedKeys = [];
  }

  // Clear failed keys if they're old (more than 5 minutes)
  const lastSuccess = parseInt(sessionStorage.getItem(STORAGE_LAST_SUCCESS) || '0', 10);
  if (Date.now() - lastSuccess > 5 * 60 * 1000) {
    failedKeys = [];
    sessionStorage.setItem(STORAGE_FAILED_KEYS, '[]');
  }

  // First load: pick random key
  if (currentIndex === -1) {
    currentIndex = Math.floor(Math.random() * keys.length);
  }

  // Find a working key (skip failed ones)
  let attempts = 0;
  while (attempts < keys.length) {
    const keyIndex = (currentIndex + attempts) % keys.length;
    if (!failedKeys.includes(keyIndex)) {
      sessionStorage.setItem(STORAGE_KEY_INDEX, keyIndex.toString());
      console.log(`[Tiles] Using Google API key ${keyIndex + 1} of ${keys.length} (smart rotation)`);
      return { key: keys[keyIndex], index: keyIndex, total: keys.length };
    }
    attempts++;
  }

  // All keys failed - reset and try first one
  console.warn('[Tiles] All keys failed, resetting rotation');
  sessionStorage.setItem(STORAGE_FAILED_KEYS, '[]');
  sessionStorage.setItem(STORAGE_KEY_INDEX, '0');
  return { key: keys[0], index: 0, total: keys.length };
}

/**
 * Mark current key as failed and get next one
 * Called when rate limit or load error detected
 * @returns {boolean} true if there's another key to try, false if all exhausted
 */
export function rotateToNextKey() {
  const keys = getAllGoogleApiKeys();
  if (keys.length <= 1) return false;

  const currentIndex = parseInt(sessionStorage.getItem(STORAGE_KEY_INDEX) || '0', 10);

  // Mark current key as failed
  let failedKeys = [];
  try {
    failedKeys = JSON.parse(sessionStorage.getItem(STORAGE_FAILED_KEYS) || '[]');
  } catch (e) {
    failedKeys = [];
  }

  if (!failedKeys.includes(currentIndex)) {
    failedKeys.push(currentIndex);
    sessionStorage.setItem(STORAGE_FAILED_KEYS, JSON.stringify(failedKeys));
  }

  // Check if we have untried keys
  if (failedKeys.length >= keys.length) {
    console.error('[Tiles] All API keys exhausted');
    return false;
  }

  // Move to next key
  const nextIndex = (currentIndex + 1) % keys.length;
  sessionStorage.setItem(STORAGE_KEY_INDEX, nextIndex.toString());

  console.log(`[Tiles] Rotating to key ${nextIndex + 1} of ${keys.length}`);
  return true;
}

/**
 * Mark current key as working (call on successful tile load)
 */
export function markKeySuccess() {
  sessionStorage.setItem(STORAGE_LAST_SUCCESS, Date.now().toString());
  // Clear failed keys on success - they may have recovered
  const currentIndex = parseInt(sessionStorage.getItem(STORAGE_KEY_INDEX) || '0', 10);
  sessionStorage.setItem(STORAGE_FAILED_KEYS, JSON.stringify([]));
}

/**
 * Create and configure the TilesRenderer for Google 3D Tiles
 * Supports both direct Google API and Cesium Ion proxy
 * With API key rotation for rate limit distribution
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @returns {TilesRenderer}
 */
export function createTilesRenderer(camera, renderer) {
  const tilesRenderer = new TilesRenderer();

  // Check which auth method to use
  const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
  const { key: googleApiKey, index: keyIndex, total: totalKeys } = selectGoogleApiKey();

  if (cesiumToken && cesiumToken !== 'your_cesium_token_here') {
    // Use Cesium Ion (proxies Google 3D Tiles with separate rate limits)
    console.log('[Tiles] Using Cesium Ion for Google 3D Tiles');
    tilesRenderer.registerPlugin(
      new CesiumIonAuthPlugin({
        assetId: '2275207',  // Google Photorealistic 3D Tiles on Cesium Ion
        apiToken: cesiumToken,
        autoRefreshToken: true
      })
    );
  } else if (googleApiKey) {
    // Use Google API directly (with smart key rotation)
    console.log(`[Tiles] Using Google API key ${keyIndex + 1}/${totalKeys}`);
    tilesRenderer.registerPlugin(
      new GoogleCloudAuthPlugin({
        apiToken: googleApiKey,
        autoRefreshToken: true
      })
    );
  } else {
    console.error('[Tiles] No valid API key found! Set VITE_GOOGLE_API_KEYS, VITE_CESIUM_ION_TOKEN, or VITE_GOOGLE_MAPS_API_KEY');
  }

  // Performance plugins
  tilesRenderer.registerPlugin(new TileCompressionPlugin());   // GPU memory savings
  tilesRenderer.registerPlugin(new TilesFadePlugin());         // Smooth LOD transitions
  tilesRenderer.registerPlugin(new UpdateOnChangePlugin());    // CPU efficiency

  // Reorientation - orients globe so Porto (Ponte D. Luís I) is at origin with Y-up
  const latRad = CONFIG.startPosition.lat * Math.PI / 180;
  const lonRad = CONFIG.startPosition.lon * Math.PI / 180;
  tilesRenderer.registerPlugin(
    new ReorientationPlugin({
      lat: latRad,
      lon: lonRad,
      height: 0,
      recenter: true
    })
  );

  // ====== OPTIMIZED SETTINGS (Stage 16 + Stage 18) ======

  // Quality settings
  tilesRenderer.errorTarget = CONFIG.tiles.errorTarget;        // Managed by AdaptiveQuality
  tilesRenderer.errorThreshold = CONFIG.tiles.errorThreshold;  // Infinity = never hide tiles
  tilesRenderer.maxDepth = Infinity;                           // Load full depth

  // STAGE 18: Optimized load strategy for faster tile streaming
  // Tiles load independently without waiting for parents - much faster for flight
  if (CONFIG.tiles.optimizedLoadStrategy) {
    tilesRenderer.optimizedLoadStrategy = true;
    console.log('[Tiles] Optimized load strategy enabled');
  }

  // STAGE 18: Load sibling tiles to prevent gaps during camera movement
  if (CONFIG.tiles.loadSiblings) {
    tilesRenderer.loadSiblings = true;
    console.log('[Tiles] Sibling loading enabled');
  }

  // Loading performance
  tilesRenderer.downloadQueue.maxJobs = CONFIG.tiles.maxDownloadJobs;  // More parallel downloads
  tilesRenderer.parseQueue.maxJobs = CONFIG.tiles.maxParseJobs;

  // Memory management - bigger cache = fewer reloads
  tilesRenderer.lruCache.minBytesSize = CONFIG.tiles.cacheMinBytes;
  tilesRenderer.lruCache.maxBytesSize = CONFIG.tiles.cacheMaxBytes;

  // Keep tiles loaded for raycasting/collision
  tilesRenderer.displayActiveTiles = true;

  // Camera setup for tile streaming
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);

  // Show tiles immediately - let users see them load in real-time
  // This creates a better "wow" moment on the entry screen
  tilesRenderer.group.visible = true;

  // Track successful loads
  let hasLoadedTiles = false;

  tilesRenderer.addEventListener('load-tileset', () => {
    console.log('[Tiles] Root tileset loaded');
    hasLoadedTiles = true;
    markKeySuccess();
  });

  // Listen for tile load errors (potential rate limiting)
  tilesRenderer.addEventListener('load-error', (event) => {
    console.error('[Tiles] Load error:', event);

    // Check if it's a rate limit error (429) or auth error (403)
    const status = event?.error?.status || event?.target?.status;
    if (status === 429 || status === 403) {
      console.warn(`[Tiles] Rate limit or auth error (${status}), attempting key rotation`);
      if (rotateToNextKey()) {
        console.log('[Tiles] Reloading with new API key...');
        setTimeout(() => window.location.reload(), 500);
      }
    }
  });

  // Fallback: if no tiles load within 15 seconds, try rotating
  setTimeout(() => {
    if (!hasLoadedTiles && tilesRenderer.group.children.length === 0) {
      console.warn('[Tiles] No tiles loaded after 15s, attempting key rotation');
      if (rotateToNextKey()) {
        console.log('[Tiles] Reloading with new API key...');
        window.location.reload();
      }
    }
  }, 15000);

  return tilesRenderer;
}

/**
 * Get the ellipsoid for coordinate conversion
 * @param {TilesRenderer} tilesRenderer
 * @returns {Object} WGS84 ellipsoid
 */
export function getEllipsoid(tilesRenderer) {
  return tilesRenderer.ellipsoid;
}
