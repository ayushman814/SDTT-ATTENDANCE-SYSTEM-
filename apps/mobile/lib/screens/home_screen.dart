import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';
import '../panorama/panorama_home_screen.dart';
import '../widgets/student_submission_card.dart';
import 'notifications_screen.dart';
import 'session_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: HomeScreen(state: AppState()),
    ),
  );
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.state});
  final AppState state;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    final user = widget.state.user;
    final isTeacher = widget.state.isTeacher;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        toolbarHeight: 64,
        titleSpacing: 20,
        title: Row(
          children: [
            // User Avatar with Initials
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: isTeacher
                    ? AppColors.teacherHeroGradient
                    : AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(13),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  user?.name.isNotEmpty == true
                      ? user!.name.substring(0, 1).toUpperCase()
                      : '?',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  tab == 1
                      ? 'Notifications'
                      : isTeacher
                          ? 'Teacher Desk'
                          : 'Attendance',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  user != null
                      ? '${user.name} • ${isTeacher ? "Instructor" : "Student"}'
                      : 'Signed in',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.slate,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Live Sync Indicator
          if (widget.state.liveMessage != null)
            Container(
              margin: const EdgeInsets.only(right: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.emeraldBg,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.emeraldBorder),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _PulsingDot(color: AppColors.emerald),
                  SizedBox(width: 5),
                  Text(
                    'Live',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.emerald,
                    ),
                  ),
                ],
              ),
            ),

          IconButton(
            tooltip: 'Refresh',
            onPressed: widget.state.busy ? null : widget.state.retryHome,
            icon: widget.state.busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),

          IconButton(
            tooltip: 'Panorama attendance',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                  builder: (_) => const PanoramaHomeScreen()),
            ),
            icon: const Icon(Icons.panorama_photosphere_rounded),
          ),

          PopupMenuButton<String>(
            tooltip: 'Settings',
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            onSelected: (value) {
              if (value == 'logout') widget.state.logout();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'user',
                enabled: false,
                child: Text(
                  user?.email ?? '',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, color: AppColors.rose, size: 18),
                    SizedBox(width: 10),
                    Text(
                      'Sign out',
                      style: TextStyle(
                        color: AppColors.rose,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: tab == 1
          ? NotificationsScreen(state: widget.state)
          : isTeacher
              ? TeacherHome(state: widget.state)
              : StudentHome(state: widget.state),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (index) => setState(() => tab = index),
        destinations: [
          NavigationDestination(
            icon: Icon(isTeacher
                ? Icons.dashboard_outlined
                : Icons.insights_outlined),
            selectedIcon: Icon(
                isTeacher ? Icons.dashboard_rounded : Icons.insights_rounded),
            label: isTeacher ? 'Classes' : 'Overview',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: widget.state.unreadCount > 0,
              label: Text('${widget.state.unreadCount}'),
              child: const Icon(Icons.notifications_none_rounded),
            ),
            selectedIcon: Badge(
              isLabelVisible: widget.state.unreadCount > 0,
              label: Text('${widget.state.unreadCount}'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}

/// Pulsing Live Dot
class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});
  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) => Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: widget.color.withValues(alpha: 0.5 + 0.5 * _anim.value),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER HOME
// ─────────────────────────────────────────────────────────────────────────────

class TeacherHome extends StatelessWidget {
  const TeacherHome({super.key, required this.state});
  final AppState state;

  Future<void> _open(BuildContext context, AttendanceSession session) async {
    await state.openSession(session.id);
    if (!context.mounted) return;
    if (state.error == null) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => SessionScreen(state: state)),
      );
    }
  }

  Future<void> _start(BuildContext context, Classroom classroom) async {
    final titleController = TextEditingController(text: '${classroom.code} attendance');
    final leftController = TextEditingController(text: '40');
    final topController = TextEditingController(text: '0');
    final widthController = TextEditingController(text: '25');
    final heightController = TextEditingController(text: '100');
    final peopleController = TextEditingController(text: '2');
    var opensAt = DateTime.now();
    var durationMinutes = 10;
    final configured = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Schedule attendance'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              TextField(controller: titleController, decoration: const InputDecoration(labelText: 'Session title')),
              const SizedBox(height: 12),
              Text('Opens ${DateFormat('MMM d, yyyy · h:mm a').format(opensAt)}'),
              TextButton.icon(
                icon: const Icon(Icons.schedule),
                label: const Text('Choose opening date and time'),
                onPressed: () async {
                  final day = await showDatePicker(context: dialogContext, initialDate: opensAt, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 365)));
                  if (day == null || !dialogContext.mounted) return;
                  final time = await showTimePicker(context: dialogContext, initialTime: TimeOfDay.fromDateTime(opensAt));
                  if (time == null) return;
                  setDialogState(() => opensAt = DateTime(day.year, day.month, day.day, time.hour, time.minute));
                },
              ),
              const SizedBox(height: 8),
              const Text('Attendance window'),
              Wrap(
                spacing: 6,
                children: [
                  for (final minutes in [10, 30, 60, 120])
                    ChoiceChip(
                      label: Text('$minutes min'),
                      selected: durationMinutes == minutes,
                      onSelected: (_) => setDialogState(() => durationMinutes = minutes),
                    ),
                ],
              ),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Scene verification settings'),
                subtitle: const Text('Adjust the stage region to match your classroom panorama.'),
                children: [
                  Row(children: [Expanded(child: TextField(controller: leftController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Left %'))), const SizedBox(width: 8), Expanded(child: TextField(controller: topController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Top %')))]),
                  Row(children: [Expanded(child: TextField(controller: widthController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Width %'))), const SizedBox(width: 8), Expanded(child: TextField(controller: heightController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Height %')))]),
                  TextField(controller: peopleController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Minimum nearby people (1–30)')),
                  const Text('The detector reports scene evidence only; it does not identify the lecturer or prove that the region is a stage.', style: TextStyle(fontSize: 12)),
                ],
              ),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Create session')),
          ],
        ),
      ),
    );
    if (configured != true) { titleController.dispose(); leftController.dispose(); topController.dispose(); widthController.dispose(); heightController.dispose(); peopleController.dispose(); return; }
    final title = titleController.text.trim().isEmpty ? '${classroom.code} attendance' : titleController.text.trim();
    titleController.dispose();
    final left = double.tryParse(leftController.text);
    final top = double.tryParse(topController.text);
    final width = double.tryParse(widthController.text);
    final height = double.tryParse(heightController.text);
    final people = int.tryParse(peopleController.text);
    leftController.dispose(); topController.dispose(); widthController.dispose(); heightController.dispose(); peopleController.dispose();
    if (!context.mounted) return;
    if (left == null || top == null || width == null || height == null || people == null || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > 100 || top + height > 100 || people < 1 || people > 30) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid stage rectangle within 0–100% and a nearby-people count from 1 to 30.')));
      return;
    }
    final ok = await state.startSession(classroom.id, title: title, opensAt: opensAt, duration: Duration(minutes: durationMinutes), stageRegion: {'x': left / 100, 'y': top / 100, 'width': width / 100, 'height': height / 100}, minimumPeopleVisible: people);
    if (!context.mounted) return;
    if (ok) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => SessionScreen(state: state)),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(state.error ?? 'Could not start session.'),
          backgroundColor: AppColors.rose,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final firstName = state.user?.name.split(' ').first ?? 'Instructor';
    final nowFormatted = DateFormat('EEEE, MMMM d').format(DateTime.now());

    return RefreshIndicator(
      onRefresh: state.retryHome,
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          // Greeting & Date
          FadeSlideIn(
            offsetY: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back, $firstName 👋',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      nowFormatted,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Teacher Action Banner
          FadeSlideIn(
            delay: const Duration(milliseconds: 60),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'Active Term • Fall 2026',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Ready to take roll call?',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Launch a session, inspect synthetic suggestions, and finalize with one tap.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Colors.white70,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.co_present_rounded, color: Colors.white, size: 28),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 26),

          // Classes section
          FadeSlideIn(
            delay: const Duration(milliseconds: 120),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Assigned Classes', style: Theme.of(context).textTheme.titleLarge),
                Text(
                  '${state.classes.length} total',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          if (state.classes.isEmpty)
            const FadeSlideIn(
              delay: Duration(milliseconds: 140),
              child: EmptyState(
                icon: Icons.school_outlined,
                title: 'No classes found',
                message: 'Classes assigned to your account will appear here.',
              ),
            ),

          ...state.classes.asMap().entries.map((entry) {
            final index = entry.key;
            final c = entry.value;
            return FadeSlideIn(
              delay: Duration(milliseconds: 140 + index * 60),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.menu_book_rounded,
                          color: AppColors.primary,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.name,
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.cardSubtle,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    c.code,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.slate,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      FilledButton.icon(
                        onPressed: state.busy ? null : () => _start(context, c),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.play_arrow_rounded, size: 18),
                        label: const Text('Start'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),

          const SizedBox(height: 22),

          // Recent sessions section
          FadeSlideIn(
            delay: const Duration(milliseconds: 200),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Recent Sessions', style: Theme.of(context).textTheme.titleLarge),
                Text(
                  '${state.sessions.length} recorded',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          if (state.sessions.isEmpty)
            const FadeSlideIn(
              delay: Duration(milliseconds: 220),
              child: EmptyState(
                icon: Icons.event_available_outlined,
                title: 'No sessions yet',
                message: 'Start a session above to record attendance.',
              ),
            ),

          ...state.sessions.take(10).toList().asMap().entries.map((entry) {
            final index = entry.key;
            final s = entry.value;
            final isFinalized = s.status.toLowerCase() == 'finalized';

            return FadeSlideIn(
              delay: Duration(milliseconds: 220 + index * 40),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => _open(context, s),
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: isFinalized
                              ? AppColors.cardSubtle
                              : AppColors.emeraldBg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isFinalized
                                ? AppColors.border
                                : AppColors.emeraldBorder,
                          ),
                        ),
                        child: Icon(
                          isFinalized
                              ? Icons.lock_clock_rounded
                              : Icons.radio_button_checked_rounded,
                          color: isFinalized ? AppColors.slate : AppColors.emerald,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              s.className,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              s.createdAt != null
                                  ? DateFormat.yMMMd().add_jm().format(s.createdAt!.toLocal())
                                  : 'Session #${s.id}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(status: s.status, compact: true),
                      const SizedBox(width: 6),
                      const Icon(Icons.chevron_right_rounded, color: AppColors.muted, size: 20),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT HOME
// ─────────────────────────────────────────────────────────────────────────────

class StudentHome extends StatefulWidget {
  const StudentHome({super.key, required this.state});
  final AppState state;

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  String filter = 'all'; // 'all', 'present', 'absent', 'pending'

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final attendance = state.studentAttendance;
    final summary = attendance?.summary;
    final firstName = state.user?.name.split(' ').first ?? 'Student';
    final nowFormatted = DateFormat('EEEE, MMMM d').format(DateTime.now());

    final rawEntries = attendance?.entries ?? [];
    final filteredEntries = rawEntries.where((e) {
      if (filter == 'present') return e.isPresent;
      if (filter == 'absent') return e.isAbsent;
      if (filter == 'pending') return e.isPending;
      return true;
    }).toList();

    return RefreshIndicator(
      onRefresh: state.retryHome,
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          // Top Greeting
          FadeSlideIn(
            offsetY: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hi, $firstName 👋',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      nowFormatted,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.muted,
                      ),
                    ),
                    if (state.user?.registrationId != null)
                      Text('Student ID: ${state.user!.registrationId}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          StudentSubmissionCard(state: state),

          // Hero Attendance Card with Circular Gauge & Counters
          FadeSlideIn(
            delay: const Duration(milliseconds: 60),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                gradient: AppColors.studentHeroGradient,
                borderRadius: BorderRadius.circular(26),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1E1B4B).withValues(alpha: 0.4),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      // Circular Gauge
                      CircularAttendanceGauge(
                        percentage: summary?.percentage ?? 0.0,
                        size: 96,
                        strokeWidth: 9,
                      ),
                      const SizedBox(width: 20),
                      // Breakdown stats
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: (summary?.percentage ?? 0) >= 75
                                    ? AppColors.emerald.withValues(alpha: 0.25)
                                    : AppColors.amber.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    (summary?.percentage ?? 0) >= 75
                                        ? Icons.verified_rounded
                                        : Icons.info_outline_rounded,
                                    size: 13,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    (summary?.percentage ?? 0) >= 75
                                        ? 'Good Standing'
                                        : 'Attention Required',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              '${summary?.present ?? 0} of ${summary?.total ?? 0} Sessions',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              summary != null && summary.total > 0
                                  ? 'Your attendance meets minimum academic requirements.'
                                  : 'No finalized sessions recorded yet.',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),
                  const Divider(color: Colors.white12, height: 1),
                  const SizedBox(height: 14),

                  // Pill Counters
                  Row(
                    children: [
                      Expanded(
                        child: _StatPill(
                          label: 'Present',
                          value: '${summary?.present ?? 0}',
                          color: AppColors.emerald,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatPill(
                          label: 'Absent',
                          value: '${summary?.absent ?? 0}',
                          color: AppColors.rose,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatPill(
                          label: 'Pending',
                          value: '${summary?.pending ?? 0}',
                          color: AppColors.amber,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 26),

          // Filter Segmented Controls
          FadeSlideIn(
            delay: const Duration(milliseconds: 120),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('History', style: Theme.of(context).textTheme.titleLarge),
                Row(
                  children: [
                    _FilterChip(
                      label: 'All',
                      selected: filter == 'all',
                      onTap: () => setState(() => filter = 'all'),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Present',
                      selected: filter == 'present',
                      onTap: () => setState(() => filter = 'present'),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Absent',
                      selected: filter == 'absent',
                      onTap: () => setState(() => filter = 'absent'),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          if (filteredEntries.isEmpty)
            FadeSlideIn(
              delay: const Duration(milliseconds: 140),
              child: EmptyState(
                icon: Icons.history_toggle_off_rounded,
                title: 'No entries found',
                message: filter == 'all'
                    ? 'Your classroom attendance will appear here.'
                    : 'No sessions matching "$filter" were found.',
              ),
            ),

          ...filteredEntries.asMap().entries.map((entry) {
            final index = entry.key;
            final record = entry.value;

            return FadeSlideIn(
              delay: Duration(milliseconds: 140 + index * 40),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: record.isPresent
                              ? AppColors.emeraldBg
                              : record.isAbsent
                                  ? AppColors.roseBg
                                  : AppColors.amberBg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: record.isPresent
                                ? AppColors.emeraldBorder
                                : record.isAbsent
                                    ? AppColors.roseBorder
                                    : AppColors.amberBorder,
                          ),
                        ),
                        child: Icon(
                          record.isPresent
                              ? Icons.check_circle_outline_rounded
                              : record.isAbsent
                                  ? Icons.cancel_outlined
                                  : Icons.schedule_rounded,
                          color: record.isPresent
                              ? AppColors.emerald
                              : record.isAbsent
                                  ? AppColors.rose
                                  : AppColors.amber,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              record.className?.isNotEmpty == true
                                  ? record.className!
                                  : 'Class Session',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              record.updatedAt != null
                                  ? DateFormat.yMMMd().add_jm().format(record.updatedAt!.toLocal())
                                  : 'Completed',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(status: record.status),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedPressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? Colors.white : AppColors.slate,
          ),
        ),
      ),
    );
  }
}
