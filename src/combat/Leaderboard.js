/**
 * Leaderboard - displays top players by score
 */
export class Leaderboard {
  /**
   * @param {HTMLElement} container - Parent container element
   * @param {NetworkManager} networkManager - For getting local player ID
   */
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
      position: fixed;
      top: calc(var(--top-banner-height, 0px) + 50px);
      right: 12px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 8px;
      padding: 10px 15px;
      min-width: 150px;
      font-family: system-ui, -apple-system, sans-serif;
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
    title.textContent = 'LEADERBOARD';
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

    // Build sorted array of entries
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
      score.textContent = String(entry.score);
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
