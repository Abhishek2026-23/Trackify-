import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (phone, password) => api.post('/auth/login', { phone, password }),
  register: (data) => api.post('/auth/register', data),
};

export const routeAPI = {
  getAll: () => api.get('/routes'),
  getById: (id) => api.get(`/routes/${id}`),
};

export const busAPI = {
  getLive: (routeId) => api.get('/buses/live', { params: { route_id: routeId } }),
  getActive: () => api.get('/buses'),
};

export const etaAPI = {
  getStopETA: (stopId, tripId) => api.get(`/stops/${stopId}/eta`, { params: { trip_id: tripId } }),
};

export default api;
