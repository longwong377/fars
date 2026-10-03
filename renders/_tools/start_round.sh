#!/bin/bash
# usage: start_round.sh <outdir>   (serves origin/s17-int from /home/user/fars-world)
OUT=$1
cd /home/user/fars-world && git fetch -q origin s17-int && git checkout -q --detach origin/s17-int && git log --oneline -1
NOHMR=1 nohup npx vite --port 5191 --strictPort > /tmp/claude-0/vite.log 2>&1 &
sleep 5; rm -rf "$OUT"; mkdir -p "$OUT"
WEBGL=1 FRAMES=2 nohup node /home/user/fars-renders/renders/_tools/render.mjs ${SET:-/home/user/fars-renders/renders/_sets/round.json} "$OUT" > "$OUT.log" 2>&1 &
