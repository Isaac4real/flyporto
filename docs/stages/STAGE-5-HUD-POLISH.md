# Stage 5: HUD & Polish

## Goal

Add the HUD (speed, altitude), touch controls for mobile, control hints, and tune performance. After this stage, you'll have a polished experience ready for deployment.

**Estimated time:** 20-25 minutes

---

## Prerequisites

- Stage 4 completed and verified
- Keyboard flight controls working
- Follow camera working

---

## Context from Stage 4

You have a playable desktop flight experience. In this stage, you will:
1. Create the HUD (speed, altitude display)
2. Add control hints (fade after 10s)
3. Implement touch controls with nipplejs
4. Tune physics for maximum fun
5. Ensure performance is acceptable

---

## Tasks

### Task 5.1: Create HUD Component

Create `src/ui/HUD.js` with:

**Elements to display:**
- Speed (top-left): "XXX kts"
- Altitude (top-right): "XXXm"

**Implementation:**
```javascript
class HUD {
  constructor(container) {
    this.element = document.createElement('div');
    this.element.id = 'hud';
    this.element.innerHTML = `
      <div id="hud-speed">0 kts</div>
      <div id="hud-altitude">0m</div>
    `;
    container.appendChild(this.element);

    this.speedEl = document.getElementById('hud-speed');
    this.altitudeEl = document.getElementById('hud-altitude');
  }

  update(speed, altitude) {
    // Speed: m/s to knots (1 m/s = 1.944 knots)
    const knots = Math.round(speed * 1.944);
    this.speedEl.textContent = `${knots} kts`;

    // Altitude: meters
    const alt = Math.round(altitude);
    this.altitudeEl.textContent = `${alt}m`;
  }
}
```

**CSS (add to index.html or separate CSS file):**
```css
#hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 20px;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 600;
  font-size: 18px;
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

#hud-speed {
  position: absolute;
  top: 20px;
  left: 20px;
}

#hud-altitude {
  position: absolute;
  top: 20px;
  right: 20px;
}
```

### Task 5.2: Add Control Hints

Add to `src/ui/HUD.js`:

**Control hints element:**
```html
<div id="hud-hints">WASD to fly | Space to level out</div>
```

**CSS:**
```css
#hud-hints {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 1;
  transition: opacity 1s ease-out;
}

#hud-hints.hidden {
  opacity: 0;
}
```

**Fade logic:**
```javascript
constructor() {
  // ... existing code

  this.hintsEl = document.getElementById('hud-hints');

  // Fade out after 10 seconds
  setTimeout(() => {
    this.hintsEl.classList.add('hidden');
  }, 10000);
}
```

### Task 5.3: Install and Configure nipplejs

Install nipplejs:
```bash
npm install nipplejs
```

Create `src/input/TouchInput.js`:

```javascript
import nipplejs from 'nipplejs';

class TouchInput {
  constructor(container) {
    this.pitch = 0;
    this.roll = 0;
    this.throttle = 0.5;
    this.enabled = false;

    // Only enable on touch devices
    if (!this.isTouchDevice()) {
      return;
    }

    this.enabled = true;
    this.setupJoysticks(container);
  }

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  setupJoysticks(container) {
    // Create touch zones
    this.createTouchZones(container);

    // Left joystick for pitch/roll
    this.leftJoystick = nipplejs.create({
      zone: document.getElementById('touch-left'),
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 120,
      threshold: 0.1,
      fadeTime: 100,
      restJoystick: true
    });

    this.leftJoystick.on('move', (evt, data) => {
      this.roll = data.vector.x;
      this.pitch = -data.vector.y;
    });

    this.leftJoystick.on('end', () => {
      this.roll = 0;
      this.pitch = 0;
    });

    // Right side for throttle (simple up/down zones)
    this.setupThrottleZones();
  }

  createTouchZones(container) {
    const leftZone = document.createElement('div');
    leftZone.id = 'touch-left';
    leftZone.style.cssText = `
      position: fixed;
      left: 0;
      bottom: 0;
      width: 40%;
      height: 40%;
      touch-action: none;
    `;
    container.appendChild(leftZone);

    const rightZone = document.createElement('div');
    rightZone.id = 'touch-right';
    rightZone.style.cssText = `
      position: fixed;
      right: 0;
      bottom: 0;
      width: 40%;
      height: 40%;
      touch-action: none;
      display: flex;
      flex-direction: column;
    `;
    rightZone.innerHTML = `
      <div id="throttle-up" style="flex: 1; display: flex; align-items: center; justify-content: center;">
        <span style="color: rgba(255,255,255,0.3); font-size: 24px;">▲</span>
      </div>
      <div id="throttle-down" style="flex: 1; display: flex; align-items: center; justify-content: center;">
        <span style="color: rgba(255,255,255,0.3); font-size: 24px;">▼</span>
      </div>
    `;
    container.appendChild(rightZone);
  }

  setupThrottleZones() {
    const throttleUp = document.getElementById('throttle-up');
    const throttleDown = document.getElementById('throttle-down');

    throttleUp.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.throttleInput = 1;
    });
    throttleUp.addEventListener('touchend', () => {
      this.throttleInput = 0;
    });

    throttleDown.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.throttleInput = -1;
    });
    throttleDown.addEventListener('touchend', () => {
      this.throttleInput = 0;
    });

    this.throttleInput = 0;
  }

  update(deltaTime) {
    if (!this.enabled) return;

    // Update throttle based on input
    if (this.throttleInput > 0) {
      this.throttle = Math.min(1, this.throttle + deltaTime);
    } else if (this.throttleInput < 0) {
      this.throttle = Math.max(0, this.throttle - deltaTime);
    }
  }

  getState() {
    return {
      pitch: this.pitch,
      roll: this.roll,
      throttle: this.throttle
    };
  }

  destroy() {
    if (this.leftJoystick) {
      this.leftJoystick.destroy();
    }
  }
}

export default TouchInput;
```

### Task 5.4: Integrate Touch Input

Update `src/input/InputHandler.js`:

```javascript
class InputHandler {
  constructor(keyboardInput, touchInput) {
    this.keyboard = keyboardInput;
    this.touch = touchInput;
    this.throttle = 0.5;
  }

  update(deltaTime) {
    // Keyboard throttle
    if (this.keyboard.isActionActive('throttleUp')) {
      this.throttle = Math.min(1, this.throttle + deltaTime);
    }
    if (this.keyboard.isActionActive('throttleDown')) {
      this.throttle = Math.max(0, this.throttle - deltaTime);
    }

    // Touch throttle (if enabled)
    if (this.touch && this.touch.enabled) {
      this.touch.update(deltaTime);
      // Touch overrides keyboard throttle when active
      this.throttle = this.touch.throttle;
    }
  }

  getState() {
    // Keyboard input
    let pitch = 0;
    let roll = 0;

    if (this.keyboard.isActionActive('pitchDown')) pitch = 1;
    if (this.keyboard.isActionActive('pitchUp')) pitch = -1;
    if (this.keyboard.isActionActive('rollLeft')) roll = -1;
    if (this.keyboard.isActionActive('rollRight')) roll = 1;

    // Combine with touch if active
    if (this.touch && this.touch.enabled) {
      const touchState = this.touch.getState();
      pitch = touchState.pitch || pitch;
      roll = touchState.roll || roll;
    }

    const autoLevel = this.keyboard.isActionActive('autoLevel');

    return {
      pitch,
      roll,
      yaw: 0,
      throttle: this.throttle,
      autoLevel
    };
  }
}
```

### Task 5.5: Update Main.js

Update `src/main.js` to:

1. Create TouchInput instance
2. Pass TouchInput to InputHandler
3. Create HUD instance
4. Update HUD each frame with speed/altitude
5. Show mobile-specific hints if touch enabled

```javascript
// In initialization
const touchInput = new TouchInput(container);
const inputHandler = new InputHandler(keyboardInput, touchInput);
const hud = new HUD(container);

// In update loop
const speed = aircraft.getSpeed();
const altitude = aircraft.getAltitude(tilesManager.getEllipsoid());
hud.update(speed, altitude);
```

### Task 5.6: Performance Verification

Ensure all performance plugins are active:

1. Verify TileCompressionPlugin is registered
2. Verify TilesFadePlugin is registered
3. Verify UpdateOnChangePlugin is registered
4. Check cache settings are applied

Add FPS counter for debugging (optional):

```javascript
import Stats from 'three/addons/libs/stats.module.js';

const stats = new Stats();
document.body.appendChild(stats.dom);

// In update loop
stats.update();
```

### Task 5.7: Physics Tuning

Review and tune physics constants for fun:

- Does it feel fast enough?
- Is turning responsive?
- Is auto-level helpful?
- Is the ground collision forgiving?

Make adjustments to config.js as needed.

---

## Acceptance Criteria

After this stage, verify:

**HUD:**
- [ ] Speed displays in top-left (in knots)
- [ ] Altitude displays in top-right (in meters)
- [ ] Values update as you fly
- [ ] Control hints visible initially
- [ ] Control hints fade after 10 seconds

**Touch Controls:**
- [ ] On touch device: left joystick appears
- [ ] On touch device: throttle zones work
- [ ] Joystick controls pitch and roll
- [ ] Throttle zones increase/decrease throttle
- [ ] Touch controls don't appear on desktop

**Performance:**
- [ ] 30+ fps on desktop
- [ ] 20+ fps on mobile
- [ ] No memory growth over 5 minutes
- [ ] Tiles load smoothly during flight

**Polish:**
- [ ] Controls feel fun
- [ ] Camera follows smoothly
- [ ] No jarring visual glitches

---

## Verification Steps

1. **Desktop verification:**
   - Run `npm run dev`
   - Confirm HUD shows speed and altitude
   - Fly around, confirm values change
   - Wait 10 seconds, confirm hints fade

2. **Mobile verification:**
   - Open dev server on mobile (use network IP or tunnel)
   - Confirm joystick appears in bottom-left
   - Confirm throttle zones appear in bottom-right
   - Test joystick controls pitch/roll
   - Test throttle zones

3. **Performance verification:**
   - Check fps counter (if added)
   - Fly for 5 minutes
   - Check memory in DevTools
   - Ensure smooth tile loading

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/ui/HUD.js` | Create | Speed/altitude display |
| `src/input/TouchInput.js` | Create | Mobile joystick controls |
| `src/input/InputHandler.js` | Modify | Integrate touch input |
| `src/main.js` | Modify | Wire up HUD and touch |
| `index.html` | Modify | Add HUD CSS |
| `src/config.js` | Modify | Tune physics if needed |

---

## Touch Control Details

### Why nipplejs?

- Well-maintained library
- Easy integration
- Handles multi-touch
- Configurable appearance
- Works on all mobile browsers

### Touch Zone Layout

```
+---------------------------+
|                           |
|       (Game View)         |
|                           |
+---------------------------+
| [LEFT      |    [RIGHT]  |
|  JOYSTICK] |  ▲ throttle |
|            |  ▼ throttle |
+---------------------------+
```

### Why Not Right Joystick for Throttle?

A simple up/down zone is more intuitive for throttle than a joystick. Players can tap and hold, no need to drag.

---

## What NOT to Do in This Stage

- ❌ Do not add sound effects (out of scope)
- ❌ Do not add weather effects (out of scope)
- ❌ Do not add multiple camera modes
- ❌ Do not add gamepad support (out of scope)
- ❌ Do not add settings menu

---

## Common Issues

### HUD not visible

- Check z-index is high enough
- Check pointer-events: none is set
- Check position: fixed is working

### Touch controls not appearing

- Check isTouchDevice() detection
- Test on actual mobile device, not just dev tools emulation
- Check for JavaScript errors

### Touch controls interfering with game

- Ensure touch-action: none on zones
- Prevent default on touch events
- Check zones don't overlap

### Performance dropped

- Verify all plugins are registered
- Check cache settings
- Reduce errorTarget if needed
- Check for memory leaks in DevTools

---

## Handoff to Stage 6

After completing this stage:

1. Commit the code:
   ```bash
   git add .
   git commit -m "Stage 5: HUD & polish - Display, touch controls, performance tuning"
   ```

2. Update CLAUDE.md:
   - Note Stage 5 is complete
   - Document any physics tuning changes
   - Note touch control implementation

3. **Test thoroughly:**
   - This is the last stage before deployment
   - Test on multiple browsers
   - Test on multiple devices if possible

---

## Suggested Build-in-Public Content

**Tweet after Stage 5:**

This stage doesn't have a specific viral moment, but you could tweet about mobile support:

```
Added mobile controls today. Now you can fly over SF on your phone. 📱✈️

Touch the left side to steer, right side for throttle. Still amazed this runs in a mobile browser.

[Attach video of mobile gameplay]
```

---

## Final Polish Checklist

Before moving to Stage 6, verify:

- [ ] All controls work on desktop (WASD, arrows, Shift, Ctrl, Space)
- [ ] All controls work on mobile (joystick, throttle)
- [ ] HUD is readable and updating
- [ ] Attribution is visible
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Golden Gate fly-through is satisfying
- [ ] Controls feel fun

If all checks pass, you're ready for deployment!
