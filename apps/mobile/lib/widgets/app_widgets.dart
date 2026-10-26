import 'dart:async' as async;
import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Ultra-modern design palette for Classroom Attendance
class AppColors {
  AppColors._();

  // Primary & Accents
  static const primary = Color(0xFF4F46E5); // Electric Indigo
  static const primaryDark = Color(0xFF3730A3);
  static const primaryLight = Color(0xFF818CF8);
  static const secondary = Color(0xFF0EA5E9); // Bright Sky / Cyan
  static const secondaryDark = Color(0xFF0284C7);

  // Status Colors
  static const emerald = Color(0xFF10B981); // Present / Success
  static const emeraldBg = Color(0xFFECFDF5);
  static const emeraldBorder = Color(0xFFA7F3D0);

  static const rose = Color(0xFFF43F5E); // Absent / Alert
  static const roseBg = Color(0xFFFFF1F2);
  static const roseBorder = Color(0xFFFECDD3);

  static const amber = Color(0xFFF59E0B); // Pending / Warning
  static const amberBg = Color(0xFFFFFBEB);
  static const amberBorder = Color(0xFFFDE68A);

  // Surfaces & Backgrounds
  static const background = Color(0xFFF8FAFC); // Slate-50 canvas
  static const card = Color(0xFFFFFFFF);
  static const cardSubtle = Color(0xFFF1F5F9);

  // Typography
  static const ink = Color(0xFF0F172A); // Slate-900
  static const slate = Color(0xFF475569); // Slate-600
  static const muted = Color(0xFF94A3B8); // Slate-400
  static const border = Color(0xFFE2E8F0); // Slate-200
  static const line = border;
  static const borderHighlight = Color(0xFFCBD5E1);

  // Gradients
  static const primaryGradient = LinearGradient(
    colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const studentHeroGradient = LinearGradient(
    colors: [Color(0xFF0F172A), Color(0xFF1E1B4B), Color(0xFF312E81)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const teacherHeroGradient = LinearGradient(
    colors: [Color(0xFF042F2E), Color(0xFF064E3B), Color(0xFF065F46)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const accentGradient = LinearGradient(
    colors: [Color(0xFF0EA5E9), Color(0xFF10B981)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

/// App theme with modern typography, smooth shapes, and crisp contrast
ThemeData buildTheme() {
  const fontFamily = 'sans-serif';

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.card,
    ),
    fontFamily: fontFamily,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      iconTheme: IconThemeData(color: AppColors.ink),
      titleTextStyle: TextStyle(
        color: AppColors.ink,
        fontSize: 22,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w900,
        color: AppColors.ink,
        letterSpacing: -0.8,
        height: 1.15,
      ),
      headlineMedium: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        color: AppColors.ink,
        letterSpacing: -0.5,
      ),
      titleLarge: TextStyle(
        fontSize: 19,
        fontWeight: FontWeight.w800,
        color: AppColors.ink,
        letterSpacing: -0.3,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      bodyLarge: TextStyle(
        fontSize: 15,
        height: 1.5,
        color: AppColors.slate,
      ),
      bodyMedium: TextStyle(
        fontSize: 13.5,
        height: 1.45,
        color: AppColors.slate,
      ),
      labelSmall: TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w600,
        color: AppColors.muted,
        letterSpacing: 0.3,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      labelStyle: const TextStyle(color: AppColors.slate, fontSize: 14),
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
      prefixIconColor: AppColors.slate,
      suffixIconColor: AppColors.slate,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.rose, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.rose, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.ink,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        side: const BorderSide(color: AppColors.border, width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      elevation: 3,
      shadowColor: Colors.black12,
      height: 68,
      indicatorColor: AppColors.primary.withValues(alpha: 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: AppColors.primary,
          );
        }
        return const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.slate,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: AppColors.primary, size: 24);
        }
        return const IconThemeData(color: AppColors.slate, size: 24);
      }),
    ),
  );
}

/// Tactile bounce effect for pressable elements
class AnimatedPressable extends StatefulWidget {
  const AnimatedPressable({
    super.key,
    required this.child,
    this.onTap,
    this.scaleDown = 0.96,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scaleDown;

  @override
  State<AnimatedPressable> createState() => _AnimatedPressableState();
}

class _AnimatedPressableState extends State<AnimatedPressable> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? (_) => setState(() => _pressed = true) : null,
      onTapUp: widget.onTap != null ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: widget.onTap != null ? () => setState(() => _pressed = false) : null,
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedScale(
        scale: _pressed ? widget.scaleDown : 1.0,
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}

/// Staggered Fade & Slide In Entrance
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 450),
    this.offsetY = 24.0,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final double offsetY;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _slide;
  async.Timer? _timer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _slide = Tween<double>(begin: widget.offsetY, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );

    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      _timer = async.Timer(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => Opacity(
        opacity: _fade.value,
        child: Transform.translate(
          offset: Offset(0, _slide.value),
          child: child,
        ),
      ),
      child: widget.child,
    );
  }
}

/// Modern AppCard with delicate borders, subtle elevation, and rounded geometry
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin,
    this.backgroundColor,
    this.borderColor,
    this.borderRadius = 22.0,
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets? margin;
  final Color? backgroundColor;
  final Color? borderColor;
  final double borderRadius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.card,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor ?? AppColors.border,
          width: 1.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x060F172A),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
          BoxShadow(
            color: Color(0x040F172A),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return AnimatedPressable(
        onTap: onTap,
        child: cardContent,
      );
    }
    return cardContent;
  }
}

/// Modern Status Pill with icon and animated glowing styling
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.compact = false});

  final String status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();

    Color bg;
    Color border;
    Color text;
    IconData icon;

    switch (normalized) {
      case 'present':
        bg = AppColors.emeraldBg;
        border = AppColors.emeraldBorder;
        text = AppColors.emerald;
        icon = Icons.check_circle_rounded;
        break;
      case 'absent':
        bg = AppColors.roseBg;
        border = AppColors.roseBorder;
        text = AppColors.rose;
        icon = Icons.cancel_rounded;
        break;
      case 'finalized':
        bg = const Color(0xFFF1F5F9);
        border = const Color(0xFFCBD5E1);
        text = AppColors.slate;
        icon = Icons.lock_clock_rounded;
        break;
      case 'open':
        bg = const Color(0xFFEFF6FF);
        border = const Color(0xFFBFDBFE);
        text = AppColors.primary;
        icon = Icons.radio_button_checked_rounded;
        break;
      default: // pending
        bg = AppColors.amberBg;
        border = AppColors.amberBorder;
        text = AppColors.amber;
        icon = Icons.schedule_rounded;
    }

    final label = normalized.isEmpty
        ? 'Pending'
        : normalized[0].toUpperCase() + normalized.substring(1);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 11,
        vertical: compact ? 4 : 5.5,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: compact ? 12 : 14, color: text),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: text,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 11 : 12,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular Animated Gauge for Student Attendance Card
class CircularAttendanceGauge extends StatelessWidget {
  const CircularAttendanceGauge({
    super.key,
    required this.percentage,
    this.size = 110.0,
    this.strokeWidth = 10.0,
  });

  final double percentage; // 0 - 100
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: percentage.clamp(0.0, 100.0)),
      duration: const Duration(milliseconds: 1200),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        final ratio = value / 100.0;
        final color = ratio >= 0.75
            ? AppColors.emerald
            : ratio >= 0.60
                ? AppColors.amber
                : AppColors.rose;

        return SizedBox(
          width: size,
          height: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: Size(size, size),
                painter: _GaugePainter(
                  ratio: ratio,
                  strokeWidth: strokeWidth,
                  color: color,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${value.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: size * 0.24,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -1,
                    ),
                  ),
                  Text(
                    'Attendance',
                    style: TextStyle(
                      fontSize: size * 0.10,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({
    required this.ratio,
    required this.strokeWidth,
    required this.color,
  });

  final double ratio;
  final double strokeWidth;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Track paint
    final trackPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, trackPaint);

    // Progress paint with gradient-like glow
    final progressPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * ratio;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.ratio != ratio || old.color != color;
}

/// Multi-color Animated Attendance Bar
class AttendanceBreakdownBar extends StatelessWidget {
  const AttendanceBreakdownBar({
    super.key,
    required this.present,
    required this.absent,
    required this.pending,
    this.height = 8.0,
  });

  final int present;
  final int absent;
  final int pending;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total = present + absent + pending;
    if (total == 0) {
      return Container(
        height: height,
        decoration: BoxDecoration(
          color: AppColors.cardSubtle,
          borderRadius: BorderRadius.circular(height / 2),
        ),
      );
    }

    final pRatio = present / total;
    final aRatio = absent / total;
    final pendRatio = pending / total;

    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: Container(
        height: height,
        color: AppColors.cardSubtle,
        child: Row(
          children: [
            if (present > 0)
              Expanded(
                flex: (pRatio * 1000).toInt(),
                child: Container(color: AppColors.emerald),
              ),
            if (absent > 0)
              Expanded(
                flex: (aRatio * 1000).toInt(),
                child: Container(color: AppColors.rose),
              ),
            if (pending > 0)
              Expanded(
                flex: (pendRatio * 1000).toInt(),
                child: Container(color: AppColors.amber),
              ),
          ],
        ),
      ),
    );
  }
}

/// Error / Offline State Panel
class ErrorPanel extends StatelessWidget {
  const ErrorPanel({
    super.key,
    required this.message,
    required this.onRetry,
    this.secondaryLabel = 'Use manual roll call',
  });

  final String message;
  final VoidCallback onRetry;
  final String secondaryLabel;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      backgroundColor: AppColors.roseBg,
      borderColor: AppColors.roseBorder,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.rose.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.wifi_off_rounded,
                  color: AppColors.rose,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Connection error',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.rose,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.ink,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              FilledButton.icon(
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.rose,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Try again'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Premium Empty State with ambient glow circle and crisp typography
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.12),
                    AppColors.secondary.withValues(alpha: 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 34, color: AppColors.primary),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.45,
                    color: AppColors.slate,
                  ),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              FilledButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.prefixIcon,
    this.obscureText = false,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData? prefixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: AppColors.slate,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.ink),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: AppColors.muted),
            prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 20, color: AppColors.slate) : null,
            filled: true,
            fillColor: AppColors.cardSubtle,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

