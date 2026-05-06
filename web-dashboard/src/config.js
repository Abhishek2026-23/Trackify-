// Production backend runs on 5001. Simple-app demo runs on 5000.
// Set REACT_APP_API_URL / REACT_APP_SOCKET_URL in .env to override.
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

export const MAP_CONFIG = {
  center: [30.7333, 76.7794], // Chandigarh
  zoom: 13,
  minZoom: 10,
  maxZoom: 18,
};

export const UPDATE_INTERVAL = 5000; // 5 seconds
