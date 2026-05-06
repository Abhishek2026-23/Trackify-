import 'dart:async';
import 'package:flutter/foundation.dart';
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
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return false;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return false;
      }
      if (permission == LocationPermission.deniedForever) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> getCurrentLocation() async {
    try {
      final granted = await requestPermission();
      if (!granted) return;

      // On web, getCurrentPosition can hang — use a 10s timeout
      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () => throw TimeoutException('GPS timeout'),
      );
      notifyListeners();
    } on TimeoutException {
      debugPrint('GPS timed out — map will use default center');
    } catch (e) {
      debugPrint('getCurrentLocation error: $e');
    }
  }

  // Start sending location to backend (passenger mode)
  void startPassengerTracking(String userId) {
    if (_isTracking) return;
    _isTracking = true;
    notifyListeners();

    // Send immediately, then on interval
    _sendPassengerLocation(userId);

    _timer = Timer.periodic(
      const Duration(seconds: AppConstants.locationIntervalSec),
      (_) => _sendPassengerLocation(userId),
    );
  }

  Future<void> _sendPassengerLocation(String userId) async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 8));
      _currentPosition = pos;
      await ApiService.updatePassengerLocation(
        userId: userId,
        lat: pos.latitude,
        lng: pos.longitude,
      );
      notifyListeners();
    } catch (e) {
      debugPrint('Passenger location send error: $e');
    }
  }

  // Start sending location to backend (driver mode)
  void startTracking(String driverId, bool isAvailable) {
    if (_isTracking) return;
    _isTracking = true;
    notifyListeners();

    // Send immediately, then on interval
    _sendDriverLocation(driverId, isAvailable);

    _timer = Timer.periodic(
      const Duration(seconds: AppConstants.locationIntervalSec),
      (_) => _sendDriverLocation(driverId, isAvailable),
    );
  }

  Future<void> _sendDriverLocation(String driverId, bool isAvailable) async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 8));
      _currentPosition = pos;
      await ApiService.updateDriverLocation(
        driverId: driverId,
        lat: pos.latitude,
        lng: pos.longitude,
        speed: (pos.speed * 3.6).clamp(0, 200), // m/s → km/h
        isAvailable: isAvailable,
      );
      notifyListeners();
    } catch (e) {
      debugPrint('Driver location send error: $e');
    }
  }

  void stopTracking() {
    _timer?.cancel();
    _isTracking = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
