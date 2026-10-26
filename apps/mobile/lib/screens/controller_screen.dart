import 'package:flutter/material.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

class ControllerScreen extends StatefulWidget {
  const ControllerScreen({super.key, required this.state});
  final AppState state;

  @override
  State<ControllerScreen> createState() => _ControllerScreenState();
}

class _ControllerScreenState extends State<ControllerScreen> {
  int _selectedTab = 0; // 0: Classes & Rooms, 1: Student Roster

  @override
  void initState() {
    super.initState();
    widget.state.loadControllerData();
  }

  void _showAddClassDialog() {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final sectionCtrl = TextEditingController(text: 'Section A');
    final roomCtrl = TextEditingController(text: 'LH-302');
    final photoCtrl = TextEditingController(
      text: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800',
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Create Class & Assign Room',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: nameCtrl,
                  label: 'Course Name',
                  hint: 'e.g. Data Structures & Algorithms',
                  prefixIcon: Icons.menu_book_rounded,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: AppTextField(
                        controller: codeCtrl,
                        label: 'Course Code',
                        hint: 'e.g. CS-201',
                        prefixIcon: Icons.tag_rounded,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppTextField(
                        controller: sectionCtrl,
                        label: 'Section',
                        hint: 'e.g. Section B',
                        prefixIcon: Icons.groups_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: roomCtrl,
                  label: 'Assigned Classroom Room',
                  hint: 'e.g. Lecture Hall 401',
                  prefixIcon: Icons.meeting_room_rounded,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: photoCtrl,
                  label: 'Reference Room Photo URL',
                  hint: 'Image URL for visual environment matching',
                  prefixIcon: Icons.image_rounded,
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty || codeCtrl.text.trim().isEmpty) return;
                    Navigator.of(ctx).pop();
                    final success = await widget.state.createClassroom(
                      name: nameCtrl.text.trim(),
                      code: codeCtrl.text.trim(),
                      section: sectionCtrl.text.trim(),
                      roomNumber: roomCtrl.text.trim(),
                      roomPhoto: photoCtrl.text.trim(),
                    );
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Class created successfully!' : (widget.state.error ?? 'Failed')),
                          backgroundColor: success ? AppColors.emerald : AppColors.rose,
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.add_circle_outline_rounded),
                  label: const Text('Save Classroom & Room Template'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showAddStudentDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final rollCtrl = TextEditingController();
    final idCtrl = TextEditingController();
    final selectedClassIds = <String>{};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Register College Student',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.ink),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  AppTextField(
                    controller: nameCtrl,
                    label: 'Full Name',
                    hint: 'e.g. John Doe',
                    prefixIcon: Icons.person_rounded,
                  ),
                  const SizedBox(height: 12),
                  AppTextField(
                    controller: emailCtrl,
                    label: 'College Email',
                    hint: 'e.g. student3@demo.edu',
                    prefixIcon: Icons.email_rounded,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: AppTextField(
                          controller: rollCtrl,
                          label: 'Roll Number',
                          hint: 'CS-2026-045',
                          prefixIcon: Icons.badge_rounded,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: AppTextField(
                          controller: idCtrl,
                          label: 'Student ID',
                          hint: 'STU-991',
                          prefixIcon: Icons.numbers_rounded,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Assign to Classes:',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: widget.state.controllerClasses.map((cls) {
                      final selected = selectedClassIds.contains(cls.id);
                      return FilterChip(
                        label: Text('${cls.code} (${cls.section})'),
                        selected: selected,
                        onSelected: (val) {
                          setModalState(() {
                            if (val) {
                              selectedClassIds.add(cls.id);
                            } else {
                              selectedClassIds.remove(cls.id);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: () async {
                      if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty || rollCtrl.text.trim().isEmpty) {
                        return;
                      }
                      Navigator.of(ctx).pop();
                      final success = await widget.state.createStudent(
                        name: nameCtrl.text.trim(),
                        email: emailCtrl.text.trim(),
                        rollNumber: rollCtrl.text.trim(),
                        studentId: idCtrl.text.trim().isNotEmpty ? idCtrl.text.trim() : null,
                        classIds: selectedClassIds.toList(),
                      );
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(success ? 'Student registered in database!' : (widget.state.error ?? 'Failed')),
                            backgroundColor: success ? AppColors.emerald : AppColors.rose,
                          ),
                        );
                      }
                    },
                    icon: const Icon(Icons.person_add_rounded),
                    label: const Text('Add to College Roster'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final classes = state.controllerClasses;
    final students = state.controllerStudents;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Academic Controller',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
            ),
            Text(
              state.user?.name ?? 'Admin',
              style: const TextStyle(fontSize: 12, color: AppColors.slate),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: state.loadControllerData,
            icon: const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            tooltip: 'Sign Out',
            onPressed: () => state.logout(),
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: state.loadControllerData,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Controller Hero Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E1B4B), Color(0xFF4338CA)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4338CA).withValues(alpha: 0.25),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Academic Controller Portal',
                              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                            ),
                            Text(
                              'Manage classrooms, sections, rosters & locks',
                              style: TextStyle(color: Color(0xFFE0E7FF), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      _StatBadge(label: 'Total Classes', value: '${classes.length}'),
                      const SizedBox(width: 12),
                      _StatBadge(label: 'Students Roster', value: '${students.length}'),
                      const SizedBox(width: 12),
                      _StatBadge(
                        label: 'Locked',
                        value: '${students.where((s) => s.registrationLocked).length}',
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Tab Selector
            Row(
              children: [
                Expanded(
                  child: _TabButton(
                    label: 'Classrooms & Rooms (${classes.length})',
                    active: _selectedTab == 0,
                    onTap: () => setState(() => _selectedTab = 0),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _TabButton(
                    label: 'Student Roster (${students.length})',
                    active: _selectedTab == 1,
                    onTap: () => setState(() => _selectedTab = 1),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Tab 0: Classrooms
            if (_selectedTab == 0) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Configured Classrooms',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                  TextButton.icon(
                    onPressed: _showAddClassDialog,
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Add Class'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (classes.isEmpty)
                const EmptyState(
                  icon: Icons.meeting_room_outlined,
                  title: 'No Classes Configured',
                  message: 'Tap Add Class to configure courses and assign room reference images.',
                )
              else
                ...classes.map((cls) => _ClassCard(classroom: cls)),
            ] else ...[
              // Tab 1: Students
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'College Student Database',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.ink),
                  ),
                  TextButton.icon(
                    onPressed: _showAddStudentDialog,
                    icon: const Icon(Icons.person_add_rounded, size: 18),
                    label: const Text('Register Student'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (students.isEmpty)
                const EmptyState(
                  icon: Icons.people_outline_rounded,
                  title: 'No Students in Database',
                  message: 'Add students to allow them to register biometrics and mark attendance.',
                )
              else
                ...students.map((stu) => _StudentCard(
                      student: stu,
                      onUnlock: () async {
                        await state.unlockStudent(stu.id);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Unlocked ${stu.name}. They can now re-enroll biometrics.'),
                              backgroundColor: AppColors.emerald,
                            ),
                          );
                        }
                      },
                    )),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatBadge extends StatelessWidget {
  const _StatBadge({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: Color(0xFFC7D2FE), fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
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
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? AppColors.primary : AppColors.line),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: active ? Colors.white : AppColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  const _ClassCard({required this.classroom});
  final Classroom classroom;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.school_rounded, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      classroom.name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.ink),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${classroom.code} • ${classroom.section}',
                      style: const TextStyle(fontSize: 12, color: AppColors.slate, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.cardSubtle,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  classroom.roomNumber,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Enrolled: ${classroom.studentCount} Students',
                style: const TextStyle(fontSize: 12, color: AppColors.slate, fontWeight: FontWeight.w500),
              ),
              Row(
                children: [
                  const Icon(Icons.photo_camera_front_rounded, size: 14, color: AppColors.emerald),
                  const SizedBox(width: 4),
                  Text(
                    classroom.roomPhoto.isNotEmpty ? 'Room Template Active' : 'No Room Photo',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: classroom.roomPhoto.isNotEmpty ? AppColors.emerald : AppColors.amber,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student, required this.onUnlock});
  final ControllerStudent student;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            child: Text(
              student.name.isNotEmpty ? student.name[0] : 'S',
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        student.name,
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: AppColors.ink),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: student.registrationLocked ? AppColors.emeraldBg : AppColors.amberBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        student.registrationLocked ? 'Locked (Registered)' : 'Pending Register',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: student.registrationLocked ? AppColors.emerald : AppColors.amber,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${student.rollNumber} • ${student.email}',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate),
                ),
                if (student.classes.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Classes: ${student.classes.join(", ")}',
                    style: const TextStyle(fontSize: 11.5, color: AppColors.muted, fontWeight: FontWeight.w500),
                  ),
                ],
              ],
            ),
          ),
          if (student.registrationLocked)
            IconButton(
              icon: const Icon(Icons.lock_open_rounded, color: AppColors.primary, size: 20),
              tooltip: 'Unlock Registration',
              onPressed: onUnlock,
            ),
        ],
      ),
    );
  }
}
