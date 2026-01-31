import { RemoteAircraft } from './RemoteAircraft.js';

/**
 * PlayerSync - manages all remote player aircraft in the scene
 *
 * Responsibilities:
 * - Create/destroy RemoteAircraft instances as players join/leave
 * - Update remote aircraft positions from network data
 * - Run interpolation updates every frame
 */
export class PlayerSync {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to add aircraft to
   */
  constructor(scene) {
    this.scene = scene;
    this.remotePlayers = new Map();  // playerId -> RemoteAircraft
  }

  /**
   * Update all remote players from server broadcast data
   * Creates new players, updates existing, removes missing
   * @param {Object} playersData - Map of playerId -> player state from server
   */
  updatePlayers(playersData) {
    const receivedIds = new Set(Object.keys(playersData));

    // Update existing players or create new ones
    for (const [id, data] of Object.entries(playersData)) {
      if (this.remotePlayers.has(id)) {
        // Update existing player
        this.remotePlayers.get(id).setNetworkState(data);
      } else {
        // Create new player
        this.addPlayer(id, data.name, data);
      }
    }

    // Remove players that are no longer in server data
    for (const [id, aircraft] of this.remotePlayers) {
      if (!receivedIds.has(id)) {
        this.removePlayer(id);
      }
    }
  }

  /**
   * Add a new remote player to the scene
   * @param {string} playerId - Unique player identifier
   * @param {string} playerName - Display name
   * @param {Object} initialData - Initial position/rotation data
   */
  addPlayer(playerId, playerName, initialData) {
    // Don't add duplicate players
    if (this.remotePlayers.has(playerId)) {
      return;
    }

    console.log(`[PlayerSync] Adding remote player: ${playerName} (${playerId})`);

    const aircraft = new RemoteAircraft(playerId, playerName);

    if (initialData) {
      // Set initial network state
      aircraft.setNetworkState(initialData);

      // Snap to initial position immediately (no interpolation for first frame)
      if (initialData.position) {
        aircraft.position.set(
          initialData.position.x,
          initialData.position.y,
          initialData.position.z
        );
        aircraft.mesh.position.copy(aircraft.position);
      }
      if (initialData.rotation) {
        aircraft.rotation.set(
          initialData.rotation.x,
          initialData.rotation.y,
          initialData.rotation.z
        );
        aircraft.mesh.rotation.copy(aircraft.rotation);
      }
    }

    this.remotePlayers.set(playerId, aircraft);
    this.scene.add(aircraft.mesh);
  }

  /**
   * Remove a remote player from the scene
   * @param {string} playerId - Player to remove
   */
  removePlayer(playerId) {
    const aircraft = this.remotePlayers.get(playerId);
    if (aircraft) {
      console.log(`[PlayerSync] Removing remote player: ${aircraft.playerName} (${playerId})`);
      this.scene.remove(aircraft.mesh);
      aircraft.dispose();
      this.remotePlayers.delete(playerId);
    }
  }

  /**
   * Update all remote aircraft interpolation
   * Call this every frame in the game loop
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    for (const [id, aircraft] of this.remotePlayers) {
      aircraft.update(deltaTime);
    }
  }

  /**
   * Get the number of remote players currently synced
   * @returns {number}
   */
  getPlayerCount() {
    return this.remotePlayers.size;
  }

  /**
   * Check if a specific player exists
   * @param {string} playerId
   * @returns {boolean}
   */
  hasPlayer(playerId) {
    return this.remotePlayers.has(playerId);
  }

  /**
   * Get a specific remote aircraft
   * @param {string} playerId
   * @returns {RemoteAircraft|undefined}
   */
  getPlayer(playerId) {
    return this.remotePlayers.get(playerId);
  }

  /**
   * Clean up all remote players and resources
   */
  dispose() {
    for (const [id, aircraft] of this.remotePlayers) {
      this.scene.remove(aircraft.mesh);
      aircraft.dispose();
    }
    this.remotePlayers.clear();
  }
}
