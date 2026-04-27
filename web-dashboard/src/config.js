export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const MAP_CONFIG = {
  center: [30.7333, 76.7794], // Chandigarh
  zoom: 13,
  minZoom: 10,
  maxZoom: 18,
};

export const UPDATE_INTERVAL = 5000; // 5 seconds
