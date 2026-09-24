**VERDICT: FAIL.** 2 of 20 people score below 4, each at **3**:
- **#114 Akšer** (Terrace porter, 21, day 151, Ululu 3). On his group's ration day he stands at the stair foot from 06:04 to 10:05, which is 2 h 42 min "waiting for the ration issue" before it opens and 1 h 12 min in the queue. The sacks he carries lie at that same stair foot. On a 36 °C heat day that leaves him 1 h 56 min of carrying before he goes home at noon.
- **42388 Irtam** (farmer, 19, day 185, Tashritu 8). He spends 07:39–09:04 "plastering the roof with mud and straw before the rains" in a storm (07:15–11:45) and in rain (07:45–11:15). The day is the first rain of the autumn.

After scoring, the code showed that both are year-wide planner rules, not tool faults (S1, S2). The sample represents the simulation faithfully, and no score changed. The other 18 people score 4 (9 people) or 5 (9 people).

# Shadow review, Phase 5, round 7, reviewer A (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. Before scoring I read no earlier round, no simulation code or data and no `DECISIONS.md`.
- **Date:** 2026-09-24
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick131.txt` (seed 1, pick seed 131; 553 lines). No earlier reviewer had seen it. The lead says it is byte-identical to the current tree's `tools/shadow_days.ts` output. It holds:
  - 6 detailed Terrace agents: a leader of ten (#30), two guards (#8, #66), a porter (#114), a courier (#131) and a foreman (#100);
  - 14 people of the population:
    - 2 Terrace workers (2668, 44977);
    - 3 townspeople (5936, 3003, 2036);
    - the six conditioned cases: a man in the open on a rain day (42388), a child past an age-rule birthday (17959), a baby under four months (46220), a herder (44293), a traveller (43314) and a grain-heap vigil (12597);
    - 3 drawn from everyone (39196, 44627, 28957).
- **Read before scoring:**
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 printed Babylonian and Julian dates agree with it. Three examples: day 325 = Shabatu 30 = 7 Mar 466; day 151 = Ululu 3 = 14 Sep 467; day 254 = Kislimu 18 = 26 Dec 467.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - Greps of `research/OPEN_QUESTIONS.md`. They covered the ration queue, the issue day, the roof, days off, the watch, transhumance, couriers, nursing and storms, and returned Q-034, Q-037, Q-041, Q-057, Q-060, Q-061, Q-128, Q-147, Q-223, Q-224, Q-299 and Q-337.
  - The 20 scores, each with a paragraph, were then saved to `shadow_r7_A_scores.md` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5_r3.md`, the style reference: its head, scores and the headings of its findings.
  - The verdicts and finding headings of `_r4.md`, `_r5.md`, `_r5_b.md`, `_r6.md` and `_r6_b.md`.
  - `_r6.md`'s notes on the rain day (38807), the baby (45124) and the vigil (31197).
  - A grep of all rounds for the roof, the queue and the ration issue.
  - `tools/shadow_days.ts`, in full.
  - From `src/people/population.ts`:
    - `rationRun` (ll. 1636–1646);
    - `farmChore` (ll. 905–910);
    - the men's and women's home hours (`homeHours`, ll. 1150–1200);
    - the builder's day and `endOfWork` (ll. 2255–2297);
    - `campWoman` (ll. 2298–2310);
    - `terraceWorker` (ll. 2596–2615).
  - From `src/people/calendar.ts`: the E-01 issue hour (ll. 217–221) and the `heatRest` flag (l. 210).
  - From `src/people/sim.ts`: the porter's load rule (ll. 331–332).
  - From `src/data/lives.json`: `work_day`, `home_hours.farm_chores`, `infant_care` (the feeds), `guard_off_day` and `guard_family_share`.
  - Read-only scratch scripts q1–q4 in the session scratchpad, outside the repo. Each imports `freshSim` from `tools/shadow_days.ts`. See "What I checked".
  - I did not read `DECISIONS.md`.
- **Score changes after reading the earlier rounds or the code:** none.
  - One note is corrected. For 46220 I had read Q-061's "2-3 by night" as hours between feeds. `lives.json infant_care.night_feeds` [2, 3] is a count of feeds per night, and the baby's two night feeds meet it. The score stays 4: a gap of 4 h 51 min is still long for a newborn (S4).
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails: 2 of 20 below 4.**
   - **#114 (3):** the ration day empties a porter's working morning (S2).
   - **42388 (3):** roof plastering in a storm on the day of the first rain (S1).
2. **Both are year-wide rules, not chance draws.**
   - **Roof chore in the rain (S1).** The `chore` weight in `homeHours` has no wet or storm check. On the only two wet days of months 6–7 (days 185 and 202), 6,692 person-days of roof plastering overlap rain or storm, for **16,285 h**. The longest single overlap is 5 h 40 min (pid 7073, day 185).
   - **Ration-day wait (S2).** Every Terrace worker whose group draws its ration waits at the stair foot from the start of work until the issue hour (07:00–10:00), and does no work in that time. Over the year that is **9,083 person-days, with a mean wait of 1.98 h and a maximum of 5.40 h**. In the town the mean pre-issue wait is 1.06 h (19,572 person-days).
3. **No placeholders in this sample.** No line carries `[PLACEHOLDER: not performed]`.
4. **Tool.** The detailed day of #114 matches his plan, except where the sim turns `rest @ stair_foot — waiting at the depot for loads` into real sack carries while the depot holds stock (sim.ts l. 331). That is intended. The storm span now prints in the header, which fixes r6 S6 / r6_b S8. **I found no tool fault.**
5. **Non-blocking weaknesses:**
   - A married guard does not go down to his family, and his son of 4 is ill (S3).
   - A 4 h 55 min unrelieved post stint in 38 °C dust (S3).
   - A newborn's 4 h 51 min night gap (S4).
   - A whole winter day's field work dropped for afternoon rain (S5).
   - Pre-dawn flock counting (S6).
   - Labels (S7).

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #30 Tamšakama | guard, leader of ten, m 23, Persian | 325 (Shabatu 30, 7 Mar 466; 3–19 °C) | **5** | Before a C watch: a town errand, his file at the bow and spear, two sleeps, the change of watch, rounds at the design's interval. |
| 2 | #8 Karašna | guard, m 30, Persian | 66 (Simanu 7, 21 Jun; 19–38 °C, dust) | **4** | A coherent A watch, but 4 h 55 min at the post in the dusty heat with no drink, and no visit to his family (son of 4 ill) in 4.8 h of free daylight. |
| 3 | #66 Appirmarša | guard, m 36, Persian | 239 (Kislimu 3, 11 Dec; −3–10 °C) | **5** | Off day: nearly 8 h with his wife and three children in the town, back up before sunset, early bed. |
| 4 | #114 Akšer | porter, m 21, Elamite | 151 (Ululu 3, 14 Sep; 16–36 °C) | **3** | 3 h 54 min idle at his own stair foot for a ration issue that opens at 08:52. Then 1 h 56 min of carrying before home at noon. |
| 5 | #131 Kamša | courier, m 23, Persian | 85 (Simanu 26, 10 Jul; 21–40 °C) | **4** | Not his day at the station: at home, lane, meals, "mending tools and baskets". Plausible, but a generic man's day with nothing of a rider. |
| 6 | #100 Kamiya | foreman, m 35, Elamite | 217 (Arahsamnu 10, 19 Nov; 5–21 °C) | **5** | Cord and straightedge between column 40, door N1 and the capital, dawn to 15:30, the camp's bread, knucklebones after supper. |
| 7 | 2668 Tappukka | treasury storekeeper, f 35, Elamite | 142 (Abu 24, 5 Sep; 21–41 °C) | **4** | Quern before dawn, store work to noon, home out of 41 °C, bread, water and supper. The "storekeeper" spends 5 of 6 hours stacking sacks. |
| 8 | 44977 | builder (Lycian kurtaš), m 33 | 316 (Shabatu 21, 26 Feb 466; 1–15 °C) | **4** | Stood down in the winter half: water, washing at the canal, knucklebones, household. Thin but not wrong. |
| 9 | 5936 Akšer | gardener, m 33, Elamite | 156 (Ululu 8, 19 Sep; 16–36 °C) | **5** | Picking figs 06:06–12:00 (E-46), meal in the shade, home out of the heat, lane, a visit, bed. |
| 10 | 3003 Ratukka | girl, 4, Persian | 275 (Tebetu 9, 16 Jan 466; −0–13 °C) | **5** | With her mother at home, in the lane and at the well, a midday sleep, 75 min at a neighbour's with their children, bed at 17:39. |
| 11 | 2036 Kunsun | treasury handler, f 46, Syrian | 94 (Duzu 5, 19 Jul; 19–37 °C) | **4** | Quern, well, the monthly ration (3 h 42 min at the store, 1 h 56 min of it before the issue opens), workshop to 15:00, spinning, supper. |
| 12 | 42388 Irtam | farmer, m 19, Persian | 185 (Tashritu 8, 18 Oct; storm 07:15–11:45, rain 07:45–11:15) | **3** | On the roof plastering mud "before the rains" for 85 min in the storm and rain. The storm is first seen at 10:47. |
| 13 | 17959 Suzza | girl, 5, Persian (plain) | 317 (Shabatu 22, 27 Feb 466; 2–16 °C) | **5** | Courtyard, lane and canal play, three meals, a rest, bed at 18:56. |
| 14 | 46220 Badura | boy, 0 months (plain) | 328 (Addaru 3, 10 Mar 466; 1–16 °C) | **4** | 10 feeds, asleep beside, in the lap or on a mat by the mother. But 4 h 51 min between the 01:35 and 06:26 feeds. |
| 15 | 44293 Abbatema | herder, m 20 (band of 35) | 181 (Tashritu 4, 14 Oct; 9–28 °C) | **4** | Fold, water, the flock moved on 06:18–11:56 (E-49), off the map at 12:17. But he counts the flock at 05:08, 62 min before sunrise. |
| 16 | 43314 Kartukka | traveller, m 40 (party of 16) | 70 (Simanu 11, 25 Jun; 17–36 °C) | **4** | A layover at the station: town, mending harness and sandals, a heat sleep, knucklebones. "On the day's business" turns out to be sightseeing. |
| 17 | 12597 Birtanda | farmer, m 28 (plain) | 103 (Duzu 14, 28 Jul; 20–39 °C) | **5** | Threshing 05:32–10:30 (E-43), bread at the floor, a long sleep "tonight he keeps watch", out to the grain heap at 18:52. |
| 18 | 39196 Barrumatra | boy, 15 months (plain) | 254 (Kislimu 18, 26 Dec; −4–10 °C) | **5** | With the mother at home, in the lane and at the well; nursed and fed at meals; two naps; bed at 17:07. |
| 19 | 44627 Kambatiš | herder boy, 6 (band of 32) | 328 (Addaru 3, 10 Mar 466; 1–16 °C) | **5** | The band comes down into the plain with loaded donkeys (E-49). He plays by the new tents, eats by the fire and sleeps. |
| 20 | 28957 Barnizza | farmer, m 16 (plain) | 242 (Kislimu 6, 14 Dec; rain 15:00–23:00) | **4** | Barley exchanged in the lane, plough and yoke mended, meals. The dry morning in the sowing window goes unused (S5). |

Distribution: 5 → 9 people; 4 → 9; 3 → 2. **2 of 20 are below 4.** For comparison: round 6 had 1 below 4 (reviewer A) and 3 (reviewer B).

## Notes

### #114 Akšer: porter, ration day (score 3)
Sunrise 05:42, sunset 18:17. Tmax 36 °C, so the E-64 heat rule applies and Terrace work ends at noon (`lives.json work_day.heat_end_h` 12).
- **Fine:**
  - Bread before leaving at 05:37 ("the household eats later").
  - Nine loads from the stair foot to the Treasury store, each about 6 min each way.
  - Bread at the stair foot at 11:41.
  - The ration carried home at 12:01. After that: rest, mending, the lane, supper with his wife and son, and bed at 19:35.
- **The wait:**
  - `06:11 queue @ stair_foot — waiting for the ration issue` until `08:53 … in the ration queue`, then until 10:05.
  - That is 3 h 54 min standing at his own work place in the cool of a 36 °C day.
  - The porter's sacks are at the same stair foot (from 10:05 he carries from there).
  - E-01 has the group's head receive for the group. Even with individual queues (C), a porter would carry until his group is called, not stand idle for 2 h 42 min before the issue opens.
  - His working day comes to 1 h 56 min.
- **After scoring (q1):**
  - The issue hour for group 8 is 8.87 h (calendar.ts l. 220: `7 + 3·u`).
  - The plan is `06:03–08:52 queue — waiting for the ration issue`, `08:52–10:04 queue — in the ration queue`, then `10:04–11:33 rest @ stair_foot — waiting at the depot for loads`. The detailed sim turns the last into carries (sim.ts l. 331).
  - The sample is faithful. The cause is the planner (S2).

### 42388 Irtam: farmer, the first rain (score 3)
Sunrise 06:14, sunset 17:45. Storm 07:15–11:45, rain 07:45–11:15 (1.0 mm).
- **Fine:**
  - He does not go to the fields (W-01, W-02; Q-299).
  - Mending tools indoors, meals with the household, the new bread, bed at 19:31.
- **The roof:**
  - `07:39–09:04 craft — plastering the roof with mud and straw before the rains`. That is on the roof, in a thunderstorm, while it rains.
  - W-02 says "all outdoor work stops". Wet mud plaster is washed off by rain.
  - The storm first appears at `10:47–12:07 rest — at home: storm`.
  - `15:38–17:11` he plasters the roof "before the rains" again, after the rains have come.
- **After scoring (q1–q3):**
  - The father 42386 is `tend_animals` 07:39–09:11 (animals at the house, acceptable) and then `rest — at home: storm`. He too plasters the roof at 14:43.
  - Day 185 is the first rain of the year (`ctx.firstRain` true).
  - Cause: S1.

### #8 Karašna: guard, A watch in dust and heat (score 4)
Sunrise 04:57, sunset 19:02.
- **Fine:**
  - Breakfast at 05:11, on post at 06:04, relieved 08:39–09:03 for bread.
  - From 09:03, "the face wrapped against the dust" (the dust starts at 10:45, so this is early but harmless).
  - Relieved at 14:01, a meal, a 40-min sleep, kit (spear shaft oiled, the shield's rim sewn), talk and rest.
  - Supper at 19:06, bed at 21:01.
- **Gaps:**
  - 09:06–14:01 is 4 h 55 min at the post through the hottest, dustiest hours, with no drink or relief shown. His only relief came at 08:33, in the cool.
  - His wife, his son of 4 ("ill today") and a baby live in q_lt_e. He has 4 h 49 min of free daylight after the watch and stays at the hearth.
  - After scoring: `guard_off_day.family_visit` is 0.7 per day. The draw does not look at a member's illness (S3).

### #131 Kamša: courier, at home (score 4)
- Plausible under E-20 (court absent: 0.3–1 couriers a day, so a courier has many days off).
- His home hours are the generic man's: `mending tools and baskets` twice, 12:25–13:54 and 16:37–17:47.
- Nothing of a rider appears: harness, sandals, the station's horses. The traveller 43314 in this sample does mend "harness, bags and sandals".

### 2668 Tappukka: treasury storekeeper (score 4)
- A full, coherent day:
  - quern 04:06–04:37;
  - on the Terrace 05:55–12:00, home out of 41 °C;
  - grind, sleep 12:43–16:02;
  - the well, knead, bake, cook, supper, bed.
- The role and the work disagree. A "storekeeper" spends 5 h stacking the porters' sacks, and only 50 min "going over the store: the seals". A store hand, or more time on the seals, would fit the role.

### 44977: Lycian builder, the winter half (score 4)
- Stood down under E-62 (× 0.5; Q-057) on a dry 1–15 °C day.
- Water twice, his clothes washed at the canal 07:36–09:04, knucklebones, 2 h with the household, 2 h 44 min of rest after the meal, the lane.
- `16:51 eat — the evening meal, kept for the late-comer` reads correctly: he was in the lane until 16:48.
- Plausible but thin.

### 2036 Kunsun: treasury handler, ration day (score 4)
- Quern 04:12, water 04:53, breakfast.
- At the town store 06:57–10:39: 1 h 56 min before the issue opens (8.88 h, q1), then 1 h 46 min in the queue.
- Workshop 10:42–15:00, the ration home at 15:00, grinding, spinning with the women, supper, bed.
- The day holds together. Unlike #114, her work begins after the issue, so it is shortened, not lost.
- Minor: she does not look in on her ill husband at midday.
- Same mechanism as S2 (town branch).

### 46220 Badura: newborn (score 4)
- 10 feeds in 24 h, within the usual 8–12.
- Sleeps where the mother is: beside her, in her lap, on a mat while she works. This matches Q-224.
- Night feeds at 22:16 and 01:35, then nothing until 06:26: 4 h 51 min for a 0-month infant.
- After scoring: `infant_care.night_feeds` [2, 3] is a count, and it is met. The gap between feeds at night is not limited (S4).

### 44293 Abbatema: herder, leaving the plain (score 4)
- Fold, bread and curds, water, the flock moved on with the dogs 06:18–11:56, the midday meal, then off the map with the band (E-49, months 6–7; Q-223).
- `05:08 tend_animals — letting the flock out of the fold and counting it` is 62 min before sunrise, before civil dawn. The home-hours code itself bars work that needs light before sunrise − 0.45 h (population.ts l. 1175) (S6).
- "Toward the hills" in autumn is ambiguous against E-49's "south in autumn". I did not count it against him.

### 43314 Kartukka: traveller, a layover (score 4)
- A day at the station (Q-128, `travellers_stay` 1–5 days): the lower town, mending harness and sandals, a heat sleep, knucklebones, supper, knucklebones by the fire.
- `05:47 walk — on the day's business` is followed by `06:15 talk @ lane:q_lt_e — seeing the lower town`. There is no business (S7).

### 28957 Barnizza: farmer, rain in the afternoon (score 4)
- Barley to the lane to exchange, plough and yoke mended, meals, rest, bed.
- Plausible for December. But Kislimu is in E-40's window ("daily in the window, on dry days"), the rain starts only at 15:00, and a household of four men sows nothing.
- After scoring (q4): the day's `agri` set is empty because the day is wet. The father and both brothers also stay home, feeding straw and exchanging barley in the lane (S5).

### The nine 5s, in one line each
- **#30:** the design's C watch day. Rounds 22:12–22:50 and from 23:43 (Q-147: every 0.6–1.3 h at night, 25–45 min each), cold dress at night, and two sleeps before the watch.
- **#66:** Q-337's family visit on an off day, with the climb back before sunset.
- **#100:** E-60's hours, and the foreman's cord and straightedge (r6_b S9 fixed).
- **5936:** figs in Ululu (E-46), the E-64 heat respected, an evening visit.
- **3003:** a small child's day beside her mother, with a neighbour's children and a nap.
- **17959:** a village girl of 5 at play all day, with the cold respected in the morning.
- **12597:** threshing in E-43's window, the carried bread eaten at the floor, and the vigil (r4 S2 fixed: he sleeps by the heap).
- **39196:** a toddler nursed and fed at meals (r5_b S2 fixed), carried to the lane and the well.
- **44627:** the band's arrival, with the family's donkeys and play by the new tents (Q-223).

## Findings

**S1. A farming man's roof chore runs in the rain and the storm.** Severity: **blocking** (42388).
- **Evidence:** 42388, day 185. `07:39–09:04 craft @ h:9750 — plastering the roof with mud and straw before the rains`. The header gives `rain 07:45–11:15 · storm 07:15–11:45`. The storm is first obeyed at `10:47 rest — at home: storm`. The roof is plastered again at 15:38–17:11.
- **Cause:**
  - `homeHours` weights the season's chore as `chore: chore && !hot && !dark ? H.farm_chore : 0` (population.ts l. 1175).
  - The lane, the water run and fuel gathering all test `!this.C.wx.wet`. The chore does not.
  - `farm_chores` in lives.json lists the roof for months 6–7, and nothing drops it once the first rain has fallen.
- **Scale (q2, seed 1):**
  - There are 168,954 person-days of roof plastering in months 6–7.
  - On the only two wet days in those months (days 185 and 202), **6,692 person-days overlap rain or storm, for 16,285 h**. For example, pid 7073 on day 185 plasters for 5.66 h under rain or storm.
  - 61,748 of the roof person-days fall on or after the first rain, still labelled "before the rains".
- **Fix:**
  - Give the roof (an outdoor chore) the lane's wet, storm and dust test, for the hours of `wx.rain` and `wx.stormH`.
  - After `ctx.firstRain`, make it "mending the roof where the rain came through", and only on dry hours.
  - Add a year test: no outdoor chore overlapping rain or storm.

**S2. On a ration day the Terrace worker stands idle at the stair foot until the issue opens.** Severity: **blocking** (#114); **medium** (2036).
- **Evidence:**
  - #114: `06:04 walk → stair_foot — waiting for the ration issue`, `08:53 … in the ration queue`, `10:05 carry_sack → treasury_store`, `12:01 walk → road:terrace — carrying the ration home`.
  - 2036: `06:57–08:53 queue @ store_town — waiting for the ration issue`, then `08:53–10:39 … in the queue`.
- **Cause:**
  - `calendar.ts` l. 220 sets the issue hour to 07:00–10:00 (`7 + 3u`).
  - Every Terrace planner (builder l. 2278, camp woman l. 2304, `terraceWorker` l. 2599; the detailed porter through the same) walks to the stair foot at the start of work. It then adds `queue … waiting for the ration issue` until the issue hour, and 0.3–1.3 h of queue, before any work.
  - The town's `rationRun` (l. 1643) does the same, with 0.3–1.8 h of queue.
  - On a heat day (`work_day.heat_end_h` 12) little work is left.
- **Scale (q2, seed 1):**
  - 9,083 Terrace and detailed issue person-days with a queue: the mean wait before the issue opens is **1.98 h**, the maximum 5.40 h.
  - Town: 19,572 person-days, with a mean pre-issue wait of 1.06 h.
- **Why it is implausible:**
  - E-01 names the group's head as the receiver, with an apportioner. A group's ration is its head's business.
  - Even if individuals queue (C, for the visible performance §9.5 asks for), a gang does not stand idle at its own work place for hours before the issue opens.
- **Fix:**
  - Work until the issue hour, then queue by squad (or send the head and two men with the gang's sacks). Or, for the town, go to the store at the issue hour, not at first light.
  - Measure the lost working hours per issue day in the soak.

**S3. A married guard's family visit ignores illness at home; long unrelieved post stints in the heat.** Severity: **medium** (#8).
- **Visit:** #8 has 4 h 49 min of free daylight after the A watch. His son of 4 is "ill today" in q_lt_e, and he stays at the hearth. `guard_off_day.family_visit` 0.7 is a flat draw.
- **Post stint:** 09:06–14:01 at post_tachara_1, 4 h 55 min at 38 °C in dust, with no drink or relief. His only bread relief came at 08:33.
- **Suggestions:**
  - Make an ill child or wife a sure visit when daylight allows.
  - Give the watch a water round from the patrol man (or a jar at the post) on E-64 days.

**S4. A newborn's night gap.** Severity: **low** (46220).
- Feeds at 22:16, 01:35 and 06:26: a gap of 4 h 51 min.
- `infant_care.night_feeds` [2, 3] counts feeds. Nothing limits the longest gap at night, as round 6 S4 found for the day (`day_feed_every_h` [1.6, 2.8]).
- A cap of about 3.5 h at 0–1 months would close it.

**S5. A dry winter morning in the sowing window is lost to afternoon rain.** Severity: **low** (28957; household 6790).
- Day 242: rain 15:00–23:00, and the day's `agri` is empty (q4). Four men of the house exchange barley and feed straw instead of ploughing or sowing on 7 dry hours.
- W-01 is about rain hours, not rain days. Q-299's rule for field work (go out if a third of the window is left and mostly dry) is not applied to E-40 on such a day.

**S6. Work before first light.** Severity: **low** (44293).
- The band's flock is let out and counted at 05:08, 62 min before sunrise.
- The planner's own home-hours rule bars work needing light before sunrise − 0.45 h. The herders' day does not use it.

**S7. Labels and roles.** Severity: **low**.
- 43314: "on the day's business" → sightseeing.
- 2668: a storekeeper labelled as stacking sacks for 5 h.
- #131: a courier's home hours are "mending tools and baskets".
- #30: one "→ garrison_hearth_m" among `_s` lines (22:50 vs 23:59).
- 39196: `09:02–09:22 sleep @ lane:v_33` in December without the cold tag. The lines either side have it.
- #100: knucklebones in the lane 17:12–18:26, after a November sunset, with no cold dress.
- These recur from r3 S11, r4 S10 and r5 S8.

## Earlier rounds: do their findings recur?
| earlier finding | status here |
|---|---|
| r5 S1 / r5_b S1: rain shelter in the open field | **Not seen.** 42388 stays home. **New variant:** an outdoor home chore in the rain (S1). |
| r6 S1 / r6_b S1: hides received all day | Not sampled (no Treasury receiver). |
| r6_b S2, S3: guards' hearth loop; family visits | **Mostly fixed.** #30 has errands and practice, and #66 has a family day. #8 has no visit on a day his child is ill (S3). |
| r6 S4: newborn day-feed gaps | Not seen by day (46220's longest day gap is 2 h 28 min). Seen at night (S4). |
| r6 S5: no dress for the cold | **Fixed in the main.** Cold tags appear on all 9 days with a cold morning or evening on which the person goes out (the tenth cold day is the newborn's, indoors). Two lines lack them (S7). |
| r6 S6 / r6_b S8: header omits storms | **Fixed.** The header prints `storm 07:15–11:45`. |
| r6_b S9: the foreman's tools | **Fixed:** "a measuring cord and a straightedge". |
| r4 S2: vigil ends at bedtime | **Fixed** (12597 sleeps by the heap). |
| r5_b S2: toddlers planned as infants | **Fixed** (39196 is fed at meals and nursed). |
| r3 S1: dead agent sampled | **Fixed** (the tool draws `presentDay`). |

## What I checked
| check | how | result |
|---|---|---|
| Day → month and Julian dates | my CALENDAR table against all 20 headers | all agree |
| Seasonal events against EVENTS.md | E-01 window (#114 Ululu 3, 2036 Duzu 5), E-40 (28957), E-43 (12597 day 103 in 43–141), E-46 (5936 month 6), E-49 (44293 month 7, 44627 month 12), E-60 (#100), E-62 (44977), E-64 (heat days) | all in window; S5 for E-40 on a part-wet day |
| The sample against the sim (#114, 42388) | q1: `P.plan` for 1287 (day 150), 42388 and 42386 (day 184); the issue hours for groups 8 and 16 | the sample matches the plans; the porter's "waiting for loads" becomes real carries in the detailed sim (sim.ts l. 331) |
| Scale of S1 | q2: every present non-agent farmer on days 149–208, plan segments "plastering the roof" intersected with `wx.rain` and `wx.stormH` | 168,954 roof person-days; 6,692 overlap rain or storm, 16,285 h; 61,748 on or after the first rain |
| Scale of S2 | q2: every member of every group with an issue on each of 354 days; `queue` segments by label | Terrace: 9,083 person-days, pre-issue wait mean 1.98 h, max 5.40 h; town: 19,572, mean 1.06 h |
| First rain; wet days in months 6–7 | q3: `ctx(184).firstRain`; `wx.rain` and `wx.stormH` for days 149–208 | day 185 is the first rain; the only other wet day is 202 |
| 28957's household on day 242 | q4: plans of 28953, 28955 and 28956; `ctx(241).agri` | agri empty (wet day); all men at home (S5) |
| Guard rota and rounds | #30 and #8 against Q-060 and Q-147 | watches 06–14 and 22–06 as designed; rounds 38 min and 53 min apart |
| Infant rules | 46220 and 39196 against `infant_care` and Q-061/Q-224 | 10 feeds; night count met; night gap S4 |
| Guard family visits | #8 and #66 against `guard_off_day` and Q-337 | #66 visits; #8 does not (S3) |
| Placeholders | grep of the sample for `PLACEHOLDER` | none |
