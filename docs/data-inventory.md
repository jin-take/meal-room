# 現行データ棚卸し

調査日: 2026-11-08

## 調査方法

現行CloudFrontの公開GET経路から`rooms/index.json`を取得し、索引に記録されたRoom JSONを読み取り専用で検証しました。利用者名、招待コード、献立、レシピ本文、Room IDなどの実データは記録していません。

本番S3のList権限がないため、本書の数値は索引から到達可能なRoomに限定されます。`users/*.json`と、索引にない孤立オブジェクトは含みません。

## 集計結果

| 項目 | 結果 |
| --- | ---: |
| `rooms/index.json`サイズ | 1,366 bytes |
| 索引のRoom数 | 10 |
| HTTP 200で取得できたRoom | 8 |
| HTTP 403で取得できなかったRoom | 2 |
| 取得できたRoom JSON合計サイズ | 32,244 bytes |
| Room JSON最小サイズ | 999 bytes |
| Room JSON最大サイズ | 21,529 bytes |
| schemaVersion | すべて`1` |
| version最小値 | 1 |
| version最大値 | 115 |
| メンバー合計 | 16 |
| レシピ合計 | 51 |
| 献立合計 | 57 |
| 買い物項目合計 | 21 |

索引上の`updatedAt`は、最古が2026-08-15、最新が2026-10-20でした。これは利用頻度ではなく、索引に記録された更新日時の範囲です。

## 整合性検査

| 検査 | 結果 |
| --- | ---: |
| 索引内のRoom ID重複 | 0 |
| 索引内の招待コード重複 | 0 |
| 招待コード形式不正 | 0 |
| Room ID形式不正 | 1 |
| `hostMemberId`に対応するメンバーが存在しないRoom | 1 |
| メンバーID重複 | 0 |
| レシピID重複 | 0 |
| 献立ID重複 | 0 |
| 買い物項目ID重複 | 0 |
| 存在しないレシピを参照する献立 | 0 |
| 同日・同食事枠の重複 | 0 |
| 不正なメンバーrole | 0 |
| 不正なレシピURL形式 | 0 |

取得できた8件はいずれも、`role: host`のメンバーをちょうど1件持っています。ただし1件は`room.hostMemberId`がそのホストを参照していません。移行時に自動修正せず、候補と根拠を出力して確認対象にします。

## 検出した移行上の問題

### 索引から取得できないRoomが2件ある

索引には存在しますがRoom JSONのGETがHTTP 403になりました。考えられる原因は、実体削除、キーの不一致、CloudFront/S3ポリシー、またはオブジェクト状態です。本番S3のVersion一覧で確認するまで、索引から削除してはいけません。

### Room ID形式が1件だけ異なる

新しい設計が想定する`room_`とUUIDの形式に一致しない索引エントリが1件あります。移行ツールは現行IDを入力として受け入れ、新しいUUIDとの対応表を保持する必要があります。

### host参照が1件不整合

`hostMemberId`に対応するメンバーが存在しないRoomが1件あります。移行ツールでは次のいずれかを明示的に選び、監査ログへ残します。

1. 唯一の`role: host`をhostとして採用する。
2. 利用者または管理者の確認待ちにする。
3. 移行対象から一時除外する。

既定動作として暗黙に先頭メンバーへ付け替えてはいけません。

## 未確認データ

- `users/*.json`の件数、サイズ、重複device ID
- 索引にないRoom JSON
- 削除済みオブジェクトと過去Version
- S3全体のオブジェクト数と容量
- JSONとして壊れている未索引オブジェクト
- 各Roomの実利用者が現在も利用中か
- CloudWatch上のアクセス頻度

## 移行ツールに必要な検査

移行ツールはRoomごとに次を出力します。

```text
source_key
source_version_id
source_etag
source_schema_version
source_room_id
target_room_id
member_count
recipe_count
meal_plan_count
shopping_item_count
validation_status
migration_status
error_codes
```

エラーコードには少なくとも次を用意します。

- `ROOM_OBJECT_MISSING`
- `INVALID_ROOM_ID_FORMAT`
- `HOST_MEMBER_NOT_FOUND`
- `DUPLICATE_ENTITY_ID`
- `DANGLING_RECIPE_REFERENCE`
- `UNSUPPORTED_SCHEMA_VERSION`
- `INVALID_JSON`

## スナップショットと復元

公開GETで取得したデータは監査用の一時コピーであり、正式なバックアップではありません。正式なスナップショットは本番AWSロールでVersion IDを含めて取得し、非公開の保存先で暗号化して保持します。

正式な移行リハーサルは、現行バケットではなくスナップショットのコピーに対して行います。Room ID、招待コード、利用者情報を含むため、リポジトリへJSON原本をコミットしてはいけません。
