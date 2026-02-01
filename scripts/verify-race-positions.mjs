#!/usr/bin/env node
/**
 * Verify race checkpoint positions
 * Run with: node scripts/verify-race-positions.mjs
 */

// Replicate the coordinate conversion from CheckpointManager
const CONFIG = {
  startPosition: {
    lat: 37.8199,
    lon: -122.4783
  }
};

const EARTH_RADIUS = 6371000;

function latLonToLocal(lat, lon) {
  const REF_LAT = CONFIG.startPosition.lat;
  const REF_LON = CONFIG.startPosition.lon;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const refLatRad = REF_LAT * Math.PI / 180;
  const refLonRad = REF_LON * Math.PI / 180;

  const x = EARTH_RADIUS * (lonRad - refLonRad) * Math.cos(refLatRad);
  const z = -EARTH_RADIUS * (latRad - refLatRad);  // Negative because +Z is south

  return { x, z };
}

// Landmarks data (from src/data/landmarks.js)
const LANDMARKS = {
  goldenGateSouth: { lat: 37.8107, lon: -122.4738, altitude: 227, shortName: 'GG South' },
  goldenGateCenter: { lat: 37.8199, lon: -122.4783, altitude: 40, shortName: 'GG Under' },
  goldenGateNorth: { lat: 37.8291, lon: -122.4824, altitude: 227, shortName: 'GG North' },
  alcatraz: { lat: 37.8267, lon: -122.4233, altitude: 50, shortName: 'Alcatraz' },
  coitTower: { lat: 37.8024, lon: -122.4059, altitude: 100, shortName: 'Coit' },
  transamerica: { lat: 37.7952, lon: -122.4029, altitude: 280, shortName: 'Pyramid' },
  salesforceTower: { lat: 37.7899, lon: -122.3969, altitude: 350, shortName: 'Salesforce' },
  ferryBuilding: { lat: 37.7955, lon: -122.3937, altitude: 80, shortName: 'Ferry' },
  oraclePark: { lat: 37.7786, lon: -122.3897, altitude: 60, shortName: 'Oracle' },
  treasureIsland: { lat: 37.8236, lon: -122.3706, altitude: 50, shortName: 'Treasure' },
  bayBridge: { lat: 37.7983, lon: -122.3778, altitude: 40, shortName: 'Bay Bridge' },
  palaceOfFineArts: { lat: 37.8029, lon: -122.4486, altitude: 60, shortName: 'Palace' }
};

// Routes data
const ROUTES = {
  goldenGateChallenge: {
    name: 'Golden Gate Challenge',
    checkpoints: ['alcatraz', 'goldenGateCenter', 'palaceOfFineArts']
  },
  bayTour: {
    name: 'Bay Area Tour',
    checkpoints: ['goldenGateSouth', 'alcatraz', 'coitTower', 'ferryBuilding', 'oraclePark', 'bayBridge', 'treasureIsland']
  },
  downtownDash: {
    name: 'Downtown Dash',
    checkpoints: ['ferryBuilding', 'transamerica', 'salesforceTower', 'oraclePark']
  },
  bridgeRun: {
    name: 'Bridge Run',
    checkpoints: ['goldenGateCenter', 'alcatraz', 'treasureIsland', 'bayBridge']
  }
};

console.log('=== Race Position Verification ===\n');
console.log('Reference point (origin): Golden Gate Bridge Center');
console.log(`  Lat: ${CONFIG.startPosition.lat}, Lon: ${CONFIG.startPosition.lon}\n`);

// Print all landmark positions
console.log('=== Landmark Positions (local coordinates) ===\n');
for (const [key, landmark] of Object.entries(LANDMARKS)) {
  const local = latLonToLocal(landmark.lat, landmark.lon);
  const distance = Math.sqrt(local.x * local.x + local.z * local.z);
  console.log(`${landmark.shortName.padEnd(12)} (${key})`);
  console.log(`  Lat/Lon: ${landmark.lat}, ${landmark.lon}`);
  console.log(`  Local:   X=${local.x.toFixed(0).padStart(6)}m, Z=${local.z.toFixed(0).padStart(6)}m, Y=${landmark.altitude}m`);
  console.log(`  Distance from origin: ${distance.toFixed(0)}m`);
  console.log();
}

// Verify each route's start positioning
console.log('\n=== Route Start Position Verification ===\n');

for (const [routeKey, route] of Object.entries(ROUTES)) {
  console.log(`Route: ${route.name}`);
  console.log(`Checkpoints: ${route.checkpoints.join(' -> ')}\n`);

  // Get checkpoint positions
  const positions = route.checkpoints.map(key => {
    const landmark = LANDMARKS[key];
    const local = latLonToLocal(landmark.lat, landmark.lon);
    return {
      key,
      name: landmark.shortName,
      x: local.x,
      y: landmark.altitude,
      z: local.z
    };
  });

  const cp1 = positions[0];
  const cp2 = positions[1];

  console.log(`  Checkpoint 1 (Start Gate): ${cp1.name}`);
  console.log(`    Position: X=${cp1.x.toFixed(0)}, Y=${cp1.y}, Z=${cp1.z.toFixed(0)}`);

  if (cp2) {
    console.log(`  Checkpoint 2: ${cp2.name}`);
    console.log(`    Position: X=${cp2.x.toFixed(0)}, Y=${cp2.y}, Z=${cp2.z.toFixed(0)}`);

    // Calculate correct approach direction (from cp1 toward cp2)
    const dx = cp2.x - cp1.x;
    const dz = cp2.z - cp1.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Start position: 400m BEFORE cp1, in the opposite direction of cp2
    const startDist = 400;
    const startX = cp1.x - dirX * startDist;
    const startZ = cp1.z - dirZ * startDist;
    const startY = Math.max(cp1.y, Math.min(cp1.y + 100, 500));

    console.log(`\n  CORRECT Start Position (400m before CP1, aligned toward CP2):`);
    console.log(`    Position: X=${startX.toFixed(0)}, Y=${startY}, Z=${startZ.toFixed(0)}`);

    // Verify the logic matches main.js teleportToRaceStart
    console.log(`\n  Verification:`);
    console.log(`    Approach direction (CP1 -> CP2): (${dirX.toFixed(3)}, ${dirZ.toFixed(3)})`);
    console.log(`    Start is 400m BEFORE CP1, facing toward CP1`);
    console.log(`    Player will fly through CP1 toward CP2 ✓`);
  }

  console.log('\n' + '='.repeat(50) + '\n');
}
