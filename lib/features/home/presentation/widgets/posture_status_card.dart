import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class PostureStatusCard extends StatelessWidget {
  final double backAngle;
  final double neckAngle;
  final String status; // 'Good' | 'Poor'

  const PostureStatusCard({
    super.key,
    this.backAngle = 5.2,
    this.neckAngle = 12.8,
    this.status = 'Good',
  });

  @override
  Widget build(BuildContext context) {
    final bool isGood = status == 'Good';
    final Color statusColor = isGood ? AppColors.postureGood : AppColors.postureBad;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
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
          // Header Row
          Row(
            children: [
              Text(
                'Current Posture',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isGood ? Icons.check_circle_rounded : Icons.warning_rounded,
                      color: statusColor,
                      size: 15,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      isGood ? 'Good' : 'Poor',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Angle Cards Row
          Row(
            children: [
              // Back Angle
              Expanded(
                child: _AngleTile(
                  label: 'Back Angle',
                  angle: backAngle,
                  icon: Icons.airline_seat_recline_normal_rounded,
                  thresholdAngle: 15.0,
                ),
              ),
              const SizedBox(width: 14),
              // Neck Angle
              Expanded(
                child: _AngleTile(
                  label: 'Neck Angle',
                  angle: neckAngle,
                  icon: Icons.accessibility_new_rounded,
                  thresholdAngle: 20.0,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AngleTile extends StatelessWidget {
  final String label;
  final double angle;
  final IconData icon;
  final double thresholdAngle;

  const _AngleTile({
    required this.label,
    required this.angle,
    required this.icon,
    required this.thresholdAngle,
  });

  @override
  Widget build(BuildContext context) {
    final bool isOk = angle <= thresholdAngle;
    final Color tileColor = isOk ? AppColors.postureGood : AppColors.postureBad;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                angle.toStringAsFixed(1),
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: tileColor,
                  height: 1,
                ),
              ),
              const SizedBox(width: 2),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  '°',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: tileColor,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
