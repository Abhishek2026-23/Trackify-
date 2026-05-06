import 'package:flutter/material.dart';
import '../models/driver_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class DriverProvider extends ChangeNotifier {
  final Map<String, DriverModel> _drivers = {};
  // 'all' by default so every vehicle type shows up on the map
  String _filter = 'all';
  bool _loading = false;

  List<DriverModel> get drivers => _drivers.values.toList()
    ..sort((a, b) => (a.distanceKm ?? 99).compareTo(b.distanceKm ?? 99));

  List<DriverModel> get filteredDrivers => _filter == 'all'
      ? drivers
      : drivers.where((d) => d.vehicleType == _filter).toList();

  String get filter => _filter;
  bool get loading => _loading;

  void init() {
    SocketService.connect().then((_) {
      // Real-time driver location updates
      SocketService.onDriverLocationUpdate((driver) {
        _drivers[driver.driverId] = driver;
        notifyListeners();
      });

      // Remove driver marker when they go offline
      SocketService.onDriverOffline((driverId) {
        _drivers.remove(driverId);
        notifyListeners();
      });
    });
  }

  void setFilter(String f) {
    _filter = f;
    notifyListeners();
  }

  Future<void> fetchNearby(double lat, double lng) async {
    _loading = true;
    notifyListeners();
    try {
      final list = await ApiService.getNearbyDrivers(
        lat: lat,
        lng: lng,
        // Pass null so we get all vehicle types, not just 'bus'
        vehicleType: _filter == 'all' ? null : _filter,
      );
      _drivers.clear();
      for (final d in list) {
        _drivers[d.driverId] = d;
      }
    } catch (e) {
      debugPrint('fetchNearby error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    SocketService.disconnect();
    super.dispose();
  }
}
