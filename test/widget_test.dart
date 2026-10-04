import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:realign_app/main.dart';

void main() {
  testWidgets('App renders without crash', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: ReAlignApp()),
    );
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
