#!/usr/bin/env bash
# dev: stop running Playwright / headless Chromium / Vite dev servers (pattern-matched, excluding this script's own shell)
for pat in 'playwright test' 'chrome-linux/chrome' 'node_modules/.bin/vite' 'npx vite'; do
  for pid in $(pgrep -f "$pat"); do [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ] && kill "$pid" 2>/dev/null; done
done
true
