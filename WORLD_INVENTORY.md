# WORLD_INVENTORY — what a real Persepolis and Marvdasht of 467 BCE would hold, and what the build lacks

Built from two independent gap hunts (session 9; MASTER_PLAN §7, T-J6, T-J7): hunter A worked from the HRAF Outline of Cultural
Materials and the natural world by kingdom (REVIEWS/gap_hunt_s9_A.md, ~190 rows), hunter B from the brief line by line, the
tablets' commodity and occupation lists, a traveller's walk at every hour band and season, and fauna by habitat
(REVIEWS/gap_hunt_s9_B.md, 239 rows). Neither saw the other's list or REVIEWS/gap_audit.md. Their PRESENT rows (≈ 80 and ≈ 107) are
in their reports; this file holds the GAPS (MISSING or PARTIAL), merged into one list, each with who found it. Session 10 added a
third, independent hunter C (REVIEWS/gap_hunt_s10_C.md, 188 rows, 112 gaps), working from the Elamite and Old Persian lexicon of
things, the Persepolis seal imagery, Neo-Babylonian household inventories and dowries, the body's day for five people, the built
fabric at arm's length and a walk of every area; C saw neither earlier list. C's row ids are appended to the rows it matched.

## The estimate (T-J6: unfound gaps ≤ 5 %) — FAILS

Session 10, three lists (hunter C added; the unit is a row of this file, so a hunter's several rows naming one gap count once):

- Gaps found by A: n_A = 138; by B: n_B = 138; by C: n_C = 89 (C's 112 gap rows: 55 existing rows matched, 34 new rows GC1-GC34).
- Pairwise overlaps: A∩B = 78, A∩C = 41, B∩C = 35; all three: 21. Distinct: 232.
- Cells (A B C, 1 = found): 100 = 40, 010 = 46, 001 = 34, 110 = 57, 101 = 20, 011 = 14, 111 = 21, 000 = unknown.
- Schnabel (A, then B, then C): N = Σ n_t·M_t / Σ m_t = (138·138 + 89·198) / (78 + 55) = 276; unfound 44 (**16 %**).
- Log-linear (Poisson on the seven cells; the unfound cell is exp(intercept)): the AIC-best model has the A×B interaction
  (deviance 1.5 on 2 df; the independence model's 12.1 on 3 df fits badly): N = 320, unfound 88 (**28 %**). The other models
  run from 12 % (A×C + B×C, a poor fit) to 33 %; independence gives 283 (18 %).
- Chapman pairwise: A,B 244; A,C 297; B,C 347. A and B overlap more than chance (both walked the fauna by kind and the weather),
  so the session-9 two-list figure was an underestimate; C, reading a different lexicon (tablets, seals, household inventories,
  the body's day), shares less with either.
- Verdict: the estimated unfound share is 16-28 % (headline: the AIC-best log-linear model, **28 %**), far above T-J6's 5 %. FAILS.
  The next hunt still needs new taxonomies, and C's new rows cluster in material culture (objects of the house, the body, the
  Treasury's stock) and the traces of use on the ground: that is where the unfound gaps most likely lie.
- Session 9 (two lists): n1 = 138, n2 = 138, m = 78, distinct 198; Lincoln–Petersen N = 244 (Chapman 244); unfound 46 (19 %).
- Of C's matches, these existing rows are already BUILT or FILLED (still counted as matches): G4, G12, G16, G20, G28, G30, GB51,
  GB53, GB54 (C read the code before or around those builds, or found the part still open: ice on water, the wild garlic month).
- The matching is the lead's (two rows that name the same thing count once); the grouping is coarse (a row can hold a few species).

## Fill order (the gaps whose absence most breaks the time capsule for a walker; T-J7)

1. villages as real places
2. river crossing
3. cattle herds
4. hunting
5. snowline
6. planets
7. quarrymen
8. fish and fishing
9. the smith at the forge
10. tanning
11. bees, bee-keeping
12. doves and rock doves
13. larks
14. storks
15. visible flies
16. lizards
17. human non-speech sounds
18. spring wildflowers
19. gazelle on the open plain
20. wild goat and wild sheep
21. red fox
22. hares
23. bats
24. tomb guardians
25. summer sleeping on the roofs
26. garlic, onions
27. pulses
28. the act of sealing
29. silver weighed on a balance
30. dates arriving

Already filled this session: the large predators and the onager (beasts.ts), lunar eclipse, meteors, rainbow (unrendered or partly rendered: sessions/s09.md).

## Gaps both hunters found (78)

| # | gap | found by (row ids) | category | tier of presence in 467 | status |
|---|---|---|---|---|---|
| G1 | river crossing: ford or bridge where the roads meet the Pulvar and the Kur | A061; B-022, W-014 | transport | C | BUILT (D-257: 51 fords on roads and tracks; the Pasargadae road redrawn off the river); unrendered |
| G2 | villages as real places (compounds are solid boxes; ovens, pens, courts, night light) | A072; B-023; C-D49 | settlement | C | MISSING/PARTIAL |
| G3 | snowline: snow on Kuh-e Rahmat and the Zagros skyline in winter | A401; B-031, W-053 | weather | B | BUILT (de548be: a seasonal snowline by month); render queued |
| G4 | frost, hoarfrost and ice at dawn (44 frost days) | A402; W-006, W-011; C-F31 | weather | A | BUILT (D-261: rime on the cold clear mornings, 58-66 a year); no ice on water; render queued |
| G5 | breath visible in the cold | A403; W-007 | weather | A physics | BUILT (D-267: people near and the walker; not the animals); unrendered |
| G6 | planets (Venus as morning and evening star, Jupiter, Saturn, Mars) | A404; W-004, W-035 | sky | A | BUILT (282daa6: the five planets at their places and magnitudes); rendered: Mercury and Venus 0.5 deg apart at dusk, positions verified |
| G7 | dust devils on the summer plain | A406; W-019 | weather | B | BUILT (D-265); render queued |
| G8 | heat shimmer and mirage | A407; W-018 | weather | A physics | PARTIAL (D-268: built opt-in ?heat=1, awaiting a render to verify) |
| G9 | hail in the spring thunderstorms | A408; W-044 | weather | A | PARTIAL (D-266: seen falling and lying; not heard); unrendered (no hail day in the test seed) |
| G10 | 22° halo and sun dogs | A409; N-004 | sky | A physics | BUILT (D-261: ring and parhelia on cirrus days); render queued |
| G11 | hunting: the royal and noble hunt | A001, A593; S-013; C-S05, C-S07, C-W38 | food quest | B claim | MISSING/PARTIAL |
| G12 | snaring and fowling | A002; P-064; C-S08 | food quest | C | BUILT (D-256: snare lines at the field edges, the bow at the waterfowl in the reeds, in the season's other work, autumn-winter); unrendered |
| G13 | fish and fishing in the rivers and canals | A003, A161; F-001, P-019, P-064 | food quest / fauna | C | BUILT (D-256: hand lines and wicker traps from the river or canal bank nearest the village; the catch carried home); unrendered |
| G14 | wild nut gathering on the slopes (Aug-Sep) | A004; W-052 | food quest | C | BUILT (D-256: wild pistachios and almonds gathered on the slopes in August-September); unrendered |
| G15 | bees, bee-keeping and honey | A006, A151; P-020, P-065 | food quest / fauna | C | BUILT (D-256: clay-pipe hives in the gardens, looked to in spring, the honey taken in late summer; the bees' buzz); unrendered |
| G16 | garlic, onions and named garden vegetables (the month Θāigraciš, 'garlic-collecting') | A007, A204, A207; FL-010; C-W39 | crops | A name / C | BUILT (D-259: garden plots of garlic, onions and leeks, 2 % of the irrigated plots, lifted in Θāigraciš); PARTIAL (D-256: wild garlic offered in the third month but never reached: the harvest takes every household, B81) |
| G17 | cattle herds: cows and calves (only work oxen exist) | A024; P-012, F-055 | husbandry | C | BUILT (D-256: cows and calves, the village herd by turns and the boys, milking at dawn and dusk, penned in the compounds at night); unrendered |
| G18 | domestic ducks and geese | A026; F-046 | husbandry | C | MISSING/PARTIAL |
| G19 | cavalry, horse lines and pastures in the default world | A033, A556; B-080; C-L13, C-L14, C-L46, C-S16 | armed forces | B/C | MISSING/PARTIAL |
| G20 | sesame-oil pressing, oil jars, lamp oil | A045; P-010; C-F26 | food processing | B/C | FILLED (D-255; open ground, not built: the press and the tannery) |
| G21 | salt: supply and trade | A054; P-021 | commodities | C | MISSING/PARTIAL |
| G22 | the garrison's rooms (B63) | A073; B-013 | settlement | B | MISSING/PARTIAL |
| G23 | summer sleeping on the roofs | A077; W-038; C-D16 | housing | C | MISSING/PARTIAL |
| G24 | latrines and cesspits | A078; S-003; C-D03 | housing | B analogy | MISSING/PARTIAL |
| G25 | lime burning, plastering and wall painting at work | A092; P-042; C-F24 | crafts | B/C | MISSING/PARTIAL |
| G26 | the smith at the forge (a lit forge with nobody at it); hammer, bellows, kiln roar | A095; B-037, SO-008, B-102 | crafts | B | FILLED (D-255) |
| G27 | goldsmiths forging and chasing | A096; P-039 | crafts | B | FILLED (D-255) |
| G28 | tanning and leatherwork (hides stop at a counter) | A098; B-056, P-014; C-L54, C-F26 | crafts | B | FILLED (D-255; open ground, not built: the press and the tannery) |
| G29 | seal cutting | A099; P-047 | crafts | A/C | FILLED (D-255) |
| G30 | quarrymen at Majdabad and Sivand; drums hauled across the plain | A505, A506; P-063, P-034, S-012; C-W40 | crafts / transport | B/C | BUILT (D-256: 14 quarrymen at Majdabad; each E-61 drum hauled 28 km on a sledge behind two yoke over two days; Sivand not built, B80 the huts); unrendered |
| G31 | signal fires and beacons | A522; W-037 | communication | C | MISSING/PARTIAL |
| G32 | adult board games (twenty squares) at the guard posts and doorsteps | A529; S-016; C-D42 | recreation | C | MISSING/PARTIAL |
| G33 | human non-speech sounds: babies crying, laughter, children shouting, calling to animals | A533; SO-005, SO-006 | sound | C | PARTIAL (D-260: laughter in company, children calling at play, babies crying; no calls to animals); unverified by ear |
| G34 | coughing and sickness sounds | A560; SO-007; C-D18 | sound | C | PARTIAL (D-270: coughs by season; no sick people); unverified by ear |
| G35 | tomb guardians and a tomb cult at Naqsh-e Rustam | A564; S-010 | religion | B analogy | MISSING/PARTIAL |
| G36 | gazelle on the open plain (not only the paradise) | A102; F-018 | fauna | B | BUILT (93f56ed: a goitered gazelle herd on the plain's best uncultivated flat); unrendered |
| G37 | red fox | A107; F-021 | fauna | B | BUILT (93f56ed: dusk to dawn at the field edges); unrendered |
| G38 | wild goat and wild sheep on Kuh-e Rahmat | A108; F-026, F-027 | fauna | B | BUILT (93f56ed: bezoar goats high, wild sheep lower on Kuh-e Rahmat); unrendered |
| G39 | hares | A109; F-012 | fauna | C | BUILT (93f56ed); unrendered |
| G40 | hedgehog and porcupine | A110; F-025, F-032; C-W19 | fauna | C | MISSING/PARTIAL |
| G41 | rats and mice at the stores | A111; B-049, F-042; C-W16 | fauna | B | MISSING/PARTIAL |
| G42 | bats at dusk | A112; W-025 | fauna | B | BUILT (D-258: pipistrelles over the courts and the water from 20 min after sunset, Mar-Oct); unrendered |
| G43 | small rodents of the steppe (jirds, gerbils, jerboas) | A113; F-013 | fauna | C | PARTIAL (D-263: jirds at their burrows at dawn and dusk; no jerboas); unrendered |
| G44 | small wild cats and carnivores (jungle cat, wildcat, badger, marten) | A115; F-009; C-W17, C-W18 | fauna | B | MISSING/PARTIAL |
| G45 | partridges seen, flushing on the slope | A124; F-029, W-009 | birds | B | BUILT (D-262: coveys on the slope, flushing together); unrendered |
| G46 | hoopoe, bee-eater and roller seen | A125, A139; W-048, F-050 | birds | B/C | BUILT (D-262 hoopoe, bee-eater; D-269 roller); unrendered |
| G47 | owls seen | A126; W-031 | birds | C | PARTIAL (D-269: the little owl seen; scops owls only heard) |
| G48 | doves and rock doves | A127; F-030 | birds | C | BUILT (a8b1f4d: doves in the courts, flushing); unrendered |
| G49 | larks over fields and steppe | A128; F-014 | birds | C | BUILT (a8b1f4d: song flight over fields in spring); unrendered |
| G50 | white storks | A129; F-016, W-015 | birds | C | BUILT (a8b1f4d: walking the wet ground in spring and summer); unrendered |
| G51 | cranes, geese and ducks in winter and on migration | A130; W-043, W-056, SO-012 | birds | B | BUILT (a8b1f4d cranes; D-269 wintering ducks; no geese); unrendered |
| G52 | herons and egrets | A131; F-004 | birds | C | BUILT (D-262: grey heron, little egret); unrendered |
| G53 | vultures | A132; W-022, F-048 | birds | B | BUILT (a8b1f4d: griffon vultures soaring over Kuh-e Rahmat); unrendered |
| G54 | nightingale and bulbul in the gardens | A134; W-033 | birds | C | PARTIAL (D-269: bulbuls seen; nightingales only heard) |
| G55 | choughs, jackdaws and ravens | A135; F-049 | birds | C | BUILT (D-262: a jackdaw and chough flock over the cliff); unrendered |
| G56 | magpies | A136; problems #6 | birds | C | BUILT (D-262); unrendered |
| G57 | sandgrouse and bustard | A138; F-024 | birds | C | PARTIAL (D-262: sandgrouse flights at dawn; no bustard); unrendered |
| G58 | wheatears | A140; F-031 | birds | C | BUILT (D-262); unrendered |
| G59 | lizards (agamas) | A150; F-023 | reptiles | C | BUILT (D-258: rock agamas basking and dashing on rock, slipping away at 3 m); below render resolution, verified by test |
| G60 | butterflies | A152; B-047 | insects | C | BUILT (D-258: whites, clouded yellows, painted ladies over fields and steppe, Mar-Jun and Sep-Oct); unrendered |
| G61 | dragonflies and mosquitoes at the water | A153, A164; F-006; C-W24 | insects | C | PARTIAL (D-258: dragonflies at the water's edge May-Sep; no mosquitoes) |
| G62 | visible flies at dung and middens | A154; B-047 | insects | C | BUILT (D-258: house flies at the town's middens Apr-Oct); below render resolution, verified by test |
| G63 | geckos on the walls at night | A156; F-043 | reptiles | C | MISSING/PARTIAL |
| G64 | tortoise | A157; F-022 | reptiles | B | BUILT (D-263); unrendered |
| G65 | snakes | A158; F-023 | reptiles | C | BUILT (D-263: rare); unrendered |
| G66 | scorpions | A159; F-023; C-W25 | invertebrates | C | MISSING/PARTIAL |
| G67 | frogs seen | A160; F-011 | amphibians | C | BUILT (D-263: seen as well as heard); unrendered |
| G68 | a locust year | A167; W-047; C-W26 | events | C | MISSING/PARTIAL |
| G69 | walnut | A171; FL-006; C-W34 | trees | C | MISSING/PARTIAL |
| G70 | juniper | A173; FL-007 | trees | C | MISSING/PARTIAL |
| G71 | spring wildflowers (tulips, poppies, irises, crown imperial) | A220; W-039 | flora | B/C | BUILT (D-258: bloom tint far, flower heads near, by the calendar); unrendered |
| G72 | tragacanth and thorn cushions, camelthorn, thistles | A221, A223; FL-008 | flora | B | BUILT (D-264: near the walker; the far slopes keep the terrain's painted shrubs); unrendered |
| G73 | roses in the paradise | A226; FL-016 | flora | C | BUILT (D-272: along the axis channel); unrendered |
| G74 | pulses (lentil, chickpea, vetch, pea, broad bean) | A201; FL-011 | crops | C | BUILT (D-259: 7 % of the irrigated plots; not on the rain-fed land); unrendered |
| G75 | flax | A202; FL-013 | crops | C | BUILT (D-271: 1 % of irrigated plots; no blue flowers drawn); unrendered |
| G76 | melons, cucumbers and gourds | A205; FL-012 | crops | C | MISSING/PARTIAL |
| G77 | timber arriving for the roofs | A508; P-033 | commodities | B | BUILT (D-273: ox-cart trains of beams to the drum ground in the dry months); unrendered |
| G78 | large predators and the onager (built this session: beasts.ts, cf3165e; unrendered) | A104, A106; W-029, F-008, F-019, F-020, F-028, F-033, F-034 | fauna | B | BUILT (s9, unrendered) |

## Gaps only hunter A found (60)

| # | gap | found by (row ids) | category | tier of presence in 467 | status |
|---|---|---|---|---|---|
| GA1 | acorn, wild green and herb gathering | A005 | food quest | C | BUILT (D-256: acorns on the slopes in the autumn; wild greens and herbs not) |
| GA2 | domestic cat (A: missing; B: uncertain) | A028; C-W20 | husbandry | C | MISSING/PARTIAL |
| GA3 | alfalfa ('Median grass') fodder fields | A031, A206 | crops | B claim | BUILT (D-271: 2 % of irrigated plots, cut monthly in summer); unrendered |
| GA4 | animal branding and marking | A034 | husbandry | C | MISSING/PARTIAL |
| GA5 | cheese making and drying | A047 | food processing | C | MISSING/PARTIAL |
| GA6 | fruit drying on roofs and mats | A048 | food processing | C | MISSING/PARTIAL |
| GA7 | elite symposium drinking | A053; C-L03, C-S09, C-D28 | drink | B claim | PARTIAL (D-283: the rations drunk in company in the lanes and on visits; the elite symposium not built) |
| GA8 | barefoot poor and children | A065 | dress | C | MISSING/PARTIAL |
| GA9 | mourning dress and signs | A066; C-D27 | death | B claim | MISSING/PARTIAL |
| GA10 | tattooing (Thracians) | A067 | adornment | B claim | MISSING/PARTIAL |
| GA11 | fly-whisks and parasols among the elite (partial) | A068 | adornment | A | MISSING/PARTIAL |
| GA12 | transhumant bands' black tents and the band on the road | A021, A074 | settlement | C | MISSING/PARTIAL |
| GA13 | shaduf water lifting | A081; C-W37 | irrigation | C | MISSING/PARTIAL |
| GA14 | the scribes' lamp lit | A086 | housing | C | MISSING/PARTIAL |
| GA15 | the town's lights at dusk (partial, B49) | A087 | housing | C | MISSING/PARTIAL |
| GA16 | scarecrows (partial) | A089 | farming | C | MISSING/PARTIAL |
| GA17 | furniture in the town interiors (partial) | A085; C-H01, C-H02, C-H03, C-H04 | housing | C | MISSING/PARTIAL |
| GA18 | charcoal burning | A091 | crafts | C | MISSING/PARTIAL |
| GA19 | carpentry at work (partial) | A097 | crafts | B | MISSING/PARTIAL |
| GA20 | rope and basket making (partial) | A500; C-L19, C-L20 | crafts | C | MISSING/PARTIAL |
| GA21 | felt making | A501; C-L18 | crafts | C | MISSING/PARTIAL |
| GA22 | threshing sledge | A509; C-W36 | farming | B analogy | MISSING/PARTIAL |
| GA23 | boats or rafts at the crossings | A519 | transport | C | BUILT (D-257: a hide boat at each Kur ford); unrendered, never used |
| GA24 | road traffic to Pasargadae and Naqsh-e Rustam (partial) | A520 | transport | C | MISSING/PARTIAL |
| GA25 | field boundary marks | A523 | land | C | MISSING/PARTIAL |
| GA26 | dance at weddings and festivals | A525; C-D43 | arts | B claim | MISSING/PARTIAL |
| GA27 | recitation of heroes' songs to the young | A527; C-D31 | arts | B claim | MISSING/PARTIAL |
| GA28 | wrestling, races, riding contests | A530 | recreation | C | MISSING/PARTIAL |
| GA29 | lullabies and lament | A534, A562; C-D30 | sound | C | MISSING/PARTIAL |
| GA30 | Aramaic leather with writing (partial) | A536 | records | B | MISSING/PARTIAL |
| GA31 | polygyny and concubinage | A540 | family | B claim | MISSING/PARTIAL |
| GA32 | divorce, widow remarriage, fostering | A541 | family | C | MISSING/PARTIAL |
| GA33 | village headman and elders | A543 | community | C | MISSING/PARTIAL |
| GA34 | theft and guarding against it (partial) | A552 | law | C | MISSING/PARTIAL |
| GA35 | the armoury (partial) | A555; C-H33 | armed forces | A | MISSING/PARTIAL |
| GA36 | court physicians (partial) | A558; C-L48 | health | B | MISSING/PARTIAL |
| GA37 | visible disability: the blind and the lame | A559 | health | C | MISSING/PARTIAL |
| GA38 | magi killing noxious creatures | A567; C-D44 | religion | B claim | MISSING/PARTIAL |
| GA39 | morning prayer to the sun | A571; C-D32 | religion | C | MISSING/PARTIAL |
| GA40 | toddlers walking on their own | A578 | childhood | C | MISSING/PARTIAL |
| GA41 | the wolf-killing month (*Vṛkazana) and its act | A105 | calendar | A name / C | MISSING/PARTIAL |
| GA42 | Persian squirrel | A114 | fauna | C | MISSING/PARTIAL |
| GA43 | delegation beasts drawn (lioness, okapi, ibex) | A117 | fauna | B | MISSING/PARTIAL |
| GA44 | kestrels | A133 | birds | C | BUILT (D-287: hovering over the fields); unrendered |
| GA45 | winter starlings | A137 | birds | C | BUILT (D-286: a dusk murmuration over the Pulvar's reeds, Nov-Feb); render queued |
| GA46 | ants | A155; C-W23 | insects | C | MISSING/PARTIAL |
| GA47 | freshwater crab | A162 | invertebrates | C | MISSING/PARTIAL |
| GA48 | snails after rain | A163 | invertebrates | C | MISSING/PARTIAL |
| GA49 | moths at the lamps | A165 | insects | C | MISSING/PARTIAL |
| GA50 | cicadas and crickets seen (partial) | A166 | insects | C | MISSING/PARTIAL |
| GA51 | spiders and webs | A168; C-F28 | invertebrates | C | MISSING/PARTIAL |
| GA52 | the oak woodland's companion trees (wild pear, hawthorn, Celtis, maple, Pistacia khinjuk) | A172 | trees | C | MISSING/PARTIAL |
| GA53 | quince, plum, apricot | A174; C-W34 | trees | C | MISSING/PARTIAL |
| GA54 | jujube | A175 | trees | C | MISSING/PARTIAL |
| GA55 | giant fennel on the slopes | A222 | flora | C | MISSING/PARTIAL |
| GA56 | crop-field weeds | A225 | flora | C | MISSING/PARTIAL |
| GA57 | millet | A203 | crops | C | MISSING/PARTIAL |
| GA58 | a military review or muster | A594 | armed forces | C | MISSING/PARTIAL |
| GA59 | chance events: house fire, flood, earthquake, epidemic | A595; C-W28, C-W29, C-W30 | events | C | MISSING/PARTIAL |
| GA60 | the mill building (B63) | A042; C-F25 | food processing | B | MISSING/PARTIAL |

## Gaps only hunter B found (60)

| # | gap | found by (row ids) | category | tier of presence in 467 | status |
|---|---|---|---|---|---|
| GB1 | zodiacal light | W-005 | sky | A physics | MISSING/PARTIAL |
| GB2 | dew on grass and crops | W-016; C-F32 | weather | A physics | MISSING/PARTIAL |
| GB3 | the comet of 467/466 (Pliny NH 2.149; recollection) | N-005 | sky | C | MISSING/PARTIAL |
| GB4 | the act of sealing (rolling a seal) | B-009 | records | B | FILLED (D-255) |
| GB5 | the Hadish apartments furnished | B-014 | settlement | C | MISSING/PARTIAL |
| GB6 | storerooms showing their actual stock | B-015; C-H31, C-H32 | economy | C | MISSING/PARTIAL |
| GB7 | run-off streams in the lanes and the mountain gullies after rain | B-044, N-009 | water | C | MISSING/PARTIAL |
| GB8 | spilled grain | B-055 | traces | C | MISSING/PARTIAL |
| GB9 | dye works (partial) | B-057 | crafts | C | MISSING/PARTIAL |
| GB10 | litters for nobles and royal women | B-061 | transport | C | MISSING/PARTIAL |
| GB11 | dates arriving by pack train | B-066, P-008; C-L07 | commodities | B | MISSING/PARTIAL |
| GB12 | pregnancy visible | B-075; C-D09 | people | C | MISSING/PARTIAL |
| GB13 | silver weighed on a balance (performed as `inspect`: a detector escape) | B-095, P-022 | economy | B | FILLED (D-255) |
| GB14 | writing boards and the scribe's kit | B-099 | records | C | MISSING/PARTIAL |
| GB15 | rain on timber and cloth heard | B-103 | sound | C | MISSING/PARTIAL |
| GB16 | barley loaves issued by the state bakery (partial) | P-004 | commodities | A | MISSING/PARTIAL |
| GB17 | milking performed | P-016 | husbandry | C | MISSING/PARTIAL |
| GB18 | eggs | P-018 | commodities | C | MISSING/PARTIAL |
| GB19 | textiles and garments issued | P-024 | commodities | B | MISSING/PARTIAL |
| GB20 | tools issued and stored | P-025 | commodities | C | MISSING/PARTIAL |
| GB21 | potters shaping pots (partial) | P-044; C-L21 | crafts | B | MISSING/PARTIAL |
| GB22 | relief sculptors carving (partial) | P-043; C-F23 | crafts | C | MISSING/PARTIAL |
| GB23 | bone workers (partial) | P-046; C-L55 | crafts | B | MISSING/PARTIAL |
| GB24 | stone-vessel makers | P-048 | crafts | C | MISSING/PARTIAL |
| GB25 | guides of travelling parties (partial) | P-053 | transport | B | MISSING/PARTIAL |
| GB26 | interpreters | P-060 | administration | B analogy | MISSING/PARTIAL |
| GB27 | accountants with a counting board (partial) | P-061 | administration | C | MISSING/PARTIAL |
| GB28 | merchants and traders (partial) | P-066 | exchange | C | MISSING/PARTIAL |
| GB29 | swifts screaming over the Terrace (partial) | W-026 | birds | C | BUILT (D-280: screaming parties round the halls at dusk, heard within 90 m); unrendered |
| GB30 | the Belt of Venus in its colour (partial, B44) | W-027 | sky | A | MISSING/PARTIAL |
| GB31 | nightjar | W-032 | birds | C | MISSING/PARTIAL |
| GB32 | mountain springs and seeps | N-010 | water | C | MISSING/PARTIAL |
| GB33 | salt crusts and playas toward the lakes | N-014 | landscape | C | MISSING/PARTIAL |
| GB34 | limestone outcrops and scree texture (partial, B57) | N-012 | landscape | A | MISSING/PARTIAL |
| GB35 | crepuscular rays unverified (partial) | N-007 | sky | C | MISSING/PARTIAL |
| GB36 | otter | F-002 | fauna | B | MISSING/PARTIAL |
| GB37 | Caspian turtle | F-003 | reptiles | B | MISSING/PARTIAL |
| GB38 | kingfisher | F-005 | birds | C | MISSING/PARTIAL |
| GB39 | reed warblers | F-010 | birds | C | MISSING/PARTIAL |
| GB40 | quail | F-015 | birds | C | MISSING/PARTIAL |
| GB41 | rooks and crows in the winter fields (partial) | F-017 | birds | C | MISSING/PARTIAL |
| GB42 | swallows nesting under the eaves (partial) | F-040; C-F15, C-W21 | birds | C | MISSING/PARTIAL |
| GB43 | fleas and lice (scratching) | F-044; C-D06 | people | C | MISSING/PARTIAL |
| GB44 | trot and gallop (every animal walks; a courier never hurries) | F-056 | animals | C | MISSING/PARTIAL |
| GB45 | lotus and water lilies in the pools | FL-017 | flora | C | MISSING/PARTIAL |
| GB46 | a bath or washing room in elite houses | S-004; C-D05 | housing | C | MISSING/PARTIAL |
| GB47 | a scribal school | S-005 | education | C | MISSING/PARTIAL |
| GB48 | household cults of the foreign workers (Q-471) | S-009 | religion | C | MISSING/PARTIAL |
| GB49 | workmen at the Xerxes façade at Naqsh-e Rustam | S-011 | construction | C | MISSING/PARTIAL |
| GB50 | the Persian washing rule (Hdt 1.138) contradicted by garrison laundry in the river | S-017; C-D46, C-D47 | religion / consistency | B claim | MISSING/PARTIAL |
| GB51 | horses whinnying and snorting | SO-001; C-W01 | sound | C | BUILT (D-282); not heard in a browser |
| GB52 | cattle lowing | SO-002 | sound | C | BUILT (D-256: the herds' lowing, a new strike; the compounds' cows at night) |
| GB53 | camels grumbling | SO-003; C-W02 | sound | C | BUILT (D-282); not heard in a browser |
| GB54 | hooves, cart wheels and harness on the road | SO-004; C-W01, C-W12 | sound | C | BUILT (D-282); not heard in a browser |
| GB55 | door pivots and bolts heard | SO-009 | sound | C | MISSING/PARTIAL |
| GB56 | a crowd bed beyond 60 m (a court assembly heard from afar) | SO-011 | sound | C | BUILT (D-281: a distant murmur by direction, 60-400 m); not heard in a browser |
| GB57 | a roof reached: stairs to the Apadana towers | W-058 | architecture | B | MISSING/PARTIAL |
| GB58 | goods in the lanes: a place of exchange (partial) | S-002 | exchange | C | MISSING/PARTIAL |
| GB59 | drainage filth in the lanes (partial) | B-054 | traces | C | MISSING/PARTIAL |
| GB60 | snow in the default year (seed 1 has no snow day) | B-032 | weather | A climate | MISSING/PARTIAL |

## Gaps only hunter C found (session 10) (34)

| # | gap | found by (row ids) | category | tier of presence in 467 | status |
|---|---|---|---|---|---|
| GC1 | beads of lapis lazuli and carnelian (DSf kāsaka) and bead-making | C-L28 | commodities | A word / B objects | MISSING |
| GC2 | ivory: Treasury pieces, furniture inlay (DSf) | C-L29 | commodities | A word / B objects | MISSING |
| GC3 | glass vessels (Achaemenid cut glass) in the Treasury | C-L30 | commodities | B | MISSING |
| GC4 | bitumen: jar sealing, waterproofing, basket linings | C-L31 | commodities | B | MISSING |
| GC5 | measuring vessels: the QA/BAR grain measure at every issue, the marriš wine jar | C-L38, C-L39 | measures | A units / C form | MISSING |
| GC6 | shaving and trimming beards; barbers | C-L50, C-D07 | people | C | MISSING |
| GC7 | bow and arrow makers (fletchers) | C-L53 | crafts | B/C | MISSING |
| GC8 | personal seals: thousands of designs (only two exist), seals worn on a cord at the wrist or neck | C-S02, C-S03 | records | A diversity / B wearing | MISSING/PARTIAL |
| GC9 | camel riders (only led strings) | C-S17 | transport | A word / C | MISSING |
| GC10 | copper or bronze cauldron and kettle at the hearth | C-H05 | housing | B analogy | MISSING |
| GC11 | braziers in town houses in winter | C-H06 | housing | B analogy | MISSING |
| GC12 | toilet articles: bronze mirror, kohl tube and stick, oil flask for anointing | C-H08, C-H09, C-H10 | adornment | B analogy | MISSING |
| GC13 | everyday household goods set out in rooms: tableware, garments on pegs | C-H15, C-H19 | housing | B/C | PARTIAL |
| GC14 | anklets and necklaces for ordinary women | C-H21 | adornment | B analogy | MISSING |
| GC15 | terracotta figurines (horse and rider) and household objects of devotion | C-H25 | religion | B | MISSING |
| GC16 | door bolt, lock and key | C-H26 | housing | B analogy | PARTIAL |
| GC17 | private tablets and records in a scribe's house | C-H27 | records | B analogy | PARTIAL |
| GC18 | shoulder yoke for two jars or baskets | C-H28 | transport | B | MISSING |
| GC19 | waterskin; butter-churning skin on a tripod | C-H29 | food processing | C | MISSING |
| GC20 | washing face and hands | C-D04 | people | C | MISSING |
| GC21 | menstrual seclusion (uncertain: Vendidad date disputed) | C-D11 | people | C | MISSING |
| GC22 | stripping to the waist in the heat at harvest or building | C-D13 | dress | C | MISSING |
| GC23 | injuries and accidents: a cut, a fall, a kick | C-D19 | health | C | MISSING |
| GC24 | courtship before the wedding | C-D23 | family | C | MISSING |
| GC25 | a quarrel coming to blows, pulled apart | C-D25 | law | C | MISSING |
| GC26 | banking the hearth at night (partial) | C-D33 | housing | C | PARTIAL |
| GC27 | the herd boy's sling for turning the flock or scaring wolves | C-D38 | husbandry | C | MISSING |
| GC28 | Persian boys' riding lessons (Hdt 1.136; archery only; partial) | C-D41 | childhood | B claim | PARTIAL |
| GC29 | animal droppings on the royal road, the lanes and the stair foot | C-F08 | traces | C | PARTIAL (D-284: the roads and the halts; not the lanes); render queued |
| GC30 | sherd and litter scatter and household ash by the doors (partial) | C-F09, C-F10 | traces | C | PARTIAL (D-284: sherds on the roads; not the lanes, no ash) |
| GC31 | footprints and hoofprints in mud after rain | C-F14 | traces | C | MISSING |
| GC32 | door sealings (clay on a peg) on the town's store doors (partial) | C-F27 | records | A | PARTIAL |
| GC33 | the king's chariot or horse on the road (partial, B71) | C-W41 | court | B | PARTIAL |
| GC34 | court tents being pitched (partial, B70) | C-W42 | court | C | PARTIAL |

## Absent by evidence (kept out; from both reports)

Qanats (Q-052 conflict with Polybius 10.28 logged), coinage in daily use, a marketplace (Hdt 1.153 claim), rice (Q-013), cotton, date palms on the plain (frost), the later rock tombs of Kuh-e Rahmat, punishment shown (policy, brief §12), pigs (weak: to be argued in a row), the brown bear within the world's reach (high Zagros only).
