import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../utils/constants.dart';
import '../models/driver_model.dart';
import 'api_service.dart';

class SocketService {
  static io.Socket? _socket;

  // Connect and register all listeners before calling connect()
  // so no events are missed during the handshake.
  static Future<void> connect() async {
    // Already connected — don't create a second socket
    if (_socket != null && _socket!.connected) return;

    final token = await ApiService.getToken();

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .disableAutoConnect()          // we call connect() manually below
          .setAuth({'token': token ?? ''})
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );

    _socket!.onConnect((_) => debugPrint('✓ Socket connected: ${_socket!.id}'));
    _socket!.onDisconnect((reason) => debugPrint('Socket disconnected: $reason'));
    _socket!.onConnectError((e) => debugPrint('Socket connect error: $e'));
    _socket!.onError((e) => debugPrint('Socket error: $e'));

    _socket!.connect();
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  // Join a route room — backend expects a plain routeId string/number
  static void joinRoute(dynamic routeId) {
    _socket?.emit('join_route', routeId);
  }

  static void leaveRoute(dynamic routeId) {
    _socket?.emit('leave_route', routeId);
  }

  // ── Passenger listens: driver location updates ────────────────
  static void onDriverLocationUpdate(Function(DriverModel) callback) {
    _socket?.on('driver_location_update', (data) {
      try {
        final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
        callback(DriverModel.fromJson(map));
      } catch (e) {
        debugPrint('driver_location_update parse error: $e');
      }
    });
  }

  // ── Passenger listens: driver went offline ────────────────────
  static void onDriverOffline(Function(String) callback) {
    _socket?.on('driver_offline', (data) {
      final id = data is Map
          ? (data['driverId']?.toString() ?? data['bus_id']?.toString() ?? '')
          : '';
      callback(id);
    });
  }

  // ── Driver listens: passenger location updates ────────────────
  static void onPassengerLocationUpdate(Function(Map<String, dynamic>) callback) {
    _socket?.on('passenger_location_update', (data) {
      try {
        callback(data is Map ? Map<String, dynamic>.from(data) : {});
      } catch (e) {
        debugPrint('passenger_location_update parse error: $e');
      }
    });
  }

  // ── Driver listens: passenger went offline ────────────────────
  static void onPassengerOffline(Function(String) callback) {
    _socket?.on('passenger_offline', (data) {
      final id = data is Map ? (data['userId']?.toString() ?? '') : '';
      callback(id);
    });
  }

  // ── New alert ─────────────────────────────────────────────────
  static void onNewAlert(Function(Map<String, dynamic>) callback) {
    _socket?.on('new_alert', (data) {
      try {
        callback(data is Map ? Map<String, dynamic>.from(data) : {});
      } catch (_) {}
    });
  }

  // ── Driver emits status ───────────────────────────────────────
  static void emitDriverStatus(String driverId, bool isAvailable) {
    _socket?.emit('driver_status_update', {
      'driverId': driverId,
      'isAvailable': isAvailable,
    });
  }

  static bool get isConnected => _socket?.connected ?? false;
}
