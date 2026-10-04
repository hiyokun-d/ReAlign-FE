import 'package:flutter/material.dart';
import '../../../home/presentation/screens/home_screen.dart';
import '../../../live_monitor/presentation/screens/live_monitor_screen.dart';
import '../../../history/presentation/screens/history_screen.dart';
import '../../../../core/constants/app_colors.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      HomeScreen(
        onStartMonitoring: () {
          setState(() {
            _currentIndex = 1; // Switch to Live Monitor tab
          });
        },
      ),
      const LiveMonitorScreen(),
      const HistoryScreen(),
    ];

    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined, color: AppColors.textSecondary),
              selectedIcon: Icon(Icons.home_rounded, color: AppColors.primary),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.monitor_heart_outlined, color: AppColors.textSecondary),
              selectedIcon: Icon(Icons.monitor_heart, color: AppColors.primary),
              label: 'Live Monitor',
            ),
            NavigationDestination(
              icon: Icon(Icons.history_outlined, color: AppColors.textSecondary),
              selectedIcon: Icon(Icons.history_rounded, color: AppColors.primary),
              label: 'History',
            ),
          ],
        ),
      ),
    );
  }
}
