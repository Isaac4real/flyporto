/**
 * TwitterIntent.js
 * Builds Twitter Web Intent URLs for sharing
 *
 * Twitter Web Intent API Reference:
 * https://developer.twitter.com/en/docs/twitter-for-websites/tweet-button/guides/web-intent
 *
 * Supported parameters:
 * - text: Pre-filled tweet text (max ~250 chars to leave room for URL)
 * - url: Link to share
 * - hashtags: Comma-separated (no # symbol)
 * - via: Attribution handle (no @ symbol)
 *
 * LIMITATION: Cannot upload images directly. User must attach image manually.
 */
export class TwitterIntent {
  constructor(options = {}) {
    this.options = {
      baseUrl: 'https://twitter.com/intent/tweet',
      defaultHashtags: ['flysf', 'flightsim'],
      via: null,  // Set to your Twitter handle without @
      gameUrl: 'https://flysf.io',
      ...options
    };
  }

  /**
   * Build tweet URL for race completion
   *
   * @param {Object} raceData
   * @param {string} raceData.routeId - Route ID for deep linking
   * @param {string} raceData.routeName - Route completed
   * @param {number} raceData.totalTime - Time in seconds
   * @param {number} raceData.checkpointCount - Number of checkpoints
   * @param {string} [raceData.medal] - Medal earned (gold/silver/bronze)
   * @param {string} [raceData.playerName] - Optional player name
   * @returns {string} Twitter intent URL
   */
  buildRaceShareUrl(raceData) {
    const timeStr = this._formatTime(raceData.totalTime);

    // Medal emoji mapping
    const medalEmoji = {
      gold: '\u{1F947}',
      silver: '\u{1F948}',
      bronze: '\u{1F949}'
    };

    // Craft engaging tweet text
    // Keep under ~230 chars to leave room for URL and t.co wrapping
    let text = '';

    if (raceData.medal) {
      text = `${medalEmoji[raceData.medal]} Just earned a ${raceData.medal} medal on the ${raceData.routeName}!\n\n`;
    } else {
      text = `\u2708\uFE0F Just flew the ${raceData.routeName} in ${timeStr}!\n\n`;
    }

    text += `${raceData.checkpointCount} checkpoints over San Francisco \u{1F309}\n\n`;
    text += `Can you beat my time?`;

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('url', this._buildShareUrl(raceData));

    if (this.options.defaultHashtags.length > 0) {
      params.set('hashtags', this.options.defaultHashtags.join(','));
    }

    if (this.options.via) {
      params.set('via', this.options.via);
    }

    return `${this.options.baseUrl}?${params.toString()}`;
  }

  /**
   * Build a deep link URL that could load the same route
   * @private
   */
  _buildShareUrl(raceData) {
    const url = new URL(this.options.gameUrl);

    // Add route parameter for deep linking
    if (raceData.routeId) {
      url.searchParams.set('route', raceData.routeId);
    }

    return url.toString();
  }

  /**
   * Build generic share URL (not race-specific)
   * @param {string} [customText] - Optional custom tweet text
   * @returns {string} Twitter intent URL
   */
  buildGenericShareUrl(customText = null) {
    const text = customText ||
      '\u2708\uFE0F Flying over San Francisco in photorealistic 3D! Come join me:';

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('url', this.options.gameUrl);

    if (this.options.defaultHashtags.length > 0) {
      params.set('hashtags', this.options.defaultHashtags.join(','));
    }

    if (this.options.via) {
      params.set('via', this.options.via);
    }

    return `${this.options.baseUrl}?${params.toString()}`;
  }

  /**
   * Open Twitter intent in new window
   * Uses recommended Twitter window dimensions
   *
   * @param {string} intentUrl
   */
  openIntent(intentUrl) {
    // Twitter recommends specific window dimensions
    const width = 550;
    const height = 420;
    const left = Math.round((window.innerWidth - width) / 2 + window.screenX);
    const top = Math.round((window.innerHeight - height) / 2 + window.screenY);

    window.open(
      intentUrl,
      'twitter-share',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
  }

  /**
   * Format seconds to readable time
   * @private
   */
  _formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get share URLs for multiple platforms
   *
   * @param {Object} raceData - Race data
   * @returns {Object} URLs for different platforms
   */
  getMultiPlatformUrls(raceData) {
    const gameUrl = encodeURIComponent(this.options.gameUrl);
    const timeStr = this._formatTime(raceData.totalTime);
    const text = encodeURIComponent(
      `Just flew the ${raceData.routeName} in ${timeStr}! Can you beat my time?`
    );
    const title = encodeURIComponent(`FlySF - ${raceData.routeName}`);

    return {
      twitter: this.buildRaceShareUrl(raceData),
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${gameUrl}`,
      reddit: `https://reddit.com/submit?url=${gameUrl}&title=${title}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${gameUrl}`
    };
  }
}
