/**
 * San Francisco Landmarks Database
 * All coordinates are lat/lon, converted to local at runtime
 *
 * The game uses ReorientationPlugin which places Golden Gate Bridge center
 * at origin (0,0,0) with Y-up. Positions are converted from lat/lon to local
 * coordinates using the latLonToLocal helper in CheckpointManager.
 */

export const LANDMARKS = {
  goldenGateSouth: {
    id: 'golden-gate-south',
    name: 'Golden Gate Bridge (South Tower)',
    shortName: 'GG South',
    lat: 37.8107,
    lon: -122.4738,
    altitude: 227,        // meters - tower height
    triggerRadius: 100,   // meters
    triggerType: 'sphere',
    description: 'South tower of the Golden Gate Bridge'
  },

  goldenGateCenter: {
    id: 'golden-gate-center',
    name: 'Golden Gate Bridge (Under)',
    shortName: 'GG Under',
    lat: 37.8199,
    lon: -122.4783,
    altitude: 40,         // meters - fly under the deck
    triggerRadius: 150,
    triggerType: 'box',
    triggerSize: { x: 300, y: 60, z: 100 },  // Wide gate to fly through
    description: 'Fly under the Golden Gate Bridge'
  },

  goldenGateNorth: {
    id: 'golden-gate-north',
    name: 'Golden Gate Bridge (North Tower)',
    shortName: 'GG North',
    lat: 37.8291,
    lon: -122.4824,
    altitude: 227,        // meters - tower height
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'North tower of the Golden Gate Bridge'
  },

  alcatraz: {
    id: 'alcatraz',
    name: 'Alcatraz Island',
    shortName: 'Alcatraz',
    lat: 37.8267,
    lon: -122.4233,
    altitude: 50,         // meters - fly over the island
    triggerRadius: 200,
    triggerType: 'sphere',
    description: 'The infamous prison island'
  },

  coitTower: {
    id: 'coit-tower',
    name: 'Coit Tower',
    shortName: 'Coit',
    lat: 37.8024,
    lon: -122.4059,
    altitude: 100,        // meters - above the tower
    triggerRadius: 80,
    triggerType: 'sphere',
    description: 'Telegraph Hill landmark'
  },

  transamerica: {
    id: 'transamerica',
    name: 'Transamerica Pyramid',
    shortName: 'Pyramid',
    lat: 37.7952,
    lon: -122.4029,
    altitude: 280,        // meters - near the top
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'The iconic pyramid building'
  },

  salesforceTower: {
    id: 'salesforce-tower',
    name: 'Salesforce Tower',
    shortName: 'Salesforce',
    lat: 37.7899,
    lon: -122.3969,
    altitude: 350,        // meters - above the crown
    triggerRadius: 120,
    triggerType: 'sphere',
    description: 'Tallest building in San Francisco'
  },

  ferryBuilding: {
    id: 'ferry-building',
    name: 'Ferry Building',
    shortName: 'Ferry',
    lat: 37.7955,
    lon: -122.3937,
    altitude: 80,
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'Historic waterfront building'
  },

  oraclePark: {
    id: 'oracle-park',
    name: 'Oracle Park',
    shortName: 'Oracle',
    lat: 37.7786,
    lon: -122.3897,
    altitude: 60,
    triggerRadius: 150,
    triggerType: 'sphere',
    description: 'Home of the SF Giants'
  },

  treasureIsland: {
    id: 'treasure-island',
    name: 'Treasure Island',
    shortName: 'Treasure',
    lat: 37.8236,
    lon: -122.3706,
    altitude: 50,
    triggerRadius: 300,
    triggerType: 'sphere',
    description: 'Artificial island in the bay'
  },

  bayBridge: {
    id: 'bay-bridge',
    name: 'Bay Bridge',
    shortName: 'Bay Bridge',
    lat: 37.7983,
    lon: -122.3778,
    altitude: 40,
    triggerRadius: 120,
    triggerType: 'box',
    triggerSize: { x: 200, y: 50, z: 80 },
    description: 'Fly under the Bay Bridge'
  },

  palaceOfFineArts: {
    id: 'palace-fine-arts',
    name: 'Palace of Fine Arts',
    shortName: 'Palace',
    lat: 37.8029,
    lon: -122.4486,
    altitude: 60,
    triggerRadius: 100,
    triggerType: 'sphere',
    description: 'Classical rotunda in the Marina'
  }
};

/**
 * Pre-defined racing routes
 * Each route has checkpoints, difficulty rating, and medal time thresholds
 */
export const ROUTES = {
  goldenGateChallenge: {
    id: 'golden-gate-challenge',
    name: 'Golden Gate Challenge',
    description: 'Start at Alcatraz, fly under the bridge, end at Palace of Fine Arts',
    checkpoints: ['alcatraz', 'goldenGateCenter', 'palaceOfFineArts'],
    difficulty: 'easy',
    estimatedTime: 45,  // seconds
    medalTimes: {
      gold: 40,
      silver: 50,
      bronze: 65
    }
  },

  bayTour: {
    id: 'bay-tour',
    name: 'Bay Area Tour',
    description: 'Complete circuit of major landmarks',
    checkpoints: [
      'goldenGateSouth',
      'alcatraz',
      'coitTower',
      'ferryBuilding',
      'oraclePark',
      'bayBridge',
      'treasureIsland'
    ],
    difficulty: 'medium',
    estimatedTime: 120,
    medalTimes: {
      gold: 100,
      silver: 130,
      bronze: 160
    }
  },

  downtownDash: {
    id: 'downtown-dash',
    name: 'Downtown Dash',
    description: 'Navigate through the skyscrapers',
    checkpoints: [
      'ferryBuilding',
      'transamerica',
      'salesforceTower',
      'oraclePark'
    ],
    difficulty: 'hard',
    estimatedTime: 60,
    medalTimes: {
      gold: 50,
      silver: 70,
      bronze: 90
    }
  },

  bridgeRun: {
    id: 'bridge-run',
    name: 'Bridge Run',
    description: 'Fly under both bridges',
    checkpoints: [
      'goldenGateCenter',
      'alcatraz',
      'treasureIsland',
      'bayBridge'
    ],
    difficulty: 'medium',
    estimatedTime: 90,
    medalTimes: {
      gold: 75,
      silver: 95,
      bronze: 120
    }
  }
};

/**
 * Get a landmark by its key or ID
 * @param {string} key - Landmark key (e.g., 'alcatraz') or ID (e.g., 'alcatraz')
 * @returns {Object|null} Landmark object or null if not found
 */
export function getLandmark(key) {
  // Try direct key lookup first
  if (LANDMARKS[key]) {
    return LANDMARKS[key];
  }

  // Try finding by ID
  return Object.values(LANDMARKS).find(l => l.id === key) || null;
}

/**
 * Get a route by its key or ID
 * @param {string} key - Route key or ID
 * @returns {Object|null} Route object or null if not found
 */
export function getRoute(key) {
  if (ROUTES[key]) {
    return ROUTES[key];
  }

  return Object.values(ROUTES).find(r => r.id === key) || null;
}

/**
 * Get all routes as an array, sorted by difficulty
 * @returns {Array} Array of route objects
 */
export function getAllRoutes() {
  const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
  return Object.values(ROUTES).sort(
    (a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
  );
}
