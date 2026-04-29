import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/driver_model.dart';
import '../../providers/driver_provider.dart';
import '../../providers/location_provider.dart';
import '../../utils/app_theme.dart';

class NearbyDriversScreen extends StatelessWidget {
  const NearbyDriversScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final drivers = context.watch<DriverProvider>();
    final loc     = context.watch<LocationProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby Buses'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              final pos = loc.currentPosition;
              if (pos != null) {
                drivers.fetchNearby(pos.latitude, pos.longitude);
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Status bar
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppTheme.primary.withValues(alpha: 0.2)),
            ),
            child: Row(children: [
              const Text('🚌', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 10),
              Text(
                '${drivers.filteredDrivers.where((d) => d.isAvailable).length} buses available within 1 km',
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.primary),
              ),
            ]),
          ),
          // Driver list
          Expanded(
            child: drivers.loading
                ? const Center(child: CircularProgressIndicator())
                : drivers.filteredDrivers.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('🚌', style: TextStyle(fontSize: 56)),
                            SizedBox(height: 12),
                            Text('No buses nearby',
                                style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600)),
                            SizedBox(height: 6),
                            Text('Try refreshing or check back later',
                                style: TextStyle(color: Colors.grey)),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: drivers.filteredDrivers.length,
                        itemBuilder: (_, i) =>
                            _DriverListTile(driver: drivers.filteredDrivers[i]),
                      ),
          ),
        ],
      ),
    );
  }
}

class _DriverListTile extends StatelessWidget {
  final DriverModel driver;
  const _DriverListTile({required this.driver});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
              child: Text(driver.vehicleIcon,
                  style: const TextStyle(fontSize: 28))),
        ),
        title: Text(driver.driverName,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${driver.vehicleType.toUpperCase()} • ${driver.vehicleNumber}'),
              const SizedBox(height: 4),
              Row(children: [
                _Tag(
                    color: AppTheme.primary,
                    text:
                        '📍 ${driver.distanceKm?.toStringAsFixed(1) ?? '?'} km'),
                const SizedBox(width: 8),
                _Tag(
                    color: AppTheme.accent,
                    text:
                        '⏱ ${driver.etaMinutes?.toStringAsFixed(0) ?? '?'} min'),
                const SizedBox(width: 8),
                _Tag(
                    color: Colors.orange,
                    text: '⚡ ${driver.speed.toStringAsFixed(0)} km/h'),
              ]),
            ]),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: driver.isAvailable ? AppTheme.accent : Colors.grey,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            driver.isAvailable ? 'Available' : 'Busy',
            style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final Color color;
  final String text;
  const _Tag({required this.color, required this.text});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
