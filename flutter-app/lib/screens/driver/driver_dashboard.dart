import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user!;
    final loc  = context.watch<LocationProvider>();
    final pos  = loc.currentPosition;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              loc.stopTracking();
              await context.read<AuthProvider>().logout();
              if (!mounted) return;
              Navigator.pushAndRemoveUntil(context,
                  MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
                  (_) => false);
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          // Driver info card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                const Text('🚗', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 8),
                Text(user.name, style: const TextStyle(fontSize: 22,
                    fontWeight: FontWeight.bold)),
                Text('ID: ${user.driverId}',
                    style: TextStyle(color: Colors.grey.shade600)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: _isAvailable ? AppTheme.accent : Colors.grey,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(_isAvailable ? '● Available' : '● Offline',
                      style: const TextStyle(color: Colors.white,
                          fontWeight: FontWeight.bold)),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          // Stats row
          Row(children: [
            _StatCard(label: 'Vehicle', value: user.vehicleType?.toUpperCase() ?? '-',
                icon: '🚗'),
            const SizedBox(width: 12),
            _StatCard(label: 'Number', value: user.vehicleNumber ?? '-', icon: '🔢'),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            _StatCard(
              label: 'Speed',
              value: pos != null ? '${(pos.speed * 3.6).toStringAsFixed(1)} km/h' : '0 km/h',
              icon: '⚡',
            ),
            const SizedBox(width: 12),
            _StatCard(
              label: 'GPS',
              value: pos != null ? 'Active' : 'Waiting',
              icon: '📍',
            ),
          ]),
          const SizedBox(height: 12),
          if (pos != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('📍 Current Location',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  Text('Lat: ${pos.latitude.toStringAsFixed(6)}'),
                  Text('Lng: ${pos.longitude.toStringAsFixed(6)}'),
                  Text('Accuracy: ${pos.accuracy.toStringAsFixed(1)} m'),
                ]),
              ),
            ),
          const SizedBox(height: 24),
          // Toggle availability button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isAvailable ? AppTheme.danger : AppTheme.accent,
              ),
              icon: Icon(_isAvailable ? Icons.stop : Icons.play_arrow),
              label: Text(_isAvailable ? 'Stop Availability' : 'Go Available'),
              onPressed: _toggleAvailability,
            ),
          ),
          if (_isAvailable) ...[
            const SizedBox(height: 12),
            const Text('📡 Sending live location every 5 seconds...',
                style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w500)),
          ],
        ]),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value, icon;
  const _StatCard({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Text(icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}
