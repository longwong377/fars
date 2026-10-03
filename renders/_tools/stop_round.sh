#!/bin/bash
# kills only processes whose command starts with node/npm/sh vite, node render.mjs or a chrome binary (never a shell that mentions them)
for p in $(pgrep -f "^(node|npm exec|sh -c) .*vite --port 5191") $(pgrep -f "^node /home/user/fars-renders/renders/_tools/render.mjs") $(pgrep -f "^/[^ ]*(chrome|chromium)[^ ]* "); do kill $p 2>/dev/null; done; true
