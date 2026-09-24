**VERDICT: FAIL.** 1 of 20 people scores below 4: 1888 (Treasury weigher, 35, Ionian, day 7) scores **3**. His whole working day, 05:52–15:30 (about 9 h 10 min), is "receiving hides at the treasury store". The day's delivery was 9 hides, and they arrived at 09:10. After scoring I found the cause in the code. The Treasury staff's "receive" task is drawn separately for the morning and the afternoon of any day on or after a slaughter, and nothing limits it to the delivery (S1). Over the year it gives 5,943 person-hours of "receiving hides" for 37 deliveries of 6–17 hides each. The other 19 people score 4 (7 people) or 5 (12 people).

# Shadow review, Phase 5, round 6, reviewer A (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. Before scoring I read no earlier round, no simulation code and no `DECISIONS.md`.
- **Date:** 2026-09-24
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick113.txt` (seed 1, pick seed 113). No earlier reviewer had seen it. I read it in the lead's working tree, `/home/user/s6-lead` (branch `lead-s6`, HEAD `551a604`). The merged simulation there generated it. It is not yet in `/home/user/fars/REVIEWS`. The sample holds:
  - 6 detailed Terrace agents: a leader of ten (#10), two guards (#46, #75), a foreman (#100) and two masons (#109, #111);
  - 14 people of the population, in these strata:
    - 2 Terrace workers (383, 1888);
    - 3 townspeople (45426, 5895, 6917);
    - the six cases round 5 asked for: a man who works in the open on a rain day (38807), a child past an age-rule birthday (34914), a baby under four months (45124), a herder (44149), a traveller (43615) and a man keeping the grain-heap vigil (31197);
    - 3 people drawn from everyone (11523, 43763, 29211).
- **Protocol:** round 3's (`REVIEWS/shadow_phase5_r3.md`, ll. 3–33), as the lead restated it to me.
- **Read before scoring:**
  - The sample, in full (554 lines).
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table:

    | month | days |
    |---|---|
    | Nisanu | 1–29 |
    | Aiaru | 30–59 |
    | Simanu | 60–89 |
    | Duzu | 90–118 |
    | Abu | 119–148 |
    | Ululu | 149–177 |
    | Tashritu | 178–207 |
    | Arahsamnu | 208–236 |
    | Kislimu | 237–266 |
    | Tebetu | 267–295 |
    | Shabatu | 296–325 |
    | Addaru | 326–354 |

    All 20 printed Babylonian and Julian dates agree with it. Three examples: day 324 = Shabatu 29 = 6 Mar 466; day 265 = Kislimu 29 = 6 Jan 466; day 206 = Tashritu 29 = 8 Nov 467.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - Greps of `research/OPEN_QUESTIONS.md`, all run while I drafted and before the scores were saved:
    - "hide" and "weigher" returned nothing;
    - "garrison" and "guard" returned Q-043, Q-060, Q-144 and Q-147 among others;
    - lambing, querns, sickness and midday rest returned Q-039, Q-057, Q-058, Q-149, Q-220, Q-223, Q-226, Q-296 and Q-297.
  - The 20 scores, each with a paragraph, were then saved to `shadow_r6_A_scores.md` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5_r3.md` in full.
  - The verdicts, "Read first" sections and finding headings of `REVIEWS/shadow_phase5_r4.md`, `_r5.md` and `_r5_b.md`.
  - A grep of all rounds for hides, the weigher and guards' family visits.
  - `tools/shadow_days.ts` and `tools/shadow_pick.ts`.
  - From `src/people/population.ts`:
    - the treasury worker (ll. 2541–2551) and `terraceWorker` (ll. 2476–2486);
    - the hide carriers (l. 2680);
    - the guard planner's `leisure` and `free` and the watch branches (ll. 2060–2120);
    - the dust wear (l. 1365).
  - From `src/people/calendar.ts`: the E-12 slaughter (ll. 255–256), the hides worked (l. 311) and the storm rule (ll. 60, 86).
  - The E-12 entry in `src/data/events_calendar.json`.
  - From `src/data/lives.json`: `job_tasks.treasury_staff`, `guard_off_day`, `guard_family_share` and `infant_care`.
  - The `inspect`, `gamble`, `queue` and `lie_ill` entries of `src/people/activities.ts`.
  - A grep of `src/people/outfits.ts`, `looks.ts` and `crowd.ts` for cold and temperature.
  - Read-only scratch scripts q1–q8 in the session scratchpad, outside the repo. Each imports `freshSim` from `tools/shadow_days.ts`. See "What I checked".
  - For the state of rendering: the one-line `git log` of the lead tree.
  - I did not read `DECISIONS.md`.
- **Score changes after scoring: none.**
  - 1888's day is exactly his plan (q1), so the sample does not misrepresent the simulation.
  - The code made two faults look worse than I had scored them, and neither score changed:
    - 1888 starts "receiving" 3 h 18 min before the hides come, and 15 other Treasury staff receive the same 9 hides (S1);
    - #10's 13 hours at the hearth are forced by a planner condition in the summer half of the year (S2).
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails on one person.**
   - 1888 spends a working day of about 9 h 10 min "receiving hides" for a delivery of 9 hides.
   - He performs `inspect` ("official looking over work, hands clasped") the whole time. That is the "placeholder 'working' loop" that §9.5 rules out, under an event label.
   - Cause and scale: S1.
2. **What a follower sees is still not confirmed.** The lead's own commit (`be174b0`) lists "the population still not rendered". So for the 14 population people, §9.5's check that the screen matches the simulation cannot be made. Their lines are plans. The 6 detailed agents are stepped in the full LOD (`tools/shadow_days.ts` sets `a.lod = 'full'`), and their off-Terrace hours are marked "not drawn".
3. **No placeholders.** No line in the sample carries `[PLACEHOLDER: not performed]`, and `ACTIVITIES` flags none (activities.ts l. 165).
4. **Nobody dresses for the cold (§9.2 "cover up in cold").** The only weather wear the planner gives is the dust wrap (population.ts l. 1365), and `outfits.ts` has no temperature rule. Five people are out or up at −2 to −4 °C with nothing shown (S5). This recurs from round 3 S10.
5. **Design gaps that did not fail anyone:**
   - An unmarried guard on a night-watch day cannot leave the garrison from Nisanu to Abu (S2).
   - Babies under two months have daytime feed gaps of more than 4 h on 4.4 % of days (S4).

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #10 Makuš | guard, leader of ten, m 25, Persian | 42 (Aiaru 13, 28 May; 14–32 °C) | **4** | Good rounds after the change of watch, but 13 h at one hearth with about 8 h of knucklebones (4.5 h straight in the afternoon heat) and only a 2 h nap before an 8 h night watch. |
| 2 | #46 Akšimašra | guard, m 43, Persian | 22 (Nisanu 22, 8 May; 10–28 °C) | **4** | A sound A watch with a bread relief. But his wife and three children, one of 9 months, live in the town, and his free afternoon and evening pass at the Terrace hearth. |
| 3 | #75 Mikrašba | guard, m 21, Median | 206 (Tashritu 29, 8 Nov; 4–20 °C) | **4** | A coherent C-watch day with the Median arms, but 11 waking hours at the hearth with a 17-year-old wife and 5-month son in the town. |
| 4 | #100 Kamiya | foreman, m 35, Elamite | 71 (Simanu 12, 26 Jun; 16–35 °C, dust) | **5** | On site at dawn, overseeing with cord and straightedge, home at noon for the heat (E-64), a sleep through it, supper with the household. |
| 5 | #109 Belšun | mason, m 27, Babylonian | 299 (Shabatu 4, 9 Feb; −2–11 °C, dust) | **5** | Fluting a raised shaft on a dry winter day (E-62), with the camp's midday bread. |
| 6 | #111 Hupannana | mason, m 45, Elamite | 270 (Tebetu 4, 11 Jan; −3–10 °C) | **4** | His half of the gang is off in winter. It is plausible, but about 5.5 h of the 10 h of daylight is rest. |
| 7 | 383 | builder (stone), m 43, Cappadocian | 177 (Ululu 29, 10 Oct; 8–27 °C) | **5** | A clean mason's day, carving a double-bull capital from dawn to mid-afternoon (E-60). |
| 8 | 1888 | treasury weigher, m 35, Ionian | 7 (Nisanu 7, 23 Apr; 8–25 °C) | **3** | About 9 h 10 min "receiving hides" (E-12: 6–17 hides, 2–4 times a month), a task for an hour and not a weigher's. |
| 9 | 45426 Kuraaza | girl, 1 month, Persian (town) | 108 (Duzu 19, 2 Aug; 21–39 °C) | **5** | Nine feeds, sleep on a mat, in the lap and on the back, and the mother's lying-in work. |
| 10 | 5895 Damakil | servant, m 46, Persian, sick | 43 (Aiaru 14, 29 May; 14–33 °C) | **5** | Lying ill, a little food three times, a visit from kin. |
| 11 | 6917 Ratukka | girl, 4 months, Babylonian (town) | 94 (Duzu 5, 19 Jul; 19–37 °C) | **5** | Ten feeds, carried to the canal and the well. |
| 12 | 38807 Butizza | farmer, m 51, Persian (plain) | 324 (Shabatu 29, 6 Mar; 1–15 °C, rain 12.4 mm) | **4** | He stays home in the rain (W-01), with animals and mending. About 6 h with the animals is generous. |
| 13 | 34914 Bazzikka | girl, 8, Persian (plain) | 252 (Kislimu 16, 24 Dec; −3–11 °C) | **5** | Her first tasks at 8: dung cakes, fuel, an errand trading barley for oil, water, play in the lane. |
| 14 | 45124 | boy, 1 month, Ionian (town) | 173 (Ululu 25, 6 Oct; 12–31 °C) | **4** | Goes with the mother to the mill and the workshop. But he is unfed 13:46–18:32 (4 h 46 min in daylight) and then 18:46–22:52. |
| 15 | 44149 Bakabana | herder, boy 8, Persian (band13) | 170 (Ululu 22, 3 Oct; 12–31 °C) | **5** | A camp day in the autumn pass (E-49): water, the lambs and kids, brush, play, a nap in the heat. |
| 16 | 43615 Kašunda | traveller, m 51, Persian | 265 (Kislimu 29, 6 Jan; −4–9 °C) | **5** | A winter layover: the party's travel rations drawn under E-21, harness mended, a little trade, knucklebones. |
| 17 | 31197 Appiyama | farmer, m 20, Persian (plain) | 99 (Duzu 10, 24 Jul; 20–38 °C) | **4** | Threshing, the carried bread eaten at the floor, a heat sleep, the vigil by the heap (Q-225). But no winnowing and 2.6 h of rest in the late afternoon. |
| 18 | 11523 Naputurriš | boy, 1 month, Elamite (plain) | 22 (Nisanu 22, 8 May; 10–28 °C) | **5** | Ten feeds, a visit with the mother, sleep on the mat and in the lap. |
| 19 | 43763 Bakabadada | traveller, m 36, Persian | 328 (Addaru 3, 10 Mar; 1–16 °C) | **5** | Arrives from Bactria (E-22), shows the halmi, draws rations (CE-08), waters the animals, eats, sleeps. |
| 20 | 29211 Rapsaka | homemaker, f 46, Persian (plain) | 295 (Tebetu 29, 5 Feb; −1–13 °C) | **5** | Kneads and bakes before breakfast (Q-149), grinds, visits, fetches water, spins, weaves, lights the evening fire. |

Distribution: 5 → 12 people; 4 → 7; 3 → 1. **1 of 20 is below 4** (round 3: 3 of 20; round 4: 1; round 5 A: 1; round 5 B: 3).

## Notes for every score below 5

### 1888: Treasury weigher (score 3)
Sunrise 05:31, sunset 18:28.
- **Fine:**
  - `05:07–05:10` up, bread and water, and 29 min up to the Terrace (sample ll. 186–189).
  - The camp's bread at noon, home at 15:59, supper at 17:59 and bed at 21:14.
- **The day's one content is wrong in scale and in trade.**
  - `05:52–12:00 inspect @ treasury_store — receiving hides at the treasury store {CE-07}` and `12:28–15:30`, the same (ll. 190, 192).
  - E-12 is 6–17 hides a delivery, 2–4 deliveries a month (PF 58–60, A for Darius' reign). Receiving and counting them is an hour's work, not nine.
  - The weigher's own task in the evidence is weighing silver for the PT payments. The E-05 participants include a "weigher (C)", and there are 2–4 payments a week. Hides are counted, not weighed.
  - What a follower would see is a man standing with his hands clasped (`inspect`) at the store for nine hours.
- **After scoring (q1–q2, q6):**
  - Nothing was slaughtered on day 7. The slaughter was on day 6 at 06:43: "9 head of small cattle slaughtered at the stockyard; the hides go to the treasury".
  - The two hide carriers, 3729 and 3733, deliver those hides on day 7 at `09:10–09:40 talk @ treasury_store — delivering hides to the treasury`. So 1888 begins "receiving" 3 h 18 min before the hides come.
  - On day 7, **16 Treasury staff** plan "receiving hides": 4 weighers, 11 shiners and 1 storekeeper. That is 103 person-hours in all, and 7 of them spend the whole day at it.
  - Over his year this weigher weighs out silver on 125 days and receives hides for a whole day on 8 of his 331 working days. The sampled day is a tail, but a real one (S1).

### #10 Makuš: leader of ten, C-watch day (score 4)
Sunrise 05:06, sunset 18:53. Household 10 is the garrison: he has no family.
- **Fine:**
  - The change of watch at 22:01 and a round of his file's nine posts, 22:12–22:52, at 1–4 min a leg.
  - "Within call" at the hearth, then a second round at 23:54, 62 min later (Q-147).
  - Spear and wicker shield (Q-144).
- **Weak in proportion.**
  - He is at `garrison_hearth_m` from 05:12 to 19:18.
  - Knucklebones fills 07:51–10:28, 11:37–12:09, 12:30–12:47 and 14:06–18:36 (ll. 11–17), about 8 h, including 4.5 h straight through a 32 °C afternoon.
  - His only sleep before an 8-h night watch is `19:18–21:27` (2 h 9 min), after about 5 h the night before.
  - There are no chores: no water, no kit, no washing.
- **After scoring:** the planner offers a man without family a trip to the town or the river only when his free time begins after 07:00. On a C day in summer his breakfast ends before that (S2).

### #46 Akšimašra: guard, A watch (score 4)
Sunrise 05:19, sunset 18:40.
- **Fine:**
  - Breakfast before the watch, on post at `06:03`, relieved for bread 08:41–09:04 by the patrol man (ll. 50–53), relieved at 14:08, and a meal after the watch.
- **Thin.**
  - From 14:37 to 20:21 he is at the hearth (talk, rest, supper), and he sleeps in the garrison.
  - His household (h:46 in q_pw_n: wife 38, a son of 17, children of 13, 4 and 9 months) is in the town. After an A watch his next watch is B at 14:00 tomorrow.
  - Keeping a man within call is plausible (Q-060 is C), so this is not below 4. But an evening with his baby would be the likelier use of the time.
- **After scoring:** the chance of a family visit after an A watch is 0.25 (population.ts l. 2105). Measured by month, 12–31 % of the A and C watch days of married guards include a visit (S3).

### #75 Mikrašba: guard, C-watch day (score 4)
Sunrise 06:32, sunset 17:27.
- **Fine:**
  - Up 06:57.
  - Meals at 06:57, 12:13, 17:14 and 21:40.
  - Sleep 17:47–21:27.
  - On post at `22:04 stand_guard @ post_tachara_1` with the Median guard's spear, bow case and short sword (Q-144).
- **Thin.**
  - From 06:57 to 17:47 he is at the hearth: talk, rest, and knucklebones twice (ll. 68–79).
  - His wife of 17 and son of 5 months live in q_pw_s.
  - The C-watch visit chance is 0.35 (population.ts l. 2113), and it was not drawn. As #46.

### #111 Hupannana: mason, winter half day off (score 4)
Sunrise 06:51, sunset 17:08.
- **Fine:**
  - E-62's winter halves, stated in the line ("the gang works in halves in winter").
  - Breakfast with the new bread.
  - Mending tools and baskets twice.
  - Neighbours in the lane 15:23–16:43.
- **Idle.**
  - `rest` 06:21–07:52, 08:16–10:41, 11:34–12:12 and 14:01–15:19 comes to about 5.5 h of the 10.3 h of daylight.
  - It is plausible for a winter day off at −3 °C, but thin: no fuel, and no errand to the store.
- **After scoring:** the household ate supper at 16:19–16:58 (wife 335's plan). He stayed in the lane, 4 minutes from home, until 16:43. So "kept for the late-comer" is literally right.

### 38807 Butizza: farmer, rain day (score 4)
Sunrise 06:14, sunset 17:45.
- **Fine:**
  - It rains 12.4 mm and he never goes out (W-01, CE-11). Round 5's open-field shelter (r5 S1) is not seen.
  - The new bread at breakfast.
  - Mending tools and baskets 09:39–11:14 and 12:38–14:22.
- **Generous.** The household's animals take `06:20–07:14`, `07:42–09:39`, `11:14–12:01` and `14:22–16:36`, about 6 h. The household has perhaps a few head, and an 18-year-old son is home too.
- **After scoring (q5, q8):**
  - The son 38809 is `rest — at home: storm` 09:03–12:01. The calendar marks the day a storm, 05:45–13:30 (calendar.ts l. 60: "lightning or rain > 0.7 = storm").
  - The sample's header shows only "rain", because the tool prints the weather system's day, which has `thunder: false`.
  - Tool note: print the day's storm span (S6).

### 45124: boy of one month, town (score 4)
Sunrise 06:03, sunset 17:56. Household 478: mother 1573 (treasury, f 43), a man of 26, a girl of 13 and a girl of 8.
- **Fine:**
  - Carried on the mother's back to the well, the mill (07:04–09:34) and workshop 2 (09:39–15:00), in line with E-70 ("a new child joins the mother's group").
  - Nursed at the mill and the workshop, and asleep on a mat beside her.
- **Long gaps.**
  - Eight feeds.
  - `13:29–13:46 eat` is followed by `18:32–18:46 eat` (ll. 383, 393): 4 h 46 min in daylight. Then 4 h 06 min to `22:52`.
  - Two consecutive gaps of 4–5 h is the low edge for a breastfed one-month-old.
- **After scoring (q4):**
  - The mother's plan from 15:03 to 18:32 is grind, talk, knead, bake, cook, eat and talk, with no nursing.
  - The project's own rule is `infant_care.day_feed_every_h` [1.6, 2.8].
  - Across the year (every 7th day), 678 of 15,312 baby-days under 60 days old (4.4 %) have a gap of more than 4 h between feeds that both fall between 06:00 and 20:00 (S4).

### 31197 Appiyama: farmer, threshing and the vigil (score 4)
Sunrise 05:03, sunset 18:56.
- **Fine:**
  - Threshing with the animals `05:33–10:30`, in E-43's window.
  - The carried bread eaten at the floor at 07:33. Round 3's S6 is fixed.
  - The midday meal at home and sleep 11:08–15:18. The line gives both reasons, the heat and the night ahead.
  - To the floor at 19:16, sitting up by the heap and asleep there from 22:51 (Q-225).
- **Thin.** No winnowing on a 2 m/s day, and `15:39–18:16 rest @ h:7295 — at home` (2 h 37 min), in the hours when an afternoon wind would usually take the winnowing.

### The twelve 5s, in one line each
- **#100 Kamiya:**
  - bread at 04:43, on site by 05:19;
  - overseeing between the drum, the capital and the N door (ll. 93–114);
  - home at noon on a 35 °C day (E-64), a 3-h sleep through the heat, supper at 18:22.
  - Quibble: a marking-out foreman carries the chisel bag.
- **#109 Belšun:** fluting a raised shaft 07:07–15:31 on a dry −2 °C day; the face wrapped against the dust.
- **383:** a mason's day of 06:27–15:30 on a double-bull capital.
- **45426 Kuraaza:**
  - nine feeds, the longest daytime gap about 2.5 h;
  - the mother is "off work after the birth" (plan checked);
  - she spins in the lane from 15:53, near the hottest hour of a 39 °C day (a quibble).
- **5895 Damakil:** a sick day in a household with two ill; `lie_ill` runs to midnight, but it is performed as sleep.
- **6917 Ratukka:** ten feeds, the canal and the well on the mother's back.
- **34914 Bazzikka:** the age-8 rule shows as her first fuel and water tasks; no birthday meal, which is right, since E-37 is for adults.
- **44149 Bakabana:** a staying day of the band (Q-223), right for the autumn pass.
- **43615 Kašunda:** a 2-h queue for the party's rations, then mending, trade and knucklebones.
- **11523 Naputurriš:** ten feeds, the longest gap 3.3 h. Quibble: the mother kneads at 03:24, 1 h 55 min before sunrise, on a day outside the harvest (plan 11518 checked).
- **43763 Bakabadada:** arrival, halmi, rations, animals, sleep. `15:51–16:21 walk @ station — arriving` is a long 30 min.
- **29211 Rapsaka:** a full, varied winter day for a farm wife.

## Findings

**S1. The Treasury's "receive" task turns one small delivery of hides into whole working days.** Severity: **blocking** (1888).
- **Evidence.** Sample ll. 190 and 192: 1888 spends 05:52–12:00 and 12:28–15:30 at `inspect @ treasury_store — receiving hides at the treasury store {CE-07}`.
- **Cause:**
  - `population.ts` l. 2546 labels the task "receiving hides" whenever there is a slaughter today *or* yesterday.
  - `lives.json` `job_tasks.treasury_staff` draws `receive` with weight 0.15, separately for the morning and the afternoon (`terraceWorker`, l. 2482). Every member of the Treasury staff draws it, including shiners.
  - Nothing ties the task to the carriers' delivery (l. 2680), which takes 0.5 h at the store, or to the number of hides.
  - On a slaughter day with none the day before, the label applies although the carriers bring the hides only the next day.
- **Measured (seed 1, q1–q2):**
  - Day 7: 9 hides arrive at 09:10. 16 staff (4 weighers, 11 shiners, 1 storekeeper) plan 103 person-hours of receiving them, and 7 of them spend the whole day at it.
  - The year: 37 slaughters, 67 days with the label, 1,016 person-days, **5,943 person-hours**, and 333 whole days of "receiving hides". That is roughly 15 person-hours for each hide delivered.
- **Fix.**
  - Make the receiving an errand of 0.5–1 h for one or two store staff, at the carriers' arrival.
  - On other days the draw should fall to the person's own trade: weighing and keeping for a weigher, shining for a shiner.
  - "Receiving goods" should likewise be tied to a delivery that exists.

**S2. From Nisanu to Abu, an unmarried guard on a night-watch day cannot leave the garrison.** Severity: **medium** (#10: 13 h at one hearth).
- **Cause.** The no-family branch of `free()` (population.ts l. 2091) requires `this.t > 7` at the call. On a C-watch day `free()` is called once, straight after breakfast (l. 2113). From spring to late summer, breakfast ends before 07:00.
- **Measured (q7, every second day, all detailed guards).** C-watch days of men without family that include a trip to the town or the river:

  | months | days | with a trip |
  |---|---|---|
  | 1–5 | about 478 | 0 |
  | 6 | 97 | 9 |
  | 7–11 | 88–92 a month | 46–51 a month |
  | 12 | 84 | 12 |
- **Also:** the "short sleep before the night watch" starts after the meal before the watch and ends at 21:27. So on a summer C day the man sleeps about 2 h before an 8-h watch. The afternoon heat, which a man with the night ahead would sleep through, goes to leisure instead.
- **Fix.** Start the free time's town branch after a first spell of leisure until 07:00, or split the day at noon. Offer a sleep in the afternoon heat before a night watch.

**S3. Married guards seldom see their families on watch days.** Severity: **low**; design, C.
- **Evidence.** #46 (A watch) and #75 (C watch) spend 11–13 free hours at the hearth. Their families are 20–30 min away.
- **Design.** Visit chances are 0.25 after A and 0.35 on a C day (population.ts ll. 2105, 2113). The day-off chance is 0.7 (`lives.json` `guard_off_day`).
- **Measured (q7):** 12–31 % of married guards' A and C watch days include a visit, by month.
- Plausible for a garrison kept within call, but it should be logged with Q-060 as a choice.

**S4. Babies under two months have daytime feed gaps longer than the planner's own rule.** Severity: **medium** (45124).
- **The rule:** `infant_care.day_feed_every_h` [1.6, 2.8].
- **Evidence:** 45124 is unfed 13:46–18:32 (4 h 46 min, sample ll. 383–393) while the mother grinds, kneads, bakes, cooks and eats at home. Feeds are cut out of her work spells at the mill and the workshop ("stopping to nurse the baby"), but none falls in her afternoon at home.
- **Measured (q4, every 7th day):** 678 of 15,312 baby-days under 60 days old (4.4 %) have a daytime gap of more than 4 h.
- I did not trace the line in the planner that skips the feed.

**S5. No dress for the cold (§9.2 "People … cover up in cold").** Severity: **medium**; recurs from round 3 S10.
- **Evidence:**
  - #109 leaves at 06:25 at −2 °C (l. 131);
  - 34914 is out for fuel 08:19–09:45 on a −3 °C morning (l. 328);
  - also #111, 43615 (−4 °C) and 29211.
- **Cause:**
  - The planner's `wear` is set only for dust (population.ts l. 1365; the tool prints `wears`).
  - `outfits.ts`, `looks.ts` and `crowd.ts` have no rule on temperature or season (grep).
  - The rain shelter's "cloak drawn over the head" (l. 1675) is the only cloak in the planner.

**S6. Tool and labels.** Severity: **low**.
- **Weather header.** The tool's weather header prints the weather system's day, not the calendar's `storm` and `stormH` that the planners obey. Day 324's "rain 12.4 mm" is a storm 05:45–13:30 for the planners (38809 "at home: storm").
- **Heat quibbles:**
  - 45426's mother spins in the lane from 15:53 on a 39 °C day, just after "sleeping through the heat" to 15:50;
  - 6917's mother draws water at 14:57 on a 37 °C day.
- **Very early baking.** 11523's mother kneads at 03:24 on a non-harvest day (Q-149's "before breakfast" is honoured, but breakfast is at 05:20).
- **Captions:**
  - 43763's `walk @ station — arriving` lasts 30 min;
  - #100's foreman carries a chisel bag while marking out;
  - #111's "kept for the late-comer" is right, but he chose to stay out 24 min into the meal, 4 min from home.

## Earlier rounds: do their findings recur?

| earlier finding | status in this sample |
|---|---|
| R3 S1: the tool draws dead agents | **Fixed.** `presentDay` re-draws, and all 20 are present. |
| R3 S2: the detailed tier in the abstract LOD | **Fixed in the tool** (`a.lod = 'full'`). No dropped meal is seen: #46's bread relief at 08:34–09:04 works. |
| R3 S3: the leader's fixed loop | **Fixed.** #10 walks his own file's 9 posts after the change, then waits within call, then a second round 62 min later. |
| R3 S5/S6: water never drawn; bread carried out that vanishes | **Fixed here.** 31197 eats the carried bread at the floor. Mothers' well trips draw water (6917 at the well 14:57–15:18). |
| R3 S7: no baking | **Fixed.** 29211 and 11518 knead and bake. 1573 bakes in the evening for the next day (Q-149). |
| R3 S10 / R5: cold and idle filler | **Cold recurs (S5).** Filler is reduced: #111 and 38807 are the thinnest. |
| R4 S5: infants awake while mothers work | **Fixed.** Babies sleep on mats, in laps and on backs. **New:** long daytime gaps (S4). |
| R5 S1: shelter in the open field in rain | **Not seen.** 38807 stays in on a rain and storm day. |
| R5 S2/S3: minding, age read from day 1 | **Age fixed** for 34914 (her age-8 tasks appear). Minding was not sampled. |
| R5 S4: a guard's second breakfast | **Not seen.** |
| R5 B S8: a household member's illness hidden | **Fixed.** Headers print "(ill today)" (5895's household). |
| Placeholders | **None** in the sample. |

## What I checked

| check | how | result |
|---|---|---|
| Calendar | my day → month table against all 20 headers | all agree |
| 1888's day is his plan | q1: `P.plan(1888, 6)` | identical to sample ll. 186–197 |
| Hides on day 7 | q1, q2: E-12 events on days 5–7, the carriers' plans, all Treasury staff plans | 9 hides, delivered 09:10–09:40; 16 receivers, 103 person-hours, 7 all day |
| Hides over the year | q1: every day, all 88 Treasury inside and store staff | 37 slaughters; 67 days; 1,016 person-days; 5,943 person-hours; 333 whole days |
| 1888's year | q6: his first Treasury task on each working day | 331 days: silver 125, "weighing silver and goods" 147, hides 12 (8 whole days), goods 24, carrying 23 |
| Guards' trips and visits by month | q7: all detailed guards' plans, every second day | S2 and S3 tables |
| Guard planner | population.ts ll. 2060–2120 | the `t > 7` condition (l. 2091); visit chances 0.25 / 0.35 / 0.7 |
| Infant feeding | q4: 1573's plan; gaps for every baby under 60 days, every 7th day | 4.4 % of baby-days with a daytime gap > 4 h |
| Mothers' plans | q5: 11518 (day 22), 6901 (day 108) | 03:24 kneading; lying-in spinning in the lane from 15:53 |
| Rain and storm day | q8: `cal.ctx(323).wx` against `W.days[323]` | storm 05:45–13:30 in the calendar; `thunder: false` in the weather; the header shows only rain |
| #111's supper | q6: wife 335's and son 336's plans | the household ate 16:19–16:58 |
| Cold wear | grep of population.ts, outfits.ts, looks.ts and crowd.ts | dust wrap only |
| Placeholders | the sample; activities.ts l. 165 | none |
| Tool | tools/shadow_days.ts, tools/shadow_pick.ts | detailed agents in the full LOD; population people are plans; present-day draws |

The scratch scripts q1–q8 are in the session scratchpad. They import `freshSim` from `tools/shadow_days.ts`, only read plans and calendar contexts, and write nothing to the repo.

## VERDICT

**FAIL.** 1 of 20 people scores below 4:

| person | score | cause |
|---|---|---|
| 1888, Treasury weigher | 3 | about 9 h 10 min "receiving hides" for 9 hides that arrive at 09:10 (S1) |

The minimum before a re-review:
1. Fix S1: tie the receiving of hides and goods to a delivery and its size, and keep the Treasury staff at their own trades otherwise.
2. Fix S2: the no-family town branch on summer night-watch days.
3. Fix S4, the daytime feed gaps. It did not fail anyone here, but it breaks the planner's own rule on 4.4 % of young babies' days.
4. Draw a fresh 20-person sample with a new pick seed.

S3, S5 and S6 are not blocking. S5 (cold dress) is a §9.2 requirement that has recurred since round 3.
