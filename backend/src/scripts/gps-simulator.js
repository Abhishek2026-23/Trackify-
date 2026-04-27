require('dotenv').config();
const axios = require('axios');

// Simulate GPS data for testing
const API_URL = `http://localhost:${process.env.PORT}/api/v1`;

// Sample route coordinates (City Center to Railway Station)
const routeCoordinates = [
  { lat: 30.7333, lng: 76.7794 }, // City Center
  { lat: 30.7320, lng: 76.7810 },
  { lat: 30.7290, lng: 76.7850 }, // Sector 22
  { lat: 30.7250, lng: 76.7920 },
  { lat: 30.7200, lng: 76.8000 }, // ISBT 43
  { lat: 30.7180, lng: 76.8050 },
  { lat: 30.7150, lng: 76.8100 }, // Sector 35
  { lat: 30.7100, lng: 76.8150 },
  { lat: 30.7050, lng: 76.8200 }, // Railway Station
];

let currentIndex = 0;

const simulateGPS = async () => {
  try {
    const coord = routeCoordinates[currentIndex];
    
    const locationData = {
      trip_id: 1,
      bus_id: 1,
      latitude: coord.lat,
      longitude: coord.lng,
      speed: 35 + Math.random() * 10,
      heading: 90,
      accuracy: 5,
    };

    await axios.post(`${API_URL}/location/update`, locationData);
    console.log(`✓ Location updated: ${coord.lat}, ${coord.lng}`);

    currentIndex = (currentIndex + 1) % routeCoordinates.length;
  } catch (error) {
    console.error('GPS simulation error:', error.message);
  }
};

// Send GPS update every 5 seconds
setInterval(simulateGPS, 5000);
console.log('GPS Simulator started...');
