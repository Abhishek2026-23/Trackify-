class AppConstants {
  // ── Production backend (Render) ───────────────────────────────
  static const String baseUrl   = 'https://trackify-zwup.onrender.com/api/v1';
  static const String socketUrl = 'https://trackify-zwup.onrender.com';

  // ── Local development (uncomment when running locally) ────────
  // static const String baseUrl   = 'http://localhost:5001/api/v1';
  // static const String socketUrl = 'http://localhost:5001';

  // ── Android emulator (uncomment for emulator testing) ─────────
  // static const String baseUrl   = 'http://10.0.2.2:5001/api/v1';
  // static const String socketUrl = 'http://10.0.2.2:5001';

  // Auth endpoints
  static const String register      = '/auth/register';
  static const String login         = '/auth/login';
  static const String refreshToken  = '/auth/refresh';
  static const String logout        = '/auth/logout';

  // Location endpoints
  static const String locationUpdate       = '/location/update';
  static const String passengerLocation    = '/location/passenger';
  static const String driverOffline        = '/location/offline';
  static const String passengerOffline     = '/location/passenger/offline';
  static const String nearbyDrivers        = '/drivers/nearby';
  static const String liveBuses            = '/buses/live';

  // Route endpoints
  static const String routes = '/routes';

  // Trip endpoints
  static const String trips = '/trips';

  // Alert endpoints
  static const String alerts = '/alerts';

  // Health
  static const String health = '/health';

  // Config
  static const double nearbyRadiusKm      = 5.0;
  static const int    locationIntervalSec = 5;
}
