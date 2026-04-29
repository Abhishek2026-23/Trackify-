import 'dart:async';
import 'package:flutter/material.dart';
import '../models/driver_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class DriverProvider extends ChangeNotifier {
  final Map<String, DriverModel> _drivers = {};
  String _filter = 'bus'; // default to bus only
  bool _loading = false;

  List<DriverModel> get drivers => _drivers.values.toList()
    ..sort((a, b) => (a.distanceKm ?? 99).compareTo(b.distanceKm ?? 99));

  List<DriverModel> get filteredDrivers => _filter == 'all'
      ? drivers
      : drivers.where((d) => d.vehicleType == _filter).toList();

  String get filter => _filter;
  bool get loading => _loading;

  void init() {
    SocketService.connect();
    SocketService.onDriverLocationUpdate((driver) {
      _drivers[driver.driverId] = driver;
      notifyListeners();
    });
  }

  void setFilter(String f) { _filter = f; notifyListeners(); }

  Future<void> fetchNearby(double lat, double lng) async {
    _loading = true; notifyListeners();
    try {
      final list = await ApiService.getNearbyDrivers(
        lat: lat, lng: lng,
        vehicleType: _filter == 'all' ? null : _filter,
      );
      _drivers.clear();
      for (final d in list) { _drivers[d.driverId] = d; }
    } catch (_) {} finally {
      _loading = false; notifyListeners();
    }
  }

  @override
  void dispose() { SocketService.disconnect(); super.dispose(); }
}
