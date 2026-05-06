#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$MOBILE_DIR/../.." && pwd)"
WEB_OUT_DIR="$MOBILE_DIR/assets/www"
RUN_PREBUILD="false"

for arg in "$@"; do
  case "$arg" in
    --prebuild)
      RUN_PREBUILD="true"
      ;;
    --no-prebuild)
      RUN_PREBUILD="false"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "[build-and-sync] Building local TrimSwipe web bundle..."
cd "$ROOT_DIR"
npm run build:mobile-spa

if [ ! -f "$WEB_OUT_DIR/index.html" ]; then
  echo "[build-and-sync] Missing $WEB_OUT_DIR/index.html after build" >&2
  exit 1
fi

echo "[build-and-sync] Web bundle is ready at $WEB_OUT_DIR"

if [ "$RUN_PREBUILD" = "true" ]; then
  echo "[build-and-sync] Running Expo prebuild so native projects include the local web bundle..."
  cd "$MOBILE_DIR"
  npx expo prebuild
fi
