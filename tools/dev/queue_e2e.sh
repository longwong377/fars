#!/usr/bin/env bash
# dev: wait until no Playwright run is active, then run tools/e2e_snapshot.sh with the given args (serialises SwiftShader runs)
SNAP="$1"; shift
while pgrep -f "node_modules/.bin/playwright test" >/dev/null || pgrep -f "npm exec playwright test" >/dev/null; do sleep 15; done
exec "$(dirname "$0")/../e2e_snapshot.sh" "$SNAP" "$@"
