import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'features/main_navigation/presentation/screens/main_navigation_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: ReAlignApp(),
    ),
  );
}

class ReAlignApp extends StatelessWidget {
  const ReAlignApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Re:Align - Wearable Posture Monitor',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainNavigationScreen(),
    );
  }
}
