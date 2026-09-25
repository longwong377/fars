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
- **D-199 filled four gaps, all reconstructions, none seen in a browser** (section 5): the delegations' dress (the
  Apadana reliefs: form B, colours C; the identifications and every detail are **recollections of Walser 1966 and Schmidt
  1953, NOT SEEN**, to be verified against the plates); the king as a person (B9, Q-335: C presence, B dress); the camps'
  tents (C); the retinue in the town and on the plain (Q-333: C).
- **Placeholders still:** the golden/silver apple butts are the ordinary spear prop; the women's night music (Heracleides)
  is not performed; the delegations' animals, chariots and carried lioness, and some peoples' mantles, shawls and tassels
  are not modelled (delegations.json notes); the king's bearers walk their own routes at his hour, not locked in step
  behind him; the paths through the camps are straight lines.
- **Not done:** the court's food does not draw on the calendar's stores (calendar.ts, another workstream); the retinue's
  animals (horses, mules, camels) are tended but not drawn beyond what `tend_animals` shows.

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
day 30 by hour 00 2,294 · 06 3,198 · 08 4,385 · 10 4,448 · 12 4,255 · 14 3,652 · 16 3,229 · 18 2,788 · 20 2,427 ·
22 2,096; at 10:00 on days 0 / 60 / 100 4,149 / 4,584 / 4,680 (0.83-0.94 of w); at 02:00 2,295 (0.92 of w). The Terrace
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

## 5. D-199: the delegations' dress, the king, the camps' tents, the retinue (court setting only)
**Read first.** Nothing here was rendered in a browser; every count is C; the identifications of the delegations and
every detail of their dress are recollections of Walser 1966 (WALSER1966) and of Schmidt 1953's plates (SCHMIDT1953),
**NOT SEEN** this session: verify against the plates before raising any row.

### 5a. The 23 delegations (`src/data/delegations.json`; looks.ts `lookFor` with `delegation`)
Walser's numbering of the E stair (recollection). Costumes: `envoy` = long sleeved garment to the ankle, girt;
`envoy_short` = knee-length sleeved tunic, girt; `envoy_bare` = wrap to the knee, bare above; `median` = the Median riding
dress; outfits.ts COSTUMES. New pieces: `cap_pointed` (the Saka's tall pointed cap, B), `cap_low` (a low rounded cap, C).
Colours from the D-189 natural dyes (C). Gifts carried as the prop system allows (bowl, jar, cloth, basket, sack, spear);
the animals and chariots are not shown.

| relief | people | dress (B form unless noted) | gifts carried |
|---|---|---|---|
| I | Medes | Median dress: soft cap, tunic, trousers, boots, akinakes | jug, bowls, a set of clothes |
| II | Elamites | long girt garment (close to the Persian robe: C), fillet | bows, daggers (bundle) |
| III | Armenians | Median-type dress | the griffin-handled amphora |
| IV | Arians | Median-type dress, the cap's chin wrap not modelled | bowls, a skin |
| V | Babylonians | long garment, low conical cap (tassel and shawl not modelled: C) | cups, cloth |
| VI | Lydians | long garment (mantle not modelled), cap drawn low (C) | amphorae, bowls, armlets |
| VII | Arachosians | Median-type dress (C: the cap is read by some as a headcloth) | vessels, a skin |
| VIII | Assyrians/Syrians | long garment, band round the hair (C) | cloth, bowls |
| IX | Cappadocians | Median-type dress, the shoulder-pinned mantle drawn as the kandys (C) | a set of clothes |
| X | Egyptians | the row is largely lost: a long linen garment, shaven (C) | calcite vessels, linen (Treasury finds stand in: C) |
| XI | Scythians (Sakā tigraxaudā) | tall pointed cap, knee tunic, trousers, boots, akinakes | armlets, clothes |
| XII | Ionians | long tunic (mantle not modelled), bareheaded | cloth, bowls, skeins of wool |
| XIII | Bactrians | knee tunic, trousers, boots, band round the hair | bowls |
| XIV | Gandharans | short tunic (cloak not modelled), band round the hair | spears, a shield (bundle) |
| XV | Parthians | Median-type dress | vessels |
| XVI | Sagartians | Median-type riding dress | clothes |
| XVII | Sogdians (disputed: a second Saka group; Q-370) | Median-type dress, akinakes | axes and swords (bundle) |
| XVIII | Indians | bare above the waist, wrap to the knee, band round the hair | baskets (the yoke not modelled), a jar |
| XIX | Thracians (Skudra) | tunic, boots, low cap (HDT 7.75: fox-skin caps, B claim; cloak not modelled) | spears, a shield |
| XX | Arabs | long girt garment (HDT 7.69, B claim), band round the hair | cloth |
| XXI | Cilicians (disputed: Walser's Drangianians; Q-370) | knee tunic, low cap (C) | bowls, cloth |
| XXII | Libyans | long garment (drawn closed, C), bareheaded | a spear |
| XXIII | Kushites | long wrapped garment, short hair | a tusk (on the shoulder), a lidded jar |

Parties of petitioners and delegations are now of these 23 peoples (court.json visitors.origins); a party's gift is its
people's; the men wear their people's dress, the women the woman's dress (no evidence for them: C). The far impostors use
the nearest silhouette's row (long garment: the woman's; knee tunic: the Median; bare: the working man's).

### 5b. The king (court.json `king`; court.ts `kingDay`, `bearerDay`, `escortDay`)
| what | how | tier |
|---|---|---|
| presence | only with the setting: nothing places Xerxes at Persepolis in 467 (Q-005) | C |
| dress | the Persian robe in purple (or red), the tall crown with a dentate rim, the long squared beard, the staff in the right hand and the lotus in the left | B (reliefs: HADISH-JAMB, TREAS-AUD, IR-CLOTH); crown's rim, colours, sizes C |
| his day | inside the Hadish, not drawn (a hidden place: popgeo.ts), except on audience mornings (41-44 % of resident days: 52 of 117 with seed 1): from about 08:30 he walks to the Apadana (royal_walk), sits enthroned on the throne with a footstool for about two hours (enthroned; the throne fitted to the pose on the rig: seat 0.52-0.53 m, soles 0.10-0.11 m on the bodies his look can take), and walks back | B for the audience scene and the throne; the hall (the Hall of 100 Columns is a building site in 467), the frequency and the hours C |
| attendants | a parasol bearer and a fly-whisk and towel bearer (beardless, Persian robe, fillet) walk behind him and stand by the throne | B (door jambs; Treasury relief: the towel bearer behind the throne) |
| escort | four spearmen (Persian and Median dress) walk before him and stand by the throne | C (Xenophon Cyr. 8.3, a claim about Cyrus: B) |
| audiences | each party is led before him on one of his audience mornings within its stay (531 of 537 with seed 1; 6 had none): queue in the hall, stand before the throne, the gifts presented | B for the usher leading each party (reliefs); C for the procedure |
| restraint | no procession is staged, he never speaks or reacts, he is never placed for the visitor; the visitor may not enter the Apadana or the Hadish (access.json: closed) | brief 1.1, 2 |

### 5c. The camps' tents (court.json `camps`; camps.ts; world/courtCamps.ts)
Eight camps: the court's own below the Terrace, four of the retinue in the town (N, W, NW, SW of Persepolis West) and three
on the plain (the horse lines toward the river, the supply trains by the royal road W, the soldiers S). A household of ten
lodges in a tent: ridge tents of undyed wool or linen (the servants, the table, the soldiers, the followers), black
goat-hair tents (porters, butchers, grooms, baggage, herdsmen, supply trains), larger peaked tents of dyed cloth (nobles,
officials); the parties' tents reused as parties come and go. 1,946 tents with seed 1 sleeping up to 21,182. Laid out in
lines facing the camp's axis, 3 m apart, 6 m lanes; checked against the built world (campCheck.ts): no tent on a town
plot, tree, prop, road or water piece, a canal, a river or in a village, none over another, the ground under each within
2.1 % of level. The retinue's camps stand on fields in the D-190 land use: with the setting their discs are trodden, not
tilled (townGround.ts `camps`: a camp pitched on fallow ground, C). People asleep, ill or resting in the dark are inside
their tent (not drawn); the others stand before its door. Every form, size and place C (Q-333).

### 5d. The retinue (court.json `retinue`; court.ts `retinueDay`)
| group | n | zone and camp | the day (C) |
|---|---|---|---|
| servants of the Persians of rank | 3,900 | town (the four camps) | sweeping out the tents, water, washing, mending, kneading, now and then flour from the royal stores, the evening meal cooked |
| grooms | 2,300 | town | the horse lines, fodder, bridles |
| muleteers, camel drivers, carters | 2,100 | town | the baggage animals, pack saddles, loads from the royal stores |
| craftsmen and sellers following the court | 1,900 | town | the camp's benches, trading |
| soldiers quartered in the town | 1,300 | town | drill at the mark, the camp's watch, gear |
| herdsmen of the royal herds | 1,800 | plain (horse lines) | the horses at pasture and the mules |
| drivers of the supply trains | 1,600 | plain (royal road) | the pack animals, sacks, loads to the royal stores |
| soldiers camped on the plain | 1,600 | plain (S) | drill, the watch, gear |

Measured (seed 1, plans; tests/court_fill.test.ts): town at 02:00 21,270 / 21,677 (days 30 / 90; w 20,000, range
13,000-30,000), at 10:30 18,588 / 18,561; plain 41,136-41,311 (w 42,000, range 33,000-49,000); the Terrace unchanged
(4,912 at 10:30 on day 30). The whole court 25,817 people (9,310 before). They arrive with the court (day 0) and leave on
its leave day (E-26), striking the tents. The year soak with the court (`npx tsx tools/soak.ts 354 60 1 --court`, 76,238 people) passes all 8 gates (D-199).

## 6. D-221: the court as an assembly (rubric s7 pass 2 item 7; court setting only)
The pass-2 renders showed the forecourt as a fair: people spread at random, no files, no waiting parties, no focus. The
causes, measured in node (`tests/lib/court_order.ts`, `tools/dev/court_order.ts`): the 21 stretches of ten posts were
strung out along their lines 1.5-3.8 m apart, and a guard who reached his post after someone else stood there was stepped
aside (popview `separate`); petitioners and delegates each took a random spot of the forecourt's span with a random
heading, and talked with other parties. What changed (every place, spacing and hour C; the form from the reliefs, B):
- **Files.** The posts of a line stand `day.file_spacing_m` (1.0 m) apart, centred on the line; a post is held where it
  stands (`Spot.fixed`), and everyone spread over a place keeps 0.8 m off the posts. The Gate's S file stands along the W
  wall, clear of the way to the S door.
- **Parties at their places.** On each day `CourtResidents.dayOrder` gives the parties that go up a place of their own in
  the forecourt before the Apadana's N stair (`visitors.waiting`: 25 places W and E of the way between the files, blocks of
  five abreast 0.9 m apart and rows 1 m deep; petitioners in lines of 31 on the E side), those called that morning nearest
  the stair in the order they came. A party goes up on a day without its audience with a chance of 0.4 (was 0.6), and only
  while a place is free; the rest wait at the camp. At the Gate a party stands together at one of three places.
- **Turns and ushers.** The called parties go before the king one after another (at most a quarter of an hour each while
  he sits), led up from the forecourt 0.3 h (at most 2.5 turns) before their turn into a block in the hall between the
  columns, then before the throne. One usher on duty to each (the reliefs' usher who leads each delegation by the hand, B):
  at the party's head in the forecourt from 0.75 h before, with it in the hall and before the king.
- **Focus.** Those waiting at a court place face what they wait on (`court.ts FOCUS`): the N stair from the forecourt, the
  E stair from the court below it, the hall's N door from the portico, the throne in the hall (±15° for those spread over
  a place, ±6° in the blocks).
- **After the first render (day 32, 09:30):** the frame still read as a crowd: in its view cone (node) 51 off-duty guards
  and 51 nobles stood talking at random spots facing anywhere, and palace servants swept the forecourt among the parties.
  Now talk in the forecourt is in knots of a few round 20 centres clear of the way and the parties' places, each facing
  the knot's centre; the forecourt, the Gate, the Apadana and its portico are swept before 07:30-08:05 and after
  15:35-16:10, not while the court waits.
Measured (seed 1; the same metric): guards ordered (nearest file-mate 0.8-1.3 m, within 10° of the line's heading, on the
post) 0.5 % → 87-100 % (the rest are the end men of files with a neighbour away at his meal); members within 3 m of their
party's centroid 8.6 % → 100 %; mean cosine to the focus 0.009 → 0.995. Tests: `tests/court_order.test.ts`. Open: Q-510
to Q-512. Not done: the delegations' animals are still not drawn in the forecourt (they stay at the camp); the hand held
between usher and leader is not posed.
