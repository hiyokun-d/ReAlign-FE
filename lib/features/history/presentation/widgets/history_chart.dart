import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import 'history_filter_tabs.dart';

class HistoryChart extends StatelessWidget {
  final HistoryFilter filter;

  const HistoryChart({
    super.key,
    this.filter = HistoryFilter.weekly,
  });

  @override
  Widget build(BuildContext context) {
    final List<String> labels = _getLabels();
    final List<double> values = _getValues();

    return Container(
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _getChartTitle(),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.postureGood.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _getAverageScoreText(),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.postureGood,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Bar Chart
          SizedBox(
            height: 190,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: 100,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => AppColors.primary,
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      return BarTooltipItem(
                        '${rod.toY.toInt()}/100',
                        const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (value, meta) {
                        if (value == 0 || value == 50 || value == 100) {
                          return Text(
                            '${value.toInt()}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (double value, TitleMeta meta) {
                        final int index = value.toInt();
                        if (index >= 0 && index < labels.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              labels[index],
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) {
                    return FlLine(
                      color: AppColors.background,
                      strokeWidth: 1,
                    );
                  },
                ),
                barGroups: List.generate(
                  labels.length,
                  (index) => _makeGroupData(index, values[index]),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getChartTitle() {
    switch (filter) {
      case HistoryFilter.daily:
        return 'Today\'s Hourly Score';
      case HistoryFilter.weekly:
        return 'Weekly Posture Score';
      case HistoryFilter.monthly:
        return 'Monthly Average Score';
    }
  }

  String _getAverageScoreText() {
    switch (filter) {
      case HistoryFilter.daily:
        return 'Avg 86/100';
      case HistoryFilter.weekly:
        return 'Avg 87/100';
      case HistoryFilter.monthly:
        return 'Avg 84/100';
    }
  }

  List<String> _getLabels() {
    switch (filter) {
      case HistoryFilter.daily:
        return ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM'];
      case HistoryFilter.weekly:
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      case HistoryFilter.monthly:
        return ['W1', 'W2', 'W3', 'W4'];
    }
  }

  List<double> _getValues() {
    switch (filter) {
      case HistoryFilter.daily:
        return [82, 90, 78, 88, 92, 85];
      case HistoryFilter.weekly:
        return [85, 90, 78, 92, 88, 95, 82];
      case HistoryFilter.monthly:
        return [82, 88, 85, 84];
    }
  }

  BarChartGroupData _makeGroupData(int x, double y) {
    final bool isTopScore = y >= 90;

    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          color: isTopScore ? AppColors.postureGood : AppColors.primary,
          width: 14,
          borderRadius: BorderRadius.circular(6),
          backDrawRodData: BackgroundBarChartRodData(
            show: true,
            toY: 100,
            color: AppColors.background,
          ),
        ),
      ],
    );
  }
}
