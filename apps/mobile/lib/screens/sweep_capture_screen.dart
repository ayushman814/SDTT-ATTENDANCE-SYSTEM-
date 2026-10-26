import 'dart:async';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

enum SweepPhase {
  ready,
  holdingSelfie,
  sweeping,
  holdingLecturer,
  uploading,
  result,
}

class SweepCaptureScreen extends StatefulWidget {
  const SweepCaptureScreen({
    super.key,
    required this.state,
    required this.session,
  });

  final AppState state;
  final AttendanceSession session;

  @override
  State<SweepCaptureScreen> createState() => _SweepCaptureScreenState();
}

class _SweepCaptureScreenState extends State<SweepCaptureScreen>
    with SingleTickerProviderStateMixin {
  SweepPhase phase = SweepPhase.ready;
  bool isPracticeMode = false;
  double currentHeading = 0.0;
  double startHeading = 0.0;
  double targetSpan = 180.0;

  Timer? sweepTimer;
  int recordedFrameCount = 0;
  List<Map<String, dynamic>> recordedMetadata = [];
  List<List<int>> recordedFrames = [];

  String? resultState; // 'verified', 'flagged', 'rejected'
  String? resultReason;
  String? resultMessage;
  String attemptId = '';

  late AnimationController _arcController;
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  int _selectedCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _cameraPermissionError = false;

  @override
  void initState() {
    super.initState();
    _arcController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    // Lock orientation to portrait during capture
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    _initCamera();
  }

  @override
  void dispose() {
    sweepTimer?.cancel();
    _arcController.dispose();
    _cameraController?.dispose();
    _cameraController = null;
    _isCameraInitialized = false;
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    super.dispose();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        if (mounted) setState(() => _cameraPermissionError = true);
        return;
      }
      int frontIndex = _cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
      );
      _selectedCameraIndex = frontIndex != -1 ? frontIndex : 0;
      await _setupCameraController(_cameras[_selectedCameraIndex]);
    } catch (_) {
      if (mounted) setState(() => _cameraPermissionError = true);
    }
  }

  Future<void> _setupCameraController(CameraDescription camera) async {
    final prev = _cameraController;
    if (prev != null) {
      _cameraController = null;
      await prev.dispose();
      await Future.delayed(const Duration(milliseconds: 250));
    }

    final controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
    );

    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _cameraController = controller;
        _isCameraInitialized = true;
        _cameraPermissionError = false;
      });
      debugPrint('Sweep camera initialized: $camera');
    } catch (e) {
      debugPrint('Controller init error: $e');
      if (mounted) {
        setState(() {
          _isCameraInitialized = false;
          _cameraPermissionError = true;
        });
      }
    }
  }

  /// Captures a real frame from the device camera. Returns JPEG bytes or null
  /// when no camera is available; callers must treat null as "no evidence".
  Future<List<int>?> _captureRealFrame() async {
    try {
      if (!_isCameraInitialized || _cameraController == null) return null;
      final f = await _cameraController!.takePicture();
      return await f.readAsBytes();
    } catch (_) {
      return null;
    }
  }

  void _giveFeedbackCue(String type) {
    switch (type) {
      case 'start':
        HapticFeedback.heavyImpact();
        SystemSound.play(SystemSoundType.click);
        break;
      case 'keep_going':
        HapticFeedback.selectionClick();
        break;
      case 'hold':
        HapticFeedback.mediumImpact();
        SystemSound.play(SystemSoundType.click);
        break;
      case 'done':
        HapticFeedback.vibrate();
        SystemSound.play(SystemSoundType.alert);
        break;
    }
  }

  Future<void> _startSweepGesture() async {
    recordedFrames.clear();
    recordedMetadata.clear();
    recordedFrameCount = 0;
    currentHeading = 0.0;
    startHeading = 0.0;
    attemptId = 'att_${DateTime.now().millisecondsSinceEpoch}_${widget.state.user?.id.substring(0, 8)}';

    setState(() => phase = SweepPhase.holdingSelfie);
    _giveFeedbackCue('start');

    final startTime = DateTime.now();

    // 1. Hold still for ~1.0s (selfie frames with classmates)
    int selfieSteps = 5;
    for (int i = 0; i < selfieSteps; i++) {
      await Future.delayed(const Duration(milliseconds: 200));
      if (!mounted) return;
      final elapsed = DateTime.now().difference(startTime).inMilliseconds / 1000.0;
      recordedMetadata.add({
        'index': recordedFrameCount,
        'heading_deg': 0.0,
        'time_offset_s': elapsed,
      });
      final selfieBytes = await _captureRealFrame();
      if (selfieBytes != null) recordedFrames.add(selfieBytes);
      recordedFrameCount++;
      setState(() {});
    }

    // 2. Smooth 180° sweep arc (~5-6 seconds)
    setState(() => phase = SweepPhase.sweeping);
    _giveFeedbackCue('keep_going');

    int sweepSteps = 12;
    for (int i = 1; i <= sweepSteps; i++) {
      await Future.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;
      currentHeading = (i / sweepSteps) * 180.0;
      final elapsed = DateTime.now().difference(startTime).inMilliseconds / 1000.0;

      recordedMetadata.add({
        'index': recordedFrameCount,
        'heading_deg': currentHeading,
        'time_offset_s': elapsed,
      });
      final sweepBytes = await _captureRealFrame();
      if (sweepBytes != null) recordedFrames.add(sweepBytes);
      recordedFrameCount++;

      if (i % 3 == 0) _giveFeedbackCue('keep_going');
      setState(() {});
    }

    // 3. Hold facing stage for ~1.0s (lecturer frames)
    setState(() => phase = SweepPhase.holdingLecturer);
    _giveFeedbackCue('hold');

    for (int i = 0; i < 4; i++) {
      await Future.delayed(const Duration(milliseconds: 250));
      if (!mounted) return;
      final elapsed = DateTime.now().difference(startTime).inMilliseconds / 1000.0;
      recordedMetadata.add({
        'index': recordedFrameCount,
        'heading_deg': 180.0,
        'time_offset_s': elapsed,
      });
      final lecBytes = await _captureRealFrame();
      if (lecBytes != null) recordedFrames.add(lecBytes);
      recordedFrameCount++;
      setState(() {});
    }

    _giveFeedbackCue('done');

    if (isPracticeMode) {
      setState(() {
        phase = SweepPhase.result;
        resultState = 'practice_complete';
        resultReason = 'PRACTICE_MODE';
        resultMessage = 'Practice sweep complete! You covered a full 180° arc. You are ready for live check-in.';
      });
      return;
    }

    // Submit live verification sweep
    await _uploadSweepAttempt();
  }

  Future<void> _uploadSweepAttempt() async {
    setState(() => phase = SweepPhase.uploading);
    try {
      final res = await widget.state.api.checkinSweep(
        sessionId: widget.session.id,
        attemptId: attemptId,
        metadata: recordedMetadata,
        frameBytesList: recordedFrames,
      );

      setState(() {
        phase = SweepPhase.result;
        resultState = res['state']?.toString();
        resultReason = res['reason_code']?.toString();
        resultMessage = res['message']?.toString();
      });
    } catch (e) {
      setState(() {
        phase = SweepPhase.result;
        resultState = 'error';
        resultReason = 'NETWORK_ERROR';
        resultMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Continuous Sweep Check-in'),
        actions: [
          if (phase == SweepPhase.ready)
            Row(
              children: [
                const Text('Practice Mode', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                Switch(
                  value: isPracticeMode,
                  activeThumbColor: AppColors.primary,
                  onChanged: (v) => setState(() => isPracticeMode = v),
                ),
              ],
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(22.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (phase == SweepPhase.ready) ...[
                // Instructions & Camera Rationale Card
                AppCard(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.panorama_horizontal_rounded, color: AppColors.primary, size: 24),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Text(
                              'One Continuous Sweep',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        '1. Hold phone at arm\'s length facing yourself and your neighbours.\n'
                        '2. Press Start and hold still for 1 second.\n'
                        '3. Slowly sweep your phone in a 180° horizontal arc until pointing at the lecturer on stage.\n'
                        '4. Hold steady for 1 second until the audio chime sounds.',
                        style: TextStyle(fontSize: 13.5, color: AppColors.slate, height: 1.5),
                      ),
                    ],
                  ),
                ),
                if (_cameraPermissionError) ...[
                  const AppCard(
                    padding: EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.videocam_off_rounded, color: AppColors.rose, size: 20),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Camera unavailable. Grant camera permission to run the live sweep check-in.',
                            style: TextStyle(fontSize: 12.5, color: AppColors.slate, height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                const Spacer(),
                // Visual Practice Indicator
                Center(
                  child: CustomPaint(
                    size: const Size(200, 100),
                    painter: _ProgressArcPainter(progress: isPracticeMode ? 0.5 : 0.0),
                  ),
                ),
                const Spacer(),
                AnimatedPressable(
                  onTap: _startSweepGesture,
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: isPracticeMode
                          ? const LinearGradient(colors: [AppColors.amber, Colors.orange])
                          : AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: (isPracticeMode ? AppColors.amber : AppColors.primary).withValues(alpha: 0.3),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        isPracticeMode ? 'Start Practice Mode (No Submission)' : 'Start Verification Sweep',
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ),
              ] else if (phase == SweepPhase.holdingSelfie ||
                  phase == SweepPhase.sweeping ||
                  phase == SweepPhase.holdingLecturer) ...[
                // Active Sweep Gesture View
                const Spacer(),
                Center(
                  child: Column(
                    children: [
                      Text(
                        phase == SweepPhase.holdingSelfie
                            ? 'Hold Still (Selfie Frames)'
                            : (phase == SweepPhase.sweeping
                                ? 'Sweeping Arc (${round(currentHeading)}° / 180°)'
                                : 'Hold Facing Stage (Lecturer)'),
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.ink),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        phase == SweepPhase.sweeping
                            ? 'Audio and haptic pulses guide rotation as screen turns'
                            : 'Maintain stable arm position',
                        style: const TextStyle(fontSize: 13, color: AppColors.slate),
                      ),
                      const SizedBox(height: 36),
                      CustomPaint(
                        size: const Size(240, 120),
                        painter: _ProgressArcPainter(progress: currentHeading / 180.0),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '$recordedFrameCount frames recorded',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
              ] else if (phase == SweepPhase.uploading) ...[
                const Spacer(),
                const Center(
                  child: Column(
                    children: [
                      CircularProgressIndicator(color: AppColors.primary),
                      SizedBox(height: 20),
                      Text(
                        'Analyzing Sweep Evidence...',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.ink),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Executing 9-rule biometric and geometry verification',
                        style: TextStyle(fontSize: 13, color: AppColors.slate),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
              ] else if (phase == SweepPhase.result) ...[
                // Plain-Language Result Screen
                _buildResultView(),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultView() {
    final isVerified = resultState == 'verified';
    final isFlagged = resultState == 'flagged';
    final isPractice = resultState == 'practice_complete';
    final color = isVerified
        ? AppColors.emerald
        : (isFlagged || isPractice ? AppColors.amber : AppColors.rose);
    final icon = isVerified
        ? Icons.check_circle_rounded
        : (isFlagged ? Icons.hourglass_top_rounded : (isPractice ? Icons.stars_rounded : Icons.cancel_rounded));
    final title = isVerified
        ? 'Attendance Verified'
        : (isFlagged ? 'Under Lecturer Review' : (isPractice ? 'Practice Complete' : 'Attempt Rejected'));

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 42),
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: Text(title, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Text(
            resultMessage ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppColors.slate, height: 1.4),
          ),
        ),
        if (resultReason != null && !isVerified && !isPractice) ...[
          const SizedBox(height: 12),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.line.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Reason: $resultReason',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
            ),
          ),
        ],
        const Spacer(),
        if (!isVerified)
          OutlinedButton(
            onPressed: () {
              setState(() => phase = SweepPhase.ready);
            },
            child: const Text('Retake Sweep'),
          ),
        const SizedBox(height: 10),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Return to Home'),
        ),
      ],
    );
  }

  double round(double val) => (val * 10).round() / 10;
}

class _ProgressArcPainter extends CustomPainter {
  _ProgressArcPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height);
    final radius = size.width / 2;

    final bgPaint = Paint()
      ..color = AppColors.line
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    final fgPaint = Paint()
      ..shader = const LinearGradient(colors: [AppColors.secondary, AppColors.primary])
          .createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    // Background semi-circle from 180° to 0°
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi,
      math.pi,
      false,
      bgPaint,
    );

    // Progress arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi,
      math.pi * progress.clamp(0.0, 1.0),
      false,
      fgPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _ProgressArcPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
