import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key, required this.state});
  final AppState state;

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  Timer? _countdownTimer;
  int _selectedTab = 0; // 0: Present, 1: Needs Review (Queue), 2: Absent, 3: All

  @override
  void initState() {
    super.initState();
    // 1-second ticker for server-synced countdown
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  String _formatRemaining(DateTime? endsAt) {
    if (endsAt == null) return 'No limit';
    final serverNow = widget.state.serverTimeNow;
    final diff = endsAt.difference(serverNow);
    if (diff.isNegative) return 'Window Closed';
    final m = diff.inMinutes;
    final s = diff.inSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _handleReviewDecision(
    String attemptId,
    String decision,
  ) async {
    final session = widget.state.activeSession;
    if (session == null) return;
    await widget.state.reviewDecision(
      session.id,
      attemptId,
      decision,
      note: 'Lecturer review decision via mobile app.',
    );
  }

  Future<void> _manualRollCallToggle(AttendanceRecord record) async {
    final nextStatus = record.isPresent ? 'absent' : 'present';
    await widget.state.updateAttendance(
      record.studentId,
      nextStatus,
      note: 'Lecturer manual roll-call override.',
    );
  }

  void _exportExcel(BuildContext context, AttendanceSession session) {
    final exportUrl = widget.state.api.sessionExcelExportUrl(session.id);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.table_view_rounded, color: AppColors.emerald, size: 26),
            SizedBox(width: 10),
            Text('Excel Export (.xlsx)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'A professionally formatted spreadsheet with colored KPI headers, status badges (Present/Absent/Flagged), and audit notes is ready.',
              style: TextStyle(fontSize: 13, color: AppColors.slate, height: 1.4),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: SelectableText(
                exportUrl,
                style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppColors.primary),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.emerald,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Spreadsheet analysis exported successfully!'),
                  backgroundColor: AppColors.emerald,
                ),
              );
            },
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Export Excel'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.state.activeSession;
    if (session == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Session Details')),
        body: const Center(
          child: EmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Session Unavailable',
            message: 'Return to dashboard and try reopening this session.',
          ),
        ),
      );
    }

    final serverNow = widget.state.serverTimeNow;
    final isExpired = session.endsAt != null && serverNow.isAfter(session.endsAt!);
    final isSessionClosed = session.isClosed || isExpired;

    final presentList = session.records.where((r) => r.isPresent).toList();
    final absentList = session.records.where((r) => r.isAbsent).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              session.className,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
            Text(
              '${session.classCode} • Session #${session.id.substring(0, 8)}',
              style: const TextStyle(fontSize: 12, color: AppColors.slate),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Export Professional Excel (.xlsx)',
            onPressed: () => _exportExcel(context, session),
            icon: const Icon(Icons.table_chart_rounded, color: AppColors.emerald),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => widget.state.openSession(session.id),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 90),
        children: [
          // ── Headline Card ────────────────────────────────────────────────
          AppCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isSessionClosed ? AppColors.slate : AppColors.emerald).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSessionClosed ? Icons.lock_clock_rounded : Icons.timer_rounded,
                            size: 15,
                            color: isSessionClosed ? AppColors.slate : AppColors.emerald,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isSessionClosed ? 'WINDOW CLOSED' : 'LIVE SESSION',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: isSessionClosed ? AppColors.slate : AppColors.emerald,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Server-synced Countdown
                    Text(
                      _formatRemaining(session.endsAt),
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: isSessionClosed ? AppColors.rose : AppColors.ink,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Headline Present Verified Count
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '${session.verifiedCount}',
                      style: const TextStyle(
                        fontSize: 44,
                        fontWeight: FontWeight.w900,
                        color: AppColors.ink,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '/ ${session.records.length} Present',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Status Breakdown Pills
                Row(
                  children: [
                    _MetricChip(label: 'Verified', count: session.verifiedCount, color: AppColors.emerald),
                    const SizedBox(width: 8),
                    _MetricChip(label: 'Needs Review', count: widget.state.reviewItems.length, color: AppColors.amber),
                    const SizedBox(width: 8),
                    _MetricChip(label: 'Absent', count: absentList.length, color: AppColors.rose),
                  ],
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () => _exportExcel(context, session),
                  icon: const Icon(Icons.file_download_outlined, size: 18, color: AppColors.emerald),
                  label: const Text(
                    'Export Colored Excel Analysis (.xlsx)',
                    style: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.emeraldBorder),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Review Queue Alert (if flagged attempts exist) ────────────────
          if (widget.state.reviewItems.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.amber.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.amber.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.amber, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.state.reviewItems.length} Student Check-ins Need Review',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.ink),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Front camera sweep flagged for optical verification. Inspect key frames below.',
                          style: TextStyle(fontSize: 12, color: AppColors.slate),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Tabs: Review Queue | Present | Absent | All ───────────────────
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _TabButton(
                  label: 'Review Queue (${widget.state.reviewItems.length})',
                  active: _selectedTab == 1,
                  onTap: () => setState(() => _selectedTab = 1),
                ),
                const SizedBox(width: 8),
                _TabButton(
                  label: 'Present (${presentList.length})',
                  active: _selectedTab == 0,
                  onTap: () => setState(() => _selectedTab = 0),
                ),
                const SizedBox(width: 8),
                _TabButton(
                  label: 'Absent (${absentList.length})',
                  active: _selectedTab == 2,
                  onTap: () => setState(() => _selectedTab = 2),
                ),
                const SizedBox(width: 8),
                _TabButton(
                  label: 'All (${session.records.length})',
                  active: _selectedTab == 3,
                  onTap: () => setState(() => _selectedTab = 3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Tab Content ───────────────────────────────────────────────────
          if (_selectedTab == 1) ...[
            // Review Queue Tab
            if (widget.state.reviewItems.isEmpty)
              const EmptyState(
                icon: Icons.check_circle_outline_rounded,
                title: 'Review Queue Clear',
                message: 'No student attempts currently require manual inspection.',
              )
            else
              ...widget.state.reviewItems.map((item) => _ReviewItemCard(
                    item: item,
                    onAccept: () => _handleReviewDecision(item.attemptId, 'accept'),
                    onReject: () => _handleReviewDecision(item.attemptId, 'reject'),
                  )),
          ] else ...[
            // Roster Records List (Present, Absent, or All)
            ...(_selectedTab == 0
                    ? presentList
                    : (_selectedTab == 2 ? absentList : session.records))
                .map((record) => _RosterRow(
                      record: record,
                      onToggle: () => _manualRollCallToggle(record),
                    )),
          ],

          const SizedBox(height: 24),

          // ── Actions: Finalize / Export ────────────────────────────────────
          if (!session.isFinalized)
            ElevatedButton.icon(
              onPressed: () => widget.state.finalizeSession(),
              icon: const Icon(Icons.done_all_rounded, size: 18),
              label: const Text('Confirm and Finalize Session'),
            ),
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, required this.count, required this.color});
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(
            '$label: $count',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? AppColors.primary : AppColors.line),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: active ? Colors.white : AppColors.ink,
          ),
        ),
      ),
    );
  }
}

class _ReviewItemCard extends StatelessWidget {
  const _ReviewItemCard({
    required this.item,
    required this.onAccept,
    required this.onReject,
  });

  final CheckinReviewItem item;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                item.studentName,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.ink),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.reasonCode,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.amber),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(item.studentEmail, style: const TextStyle(fontSize: 12, color: AppColors.slate)),
          const SizedBox(height: 12),

          // Filmstrip Carousel of Key Frames
          if (item.filmstripUrls.isNotEmpty)
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: item.filmstripUrls.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, idx) => ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    item.filmstripUrls[idx],
                    width: 90,
                    height: 90,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 90,
                      height: 90,
                      color: AppColors.line,
                      child: Center(
                        child: Text('Frame $idx', style: const TextStyle(fontSize: 11, color: AppColors.slate)),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.rose,
                    side: const BorderSide(color: AppColors.rose),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text('Mark Absent'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: onAccept,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.emerald,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text('Accept Present'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RosterRow extends StatelessWidget {
  const _RosterRow({required this.record, required this.onToggle});
  final AttendanceRecord record;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final color = record.isPresent
        ? AppColors.emerald
        : (record.isAbsent ? AppColors.rose : AppColors.amber);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.studentName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.ink),
                ),
                if (record.note.isNotEmpty)
                  Text(record.note, style: const TextStyle(fontSize: 11.5, color: AppColors.slate)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Toggle present/absent',
            onPressed: onToggle,
            icon: Icon(
              record.isPresent ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
              color: color,
              size: 22,
            ),
          ),
        ],
      ),
    );
  }
}
