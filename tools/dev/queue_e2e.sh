#!/usr/bin/env bash
# dev: wait until no Playwright test runner process is alive, then run tools/e2e_snapshot.sh with the given args.
# Matches only real node runner processes by executable, never shell command lines (which may quote the pattern).
# A lock file serialises queued runs (two waiters could otherwise both see the queue free and start together).
SNAP="$1"; shift
busy() { for p in $(pgrep -x node); do tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | grep -q "playwright test" && return 0; done; return 1; }
exec 9> /tmp/parsa-e2e.lock
flock 9
while busy; do sleep 15; done
"$(dirname "$0")/../e2e_snapshot.sh" "$SNAP" "$@"
