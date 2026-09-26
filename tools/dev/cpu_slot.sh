#!/bin/bash
# Heavy CPU jobs share 4 cores with the SwiftShader render lane (CLAUDE.md working rules; MASTER_PLAN §4.2). This runs a command in
# one of CPU_SLOTS (default 2) slots, at low priority (nice 15), waiting while every slot is taken. Use it for every soak, bot
# fleet, audio render, long vitest run and bake:   tools/dev/cpu_slot.sh npx tsx tools/soak.ts 354 60 7
# One process per slot: do not start parallel copies inside one slot (4 walkers at once starved a render for 2 hours, session 8).
SLOTS=${CPU_SLOTS:-2}
while :; do
  for i in $(seq 0 $((SLOTS - 1))); do
    exec 9>"/tmp/parsa-cpu.slot$i"
    if flock -n 9; then echo "[cpu_slot] slot $i: $*" >&2; nice -n 15 "$@"; rc=$?; flock -u 9; exit $rc; fi
  done
  sleep 5
done
