import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class AngleCards extends StatelessWidget {
  final double backAngle;
  final double neckAngle;

  const AngleCards({
    super.key,
    this.backAngle = 8.0,
    this.neckAngle = 12.0,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Back Angle Card (Warm Cream)
        Expanded(
          child: _AngleCard(
            title: 'Back Angle',
            angle: backAngle,
            icon: Icons.airline_seat_recline_normal_rounded,
            backgroundColor: AppColors.surface,
            iconColor: AppColors.primary,
          ),
        ),
        const SizedBox(width: 14),
        // Neck Angle Card (Warm Cream)
        Expanded(
          child: _AngleCard(
            title: 'Neck Angle',
            angle: neckAngle,
            icon: Icons.accessibility_new_rounded,
            backgroundColor: AppColors.surface,
            iconColor: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _AngleCard extends StatelessWidget {
  final String title;
  final double angle;
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;

  const _AngleCard({
    required this.title,
    required this.angle,
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(24),
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
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${angle.toInt()}°',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'Optimal',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.postureGood,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
