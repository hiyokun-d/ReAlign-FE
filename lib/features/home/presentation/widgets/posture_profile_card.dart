import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import 'spine_visualizer.dart';
import 'decorative_circles.dart';

class PostureProfileCard extends StatelessWidget {
  final double neckAngle;
  final double backAngle;
  final String statusText;
  final bool isBalanced;

  const PostureProfileCard({
    super.key,
    this.neckAngle = 12.0,
    this.backAngle = 8.0,
    this.statusText = 'Sumbu Seimbang',
    this.isBalanced = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.creamCard, // Warm Cream Card matching reference image
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(32),
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
          topRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(32),
        child: Stack(
          children: [
            // Decorative overlapping circles in the top-right corner
            const Positioned(
              top: 0,
              right: 0,
              child: DecorativeCircles(size: 110),
            ),

            // Main Content
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Card Title
                  Text(
                    'PROFIL POSTUR',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Spine Visualizer Widget
                  SpineVisualizer(
                    neckAngle: neckAngle,
                    backAngle: backAngle,
                    curveOffset: 0.0,
                    statusText: statusText,
                    isBalanced: isBalanced,
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
