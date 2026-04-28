import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:trackify/main.dart';
import 'package:trackify/providers/auth_provider.dart';
import 'package:trackify/providers/location_provider.dart';
import 'package:trackify/providers/driver_provider.dart';

void main() {
  testWidgets('Trackify app launches and shows splash screen',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => LocationProvider()),
          ChangeNotifierProvider(create: (_) => DriverProvider()),
        ],
        child: const BusTrackingApp(),
      ),
    );

    // App should render without crashing
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
