**VERDICT: FAIL.** 1 of 20 people scores below 4: 21408 Karkišša (farmer, 27, day 292) **3**. On a February day of steady rain he walks out to his field an hour after the rain began. He works 3 minutes, then "shelters from the rain" in the open field, 5 minutes' walk from home, for 5 h 02 min in all, and eats there. After scoring I found the cause in the code. The day's field task has no wet check, and a work block puts the shelter "at the place", which for a field has no roof (S1). On the 22 wet days with rain in the day, 86 to 10,852 people a day shelter in the open, about 40,100 person-days in the year. The other 19 people score 4 (7 people) or 5 (12 people).

# Shadow review, Phase 5, round 5 (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. I read no earlier round and no simulation code before scoring.
- **Date:** 2026-09-23
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick97.txt` (seed 1, pick seed 97). It was generated on the current tree and has 6 detailed Terrace agents and 14 people of the population. The pick is stratified:
  - 3 guards (#9, #81, #2);
  - 3 other detailed agents: a porter (#116), a grinder of the work camp (#123) and an official (#132);
  - 2 Terrace workers of the population (1123, 654);
  - 3 townspeople (1906, 2956, 290);
  - 9 people drawn from everyone.
- **Protocol:** round 3's, as written in `REVIEWS/shadow_phase5_r3.md` ll. 3–33.
- **Read before scoring:**
  - `REVIEWS/shadow_phase5_r3.md` ll. 3–33 only, for the protocol (not l. 1 and not the rest).
    - Those lines also name three round-3 outcomes: #49's day was a tool fault, 27049 had a second supper, and #80 had a hidden meal.
    - They concern the pick-53 sample, not this one. I record them for transparency.
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian).
    - From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354.
    - All 20 Babylonian and Julian dates in the sample agree with it.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - A hand check of the day length on three days (#9, #81 and #2). I worked it from the solar declination, with and without refraction, and imported nothing.
  - The 20 scores, each with a one-line reason, were then saved to a scratch file before anything else was read: `shadow_r5_a_fixed_scores.txt` in the session scratchpad.
- **Read after the scores were fixed:**
  - The earlier rounds:
    - `REVIEWS/shadow_phase5.md` (round 1): its header, "Read first" and cross-cutting findings;
    - `REVIEWS/shadow_phase5_r2.md` (round 2): its cross-cutting findings;
    - `REVIEWS/shadow_phase5_r3.md` (round 3), in full;
    - `REVIEWS/shadow_phase5_r4.md` (round 4), in full.
  - One grep of `research/OPEN_QUESTIONS.md`, for shelter, rain days, weaning, toddlers, the hip, minders, start-of-year age, the depot, officials and dust days. The protocol allows it after drafting; I ran it after saving.
    - The shelter, minding and age hits were Q-037, Q-061, Q-065 and Q-146.
    - A second pattern, "rain", printed only the first line of Q-030, Q-033, Q-036, Q-037, Q-046, Q-053, Q-056, Q-064, Q-140 and Q-141, cut at 200 characters. None of them names shelter or rain behaviour.
  - `tools/shadow_days.ts` and `tools/shadow_pick.ts`.
  - `src/people/activities.ts`, in full: the performance registry.
  - From `src/people/population.ts`:
    - `ptask` (ll. 600–658) and `builderAvailable` (ll. 788–794);
    - `homeHours` (ll. 934–980) and the meal safety net `meals` (ll. 1211–1232);
    - `evening` (ll. 1342–1362);
    - `workBlock`, `dayWork` and `homeDay` (ll. 1405–1440);
    - `small`, the infant and toddler planner (ll. 1499–1575);
    - the guard planner's relief, leisure and family-visit parts (ll. 1740–1800);
    - the camp woman's tasks (ll. 1880–1895);
    - `child` (ll. 1897–2060) and `farmer` (ll. 2395–2440).
  - From `src/people/sim.ts`:
    - `decide` and `onTerrace` (ll. 195–300);
    - the `offmap` handling and `visibleAgents` (ll. 367–373, 518–523).
  - From `src/people/calendar.ts`: `sunTimes` and `dayWx` (ll. 30–55).
  - The header of `src/people/crowd.ts` (ll. 1–40).
  - From `src/data/lives.json`: `children`, `children_under_five`, `infant_care` and `home_hours`.
  - Read-only scratch scripts in the session scratchpad, outside the repo (q1–q6 and `sun.py`). They are listed under "Checked in code after scoring".
  - **Outside the listed files, for transparency:**
    - a one-line `git log` (15 commits), which I ran to see the tree's state;
    - one grep hit in `src/world/world.ts` (ll. 178–181, the dev overlay's population line), which I read to learn whether the population is rendered.
  - I did not read `DECISIONS.md`.
- **Score changes after reading the earlier rounds or the code:** none. Notes were added, and several faults turned out worse than I scored them:
  - **21408:** the rain began an hour before he set out.
  - **234 and 2868:** the little one they "mind on the hip" is elsewhere, or asleep in the mother's care.
  - **39742:**
    - her mother is recovering from sickness, which explains the lap;
    - but the child is planned as an infant although she is 13 months old;
    - and her sister "minds her on the hip" at the same time as her own line puts her in the mother's lap.
  - **1906:** his brother of 11 is at home most of the day while he is taken to the workshop.
- **Dates** are Babylonian with the Julian date: 467 BCE through Kislimu, 466 BCE from Tebetu on.
  - Sunrise and sunset in the notes are the sim's own (`sunTimes()`), in local solar time.
  - My independent figures, from `sun.py` after scoring (apparent sun with refraction), put sunrise 3–6 min earlier and sunset 4–7 min later on all 20 days (S10).
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails.**
   - **21408 Karkišša** (farmer, 27; Tebetu 26, 2 Feb 466; −1–9 °C, rain 4.1 mm) is at his field in the open for 6 h 03 min in cold rain. It holds 40 min of work, 5 h 02 min of "sheltering from the rain" and a meal. His home is 5 min away, and his wife and father spend the morning indoors. Score 3.
   - After scoring, a code fault (S1):
     - the day's field task (`ptask`, population.ts:648) has no wet check;
     - `workBlock` (l. 1415) shelters "at the place";
     - the shelter's own performance note reads "waiting out rain under a roof".
   - About 40,100 person-days of open-air sheltering in the year, with mean spells over 4 h on 10 of the wet days.
2. **A §9.5 fault in the plans: children "mind" little ones who are not there (S2).**
   - "Minding the little ones, the youngest on her hip" is planned without looking at the little one's own day.
   - On five days measured, the little one is not at the minder's place for 22–31 % of the minding time. For most of the rest, its own line has it with its mother.
   - 29 % of the "on the hip" time on day 341 falls while the little one is asleep.
   - Three sampled days show it: 234, 2868, and 39742 with her sister.
3. **People are planned on their start-of-year age (S3).**
   - The headers print the age on the day, but the planners use `p.age`, the age at the start of the year.
   - By day 301, 1,268 of the 1,529 children planned as infants are over one year old, and 1,008 of the 1,175 eight-year-olds are planned as seven.
   - In the sample:
     - a girl of 13 months is nursed 9 times, given no food and held in the lap for 11 h (39742);
     - a boy of 8 is taken to his mother's workshop as a small child is (1906).
4. **Placeholders** (listed in their own section; they do not enter the scores):
   - No activity lacks a performance any more: the registry flags none (D-142), and the tool prints no `[PLACEHOLDER]` tag. Rounds 1–4 counted 43–50 h of unperformed activity.
   - But the population is not rendered at all. The dev overlay's own line reads "NOT RENDERED [PLACEHOLDER: D-024]", and the crowd draws only the detailed agents on the Terrace.
   - Of the 480 h shadowed, **74 h 35 min (15.5 %) are drawn**: #2's whole day and the Terrace hours of the other five detailed agents.
   - The 14 population people are never drawn. That includes the brick-laying and hauling that 1123 and 654 do on the Terrace itself, 16 h 17 min in all.
   - So §9.5's check that "what a person is doing on screen matches what the simulation says" can be made for 15.5 % of this sample.
5. **Faults behind the 4s:**
   - a guard's second meal 26 min after breakfast (S4);
   - an official's 3 h of knucklebones in the lane on a 40 °C afternoon (S5);
   - a camp woman carrying flour up to the querns (S6);
   - an official mending tools and baskets (S7);
   - labels (S8).
6. **Tool (S11).**
   - Round 4's tool faults are fixed. The shadowed agent now walks at full LOD, each detailed day runs in a fresh sim, nothing is elided, days 1–354 can be drawn, and the pick is stratified.
   - This sample covers the town, the Terrace gangs of the population, a porter, a work-camp woman and an official.
   - Not sampled: herders, travellers, couriers, priests, masons, bakers, a leader of ten, a grain-heap vigil and a baby under four months.

## Scores

Julian dates are 467 BCE unless marked 466.

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #9 Attemira | guard, man 28, Median | 133 (Abu 15, 27 Aug; 18–37 °C) | **4** | An off-watch day with his family in the town, then the night watch from 22:00. But two meals come back to back at the hearth (06:03 breakfast, 06:29 bread and water). |
| 2 | #81 Dariya | guard, man 20, Median | 56 (Aiaru 27, 11 Jun; 18–38 °C) | **5** | The night watch with a bread relief at 04:00, sleep after it, the afternoon with his wife and the baby, knucklebones, bed. |
| 3 | #2 Daddama | guard, man 41, Persian | 218 (Arahsamnu 11, 20 Nov; rain 9.8 mm) | **5** | A rain day off watch at the hearth, a sleep before the watch, on post at gate_s1 with spear and wicker shield. |
| 4 | #116 Dadda | porter, man 19, Persian | 17 (Nisanu 17, 3 May; dust) | **5** | Sacks from the stair foot to the Treasury store in two bouts, waits for caravans, the camp's meal, home mid-afternoon, the lane. |
| 5 | #123 Umuyarakka | grinder (work camp), woman 32, Persian | 201 (Tashritu 24, 3 Nov; 7–25 °C) | **4** | A good frame (water, her own quern, the camp querns, the fire, supper). But she carries sacks of flour from the depot up to the querns. |
| 6 | #132 Attemanya | official, man 32, Persian | 84 (Simanu 25, 9 Jul; 20–40 °C) | **4** | A gate-hall inspection and a day at the official building. But an hour mending tools and baskets, and 3 h of knucklebones in the lane through the heat of a 40 °C afternoon. |
| 7 | 1123 Ulkiš | builder (brick), m 28, Elamite (town) | 90 (Duzu 1, 15 Jul; 21–39 °C) | **5** | Brick-laying on the Hall of 100 Columns from dawn, the heat stop at noon (E-64), tools at home, a visit. |
| 8 | 654 Nutibel | builder (labour), m 24, Babylonian (town) | 344 (Addaru 19, 26 Mar 466; 2–18 °C) | **5** | The earth ramp, column drums at the yard, home, knucklebones, bed. |
| 9 | 1906 Muzraaya | child, m 8, Egyptian (town) | 233 (Arahsamnu 26, 5 Dec; −1–14 °C) | **4** | With his mother, a Treasury worker, all day. But a boy of 8 plays alone beside her at her workplace for 8 h with no chore and no other child. |
| 10 | 2956 Belpakka | scribe (store), m 50, Babylonian (town) | 125 (Abu 7, 19 Aug; 19–38 °C) | **5** | Tablets at the town store 07:27–15:30, the men of the lane, the household. |
| 11 | 290 Ušema | homemaker, f 31, Persian (town) | 213 (Arahsamnu 6, 15 Nov; 8–25 °C) | **5** | The quern, a baby of 2 months nursed day and night, a visit, spinning with the women, the fire, the evening water. |
| 12 | 18919 Turpiš | farmer, m 15, Persian (plain) | 118 (Duzu 29, 12 Aug; 18–37 °C, wind 1 m/s) | **5** | Threshing with the animals, too still to winnow, a long sleep in the shade through the heat, the animals, a visit. |
| 13 | 21408 Karkišša | farmer, m 27, Persian (plain) | 292 (Tebetu 26, 2 Feb 466; −1–9 °C, rain 4.1 mm) | **3** | Works 3 min, then shelters from the rain in the open field for 5 h, and eats there, 5 min from home in a cold February rain. |
| 14 | 39742 Ratukka | child, f 13 months, Persian (plain) | 148 (Abu 30, 11 Sep; 18–38 °C) | **4** | Nursing, naps and sleep beside the mother are right. But 11 h in the mother's lap, never set down or with her sisters, and no food but the breast at 13 months. |
| 15 | 21762 Dattanna | child, m 3, Persian (plain) | 284 (Tebetu 18, 25 Jan 466; −3–10 °C) | **5** | With the mother, the lane, a nap, an hour with the lane children watched by older ones, the well, an early winter bed. |
| 16 | 30948 Pirratukka | child, m 6, Persian (plain) | 327 (Addaru 2, 9 Mar 466; 4–19 °C) | **5** | Play in the courtyard and the lane, barley carried to a neighbour for oil, three meals. |
| 17 | 2868 Utira | child, m 13, Elamite (town) | 239 (Kislimu 3, 11 Dec; −3–10 °C) | **4** | Fire, water and a 2 h 24 min fuel run are right. But a scribe's son of 13, in a house with a man servant, spends 2 h 43 min with the youngest "on his hip". |
| 18 | 33598 Udusana | elder, f 67, Persian (plain) | 320 (Shabatu 25, 2 Mar 466; −2–12 °C) | **5** | Light grinding, a small exchange in the lane, a nap, spinning, the grandchildren. |
| 19 | 14498 Tešaka | farmer, m 38, Persian (plain) | 265 (Kislimu 29, 6 Jan 466; −4–9 °C) | **5** | Ploughing and sowing on the last day of E-40's window, the midday bread brought out by a child, an exchange at dusk. |
| 20 | 234 Maza | child, f 11, Persian (town) | 344 (Addaru 19, 26 Mar 466; 2–18 °C) | **4** | Fire, spinning, play and a friend's house are good. But "the little ones, the youngest on her hip" is one brother of 3, carried for 3 h straight. |

Distribution: 5 → 12 people; 4 → 7; 3 → 1. **1 of 20 is below 4.** Earlier rounds: round 1, 10 of 20; round 2, 3; round 3, 3; round 4, 1.

## Notes for every score below 5

The failing day comes first, then the others in table order.

- **(a)** marks implausible behaviour; **(b)** marks a label or tool fault.
- Placeholders are listed in their own section and do not enter the score.
- "After scoring" marks what I found in the code, the earlier rounds or the scratch scripts once the scores were fixed. It never changes a score.

### 21408 Karkišša: farmer, a rain day in month 10 (score 3)
Sunrise 06:44, sunset 17:15. Tebetu 26 (2 Feb 466). −1–9 °C, cloud 88 %, rain 4.1 mm, wind 2 m/s.
- **Fine:**
  - Breakfast of "the new bread" at 06:52 with the household.
  - Mending the field banks and the water channels suits month 10.
  - The animals fed on the stored straw (13:42–15:22).
  - Supper at 16:24, before sunset.
  - An evening visit to kin with a newborn (17:03–18:03), and bed at 20:01.
- **(a) Sheltering in the open, 5 minutes from home.**
  - `07:29 walk … out to the field [carrying a hoe, and bread and water]`.
  - `07:34–07:37 field_work`, then `07:37–11:49 shelter @ field:5129:0 — sheltering from the rain {W-01}`.
  - `11:49–12:10 eat @ field:5129:0 — bread and water`, then `12:10–13:00 shelter`.
  - In all, 6 h 03 min at the field: 40 min of work, 5 h 02 min of shelter and a 21-min meal, in February rain at 1–9 °C.
  - W-01 says people shelter and outdoor work stops. A man whose field is 5 min away walks home to the fire. A visitor following him would find a farmer sitting in a wet field for five hours with nothing over his head.
- **After scoring:**
  - **The rain began before he set out.** Hourly, rain above the shelter threshold (0.25) runs without a break from 06:30 to 13:00: the day's `wx.rain` is [06:30, 13:00] and `rainH` is 6.5. He walked out at 07:29 into an hour-old rain.
  - **His household:**
    - his wife (21409) kneaded and baked 05:19–06:06, so the new bread is real;
    - she spins indoors through the morning;
    - his father (21410) mends baskets at home;
    - both eat the midday meal at home at 12:09 while he eats at the field.
  - **Cause:**
    - `ptask` (population.ts:648), the men's field-work branch, has no wet check. The ploughing branch at l. 641 has `!C.wx.wet`, and builders are "rained off before work started" at `rainH > 5` (l. 792).
    - `workBlock` (l. 1414–1415) then shelters "on the Terrace under the Gate's roof, elsewhere under a roof at the place". The place is the field.
    - The activity's performance note is "waiting out rain under a roof" (activities.ts, `shelter`).
  - **Across the year:**
    - On the 22 wet days with daytime rain, 86 to 10,852 town and plain people a day shelter at an open place (field, canal, orchard, vineyard, pasture, outside, garden).
    - That is about 40,100 person-days in all. The mean spell is over 4 h on 10 of those days (5.73 h on day 13).
    - On day 292 itself: 5,059 people, mean 4.43 h. See S1.

### #9 Attemira: guard, an off day before the night watch (score 4)
Sunrise 05:33, sunset 18:26. Abu 15 (27 Aug), 18–37 °C.
- **Fine:**
  - Asleep in the garrison until 06:03.
  - Down to his wife and sons (5 and 2) in q_lt_w, 31 min each way.
  - The lane, and rest with the family through the heat.
  - A meal with them at 17:03.
  - Back up by 18:10, and a nap to 21:26.
  - Bread and water, then on post at harem_1 at 22:01 with spear, bow case and short sword, the Median's arms (Q-144).
- **(a) Two meals back to back:** `06:03 eat @ garrison_hearth_s — breakfast` (26 min), then `06:29 eat @ garrison_hearth_s — bread and water` (18 min). A careful observer would see him sit down to a second meal as the first ends.
- **Minor:** the midday meal at his family's house is "bread and water", not a meal with them.
- **After scoring:**
  - The second meal is the safety net `meals()` (population.ts:1211–1232). The gap from 06:28 to the family meal at 17:02 (10.6 h) exceeds the 7 h limit.
  - The guard rule `hearthOnly` (l. 1228) turns on because a hearth segment lies in the gap. That segment is the 0.3 h of leisure before the walk down (l. 1780, `leisure(this.t + 0.3)`).
  - So the gap meal is put at the hearth, at the gap's edge, where it does not close the gap. The next pass puts a second gap meal at home at 11:54.
  - On nine days, 53 of 887 guard-days (6.0 %) have a second meal within 30 min of the first, mostly "breakfast" followed by "bread and water" (S4).

### #123 Umuyarakka: grinder of the work camp (score 4)
Sunrise 06:33, sunset 17:26. Tashritu 24 (3 Nov), 7–25 °C.
- **Fine:**
  - Water from the quarter's well at 05:16, and the household's flour at her own quern (35 min).
  - Bread before the 26-min walk up to the camp.
  - The camp querns 09:07–14:31, with the camp's meal at 12:01.
  - Home by 14:57 to grind for tomorrow, the fire lit at 16:13, supper at 16:34 and bed at 18:39.
- **(a) The goods flow backwards.**
  - Three times: `walk → stair_foot — down to the depot for flour`, then `carry_sack → querns — carrying a sack of flour up to the camp [carrying a sack]`, then `rest @ querns — set the sack down`.
  - Then she grinds grain again.
  - Flour is carried to the querns that make flour. The ovens, where the camp's flour is used, are not visited.
- **(b) Minor:**
  - "At home, minding the children": she has one child, a boy of 7.
  - The water is drawn in the dark, 77 min before sunrise.
- **After scoring:**
  - The camp's `flour` task (population.ts:1889) plans three trips with the destination `querns`. `onTerrace` (sim.ts:265–268) sets the sack down at the plan's place (S6).
  - The label comes from `homeHours` (l. 938). It counts members under 7 by the start-of-year age (her son is 6 at the start of the year and 7 on the day) and always says "children" (S3, S8).

### #132 Attemanya: official (score 4)
Sunrise 05:03, sunset 18:56. Simanu 25 (9 Jul), 20–40 °C.
- **Fine:**
  - Up at 04:52, and breakfast with a household of seven.
  - An inspection round of the gate hall, 08:39–09:36.
  - The official building 09:54–15:01, with bread at midday.
  - Supper at 18:23, and bed at 21:44.
- **(a) Not an official's hours:**
  - `07:03–08:06 craft @ h:1106 — mending tools and baskets`. He heads a house with two servants (44 and 24).
  - `15:13–18:11 gamble @ lane:q_pw_n — knucklebones in the lane`: 2 h 58 min out of doors through the hottest part of a 40 °C day.
- **Minor:** the office day is 5 h 08 min of `talk`. No tablet, seal or scribe appears, while both store scribes in this sample write and seal.
- **After scoring:**
  - His wife and daughters sleep through the heat 12:42–15:18 (their plans).
  - The craft comes from `homeHours`' men's weights: craft 0.2 for every man, whatever his standing (l. 962) (S7).
  - The lane block comes from `evening()` (l. 1357). A 40 % draw sends a man to the lane "until supper − 0.2" in one block, with a wet check but no heat, dust or length check. `homeHours`' own lane choice has heat and dust checks (ll. 957–958).
  - On days 84, 101 and 126 (37–40 °C), 5.0–5.8 % of about 13,700 town and plain men spend 2 h or more in the lane between 13:00 and 17:00. Some builders stay from 13:06 to 18:05 (S5).

### 1906 Muzraaya: boy of 8, town (score 4)
Sunrise 06:53, sunset 17:06. Arahsamnu 26 (5 Dec), −1–14 °C.
- **Fine:**
  - He eats and sleeps with his mother, and walks with her to the Treasury workshop ws:1 (3 min).
  - Home at 15:00, where she grinds and bakes.
  - Supper at 16:17, and bed at 19:00.
- **(a) A boy of 8 kept like a small child:**
  - `06:57–12:00` and `12:31–15:00 play @ ws:1 — playing near the mother`: 7 h 32 min at her workplace with no task and no other child.
  - Then `16:44–19:00 play — playing nearby while the mother talks`.
  - No water, fuel or errand. In this sample a boy of 6 runs an errand to a neighbour, and the girl of 11 and the boy of 13 fetch fuel and water.
- **After scoring:**
  - His mother (51) works wood in the Treasury workshop.
  - `child()` (population.ts:1960–1985) takes a child of 8 or under along when the mother goes out, if no one minds him. Below `minded_until_age` (8) he is not left at home without a grown-up minder.
  - It uses the start-of-year age: he is 7 by `p.age` and 8 on the day (S3).
  - His brother of 11 (1912) is at home most of the day. He is there 08:27–16:11 except for a fuel run and a friend's house, and he eats "breakfast with the household" alone at 07:53.
  - A brother does not count as a minder. Only the house's designated minder aged 9 or more, or a member aged 14 or more, counts.
  - Q-061's working value is "children under eight go with the mother to her work when no grown-up stays at home", so the rule itself is logged. It is applied here to a boy of eight.

### 39742 Ratukka: girl of 13 months, plain (score 4)
Sunrise 05:46, sunset 18:13. Abu 30 (11 Sep), 18–38 °C.
- **Fine:**
  - Asleep beside the mother, with two night feeds (01:23, 04:56).
  - Naps in the heat, and asleep at 17:50.
- **(a) Faults as scored:**
  - "In the mother's lap" or "asleep in the mother's lap" from 06:41 to 17:50, 11 h. She is never set down, never crawls or walks, and is never with her sisters of 11 and 8.
  - Nine feeds, and no food at all: `rest — in the mother's lap at the meal` at all three meals. At 13 months a child eats from the family's bread as well as the breast.
- **After scoring, three causes:**
  1. **The mother is recovering from sickness.**
     - Her plan reads `a little food brought to the sick`, `sitting up, recovering` and `sitting up with the household`.
     - The child's line drops the reason (S8). A mother sitting up all day explains the lap.
  2. **The child is planned as an infant.**
     - `small()` tests `this.p.age === 0` (population.ts:1512), her start-of-year age. She is 1 on the day.
     - So the toddler rules never apply: `lives.json` has 2–4 day feeds, meals and play for them (S3).
  3. **Her sister of 11 is the house's minder.**
     - The sister is `minding the little ones, the youngest on her hip` 07:03–08:23.
     - For the same hours the girl's own line has her `in the mother's lap` (S2).
  - Even with the reason restored, the day puts the child in two places at once.

### 2868 Utira: boy of 13, town (score 4)
Sunrise 06:55, sunset 17:04. Kislimu 3 (11 Dec), −3–10 °C.
- **Fine:**
  - Brushwood carried in for the morning fire, and water from the well.
  - A 2 h 24 min fuel run: 44 min out, 55 min gathering, 45 min back.
  - A measure of barley exchanged for oil.
  - Play by the garden channels and in the lane, supper, and bed at 18:26.
- **(a) Minding that does not fit the house:**
  - `08:05–08:57` and `12:55–14:46 rest — minding the little ones, the youngest on his hip`, 2 h 43 min in all.
  - He is a scribe's elder son, in a house where his mother is at home spinning, grinding and weaving and a man servant of 43 lives.
  - "The little ones" is one child, his sister of 2.
- **After scoring:**
  - He is the house's minder, because it has no girl of 9 or more.
  - In both spells the youngest is not with him:
    - 08:05–08:57: she is with the mother at home until 08:20, then with her at Mišišmarduka's house (08:26–09:46);
    - 12:55–14:46: she is asleep in the mother's care 12:40–14:13, then playing near her.
  - So "on his hip" is a child who is elsewhere or asleep (S2).

### 234 Maza: girl of 11, town (score 4)
Sunrise 06:01, sunset 17:58. Addaru 19 (26 Mar 466), 2–18 °C.
- **Fine:**
  - Brushwood in for the fire, and breakfast.
  - 2 h 04 min of spinning in two spells.
  - Play in the lane and at home.
  - A friend's house 15:19–16:54, supper, and bed at 19:08.
- **(a) The hip:**
  - `12:16–15:16 rest — minding the little ones, the youngest on her hip` (3 h), and `07:31–08:39` the same.
  - The house has one little one, a brother of 3. A child of 3 is not carried on the hip for three hours.
- **After scoring:** in neither spell is he with her.
  - 07:47–09:22: he is at the canal with the mother, who is washing.
  - 12:19–14:15: he is asleep at home in the mother's care.
  - 14:18–15:21: he is in the lane with the mother while she spins.
  - So the brother "on her hip" is at the canal, asleep, or out with his mother (S2).

### The twelve 5s, in one line each
- **#81 Dariya** (guard, 20; Aiaru 27):
  - The last of a night watch at apa_w. The patrol man relieves him at 03:55 for bread at the hearth, and he is back at his post at 04:29.
  - Relieved at 06:07, breakfast, and sleep to 13:01.
  - The afternoon with his wife of 17 and the baby, knucklebones at the hearth, and bed at 20:19.
  - Quibble: two meals 2 h apart (04:05 and 06:10).
- **#2 Daddama** (guard, 41; Arahsamnu 11, rain 9.8 mm):
  - The wet day at the hearth: talk, rest, knucklebones. No family visit in the rain (after scoring: the planner's `rainIn` check, population.ts:1779).
  - A meal, a sleep 17:14–21:26, bread and water, then on post at gate_s1 at 22:04 with spear and wicker shield (Q-144).
  - Quibble: 10 h at the hearth.
- **#116 Dadda** (porter, 19; Nisanu 17, dust):
  - 19 sacks carried up to the Treasury store in two bouts, with waits for caravans between.
  - The camp's bread at noon, and home at 15:56.
  - The lane, knucklebones with neighbours, and bed at 21:09.
  - Quibble: the dust shows nowhere. After scoring: it hangs 10:45–17:15, and he talks in the lane 16:04–17:31 in it (S5).
- **1123 Ulkiš** (brick builder; Duzu 1):
  - Brick-laying on the N wall 05:26–12:00, and the camp's meal at the site.
  - The heat stop (E-64) and home.
  - Tools, the household, a visit to Pirnuš, and bed at 21:38.
  - Quibble: he carries a brick mould to lay bricks, where the performance has a trowel and a brick.
- **654 Nutibel** (labourer; Addaru 19):
  - The earth ramp 06:22–12:00, and the camp's meal.
  - Column drums at the yard until 15:30.
  - Knucklebones in the lane, and bed at 19:14.
  - Quibble: "(the household eats later)" in a house of six builders who all go to work (S8).
- **2956 Belpakka** (store scribe, 50; Abu 7):
  - Breakfast of the new bread (after scoring: his wife kneaded and baked 04:21–05:31).
  - Writing and sealing tablets 07:27–15:30 with the midday meal at the store.
  - The men of the lane, supper, and bed at 20:04.
  - Quibble: mending baskets from 04:40, before civil dawn (S7).
- **290 Ušema** (homemaker, 31; Arahsamnu 6):
  - Night feeds for a baby of 2 months at 01:48, 04:12 and 21:16, and six by day.
  - Three spells at the quern (2 h 29 min).
  - A visit to Hišmapirsu, and spinning with the women outside the door.
  - The fire at 16:17, supper, the evening water at sunset, and bed at 19:01. The best day in the sample.
- **18919 Turpiš** (farmer, 15; Duzu 29):
  - Threshing with the animals from 05:52 (E-43, days 43–141). He does not winnow at 1 m/s (Q-141).
  - The carried bread eaten at the floor.
  - A sleep in the shade 11:04–15:28, then turning the straw.
  - The animals, and a visit to Akkina.
  - After scoring: his mother baked the new bread 03:15–04:10.
- **21762 Dattanna** (boy, 3; Tebetu 18):
  - With the mother at home, in the lane and at the well.
  - A 2 h nap, and an hour in the lane with the neighbours' children, "the older ones watching the small".
  - Bed at 17:05. That is a 13.5 h night, long, but the winter night is 13.6 h.
- **30948 Pirratukka** (boy, 6; Addaru 2):
  - A measure of barley carried to a neighbour and oil carried home.
  - Play in the courtyard and the lane, three meals, and bed at 18:33.
- **33598 Udusana** (elder, 67; Shabatu 25):
  - Grinding in two spells, a small exchange in the lane, the midday meal, an afternoon sleep, 47 min of spinning and the grandchildren.
  - Quibble: "a little grinding" is 1 h 44 min, as in round 3's elder.
- **14498 Tešaka** (farmer, 38; Kislimu 29):
  - Ploughing and sowing on the last day of E-40's window (months 7–9).
  - The midday bread brought out by a child of the house.
  - An exchange in the lane at dusk, and bed at 19:30.
  - Quibble: a −4 °C dawn, so the ground would be frozen at 07:38.

## Systemic findings

Severity:
- **blocking**: caused a score below 4 in this sample;
- **high**: a §9.5 fault, where the plans or the performance contradict themselves;
- **medium**: lowered days to 4 here, and could fail a day on another draw;
- **low**: labels, the tool, or rare.

**S1. Rain shelter in the open field, for as long as the rain lasts.** Severity: **blocking** (21408).
- **How it happens:**
  - `ptask` (population.ts:648), the men's field-work branch, has no wet check. The other-work branch after it (ll. 650–658) and the canal branch (l. 639) have none either.
  - The ploughing branch (l. 641) has `!C.wx.wet`. Builders are rained off at `rainH > 5` (`builderAvailable`, l. 792).
  - So on a wet morning a farming man still walks out to his field.
  - `workBlock` (ll. 1414–1415) then plans `shelter` for the whole rain span "at the place". On the Terrace that is under the Gate's roof. Everywhere else it is the field, canal, orchard, vineyard, pasture or open ground itself.
  - The performance note (`activities.ts` `shelter`) is "waiting out rain under a roof".
- **Measured** (seed 1, all 28 wet days; town and plain people who shelter at an open place):
  - 22 days with rain in the day hours;
  - 86 to 10,852 people a day, about 40,100 person-days in all;
  - mean spells over 4 h on 10 days (day 3: 5.58 h; day 13: 5.73 h; day 292: 4.43 h for 5,059 people; day 329: 4.63 h for 10,852).
  - The biggest days are in months 10–12, when the field branch sends the most men out. In months 7–9 the ploughing branch keeps them home.
- **Fix:**
  - In `ptask` (population.ts:639, 648, 650–658), give the field, canal and other-work branches the ploughing branch's wet test, or test the rain in the work window. A rained-off man then gets the day's home work (`home_hours.farm_chores`).
  - In `workBlock` (l. 1415), when the place has no roof and home is within about 0.5 h, walk home for any rain longer than about 0.5 h ("home out of the rain"), and come back, or end the block, when it stops.
  - Keep "shelter at the place" only for a place with a roof, or say what it is ("under the plane tree at the field edge").

**S2. Minding the little ones is planned without the little one.** Severity: **high** (§9.5). It lowered 234, 2868 and 39742 to 4 here, with their other faults.
- **How it happens:**
  - In `child()`, the `mind` chore (population.ts:2024–2025) writes "minding the little ones, the youngest on her/his hip" (age 10 and over) or "… in the courtyard, playing with them" (under 10) into the minder's own day. It never looks at the little one's plan.
  - The little one's plan (`small()`, ll. 1499–1575) follows its mother. It is handed to a sibling only when the mother is away (the `mBlocks` logic).
- **Measured** (seed 1, days 21, 101, 181, 261 and 341; every town and plain child with a "minding the little ones" segment and a child aged 4 or under in the house):
  - 2,797–3,851 minders, and 7,048–12,155 h of minding a day.
  - For 22–31 % of that time no little one of the house is at the minder's place.
  - For another 45–77 %, the little ones there are, by their own lines, with their mother at that place.
  - The share in which a little one is at the minder's place and not in the mother's care is 4 %, 31 %, 13 %, 2 % and 1 % on the five days.
  - Of the "on the hip" time, the little one is asleep for 6 % (day 101) and 29 % (day 341).
- **In the sample:**
  - 234: the brother is at the canal, asleep, or in the lane with the mother.
  - 2868: the sister is at a neighbour's with the mother, or asleep.
  - 39739, 39742's sister: the toddler is "in the mother's lap" at the same hours.
- **Fix:**
  - Plan the minding from the little one's side. In `small()`, give a spell to the house's minder (`with = minder`) when the mother works at home or goes out.
  - Write the minder's `mind` segment only for those spells. Otherwise give the minder another chore.
  - Say "on her hip" only for a child of 2 or under who is awake and with her. Use "the little one" or "the little ones" by count.
  - Add a cross-check to `src/people/planCheck.ts`: a "minding" segment must have a little one of the house at the same place, `with` the minder.

**S3. People are planned on their start-of-year age.** Severity: **medium** (39742, 1906).
- **How it happens:**
  - The headers print `ageOn(pid, d)` (population.ts:558), which counts the year's birthdays.
  - The planners test `p.age`, the age at the start of the year. Examples:
    - `child()`: `age = p.age` (l. 1902);
    - `small()`: `inf = this.p.age === 0` (l. 1512), and the toddler tables by `this.p.age` (ll. 1566–1570);
    - the "under 7" test behind "minding the children" (l. 938);
    - the minder and kid choices in `hday` (ll. 592–594, 607).
  - About 120 age tests in population.ts use `.age`.
- **Measured** (seed 1):

  | day | planned as infants (start-of-year age 0) | of whom 1 or older on the day | 8 on the day | of whom planned as 7 |
  |---|---|---|---|---|
  | 148 | 1,588 | 662 | 1,138 | 513 |
  | 233 | 1,562 | 1,019 | 1,185 | 807 |
  | 301 | 1,529 | 1,268 | 1,175 | 1,008 |

- **Effect:**
  - Late in the year, most children planned as infants are toddlers of 12–23 months. They are nursed every 1.6–2.8 h, never eat at meals, and never walk or play (39742). Toddler rules exist (`infant_care.toddler_day_feeds` 2–4) but reach them only in the next year.
  - Children just past a threshold keep the younger age's day (1906: a boy of 8 minded like a 7-year-old).
- **Fix:** use `P.ageOn(pid, d)` in every planner age test (child, small, homeHours, hday, minder choice, the chores and training ages). For infants, use the age in days (`ageD`, already computed at l. 1530), so the toddler rules start at 12 months.

**S4. A guard's gap meal is set at the hearth beside his breakfast.** Severity: **medium** (#9).
- **How it happens:**
  - `meals()` (population.ts:1228–1231) fills a gap of more than 7 h with bread and water.
  - For a guard, `hearthOnly` requires the meal at a hearth whenever any hearth segment lies in the gap. This came from round 4's S10 fix for a meal eaten in the forecourt wind.
  - When the only hearth time is the 0.3 h of leisure before a family visit (l. 1780), the meal lands at the gap's edge, 26 min after breakfast. The gap stays open, so a second pass puts another meal at the family's house.
- **Measured:** 53 of 887 guard-days (6.0 %) on days 21, 61, 101, 133, 181, 221, 261, 301 and 341 have a second meal within 30 min of the first. The pattern is "breakfast / bread and water", or "a meal before the watch / bread and water".
- **Fix:**
  - Take `hearthOnly` only when the hearth time splits the gap into halves within the limit. Otherwise eat where he is: his family's table counts as a meal with them.
  - Never insert a meal within 1 h of another.

**S5. The evening lane ignores the heat and the dust.** Severity: **medium** (#132; #116 as a quibble).
- **How it happens:**
  - In `evening()` (population.ts:1357), a 40 % draw sends a man home from work to the lane until "supper − 0.2", in one block.
  - It checks only `!C.wx.wet`.
  - `homeHours`' own lane choice (ll. 957–958) checks heat, dust and storms, and children are kept in on dust days (l. 1983).
- **Measured:**
  - On days 84, 101 and 126 (40, 37 and 39 °C), 683 to 790 men (5.0–5.8 % of about 13,700 in the town and plain) spend 2 h or more in the lane between 13:00 and 17:00.
  - Builders home from the E-64 heat stop sit there from 13:06 to 18:05.
  - On the dust day 17 (dust 10:45–17:15), the porter #116 talks in the lane 16:04–17:31.
- **W-03's effects are not visible anywhere in the sample.** Nobody covers a face, and the porter's walks take 25 min both ways on the dust day.
- **Fix:**
  - Give the evening lane `homeHours`' tests: no lane in dust, and none before about sun.set − 2.5 h in the E-64 months.
  - Cap the block at 0.8–2 h and fill the rest with `homeHours`.
  - Show W-03 in the carrying or clothing field ("the face wrapped against the dust").

**S6. The camp's flour is carried to the querns.** Severity: **low** (#123).
- The camp's `flour` task (population.ts:1889) plans three trips "down to the depot for flour" and "carrying a sack of flour up to the camp", with the destination `querns`.
- `onTerrace` (sim.ts:265–268) sets the sack down at the plan's place.
- The ovens, where flour is used, are not visited, and the carrier then grinds grain at the querns.
- **Fix:** carry the flour to `oven` ("up to the bakers"). Or make the sack grain for the querns, which fits a grinder.

**S7. Men's hours at home are blind to standing and to the light.** Severity: **low** (#132; 2956 as a quibble).
- `homeHours` draws craft ("mending tools and baskets") at weight 0.2 for every man (population.ts:962).
- So an official with two servants mends baskets for an hour (#132), and a store scribe does so from 04:40, before civil dawn (2956).
- **Fix:**
  - For a household of standing (`P.standing`), replace craft with the household's affairs, a caller or a visit.
  - Start no craft before about sun.rise − 0.45 h.

**S8. Labels.** Severity: **low**. Recurs from round 1 C10, round 2 N7, round 3 S11 and round 4 S10.
- "The little ones, the youngest on her/his hip" for one child (234, 2868; population.ts:2024–2025).
- "Minding the children" for one child (#123; l. 938, where the test also uses the start-of-year age).
- "(The household eats later)" in a house of six working builders (654; l. 1316 tests only that the house has more than one member).
- "Breakfast with the household" for a boy of 11 eating alone at 07:53 (1912, 1906's brother).
- The toddler's line drops the mother's sickness: "in the mother's lap" against the mother's "sitting up, recovering" (39742). Round 3 found the same kind of dropped reason (27049's birthday meal).
- `shelter` — "waiting out rain under a roof" — performed in an open field (S1).

**S9. Thin name pools.** Severity: **low**. Recurs from round 4 S8.
- 1906 is Muzraaya, the one name given to all 241 Egyptian men of seed 1 (round 4, S8).
- Pirratukka and Ušema, both round-4 sample names, recur here in other people.
- **Fix:** as in round 4. Cap repeats per quarter, or name people as the tablets often do, by ethnic label or by father, and log the choice.

**S10. The sun's times are geometric.** Severity: **low**.
- `sunTimes()` (src/people/calendar.ts:30–34) puts the sun's centre on the horizon, with no refraction or semi-diameter, and uses today's obliquity (23.44°) in a cosine declination.
- Against the apparent sun (h₀ = −0.833°, the epoch's obliquity of about 23.76°), the sim's sunrise is 3–6 min late and its sunset 4–7 min early on all 20 days.
- Plausibility is not affected, but the waking and dusk rules key off these times. Round 4 found the same difference.
- **Fix:** h₀ = −0.833° and the obliquity of 467 BCE.

**S11. Tool and coverage.** Severity: **medium** for §9.5's on-screen check; **low** for the rest.
- **Fixed since round 4:**
  - The shadowed agent now walks the nav grid in the full LOD.
  - Each detailed day runs in a fresh simulation.
  - Every change is logged with no elision.
  - Days are drawn over 0–353.
  - The pick is stratified.
- **The on-screen check is still mostly unmade.**
  - Only the detailed agents on the Terrace are drawn (`visibleAgents`, sim.ts:521–523; the crowd's header). The population is "NOT RENDERED [PLACEHOLDER: D-024]" in the dev overlay.
  - So 84.5 % of the sample's hours can only be read as plans (see Placeholders).
- **Coverage:**
  - This sample reaches the town (five households), the Terrace gangs of the population (a brick builder and a labourer), a porter, a work-camp woman and an official.
  - Not sampled: herders, travellers, couriers, priests, masons, bakers, a leader of ten, a grain-heap vigil and a baby under four months.
  - So round 4's S2–S5 (the vigil, the leader's first round, the herders and the infants' waking) are neither confirmed fixed nor seen again.

## Placeholders (not scored)

- **Activities without a performance: none.**
  - `ACTIVITIES` (src/people/activities.ts) flags no activity as a placeholder, and `ABSTRACT_PLACEHOLDERS` is empty (D-142, per the file's header). The tool prints no `[PLACEHOLDER]` tag.
  - Rounds 1–4 counted 43–50 h of unperformed activity. Here, by the flag, 0 h.
- **But most of the sample is never drawn:**

  | person | hours drawn | hours not drawn | why |
  |---|---|---|---|
  | #2 | 24 h 00 min | 0 | the whole day on the Terrace |
  | #81 | 19 h 00 min | 5 h 00 min | the family visit in the town (`offmap`) |
  | #9 | 12 h 48 min | 11 h 12 min | the family day in the town |
  | #116 | 9 h 48 min | 14 h 12 min | the night, the evening and the lane in the town |
  | #123 | 7 h 46 min | 16 h 14 min | her home, her quern and the well in the town |
  | #132 | 1 h 13 min | 22 h 47 min | everything but the gate-hall inspection; the official building is in the town |
  | the 14 population people | 0 | 336 h | the population is not rendered (dev overlay: "NOT RENDERED [PLACEHOLDER: D-024]") |
  | **total** | **74 h 35 min (15.5 %)** | **405 h 25 min** | |

- **The Terrace's own work goes undrawn.** 1123's brick-laying on the Hall of 100 Columns wall and 654's ramp and column drums (7 h 09 min and 9 h 08 min on the Terrace) are planned for the Terrace but drawn by nobody. The overlay counts them as "more on the Terrace NOT RENDERED".
- The `offmap` performance's note still reads "in the town (not rendered until the settlement exists, Phase 6)".
- The `train` performance's note says riding is not performed. It is not in this sample.
- §9.5 ("everything is exactly where the simulation says it is") therefore holds only for the Terrace hours of the detailed agents.

## Checked in code after scoring

These checks came after the scores were fixed. None changed a score.

- **Earlier rounds:** round 1 (its header, "Read first" and cross-cutting findings), round 2 (its cross-cutting findings), round 3 in full and round 4 in full. See the recurrence table below.
- **Scratch scripts.** They are read-only and sit in the session scratchpad, outside the repo. Each imports `tools/shadow_days.ts` (`freshSim`) and builds the seed-1 simulation as the tool does; none writes a file.
  - **q1:** 21408's day. The hourly rain on day 292 (0.45 from 06:52 to 12:22; the rain span [06:30, 13:00], `rainH` 6.5), his plan, the walk to the field (5 min), and the plans of his wife and father.
  - **q2:** the open-air shelter count on all 28 wet days (S1).
  - **q3:** the plans and households of #9, #81, #123, #132, 1906, 39742's mother and sisters, 2868's household, 234's household, and 2870 and 235, the little ones minded.
  - **q4 and q4b:** the minders' "minding the little ones" against the little ones' own lines on days 21, 101, 181, 261 and 341 (S2).
  - **q5:**
    - guards' second meals within 30 min, over 887 guard-days (S4);
    - men 2 h or more in the lane at 13:00–17:00 on the 37–40 °C days (S5);
    - start-of-year against day ages (S3);
    - the dust hours of day 17;
    - 654's household.
  - **q6:** the baker of "the new bread" in the five households that ate it (2956, 18919, 14498, 33598, 21408). Every one had a baker that morning.
  - **sun.py:** an independent sun (low-precision solar longitude, the epoch's obliquity, h₀ = −0.833°, 29.935° N) for the 20 days (S10). It imports nothing from the project.
- **Code read:**
  - `ptask`, `builderAvailable`, `workBlock` and the `shelter` performance (S1);
  - `child()`'s `mind` chore and `small()` (S2);
  - `ageOn` and the planners' age tests (S3);
  - `meals()` and the guard planner's `leisure` and `free` (S4);
  - `evening()` and `homeHours` (S5, S7);
  - the camp woman's `flour` task and `onTerrace`'s `carry_sack` (S6);
  - `sunTimes` and `dayWx` (S10);
  - `visibleAgents`, the crowd's header and the tool (S11).

## Earlier rounds: do their findings recur?

| earlier finding | status in this sample |
|---|---|
| R1 C1: meals inverted, workers unfed | **Not seen.** Everyone eats 3–5 times. The new fault is the opposite: a guard's two meals in a row (S4). |
| R1 C2: plain children never sleep | **Not seen.** All children sleep at night, and the small ones nap. |
| R1 C3: infants fed only at meals | **Fixed.** 290's baby of 2 months is fed on demand, day and night. The 13-month-old is fed as an infant (S3). |
| R1 C4: marriage takes mothers away | **Not seen.** |
| R1 C5: household demography | Plausible where seen (39742's sisters are 11 and 8, her brother 4). |
| R1 C6: households do not eat together | **Fixed** where checked (21408's household at 06:52, 12:09 and 16:24). One boy eats "with the household" alone (S8). |
| R1 C7, R2 N4, R3 S9, R4 S4: clockwork templates | **Not seen.** Meal lengths and wake times vary. No herder or traveller was sampled. |
| R1 C8: work hours against E-60 | **Holds:** the gangs work from dawn to mid-afternoon, or stop at noon in the heat (1123, 654). |
| R1 C9, R2 N6: weather | **Rain recurs in a new form: shelter in the open field (S1).** Wind is handled (18919 does not winnow at 1 m/s). Heat is handled at work, but not in the evening lane (S5). Dust is not visible (S5). |
| R1 C10, R2 N7, R3 S11, R4 S10: labels | **Recurs** (S8). |
| R1 C11, R2, R3 S1, R4 S12: the tool | **Largely fixed** (full LOD, fresh sims, no elision, full day range, stratified pick). The population is still not rendered (S11, Placeholders). |
| R2 N1: older children on a play template | **Not seen for 11–13.** 234 and 2868 work, though their minding is phantom (S2). **Recurs in another form** for a boy of 8 kept beside his mother (1906, S3). |
| R2 N2: the motherless household | **Not sampled.** |
| R2 N3: harvest ahead of the sources | **Fixed.** Threshing on day 118 falls in E-43 (days 43–141), and ploughing on day 265 in E-40 (months 7–9). |
| R2 N5: 2-min patrol legs | **Not sampled** (no patrol man). Post walks take 1–3 min. |
| R2 N8: nothing carried | **Fixed.** Arms, sacks, jars, fuel, oil, tools and bread are carried. One flow is backwards (S6). |
| R3 S2: the detailed tier drops a planned meal | **Not seen.** #81's relief meal happens as planned. |
| R3 S4: a toddler teleports home | **Not seen.** 21762 walks home with the lane children. |
| R3 S5: nursing replaces drawing water | **Not seen.** 290 draws water at 17:05, then nurses at home at 17:23. |
| R3 S6: carried bread vanishes | **Fixed.** 18919 and 21408 eat what they carry out. |
| R3 S7: bread nobody baked | **Fixed.** All five "new bread" households had a baker (q6). |
| R3 S8: riding for every Persian boy | **Not sampled.** |
| R4 S1: a farming man idle at home | **Not seen.** The three farmers thresh, plough, and (21408) go out to the banks, where the rain is the fault (S1). |
| R4 S2: the vigil ends at bedtime | **Not sampled.** The code now plans a sleep at the floor (population.ts:2419–2430; not verified in a run). |
| R4 S3: the leader's change-of-watch round | **Not sampled.** |
| R4 S4: the herders' template | **Not sampled.** |
| R4 S5: infants awake while the mother works | **Not seen** for 290's baby, which is not shadowed (the mother is). The 13-month-old naps three times (S3). |
| R4 S6: a hoe for the threshing floor | **Fixed** where seen: a winnowing fork (18919). The child's floor work is now `thresh` (population.ts:1916). |
| R4 S7: thin winter days for women | **Fixed** where seen: 21408's wife spins about 3 h on a February morning, and 2868's mother spins, grinds and weaves. |
| R4 S8: name pools | **Recurs** (S9). |
| R4 S9: village sizes | **Recurs.** 18919, 21408 and 21762 all live in v_14 (4,247 people, one well, one floor, one lane in round 4). Not re-measured. |
| R4 S11: placeholders | **Fixed by the flag:** 0 h unperformed. But 84.5 % of the sample is not drawn (Placeholders). |

## What holds up

- **The garrison.**
  - Night watches from 22:00 with a sleep before them.
  - A bread relief by the patrol man in the small hours (#81).
  - Sleep after the watch until 13:00.
  - Family visits in the town, with the walk down and up (22–31 min).
  - The rain keeps a man at the hearth (#2).
  - Arms by origin (Q-144): the Persian with spear and wicker shield, the Medians with spear, bow case and short sword.
- **Sleep fits the sun.**
  - Adults rise 0.3–1.5 h before sunrise and go to bed 1.3–3 h after sunset.
  - Small children sleep at dusk in winter.
  - The heat brings long siestas (18919: 4 h 24 min in the shade).
- **Season and work.**
  - Threshing in E-43's window, and no winnowing in still air.
  - Ploughing and sowing on the last day of E-40.
  - The banks mended in month 10.
  - Brick-laying in the E-63 season.
  - The E-64 stop at noon on the Terrace.
- **Goods and food.**
  - Water is drawn and carried on the head, and fuel is gathered and carried home.
  - Barley goes out and oil comes home.
  - The midday bread is carried out or brought out by a child and eaten there.
  - "The new bread" is eaten only where someone baked that morning.
  - Nursing is cut out of the mother's work (290).
- **Children by age (Q-065).**
  - At 11–13: fire, water, fuel, spinning and errands.
  - At 6: an errand.
  - At 3: with the mother, and an hour with the lane children under older ones' eyes.
- **Households** eat together, visit kin (one with a newborn), and sit with the women outside the door.
- **Names** are attested and matched to origin (EWB, tier B), within thin pools (S9).
- **No anachronism** appears in any world-facing text. "Homemaker", "placeholder" and the `post_harem_*` ids are out-of-world labels.

## VERDICT

**FAIL.** 1 of 20 people scores below 4:

| person | score | cause |
|---|---|---|
| 21408 Karkišša (farmer, 27, day 292) | 3 | out to the field in steady rain, then 5 h 02 min sheltering and a meal in the open field, 5 min from home (S1: `ptask` field branch without a wet check; `workBlock` shelter "at the place") |

- As in round 4, 1 of 20 is below 4. Earlier rounds: 10, then 3, then 3, then 1.
- Round 4's blocking cause, the idle farming man (its S1), is not seen: the three farmers here have field work.
- The new blocking cause is weather handling in the open.

**The minimum before a re-review:**
1. **Fix S1.**
   - A farming or garden task is not started in rain.
   - Rain at a place with no roof sends the person home when home is near.
   - `shelter` at the place is kept for places with a roof.
2. **Fix S2 and S3.** Neither failed a day here, but both are visible contradictions:
   - S2: the minding is written from the little one's plan, so no child is in two places;
   - S3: the planners use the age on the day.
3. **Fix S4 and S5:**
   - S4: no second meal beside breakfast;
   - S5: the evening lane checks heat and dust.
4. **Draw a fresh 20-person sample with a new pick seed,** keeping the strata. Add herders, travellers or couriers, a leader of ten, a vigil night and a baby under four months, since round 4's S2–S5 are untested this round.

- S6–S10 are not blocking. Fixing them with S2–S5 would move most of the seven 4s to 5s.
- The Placeholders section does not change these scores. But until the population is rendered, §9.5's on-screen check covers only 15.5 % of a shadowed sample (S11).
