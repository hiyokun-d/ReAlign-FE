import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

enum HistoryFilter { daily, weekly, monthly }

class HistoryFilterTabs extends StatelessWidget {
  final HistoryFilter selectedFilter;
  final ValueChanged<HistoryFilter> onFilterChanged;

  const HistoryFilterTabs({
    super.key,
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildFilterPill('Daily', HistoryFilter.daily),
          _buildFilterPill('Weekly', HistoryFilter.weekly),
          _buildFilterPill('Monthly', HistoryFilter.monthly),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String label, HistoryFilter filter) {
    final bool isSelected = selectedFilter == filter;

    return Expanded(
      child: GestureDetector(
        onTap: () => onFilterChanged(filter),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
