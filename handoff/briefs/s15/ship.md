# Brief s15/ship (D-374): a public URL, playable in under a minute on a good GPU (UD-31)

Goal as the player meets it: open a URL; within a minute on a good GPU (a modern gaming PC, 100 Mbps) you are standing in the
world and can walk; everything else streams in while you walk; talking to people works within that minute (the cloud session
makes talking on by default with small streamed models; you integrate and test it in the browser).

You own: vite.config.ts, index.html, src/main.ts boot sequence (spawn-first ordering; the load agent owns warmUp and
src/world/cache/**: hook, do not rewrite), src/shell/** (loading screen, settings), new tools/deploy/**, public/_headers.
Not yours: src/people/converse/**, src/audio/neural/** (cloud), src/world/cache/**, tools/bake_world/** (load agent).

Do: (1) `vite build` clean and served by a static server (no dev server): fix what breaks; the models' paths on a public
origin (models.ts isLocal) must work; COOP/COEP headers as needed for workers. (2) Spawn first: the boot builds and shows the
player's surroundings first, the rest streams in by distance while they walk; no full-world wait before the first frame.
(3) Download budget: what the first minute fetches <= ~150 MB (KTX2/Draco/brotli; split by distance). (4) Measure a cold
first visit (empty browser profile) and a warm one on the static build, wall time to walkable, on this T4 box; report the
numbers per phase (download, build, shader compile). (5) tools/deploy: a script that produces the static site and its
headers for a static host (Hugging Face static Space, Cloudflare Pages or GitHub Pages: check file-size limits against the
largest asset); do NOT publish anything: the lead asks the user first.
Done line: cold first visit to walkable <= 60 s on this box with the static build (state the network assumption), warm <= 20 s,
talking available within the minute (once the cloud work lands), page memory within the load agent's 5 GB.
Box rules: 2 agents max; every browser job via tools/dev/gpu_slot.mjs, every heavy node job (vite build, vitest) via
tools/dev/cpu_slot.mjs; one heavy process at a time; never kill what you did not start; never lower a threshold; guards on
every commit; commit every 30-45 min; at the end merge s14-int, test, commit, `mkwt.mjs --done ship`, report <= 250 words.
