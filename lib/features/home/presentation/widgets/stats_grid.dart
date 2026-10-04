import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class StatsGrid extends StatelessWidget {
  final String goodDuration;
  final String poorDuration;
  final int warningCount;

  const StatsGrid({
    super.key,
    this.goodDuration = '2h 35m',
    this.poorDuration = '35m',
    this.warningCount = 7,
  });

  @override
  Widget build(BuildContext context) {
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
          Text(
            'Quick Stats',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),

          // Stats Row
          Row(
            children: [
              Expanded(
                child: _StatItem(
                  icon: Icons.check_circle_rounded,
                  color: AppColors.postureGood,
                  label: 'Good',
                  value: goodDuration,
                ),
              ),
              _divider(),
              Expanded(
                child: _StatItem(
                  icon: Icons.cancel_rounded,
                  color: AppColors.postureBad,
                  label: 'Poor',
                  value: poorDuration,
                ),
              ),
              _divider(),
              Expanded(
                child: _StatItem(
                  icon: Icons.notifications_active_rounded,
                  color: AppColors.postureWarning,
                  label: 'Warnings',
                  value: '$warningCount',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _divider() {
    return Container(
      width: 1,
      height: 50,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      color: AppColors.background,
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;

  const _StatItem({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 10),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}
