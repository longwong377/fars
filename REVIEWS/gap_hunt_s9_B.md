
# Gap hunter B report (session 9): PĀRSA, the whole world, branch claude/amazing-fermi-40ds7j

**Scope and method.** I made no edits and ran no tests, browsers or soaks. I read the brief (§1.1, §3, §5, §9, §10, §11), USER_DIRECTIONS.md, MASTER_PLAN.md (§3, §7, T-J6/T-J7), PROGRESS.md, BLOCKERS.md and the research files (PEOPLE, EVENTS, SOUNDSCAPE, PLAIN, SETTLEMENT). Then I grepped and read `src/` and `src/data/*.json` to set a status for each row. I did not open REVIEWS/gap_audit.md or hunter A's brief. Code comments cite gap-audit item numbers, but I did not follow them.

**Review-template clauses.**
- **Clause 7 (anchors):** not applicable. This task gives me no frames or clips, so I scored no anchors.
- **Clauses 2–4 (lens, motion, sound, time):** I judged nothing visually or by ear. Every status below comes from code and data. "PRESENT" means built in code. It does not mean seen or heard to be right.
- **Time strata:** each row covers all months, all eight hour bands and all weather states by inspection only. No stratum was rendered.

**Working-tree warning.** The shared working tree has uncommitted work from another agent: `src/world/beasts.ts` plus changes to fauna.json, animals.ts, fauna.ts, soundscape.ts and world.ts. It adds a wolf pack, a leopard, lions, hyenas, onagers, cheetahs and a brown-bear row with no animals placed. None of it is on the branch at HEAD 8d7f15c. Rows it touches are marked **WIP**, which counts as MISSING at HEAD and is unverified.

## Problems first: the biggest MISSING rows, ranked by how much they break the time capsule for a walker

1. **The villages are placeholders** (`src/world/plain/villages.ts:188`, flagged `placeholder: true`). These are Sumner's 39 sites, about 30–39k people, most of the world's population. Each compound is "merged vertex-coloured boxes: no walls with thickness, doors, roofs, courts, ovens, pens, people or night light". Village rooms are solid boxes, so sleepers are drawn inside solid geometry (B64).
2. **No river crossing anywhere.** No ford, bridge, causeway or ferry exists where the roads meet the Pulvar or the Kur. `settlement.json:503` says "Crosses the Pulvar (ford or bridge, C)" but nothing is built. The way-station "at the Kur crossing" (`plan.ts:164`) has no crossing, and the road to Naqsh-e Rustam simply runs into the carved channel. A walk from the Kur cannot begin truthfully.
3. **No snow on the mountains in winter** (brief §5.3 asks for it by name). `weatherState.ts:53` gives snow cover by date only, and `materials.ts:933` by surface slope only. There is no elevation snowline on Kuh-e Rahmat or the 3,000 m+ Zagros skyline. Seed 1 also has no snow day in the whole year (PROGRESS). The default year never shows snow anywhere.
4. **No planets in the night sky** (`src/sky/` has no planet code). Venus as morning or evening star is the brightest thing in the sky after the moon. Jupiter, Saturn, Mars and Mercury are also missing, and so is the zodiacal light. astronomy-engine is already in the build, so the positions would be tier A.
5. **Most wild fauna of the land beyond the town is missing.**
   - At HEAD only these exist: jackals (`wildlife.ts:159`), one boar family, and deer and gazelle inside the paradise.
   - Wolf, leopard, lion, hyena, onager and cheetah exist only as WIP.
   - Still missing even with the WIP: red fox, wild goat and wild sheep on Kuh-e Rahmat, gazelle on the open plain, hares, tortoises, snakes, lizards, scorpions, rodents, bats and hedgehogs.
   - The project's own SOUNDSCAPE.md §5 predicts "wolves on Kuh-e Rahmat in winter; gazelle on the open plain".
6. **Most birds are missing.** Absent: storks, cranes and geese on migration, herons, egrets and ducks at the rivers, vultures, ravens, doves and rock doves, larks, magpies, rollers, and the nightingale and bulbul in the gardens. The partridges, hoopoe, bee-eater and owls are heard but never seen.
7. **No insects drawn at all.** Flies exist as audio only (fauna.json lists visible flies as "not built"). No bees, butterflies, dragonflies or mosquitoes at water, and no locust years.
8. **Brief §5.5 crafts are missing:**
   - Tanning and dye works. Tanning is absent. Dyeing is only a line of plan text ("washing and dyeing wool").
   - Leatherwork. PF 58–60 hides go to the treasury and are never worked.
   - A potter shaping pots. The kiln is fired but nobody makes the pots.
   - A smith forging. The forge and anvil fittings exist (`quarter.ts:345`) but no job works them.
   - Seal-cutters, jewellers and stone-vessel makers.
9. **Commodities from the tablets are missing:**
   - Dates arriving by pack train. `plain.json` crops.dates says they come by pack train, but no event or traffic brings them.
   - Cattle herds: cows, calves and milk. Only plough and cart oxen exist.
   - Sesame oil pressing. Sesame is stored but never pressed.
   - Honey, salt, fish and eggs.
   - Issues of garments and tools.
10. **Nobody can reach a roof.** There is no stair to the Apadana corner towers or the palace roofs, so the brief's "Terrace roof" walk cannot finish. People never sleep on the town roofs in summer.
11. **Weather missing:**
    - Frost and hoarfrost on 44 frost days a year.
    - Ice on jars and pools at dawn.
    - Dew and hail. Hail comes with the spring thunderstorms that are otherwise modelled.
    - Dust devils, and heat shimmer or mirage over the summer plain.
    - The 22° halo.
12. **The quarries are empty stage sets.** Majdabad and Sivand are built as geometry (`quarries.ts`) with no quarrymen. Column drums "arrive" at the yard as an event (`construction.ts:104`) and are never seen on the road, on a sledge or behind oxen.
13. **Naqsh-e Rustam has no life:**
    - no tomb guardians or magi (Arrian's magi at Cyrus's tomb, a B analogy);
    - no workmen at the Xerxes façade, which the build shows "cut, uninscribed";
    - no visitors and no offerings.
14. **Detector escapes (T-R0).** Each of these passed a detector and should not have:
    - **Silver weighing.** The Treasury weighers "weigh out silver on the balance" (`population.ts:3737`), but the performance is `inspect`: no balance, no weights. The activity lint passes it.
    - **The forge.** Its fire is scheduled as a workshop day fire (`fire.ts:153`) with no one working it.
    - **Snow.** Coverage forces the "snow" state, which hides the missing elevation snowline.
    - **The sky.** The sky tests check the sun and moon only, so the absent planets pass.
15. **The build contradicts its own evidence rule.** Garrison men wash their clothes in the river (`population.ts:3089`, also 1739 and 3148). Yet the build applies Herodotus 1.138 ("they never … wash their hands in a river") to offerings (E-31). The rule should either govern Persians' washing too or be logged as a conflict.
16. **Other missing traces:** latrines and cesspits (Babylon-Merkes is cited in sources.json but not built), spilled grain, spring wildflowers on the steppe, garden vegetables (onions, garlic, leeks, lentils, chickpeas, melons, cucumbers), walnut, juniper and tragacanth-type thorn cushions on the mountain, pregnant women, and breath visible on cold mornings.
17. **Missing sounds:** horses whinnying and snorting, cattle lowing, camels groaning, infants crying, children shouting, coughing, a smithy's hammer, cart wheels and hooves on the road.

## Full table
Status key: P = PRESENT, PA = PARTIAL, M = MISSING, AE = ABSENT-BY-EVIDENCE, WIP = in the uncommitted working tree only (counts as M at HEAD).

| id | category | item | status | evidence / file | where it belongs | tier | why it matters |
|---|---|---|---|---|---|---|---|
| B-001 | brief §1.1 | a scribe pressing a tablet | P | activities.ts:112 write_tablet; writing.ts | Treasury | B | the named ordinary life |
| B-002 | brief §1.1 | a ration jar or ration issue | P | E-01/E-02 calendar.ts:285; `queue` act | storehouse | B | the economy made visible |
| B-003 | brief §1.1 | a child's game in a workshop yard | P | workAnims ball, chase, pull_toy; knucklebones | town | C | life |
| B-004 | brief §1.1 | a mason's mark | P | arch/marks.ts (4 shapes, B/C) | reliefs, drums | B/C | a real trace |
| B-005 | brief §1.1 | dust worn into a threshold | P | houses.ts:36 worn threshold | house doors | C | wear |
| B-006 | brief §1.1 | work left unfinished | P | Hall of 100 Columns site, construction.ts | Terrace | C | presence |
| B-007 | brief §1.1 | foundation plates in their stone boxes | P | decor.ts:455 buildFoundationDeposits | Apadana | A | real objects |
| B-008 | brief §1.1 | attested tablets sealed with attested seals | PA | writing.ts: seal texts A, but the memoranda are reconstructed C (B18) | Treasury | A/C | the brief wants published texts |
| B-009 | brief §1.1 | the act of sealing (rolling the seal) | M | no seal anim or prop; only finished sealings | Treasury, storehouse | B | the most characteristic Persepolis act |
| B-010 | brief §1.1 | Treasury objects | P | furnish.ts stored goods | Treasury | B | real objects |
| B-011 | brief §1.1 | people get lost; no waypoints | P | no in-world HUD | all | — | restraint |
| B-012 | brief §5.1 | fortifications | P | terrace.ts:636 fortification_e | Terrace E | B | |
| B-013 | brief §5.1 | garrison quarters with rooms | PA | only a perimeter wall; rooms not built (B63, roofs.ts) | Terrace | B | sleepers undrawn |
| B-014 | brief §5.1 | Hadish apartments furnished | M | Q-087; furnish_palaces.ts header | Terrace | C | interiors walkable |
| B-015 | brief §5.1 | storerooms showing their actual stock | PA | calendar Stores are numbers; drawn goods are fixed (furnish.ts, houses.ts:590) | stores, Treasury | C | brief §9.5 "visible contents are its actual stock" |
| B-016 | brief §5.1 | doors lock, stores sealed | P | doors.ts | Terrace | C | |
| B-017 | brief §5.1 | cisterns and drains | P | arch/waterworks.ts | Terrace | B | |
| B-018 | brief §5.1 | tomb façades on Kuh-e Rahmat | AE | the Rahmat tombs are later (A2/A3) | — | A | correct absence |
| B-019 | brief §5.1 | Tol-e Ajori gate | P | settlement/ajori.ts | Bagh-e Firuzi | C | |
| B-020 | brief §5.1 | stables | P | settlement.json stable | town | C | |
| B-021 | brief §5.1 | way-station | P | plan.ts:164 | Kur crossing | C | |
| B-022 | brief §5.1 | river crossing (ford or bridge) | M | settlement.json:503 notes it; not built | Pulvar on the Naqsh road; Kur on the royal road | C | a traveller cannot cross believably |
| B-023 | brief §5.1 | villages as places | PA | villages.ts:188 placeholder boxes | plain | C | most of the world's people live here |
| B-024 | brief §5.1 | Naqsh-e Rustam (Achaemenid only) | P | plain/naqsh.ts; Elamite relief figures are placeholder silhouettes | NR | B/C | |
| B-025 | brief §5.1 | horizon mountains to 40 km | P | horizon, DEM | edge | A | |
| B-026 | brief §5.3 | sun, ΔT, proleptic Julian calendar | P | sky/ephemeris.ts | sky | A | |
| B-027 | brief §5.3 | moon phase | P | skySystem.ts | sky | A | |
| B-028 | brief §5.3 | stars precessed to the period | P | skySystem.ts:6 HYG + precession | sky | A | |
| B-029 | brief §5.3 | volumetric clouds with shadows on the ground | P | sky/clouds.ts cellShadowNode | sky | C | |
| B-030 | brief §5.3 | rain: wet stone, puddles, drains, mud | P | weatherState wetness; materials puddles | all | C | |
| B-031 | brief §5.3 | snow on the mountain in winter | M | no elevation term (weatherState.ts:53; materials.ts:933) | Kuh-e Rahmat, Zagros skyline, Dec–Mar | B (climate) | named in the brief; the most visible winter sign |
| B-032 | brief §5.3 | snow on the Terrace and plain some years | PA | built, but seed 1 has no snow day | all | A climate | the default year never shows it |
| B-033 | brief §5.3 | wind in plants, cloth, dust, smoke | P | crops.ts:43 sway; trees; drape | all | C | |
| B-034 | brief §5.3 | haze, morning mist, dust storms | P | generator.ts dust and mist | plain | A/C | |
| B-035 | brief §5.3 | lightning and thunder | P | weatherVfx.ts; soundscape | sky | A/C | |
| B-036 | brief §5.4 | hearths, ovens, kilns, lamps, torches, braziers | P | fire.ts FireKind | all | C | |
| B-037 | brief §5.4 | smithy fire actually worked | PA | forge fitting (quarter.ts:345), no smith | town metal quarters | B | a lit forge with nobody there |
| B-038 | brief §5.4 | ritual fire | P | precinct altar (E-30) | precinct | C | |
| B-039 | brief §5.4 | soot staining | P | hearthSmoke.ts, houses.ts | houses | C | |
| B-040 | brief §5.4 | town haze at dusk | P | settlement/haze.ts | town | C | |
| B-041 | brief §5.4 | rivers and canals with seasonal flow | P | plain/rivers.ts flow table | plain | B/C | |
| B-042 | brief §5.4 | garden channels and pools | P | settlement/water.ts:113 | paradise | B/C | |
| B-043 | brief §5.4 | wells | P | quarter.ts:120 | town squares | C | |
| B-044 | brief §5.4 | rain run-off streams on slopes and lanes | PA | surfaces run-off tint only | lanes, mountain | C | a storm should run |
| B-045 | brief §5.5 | seasonal migrant birds | PA | swallows and kites only | sky | C | |
| B-046 | brief §5.5 | raptors | P | wildlife.ts raptor, kite | sky | B/C | |
| B-047 | brief §5.5 | insects and flies seen | M | fauna.json "not built" | dung, middens, animals | C | brief §5.5 names flies |
| B-048 | brief §5.5 | jackals | P | wildlife.ts:159 | plain edge | B | |
| B-049 | brief §5.5 | rats and mice | M | fauna.json not_heard_or_drawn | stores, houses | B (analogy) | pests of every granary |
| B-050 | brief §5.5 | scavenging dogs | P | fauna.json dog strays at middens | town | C | |
| B-051 | brief §5.5 | game in the paradise | P | deer, gazelle (fauna.ts) | Bagh-e Firuzi | C | |
| B-052 | brief §5.5 | dung and animal pens | P | settlement pens; dung cakes; terrainPlain.ts:290 | town, villages | C | |
| B-053 | brief §5.5 | middens | P | site.ts middens | town | C | |
| B-054 | brief §5.5 | drainage filth | PA | house drains exist; no drawn filth | lanes | C | |
| B-055 | brief §5.5 | spilled grain | M | no hit | threshing floors, stores, mills | C | named in the brief |
| B-056 | brief §5.5 | tanning works | M | no craft (site.ts:26) | edge of town, downwind, by water | B (hides PF 58–60) | named in the brief |
| B-057 | brief §5.5 | dye works | PA | "washing and dyeing wool" plan text only | by water | C | named in the brief |
| B-058 | brief §5.5 | dust on feet and hems | P | crowd grime (materials.ts:1007) | people | C | |
| B-059 | brief §5.5 | carts and wagons | P | traffic.ts ox carts | roads | C | |
| B-060 | brief §5.5 | chariots | P | fauna.json court_vehicles (court setting only) | court camp | B | |
| B-061 | brief §5.5 | litters | M | none | nobles and royal women on the road | C | |
| B-062 | brief §5.5 | pack animals with tack | P | traffic.ts | roads | C | |
| B-063 | brief §5.5 | courier way-stations | P | E-20, traffic.ts | road | B | |
| B-064 | brief §5.5 | grinding, baking, brewing | P | grind, knead, bake, brew acts | town | A/C | |
| B-065 | brief §5.5 | wine arriving | P | E-09 | stores | A | |
| B-066 | brief §5.5 | dates arriving | M | plain.json crops.dates says pack trains; no event | royal road from the lowlands | B | the brief names dates |
| B-067 | brief §5.5 | slaughter for the royal table | P | court.ts butchers; E-12 | stockyard | A/C | |
| B-068 | brief §5.5 | mealtimes | P | population.ts meals | all | C | |
| B-069 | brief §5.5 | storage jars | P | houses.ts:590 | houses, stores | C | |
| B-070 | brief §5.5 | children at play and at work | P | play variants; apprentices (population.ts:3539) | town | C | |
| B-071 | brief §5.5 | sickness | P | lie_ill; healer (E-72) | houses | C | |
| B-072 | brief §5.5 | old age | P | elder job; limp, feel anims | all | C | |
| B-073 | brief §5.5 | festivals and offerings | P | E-30…E-38 | precinct, town | B/C | |
| B-074 | brief §5.5 | death practice as the evidence shows it | P | E-71 bier, burial | cemetery | B/C | |
| B-075 | brief §5.5 | pregnancy visible | M | births are events only | women | C | the ration of mothers makes it a lived fact |
| B-076 | brief §9.1 | officials, scribes (Elamite and Aramaic) | P | activities.ts:113-115 | Treasury | B | |
| B-077 | brief §9.1 | treasury workers and storekeepers | P | population.ts:552 | Treasury | B | |
| B-078 | brief §9.1 | royal guard with pomegranate butts | P | props.ts:41,89 | court | B | |
| B-079 | brief §9.1 | gate guards with shifts | P | E-80 | posts | C | |
| B-080 | brief §9.1 | cavalry and horse lines, default world | M | court setting only (COURT.md:135) | plain by the river | B | "a constant visible presence" |
| B-081 | brief §9.1 | archers, drill | P | train (archery) | training ground | B/C | |
| B-082 | brief §9.1 | craftsmen from across the empire | P | names by origin | town | B | |
| B-083 | brief §9.1 | stone-cutters, carpenters | P | dress_stone, work_wood | Terrace, yards | B | |
| B-084 | brief §9.1 | bakers, brewers | P | brewer job; household bakers | town | A/C | |
| B-085 | brief §9.1 | grooms, camel and mule handlers | P | groom job; traffic | stables, roads | C | |
| B-086 | brief §9.1 | couriers with sealed authorisations | P | E-20, E-21, visitor access | roads | B | |
| B-087 | brief §9.1 | priests at attested offerings | P | E-30/31/32 | precinct | B | |
| B-088 | brief §9.1 | farmers and herders | P | farmer, shepherd, herder jobs | plain | B | |
| B-089 | brief §9.1 | women and children in work groups; maternity rations | P | pasap groups; E-04 | town | B | |
| B-090 | brief §9.1 | envoys and delegations | P | court setting only; E-24 none by default | Terrace | B/C | |
| B-091 | brief §9.1 | king with parasol and whisk | P | acts bear_parasol, bear_whisk | court | B | |
| B-092 | brief §9.2 | cover up in cold | P | outfits.ts:390 COLD_C | all | C | |
| B-093 | brief §9.2 | shelter from rain; stop in storms | P | W-01/W-02 | all | C | |
| B-094 | brief §9.2 | fires lit at dusk | P | fire.ts 'home' schedule | houses | C | |
| B-095 | brief §9.5 | goods physical: sacks, jars, tablets, silver | PA | carried props; silver weighed as `inspect` without a balance | Treasury | B | detector escape |
| B-096 | brief §9.5 | construction progress as geometry | P | construction.ts | Hall of 100 Columns | C | |
| B-097 | brief §9.5 | memory; persistence | P | memory.ts; save.ts | all | C | |
| B-098 | brief §10 | Aramaic ink on leather | P | props leather, pen | Treasury | B | |
| B-099 | brief §10 | writing boards, wax tablets, the scribe's kit and bag | M | none | offices | C | |
| B-100 | brief §11 | wind in the columns | P | soundscape column whistle | halls | C | |
| B-101 | brief §11 | footsteps by surface | P | soundscape | all | C | |
| B-102 | brief §11 | tools, kilns, grinding | PA | STRIKE_KINDS (soundscape.ts:142): no hammer on anvil, no kiln roar, no bellows | workshops | C | |
| B-103 | brief §11 | rain on timber and cloth (tents, awnings) | M | rain on stone only | camps, houses | C | brief §11 names it |
| B-104 | brief §11 | herders' pipes, work songs, magus chant | P | performers.ts | plain, town | C | |
| P-001 | PF/PT commodities | barley grain | P | Stores.grain; E-06 | stores | A | |
| P-002 | PF/PT commodities | tarmu or wheat | P | Stores.tarmu | stores | A | |
| P-003 | PF/PT commodities | flour and the mill (*nupištaš*) | P | E-07; miller job | town mill | A | |
| P-004 | PF/PT commodities | barley loaves (PF 2–4 "barley loaves(?)") | PA | bread baked at home; no state bakery issue | stores | A | |
| P-005 | PF/PT commodities | beer | P | E-08 | brewery | A | |
| P-006 | PF/PT commodities | wine of several kinds | P | E-02, E-09 | stores | A | |
| P-007 | PF/PT commodities | figs and fruit | P | E-10, E-46 | stores, orchards | A | |
| P-008 | PF/PT commodities | dates | M | see B-066 | stores | B | |
| P-009 | PF/PT commodities | sesame | P | E-11 | stores | A | |
| P-010 | PF/PT commodities | sesame oil pressing, oil jars, lamp oil | M | no press, no oil store | town | C (recollection that PF issues oil) | the lamps need fuel from somewhere |
| P-011 | PF/PT commodities | sheep and goats (stockyard) | P | E-12 | stockyard | A | |
| P-012 | PF/PT commodities | cattle (cows, calves) | M | only plough and cart oxen | plain, stockyard | C (PF cattle: recollection) | a plain of herds lacks cows |
| P-013 | PF/PT commodities | hides to the treasury | P | E-12 / CE-07 | Treasury | A | |
| P-014 | PF/PT commodities | hides worked into leather | M | no tanner or leatherworker | town | B | the chain stops at a counter |
| P-015 | PF/PT commodities | wool, shearing | P | shear act; fleece fixtures | folds | C | |
| P-016 | PF/PT commodities | milk, curds; milking performed | PA | plan text ("bread and curds"); no milking act | camps, villages | C | |
| P-017 | PF/PT commodities | poultry | P | fauna.json poultry | yards | B | |
| P-018 | PF/PT commodities | eggs | M | none | yards, royal table | C | |
| P-019 | PF/PT commodities | fish | M | none | Kur and Pulvar, table | C | river fish (Capoeta, barbels) caught today; a table item |
| P-020 | PF/PT commodities | honey | M | none | gardens | C | |
| P-021 | PF/PT commodities | salt | M | none | stores, from Maharlu or Bakhtegan | C | |
| P-022 | PF/PT commodities | silver paid in lieu (weighed) | PA | E-05; no balance | Treasury | B | |
| P-023 | PF/PT commodities | coins as money | AE | blocklist | — | B | correct |
| P-024 | PF/PT commodities | textiles and garments as issued goods | M | weaving exists; no issue or store of cloth | Treasury, stores | B | PT treasury textile work |
| P-025 | PF/PT commodities | tools issued and stored | M | none | stores, worksite | C | |
| P-026 | PF/PT commodities | fodder for horses and poultry | P | fodder fixtures; tend_animals | stables | B | |
| P-027 | PF/PT commodities | horse grain rations | P | population.json horse | stables | B | |
| P-028 | PF/PT commodities | travel rations (1–1.5 qa flour) | P | E-21 | station | B | |
| P-029 | PF/PT commodities | royal table supply | P | court.ts table, butchers (court setting) | court | B | |
| P-030 | PF/PT commodities | offerings (*lan*, gods, mountain, river) | P | E-30..32 | precinct, slope, bank | B/C | |
| P-031 | PF/PT commodities | *šip* feast | P | E-33 | precinct | B | |
| P-032 | PF/PT commodities | tax animals driven to Susa | P | E-13 | road W | A/B | |
| P-033 | PF/PT commodities | timber for the roofs (imported beams) arriving | M | scaffold timber only | road, worksite | B (DSf, Susa analogy) | roofs must come from somewhere |
| P-034 | PF/PT commodities | stone from the quarry | PA | drums "arrive" by event; no quarrymen, no transport seen | quarries, road | C | |
| P-035 | PF/PT occupations | grain handler (*tumara*), delivery man | P | E-06 participants | stores | A | |
| P-036 | PF/PT occupations | apportioner (*šaramana*), supplier | P | E-01 roles | stores | A | |
| P-037 | PF/PT occupations | wine carrier (PF 50) | P | E-02 | stores | A | |
| P-038 | PF/PT occupations | gold-and-silver shiners | P | polish_metal | Treasury | B | |
| P-039 | PF/PT occupations | goldsmiths forging and chasing | M | only polishing | Treasury workshops | B | |
| P-040 | PF/PT occupations | woodworkers | P | work_wood | yards | B | |
| P-041 | PF/PT occupations | stonecutters, masons (136 masons) | P | construction | Terrace | B | |
| P-042 | PF/PT occupations | plasterers and painters of walls | M | no plastering or painting act | Terrace, houses | B | fresh polychromy has to be applied |
| P-043 | PF/PT occupations | relief sculptors carving | PA | "relief carving" in E-61; carving act unclear | Hall of 100 Columns | C | |
| P-044 | PF/PT occupations | potters | PA | kiln stoked; no wheel or shaping | craft yard | B (PW kiln) | |
| P-045 | PF/PT occupations | pigment makers | P | craft variant pigment | PW Area B | B | |
| P-046 | PF/PT occupations | bone workers (bone pits) | PA | bone pits (site.ts); no worker act | PW Area B | B | |
| P-047 | PF/PT occupations | seal-cutters | M | none | Treasury workshops | C | |
| P-048 | PF/PT occupations | stone-vessel makers (Treasury stone vessels) | M | none | Treasury | C | |
| P-049 | PF/PT occupations | weavers, spinners | P | weave, spin | town | B | |
| P-050 | PF/PT occupations | brewers, millers | P | jobs | town | A | |
| P-051 | PF/PT occupations | shepherds, herdsmen, transhumants | P | E-49 camps | plain | A/C | |
| P-052 | PF/PT occupations | horse-keepers of the stations | P | groom | station | B | |
| P-053 | PF/PT occupations | guides of travelling parties | PA | E-21 party without a drawn guide | roads | B | |
| P-054 | PF/PT occupations | express messenger (*pirradaziš*) | P | E-20 | road | B | |
| P-055 | PF/PT occupations | magi and *šatin* priests | P | priest job | precinct | B | |
| P-056 | PF/PT occupations | female group heads (*arraššara*) | P | pasap template | town | B | |
| P-057 | PF/PT occupations | brick-makers | P | mould_brick | brickyard | B/C | |
| P-058 | PF/PT occupations | porters | P | porter job | stair foot | C | |
| P-059 | PF/PT occupations | healer (*asû* analogy) | P | E-72 | town | C | |
| P-060 | PF/PT occupations | interpreters, translators | M | none | Treasury, station | B (analogy) | a multilingual court needs them |
| P-061 | PF/PT occupations | accountants (a counting board) | PA | scribes only | Treasury | C | |
| P-062 | PF/PT occupations | laundress, water-carrier | P | wash, draw_water | river, wells | C | |
| P-063 | PF/PT occupations | quarrymen | M | quarries empty | Majdabad, Sivand | C | |
| P-064 | PF/PT occupations | fowlers, hunters, fishermen | M | none | reeds, rivers, steppe | C | |
| P-065 | PF/PT occupations | beekeepers | M | none | gardens | C | |
| P-066 | PF/PT occupations | merchants and traders with caravans | PA | caravans for the Treasury only; lanes "a little trade" | roads, town | C | |
| W-001 | walk: pre-dawn | cocks crowing | P | soundscape cockcrow | town | C | |
| W-002 | walk: pre-dawn | magus feeding the fire | P | E-30 | precinct | C | |
| W-003 | walk: pre-dawn | bakers firing ovens | P | household bake | houses | C | |
| W-004 | walk: pre-dawn | Venus as morning star | M | no planets | E sky | A | |
| W-005 | walk: pre-dawn | zodiacal light (false dawn) | M | none | E sky, autumn | A (physics) | |
| W-006 | walk: pre-dawn | hoarfrost on fields and roofs (winter) | M | none | plain | A (44 frost days) | |
| W-007 | walk: pre-dawn | breath visible in the cold | M | none | people | A (physics) | |
| W-008 | walk: dawn | mist on the rivers and the plain | P | mist days | plain | A/C | |
| W-009 | walk: dawn | partridges calling on the slope | PA | heard, not seen | Kuh-e Rahmat | B | |
| W-010 | walk: dawn | flocks led out; dust behind them | P | herd | plain | C | |
| W-011 | walk: dawn | ice on water jars and pools (winter) | M | none | houses, gardens | A/C | |
| W-012 | walk: morning | ration queues | P | queue | stores | B | |
| W-013 | walk: morning | pack strings on the royal road | P | traffic.ts | road | C | |
| W-014 | walk: morning | ford or bridge at the Kur | M | none | Kur | C | |
| W-015 | walk: morning | storks following the plough (autumn, spring) | M | none | fields | C | |
| W-016 | walk: morning | dew on grass and crops | M | none | fields | A (physics) | |
| W-017 | walk: noon | midday rest in the heat | P | E-64 | all | C | |
| W-018 | walk: noon | heat shimmer and mirage over the plain | M | none | plain, Jun–Sep | A (physics) | |
| W-019 | walk: noon | dust devils | M | none | fallow, summer | B (climate) | |
| W-020 | walk: noon | cicadas | P | soundscape | trees | C | |
| W-021 | walk: afternoon | kites over the middens | P | wildlife kite | town | C | |
| W-022 | walk: afternoon | vultures circling | M | none | sky, mountain | B | griffon and Egyptian vultures of the Zagros |
| W-023 | walk: dusk | lamps lit; smoke over the town | P | fire, haze | town | C | |
| W-024 | walk: dusk | flocks brought home and penned | P | herd return | villages | C | |
| W-025 | walk: dusk | bats | M | fauna.json | town, trees | B | |
| W-026 | walk: dusk | swifts screaming over the Terrace | PA | swallow/swift mesh, generic call | Terrace | C | |
| W-027 | walk: dusk | the Belt of Venus as it should look | PA | B44 (not pink) | sky | A | |
| W-028 | walk: night, moonlit | jackals | P | wildlife.ts | plain | B | |
| W-029 | walk: night, moonlit | wolves howling | WIP | beasts.ts uncommitted | mountain foot | B | |
| W-030 | walk: night, moonlit | dogs barking at a stranger | P | fauna.json dog | town | C | |
| W-031 | walk: night, moonlit | owls | PA | heard only | trees | C | |
| W-032 | walk: night, moonlit | nightjar | M | none | steppe, summer | C | |
| W-033 | walk: night, moonlit | nightingale in the gardens (spring) | M | none | paradise | C | |
| W-034 | walk: night, moonless | Milky Way, meteors | P | skySystem; meteors.ts | sky | A | |
| W-035 | walk: night, moonless | planets | M | — | sky | A | |
| W-036 | walk: night, moonless | watch fires; change of watch | P | E-80; torches | posts | C | |
| W-037 | walk: night, moonless | signal fires or beacons | M | none | mountain | C (HDT 9.3 claim) | |
| W-038 | walk: night, moonless | summer sleepers on the roofs | M | none | town roofs | C | |
| W-039 | walk: spring | steppe wildflowers (tulips, poppies, irises) | M | tree blossom only (seasonal.ts:185) | steppe, slopes | B (modern flora) | the most striking seasonal sight |
| W-040 | walk: spring | lambing, shearing | P | E-47, E-48 | folds | C | |
| W-041 | walk: spring | transhumants moving north | P | E-49 | roads | C | |
| W-042 | walk: spring | frogs chorusing | P | soundscape | water | C | |
| W-043 | walk: spring | cranes and geese migrating overhead | M | none | sky | B (Bakhtegan) | |
| W-044 | walk: spring | hail in thunderstorms | M | none | all | A (thunder peak Mar–Apr) | |
| W-045 | walk: summer | harvest, threshing, winnowing | P | E-41..43 | fields | B/C | |
| W-046 | walk: summer | river low or dry | P | E-51 | rivers | B | |
| W-047 | walk: summer | locust year | M | none | fields | C | |
| W-048 | walk: summer | bee-eaters seen | PA | heard only | riverbanks | B | |
| W-049 | walk: autumn | vintage and treading | P | tread variant | vineyards | C | |
| W-050 | walk: autumn | ploughing and sowing | P | E-40 | fields | B | |
| W-051 | walk: autumn | transhumants moving south | P | E-49 | roads | C | |
| W-052 | walk: autumn | nuts gathered on the slopes | M | plain.json notes it; not built | Kuh-e Rahmat | C | |
| W-053 | walk: winter | snow on the peaks | M | B-031 | skyline | B | |
| W-054 | walk: winter | canal clearing | P | E-50 | canals | C | |
| W-055 | walk: winter | wolves near the flocks | WIP | beasts.ts | pens | B | |
| W-056 | walk: winter | wintering ducks on the rivers | M | none | Kur, Pulvar | B | |
| W-057 | walk: any | stair climb to the Terrace top | P | terrace | Grand Stairway | A | |
| W-058 | walk: any | Terrace roof reached (tower stairs) | M | none; SITE_SPEC r_tower_extra | Apadana towers | B | the brief's walk ends on a roof |
| N-001 | natural: sky | solar eclipse (none in 467 at the site?) | — | not checked | — | — | |
| N-002 | natural: sky | lunar eclipse of 26/27 July 467 | P | commit 600c1d4 | sky | A | |
| N-003 | natural: sky | rainbows | P | rainShafts.ts | sky | A | |
| N-004 | natural: sky | 22° halo, sun dogs | M | none | sky with cirrus | A (physics) | |
| N-005 | natural: sky | comet of 467/466 (Pliny NH 2.149, with the Aegospotami stone) | M | none | sky | C (RECOLLECTION, NOT SEEN) | a period sky event |
| N-006 | natural: sky | airglow | P | skySystem | sky | C | |
| N-007 | natural: sky | crepuscular rays | PA | volumetric light; not verified | sky | C | |
| N-008 | natural: water | river turbidity in spate | P | rivers.ts turbidU | rivers | C | |
| N-009 | natural: water | flash run-off in the gullies of Kuh-e Rahmat | M | none | mountain gullies | C | |
| N-010 | natural: water | mountain springs or seeps | M | none | Kuh-e Rahmat foot | C | |
| N-011 | natural: water | reedbeds | P | riparian.ts:137 | riverbanks | B/C | |
| N-012 | natural: geology | limestone outcrops and scree | PA | B57 texture below the photo | mountain | A | |
| N-013 | natural: geology | quarry faces | P | quarries.ts | quarries | C | |
| N-014 | natural: geology | salt crusts, playas | M | none | low plain toward the lakes | C | |
| F-001 | fauna: river | fish | M | none | Kur, Pulvar | B | |
| F-002 | fauna: river | otter | M | none | Kur | B | |
| F-003 | fauna: river | Caspian turtle | M | none | canals, rivers | B | |
| F-004 | fauna: river | herons, egrets | M | none | banks | B | |
| F-005 | fauna: river | kingfisher | M | none | banks | C | |
| F-006 | fauna: river | dragonflies, mosquitoes | M | none | water | C | |
| F-007 | fauna: reedbed | wild boar | P | fauna.json | Pulvar reeds | B | |
| F-008 | fauna: reedbed | lion pride | WIP | beasts.ts | river reach | B | |
| F-009 | fauna: reedbed | jungle cat | M | none | reeds | B | |
| F-010 | fauna: reedbed | reed warblers | M | none | reeds | C | |
| F-011 | fauna: reedbed | frogs seen | PA | heard only | water | C | |
| F-012 | fauna: field | hares | M | none | fields | B | |
| F-013 | fauna: field | rodents (gerbils, voles) | M | none | fields | B | |
| F-014 | fauna: field | larks | M | none | fields | B | |
| F-015 | fauna: field | quail | M | none | crops | C | |
| F-016 | fauna: field | storks | M | fauna.json | fields, roofs | B | |
| F-017 | fauna: field | rooks and crows in winter fields | PA | crows at middens only | fields | C | |
| F-018 | fauna: steppe | gazelle on the open plain | PA | paradise only; SOUNDSCAPE §5 predicts the plain | steppe | B | |
| F-019 | fauna: steppe | onager herd | WIP | beasts.ts | steppe | B | |
| F-020 | fauna: steppe | cheetah | WIP | beasts.ts | steppe | B | |
| F-021 | fauna: steppe | red fox | M | none | steppe, town edge | B | |
| F-022 | fauna: steppe | tortoise | M | none | steppe, spring | B | |
| F-023 | fauna: steppe | snakes, lizards (agamas), scorpions | M | none | steppe, walls | B | |
| F-024 | fauna: steppe | sandgrouse, bustard | M | none | steppe | C | |
| F-025 | fauna: steppe | hedgehog, jerboa | M | none | steppe | C | |
| F-026 | fauna: rock slope | wild goat, ibex | M | none (relief figures only) | Kuh-e Rahmat | B | |
| F-027 | fauna: rock slope | wild sheep (urial) | M | none | Kuh-e Rahmat | B | |
| F-028 | fauna: rock slope | leopard | WIP | beasts.ts | ledges | B | |
| F-029 | fauna: rock slope | partridges seen | PA | heard only | slope | B | |
| F-030 | fauna: rock slope | rock doves | M | none | cliffs, Terrace | C | |
| F-031 | fauna: rock slope | wheatears, rock nuthatch | M | none | slope | C | |
| F-032 | fauna: rock slope | porcupine | M | none | slope | C | |
| F-033 | fauna: mountain | wolf pack | WIP | beasts.ts | mountain foot | B | |
| F-034 | fauna: mountain | striped hyena | WIP | beasts.ts | midden | B | |
| F-035 | fauna: mountain | brown bear | AE (in reach) | WIP row "none placed" | high Zagros | C | reasoned |
| F-036 | fauna: mountain | golden eagle, buzzard | P | wildlife raptor | sky | B | |
| F-037 | fauna: settlement | yard dogs, strays | P | fauna.json | town | C | |
| F-038 | fauna: settlement | hens, cocks | P | fauna.json | yards | B | |
| F-039 | fauna: settlement | sparrows | P | wildlife | courts | C | |
| F-040 | fauna: settlement | swallows nesting under eaves | PA | flying only | houses, porticoes | C | |
| F-041 | fauna: settlement | cats | AE/uncertain | blocklist later-animals "verify" | houses | C | logged, fine |
| F-042 | fauna: settlement | house mice, rats | M | — | stores | B | |
| F-043 | fauna: settlement | geckos | M | none | walls at night | C | |
| F-044 | fauna: settlement | fleas, lice (scratching) | M | none | people | C | |
| F-045 | fauna: settlement | domestic pigs | AE? | no hit; not argued | — | C | should be logged either way |
| F-046 | fauna: settlement | domestic ducks and geese | M | none | yards, table | C | |
| F-047 | fauna: sky | black kites | P | wildlife | town | C | |
| F-048 | fauna: sky | vultures | M | none | sky | B | |
| F-049 | fauna: sky | ravens | M | fauna.json | slope | C | |
| F-050 | fauna: sky | rollers, hoopoes seen | PA | hoopoe heard only | fields | C | |
| F-051 | fauna: domestic | horses, mules, donkeys | P | animals.ts | stables, roads | B | |
| F-052 | fauna: domestic | camels (Bactrian, dromedary) | P | traffic.ts | roads | C | |
| F-053 | fauna: domestic | sheep, goats | P | animals.ts | plain | A | |
| F-054 | fauna: domestic | oxen in the plough | P | plough act | fields | C | |
| F-055 | fauna: domestic | cows and calves | M | — | villages | C | |
| F-056 | fauna: domestic | trot or gallop | M | fauna.json "walk only" | roads, couriers | C | a relay courier never hurries |
| FL-001 | flora | plane, poplar, willow, tamarisk | P | trees.json | rivers, gardens | B | |
| FL-002 | flora | fruit trees (fig, apple, pear, pomegranate, mulberry, olive) | P | trees.json | orchards | B | |
| FL-003 | flora | oak, almond, pistachio woodland | P | trees.json | slopes | B | |
| FL-004 | flora | cypress | P | trees.json | gardens | B | |
| FL-005 | flora | vines | P | trees.json | vineyards | B | |
| FL-006 | flora | walnut | M | none | gardens, villages | C | |
| FL-007 | flora | juniper | M | none | higher slopes | C | |
| FL-008 | flora | tragacanth and thorn cushions, camelthorn | M | none | steppe, slopes | B (Artemisia pollen) | |
| FL-009 | flora | Artemisia and grass steppe | P | landcover steppe | plain | B | |
| FL-010 | flora | garden vegetables (onion, garlic, leek, cress) | PA | named in food text only (population.ts:4224) | house gardens | C | |
| FL-011 | flora | pulses (lentils, chickpeas) | M | none | fields | C | |
| FL-012 | flora | melons, cucumbers | M | none | irrigated plots, summer | C | |
| FL-013 | flora | flax | M | linen in dress only | fields | C | |
| FL-014 | flora | rice | AE | Q-013 | — | C | |
| FL-015 | flora | date palms on the plain | AE | 44 frost days | — | C | |
| FL-016 | flora | roses and flowers in the paradise | M | none | paradise | C | |
| FL-017 | flora | lotus or water lilies in pools | M | fields.ts hit is not a plant | paradise pools | C | |
| S-001 | settlement/institutions | the road station and its *halmi* check | P | E-21, access | station | B | |
| S-002 | settlement/institutions | a market or exchange place | PA | abstract barter (lives.json exchange_in_kind) | town square | C | |
| S-003 | settlement/institutions | latrines and cesspits | M | sources.json cites Babylon-Merkes; none built | houses | B (analogy) | |
| S-004 | settlement/institutions | bath or washing room in elite houses | M | none | elite houses | C | |
| S-005 | settlement/institutions | scribal school | M | none | town | C | |
| S-006 | settlement/institutions | boys' education in riding and archery (HDT 1.136) | P | train; riding practice | training ground | B | |
| S-007 | settlement/institutions | dispute before an official | P | E-74 | official building | C | |
| S-008 | settlement/institutions | punishment | AE (shown) | brief restraint: never shown | — | — | |
| S-009 | settlement/institutions | household cult of foreign workers (Babylonian, Egyptian) | M | Q-471 open | houses | C | |
| S-010 | settlement/institutions | tomb cult at Naqsh-e Rustam | M | none | NR | B (Arrian, Cyrus tomb analogy) | |
| S-011 | settlement/institutions | workmen at the Xerxes façade | M | none | NR | C | |
| S-012 | settlement/institutions | quarry camp | M | none | quarries | C | |
| S-013 | settlement/institutions | royal hunt in the paradise (court) | M | none | paradise | B (Xenophon claim) | |
| S-014 | settlement/institutions | cemeteries | P | settlement.json | town edge | C | |
| S-015 | settlement/institutions | wedding procession | P | E-73 | lanes | C | |
| S-016 | settlement/institutions | board game (twenty squares) | M | none | guards' mess, doorsteps | C (recollection) | |
| S-017 | settlement/institutions | Persian washing rule (HDT 1.138) | PA | offerings obey it; garrison washes clothes in the river (population.ts:3089) | river | B claim | internal conflict |
| SO-001 | sound | horse whinny and snort | M | STRIKE_KINDS | stables, roads | C | |
| SO-002 | sound | cattle lowing | M | — | plain | C | |
| SO-003 | sound | camel grumble | M | — | caravans | C | |
| SO-004 | sound | hooves, cart wheels, harness | M | — | roads | C | |
| SO-005 | sound | infants crying | M | — | houses | C | many babies are carried and none cry |
| SO-006 | sound | children shouting at play | PA | voices only | lanes | C | |
| SO-007 | sound | coughs, sneezes, sickness | M | — | houses | C | |
| SO-008 | sound | smithy hammer, bellows, kiln roar | M | — | workshops | C | |
| SO-009 | sound | door pivots, bolts | M | — | houses, palaces | C | |
| SO-010 | sound | wolves, lion, hyena, leopard | WIP | soundscape.ts diff | plain, mountain | C | |
| SO-011 | sound | crowd bed beyond 60 m | M | PROGRESS (D-245) | court assembly | C | |
| SO-012 | sound | crane calls overhead | M | — | sky | C | |

That is 239 rows. At HEAD the count is roughly 107 PRESENT, 34 PARTIAL, 82 MISSING, 8 ABSENT-BY-EVIDENCE and 8 WIP. N-001 is a blank row I did not check, so it counts toward the total only.

## Proxy hunt: how some PASS rows could pass while the intent fails
- **Treasury weighing, kiln and pigment work** (B-095, P-022). Each passes the activity lint because some performance exists. `inspect` stands in for weighing with nothing in the hands, and the lint only asks whether a performance exists, not whether it fits.
- **Forge fittings** (B-037). A lit fire counts as the brief's smithy with nobody at it.
- **Snow** (B-032). Forced "snow" views put snow everywhere and so hide the missing elevation line. The default seed never snows.
- **Villages** (B-023). They count toward coverage as "areas", while the render is boxes.
- **Birds, jackals and animal sounds** (fauna rows). Closed-form paths can still read as mechanical patrols. None has been rendered or judged in motion.
- **Market** (S-002). The plan text says "a little trade"; nothing on screen shows goods.

## Detector escapes to log (REVIEWS/escapes.md, T-R0)
- Silver weighing performed as `inspect` without a balance (activity lint).
- A lit forge with no smith (the fire and schedule checks).
- The snow check is by state, not elevation (sky and weather tests).
- No planets in the sky (the sky test covers the sun and moon only).
- The HDT 1.138 conflict (no chronology or ethic lint catches it).
- The river crossing: walk bots never go from the Kur to the Terrace along the roads.

## What this sample cannot tell you
Every row comes from code and data, not from a render or a recording. A PRESENT row may still look or sound false. The WIP beasts may land or be reverted after this report.

## Files
- /home/user/fars/src/world/plain/villages.ts:188
- /home/user/fars/src/data/settlement.json:503
- /home/user/fars/src/world/settlement/plan.ts:164
- /home/user/fars/src/weather/weatherState.ts:53
- /home/user/fars/src/render/materials.ts:933
- /home/user/fars/src/sky/skySystem.ts
- /home/user/fars/src/data/fauna.json
- /home/user/fars/src/world/wildlife.ts
- /home/user/fars/src/world/beasts.ts (uncommitted)
- /home/user/fars/src/world/settlement/site.ts:26 (crafts)
- /home/user/fars/src/world/settlement/quarter.ts:345 (forge)
- /home/user/fars/src/people/population.ts:3089, 3737, 3825
- /home/user/fars/src/people/activities.ts:112-256
- /home/user/fars/src/audio/soundscape.ts:142
- /home/user/fars/src/people/calendar.ts:198 (Stores)
- /home/user/fars/src/data/plain.json (crops.dates)
- /home/user/fars/src/world/plain/quarries.ts
- /home/user/fars/src/people/construction.ts:104
- /home/user/fars/src/world/plain/naqsh.ts
