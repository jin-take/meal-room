import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

const Color kBackground = Color(0xFFF8FBF4);
const Color kPrimary = Color(0xFF7CB342);
const Color kText = Color(0xFF1F2B2A);
const Color kWarning = Color(0xFFFFF2D4);
const Color kWarningText = Color(0xFF8A5C00);
const String kDefaultWebAppUrl =
    'https://dqtgmho40xu09.cloudfront.net/index.html';

String resolveWebAppUrl() {
  const envUrl = String.fromEnvironment('WEB_APP_URL');
  if (envUrl.isNotEmpty) {
    return envUrl;
  }

  return kDefaultWebAppUrl;
}

void main() => runApp(const MealRoomApp());

class MealRoomApp extends StatelessWidget {
  const MealRoomApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: kBackground,
      colorScheme: ColorScheme.fromSeed(
        seedColor: kPrimary,
        brightness: Brightness.light,
        primary: kPrimary,
        secondary: const Color(0xFF4E7D18),
        surface: Colors.white,
      ),
      textTheme: ThemeData.light().textTheme.apply(
            bodyColor: kText,
            displayColor: kText,
            fontFamily: 'SF Pro Display',
          ),
      appBarTheme:
          const AppBarTheme(backgroundColor: Colors.transparent, elevation: 0),
    );

    return MaterialApp(
      title: 'MealRoom',
      debugShowCheckedModeBanner: false,
      theme: theme,
      home: const WebAppScreen(),
    );
  }
}

class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  late final WebViewController controller;
  bool loading = true;
  bool offline = false;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kBackground)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => loading = true),
          onPageFinished: (_) => setState(() => loading = false),
          onWebResourceError: (_) => setState(() => offline = true),
        ),
      )
      ..loadRequest(Uri.parse(resolveWebAppUrl()));

    Connectivity().onConnectivityChanged.listen((results) {
      if (!mounted) return;
      final offlineNow = results.contains(ConnectivityResult.none);
      setState(() => offline = offlineNow);
      if (!offlineNow) controller.reload();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: WebViewWidget(controller: controller)),
            if (loading)
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  minHeight: 3,
                  backgroundColor: Color(0xFFEAF3DF),
                  valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
                ),
              ),
            if (offline)
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: ColoredBox(
                  color: kWarning,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Text(
                      'オフラインです。接続後に再読み込みします。',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: kWarningText,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
