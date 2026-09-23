# Shadow review, Phase 5, round 2 (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5). I did not see how the simulation was built. I scored from the day timelines alone, before reading the round-1 review or any simulation code.
- **Date:** 2026-09-23
- **Gate:** "a reviewer shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick23.txt`: seed 1, pick seed 23, 6 detailed Terrace agents and 14 people of the population. The builders had not seen this sample.
- **Read before scoring:**
  - The sample.
  - `PERSEPOLIS_BRIEF.md`: a grep for its calendar and harvest lines.
  - `research/CALENDAR_AND_UNITS.md`: the month table. Day 1 = 1 Nisanu = 17 Apr 467 BCE (Julian).
  - `research/EVENTS.md`: the E-40 to E-47 and E-62 rows.
  - `research/PLAIN.md` and `research/PEOPLE.md`: the crop and harvest rows.
  - For transparency: a grep for "harvest" also printed the summary lines of `research/OPEN_QUESTIONS.md` Q-056, Q-057 and Q-061. Q-061 outlines the infant-care rule.
- **Read after the scores were written:** the scores were saved to a scratch file at 11:58 UTC.
  - `REVIEWS/shadow_phase5.md`, the round-1 review.
  - `tools/shadow_days.ts`.
  - `src/data/people_places.json`, for the guard-post coordinates.
  - Read-only scratch scripts, kept outside the repo, that import the simulation. They queried:
    - the seed-1 records of households 5407, 1747, 2801 and 6731;
    - the plans of 23454, 23453, 23449 and 10982;
    - the hourly weather;
    - `sunTimes()` for all 20 days.
  - I did not read `src/people/**` source. The only exception is two lines of constant lists that a grep for post ids printed. I did not read `DECISIONS.md`.
- **One score changed after measurement:** 31549 went from 3 to 4. I had assumed her evening outing was in the rain; the hourly weather shows the rain had stopped by 15:00.
- **Dates** below are Babylonian, with an approximate Gregorian-equivalent date (Julian − 5 d). Sunrise and sunset come from the sim's `sunTimes()`, in local solar time.
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **3 of 20 people score below 4, so the gate fails.**
   - All three are girls aged 9–13 whose day is play where the evidence expects work (N1): 39179 (13, "farmer") scores **2**, and 839 (9) and 23451 (11) score **3**.
   - For a 13-year-old recorded as a farmer, the child's routine leaves 38 min of work in 14 h awake.
2. **A mother's death is not handled (N2).**
   - Household 5407 lost its mother (23450) on sim day 218. About three months later it is a 38-year-old man and four children, one of them an 11-month-old infant.
   - The father minds the infant and the 3-year-old. Their plans still say `on the mother's back while she works [with 23449]` and `fed by the woman minding it (a wet nurse or animal milk) [with 23449]`.
   - Nobody in the house grinds or bakes, and the eldest daughter goes out to play for four hours.
3. **The harvest runs ahead of the project's own sources (N3).**
   - Barley is being reaped on day 15 (≈26 Apr), and a mother is at the threshing floor on day 7 (≈18 Apr).
   - PLAIN.md says "harvest May–Jun". E-41 cites FARS-CROP ("harvested between May and July") and glosses its window as "mid-May – June", but its month range (1–3) starts on 17 Apr.
   - This conflict is not logged in `OPEN_QUESTIONS.md` (rule 3).
4. **Placeholders.**
   - 8 of the 14 population people spend part of their day in activities with no performance: `reap`, `thresh`, `spin`, `herd`, `field_work`, `tend_animals` and `gather`. Together that is about 29 h 40 min of the sampled days.
   - `spin`, the commonest work of women, is a placeholder in 4 of the 5 homemakers' days.
   - None of the 6 detailed agents has a placeholder activity.
   - The detailed agents were still stepped in the abstract LOD (`tools/shadow_days.ts`: `a.lod = 'abstract'`). Their on-screen routes and performance were not exercised, and the 2-min patrol legs (N5) come from that.
   - Nothing in the input shows whether the 14 population people are rendered. §9.5's requirement that "what a person is doing on screen matches what the simulation says" remains unconfirmed.
5. **Tool.** The headers print start-of-year ages.
   - 5718 is shown as "f1" on a day she is 2.
   - 10982 is shown as "f1" at 2 years 1 month.
   - A separate label error in the same household: 5713's reasons call a 2-year-old and a 3½-month-old "the twins".

## Scores

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #110 (unnamed) | mason, man 26, Lydian | 31 (Aiaru 2, ≈12 May; 16–35 °C) | **4** | Three meals, a 32-min climb, and a stop at 15:30 as E-60 says. But a "mason" who only "inspects" all day, and a 16-min walk home from a lane in his own quarter. |
| 2 | #79 Kadudda | guard, man 37, Median | 174 (Ululu 26, ≈2 Oct; 12–32 °C) | **4** | Coherent A-watch day. He eats at 11:56 and again at 14:10. His afternoon errand is a conversation. |
| 3 | #4 Adsarma | guard, man 35, Persian | 231 (Arahsamnu 24, ≈28 Nov; 1–16 °C) | **4** | Coherent. His day is minute-identical to #79's (05:00, 05:01, 05:36, 06:00, 19:48, 20:24, 20:25) although sunrise is 43 min later. |
| 4 | #65 Ašbarnuka | guard, man 42, Median | 161 (Ululu 13, ≈19 Sep; 12–32 °C) | **4** | B-watch day. He is relieved to eat 1 h 43 min into the watch and 2 h 41 min after a full meal, then stands 5 h 43 min. |
| 5 | #43 Supra | guard, man 40, Median | 234 (Arahsamnu 27, ≈1 Dec; −1–15 °C) | **4** | Nap before the night watch, and the patrol stands in while a post man eats. About 6 h of knucklebones. Patrol legs take 2 min whatever the distance (up to 260 m). |
| 6 | #131 Kamša | courier, man 23, Persian | 92 (Duzu 3, ≈12 Jul; 20–39 °C) | **4** | Meals are right, including supper "kept for the late-comer". But he spends 12 h "waiting for the relay" and carries nothing. |
| 7 | 21502 | homemaker, f 21 (plain) | 15 (Nisanu 15, ≈26 Apr; 10–27 °C) | **4** | Good harvest day with 4 meals and nursing at the field edge. The reaping is about 3 weeks early for the sourced window, and she is at home 4 h at midday at 24–27 °C. |
| 8 | 32529 | child, f 3 (plain) | 255 (Kislimu 19, ≈22 Dec; −5–8 °C) | **5** | With her mother all day, three meals, a nap, the visit and the well. |
| 9 | 10981 | homemaker, f 21, Elamite (plain) | 143 (Abu 25, ≈1 Sep; 19–38 °C) | **4** | Sound summer day: she works in the morning and sleeps through 38 °C. But she "winnows" in 0.5–0.8 m/s air. |
| 10 | 31549 | child, f 10 (plain) | 329 (Addaru 4, ≈6 Mar; 0–15 °C, rain 4 mm) | **4** | Kept indoors while it rained, and minds the baby 73 min. About 9 h of play, and she is out in the lane 76 min past sunset. |
| 11 | 4301 | child, m 3 (town) | 286 (Tebetu 20, ≈22 Jan; 1–15 °C) | **5** | With his mother, plays at the door "within call", naps, goes to the well with her, and is in bed at dusk. |
| 12 | 25375 | homemaker, f 18 (plain) | 269 (Tebetu 3, ≈5 Jan; −5–8 °C) | **5** | Grinds, kneads and bakes before breakfast, visits Udusana, spins, and has supper before sunset. |
| 13 | 29781 | child, f 4 (plain) | 7 (Nisanu 7, ≈18 Apr; 8–25 °C) | **4** | Left with a kinswoman while her mother works, a nap and four meals. Woken at 04:32, and napping in the lane; "outside the door" is 3 min away. |
| 14 | 39179 | farmer, f 13 (plain) | 183 (Tashritu 6, ≈11 Oct; 10–30 °C) | **2** | A 13-year-old "farmer" plays for 10 h 08 min in the sowing month, 8 h 50 min of it in the lane. Her only work is 38 min at the quern. |
| 15 | 5713 | homemaker, f 37 (town) | 310 (Shabatu 15, ≈15 Feb; 1–16 °C, rain 2.1 mm) | **4** | Nurses on demand, bakes, spins and stays in for the rain. "The twins" are a 2-year-old and a 3½-month-old. |
| 16 | 28539 | child, m 8 (plain) | 226 (Arahsamnu 19, ≈23 Nov; 2–19 °C) | **4** | Takes the animals out, but has them home by 10:08. His "errand" is 37 min standing in the lane. He plays until 74 min after sunset. |
| 17 | 839 | child, f 9, Egyptian (town) | 288 (Tebetu 22, ≈24 Jan; −3–10 °C) | **3** | 9 h 04 min of play and one 29-min errand, in a house with a baby and a 3-year-old. No childcare, water or quern. Out until 55 min after sunset at about 6 °C. |
| 18 | 19931 | farmer, m 55 (plain) | 220 (Arahsamnu 13, ≈17 Nov; 4–21 °C) | **4** | Coherent day with the field, the animals and a dusk visit. "Hoeing, weeding" falls at the peak of ploughing and sowing (E-40). |
| 19 | 21903 | homemaker, f 17 (plain) | 348 (Addaru 23, ≈25 Mar; 6–22 °C) | **5** | Best day in the sample: feeds every 2–3 h including at night, bakes, spins with the women, and fetches and carries water. |
| 20 | 23451 | child, f 11 (plain) | 305 (Shabatu 10, ≈10 Feb; −2–11 °C) | **3** | Fetches water and fuel. But her mother died about three months ago and there is a baby, yet she plays 4 h at a friend's house and does no grinding, baking or minding. |

Distribution: 5 → 4 people; 4 → 13; 3 → 2; 2 → 1. **3 of 20 are below 4** (round 1: 10 of 20).

## Findings for every person

### #110 (unnamed): mason (score 4)
Sunrise 05:17, sunset 18:43.
- **Fine:**
  - Three meals: `04:56 eat @ h:100 — bread and water before leaving (the household eats later)`, `12:01 eat @ work_hearth — the midday meal: the camp's bread and water` and `18:08 eat @ h:100 — the evening meal with the household`.
  - The climb 05:05–05:37 (32 min).
  - The day ends at 15:30 ("dawn to mid-afternoon", E-60). Bed at 20:30.
- **A mason who never dresses stone.** `05:50 inspect @ worksite_capital — overseeing the squad` runs to 12:00, and again 12:31–15:30.
  - A 26-year-old gang head is possible.
  - But nothing in his day is masonry, and he carries no tool, cord or square.
- **No shade.** He oversees 12:31–15:30 at 33–35 °C (hourly: 34.6 °C at 14:00). That is tolerable for an overseer who is not cutting stone.
- **Distance inconsistency.** `16:05 talk @ lane:q_lt_w — talking in the lane` (1 h 47 min) is in his own quarter, yet `17:52 walk @ road:town` takes 16 min to reach h:100 in the same quarter. Minor.
- **No name.** He is the only one of the 6 detailed agents without one.

### #79 Kadudda: guard (score 4)
Sunrise 06:10, sunset 17:50.
- **Fine:**
  - A-watch 06:00–14:00, relieved to eat.
  - Knucklebones.
  - About 8.5 h of sleep (20:25–05:00).
- **Two meals 2 h 14 min apart.**
  - `11:56 eat @ garrison_hearth_m — bread and water at the hearth, relieved at the post` is followed by `14:10 eat @ garrison_hearth_m — a meal after the watch`.
  - Four eating events in the day. Defensible (a bite on relief, then the main meal), but a visitor would notice.
- **An errand that is a chat.** `15:21 walk @ forecourt — an errand across the court` is followed by `15:25 talk @ forecourt`. Nothing is fetched or carried.
- **He never goes home.** He has a house in the lower town (h:79, 2 people) but spends all his off-watch hours at the garrison hearth. That is acceptable for a single day of the rota.

### #4 Adsarma: guard (score 4)
Sunrise 06:53, sunset 17:07.
- **Fine:**
  - Three meals, including relief to eat at 12:35.
  - An off-watch afternoon at the hearth.
  - Bed at 20:25.
- **Clockwork.**
  - `05:00 walk`, `05:01 eat — breakfast before the watch`, `05:36 talk — readying for the watch`, `06:00 patrol`, `19:48 eat — evening meal`, `20:24 walk`, `20:25 sleep` are identical to the minute with #79.
  - #79's day is 57 days earlier, with sunrise 43 min earlier and sunset 43 min later.
  - The dawn watch here changes 53 min before sunrise, and supper is 2 h 41 min after sunset. A garrison may run by the water clock, but not by the same minute in every season.
- **The same vague errand.** `15:19 talk @ forecourt — an errand across the court`.

### #65 Ašbarnuka: guard (score 4)
Sunrise 05:58, sunset 18:02.
- **Fine:**
  - A free morning before the B watch.
  - 14:00–22:00 on post.
  - Supper after the watch, and bed at 22:38.
- **The relief meal comes at the wrong point in the watch.**
  - `13:12 eat — a meal before the watch` comes first.
  - Then `15:48 walk @ garrison_hearth_s — bread and water at the hearth, relieved at the post`: 1 h 43 min into an 8-h watch and 2 h 41 min after a full meal.
  - Then `16:17–22:00 stand_guard` runs unbroken for 5 h 43 min through dusk.
  - Relief near the middle of the watch (about 18:00) would make sense.
- **Idle morning.** He has seven free morning hours (06:31–13:48) of hearth, rest and knucklebones while his household of three lives in the lower town. Minor.

### #43 Supra: guard on the night patrol (score 4)
Sunrise 06:54.
- **Fine:**
  - `19:07 sleep @ garrison_sleep — a short sleep before the night watch` until 21:36.
  - The rover stands in so a post man can eat: `23:00 patrol @ post_treas_1 — standing in at the post while its man eats` to 23:30. This is good organisation.
- **Very heavy gambling.** About 5 h 54 min of knucklebones: 08:34–11:06 and 14:43–18:05. That is plausible for idle soldiers.
- **Patrol legs, measured after scoring against `people_places.json`.**
  - Every leg is logged as 2 min, or 4 min, whatever its length.
  - `22:02 post_treas_2` → `22:04 post_tachara_1` is 235 m in straight line (≥ 1.96 m/s).
  - `22:16 post_harem_2` → `22:18 post_stair_n` is 260 m (≥ 2.2 m/s, a run, and the real path is longer).
  - `22:34 post_apa_e` → `22:36 post_treas_1` is 210 m.
  - Meanwhile the 4–8 m steps between the two jambs of one door take 2–4 min.
  - The loop as a whole (about 1,110 m straight-line in 36 min) is a sane patrol pace. The per-leg timing is an abstract-LOD artefact (see N5).

### #131 Kamša: courier (score 4)
Sunrise 05:06, sunset 18:54.
- **Fine:**
  - Bread before leaving.
  - `12:00 eat @ station — the midday meal`.
  - `19:15 eat @ h:1365 — the evening meal, kept for the late-comer`.
  - Bed at 21:02.
- **A day of nothing.**
  - `06:09 talk @ station — waiting at the station for the relay` runs to 19:00: 12 h 14 min of talk, apart from the meal.
  - No relay comes, nothing is carried, and no animals are seen to.
  - He takes no rest through a 39 °C afternoon.
  - A standby day is plausible with the court away, but §9.5's "what they carry" is empty.

### 21502: homemaker at the harvest (score 4)
Sunrise 05:29, sunset 18:31.
- **Fine:**
  - `03:55 grind … at the quern` before dawn.
  - Breakfast at 04:49.
  - `reap … binding sheaves at the harvest` behind the reapers from 05:19.
  - `08:41 eat @ field — bread and water`.
  - `09:19 rest @ field — stopping to nurse the baby`.
  - The midday meal at home.
  - Carrying sheaves to the threshing floor with the household.
  - Grinding for tomorrow, supper, and bed at 20:26 with a night feed.
- **Season.** Reaping on ≈26 Apr at 1,600 m is about 3 weeks ahead of the project's own sources (N3).
- **A long break in harvest time.** 12:08–16:19 is 4 h 11 min at home, including `12:47–14:47 talk — with the household` and `resting through the heat`, at 23.6–26.7 °C (hourly). No household in harvest rests that long at 27 °C.
- **An evidence code in the reason.** `carrying sheaves to the threshing floor with the household (E-43)`. Harmless out of world, but it should not reach the chronicle.
- **Placeholders:** `reap` 05:19–08:41, 09:02–09:19 and 09:49–12:08 (5 h 58 min).

### 32529: child, 3 (score 5)
Sunrise 06:58, sunset 17:02.
- With the mother all day: at home, at h:7302 on her visit, and at the well at 15:23.
- Three meals, and a nap 12:38–14:15.
- Bed at 17:37.
- About 15 h 45 min of sleep is at the top of the range for a 3-year-old, but defensible on the longest nights of the year.

### 10981: homemaker at the threshing floor (score 4)
Sunrise 05:42, sunset 18:18.
- **Fine:**
  - She works in the cool of the morning (06:02–10:30).
  - An early midday meal at 10:39.
  - `11:09 sleep — sleeping through the heat of the day` (38 °C).
  - Spinning and grinding in the evening cool.
  - A night feed at 03:03.
- **Winnowing in a calm.**
  - `06:02–10:30 thresh … — winnowing on the village floor (E-43)`, but the hourly wind is 0.5–0.8 m/s.
  - Winnowing needs a steady breeze. On a still morning a household treads or sledges the grain and waits for the wind.
  - The activity is fine; the reason is wrong for the weather.
- **Wrong destination.** `05:59 walk @ road:plain — to the fields` leads to the threshing floor.
- **Her 2-year-old is invisible in her timeline between the 03:03 feed and 12:27.**
  - Checked after scoring: the child's own plan puts her at the threshing floor "playing near the mother" and carried there and back.
  - But the child's plan sleeps straight through 00:00–05:21, while the mother's shows `03:03–03:13 rest — nursing the baby in the night`: a mother–child desync.
- **Placeholders:** `thresh` 06:02–10:30, and `spin` 16:06–17:08.

### 31549: child, 10 (score 4, revised from 3)
Sunrise 06:15, sunset 17:45.
- **Fine:**
  - Indoors while it rains (`07:44–12:12 play — playing indoors`).
  - `13:59–15:12 rest — minding the baby at home`.
  - Three meals, and bed at 20:13.
- **Play-heavy.**
  - About 8 h 58 min of play against 73 min of childcare.
  - She does no spinning, which is what a 10-year-old girl would do indoors on a wet day.
  - With three women (43, 16 and 16) and a girl of 13 in the house, a light load is possible, but not this light.
- **Out after dark.**
  - `17:54–19:01 play @ lane:v_28 — playing in the lane` starts 9 min after sunset under 97 % cloud.
  - I first scored 3 on the belief that she went out in the rain. The hourly weather shows 0.00 mm/h from 15:00 and 10–11 °C, so the outing is late but not wet.

### 4301: child, 3, town (score 5)
Sunrise 06:48, sunset 17:12.
- He is with the mother, or "outside the door with the neighbours' children, the mother within call". There is no walk, so the lane really is at the door.
- Three meals, and a nap 12:22–13:58.
- To the well with the mother at 16:40.
- Asleep at 17:30. Same long-sleep remark as 32529.

### 25375: homemaker (score 5)
Sunrise 06:56, sunset 17:04.
- Grinds, kneads and bakes (06:12–07:34), then `breakfast … the new bread`.
- `08:33–09:51 talk @ h:5807 — visiting Udusana`.
- Spinning, and grinding for tomorrow.
- Supper at 16:13, before sunset, then talk and bed at 18:42.
- **Notes:**
  - 2 h 14 min idle at home (09:54–12:08).
  - No water fetched although she kneaded dough. Stored jars or the husband could explain it; not an error.
- **Placeholders:** `spin` 12:38–15:06 and 15:40–16:04.

### 29781: child, 4 (score 4)
Sunrise 05:36, sunset 18:24.
- **Fine:**
  - `05:21–12:07 … with a kinswoman while the mother works [with 29650]`. 29650 is one of the mother's kin ties, checked after scoring.
  - A meal with the kinswoman at 08:41.
  - The midday meal and supper with the household.
  - Bed at 19:45.
- **Woken early.** She is up at 04:32, 64 min before sunrise, because her mother starts early. That gives about 10 h of sleep: realistic in a harvest, but this is day 7 (N3). `16:15–17:27 play @ threshing:v_26 — playing near the mother`.
- **A nap in the lane.** `12:49–14:01 sleep @ lane:v_26 — a midday sleep near the mother`. Possible in April shade.
- **"Outside the door" is not at the door.**
  - `14:20 play @ lane:v_26 — playing outside the door … the mother within call`.
  - Yet the same lane is a 3-min walk from the house (12:46–12:49 and 14:14–14:17), about 200 m away.
- **Demography, checked after scoring.** The mother, 29777 (43), is the wife of 29776 (31). A wife 12 years older than her husband is unusual in this society.

### 39179: "farmer" girl, 13 (score 2)
Sunrise 06:19, sunset 17:41.
- **The day is play from dawn to dark.**
  - `05:51–06:48 play — at home`.
  - `07:51–12:11 play @ lane:v_35 — playing in the lane` (4 h 20 min).
  - `13:34–16:50 play @ lane:v_35` (3 h 16 min).
  - `16:53–17:14 play — at home`.
  - `17:49–19:03 play @ lane:v_35`, ending 82 min after sunset.
  - Play totals 10 h 08 min out of 14 h 04 min awake. Her only work is `07:10–07:48 grind … grinding with the women` (38 min).
- **Why it fails.**
  - Tashritu is the start of ploughing and sowing (E-40, months 7–9) and the end of the vintage (E-45).
  - She lives in an eight-person farm household with a mother of 43 and a sister-in-law of 14.
  - A girl of 13, close to marriageable age, would spend the day with the women at the quern and oven, on water, fuel and spinning, or with the family in the fields.
  - Her recorded job is "farmer", yet nothing of a farmer appears.
  - A visitor following her would see an adolescent idling in the lane for most of the daylight.
- Meals and sleep are right, so the score is 2, not 1.

### 5713: homemaker, town (score 4)
Sunrise 06:31, sunset 17:29.
- **Fine:**
  - Feeds on demand: 9 feeds, including `02:12` and `22:04` at night.
  - Grinds, kneads and bakes before breakfast.
  - Spinning and minding the children.
  - Indoors all day in the rain.
  - Supper at 16:17, and bed at 20:11.
- **"The twins" are not twins.**
  - `07:57 rest — nursing the twins`, and 8 more like it.
  - Checked after scoring: 5718 (header "f1") turned 2 on day 296, and 45364 was born on day 203, so he is about 3½ months old.
  - Nursing a toddler and a baby together is plausible; the word "twins" is wrong (see item 5 above).
- **Grinding time.** She grinds 94 min for 2 adults and 6 children. That is short for a saddle quern, unless the 13-year-old daughter also grinds (not shown). Minor.
- **Placeholders:** `spin` 08:35–09:48 and 09:58–10:12.

### 28539: boy, 8 (score 4)
Sunrise 06:50, sunset 17:10.
- **Fine:**
  - `07:52 walk — taking the animals out`, then `07:55–10:04 herd @ pasture:v_23`.
  - Three meals, and bed at 19:51.
- **Short herding.** He has the animals home by 10:08. In the stubble-grazing season a boy herder usually stays out with them into the afternoon.
- **An empty errand.** `13:52–14:29 walk @ lane:v_23 — an errand for the household` is 37 min of "walking" at one lane point, and nothing is fetched or carried.
- **Out after dark.** `17:05–18:24 play @ lane:v_23`, until 74 min after sunset.
- **Placeholder:** `herd` 07:55–10:04.

### 839: girl, 9, Egyptian, town (score 3)
Sunrise 06:47, sunset 17:13.
- **Play, 9 h 04 min out of 12 h 34 min awake.**
  - `05:54–07:17 play — at home`, from 53 min before sunrise.
  - `07:37–12:12 play — playing at home` (4 h 35 min).
  - `14:19–16:19 play — playing at home`.
  - `17:08–18:08 play @ lane:q_pw_n`, until 55 min after sunset at about 6 °C.
- **Work.** Her only work is `13:44–14:13 walk @ lane:q_pw_n — an errand for the household` (29 min).
- **Why it fails.**
  - The household is a builder, the mother, a porter of 16, and girls of 13, 9 and 6, plus a boy of 3 and a baby.
  - With an infant and a toddler at home, a girl of 9 is one of the principal minders. The "child nurse" role of girls aged about 6–10 is one of the steadiest findings in the ethnography of agrarian households.
  - She would also fetch water and help at the quern.
  - A visitor following her sees a girl "playing at home" for 4½ hours while her mother tends a baby and a 3-year-old.

### 19931: farmer, 55 (score 4)
Sunrise 06:47, sunset 17:13.
- **Fine:**
  - Breakfast, then about 6 h in the field with the midday meal there.
  - The animals 15:01–16:00, and supper at 16:16.
  - `16:54–18:16 talk @ h:4678 — visiting Dudda` at dusk, and bed at 18:34.
- **The wrong task for the date.**
  - `07:44–11:45 field_work … hoeing, weeding and minding the crop`.
  - Day 220 is at the peak of ploughing and sowing (E-40: "peak 8: 10 Nov – 8 Dec", on dry days), and this day is dry.
  - "Weeding the crop" when the winter grain is going into the ground is the wrong work for mid-November.
- **The meal comes from nowhere.** `11:45 eat @ field:4666:2 — the midday meal`, but nobody brings it and he carries nothing out.
- **Placeholders:** `field_work` 07:44–11:45 and 12:14–14:00, and `tend_animals` 15:01–16:00.

### 21903: homemaker with a baby (score 5)
Sunrise 05:57, sunset 18:03.
- Feeds about every 2–3 h, day and night: 01:46, 04:57, 07:02, 09:23, 11:26, 13:49, 15:51, 18:06 and 21:17.
- Grinds, kneads and bakes before `breakfast … the new bread`.
- `07:34 spin @ lane:v_14 — spinning with the women outside the door`.
- `14:42 draw_water @ well:v_14`, then `15:03 carry_jar_head … carrying water home`.
- Grinding for tomorrow, supper at 17:34, and bed at 19:38.
- **Note:** her grinding is logged in four pieces, and 16:08–16:24 / 16:24–16:38 is one stint relabelled.
- **Placeholder:** `spin`, five spells between 07:34 and 12:00 (3 h 46 min).

### 23451: girl, 11, in a motherless house (score 3)
Sunrise 06:35, sunset 17:25.
- **Fine on its own terms:**
  - `07:26 draw_water … fetching water for the household`, then `07:40 carry_jar_head`.
  - `14:17 gather … dung and brushwood`, then `15:29 carry_sack … carrying the fuel home`.
  - Three meals with the household, and bed at 19:02.
- **The household.** A farmer of 38 and four children aged 11, 7, 3 and 0. There is no woman.
  - Checked after scoring: the mother, 23450 (35), died on sim day 218, about three months (86 days) earlier.
- **What the evidence expects.** In such a house the eldest daughter becomes the housekeeper. She would grind, bake, and mind the 3-year-old and the baby, and kin or a wet nurse would be drawn in.
- **What she does instead.**
  - `07:49–11:53 play @ h:5408 — playing at Makka's house` (4 h 04 min).
  - `12:30–14:13 rest — resting after the meal` (1 h 43 min, in February).
- **The rest of the household, from the plans checked after scoring.**
  - Nobody in the house grinds or bakes, yet the household eats "breakfast".
  - The father minds the baby and the 3-year-old, and their plans still speak of "the mother" and "the woman minding it" `[with 23449]`.
- A visitor following her home finds a house with no woman and a baby, and a daughter who spends the morning at a friend's house.
- **Placeholder:** `gather` 14:17–15:29.

## Cross-cutting findings (round 2)

**N1. Older children run on one play-heavy template.**
- **Play and work:**

  | person | play | work |
  |---|---|---|
  | 39179 (13, "farmer") | 10 h 08 min | 38 min |
  | 31549 (10) | 8 h 58 min | 73 min |
  | 839 (9) | 9 h 04 min | 29 min |
  | 23451 (11) | 6 h 28 min | about 2 h 13 min |
  | 28539 (8) | 6 h 07 min | about 2 h 53 min |

- **The shared template:**
  1. Wake at 05:51–05:54. Four of the five do, on days from 11 Oct to 6 Mar, while sunrise moves from 06:15 to 06:47.
  2. `play — at home`.
  3. Breakfast.
  4. A long morning block.
  5. The midday meal, then `rest — resting after the meal` for 50 min to 1 h 43 min.
  6. `walk @ lane — an errand for the household`, 23–37 min at one lane point with nothing carried.
  7. `play — playing at home`, then `play — at home`.
  8. Supper.
  9. `play @ lane — playing in the lane` until 55–82 min after sunset in 4 of the 5, including winter evenings at about 6 °C.
  10. `rest — with the household`, then sleep.
- **What is missing:** the work of girls aged 7–13, which is minding younger siblings, water, the quern, spinning and fuel. It appears only when a particular branch fires (23451's water and fuel, 31549's 73 min with the baby).
- **A role mismatch:** a 13-year-old recorded as a "farmer" gets the child plan.
- This produces all three failing scores. Round 1 saw the same balance and scored it 4 for an 8-year-old (Q-058); here it has 9–13-year-olds.

**N2. A mother's death leaves the household unreorganised.**
- In household 5407, three months after the mother died:
  - no woman has come in (no kinswoman, no wet nurse, no remarriage);
  - the eldest daughter has not taken over the house;
  - nobody grinds or bakes.
- The father is the infant's minder, and the texts call him "the mother" ("on the mother's back", "asleep beside the mother", "in the mother's lap") and "the woman minding it".
- The infant's own plan has 8 feeds, including 01:27 and 04:26, so the feeding rhythm is right. It is only the feeder who is not credible.

**N3. The harvest starts before the sourced window.**
- Reaping on day 15 (≈26 Apr), and a mother at the threshing floor on day 7 (≈18 Apr).
- **Sources:**
  - `research/PLAIN.md`: barley "harvest May–Jun"; height "0.3 in Mar → 0.85 in May".
  - E-41: FARS-CROP "harvested between May and July", glossed "mid-May – June".
  - Yet E-41's month range "1–3" begins on 17 Apr (Julian), about 12 Apr in the seasons.
- The sim follows the month range, not the evidence.
- This is a conflict between the evidence and a C-tier rule, and it belongs in `OPEN_QUESTIONS.md` (rule 3).
- Related: 19931 is weeding, where he should be ploughing or sowing, at the E-40 peak.

**N4. Fixed-duration templates.**
- **Kneading** lasts exactly 24 min in 3 of 3 baking mornings (25375, 5713, 21903).
- **The field-going homemakers** (21502 and 10981, days 15 and 143) share `grind 33 min → rest 21 min → breakfast 15 min → rest 10–12 min → walk`.
- **The rest between baking and breakfast** lasts 19–21 min in all three bakers.
- **The day-watch guards** are identical to the minute across seasons (#79 and #4).
- **Older children's waking** is fixed at 05:51–05:54 (N1).
- A visitor following one person will not see this. A visitor following two will.

**N5. Travel time in the abstract LOD.**
- The night patrol's legs are all logged at 2 min (a few 4 min), from 4 m to 260 m. That is 0.03–2.2 m/s in straight line.
- Other walks look right:
  - town to Terrace: 32 min;
  - town to the road station: 14 min;
  - village legs: 3–7 min.
- 29781's "outside the door" is 3 min from the door.

**N6. Weather effects.**
- **Rain works.** Both wet days keep people indoors while it rains.
- **Heat is uneven.**
  - It is handled for summer threshing (10981 sleeps through 38 °C).
  - A harvest household rests about 4 h at 24–27 °C (21502).
  - Meanwhile the mason oversees through 33–35 °C and the courier sits through 39 °C without rest.
- **Wind is ignored.** 10981 winnows in 0.5–0.8 m/s air.
- **Dark and cold are ignored** for children's evening play (N1).

**N7. Labels and reasons.**
- "The twins" for a toddler and a baby (5713).
- "(E-43)" inside a reason (21502, 10981).
- "To the fields" for a walk to the threshing floor (10981).
- `talk` for "an errand across the court" (#79, #4, #43).
- `walk` standing 23–37 min at a lane point as "an errand for the household" (28539, 839, 23451).
- `play — at home` (all older children).
- "The mother" for a father (N2).
- Stints split in two with a new reason:
  - `rest — stopping to nurse the baby` followed by `rest — nursing the baby` (21502 09:19 / 09:35);
  - `grind … flour` followed by `grind … for tomorrow's bread` (5713, 21903).
- The ages in the headers are start-of-year ages.

**N8. Carrying.**
- §9.5 asks "what they carry". Only 21502 (sheaves), 21903 (water) and 23451 (water, fuel) carry anything.
- None of the 6 detailed agents carries anything all day, and no line of theirs has a `[carrying …]` annotation. The mason has no tools, the courier has no dispatch, and the guards have no weapons recorded.
- Food eaten in the field is never brought or carried out (19931 11:45; 21502 08:41).

**N9. Anachronism.**
- None in any world-facing text.
- Some out-of-world labels sound modern: "homemaker", "squad", and the ids `post_harem_*` (Herzfeld's modern name for the building). They are harmless in logs and should stay out of anything a visitor sees.

## Round-1 systemic causes: status in this sample

| round-1 cause | status | evidence in this sample |
|---|---|---|
| **C1** Meals inverted (the hardest workers eat least) | **Fixed** (as far as sampled) | See note C1 below. |
| **C2** Plain children never sleep when they follow the mother | **Fixed** (in sample) | See note C2 below. |
| **C3** Infants fed only at the minder's meals | **Largely fixed** | See note C3 below. |
| **C4** Marriage takes mothers away | **Fixed as far as sampled; successor problem open** | See note C4 below. |
| **C5** Household demography (same-age pairs, no mother links) | **Partly fixed** | See note C5 below. |
| **C6** Households don't eat together | **Fixed** (where checked) | See note C6 below. |
| **C7** Clockwork synchrony | **Partly fixed** | See note C7 below. |
| **C8** Work hours conflict with E-60 | **Fixed** (one Terrace worker sampled) | See note C8 below. |
| **C9** Weather | **Partly fixed** | See note C9 below. |
| **C10** Activities that do not match reasons | **Largely fixed; new ones** | See note C10 below. |
| **C11** Tool and coverage | **Partly fixed** | See note C11 below. |
| **C12** What holds up | **Still holds** | See note C12 below. |

**Notes on the table:**

- **C1. Fixed as far as sampled.**
  - The mason eats 3 times: 04:56 bread before leaving, 12:01 the camp's midday bread and 18:08.
  - The harvest woman eats 4 times, including bread in the field.
  - The thresher eats 3 times, the guards 3–4 and the courier 3.
  - The caveat: there is no gang builder, camp grinder or male reaper in the sample, so round 1's four code paths are only partly exercised.
  - Nobody drinks outside meals at 34–39 °C.
- **C2. Fixed in the sample.**
  - All 8 children sleep at night. The small plain followers (32529, 29781) sleep and nap "[with]" the mother, and there are no `play … asleep` lines.
  - 10982, checked after scoring, is carried to the threshing floor and sleeps.
  - The 5–13 "with mother at work" path did not come up.
- **C3. Largely fixed.**
  - Feeds are now separate from meals. 21903 and 5713 give 9 feeds each, 2 of them at night. The motherless infant gets 8, including 01:27 and 04:26. The longest night gap is 4 h 19 min for the nursing mothers and 6 h 11 min (19:16–01:27) for the motherless infant of about 11 months, which is acceptable at that age.
  - What remains:
    - the "twins" label;
    - a mother–child desync (10981 nurses at 03:03 while the child's plan sleeps through);
    - "on the mother's back" and "in the mother's lap" when the minder is a man (N2).
- **C4. Fixed as far as sampled; a successor problem is open.**
  - No sampled household has lost its mother to marriage.
  - The brides who married in (31484 f16, 37767 f14, 18875 f17) joined houses with an unmarried young man.
  - I did not re-run the population-wide count.
  - The successor problem is the loss of a mother by death, which is not handled (N2).
- **C5. Partly fixed.**
  - There are no same-age pairs in the 14 households, and mother links are now set (23451 and 23454 → 23450; 5718 and 45364 → 5713; 10982 → 10981).
  - What remains:
    - the "twins" label;
    - start-of-year ages in the headers;
    - a wife 12 years older than her husband (29777 and 29776).
- **C6. Fixed where checked.**
  - Household 5407 (father, 23451 and the 3-year-old) eats together to the minute: 07:05, 11:58 and 16:23.
  - So do 10981 and her daughter (05:32, 10:39 and 17:50).
  - The exceptions are explained: "the household eats later", "kept for the late-comer".
- **C7. Partly fixed.**
  - Meal lengths now vary: breakfasts 15–30 min, suppers 24–43 min, and midday meals between 10:39 and 12:17.
  - What remains: the guards' minute-identical days, kneading at exactly 24 min, the 33/21/15 field mornings, and the older children's template (N1, N4).
- **C8. Fixed, with one Terrace worker sampled.**
  - The mason works 05:50–15:30, "dawn to mid-afternoon".
  - The midday heat rest is gone for him: he oversees through 33–35 °C. That is acceptable for an overseer, and an open question for the heavy gangs.
- **C9. Partly fixed.**
  - Rain: both wet days are handled indoors.
  - Guards are now relieved to eat, the rover stands in, and the longest stint is 5 h 43 min, not 8 h.
  - What remains: winnowing in a calm, a heat rest at 27 °C while the heat at 34–39 °C gets none, and children out after dark in winter (N6).
- **C10. Largely fixed, with new mismatches.**
  - These are gone: `play` recorded as asleep, grinding or fetching; `rest` as spinning (`spin` is now an activity); "bindingsheaves"; walks to the place the agent already occupies between chunks of one meal.
  - The new ones are listed in N7.
- **C11. Partly fixed.**
  - The detailed agents' household and home now come from the person's home on the day. #110 (h:100) and #131 (h:1365) match their logs.
  - Not fixed:
    - detailed agents are still stepped in the abstract LOD (N5);
    - population plans still carry no `[carrying …]`;
    - nothing in the input shows whether the population people are rendered.
  - New: the headers print start-of-year ages.
- **C12. Still holds.**
  - Sleep fits the sun, and every one of the 20 is asleep at night. Adults go to bed 1 h 21 min to 3 h 18 min after sunset; the B-watch guard goes at 22:38.
  - Commutes are plausible.
  - Names are attested and matched to origin.
  - There is no in-world anachronism.
  - New and good:
    - named neighbours and friends: Udusana, Makka, Dudda;
    - kin care of a toddler;
    - nursing a toddler and a baby together;
    - household meals shared.

## VERDICT

**FAIL.** 3 of 20 people score below 4:

| person | score |
|---|---|
| 39179 (farmer girl, 13) | 2 |
| 839 (girl, 9, town) | 3 |
| 23451 (girl, 11, motherless house) | 3 |

This is a large improvement on round 1 (10 of 20 below 4). All of round 1's blocking causes (C1–C4) are fixed or not seen in this sample.

The three failures share two causes:
- **N1:** older children, especially girls aged 9–13 and a 13-year-old "farmer", get a play template instead of the work their age, sex and household would give them.
- **N2:** a household that loses its mother is not reorganised.

The minimum before a re-review:
1. Fix N1 and N2.
2. Log the harvest-window conflict (N3) in `OPEN_QUESTIONS.md`.
3. Draw a fresh 20-person sample with a different pick seed.

N4–N8 are not blocking. They would move several 4s to 5s.
