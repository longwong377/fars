**VERDICT: FAIL.** 3 of 20 people score below 4, and each scores **3**. 21408 Karkišša (farmer, 27, day 292) shelters for 5 h in his open field in near-freezing rain, 5 min from his door. #123 Umuyarakka (camp grinder, 32, day 201) spends two hours carrying sacks of *flour* up to the querns, where she then grinds grain that no one brought. 39742 Ratukka (girl of 13 months, day 148) is nursed like a newborn and eats nothing at any of the three household meals. After scoring, the code confirmed all three as faults. The rain fault is year-wide (S1). The toddler's is one case of a planner that reads each person's age as it was on day 1 of the year (S2): by day 341, 1,446 children who have had their first birthday are still planned as infants. The camp's flour sacks come from no stock and go to none (S3). The other 17 people score 4 (5 people) or 5 (12 people).

# Shadow review, Phase 5, round 5, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5), the second of two for round 5. I did not build the simulation or see it built. I scored from the day timelines and the research files only, before reading any earlier round or any simulation code. I have not read `REVIEWS/shadow_phase5_r5.md`, the other reviewer's report.
- **Date:** 2026-09-23
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick97.txt` (seed 1, pick seed 97), generated on the current tree (HEAD `cd83211`). It holds 6 detailed Terrace agents (3 guards; a porter, a camp grinder, an official) and 14 people of the population (2 Terrace builders, 3 townspeople, 9 drawn from everyone).
- **Protocol:** as written at the top of `REVIEWS/shadow_phase5_r3.md`.
- **Read before scoring:**
  - The protocol section of `REVIEWS/shadow_phase5_r3.md`, ll. 3–33 only (not l. 1). Those lines mention three round-3 outcomes: #49's tool fault, 27049's second supper and #80's hidden meal. They concern the pick-53 sample, not this one.
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 printed Babylonian and Julian dates agree with it.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - The 20 scores, each with a one-line reason, were then saved to `shadow_r5_b_fixed_scores.txt` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5_r4.md` in full. From rounds 1–3 (`shadow_phase5.md`, `_r2.md`, `_r3.md`) I read the camp grinder's note in round 1 and a search of all three for shelter, flour, querns, the lap, weaning, toddlers, mending and officials.
  - `tools/shadow_days.ts` and `tools/shadow_pick.ts`.
  - From `src/people/population.ts`:
    - `ptask` (ll. 610–659), `fieldWhy` (ll. 722–730) and `harvestIn`/`farmChore`;
    - `meals()`, the meal safety net (ll. 1211–1235), and `build0` (ll. 1236–1276);
    - `workBlock`, `dayWork` and `homeDay` (ll. 1405–1440);
    - `small()`, the infant and toddler planner (ll. 1493–1600);
    - the guard planner's `free()`, `leisure()` and watch branches (ll. 1755–1817);
    - `campWoman()` (ll. 1874–1894), `child()` and its `beside`/`follow` rules (ll. 1901–1982);
    - `official()` (ll. 2271–2284), `servant()` and `farmer()` (ll. 2395–2450).
  - From `src/people/sim.ts`: the `carry_sack`, `carry_bread` and porter cases (ll. 250–300), the stock (l. 93) and the caravan and store lines (ll. 428–430, 478).
  - From `src/data/lives.json`: `camp_women_needed`, `infant_care` (with `sleep`), `children_under_five`, `children`, `meals` and `home_hours`.
  - A grep of `research/OPEN_QUESTIONS.md` for shelter, weaning, querns, flour, officials, rain and infants. The relevant hits were Q-061, Q-064 and Q-149.
  - Read-only scratch scripts (q1–q9) in the session scratchpad, outside the repo. They import the simulation as `tools/shadow_days.ts` does. See "Checked in code after scoring".
  - I did not read `DECISIONS.md`.
- **Score changes after reading the earlier rounds or the code:** none. Two notes are corrected against my first reading, and neither changes a score:
  - **39742:** her mother is ill that day, which the sample does not show. So a day spent "in the mother's lap" is right. The score stands on the age fault that remains (S2).
  - **#123:** the flour trip is designed, and the flour is meant for the camp's ovens. The score stands on what remains (S3).
- **Dates** are Babylonian with the Julian date: 467 BCE through Kislimu, 466 BCE from Tebetu on. Sunrise and sunset are the sim's own, in local solar time, as the sample prints them. I did not compute an independent sun this round.
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails, with 3 scores below 4.**
   - **21408 Karkišša** (farmer; Tebetu 26, rain 4.1 mm, −1–9 °C) walks out into rain that has been falling for an hour. He works 3 min, then shelters in the open field for 4 h 12 min and 50 min more, eating his bread there. His house is a 5-min walk away. Score 3.
     - After scoring: a code fault, and a large one. Over the year's 28 rain days, a sample of every third person spends 32,141 h sheltering in open fields. Scaled to the whole population, that is about 19,500 person-days of 2 h or more in the open (S1).
   - **#123 Umuyarakka** (camp grinder; Tashritu 24) grinds for 5 min, then carries three sacks of flour from the depot up to the querns, then grinds grain for five hours. Score 3.
     - After scoring: the flour trip is designed, and the flour is meant for the camp's ovens. But the sacks come from no stock and are credited to none, and no one ever carries grain to the querns (S3).
   - **39742 Ratukka** (girl, 13 months; Abu 30) is nursed ten times, two of them at night, and eats nothing at the three household meals. She spends 06:41–17:50 "in the mother's lap". Score 3.
     - After scoring: the lap is right, because the mother is ill that day. The diet is a code fault. The planners branch on the age at the start of the year (`p.age`), not the age on the day (S2).
2. **Placeholders:** none is flagged in this sample. The tool prints `[PLACEHOLDER: not performed]` for any activity flagged as one, and `src/people/activities.ts` has had none since D-142. I could not verify from the input that each activity is performed on screen (S8).
3. **Goods are not all physical (§9.5).**
   - The camp women's flour sacks appear at the stair foot and vanish at the querns. They are neither drawn from nor added to any stock (`sim.ts:265–268`).
   - The porters' sacks, by contrast, are counted out of the depot and into the Treasury store (`sim.ts:298`, `478`).
   - No plan carries grain to the querns (S3).
4. **Children's ages (S2).** `population.ts` reads `p.age`, a person's age on day 1 of the year, 67 times, and never calls `ageOn`. The effects:
   - Children who turn one are fed as newborns.
   - Children who turn eight stay "minded" and go with the mother to her work (1906).
   - Children who turn five stay in the under-five planner.
5. **Faults behind the 4s:**
   - a guard eats two breakfasts back to back, from the meal safety net's hearth rule (S4);
   - an official and a scribe get a labourer's home hours: mending tools and baskets, in one case before dawn, and 3 h of knucklebones at 40 °C (S5);
   - a scribe's manservant follows an estate servant's template while the 13-year-old son does the far fuel run (S6);
   - the 8-year-old tethered to his mother (S2).
6. **Tool and coverage (S8).**
   - The stratified pick worked. This round shadowed a porter, a camp grinder, an official, a bricklayer, a gang labourer, a store scribe and three townspeople, all missing from round 4.
   - Detailed agents are now stepped in the full LOD, with no elision.
   - The §9.5 on-screen comparison is still not made. Off-Terrace hours are "not drawn", and the population people are plans.

## Scores

Julian dates are 467 BCE unless marked 466.

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #9 Attemira | guard, man 28, Median | 133 (Abu 15, 27 Aug; 18–37 °C) | **4** | A good off day before the night watch: family in the town, a short sleep, on post at 22:01. But two meals back to back at the hearth (06:03 breakfast, 06:29 bread and water). |
| 2 | #81 Dariya | guard, man 20, Median | 56 (Aiaru 27, 11 Jun; 18–38 °C) | **5** | The end of a night watch with a meal relief at 04:00, breakfast, a day sleep, the afternoon with his wife and baby, knucklebones, bed. |
| 3 | #2 Daddama | guard, man 41, Persian | 218 (Arahsamnu 11, 20 Nov; 6–20 °C, rain 9.8 mm) | **5** | Under the garrison roof through the wet morning: hearth, knucklebones, a meal, a short sleep, then the night watch at gate_s1 with spear and wicker shield. |
| 4 | #116 Dadda | porter, man 19, Persian | 17 (Nisanu 17, 3 May; 9–25 °C, dust) | **5** | Bread before dawn, 18 sacks from the stair foot to the Treasury store, long waits for caravans, the camp's bread, home by mid-afternoon, the lane, supper, knucklebones. |
| 5 | #123 Umuyarakka | camp grinder, woman 32, Persian | 201 (Tashritu 24, 3 Nov; 7–25 °C) | **3** | The home half is right. At the camp she carries flour from the depot up to the querns for 2 h, then grinds grain that no one brought. |
| 6 | #132 Attemanya | official, man 32, Persian | 84 (Simanu 25, 9 Jul; 20–40 °C) | **4** | The gate-hall inspection and a day at the official building fit. But he mends tools and baskets in a house with two servants, and plays knucklebones in the lane for 3 h at 40 °C. |
| 7 | 1123 Ulkiš | builder (brick), m 28, Elamite (town) | 90 (Duzu 1, 15 Jul; 21–39 °C) | **5** | Bricklaying on the Hall of 100 Columns from dawn, work stopped at noon for the heat (E-64), crafts at home, supper, a visit to Pirnuš. |
| 8 | 654 Nutibel | builder (labour), m 24, Babylonian (town) | 344 (Addaru 19, 26 Mar 466; 2–18 °C) | **5** | A men's lodging, the earth ramp, column drums unloaded at the yard, home, knucklebones, early bed. |
| 9 | 1906 Muzraaya | child, m 8, Egyptian (town) | 233 (Arahsamnu 26, 5 Dec; −1–14 °C) | **4** | Coherent. But at eight he is tethered to his mother all day at her workshop, with no errand or chore. |
| 10 | 2956 Belpakka | store scribe, m 50, Babylonian (town) | 125 (Abu 7, 19 Aug; 19–38 °C) | **4** | 7.5 h writing and sealing tablets is right. But he mends tools and baskets 04:40–05:35, starting in the dark. |
| 11 | 290 Ušema | homemaker, f 31, Persian (town) | 213 (Arahsamnu 6, 15 Nov; 8–25 °C) | **5** | A baby of two months nursed every 2–2.5 h, the quern, spinning with the women at the door, a visit, the fire, the evening water. |
| 12 | 18919 Turpiš | farmer, m 15, Persian (plain) | 118 (Duzu 29, 12 Aug; 18–37 °C, wind 1 m/s) | **5** | Threshing in E-43's window, sleep in the shade through the heat, the straw turned because the air is too still to winnow, the animals, a visit. |
| 13 | 21408 Karkišša | farmer, m 27, Persian (plain) | 292 (Tebetu 26, 2 Feb 466; −1–9 °C, rain 4.1 mm) | **3** | Out into the rain, 3 min of work, then 5 h sheltering in the open field, 5 min from home. |
| 14 | 39742 Ratukka | child, f 13 months, Persian (plain) | 148 (Abu 30, 11 Sep; 18–38 °C) | **3** | Nursed 10 times and fed nothing at the three meals at 13 months. 11 h "in the mother's lap". |
| 15 | 21762 Dattanna | child, m 3, Persian (plain) | 284 (Tebetu 18, 25 Jan 466; −3–10 °C) | **5** | With the mother at home, in the lane and at the well; a midday sleep; the lane with the neighbours' children, the older ones watching. |
| 16 | 30948 Pirratukka | child, m 6, Persian (plain) | 327 (Addaru 2, 9 Mar 466; 4–19 °C) | **5** | Barley carried to a neighbour and oil carried home, lane play, three meals, rest, bed. |
| 17 | 2868 Utira | child, m 13, Elamite (town) | 239 (Kislimu 3, 11 Dec; −3–10 °C) | **4** | Fuel, water, the toddler, an errand and play: coherent. But in a scribe's house with a manservant, the son of 13 makes the 1.5 h fuel run and learns nothing of his father's work. |
| 18 | 33598 Udusana | elder, f 67, Persian (plain) | 320 (Shabatu 25, 2 Mar 466; −2–12 °C) | **5** | Light grinding and spinning, an exchange in the lane, an afternoon sleep, much rest, meals with the household. |
| 19 | 14498 Tešaka | farmer, m 38, Persian (plain) | 265 (Kislimu 29, 6 Jan 466; −4–9 °C) | **5** | Late sowing on the last day of E-40's window, the meal brought out by a child, the oxen home, an exchange with the neighbours. |
| 20 | 234 Maza | child, f 11, Persian (town) | 344 (Addaru 19, 26 Mar 466; 2–18 °C) | **5** | Brushwood for the fire, spinning, minding the little brother, the lane and a friend's house, meals. |

Distribution: 5 → 12 people; 4 → 5; 3 → 3. **3 of 20 are below 4** (round 1: 10; round 2: 3; round 3: 3; round 4: 1).

## Notes for every score below 5

The three failing days come first, then the others in table order.
- **(a)** marks implausible behaviour and **(b)** a tool or sampling fault.
- "After scoring" marks what I found in the code once the scores were fixed. It never changes a score.

### 21408 Karkišša: farmer on a rain day (score 3)
Sunrise 06:44, sunset 17:15. Tebetu 26 (2 Feb 466), −1–9 °C, cloud 88 %, rain 4.1 mm, wind 2 m/s. Winter (month 10). Mending banks and channels fits the month (E-50's canal work is months 11–12).
- **Fine:**
  - Breakfast of the new bread with the household.
  - The animals fed the stored straw, 13:42–15:22.
  - Supper at 16:24.
  - A visit to kin with a newborn, 17:03–18:03 (E-70).
  - Bed at 20:01.
- **(a) He sits out the rain in a field, 5 minutes from home.**
  - `07:29–07:34 walk … out to the field [carrying a hoe, and bread and water]`, then `07:34–07:37 field_work`.
  - Then `07:37–11:49 shelter @ field:5129:0 — sheltering from the rain {W-01}`, `11:49–12:10 eat @ field:5129:0 — bread and water` and `12:10–13:00 shelter`.
  - Then 37 min of work and home at 13:37.
  - That is 5 h 02 min sheltering in the open at −1 to 9 °C, against 40 min of work.
  - A field has no roof. Home is closer than the 4-hour wait, and he eats cold bread in the rain instead of at his hearth.
  - W-01 says "people shelter". Nobody shelters for five hours in a field he can walk home from.
- **After scoring:**
  - The day's rain window is 06:30–13:00. It had been raining for an hour when he set out.
  - `ptask` drew the plain men's field day (`field_fraction_by_sex`, population.ts:645–648). That branch has no wet check, although the ploughing branch has one (`!C.wx.wet`, l. 641).
  - `workBlock` (l. 1415) then puts the shelter "under a roof at the place". For a field, the place is the field itself.
  - The walk is 0.083 h.
  - The same happens across the year (S1). The score stands.

### #123 Umuyarakka: camp grinder (score 3)
Sunrise 06:33, sunset 17:26. Tashritu 24 (3 Nov), 7–25 °C, clear. Household: herself, a son of 7 and a porter of 27.
- **Fine:**
  - Water from the quarter's well at 05:16, before dawn, carried home on the head.
  - The home quern 05:31–06:06, and bread in hand before leaving.
  - The climb to the camp, 06:29–06:55.
  - The camp's bread at the work hearth at noon.
  - Grinding until 14:31, then home.
  - "Grinding for tomorrow's bread", the fire at 16:13, supper at 16:34 and bed at 18:39.
- **(a) The work runs backwards.**
  - `07:05 grind @ querns — grinding grain` for 5 min.
  - Then, three times over, `walk → stair_foot — down to the depot for flour`, `carry_sack → querns — carrying a sack of flour up to the camp [carrying a sack]` and `rest @ querns — set the sack down`. This runs 07:10–09:07.
  - Then `09:07–14:31 grind @ querns — grinding grain`.
  - Flour is carried to the querns, where grain is ground, and no grain is brought. For a grinder, what she carries contradicts what she does.
  - Each trip is a 2-min walk, 16 min standing at the stair foot, 3 min carrying and 16 min standing at the querns.
- **Minor:** `at home, minding the children` with one child in the house.
- **After scoring:**
  - The trip is designed. `lives.json camp_women_needed.tasks` sends a quarter of the camp women to "carry the flour up from the depot" (population.ts:1889), for the ovens.
  - But the plan sets the sack down at the querns, not at the oven. And the detailed tier takes it at the stair foot and drops it at the querns without touching any stock (sim.ts:265–268).
  - Nothing in the planner carries grain to the querns.
  - The 16-min stands come from the plan's fixed 0.3 h walk block and 0.35 h carry block, which the detailed tier fills with `rest` once the walk is done.
  - On the charitable reading (flour for the bakers, carried to the camp) the day would be a 4. The score stands (S3).

### 39742 Ratukka: girl of 13 months (score 3)
Sunrise 05:46, sunset 18:13. Abu 30 (11 Sep), 18–38 °C. Household: farmer 38, mother 32, sisters of 11 and 8, a brother of 4.
- **Fine:**
  - Beside the mother through the night, with naps.
  - Asleep for the night at 17:50.
- **(a) As scored:**
  - At 13 months she is `nursed by the mother` ten times, at 01:23, 04:56, 07:05, 08:36, 10:36, 12:53, 15:07, 17:07 and 19:45, with two of the feeds at night.
  - At every household meal she is `in the mother's lap at the meal` and eats nothing: 06:41, 11:48 and 17:20.
  - From 06:41 to 17:50 every line is "in the mother's lap" (11 h 09 min). She is never on the floor, on a hip, or with her sisters of 11 and 8.
  - A child of one eats softened bread and gruel at the family's meals and is still nursed a few times a day. The project's own toddler rule says the same.
- **After scoring:**
  - The lap falls away. Her mother (39738) is ill that day: `a little food brought to the sick` and `sitting up, recovering`. The sample does not show this, because only the shadowed person's own sickness is printed. A day in the lap of a mother who is sitting up ill is right.
  - What remains is the age fault. She was 0 on day 1 (`p.age 0`) and had her birthday on day 117. `small()` tests `inf = this.p.age === 0` (population.ts:1512), so she is planned as an infant: the infant nursing cycle, with no food at meals.
  - The toddler branch would give 2–4 day feeds and 0–1 at night (`infant_care.toddler_day_feeds`, `toddler_night_feeds`), and meals with the household. It never runs for her.
  - On the diet alone, the day would be a 4. The score stands (S2).

### #9 Attemira: guard, an off day before the night watch (score 4)
Sunrise 05:33, sunset 18:26. Abu 15 (27 Aug), 18–37 °C.
- **Fine:**
  - Asleep in the garrison quarters until 06:03.
  - Down to his wife and children in q_lt_w by 07:18, and a turn in the lane.
  - Rest with the family through the heat.
  - A meal with them at 17:03, then back up.
  - A short sleep 18:21–21:26, bread and water, and on post at post_harem_1 at 22:01 with spear, bow case and short sword.
- **(a) Two meals back to back:** `06:03 eat — breakfast`, then `06:29 eat — bread and water` at the same hearth. Also, the midday food with his family is `bread and water` at 11:55, not the household's meal.
- **After scoring:**
  - The plan (checked) has breakfast 06:02–06:28, then an 18-min spell at the hearth from `free()`'s `leisure(this.t + 0.3)` (population.ts:1780), then the walk down.
  - `meals()` finds a 10.6-h gap between breakfast and the family's supper. Its guard rule (`hearthOnly`, l. 1228, a round-4 fix) sends the bread to the hearth, and the only hearth moment in the gap is that 18-min spell right after breakfast.
  - The gap stays open, so a second bread is put in at the family's house at 11:54.
  - Seed 1, every 7th person on 8 days: 9 back-to-back meals in 49,802 person-days. 3 of them are guards (persons 147 and 294 on day 109, person 0 on day 158) (S4).

### #132 Attemanya: official (score 4)
Sunrise 05:03, sunset 18:56. Simanu 25 (9 Jul), 20–40 °C. Household: wife 28, daughters of 5 and 3, a son of 8 months, servants f 44 and f 24.
- **Fine:**
  - Breakfast with the household.
  - Up to the Terrace for `an inspection round of the gate hall` (08:39–09:36).
  - The official building 09:54–15:01, with bread at 12:08.
  - Supper at 18:23 and bed at 21:44.
- **(a) A labourer's hours at home:**
  - `07:03–08:06 craft @ h:1106 — mending tools and baskets`, in a house with two servants.
  - `15:13–18:11 gamble @ lane:q_pw_n — knucklebones in the lane`: three hours in the lane through the hottest part of a 40 °C day.
  - Neither is impossible. Together they make his day a template, not an official's.
- **After scoring:**
  - `official()` (population.ts:2281) calls `morning(8.2)`, which fills the morning from `home_hours.men`: rest 0.35, craft 0.2 ("mending tools and baskets"), animals 0.2 and talk 0.15. It is the same for every man.
  - `evening()` (l. 1357) gives a man home early a lane spell that runs until supper, with no heat check (S5).

### 1906 Muzraaya: boy of 8 (score 4)
Sunrise 06:53, sunset 17:06. Arahsamnu 26 (5 Dec), −1–14 °C. Household: his mother (a treasury worker, 51), himself and a brother of 11.
- **Fine:**
  - He eats with his mother.
  - He plays near the oven while she bakes at 15:24.
  - Supper at 16:17 and bed at 19:00.
- **(a) An eight-year-old kept at his mother's side:**
  - 06:57–15:00, `play @ ws:1 — playing near the mother`, every line `[with 1862]`.
  - That is seven and a half hours at her workshop with no errand and no chore. Meanwhile the sample's boy of 6 (30948) runs a barley-for-oil errand, and its boy of 3 (21762) plays in the lane with the neighbours' children.
- **After scoring:**
  - His mother works wood in the treasury workshop.
  - His `p.age` is 7; he is 8 on the day. `child()` takes `age = p.age` (population.ts:1902) and applies `minded_until_age` 8. Q-061's working rule is "children under eight go with the mother to her work", so he is sent along.
  - On his real age he would have his own day: at 7–9, 2.5 h of chores for a boy (`children.work.boy_h`) (S2).

### 2956 Belpakka: store scribe (score 4)
Sunrise 05:26, sunset 18:33. Abu 7 (19 Aug), 19–38 °C. Household of eight, with a married son (a porter) and his wife.
- **Fine:**
  - Breakfast of the new bread.
  - `write_tablet @ store_town — writing and sealing tablets` 07:27–15:30 with the midday meal (E-15).
  - Talk with the men of the lane, supper, and bed at 20:04.
- **(a)** `04:40–05:35 craft — mending tools and baskets`. It begins 46 min before sunrise, so its first 20 min are before the civil dawn, in the dark. It is a labourer's filler for a scribe of fifty.
- **After scoring:** `morning()` and `home_hours.men`, as for #132 (S5).

### 2868 Utira: boy of 13 in a scribe's house (score 4)
Sunrise 06:55, sunset 17:04. Kislimu 3 (11 Dec), −3–10 °C. Household: father (a scribe, 34), mother 33, a brother of 9, a sister of 2 and a manservant of 43.
- **Fine:**
  - Brushwood and dung cakes carried in for the morning fire at 06:44.
  - Water from the quarter's well.
  - The little sister "on his hip".
  - Fuel gathered outside the town.
  - Play by the garden channels and in the lane.
  - Barley for oil with a neighbour.
  - Three meals, and bed at 18:26.
- **(a) The wrong work for the house:**
  - The manservant is at home all morning, yet the scribe's son of 13 walks 44 min out and 45 min back for dung and brushwood.
  - He carries the water jar on his head.
  - He minds the toddler for 2 h 43 min in all while his mother is at home.
  - He has no hour with his father's craft.
  - Each item is possible. Together they read as a village boy's day in a household of standing.
- **After scoring:**
  - The manservant (2871) has `servant()`'s estate template, at the house (population.ts:2447): `carrying food to the estate workers` 06:38–07:34 and 09:54–11:25, and `watering the garden beds by hand` from the quarter's well at 09:24 and 11:30.
  - With the mother's trip at 06:47 and Utira's at 07:48, the house draws water four times before noon (S6).
  - No planner branch gives a boy of 12–13 time at his father's trade.

### The twelve 5s, in one line each
- **#81 Dariya** (Median guard; Aiaru 27):
  - The last hours of the night watch at post_apa_w.
  - Relieved for bread at 04:02 and back at 04:29.
  - Breakfast after the watch, sleep 06:45–13:01, a meal, the afternoon with his wife of 17 and the baby, knucklebones, bed at 20:19.
  - Quibble: `03:56 — waiting to be relieved` introduces a meal relief, not the end of the watch.
- **#2 Daddama** (Persian guard; Arahsamnu 11, rain 9.8 mm):
  - At the south hearth through the wet morning (rain 06:00–12:30, checked after scoring).
  - A meal, a short sleep, and on post at gate_s1 at 22:04 with spear and wicker shield.
- **#116 Dadda** (porter, 19; Nisanu 17, dust 10:45–17:15):
  - Bread before leaving, 18 sacks to the Treasury store in two runs, 5 h 20 min waiting for caravans at the stair foot, the camp's bread.
  - Home at 15:56, the lane, supper, knucklebones, bed at 21:09.
  - Quibbles: the first load is labelled "the next load". The dust shows only in the weather line.
- **1123 Ulkiš** (bricklayer; Duzu 1, 39 °C):
  - Bread before dawn, bricklaying on the Hall of 100 Columns' north wall 05:26–12:00, and the camp's bread at noon when work stops for the heat (E-64).
  - Crafts and talk at home, supper, a visit to Pirnuš, bed at 21:38.
  - Quibble: he carries a brick mould to lay brick.
- **654 Nutibel** (labourer; Addaru 19):
  - A lodging of six builders, the earth ramp at the Hall, column drums unloaded at the yard.
  - Home at 15:57, supper, knucklebones, bed at 19:14.
  - Quibble: a 4-min spell on the ramp after the meal.
- **290 Ušema** (homemaker; Arahsamnu 6):
  - Nine feeds of a baby of two months, three of them at night.
  - 2 h 31 min at the quern for a household of six, spinning with the women outside the door, a visit to Hišmapirsu.
  - The fire at 16:17, supper, the evening water at sunset.
- **18919 Turpiš** (farmer, 15; Duzu 29):
  - Threshing 05:52–10:30 (E-43, days 43–141), the carried bread eaten at the floor, sleep in the shade through 37 °C.
  - The straw turned because the air is too still to winnow (1 m/s).
  - The animals, a visit to Akkina, bed at 20:44.
- **21762 Dattanna** (boy of 3; Tebetu 18):
  - With the mother at home, in the lane and at the well; a midday sleep 12:28–14:28.
  - The lane with the neighbours' children, "the older ones watching the small".
  - Bed at 17:05 in the long January night.
- **30948 Pirratukka** (boy of 6; Addaru 2):
  - Barley to a neighbour and oil home, an errand at six (Q-065).
  - Play in the lane and at home, three meals, bed at 18:33.
- **33598 Udusana** (elder, 67; Shabatu 25):
  - Light grinding (1 h 44 min in two spells) and spinning, an exchange in the lane, an afternoon sleep, much rest.
  - Quibble: the saddle quern is heavy work for "light work".
- **14498 Tešaka** (farmer; Kislimu 29, −4 °C at dawn):
  - Ploughing and sowing on the last day of E-40's window (FARS-CROP's range runs to 10 Jan), with the midday bread brought out by a child of the house.
  - The oxen driven home, supper, an exchange in the lane at dusk.
- **234 Maza** (girl of 11; Addaru 19):
  - Brushwood for the morning fire, 2 h 04 min at the spindle, the little brother "on her hip".
  - The lane and a friend's house, three meals, bed at 19:08.
  - Quibble: "the little ones" for one brother of 3, carried on the hip for 3 h.

## Systemic findings

Severity:
- **blocking**: caused a score below 4 in this sample;
- **high**: a §9.5 fault;
- **medium**: lowered a day to 4 here, and could fail a day on another draw;
- **low**: labels, the tool, or rare.

**S1. Outdoor work goes out into the rain and shelters in the open.** Severity: **blocking** (21408).
- **How it happens.**
  - `ptask()` (population.ts:645–657) draws the men's field day (`field_fraction_by_sex`) and the season's "other work" with no wet check. The ploughing branch has one (`!C.wx.wet`, l. 641).
  - `workBlock()` (l. 1415) then shelters for the rain span "under a roof at the place". Only the Terrace has a real roof in the rule (`gate_hall`). A field, a canal, a vineyard, an orchard or the fuel ground ("outside") becomes the shelter itself.
  - `dayWork()` gives outdoor work a storm check only.
- **Measured** (seed 1, every third person, the 28 days with a rain window):
  - 14,154 person-days with shelter, 39,843 h in all.
  - By place: fields 32,141 h, "outside" 3,169, gate_hall 2,136, garden 708, vineyard 604, canal 492, orchard 326, pasture 209, estate 57.
  - 6,517 sampled person-days hold 2 h or more of shelter in a field, canal, vineyard, orchard or on a threshing floor. That is about 19,500 in the population.
  - Example: 7095, a boy of 11 on day 3, goes out "with the men" at 06:25 into rain that began at 02:15. He hoes 23 min, then shelters 5 h 10 min at the field.
- **Proposed fix** (population.ts `ptask`, `workBlock`):
  - In `ptask`, return no outdoor task (the 'field' and 'other' branches) when `C.wx.wet` and the rain window covers the start of the work. `homeDay('rained off')` already keeps people in.
  - In `workBlock`, when the place is roofless (`field:`, `canal:`, `vineyard:`, `orchard:`, `threshing:`, `outside`, `pasture`) and home is within about 0.5 h, walk home for the rain span. Go back only if at least 1 h of work is left when it stops, and otherwise stay home.
  - Where home is far, shelter under a named cover (a field hut, a tree) with its own label and a cap of about 1 h.
  - Add a test: no roofless shelter over 1 h within 0.5 h of home.

**S2. The planners read each person's age as it was on day 1 of the year.** Severity: **blocking** (39742); medium (1906).
- **How it happens.**
  - `population.ts` branches on `p.age` 67 times, and `ageOn()` is never called outside its own definition (l. 558). But the sample, and the tool, print `ageOn`.
  - `build0()` sends `p.age < 5` to `small()` (l. 1246).
  - `small()` treats `p.age === 0` as an infant (l. 1512): the infant nursing cycle, "in the mother's lap at the meal", no food.
  - `child()` takes `age = p.age` for every rule by age (l. 1902), including `minded_until_age` 8 and the hours of work by age.
- **Measured** (seed 1):

  | printed day | p.age 0 but already 1 (planned as infants) | of whom eat at a meal | p.age 7 but already 8 | p.age 4 but already 5 (still in `small()`) |
  |---|---|---|---|---|
  | 61 | 287 | 0 | 209 | 224 |
  | 148 | 662 | 0 | 513 | 522 |
  | 251 | 1,087 | 0 | 870 | 919 |
  | 341 | 1,446 | 0 | 1,135 | 1,219 |

- The effect grows through the year. By Addaru about half of all one-year-olds are fed as newborns, and the toddler rules (2–4 day feeds, meals with the household, the morning nap) never run for them.
- **Proposed fix:**
  - Take `const age = this.P.ageOn(this.pid, this.d)` once in the planner's constructor, and use it wherever a branch depends on age: `build0`, `small`, `child`, `farmer` l. 2398, `homemaker` l. 2490 and l. 2568.
  - For infants, use days since birth: the toddler branch from 365 days.
  - Add a test that, on sampled days, no child with `ageOn ≥ 1` is in the infant branch and no child with `ageOn ≥ 8` is `minded`.
  - A related question, not a finding: from about six months a baby here still eats nothing at meals. That belongs to Q-061.

**S3. The camp's flour and grain are not goods.** Severity: **blocking** (#123); **high** for §9.5 ("Goods are physical objects").
- **How it happens.**
  - `campWoman()`'s `flour` task (population.ts:1889; `lives.json camp_women_needed.tasks.flour` 0.25) gives a grinder, in mid-shift, three flour sacks from the stair foot, set down at the querns.
  - In the detailed tier (sim.ts:265–268) the sack is taken at the stair foot with no check of `stock.depot` and dropped at the querns with `a.carry = null`, credited to nothing. The porters' sacks, by contrast, are debited and credited (sim.ts:298, 478).
  - No plan carries grain to the querns, where 50 % of the camp women grind all day.
  - The 0.3 h walk block and 0.35 h carry block leave 16 min standing at each end of a 2-min walk.
- **Proposed fix** (population.ts `campWoman`, sim.ts `carry_sack`):
  - Either make it grain: "carrying a sack of barley up from the depot for the querns", drawn from a depot grain stock and added to a quern stock that the grinders use up.
  - Or keep flour for the bakers: carry it to the oven, and draw it from a flour stock fed by E-07 (grain to the town mill, flour back).
  - Size the blocks to the walk, or make the wait a named act (`queue`, "the storekeeper measures out the sack").
  - Extend the stock test that covers the porters to every carried sack.

**S4. A guard's second breakfast from the meal safety net.** Severity: **medium** (#9).
- **How it happens.**
  - `meals()` (population.ts:1213–1234) fills a gap of more than 7 h with bread and water. Round 4's `hearthOnly` rule (l. 1228) sends a guard's bread to his hearth whenever any hearth moment falls in the gap.
  - On a family day the only hearth moment is `free()`'s 18-min `leisure(this.t + 0.3)` right after breakfast (l. 1780). So the bread lands 26 min after breakfast, the gap stays open, and a second bread follows at the family's house.
- **Measured:** 9 back-to-back meals in 49,802 sampled person-days. 3 are guards (147 and 294 on day 109, 0 on day 158). The rest are small children's meal-edge seams.
- **Proposed fix:**
  - Apply `hearthOnly` only when a hearth slot lies within about 1.5 h of the gap's midpoint, and otherwise put the bread where he is.
  - Or reject an insertion that does not bring the gap under its limit.
  - Better still, give the family visit its own midday meal with the household.

**S5. Men's home hours are the same for every class, and have no light or heat checks.** Severity: **medium** (#132, 2956).
- **How it happens.**
  - `morning()` and `homeHours()` draw from `home_hours.men` (rest 0.35, craft 0.2 "mending tools and baskets", animals 0.2, talk 0.15) for every man. So an official in a house with two servants mends baskets for an hour, and a scribe of fifty mends them before the civil dawn.
  - `evening()` (l. 1357) sends a man home from work early into a lane spell that runs until supper. For #132 that is 2 h 58 min of knucklebones in 40 °C, with no E-64 check.
- **Proposed fix** (lives.json `home_hours`, population.ts `homeHours`/`evening`):
  - Home hours by standing and job:
    - officials and scribes: household accounts, receiving callers, a visit, the household's affairs;
    - mending: the servants' and labourers' work.
  - No craft before the civil dawn or after dusk without a lamp.
  - The E-64 heat check on lane spells between 12 and 16 h, and a cap of about 1.5 h on one spell.

**S6. The servant's day is an estate's.** Severity: **low** (2868).
- **How it happens.** `servant()` (population.ts:2447) gives every servant estate tasks ("grinding for the estate household", "carrying food to the estate workers", "watering the garden beds by hand"). A scribe's manservant in a town quarter therefore stands at the house "carrying food to the estate workers" for 2.5 h, while the son of 13 walks 1.5 h for fuel.
- **Proposed fix:**
  - Servant tasks by household type. In a town house: the far fuel and water, the errands to the store and the lane, the mending, waiting on the master.
  - Let the household's chores be shared out before the children's (`hday` → `waterer`, the fuel run).

**S7. Labels and plan seams.** Severity: **low**.
- "minding the children" with one child (#123), and "the little ones … the youngest on her hip" for one brother of 3, for 3 h (234).
- `going for the next load` for the first load (#116, 05:49).
- `waiting to be relieved` before a meal relief (#81, 03:56).
- `rest @ stair_foot — down to the depot for flour`: a walk's label on 16 min of standing (#123; S3).
- A 4-min ramp spell after the midday meal (654, 12:32–12:36).
- These recur from round 1 C10, round 2 N7, round 3 S11 and round 4 S10.

**S8. Tool and coverage.** Severity: **medium** for the unconfirmed §9.5 check; **low** for the rest.
- **Fixed since round 4:**
  - The pick is stratified (`pickSample`): 3 guards and 3 other detailed agents, 2 Terrace workers, 3 townspeople and 9 of everyone.
  - The detailed agent is stepped alone in a fresh simulation, in the full LOD, with no elision.
  - Days are drawn from all 354.
- **Still not made:** the §9.5 comparison of what is drawn with what the simulation says.
  - Off-Terrace hours are "[off the Terrace: not drawn]". For #132 that is his 5 h at the official building. For #116 and #123 it is their home halves.
  - The 14 population people are printed as plans.
  - No placeholder is flagged, and I could not check any performance on screen.
- **The sample hides a household member's state.** A mother's sickness is invisible in her child's day (39742). Printing `SICK today` for every member in the household line would let a reviewer read the day as it is.
- **Names (round 4 S8, recurs):** on day 151, 229 of 230 Egyptian men are Muzraaya (1906), and no Egyptian woman has a name. Babylonian men have 16 names for 389 people.
- **Villages (round 4 S9, recurs):** three of the sampled people live in v_14, which holds 4,250 people on day 151 with one well, one lane and one threshing floor.

## Checked in code after scoring

These checks came after the scores were fixed. None changed a score.

- **Scratch scripts** (session scratchpad, read-only, importing the worktree's `tools/shadow_days.ts` and `src/people`):
  - **q1:** the weather of day 292 (rain window 06:30–13:00) and household 5129's task (`field`, `mending the field banks…`, h0 07:37); the plans of 39742 and of her mother 39738 on day 148 (the mother ill, recovering); 39742's `p.age` 0 and birthday on day 117.
  - **q2:** the plans of #9 (pid 29), #123 (pid 1174), #132 (pid 2760), 2956, 1862 and 1906 (`p.age` 7, `ageOn` 8), and of 2866, 2867 and 2871 (2868's household).
  - **q3:** #9's full plan, and back-to-back meals over 49,802 sampled person-days (9, with 3 guards).
  - **q4:** `p.age` against `ageOn` for children on days 61, 148, 251 and 341 (S2's table).
  - **q5:** rain shelter by place over the year's 28 rain-window days (every third person; S1).
  - **q6:** 7095's plan on day 3, 21408's plan on day 292, and his walk to the field (0.083 h).
  - **q7:** the weather windows of the detailed agents' days: #2's rain 06:00–12:30, #116's dust 10:45–17:15, and the heat rest on #9's and #132's days.
  - **q8:** name pools by origin (Egyptian men, Egyptian women, Babylonian men) and v_14's size.
  - **q9:** the bakers of the five households that eat "the new bread".
- **Code read:** as listed at the top. In short: S1 in `ptask` and `workBlock`; S2 in `build0`, `small` and `child`; S3 in `campWoman` and sim.ts's `carry_sack`; S4 in `meals()` and `free()`; S5 in `official()`, `morning()`, `homeHours()` and `evening()`; S6 in `servant()`.

## Earlier rounds: do their findings recur?

| earlier finding | status in this sample |
|---|---|
| R1 C1: meals inverted, workers unfed | **Not seen.** Every adult eats 3–5 times. The grinder, the bricklayer, the labourer and the porter all eat before leaving and at the camp hearth. |
| R1 C2: plain children never sleep | **Not seen.** All children sleep at night, and the 3-year-old naps. |
| R1 C3: infants fed only at meals | **Fixed** for infants (290's baby is fed nine times). **New, in reverse:** a child of 13 months is fed only by nursing (S2). |
| R1 C6: households do not eat together | **Fixed** where checked. The town and plain households share their meal times. |
| R1 C7 … R4 S4: clockwork templates | **Not seen** in the herders (none sampled). Seen as class-blind home hours (S5) and the estate servant (S6). |
| R1 C10 … R4 S10: labels | **Recurs** (S7). |
| R1 C11 … R4 S12: the tool | **Largely fixed.** The pick is stratified, the detailed agent runs in the full LOD, and there is no elision. The on-screen check is still not made, and a member's sickness is not shown (S8). |
| R2 N1: older children on a play template | **Not seen** for 11–13 (234 and 2868 work). Seen at 8, from the age fault (1906; S2). |
| R2 N3: harvest ahead of the sources | **Fixed.** Threshing on day 118 is inside E-43, and sowing on day 265 inside E-40. |
| R2 N6: winnowing in a calm | **Fixed.** 18919 turns the straw at 1 m/s. |
| R2 N8: nothing carried | **Fixed in form.** Arms, jars, sacks, fuel, oil, tools, bread and the plough are carried. **New:** the camp's sacks are not stock (S3). |
| R3 S2, S6, S7: meals dropped, bread vanishing, bread nobody baked | **Not seen.** 18919 and 14498 eat what was carried or brought out. After scoring (q9): all five households that eat "the new bread" (2956, 18919, 21408, 33598, 14498) had a woman knead and bake it that morning. |
| R3 S4: a toddler teleports home | **Not seen.** 21762 walks home with the other children. |
| R4 S1: a farming man idle at home | **Not seen.** 14498 ploughs and 18919 threshes. 21408 goes out, but into the rain (S1). The code now has `farm_men_other_work` and a men's rest cap. |
| R4 S2: the grain-heap vigil ends at bedtime | **Not sampled.** The code now keeps the watchman asleep by the heap until dawn (`farmer()`, the vigil branch). |
| R4 S3: the leader's change-of-watch round | **Not sampled** (no leader of ten drawn). |
| R4 S5: infants awake through the mother's work | **Not sampled** as such. The code now has `infant_care.sleep`. It does not reach a one-year-old planned as an infant (S2). |
| R4 S6: a child with a hoe at the threshing floor | **Fixed in code.** A child's work at the floor is `thresh` (population.ts:1916). None sampled. |
| R4 S7: thin winter days for women | **Not sampled** (no woman at home in months 9–11). `home_hours.women_winter` exists. |
| R4 S8: thin name pools | **Recurs** (S8). |
| R4 S11: placeholders | **None flagged** (D-142). Not verified on screen. |

## What holds up

- **The garrison:**
  - three watches changing at 06:00, 14:00 and 22:00;
  - a short sleep before the night watch, and a day sleep after it;
  - the meal relief in the night (#81);
  - the family visits on free days, weighed against the rain (#2 stays in);
  - arms by origin (the Persian with spear and wicker shield, the Medians with spear, bow case and short sword).
- **The Terrace works:**
  - the porters' sacks are stock, and caravan waits are real idle time;
  - the gangs work dawn to mid-afternoon, or to noon in the heat (E-60, E-64);
  - the camp's bread at the work hearth;
  - builders lodging together.
- **Season and weather:**
  - threshing and sowing inside their sourced windows;
  - no winnowing in still air;
  - heat rest on every hot day;
  - winter suppers before sunset and long winter nights for children;
  - the ox team out in the ploughing month;
  - the stored straw fed in winter.
- **Households:**
  - women grind before sunrise, bake, spin with neighbours, draw water at dusk and nurse on demand (290);
  - children work by age at 6, 11 and 13 (the errand, the spindle, fuel, water, the toddler on the hip) and play in the lanes;
  - elders do light work;
  - visits follow ties (Pirnuš, Akkina, Hišmapirsu, kin with a newborn).
- **Calendar:** all 20 dates are right. The two people drawn for day 344 (654, 234) share its weather exactly.
- **No anachronism** appears in any world-facing text. "Homemaker", the `post_harem_*` ids and `[off the Terrace: not drawn]` are out-of-world labels.

## VERDICT

**FAIL.** 3 of 20 people score below 4:

| person | score | cause |
|---|---|---|
| 21408 Karkišša (farmer, 27, day 292) | 3 | out into the rain, then 5 h sheltering in the open field 5 min from home (S1) |
| #123 Umuyarakka (camp grinder, 32, day 201) | 3 | carries flour to the querns and grinds grain nobody brought; the sacks are not stock (S3) |
| 39742 Ratukka (girl, 13 months, day 148) | 3 | fed as a newborn and never at a meal, because the planner reads her age as on day 1 (S2) |

- Round 4 had one day below 4. This round has three, from three new causes.
  - S1 was not exercised before: round 4 had no field worker on a rain day, and round 1's rain day was a toddler in the lane.
  - S2 and S3 were not sampled before.
- Round 4's blocking cause (S1, the idle farming man) is not seen, and the code now gives such a day other work.

**The minimum before a re-review:**
1. **Fix S1:**
   - no roofless outdoor work begun in rain;
   - shelter at home when home is near;
   - a test on the whole year's roofless shelter.
2. **Fix S2:** every age branch uses `ageOn` (or days since birth for infants), with a test.
3. **Fix S3:**
   - the camp's sacks are grain for the querns, or flour carried to the oven;
   - every carried sack is debited from, and credited to, a stock.
4. Fix S4 (the hearth rule) and S5 (home hours by standing, light and heat).
   - Neither failed a day here, but each is visible on any draw of a guard's family day or an official's or scribe's morning.
5. Draw a fresh sample with a new pick seed.
   - Make sure it has at least one outdoor worker on a rain day and one child who has had a birthday this year (a toddler of 12–23 months, or a child of 5 or 8).
   - Print `SICK today` for every household member in the header.

S6–S8 are not blocking. With S4 and S5, fixing them would move most of the five 4s to 5s. The §9.5 on-screen comparison (S8) is still not made by this tool.
