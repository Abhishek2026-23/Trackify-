class UserModel {
  final dynamic id; // int from production API
  final String name;
  final String phone;
  final String? email;
  final String userType; // 'commuter' | 'driver' | 'operator' | 'admin'
  final Map<String, dynamic>? driverProfile;

  UserModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    required this.userType,
    this.driverProfile,
  });

  factory UserModel.fromJson(Map<String, dynamic> j) => UserModel(
    id: j['id'],
    name: j['name'] ?? '',
    phone: j['phone'] ?? '',
    email: j['email'],
    userType: j['user_type'] ?? j['role'] ?? 'commuter',
    driverProfile: j['driverProfile'] as Map<String, dynamic>?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'email': email,
    'user_type': userType,
    'driverProfile': driverProfile,
  };

  bool get isDriver => userType == 'driver';
  bool get isAdmin => userType == 'admin';
  bool get isOperator => userType == 'operator' || userType == 'admin';

  String? get vehicleNumber => driverProfile?['vehicle_number'];
  String? get vehicleType => driverProfile?['vehicle_type'];
  String? get driverId => driverProfile?['id']?.toString();
}
