import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _loading = false;
  String? _error;

  UserModel? get user => _user;
  bool get loading => _loading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;

  AuthProvider() {
    _loadFromPrefs();
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString('user');
    if (data != null) {
      try {
        _user = UserModel.fromJson(jsonDecode(data));
        notifyListeners();
      } catch (_) {
        await prefs.remove('user');
      }
    }
  }

  Future<bool> register(Map<String, dynamic> data) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiService.register(data);
      if (res['error'] != null) {
        _error = res['error'];
        return false;
      }
      return true;
    } catch (e) {
      _error = 'Connection failed. Make sure the server is running.';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> login(Map<String, dynamic> data) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await ApiService.login(data);
      if (res['error'] != null) {
        _error = res['error'];
        return false;
      }
      _user = UserModel.fromJson(res['user'] as Map<String, dynamic>);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(_user!.toJson()));
      return true;
    } catch (e) {
      _error = 'Connection failed. Make sure the server is running.';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    if (_user != null) {
      // Notify server to remove live location
      await ApiService.goOffline(
        driverId: _user!.isDriver ? _user!.id.toString() : null,
        userId: !_user!.isDriver ? _user!.id.toString() : null,
      );
      await ApiService.logout();
    }
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user');
    notifyListeners();
  }
}
