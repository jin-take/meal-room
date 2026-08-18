# MealRoom

<p align="center">
  <img src="asset/icon-meal-room-transparent.png" alt="MealRoom アイコン" width="128">
</p>

<p align="center">
  <strong>MealRoom</strong><br>
  献立から買い物まで、ふたり・家族でひとつに。
</p>

家族・カップルで料理、献立、買い物リストを共有するスマートフォン向けMVPです。React製WebアプリをS3とCloudFrontで配信し、FlutterアプリはそのWebアプリをWebViewで表示します。

現行の本番URLは `https://dqtgmho40xu09.cloudfront.net/index.html` です。

## サービス概要

MealRoomは、家族やカップルが同じRoomで毎日の食事を決め、必要な食材を買い物リストへつなげる共有アプリです。「今日何を作るか」「何を買うか」を別々のメモに分散させず、料理・献立・買い物をひとつの流れで扱います。

### 解決すること

- 料理の候補、レシピURL、メモを家族のRoomにまとめる
- 朝・昼・夜の献立を週単位で見渡し、予定を共有する
- 献立から必要な食材を重複なしで集計し、買い物リストを作る
- 外出先ではスマートフォンから確認し、変更は同期ボタンで共有する

### 体験コンセプト

MealRoomの中心にあるのは「同じRoomを見て、一緒に決める」体験です。データの取得（GET）はリアルタイムに近い間隔で行い、編集中の変更（PUT）はユーザーが同期ボタンを押したタイミングで追加します。これにより、S3上のデータを読みながら入力途中の内容が勝手に消えることを避け、共有する瞬間をユーザー自身が選べます。

## UIコンセプト

UIは `#7CB342` を中心に、Untitled UIのような余白・タイポグラフィ・状態表示を重視した、静かで実用的なスマートフォン優先設計です。カードの輪郭線を極力使わず、背景色・余白・面のコントラストで情報のまとまりを表現します。

| 要素 | デザイン方針 | 画面での役割 |
| --- | --- | --- |
| ブランドカラー | `#7CB342`（リーフグリーン） | 同期、追加、選択中などの主要アクション |
| サーフェス | 白い面と淡い `#F8FBF4` の背景 | 枠線に頼らず、情報の階層をつくる |
| 角・余白 | 大きめの角丸と一定の間隔 | 料理・献立・買い物をひとつのリズムで見せる |
| 状態表示 | 「同期済み」「未同期の変更あり」「同期中」 | S3共有の状態を常に把握できるようにする |
| タイポグラフィ | 大きな見出しと短いラベル | 片手操作でも重要な情報を先に読めるようにする |

### 画面の構成

```text
┌────────────────────────────────────┐
│  [MealRoom]  わが家のRoom       [同期] │
├────────────────────────────────────┤
│  HOME                              │
│  今週の献立      月  火  水  木  金     │
│  カレー          ●   ─   ●   ─   ─     │
│                                      │
│  RECIPES                            │
│  料理を追加   レシピURL   メモ          │
│                                      │
│  SHOPPING                           │
│  □ 玉ねぎ       献立から              │
│  □ 牛乳         手動追加              │
└────────────────────────────────────┘
```

- **Home**: Roomの状態と今週の献立を最初に確認するダッシュボード
- **Recipes**: 料理名・カテゴリ・食材・メモ・レシピURLを一緒に管理。URLはアプリ内に閉じず、外部ブラウザで開く
- **Meal plan**: 朝・昼・夜を日付ごとに編集し、週の流れを見渡す
- **Shopping**: 献立からの自動集計と手動追加を同じリストで扱う

### アイコン

MealRoomのアイコンは、リーフグリーンの葉と小さな丸いモチーフで「食材」「成長」「一緒に育てる食卓」を表現しています。透明背景版をWeb、iOS、Androidで共通利用し、アプリ内ではブランドカラーと同じグリーンで統一しています。

- 原画像: [`asset/icon-meal-room-transparent.png`](asset/icon-meal-room-transparent.png)
- Web公開用: [`web/public/icon-meal-room-transparent.png`](web/public/icon-meal-room-transparent.png)
- Flutterアプリ用: [`flutter_shell/assets/icon-meal-room-transparent.png`](flutter_shell/assets/icon-meal-room-transparent.png)

## 現在の構成

```text
Flutterアプリ / Webブラウザ
          ↓ HTTPS
       CloudFront
          ↓ OAC署名
   非公開S3バケット
   ├── index.html・assets/*
   └── rooms/*.json
```

- `web/`: React、TypeScript、Viteによる画面と業務ロジック
- `flutter_shell/`: Webアプリを表示するiOS／Android用Flutter WebViewシェル
- `lambda/template.yaml`: S3、CloudFront、OACなどを作成するSAMテンプレート
- `lambda/src/`: 現在Webから使用していない旧Lambda API実装
- `docs/`: 現行要件、データアクセス仕様、データモデル
- `__data__/`: デモ用Room JSON
- `asset/`: 元画像

WebアプリはAPI GatewayやLambdaを経由せず、CloudFront経由でS3のRoom JSONを直接`GET`／`PUT`します。SAMテンプレートにはLambdaとHTTP APIも残っていますが、現行クライアントの通信経路では使用していません。

## 実装済み機能

- Roomの作成と、6文字の招待コードによる参加
- 端末ごとのユーザーネーム登録、参加Room一覧、既存メンバーとしての再入室
- ホスト／メンバー表示
- 料理の追加、編集、削除
- 週単位の献立編集（朝・昼・夜）
- カレンダーで開始日と終了日を範囲選択
- 最大31日分の献立から食材を重複なしで自動集計
- 買い物項目の手動追加、削除、購入済み切り替え
- 3秒ごとの自動取得と、未同期差分を最新データへ統合する手動同期
- レシピ参照URLの登録とリンク表示
- CloudFront＋S3保存と、設定がない場合のローカルストレージ保存
- 日本語UI、テーマ色`#7CB342`、スマートフォン優先レイアウト

詳細は[要件定義](docs/requirements.md)、[データアクセス仕様](docs/api.md)、[データ設計](docs/data-model.md)を参照してください。

## 開発環境

- Node.js 20.19以上、または22.12以上
- npm
- Flutter SDK（この環境では3.44.8で確認）
- iOS実機ビルド時はXcodeとApple IDの署名設定
- AWS更新時はAWS CLI、AWS SAM CLI、対象リソースへの権限

日本語ロケールでコマンドを実行する場合は、必要に応じて次を設定します。

```bash
export LANG=ja_JP.UTF-8
export LC_ALL=ja_JP.UTF-8
```

## Webをローカルで起動

```bash
cd web
npm ci
npm run dev
```

`VITE_CLOUDFRONT_BASE_URL`が未設定または空の場合は、Roomをブラウザのローカルストレージへ保存します。CloudFront上の共有データを使用する場合は、`web/.env`へ次を設定してから起動またはビルドします。

```dotenv
VITE_CLOUDFRONT_BASE_URL=https://dqtgmho40xu09.cloudfront.net
```

環境変数はViteのビルド時に組み込まれます。変更後はWebを再ビルドしてください。

## 検証

Webの型チェックと本番ビルドは次で実行します。

```bash
cd web
npm run build
```

Flutterは次で静的解析とテストを実行します。

```bash
cd flutter_shell
flutter pub get
flutter analyze
flutter test
```

## AWSインフラをSAMでデプロイ

現時点ではSAMテンプレートが`lambda/`にあるため、このディレクトリから実行します。テンプレートはS3、CloudFront、OAC、キャッシュ／CORSポリシーに加え、未使用のLambdaとHTTP APIも作成します。

```bash
cd lambda
npm ci
npm run build
sam build
sam deploy --guided
```

初回以降は生成された`samconfig.toml`を確認してから、通常の`sam deploy`を使用できます。主なCloudFormation出力は次のとおりです。

- `RoomBucketName`: WebファイルとRoom JSONを保存するS3バケット
- `CloudFrontDistributionId`: キャッシュ無効化に使うDistribution ID
- `CloudFrontUrl`: WebアプリとRoom JSONの公開URL
- `ApiUrl`: 旧Lambda APIのURL。現行Webでは未使用

Lambdaを完全に廃止する場合は、先にSAMテンプレートから`MealRoomApi`、`ApiFunction`、`ApiUrl`を削除し、S3／CloudFront用テンプレートを`infra/`などへ移す想定です。

## WebをS3・CloudFrontへ反映

現在使用している値は次のとおりです。

```bash
ROOM_BUCKET_NAME=meal-room
CLOUDFRONT_DISTRIBUTION_ID=E1D8RR5GS98VNY
CLOUDFRONT_DOMAIN=dqtgmho40xu09.cloudfront.net
```

Webをビルドし、同じAWSアカウント／プロファイルでアップロードします。

```bash
cd web
VITE_CLOUDFRONT_BASE_URL="https://${CLOUDFRONT_DOMAIN}" npm run build

aws s3 sync dist/ "s3://${ROOM_BUCKET_NAME}/" \
  --region ap-northeast-1 \
  --profile default

aws cloudfront create-invalidation \
  --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
  --paths '/*' \
  --profile default
```

AWSコンソール日本語表示では、CloudFrontの`Invalidations`は「無効化」です。Distributionの「最終変更日」だけでなく、作成した無効化のステータスが`完了`になるまで待ってから確認します。

`aws s3 sync`の`ListObjectsV2`で`AccessDenied`になる場合、実行中のIAM PrincipalにバケットARNへの`s3:ListBucket`が必要です。アップロードには、さらに`arn:aws:s3:::meal-room/*`への`s3:PutObject`が必要です。CloudFrontのOAC用バケットポリシーはAWS CLI利用者の権限を代替しません。

## Flutterアプリを起動

Flutterシェルは、指定がなければ現行CloudFront URLの`/index.html`を開きます。

```bash
cd flutter_shell
flutter pub get
flutter run
```

接続先を上書きする場合は`WEB_APP_URL`を渡します。

```bash
flutter run \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

Android EmulatorからローカルViteへ接続する例です。

```bash
flutter run \
  --dart-define=WEB_APP_URL=http://10.0.2.2:5173
```

iPhone実機では、Xcodeの`Settings… > Accounts`へApple IDを追加し、端末のロック解除とDeveloper Modeを確認してから実行します。

```bash
flutter devices
flutter run -d <iPhoneのデバイスID> --release \
  --dart-define=WEB_APP_URL=https://dqtgmho40xu09.cloudfront.net/index.html
```

詳細は[Flutter Shell README](flutter_shell/README.md)を参照してください。

## 現在の制約とセキュリティ

- `host`と`member`は表示用の属性で、操作権限を強制していません。
- 端末IDとメンバーIDは認証情報ではありません。
- 変更は同期ボタンを押すまで端末内に保持し、同期直前に最新Roomへ差分統合します。ただしS3直接PUTに競合検査はなく、完全に同時の更新は後勝ちです。
- `rooms/index.json`には招待コードとRoom IDの対応が含まれます。
- CloudFront URLを知るクライアントは、現在のバケットポリシーで許可された`rooms/*`を更新できます。
- 一般公開する場合は、Cognitoなどの認証と、認可・競合制御を行うAPI層への移行が必要です。
