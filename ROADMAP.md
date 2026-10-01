# ROADMAP — PĀRSA

# THE WEEK PLAN (session 14, 2026-10-01 → 2026-10-07; UD-28) — governs over everything below it

## What finished means this week (the user's words, not the board's)
A player opens a URL, waits about a minute, and walks a living Persepolis of 467 BC that looks like a top modern open-world
game everywhere they go (UD-06, UD-19), runs smoothly (30 fps on the T4), is full of people living their own lives that the
player can see (UD-07, UD-08, UD-09, UD-26, UD-27), and can talk to anyone, who answers from their real life and is changed by
it (UD-18, UD-21 … UD-25). Four pillars: **Runs, Looks, Alive (as seen), Interactive (as played).**

**Honest limit:** MASTER_PLAN §10 (all 183 thresholds PASS) is not reachable in a week by construction: ~11.7k coverage views,
~4k bot-hours, n ≥ 60 GPU conversation runs per row, a calibrated anchor set. This week ends with the four pillars met in whole
views and play, and the board measured in batch (one soak per seed overnight, renderless bots, the coverage sample inside the
render train), with every unmet id listed. Thresholds are not lowered.

## Audit (2026-10-01) — what is true now
- **Runs:** a load is ~15 min (world build ~9 min on 4 cores, then ~1000 pipelines); 4-5 fps at high (B125); profiler never run.
- **Looks:** every blind review reads 100 % CG; s12/s13 work never reviewed. Tells: shade with no sky/bounce light, no
  large-scale variation on big surfaces, empty plain and courts, reliefs as stickers, boxy edges; black ground flora (bug).
  Real assets: columns, colossi, props, rocks, flora, animals, trees, Ajori, Naqsh. Still primitives: Terrace walls/floors/steps,
  palace and house wall bodies (the biggest share of the screen).
- **Alive:** deep node simulation (economy, relations, wardrobes, talk, trust, rumour, T-F9 378 chains) but the player sees only
  people walking: wardrobes, haggling, laundry, weddings, talk events are never drawn or heard.
- **Interactive:** conversation works behind `?converse` only, grounded on seeded fakes (life.ts), cut off from the economy;
  4 of 10 UD-25 mechanics node-only; no NPC-to-NPC voiced talk; no proximity mic; T-E9 ~60 %.
- **Health:** tsc 23 errors (tools/dev/audit_d only); guards pass; people_days files take hours; board 0 PASS.

## How the agents work (the operating model; handoff/agent_template.md "Operating model")
1. **At most 4 agents at once on the 16 GB box** (session 14: nine crashed the session and froze the app for hours); free memory checked before each launch; agents commit every 30 min.
   **Ready queue, disjoint ownership.** Every package below is pre-briefed (handoff/briefs/s14/packs.json →
   `node tools/dev/brief.mjs`) with the files it owns; packages running together never own the same file. A finished
   agent is replaced from the queue within the lead's next check (~20 min).
2. **Context packs, not records.** Each brief carries entry points, the ids that matter, commands and a player-visible done
   line; agents grep records, never read them whole (DECISIONS.md is 8.9k lines).
3. **One-command worktrees** (`tools/dev/mkwt.mjs`: node_modules and models linked, own port): no npm ci, no disk copies.
4. **Probe pages to iterate, the render train to verify** (`tools/dev/render_train.mjs`): agents never pay a full-world
   load; their views ride the lead's one batched load on `s14-int`. Trains at ~09:00, ~14:00, ~20:00 daily, hourly once the
   load is about a minute. Metric: views per full-world load (T-R14 ≥ 10).
5. **Slots:** two GPU slots (`gpu_slot.mjs`), two CPU slots at low priority (`cpu_slot.mjs`, new: the bash one never ran on
   Windows). Overnight the CPU slots run the soak seeds and the slow tests; the GPU slots run Cycles bakes.
6. **Stop rules:** done line met → stop; three failed approaches → BLOCKERS and move on; time box → commit and report.
7. **Integration:** the lead merges finished branches into `s14-int` (guards + the agent's tests), runs the train, judges
   whole views against references/ in one pass, and fast-forwards `claude/amazing-fermi-40ds7j` and pushes after each train.
   No per-change reviews; one blind review on day 6.
8. **Tests:** agents run only related tests; `test:fast` (< 5 min) gates merges; `test:slow` runs overnight.

## Waves (each line is one agent; G = needs a GPU slot, B = Blender, N = node only)
**Wave 1 — day 1 (launched 2026-10-01):** load (G) · frame (G) · plain (G) · light (B) · blender (B) · simtalk (N) · visible (N) · simhealth (N)
**Wave 2 — day 2-3 (as wave 1 lands; packs written from the day-1 train):**
- surfaces (G): grime, wear, large-scale variation on every material (scans.ts, masonry.ts, blockface.ts, materials.ts) — after frame
- walls (B): Terrace walls/floors/steps (real chipped arrises, B145) and palace + house wall bodies (B186) as kit meshes with LODs and impostors; village compounds hollow (B64) — after light
- fill (G+B): courts, lanes and interiors filled: market stalls, awnings, banners, laundry lines, scaffolds, braziers, textiles, lamps, goods, density of people at every hour (furnish*, settlement build, courtCamps, crowd density)
- bodies (B): every body different, faces plain to beautiful, pregnancy, nursing, age marks, scars (3b); soft-tissue jiggle (3c); garments re-draped per shape band; impostor atlas re-baked with the far people's spears, bows and tools (B176); wardrobes drawn: outfit swaps, per-garment dirt, undressing to sleep and wash (3d render side)
- columns2 (B): see the Blender table
- converse (G): conversation on by default (menu, consent, VRAM check), model dirs trimmed, real-model T-E9/T-E10 — after simtalk
- overheard (N→G): the simulation's talk events voiced near the player; NPC-to-NPC exchanges grounded in both lives (UD-23, T-E12)
**Wave 3 — day 4-5:**
- reliefs (B): paint as thin pigment on stone, floors and courts re-surfaced — after surfaces
- verbs (N): the remaining UD-25 mechanics: work and livelihood, learning the language, identity, hospitality, groups, petitions
- mic (G): the proximity mic (loudness and distance, bystanders react, open mic with voice activity, room acoustics)
- night (G): town lanes lit, night clouds, fires, dusk and night in every area
- water (G+B): rivers and canals: reeds and boats modelled in Blender, washers, mud, waterfowl
- peoplemotion, drape2, windcloth, vegimpostors (B): see the Blender table
- worst-area round (G/B ×2): the two worst areas of the day-4 train
**Day 6 — measure:** overnight soak on 3 seeds and slow tests (CPU slots), renderless bot fleet, the coverage sample and every
area in one train, one blind review against references/; two agents on the worst findings.
**Day 7 — finish:** integration, perf tiers (medium default if high misses 30 fps), download size, FINAL_REPORT.md (broken
first), session close (sessions/s14.md, branches merged or abandoned, push verified).

## The Blender work, by day (UD-20: "all of it, for everywhere")
| Day | Package | Blender work |
|---|---|---|
| 1 | light | Cycles lightmaps (AO, sky, bounce) for the Terrace, palaces and town houses; outdoor probe grid |
| 1 | blender | --verify reproducibility; colossi and capitals re-carved from the photographs (B118); the far Terrace level and impostor (B175) |
| 2-3 | walls | Terrace walls, floors and steps and palace and house wall bodies as kit meshes with LODs and impostors (the largest share of the screen still primitives) |
| 2-3 | bodies | shape keys for every body (3b), jiggle-bone rig for secondary motion (3c), garments re-draped per shape band, the impostor atlas re-baked (stale today: the CPU fallback costs ~12 s of load) |
| 4-5 | reliefs | relief paint as thin pigment on carved stone; the 21 of 41 relief kinds not yet from photographs |
| 1 (now) | animalmotion | secondary motion for all 34 animals (bellies, dewlaps, ears, tail chains, pack loads) and birds' take-off blend (B179) |
| 1-2 | monuments (was columns2; D-365) | the colossi and capitals from licensed scans or a photo-driven re-sculpt (B118), plus griffin and lion protome capitals; one member per column order; 2-3 shaft tile variants; carving in the silhouette near the eye (B166, B167); lamassu heads if the blender package leaves them |
| 4-5 | peoplemotion | secondary motion on hair, beards, sash ends, tassels, jewellery and carried loads in the bodies' spring pass; hair cards beyond 25 m, the bob no longer a helmet (B151) — after bodies |
| 4-5 | drape2 | posed drape (seated, kneeling, carrying; B123); 2-3 fold variants per group and real panel patterns (B149); fold normal maps under the triangle cap (B148) — after bodies |
| 4-5 | windcloth | cloth loops baked as vertex-animation textures for tents, awnings, banners and laundry, driven by the weather's wind — after fill places the awnings, banners and lines |
| 4-5 | vegimpostors | Cycles octahedral tree impostors per season state (B163); 3-4 variants per flora kind with wind weights (B180) — after plain |
| nights | (GPU slots) | the long Cycles bakes queue overnight through gpu_slot.mjs |
Every BLENDER_PLAN row is then built world-wide; the rows already done in session 12 (animals, flora, frames, tents, birds, Ajori, Naqsh, columns, props) get fixes only where the train shows a fault.

## The lead's loop (every ~20 min)
Check agents and slots → merge what landed into s14-int (guards + related tests) → launch the next package from the queue →
at train time run the train and judge whole views on one question (does this look AAA and full of life?) → turn the worst
findings into the next packs. Keep both GPU slots and both CPU slots busy; never two agents on one file.

---
# (Older plan, session 12; superseded where the week plan differs)

No usage cap and no cap on the number of agents (the user, 2026-10-01: the weekly window reset; "remove the cap on agents", "drop the 97%"). Measured in session 12: about 1 % of the
weekly all-models budget per agent-hour (~14 agents x ~4 h used ~55 %). So a week holds ~85 agent-hours with margin.

## Finished means all four pillars (USER_DIRECTIONS UD-19..UD-26; MASTER_PLAN; the board)
1. **Looks AAA:** every walkable inch looks like a top modern open-world game: rich, dense, beautifully lit, full of life (the plan below).
2. **Runs:** 30 fps and a load of about a minute on the target hardware (T-K6, T-K7; B125).
3. **Is alive:** an emergent simulation, with or without the player (UD-24, UD-26; T-F9, T-E13).
4. **Is interactive:** the speech sandbox (UD-18, UD-21, UD-22, UD-23, UD-25; T-E9..T-E14).

## The remaining work, costed (agent-hours)
| Work | h |
|---|---|
| Load time + frame rate to playable | ~20 |
| AAA every inch: the global look systems and the area-by-area fill (below) | ~40 |
| Emergent core (economy, needs, household decisions, disputes and justice, consequence chains, talk as actions) | ~35 |
| Speech sandbox (the 10 UD-25 mechanics, save and replay, tests) | ~30 |
| Model grounding, voices, proximity mic, people talking to each other | ~25 |
| Integration, playtest, hardware tiers, download size | ~20 |
| **Total** | **~170** |

## Schedule (weekly budget in brackets; the all-models week resets Wednesday 01:00 UTC)
| When | Session | Budget |
|---|---|---|
| Rest of week to 2026-10-01 | Cloud: 2-3 agents lay the economy and needs foundations (node) | <= 10 % (the week was at 84 %) |
| Week of 2026-10-01 | **Vagon A:** load time first (the lead, first 1-2 h), then frame rate and the AAA pass round 1 (global look systems, fill) (<= 6 agents). **Cloud B:** emergent core + talk as actions | ~45 % + ~40 % |
| Week of 2026-10-08 | **Vagon C:** AAA pass round 2 on the worst areas, model grounding and speed, voices, proximity mic, people talking to each other (voiced). **Cloud D:** the 10 mechanics, chains tuned, tests | ~45 % + ~40 % |
| Week of 2026-10-15 | Integration and playtest, the final whole-world AAA check, buffer | ~40 % |

## The AAA plan: every inch looks AAA and is filled in
**1. Global systems (lift every inch at once):**
- Lighting with a ray-traced look: Cycles path-traced lightmaps and GI baked for all static architecture and terrain; real-time GI,
  reflections and AO for people, animals and time of day; rich contact shadows; atmosphere and haze. (The browser has no hardware
  ray tracing; baked path tracing plus screen-space and probe techniques give the look. A native engine stays an open choice.)
- Surfaces: large-scale variation and grime on every material (stains, run-off, dirt near the ground, wear along paths, colour
  shifts); no single-colour surface anywhere.
- Colour: a cinematic grade; relief paint as thin, believable pigment over stone, not saturated stickers.

**2. Fill, area by area (signed off only when whole views of the area look AAA and full at walking distance):**
| Area | Filled means |
|---|---|
| Plain and hills | dense steppe cover, crops in every field, orchards, irrigation channels and qanat lines, tracks, flocks and herders, field workers, huts, dust |
| Town and villages | lane clutter, laundry, animals, market stalls, smoke, doorways and courts full of life and things |
| Terrace and palaces | guards, officials, servants, tribute bearers, awnings and banners, braziers, scaffolds and building debris |
| Interiors | furniture, goods, textiles, lamps, soot, occupants |
| Rivers and water | reeds, boats, washers, mud, waterfowl |

**3. Density of life:** more people and animals doing visible things everywhere, at every hour.
**3b. Every body different (the user, s13):** today each person is one of a few body variants scaled by height only (src/people/looks.ts:181, ±7 %). Replace it with continuous, seeded body and face variation for men and women: build and weight (lean to heavy), musculature, shoulders and hips, bust size from small to very large, belly, posture, facial structure and features, from very plain to very beautiful, plus age marks, scars, pregnancy and nursing. The spread is the real one (a bell curve: most people ordinary, both extremes rare but present, so any walk can meet either), shaped by the period: labour and diet (lean field hands, heavier well-fed households), age, and illness from the economy. Garments drape over the actual body (the cloth bake per shape band). Blender shape keys on the base meshes, driven by the person's seed and life; GPU work (Vagon), ~6 agent-hours.
**3c. Everything moves with physics (the user, s13):** soft-tissue secondary motion on every body, scaled by its size and firmness: breasts, buttocks, belly, thighs, upper arms, jowls, with bounce, sway and settle in walking, running, work and sitting (spring-damper jiggle bones on the skinned rig, computed on the GPU or in a worker so crowds stay cheap, fading out with distance). The same for everything else that should move: garments and loose cloth, hair and beards, jewellery, straps and tassels, loads carried, animal bellies, ears and tails, awnings and banners in the wind. Tested by motion capture of a walking person against reference footage for lag and overshoot; ~4 agent-hours alongside 3b.
**3d. Clothes change (the user, s13):** today people change only in part: a cloak against the cold, a wrap against the dust, the best clothes for a wedding, the plan's wear bits shown on the body (src/people/population.ts coldWear/dustWear, src/people/crowd.ts wearBits); otherwise each person wears one outfit for life. Give each person a wardrobe owned by their household (few garments for the poor, many for the rich), bought, made, mended and handed down through the economy, and chosen each day by the plan: work clothes and best clothes, undressing to sleep and to wash, bathing and river-washing days, festivals, mourning, weddings, season and weather; dirt and wear build up through the day and the week and go when the garment is washed (the washing trips already in the plans). Node side (wardrobe, choice, economy) is cloud work (~3 agent-hours, after econplans merges); the render side (outfit swaps, dirt state per garment) rides with 3b.
**3e. Relationships and sexuality as life (the user, s13):** courting, marriage, lovers and affairs, desire and rejection, fertility, conception, pregnancy and births from those relationships, jealousy, scandal, divorce, doubtful parentage, and the period's law and custom on them (tier C where silent); the player can court, marry, take a lover, share a home and a bed, and live with the consequences, the partner with her or his own day, moods and memory of how the player treated them. Not explicit: intimacy is implied and cut away from; people undress themselves only in the ordinary course of the day (sleep, bathing, washing, changing), and there is no player action to undress another person. Node side after 3d (~4 agent-hours, cloud).

**4. Paired with performance:** everything instanced, with detail levels and cheap far versions, grime in shaders, so density costs
little frame time.

## How every session runs
- **Open (about 1 h):** ~20 whole-world renders judged on one question: does this look AAA and full of life?; one frame-time number; one "is it alive" check
  (follow people for a day; count what happened in a simulated week). The worst pillar gets the session's bulk work.
- **Build en masse** with a fixed scope; nothing is added mid-session.
- **Close:** the same check again, merge every branch, push (verified against GitHub, never a log line), a short report that
  leads with what is broken.
- **Agents:** as many as the work and the machine can use; focused scopes, short reports, every GPU job through tools/dev/gpu_slot.mjs (the machine's GPU slots are a hardware limit, not a rule), no stale jobs holding a slot.
- **Model:** every agent runs on Opus 5.5 (the user, 2026-10-01). Waste is still waste: batch renders, no agents idling on GPU slots, no repeated rounds.

## Risks that could add a week
The in-browser model cannot reach 90 % grounding inside the Windows GPU watchdog (then: heavier grounding by the simulation, or a
CPU path); high quality cannot reach 30 fps on the target hardware (then: medium as the default tier). Both show in Vagon A or C.
