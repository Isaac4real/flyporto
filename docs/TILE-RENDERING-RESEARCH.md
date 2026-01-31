# Tile Rendering Research: Deep Analysis & Recommendations

## Executive Summary

After extensive research into 3DTilesRendererJS, Google 3D Tiles, alternatives, and the fly.pieter.com approach, this document presents findings and recommendations for fixing the tile rendering issues (slow loading, holes, low-quality tiles persisting).

**Key Finding**: fly.pieter.com uses **NO Google 3D Tiles** - it's 100% procedural primitives. This fundamentally changes our options.

---

## Current Issues Observed

1. **Tiles staying low quality too long** - Higher LOD tiles not loading fast enough
2. **Missing tiles / holes in terrain** - Gaps between tile boundaries
3. **Flying through ground under Earth** - Tiles not loaded before physics needs them
4. **Areas staying low-res forever** - Tiles getting stuck in low LOD state

---

## Research Findings

### 1. Current Implementation Analysis

**What's Already Correct:**
- ✅ `logarithmicDepthBuffer: true` in Scene.js (CRITICAL for globe-scale)
- ✅ `errorThreshold: Infinity` prevents tiles from disappearing during movement
- ✅ Correct update order: `camera.updateMatrixWorld()` → `tilesRenderer.update()` → `render()`
- ✅ Using essential plugins: GoogleCloudAuthPlugin, TileCompressionPlugin, TilesFadePlugin, UpdateOnChangePlugin, ReorientationPlugin
- ✅ Large far plane (`1e12`) for globe viewing

**What Needs Improvement:**
| Setting | Current | Recommended | Impact |
|---------|---------|-------------|--------|
| `errorTarget` | 6 | **2** | Lower = higher quality faster (pixels of allowed error) |
| `maxDownloadJobs` | 30 | **50** | More parallel downloads |
| `cacheMinBytes` | 100MB | **250MB** | Keep more tiles in memory |
| `cacheMaxBytes` | 400MB | **500MB** | Allow more tile caching |

**Missing Features:**
- ❌ `displayActiveTiles = true` - Keeps tiles loaded for raycasting/collision
- ❌ `tilesRenderer.group.visible = true` after root loaded - Prevents showing partial data
- ❌ Tile loading state monitoring/visualization
- ❌ Predictive tile loading based on flight path

### 2. 3DTilesRendererJS Best Practices (from GitHub issues/discussions)

**Critical Settings for Flight Games:**

```javascript
// Quality settings
tilesRenderer.errorTarget = 2;              // Very low error = high quality
tilesRenderer.errorThreshold = Infinity;    // Never unload based on error
tilesRenderer.maxDepth = Infinity;          // Load full depth

// Loading performance
tilesRenderer.downloadQueue.maxJobs = 50;   // More parallel downloads
tilesRenderer.parseQueue.maxJobs = 10;      // GPU parsing is limited

// Memory management - CRITICAL for sustained play
tilesRenderer.lruCache.minBytesSize = 250 * 1e6;  // 250MB min
tilesRenderer.lruCache.maxBytesSize = 500 * 1e6;  // 500MB max

// Keep tiles loaded for raycasting
tilesRenderer.displayActiveTiles = true;

// Preload tiles in movement direction
tilesRenderer.optimizeRaycast = false;  // Disable if causing issues
```

**Common Pitfalls Identified:**
1. **Camera matrix not updated before tiles** - We have this correct
2. **Too high errorTarget** - 6 allows visible popping; 2 is much smoother
3. **Cache too small** - Tiles get evicted and reloaded constantly
4. **Not waiting for root tile** - Shows holes before initial load

### 3. fly.pieter.com Architecture Analysis

**Shocking Discovery**: fly.pieter.com uses **ZERO external map data**.

**Technical Details:**
- ~9,350 procedural meshes (boxes, cones, simple shapes)
- ~63,000 total triangles (very light)
- Single HTML file with embedded JavaScript
- Buildings are simple extruded rectangles
- Mountains are noise-generated cones
- Water is a flat blue plane

**Implications:**
- No API costs
- No loading delays - everything is instant
- No holes or missing tiles
- Perfect performance (60fps guaranteed)
- BUT: No photorealism - very stylized look

### 4. Google 3D Tiles API Considerations

**Terms of Service Restrictions:**
- ❌ CANNOT download/cache tiles beyond HTTP cache headers
- ❌ CANNOT use tiles offline
- ❌ CANNOT pre-fetch tiles outside viewport
- ❌ CANNOT redistribute or store tile data

**Practical Limits:**
- API costs: $5-7 per 1000 root tile loads (rough estimate based on usage patterns)
- Network latency is unavoidable
- Tile quality depends on Google's coverage (SF is excellent)

### 5. Alternative Approaches Evaluated

| Approach | Photorealism | Performance | Cost | Complexity | Recommendation |
|----------|-------------|-------------|------|------------|----------------|
| **Optimize Google 3D Tiles** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $$$ | Low | **Try First** |
| **CesiumJS** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $$$ | High | Not recommended |
| **Procedural (fly.pieter style)** | ⭐ | ⭐⭐⭐⭐⭐ | Free | Medium | Backup option |
| **Hybrid (procedural + tiles)** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$ | High | If optimization fails |
| **OSM + Terrain** | ⭐⭐ | ⭐⭐⭐⭐ | Free | High | Not for SF realism |
| **Pre-baked 3D Model** | ⭐⭐⭐ | ⭐⭐⭐⭐ | One-time | Very High | Not practical |

---

## Recommended Approach: Phased Optimization

### Phase 1: Configuration Optimization (1-2 hours)

Apply research-backed configuration changes:

**src/config.js changes:**
```javascript
tiles: {
  errorTarget: 2,              // Was 6 - lower = faster high quality
  errorThreshold: Infinity,    // Keep
  maxDownloadJobs: 50,         // Was 30 - more parallel downloads
  maxParseJobs: 10,            // Keep
  cacheMinBytes: 250 * 1e6,    // Was 100MB - bigger cache
  cacheMaxBytes: 500 * 1e6     // Was 400MB - more headroom
}
```

**src/core/TilesManager.js additions:**
```javascript
// After setting up tilesRenderer:
tilesRenderer.displayActiveTiles = true;  // Keep tiles for raycasting
tilesRenderer.maxDepth = Infinity;        // Don't limit depth

// Optional: Wait for root tile before showing
tilesRenderer.group.visible = false;
tilesRenderer.addEventListener('load-tile-set', () => {
  tilesRenderer.group.visible = true;
});
```

### Phase 2: Loading State Visualization (30 minutes)

Add visual feedback for tile loading state:

```javascript
// In HUD.js - show loading progress
updateTileLoading(tilesRenderer) {
  const downloading = tilesRenderer.downloadQueue.itemsInList;
  const parsing = tilesRenderer.parseQueue.itemsInList;
  const cached = tilesRenderer.lruCache.cachedBytes / 1e6;

  if (downloading > 0 || parsing > 0) {
    this.loadingIndicator.textContent = `Loading: ${downloading}↓ ${parsing}⚙`;
    this.loadingIndicator.style.display = 'block';
  } else {
    this.loadingIndicator.style.display = 'none';
  }
}
```

### Phase 3: Predictive Loading (Optional - 2-3 hours)

Pre-request tiles in the direction of flight:

```javascript
// Create "look-ahead" camera for tile requests
const lookAheadCamera = camera.clone();
const flightDirection = aircraft.getVelocity().normalize();
lookAheadCamera.position.addScaledVector(flightDirection, 500); // 500m ahead
lookAheadCamera.updateMatrixWorld();

// Temporarily set look-ahead camera for tile requests
tilesRenderer.setCamera(lookAheadCamera);
tilesRenderer.update();
tilesRenderer.setCamera(camera); // Restore
```

### Phase 4: Fallback Ground Plane (30 minutes)

Improve the existing fallback plane to prevent "flying through earth":

```javascript
// Dynamic fallback plane that follows player
const fallbackPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(10000, 10000),
  new THREE.MeshBasicMaterial({
    color: 0x2d5a3d,  // Forest green
    side: THREE.DoubleSide
  })
);
fallbackPlane.rotation.x = -Math.PI / 2;

// In update loop: move fallback plane to be under aircraft
fallbackPlane.position.x = aircraft.position.x;
fallbackPlane.position.z = aircraft.position.z;
fallbackPlane.position.y = 0;
```

---

## Alternative: Procedural Approach (If Optimization Fails)

If Google 3D Tiles continues to be problematic after optimization, consider a hybrid or full procedural approach:

### Minimal Procedural SF

Create procedural landmarks for SF:
- Golden Gate Bridge (simple geometry)
- SF skyline silhouettes
- Bay water plane
- Hills using perlin noise

**Pros:**
- Zero API costs
- Instant loading
- Perfect performance
- No holes ever

**Cons:**
- Loses photorealism
- Significant development time (2-3 days)
- Different visual style than originally intended

### Hybrid Approach

Use procedural base + Google tiles as overlay:
- Procedural ground/water always visible
- Google tiles load on top when available
- Graceful degradation when tiles fail

---

## Implementation Stages

### Stage 16: Tile Optimization (New)

**Goal:** Apply research-backed optimizations to fix tile rendering issues.

**Tasks:**
1. Update config.js with optimized tile settings
2. Add displayActiveTiles and maxDepth settings
3. Add root tile load handler to hide group until ready
4. Add tile loading indicator to HUD
5. Test and tune errorTarget value (2-4 range)

**Estimated time:** 1-2 hours

### Stage 17: Tile Loading Indicator (Optional)

**Goal:** Show users when tiles are loading.

**Tasks:**
1. Add loading queue monitoring
2. Display download/parse counts in HUD
3. Show cache memory usage (debug mode)

**Estimated time:** 30 minutes

### Stage 18: Predictive Tile Loading (Optional)

**Goal:** Pre-load tiles in flight direction.

**Tasks:**
1. Create look-ahead camera system
2. Request tiles for predicted position
3. Tune look-ahead distance

**Estimated time:** 2-3 hours

---

## Cost Analysis

### Current Google 3D Tiles Usage

Based on typical flight simulator usage:
- ~10-20 root tile loads per minute of flight
- Each root tile triggers child tile loads
- Estimated cost: $5-15 per 1000 "session minutes" (very rough)

### Optimization Impact

- Better caching = fewer redundant requests
- Higher errorTarget = slower quality but fewer requests
- Lower errorTarget = more requests but better quality

**Recommendation:** Start with lower errorTarget (2) for quality, monitor API costs.

---

## Success Metrics

After implementing Phase 1 optimization:

- [ ] Tiles reach high quality within 2-3 seconds of approaching
- [ ] No visible holes when flying at reasonable speeds
- [ ] Cannot fly through ground/buildings
- [ ] Stable 30+ fps during normal flight
- [ ] Cache hit rate > 70% during circling flight patterns

---

## Conclusion

**Recommended Action:** Implement Phase 1 configuration optimization first. This is the lowest-risk, highest-impact change. If issues persist after optimization, evaluate the hybrid procedural approach.

The discovery that fly.pieter.com is entirely procedural is significant - it proves that photorealism is not required for a viral flight game. However, the SF photorealism is a key differentiator for this project, so optimization should be prioritized before considering alternatives.

---

## References

- [3DTilesRendererJS GitHub Issues](https://github.com/NASA-AMMOS/3DTilesRendererJS/issues)
- [Google 3D Tiles Documentation](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [CesiumJS Globe Best Practices](https://cesium.com/learn/cesiumjs/ref-doc/)
- fly.pieter.com source analysis (view-source inspection)
