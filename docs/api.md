# CloudFront・S3データアクセス仕様

## 概要

現行WebアプリはAPI GatewayやLambdaを呼び出しません。`VITE_CLOUDFRONT_BASE_URL`をベースURLとして、CloudFrontのS3オリジンへRoom JSONとユーザー設定JSONを直接`GET`／`PUT`します。

現行環境のベースURLは次のとおりです。

```text
https://dqtgmho40xu09.cloudfront.net
```

通信本文はJSONです。認証ヘッダー、Cookie、メンバーIDヘッダーは送信しません。

## オブジェクト

| メソッド | パス | 用途 |
| --- | --- | --- |
| `GET` | `/rooms/index.json` | 招待コードとRoom IDの対応一覧を取得 |
| `PUT` | `/rooms/index.json` | 対応一覧を全量保存 |
| `GET` | `/rooms/{roomId}.json` | Roomデータを取得 |
| `PUT` | `/rooms/{roomId}.json` | Roomデータを全量保存 |
| `GET` | `/users/{deviceId}.json` | 端末のユーザー設定とRoom履歴を取得 |
| `PUT` | `/users/{deviceId}.json` | 端末のユーザー設定とRoom履歴を全量保存 |

各JSONの形式は[データ設計](data-model.md)を参照してください。

## ユーザー登録とRoom一覧

1. ローカルストレージから端末IDを取得し、存在しなければ生成する。
2. `GET /users/{deviceId}.json`でユーザー設定を取得する。
3. 設定がなければ、入力されたユーザーネームと端末IDを`PUT /users/{deviceId}.json`で保存する。
4. `rooms`を更新日時の降順で一覧表示する。
5. Roomを選ぶと`GET /rooms/{roomId}.json`でRoomを取得し、保存済みmember IDまたは同じ端末IDのメンバーでセッションを再開する。

非公開S3は存在しないキーを403で返す場合があるため、ユーザー設定の初回取得に限り403と404を未登録として扱います。

## Room作成

1. クライアントでRoom ID、メンバーID、端末ID、招待コードを生成する。
2. 初期料理を含むRoom JSONを組み立てる。
3. `PUT /rooms/{roomId}.json`でRoom JSONを保存する。
4. `GET /rooms/index.json`で現在の一覧を取得する。
5. 同じRoom IDの古い項目を除き、新しい対応を追加する。
6. `PUT /rooms/index.json`で一覧を全量保存する。
7. Room IDとメンバーIDをユーザー設定のRoom履歴へ保存する。
8. Room IDとメンバーIDをローカルセッションへ保存する。

Room JSONの保存に成功し、indexの更新だけ失敗した場合はRoomオブジェクトだけが残る可能性があります。トランザクションやロールバックはありません。

## 招待コードで参加

1. `GET /rooms/index.json`で一覧を取得する。
2. 入力された招待コードを大文字化し、一致するRoom IDを検索する。
3. `GET /rooms/{roomId}.json`でRoomを取得する。
4. Room内に同じ端末IDのメンバーがいれば、そのmember IDを再利用する。
5. 同じ端末IDのメンバーがいない場合だけ新しいメンバーを追加し、`version`を増加させる。
6. メンバーを追加した場合だけ`PUT /rooms/{roomId}.json`でRoom全体を保存する。
7. Room IDとmember IDをユーザー設定のRoom履歴へ保存する。

indexの取得に失敗した場合、クライアントは空の一覧として扱うため、「招待コードに一致するRoomがありません」と表示されます。

## Room取得と更新

Room取得時にHTTPエラーが発生すると、クライアントは詳細を隠して「Roomが見つかりません」と表示します。

Roomは3秒ごと、および画面がフォーカスされた際にGETします。料理、献立、買い物の操作ではPUTせず、端末内に未同期差分を保持します。同期ボタンを押すと、もう一度最新RoomをGETし、取得後に他端末で追加・編集された項目と端末内の差分をID単位で統合してから、`version`へ1を加えてPUTします。献立はIDではなく`date + slot`を統合キーとして扱います。

通常のRoom更新では内容が変わらない`rooms/index.json`をPUTしません。indexはRoom作成時だけ更新します。

S3側で旧`version`との比較は行わないため、これは完全な楽観ロックではありません。同期直前の差分統合によって古い状態からの項目消失を抑えますが、複数端末が同時にPUTした場合は後から完了したRoom JSONが残ります。

## ローカルストレージモード

`VITE_CLOUDFRONT_BASE_URL`と旧互換変数`VITE_S3_BASE_URL`がどちらも未設定の場合、ネットワーク通信を行いません。

- Roomデータ: `meal-room:{roomId}`
- 現在のセッション: `meal-room-session`
- 端末ID: `meal-room-device-id`
- ユーザー設定: `meal-room-user:{deviceId}`

ローカルストレージのRoomは同じブラウザ内でのみ参照でき、別端末との共有はできません。

## CloudFront・S3設定

- S3バケットはPublic Access Blockを有効にする。
- CloudFrontはOrigin Access ControlでS3リクエストへSigV4署名する。
- デフォルトビヘイビアは静的ファイルの`GET`／`HEAD`／`OPTIONS`を扱う。
- `rooms/*`と`users/*`ビヘイビアは`GET`／`PUT`をオリジンへ転送し、TTLを0にする。
- バケットポリシーは対象Distributionからの`GetObject`と、`rooms/*`・`users/*`への`PutObject`を許可する。
- CORSレスポンスでは`GET`、`HEAD`、`OPTIONS`、`PUT`を許可する。

## 未使用のLambda API

`lambda/src/handler.ts`には次の旧HTTP API実装が残っています。

- `POST /rooms`
- `POST /rooms/join`
- `GET /rooms/{roomId}`
- `PUT /rooms/{roomId}`

SAMテンプレートはこのLambdaとHTTP APIを作成しますが、`web/src/api.ts`は`ApiUrl`を参照していません。現行クライアント仕様にこのエンドポイントを混在させないでください。Lambdaを再採用する場合は、レスポンス形式、認証、競合制御を改めて統一する必要があります。

## セキュリティ上の注意

現行方式の端末ID、メンバーID、ユーザー設定は認証ではありません。CloudFront URLとオブジェクトパスへアクセスできれば、許可範囲内のRoom JSONやユーザー設定JSONを読み書きできます。一般公開する場合は、認証付きAPIへデータ更新を集約し、Room単位の認可とサーバー側検証を実装してください。
