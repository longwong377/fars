# Session 15, cloud (depth track): report

Branch `cloud-s15-depth` (pushed; the Vagon lead merges). Brief: handoff/briefs/s15/cloud.md, then the addendum cloud_talk.md (UD-31).


## NEXT SESSION STARTS HERE (handoff, 2026-10-02 ~06:00 UTC)
Read this section, then `git log origin/cloud-s15-depth -15`. Branch `cloud-s15-depth`; Vagon merges it into s14-int and
deploys Pages from there (D-370..D-391 are live; D-382 onward wait for Vagon's next merge).
- **Still running when this session ended** (collect, verify their push, archive with archive_session):
  soaks per seed (session_01Y3BRtndaPvEPWgo5D6HNjd, report only, slow box); B230 the adult-brides branch
  (session_01YY3WBdP7cdEqwqtZhcadWQ, branch s13-bridesmerge, comparing test failures). D-452 (spouses mutual, names
  dealt round, visible marks: src/people/marks.ts) and D-454 landed before the handoff; see their DECISIONS rows for numbers.
  The playtest bot (session_01Bo2awCHnnWMLyESsfn6MWD) is idle: its script is tools/dev/playtest_year.ts (re-run it after
  every depth change; it found more real bugs than any test).
- **Broken / unverified, first:** the 1.5B (D-394) heard only on Vagon's 12 lab prompts, not over the cloud's newer briefs (past, marks); `sim.strangerSeen` reactions not wired on screen; the stranger can barely buy (6/120 buys; silver never
  accumulates: day labour, the market and selling his grain should make one loop); two converse T-E9 tests time out under
  load (re-run alone); T-E2/T-E3v after D-452: see its DECISIONS row; approach test once flaky.
- **Open from D-452:** T-E2 still fails for women (Persian 2.18 %, Elamite 1.65 %; ≤ 1 % needs ~171 and ~101 names, there
  are 67: needs attested women's names, Hallock/Tavernier indices, or D-236 compositions from attested elements); prompt.ts
  has no shorten/drop rule for the new "Plain to see on you:" line (add it before the past in both lists); history.ts
  husbandOf still guesses its own spouse; re-run people_days_r8/r6, court, crafts, court_fill, language (names changed);
  Vagon render hook: `marksOf(pop, pid, day)[].look` (scar_brow, limp, mourning, with_child, stoop, craft_*...).
- **Next, in order:** (1) DONE by Vagon (D-394: Qwen2.5-1.5B; the 0.5B was incoherent); (2) wire strangerSeen (Vagon: see For the Vagon lead); (3) the stranger's living loop;
  (4) playtest bot after each change; (5) the census gaps.
- **Numbers:** the cloud continues from D-455 (D-450..D-454 used) (Vagon owns D-392..D-449). One DECISIONS row per package.
- **Box rules learned:** two local agents at most; agents share this working tree, so never let one run git
  checkout/stash/reset on files it does not own; inline `//` comments inside one-line code have twice swallowed code: put
  them at the end of the line only.

## Broken, placeholder or unverified on screen (first)
- **Nothing here has been seen in the browser or heard with a real model.** The cloud has no GPU: every result below is a node
  test or a node measurement; the talk is tested with the deterministic stand-in model (plumbing only).
- **UD-31 talk on by default (D-376): unmeasured on a GPU.** Whether Qwen2.5-0.5B keeps T-E9/T-E10 grounding is unknown (the
  next step if not: Llama-3.2-1B, ~750 MB); Kokoro fp16 vs fp32 sound unheard (A/B: `?neuraldtype=fp32`); the "five frames
  after the world is shown" start and the 1.5 s delay before the model streams are untested in the page.
- **Render-side hooks made by the cloud in Vagon's files (smallest possible):** src/world/world.ts (strangerPresence in the
  audio loop; thinCaption on captions; asks: true; NeuralVoices lazy), src/main.ts (talk mounted by default; start after
  frame 5), src/ui/shell.ts and src/core/settings.ts (the Talk setting). Review them on merge.
- **B230 (brides branch):** merged s14-int into it locally (a8fee681, plans.ts conflict resolved: both sides kept); the three
  named d211 failures are being compared on both trees; NOT pushed to s13-bridesmerge yet.
- Small children's days have few distinct
  reasons (a 2-4 year old follows the mother; their plans are pinned by people_days, left as they are).
- The soak per seed (task 4) did not run this session (the box was given to the B230 comparison and the talk work).

## Landed since the playtest (D-382..D-451)
- D-450 (the bot's remaining findings): no digits in anything the model is told (2,207 digit runs in 200 briefs -> 0);
  a gift's trust scaled by its worth to the house (0.1 silver: +0.146 -> +0.018); approaches varied (the commonest opening 77 %
  -> 22 %, 4 -> 11 distinct); leave papers through an official's interpreter on some days for a newcomer with no words.
- D-451: a person's past reaches the model (kept in 100 % of first-meeting briefs, was ~0.5 %).
- D-390 the person census: T-E3r passes (4.51 % -> 0.73 %); T-E3 55 % -> 85 % (small children short of events, by design);
  T-E2 (namesakes 12.9 %) and T-E3v (visible marks 0 %) still fail; one-sided spouses (~280 men per seed) found in life.ts.
- D-382 a personality for everyone (shared manner lines 89 % -> 0 %); D-383 the court's coming in the economy; D-384 chains
  entered by speech (90 of 247 routes); D-387 reconstructed period speech; D-388 the day's rollover sliced (4 ms slices).
- Load (cloud-s15-load, D-386; not merged here): node world build 93 s -> 61 s from the bake (identical scene hash);
  ArrayBuffers 1.94 -> 1.56 GB, RSS 2.73 -> 2.36 GB; unverified in a browser.

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
