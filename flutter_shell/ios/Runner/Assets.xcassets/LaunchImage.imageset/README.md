# iOS起動画面画像

このディレクトリの`LaunchImage.png`、`LaunchImage@2x.png`、`LaunchImage@3x.png`は、iOSでWebViewが表示されるまでの起動画面に使用します。

`Runner/Base.lproj/LaunchScreen.storyboard`が白背景の中央へ`LaunchImage`を配置します。アプリアイコンは別の`Runner/Assets.xcassets/AppIcon.appiconset/`にあります。

画像を変更するときは3倍率を同じデザインで更新し、`Contents.json`のファイル名との対応を維持してください。Xcodeで確認する場合は次を実行します。

```bash
open ios/Runner.xcworkspace
```

XcodeのProject Navigatorで`Runner > Assets.xcassets > LaunchImage`を選択して確認できます。
