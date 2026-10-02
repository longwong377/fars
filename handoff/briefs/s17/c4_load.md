# C4 load keeper (cloud) — branch cloud-s17-c4-load; D-580, Q-1510..Q-1519, B610..B619
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight (UD-31):** the public URL walkable in under a minute on a good GPU, talking on, page memory
under 5 GB, the site under GitHub Pages' 1 GB, while both sides add textures and models all day.
**Owns:** src/render/models.ts (the loader), a new src/render/loaders.ts (one shared KTX2 transcoder and Draco decoder: the
idea of cb3f0389 + 601f5b60 / 871d8aab on cloud-s16-boot, reverted because the built site hung; re-land it only with a passing
built-site load), the boot sequence in src/main.ts (C5 adds the intro hook through you), public/sw.js, tools/deploy/**,
.github/workflows/pages.yml.
**Start at:** sessions/s16.md "Deploy state"; bench-reports/load_s16_boot.md on origin/cloud-s16-boot (99.8 s cold, 5.83 GB);
`npm run build` then `node tools/deploy/measure.mjs dist --visits cold --params norender` (headless works here: the
baseline). Then: animals, far models and the talk model stream after walkable; the shared decoder; asset compression for
everything the others land (KTX2 via the npm `ktx2-encoder` if it works here, else list for Vagon; Draco; LODs); the Pages
size (du of dist + world-cache).
**Also, as the cloud's CI:** when the lead asks, run the headless built-site load on the given commit and report the numbers.
**Done:** headless cold ready (norender) < 60 s on the s17 tip with everyone's assets in; dist + world-cache < 900 MB; the
measure numbers written to bench-reports/load_s17.md; nothing that hangs (s16's lesson).
