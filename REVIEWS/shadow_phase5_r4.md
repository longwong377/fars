**VERDICT: FAIL.** 1 of 20 people scores below 4: 31224 Tuppipi (farmer, 35, day 22) **3**. He sits idle at home through a dry, mild day in the sowing month, with the barley harvest 11 days off. After scoring I found this is a designed outcome, not a code fault. About 1 farming man in 11 gets no field task on a day in Nisanu, and the fallback day is mostly rest (S1). The other 19 people score 4 (8 people) or 5 (11 people).

# Shadow review, Phase 5, round 4 (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5). I did not build or see the build of the simulation. I scored from the day timelines and the research files only, before reading any earlier round or any simulation code.
- **Date:** 2026-09-23
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick89.txt` (seed 1, pick seed 89): 6 detailed Terrace agents and 14 people of the population. Nobody who builds the simulation had seen my scores.
- **Protocol:** as written at the top of `REVIEWS/shadow_phase5_r3.md`.
- **Read before scoring:**
  - The protocol section of `REVIEWS/shadow_phase5_r3.md` only (ll. 3–33, not l. 1). Those lines also name three round-3 outcomes: #49's day was a tool fault, 27049 had a second supper, and #80 had a hidden meal. They concern the pick-53 sample, not this one. I record them for transparency. This sample's #80 is the same Karma on another day. The round-3 line about his hidden meal did not bear on my score.
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - My own sunrise and sunset for the 20 days, from a scratch script in the session scratchpad (Meeus low-precision sun, 29.935° N, −0.833° for refraction). It imports nothing from the project.
  - Two greps of `research/OPEN_QUESTIONS.md`, run after all 20 scores were drafted:
    - the first for threshing, transhumance, herders, sesame, sowing, stubble, irrigation, the grain heap, the leader's rounds, infants, nursing, spinning and idleness;
    - the second for baking, fuel, exchange, gambling, sleep, lamps, visits, camps, flocks, the harvest draft and lying-in.
    - The relevant hits were Q-057, Q-058, Q-061, Q-064, Q-065, Q-140, Q-141, Q-142, Q-144, Q-147 and Q-149. No score changed after them.
  - The 20 scores were then saved to a scratch file (`fixed_scores_r4.txt`, session scratchpad) before anything below was read.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5.md` (round 1), `REVIEWS/shadow_phase5_r2.md` (round 2) and `REVIEWS/shadow_phase5_r3.md` (round 3), in full.
  - `tools/shadow_days.ts` and `tools/shadow_pick.ts`.
  - From `src/people/population.ts`:
    - the day's field task, `ptask` (ll. 591–626), and `fieldWhy` (ll. 630–637);
    - `homeHours` (ll. 839–869), `carries` (ll. 976–1003) and `homeDay` (ll. 1261–1277);
    - the small child's follow and walk rules (ll. 1440–1496);
    - the guard planner and the leader's watch (ll. 1500–1600);
    - the children's lane outings (l. 1832) and the riding rule (ll. 1840–1841);
    - `farmer` with the grain-heap vigil (ll. 2168–2200);
    - the herders' day (ll. 2311–2319) and the bands' members (l. 414);
    - `hday` (ll. 551–589), `rota` (ll. 754–771) and `nameFor` (ll. 809–816).
  - From `src/people/sim.ts`: `decide` and `onTerrace` (ll. 197–327) and `roundFor` (ll. 328–337).
  - From `src/data/lives.json`: `infant_care`, `guard_rota`, `home_hours`, `postpartum_off_days` and `guard_off_day`.
  - From `src/data/events_calendar.json`: the rows E-40 to E-51.
  - Read-only scratch scripts in the session scratchpad, outside the repo, that import the simulation (q1–q5). They are listed under "Checked in code after scoring".
  - I did not read `DECISIONS.md`.
- **Score changes after reading the earlier rounds or the code:** none. Notes were added, and one of my notes is corrected:
  - I had read Q-061's "2-3 by night" as a feed every 2–3 h. `lives.json` says two or three feeds a night, and both infants meet that. The notes for 22239 and 45644 say so. Their scores stand on their other faults.
  - For 45644, a second fault also fell away after scoring. The mother's work at the canal comes after a 27-day lying-in, and it is washing.
- **Dates** are Babylonian with the Julian date: 467 BCE through Kislimu, 466 BCE from Tebetu on.
  - Sunrise and sunset in the notes are the sim's own (`DayCtx.sun`, read after scoring), in local solar time, symmetric about noon.
  - My independent figures agree within 3–6 min at each end.
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails.**
   - **31224 Tuppipi** (farmer, 35; Nisanu 22) stays at home through a dry, mild day in the sowing month, 11 days before the barley harvest: 7 h 32 min of rest in 13 h 14 min of daylight, with no cause. Score 3.
   - After scoring: a designed outcome, not a bug. Outside the harvest months, a farming household with no drawn task sends its men home for the day, and the home hours are mostly rest (S1).
2. **Placeholders.**
   - 11 of the 20 people spend part of the day in activities with no performance: 10 of the 14 population people and a detailed agent (#122), where rounds 2 and 3 found none among the detailed agents. In all **43 h 53 min**.
   - For 7 people it is the day's main work: reaping (7521), threshing (18864, 18978), herding (44309, 87 % of his waking day), the water turn and the stubble (26660), and spinning (25364, 37374).
   - `cook` ("lighting the fire for the evening meal") is new and is itself a placeholder. The fire lit at dusk (§9.2) now exists in the plans but is not performed (S11).
3. **§9.5's check is still not made.**
   - The detailed agents are still stepped in the abstract LOD (`tools/shadow_days.ts:33`).
   - The 14 population people are printed as plans.
   - Nothing in the input shows "what a person is doing on screen" (S12).
4. **A guard that isn't.**
   - The grain heaps of a village are "guarded" from about 20:45 to 22:40 and then left for the night.
   - On day 140, all 78 men sitting up at the floor of v_14 have gone home by 22:41 (S2).
   - The code's own comment says the man sleeps at the floor.
5. **Faults behind the 4s:**
   - the leader of ten's change-of-watch round walks other files' posts (S3);
   - the herders' day is one template for the whole band, asleep at sunset with nobody on the flock (S4);
   - infants stay awake through their mothers' work (S5);
   - a girl carries a hoe to drive oxen (S6);
   - thin winter days for women at home (S7).
6. **Tool (S12).**
   - The elision hid 1 h 26 min of #26's night. I checked it: nothing wrong is in it.
   - The detailed tier's output depends slightly on the order of jumps: 111 against 110 log lines for #26.
   - Printed days 1 and 352–354 can never be drawn.
   - This sample has no townsperson among the 14, and 4 of its 6 detailed agents are guards. The town's households and the Terrace gangs went unshadowed this round.

## Scores

Julian dates are 467 BCE unless marked 466.

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #52 Aššaštiya | guard, man 22, Persian | 323 (Shabatu 28, 5 Mar 466; −2–11 °C, wind 8 m/s) | **5** | An off day before the C watch: the hearth, knucklebones, the forecourt, a meal, a nap, on post at gate_s1 at 22:04. |
| 2 | #80 Karma | guard, leader of ten, man 40, Persian | 128 (Abu 10, 22 Aug; 20–40 °C) | **4** | Rounds now come at intervals with the hearth between. But the change-of-watch round walks 8 posts that are not his file's and stops short of the tenth. |
| 3 | #93 Kašunda | guard, man 36, Median | 228 (Arahsamnu 21, 30 Nov; 3–17 °C, rain 9.2 mm) | **5** | Under cover through the wet morning, then the B watch at gate_s1 with a relief for bread, supper and bed. |
| 4 | #26 Kamišdana | guard (patrol), man 35, Persian | 142 (Abu 24, 5 Sep; 21–41 °C) | **5** | Night patrol with six stand-ins while the post men eat, breakfast, sleep through 41 °C, then the hearth. |
| 5 | #122 Radušnamuya | baker, woman 26, Elamite (town) | 272 (Tebetu 6, 13 Jan 466; −1–13 °C) | **4** | A day at home from the winter halving of the gangs. Plausible, but 6 h 35 min of rest and 5 min of spinning. |
| 6 | #129 Aššamanda | child, boy 7, Persian (town) | 243 (Kislimu 7, 15 Dec; 0–15 °C) | **5** | An errand (barley for oil), play in the lane, three meals, bed after dusk. |
| 7 | 25364 Nisuka | homemaker, f 17, Persian (plain) | 201 (Tashritu 24, 3 Nov; 7–25 °C) | **5** | Kneads and bakes before dawn, grinds, spins 3 h 32 min, the women at the door, the evening water. |
| 8 | 26660 Šatitikaš | farmer, m 31, Elamite (plain) | 150 (Ululu 2, 13 Sep; 18–39 °C) | **5** | The household's turn of water and the stubble cleared before the heat, then home. |
| 9 | 44309 Pirratukka | herder, m 39, Persian (transient) | 189 (Tashritu 12, 22 Oct; 11–30 °C) | **4** | A migration day in outline. But he is asleep at sunset 36 min after reaching camp, nobody watches the flock, and the band has no child under 10 and no elder. |
| 10 | 10496 Hubuda | child, f 4, Persian (plain) | 163 (Ululu 15, 26 Sep; 12–31 °C) | **5** | With the mother to the lane and the well, a nap, then out with her sister of 8 and home before dusk. |
| 11 | 18904 Budakka | homemaker, f 19, Persian (plain) | 255 (Kislimu 19, 27 Dec; −5–8 °C) | **4** | Quern, water twice, a visit. But 7 h 14 min of rest and 25 min of spinning in midwinter. |
| 12 | 24457 Kaputtiš | child, f 4, Persian (plain) | 298 (Shabatu 3, 8 Feb 466; −2–11 °C) | **5** | With the mother at home, on a visit and at the well; a nap; bed after dusk. |
| 13 | 18978 Tirima | child, f 10, Persian (plain) | 104 (Duzu 15, 29 Jul; 20–39 °C) | **4** | Fuel carried in before dawn, the oxen driven round the floor, a heat sleep, friends' houses. But she carries a hoe to drive the animals "with a stick". |
| 14 | 22239 Budakka | infant, f 2 months, Persian (plain) | 30 (Aiaru 1, 16 May; 19–38 °C) | **4** | Always with the mother and fed 10 times. But she is awake 06:18–11:54 and asleep only about 11 h. |
| 15 | 7521 Duttukka | farmer, m 44, Persian (plain) | 35 (Aiaru 6, 21 May; 14–33 °C) | **5** | Barley harvest from sunrise, bread at the field edge, sleep at noon, reaping again, mending, knucklebones. |
| 16 | 37374 Ušema | elder, f 59, Persian (plain) | 299 (Shabatu 4, 9 Feb 466; −2–11 °C, dust) | **5** | Light work, rest, a sleep and the grandchildren, indoors on a cold, dusty day. |
| 17 | 31224 Tuppipi | farmer, m 35, Elamite (plain) | 22 (Nisanu 22, 8 May; 10–28 °C) | **3** | Idle at home 07:19–12:08 and 14:02–16:18 on a fine day in the sowing month, with no cause. |
| 18 | 18864 Battinaša | farmer, m 21, Persian (plain) | 140 (Abu 22, 3 Sep; 20–39 °C, wind 1 m/s) | **4** | Threshes without winnowing in still air, which is right. But he naps "for tonight" and then sits only 90 min by the grain heap. |
| 19 | 41211 Iššante | child, m 11, Persian (plain) | 149 (Ululu 1, 12 Sep; 18–38 °C) | **5** | Animals, an errand, fuel twice, water twice, minding the little ones, rest through the heat. |
| 20 | 45644 Harsukka | infant, f 0 months, Persian (plain) | 340 (Addaru 15, 22 Mar 466; 4–20 °C) | **4** | With the mother, 8 feeds. But she is awake 08:17–11:54, and a newborn is carried to the canal and the well. |

Distribution: 5 → 11 people; 4 → 8; 3 → 1. **1 of 20 is below 4** (round 1: 10 of 20; round 2: 3; round 3: 3).

## Notes for every score below 5

The failing day first, then the others in table order.

- **(a)** marks implausible behaviour and **(b)** a tool or sampling fault.
- Placeholders are listed separately; they do not enter the score.
- "After scoring" marks what I found in the code or the earlier rounds once the scores were fixed. It never changes a score.

### 31224 Tuppipi: farmer, month 1 (score 3)
Sunrise 05:23, sunset 18:37. Dry, 10–28 °C, wind 4 m/s. Nisanu 22 (8 May). E-44, the spring sowing of the summer crops, covers all of month 1. The barley harvest (E-41) starts on day 33, 11 days on, and the wheat is still standing.
- **Fine:**
  - Up at 04:56 to see to the animals.
  - Breakfast with the household at 05:53.
  - An early call on Ašbezza (06:13–07:16).
  - The animals again after the midday meal.
  - Supper at 18:03, an evening visit to Barsara (18:36–19:43), and bed at 20:50.
- **(a) A working man idle through a working day.**
  - `07:19–12:08 rest @ h:7302 — at home` (4 h 49 min), `14:02–16:18 rest — resting at home` (2 h 16 min) and `17:36–18:03 rest`. That is 7 h 32 min of rest, plus 1 h 18 min of talk at home, in 13 h 14 min of daylight.
  - It falls on a dry, mild day in the one month EVENTS gives to sowing.
  - No cause shows. There is no sickness, rain, feast, mourning or draft, and those are the causes Q-057 lists for a day without work.
  - Apart from the animals he does none of the things a farmer does in the last days before a harvest: mending tools and sickles, readying the threshing floor, fodder, the garden or the vines.
  - A visitor following him would ask why he is not in the fields, and the day gives no answer.
- **Placeholder:** `tend_animals` 2 h 19 min.
- **After scoring:**
  - The household's field task is null. `ptask(7302, day 22)` saw E-44 active, but the 80 % draw to sow missed, the one-day-in-six water turn missed, and the 50 % draw for `field_work` (`field_fraction_adults_by_day.spring`) missed.
  - `farmer()` then returns `homeDay('at home')` (population.ts:2175). Its hours come from `home_hours.men`: rest 0.35, craft 0.2, animals 0.2, talk 0.15.
  - On day 15, 871 of 9,969 farming men (9 %) have such a day, and their mean daylight rest is 4.0 h. Tuppipi is at the tail.
  - His wife's plan is a full one: water, the quern, spinning and minding the children.
  - So the fault is in the design of the no-task day, not a bug (S1). The score stands.

### #80 Karma: leader of ten, A watch (score 4)
Sunrise 05:29, sunset 18:31. Abu 10 (22 Aug), 20–40 °C.
- **Fine:**
  - Up at 04:58, breakfast before the watch, and "readying" at 05:38.
  - Rounds at 06:00, 08:31, 10:28 and 12:30, with the hearth between: talk with the off men of his file, rest, and bread and water at 09:06.
  - A meal after the watch at 14:00, then the afternoon at the hearth (rest, talk, knucklebones), supper at 18:27 and bed at 20:16.
  - Round 3's fixed 16-post loop is gone.
- **(a)/(b) The change-of-watch round is not his file's.**
  - `06:00–06:47 … going round his file's posts after the change of watch` visits treas_1, treas_2, harem_1, harem_2, hadish_2, hadish_1, tachara_1, tachara_2 and apa_w.
  - It then sets off for gate_s1 (`06:46 patrol → post_gate_s1`) and turns back to the hearth at 06:47 without arriving.
  - The later rounds visit harem_2, gate_s2, gate_w1, stair_s, gate_w2 and stair_n (and gate_s1 at 12:42).
  - Only harem_2 is in both sets. A leader of ten has one file's posts.
- **Minor:** he has a household of five in q_pw_s and spends 14:00–20:16 at the garrison hearth.
- **After scoring:**
  - `roundFor` (sim.ts:330–337) lists the posts where a detailed agent of his own file is standing guard. At 06:00 none of his men has reached his post, so the list is empty and falls back to all 16 posts. The 0.4–0.75 h plan block then ends the round after 10 of them.
  - The rota for the day shows his file (file 8, all ten men detailed agents 80–89) holding stair_n, stair_s, gate_w1, gate_w2, gate_s1, gate_s2 and harem_2. The later rounds are right. See S3.
  - His household is his wife of 30 and children of 9, 5 and 1. On an A-watch day the planner sends a man home with p = 0.25 (population.ts:1585), so staying at the hearth is chance, not a fault.
  - The score stands.

### #122 Radušnamuya: a baker's winter day at home (score 4)
Sunrise 06:55, sunset 17:05. Tebetu 6 (13 Jan 466), −1–13 °C.
- **Fine:**
  - `rest — at home: bread for half the gang in winter: her day at home`: a day off from the winter halving of the gangs (E-62), one of the causes in Q-057.
  - She grinds at 06:06, 49 min before sunrise, draws water at the quarter's well and breakfasts at 07:24.
  - She visits Umuyarakka (07:46–09:08) and talks with the women outside the door at midday.
  - She lights the fire at 15:40 "for the evening meal and the cold night", eats supper at 16:03 (an hour before sunset) and sleeps at 18:30.
- **(a) Thin.**
  - Rest at home comes to 6 h 35 min: 06:50–07:24, 09:15–11:58, 14:15–15:40 and 16:37–18:30.
  - The only textile work is `15:58–16:03 spin`, five minutes between lighting the fire and eating.
  - A woman at home on a winter day off would spin or weave for hours.
- **Placeholders:** `cook` 18 min and `spin` 5 min. Round 3 found none among the detailed agents.

### 44309 Pirratukka: herder, a migration day (score 4)
Sunrise 06:24, sunset 17:36. Tashritu 12 (22 Oct), 11–30 °C. This is E-49's autumn passage (months 6–7).
- **Fine:**
  - Up at 06:05, before sunrise.
  - The flock moved along the plain edge all day.
  - A midday meal of bread and curds by the flock.
  - A new camp by 17:06.
- **(a) Faults:**
  - `17:42 sleep @ camp:band21:3 — asleep in camp` comes 6 min after sunset and 36 min after reaching the new camp, and camp is made and supper eaten in those 36 min. That leaves 12 h 23 min in bed, no evening at the fire, and nobody minding the flock through the night, with jackals about (PLAIN.md §7).
  - `06:05–06:29 eat — breakfast and striking camp`: a camp for 39 people struck during a 24-min breakfast.
  - 10 h 07 min of herding with one 30-min halt on a 30 °C day.
  - **Who he meets.** Household 10032 is 39 "herders" aged 10–56: 32 men and boys and 7 women, with no child under 10, no girl, nobody over 56, and five boys aged exactly 13. If this is a band on its seasonal move (E-49's analogue is the Qashqai), families would travel with it. If it is a drive crew, the women and the "household" are odd.
- **Placeholder:** `herd` 10 h 07 min, 87 % of his waking day.
- **After scoring:**
  - `herderPassing` (population.ts:2311–2319) gives every member of a band one template: sleep to sunrise − 0.3 h, 0.4 h of breakfast, herd to 12:00, a 0.5 h meal, herd to sunset − 0.5 h, 0.6 h to make camp and eat, then sleep.
  - All 39 members of band 21 have the same plan to the minute on day 189 (checked).
  - Members are drawn 80 % male and aged 10–55 (l. 414). See S4.

### 18904 Budakka: a young homemaker in midwinter (score 4)
Sunrise 06:58, sunset 17:02. Kislimu 19 (27 Dec), −5–8 °C.
- **Fine:**
  - She grinds at the quern 06:27–07:03, before sunrise, and breakfasts on "the new bread". After scoring: 18903, 39, kneaded and baked it 05:29–06:30.
  - Water at 07:47 and at 14:58.
  - A visit to Harsukka (08:49–10:25).
  - Supper at 15:50, an hour before sunset, and bed at 19:09.
- **(a) Thin.**
  - `rest` (at home, minding the children) 08:06–08:46, 10:28–11:48 and 12:22–14:58, then `rest — with the household` 16:31–19:09: 7 h 14 min in all.
  - Against that, 25 min of spinning on a midwinter day, in a house of seven with two women.
  - "Minding the children" is real work with a 4-year-old in the house, but her sister of 12 is there too. Winter is when the spinning and weaving are done.
- **Placeholder:** `spin` 25 min.

### 18978 Tirima: girl of 10 at the threshing floor (score 4)
Sunrise 05:12, sunset 18:48. Duzu 15 (29 Jul), 20–39 °C.
- **Fine, a full and well-timed day** (Q-065's "the harvest from nine"):
  - Up at 04:17 to carry in dung cakes for the morning fire, and breakfast at 04:59.
  - Four spells of driving the animals round the floor (05:21–10:30), with three rests in the shade.
  - Home at 10:30 for the midday meal and a sleep through 39 °C (11:13–15:11).
  - Bread and water and play at Hubakka's, then Hubuda's until 18:08, and home 35 min before sunset.
  - Supper, and bed at 19:45.
- **(a) What she carries.** `05:18 walk … out to the threshing floor [carrying a hoe]` and back at 10:30 with the hoe, while she is "driving the animals round the threshing floor with a stick". A hoe has no use there.
- **(b) Minor:**
  - One walk in two segments: `16:15–16:19 walk — walking` and `16:19–16:24 walk — to a friend's house`.
  - Her threshing is `field_work` while the adults' is `thresh`, so the dev overlay would show two activities for one task.
- **Placeholder:** `field_work` 4 h 18 min.
- **After scoring:** `carries()` (population.ts:1000) gives any walk to a `field_work` job "a hoe", and the child's threshing is planned as `field_work` (S6).

### 22239 Budakka: infant of 2 months (score 4)
Sunrise 05:18, sunset 18:42. Aiaru 1 (16 May), 19–38 °C.
- **Fine:**
  - With the mother all day and night.
  - 10 feeds: 01:11, 04:19, 05:23, 07:20, 09:23, 11:35, 14:10, 16:57, 19:16 and 21:34.
  - On her back to the lane and twice to the well.
  - The mother rises at 03:24 to knead and bake before a 05:33 breakfast (it is a baking day, and the plan says "the new bread").
- **(a) Faults as scored:**
  - Awake 06:18–11:54 (5 h 36 min, three feeds, no sleep) and 17:07–20:17 (3 h 10 min). A baby of two months is rarely awake more than 1.5–2 h at a stretch.
  - About 11 h 14 min asleep in 24 h, where 14–17 h is usual at two months.
  - Night gaps of 3 h 37 min and 3 h 08 min.
- **After scoring:**
  - The night gaps are within the project's rule, which is two or three feeds a night (`lives.json` infant_care; I first misread Q-061 as a 2–3 h interval).
  - The lane "work" is the mother exchanging goods in kind, so "on the mother's back while she works" is fair.
  - The waking spells remain: the infant's line follows the mother's, and she sleeps only when the mother does or at a named nap (S5). The score stands.

### 18864 Battinaša: farmer, threshing and the grain heap (score 4)
Sunrise 05:39, sunset 18:21. Abu 22 (3 Sep), 20–39 °C, wind 1 m/s.
- **Fine:**
  - Up at 05:10, breakfast at 05:33, and out at 06:04 with a winnowing fork and bread and water.
  - `06:07–10:30 thresh — driving the animals round over the sheaves`, with no winnowing on a still day (Q-141).
  - The carried bread eaten at the floor at 07:57.
  - Home for the midday meal, a sleep through the heat, and supper at 17:43.
- **(a) The vigil does not match its purpose.**
  - `12:12–14:42 sleep — sleeping in the afternoon: tonight he sits up by the grain heap`.
  - Then `20:33–22:03 rest @ threshing:v_14 — sitting up by the threshing floor to guard the grain heap`, and home to bed at 22:06.
  - A heap watched for 90 min in the evening and left for the rest of the night is not guarded: theft and animals come in the small hours.
  - The day's shape is plausible (a long siesta at 39 °C, an evening at the floor), but its stated purpose is not carried out.
- **Placeholder:** `thresh` 4 h 10 min.
- **After scoring:**
  - The comment at population.ts:2178 says "some nights one sleeps on the threshing floor to guard the heap". But l. 2185 keeps him there until max(arrival + 1.5 h, bedtime + 0.5 h) and sends him home.
  - On day 140, 78 men of v_14 sit at the floor between 20:43 and 22:41, and every one has left by 22:41. Nobody is at the floor again before 05:00 (all 943 households checked). Nobody relieves him.
  - The fault is the code's (S2). The score stands.

### 45644 Harsukka: newborn (score 4)
Sunrise 06:05, sunset 17:55. Addaru 15 (22 Mar 466), 4–20 °C.
- **Fine:**
  - Beside the mother day and night.
  - 8 feeds: 02:29, 05:54, 07:49, 10:18, 12:41, 15:18, 18:01 and 21:53.
  - On her back to the canal and twice to the well.
  - About 13 h 38 min asleep.
- **(a) Faults as scored:**
  - Awake 08:17–11:54 (3 h 37 min) and 17:00–19:36 (2 h 36 min), long spells for a baby of weeks.
  - Night gaps of 4 h 36 min (21:53–02:29) and 3 h 25 min.
  - A newborn carried to work at the canal (07:44–09:23) and twice to the well, while daughters of 12 and 8 are at home.
- **After scoring, two of the three fall away:**
  1. The night feeds meet the project's rule of two or three a night (my misreading of Q-061, as for 22239).
  2. She is 29 days old (born day 311). Her mother's lying-in (`postpartum_off_days`, 10–40 days, 27 for her) ended two days before, and the canal work is washing clothes. The daughter of 12 also fetches water twice and minds the little ones.
  - What remains is the long waking spells (S5). On that alone the day would still be a 4. The score stands.

### The eleven 5s, in one line each
- **#52 Aššaštiya** (guard, 22; Shabatu 28): an off day before the C watch.
  - Breakfast at 06:36, hearth talk and knucklebones (§9.1), two turns in the forecourt with men of another file, a meal at 17:17, a nap 17:57–21:25, bread and water, then on post at gate_s1 at 22:04 with spear and wicker shield (Q-144).
  - Quibble: the 12:17 bread and water is eaten out in the forecourt in an 8 m/s wind at 11 °C. After scoring: the plan places the meal where he happens to be.
- **#93 Kašunda** (Median guard; Arahsamnu 21, rain 9.2 mm):
  - At the hearth through the wet morning, and a meal before the B watch.
  - On post at gate_s1 from 14:05 with spear, bow case and short sword.
  - He waits 7 min for the patrol man, eats bread at the hearth 18:19–18:37, and is back at 18:42.
  - Off at 22:07, supper, and bed at 22:29.
- **#26 Kamišdana** (guard, the watch's patrol man; Abu 24):
  - The night half of a C watch: patrols, and six half-hour stand-ins while post men eat.
  - His own bread at 01:59, breakfast after the watch, and sleep 06:36–13:00 through 41 °C.
  - The hearth, and bed at 19:57.
  - After scoring: the elided 04:31–05:57 holds one more stand-in and a full round (S12). A family visit is drawn on that afternoon at p = 0.5, and it did not come.
- **#129 Aššamanda** (boy 7, town; Kislimu 7):
  - Barley carried to a neighbour and oil carried home, an errand at seven (Q-065). Six spells of play in the lane, three meals, and bed at 18:21.
  - Quibble: four 12-min "walking" segments start and end in the same lane. After scoring: each is a walk home and straight back out, merged (S10).
- **25364 Nisuka** (homemaker 17; Tashritu 24):
  - Kneads and bakes before dawn from yesterday's flour (Q-149), then grinds.
  - The women at the door, 3 h 32 min of spinning, and grinding for tomorrow.
  - The fire and supper, and the evening water at sunset.
- **26660 Šatitikaš** (farmer; Ululu 2, 39 °C):
  - The household's turn of canal water 06:27–09:34 (CE-19, river low), then the stubble cleared for the ploughing.
  - Home before noon, a sleep through the heat, supper, and bed at 20:08.
  - Quibble: 3 h 56 min of talk and rest through the afternoon.
- **10496 Hubuda** (girl 4; Ululu 15):
  - With the mother to the lane and the well, a midday sleep, then with her sister of 8 to the lane and the canal, home by 17:19. Three meals, and bed at 18:49.
  - Quibbles: 6 h 37 min between breakfast and the midday meal (inside Q-064's ~7 h, but long at four), and the label "an older brother or sister" for her sister (S10).
- **24457 Kaputtiš** (girl 4; Shabatu 3): with the mother at home, on her visit to Ramuka and at the well. Meals, a nap 12:38–14:14, and bed at 17:53 in the long February night.
- **7521 Duttukka** (farmer; Aiaru 6): the barley harvest (E-41, days 33–66).
  - Reaping from sunrise, bread and water at the field edge, the midday meal and a sleep at home.
  - Reaping again 14:45–16:33, mending tools and baskets, knucklebones with the neighbours, and bed at 20:38.
  - Quibble: he stops reaping 2 h 13 min before sunset.
- **37374 Ušema** (elder 59; Shabatu 4, dust): light work (spinning, "a little grinding" of 25 min), rest, an afternoon sleep and the grandchildren, all indoors on a cold, dusty day.
- **41211 Iššante** (boy 11; Ululu 1, 38 °C):
  - The animals out at dawn, barley for oil, two fuel trips, water twice, play.
  - Rest through the heat, then minding the little ones "the youngest on his hip".
  - The best-filled day in the sample.

## Systemic findings

Severity:
- **blocking**: caused a score below 4 in this sample;
- **high**: a §9.5 fault;
- **medium**: lowered days to 4 here, and could fail a day on another draw;
- **low**: labels, the tool, or rare.

**S1. A farming man with no field task spends the day idle at home.** Severity: **blocking** (31224).
- **How it happens.**
  - `ptask()` (population.ts:594–626) outside the harvest, threshing, vintage, fruit, sowing and canal windows gives field work only with probability `field_fraction_adults_by_day[season]` (spring 0.5, autumn 0.4, winter 0.15), plus a water turn one day in six. Even inside E-44 the sowing is an 80 % draw.
  - A man with no task gets `homeDay('at home')` (l. 2175). Its hours come from `home_hours.men`: rest 0.35, craft 0.2, animals 0.2, talk 0.15.
- **Measured** (seed 1, farming men aged 16–60, one mid-month day each):

  | month | no field task | their mean daylight rest |
  |---|---|---|
  | 1 Nisanu (day 15) | 9 % | 4.0 h |
  | 2–5 | 0 % | – |
  | 6 Ululu | 24 % | 3.7 h |
  | 7–9 | 7–17 % | 2.3–3.2 h |
  | 10 Tebetu | 85 % | 2.6 h |
  | 11 Shabatu | 57 % | 2.6 h |
  | 12 Addaru | 33 % | 3.7 h |

- **Where it is right and where it is not.**
  - In winter an idle day is right ("little field work in winter"; E-62 and PEOPLE's 0.15). Round 3 accepted it.
  - In months 12, 1 and 6 a day at home with no cause is not right. Q-057 lists no such cause for a day without work.
- **The fraction is misapplied.** It is PEOPLE.md P5.6's "fraction of adults in the fields by day", which counts the women. Used as the chance that a household's men go out, it under-works the men.
- **Fix options:**
  - give a no-task day outside winter the season's other men's work: sickles and tools before the harvest, the threshing floor made ready, fodder, the garden, vines and trees, fuel;
  - or apply the fraction to men and women separately, and cap daylight rest.

**S2. The grain-heap vigil ends at bedtime.** Severity: **medium** (18864).
- The comment at population.ts:2178 says "some nights one sleeps on the threshing floor to guard the heap". The label at l. 2184 says "tonight he sits up by the grain heap".
- But l. 2185 plans the sitting-up only until max(arrival + 1.5 h, bedtime + 0.5 h), then sends him home.
- On day 140 in v_14, 78 men sit up between 20:43 and 22:41, and all have left by 22:41. Nobody is at the floor again before 05:00 (943 households checked).
- The heaps are unguarded through the hours that matter, and 78 men walk home together.
- **Fix:** he sleeps at the floor, which is the comment's own intent, or the watch is handed on in turns through the night.

**S3. The leader of ten's change-of-watch round walks other files' posts.** Severity: **medium** (#80).
- `roundFor` (sim.ts:330–337) lists the posts where a detailed agent of his file is standing guard. At the change of watch his men are still walking to their posts, so the list is empty and falls back to all 16 posts.
- The 0.4–0.75 h plan block then ends the round part-way. For #80: 10 posts, 8 of them other files', and gate_s1 never reached (06:46–06:47).
- The later rounds are right: 6–7 of his file's 7 posts, at intervals, with the hearth between. Round 3's S3 (a fixed loop) is fixed.
- **Fix:** take the round's posts from the rota (`P.rota(d)`: the file's posts on the watch), not from who happens to be standing there.

**S4. The herders' day is one template, the whole band in lockstep.** Severity: **medium** (44309).
- `herderPassing` (population.ts:2311–2319) gives one plan per band and day. All 39 members of band 21 share it to the minute (checked).
- The template has:
  - one 30-min halt, however hot the day (the E-64 rule starts only above 33 °C);
  - camp struck in 24 min and made, with supper, in 36;
  - sleep from sunset + 0.1 h;
  - no evening;
  - nobody watching the flock at night;
  - none of E-49's dogs or donkeys in the day.
- **Composition.** Band members are drawn 80 % male and aged 10–55 (l. 414): no children under 10, no girls, no elders. E-49's cited analogue, the Qashqai, migrates as families. E-49's participant row lists only herders, dogs and donkeys, so a crew reading is defensible, but the choice should be logged.
- In the year: 39 bands of 5–39, 908 herders in all, inside PEOPLE's 500–3,000.
- Recurs from round 1 C7 and round 3 S9 (fixed templates).
- **Fix:** vary the plan per person and day (a midday rest in the heat, an evening, one or two men with the flock by turns at night, milking or curds when in season), and settle the band's make-up with its source.

**S5. Infants stay awake while their mothers work.** Severity: **medium** (22239, 45644).
- The infant's line follows the mother's. While she works, walks or sits, the baby "rests" awake on her back, on a mat or in her lap. It sleeps only when she sleeps, at a named nap, or in her lap at a meal.
- 22239 (2 months) is awake 06:18–11:54 (5 h 36 min) and 17:07–20:17, and asleep 11 h 14 min in 24 h.
- 45644 (29 days) is awake 08:17–11:54 (3 h 37 min).
- Babies of these ages sleep 14–17 h, mostly in short naps, often on the back.
- Feeding is right by the project's own rule: day feeds every 1.6–2.8 h and two or three at night (`lives.json` infant_care). Round 1's C3 stays fixed.
- **Fix:** an infant sleeps through most of the mother's work spells (for example 60–70 % of the daytime), labelled "asleep on her back".

**S6. The child at the threshing floor: `field_work` and a hoe.** Severity: **low** (18978).
- Children who drive the animals are planned as `field_work`, while adults thresh as `thresh`.
- `carries()` (population.ts:1000) gives any walk to a `field_work` job "a hoe", so the girl carries a hoe out to drive the oxen "with a stick".
- **Fix:** plan her work as `thresh`, or give the child a stick.

**S7. Thin winter days for women at home.** Severity: **low** (18904, #122).
- 18904: 7 h 14 min of rest (partly minding the children) and 25 min of spinning on 27 Dec.
- #122: 6 h 35 min of rest and 5 min of spinning on her winter day off.
- `home_hours.women` draws rest 0.3 and talk 0.2 against spinning 0.25, with no change by season. Winter is when the spinning and weaving get done.
- Round 3 S10 saw the same in the men's winter days.
- **Fix:** weight spinning up in winter and on days off.

**S8. The name pools are thin for the numbers they name.** Severity: **low** for this gate, since behaviour is unaffected; worth logging.
- **Across seed 1:**

  | who | people | names | commonest |
  |---|---|---|---|
  | Elamite women | 2,489 | 7 | Kappipi 659, Utur 628, Išpazamip 603 |
  | Egyptian men | 241 | 1 | Muzraaya ("the Egyptian"), all 241 |
  | Syrian men | 129 | 3 | – |
  | Persian women | 17,956 | 65 | Dusika 309 |

  2,034 of 46,886 people have no name.
- **In the sample:** three pairs of namesakes among about 14 women's names:
  - Budakka (18904 and 22239);
  - Harsukka (45644 and 18904's neighbour);
  - Hubuda (10496 and Tirima's friend).
- §9.1 forbids invented names, and PEOPLE.md lists non-Iranian names as a hard gap (NEEDS #1–#4). Still, an Elamite quarter where one woman in four is Kappipi is not what the tablets show.
- **Options:** cap repeats per quarter and leave the rest unnamed, or name people as the tablets often do, by ethnic label or by father. Log the conflict in `OPEN_QUESTIONS.md`.

**S9. Village sizes against PLAIN.md.** Severity: **low**.
- Seed 1 has 39 plain villages. v_35 holds 8,491 people and v_14 4,247 (day 100); the smallest holds 219.
- PLAIN.md §4 gives 150–3,000 per site, and about 900 on average for the 33 unlocated sites (30,000 people).
- Each village has one `well`, one `lane` and one `threshing` place. So all 4,247 people of v_14 share one well and one threshing floor, and 78 men sit up at that one floor (S2).
- Five of the sampled people live in these two villages (41211 in v_35; 22239, 18904, 18864 and 18978 in v_14).
- I did not check how the renderer spreads these places.

**S10. Planner artefacts and labels.** Severity: **low**.
- Two lane outings in a row become a 12-min "walking" segment that leaves the lane and comes back to it (population.ts:1832). #129 has four: 09:36, 10:57, 13:46 and 15:28.
- A walk split in two (18978, 16:15 and 16:19).
- In the detailed tier:
  - `patrol → post_gate_w2` while standing at post_gate_w2 (#26, 01:44);
  - a round cut off mid-leg at the end of its block (#80, 06:46);
  - `patrol →` for a man walking to his own post (#52 at 22:00, #93 at 14:00).
- A meal set down wherever the man happens to be: #52 eats in the forecourt in an 8 m/s wind.
- **Labels:**
  - "an older brother or sister" for a known sister (10496 with 10495, f 8; population.ts:1477);
  - "tonight he sits up by the grain heap" for 90 min (S2);
  - "his file's posts" for the all-post fallback (S3).
- Recurs from round 1 C10, round 2 N7 and round 3 S11.

**S11. Placeholders.** Severity: **high** for §9.5 (not scored).

| person | placeholder activities | time | share of the waking day |
|---|---|---|---|
| 44309 | herd | 10 h 07 min | 87 % |
| 7521 | reap, craft | 8 h 13 min | 57 % |
| 26660 | irrigate, field_work | 5 h 13 min | 38 % |
| 18978 | field_work (threshing floor) | 4 h 18 min | 37 % |
| 18864 | thresh | 4 h 10 min | 31 % |
| 25364 | spin, cook | 3 h 48 min | 27 % |
| 37374 | spin | 2 h 35 min | 21 % |
| 41211 | tend_animals, gather | 2 h 22 min | 17 % |
| 31224 | tend_animals | 2 h 19 min | 15 % |
| 18904 | spin | 25 min | 3 % |
| #122 | cook, spin | 23 min | 3 % |
| **total** | 11 of 20 people (10 of 14 population, 1 of 6 detailed) | **43 h 53 min** | |

- The waking day here is the time awake, naps excluded.
- The main work of 7 of the 20 days is not performed: reaping, threshing (twice), herding, the water turn and the stubble, and spinning (twice).
- New since round 3: `cook` is a placeholder. The dusk fire (§9.2) appears in the plans of #122, 25364 and the mothers of both infants, but nobody performs it.
- A detailed agent (#122) now has placeholders.
- §9.5's activity-coverage check should fail the build on every one of them.

**S12. Tool and coverage.** Severity: **medium** for the unconfirmed §9.5 check; **low** for the rest.
- **The on-screen check is still not made.** The detailed agents are still stepped in the abstract LOD (`tools/shadow_days.ts:33`), and the population people are printed as plans (l. 63). "What a person is doing on screen matches what the simulation says" (§9.5) remains unconfirmed, as in rounds 1–3.
- **The elision** (`log.length > 90`, l. 52) hid 04:31–05:57 of #26's night. Replayed after scoring, that stretch holds one stand-in at post_apa_e and a full round of the posts. Nothing wrong was hidden.
- **Jump order.** #26's day logs 111 changes after the tool's order (#52, #80 and #93 stepped first) and 110 after a fresh `jumpTo`. One line differs, so the detailed tier keeps some state across `jumpTo`. Continuity (§9.2) and a reproducible review input both need a jump to give the same day.
- **Day range.** Days come from `pick.int(1, 350)` on a 0-based day (ll. 36, 58), so printed days 1 and 352–354 can never be drawn.
- **Coverage.**
  - The 14 are drawn per person. The town holds 16.3 % of persons, so a sample with no townsperson has P ≈ 0.08, and this one has none.
  - The detailed tier is 100 guards of 135 agents, and 4 of the 6 drawn are guards.
  - This round shadowed no town household and none of the Terrace gangs, scribes, officials, porters or couriers. Its result says nothing about them.

## Checked in code after scoring

These checks came after the scores were fixed. None changed a score.

- **Earlier rounds:** all three read in full. See the recurrence table below.
- **Scratch scripts.** The five scripts q1–q5 are read-only. They sit in the session scratchpad, outside the repo, and import the worktree's `src/people`; each builds the seed-1 simulation as `tools/shadow_days.ts` does. (`sun.py`, also in the scratchpad, was the independent sun calculation made before scoring.)
  - **q1: the sampled people.**
    - `ptask(7302, day 22)` is null with E-44 active; the wife's plan.
    - v_14's threshing floor from day 140 into day 141, over 943 households.
    - #80's rota and household.
    - Band 21: 1 distinct plan for 39 people, and the band's make-up.
    - The plans of both infants' mothers, the newborn's birth day and her mother's lying-in, and the sister of 12.
    - The plans of #129 and Tirima.
    - `hday` for the five households that eat "the new bread": every one had a baker that morning.
  - **q2: the population and the hidden stretch.**
    - #26's full detailed log (110 lines).
    - Name pools by origin and sex.
    - Zone shares, and detailed agents by role.
    - The no-task share of farming men by month.
    - Plain village sizes.
  - **q3:** #26 replayed in the tool's order (111 lines).
  - **q4:** #52's plan, which puts the forecourt meal there.
  - **q5:** the sim's `DayCtx.sun` for the 20 days, which agrees with my own sun within 3–6 min.
- **Code read:**
  - `ptask`, `homeDay`, `homeHours` and `lives.json` home_hours (S1, S7);
  - the vigil branch of `farmer` (S2);
  - `roundFor` and the guard planner, with its family-visit chances of 0.25, 0.3, 0.35, 0.5 and 0.7 by rota phase (S3);
  - `herderPassing` and the band members (S4);
  - the small child's follow rule and `infant_care` (S5);
  - `carries()` (S6);
  - `nameFor` and the name pools (S8);
  - the lane outings (S10);
  - `tools/shadow_days.ts` (S12);
  - `standing()` and the riding rule, which now require a household of standing (round 3 S8).

## Earlier rounds: do their findings recur?

| earlier finding | status in this sample |
|---|---|
| R1 C1: meals inverted, workers unfed | **Not seen.** Everyone eats 3–4 times. The longest fast awake is 6 h 37 min (10496, 05:58–12:35). |
| R1 C2: plain children never sleep | **Not seen.** All seven children sleep at night, and the small ones nap. |
| R1 C3: infants fed only at meals | **Fixed.** 8–10 feeds, two of them at night. The new problem is the long waking spells (S5). |
| R1 C4: marriage takes mothers away | **Not seen.** |
| R1 C5: household demography | Plain households look right (22239's children are 7, 3 and 0; 41211's are 11, 9, 5 and 2). The herders' "household" has five boys aged exactly 13 and no one under 10 (S4). |
| R1 C6: households do not eat together | **Fixed** where checked: 31224 and his wife at 05:53, 12:08 and 18:03; the newborn's mother and sister at 06:34, 12:07 and 17:20. |
| R1 C7, R2 N4, R3 S9: clockwork templates | **Recurs** in the herders: 39 identical plans (S4). The guards vary. |
| R1 C9: long guard stints | **Not seen.** #93 stands 4 h and 3 h 18 min either side of his relief. |
| R1 C10, R2 N7, R3 S11: labels | **Recurs** (S10). |
| R1 C11, R2, R3: the tool and the abstract LOD | **Recurs** (S12). Household headers are right, and names are printed for every population person (round 3's tool note is fixed). |
| R2 N1: older children on a play template | **Not seen.** The 10- and 11-year-olds work. The boy of 7 in a house with no little ones has one errand and much play. |
| R2 N2: the motherless household | **Not sampled.** |
| R2 N3: harvest ahead of the sources | **Fixed.** Reaping on day 35 falls in E-41 (days 33–66), and threshing on days 104 and 140 falls in E-43 (days 43–141). |
| R2 N5: 2-min patrol legs | **Fixed.** Legs take 1–4 min over the Terrace. |
| R2 N6: winnowing in a calm | **Fixed.** 18864 threshes without winnowing at 1 m/s. |
| R2 N8: nothing carried | **Fixed.** Arms, jars, sacks, fuel, oil and tools are carried. One prop is wrong (S6). |
| R3 S1: the sampler draws the dead | **Fixed** (`tools/shadow_pick.ts`). All six detailed agents are present. |
| R3 S2: the detailed tier drops a planned meal | **Not seen.** #93's relief meal happens as planned. |
| R3 S3: the leader's fixed loop | **Fixed.** The rounds are periodic. New: the change-of-watch round (S3). |
| R3 S4: a toddler teleports home | **Not seen.** The 4-year-olds walk home (population.ts:1489–1496). |
| R3 S5: nursing replaces drawing water | **Not seen.** Both mothers draw at the well; the feeds fall in the lane and at the canal (plans checked). |
| R3 S6: carried bread vanishes | **Fixed.** 7521 and 18864 eat what they carry out. Bread is carried only when it will be eaten out. |
| R3 S7: bread nobody baked | **Fixed.** All five "new bread" households had a baker that morning. |
| R3 S8: riding for every Persian boy | **Not sampled.** The code now requires a household of standing (population.ts:1841). |
| R3 S10: idle filler and winter needs | **Recurs** as S1 and S7. The fire is now lit for supper (a placeholder), and fuel is gathered (41211, 18978). |
| R3 S12: placeholders | **Recurs:** 11 of 20 people, 43 h 53 min (S11). |

## What holds up

- **The garrison.**
  - The A–B–C–off–off rota, with watches changing at 06:00, 14:00 and 22:00.
  - Posts relieved for bread by the patrol man, who stands in (#93, #26).
  - The leader's periodic rounds with the hearth between (Q-147).
  - A nap before the night watch, and sleep until 13:00 after it.
  - Arms by origin (Q-144): the Persians with spear and wicker shield, the Median with spear, bow case and short sword.
- **Sleep fits the sun.**
  - Plain and town adults rise 0.45–1.2 h before sunrise and go to bed 1.4–2.2 h after sunset. The vigil man goes at 22:06 and the herders at sunset.
  - Small children go to bed 0.6–1.3 h after sunset.
  - Winter suppers come an hour before sunset.
- **Season and weather.**
  - Reaping and threshing fall inside their sourced windows.
  - On a still day the floor is threshed without winnowing.
  - Heat rest applies on the hot days (26660, 18864, 18978, 41211 and #26), and the 7521 harvest day keeps its noon sleep.
  - In Ululu there is the water turn by channel (CE-19) and the stubble cleared before the ploughing.
  - The herders pass in Tashritu (E-49, months 6–7).
  - Rain keeps #93 under cover until his watch, and dust keeps the elder in.
- **Goods move.**
  - Water is drawn and carried home on the head, and the barley and oil go both ways.
  - Dung cakes are carried in for the morning fire, and fuel is gathered and carried home.
  - The carried bread is eaten at the field or the floor.
  - "The new bread" is eaten only where someone baked that morning (Q-149).
- **Children work by age (Q-065).**
  - At 10–11: the threshing floor, water, fuel, the animals, and minding the little ones "on the hip".
  - At 7: an errand.
  - At 4: with the mother, or with a sister of 8, and home before dusk.
- **Infant care.**
  - Feeds follow the project's rule.
  - Nursing breaks are cut out of the mother's washing and exchange without costing the water.
  - A lying-in period exists (10–40 days).
- **Names** are printed for everyone. The guards' names are attested (PF 15, EWB) and matched to origin.
- **No anachronism** appears in any world-facing text. "Homemaker", "PLACEHOLDER" and the `post_harem_*` ids are out-of-world labels.

## VERDICT

**FAIL.** 1 of 20 people scores below 4:

| person | score | cause |
|---|---|---|
| 31224 Tuppipi (farmer, 35, day 22) | 3 | a working man idle at home through a fine day in the sowing month, with no cause (S1) |

- This is the fewest below 4 in four rounds: 10, then 3, then 3, now 1.
- Of round 3's two blocking causes, the leader's fixed loop is fixed. The teleporting toddler is not seen: the 4-year-olds walk home, and the code now walks the child (population.ts:1489–1496).
- Round 3's sampler fault (its S1), the vanishing bread (S6) and the bread nobody baked (S7) are fixed. The nursing that replaced the drawing of water (S5) is not seen in this sample.

**The minimum before a re-review:**
1. Fix S1: a farming man's no-task day outside winter should carry the season's other work or a stated cause, and daylight rest should be capped.
2. Fix S2 (the vigil lasts the night, or is handed on), S3 (the change-of-watch round follows the rota), S4 (the herders' day varies, has an evening and a night watch on the flock, and the band's make-up is decided from its source and logged) and S5 (infants sleep through much of the mother's work). None of these failed a day here, but each is a plausibility fault a visitor would see on another draw.
3. Draw a fresh 20-person sample with a new pick seed. Check its coverage, since this round had no townsperson and only a baker and a child among the non-guard detailed agents.

- S6–S10 are not blocking. Fixing them, with S2–S5, would move most of the eight 4s to 5s.
- The placeholders (S11) do not change these scores, but on their own they block §9.5's activity-coverage check.
- The §9.5 on-screen comparison (S12) is still not made by this tool.
