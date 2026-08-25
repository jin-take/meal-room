# React WebのS3・CloudFrontデプロイ

## 概要

`main`へReact Webの変更がマージされると、GitHub Actionsが`web/dist`をS3へ同期し、CloudFrontのキャッシュを無効化します。手動実行にも対応します。

## GitHub設定

### Secret

| 名前 | 内容 |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | GitHub ActionsがOIDCで引き受けるIAM Role ARN |

### Variables

| 名前 | 内容 |
| --- | --- |
| `AWS_REGION` | S3バケットを利用するAWSリージョン |
| `WEB_S3_BUCKET` | Reactのビルド成果物を配置するS3バケット名 |
| `CLOUDFRONT_DISTRIBUTION_ID` | 公開URLに紐づくCloudFront Distribution ID |

設定が不足している場合もReactのビルドは実行されますが、デプロイジョブは安全のためスキップされます。

## AWS IAM Role

長期アクセスキーは使用せず、GitHub Actions OIDCを使用します。信頼ポリシーでは、対象を`jin-take/meal-room`リポジトリへ限定してください。

Roleには最低限、次の権限が必要です。

- 対象S3バケットの一覧取得
- 対象S3バケット内オブジェクトの取得・作成・削除
- 対象CloudFront DistributionのInvalidation作成・参照

## 自動実行

次のパスを変更したコミットが`main`へ入ると実行されます。

- `web/**`
- `.github/workflows/deploy-web.yml`
- `.agents/skills/deploy-web-cloudfront/**`

## 手動実行

GitHubのActions画面から`Deploy Web to CloudFront`を選択し、`Run workflow`を実行します。

## デプロイ処理

1. Node.js 22を準備
2. `npm ci`
3. `npm run build`
4. `web/dist`を一時Artifactへ保存
5. GitHub OIDCでAWS Roleを引き受け
6. 静的ファイルをS3へ同期
7. `index.html`を長期キャッシュなしでアップロード
8. CloudFrontの`/*`をInvalidation
9. Invalidation完了まで待機

## キャッシュ方針

Viteが生成するハッシュ付きファイルには1年間のimmutableキャッシュを設定します。`index.html`は常に新しいハッシュ付きファイルを参照できるよう、`no-cache`としてアップロードします。

## 確認

```bash
cd web
npm ci
npm run build
```

GitHub Actions完了後は、CloudFront URLを開き、対象の変更が表示されることを確認します。古い画面が残る場合は、Actions上でInvalidationが完了しているか確認してください。
