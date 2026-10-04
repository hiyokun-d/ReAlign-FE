import 'dart:async';
import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../widgets/posture_status_hero.dart';
import '../widgets/live_sensor_tiles.dart';
import '../widgets/live_angle_chart.dart';

class LiveMonitorScreen extends StatefulWidget {
  const LiveMonitorScreen({super.key});

  @override
  State<LiveMonitorScreen> createState() => _LiveMonitorScreenState();
}

class _LiveMonitorScreenState extends State<LiveMonitorScreen> {
  Timer? _timer;
  bool _isMonitoring = true;
  int _durationSeconds = 154; // Starts at 02:34 for demo

  double _backAngle = 8.2;
  double _neckAngle = 11.4;

  int _highAngleDuration = 0; // Tracks consecutive seconds above 20°
  bool _hasPostureAlert = false;
  bool _isGood = true;

  final List<FlSpot> _chartSpots = [];
  double _chartTimeX = 0;

  final math.Random _random = math.Random();

  @override
  void initState() {
    super.initState();
    // Seed initial chart spots
    for (int i = 0; i < 15; i++) {
      _chartTimeX = i.toDouble();
      final double val = 7.0 + _random.nextDouble() * 6.0;
      _chartSpots.add(FlSpot(_chartTimeX, val));
    }
    _startPeriodicTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startPeriodicTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!_isMonitoring) return;

      setState(() {
        _durationSeconds++;
        _chartTimeX += 1.0;

        // Simulate sensor angle fluctuations (occasionally posture spikes above 20°)
        final bool simulateSpike = _random.nextDouble() < 0.25; // 25% chance of slouch
        if (simulateSpike) {
          _backAngle = 21.0 + _random.nextDouble() * 5.0; // 21° - 26°
          _neckAngle = 22.0 + _random.nextDouble() * 4.0;
        } else {
          _backAngle = 6.0 + _random.nextDouble() * 7.0;  // 6° - 13°
          _neckAngle = 9.0 + _random.nextDouble() * 6.0;  // 9° - 15°
        }

        final double maxAngle = math.max(_backAngle, _neckAngle);

        // Add spot to chart history
        _chartSpots.add(FlSpot(_chartTimeX, maxAngle));
        if (_chartSpots.length > 25) {
          _chartSpots.removeAt(0);
        }

        // 3-second threshold alert logic (>20° for 3+ consecutive seconds)
        if (maxAngle > 20.0) {
          _highAngleDuration++;
          if (_highAngleDuration >= 3) {
            _hasPostureAlert = true;
            _isGood = false;
          } else {
            _isGood = false;
          }
        } else {
          _highAngleDuration = 0;
          _hasPostureAlert = false;
          _isGood = true;
        }
      });
    });
  }

  void _toggleMonitoring() {
    setState(() {
      _isMonitoring = !_isMonitoring;
      if (_isMonitoring) {
        _startPeriodicTimer();
      } else {
        _timer?.cancel();
      }
    });
  }

  String _formatDuration(int seconds) {
    final int mins = seconds ~/ 60;
    final int secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final double currentMaxAngle = math.max(_backAngle, _neckAngle);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // ==========================================
            // 1. TOP HEADER (Deep Indigo Background Header)
            // ==========================================
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(36),
                  bottomRight: Radius.circular(36),
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    children: [
                      // Top White Block Container for Title & Actions
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Left: Title & Subtitle
                            Row(
                              children: [
                                Image.asset(
                                  'assets/icons/realign_logo.png',
                                  height: 32,
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) {
                                    return const SizedBox.shrink();
                                  },
                                ),
                                const SizedBox(width: 10),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Live Monitor',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.primary,
                                        letterSpacing: -0.4,
                                      ),
                                    ),
                                    Text(
                                      'Natasha',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),

                            // Right: More Options Button
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.more_vert_rounded,
                                color: AppColors.textPrimary,
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Device Connected Status Pill
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppColors.postureGood,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Re:Align Device - Connected',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ==========================================
            // 2. SCROLLABLE MONITORING BODY
            // ==========================================
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
              child: Column(
                children: [
                  // 1. POSTURE STATUS HERO CARD (GOOD / POOR POSTURE)
                  PostureStatusHero(
                    isGood: _isGood,
                    hasPostureAlert: _hasPostureAlert,
                  ),
                  const SizedBox(height: 20),

                  // 2. LIVE SENSOR DATA TILES (BACK & NECK ANGLES)
                  LiveSensorTiles(
                    backAngle: _backAngle,
                    neckAngle: _neckAngle,
                  ),
                  const SizedBox(height: 20),

                  // 3. POSTURE ANGLE REAL-TIME CHART
                  LiveAngleChart(
                    points: _chartSpots,
                    currentAngle: currentMaxAngle,
                  ),
                  const SizedBox(height: 24),

                  // 4. DURATION TIMER DISPLAY
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: _isMonitoring
                                ? AppColors.postureGood
                                : AppColors.textSecondary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _isMonitoring
                              ? 'Monitoring for ${_formatDuration(_durationSeconds)}'
                              : 'Monitoring Paused (${_formatDuration(_durationSeconds)})',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 5. START / STOP MONITORING BUTTON
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _toggleMonitoring,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isMonitoring
                            ? AppColors.postureBad
                            : AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 6,
                        shadowColor: (_isMonitoring
                                ? AppColors.postureBad
                                : AppColors.primary)
                            .withValues(alpha: 0.35),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isMonitoring
                                ? Icons.stop_rounded
                                : Icons.play_arrow_rounded,
                            size: 24,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isMonitoring
                                ? 'STOP MONITORING'
                                : 'START MONITORING',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
