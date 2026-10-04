import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class PostureVisualizer extends StatelessWidget {
  final double angle;

  const PostureVisualizer({
    super.key,
    this.angle = 12.0,
  });

  @override
  Widget build(BuildContext context) {
    final bool isOk = angle <= 15;
    final Color statusColor = isOk ? AppColors.postureGood : AppColors.postureBad;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Text(
            'Live Angle Indicator',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            height: 180,
            width: 180,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.background,
              border: Border.all(color: statusColor, width: 6),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.accessibility_new, size: 64, color: statusColor),
                  const SizedBox(height: 8),
                  Text(
                    '${angle.toStringAsFixed(1)}°',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            isOk ? 'Optimal Spine Alignment' : 'Tilt Warning Exceeded!',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: statusColor,
            ),
          ),
        ],
      ),
    );
  }
}
