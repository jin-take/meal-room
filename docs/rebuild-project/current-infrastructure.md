# 現行インフラ棚卸し

調査日: 2026-11-08

## 調査範囲と前提

本書は、公開DNS/TLS/HTTP応答、GitHub ActionsとRepository Variables、ローカルAWS CLIの読み取り結果から、現行MealRoomのインフラを整理したものです。本番リソースへの書き込みは行っていません。

ローカルAWS CLIのIAMユーザーが属するアカウントと、GitHub ActionsがOIDCでデプロイしている本番アカウントは異なります。ローカルアカウントから本番S3バケットは`403 Forbidden`、本番CloudFront Distribution IDは`NoSuchDistribution`になりました。このため、本番アカウント内部のIAM、バケット設定、CloudWatch、請求情報は一部未確認です。

アカウント番号、IAM ARN、利用者データは本書へ記載しません。

## 確認済みの本番構成

| 区分 | 確認結果 | 根拠 |
| --- | --- | --- |
| Web URL | `https://meal-room.link/` | HTTP 200を確認 |
| 配信 | CloudFront経由のS3静的配信 | HTTP応答の`via`、`x-amz-cf-*`、`server: AmazonS3` |
| CloudFront | Distribution ID `E1D8RR5GS98VNY`、ドメイン`dqtgmho40xu09.cloudfront.net` | GitHub Repository Variables |
| S3 | バケット名`meal-room` | GitHub Repository VariablesとActionsログ |
| AWSリージョン | `ap-northeast-1` | GitHub Repository Variable |
| S3暗号化 | 配信オブジェクトはSSE-S3（AES256） | `x-amz-server-side-encryption: AES256` |
| S3バージョニング | 現行オブジェクトにVersion IDあり | `x-amz-version-id`応答ヘッダー |
| Roomデータキャッシュ | `rooms/index.json`は`no-cache` | HTTP応答ヘッダー |
| Room CORS | Origin `*`、GET/HEAD/PUT許可 | OPTIONS応答 |
| CI/CD認証 | GitHub ActionsからOIDCでAWSロールを引受 | デプロイログの`Assuming role with OIDC` |
| Webデプロイ | main更新時にS3同期とCloudFront全体Invalidation | `.github/workflows/deploy-web.yml` |

現在のWorkflowは`assets/`を`--delete`付きで同期し、アイコンと`index.html`を個別アップロードします。Roomデータとユーザーデータはデプロイ対象に含まれません。

## DNSとTLS

### DNS

権威DNSはRoute 53です。

- `ns-121.awsdns-15.com`
- `ns-1003.awsdns-61.net`
- `ns-1068.awsdns-05.org`
- `ns-1637.awsdns-12.co.uk`

2026-11-08時点で`meal-room.link`はCloudFrontのIPへ解決します。再構築で予定している次のホスト名には、公開A/AAAA/CNAMEレコードがまだありません。

- `home.meal-room.link`
- `api.meal-room.link`
- `auth.meal-room.link`
- `stg.meal-room.link`
- `home-stg.meal-room.link`
- `api-stg.meal-room.link`
- `auth-stg.meal-room.link`

### TLS

`meal-room.link`の証明書はAmazon発行で、SANは`meal-room.link`のみです。

- 有効開始: 2026-11-07 11:07:03 UTC
- 有効期限: 2027-05-24 12:07:03 UTC

予定しているサブドメインは現行証明書の対象外です。ステージング構築前に、必要なホスト名を含むACM証明書をCloudFront用の`us-east-1`とAPI用リージョンへ用意します。

## 現在のデプロイ経路

```text
GitHub main
  -> GitHub Actions
  -> GitHub OIDC
  -> 本番AWSデプロイロール
  -> S3 meal-room
  -> CloudFront
  -> meal-room.link
```

GitHub Environmentには`production`が存在します。Repository Variablesにはリージョン、バケット、Distribution ID、CloudFront Base URLがあり、ロールARNはSecretとして保持されています。

## ローカルAWSアカウントで確認した内容

ローカルAWS CLIで使用できるプロファイルは`default`のみです。このアカウントには、MealRoom本番に対応する次のリソースがありませんでした。

- CloudFront Distribution
- Route 53 Hosted Zone
- Lambda Function
- API Gateway HTTP API / REST API
- RDS DB Instance
- 稼働中CloudFormation Stack
- ACM Certificate（`ap-northeast-1`、`us-east-1`）
- IAM OIDC Provider

S3バケットはCloudFormationテンプレート用のバケットだけが列挙されました。したがって、このアカウントのCost Explorer結果をMealRoom本番費用として扱ってはいけません。

## 未確認項目

本番AWSアカウントの読み取り権限がないため、次は未確認です。

- S3の全オブジェクト数、全容量、全バージョン数
- `users/*.json`の件数と容量
- 索引に存在しない孤立Room JSON
- バケットポリシー、Public Access Block、OAC設定の実値
- ライフサイクルルールと古いVersionの保持期間
- CloudFrontの全Behavior、WAF、アクセスログ
- Route 53 Hosted Zone内の非公開・特殊レコード
- 本番Lambda、API Gateway、RDS、CloudFormationの有無
- CloudWatchのリクエスト数、エラー率、転送量
- 本番アカウントの月額費用、Budget、Cost Anomaly Detection
- GitHub OIDCロールの最小権限性

## リスクと対応優先度

| 優先度 | リスク | 対応 |
| --- | --- | --- |
| 必須 | 本番AWSアカウントへ読み取りアクセスできず、完全な棚卸しとバックアップ検証ができない | 本番アカウントに監査用ReadOnlyロールを用意し、ローカルからAssumeRoleできるようにする |
| 必須 | CloudFront経由で認証なしのPUTがCORS上許可されている | 新API安定までは現行経路を維持しつつ、移行完了後に書き込みをAPIへ限定する |
| 高 | 現行証明書がルートドメインのみ | サブドメイン追加前にACM証明書とDNS検証をIaC化する |
| 高 | 本番費用とトラフィックの基準値がない | 本番アカウントのCost ExplorerとCloudWatchから3か月分を取得する |
| 中 | Web本番デプロイがmainから直接実行される | ステージング自動配布と本番承認を分離する |

## 棚卸し完了に必要な追加コマンド

本番監査ロールを取得した後、少なくとも次を読み取り専用で実行します。

```bash
aws s3api list-object-versions --bucket meal-room
aws s3api get-bucket-versioning --bucket meal-room
aws s3api get-public-access-block --bucket meal-room
aws s3api get-bucket-encryption --bucket meal-room
aws s3api get-bucket-policy-status --bucket meal-room
aws cloudfront get-distribution-config --id E1D8RR5GS98VNY
aws route53 list-hosted-zones
aws lambda list-functions --region ap-northeast-1
aws apigatewayv2 get-apis --region ap-northeast-1
aws rds describe-db-instances --region ap-northeast-1
aws ce get-cost-and-usage --granularity MONTHLY ...
```

## 復元確認の手順案

現時点では本番S3の全オブジェクトを取得できないため、バックアップ取得と復元試験は未完了です。本番監査ロール取得後に次の順で実施します。

1. オブジェクトとVersion IDの一覧をマニフェスト化する。
2. 現行バケットを変更せず、別の非公開スナップショット先へコピーする。
3. 件数、合計サイズ、ETagまたはチェックサムを照合する。
4. 別の検証用バケットへ復元する。
5. `rooms/index.json`と全Room JSONを検証する。
6. CloudFrontを経由しない状態で復元データを照合する。
7. 実行日時、マニフェスト、復元結果を記録する。

本番バケットの削除、上書き、Version削除は棚卸し・復元試験では行いません。
