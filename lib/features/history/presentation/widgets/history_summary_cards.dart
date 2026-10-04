import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import 'history_filter_tabs.dart';

class HistorySummaryCards extends StatelessWidget {
  final HistoryFilter filter;

  const HistorySummaryCards({
    super.key,
    required this.filter,
  });

  @override
  Widget build(BuildContext context) {
    // Dynamic values based on selected filter
    final String goodDuration = _getGoodDuration();
    final String poorDuration = _getPoorDuration();
    final String avgBackAngle = _getAvgBackAngle();
    final String avgNeckAngle = _getAvgNeckAngle();
    final int warningCount = _getWarningCount();

    return Column(
      children: [
        // 1. Duration Breakdown Card (Good vs Poor Posture)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(28),
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
                'Posture Duration Breakdown',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _DurationItem(
                      label: 'Good Posture',
                      duration: goodDuration,
                      color: AppColors.postureGood,
                      icon: Icons.check_circle_rounded,
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 40,
                    color: AppColors.background,
                  ),
                  Expanded(
                    child: _DurationItem(
                      label: 'Poor Posture',
                      duration: poorDuration,
                      color: AppColors.postureBad,
                      icon: Icons.warning_amber_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Ratio Bar
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  height: 10,
                  child: Row(
                    children: [
                      Expanded(
                        flex: 88,
                        child: Container(color: AppColors.postureGood),
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        flex: 12,
                        child: Container(color: AppColors.postureBad),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 2. Metrics Grid: Avg Back/Neck Angle & Warnings
        Row(
          children: [
            Expanded(
              child: _MetricTile(
                title: 'Avg Back Angle',
                value: avgBackAngle,
                subtitle: 'Optimal < 15°',
                icon: Icons.airline_seat_recline_normal_rounded,
                iconColor: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _MetricTile(
                title: 'Avg Neck Angle',
                value: avgNeckAngle,
                subtitle: 'Optimal < 15°',
                icon: Icons.accessibility_new_rounded,
                iconColor: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _MetricTileFullWidth(
          title: 'Total Posture Warnings',
          value: '$warningCount Warnings',
          subtitle: 'Slouch triggers > 3 seconds',
          icon: Icons.notifications_active_rounded,
          iconColor: AppColors.postureWarning,
        ),
      ],
    );
  }

  String _getGoodDuration() {
    switch (filter) {
      case HistoryFilter.daily:
        return '5h 42m';
      case HistoryFilter.weekly:
        return '32h 15m';
      case HistoryFilter.monthly:
        return '138h 40m';
    }
  }

  String _getPoorDuration() {
    switch (filter) {
      case HistoryFilter.daily:
        return '48m';
      case HistoryFilter.weekly:
        return '4h 10m';
      case HistoryFilter.monthly:
        return '18h 25m';
    }
  }

  String _getAvgBackAngle() {
    switch (filter) {
      case HistoryFilter.daily:
        return '7.4°';
      case HistoryFilter.weekly:
        return '8.1°';
      case HistoryFilter.monthly:
        return '8.5°';
    }
  }

  String _getAvgNeckAngle() {
    switch (filter) {
      case HistoryFilter.daily:
        return '11.2°';
      case HistoryFilter.weekly:
        return '12.0°';
      case HistoryFilter.monthly:
        return '12.4°';
    }
  }

  int _getWarningCount() {
    switch (filter) {
      case HistoryFilter.daily:
        return 12;
      case HistoryFilter.weekly:
        return 64;
      case HistoryFilter.monthly:
        return 248;
    }
  }
}

class _DurationItem extends StatelessWidget {
  final String label;
  final String duration;
  final Color color;
  final IconData icon;

  const _DurationItem({
    required this.label,
    required this.duration,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            duration,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color iconColor;

  const _MetricTile({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
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
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricTileFullWidth extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color iconColor;

  const _MetricTileFullWidth({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 22, color: iconColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: iconColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
