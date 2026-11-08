# MealRoom Flutter Shell

React製MealRoom Webアプリを`webview_flutter`で表示するiOS／Android用シェルです。料理、献立、買い物、Room共有の処理はWeb側にあり、Flutter側はWebView、接続状態表示、アプリアイコンを担当します。

## 現在の設定

- アプリバージョン: `0.1.0+1`
- 既定URL: `https://dqtgmho40xu09.cloudfront.net/index.html`
- iOS Bundle ID: `com.example.mealRoomShell`
- Android Application ID: `com.example.meal_room_shell`
- iOS Deployment Target: 13.0
- テーマ色: `#7CB342`
- 表示言語: Webアプリとエラーメッセージは日本語

`WEB_APP_URL`を`--dart-define`で渡すと、既定URLを上書きできます。

`USE_BUNDLED_WEB=true`を渡すと、`assets/web/`へ事前生成したWeb UIをHTMLへインライン化して読み込みます。iOSのローカルWebViewでも確実に表示でき、S3のRoomデータ接続先はWebビルド時の`VITE_CLOUDFRONT_BASE_URL`を使用します。

## セットアップ

```bash
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8

cd flutter_shell
flutter pub get
```

使用可能な端末を確認します。

```bash
flutter devices
```

## 本番CloudFront版を起動

既定URLを使用する場合は次だけで起動できます。

```bash
flutter run
```

接続先を明示する場合は次のように実行します。

```bash
flutter run \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

WebViewはCloudFront上のWebファイルを表示するため、`web/`の変更だけではアプリ画面へ反映されません。先にWebをS3へアップロードし、CloudFrontの無効化が完了していることを確認してください。

## ローカルWebへ接続

先にリポジトリルートの`web/`でViteを起動します。

```bash
cd ../web
npm run dev -- --host 0.0.0.0
```

Android EmulatorからMacへ接続する場合は`10.0.2.2`を使用します。

```bash
cd ../flutter_shell
flutter run \
  --dart-define=WEB_APP_URL=http://10.0.2.2:5173
```

Viteが別ポートを選んだ場合は、そのポートへ読み替えてください。Androidアプリは現在、開発用HTTP接続を許可しています。

## iPhone実機へインストール

1. iPhoneをUSBまたは開発用Wi-FiでMacへ接続する。
2. iPhoneをロック解除し、Developer Modeを有効にする。
3. Xcodeの`Settings… > Accounts`へApple IDを追加する。
4. `ios/Runner.xcworkspace`を開き、RunnerのSigningでTeamを確認する。
5. `flutter devices`で実機のデバイスIDを確認する。

```bash
open ios/Runner.xcworkspace

flutter run -d <iPhoneのデバイスID> --release \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

`No Accounts`またはProvisioning Profile不足が表示された場合は、XcodeのApple IDとTeam選択を確認します。個人チームの署名は有効期限が短く、期限後に再ビルド・再インストールが必要になる場合があります。

## ビルド

最新Web UIをアプリへ同梱する場合は、リポジトリルートから先に次を実行します。

```bash
./flutter_shell/tool/bundle_web.sh
```

その後、`USE_BUNDLED_WEB=true`を指定してビルドします。

```bash
cd flutter_shell
flutter build ios --release --dart-define=USE_BUNDLED_WEB=true
```

iOS Simulator向け:

```bash
flutter build ios --simulator
```

iOS実機向けRelease:

```bash
flutter build ios --release \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

Android APK:

```bash
flutter build apk --release \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

## 検証

```bash
flutter analyze
flutter test
```

## 接続状態

`connectivity_plus`で通信断を検知すると、画面上部に「オフラインです。接続後に再読み込みします。」と表示します。通信が復帰するとWebViewを再読み込みします。

接続種別が利用可能でも、CloudFrontやS3へ到達できることまでは保証しません。WebViewの読み込みエラー時にもオフライン表示を出します。

## アイコンと起動画面

- 元画像: `../asset/icon-meal-room-transparent.png`
- Flutterアセット: `assets/icon-meal-room-transparent.png`
- ランチャーアイコン生成: `flutter_launcher_icons`
- iOS起動画面: `ios/Runner/Assets.xcassets/LaunchImage.imageset/`

アイコンを変更した場合は次を実行し、iOSとAndroidの生成画像を更新します。

```bash
dart run flutter_launcher_icons
```
