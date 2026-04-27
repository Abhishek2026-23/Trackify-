import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
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

  onLocationUpdate(callback) {
    if (this.socket) {
      this.socket.on('bus_location_update', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export default new SocketService();
