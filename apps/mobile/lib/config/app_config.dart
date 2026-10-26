class AppConfig {
  AppConfig._();

  static String _apiBaseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://sdtt-attendance-system.onrender.com/api',
  );

  static String get apiBaseUrl => _apiBaseUrl;
  static set apiBaseUrl(String url) {
    _apiBaseUrl = url.trim();
  }

  static Uri get apiUri => Uri.parse(_apiBaseUrl);

  static Uri websocketUri(String ticket) {
    final uri = apiUri;
    final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
    final basePath = uri.path.endsWith('/')
        ? uri.path.substring(0, uri.path.length - 1)
        : uri.path;
    return uri.replace(
      scheme: scheme,
      path: '$basePath/ws',
      queryParameters: {'ticket': ticket},
    );
  }
}
