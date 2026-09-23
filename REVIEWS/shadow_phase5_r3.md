**VERDICT: FAIL.** 3 of 20 people score below 4: #49 Appiyama **2**, #80 Karma **3** and 27049 (boy, 3) **3**. #49's day turns out to be a sampling-tool fault: the tool drew a man who had died 12 days earlier. Even with his slot re-drawn, #80 and 27049 still fail.

# Shadow review, Phase 5, round 3 (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5). I did not build or see the build of the simulation. I scored from the day timelines and the research files only, before reading either earlier round or any simulation code.
- **Date:** 2026-09-23
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick53.txt` (seed 1, pick seed 53): 6 detailed Terrace agents and 14 people of the population. The builders had not seen it.
- **Read before scoring:**
  - The sample, in full.
  - `research/CALENDAR_AND_UNITS.md`, in full. Day 1 = 1 Nisanu = 17 Apr 467 (Julian). I built the day → month table from it (Nisanu 1–29, Aiaru 30–59, Simanu 60–89, Duzu 90–118, Abu 119–148, Ululu 149–177, Tashritu 178–207, Arahsamnu 208–236, Kislimu 237–266, Tebetu 267–295, Shabatu 296–325, Addaru 326–354).
  - Read in full: `research/EVENTS.md`, `research/PEOPLE.md`, `research/PLAIN.md` and `research/SETTLEMENT.md`.
  - `PERSEPOLIS_BRIEF.md`: §5.5, §9 (all) and §13.
  - A grep of `research/OPEN_QUESTIONS.md` for threshing, baking, fuel, guards and training. It printed Q-060, Q-064, Q-065, Q-140, Q-141, Q-142 and Q-144. I had already drafted all 20 scores; none changed after it.
  - A grep of `research/SOURCES.md` and `research/ACCESS.md` for HDT and XEN-CYR, to see which texts the project read in full.
- **Read after the scores were fixed:**
  - `REVIEWS/shadow_phase5.md` (round 1) and `REVIEWS/shadow_phase5_r2.md` (round 2).
  - `tools/shadow_days.ts`.
  - From `src/people/population.ts`: the guard rota and guard planner (ll. 726–746, 1350–1400), the small-child follow logic (ll. 1300–1345), the training rule (ll. 1669, 1701) and the traveller's leave day (l. 2104).
  - From `src/people/sim.ts`: ll. 195–235, the relief rule.
  - `src/data/lives.json`, the `children` entry.
  - `src/data/people_places.json`, the post coordinates.
  - Read-only scratch scripts in the session scratchpad, outside the repo, that import the simulation. They queried:
    - the plans of 27046, 27048, 36597, 3383, 28079, 28081, 7754, 16483, 171 (#57), 174 (agent 59), 248 (#80) and 149 (#49);
    - the rota, households and persons for agents 6, 49, 70 and 80;
    - `sunTimes()` for the 20 days.
  - I did not read `DECISIONS.md`.
- **Score changes after reading the earlier rounds or the code:** none.
  - #49's score stands as read from the sample, but his note now says the fault is the tool's.
  - The explanations for 27049's second supper and #80's hidden meal are added to the notes. Neither changes a score.
- **Dates** are Babylonian with the Julian date. Sunrise and sunset are the sim's `sunTimes()`, in local solar time.
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The gate fails.**
   - **27049:** a toddler teleports home at bedtime (S4). Score 3.
   - **#80:** a leader of ten walks the same 16-post circuit, in the same order, for 8 hours (S3). Score 3.
   - **#49:** his whole day is `offmap — not here`. After scoring I found he died on day 190, and the sampler does not check whether a detailed agent is alive (S1). Score 2.
2. **Placeholders.**
   - 11 of the 14 population people spend part of the day in activities with no performance (`thresh`, `tend_animals`, `weave`, `spin`, `craft`, `train`). Together that is **50 h 27 min**.
   - For 7 of them it is the day's main work: the five threshing days, the treasury weaver, and the winter farmer's animals.
   - Summer threshing, the most common work in this sample, is not performed anywhere.
   - None of the 6 detailed agents has a placeholder.
3. **Simulated and performed plans differ in the detailed tier (S2).**
   - #57's plan feeds him at his post at 19:19.
   - The detailed sim instead holds him "waiting to be relieved" and he loses the meal: 9 h 05 min without food.
   - Detailed agents are still stepped in the abstract LOD (`tools/shadow_days.ts`, `a.lod = 'abstract'`).
   - Nothing in the input shows whether the 14 population people are rendered, so §9.5's check that "what a person is doing on screen matches what the simulation says" is still unconfirmed for them.
4. **Goods appear and vanish (S5, S6, S7).**
   - Two mothers carry home water they never drew.
   - Four farm workers carry out "bread and water for the day" that is never eaten or brought back.
   - One household eats "the new bread" that nobody baked.
5. **Tool.**
   - The detailed-agent sampler can draw dead or absent agents (S1).
   - All 14 population people print `(name from the attested pool)` in place of a name (`p.nm` is empty), while the neighbours they visit are named (Nanitin, Karaana, Kuraaza).

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #70 Miššabadda | guard (leader of ten), man 25, Persian | 198 (Tashritu 21, 31 Oct; 9–28 °C) | **4** | A rota off day, plausible under §9.1, but 12 h at one hearth cycling talk, rest and knucklebones, with no chore, errand or kit. |
| 2 | #6 Buktezza | guard, man 22, Persian | 258 (Kislimu 22, 30 Dec; 2–17 °C) | **4** | Coherent: a visit home, a nap and the night watch. "His wife and children" is one newborn, and there are 5 h of "rest" at home. |
| 3 | #49 Appiyama | guard, man 37, Median | 202 (Tashritu 25, 4 Nov; rain 2.9 mm) | **2** | The whole day is `00:00 offmap @ - — not here`: nothing to shadow. After scoring: he died on day 190, and the tool sampled a dead agent (S1). |
| 4 | #80 Karma | guard, leader of ten, man 40, Persian | 249 (Kislimu 13, 21 Dec; 2–17 °C) | **3** | 14:00–22:00 is one fixed 16-post circuit walked about 7 times in the same order (266 log changes). A script, not a watch officer's night. |
| 5 | #57 Piršuš | guard, man 24, Median | 182 (Tashritu 5, 15 Oct; 10–29 °C) | **4** | Coherent B watch, but a relief that never comes (19:19–19:40) costs him his meal: 9 h 05 min without food and 8 h at one post. |
| 6 | #63 Barnukka | guard, man 46, Median | 301 (Shabatu 6, 11 Feb; −3–10 °C) | **5** | Visit home, plausible climb, B watch with a bread relief at 17:00, supper, bed. |
| 7 | 7753 | farmer, m 32, Elamite (plain) | 80 (Simanu 21, 5 Jul; 19–40 °C) | **4** | A good threshing day with a heat sleep, but the day's bread and water are carried out and vanish, and he eats at home "back from the field". |
| 8 | 30063 | farmer, m 43, Persian (plain) | 127 (Abu 9, 21 Aug; 21–41 °C) | **5** | Threshes with the animals on a still day (no winnowing, which is correct), eats the carried bread at the floor and rests there through the heat. |
| 9 | 16484 | homemaker, f 16, Persian (plain) | 97 (Duzu 8, 22 Jul; 17–35 °C, dust) | **4** | Grinds, winnows, spins. But nobody in the two-person house draws water on a 35 °C dust day, and the carried bread vanishes. |
| 10 | 2350 | treasury (textile), m 42, Babylonian (town) | 63 (Simanu 4, 18 Jun; 16–36 °C) | **4** | A sound workshop day, but 1 h 52 min awake idle before breakfast and 3 h of rest after work. Weaving is a placeholder all day. |
| 11 | 46624 | infant, f 1 month (plain) | 342 (Addaru 17, 24 Mar; 7–23 °C) | **4** | 10 feeds including at night, good. The one well trip is all nursing, and the mother carries home water she never drew. |
| 12 | 45269 | infant, f 3 months (town) | 187 (Tashritu 10, 20 Oct; 11–30 °C) | **4** | Taken to the weaving shop and fed 9 times, with feeds cut out of the mother's weaving. The second well trip is again nursing in place of drawing water. |
| 13 | 43569 | traveller, m 34, Persian | 238 (Kislimu 2, 10 Dec; −5–8 °C) | **5** | A departure day from the road station. Plausible, but the same script to the minute as 43545 (S9). |
| 14 | 28080 | homemaker, f 17, Elamite (plain) | 92 (Duzu 3, 17 Jul; 20–39 °C) | **4** | A full harvest day (quern at 03:30, water, threshing, spinning). "The new bread" is eaten in a house where nobody bakes, and the carried bread vanishes. |
| 15 | 43545 | traveller, m 48, Persian | 225 (Arahsamnu 18, 27 Nov; 4–18 °C) | **5** | As 43569. |
| 16 | 28146 | child, m 7, Persian (plain) | 266 (Kislimu 30, 7 Jan; −5–8 °C) | **4** | A rich chore day: animals, an errand, water twice, minding, bread to the field. But he trains to ride and shoot on a −5 °C morning from a plain farm household (S8). |
| 17 | 11229 | farmer, m 33, Persian (plain) | 136 (Abu 18, 30 Aug; 17–36 °C) | **4** | The best farm day, with winnowing "in the afternoon wind". Only the vanishing bread and water. |
| 18 | 34225 | farmer, m 18, Persian (plain) | 272 (Tebetu 6, 13 Jan; −1–13 °C) | **4** | Right for the season ("little field work in winter"), but thin: about 4 h 40 min of rest and talk in daylight, and no fuel gathered on a frosty day. |
| 19 | 27049 | child, m 3, Persian (plain) | 56 (Aiaru 27, 11 Jun; 18–38 °C) | **3** | Teleports from a neighbour's house to his bed at home at 19:52 with no walk, and eats a second supper whose reason his line does not give. |
| 20 | 11472 | elder, f 72, Persian (plain) | 33 (Aiaru 4, 19 May; 13–31 °C) | **4** | A plausible elder's day. "A little grinding" lasts 1 h 44 min, and there are about 3 h 50 min of rest in five spells. |

Distribution: 5 → 4 people; 4 → 13; 3 → 2; 2 → 1. **3 of 20 are below 4** (round 1: 10 of 20; round 2: 3 of 20).

## Notes for every score below 5

### #70 Miššabadda: guard, off day (score 4)
Sunrise 06:31, sunset 17:29.
- **Fine:**
  - Three meals: 07:05, 12:07 and 17:07.
  - Knucklebones and hearth talk, which §9.1 allows ("eat, sleep, gamble and idle").
  - A 32-min visit to the forecourt (13:27–14:07).
  - Bed at 19:11.
- **Filler.** From 07:05 to 19:10 he never leaves `garrison_hearth_m` except for the forecourt. He cycles through `talk` (07:33, 09:45, 12:40, 16:52), `rest` (08:23, 12:02, 14:07, 15:14) and `gamble` (11:15, 14:43, 17:39).
  - There is nothing a man living alone in the garrison would also do: water, washing, his kit, the file's ration, the town.
  - After scoring I found he is a **leader of ten** (rank 1, phase 4 = off), and he has no word with his file either.
- About 12 h asleep (19:11 to about 07:00) is long but within a 13.5 h night.

### #6 Buktezza: guard, family visit and night watch (score 4)
Sunrise 06:58, sunset 17:02.
- **Fine:**
  - The descent to q_pw_s takes 22 min (08:13–08:35) and the climb 35 min (16:27–17:02).
  - Four meals.
  - `17:02 sleep — a short sleep before the night watch` until 21:32.
  - On post at `22:02 stand_guard @ post_harem_1`.
- **"His wife and children" is wrong.** `08:35 talk @ h:6 — with his wife and children in the town`, but the header says 3 people. After scoring I checked the household: him, his wife of 20 and one newborn girl.
- **Long idle blocks.** `10:29 rest @ h:6 — with his family` to 11:53 and `12:14 rest` to 15:51 add up to 5 h of rest on a dry winter day. Minor.

### #49 Appiyama: guard (score 2)
- **The whole day** is `00:00 offmap @ - — not here`.
- The header presents him as a living guard of 37 with a house and household of 5 in q_pw_s.
- From the sample, this is a townsman absent for 24 h with no departure, no return and no cause. There is nothing to shadow.
- **After scoring:**
  - Person 149 has `dies: 189`: he died on day 190, and the household of 5 on day 202 is his widow and four children, one of them a newborn.
  - The sim's absence is therefore correct. The fault is the tool's (S1): `tools/shadow_days.ts` draws a detailed agent's day with `pick.int(1, 350)` and never checks `P.present`, while it re-draws population people who are absent.
  - This slot was not a shadowed day, so the sample has 19 shadowable days, not 20.
  - The reason "not here" for a dead man is also poor for the dev overlay (the planner says "not yet born" for the unborn).

### #80 Karma: leader of ten on the rounds (score 3)
Sunrise 06:58, sunset 17:02; near full moon (Kislimu 13).
- **Fine:**
  - The off-watch morning: talk 07:59–10:58, the forecourt, knucklebones 11:38–12:47.
  - `13:03 eat — a meal before the watch`, `22:04 eat — a meal after the watch`, and bed at 22:27.
- **A fixed loop.**
  - From `14:00 patrol → post_treas_2` to `21:59 patrol @ post_stair_s` he walks the same 16 posts in the same order: treas_2, tachara_1, tachara_2, hadish_1, hadish_2, harem_1, harem_2, stair_n, stair_s, gate_w1, gate_w2, gate_s1, gate_s2, apa_w, apa_e, treas_1.
  - Each lap takes 57–62 min (lap 1 is 14:00–15:02, lap 2 15:02–~15:59), and he completes about 7.
  - That is 266 task changes; the tool elides 186 of them.
  - A watch officer makes his rounds at intervals: at the change, mid-watch, and when a relief is due. In between he stays at the guard room, sees to reliefs and answers calls.
  - Eight hours on one fixed path is exactly what §9.2 rules out ("People make decisions; they don't follow fixed paths").
- **After scoring:**
  - The elided part holds `17:48–18:11 eat @ garrison_hearth_n — bread and water at the hearth between rounds` (plan checked), so he is fed. The score rests on the loop, not on food.
  - The plan is two blocks of `patrol @ terrace_round` (14:00–17:48 and 18:11–22:00; population.ts:1368, 1376). The detailed tier turns each block into continuous laps.
  - Leg times now scale with distance: 235 m in 4 min, 260 m in 5 min, and 210 m in 4 min (0.87–0.98 m/s straight-line). So round 2's N5 is fixed.

### #57 Piršuš: guard, B watch (score 4)
Sunrise 06:18, sunset 17:42.
- **Fine:**
  - A morning off watch, with two visits to the forecourt.
  - `13:06 eat — a meal before the watch`.
  - `14:04 stand_guard @ post_harem_1`.
- **A relief that never comes.**
  - `19:19 stand_guard @ post_harem_1 — waiting to be relieved`, then `19:40 … on watch` until 22:00.
  - He does not eat until `22:11 eat — a meal after the watch`: 9 h 05 min without food, and 8 h at one post.
  - That breaks the project's own Q-064 rule ("nobody awake goes more than ~7 h without food").
- **After scoring:**
  - His plan says `19:19–19:34 eat @ post_harem_1 — bread and water at the post (no man of the patrol to relieve him)`. The detailed sim replaced it (S2).
  - On that B watch there was only one patrol man (pid 174). He was standing in at other posts: `19:19–19:49 stand_guard @ post_apa_w`.

### 7753: farmer, threshing (score 4)
Sunrise 05:03, sunset 18:57.
- **Fine:**
  - Up at 04:41.
  - `breakfast … the new bread`. His wife 7754 grinds, kneads and bakes 03:27–04:25 (plan checked after scoring).
  - `05:33–10:45 thresh … threshing and winnowing` (wind 3 m/s).
  - `11:23–14:53 sleep — sleeping through the heat` at 40 °C.
  - The animals at 16:00, an exchange at dusk, and bed at 21:24.
- **The day's bread vanishes.**
  - `05:30 walk … [carrying a winnowing fork, and bread and water for the day]` is followed by `10:45 walk … [carrying a winnowing fork]` and `10:54 eat @ h:2169 — the midday meal with the household, back from the field`.
  - The bread and water are neither eaten nor brought back (S6). "Back from the field" follows a threshing floor.
- **Placeholders:** `thresh` 5 h 12 min, `tend_animals` 1 h 45 min.

### 16484: young homemaker, threshing (score 4)
Sunrise 05:08, sunset 18:52.
- **Fine:**
  - `04:18 grind … at the quern` in the dawn twilight.
  - `05:31–11:02 thresh … winnowing` (wind 3 m/s).
  - Sleep through the heat 11:40–14:30, then spinning, grinding, supper, and bed at 20:41.
- **No water all day.**
  - A two-person household on a 35 °C dust day, after 5.5 h of winnowing, draws no water.
  - I checked her husband 16483's plan after scoring: he draws none either.
- **The carried bread and water vanish:** carried out at 05:27, not eaten, and not in hand at 11:02 (S6). Her husband does eat his at the floor.
- **Placeholders:** `thresh` 5 h 31 min, `spin` 1 h 39 min.

### 2350: treasury textile worker (score 4)
Sunrise 05:03, sunset 18:57.
- **Fine:**
  - An 8-min walk to `ws:2 — treasury workshop: textiles`. Textiles among the treasury staff are B (HENK2023, PEOPLE P5.4).
  - Weaving 06:57–15:00 with a 35-min meal at the workshop.
  - Supper, a dusk visit to Nanitin (15 min each way, home by 20:10), and bed at 20:13.
- **Filler.**
  - `04:10–06:02 rest @ h:876 — at home`: awake 53 min before sunrise with nothing to do for 1 h 52 min.
  - `15:07–18:10 rest — resting at home after work`: 3 h 03 min.
- **Nobody keeps the house.** Both members work at the treasury. Nobody fetches water, grinds, bakes or collects the ration. Day 63 falls inside E-01's day 1–5 issue window (C). Yet they eat "breakfast … the new bread". Issued bread would explain it, but nothing shows it.
- **Placeholder:** `weave` 7 h 28 min, the whole working day.

### 46624: infant of one month (score 4)
Sunrise 06:03, sunset 17:57.
- **Fine:**
  - 10 feeds, at 01:05, 05:17, 07:45, 09:45, 11:22, 12:58, 14:57, 17:58, 19:16 and 21:42.
  - About 13 h of sleep.
  - On a mat or in the lap while the mother works; carried on the back.
- **The only outing is all nursing.**
  - `17:55 rest @ road:plain — carried on the mother's back`, then `17:58–18:13 eat @ well:v_35 — nursed by the mother`, then back.
  - After scoring: the mother 36597's plan has `17:58–18:13 rest @ well:v_35 — stopping to nurse the baby` and then `18:13 carry_jar_head — carrying water home`. The feed replaced the drawing of water, and a full jar appears (S5).
- **Minor:** awake spans of 1 h 42 min (08:03–09:45) and 1 h 22 min (10:00–11:22) are long for a one-month-old.

### 45269: infant of three months, town (score 4)
Sunrise 06:22, sunset 17:38.
- **Fine:**
  - 9 feeds, including 01:51 and 03:21.
  - About 14 h of sleep.
  - Carried to `ws_textile` and kept on a mat beside the weaving mother.
  - After scoring: the mother 3383's plan cuts each feed out of her weaving (`07:19–07:33 rest @ ws_textile — stopping to nurse the baby`, and the same at 09:26, 11:49 and 14:37). This is right.
- **The second well trip is nursing, not water.** `17:31–17:46 eat @ well:q_lt_e — nursed by the mother`. The mother's plan again shows `rest — stopping to nurse the baby`, then `17:46 carry_jar_head` (S5).
- **Minor:** awake 09:38–11:49 (2 h 11 min) on a mat is long at 3 months.

### 28080: young homemaker, threshing (score 4)
Sunrise 05:06, sunset 18:54.
- **Fine:**
  - `03:30 grind` in astronomical twilight, and `04:07 draw_water` in nautical twilight. Early water in the hot season is plausible.
  - `05:31–10:30 thresh — turning the sheaves under the animals' hooves`.
  - Sleep and rest through 39 °C.
  - Spinning, grinding for tomorrow, the women in the lane 16:44–17:50, four meals, and bed at 20:58.
- **Bread nobody baked.**
  - `04:43 eat — breakfast with the household: the new bread`.
  - She grinds and fetches water but does not knead or bake.
  - After scoring I checked her husband 28079 and the elder 28081: neither bakes (S7).
- **The carried bread vanishes:** carried out at 05:28, not eaten, and not in hand at 10:30 (S6).
- **Placeholders:** `thresh` 4 h 59 min, `spin` 1 h 06 min.

### 28146: boy of 7, winter (score 4)
Sunrise 06:56, sunset 17:04.
- **Fine, a rich day that carries goods properly:**
  - `06:27 tend_animals — letting the household's animals out and giving them water` at civil dawn.
  - `09:01 carry_sack … a measure of barley` → `09:04 exchange … for oil` → `09:23 carry_jar … the oil home`.
  - Two water trips with a small jar.
  - Minding the little ones.
  - `11:57 carry_bread … out to the men in the field` on the last day of E-40's sowing window.
  - Home from the lane before dusk, supper at 16:12, and bed at 18:37.
- **Riding and archery for a plain farm boy (S8).**
  - `07:23–08:58 train — learning to ride and to shoot with the bow {HDT 1.136}` on a −5 °C morning, from an 8-person farm household on the plain.
  - The project's own PEOPLE.md P5.5 glosses HDT 1.136 as "Persian elite custom".
  - XEN-CYR 1.2.15, which the project read in full, says only those "in a position to maintain their children without work" send them to the common schooling.
  - Where a farm household gets a horse for a 7-year-old is not addressed.
- **Minor:** `carrying the midday bread and water out` carries only `[bread in a basket]`.
- **Placeholders:** `tend_animals` 23 min, `train` 1 h 35 min.

### 11229: farmer, threshing (score 4)
Sunrise 05:36, sunset 18:24.
- **Fine, the best farm day in the sample:**
  - Threshing and winnowing 06:05–10:33.
  - Sleep through the heat, then mending tools and baskets.
  - `15:19–16:12 thresh — winnowing in the afternoon wind` (wind 3 m/s).
  - Supper, a visit to Karaana after dusk, and bed at 20:52.
- **The only fault:** bread and water carried out at 06:01 and not eaten. The midday meal is at home, "back from the field" (S6).
- **Placeholders:** `thresh` 5 h 21 min, `craft` 1 h 51 min.

### 34225: young farmer, winter (score 4)
Sunrise 06:55, sunset 17:05.
- **Fine for the season:**
  - `rest — at home: little field work in winter` fits E-40 ending in month 9.
  - The animals twice, mending, three meals, and bed at 19:04.
- **Thin.**
  - `06:21–07:24 talk` before breakfast (1 h 03 min).
  - `10:04–11:46 rest`.
  - `14:15–15:53 rest`, then `15:53–16:12 rest`: one block split in two.
- **No fuel.** It is −1 °C in January. Nobody gathers dung or brushwood, although `lives.json` children.work lists it. No fire or hearth appears.
- **Minor:** two exchange sessions (07:47–08:50 and 16:56–17:35), the second after sunset.
- **Placeholders:** `tend_animals` 2 h 44 min, `craft` 21 min.

### 27049: boy of 3 (score 3)
Sunrise 05:04, sunset 18:56.
- **Fine:**
  - With the mother.
  - `08:37 play @ h:6743 — playing at a neighbour's house with their children`.
  - `11:33–13:39 sleep — a midday sleep`.
  - The lane with the older children watching.
  - Three household meals.
- **Teleport.**
  - `19:01–19:52 eat @ h:6743 — eating with the mother [with 27046]` is followed directly by `19:52–20:34 sleep @ h:6369 — asleep at home [with 27048]`, with no walk.
  - The same trip took 3 min each way in the morning (08:34–08:37, 09:29–09:32).
  - After scoring: his brother 27048 stays at home 18:58–20:37 (`rest — with the household`), so nobody fetched him. Cause: population.ts:1326–1327 (S4).
- **A second supper with no reason in his line.**
  - `18:26–18:58 eat @ h:6369 — a meal with the household`, then `19:01–19:52 eat @ h:6743`.
  - After scoring: the mother is `at a kinsman's birthday meal` (E-37, HDT 1.133), so the event is evidenced. His line drops the reason.
- **Minor:**
  - He plays in the lane 14:57–15:50, the hottest hour of a 38 °C day, while adult outdoor work stops for the heat (E-64).
  - He is up at 04:19, and night plus nap come to about 10.5 h, low for a 3-year-old.
  - `09:29 walk — walking along the lane to a neighbour's house` is the walk home.

### 11472: elder woman of 72 (score 4)
Sunrise 05:16, sunset 18:44.
- **Fine:**
  - At home on day 33, the first day of the barley harvest (E-41).
  - Spinning, minding the 5-year-old granddaughter, a visit to Kuraaza, an afternoon sleep, three meals, and bed at 21:13.
- **"A little grinding" is 1 h 44 min.** `13:41–15:25 grind — light work: a little grinding` is heavy saddle-quern work for a woman of 72.
- **Filler.** About 3 h 50 min of `rest` in five spells: 04:55–05:45, 06:04–06:25 and 06:25–07:14 (two consecutive rest blocks), 15:25–16:53 and 17:44–18:04.
- **Placeholder:** `spin` 2 h 35 min.

### The four 5s, in one line each
- **#63 Barnukka.**
  - Breakfast, then down to his family in q_pw_n (26 min) and a meal with them.
  - Back up (38 min) for the B watch at `post_tachara_2`, relieved at 17:00 for bread (`17:07 walk → garrison_hearth_s`).
  - On post to 22:00, supper, and bed at 22:35.
  - Quibble: the log lists only his arms, so it does not show whether he wears a cloak through a −3 °C night.
- **30063.**
  - On a 1 m/s day he threshes with the animals and does not winnow, which matches Q-141.
  - He eats the carried bread at the floor (`10:30 eat @ threshing:v_27 … bread and water carried out in the morning`) and rests there through 41 °C.
- **43569 and 43545.**
  - Departure from the road station: breakfast with the party, loading the animals, 3 h on the road, then "gone on toward the next station".
  - Both days are the same script (S9).

## Systemic findings

**S1. The sampler draws dead or absent detailed agents.**
- `tools/shadow_days.ts` picks a detailed agent's day with `pick.int(1, 350)` and never checks `P.present`. The population branch re-draws until the person is present.
- #49 (person 149, `dies: 189`) was drawn for day 202. His output is `00:00 offmap @ - — not here`, and the header still describes him as a living guard.
- So the sample holds 19 shadowable days, not 20.
- Fix: re-draw, or print "died on day 190".

**S2. The detailed tier does not follow the plan it performs (§9.5).**
- #57's plan: `19:19–19:34 eat @ post_harem_1 — bread and water at the post (no man of the patrol to relieve him)`.
- The detailed log: `19:19 stand_guard — waiting to be relieved`, then `19:40 on watch`.
- `sim.ts` ll. 214–215 keep a guard at his post until "the relief arrives" whenever his plan segment is not `stand_guard` at that post. A planned meal at the post trips it.
- He fasts 13:06–22:11, against Q-064.
- Also a design gap: on this B watch only one patrol man (pid 174) served the relief rotation, so eight posts' men eat at their posts.

**S3. The leader of ten's rounds are a fixed loop.**
- population.ts:1368 and 1376 plan 3.8 h of `patrol @ terrace_round`, then 0.4 h of bread, then patrol again until the change.
- The detailed tier walks the 16 posts in one fixed order, about one lap an hour, for 8 h (#80, 266 log changes).
- Rounds should be periodic, with time at the guard room between, and the order and tempo should vary.
- Leg timing itself is now fine (round 2 N5 fixed).

**S4. Small children teleport home at bedtime.**
- population.ts:1326–1327: when the mother is still out at the child's bedtime and another member is at home, the child is put `asleep at home` with that member. No walk is made and nobody carries him.
- 27049: `19:01–19:52 eat @ h:6743` → `19:52 sleep @ h:6369 [with 27048]`, while 27048 never leaves home.
- Fix: either the mother (or the other member) walks the child home, or the child sleeps "carried by the mother" where she is. The else-branch already does the latter.

**S5. A feed that falls in a well visit replaces the drawing of water.**
- Both sampled infants' mothers are affected:
  - 36597: `17:58–18:13 rest @ well:v_35 — stopping to nurse the baby` → `18:13 carry_jar_head — carrying water home`;
  - 3383: `17:31–17:46 rest @ well:q_lt_e — stopping to nurse the baby` → `17:46 carry_jar_head`.
- Water that was never drawn is carried home. §9.5 says goods are physical objects.
- Fix: nurse, then draw; or draw, then nurse.

**S6. Food carried out to the threshing floor vanishes.**
- Four of five threshing days: 7753 (05:30 / 10:45), 16484 (05:27 / 11:02), 28080 (05:28 / 10:30) and 11229 (06:01 / 10:33).
- Each carries `[… bread and water for the day]` out and returns `[carrying a winnowing fork]` only, then eats the midday meal at home "back from the field".
- Only 30063 (and 16483, checked after scoring) eats the carried bread.
- Fix: carry bread only when the meal is at the floor, or give a mid-morning bite.

**S7. Food preparation and water are missing from some households.**
- No kneading or baking appears in any of the 20 sampled timelines.
- Household 6597 (28080's) eats `breakfast … the new bread` on day 92 with no baker. After scoring I checked all three members.
- Household 4057 (16484's) draws no water at all on a 35 °C dust day (both members checked).
- Household 876 (2350's) keeps no house at all.
- Baking does exist elsewhere: 7754 grinds, kneads and bakes 03:27–04:25 on day 80. So this is a branch that is skipped, as round 1 found for #37 ("grinding with no baking").

**S8. Persian boys' riding and archery is given to every Persian household.**
- `lives.json` children.persian_boys_training (ages 6–14, p 0.3) and population.ts:1669 check only `this.hh.persian`, not status.
- PEOPLE.md P5.5 itself calls HDT 1.136 "Persian elite custom".
- XEN-CYR 1.2.15 (read in full; the project's own source) restricts the common schooling to families who can spare the child's work.
- This is a conflict between sources that must be logged in `OPEN_QUESTIONS.md` (rule 3). The rule should be restricted, for example to households of standing, or the riding dropped for farm households.
- Example: 28146, 07:23–08:58, −5 °C.

**S9. Fixed-duration templates (recurs from round 1 C7 and round 2 N4).**
- The two travellers' departure days are identical in structure and duration:
  - breakfast 33–34 min;
  - `tend_animals — loading the animals` exactly 48 min (`this.t + 0.8`, population.ts:2104);
  - `walk — on the road out of the plain` exactly 3 h 00 min;
  - then offmap.
- 43569 runs 07:34 / 08:22 / 11:22 and 43545 runs 07:14 / 08:02 / 11:02.
- The guards' "meal before the watch" at 13:03 / 13:06 and "readying for the watch" at 13:44 / 13:45 are close, but they are the watch system. Guards' wake times now vary (06:30–07:30), so round 2's minute-identical guards are not seen.

**S10. Idle filler and missing winter needs.**
- Long unexplained rest or talk blocks:
  - #70: 12 h at one hearth;
  - 2350: 04:10–06:02 and 15:07–18:10;
  - 34225: about 4 h 40 min;
  - 11472: about 3 h 50 min;
  - #6: 5 h.
- No one gathers fuel on the two frost days (34225, 28146), and no fire is lit at dusk anywhere in the town or plain timelines (§9.2 "Fires are lit at dusk"; `lives.json` lists dung and brushwood as chores).
- The log never shows the §9.2 response to cold ("cover up in cold"): #63 through a −3 °C night, 28146 at −5 °C.

**S11. Labels that do not match (recurs from round 1 C10 and round 2 N7).**
- #6: "his wife and children" for one newborn.
- 11472: "a little grinding" for 1 h 44 min.
- 27049:
  - "walking along the lane to a neighbour's house" for the way home (population.ts:1341 uses the same label both ways);
  - "eating with the mother" drops "at a kinsman's birthday meal".
- 28146: "the midday bread and water" carries only bread.
- "Back from the field" after the threshing floor: 7753, 16484, 28080 and 11229.
- #49: "not here" for a dead man.
- Tool: `(name from the attested pool)` for all 14 population people.

**S12. Placeholders (recur from rounds 1 and 2).**

| person | placeholder activities | time |
|---|---|---|
| 7753 | thresh, tend_animals | 6 h 57 min |
| 30063 | thresh, tend_animals | 6 h 21 min |
| 16484 | thresh, spin | 7 h 10 min |
| 2350 | weave | 7 h 28 min |
| 43569 | tend_animals | 48 min |
| 28080 | thresh, spin | 6 h 05 min |
| 43545 | tend_animals | 48 min |
| 28146 | tend_animals, train | 1 h 58 min |
| 11229 | thresh, craft | 7 h 12 min |
| 34225 | tend_animals, craft | 3 h 05 min |
| 11472 | spin | 2 h 35 min |
| **total** | 11 of 14 population people | **50 h 27 min** |

- The build's activity-coverage check (§9.5) should be failing on these.
- `thresh` is the main work of every summer farm day in this sample.

## Earlier rounds: do their findings recur?

| earlier finding | status in this sample |
|---|---|
| R1 C1: meals inverted, workers unfed | **Partly recurs through S2.** #57 goes 9 h without food because the detailed tier drops his planned meal. Every population person eats 3–4 times. |
| R1 C2: plain children never sleep | **Not seen.** 27049, 28146 and both infants sleep at night and nap. |
| R1 C3: infants fed only at meals | **Fixed.** 9–10 feeds including night feeds. A new problem: S5. |
| R1 C4: marriage takes mothers away | **Not seen.** |
| R1 C6: households do not eat together | **Mostly fixed.** Suppers are shared (16484 and 16483 both at 17:56). Midday meals split at the threshing floor, which is reasonable. |
| R1 C7 and R2 N4: clockwork templates | **Recurs** in the travellers (S9). Not seen in the guards. |
| R1 C9: long guard stints, weather | **Recurs once** (#57: 8 h at one post, through S2). #63's relief works. No rain day was sampled with a living person. |
| R1 C10 and R2 N7: labels | **Recurs** (S11). |
| R1 C11 and R2: tool, abstract LOD | Household headers are now correct (checked #6 and #80). The detailed agents are **still abstract-LOD**. **New:** dead agents can be sampled (S1). |
| R1 and R2 placeholders | **Recurs:** 11 of 14 people, 50 h 27 min (S12). |
| R2 N1: older children on a play template | **Not seen.** The only older child (28146, 7) works most of the day. No girl of 9–13 was sampled, so this is unverified. |
| R2 N2: motherless household | **Not sampled.** |
| R2 N3: harvest ahead of the sources | **Fixed.** All threshing falls on days 80, 92, 97, 127 and 136, inside E-43's days 43–141 (Q-140). |
| R2 N5: 2-min patrol legs | **Fixed.** Leg time scales with distance. |
| R2 N6: winnowing in a calm | **Fixed.** 30063 at 1 m/s threshes without winnowing; 11229 winnows "in the afternoon wind" (Q-141). Heat is handled for all threshing; the one small exception is the toddler's lane play at 15:00 (27049). |
| R2 N8: nothing carried | **Fixed in form.** Arms, forks, jars, sacks and baskets are now carried. **New:** carried goods vanish or appear (S5, S6). |

## What holds up
- **Season and weather.**
  - Threshing is in window, and heat rest applies on every threshing day.
  - Winnowing follows the wind.
  - Winter days are short on field work ("little field work in winter").
  - The weather lines are plausible for each month.
- **Sleep fits the sun.** Plain and town adults rise 0.35–0.9 h before sunrise (28080 1.6 h, to grind in the harvest) and go to bed 1.3–2.5 h after sunset. Infants sleep 13–14 h. The guards keep the A-B-C-off-off rota (Q-060).
- **Commutes are plausible.** The town to the Terrace takes 22–26 min down and 35–38 min up. A village to its well or floor takes 3–4 min. The 210–260 m patrol legs take 4–5 min.
- **Good evidence-based detail.**
  - The birthday meal (E-37, in the mother's plan).
  - Nursing breaks cut out of the weaving shift.
  - A household that sits up by the grain heap at night (16483, plan checked).
  - Barley exchanged for oil and carried both ways.
  - The midday bread carried to the men in the field.
  - Guard family visits.
  - The guards' arms by origin (Q-144).
- **Names** in the guard headers are attested (PF 15, PF 51/52, EWB) and matched to origin.
- **No anachronism** in any world-facing text. Out-of-world labels such as "homemaker" and the `post_harem_*` ids stay out of the world, as round 2 advised.

## VERDICT

**FAIL.** 3 of 20 people score below 4:

| person | score | cause |
|---|---|---|
| #49 Appiyama | 2 | nothing to shadow; after scoring, a dead agent sampled by the tool (S1) |
| #80 Karma | 3 | 8 h fixed 16-post loop (S3) |
| 27049 (boy, 3) | 3 | teleport at bedtime (S4) and an unexplained second supper (S11) |

Even with #49's slot re-drawn, #80 and 27049 fail, so the verdict does not depend on the tool fault.

The minimum before a re-review:
1. Fix S3 (periodic rounds) and S4 (the child is walked or carried home).
2. Fix the tool (S1): re-draw dead or absent agents.
3. Fix S2 (the detailed tier drops a planned meal at the post) and S5 (nursing replaces drawing water). They did not cause a failing score here, but they are §9.5 faults, where the plan and what is performed or carried disagree.
4. Log the HDT 1.136 / XEN-CYR 1.2.15 conflict (S8) in `OPEN_QUESTIONS.md`.
5. Draw a fresh 20-person sample with a new pick seed.

S6, S7 and S9–S11 are not blocking. Fixing them would move most of the thirteen 4s to 5s. The placeholders (S12) do not change these scores, but they block §9.5's activity-coverage check on their own.
