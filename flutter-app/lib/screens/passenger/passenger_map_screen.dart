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

  @override
  void initState() {
    super.initState();
    final driverProv = context.read<DriverProvider>();
    driverProv.init();
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

  @override
  Widget build(BuildContext context) {
    final loc     = context.watch<LocationProvider>();
    final drivers = context.watch<DriverProvider>();
    final pos     = loc.currentPosition;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby Drivers'),
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
              initialZoom: 13,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.bustracking.app',
              ),
              // Passenger marker
              if (pos != null)
                MarkerLayer(markers: [
                  Marker(
                    point: LatLng(pos.latitude, pos.longitude),
                    width: 40, height: 40,
                    child: const Icon(Icons.my_location,
                        color: AppTheme.primary, size: 36),
                  ),
                ]),
              // Driver markers
              MarkerLayer(
                markers: drivers.filteredDrivers.where((d) => d.isAvailable).map((d) =>
                  Marker(
                    point: LatLng(d.latitude, d.longitude),
                    width: 44, height: 44,
                    child: GestureDetector(
                      onTap: () => setState(() => _selected = d),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _selected?.driverId == d.driverId
                              ? AppTheme.secondary : AppTheme.primary,
                          shape: BoxShape.circle,
                          boxShadow: const [BoxShadow(color: Colors.black26,
                              blurRadius: 4, offset: Offset(0, 2))],
                        ),
                        child: Center(child: Text(d.vehicleIcon,
                            style: const TextStyle(fontSize: 22))),
                      ),
                    ),
                  ),
                ).toList(),
              ),
            ],
          ),
          // Filter chips
          Positioned(
            top: 12, left: 12, right: 12,
            child: _FilterBar(),
          ),
          // Selected driver card
          if (_selected != null)
            Positioned(
              bottom: 20, left: 16, right: 16,
              child: _DriverCard(driver: _selected!,
                  onClose: () => setState(() => _selected = null)),
            ),
          // Refresh button
          Positioned(
            bottom: _selected != null ? 180 : 20,
            right: 16,
            child: FloatingActionButton(
              mini: true,
              backgroundColor: AppTheme.primary,
              onPressed: () {
                if (pos != null) {
                  drivers.fetchNearby(pos.latitude, pos.longitude);
                }
              },
              child: const Icon(Icons.refresh, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final prov = context.watch<DriverProvider>();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: ['all', 'auto', 'bus', 'taxi'].map((type) {
          final labels = {'all': '🔍 All', 'auto': '🛺 Auto',
                          'bus': '🚌 Bus', 'taxi': '🚕 Taxi'};
          final selected = prov.filter == type;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(labels[type]!),
              selected: selected,
              onSelected: (_) => prov.setFilter(type),
              backgroundColor: Colors.white,
              selectedColor: AppTheme.primary.withValues(alpha: 0.2),
              checkmarkColor: AppTheme.primary,
            ),
          );
        }).toList(),
      ),
    );
  }
}

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
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(driver.driverName, style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 16)),
              Text('${driver.vehicleType.toUpperCase()} • ${driver.vehicleNumber}',
                  style: TextStyle(color: Colors.grey.shade600)),
            ])),
            IconButton(icon: const Icon(Icons.close), onPressed: onClose),
          ]),
          const Divider(),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _InfoChip(icon: '📍',
                label: '${driver.distanceKm?.toStringAsFixed(1) ?? '?'} km'),
            _InfoChip(icon: '⏱',
                label: '${driver.etaMinutes?.toStringAsFixed(0) ?? '?'} min'),
            _InfoChip(icon: '⚡',
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
