# Gap hunter C, session 10: report

**Scope and method.** I read code and data only: src/, src/data/*.json, research/*.md, PROGRESS.md, BLOCKERS.md. I made no edits, ran no tests and opened no browsers. I did not open REVIEWS/gap_audit.md, REVIEWS/gap_hunt_s9_*.md, WORLD_INVENTORY.md or any other gap list.

**How the fixed clauses apply to this task:**
- I judged no frames, clips or sounds, so clauses 2–4 (lens, motion, time strata) and clause 7 (anchor calibration) had nothing to act on. I scored no anchors.
- Clause 6: no reference image is paired to a gap hunt, so I judged against none. My own knowledge is labelled RECOLLECTION or tier C.
- **PRESENT means the code or data exists. It does not mean it has been seen on screen.** Many PRESENT rows sit in areas BLOCKERS lists as unrendered (villages B76, the lane walk B67, sound heard only in node B65/B66).
- Clause 8 proxy hunt, for every PRESENT row: it can pass while the intent fails if the object exists in code but is never drawn near the walker, or appears only in the court setting. No detector on the board checks inventory breadth. The activity lint, planCheck and the blocklist all check only what exists, so every MISSING row below is a structural detector escape (REVIEWS/escapes.md, T-R0), except C-D49, which a source-consistency lint should have caught.

## Problems first: the biggest gaps, ranked by how badly a walker would notice

1. **No one ever relieves themselves (C-D03).** There are no latrines, no toilet corner in any house, no chosen place at the field edge, and no trace of human waste, in a town of thousands with a sim of full days. Grepping src for latrine, toilet, defecate, urinate or cesspit finds nothing; `sources.json` even cites "Bathrooms and toilets in Babylon-Merkes" (Kaskal 2024), yet the house type built on Merkes has none. A follower bot shadowing one person for a whole day would see a body with no needs. Form: Herodotus 1.133 (Persians do not make water in another's sight) and 1.138 (never into a river), B claims. Where: a toilet niche with a jar or a pit in the court corner of town houses (Merkes analogue, B); in the plain, men going off behind the field banks (C).
2. **Horses and camels are silent (C-W01, C-W02).** `STRIKE_KINDS` in `audio/soundscape.ts` has bray, bark, cluck, cockcrow, grunt, bleat and low, but no neigh, snort, hoofbeat or camel groan. Couriers ride in (traffic.ts), grooms lead horses, camel strings come to the stair foot, and the court setting has a chariot team and delegation horses. Hooves on the Grand Stair's stone and the royal road would be among the loudest everyday sounds.
3. **No woman is ever visibly pregnant (C-D09).** lives.json has births at a rate that means roughly 3–5 % of women aged 15–44 are visibly pregnant on any day (A for the biology). Grepping src/people finds no belly, gravid or pregnancy shape. Children arrive from bodies that never changed.
4. **A faithfulness contradiction, not a gap (C-D49).** Persian guards are sent "washing his clothes at the river" (`population.ts` ~3161 and 3220). Other people wash clothes and wool "at the water" (activities.ts `wash`, population.ts ~1802, 3884, 4366). Herodotus 1.138 (read by this project) says Persians "never defile a river ... nor even wash their hands in one; nor will they allow others to do so" (B claim). The project already applies 1.138 to the river offerings (events_calendar.json: "on the bank, not in the water"), so the source is known and applied unevenly. Probable form: water drawn out in jars and the washing done on the bank, well away from the stream.
5. **The wine and beer ration is issued but never drunk (C-D29, C-L03).** E-02 and E-09 deliver it; grepping src for "drink" finds nothing a person does. No evening drinking, no shared jar, no drunkenness. Herodotus 1.133: Persians "are very fond of wine" and deliberate drunk and sober (B claim). Where: evenings in town courts, the garrison hearths, the šip and festival days, the workers' camps.
6. **Nobody hunts (C-S05, C-S07).** Hunting is the commonest subject of the Persepolis seals after heroic combat (the PFS corpus, A as imagery; RECOLLECTION of specific seals). The paradise holds deer and gazelle (fauna.json), yet no royal hunt (court setting) and no hunting by commoners (hare, partridge, gazelle with dogs, net, bow or sling). Only snares (`fowl`) and fishing exist.
7. **Only two seal designs exist for thousands of sealers, and nobody wears a seal (C-S02, C-S03).** writing.json holds two royal designs (PTS hero with lions, hero stabbing a lion). Every storekeeper and scribe rolls those. Nobody carries a seal on a cord at the wrist or neck (outfits.ts has none). About 5,000 distinct seals are attested (A).
8. **No bodily care at all (C-D04 to C-D07).** Nobody washes face and hands, bathes (in a basin in the court), combs or braids hair, removes lice, or is shaved or trimmed. Lice combs and cosmetic tubes are ordinary finds of the period (B analogy). Eye paint is worn (`looks.ts`), yet the tool for it exists nowhere (C-H09).
9. **Surfaces too clean for a lived-in town (C-F08, C-F09, C-F15).**
   - No animal droppings on the royal road, the lanes or the stair foot where caravans halt. Only pen floors have dung (`quarter.ts` pen_dung).
   - No scatter of broken pottery or litter on lanes and open ground. Sherds exist only as a texture chip inside middens (`surfaces.ts`).
   - No bird nests or droppings anywhere. The Terrace's column tops and the houses' eaves and porticoes have no stork nests, swallow nests or pigeon lime, although storks and swallows fly (wildlife.ts).
10. **Crafts are drawn as mending, not making (C-L18 to C-L21).** No potter throws a pot: pottery workshops have a kiln and jars (`quarter.ts:350`), and the potter's performance is "craft" = mending with an awl (`activities.ts:293`), although research calls the everyday ware "wheel-made". Nobody makes felt (felt caps are worn everywhere), twists rope or weaves reed mats and baskets. Mats cover every floor.
11. **Five workplaces are open-ground placeholders:** the mill, tannery, oil press, stockyard and brickyard (`popgeo.ts:312-323` "NOT BUILT"). The mill (the nupištaš of E-07) is the grain store woman's workplace in my five-lives checklist.
12. **No measuring vessel (C-L38).** Grain is "measured in" and "measured out" at every issue and delivery (exchanges.ts, population.ts ~3340, 3721), but no QA or BAR measure exists as an object. The units are A.
13. **Town houses lack the standard furniture of a Neo-Babylonian dowry (C-H01 to C-H08).** There are no beds, chairs, tables, chests, metal cauldrons, braziers or mirrors. `houses.ts furnish()` gives mats and bedding rolls only; beds, chairs and tables exist in the palaces alone (furnish_palaces.ts). Dowries of middling households list a bed, chair, table, copper kettle and brazier as a matter of course (B for Babylonia, analogy). At minimum, houses of standing (life.standing > 0.6) should have them.
14. **No events outside the calendar's routine (C-W26, C-W28, C-W30).** No earthquake tremor (Zagros), no locust year, no house fire. Flash floods are only partly represented. These are the "surprises" UD-09 and UD-11 ask for, arising from the world's own state.
15. **Small life missing (C-W16 to C-W19, C-W23 to C-W25).**
   - Rats and mice at the stores: logged "not built" in fauna.json.
   - Ants: harvester ants carrying grain from the threshing floors.
   - Mosquitoes over the canals at dusk.
   - Scorpions under stones.
   - Wildcat, caracal and stone marten, although SOUNDSCAPE.md §5 itself confirms them in Fars (B).
16. **Mourning, courtship and blows are thin (C-D23, C-D25, C-D27).** No courtship. No quarrel ever comes to blows. No visible sign of mourning: Herodotus 9.24 has Persians shaving their heads and their horses' manes in mourning (B claim).
17. **Relief work in 467 is invisible (C-F23, C-F24).** The Hall of 100 Columns' relief progress is counted in `people/construction.ts` (reliefDays, reliefStart), but "walls and relief carving stay at their day-0 geometry" (world/construction.ts header). Nobody paints reliefs.

## Full table

Status key: PRESENT / PARTIAL / MISSING / ABSENT-BY-EVIDENCE (only where evidence says it was absent) / CONTRADICTION (built, but against a source the project holds).

### 1. Lexicon of things: Elamite and Old Persian commodities, measures, titles, occupations

| id | category | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|---|
| C-L01 | commodity | barley ration (ŠE.BAR), monthly issue | PRESENT | events_calendar.json E-01; population.ts ration issue, queue act | Terrace depot, town | A/B | backbone of the kurtaš economy |
| C-L02 | commodity | flour (ZÍD.DA), grain to the mill | PRESENT | E-07, E-14; town.json mill | mill (placeholder) | A | |
| C-L03 | commodity | wine (GEŠTIN) and beer (KAŠ) rations | PARTIAL | E-02, E-09 issued; no one drinks (grepping src for "drink" finds nothing) | courts, garrison, camps | A issue / C act | ration with no visible use |
| C-L04 | commodity | beer brewed from tarmu | PRESENT | activities.ts `brew`; brewery craft | town | A work | |
| C-L05 | commodity | sesame and its oil | PRESENT (place a placeholder) | activities.ts `press_oil`; popgeo.ts:313 NOT BUILT | by the royal stores | A/C | |
| C-L06 | commodity | figs and fruit to the stores | PRESENT | E-10, E-46; pick_fruit; trees.json fig, apple, pear, pomegranate | orchards | B | |
| C-L07 | commodity | dates imported from the lowlands | PARTIAL | plain.json dates "arrive by pack train"; no date load or basket told apart in traffic.ts | caravans, stores | B/C | a named PF commodity never seen |
| C-L08 | commodity | honey and hives | PRESENT | activities.ts `bees`, workObjects hives, 'buzz' sound | villages | C | |
| C-L09 | commodity | poultry and its fodder | PRESENT | fauna.json poultry (state yard 150) | yards, royal stores | B | |
| C-L10 | commodity | sheep and goats (kumaš, kupšu, hidu) | PRESENT | herd, shear, slaughter; fauna.json folds | plain, stockyard | A | |
| C-L11 | commodity | cattle and oxen | PRESENT | fauna.json cattle; plough, milk | villages | C | |
| C-L12 | commodity | camels (OP ušabāri, "camel-borne") | PRESENT | traffic.ts camel strings | royal road, stair foot | B | |
| C-L13 | commodity | horses (asa) at the state stable | PARTIAL | plan.ts stablesSite (8 mangers); horses drawn only beside a groom or a courier (activities.ts tend_animals /horse/) | stable W of town | B | a stable yard with no standing horses |
| C-L14 | commodity | horse rations of bread and wine | PARTIAL | groom job_tasks (POTTS2023 cited); the feeding is not drawn | stable | B | |
| C-L15 | commodity | hides and tanning (PF 58-60) | PRESENT | activities.ts `tan`; tannery NOT BUILT (popgeo.ts:312) | NE of Terrace | A/C | |
| C-L16 | commodity | wool: shearing, washing, dyeing | PRESENT | shear; wash "washing and dyeing wool" (population.ts ~3884) | plain, water | C | |
| C-L17 | occupation | textile women (pašap), spinning and weaving | PRESENT | weave, spin; weaver job; lives.json women_winter | town, Terrace camps | A/B | |
| C-L18 | craft | felt making | MISSING | felt caps worn (outfits.ts, humanMaterial.ts); nobody felts | herders' tents, courts after shearing (May-June) | B analogy (Pazyryk felts; Iranian pastoral craft) | every felt cap implies it |
| C-L19 | craft | rope and cord twisting | MISSING | grepping src for rope-making, cordage or twisting finds nothing; rope used everywhere (haul, wells, tethers) | lanes, courts, herders | C | |
| C-L20 | craft | reed mat and basket weaving | PARTIAL | `craft` = mending baskets only; no one cuts reeds or plaits mats | riverbanks (riparian.ts reeds), doorsteps | C | mats on every floor with no makers |
| C-L21 | craft | potter at the wheel | PARTIAL | pottery workshops: kiln and jars (quarter.ts:350); potter performs "mending" | town pottery workshops | B (wheel-made buff ware, MATERIAL_CULTURE) | |
| C-L22 | material | sun-dried brick (išti), moulding | PRESENT | mould_brick; E-63 | brickyard (placeholder) | A word | |
| C-L23 | material | baked and glazed brick (agurā) | PRESENT | arch/glazed.ts; kiln craft | Terrace | A/B | |
| C-L24 | material | stone (aθanga), quarrying | PRESENT | activities.ts quarry; traffic.ts Majdabad quarry | Sivand quarry | A/B | |
| C-L25 | material | timber (dāru), cedar and yakā | PRESENT | work_wood; cart_timber; materials.ts cedar | Terrace, roads | A (DSf) | |
| C-L26 | material | gold and goldsmiths (daraniyakara) | PRESENT | activities.ts goldsmith; lives.json job_tasks.goldsmith | Treasury | A word | |
| C-L27 | material | silver and karša weights | PRESENT | weigh; props balance; weigh_table | Treasury | A/B | |
| C-L28 | material | kāsaka (lapis, carnelian): beads and bead-making | MISSING | grepping src for carnelian finds nothing; lapis appears only as a word | Treasury store, elite necklaces, the seal-cutters' drill | A (DSf) / B objects | a DSf material absent from the world |
| C-L29 | material | ivory (DSf: from Kush, India, Arachosia) | MISSING | grepping src for ivory finds nothing | Treasury benches, palace furniture inlay | A word / B objects (RECOLLECTION of Treasury ivories) | |
| C-L30 | material | glass vessels (Achaemenid cut glass) | MISSING | furnish.ts stored_goods has alabaster, blue vessel, chert, arrows, jars only | Treasury | B (RECOLLECTION of Schmidt's Treasury glass) | window glass is rightly blocklisted; vessels are not |
| C-L31 | material | bitumen (jar sealing, waterproofing) | MISSING | grepping src for bitumen finds nothing | stores, drains, basket linings | B (Elam and Susa practice) | |
| C-L32 | document | halmi (sealed authorisation) | PRESENT | access.json; exchanges.ts | road station, Gate | A/B | |
| C-L33 | occupation | pirradaziš express couriers | PRESENT | E-20; traffic.ts couriers | royal road | A | |
| C-L34 | occupation | envoys and delegations (hutlak) | PRESENT | E-24; delegations.json; court.ts | court setting | A/B | |
| C-L35 | institution | storehouse (kanti) and storekeeper (kantira) | PRESENT | storekeeper job; E-15 | royal stores | A | |
| C-L36 | occupation | grain handlers and suppliers (tumara, ullira) | PRESENT | porters, deliveries E-06 | stores | A | |
| C-L37 | institution | treasury (kapnuški), treasury workers | PRESENT | treasury job; furnish.ts | Terrace | A | |
| C-L38 | measure | QA / BAR measuring vessel | MISSING | "measured in/out" in exchanges.ts and population.ts; no object | ration issue, store gate, depot | A units / C form | the core act of the ration economy has no tool |
| C-L39 | measure | marriš wine jar (~10 L) as a distinct vessel | MISSING | generic jar only | wine deliveries | B unit / C form | |
| C-L40 | ritual | lan daily offering by a magus | PRESENT | E-30; offer, chant (mouth_cover) | precinct | A | |
| C-L41 | ritual | šip feast | PRESENT | E-33; lives.json festival | precinct, town | A | |
| C-L42 | institution | maternity rations (N texts) | PRESENT | E-04 | issue | A | |
| C-L43 | institution | boys' and girls' rations, children in work groups | PRESENT | lives.json children.gang_note | Terrace gangs | B | |
| C-L44 | title | officials, commanders (framātar) | PRESENT | official job, official_round | town, Terrace | A | |
| C-L45 | occupation | Ionian, Sardian, Egyptian craftsmen | PRESENT | population origins; Ionian mason's song (M-08) | Terrace | A/B | |
| C-L46 | occupation | horsemen and mounted troops (asabāra) | PARTIAL | only couriers and heralds ride (B71: the king on foot) | roads, court escort | A word | |
| C-L47 | occupation | treasury "shiners" | PRESENT | polish_metal | Treasury | B | |
| C-L48 | occupation | court physicians (Egyptian and Greek at the court: Hdt 3.1, 3.129) | MISSING | only the quarter healer (lives.json healer) | court setting | B claim | |
| C-L49 | occupation | court cooks, wine strainers, perfumers (Parmenion's list) | PRESENT | court.json proportions | court camps | B/C | |
| C-L50 | occupation | barbers and hair-dressers | MISSING | no shaving or trimming act | town lanes, court | C | beards are dressed on the reliefs (MATERIAL_CULTURE) |
| C-L51 | occupation | Aramaic scribes on leather | PRESENT | props pen, leather; writing.json leather_scroll | Treasury | B | |
| C-L52 | occupation | fowlers and fishers | PRESENT | activities.ts fowl (snares), fish | rivers, fields | C | |
| C-L53 | occupation | bow and arrow makers (fletchers) | MISSING | arrows stored (furnish.ts arrow_bundle), no maker | Treasury workshops | B (Treasury arrowheads) / C | |
| C-L54 | occupation | leatherworkers and sandal-makers | PARTIAL | tanning and mending only | town | C | |
| C-L55 | occupation | bone and horn workers | PARTIAL | Craft 'bone' plots exist (site.ts); no performance of their own | town workshops | C | |

### 2. Persepolis seal imagery (PFS/PTS): what the seals show people doing

| id | category | item | status | evidence / file | where | tier | why |
|---|---|---|---|---|---|---|---|
| C-S01 | seals | royal hero mastering lions (PTS) | PRESENT | writing.json seals (2 designs) | Treasury tablets | B | |
| C-S02 | seals | the diversity of personal seals (thousands) | PARTIAL | only 2 designs; every sealer rolls them | every sealing | A (diversity) | identical sealings everywhere |
| C-S03 | seals | seals worn on the body (cord at the wrist or neck) | MISSING | nothing in outfits.ts | officials, scribes, storekeepers | B (Mesopotamian practice) | status and identity visible on the body |
| C-S04 | seals/reliefs | animal combat, lion on bull | PRESENT | relief_programmes.ts lionBull | Apadana stairs | A | |
| C-S05 | seals | royal hunt, chariot or horse hunt in the paradise | MISSING | no hunting act (grep); fauna.json paradise deer/gazelle "drawing off" only | Bagh-e Firuzi paradise, court setting | B (Xen. Anab. 1.2.7; hunt seals, RECOLLECTION) | the paradise's purpose |
| C-S06 | seals | archers shooting | PRESENT | activities.ts train (archery), target | practice ground | B | |
| C-S07 | seals / daily life | commoners hunting hare, partridge or gazelle (dogs, nets, bow, sling) | MISSING | none | steppe, field edges, Kuh-e Rahmat | C (B analogy) | meat, sport, the dogs' use |
| C-S08 | seals | fowling with nets | PARTIAL | snares only (workObjects snare) | river margins | C | |
| C-S09 | seals | seated woman with a cup, banquet (PFS 77*) | PARTIAL | court women present; no drinking scene | court, elite houses | B | |
| C-S10 | seals | worship at an altar, priests with mouth covers | PRESENT | precinct.ts altar; offer, tend_fire mouth_cover | precinct | B | |
| C-S11 | seals/reliefs | winged-disk figure | PRESENT | relief_figures.ts, naqsh.ts | reliefs, tombs | A | |
| C-S12 | seals | date palm | PRESENT as motif; ABSENT-BY-EVIDENCE as a crop | relief palm; plain.json dates not grown (frost days) | reliefs | B | |
| C-S13 | seals/reliefs | servant with fly-whisk and parasol | PRESENT | props whisk, parasol, towel; bear_parasol | court | B | |
| C-S14 | seals | ploughing | PRESENT | activities.ts plough, workObjects ard | plain | C | |
| C-S15 | seals | porters carrying skins and vessels | PRESENT | carry_sack, carry_jar | everywhere | B | |
| C-S16 | seals | riders on horseback | PARTIAL | couriers only; no riding for pleasure, travel or patrol | roads | B | |
| C-S17 | seals / lexicon | camel riders | MISSING | camels are only led in strings | caravans | A word (ušabāri) / C | |
| C-S18 | seals | contest and presentation scenes before a seated figure | PRESENT | court.ts audience, enthroned | court setting | B | |

### 3. Household inventories and dowry lists (Neo-Babylonian, Murašû, Egibi), room by room

| id | category | item | status | evidence / file | where | tier | why |
|---|---|---|---|---|---|---|---|
| C-H01 | furniture | bed with a frame (eršu) | MISSING in houses | houses.ts furnish(): mats and rolled bedding; beds only as palace couches | houses of standing | B analogy | dowry staple |
| C-H02 | furniture | chair or stool in houses | MISSING in houses | furnish_palaces.ts only | houses | B analogy | |
| C-H03 | furniture | table (paššūru) | MISSING in houses | palaces only | houses | B analogy | |
| C-H04 | furniture | chest or box for cloth and valuables | MISSING in houses | palaces only | houses | B analogy | |
| C-H05 | vessel | copper or bronze cauldron and kettle | MISSING | hearth_pot is clay; grepping src for cauldron or kettle finds nothing | hearths | B analogy (dowries) | |
| C-H06 | heating | brazier in houses (winter, 44 frost days) | MISSING in houses | braziers only on the Terrace (firePlaces.ts) | living rooms Nov-Mar | B analogy | |
| C-H07 | lighting | clay lamp on a ledge | PRESENT | houses.ts lamp ledge; furnish.ts | every living room | B/C | |
| C-H08 | toilet | bronze mirror | MISSING | no hits | elite women | B (Achaemenid mirrors, RECOLLECTION) | |
| C-H09 | toilet | kohl tube or stick, cosmetic jars | MISSING | eye paint worn (looks.ts), no tool | women's rooms | B analogy | |
| C-H10 | toilet | oil flask for anointing | MISSING | none | houses, court | B analogy | |
| C-H11 | kitchen | saddle quern | PRESENT | quarter.ts quern; grind | courts, bakery | B | |
| C-H12 | kitchen | mortar and pestle | PRESENT | houseplan.ts mortar | courts | C | |
| C-H13 | kitchen | sieve and baskets | PRESENT | houseplan.ts baskets ("a sieve") | courts | C | |
| C-H14 | kitchen | tannur oven | PRESENT | quarter.ts, villages.ts | courts, bakery | C | |
| C-H15 | kitchen | spoons and wooden bowls; everyday tableware (carinated Achaemenid bowls) | PARTIAL | ladle, bowl props; nothing set out in rooms | houses | B | |
| C-H16 | store | storage jars and sacks | PRESENT | houses.ts store room | houses | C | |
| C-H17 | store | water jar with a cup by the door | PRESENT | houses.ts vestibule | houses | C | |
| C-H18 | textile | spindle, distaff, loom | PRESENT | props; workObjects loom | houses | C | |
| C-H19 | textile | garments stored or hung, pegs | PARTIAL | folded rugs; drying line (houseplan line) | rooms | C | |
| C-H20 | jewellery | earrings and bracelets | PRESENT | outfits.ts (D-215) | town women, nobles | C | |
| C-H21 | jewellery | anklets, necklaces for ordinary women | MISSING | no anklet; one necklace (elite, looks.ts) | town women | B analogy (dowries) | |
| C-H22 | household | cradle | PRESENT | houseplan.ts cradle | courts | C | |
| C-H23 | household | fuel store (brushwood, dung cakes) | PRESENT | houseplan.ts firewood, dungcakes | courts, roofs | C | |
| C-H24 | household | tether and manger | PRESENT | houseplan.ts tether, fodder | courts | C | |
| C-H25 | household | terracotta figurines (horse and rider), household objects of devotion | MISSING | only wheeled toys | niches, children | B (common Achaemenid-era Iranian finds, RECOLLECTION) | |
| C-H26 | household | door bolt, lock and key | PARTIAL | towndoors.ts shuts doors; no bolt or key | street doors, stores | B analogy | |
| C-H27 | household | private tablets and records in a house (Egibi-style) | PARTIAL | a scribe's "own accounts" in home_hours; no tablets in houses | scribes' houses | B analogy | |
| C-H28 | carrying | shoulder yoke (two jars or baskets) | MISSING | no yoke prop (props.ts) | water carriers, porters | B (Indians on the Apadana carry a yoke) | |
| C-H29 | carrying | waterskin; butter-churning skin on a tripod | MISSING | none | herders' tents, pack donkeys | C (ethnographic) | milk and curds exist in meals with no churn |
| C-H30 | household | servants in elite households | PRESENT | servant job; population.json elite_estate_household | elite houses | B/C | |
| C-H31 | Treasury | gold and silver plate stored (phialai, rhyta) | MISSING | stored_goods: none of metal | Treasury benches | B (LIVIUS-TREAS shiners imply it) | |
| C-H32 | Treasury | textiles stored (Baratkama dossier) | MISSING | none | Treasury | C | |
| C-H33 | Treasury | armour scales, shields and chapes in store | PARTIAL | arrow bundles only | Treasury | B (ISAC-FINDS) | |

### 4. The body and the day, hour by hour, for five ordinary people

The five are a kurtaš woman at the grain store, a boy herding, a Terrace guard, a scribe, and an old man in a village.

| id | category | item | status | evidence / file | where | tier | why |
|---|---|---|---|---|---|---|---|
| C-D01 | woman | rising before dawn, grinding, kneading, baking | PRESENT | lives.json household_bread, rise_before_sunrise_h | homes | C | |
| C-D02 | woman | water carried on the head | PRESENT | carry_jar_head; lives.json water_trips | wells, canals | C | |
| C-D03 | all | toilet: latrine, pit, field edge | MISSING | no hits in src | every house, the plain | B analogy (Merkes); B claims (Hdt 1.133, 1.138) | a body with no needs |
| C-D04 | all | washing face and hands | MISSING | none | court, water jar | C | |
| C-D05 | all | bathing (a basin in the court; never in the river) | MISSING | none | houses | B analogy (Merkes bathrooms) | |
| C-D06 | all | combing, braiding, delousing | MISSING | none | doorsteps | B analogy | |
| C-D07 | men | shaving and trimming beards | MISSING | none | lanes | C | |
| C-D08 | woman | nursing an infant at work | PRESENT | babes.ts; props babe_sling | everywhere | C | |
| C-D09 | woman | visible pregnancy | MISSING | no body change in src/people | women 15-44 (~3-5 %) | A (biology) | births from unchanged bodies |
| C-D10 | woman | confinement after birth | PRESENT | lives.json postpartum_off_days | homes | C | |
| C-D11 | woman | menstrual seclusion | MISSING (uncertain) | none | Persian households | C (Vendidad date disputed) | low priority |
| C-D12 | all | dressing for the cold | PRESENT | outfits.ts coldBits, COLD_C | winter | C | |
| C-D13 | men | stripping to the waist in the heat at harvest or building | MISSING | not found (the blocklist bars "bare-chested slave-soldiers" only) | fields, Terrace | C | |
| C-D14 | all | midday heat rest | PRESENT | E-64; lives.json heat_rest | everywhere | C | |
| C-D15 | old man | afternoon nap, sitting by the threshing floor | PRESENT | lives.json elders (nap_h, plain) | villages | C | |
| C-D16 | all | sleeping on the roof in summer | PARTIAL | houseplan.ts roof_mats; no one drawn asleep on a roof | town and village roofs | C | |
| C-D17 | all | sickness at home, the healer's call | PRESENT | lie_ill; lives.json healer | homes | C | |
| C-D18 | all | illness seen in the street (cough, eye disease) | PARTIAL | voices.ts COUGH (seasonal); no eye disease or sores | lanes | C | |
| C-D19 | all | injuries and accidents (a cut, a fall, a kick) | MISSING | none | worksites, fields | C | |
| C-D20 | all | lame and blind | PRESENT | popview.ts IMPAIR | lanes | C | |
| C-D21 | old | greying, wrinkles | PRESENT | looks.ts, humanMaterial.ts | | C | |
| C-D22 | child | play (knucklebones, ball, wheeled toy, toy bow) | PRESENT | activities.ts play | lanes, courts | B/C | |
| C-D23 | youth | courtship | MISSING | wedding (E-73) without any courting | wells, lanes, harvest fields | C | |
| C-D24 | all | quarrels and a hearing before an official | PRESENT | E-74; lives.json dispute_context, hearing | queue, well, canal | C | |
| C-D25 | all | a quarrel coming to blows, pulled apart | MISSING | none | lanes, queue | C | |
| C-D26 | all | burial and mourning at the grave | PRESENT | bury, mourn; precinct.ts burial ground | burial ground | B/C | |
| C-D27 | all | visible signs of mourning (shorn heads, horses' manes cut) | MISSING | none | a household in mourning | B claim (Hdt 9.24) | |
| C-D28 | all | social drinking of wine and beer | MISSING | none | evenings, festivals | B claim (Hdt 1.133) | |
| C-D29 | all | singing at work | PRESENT | performers.ts quern song, Ionian mason | mill, Terrace | C | |
| C-D30 | woman | lullaby (wordless) | MISSING | none | homes at night | C | |
| C-D31 | all | storytelling by the evening hearth | PARTIAL | talk only | homes | C | |
| C-D32 | Persian | reverence to the sun or fire at dawn (gesture) | MISSING | none | roofs, courts | C (Hdt 1.131 claims sun worship) | wordless and allowed by the §12 rule |
| C-D33 | all | banking the hearth at night | PARTIAL | hearthSmoke.ts phases | homes | C | |
| C-D34 | guard | watches, relief, meals, drill, family visits | PRESENT | lives.json guard_rota, guard_off_day | Terrace | B/C | |
| C-D35 | scribe | writing, sealing, clay under a cloth, drying board | PRESENT | furnish.ts scribes' room; write_tablet, seal | Treasury | A/B | |
| C-D36 | scribe | apprentice or son learning | PRESENT | lives.json children.trade_note | | C | |
| C-D37 | boy | herding goats and sheep, the cow to the meadow | PRESENT | population.ts ~3585, 3625 | plain | C | |
| C-D38 | boy | sling for turning the flock or scaring wolves | MISSING | none | pastures | C (Near Eastern pastoral) | |
| C-D39 | child | chores: water, fuel, minding the baby | PRESENT | lives.json children.chores | | C | |
| C-D40 | woman | women meeting at the well in the evening | PRESENT | lives.json evening.well_women | | C | |
| C-D41 | Persian boys | riding lessons (Hdt 1.136: riding, archery, truth) | PARTIAL | persian_boys_training → archery only | practice ground | B claim | |
| C-D42 | adults | board game (twenty squares) | MISSING | none | lanes, garrison | B analogy (first-millennium Mesopotamian boards) | men gamble only with dice |
| C-D43 | all | dance at weddings and festivals | MISSING | frame drum only (M-22); no dance anywhere | weddings, šip | C | |
| C-D44 | magi | killing "noxious creatures" (ants, snakes) with their own hands | MISSING | none | precinct, stores | B claim (Hdt 1.140) | |
| C-D45 | all | burial after coating in wax | PRESENT | precinct.ts (Hdt 1.140) | burial ground | B | |
| C-D46 | Persians | washing clothes at the river | CONTRADICTION | population.ts ~3161, 3220 "at the river"; Hdt 1.138 already used for offerings | riverbank | B claim | see problem 4 |
| C-D47 | all | laundry "at the water" generally | PARTIAL | activities.ts wash | canals | C | should be drawn water on the bank |
| C-D48 | all | eating, sleeping on a mat | PRESENT | eat, sleep | | C | |
| C-D49 | all | people drawn asleep indoors in real rooms | PARTIAL | B64 (village rooms solid boxes) | villages | — | |
| C-D50 | Egyptians | shaven heads | PRESENT | MATERIAL_CULTURE hair row, looks.ts | | C | |

### 5. The built fabric at arm's length

| id | category | item | status | evidence / file | where | tier | why |
|---|---|---|---|---|---|---|---|
| C-F01 | fabric | worn thresholds, doorsteps | PRESENT | houses.ts:284; houseplan.ts niche note | town | C | |
| C-F02 | fabric | door pivot stones and pivots | PRESENT | houses.ts (pivot stones); arch/doors.ts | town, palaces | C | |
| C-F03 | fabric | drain holes and wet stains | PRESENT | houseplan.ts drain; houses.ts stain decals | lanes | C | |
| C-F04 | fabric | Terrace drains and cisterns | PRESENT | arch/waterworks.ts | Terrace | B/C | |
| C-F05 | fabric | mud-plaster repairs, bare brick | PRESENT | houses.ts decals | town | C | |
| C-F06 | fabric | soot over hearths and lamps | PRESENT | houses.ts; furnish.ts soot | | C | |
| C-F07 | fabric | graffiti-free walls | PRESENT (none drawn) | — | | — | correct |
| C-F08 | ground | animal droppings on the road, lanes and stair foot | MISSING | pen dung only (quarter.ts pen_dung) | royal road, caravan halts, lanes | C | |
| C-F09 | ground | sherd and litter scatter on lanes and open ground | PARTIAL | sherds only as chips in middens (surfaces.ts) | lanes, town edges | C | |
| C-F10 | ground | household ash dumped by doors | PARTIAL | ash mound at the precinct only (precinct.ts) | lanes | C | |
| C-F11 | ground | middens, bone pits, dung heaps | PRESENT | plan.ts Midden kinds | town | C | |
| C-F12 | ground | wheel ruts | PRESENT | settlement/water.ts | roads | C | |
| C-F13 | ground | puddles, wetting, snow | PRESENT | materials.ts WEATHER | | C | |
| C-F14 | ground | footprints and hoofprints in mud after rain | MISSING | none | lanes, roads | C | |
| C-F15 | fabric | bird nests and droppings (storks on column tops, swallows under eaves) | MISSING | no nest in src | Terrace columns, porticoes, eaves | C | |
| C-F16 | fabric | roof rollers, spouts, parapets | PRESENT | houseplan.ts roller; houses.ts spouts | roofs | B/C | |
| C-F17 | fabric | floor stains and trodden plaster | PRESENT | furnish.ts floor_stain; meshes.ts floor wear (D-157) | | C | |
| C-F18 | fabric | relief paint wear | PRESENT | relief_field.ts WEAR | reliefs | C | |
| C-F19 | fabric | masons' marks | PRESENT | arch/marks.ts | Apadana, drums | B | |
| C-F20 | worksite | stone chips and debris | PRESENT | world/construction.ts DEBRIS | Hall 100 yard | C | |
| C-F21 | worksite | scaffolds | PRESENT | world/construction.ts | Hall 100 | C | |
| C-F22 | worksite | drums, sledges, the yard | PRESENT | workObjects drum_sledge, drum_rough | yard | C | |
| C-F23 | worksite | relief carving progress visible on the doorways | PARTIAL | people/construction.ts counts it; world/construction.ts: reliefs stay at day-0 | Hall 100 doorways | C | |
| C-F24 | worksite | relief painters at work | MISSING | pigment grinding only (craft /pigment/) | Hall 100, Tripylon | B (polychromy) / C | |
| C-F25 | built | mill building | PARTIAL | popgeo.ts:321 NOT BUILT | S of town | A name / C | |
| C-F26 | built | tannery, oil press, stockyard, brickyard | PARTIAL | popgeo.ts:312-323 NOT BUILT | town edges | C | |
| C-F27 | built | door sealing (a clay lump on a peg) on store doors | PARTIAL | writing.json door_sealing object; not on town stores | stores | A (sealings) | |
| C-F28 | fabric | dust and cobwebs in dark store rooms | MISSING | none | stores | C | minor |
| C-F29 | fabric | wall-foot damp band | PRESENT | meshes.ts wall-foot band | Terrace | C | |
| C-F30 | fabric | hand-laid plaster | PRESENT | PROGRESS D-234 notes; houses.ts | town | C | |
| C-F31 | weather trace | ice on puddles, jars and canal edges on frost mornings | MISSING | frost rime only (materials.ts:965) | everywhere, Dec-Feb | A (44 frost days/yr) / C | |
| C-F32 | weather trace | dew on grass and stone at dawn | MISSING | none | plain, Terrace | C | |
| C-F33 | fabric | the town's street-door niche lamps | PRESENT | houseplan.ts niche | town | C | |
| C-F34 | fabric | stains of spent liquor at the tannery | PRESENT | CRAFTS.md (stained ground drawn with the tanners) | tannery | C | |
| C-F35 | fabric | the hearth's ash ring, three stones and a pot | PRESENT | workObjects hearth_pot | | C | |

### 6. Walking each area in thought: sounds, animals, plants, weather, events

| id | category | item | status | evidence / file | where | tier | why |
|---|---|---|---|---|---|---|---|
| C-W01 | sound | horse neigh, snort, hoofbeats on stone and earth | MISSING | STRIKE_KINDS (soundscape.ts:168-177) | roads, stable, stair, court camps | C | |
| C-W02 | sound | camel groans | MISSING | none | caravans | C | |
| C-W03 | sound | donkey bray | PRESENT | soundscape.ts 'bray' | | C | |
| C-W04 | sound | dogs | PRESENT | 'bark'; fauna.json dog | | C | |
| C-W05 | sound | cocks and hens | PRESENT | 'cockcrow', 'cluck' | | C | |
| C-W06 | sound | cattle lowing | PRESENT | 'low' | | C | |
| C-W07 | sound | sheep and goats bleating | PRESENT | 'bleat' | | C | |
| C-W08 | sound | crickets, cicadas | PRESENT | soundscape.ts ambient ids | | C | |
| C-W09 | sound | frogs, owls, chukar, hoopoe | PRESENT | soundscape.ts; fauna.json sounds | | C | |
| C-W10 | sound | wolves, lion, hyena, leopard | PRESENT | beasts.ts; howl, roar, whoop, saw | | C | |
| C-W11 | sound | the crafts: hammer, bellows, drill, scraper, pestle | PRESENT | soundscape.ts D-255 kinds | | C | |
| C-W12 | sound | cart wheels creaking | PARTIAL | only in speech.ts text; no sound kind | roads | C | |
| C-W13 | animal | jackals | PRESENT | wildlife.ts | | B | |
| C-W14 | animal | onager, gazelle, wild goat, urial, fox, hare, cheetah, boar | PRESENT | beasts.ts, fauna.json | | B/C | |
| C-W15 | animal | brown bear | ABSENT (range reasoning, C) | fauna.json count 0 | | C | not evidence of absence; acceptable |
| C-W16 | animal | rats and mice at the stores | MISSING | fauna.json "not built" | stores, granaries | C | |
| C-W17 | animal | wildcat and caracal | MISSING | SOUNDSCAPE.md §5 confirms both in Fars | plain edge, mountain | B | |
| C-W18 | animal | stone marten | MISSING | SOUNDSCAPE §5 (Bamu list) | mountain, gardens | B | |
| C-W19 | animal | porcupine, hedgehog | MISSING | none | gardens, steppe at night | C | |
| C-W20 | animal | domestic cats | MISSING (uncertain) | none | stores, houses | C (unproven in Achaemenid Iran) | low |
| C-W21 | birds | stork (flying) and stork nests | PARTIAL | wildlife.ts stork flies; no nest | Terrace columns, big trees | C | |
| C-W22 | birds | the full bird list (doves, larks, cranes, vultures, bee-eaters and others) | PRESENT | wildlife.ts BIRDS (24 kinds) | | C | |
| C-W23 | insects | ants (harvester ants at the threshing floors) | MISSING | none | threshing floors, thresholds | C | |
| C-W24 | insects | mosquitoes and gnats at the water at dusk | MISSING | none | canals, river, summer | C | |
| C-W25 | small life | scorpions | MISSING | smallLife.ts kinds lack them | under stones, walls at night | C | |
| C-W26 | event | locust year | MISSING | none | fields | C | |
| C-W27 | small life | flies, dragonflies, butterflies, agamas, frogs, tortoise, snake, jird | PRESENT | smallLife.ts | | C | |
| C-W28 | event | earthquake tremor | MISSING | none | world-wide | C (Zagros seismicity) | |
| C-W29 | event | flash flood down Kuh-e Rahmat's gullies after a storm | PARTIAL | river levels by month (rivers.ts); no event | Terrace foot, precinct | C | |
| C-W30 | event | house fire | MISSING | none | town, villages | C | |
| C-W31 | weather | dust devils, rainbows, halos, hail, snow line, frost | PRESENT | dustDevils.ts, rainShafts.ts, halo.ts, weatherState.ts | | A/C | |
| C-W32 | sky | planets, meteors, eclipse | PRESENT | sky/*.ts (B84 open) | | A | |
| C-W33 | plants | spring flowers (tulip, poppy, anemone) | PRESENT | smallLife.ts, seasonal.ts | | C | |
| C-W34 | plants | walnut, apricot, quince in orchards | MISSING | trees.json has 15 species, no walnut | village orchards | C | |
| C-W35 | plants | alfalfa, flax, pulses, garlic | PRESENT | plain.json crops | | B/C | |
| C-W36 | farm | threshing sledge | MISSING | treading by oxen only | threshing floors | B analogy (Mesopotamia) | |
| C-W37 | farm | shaduf (water lift) | MISSING | wells with rope and skin bucket only | gardens above the canal | B analogy (Assyrian reliefs) | |
| C-W38 | institution | court hunting party (court setting) | MISSING | see C-S05 | paradise | B claim | |
| C-W39 | event | the wild garlic month's gathering | PARTIAL | B81 (0 person-days measured) | plain | A name | |
| C-W40 | built | quarry camp huts | PARTIAL | B80 (D-279 built, not yet rendered) | Majdabad quarry | C | |
| C-W41 | court | the king's chariot or horse on the road | PARTIAL | B71: the king walks | royal road | B | |
| C-W42 | court | tents being pitched | PARTIAL | B70 | court camps | C | |

**Counts:** 188 rows. MISSING about 75, PARTIAL about 42, CONTRADICTION 1, ABSENT (range reasoning) 1, the rest PRESENT. For T-J7, every MISSING row above names a probable reconstruction and its tier, except C-D11 and C-W20, which I rate uncertain, so none is an evidence-silent exception.

**What this sample cannot tell you:** whether any PRESENT row is actually seen by a walker at the player's lens, in motion, with sound, across seasons. That needs the render and coverage passes; B65, B66, B67 and B76 are still open.
