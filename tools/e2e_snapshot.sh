#!/usr/bin/env bash
# Run Playwright e2e specs against a frozen snapshot of the working tree, so edits made while a long SwiftShader run is in
# progress cannot hot-reload the page under test. Usage: tools/e2e_snapshot.sh <snapshot dir> [playwright args…]
set -euo pipefail
SNAP="$1"; shift
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$SNAP"
rm -rf "$SNAP"; mkdir -p "$SNAP"; tar -C "$ROOT" --exclude=./node_modules --exclude=./.git --exclude=./shots --exclude=./test-results --exclude=./bench-reports -cf - . | tar -C "$SNAP" -xf -
ln -sfn "$ROOT/node_modules" "$SNAP/node_modules"
mkdir -p "$ROOT/shots"; ln -sfn "$ROOT/shots" "$SNAP/shots"
cd "$SNAP" && npx playwright test "$@"
