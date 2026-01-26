# SF Flight Simulator

Browser-based flight simulator over photorealistic San Francisco using Google 3D Tiles and Three.js.

## Quick Reference

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
```

## Tech Stack

- **Three.js** (r167+) - 3D rendering (MUST be r167+ for Matrix2 support)
- **3d-tiles-renderer** - NASA's library for Google Photorealistic 3D Tiles
- **Vite** - Build tool
- **nipplejs** - Mobile virtual joystick

## Project Structure

```
src/
├── main.js              # Entry point, wires everything together
├── config.js            # Constants, tuning values
├── core/
│   ├── Scene.js         # Three.js scene, renderer, camera
│   ├── TilesManager.js  # 3DTilesRendererJS integration
│   └── GameLoop.js      # requestAnimationFrame loop
├── player/
│   ├── Aircraft.js      # Aircraft state and mesh
│   ├── Physics.js       # Arcade flight physics
│   └── CameraController.js  # Follow camera
├── input/
│   ├── InputHandler.js  # Unified input normalization
│   ├── KeyboardInput.js # Keyboard events
│   └── TouchInput.js    # Mobile joystick (nipplejs)
└── ui/
    ├── HUD.js           # Speed, altitude display
    └── Attribution.js   # Google attribution (legally required)
```

## Critical Patterns

### 1. Camera Matrix Before Tiles (CRITICAL)
```javascript
// In render loop - ORDER MATTERS
camera.updateMatrixWorld();  // FIRST
tilesRenderer.update();       // SECOND
renderer.render(scene, camera);
```

### 2. 3DTilesRenderer Setup
```javascript
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TilesFadePlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins';

const tilesRenderer = new TilesRenderer();

// Authentication
tilesRenderer.registerPlugin(
  new GoogleCloudAuthPlugin({
    apiToken: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    autoRefreshToken: true
  })
);

// Performance plugins (all required)
tilesRenderer.registerPlugin(new TileCompressionPlugin());
tilesRenderer.registerPlugin(new TilesFadePlugin());
tilesRenderer.registerPlugin(new UpdateOnChangePlugin());

// Performance settings
tilesRenderer.errorTarget = 8;
tilesRenderer.errorThreshold = 40;
tilesRenderer.downloadQueue.maxJobs = 30;
tilesRenderer.parseQueue.maxJobs = 10;

// Memory management
tilesRenderer.lruCache.minBytesSize = 50 * 1e6;   // 50MB
tilesRenderer.lruCache.maxBytesSize = 200 * 1e6;  // 200MB
```

### 3. Coordinate Conversion
```javascript
function latLonAltToCartesian(lat, lon, altitude, ellipsoid) {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const position = new THREE.Vector3();
  ellipsoid.getCartographicToPosition(latRad, lonRad, altitude, position);
  return position;
}

// Starting position: Golden Gate Bridge
const startPosition = latLonAltToCartesian(37.8199, -122.4783, 500, tilesRenderer.ellipsoid);
```

### 4. Environment Variables
```javascript
// API key must be prefixed with VITE_ for Vite to expose it
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### 5. Touch Controls CSS (Required)
```css
#game-container {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
```

## Flight Physics (Arcade Model)

```javascript
const PHYSICS = {
  maxSpeed: 150,        // m/s (~290 knots)
  throttleAccel: 30,    // m/s² at full throttle
  drag: 0.02,           // velocity decay per frame
  gravity: 9.81,        // m/s²
  liftFactor: 0.015,    // lift per velocity unit
  turnRate: 1.5,        // rad/s at max bank
  pitchRate: 1.0,       // rad/s at max pitch input
  rollRate: 2.0,        // rad/s
  autoLevelRate: 0.5    // how fast aircraft levels when no input
};
```

**Simplified behaviors:**
- No stall modeling (slows but doesn't drop)
- Bank causes turn (yaw follows roll)
- Auto-level when no input
- Forgiving ground collision (bounce, don't crash)

## Control Mapping

| Key | Action |
|-----|--------|
| W / ↑ | Pitch down (dive) |
| S / ↓ | Pitch up (climb) |
| A / ← | Roll left |
| D / → | Roll right |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Space | Auto-level (panic button) |

## Starting Position

- **Location:** Golden Gate Bridge
- **Lat/Lon:** 37.8199° N, 122.4783° W
- **Altitude:** 500 meters
- **Facing:** Southeast toward downtown SF

## Camera Configuration

```javascript
const CAMERA = {
  fov: 75,
  near: 1,
  far: 1e12,              // MUST be very large for globe viewing
  followDistance: 20,     // meters behind aircraft
  followHeight: 5,        // meters above aircraft
  damping: 0.05,          // smoothing factor
  lookAheadDistance: 10   // meters ahead to look at
};
```

## What NOT to Build

Focus on single-player flight that makes people say "holy shit."

- ❌ Multiplayer / networking
- ❌ Multiple aircraft types
- ❌ Combat / weapons
- ❌ Missions / objectives
- ❌ User accounts / persistence
- ❌ Sound effects (unless trivial)
- ❌ Weather / fog effects
- ❌ VR support

## Implementation Stages

See `docs/stages/` for detailed implementation plans:

1. **Stage 1: Project Foundation** - Vite + Three.js + basic scene ✅
2. **Stage 2: 3D Tiles Integration** - Google Photorealistic 3D Tiles ✅
   - OrbitControls are temporary (for testing) - will be replaced with flight controls
3. **Stage 3: Flight Core** - Aircraft + physics engine ✅
   - Aircraft class with position/rotation/velocity state
   - Arcade physics engine with thrust, drag, lift, gravity
   - GameLoop with delta time (capped at 100ms)
   - Test input hardcoded (gentle right turn) - will be replaced by keyboard in Stage 4
   - Physics constants in `src/config.js` - tune as needed
4. **Stage 4: Controls & Camera** - Keyboard input + follow camera
5. **Stage 5: HUD & Polish** - Touch controls + HUD + mobile optimization
6. **Stage 6: Deployment** - Production build + hosting

## Success Criteria

- [ ] Player can fly smoothly over SF at 30+ fps
- [ ] Golden Gate Bridge fly-through is satisfying
- [ ] Controls feel responsive and fun
- [ ] Works on desktop (Chrome, Firefox, Safari)
- [ ] Works on mobile (iOS Safari, Android Chrome)
- [ ] Google attribution displayed correctly
- [ ] Someone external says "holy shit that's cool"

## Detailed Documentation

For comprehensive specs, see:
- `docs/TECHNICAL-BRIEF.md` - Full technical specification
- `docs/stages/` - Stage-by-stage implementation guides
