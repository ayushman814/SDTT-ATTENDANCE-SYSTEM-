import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';
import '../panorama/panorama_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.state,
    this.role,
  });

  final AppState state;
  final String? role;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController emailController;
  late final TextEditingController passwordController;
  final formKey = GlobalKey<FormState>();

  bool obscure = true;
  late String currentRole;

  @override
  void initState() {
    super.initState();
    currentRole = widget.role ?? widget.state.selectedRole ?? 'student';
    final isLecturer = currentRole == 'lecturer' || currentRole == 'teacher';
    final isController = currentRole == 'controller' || currentRole == 'admin';

    String defaultEmail = 'student1@demo.edu';
    String defaultPass = 'student123';
    if (isLecturer) {
      defaultEmail = 'teacher@demo.edu';
      defaultPass = 'teach123';
    } else if (isController) {
      defaultEmail = 'controller@demo.edu';
      defaultPass = 'admin123';
    }

    emailController = TextEditingController(
      text: kDebugMode ? defaultEmail : '',
    );
    passwordController = TextEditingController(
      text: kDebugMode ? defaultPass : '',
    );
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!formKey.currentState!.validate()) return;
    widget.state.setRole(currentRole);
    final success = await widget.state.login(
      emailController.text,
      passwordController.text,
    );

    if (success && mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else if (!success && mounted && widget.state.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.rose,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          content: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  widget.state.error!,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLecturer = currentRole == 'lecturer' || currentRole == 'teacher';
    final isController = currentRole == 'controller' || currentRole == 'admin';
    final roleLabel = isController ? 'Academic Controller' : (isLecturer ? 'Lecturer' : 'Student');
    final roleColor = isController ? const Color(0xFF7C3AED) : (isLecturer ? AppColors.secondary : AppColors.primary);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('$roleLabel Login'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Form(
              key: formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: roleColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        isLecturer ? Icons.co_present_rounded : Icons.school_rounded,
                        color: roleColor,
                        size: 32,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      'Welcome $roleLabel',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Center(
                    child: Text(
                      'Sign in with your verified campus credentials',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: AppColors.slate,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  AppCard(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Campus Email',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            hintText: isLecturer ? 'lecturer@campus.edu' : 'student@campus.edu',
                            prefixIcon: const Icon(Icons.alternate_email_rounded, size: 20),
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Enter your email address';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Password',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: passwordController,
                          obscureText: obscure,
                          decoration: InputDecoration(
                            hintText: 'Enter password',
                            prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                size: 20,
                              ),
                              onPressed: () => setState(() => obscure = !obscure),
                            ),
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) {
                              return 'Enter your password';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),
                        AnimatedPressable(
                          onTap: widget.state.busy ? null : _login,
                          child: Container(
                            height: 50,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: isLecturer
                                    ? [AppColors.secondary, AppColors.primary]
                                    : [AppColors.primary, AppColors.secondary],
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: roleColor.withValues(alpha: 0.3),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Center(
                              child: widget.state.busy
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        valueColor: AlwaysStoppedAnimation(Colors.white),
                                      ),
                                    )
                                  : Text(
                                      'Sign in as $roleLabel',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Center(
                    child: TextButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                            builder: (_) => const PanoramaHomeScreen()),
                      ),
                      icon: const Icon(Icons.panorama_photosphere_rounded,
                          size: 18),
                      label: const Text('Panorama attendance'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
