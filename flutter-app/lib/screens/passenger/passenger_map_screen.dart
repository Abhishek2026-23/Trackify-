import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../models/driver_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/driver_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/app_theme.dart';
import '../role_selection_screen.dart';
import 'nearby_drivers_screen.dart';

class PassengerMapScreen extends StatefulWidget {
  const PassengerMapScreen({super.key});
  @override
  State<PassengerMapScreen> createState() => _PassengerMapScreenState();
}

class _PassengerMapScreenState extends State<PassengerMapScreen> {
  final _mapCtrl = MapController();
  DriverModel? _selected;
  bool _isOnline = false; // passenger availability toggle

  @override
  void initState() {
    super.initState();
    context.read<DriverProvider>().init();
    _initLocation();
  }

  Future<void> _initLocation() async {
    final loc = context.read<LocationProvider>();
    await loc.getCurrentLocation();
    if (!mounted) return;
    final pos = loc.currentPosition;
    if (pos != null) {
      _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 14);
      context.read<DriverProvider>().fetchNearby(pos.latitude, pos.longitude);
    }
  }

  /// Build a circle polygon with [points] vertices around [center] with [radiusKm]
  List<LatLng> _buildCircle(LatLng center, double radiusKm, {int points = 64}) {
    const earthRadius = 6371.0;
    final lat = center.latitude * math.pi / 180;
    final lng = center.longitude * math.pi / 180;
    final d = radiusKm / earthRadius;
    return List.generate(points + 1, (i) {
      final angle = 2 * math.pi * i / points;
      final pLat = math.asin(
          math.sin(lat) * math.cos(d) + math.cos(lat) * math.sin(d) * math.cos(angle));
      final pLng = lng +
          math.atan2(math.sin(angle) * math.sin(d) * math.cos(lat),
              math.cos(d) - math.sin(lat) * math.sin(pLat));
      return LatLng(pLat * 180 / math.pi, pLng * 180 / math.pi);
    });
  }

  @override
  Widget build(BuildContext context) {
    final loc     = context.watch<LocationProvider>();
    final drivers = context.watch<DriverProvider>();
    final pos     = loc.currentPosition;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby Buses'),
        actions: [
          IconButton(icon: const Icon(Icons.list), onPressed: () =>
              Navigator.push(context, MaterialPageRoute(
                  builder: (_) => const NearbyDriversScreen()))),
          IconButton(icon: const Icon(Icons.logout), onPressed: () async {
            final navigator = Navigator.of(context);
            await context.read<AuthProvider>().logout();
            if (!mounted) return;
            navigator.pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
                (_) => false);
          }),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: const LatLng(30.7333, 76.7794),
              initialZoom: 14,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.bustracking.app',
              ),
              // 1 km radius circle
              if (pos != null)
                PolygonLayer(
                  polygons: [
                    Polygon(
                      points: _buildCircle(
                          LatLng(pos.latitude, pos.longitude), 1.0),
                      color: AppTheme.primary.withValues(alpha: 0.08),
                      borderColor: AppTheme.primary.withValues(alpha: 0.5),
                      borderStrokeWidth: 1.5,
                    ),
                  ],
                ),
              // Passenger location marker
              if (pos != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(pos.latitude, pos.longitude),
                    width: 44, height: 44,
                    child: Container(
                      decoration: BoxDecoration(
                        color: _isOnline ? AppTheme.accent : AppTheme.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: const [BoxShadow(
                            color: Colors.black26, blurRadius: 6)],
                      ),
                      child: const Icon(Icons.person,
                          color: Colors.white, size: 24),
                    ),
                  ),
                ]),
              // Bus markers
              MarkerLayer(
                markers: drivers.filteredDrivers
                    .where((d) => d.isAvailable)
                    .map((d) => Marker(
                          point: LatLng(d.latitude, d.longitude),
                          width: 48, height: 48,
                          child: GestureDetector(
                            onTap: () => setState(() => _selected = d),
                            child: Container(
                              decoration: BoxDecoration(
                                color: _selected?.driverId == d.driverId
                                    ? AppTheme.secondary
                                    : AppTheme.primary,
                                shape: BoxShape.circle,
                                boxShadow: const [BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 4,
                                    offset: Offset(0, 2))],
                              ),
                              child: Center(
                                child: Text(d.vehicleIcon,
                                    style: const TextStyle(fontSize: 24)),
                              ),
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ],
          ),

          // ── Side panel: Passenger availability toggle ──────────
          Positioned(
            top: 80,
            right: 12,
            child: Column(children: [
              _SideButton(
                icon: _isOnline ? Icons.wifi : Icons.wifi_off,
                label: _isOnline ? 'Online' : 'Offline',
                color: _isOnline ? AppTheme.accent : Colors.grey.shade600,
                onTap: () {
                  setState(() => _isOnline = !_isOnline);
                  final user = context.read<AuthProvider>().user;
                  if (user != null) {
                    if (_isOnline) {
                      context.read<LocationProvider>()
                          .startPassengerTracking(user.id.toString());
                    } else {
                      context.read<LocationProvider>().stopTracking();
                    }
                  }
                },
              ),
              const SizedBox(height: 8),
              _SideButton(
                icon: Icons.my_location,
                label: 'Center',
                color: AppTheme.primary,
                onTap: () {
                  if (pos != null) {
                    _mapCtrl.move(LatLng(pos.latitude, pos.longitude), 14);
                  }
                },
              ),
              const SizedBox(height: 8),
              _SideButton(
                icon: Icons.refresh,
                label: 'Refresh',
                color: AppTheme.primary,
                onTap: () {
                  if (pos != null) {
                    drivers.fetchNearby(pos.latitude, pos.longitude);
                  }
                },
              ),
            ]),
          ),

          // ── Selected driver info card ──────────────────────────
          if (_selected != null)
            Positioned(
              bottom: 20, left: 16, right: 72,
              child: _DriverCard(
                  driver: _selected!,
                  onClose: () => setState(() => _selected = null)),
            ),

          // ── Bus count badge ────────────────────────────────────
          Positioned(
            top: 12, left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [BoxShadow(
                    color: Colors.black12, blurRadius: 4)],
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Text('🚌', style: TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  '${drivers.filteredDrivers.where((d) => d.isAvailable).length} buses nearby',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Reusable side panel button ─────────────────────────────────────
class _SideButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _SideButton(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))
          ],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  fontSize: 9, color: color, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

// ── Driver info card ───────────────────────────────────────────────
class _DriverCard extends StatelessWidget {
  final DriverModel driver;
  final VoidCallback onClose;
  const _DriverCard({required this.driver, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Text(driver.vehicleIcon, style: const TextStyle(fontSize: 36)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.driverName,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    Text(
                        '${driver.vehicleType.toUpperCase()} • ${driver.vehicleNumber}',
                        style: TextStyle(color: Colors.grey.shade600)),
                  ]),
            ),
            IconButton(icon: const Icon(Icons.close), onPressed: onClose),
          ]),
          const Divider(),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _InfoChip(
                icon: '📍',
                label:
                    '${driver.distanceKm?.toStringAsFixed(1) ?? '?'} km'),
            _InfoChip(
                icon: '⏱',
                label:
                    '${driver.etaMinutes?.toStringAsFixed(0) ?? '?'} min'),
            _InfoChip(
                icon: '⚡',
                label: '${driver.speed.toStringAsFixed(0)} km/h'),
          ]),
        ]),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String icon, label;
  const _InfoChip({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(icon, style: const TextStyle(fontSize: 20)),
      Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
    ]);
  }
}
