import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/models.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  String? accessToken;

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (accessToken != null) 'Authorization': 'Bearer $accessToken',
      };

  Uri _endpoint(String suffix) {
    final base = AppConfig.apiUri.path.endsWith('/')
        ? AppConfig.apiUri.path.substring(0, AppConfig.apiUri.path.length - 1)
        : AppConfig.apiUri.path;
    return AppConfig.apiUri.replace(path: '$base$suffix');
  }

  Future<dynamic> _request(String method, String path,
      {Object? body, Map<String, String>? query}) async {
    final uri = _endpoint(path).replace(queryParameters: query);
    try {
      final request = http.Request(method, uri)..headers.addAll(_headers);
      if (body != null) request.body = jsonEncode(body);
      final response =
          await _client.send(request).timeout(const Duration(seconds: 18));
      final text = await response.stream.bytesToString();
      dynamic decoded;
      if (text.trim().isNotEmpty) {
        try {
          decoded = jsonDecode(text);
        } catch (_) {
          decoded = text;
        }
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message =
            decoded is Map ? (decoded['detail'] ?? decoded['message']) : null;
        throw ApiException(
            message?.toString() ?? 'Request failed (${response.statusCode}).',
            statusCode: response.statusCode);
      }
      return decoded;
    } on SocketException {
      throw ApiException(
          'Cannot reach attendance service. Check your network connection.');
    } on http.ClientException {
      throw ApiException('The attendance service is unavailable. Try again.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
          'The request timed out. Check connection and retry.');
    }
  }

  Future<AuthSession> login(String email, String password, {String? selectedRole}) async {
    final body = <String, dynamic>{
      'email': email.trim(),
      'password': password,
      if (selectedRole != null) 'selected_role': selectedRole,
    };
    final data = await _request('POST', '/auth/login', body: body);
    final session = AuthSession.fromJson(Map<String, dynamic>.from(data as Map));
    accessToken = session.accessToken;
    return session;
  }

  Future<User> me() async => User.fromJson(
      Map<String, dynamic>.from(await _request('GET', '/me') as Map));

  Future<DateTime> serverTime() async {
    final res = await _request('GET', '/time');
    if (res is Map && res['server_time'] != null) {
      return DateTime.tryParse(res['server_time'].toString()) ?? DateTime.now();
    }
    return DateTime.now();
  }

  Future<EnrollmentStatus> enrollmentStatus() async {
    final res = await _request('GET', '/auth/enrollment-status');
    return EnrollmentStatus.fromJson(Map<String, dynamic>.from(res as Map));
  }

  Future<Map<String, dynamic>> enrollReferenceSelfie(
      List<int> imageBytes, bool consent) async {
    final uri = _endpoint('/auth/enroll');
    final req = http.MultipartRequest('POST', uri);
    if (accessToken != null) {
      req.headers['Authorization'] = 'Bearer $accessToken';
    }
    req.fields['consent'] = consent ? 'true' : 'false';
    req.files.add(http.MultipartFile.fromBytes(
      'photo',
      imageBytes,
      filename: 'reference_selfie.jpg',
    ));

    final streamed = await _client.send(req).timeout(const Duration(seconds: 25));
    final text = await streamed.stream.bytesToString();
    dynamic decoded;
    try {
      decoded = jsonDecode(text);
    } catch (_) {
      decoded = text;
    }
    if (streamed.statusCode != 200) {
      final msg = decoded is Map ? (decoded['detail'] ?? decoded['message']) : null;
      throw ApiException(msg?.toString() ?? 'Enrollment failed (${streamed.statusCode}).',
          statusCode: streamed.statusCode);
    }
    return Map<String, dynamic>.from(decoded as Map);
  }

  Future<List<Classroom>> classes() async {
    final raw = await _request('GET', '/classes');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => Classroom.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<AttendanceSession>> sessions() async {
    final raw = await _request('GET', '/sessions');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => AttendanceSession.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<AttendanceSession> session(String id) async =>
      AttendanceSession.fromJson(
          Map<String, dynamic>.from(await _request('GET', '/sessions/$id') as Map));

  Future<AttendanceSession> createSession(String classId, {int durationMinutes = 10}) async {
    final data = await _request(
      'POST',
      '/sessions',
      body: {'class_id': classId, 'duration_minutes': durationMinutes},
    );
    return AttendanceSession.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<Map<String, dynamic>> checkinSweep({
    required String sessionId,
    required String attemptId,
    required List<Map<String, dynamic>> metadata,
    required List<List<int>> frameBytesList,
  }) async {
    final uri = _endpoint('/sessions/$sessionId/checkin');
    final req = http.MultipartRequest('POST', uri);
    if (accessToken != null) {
      req.headers['Authorization'] = 'Bearer $accessToken';
    }
    req.fields['attempt_id'] = attemptId;
    req.fields['metadata'] = jsonEncode(metadata);

    for (int i = 0; i < frameBytesList.length; i++) {
      req.files.add(http.MultipartFile.fromBytes(
        'frames',
        frameBytesList[i],
        filename: 'frame_$i.jpg',
      ));
    }

    final streamed = await _client.send(req).timeout(const Duration(seconds: 40));
    final text = await streamed.stream.bytesToString();
    dynamic decoded;
    try {
      decoded = jsonDecode(text);
    } catch (_) {
      decoded = text;
    }
    if (streamed.statusCode != 200) {
      final msg = decoded is Map ? (decoded['detail'] ?? decoded['message']) : null;
      throw ApiException(msg?.toString() ?? 'Sweep checkin failed (${streamed.statusCode}).',
          statusCode: streamed.statusCode);
    }
    return Map<String, dynamic>.from(decoded as Map);
  }

  Future<List<CheckinReviewItem>> reviewQueue(String sessionId) async {
    final raw = await _request('GET', '/sessions/$sessionId/review-queue');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => CheckinReviewItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> reviewDecision(
    String sessionId,
    String attemptId,
    String decision, {
    String? note,
  }) async {
    final res = await _request(
      'POST',
      '/sessions/$sessionId/review/$attemptId',
      body: {'decision': decision, if (note != null) 'note': note},
    );
    return Map<String, dynamic>.from(res as Map);
  }

  Future<void> updateAttendance(
    String sessionId,
    String studentId,
    String status, {
    String? note,
  }) async {
    await _request(
      'PATCH',
      '/sessions/$sessionId/attendance/$studentId',
      body: {'status': status, 'note': note},
    );
  }

  Future<AttendanceSession> finalizeSession(
    String sessionId, {
    bool markPendingAbsent = true,
  }) async {
    final data = await _request(
      'POST',
      '/sessions/$sessionId/finalize',
      body: {'mark_pending_absent': markPendingAbsent},
    );
    return AttendanceSession.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<StudentAttendance> studentAttendance() async =>
      StudentAttendance.fromJson(Map<String, dynamic>.from(
          await _request('GET', '/students/me/attendance') as Map));

  Future<List<AppNotification>> notifications() async {
    final raw = await _request('GET', '/notifications');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => AppNotification.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    await _request('POST', '/notifications/$id/read');
  }

  Future<String> wsTicket() async {
    final data = await _request('POST', '/realtime/ticket');
    return (data as Map)['ticket'].toString();
  }

  Future<SessionReport> report(String sessionId) async {
    final data = await _request('GET', '/sessions/$sessionId/report');
    return SessionReport.fromJson(Map<String, dynamic>.from(data as Map));
  }

  String sessionExcelExportUrl(String sessionId) {
    return '${AppConfig.apiBaseUrl}/sessions/$sessionId/export/excel';
  }

  Future<AttendanceVerifyResult> verifyAttendanceLive(
    String sessionId, {
    required List<int> faceBytes,
    List<int>? roomBytes,
  }) async {
    final uri = _endpoint('/sessions/$sessionId/verify-attendance');
    final req = http.MultipartRequest('POST', uri);
    if (accessToken != null) {
      req.headers['Authorization'] = 'Bearer $accessToken';
    }
    req.files.add(http.MultipartFile.fromBytes(
      'face_image',
      faceBytes,
      filename: 'live_face.jpg',
    ));
    if (roomBytes != null && roomBytes.isNotEmpty) {
      req.files.add(http.MultipartFile.fromBytes(
        'classroom_image',
        roomBytes,
        filename: 'classroom_room.jpg',
      ));
    }

    try {
      final streamed = await req.send().timeout(const Duration(seconds: 25));
      final resp = await http.Response.fromStream(streamed);
      final body = resp.body.isNotEmpty ? jsonDecode(resp.body) : {};
      if (resp.statusCode >= 400) {
        final detail = body is Map ? body['detail'] : resp.body;
        throw ApiException(detail?.toString() ?? 'Verification failed', statusCode: resp.statusCode);
      }
      return AttendanceVerifyResult.fromJson(Map<String, dynamic>.from(body as Map));
    } on SocketException {
      throw ApiException('Unable to reach the attendance server.', statusCode: 0);
    }
  }

  Future<List<Classroom>> controllerClasses() async {
    final raw = await _request('GET', '/controller/classes');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => Classroom.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<Classroom> controllerCreateClass({
    required String name,
    required String code,
    String? section,
    String? roomNumber,
    String? roomPhoto,
    String? teacherId,
  }) async {
    final data = await _request(
      'POST',
      '/controller/classes',
      body: {
        'name': name,
        'code': code,
        'section': section,
        'room_number': roomNumber,
        'room_photo': roomPhoto,
        'teacher_id': teacherId,
      },
    );
    return Classroom.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<List<ControllerStudent>> controllerStudents() async {
    final raw = await _request('GET', '/controller/students');
    final list = raw is List ? raw : <dynamic>[];
    return list
        .map((e) => ControllerStudent.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<ControllerStudent> controllerCreateStudent({
    required String name,
    required String email,
    required String rollNumber,
    String? studentId,
    List<String> classIds = const [],
  }) async {
    final data = await _request(
      'POST',
      '/controller/students',
      body: {
        'name': name,
        'email': email,
        'roll_number': rollNumber,
        'student_id': studentId,
        'class_ids': classIds,
      },
    );
    return ControllerStudent.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> controllerUnlockStudent(String studentId) async {
    await _request('POST', '/controller/students/$studentId/unlock');
  }
}
