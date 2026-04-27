import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/app_theme.dart';
import '../driver/driver_dashboard.dart';
import '../passenger/passenger_map_screen.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  final String role;
  const LoginScreen({super.key, required this.role});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _driverIdCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;

  bool get isDriver => widget.role == 'driver';

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final data = isDriver
        ? {'driverId': _driverIdCtrl.text.trim(), 'password': _passCtrl.text}
        : {'phone': _phoneCtrl.text.trim(), 'password': _passCtrl.text};

    final ok = await auth.login(data);
    if (!mounted) return;
    if (ok) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) =>
            isDriver ? const DriverDashboard() : const PassengerMapScreen()),
        (_) => false,
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Login failed'),
              backgroundColor: AppTheme.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: Text('${isDriver ? 'Driver' : 'Passenger'} Login')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(children: [
            const SizedBox(height: 20),
            Text(isDriver ? '🚗' : '👤', style: const TextStyle(fontSize: 64)),
            const SizedBox(height: 24),
            if (isDriver)
              TextFormField(
                controller: _driverIdCtrl,
                decoration: const InputDecoration(labelText: 'Driver ID',
                    prefixIcon: Icon(Icons.badge)),
                validator: (v) => v!.isEmpty ? 'Enter Driver ID' : null,
              )
            else
              TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone Number',
                    prefixIcon: Icon(Icons.phone)),
                validator: (v) => v!.length < 10 ? 'Enter valid phone' : null,
              ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscure,
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock),
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              validator: (v) => v!.length < 6 ? 'Min 6 characters' : null,
            ),
            const SizedBox(height: 28),
            auth.loading
                ? const CircularProgressIndicator()
                : ElevatedButton(onPressed: _login, child: const Text('Login')),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => SignupScreen(role: widget.role))),
              child: const Text('Don\'t have an account? Sign up'),
            ),
          ]),
        ),
      ),
    );
  }
}
