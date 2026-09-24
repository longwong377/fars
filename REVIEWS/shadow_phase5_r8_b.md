**VERDICT: FAIL.** 1 of 20 people scores below 4. **44216 Irtuppiya** (transhumant herder, 34, Ululu 23) scores **3**. On his band's arrival day he is on the move from 05:17 to 16:01, 10 h 44 min, with one 21-min meal and no midday halt. The last 2 h 30 min of it are on the plain road in a 28–30 °C afternoon. No sheep or goats appear anywhere in his day. The other 19 people score 4 (12 people) or 5 (7 people). After scoring I regenerated the sample: it is byte-identical. The arrival-day march is a planner rule. The arrival branch of `herderPassing` has no halt, and the band leaves the hills before dawn whatever its arrival hour. In seed 1, 874 of the year's 908 arrival-day person-days (96 %) spend 8 h or more on the move with no stop of 45 min (S1). The missing flock is not a fault: the code sends five men and a youth with the flock while Irtuppiya takes his turn with the donkeys. The sample just does not show it. **No score changed after scoring.**

# Shadow review, Phase 5, round 8, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent, reviewer B (Claude Opus 5.5). I did not build the simulation or see it built. I did not read reviewer A's round-8 review, any `shadow_r8_A_*` file, or `DECISIONS.md`.
- **Date:** 2026-09-24. **Tree:** `/home/user/fars`, branch `claude/amazing-fermi-40ds7j`, HEAD `eeb1b71`. When I regenerated the sample, the working tree had changes I did not make: `src/render/pipeline.ts` was modified and `tests/lib/ssgi_cpu.ts` was untracked. Neither is people code, and the regenerated sample is identical.
- **Gate (§13.11):** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick149.txt` (seed 1, pick seed 149; md5 `0593835b1360f433d54e2d8ecfacaf15`). No earlier reviewer had seen it. After scoring I ran `npx tsx tools/shadow_days.ts 1 149` into the scratchpad. The output is **byte-identical** (same md5).
- **Read before scoring:**
  - the sample, in full;
  - `research/CALENDAR_AND_UNITS.md`, `EVENTS.md`, `PEOPLE.md`, `PLAIN.md` and `SETTLEMENT.md`, each in full;
  - `PERSEPOLIS_BRIEF.md` §5.5, §9 (9.1–9.5) and §13;
  - the first 35 lines (header and protocol) of `REVIEWS/shadow_phase5_r7_b.md`.

  I built the day → month table from the month lengths. With Nisanu 1 = 17 Apr 467, the months begin on regnal days 1, 30, 60, 90, 119, 149, 178, 208, 237, 267, 296 and 326. All 20 printed dates agree with it: regnal day, Babylonian date and Julian date. For example, day 273 = Tebetu 7 = 14 Jan 466, and day 324 = Shabatu 29 = 6 Mar 466 (February 466 BCE has 28 days). The sunrise and sunset times are symmetric about noon, and the day lengths fit 30° N (10 h 11 min on 21 Dec, 14 h 05 min on 4 Jul).
- **Scores fixed first,** in `/tmp/claude-0/-home-user-fars/fad19950-8a5a-5896-841e-0efd63223cfa/scratchpad/shadow_r8_B_scores.md`, before any code, data file or earlier review was opened.
- **Read after scoring:**
  - `tools/shadow_days.ts`;
  - `src/people/population.ts`: `bandDay`, `herderPassing`, `atCamp`, `builderAvailable`, `workWindow`, `dayStorm`, `wetHours`, the guard family visit (l. 2418–2437), `lightEnd`, the gardener's day and the home-hours chooser;
  - `src/people/court.ts` `sickDay`;
  - `src/people/calendar.ts` (`transhumantBands`, `rateSchedule`, `HOURS`);
  - `src/data/lives.json`: `herders`, `children`, `home_hours`, `homemaker`, `household_bread`, `guard_rota`, `guard_family_share`, `guard_off_day`, `sick_episodes_per_year`;
  - `research/OPEN_QUESTIONS.md` Q-061, Q-065, Q-143, Q-223;
  - the verdicts and finding titles of `REVIEWS/shadow_phase5_r7.md` and `_r7_b.md`.
- **Measured after scoring (read-only scratch scripts in the scratchpad, seed 1):**
  - `r8b_child.ts`: the child stratum's pool;
  - `r8b_storm.ts` and `r8b_storm2.ts`: builder days lost to the weather rules;
  - `r8b_hh.ts`: the plans of the other members of households 1417 and 6379;
  - `r8b_band.ts`: band 16 on day 171;
  - `r8b_t.ts`: temperatures;
  - `r8b_scan.ts` and `r8b_merge.py`: a full-year scan of every present person's plan on all 354 days, about 15.4 M person-days, run in four processes.
- **Score changes after scoring: none.** The sample reports the simulation faithfully. One part of 44216's paragraph, "the flock never appears", is explained by the code (S1): the band has a flock and he is on his turn with the donkeys. The sample shows his day as the simulation plans it, so this is not a tool fault and the score stands. The other half of the reason, a 10 h 44 min march with no halt, is a planner rule on its own. I would score it 3 even with the flock shown.

## Read first: what is broken or placeholder
1. **Blocking: a transhumant band's arrival day has no halt (S1).** On moving days the band halts at midday for 1–3.5 h and lets children under 7 ride the loads. On the arrival day (`herderPassing`, `B.k === 0`) it does neither. It is woken before dawn and "comes down from the hills" off the map until 2.5 h before an arrival hour drawn uniformly from 07:00–17:00. In seed 1, 96 % of arrival-day person-days are 8 h or more on the move with no stop of 45 min (median 10.05 h). That includes 134 of 138 children aged 5–9 and all 25 people aged 60 or over.
2. **Whole-day weather gates stand the builders down on days with a dry half (S2).** Eight days a year have 4 or more dry hours in the work window, and 3,422 builder-days are lost on them. On six of those days the rain begins only in the afternoon: at 15:00 on two days whose work ends at 15:30.
3. **Illness does not change what the carers do (S3).** A mother takes her feverish 4-year-old into the lane at 2–7 °C for her own talk and spinning. Year-wide, 2,958 sick-child-days have 1 h or more out of doors below 8 °C. A sick guard with a family in the town is always nursed in the garrison (338 of 338 days measured).
4. **Minor, year-wide:**
   - teenagers classed as children play 3–4 h a day (S4);
   - "talk with the household" is outside the women's rest cap (S5);
   - some adults sleep 12.5 h or more on a summer day (S6);
   - labels (S8).
5. **Tool fault, no score effect:** the "child past a birthday" stratum draws babies born during the year. 45519, aged 2 months, was drawn for it. In seed 1 that is 31 % of the stratum's pool (S7).
6. **Placeholders visible in this sample:** none are flagged `[PLACEHOLDER]`. The herders, the herders' flock and the plain population are not rendered (Q-302, D-024). They exist only in the plans.

## Scores

| id | who | date | score |
|---|---|---|---|
| #40 | guard, leader of ten, m37 | Nisanu 23 | 5 |
| #51 | guard, m30, ill | Tebetu 7 | 4 |
| #28 | guard, m34 | Tebetu 7 | 4 |
| #113 | porter, m42 | Kislimu 29 | 4 |
| #123 | grinder, f32 | Abu 7 | 4 |
| #104 | mason, m24, storm morning | Tashritu 25 | 4 |
| 44899 | builder, m43 | Simanu 20 | 4 |
| 3885 Bakabana | caretaker, m22 | Abu 22 | 4 |
| 4676 | girl, 14 | Tashritu 19 | 4 |
| 1783 | treasury shiner, f29 | Aiaru 13 | 4 |
| 4068 | homemaker, f22 | Tashritu 17 | 4 |
| 11526 Manyakka | farmer, m28, rain and storm | Shabatu 29 | 4 |
| 45519 | baby girl, 2 months | Addaru 21 | 5 |
| 46122 Bakerabba | baby boy, 1 month | Kislimu 13 | 5 |
| **44216 Irtuppiya** | **transhumant herder, m34** | **Ululu 23** | **3** |
| 43779 Bakumarda | traveller, m30 | Addaru 15 | 5 |
| 26701 Irdaša | farmer, m34, threshing-floor night | Duzu 13 | 5 |
| 38885 | homemaker, f16 | Abu 2 | 5 |
| 14165 Bakubeša | farmer, m17, ploughing | Arahsamnu 9 | 5 |
| 27094 Bakabada | boy, 4, ill | Arahsamnu 23 | 4 |

The paragraphs below are those written before any code was read. Notes added after scoring are marked *[after scoring]*.

**#40 (5).** A coherent 14:00–22:00 watch for a leader of ten. He is off watch in the morning and sees to his kit and sandals. He eats before the watch and sees his file off at the change of watch. Then come four rounds of 25–35 min over seven or eight posts, in varying order, with the hearth between rounds, bread and water at 18:21 and a meal after the watch at 22:01. Mild spring weather. Only small points: the 19:28–20:02 round runs into nautical dusk and no lamp is carried, and no handover is shown at 22:00. *[after scoring: watch B of the A-B-C-off-off rota, `guard_rota`.]*

**#51 (4).** An ill guard lies in the garrison quarters all day. Food is brought at 07:49, 13:01 and 19:01. That is plausible in a barracks. Oddities: his wife and two small children live in the lower town, yet he is neither taken home nor visited. Two 1-minute "walk → garrison_sleep" legs lead to the place he is already in (13:01, 13:25). *[after scoring: `court.ts sickDay` always keeps a sick detailed agent at his sleeping place (S3).]*

**#28 (4).** He is off watch for the whole day and goes down to his family in the town (about 24 min each way, dressed against a −1 °C morning). He spends 08:42–16:26 with them, with a midday meal, a rest and an early meal before climbing back. Then he sits at the hearth and is asleep by 18:45. A plausible rest day. The oddity: his wife is ill today, with children of 10, 7 and 3, and his day is "talk" and "rest" with the family. He does no water, fire or bread for the house, and nobody else is shown doing it. The night is long (18:45 → 07:25), but it is a January night. *[after scoring: an off day of the rota. The round-7 fix makes illness at home force the visit (`wantVisit`, l. 2419), but the visit's content ignores it (S3).]*

**#113 (4).** A porter's winter day. He leaves home before sunrise and makes 22 sack carries from the stair foot up to the Treasury store, about 11 min a round trip, over roughly 07:15–11:11, with a wait for a caravan in between. He eats the camp's bread at noon and goes home at 15:31 to the evening meal and bed. Plausible. Oddity: he waits for a caravan that never comes for 4 h 15 min (11:16–15:31) at 5–9 °C, idle, and is not sent to other work.

**#123 (4).** A grinder at the Terrace work camp on a 38 °C August day. She grinds the household's flour before dawn (03:54), walks up, grinds at the camp querns with three water-fetching trips, and leaves at noon for the heat. At home she does more grinding, spinning, a talk outside the door in the evening, the meal and the evening water. Plausible and well paced. Oddities: nobody bakes in this household today, although she grinds twice for it. The evening meal appears with no cooking. The porter of 27 in her household never shares a moment with her. *[after scoring: bread is baked every other day (`household_bread.bake_every_days` 2), so grinding without baking is by rule and not a fault.]*

**#104 (4).** Storm 02:30–09:45 and rain 03:00–09:15. "No work on the building site today." He mends tools and baskets at home, eats the new bread, and rests. Calling the site off for a day after an all-morning storm is plausible (mud, wet mortar). Oddity: from 07:51 to 16:47 he does nothing but rest and eat, although the sky clears at 09:45. A young mason with a wife and a toddler, after a seven-hour storm on a mud-brick house, would plausibly see to the roof or the courtyard, run errands or visit. The afternoon is empty. *[after scoring: `builderAvailable` stands every builder down all day for any daylight storm or more than 5 rain hours in the day (S2).]*

**44899 (4).** A Lycian labourer in an all-male household of four builders. He leaves before sunrise, walks 35 min up to the Hall of 100 Columns, and builds up the earth ramp from 05:18 to 11:38. He eats bread on site and goes home at noon on a 37 °C day. Rest and two blocks of tool and basket mending (2 h 43 min in all) follow. Then the evening meal, the lane and bed. Plausible. Oddities: breakfast says "the household eats later", but the whole household is builders. The lane talk is labelled "after dark" at 19:03, one minute after sunset. *[after scoring: the fourth builder is ill and at home, so "the household eats later" is true. The "after dark" label is S8.]*

**3885 Bakabana (4).** A palace caretaker keeps the door of the closed tachara from 05:53 to 12:00 and eats his bread there. He goes home at noon and sleeps 12:19–17:01 on a 39 °C day, then eats and rests with his young wife and baby until bed at 21:12. Plausible. Oddities: 12 h 48 min of sleep in the day. His whole afternoon and evening are sleep and "rest". The door he keeps is apparently unkept all afternoon. *[after scoring: S6.]*

**4676 (4).** A 14-year-old girl in a household of seven. She grinds before sunrise and fetches water three times. She takes bread to a kinswoman, and goes out for fuel (37 min out, 53 min gathering dung and brushwood, 36 min back under the load). She spins at home and then with the women in the lane. At dusk she fetches the evening water. Much of it is a good girl's day. Oddities: at 14, near marrying age, she also "plays" for 3 h 2 min (1 h 25 min at a friend's house, 1 h 37 min in the lane). The same house h:1320 is called a kinswoman's, a friend's and a neighbour's within three hours. *[after scoring: S4 and S8.]*

**1783 (4).** A Lydian gold-and-silver shiner of 29 who lives alone. She grinds a little flour and fetches water before work. She polishes 06:57–12:42 with a 78-min errand to the royal stores for materials, then takes spinning home "for the workshop". Water, a long talk with the women outside the door, warming the evening meal and bed follow. Plausible. Oddities: a woman of 29 in a one-person house (no kin at all). She grinds flour but nobody bakes. Spinning as take-home work for a metal-polishing workshop is a stretch (though the treasury also handled textiles). *[after scoring: bread every other day, as for #123.]*

**4068 (4).** A young homemaker with a gardener husband and a daughter of 4. She kneads and bakes before sunrise, grinds, eats the new bread and fetches the water. The rest is spinning (68 min), grinding again, warming the evening meal and many hours of "talk with the household" and "rest": 08:02–10:40, 13:19–15:26, 16:13–16:23 and 17:10–19:04. Nothing is wrong, but the day is light for a peasant woman: about 3 h 45 min of productive work in 13 waking hours. Textile work in particular is thin. *[after scoring: her husband is at the garden 06:34–15:30. So her "talk with the household" at 08:02–09:25 is with the 4-year-old, who is "playing at home near the mother" (S5).]*

**11526 Manyakka (4).** A plain farmer on a day of storm and 12.4 mm rain (05:15–13:45). He works with the ewes and new lambs and the household's animals at home, and has an hour "at home: storm" in the middle. Mending, meals and bed. Lambing in Shabatu fits. Animals must be tended in any weather, and he stays at home, so the day is plausible. Oddities: the "storm" rest comes at 09:46, four hours into the storm, and he goes back to the fold at 10:46 while it is still running. No cold or wet dress is shown for work in the fold at 1–5 °C in rain.

**45519 (5).** A 2-month-old girl. Ten feeds 2–3.5 h apart, including two at night and a cluster at dawn. She sleeps on a mat or in the lap while the 17-year-old mother works, and rides on the mother's back to the well with her face wrapped against the dust (dust 10:45–17:15). Nothing wrong. (The pick line says she was chosen for crossing an age rule of 1, 5 or 8; at 2 months she does not. To check after scoring.) *[after scoring: a pick fault (S7). She was born on regnal day 264.]*

**46122 Bakerabba (5).** A 1-month-old boy on a December day. Eleven feeds. He is on the mother's back, dressed against the cold, at the canal in the morning and at the well in the afternoon, and in her lap in the lane in the late-morning sun. Nothing wrong for a village infant.

**44216 Irtuppiya (3).** A transhumant band of 26 comes down into the plain in Ululu (E-49, autumn descent). Bread and curds before dawn. Then about 10 h 45 min on the move (05:17–16:01) with one 21-min meal, 2 h 30 min of it on the plain road through the 30 °C afternoon. They unload the donkeys, pitch the tents, water and hobble the donkeys, gather brushwood, eat by the fire and sleep in the tent. What a knowledgeable observer would call wrong: **the flock never appears.** This man is 34, the prime herding age, in a band of "herders". His day is loading and unloading donkeys, pitching tents and gathering brushwood. Nobody is shown moving, watering, counting or folding sheep and goats on the day a transhumant band reaches its autumn grazing (E-49 lists "herders, flocks, dogs"). The march also runs through the whole day. Migrating bands start before dawn and stop by late morning, above all when they drive flocks, which must graze. As shown, this is a donkey caravan, not transhumance. *[after scoring: the band does have a flock. Men 44209 (48), 44218 (53), 44222 (46) and 44227 (48) and the youth 44212 (15) bring it down "with the flock and the dogs" from 13:34, graze it along the plain edge, and water and fold it beside the tents at 17:21. Irtuppiya and 44231 are the band's two baggage men today, by the one-in-four turn of `lives.json herders` (D-150). So the flock half of my reason is answered by the simulation, but not by the sample. The march half is S1: it holds for everyone in the band, the flock men included (on the move about 05:17–17:21 with a 21-min meal). The 6-year-old 44214 walks until 15:43 and rides only the last 18 min. The score stays 3.]*

**43779 Bakumarda (5).** A traveller of a party of seven at the road station. Up just before sunrise, breakfast with the party, loading the animals, and off on the road out of the plain at 07:01, dressed against the 4 °C morning. Off the map by 09:45. Nothing wrong.

**26701 Irdaša (5).** Threshing with the animals on the village floor from 05:38 to 10:48 (a bread-and-water break at 08:24). Home for the midday meal, then a long sleep through the 38 °C afternoon, explicitly because tonight he watches the grain heap. Animals, mending, the evening meal. Out to the floor at 19:08 to sit up by the heap, then sleep beside it. Entirely plausible. The night guard of the heap is a well-known practice.

**38885 (5).** A 16-year-old wife in a two-person household. She grinds, kneads and bakes before dawn, then eats the new bread. She winnows on the village floor 05:38–11:33 with a break. Home at noon: sleep and rest through the heat, the water, spinning, the lane with the women, grinding for tomorrow, warming the meal, the evening and bed. Coherent. Winnowing at dawn, when winds are usually light, is a small point.

**14165 Bakubeša (5).** A 17-year-old ploughs and sows barley and wheat in Arahsamnu (E-40 peak) from 07:30 to 15:54. A child of the house brings the midday bread. Then the animals, the evening meal and 1 h 30 min with the young men in the lane before bed. Plausible for a farming son. The "after dark" label starts 3 min before sunset (17:17 against 17:20). That is trivial.

**27094 Bakabada (4).** A sick 4-year-old kept beside his mother all day. Meals with the household and a midday sleep. Oddities: the mother takes him to the lane for 1 h 52 min on a December morning (07:56–09:48, roughly 2–8 °C after a 0 °C dawn). He is "walking with the mother" to the well twice and "lying ill" at the well. The household has a grandfather of 75 at home who could sit with him. It is plausible that a mother keeps a sick child with her, but the early lane session in near-freezing air is not what one would do with a feverish child. *[after scoring: measured 2.4 °C at 07:56 and 7.0 °C at 09:48. The mother is "talking with the women outside the door" and then spinning there. The grandfather sees to the animals and then goes to the lane himself (08:47–10:16), so no one is at home to keep the child (S3).]*

## Findings

**S1. Blocking (44216): a transhumant band's arrival day is one unbroken march, with no midday halt and no ride for the children.**
- *What.* Everyone in a band on its arrival day is on the move from before dawn until the first camp. There is only the one meal stop, and none of the halt or riding rules of the band's other moving days apply.
- *Evidence (sample).* 44216 has bread and curds at 04:59 (sunrise 06:01). He is off the map "coming down from the hills with the band" 05:17–13:13, broken only by bread and water 10:39–11:00. Then "walk @ road:arrival" 13:13–15:43 at about 28.6 °C (measured 13:00), and on to the camp at 16:01: 10 h 44 min. For the same band on the same day (`r8b_band.ts`), the flock men are on the move until 17:21. The 6-year-old 44214 walks until 15:43 and rides only the last 18 min.
- *Cause (code).*
  - `herderPassing`, branch `B.k === 0` (population.ts l. 3380–3395): the band sleeps only until `B.wake` (sunrise − 0.6 to 1.1 h) and eats. The off-map "coming down" segment then runs until `down = B.hour − 2.5`, and the arrival road until `B.hour`.
  - `B.hour` comes from `rateSchedule`, with `HOURS.pastoral = [7, 17]`. A band arriving at 15:43 has therefore been walking since before dawn.
  - The midday halt `haltA`–`haltB` (1.5–2.5 h on a warm day, 2.5–3.5 h when hot) is used only in the moving-day branch.
  - The ride for children under 7 (`road()`, `this.t >= 11.9`) applies to the arrival day only after `B.hour`.
- *Year-wide (seed 1, `r8b_scan.ts`, all 354 days).* 34 band arrivals, 908 person-days.
  - Time on the move from the pre-dawn start to the first camp: median 10.05 h, maximum 13.25 h. 880 of 908 (97 %) are 8 h or more, and 492 (54 %) are 10 h or more.
  - The longest stop has a median of 21 min. 874 person-days (96 %) combine 8 h or more on the move with no stop of 45 min.
  - Children aged 5–9: 134 of 138 are 8 h or more. People aged 60 or over: 25 of 25.
  - For comparison, on the 45 band moving days (1,346 person-days): median 8.3 h with a median longest stop of 1.2 h, and 141 (10 %) at 8 h or more without a 45-min stop.
- *Fix (rule level).*
  - Give the arrival day the moving day's shape: break camp in the hills at `max(first light, B.hour − stage)`, with a stage of about 4–6 h (C). Before that, the band is "in the last camp in the hills": milking, striking the tents, loading.
  - Put the `haltA`–`haltB` halt into any arrival day that spans midday. Apply the under-7 ride from the start of the stage.
  - Narrow the band's arrival hours to the morning or early afternoon (for example 09–14), since bands camp by the early afternoon.
  - For the tool: for a herder, print one line of the band's day ("the flock came down with 44209, 44212, 44218, 44222 and 44227; in camp at 17:21"). A reader of a baggage man's day then sees that the band has a flock.

**S2. Minor (#104): whole-day weather gates stand the builders down on days with 4 or more dry working hours.**
- *What.* `builderAvailable` (l. 1077) returns false all day if `dayStorm(C)` (any storm overlapping daylight) or if `C.wx.rainH > 5`. `rainH` counts the whole day's rain hours, including those after work ends, although the comment says "rained off before work started". The builder then gets `homeDay('no work on the building site today')`.
- *Evidence.* #104's storm ends at 09:45, and the work window runs 06:52–15:30, so 5.7 dry hours remain. He rests 07:51–16:47 with nothing but meals.
- *Year-wide (`r8b_storm2.ts`).*
  - 21 days stand the gangs down for weather, 9,461 builder-days in all.
  - On 8 of those days the work window has 4 or more dry hours, costing 3,422 builder-days.
  - On 6 of the 8 the wet only begins 4 h or more into the window. On d242 and d247 the rain starts at 15:00, and work would end at 15:30.
  - Among the 5,944 "no work on the building site today" person-days, 614 have their wet end before 10:00. On those, the stood-down worker averages 5.0 h of rest, talk and play in the 7.8 h of daylight left (`r8b_scan.ts`).
- *Fix.*
  - Gate on `wetHours` inside `workWindow`. When the morning is dry, the gangs work until the rain (as the gardener and farm rules already do via `dryTask` and `workBlock`).
  - When the rain ends early, stone dressing starts late while mud-brick and mortar stay off (E-62).
  - Give a rained-off day home jobs: after a storm, rolling the roof and clearing the courtyard (C).

**S3. Minor (27094, #51, #28): illness does not change what the carers do, and a sick guard is never nursed at home.**
- *Evidence.*
  - 27094's mother (27093) spends 07:56–09:48 "talking with the women outside the door" and then spinning there, so her sick 4-year-old lies in the lane at 2.4–7.0 °C. The grandfather (27096) is at home only until 08:44, then goes to the lane himself.
  - #51 lies ill in the garrison, although his wife and children are in the town.
  - #28's visit is forced by his wife's illness (the round-7 fix, `wantVisit` l. 2419), but the visit is "talk" and "rest".
- *Year-wide (`r8b_scan.ts`).*
  - 89,926 sick-child-days (ages 1–13). 19,402 (22 %) have 1 h or more at an open place (lane, well, canal, field …) other than walking. 2,958 have 1 h or more there below 8 °C, and 1,698 below 5 °C.
  - Detailed guards: 629 sick days, 425 of them for men with a household in the town. All 338 of those whose plan has `lie_ill` lie ill in the garrison, and none at home (`court.ts sickDay` always uses the sleeping place).
- *Fix (C).*
  - When a child under 8 is sick and the air is below about 10 °C, the minder's outdoor leisure becomes indoor work (the spindle), or the grandparent stays in.
  - A sick guard with a household in the town is taken down to be nursed there once he can walk, or the garrison rule is stated as a decision.
  - A husband visiting a sick wife does the water and the fire.

**S4. Minor (4676): teenagers still classed as children play 3–4 h a day.**
- *What.* `children.work` has hour bands only up to 12–13 (girls 6.0 h, boys 5.5 h). Its own note (and Q-143) says children's work rises "to near-adult days in the early teens". A 14- or 15-year-old of job `child` keeps the play choices (lane, friend, water edge).
- *Year-wide.*
  - Girls 13–15 (25,719 days): mean play 3.06 h a day; 70 % of days have 2 h or more and 41.5 % have 3 h or more.
  - Boys 13–15 (29,526 days): mean 4.22 h; 72 % of days have 3 h or more.
- *Fix.* Add a 14–15 band with near-adult hours: girls with the women at the quern, spindle and loom, boys with the men in the fields and with the animals. Cap play at about 1–1.5 h.

**S5. Minor (4068): "talk with the household" is outside the women's rest cap.**
- *What.* `home_hours.women_rest_cap_h` caps a woman's daylight rest at 3 h (2.5 h in winter). The `talk` choice (weight 0.2) and `children` (→ "talk, with the household") are not capped, so talk stands in for rest. At 08:02–09:25 4068's "household" is her 4-year-old.
- *Year-wide.*
  - Town homemakers aged 16–50, not sick (388,834 days): mean 6.2 h of work (every act but sleep, rest, talk, play, gamble, eat, walk) and 6.8 h of rest, talk or play; 9.7 % of days have under 4 h of work.
  - Plain homemakers: 7.1 h work and 5.9 h idle; 5.5 % under 4 h.
- *Fix.* Count home talk under the cap, or keep the spindle in her hands while she talks (spin with talk). Label the talk "with the child" when the child is the only one at home.

**S6. Minor (3885): adult days with 12.5 h or more of sleep, mostly summer siestas.**
- *Year-wide.* 71,703 of 8.08 M adult-days (ages 16–60, not sick, town and plain, guards excluded; 0.9 %) have 12.5 h or more of sleep. 43,511 of them fall in summer. By job: farmers 54,853, homemakers 9,655, elders 5,819.
- *Evidence.* 3885 sleeps 12:19–17:01 (4 h 42 min) plus his night, 12 h 48 min in all.
- *Fix.* Cap the E-64 heat sleep at about 2–2.5 h, with rest or indoor work after it.

**S7. Tool fault, no score effect (45519): the stratum "a child past a birthday that moves it across an age rule" draws newborns.**
- *What.* The pool in `pickSample` (l. 92) takes `job === 'child'`, `bday >= 0` and base `age` 0, 4 or 7, and the day only needs `d >= bday`. A baby born in the year has base age 0 and a `bday`, so it enters the pool. 45519 was born on day 264 (`bday` 330) and drawn on day 345. She is 0 on both sides of her "birthday".
- *Measured.* 1,854 of the pool's 6,023 children (31 %) were born in the year.
- *Effect.* Her printed day is her real plan, so her score stands. But this round's sample has no child crossing the 1, 5 or 8 rule.
- *Fix.* Exclude `born >= 0` from the pool, and require `ageOn(pid, d) === age + 1`.

**S8. Minor: labels.**
- "Talking with neighbours in the lane after dark" starts before sunset in 105,526 of 708,530 such segments (14.9 %), by up to 6 min (median 3). The chooser tests `lightEnd()` = sunset + 0.4 h minus the walk, not the dark (44899 at 19:03 against sunset at 19:02; 14165 at 17:17 against 17:20). Say "at dusk", or start the label at `lightEnd`.
- h:1320 is "a kinswoman", then "a friend's house", then "a neighbour's house" within three hours (4676).
- #51 has two 1-min "walk → garrison_sleep" legs while he is already there (detailed sim: the meal and the rest are re-targeted to the same place).
- 11526: "at home: storm" comes at 09:46, four hours into the storm. The fold work around it has no shelter wording or wet or cold dress.

**S9. Checked, not faults.**
- All 20 dates and the day lengths.
- Grinding without baking (#123, 1783): bread is baked every other day (`household_bread`).
- #40 on watch B and #28 on an off day: `guard_rota` A-B-C-off-off.
- Lambing in Shabatu (E-48); threshing in Duzu and Abu (E-43); ploughing in Arahsamnu (E-40); the autumn herd descent in Ululu (E-49).
- 1783 works past noon on a 32 °C day: the E-64 midday rest starts above 33 °C.
- 44899's "the household eats later": the fourth builder is ill at home.
- The sample regenerates byte-identical (md5 `0593835b1360f433d54e2d8ecfacaf15`).
