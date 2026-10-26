import 'package:flutter/material.dart';
import 'screens/controller_screen.dart';
import 'screens/enrollment_screen.dart';
import 'screens/home_screen.dart';
import 'screens/role_selection_screen.dart';
import 'state/app_state.dart';
import 'widgets/app_widgets.dart';

class AttendanceApp extends StatefulWidget {
  const AttendanceApp({super.key});

  @override
  State<AttendanceApp> createState() => _AttendanceAppState();
}

class _AttendanceAppState extends State<AttendanceApp> {
  late final AppState state;

  @override
  void initState() {
    super.initState();
    state = AppState();
    state.addListener(_changed);
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    state.removeListener(_changed);
    state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Classroom Attendance',
      debugShowCheckedModeBanner: false,
      theme: buildTheme().copyWith(
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.android: ZoomPageTransitionsBuilder(),
            TargetPlatform.iOS: ZoomPageTransitionsBuilder(),
            TargetPlatform.linux: ZoomPageTransitionsBuilder(),
            TargetPlatform.macOS: ZoomPageTransitionsBuilder(),
            TargetPlatform.windows: ZoomPageTransitionsBuilder(),
          },
        ),
      ),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 350),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: child,
          );
        },
        child: state.user == null
            ? RoleSelectionScreen(key: const ValueKey('role_select'), state: state)
            : (state.isController
                ? ControllerScreen(key: const ValueKey('controller'), state: state)
                : (state.isStudent && state.enrollmentStatus?.enrolled == false
                    ? EnrollmentScreen(key: const ValueKey('enrollment'), state: state)
                    : HomeScreen(key: const ValueKey('home'), state: state))),
      ),
    );
  }
}
