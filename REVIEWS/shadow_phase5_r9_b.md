**VERDICT: FAIL.** 1 of 20 people scores below 4. **Detailed guard #76** (34, Nisanu 9) scores **3**. After his turn of water duty he carries the jar to the garrison hearth, but he never puts it down. He then walks down to the craftsmen's quarter and back, 14:58–16:57, with "a jar of water on the head", and bargains for a shield strap with it still there. The first 14 minutes of that walk are on the Terrace, where he is drawn. The other 19 people score 5 (9 people) or 4 (10 people). After scoring I regenerated the sample: it is byte-identical. The jar is a simulation rule, not a tool fault. A detailed agent sets down what it carries only when its next block is on the Terrace, so a load taken into an off-Terrace block stays in its hands. In seed 1 this happens on 1,105 of the 4,621 guard days with water duty (24 %). The guard takes the jar to bow practice in the lower town (698 days), on the town errand (345) or to the river to wash his clothes (62) (S1). **No score changed after scoring.**

# Shadow review, Phase 5, round 9, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent, reviewer B (Claude Opus 5.5). I did not build the simulation or see it built. I did not read reviewer A's round-9 review, any `shadow_r9_A_*` file, or `shadow_phase5_r9.md`.
- **Date:** 2026-09-25. **Tree:** `/home/user/fars`, branch `claude/amazing-fermi-40ds7j`, HEAD `c829121`. The working tree was clean when I regenerated the sample.
- **Gate (§13.11):** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick167.txt` (seed 1, pick seed 167; md5 `9a98683bb9a0bfecf279afda7d54b607`). No earlier reviewer had seen it. After scoring I ran `npx tsx tools/shadow_days.ts 1 167` into the scratchpad. The output is **byte-identical** (md5 `9a98683bb9a0bfecf279afda7d54b607`).
- **Read before scoring:**
  - the sample, in full;
  - `research/CALENDAR_AND_UNITS.md`, `EVENTS.md`, `PEOPLE.md`, `PLAIN.md` and `SETTLEMENT.md`, each in full;
  - `PERSEPOLIS_BRIEF.md` §5.5, §9 (9.1–9.5) and §13;
  - the first 35 lines (header and protocol) of `REVIEWS/shadow_phase5_r8_b.md`. Its first line is the round-8 verdict, so I saw that verdict's summary: the herders' arrival day. None of this sample's people is on an arrival day.

  **Calendar check.** I built the day → month table from the month lengths. With Nisanu 1 = 17 Apr 467, the months begin on regnal days 1, 30, 60, 90, 119, 149, 178, 208, 237, 267, 296 and 326. February 466 BCE has 28 days. All 20 printed dates agree with the table: regnal day, Babylonian date and Julian date. For example:
  - day 263 = Kislimu 27 = 4 Jan 466;
  - day 320 = Shabatu 25 = 2 Mar 466;
  - day 177 = Ululu 29 = 10 Oct 467;
  - day 144 = Abu 26 = 7 Sep 467.

  The sunrise and sunset times are symmetric about noon in apparent solar time. The day lengths fit 30° N: 10 h 13 min on 4 January and 13 h 53 min on 3 June. The daily temperatures fit the Shiraz climate targets for each month.
- **Scores fixed first,** in `/tmp/claude-0/-home-user-fars/fad19950-8a5a-5896-841e-0efd63223cfa/scratchpad/shadow_r9_B_scores.md`. I saved them before I opened any code, data file, `DECISIONS.md` or earlier finding.
- **Read after scoring:**
  - `tools/shadow_days.ts`;
  - `src/people/sim.ts`: `decide`, `decide0`, `onTerrace` (the set-down clause, l. 256), `finish`, `performance`;
  - `src/people/population.ts`:
    - the guard's off-watch `leisure()` and `away()` (l. 2555–2590);
    - the herders' `herdShelter` and `restDay` (l. 3713–3760);
    - the child's `doWork` with its caps and `learnJob` (l. 2895–2935);
    - `nameFor` and the name pools (l. 1355–1385);
  - `src/data/names_recalled.json` and `names.json` (the name entries and their meta);
  - `DECISIONS.md` D-202 (recalled names) and the S2 entry for the guard's off-watch day (l. 2991–2992);
  - the verdicts and finding titles of `REVIEWS/shadow_phase5_r8.md` and `_r8_b.md`.
- **Measured after scoring.** All of these are read-only scratch scripts in the scratchpad, run on seed 1:
  - `r9b_jar.ts`, `r9b_jar2.ts`: every detailed agent's plan on every day it is present, 354 days;
  - `r9b_conf.ts`: two more days of guard #1, stepped;
  - `r9b_herdrain.ts`: herders on the planner's rain days, all year;
  - `r9b_child.ts` and `r9b_alone.ts`: children, every 7th day, 51 days;
  - `r9b_names.ts`: the names of all 46,910 persons.
- **Score changes after scoring: none.** The sample reports the simulation faithfully:
  - #76 is a stepped detailed agent. His load and his act come from `sim.performance()` and `Agent.carry`, as the renderer is asked to draw them.
  - The same fault appears when I step two other days of guard #1 (S1).

## Read first: what is broken or placeholder
1. **Blocking: a detailed agent does not set down its load when it leaves the Terrace (S1).**
   - The guards' water duty fills a jar (`finish()` sets `carry = 'jar_head'` after `draw_water`). The jar is still on the man's head at the hearth.
   - The next block is often a trip down to the town. `decide0` returns off-Terrace blocks before `onTerrace` runs its "set down what is not being carried" clause. So the man goes to bow practice, to the craftsmen's quarter or to the river washing his clothes with the jar on his head, and `performance()` draws him walking as `carry_jar_head`.
   - Extent: 1,105 of 4,621 water-duty guard-days (24 %). That is 3.2 % of all 34,887 detailed guard-days. No other role is affected.
2. **Minor: in the rain, herders' camp work "by the tent" goes on in the open (S2).** 138 of 300 herder person-days on rain days (46 %) have 1 h or more (mean 3.8 h) of weaving, spinning, talk or play "by the tent" during the planner's own rain hours. This includes 10 people "sitting by the tent in the sun".
3. **Minor: teenage sons in the town never do their father's work unless he is a craftsman, scribe, storekeeper or gardener (S3).** No son of a builder, weaver, brewer, groom, guard or caretaker ever works beside his father or learns his trade.
4. **Minor: a child takes bread to the same kinswoman twice in a day (S4).** This is 0.7 % of bread-errand days.
5. **Minor, names: every Persian woman bears the name of a royal or aristocratic woman (S5).** 7,042 women carry just the four names Amytis, Phaidyme, Parmys and Irdabama. Amytis, in the recalled pool, is a daughter of the reigning king. The name data's own rule "royal women are kept out of the everyday pools" is applied to only three names.
6. Carried over from the brief and the research files (not re-examined here): every name recalled under D-202 is tier C, NOT SEEN; the court is absent (D-003).

## Scores

| id | who | day | score |
|---|---|---|---|
| #10 | Bakerabba, guard, leader of ten, 26 | 273, Tebetu 7 (14 Jan) | **5** |
| #76 | guard, 34 | 9, Nisanu 9 (25 Apr) | **3** |
| #72 | guard, 32 | 125, Abu 7 (19 Aug) | 4 |
| #126 | Parmys, camp grinder, woman 27 | 144, Abu 26 (7 Sep) | 4 |
| #128 | girl 7, Elamite | 213, Arahsamnu 6 (15 Nov) | 4 |
| #129 | boy 7, Persian | 263, Kislimu 27 (4 Jan) | 4 |
| 998 | Kuprlli, brick builder 32 | 242, Kislimu 6 (14 Dec) | 4 |
| 676 | Anani, labourer 24 | 224, Arahsamnu 17 (26 Nov) | 5 |
| 2017 | Philis, girl 5 | 342, Addaru 17 (24 Mar) | 4 |
| 3364 | Ziššukka, boy 14 | 320, Shabatu 25 (2 Mar) | 4 |
| 486 | Bakadušda, boy 14, Carian | 184, Tashritu 7 (17 Oct) | 4 |
| 33785 | Pirriyašba, farmer 49 (storm) | 3, Nisanu 3 (19 Apr) | 4 |
| 30442 | Amytis, girl turning 5 | 224, Arahsamnu 17 (26 Nov) | 5 |
| 5094 | Irdapukka, baby 3 months | 39, Aiaru 10 (25 May) | 5 |
| 44597 | Parmys, herder woman 31 (rain) | 329, Addaru 4 (11 Mar) | 4 |
| 43767 | Miššabadda, traveller 32 | 330, Addaru 5 (12 Mar) | 5 |
| 32610 | Bakumarda, farmer 40 (threshing night) | 48, Aiaru 19 (3 Jun) | 5 |
| 42522 | Irdaša, farmer 36 | 180, Tashritu 3 (13 Oct) | 5 |
| 27999 | Manyabaduš, farmer 27 | 316, Shabatu 21 (26 Feb) | 5 |
| 39155 | Irdabama, girl 11 | 177, Ululu 29 (10 Oct) | 5 |

Totals: nine 5s, ten 4s and one 3. The paragraphs below are the ones I fixed before reading any code.

**#10 Bakerabba (5).** A leader of ten on the night watch in mid-January (−1 to 13 °C).
- From midnight to 05:17 he walks his file's round of nine or ten posts about every 90 minutes, armed and dressed against the cold. Between rounds he waits by the garrison hearth, and he has bread and water at 02:25.
- He breakfasts at 06:01 and sleeps 06:27–13:01. After a meal he spends 2.5 h in the town's lanes, trading a little and talking, and is back up by 16:10.
- Evening meal at 17:18, knucklebones, and asleep at 18:25. That is early, but natural after a night watch with no watch tonight.
- The order of the posts varies from round to round, which is right. Nothing wrong.

**#76 (3).** A day-watch guard, 25 April.
- The watch itself is good. Breakfast at 05:10, then the west gate from 06:03 to 14:00, with a 24-min relief to eat at 08:20. A meal after the watch.
- Then his turn of water duty: he draws water at 14:27 and carries the jar to the hearth by 14:53.
- **What is wrong.** From 14:58 he goes "down to the town on an errand for his file". The log keeps him in `carry_jar_head`, "[carrying a jar of water on the head]", all the way down. He keeps it through 67 minutes of bargaining at the craftsmen's quarter for a shield strap and a spear shaft, and all the way back up until 16:57. The jar had already been delivered to the hearth. A guard walking to the craft quarter and haggling with a full water jar on his head is wrong. The walk from the hearth to the road (14:58–15:12) is on the Terrace, where he is drawn.
- The rest of the afternoon is good: knucklebones, the evening meal, and sleep at 20:25.
- The load carried over into the next errand is the kind of thing an observer would call wrong, so 3.
- A small point: at 19:42 he rests in the quarters, goes back to the hearth for two minutes at 20:23, then sleeps.

**#72 (4).** An afternoon and evening watch, 19 August, 38 °C.
- After breakfast he goes down to his family in the town at 06:42. His 3-year-old is ill today. He spends the morning and the midday meal with them and is back up at 13:13.
- He is on watch at the Hadish post 14:00–22:00, with a water jar at the post through the heat. He has bread and water at the post at 18:25 because no patrol man was free to relieve him. A meal, and sleep at 22:31.
- A good use of the free morning.
- Minor: he stands 4.5 hours at a stone post through the hottest part of a 38 °C day without relief, and 8 hours in all. Plausible for a garrison, but hard.

**#126 Parmys (4).** A camp grinder, 7 September, 38 °C.
- She grinds the household's flour at 04:31, eats, and walks up to the work camp before sunrise.
- At the camp querns she grinds 06:07–12:00, with three water trips and bread at 11:36.
- Home at noon, she grinds again "for tomorrow's bread" and fetches water. She sleeps through the heat 13:59–15:56, then cooks and eats with the household and sleeps at 20:34.
- A believable, hard woman's day. Stopping at noon in the heat is right.
- Minor: two home grinding sessions on top of five hours at the camp querns. And the name sits oddly on an Elamite grinder: Parmys is Herodotus' royal daughter of Bardiya, recalled, tier C (§9.1: names matched to origin).

**#128 girl 7 (4).** An Elamite girl, 15 November. Her mother is a camp worker.
- She is up at 07:12 and carries in brushwood "for the morning fire". She eats breakfast alone ("the others of the house gone out").
- Two water trips with a small jar, bread to a kinswoman, and play at home and in the lane.
- Midday and evening meals with the household, and asleep at 18:42.
- Good children's chores.
- Minor: a seven-year-old is alone in the house from before dawn until midday and lays the morning fire with no adult at home. Plausible in a lane of neighbours, but thin.

**#129 boy 7 (4).** A Persian boy, 4 January (−2 to 12 °C). His mother is a camp worker and his father a porter.
- The same shape as #128: brushwood, breakfast alone, and two water trips.
- He exchanges a measure of barley for oil with a neighbour.
- Long play in the lane, 09:12–11:18 and 13:18–16:08.
- Meals with the household and asleep at 18:25. He is dressed against the cold in the morning.
- Plausible. Minor: unattended all morning at seven, and nearly three hours of lane play on a winter afternoon.

**998 Kuprlli (4).** A brick builder, 14 December: frost at dawn and rain 15:00–23:00.
- His half of the gang is off. The gang works in halves in winter, and there is no mud-brick work on frost or rain days (E-62). So he stays home mending tools and baskets.
- He eats three meals with the household. The evening meal is at 15:54, before dark and in the rain. He talks, and sleeps at 19:23.
- A plausible idle winter day.
- Minor: as far as I know, Kuprlli is the name of a 5th-century Lycian dynast known from coins, not an Elamite name (§9.1 origin match).

**676 Anani (5).** A labourer, 26 November.
- He has bread and water before leaving, and the household eats later. He walks 22 minutes to the site of the Hall of 100 Columns.
- He hauls earth for the ramp 07:05–15:30, with the camp's bread at midday. Home by 15:52, evening meal, sleep at 19:45.
- The day runs from dawn to mid-afternoon (E-60). He carries a mattock and a basket and is dressed against the cold at dawn. A Syrian with an Aramaic name. Good.

**2017 Philis (4).** An Ionian girl of 5, 24 March. Her mother and her 16-year-old brother both work for the Treasury.
- She plays in the courtyard, eats breakfast alone, then plays in the lane most of the day.
- Midday and evening meals with the household. She plays in the lane until dusk, is called in, and sleeps at 19:21.
- Children's play is right.
- Minor: a five-year-old is left alone from 06:28 to midday with no minder named, and has no small chore at all.

**3364 Ziššukka (4).** A Persian boy of 14, 2 March (−2 to 12 °C), the son of a weaver.
- Brushwood and breakfast.
- Two long fuel trips (07:42–09:35 and 12:34–14:40) and three water trips.
- Barley for oil with a neighbour, some play in the lane, and a little basket mending.
- Meals, and sleep at 19:30.
- Real work in a cold month.
- Minor: at 14 he is still a "child" playing in the lane. He never sits at his father's loom or does any paid or apprenticed work, although boys of about that age draw work rations in the tablets.

**486 Bakadušda (4).** A Carian boy of 14, 17 October (11–31 °C), the son of a builder.
- Brushwood and breakfast.
- Two fuel trips (07:38–10:00 and 13:21–15:24, the second in the afternoon heat) and three water trips.
- Bread to a kinswoman, and play at Nupta's house and by the garden channels.
- Basket mending, meals, and sleep at 19:02.
- Oddities:
  - he takes bread to the same kinswoman (h:1401) twice, at 10:45 and again at 12:37;
  - he fetches the household's water although three women are at home;
  - at 14 he does no work beside his father;
  - he has an Iranian name (Baga-) although he is Carian.

**33785 Pirriyašba (4).** A farmer, 19 April. Rain falls 02:15–14:15, with a storm 02:30–14:00 (19.7 mm).
- He stays home: the animals, mending tools and baskets, the midday meal and rest.
- Once the rain stops he sees to the animals again, 14:27–17:07. Evening meal, talk, and sleep at 20:53.
- Sheltering from the storm is right.
- Minor: after 20 mm of rain a farmer would go out to look at his field channels and banks. Instead he spends 2 h 40 min "seeing to the animals" at home.

**30442 Amytis (5).** A girl of the plain who turns 5 today, 26 November.
- She is with her mother all day. She eats with her, plays near her, and goes along on a visit to another house.
- She plays while her mother grinds and talks, and sleeps at 19:33.
- Right for a small girl whose mother keeps the house.

**5094 Irdapukka (5).** A baby of 3 months, 25 May.
- He is nursed about every 2–3 hours, day and night: 11 feeds.
- He sleeps beside the mother, on a mat while she works and in her lap at meals, and is carried on her back to the well.
- Very good.

**44597 Parmys (4).** A transhumant herder woman of 31, 11 March, in camp on the plain. Rain 06:15–12:00, 0–15 °C.
- She milks the ewes and goats at first light, warms the milk and sets curds, and has bread and milk in the tent.
- She churns butter in a skin, spins, and weaves at the ground loom.
- She milks again as the flock comes in and fetches water from the stream.
- She bakes bread on the embers, talks by the fire and sleeps at 19:22.
- Excellent pastoral texture, right for the spring passage and after lambing.
- Oddity: she rests "in the tent out of the rain" 08:12–08:28, then weaves at the ground loom "by the tent" and spins through the rest of the rain (08:28–11:35). She has no cold-weather dress from 06:19, on a 0 °C morning.
- Under the front of a black tent in light rain (4 mm in 6 h) this can pass as plausible, so 4. But the simulation's own rain rule is inconsistent here.

**43767 Miššabadda (5).** A traveller in a party of six at the road station, 12 March.
- A layover day: breakfast, the animals and gear, and mending harness and sandals. Rest, and a walk to see the lower town.
- He draws the next days' travel rations at the town store (E-21, CE-08).
- Evening meal, talk by the fire, and sleep.
- Plausible. (The label "at home" for the station at 14:52 is a slip of wording.)

**32610 Bakumarda (5).** A farmer, 3 June, in the threshing season (E-43).
- Up at 04:23, he threshes with the animals from 05:33, with bread by the floor at 08:14.
- He threshes until 11:15, then has the midday meal and sleeps in the shade through the heat.
- At home he sleeps again, because he has the night watch, and mends forks and sieves. Evening meal.
- From 19:09 he sits up by the grain heap and then sleeps beside it, guarding it.
- A very good harvest day. The man sleeping by the heap is right.

**42522 Irdaša (5).** A farmer, 13 October.
- He spreads manure on his field 06:55–13:40, before the autumn ploughing. A child of the house brings his midday bread out to him.
- Home, rest, and he plasters the roof with mud and straw before the rains.
- Evening meal, and sleep at 19:04.
- Seasonally apt.

**27999 Manyabaduš (5).** A farmer, 26 February.
- He clears the village canal (E-50, months 11–12) 07:57–15:00, eating the bread he carried out.
- Then he sees to the ewes and the new lambs (E-48).
- Evening meal, a visit to a neighbour after dark, and sleep at 20:04. Good.

**39155 Irdabama (5).** A girl of 11 on the plain, 10 October.
- Dung cakes, breakfast, and grinding beside her mother.
- Fuel, and spinning with the women outside the door.
- Play in the lane and by the canal.
- She carries bread and water to the men in the field and eats with them.
- Fuel again, two water trips, play at a friend's house, and the lane until dusk. Then she is called in.
- A full, varied and right day for an 11-year-old girl.

## Findings

**S1. Blocking (#76): a detailed agent keeps its load when its plan takes it off the Terrace. A guard carries the jar from his water duty through a town errand, bow practice or washing at the river.**
- *What.* On a water-duty day the guard's plan has three steps: `draw_water` at the Terrace water point, then `carry_jar_head` to his file's hearth (0.1 h), then more free time. When the next free-time choice is a trip down (`away()`: the practice ground, the town errand or the river), the stepped agent takes the jar with it for the whole trip. `performance()` shows `carry_jar_head` whenever he walks.
- *Evidence (sample).* #76, 14:27 `draw_water`, then 14:53 "carry_jar_head @ garrison_hearth_m". From 14:58 he is "carry_jar_head → road:town — down to the town on an errand for his file [carrying a jar of water on the head]". At 15:24 it is "exchange @ craft_zone … [carrying a jar of water on the head]", and at 16:31 "carry_jar_head → road:terrace". The jar goes only at 16:57, when the next block on the Terrace begins. The load stays on him even while he stands at the hearth ("carry_jar_head @ garrison_hearth_m"): the jar is never set down there.
- *Cause (code).*
  - `sim.ts finish()` (l. 535) sets `a.carry = 'jar_head'` when a `draw_water` task ends.
  - The load is dropped only by the set-down clause at the top of `onTerrace` (l. 256): when the block's act is not the matching carry act.
  - `decide0` returns the task for an off-Terrace block (`seg.where !== 'terrace'`, l. 242) before `onTerrace` is reached, so the clause never runs for it.
  - Nothing clears the jar when the `carry_jar_head` block reaches the hearth. The camp women's jar at `work_hearth` is the only place where a water jar is set down (l. 357–359).
  - The guard's `leisure()` (population.ts l. 2573) goes straight from the water duty to the next choice, and `away()` (l. 2564) can follow at once.
- *Confirmation.* I stepped two more days of guard #1 (`r9b_conf.ts`):
  - day 35: he draws water, then does "train @ training:q_lt_e — practising with the bow and the spear … [carrying a jar of water on the head]" 07:13–08:46;
  - day 224: "wash @ river — washing his clothes at the river [carrying a jar of water on the head]".

  In both cases the walk from the hearth to the stair (about 13 min) is on the Terrace and drawn.
- *Year-wide (seed 1, `r9b_jar.ts`: every detailed agent's plan on every day present).* The script replays the set-down rule over each day's plan.
  - Guards: 34,887 guard-days, of which 4,621 have water duty (`r9b_jar2.ts`). On 1,105 of them (24 % of water-duty days, 3.2 % of all guard-days) the jar is still carried into an off-Terrace block:
    - 698 down to the practice ground;
    - 345 on the town errand;
    - 62 to the river.
  - Every other role is unaffected: masons, porters, scribes, bakers, grinders, children, couriers, officials and the foreman all score 0. Their loads are set down by role-specific code or they never leave the Terrace carrying one.
- *Fix (rule level).*
  - Move the set-down clause from `onTerrace` into `decide0`, before the off-Terrace branch. Then every new block that is not a matching carry act empties the hands, wherever it is.
  - In `finish()`, clear `jar_head` when a `carry_jar_head` task ends at its destination (the garrison hearth), as the camp's `work_hearth` already does. Optionally, log "water brought to the hearth" there too.
  - Add a test: over a year of stepped or replayed detailed days, no agent has `carry` set while its task is `off`, and no `carry_jar_head` performance is drawn outside a carrying block.

**S2. Minor (44597): herders' camp work "by the tent" carries on in the open through the rain.**
- *What.* On a rain day the herders' `herdShelter` moves only the activities at the stream (`water:` places) into the tent. Everything planned at `camp:` stays outdoors and keeps its outdoor label:
  - "weaving at the ground loom by the tent";
  - "spinning wool by the tent";
  - "playing by the tents with the other children";
  - "talking with the men of the band by the tents";
  - "sitting by the tent in the sun".
- *Evidence (sample).* 44597 is sent "in the tent out of the rain" for 16 minutes, because that block had been a water trip. Then she weaves and spins "by the tent" 08:28–11:35 under rain that falls 06:15–12:00.
- *Year-wide (seed 1, `r9b_herdrain.ts`).* The planner has 28 days with rain hours. On them there are 300 herder person-days in camp or passing. 138 of these (46 %) have 1 h or more (mean 3.8 h) of such outdoor-labelled camp activity inside the rain hours:
  - weaving, 104 blocks;
  - spinning, 88;
  - children playing by the tents, 73;
  - men talking by the tents, 59;
  - a little one playing by the tent, 40;
  - with the lambs by the fold, 22;
  - and 10 people "sitting by the tent in the sun".
- *Fix (rule level).*
  - In `herdShelter`, when the block overlaps rain, move the `camp:` activities indoors as well: spin, talk, play, rest and "minding the little ones" become "in the tent", out of the rain.
  - Either roll up the ground loom (weave → spin, or → rest in the tent) or say "weaving under the tent's front" (C).
  - Never say "in the sun" when the block is under rain or the day's cloud is above about 70 %.
  - Put the lambs by the fold under the same weather rule as the adults' fold work.

**S3. Minor (3364, 486): teenage sons in the town learn their father's trade only if he is a craftsman, scribe or storekeeper (gardeners' sons go with their fathers).**
- *What.* `learnJob` (population.ts l. 2910) gives a town boy of 10 or more "his father's craft in the house, learning it" only for the jobs craftsman, scribe and storekeeper. A weaver's son (3364) and a builder's son (486) at 14 fill their days with fuel, water, errands and play. In the tablets, boys of about that age draw work rations in work groups (the Liduma list: boys at 10, 15 and 20 qa).
- *Year-wide (seed 1, `r9b_child.ts`, every 7th day).* There are 4,334 town boy-days at ages 13–15, 3,735 of them with a father in the house.
  - Some learning or work beside the father appears on 1,481 (40 %): craftsman's sons 859 of 897, scribe's sons 240 of 244, storekeeper's sons 5 of 5, gardener's sons 365 of 1,387.
  - It appears on none of the 1,121 days of sons of builders (462), guards (204), grooms (151), caretakers (97), officials (58), weavers (51), brewers (51), shepherds (24), porters (14) or priests (9).
  - Play itself is now modest (a mean of 1.2–1.7 h a day). For town boys of 13–15, round 8's S4 (3–4 h of play) appears to be fixed. The gap is the missing work.
- *Fix (rule level).*
  - Add weaver and brewer to `learnJob`: "at his father's loom, learning it" and "helping at the brewing vats".
  - For the sons of builders, porters and grooms aged 13 or more, give some days a week as a boy labourer beside the father: on the site's basket line at a boy's ration (C, the Liduma boys), or at the stables.
  - Guards', officials' and priests' sons can stay with household work, but with an errand for the father's post now and then.

**S4. Minor (486): the same kinswoman gets bread twice in one day.**
- *What.* A teenager's errand cap is 2 (l. 2906), and each errand independently picks "taking bread to a kinswoman" with probability 0.5. The kin household is the first near one, so both errands go to the same house.
- *Evidence.* 486 takes bread to h:1401 at 10:45, and again at 12:37.
- *Year-wide (seed 1, `r9b_child.ts`, every 7th day).* There are 791,517 child-days in the town and on the plain. 81,950 of them have a bread errand, and 600 of those (0.7 %) have two to the same house.
- *Fix.* At most one bread errand a day. A second errand is the barley-for-oil exchange, or a different kin household.

**S5. Minor, names (#126, 44597, 30442, 39155, 998, 486): the Persian women's name pool is made up entirely of royal and aristocratic women. The data's own rule "royal women are kept out of the everyday pools" is applied to only three names.**
- *What.* The Iranian women's pool (`names_recalled.json`, D-202) has 11 names: Irdabama, Phaidyme, Parmys, Artaynte, Artazostre, Sandauke, Amytis, Rhodogune, Roxane, Mandane and Kassandane. Every one is recalled from the record of a royal or high-aristocratic woman: Cyrus' mother and wife, Darius' daughter, and daughters, a sister and a niece of Xerxes. Only Atossa, Amestris and Artystone carry `notable` and are kept out.
  - So a farm girl on the plain bears the name of a daughter of the reigning king (30442 Amytis; Ctesias' Amytis, daughter of Xerxes).
  - The thin Elamite women's pool spills into these names (the Elamite grinder #126, Parmys).
  - A 5th-century Lycian dynast's name (Kuprlli) goes to an Elamite brick builder, through the thin-pool rule (998).
- *Year-wide (seed 1, `r9b_names.ts`, all 46,910 persons).* 7,042 of the 22,012 women (32 %) carry just these four names:
  - Amytis, 1,801;
  - Phaidyme, 1,785;
  - Irdabama, 1,743;
  - Parmys, 1,713.

  All 18,209 Persian women carry one of the 11. Kuprlli goes to 62 men.
  - D-202 already records the pool as "small and aristocratic in source". But the royal-exclusion rule it states is not applied to living members of Xerxes' house.
- *Fix.*
  - Flag as `notable` the women of the royal house who are alive or remembered in 467 (Amytis, Rhodogune, Artaynte, Sandauke, Artazostre, Mandane, Kassandane) and the living dynast Kuprlli.
  - Until the PF women's ration and birth texts (Hallock 1969, Brosius 1996) or Tavernier 2007 can be read (NEEDS #4), leave the rest of the Persian women unnamed rather than give 18,000 of them princesses' names.
  - Irdabama (a PF estate-holder, but not of the royal house by name alone) and Phaidyme (Otanes' daughter) are borderline, a matter for judgement (C).
- This did not lower any score. It is recorded because §9.1 asks for names "matched to origin" and an observer would notice it.

**S6. Checked, not faults, and small notes.**
- *Tool.* The sample regenerates byte-identical. Its dates, sun times and weather lines are right (the calendar check in the header). The "[off the Terrace: not drawn]" markers match the `offmap` flag.
- *Children left alone in the morning (2017, #128, #129).* This is rare in the population. On every 7th day (`r9b_alone.ts`), children aged 5, 6 and 7 breakfast alone ("the others of the house gone out") on 367 of 65,915, 481 of 63,157 and 487 of 59,532 days. They have no one aged 12 or more at home for most of 07:00–11:30 on 68, 136 and 201 of those days. That is up to 0.3 %, and it arises only in households with no woman who keeps the house. Not a fault class. A kinswoman or neighbour as the named minder on those days would read better.
- *#72: 4.5 h at a post in 38 °C heat without relief.* The patrol man who would stand in was not free. This is allowed by the rota, which already sends a water jar to the post through the heat. Not measured.
- *33785: a storm day at home.* A farmer might go out after 20 mm of rain to see to his channels. This is a possible future texture, not a fault.
- *Wording.* 43767, "rest @ station — at home" (14:52): the station lodging is not his home. #76, 19:42–20:25: quarters → hearth for 2 min → sleep.
