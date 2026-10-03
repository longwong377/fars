# s18 C8: the people's depth (D-720), report

Branch `cloud-s18-c8-depth`. Tool: `npx tsx tools/dev/follow30.ts 60 REVIEWS/follow30.json own|old` (node only; thirty people drawn by
seed across six kinds of life, seeds 1, 7, 42, day 60 with five days run live, the world as world.ts builds it; each followed
through the day, the next day and the day a season on, and asked five things: who are you, who lives in your house, what work
do you do, what has happened to you this year, what troubles you). The full replies and day plans are in REVIEWS/follow30.json.

## Broken, placeholder or unseen (first)
- **Unseen:** the in-browser model (cloud). The prompt path was judged by what it carries (the fact ground.ts puts next to each
  question; the Lately line), not by a model's words. The replies scored are the own-lines path: what every player meets until the
  model has loaded, and always on a card that cannot hold it. The score is a rule (a name or shared content word from the facts the
  question asks for), not a reader's judgement; its two misses are "a toy of my own" (a three-letter word), i.e. grounded.
- **Not mine, asked of the lead:** a court servant of a retinue camp (seed 1, pid 59405) spends the whole day at rest, talk and
  knucklebones (court.ts): the job is a label that day (she worked the day before: kneading, water, sweeping the tents).
- **Raised, then capped by cost:** the minds' own deeds now look at 12,000 people a day (was 4,000), up to 900 deeds: 862 people a
  day touched (was 666) for +29 ms of the minds' day (tools/dev/minds_rate.ts; 40,000/3,000 would reach 1,462 a day for +135 ms,
  ~40 % more catch-up: when the budget allows). None of the thirty had a townsfolk deed in the five live days; 8 of 30 (the road folk, children of the
  Treasury, a mother at the field) still have nothing done by or to them this year that they could tell (they now have yesterday).
  Raising deed volume is a cost question for the budget (asked as a next step).
- **Road folk** (hinterland register) live off the map all day (3 plan parts, 2 reasons): they pass through; their day off the map
  is a label. Their talk is grounded (home, kin, past, hopes).
- aims.ts phrasing ("a trade for Manuš") reads oddly (not mine).
- The own lines are English (translation layer); the heard voice is the person's own language as before (voice.ts heardReply).

## The lead's asks (after wave 1)
- **C1's sliced day:** `EconPlans.stepsSliced(day, ms)` works a day's economy steps out a few hundred houses at a time (the
  market day's buyers were the ~0.8 s); `steps(day)` gives the same steps whole. **Not yet called**: sim.ts (C1) should call
  `this.econPlans.stepsSliced(day, end - performance.now())` before warmPlans in jumpTo's sliced branch. Not measured on the page.
- **No wall-clock in the save:** the minds' stats in the deeds' save are the game's counts only (days, deeds, sources, chains).
- **Holes #9 (talk hidden):** E speaks with whoever is faced within reach (anyone of the population; a greeting first, then type
  or say); the panel shows the keys, never the notes, the verdicts or why the model is absent (F3 or ?debug shows them); every
  reply voice goes through the world's mixer. **Not mine:** the shell's hint (shell.ts "E a door, a person") and the Controls
  screen (C11) should list T and V; main.ts's E still falls back to world.address's canned line when no one is faced.
- **Holes #15 (speech):** the eight peoples without a lexicon (Egyptian, Lydian, Carian, Lycian, Cappadocian, Bactrian, Sogdian,
  Thracian) speak reconstructed sentences built from their own sounds (audio/tongues.ts: a hand-set profile per tongue, its
  sources named, tier C) where they hummed; every lexicon language adds forty everyday sentences in reconstructed period speech
  (lang/reconstruct.ts) to its published lines and words; the reply heard in a talk says the reply itself (reconstructed); an
  overheard pair says its own life's fact in reconstructed speech, the other answering. **Unseen/unheard:** no listening test in
  the cloud (formant or neural); songs with words and the magi's recitation are not done (music, not mine).
- **Pre-existing, not mine:** tests/econ_plans.test.ts "nobody moves without a walk" fails on clean s17-int too (49 market
  stall stretches without a walk, days 120-123).

## The lead's later asks (C12's fourth pass, C7's root cause)
- **C7 (market):** the court's people, travellers and herders are never sent to keep or buy at a market stall (plans.ts pick); the
  deeds world lays no stretch on a court person's day. **Still failing, not mine:** tests/court_fill audience (the king's day 15
  has an `offer` and two enthronements: the court's own schedule after the merge) and a court-camp tent (52162: no tent).
- **4-12:** the stranger buys bread, beer or a meal from a house (only from its spare) or the market's sellers, eats it there,
  pays weighed silver or barley (barter), at the market's price of the day (season and shortage) with the seller's margin.
  **Not mine:** the market ground's seasonal goods and fewer squares (fillPlan.ts, C2).
- **4-1:** sight.ts takes where the stranger is (`inside`: a house, a palace hall, the women's palace, a store): an uninvited
  stranger is shouted out of a house, stopped by a place's keepers; once a place and day the deeds world lays it (anger, the
  house's trust down, a trespass rumour on the lane). **Not wired:** the render side must pass `inside` to strangerSeen (sim.ts,
  world.ts), and react.ts plays a challenge as a stare until a shout and a pointing arm are added.
- **Cheap fixes:** no weeks (W5); the day's hire paid in barley worth the hire (W6); hums, not bare nouns, as padding (W13);
  "my lord" and the king named as Xšayaršā son of Dārayavauš in his nineteenth year (W14); coins puzzle the person ("silver is
  weighed here"), Asia and Europe allowed, modern talk fenced in replies only (W15); loan interest a fifth a year by the months
  it runs (W17); src/data/lives_baked_s1.json deleted (W22).
- **Kokoro accents:** no regional colour pool; four style voices of four trained languages, near-even. **Unheard** (no
  listening in the cloud): PLACEHOLDER-QUALITY until the T4 hears it; voices_eval's uniqueness should be re-measured on Vagon.

## Later still
- **C7's planCheck (land_work):** a hearing is half an hour waiting to be heard and the hearing itself; the deeds' laid stretches
  are dressed against cold and dust. Re-run of the land_work sample: the wait and dress issues are gone; left (not mine): meal
  gaps (C1) and base-plan labels ("with the household" with no one home; a short "through the heat" sleep).
- **C14's visemes:** voices.speaking entries carry the words said (ipa, text); the talk reply passes {ipa, text} as sayPcm's fifth
  argument. world.ts must pass them on to crowd.voice (routed by the lead).
- **4-8:** the talk panel shows what happened in plain words (no verb names, rule reasons or debug; F3/?debug keeps them).
- **Tests:** tests/talk_prompt.test.ts did not finish in 45 min on this box (it builds a year's world after every source change):
  left to CI. One run of day_slice "a jump across frames is the jump at once" failed under load and passed three times after
  (unexplained; flagged).

- **Persistence (C7's CI):** the deeds' save round-trips byte for byte (test in tests/deeds.test.ts).
- **Songs (holes #15):** work songs at the works and the building, reaping songs in the fields, singing at the well, the market's
  calls (by the plan's place), in the singer's own tongue reconstructed (tier C), word by word to the lullaby's tune; two singers
  at most near the listener; lullabies sung with words every other phrase. **Unheard** in the cloud (formant/neural). The magi's
  recitation is still wordless (the ritual rule: no invented liturgy).

## The lead's last asks (the round trip, the plans, the chains)
- **Broken, not mine (patch ready):** `handoff/s18/c8_plans_ask.patch`, four lines in files I do not own. population.ts:
  outOfDoors' trips to the well, the lane and the market are kept out of the dust as well as the rain (275 of econ_plans' 283
  problems); a child's lane play keeps the household's own hours; `relationsSnapshot()` in key and day order (day_jump's "tomorrow
  made ready" failed on a reordered save since my merge c8525e3f: the larger deed sample relates people in another order when a day
  is made ahead; the relations are the same). living/world.ts: its errands use `relabelHousehold` (deeds/engine.ts). With the
  patch: econ_plans 0 problems, day_jump 3/3. Without it: econ_plans 1 problem left, day_jump fails.
- **Broken before me:** living_world "a day is the same whatever the sim's present" fails at s17-int before my first merge too
  (463f93da^1: 46085 vs 46068 talks); its save-replay test then failed on save size, now on one plan. Not looked into further.
- **Asks and rumours survive a save, exactly:** the loaded world drifted from the fourth day (pruned and rounded feelings, memories
  of only the saved deeds, 60 of up to 400 ended goals while the running world read the rest: vows of thanks, the spurned who
  leave, revenge on the last wrong). The running world is cut to the saved state each evening (minds.canon, goals.canon); the save
  keeps every wrong done; revenge reads wrongs only. Test (deeds.test.ts): saved at day 12, loaded, run to day 20: asks, rumours,
  the economy, minds and goals equal the unbroken run (fails with canon off). minds.test "saved small and loaded" passes (527 KB).
- **Farmer 11543's plough:** with the walks (walkedIn) the field-house moves were walked, but he was still called home three times
  a day: each who came to sit with the sick laid "at the work (tend body) with X" on the head of the house too. Now the helper
  alone goes, "tending the sick in the house of X"; the head's day stands.
- **The walk issues (econ_plans):** 283 → 1 (0 with the patch). Mine: a meal "back from the threshing floor" after the work was put
  aside (the suffix dropped); a little one taken to the mother's market stretch without a walk (walks there first); a deeds stretch
  cutting the household's hours to a piece with none of it there ("at home").
- **The chains' missing links, hunger first** (tools/dev/chain_census.ts, seed 1, 30 days live; REVIEWS/chains_lean.json and
  chains_harvest.json): there was no hunger in the famine chain: 'hunger' came only after a fortnight of short eating, and help came
  first. Now a house that cannot buy the bread it needs goes short (hunger, from what emptied its bins: the harvest, the price, a
  theft; once a month, not again in the month after help came), and what it does next is from the hunger. The census counts
  theft → accusation → arrest (it looked only for a direct cause).

  | lean month (day 300) | before | after |
  |---|---|---|
  | economy chains | 1,292 | 2,065 |
  | all chains (census count) | 7,537 | 8,562 |
  | harvest/price → hunger | 0 | 34 |
  | hunger → help (kin, neighbours) | 0 | 872 |
  | hunger → sale/loan | 0 | 101 |
  | hunger → petition/relief | 0 | 1 |
  | hunger → theft | 0 | 0 |
  | theft → arrest/suit | 0 | 5 |
  | hunger events | 0 | 234 |

  The harvest month (day 150) is calm: 1 hunger, 828 chains (787 before the market fix). **Still thin:** hunger rarely ends in a
  theft or a petition: the kin and the neighbours carry the hungry first (as the economy intends, D-344); theft runs 9 a month,
  mostly petty (D-347).

## The thirty, before → after (replies grounded of 5; thin spots)
| seed/pid | kind | person | replies | thin before | thin after |
|---|---|---|---|---|---|
| 1/5415 | town | Muška, 24m gardener | 0/5 → 5/5 | replies, deeds | ok |
| 1/29658 | village | Miθratausā, 29f homemaker | 0/5 → 5/5 | replies, deeds | deeds |
| 1/2605 | terrace | Vahuzātā, 32f treasury | 0/5 → 5/5 | replies, deeds, words | ok |
| 1/73244 | road | Aryaduxçā, 21f homemaker | 0/5 → 5/5 | reasons, replies, deeds | reasons, deeds |
| 1/59405 | court | Ina-Esagil-banât, 46f servant | 0/5 → 5/5 | work, replies, history, ties | work |
| 1/45926 | camp | Rēmūt, 43m builder | 0/5 → 5/5 | replies | ok |
| 1/1164 | town | Ampirdawiš, 11m child | 0/5 → 5/5 | replies, deeds | ok |
| 1/22641 | village | Dātastūnā, 15f homemaker | 0/5 → 5/5 | replies | ok |
| 1/1577 | terrace | Dātazauštrī, 13f treasury | 0/5 → 5/5 | replies, deeds | deeds |
| 1/80336 | road | Utira, 53m craftsman | 0/5 → 5/5 | replies, deeds | deeds |
| 7/62228 | court | Bakumarda, 34m groom | 0/5 → 5/5 | replies, history, ties | ok |
| 7/402 | camp | Rauzazza, 48m builder | 0/5 → 5/5 | replies, deeds, words | ok |
| 7/1828 | town | Telephanes, 6m child | 0/5 → 4/5 | replies | replies |
| 7/11248 | village | Cincaxri, 67m elder | 0/5 → 5/5 | replies, deeds, words | ok |
| 7/256 | terrace | the son of Bagābigna, 44m guard | 0/5 → 5/5 | replies, deeds | ok |
| 7/81078 | road | Hupannana, 34m craftsman | 0/5 → 5/5 | replies, deeds | deeds |
| 7/48398 | court | Čiθrazauštrī, 18f homemaker | 0/5 → 5/5 | replies, history, ties | ok |
| 7/808 | camp | Theodoros, 49m builder | 0/5 → 5/5 | replies, deeds | ok |
| 7/6767 | town | Zababa-iddin, 13m child | 0/5 → 4/5 | replies, deeds | replies |
| 7/27238 | village | Bakiš, 37m farmer | 0/5 → 5/5 | replies | ok |
| 42/1559 | terrace | Busasa, 24f treasury | 0/5 → 5/5 | replies, words | ok |
| 42/78491 | road | Aspazauštrī, 48f homemaker | 0/5 → 5/5 | reasons, replies, deeds | reasons, deeds |
| 42/63571 | court | Irdabada, 38m porter | 0/5 → 5/5 | replies, history, ties | ok |
| 42/1270 | camp | Rtašyāti, 29f camp | 0/5 → 5/5 | replies, deeds | ok |
| 42/7012 | town | Yamakšedda, 7m child | 0/5 → 5/5 | replies, deeds | ok |
| 42/12789 | village | Ištimanka, 20m farmer | 0/5 → 5/5 | replies, words | ok |
| 42/1971 | terrace | Muška, 12m treasury | 0/5 → 5/5 | replies, deeds | deeds |
| 42/80411 | road | Amazātā, 20f homemaker | 0/5 → 5/5 | replies, deeds | deeds |
| 42/51182 | court | Uštana, 23m steward | 0/5 → 5/5 | replies, history, ties | ok |
| 42/664 | camp | Jedaniah, 40m builder | 0/5 → 5/5 | replies | ok |

Share thin (before → after): replies ignoring their life 100 % → 6.7 % (2 rule misses; 150 → 148 of 150 grounded); nothing
done by or to them that they can tell 60 % → 26.7 %; broken words in the life (news "heard of wrong the house of", "grain or
help") 16.7 % → 0; a courtier's wrong history (work group, garrison) 16.7 % → 0; no friend 16.7 % → 0; job a label 3.3 % → 3.3 %
(court.ts); reasons 6.7 % → 6.7 % (road folk off the map). Every day changed the next day and a season on (0 % loops, both runs).

## What was fixed, for everyone
1. **The own lines** (converse/ownlines.ts, ui.ts): OwnMind plays the person in the same turn as the model, so asks, deeds, the
   sandbox, memory and gossip work with no model at all (checked: "Help me fix your roof" → repair done; "Give me some bread" →
   given; "Do you remember me?" → "Yes, I remember you. Just now you asked me for bread, and I gave you bread."). Words from the
   life record in the first person and the person's manner: temperament, oath, age, an ask-back, an oath or a proverb once a talk.
2. **Lately** (deeds/lately.ts, engine.ts, life.ts, ground.ts, prompt.ts): the townsfolk's deeds by, to, about and before each
   person, from their side ("Bagadata helped me with the work, two days ago"; "I saw Kuraš strike Miθra, yesterday"), into the
   brief's Lately line, the ground facts and the own lines. Yesterday's own doings too.
3. **The deeds' save** keeps the count and ten days of the log: a loaded save began deed ids at 0 again, so memories read other
   deeds and the town's talk of deeds (initiative.ts) stopped until the count caught up.
4. **Words**: the deeds' rumour kinds worded; "gave them grain when the house ran short"; the court's people came with the court
   (or to petition, or with a delegation), live in its camp or tents, live beside fellow servants or companions, and have them as friends.

## Tests
tests/ownlines.test.ts (new, 8). Targeted: talk_prompt, converse, deeds, minds, talk_world, stranger_talk, npc_talk (results below).
