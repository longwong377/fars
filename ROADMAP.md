# ROADMAP — finishing PĀRSA within the usage budget (written session 12, 2026-09-28)

The user's constraint: finish everything without the weekly usage ever reaching 97 %. Measured in session 12: about 1 % of the
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

**4. Paired with performance:** everything instanced, with detail levels and cheap far versions, grime in shaders, so density costs
little frame time.

## How every session runs
- **Open (about 1 h):** ~20 whole-world renders judged on one question: does this look AAA and full of life?; one frame-time number; one "is it alive" check
  (follow people for a day; count what happened in a simulated week). The worst pillar gets the session's bulk work.
- **Build en masse** with a fixed scope; nothing is added mid-session.
- **Close:** the same check again, merge every branch, push (verified against GitHub, never a log line), a short report that
  leads with what is broken.
- **Budget:** read usage at every check-in (mcp get_usage); stop launching at the session's budget; wind down (final commits)
  at 92 % weekly; nothing runs at 97 %. At most 6 agents at once, focused scopes, agents reused rather than restarted, short
  reports, every GPU job through tools/dev/gpu_slot.mjs, no stale jobs holding a slot.
- **Model:** every agent and the lead run on Opus 5.5 (the user). The only lever on the budget is waste: fix load time first, batch renders, no agents idling on GPU slots, no repeated rounds, short reports.

## Risks that could add a week
The in-browser model cannot reach 90 % grounding inside the Windows GPU watchdog (then: heavier grounding by the simulation, or a
CPU path); high quality cannot reach 30 fps on the target hardware (then: medium as the default tier). Both show in Vagon A or C.
