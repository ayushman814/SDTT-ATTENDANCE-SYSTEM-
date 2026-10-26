import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'panorama_models.dart';

class PanoramaException implements Exception {
  PanoramaException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

/// Client for the panorama attendance API (`apps/panorama/api`, FastAPI).
/// Point it at a running backend with
/// `--dart-define=PANORAMA_API_URL=http://<host>:8100/api`.
class PanoramaApi {
  PanoramaApi({http.Client? client}) : _client = client ?? http.Client();

  static String baseUrl = const String.fromEnvironment(
    'PANORAMA_API_URL',
    defaultValue: 'http://localhost:8100/api',
  );

  final http.Client _client;
  String? _accessToken;
  PanoramaUser? _user;

  PanoramaUser? get user => _user;
  bool get isLoggedIn => _accessToken != null;

  void logout() {
    _accessToken = null;
    _user = null;
  }

  Uri _uri(String path) {
    final base = Uri.parse(baseUrl);
    final basePath =
        base.path.endsWith('/') ? base.path.substring(0, base.path.length - 1) : base.path;
    return base.replace(path: '$basePath$path');
  }

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      };

  Never _fail(http.BaseResponse response, String body) {
    String message = 'Request failed (${response.statusCode}).';
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['detail'] != null) {
        message = decoded['detail'].toString();
      }
    } catch (_) {
      if (body.trim().isNotEmpty) message = body;
    }
    throw PanoramaException(message, statusCode: response.statusCode);
  }

  Future<dynamic> _json(String method, String path, {Object? body}) async {
    http.StreamedResponse streamed;
    try {
      final request = http.Request(method, _uri(path))
        ..headers.addAll(_headers);
      if (body != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(body);
      }
      streamed = await _client.send(request).timeout(const Duration(seconds: 18));
    } on TimeoutException {
      throw PanoramaException('The request timed out. Check your connection.');
    } catch (_) {
      throw PanoramaException(
          'Cannot reach the attendance service at $baseUrl.');
    }
    final text = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      _fail(streamed, text);
    }
    if (text.trim().isEmpty) return null;
    try {
      return jsonDecode(text);
    } catch (_) {
      return text;
    }
  }

  /// Student login — role is fixed to "student" (the panorama flow is
  /// student-side; the web professor dashboard covers lecturers).
  Future<PanoramaUser> login(String email, String password) async {
    final data = await _json('POST', '/auth/login', body: {
      'role': 'student',
      'email': email,
      'password': password,
    });
    final map = Map<String, dynamic>.from(data as Map);
    _accessToken = map['access_token'] as String;
    _user = PanoramaUser.fromJson(Map<String, dynamic>.from(map['user'] as Map));
    return _user!;
  }

  Future<List<PanoramaSession>> activeSessions() async {
    final data = await _json('GET', '/student/sessions/active');
    final list = (data as Map)['sessions'] as List? ?? const [];
    return list
        .map((e) => PanoramaSession.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<List<PanoramaHistoryCourse>> history() async {
    final data = await _json('GET', '/student/history');
    final list = (data as Map)['courses'] as List? ?? const [];
    return list
        .map((e) =>
            PanoramaHistoryCourse.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  /// Live-capture submit: selfie (front cam) + sweep frames (back cam).
  /// The server stitches the frames, verifies self/lecturer/neighbour and
  /// returns the verdict — there is no manual-upload path.
  Future<PanoramaResult> submit({
    required String sessionId,
    required Uint8List selfie,
    required List<Uint8List> frames,
    double? geoLat,
    double? geoLng,
  }) async {
    if (frames.length < 4) {
      throw PanoramaException(
          'Capture at least 4 sweep frames covering the lecturer and class.');
    }
    final request = http.MultipartRequest('POST', _uri('/sessions/$sessionId/submit'))
      ..headers.addAll(_headers)
      ..files.add(http.MultipartFile.fromBytes('selfie', selfie,
          filename: 'selfie.jpg'))
      ..files.addAll(frames.asMap().entries.map((e) =>
          http.MultipartFile.fromBytes('frames', e.value,
              filename: 'frame_${e.key}.jpg')));
    if (geoLat != null) request.fields['geo_lat'] = geoLat.toString();
    if (geoLng != null) request.fields['geo_lng'] = geoLng.toString();

    http.StreamedResponse streamed;
    try {
      streamed = await _client.send(request).timeout(const Duration(seconds: 60));
    } on TimeoutException {
      throw PanoramaException('Upload timed out. Check your connection.');
    } catch (_) {
      throw PanoramaException(
          'Cannot reach the attendance service at $baseUrl.');
    }
    final text = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      _fail(streamed, text);
    }
    return PanoramaResult.fromJson(
        Map<String, dynamic>.from(jsonDecode(text) as Map));
  }
}
