import 'package:flutter/material.dart';
import '../utils/app_theme.dart';
import 'auth/login_screen.dart';
import 'auth/signup_screen.dart';

class RoleSelectionScreen extends StatelessWidget {
  const RoleSelectionScreen({super.key});

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
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const SizedBox(height: 40),
                const Text('🚌', style: TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                const Text('Welcome', style: TextStyle(fontSize: 32,
                    fontWeight: FontWeight.bold, color: Colors.white)),
                const Text('Choose your role to continue',
                    style: TextStyle(fontSize: 16, color: Colors.white70)),
                const SizedBox(height: 60),
                _RoleCard(
                  icon: '🚗',
                  title: 'I am a Driver',
                  subtitle: 'Auto / Bus / Taxi operator',
                  onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) =>
                          const LoginScreen(role: 'driver'))),
                ),
                const SizedBox(height: 20),
                _RoleCard(
                  icon: '👤',
                  title: 'I am a Passenger',
                  subtitle: 'Find nearby vehicles',
                  onTap: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) =>
                          const LoginScreen(role: 'passenger'))),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.push(context,
                      MaterialPageRoute(builder: (_) =>
                          const SignupScreen(role: 'passenger'))),
                  child: const Text('New here? Create an account',
                      style: TextStyle(color: Colors.white70)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String icon, title, subtitle;
  final VoidCallback onTap;
  const _RoleCard({required this.icon, required this.title,
      required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white30),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 40)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 20,
                    fontWeight: FontWeight.bold, color: Colors.white)),
                Text(subtitle, style: const TextStyle(color: Colors.white70)),
              ]),
            ),
            const Icon(Icons.arrow_forward_ios, color: Colors.white70),
          ],
        ),
      ),
    );
  }
}
