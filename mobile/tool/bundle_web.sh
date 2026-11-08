#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WEB_ROOT="${PROJECT_ROOT}/web"
ASSET_ROOT="${PROJECT_ROOT}/flutter_shell/assets/web"
MEAL_ROOM_CLOUDFRONT_BASE_URL="${MEAL_ROOM_CLOUDFRONT_BASE_URL:-https://dqtgmho40xu09.cloudfront.net}"

cd "${WEB_ROOT}"
VITE_CLOUDFRONT_BASE_URL="${MEAL_ROOM_CLOUDFRONT_BASE_URL}" npm run build

if grep -Eq '(src|href)="/assets/' "${WEB_ROOT}/dist/index.html"; then
  echo "Web build contains absolute asset paths and cannot be bundled." >&2
  exit 1
fi

# Keep the Flutter-side asset keys stable even when Vite changes content hashes.
bundled_js="$(find "${WEB_ROOT}/dist/assets" -maxdepth 1 -type f -name '*.js' -print -quit)"
bundled_css="$(find "${WEB_ROOT}/dist/assets" -maxdepth 1 -type f -name '*.css' -print -quit)"
if [ -z "${bundled_js}" ] || [ -z "${bundled_css}" ]; then
  echo "Web build did not produce the expected JS/CSS assets." >&2
  exit 1
fi
cp "${bundled_js}" "${WEB_ROOT}/dist/assets/index.js"
cp "${bundled_css}" "${WEB_ROOT}/dist/assets/index.css"
sed -i '' -E 's#(src|href)="[^"]+\.(js|css)"#\1="./assets/index.\2"#g' "${WEB_ROOT}/dist/index.html"

# WKWebView loads Flutter assets through file://. Safari blocks module scripts
# from that origin, while the Vite production bundle is self-contained, so
# switch only the bundled entry point to a deferred classic script.
sed -i '' 's#<script type="module" crossorigin src="\([^\"]*\)"></script>#<script defer src="\1"></script>#' "${WEB_ROOT}/dist/index.html"

mkdir -p "${ASSET_ROOT}"
rsync -a --delete "${WEB_ROOT}/dist/" "${ASSET_ROOT}/"

echo "Bundled Web UI into ${ASSET_ROOT}"
