#!/usr/bin/env bash
# dev: the session's render queue (serialised SwiftShader runs), each on its own frozen snapshot; logs under $1
OUT="$1"; ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; Q="$ROOT/tools/dev/queue_e2e.sh"
QUALITY=high ROUTES=all timeout 3600 "$Q" "$OUT/e2e_bench" tests/e2e/bench.spec.ts --project=webgpu > "$OUT/bench.log" 2>&1
timeout 1500 "$Q" "$OUT/e2e_tl" tests/e2e/translation.spec.ts --project=webgpu > "$OUT/translation.log" 2>&1
echo chain done
