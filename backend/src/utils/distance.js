const { getDistance, getSpeed } = require('geolib');

// Calculate distance between two coordinates in meters
const calculateDistance = (coord1, coord2) => {
  return getDistance(
    { latitude: coord1.lat, longitude: coord1.lng },
    { latitude: coord2.lat, longitude: coord2.lng }
  );
};

// Calculate ETA based on distance and speed
const calculateETA = (distanceMeters, speedKmh) => {
  if (speedKmh === 0) speedKmh = 30; // Default city speed
  const timeHours = (distanceMeters / 1000) / speedKmh;
  return Math.round(timeHours * 60); // Convert to minutes
};

// Check if bus is near a stop (within 100 meters)
const isNearStop = (busLocation, stopLocation, thresholdMeters = 100) => {
  const distance = calculateDistance(busLocation, stopLocation);
  return distance <= thresholdMeters;
};

module.exports = {
  calculateDistance,
  calculateETA,
  isNearStop,
};
