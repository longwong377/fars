# PROGRESS (problems first)

## Broken / placeholder / weak (read first)
- **Session 6 (2026-09-24; ended — read this block and HANDOFF.md first).** Base 272bf70 (the session-5 handoff). All
  session-5 bundles and every session-6 workstream are merged; the per-workstream entries below give the detail.
  - **Gates:** Phase 8 **PASSED** at review round 3 (REVIEWS/phase8_r3.md; open majors: voices unheard (H8), music visuals
    placeholder (B20), tablets' text placeholder (B18)). Phase 5: soak passes all 8 gates on the final sim; the §13.11
    shadow review has NOT passed (round 6: A 1/20, B 3/20 below 4; round 7: A 2/20, B 1/20; round-7 fixes and year-wide
    invariants merged, D-191; round 8 next). §8.2 rubric first pass FAILED (light 2, materials 1, scale 2, detail 2,
    people 2, atmosphere 2; REVIEWS/rubric_s6_pass1.md); the four look workstreams' fixes (D-187..D-190) are merged but
    **not re-scored**; render pass 2 was part-way at handoff (shots not kept). Phases 3/4, 6/7: reviews not run.
  - **Rendering bugs found and fixed at high:** effect quads overwrote the G-buffer (three blends only `output`): black
    boxes and streaks round braziers, 1–2 km bars on the sunrise horizon (D-183); white blotches on the Hadish floor
    (occlusion fit flipped by roughness mottling, D-181); probe Monte Carlo noise and a wall leak in the bake (D-180).
  - **Still open in the look:** outdoor contact AO (D-188), hair/beards as shells, skirts as tubes, vivid court robes,
    DEM-smooth skylines, the dawn-horizon comb, a black doorway reveal (B23).
  - **Not heard or seen on a GPU:** music, occlusion, incised signs, clay tablets, re-rendered voices.
  - **Sim round 8 merged at handoff (D-191, D-193):** year-wide invariants 3.4 M flagged person-days → 0; final soak passes all
    8 gates; round-8 input (pick 149) not scored. **Every woman is now unnamed**: names come from licensed evidence only and
    the licensed texts read contain no woman's name (D-193, Q-294).
- **Session 7, court fill (D-199; the user: "fill the gaps"; court setting only, the default stays court-absent).**
  **Not rendered in a browser** (node only). Filled, all reconstructions: the delegations' dress from the Apadana reliefs
  (23 peoples; form B, colours C; **the identifications and details are recollections of Walser 1966 / Schmidt 1953, NOT
  SEEN**: NEEDS #16, Q-370); the king as a person (B9, Q-335: Xerxes in the reliefs' dress with parasol and fly-whisk
  bearers and four spearmen, enthroned in the Apadana on ~2 mornings in 5, otherwise unseen in the Hadish); 1,946 tents in
  eight camps (C); the retinue simulated in the town (11,500) and on the plain (5,000): town 21,270 at night / 18,588 by
  day, plain 41,136 against w 20,000 / 42,000. **Still placeholder:** the delegations' animals and chariots, some mantles
  and tassels, the bearers not locked in step behind the king, straight paths through the camps, the spearmen's
  apple-shaped butts, the women's night music.
- **Session 6, court workstream (branch court-s6, D-182; merged by the lead).** With the court setting the
  court in residence is simulated and drawn (9,310 people, C; the Terrace 4,448 at 10:00 and 2,295 at 02:00 on day 30).
  **Not rendered in a browser yet** (node counts only). **PLACEHOLDER:** delegates' dress (generic Median riding dress),
  the court camp's tents (people drawn in the open), the spearmen's apple-shaped butts, the royal women's night music.
  **Not simulated:** the retinue in the town (+13,000) and the plain (+5,000); the king (B9). The court's views: the
  hillside is over 12 M triangles on the world alone (B13).
- **Session 6, music and occlusion workstream (branch p8-music-s6, D-178; merged by the lead, 02f0947).** Music now plays
  only from performers: quern songs, Ionian masons' songs, and the court's supper and night music when the court setting
  is on. Audio occlusion now uses the built geometry. **Unverified:** it has not been heard in a browser (worker render,
  node chain, mix). **PLACEHOLDER:** no harp model, no playing or singing animation (the speech jaw stands in), and court
  women in working dress. **Missing:** the magus's chant (text unattested; living religion: B20, Q-301) and herders' pipes
  (herders not rendered: Q-302). Occlusion leaves out the town's and the plain's buildings.
- **Session 6, writing on objects (D-179, branch p8-writing-s6; review A-M4).** PLACEHOLDER: the Elamite on every tablet
  (scribes' room, carried prop) is wedge impressions with no readable text: no Persepolis Treasury text is reachable (B18,
  NEEDS #15); flagged in writing.json, F3 and the translation layer. The only real texts in clay are two ARIo seal
  inscriptions (SDa; Q009270) rolled on the tablets' left edge, the leather scrolls' bullae and the Treasury door sealings;
  which wording stood on which Treasury seal is C (Q-320) and the seal figures are schematic C. Leather scrolls: rolled and
  sealed, their Aramaic inside, none rendered. The door sealing no longer claims an impression it lacks. Not rendered in a
  browser yet (node previews of the relief only).
- **Session 5 (2026-09-23/24; ended — read this block and HANDOFF.md first).** Base 2f6dbaa (the session-4 handoff).
  - **Nothing from the session-5 agents is merged.** Their work is in `handoff/branches/s5_*.bundle` (crowd merge with a
    WIP fix round; sim round-5 fixes WIP; Phase 8 carving WIP; Phase 8 layer done + a WIP tail). HANDOFF.md says how to
    take each one in. The Phase 8 music/occlusion and writing-on-objects workstreams never started.
  - **Baseline on the pushed tree:** tsc clean; vitest 519 passed / 1 skipped at start (+ the session's new tests, passing);
    lint:all OK; offline walkthrough bot 97/97 legs.
  - **Soak on the D-150 final code PASSES all 8 gates** (bench-reports/soak-2026-09-24T00-01-47-708Z.json): 15,454,999
    person-days, 0 plan issues, worst population near-copy share 0.094 (limit 0.10), 14–20 event kinds a week (floor 8),
    stores in bounds, construction advanced 51 of 51 weeks.
  - **Shadow review round 5 FAILED** (two independent reviewers, pick seed 97; REVIEWS/shadow_phase5_r5.md: 1 of 20 below
    4; _b.md: 3 of 20 below 4). Shared blocking cause: outdoor field work starts into rain and people "shelter" for hours in
    open fields (~20–40 k person-days a year). Also: planners use the start-of-year age (1,446 one-year-olds planned as
    infants by day 341), children "mind" little ones who are elsewhere, the camp's flour is not real goods, a guard's second
    breakfast, home hours blind to rank and heat, 229 of 230 Egyptian men named Muzraaya. Fixes: WIP (s5_sim-r5.bundle).
  - **Phase 8 independent review FAILED** (REVIEWS/phase8.md, phase8_b.md). Critical: the carved Old Persian misspells 22 %
    of the words against the published sign sequence (Kent's spelling rules missing; Xerxes' name in every Xerxes
    inscription); the translation status is contradicted by the project's own records. Major: 45 of 73 lines never heard;
    no music in the world; tablets blank, no Aramaic leather; most Terrace inscriptions missing; signs raised, not cut;
    lint blind to audio and murmur; no audio occlusion. The layer workstream (bundle) found the Livius translations are
    "All rights reserved": no translation can be shown (B17a); the voice acceptance was measured and not met (B17b).
  - **Phase 8 voices, session 6 (D-185).** Re-rendered through libespeak-ng 1.52 with norm pitch per voice class, word stress
    and a contour per utterance type: the machine pitch and contour thresholds are met (re-measured by the round-3 reviewer).
    Still open: no human has rated intelligibility or naturalness (the §10 acceptance, H8); machine phone recovery did not
    improve (Greek worse); the 11 Babylonian lines (formant voice, PLACEHOLDER-QUALITY) and the crowd murmur were not re-tuned.
  - **Phase 8 carving workstream, session 6 (merged; round-2 fix D-184 on `p8-carving-r2`; no GPU render yet).** Still broken
    or placeholder: no render of the incised signs on a GPU (node preview only: fine stepped banding on the cut walls); 10 copies
    or versions of the royal programme not carved (XPc/XPd portico-pillar copies, DPb garment line, XPk, XPg, XPj/XPm, the El/Bab
    of DNa/DNb, DNc-DNe; Q-290, flagged in F3); 146 carved Old Persian signs are the editor's restorations (C) and 6 unrestored
    stretches of DNb are uncut blanks (PLACEHOLDER). True measure (D-184): the carved Old Persian equals the published CC0
    sign-by-sign edition (ARIo in CATF) sign for sign, dividers and logograms included, 0 differences over 5,276 positions and
    1,029 dividers in 12 texts (engraver's extra signs carved, his omissions not); the round-1 claim "0 mismatches" was
    measured against a scraped copy and two of its corrections were against the stone (review round 2 C1). Elamite and
    Babylonian carved in the edition's lines without word spaces. Signs incised (V-cut, tested as a cut); the programme is
    src/data/royal_inscriptions.json.
  - **First renders of the session-4 shaders on a GPU backend:** at quality test every effect material (flames, smoke, haze,
    rain, snow) FAILED to compile on WebGPU (fixed, D-174). At quality high `stair-climb-pm` and `tripylon-n-stair` render
    on WebGPU with **no shader error** (atmosphere D-156, surfaces D-157 and faces D-155 compile; clouds visible). WebGL2
    at quality test renders; **at high it timed out** (8 frames of one view > 23 min, no error).
  - **Found in those renders and fixed in node only (D-174, unrendered):** the aerial perspective filled the halls with a
    white veil (outdoor horizon light scattered by the hall's air, raised by the interior exposure ×509); rain fell inside
    the halls and wetted/puddled their floors. **Not diagnosed:** white blotches on the Hadish's red floor (WebGL2, test).
  - **Look, as rendered at high:** the plain views read as CG — the Naqsh-e Rustam cliff is a smooth sheet with vertical
    streaks and flat tomb façades, the Ka'ba-ye Zartosht a white box, the village walls flat boxes; the Tripylon stair's
    relief figures read as flat painted cut-outs; stair-climb-pm's stair is dark and flat. The full moment pass, the §8.2
    rubric and the Phase 3+4 / 5 / 6+7 reviews did **not** run.
- **Session 4 (2026-09-23; ended — read this block and HANDOFF.md first).** Base was be6db72 (the session-3 handoff). Done and pushed:
  - **Soak passes all 8 gates again** (D-140, sim agent). Worst population variety 0.094 (thin margin, unchanged).
  - **Shadow review round 4 FAILED** (REVIEWS/shadow_phase5_r4.md, pick seed 89): 1 of 20 below 4 (a farming man idle at home all day). The sim agent is fixing the round-4 findings (D-150); round 5 (pick seed 97) follows its merge.
  - **Interiors are no longer black** (D-141, B10 resolved): the eye adapts to the probes' interior light. Hadish hall mean luma 83 (was 1.6); `apadana-hall-in` mean 31, columns readable.
  - **Sun shadow bias was 0.8 m in the world** (D-146): wall heads under every roof were sunlit. Now 6 cm.
  - **Light leaked through walls thinner than the probe spacing** (D-152): the bright red strip at the foot of the scribes' room wall came from probes in the sunlit court 1.7 m away, mixed in by the trilinear lookup. Each probe now carries its reach along ±x/±z and the lookup drops a cell side whose probes cannot reach the point. The floor at the wall's foot went from 0.021 of open ground (30× the room) to the room's own 0.0003–0.0009. **Residual:** within ~2 m of a doorway, a ≤ 0.3 m band at the wall's foot still blends (a far corner in line with the opening).
  - **Clear skies drew a quarter of the dome in cloud** (D-145): fixed by a measured dome-cover curve.
  - **§8.3 detail at 1 m** (D-147): micro grain on every surface, finer column lathes, `tests/detail.test.ts` (bench-reports/detail-*.txt). Ashlar block tone (D-148). Plaster and red floors: stronger mottling and roughness variation (polish and wear, C).
  - **Naqsh-e Rustam** (D-144): cross-shaped dressed margins; the 15:00 view still shows regular stripes (toned down, not re-rendered).
  - **Camera rig:** `moments.spec` loads the page once per world state (views that share day, hour and weather share a load); the test camera finds floors off the walkable grid (it landed on the Tachara's roof).
  - **Rendered at high this session (before the agents' merges):** apadana-enter, apadana-hall-in, hadish-hall, scribe-at-work, stair-climb (in the Terrace's morning shadow: flat and dark), dawn-sunrise (x −39.6: only plain in frame; reframed twice, re-render queued), the plain budget views (stair-dawn-plain 348 draws / 5.7 M tris; apadana-north-nr 467 / 10.3 M; stair-foot-east 541 / 10.1 M), naqsh-200m (am/pm), garden-paradise, village-p22, pulvar-bank-april (trees read as cabbages of big leaf cards; the canal is a black strip; foreground trees bare in April; the riverbank is bare sand: the plain agent is on these). The Tachara relief views rendered green (a snapshot caught new probe code with old data): re-queued.
  - **A preliminary photoreal triage** (REVIEWS/prelim_photoreal_triage.md, a vision subagent, not the gate) scores the session-4 renders **light 2, materials 2, scale cues 2, detail 2, atmosphere 2–3 of 5: as a set they read as CG.** Top faults: flat uniform surfaces with razor edges; nothing specular to reflect (no environment map, no SSR); red floors lit by their own red; glare fogging the interiors; a 14 mm capture lens and weak framing; no shadow from Kuh-e Rahmat at dawn (outside the shadow cascades); almost no aerial perspective at 1–10 km; clouds darker than the sky; no light in the air. Fixed by the lead so far: capture lenses and framing, glare cap, red floor albedo and per-hemisphere probe tints (D-158), frame meter (D-159), effect materials out of the G-buffer (the pale rectangle round brazier flames), scribes' room furnishings in shadow. The rest is with two agents (atmosphere D-156, surfaces D-157).
  - **Merged: every simulated activity is performed** (D-142): 36 IK work cycles, 32 tools, 32 work objects, 5 animal species; `lint:activity` (0 placeholders) in `lint:all`. **Not yet seen in the world**: the population is drawn only when the crowd agent's work (D-143) merges.
  - **Merged at the end (none rendered at high after merging; read `REVIEWS/agent_reports_session4.md`):** plain and garden look (D-149: tree crowns in clumps with shading shared by impostors, April phenology corrected, band-limited water, banks and river margins, garden channels; the oak's impostor misses the r3 match at high by 1–2/255); sim round-4 fixes (D-150: every round-4 finding addressed; **final commit not soak-verified**; round-5 input generated); carving (D-151: protome, snail-lock templates, volutes, Gate colossi, relief modelling, gold leaf); faces, hair and cloth (D-155: node-verified only); atmosphere (D-156: terrain horizon shadows — first sun on the Grand Stair landing 06:26 on day 0 —, aerial perspective with 43 km visibility, physical day sky, multiple-scattering clouds, hall light shafts; **never compiled on a GPU backend**); surfaces (D-157: broad tone, ashlar, bevels, env-map specular with occlusion, SSR, contact shadows, direct-light GI inside the volumes; one render run before its last fix).
  - **Not merged: the crowd at scale (D-143, PARTIAL)**, which conflicts with the performances in `src/people/crowd.ts`: saved as `handoff/branches/crowd_D143.bundle` (HANDOFF.md says how to merge it). Its findings are logged as B11–B13 (floor of 300 visible met in 1 view of 7; the court in full assembly is not simulated; 3 of 7 views over 12 M triangles).
  - **Not yet run:** the full high-quality moment pass (jobs prepared), the §8.2 rubric and the independent Phase 3/4/5/6/7/8 reviews (after the merges), bench ×4, `npm run soak` on the merged tree.
- **State at the end of session 3 (evening). Every agent branch is merged; HANDOFF.md lists the next steps in order.**
  - **The soak FAILS 2 of 8 gates after the round-3 sim merge** (the sim agent's full run on bf4ccf7, D-139):
    - populationVariety: child 41397, present 7 days, has a near-copy share of 0.19 (0.095 after round 2);
    - plansWellFormed: on day 123, children 42002 and 42003 walk on road:plain at 16.32 while their mother 42000 is already at h:9660 ("apart").
    - The other six gates pass (15,454,999 person-days, no per-plan issue).
    - Likely causes: the new toddler walk-between pass and the lane-outing changes (population.ts `small()`), and mothers' plans diverging from the children's after the water()/fire() post-passes.
    - **This is the first job of session 4**, with interiors.
    - The last soak that passed all eight gates is the round-2 state (merge c5075a2, re-run at the end of session 3).
  - Interiors now render near black until eye adaptation follows the probe illuminance indoors (below; Q-153). This is the first job of session 4 with the soak.
  - Merged in the last hour and **not rendered at high quality**:
    - the trees (D-120 … D-123; P22 grey domes fixed, per a test-quality render);
    - the Tachara rebuild (D-130 … D-134; N and E rooms unrendered);
    - the sim round-3 fixes (D-135 … D-139; soak result below, shadow review round 4 not run).
  - Naqsh-e Rustam at 200 m (test quality, after D-069): the tomb reliefs are specks of colour on dark façades, and the cliff reads as a low mound with dark horizontal bands, not a 64 m rock face. It needs work.
  - The renders still to run are in `handoff/render_jobs/` (mountain-dusk, reliefs-raking, bench × 4); run them with `tools/dev/render_runner.sh`.
- **Interior light (light probes, D-110 … D-114; interior-lighting agent, session 3):**
  - The roofed halls are lit by baked probes: sky through the openings plus one and two bounces of sun and sky. Every lit material gets this through the hemisphere light, at every quality. Outside the six volumes (Gate, Apadana, Tachara, Hadish, Treasury hall, Harem) nothing changes.
  - **The halls now render near black at the eye-adaptation formula's exposure** (Apadana columns 0, Hadish columns 0; before: 24–27, from an unoccluded skylight at an outdoor exposure). The probes put the Apadana hall at 0.005–1 % of open ground, since the model has four 4 × 10 m doorways and no windows (Q-150). The formula never exposes more than 1/0.15 of the outdoor value (Q-153, B10).
  - A what-if exposure of 60 makes the Hadish readable (columns 16–33). From the N portico the Apadana columns stay at 3–4 even at 29.5. **The brief's target (luma ≥ 25) is not met.**
  - Frozen test renders (moments) used to keep the first frame's exposure (the spawn, outdoors). They now re-evaluate it each frame, so every interior moment renders differently from earlier shots.
  - Not covered: town houses (no volumes); the Tripylon, Hall of 100 Columns and garrison have no roofs as built. The sun's bounce is its yearly mean (C). There is one bounce outdoors and two inside.
  - A shadow-map leak was fixed on the way: roofs now cast from their top faces (D-114).
  - **Unverified:**
    - WebGL2 (never rendered with the probes);
    - the post-merge interiors: Tachara rooms, the Treasury N range and scribes' room (volume `treasury:1`);
    - the full unit suite after the merge (the probe tests pass; the full suite passed before the merge);
    - the roof tops' self-shadowing after the roof fix.
- **Photorealism is not established.** The §8.2 rubric review and the independent Phase 3 and Phase 4 reviews have not run. The §1.1 moments have not been re-rendered at high quality since the session 2 fixes.
- **Calibration scene (§8.1):** blocked (NEEDS #13). Stone and light values are C estimates.
- **People (merged in session 3, D-090 to D-093):**
  - What changed: MakeHuman CC0 bodies in period dress replace the placeholder rigs. There are 5 built costumes with 4 LODs each; the crowd is pooled from the simulation, one instanced draw per costume per LOD.
  - Measured at high quality:
    - Grand Stair foot: people add +32 draws and +0.52 M triangles.
    - 300-person stress view: 12.33 M triangles against the 12 M budget before the mid-detail cap; about 12.1 M estimated after it, NOT re-measured.
  - Not built: impostors (nobody is drawn beyond 600 m), the wicker shield, the elite women's veil (a headcloth mantle stands in, C), cloth simulation.
  - Weak in close-ups:
    - eyelashes render solid dark;
    - the Median cap is smooth;
    - the kandys hangs like a flat cape;
    - the short beard reads as a mask;
    - the bobbed hair reads cropped;
    - seated knees balloon the skirt;
    - eye whites are greyish;
    - skin albedo is procedural (C).
  - Not yet seen after the fixes: the seated-pose ground fix and the greeting nod.
- **Speech and language (D-011, D-055, D-105 to D-109):**
  - Five lexicons now exist; Babylonian and Ionic Greek are new. There are 73 scripted lines and 372 pre-rendered eSpeak clips.
  - **Nobody has listened to the voices.** The §10 intelligibility and naturalness acceptance is open (Q-138).
  - Every line's pronunciation and usage is C. Only 10 of the 73 lines are verbatim word sequences from a text.
  - No greeting is attested in Old Persian or Elamite; Persians greet in Aramaic. Babylonian has no eSpeak voice (it uses the placeholder formant synthesiser) and no attested greeting.
  - The affirm, refuse and ration intents are called (D-168: every scripted line is reachable through exchanges.ts and visitor mode).
- **Carving (improved in session 3 by the stone agent, D-029 to D-032; still C):**
  - The sculpted columns and colossi (D-018) and the carved reliefs (D-019) are procedural reconstructions of the type, not measured carving (licensed scans: NEEDS #10).
  - Now fixed:
    - joints are 0.8 mm hairlines on a joint-free carved surface;
    - reliefs use mineral pigments as a matte film with wear, though every value is C (Q-074);
    - curls are spiral locks and the horns are longer;
    - the Gate door leaves hang at the inner end and the wall is cut in the parts;
    - the dark door frames are Munsell N3, not black;
    - Treasury members have their own materials;
    - the reliefs are verified on WebGL2.
  - Still weak:
    - the running-bond block layout is uniform (the polygonal retaining walls are not modelled, Q-071);
    - capital curls come out as noisy pits, and the lower LOD shows no curls;
    - volutes are faceted;
    - the lamassu face is rudimentary;
    - the relief colour fields still dominate at register distance;
    - no garment patterns are painted;
    - "gold" is drawn as a yellow paint film;
    - Treasury shafts are bare plaster (the colours are unknown), flagged as a placeholder;
    - the door-leaf position is inferred (Q-073).
- **Phase 5 (session 3; merged, D-021 to D-024):** `npm run soak` PASSES all eight gates for the full year, seed 1, court absent.
  - Variety: all 43,348 people measured, worst 0.099; detailed agents worst 0.031.
  - Events: 13–19 kinds a week against a floor of 8.
  - No stuck agents, stocks bounded, construction advancing every week.
  - The Phase 5 gate is still NOT passed:
    - **Activity coverage FAILS the brief's rule:** 25 simulated activities have no visible performance. They are marked placeholder/abstractOnly and are used only off-Terrace (haul, weave, brew, herd, field work, plough, reap …).
    - **About 550 people on the Terrace by day are simulated but not rendered**, counted as a PLACEHOLDER in the F3 overlay.
    - Construction geometry hook: done (D-062). The hall's columns follow the simulated drums, fluting and capitals (tested, not yet seen in a render); walls, reliefs, the yard and ramps stay at day 0.
    - **Rendered floors (≥ 300 visible, ≥ 50 close) are not met:** the crowd still builds one placeholder rig per detailed agent (135).
    - Newborns under one year (3,104) are reported, not gated (178 would fail in their first days). This is a scope decision in D-021, to be judged by the independent review.
    - **The §13.11 shadow review FAILED in round 1:** 10 of 20 people scored below 4 (REVIEWS/shadow_phase5.md).
      - The sim agent fixed the systemic causes and merged them (D-080, D-081): shared household days with three meals, children who sleep, infants nursed on demand, marriage that never takes a mother, births from each mother's history, and all 2,058 town households on real plots.
      - Soak passes all eight gates on the agent's run.
      - **Round 2 FAILED** (REVIEWS/shadow_phase5_r2.md, a sample the builder never saw): 3 of 20 people scored below 4 (a 2 and two 3s), against 10 in round 1.
        - N1: older children, especially girls of 9–13, play most of the day and do little of their age's work.
        - N2: households whose mother dies are not reorganised.
        - Also: the harvest timing conflicts with PLAIN.md; fixed-duration templates; abstract travel times ignore distance; very little is carried.
        - Round-2 fixes merged (D-082 to D-087): children's work by age and sex, bereaved households, sourced harvest windows, carried things.
      - The soak, re-run on the merged tree (with the Treasury desk moved into the scribes' room), passes all eight gates: 15.45 M person-days with no plan issue; frame cost 0.065 ms mean in real time, 7.4 ms mean and 160 ms p99 at 60× (the day rollover).
      - **Round 3 FAILED** (REVIEWS/shadow_phase5_r3.md, pick seed 53): 3 of 20 below 4.
        - One is a sampling-tool fault: a man drawn 12 days after his death.
        - The other two are real: a leader of ten walking the same 16 posts in the same order for 8 hours, and a toddler reappearing asleep at home with no fetch.
        - Also: plan and performance disagree at the posts (9 h without food); water carried that was never drawn; bread and water vanishing at the threshing floor; no kneading or baking in any of the 20 days; riding and archery for every Persian boy against PEOPLE.md's own sources.
        - 11 of 14 population people spend part of the day in placeholder activities (50 h 27 min); summer threshing is performed nowhere.
        - The sim agent is fixing these (D-135 to D-139, Q-146 to Q-149). Round 4 needs a seed other than 7, 11, 23, 37 and 53.
    - Still open: 27 placeholder activities; construction runs above E-61 (8 shafts a year vs ~5); marriages run below E-73; the town.json shares disagree with the built houses' capacity (D-081); mean frame time at 60× time went from 4.7 ms to 8.1 ms.
    - Every day-plan weight is C. The grain deliveries in the read texts cannot feed the ration groups (Q-056). Workers other than guards have no regular rest days (Q-057).
- **Phase 4b (merged in session 3, D-048 to D-052):**
  - Draw calls at quality high fell from 3,361 / 3,225 / 3,120 to 1,120 / 991 / 1,018 (Grand Stair foot, Apadana N court, Tachara S court): far relief chunks are merged into one coarse mesh.
  - All carving is procedural (C, NEEDS #10). Figure counts and placements are C, and the ledges between tiers of throne-bearers are from recollection.
  - The Tachara was rebuilt from REF-PLAN (D-130 to D-134): walls ~1.5 m, side and N rooms, 8 framed doorways, 4 windows, 10 niches, a 4 × 3 hall grid. Wall IoU against the plan went from 0.16 to 0.84. The lance-bearers stand on the jambs of the W-room doorways (one per reveal, C), rendered once at quality test. The SW room is not on the walkable grid (its 0.95 m doorway; the visitor can walk in). The Hadish S doorway, the Apadana hall doorways and the Tripylon S stair are plain for lack of a programme.
  - Added later in session 3, not yet seen in a render:
    - XPe is carved on the Hadish E and W doorway reveals: three versions stacked (flat signs in D-066; incised since D-177, branch p8-carving-s6);
    - 228 four-stepped merlons on the Grand Stair, Tachara, Hadish and Tripylon parapets (D-065, motif C on these stairs).
  - Unverified in a render: daylight through the windows, and walking through doors with people (doors are unit-tested only).
- **Phase 6 (settlement; merged in session 3, D-041 to D-044):**
  - Built: 10 town quarters (maze lanes, courtyard houses, workshops, pens), compounds, gardens, Tol-e Ajori (plan from the 2017 report, B/C), Takht-e Rustam, roads, canal and way-station. It is walkable (131 m lane walk offline) and adds only 17–43 draw calls.
  - Weak or unverified:
    - **The dusk-smoke moment did not land (measured, cause found, D-070):**
      - The terrace-w-dusk renders with and without the town differed in fewer than 1,000 pixels.
      - A debug render showed the haze and all 1,303 plumes drawn where they belong, as a 10–15 px band on the horizon from the Terrace. They were lit by the horizon radiance of the view direction, the colour of the distance behind them, so they drew as their own background.
      - Smoke now scatters the mean skylight (E/π with ground bounce).
      - A higher `mountain-dusk` view (Kuh-e Rahmat, +65 m) is added. Not yet re-rendered.
    - Several views were not re-rendered after the final fixes, and WebGL2 is untested.
    - Trees and houses are placeholders (boxes and low-poly crowns); street doors never move.
    - Every layout is C: the house type is the Babylonian courtyard analogue (Q-082).
    - **People are not connected to the houses:** the sim still sends them to an off-map "town" point, and there is no NPC walkable grid for the town.
    - The Akhor Rostam niches are not built (Q-085).
- **Phase 7 (plain; merged in session 3, D-037 to D-040):**
  - Built: the Pulvar and Kur carved into the terrain, 37 canals, field plots with a crop calendar, orchards and woodland, 33 villages, tracks, quarries, Naqsh-e Rustam (tombs, Ka'ba, cliff carve). It adds +8 to +21 draw calls and 0.7–0.9 M triangles in the three budget views.
  - **Not seen on screen:** the last three visual fixes (smooth tree crowns, colliders around the test camera, the rugged cliff and crest). The river bank close view and the May, August and January field views have never been judged with a correct camera.
  - Weak:
    - the dawn vista from the Grand Stair reads as a mottled brown-green plain; no trees, villages or rivers can be made out at 960×540;
    - from the Apadana looking north almost none of the plain shows;
    - grey dome shapes at the bases of orchard trees in village P22. **Cause found:** the far impostors (orchard rows) fade by distance per vertex, so a long row quad whose ends lie beyond r3 stands where it passes the camera (layer-toggle debug render). The fix is assigned to the tree agent;
    - the east end of the Naqsh-e Rustam cliff is probably still a sheer slab;
    - the edge of the near-crop radius is visible (18 m test, 30 m high);
    - dark specks on the ground, probably the earth material's stone chips.
  - Placeholders (flagged in F3): the Naqsh-e Rustam and Neo-Elamite relief figures are schematic silhouettes. DNa and DNb now carry their Old Persian text from the CC0 edition (D-061; not yet seen in a render); their Elamite and Babylonian versions are not carved.
  - Every placement is C (Q-076 to Q-080); the rivers follow their modern courses. Qadamgah and the 18 "possible" sites are not built.
  - The out-of-world map now has town and plain scales (Z), drawn from what the world builds (not yet seen in a render).
- **Trees (D-120 to D-123; session 3, trees agent; merged from branch worktree-agent-a1ae071e0ac078512):**
  - **Weak or unverified, read first:**
    - every species form value is C (BOTANY-GEN, recalled);
    - poplar and cypress forms are open (Q-170, Q-171); orchard shares and colours are C (Q-172, Q-173);
    - not rendered at high quality: the budget views, TRAA dithering and the r3 match under TRAA (renders cancelled at session end);
    - the town garden view (plain.spec `garden-paradise`) has never been rendered;
    - the final state (leaf tilt on LOD0 only) is unrendered, but it is the union of two rendered states;
    - big plane crowns close up still show their leaf-cluster cards;
    - winter and cypress impostors read 12-22/255 darker than LOD1 at test quality (MSAA edge antialiasing);
    - the kit adds 1.8-2.9 s to the load.
  - Built:
    - 15 species from src/data/trees.json, generated per species (branch skeleton + 320 leaf-cluster cards, 3 variants) with a procedural leaf, blossom and twig atlas;
    - LOD0 and LOD1 in one draw each per part for all species;
    - far impostors baked on the CPU from the same model and season;
    - a mid ring of per-tree impostors to 450-1,200 m;
    - orchard rows cut per plot and per fragment: the P22 grey domes are fixed (D-121);
    - town gardens on the same kit.
  - Measured: village-p22 plain adds +31 calls / +1.36 M at test (before +26 / +1.24 M); r3 silhouette area impostor/LOD1 0.90-1.06 and summer colour within 4/255 (DECISIONS D-120).
- **Visitor mode (D-063; the e2e passes in the browser):**
  - Tested:
    - the Gate guard stops the visitor and asks, in Aramaic, for the halmi (the sealed travel document; the word is Elamite *halmi*);
    - E shows it and he is admitted;
    - the courts beyond need an escort, who comes after a 4-min wait;
    - the palaces stay closed;
    - the sealed-letter errand is answered the next morning;
    - guards recognise him on a later day.
  - All rules are C: no text describes anyone being stopped at Persepolis.
  - The guard does not step into the path: the stop is a boundary at the post. Errand steps 0 and 6 are implicit, and the town part has not been walked in the browser.
- **Moments rendered at high quality in session 3 (after the sky and cloud calibration):**
  - Too dark or wrong:
    - interiors are near black: the Apadana entered from the portico, the Hadish hall;
    - dawn read as midday; fixed by the twilight merge (D-115 to D-119, below);
    - the scribe's place was an open court. The Treasury N range is now built from REF-PLAN, with the scribes' room furnished (D-067). Rendered at test quality, the scene reads (the seated scribe, drying board, clay under a cloth, filed tablets on the bench, baskets), but the ceiling is black and the room underexposed: mean luma 40, and the red floor measures (51, 1, 1) because its green falls into the tone curve's toe. Re-check after the interior-light and exposure merges;
    - dusk smoke was not visible: the smoke drew in the colour of its own background (fixed in D-070, see Phase 6; not yet re-rendered);
    - the stair-climb view is dark;
    - trees are crude.
  - Reasonable: night on the Terrace, the Gate at dusk, the Tachara S stair.
  - **Twilight merged (D-115 to D-119).** Sun, sky and moon illuminance follow USNO Circular 171. Below +10° the dome is a spherical-atmosphere model. Exposure is adaptation-aware. The dawn moment now sits at 05:24 (sun −2.9°) and reads as a blue pre-sunrise dawn; `dawn-sunrise` (+2.5°) and `dawn-glow-e` were added.
    - **Weak or changed (the agent's own list):**
      - At high quality, the cloud layer on a "clear" day (cover 0.05) draws a broken deck across the low sky. It hides the Earth's shadow and the arch, which were verified only at test quality, which has no clouds.
      - Daytime shade is 20–30 % darker (the USNO sky/sun ratio; its slope is steeper than the IES model, Q-160): stair-climb mean luma 48.5, was 59.1.
      - Night ground lit only by the sky or moon is darker (22, was 37).
      - Exposure is a model meter, not a measurement of the frame (20 % sky weight, Q-162). At −5° the plain is nearly black under a readable sky; there is no chromatic adaptation, so twilight is strongly blue.
      - Firelight is now scaled with the sky's brightness (it assumes a lamp gives about one candle). Exposure goes above 6 in fire-dominated dusk views (gate-dusk 20.5).
      - The Belt of Venus comes out lilac-white rather than pink; its heights are model output (Q-161).
      - A pale rectangle around the brazier flame, probably TRAA, not investigated.
    - The interior-light agent (irradiance probes) is still working. The §8.2 rubric follows its merge.
- **King absent by default (D-003):** no evidence places Xerxes at Persepolis in 467. The court appears only in the C-tier "seasonal pattern" setting.
- **No primary sources reachable (B6):** SITE_SPEC is tier B/C, nothing is A, and the plan overlay compares against OSM, not Schmidt.
- **Sky, clouds and rain (D-060, D-064; rendered and measured in session 3):**
  - Sky: the dome is scaled to the skylight's irradiance, and the fog, far cloud haze, smoke and rain shafts converge to the calibrated horizon. The daytime sky is a deeper blue, and distant terrain now sits between the plain and the horizon sky in brightness.
  - Clouds: the cover was measured to be a cliff (a weather cover of 0.76 drew a solid deck; 0.3 or less drew nothing). It is now calibrated by inverting the measured curve, and distant cloud fades through the scene's own fog.
  - Rain: the curtain toward the cell measures 17 % darker than the sky beside it at 24 km. It is subtle, and the moment was moved closer (15 km).
  - The twilight and overcast values rest on the C hemisphere light.
- **Sky and bench:**
  - The Milky Way and airglow are implemented (D-047: position A, structure C) but not yet seen in a render.
  - The volumetric clouds are now seen: drawn behind all geometry (D-046). They read as soft, blurry stratocumulus smears, not crisp cumulus. A texture-based rework was in progress (not yet verified).
  - Bench numbers from session 2, and the first session 3 run, are **void**. Frames rendered outside the animation loop never advanced the node frame, so the scene pass was skipped: 1 draw call and sub-millisecond "frames". Fixed (D-047); a re-run is needed.

## Fixed / verified in session 3 (2026-09-23)
- **Full unit suite (session 3, afternoon):** 303 passed, 1 skipped, 2 failed. Both failures are CPU-time budgets (the cloud-noise volume took 4,175 ms against 3,000; crowd posing of 300 people) run under a load average of about 10 on 4 cores, with renders and five agents. Run alone, the same two files pass 21/21. The budgets are unchanged; re-check them on an idle machine.
- **Reliefs:** rendered in a browser for the first time. Under WebGPU/SwiftShader, 143 figures were generated by the worker pool (0.82 M triangles at arm's length), with no errors.
- **Step-up (D-034):** Rapier's autostep did not lift the player (measured: 0.24 m head-on, 0.12 m at 60°). The player now has an explicit step-up to `NAV.maxStep` (0.42 m) at any approach angle, covered by a regression test.
- **Walkthroughs:** the bot's waypoint tolerance was tightened. The walkthrough bot now passes all six Phase 4 areas (77 legs, including Hadish) and the Phase 3 slice (28 legs) in the browser, with no falls, pop-ins or errors. `tools/dev/botcheck.ts` runs the same bot offline in seconds.
- **Test camera (D-034):** `view()` and `teleport()` no longer land on roofs. They had landed on top of every roofed space.
- **Translation layer (D-036):** the e2e passes: XPa transliteration and glosses, map, chronicle. Each inscription panel has a pick rectangle.
- **Horizon (D-035, Q-053):** the far terrain ring is now ±71.7 km, with Earth curvature and refraction. The far skyline matches the independent SRTM profile within 0.15° in all 36 sectors, and the missing W/SW/SSE ranges are restored.
- **Phase 6/7 bookkeeping (D-033):** settlement and plain features are in the chronology, and the chronology lint is fail-closed on them. The blocklist is synced (37 entries). Q-047 is decided: the Xerxes tomb is present, façade cut (C).
- **E2E isolation:** each tree runs on its own Vite port (`E2E_PORT`), and no existing server is reused.

## Phase status
| Phase | Status | Gate |
|---|---|---|
| 0 | Research bible. The review failed, was fixed, and passed on re-review (REVIEWS/phase0.md). | **Passed with logged exceptions:** no primary sources (B6); king absent (B9); footprints single-source |
| 1 | Engine foundation: renderer (WebGPU + WebGL2), terrain rings, sky, weather, Rapier player, shell, save/load, overlay, bench, test harness | **Passed with logged exceptions:** real frame rate not measurable (REAL_HARDWARE_TODO); sky is Preetham analytic |
| 2 | Terrace greybox from the parametric generators | **Passed with logged exceptions:** footprints are OSM traces (B6); the overlay mostly checks footprints against themselves |
| 3 | Vertical slice: materials, reliefs, fire, weather VFX, audio, 65 people, speech/murmur, walkthrough bot (28 legs, re-verified session 3) | **Not passed:** rubric and independent review not run; calibration blocked; people placeholder; bench to re-run |
| 4 | Rest of the Terrace: stairs, doors, frames, corrected outlines, floors, fires, acoustics, guard posts; stair and jamb reliefs (355 figures), 11 windows, 9 niches, 22 working doors (session 3, D-048 to D-052); far relief chunks cut draws to ~1,000 | **Not passed:** Phase 4 review not run; carving C (NEEDS #10); Tachara rebuilt from REF-PLAN with its lance-bearers (D-130 to D-134; N and E rooms unrendered); XPe and stair crenellations added, D-065/D-066, unrendered; windows never seen lit through |
| 5 | Two-tier simulation of 46,590 people: events calendar, town life, rota, construction state, memory, persistence; soak PASSES (session 3); birds and jackals visible (D-054) | **Not passed:** activity coverage (25 placeholders), rendered floors, unrendered Terrace workforce, construction geometry, shadow review pending |
| 6 | Settlement built (session 3): quarters, houses (1,456 homes / 7,830 people), workshops, gardens, Tol-e Ajori, roads; lints pass, layout sourced and tiered (C) | **Gate items met on paper (lints pass; layout sourced and tiered)**; smoke moment and people-to-houses link open |
| 7 | Plain built (session 3): rivers, canals, fields, crop calendar, orchards, villages, quarries, Naqsh-e Rustam; horizon fixed (D-035); +8–21 draws | **Not passed:** last fixes unrendered, dawn vista weak, relief figures and DNa/DNb schematic or textless, review not run |
| 8 | Session 6: layer (every line reachable, the version looked at, lint over audio/data/carved signs: D-167, D-168), music from performers and audio occlusion (D-178), writing on objects (D-179), carved Old Persian = the CC0 ARIo sign-by-sign edition (0 differences over 5,276 positions and 1,029 dividers; D-184), incised; Elamite and Babylonian in the edition's lines, the scribe's omissions not carved and restorations tiered C (D-184 extension); voices re-rendered through libespeak-ng with norm pitch, word stress and contours, the machine pitch and contour thresholds met (D-185); licences of the bundled lexical sources checked, CC BY-SA allowed with credit, the unlicensed EWB data removed from the lexicon (D-192); five lexicons, 73 lines, 372 voice clips | **PASSED at re-review round 3** (REVIEWS/phase8_r3.md: no open CRITICAL). Open MAJORs: M1 (El/Bab omissions and restoration tiers) and M2 (records) fixed on `p8-majors`; M6 (licences) decided (D-192) with names.json's 484 Elamite names from the unlicensed EWB base still open (Q-294); M3 the §10 human rating of the voices not done (H8; machine phone recovery did not improve; the Babylonian formant voice and the murmur not re-tuned); M4 music visuals placeholder, no chant or pipes (B20); M5 tablets' text placeholder (B18); translations blocked by licence (B17a, NEEDS #14); nothing heard or seen on a GPU; Now view and photo mode not started (stretch) |
| 9 | Not started | — |
