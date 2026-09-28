# ROADMAP — finishing PĀRSA within the usage budget (written session 12, 2026-09-28)

The user's constraint: finish everything without the weekly usage ever reaching 97 %. Measured in session 12: about 1 % of the
weekly all-models budget per agent-hour (~14 agents x ~4 h used ~55 %). So a week holds ~85 agent-hours with margin.

## Finished means all four pillars (USER_DIRECTIONS UD-19..UD-26; MASTER_PLAN; the board)
1. **Looks real:** every inch passes a whole-view blind review against references/ (D-233; HANDOFF "The bar").
2. **Runs:** 30 fps and a load of about a minute on the target hardware (T-K6, T-K7; B125).
3. **Is alive:** an emergent simulation, with or without the player (UD-24, UD-26; T-F9, T-E13).
4. **Is interactive:** the speech sandbox (UD-18, UD-21, UD-22, UD-23, UD-25; T-E9..T-E14).

## The remaining work, costed (agent-hours)
| Work | h |
|---|---|
| Load time + frame rate to playable | ~20 |
| Photoreal every inch (light and tone, large-scale variation and grime, colour and paint, fill density, the open faults of s12) | ~40 |
| Emergent core (economy, needs, household decisions, disputes and justice, consequence chains, talk as actions) | ~35 |
| Speech sandbox (the 10 UD-25 mechanics, save and replay, tests) | ~30 |
| Model grounding, voices, proximity mic, people talking to each other | ~25 |
| Integration, playtest, hardware tiers, download size | ~20 |
| **Total** | **~170** |

## Schedule (weekly budget in brackets; the all-models week resets Wednesday 01:00 UTC)
| When | Session | Budget |
|---|---|---|
| Rest of week to 2026-10-01 | Cloud: 2-3 agents lay the economy and needs foundations (node) | <= 10 % (the week was at 84 %) |
| Week of 2026-10-01 | **Vagon A:** load time first (the lead, first 1-2 h), then frame rate and photoreal round 1 (<= 6 agents). **Cloud B:** emergent core + talk as actions | ~45 % + ~40 % |
| Week of 2026-10-08 | **Vagon C:** photoreal round 2 on the worst views, model grounding and speed, voices, proximity mic, people talking to each other (voiced). **Cloud D:** the 10 mechanics, chains tuned, tests | ~45 % + ~40 % |
| Week of 2026-10-15 | Integration and playtest, the final whole-world check, buffer | ~40 % |

## How every session runs
- **Open (about 1 h):** ~20 whole-world renders judged against the photographs; one frame-time number; one "is it alive" check
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
