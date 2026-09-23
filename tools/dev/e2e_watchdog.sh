#!/usr/bin/env bash
# dev: when several agents share the serialised SwiftShader queue (tools/dev/queue_e2e.sh), run this in the background.
# Kills any Playwright test run older than LIMIT seconds (with its browser and Vite children), so no single render can
# hold the shared queue. Logs each kill.
LIMIT=${LIMIT:-900}; LOG=${LOG:-/tmp/e2e_watchdog.log}
kids() { for c in $(pgrep -P "$1"); do kids "$c"; echo "$c"; done; }
while true; do
  for p in $(pgrep -x node); do
    c=$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null) || continue
    case "$c" in *"playwright test"*)
      age=$(ps -o etimes= -p "$p" 2>/dev/null | tr -d ' '); [ -z "$age" ] && continue
      if [ "$age" -gt "$LIMIT" ]; then
        spec=$(echo "$c" | grep -o 'tests/e2e/[a-z_0-9]*\.spec\.ts\|-c [a-z.]*' | head -1); snap=$(echo "$c" | grep -o 'scratchpad/[a-z0-9_/]*' | head -1)
        all="$(kids "$p") $p"; kill $all 2>/dev/null; sleep 2; kill -9 $all 2>/dev/null
        echo "$(date +%H:%M:%S) killed $spec ($snap) after ${age}s" >> "$LOG"
      fi;;
    esac
  done
  sleep 20
done
