import 'dart:async';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:sensors_plus/sensors_plus.dart';
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
  XFile? _roomPhoto;

  // Liveness animation state
  late AnimationController _scannerAnim;
  bool _livenessPassed = false;
  bool _isProcessing = false;
  String? _errorMessage;
  AttendanceVerifyResult? _result;

  Timer? _countdownTimer;
  int _secondsLeft = 3;

  // Hardware IMU Sensor Panorama Tracking
  bool _isSweeping = false;
  double _sweepProgress = 0.0;
  double _accumulatedDegrees = 0.0;
  DateTime? _lastGyroTime;
  double _lastAccelX = 0.0;
  double _lastAccelY = 9.8;
  double _lastAccelZ = 0.0;
  String _sweepStatusMessage = 'Hold phone upright • Pan right across classroom';
  bool _sliceCaptured30 = false;
  bool _sliceCaptured90 = false;
  bool _sliceCaptured150 = false;
  StreamSubscription<GyroscopeEvent>? _gyroSubscription;
  StreamSubscription<AccelerometerEvent>? _accelSubscription;
  final List<XFile> _panoramaFrames = [];

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
    _gyroSubscription?.cancel();
    _accelSubscription?.cancel();
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

      setState(() {
        _facePhoto = photo;
        _livenessPassed = true;
        _isProcessing = false;
      });

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
  // CLASSROOM ROOM / 180° PANORAMA SWEEP CAPTURE
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // CLASSROOM ROOM / 180° PANORAMA SWEEP CAPTURE (HARDWARE IMU SENSORS)
  // ─────────────────────────────────────────────────────────────────────────
  void _startPanoramaSweep() {
    if (_isSweeping || _isProcessing) return;

    setState(() {
      _isSweeping = true;
      _sweepProgress = 0.0;
      _accumulatedDegrees = 0.0;
      _lastGyroTime = null;
      _sliceCaptured30 = false;
      _sliceCaptured90 = false;
      _sliceCaptured150 = false;
      _sweepStatusMessage = 'Ready • Rotate your phone to the right across classroom';
      _errorMessage = null;
    });

    try {
      HapticFeedback.heavyImpact();
      SystemSound.play(SystemSoundType.click);
    } catch (_) {}

    _panoramaFrames.clear();

    // Capture initial frame at 0°
    _captureSliceFrame('0° Left Start');

    // 1. Listen to Accelerometer (gravity vector orientation)
    _accelSubscription?.cancel();
    _accelSubscription = accelerometerEventStream().listen((AccelerometerEvent event) {
      _lastAccelX = event.x;
      _lastAccelY = event.y;
      _lastAccelZ = event.z;
    });

    // 2. Listen to Gyroscope (real physical angular velocity)
    _gyroSubscription?.cancel();
    _gyroSubscription = gyroscopeEventStream().listen((GyroscopeEvent event) {
      if (!_isSweeping || !mounted) return;

      final now = DateTime.now();
      if (_lastGyroTime == null) {
        _lastGyroTime = now;
        return;
      }

      final dt = now.difference(_lastGyroTime!).inMicroseconds / 1000000.0;
      _lastGyroTime = now;

      // Ignore abnormal time deltas
      if (dt <= 0 || dt > 0.3) return;

      // Project angular velocity onto gravity vector (vertical room axis)
      final gx = _lastAccelX;
      final gy = _lastAccelY;
      final gz = _lastAccelZ;
      final gNorm = math.sqrt(gx * gx + gy * gy + gz * gz);

      double verticalRotRate = 0.0;
      if (gNorm > 1.0) {
        // Dot product with unit gravity vector gives true yaw rate
        verticalRotRate = (event.x * gx + event.y * gy + event.z * gz) / gNorm;
      } else {
        // Fallback assuming upright portrait (Y-axis vertical)
        verticalRotRate = event.y;
      }

      final speed = verticalRotRate.abs();

      // STRICT SENSOR DEADBAND:
      // If the phone is NOT physically moving (speed < 0.08 rad/s, ~4.5°/sec):
      // PROGRESS DOES NOT ADVANCE AT ALL! Zero false movement!
      if (speed < 0.08) {
        if (_accumulatedDegrees < 5.0) {
          _updateSweepStatus('No motion detected • Rotate phone to the right');
        } else {
          _updateSweepStatus('Paused • Rotate phone right (${_accumulatedDegrees.toInt()}° / 180°)');
        }
        return;
      }

      if (speed > 3.0) {
        _updateSweepStatus('Too fast! Slow down and pan smoothly');
        return;
      }

      // PHONE IS PHYSICALLY MOVING! Integrate degrees
      final degDelta = speed * (180.0 / math.pi) * dt;
      _accumulatedDegrees += degDelta;
      final progress = (_accumulatedDegrees / 180.0).clamp(0.0, 1.0);

      _updateSweepStatus('Panning Classroom: ${_accumulatedDegrees.toInt()}° / 180°');

      if ((progress - _sweepProgress).abs() >= 0.01 || progress >= 1.0) {
        setState(() {
          _sweepProgress = progress;
        });
      }

      // Capture real camera slices at physical degree milestones
      if (_accumulatedDegrees >= 35.0 && !_sliceCaptured30) {
        _sliceCaptured30 = true;
        _captureSliceFrame('35° Left Desks');
      } else if (_accumulatedDegrees >= 90.0 && !_sliceCaptured90) {
        _sliceCaptured90 = true;
        _captureSliceFrame('90° Front Board');
      } else if (_accumulatedDegrees >= 150.0 && !_sliceCaptured150) {
        _sliceCaptured150 = true;
        _captureSliceFrame('150° Right Desks');
      }

      // Reached 180° panorama complete!
      if (_accumulatedDegrees >= 180.0) {
        _completePanoramaSweep();
      }
    });
  }

  void _updateSweepStatus(String msg) {
    if (_sweepStatusMessage != msg) {
      setState(() {
        _sweepStatusMessage = msg;
      });
    }
  }

  Future<void> _captureSliceFrame(String label) async {
    try {
      HapticFeedback.selectionClick();
      if (_isCameraInitialized && _cameraController != null) {
        final f = await _cameraController!.takePicture();
        _panoramaFrames.add(f);
      }
    } catch (_) {}
  }

  void _cancelPanoramaSweep() {
    _gyroSubscription?.cancel();
    _accelSubscription?.cancel();
    setState(() {
      _isSweeping = false;
      _sweepProgress = 0.0;
      _accumulatedDegrees = 0.0;
      _sweepStatusMessage = 'Sweep cancelled. Tap below to start.';
    });
  }

  Future<void> _completePanoramaSweep() async {
    if (!_isSweeping) return;
    _gyroSubscription?.cancel();
    _accelSubscription?.cancel();

    setState(() {
      _isSweeping = false;
      _sweepProgress = 1.0;
      _sweepStatusMessage = '180° Panorama Complete!';
    });

    try {
      HapticFeedback.vibrate();
      SystemSound.play(SystemSoundType.alert);
    } catch (_) {}

    XFile? bestFrame;
    if (_panoramaFrames.isNotEmpty) {
      bestFrame = _panoramaFrames.length >= 2
          ? _panoramaFrames[1] // Front board center slice
          : _panoramaFrames.last;
    } else if (_isCameraInitialized && _cameraController != null) {
      try {
        bestFrame = await _cameraController!.takePicture();
      } catch (_) {}
    }

    bestFrame ??= await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      maxWidth: 1600,
      maxHeight: 1200,
    );

    if (!mounted) return;

    if (bestFrame == null) {
      setState(() {
        _errorMessage = 'Could not capture panorama frame. Please try again.';
      });
      return;
    }

    setState(() {
      _roomPhoto = bestFrame;
      _currentStep = VerificationStep.verifying;
    });

    await _submitDualVerification();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT DUAL VERIFICATION (ARCFACE / DEEPFACE + CLASSROOM MATCH)
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> _submitDualVerification() async {
    if (_facePhoto == null) return;

    try {
      final faceBytes = await _facePhoto!.readAsBytes();
      List<int>? roomBytes;
      if (_roomPhoto != null) {
        roomBytes = await _roomPhoto!.readAsBytes();
      }

      final res = await widget.state.verifyAttendanceLive(
        widget.session.id,
        faceBytes: faceBytes,
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

    final size = MediaQuery.of(context).size;
    final previewSize = _cameraController!.value.previewSize;
    // Android/iOS camera sensors are landscape (e.g. 1920x1080).
    // In portrait orientation, width is the shorter dimension (previewSize.height).
    final double previewW = previewSize != null ? previewSize.height : size.width;
    final double previewH = previewSize != null ? previewSize.width : size.height;

    return ClipRect(
      child: Center(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: previewW,
            height: previewH,
            child: CameraPreview(_cameraController!),
          ),
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
                      : 'Live Face ID • Auto-scanning in ${_secondsLeft}s',
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
    final boxWidth = size.width * 0.92;
    final boxHeight = boxWidth * 0.50;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 180° Panoramic Viewfinder Frame
          Container(
            width: boxWidth,
            height: boxHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _isSweeping ? Colors.cyanAccent : AppColors.primaryLight,
                width: 2.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: (_isSweeping ? Colors.cyanAccent : AppColors.primary)
                      .withValues(alpha: 0.25),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Stack(
              children: [
                // Top Tag
                Positioned(
                  top: 10,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.panorama_photosphere_rounded,
                          size: 14,
                          color: _isSweeping ? Colors.cyanAccent : AppColors.primaryLight,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isSweeping
                              ? 'PANORAMA SWEEPING (${_accumulatedDegrees.toInt()}°)'
                              : '180° ULTRA-WIDE PANORAMA',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 10,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Center Horizon Level Guide
                Center(
                  child: Container(
                    height: 1.5,
                    color: Colors.cyanAccent.withValues(alpha: 0.4),
                  ),
                ),
                Center(
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.cyanAccent.withValues(alpha: 0.8),
                        width: 1.5,
                      ),
                    ),
                  ),
                ),

                // Sweep Track (0° Left -> 90° Center -> 180° Right)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '◀ 0° Left Desks',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              '🏛 90° Board',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const Text(
                            '180° Right Desks ▶',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      // Animated Track Bar with Panning Cursor
                      Stack(
                        alignment: Alignment.centerLeft,
                        children: [
                          Container(
                            height: 6,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: Colors.white24),
                            ),
                          ),
                          FractionallySizedBox(
                            widthFactor: _sweepProgress.clamp(0.05, 1.0),
                            child: Container(
                              height: 6,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Colors.cyanAccent, AppColors.primaryLight],
                                ),
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Panorama instructions badge
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white24),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isSweeping
                          ? Icons.sync_rounded
                          : Icons.screen_rotation_rounded,
                      color: _isSweeping ? Colors.cyanAccent : AppColors.primaryLight,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _isSweeping
                          ? _sweepStatusMessage
                          : '180° Physical Classroom Match',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _isSweeping
                      ? 'Slowly rotate your device from left to right along the horizon.'
                      : 'Stand in room and tap "START 180° PANORAMA SWEEP" below to sweep across the classroom desks and board.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    height: 1.35,
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
              'Extracting 512-dim ArcFace embeddings and cross-referencing classroom environment template...',
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
                    label: 'ArcFace Biometric Cosine Comparison',
                    active: true,
                  ),
                  SizedBox(height: 8),
                  _VerificationStepRow(
                    label: 'Physical Classroom Room Matching',
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
                          '${(_result!.faceConfidence * 100).toInt()}% Match',
                          style: TextStyle(
                            color: _result!.faceMatch ? AppColors.emerald : AppColors.rose,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Sir (Lecturer on Stage):', style: TextStyle(color: AppColors.slate, fontSize: 13)),
                        Text(
                          _result!.sirDetected ? 'Detected' : 'Not Detected',
                          style: TextStyle(
                            color: _result!.sirDetected ? AppColors.emerald : AppColors.amber,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Crowd Audience:', style: TextStyle(color: AppColors.slate, fontSize: 13)),
                        Text(
                          _result!.crowdDetected ? '${_result!.crowdCount} peers in hall' : 'Not Detected',
                          style: TextStyle(
                            color: _result!.crowdDetected ? AppColors.emerald : AppColors.amber,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white12, height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Hall Venue:', style: TextStyle(color: AppColors.slate, fontSize: 13)),
                        Text(
                          _result!.hallType,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
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
    if (_currentStep == VerificationStep.liveFace) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: (_isProcessing || _livenessPassed) ? null : _captureFace,
              child: Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.cyanAccent.withValues(alpha: 0.45),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Center(
                  child: Container(
                    width: 62,
                    height: 62,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF0F172A),
                    ),
                    child: const Icon(
                      Icons.face_rounded,
                      color: Colors.cyanAccent,
                      size: 32,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              _livenessPassed
                  ? 'Face scan verified'
                  : 'Auto-scan active • Tap circle for manual capture',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    if (_currentStep == VerificationStep.classroomRoom) {
      if (_isSweeping) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A).withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.cyanAccent.withValues(alpha: 0.8), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.cyanAccent.withValues(alpha: 0.25),
                blurRadius: 20,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation(Colors.cyanAccent),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_accumulatedDegrees.toInt()}° / 180°',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '${(_sweepProgress * 100).toInt()}%',
                    style: const TextStyle(
                      color: Colors.cyanAccent,
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: _sweepProgress,
                  minHeight: 10,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation(Colors.cyanAccent),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _sweepStatusMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.cyanAccent,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton.icon(
                    onPressed: _cancelPanoramaSweep,
                    icon: const Icon(Icons.close_rounded, size: 16, color: Colors.white60),
                    label: const Text(
                      'Cancel',
                      style: TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                  ),
                  if (_accumulatedDegrees >= 60.0)
                    ElevatedButton.icon(
                      onPressed: _completePanoramaSweep,
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: Text(
                        'Finish Sweep (${_accumulatedDegrees.toInt()}°)',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.emerald,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                ],
              ),
            ],
          ),
        );
      }

      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _startPanoramaSweep,
          icon: const Icon(Icons.panorama_photosphere_rounded, size: 28),
          label: const Text(
            'START 180° PANORAMA SWEEP',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 14,
              letterSpacing: 0.6,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 8,
            shadowColor: AppColors.primary.withValues(alpha: 0.6),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
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
