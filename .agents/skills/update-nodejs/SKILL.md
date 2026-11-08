---
name: update-nodejs
description: Update the Node.js release used across MealRoom local tooling, package engines, GitHub Actions, documentation, and the AWS Lambda runtime. Use when upgrading, pinning, or auditing the repository's Node.js version.
---

# Update Node.js

Keep every repository-owned Node.js version reference consistent while respecting the difference between an exact Node.js release and an AWS Lambda major runtime.

## Workflow

1. Determine the requested release. If the user asks for latest or current information, verify it against the official Node.js release or download pages. Prefer an LTS release for production unless the user explicitly chooses otherwise.
2. Before selecting `nodejsXX.x`, verify that the corresponding managed runtime is supported by the official AWS Lambda documentation. Do not assume a newly released Node.js major is already available in Lambda.
3. Search the repository for version references before editing. At minimum inspect:
   - `.nvmrc` and `.node-version`
   - `web/package.json` and its root entry in `web/package-lock.json`
   - `backend/package.json` and its root entry in `backend/package-lock.json`
   - `.github/workflows/*.yml`
   - `backend/template.yaml`
   - `README.md` and `docs/`
4. Pin local and CI configuration to the exact release. Set package `engines.node` to accept that release within the selected major, for example `>=26.13.0 <27`. Set the Lambda runtime to its major identifier, for example `nodejs26.x`.
5. Do not rewrite dependency packages' own `engines` entries in lockfiles. Only update the root package entry.
6. Audit JavaScript-based GitHub Actions separately from the application's Node.js version. When GitHub deprecates an Actions runtime, verify the official action release and update each affected action to a major that declares a supported `runs.using` runtime. Do not assume `node-version` changes the action's internal runtime.
7. Check for stale repository-owned version references and validate JSON, YAML, and skill structure. Run application tests or builds only when the user requests them.

Report the selected release, every category changed, any runtime availability limitation, and validation performed. Do not install or switch the user's globally active Node.js version unless explicitly requested.
