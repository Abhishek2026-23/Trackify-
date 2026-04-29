import 'package:flutter/material.dart';
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
            colors: [Color(0xFF1a1a2e), Color(0xFF16213e), Color(0xFF0f3460)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const SizedBox(height: 48),

                // ── Logo + branding ──────────────────────────
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                        width: 1.5),
                  ),
                  child: const Center(
                    child: Text('🚌', style: TextStyle(fontSize: 40)),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Welcome to Trackify',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Real-Time Bus Tracking System',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withValues(alpha: 0.65),
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 8),
                // Live indicator
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: Colors.green.withValues(alpha: 0.4)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Colors.greenAccent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'Live Tracking Active',
                      style: TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.w600),
                    ),
                  ]),
                ),

                const SizedBox(height: 48),

                // ── Section label ────────────────────────────
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Choose your role',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // ── Driver card ──────────────────────────────
                _RoleCard(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  icon: '🚌',
                  title: 'I am a Driver',
                  subtitle: 'Bus operator — share your live location',
                  badge: 'DRIVER',
                  badgeColor: const Color(0xFF764BA2),
                  features: const ['Live GPS tracking', 'Passenger visibility', '1 km broadcast'],
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const LoginScreen(role: 'driver')),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Passenger card ───────────────────────────
                _RoleCard(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF11998e), Color(0xFF38ef7d)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  icon: '👤',
                  title: 'I am a Passenger',
                  subtitle: 'Find buses near you in real-time',
                  badge: 'PASSENGER',
                  badgeColor: const Color(0xFF11998e),
                  features: const ['Nearby buses', 'Live ETA', 'Map view'],
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const LoginScreen(role: 'passenger')),
                  ),
                ),

                const Spacer(),

                // ── Feature highlights ───────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _FeaturePill(icon: '📍', label: 'Real-Time'),
                    _FeaturePill(icon: '🗺️', label: 'Live Map'),
                    _FeaturePill(icon: '⚡', label: 'Fast ETA'),
                    _FeaturePill(icon: '🔒', label: 'Secure'),
                  ],
                ),
                const SizedBox(height: 20),

                // ── Sign up link ─────────────────────────────
                TextButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) =>
                            const SignupScreen(role: 'passenger')),
                  ),
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 13),
                      children: const [
                        TextSpan(text: 'New here? '),
                        TextSpan(
                          text: 'Create an account',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              decoration: TextDecoration.underline),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Role card ──────────────────────────────────────────────────────
class _RoleCard extends StatelessWidget {
  final LinearGradient gradient;
  final String icon, title, subtitle, badge;
  final Color badgeColor;
  final List<String> features;
  final VoidCallback onTap;

  const _RoleCard({
    required this.gradient,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.badgeColor,
    required this.features,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: gradient.colors.first.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text(icon, style: const TextStyle(fontSize: 36)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                      const SizedBox(height: 3),
                      Text(subtitle,
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 12)),
                    ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(badge,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1)),
              ),
            ]),
            const SizedBox(height: 14),
            // Feature pills
            Row(
              children: features
                  .map((f) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(f,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500)),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('Tap to continue',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11)),
                const SizedBox(width: 4),
                Icon(Icons.arrow_forward_ios,
                    color: Colors.white.withValues(alpha: 0.7), size: 12),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Feature pill ───────────────────────────────────────────────────
class _FeaturePill extends StatelessWidget {
  final String icon, label;
  const _FeaturePill({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(icon, style: const TextStyle(fontSize: 20)),
      const SizedBox(height: 4),
      Text(label,
          style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 10,
              fontWeight: FontWeight.w500)),
    ]);
  }
}
