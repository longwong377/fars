# Shadow review, Phase 5 (brief §13.11): 20 people, one full day each

- **Reviewer:** independent reviewer subagent (Claude Opus 5.5). I did not see how the simulation was built.
- **Date:** 2026-09-23
- **Gate:** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Inputs read:**
  - `shots/shadow-days.txt`: seed 1, 6 detailed Terrace agents and 14 people of the population.
  - `PERSEPOLIS_BRIEF.md` §9.1, §9.2 and §9.5 ("Follow anyone").
  - `research/EVENTS.md`: E-21, E-41–E-46, E-60, E-64 and CE-14.
  - `research/PEOPLE.md`: rations, and how work groups map onto households.
  - `research/MATERIAL_CULTURE.md`: food and containers.
  - `research/CALENDAR_AND_UNITS.md`.
  - `research/OPEN_QUESTIONS.md`: Q-058, Q-060 and Q-061.
  - `DECISIONS.md`: D-003, D-017 and D-021–D-024.
  - `src/data/lives.json`: work_day, rise/bed, household_bread, evening, children, children_under_five, homemaker, camp_women_needed and postpartum.
  - `src/data/names.json`: the entries for every name that appears.
  - `src/data/events_calendar.json`: the months.
  - Code: `src/people/population.ts` (morning, evening, workBlock, builder, campWoman, child, small, farmer, homemaker, traveller and the sick-day plan), `src/people/calendar.ts` (sunTimes, dayWx), `src/people/activities.ts` and `tools/shadow_days.ts`.
- **How I checked:**
  - **Calendar.** The tool prints `day d+1`. I recomputed the Babylonian date, sunrise and sunset from `sunTimes(d)` for every person. The Gregorian dates below are approximate (Julian − 5 d).
  - **Weather.** I read the hourly weather (`WeatherSystem(1)`) for the two rain days and the hottest harvest day.
  - **Households.** With a read-only scratch script (outside the repo) I queried the seed-1 population for household members, the plans of mothers, minders and spouses, and a few population-wide counts.
  - **Files.** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **The hardest workers get the least food.**
   - 4 of the 6 detailed agents (the grinder and the 3 masons) and 2 of the 14 population people (the labour-gang builder and the reaping girl) eat once or twice a day. The builder goes about 11 h without food while hauling.
   - The masons and the grinder go 12–14 h from waking to their first food on 38–40 °C days.
   - There are four code causes (C1 below).
   - Population-wide: on a hot July day (day 105), 209 of 618 working builders eat once and only 1 eats three times.
2. **Plain children who follow their mother never sleep.** Their activity is `play` all night, for example `00:00–04:52 play @ h:2459 (plain) — with mother: asleep`. On a harvest day, 4,529 of 11,249 children aged 5–13 have no sleep segment at all (C2).
3. **Infants are fed only when the adult woman eats:** three feeds in 24 h, with no feed from 18:27 to midnight or from midnight to 06:24. This is by design (`lives.json` children_under_five, "nursed when she eats") (C3).
4. **Marriage moves mothers out of their households.** 267 of 417 marriages in the year take a homemaker away from a household with a child under five or her own child. A toddler in the sample lives in another household's house because of it (C4).
5. **Placeholders.**
   - 8 of the 14 population people spend part of their day in activities with no performance (`haul`, `reap`, `weave`, `field_work`, `pick_fruit`, `tend_animals`; D-024).
   - None of the 14 population people is rendered (D-024, "not materialised"). For them this review can judge only the plans. It cannot confirm §9.5's "what a person is doing on screen matches what the simulation says".
   - The 6 detailed agents were stepped in the abstract LOD, so their nav routes and on-screen performance were not exercised either.
6. **The input tool mislabels households.** For 4 of the 6 detailed agents the header shows the wrong household and quarter. `tools/shadow_days.ts` indexes `pop.households[a.household]`, and `a.household` is the agent's own index, not the population household. Sirratukka is printed as "household 125 (q_lt_e)" but lives in h:305 in q_north. See the per-person notes.

## Scores

Dates are Babylonian, with the approximate Gregorian date and °C min–max.

| # | id | role | day | score | one-line reason |
|---|---|---|---|---|---|
| 1 | #125 Sirratukka | camp grinder, woman 21, Persian | 144 (Abu 26, ≈2 Sep; 19–38 °C) | **3** | Only one meal: no breakfast, and the midday rest has no food. First food at 17:36, 12 h after waking, after about 4.8 h at the querns grinding the gang's flour. |
| 2 | #112 Athuban | stone mason, man 41, Elamite | 95 (Duzu 6, ≈15 Jul; 19–38 °C) | **3** | One meal: 14 h 07 min from waking to first food, with 9.5 h of relief carving at 38 °C. Works until 18:17, against E-60's "dawn to mid-afternoon". |
| 3 | #104 Muzraaya | stone mason, man 24, Egyptian | 105 (Duzu 16, ≈25 Jul; 21–40 °C) | **3** | The same pattern: one meal, 13 h 46 min without food, 9.4 h fluting at up to 40 °C. |
| 4 | #99 Aksušda | guard, man 41, Median | 168 (Ululu 20, ≈26 Sep; 13–33 °C) | **4** | Coherent B-watch day. Meals come in fragments (5 eat entries for 3 meals), there are walks to the place he is already at, and one 8-h post stint without a break. |
| 5 | #101 (unnamed) | stone mason, man 35, Ionian | 49 (Aiaru 20, ≈30 May; 12–29 °C, rain from 19:00) | **4** | Leaves home 2 min after waking with no breakfast. Carves 11 h 52 min with one 41-min meal. The rain came after he was home, which is consistent. |
| 6 | #14 Badda | guard, man 35, Persian | 75 (Simanu 16, ≈25 Jun; 16–35 °C) | **4** | Coherent A-watch day with 3 meals. Breakfast is eaten in two sittings with a 1-min walk to the same hearth, and he stands at one post for 8 h through the heat. |
| 7 | 44826 | builder (labour gang), male 30, Lycian | 203 (Tashritu 26, ≈31 Oct; 9–28 °C) | **3** | Hauls and carries water for 9 h 52 min with no midday meal and no break: a split-task code bug. |
| 8 | 36030 | farmer, female 13, Persian (plain) | 89 (Simanu 30, ≈9 Jul; 20–38 °C) | **3** | One meal on a wheat-harvest day: reaps 6 h and rests 3 h without food. Her mother in the same field eats three times. |
| 9 | 1910 | child, male 10, Syrian (town), sick | 197 (Tashritu 20, ≈25 Oct; 7–26 °C) | **5** | Lies ill at home with a sister in the house, eats three small meals and has a kin visit. Coherent. |
| 10 | 8864 | child, female 10, Persian (plain) | 21 (Nisanu 21, ≈2 May; 6–21 °C) | **3** | Never sleeps: her activity is `play` from 18:05 to 04:52, with the reason "asleep". "Carrying sheaves" is also recorded as `play`. |
| 11 | 43607 | traveller, male 25, Persian (party of 19) | 265 (Kislimu 29, ≈1 Jan; −4–9 °C) | **4** | 14 h 35 min in bed and rises 72 min after sunrise on a business day. Waits 2 h at the royal store but receives and carries nothing. |
| 12 | 996 | infant, male 0, Elamite (town) | 79 (Simanu 20, ≈29 Jun; 17–37 °C) | **2** | Fed only 3 times, with no feed from 18:27 to midnight or from midnight to 06:24. "On the mother's back while she works" while she is chatting at night. A twin with an identical timeline rides the same back, and she is about 8 months pregnant. |
| 13 | 37 | homemaker, female 31, Persian (town) | 195 (Tashritu 18, ≈23 Oct; 9–28 °C) | **4** | Plausible day. The activity is `rest` while the reason says "spinning". She grinds 2 h 47 min but no bread is baked. "The children" in a house with one child. |
| 14 | 37339 | child, female 8, Persian (plain) | 326 (Addaru 1, ≈3 Mar; 4–19 °C) | **4** | Plausible but very idle: 7 h 35 min of play and 14 min of chores in a 7-person farm household with a baby of 3–4 months. |
| 15 | 7998 | child, female 9, Persian (plain) | 172 (Ululu 24, ≈30 Sep; 11–30 °C) | **3** | Never sleeps (`play` from 17:21 to 05:22). "Grinding the household's flour" for 3 h 51 min and "fetching water" are recorded as `play`. |
| 16 | 42461 | homemaker, female 34, Persian (plain) | 195 (Tashritu 18, ≈23 Oct; 9–28 °C) | **4** | Picks "fruit" at an orchard in the vintage month while her husband ploughs, so she is not "with the household". Grinds 4 h 16 min unbroken. Her 5-month-old son is invisible in her day. |
| 17 | 15026 | child, female 2, Persian (plain) | 55 (Aiaru 26, ≈5 Jun; 18–38 °C) | **5** | With her mother at home and at the well, three meals, a midday nap, and play at a neighbour's. Coherent. |
| 18 | 18230 | farmer, male 36, Persian (plain) | 343 (Addaru 18, ≈20 Mar; 5–21 °C, dust) | **4** | Plausible spring weeding day that tails off: 19 min of work after lunch, then 3 h at home. Breakfast 51 min before sunrise, followed by 49 min idle. |
| 19 | 36113 | homemaker, female 27, Persian (plain) | 93 (Duzu 4, ≈13 Jul; 20–39 °C) | **3** | Carries sheaves 14:33–15:45 at about 37–38 °C, then rests at home through the cooler evening hours. Her husband carries sheaves separately at 16:44. |
| 20 | 29585 | child, male 2, Persian (plain) | 185 (Tashritu 8, ≈13 Oct; 9–25 °C, rain 07:45–11:15) | **2** | Lives all day and night in another household's house (h:6754, not his own 6737). Out in the lane in the rain for an hour, and no midday nap in 13.5 h awake. |

Distribution: 5 → 2 people; 4 → 8; 3 → 8; 2 → 2. **10 of 20 are below 4.**

## Findings for every score ≤ 4

### #125 Sirratukka: camp grinder (score 3)
Her sunrise is 05:42 and sunset 18:17.
- **One meal in 15.5 waking hours.**
  - She has no breakfast: `05:26 rest @ h:305 — at home` is followed by `05:43 walk @ road:terrace — going up to the work camp`.
  - Midday gives her shade and no food: `12:03 walk @ work_hearth — midday rest in the shade (E-64)` and `12:04 rest @ work_hearth` until `15:00 walk @ road:terrace — going home`.
  - Her first food is `17:36 eat @ h:305 — evening meal`.
  - She grinds about 4.8 h (06:18–07:48, 08:16–09:56, 10:24–12:03) for the gang's bread, at the camp hearth, and eats none of it.
  - Code causes: `morning()` offers breakfast only if ≥ 0.3 h remain before leaving (population.ts:555), and `workBlock()` replaces the midday meal with the heat rest (population.ts:628).
- Her 6-year-old son (pid 1061) goes up with her ("near mother at the work camp", 06:03–15:00) and also first eats at 17:35.
- **Household mislabelled.** The header "household 125 (q_lt_e)" is a tool error. She lives in household 305 in q_north, with her son and a 29-year-old porter.
- **Fine:**
  - The 21-min climb to the camp.
  - Water carried on the head (`08:03 carry_jar_head @ work_hearth … [carrying jar_head]`).
  - The camp stopping at mid-afternoon.
  - "grinding for tomorrow's bread" at home.
  - Sleep 20:53–05:26.

### #112 Athuban: stone mason (score 3)
His sunrise is 05:07 and sunset 18:52.
- **One meal. 14 h 07 min from waking to first food.**
  - He has no breakfast: `04:43 rest @ h:100 — at home` is followed by `04:56 walk @ road:terrace — going to the building site`.
  - Midday has no food: `12:00 walk @ work_hearth — midday rest in the shade (E-64)` and `12:01 rest @ work_hearth` until `15:00`.
  - His first food is `18:50 eat @ h:100 — evening meal`, after 9 h 33 min of `dress_stone … carving the doorway reliefs` at up to 38 °C.
- **Hours against the evidence.**
  - `15:01 dress_stone` to `18:17 walk @ road:terrace — going home` puts the gangs to work until sunset − 0.6 h.
  - EVENTS.md E-60 gives the gangs' day as "daily, dawn to mid-afternoon" (PT-WAGE).
  - The `lives.json` work_day note admits the sim keeps the Phase 3 slice's value instead. Meanwhile the camp women who feed the gang stop at 14:30.
- **Household mislabelled.** The header "household 112 (q_pw_s)" is wrong. He lives in h:100 (q_lt_w), a house of ten male builders. That is plausible gang lodging.

### #104 Muzraaya: stone mason (score 3)
His sunrise is 05:12 and sunset 18:47.
- **One meal. 13 h 46 min without food.**
  - He has no breakfast: `04:56 rest @ h:105 — at home` is followed by `05:04 walk @ road:terrace`.
  - Midday has no food: `12:00 walk @ work_hearth — midday rest in the shade (E-64)` and `12:02 rest` until `15:00`.
  - His first food is `18:42 eat @ h:105 — evening meal`, after 9 h 22 min of `dress_stone … cutting the flutes of a raised shaft` on a 40 °C day.
- He also works until 18:12, against E-60.
- **Household mislabelled.** The header "household 104 (q_north)" is wrong. He lives in h:105 (q_lt_e) with a 21-year-old woman and children aged 1, 2 and 6.
- The name Muzraaya ("the Egyptian", EWB tier B) matched to an Egyptian origin is fine.

### #99 Aksušda: guard (score 4)
His sunrise is 06:04.
- **Meals broken into fragments.**
  - Breakfast: `06:38 eat @ garrison_hearth_s — breakfast`, then `07:09 walk @ garrison_hearth_s — breakfast`, then `07:10 eat @ garrison_hearth_s — breakfast`, then `07:11 walk`.
  - After the watch: `22:10 eat — a meal after the watch`, then `22:33 walk`, then `22:34 eat`.
  - That is five eat entries for three meals.
  - Each time he stands up, "walks" to the place he is already at, and eats again for 1–2 min. This is sim.ts re-tasking in chunks, and it would be performed on screen.
- **A fidget loop.** Between 07:11 and 09:34, `walk @ garrison_hearth_s / talk @ garrison_hearth_s — off watch at the hearth` repeats four times.
- **A long post.** `14:04 stand_guard @ post_tachara_2 — on watch` runs to `22:00 … waiting to be relieved`: 8 h at one post with no drink, relief or change of post. The watch organisation is an open question (Q-060, C). Three-hour watches, the usual ancient practice, would be more plausible.
- **Fine:** the rota (D-023), 3 meals, knucklebones, the errand to the forecourt, and 8 h of sleep.

### #101 (unnamed): Ionian stone mason (score 4)
- **No breakfast.** He leaves two minutes after rising: `04:52 rest @ h:102 — at home`, then `04:54 walk @ road:terrace — going to the building site`.
- **11 h 52 min of carving with one 41-min meal:** `05:41 dress_stone … carving a double-bull capital` to `12:00`, then `12:43` to `18:16`. This is far beyond E-60's "dawn to mid-afternoon".
- **The rain is handled correctly.** The rain (0.3 mm/h) fell 19:00–22:45, after `18:50 eat @ h:102`. He is home, so no shelter was needed.
- **Household mislabelled.** The header "household 101 (q_lt_e)" is wrong. He lives in h:102 (q_lt_w) with a 27-year-old woman.

### #14 Badda: guard (score 4)
- **Breakfast in two sittings:** `05:02 eat @ garrison_hearth_m — breakfast before the watch`, then `05:19 walk @ garrison_hearth_m — breakfast before the watch`, then `05:20 eat`.
- **8 h at one post through the heat:** `06:05 stand_guard @ post_tachara_2 — on watch` to `14:00`, with a 35 °C maximum, no drink and no break.
- **Fine:**
  - The hearth idling and 2 h of knucklebones (§9.1: "eat, sleep, gamble and idle").
  - 3 meals.
  - Bed at 20:29, 1.5 h after sunset.

### 44826: builder of the labour gang (score 3)
- **9 h 52 min of heavy labour without food or a break:** `06:56–12:41 haul @ hall100_site (terrace) — building up the earth ramp` runs straight into `12:41–16:48 carry_jar @ h100_wall_E (terrace) — carrying water for the mortar`.
- **The cause is a split-task code bug.**
  - `builder()` ends the morning block at 12.7 h whenever the afternoon task differs.
  - `workBlock()` adds the midday meal only if `t1 > 12.8`, and the afternoon block starts after 12:00, so neither half gets it.
  - The same pattern is in `terraceWorker()` (population.ts:918) and the brick squad.
- Two meals in all: `05:49–06:07 eat … breakfast` and `17:11–17:41 eat … evening meal`.
- `haul` is a placeholder with no performance (D-024).
- **Fine:** the 23-min commute, the household of three builders (a gang lodging), and bed at 18:55.

### 36030: farmer girl, 13 (score 3)
- **One meal on a harvest day, 13 h 31 min after waking.**
  - `04:39–04:52 play @ h:8057 (plain) — at home` has no breakfast.
  - Then `04:57–11:00 reap @ field:8057:1 (plain) — the wheat harvest (E-42)`.
  - Then `11:00–14:07 rest @ field:8057:1 (plain) — resting in the shade by the field through the heat`, still with no food.
  - Her first food is `18:10–18:40 eat @ h:8057 (plain) — evening meal`.
  - Her mother (36027, 45) reaps the same field and eats at 04:49, 11:04 and 17:54, so the household's two reapers are fed differently. Their suppers are also 16 min apart.
- **Minor:**
  - `14:12–16:03 weave @ h:8057 (plain) — spinning`: the activity is weave, the reason spinning.
  - `16:03–16:42 rest @ h:8057 (plain) — resting through the heat` comes two hours after she left the shade.
  - The activity is `play` for a 13-year-old "farmer".
- Placeholders: `reap`, `weave`.

### 8864: plain girl, 10 (score 3)
- **She never sleeps.**
  - `00:00–04:52 play @ h:2459 (plain) — with mother: asleep` and `18:05–24:00 play @ h:2459 (plain) — with mother: with the household`.
  - Cause: `child()` → `follow()` (population.ts:880, 888) applies the "at work" map to every segment whose `where` is `plain`, sleep included, and that map has no sleep case.
- **The activity does not match the reason:** `14:33–15:45 play @ threshing:v_rakkan (plain) — with mother: carrying sheaves to the threshing floor`.
- **Typo:** `05:18–11:00 field_work @ field:2459:2 (plain) — with mother: bindingsheaves at the harvest` ("bindingsheaves", also in 36113).
- **Minor:** binding sheaves on about 2 May at 1,600 m is early, but inside E-41's months 1–3.
- Placeholder: `field_work`.

### 43607: traveller (score 4)
- **14 h 35 min in bed:** `17:33–24:00 sleep @ station (town)` and `00:00–08:08 sleep`. He rises 72 min after sunrise on a day of business; `traveller()` sleeps until sunrise + 1.2 h on the second day of a stay.
- **Goods do not flow.** `09:07–10:58 talk @ royal_store (town) — waiting at the stores with the party's leader` ends with nothing received or carried. E-21 travellers draw rations at the station or storehouse.
- **Fine:** watering the animals once at the river on a cold January day, and three meals.
- Placeholder: `tend_animals`.

### 996: infant, age 0 (score 2)
- **Three feeds in 24 h, only when the adult woman eats:** `06:24–06:42 eat @ h:286 (town) — nursed by the mother`, `12:00–12:35`, `17:57–18:27`.
  - Nothing from 18:27 to midnight, nor from midnight to 06:24: about 12 h without a feed.
  - Nothing from 06:42 to 12:00 either.
  - A young infant feeds 8–12 times a day, including at night.
  - This is the design (`lives.json` children_under_five: "nursed when she eats"; Q-061).
- **"Works" that are not work.** `18:27–21:22 rest @ h:286 (town) — on the mother's back while she works` matches her plan's `18:27–21:22 talk @ h:286 — with the household` after dark. `07:01–08:45 rest @ h:879 — on the mother's back while she works` matches her `talk @ h:879 — visiting a neighbour`.
- **The household is demographically implausible.**
  - Household 286 is a 39-year-old builder, a 28-year-old woman (995) and two infants aged 0 (996 and 997, with no mother link) whose plans are identical to the minute. Both are "on the mother's back" at once.
  - The same woman gives birth on day 123 (45071), so on this day she is about 8 months pregnant while nursing twins.

### 37: homemaker, town (score 4)
- **The activity is not the reason:** `12:35–16:31 rest @ h:12 (town) — spinning, and minding the children`. population.ts:1275 draws `rest` 60 % of the time with the spinning reason. Household 12 has one child (aged 7), not "children".
- **Grinding with no baking.** She grinds 2 h 47 min (`06:10–07:19 grind … at the quern` and `10:22–12:00 grind … household work at the quern`), but no bread is baked. The every-other-day bake needs 1.2 h left before breakfast (`morning()`), and it is skipped whenever grinding runs long.
- **Fine:** water, breakfast, the visit to Hubakka (an attested name, EWB B), three meals, and supper an hour before sunset. Her husband is a guard.

### 37339: plain girl, 8 (score 4)
- **A very idle day.**
  - `07:11–12:00 play @ h:8852 (plain) — playing at Dakamanuš's house` and `14:08–16:54 play @ lane:v_35 (plain) — playing in the lane` add up to 7 h 35 min of play, against 14 min of water fetching.
  - Her household has 7 members, including a baby of 3–4 months (46387, born on day 218), and it is early spring in a farm household.
  - Plausible for an 8-year-old, but the balance is off (Q-058).
- `07:04–07:08 carry_jar_head … carrying water home` is followed directly by `07:08–07:11 walk … to a friend's house`, with no moment at home to set the jar down.

### 7998: plain girl, 9 (score 3)
- **She never sleeps:** `00:00–05:22 play @ h:2275 (plain) — with mother: asleep` and `17:21–24:00 play @ h:2275 (plain) — with mother: with the household`. This is the same bug as 8864.
- **The activity does not match the reason:**
  - `11:39–15:30 play @ h:2275 (plain) — with mother: grinding the household's flour` (3 h 51 min).
  - `15:33–15:54 play @ well:v_tukrash (plain) — with mother: fetching water`: at the well she plays and carries nothing home.
- **Minor:** household 2275 is a vintage household by the code's own rule (`id % 5 < 2`), but the women go to `orchard:v_tukrash` to pick "fruit".
- Placeholder: `field_work`.

### 42461: homemaker, plain (score 4)
- **Not "with the household".** `06:15–11:00 pick_fruit @ orchard:v_35 (plain) — picking fruit with the household` falls in month 7, when only the vintage (E-45) is in season; fruit (E-46) is months 4–6. Her husband (42460) spends the same hours `plough @ field:9386:1 — ploughing and sowing barley and wheat (E-40)`.
- **A long unbroken stint:** `11:39–15:55 grind @ h:9386 (plain) — grinding the household's flour`, 4 h 16 min for 8 people. Heavy, but possible.
- **Her baby is invisible.**
  - She has a son of 5 months (46566, born day 49), and nothing in her day accounts for him.
  - His own plan feeds him three times (05:36, 11:03, 16:31).
  - He is "on the mother's back" through the whole orchard morning and the 4 h 16 min at the quern.
- **Supper apart:** she eats at 16:31, her husband at 16:19.
- Placeholder: `pick_fruit`.

### 18230: farmer (score 4)
- **The afternoon tails off.** `12:00–12:41 eat @ field:4397:3 — midday meal` is followed by `12:41–13:00 field_work` (19 min), then home. From 13:08 to 16:15 he is at home (`talk`, `rest`) during the spring weeding season at 21 °C.
- **An early, idle start.** `05:11–05:29 eat … breakfast` is 51 min before sunrise, followed by `05:29–06:18 rest … at home`.
- **Fine:** the animals, the visit to Barsauka after dark, and bed at 19:18.
- Placeholders: `field_work`, `tend_animals`.

### 36113: homemaker, plain (score 3)
- **Harvest labour at the hottest hour.**
  - `14:33–15:45 carry_sack @ threshing:v_35 (plain) — carrying sheaves to the threshing floor` happens at about 37–38 °C (hourly: 38.3 °C at 14:00, 36.2 °C at 16:00).
  - Before it, only `11:41–12:35 rest @ h:8075 (plain) — resting through the heat` (54 min) and `12:35–14:30 weave … spinning`.
  - After it, `15:48–17:53 rest @ h:8075 (plain) — home` through the cooler hours.
  - Her husband (36112) waits until `16:44–17:56 carry_sack @ threshing:v_35 — carrying sheaves to the threshing floor (E-43)`, so the couple carry sheaves separately.
  - Cause: the homemaker harvest branch ends the heat rest at 14.5 h (population.ts:1261), while the farmer branch waits until sunset − 2.2 h. This breaks the sim's own E-64/CE-14 rule for outdoor work.
- **Minor:** "bindingsheaves", and `weave … spinning`.
- Placeholders: `reap`, `weave`.
- **Fine:** three meals, and her two 3-year-olds come to the field with her (checked on 36114's plan).

### 29585: toddler, 2 (score 2)
- **He lives in someone else's house.**
  - The header says "household 6737", but every line is at h:6754, starting with `00:00–05:29 sleep @ h:6754 (plain) — asleep`.
  - The woman he follows (29583, 27) married into household 6754 on day 103, 23 days before giving birth.
  - `small()` picks "a woman of the household" from the static member list, so he goes with her.
  - His recorded household keeps a 22-year-old man and his sick 3-year-old sibling. That sibling (29584) lies ill all day at h:6737 without her.
- **Out in the rain for an hour.**
  - `07:51–08:49 play @ lane:v_26 (plain) — with the mother`: she is "exchanging goods in kind" in the lane.
  - The rain is 0.30 mm/h from 07:45 to 11:15, above the sim's own shelter threshold of 0.25.
  - `homemaker()`'s exchange branch has no wet check (population.ts:1270). `small()` suppresses a toddler's own outings in the wet, but not his following of the mother.
- **No midday sleep.** `12:35–14:55 play @ h:6754 (plain) — with the mother`: he is awake 05:29–18:57 (13.5 h) at age 2. The nap exists only in the at-home branch, and h:6754 is not his home.

## Cross-cutting findings

**C1. Meals are inverted: the heavier the labour, the fewer the meals.**
- **In the sample:**
  - One meal a day: #125, #112, #104 and 36030.
  - Two meals: #101 and 44826. 44826 goes about 11 h without food.
  - Three meals: guards, homemakers, children and the traveller.
  - All 4 detailed Terrace workers skip breakfast.
- **Four causes in `population.ts`:**
  1. `morning()` gives breakfast only if ≥ 0.3 h remain before the commute. Workers who leave 2–17 min after rising skip it.
  2. `workBlock()` swaps the midday meal for the E-64 heat rest (l. 628), where it should add the rest around the meal.
  3. Split morning/afternoon tasks end the morning at 12.7 h, so neither block gets the meal (builder, terraceWorker, brick squad).
  4. The farmer harvest branch has no meal between the 5–11 work block and supper.
- **Measured over the population:**

  | day | job | working people | eat once | eat twice | eat three times |
  |---|---|---|---|---|---|
  | 105 (hot) | builders | 618 | 209 | 408 | 1 |
  | 105 (hot) | farmers | 2,853 | 843 | not tallied | not tallied |
  | 93 | farmers | 2,846 | 622 | not tallied | not tallied |
  | 203 (autumn) | builders | 620 | 146 | not tallied | not tallied |

- The camp bakes the gang's bread ("bringing the gang its bread at midday" is a camp task), yet no builder in the sample eats at midday on a hot day.
- **Nobody drinks.** No one is seen drinking, even at 38–40 °C, although the camp carries water. Minor.

**C2. Plain children never sleep when they follow their mother.**
- `follow()` maps sleep to `play` for every `plain` segment.
- Children aged 5–13 with no sleep segment at all:

  | day | children aged 5–13 | no sleep segment | share |
  |---|---|---|---|
  | 21 | 11,249 | 4,529 | 40 % |
  | 93 | 11,231 | 4,487 | 40 % |
  | 172 | 11,213 | 3,618 | 32 % |
  | 195 | 11,206 | 2,766 | 25 % |
  | 301 | 11,166 | 1,610 | 14 % |

- The same map turns the mother's grinding, carrying and water into `play` for the child.
- The soak's "plans well formed" gate did not catch this.

**C3. Infants are fed at the minder's meals only (about 3 feeds a day, with gaps of about 12 h).**
- "On the mother's back while she works" is emitted whenever she is not eating, sleeping or resting, including evening talk and visits.
- Twins get identical timelines on one back.
- This affects every infant of the year (about 3,100). The soak reports infants but does not gate them (D-021). This review shows the design itself is implausible.

**C4. Marriage takes mothers away.**
- population.ts:298 lets any woman aged 15–30 in the town or plain marry into another household. It does not check for a husband, children or pregnancy.
- 267 of 417 marriages take a homemaker away from a household with a child under five or her own child.
- Two of the 14 sampled population households are hit: 6737 (29583, married on day 103 and gives birth on day 126) and 3731 (15025, the only adult woman of the house and 15026's minder, marries out on day 121).
- Small children then follow her to the new house (29585) or stay behind without a minder.

**C5. Household demography.**
- Pre-existing children have no mother link (`mother: -1` in every sampled household).
- Ages are drawn with no birth spacing: 1,315 of the 6,439 town and plain households with two or more children (20.4 %) contain a same-age pair.
- In the sample, same-age pairs appear in households 286, 8075, 2459, 2275 and 8326. Real twin maternities are about 1–2 %.

**C6. Households don't eat together.**
- Suppers in the same house start 6–16 min apart: 8057 at 17:54 and 18:10; 8075 at 17:53 and 17:59; 9386 at 16:19 and 16:31.
- At the harvest, the "farmer" members of a household skip the meals the homemaker eats (36030 against her mother).
- §9.5 asks "who they meet, what they eat". Here the household meal is not a shared event.

**C7. Clockwork synchrony across people.**
- **Fixed meal lengths and times:**
  - Every plan-tier breakfast lasts exactly 18 min (0.3 h), 10 of 10 including the toddlers' first meal; the traveller's is 30 min.
  - Every supper lasts exactly 30 min (13 of 13).
  - Midday meals start at 12:00, or at 11:03–11:06 after harvest work.
- **Fixed end of field work.** Field and fruit work ends at exactly 11:00 in all 5 plain harvest and fruit days.
- **Identical sequences across households and days:**
  - 42461 (day 195) and 7998's mother (day 172) share `06:12–06:15 walk / 06:15–11:00 … / 11:00–11:03 walk / 11:03–11:39 eat` to the minute.
  - 8864's mother (day 21) and 36113 (day 93) share `14:30–14:33 walk / 14:33–15:45 @ threshing / 15:45–15:48 walk`.
- The soak's variety gate is per person across days, in half-hour buckets, so it cannot see synchrony between people.

**C8. Work hours conflict with the evidence row.**
- The gangs work sunrise + 0.4 h to sunset − 0.6 h, about 13 h in July.
- EVENTS.md E-60 (PT-WAGE, C/B) says "dawn to mid-afternoon".
- The camp that feeds the gangs follows the research (it stops at 14:30); the gangs do not.
- The conflict is noted in `lives.json` work_day, but not resolved or logged as an open question (rule 3).

**C9. Weather.**
- **Heat** is handled for Terrace outdoor work and for reaping men. It is not handled for homemakers at the harvest (sheaves at 14:30, 38 °C), and it costs the Terrace workers their meal.
- **Rain:** of the two wet days sampled, one fails. The exchange in the lane has no wet check, so a woman and her toddler stand out in the rain.
- **Guards** stand 8 h at a post through 35 °C heat with no relief.

**C10. Activities that do not match their reasons.** These would be visible in the dev overlay and the chronicle:
- `rest` recorded as "spinning" (37).
- `weave` recorded as "spinning" (36030, 36113).
- `play` recorded as "asleep", "grinding", "carrying sheaves" or "fetching water" (8864, 7998).
- "On the mother's back while she works" during talk and visits (996).
- The typo "bindingsheaves" (8864, 36113).
- Detailed agents "walk" to the place they already occupy between two chunks of the same meal or talk (#99, #14).

**C11. Tool and coverage.**
- `tools/shadow_days.ts` prints the wrong household and quarter for detailed agents: it uses `pop.households[a.household]` where it should use `pop.home(a.pid, d)`.
- Detailed agents are stepped in the abstract LOD, not the full nav tier.
- Population people carry no `[carrying …]` annotation.
- None of the 14 population people is rendered.
- So the §9.5 requirement that the shadow review confirm "what a person is doing on screen matches what the simulation says" is unmet for 14 of the 20 people, and only partly met for the other 6.

**C12. What holds up.** I checked these against the data:
- **Waking and sleeping.** Civilian waking and sleeping fit the sun: rising 0.2–0.9 h before sunrise and sleeping 1.2–2.8 h after sunset. Winter nights are long and summer nights short.
- **Commutes** are plausible: 21–34 min from the town to the Terrace including the climb, and 3–8 min from a village to its field or well.
- **The garrison rota** matches D-023.
- **The sick child's day** is well handled, with a sibling in the house and a kin visit.
- **The seasons of work** are right in outline: barley and wheat harvest in months 1–4, ploughing in Tashritu, weeding in Addaru, the vintage in months 5–7.
- **Names** are all attested (EWB, tier B) and matched to origin.
- **No anachronism** was found in any timeline.

## VERDICT

**FAIL.** 10 of 20 people score below 4:

| person | score |
|---|---|
| #125 Sirratukka | 3 |
| #112 Athuban | 3 |
| #104 Muzraaya | 3 |
| 44826 | 3 |
| 36030 | 3 |
| 8864 | 3 |
| 7998 | 3 |
| 36113 | 3 |
| 996 | 2 |
| 29585 | 2 |

The causes are systemic code and design faults (C1–C4), not chance draws. Fixing them and re-running a fresh 20-person sample (a different pick seed) is the minimum for a re-review.
