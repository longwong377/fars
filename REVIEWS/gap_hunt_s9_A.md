
# Gap hunter A, session 9: report (HRAF Outline of Cultural Materials, plus the natural world by kingdom)

Branch claude/amazing-fermi-40ds7j, HEAD 2f9b5da. I made no edits and ran no tests or renders; I only read files and ran grep.

## 0. What this report can and cannot tell you (brief clauses 1–9)

- **Calibration (clause 7) could not be done.** `REVIEWS/anchors/INDEX.md` does not exist; the `REVIEWS/anchors/` directory is missing. This gap hunt was given no frames, so no anchors were scored and I had nothing to be blind to.
- **Lens, motion, sound and time (clauses 2–4) do not apply.** I saw no frame or clip.
  - Every status below comes from code and data: `src/`, `src/data/*.json`, `research/*.md`, `PROGRESS.md`, `BLOCKERS.md`.
  - PRESENT means built in code. It does not mean seen on screen. `PROGRESS.md` says most of this has never been rendered or heard in a browser (B65, D-244, D-245).
  - I sampled no month, hour or weather. Every seasonal row is judged from the data's calendars.
- **References (clause 6):** I checked `references/INDEX.md` for anything on flora, fauna or land. Relevant items: #23 "persepolis and plain" (spring green), "persepolis from a distance" (dry grass, a lone tree) and the Apadana relief photos (animal imagery). No reference covers the wild fauna, insects or crops. Where I say a species was present from memory, that is marked **C (recollection, not verified: the scholarly hosts are blocked, B6)**.
- **Scope (clause 1):** this is a whole-world list. It cannot tell you how any existing item looks, sounds or behaves on screen.
- **Other builders were working at the same time.** The working tree has uncommitted changes:
  - `?? src/world/beasts.ts`, `M src/people/animals.ts`, `M src/world/fauna.ts`, `M src/world/world.ts` add wolves, a leopard, a lion pride, hyenas, onagers and cheetahs.
  - I mark these **PARTIAL (in flight, uncommitted, unverified)**.
  - Their header says "every species row is in src/data/fauna.json", but `fauna.json` is not modified and has no such rows. The tier trail (rule §3.2) is broken as it stands.
- **Proxy hunt (clause 8):** for PRESENT rows, the usual way to pass while the intent fails is "exists in the simulation or data but is never drawn or heard where a walker is". Examples: the fauna sounds are synthesised and unheard (B65); frogs exist only as sound; the sim's "garden beds" grow nothing named. Detector escapes: no detector on the board checks species or activity *coverage against an outside taxonomy*. `lint:activity` checks only that listed activities have animations. Every MISSING row below is therefore a T-J6 escape by construction: the inventory has no row that could fail.

## 1. Problems first: the biggest MISSING rows, ranked by how much their absence breaks the time capsule for a walker

1. **No visible small life anywhere (A150–A168).**
   - Missing: flies at dung and middens (sound only; D-210 lists them "not built"), bees at flowers and gardens, butterflies, dragonflies at the canals, ants on the threshing floors, lizards (agamas) on sun-warmed stone, geckos on walls at lamp-light, tortoises on the steppe, snakes, scorpions, snails after rain, mosquitoes and gnats at the water, moths at lamps.
   - Every warm-month walk anywhere in the world meets these within seconds. Their absence is the most "sterile set" cue left.
2. **The commonest birds are missing (A120–A140).** The birds built are swallows, sparrows, crows, kites and raptors (`src/world/wildlife.ts`); partridges, hoopoe and bee-eater are sound only. Missing:
   - doves and pigeons in the town and on the Terrace;
   - larks over every field and steppe;
   - storks (logged not built, D-210);
   - winter cranes, geese and ducks;
   - herons and egrets at the canals;
   - vultures over middens and the magi's exposure ground;
   - kestrels nesting in the buildings;
   - nightingales and bulbuls in the gardens;
   - jackdaws and choughs on the Kuh-e Rahmat cliffs.

   **Winter has almost no bird life of its own**: kites and swallows leave, and nothing arrives.
3. **Roads cross the Pulvar and Kur with no ford, bridge or ferry (A061).** `settlement.json` says "Crosses the Pulvar (ford or bridge, C)", but there is no geometry and no crossing behaviour (`src/world/plain/rivers.ts`, `water.ts`). A walker following the Naqsh-e Rustam or royal road meets a river the road simply runs into.
4. **The whole HRAF "food quest" category is absent (A001–A006).** There is no hunting of any kind, no fowling, no fishing in the Pulvar, Kur or canals, no gathering of wild nuts, acorns or greens, and no bee-keeping or honey.
   - Hunting was the defining Persian noble pastime (Xenophon, *Cyropaedia* 1.2.9–10; the paradise game; Achaemenid seal hunt scenes). **B claim / C recollection.**
   - The in-flight lions and onagers exist, but nobody hunts them.
5. **Large wild mammals are only in flight, uncommitted and unverified, and several are still missing (A100–A118).**
   - The calendar itself names month 9 **\*Vṛkazana, "wolf-killing"** (`events_calendar.json` l.32), yet no wolf and no wolf-killing is committed.
   - Missing outright: hare, red fox, the wild goat and wild sheep of Kuh-e Rahmat (in SOUNDSCAPE §5's Bamu list, B), gazelle on the open plain (SOUNDSCAPE §5 infers this; the build has gazelles only inside the paradise), porcupine, hedgehog, rodents and bats (logged not built).
6. **Quarries are empty workings (A046).** `src/world/plain/quarries.ts` builds cut faces, blocks and spoil with no quarrymen. Drums "arrive" as sim events (`src/people/construction.ts`) with no stone transport on the plain roads. The Terrace was being built in 467, and its supply chain is invisible where a walker would meet it.
7. **Known unbuilt homes and workplaces (B63, B64):**
   - the transhumant bands' black tents;
   - the garrison's rooms;
   - the mill (nupištaš) facility;
   - the village compounds, which are solid boxes (`plain/villages.ts compoundBoxes`).

   A walker entering any village meets solid geometry.
8. **Crops beyond cereals, sesame, vines and fruit trees are missing (A200–A212).** Missing: pulses (lentil, chickpea, bitter vetch, pea, broad bean), flax, millet, alfalfa ("Median grass", horse fodder), onions and garlic, cucurbits.
   - The Old Persian month name Θāigraciš means **"garlic-collecting"** (`events_calendar.json` l.27), yet nobody collects garlic.
   - The "garden beds" of town and village grow nothing named (`lives.json`). The fields read as a cereal monoculture.
9. **The spring flora of steppe and mountain is only a colour (A220–A232).** `season.ts` and `plain/seasonal.ts` model a single green/straw herb layer. There are no tulips, poppies, anemones, irises or crown imperial (*Fritillaria*), no tragacanth (*Astragalus*) cushions, no giant fennel (*Ferula*) stalks on the slopes, and no thistles or camelthorn in summer stubble.
   - Missing trees of the Zagros oak woodland and of orchards: walnut, wild pear, hawthorn, *Celtis*, montpellier maple, *Pistacia khinjuk*, quince, plum/apricot, jujube.
10. **Human non-speech sound is missing (A300–A306).** No babies crying, no laughter, no shouting across fields or lanes, no calling to animals, no lullabies, no lament at deaths, no coughing among the sick. The voices are published lines only (B66). A town of 7,830 with no crying child is a strong "fake" cue.
11. **Weather and sky phenomena (A400–A410).** Missing:
    - a **snowline** (snow cover is one uniform scalar; the far Zagros peaks should be white from Dec to Mar while the plain is bare);
    - ground frost and ice on 44 frost days a year;
    - visible breath on cold mornings;
    - **planets** (Venus, Jupiter, Saturn and Mars are not drawn; the stars are HYG only, `skySystem.ts`);
    - dust devils on the summer plain;
    - heat shimmer;
    - hail;
    - halos and sun dogs.
12. **The religious landscape has deliberate holes that D-207 says to fill.**
    - No tomb guardians or tomb cult at Naqsh-e Rustam: `access.json` l.837 "none is placed", although Arrian 6.29 attests magi keeping Cyrus's tomb with royal rations (B claim, the Pasargadae analogy).
    - The magi's attested killing of "ants, snakes, creeping things and birds" (Herodotus 1.140, B claim) is not shown.
    - Garlic month, wolf-killing month and the Bāgayādiš festival appear only as names or feasts.
13. **Missing crafts and household animals (A500–A512, A140–A146).** Crafts: tanning (hides go to the Treasury, but nobody tans them), lime burning (the Terrace plasters), charcoal burning (the braziers burn charcoal), seal cutting, rope and basket making, felt making. Animals: no cats (mice at the stores), no cattle herds (cows and calves; only work oxen), no ducks or geese.
14. **Smaller daily-life gaps.** No summer roof sleeping (Q-650, open). No latrines or cesspits. No dance. No adult games or board games. No wrestling or adult sport beyond archery. No divorce, widow remarriage or fostering paths checked. No theft or guarding against it beyond the grain-heap watch.

## 2. Full table

Status key: PRESENT / PARTIAL / MISSING / ABSENT-BY-EVIDENCE.

Tier = the evidence tier for the item existing in 467: A attested, B inferred or a Greek claim, C reconstruction. "Rec." = my recollection, not verified.

### Food quest (HRAF 22)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A001 | Royal and noble hunt (horse, bow, spear) | MISSING | none; `fauna.json` cites Xen. Anab. 1.2.7 only for game | paradise, steppe, river thickets | B (Xen. Cyr. 1.2.9–10 claim; seal hunt scenes, rec.) | Defining elite activity; the in-flight lions and onagers have no hunters |
| A002 | Commoners snaring partridge and hare | MISSING | none | village edges, slopes | C | Everyday food and boys' work |
| A003 | Fishing (nets, lines, traps) in Pulvar, Kur and canals | MISSING | no fish or fishing anywhere | river banks | C (Kur-basin cyprinids, rec.) | Rivers have no life and no users |
| A004 | Wild pistachio and almond nut gathering, Aug–Sep | MISSING (data note only) | `plain.json` crops.pistachio_almond "nuts gathered Aug-Sep (C)"; no activity | Kuh-e Rahmat scrub | C | The data states it; the sim does not do it |
| A005 | Acorn gathering (Brant's oak) and wild greens, herbs, truffles | MISSING | none | oak woodland, steppe in spring | C (Zagros ethnography, rec.) | Seasonal foraging |
| A006 | Bee-keeping, honey | MISSING | none (SOUNDSCAPE §6 "bees ... inference") | gardens, villages | C | Also no bees at all (A151) |
| A007 | Garlic collecting (month Θāigraciš) | MISSING | `events_calendar.json` l.27 gloss only | fields and steppe, June | A (month name) / C (act) | The calendar names an act nobody performs |

### Animal husbandry (HRAF 23)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A020 | Sheep and goat flocks, folds, milking, shearing, lambing | PRESENT | `population.ts` (E-47, E-48), `fauna.ts`, `animals.ts` | stockyard, villages, camps | A | — |
| A021 | Transhumant bands passing (E-49) | PARTIAL | sim present; tents not built (B63); band on the road not drawn (`fauna.json` travel.not_drawn) | plain edge | B | Seasonal pulse of the plain |
| A022 | Donkeys, mules, horses, camels | PRESENT | `animals.ts`, `traffic.ts`, `terraceFoot.ts` | roads, stair foot, stable | B | — |
| A023 | Work oxen (plough, cart, threshing) | PRESENT | `activities.ts` l.96, 219, 225 | fields, floors | C (Q-193) | — |
| A024 | Cattle herds: cows, calves, dairy cattle | MISSING | "cattle are not in population.json: Q-193" | villages, river meadows | C | Oxen with no cows is biologically impossible |
| A025 | Poultry: hens, cocks, state yard | PRESENT | `fauna.json` poultry, `fauna.ts` | yards | B | — |
| A026 | Ducks and geese (PF bird fodder texts) | MISSING | none | state yard, canals | C (PF bird texts, rec.) | Royal-table birds |
| A027 | Dogs (yard, herd, stray) | PRESENT | `fauna.json` dog, `fauna.ts` | town, flocks | B | — |
| A028 | Domestic cat | MISSING | none | stores, houses | C | Mice at the grain stores imply them |
| A029 | Pigs | ABSENT-BY-EVIDENCE (weak) | not in PF commodity lists as far as known | — | C (rec.) | Keep absent; log it |
| A030 | Fodder heaps and mangers | PRESENT | `houseplan.ts` fodder and tether, `terraceFoot.ts` | courts, stair foot | C | — |
| A031 | Alfalfa ("Median grass") fodder fields | MISSING | none | irrigated plots near the stable | B (Strabo 11.13.7 claim, rec.) | Horses need it; changes the field mosaic |
| A032 | Veterinary care (sores, lameness) | PRESENT | `population.ts` "seeing to the donkeys' sores and the lame sheep" | camps | C | — |
| A033 | Royal horse pastures and studs | MISSING | none | river meadows | C | Horses at the scale of the court |
| A034 | Animal branding or marking | MISSING | none | stockyard | C | Minor |
| A035 | Dung collection, dung cakes | PRESENT | `population.ts`, `houseplan.ts` dungcakes | courts, walls | C | — |

### Food processing, drink, eating (HRAF 24–27)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A040 | Querns and household grinding | PRESENT | `population.ts` | houses, camps | B | — |
| A041 | Bread ovens, flat bread | PRESENT | `population.ts`, `houses.ts` oven | houses | C | — |
| A042 | The mill facility (E-07) | PARTIAL | sim present; building NOT BUILT (B63) | town | B | People vanish from it in rain |
| A043 | Brewing beer from tarmu | PRESENT | `town.json` brewery, `population.ts` | town | A | — |
| A044 | Wine: vintage, treading, jars | PRESENT | E-45, `population.ts` | vineyards | B | — |
| A045 | Sesame oil pressing | MISSING | E-11 moves sesame; no press | town, villages | B (sesame in PF) / C (press) | Oil is the exchange good in the lanes |
| A046 | Dairy: churning, curds | PRESENT | `population.ts` | camps, houses | C | — |
| A047 | Cheese making and drying | MISSING | none | camps | C | Minor |
| A048 | Drying figs, raisins and fruit on roofs and mats | PARTIAL | `houseplan.ts` roof things; no fruit-drying activity found | roofs, Aug–Oct | C | Visible late-summer trace |
| A049 | Butchery, the šip meat share | PRESENT | E-12, E-33 | stockyard, open ground | A | — |
| A050 | Grain storage (pits, bins, jars) in villages | PARTIAL | town store present; village stores inside solid boxes (B64) | villages | C | — |
| A051 | Meals, the midday bread carried to the fields | PRESENT | `population.ts` | everywhere | C | — |
| A052 | Feasts: wedding, birthday, šip | PRESENT | E-33, E-35, E-37, E-73 | — | A/B/C | — |
| A053 | Symposium-style drinking among elites (Hdt 1.133) | MISSING | none | estates | B claim | Elite evening life |
| A054 | Salt (source, trade) | PARTIAL | "salt" appears in 21 files; no salt trade or supply seen | — | C | Minor |

### Clothing and adornment (HRAF 28–30)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A060 | Persian, Median, working and women's dress | PRESENT | `outfits.ts`, `looks.ts` | all | B/C | — |
| A061 | River crossing: ford, bridge or ferry on the roads (row filed here by number; belongs under transport) | MISSING | `settlement.json` l.503 "ford or bridge, C"; no geometry | Pulvar (Naqsh road), Kur (royal road, S road) | C | Walker hits a road that ends in water |
| A062 | Cold-weather dress | PRESENT | `outfits.ts` COLD_C, weatherMask | all | C | — |
| A063 | Earrings, bracelets, torques, kohl | PRESENT | `outfits.ts` l.346–347, `looks.ts` | — | B/C | — |
| A064 | Footwear | PRESENT | `outfits.ts` | — | C | — |
| A065 | Barefoot poor and children | MISSING | none | lanes, fields | C | Social texture |
| A066 | Mourning dress and signs (torn garments, shorn hair; Hdt 9.24) | MISSING | none | houses of the dead | B claim | Death has no visible mark on the living |
| A067 | Tattooing (Thracian envoys, Hdt 5.6) | MISSING | none | delegations | B claim | Minor |
| A068 | Fly-whisks and parasols for the elite | PARTIAL | relief figures and props | court | A (reliefs) | — |

### Settlements, buildings, housing, equipment (HRAF 33–36)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A070 | Terrace buildings (Gate, Apadana, Tachara, Hadish, Hall of 100 Columns, Tripylon, Treasury, Harem, garrison, fortification) | PRESENT | `site_spec.json` | Terrace | B/C | — |
| A071 | Town courtyard houses with interiors | PARTIAL | `houses.ts`, `houseplan.ts` (D-234: hearths, lamps, beds, niches) | town | C | Unrendered |
| A072 | Village compounds | PARTIAL | solid boxes (B64) | villages | C | Sleepers inside solid geometry |
| A073 | Garrison rooms | MISSING | B63 | Terrace | B | People undrawn |
| A074 | Transhumant black tents | MISSING | B63 | camps | C | — |
| A075 | Court camps and tents | PRESENT | `courtCamps.ts` | below the Terrace | C | — |
| A076 | Roofs: poplar poles, mats, earth, ladders | PRESENT | `settlement.json` house_roofs | town | C | — |
| A077 | Summer roof sleeping | MISSING | Q-650 open | town, villages | C (strong regional analogy) | Summer nights |
| A078 | Latrines, cesspits | MISSING | drains only (`houseplan.ts` l.170) | houses | C (Babylonian analogy B) | Hygiene trace |
| A079 | Wells | PRESENT | `settlement.json` town_wells | squares | C | — |
| A080 | Qanats | ABSENT-BY-EVIDENCE | `plain.json` l.40 (QANAT-WH2018; Q-052) | — | B | Polybius 10.28 claims Achaemenid qanat grants; the conflict is logged |
| A081 | Water-lifting device (shaduf) | MISSING | none | canals, gardens | C (Mesopotamian analogy) | Garden irrigation |
| A082 | Terrace drains and cisterns | PRESENT | `waterworks.ts` | Terrace | B | — |
| A083 | Paradise and pavilions | PRESENT | `plan.ts` l.225–280 | Bagh-e Firuzi | C | — |
| A084 | Way-station | PRESENT | `settlement.json` waystation_plan | Kur crossing | C | — |
| A085 | Furniture (court chairs, stools, mats, chests) | PARTIAL | `workObjects.ts`, `furnish_palaces.ts`; town interiors partial | — | C | — |
| A086 | Scribes' lamp lit | MISSING | PROGRESS "the scribes' lamp is never lit" | Treasury | C | — |
| A087 | Points of light in the town at dusk | PARTIAL | B49 | town | C | — |
| A088 | Field watchers' reed huts | PRESENT | "the watchers' reed hut" in `population.ts` | fields | C | — |
| A089 | Scarecrows and bird-scaring | PARTIAL | "scaring the birds off" activity only | fields | C | — |

### Energy, crafts, tools (HRAF 37–41)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A090 | Fuel: brushwood, dung, kept fire | PRESENT | `population.ts` | — | C | — |
| A091 | Charcoal burning | MISSING | braziers burn charcoal (`fire.ts`); no production | oak woodland | C | Smoke columns on the mountain |
| A092 | Lime burning and plaster production | MISSING | none | near the Terrace | B (plastered floors) / C (kiln) | Supply chain of the building |
| A093 | Pottery (kiln, wheel) | PRESENT | `population.ts` craftsman kiln, `houses.ts` | Area B | B | — |
| A094 | Pigment workshop | PRESENT | `population.ts` (PW2017) | Area B | B | — |
| A095 | Metalwork forge | PARTIAL | `houses.ts` forge kind, `quarter.ts` | town | B (treasury craftsmen) | Not seen working |
| A096 | Goldsmiths and silversmiths | PARTIAL | "shining gold and silver" | Treasury | B | — |
| A097 | Carpentry and joinery at work | PARTIAL | `quarter.ts` timber stack only | workshops | B (HENK2023) | — |
| A098 | Tanning | MISSING | hides delivered (`workObjects.ts` l.57) | downstream, town edge | B (hides) / C | Smell and trace |
| A099 | Seal cutting | MISSING | none | Treasury, workshops | A (thousands of seals) / C place | An archive culture needs seal cutters |
| A500 | Rope and basket making | PARTIAL | mending only | houses | C | — |
| A501 | Felt making | MISSING | none | camps | C | Felt caps and tents |
| A502 | Weaving and spinning | PRESENT | `population.ts` | — | B | — |
| A503 | Dyeing | PRESENT | "washing and dyeing wool" | water | C | — |
| A504 | Stone dressing and relief carving | PRESENT | `construction.ts`, `crowd.ts` | Hall of 100 Columns | B | — |
| A505 | Quarrying and quarrymen | MISSING | `quarries.ts` empty workings | Majdabad, Sivand | B | — |
| A506 | Drum transport from the quarry across the plain | MISSING | drums "arrive" as events | roads | C | — |
| A507 | Mud-brick moulding | PRESENT | E-63 | river | C | — |
| A508 | Woodcutting and timber import (cedar) | PARTIAL | timber stack | — | B | — |
| A509 | Threshing sledge (tribulum) | MISSING | animals tread only | floors | B (Near Eastern analogy) | — |
| A510 | Ards, hoes, sickles, forks | PRESENT | `activities.ts`, `props.ts` | — | C | — |
| A511 | Masons' marks | PRESENT | `marks.ts` | Terrace | B | — |
| A512 | Bow and arrow making | PARTIAL | props only | — | B | — |

### Property, exchange, transport, travel (HRAF 42–49)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A513 | Exchange in kind in the lanes, a pedlar | PRESENT | `lives.json` l.25, 76 | town | C | — |
| A514 | Marketplace | ABSENT-BY-EVIDENCE | `lives.json`, blocklist | — | B (Hdt 1.153 claim) | — |
| A515 | Weighed silver, balance | PRESENT | `population.json` shekel | Treasury | A/B | — |
| A516 | Coins in everyday use | ABSENT-BY-EVIDENCE | blocklist coins-everyday | — | B | — |
| A517 | Caravans, couriers, halmi parties | PRESENT | `traffic.ts`, E-20, E-21 | roads | A/B | — |
| A518 | Carts, the royal chariot, harmamaxai | PRESENT | `fauna.json` court_vehicles | — | B/C | — |
| A519 | Boats or rafts (kelek) | MISSING | none | river crossings | C | Only if a crossing needs one (A061) |
| A520 | Road traffic to Pasargadae and Naqsh-e Rustam | PARTIAL | roads built; traffic mainly W and S | — | C | — |
| A521 | Travellers' lodging at the station | PRESENT | "resting at the station lodging" | station | C | — |
| A522 | Signal fires and beacons | MISSING | none | heights | B claim (De Mundo) / C | Minor |
| A523 | Field boundary marks | MISSING | none | plain | C | Minor |

### Arts, recreation, language, communication, records (HRAF 51–54, 20–21)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A524 | Music: frame drum, pipe, harp; wordless singing | PARTIAL | B20, `performers.ts` | — | B/C | — |
| A525 | Dance (weddings, festivals) | MISSING | none | courtyards, šip | B (Xen. Anab. 6.1 claim) / C | Festivals are static |
| A526 | Storytelling | PRESENT | "telling of the road" | fires | C | — |
| A527 | Recitation of songs of heroes to the young (Strabo 15.3.18) | MISSING | none | — | B claim | — |
| A528 | Children's games: knucklebones, ball, top, clay animals | PRESENT | `activities.ts` | lanes | B/C | — |
| A529 | Adult games (board games, knucklebones) | MISSING | none | lanes, guard posts | B (Mesopotamian 20-squares analogy) | Guards' idle hours |
| A530 | Wrestling, races, riding contests | MISSING | none | open ground | C | — |
| A531 | Archery and riding practice | PRESENT | Hdt 1.136, Xen. Cyr. 1.2.12 | — | B | — |
| A532 | Languages spoken, carved inscriptions | PRESENT | Phase 8 | — | A | — |
| A533 | Laughter, crying, shouting, calling animals | MISSING | no hits | everywhere | C | Mute human texture |
| A534 | Lullabies, lament | MISSING | no hits for either | houses, funerals | C | — |
| A535 | Tablets written and sealed | PRESENT (reconstructed text) | B18, `writing.json` | Treasury | A form / C text | — |
| A536 | Aramaic on leather | PARTIAL | "the Aramaic leather sheet carries no writing" | Treasury | B | — |
| A537 | Heralds | PRESENT | court | — | C | — |

### Family, kinship, community, society (HRAF 55–62)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A538 | Households, kin visits, neighbours | PRESENT | `population.ts` | — | C | — |
| A539 | Marriage (dowry, procession, feast) | PRESENT | E-73 | — | C | — |
| A540 | Polygyny and concubinage (Hdt 1.135) | MISSING | none | elite houses | B claim | Elite household form |
| A541 | Divorce, widow remarriage, fostering orphans | MISSING (wet-nurse present) | only "widow" in `population.ts` | — | C | — |
| A542 | Festivals (opening of the year, Bāgayādiš, days off) | PRESENT | E-33, E-38 | — | A name / C form | — |
| A543 | Village headman and elders' council | MISSING | none | villages | C | — |
| A544 | Named people with lives | PRESENT | `lives.json`, `names.json` | — | A/C | — |

### Territorial organisation, state, law, justice, war (HRAF 63–72)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A545 | Treasury, officials, rations, receipts | PRESENT | E-01 to E-15 | — | A | — |
| A546 | Tax animals driven to Susa | PRESENT | E-13 | road | A | — |
| A547 | Kurtaš work groups and camps | PRESENT | `population.json` | — | A | — |
| A548 | The court's arrival and departure | PRESENT | E-25, E-26, D-252 (merged, unverified) | — | C | — |
| A549 | Delegations | PRESENT | `delegations.json` | — | B | — |
| A550 | Disputes and hearings with witnesses | PRESENT | E-74, `population.ts` | official building | C | — |
| A551 | Oaths | PARTIAL | `exchanges.ts` | — | C | — |
| A552 | Theft and guarding against it | PARTIAL | grain-heap watch only | — | C | — |
| A553 | Sanctions shown | ABSENT by policy | `access.json` "NO punishment shown" | — | — | Brief §12; correct |
| A554 | Garrison, guard rota, change of watch | PRESENT | E-80, E-81 | — | B/C | — |
| A555 | Armoury (the Treasury's weapon stores) | PARTIAL | `site_spec.json`, props | Treasury | A (Schmidt finds, rec.) | — |
| A556 | Cavalry exercise and muster | MISSING | none | plain | C | — |

### Health, death, religion (HRAF 73–79)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A557 | Sickness, the quarter's healer | PRESENT | E-72, `population.ts` l.1404 | — | C | — |
| A558 | Court physicians (Egyptian, Greek) | PARTIAL | `lives.json` mention | court | B | — |
| A559 | Visible disability, old-age frailty, walking sticks | PARTIAL | stick in `workAnims.ts`; no blind or lame people | — | C | Nobody is disabled |
| A560 | Coughing and sickness sounds | MISSING | none | — | C | — |
| A561 | Funeral, burial ground, magi's exposure | PRESENT | E-71, `town.json` | — | B/C | — |
| A562 | Lament | MISSING | no hits | — | C | — |
| A563 | Rock tombs of Naqsh-e Rustam | PRESENT | `naqsh.ts` | — | A | — |
| A564 | Tomb guardians and tomb cult | MISSING | `access.json` l.837 deliberately none | Naqsh-e Rustam | B (Arrian 6.29 analogy) | A probable reconstruction exists (T-J7) |
| A565 | Fire altar, kept fire, magi, lan, offerings to mountain and river | PRESENT | E-30, E-31, precinct | — | A/B | — |
| A566 | Chant | PARTIAL | wordless (D-209) | — | B | — |
| A567 | Magi killing noxious creatures (Hdt 1.140) | MISSING | none | everywhere | B claim | Distinctive, harmless to show |
| A568 | Rivers not polluted (Hdt 1.138) | PRESENT | `town.json` | — | B | — |
| A569 | Elamite gods' offerings | PRESENT | E-32 | — | A | — |
| A570 | Household sacrifice | PRESENT | E-34 | — | B | — |
| A571 | Morning prayer to the sun | MISSING | none | — | C | Minor |

### Numbers, education, life stages (HRAF 80–89)

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A572 | Measures (BAR, qa, shekel), cord, straightedge | PRESENT | `population.json` | — | A/B | — |
| A573 | Calendar months | PRESENT | `events_calendar.json` | — | A | — |
| A574 | Sons learning trades, the scribal pupil | PRESENT | `population.ts` l.3393–3433 | — | C | — |
| A575 | Persian boys' training | PRESENT | Hdt 1.136 | — | B | — |
| A576 | Girls learning to spin | PRESENT | "learning to spin" | — | C | — |
| A577 | Infants: carried, swaddled, cradle | PRESENT | `babes.ts` | — | C | — |
| A578 | Toddlers crawling or walking on their own | MISSING | carried only | — | C | Minor |
| A579 | Elders | PRESENT | job 'elder' | — | C | — |
| A580 | Sexuality | not depicted | policy | — | — | Correct |

### Wild mammals

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A100 | Golden jackal | PRESENT | `wildlife.ts` | plain at night | B | — |
| A101 | Wild boar | PRESENT | `fauna.json` | Pulvar reeds | B | — |
| A102 | Gazelle | PARTIAL | paradise only | should also be on the open plain (SOUNDSCAPE §5) | B | — |
| A103 | Fallow deer | PRESENT | paradise | — | C | — |
| A104 | Grey wolf | PARTIAL (in flight) | `beasts.ts` uncommitted; month \*Vṛkazana | Kuh-e Rahmat | B | — |
| A105 | Wolf-killing (month 9) | MISSING | name only | — | A name / C act | — |
| A106 | Leopard, lion, hyena, cheetah, onager | PARTIAL (in flight) | `beasts.ts`; no `fauna.json` rows | — | B | — |
| A107 | Red fox | MISSING | SOUNDSCAPE §5 "confirmed in Fars" | fields, middens | B | Common at dusk |
| A108 | Wild goat and wild sheep | MISSING | SOUNDSCAPE §5 (Bamu) | Kuh-e Rahmat cliffs | B | Mountain life |
| A109 | Hare | MISSING | none | fields, steppe | C | The most-seen wild mammal |
| A110 | Hedgehog, porcupine | MISSING | none | gardens, slopes | C | — |
| A111 | Rats and mice | MISSING | D-210 "not built" | stores | C | — |
| A112 | Bats at dusk | MISSING | D-210 | Terrace, town | C | Every dusk |
| A113 | Jirds, gerbils, jerboas | MISSING | none | steppe | C | — |
| A114 | Persian squirrel | MISSING | none | oak woodland | C | — |
| A115 | Badger, stone marten, wildcat, caracal | MISSING | SOUNDSCAPE §5 | — | B | Minor |
| A116 | Brown bear | ABSENT? | Bamu list lacks it | — | C | — |
| A117 | Delegation beasts (lioness, okapi, ibex) | PARTIAL | not drawn (no rig) | court camp | B | — |
| A118 | Beasts in `fauna.json` | MISSING rows | tier trail break | — | — | — |

### Birds

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A120 | Swallows and swifts | PRESENT | `wildlife.ts` | — | C | — |
| A121 | Sparrows | PRESENT | `wildlife.ts` | — | C | — |
| A122 | Crows, kites | PRESENT | `fauna.json` birds | — | C | — |
| A123 | Buzzard, eagle | PRESENT | `wildlife.ts` | — | B | — |
| A124 | See-see partridge, chukar | PARTIAL | sound only | slope | B | Should be seen flushing |
| A125 | Hoopoe, bee-eater | PARTIAL | sound only | — | B | — |
| A126 | Owls (scops, little) | PARTIAL | sound only | — | C | — |
| A127 | Doves and pigeons | MISSING | none | town, Terrace ledges | C | Ubiquitous |
| A128 | Larks | MISSING | none | fields, steppe | C (SOUNDSCAPE §4 "expected") | Song over every field |
| A129 | White stork | MISSING | D-210 | fields, roofs | C | — |
| A130 | Winter cranes, geese, ducks | MISSING | SOUNDSCAPE §4 (Bakhtegan) | overhead, rivers | B | Winter sky |
| A131 | Herons and egrets | MISSING | none | canals | C | — |
| A132 | Vultures | MISSING | none | middens, exposure ground | C | — |
| A133 | Kestrels | MISSING | none | walls | C | — |
| A134 | Nightingale, bulbul | MISSING | none | gardens | C | Garden sound |
| A135 | Choughs, jackdaws | MISSING | none | cliffs | C | — |
| A136 | Magpie | MISSING | none | villages | C | — |
| A137 | Starlings (winter flocks) | MISSING | none | — | C | — |
| A138 | Sandgrouse, bustard | MISSING | none | steppe | C | — |
| A139 | European roller | MISSING | SOUNDSCAPE §4 | — | C | — |
| A140 | Wheatears | MISSING | none | stones | C | — |

### Reptiles, amphibians, fish, invertebrates

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A150 | Lizards (agamas) | MISSING | none | Terrace stone, walls | C | — |
| A151 | Bees | MISSING | none | — | C | — |
| A152 | Butterflies | MISSING | none | — | C | — |
| A153 | Dragonflies | MISSING | none | canals | C | — |
| A154 | Visible flies | MISSING | D-210 | dung, middens | C | — |
| A155 | Ants | MISSING | none | floors | C | — |
| A156 | Geckos | MISSING | none | walls at night | C | — |
| A157 | Tortoise | MISSING | none | steppe | C | — |
| A158 | Snakes | MISSING | none | — | C | — |
| A159 | Scorpions | MISSING | none | — | C | — |
| A160 | Frogs and toads | PARTIAL | sound only | — | C | — |
| A161 | Fish | MISSING | none | rivers | C | — |
| A162 | Freshwater crab | MISSING | none | streams | C | — |
| A163 | Snails | MISSING | none | after rain | C | — |
| A164 | Mosquitoes and gnats | MISSING | none | water | C | — |
| A165 | Moths at lamps | MISSING | none | — | C | — |
| A166 | Cicadas, crickets | PARTIAL | sound only | — | C | — |
| A167 | Locusts (a locust year) | MISSING | none | — | C | — |
| A168 | Spiders and webs | MISSING | none | — | C | — |

### Trees, wild plants, crops

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A170 | 15 tree species (plane, willow, poplar, tamarisk, mulberry, fig, apple, pear, pomegranate, oak, almond, pistachio, cypress, olive, vine) | PRESENT | `trees.json` | — | B | — |
| A171 | Walnut | MISSING | none | gardens, stream banks | C | — |
| A172 | Wild pear, hawthorn, *Celtis*, montpellier maple | MISSING | none | oak woodland | C | — |
| A173 | Juniper | MISSING? | none | high slopes | C | — |
| A174 | Quince, plum, apricot | MISSING | none | orchards | C | — |
| A175 | Jujube | MISSING | none | — | C | — |
| A176 | Date palm | ABSENT-BY-EVIDENCE | `plain.json` (frost) | — | C | — |
| A177 | Reeds and rushes | PRESENT | `riparian.ts` | — | B | — |
| A220 | Spring wildflowers (tulip, poppy, anemone, iris, crown imperial) | MISSING | colour only | steppe, slopes | C | — |
| A221 | Tragacanth cushions | MISSING | none | slopes | C | — |
| A222 | Giant fennel (*Ferula*) | MISSING | none | slopes | C | — |
| A223 | Thistles, camelthorn | MISSING | none | stubble | C | — |
| A224 | Artemisia steppe | PRESENT | `terrainPlain.ts` | — | B | — |
| A225 | Crop-field weeds | MISSING | none | fields | C | — |
| A226 | Rose (paradise gardens) | MISSING | none | gardens | C | — |
| A200 | Barley, wheat, emmer, sesame, vines, fruit trees | PRESENT | `plain.json` crops | — | B | — |
| A201 | Pulses (lentil, chickpea, vetch, pea, broad bean) | MISSING | none | fields | C (rec.) | — |
| A202 | Flax | MISSING | none | fields | C | — |
| A203 | Millet | MISSING | none | summer fields | C | — |
| A204 | Onion, garlic, leek | MISSING | "onions, cress and bread" wares only | gardens | A (garlic month) / C | — |
| A205 | Cucurbits | MISSING | none | gardens | C | — |
| A206 | Alfalfa | MISSING | = A031 | fields | B | — |
| A207 | Named garden-bed crops | PARTIAL | unnamed beds | gardens | C | — |
| A208 | Rice | ABSENT-BY-EVIDENCE | Q-013 | — | C | — |
| A209 | Cotton | ABSENT-BY-EVIDENCE | blocklist | — | B | — |

### Weather and sky

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A400 | Rain, storm, dust, mist, snow, lightning, rainbow | PRESENT | `weatherState.ts`, `rainShafts.ts` | — | A/C | — |
| A401 | Snowline by altitude | MISSING | snow cover is one scalar (`materials.ts` l.933) | Zagros peaks | A (climate) | — |
| A402 | Ground frost and ice | MISSING | none | — | A (44 frost days) | — |
| A403 | Visible breath | MISSING | none | — | C | — |
| A404 | Planets | MISSING | stars are HYG only | night sky | A | — |
| A405 | Lunar eclipse, meteors, Milky Way | PRESENT | `skySystem.ts`, `meteors.ts` | — | A | — |
| A406 | Dust devils | MISSING | none | summer plain | C | — |
| A407 | Heat shimmer | MISSING | none | — | C | — |
| A408 | Hail | MISSING | none | — | C | — |
| A409 | Halos, sun dogs | MISSING | none | — | C | — |
| A410 | River seasonal flow | PRESENT | `seasonal.ts` | — | C | — |
| A411 | Seasonal rains' effects on people | PRESENT | W-01 to W-03 | — | C | — |

### Events and seasonal changes

| id | item | status | evidence / file | where | tier | why it matters |
|---|---|---|---|---|---|---|
| A590 | Farming year | PRESENT | E-40 to E-50 | — | B | — |
| A591 | Construction progress | PRESENT | E-60 to E-63 | — | B | — |
| A592 | Births, deaths, marriages | PRESENT | E-70, E-71, E-73 | — | C | — |
| A593 | Royal hunt event | MISSING | none | — | B | — |
| A594 | Military review or muster | MISSING | none | — | C | — |
| A595 | House fire, flood, earthquake, locust or epidemic year | MISSING | none | — | C | Some chance of a random event (UD-09) |
| A596 | Autumn leaf fall and spring blossom | PRESENT | `plain/seasonal.ts` | — | C | — |
| A597 | Transhumance | PARTIAL | = A021 | — | B | — |

## 3. Counts, for T-J6

Of about 190 rows: PRESENT about 80, PARTIAL about 35, MISSING about 68, ABSENT-BY-EVIDENCE 8, one row withheld by policy (sanctions) and one not depicted (sexuality). Row ids are grouped by category, so the numbering is not continuous.

Every MISSING row where a probable C reconstruction exists fails T-J7 as it stands. The top ones are:
- A564, tomb guardians (explicitly withheld);
- A007 and A105, the garlic and wolf-killing month names with nobody performing them;
- A024, cattle herds;
- A061, the river crossing;
- A505 and A506, quarrymen and drum haulage;
- A201–A206, the missing crops;
- A127–A130 and A150–A155, the commonest birds and the visible small life.

**Detector escape (T-R0):** no board detector compares the world against an outside taxonomy (species lists, HRAF categories, the calendar's own month names). The month-name versus activity mismatch (A007, A105) could be a lint.

**Files cited** (all absolute under /home/user/fars/):
- data: src/data/fauna.json, src/data/plain.json, src/data/trees.json, src/data/events_calendar.json, src/data/settlement.json, src/data/town.json, src/data/access.json, src/data/lives.json, src/data/population.json
- people: src/people/population.ts, src/people/activities.ts, src/people/animals.ts (modified, uncommitted), src/people/babes.ts, src/people/outfits.ts, src/people/construction.ts
- world: src/world/wildlife.ts, src/world/fauna.ts (modified, uncommitted), src/world/beasts.ts (untracked), src/world/plain/quarries.ts, src/world/plain/seasonal.ts, src/world/settlement/houseplan.ts, src/world/settlement/houses.ts
- sky and weather: src/sky/skySystem.ts, src/render/materials.ts, src/weather/generator.ts
- audio: src/audio/soundscape.ts
- research and status: research/SOUNDSCAPE.md, BLOCKERS.md (B20, B49, B63, B64, B66), PROGRESS.md
