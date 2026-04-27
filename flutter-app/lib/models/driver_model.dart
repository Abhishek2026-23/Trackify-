class DriverModel {
  final String driverId;
  final String driverName;
  final String vehicleType;
  final String vehicleNumber;
  double latitude;
  double longitude;
  double speed;
  bool isAvailable;
  double? distanceKm;
  int? etaMinutes;
  String timestamp;

  DriverModel({
    required this.driverId,
    required this.driverName,
    required this.vehicleType,
    required this.vehicleNumber,
    required this.latitude,
    required this.longitude,
    this.speed = 0,
    this.isAvailable = true,
    this.distanceKm,
    this.etaMinutes,
    this.timestamp = '',
  });

  factory DriverModel.fromJson(Map<String, dynamic> j) => DriverModel(
    driverId:      j['driverId']?.toString() ?? j['driver_id']?.toString() ?? '',
    driverName:    j['driverName'] ?? j['driver_name'] ?? '',
    vehicleType:   j['vehicleType'] ?? j['vehicle_type'] ?? '',
    vehicleNumber: j['vehicleNumber'] ?? j['vehicle_number'] ?? '',
    latitude:      (j['latitude'] as num).toDouble(),
    longitude:     (j['longitude'] as num).toDouble(),
    speed:         (j['speed'] as num?)?.toDouble() ?? 0,
    isAvailable:   j['isAvailable'] ?? j['is_available'] ?? true,
    distanceKm:    (j['distance_km'] ?? j['distanceKm'] as num?)?.toDouble(),
    etaMinutes:    (j['eta_minutes'] ?? j['etaMinutes'] as num?)?.toInt(),
    timestamp:     j['timestamp'] ?? '',
  );

  String get vehicleIcon {
    switch (vehicleType) {
      case 'bus':    return '🚌';
      case 'minibus': return '🚐';
      case 'taxi':   return '🚕';
      default:       return '🚌';
    }
  }

  String get etaText {
    if (etaMinutes == null) return '—';
    if (etaMinutes! < 1) return '< 1 min';
    return '$etaMinutes min';
  }
}
