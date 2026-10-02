# The minds' year (D-461, session 15, cloud)

Run: `nice -n 15 npx tsx tools/dev/minds_year.ts 1,7 354` on the cloud box (4 cores, node). Every person of the town and the plain, a year from day 0, with no stranger. Tier C throughout: the odds and the paces are the module's reading (DECISIONS D-461).


**Read first (what is broken or open):**
- The minds' cost grows with what the town holds: 67-72 ms a game day in the first month, ~160-230 ms a day from about day 180 on (35-43 thousand feelings held, 2300-2900 goals active), against ~600 ms a day for the rest of the living world. Sliced: 125-141 thousand slices a year, the longest 21.6 ms (seed 7) and 37.3 ms (seed 1, once, in the feelings part); the parts' own steps are a few ms each.
- The minds' betrothals are 1.3-1.5 times the population's own weddings of the year (447 against 336, 426 against 285): likely too many (tier C; the relations layer's own weddings come on top and do not yet know of these betrothals).
- The save of deeds and minds at the year's end: 831-967 KB packed (2.9-3.5 MB raw): the feelings and the active goals.
- Revenge mostly cools before it is paid back (379 of 422 abandoned on seed 1); chains of cause run two or three deep, not longer.
- Heap at the year's end 1.1-1.9 GB for the whole simulation (not the minds' alone: not separated).

**Headline (seeds 1 and 7):** about 31-33 thousand goals formed a year (care 13.3-13.5 thousand, kin visits 6.0-6.4, mending 1.7, teaching 1.7-1.8, offerings 1.7, debts 1.8-3.8, work 1.3-1.4, patrons ~1.0, matches ~0.9, dowries ~0.6, revenge ~0.4, reconciliation ~0.1, leaving ~0.13), 86-89 % achieved; 17.2-17.4 thousand people (of ~27.6 thousand aged 14 and over) held a goal at some time in the year, 6-8 % at any one time; 222-255 thousand deeds a year by the minds alone (feelings 86-87 thousand, goals 107-135, the talk of deeds 26-31, quarrels ~3.7, the day's life ~1.6); 426-447 betrothals and weddings set, 957-1039 places won with a master, 54-67 people gone for good, ~1400-1480 children taught the work.

## Seed 1: 354 days, no stranger (wall 475 s)

**Cost:** the minds 144.6 ms per game day for the whole town (46601 people), longest slice 37.3 ms (124938 slices); the rest of the living world 594 ms per day. Longest slice by part: feeling 37.3, frictions 2.6, form 13.8, places 7.6, prune 14.7, end 7.0, life 1.3, pursue 9.6, talk 8.2 ms; the time of each part per day: feeling 61.0, frictions 0.2, form 32.3, places 1.8, prune 10.7, end 0.2, life 0.4, pursue 33.0, talk 5.0 ms. Cost per game day month by month (the minds' own, ms): 30: 72, 60: 88, 90: 108, 120: 128, 150: 150, 180: 158, 210: 180, 240: 186, 270: 169, 300: 159, 330: 170.

**State:** deeds and minds save 2888 KB raw, 831 KB packed; 35848 feelings held by 15294 people; deed log in memory 22341 records; heap 1078 MB.

**Goals:** 31238 formed, 27741 achieved, 1192 abandoned, 2305 still pursued at the end.

| kind | formed | achieved | abandoned |
|---|---:|---:|---:|
| care | 13300 | 13103 | 13 |
| debt | 1765 | 653 | 167 |
| bridegift | 32 | 26 | 0 |
| dowry | 585 | 496 | 2 |
| spouse | 903 | 499 | 126 |
| work | 1394 | 1070 | 271 |
| patron | 953 | 586 | 69 |
| revenge | 422 | 31 | 379 |
| reconcile | 109 | 109 | 0 |
| pilgrimage | 1704 | 1662 | 0 |
| teach | 1785 | 1482 | 41 |
| leave | 126 | 67 | 54 |
| repair | 1741 | 1727 | 3 |
| kinvisit | 6419 | 6230 | 67 |

**How goals ended (top 24):**

- 10246 care achieved: X is well again
- 4919 kinvisit achieved: visited X house
- 1287 pilgrimage achieved: the offering made
- 1025 repair achieved: the house mended
- 979 teach achieved: X has learned the work
- 775 work achieved: taken on by X
- 460 debt achieved: the debt paid
- 411 patron achieved: X favour won
- 353 care achieved: ČiX is well again
- 311 dowry achieved: the dowry for X put by
- 296 spouse achieved: betrothed to X
- 275 revenge abandoned: the anger cooled
- 237 work abandoned: no master in the quarter
- 82 reconcile achieved: at peace with X
- 67 spouse abandoned: no match would have him
- 52 leave achieved: left for X
- 46 kinvisit abandoned: no day for the visit
- 45 care achieved: Θuxra is well again
- 42 debt abandoned: gave it up: too long
- 42 debt abandoned: could not pay: the lender took his due
- 41 kinvisit achieved: visited Θuxra's house
- 40 leave abandoned: could not leave the house
- 38 kinvisit achieved: visited someone's house
- 35 spouse achieved: betrothed

**People with a goal of their own:** 17217 people held at least one goal over the 354 days; at each month's end (of everyone present aged 14+):

| day | with a goal | of | share | town and plain houses: with a goal | of | share | goals active |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 30 | 913 | 27300 | 3% | 913 | 27267 | 3% | 919 |
| 60 | 1290 | 27541 | 5% | 1290 | 27501 | 5% | 1316 |
| 90 | 1487 | 27535 | 5% | 1487 | 27502 | 5% | 1523 |
| 120 | 1639 | 27576 | 6% | 1639 | 27528 | 6% | 1685 |
| 150 | 1854 | 27553 | 7% | 1854 | 27519 | 7% | 1902 |
| 180 | 1764 | 27591 | 6% | 1763 | 27537 | 6% | 1814 |
| 210 | 1764 | 27583 | 6% | 1764 | 27544 | 6% | 1829 |
| 240 | 1581 | 27595 | 6% | 1581 | 27561 | 6% | 1622 |
| 270 | 1494 | 27606 | 5% | 1494 | 27573 | 5% | 1539 |
| 300 | 1671 | 27645 | 6% | 1671 | 27598 | 6% | 1722 |
| 330 | 1936 | 27679 | 7% | 1936 | 27609 | 7% | 2018 |

**Deeds** (222341 in all; by source: feeling 87273, quarrel 3764, talk 26500, life 1574, goal 106994):

| verb | tried | done |
|---|---:|---:|
| help | 54541 | 54536 |
| visit | 32222 | 27097 |
| give | 29372 | 29368 |
| tell | 26953 | 26952 |
| hire | 24156 | 24041 |
| teach | 19691 | 17919 |
| heal | 10673 | 10651 |
| comfort | 7535 | 7535 |
| repair | 3586 | 3586 |
| praise | 2867 | 2867 |
| share_food | 2735 | 2734 |
| come_with | 1596 | 1388 |
| court | 1503 | 524 |
| introduce | 1133 | 1084 |
| insult | 956 | 956 |
| complain | 949 | 949 |
| avoid | 610 | 610 |
| promise | 447 | 447 |
| borrow | 368 | 144 |
| intercede | 114 | 66 |
| apologize | 104 | 104 |
| curse | 103 | 103 |
| reconcile | 95 | 84 |
| attack | 24 | 24 |
| break | 8 | 8 |

**Chains of cause** (goals by depth: 1 = born of the person's own state; 2+ = born of a deed or a goal that came of another): depth 1: 30548, depth 2: 687, depth 3: 3.

- Aryagaunā insult Raučazauštrī -> Raučazauštrī set on revenge (a wrong done by Aryagaunā) -> Raučazauštrī curse Aryagaunā -> Aryagaunā set on revenge (a wrong done by Raučazauštrī)
- Aryastūnā tell Amagaunā -> Amagaunā set on reconcile (a quarrel with Aryastūnā)
- Ammarna avoid Barukka -> Barukka set on revenge (a wrong done by Ammarna) -> Barukka curse Ammarna -> Ammarna set on revenge (a wrong done by Barukka)

**What the minds changed in the world:** 447 betrothals (421 weddings set within the year; the population's own weddings of the year: 336), 1039 places with a master held at the end, 67 people left the town for good, 1478 children taught a craft; 112 cases before the elders (open or recent), 25 people wounded.

## Seed 7: 354 days, no stranger (wall 498 s)

**Cost:** the minds 168.4 ms per game day for the whole town (46282 people), longest slice 21.6 ms (141441 slices); the rest of the living world 619 ms per day. Longest slice by part: feeling 14.1, frictions 8.5, form 13.1, places 8.2, prune 21.6, end 6.3, life 6.4, pursue 12.9, talk 12.1 ms; the time of each part per day: feeling 65.9, frictions 0.3, form 35.8, places 1.6, prune 12.0, end 0.2, life 0.5, pursue 45.7, talk 6.4 ms. Cost per game day month by month (the minds' own, ms): 30: 67, 60: 91, 90: 116, 120: 140, 150: 162, 180: 174, 210: 209, 240: 228, 270: 205, 300: 216, 330: 210.

**State:** deeds and minds save 3512 KB raw, 967 KB packed; 43102 feelings held by 15898 people; deed log in memory 22636 records; heap 1854 MB.

**Goals:** 33221 formed, 28415 achieved, 1857 abandoned, 2949 still pursued at the end.

| kind | formed | achieved | abandoned |
|---|---:|---:|---:|
| care | 13526 | 13334 | 15 |
| debt | 3844 | 1672 | 744 |
| bridegift | 55 | 37 | 0 |
| dowry | 618 | 512 | 1 |
| spouse | 920 | 464 | 154 |
| work | 1284 | 975 | 253 |
| patron | 1043 | 589 | 59 |
| revenge | 451 | 24 | 416 |
| reconcile | 122 | 111 | 2 |
| pilgrimage | 1692 | 1658 | 1 |
| teach | 1747 | 1402 | 63 |
| leave | 127 | 54 | 68 |
| repair | 1757 | 1746 | 4 |
| kinvisit | 6035 | 5837 | 77 |

**How goals ended (top 24):**

- 10048 care achieved: X is well again
- 4496 kinvisit achieved: visited X house
- 1254 pilgrimage achieved: the offering made
- 1070 repair achieved: the house mended
- 1028 debt achieved: the debt paid
- 888 teach achieved: X has learned the work
- 684 work achieved: taken on by X
- 415 care achieved: ČiX is well again
- 346 patron achieved: X favour won
- 307 revenge abandoned: the anger cooled
- 299 dowry achieved: the dowry for X put by
- 292 spouse achieved: betrothed to X
- 214 work abandoned: no master in the quarter
- 200 debt abandoned: could not pay: the lender took his due
- 191 debt abandoned: gave it up: too long
- 83 reconcile achieved: at peace with X
- 79 spouse abandoned: no match would have him
- 48 kinvisit abandoned: no day for the visit
- 45 leave achieved: left for X
- 41 care achieved: Θuxra is well again
- 40 leave abandoned: could not leave the house
- 38 dowry achieved: the dowry for ČiX put by
- 31 teach abandoned: X would not learn
- 30 kinvisit achieved: visited Θuxra's house

**People with a goal of their own:** 17351 people held at least one goal over the 354 days; at each month's end (of everyone present aged 14+):

| day | with a goal | of | share | town and plain houses: with a goal | of | share | goals active |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 30 | 854 | 27214 | 3% | 854 | 27166 | 3% | 861 |
| 60 | 1188 | 27234 | 4% | 1188 | 27186 | 4% | 1216 |
| 90 | 1477 | 27236 | 5% | 1477 | 27193 | 5% | 1518 |
| 120 | 1675 | 27256 | 6% | 1675 | 27215 | 6% | 1720 |
| 150 | 1938 | 27272 | 7% | 1938 | 27232 | 7% | 1987 |
| 180 | 1929 | 27320 | 7% | 1929 | 27260 | 7% | 1991 |
| 210 | 2263 | 27315 | 8% | 2263 | 27277 | 8% | 2386 |
| 240 | 1791 | 27328 | 7% | 1791 | 27289 | 7% | 1856 |
| 270 | 2191 | 27349 | 8% | 2191 | 27310 | 8% | 2297 |
| 300 | 2275 | 27363 | 8% | 2275 | 27310 | 8% | 2423 |
| 330 | 2454 | 27377 | 9% | 2454 | 27311 | 9% | 2620 |

**Deeds** (254636 in all; by source: feeling 86242, quarrel 3666, life 1613, goal 135422, talk 31359):

| verb | tried | done |
|---|---:|---:|
| help | 53819 | 53806 |
| hire | 50158 | 49370 |
| visit | 32779 | 27565 |
| tell | 31837 | 31836 |
| give | 29581 | 29536 |
| teach | 19183 | 17140 |
| heal | 11231 | 11214 |
| comfort | 7524 | 7524 |
| repair | 3682 | 3682 |
| praise | 2994 | 2994 |
| share_food | 2600 | 2600 |
| come_with | 1609 | 1347 |
| court | 1561 | 488 |
| borrow | 1352 | 325 |
| introduce | 1204 | 1124 |
| insult | 993 | 993 |
| complain | 948 | 948 |
| avoid | 657 | 657 |
| promise | 426 | 426 |
| intercede | 129 | 64 |
| apologize | 117 | 117 |
| curse | 113 | 113 |
| reconcile | 105 | 94 |
| attack | 27 | 27 |
| break | 7 | 7 |

**Chains of cause** (goals by depth: 1 = born of the person's own state; 2+ = born of a deed or a goal that came of another): depth 1: 32499, depth 2: 718, depth 3: 4.

- Manezza avoid Umanna -> Umanna set on revenge (a wrong done by Manezza) -> Umanna curse Manezza -> Manezza set on revenge (a wrong done by Umanna)
- Bakezza avoid Manyakka -> Manyakka set on revenge (a wrong done by Bakezza) -> Manyakka insult Bakezza -> Bakezza set on revenge (a wrong done by Manyakka)
- Mantukka insult Vahuka -> Vahuka set on revenge (a wrong done by Mantukka) -> Vahuka insult Mantukka -> Mantukka set on revenge (a wrong done by Vahuka)
- Θuxra attack Bakumarda -> Bakumarda set on revenge (a wrong done by Θuxra) -> Bakumarda insult Θuxra -> Θuxra set on revenge (a wrong done by Bakumarda)

**What the minds changed in the world:** 426 betrothals (412 weddings set within the year; the population's own weddings of the year: 285), 957 places with a master held at the end, 54 people left the town for good, 1399 children taught a craft; 137 cases before the elders (open or recent), 33 people wounded.
