# SF Flight Simulator: Technical Brief for Claude Code

## Project Overview

Build a browser-based flight simulator that renders photorealistic San Francisco terrain using Google's 3D Tiles API and Three.js. Players fly over recognizable SF landmarks (Golden Gate Bridge, Alcatraz, downtown) with arcade-style physics.

**Success Criteria:**
- Player can fly smoothly over photorealistic SF terrain at 30+ fps
- Golden Gate Bridge fly-through is satisfying and recognizable
- Controls feel responsive and fun (arcade, not simulation)
- Works on modern desktop browsers (Chrome, Firefox, Safari)
- Someone outside the project says "holy shit that's cool"

---

## Technical Constraints

### Required Stack

| Component | Choice | Version | Reason |
|-----------|--------|---------|--------|
| Runtime | Browser (ES Modules) | Modern browsers | Zero install friction |
| 3D Engine | Three.js | r167+ | Required for 3DTilesRendererJS Matrix2 |
| 3D Tiles | 3DTilesRendererJS | 0.4+ | NASA's mature Three.js integration |
| Bundler | Vite | Latest | Fast HMR, simple config |
| Language | JavaScript | ES2022+ | TypeScript optional but not required |

### External Dependencies

| Dependency | npm Package | Purpose |
|------------|-------------|---------|
| Three.js | `three` | 3D rendering |
| 3D Tiles | `3d-tiles-renderer` | Google Photorealistic 3D Tiles |
| Virtual Joystick | `nipplejs` | Mobile touch controls |

### API Requirements

**Google Maps Platform:**
- Enable "Map Tiles API" (not just Maps JavaScript API)
- API key with Map Tiles API restriction
- Attribution display required (Google logo + data providers)

**Environment Variable:**
```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

### Browser Compatibility

| Browser | Minimum | Required Features |
|---------|---------|-------------------|
| Chrome | 90+ | WebGL2, ES Modules |
| Firefox | 90+ | WebGL2, ES Modules |
| Safari | 15+ | WebGL2, ES Modules |
| Mobile Chrome | 90+ | Touch, WebGL2 |
| Mobile Safari | 15+ | Touch, WebGL2 |

### Performance Targets

| Metric | Target | Acceptable | Measure |
|--------|--------|------------|---------|
| Frame rate (desktop) | 60 fps | 30 fps | Three.js stats |
| Frame rate (mobile) | 30 fps | 20 fps | Three.js stats |
| Initial load | < 10s | < 15s | First meaningful paint |
| Tile load (visible) | < 2s | < 5s | All nearby tiles loaded |
| Memory (desktop) | < 500MB | < 1GB | Chrome DevTools |
| Memory (mobile) | < 300MB | < 500MB | Performance monitor |

---

## Architecture Overview

### Component Structure

```
┌─────────────────────────────────────────────────────────┐
│                        App                               │
│  ┌─────────────────────────────────────────────────────┐│
│  │                    Scene                            ││
│  │  ┌───────────────┐  ┌───────────────────────────┐  ││
│  │  │ TilesManager  │  │      PlayerController     │  ││
│  │  │ - TilesRenderer│  │ - Aircraft (mesh + state) │  ││
│  │  │ - Plugins      │  │ - Physics                 │  ││
│  │  │ - Ellipsoid    │  │ - InputHandler            │  ││
│  │  └───────────────┘  │ - CameraController         │  ││
│  │                      └───────────────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │                      HUD                            ││
│  │  - Speed display                                    ││
│  │  - Altitude display                                 ││
│  │  - Control hints (fade after 10s)                   ││
│  │  - Attribution (required)                           ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (keyboard/touch)
        │
        ▼
   InputHandler
   - Normalizes keyboard/touch to control state
   - Outputs: { pitch, roll, yaw, throttle }
        │
        ▼
   PhysicsEngine
   - Applies forces based on control state
   - Outputs: updated position, rotation, velocity
        │
        ▼
   PlayerController
   - Updates aircraft mesh transform
   - Updates camera position (follow mode)
        │
        ▼
   TilesManager
   - Receives camera position
   - Loads/unloads tiles based on frustum
        │
        ▼
   Renderer
   - Renders scene with tiles + aircraft + HUD
```

### State Management

Keep state simple. No external state library needed.

```javascript
// Game state (single source of truth)
const gameState = {
  player: {
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    velocity: new THREE.Vector3(),
    throttle: 0.5
  },
  input: {
    pitch: 0,      // -1 to 1
    roll: 0,       // -1 to 1
    yaw: 0,        // -1 to 1
    throttle: 0    // -1 to 1 (delta)
  },
  camera: {
    mode: 'follow',  // 'follow' | 'cockpit' | 'free'
    offset: new THREE.Vector3(0, 5, -20)
  }
};
```

---

## Feature Specifications

### F1: 3D Tiles Rendering

**Requirement:** Load and render Google Photorealistic 3D Tiles for San Francisco area.

**Acceptance Criteria:**
- Given the app loads, tiles for SF should begin streaming
- Given camera position changes, nearby tiles should load/unload smoothly
- Given any view of SF, the Golden Gate Bridge should be recognizable
- Given the tiles are rendered, Google attribution must be visible

**Technical Notes:**
- Use `GoogleCloudAuthPlugin` with `autoRefreshToken: true`
- Register performance plugins: `TileCompressionPlugin`, `TilesFadePlugin`, `UpdateOnChangePlugin`
- Set `errorTarget: 8` for balance of quality and performance
- Set `errorThreshold: 40` for aggressive unloading during flight

**Starting Location:**
- Latitude: 37.8199° N (Golden Gate Bridge)
- Longitude: 122.4783° W
- Altitude: 500 meters
- Facing: Southeast toward downtown SF

### F2: Flight Physics

**Requirement:** Implement arcade-style flight physics that feel fun and responsive.

**Acceptance Criteria:**
- Given throttle input, the aircraft should accelerate/decelerate smoothly
- Given roll input, the aircraft should bank and turn in that direction
- Given pitch input, the aircraft should climb or dive
- Given no input, the aircraft should gradually level out (auto-stabilize)
- Given the aircraft approaches the ground, it should not instantly crash (forgiving collision)
- Given any input, controls should feel responsive (< 100ms perceived latency)

**Key Simplifications (not simulation):**
- No stall modeling (aircraft slows but doesn't drop)
- Linear lift coefficient (not realistic curves)
- Direct rotation controls (not control surfaces)
- Auto-level tendency when no input
- Forgiving ground collision (bounce, don't die)

**Tunable Constants:**
```javascript
{
  maxSpeed: 150,        // m/s (~290 knots)
  throttleAccel: 30,    // m/s² at full throttle
  drag: 0.02,           // velocity decay per frame
  gravity: 9.81,        // m/s²
  liftFactor: 0.015,    // lift per velocity unit
  turnRate: 1.5,        // rad/s at max bank
  pitchRate: 1.0,       // rad/s at max pitch input
  rollRate: 2.0,        // rad/s
  autoLevelRate: 0.5    // how fast aircraft levels when no input
}
```

### F3: Keyboard Controls

**Requirement:** Desktop keyboard controls for flight.

**Acceptance Criteria:**
- Given W or Up Arrow pressed, aircraft pitches down (dive)
- Given S or Down Arrow pressed, aircraft pitches up (climb)
- Given A or Left Arrow pressed, aircraft rolls left
- Given D or Right Arrow pressed, aircraft rolls right
- Given Shift pressed, throttle increases
- Given Ctrl pressed, throttle decreases
- Given Space pressed, aircraft auto-levels (panic button)
- Given multiple keys pressed, inputs should combine correctly

**Control Mapping:**
| Key | Action |
|-----|--------|
| W / ↑ | Pitch down (nose down, dive) |
| S / ↓ | Pitch up (nose up, climb) |
| A / ← | Roll left (bank left) |
| D / → | Roll right (bank right) |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Space | Auto-level |

### F4: Mobile Touch Controls

**Requirement:** Touch controls for mobile browsers using virtual joysticks.

**Acceptance Criteria:**
- Given touch on left side of screen, a virtual joystick appears for pitch/roll
- Given touch on right side of screen, a virtual joystick or slider appears for throttle
- Given joystick movement, aircraft responds as with keyboard
- Given touch release, joystick returns to center
- Given touch controls active, controls should be semi-transparent (60% opacity)

**Implementation Notes:**
- Use `nipplejs` library for virtual joysticks
- Left joystick: pitch (up/down) and roll (left/right)
- Right side: vertical slider or joystick for throttle
- Apply `touch-action: none` to game container
- Joystick size: 100-120px diameter

### F5: Camera System

**Requirement:** Camera that follows the aircraft smoothly.

**Acceptance Criteria:**
- Given aircraft moves, camera follows behind and above
- Given aircraft turns, camera rotates to follow orientation
- Given rapid maneuvers, camera should smooth out (damping)
- Given camera position, it should never clip into terrain

**Camera Parameters:**
```javascript
{
  followDistance: 20,    // meters behind aircraft
  followHeight: 5,       // meters above aircraft
  damping: 0.05,         // smoothing factor (0-1)
  lookAheadDistance: 10  // meters ahead of aircraft to look at
}
```

### F6: HUD (Heads-Up Display)

**Requirement:** Minimal on-screen display showing flight information.

**Acceptance Criteria:**
- Given aircraft is flying, speed should display in knots (top-left)
- Given aircraft is flying, altitude should display in meters (top-right)
- Given first 10 seconds, control hints should be visible (bottom)
- Given 10+ seconds, control hints should fade out
- Given any state, Google attribution must be visible (bottom-right)

**HUD Elements:**
- Speed: "XXX kts" (velocity magnitude converted to knots)
- Altitude: "XXXm" (height above ellipsoid)
- Controls hint: "WASD to fly | Space to level out"
- Attribution: Google logo + data providers (from tiles API)

**Style:**
- Font: System sans-serif, semi-bold
- Color: White with subtle shadow for contrast
- Size: 16-18px
- Minimal chrome, no borders

### F7: Performance Optimization

**Requirement:** Maintain playable frame rate during flight.

**Acceptance Criteria:**
- Given continuous flight, frame rate should stay above 30fps
- Given extended session (10+ minutes), memory should not grow unboundedly
- Given fast flight, tile loading should keep up (minimal pop-in)

**Required Optimizations:**
- Use `TileCompressionPlugin` (30%+ GPU memory savings)
- Use `UpdateOnChangePlugin` (skip updates when static)
- Use `TilesFadePlugin` (smooth LOD transitions)
- Configure LRU cache: 50MB min, 200MB max
- Dispose unused resources (textures, geometries)

---

## File Structure

```
sf-flight-sim/
├── index.html                 # Entry point
├── package.json               # Dependencies
├── vite.config.js             # Vite configuration
├── .env                       # API keys (gitignored)
├── .env.example               # Template for API keys
│
├── src/
│   ├── main.js                # App initialization
│   ├── config.js              # Constants and configuration
│   │
│   ├── core/
│   │   ├── Scene.js           # Three.js scene setup
│   │   ├── TilesManager.js    # 3D Tiles integration
│   │   └── GameLoop.js        # RAF loop, delta time
│   │
│   ├── player/
│   │   ├── Aircraft.js        # Aircraft mesh and state
│   │   ├── Physics.js         # Flight physics engine
│   │   └── CameraController.js # Follow camera
│   │
│   ├── input/
│   │   ├── InputHandler.js    # Unified input state
│   │   ├── KeyboardInput.js   # Keyboard handling
│   │   └── TouchInput.js      # Touch/joystick handling
│   │
│   ├── ui/
│   │   ├── HUD.js             # Speed, altitude display
│   │   └── Attribution.js     # Google attribution
│   │
│   └── utils/
│       ├── coordinates.js     # Lat/lon to Cartesian
│       └── math.js            # Clamp, lerp, etc.
│
├── assets/
│   └── models/
│       └── aircraft.glb       # Simple aircraft model (optional)
│
└── public/
    └── favicon.ico
```

---

## Implementation Phases

### Phase 1: Foundation

**Goal:** Tiles render, camera moves, app works.

**Tasks:**
1. Set up Vite project with Three.js
2. Integrate 3DTilesRendererJS with Google 3D Tiles
3. Position camera over SF (Golden Gate)
4. Implement basic orbit controls (temporary, for testing)
5. Add Google attribution display

**Verification:**
- Open app, see Golden Gate Bridge rendered
- Can orbit around to view from different angles
- Attribution visible in corner

**Deliverable:** Static viewer of SF that proves tiles work.

### Phase 2: Flight Controls

**Goal:** Player can fly with keyboard.

**Tasks:**
1. Create Aircraft class (position, rotation, velocity state)
2. Implement Physics engine with arcade flight model
3. Implement KeyboardInput handler
4. Create InputHandler to normalize inputs
5. Replace orbit controls with follow camera
6. Add basic HUD (speed, altitude)

**Verification:**
- WASD controls aircraft movement
- Aircraft banks and turns naturally
- Camera follows behind aircraft
- HUD shows speed and altitude

**Deliverable:** Flyable single-player experience (keyboard only).

### Phase 3: Mobile & Polish

**Goal:** Works on mobile, feels polished.

**Tasks:**
1. Implement TouchInput with nipplejs joysticks
2. Add control hints (fade after 10s)
3. Add auto-level (Space key)
4. Tune physics for fun factor
5. Add performance plugins
6. Test and optimize for mobile

**Verification:**
- Works on mobile browser with touch controls
- Controls feel responsive and fun
- Frame rate acceptable on mid-range devices
- 10-minute session runs without memory issues

**Deliverable:** Polished, deployable MVP.

---

## Integration Details

### 3DTilesRendererJS Initialization

```javascript
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GoogleCloudAuthPlugin,
  TilesFadePlugin,
  TileCompressionPlugin,
  UpdateOnChangePlugin
} from '3d-tiles-renderer/plugins';

function initTiles(scene, camera, renderer) {
  const tilesRenderer = new TilesRenderer();

  // Authentication
  tilesRenderer.registerPlugin(
    new GoogleCloudAuthPlugin({
      apiToken: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      autoRefreshToken: true
    })
  );

  // Performance plugins
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

  // Camera setup
  tilesRenderer.setCamera(camera);
  tilesRenderer.setResolutionFromRenderer(camera, renderer);

  scene.add(tilesRenderer.group);

  return tilesRenderer;
}
```

### Coordinate Conversion

Google 3D Tiles use WGS84 ellipsoid coordinates. Convert lat/lon to Cartesian:

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

### Game Loop Pattern

```javascript
let lastTime = 0;

function gameLoop(currentTime) {
  requestAnimationFrame(gameLoop);

  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
  lastTime = currentTime;

  // Update order matters
  inputHandler.update();
  physics.update(aircraft, inputHandler.getState(), deltaTime);
  cameraController.update(aircraft, deltaTime);

  // Update matrices before tiles update
  camera.updateMatrixWorld();
  tilesRenderer.update();

  renderer.render(scene, camera);
}

requestAnimationFrame(gameLoop);
```

---

## Known Gotchas

### Three.js Version

3DTilesRendererJS requires Three.js r167+ for Matrix2 import. Using older versions causes import errors.

### Camera Matrix Order

Always update camera matrix BEFORE tiles update:

```javascript
// CORRECT
camera.updateMatrixWorld();
tilesRenderer.update();

// WRONG - causes incorrect tile loading
tilesRenderer.update();
camera.updateMatrixWorld();
```

### Touch Action CSS

Required for touch controls to work without browser gestures interfering:

```css
#game-container {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
```

### API Key Security

Never commit API keys. Use environment variables:

```javascript
// vite.config.js exposes VITE_ prefixed env vars
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
```

### Memory Leaks

Dispose resources when done:

```javascript
// On cleanup
tilesRenderer.dispose();
```

If creating custom materials, clean them up on tile disposal:

```javascript
tilesRenderer.addEventListener('dispose-model', ({ scene }) => {
  scene.traverse(c => {
    if (c.material) c.material.dispose();
    if (c.geometry) c.geometry.dispose();
  });
});
```

---

## Testing Checklist

### Before Each Phase Completion

- [ ] Works in Chrome (desktop)
- [ ] Works in Firefox (desktop)
- [ ] Works in Safari (desktop)
- [ ] Frame rate > 30fps on M1 Mac
- [ ] No console errors
- [ ] No memory leaks (10-minute session)

### Before Final MVP

- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Touch controls functional
- [ ] Attribution visible
- [ ] Performance plugins enabled
- [ ] API key restricted in Google Cloud Console
- [ ] Deployed to public URL

---

## Out of Scope (Explicitly)

Do NOT implement these in MVP:

- ❌ Multiplayer / networking
- ❌ Multiple aircraft types
- ❌ Combat / weapons
- ❌ Missions / objectives
- ❌ Leaderboards
- ❌ User accounts / persistence
- ❌ Sound effects (unless trivially easy)
- ❌ Weather / fog effects
- ❌ Full Bay Area (stay in focused corridor)
- ❌ VR support

---

## Definition of Done

The MVP is complete when:

- [ ] App loads Google 3D Tiles of SF (Golden Gate to downtown corridor)
- [ ] Player can fly with keyboard (WASD + arrows)
- [ ] Player can fly with touch (virtual joysticks)
- [ ] Flight physics feel fun and responsive
- [ ] Camera follows aircraft smoothly
- [ ] HUD shows speed and altitude
- [ ] Golden Gate Bridge fly-through is satisfying
- [ ] Works on MacBook M1 at 30+ fps
- [ ] Works on iPhone 13+ at 20+ fps
- [ ] Deployed to public URL
- [ ] Google attribution displayed correctly
- [ ] No critical bugs or memory leaks
- [ ] Someone external says "holy shit that's cool"
