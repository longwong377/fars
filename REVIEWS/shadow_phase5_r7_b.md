**VERDICT: FAIL.** 1 of 20 people scores below 4. **42388 Irtam** (farmer, 19, Tashritu 8) scores **3**. From 07:39 to 09:04 he is "plastering the roof with mud and straw before the rains", while the day's storm (07:15–11:45) and rain (07:45–11:15) are running. The other 19 people score 4 (16 people) or 5 (3 people). After scoring I read the code. The sample reports the simulation faithfully: I regenerated it and it is byte-identical. A farming man's seasonal chores at home carry no weather check (S1). In seed 1 that puts about 7,900 roof-plastering spells inside rain or storm hours over the year. **No score changed after scoring.**

# Shadow review, Phase 5, round 7, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent, reviewer B (Claude Opus 5.5). I did not build the simulation or see it built. I did not read reviewer A's round-7 review or `DECISIONS.md`.
- **Date:** 2026-09-24. **Tree:** `/home/user/fars`, branch `claude/amazing-fermi-40ds7j`, HEAD `02b0ca9`.
- **Gate (§13.11):** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick131.txt` (seed 1, pick seed 131; md5 `305735355b30f8c3efb50fabedefa212`). No earlier reviewer had seen it. After scoring I ran `npx tsx tools/shadow_days.ts 1 131` into the scratchpad. The output is **byte-identical** to the sample.
- **Read before scoring:**
  - the sample, in full;
  - `research/CALENDAR_AND_UNITS.md`, `EVENTS.md`, `PEOPLE.md`, `PLAIN.md` and `SETTLEMENT.md`, each in full;
  - `PERSEPOLIS_BRIEF.md` §5.5, §9 (9.1–9.5) and §13.

  I built the day → month table from the month lengths. With Nisanu 1 = 17 Apr 467, the months begin on regnal days 1, 30, 60, 90, 119, 149, 178, 208, 237, 267, 296 and 326. All 19 distinct dates in the sample agree with it: regnal day, Babylonian date and Julian date.
- **Scores fixed first,** in `/tmp/claude-0/-home-user-fars/af128484-d8a3-5666-b8c9-fc1ce7f0e77a/scratchpad/shadow_r7_B_scores.md`, before any code, data or earlier review was opened.
- **Read after scoring:**
  - the verdicts and finding lists of `REVIEWS/shadow_phase5_r6.md` and `_r6_b.md`;
  - `tools/shadow_days.ts`;
  - `src/people/population.ts`: `farmChore`, `homeHours`, `homeDay`, `rainHome`, `dayWork`, `terraceWorker`, `dustVeil`, `coldWear`, `herderPassing`, `bed`, and the infant-sleep block of `small`;
  - `src/people/calendar.ts` (the seasonal-event gate) and `src/people/sim.ts` (places);
  - `src/data/lives.json`: `home_hours`, `children`, `herders`, `infant_care`;
  - `src/data/events_calendar.json`: E-40, E-43, E-46, E-49;
  - `src/data/people_places.json`.

  I also ran five read-only scratch scripts in the scratchpad: place distances, roof plastering in the rain, field segments in the rain, one farmer's day on day 354, and the plans of the sampled households.
- **Score changes after scoring: none.** Every point I checked in the code is what the sample shows. Where the code explained a doubt (28957's lost dry morning is the calendar's whole-day wet rule), the sample was not misrepresenting the simulation, so no score moves.

## Read first: what is broken or placeholder
1. **Blocking: a farming man's household chores ignore the weather (S1).** Roof plastering, plough mending and similar chores come from `farmChore` (population.ts l. 906). `homeHours` weights a chore only by heat and darkness, never by rain or storm. So 42388 plasters his roof through a storm, while his father's plan for the same hours reads "at home: storm". Across the year in seed 1, about 7,900 roof-plastering spells (about 9,400 h) fall inside rain or storm hours (measured; below).
2. **Weather dress is applied to whole segments or skipped:**
   - The dust wrap covers the whole of any segment that touches the dust hours. #8 is wrapped 1 h 42 min before the dust rises, but is not wrapped on his walk across the Terrace in the dust (S2).
   - The cold dress is never added to a sleep segment, so a toddler asleep in the lane at about 0 °C is not dressed for the cold (S3).
   - The renderer does not draw the dust wrap yet (`dustVeil` says so: C, placeholder).
3. **Light:** a herder counts his flock at 05:08, 1 h 02 min before sunrise with no moon (S6). A foreman plays knucklebones in the lane for 1 h 07 min after sunset (S8).
4. **Children:**
   - Children under five go to bed 0–30 min after sunset, which gives 14 h nights; the 15-month-old sleeps 16.5 h in 24 (S4).
   - A girl on her fifth birthday plays alone by a flowing canal; her sister of 8 is elsewhere in the plan (S5).
   - A 6-year-old walks about 8 h 20 min on a migration day (S11).
5. **Generic or mismatched labels** (S7–S9): a courier "mending tools and baskets"; "the evening meal, kept for the late-comer" for a man who was 3 min away in the lane; a traveller walking "on the day's business" to go "seeing the lower town"; a 40-min "sleeping through the heat of the day".
6. **Evidence tiers:** every routine rule behind these days is C (lives.json RECON). The fig season (E-46), the migration (E-49), the heat rest (E-64), the ration day (E-01, days 1–5) and the threshing vigil are all C. The shadow review can test only internal consistency and general plausibility, not attestation.

## Scores (fixed before any code was read; unchanged)
| # | person | day | score |
|---|---|---|---|
| 1 | #30 Tamšakama, guard, leader of ten, m23 | Shabatu 30 | 4 |
| 2 | #8 Karašna, guard, m30 | Simanu 7 | 4 |
| 3 | #66 Appirmarša, guard, m36 | Kislimu 3 | 4 |
| 4 | #114 Akšer, porter, m21 | Ululu 3 | 4 |
| 5 | #131 Kamša, courier, m23 | Simanu 26 | 4 |
| 6 | #100 Kamiya, foreman, m35 | Arahsamnu 10 | 4 |
| 7 | 2668 Tappukka, Treasury storekeeper, f35 | Abu 24 | 4 |
| 8 | 44977 (unnamed), builder, m33, Lycian | Shabatu 21 | 4 |
| 9 | 5936 Akšer, estate gardener, m33 | Ululu 8 | 5 |
| 10 | 3003 Ratukka, girl 4 | Tebetu 9 | 4 |
| 11 | 2036 Kunsun, Treasury handler, f46 | Duzu 5 | 4 |
| 12 | **42388 Irtam, farmer, m19 (rain/storm day)** | Tashritu 8 | **3** |
| 13 | 17959 Suzza, girl 5 (birthday) | Shabatu 22 | 4 |
| 14 | 46220 Badura, baby 0 months | Addaru 3 | 5 |
| 15 | 44293 Abbatema, herder, m20 | Tashritu 4 | 4 |
| 16 | 43314 Kartukka, traveller, m40 | Simanu 11 | 4 |
| 17 | 12597 Birtanda, farmer (threshing vigil), m28 | Duzu 14 | 5 |
| 18 | 39196 Barrumatra, boy 15 months | Kislimu 18 | 4 |
| 19 | 44627 Kambatiš, herder boy 6 | Addaru 3 | 4 |
| 20 | 28957 Barnizza, farmer, m16 (rain from 15:00) | Kislimu 6 | 4 |

### Notes
1. **#30 Tamšakama (4).**
   - **What works:** a coherent night-watch day. He has a full night's sleep and a morning in the town, drills his file, sleeps twice in the afternoon and evening, sees the watch change at 22:00, and makes two rounds (7 posts, then 3). The round legs are 3–8 min for 200–260 m, which is plausible (distances measured in `PLACES`). Down and up to the town he takes a consistent 28 min + 11 min, and the cold dress comes on and off with the hour.
   - **What is weak:** he walks down to q_lt_e at 07:09, back up to sit 40 min at the hearth, then down again to the same quarter for drill at 10:13. That is about 110 min on the stair and road for 40 min at the hearth, and it reads as mechanical (S7). "The practice ground below the Terrace" is placed at `training:q_lt_e`, the lower-town quarter. The "short sleep" before the watch is 3 h 47 min.
2. **#8 Karašna (4).**
   - **What works:** he stands the morning watch from 06:04 to 14:01, and a patrolman stands in while he eats bread at 08:33.
   - **Label mismatches (S2):**
     - "the face wrapped against the dust" from 09:03, although the dust starts at 10:45;
     - the 14:13 walk across the Terrace in the dust is unwrapped;
     - "sleeping through the heat of the day" lasts 40 min, after which he sits at the hearth through the hottest hour.
   - **Also weak:**
     - 4.9 h unrelieved at the post at up to 38 °C;
     - his 4-year-old is ill and the family is 27 min away, yet he spends 7 h idle at the garrison (the garrison rule, C).
3. **#66 Appirmarša (4).** A day off with his family in the town, 08:47–16:42. He walks 27 min each way, eats with them, and goes back up. It is humane and plausible. Small faults: the cold dress is on for the 08:20 walk but not for the 16:42–17:09 walk back at dusk in December, and he is in bed at 18:55.
4. **#114 Akšer (4).** A ration day at the Terrace depot (day 3, inside the C rule of days 1–5):
   - 3 h 54 min of queueing, 06:11–10:05;
   - nine 12-min sack round trips between the stair foot and the Treasury store (317 m in a straight line);
   - bread at 11:41, then home at the E-64 heat stop (Tmax 36 °C).

   The queue takes the whole cool morning and leaves 2 h of work. That is plausible for a gang's issue. The ration goes home from the Treasury store by way of the stair foot, so there is no teleport.
5. **#131 Kamša (4).** "Not his day at the station": a day of house and lane, with an exchange in kind, lane talk, mending, meals and long rests through 40 °C heat. It is plausible for a relay rider off duty. The weak points: "mending tools and baskets" is a farmer's filler for a courier (S9), and three "at home: not his day at the station" rest blocks read as filler.
6. **#100 Kamiya (4).** On site 07:11–15:31 (E-60), then home, a meal and knucklebones.
   - **Not a teleport:** "12:00 inspect @ h100_c40 → 12:01 eat @ work_hearth" is 68 m (measured), which fits within the minute.
   - **Mechanical:** about 20 identical "overseeing the squad" rows swing between column 40 and the capital yard every 10–40 min.
   - **Light:** knucklebones in the lane 17:12–18:26, with sunset at 17:19 (S8).
7. **2668 Tappukka (4).** A full, physical, consistent day:
   - grinding before dawn;
   - stacking at the Treasury store, with a spell going over the seals;
   - off at 11:39 (E-64), then 3 h 19 min of sleep through the heat;
   - water, kneading, baking, cooking, the meal, sleep.

   Small faults: she grinds twice (04:06 and 12:25), and a storekeeper spends 4 h 54 min stacking.
8. **44977 (4).** He does no site work on a dry winter day. That is plausible: in this household's plans the gang "works in halves in winter" (E-62). But his own day never says so. He does the chores of an all-male house (water twice, 88 min washing clothes at about 5 °C), plays knucklebones, talks and rests. "The evening meal, kept for the late-comer" is odd for a man 3 min away in the lane (S9).
9. **5936 Akšer (5).** He picks figs 06:06–12:00 (E-46, months 4–6; Ululu is month 6), eats in the shade and goes home out of the heat. Then he sleeps, talks in the lane, eats the evening meal in a 27-person estate household, visits a neighbour after dark and is asleep at 21:00. Nothing is wrong.
10. **3003 Ratukka (4).** She is with her mother throughout, apart from a 3-min walk to a neighbour's house to play with their children, which is plausible at 4. There are 3-min fragments at home between outings. She is asleep at 17:39, 29 min after sunset, until 07:35, plus a 72-min nap (S4).
11. **2036 Kunsun (4).** Grinding, water at twilight, 3 h 42 min in the monthly ration queue at the town store (day 5), the workshop until 15:00, then grinding, spinning (indoors and outside with the women), cooking and sleep. Her husband is ill and she does everything, which is plausible. The weak points:
    - she has no midday rest at 37 °C (the workshop may be roofed);
    - the ration received at 10:39 leaves the workshop only at 15:00.
12. **42388 Irtam (3), blocking.**
    - The contradiction: 07:39–09:04 "plastering the roof with mud and straw before the rains" runs inside the storm (07:15–11:45) and the rain (07:45–11:15). That breaks §9.2 ("stop work in storms") and W-02/CE-11 (a storm stops all outdoor work). The rain has already come, so "before the rains" contradicts the day itself.
    - The household: his father's plan for these hours is "at home: storm", and the 4-year-old's is "playing indoors out of the rain" (S1).
    - The rest of the day is fine: mending indoors, meals, and the roof again at 15:38, after the rain.
13. **17959 Suzza (4).** Lane, canal, lane and home in turns, with meals and an early bed. No companion is recorded anywhere. On her fifth birthday she plays 43 min by a flowing canal in February. Her sister of 8 is in the lane then and goes to the canal only at 10:42, after Suzza has left (plan checked, S5). There are 6-min courtyard fragments.
14. **46220 Badura (5).** Ten feeds, 1.5–3 h apart by day and 3.1 h and 4.6 h apart at night. He is always with his mother and sleeps about 16 h. The labels follow the mother's activity (her lap at meals, a mat while she works). Good.
15. **44293 Abbatema (4).** He lets the flock out and counts it at 05:08. That is 1 h 02 min before sunrise, before nautical twilight, on day 4 of the month (no moon), so he counts in the dark (S6). The rest is fine: watering, herding the flock out of the plain (E-49, autumn), a midday meal, and off the map at 12:17.
16. **43314 Kartukka (4).** The waiting day of a 16-man party: 1.5 h in the lower town, mending harness, meals, sleep through the heat, and knucklebones by the fire. It is plausible if idle. The walk is labelled "on the day's business", but the next segment is "seeing the lower town" (S9).
17. **12597 Birtanda (5).** He threshes 05:32–10:30 (E-43; 4 m/s wind), with bread carried out. He is home out of the heat and sleeps 4 h 25 min ahead of the night. He mends, eats the evening meal, and goes out at 18:49, before sunset. He sits up by the heap, then sleeps beside it, which is the real practice. Good.
18. **39196 Barrumatra (4).** He is with his mother throughout, with plausible meals and nursings. The weak points:
    - the 09:02–09:22 sleep in the lane at about 0 °C has no cold dress (S3);
    - he is asleep from 17:07 (2 min after sunset) to 07:15, plus 2 h 24 min of naps, which is 16.5 h (S4);
    - there are 3–5 min fragments.
19. **44627 Kambatiš (4).** The band's arrival: sleep in the hills, 2 h off-map, then on foot 07:46–14:32 beside the donkeys with a 21-min halt. Then play by the new tents, the evening meal, and bed. It is plausible (E-49, months 12–1). But for a 6-year-old it is about 8 h 20 min of walking with no ride noted (S11).
20. **28957 Barnizza (4).** An exchange in the lane, 3 h 17 min mending the plough and yoke, rests, meals and an early bed.
    - **Concern at scoring:** the morning was dry inside the E-40 sowing window, yet he did no field work.
    - **The code:** `calendar.ts` l. 279 cancels E-40 for the whole of any day marked wet, and this day is marked wet by rain from 15:00. So "for the ploughing" is correct: the ploughing is still ahead.
    - **Result:** the sample is faithful and the score stays at 4. The rule itself is noted in S10.

## Findings
**S1. Blocking (42388): a farming man's seasonal chores at home carry no weather check.**
- **The code:** `lives.json home_hours.farm_chores` lists "plastering the roof with mud and straw before the rains" for months 6–7, and plough mending for months 6–9. `Population.farmChore` (population.ts l. 906) chooses a chore by month only. `homeHours` gives it the weight `chore && !hot && !dark ? H.farm_chore : 0`. Neither checks `C.wx.wet`, `C.wx.storm` or the rain hours, although the lane, water, fuel and wash choices in the same function do. On a storm day the farmer's plan falls back to `homeDay('storm')` → `homeHours`, and the roof chore is drawn there.
- **Measured** (scratch script `roof.ts`, seed 1): one farming man in five, on the 28 days with rain or storm hours, has 1,587 roof-plastering spells overlapping those hours by more than 6 min, a total of 1,883 h, on days 185 and 201. For all farming men that is about 7,900 spells and 9,400 h.
- **The household:** in the same plan, 42388's father is "at home: storm" for these hours.
- **What would fix it:** gate the chores that are done in the open (the roof; also any outdoor tend_animals) on `!wet && !storm` and on the day's rain hours, as the lane and water choices already are.

**S2. Minor (#8): the dust wrap covers whole segments.** `dustVeil` (population.ts l. 1397–1402) marks every open segment that overlaps `dustH` by more than 3 min, for its whole length. So #8's post segment is wrapped from 09:03, although the dust starts at 10:45. His walk across the Terrace at 14:13 is not a plan segment, so it is unwrapped in the dust. `coldWear` cuts segments where the air crosses 8 °C; the dust wrap should be cut the same way. The wrap is not drawn yet (placeholder).

**S3. Minor (39196): the cold dress skips sleep segments and segments carrying `with`.** `coldWear` skips every `act === 'sleep'` segment, and does not cut a segment that has a companion. So a 15-month-old asleep in the lane at about 0 °C (09:02–09:22) has no cold dress, while the rows on either side have it.

**S4. Minor (3003, 39196): very early bedtimes for small children.**
- 39196 is asleep 2 min after sunset and 3003 29 min after it. That gives nights of about 14 h. The 15-month-old sleeps 16.5 h in 24.
- The infant-sleep note in `lives.json` itself cites 12–15 h for 4–11 months, and the modern figure for 1–2 years is 11–14 h (RECOLLECTION, NOT SEEN, verify).
- The rule for older children (`children.bed_after_sunset_h.under_10`, 0.7–1.6 h) gives later bedtimes. So the under-fives are put to bed before the rule for older children would allow.

**S5. Minor (17959): children of five and over are out with no companion recorded.** The plan gives the lane and "playing by the canal" (`children.choices.water_edge` 0.15) with no `with`. In this household, the sister of 8 is at the canal only after the 5-year-old has left it. §9.5 asks "who they meet". For a child at flowing water this matters more than elsewhere.

**S6. Minor (44293): the flock is counted in the dark.** `herderPassing` places "letting the flock out of the fold and counting it" at `B.wake + 0.3`, with no light check. On Tashritu 4 that is 05:08, 1 h 02 min before sunrise, with no moon. `homeHours` already has a "no work that needs light before first light" rule (sunrise − 0.45 h); the herders do not use it.

**S7. Minor (#30): two trips down to the same quarter in one morning.** He goes to the town lanes (07:09–09:21), back up for 40 min at the hearth, then down to the practice ground in the same quarter (10:13–12:30). The practice ground is placed at `training:q_lt_e`, but the label says "below the Terrace".

**S8. Minor (#100): games in the dark.** Knucklebones in the lane 17:12–18:26 (sunset 17:19), with no light source. The walk home at 18:26 is also after dark.

**S9. Minor (#131, 44977, 43314, #8): labels.**
- A courier's generic home craft is "mending tools and baskets"; harness or saddle-bags would fit.
- "the evening meal, kept for the late-comer" is used for a man who was 3 min away.
- "on the day's business" leads into "seeing the lower town".
- "sleeping through the heat of the day" lasts 40 min.

**S10. Minor (not in the sample; found while checking 28957): two rain rules disagree.**
- `calendar.ts` l. 279 cancels ploughing and sowing (E-40, E-44) for the whole of any wet day, even when the rain starts at 15:00. Other field work goes on until the rain comes. On day 354 (rain from 12:15), one in ten farming men takes 821 midday meals at the field that overlap the rain by up to 36 min, before "home out of the rain". An example is 7039, who eats 12:05–12:37 in the rain from 12:15.
- Either rule may be defensible (C), but they disagree. A dry morning inside the sowing window is lost to a rain that comes in the afternoon.

**S11. Minor (44627): a 6-year-old walks the whole migration day.** In `herderPassing`, role 'child' (5–9) walks and only 'little' (under 5) rides the donkey's load. On the arrival day that is about 6 h 45 min on the plain plus about 2 h off-map, 05:50–14:32. The migration analogue cited in `lives.json herders` is Barth's Basseri (NOT SEEN) and the Qashqai. A ride for the younger children on part of the stage would be the more plausible default (C either way).

**S12. Checked, not a fault: walking times and places.** Measured from `PLACES` (sim.ts):

| route | distance | time |
|---|---|---|
| column 40 → work hearth | 68 m | ≤ 1 min |
| column 40 → capital yard | 91 m | 1 min |
| stair foot → Treasury store | 317 m (straight line) | 6 min loaded |
| garrison hearth S → post Tachara 1 | 235 m | 3 min, brisk |
| post gate W2 → post harem 2 | 244 m | 8 min |
| post harem 2 → post gate S2 | 210 m | 5 min |

Town walks are 25–28 min for Terrace workers and 3 min for lanes and wells, consistent throughout.

## Measurements (scratch scripts in the scratchpad; the repo is untouched except for this file)
| script | what | result |
|---|---|---|
| `tools/shadow_days.ts 1 131` → `regen131.txt` | is the sample what the tree produces? | byte-identical (`cmp`), md5 3057353… |
| `places.ts` | distances between the detailed agents' places | as in S12 |
| `roof.ts` | roof plastering overlapping rain or storm hours (1 farming man in 5, 28 wet or storm days) | 1,587 spells, 1,883 h, days 185 and 201 → about 7,900 spells, 9,400 h for all |
| `hh.ts` | the full household plans for 42388, 28957, 17959 and 44977 on their days | the father "at home: storm" while the son plasters the roof; 28957's household is on a "market" day (no E-40: the day is wet); the sister is not at the canal with 17959; the builders' housemates "at home: the gang works in halves in winter" |
| `fieldrain.ts`, `one.ts` | field segments inside rain hours | day 354: 821 midday meals at the field overlapping the rain by up to 36 min (1 in 10 men); example: person 7039 |

## What I checked
| check | how | result |
|---|---|---|
| Calendar: regnal day ↔ Babylonian date ↔ Julian date | own table from CALENDAR_AND_UNITS month lengths | all 19 dates correct |
| Seasonal events vs EVENTS.md | E-01 (days 1–5: #114 day 3, 2036 day 5), E-43 (day 103 in 43–141), E-46 (month 6), E-49 (months 7 and 12), E-62 (month 11), E-64 (Tmax > 33 °C: #114, 2668, 5936, 12597, #131) | consistent |
| Weather vs activity | storm, rain, dust and cold hours against each segment | **S1 blocking**; S2, S3 minor |
| Light | work and outings against sunrise and sunset | S6, S8 minor; pre-dawn grinding and water drawing are in twilight or are ethnographic commonplaces |
| Sleep | total hours and bedtimes by age | S4 minor; the adults are plausible |
| Meals | 2–4 a day for everyone; the baby's feed intervals | plausible |
| Continuity and walking times | every → / @ transition; distances measured | no teleport (S12) |
| People alone who should not be | the under-fives' `with`; the 5-year-old | S5 minor |
| Labels vs simulation | code read for the chores, dust, cold and herders | S1, S2, S3, S9 |
| Repetitive routines | the foreman's oscillation, the porter's round trips, children's 3–6 min fragments | noted (mechanical but not implausible) |
| Sample fidelity | regenerated from the tree | byte-identical; no score changed |
