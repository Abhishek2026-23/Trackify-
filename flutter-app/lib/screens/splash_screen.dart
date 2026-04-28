import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../utils/app_theme.dart';
import 'role_selection_screen.dart';
import 'driver/driver_dashboard.dart';
import 'passenger/passenger_map_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward();
    Future.delayed(const Duration(seconds: 2), _navigate);
  }

  void _navigate() {
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    if (auth.isLoggedIn) {
      final screen = auth.user!.isDriver
          ? const DriverDashboard()
          : const PassengerMapScreen();
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => screen));
    } else {
      Navigator.pushReplacement(context,
          MaterialPageRoute(builder: (_) => const RoleSelectionScreen()));
    }
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppTheme.primary, AppTheme.secondary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: FadeTransition(
          opacity: _fade,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/logo.png',
                  width: 180,
                  height: 180,
                  errorBuilder: (context, error, stackTrace) {
                    return const Text('🚌', style: TextStyle(fontSize: 80));
                  },
                ),
                const SizedBox(height: 24),
                const Text('Trackify',
                    style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold,
                        color: Colors.white, letterSpacing: 1.2)),
                const SizedBox(height: 8),
                const Text('Real-Time Transport Tracking',
                    style: TextStyle(fontSize: 15, color: Colors.white70)),
                const SizedBox(height: 48),
                const CircularProgressIndicator(color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
