import 'package:flutter_test/flutter_test.dart';
import 'package:classroom_attendance_mobile/app.dart';
import 'package:classroom_attendance_mobile/models/models.dart';

void main() {
  testWidgets('app renders role selection screen with Student and Lecturer options',
      (tester) async {
    await tester.pumpWidget(const AttendanceApp());
    expect(find.text('Attendrix'), findsOneWidget);
    expect(find.text('I am a Student'), findsOneWidget);
    expect(find.text('I am a Lecturer'), findsOneWidget);
  });

  test('User model maps DB teacher role to display Lecturer', () {
    final teacher = User.fromJson({
      'id': 't1',
      'name': 'Dr. Sharma',
      'email': 'sharma@sdtt.edu',
      'role': 'teacher',
    });
    expect(teacher.isTeacher, true);
    expect(teacher.displayRole, 'Lecturer');

    final student = User.fromJson({
      'id': 's1',
      'name': 'Himanshu',
      'email': 'himanshu@sdtt.edu',
      'role': 'student',
    });
    expect(student.isTeacher, false);
    expect(student.displayRole, 'Student');
  });

  test('AttendanceSession parses duration, server_time, and headline counts', () {
    final session = AttendanceSession.fromJson({
      'id': 'sess-1',
      'class_id': 'c1',
      'class_name': 'Distributed Systems',
      'class_code': 'CS-401',
      'status': 'open',
      'created_at': '2026-10-26T10:00:00Z',
      'duration_minutes': 15,
      'server_time': '2026-10-26T10:02:30Z',
      'summary': {
        'verified_count': 42,
        'flagged_count': 3,
      },
      'attendance': [
        {
          'student_id': 's1',
          'student_name': 'Himanshu',
          'status': 'present',
        },
      ],
    });
    expect(session.id, 'sess-1');
    expect(session.durationMinutes, 15);
    expect(session.verifiedCount, 42);
    expect(session.flaggedCount, 3);
    expect(session.records.length, 1);
    expect(session.records.first.isPresent, true);
  });
}

