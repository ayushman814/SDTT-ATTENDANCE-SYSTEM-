import 'dart:async';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../widgets/app_widgets.dart';
import 'panorama_api.dart';
import 'panorama_models.dart';

enum _Phase { loading, selfie, switching, sweep, uploading, done, error }

/// Guided live capture — mirrors the web `LiveCapture` flow:
/// 1. front camera films the student for 8s, selfie is captured automatically
/// 2. the app switches to the back camera and asks for a ~180° sweep
///    covering the lecturer on the podium and the class
/// 3. frames are sent to the server, which stitches them into the panorama
///    and runs the full verification pipeline
class PanoramaCaptureScreen extends StatefulWidget {
  const PanoramaCaptureScreen({
    super.key,
    required this.api,
    required this.session,
  });

  final PanoramaApi api;
  final PanoramaSession session;

  @override
  State<PanoramaCaptureScreen> createState() => _PanoramaCaptureScreenState();
}

class _PanoramaCaptureScreenState extends State<PanoramaCaptureScreen> {
  static const _selfieSeconds = 8;
  static const _sweepSeconds = 16;
  static const _sweepIntervalMs = 600;
  static const _minFrames = 4;

  _Phase _phase = _Phase.loading;
  String? _error;
  PanoramaResult? _result;

  List<CameraDescription> _cameras = const [];
  CameraController? _controller;
  int _cameraIndex = 0;

  Timer? _countdown;
  int _selfieLeft = _selfieSeconds;

  Timer? _sweepTimer;
  int _sweepElapsedMs = 0;
  bool _capturing = false;
  Uint8List? _selfie;
  final List<Uint8List> _frames = [];

  @override
  void initState() {
    super.initState();
    _startFrontCamera();
  }

  Future<void> _startFrontCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        throw PanoramaException('No camera found on this device.');
      }
      var index = _cameras.indexWhere(
          (c) => c.lensDirection == CameraLensDirection.front);
      if (index < 0) index = 0;
      await _useCamera(index);
      if (!mounted) return;
      setState(() => _phase = _Phase.selfie);
      _countdown = Timer.periodic(const Duration(seconds: 1), (t) async {
        if (_selfieLeft <= 1) {
          t.cancel();
          await _takeSelfie();
        } else if (mounted) {
          setState(() => _selfieLeft--);
        }
      });
    } catch (e) {
      _fail(e.toString());
    }
  }

  Future<void> _useCamera(int index) async {
    final old = _controller;
    _controller = null;
    if (mounted) setState(() {});
    await old?.dispose();
    final controller = CameraController(
      _cameras[index],
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    await controller.initialize();
    _cameraIndex = index;
    _controller = controller;
    if (mounted) setState(() {});
  }

  Future<void> _takeSelfie() async {
    try {
      final shot = await _controller?.takePicture();
      if (shot == null) throw PanoramaException('Could not capture selfie.');
      _selfie = await shot.readAsBytes();
      await _startSweep();
    } catch (e) {
      _fail(e.toString());
    }
  }

  Future<void> _startSweep() async {
    try {
      setState(() => _phase = _Phase.switching);
      var index = _cameras.indexWhere(
          (c) => c.lensDirection == CameraLensDirection.back);
      if (index < 0 || index == _cameraIndex) {
        // Single-camera device (e.g. laptop) — reuse the same lens.
        index = _cameraIndex;
      }
      await _useCamera(index);
      if (!mounted) return;
      setState(() => _phase = _Phase.sweep);
      _sweepTimer = Timer.periodic(
          const Duration(milliseconds: _sweepIntervalMs), (_) => _grabFrame());
    } catch (e) {
      _fail(e.toString());
    }
  }

  Future<void> _grabFrame() async {
    if (_capturing || !mounted) return;
    _capturing = true;
    try {
      _sweepElapsedMs += _sweepIntervalMs;
      final shot = await _controller?.takePicture();
      if (shot != null) _frames.add(await shot.readAsBytes());
      if (!mounted) return;
      setState(() {});
      if (_sweepElapsedMs >= _sweepSeconds * 1000) await _finishSweep();
    } catch (_) {
      // A dropped frame is fine — the stitch only needs coverage.
    } finally {
      _capturing = false;
    }
  }

  Future<void> _finishSweep() async {
    _sweepTimer?.cancel();
    if (_frames.length < _minFrames) {
      _fail('Too few sweep frames — hold the phone up and turn slowly.');
      return;
    }
    setState(() => _phase = _Phase.uploading);
    try {
      final result = await widget.api.submit(
        sessionId: widget.session.publicId,
        selfie: _selfie!,
        frames: _frames,
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        _phase = _Phase.done;
      });
    } catch (e) {
      _fail(e.toString());
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() {
      _error = message;
      _phase = _Phase.error;
    });
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _sweepTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.session.courseCode,
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: switch (_phase) {
        _Phase.loading => const Center(
            child: CircularProgressIndicator(color: Colors.white)),
        _Phase.error => _errorView(),
        _Phase.done => _resultView(),
        _Phase.uploading => _uploadingView(),
        _ => _cameraView(),
      },
    );
  }

  Widget _cameraView() {
    final controller = _controller;
    return Column(
      children: [
        Expanded(
          child: controller != null && controller.value.isInitialized
              ? Center(child: CameraPreview(controller))
              : const Center(
                  child: CircularProgressIndicator(color: Colors.white)),
        ),
        _cameraHud(),
      ],
    );
  }

  Widget _cameraHud() {
    final isSelfie = _phase == _Phase.selfie;
    final isSweep = _phase == _Phase.sweep;
    final progress = isSelfie
        ? 1 - _selfieLeft / _selfieSeconds
        : (_sweepElapsedMs / (_sweepSeconds * 1000)).clamp(0.0, 1.0);
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            isSelfie
                ? 'Hold still — capturing you for $_selfieLeft s'
                : _phase == _Phase.switching
                    ? 'Switching to the rear camera…'
                    : 'Slowly sweep ~180° across the lecturer and the class',
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: _phase == _Phase.switching ? null : progress,
              minHeight: 8,
              backgroundColor: Colors.white24,
              color: AppColors.primary,
            ),
          ),
          if (isSweep) ...[
            const SizedBox(height: 10),
            Text(
              '${_frames.length} frames captured',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed:
                    _frames.length >= _minFrames ? _finishSweep : null,
                child: const Text('Done — submit attendance'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _uploadingView() => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 16),
            Text('Verifying attendance…',
                style: TextStyle(color: Colors.white, fontSize: 15)),
          ],
        ),
      );

  Widget _resultView() {
    final ok = _result!.ok;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
              color: ok ? AppColors.emerald : AppColors.rose,
              size: 72,
            ),
            const SizedBox(height: 14),
            Text(
              _result!.status.replaceAll('_', ' ').toUpperCase(),
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 20),
            ),
            if (_result?.reason != null) ...[
              const SizedBox(height: 8),
              Text(
                _result!.reason!,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ],
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(ok),
                child: const Text('Back to sessions'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  color: AppColors.rose, size: 64),
              const SizedBox(height: 14),
              Text(
                _error ?? 'Something went wrong.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 15),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Close'),
              ),
            ],
          ),
        ),
      );
}
