import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class LocationProvider extends ChangeNotifier {
  Position? _currentPosition;
  bool _isTracking = false;
  Timer? _timer;

  Position? get currentPosition => _currentPosition;
  bool get isTracking => _isTracking;

  // Request permission and get current location
  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  Future<void> getCurrentLocation() async {
    final granted = await requestPermission();
    if (!granted) return;
    _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
    notifyListeners();
  }

  // Start sending location to backend (driver mode)
  void startTracking(String driverId, bool isAvailable) {
    if (_isTracking) return;
    _isTracking = true;
    notifyListeners();

    _timer = Timer.periodic(
      const Duration(seconds: AppConstants.locationIntervalSec),
      (_) async {
        try {
          _currentPosition = await Geolocator.getCurrentPosition(
              desiredAccuracy: LocationAccuracy.high);
          await ApiService.updateDriverLocation(
            driverId: driverId,
            lat: _currentPosition!.latitude,
            lng: _currentPosition!.longitude,
            speed: (_currentPosition!.speed * 3.6).clamp(0, 200), // m/s → km/h
            isAvailable: isAvailable,
          );
          notifyListeners();
        } catch (_) {}
      },
    );
  }

  void stopTracking() {
    _timer?.cancel();
    _isTracking = false;
    notifyListeners();
  }

  @override
  void dispose() { _timer?.cancel(); super.dispose(); }
}
