# SF Flight Simulator: Stage Orchestration Guide

## Overview

This document explains how to use the staged implementation plans with Claude Code.

The MVP is broken into **6 stages**, each designed to:
- Complete in a single Claude Code session (10-30 minutes)
- Produce working, committable code
- End at a natural verification point
- Hand off cleanly to the next stage

---

## Stage Summary

| Stage | Name | Duration | Key Deliverable |
|-------|------|----------|-----------------|
| 1 | Project Foundation | 15-20 min | Vite + Three.js project running |
| 2 | 3D Tiles Integration | 20-30 min | SF tiles visible in browser |
| 3 | Flight Core | 20-30 min | Aircraft + physics + basic movement |
| 4 | Controls & Camera | 15-20 min | Keyboard controls + follow camera |
| 5 | HUD & Polish | 20-25 min | HUD + touch controls + tuning |
| 6 | Deployment | 10-15 min | Live on public URL |

**Total estimated time:** 2-3 hours of Claude Code work

---

## How to Use These Stages

### Before Starting Any Stage

1. **Ensure prerequisites are met:**
   - Previous stage completed and verified
   - Code committed to git
   - No unresolved errors from previous stage

2. **Start a fresh Claude Code session:**
   - Navigate to the project directory
   - Run `/clear` if resuming in same terminal
   - This ensures clean context

3. **Provide context to Claude Code:**
   ```
   I'm building an SF flight simulator. Here's the high-level technical brief:
   [Paste CLAUDE-CODE-TECHNICAL-BRIEF.md or reference it]

   I'm now starting Stage X. Here's the detailed plan:
   [Paste STAGE-X-*.md content]

   Please implement this stage.
   ```

### During Each Stage

- Let Claude Code work through the tasks
- Verify each acceptance criterion before moving on
- If Claude gets stuck, provide clarification
- Don't ask Claude to do things outside the stage scope

### After Each Stage

1. **Verify all acceptance criteria:**
   - Run through the checklist in the stage document
   - Test in browser

2. **Commit the code:**
   ```bash
   git add .
   git commit -m "Complete Stage X: [stage name]"
   ```

3. **Update CLAUDE.md if needed:**
   - Add any new patterns or decisions made
   - Note any deviations from the plan

4. **Take a screenshot/video for build-in-public:**
   - Each stage has suggested media to capture

---

## Stage Dependencies

```
Stage 1: Project Foundation
    │
    ▼
Stage 2: 3D Tiles Integration
    │
    ▼
Stage 3: Flight Core
    │
    ▼
Stage 4: Controls & Camera
    │
    ▼
Stage 5: HUD & Polish
    │
    ▼
Stage 6: Deployment
```

Each stage must be completed before starting the next. Stages cannot be done in parallel.

---

## Handling Problems

### If a Stage Fails

1. **Don't continue to the next stage**
2. **Diagnose the issue:**
   - Check console for errors
   - Review the code changes
   - Identify what's not working

3. **Start a fresh session:**
   - Run `/clear`
   - Describe the problem specifically
   - Ask Claude to fix the specific issue

4. **Re-verify before continuing**

### If Requirements Change

The stage plans may need adjustment based on discoveries during implementation. That's expected.

**Minor adjustments:** Handle within the current stage
**Major changes:** Document the change in CLAUDE.md, adjust future stages accordingly

### If Claude Code Loses Context

Signs of context loss:
- Repeating previous mistakes
- Forgetting architectural decisions
- Suggesting patterns that contradict earlier work

Solution:
1. Complete and commit current progress
2. Start fresh session
3. Reference git history and CLAUDE.md for context

---

## Verification Commands

After each stage, run these commands:

```bash
# Check for errors
npm run dev  # Should start without errors

# Check build
npm run build  # Should complete without errors

# Check git status
git status  # Should show only expected changes
```

---

## Files Created by Each Stage

### After Stage 1
```
sf-flight-sim/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── CLAUDE.md
└── src/
    └── main.js (minimal)
```

### After Stage 2
```
src/
├── main.js
├── config.js
├── core/
│   ├── Scene.js
│   └── TilesManager.js
├── ui/
│   └── Attribution.js
└── utils/
    └── coordinates.js
```

### After Stage 3
```
src/
├── core/
│   └── GameLoop.js
└── player/
    ├── Aircraft.js
    └── Physics.js
```

### After Stage 4
```
src/
├── input/
│   ├── InputHandler.js
│   └── KeyboardInput.js
└── player/
    └── CameraController.js
```

### After Stage 5
```
src/
├── input/
│   └── TouchInput.js
└── ui/
    └── HUD.js
```

### After Stage 6
```
(no new files - deployment configuration)
```

---

## Tips for Success

1. **Don't skip verification steps** - Each stage builds on the previous
2. **Commit after each stage** - Creates restore points
3. **Keep sessions focused** - Don't mix stage work with other tasks
4. **Trust the process** - The stages are designed to flow naturally
5. **Capture content** - Screenshots and videos at each milestone for build-in-public

---

## Quick Reference

**To start a stage:**
```
Starting Stage [X]: [Name]

[Paste stage document]

Please implement this stage. Let me know when you need me to verify anything.
```

**To verify a stage:**
```
Stage [X] should be complete. Let me verify:
- [Run through acceptance criteria]
```

**To commit a stage:**
```bash
git add .
git commit -m "Stage [X]: [Name] - [brief description]"
```

---

## Next Steps

Start with **STAGE-1-PROJECT-FOUNDATION.md**
