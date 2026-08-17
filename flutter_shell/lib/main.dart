import 'package:flutter/services.dart';
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
const bool kUseBundledWeb = bool.fromEnvironment('USE_BUNDLED_WEB');
const String kBundledWebAsset = 'assets/web/index.html';
const String kBundledCssAsset = 'assets/web/assets/index.css';
const String kBundledJsAsset = 'assets/web/assets/index.js';

String resolveWebAppUrl() {
  const envUrl = String.fromEnvironment('WEB_APP_URL');
  if (envUrl.isNotEmpty) {
    return envUrl;
  }

  return kDefaultWebAppUrl;
}

void main() => runApp(const MealRoomApp());

Future<void> loadWebApp(WebViewController controller) async {
  if (kUseBundledWeb) {
    try {
      final html = await rootBundle.loadString(kBundledWebAsset);
      final css = await rootBundle.loadString(kBundledCssAsset);
      final js = await rootBundle.loadString(kBundledJsAsset);
      final inlinedHtml = html
          .replaceFirst(
            RegExp(r'<link[^>]+href="[^"]+\.css"[^>]*>'),
            '<style>$css</style>',
          )
          .replaceFirst(
            RegExp(r'<script[^>]+src="[^"]+"[^>]*></script>'),
            '',
          )
          .replaceFirst('</body>', '<script>$js</script></body>');

      // Inline the Vite output so WKWebView never has to execute a local
      // file:// module or resolve a second local asset request.
      await controller.loadHtmlString(
        inlinedHtml,
        baseUrl: resolveWebAppUrl(),
      );
    } catch (error, stackTrace) {
      debugPrint('[MealRoom WebView] bundled load failed: $error');
      debugPrint('$stackTrace');
      await controller.loadRequest(Uri.parse(resolveWebAppUrl()));
    }
    return;
  }
  await controller.loadRequest(Uri.parse(resolveWebAppUrl()));
}

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
      ..setOnConsoleMessage((message) {
        debugPrint('[MealRoom WebView] ${message.level}: ${message.message}');
      })
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => loading = true),
          onPageFinished: (_) {
            setState(() => loading = false);
            Future<void>.delayed(const Duration(seconds: 1), () {
              if (!mounted) return;
              controller.runJavaScriptReturningResult(
                '''(() => {
                      const root = document.getElementById('root');
                      const rect = root?.getBoundingClientRect();
                      return JSON.stringify({
                        htmlLength: document.documentElement.outerHTML.length,
                        rootChildren: root?.children.length ?? 0,
                        rootTextLength: root?.innerText.length ?? 0,
                        rootWidth: rect?.width ?? 0,
                        rootHeight: rect?.height ?? 0,
                      });
                    })()''',
              ).then((result) => debugPrint(
                    '[MealRoom WebView] page rendered: $result',
                  ));
            });
          },
          onWebResourceError: (error) {
            debugPrint(
              '[MealRoom WebView] resource error ${error.errorCode}: '
              '${error.description} (${error.url ?? 'unknown'})',
            );
            setState(() => offline = true);
          },
        ),
      );
    loadWebApp(controller);

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
