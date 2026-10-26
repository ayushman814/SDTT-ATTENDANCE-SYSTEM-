import 'package:flutter/material.dart';

import '../state/app_state.dart';

class TeacherSubmissionReview extends StatefulWidget {
  const TeacherSubmissionReview({super.key, required this.state, required this.sessionId});
  final AppState state;
  final String sessionId;

  @override
  State<TeacherSubmissionReview> createState() => _TeacherSubmissionReviewState();
}

class _TeacherSubmissionReviewState extends State<TeacherSubmissionReview> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await widget.state.loadSubmissions(widget.sessionId);
      if (mounted) setState(() { _items = rows; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _error = error.toString(); _loading = false; });
    }
  }

  Future<void> _review(Map<String, dynamic> item, String decision) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(decision == 'approve' ? 'Approve attendance?' : 'Reject submission?'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Reason (required)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Save decision')),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.trim().isEmpty) return;
    final ok = await widget.state.reviewSubmission(
      widget.sessionId,
      item['id'].toString(),
      decision,
      reason.trim(),
    );
    if (ok) await _load();
    if (mounted && !ok) {
      setState(() => _error = widget.state.error ?? 'Could not save the review decision.');
    }
  }

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Expanded(child: Text('Student image submissions', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
              IconButton(onPressed: _load, tooltip: 'Refresh submissions', icon: const Icon(Icons.refresh)),
            ]),
            if (_loading) const LinearProgressIndicator(),
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            if (!_loading && _items.isEmpty) const Text('No student submissions yet.'),
            ..._items.map((item) {
              final status = item['status']?.toString() ?? 'NEEDS_REVIEW';
              final decision = item['review_decision']?.toString();
              final imageUrl = item['image_url']?.toString();
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).dividerColor),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item['student_name']?.toString() ?? 'Student', style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('${item['student_id'] ?? ''} · ${item['submitted_at'] ?? ''} · $status'),
                  if (imageUrl != null && imageUrl.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.network(imageUrl, height: 180, width: double.infinity, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Text('Private image preview unavailable.'))),
                  ],
                  const SizedBox(height: 8),
                  Text(item['explanation']?.toString() ?? ''),
                  Text('People: ${item['detected_people'] ?? 'unknown'} · Nearby: ${item['nearby_people'] ?? 'unknown'} · Person in configured region: ${item['stage_person_detected'] ?? 'unknown'}', style: const TextStyle(fontSize: 12)),
                  if (item['review_reason'] != null) Text('Professor note: ${item['review_reason']}'),
                  if (decision == null && status != 'VERIFIED') Wrap(spacing: 8, children: [
                    OutlinedButton(onPressed: () => _review(item, 'approve'), child: const Text('Approve present')),
                    OutlinedButton(onPressed: () => _review(item, 'reject'), child: const Text('Reject')),
                  ]),
                  if (decision != null) Text('Professor decision: $decision'),
                ]),
              );
            }),
            const SizedBox(height: 8),
            const Text('Person detection is scene evidence only. It does not identify a student or lecturer.', style: TextStyle(fontSize: 12)),
          ]),
        ),
      );
}
