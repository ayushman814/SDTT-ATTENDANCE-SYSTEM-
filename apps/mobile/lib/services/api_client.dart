import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  String? accessToken;

  Future<void> persistToken() async {
    if (accessToken == null) {
      await _secureStorage.delete(key: 'attendrix_access_token');
    } else {
      await _secureStorage.write(key: 'attendrix_access_token', value: accessToken);
    }
  }

  Future<String?> restoreToken() => _secureStorage.read(key: 'attendrix_access_token');

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
          'Cannot reach the attendance service. Check your connection or API base URL.');
    } on http.ClientException {
      throw ApiException('The attendance service is unavailable. Try again.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
          'The request timed out. Check your connection and retry.');
    }
  }

  Future<AuthSession> login(String identifier, String password) async {
    final data = await _request('POST', '/auth/login',
        body: {'identifier': identifier, 'password': password});
    final session =
        AuthSession.fromJson(Map<String, dynamic>.from(data as Map));
    accessToken = session.accessToken;
    await persistToken();
    return session;
  }

  Future<User> me() async => User.fromJson(
      Map<String, dynamic>.from(await _request('GET', '/me') as Map));

  Future<List<Classroom>> classes() async {
    final raw = await _request('GET', '/classes');
    final list =
        raw is List ? raw : (raw is Map ? raw['classes'] : <dynamic>[]);
    return (list is List ? list : <dynamic>[])
        .map((e) => Classroom.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<AttendanceSession>> sessions() async {
    final raw = await _request('GET', '/sessions');
    final list =
        raw is List ? raw : (raw is Map ? raw['sessions'] : <dynamic>[]);
    return (list is List ? list : <dynamic>[])
        .map((e) =>
            AttendanceSession.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<AttendanceSession> session(String sessionId) async =>
      AttendanceSession.fromJson(Map<String, dynamic>.from(
          await _request('GET', '/sessions/$sessionId') as Map));

  Future<AttendanceSession> createSession(String classId, {String? title, DateTime? opensAt, DateTime? deadlineAt, Map<String, double>? stageRegion, int minimumPeopleVisible = 2}) async =>
      AttendanceSession.fromJson(Map<String, dynamic>.from(
          await _request('POST', '/sessions', body: {
            'class_id': classId,
            if (title != null) 'title': title,
            if (opensAt != null) 'opens_at': opensAt.toUtc().toIso8601String(),
            if (deadlineAt != null) 'deadline_at': deadlineAt.toUtc().toIso8601String(),
            if (stageRegion != null) 'stage_region': stageRegion,
            'minimum_people_visible': minimumPeopleVisible,
          })
              as Map));

  Future<Map<String, dynamic>> submitPhoto(String sessionId, File photo,
      {void Function(double progress)? onProgress}) async {
    final uri = _endpoint('/sessions/$sessionId/submissions');
    final request = http.MultipartRequest('POST', uri);
    request.headers['Accept'] = 'application/json';
    if (accessToken != null) {
      request.headers['Authorization'] = 'Bearer $accessToken';
    }
    request.files.add(await http.MultipartFile.fromPath('photo', photo.path));
    try {
      final multipartBody = request.finalize();
      final total = request.contentLength;
      final upload = http.StreamedRequest('POST', uri)
        ..headers.addAll(request.headers)
        ..contentLength = total;
      var sent = 0;
      final responseFuture = _client.send(upload).timeout(const Duration(seconds: 30));
      final body = multipartBody.transform(StreamTransformer<List<int>, List<int>>.fromHandlers(
        handleData: (chunk, sink) {
          sent += chunk.length;
          if (total > 0) onProgress?.call((sent / total).clamp(0, 1).toDouble());
          sink.add(chunk);
        },
      ));
      final pump = upload.sink.addStream(body).then((_) => upload.sink.close());
      final response = await responseFuture;
      await pump;
      onProgress?.call(1);
      final text = await response.stream.bytesToString();
      final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final detail =
            decoded is Map ? decoded['detail'] ?? decoded['message'] : null;
        throw ApiException(
            detail?.toString() ??
                'Image submission failed (${response.statusCode}).',
            statusCode: response.statusCode);
      }
      return Map<String, dynamic>.from(decoded as Map);
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException(
          'Upload could not reach the service. Check your connection and retry.');
    } catch (_) {
      throw ApiException(
          'Image submission failed. Check the selected file and retry.');
    }
  }

  Future<List<Map<String, dynamic>>> submissions(String sessionId) async {
    final raw = await _request('GET', '/sessions/$sessionId/submissions');
    return (raw is List ? raw : <dynamic>[])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
  }

  Future<void> reviewSubmission(String sessionId, String submissionId,
          String decision, String reason) async =>
      _request('POST', '/sessions/$sessionId/submissions/$submissionId/review',
          body: {'decision': decision, 'reason': reason});

  Future<void> openSession(String sessionId) async =>
      _request('POST', '/sessions/$sessionId/open');

  Future<void> closeSession(String sessionId) async =>
      _request('POST', '/sessions/$sessionId/close');

  Future<void> updateAttendance(String sessionId, String studentId, String status,
      {String? note}) async {
    await _request('PATCH', '/sessions/$sessionId/attendance/$studentId',
        body: {
          'status': status,
          if (note != null && note.isNotEmpty) 'note': note
        });
  }

  Future<void> finalizeSession(String sessionId) async =>
      _request('POST', '/sessions/$sessionId/finalize',
          body: {'mark_pending_absent': true});

  Future<StudentAttendance> studentAttendance() async =>
      StudentAttendance.fromJson(Map<String, dynamic>.from(
          await _request('GET', '/students/me/attendance') as Map));

  Future<List<AppNotification>> notifications() async {
    final raw = await _request('GET', '/notifications');
    final list = raw is List
        ? raw
        : raw is Map
            ? raw['notifications']
            : <dynamic>[];
    return (list is List ? list : <dynamic>[])
        .map((e) =>
            AppNotification.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<void> markNotificationRead(String id) async =>
      _request('POST', '/notifications/$id/read');

  Future<Map<String, dynamic>> enrollReferenceSelfie(List<int> bytes, bool consent) async {
    if (!consent) throw ApiException('Enrollment consent is required.');
    final request = http.MultipartRequest('POST', _endpoint('/students/me/face-enrollment'));
    request.headers['Accept'] = 'application/json';
    if (accessToken != null) request.headers['Authorization'] = 'Bearer $accessToken';
    request.files.add(http.MultipartFile.fromBytes('photo', bytes, filename: 'face-enrollment.jpg'));
    final response = await _client.send(request).timeout(const Duration(seconds: 30));
    final text = await response.stream.bytesToString();
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(decoded is Map ? decoded['detail']?.toString() ?? 'Face enrollment failed.' : 'Face enrollment failed.', statusCode: response.statusCode);
    }
    return Map<String, dynamic>.from(decoded as Map);
  }

  Future<Map<String, dynamic>> enrollmentStatus() async {
    final result = await _request('GET', '/registration');
    return Map<String, dynamic>.from(result as Map);
  }

  Future<AttendanceVerifyResult> verifyAttendanceLive(String sessionId, {required List<List<int>> faceFrames, required List<int> classroomBytes}) async {
    if (faceFrames.length < 4) throw ApiException('Capture the complete guided liveness sequence first.');
    final request = http.MultipartRequest('POST', _endpoint('/sessions/$sessionId/verification'));
    request.headers['Accept'] = 'application/json';
    if (accessToken != null) request.headers['Authorization'] = 'Bearer $accessToken';
    for (var index = 0; index < faceFrames.length; index++) {
      request.files.add(http.MultipartFile.fromBytes('face_frames', faceFrames[index], filename: 'face-$index.jpg'));
    }
    request.files.add(http.MultipartFile.fromBytes('classroom', classroomBytes, filename: 'classroom.jpg'));
    final response = await _client.send(request).timeout(const Duration(seconds: 60));
    final text = await response.stream.bytesToString();
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(decoded is Map ? decoded['detail']?.toString() ?? 'Verification failed.' : 'Verification failed.', statusCode: response.statusCode);
    }
    return AttendanceVerifyResult.fromJson(Map<String, dynamic>.from(decoded as Map));
  }

  Future<Map<String, dynamic>> checkinSweep({required String sessionId, required String attemptId, required List<Map<String, dynamic>> metadata, required List<List<int>> frameBytesList}) async {
    throw ApiException('Continuous sweep verification is not enabled. Use the guided face and classroom verification workflow.');
  }

  Future<String> wsTicket() async {
    final data = await _request('POST', '/auth/ws-ticket');
    return (data as Map)['ticket'].toString();
  }
}
