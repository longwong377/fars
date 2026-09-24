**VERDICT: FAIL.** 3 of 20 people score below 4, each at **3**:
- **#10 Makuš** (guard, leader of ten, 25, day 42) and **#75 Mikrašba** (guard, 21, day 206) each spend a whole day off watch at one garrison hearth, doing nothing but talk, knucklebones and rest, for 12 h and 11 h. #75 does this while his wife of 17 and their 5-month-old son live a short walk away in the town.
- **1888** (a Treasury weigher, 35, day 7) spends his whole working day, 05:52–15:30, "receiving hides". The day's delivery arrives at 09:10: two men carrying 6–17 hides.

After scoring I read the code, and it confirms all three as designed outcomes that the sample reports faithfully. The hide label contradicts the simulation itself: 65 % of the year's "receiving hides" hours fall on days with no delivery, or before the day's hides arrive (S1). The guards' days come from a leisure draw with no other choices (S2). Family visits are drawn by chance, so family men often go 10 days or more without going down to the town (S3). The other 17 people score 4 (10 people) or 5 (7 people). No score changed after scoring.

# Shadow review, Phase 5, round 6, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5), reviewer B of round 6. I did not build the simulation or see it built. I scored from the sample and the research files only. I read no earlier round and no simulation code or data before scoring. I have not read `REVIEWS/shadow_phase5_r6.md` (reviewer A), and I did not look for it.
- **Date:** 2026-09-24. Scores fixed at about 05:05 UTC in the scratchpad file `shadow_r6_B_scores.md`, before any code was opened.
- **Gate (brief §13.11):** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick113.txt` (seed 1, pick seed 113; md5 7800edd7…). I read it from `/home/user/s6-lead` (branch lead-s6, HEAD 551a604) because the file is not in this checkout. After scoring I ran `npx tsx tools/shadow_days.ts 1 113` in /home/user/s6-lead, writing to the scratchpad. The output is **byte-identical** to the sample, so the sample is exactly what the merged simulation produces.
- **Read before scoring:**
  - the sample in full;
  - `research/CALENDAR_AND_UNITS.md` in full. I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 headers agree with it in month, day and Julian date;
  - `research/EVENTS.md`, `PEOPLE.md`, `PLAIN.md` and `SETTLEMENT.md` in full;
  - `PERSEPOLIS_BRIEF.md` §5.5, §9 and §13. The research files and the brief are identical in /home/user/fars and /home/user/s6-lead (checked with `cmp`).
- **Read after scoring:**
  - the heads of rounds 1–5 and 5b, plus a grep of them for the guard hearth, family visits and hides;
  - `tools/shadow_days.ts`;
  - in `src/people/population.ts`: the guard planner (ll. 2060–2121), `terraceWorker` (l. 2476), `treasuryWorker` (ll. 2542–2560), the hide carriers (l. 2680), the traveller (ll. 2918–2944) and the herder child's tasks (l. 3063);
  - in `src/people/sim.ts`: the walking code;
  - `src/data/people_places.json` (guard posts and hearths) and `src/data/lives.json` (`guard_off_day`, `treasury_staff`).
  - I ran read-only scratch scripts from the scratchpad: `walks.ts`, `walks2.ts`, `hides.ts`, `hides2.ts`, `guards.ts`, `guards2.ts`, `moms.ts` and `rain.ts`.
  - I did not read DECISIONS.md, and I modified no project file other than this review.

## Read first: what is broken or placeholder
1. **The treasury "receiving hides" task is not tied to any delivery (S1, blocking).** The label is chosen whenever a slaughter happened today or yesterday. The hides reach the Treasury only on the day after the slaughter, from two carriers, in about 30 min.
2. **Off-watch guards have only the hearth (S2, blocking).** `leisure()` draws only knucklebones, talk, a short turn in the forecourt, or rest. 10.3 % of all guard-days hold an unbroken hearth stretch of 10 h or more. `lives.json` `guard_off_day.water_duty` and `.town_errand` (0.25 each) are read by no code.
3. **Guards with families in the town often go more than a week without seeing them (S3, blocking for #75).** Only 36.6 % of family men's guard-days include a visit.
4. **Most of the day is not drawn.** 11 of the 14 population people spend the whole day in the town or the plain. The detailed agents' town hours are marked "[off the Terrace: not drawn]". For these hours the review can check only the plan. It cannot check the §9.5 promise that what is simulated is what is seen.
5. **The sample tool's own caveats** (`tools/shadow_days.ts` header):
   - each detailed agent is stepped in a fresh simulation that jumps to its day;
   - stores start from the initial stock.
   These made no difference to any day here.
6. **No `[PLACEHOLDER: not performed]` activity appears in the sample.**

## Scores
| # | person | role, age, origin | day (Babylonian; Julian; weather) | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #10 Makuš | guard, leader of ten, m 25, Persian | 42 (Aiaru 13; 28 May; 14–32 °C) | **3** | A day off before the night watch: 12 h (06:14–18:36) at one hearth, cycling talk, knucklebones and rest. |
| 2 | #46 Akšimašra | guard, m 43, Persian | 22 (Nisanu 22; 8 May; 10–28 °C) | **4** | A sound 06–14 watch with a meal relief. Then 6 h at the hearth; his family of six in the town is not visited. |
| 3 | #75 Mikrašba | guard, m 21, Median | 206 (Tashritu 29; 8 Nov; 4–20 °C) | **3** | 11 h off watch at the hearth; his wife of 17 and 5-month-old son are in the town and never seen. |
| 4 | #100 Kamiya | foreman, m 35, Elamite | 71 (Simanu 12; 26 Jun; 16–35 °C, dust) | **4** | A good summer half-day and a sleep through the heat. The "overseeing" shuttle is mechanical, and a foreman carries chisels. |
| 5 | #109 Belšun | mason, m 27, Babylonian | 299 (Shabatu 4; 9 Feb 466; −2–11 °C, dust) | **5** | A winter work day in full order. |
| 6 | #111 Hupannana | mason, m 45, Elamite | 270 (Tebetu 4; 11 Jan 466; −3–10 °C) | **4** | His half of the gang is off: mending, the lane, the meal kept for him. About 6 h of plain rest. |
| 7 | 383 | stone builder, m 43, Cappadocian | 177 (Ululu 29; 10 Oct; 8–27 °C) | **5** | A capital-carving day; right hours, walk and meals. |
| 8 | 1888 | treasury weigher, m 35, Ionian | 7 (Nisanu 7; 23 Apr; 8–25 °C) | **3** | The whole working day is "receiving hides" (a delivery of 6–17 hides). |
| 9 | 45426 Kuraaza | girl, 1 month, Persian | 108 (Duzu 19; 2 Aug; 21–39 °C) | **5** | With the mother all day: 9 feeds, about 17 h of sleep. |
| 10 | 5895 Damakil | servant, m 46, sick | 43 (Aiaru 14; 29 May; 14–33 °C) | **5** | A sick day at home: food brought, a visit from kin. |
| 11 | 6917 Ratukka | girl, 4 months, Babylonian | 94 (Duzu 5; 19 Jul; 19–37 °C) | **4** | A good day with the mother. One 4.5 h waking stretch, about 12 h of sleep. |
| 12 | 38807 Butizza | farmer, m 51, Persian | 324 (Shabatu 29; 6 Mar 466; rain 12.4 mm) | **4** | Indoors through the rain with the animals and mending; a strict alternation. |
| 13 | 34914 Bazzikka | girl, 8 (today), Persian | 252 (Kislimu 16; 24 Dec; −3–11 °C) | **5** | Fuel, water, an errand to trade barley for oil, play, meals. |
| 14 | 45124 | boy, 1 month, Ionian | 173 (Ululu 25; 6 Oct; 12–31 °C) | **4** | With the mother at the mill and the workshop. No feed for 4 h 46 by day. |
| 15 | 44149 Bakabana | herder boy, 8 | 170 (Ululu 22; 3 Oct; 12–31 °C) | **4** | Water, the young animals, brush, play, a sleep in the heat. Repetitive; "lambs" in October. |
| 16 | 43615 Kašunda | traveller, m 51 | 265 (Kislimu 29; 6 Jan 466; −4–9 °C) | **4** | A rest day at the station: rations, mending, a little trade, knucklebones. |
| 17 | 31197 Appiyama | farmer, m 20 | 99 (Duzu 10; 24 Jul; 20–38 °C) | **5** | Threshing at dawn, a sleep for the vigil, then the night by the grain heap. |
| 18 | 11523 Naputurriš | boy, 1 month, Elamite | 22 (Nisanu 22; 8 May; 10–28 °C) | **4** | With the mother: 10 feeds, a visit. She is at work from 03:24, nearly 2 h before sunrise. |
| 19 | 43763 Bakabadada | traveller, m 36, from Bactria | 328 (Addaru 3; 10 Mar 466; 1–16 °C) | **4** | Arrives, shows the halmi, unloads, eats, sleeps. The animals are unloaded only after the queue. |
| 20 | 29211 Rapsaka | homemaker, f 46 | 295 (Tebetu 29; 5 Feb 466; −1–13 °C) | **5** | Bread, quern, a visit, water, spinning, weaving, the fire for the cold night. |

Totals: 3 × 3, 10 × 4, 7 × 5 (mean 4.15).

## Notes, person by person (as written before reading code; checked after scoring)

**#10 Makuš (3).** He wakes at 05:12 and eats. From 06:14 to 18:36 he never leaves `garrison_hearth_m`:
- talk 06:14, knucklebones 07:51–10:28, talk, knucklebones, bread 12:09, knucklebones, talk, knucklebones 14:06–18:36;
- that is 4 h 30 min unbroken in a 32 °C afternoon, and about 7.5 h of knucklebones in the day.

He does nothing with kit, water or rations, and runs no errand. He has no family, and the planner's 60 % chance of a walk to the town or the river did not come (S2). The night is good:
- a meal, a 2-hour nap, readying, the change of watch;
- a round of nine posts at 22:12–22:53, rest by the fire, a second round at 23:54.

Before scoring I suspected that some round legs were too fast (post_apa_e → hearth in "1 min"). After scoring I traced the walk in the simulation: 157 m in 118 s at 1.33 m/s. The 1-minute gap is the log's minute truncation, so it is not a fault (S10). §9.1 allows "gamble and idle", but not a 12-hour loop at one spot. Score 3.

**#46 Akšimašra (4).** The watch is good:
- breakfast at 04:59, at the gate post 06:03–14:01;
- relieved for bread 08:41–09:04 (the patrol man stands in);
- a meal after the watch.

The gate legs (2–3 min) trace at 245–256 m in 174–182 s, 1.41 m/s, which is fine. Then 14:37–20:21 at the hearth (3 h 48 of talk, rest, meal) and bed in the quarters. His wife, a 17-year-old son and children of 13, 4 and 9 months live at h:46 in the town and are not visited. The A-watch visit chance is 0.25 (population.ts:2114), so this is chance. Minor.

**#75 Mikrašba (3).** He is off watch from 06:57 to 22:00. Up to 17:47 he is only at the hearth (talk, rest, knucklebones, two meals), then naps 17:47–21:27 and takes the night post at post_tachara_1 (273 m in 210 s, fine). His household is his wife of 17 and a son of 5 months at h:75 in the town. On a free day of 11 waking hours a 21-year-old husband and new father never goes to them.

After scoring: the C-watch visit chance is 0.35 (l. 2112), and he does go down on days 207 and 208 ("with his wife and the baby"). Before that he goes 16 days with no step into the town at some point in the year (S3). The sample is faithful, so the score stays.

**#100 Kamiya (4).** Out at 04:52, on the site 05:28–12:00 with his face wrapped against the dust (W-03), bread at the site, home at 12:38, asleep 13:47–17:02 (E-64, Tmax 35), the evening with his wife and three children. Weak points:
- 6 h of "overseeing the squad" hopping between three spots in 10–30 min pieces;
- the foreman who marks out with cord and straightedge is shown "carrying his chisels and mallet".

**#109 Belšun (5).** A winter day in which his half of the gang works (E-62):
- stone dressing on a frost day, with no mortar;
- 32 + 10 min to the site; fluting a raised shaft 07:07–15:31 with two short words with the gang and the camp meal;
- home, the evening meal before sunset, bed at 19:30 in a house of ten builders.

**#111 Hupannana (4).** His half of the gang is off:
- waits for the new bread, then breakfast with the household;
- mends tools and baskets for 2 h, spends 80 min with neighbours in the lane;
- the evening meal "kept for the late-comer", which is a good touch.

About 6 h of plain rest, and no fuel, water or store errand. Thin but coherent.

**383 (5).** Up 05:17, bread, a 32-min walk at dawn, carving a double-bull capital 06:27–15:30 with the camp meal, home, the evening meal, bed at 19:16. The times are template-regular, as a plan's are.

**1888 (3).** The frame is right: the walk, work, the midday meal, home, the evening with the household. But 05:52–12:00 and 12:28–15:30 are both "receiving hides at the treasury store {CE-07}". E-12 and PF 58–60 give consignments of 6, 9 and 17 head, 2–4 a month. That is an hour's work, and not a weigher's.

After scoring:
- the day's hides are carried in by two men (pids 3729 and 3733), who reach the store at 09:10 and 09:13 and stay 30 min;
- 1888 is "receiving hides" from 05:52, more than 3 h before they arrive;
- the morning and afternoon tasks are drawn separately, and here both came up "receive" (p = 0.15 each);
- on that day, 103 person-hours of Treasury staff are labelled "receiving hides" (S1).

The label contradicts the simulation, so the score stays at 3.

**45426 Kuraaza (5).** Always with the mother, who is "off work after the birth" in her plan:
- 9 feeds and about 17 h of sleep, indoors through the midday heat;
- carried on the back to the lane twice while the mother spins and trades.

**5895 Damakil (5).** Food brought three times, visited by kin for 36 min, lying ill otherwise (E-72, CE-15). "Lying ill" through the night rather than "sleep" is a label detail only.

**6917 Ratukka (4).** With the mother to the canal (washing) and the well, on a mat while she grinds, 10 feeds. One waking stretch, 07:26–11:54, is long for 4 months, and the day's sleep (about 12 h) is at the low end. The mother fetches water at 14:57 in 37 °C heat.

**38807 Butizza (4).** After scoring I checked the weather: rain 05:15–13:45 with a storm 05:45–13:30, which the sample's header does not show (S8). Staying in is right. He sees to the animals (it is the lambing season, E-48), feeds stored straw, mends, eats with the household of eight, and goes to bed at 19:05. Weak: a strict tend / craft / tend / craft cycle, and no step outside in the dry afternoon.

**34914 Bazzikka (5).** She carries dung cakes, waits for the bread, and gathers fuel for 82 min. She plays in the lane, trades a measure of barley for oil with a neighbour, and fetches water in a small jar. The chores fit her eighth birthday today, and she is in bed at 18:12.

**45124 (4).** With the mother (treasury textile worker, 43) to the well, the mill (the group's turn, 2.5 h) and the workshop, on a mat beside her. There is no feed between 13:46 and 18:32: 4 h 46 min by day for a 1-month-old. The mother's plan confirms it (S4). Also a 3-min stop at ws:2 before the mill.

**44149 Bakabana (4).** The band is camped in the autumn passage (E-49): the men mend gear and see to the donkeys' sores. The boy fetches water from the stream three times, is "with the lambs and the kids by the fold" three times, gathers brush twice, plays, and sleeps through the heat. The day is repetitive, and the lamb label is not seasonal (S6).

**43615 Kašunda (4).** A rest day at the station:
- breakfast with the party, then a 2-h queue at the town store for the party's rations (E-21), carried back;
- mending harness, a little trade in q_pw_n, knucklebones twice, meals, bed.

The ration draw rotates through the party (l. 2931), so he is not the only carrier. The day has some filler.

**31197 Appiyama (5).**
- Threshing 05:33–10:30 (E-43, day 99), with bread carried out at dawn.
- Home for the meal, then a long sleep "because tonight he keeps watch by the grain heap".
- The evening meal with his wife of 16, out at 19:16, sits up and then sleeps by the heap.
- Minor: no winnowing in the afternoon wind.

**11523 Naputurriš (4).** With the mother: 10 feeds, a visit to Ramuka's house (h:3096) on her back. Her plan has kneading at 03:24 and baking 03:45–04:29, nearly 2 h before sunrise (05:19) (S5).

**43763 Bakabadada (4).** Off the map until 13:51, then 2 h on the arrival road, the station, the halmi and rations, unloading and watering the animals, a meal, bed at 18:24. The animals wait out a 36-min queue (S7).

**29211 Rapsaka (5).** The fullest day in the sample:
- kneads and bakes before sunrise, grinds, eats the new bread;
- visits Ukrakka for 2 h, draws the house's water;
- spins and weaves, grinds for tomorrow;
- lights the fire "for the evening meal and the cold night", eats with the household, talks, goes to bed.

## Score changes after scoring
**None.** The sample regenerates byte-identically, and every point I checked in the code agrees with the sample. The two walking-time doubts I recorded before scoring were not counted in any score, and the trace clears them (S10).

**Calibration, for the record.** After scoring I read that rounds 3 and 4 gave similar guard hearth days 4 and 5 (r3 #70, r4 #52). I score a 12-hour, one-place, three-activity loop at 3, because of the protocol's "repetitive mechanical routines" and brief §9.5 ("no placeholder 'working' loop"; "people run errands, visit…"). A reviewer who reads §9.1's "gamble and idle" more generously could give #10 a 4. The verdict does not rest on the guards alone: 1888's label contradicts the simulation (S1).

## Findings
**S1 (blocking: 1888). "Receiving hides" is drawn with no delivery behind it.**
- `treasuryWorker` (population.ts:2546) labels the `receive` task "receiving hides at the treasury store (CE-07)" when there was a slaughter today or yesterday.
- The hides reach the store only on the day after the slaughter, carried by the two `sub: 'hides'` shepherds in about 30 min (l. 2680).
- The afternoon task is redrawn from the same weights, so a person can "receive" all day (`terraceWorker`, l. 2484).

Year, seed 1:
- 37 slaughters and 37 delivery days;
- 5,943 person-hours labelled "receiving hides"; 2,781 of them (47 %) on days with **no** delivery, and 1,081 (18 %) before the day's hides arrive;
- 517 Treasury staff days are "receiving hides" for the whole working day.

On 1888's day (day 7), 103 person-hours of Treasury staff "receive" a load that two men deliver at 09:10–09:40. 1888 starts receiving at 05:52.

**S2 (blocking: #10, #75). An off-watch guard's free time is a hearth loop.**
- `leisure()` (ll. 2065–2068) chooses among knucklebones (0.35), talk (0.35), 0.6 h in the forecourt (0.1, 07–18 only) and rest.
- The alternatives are a family visit (S3) or, for single men, a town or river trip at visit chance + 0.25 (l. 2091). Both are all-or-nothing draws.
- `lives.json` `guard_off_day` lists `water_duty: 0.25` and `town_errand: 0.25`. `grep` finds no code that reads either.

Year, seed 1, 34,887 guard-days:
- the longest unbroken hearth stretch (sleep excluded) has median 5.3 h, p90 10.1 h and max 15.6 h;
- 19.4 % of guard-days have a stretch of ≥ 8 h, and 10.3 % of ≥ 10 h.

Evidence in the sample:
- #10: 06:14–18:36 at the hearth;
- #75: 06:57–17:47 at the hearth.

**S3 (blocking: #75; minor for #46). Guards with families in the town rarely see them.**
- Visit chances are 0.25 on an A-watch day (l. 2114), 0.3 on a B-watch day (l. 2118), 0.35 on a C-watch day (l. 2112), 0.5 after a night watch and 0.7 on a whole day off.
- Of 23,510 family men's guard-days, 8,602 (36.6 %) include a visit.
- Per family guard, the longest run of days with no step into the town has median 10 days, p90 14, max 26. #75 (pid 229): 16. #46 (pid 137): 11.
- In the sample, #75 stays at the hearth for 11 h while his wife of 17 and 5-month-old son are at h:75, and #46 for 6 h while his family of six is at h:46.

**S4 (minor: 45124). No limit on the time between a newborn's feeds by day.** Mother 1573 nurses at 13:29 and then at 18:32. Between them come weaving, grinding, kneading, baking, cooking and a meal: 4 h 46 min for a 1-month-old. Only 8 feeds in the day.

**S5 (minor: 11523). Pre-dawn baking in the dark.** Mother 11518: knead at 03:24, bake 03:45–04:29, sunrise at 05:19. There is no light source, and the plan gives no reason. Round 3 saw 03:27 in another household.

**S6 (minor: 44149). The herder child's "lambs and kids by the fold" task is not seasonal** (l. 3063). Lambing is months 10–12 (E-48), so on 3 October this year's young are half-grown.

**S7 (minor: 43763). On arrival the party queues for rations before unloading and watering the animals** (l. 2918: queue, then tend_animals).

**S8 (minor: sample tool). The day header omits storms.** For 38807, `wx.storm` covers 05:45–13:30, but `dayLine` prints only rain, snow and dust. A reviewer cannot see a storm day.

**S9 (minor: #100). Label: a foreman marking out with cord and straightedge is "carrying his chisels and mallet".**

**S10 (checked; not a fault). Walking times.**
- #10's round: every leg traced at 1.31–1.34 m/s, for example post_apa_e → hearth, 157 m in 118 s, and tachara_1 → apa_w, 270 m in 202 s.
- #46's gate legs: 245–256 m in 174–182 s at 1.41 m/s.
- #75: 273 m in 210 s.
- The 1-minute gaps in the log are the minute truncation of `hm()`.

**Minimum before a re-review (my view):**
1. Tie the receive task to the day's actual hide delivery and its hour.
2. Give off-watch guards real alternatives within the day: the unused `water_duty` and `town_errand`, kit, rations.
3. Make family men's visits depend on the days since their last visit, not only on a per-day chance.

## What I checked
| check | how | result |
|---|---|---|
| Calendar: day → month and Julian date for all 20 headers | my table from CALENDAR_AND_UNITS (month starts and lengths) | all 20 agree |
| Sample = simulation | regenerated `tools/shadow_days.ts 1 113` in s6-lead → scratchpad; `diff` | byte-identical |
| Research files and brief the same in both checkouts | `cmp` | identical |
| Guard walking speeds | `walks.ts` (2-s steps) and `walks2.ts` (the tool's minute steps) on #10, #46 and #75 | 1.30–1.41 m/s over real nav paths; no teleport (S10) |
| Guard post and hearth positions | `people_places.json` | hearth_m (201.5, 26.6); gate_w1 (−18.8, 120.4); apa_e (45.8, 60.5) |
| Hide deliveries and "receiving hides" labels, day 7 and the year | `hides.ts` and `hides2.ts` over `P.plan` for all Treasury staff and hide carriers | S1 numbers |
| Guard hearth stretches and family visits, the year | `guards.ts` and `guards2.ts` over `P.plan` for all 100 guards | S2 and S3 numbers |
| Guard planner rules | population.ts ll. 2060–2121; lives.json `guard_off_day`, `guard_family_share` | visit chances as in S3; `water_duty` and `town_errand` unused |
| Mothers' plans behind the three babies | `moms.ts`: 11518, 11519, 1573, 6915, 6901 | S4 and S5; 6901 is "off work after the birth" |
| Herder band's adults on day 170 | `moms.ts`: 44126 | a camp day of mending and animal care; consistent |
| Traveller ration draw | population.ts ll. 2930–2944 | rotates through the party; not a lone carrier |
| Rain and storm on 38807's day | `rain.ts` | rain 05:15–13:45, storm 05:45–13:30; not in the header (S8) |
| Heat rule (#100, 31197) | EVENTS E-64; the sample | Tmax 35 and 38 °C: midday stop and sleep, as the rule says |
| Winter halves (E-62) (#109, #111) | EVENTS E-62; the sample | one half works (#109), one half at home (#111) |
| Threshing window (31197) | EVENTS E-43, days 43–141 | day 99, in the window |
| Transhumance (44149) | EVENTS E-49 | month 6, autumn passage |
