# 画像アセット管理方針

## 目的

同一の元画像がリポジトリ内に無制限に複製されることを防ぎ、Web・Flutter・各OSの生成物を区別して管理します。

## 管理場所

- `web/public/icon-meal-room-transparent.png`
  - Reactアプリが実行時に参照するWeb用画像です。
- `flutter_shell/assets/icon-meal-room-transparent.png`
  - Flutter本体と`flutter_launcher_icons`が参照する元画像です。
- `flutter_shell/assets/web/`
  - Flutterへ同梱するReactビルド成果物です。`flutter_shell/tool/bundle_web.sh`で再生成します。
- `flutter_shell/android/**/ic_launcher*`、`flutter_shell/ios/Runner/Assets.xcassets/AppIcon.appiconset/`
  - Flutterのアイコン生成処理によって作られる各OS向け成果物です。

## 運用ルール

1. ルート直下へ画像保管専用の重複ディレクトリを作らない。
2. Web用とFlutter用の元画像は、それぞれのビルド境界内に置く。
3. `flutter_shell/assets/web/`の内容は直接編集せず、Webをビルドして再生成する。
4. アプリ用アイコンを変更する場合は2つの元画像を更新した後、Flutterのランチャーアイコンを再生成する。
5. `.DS_Store`など実行に不要なOS生成ファイルはコミットしない。

## 確認コマンド

```bash
cd web
npm ci
npm run build

cd ../flutter_shell
flutter pub get
flutter analyze
flutter test
```
