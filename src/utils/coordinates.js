import * as THREE from 'three';

/**
 * Convert latitude, longitude, and altitude to Cartesian coordinates
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} altitude - Altitude in meters
 * @param {Object} ellipsoid - WGS84 ellipsoid from TilesRenderer
 * @returns {THREE.Vector3} Position in Cartesian coordinates
 */
export function latLonAltToCartesian(lat, lon, altitude, ellipsoid) {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const position = new THREE.Vector3();
  ellipsoid.getCartographicToPosition(latRad, lonRad, altitude, position);
  return position;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} radians
 */
export function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}
