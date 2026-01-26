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

  // Performance settings from config
  tilesRenderer.errorTarget = CONFIG.tiles.errorTarget;
  tilesRenderer.errorThreshold = CONFIG.tiles.errorThreshold;
  tilesRenderer.downloadQueue.maxJobs = CONFIG.tiles.maxDownloadJobs;
  tilesRenderer.parseQueue.maxJobs = CONFIG.tiles.maxParseJobs;

  // Memory management
  tilesRenderer.lruCache.minBytesSize = CONFIG.tiles.cacheMinBytes;
  tilesRenderer.lruCache.maxBytesSize = CONFIG.tiles.cacheMaxBytes;

  // Camera setup for tile streaming
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);

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
