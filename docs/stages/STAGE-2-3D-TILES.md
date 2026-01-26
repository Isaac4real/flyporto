# Stage 2: 3D Tiles Integration

## Goal

Integrate Google Photorealistic 3D Tiles and render San Francisco in the browser. This is the first "wow" moment.

**Estimated time:** 20-30 minutes

---

## Prerequisites

- Stage 1 completed and verified
- Google Maps API key with Map Tiles API enabled
- API key added to `.env` file

---

## Context from Stage 1

You have a working Vite + Three.js project with a rotating cube. In this stage, you will:
1. Remove the test cube
2. Add 3DTilesRendererJS
3. Render SF tiles
4. Add basic orbit controls for testing
5. Add Google attribution

---

## Tasks

### Task 2.1: Create Configuration File

Create `src/config.js` with:
- Starting position constants (Golden Gate Bridge)
- Camera settings
- Tile renderer settings

```javascript
export const CONFIG = {
  startPosition: {
    lat: 37.8199,
    lon: -122.4783,
    altitude: 500
  },
  camera: {
    fov: 60,
    near: 1,
    far: 1e12  // Very large for globe viewing
  },
  tiles: {
    errorTarget: 8,
    errorThreshold: 40,
    maxDownloadJobs: 30,
    maxParseJobs: 10,
    cacheMinBytes: 50 * 1e6,
    cacheMaxBytes: 200 * 1e6
  }
};
```

### Task 2.2: Create Coordinate Utilities

Create `src/utils/coordinates.js` with:
- Function to convert lat/lon/altitude to Cartesian coordinates
- Function to convert degrees to radians

```javascript
export function latLonAltToCartesian(lat, lon, altitude, ellipsoid) {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const position = new THREE.Vector3();
  ellipsoid.getCartographicToPosition(latRad, lonRad, altitude, position);
  return position;
}
```

### Task 2.3: Create Scene Module

Create `src/core/Scene.js` with:
- Function to create and configure Three.js scene
- Function to create and configure renderer
- Function to create camera with globe-appropriate settings
- Proper lighting setup (ambient + directional)

The camera far plane must be very large (1e12) for globe viewing.

### Task 2.4: Create Tiles Manager

Create `src/core/TilesManager.js` with:
- Function to initialize TilesRenderer
- GoogleCloudAuthPlugin with autoRefreshToken
- TileCompressionPlugin for GPU memory
- TilesFadePlugin for smooth LOD
- UpdateOnChangePlugin for CPU efficiency
- Proper error target and cache settings
- Method to get ellipsoid (needed for coordinate conversion)

**Critical:** The API key comes from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

### Task 2.5: Create Attribution Component

Create `src/ui/Attribution.js` with:
- Function to create attribution DOM element
- Position: fixed, bottom-right corner
- Style: Small text, semi-transparent background
- Content: "Imagery ©2026 Google" (placeholder - real attribution comes from tiles)

Google requires attribution display. This is a legal requirement.

### Task 2.6: Update main.js

Refactor `src/main.js` to:
- Remove the test cube
- Import and use Scene module
- Import and use TilesManager
- Import and use Attribution
- Position camera at starting location (Golden Gate)
- Add OrbitControls from Three.js (temporary, for testing)
- Set orbit controls target to Earth center or a point on the surface
- Create animation loop that updates tiles

**Critical order in animation loop:**
```javascript
camera.updateMatrixWorld();  // FIRST
tilesRenderer.update();       // SECOND
renderer.render(scene, camera);
```

### Task 2.7: Add .env File

Create `.env` with actual API key:
```
VITE_GOOGLE_MAPS_API_KEY=your_actual_key_here
```

---

## Acceptance Criteria

After this stage, verify:

- [ ] App loads without errors
- [ ] Golden Gate Bridge is visible and recognizable
- [ ] Can orbit around the scene with mouse
- [ ] Tiles load and unload as camera moves
- [ ] Attribution is visible in bottom-right corner
- [ ] No console errors (some 404s for missing tiles are normal)
- [ ] Zooming in shows more detail
- [ ] Zooming out shows more area

---

## Verification Steps

1. Run `npm run dev`
2. Open browser - should see SF terrain loading
3. Wait for tiles to load (may take a few seconds)
4. Identify Golden Gate Bridge
5. Use mouse to orbit around
6. Zoom in - should see more detail
7. Zoom out - should see wider area
8. Check bottom-right for attribution
9. Check console for errors

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/config.js` | Create | Configuration constants |
| `src/utils/coordinates.js` | Create | Coordinate conversion |
| `src/core/Scene.js` | Create | Three.js scene setup |
| `src/core/TilesManager.js` | Create | 3D Tiles integration |
| `src/ui/Attribution.js` | Create | Google attribution |
| `src/main.js` | Modify | Wire everything together |
| `.env` | Create | API key (gitignored) |

---

## Critical Code Patterns

### TilesRenderer Initialization

```javascript
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TilesFadePlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins';

const tilesRenderer = new TilesRenderer();

tilesRenderer.registerPlugin(
  new GoogleCloudAuthPlugin({
    apiToken: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    autoRefreshToken: true
  })
);

tilesRenderer.registerPlugin(new TileCompressionPlugin());
tilesRenderer.registerPlugin(new TilesFadePlugin());
tilesRenderer.registerPlugin(new UpdateOnChangePlugin());
```

### Camera Setup for Globe

```javascript
const camera = new THREE.PerspectiveCamera(
  60,                                    // FOV
  window.innerWidth / window.innerHeight, // Aspect
  1,                                     // Near (1 meter)
  1e12                                   // Far (very large for globe)
);

// Position at starting location
camera.position.copy(startPosition);
camera.lookAt(0, 0, 0);  // Look at Earth center initially
```

### OrbitControls Setup (Temporary)

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 100;   // Don't get too close
controls.maxDistance = 1e8;   // Don't get too far

// In animation loop:
controls.update();
```

---

## What NOT to Do in This Stage

- ❌ Do not implement flight physics yet (Stage 3)
- ❌ Do not implement keyboard controls yet (Stage 4)
- ❌ Do not implement the HUD yet (Stage 5)
- ❌ Do not remove OrbitControls yet (needed for testing)
- ❌ Do not add the aircraft model yet (Stage 3)

---

## Common Issues

### Tiles not loading (blank globe)

1. Check API key is correct in `.env`
2. Check Map Tiles API is enabled in Google Cloud Console
3. Check console for 403 errors (API key issue)
4. Check console for 429 errors (rate limiting)

### Camera in wrong position

1. Verify coordinate conversion is using radians
2. Verify ellipsoid is available from TilesManager
3. Check camera is looking at a sensible direction

### Performance issues

1. Ensure TileCompressionPlugin is registered
2. Check errorTarget is set (should be 6-10)
3. Check cache settings are applied

### Attribution not showing

1. Check DOM element is created and appended
2. Check CSS positioning
3. Verify z-index is high enough

---

## Handoff to Stage 3

After completing this stage:

1. Commit the code:
   ```bash
   git add .
   git commit -m "Stage 2: 3D Tiles - SF terrain rendering with Google Photorealistic tiles"
   ```

2. Update CLAUDE.md:
   - Note Stage 2 is complete
   - Document any API key setup notes
   - Note that OrbitControls are temporary

3. **Take screenshot for build-in-public:**
   - Screenshot of Golden Gate Bridge from above
   - This is your first shareable moment!

---

## Suggested Build-in-Public Content

**Tweet after Stage 2:**

```
Day 1: Got Google's photorealistic 3D tiles loading in Three.js.

This is the Golden Gate Bridge rendered in my browser. Not a game asset—actual Google Maps data.

Building a flight sim with Claude Code + Opus 4.5. Let's see how far we can push it. 🌉

[Attach screenshot of Golden Gate Bridge view]
```

---

## Performance Baseline

After this stage, you should see:
- 30-60 fps with orbit controls
- Tiles loading within 2-5 seconds of camera movement
- Memory usage 200-400MB

If significantly worse, check:
- Are all performance plugins registered?
- Is errorTarget too low (higher = less quality but better performance)?
- Is the cache too small?
