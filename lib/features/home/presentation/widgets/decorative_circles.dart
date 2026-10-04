import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

/// Decorative overlapping circles graphic matching the reference UI design.
class DecorativeCircles extends StatelessWidget {
  final double size;

  const DecorativeCircles({
    super.key,
    this.size = 110,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Blue circle (top right)
          Positioned(
            top: -12,
            right: 18,
            child: Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          ),
          // Yellow circle (top far right)
          Positioned(
            top: -16,
            right: -16,
            child: Container(
              width: 68,
              height: 68,
              decoration: const BoxDecoration(
                color: AppColors.accentYellow,
                shape: BoxShape.circle,
              ),
            ),
          ),
          // Pink small dot (below blue circle)
          Positioned(
            top: 42,
            right: 28,
            child: Container(
              width: 18,
              height: 18,
              decoration: const BoxDecoration(
                color: AppColors.accentPink,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
