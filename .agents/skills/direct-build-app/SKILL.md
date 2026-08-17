---
name: direct-build-app
description: Detect a physically connected, paired iPhone on macOS and directly build, sign, install, and launch a Flutter iOS app on it. Use when Codex is asked to put, install, deploy, run, or test the current Flutter app on a connected real iPhone, especially when multiple paired iPhones or a missing flutter PATH make manual device selection unreliable.
---

# Direct Build App

Use the bundled script to select a wired physical iPhone first, resolve the project Flutter SDK, build a signed `.app`, install it with `devicectl`, and launch it.

## Workflow

1. Inspect the Flutter project for its runtime endpoint and signing configuration. Explain when current UI changes live on a remote server and therefore are not bundled in the iOS shell. Do not deploy remote web content without explicit authorization.
2. List candidates without changing the device:

   ```bash
   python3 <skill-dir>/scripts/deploy_ios.py --project <flutter-project> --list-only
   ```

3. If one wired, paired, Developer Mode-enabled iPhone exists, let the script select it. If the result is ambiguous, ask the user which displayed device to use, then pass `--device <name-or-udid>`.
4. Build, install, and launch:

   ```bash
   python3 <skill-dir>/scripts/deploy_ios.py \
     --project <flutter-project> \
     --mode release
   ```

5. Pass compile-time values only when the user or project requires them, for example:

   ```bash
   python3 <skill-dir>/scripts/deploy_ios.py \
     --project <flutter-project> \
     --web-app-url https://example.com/index.html
   ```

6. Report the selected iPhone, bundle identifier, build mode, installation result, and launch result.

## Guardrails

- Target only physical iPhones that are paired and have Developer Mode enabled.
- Prefer a wired iPhone over devices visible only on the local network.
- Never guess when multiple equally eligible devices remain.
- Preserve the project's Bundle ID, Apple Team, signing style, and runtime URL.
- Do not disable code signing, rewrite provisioning settings, erase a device, uninstall unrelated apps, or change trust/pairing settings.
- Treat a locked device, missing trust, missing Apple account, or provisioning failure as an explicit user-action blocker and show the relevant error.
- Use `--no-launch` only when installation without foreground launch was requested.

## Script options

Run `python3 <skill-dir>/scripts/deploy_ios.py --help` for all options. The script resolves Flutter from `PATH` or `ios/Flutter/Generated.xcconfig`, so do not hard-code a user-specific Flutter installation.
