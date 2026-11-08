#!/usr/bin/env bash
set -euo pipefail
TMP=$(mktemp -d)
flutter create --platforms=android,ios .bootstrap_meal_room
cp -R .bootstrap_meal_room/android .
cp -R .bootstrap_meal_room/ios .
cp -R .bootstrap_meal_room/test .
rm -rf .bootstrap_meal_room
echo "Flutter platform files created. Run: flutter pub get"
