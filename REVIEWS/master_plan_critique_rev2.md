# Critique of MASTER_PLAN.md rev 2 (the second independent critique)

**Critic:** an independent, adversarial subagent (Claude Opus 5.5). I did not write the plan, the thresholds or the guards.
**Date:** 2026-09-26. **Tree:** `claude/amazing-fermi-40ds7j` at `4309d2b`. The lead committed `fa60dcd` while I worked; it does
not touch MASTER_PLAN.md, gates/ or the tests. Line numbers are file lines at that tree: `MASTER_PLAN.md:n`, `thresholds.json:n`
(the line of the row's `"id"`), `ratchet:n` (tests/gates_ratchet.test.ts) and `scope:n` (tests/scope_ledger.test.ts).
**Read in full:** USER_DIRECTIONS.md, MASTER_PLAN.md, REVIEWS/master_plan_critique.md, gates/thresholds.json, both guard tests,
handoff/review_template.md, handoff/agent_template.md, CLAUDE.md, D-236 and D-238…D-243. **Skimmed:** PERSEPOLIS_BRIEF.md §0–3,
§6, §9.3–9.5, §11–15; audits A–D (headings, the major misses, the smaller findings).
**Ran:** `npx vitest run tests/gates_ratchet.test.ts tests/scope_ledger.test.ts` (10/10 pass, 1 s). I ran every attack in §2 in a
throwaway clone in my scratchpad, never in the repo. Each attack commits a weakening and then runs the two guard tests. By
mistake I started one full `vitest run` in the clone; I stopped it within seconds and nothing in the repo was touched.

---

## 0. What is broken (read first)

1. **Every guard route I tried defeats the guards.** I tried 13 routes, including all six the brief named. Each one weakens
   the scope and leaves all ten tests green (§2). Three of the routes need no cleverness at all:
   - **Loosening by citing any direction.** `"loosened_by": "UD-03"` ("Full steam ahead") loosens T-A0 from 0 in 59 views to
     5 in 10.
   - **A stub file.** One line in a stub file promotes every walker threshold to `built`.
   - **One malformed commit.** A single commit where thresholds.json does not parse makes `history()` return `[]` for ever
     after (`ratchet:25`, `catch { return []; }`). From then on nothing is checked against history.
2. **The ratchet blocks honest correction.** `ratchet:65` forbids demoting a status, and rev 2 already overclaims several:
   - `T-D3` is "partial", but its tool `rain_days.ts` only lists rainy days and looks at no person.
   - `T-I1f` is "partial", but `language.test.ts` has no fate-hint check.
   - `T-K3` is "built" with the tool `src/main.ts`, which is product code, not a test. D-238 itself says "nothing asserted the
     default".
   - `T-R2` and `T-R3` are "built" with a Markdown file as the tool.
   - `T-E6` and `T-E6e` are "partial" with probes that read day plans, which axis D forbids (`MASTER_PLAN.md:106`).

   I checked it: demoting T-D3, T-I1f and T-K3 to to-build **fails** the ratchet. The guard meant to stop overclaiming now
   locks the overclaims in.
3. **UD-10 is not built, and its measure cannot see that.** `src/core/settings.ts:21` still has `courtCalendar: 'evidence'`,
   and the settings menu reads "Evidence-strict: king absent (default)" (`src/ui/shell.ts:102`). The trace measures UD-10 by
   T-F3d and tools/soak.ts (`MASTER_PLAN.md:397`); neither checks the default. The §6 step 1 list does not name the fix.
4. **Some numbers cannot be met, even in principle** (§3):
   - T-A2s fails a set of real photographs with probability ≈ 1 − 4 × 10⁻⁶.
   - T-A5 (≤ 100 %) can never fail.
   - T-J3c contradicts brief §2 and T-H4.
   - The plan's own budget cannot meet T-B3 even with ~80 areas: 80 × 59 + 150 = 4,870 views at ~550 per session is 9
     sessions, not 4.
   - T-A6x makes the 143 × 143 km envelope into thousands of areas. Every "per area" threshold then asks for lane-years, and
     Tier 0 "every walkable cell at 5 m every session" becomes ~822 million cells.
5. **60 of 105 rows have an empty `anti_proxy`,** against the plan's own rule (`MASTER_PLAN.md:36`: "Every threshold states its
   anti-proxy"). T-H0w is at `thresholds.json:20`.
6. **The records cite things that are not on the branch:**
   - D-237 (`MASTER_PLAN.md:261`) exists nowhere.
   - D-234 and D-235 exist only on unmerged worktree branches.
   - CLAUDE.md "Every inch" describes `tests/e2e/coverage.spec.ts` and `tools/dev/coverage_points.ts` in the present tense;
     neither exists on this branch.
   - `MASTER_PLAN.md:235` says "a test checks the size (D-243)"; no such test exists, and it is not marked TO-BUILD.
   - TASKS.md still carries 53 `[x]`, against `MASTER_PLAN.md:351`.
7. **Nothing runs the guards.** `npm run build` runs lint, tsc and vite, not `npm test`. There is no pre-commit hook and no CI
   (`.github/` is absent). The clone is shallow (`git rev-parse --is-shallow-repository` → true).

---

## 1. Fidelity: the first critique against rev 2

Legend: **F** faithful, **W** weakened, **M** missing.

### 1.1 The ten changes

| # | Change | Rev 2 | Evidence | Note |
|---|---|---|---|---|
| 1 | Illusion-break log as headline | **F** | `MASTER_PLAN.md:54-69`; T-H0, T-H0w, T-H0s rows | Adds "an event spawned because the player is near" (l. 63). **W** in two places. (a) Frame-time breaks (100 ms / 33 ms, l. 60, 64) can only be measured renderless, so they measure the simulation and never render cost; nothing says so. (b) The four bot policies are all well behaved: no bot probes walls, corners, doors or crowds (§4, item 14). |
| 2 | Locked thresholds and generated board | **W** | §4.1 l. 200-207; `ratchet:50-68`; §5 l. 249-255 | The spec is there, but the mechanism is defeatable (§2). The critique's "row's tool is an existing file" became existence-only for partial/built rows (`ratchet:47-49`), so stub files pass. `sample`, `tool` and `anti_proxy` are not locked. Nothing forces the board to evaluate every id. |
| 3 | Sampling that fits one lane | **W** | §4.2 l. 209-235 | Copied faithfully, including an arithmetic error in the first critique itself: its Tier-1 slot (~500–600 views, l. 231-232) cannot rotate ~80 areas × 59 in 4 sessions (T-B3). It never counted the envelope's plain sectors. Tier 0 at 5 m over the envelope is impossible (§3). The budget ignores CPU contention: the renderless bots "run all session" (l. 280) on the same 4 cores SwiftShader uses. |
| 4 | Area registry and world's edge | **F** as text, **W** in numbers | §4.3 l. 237-247; D-240 | T-A6x ≤ 1 km² across ~20,000 km² gives thousands of areas, and every "per area" threshold then breaks (§3.2). The rule "generator-made areas are sampled as a class" (l. 242) is not applied to T-H0, T-H0s, T-B1m/h/w, T-H1r, T-K1r, T-G1 or T-E6e, which all say "per area". |
| 5 | Reorder | **F** | §6 l. 259-276 | Step 1 (l. 260-265) omits flipping the court default (UD-10; see §0 item 3). Step 2 omits the Tier-1 sampler, the anchor set, the escapes log and `data/event_kinds.json`, all needed by steps 3–5. "Time-boxed to one session" (l. 266) has no consequence if the box is overrun. |
| 6 | Calibrated, blind judges | **F** | §8 l. 339-350; review template items 7-8 | T-A5's "ratcheting down" (l. 84) is not enforced: its value is 100 % (`thresholds.json:215`) and nothing lowers it when accuracy improves. Anchors are TO-BUILD but not in step 2, so every brief from the template would stop at clause 7. |
| 7 | Identity | **F** | E l. 113-132; T-E1…T-E7 rows | T-E1's "face JND" has no metric (§3). |
| 8 | Systems | **W** | F l. 134-146 | Two things are lost. (a) The critique's general rule "each causal link the brief names has an automated probe with an effect size" is gone. Only three links have rows: "short rations show a longer queue and fewer jars" sits in the prose of T-F3s (l. 141) but has **no row**, and the brief's "late grain delivery → short rations" and "delegation → feasting preparations" have none. (b) The 19 systems listed in l. 134-136 are not locked, so `data/systems.json` can list three. |
| 9 | Long horizons | **F** | J l. 172-180 | T-J3c gained a number (3650 days) that is wrong as defined (§3). T-J4's similarity is undefined. |
| 10 | Player's side | **W** | K l. 182-193 | Three things are dropped. (a) "The bench drives the player so the simulation runs" is gone from T-K6: audit D M3 found that `simStep` returns on `freeCam` (`src/main.ts:314`), so a bench run leaves the simulation out. (b) The heaviest views are no longer named (court assembly, town at dusk, rain on the plain). (c) T-K4's "no drift in time or positions" has no row. T-K5 is "per gate", but rev 2 abolished phase gates as the unit (§5). |

### 1.2 The B6 thresholds

| B6 id | Rev 2 rows | Status | Note |
|---|---|---|---|
| T-H0, T-H0s | T-H0, T-H0w, T-H0s | F | "per area" arithmetic, §3.2 |
| T-A0 | T-A0, T-A0t | F | |
| T-A1 | T-A1, T-A1m | F | |
| T-A2 | T-A2f, T-A2s | **W** (wrong) | Rev 2 hardened the critique's "inside the band" into "100 % of frames". That is impossible (§3.1). |
| T-A3 | T-A3c, T-A3k, T-A3n | F | T-A3c needs a solar-aureole exclusion (§3) |
| T-A4 | T-A4, T-A4cg | F | |
| T-A5 | T-A5 | **W** | The value (≤ 100 %) cannot fail, and no final target is stated |
| T-B1, T-B2 | m/h/w/p; m/f | F | T-B2 has no lower bound: night can be crushed to black (§3) |
| T-C1, T-C2 | C1, C1t, C1u, C1c; C2, C2f | F | The critique's "motion-compensated" and "ghosting" became "static regions" only: **W** for shimmer and ghosting on moving surfaces |
| T-D1…T-D5 | all present | F | Two partial tools measure plans, not instance buffers (§0 item 2) |
| T-E1…T-E6 | all present | F | T-E1 metric (§3) |
| T-F1…T-F6 | present except the rations effect | **W** | See change 8 |
| T-G1…T-G5, T-G0 | present; G0 became T-R0 | F | T-G1l bands and the T-G5 "quiet floor" have no values (§3) |
| T-H1…T-H3 | present | F | |
| T-I1 | T-I1, T-I1f | F in text | T-I1f's "partial" tool does not check fate strings |
| T-J1…T-J6 | present | F | |
| T-K1…T-K6 | present | **W** | Drift, bench-with-simulation, heaviest views (change 10) |

### 1.3 The B2 missing items

| B2 item | Rev 2 | Evidence |
|---|---|---|
| Hour 50 | F | T-J1a/b (l. 172-174); construction beyond Hall 100 in the programme (l. 303), no threshold |
| Return visit | F | T-J3, T-J3c, T-H3 |
| Night in a village | W | T-B2m/f (l. 91-92) and programme (l. 310-311). "Fire-lit surfaces carry the frame" and light leaking through walls have no threshold. |
| Following a family | F | T-E4 |
| Talking to strangers | F | D-241, T-K1r |
| Festival | W | Programme only (l. 312-313): no row for crowd scale, performers or food |
| Weather extremes and aftermath | W | Programme only (l. 308-311). Only the storm → work link has a row (T-F3s). |
| A child's day | W | Programme only (l. 299) |
| Animals' lives | W | Programme (l. 300-301). T-D5 only; "animals at every distance" and "animals solid" have no row. |
| Economy flows | F | T-F2, T-F2m |
| Social relations and gossip | W | Programme only (l. 300); T-F5 covers news |
| Emergent incidents | F | T-F4 |
| Agency | F | K |
| Comfort and access | W | T-K3/K3a. "The first five minutes without a tutorial" and "a two-minute loading screen" are **missing**; T-H4 is idle-box only. |
| Long sessions | W | T-K4/K4a; drift missing |
| Translation layer | W | Prose (l. 169-170): "every history and reconstruction note surfaced and tiered" has **no row**; the fate-hint row's tool does not check it |
| Real-hardware performance | W | T-K6 without the bench-runs-the-simulation fix |
| Delivery | F in text | T-K5, but it is "partial" although no build has ever been published |
| The default experience | W | FOV (D-238) is decided and built. The court default is **not** built (§0 item 3). The start date (D-239) is not implemented and not in step 1. |

### 1.4 The B7 errors

| # | Error | Rev 2 | Evidence |
|---|---|---|---|
| 1 | Stale status | Fixed | l. 3-4 |
| 2 | Section order | Fixed | §11-§13 |
| 3 | Non-measures in the trace | W | UD-04 and UD-12 are still measured by the tests that check the table itself (l. 391, 399). UD-13 is "measured" by the existence of NEEDS_FROM_ME.md (l. 400). A file is not a measure. |
| 4 | Axis A numbers | Fixed | l. 79-85 |
| 5 | 70° and ultra/high | Fixed | D-238; l. 96-97; `settings.ts:21` fov 60 |
| 6 | Weather weighting | Fixed | D-242 |
| 7 | Dated work in the plan | Fixed | §6 order |
| 8 | No P0 exit criteria | W | Time box without consequence (l. 266-267) |
| 9 | P2 before P3 | Fixed | step 4 |
| 10 | Two orderings | Fixed | l. 259, 292 |
| 11 | Evidence volume | W | D-243 exists, but "a test checks the size" (l. 235) is false today and not marked TO-BUILD |
| 12 | TASKS ticks | W | The rule is stated (l. 351); TASKS.md has 53 `[x]`; no test |
| 13 | Done judged by the builder | Fixed | l. 355, 371 |
| 14 | Rubric photo-only | Fixed in text | l. 344; the life category has no own id (covered by T-A4 "every category") |
| 15 | Smell tied to inventory | Fixed | l. 156 |
| 16 | Content scale of speech | Fixed | l. 296, D-241 |
| 17 | Sound too late | Fixed | l. 263-265; `4309d2b` seeded the noise |
| 18 | No gates to lower | Fixed | thresholds.json |
| 19 | Non-existent files not marked | W | l. 219-223 (`coverage_points.ts` "draws the sample"), l. 235, l. 347 (`REVIEWS/escapes.md`), l. 289 (`sessions/`), l. 231 (`gates/budget.json`) are present tense with no TO-BUILD. CLAUDE.md "Every inch" does the same. |

**Summary of fidelity:** the text of all ten changes arrived. What is weaker is the mechanism: the guards (§2), the numbers
(§3), and six places where a requirement lives only in prose without a row: the rations effect, the causal-link rule, drift,
the translation layer's sourcing, the bench running the simulation, and the first five minutes.

---

## 2. Break the guards

Each route was run in a scratch clone. The procedure was: make the weakening, `git commit`, run both guard tests. "Defeated"
means 10/10 still pass.

| # | Route (what a behind-schedule session does) | Result | Smallest mechanical fix |
|---|---|---|---|
| R1 | Loosen T-A0 to 5 in n ≥ 10, `"loosened_by": "UD-03"` | **Defeated** | `loosened_by` must name a UD row whose text contains the threshold id and the new value (`ratchet:64`: also require `ledgerRow(r.loosened_by).includes(r.id) && includes(String(r.value))`). Also add a UD-row text lock (R8). The honest limit: the session writes the ledger. So the audit round (T-R2) must check every UD added since the last audit against the user's messages, and the session log must quote the message. |
| R2 | `echo 'export {};' > tools/dev/walkers.ts`; every walker row set to `built` | **Defeated** | Status is **derived, not typed.** `partial` needs `REVIEWS/evidence/**/<id>.json` with `{id, value, n, commit}` written by the named tool. `built` needs such evidence with `n ≥ sample_min` on a commit within 4 sessions. The ratchet checks the evidence file, not the tool file. The tool file must also contain the id string and read `gates/thresholds.json`. |
| R3 | Unit trick on the sample: T-H0 `sample` "bot-hours per area" → "bot-minutes world-wide"; T-A0 "per area" → "world-wide"; T-H0s `anti_proxy` emptied | **Defeated** | Add `sample` to the locked fields at `ratchet:58-62`. Require `anti_proxy.length ≥ 20` for every row (60 rows fail this today and must be filled first). |
| R4 | Swap the tool of T-D1, T-D2s, T-E4 to an existing easier probe (`audit_c/treadmill.ts`), status `partial` | **Defeated** | Lock `tool` once a row is partial or built. A different instrument is a new id; the old id stays and reads NOT-MEASURED. |
| R5 | Commit a thresholds.json with a trailing comma (one "wip" commit), then delete T-A2s, loosen T-H0 to 50 and rename T-A2s in the plan | **Defeated** | Fail closed. Delete the `try/catch` at `ratchet:22-25`. A version that does not parse fails the test and names its rev. So does an unavailable git. |
| R6 | Squash: `git reset --soft a8cba80`, then one commit holding the loosened file | **Defeated** | Pin anchors outside the branch's linear history. (a) The test requires `git merge-base --is-ancestor acf73a4 HEAD`. (b) Every session close pushes a tag `ratchet/sNN`, and the ratchet also compares against every `ratchet/*` tag. (c) Session start runs `git fetch --unshallow --tags` when the clone is shallow; this clone is shallow. |
| R7 | Run the tests with git invisible (`GIT_DIR=/nonexistent`) and an uncommitted loosening | **Defeated** (4/4 pass) | Same as R5: fail closed. |
| R8 | Reword UD-06 to "the key moments should look good". Reword axis C to "the camera-rig lens where the player lens is impractical, at `high`". Replace §1's "nowhere the player walks … breaks the illusion" with "the chosen moments look right". Headings kept. | **Defeated** | (a) USER_DIRECTIONS rows are immutable: each UD row's text equals its first committed version, and the count never falls below the historical maximum. (b) Add `gates/scope_phrases.json`, append-only under the same ratchet, listing the normative sentences, each of which must appear verbatim in MASTER_PLAN.md (seed list in §6, change 5). |
| R9 | Trace cells "measured by" set to `.` (UD-06) and `README.md` (UD-08); step 1 "Stop the bleeding" deleted from §6; the programme's "Runs" bullet deleted | **Defeated** | (a) Each ref is a T- id or a **regular file** (`statSync(r).isFile()`; `.` is a directory). (b) Each row holds ≥ 1 T- id whose row `ud` equals that UD. (c) The set of refs per UD row never shrinks against history. (d) Every `tool` path of every to-build row, and every §6 step heading, is in `scope_phrases.json`. |
| R10 | Add UD-15 (traced), commit, then delete it | **Defeated** (`MIN_ENTRIES = 14`, `scope:9`) | Count never below the historical maximum, from git history plus `ratchet/*` tags, instead of a constant. |
| R11 | Keep the template's scope words but negate them ("… are out of scope; judge the stills at the rig lens") | **Defeated** | (a) The "Fixed clauses" block of each template must contain, verbatim, the block at `acf73a4` (it may grow, never change). (b) Every brief actually sent is saved to `handoff/briefs/sNN/<agent>.md`. A test checks that each saved brief contains the fixed-clause block verbatim, and that every agent named in `sessions/sNN.md` has a saved brief. |
| R12 | Add an easier new id (T-A0e: ≤ 5 in n ≥ 10), report only it on the board, and quote T-A0 anywhere in the plan (a footnote satisfies `ratchet:69-74`) | **Defeated by design** (the board does not exist yet, and nothing ties the board to the ids) | `tests/coverage_board.test.ts` asserts that the board has a cell for **every** id in thresholds.json. A to-build id or an id with no current evidence reads NOT-MEASURED, which counts as FAIL, like STALE. §10's "every axis" becomes "every threshold id". |
| R13 | Edit the guards themselves: `it.skip`, loosen `asStrict`, or `exclude: ['tests/gates_ratchet.test.ts']` in vitest.config.ts, or change the `test` script | **Defeated** (nothing protects the guard files; I did not run this one, it needs no proof) | Nothing in the repo can protect itself, so move the check outside the session's reach. (a) A GitHub Actions workflow runs both guards with `fetch-depth: 0` on every push to the branch. Its failures are visible on GitHub even if the workflow file is edited later, and editing the workflow is itself in the diff. (b) `npm run build` begins with `vitest run tests/gates_ratchet.test.ts tests/scope_ledger.test.ts`, so no published build (T-K5) comes from a broken guard. (c) A versioned pre-commit hook (`.githooks/pre-commit`, installed by `"prepare": "git config core.hooksPath .githooks"`, which `npm ci` runs) runs the same two tests in about 1 s. (d) The T-R2 audit runs `git diff <last-audit>..HEAD -- tests/gates_ratchet.test.ts tests/scope_ledger.test.ts vitest.config.ts package.json gates/ USER_DIRECTIONS.md handoff/*_template.md .githooks .github` and reports every weakening. |
| R14 (the reverse trap) | Honestly demote T-D3, T-I1f, T-K3 to to-build | **Blocked** (the test fails) | Allow demotion; demotion is the honest direction. Forbid *advancement* without evidence (R2). With NOT-MEASURED = FAIL (R12), demoting can never help a session pass. |

**Additional structural gap: no errata route.** The ratchet has exactly one way to correct a threshold that is wrong in
principle, such as T-A2s: a user direction. That forces either the intervention the user asked not to need, or a board that
can never reach done, or a session that quietly ignores a row. Add `"superseded_by": "<new id>"`, allowed only when:
- `gates/errata/<old id>.md` holds a measurement showing that the real thing fails the old definition (for T-A2s: the reference
  photographs themselves fail it);
- the new row is at least as strict on everything it does not correct;
- the next audit's critic signs the erratum in that file.

The old row stays, reads SUPERSEDED, and is never evaluated.

---

## 3. Wrong or unreachable numbers

Throughout I propose definitions, not looser standards: where a row is only hard, it stays. Under the ratchet as it stands
(`metric` locked), each correction is a new id plus the errata route above.

### 3.1 Impossible or always-passing as defined

- **T-A2s** (`thresholds.json:125`), "≥ 100 % of frames inside the 5–95 % band" of two statistics.
  - By construction, 10 % of the reference photographs fall outside their own band on each statistic, so ~19 % of real photos
    fail at least one. A set of 59 real photographs passes with probability 0.81⁵⁹ ≈ 4 × 10⁻⁶.
  - The reference set also cannot define most strata. `references/` holds 73 images, many of them artist renders (CG) and
    maps, and **no** photograph of a mud-brick lane, a village, fields, an interior, night, rain or a crowd.
  - **Replace with:**
    - **T-A2s2:** "per stratum (distance class × scene class × light), the share of Tier-1 frames inside the joint 5–95 % band
      is not below the reference photographs' own leave-one-out share by more than the binomial 95 % margin (≥ 72 % for two
      statistics at n = 59), and a two-sample KS test of each statistic against those references does not reject at α 0.05";
    - **T-A2r:** "every stratum judged by T-A2s2 has ≥ 30 reference *photographs*, never renders, of the real place or of a
      listed analogue (traditional mud-brick settlements of Fars and the Zagros, the Marvdasht plain, night and rain
      photographs); a stratum without them reads NOT-MEASURED".
  - Add the analogue photographs to NEEDS_FROM_ME as an easy list (UD-13) and look for CC-licensed sources first.
- **T-A2f** (`:110`), flat share ≤ 3 %. Real lime-plastered or mud-plastered walls in flat light can exceed this. Add
  **T-A2f2**: "flat share ≤ the 95th percentile of the same-stratum reference photographs, and ≤ 3 %". This keeps 3 % as a cap
  and fails no true photograph.
- **T-A5** (`:215`), "≤ 100 %". It cannot fail, and nothing enforces the promised ratchet. Add **T-A5d**, the final
  standard: "blind pick accuracy ≤ 65 % over ≥ 20 pairs (≤ 13 of 20; chance cannot be rejected at α ≈ 0.06)". Also: "the board
  writes each new best accuracy into T-A5's value (a test fails if evidence shows a best below the file's value)".
- **T-J3c** (`:1370`), "≥ 3650 days caught up deterministically". It contradicts three things:
  - brief §2 ("the year is fixed") and T-J4 ("the label stays 467"), unless the plan says whether people age while the year
    does not;
  - T-E3's consistency with the archive's dates, because attested people would age past their attested lives;
  - T-H4 (first frame ≤ 60 s), because stepping 10 years is about 20 h at the soak's measured rate.

  **Replace with:**
  - **T-J3e:** "after an absence of A ∈ {1, 30, 354, 3650} days, the loaded state equals a continuous run from the same save
    (people, stores, construction, memory, events), and load including catch-up ≤ T-H4";
  - plus a decision, **D-nnn "the perpetual 467"**: the calendar keeps the regnal year; ordinary people follow a stationary
    demography (age, birth, death); attested named people are held at their 467 age and role, tier noted. This makes a
    closed-form catch-up possible.
- **T-B3** (`:350`) with the budget at `MASTER_PLAN.md:230-233`. As shown in §0 item 4, the rotation cannot meet the 4-session
  cadence at the budgeted Tier-1 rate.
  - Keep T-B3 = 4; the standard is fixed.
  - Correct the text to: "Tier 1 needs Σ(n per stratum)/4 views a session (≈ 1,220 for 80 unique strata plus the transect).
    The instrument session measures t_test; if the slot cannot carry it, T-B3 reads FAIL and B-nnn logs ≥ 3 approaches (ID
    and depth at 480×270, grouped loads per day/hour/weather, shaded frames only where the ID pass shows a detector
    candidate)."

### 3.2 The envelope arithmetic (T-A6x against every "per area" row)

- **The size of the problem.**
  - The fields zone alone is 81.92² ≈ 6,700 km²; the far ring is 143.4² ≈ 20,600 km².
  - With areas of at most 1 km² (T-A6x), the registry holds **thousands** of areas, not ~80 (`MASTER_PLAN.md:232`).
  - At 20 bot-hours per area (T-H0), 200 targets (T-H1r), 50 addresses (T-K1r), 59 audio renders (T-G1) and 12 × 8 × 9 strata
    (T-B1) *per area*, that is hundreds of thousands of bot-hours and views per rotation.
  - Tier 0 "every walkable cell … at 5 m, every session" (l. 211) is ~822 M cells over the envelope, 268 M in the fields zone.
- **Fix: a `scope` field on every row**, locked like `metric`, with one of these values:
  - `unique-area`: every Terrace building and court, town quarter, palace or garden zone, named site, village, river reach,
    and the transect;
  - `class`: generator-made plain sectors and far land;
  - `world`, `session` or `process`.
- **Sampling rules by scope:**
  - Class thresholds apply to the class with n ≥ 59, stratified so that every 10 × 10 km cell of the class is hit within a
    rotation.
  - The "8 per member" rule (l. 221) applies to classes of ≤ 50 members (the villages).
  - **Tier 0** runs at 5 m in unique areas and at the terrain tile's own resolution (≤ 80 m) in class areas, plus a
    per-tile content hash that proves identical generator input yields identical checks.
  - The transect gate = every `unique-area` row on the transect areas. This also defines "brought to PASS on every axis"
    (l. 268), which is currently undefined for world-scoped rows such as J, F4 and K5/K6.
- **T-E6e** (`:770`), "every 2-hour daytime window per area holds a non-routine event within 100 m". Applied to empty steppe
  or a storeroom, it contradicts brief §1.1 ("silence … and empty moments are allowed, and they matter") and T-G5.
  - Scope it to inhabited classes: the Terrace, town, villages and roads.
  - For wilderness classes add **T-E6w**: "≥ 1 witnessable sign of life or weather change within sight per 2 h (a herd, a
    traveller on the track, a raptor, a dust devil, a cloud shadow)".

### 3.3 Unmeasurable as defined (no metric, no value, or ambiguous units)

- **T-E1**'s face JND. Define the distance d as a Euclidean distance over the per-person face and body parameter vector, with
  each dimension scaled by its population SD and only dimensions that change the head as drawn within 15 m counted. The JND
  d\* is the distance at which blind reviewers, shown 40 pairs of rendered head crops at 1 m and 5 m, answer "same person"
  50 % of the time (a psychometric fit, re-fitted when the face model changes). Then T-E1 = 0 pairs with d < d\*, and T-E1l
  validates d\*.
- **T-J4**, "≤ 0 excess" similarity. Define: Jaccard over the multiset of (event kind, area, hour band) of non-routine events
  plus the daily weather-state sequence. The rule is J(d, d + year) ≤ the 95th percentile of J(d, d′), where d′ is the same
  calendar day in another seed. Calendar routine is legitimately shared; particular events must not be. "Year" = the regnal
  calendar's length (354 days, audit A M7); state it.
- **T-G5**, "the quiet floor" has no value. Define it as short-term (3 s) loudness at least 30 LU below the town's daytime
  median at the same master level.
- **T-G1l** bands are "set once from references" and have no rows. A session will set them where the build stands. Add one row
  per place class **before** the first measurement, taken from published field levels at a stated playback calibration (town
  day median ↔ 60 dBA). Examples: rural night 25–35 dBA, village day 40–50, market 60–70.
- **T-F3s**, "≤ 5 minutes": say whether these are in-game or real minutes. At ×60 the two differ 60-fold. Add the in-game
  variant as T-F3s2; the rations effect as **T-F3r** ("on a short-ration month, queue length ≥ 1.5× and jars carried home
  ≤ 0.8× the normal month, on screen"); and the causal-link rule as **T-F3x** ("every causal link in brief §9.5 has a row").
- **T-K5**, "per gate": gates no longer exist. Add **T-K5s**: "≥ 1 playable build per session at a stable URL". GitHub Pages
  with the `coi-serviceworker` shim supplies COOP/COEP with no user action.
- **T-K1**, "where it makes sense": undefined, so gameable. Lock the list per verb in `data/verbs.json` (area classes per verb,
  append-only).
- **T-B2m/T-B2f** have no lower bound, so night can be crushed to black. Add **T-B2s**: "on a moonless night the skyline stays
  visible (sky–terrain luma difference ≥ 3/255 after tone mapping), and a full-moon frame's mean luma is ≥ 8/255".
- **T-A3c**: add "excluding pixels within 5° of the sun and specular glints < 4 px". Real photographs clip in the aureole; the
  0.5 % cap stays.
- **T-E2** (≤ 1 %) may be stricter than the attested name-frequency distribution. Under the ledger's rule the later user
  direction (UD-08) wins, so keep it. Record in OPEN_QUESTIONS the attested top share from the PF/PT onomasticon, so that the
  departure from the evidence is visible in F3.

---

## 4. Still missing (not covered by any axis, threshold or programme item)

1. **Decisions implemented as defaults.**
   - Nothing tests that the defaults are the decided ones. The court (UD-10, D-236) is still `evidence`. D-239's start date is
     not built. T-K3 is "built" on product code.
   - Add `tests/defaults.test.ts`: the court default, fov 60, bob 0.018, a new seed per new game, the start day before the
     court's arrival. Add a rule: every DECISIONS entry that changes a default names the test that pins it.
2. **Hour 1.** The title and loading screen, click-to-start, the spawn on the approach, controls help that can be found
   without a tutorial, and the first minute on the user's own machine.
   - T-H4 is an idle SwiftShader box with local files. Nothing measures download size (README budget: ≤ 60 MB first load),
     time to first frame over a network, or shader-compile hitches on the first sight of a material. That last one is a hard
     break on real GPUs that SwiftShader never shows.
   - Add **T-K7**: download size ≤ the README budget; **T-K7c**: 0 pipeline-compile hitches > 100 ms after the first 30 s,
     through pipeline pre-warming measured in the bench.
3. **Real hardware beyond the cost model.**
   - The brief's WebGL2 fallback, "tested separately" (brief §6), is absent from rev 2.
   - GPU memory in bytes against the 3.5 GB budget, and the absolute JS heap against tab limits: T-K4 only bounds growth.
   - The bench running the simulation (audit D M3).
   - The heaviest views as bench routes: court, town at dusk, rain on the plain, ×60.
   - REAL_HARDWARE_TODO.md entries per GPU feature (brief §6; audit D says it is stale since D-185).
   - The ×600 time scale offered in settings (`shell.ts:99`), which is never measured (T-H2p covers ×60 only).
   - Add rows for each of these.
4. **Saves over the project's life.**
   - Saves live in `localStorage` (`src/core/save.ts:11`), and a quota overflow returns `false` silently. T-K2's memory of
     everyone addressed for 7+ days, the event logs and hour-100 state can exceed ~5 MB.
   - Builds change daily, so the user's world a month later (UD-09) dies on the first incompatible save.
   - Add **T-H3s**: save ≤ 2 MB after 100 bot-hours, a failed save surfaced out-of-world, moved to IndexedDB. Add **T-H3v**: a
     save from the previous published build loads (migration), or the loss is announced out-of-world.
5. **Determinism across machines.** "The seed reproduces the world exactly" (D-236). `Math.sin` and similar functions are
   implementation-defined across engines. Add **T-F6x**: the event-log hash for (seed, day) is equal in node and in Chromium
   and matches a committed golden hash.
6. **Close-up faces: the most intimate moment is never judged.**
   - Tier 2 draws 16 views at random from Tier 1, which rarely puts a face within 2 m. Yet every address (T-K1a, within 3 m)
     fills the frame with one. Brief §9.3 says "faces first: fix uncanny close-up faces before adding more people".
   - Add **T-C1f**: "≥ 4 conversation-distance clips per session (the player addresses a random person at 1–2 m, at default
     FOV and ultra), every rubric category ≥ 4, 0 'uncanny'".
7. **The §1.1 moments.** D-233 rightly says they are not the standard, but brief §1.1 still requires them to land, and rev 2
   no longer mentions them. Add **T-A4m**: "the eight §1.1 moments judged at least once per rotation, as scenes in motion with
   sound, every category ≥ 4".
8. **The brief's own numeric gates are not locked.** They live in tests the ratchet does not see:
   - plan overlay IoU ≥ 0.95 and offset < 0.5 m (§13.2);
   - dimension tests (§13.3);
   - sun within 0.1°, monthly temperature within ±1 °C, precipitation days within ±20 % (§13.6);
   - the soak's variety, stability and event floor, and the shadow review of 20 NPCs ≥ 4/5 (§13.11);
   - activity coverage (§9.5);
   - "no open critical findings" at review (§13.9).

   Add these as T-I6…, T-D6, T-F7 and T-R4. The shadow review must be judged **on screen** (axis D's rule).
9. **Acoustics and music.**
   - Axis G measures loudness, repetition and presence, not space. Add **T-G6**: RT60 per enterable space within ±20 % of its
     Sabine estimate from dimensions and materials. Add **T-G6o**: a source behind ≥ 1 wall is ≥ 10 dB down and low-passed
     ("the acoustics stop at the Terrace" is a known failure, `MASTER_PLAN.md:155`, with no row to fix it against).
   - Brief §11 wants "repeat performances differ". Add **T-G2m**: two performances of one piece share no segment > 2 s
     (cross-correlation > 0.9).
10. **Languages without a corpus.** Lydian, Egyptian and the delegations' languages fall back to Aramaic murmur (audit D).
    T-K1a ("answers in their language") is then either unreachable or met with another people's language. Add to T-K1a:
    "…or with gesture and wordless voice where no usable published corpus exists (a per-language list in DECISIONS), never
    in another people's language".
11. **The translation layer as a product.** Brief §14 phase 8 requires "every translation is sourced", and the chronicle must
    not claim what the world does not show.
    - Add **T-I4**: 0 layer strings without a source and tier.
    - Add **T-I4c**: every chronicle entry matches an event witnessable in the world log at that place and time (the
      anti-proxy of axis F).
    - Add **T-I4n**: every person's history and every reconstruction note reachable in the layer.
12. **Ethics and representation (brief §12).** Rev 2 has one clause, on ritual (l. 312-313). Nothing checks:
    - kurtaš shown as the PF texts show them (rationed, paid in kind, with women's and children's rations attested);
    - punishment and children shown non-sensationally;
    - women's dress reconstructed and tiered;
    - no Hollywood tropes (bare-chested slave-soldiers, harem clichés);
    - delegations' peoples not caricatured;
    - the living religion shown with nothing invented.

    Add **T-R5**: an independent representation review every audit round, against a checklist drawn from §12 and the
    blocklist, with 0 open findings. Also: **attested named people** (programme l. 294) are placed only where *and when* their
    attested dates make them alive and in role in 467. Most Fortification-archive people (509–493) are old or dead by then; the
    Treasury texts (492–458) are the right pool. Add **T-I5**: 0 attested persons outside their attested life window.
13. **Real objects in their moment (brief §1.1).** The tablets written and sealed with attested seals, the foundation plates,
    the Treasury objects. Rev 2 drops this entirely, and audit A M9 lists it as broken. Add a programme bullet and **T-I7**:
    "≥ N attested objects shown at their 467 point". Published Treasury texts dated to Xerxes' 19th year, if any exist, are
    the first candidates (verify; tier each).
14. **Player-caused breaks.** All four bot policies behave well. Add a fifth, the **prober**: it hugs walls, jumps in corners,
    times doors, pushes through queues, climbs slopes at 41–43°, and stands in doorways. Add to the hard-break list: "the camera
    near plane inside geometry (seeing through a wall or into a body)".
15. **Falling off the Terrace** (brief §6: "you can fall off the Terrace edge"). What happens after a 12 m fall is not decided.
    It must be decided within restraint (no game-over screen) and tested.
16. **Accessibility.**
    - The lightning-flash warning exists, but no limit does. Add **T-K3f**: with the warning set, no more than 3 flashes a
      second and no full-field luminance jump above the WCAG 2.3.1 limit.
    - Per-channel volume (brief §6) is missing from T-K3a's six settings.
    - Captions of meaningful sounds in the translation layer are missing, and needed because news and life are carried by
      sound.
17. **Autonomous-session failure modes.**
    - Agents' worktree branches are left unmerged while the plan cites their decisions: D-234, D-235 and the phantom D-237.
      Add a test: every D-/Q-/B- id cited in MASTER_PLAN.md or CLAUDE.md exists in its record or in a reserved-number table
      naming its branch.
    - At session close, every worktree branch is merged or abandoned with a record. No branch survives a session unrecorded.
    - A render-queue lock left by a killed agent: `queue_e2e.sh` needs a stale-lock timeout.
    - A shallow clone weakening history-based guards: unshallow at session start (R6).
    - Two sessions on one branch: push conflicts resolved by the records-union rule, never by force.
    - The CPU budget: renderless bots on the same 4 cores slow SwiftShader (CLAUDE.md: 35 s idle load against 244 s busy), so
      `gates/budget.json` must be measured with the bots running and state core-hours, and bots are `nice`d during Tier-1 and
      Tier-2 jobs.
18. **The user's view of the project.** The user wants not to intervene, so their one touchpoint must be good. PROGRESS leads
    with the ten worst (l. 69), but no single page tells them what to open and where to walk. Add to T-K5s's note: "three places
    and times worth walking to now, with the URL".

---

## 5. Executability

**Is the order in §6 right?** Mostly yes: stop the bleeding, then instrument, then transect, then multipliers, then area by
area. Four corrections:

1. **Step 2 is under-listed** (l. 266-267). The transect exit ("0 Tier-1 hard fails") needs the Tier-1 sampler
   (`coverage_points.ts`, which is on no branch but D-235's worktree). Tier 2 needs the anchor set and `REVIEWS/escapes.md`.
   T-J1 and T-F4 need `data/event_kinds.json`. Name them in step 2 and rank them. The rest can follow.
2. **The renderless mode is the unmeasured risk everything hangs on.** Bots, audio renders, people traces, T-H0 and T-B3 all
   depend on whether the full world boots in headless Chromium with the renderer off, and how many bot-hours it yields per
   core-hour when stepped faster than real time. Spike it first, in the first half-day, and write the number into
   `gates/budget.json`, measured while Tier-1 jobs run. If it cannot run at ≥ 10× real time on 2 cores, the headline measure
   needs another design (for example, the node Tier-0 people probes against the crowd feed), and the plan should say so now.
3. **A deadlock between thresholds and order.** T-J5 (surprises "verified on screen (a Tier-2 view or clip)") and T-R0 (the
   last 30 judged views) need Tier 2 every session. Step 2 bars Tier 2 until the transect has 0 Tier-1 hard fails, which is
   probably several sessions away. Add: "until Tier 2 opens, T-J5 and T-R3 accept an agent render at the player's lens and
   quality, logged with its path in `sessions/sNN.md`; T-R0 reads NOT-MEASURED".
4. **Step 1 misses two items already diagnosed:** the court default (UD-10) and a test that pins defaults. The in-flight work
   (fall-through H1, D-234 house lamps, D-235 rig clock, villages flagged in `fa60dcd`, noise and `Math.random` in `4309d2b`)
   should be merged or recorded before step 2 starts.

**Can the next session start tomorrow?** Yes, on node-only work, with no render lane. The files it would build are named and
the order is stated. It cannot finish step 2 in one session as listed (area registry, Tier 0, renderless, four bot policies,
board, budget): it should expect to overrun the time box, and the plan should say what happens then. What happens is that the
board ships with NOT-MEASURED = FAIL for what is missing, and step 2 continues only for the first column (walkers, Tier 0,
registry).

**The single first action:** harden the guards in one commit before anything else. Changes 1–3 of §6 below are about an hour
of node work, touch no render lane, and every later "PASS" depends on them. The first engineering action after that is the
renderless-mode spike, which writes `gates/budget.json`.

---

## 6. Verdict and ranked changes

**Verdict: not fit to govern as is; fit after a small amendment (rev 2.1).** The diagnosis, the axes, the thresholds and the
order are right, and this is much the strongest version so far. But:
- the plan claims its guards make the scope mechanical, and today every route I tried defeats them;
- the ratchet freezes the overclaims already in the file;
- a handful of numbers are impossible or undefined, so the board can never honestly reach done;
- UD-10 is still not built, and its measure cannot see that.

Each of these would bring the user back to intervene. None needs a redesign. The changes below, ranked, with the exact text:

**1. Harden the ratchet** (replace `MASTER_PLAN.md:202-207`, the body of §4.1, and implement in `tests/gates_ratchet.test.ts`):
> Every threshold is a row of `gates/thresholds.json`: `{id, axis, scope, metric, op, value, unit, sample_min, sample, tool,
> status, anti_proxy, ud, since}`. `tests/gates_ratchet.test.ts` fails **closed**: if git, any committed version, or the
> baseline `acf73a4` is unavailable or unparsable, it fails. It compares the file against every committed version and every
> `ratchet/*` tag (one is pushed at every session close), and fails if:
> - an id disappears;
> - `metric`, `unit`, `axis`, `scope`, `op` or `sample` change;
> - `tool` changes once the row is partial or built;
> - a value moves the loose way or `sample_min` falls;
> - `anti_proxy` is shorter than 20 characters;
> - the plan fails to quote an id, or quotes an id the file lacks.
>
> Status is **derived from evidence**: `partial` needs `REVIEWS/evidence/**/<id>.json` written by the row's tool; `built` needs
> such evidence with n ≥ `sample_min` on a commit no more than 4 sessions old. Demotion is always allowed.
>
> A loosening needs `"loosened_by": "UD-nn"`, where that UD row's verbatim text names the id and the new value. A threshold
> proven wrong in principle takes `"superseded_by"` only with `gates/errata/<id>.md` (the measurement showing the real thing
> fails the old definition, signed by the next audit's critic). The new row is at least as strict elsewhere; the old row reads
> SUPERSEDED. New thresholds are added, never swapped for easier ones.

**2. Run the guards where they cannot be skipped** (add to §8 after l. 353):
> - **The guards run themselves.** `npm run build` begins with the ratchet and scope tests. `npm ci` installs
>   `.githooks/pre-commit` (through `"prepare": "git config core.hooksPath .githooks"`), which runs them. A GitHub Actions
>   workflow runs them with full history on every push. Session start unshallows the clone. Every audit round diffs the guard
>   files (`tests/gates_ratchet.test.ts`, `tests/scope_ledger.test.ts`, `vitest.config.ts`, `package.json`, `gates/`,
>   `USER_DIRECTIONS.md`, `handoff/*_template.md`, `.githooks/`, `.github/`) since the last audit and reports every weakening
>   as a critical finding.

**3. Harden the scope test** (replace the second sentence of `MASTER_PLAN.md:8-10`):
> Mechanical guards:
> - `tests/scope_ledger.test.ts`:
>   - every UD row's text is identical to its first committed version, and the ledger never holds fewer rows than it ever did;
>   - every trace row names ≥ 1 threshold id of its own UD, only ids or regular files, and never fewer refs than before;
>   - every sentence in `gates/scope_phrases.json` (append-only) appears verbatim in this plan;
>   - every to-build tool path is quoted here;
>   - every D-, Q- and B- number this plan or CLAUDE.md cites exists in its record;
>   - each template's fixed-clause block contains its `acf73a4` text, and every brief sent (`handoff/briefs/sNN/`) contains
>     the block.
> - `tests/gates_ratchet.test.ts` (§4.1).

Seed `scope_phrases.json` with:
- l. 16-17 ("nowhere the player walks, at any hour or season, for as long as they stay, breaks the illusion");
- l. 96 ("Judged at the default FOV (60° vertical, D-238) **and** at the widest setting, at `ultra`");
- l. 106 ("Measured from renderless traces of the **crowd's instance buffers** (what is drawn), not popview or plans");
- l. 219-220 (the commit-hash seed);
- l. 240 ("never from the nav grid");
- l. 244 ("there are no invisible walls");
- l. 252 ("so a PASS cannot be typed");
- l. 254 ("STALE counts as FAIL");
- l. 259 ("this order wins over any list below");
- each §6 step heading.

**4. Every id on the board, and scope defined** (append to §5, after l. 255):
> The board has a cell for every threshold id in `gates/thresholds.json` (`tests/coverage_board.test.ts` fails otherwise). An
> id that is to-build, or has no evidence on the current tree, reads **NOT-MEASURED**, which counts as FAIL. Rows are scoped
> `unique-area`, `class`, `world`, `session` or `process`:
> - class rows are judged over the class with n ≥ 59, stratified so every 10 × 10 km cell of the class is hit within a
>   rotation;
> - the "8 per member" rule applies to classes of ≤ 50 members;
> - Tier 0 runs at 5 m in unique areas and at the terrain tile's resolution, with a content hash, in class areas.
>
> The transect is PASSED when every `unique-area` row passes on its areas. §10's "every axis" means every threshold id.

**5. Correct the numbers** (§3): add T-A2s2, T-A2r, T-A2f2, T-A5d, T-J3e with the "perpetual 467" decision, the T-E1 metric,
the T-J4 metric, the T-G5 floor, T-G1l band rows, T-E6e scoped with T-E6w, T-F3s2, T-F3r, T-F3x, T-K5s, `data/verbs.json`,
T-B2s, and the T-A3c aureole exclusion. Supersede the wrong rows by the errata route. **Replace `MASTER_PLAN.md:230-233`'s last
sentence** with:
> Tier 1 needs Σ(n per stratum) ÷ 4 views a session to hold T-B3 (≈ 1,220 for 80 unique strata and the transect). The
> instrument session measures what the slot carries with the bots running. If it falls short, T-B3 reads FAIL and a BLOCKERS
> row logs ≥ 3 approaches; the rotation target is never raised.

**6. Implement and pin the defaults; correct the overclaimed statuses** (add to §6 step 1, l. 265):
> …the court coming and going **by default** (UD-10: `courtCalendar` defaults to the reconstructed court, labelled C) and
> `tests/defaults.test.ts` pinning every decided default (court, FOV 60, bob 1.8 cm, a new seed per game, D-239's start day);
> the statuses of T-D3, T-I1f, T-E6, T-E6e, T-K3, T-K5, T-R2 and T-R3 corrected to what their tools measure; the 60 empty
> anti-proxies written; TASKS.md's `[x]` removed.

**7. Fix step 2 and the deadlock** (replace `MASTER_PLAN.md:266-267`):
> 2. **The cheapest honest instrument (time-boxed to one session; what is not built by its close reads NOT-MEASURED on the
>    board and stays first in the next session):**
>    - the renderless mode first, with its throughput (bot-hours per core-hour, with Tier-1 jobs running) written to
>      `gates/budget.json`;
>    - the area registry;
>    - Tier 0;
>    - the walker bots (five policies, the prober included);
>    - the Tier-1 sampler;
>    - the generated board;
>    - the anchor set and `REVIEWS/escapes.md`;
>    - `data/event_kinds.json`.
>
>    Tier-2 judgement starts once the transect has 0 Tier-1 hard fails. Until then, T-J5 and T-R3 accept an agent render at
>    the player's lens and quality, logged in `sessions/sNN.md`, and T-R0 reads NOT-MEASURED.

**8. Add the missing rows** (§4 of this review), each with its axis and TO-BUILD status: T-C1f (close-up faces), T-A4m (§1.1
moments), the brief §13 numeric gates (T-I6…, T-D6, T-F7, T-R4), T-H3s/T-H3v (save size and compatibility), T-F6x
(cross-engine determinism), T-K7/T-K7c (download size, compile hitches), GPU memory and heap ceilings, the bench running the
simulation over the heaviest routes, WebGL2 fallback, ×600, T-G6/T-G6o/T-G2m (acoustics, music), the T-K1a corpus rule,
T-I4/T-I4c/T-I4n (translation layer), T-R5 and T-I5 (representation; attested people alive in 467), T-I7 (real objects in
their moment), T-K3f and per-channel volume, the near-plane hard break, and the Terrace-fall decision. Append to the
programme (after l. 319):
> - **Hour 1 and delivery:** title, loading and click-to-start judged as part of the time capsule; download and first-frame
>   budgets on real hardware; saves in IndexedDB that survive updates; one playable build per session at a stable URL, with
>   three places worth walking to now.
> - **Ethics and representation (brief §12):** kurtaš, children and punishment as the evidence shows; women's dress tiered;
>   the living religion shown only as attested or as wordless action; delegations' peoples without caricature; attested people
>   only in their attested lifetimes; reviewed every audit round (T-R5).

**9. Records hygiene at close** (add to the session loop, `MASTER_PLAN.md:289-290`):
> …every worktree branch merged or abandoned with a DECISIONS or BLOCKERS row; no cited D/Q/B number missing from its record;
> the `ratchet/sNN` tag pushed; CLAUDE.md's descriptions of tools checked against the files on the branch.

**10. Mark TO-BUILD everywhere it applies:** l. 219-223 (`coverage_points.ts`, `coverage_report.ts`), l. 231 (`gates/budget.json`),
l. 235 (the evidence-size test), l. 289 (`sessions/`), l. 347 (`REVIEWS/escapes.md`), and CLAUDE.md's "Every inch" section.

---

*Evidence of the attacks.* All routes were run in a throwaway clone at `4309d2b` with the two guard tests only:
- R1–R11: 10/10 green each;
- R7: 4/4 green;
- R14: red (the demotion guard).

The repo itself was never modified, apart from this file.
