## D-277 instruments: final report (branch `worktree-agent-a39211010cf42e186`, not pushed)

I built the area registry, the generated board and Tier 0, plus event kinds and the budget file. T-A6 and T-A6x now have evidence written by the tool, and both pass.

### Broken, placeholder or unverified (read first)
- **Nothing here was checked on screen.** My render budget was 0, so everything is node-side.
- **T-A6's 100 % is true by construction.** The classes (near ground, plain sectors, far land) tile the whole terrain, so every walkable point is always in some area. The honest figure is the unique share: only 0.15 % of the 20,459 km² envelope is judged area by area. Within 7 km of the Apadana that share is 14.9 %. The test guards against this partly: it re-checks cover on 6,000 seeded random points it judges walkable itself, and it requires every Terrace building, town site and village by name.
- **The world's edge is walkable (Q-740).** The flood fill reaches 7,146 cells on the far ring's outer edge, and nothing stops a walker going off the heightfield at ±71,680 m. D-240 says the edge must be made unreachable by real terrain; that is not built. This is a hard break.
- **Roofs have no collider (Q-742).** The envelope's upward ray finds no roof anywhere, so interiors come only from the roof parts in buildTerrace. The Hall of 100 Columns has no roof part at all, so it is classed as open ground, and at 0.7 ha it escapes the 0.25 ha interior limit. Unclear whether it should be roofed in 467.
- **Floors the envelope cannot reach (Q-741, candidates only).** These are floors at the same level as reached ground within 10 m:
  - town quarter q_n1: 22 % of its standable ground;
  - the other quarters: 5–7 %;
  - villages: 4,594 of 291,532 cells;
  - terrace:tachara:open: 5 of 6 cells.
  They could be sealed rooms or the 0.5 m fill missing narrow doors. Coordinates are in `tier0.json` under `unreached_examples`.
- **Tier 0 detector findings, not yet checked on screen:**
  - On the Grand Stair, 33 % of cells show the collider floor more than 5 cm off the drawn surface, worst 0.76 m.
  - 43 cells on the transect have a collider floor with no drawn surface.
  - 47 areas can see a PLACEHOLDER record within 200 m: mostly the inscription stones, Tol-e Ajori's body and glaze, and the Naqsh-e Rustam reliefs. No untiered record was found.
- **What Tier 0 does not cover:**
  - The drawn-vs-collider check covers only the terrain and the Terrace, not the town or the villages.
  - Meshes the game builds only near the camera are read at whatever level the offline world holds.
  - No threshold row names `tools/dev/tier0.ts`, so its output carries no id and moves no board cell. I did not change any tool field.
- **What the envelope does not model:** doors are treated as open (a sealed store counts as walkable); people, animals and tree trunks are not obstacles; river corridor meshes are only present inside architecture patches. For the 80 m cells of the far ring, area sizes are sampled at the cell centre, so they are approximate.
- **The board: 2 of 171 ids PASS** (T-A6, T-A6x). 143 are NOT-MEASURED, 17 are STALE and 9 are SUPERSEDED. Every earlier evidence file lacks a dependency hash, so each reads STALE. The illusion-break column is NOT-MEASURED because there is no T-H0 or T-H0s evidence yet.
- **Tier 1 budget (Q-743).** With 167 unique areas, one Tier-1 rotation is 10,340 views. Holding T-B3 needs 2,585 test views a session, about 205 render-lane hours at the measured 285 s per view. T-B3 will read FAIL.
- **Not measured, left null in `gates/budget.json`:** t_id, t_ultra, and the bot throughput of the `?norender` page. Node offline bots run at 6.6 bot-hours per core-hour (session-9 walker logs).
- **Change for everyone:** `tests/coverage_board.test.ts` is now in `npm run guards` (about 1 s, no timestamps in the file). Any source change that makes fresh evidence stale fails the build and test:fast until someone runs `npm run board`. The pre-commit hook is unchanged.

### What was built
- **`tools/dev/lib/envelope.ts`**: the walkable envelope.
  - Terrain: each ring at its own resolution, a triangle walkable when its slope is 42° or less, reached from the spawn across the ring seams.
  - Architecture: a 0.5 m flood fill wherever a static non-terrain collider stands, found by listing every collider in the physics world (not the nav grid). It uses the player's step (0.42 m), 1.7 m headroom and knee/head rays.
  - Result: 92 patches, 16.4 km² reached. The envelope is cached in `shots/cache/envelope.bin` (gitignored, 348 MB).
- **`tools/dev/lib/walkable_world.ts`**: the offline world with every town collider added and all 37 villages built.
- **`tools/dev/areas.ts` → `data/areas.json`**: 388 areas, 167 of them unique.
  - Terrace: each building's roofed and open ground (roofed ground over 0.25 ha split on a 50 m grid), and the courts split by nearest building.
  - Town: 29 sites; the town and garden zones outside the sites, in tiles of at most 900 m.
  - Plus 11 named sites, 8 court camps, 37 villages, 15 Pulvar reaches and the approach.
  - The transect is an overlay: nearest village → canal crossing → quarter q_w1 → stair foot → Grand Stair → Gate → Apadana and its court.
  - Three classes: near ground, plain sectors, far land.
  - Buildings are read from buildTerrace, not listed by hand, so D-276's new rooms will make the test fail until the registry is regenerated.
- **`tools/dev/lib/areas_geo.ts`**: the registry's geometry and point-to-area lookup, for the other tools to import.
- **The board:** `coverage_report.ts --board-only` builds `COVERAGE.md` from evidence files only, with a cell for every threshold id. Statuses follow §5 (NOT-MEASURED, STALE, FAIL-EXCEPTION, SUPERSEDED, plus INSUFFICIENT), with evidence commit, session age and dependency hash, and a per-area table. The old `boardAll` is kept only because `tests/coverage.test.ts` uses it. `coverage_dep.ts` gains `depHashFor(tool)`.
- **`tools/dev/tier0.ts`**: 813,966 cells (5 m, 4 m on the transect) over all 167 unique areas and the transect, in 53 s after a 30 s world build, with no sampling needed. Per area it reports: whether standable floors are reached, collider vs drawn height, placeholder and untiered records in view, and repetition in the view cone. Output: `REVIEWS/evidence/s10-instruments/tier0.json`.
- **`data/event_kinds.json`** (57 kinds, 22 rare-tail, 15 place classes, 288 states) and **`gates/budget.json`**, each generated by a script in `tools/dev/lib/`.
- **Tests:** `tests/areas.test.ts` checks T-A6x, T-A6 both ways, the Terrace building by building, every site and village, and the never-shrink rule against git history. `tests/coverage_board.test.ts` regenerates the board and checks the status rules on made-up evidence.
- **Records:** D-277 in DECISIONS; Q-740 to Q-743 in OPEN_QUESTIONS. B88–B90 were not used.

### Tests run
- `tests/areas.test.ts` 6/6 and `tests/coverage_board.test.ts` 3/3 pass, both before and after the final commit.
- `npm run guards` (ratchet, scope, defaults, board): 22/22, 1.4 s.
- `tsc --noEmit`: clean.
- `tests/coverage.test.ts`: 1 failure. The sampler output no longer matches the committed `tests/data/coverage_points.json`. None of the sampler's inputs differ from 71f622d, so this looks like it predates my work, but I did not re-run it at the base commit to confirm.
- `bench-reports/` was checked out before each commit.

### For HANDOFF.md's Tools section
- Registry: `npm run areas` (= `tools/dev/cpu_slot.sh npx tsx tools/dev/areas.ts`, about 15 min, about 4 GB) writes `data/areas.json`, the T-A6/T-A6x evidence and the envelope cache.
- Board: `npm run board` (= `npx tsx tools/dev/coverage_report.ts --board-only`, about 1 s) writes `COVERAGE.md`.
- Tier 0: `npm run tier0` (= `tools/dev/cpu_slot.sh npx tsx tools/dev/tier0.ts [--areas id,prefix*] [--budget-min 30]`, about 1.5 min with the cache, plus about 11 min if the cache is stale) writes `REVIEWS/evidence/s10-instruments/tier0.json`.
- Also: `npx tsx tools/dev/lib/event_kinds.ts` and `npx tsx tools/dev/lib/budget.ts`.
- Any edit under `tools/dev/lib` or `src` makes T-A6/T-A6x STALE: run `npm run areas`, then `npm run board`.

### Branch and commits
`worktree-agent-a39211010cf42e186`:
- `cb24406`: the code (tools and tests).
- `9c4bb6a`: the generated registry, evidence, board, Tier 0 results, event kinds, budget, and the D-277 / Q-740..743 records.
