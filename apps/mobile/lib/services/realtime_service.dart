import 'dart:async';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../config/app_config.dart';
import '../models/models.dart';
import 'api_client.dart';

class RealtimeService {
  RealtimeService(this.api);
  final ApiClient api;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  bool _closed = false;
  int _attempt = 0;

  Future<void> connect(
      {required void Function(RealtimeEvent event) onEvent,
      required void Function(String message) onError}) async {
    _closed = false;
    await _open(onEvent: onEvent, onError: onError);
  }

  Future<void> _open(
      {required void Function(RealtimeEvent event) onEvent,
      required void Function(String message) onError}) async {
    try {
      final ticket = await api.wsTicket();
      await _subscription?.cancel();
      await _channel?.sink.close();
      _channel = WebSocketChannel.connect(AppConfig.websocketUri(ticket));
      await _channel!.ready;
      _attempt = 0;
      _subscription = _channel!.stream.listen(
        (message) {
          try {
            onEvent(RealtimeEvent.fromJson(message));
          } catch (_) {
            onError(
                'Received an unreadable live update. The app will continue with refresh.');
          }
        },
        onError: (_) => _reconnect(onEvent, onError),
        onDone: () => _reconnect(onEvent, onError),
        cancelOnError: true,
      );
    } catch (_) {
      onError('Live updates are offline. Pull to refresh or retry later.');
      await _reconnect(onEvent, onError);
    }
  }

  Future<void> _reconnect(void Function(RealtimeEvent event) onEvent,
      void Function(String message) onError) async {
    if (_closed || _attempt >= 3) return;
    _attempt += 1;
    await Future<void>.delayed(Duration(seconds: _attempt * 2));
    if (!_closed) await _open(onEvent: onEvent, onError: onError);
  }

  Future<void> disconnect() => dispose();

  Future<void> dispose() async {
    _closed = true;
    await _subscription?.cancel();
    await _channel?.sink.close();
  }
}
