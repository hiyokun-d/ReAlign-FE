import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

class LiveAngleChart extends StatelessWidget {
  final List<FlSpot> points;
  final double currentAngle;

  const LiveAngleChart({
    super.key,
    required this.points,
    required this.currentAngle,
  });

  @override
  Widget build(BuildContext context) {
    final double maxVal = points.fold<double>(
      30.0,
      (prev, spot) => spot.y > prev ? spot.y + 5 : prev,
    );

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
                'POSTURE ANGLE',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: 0.8,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${currentAngle.toStringAsFixed(1)}°',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Chart Container
          SizedBox(
            height: 180,
            child: LineChart(
              LineChartData(
                minX: points.isNotEmpty ? points.first.x : 0,
                maxX: points.isNotEmpty ? points.last.x : 20,
                minY: 0,
                maxY: maxVal < 30 ? 30 : maxVal,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) {
                    if (value == 20) {
                      return FlLine(
                        color: AppColors.postureWarning,
                        strokeWidth: 1.5,
                        dashArray: [6, 4],
                      );
                    }
                    if (value == 25) {
                      return FlLine(
                        color: AppColors.postureBad,
                        strokeWidth: 1.5,
                        dashArray: [4, 4],
                      );
                    }
                    return FlLine(
                      color: AppColors.background,
                      strokeWidth: 1,
                    );
                  },
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 75,
                      getTitlesWidget: (value, meta) {
                        if (value == 20) {
                          return Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: Text(
                              '20° Threshold',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.postureWarning,
                              ),
                            ),
                          );
                        }
                        if (value == 25) {
                          return Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: Text(
                              '25° Warning',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.postureBad,
                              ),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      getTitlesWidget: (value, meta) {
                        if (value == 0 || value == 10 || value == 20 || value == 30) {
                          return Text(
                            '${value.toInt()}°',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  bottomTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: points,
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: currentAngle > 20 ? AppColors.postureBad : AppColors.primary,
                    barWidth: 3.5,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: (currentAngle > 20 ? AppColors.postureBad : AppColors.primary)
                          .withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
