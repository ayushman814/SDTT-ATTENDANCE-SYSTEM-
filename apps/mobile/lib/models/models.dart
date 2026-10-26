import 'dart:convert';

String _string(dynamic value, [String fallback = '']) =>
    value?.toString() ?? fallback;
int _int(dynamic value) =>
    value is int ? value : int.tryParse(_string(value)) ?? 0;
double _double(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse(_string(value)) ?? 0;
Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.registrationId,
  });
  final String id;
  final String name;
  final String email;
  final String role;
  final String? registrationId;
  bool get isTeacher => role.toLowerCase() == 'teacher';
  String get displayRole => role == 'controller' ? 'Controller' : isTeacher ? 'Teacher' : 'Student';
  factory User.fromJson(Map<String, dynamic> json) => User(
        id: _string(json['id']),
        name: _string(json['name'], 'User'),
        email: _string(json['email']),
        role: _string(json['role'], 'student'),
        registrationId: json['registration_id'] == null
            ? null
            : _string(json['registration_id']),
      );
}

class AuthSession {
  const AuthSession({required this.accessToken, required this.user});
  final String accessToken;
  final User user;
  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        accessToken: _string(json['access_token']),
        user: User.fromJson(_map(json['user'])),
      );
}

class Classroom {
  const Classroom({
    required this.id,
    required this.name,
    this.code = '',
    this.teacherName = '',
    this.section = '',
    this.roomNumber = '',
    this.roomPhoto = '',
    this.studentCount = 0,
  });
  final String id;
  final String name;
  final String code;
  final String teacherName;
  final String section;
  final String roomNumber;
  final String roomPhoto;
  final int studentCount;
  factory Classroom.fromJson(Map<String, dynamic> json) => Classroom(
        id: _string(json['id'] ?? json['class_id']),
        name: _string(json['name'] ?? json['title'],
            'Class ${json['id'] ?? ''}'),
        code: _string(json['code']),
        teacherName: _string(json['teacher_name']),
        section: _string(json['section']),
        roomNumber: _string(json['room_number'] ?? json['room']),
        roomPhoto: _string(json['room_photo']),
        studentCount: _int(json['student_count']),
      );
}

class ControllerStudent {
  const ControllerStudent({required this.id, required this.name, required this.email, this.rollNumber = '', this.classes = const [], this.registrationLocked = false});
  final String id;
  final String name;
  final String email;
  final String rollNumber;
  final List<String> classes;
  final bool registrationLocked;
  factory ControllerStudent.fromJson(Map<String, dynamic> json) => ControllerStudent(
    id: _string(json['id']), name: _string(json['name'], 'Student'), email: _string(json['email']),
    rollNumber: _string(json['roll_number'] ?? json['registration_id']),
    classes: (json['classes'] is List ? (json['classes'] as List).map(_string).toList() : <String>[]),
    registrationLocked: json['registration_locked'] == true || json['face_enrolled'] == true,
  );
}

class AttendanceVerifyResult {
  const AttendanceVerifyResult({required this.status, required this.message, this.faceConfidence, this.faceMatch = false, this.roomMatch = false, this.livenessStatus = 'INCONCLUSIVE'});
  final String status;
  final String message;
  final double? faceConfidence;
  final bool faceMatch;
  final bool roomMatch;
  final String livenessStatus;
  bool get isPresent => status == 'CONFIRMED';
  bool get isFlagged => status == 'PENDING_REVIEW';
  factory AttendanceVerifyResult.fromJson(Map<String, dynamic> json) {
    final identity = _map(json['identity']);
    final liveness = _map(json['liveness']);
    final classroom = _map(json['classroom_context']);
    return AttendanceVerifyResult(
      status: _string(json['status'], 'PENDING_REVIEW'), message: _string(json['reason'], 'Verification result is available for review.'),
      faceConfidence: identity['similarity'] == null ? null : _double(identity['similarity']), faceMatch: _string(identity['status']) == 'VERIFIED',
      roomMatch: _string(classroom['status']) == 'VERIFIED', livenessStatus: _string(liveness['status'], 'INCONCLUSIVE'),
    );
  }
}

class AttendanceRecord {
  const AttendanceRecord({
    required this.studentId,
    required this.studentName,
    required this.status,
    this.note = '',
    this.confidence,
    this.sessionId,
    this.className,
    this.updatedAt,
    this.verificationStatus,
    this.verificationSource,
  });
  final String studentId;
  final String studentName;
  final String status;
  final String note;
  final double? confidence;
  final String? sessionId;
  final String? className;
  final DateTime? updatedAt;
  final String? verificationStatus;
  final String? verificationSource;
  bool get isPresent => status == 'present';
  bool get isAbsent => status == 'absent';
  bool get isPending => status == 'pending';
  AttendanceRecord copyWith({String? status, String? note, double? confidence}) =>
      AttendanceRecord(
        studentId: studentId,
        studentName: studentName,
        status: status ?? this.status,
        note: note ?? this.note,
        confidence: confidence ?? this.confidence,
        sessionId: sessionId,
        className: className,
        updatedAt: updatedAt,
        verificationStatus: verificationStatus,
        verificationSource: verificationSource,
      );
  factory AttendanceRecord.fromJson(Map<String, dynamic> json) =>
      AttendanceRecord(
        studentId: _string(json['student_id'] ?? json['id']),
        studentName: _string(json['student_name'] ?? json['name'], 'Student'),
        status: _string(json['status'], 'pending'),
        note: _string(json['note']),
        confidence:
            json['confidence'] == null ? null : _double(json['confidence']),
        sessionId: json['session_id'] == null
            ? null
            : _string(json['session_id']),
        className: json['class_name'] == null
            ? null
            : _string(json['class_name']),
        updatedAt: DateTime.tryParse(_string(json['updated_at'])),
        verificationStatus: json['verification_status'] == null
            ? null
            : _string(json['verification_status']),
        verificationSource: json['verification_source'] == null
            ? null
            : _string(json['verification_source']),
      );
}

class Suggestion {
  const Suggestion({
    required this.studentId,
    required this.studentName,
    required this.confidence,
    this.status = 'present',
  });
  final String studentId;
  final String studentName;
  final double confidence;
  final String status;
  factory Suggestion.fromJson(Map<String, dynamic> json) => Suggestion(
        studentId: _string(json['student_id'] ?? json['id']),
        studentName: _string(json['student_name'] ?? json['name'], 'Student'),
        confidence: _double(json['confidence']),
        status: 'present',
      );
}

class AttendanceSession {
  const AttendanceSession({
    required this.id,
    required this.classId,
    required this.className,
    required this.status,
    required this.records,
    this.title = '',
    this.professorName = '',
    this.opensAt,
    this.deadlineAt,
    this.createdAt,
    this.finalizedAt,
    this.submission,
  });
  final String id;
  final String classId;
  final String className;
  final String status;
  final List<AttendanceRecord> records;
  final String title;
  final String professorName;
  final DateTime? opensAt;
  final DateTime? deadlineAt;
  final DateTime? createdAt;
  final DateTime? finalizedAt;
  final Map<String, dynamic>? submission;
  bool get isOpen => status.toLowerCase() == 'open';
  factory AttendanceSession.fromJson(Map<String, dynamic> json) {
    final rawRecords =
        json['attendance'] ?? json['records'] ?? json['roster'] ?? <dynamic>[];
    final list = rawRecords is List ? rawRecords : <dynamic>[];
    return AttendanceSession(
      id: _string(json['id'] ?? json['session_id']),
      classId: _string(json['class_id'] ?? _map(json['class'])['id']),
      className: _string(json['class_name'] ?? _map(json['class'])['name'],
          'Attendance session'),
      status: _string(json['status'], 'open'),
      records: list.map((e) => AttendanceRecord.fromJson(_map(e))).toList(),
      title: _string(json['title']),
      professorName: _string(json['professor_name']),
      opensAt: DateTime.tryParse(_string(json['opens_at'])),
      deadlineAt: DateTime.tryParse(_string(json['deadline_at'])),
      createdAt: DateTime.tryParse(_string(json['created_at'])),
      finalizedAt: DateTime.tryParse(_string(json['finalized_at'])),
      submission: json['submission'] is Map ? _map(json['submission']) : null,
    );
  }
}

class AttendanceSummary {
  const AttendanceSummary({
    required this.total,
    required this.present,
    required this.absent,
    required this.pending,
    required this.percentage,
  });
  final int total;
  final int present;
  final int absent;
  final int pending;
  final double percentage;
  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    final source =
        _map(json['summary']).isNotEmpty ? _map(json['summary']) : json;
    return AttendanceSummary(
      total: _int(source['total'] ??
          source['total_finalized'] ??
          source['total_sessions']),
      present: _int(source['present']),
      absent: _int(source['absent']),
      pending: _int(source['pending']),
      percentage:
          _double(source['percentage'] ?? source['attendance_percentage']),
    );
  }
}

class StudentAttendance {
  const StudentAttendance({required this.entries, required this.summary});
  final List<AttendanceRecord> entries;
  final AttendanceSummary summary;
  factory StudentAttendance.fromJson(Map<String, dynamic> json) {
    final raw = json['entries'] ?? json['attendance'] ?? <dynamic>[];
    return StudentAttendance(
      entries: (raw is List ? raw : <dynamic>[])
          .map((e) => AttendanceRecord.fromJson(_map(e)))
          .toList(),
      summary: AttendanceSummary.fromJson(json),
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.read,
    this.createdAt,
  });
  final String id;
  final String title;
  final String message;
  final bool read;
  final DateTime? createdAt;
  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: _string(json['id']),
        title: _string(json['title'], 'Attendance update'),
        message: _string(json['message'] ?? json['body']),
        read: json['read'] == true ||
            json['is_read'] == true ||
            json['read_at'] != null,
        createdAt: DateTime.tryParse(_string(json['created_at'])),
      );
}

class RealtimeEvent {
  const RealtimeEvent({required this.type, required this.data});
  final String type;
  final Map<String, dynamic> data;
  factory RealtimeEvent.fromJson(dynamic value) {
    final map = value is String ? jsonDecode(value) : value;
    final json = _map(map);
    return RealtimeEvent(type: _string(json['type']), data: _map(json['data']));
  }
}
