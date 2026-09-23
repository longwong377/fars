#!/usr/bin/env bash
# dev: render job runner. Runs Playwright job files one at a time, in name order, through tools/dev/queue_e2e.sh (which
# takes the shared lock /tmp/parsa-e2e.lock, so runs never overlap with other queue users).
# Usage: tools/dev/render_runner.sh <work dir>   (start it in the background; it loops until killed)
#   <work dir>/jobs/NNN_name.job   three lines: name, spec, env assignments (e.g. `E2E_PORT=5199 Q=test ONLY=scribe-at-work`)
#   <work dir>/e2e_<name>.log      the run's output (ends with DONE); <work dir>/runner.log: start/done lines
#   <work dir>/snap_<name>/        the frozen copy of the tree the job ran against (delete it afterwards: ~0.3 GB)
# Screenshots land in the tree's shots/. Keep a job to <= 2 page loads (about 5 min each at test quality): the watchdog
# (tools/dev/e2e_watchdog.sh) kills runs older than 15 min. Debug specs need DBG=1 in the env line.
set -u
W="${1:?usage: render_runner.sh <work dir>}"; mkdir -p "$W/jobs"
cd "$(dirname "$0")/../.."
while true; do
  j=$(ls "$W"/jobs/*.job 2>/dev/null | sort | head -1)
  if [ -z "$j" ]; then sleep 20; continue; fi
  name=$(sed -n 1p "$j"); spec=$(sed -n 2p "$j"); envs=$(sed -n 3p "$j"); mv "$j" "$j.running"
  echo "$(date +%T) start $name" >> "$W/runner.log"
  env $envs tools/dev/queue_e2e.sh "$W/snap_$name" "$spec" --project=webgpu > "$W/e2e_$name.log" 2>&1; echo DONE >> "$W/e2e_$name.log"
  echo "$(date +%T) done $name" >> "$W/runner.log"; rm -f "$j.running"; sleep 3
done
