**VERDICT: PASS.** No one of the 20 scores below 4: 5 people score 5 and 15 score 4. The sample regenerates byte-identical (md5 `0593835b1360f433d54e2d8ecfacaf15`). But three year-wide planner faults came to light after scoring, although none pulled a score below 4 in this sample. (1) A sick child of 1–4 goes wherever the mother works: to the lane, the well, the threshing floor and the fields. That happens on 91 % of 31,434 sick child-days (S2). (2) A storm anywhere in the day's light cancels the whole building day. On day 247 the storm comes at 15:30, as work ends, and all 612 builders stay home (S3). (3) The detailed porters spend a mean of 4.0 h a day "waiting for a caravan", and in the afternoons that caravan can no longer come (S4). There is also one tool fault: the "age-rule birthday" stratum drew a baby of 2 months. So that case went untested this round (S1).

# Shadow review, Phase 5, round 8, reviewer A (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. Before scoring I read no earlier round's scores or findings, no simulation code or data, and not `DECISIONS.md`.
- **Date:** 2026-09-24
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick149.txt` (seed 1, pick seed 149; 618 lines). No earlier reviewer had seen it. It holds:
  - 6 detailed Terrace agents: a leader of ten (#40), two guards (#51, #28), a porter (#113), a grinder (#123) and a mason (#104);
  - 14 people of the population:
    - 2 Terrace workers (44899, 3885);
    - 3 townspeople (4676, 1783, 4068);
    - the six conditioned cases: a man in the open on a rain day (11526), "a child past an age-rule birthday" (45519, in fact a baby of 2 months: S1), a baby under four months (46122), a herder (44216), a traveller (43779) and a grain-heap vigil (26701);
    - 3 drawn from everyone (38885, 14165, 27094).
- **Read before scoring:**
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 printed Babylonian and Julian dates agree with it. Three examples: day 202 = Tashritu 25 = 4 Nov 467; day 324 = Shabatu 29 = 6 Mar 466; day 265 = Kislimu 29 = 6 Jan 466. The day lengths fit 29.9° N: 14 h 05 min on 4 July, 10 h 11 min on 21 December.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - The first 45 lines (header and protocol) of `REVIEWS/shadow_phase5_r7.md`, for the report's shape.
  - Greps of `research/OPEN_QUESTIONS.md`. They covered the herders, winnowing and threshing, sickness, grinding, baking, water, porters, rest days, play and heat, and returned Q-057, Q-062, Q-065, Q-141, Q-143, Q-148 and Q-149.
  - The 20 scores, each with a paragraph, were then saved to `shadow_r8_A_scores.md` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `tools/shadow_days.ts`, in full.
  - From `src/people/population.ts`:
    - `small()`, the child with its minder (ll. 2083–2130);
    - the farm tasks and `pmOf` (ll. 736–770);
    - `builderAvailable` and `workWindow` (ll. 1077–1093);
    - `dayStorm` (l. 197);
    - `evening` and its baking rule (ll. 1873–1903);
    - the lane talk "after dark" (ll. 1912–1921) and `lightEnd` (l. 1389);
    - the treasury workshop's day (ll. 2940–2955);
    - `caretaker` (ll. 3088–3102) and `terraceWorker` (ll. 2837–2855);
    - `herderPassing` (ll. 3364–3395);
    - `ageOn` and `ageDays` (ll. 672–675), and the uses of `bday`.
  - From `src/people/sim.ts`: the porter's case (ll. 328–334), `INITIAL_STOCK` (l. 88) and the caravan event (ll. 466–478).
  - From `src/people/court.ts`: `sickDay` (ll. 245–252).
  - `src/data/lives.json`: `winnowing`, `work_day` and `home_hours`.
  - Headings and verdicts of rounds 6 and 7, both reviewers; r7 A's S2 and S3 in full; the "caravan" lines of r5 and r5_b.
  - Greps of `DECISIONS.md` for sick children, `dayStorm` and the guards' visits (D-191 l. 3218, l. 3227).
  - Read-only scratch scripts q1–q14 in the session scratchpad, outside the repo. Each imports `freshSim` (or `detailedDay`) from `tools/shadow_days.ts` and reads the plans of seed 1.
- **Score changes after reading the code:** none. The sample reports the simulation faithfully. S1 is a tool fault, but it only mislabels which stratum 45519 stands for. Her day is her real day, and I scored it as printed. Two of my remarks are withdrawn, with the scores unchanged (both stayed 4 for their other reasons):
  - #123: "nobody bakes". The household bakes on alternate days, and she baked at 16:57 on the day before (q8).
  - 44216: "the flock is nowhere". He is one of the baggage men. The band's flock is with the other men (`herderPassing`, `withFlock`).
- **Files:** I modified no project file other than this one. (The working tree already had changes to `src/render/pipeline.ts` and an untracked `tests/lib/ssgi_cpu.ts` before I started. I did not touch them.)

## Read first: what is broken or placeholder

1. **The gate passes for this reviewer: the lowest score is 4.** That holds for this sample. It does not mean the planner is clean. Three year-wide faults were measured after scoring. Each would pull a day below 4 if the sample landed on its bad end:
   - **S2, the sick toddler at work.** A child of 1–4 who is ill goes wherever its minder works. On 28,590 of 31,434 sick child-days (91 %) the child is out of the house, for a mean of 2 h 23 min. Year-wide that is 20,797 h on the threshing floor, 7,591 h in the fields, 3,484 h in the vineyards and 356 h at the work camp's querns. It includes a few hours on the Terrace building sites. 10,398 of those days have a night frost or near it (Tmin < 5 °C). On 9,507 of them a well elder of 50 or more was at home.
   - **S3, the storm that cancels the whole day.** `dayStorm` keeps every builder home on any day with a storm in its daylight. On day 247 the storm starts at 15:30 and the rain at 15:00, as the work window ends. All 612 builders stay home, some of them labelled "the gang works in halves in winter". On days 280, 300 and 353 the storm starts at 12:30–13:00, and a dry morning of 5–6 h is lost. #104 in this sample loses a day whose storm ended at 09:45.
   - **S4, porters waiting for a caravan.** The caravan comes once a day, at 09:00 or later. Once the depot is empty, a detailed porter waits at the stair foot for one that cannot come. Over 81 sampled porter-days the mean is 4.0 h of waiting out of 7.6 h at work, and 55 days have 3 h or more.
2. **Tool fault (S1).** The stratum "a child past a birthday that moves it across an age rule" filters on `age ∈ {0, 4, 7}` and `bday ≥ 0`. Babies born in the year also carry a `bday` value, which the simulation ignores for them. So 1,854 of the pool's 6,023 children (30.8 %) are newborns who cross no age rule. This round drew one of them, 45519, and so no age-rule child was shadowed.
3. **Lesser year-wide rules (S5–S10):**
   - a herders' arrival day of 10–12.6 h on the move;
   - winnowing pushed into the morning, away from the afternoon wind;
   - "after dark" said in daylight;
   - indoor Terrace staff stopping at noon on heat days;
   - Treasury women of every trade spinning "for the workshop";
   - sick guards kept in the garrison although their wives live in the town.
4. **No placeholders in this sample.** No line carries `[PLACEHOLDER: not performed]`.
5. **Caveat (from the tool's own header):** each detailed day starts from `INITIAL_STOCK`, which puts 30 sacks in the depot. I judged the porter's waits representative: 7 porters empty the depot every day, so a continuous run also starts most days near empty. I did not measure that.

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #40 (unnamed) | guard, leader of ten, m 37, Persian | 23 (Nisanu 23, 9 May 467; 10–27 °C) | **5** | Morning off with kit and sandals, a meal, the 14:00 change of watch, four rounds of seven posts, meals at the hearth, sleep after the watch. |
| 2 | #51 (unnamed) | guard, m 30, Median, ill | 273 (Tebetu 7, 14 Jan 466; −1–13 °C) | **4** | Ill all day in the garrison quarters with a little food. His wife and two small children in the town never see him (S10). |
| 3 | #28 (unnamed) | guard, m 34, Persian, day off | 273 (Tebetu 7, 14 Jan 466) | **4** | Knucklebones, then the day with his family in the town. His wife is ill, and he only talks and rests while the children of 10 and 7 fetch the water and fuel. |
| 4 | #113 (unnamed) | porter, m 42, Elamite | 265 (Kislimu 29, 6 Jan 466; −4–9 °C) | **4** | 17 sacks up to the Treasury store, but 4 h 15 min at the stair foot in winter "waiting for a caravan" that does not come (S4). |
| 5 | #123 (unnamed) | grinder, f 32, Persian | 125 (Abu 7, 19 Aug 467; 19–38 °C) | **4** | Quern at home before dawn, the camp's querns and three water trips, home at noon, spinning, lane, water. A heavy but credible day. |
| 6 | #104 (unnamed) | mason, m 24, Egyptian | 202 (Tashritu 25, 4 Nov 467; storm 02:30–09:45) | **4** | Rained off for the day, then 8 h 25 min of rest at home after the sky clears at 09:45 (S3). |
| 7 | 44899 (unnamed) | builder, m 43, Lycian | 79 (Simanu 20, 4 Jul 467; 17–37 °C) | **4** | Earth for the ramp 05:18–11:38 with no break, home at noon, two blocks of mending, lane talk "after dark" one minute after sunset (S7). |
| 8 | 3885 Bakabana | palace caretaker, m 22, Persian | 140 (Abu 22, 3 Sep 467; 20–39 °C) | **4** | Keeps the door of the closed Tachara 05:53–12:00, then a 4 h 42 min sleep. The door is unkept in the afternoon (S8). |
| 9 | 4676 (unnamed) | girl, 14, Persian | 196 (Tashritu 19, 29 Oct 467; 7–25 °C) | **4** | Quern, four water trips, bread to a kinswoman, 2 h 6 min for fuel, spinning. Also 3 h of "play" at 14. |
| 10 | 1783 (unnamed) | treasury shiner, f 29, Lydian, lives alone | 42 (Aiaru 13, 28 May 467; 14–32 °C) | **4** | Workshop and a stores errand to 12:42, then "spinning at home for the workshop" (S9) and a lane afternoon. |
| 11 | 4068 (unnamed) | homemaker, f 22, Persian | 194 (Tashritu 17, 27 Oct 467; 9–28 °C) | **4** | Dough, bread, quern, water, spinning, lane, supper. Every act in its place, but a light day. |
| 12 | 11526 Manyakka | farmer, m 28, Elamite | 324 (Shabatu 29, 6 Mar 466; rain 05:15–13:45, storm 05:45–13:30) | **4** | Stays at the homestead with the ewes and the new lambs through the storm (E-48). "Rest: storm" covers only 1 h of an 8 h storm. |
| 13 | 45519 (unnamed) | baby girl, 2 months (plain) | 346 (Addaru 21, 28 Mar 466; dust) | **5** | Ten feeds, asleep beside the mother, on a mat, in her lap, on her back to the well with the face wrapped against the dust. |
| 14 | 46122 Bakerabba | baby boy, 1 month (plain) | 249 (Kislimu 13, 21 Dec 467; 2–17 °C) | **5** | Eleven feeds with gaps of 2 h 45 min or less; on the mother's back to the canal and the well, in her lap with the women in the lane. |
| 15 | 44216 Irtuppiya | herder, m 34 (band of 26) | 171 (Ululu 23, 4 Oct 467; 11–30 °C) | **4** | Down from the hills into the plain with the loaded donkeys (E-49): camp pitched, donkeys watered, brushwood, the fire. But the stage is 10 h 20 min on the move (S5). |
| 16 | 43779 Bakumarda | traveller, m 30 (party of 7) | 340 (Addaru 15, 22 Mar 466; 4–20 °C) | **5** | Station lodging, breakfast with the party, animals loaded, on the road out dressed against the morning cold, gone on. |
| 17 | 26701 Irdaša | farmer, m 34 (plain) | 102 (Duzu 13, 27 Jul 467; 19–38 °C) | **4** | Threshing 05:38–10:48, a long afternoon sleep "tonight he keeps watch", out to the grain heap at 19:08, asleep by it from 20:59. |
| 18 | 38885 (unnamed) | homemaker, f 16, Elamite (plain) | 120 (Abu 2, 14 Aug 467; 15–33 °C) | **4** | Bread before dawn, winnowing 05:38–11:33, heat sleep, water, spinning, lane, quern, supper. All the winnowing falls in the still morning (S6). |
| 19 | 14165 Bakubeša | farmer, m 17 (plain) | 216 (Arahsamnu 9, 18 Nov 467; 3–19 °C) | **5** | Ploughing and sowing (E-40) 07:30–15:54, with the midday bread brought out by a child; the animals, supper, the lane, sleep. |
| 20 | 27094 Bakabada | boy, 4, ill (plain) | 230 (Arahsamnu 23, 2 Dec 467; 0–16 °C) | **4** | Ill, but taken to the cold lane for 1 h 52 min and twice to the well, "lying beside the mother", while a grandfather of 75 is at home (S2). |

Distribution: 5 → 5 people; 4 → 15; below 4 → 0.

## The 20 days (paragraphs as saved before reading the code)

**#40 (5).** A leader of ten in the garrison on a mild May day. His morning is off: breakfast after sunrise, then his kit (the spear shaft oiled, the shield's rim sewn), sandals and belt mended, and talk at the hearth. He eats at 13:08, before the 14:00 change of watch (three 8 h watches, E-80), and sees his file off to their posts. He then goes round seven posts four times (14:12, 15:42, 17:36, 19:28). Each round takes 25–30 min, the order of the posts varies, and he carries spear and wicker shield. Bread and water at 18:21, a meal after the watch at 22:01, asleep at 22:28. Everything fits the brief's guard (§9.1: shifts, changeovers, patrol, eat, idle). One nit: there is no round between 20:05 and 22:00, the first hours of dark, when a round is most wanted.

**#51 (4).** A Median guard, ill on a frosty January day (−1 to 13 °C). He lies in the garrison quarters all day and is fed "a little food" three times (07:49, 13:02, 19:01). His wife and two small children live in the town quarter q_lt_e, but no one is named as nursing him, and he stays on the Terrace. PEOPLE P5.5 has the garrison man living in the quarters, so this is defensible. But a sick man whose wife is a short walk away would more likely be taken home, or visited. Two zero-length moves ("walk → garrison_sleep" at 13:01 and 13:25, while he is already there) are artefacts. Nothing mentions warmth on a frosty night.

**#28 (4).** A Persian guard on a day off, on the same cold day. Breakfast at the north hearth, then knucklebones (§9.1 "gamble"). At 08:18 he goes down to the town, dressed against the cold, and spends the day with his family: a meal at 11:59, a chat in the lane, rest from 13:04 to 15:50, a meal at 15:50. He is back up at 16:26, sits at the hearth, and is asleep at 18:45. The household header says his wife (26) is ill today, and there are three children of 10, 7 and 3. His day never shows him doing any of her work or tending her: only "talk" and "rest". (After scoring: the children of 10 and 7 did the water, fuel and fire, q7.)

**#113 (4).** An Elamite porter in January (−4 to 9 °C). He eats bread at home at 06:39 and walks up before sunrise, dressed against the cold. He carries 17 sacks from the stair foot to the Treasury store, in cycles of 10–11 min (5–6 min loaded, stair included). He waits twice "for a caravan": 08:22–09:16, and 11:16–15:31 with the camp's bread and water at 12:03. Home at 15:56, the evening meal at 16:16, asleep at 19:12. The one oddity is more than four hours at the stair foot in the open in winter, for a caravan that does not come. A gang head would set him other work or send him home earlier.

**#123 (4).** A grinder (32) in Abu, at 38 °C. She grinds the household's flour at 03:54, eats bread and water, and is up at the work camp by 05:42. There she grinds at the querns, with three water trips for the camp (07:00, 08:42, 10:24; the jar on her head), and eats bread and water at 11:32. She is home at noon (the heat stop). She grinds "for tomorrow's bread" at 12:27, then spins, rests, spins again, talks in the lane, eats the evening meal, fetches the evening water, and sleeps at 19:52. About 6 h at the quern: heavy but credible. I noted two oddities: nobody bakes on her day, although the bread must come from somewhere (withdrawn after scoring: alternate-day baking); and she walks home in the worst of the heat, which the noon stop makes unavoidable.

**#104 (4).** An Egyptian mason (24). Rain falls 03:00–09:15 and a storm lasts 02:30–09:45; then the day warms to 25 °C. "No work on the building site today" (W-01). He mends tools 06:12–07:29 and breakfasts on the new bread. Then he rests 07:51–11:58 and 12:29–16:47, 8 h 25 min of rest in all, with meals and talk, and sleeps. Being rained off for the whole day by a morning storm is realistic for pre-modern day work. But once the storm clears at 09:45, a man of 24 with a wife and a baby, after the first autumn storm, would do something: the roof after the rain, fuel, an errand, the lane. The afternoon is empty.

**44899 (4).** A Lycian builder (43) in a house of four male builders, one of them ill; July, 37 °C. Bread at 04:30, then a 35-min walk to the Hall of 100 Columns site with mattock and basket. He hauls earth for the ramp 05:18–11:38, 6 h 20 min without a break, then eats bread and water and is home at noon (E-64). At home: rest, and two blocks of mending tools and baskets (2 h 43 min in all). Evening meal, then lane talk "after dark" at 19:03. Sunset is at 19:02, so it is dusk, not dark. Sleep at 20:35. Other oddities: 6 h 20 min of earth-hauling in summer with no morning break; the second mending block is filler; and no one in an all-male house is seen cooking or drawing water on his day.

**3885 Bakabana (4).** A caretaker (22) in early September, at 39 °C. Bread, then up to the Terrace. He is "keeping the door of the closed tachara" 05:53–12:00, with bread and water there. Home, then asleep 12:19–17:01 ("through the heat"), rest, the evening meal, rest with the household, asleep at 21:12. This is plausible for the doorkeeper of a shut palace with the court away. But a doorkeeper in the shade of a portico is not an outdoor labourer, so the noon stop is weak, and nobody keeps the door in the afternoon. A siesta of 4 h 42 min plus 8 h at night makes 12 h 49 min of sleep.

**4676 (4).** A girl of 14 in a household of seven, in late October (7–25 °C). She grinds before sunrise and fetches water. After breakfast she takes bread to a kinswoman and makes two more water trips. She walks 37 min out for fuel, gathers dung and brushwood for 53 min, and takes 36 min to carry it home. She spins for 94 min at home, then with the women in the lane, and fetches the evening water. About 6 h of work: an adult-like teenage day (Q-143), credible. The oddity is the word and amount of "play", 3 h in all, for a girl of 14, close to the age of marriage (Q-063: 14–20).

**1783 (4).** A Lydian woman (29) of the Treasury workshops, who lives alone. She grinds for 9 min, draws water, eats breakfast and rests an hour. At 06:57 she is at the workshop "shining gold and silver". She fetches materials from the royal stores (78 min), shines again and eats at the workshop. At 12:42 she goes home, "taking work home", to spin "for the workshop" for 2 h 12 min. Then water, 1 h 36 min of talk in the lane, cooking, supper and sleep. Oddities: a household of one woman is unusual for a kurtaš woman (PEOPLE P5.5 has groups and kin). Her workshop day ends at 12:42 on a 32 °C day, below the E-64 threshold: short. A metal-shiner spinning "for the workshop" joins two trades, though the Treasury did hold textiles (HENK2023).

**4068 (4).** A homemaker (22) with a gardener husband and a girl of 4, in late October. She kneads and bakes before dawn, grinds, and eats the new bread (the Q-149 pattern). She draws water, then talks and rests 08:02–10:40 and spins for 68 min. After the midday meal come talk in the lane, then household talk and rest 13:19–15:26. She grinds, warms the evening meal, eats, and sleeps at 19:04. Every act is right and in order, but the day is light for a young wife in autumn: about 3 h of textile and quern work between breakfast and supper, and 4 h 45 min of rest and talk in daylight.

**11526 Manyakka (4).** A farmer (28) on a day of rain and storm in early March (rain 05:15–13:45, 12.4 mm; storm 05:45–13:30). He stays at the homestead and tends "the ewes and the new lambs" (lambing, E-48, months 10–12: it fits) and the household's animals, about 6 h in all. He rests "at home: storm" 09:46–10:46, mends tools, eats with the household and sleeps. Tending lambs in the fold during a storm is exactly what a farmer would do. The oddity: "rest: storm" covers only one hour of an eight-hour storm, while his tending before and after it runs right through the storm. So the storm label looks arbitrary.

**45519 (5).** The day is printed as a girl of 2 months. The pick line says this pick is "a child past a birthday that moves it across an age rule (1, 5 or 8 on the day)", which does not match a 2-month-old; that is S1. As a 2-month-old: ten feeds, with night gaps of 3 h 25 min at most. She sleeps beside the mother, on a mat while the mother works, and in her lap at meals. In the afternoon dust she is carried on the mother's back to the well, with her face wrapped (W-03). A very good infant day. I scored the day as printed.

**46122 Bakerabba (5).** A boy of 1 month, in December (2–17 °C). Eleven feeds, with gaps of 2 h 45 min at most. He is carried on the mother's back to the canal (08:28–09:31), dressed against the cold. He sits in her lap in the lane with the women, goes with her to the well, lies in her lap at meals and sleeps beside her at night. A mother out at the canal three weeks after the birth is ordinary for a peasant household.

**44216 Irtuppiya (4).** A Persian herder (34) of a band of 26, arriving in the plain on Ululu 23 (early October; E-49's autumn passage fits). He wakes in the last camp in the hills and eats bread and curds. From 05:17 to 13:13 he is "coming down from the hills" (off the map), with a 21-min break. From 13:13 to 15:43 he comes down into the plain with the loaded donkeys, and reaches the first camp by 16:01. He eats, unloads, pitches the tents, waters and hobbles the donkeys, and gathers brushwood until after sunset. Then the evening meal, the fire, and sleep in the tent. Oddities: about 10 h 20 min on the move in one day is long for a transhumant stage, with a band that holds people of 72 and 66, a child of 2 and a baby of 16 months. Bands move a few hours and let the flocks graze. I also noted that the flocks are nowhere in his day; withdrawn after scoring, because he is one of the baggage men.

**43779 Bakumarda (5).** A traveller (30) in a party of seven at the road station, in March. He sleeps at the station lodging, breakfasts with the party and loads the animals. From 07:01 to 09:45 he is on the road out of the plain, dressed against the morning cold (4 °C), and then off the map toward the next station. Short but coherent. The halmi and the travel rations (E-21) are not shown, but a departure morning does not need them.

**26701 Irdaša (4).** A farmer (34) in late July, at 38 °C. He threshes on the village floor 05:38–10:48, with bread and water carried out at dawn. Home for the midday meal at 10:57, then asleep 11:29–15:09 (the second part labelled "tonight he keeps watch by the grain heap"). Then the animals, tools and the evening meal. At 19:08 he goes out to the floor, sits up by the heap until 20:59, then sleeps by it "guarding it" (the pattern of Ruth 3). Good. Oddities: threshing is usually done in the heat of the day, when the straw is brittle, not only in the early morning. And a 3 h 40 min sleep "because tonight he keeps watch" sits oddly with his going to sleep at the heap at 21:00.

**38885 (4).** A homemaker of 16 in a household of two (her husband is 20), in mid-August. She grinds, kneads and bakes before dawn, and breakfasts on the new bread. She winnows on the village floor 05:38–11:33, with bread carried out to her. Home, a sleep through the heat, rest, water from the well, spinning, rest, and time in the lane with the women. She grinds for tomorrow, warms the evening meal, eats, talks and sleeps. A full, credible day. The oddity: six hours of winnowing in the morning and none in the afternoon, when the plain's wind usually rises (Q-141 notes the afternoon *bād*).

**14165 Bakubeša (5).** A farmer of 17 in a house of eight, ploughing and sowing barley and wheat on Arahsamnu 9 (18 November; E-40's peak month). Breakfast, then out with plough, yoke and oxen, dressed against the cold (3 °C). He ploughs 07:30–15:54, and a child brings his midday meal out (Q-143). Home, the animals, the evening meal, the lane with neighbours after dark, sleep. Long for the oxen (about 7 h 50 min of ploughing), but within reason for a day in the sowing window.

**27094 Bakabada (4).** A boy of 4, ill, in early December (0–16 °C). He lies ill beside the mother at home, eats with the household three times and has a midday sleep. But the mother takes him with her to the lane 07:56–09:48, dressed against the cold, in air of about 3–6 °C. She also takes him twice to the well (10:12 and 11:01), where he is "ill, lying beside the mother". The household has a grandfather of 75 at home who could keep a sick child. A mother sitting two hours in a cold lane with a sick child is possible (sitting in the morning sun), but it is not what one would expect. A sick child "lying" at the well is odd.

## Findings

**S1. Tool: the "age-rule birthday" stratum draws babies born in the year.** Severity: **medium** for the gate's coverage (tool only; the simulation is right).
- **What:** the pick line calls 45519 "a child past a birthday that moves it across an age rule (1, 5 or 8 on the day)", but she is 2 months old.
- **Evidence:**
  - `tools/shadow_days.ts` l. 92 filters `job === 'child' && bday >= 0 && age ∈ {0, 4, 7}` and `d >= bday`.
  - Person 45519 has `age 0, born 264, bday 330` (q1). Babies born in the year keep a stray `bday`: 45059 has `born 23, bday 16`, a birthday before the birth.
  - The simulation ignores that stray value, because `ageOn`, `ageDays` and `monthsOld` all test `born >= 0` first (population.ts ll. 131, 672, 675). So on day 346 she is correctly age 0 and 81 days old.
- **Year-wide:** 1,854 of the stratum's 6,023 children (30.8 %) are in-year births, which can never cross an age rule. So about one sample in three misses the case.
- **Fix:** add `&& P.persons[i].born < 0` to the stratum filter. Also clear or set `bday = -1` for children born in the year, so no other reader is misled. Draw the stratum again in round 9.

**S2. A sick child under five goes wherever its minder works.** Severity: **medium** (27094 here; a 3 on its worse days).
- **What:** 27094, 4 and ill, is taken to the lane for 1 h 52 min at 3–6 °C and twice to the well, "ill, lying beside the mother". His grandfather of 75 is at home.
- **Cause:**
  - `small()` (population.ts ll. 2089–2112) always puts the child with its minder, the mother first, and copies her day.
  - For a sick child, `illness()` then only renames the child's `play` and `rest` segments to `lie_ill` "beside the mother", wherever she is.
  - Nothing keeps the child at home or hands it to someone who stays home.
- **Year-wide (q2, seed 1, all children aged 1–4 on their sick days, town and plain):**
  - 31,434 sick child-days; on **28,590 (91 %)** the child spends time out of the house (05:00–21:00, not counting roads). The mean is 2 h 23 min, and 18,991 days have an hour or more.
  - Hours by place: lane 21,256; **threshing floor 20,797**; well 10,619; **field 7,591**; **vineyard 3,484**; canal 2,290; orchard 1,404; the work camp's querns 356; about 20 h on the Terrace building sites (hall100_site, h100 walls, worksite).
  - 10,398 of these days have Tmin < 5 °C. On 9,507 a well household member of 50 or more was at home.
- **Why it is implausible:** EVENTS E-72 says the sick "stay home". A sick toddler left all morning on the threshing floor or in a field, "lying beside the mother" while she threshes or reaps, is something a knowledgeable observer would call wrong.
- **Fix:** on a sick day, pick the minder among those at home: an elder, the house's child-minder of 7–13, or the kinswoman keeping the house. If no one is at home, cut the mother's outdoor work that day to the house and yard; errands under 20 min (the well) may take the child along. Measure the out-of-house hours of sick children in the soak (target: nearly all at home).

**S3. A storm anywhere in the day's light cancels the whole day's building.** Severity: **medium** (#104 is a mild case; day 247 is wrong).
- **What:** on #104's day the storm ended at 09:45, and 5.7 h of the work window were then dry. "No work on the building site today."
- **Cause:**
  - `builderAvailable` (population.ts l. 1078) returns false whenever `dayStorm(C)` holds.
  - `dayStorm` (l. 197) is true for any storm overlapping sunrise − 0.5 h to sunset + 0.5 h.
  - `terraceWorker` (l. 2838) does the same for every Terrace worker (`homeDay('storm')`).
- **Year-wide (q5, q13):** 18 storm days. On 6 of them at least 4.4 h of the work window are dry, and on 5 at least 5 h:

  | day | storm | dry hours in the window | effect |
  |---|---|---|---|
  | 247 | 15:30–21:30 (rain from 15:00) | 7.7 of 8.2 | all 612 builders at home; the planner gives some the reason "the gang works in halves in winter" |
  | 353 | from 12:45 | 6.0 | 616 of 616 at home |
  | 202 | ends 09:45 | 5.7 | #104's day |
  | 280 | from 13:00 | 5.3 | 611 of 611 at home |
  | 300 | from 12:30 | 5.0 | 431 of 610 at home |
  | 185 | 07:15–11:45 | 4.4 | — |

  On dry days in the same winter weeks, about half the builders work (the winter halves: 304 and 309 of about 615 not on the Terrace on days 249 and 282).
- **Why it is implausible:** a gang cannot know at dawn that a storm will come at 15:30. D-191's intent is "a storm in the day's light keeps the day's outdoor work in", and that is right only for a storm that holds the morning.
- **Fix:** decide by the part of the day.
  - A storm (or rain) covering the first 2 h of the work window keeps the gang home for the day. That is the defensible "rained off" case.
  - Otherwise the gang goes up and stops at the storm's start (W-02), then walks home or shelters.
  - Apply the same test in `terraceWorker` and to the farm tasks that use `dayStorm`.

**S4. Detailed porters wait for a caravan that cannot come.** Severity: **low to medium** (#113).
- **What:** #113 waits at the stair foot 08:22–09:16 and 11:16–15:31 in January, then goes home.
- **Cause:**
  - The porter's case (sim.ts ll. 328–334) carries while `stock.depot > 0`; otherwise it adds `rest`/`talk` "waiting for a caravan" at the stair foot, in chunks of 0.2–0.5 h, until the plan's work window ends.
  - The caravan event (ll. 466–478) adds 20–80 sacks **once a day**, at the first step at or after 09:00.
  - So once the day's load is carried up, the afternoon's wait is for nothing.
- **Year-wide (q6):** all 7 detailed porters, every 25th day from day 4; 81 porter-days, about 4 s each to step.

  | measure | value |
  |---|---|
  | time at work, mean | 7.58 h |
  | "waiting for a caravan", mean | **4.03 h** a day |
  | waiting after 11:00, mean | 1.73 h (3.4–4.0 h on the days from Tashritu to Shabatu, e.g. days 179, 204, 229, 304) |
  | days with 3 h or more of waiting | 55 of 81 |
  | sacks carried, mean | 14 a day |

- **Earlier rounds:** r5 and r5_b read the waits as "real idle time" and scored them 5. That holds for the morning. The afternoon wait is not a wait for anything.
- **Fix:** any one of these:
  - once the day's caravan has come and the depot is empty, the porter goes to other work (carrying the camp's grain up, stacking in the Treasury store, the Treasury's issues) or goes home;
  - or allow a second arrival window in the early afternoon on some days, so the wait can end in a delivery;
  - or say what is being waited for ("waiting in case more loads come up").

**S5. Herders' arrival day: 10–12.6 h on the move.** Severity: **low** (44216).
- **What:** 44216 is off the map "coming down from the hills" from 05:17 to 13:13. He then walks on in the plain and reaches the camp at 16:01.
- **Cause:** in `herderPassing`, `B.k === 0` (population.ts ll. 3378–3392). The off-map "coming down" runs from the meal before the road down to `B.hour − 2.5`. The band enters at `B.hour` (≈ 13–15 h) and reaches camp at `B.arriveBag` (to sunset − 1.3 h).
- **Year-wide (q3):** 269 arrival days of men of 16 or more. Hours on the move (not counting meals): **median 11.1 h**, quartiles 10.1–11.7 h, range 7.4–12.6 h. 205 of the 269 are over 10 h. Most bands reach the first camp at 17:00–18:00.
- **Earlier rounds:** r7_b S11 fixed the arrival-day walk only for children under 7, who now ride after noon.
- **Fix:** end the stage earlier. Either enter the plain at 09:00–11:00 and be at the first camp by early afternoon, or treat the off-map morning as striking the last hill camp (packing, loading, milking) rather than walking. Aim for a stage of 5–7 h on the move.

**S6. Winnowing is pushed out of the afternoon wind.** Severity: **low** (38885, 26701).
- **What:** 38885 winnows 05:38–11:33 and not after the heat. 26701 threshes only in the morning.
- **Cause:** `pmOf` (population.ts l. 747) starts the afternoon session at `h1 + 0.8 + lerp(1, 4.5, hot)` and ends it at `sunset − 2.2 h`. On hot days the session is shorter than 0.75 h, so it is dropped.
- **Year-wide (q4):** every 5th person of the plain over the 99 E-43 days, 297,520 person-days on the floor.

  | measure | morning | afternoon |
  |---|---|---|
  | floor hours | 1,425,828 (89 %) | 169,220 |
  | winnowing hours | 337,859 (81 %) | 78,902 |

  The model's afternoon wind is stronger than its morning wind on all 99 days. Of the 143,574 person-days with a working afternoon wind (≥ 1.8 m/s), 60,977 (42 %) have no afternoon on the floor.
- **Fix:** when `windPM ≥ winnowing.wind_ms`, run the afternoon session from about 16:00 to sunset − 0.3 h, in the evening breeze, the traditional winnowing hour (Q-141). Do not end it at sunset − 2.2 h.

**S7. "After dark" is said in daylight.** Severity: **low** (44899: 19:03, sunset 19:02).
- **Cause:** population.ts ll. 1912–1921. The lane talk takes the words "talking with neighbours in the lane after dark" whenever the stretch is too short for a game in the light, with no test of its start.
- **Year-wide (q10):** every 10th person, every 7th day. **4,216 of 10,000** "after dark" segments (42 %) start before `lightEnd` (sunset + 0.4 h), and 1,491 (15 %) before sunset itself.
- **Fix:** choose the words by the start: "in the lane at dusk" before `lightEnd`, "after dark" only after it. Or split the segment at `lightEnd`, as the lit branch already does.

**S8. Indoor Terrace staff stop at noon on heat days.** Severity: **low** (3885).
- **Cause:**
  - `terraceWorker` (l. 2840) takes its window from `workWindow(C)`, which ends at `heat_end_h` (12) on every `heatRest` day.
  - The comment at l. 2842 says work "under a roof" gets no heat rest.
- **Year-wide (q11):** 115 heat-rest days (days 29–175). On them the doorkeepers of the closed palaces leave the door at a mean of **11:49**; on other days at **15:30** (159 and 332 sampled doorkeeper-days). The doors are unkept on 115 afternoons. His 4 h 42 min afternoon sleep follows from the early end.
- **Fix:** give places under a roof (`treasury_*`, `palaces:*`) the normal window. Or, if the day must be short, stagger it so someone keeps the door in the afternoon.

**S9. Treasury women of every trade spin "at home for the workshop".** Severity: **low** (1783).
- **Cause:** the treasury workshop's day (population.ts ll. 2942–2953). The afternoon's `home` choice gives every woman `spin` "spinning at home for the workshop", whatever her `sub`.
- **Year-wide (q11):** every 2nd day, days spent spinning at home "for the workshop":

  | trade (`sub`) | days | days spinning at home |
  |---|---|---|
  | shiner | 31,553 | 7,538 (24 %) |
  | wood | 32,517 | 7,721 |
  | handler | 24,730 | 5,794 |
  | textile (where it fits) | 32,444 | 7,793 |

- **Fix:** spinning at home only for the textile women. Give the others "finishing the work at home" (as the men have) or another errand.

**S10. A sick guard with a wife in the town lies ill in the garrison; a guard at home with a sick wife only talks.** Severity: **low** (#51, #28).
- **Cause:** `sickDay` (court.ts ll. 246–252) keeps the guard at his sleeping place.
- **Year-wide (q9):** 629 guard sick-days; on **425 (68 %)** his household in the town has a wife (or another woman of 14 or more).
- **The visit:** #28 visits on his wife's sick day, which is the r7 S3 fix working. But he "talks" and "rests" for 7 h while his children of 10 and 7 fetch two jars of water, fuel and the oil, and light the fire (q7). His family's plans do not know he is there.
- **Fix:**
  - An ill married guard goes down to his family, or the wife brings his food up once.
  - A guard at home with a sick wife takes a share of her work (water, fire, the bread from a kinswoman).
  - At least drop the zero-length "walk → garrison_sleep" steps in #51's log. Those come from a new spot within the same place.

**S11. Checked, not faults, and small notes.**
- **The grinder's bread (#123).** Household 303 bakes on alternate evenings: 16:57 on day 124, then days 126, 128 and 130 (q8). Year-wide, the houses of the camp women go without a bake on both a day and the day before on only 1.9 % of sampled house-days.
- **The herder's flock (44216).** He is a baggage man; the flock is with the other men.
- **Play at 14 (4676).** Girls of 14 have 2 h or more of play on 5 % of their days, against 39 % at 13 and 0 % at 15 (q12). She is the tail: past her birthday on day 4 and still "child". A girl of 14 who has had her birthday could take the 15-year-old's day.
- **The storm label (11526).** "At home: storm" fills one hour of home time, while his lambing work in the fold runs through the storm. The work is right; only the label's placement is arbitrary.
- **Dates and sun.** All 20 are correct against CALENDAR_AND_UNITS, and the sunrise and sunset times fit the latitude.
