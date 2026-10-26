/// Models for the panorama attendance API (`apps/panorama/api`).
class PanoramaUser {
  const PanoramaUser({
    required this.id,
    required this.name,
    required this.email,
    required this.faceEnrolled,
  });

  final int id;
  final String name;
  final String email;
  final bool faceEnrolled;

  factory PanoramaUser.fromJson(Map<String, dynamic> json) => PanoramaUser(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        faceEnrolled: json['face_enrolled'] as bool? ?? false,
      );
}

class PanoramaSession {
  const PanoramaSession({
    required this.publicId,
    required this.courseCode,
    required this.courseName,
    required this.endTime,
    required this.geoEnabled,
    this.myStatus,
    this.myReason,
  });

  final String publicId;
  final String courseCode;
  final String courseName;
  final DateTime endTime;
  final bool geoEnabled;
  final String? myStatus;
  final String? myReason;

  Duration get remaining => endTime.difference(DateTime.now());
  bool get alreadySubmitted =>
      myStatus == 'present' || myStatus == 'pending_review';

  factory PanoramaSession.fromJson(Map<String, dynamic> json) =>
      PanoramaSession(
        publicId: json['public_id'] as String,
        courseCode: json['course_code'] as String? ?? '',
        courseName: json['course_name'] as String? ?? '',
        endTime: DateTime.parse(json['end_time'] as String).toLocal(),
        geoEnabled: json['geo_enabled'] as bool? ?? false,
        myStatus: json['my_status'] as String?,
        myReason: json['my_reason'] as String?,
      );
}

class PanoramaResult {
  const PanoramaResult({
    required this.status,
    this.reason,
    this.reasonCode,
  });

  final String status;
  final String? reason;
  final String? reasonCode;

  bool get ok => status == 'present' || status == 'pending_review';

  factory PanoramaResult.fromJson(Map<String, dynamic> json) => PanoramaResult(
        status: json['status'] as String? ?? 'rejected',
        reason: json['reason'] as String?,
        reasonCode: json['reason_code'] as String?,
      );
}

class PanoramaHistoryCourse {
  const PanoramaHistoryCourse({
    required this.courseCode,
    required this.courseName,
    required this.attended,
    required this.total,
    required this.pct,
  });

  final String courseCode;
  final String courseName;
  final int attended;
  final int total;
  final double pct;

  factory PanoramaHistoryCourse.fromJson(Map<String, dynamic> json) =>
      PanoramaHistoryCourse(
        courseCode: json['course_code'] as String? ?? '',
        courseName: json['course_name'] as String? ?? '',
        attended: json['sessions_attended'] as int? ?? 0,
        total: json['sessions_total'] as int? ?? 0,
        pct: (json['pct'] as num?)?.toDouble() ?? 0,
      );
}
