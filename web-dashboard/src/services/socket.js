import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    const token = localStorage.getItem('token');
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    return this.socket;
  }

  joinRoute(routeId) {
    if (this.socket) {
      this.socket.emit('join_route', routeId);
    }
  }

  leaveRoute(routeId) {
    if (this.socket) {
      this.socket.emit('leave_route', routeId);
    }
  }

  // Listens for driver/bus location updates from the production backend
  onLocationUpdate(callback) {
    if (this.socket) {
      // Production backend emits 'driver_location_update'
      this.socket.on('driver_location_update', callback);
      // Also handle the legacy event name from simple-app (port 5000)
      this.socket.on('bus_location_update', callback);
    }
  }

  onDriverOffline(callback) {
    if (this.socket) {
      this.socket.on('driver_offline', callback);
    }
  }

  onPassengerOffline(callback) {
    if (this.socket) {
      this.socket.on('passenger_offline', callback);
    }
  }

  onAlert(callback) {
    if (this.socket) {
      this.socket.on('new_alert', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
