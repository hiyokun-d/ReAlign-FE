import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../widgets/history_filter_tabs.dart';
import '../widgets/history_chart.dart';
import '../widgets/history_summary_cards.dart';
import '../widgets/recent_sessions_list.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  HistoryFilter _selectedFilter = HistoryFilter.weekly;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // ==========================================
            // 1. TOP HEADER (Deep Indigo Header)
            // ==========================================
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(36),
                  bottomRight: Radius.circular(36),
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    children: [
                      // Top White Block Container for Title & Logo
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Left: Logo & Title
                            Row(
                              children: [
                                Image.asset(
                                  'assets/icons/realign_logo.png',
                                  height: 34,
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) {
                                    return const SizedBox.shrink();
                                  },
                                ),
                                const SizedBox(width: 10),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Posture History',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.primary,
                                        letterSpacing: -0.4,
                                      ),
                                    ),
                                    Text(
                                      'Natasha',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),

                            // Right: Calendar / Export Action Icon
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.calendar_today_rounded,
                                color: AppColors.textPrimary,
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              child: Column(
                children: [
                  // 1. FILTER TABS (Daily / Weekly / Monthly)
                  HistoryFilterTabs(
                    selectedFilter: _selectedFilter,
                    onFilterChanged: (filter) {
                      setState(() {
                        _selectedFilter = filter;
                      });
                    },
                  ),
                  const SizedBox(height: 18),

                  // 2. POSTURE SCORE CHART
                  HistoryChart(
                    filter: _selectedFilter,
                  ),
                  const SizedBox(height: 18),

                  // 3. SUMMARY STATS (Good vs Poor Duration, Avg Angles, Warnings)
                  HistorySummaryCards(
                    filter: _selectedFilter,
                  ),
                  const SizedBox(height: 20),

                  // 4. RECENT SESSIONS LIST
                  const RecentSessionsList(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
