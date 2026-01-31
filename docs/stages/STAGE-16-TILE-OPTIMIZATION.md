# Stage 16: Tile Rendering Optimization

## Goal

Fix tile rendering issues (slow loading, holes, low-quality tiles persisting) by applying research-backed optimizations to 3DTilesRendererJS configuration.

**Estimated time:** 1-2 hours

---

## Prerequisites

- Stages 1-15 complete
- Current tile rendering shows issues with quality/loading

---

## Background

Research identified several configuration improvements based on 3DTilesRendererJS best practices and GitHub issue discussions. This stage applies those optimizations.

**Key changes:**
1. Lower `errorTarget` for faster high-quality loading
2. Larger cache sizes to reduce tile eviction
3. More parallel download jobs
4. `displayActiveTiles` to keep tiles loaded
5. Root tile loading handler for smoother startup

---

## Tasks

### Task 16.1: Update Tile Configuration

Update `src/config.js`:

```javascript
// 3D Tiles renderer settings - OPTIMIZED
tiles: {
  errorTarget: 2,              // Was 6 - lower = faster high quality (pixels of allowed error)
  errorThreshold: Infinity,    // Prevents tiles disappearing during camera movement
  maxDownloadJobs: 50,         // Was 30 - more parallel downloads
  maxParseJobs: 10,            // Keep - GPU parsing is the bottleneck
  cacheMinBytes: 250 * 1e6,    // Was 100MB - bigger minimum cache
  cacheMaxBytes: 500 * 1e6     // Was 400MB - allow more tiles in memory
}
```

### Task 16.2: Add Advanced Tile Settings

Update `src/core/TilesManager.js`:

```javascript
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

  // ====== OPTIMIZED SETTINGS ======

  // Quality settings
  tilesRenderer.errorTarget = CONFIG.tiles.errorTarget;        // Lower = higher quality faster
  tilesRenderer.errorThreshold = CONFIG.tiles.errorThreshold;  // Infinity = never hide tiles
  tilesRenderer.maxDepth = Infinity;                           // NEW: Load full depth

  // Loading performance
  tilesRenderer.downloadQueue.maxJobs = CONFIG.tiles.maxDownloadJobs;  // More parallel downloads
  tilesRenderer.parseQueue.maxJobs = CONFIG.tiles.maxParseJobs;

  // Memory management - bigger cache = fewer reloads
  tilesRenderer.lruCache.minBytesSize = CONFIG.tiles.cacheMinBytes;
  tilesRenderer.lruCache.maxBytesSize = CONFIG.tiles.cacheMaxBytes;

  // NEW: Keep tiles loaded for raycasting/collision
  tilesRenderer.displayActiveTiles = true;

  // Camera setup for tile streaming
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);

  // NEW: Hide tiles until root is loaded (prevents showing holes)
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
```

### Task 16.3: Add Tile Loading Indicator to HUD

Update `src/ui/HUD.js` to show loading state:

```javascript
// In constructor, add loading indicator
this.loadingIndicator = document.createElement('div');
this.loadingIndicator.style.cssText = `
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-family: system-ui, sans-serif;
  font-size: 16px;
  background: rgba(0,0,0,0.7);
  padding: 10px 20px;
  border-radius: 8px;
  pointer-events: none;
  display: none;
  z-index: 1000;
`;
this.loadingIndicator.textContent = 'Loading terrain...';
container.appendChild(this.loadingIndicator);

// Add method to update loading state
updateTileLoading(tilesRenderer) {
  if (!tilesRenderer) return;

  const downloading = tilesRenderer.downloadQueue.itemsInList || 0;
  const parsing = tilesRenderer.parseQueue.itemsInList || 0;

  // Show indicator if many tiles loading
  if (downloading > 20 || parsing > 5) {
    this.loadingIndicator.textContent = `Loading terrain... (${downloading} tiles)`;
    this.loadingIndicator.style.display = 'block';
  } else {
    this.loadingIndicator.style.display = 'none';
  }
}

// Add debug mode tile stats
showTileStats(tilesRenderer) {
  if (!this.tileStats) {
    this.tileStats = document.createElement('div');
    this.tileStats.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 10px;
      color: #aaa;
      font-family: monospace;
      font-size: 12px;
      background: rgba(0,0,0,0.5);
      padding: 5px;
      border-radius: 4px;
    `;
    this.container.appendChild(this.tileStats);
  }

  const cache = tilesRenderer.lruCache;
  const cacheMB = (cache.cachedBytes / 1e6).toFixed(1);
  const maxMB = (cache.maxBytesSize / 1e6).toFixed(0);
  const downloading = tilesRenderer.downloadQueue.itemsInList || 0;
  const parsing = tilesRenderer.parseQueue.itemsInList || 0;

  this.tileStats.innerHTML = `
    Cache: ${cacheMB}/${maxMB} MB<br>
    Queue: ${downloading}↓ ${parsing}⚙
  `;
}
```

### Task 16.4: Wire Up Tile Loading in Main

Update `src/main.js`:

```javascript
// Near the end of the update function, add tile loading updates:

// 10. Update tile loading indicator
hud.updateTileLoading(tilesRenderer);

// Debug mode: show tile stats
if (CONFIG.debug.showTileStats) {
  hud.showTileStats(tilesRenderer);
}
```

Add to `src/config.js`:

```javascript
debug: {
  showHitboxes: false,
  showTileStats: false  // NEW: Set to true to see tile loading stats
}
```

### Task 16.5: Add Fallback Ground Improvement

Update the fallback ground plane in `src/main.js` to follow the aircraft:

```javascript
// Replace static ground plane with dynamic one
const groundGeometry = new THREE.PlaneGeometry(20000, 20000);
const groundMaterial = new THREE.MeshBasicMaterial({
  color: 0x1a4d2e,  // Forest green (more natural than ocean)
  side: THREE.DoubleSide
});
const fallbackGround = new THREE.Mesh(groundGeometry, groundMaterial);
fallbackGround.rotation.x = -Math.PI / 2;
fallbackGround.position.y = -10;  // Slightly below sea level
scene.add(fallbackGround);

// In update function, move fallback ground to follow aircraft:
fallbackGround.position.x = aircraft.position.x;
fallbackGround.position.z = aircraft.position.z;
```

### Task 16.6: Tune and Test

Test with different `errorTarget` values:

| errorTarget | Effect |
|-------------|--------|
| 1 | Maximum quality, most API usage |
| 2 | High quality, good balance (RECOMMENDED) |
| 4 | Medium quality, faster initial load |
| 6 | Lower quality, minimal API usage |

Monitor:
- Time for tiles to reach high quality
- Presence of holes/gaps
- Frame rate stability
- Cache hit rate (enable debug.showTileStats)

---

## Testing Checklist

### Basic Rendering
- [ ] Tiles load on startup without holes
- [ ] High-quality tiles appear within 3 seconds of approach
- [ ] No visible gaps between tiles
- [ ] Smooth LOD transitions (no popping)

### Flight Testing
- [ ] Circle Golden Gate Bridge - tiles stay loaded
- [ ] Fly toward downtown SF - tiles load ahead
- [ ] Dive toward ground - cannot fly through
- [ ] Sustained flight (5+ minutes) - no degradation

### Performance
- [ ] 30+ fps during normal flight
- [ ] Cache usage stays under 500MB
- [ ] Download queue drains quickly when stationary
- [ ] No memory leaks during long sessions

### Edge Cases
- [ ] Fast movement (~200 m/s) - tiles keep up
- [ ] Quick direction changes - no holes appear
- [ ] Low altitude flight - detail loads fast enough
- [ ] Flying away from SF - graceful quality reduction

---

## Acceptance Criteria

- [ ] `errorTarget` reduced to 2 (or tuned value)
- [ ] Cache sizes increased (250MB min, 500MB max)
- [ ] Download jobs increased to 50
- [ ] `displayActiveTiles = true` enabled
- [ ] `maxDepth = Infinity` enabled
- [ ] Root tile loading handler prevents holes
- [ ] Loading indicator shows during heavy tile loading
- [ ] Fallback ground follows aircraft
- [ ] Debug tile stats available (optional)
- [ ] Sustained 30+ fps flight over SF

---

## Troubleshooting

### Tiles still loading slowly

Try adjusting these values:
```javascript
tilesRenderer.downloadQueue.maxJobs = 80;  // Even more parallel
tilesRenderer.errorTarget = 1;              // Maximum quality priority
```

### Still seeing holes

Check if `displayActiveTiles` is set:
```javascript
console.log('displayActiveTiles:', tilesRenderer.displayActiveTiles);
```

Add manual delay before showing tiles:
```javascript
setTimeout(() => {
  tilesRenderer.group.visible = true;
}, 2000);  // Wait 2 seconds
```

### Memory usage too high

Reduce cache sizes:
```javascript
tiles: {
  cacheMinBytes: 150 * 1e6,
  cacheMaxBytes: 350 * 1e6
}
```

### Frame rate drops

Increase `errorTarget` to reduce tile detail:
```javascript
tilesRenderer.errorTarget = 4;  // Less detail = better performance
```

---

## What NOT to Do

- ❌ Don't set `errorTarget` below 1 (diminishing returns, high API cost)
- ❌ Don't disable TilesFadePlugin (causes jarring pop-in)
- ❌ Don't set cache too large (>1GB may cause browser issues)
- ❌ Don't forget to test on mobile (different performance profile)

---

## Handoff to Stage 17 (Optional)

If tile optimization works well:
- Proceed to combat system stages (11-15)
- Or add predictive loading for further improvement

If tile optimization is insufficient:
- Consider hybrid procedural approach
- See TILE-RENDERING-RESEARCH.md for alternatives
