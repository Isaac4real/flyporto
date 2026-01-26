# Stage 1: Project Foundation

## Goal

Create a working Vite + Three.js project with proper structure, ready for 3D Tiles integration.

**Estimated time:** 15-20 minutes

---

## Prerequisites

- Node.js 18+ installed
- Google Cloud account with Map Tiles API enabled
- API key ready (can be added later, but needed for Stage 2)

---

## Tasks

### Task 1.1: Initialize Project

Create a new Vite project with the following structure:

```
sf-flight-sim/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── CLAUDE.md
└── src/
    └── main.js
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "three": "^0.170.0",
    "3d-tiles-renderer": "^0.4.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

**Scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Task 1.2: Configure Vite

Create `vite.config.js`:
- Enable source maps for development
- Configure for ES modules

### Task 1.3: Create index.html

Create the HTML entry point:
- Full-viewport canvas container
- No scrollbars (overflow: hidden)
- Touch-action: none on container (for future mobile support)
- Import src/main.js as module

### Task 1.4: Create Environment Configuration

Create `.env.example`:
```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

Create `.gitignore`:
```
node_modules
dist
.env
.DS_Store
```

### Task 1.5: Create Minimal main.js

Create `src/main.js` with:
- Import Three.js
- Create a basic scene with a colored background
- Create a camera
- Create a renderer attached to the container
- Add a simple rotating cube (temporary - proves Three.js works)
- Handle window resize
- Start animation loop

This is temporary scaffolding that proves the build system works.

### Task 1.6: Create CLAUDE.md

Create `CLAUDE.md` in the project root with:
- Project name and one-line description
- Build commands (npm install, npm run dev, npm run build)
- Tech stack summary
- Note that this is Stage 1 of 6

---

## Acceptance Criteria

After this stage, verify:

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts the dev server
- [ ] Browser shows a colored background with a rotating cube
- [ ] Window resize works (canvas resizes)
- [ ] No console errors
- [ ] `npm run build` produces a dist folder without errors

---

## Verification Steps

1. Run `npm install`
2. Run `npm run dev`
3. Open http://localhost:5173 in browser
4. Confirm rotating cube is visible
5. Resize window - confirm canvas adjusts
6. Check browser console for errors
7. Run `npm run build`

---

## Files to Create

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `vite.config.js` | Vite configuration |
| `index.html` | HTML entry point |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore patterns |
| `CLAUDE.md` | Project context for Claude Code |
| `src/main.js` | App entry point with test cube |

---

## Code Patterns to Establish

### Three.js Initialization Pattern

```javascript
// This pattern will be used throughout the project
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('container').appendChild(renderer.domElement);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```

### Animation Loop Pattern

```javascript
function animate() {
  requestAnimationFrame(animate);
  // Updates here
  renderer.render(scene, camera);
}
animate();
```

---

## What NOT to Do in This Stage

- ❌ Do not add 3D tiles yet (Stage 2)
- ❌ Do not create the full file structure yet
- ❌ Do not add nipplejs yet (Stage 5)
- ❌ Do not add complex scene elements
- ❌ Do not worry about performance optimization

---

## Handoff to Stage 2

After completing this stage:

1. Commit the code:
   ```bash
   git init
   git add .
   git commit -m "Stage 1: Project foundation - Vite + Three.js setup"
   ```

2. Update CLAUDE.md to note Stage 1 is complete

3. The rotating cube will be removed in Stage 2 when we add real tiles

---

## Suggested Build-in-Public Content

**Not needed for Stage 1** - This is internal setup. Save your first post for Stage 2 when you have SF tiles rendering.

---

## Troubleshooting

### "Module not found" errors
- Run `npm install` again
- Check Three.js version is r167+

### Black screen instead of cube
- Check console for errors
- Verify renderer is appended to DOM
- Check camera position (should be z: 5 or similar)

### Vite not starting
- Check Node.js version (18+)
- Delete node_modules and reinstall
