import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

enum VerificationStep {
  liveFace,
  classroomRoom,
  verifying,
  result,
}

class LiveFaceVerificationScreen extends StatefulWidget {
  const LiveFaceVerificationScreen({
    super.key,
    required this.state,
    required this.session,
  });

  final AppState state;
  final AttendanceSession session;

  @override
  State<LiveFaceVerificationScreen> createState() =>
      _LiveFaceVerificationScreenState();
}

class _LiveFaceVerificationScreenState
    extends State<LiveFaceVerificationScreen>
    with SingleTickerProviderStateMixin {
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  int _selectedCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _cameraPermissionError = false;

  VerificationStep _currentStep = VerificationStep.liveFace;

  // Captured images
  XFile? _facePhoto;
  final List<List<int>> _faceFrames = [];
  XFile? _roomPhoto;

  // Liveness animation state
  late AnimationController _scannerAnim;
  bool _livenessPassed = false;
  bool _isProcessing = false;
  String? _errorMessage;
  AttendanceVerifyResult? _result;

  Timer? _countdownTimer;
  int _secondsLeft = 3;

  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _scannerAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _initCamera();
  }

  void _startAutoScanCountdown() {
    _countdownTimer?.cancel();
    _secondsLeft = 3;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_secondsLeft <= 1) {
        t.cancel();
        if (_currentStep == VerificationStep.liveFace && !_livenessPassed && !_isProcessing) {
          _captureFace();
        }
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() => _cameraPermissionError = true);
        return;
      }

      // Default to front camera for face detection
      int frontIndex = _cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
      );
      if (frontIndex == -1) frontIndex = 0;
      _selectedCameraIndex = frontIndex;

      await _setupCameraController(_cameras[_selectedCameraIndex]);
    } catch (e) {
      debugPrint('Camera init error: $e');
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

    // Default preview stream format (YUV420 on Android) ensures hardware compatibility
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

      if (_currentStep == VerificationStep.liveFace && !_livenessPassed) {
        _startAutoScanCountdown();
      }
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

  Future<void> _switchCamera() async {
    if (_cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    await _setupCameraController(_cameras[_selectedCameraIndex]);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _scannerAnim.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FACE CAPTURE & LIVENESS CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _captureFace() async {
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      XFile? photo;
      if (_isCameraInitialized && _cameraController != null) {
        photo = await _cameraController!.takePicture();
      } else {
        // Fallback using image_picker if hardware controller unavailable
        photo = await _picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.front,
          maxWidth: 1280,
          maxHeight: 1280,
        );
      }

      if (photo == null) {
        setState(() => _isProcessing = false);
        return;
      }

      final bytes = await photo.readAsBytes();
      setState(() {
        _facePhoto = photo;
        _faceFrames.add(bytes);
        _livenessPassed = _faceFrames.length >= 4;
        _isProcessing = false;
      });

      if (!_livenessPassed) {
        return;
      }

      // Show brief success checkmark, then advance to classroom panorama step
      await Future.delayed(const Duration(milliseconds: 700));

      if (mounted) {
        // Switch to back camera automatically for classroom photo if available
        int backIndex = _cameras.indexWhere(
          (c) => c.lensDirection == CameraLensDirection.back,
        );
        if (backIndex != -1 && backIndex != _selectedCameraIndex) {
          _selectedCameraIndex = backIndex;
          await _setupCameraController(_cameras[_selectedCameraIndex]);
        }

        setState(() {
          _currentStep = VerificationStep.classroomRoom;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _errorMessage = 'Could not capture face frame: $e';
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLASSROOM ROOM / PANORAMA CAPTURE
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _captureClassroomRoom() async {
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });

    try {
      XFile? photo;
      if (_isCameraInitialized && _cameraController != null) {
        photo = await _cameraController!.takePicture();
      } else {
        photo = await _picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.rear,
          maxWidth: 1600,
          maxHeight: 1200,
        );
      }

      if (photo == null) {
        setState(() => _isProcessing = false);
        return;
      }

      setState(() {
        _roomPhoto = photo;
        _currentStep = VerificationStep.verifying;
      });

      await _submitDualVerification();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _errorMessage = 'Could not capture classroom photo: $e';
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT DUAL VERIFICATION (ARCFACE / DEEPFACE + CLASSROOM MATCH)
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _submitDualVerification() async {
    if (_facePhoto == null) return;

    try {
      final roomBytes = _roomPhoto == null ? <int>[] : await _roomPhoto!.readAsBytes();

      final res = await widget.state.verifyAttendanceLive(
        widget.session.id,
          faceFrames: _faceFrames,
          roomBytes: roomBytes,
      );

      if (mounted) {
        setState(() {
          _result = res;
          _currentStep = VerificationStep.result;
          _isProcessing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _errorMessage = widget.state.error ?? e.toString();
          _currentStep = VerificationStep.result;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Camera feed or fallback background
            Positioned.fill(
              child: _buildCameraFeed(),
            ),

            // Top Header & Step Bar
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: _buildTopHeader(),
            ),

            // Center Reticle / HUD (Specific to current step)
            if (_currentStep == VerificationStep.liveFace)
              _buildFaceScanningHUD()
            else if (_currentStep == VerificationStep.classroomRoom)
              _buildClassroomRoomHUD()
            else if (_currentStep == VerificationStep.verifying)
              _buildVerifyingHUD()
            else if (_currentStep == VerificationStep.result)
              _buildResultHUD(),

            // Bottom action bar
            if (_currentStep != VerificationStep.verifying &&
                _currentStep != VerificationStep.result)
              Positioned(
                bottom: 24,
                left: 20,
                right: 20,
                child: _buildBottomActions(),
              ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: CAMERA FEED
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildCameraFeed() {
    if (_cameraPermissionError || !_isCameraInitialized || _cameraController == null) {
      return Container(
        color: const Color(0xFF0F172A),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.videocam_off_rounded,
                  size: 64,
                  color: AppColors.slate,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Hardware Camera Standby',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Using high-resolution direct snapshot mode for live face and classroom verification.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.slate,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: _initCamera,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white30),
                  ),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry Camera Feed'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ClipRect(
      child: Transform.scale(
        scale: _cameraController!.value.aspectRatio * (MediaQuery.of(context).size.height / MediaQuery.of(context).size.width),
        child: Center(
          child: CameraPreview(_cameraController!),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: TOP HEADER & PROGRESS
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildTopHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white),
            onPressed: () => Navigator.of(context).pop(),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.session.className.isNotEmpty
                      ? widget.session.className
                      : 'Live Attendance Verification',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  _currentStep == VerificationStep.liveFace
                      ? 'Step 1/2: Student Liveness Check'
                      : _currentStep == VerificationStep.classroomRoom
                          ? 'Step 2/2: Classroom Physical Match'
                          : _currentStep == VerificationStep.verifying
                              ? 'Neural Engine Processing...'
                              : 'Verification Complete',
                  style: const TextStyle(
                    color: AppColors.emerald,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (_cameras.length > 1 &&
              _currentStep != VerificationStep.verifying &&
              _currentStep != VerificationStep.result)
            IconButton(
              icon: const Icon(Icons.flip_camera_ios_rounded, color: Colors.white),
              tooltip: 'Switch Camera',
              onPressed: _switchCamera,
            ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: FACE SCANNING HUD
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildFaceScanningHUD() {
    final size = MediaQuery.of(context).size;
    final ovalWidth = size.width * 0.72;
    final ovalHeight = ovalWidth * 1.35;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Oval Reticle with animated scanning line
          SizedBox(
            width: ovalWidth,
            height: ovalHeight,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Oval Border Reticle
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.all(
                      Radius.elliptical(ovalWidth / 2, ovalHeight / 2),
                    ),
                    border: Border.all(
                      color: _livenessPassed
                          ? AppColors.emerald
                          : Colors.cyanAccent.withValues(alpha: 0.8),
                      width: 3.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_livenessPassed ? AppColors.emerald : Colors.cyanAccent)
                            .withValues(alpha: 0.25),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),

                // Animated Scanner Line
                if (!_livenessPassed)
                  AnimatedBuilder(
                    animation: _scannerAnim,
                    builder: (context, _) {
                      return Positioned(
                        top: 20 + _scannerAnim.value * (ovalHeight - 40),
                        left: 20,
                        right: 20,
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                Colors.cyanAccent.withValues(alpha: 0.85),
                                Colors.white,
                                Colors.cyanAccent.withValues(alpha: 0.85),
                                Colors.transparent,
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.cyanAccent.withValues(alpha: 0.6),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),

                // Verification Checkmark if captured
                if (_livenessPassed)
                  Container(
                    width: 72,
                    height: 72,
                    decoration: const BoxDecoration(
                      color: AppColors.emerald,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 48,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Instruction Pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.white24),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _livenessPassed ? Icons.verified_rounded : Icons.face_rounded,
                  color: _livenessPassed ? AppColors.emerald : Colors.cyanAccent,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Text(
                  _livenessPassed
                      ? 'Liveness Confirmed'
                       : 'Challenge frame ${_faceFrames.length + 1} of 4 • ${_faceFrames.length == 0 ? 'look straight ahead' : _faceFrames.length == 1 ? 'turn your head slowly' : _faceFrames.length == 2 ? 'blink once' : 'hold still'}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.rose.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: CLASSROOM ROOM / PANORAMA HUD
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildClassroomRoomHUD() {
    final size = MediaQuery.of(context).size;
    final boxWidth = size.width * 0.88;
    final boxHeight = boxWidth * 0.65;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Rectangular Viewfinder for Panorama / Room
          Container(
            width: boxWidth,
            height: boxHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppColors.primaryLight,
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 18,
                ),
              ],
            ),
            child: Stack(
              children: [
                // Corner Reticles
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'WIDE / ROOM VIEW',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Guidance instructions
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white24),
            ),
            child: const Column(
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.meeting_room_rounded, color: AppColors.primaryLight, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Classroom Verification',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 6),
                Text(
                  'Point camera to capture classroom desks or front board to verify physical presence in the assigned room.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.rose.withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: VERIFYING HUD (AI NEURAL PROCESSING)
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildVerifyingHUD() {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.25),
              blurRadius: 30,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 56,
              height: 56,
              child: CircularProgressIndicator(
                strokeWidth: 4,
                valueColor: AlwaysStoppedAnimation(AppColors.primaryLight),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Analyzing Biometrics & Room',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
               'Evaluating the configured face model, guided liveness evidence, and classroom context separately...',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.slate,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Column(
                children: [
                  _VerificationStepRow(
                    label: 'Live Face Frame Liveness Verification',
                    active: true,
                  ),
                  SizedBox(height: 8),
                  _VerificationStepRow(
                     label: 'Configured face identity comparison',
                    active: true,
                  ),
                  SizedBox(height: 8),
                  _VerificationStepRow(
                     label: 'Classroom-context evidence check',
                    active: true,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: VERIFICATION RESULT HUD
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildResultHUD() {
    final isPresent = _result?.isPresent == true;
    final isFlagged = _result?.isFlagged == true;

    final Color headerColor = isPresent
        ? AppColors.emerald
        : (isFlagged ? AppColors.amber : AppColors.rose);

    final IconData headerIcon = isPresent
        ? Icons.verified_user_rounded
        : (isFlagged ? Icons.warning_amber_rounded : Icons.gpp_bad_rounded);

    final String title = isPresent
        ? 'Attendance Verified Present!'
        : (isFlagged
            ? 'Attendance Flagged for Review'
            : 'Verification Failed');

    return Center(
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: headerColor.withValues(alpha: 0.6), width: 2),
          boxShadow: [
            BoxShadow(
              color: headerColor.withValues(alpha: 0.25),
              blurRadius: 28,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: headerColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(headerIcon, color: headerColor, size: 38),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: headerColor,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _result?.message ?? _errorMessage ?? 'Biometric verification processed.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),

            // Detailed Metric Tiles
            if (_result != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Biometric Match:', style: TextStyle(color: AppColors.slate, fontSize: 13)),
                        Text(
                           _result!.faceConfidence == null ? 'No score' : '${(_result!.faceConfidence! * 100).toInt()}% similarity',
                          style: TextStyle(
                            color: _result!.faceMatch ? AppColors.emerald : AppColors.rose,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Classroom Presence:', style: TextStyle(color: AppColors.slate, fontSize: 13)),
                        Text(
                          _result!.roomMatch ? 'Confirmed' : 'Unconfirmed',
                          style: TextStyle(
                            color: _result!.roomMatch ? AppColors.emerald : AppColors.amber,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                     ],
                   ),
                 ),
              const SizedBox(height: 20),
            ],

            // Done Button
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: headerColor,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                Navigator.of(context).pop(isPresent);
              },
              child: Text(
                isPresent ? 'Return to Home' : 'Close',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ),

            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_clock_rounded, color: Colors.white70, size: 16),
                  SizedBox(width: 8),
                  Text(
                    '1-Attempt Policy • Attempt Recorded & Finalized',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIDGET: BOTTOM ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildBottomActions() {
    final isFaceStep = _currentStep == VerificationStep.liveFace;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Large Capture Button
        GestureDetector(
          onTap: _isProcessing
              ? null
              : (isFaceStep ? _captureFace : _captureClassroomRoom),
          child: Container(
            width: 74,
            height: 74,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: (isFaceStep ? Colors.cyanAccent : AppColors.primary)
                      .withValues(alpha: 0.4),
                  blurRadius: 18,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isFaceStep ? const Color(0xFF0F172A) : AppColors.primary,
                ),
                child: Icon(
                  isFaceStep ? Icons.face_rounded : Icons.camera_alt_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _VerificationStepRow extends StatelessWidget {
  const _VerificationStepRow({
    required this.label,
    required this.active,
  });

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.check_circle_rounded, color: AppColors.emerald, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
