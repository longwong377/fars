# Session 15, cloud (depth track): report

Branch `cloud-s15-depth` (pushed; the Vagon lead merges). Brief: handoff/briefs/s15/cloud.md, then the addendum cloud_talk.md (UD-31).


## NEXT SESSION STARTS HERE (handoff, 2026-10-02 ~09:30 UTC, cloud lead "Fars 18")
Read this, then `git log origin/cloud-s15-depth -15`. **UD-32 governs the cloud now:** "I want my voice to be able to do
anything and an actual brain in every npc in a sandbox world" and "it shouldnt be at all dependent on the player ... an organic
sandbox with or without the player". The user also said "prove the voice as well at the same time".
- **Landed (this branch):** D-455 the stranger's living loop (market stalls, a day's hire, bread by the loaf); D-459 the open-deeds
  core: src/people/deeds/ (57 verbs, grammar + model JSON schema, the engine) and src/people/mind/minds.ts (feelings, memory,
  decisions, initiative, the economy's events felt). Without the stranger a month (seed 1, days 60-90) has ~3,700 deeds by ~3,300
  people in 7 kinds (kin helping sick and burnt houses, comfort in mourning, gifts, meals, visits, insults, keeping away) and
  cases before the elders, for ~72 ms of CPU a game day (tools/dev/minds_month.ts). The page reads free speech into a deed with
  the model (Mind.readDeed, WebLLM JSON mode) when the grammar finds none: unheard (Vagon).
- **Sessions running (each its own machine; merge their branches into this one when they report):**
  D-456 talk eval on the shipped 1.5B (session_01JvEym34pgDHVAb13K6ZAxi, cloud-s15-talkeval: interim 55 % of 407 turns clean,
  fixes in, after-run then the deed-reading eval); D-457 women's names (session_01TKQsWenzGTJf1KNQptNaoV, cloud-s15-names);
  D-458 market stallholders (session_013E7vWSWMxRnv1eMCZxF7wv, cloud-s15-market); D-460 law and feuds
  (session_01VsnxVbmdWbN9at5ghUbVfa, cloud-s15-law); D-461 minds' goals at scale (session_01Gt3UYsr9x5YELtkvv2y2Rp,
  cloud-s15-minds); D-462 deeds made physical (session_01X78J4wqvaLNLwjGmdgQaM4, cloud-s15-joint); B230 brides
  (session_01YY3WBdP7cdEqwqtZhcadWQ, s13-bridesmerge).
- **Broken / open:** the NPCs' own deeds judge busyness by the hour only (the cost; D-461 to make it smarter cheaply); the
  talk_world 450-token test times out under vitest (337 s, 6 s under tsx: unexplained, parked); nothing seen or heard in the
  browser; Vagon has not merged D-382 onward.
- **Numbers:** the cloud continues from D-463 (D-455..D-462 used).
- **Box rules learned:** agents share one working tree locally, so prefer cloud sessions (own machines); inline `//` comments
  inside one-line code have swallowed code: end of line only.

## For the Vagon lead (now; written 2026-10-02 06:40 UTC after reading s14-int to 72c45ec1)
- **Merge cloud-s15-depth into s14-int: 25 commits are waiting (D-382..D-391, D-450..D-454).** s14-int is already merged into
  this branch (6b5b87f2; only DECISIONS conflicted, kept as a union; guards 25/25, defaults/talk_view/sight 14/14), so the
  merge should be clean. What a player meets: a personality for everyone, the court in the economy, chains entered by speech,
  period speech overheard, a past for everyone that reaches the model, mutual spouses, names dealt round, visible marks,
  guest-right that cannot be farmed, no digits in anything the model reads.
- **D-394 seen and agreed** (Qwen2.5-1.5B; thank you for the lab table). The cloud's grounding work was all checked against the
  deterministic stand-in only; the 1.5B is now the model every prompt here is written for (≤ 450 tokens, D-296).
- **Render hooks waiting on you (simulation side done, nothing on screen yet):**
  1. `sim.strangerSeen(near, at)` a few times a game minute: play `kind` (greet by name, bow, nod, stare, avoid, ignore) on
     the person; `follow` = a village child tags along (src/people/converse/sight.ts).
  2. The mic: `__converse.say(text, heardMs, rmsDb)` and `state.heard.look` (the heads that turn: D-379).
  3. Visible marks: `marksOf(pop, pid, day)[].look` (scar_brow, limp, mourning, with_child, stoop, craft_*; src/people/marks.ts).
- **Load overlap:** cloud-s15-load (D-386, the node bake, .github/workflows/world-bake.yml) vs your s14-load: compare before
  merging either (notes at the top of bench-reports/load_s15.md). Your D-393 report says walkable ≤ 60 s needs exactly that bake.
- The cloud continues from D-455. Questions for the cloud: write them in this section on s14-int or here; the next cloud session
  reads it first.

## The playtest bot's year (a scripted stranger talking for 355 days, seeds 1 and 7), and what was fixed (D-391)
- **Was broken:** from about day 55 the town refused to talk to him in 85 % of turns (2,146 of 2,520). Every house that privately
  doubted his story lowered his standing with everyone, and the story reached about 9,000 houses. Now a doubt is that house's
  own view (its kin hear it); telling the same story again records nothing new; a penniless guest is no ingrate. The bot's
  re-run for the before/after share is pending at the time of writing.
- "Lead me to the market / the court / the smith" was unknown in 86 of 93 asks. Now the market, the court and the
  workshops by craft are known places.
- Asking for work was refused 9-11 times out of 11 with no lead. Now a house with no work names a house in the quarter that needs a hand,
  or says the king's works take men on.
- A child following the mother between two close errands no longer appears for 3 minutes at another place without a walk
  (econ_plans, 1 in 2,784 person-days).
- Still open from the bot: the prompt carries digits ("17 years ago", "day 21"), which a model could repeat aloud; "bank" (a
  river bank) flagged as a modern word (a false positive).

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
After D-391 (03:3x-04:xx): econ_plans, stranger_talk, speech_sandbox, talk_world 52/52 (the 450-token prompt check and the walk check included); stranger, approach, trust, talk_places 20/20; the integration batch before the fixes 106/107 (the one failure fixed in D-391).
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
