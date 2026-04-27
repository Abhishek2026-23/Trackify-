import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../models/driver_model.dart';

class ApiService {
  static final _client = http.Client();

  // ── Token management ──────────────────────────────────────────
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  static Future<void> saveTokens(String token, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
    await prefs.setString('refresh_token', refreshToken);
  }

  static Future<void> clearTokens() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('refresh_token');
  }

  static Future<Map<String, String>> get _authHeaders async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // ── Auth ──────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> register(Map<String, dynamic> data) async {
    final res = await _client.post(
      Uri.parse('${AppConstants.baseUrl}${AppConstants.register}'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>> login(Map<String, dynamic> data) async {
    final res = await _client.post(
      Uri.parse('${AppConstants.baseUrl}${AppConstants.login}'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode == 200 && body['token'] != null) {
      await saveTokens(body['token'], body['refreshToken'] ?? '');
    }
    return body;
  }

  static Future<bool> refreshAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString('refresh_token');
    if (refreshToken == null) return false;

    final res = await _client.post(
      Uri.parse('${AppConstants.baseUrl}${AppConstants.refreshToken}'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body);
      await saveTokens(body['token'], body['refreshToken']);
      return true;
    }
    return false;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString('refresh_token');
    final headers = await _authHeaders;
    try {
      await _client.post(
        Uri.parse('${AppConstants.baseUrl}${AppConstants.logout}'),
        headers: headers,
        body: jsonEncode({'refreshToken': refreshToken}),
      );
    } catch (_) {}
    await clearTokens();
  }

  // ── Location ──────────────────────────────────────────────────
  static Future<void> updateDriverLocation({
    required String driverId,
    required double lat,
    required double lng,
    required double speed,
    required bool isAvailable,
  }) async {
    try {
      final headers = await _authHeaders;
      await _client.post(
        Uri.parse('${AppConstants.baseUrl}${AppConstants.locationUpdate}'),
        headers: headers,
        body: jsonEncode({
          'driverId': driverId,
          'latitude': lat,
          'longitude': lng,
          'speed': speed,
          'isAvailable': isAvailable,
        }),
      );
    } catch (_) {}
  }

  static Future<void> updatePassengerLocation({
    required String userId,
    required double lat,
    required double lng,
  }) async {
    try {
      final headers = await _authHeaders;
      await _client.post(
        Uri.parse('${AppConstants.baseUrl}${AppConstants.passengerLocation}'),
        headers: headers,
        body: jsonEncode({'userId': userId, 'latitude': lat, 'longitude': lng}),
      );
    } catch (_) {}
  }

  static Future<void> goOffline({String? driverId, String? userId}) async {
    try {
      if (driverId != null) {
        await _client.post(
          Uri.parse('${AppConstants.baseUrl}${AppConstants.driverOffline}'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'driverId': driverId}),
        );
      }
      if (userId != null) {
        await _client.post(
          Uri.parse('${AppConstants.baseUrl}${AppConstants.passengerOffline}'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'userId': userId}),
        );
      }
    } catch (_) {}
  }

  // ── Nearby drivers ────────────────────────────────────────────
  static Future<List<DriverModel>> getNearbyDrivers({
    required double lat,
    required double lng,
    String? vehicleType,
    double radius = AppConstants.nearbyRadiusKm,
  }) async {
    final params = {
      'lat': lat.toString(),
      'lng': lng.toString(),
      'radius': radius.toString(),
      if (vehicleType != null && vehicleType != 'all') 'vehicleType': vehicleType,
    };
    final uri = Uri.parse('${AppConstants.baseUrl}${AppConstants.nearbyDrivers}')
        .replace(queryParameters: params);
    final res = await _client.get(uri);
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    return (data['drivers'] as List? ?? [])
        .map((d) => DriverModel.fromJson(d))
        .toList();
  }

  // ── Routes ────────────────────────────────────────────────────
  static Future<List<dynamic>> getRoutes() async {
    final res = await _client.get(
      Uri.parse('${AppConstants.baseUrl}${AppConstants.routes}'),
    );
    if (res.statusCode != 200) return [];
    final data = jsonDecode(res.body);
    return data['routes'] as List? ?? [];
  }

  // ── Health check ──────────────────────────────────────────────
  static Future<bool> checkHealth() async {
    try {
      final res = await _client
          .get(Uri.parse('${AppConstants.baseUrl}${AppConstants.health}'))
          .timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
