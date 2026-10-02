# Session 15, cloud (depth track): report

Branch `cloud-s15-depth` (pushed; the Vagon lead merges). Brief: handoff/briefs/s15/cloud.md, then the addendum cloud_talk.md (UD-31).

## Broken, placeholder or unverified on screen (first)
- **Nothing here has been seen in the browser or heard with a real model.** The cloud has no GPU: every result below is a node
  test or a node measurement; the talk is tested with the deterministic stand-in model (plumbing only).
- **UD-31 talk on by default (D-376): unmeasured on a GPU.** Whether Qwen2.5-0.5B keeps T-E9/T-E10 grounding is unknown (the
  next step if not: Llama-3.2-1B, ~750 MB); Kokoro fp16 vs fp32 sound unheard (A/B: `?neuraldtype=fp32`); the "five frames
  after the world is shown" start and the 1.5 s delay before the model streams are untested in the page.
- **Render-side hooks made by the cloud in Vagon's files (smallest possible):** src/world/world.ts (strangerPresence in the
  audio loop; thinCaption on captions; asks: true; NeuralVoices lazy), src/main.ts (talk mounted by default; start after
  frame 5), src/ui/shell.ts and src/core/settings.ts (the Talk setting). Review them on merge.
- **talk_world 450-token check:** failed at 453 (one T-E9 case: a girl in a house of six); fixed by naming a large house to its
  first three (D-374), re-run pending at the time of writing.
- **B230 (brides branch):** merged s14-int into it locally (a8fee681, plans.ts conflict resolved: both sides kept); the three
  named d211 failures are being compared on both trees; NOT pushed to s13-bridesmerge yet.
- Small children's days have few distinct
  reasons (a 2-4 year old follows the mother; their plans are pinned by people_days, left as they are).
- The soak per seed (task 4) did not run this session (the box was given to the B230 comparison and the talk work).

## Since the first draft (more parallel work: two local agents and cloud sessions at a time)
- B400 CLOSED (D-378): the day-300 save 3.74 MB -> 756 KB, lossless. B401 CLOSED (D-380, a cloud session): 79.1 % of the
  economy's steps laid in real people's days (was 58.2 %). B234 CLOSED: the trust gate in conversation.
- The proximity mic, simulation side (D-379): earshot by loudness and distance, the addressee by name or facing, bystanders
  overhear and tell on, a shout turns heads. Render side: `__converse.say(text, heardMs, rmsDb)`, `state.heard.look`.
- People come up to the stranger with their house's need, or a friendly house invites him in the evening (D-375 approaches);
  the town talks of his deeds (rumours with him as the subject, trust moves); a family remembers one past (couples, siblings).
- The stranger learns words one by one (known words are no longer glossed; "your word for bread" teaches it), must eat (hunger
  is seen and pitied), buys and sells by haggling, addresses groups; his deeds are in the chronicle (key J).
- Landed since: marriages in the economy (D-381: bride-gifts, dowries and divorce silver paid between the houses, borrowed or
  owed when short; 215 chains through weddings), reactions on sight (D-385: greet by name, bow, avoid, stare, nod; village
  children tag along), complex asks need words (the tongue opens doors), nights in the open (chill, the night watch, the sealed
  document), the stranger must eat, an approaching person is told why they came; COVERAGE.md regenerated (guards green).
- Render hooks still to wire (Vagon): `sim.strangerSeen(near, at)` (play the reaction kind), `__converse.say(text, ms, rmsDb)` and
  `state.heard.look` (the mic and the heads that turn).
- In flight at the time of writing: personality facets for everyone (D-382), the court in the economy (D-383, cloud), entering chains by speech (D-384, cloud), a playtest bot's
  year of talk (cloud, report), the soaks and full measurements (cloud), B230 (cloud, on s13-bridesmerge).

## What a player would now meet differently
- **Talking is on by default** (no flag): the models (~0.4-0.5 GB) stream in after the world appears; before that, a person
  answers with a line of their own in their own voice.
- **People speak from their real lives:** a past before this year for everyone (birthplace, parents, marriage bound to their
  children's ages, children lost young, the king's war and the levy, the town's own hard years shared by neighbours); hopes and
  worries from their own state; their house's real debts and dealings (no seeded fakes); what their house needs and whether
  they would ask a stranger; the rumours their house holds (with doubt); bynames ("son of X") so the town's 209 names stop
  repeating (namesakes in a quarter 93 % -> 11 %); children speak of their playmates.
- **The stranger is a person of the simulation:** ask for work (hired at the harvest, paid from the house's stores, owed and
  petitioned for, dismissed for days missed), guest-right (the host cooks more and makes up a bed; three nights of custom;
  ingratitude the lane hears), say who you are (believed or doubted by your deeds, spread by rumour), petition the quarter's
  elder, an official or the court (wages, a plea, relief, a sealed document), join a treasury gang, a caravan, a household;
  your comprehension of each tongue grows and the subtitles thin as you learn.
- **Gossip has teeth:** a house that hears a rumour of a theft or a default trusts the house it names less, and the economy's
  lenders and employers read that trust; a house shunned over a rumour, or in a quarter feared for its sickness, gets no help
  from those who shun it (8 % of offers withheld at day 120).

## Numbers
- Depth audit (tools/dev/depth_audit.ts; 60 people, seeds 1, 7, 42, day 150; share thin): history 0.58 -> 0; talk material
  0.23 -> 0.02; ties 0.13 -> 0; reasons 0.13 (small children); home, family, work, voice, day/year change, economy 0.
- Stranger's scripted year (tools/dev/stranger_year.ts, 3 seeds): 5-11 chains through the stranger; 78-82 % of the stranger's
  deeds reach another house (T-E13's second part); comprehension 0.6-0.9 in the tongue lived in.
- Hopes/worries: 287 of 300 people have something on their mind (42 kinds). Asks in talk: 40/40 houses with open asks speak of
  them; 2,043 rumours held at day 120. Gossip -> trust: 530/565 pairs.
- Overheard talk (T-E12's metric, D-377): 97.5 % of 240 exchanges grounded, in a shared tongue, own voices, unrepeated; the
  topic carried by the spoken words in 62.5 % (no Old Persian word for grain or silver is attested: the note carries it).
- Samples of what people are told and what they say: sessions/s15-cloud-samples.md (tools/dev/talk_samples.ts).
- Test cost: a world jumped to day 150 ~80 s; loaded from the cached fixture ~1 s (D-374).

## Tests run (node; this branch)
stranger 9/9; stranger_talk 25/25; history 9/9; defaults 7/7; sim_fixture 1/1; trust, haggle, asks, emergence 20/20;
living_world 22/23 (B400 save size, pre-existing); econ_plans 3/4 (B401, pre-existing); converse 10/11 (the test-set timeout
under load; the same 4.5 min on s14-int); talk_view 2/2; talk_world 13/14 before the D-374 prompt fix.

## Decisions
D-370 the stranger (work, language, identity, petitions, hospitality, groups; their days in the people's plans; the render
hooks), D-371 the depth audit, a past, playmates, real debts, D-372 bynames, D-373 hopes and worries, D-374 the cached test
world, D-375 needs and rumours in talk, gossip moves trust, asks on in the game, D-376 talk on by default with small models.
Blockers B400, B401.

## Branch tip
See `git log origin/cloud-s15-depth -1` (updated as the session goes).
