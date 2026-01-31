# Stage 15: Combat Polish & Balance

## Goal

Tune combat feel, add optional sound effects, and ensure smooth performance with multiple players shooting.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Stage 14 complete (leaderboard working)
- Combat system fully functional

---

## Tasks

### Task 15.1: Tune Combat Parameters

Create combat config in `src/config.js`:

```javascript
export const CONFIG = {
  // ... existing config ...

  // Combat settings
  combat: {
    fireRate: 5,            // shots per second
    fireCooldown: 200,      // ms between shots (1000 / fireRate)
    bulletRange: 800,       // meters
    hitboxRadius: 25,       // meters (adjust for feel)
    tracerDuration: 150,    // ms
    tracerLength: 400,      // meters
    hitMarkerDuration: 300  // ms
  }
};
```

Update `CombatManager.js` to use config:

```javascript
import { CONFIG } from '../config.js';

constructor(...) {
  // ...
  this.fireCooldown = CONFIG.combat.fireCooldown;
  this.raycaster.far = CONFIG.combat.bulletRange;
}
```

Update `BulletEffects.js`:

```javascript
import { CONFIG } from '../config.js';

createTracer(origin, direction) {
  const end = origin.clone().add(
    direction.clone().multiplyScalar(CONFIG.combat.tracerLength)
  );
  // ...
  const duration = CONFIG.combat.tracerDuration;
  // ...
}
```

Update `RemoteAircraft.js`:

```javascript
import { CONFIG } from '../config.js';

getHitboxRadius() {
  return CONFIG.combat.hitboxRadius;
}
```

### Task 15.2: Add Sound Effects (Optional but Impactful)

Create `src/combat/SoundManager.js`:

```javascript
/**
 * SoundManager - handles combat sound effects
 * Uses Web Audio API for low-latency playback
 */
export class SoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.3;

    // Initialize on first user interaction (required by browsers)
    this.initialized = false;
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
      console.log('[Sound] Audio initialized');
    } catch (e) {
      console.warn('[Sound] Web Audio not available:', e.message);
      this.enabled = false;
    }
  }

  /**
   * Play gunfire sound (synthesized)
   */
  playGunfire() {
    if (!this.enabled || !this.audioContext) return;

    // Create oscillator for "pew" sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * Play hit confirmation sound (synthesized)
   */
  playHit() {
    if (!this.enabled || !this.audioContext) return;

    // Create oscillator for "ping" sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);

    gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.15);
  }

  /**
   * Play "got hit" sound (synthesized)
   */
  playGotHit() {
    if (!this.enabled || !this.audioContext) return;

    // Low thump sound
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);

    gain.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
```

Integrate with `CombatManager.js`:

```javascript
import { SoundManager } from './SoundManager.js';

constructor(...) {
  // ...
  this.soundManager = new SoundManager();
}

fire() {
  // Initialize audio on first fire (user gesture)
  this.soundManager.init();

  // ... existing fire code ...

  // Play gunfire sound
  this.soundManager.playGunfire();

  // ...
}

onHitConfirmed(msg) {
  // ...
  if (msg.shooterId === myId) {
    // We hit someone!
    this.soundManager.playHit();
    // ...
  }

  if (msg.targetId === myId) {
    // We got hit!
    this.soundManager.playGotHit();
    // ...
  }
}
```

### Task 15.3: Improve Hit Marker Visibility

Update `BulletEffects.js` to make hit markers more visible:

```javascript
createHitMarker(position) {
  // Create a more visible hit marker (cross pattern)
  const group = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({
    color: 0xff3333,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
  });

  // Horizontal bar
  const hBar = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2),
    material
  );
  group.add(hBar);

  // Vertical bar
  const vBar = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 10),
    material.clone()
  );
  group.add(vBar);

  group.position.copy(position);

  // Billboard effect (face camera) handled by looking at origin initially
  this.scene.add(group);

  // ... animate and cleanup ...
}
```

### Task 15.4: Add Crosshair

Add simple crosshair to center of screen in `HUD.js`:

```javascript
// In constructor
this.createCrosshair();

createCrosshair() {
  this.crosshair = document.createElement('div');
  this.crosshair.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    pointer-events: none;
    z-index: 100;
  `;

  // Simple dot crosshair
  this.crosshair.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="2" fill="white" stroke="black" stroke-width="0.5"/>
      <line x1="10" y1="0" x2="10" y2="6" stroke="white" stroke-width="1"/>
      <line x1="10" y1="14" x2="10" y2="20" stroke="white" stroke-width="1"/>
      <line x1="0" y1="10" x2="6" y2="10" stroke="white" stroke-width="1"/>
      <line x1="14" y1="10" x2="20" y2="10" stroke="white" stroke-width="1"/>
    </svg>
  `;

  this.container.appendChild(this.crosshair);
}
```

### Task 15.5: Performance Optimization

Ensure effects are cleaned up properly:

```javascript
// In BulletEffects.js

// Add maximum concurrent tracers
createTracer(origin, direction) {
  // Limit active tracers
  const tracerCount = this.activeEffects.filter(e => e.type === 'tracer').length;
  if (tracerCount > 10) {
    return null;  // Skip if too many
  }

  // ... rest of method ...
  effect.type = 'tracer';  // Tag the effect
  this.addEffect(effect);
}
```

### Task 15.6: Add Sound Toggle to HUD

```javascript
// In HUD.js constructor
this.createSoundToggle();

createSoundToggle() {
  this.soundToggle = document.createElement('div');
  this.soundToggle.style.cssText = `
    position: absolute;
    bottom: 10px;
    left: 10px;
    color: white;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    cursor: pointer;
    padding: 5px 10px;
    background: rgba(0,0,0,0.5);
    border-radius: 4px;
  `;
  this.soundToggle.textContent = '🔊 Sound: ON';
  this.soundToggle.onclick = () => this.onSoundToggle?.();
  this.container.appendChild(this.soundToggle);
}

updateSoundToggle(enabled) {
  this.soundToggle.textContent = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
}
```

Wire up in main.js:

```javascript
hud.onSoundToggle = () => {
  const enabled = combatManager.soundManager.toggle();
  hud.updateSoundToggle(enabled);
};
```

### Task 15.7: Balance Testing Checklist

Create a testing checklist to tune values:

1. **Fire rate**: 5/sec should feel responsive but not spammy
2. **Hitbox size**: 25m should make hitting possible but require aim
3. **Bullet range**: 800m allows engagement at medium distance
4. **Tracer visibility**: Should be visible but not distracting
5. **Sound levels**: Gunfire should be subtle, hits satisfying

Adjust `CONFIG.combat` values based on playtesting.

---

## Acceptance Criteria

- [ ] All combat parameters in config.js
- [ ] Easy to adjust fire rate, hitbox size, etc.
- [ ] Crosshair visible at screen center
- [ ] Sound effects play (gunfire, hit, got hit)
- [ ] Sound can be toggled off
- [ ] Hit markers clearly visible
- [ ] No performance issues with 10+ players shooting
- [ ] Effects clean up properly (no memory leaks)
- [ ] Combat feels satisfying

---

## Tuning Guidelines

### If hitting is too hard:
- Increase `hitboxRadius` (try 30-40m)
- Decrease tracer speed / make more visible

### If hitting is too easy:
- Decrease `hitboxRadius` (try 15-20m)
- Decrease `bulletRange`

### If fire rate feels wrong:
- For more action: decrease `fireCooldown` to 100ms (10/sec)
- For more tactical: increase `fireCooldown` to 500ms (2/sec)

---

## Code Patterns

### Synthesized Sound with Web Audio

```javascript
const osc = audioContext.createOscillator();
const gain = audioContext.createGain();
osc.connect(gain);
gain.connect(audioContext.destination);
osc.frequency.setValueAtTime(600, audioContext.currentTime);
osc.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
gain.gain.setValueAtTime(0.5, audioContext.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
osc.start();
osc.stop(audioContext.currentTime + 0.1);
```

### Config-driven parameters

```javascript
import { CONFIG } from '../config.js';
this.fireCooldown = CONFIG.combat.fireCooldown;
```

---

## What NOT to Do

- ❌ Don't add complex weapon systems (keep it simple)
- ❌ Don't add health/death (just scoring for now)
- ❌ Don't over-design sound (synthesized is fine)
- ❌ Don't forget to test on mobile

---

## Final Testing Checklist

Before deploying:

- [ ] Open 3 browser windows
- [ ] All players see each other
- [ ] All players can shoot
- [ ] Hits register correctly
- [ ] Scores update for all players
- [ ] Leaderboard shows correct rankings
- [ ] Sound effects work (if enabled)
- [ ] Performance stays above 30fps
- [ ] 10-minute session runs without issues
- [ ] No console errors

---

## Deployment

After Stage 15:

1. Deploy updated server to Fly.io:
```bash
cd server
fly deploy
```

2. Deploy updated client to Vercel:
```bash
cd ..
vercel --prod
```

3. Test on production with real users

---

## Summary

Combat system is complete! Players can:
- Shoot at each other with visual tracers
- See hit markers when shots land
- Hear sound effects for combat
- Track scores in real-time
- Compete on the leaderboard

Total implementation time for Stages 11-15: ~3-4 hours
