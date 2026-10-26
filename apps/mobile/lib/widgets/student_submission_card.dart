import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/models.dart';
import '../state/app_state.dart';

class StudentSubmissionCard extends StatefulWidget {
  const StudentSubmissionCard({super.key, required this.state});
  final AppState state;

  @override
  State<StudentSubmissionCard> createState() => _StudentSubmissionCardState();
}

class _StudentSubmissionCardState extends State<StudentSubmissionCard> {
  final ImagePicker _picker = ImagePicker();
  AttendanceSession? _session;
  File? _image;
  bool _loading = true;
  bool _uploading = false;
  double _progress = 0;
  Timer? _timer;
  String? _error;
  String? _result;

  @override
  void initState() {
    super.initState();
    _load();
    var ticks = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
      if (++ticks % 15 == 0) _load();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant StudentSubmissionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.state.sessions, oldWidget.state.sessions)) _load();
  }

  Future<void> _load() async {
    final sessions = widget.state.sessions;
    final open = sessions.where((s) => s.status == 'open').toList();
    final scheduled = sessions.where((s) => s.status == 'scheduled').toList();
    final closed = sessions.where((s) => s.status == 'closed').toList();
    final candidate = open.isNotEmpty ? open.first : scheduled.isNotEmpty ? scheduled.first : closed.isNotEmpty ? closed.first : null;
    if (candidate == null) {
      if (mounted) setState(() { _session = null; _loading = false; });
      return;
    }
    try {
      final session = await widget.state.api.session(candidate.id);
      if (mounted) setState(() { _session = session; _error = null; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = error.toString(); _loading = false; });
    }
  }

  Future<void> _choosePanorama() async {
    setState(() { _error = null; _result = null; });
    try {
      // Use the native camera app's panorama mode, save the panorama, then
      // select it from the gallery; image_picker cannot force panorama mode.
      final picked = await _picker.pickImage(source: ImageSource.gallery);
      if (picked == null) return;
      final file = File(picked.path);
      if (await file.length() > 10 * 1024 * 1024) {
        setState(() => _error = 'Image must be 10 MB or smaller.');
        return;
      }
      setState(() => _image = file);
    } catch (_) {
      setState(() => _error = 'Could not select the saved panorama. Try again.');
    }
  }

  Future<void> _submit() async {
    final session = _session;
    final image = _image;
    if (session == null || image == null) return;
    setState(() { _uploading = true; _progress = 0; _error = null; _result = null; });
    try {
      final ok = await widget.state.submitStudentImage(session.id, image, onProgress: (value) {
        if (mounted) setState(() => _progress = value);
      });
      if (!ok) throw Exception(widget.state.error ?? 'Image submission failed.');
      final result = widget.state.latestSubmission ?? <String, dynamic>{};
      final status = result['status']?.toString() ?? 'NEEDS_REVIEW';
      if (mounted) {
        setState(() {
          _result = '$status — ${result['explanation'] ?? 'Submission received.'}';
          _image = null;
        });
        await _load();
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String _time(DateTime? value) => value == null ? '—' : MaterialLocalizations.of(context).formatMediumDate(value.toLocal()) + ' ' + TimeOfDay.fromDateTime(value.toLocal()).format(context);

  String _countdown(DateTime? target, String prefix) {
    if (target == null) return '$prefix time not configured';
    final seconds = target.difference(DateTime.now()).inSeconds;
    if (seconds <= 0) return prefix == 'Opens in' ? 'Window is open' : 'Deadline reached';
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final remainder = seconds % 60;
    return '$prefix ${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final submission = session?.submission;
    final status = submission?['status']?.toString();
    final canRetry = status == 'REJECTED' && submission?['review_decision'] == null;
    final canSubmit = session?.isOpen == true && (submission == null || canRetry);
    return Card(
      margin: const EdgeInsets.only(bottom: 18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : session == null
                ? const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Current attendance session', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    SizedBox(height: 8), Text('No scheduled or open session is available for your classes.'),
                  ])
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Expanded(child: Text('Current attendance session', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                      Chip(label: Text(session.status.toUpperCase())),
                    ]),
                    Text(session.title.isEmpty ? session.className : session.title),
                    Text('Professor ${session.professorName.isEmpty ? 'assigned faculty' : session.professorName}'),
                    const SizedBox(height: 6),
                    Text('Opens ${_time(session.opensAt)} · Deadline ${_time(session.deadlineAt)}'),
                    Text(session.status == 'scheduled' ? _countdown(session.opensAt, 'Opens in') : _countdown(session.deadlineAt, 'Time remaining')),
                    const SizedBox(height: 12),
                    if (submission != null) ...[
                      Text('Your submission: ${status ?? 'received'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(submission['explanation']?.toString() ?? ''),
                      if (submission['review_reason'] != null) Text('Professor note: ${submission['review_reason']}'),
                    ],
                    if (session.status == 'scheduled') const Text('Submission opens automatically at the scheduled time.'),
                    if (session.status == 'closed') const Text('The submission window is closed. Contact your professor if you need a correction.'),
                    if (canSubmit) ...[
                      const SizedBox(height: 10),
                      const Text('Use your phone camera’s Panorama mode, sweep slowly across the room, save the image, then choose it here. Avoid selfie framing; include nearby classmates and the configured stage area.'),
                      const SizedBox(height: 10),
                      if (_image != null) ...[
                        ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(_image!, height: 190, width: double.infinity, fit: BoxFit.contain)),
                        const SizedBox(height: 8),
                      ],
                      Wrap(spacing: 8, runSpacing: 8, children: [
                        OutlinedButton.icon(onPressed: _uploading ? null : _choosePanorama, icon: const Icon(Icons.photo_library_outlined), label: Text(_image == null ? 'Choose panorama' : 'Retake / choose another')),
                        if (_image != null) FilledButton.icon(onPressed: _uploading ? null : _submit, icon: _uploading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_upload_outlined), label: Text(_uploading ? 'Uploading…' : canRetry ? 'Submit replacement' : 'Submit image')),
                      ]),
                      if (_uploading) ...[
                        const SizedBox(height: 8),
                        LinearProgressIndicator(value: _progress),
                        Text('Uploading ${(_progress * 100).round()}%'),
                      ],
                    ],
                    if (_result != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_result!)),
                    if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
                    const SizedBox(height: 8),
                    const Text('Person detection is scene evidence only—not identity verification. Uncertain images are sent for professor review.', style: TextStyle(fontSize: 12)),
                  ]),
      ),
    );
  }
}
