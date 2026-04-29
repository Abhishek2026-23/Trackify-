import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/app_theme.dart';
import '../role_selection_screen.dart';

// Simple model for a nearby passenger
class _PassengerInfo {
  final String userId;
  final double lat, lng;
  final double distanceKm;
  _PassengerInfo(
      {required this.userId,
      required this.lat,
      required this.lng,
      required this.distanceKm});
}

class DriverDashboard extends StatefulWidget {
  const DriverDashboard({super.key});
  @override
  State<DriverDashboard> createState() => _DriverDashboardState();
}

class _DriverDashboardState extends State<DriverDashboard> {
  bool _isAvailable = false;
  bool _showPassengerPanel = false;
  final _mapCtrl = MapController();

  // Simulated nearby passengers (real data comes via Socket.IO in production)
  final List<_PassengerInfo> _nearbyPassengers = [];
  Timer? _passengerRefreshTimer;

  @override
  void initState() {
    super.initState();
    context.read<LocationProvider>().getCurrentLocation();
  }

  @override
  void dispose() {
    _passengerRefreshTimer?.cancel();
    super.dispose();
  }

  void _toggleAvailability() {
    final loc = context.read<LocationProvider>();
    final user = context.read<AuthProvider>().user!;
    setState(() => _isAvailable = !_isAvailable);
    if (_isAvailable) {
      loc.startTracking(user.driverId!, true);
      // Start refreshing passenger list
      _passengerRefreshTimer = Timer.periodic(
        const Duration(seconds: 10),
        (_) => _refreshPassengers(),
      );
      _refreshPassengers();
    } else {
      loc.stopTracking();
      _passengerRefreshTimer?.cancel();
      setState(() => _nearbyPassengers.clear());
    }
  }

  void _refreshPassengers() {
    // In production this is driven by Socket.IO passenger_location_update events.
    // For now we just keep the list as-is (populated by socket events).
    setState(() {}); // trigger rebuild to update "last refreshed" time
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
          // Passenger panel toggle
          Stack(
            alignment: Alignment.topRight,
            children: [
              IconButton(
                tooltip: 'Nearby Passengers',
                icon: Icon(
                  Icons.people,
                  color: _showPassengerPanel
                      ? AppTheme.accent
                      : Colors.white,
                ),
                onPressed: () =>
                    setState(() => _showPassengerPanel = !_showPassengerPanel),
              ),
              if (_nearbyPassengers.isNotEmpty)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '${_nearbyPassengers.length}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          // Availability toggle
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
              _passengerRefreshTimer?.cancel();
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
                      color:
                          (_isAvailable ? AppTheme.accent : AppTheme.primary)
                              .withValues(alpha: 0.08),
                      borderColor:
                          (_isAvailable ? AppTheme.accent : AppTheme.primary)
                              .withValues(alpha: 0.5),
                      borderStrokeWidth: 1.5,
                    ),
                  ],
                ),
              // Passenger markers on map
              if (pos != null && _nearbyPassengers.isNotEmpty)
                MarkerLayer(
                  markers: _nearbyPassengers
                      .map((p) => Marker(
                            point: LatLng(p.lat, p.lng),
                            width: 36,
                            height: 36,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.orange.shade600,
                                shape: BoxShape.circle,
                                border: Border.all(
                                    color: Colors.white, width: 2),
                              ),
                              child: const Icon(Icons.person,
                                  color: Colors.white, size: 18),
                            ),
                          ))
                      .toList(),
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

          // ── Right side panel buttons ─────────────────────────
          Positioned(
            top: 16,
            right: 12,
            child: Column(children: [
              GestureDetector(
                onTap: _toggleAvailability,
                child: Container(
                  width: 60,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: _isAvailable
                        ? AppTheme.accent
                        : Colors.grey.shade700,
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

          // ── Passenger side panel (left) ──────────────────────
          AnimatedPositioned(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeInOut,
            left: _showPassengerPanel ? 0 : -220,
            top: 0,
            bottom: 0,
            child: Container(
              width: 210,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.horizontal(right: Radius.circular(16)),
                boxShadow: [
                  BoxShadow(color: Colors.black26, blurRadius: 12)
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Panel header
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 16, 8, 12),
                    decoration: const BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.only(
                          topRight: Radius.circular(16)),
                    ),
                    child: Row(children: [
                      const Icon(Icons.people, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Nearby Passengers',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13),
                        ),
                      ),
                      GestureDetector(
                        onTap: () =>
                            setState(() => _showPassengerPanel = false),
                        child: const Icon(Icons.close,
                            color: Colors.white70, size: 18),
                      ),
                    ]),
                  ),
                  // Radius info
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    color: AppTheme.primary.withValues(alpha: 0.06),
                    child: Row(children: [
                      Icon(Icons.radio_button_checked,
                          size: 14,
                          color: AppTheme.primary.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Within 1 km radius',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.primary.withValues(alpha: 0.8),
                            fontWeight: FontWeight.w500),
                      ),
                    ]),
                  ),
                  // Passenger list
                  Expanded(
                    child: _isAvailable
                        ? _nearbyPassengers.isEmpty
                            ? _EmptyPassengerState()
                            : ListView.separated(
                                padding: const EdgeInsets.all(10),
                                itemCount: _nearbyPassengers.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 6),
                                itemBuilder: (_, i) {
                                  final p = _nearbyPassengers[i];
                                  return _PassengerTile(passenger: p);
                                },
                              )
                        : _OfflinePassengerState(),
                  ),
                ],
              ),
            ),
          ),

          // ── Bottom info panel ────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [
                  BoxShadow(color: Colors.black12, blurRadius: 12)
                ],
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
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
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16)),
                          Text(
                            '${user.vehicleType?.toUpperCase() ?? 'BUS'} • ${user.vehicleNumber ?? '-'}',
                            style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 13),
                          ),
                        ]),
                  ),
                  // Passenger count badge
                  GestureDetector(
                    onTap: () => setState(
                        () => _showPassengerPanel = !_showPassengerPanel),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _nearbyPassengers.isEmpty
                            ? Colors.grey.shade100
                            : Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _nearbyPassengers.isEmpty
                              ? Colors.grey.shade300
                              : Colors.orange.shade300,
                        ),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.people,
                            size: 16,
                            color: _nearbyPassengers.isEmpty
                                ? Colors.grey
                                : Colors.orange.shade700),
                        const SizedBox(width: 4),
                        Text(
                          _nearbyPassengers.isEmpty
                              ? 'No passengers'
                              : '${_nearbyPassengers.length} nearby',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _nearbyPassengers.isEmpty
                                  ? Colors.grey
                                  : Colors.orange.shade700),
                        ),
                      ]),
                    ),
                  ),
                ]),
                const SizedBox(height: 14),
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
                    icon: Icon(_isAvailable
                        ? Icons.stop_circle
                        : Icons.play_circle),
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

// ── Empty state when online but no passengers ──────────────────────
class _EmptyPassengerState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.person_search,
                  size: 32, color: Colors.grey.shade400),
            ),
            const SizedBox(height: 12),
            Text(
              'No passengers nearby',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Colors.grey.shade700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Passengers within 1 km will appear here',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── State when driver is offline ───────────────────────────────────
class _OfflinePassengerState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.wifi_off,
                  size: 32, color: Colors.grey.shade400),
            ),
            const SizedBox(height: 12),
            Text(
              'You are offline',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Colors.grey.shade700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Go online to see nearby passengers',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Passenger list tile ────────────────────────────────────────────
class _PassengerTile extends StatelessWidget {
  final _PassengerInfo passenger;
  const _PassengerTile({required this.passenger});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Colors.orange.shade100,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.person,
              color: Colors.orange.shade700, size: 20),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Passenger',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 12)),
                Text(
                  '${passenger.distanceKm.toStringAsFixed(2)} km away',
                  style: TextStyle(
                      fontSize: 11, color: Colors.grey.shade600),
                ),
              ]),
        ),
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.green.shade100,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text('Waiting',
              style: TextStyle(
                  fontSize: 10,
                  color: Colors.green.shade700,
                  fontWeight: FontWeight.bold)),
        ),
      ]),
    );
  }
}

// ── Reusable widgets ───────────────────────────────────────────────
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
              style:
                  TextStyle(color: Colors.grey.shade500, fontSize: 10)),
        ]),
      ),
    );
  }
}
