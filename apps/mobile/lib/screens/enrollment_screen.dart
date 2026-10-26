import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

class EnrollmentScreen extends StatefulWidget {
  const EnrollmentScreen({
    super.key,
    required this.state,
    this.onCompleted,
  });

  final AppState state;
  final VoidCallback? onCompleted;

  @override
  State<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<EnrollmentScreen> {
  final ImagePicker _picker = ImagePicker();
  bool consentAgreed = false;
  XFile? capturedFile;
  bool isEnrolling = false;
  String? enrollmentError;

  Future<void> _takeReferenceSelfie() async {
    setState(() => enrollmentError = null);
    try {
      final photo = await _picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 90,
      );
      if (photo != null) {
        setState(() => capturedFile = photo);
      }
    } catch (e) {
      setState(() => enrollmentError = 'Camera access error: $e');
    }
  }

  Future<void> _submitEnrollment() async {
    if (!consentAgreed) {
      setState(() => enrollmentError = 'Please accept the consent terms to proceed.');
      return;
    }
    if (capturedFile == null) {
      setState(() => enrollmentError = 'Please capture a clear reference selfie.');
      return;
    }

    setState(() {
      isEnrolling = true;
      enrollmentError = null;
    });

    try {
      final bytes = await capturedFile!.readAsBytes();
      await widget.state.api.enrollReferenceSelfie(bytes, true);
      await widget.state.checkEnrollment();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.emerald,
            content: Text('Reference selfie enrolled successfully!'),
          ),
        );
        widget.onCompleted?.call();
      }
    } catch (e) {
      setState(() => enrollmentError = e.toString());
    } finally {
      if (mounted) setState(() => isEnrolling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.state.user?.displayRole ?? 'User';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('$role Verification Enrollment'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_outlined, color: AppColors.primary, size: 36),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'One-Time Biometric Reference',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: AppColors.ink,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Enroll one frontal selfie to verify your presence during attendance sweeps.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.slate.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Camera Frame / Selfie Preview
              Center(
                child: Container(
                  width: 220,
                  height: 260,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: capturedFile != null ? AppColors.emerald : AppColors.line,
                      width: 2,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: capturedFile != null
                        ? (kIsWeb
                            ? Image.network(capturedFile!.path, fit: BoxFit.cover)
                            : Image.file(File(capturedFile!.path), fit: BoxFit.cover))
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.face_rounded,
                                size: 64,
                                color: AppColors.slate.withValues(alpha: 0.5),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Front camera only\nSingle face in frame',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.slate,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Camera trigger button
              Center(
                child: OutlinedButton.icon(
                  onPressed: isEnrolling ? null : _takeReferenceSelfie,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(capturedFile != null ? 'Retake Selfie' : 'Capture Front Selfie'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Consent Agreement Box
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: consentAgreed,
                          activeColor: AppColors.primary,
                          onChanged: (v) => setState(() => consentAgreed = v == true),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => consentAgreed = !consentAgreed),
                            child: const Text(
                              'I consent to enrollment of an encrypted facial reference embedding for classroom attendance verification. I understand the raw photo will be discarded after feature extraction, and only an encrypted template with timestamp is stored.',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.ink,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              if (enrollmentError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    enrollmentError!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.rose,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),

              // Submit button
              AnimatedPressable(
                onTap: isEnrolling || !consentAgreed || capturedFile == null
                    ? null
                    : _submitEnrollment,
                child: Container(
                  height: 50,
                  decoration: BoxDecoration(
                    gradient: consentAgreed && capturedFile != null
                        ? AppColors.primaryGradient
                        : null,
                    color: consentAgreed && capturedFile != null
                        ? null
                        : AppColors.line,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: isEnrolling
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : Text(
                            'Enroll Biometric Reference',
                            style: TextStyle(
                              color: consentAgreed && capturedFile != null
                                  ? Colors.white
                                  : AppColors.slate,
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
      ),
    );
  }
}
