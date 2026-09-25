# Independent review: Phases 6 and 7 (settlement; plain and horizon)

Reviewer: an independent subagent that did not see the build process. Date: 2026-09-25. Tree: `5f37dbb`, branch
`claude/amazing-fermi-40ds7j`, clean working tree. D-227 (town at dusk, stair foot) is **not merged**: it exists only in the
worktree `.claude/worktrees/agent-affb6da328ad32725` (commits `ee52171`, `6a0a2b9`). It is cited below only where its one
stats file corroborates a main-tree number.

**Gates (§14):** Phase 6 "Lints pass; layout sourced and tiered". Phase 7 "Lints pass; proxy performance at the plain vista".
**Rule for passing (§13.9):** no open CRITICAL finding.

**Read:** PERSEPOLIS_BRIEF.md (all of it), CLAUDE.md, PROGRESS.md, BLOCKERS.md, README.md, REAL_HARDWARE_TODO.md;
DECISIONS D-033, D-037 to D-044, D-081, D-122, D-149 (plain rows), D-190 (plain rows), D-220, D-223 (D-227: worktree only);
research/SETTLEMENT.md, PLAIN.md, LANDSCAPE.md, ANACHRONISM_BLOCKLIST.md; OPEN_QUESTIONS rows Q-004, Q-006, Q-013, Q-038,
Q-047 to Q-054, Q-076 to Q-085, Q-503, Q-520 to Q-526; src/data/settlement.json, town.json, plain.json, town_plots.json,
trees.json, chronology.json, blocklist.json; tools/lint_chrono.ts; src/world/settlement/*, src/world/plain/*,
src/world/trees/* (targeted), src/terrain/terrainMesh.ts, src/core/settings.ts, src/ui/overlay.ts.
**Looked at (Read tool):** shots/plain-stair-dawn-plain-after-high-webgpu-d223.png, plain-stair-noon-plain-after-high-webgpu-d223.png
(and two crops of its horizon), plain-rahmat-west-pm-after-high-webgpu-d223.png, moment-town-smoke-dusk-after-webgpu-d223.png,
moment-town-smoke-dusk-webgpu-d220.png, moment-town-smoke-dusk-rahmat-webgpu-d220.png, and the worktree's
moment-town-smoke-dusk-rahmat-nosmoke-webgpu.png (to identify a dark column in the Rahmat frame: it is a cloud, present
without smoke too).
**Ran:** `npm run lint:all` (OK); `npx vitest run` plain, settlement, settlement_build, plain_d223, hills_d223 (55/55) and
trees, landscape, ajori_panels (24/24) with `--maxWorkers=1`; `npx tsc --noEmit -p .` (clean); three node scripts in the
scratchpad (terrain triangle count per quality preset at the D-223 camera positions; the town plan's plot and capacity
census against town_plots.json; per-feature tier and uncertainty listing).

---

## CRITICAL (open)

### C1. The top quality preset, "Ultra (full target)", draws the terrain coarser than "High"; the quality scale of the terrain LOD is inverted (§3.5)
- `src/core/settings.ts:41-45`: `terrainLodBias` is test 0.35, low 0.5, medium 0.75, high 1, **ultra 1.5**.
- `src/terrain/terrainMesh.ts:108` multiplies both LOD thresholds by the bias (`err/d <= ERR_RAD * lodBias`,
  `spacing/d <= SPACING_RAD * lodBias`), so a larger bias allows coarser steps. The comment at `:102-103` says the multiplier
  is meant "for lower quality settings", and `:14-17` documents ERR_RAD as "≈ 1.5 px at 1440p". The values run the other way:
  at ultra the error allowed is 1.95 mrad (≈ 2.25 px), at low 0.65 mrad.
- **Measured (node, `TerrainMesh.update` at the D-223 camera of stair-dawn-plain, all chunks = what `__parsa.stats().terrainTris`
  reports):** test 9.91 M, low 8.61 M, medium 6.46 M, **high 4.62 M, ultra 3.29 M** triangles. My high figure equals the
  terrainTris of the only surviving plain-stats.json (4,620,032, D-227 worktree), so the count is the one the build reports.
- `src/ui/shell.ts:102` labels ultra "Ultra (full target)"; `REAL_HARDWARE_TODO.md:9` (H4) states the terrain target as
  "height error ≤ 0.0013 rad", and `REAL_HARDWARE_TODO.md:2` tells the user to benchmark at `quality=ultra`, where the
  threshold is 0.00195 rad. The "Low" preset for weaker hardware draws 2.6× the terrain of the top preset.
- **Why CRITICAL:** §3.5 requires the full target to stay available as the top setting and forbids quiet reductions; the top
  setting silently runs the terrain below its own documented target, and nothing logs it (not in BLOCKERS or DECISIONS).
  It also bears directly on the Phase 7 gate: terrain is ~4.6 M of the 5.8–7.5 M triangles of every D-223 plain-vista frame,
  and those frames were measured at high, so the proxy was never measured on the setting the brief calls the target.
  With the bias corrected (ultra ≤ 1), ultra's terrain grows past high's 4.6 M. The frame will probably still fit under
  12 M (it has 4.5–6 M of headroom), but that has to be measured.
- **To close:** invert the bias so that ultra ≤ high ≤ … ≤ low (or divide instead of multiply), re-measure stair-dawn-plain,
  stair-noon-plain and rahmat-west-pm at `quality=ultra`, and put those numbers in README and REAL_HARDWARE_TODO HP7. The code
  is in Phase 1's scope, but the Phase 7 gate cannot pass until the vista is measured at the full target.

No other CRITICAL finding. **No chronology or anachronism breach was found** (see the table), **no gate text is claimed
falsely** (PROGRESS marks Phase 6 "gate items met on paper" and Phase 7 "Not passed"), and the PROGRESS statements that the
evidence contradicts all *understate* the build (M5). None of them overclaims.

---

## MAJOR

### M1. The Phase 7 proxy evidence is incomplete and mostly not on disk
- **Memory is not measured at the vista.** §6 lists memory among the proxy budgets. README.md:29-30 still gives "JS heap ~125 MB
  after boot (Phase 1); not re-measured with the full population" and "GPU memory … tracked via counts" with no number. The
  plain adds ~43,000 line trees, 88,000 orchard rows, 3,983 village compounds, rivers and the town, and has never been
  measured against the 1.5 GB / 3.5 GB budgets.
- **The stats file README cites is gone.** README.md:27 cites `shots/plain-stats.json`. The main tree's `shots/` holds no
  plain-stats.json (shots/ is gitignored), and the D-223 figures quoted for the gate (stair-dawn-plain 425 draws / 7.51 M,
  stair-noon-plain 402 / 6.12 M, rahmat-west-pm 424 / 5.83 M, naqsh-200m 131 / 2.58 M) exist only as prose in DECISIONS D-223.
  The only plain-stats.json on disk is in the unmerged D-227 worktree: stair-noon-plain 406 draws / 5.89 M, plain +12 / +0.88 M,
  town +13 / +0.40 M. That file is consistent with D-223, and its terrain count matches my node count exactly, so I accept the
  D-223 numbers as roughly right. They are still not reproducible from the main tree.
- **README's budget row is stale** (README.md:27-28: "session 7", 408 / 557 / 647 draws and 7.47 / 8.57 / 8.65 M) and not
  updated to D-223.
- **Verdict on the proxy, apart from C1:** at quality high, draw calls (≈ 400–425 of 3,000) and triangles (5.8–7.5 M of 12 M)
  are met with wide margins at the three plain-vista views. People are drawn in those frames, and the dawn view with the whole
  population is 6.74 M (B13). The vista seen from the hillside above the Terrace is the exception: 12.52 M with people and
  11.97 M without (BLOCKERS B13, logged as over budget).

### M2. The plain's own Phase 7 limit is exceeded at village P22 at high, and nothing logs it as a blocker
- D-040 set the plain's share at "≤ 150 calls, ≤ 2 M triangles". At quality high, village-p22 is +2.338 M before D-149,
  +2.564 M after it, and still +2.560 M in D-190 (DECISIONS lines 2117, 2122, 3288). D-149 says so ("further over now").
- There is no BLOCKERS entry, README says nothing, and PROGRESS's Phase 7 block quotes only the quality-test figure
  (PROGRESS.md:431: "+31 calls / +1.36 M at test").
- `tests/plain.test.ts:237` asserts the ≤ 2 M limit "before culling" on the headless meshes. It counts no shadow passes, so it
  passes while the browser measurement fails. The whole frame at P22 (4.69 M) is well under 12 M, so this is a sub-budget
  breach, not a frame-budget breach. §3.5 still requires the numbers in BLOCKERS.md.

### M3. Tiers inflated against the data's own rule "tier = lowest of existence and position" (§3.2; F3 shows the inflated tier)
- `settlement.json` `pw_area_b_craft` is tier **B** at ±250 m. SETTLEMENT.md §1 says "activity B; position C", and
  `town.json` `craft_zone` is also B.
- `plain.json` `quarry_majdabad` is **B** although its own note says "Accuracy 10 km (C position)", and the build moves it
  to the nearest rock. `qadamgah` is B at ±3 km (not built). `steppe` and `woodland` are B, but their rules and cover are C by
  their notes.
- `src/world/plain/quarries.ts:38` tags the single quarries mesh with `feature('quarry_sivand')`, so F3 shows tier B on the
  Majdabad workings too. Only the note text says C.
- Every row has a tier, so the gate words "sourced and tiered" hold, but these tiers are higher than the files' own convention
  allows.

### M4. Placeholders named in PROGRESS are not flagged in the dev overlay (§3.7)
- PROGRESS.md:397 says "Trees and houses are placeholders (boxes and low-poly crowns); street doors never move."
- The town's house walls, roofs and doors are `mud.box` slabs (`src/world/settlement/build.ts:168-190`; doors "do not move in
  the town yet", :186). No settlement `Desc` sets `placeholder` (`build.ts:21`, 79, 154, 201): F3 never shows
  `[PLACEHOLDER]` on a house (`src/ui/overlay.ts:22`).
- Either the houses are placeholders, and F3 must flag them, or they are the intended C reconstruction, and PROGRESS must say so.
  The trees half of the sentence is stale: D-122 put the town trees on the tree kit and removed the flag.

### M5. The builder's account of Phases 6 and 7 is stale in several places the evidence contradicts (all understatements)
- PROGRESS.md:399 says "People are not connected to the houses: the sim still sends them to an off-map 'town' point, and
  there is no NPC walkable grid for the town". **Contradicted:** D-081 puts all 2,058 households on real plots of
  town_plots.json, `src/world/settlement/walk.ts` exists, and B11 counts people drawn in a lower-town lane.
- PROGRESS.md:494 (Phase 7 row) says "relief figures and DNa/DNb schematic or textless". DNa and DNb carry the Old Persian text
  since D-061 (`src/world/plain/naqsh.ts:334`). The figures are still schematic.
- `src/data/town.json` `_meta.status` says "The settlement geometry is Phase 6 and does not exist".
- research/PLAIN.md:8 says the far ring "truncates" the skyline (fixed by D-035). PLAIN.md:84 says "chronology.json currently
  says absent" for the Xerxes tomb, which is present since D-033.
- research/SETTLEMENT.md:13 says storehouses and stables are "Not placed" (one of each is placed, D-043).
  SETTLEMENT.md:63 gives "3,000–6,000 in the town", against Q-038 and PEOPLE.md:295 (5,000–10,000, working value 7,000) and the
  built capacity of 7,968 (node census: 1,456 homes, the same as `town_plots.json`).
- None of these overclaims, which is why they are MAJOR rather than CRITICAL. They are the first thing a reader of the
  Phase 6/7 status sees, and they are wrong.

### M6. No settlement render exists; the town and the plain's seasons are unverified on screen
- `shots/settlement-*.png` and `shots/agent-plain/` do not exist. The only frames that show the town are
  plain-stair-noon-plain-after (walled compounds and blossoming orchard crowns at ~1–2 km, readable only in a crop) and the
  dusk moments.
- In `moment-town-smoke-dusk-after-webgpu-d223.png` and `-webgpu-d220.png` the town cannot be seen: a dark plain under a
  twilight sky, with no lamp or hearth point. The §1.1 moment "smoke rising from the town at dusk as lamps are lit" does not
  land. PROGRESS and D-223 say so; D-227, unmerged, is working on it.
- The field views for May, August and January, the Pulvar bank, village P22, the garden and Naqsh-e Rustam at 200 m have no
  render in the current tree. The Phase 7 deliverable "seasons across the year" has been checked in node only.
- None of this is a gate item for Phase 6 or 7. It is recorded because the review brief asked for these renders and they
  cannot be checked.

---

## MINOR

1. **Lint coverage of Phase 7 is thinner than Phase 6's.** `tools/lint_chrono.ts` checks every *generated* town item fail-closed
   against a row, but the plain only at feature level (`:42-53`). The generated villages, canals, tracks, trees and crops are
   checked for anachronisms only by a mesh-name test (`tests/plain.test.ts:266-268`: substrings such as "artaxerxes",
   "sasanian", "qanat"). Nothing anachronistic was found (see the table), but the check is weak.
2. `lint:chrono` reports "0 registered assets" (`src/data/assets.json`). The asset-level period/src/tier check is vacuous, and
   the phases rely on the feature/row checks.
3. **The modern reservoirs are not handled in the terrain.** `tools/build_terrain.py` has no reservoir or dam step. The
   blocklist's `modern-dams` covers "Doroodzan … Sivand dam and reservoirs", and the far ring (±71.7 km) reaches the Doroodzan
   area. I did not confirm whether a flat reservoir surface or a dam embankment survives the bare-earth filter, or whether it can
   be seen. Log it as an open question.
4. **The stair-dawn vista is a dark, near-featureless sheet with a straight light road line**
   (`plain-stair-dawn-plain-after-high-webgpu-d223.png`). At noon the near plain is flat
   (`plain-stair-noon-plain-after-high-webgpu-d223.png`). D-223 admits both. This is for the rubric, not the gate.
5. Rows marked present in 467 that are not built (`akhor_rostam_niches`, `qadamgah`, `dam_sang_e_dokhtar`, `bard_burideh`)
   explain why in their notes or lie outside the extent. The Akhor Rostam date conflict is logged (Q-049, Q-085).
6. The rivers follow modern OSM courses (C, logged). CORONA and Schmidt's aerials, which §5.2.2 names for restoring
   watercourses, are blocked (B6, NEEDS).
7. The town.json quarters (7) and villages (35 unlocated) disagree with the built settlement (10 quarters) and the plain
   (33 unlocated villages). This is logged as Q-503 and in D-081.

---

## What I verified, and how

| Item | How | Result |
|---|---|---|
| Lints pass (both gates) | `npm run lint:all` | OK: chrono (78 structures, 2,709 parts, 98 blocklist terms; settlement build 24 rows, 5,646 generated items), lang 26/26, activity 0 placeholders, music OK |
| Types | `npx tsc --noEmit -p .` | clean |
| Unit tests in scope | vitest on plain, settlement, settlement_build, plain_d223, hills_d223, trees, landscape, ajori_panels (`--maxWorkers=1`) | 79/79 pass |
| Every settlement/plain feature has src + tier + chronology row | node listing of settlement.json (22 features, 24 town_elements) and plain.json (34 features); lint_chrono.ts:42-53, 57-90 | all have tier ∈ {A,B,C}, resolvable src keys, chrono rows; presence agrees with chronology.json. Tier inflation: M3 |
| Every generated town item traces to a present row and feature | lint_chrono.ts:69-88 (fail-closed), run | 5,646 items OK; nothing generated within 80 m of the absent Frataraka site |
| F3 shows tier/source for town and plain meshes | build.ts:79, 125-132, 154; plain/data.ts:14; villages.ts:187; quarries.ts:38; naqsh.ts:307-343; overlay.ts:20-22 | per-face tier/src/note in the town; plain meshes tagged; Naqsh relief figures and inscription panels flagged PLACEHOLDER. Houses not flagged (M4); Majdabad shows B (M3) |
| PROGRESS "1,456 homes / 7,830 people" | node: `buildTownPlan()` vs town_plots.json | 1,505 plots in both; 1,456 homes; capacity 7,968 (= 7,830 town zones + 138 hamlet/way-station, D-041) |
| Nothing later than 467 at Naqsh-e Rustam | naqsh.ts header and build; chronology `nr_later_tombs` false, `nr_sasanian` false; plain.json `naqsh_e_rajab`, `istakhr` and 5 later sites present_467 false; plain.test.ts:266 | Darius I tomb, Xerxes tomb (façade cut, uninscribed, C, Q-047), Ka'ba (C, Q-006), intact Neo-Elamite relief only. No Sasanian relief, later tomb, "fire altars" or Naqsh-e Rajab |
| Blocklist terms in the plain and settlement | blocklist.json rows (qanat, date palms, modern dams/plain, Frataraka, Istakhr, later sites, Spring Cemetery, later NR tombs); grep of src/world/{plain,settlement,trees} and trees.json for palm, eucalyptus, pine, rice, cotton, citrus, maize, sugar | none present. plain.json crops: rice `grown:false`, dates `grown_on_plain:false`. Tree species: plane, willow, poplar, tamarisk, mulberry, fig, apple, pear, pomegranate, oak, almond, pistachio, cypress, olive (gardens only), vine. No qanat (wells only, Q-052). Three blocklist matches exempted with written reasons (`blocklist_ok`: fence wall, "N of the Frataraka complex", the Naqsh-e Rajab gap road) |
| Tol-e Ajori standing in 467 | settlement.json, SETTLEMENT.md §1, D-042, Q-004/Q-051 | modelled standing, old and unrepaired (C). Destruction date not retrieved; logged |
| Conflicts logged in OPEN_QUESTIONS (§3.3) | grep of the 22 Q-rows listed above | all present |
| Proxy performance at the plain vista (Phase 7) | DECISIONS D-223 measured table; the worktree plain-stats.json; node terrain triangle count per quality | at high: ≈ 400–425 draws / 5.8–7.5 M of 3,000 / 12 M, met. Not measured at ultra, where the terrain LOD is inverted (C1). Memory not measured; stats file absent from the main tree (M1). Plain sub-limit over at P22 (M2) |
| REAL_HARDWARE_TODO entry for the vista (§6) | REAL_HARDWARE_TODO.md:13 (HP7) | present. H4's stated threshold is contradicted at ultra (C1) |
| Renders in scope | Read tool on the seven PNGs listed above | plain vistas and Kuh-e Rahmat render without errors; the dark "column" in the Rahmat dusk frame is a cloud (also in the no-smoke frame); the pale crowns on the noon horizon are blossoming orchard trees on day 0 (17 April), not tents; the town at dusk is invisible (M6) |
| Village, canal, tree and crop tiers | plain.json, trees.json (15 species, all C, source BOTANY-GEN "recollection only") | honest C, with recollection disclosed |

## Verdict
**FAIL**: one open CRITICAL (C1: the top quality preset draws the terrain below its own target, and the plain vista's proxy
was never measured on it).

- **Phase 6 ("Lints pass; layout sourced and tiered"):** substantively met. Lints pass, and every layout row and generated item
  is sourced and tiered, with the tier inflation of M3 to correct.
- **Phase 7 ("Lints pass; proxy performance at the plain vista"):** met at quality high for draw calls and triangles.
  It can be passed once C1 is fixed and re-measured at ultra, with memory measured and the stats file kept (M1), and the P22
  sub-limit logged in BLOCKERS (M2).
