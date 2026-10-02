# C4 load keeper (cloud, s17) — report

**Not met / broken first.** Cold ready < 60 s is met only on the page's own clock (57-60 s on tip 329bbbb1); the harness sees 70-74 s
(the first frames' world.update, ~8 s of people plans, C10's). The work is CPU in other owners' builders (plain fields + tree atlas C2 ~6 s,
first-frame people plans C10 ~6 s, ground packing V2 ~7 s, settlement ~4.5 s); the table is in bench-reports/load_s17.md and
went to C2, C10 and the lead. Page memory 5.5-5.7 GB (target 5): the ground's 192 MB array is the largest holder (Vagon asked
to run ktx_ground.ts). C5's loading-screen animations cost ~1 core during the load (C5 fixed it: 62 -> 5 CPU-s). Nothing measured on a GPU.

**What a player sees.** Same world; the files come in need order from the first second (every byte in by 34 s, was 80 s; no
measurable gain on this CPU-bound box now, n=3); one KTX2/Draco decoder (no hang, -0.1 GB); a file that never answers no
longer freezes the loading screen (300 s, then stand-ins). Pages 628 MB (< 900).

**Asked of Vagon:** ktx_ground.ts + commit; a measure.mjs cold,warm on the T4.

**Files:** public/sw.js, src/core/prefetch.ts (new), src/render/loaders.ts (+ the 871d8aab call sites), src/main.ts,
src/world/world.ts (soft timeout), tools/deploy/** (measure, serve, build_site, boot_list, boot_profile, boot_mem,
boot_files.txt), bench-reports/load_s17.md, DECISIONS D-580, handoff/s17/asks_vagon.md.

**Tests:** guards 25/25; animal_models, blockface, decor_assets, ground_cover, life_models, model_props, monuments,
relief_atlas, scan_props, scans_d302, defaults, fire_light pass; people_models' people_cloth input hash fails before and after
(pre-existing). Built-site loads: ~25 headless cold loads (bench-reports/load_s17.md).
