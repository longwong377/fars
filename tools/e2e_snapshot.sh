#!/usr/bin/env bash
# Run Playwright e2e specs against a frozen snapshot of the working tree, so edits made while a long SwiftShader run is in
# progress cannot hot-reload the page under test. Usage: tools/e2e_snapshot.sh <snapshot dir> [playwright args…]
set -euo pipefail
SNAP="$1"; shift
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$SNAP"
rm -rf "$SNAP"; mkdir -p "$SNAP"; tar -C "$ROOT" --exclude=./node_modules --exclude=./.git --exclude=./.claude --exclude=./shots --exclude=./test-results --exclude=./bench-reports --exclude="./snap_*" -cf - . | tar -C "$SNAP" -xf -
ln -sfn "$ROOT/node_modules" "$SNAP/node_modules"
mkdir -p "$ROOT/shots"; ln -sfn "$ROOT/shots" "$SNAP/shots"
# the commit the snapshot was taken from, for the specs' evidence files (the snapshot has no .git: session 9 found "unknown");
# "+wt" when the working tree had uncommitted changes
export COMMIT="${COMMIT:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null)$( [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no 2>/dev/null)" ] && echo +wt)}"
cd "$SNAP" && npx playwright test "$@"
