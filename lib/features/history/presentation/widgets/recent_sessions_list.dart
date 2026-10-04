import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class RecentSessionsList extends StatelessWidget {
  const RecentSessionsList({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Text(
            'RECENT SESSIONS',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: 0.8,
            ),
          ),
        ),
        _SessionCard(
          timeText: 'Today, 14:30 - 15:45',
          durationText: '1h 15m',
          score: 92,
          statusText: 'Great Posture',
          statusColor: AppColors.postureGood,
          warningCount: 3,
        ),
        const SizedBox(height: 10),
        _SessionCard(
          timeText: 'Today, 09:15 - 11:30',
          durationText: '2h 15m',
          score: 85,
          statusText: 'Good Posture',
          statusColor: AppColors.postureGood,
          warningCount: 5,
        ),
        const SizedBox(height: 10),
        _SessionCard(
          timeText: 'Yesterday, 15:00 - 16:30',
          durationText: '1h 30m',
          score: 74,
          statusText: 'Needs Attention',
          statusColor: AppColors.postureWarning,
          warningCount: 8,
        ),
        const SizedBox(height: 10),
        _SessionCard(
          timeText: '2 Oct, 10:00 - 12:00',
          durationText: '2h 00m',
          score: 90,
          statusText: 'Great Posture',
          statusColor: AppColors.postureGood,
          warningCount: 2,
        ),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  final String timeText;
  final String durationText;
  final int score;
  final String statusText;
  final Color statusColor;
  final int warningCount;

  const _SessionCard({
    required this.timeText,
    required this.durationText,
    required this.score,
    required this.statusText,
    required this.statusColor,
    required this.warningCount,
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
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Left Icon Badge
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.timer_outlined,
              color: statusColor,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),

          // Main Session Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  timeText,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      'Duration: $durationText',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• $warningCount Warnings',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Right Score & Status Pill
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$score/100',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
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
