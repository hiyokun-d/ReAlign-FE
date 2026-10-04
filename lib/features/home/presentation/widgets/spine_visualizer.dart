import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

/// Reusable Spine Visualizer widget.
/// Renders 3 sensor points (Neck, Upper Back, Lower Back) connected by a thick curved red stem.
class SpineVisualizer extends StatelessWidget {
  final double neckAngle;
  final double backAngle;
  final double curveOffset;
  final String statusText;
  final bool isBalanced;

  const SpineVisualizer({
    super.key,
    this.neckAngle = 12.0,
    this.backAngle = 8.0,
    this.curveOffset = 0.0,
    this.statusText = 'Sumbu Seimbang',
    this.isBalanced = true,
  });

  @override
  Widget build(BuildContext context) {
    final Color badgeColor = isBalanced ? const Color(0xFF047857) : AppColors.postureBad;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Spine Canvas
        SizedBox(
          height: 170,
          width: double.infinity,
          child: CustomPaint(
            painter: _SpinePainter(
              neckAngle: neckAngle,
              backAngle: backAngle,
              curveOffset: curveOffset,
              isBalanced: isBalanced,
            ),
          ),
        ),
        const SizedBox(height: 20),

        // Status indicator row at bottom
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: badgeColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              statusText,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: badgeColor,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SpinePainter extends CustomPainter {
  final double neckAngle;
  final double backAngle;
  final double curveOffset;
  final bool isBalanced;

  _SpinePainter({
    required this.neckAngle,
    required this.backAngle,
    required this.curveOffset,
    required this.isBalanced,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final centerX = size.width / 2;
    final topY = 20.0;
    final middleY = size.height / 2;
    final bottomY = size.height - 20.0;

    // Node positions (with slight dynamic shift support)
    final topPoint = Offset(centerX - 3, topY);
    final middlePoint = Offset(centerX - 4 + curveOffset, middleY);
    final bottomPoint = Offset(centerX - 2, bottomY);

    // 1. Draw Thick Red Stem Line
    final stemColor = isBalanced ? const Color(0xFFC5221F) : AppColors.postureBad;
    final stemPaint = Paint()
      ..color = stemColor
      ..strokeWidth = 11.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    // Segment 1: Top to Middle (bowing right)
    final path1 = Path()..moveTo(topPoint.dx, topPoint.dy);
    path1.cubicTo(
      topPoint.dx + 26,
      topPoint.dy + (middlePoint.dy - topPoint.dy) * 0.35,
      middlePoint.dx + 26,
      topPoint.dy + (middlePoint.dy - topPoint.dy) * 0.75,
      middlePoint.dx,
      middlePoint.dy,
    );
    canvas.drawPath(path1, stemPaint);

    // Segment 2: Middle to Bottom (bowing left)
    final path2 = Path()..moveTo(middlePoint.dx, middlePoint.dy);
    path2.cubicTo(
      middlePoint.dx - 26,
      middlePoint.dy + (bottomPoint.dy - middlePoint.dy) * 0.25,
      bottomPoint.dx - 26,
      middlePoint.dy + (bottomPoint.dy - middlePoint.dy) * 0.65,
      bottomPoint.dx,
      bottomPoint.dy,
    );
    canvas.drawPath(path2, stemPaint);

    // 2. Draw 3 Circular Sensor Nodes (Solid filled circles as in reference image):
    // Top Node: Bright Royal Blue
    canvas.drawCircle(topPoint, 15.0, Paint()..color = const Color(0xFF2563EB));

    // Middle Node: Bright Mint/Cyan Green
    canvas.drawCircle(middlePoint, 12.0, Paint()..color = const Color(0xFF2DD4BF));

    // Bottom Node: Deep Blue
    canvas.drawCircle(bottomPoint, 14.0, Paint()..color = const Color(0xFF1D4ED8));
  }

  @override
  bool shouldRepaint(covariant _SpinePainter oldDelegate) {
    return oldDelegate.neckAngle != neckAngle ||
        oldDelegate.backAngle != backAngle ||
        oldDelegate.curveOffset != curveOffset ||
        oldDelegate.isBalanced != isBalanced;
  }
}
