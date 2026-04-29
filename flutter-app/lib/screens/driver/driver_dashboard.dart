import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/app_theme.dart';
import '../role_selection_screen.dart';

class DriverDashboard extends StatefulWidget {
  const DriverDashboard({super.key});
  @override
  State<DriverDashboard> createState() => _DriverDashboardState();
}

class _DriverDashboardState extends State<DriverDashboard> {
  bool _isAvailable = false;
  final _mapCtrl = MapController();

  @override
  void initState() {
    super.initState();
    context.read<LocationProvider>().getCurrentLocation();
  }

  void _toggleAvailability() {
    final loc = context.read<LocationProvider>();
    final user = context.read<AuthProvider>().user!;
    setState(() => _isAvailable = !_isAvailable);
    if (_isAvailable) {
      loc.startTracking(user.driverId!, true);
    } else {
      loc.stopTracking();
    }
  }

  List<LatLng> _buildCircle(LatLng center, double radiusKm,
      {int points = 64}) {
    const earthRadius = 6371.0;
    final lat = center.latitude * math.pi / 180;
    final lng = center.longitude * math.pi / 180;
    final d = radiusKm / earthRadius;
    return List.generate(points + 1, (i) {
      final angle = 2 * math.pi * i / points;
      final pLat = math.asin(math.sin(lat) * math.cos(d) +
          math.cos(lat) * math.sin(d) * math.cos(angle));
      final pLng = lng +
          math.atan2(math.sin(angle) * math.sin(d) * math.cos(lat),
              math.cos(d) - math.sin(lat) * math.sin(pLat));
      return LatLng(pLat * 180 / math.pi, pLng * 180 / math.pi);
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user!;
    final loc  = context.watch<LocationProvider>();
    final pos  = loc.currentPosition;

    // Auto-center map when position updates
    if (pos != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 15);
        } catch (_) {}
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Dashboard'),
        actions: [
          // Quick availability toggle in app bar
          IconButton(
            tooltip: _isAvailable ? 'Go Offline' : 'Go Online',
            icon: Icon(
              _isAvailable ? Icons.wifi : Icons.wifi_off,
              color: _isAvailable ? AppTheme.accent : Colors.white70,
            ),
            onPressed: _toggleAvailability,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final navigator = Navigator.of(context);
              final auth = context.read<AuthProvider>();
              loc.stopTracking();
              await auth.logout();
              if (!mounted) return;
              navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                      builder: (_) => const RoleSelectionScreen()),
                  (_) => false);
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Full-screen map ──────────────────────────────────
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: pos != null
                  ? LatLng(pos.latitude, pos.longitude)
                  : const LatLng(30.7333, 76.7794),
              initialZoom: 15,
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.bustracking.app',
              ),
              // 1 km radius circle
              if (pos != null)
                PolygonLayer(
                  polygons: [
                    Polygon(
                      points: _buildCircle(
                          LatLng(pos.latitude, pos.longitude), 1.0),
                      color: (_isAvailable ? AppTheme.accent : AppTheme.primary)
                          .withValues(alpha: 0.08),
                      borderColor:
                          (_isAvailable ? AppTheme.accent : AppTheme.primary)
                              .withValues(alpha: 0.5),
                      borderStrokeWidth: 1.5,
                    ),
                  ],
                ),
              // Driver marker
              if (pos != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(pos.latitude, pos.longitude),
                    width: 52,
                    height: 52,
                    child: Container(
                      decoration: BoxDecoration(
                        color: _isAvailable
                            ? AppTheme.accent
                            : Colors.grey.shade600,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: const [
                          BoxShadow(color: Colors.black26, blurRadius: 8)
                        ],
                      ),
                      child: const Icon(Icons.directions_bus,
                          color: Colors.white, size: 26),
                    ),
                  ),
                ]),
            ],
          ),

          // ── Side panel buttons ───────────────────────────────
          Positioned(
            top: 16,
            right: 12,
            child: Column(children: [
              // Big availability toggle
              GestureDetector(
                onTap: _toggleAvailability,
                child: Container(
                  width: 60,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: _isAvailable ? AppTheme.accent : Colors.grey.shade700,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Colors.black26,
                          blurRadius: 6,
                          offset: Offset(0, 3))
                    ],
                  ),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(
                      _isAvailable ? Icons.wifi : Icons.wifi_off,
                      color: Colors.white,
                      size: 26,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isAvailable ? 'Online' : 'Offline',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
              // Center map
              _SideBtn(
                icon: Icons.my_location,
                onTap: () {
                  if (pos != null) {
                    _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 15);
                  }
                },
              ),
            ]),
          ),

          // ── Bottom info panel ────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(color: Colors.black12, blurRadius: 12)
                ],
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                // Handle bar
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                // Driver name + status
                Row(children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: (_isAvailable
                              ? AppTheme.accent
                              : Colors.grey.shade400)
                          .withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.directions_bus,
                        color: _isAvailable
                            ? AppTheme.accent
                            : Colors.grey.shade500,
                        size: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user.name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            '${user.vehicleType?.toUpperCase() ?? 'BUS'} • ${user.vehicleNumber ?? '-'}',
                            style: TextStyle(
                                color: Colors.grey.shade600, fontSize: 13),
                          ),
                        ]),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: _isAvailable ? AppTheme.accent : Colors.grey,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _isAvailable ? '● Online' : '● Offline',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12),
                    ),
                  ),
                ]),
                const SizedBox(height: 14),
                // Stats row
                Row(children: [
                  _StatChip(
                    icon: '⚡',
                    label: 'Speed',
                    value: pos != null
                        ? '${(pos.speed * 3.6).toStringAsFixed(0)} km/h'
                        : '0 km/h',
                  ),
                  const SizedBox(width: 8),
                  _StatChip(
                    icon: '📍',
                    label: 'GPS',
                    value: pos != null ? 'Active' : 'Waiting',
                  ),
                  const SizedBox(width: 8),
                  _StatChip(
                    icon: '🎯',
                    label: 'Accuracy',
                    value: pos != null
                        ? '${pos.accuracy.toStringAsFixed(0)} m'
                        : '-',
                  ),
                ]),
                const SizedBox(height: 14),
                // Big toggle button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          _isAvailable ? AppTheme.danger : AppTheme.accent,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: Icon(
                        _isAvailable ? Icons.stop_circle : Icons.play_circle),
                    label: Text(
                      _isAvailable
                          ? 'Stop — Go Offline'
                          : 'Go Online — Start Tracking',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    onPressed: _toggleAvailability,
                  ),
                ),
                if (_isAvailable) ...[
                  const SizedBox(height: 8),
                  const Text(
                    '📡 Broadcasting live location every 5 seconds',
                    style: TextStyle(
                        color: AppTheme.accent,
                        fontSize: 12,
                        fontWeight: FontWeight.w500),
                    textAlign: TextAlign.center,
                  ),
                ],
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _SideBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _SideBtn({required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [
            BoxShadow(color: Colors.black12, blurRadius: 4)
          ],
        ),
        child: Icon(icon, color: AppTheme.primary, size: 22),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String icon, label, value;
  const _StatChip(
      {required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(children: [
          Text(icon, style: const TextStyle(fontSize: 18)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 12)),
          Text(label,
              style: TextStyle(color: Colors.grey.shade500, fontSize: 10)),
        ]),
      ),
    );
  }
}
