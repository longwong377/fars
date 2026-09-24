# The court in residence (session 6, court workstream; D-182, B12)

Machine-readable: `src/data/court.json` (groups, counts, places, guard lines, day rules; every row tiered and sourced)
and `src/people/court.ts` (the people and their day plans). The court exists **only** with the out-of-world setting
'Court calendar = seasonal pattern' (`?court=seasonal`, D-003). Court ABSENT stays the default and the evidence-strict
state: nothing places Xerxes at Persepolis in 467 (Q-005, B9).

**Read this first: what is weak, placeholder or not done.**
- **No primary text on the court was read in full this session.** Iranica, attalus.org (Athenaeus), achemenet
  (Henkelman 2010), isac.uchicago.edu and academia are refused by the egress proxy (B6). Everything below from them is a
  web-search summary (SX, capped at B). Herodotus is read in full from Perseus (key HDT, earlier session).
- **Every count is C.** The sources give claims about other kings (Artaxerxes II, Darius III) or about the army on the
  march; the numbers here are sized to meet population.json's court-resident Terrace values (a setting, C) in the
  proportions the sources suggest.
- **The king is not a person in the simulation.** His audience happens out of sight (Q-335).
- **Placeholders:** delegation dress by people is not built (delegates wear the generic Median riding dress); the court's
  camp has no tents (its people are drawn in the open, asleep too); the golden/silver apple butts are the ordinary spear
  prop; the women's night music (Heracleides) is not performed.
- **Not simulated:** the town's +13,000 retinue and the plain's +5,000 (population.json town and plain court_resident);
  only the ~1,900 court people who lodge in the court's camp count toward the town. The court's food does not draw on the
  calendar's stores (calendar.ts, another workstream).

## 1. Sources (keys in `src/data/sources.json`)
| key | what | access | tier |
|---|---|---|---|
| HDT | Herodotus 7.40-41: Xerxes followed by 1,000 spearmen with golden pomegranates on the spear butts, inside 9,000 with silver; 7.83: the ten thousand "Immortals", always kept at 10,000; 7.81: decimal command | FT (Perseus) | B (Greek claim about the army on the march) |
| IR-IMM | Iranica "Immortals" on HDT 7.41, 7.83 | SX | B |
| IR-HERACL, ATH12-HERACL | Heracleides of Cyme (Persika, 4th c.) via Athenaeus 12.514b-c: the thousand "apple-bearers" (mēlophoroi), Persians of rank chosen from the Ten Thousand, guard the king; three hundred women who sleep by day and watch at night with singing and lamps | SX (+ Perseus English of 12.514b read in session 3) | B (claims about Artaxerxes II's court) |
| ATH4-HERACL, ATH4 | Heracleides via Athenaeus 4.145-146: the king's dinner; those who serve bathe and wear fine clothes; guests dine inside and outside, even those inside apart from the king; food carried out to the court for the guards (the SX did not return this sentence verbatim: B for the dinner, C for the wording); Ctesias and Dinon (4.146c): the king's table fed 15,000 a day at a cost of 400 talents; "a thousand animals slaughtered for the king every day" | SX | B (claims) |
| ATH13-PARM, IR-HAREM | Parmenion's letter (Athenaeus 13.608a; Darius III's baggage at Damascus, 333): 329 concubines skilled in music, 46 garland weavers, 277 cooks, 29 pot boilers, 13 dairy cooks, 17 drink makers, 70 wine strainers, 40 perfumers | SX | B (claim about a travelling court 134 years later) |
| HENK2010, IR-ADMIN | Henkelman 2010 "Consumed before the King": PF 0701, 126,100 qa of flour "consumed before the king" (Darius); the royal table's food redistributed to family, courtiers and guards | SX | B (Darius-era); C for 467 |
| KING2022 | "Trips to the King, taxation and the New Year" in the PF archive | abstract | B for the Darius-era pattern |
| IR-COURT, IR-CHIL | the chiliarch (hazarapatiš) as chief of the court and commander of the thousand, screening visitors before an audience; the usher (eisangeleus) who announces them; eunuchs; the steward of the royal household; "table-companions" as a court title | SX | B |
| TREAS-AUD | the Treasury audience relief: enthroned king, crown prince, a beardless attendant with a towel, a Mede with battle-axe and quiver, two Persian guards, incense burners, a Median official bowing with hand before the mouth | SX | A (relief) / B (reading) |
| APA-RELIEF | the Apadana stair reliefs: 23 delegations in their own dress with gifts, each led by the hand by an usher; files of Persian and Susian guards; Persian and Median nobles | SX | A (images) / B (types) |

## 2. Composition on the Terrace (court.json `groups`; all counts C)
| group | n | where they sleep | what they do (C) | basis |
|---|---|---|---|---|
| the king's spearmen (mēlophoroi) | 1,000 | the garrison quarters (Q-331) | ten hundreds of ten files of ten on the garrison's five-day cycle (A 06-14, B 14-22, C 22-06, off, off: D-023); a watch's 20 files hold 21 stretches of 10 ceremonial posts (stair head, Gate, the way to the Apadana, its N and E façades, the road E from the Gate, the Tripylon, Tachara, Hadish, "Harem"), moved on by 7 each day; by night 8 stretches (stair, Gate, palaces, Tripylon), the rest within call at the guards' court; each man relieved once for a meal; off days: talk, knucklebones, mending gear, washing, and on free days archery below the Terrace (drill C) | HDT 7.41, Heracleides (B claims); dress alternating Persian/Median by file as on the reliefs (B) |
| women of the royal household | 300 | the "Harem" N court | secluded in its courts: talk, rest, spinning, weaving, meals brought from the kitchens; about one night in five awake with the lamps (music not performed) | Heracleides, Parmenion (B claims) |
| attendants (eunuchs, women servants) | 200 | the "Harem" S wing | attendance on the women and in the Hadish, carrying their meals from the kitchens, water, sweeping | TREAS-AUD, IR-COURT (B); count C |
| palace servants | 700 | ¼ "Harem" S wing, ¼ Tachara, ½ the camp | sweeping the halls and courts, water, standing by in the Apadana | C |
| the king's table | 800 | 43 % the kitchens, 57 % the camp | cooks 43 %, bakers 21 %, wine staff 13 %, water carriers 9 %, servers 14 % (Parmenion's proportions, merged); dishes to the Hadish, to the women and to the guards' court | ATH13-PARM, ATH4 (B claims); kitchens NOT LOCATED (Q-332) |
| porters (supply line) | 450 | the camp | loads from the royal stores (town.json `royal_store`) up to the table store: flour, barley, wine, oil | PF royal stores (B, Darius); C |
| butchers | 60 | the camp | slaughter at the stockyard, meat carried up to the kitchens | PF 58-60 (A, Darius); count C, the "thousand animals" claim NOT used |
| officials, secretaries, ushers | 320 | the camp | secretaries writing in the Tripylon and at the Gate; ushers at the Gate, forecourt and Apadana door; officials in the Tripylon, the Apadana and the court E of it; a midday meal sent from the king's table | IR-CHIL, APA-RELIEF (B); C |
| Persians of rank in attendance | 550 | the camp | on about 72 % of days in attendance in the Apadana, its portico, the forecourt and below its E stair; a meal at the king's table in the Hadish "apart from the king"; other days at the camp (horses, archery) | IR-COURT, ATH4-HERACL (B); C |
| petitioners and delegations | ~5 parties a day arriving (Poisson), 2-24 people (petitioners 1-3), staying 5-14 days (537 parties, ~4,000 people over the season, seed 1) | the camp | arrive by the road, wait on about 60 % of their days at the Gate and in the forecourt (queue, rest, talk, shade of the portico), and on one day are led up to the Apadana by an usher with their gifts; the audience itself out of sight | APA-RELIEF (B types), KING2022 (B pattern); timing C; **no procession is staged** (brief §2) |

Total 9,310 people with seed 1 (5,080 resident, ~4,230 visitors over the season).

## 3. Numbers against population.json (measured from the plans; `npx tsx tools/dev/court_count.ts`)
Terrace, court resident: w 5,000 by day (range 3,000-8,000), w 2,500 by night (1,500-4,000). With the court (seed 1):
see D-182 for the table by hour; at 10:00 4,150-4,680 (0.83-0.94 of w), at 02:00 2,294 (0.92 of w). The Terrace
without the court at 10:00: 677-957.

## 4. Conflicts and open questions (research/OPEN_QUESTIONS.md Q-330 to Q-336)
- Q-330 when the court arrives (E-25 on day 0 at 09:00 vs E-27's journeys to the king in months 12 and 1);
- Q-331 how many men the garrison quarters held (1,100 sleep there with the court);
- Q-332 where the royal kitchens were;
- Q-333 where the retinue lodged (the camp, and the town's +13,000 not simulated);
- Q-334 the "Harem": the name is Herzfeld's, the use debated; the royal women placed there;
- Q-335 the king's audience: where, how often, and whether the king should be shown (B9);
- Q-336 the guard's numbers: HDT 7.41's thousand is the army on the march, Heracleides' thousand is Artaxerxes II's
  court; 1,000-2,000 at Persepolis is population.json's C range; 1,000 used.
