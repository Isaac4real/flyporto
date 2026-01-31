# Stage 14: Score Display & Leaderboard

## Goal

Display scores in the HUD with a real-time leaderboard showing top players.

**Estimated time:** 30-45 minutes

---

## Prerequisites

- Stage 13 complete (server tracks scores)
- Scores included in player broadcast

---

## Tasks

### Task 14.1: Create Leaderboard Component

Create `src/combat/Leaderboard.js`:

```javascript
/**
 * Leaderboard - displays top players by score
 */
export class Leaderboard {
  constructor(container, networkManager) {
    this.container = container;
    this.networkManager = networkManager;
    this.maxDisplay = 5;  // Show top 5 players

    this.element = this.createElement();
    container.appendChild(this.element);
  }

  /**
   * Create the leaderboard DOM element
   */
  createElement() {
    const leaderboard = document.createElement('div');
    leaderboard.id = 'leaderboard';
    leaderboard.style.cssText = `
      position: absolute;
      top: 60px;
      right: 10px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 8px;
      padding: 10px 15px;
      min-width: 150px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      color: white;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(255,255,255,0.3);
    `;
    title.textContent = '🏆 LEADERBOARD';
    leaderboard.appendChild(title);

    // Entries container
    this.entriesContainer = document.createElement('div');
    leaderboard.appendChild(this.entriesContainer);

    return leaderboard;
  }

  /**
   * Update leaderboard with new scores
   * @param {Object} scores - playerId -> score
   * @param {Object} players - playerId -> { name, ... }
   */
  update(scores, players) {
    const myId = this.networkManager.getPlayerId();

    // Build sorted array of [playerId, score, name]
    const entries = [];
    for (const [id, score] of Object.entries(scores)) {
      const player = players[id];
      const name = player?.name || 'Unknown';
      entries.push({ id, score, name });
    }

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Take top N
    const topEntries = entries.slice(0, this.maxDisplay);

    // Clear existing
    this.entriesContainer.innerHTML = '';

    // No scores yet
    if (topEntries.length === 0 || topEntries.every(e => e.score === 0)) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: rgba(255,255,255,0.5); font-style: italic;';
      empty.textContent = 'No kills yet...';
      this.entriesContainer.appendChild(empty);
      return;
    }

    // Create entries
    topEntries.forEach((entry, index) => {
      // Skip zero scores
      if (entry.score === 0) return;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        ${entry.id === myId ? 'color: #ffff00; font-weight: bold;' : ''}
      `;

      const rank = document.createElement('span');
      rank.textContent = `${index + 1}. ${entry.name}`;
      rank.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;';

      const score = document.createElement('span');
      score.textContent = entry.score;
      score.style.cssText = 'margin-left: 10px; font-weight: bold;';

      row.appendChild(rank);
      row.appendChild(score);
      this.entriesContainer.appendChild(row);
    });
  }

  /**
   * Show/hide leaderboard
   */
  setVisible(visible) {
    this.element.style.display = visible ? 'block' : 'none';
  }

  /**
   * Clean up
   */
  dispose() {
    this.element.remove();
  }
}
```

### Task 14.2: Add Score Display to HUD

Update `src/ui/HUD.js`:

Add score display in constructor:

```javascript
constructor(container) {
  this.container = container;

  // ... existing elements ...

  // Score display (top left, below speed/altitude)
  this.scoreDisplay = document.createElement('div');
  this.scoreDisplay.style.cssText = `
    position: absolute;
    top: 70px;
    left: 10px;
    color: #ffff00;
    font-family: system-ui, sans-serif;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
  `;
  this.scoreDisplay.textContent = 'Score: 0';
  container.appendChild(this.scoreDisplay);
}

/**
 * Update score display
 */
updateScore(score) {
  this.scoreDisplay.textContent = `Score: ${score}`;
}
```

### Task 14.3: Enhance Hit Notifications

Update `src/ui/HUD.js` to show who you hit:

```javascript
/**
 * Show hit notification with target name
 */
showHitNotification(targetName, newScore) {
  // "+1" popup
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #44ff44;
    font-family: system-ui, sans-serif;
    font-size: 48px;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    pointer-events: none;
    z-index: 1000;
  `;
  popup.textContent = '+1';
  document.body.appendChild(popup);

  // Target name below
  const namePopup = document.createElement('div');
  namePopup.style.cssText = `
    position: fixed;
    top: 55%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-family: system-ui, sans-serif;
    font-size: 18px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    pointer-events: none;
    z-index: 1000;
  `;
  namePopup.textContent = `Hit ${targetName}!`;
  document.body.appendChild(namePopup);

  // Animate both up and fade
  let opacity = 1;
  let offsetY = 0;
  const animate = () => {
    opacity -= 0.015;
    offsetY -= 1.5;
    if (opacity <= 0) {
      popup.remove();
      namePopup.remove();
      return;
    }
    popup.style.opacity = opacity;
    popup.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
    namePopup.style.opacity = opacity;
    namePopup.style.transform = `translate(-50%, calc(-50% + ${offsetY}px))`;
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  // Update score display
  this.updateScore(newScore);
}
```

### Task 14.4: Integrate Leaderboard with Main

Update `src/main.js`:

```javascript
// Add import
import { Leaderboard } from './combat/Leaderboard.js';

// After creating HUD
const leaderboard = new Leaderboard(container, networkManager);

// Store players data for leaderboard
let playersData = {};

// Update networkManager.onPlayersUpdate
networkManager.onPlayersUpdate = (players, count) => {
  playersData = players;  // Store for leaderboard
  playerSync.updatePlayers(players);
  hud.updateConnectionStatus(true, count);
};

// Update combatManager callbacks
combatManager.onHit = (targetId, targetName, score) => {
  hud.showHitNotification(targetName, score);
  // Update leaderboard immediately
  leaderboard.update(combatManager.getScores(), playersData);
};

combatManager.onGotHit = (shooterId, shooterName) => {
  hud.showGotHitEffect();
};

// In update loop, periodically update leaderboard
let lastLeaderboardUpdate = 0;
function update(deltaTime) {
  // ... existing code ...

  // Update leaderboard every 500ms (not every frame)
  const now = performance.now();
  if (now - lastLeaderboardUpdate > 500) {
    lastLeaderboardUpdate = now;
    leaderboard.update(combatManager.getScores(), playersData);
    hud.updateScore(combatManager.getScore());
  }

  // ... rest of update ...
}
```

### Task 14.5: Update CombatManager to Track Scores from Broadcast

Ensure `CombatManager.js` updates scores from the regular broadcast:

```javascript
// In setupNetworkHandlers(), the players message handler:
case 'players':
  // Update scores from player data
  if (msg.scores) {
    this.scores = msg.scores;
    this.myScore = msg.scores[this.networkManager.getPlayerId()] || 0;
  }
  break;
```

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Speed: 180 kts                            🏆 LEADERBOARD       │
│ Alt: 450m                                 ─────────────────    │
│ Score: 5                                  1. Alice      8      │
│                                           2. Bob        5 ←YOU │
│                                           3. Charlie    3      │
│                                                                 │
│                        [GAME VIEW]                              │
│                                                                 │
│                           +1                                    │
│                      Hit Charlie!                               │
│                                                                 │
│                                           Online: 5 players    │
│ WASD to fly...                            Ping: 45ms           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Leaderboard visible in top-right
- [ ] Shows top 5 players by score
- [ ] Own entry highlighted in yellow
- [ ] Score updates in real-time
- [ ] Own score shown prominently (top-left, large)
- [ ] "+1" popup shows when hitting someone
- [ ] Target name shown below "+1"
- [ ] Red flash when getting hit
- [ ] Leaderboard shows "No kills yet..." when all scores are 0
- [ ] No console errors

---

## Code Patterns

### Sorted Leaderboard

```javascript
const entries = Object.entries(scores)
  .map(([id, score]) => ({ id, score, name: players[id]?.name }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
```

### Throttled Updates

```javascript
if (now - lastUpdate > 500) {
  lastUpdate = now;
  leaderboard.update(scores, players);
}
```

### Highlight Own Entry

```javascript
row.style.cssText = `
  ${entry.id === myId ? 'color: #ffff00; font-weight: bold;' : ''}
`;
```

---

## What NOT to Do

- ❌ Don't update leaderboard every frame (throttle to 500ms)
- ❌ Don't show all players (limit to top 5)
- ❌ Don't forget to handle empty/zero scores state
- ❌ Don't make leaderboard too large (keep minimal)

---

## Troubleshooting

### Leaderboard not updating
- Check scores object is passed correctly
- Check combatManager.getScores() returns data
- Check msg.scores exists in players broadcast

### Own entry not highlighted
- Check networkManager.getPlayerId() returns correct ID
- Check ID comparison uses correct format

### Score shows 0 after hits
- Check combatManager.myScore is updated
- Check server is sending scores in broadcast

---

## Handoff to Stage 15

After completing this stage:
- Scores visible and updating
- Leaderboard shows rankings
- Hit feedback satisfying
- Ready for final polish and balance
