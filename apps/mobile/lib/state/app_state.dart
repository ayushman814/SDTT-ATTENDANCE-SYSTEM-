import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/realtime_service.dart';

class AppState extends ChangeNotifier {
  AppState() {
    realtime = RealtimeService(api);
    restoreSession();
  }
  final ApiClient api = ApiClient();
  late final RealtimeService realtime;
  AuthSession? auth;
  List<Classroom> classes = [];
  List<AttendanceSession> sessions = [];
  List<AppNotification> notifications = [];
  StudentAttendance? studentAttendance;
  AttendanceSession? activeSession;
  List<Suggestion> suggestions = [];
  List<Classroom> controllerClasses = [];
  List<ControllerStudent> controllerStudents = [];
  Map<String, dynamic>? latestSubmission;
  bool busy = false;
  String? error;
  String? liveMessage;

  Future<void> restoreSession() async {
    final token = await api.restoreToken();
    if (token == null || token.isEmpty) return;
    try {
      api.accessToken = token;
      final profile = await api.me();
      auth = AuthSession(accessToken: token, user: profile);
      await loadHome();
      _startRealtime();
    } on ApiException {
      api.accessToken = null;
      await api.persistToken();
    } finally {
      notifyListeners();
    }
  }

  User? get user => auth?.user;
  bool get isTeacher => user?.isTeacher == true;
  int get unreadCount => notifications.where((n) => !n.read).length;

  Future<bool> login(String identifier, String password, {String? expectedRole}) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final authenticated = await api.login(identifier.trim(), password);
      if (expectedRole != null && authenticated.user.role != expectedRole) {
        api.accessToken = null;
        error = 'This account is registered as ${authenticated.user.role}; choose the matching sign-in role.';
        return false;
      }
      auth = authenticated;
      await loadHome();
      _startRealtime();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> loadHome() async {
    classes = await api.classes();
    sessions = await api.sessions();
    notifications = await api.notifications();
    if (!isTeacher) studentAttendance = await api.studentAttendance();
    notifyListeners();
  }

  void setRole(String role) {
    // The backend remains the source of truth for roles; this only supports
    // the legacy role-selection screen's local navigation state.
    notifyListeners();
  }

  Future<void> checkEnrollment() async {
    try {
      await api.enrollmentStatus();
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
    }
  }

  Future<AttendanceVerifyResult> verifyAttendanceLive(String sessionId, {required List<List<int>> faceFrames, required List<int> roomBytes}) async {
    final result = await api.verifyAttendanceLive(sessionId, faceFrames: faceFrames, classroomBytes: roomBytes);
    latestSubmission = {'status': result.status, 'reason': result.message};
    studentAttendance = await api.studentAttendance();
    notifyListeners();
    return result;
  }

  Future<void> loadControllerData() async {
    try {
      controllerClasses = await api.classes();
      controllerStudents = [];
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
    }
  }

  Future<bool> createClassroom({required String name, required String code, required String section, required String roomNumber, required String roomPhoto}) async {
    error = 'Classroom administration requires the controller API workflow and cannot be completed from this client yet.';
    notifyListeners();
    return false;
  }

  Future<bool> createStudent({required String name, required String email, required String rollNumber, String? studentId, required List<String> classIds}) async {
    error = 'Student registry imports must be performed through the validated controller import workflow.';
    notifyListeners();
    return false;
  }

  Future<void> unlockStudent(String studentId) async {
    error = 'Biometric reset requires an authorized controller action.';
    notifyListeners();
  }

  Future<void> retryHome() async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await loadHome();
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void _startRealtime() {
    realtime.connect(onEvent: (event) async {
      liveMessage = 'Live update: ${event.type}';
      if (event.type == 'connected') {
        await loadHome();
        liveMessage = 'Live updates connected';
        return;
      }
      if (event.type == 'notification.created' ||
          event.type == 'session.finalized') {
        notifications = await api.notifications();
      }
      if (event.type == 'session.finalized' && !isTeacher) {
        studentAttendance = await api.studentAttendance();
      }
      if (event.type == 'attendance.changed' && activeSession != null) {
        activeSession = await api.session(activeSession!.id);
      }
      if (event.type == 'session.created' ||
          event.type == 'session.finalized') {
        sessions = await api.sessions();
      }
      notifyListeners();
    }, onError: (message) {
      liveMessage = message;
      notifyListeners();
    });
  }

  Future<void> openSession(String sessionId) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      activeSession = await api.session(sessionId);
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> startSession(String classId,
      {String? title, DateTime? opensAt, Duration? duration,
      Map<String, double>? stageRegion, int minimumPeopleVisible = 2}) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final start = opensAt ?? DateTime.now();
      activeSession = await api.createSession(
        classId,
        title: title,
        opensAt: start,
        deadlineAt: start.add(duration ?? const Duration(minutes: 10)),
        stageRegion: stageRegion,
        minimumPeopleVisible: minimumPeopleVisible,
      );
      sessions = await api.sessions();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> uploadCapture(File file) async {
    error = 'Professor capture is disabled. Students submit their own classroom image through a timed session.';
    notifyListeners();
    return false;
  }

  Future<bool> submitStudentImage(String sessionId, File file,
      {void Function(double progress)? onProgress}) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      latestSubmission = await api.submitPhoto(sessionId, file, onProgress: onProgress);
      studentAttendance = await api.studentAttendance();
      activeSession = await api.session(sessionId);
      sessions = await api.sessions();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<List<Map<String, dynamic>>> loadSubmissions(String sessionId) =>
      api.submissions(sessionId);

  Future<bool> reviewSubmission(String sessionId, String submissionId,
      String decision, String reason) async {
    try {
      await api.reviewSubmission(sessionId, submissionId, decision, reason);
      activeSession = await api.session(sessionId);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<void> openAttendanceWindow(String sessionId) async {
    await api.openSession(sessionId);
    activeSession = await api.session(sessionId);
    sessions = await api.sessions();
    notifyListeners();
  }

  Future<void> closeAttendanceWindow(String sessionId) async {
    await api.closeSession(sessionId);
    activeSession = await api.session(sessionId);
    sessions = await api.sessions();
    notifyListeners();
  }

  Future<bool> setAttendance(String studentId, String status) async {
    if (activeSession == null) return false;
    try {
      await api.updateAttendance(activeSession!.id, studentId, status);
      activeSession = await api.session(activeSession!.id);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<bool> finalizeActive() async {
    if (activeSession == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.finalizeSession(activeSession!.id);
      activeSession = await api.session(activeSession!.id);
      sessions = await api.sessions();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> markNotificationRead(AppNotification item) async {
    if (item.read) return;
    try {
      await api.markNotificationRead(item.id);
      notifications = notifications
          .map((n) => n.id == item.id
              ? AppNotification(
                  id: n.id,
                  title: n.title,
                  message: n.message,
                  read: true,
                  createdAt: n.createdAt)
              : n)
          .toList();
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await realtime.dispose();
    api.accessToken = null;
    await api.persistToken();
    auth = null;
    classes = [];
    sessions = [];
    notifications = [];
    activeSession = null;
    suggestions = [];
    notifyListeners();
  }

  @override
  void dispose() {
    realtime.dispose();
    super.dispose();
  }
}
