**VERDICT: PASS.** No score is below 4: 9 people score 5 and 11 score 4. The sample regenerates byte-identical (md5 `e784654c301f21a8a41c7682f4170dcf`). The gate passes, but read the list below before relying on it. After scoring I traced one sample line to a fault that runs through the whole year and shows on the Terrace. **A walk between two places on the Terrace is played out as a trip down the stair to the plain and back up (S1).** In the sample the official #133 leaves the Treasury for the gate hall by way of the stair foot: 30 min where the plan allows 3. In seed 1 the same fault is in 349 of 708 detailed-scribe days (49 %) and 160 of 917 detailed-official days (17 %). Scribe #119, for one, walks down the stair and back up to get from the Treasury desk to the Treasury store: 49 min, every other morning. This did not pull #133 below 4, because it is one wasted half-hour in a sound day. It is still the most visible fault in this round. **No score changed after scoring.**

# Shadow review, Phase 5, round 10, reviewer B (brief §13.11): 20 people, one full day each

- **Reviewer:** an independent reviewer subagent, reviewer B (Claude Opus 5.5). I did not build the simulation or see it built. I did not read reviewer A's round-10 review (`REVIEWS/shadow_phase5_r10.md`) or A's scratch files.
- **Date:** 2026-09-25. **Tree:** `/home/user/fars`, branch `claude/amazing-fermi-40ds7j`, HEAD `e2b9652`. The working tree was clean.
- **Gate (§13.11):** "a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5."
- **Sample:** `REVIEWS/shadow_days_input_seed1_pick181.txt` (seed 1, pick seed 181; md5 `e784654c301f21a8a41c7682f4170dcf`, recorded before reading). After scoring I ran `npx tsx tools/shadow_days.ts 1 181` into the scratchpad. The output is **byte-identical**.
- **Read before scoring:**
  - lines 1–40 (header and protocol) of `REVIEWS/shadow_phase5_r3.md` and `REVIEWS/shadow_phase5_r9_b.md`. Their first lines carry the r3 and r9-B verdicts: a dead man drawn, and the guard's water jar;
  - the sample, in full;
  - `research/CALENDAR_AND_UNITS.md`, `EVENTS.md`, `PEOPLE.md`, `PLAIN.md` and `SETTLEMENT.md`, each in full;
  - `PERSEPOLIS_BRIEF.md` §5.5, §9 (9.1–9.5) and §13.

  I did not grep `OPEN_QUESTIONS.md`.

  **Calendar check.** I built the day → month table from the month lengths: months begin on days 1, 30, 60, 90, 119, 149, 178, 208, 237, 267, 296 and 326. All 20 printed dates agree with it (e.g. 156 = Ululu 8 = 19 Sep 467; 250 = Kislimu 14 = 22 Dec 467; 324 = Shabatu 29 = 6 Mar 466; 354 = Addaru 29 = 5 Apr 466).
- **Scores fixed first,** in `/tmp/claude-0/-home-user-fars/ac6caaff-37cb-51fc-aea7-1f0f1d8e5ae0/scratchpad/shadow_r10_B_scores.md`. I saved them before I opened any code, data file, `DECISIONS.md` or earlier finding.
- **Read after scoring:**
  - `tools/shadow_days.ts` (all);
  - `src/people/sim.ts`: `planOf`, `decide`, `decide0`, `setDown`, the head of `onTerrace` (ll. 225–300);
  - `src/people/population.ts`:
    - `go()` (ll. 1735–1763);
    - `nameFor`, `NAME_POOLS`, `ORIGIN_POOL`, `THIN_NAME_POOL` (ll. 1585–1616);
    - `coldWear`, `outdoors`, `OPEN_PLACE` (ll. 159–268);
    - `meals()` (ll. 2121–2151);
    - the supper and birthday lines (ll. 2320–2331);
    - the guard's family visit (ll. 3080–3096);
    - `townPorter` (ll. 3577–3581);
    - `official()` (ll. 3797–3816);
    - the traveller's stay (ll. 4200–4242);
    - the `heatRest` sites (grep);
  - `src/people/calendar.ts` l. 242 (`heatRest: wx.hot`);
  - `src/people/planCheck.ts` ll. 257–263 (the "late-comer" check);
  - `src/data/names_recalled.json`: the Roxane and Šamaš-iddin entries;
  - the first 3 lines and section heads of `REVIEWS/shadow_phase5_r8.md`, `_r8_b.md`, `_r9.md` and `_r9_b.md`.
- **Measured after scoring.** All of these are read-only scratch scripts in the scratchpad, run on seed 1:
  - `r10b_plans.ts`: the plans of #133, #109 and #90 on their days;
  - `r10b_t2t.ts`: every detailed agent's plan on every day it is present, looking for Terrace → road → Terrace;
  - `r10b_step.ts`: scribe #119 on day 1, stepped;
  - `r10b_ctx.ts`: `heatRest` and Tmax on days 52, 55, 104 and 156;
  - `r10b_sliver.ts`: work tails after the meal. It covers every 7th person on every 11th day (205,310 person-days) and every detailed mason and foreman day (4,602);
  - `r10b_gfam.ts`: every detailed guard's family visit, all year (16,554 visits);
  - `r10b_bd.ts`: household 1107's names and the birthday label.
- **Score changes after scoring: none.** Two notes in my scoring paragraphs rested on a misreading. I correct them here; neither was scored.
  - **(a) 8337's stratum.** My note said the sampler was wrong to draw a 19-month child as "past a birthday that moves it across an age rule (1, 5 or 8 on the day)". That was wrong. The stratum means *aged* 1, 5 or 8 on the day after a birthday earlier in the year (`tools/shadow_days.ts` l. 94–95). 8337 was 0 at the start of the year and is 1 on day 250. The draw is correct.
  - **(b) #109's Tmax.** The header prints Tmax as "33 °C", but it is 33.10 °C (`r10b_ctx.ts`). So E-64 (Tmax > 33 °C) does apply, and the noon end is the heat rule. The 4-minute tail stands (S3).
- **Files:** I modified no project file other than this one.

## Read first: what is broken or placeholder

1. **S1 (year-wide; seen in #133).** A walk between two places on the Terrace is stepped as a trip off the Terrace. The detailed agent walks to the stair foot, is hidden, and comes back up. This affects 49 % of detailed-scribe days and 17 % of detailed-official days. It is drawn where the player stands.
2. **S2 (year-wide; seen in #90 and #12).** A guard's family visit is one long spell of "talk" or "rest". Of 16,554 visits in the year, 4,686 last 6 h or more "with his family", and 2,233 hold a single block of 4 h or more. On all 638 heat days whose visit spans the afternoon, he has no sleep in the heat (100 %).
3. **S3 (seen in #109).** On heat days a meal is inserted 4 min before the end of work, so the mason carves 4 minutes after eating and then leaves. This is in 922 of 4,602 detailed mason and foreman days (20 %).
4. **Smaller label, name and dress faults:** S4 (the Lycian named Šamaš-iddin), S5 (the traveller's "another errand"; no cold dress at the station), S6 (a woman's birthday labelled "his … every man"). The list of notable 4s is below.
5. **Placeholders:** none in this sample. No line carries `[PLACEHOLDER: not performed]`.

## Scores

| # | Person | Day | Score |
|---|---|---|---|
| 1 | #90, guard, leader of ten, 33 (off day) | Ululu 8 | **4** |
| 2 | #12 Umanna, guard, 26 (off day) | Duzu 15 | **4** |
| 3 | #77, guard, 40, Median (watch day) | Simanu 10 | **5** |
| 4 | #120 Anani, scribe, 54 | Tashritu 20 | **5** |
| 5 | #109 Bēl-ēṭir, mason, 27 | Aiaru 23 | **4** |
| 6 | #133, official, 31 | Tashritu 23 | **4** |
| 7 | 759 Ištimanka, builder, 26, Thracian (heavy rain) | Shabatu 29 | **5** |
| 8 | 44787 Šamaš-iddin, builder, 26, Lycian | Arahsamnu 23 | **4** |
| 9 | 2902 *Hučiθrā, servant, 22, Elamite | Shabatu 15 | **4** |
| 10 | 2832 Irtuppiya, town porter, 27 | Addaru 2 | **4** |
| 11 | 7016 Barukka, child, 5, Elamite | Aiaru 26 | **4** |
| 12 | 35731 Mikrašba, farmer, 55 (rain) | Addaru 29 | **5** |
| 13 | 8337 Irdabada, child, 19 months | Kislimu 14 | **4** |
| 14 | 45918 Bakabana, baby, 3 months | Addaru 18 | **5** |
| 15 | 44135 *Bagastūnā, herder girl, 8 | Ululu 22 | **5** |
| 16 | 43603 Mardunuya, traveller, 55 | Kislimu 18 | **4** |
| 17 | 14207 Irtuppiya, farmer, 22 (threshing night) | Duzu 19 | **5** |
| 18 | 18579 Bakabada, boy, 8 | Kislimu 19 | **5** |
| 19 | 9282 Haturka, farmer, 18 (canal) | Shabatu 17 | **5** |
| 20 | 36403 Roxane, farmer girl, 13 (rain) | Addaru 4 | **4** |

Minimum 4, mean 4.45.

## The 20 days (paragraphs as saved before reading any code; later notes are marked *[after]*)

**#90 (guard, leader of ten, 33; Ululu 8, 36 °C): 4.**
- The off-watch day is sound. He breakfasts at the south hearth at 06:15 and goes down to the town at 07:13. He is with his wife and children at h:90 from 07:40 to 17:45 and eats "a meal before going back up" at 17:09. He is back at the hearth at 18:11 (sunset 18:12), plays knucklebones and is asleep at 19:31.
- **Problems.** The ten hours in town are two undifferentiated blocks, "talk: with his family" 08:59–12:08 and 12:38–17:09, broken only by the midday meal. There is no errand, no chore and no rest in the heat of a 36 °C afternoon, when the other men of this sample sleep. The day's shape matches #12's almost minute for minute. Nothing shows him as a leader of ten.
- *[after]* S2.

**#12 Umanna (guard, 26; Duzu 15, 39 °C): 4.**
- The day follows #90's template: breakfast at 05:32, knucklebones, down to the town, and "with his family" from 06:51 to 18:21. Then a meal at 17:45, back up at 18:39, and knucklebones until 20:08.
- **Problems.** He spends a 39 °C afternoon at five hours of "talk", with no sleep in the heat (E-64/CE-14), and does no task in the town house.
- The name is tier A (PF 1, PF 54).
- *[after]* S2.

**#77 (guard, 40, Median; Simanu 10, 35 °C): 5.**
- He breakfasts before the watch. He is on watch at post_gate_w2 from 06:04 to 14:01, an 8-hour watch (three watches a day).
- The patrol man relieves him for bread from 09:17 to 09:41. He has a water jar at the post through the heat.
- After the watch: a meal, a short sleep, talk in the forecourt with men of another file, and kit care (the spear shaft oiled, the shield rim sewn). Evening meal at 19:01, asleep at 20:38.
- No problem found.

**#120 Anani (scribe, 54, Babylonian; Tashritu 20): 5.**
- He writes in Aramaic on leather at the Treasury desk from 07:51 to 15:31, with the midday meal at the desk. Evening meal at 16:44, knucklebones with neighbours at dusk, asleep at 18:50.
- **Nits:** the midday meal is "the camp's bread and water", and "camp" is the builders' word, not the Treasury's. He spends 1½ h idle before breakfast.

**#109 Bēl-ēṭir (mason, 27; Aiaru 23, "33 °C"): 4.**
- He carves a double-bull capital from 05:34 to 11:36 and has bread and water from 11:36 to 11:57. **Then "dress_stone 11:57–12:01"**: four minutes of carving after the meal, before he walks home at 12:01.
- The afternoon is sound: rest, sleep through the heat, the lane, supper and bed at 21:04. He carries his tools both ways.
- *[after]* The noon end is E-64: Tmax is 33.10 °C, printed as 33. The 4-minute tail is S3.

**#133 (official, 31, Persian; Tashritu 23): 4.**
- He declares a payment at the Treasury from 08:43 to 09:57 (E-05). He makes an inspection round of the gate hall, spends 11:16–15:01 at the official building, plays knucklebones in the lane, and eats the household's birthday meal from 16:50 (E-37).
- **Problem: from the Treasury to the gate hall he goes off the Terrace.**
  - At 09:57 "walk → road:terrace — on the way".
  - From 10:09, 18 minutes "[off the Terrace: not drawn]".
  - At 10:27 "walk → gate_hall".

  He goes down the stair and comes back up for nothing: 30 min where 8–10 would do. The 85 minutes of knucklebones on a feast day are plausible but loose.
- *[after]* S1 and S6.

**759 Ištimanka (builder, 26, Thracian; Shabatu 29, heavy rain): 5.**
- He is at home all day in a ten-man builders' house, and "the gang works in halves in winter" (E-62). He talks, mends tools and baskets, rests, lights the fire at 16:21 and eats supper.
- This fits winter half-strength and the rain. The day is thin but right.

**44787 Šamaš-iddin (builder, 26, Lycian; Arahsamnu 23, 0–16 °C): 4.**
- The day is good.
  - Terrace work: water for the mortar from 07:09 to 12:00, the midday meal at the work hearth, and the earth ramp from 12:30 to 15:30.
  - At home: the house's water from the well, the fire lit at 16:22, supper, and the lane at dusk.
- **Problems:**
  - (1) **The name.** Šamaš-iddin is a Babylonian name, given to a Lycian (§9.1).
  - (2) Mortar water from 07:09 on a 0 °C morning is minor: month 8 is outside E-62.
  - (3) He walks up with a mattock and a basket but works with a jar. That is the site's jar, presumably.
- *[after]* S4.

**2902 *Hučiθrā (servant, 22, Elamite; Shabatu 15): 4.**
- She grinds from 05:46 and fetches water twice. She grinds and spins by turns until 17:00, about 6 h at the quern, the top of the ethnographic range for a house of six. Supper is "kept for the late-comer" although she has been home all day.
- *[after]* `population.ts` l. 2330 gives that label when her spinning runs past the household's supper, and planCheck l. 263 confirms the household ate before her. So the servant eating after the family is right, and only the word "late-comer" is loose. Not a finding.

**2832 Irtuppiya (town porter, 27; Addaru 2): 4.**
- He carries sacks into the town store from 06:57 to 11:02, then rests at home "after work" from 12:38 to 16:12. After that he mends on the doorstep, eats supper and is asleep at 19:44.
- **Problems.** A 4-hour working day on a mild dry day (19 °C), inside the E-01 issue window, is followed by 3½ h of rest. He is a porter living in an official's household.
- *[after]* `townPorter` (l. 3580) works a porter from half an hour before the day's first delivery or issue until 4 h after it, by design (C). The rest follows from that. A logged choice, so not a finding.

**7016 Barukka (child, 5, Elamite; Aiaru 26, 38 °C): 4.**
- He is with his mother all day: a neighbour's house, the lane, the well twice, a sleep with her in the afternoon, her grinding, supper, bed at 20:18.
- **Problems.** Every play block is "near the mother". He never plays with other children, and his siblings of 8 and 12 never appear. He goes to the well at 12:32 in the peak heat of a 38 °C day.

**35731 Mikrašba (farmer, 55; Addaru 29, rain from 12:15): 5.**
- He hoes and weeds from 06:48 to 11:50, eats the bread he carried out, and walks home as the rain begins. He does craft indoors, eats supper, and exchanges goods with neighbours after the rain.
- A good response to the weather.

**8337 Irdabada (child, 19 months; Kislimu 14, −3–11 °C): 4.**
- He is nursed at night, carried to the well and the lane, given meals and nursings, and taken along by his brother of 7 for 45 min.
- **Problems.** He has a 1½-hour midday sleep in the lane in December, with no cold-dress tag, then 22 minutes more at home. A 3-minute "carried on the mother's back while she works" comes before the hand-off to his brother.
- *[after]* No cold tag is correct: `coldWear` tags below 8 °C (`COLD_C`), and midday is warmer than that. The sampler note is withdrawn: see (a) above.

**45918 Bakabana (baby, 3 months; Addaru 18): 5.**
- He is nursed ten times in 24 h. He lies on a mat or in his mother's lap while she works, rides on her back to the well, and has his face wrapped against the dust.
- Cosmetic: zero-length lines at 07:59 and 17:12.

**44135 *Bagastūnā (herder girl, 8; Ululu 22): 5.**
- A camp day on the autumn pass (E-49): water from the stream twice, brush three times, an hour with the weak ewes, play, a sleep in the heat, and the evening meal by the fire.
- The work share fits an eight-year-old.

**43603 Mardunuya (traveller, 55; Kislimu 18, −4–10 °C): 4.**
- A layover at the road station: animals and gear, knucklebones, harness mending, then "on another errand" that turns out to be "seeing the lower town", supper, and the fire.
- **Problems.** He runs no first errand, so "another errand" makes no sense. He sees to the animals at 07:33 on a −4 °C morning with no cold dress. Why the party lies over is not said.
- *[after]* S5.

**14207 Irtuppiya (farmer, 22; Duzu 19, threshing night): 5.**
- He threshes and winnows from 05:31 to 10:30 in a 4 m/s wind and sleeps through the heat, "tonight he keeps watch". He sees to the animals, goes to the lane, eats supper, sits up by the heap until 22:04, then sleeps beside it.
- Motivated from end to end.

**18579 Bakabada (boy, 8; Kislimu 19, −5–8 °C): 5.**
- He lets the animals out, gathers fuel twice, plays knucklebones and pulls a wheeled clay animal. He carries the midday bread to the field and eats with the men (E-40, month 9), then plays chase and eats supper.
- Nit: "the men", for a house with one man.

**9282 Haturka (farmer, 18; Shabatu 17): 5.** He clears the canal from 07:57 to 15:00 (E-50, month 11), eats supper and visits Mikrašba of h:2566. Good.

**36403 Roxane (farmer girl, 13; Addaru 4, rain in the morning): 4.**
- She grinds before dawn, spins through the rainy morning, fetches water twice and spins again.
- **Problems.** "Playing indoors" from 13:56 to 15:00 is out of place for a 13-year-old of a farming house on a dry afternoon in the weeding season.
- "Roxane" is the Greek form of the name. The rest of the sample uses Elamite renderings or starred Old Persian forms.
- *[after]* `names_recalled.json` gives "Roxane" as Iranian, from Ctesias F15, 5th c., recalled and tier C. The Greek form is the known r9 S3 issue and is not new.

## Findings

### S1. A walk between two places on the Terrace is stepped as a trip down to the plain and back (#133, 09:57–10:35; year-wide)

- **Timeline.** #133, 09:57 `walk → road:terrace — on the way`; 10:09 `walk → road:terrace — on the way [off the Terrace: not drawn]`; 10:27 `walk → gate_hall`; 10:35 `inspect @ gate_hall`.
- **Why it is implausible.** The Treasury and the gate hall are both on the Terrace. The plan gives the walk **3 minutes**: `09:56–09:59 walk @ road:terrace (road)`, then `09:59–10:57 inspect @ gate_hall`. The stepped agent takes **38 minutes**: he walks across the platform, down the great stair and back up, and starts the inspection 36 minutes late. A player on the Terrace would see an official leave the Treasury, vanish down the stair, and come back.
- **Code cause.**
  - `Planner.go()` (`population.ts` l. 1761) writes every walk as a segment at `road:${…'terrace'…}` with `where: 'road'`, including walks from one Terrace place to another.
  - `PeopleSim.decide0` (`sim.ts` l. 237–245) treats every segment whose `where !== 'terrace'` as off the Terrace. It sets `off: true` and `spot: PLACES.town.at`, so the agent is routed to the town edge and hidden there. When the next Terrace block begins, he walks back up.
- **How common (`r10b_t2t.ts`, seed 1, every detailed agent on every day present).** A Terrace → road → Terrace walk between two different places occurs on:
  - **349 of 708 scribe days (49 %)**. Scribe #119 goes `treasury_desk → treasury_store` "to the store for the caravan" on alternate mornings. Stepped on day 1 (`r10b_step.ts`), he leaves the desk at 08:57, is off the Terrace from 09:08 and reaches the store at 09:46: a 49-min round trip inside one building;
  - **160 of 917 official days (17 %)**;
  - 23 of 34,887 guard days (the "helped back to the garrison quarters" night leg);
  - no mason, porter, baker, grinder, child or courier days.
- **What would fix it (a suggestion, not made).** One of two changes:
  - `go()` does not emit a `road:` segment when both ends are on the Terrace (or marks it `where: 'terrace'`);
  - `decide0` routes a road segment whose previous and next blocks are both on the Terrace as a Terrace walk.

### S2. A guard's day with his family is one long "talk" block, with no sleep in the heat (#90, #12; year-wide)

- **Timeline.** #90 `08:59 talk @ h:90 — with his family` until 12:08 and again 12:38–17:09 (36 °C). #12 `08:35 talk @ h:12 — with his family` until 12:06 and 12:35–17:45 (39 °C).
- **Why it is implausible.** Ten or eleven hours in the family house pass with nothing done: no water, fire, repair, market or rest in the heat. Each fact alone is possible for a soldier's day off. What makes the day read as filler is the whole shape, and it repeats between two guards of one sample. Everyone else in the sample sleeps through a 33 °C+ afternoon (E-64, CE-14); these two do not.
- **Code cause** (`population.ts` ll. 3080–3096). The visit is built as:
  - a first talk of 1–2 h;
  - the family's midday meal;
  - a lane spell with probability 0.5;
  - one block `back − 0.6` long, "with his family", `rest` or `talk` with probability 0.5 each;
  - a last meal.

  Household work is added only when the wife is ill (the r8 fix). No `HEAT_SLEEP` segment is added in this branch, so `siesta()` has nothing to work on.
- **How common (`r10b_gfam.ts`, all detailed guards, all year).**
  - 16,554 family visits: 4,686 (28 %) spend 6 h or more "with his family", and 2,233 hold a single block of 4 h or more.
  - **638 of 638** heat days whose visit spans 13:00–15:00 have no sleep in it.

### S3. On a heat day the midday meal falls 4 minutes before the end of work (#109, 11:57–12:01; 20 % of detailed-mason days)

- **Timeline.** #109 `11:36 eat @ worksite_capital — bread and water`; `11:57 dress_stone @ worksite_capital`; `12:01 walk → road:terrace — going home`.
- **Why it is implausible.** A man does not pick the chisel up again for four minutes after his bread and then leave.
- **Code cause.**
  - On an E-64 day the mason's work window ends at `L.work_day.heat_end_h` (12:00; `workWindow`, l. 1439), and no midday meal is planned inside it.
  - `meals()` (l. 2121) then finds a gap of over 7 h between breakfast and supper. It puts a 0.35-h "bread and water" at the point of the gap nearest its middle, about 11:35.
  - `insertAt` avoids remainders under 0.05 h (3 min). The 4-minute tail passes.
- **How common (`r10b_sliver.ts`).** 922 of 4,602 detailed mason and foreman days (20 %). In the population sample, 1,017 of 205,310 person-days (builders, children, farmers, craftsmen). Mason 322 has it at 11:56–12:00 on eight of the sampled days.
- **Why the noon end is not a finding.** Tmax on day 52 is 33.10 °C, printed as "33". So E-64 does apply. Whether E-64 should send the gangs home or give a midday rest and an afternoon return is a C rule. E-64 itself says "midday rest", and E-60 says "dawn to mid-afternoon". Logged, not scored.

### S4. A Lycian named Šamaš-iddin (44787)

- **Why it is implausible.** A Babylonian theophoric name on a Lycian builder breaks §9.1's "matched to origin".
- **Code cause.**
  - `nameFor` (l. 1609). The Lycian men's pool holds 3 recalled names, under `THIN_NAME_POOL` = 8. So 5 in 8 Lycians draw from all names of their sex, of any origin.
  - This is a logged decision: D-202 and S9 of r5, justified by Herdkama "the Egyptian" (PT-WAGE, C).
- **Assessment.** The rule is defensible for Iranian and Elamite names, which foreigners in Persis took. A Babylonian name for a Lycian is less so. A narrower fallback would be better: the Iranian and Elamite names attested at Persepolis, rather than all names. Minor.

### S5. The traveller's second errand is named "on another errand" when there was no first errand, and he has no cold dress at the station (43603, 12:56 and 07:33)

- **Code cause (errand).** l. 4240. The stay's first stop for this man was `['station', …, 'tend_animals']`, which needs no walk. The afternoon's second stop is always walked "on another errand", even when it is sightseeing. r7 S7 renamed the first walk after its destination but not the second.
- **Code cause (dress).** `coldWear` tags only `outdoors(s)` segments. `OPEN_PLACE` (l. 159) does not include `station`, and "seeing to the animals and the gear" does not match `OPEN_WHY`'s "animals out". So a man working with the animals in the station court at −4 °C is treated as indoors.
- Minor.

### S6. A woman's birthday meal is labelled "his birthday meal: the day every man values most" (household 1107, day 200; not in the sample's text)

- **Found how.** #133's line reads "a birthday meal for *Čiθrazātā". `r10b_bd.ts` shows *Čiθrazātā is his wife, 2768, a woman of 23.
- **Code cause.** `population.ts` l. 785 picks any Persian adult of 16 or more, either sex, whose birthday it is. l. 2328 then gives her own plan the words "his birthday meal: the day every man values most (HDT 1.133)", and the fallback is "a man of the house".
- **Assessment.** A woman's birthday meal is consistent with E-75 ("1 per adult Persian"). The label's sex is wrong. Label only.

### Notable 4s not traced to code

- **7016:** every play block is "near the mother", and there is a well trip at 12:32 on a 38 °C day.
- **8337:** a 1½-h midday sleep in the lane in December.
- **36403:** an hour of "playing indoors" for a 13-year-old on a dry afternoon.
- **2832:** a 4-h porter's day, by design (`townPorter`).
- **2902:** the loose "late-comer" label (the household did eat first).

## What I read, and when

1. **Before scoring, in this order:**
   - lines 1–40 of `REVIEWS/shadow_phase5_r3.md` and `REVIEWS/shadow_phase5_r9_b.md`;
   - the md5 of the sample, then the sample, in full;
   - `research/CALENDAR_AND_UNITS.md`, `SETTLEMENT.md`, `EVENTS.md`, `PEOPLE.md` and `PLAIN.md`, in full;
   - the heading list of `PERSEPOLIS_BRIEF.md`, then §5.5, §9 and §13.

   Scores and paragraphs were saved to the scratchpad file.
2. **After scoring:**
   - `git status` and `git log`;
   - the regeneration of the sample (byte-identical);
   - `tools/shadow_days.ts`;
   - the head lines and section titles of `REVIEWS/shadow_phase5_r8.md`, `_r8_b.md`, `_r9.md` and `_r9_b.md`;
   - the code listed in the header, with the scratch measurements between the reads.

   I did not read `REVIEWS/shadow_phase5_r10.md`, reviewer A's scratch files, `DECISIONS.md` or `OPEN_QUESTIONS.md`.
