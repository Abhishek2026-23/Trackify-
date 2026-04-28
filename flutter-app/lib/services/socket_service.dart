import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../utils/constants.dart';
import '../models/driver_model.dart';
import 'api_service.dart';

class SocketService {
  static io.Socket? _socket;

  static Future<void> connect() async {
    final token = await ApiService.getToken();

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()
          .setAuth({'token': token ?? ''})
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket!.connect();
    _socket!.onConnect((_) => debugPrint('✓ Socket connected'));
    _socket!.onDisconnect((_) => debugPrint('Socket disconnected'));
    _socket!.onConnectError((e) => debugPrint('Socket connect error: $e'));
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  static void joinRoute(int routeId) {
    _socket?.emit('join_route', {'route_id': routeId});
  }

  static void leaveRoute(int routeId) {
    _socket?.emit('leave_route', {'route_id': routeId});
  }

  // Driver location updates (passenger listens)
  static void onDriverLocationUpdate(Function(DriverModel) callback) {
    _socket?.on('driver_location_update', (data) {
      try {
        callback(DriverModel.fromJson(Map<String, dynamic>.from(data)));
      } catch (_) {}
    });
  }

  // Driver goes offline
  static void onDriverOffline(Function(String) callback) {
    _socket?.on('driver_offline', (data) {
      final id = data['driverId']?.toString() ?? data['bus_id']?.toString() ?? '';
      callback(id);
    });
  }

  // Passenger location updates (driver listens)
  static void onPassengerLocationUpdate(Function(Map<String, dynamic>) callback) {
    _socket?.on('passenger_location_update', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // Passenger goes offline
  static void onPassengerOffline(Function(String) callback) {
    _socket?.on('passenger_offline', (data) {
      callback(data['userId']?.toString() ?? '');
    });
  }

  // New alert
  static void onNewAlert(Function(Map<String, dynamic>) callback) {
    _socket?.on('new_alert', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // Driver status update
  static void emitDriverStatus(String driverId, bool isAvailable) {
    _socket?.emit('driver_status_update', {
      'driverId': driverId,
      'isAvailable': isAvailable,
    });
  }

  static bool get isConnected => _socket?.connected ?? false;
}
