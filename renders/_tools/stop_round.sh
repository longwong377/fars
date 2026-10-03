#!/bin/bash
for p in $(pgrep -f "vite --port 5191") $(pgrep -f "_tools/render.mjs") $(pgrep -f "chrome-headless|chromium"); do [ "$p" != "$$" ] && kill $p 2>/dev/null; done; true
