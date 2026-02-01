# Aircraft Models

This directory contains GLTF/GLB aircraft models for the flight simulator.

## Required Models

Download these models and place them in this directory:

### 1. F-16 Fighting Falcon (`f16.glb`)
- Source: [Sketchfab - Free Fighter Jet Collection](https://sketchfab.com/3d-models/free-fighter-jet-collection-low-poly-cb5966c988d9403895be89b364c2252f)
- License: CC Attribution

### 2. F-22 Raptor (`f22.glb`)
- Source: [Sketchfab - Free Fighter Jet Collection](https://sketchfab.com/3d-models/free-fighter-jet-collection-low-poly-cb5966c988d9403895be89b364c2252f)
- License: CC Attribution

### 3. F-18 Hornet (`f18.glb`)
- Source: [Sketchfab - Free Fighter Jet Collection](https://sketchfab.com/3d-models/free-fighter-jet-collection-low-poly-cb5966c988d9403895be89b364c2252f)
- License: CC Attribution

### 4. Cessna 172 (`cessna.glb`)
- Source: [Poly Pizza - Cessna](https://poly.pizza/search/cessna)
- License: CC0 / Public Domain

## Model Preparation

After downloading, prepare models in Blender:

1. **Orientation**: Ensure aircraft faces -Z direction (nose pointing into screen)
2. **Scale**: Normalize to ~20 unit wingspan
3. **Materials**: Name accent materials with "accent", "detail", "highlight", "trim", or "stripe" so they receive the player's chosen color
4. **Export**: Export as GLB (binary GLTF)

## Optimization (Optional)

Use gltf-transform to compress models:

```bash
npx @gltf-transform/cli optimize input.glb output.glb --compress draco
```

Target file sizes:
- Fighter jets: ~50KB each
- Cessna: ~40KB

## Fallback

If models fail to load, the game automatically falls back to primitive box geometry aircraft.
