**VERDICT: PASS.** No score is below 4. 7 of the 20 people score 5 and 13 score 4. The sample regenerates byte-identical (md5 `e784654c301f21a8a41c7682f4170dcf`), so it reports the simulation faithfully.

The pass is narrow, and one simulation fault shows in a shadowed person's own day. Official **#133** (Tashritu 23) walks from the Treasury to the stair head, goes down off the Terrace and comes straight back up to the gate hall he has just passed. The plan gives that walk 3 minutes; the stepped agent takes 38. The cause is year-wide (S1). Every plan walk between two Terrace places is written as a `road:terrace` block, and the stepped simulation sends any block that is not on the Terrace to the town edge. In seed 1 this happens on 532 agent-days:
- scribes: 349 days, sent down and back up on the way from the Treasury desk to the Treasury store;
- officials: 160 days;
- guards: 23 nights, each a sick man "helped back to the garrison quarters" by way of the stair foot.

I scored #133 **4**: the detour is about 20 minutes of an otherwise sound day. Three further year-wide weaknesses sit behind other 4s:
- a guard's long visit to his family is a few blocks of "talk" with no sleep through the heat (S2);
- a town porter works a 4-hour window and "carries sacks into the storehouse" on days when nothing is delivered (S3);
- round 9's fix of the women's names is incomplete: Roxane, Phaidyme and Irdabama, all royal or noble women, still name 1,055 Persian women (S4).

**No score changed after scoring.** One remark was a misreading of the sample itself and is corrected below: the "age rule" stratum for 8337.

# Shadow review, Phase 5, round 10, reviewer A (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. Before scoring I read no simulation code or data, no earlier round's scores or findings, and not `DECISIONS.md`.
- **Date:** 2026-09-25.
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick181.txt`. It is seed 1, pick seed 181: 522 lines, md5 `e784654c301f21a8a41c7682f4170dcf`, checked before reading. No earlier reviewer had seen it. It holds:
  - **6 detailed Terrace agents:**
    - a guard who is a leader of ten (#90);
    - two guards (#12, #77);
    - a scribe (#120), a mason (#109) and an official (#133).
  - **14 people of the population:**
    - 2 Terrace workers (759, 44787);
    - 3 townspeople (2902, 2832, 7016);
    - the six conditioned cases:
      - a man in the open on a rain day (35731);
      - a child past an age-rule birthday (8337);
      - a baby under four months (45918);
      - a herder (44135);
      - a traveller (43603);
      - a grain-heap vigil (14207);
    - 3 drawn from everyone (18579, 9282, 36403).
- **Read before scoring:**
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 is 1 Nisanu, 17 Apr 467 (Julian). The day-to-month table is: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 printed dates agree with it. Examples:
    - day 156 = Ululu 8 = 19 Sep 467;
    - day 230 = Arahsamnu 23 = 2 Dec 467;
    - day 324 = Shabatu 29 = 6 Mar 466;
    - day 354 = Addaru 29 = 5 Apr 466, the last day of the year.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - For the protocol and the report's shape:
    - `REVIEWS/shadow_phase5_r3.md`, ll. 1–40: the protocol's wording;
    - `REVIEWS/shadow_phase5_r9.md`, ll. 1–30, and its list of section headings.
  - A grep of `research/OPEN_QUESTIONS.md` for the topics the days raise:
    - guards' days off and families; winter halves; spinning and grinding; servants; porters; herders; travellers;
    - the midday sleep; the threshing vigil; canal clearing; birthdays; knucklebones.

    From it I read Q-037, Q-057, Q-060, Q-065, Q-128, Q-143, Q-149, Q-223–Q-226, Q-296, Q-341 and Q-365.
  - The 20 scores, each with a paragraph, were then saved to `shadow_r10_A_scores.md` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5_r9.md`, ll. 30–200: the header, the scores and the findings S1–S3.
  - The verdict line of `REVIEWS/shadow_phase5_r9_b.md`, and the finding headings of r9 B, r8 A and r8 B.
  - **Reviewer B, round 10.** `REVIEWS/shadow_phase5_r10_b.md` appeared in the tree during this review. A grep for earlier reports of the S1 fault printed two kinds of line from it:
    - its first line (the verdict and its counts);
    - two lines of its finding on the same Treasury-to-gate-hall walk.

    I read nothing else of it. My scores had already been saved and did not change.
  - `tools/shadow_days.ts`, ll. 1–110 and 140–148 (`pickSample`, `ageStr`, `dayLine`).
  - From `src/people/population.ts`:
    - `go()` (ll. 1735–1762);
    - the guard's family visit (ll. 3075–3096);
    - `official()` (ll. 3797–3816);
    - `townPorter()` (ll. 3577–3581);
    - the evening's lane and meal (ll. 2318–2331);
    - the traveller's stay (ll. 4205–4240);
    - the names: `ALL_NAMES`, `NAME_POOLS`, `ORIGIN_POOL` and `nameFor` (ll. 1584–1616);
    - greps for `heatRest`, `curds` and "kept for the late-comer".
  - From `src/people/sim.ts`: `decide`, `decide0`, `setDown` and the head of `onTerrace` (ll. 225–300).
  - From elsewhere:
    - `src/people/calendar.ts` l. 93 (frost is `tmin < 0`);
    - `src/people/planCheck.ts` l. 263;
    - `src/data/lives.json`: `work_day` and `herders`;
    - `src/data/names_recalled.json`: the Iranian women's rows and `_meta`.
  - Read-only scratch scripts `r10A_q1`–`r10A_q9` in the session scratchpad, outside the repo. Each imports `freshSim` or `detailedDay` from `tools/shadow_days.ts` and reads the plans of seed 1.
  - I regenerated the sample with `npx tsx tools/shadow_days.ts 1 181` into the scratchpad. It is byte-identical.
  - I did not read `DECISIONS.md`.
- **Score changes after reading the code:** none.
  - **Corrected misreading (8337).** I wrote that the pick line calls him a child who turns 1, 5 or 8 on the day, and that at 19 months the stratum was not met. The line says the child is 1, 5 or 8 on the day, past a birthday that crossed the rule. He is 1 (19 months), past his first birthday. The remark is withdrawn. It never affected his score.
  - **Remarks withdrawn** on reading the code, with the scores unchanged:
    - 44787: the morning is not a frost morning (Tmin 0.45 °C).
    - 2902: the late-comer label is checked against the household's meal.
    - 43603: "another errand" follows the morning's stop at the station.
- **Files:** I modified no project file other than this one.
  - While I worked, someone else changed `src/people/sim.ts` (6 lines added to `decide0` at 20:18, citing "shadow review r10 B, S1") and added `tests/terrace_walk.test.ts` (20:18).
  - Neither change is mine. The regeneration and all my scripts ran on the committed tree (HEAD `e2b9652`) before that edit. The stepped confirmation of S1 ran at 20:13.
  - I have not checked whether the edit fixes S1.

## Read first: what is broken or placeholder

1. **The gate passes for this reviewer.** The lowest score is 4, held by 13 people.
2. **A stepped-simulation fault is in a shadowed day (S1, #133).** A walk between two Terrace places goes off the Terrace and back:
   - **#133**, the official, climbs down the stair and back up in a 38-minute walk that the plan gives 3 minutes.
   - **Scribes:** 349 scribe-days of the year repeat it on the way to the Treasury store, a 49-minute walk inside the Treasury (stepped).
   - **Sick guards:** 23 guards taken ill on the night watch are walked down off the Terrace and back up to their quarters.
3. **Year-wide weaknesses behind 4s:**
   - **S2:** a guard's long family visit is 3–4 blocks of talk, with no sleep through the heat. This is #90's and #12's hollow day.
   - **S3:** a town porter's 4-hour window, and the storehouse act on issue-only days (2832).
   - **S4:** royal and noble women's names are still in the everyday pool (36403, Roxane).
4. **No placeholders in this sample.** No line carries `[PLACEHOLDER`.
5. **Caveat: most findings are plan-level.** Only the six detailed agents are stepped on the nav grid. S1 is confirmed in the stepped simulation, for #133 in the sample and for scribe #119 and guard #0 by script. S2–S4 are plan-level.

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #90 (unnamed) | guard, leader of ten, m 33, Persian | 156 (Ululu 8, 19 Sep 467; 16–36 °C) | **4** | His second day off: 10 h at his family's house, 8 h 40 min of it "talk", no rest in the heat, back up at sunset (S2). |
| 2 | #12 Umanna | guard, m 26, Persian | 104 (Duzu 15, 29 Jul 467; 20–39 °C) | **4** | Same shape: 11.5 h at home with a wife of 17 and a baby, "talk" through a 39 °C afternoon, knucklebones (S2). |
| 3 | #77 (unnamed) | guard, m 40, Median | 69 (Simanu 10, 24 Jun 467; 16–35 °C) | **5** | The 06–14 watch at the W gate, relieved to eat, a jar at the post through the heat, a short sleep, kit, the hearth. |
| 4 | #120 Anani | scribe, m 54, Babylonian | 197 (Tashritu 20, 30 Oct 467) | **4** | 7 h of Aramaic on leather at the Treasury desk. 1.5 h idle at dawn; the camp's bread at noon. |
| 5 | #109 Bēl-ēṭir | mason, m 27, Babylonian | 52 (Aiaru 23, 7 Jun 467; 15–33 °C) | **4** | A double-bull capital from 05:34 to noon, home, a sleep through the heat, the lane. A 4-minute carving blip after the meal. |
| 6 | #133 (unnamed) | official, m 31, Persian | 200 (Tashritu 23, 2 Nov 467) | **4** | A payment declared at the Treasury, the gate hall, the official building, his wife's birthday meal. A stair-foot detour between two Terrace stops (S1). |
| 7 | 759 Ištimanka | builder, m 26, Thracian | 324 (Shabatu 29, 6 Mar 466; heavy rain to 13:30) | **4** | Rain and the winter halves: home all day, mending, rest, talk, the fire lit. Dull, right. |
| 8 | 44787 Šamaš-iddin | builder, m 26, Lycian | 230 (Arahsamnu 23, 2 Dec 467; 0–16 °C) | **4** | Water for the mortar, the earth ramp, home to fetch the house's water and light the fire, neighbours at dusk. A Babylonian name on a Lycian (S5). |
| 9 | 2902 \*Hučiθrā | servant, f 22, Elamite | 310 (Shabatu 15, 20 Feb 466; rain from 17:30) | **4** | 5.5 h at the quern and 3.7 h at the spindle in alternation, water twice. Heavy but plausible; rigid. |
| 10 | 2832 Irtuppiya | town porter, m 27, Persian | 327 (Addaru 2, 9 Mar 466) | **4** | 4 h of sacks "into the storehouse" on a day with no delivery, then 3.5 h of rest on a mild afternoon (S3). |
| 11 | 7016 Barukka | boy, 5, Elamite | 55 (Aiaru 26, 10 Jun 467; 18–38 °C) | **4** | With his mother all day: a neighbour's house, the lane, the well, a nap, the quern. No other children in his day. |
| 12 | 35731 Mikrašba | farmer, m 55, Persian | 354 (Addaru 29, 5 Apr 466; rain 12:15–16:45) | **5** | Hoeing and weeding till the rain, home out of it, mending, an exchange with neighbours after it. |
| 13 | 8337 Irdabada | boy, 19 months, Persian | 250 (Kislimu 14, 22 Dec 467; −3–11 °C) | **4** | Nursed and fed, the well and the lane with his mother, a midday sleep in the lane, 46 min with his brother of 7. |
| 14 | 45918 Bakabana | baby, 3 months, Persian | 343 (Addaru 18, 25 Mar 466; dust) | **5** | Fed every 2–3 h, on a mat by the working mother, on her back to the well with his face wrapped against the dust. |
| 15 | 44135 \*Bagastūnā | herder girl, 8, Persian | 170 (Ululu 22, 3 Oct 467) | **5** | A camp day: water, brushwood, the weak ewes at the fold, play by the tents and the stream, a sleep in the heat. |
| 16 | 43603 Mardunuya | traveller, m 55, Persian | 254 (Kislimu 18, 26 Dec 467; −4–10 °C) | **4** | A waiting day at the station: animals and gear, harness, knucklebones, the lower town. |
| 17 | 14207 Irtuppiya | farmer, m 22, Persian | 108 (Duzu 19, 2 Aug 467; 21–39 °C) | **5** | Threshing and winnowing in the morning wind, sleep for the night ahead, the vigil by the grain heap. |
| 18 | 18579 Bakabada | boy, 8, Persian | 255 (Kislimu 19, 27 Dec 467; −5–8 °C) | **5** | Animals out before sunrise, fuel twice, the men's bread to the field, knucklebones, a wheeled toy, chase. |
| 19 | 9282 Haturka | farmer, m 18, Persian | 312 (Shabatu 17, 22 Feb 466) | **5** | Clearing the village canal (E-50), home, a visit after dark. |
| 20 | 36403 Roxane | farm girl, 13, Persian | 329 (Addaru 4, 11 Mar 466; rain 06:15–12:00) | **4** | Quern at dawn, 7 h at the spindle through the rain, water after it. A royal or noble woman's name in its Greek form (S4). |

Count: 7 × 5, 13 × 4. Lowest: 4.

### The 20 days, one paragraph each (as written before reading any code; later notes are marked)

**#90, guard and leader of ten (4).** This is the second off day of his rota. He is asleep in the garrison at 00:00, has no watch all day, and is back asleep at 19:31 before tomorrow's 06:00 watch, which fits the A-B-C-off-off cycle.
- **The day:** breakfast at the garrison at 06:14; down to the town 07:13–07:40; at home until 17:45; back up at sunset (18:11); knucklebones; sleep.
- **The shape is plausible. The problems:**
  - 8 h 40 min of "talk @ h:90 — with his family", in two blocks (07:40–12:08 and 12:38–17:09) between two meals.
  - He does nothing else in the town: no errand, no lane, no help in the house.
  - He has no rest in the heat of a 36 °C day, although the second block covers 12:38–17:09.
- The day is hollow, not wrong. Nothing in it shows he leads ten men; on an off day that is fine.

*(After scoring: S2. The visit is built of 3–4 blocks, and a guard's visit never includes a sleep through the heat.)*

**#12 Umanna, guard (4).** The same template as #90, on his second off day.
- **The day:** breakfast 05:32; knucklebones; down 06:32–06:51; "with his family" 06:51–18:21, broken only by two meals; back up 18:21–18:49; knucklebones until 20:08. His family is a wife of 17 and a baby of 12 months.
- **The same hollowness:** 10 h 45 min of "talk" at home on a 39 °C day, with no nap shown and no other act. The whole town rests at midday (Q-204), and a man at home would doze.
- His name is attested in the PF. Plausible, but thin.

*(After scoring: S2.)*

**#77, guard (5).** Watch A (06–14) at post_gate_w2.
- **The watch:** breakfast at 04:55; readying; the armed walk to the post. The patrol man relieves him to eat, 09:17–09:41. He goes back with the water jar through the heat and is relieved at 14:01–14:07.
- **After the watch:**
  - a meal, and a short sleep in the heat (39 min);
  - talk with men of another file in the forecourt, then the hearth;
  - his kit, 17:08–17:59: the spear shaft oiled, the shield rim sewn;
  - the evening meal at sunset (19:01); sleep at 20:38.
- It is coherent with the rota and the relief. The carried items come and go correctly.
- He does not go down to his family (a wife and boys of 7 and 14 months), though 14:07–19:02 would allow it. That is within the rota's 0.7 draw. Nothing implausible.

**#120 Anani, scribe (4).** A scribe of 54.
- **The day:** writing Aramaic on leather at the Treasury desk, 07:51–15:31, with a 29-minute meal; home at 15:55; the evening meal at 16:44; knucklebones in the lane 17:14–17:50 (sunset 17:35); sleep at 18:50. Plausible.
- **Problems:**
  - He spends 05:32–07:05, 1 h 33 min, "at home" doing nothing before breakfast.
  - His midday meal at the desk is "the camp's bread and water": the work camp's ration bread for a senior Treasury scribe. Minor.
  - 7 h 10 min of continuous writing is long.
- The name Anani is a Judean (Yahwistic) name from Elephantine, labelled Babylonian. That is possible for a Judean of Babylonia; the name is tier C. Noted.

**#109 Bēl-ēṭir, mason (4).** A mason of 27, in a house of ten male builders, which is plausible for a gang's lodging.
- **The day:** up at 04:31; eats; walks to the site 04:51–05:34 with his chisels; carves a double-bull capital 05:34–11:36; eats bread at the site; carves again for 4 minutes (11:57–12:01); walks home; rests; sleeps through the heat 14:12–15:52; the lane 16:33–18:00; the evening meal at 18:20; sleep at 21:04.
- The day is sound. Tmax is 33 °C, so ending work at noon (6.5 h) sits at the edge of two rules:
  - E-60: dawn to mid-afternoon;
  - E-64: a midday rest when Tmax is over 33 °C, which is a rest on the site, not the end of work.
- The 4-minute return to the work after the meal is an artefact.

*(After scoring: the noon stop is the documented heat rule, `lives.json` `work_day.heat_end_h`, C, Q-062. The 4-minute blip is the site meal set inside a block that ends at 12:00.)*

**#133, official (4).** An official of 31.
- **The morning:** up at 06:12; breakfast of "the new bread" at 07:28; up to the Treasury 08:13–08:43 to declare a payment (E-05), until 09:57.
- **The detour:**
  - 09:57: walk to road:terrace, 12 minutes on the Terrace.
  - 10:09–10:27: walking off the Terrace.
  - 10:27: walk → gate_hall; inspection 10:35–10:58.

  He walked from the Treasury to the stair head, went down off the Terrace for about 9 minutes, and climbed straight back to the gate hall he had just passed. That is a ~20-minute round trip down the stair and up again, with nothing done at the bottom.
- **The afternoon:**
  - down to the official building (N of the Terrace), 11:16–15:01, with a meal;
  - knucklebones in the lane, 15:13–16:38: 1 h 25 min for a man with three servants;
  - home, and "a birthday meal for \*Čiθrazātā", 16:50–18:34.
- The honoree cannot be identified from the sample. He is unnamed, and the form looks feminine: perhaps his wife of 23.
- The detour is the one concrete fault; the rest is plausible. A notable 4.

*(After scoring: S1, a simulation fault. The plan gives the walk 3 minutes, 09:56–09:59; the stepped agent is sent to the town edge. The birthday is his wife's, \*Čiθrazātā, person 2768, whose birthday is day index 199, from the reconstructed pool, D-213.)*

**759 Ištimanka, builder (4).** A builder of 26, Thracian, in a house of ten builders.
- **Why he stays home:** Shabatu 29 has heavy rain 05:45–13:30, and it falls in the winter halves (E-62, months 9–11). Both reasons hold.
- **The day:** 1 h 39 min of talk before breakfast; mending tools and baskets for 1 h 43 min; about 6 h of rest and 4 h of talk; the fire lit at 16:21 (sunset 17:45); the evening meal; sleep at 19:32.
- After the rain stops at 13:45 he still never leaves the house. By the late afternoon a lane or the well would be likely. Dull, plausible.

**44787 Šamaš-iddin, builder (4).** A builder of 26, Lycian, in a house of four men. Arahsamnu 23 is month 8, before the winter halves; the day is 0–16 °C and dry.
- **The day:**
  - walks up 06:39–07:09;
  - carries water for the mortar 07:09–12:00;
  - the camp's bread 12:00–12:30;
  - hauls earth for the ramp 12:30–15:30;
  - home at 16:00: fetches the house's water, lights the fire, eats;
  - neighbours in the lane at dusk and after dark; sleep at 19:25.
- The day is very good. **Problems:**
  - The name Šamaš-iddin is Babylonian (Akkadian, "Šamaš has given"), on a Lycian. §9.1 asks for names matched to origin.
  - Mortar work on a morning at 0 °C is at the edge of CE-12 (no mortar on frost days). That is no fault if the simulation's frost is below 0.
- Scored on the day: 4, because of the name.

*(After scoring: the frost remark is withdrawn, since Tmin is 0.45 °C and frost is `tmin < 0`. The name is the documented thin-pool fallback, S5.)*

**2902 \*Hučiθrā, servant (4).** A servant of 22 in a scribe's household of six.
- **The day:** she grinds for 5 h 32 min in five spells and spins for about 3 h 40 min in five spells. She fetches water twice and eats three meals, the last "the evening meal, kept for the late-comer" at 17:00. Sleep at 19:17.
- A servant's heavy day at the quern is plausible. Q-296's 1 kg an hour would give more flour than six need, but 3–5 h a day at the quern is the ethnographic norm.
- **Problems:**
  - the rigid alternation of grinding and spinning;
  - she does no baking, cooking or serving, and does not mind the three boys;
  - the "late-comer" label does not fit a woman who was at home all day. As a servant she may eat after the family, but the label says otherwise.
- The rain at 17:30 is respected.

*(After scoring: the label is checked by `planCheck` (d); the household had eaten before her. The remark is withdrawn.)*

**2832 Irtuppiya, town porter (4).** A porter of 27, Persian, in the household of an official of 51 (a son?).
- **The day:**
  - eats alone before leaving; the household eats later;
  - carries sacks into the town storehouse 06:57–11:02;
  - home at 11:22; the midday meal;
  - "resting at home after work" 12:38–16:12;
  - mends tools "on the doorstep" 16:18–17:05, reached by a 6-minute walk each way, which is not a doorstep;
  - the evening meal; sleep at 19:44.
- **Problems:**
  - The working day is 4 h 5 min on a mild March day (19 °C), and the 3.5 h afternoon rest is unexplained. It would be plausible if a delivery was finished, but Addaru has few grain deliveries (E-06: 0–3 a month).
  - The son of an official working as a storehouse porter is a status oddity.
- A notable 4.

*(After scoring: S3. There is no delivery at all that day, only ration issues. A town porter works a 4-hour window on 40 % of days.)*

**7016 Barukka, boy of 5 (4).** He is with his mother (7012) all day.
- **The day:**
  - up at 06:00; visits another house 06:34–08:17 while the mother talks;
  - the lane 08:30–10:32; home;
  - the well at 12:32, at the peak of a 38 °C day; home;
  - the mother talks 13:31–14:40;
  - sleeps with her 14:40–16:22; the well again;
  - the mother grinds 16:45–17:41; the meal at 18:11; sleep at 20:18.
- A small child's day is plausible. **Problems:**
  - He never plays with other children, or with his siblings of 8 and 12.
  - The mother's visible day is heavy on talk and visits (1 h 43 min at 06:34, 1 h 09 min at 13:31). It is light on work for a household of seven: 56 minutes of grinding and two short water trips.
  - One water trip is at noon at 38 °C.

**35731 Mikrašba, farmer (5).** A farmer of 55, on the last day of the year.
- **The day:**
  - breakfast of new bread;
  - hoes and weeds the growing crop 06:48–11:50, right for early April;
  - eats the bread he carried out at 11:50;
  - walks home as the rain begins at 12:15, and rests out of it;
  - mends tools and baskets 14:21–17:00; the evening meal;
  - exchanges goods with neighbours after the rain (17:56);
  - sleep at 20:36.
- Everything is timed and has its reason.

**8337 Irdabada, boy of 19 months (4).** With his mother all day.
- **The day:**
  - nursed at 02:32; asleep until 07:34;
  - carried to the well at −3 °C just after sunrise, and "playing" there for 14 minutes;
  - meals with the household at 07:54, 11:56 and 16:02; nursed at 11:15 and 14:33;
  - the lane 08:49–10:03, then the well again;
  - a midday sleep in the lane 12:32–14:08, then 22 minutes more at home;
  - 46 minutes taken along by his brother of 7;
  - sleep at 17:50.
- Plausible for a toddler in the winter sun. **Problems:**
  - "Playing" at the well at dawn in frost; he would be carried or held.
  - ~~The pick line says he is a child who turns 1, 5 or 8 on the day, but he is 19 months: the conditioned case is not met.~~ *(Corrected after scoring. This was my misreading of the sample. The line says the child is 1, 5 or 8 on the day, past a birthday that moved it across the rule. He is 1. The stratum is met.)*

**45918 Bakabana, baby of 3 months (5).**
- **Feeds:** 01:32, 04:22, 06:31, 09:05, 11:28, 14:00, 15:43, 17:54, 19:55 and 22:48.
- **Sleep:** awake 0.75–1.5 h after each feed, about 12.7 h asleep in all.
- **With the mother:** to the well twice on her back, his face wrapped against the dust.
- **Details:**
  - Two zero-length lines (07:59–07:59 and 17:12–17:12) are print artefacts.
  - The mother is at work from 03:51, before dawn. That is plausible, for grinding.
  - The sleep total is a little under the modern 14–17 h norm, but within variation.

*(After scoring: the simulation's median at 90–119 days is 13.5 h, with a 10th percentile of 11.9 h. Sub-minute segments are 152 of 126,456 sampled.)*

**44135 \*Bagastūnā, herder girl of 8 (5).** A camp day for her band of 30: the flock is out with the men, and the lame and weak ewes are kept back at the fold.
- **The day:**
  - water from the stream twice, and brushwood three times;
  - 1 h 13 min with the ewes;
  - play with the other children;
  - bread and curds;
  - sleep in the tent through the heat;
  - the evening meal by the fire; sleep at 19:04.
- About 4 h of chores and 5 h of play, which fits Q-143 for her age.
- Curds in October, before the lambing, could be dried stores. Plausible.

*(After scoring: "bread and curds" is the camp's food when there is no milk, population.ts l. 4271. Stored curds; not a fault.)*

**43603 Mardunuya, traveller (4).** A traveller of 55 in a party of seven, on a waiting day at the station in December.
- **The day:**
  - the animals and gear, 2 h 14 min;
  - knucklebones; rest; mending harness;
  - the midday meal;
  - "on another errand" (there was no first errand) to see the lower town, 13:24–15:11;
  - rest; the evening meal; talk by the fire; sleep at 19:37.
- A waiting day is plausible, since a party stays 1–5 days. But nothing in it shows why the party is at Persepolis, and the errand label is a leftover of the template.

*(After scoring: "another" is the second of his day's errands, after the gear at the station (l. 4240). The party's business with the official, the store and the Treasury falls to its leader. The label remark is withdrawn.)*

**14207 Irtuppiya, farmer (5).** A farmer of 22, on a threshing day and a vigil night.
- **The day:**
  - threshes and winnows on the village floor 05:31–10:30, in a 4 m/s wind;
  - home out of the heat;
  - sleeps 11:08–15:40, because he keeps the vigil tonight, as the label says;
  - sees to the animals; talks with the men of the lane; the evening meal;
  - out to the floor at 19:35; sits up by the heap and sleeps beside it.
- Coherent, with its reasons given (Q-225).

**18579 Bakabada, boy of 8 (5).** A December day.
- **Work, about 3 h:**
  - lets the animals out and waters them before sunrise;
  - waits for the bread;
  - gathers dung and brushwood twice, about 2 h 10 min with the carrying;
  - carries the bread out to the field and eats there.
- **Play, about 4 h (Q-143):** knucklebones, a wheeled clay animal, chase.
- The evening meal at 16:14; sleep at 18:09.
- **Minor:** the wheeled toy is young for 8, and "the men" at the field are one man of the household, though kin are possible. Plausible.

**9282 Haturka, farmer (5).** A farmer of 18.
- **The day:**
  - clears the village canal (E-50, month 11) 07:57–15:00, on the bread he carried out;
  - home; the evening meal;
  - visits Mikrašba at dusk and after dark, 17:06–18:48;
  - sleep at 19:06.
- The late start is reasonable on a cold February morning. Sunrise is 06:24; he spends 1 h 15 min idle at home, then 40 minutes of talk.

**36403 Roxane, farm girl of 13 (4).** A rain morning.
- **The day:**
  - grinds 05:16–05:49, then idles at home for 1 h 21 min until breakfast of the new bread at 07:10;
  - spins 07:37–11:56 through the rain; the midday meal;
  - fetches water after the rain stops, at 12:42 and 15:00;
  - spins; plays indoors for 1 h 04 min, under the teenage cap;
  - spins until 17:07; sleep at 18:50.
- About 8 h of work, which fits Q-365. The day is sound.
- **Problem: the name.** "Roxane" is the Greek form of an Iranian name. It is known from Alexander's Bactrian wife and from a noblewoman in Ctesias, and here it is given to a farm girl. §9.1 asks for attested names from the tablets, matched to origin.
- Scored 4, because of the name.

*(After scoring: S4, the incomplete fix of r9 S3.)*

## Findings

**S1. A detailed agent's walk between two Terrace places goes off the Terrace and back (#133).** Severity: **medium**. It is the one fault in a shadowed day, it is visible, and it is year-wide.

- **What (#133, day 200).** The plan has three blocks here:

  ```
  8.51– 9.94 terrace treasury_desk talk  declaring a payment at the Treasury
  9.94– 9.99 road    road:terrace  walk  on the way
  9.99–10.96 terrace gate_hall     inspect an inspection round of the gate hall
  ```

  The stepped agent (sample ll. 128–131) takes a different route:
  - 09:57: walk → road:terrace;
  - 10:09: off the Terrace;
  - 10:27: walk → gate_hall;
  - 10:35: inspect.

  He walks from the Treasury to the stair, down it, and straight back up to the gate hall he passed. That is 38 minutes for a 3-minute walk, and a figure going down the grand stair and at once back up is drawn on the Terrace legs.
- **Cause.**
  1. `Planner.go()` (population.ts l. 1761) writes every walk as a block at `road:${whereTo === 'terrace' || wf === 'terrace' ? 'terrace' : whereTo}` with `where: 'road'`, including a walk whose ends are both on the Terrace.
  2. `decide0` (sim.ts l. 250) treats any block with `where !== 'terrace'` as off the Terrace. It gives the task the spot `PLACES.town.at` and `off: true`, so the agent heads for the town edge.
  3. The next block, on the Terrace, brings him back up.
- **Year-wide (r10A_q1, r10A_q2: seed 1, all detailed agents, 47,082 agent-days present).**
  - **546 such legs on 532 agent-days:**

    | role | agent-days | legs |
    |---|---|---|
    | scribes | 349 | 336 treasury_desk → treasury_store, "to the store for the caravan"; 13 stair_foot → treasury_store; 9 treasury_desk → stair_foot |
    | officials | 160 | Treasury → apadana_hall 51, gate_hall 48, forecourt 39, worksite 10; worksite → gate hall, Apadana or forecourt 17 |
    | guards | 23 | "helped back to the garrison quarters" |

  - **Stepped confirmation (r10A_q3):**
    - **Scribe #119, day 1:** "to the store for the caravan", 08:57 → off the Terrace 09:08 → treasury_store 09:46. That is 49 minutes to cross the Treasury.
    - **Guard #0, day 24** (Mikrašba, taken ill on the night watch): "helped back to the garrison quarters", 00:16 → off the Terrace 00:27 → garrison_sleep 00:45 → lying ill 00:57. A sick man at midnight is walked down the stair and back up, 41 minutes for a 9-minute plan leg.
- **Fix.**
  - In `go()`, when both `from` and `to` are Terrace places (`wf === 'terrace' && whereTo === 'terrace'`), emit the walk as a Terrace walk: `where: 'terrace'`, with the next place as its target. Alternatively, in `decide0`, treat a `road` block whose previous and next blocks are both on the Terrace as a walk on the Terrace to the next block's place.
  - Add a stepped check: no detailed agent may be `off` between two plan blocks that are both on the Terrace.

**S2. A guard's long visit to his family is 3–4 blocks of talk and rest, with no sleep through the heat (#90, #12).** Severity: **low**. It is why two guards score 4 and not 5.
- **What.**
  - #90: 8 h 40 min of "with his family" in two blocks, on a 36 °C day.
  - #12: 10 h 45 min of it, on a 39 °C day. No sleep in the heat, no lane, no errand.

  In the same sample, the mason #109 and the farmer 14207 sleep through the heat.
- **Cause.** The family visit (population.ts ll. 3075–3096) has a fixed sequence:
  - "talk" for 1–2 h;
  - the family's midday meal;
  - a lane spell with probability 0.5, and never when the wife is ill or dust is forecast;
  - one `rest`/`talk` block (coin toss) until 0.6 h before leaving;
  - a meal or talk.

  Nothing adds a sleep through the heat on an E-64 day. The nap rule that `siesta()` applies to the population's plans evidently does not reach this block (every hot visit below lacks one).
- **Year-wide (r10A_q6, detailed guards, seed 1).**

  | measure | count |
  |---|---|
  | family visits in the year | 21,775 |
  | visits longer than 6 h | 4,816 |
  | of those, nothing but talk, rest and meals in the house | 3,279 |
  | visits with a single talk or rest block longer than 4 h | 2,190 |
  | visits longer than 6 h on an E-64 heat day | 2,483 |
  | of those, with a sleep through the heat | **0** |
- **Fix.**
  - On a heat day, give the visit the household's sleep through the heat (the family's own hours).
  - Break a long stay into the day's occupations that Q-060 (D-186) already names for off-watch men: the family's water, an errand in the town or the lane, his kit, the children.

**S3. A town porter works a 4-hour window, and "carries sacks into the storehouse" on days with no delivery (2832).** Severity: **low**.
- **What.** On Addaru 2 (day 327) 2832 carries sacks "into the storehouse" 06:57–11:02, then rests 3.5 h through a mild afternoon.
- **What the calendar holds that day (r10A_q4):** no delivery at all (`deliveries: []`), only the month's ration issues (`issue`: 8 groups, 7.0–9.9 h). On an issue day the sacks go out to the queue, not in.
- **Cause.** `townPorter()` (population.ts ll. 3577–3581) works from `min(delivery times, issue times) − 0.5` to that time + 4 h. It prints the same act and label whatever the day's load is.
- **Year-wide.**
  - 41 days hold issues but no delivery.
  - Of 40 of the 226 town porters, over the whole year: 8,574 days at home ("no loads at the stores today") against 5,586 working days, a mean of 3.9 h.
- **A second, smaller point.** "Out to the doorstep" (l. 1697) is a walk to the quarter's lane point, 6 minutes each way. That is not a doorstep.
- **Fix.**
  - On issue days, use "carrying the sacks out to the queue for the ration issue (E-01)".
  - Let a porter's day follow the store's work, rather than a fixed 4-hour window: stacking, counting with the storekeeper, and moving stock inside the store on the days between deliveries.

**S4. Royal and noble women's names are still in the everyday pool (36403, Roxane).** Severity: **low to medium** (brief §9.1). Round 9's S3 fix flagged most of the royal names as `notable`, but not all of them.
- **Still unflagged:**
  - **Irdabama:** PEOPLE.md §1b lists her among the Darius-era royal women, "context only; not present in 467".
  - **Phaidyme:** Otanes' daughter, wife of Cambyses and of the false Smerdis (Herodotus 3.68–69).
  - **Roxane:** a noblewoman in Ctesias; best known as Alexander's wife. She stands in the pool in her Greek form.
- **Year-wide (r10A_q5):**

  | name | Persian women | other origins |
  |---|---|---|
  | Irdabama | 361 | Elamite 32, Lydian 4, Egyptian 1 |
  | Phaidyme | 361 | Elamite 45, Egyptian 2, Sogdian 1 |
  | Roxane | 333 | Elamite 37, Lydian 1, Sogdian 1, Ionian 1 |

  In all, 1,055 Persian women (about 6 %) bear one of the three.
- **Not faulted.** The composed names marked \* (\*Hučiθrā, \*Bagastūnā, \*Čiθrazātā) are the documented reconstructed pool (D-213, at the user's direction D-207, labelled in F3).
- **Fix.** Flag these three `notable`, as the file's own `_meta` rule ("royal women are kept out of the everyday pools") requires.

**S5. Note, not scored below 4: a Lycian named Šamaš-iddin (44787).**
- Lycians have fewer than `THIN_NAME_POOL` names, so their names are drawn from all the men's names (D-202; r5 S9: "foreign workers bear names that are not of their own language").
- His house-mates are Rauzazza, Kybernis and Babiruš.
- This is a documented C choice. The one evidenced example, Herdkama "the Egyptian", bears an *Iranian* name. So a draw weighted toward the Iranian and Elamite pools would be closer to the evidence than a uniform draw that hands Lycians Babylonian theophoric names.

**S6. Checked, not faults.**
- **Frost.** 44787's morning is not a frost (Tmin 0.45 °C; `calendar.ts` l. 93 has `frost: tmin < 0`), so mortar work is allowed.
- **Heat stop.** #109's stop at noon is `lives.json` `work_day.heat_end_h` = 12 on E-64 days (C, Q-062).
- **Late-comer label.** 2902's label is verified by `planCheck` (d) (l. 263): the household had eaten before her.
- **Traveller.** 43603's "another errand" is his second errand of the day (l. 4240). The party's business with the official, the store and the Treasury is its leader's (l. 4213).
- **Birthday.** #133's birthday meal is for his wife \*Čiθrazātā (person 2768, birthday day index 199). E-37 (HDT 1.133) speaks of a man's own birthday. Extending it to the wife is C, and harmless.
- **Infant sleep.** 45918's 12.65 h is within the simulation's distribution at 3 months: median 13.5 h, 10th percentile 11.9 h at 90–119 days.
- **Zero-length lines.** They are sub-minute segments (0.6 and 0.16 min), 152 of 126,456 sampled segments. The tool could merge or drop them.
- **Curds.** 44135's "bread and curds" out of the milk months is the camp's explicit no-milk food (l. 4271). Stored curds.
- **The age-rule stratum (8337).** It is met (age 1 on the day, past the birthday). Its day falls anywhere after the birthday, on average months later, so it tests the new age class rather than the crossing. A day within a few weeks of the birthday would test the rule more sharply. This is a suggestion only.

## What I read, and when

1. **Before scoring:**
   - the sample (md5 checked first);
   - the five research files and the brief's sections listed in the header;
   - r3 ll. 1–40 and the header of r9, for the protocol and the report's shape;
   - the OPEN_QUESTIONS rows listed in the header.
2. **Scores and paragraphs saved** to `shadow_r10_A_scores.md` in the session scratchpad, unchanged since.
3. **After scoring:**
   - the regeneration of the sample;
   - the tool;
   - the code and data listed in the header;
   - scratch scripts r10A_q1–q9;
   - r9 A's findings, r9 B's verdict line, and the finding headings of r8 A, r8 B and r9 B.
   - Two stray lines of reviewer B's round-10 report, printed by a grep (see the header). I read no further in it.
