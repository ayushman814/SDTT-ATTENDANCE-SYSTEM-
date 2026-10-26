import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../widgets/app_widgets.dart';
import 'panorama_api.dart';
import 'panorama_capture_screen.dart';
import 'panorama_models.dart';

/// Student-side panorama attendance: sign in, see the live window for each
/// course, then mark attendance through the guided live capture.
class PanoramaHomeScreen extends StatefulWidget {
  const PanoramaHomeScreen({super.key});

  @override
  State<PanoramaHomeScreen> createState() => _PanoramaHomeScreenState();
}

class _PanoramaHomeScreenState extends State<PanoramaHomeScreen> {
  final PanoramaApi _api = PanoramaApi();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _busy = false;
  String? _error;
  List<PanoramaSession> _sessions = const [];
  List<PanoramaHistoryCourse> _history = const [];

  Future<void> _login() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _api.login(_email.text.trim(), _password.text);
      await _refresh();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    try {
      final results = await Future.wait([_api.activeSessions(), _api.history()]);
      if (!mounted) return;
      setState(() {
        _sessions = results[0] as List<PanoramaSession>;
        _history = results[1] as List<PanoramaHistoryCourse>;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _capture(PanoramaSession session) async {
    final submitted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
          builder: (_) => PanoramaCaptureScreen(api: _api, session: session)),
    );
    if (submitted == true) await _refresh();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Panorama Attendance',
            style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          if (_api.isLoggedIn) ...[
            IconButton(
                tooltip: 'Refresh',
                onPressed: _busy ? null : _refresh,
                icon: const Icon(Icons.refresh_rounded)),
            IconButton(
                tooltip: 'Sign out',
                onPressed: () => setState(_api.logout),
                icon: const Icon(Icons.logout_rounded)),
          ],
        ],
      ),
      body: _api.isLoggedIn ? _signedInView() : _loginView(),
    );
  }

  Widget _loginView() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.panorama_photosphere_rounded,
              color: Colors.white, size: 38),
        ),
        const SizedBox(height: 20),
        Text('Sign in to mark attendance',
            style: Theme.of(context).textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text(
          'Student account from the panorama system '
          '(e.g. student1@demo.edu / student123).',
          style: TextStyle(color: AppColors.slate, fontSize: 13),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
              labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _password,
          obscureText: true,
          onSubmitted: (_) => _login(),
          decoration: const InputDecoration(
              labelText: 'Password', prefixIcon: Icon(Icons.lock_outline)),
        ),
        if (_error != null) ...[
          const SizedBox(height: 14),
          Text(_error!, style: const TextStyle(color: AppColors.rose)),
        ],
        const SizedBox(height: 24),
        SizedBox(
          height: 50,
          child: FilledButton.icon(
            onPressed: _busy ? null : _login,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.login_rounded),
            label: const Text('Sign in'),
          ),
        ),
      ],
    );
  }

  Widget _signedInView() {
    return RefreshIndicator(
      onRefresh: _refresh,
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!,
                  style: const TextStyle(color: AppColors.rose)),
            ),
          Text('Live windows',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          if (_sessions.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text('No active attendance windows right now.',
                  style: TextStyle(color: AppColors.slate)),
            )
          else
            ..._sessions.map(_sessionCard),
          const SizedBox(height: 24),
          Text('History',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          if (_history.isEmpty)
            const Text('No attendance recorded yet.',
                style: TextStyle(color: AppColors.slate))
          else
            ..._history.map(_historyRow),
        ],
      ),
    );
  }

  Widget _sessionCard(PanoramaSession s) {
    final remaining = s.remaining;
    final label = remaining.isNegative
        ? 'closing…'
        : '${remaining.inMinutes}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')} left';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('${s.courseCode} — ${s.courseName}',
                      style:
                          const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                if (s.geoEnabled)
                  const Icon(Icons.place_outlined,
                      size: 18, color: AppColors.slate),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Ends ${DateFormat('HH:mm').format(s.endTime)} • $label',
              style: const TextStyle(color: AppColors.slate, fontSize: 12),
            ),
            const SizedBox(height: 12),
            if (s.alreadySubmitted)
              Row(children: [
                const Icon(Icons.check_circle_rounded,
                    color: AppColors.emerald, size: 18),
                const SizedBox(width: 6),
                Text(
                  s.myStatus == 'present'
                      ? 'Marked present'
                      : 'Pending review',
                  style: const TextStyle(
                      color: AppColors.emerald, fontWeight: FontWeight.w700),
                ),
              ])
            else
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _capture(s),
                  icon: const Icon(Icons.photo_camera_front_rounded),
                  label: const Text('Mark attendance (live capture)'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _historyRow(PanoramaHistoryCourse c) => ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text('${c.courseCode} — ${c.courseName}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Text('${c.attended}/${c.total} sessions attended'),
        trailing: Text('${c.pct.toStringAsFixed(0)}%',
            style: const TextStyle(
                fontWeight: FontWeight.w900, color: AppColors.primary)),
      );
}
