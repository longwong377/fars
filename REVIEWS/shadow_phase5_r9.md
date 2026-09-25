**VERDICT: FAIL.** 1 of the 20 scores is below 4. The detailed guard **#76** (Nisanu 9) scores **3**. After his turn of the file's water duty, the water jar stays on his head. He carries it down the road to the town, through an hour's errand at the craftsmen's quarter (a shield strap, a spear shaft) and back up to the garrison (14:58–16:57). This is not a tool fault: the simulation never sets the jar down. The sample regenerates byte-identical (md5 `9a98683bb9a0bfecf279afda7d54b607`). The fault is year-wide. On 1,105 of the 4,222 guard days with the water duty (26 %), the next plan block leaves the Terrace, so the jar goes with him. Stepped days show him at bow practice and washing clothes at the river with the jar on his head (S1). Of the other 19 people, 8 score 5 and 11 score 4. After scoring I also found two year-wide faults, not in any shadowed person's own day. (a) A mother whose newborn has died goes on "resting with the baby" and "showing the baby" to neighbours: 705 mother-days in the year (S2). (b) Every named Persian woman, 18,209 of 18,209, bears the Greek form of a royal or noble woman's name, such as Parmys, Amytis, Artaynte or Sandauke (S3).

# Shadow review, Phase 5, round 9, reviewer A (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not build the simulation or see it built. I scored from the day timelines and the research files only. Before scoring I read no simulation code or data, no earlier round's scores or findings, and not `DECISIONS.md`. I did not read reviewer B's round-9 scores or report.
- **Date:** 2026-09-25
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick167.txt` (seed 1, pick seed 167; 644 lines; md5 `9a98683bb9a0bfecf279afda7d54b607`, checked before reading). No earlier reviewer had seen it. It holds:
  - 6 detailed Terrace agents: a leader of ten (#10), two guards (#76, #72), a grinder (#126) and two children of the work camp (#128, #129);
  - 14 people of the population:
    - 2 Terrace workers (998, 676);
    - 3 townspeople (2017, 3364, 486);
    - the six conditioned cases: a man in the open on a rain day (33785), a child past an age-rule birthday (30442, who turns 5 that day), a baby under four months (5094), a herder (44597), a traveller (43767) and a grain-heap vigil (32610);
    - 3 drawn from everyone (42522, 27999, 39155).
- **Read before scoring:**
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). From it I built the day → month table: Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354. All 20 printed Babylonian and Julian dates agree with it. Four examples: day 273 = Tebetu 7 = 14 Jan 466; day 144 = Abu 26 = 7 Sep 467; day 320 = Shabatu 25 = 2 Mar 466 (466 BCE is not a leap year); day 177 = Ululu 29 = 10 Oct 467. The day lengths fit 29.9° N: 13 h 53 min on 3 June, 10 h 13 min on 4 January.
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - The first 45 lines (header and protocol) of `REVIEWS/shadow_phase5_r8.md`, for the report's shape.
  - Greps of `research/OPEN_QUESTIONS.md`. They covered guards and watches, the leader of ten, child care and children's work, water, bread and meals, winter building, herders, winnowing and sickness. They returned Q-037, Q-057, Q-058, Q-060, Q-061, Q-062, Q-064, Q-065, Q-141, Q-143, Q-147, Q-148, Q-149 and Q-223.
  - The 20 scores, each with a paragraph, were then saved to `shadow_r9_A_scores.md` in the session scratchpad, before anything below was read.
- **Read after the scores were fixed:**
  - `tools/shadow_days.ts`, in full.
  - From `src/people/sim.ts`:
    - `decide` and `decide0`, including the branch for off-Terrace blocks (ll. 225–250);
    - the set-down rule at the head of `onTerrace` (ll. 253–260);
    - the grinders' water handling (ll. 355–360);
    - `finish` (ll. 531–536) and `performance` (ll. 563–569).
  - From `src/people/population.ts`:
    - `breakfasters` (l. 851) and the child's breakfast (ll. 2893–2902);
    - `gaveBirth` and `mourning` (ll. 1129–1130);
    - `birthDay` and `postpartum` (ll. 2227–2247);
    - the names: `ALL_NAMES`, `NAME_POOLS`, `ORIGIN_POOL` and `nameFor` (ll. 1355–1375);
    - `water` (ll. 1581–1600);
    - `small()` (ll. 2264–2290);
    - `child()`, with its outings, minding, trade, chores and errands (ll. 2769–2935);
    - the guard's water duty (l. 2573);
    - the travellers' stops (ll. 3573, 3598);
    - the herders' camp lines (ll. 3675–3737).
  - Other files:
    - `src/people/calendar.ts` ll. 62–88 (what counts as a "storm");
    - `src/data/lives.json`: `children`, `children_under_five` and `water_trips`;
    - `src/data/names_recalled.json` (`_meta` and the women's rows).
  - The verdict lines and finding headings of rounds 8 A and 8 B, and r8 A's S1–S3 in full. I grepped all earlier shadow reviews for the faults below; none was reported before.
  - Read-only scratch scripts `r9A_q1`–`r9A_q13` in the session scratchpad, outside the repo. Each imports `freshSim`, `populationDay` or `detailedDay` from `tools/shadow_days.ts` and reads the plans of seed 1.
- **Score changes after reading the code:** none. The sample reports the simulation faithfully. #76's jar is what `performance()` returns, and so what the renderer is asked to draw. Four of my remarks are withdrawn, with the scores unchanged, because each person stayed at 4 for other reasons:
  - **2017 (Philis):** "a five-year-old alone all day". Her brother of 16 spins at home all day (q1). She is not alone; only the breakfast label is wrong (S4).
  - **#128 and #129:** "alone all morning". Both mothers are at home that day (q1). Again the breakfast label is wrong (S4).
  - **30442 (Amytis):** "the age rule did not fire". It did. She is planned by `child()`. Because her mother visits a neighbour, she follows her mother all day, which is the documented rule for children under seven (D-175).
- **Files:** I modified no project file other than this one. The working tree was clean when I started (an untracked `REVIEWS/gap_audit.md` appeared during the review; it is not mine and I did not touch it).

## Read first: what is broken or placeholder

1. **The gate fails for this reviewer. #76 scores 3** because he carries a water jar on his head through a town errand (S1). This is a simulation fault, not a tool fault. `finish()` puts the jar on his head when he draws water, and only the set-down rule at the head of `onTerrace` takes it off. So when the next plan block is off the Terrace (the road, the town, the river), the jar goes with him and is drawn on the Terrace legs of the walk. This happens on 26 % of guard water-duty days.
2. **A phantom baby (S2).** `postpartum()` asks only whether the woman gave birth in the last 45 days, not whether the child lives. 127 of the year's 1,854 babies die within that time. Their mothers spend **705 mother-days** "resting with the baby", "spinning, the baby beside her" and "sitting in the lane with the baby". On 98 of those days she goes out "showing the baby to" a neighbour. One of them is #128's mother, on the day shadowed. Her baby, born on day 198, died on day 207.
3. **The women's names (S3).** The recalled pool (D-202, tier C) gives Persian women only 11 names. All 11 are royal or noble women of Herodotus, Ctesias and Plutarch, most in their Greek forms: the daughters of Bardiya, Otanes and Xerxes, Xerxes' sister, Cyrus's mother and wife. **18,209 of 18,209 named Persian women** bear one, each name about 1,750 times. So do 895 of 2,491 Elamite women, through the thin-pool fallback: 88 % of all named women. The pool's own `_meta` says royal women are kept out, but only three queens are flagged as notable.
4. **Lesser year-wide rules (S4–S10):**
   - children told they breakfast alone while the house eats with them;
   - boys of 14, and builders' and weavers' sons, never at the father's work;
   - teenagers running the same errand twice a day;
   - boys drawing water while the women are at home;
   - "storm" meaning heavy rain, and lightning lasting 10 hours;
   - travellers' rations vanishing on the way back;
   - herder women weaving outside in the rain.
5. **No placeholders in this sample.** No line carries `[PLACEHOLDER: not performed]`.
6. **Caveat.** The population's plans are abstract. Only the detailed agents are stepped on the nav grid. So the jar fault (S1) is the only finding of this round that I confirmed in the stepped simulation. The others are plan-level.

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #10 Bakerabba | guard, leader of ten, m 26, Persian | 273 (Tebetu 7, 14 Jan 466; −1–13 °C) | **5** | Night watch: four rounds of the file's posts, the hearth within call between them, sleep after the watch, the town's lanes, knucklebones. |
| 2 | #76 (unnamed) | guard, m 34, Persian | 9 (Nisanu 9, 25 Apr 467; 8–24 °C) | **3** | A good morning watch, but after the water duty he walks the jar on his head down to the town, round an errand and back (S1). |
| 3 | #72 (unnamed) | guard, m 32, Persian | 125 (Abu 7, 19 Aug 467; 19–38 °C) | **5** | The morning with his family in the town (a sick girl of 3), the 14–22 watch at the Hadish with a water jar through the heat. |
| 4 | #126 Parmys | grinder, f 27, Elamite | 144 (Abu 26, 7 Sep 467; 19–38 °C) | **4** | Querns and the camp's water till the noon heat stop, grinding and water at home, a siesta, supper. Her name is a royal Persian woman's, in Greek form (S3). |
| 5 | #128 (unnamed) | camp girl, 7, Elamite | 213 (Arahsamnu 6, 15 Nov 467) | **4** | Brushwood, two small jars of water, bread to a kinswoman, a day of play. "The others of the house gone out" at breakfast is untrue (S4). |
| 6 | #129 (unnamed) | camp boy, 7, Persian | 263 (Kislimu 27, 4 Jan 466; −2–12 °C) | **4** | Brushwood, water, barley for oil, play in the lane. Dressed for the cold outdoors. The same breakfast label as #128 (S4). |
| 7 | 998 Kuprlli | builder (brick), m 32, Elamite | 242 (Kislimu 6, 14 Dec 467; frost, rain from 15:00) | **4** | His half of the gang is off in winter: tools and baskets at home all day. Right, but monotone, with supper at 15:54. |
| 8 | 676 Anani | builder (labour), m 24, Syrian | 224 (Arahsamnu 17, 26 Nov 467) | **5** | Bread before dawn, the earth ramp of the Hall of 100 Columns till 15:30, home to a young wife and a baby of one month. |
| 9 | 2017 Philis | girl, 5, Ionian | 342 (Addaru 17, 24 Mar 466) | **4** | Play in the lane and at home, meals with the house, called in at dusk. No chore at all; a wrong breakfast label (S4). |
| 10 | 3364 Ziššukka | boy, 14, Persian (weaver's son) | 320 (Shabatu 25, 2 Mar 466; −2–12 °C) | **4** | Fuel twice, water three times, barley for oil, some play. At 14 a weaver's son would be at the loom (S5), and his mother is home for the water (S7). |
| 11 | 486 Bakadušda | boy, 14, Carian (builder's son) | 184 (Tashritu 7, 17 Oct 467; 11–31 °C) | **4** | Fuel, water three times while three women are home (S7), bread to the same kinswoman twice in two hours (S6), and never at his father's site (S5). |
| 12 | 33785 Pirriyašba | farmer, m 49, Persian | 3 (Nisanu 3, 19 Apr 467; rain 19.7 mm) | **4** | Kept home by the weather: animals, mending, meals. But the "storm" lasts 11.5 h with a 4 m/s wind and no lightning (S8). |
| 13 | 30442 Amytis | girl, 5 today, Persian | 224 (Arahsamnu 17, 26 Nov 467) | **4** | At her mother's side all day: a neighbour's house, the quern, meals. Plausible. The name is a royal Median/Persian woman's (S3). |
| 14 | 5094 Irdapukka | baby, 3 months, Persian | 39 (Aiaru 10, 25 May 467) | **5** | Nursed every 2–3 h day and night, on a mat by the mother as she works, on her back to the well, in her lap at meals. |
| 15 | 44597 Parmys | herder, f 31, Persian | 329 (Addaru 4, 11 Mar 466; rain 06:15–12:00) | **4** | Milking after the lambing, curds and butter in a skin, the evening milking. She weaves and spins "by the tent" through the rain (S10), and has a royal name again. |
| 16 | 43767 Miššabadda | traveller, m 32, Persian | 330 (Addaru 5, 12 Mar 466) | **4** | A waiting day at the station: gear, harness, the lower town, travel rations. The station is "at home", there is a 3-minute bounce back to the station, and the rations are not carried back (S9). |
| 17 | 32610 Bakumarda | farmer, m 40, Persian | 48 (Aiaru 19, 3 Jun 467; 14–32 °C) | **5** | Threshing with the animals, a siesta by the floor, sleep at home before the night, then the vigil by the grain heap. |
| 18 | 42522 Irdaša | farmer, m 36, Persian | 180 (Tashritu 3, 13 Oct 467) | **5** | Manure on the field before the ploughing, bread brought out by a child, the roof plastered before the rains. |
| 19 | 27999 Manyabaduš | farmer, m 27, Persian | 316 (Shabatu 21, 26 Feb 466; 1–15 °C) | **5** | Clearing the village canal (E-50), the ewes and new lambs, a visit after dark. |
| 20 | 39155 Irdabama | girl, 11, Persian | 177 (Ululu 29, 10 Oct 467) | **5** | Quern, fuel, spinning with the women, the men's bread carried to the field, water, play: about 4.6 h of work, right for her age. |

Count: 8 × 5, 11 × 4, 1 × 3. Lowest: 3 (#76).

### The 20 days, one paragraph each (as written before reading any code; later notes are marked)

**#10 Bakerabba (5).** A frosty January night (−1 °C) on the 22–06 watch. He makes rounds at 00:00, 01:31, 03:02 and 04:32, each of 35–45 min, taking the posts in a varying order. Between rounds he is awake at the file's hearth, within call, with bread and water at 02:25. After the watch come breakfast and sleep from 06:27 to 13:01. Then a meal, 1.5 h of trade and talk in the town's lanes, the evening meal, knucklebones and an early bed. He is dressed against the cold on every round. He is one man with no family, in the garrison quarters, and his name is attested in the PF. Nothing to fault.

**#76 guard (3).** The morning watch, 06–14, at the W gate. He is relieved at 08:20 to eat, and relieved again at 14:00, then has a meal and his turn of the file's water. The fault comes next. He brings the jar to the hearth at 14:53, yet he goes on as "carry_jar_head", "carrying a jar of water on the head". He takes it down the road to the town, through an hour's errand at the craftsmen's quarter (a shield strap, a spear shaft) and back up to the garrison (14:58–16:57). A soldier walking a full water jar on his head for two hours, on an errand that has nothing to do with water, is plainly wrong, and it is what would be drawn. (A jar on the head is also more a woman's way of carrying than a soldier's; that is minor.) The rest of the day is sound. He does not go down to his wife and children in the town this day; that is a draw, and acceptable. *(After scoring: a simulation fault, not a tool fault; S1.)*

**#72 guard (5).** 19 August, 38 °C. Breakfast at the hearth, then down to his family in the town, where a girl of 3 is sick, for the morning and the midday meal. He climbs back for the 14–22 watch at the Hadish with a water jar at the post through the heat. He eats bread at the post because no patrol man relieves him, then a meal after the watch, and is asleep at 22:31. Coherent and humane.

**#126 Parmys, grinder (4).** 7 September, 38 °C. She grinds the household's flour before dawn, eats bread and is up at the work camp by 06:00. She grinds there, with three water trips for the camp, and goes home at noon for the heat stop. At home she grinds for tomorrow, fetches water, sleeps through the heat, then cooks and eats with her husband, a porter. She is asleep at 20:34. The work day is right. The oddity is the name. Parmys is the Greek (Herodotean) form of the name of a daughter of Bardiya, a royal Persian woman. Here it is given to an Elamite grinder, and again to a Persian herder woman (44597). A royal name, in its Greek rendering and not matched to origin, jars. *(After scoring: S3.)*

**#128 girl 7, Elamite (4).** 15 November. She carries in brushwood, plays, eats breakfast "the others of the house gone out", fetches two small jars of water and takes bread to a kinswoman. Then she plays at home and in the lane for most of the day. Her midday and evening meals are "with the household", which is her mother, a camp worker. This is plausible for a girl of seven in a town quarter. The oddities: she is alone from early morning, though the project's own rule (Q-061) sends a child under eight with the mother when no grown-up stays home; and her chores (about 1.2 h) fall short of the project's 3 h for a girl of 7–9. Minor. *(After scoring: her mother was at home all day, so the "alone" remark is withdrawn; the breakfast label is wrong, S4. Her mother's plan is also the phantom-baby case of S2.)*

**#129 boy 7, Persian (4).** 4 January, −2 °C. Brushwood, play and breakfast alone. He fetches two jars of water and trades a measure of barley for oil with a neighbour. He plays in the lane for 2 h and then 3 h, eats his meals "with the household", and is asleep at 18:25. He is dressed against the cold outdoors. The same remarks as for #128 apply. A barley-for-oil exchange trusted to a child of seven is possible. Minor. *(After scoring: his mother was at home all day; the breakfast label is wrong, S4.)*

**998 Kuprlli, brick builder (4).** 14 December, a frosty morning, rain from 15:00. He is at home all day, because "the gang works in halves in winter" (E-62, month 9). He mends tools and baskets in three spells, rests, eats three meals and talks. Brick work cannot happen on a frost day anyway, so the day at home is right. But it is monotone: no errand, no lane, no visit, no fuel. The evening meal at 15:54 is early. Plausible.

**676 Anani, labourer (5).** 26 November, dry. He eats bread before leaving and walks 22 min up to the Hall of 100 Columns. There he hauls earth for the ramp from 07:05 to 15:30, with the camp's midday bread. Then home, the evening meal with his young wife and a baby of one month, and sleep. A Syrian with an Aramaic name (Anani). Textbook.

**2017 Philis, girl 5, Ionian (4).** 24 March. She plays in the courtyard and eats breakfast alone. Then she plays in the lane and at home the whole day, with meals "with the household" (her mother and a youth of 16, both treasury workers), until she is called in at dusk. A Greek name for an Ionian girl: good. The oddities: a five-year-old alone from 06:28 with nobody said to mind her, and no chore at all (the project's rule gives a girl of 5–6 about 0.8 h). In a lane full of neighbours this is possible, but it is the thin edge. Minor. *(After scoring: her brother spins at home all day, so she is not alone; the breakfast label is wrong, S4.)*

**3364 Ziššukka, boy 14 (4).** 2 March, −2 °C. Brushwood, and breakfast of "the new bread". He makes two fuel trips of about 2 h each and draws three jars of water, trades barley for oil, plays 45 min in the lane and 45 min at home, and mends baskets. The chores are plausible. The oddities: at 14 the son of a weaver would spend much of the day at his father's loom, not at children's chores and play. And the boy fetches the water three times while his mother, a homemaker, is at home, against the project's own rule and the ethnography it cites (women and girls carry the water). Minor. *(After scoring: S5, S7.)*

**486 Bakadušda, boy 14, Carian (4).** 17 October. Brushwood, fuel twice and water three times. He takes bread to a kinswoman at 10:45 and **again to the same house** at 12:37. He plays at a friend's house and by the garden channels, and mends baskets. The oddities:
- the repeated bread errand to one house within two hours;
- the water drawn by the boy while three women (40, 19 and 17) are at home;
- a Carian boy with an Iranian (Baga-) name, when the project's rule is names matched to origin;
- a builder's son of 14 not on the site with his father.

Each is small. Together they come close to a 3, but the day is still one a boy could have had. 4. *(After scoring: the name is the documented thin-pool fallback, a C choice, D-202 and S9 of r5; S5, S6, S7.)*

**33785 Pirriyašba, farmer (4).** 19 April. Rain 02:15–14:15 and a "storm" 02:30–14:00, 19.7 mm in all. He stays home: the animals, mending, meals and rest, then the animals again in the afternoon. That is the right behaviour on a storm day. The oddity is the weather. A "storm" lasting 11.5 h with a 4 m/s wind is not a thunderstorm as the plain has them (short, in the afternoon, gusty). A long frontal rain would be fine; a half-day storm is not. Minor. *(After scoring: S8. The planner calls heavy rain a storm; this one had no lightning at all.)*

**30442 Amytis, girl on her fifth birthday (4).** 26 November. She is with her mother the whole day. She eats with her, plays near her, walks with her to a neighbour's house and plays while she grinds. As a day it is plausible. But as the "birthday across an age rule" case, the day she turns five is still exactly an under-five day: every line says "[with 30438]" and there is no chore. If the rule starts at five, it did not fire. And "Amytis" is the Greek form of a royal woman's name, given to a farmer's daughter. Minor. *(After scoring: the rule did fire, since her day comes from `child()`. She follows her mother all day because of the visit, the documented rule for children under seven. The name remark stands, S3.)*

**5094 Irdapukka, baby of 3 months (5).** 25 May. He is nursed about every 2–3 h, day and night. He sleeps beside the mother, lies on a mat beside her while she works, sits in her lap at meals and rides on her back to the well. Excellent.

**44597 Parmys, herder woman (4).** 11 March, rain 06:15–12:00, 0–15 °C, a halt day for the band. She milks at first light, warms and churns the milk and eats bread and milk. Then she weaves at the ground loom and spins "by the tent" through the rain (08:28–11:35). She churns again, spins, weaves, does the evening milking, fetches water from the stream, cooks, eats and sits by the fire before sleep. The pastoral round is right: milk after the lambing, churning in a skin, the ground loom. The oddities: the ground loom is worked outside "by the tent" in the rain (the tent's open side may cover it, but only 16 min is said to be "in the tent out of the rain"), and the royal name again. *(After scoring: S10, S3.)*

**43767 Miššabadda, traveller (4).** 12 March. A waiting day at the station lodging. He sees to the animals and gear, mends harness and sandals, rests and eats with the party. He walks into the lower town, draws the next days' travel rations at the town store, and ends with the fire and talk. Plausible. The oddities:
- "on another errand" when there was no first one;
- the station is called "at home";
- he walks 27 min back to the station for 3 min, then 29 min out again to the store.

Minor. *(After scoring: "another" refers to the first stop at the station, so that remark is withdrawn. The others stand, and the rations are not carried back from the store; S9.)*

**32610 Bakumarda, threshing and the vigil (5).** 3 June, a still day. Bread at dawn, then threshing with the animals on the village floor, bread and water, more threshing. He has the midday meal and a sleep in the shade, then goes home to sleep again, because he keeps the night watch. He mends forks and sieves, eats, then sits up by the grain heap and sleeps beside it. There is no winnowing on a still day, though he carries the fork anyway. A very good day (compare Ruth 3).

**42522 Irdaša, farmer (5).** 13 October. He spreads manure on his field before the ploughing, and a child brings the midday bread out. He is home at 13:45, rests, and plasters the roof with mud and straw before the rains. Then the evening meal and talk. Right for the month. Stopping at 13:40 on a mild day is a touch early, which is fine.

**27999 Manyabaduš, farmer (5).** 26 February. He clears the village canal (E-50, month 11) on the bread he carried out, then goes home to the ewes and the new lambs. After the evening meal he visits Manyakka for two hours after dark. He is dressed against the cold in the morning. Right.

**39155 Irdabama, girl 11 (5).** 10 October. She carries in the dung cakes and grinds beside her mother. She gathers fuel twice, spins with the women outside the door, and plays in the lane and by the canal. She carries the midday bread and water out to the men in the field and eats with them, and fetches two jars of water. Then play at Phaidyme's house and in the lane until dusk, when she is called in. About 4.6 h of work, fitting her age, and a good mix. (Phaidyme is again the Greek form of a noblewoman's name, from Herodotus: S3.)

## Findings

**S1. Blocking (#76): a guard's water jar is never set down when his next block leaves the Terrace.** Severity: **high** (it fails the gate).
- **What:** #76 draws his file's water at 14:27 and carries the jar to the hearth by 14:53. From 14:58 to 16:57 he performs `carry_jar_head`, marked "[carrying a jar of water on the head]". That covers the walk to the Terrace exit, the road, an hour at the craftsmen's quarter and the climb back. The Terrace legs (14:58–15:12 and the last minutes before 16:57) are drawn.
- **Cause:**
  - `finish()` (sim.ts l. 535) sets `a.carry = 'jar_head'` when a `draw_water` task ends.
  - The jar is taken off only by the set-down rule at the head of `onTerrace` (l. 256), or by the grinders' own handler (ll. 356–359).
  - A guard's water duty (population.ts l. 2573) is a 0.1 h `carry_jar_head` block to the hearth. When the plan's next block is off the Terrace, `decide0` takes the off-Terrace branch (ll. 237–247), which never clears `a.carry`.
  - `performance()` (l. 566) then turns every walk into `carry_jar_head`, and `detailedDay` prints the load.
- **Year-wide (r9A_q5, seed 1, all 135 detailed agents × 354 days):**
  - 4,222 guard-days have the water duty. On **1,105 (26 %)** the `carry_jar_head` block is followed straight by a block off the Terrace. That is 3.2 % of all 34,887 guard-days.
  - No other role has the pattern.
  - Stepped confirmation (r9A_q6): guard #1 on day 35 carries the jar to "practising with the bow and the spear with men of his file" for 1.5 h. On day 224 he carries it to the river, where he is "washing his clothes at the river" with it on his head.
- **Fix:**
  - Set the jar down in `finish()` when a `carry_jar_head` task reaches its place (the hearth). Clear any carried load when `decide0` takes the off-Terrace branch, unless that block's own act is a carrying act.
  - Add a stepped check to the activity lint or the soak: no agent may hold `carry` while its task's act is not a carrying act, for more than a minute.

**S2. A mother whose newborn has died goes on with "the baby".** Severity: **medium** (not in a shadowed person's own line here, but her daughter #128 was shadowed; a 2 for the mother's day).
- **What:** #128's mother, Artaynte (1177), on day 213 spends the day:
  - "resting with the baby";
  - "showing the baby to Rhodogune";
  - "sleeping when the baby sleeps";
  - "spinning (off work after the birth)".

  Her baby (45096) was born on day 198 and died on day 207 (r9A_q1, r9A_q2). The household line in #128's header correctly lists 2 people.
- **Cause:**
  - `gaveBirth` (population.ts l. 1130) returns the days since any birth to the woman in the last 45 days, alive or not.
  - `postpartum()` (ll. 2229–2247) writes the baby into her day: resting, spinning and sitting in the lane with it, fetching water with it, showing it to a neighbour.
  - `mourning` covers only 1–3 days after the death, and then `postpartum` resumes.
- **Year-wide (r9A_q3):** 1,854 births; 127 babies die within 45 days. Their mothers have **705 mother-days** after the death whose plans speak of the baby or the newborn, with no other living infant of hers in the house. On 98 of those days she goes out "showing the baby to" someone.
- **Why it matters:** infant death is one of the few life events the brief asks to show (§5.5, E-71). A bereaved mother who carries on "with the baby" is the kind of error a visitor who follows her (§9.5) would find grotesque.
- **Fix:**
  - `gaveBirth` should count a live child only (`persons[c].dies > d`).
  - After an infant death, give the mother the mourning days and then a bereaved rest: the off-work days of the confinement at home, light work, kin visiting her. Drop every "baby", "newborn" and "nurs" line.
  - Add a plan lint: a why that names the baby, the newborn or nursing needs a living child of hers under two in the house that day.

**S3. The women's names: royal and noble women, in Greek forms, for every Persian woman.** Severity: **medium** (§9.1; the brief's rule is attested names *matched to origin*; no score below 4 here, but it is visible in 5 of the 20 days).
- **What:** among the sample are an Elamite grinder and a Persian herder both called Parmys, a Persian farmer's girl called Amytis, and a playmate called Phaidyme. The mothers in the scripts are Artaynte, Sandauke, Kassandane and Mandane, with a neighbour Rhodogune.
- **Cause:**
  - `names.json` (the 67 PF texts read) holds no woman's name.
  - The Iranian women's pool is therefore only the recalled pool (`names_recalled.json`, D-202, tier C). Its 12 unflagged Iranian women's names are Irdabama, Phaidyme, Parmys, Artaynte, Artazostre, Sandauke, Amytis, Rhodogune, Roxane, Mandane, Kassandane and Radušnamuya.
  - These are the daughters of Bardiya, Otanes, Darius and Xerxes, Xerxes' sister, Cyrus's mother and wife, and two PF royal women. Most are given in their Greek (Herodotus, Ctesias, Plutarch) forms.
  - The pool's `_meta` says "royal women are kept out of the everyday pools (notable)", but only Atossa, Amestris and Artystone carry `notable`.
  - Elamite women (4 names, fewer than `THIN_NAME_POOL`) are topped up from all women's names, and so draw these too.
- **Year-wide (r9A_q7):**
  - **18,209 of 18,209 named Persian women (100 %)** bear one of the 11 names (Radušnamuya is not drawn), each 1,713–1,804 times.
  - 895 of 2,491 Elamite women do too, and a few of every other origin except the Babylonians.
  - In all, 19,377 of 22,011 named women (88 %).
- **Why it is implausible:** a village of farmers' wives all named after the royal house is not what the tablets show. The Greek forms (Amytis, Phaidyme, Parmys) are not how an Elamite scribe would write these names.
- **Fix:**
  - Flag every royal or court woman in `names_recalled.json` as `notable`, which the file's own rule requires.
  - Until PF women's names of ordinary status are read (the women's ration and *pašap* lists; Brosius 1996), leave Persian women unnamed, as the brief prefers to invented or inapt names. Alternatively, draw only names attested for women of ordinary status, in their Elamite renderings.
  - Record the gap in `OPEN_QUESTIONS.md`.

**S4. "Breakfast, the others of the house gone out" while the house eats with the child.** Severity: **low** (#128, #129, 2017).
- **What:** all three children are told they breakfast alone. Yet their mothers (and 2017's brother) eat "breakfast with the household" at home at the same minutes (r9A_q1).
- **Cause:** `breakfasters` (population.ts l. 851) guesses who eats at home from job names (homemaker, elder, servant, steward, children of 8 or more, the sick, the morning baker). It does not look at the day's plans. A camp woman at home on a postpartum or rest day, or a treasury youth spinning at home, does not count.
- **Year-wide (r9A_q4, 1,500 random child-days aged 4–13):** 27 of 1,133 breakfasts say "gone out", and on **18 of those (67 %)** another member of 5 or more eats at home at the same time. That is about 1.6 % of children's breakfasts.
- **Fix:** decide "alone" from the members' raw plans: an `eat` segment at home overlapping the child's breakfast.

**S5. Boys of 14 never at their father's trade; builders' and weavers' sons never at all.** Severity: **low** (3364, 486).
- **What:** a weaver's son and a builder's son of 14 spend the day at children's chores and play.
- **Cause:** the trade rule (`child()`, population.ts l. 2886) applies only to boys aged exactly 12–13, and only to craftsmen, scribes, gardeners and storekeepers. A weaver is not in that list, nor is a builder, although the PF lists boys in the work groups (PEOPLE.md P5.3, B).
- **Year-wide (r9A_q11, 1,500 random days of town boys aged 12–14 with a father at home):**
  - Sons of craftsmen, gardeners and scribes go to the father's work on 20–33 % of days at 12–13, but on **0 of 97 days at 14**.
  - Builders' sons: 0 of 109 at 12–14. Grooms' and porters' sons: 0 of 41.
- **Fix:** extend `trade_p` to ages 12–15. Add the weaver and the other workshop trades. Let a builder's son of 13 or more go up as a labourer's boy with his father's gang on some days (the ration lists' boys; C).

**S6. Teenagers run the same errand twice a day.** Severity: **low** (486).
- **What:** 486 takes bread to the same kinswoman at 10:45 and again at 12:37.
- **Cause:** the teen caps allow two errands (population.ts l. 2906). The kin house is always the first eligible one (l. 2930), and the barley-for-oil exchange has no memory either.
- **Year-wide (r9A_q10b, 2,000 random days of children aged 12–14):** **262 days (13 %)** repeat an errand: bread to the same house on 85, barley for oil twice on 177. Among children aged 5–14 in general the rate is 0.7 % (r9A_q10).
- **Fix:** cap each errand kind at one a day, and send a second errand of the day to a different kin house or to a different exchange (salt, a borrowed tool, a message).

**S7. Boys draw the house's water while its women are at home, and the houses draw well over their need.** Severity: **low** (3364, 486).
- **What:** 486's house of six on a 31 °C day draws 8 jars: two women 1 each, a third woman 2, the mother 2 and the boy 3 (r9A_q1). 3364's house draws 5.
- **Cause:** `water()` (population.ts l. 1581) plans the waterer's jars (`hday.jars`, "others' trips are over and above"). The children's chore draw (water 0.3), the women's "evening water" and the morning jar before work all come on top, and none of them knows the house already has its water.
- **Year-wide (r9A_q9, 1,200 random household-days, town and plain):**
  - 2,844 trips against a need of 1,892 jars, a mean of 1.5 times the need. **390 household-days (32.5 %)** draw at least twice the need.
  - Males of 12 or more make 196 trips (6.9 %), 150 of them (77 %) while a homemaker woman is at home.
- **Plausibility:** the quantity is not itself implausible. The project's 4 l a head is low, and 1.5 times that is still modest. But boys doing the carrying with the women at home runs against Q-148 and the ethnography it cites.
- **Fix:** count every trip against the house's need, so the chores draw only what is short. Keep water with the women and girls, and let a boy or a man go only when none is at home.

**S8. "Storm" means heavy rain, and a thunderstorm lasts all day.** Severity: **low** (33785).
- **What:** the day line says "storm 02:30–14:00", and the day is labelled "at home: storm". The weather had no lightning in any of those 46 quarter-hours, and a wind of at most 4.1 m/s.
- **Cause:** `calendar.ts` l. 83 calls any hour with lightning *or rain > 0.7* a storm hour.
- **Year-wide (r9A_q8, seed 1):**
  - 18 storm days. On 14 there is no lightning at all.
  - The median storm lasts 7.8 h, 15 last over 6 h, and days 279 and 352 have 15.8 h.
  - On the four days with lightning, it falls in every quarter-hour for 4.5–10.3 h, with winds of 1.2–2.1 m/s.
- **Why:** thunderstorms on the plain are convective cells of an hour or two, gusty and mostly in the afternoon. A day of heavy frontal rain is not a storm. The work rules are not wrong, since rain already stops outdoor work (W-01), but the word is, and so is the ten-hour lightning.
- **Fix:** keep "heavy rain" and "thunderstorm" apart in `DayWx`. Model lightning as cells of 0.5–2 h with a gust front (W-02). Print "heavy rain" in the day line.

**S9. Travellers' rations vanish, and the station is "at home".** Severity: **low** (43767).
- **What:** 43767 queues 32 min for "the next days' travel rations" at the town store, then walks back "walking", with nothing carried. Earlier he walked 27 min to the station for 3 min "at home", then 29 min out again.
- **Cause:** only the non-leader branch of the travellers' stops (population.ts l. 3598) carries the rations back (`carry_sack`). The other paths walk back empty-handed, and the generic idle label is "at home".
- **Year-wide (r9A_q12, 661 travellers, every third day):**
  - **365 of 535 ration queues (68 %)** are followed by an empty-handed walk.
  - 104 of 1,523 traveller-days call the station "at home".
  - There are 175 stops of under 6 min at the station between two walks.
- **Fix:** every ration draw ends with `carry_sack` back to the station (§9.5: goods are physical objects). Call the station "at the station lodging". Merge a stop shorter than the walk into a direct walk to the next place.

**S10. Herder women weave and spin outside in the rain.** Severity: **low** (44597).
- **What:** 3 h of "weaving at the ground loom by the tent" and "spinning wool by the tent" fall within the morning's rain.
- **Cause:** the band's day (population.ts ll. 3703, 3737) chooses weaving and spinning "by the tent" without a rain test. Only the rest line has "in the tent out of the rain".
- **Year-wide (r9A_q13):** 249 herder women. On the 28 rain days, 51 woman-days have 187 h of weaving or spinning "by the tent" in the rain, against 143 h said to be "in the tent" in rain.
- **Fix:** in rain, spinning moves into the tent and the ground loom stops. The loom is not moved, and the wool is kept dry.

**S11. Checked, not faults, and small notes.**
- The sample regenerates byte-identical (md5 `9a98683bb9a0bfecf279afda7d54b607`). All 20 dates agree with CALENDAR_AND_UNITS.md.
- 30442: the age rule fires. She is planned by `child()`, and the whole-day following is the documented under-seven rule for a mother's visit to kin (D-175).
- 2017, #128 and #129 are not left alone. The mothers (and 2017's brother) are at home. Only the breakfast label is wrong (S4).
- The Carian boy's Iranian name (486) is the documented thin-pool fallback: in the tablets foreign workers bear names not of their own language (S9 of r5, D-202). A defensible C choice, but see S3.
- 32610's vigil, 27999's canal clearing in month 11, 42522's manure and roof in month 7, 998's winter half and 5094's nursing all match EVENTS.md and the project's rules.
- #76 not visiting his family on a day with time for it is within the 0.7 draw of D-186 (Q-060).
