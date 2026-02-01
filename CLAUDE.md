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
| W | Pitch down (dive) |
| S | Pitch up (climb) |
| A | Roll left |
| D | Roll right |
| ↑ / Shift | Throttle up (accelerate) |
| ↓ / Ctrl | Throttle down (decelerate) |
| Space / F | Fire |

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

## What NOT to Build (for now)

Focus on multiplayer combat flight that makes people say "holy shit."

- ❌ Multiple aircraft types
- ❌ Health/death system (just scoring)
- ❌ Missions / objectives
- ❌ User accounts / persistence
- ❌ Weather / fog effects
- ❌ VR support
- ❌ Chat system (future)

## Implementation Stages

See `docs/stages/` for detailed implementation plans:

### Single-Player (Complete)
1. **Stage 1: Project Foundation** - Vite + Three.js + basic scene ✅
2. **Stage 2: 3D Tiles Integration** - Google Photorealistic 3D Tiles ✅
3. **Stage 3: Flight Core** - Aircraft + physics engine ✅
4. **Stage 4: Controls & Camera** - Keyboard input + follow camera ✅
5. **Stage 5: HUD & Polish** - Touch controls + HUD + mobile ✅
6. **Stage 6: Deployment** - Production build + Vercel ✅

### Multiplayer (Complete)
7. **Stage 7: Multiplayer Server** - WebSocket server on Fly.io ✅
8. **Stage 8: Multiplayer Client** - NetworkManager ✅
9. **Stage 9: Remote Players** - PlayerSync ✅
10. **Stage 10: Multiplayer Polish** - Interpolation + notifications ✅

### Combat (Current)
11. **Stage 11: Aircraft Scale** - 2x larger aircraft + hitbox infrastructure
    - Scale aircraft meshes by 2x
    - Add bounding sphere hitboxes
    - Hitbox meshes for raycasting
12. **Stage 12: Shooting Mechanics** - Client-side shooting + effects
    - Fire with Spacebar/F key (5 shots/sec)
    - Raycasting hit detection
    - Tracer lines, muzzle flash, hit markers
13. **Stage 13: Combat Server** - Score tracking + validation
    - Handle shoot/hit messages
    - Rate limit hits (10/sec max)
    - Broadcast scores to all clients
14. **Stage 14: Leaderboard** - Score display + rankings
    - Top 5 leaderboard in HUD
    - Own score prominently displayed
    - "+1" popup on hits
15. **Stage 15: Combat Polish** - Tuning + sound
    - Config-driven combat parameters
    - Synthesized sound effects
    - Crosshair + visual polish

## Multiplayer Architecture

```
Browser Clients          WebSocket Server (Fly.io)
┌─────────────┐          ┌─────────────────┐
│  Client A   │◄────────►│  Node.js + ws   │
│  - Physics  │ Position │  - Broadcast    │
│  - Renders  │ Updates  │    at 10Hz      │
│    others   │ (10Hz)   │  - Player       │
└─────────────┘          │    timeout      │
┌─────────────┐          │  - Rate limit   │
│  Client B   │◄────────►│                 │
└─────────────┘          └─────────────────┘
```

**Key patterns:**
- Client-authoritative (each client runs own physics)
- Simple broadcast model (like fly.pieter.com)
- 10Hz update rate (100ms intervals)
- JSON messages (binary optimization later)

## Network Message Types

```javascript
// Client → Server: Movement
{ type: 'join', id: 'uuid', name: 'Pilot-1234' }
{ type: 'position', id: 'uuid', position: {x,y,z}, rotation: {x,y,z}, velocity: {x,y,z} }

// Client → Server: Combat
{ type: 'shoot', position: {x,y,z}, direction: {x,y,z} }
{ type: 'hit', targetId: 'player-uuid' }

// Server → Client: Movement
{ type: 'players', players: {...}, scores: {...}, count: 5 }
{ type: 'player_joined', id: 'uuid', name: 'Pilot-1234' }
{ type: 'player_left', id: 'uuid' }

// Server → Client: Combat
{ type: 'player_shoot', shooterId: 'uuid', position: {...}, direction: {...} }
{ type: 'hit_confirmed', shooterId: 'uuid', targetId: 'uuid', shooterScore: 5 }
```

## Combat Architecture

```
Client (Shooter)              Server                    Client (Target)
────────────────              ──────                    ───────────────
1. Fire (raycast)
2. Hit detected → ─── hit ──► 3. Validate hit
                              4. Update score
                              5. Broadcast ─── hit_confirmed ──► 6. Flash red
                    ◄───────────────────────────────────────────
                              6. Show "+1"
```

**Key patterns:**
- Client-side hit detection (raycasting)
- Server validates and tracks scores
- Hitscan (instant), not projectile
- 5 shots/second fire rate
- Bounding sphere hitboxes (30m radius)

## New Files for Multiplayer & Combat

```
server/                    # Separate Node.js project
├── package.json
├── index.js
├── GameServer.js          # Handles movement + combat
└── fly.toml              # Fly.io deployment config

src/network/               # Client networking
├── NetworkManager.js     # WebSocket connection
├── PlayerSync.js         # Remote player management
├── RemoteAircraft.js     # Remote player aircraft + hitbox
└── Interpolation.js      # Position buffering

src/combat/                # Combat system
├── CombatManager.js      # Shooting, hit detection, scores
├── BulletEffects.js      # Tracers, muzzle flash, hit markers
├── Leaderboard.js        # Top 5 display
└── SoundManager.js       # Synthesized sound effects
```

## Environment Variables

```bash
# Client (.env)
VITE_GOOGLE_MAPS_API_KEY=your_key
VITE_WS_URL=wss://flysf-server.fly.dev

# Server
PORT=8080
```

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
