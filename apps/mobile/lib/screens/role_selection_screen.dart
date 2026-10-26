import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';
import 'login_screen.dart';

class RoleSelectionScreen extends StatelessWidget {
  const RoleSelectionScreen({super.key, required this.state});
  final AppState state;

  void _chooseRole(BuildContext context, String role) {
    state.setRole(role);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LoginScreen(state: state, role: role),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 1),
              // Brand Mark
              Center(
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: AppColors.accentGradient,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.25),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'A',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Center(
                child: Text(
                  'Attendrix',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: AppColors.ink,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Center(
                child: Text(
                  'Classroom Attendance & Verification',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.slate,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const Spacer(flex: 2),
              const Text(
                'Select your role to continue',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 16),

              // Student Card
              _RoleCard(
                title: 'I am a Student',
                description: 'Mark attendance via continuous sweep, view personal history, and receive updates.',
                icon: Icons.school_rounded,
                color: AppColors.primary,
                onTap: () => _chooseRole(context, 'student'),
              ),
              const SizedBox(height: 16),

              // Lecturer Card
              _RoleCard(
                title: 'I am a Lecturer',
                description: 'Start timed classroom sessions, monitor live check-ins, and review flagged attempts.',
                icon: Icons.co_present_rounded,
                color: AppColors.secondary,
                onTap: () => _chooseRole(context, 'lecturer'),
              ),
              const SizedBox(height: 16),

              // Controller Card
              _RoleCard(
                title: 'Academic Controller',
                description: 'Add and manage classes, sections, student rosters, and registration locks.',
                icon: Icons.admin_panel_settings_rounded,
                color: const Color(0xFF7C3AED),
                onTap: () => _chooseRole(context, 'controller'),
              ),

              const Spacer(flex: 2),
              Center(
                child: Text(
                  'Server-authoritative attendance integrity • Quiet Signal System',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.slate.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedPressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.25), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.slate,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.arrow_forward_ios_rounded, color: color, size: 16),
          ],
        ),
      ),
    );
  }
}
