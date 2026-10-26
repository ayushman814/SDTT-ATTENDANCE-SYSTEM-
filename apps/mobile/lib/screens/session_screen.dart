import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';
import '../widgets/teacher_submission_review.dart';

class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key, required this.state});
  final AppState state;

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  String searchQuery = '';
  final searchController = TextEditingController();

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
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

    final total = session.records.length;
    final presentCount = session.records.where((r) => r.isPresent).length;
    final absentCount = session.records.where((r) => r.isAbsent).length;
    final pendingCount = session.records.where((r) => r.isPending).length;

    final filteredRecords = session.records.where((r) {
      if (searchQuery.trim().isEmpty) return true;
      return r.studentName.toLowerCase().contains(searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              session.className,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
            Text(
              'Session #${session.id} • ${session.status.toUpperCase()}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.slate,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh roster',
            onPressed: () async {
              await widget.state.openSession(session.id);
              if (mounted) setState(() {});
            },
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await widget.state.openSession(session.id);
        },
        color: AppColors.primary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
          children: [
            // Session Overview Card
            FadeSlideIn(
              offsetY: 16,
              child: AppCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(
                                Icons.fact_check_rounded,
                                color: AppColors.primary,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Live Roll Call',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w900,
                                      ),
                                ),
                                Text(
                                  '$total Enrolled Students',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.muted,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        StatusChip(status: session.status),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // Multi-color breakdown bar
                    AttendanceBreakdownBar(
                      present: presentCount,
                      absent: absentCount,
                      pending: pendingCount,
                      height: 10,
                    ),

                    const SizedBox(height: 14),

                    // Metric pills row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _StatusCounter(
                          label: 'Present',
                          count: presentCount,
                          color: AppColors.emerald,
                        ),
                        _StatusCounter(
                          label: 'Absent',
                          count: absentCount,
                          color: AppColors.rose,
                        ),
                        _StatusCounter(
                          label: 'Pending',
                          count: pendingCount,
                          color: AppColors.amber,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            const SizedBox(height: 24),

            TeacherSubmissionReview(state: widget.state, sessionId: session.id),

            const SizedBox(height: 8),

            // Roster Header & Search
            FadeSlideIn(
              delay: const Duration(milliseconds: 120),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Class Roster', style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    '$pendingCount pending',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: pendingCount > 0 ? AppColors.amber : AppColors.emerald,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // Search Bar
            FadeSlideIn(
              delay: const Duration(milliseconds: 140),
              child: TextField(
                controller: searchController,
                onChanged: (val) => setState(() => searchQuery = val),
                decoration: InputDecoration(
                  hintText: 'Search student name...',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  suffixIcon: searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            searchController.clear();
                            setState(() => searchQuery = '');
                          },
                        )
                      : null,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),

            const SizedBox(height: 12),

            if (filteredRecords.isEmpty)
              const FadeSlideIn(
                delay: Duration(milliseconds: 160),
                child: EmptyState(
                  icon: Icons.person_search_rounded,
                  title: 'No matching students',
                  message: 'Try checking your search query spelling.',
                ),
              ),

            // Student Roster List with Instant Tap Buttons
            ...filteredRecords.asMap().entries.map((entry) {
              final index = entry.key;
              final record = entry.value;

              return FadeSlideIn(
                delay: Duration(milliseconds: 160 + index * 30),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: record.isPresent
                                  ? AppColors.emeraldBg
                                  : record.isAbsent
                                      ? AppColors.roseBg
                                      : AppColors.cardSubtle,
                              child: Text(
                                record.studentName.isNotEmpty
                                    ? record.studentName.substring(0, 1).toUpperCase()
                                    : '?',
                                style: TextStyle(
                                  color: record.isPresent
                                      ? AppColors.emerald
                                      : record.isAbsent
                                          ? AppColors.rose
                                          : AppColors.slate,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                record.studentName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                  color: AppColors.ink,
                                ),
                              ),
                            ),
                            StatusChip(status: record.status, compact: true),
                          ],
                        ),
                        if (session.status == 'open' || session.status == 'closed') ...[
                          const SizedBox(height: 10),
                          const Divider(height: 1, color: AppColors.border),
                          const SizedBox(height: 8),
                          // Instant Action Segmented Row
                          Row(
                            children: [
                              Expanded(
                                child: _RosterActionButton(
                                  label: 'Present',
                                  icon: Icons.check_rounded,
                                  isActive: record.isPresent,
                                  activeColor: AppColors.emerald,
                                  onTap: () async {
                                    await widget.state.setAttendance(
                                        record.studentId, 'present');
                                    if (mounted) setState(() {});
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _RosterActionButton(
                                  label: 'Absent',
                                  icon: Icons.close_rounded,
                                  isActive: record.isAbsent,
                                  activeColor: AppColors.rose,
                                  onTap: () async {
                                    await widget.state.setAttendance(
                                        record.studentId, 'absent');
                                    if (mounted) setState(() {});
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _RosterActionButton(
                                  label: 'Pending',
                                  icon: Icons.schedule_rounded,
                                  isActive: record.isPending,
                                  activeColor: AppColors.amber,
                                  onTap: () async {
                                    await widget.state.setAttendance(
                                        record.studentId, 'pending');
                                    if (mounted) setState(() {});
                                  },
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
      bottomSheet: session.status != 'finalized'
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: const Border(top: BorderSide(color: AppColors.border)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                child: AnimatedPressable(
                  onTap: widget.state.busy ? null : session.status == 'scheduled' ? _openEarly : session.isOpen ? _closeWindow : _finalize,
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: pendingCount == 0
                          ? AppColors.primaryGradient
                          : const LinearGradient(
                              colors: [Color(0xFFEA580C), Color(0xFFC2410C)],
                            ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: (pendingCount == 0
                                  ? AppColors.primary
                                  : const Color(0xFFEA580C))
                              .withValues(alpha: 0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Center(
                      child: widget.state.busy
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor:
                                    AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.lock_outline_rounded,
                                    color: Colors.white, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  session.status == 'scheduled'
                                      ? 'Open Attendance Window Now'
                                      : session.isOpen
                                      ? 'Close Submission Window'
                                      : pendingCount == 0
                                          ? 'Finalize Attendance Session'
                                          : 'Finalize & Mark $pendingCount Absent',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            )
          : null,
    );
  }



  Future<void> _openEarly() async {
    final session = widget.state.activeSession;
    if (session == null) return;
    try {
      await widget.state.openAttendanceWindow(session.id);
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _closeWindow() async {
    final session = widget.state.activeSession;
    if (session == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Close submission window?'),
        content: const Text('Students will no longer be able to submit images. You can still review submissions and correct the roster before finalizing.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep open')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Close window')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.state.closeAttendanceWindow(session.id);
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _finalize() async {
    final session = widget.state.activeSession;
    final pending =
        session?.records.where((r) => r.isPending).length ?? 0;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: const Text('Finalize Attendance Session?'),
        content: Text(
          pending > 0
              ? 'This will close the session and permanently mark $pending pending student(s) as absent. Students will receive private in-app notifications.'
              : 'All students are accounted for. This will close the session and notify students.',
          style: const TextStyle(fontSize: 14, color: AppColors.slate, height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep Reviewing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor:
                  pending > 0 ? const Color(0xFFEA580C) : AppColors.primary,
            ),
            child: const Text('Confirm Finalize'),
          ),
        ],
      ),
    );

    if (confirm != true) return;
    final ok = await widget.state.finalizeActive();
    if (mounted && ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.emerald,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          content: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Attendance session finalized successfully.'),
            ],
          ),
        ),
      );
      setState(() {});
    }
  }
}

class _StatusCounter extends StatelessWidget {
  const _StatusCounter({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          '$count',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 15,
            color: color,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.slate,
          ),
        ),
      ],
    );
  }
}

class _RosterActionButton extends StatelessWidget {
  const _RosterActionButton({
    required this.label,
    required this.icon,
    required this.isActive,
    required this.activeColor,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isActive;
  final Color activeColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedPressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? activeColor.withValues(alpha: 0.12)
              : AppColors.cardSubtle,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? activeColor : AppColors.border,
            width: isActive ? 1.4 : 1.0,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 14,
              color: isActive ? activeColor : AppColors.slate,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                color: isActive ? activeColor : AppColors.slate,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
