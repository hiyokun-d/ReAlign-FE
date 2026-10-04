import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class LiveSensorTiles extends StatelessWidget {
  final double backAngle;
  final double neckAngle;

  const LiveSensorTiles({
    super.key,
    required this.backAngle,
    required this.neckAngle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Text(
            'LIVE SENSOR DATA',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: _SensorTile(
                label: 'BACK',
                angle: backAngle,
                icon: Icons.airline_seat_recline_normal_rounded,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: _SensorTile(
                label: 'NECK',
                angle: neckAngle,
                icon: Icons.accessibility_new_rounded,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SensorTile extends StatelessWidget {
  final String label;
  final double angle;
  final IconData icon;

  const _SensorTile({
    required this.label,
    required this.angle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final bool isNormal = angle <= 20.0;
    final Color statusColor = isNormal ? AppColors.postureGood : AppColors.postureBad;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.25),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textSecondary,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${angle.toStringAsFixed(1)}°',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: statusColor,
              height: 1,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                isNormal ? Icons.check_circle_rounded : Icons.warning_rounded,
                size: 14,
                color: statusColor,
              ),
              const SizedBox(width: 4),
              Text(
                isNormal ? 'Normal ✓' : 'Warning ⚠️',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: statusColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
