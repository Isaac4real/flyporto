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

/**
 * Create and configure the TilesRenderer for Google 3D Tiles
 * Supports both direct Google API and Cesium Ion proxy
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @returns {TilesRenderer}
 */
export function createTilesRenderer(camera, renderer) {
  const tilesRenderer = new TilesRenderer();

  // Check which auth method to use
  const cesiumToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
  } else if (googleApiKey && googleApiKey !== 'your_api_key_here') {
    // Use Google API directly
    console.log('[Tiles] Using Google Maps API directly');
    tilesRenderer.registerPlugin(
      new GoogleCloudAuthPlugin({
        apiToken: googleApiKey,
        autoRefreshToken: true
      })
    );
  } else {
    console.error('[Tiles] No valid API key found! Set VITE_CESIUM_ION_TOKEN or VITE_GOOGLE_MAPS_API_KEY');
  }

  // Performance plugins
  tilesRenderer.registerPlugin(new TileCompressionPlugin());   // GPU memory savings
  tilesRenderer.registerPlugin(new TilesFadePlugin());         // Smooth LOD transitions
  tilesRenderer.registerPlugin(new UpdateOnChangePlugin());    // CPU efficiency

  // Reorientation - orients globe so Golden Gate Bridge is at origin with Y-up
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
  tilesRenderer.addEventListener('load-tileset', () => {
    console.log('[Tiles] Root tileset loaded');
  });

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
