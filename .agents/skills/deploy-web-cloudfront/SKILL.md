---
name: deploy-web-cloudfront
description: Build the Meal Room React app, publish it to S3, and refresh CloudFront so the public URL serves the latest main branch.
---

# Deploy Meal Room Web to CloudFront

Use this skill when the user asks to publish, deploy, refresh, or verify the React Web application hosted through S3 and CloudFront.

## Preconditions

- Work from the repository root.
- Confirm that the intended changes are merged into `main` before production deployment.
- Never print AWS credentials or GitHub secrets.
- Prefer GitHub Actions with AWS OIDC rather than long-lived access keys.

## Repository configuration

GitHub must contain:

- Secret `AWS_DEPLOY_ROLE_ARN`
- Variable `AWS_REGION`
- Variable `WEB_S3_BUCKET`
- Variable `CLOUDFRONT_DISTRIBUTION_ID`

The AWS role must trust this GitHub repository through OIDC and only allow the required S3 and CloudFront operations.

## Standard deployment

1. Check that `.github/workflows/deploy-web.yml` exists.
2. Confirm that the target commit is on `main`.
3. Trigger the `Deploy Web to CloudFront` workflow manually, or allow a `web/**` change merged to `main` to trigger it automatically.
4. Verify that the build job completed.
5. Verify that files were synchronized to the configured S3 bucket.
6. Verify that the CloudFront invalidation completed.
7. Open the CloudFront URL and confirm the expected change is visible.

## Local preflight

```bash
cd web
npm ci
npm run build
```

The output must be created in `web/dist`.

## Deployment behavior

- Hashed static assets receive a long immutable cache lifetime.
- `index.html` is uploaded with no-cache headers.
- S3 objects not present in the current build are removed.
- CloudFront invalidates `/*` and waits for completion.
- Concurrent production deployments cancel the older run.

## Failure handling

- Missing repository configuration: set the secret and variables listed above.
- Build failure: reproduce with the local preflight commands.
- Access denied: inspect the OIDC role trust policy and S3/CloudFront permissions.
- Old content remains visible: confirm invalidation completion and inspect the response cache headers.
