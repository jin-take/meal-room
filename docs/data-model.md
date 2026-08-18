# データ設計

## Room JSON

S3キーは`rooms/{roomId}.json`です。ローカルストレージモードでは`meal-room:{roomId}`をキーに同じ形式を保存します。

```json
{
  "schemaVersion": 1,
  "version": 12,
  "room": {
    "id": "room_550e8400-e29b-41d4-a716-446655440000",
    "name": "わが家",
    "inviteCode": "AB12CD",
    "hostMemberId": "member_550e8400-e29b-41d4-a716-446655440001",
    "createdAt": "2026-08-15T00:00:00.000Z"
  },
  "members": [
    {
      "id": "member_550e8400-e29b-41d4-a716-446655440001",
      "name": "たけひろ",
      "role": "host",
      "deviceId": "device_550e8400-e29b-41d4-a716-446655440002",
      "joinedAt": "2026-08-15T00:00:00.000Z"
    }
  ],
  "recipes": [
    {
      "id": "recipe_550e8400-e29b-41d4-a716-446655440003",
      "name": "鶏の照り焼き",
      "category": "主菜",
      "ingredients": ["鶏もも肉", "しょうゆ", "みりん", "砂糖"],
      "note": "甘辛く焼く",
      "url": "https://example.com/recipes/teriyaki-chicken",
      "createdAt": "2026-08-15T00:00:00.000Z",
      "updatedAt": "2026-08-15T00:00:00.000Z"
    }
  ],
  "mealPlans": [
    {
      "id": "plan_550e8400-e29b-41d4-a716-446655440004",
      "date": "2026-08-15",
      "slot": "dinner",
      "recipeId": "recipe_550e8400-e29b-41d4-a716-446655440003"
    }
  ],
  "shoppingItems": [
    {
      "id": "shop_550e8400-e29b-41d4-a716-446655440005",
      "name": "鶏もも肉",
      "checked": false,
      "source": "auto",
      "rangeKey": "2026-08-15:2026-08-21"
    },
    {
      "id": "shop_550e8400-e29b-41d4-a716-446655440006",
      "name": "牛乳",
      "checked": false,
      "source": "manual"
    }
  ]
}
```

## フィールド

### ルート

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `schemaVersion` | `1` | データ形式のバージョン。現行は固定値1 |
| `version` | `number` | クライアント更新ごとに増加する番号 |
| `room` | `Room` | Room基本情報 |
| `members` | `Member[]` | 参加者 |
| `recipes` | `Recipe[]` | 料理 |
| `mealPlans` | `MealPlan[]` | 日付・食事枠ごとの献立 |
| `shoppingItems` | `ShoppingItem[]` | 買い物項目 |

### Room

- `id`: `room_`とUUIDからなるクライアント生成ID
- `name`: 表示名
- `inviteCode`: 大文字化して照合する6文字の英数字コード
- `hostMemberId`: Room作成者のメンバーID
- `createdAt`: ISO 8601形式の作成日時

### Member

- `id`: `member_`とUUIDからなるID
- `name`: 表示名
- `role`: `host`または`member`
- `deviceId`: ブラウザのローカルストレージで生成・保持する端末識別子
- `joinedAt`: ISO 8601形式の参加日時

`role`と`deviceId`は現状の認可には使用しません。

### Recipe

- `category`: 自由文字列。UIでは主菜、副菜、汁物、主食、デザートから選択する。
- `ingredients`: 数量・単位を持たない食材名の配列
- `note`: 任意のメモ。UI上は空文字を許容する。
- `url`: 任意のレシピ参照URL。空文字、または`http://`／`https://`のURLを保存する。
- `createdAt`、`updatedAt`: ISO 8601形式。編集時は`updatedAt`のみ更新する。

### MealPlan

- `date`: `yyyy-MM-dd`形式の日付
- `slot`: `breakfast`、`lunch`、`dinner`のいずれか
- `recipeId`: `recipes[].id`への参照

クライアントは`date + slot`を一意として扱い、同じ枠を更新する前に既存項目を除去します。データ形式自体に一意制約はありません。

### ShoppingItem

- `checked`: 購入済み状態
- `source`: `auto`または`manual`
- `rangeKey`: 自動集計期間を`開始日:終了日`で保持する任意フィールド。手動項目では省略する。

自動集計時は正規化後の食材名を重複排除します。既存の同名項目があれば`checked`を引き継ぎ、`source: manual`の項目は再集計後も残します。

## Room index

S3キー`rooms/index.json`には、招待コードからRoom IDを検索するための配列を保存します。

```json
[
  {
    "roomId": "room_550e8400-e29b-41d4-a716-446655440000",
    "inviteCode": "AB12CD",
    "name": "わが家",
    "updatedAt": "2026-08-15T00:00:00.000Z"
  }
]
```

Room作成時に同じRoom IDの項目を置き換えます。招待コードの一意性検査、indexとRoom JSONのトランザクション、古い項目の自動削除は実装していません。

## ユーザー設定JSON

S3キーは`users/{deviceId}.json`です。ローカルストレージモードでは`meal-room-user:{deviceId}`をキーに同じ形式を保存します。

```json
{
  "schemaVersion": 1,
  "deviceId": "device_550e8400-e29b-41d4-a716-446655440002",
  "name": "たけひろ",
  "rooms": [
    {
      "roomId": "room_550e8400-e29b-41d4-a716-446655440000",
      "memberId": "member_550e8400-e29b-41d4-a716-446655440001",
      "name": "わが家",
      "role": "host",
      "joinedAt": "2026-08-15T00:00:00.000Z",
      "updatedAt": "2026-08-19T00:00:00.000Z"
    }
  ],
  "createdAt": "2026-08-15T00:00:00.000Z",
  "updatedAt": "2026-08-19T00:00:00.000Z"
}
```

- `deviceId`: ローカルストレージで生成・保持する端末識別子。S3キーにも使用する。
- `name`: 初回登録したユーザーネーム。Room参加時の表示名に使用する。
- `rooms`: その端末から作成または参加したRoomの履歴。
- `rooms[].memberId`: 再入室時に再利用するRoom内のメンバーID。
- `rooms[].name`、`role`、`joinedAt`: Room一覧表示用のスナップショット。
- `rooms[].updatedAt`: 最後にRoomを開いた日時。Room一覧の並び順に使用する。

Room一覧から入室する際は、保存済みmember IDと端末IDが一致するメンバーを優先し、見つからない場合は同じ端末IDのメンバーを検索します。どちらも存在しない場合は新規メンバーを自動追加せず、再度招待コードからの参加を求めます。

## バージョンと整合性

`version`は変更回数の目安として使用します。画面上の変更は端末内に未同期差分として保持し、同期操作時に最新のRoomを取得してID単位で差分を統合してからPUTします。S3直接PUTに条件付き書き込みはないため完全な排他制御ではありませんが、別端末が先に追加した項目を古いRoom全体で消す可能性を抑えます。

`schemaVersion`を変更する際の移行処理は未実装です。形式を変更する場合は既存JSONの変換方針を別途用意してください。
