/**
 * RaceHUD - Displays race information overlay
 *
 * Shows:
 * - Race timer (MM:SS.mm format)
 * - Checkpoint progress dots
 * - Current/next checkpoint name
 * - Checkpoint reached notifications
 * - Race complete screen with medals
 */
export class RaceHUD {
  constructor(container) {
    this.container = container;
    this.element = null;
    this.visible = false;

    // Callbacks
    this.onShareClick = null;
    this.onRetryClick = null;

    this.createElements();
  }

  createElements() {
    // Main race panel (left side)
    this.element = document.createElement('div');
    this.element.id = 'race-hud';
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 20px;
      transform: translateY(-50%);
      pointer-events: none;
      z-index: 500;
      display: none;
    `;

    this.element.innerHTML = `
      <div class="race-panel" style="
        background: rgba(0, 0, 0, 0.7);
        border-radius: 12px;
        padding: 20px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        min-width: 200px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <div class="race-title" style="
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">Race</div>

        <div class="race-timer" style="
          font-size: 48px;
          font-weight: bold;
          font-variant-numeric: tabular-nums;
          margin-bottom: 12px;
          color: #00ff88;
        ">00:00.00</div>

        <div class="checkpoint-progress" style="
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        "></div>

        <div class="next-checkpoint" style="
          font-size: 16px;
          color: #4ade80;
        ">
          <span style="opacity: 0.6">Next:</span>
          <span class="checkpoint-name" style="font-weight: 600;">--</span>
        </div>

        <div class="distance-display" style="
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 8px;
        ">
          <span class="distance-value">--</span>
        </div>

        <div class="race-hint" style="
          font-size: 11px;
          color: rgba(255, 255, 255, 0.3);
          margin-top: 16px;
          text-align: center;
        ">
          <kbd style="
            display: inline-block;
            padding: 2px 6px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            font-family: monospace;
            font-size: 10px;
          ">ESC</kbd> to cancel
        </div>
      </div>
    `;

    this.container.appendChild(this.element);

    // Get references
    this.titleEl = this.element.querySelector('.race-title');
    this.timerEl = this.element.querySelector('.race-timer');
    this.progressEl = this.element.querySelector('.checkpoint-progress');
    this.nextCheckpointEl = this.element.querySelector('.checkpoint-name');
    this.distanceEl = this.element.querySelector('.distance-value');

    // Checkpoint notification (center screen)
    this.notification = document.createElement('div');
    this.notification.id = 'checkpoint-notification';
    this.notification.style.cssText = `
      position: fixed;
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
      pointer-events: none;
      z-index: 600;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
    `;
    this.container.appendChild(this.notification);

    // Race complete overlay
    this.completeOverlay = document.createElement('div');
    this.completeOverlay.id = 'race-complete-overlay';
    this.completeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      z-index: 700;
      pointer-events: auto;
    `;
    this.container.appendChild(this.completeOverlay);
  }

  /**
   * Show the race HUD
   * @param {string} routeName - Name of the race
   * @param {number} totalCheckpoints - Total number of checkpoints
   */
  show(routeName, totalCheckpoints) {
    this.visible = true;
    this.element.style.display = 'block';
    this.titleEl.textContent = routeName;
    this.timerEl.textContent = '00:00.00';

    // Create checkpoint dots
    this.progressEl.innerHTML = '';
    for (let i = 0; i < totalCheckpoints; i++) {
      const dot = document.createElement('div');
      dot.className = 'checkpoint-dot';
      dot.dataset.index = i;
      dot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transition: all 0.3s;
        box-shadow: none;
      `;
      this.progressEl.appendChild(dot);
    }

    // Highlight first dot as active
    const dots = this.progressEl.querySelectorAll('.checkpoint-dot');
    if (dots[0]) {
      dots[0].style.background = '#fbbf24';
      dots[0].style.transform = 'scale(1.3)';
      dots[0].style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
    }
  }

  /**
   * Hide the race HUD
   */
  hide() {
    this.visible = false;
    this.element.style.display = 'none';
  }

  /**
   * Update timer display
   * @param {number} timeSeconds - Elapsed time in seconds
   * @param {boolean} [started=true] - Whether the race timer has started
   */
  updateTimer(timeSeconds, started = true) {
    if (!started) {
      // Show "GO!" before timer starts
      this.timerEl.textContent = 'GO!';
      this.timerEl.style.color = '#fbbf24';  // Yellow/gold
      return;
    }

    // Timer is running
    this.timerEl.style.color = '#00ff88';  // Green
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    const centiseconds = Math.floor((timeSeconds % 1) * 100);

    this.timerEl.textContent =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update checkpoint progress
   * @param {number} completedIndex - Last completed checkpoint index (0-based)
   * @param {string} nextName - Name of next checkpoint
   * @param {number} [distance] - Distance to next checkpoint in meters
   */
  updateProgress(completedIndex, nextName, distance = null) {
    // Update dots
    const dots = this.progressEl.querySelectorAll('.checkpoint-dot');
    dots.forEach((dot, i) => {
      if (i < completedIndex) {
        // Completed
        dot.style.background = '#4ade80';
        dot.style.transform = 'scale(1)';
        dot.style.boxShadow = 'none';
      } else if (i === completedIndex) {
        // Current/active
        dot.style.background = '#fbbf24';
        dot.style.transform = 'scale(1.3)';
        dot.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.5)';
      } else {
        // Upcoming
        dot.style.background = 'rgba(255, 255, 255, 0.3)';
        dot.style.transform = 'scale(1)';
        dot.style.boxShadow = 'none';
      }
    });

    // Update next checkpoint name
    if (nextName) {
      this.nextCheckpointEl.textContent = nextName;
    } else {
      this.nextCheckpointEl.textContent = 'Finish!';
    }

    // Update distance
    if (distance !== null) {
      if (distance > 1000) {
        this.distanceEl.textContent = `${(distance / 1000).toFixed(1)} km`;
      } else {
        this.distanceEl.textContent = `${Math.round(distance)} m`;
      }
    }
  }

  /**
   * Show checkpoint reached notification
   * @param {string} name - Checkpoint name
   * @param {number} splitTime - Time at this checkpoint
   * @param {number} checkpointNum - Checkpoint number (1-based)
   * @param {number} totalCheckpoints - Total checkpoints
   */
  showCheckpointNotification(name, splitTime, checkpointNum, totalCheckpoints) {
    const isLast = checkpointNum === totalCheckpoints;

    this.notification.innerHTML = `
      <div style="
        font-size: 32px;
        font-weight: bold;
        color: #4ade80;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        margin-bottom: 8px;
      ">${isLast ? 'FINISH!' : name}</div>
      <div style="
        font-size: 24px;
        color: white;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
      ">${splitTime.toFixed(2)}s</div>
      <div style="
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 4px;
      ">${checkpointNum} / ${totalCheckpoints}</div>
    `;

    this.notification.style.opacity = '1';
    this.notification.style.transform = 'translate(-50%, -50%) scale(1)';

    // Animate out
    setTimeout(() => {
      this.notification.style.opacity = '0';
      this.notification.style.transform = 'translate(-50%, -50%) scale(0.9)';
    }, 1500);
  }

  /**
   * Show race complete screen
   * @param {Object} result - Race result
   */
  showRaceComplete(result) {
    // Medal colors and emojis
    const medalConfig = {
      gold: { color: '#ffd700', emoji: '1st', bg: 'rgba(255, 215, 0, 0.2)' },
      silver: { color: '#c0c0c0', emoji: '2nd', bg: 'rgba(192, 192, 192, 0.2)' },
      bronze: { color: '#cd7f32', emoji: '3rd', bg: 'rgba(205, 127, 50, 0.2)' }
    };

    const medal = result.medal ? medalConfig[result.medal] : null;
    const accentColor = medal ? medal.color : '#4ade80';

    // Format time nicely
    const minutes = Math.floor(result.totalTime / 60);
    const seconds = (result.totalTime % 60).toFixed(2);
    const timeDisplay = minutes > 0
      ? `${minutes}:${seconds.padStart(5, '0')}`
      : `${seconds}s`;

    this.completeOverlay.innerHTML = `
      <div style="
        background: rgba(0, 0, 0, 0.9);
        padding: 40px 60px;
        border-radius: 20px;
        text-align: center;
        border: 2px solid ${accentColor};
        box-shadow: 0 0 60px ${accentColor}33;
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 90vw;
      ">
        <div style="
          font-size: 28px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 2px;
        ">Race Complete!</div>

        ${medal ? `
          <div style="
            font-size: 72px;
            margin: 20px 0;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
          ">${medal.emoji === '1st' ? '&#129351;' : medal.emoji === '2nd' ? '&#129352;' : '&#129353;'}</div>
        ` : `
          <div style="font-size: 72px; margin: 20px 0;">&#127937;</div>
        `}

        <div style="
          font-size: 56px;
          font-weight: bold;
          color: ${accentColor};
          margin-bottom: 12px;
          font-variant-numeric: tabular-nums;
        ">${timeDisplay}</div>

        <div style="
          font-size: 20px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 8px;
        ">${result.routeName}</div>

        <div style="
          font-size: 16px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 24px;
        ">${result.checkpointCount} checkpoints</div>

        ${medal ? `
          <div style="
            display: inline-block;
            padding: 8px 20px;
            background: ${medal.bg};
            border: 1px solid ${medal.color};
            border-radius: 20px;
            color: ${medal.color};
            font-weight: bold;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 24px;
          ">${result.medal} Medal!</div>
        ` : ''}

        <div style="
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        ">
          <button id="share-race-btn" style="
            padding: 14px 28px;
            font-size: 16px;
            font-weight: bold;
            background: #1da1f2;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share
          </button>

          <button id="retry-race-btn" style="
            padding: 14px 28px;
            font-size: 16px;
            font-weight: bold;
            background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            Try Again
          </button>

          <button id="close-race-btn" style="
            padding: 14px 28px;
            font-size: 16px;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            Close
          </button>
        </div>
      </div>
    `;

    this.completeOverlay.style.display = 'flex';

    // Wire up buttons
    const shareBtn = document.getElementById('share-race-btn');
    const retryBtn = document.getElementById('retry-race-btn');
    const closeBtn = document.getElementById('close-race-btn');

    // Add hover effects
    [shareBtn, retryBtn, closeBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'translateY(-2px)';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = 'none';
        });
      }
    });

    shareBtn?.addEventListener('click', () => {
      this.onShareClick?.(result);
    });

    retryBtn?.addEventListener('click', () => {
      this.hideRaceComplete();
      this.onRetryClick?.();
    });

    closeBtn?.addEventListener('click', () => {
      this.hideRaceComplete();
      this.hide();
    });
  }

  /**
   * Hide race complete screen
   */
  hideRaceComplete() {
    this.completeOverlay.style.display = 'none';
  }

  /**
   * Check if race complete overlay is showing
   * @returns {boolean}
   */
  isShowingComplete() {
    return this.completeOverlay.style.display === 'flex';
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.element?.remove();
    this.notification?.remove();
    this.completeOverlay?.remove();
  }
}
