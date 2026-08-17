#!/usr/bin/env python3
"""Build, install, and launch a Flutter app on a connected physical iPhone."""

from __future__ import annotations

import argparse
import json
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, NoReturn


def fail(message: str) -> NoReturn:
    print(f"エラー: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(
    command: list[str],
    *,
    cwd: Path | None = None,
    capture: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    print(f"→ {' '.join(command)}")
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            check=False,
            text=True,
            capture_output=capture,
            env={**os.environ, "LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8"},
        )
    except FileNotFoundError:
        fail(f"コマンドが見つかりません: {command[0]}")

    if result.returncode != 0 and check:
        if capture:
            if result.stdout:
                print(result.stdout, file=sys.stderr)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
        fail(f"コマンドに失敗しました（終了コード {result.returncode}）: {' '.join(command)}")
    return result


def flutter_project(path: Path) -> Path:
    direct = path.resolve()
    if (direct / "pubspec.yaml").is_file() and (direct / "ios").is_dir():
        return direct
    nested = direct / "flutter_shell"
    if (nested / "pubspec.yaml").is_file() and (nested / "ios").is_dir():
        return nested.resolve()
    fail(f"Flutter iOSプロジェクトが見つかりません: {direct}")


def resolve_flutter(project: Path, explicit: str | None) -> Path:
    if explicit:
        candidate = Path(explicit).expanduser().resolve()
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
        fail(f"指定されたFlutterを実行できません: {candidate}")

    on_path = shutil.which("flutter")
    if on_path:
        return Path(on_path).resolve()

    config = project / "ios" / "Flutter" / "Generated.xcconfig"
    if config.is_file():
        for line in config.read_text(encoding="utf-8").splitlines():
            if line.startswith("FLUTTER_ROOT="):
                candidate = Path(line.split("=", 1)[1]) / "bin" / "flutter"
                if candidate.is_file() and os.access(candidate, os.X_OK):
                    return candidate.resolve()

    fail("Flutter SDKを解決できません。--flutterで実行ファイルを指定してください")


def device_value(device: dict[str, Any], key: str, default: str = "") -> str:
    current: Any = device
    for part in key.split("."):
        if not isinstance(current, dict):
            return default
        current = current.get(part)
    return str(current) if current is not None else default


def eligible_iphones() -> list[dict[str, Any]]:
    if not shutil.which("xcrun"):
        fail("xcrunが見つかりません。Xcode Command Line Toolsを確認してください")

    with tempfile.TemporaryDirectory(prefix="direct-build-app-") as temp_dir:
        output = Path(temp_dir) / "devices.json"
        run(["xcrun", "devicectl", "list", "devices", "--json-output", str(output)], capture=True)
        payload = json.loads(output.read_text(encoding="utf-8"))

    devices = payload.get("result", {}).get("devices", [])
    return [
        device
        for device in devices
        if device_value(device, "hardwareProperties.reality") == "physical"
        and device_value(device, "hardwareProperties.deviceType") == "iPhone"
        and device_value(device, "connectionProperties.pairingState") == "paired"
        and device_value(device, "deviceProperties.developerModeStatus") == "enabled"
    ]


def describe_device(device: dict[str, Any]) -> str:
    name = device_value(device, "deviceProperties.name").strip()
    model = device_value(device, "hardwareProperties.marketingName")
    ios = device_value(device, "deviceProperties.osVersionNumber")
    transport = device_value(device, "connectionProperties.transportType")
    udid = device_value(device, "hardwareProperties.udid")
    return f"{name} / {model} / iOS {ios} / {transport} / {udid}"


def select_device(devices: list[dict[str, Any]], requested: str | None) -> dict[str, Any]:
    if not devices:
        fail("ペアリング済み・Developer Mode有効の実機iPhoneが見つかりません")

    if requested:
        needle = requested.strip().casefold()
        matches = []
        for device in devices:
            values = {
                device_value(device, "identifier").strip().casefold(),
                device_value(device, "hardwareProperties.udid").strip().casefold(),
                device_value(device, "hardwareProperties.serialNumber").strip().casefold(),
                device_value(device, "deviceProperties.name").strip().casefold(),
            }
            if needle in values:
                matches.append(device)
        if len(matches) == 1:
            return matches[0]
        if not matches:
            fail(f"指定したiPhoneが候補にありません: {requested}")
        fail(f"指定が複数端末に一致しました: {requested}")

    wired = [
        device for device in devices
        if device_value(device, "connectionProperties.transportType") == "wired"
    ]
    if len(wired) == 1:
        return wired[0]
    if len(wired) > 1:
        fail("有線接続のiPhoneが複数あります。--deviceで対象を指定してください")
    if len(devices) == 1:
        return devices[0]
    fail("利用可能なiPhoneが複数あります。--deviceで対象を指定してください")


def bundle_identifier(app_path: Path) -> str:
    info_plist = app_path / "Info.plist"
    if not info_plist.is_file():
        fail(f"Info.plistが見つかりません: {info_plist}")
    with info_plist.open("rb") as handle:
        value = plistlib.load(handle).get("CFBundleIdentifier")
    if not value:
        fail("ビルド済みアプリからBundle IDを取得できません")
    return str(value)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=".", help="Flutterプロジェクト、またはそれを含むリポジトリ")
    parser.add_argument("--device", help="対象iPhoneの名前、UDID、CoreDevice ID、またはシリアル番号")
    parser.add_argument("--mode", choices=("debug", "profile", "release"), default="release")
    parser.add_argument("--flutter", help="Flutter実行ファイルのパス")
    parser.add_argument("--dart-define", action="append", default=[], metavar="KEY=VALUE")
    parser.add_argument("--web-app-url", help="WEB_APP_URLとして渡すURL")
    parser.add_argument("--list-only", action="store_true", help="候補端末を表示して終了")
    parser.add_argument("--no-launch", action="store_true", help="インストール後に起動しない")
    parser.add_argument("--skip-pub-get", action="store_true")
    args = parser.parse_args()

    devices = eligible_iphones()
    print("利用可能なiPhone:")
    for device in devices:
        print(f"  - {describe_device(device)}")
    if args.list_only:
        return

    selected = select_device(devices, args.device)
    project = flutter_project(Path(args.project))
    flutter = resolve_flutter(project, args.flutter)
    udid = device_value(selected, "hardwareProperties.udid")
    print(f"選択端末: {describe_device(selected)}")
    print(f"Flutter: {flutter}")
    print(f"プロジェクト: {project}")

    defines = list(args.dart_define)
    if args.web_app_url:
        defines.append(f"WEB_APP_URL={args.web_app_url}")
    for definition in defines:
        if "=" not in definition:
            fail(f"--dart-defineはKEY=VALUE形式で指定してください: {definition}")

    if not args.skip_pub_get:
        run([str(flutter), "pub", "get"], cwd=project)

    build_command = [str(flutter), "build", "ios", f"--{args.mode}", "--no-pub"]
    for definition in defines:
        build_command.extend(["--dart-define", definition])
    run(build_command, cwd=project)

    app_path = project / "build" / "ios" / "iphoneos" / "Runner.app"
    if not app_path.is_dir():
        fail(f"ビルド済みアプリが見つかりません: {app_path}")
    bundle_id = bundle_identifier(app_path)

    run([
        "xcrun", "devicectl", "device", "install", "app",
        "--device", udid, str(app_path), "--timeout", "120",
    ])

    launched = False
    if not args.no_launch:
        launch_result = run([
            "xcrun", "devicectl", "device", "process", "launch",
            "--device", udid, "--terminate-existing", bundle_id, "--timeout", "60",
        ], capture=True, check=False)
        if launch_result.returncode == 0:
            if launch_result.stdout:
                print(launch_result.stdout, end="")
            launched = True
        else:
            details = f"{launch_result.stdout or ''}\n{launch_result.stderr or ''}"
            print(details, file=sys.stderr)
            print("\nインストール済み・起動保留:")
            print(f"  端末: {describe_device(selected)}")
            print(f"  Bundle ID: {bundle_id}")
            print(f"  モード: {args.mode}")
            print("  インストール: 成功")
            print("  起動: 失敗")
            if "explicitly trusted" in details or "invalid code signature" in details:
                fail("iPhoneで「設定 → 一般 → VPNとデバイス管理」から開発者Appを信頼し、再度実行してください")
            fail("インストール後のアプリ起動に失敗しました")

    print("\n完了:")
    print(f"  端末: {describe_device(selected)}")
    print(f"  Bundle ID: {bundle_id}")
    print(f"  モード: {args.mode}")
    print("  インストール: 成功")
    print(f"  起動: {'成功' if launched else '未実行'}")


if __name__ == "__main__":
    main()
