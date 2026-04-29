import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/app_theme.dart';
import 'login_screen.dart';

class SignupScreen extends StatefulWidget {
  final String role;
  const SignupScreen({super.key, required this.role});
  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl    = TextEditingController();
  final _phoneCtrl   = TextEditingController();
  final _emailCtrl   = TextEditingController();
  final _passCtrl    = TextEditingController();
  final _vehicleCtrl = TextEditingController();
  String _vehicleType = 'bus';
  bool _obscure = true;

  bool get isDriver => widget.role == 'driver';

  Future<void> _signup() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final data = {
      'name': _nameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
      'password': _passCtrl.text,
      'user_type': isDriver ? 'driver' : 'commuter',
      if (isDriver) 'vehicle_type': _vehicleType,
      if (isDriver) 'vehicle_number': _vehicleCtrl.text.trim(),
    };
    final ok = await auth.register(data);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registered! Please login.'),
              backgroundColor: AppTheme.accent));
      Navigator.pushReplacement(context,
          MaterialPageRoute(builder: (_) => LoginScreen(role: widget.role)));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Registration failed'),
              backgroundColor: AppTheme.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: Text('${isDriver ? 'Driver' : 'Passenger'} Sign Up')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(children: [
            TextFormField(controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person)),
                validator: (v) => v!.isEmpty ? 'Required' : null),
            const SizedBox(height: 14),
            TextFormField(controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone Number',
                    prefixIcon: Icon(Icons.phone)),
                validator: (v) => v!.length < 10 ? 'Enter valid phone' : null),
            const SizedBox(height: 14),
            TextFormField(controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email (optional)',
                    prefixIcon: Icon(Icons.email))),
            const SizedBox(height: 14),
            if (isDriver) ...[
              DropdownButtonFormField<String>(
                initialValue: _vehicleType,
                decoration: const InputDecoration(labelText: 'Vehicle Type',
                    prefixIcon: Icon(Icons.directions_bus)),
                items: const [
                  DropdownMenuItem(value: 'bus', child: Text('🚌 Bus')),
                ],
                onChanged: (v) => setState(() => _vehicleType = v!),
              ),
              const SizedBox(height: 14),
              TextFormField(controller: _vehicleCtrl,
                  decoration: const InputDecoration(labelText: 'Vehicle Number',
                      prefixIcon: Icon(Icons.confirmation_number)),
                  validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 14),
            ],
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
              validator: (v) => v!.length < 8 ? 'Min 8 characters' : null,
            ),
            const SizedBox(height: 28),
            auth.loading
                ? const CircularProgressIndicator()
                : ElevatedButton(onPressed: _signup, child: const Text('Create Account')),
          ]),
        ),
      ),
    );
  }
}
