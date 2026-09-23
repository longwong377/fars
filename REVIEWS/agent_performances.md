# Agent report: activity performances (D-142, session 4)

- **Agent:** performances agent (Claude Opus 5.5).
- **Branch:** `worktree-agent-a3102317f93d5f984`, from `claude/amazing-fermi-40ds7j` at be6db72. Not pushed, not merged.
- **Task:** give each of the 28 abstract-only activities a real, evidence-honest performance: a pose cycle, carried tools, work objects at the place, animals and sounds. Then remove every placeholder flag and make the lint fail if one comes back.

## Read first: what is still placeholder, weak or unverified

1. **Not yet seen in the world.** The crowd renders only the Terrace's detailed agents, and none of these 28 activities happens on the Terrace. Until the abstract population is rendered (the crowd rework, another agent), the performances are seen only in:
   - the human lab: `tests/e2e/perf.spec.ts`, WebGPU;
   - the node contact sheets: `tools/dev/perf_preview.ts`.
2. **Animation quality is hand-authored, not motion capture (C).** This is the same PLACEHOLDER caveat that anim.ts carries for every cycle: brief §9.3 asks for photoreal motion. The cycles are built from hand and foot targets with IK, so tools meet the soil, the stalks, the fell and the pot. Tempo, weight shift and secondary motion are simple.
3. **Two GPU faults were found only by the browser renders.** Both are fixed and re-rendered clean (see "Renders"). The node previews could not show either, because they deform on the CPU in the animal's own frame.
   - **Legs and heads flew across the field.** three.js applies the instance matrix before a material's `positionNode`. Fixed in 140c042.
   - **Pipeline creation failed** for the carried props and the animals: they exceeded WebGPU's 8 vertex buffers. Fixed in 971001c; a unit test now bounds the buffers.
   - The fixes have been verified only in the lab. They have not been verified in the world, where these performances do not appear yet (item 1).
4. **No ground query for work objects and animals** (Q-199). They sit at the performer's height. On a slope, a flock spread over up to ~10 m can float or sink.
5. **Picking reaches into the air** where no tree or vine stands at the performer's spot. The lab has no trees. In the world, whether an orchard or vineyard spot has a tree over it is not checked.
6. **Riding is not performed** (train = archery only; Q-195). There is no mounted rig.
7. **carry_bier:** the sim schedules the walk out as `walk`, then 1.5 h of `carry_bier` at the abstract place `outside` (Q-196). The bearers carry the bier where they stand, not along the road out. The fix is the sim's owner's.
8. **Evidence gaps, all logged:**
   - loom type C (Q-190); the settlement's upright loom fitting contradicts its own "ground loom" note (Q-191, not my file);
   - shearing with a knife (Q-192);
   - cattle not in population.json, so the ox is C (Q-193);
   - no animal bells (Q-194);
   - the lan offering's commodities (Q-197);
   - the fat-tailed sheep NOT SEEN (Q-198).
9. **The kiln itself is not drawn** at `craft /kiln/`: the stoker has brushwood and the fire sound. The kiln is a settlement fitting at the craft zone, and the lab does not have one.
10. **Budgets at top quality in the world are not measured.** The performances do not appear in the world yet (item 1). Measured instead:
    - node: 300 performers;
    - lab: quality test, WebGPU.
11. **Animals walk with one lateral gait** at every speed. The graze is one neck pitch plus a small bob. The lie is computed per build but used by no performance (the sheep being shorn is rolled on its side instead).
12. **The people e2e "people at work" failed in its full form.** It timed out at the second of seven screenshots (600 s budget; about 4 min per new view under SwiftShader on the shared cores). A two-view re-run passed, with all its counts held. It was not compared against the base commit, so this is not proven to be environmental.
13. **Timing tests failed in both full-suite runs** under load 8-10. They are the crowd CPU median, the humans runtime posing budget, the cloud noise build and the simulated-day timeouts. All passed when re-run alone at load ~3.4.

## What was built

Each module below has its tier and evidence in its notes. The notes appear in the dev overlay (F3) through `userData`.

| module | what |
|---|---|
| `src/people/poseKit.ts` | Trunk FK identical to the rig's retarget, on reference body m03 (within 1.2 mm). Analytic two-bone IK for arms and legs. `gripIK` iterates on the palm point. |
| `src/people/workAnims.ts` | 36 work cycles, with prop hints (tip, at, show, ip) and root paths (plough furrow, thresher turning, archer side-on). |
| `src/people/anim.ts`, `humanRig.ts` | Route the cycles. The standing work cycles are planted. |
| `src/people/props.ts` | 32 carried kinds in two instanced unions (per-instance kind and parameter), placed by grip rules. |
| `src/people/workObjects.ts` | 32 work-object kinds, one instanced mesh per kind, placed at the sim's spot, following the performer, or shared per place or group. |
| `src/people/animals.ts` | Sheep, goat, ox, donkey and horse, rigged in the vertex shader (walk, graze, tail, lie), with closed-form placement. |
| `src/people/activities.ts` | A performance and variants for every activity. Variants are chosen from the plan's reason or by a seeded share. |
| `src/people/activityLint.ts`, `tools/lint_activity.ts` | Fails on any placeholder or missing performance. Runs in `npm test` and in `npm run lint:all` (`lint:activity`). |
| `src/people/crowd.ts` | Resolves and caches performances; runs path cycles and both prop slots; places work objects and animals per frame; runs IK passes by distance; emits bleats. The pool and attach logic is untouched. |
| `src/audio/soundscape.ts` | Procedural work one-shots. |
| `src/dev/humanLab.ts` | `stations()` and `at()`, for the performance sheet. |

## Activity → performance

"—" = none. Tiers are the performance's; the evidence is in each note (activities.ts, PROP_NOTES, WORK_NOTES, ANIMAL_BUILD).

| activity (variant: when) | cycle | carried | work objects | animals | sound | tier |
|---|---|---|---|---|---|---|
| **haul** | haul | rope | drum_sledge | — | — | C |
| ↳ /earth/ | pass | basket_both | — | — | — | C |
| ↳ /brick/ | pass | brick | brick_stack | — | — | C |
| **mould_brick** | mould | mould | mud_heap, brick_field, jar | — | mould | C |
| **lay_brick** | lay | trowel + brick_l | brick_stack, mortar_tub, brick_course | — | trowel | C |
| **polish_metal** | polish | bowl + rag | — | — | — | B |
| **work_wood** | adze | adze | beam | — | adze | C |
| **weave** | weave | beater | loom (ground loom) | — | loom | C |
| **spin** | spin | distaff + spindle | — | — | — | C |
| **gather** | gather | basket_hip | — | — | — | C |
| ↳ /shaping\|cakes/ | pat | — | dung_cakes | — | — | C |
| **brew** | stir | paddle | vat | — | — | C |
| **tend_animals** | groom | wisp | fodder | beside: donkey | — | C |
| ↳ /horse/ | groom | wisp | fodder | beside: horse | — | C |
| ↳ /ewes\|lamb/ | fodder | basket_hip | — | flock: sheep, sheep, goat ×5 | — | C |
| ↳ /out and giving them water/ | fodder | basket_hip | — | flock: sheep, goat, sheep ×4 | — | C |
| ↳ 35 % of performers | groom | wisp | fodder | beside: ox | — | C |
| **herd** | herd | staff | — | flock: sheep, sheep, goat ×12 | bleat | C |
| **shear** | shear | knife | fleece | lying: sheep (+2 grazing) | — | C |
| **slaughter** | butcher | knife | butchery, hides, basket_meat | tethered: goat, sheep | — | B |
| **offer** | hold | jar_both | — | — | — | B |
| ↳ 25 % of performers | hold_sack | sack_both | — | — | — | B |
| ↳ 15 % of performers | hold_lead | lead | — | lead: sheep | — | B |
| **clean** | sweep | broom | — | — | broom | C |
| **garden_work** | hoe | hoe | — | — | hoe | C |
| ↳ /prun/ | pick | knife | — | — | — | C |
| ↳ /produce\|tending the trees/ | pick | — | basket_fruit | — | — | C |
| **field_work** | hoe | hoe | — | — | hoe | C |
| ↳ /driving the animals/ | drive | goad | threshing_floor | circle: ox, ox | — | C |
| ↳ /glean\|stalks\|sheaves to the stooks/ | gather | basket_hip | stooks | — | — | C |
| ↳ /straw on the threshing floor/ | winnow | fork | threshing_floor | — | — | C |
| ↳ /seed\|manur/ | fodder | basket_hip | — | — | — | C |
| ↳ /minding the crop and the water/ | irrigate | hoe | — | — | hoe | C |
| **irrigate** | irrigate | hoe | — | — | hoe | C |
| **plough** | plough | goad | ard (with yoke) | team: ox, ox | — | C |
| **reap** | reap | sickle | sheaves | — | sickle | C |
| ↳ /binding/ | bind | — | sheaf, stooks | — | — | C |
| **thresh** | winnow | fork | threshing_floor, grain_heap | — | — | C |
| ↳ /driving the animals\|under the animals/ | drive | goad | threshing_floor | circle: ox, ox | — | C |
| ↳ /threshing and winnowing/ | winnow | fork | threshing_floor, grain_heap | — | — | C |
| **dig_canal** | hoe | hoe | spoil | — | hoe | C |
| ↳ /silt baskets/ | pass | basket_both | spoil | — | — | C |
| **pick_fruit** | pick | — | basket_fruit | — | — | C |
| ↳ /tread/ | tread | — | press | — | — | C |
| **craft** | mend | awl + basket_lap | — | — | — | C |
| ↳ /kiln/ | stoke | stick | brushwood | — | fire | C |
| ↳ /pigment\|colour/ | grind | — | pigment_slab | — | quern | C |
| ↳ /clay/ | hoe | hoe | spoil | — | hoe | C |
| **carry_bier** | bier_r | — | bier (shared by the four) | — | footsteps | C |
| ↳ 50 % of performers | bier_l | — | bier | — | footsteps | C |
| **wash** | wash | cloth | wash_stone, drying_rack | — | wash | C |
| **train** | archery | bow + arrow | target (22 m) | — | bow | B |
| **cook** | cook | ladle + stick | hearth_pot, brushwood | — | fire | C |

**Evidence rules kept:**
- **offer:** the magi only hold the issued commodities, standing still. There is no rite, gesture, libation or fire, and the note says why.
- **slaughter:** no killing and no blood.
- **carry_bier:** exposure is never shown.
- **Quiet work is silent.**

## Measured

**Unit tests** (`tests/performances.test.ts`, 16 tests):
- **IK:** palms within 5 mm of target on the real rig; the kit's FK within 3 mm of the rig's.
- **Every cycle:** finite, and every target reached (grips within 3.5 cm, feet within 1 cm).
- **Standing cycles:** planted within ±2 cm, with no skate over 4 cm, on m03, f02 and m08.
- **Seated and kneeling cycles:** rest on the ground within ±3 cm on m03, f02 and c01.
- **Plough path:** continuous.
- **Sounds:** cycles with a sound fire strike frames.
- **Props:** 1,108 placements through the crowd.
  - One-hand tools: within 2 cm of the palm.
  - Two-hand tools: front hand within 2 cm; rear hand within 3 cm of the handle line.
  - Things held between the hands: within 0.34 m of each hand.
  - Bow: its grip within 2 cm of the left palm; the drawn string within 3 cm of the right hand (4 draws checked).
  - Brick mould: handles within 8 cm of both hands.
- **Work objects:** 48-1,440 triangles each (the three stooks of five sheaves are the most); every one sits on the ground.
- **Animals:**
  - ≤ 742 triangles each;
  - they stand on the ground;
  - grazing brings the muzzle to within 8 cm of the ground (sheep 0.8 cm, goat 5.6 cm; ox, donkey and horse −3.4 to −1.3 cm, the muzzle sphere just touching the ground);
  - legs swing when walking;
  - lying puts the belly on the ground within ±6 cm;
  - a flock stays within 14.5 m of its herder and walks under 0.9 m/s.
- **Lint:** zero placeholders. It fails when a placeholder, the prop `scythe` or the animal `camel` is added back.
- **Variants:** 30 sim reason strings resolve to the intended variant.

**Budgets** (node, 300 performers of every activity in view, one pass):

| | instances | draws | triangles |
|---|---|---|---|
| carried props | 306 | 2 | unions of 986 / 410 per instance (the other kinds' vertices collapse) |
| work objects | 287 | 27 | 39 k |
| animals | 222 (overflow 0; cap 512 per species) | 4 | 154 k |
| people | 300 | 6 | 2.63 M |

- Crowd CPU: median 6.8 ms, p95 12.4 ms (node, IK passes 4 / 2 / 1 by distance). Measured at load 7 on the shared cores, after the pose kit speed-up (d853bfe); 8.6 ms before it. In the same harness, posing the same 300 people with a legacy cycle (dress_stone) measured 1.9-3.6 ms, depending on load.
- Props, work objects and animals cast only into the near shadow cascades. Worst case: (2 + 32 + 5) draws × 3 passes.

**Browser** (human lab, WebGPU, SwiftShader, quality test): 8-15 draw calls and 21 k-270 k triangles per station view, with no placeholder act (numbers per shot: see "Renders").

**Existing tests updated:**
- `tests/population.test.ts`: ABSTRACT_PLACEHOLDERS is `[]`, and the lint passes.
- `tests/people.test.ts`: props via PROPS geometry, and the lint.
- `tests/humans_runtime.test.ts`: placeholder flagging proved on a synthetic activity; props across variants.

## Renders

**Browser renders:** `tests/e2e/perf.spec.ts`, WebGPU (SwiftShader), human lab at quality test, 10:00, 960 × 540. Two page loads through the shared queue. The files are `shots/perf-<name>-webgpu.png`, copied to `/home/user/fars/shots/agent-perf/`.

| shot | what | draw calls / triangles (whole frame) |
|---|---|---|
| fields-a | hoeing, irrigating, reaping, binding sheaves (sheaves and stooks) | 12 / 158 k |
| fields-b | gleaning (hip basket, stooks), winnowing on the threshing floor, canal hoeing (spoil), silt baskets passed | 14 / 153 k |
| thresh | driving two oxen round the threshing floor | 10 / 41 k |
| plough | the ploughman at the ard, the yoked pair (12 m) | 9 / 41 k |
| animals-a | grooming a donkey, a relay horse (fodder under the muzzle), feeding the ewes, shearing a sheep on its side | 15 / 160 k |
| animals-b | butcher at the table (tethered goat and sheep, meat, hides); magi holding a jar, a sheep on a lead, a sack | 14 / 152 k |
| herd | the herder and a flock of 12 grazing and walking | 10 / 48 k |
| train, train-draw | archery at full draw, toward the target at 22 m and from the side | 9 / 33 k |
| fields-20m | the fields group at ~20 m | 12 / 158 k |
| haul | three men on the rope, the drum on its sledge | 8 / 117 k |
| build-a | earth ramp baskets, bricks passed from the stack, moulding brick (mud heap, drying field, jar) | 13 / 118 k |
| build-b | laying brick (stack, mortar tub, course), adze on a beam, polishing a phiale, mending a basket | 13 / 160 k |
| craft | stoking (brushwood), grinding pigment (slab), digging clay (spoil), weaving at the ground loom | 14 / 151 k |
| home-a | spinning, gathering (hip basket), dung cakes, brewing at the vat | 11 / 137 k |
| home-b | cooking at the hearth, washing at the stone (drying rack), sweeping, garden hoeing | 14 / 142 k |
| orchard | pruning, picking (basket), treading grapes in the press, the bier with four bearers | 11 / 270 k |
| haul-25m, animals-30m | the haul at ~25 m and the animals group at ~30 m | 9 / 21 k; 15 / 35 k |

No console errors, and no placeholder act in any shot.

**The browser found two faults the node previews could not.**
1. **Run 1:** animals with legs and heads thrown across the field. The instance matrix is applied before `positionNode`.
2. **Run 2:** pipeline creation failures, because the carried props and the animals exceeded WebGPU's 8 vertex buffers. The shots were taken, but in them no carried prop or animal is drawn.

Both are fixed. The renders above are from runs 3 and 4 (4: the archery shots and fields-b re-framed). A unit test now bounds the vertex buffers.

**Node contact sheets:** `tools/dev/perf_preview.ts all 3` → `shots/perf_preview_0..7.png`, also in `shots/agent-perf/`. Every station at three phases, from a 3/4 view and the side, plus a wide view and a view from above, through the real crowd on the CPU.

## Verification at the end

- `npx tsc --noEmit`: clean.
- **`npx vitest run` (full suite)**, twice, both times while other agents' browser runs and suites loaded the 4 shared cores:
  - Run 1: 405 passed, 1 skipped, 1 failed (load ~9). The failure was the crowd CPU timing in `tests/performances.test.ts`.
  - Run 2, after the last code change: 401 passed, 1 skipped, 5 failed (load 9-10). All five were timing limits or test timeouts:
    - `performances` crowd CPU: 19.5 ms against < 10;
    - `humans_runtime` posing 300 people: 6.2 ms against < 6;
    - `cloudnoise` 64³ build: 3.8 s against < 3 s;
    - `people` "a simulated day": two tests timed out at 120 s and 300 s.
  - **Re-run alone** at load ~3.4 (`shots/scratch/timing_rerun.sh`): all passed. Those were `performances` (the crowd), `humans_runtime` (posing 300 people), `cloudnoise` (3/3) and `people` "a simulated day" (3/3). The crowd CPU median was then 6.8 ms. None of these is a regression.
  - After the last code change, the affected files were also run on their own:
    - `tests/performances.test.ts` and `tests/humans_runtime.test.ts`: 34 passed;
    - `tests/population.test.ts` and the rest of `tests/people.test.ts`: passed within full-suite run 2.
- `npx tsx tools/lint_chrono.ts`: OK (76 structures, 98 blocklist terms).
- `npm run lint:lang`: 15 passed.
- `npm run lint:activity`: OK (53 activities, 25 variants, 0 placeholders).
- **e2e, WebGPU, through the shared queue** (E2E_PORT 5221; each run ≤ 2 page loads):
  - `tests/e2e/perf.spec.ts`: 2 passed, no console errors (run 3), then 1 passed (run 4: archery and fields-b re-framed). Runs 1 and 2 found the two GPU faults described above.
  - `tests/e2e/people.spec.ts`:
    - "people move with world time; the player cannot walk through them": passed (moved > 5 m: 8; the player stopped 0.52 m from the guard).
    - "speech": passed (an Aramaic greeting line, formant voice).
    - "people at work", the full seven views: **timed out** at the second screenshot. The test's budget is 600 s; the world took 5.3 min to load and each new view about 4 min under SwiftShader on the shared cores.
    - Re-run with two views (masons, querns): **passed** in 10.3 min. All its counts held: 112 of 135 people on the Terrace, 16 guards at their posts, 12 dressing stone.
    - I did not run the base commit for comparison, so "the seven views do not fit in 600 s at this load" is an inference. It is not a measured regression or non-regression.
    - The Terrace's activities use none of the new work objects or animals, so no new pipelines are compiled there, only the two prop unions. The gate guards' spears render in the new unions (shots/people-gate-guards.png).
  - The e2e runs used the code before the pose kit speed-up (d853bfe). That change leaves every pose the same: the unit tests pass unchanged.
- **Commits:** on `worktree-agent-a3102317f93d5f984`, not pushed. The files touched outside the new modules:
  - `src/people/crowd.ts`, in the per-frame performance parts only:
    - performance resolution;
    - path offsets;
    - the culling reach;
    - IK passes by distance;
    - both prop slots and their packed instance data;
    - work objects and animals;
    - stats.
    The pool and attach logic is untouched.
  - `src/people/anim.ts` and `humanRig.ts`: routing and planting.
  - `src/audio/soundscape.ts`.
  - `src/dev/humanLab.ts`.
  - Tests.
  - `package.json` (`lint:activity`).
  - DECISIONS.md (D-142), research/OPEN_QUESTIONS.md (Q-190…Q-199), ASSET_LEDGER.md.
