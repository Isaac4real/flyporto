import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TilesFadePlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin,
  ReorientationPlugin
} from '3d-tiles-renderer/plugins';
import { CONFIG } from '../config.js';

/**
 * Create and configure the TilesRenderer for Google 3D Tiles
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @returns {TilesRenderer}
 */
export function createTilesRenderer(camera, renderer) {
  const tilesRenderer = new TilesRenderer();

  // Authentication - API key must be VITE_ prefixed for Vite to expose it
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.error('Missing or invalid VITE_GOOGLE_MAPS_API_KEY in .env file');
  }

  tilesRenderer.registerPlugin(
    new GoogleCloudAuthPlugin({
      apiToken: apiKey,
      autoRefreshToken: true
    })
  );

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

  // ====== OPTIMIZED SETTINGS (Stage 16) ======

  // Quality settings
  tilesRenderer.errorTarget = CONFIG.tiles.errorTarget;        // Lower = higher quality faster
  tilesRenderer.errorThreshold = CONFIG.tiles.errorThreshold;  // Infinity = never hide tiles
  tilesRenderer.maxDepth = Infinity;                           // Load full depth

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

  // Hide tiles until root is loaded (prevents showing holes)
  tilesRenderer.group.visible = false;
  tilesRenderer.addEventListener('load-tile-set', () => {
    console.log('[Tiles] Root tileset loaded, showing tiles');
    tilesRenderer.group.visible = true;
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
