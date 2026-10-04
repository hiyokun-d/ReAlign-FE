import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class PostureStatusHero extends StatelessWidget {
  final bool isGood;
  final bool hasPostureAlert;
  final String postureMessage;

  const PostureStatusHero({
    super.key,
    required this.isGood,
    required this.hasPostureAlert,
    this.postureMessage = "You're sitting upright",
  });

  @override
  Widget build(BuildContext context) {
    final Color mainColor = isGood ? AppColors.postureGood : AppColors.postureBad;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
      decoration: BoxDecoration(
        color: isGood
            ? const Color(0xFFECFDF5) // Light Emerald Tint
            : const Color(0xFFFEF2F2), // Light Red Tint
        borderRadius: BorderRadius.circular(32),
        border: Border.all(
          color: mainColor.withValues(alpha: 0.3),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: mainColor.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header Label
          Text(
            'POSTURE STATUS',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: mainColor,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),

          // Big Icon Badge
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: mainColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: mainColor.withValues(alpha: 0.35),
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              isGood ? Icons.check_rounded : Icons.priority_high_rounded,
              color: Colors.white,
              size: 44,
            ),
          ),
          const SizedBox(height: 16),

          // Big Status Title
          Text(
            isGood ? 'GOOD' : 'POOR POSTURE',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w900,
              color: mainColor,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),

          // Subtitle Message
          Text(
            isGood ? postureMessage : 'Slouch Detected! Please sit up straight.',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),

          // Posture Alert Banner (Triggered when angle > 20° for > 3 seconds)
          if (hasPostureAlert) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.postureBad,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.postureBad.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'ALERT: Angle > 20° for 3s+',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
