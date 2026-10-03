# s18 C12: the giant holes (D-770), first pass

Written 2026-10-03 by the s18 cloud agent C12 (the holes auditor). I find holes; I do not fix them.

**Why this exists.** The whole Terrace was left unpainted for 17 sessions. Two things caused it: reviews judged the world
against photographs of the ruin, and early "attested only" rules were never swept out after UD-02, UD-14 and UD-29 said to
fill every blank with the most probable reconstruction. This file finds the other holes with the same cause, plus the holes a
first-time player would hit.

**Method.**
- **(A) The ruin-bias sweep.** Four parallel code and data sweeps grepped for things set to off, absent, bare, grey or
  'attested only', for `present_467`, 'not placed', 'NOT BUILT', PLACEHOLDER, and for tests that enforce an absence.
  Each find was judged against a living Achaemenid royal city in 467 BC.
- **(B) The player's-eye sweep.** I read all 46 frames of `renders/2026-10-03T02-27-39-final2` on branch s17-renders
  (T4, the player's lens), the six crude cloud frames on s18-renders-cloud, and the code path from load to talk.

**Caveats.**
- Nothing was rendered for this file. Frame claims come from the s17 final train, which predates the s18 merges.
- Census numbers are the code's and data's own (`population.json`, `court.json`); I did not re-run them.

**Ranking.** By how much of the player's experience each hole spoils: screen share × time exposed × how jarring.
- **Tier** says how probable the reconstruction is: A attested / B inferred / C reconstructed.
- **Fix** is the size of the work: S under 1 h, M a few hours, L a day or more.
- **Owner** is taken from handoff/s18/sessions.md. 'Unowned' means the file belongs to no s18 agent, so by the rules it
  goes to C7 or the lead.

## LEDGER: sent to / status (C12 keeps this; the lead dispatches from it). Updated 2026-10-03 07:55 UTC from the agent branches (07:51); s17-int 409bf63c.

How the status column is read:
- **DONE** means it is merged into s17-int.
- **DONE-b** means it is done on the agent's branch but not yet merged.
- **WIP** means it is on the agent's stated list (handoff/s18/lead_handoff.md).
- **SENT** means it was dispatched but no commit has been seen.
- **UNSENT** means no owner action is recorded: the lead dispatches these.

None of it is verified in a render yet (pagecheck and C6 are the check).

| row | hole (short) | sent to | status | evidence |
|---|---|---|---|---|
| 1 | empty world | C1, C5 | WIP | C1 f0eb96b0 nine building gangs (DONE-b); C5's top item is the drawing drop |
| 2 | court timing: a new game before the arrival | C1 | DONE-b | f0eb96b0 "a new game with the court in residence" |
| 3 | Terrace colour part 2 (reliefs, capitals, colossi, frames, inscriptions) | C10 | DONE-b (paint 1-3) | c5f99e1b walls and frames; ccf861d2 capitals and colossi; 77403d90 every relief figure painted (flesh, eyes with pupils, animals). **Inscriptions coloured: not seen (chased 07:55)** |
| 4 | town shape (belt at the Terrace foot) | C2 | DONE | 5819c8ef D-661 lower-city belt, 739 plots |
| 5 | houses one buff mud | C2 | DONE | 5819c8ef washes, painted doors, dyes |
| 6 | ruin weathering (grime, lichen, boulder scan, rough timber) | C10 | DONE-b | c5f99e1b fresh 467 stone (no lichen, mottle at 20 % chroma), royal cedar planed and painted |
| 7 | night black, no player light | C4, C5 | WIP | C4 on night light; C5 player lamp listed |
| 8 | public site behind | Vagon | DONE (s17); s18 pending | c3bde8ab deployed 04:50; s18 waits on a Vagon budget run |
| 9 | talk hidden | C8, C11 | DONE | 3f07b3e6 E speaks to anyone; ed032cd1 one talk key; c20cefad panel (DONE-b) |
| 10 | court ceremony never happens | C13 | DONE | e9341d07 the programme; 4a2db721 proskynesis (DONE-b) |
| 11 | clothes undyed | C13, C2 | DONE | e9341d07 dyed dress and jewellery; 5819c8ef more dyes |
| 12 | sound mostly synthesis | Vagon, C8 | DONE (mostly) | fb250784 115 of 121 recorded sets |
| 13 | plain work places, brick fields, houses being built | C3, C2 | DONE / DONE-b | 08243142 works; 5078eda1 a house being built in q_b1 |
| 14 | halls stored, bare windows, hangings, ceilings, banners | C10, C13 | partly | hangings and standards (946ae757); **ceilings, shutters and grilles, banners in the wind, off-season hall dress: no commit, chased 07:05 and 07:55** |
| 15 | speech in isolated words, hums, wordless songs | C8 | DONE-b (songs) | 859a28d5 work, reaping, well and market songs; crowd murmur and model-driven overheard talk not re-checked |
| 16 | water (river, paradise feed, qanats, ferry, ditches) | C3, C2 | DONE-b / later | 7d149e7e bridge of boats, shadufs; 50ae2b11 ditches; the paradise feed by sluice: C2 after the current items |
| 17 | world does not notice the player | C5, C8 | WIP | cddd96c0 trespass (DONE-b); C5 visitor default listed |
| 18 | horses, gallop, hunt | C13, C9 | partly | e9341d07 rides, hunts, couriers; b29e8735 asks C9 for the gallop |
| 19 | shrines and household cult | C2, C1, C7 | WIP / **BLOCKED** | C2 (07:55): a lamp and an offering bowl in a niche of every living room, next push. The neighbourhood shrine is blocked by tests/religion.test.ts:47 (C7) banning "shrine" in the precinct; precinct.ts is in src/world/settlement/ (C2's tree). Figurines: C1 |
| 20 | estates, pavilion, Naqsh painted | C15 | DONE-b | C15 D-800: Naqsh-e Rustam texts carved (a1364786); estates and villages in progress |
| 21 | snow cap, comet, floods, dust storms, run-off, shimmer | C4 | WIP / **SENT, no commit (chased 07:55)** | floods, dust wall, run-off: C4 is on the T4 black screen |
| 22 | broken-looking faults | C4, C6, C2, C10 | partly | the Treasury floor mirror (C10): **no commit, chased 07:55**; black-KTX2 cloud frames fixed c7dcb652 |
| 23 | walk-only speed, no mount | C5 | SENT 06:0x | "rides (row 23)" on C5's list |
| 24 | faces | C14 | DONE | 82866584 faces that speak; 3f1040ac |
| 25 | memory and load | C9 | WIP | KTX2 merged (memory 5.35 -> 4.55 GB cloud) |
| u1 | royal women never appear; the litters | C13 | DONE-b | ea287ef1, 28e9d8e3 the royal women in curtained litters |
| u2 | punishment never shown | (CLAUDE.md: as evidence) | KEEP | |
| u3 | personal seals worn | C13 | DONE-b | 0af4d9a6 the officials' cylinder seals on cords |
| u4 | toddlers walking, barefoot poor, stripping in heat | C13, C14 | DONE-b | 36be15e0 toddlers walk (C14); 8592fe19 labourers stripped to the waist (C13) |
| u5 | cats, ducks, geese, bats, rats, storks, flies | C14, C9 | DONE | C14 cats, storks and bats by season; C9 7baa1f87 |
| u6 | latrines, roof sleeping, fruit drying on roofs | C2 | WIP | C2 (07:55): roof bedding in summer, fruit drying at harvest, next push |
| u7 | Diodorus' triple wall and bronze gates | C10 | **SENT 06:5x** | low |
| u8 | trees and planters on the Terrace; the "Penelope" statue | C10, C3 | partly | 93d82bfc plantedTrees() for the Terrace planters (C3); placing them is C10's |
| u9 | portico floors and ceremonial courts paved or limed | C10 | **SENT 06:5x** |  |
| u10 | baked prose for seed 1 only | C8 | DONE-b | 0c1b9d46 junk baked lives removed |
| u11 | Quality change needs a reload (no note); debug sliders shown | C11 | SENT? | "polished out-of-world text" (92d6a6bf), unverified |
| C1 | life simulated but not drawn | C5 (+ C9's finding) | WIP | the top item; pagecheck D-772 measures it |
| C2 | working land empty in the sim | C1, C3 | DONE-b | 5a3c79f6 the staffed works; 74538bb3 the fields worked out to 3.2 km |
| F1 | faces, lips, guards' dress and pose | C14, C13 | DONE | 82866584 visemes; e9341d07 guards in the court robe |
| P2-1 | (retracted) | | | |
| P2-2 | the delegations' animals and chariots | C13 | DONE | 54655633 gift animals |
| P2-3 | patterned robes; the throne's lion bands; relief pupils | C13, C10 | partly (DONE-b) | dyed dress (C13); pupils painted 77403d90; **the throne's lion bands: not seen (chased 07:55)** |
| P2-4 | storks, bats, cats; mules and camels on the plain; reins; turning wheels | C14, C9 | DONE / DONE-b | cats, storks, bats (C14); C9 7baa1f87; 32cff91b the wheels turn (C14); reins: check |
| P2-5 | tower stairs and walkable roofs; the Hadish balcony | C10 | **SENT, no commit (chased 07:55)** |  |
| P2-6 | the drums' ramp and ascent | C10, C1 | **SENT, no commit (chased 07:55)** | the ramp C10, the people C1 |
| P2-7 | festive dress, toys, necklaces | C13 | SENT 06:0x | |
| P2-8 | blocklist wording | C12 | DONE | 257ab230 |
| P2-9 | Rahmat quarries, E-foot cistern, Akhor Rostam niches | C3, C10, C15 | DONE-b / ? | 6fa03934 Akhor Rostam niches and private rock tombs (C15); Rahmat quarry faces and the E-foot cistern not seen |
| P2-10 | soil moisture; gates barred at night | C3, C5 | WIP | both on the agents' lists |
| stale | 'court ABSENT default' in the data files | C13 | DONE-b | no "court ABSENT default" wording left in court.json, events_calendar.json, population.json or town.json on cloud-s18-c13-court |
| T1 | **Time jump keeps people at stale places** (after setTime, save/load or a skip): 58 in the Apadana hall and 44 in the forecourt on day 200, off-season | C5, C1 | SENT 07:56 | pagecheck run 5 + C13's node check (no plan holds them) |
| 4-1 | the world never notices you | C5, C8, C13 | WIP | cddd96c0 trespass (DONE-b); C5 visitor default |
| 4-2 | nothing moves in the wind | C3 | DONE | 677621a9 one wind for every plant |
| 4-3 | invisible walls, glued escort | C5 | WIP | src/world/visitor on C5's list |
| 4-4 | the house mimed: quern, oven, hearth, meal | C2, C1 | DONE / WIP | C2 D-664 houseWorkObjects and indoor hearths; C1 to use them |
| 4-5 | wild herds behave like force fields | C14 | DONE | C14 BeastFlight |
| 4-6 | score clichés, wiring, switch | C11 | DONE (clichés, cut) | a2a70619 re-oriented, no duduk; **the Score toggle and its own slider: unverified** |
| 4-7 | court details | C13 | DONE | 4b0b21b2 parasol furled indoors, prince, weapon bearer; 4a2db721 bow; parasol following the king: C5 listed |
| 4-8 | out-of-world text reads as a dev tool | C11, C8, C1, C5 | partly | c20cefad talk panel; 92d6a6bf polished text; chronicle (C1) listed; visitor strings (C5) |
| 4-9 | night sky flat | C4 | WIP | the C4 list covers all four |
| 4-10 | animals keep clock hours | C9, C4 | DONE-b / SENT | 2fa8251e; birdsong hours -> C4 (soundscape.ts now C4's) |
| 4-11 | no footprints or dust | C5 | **SENT, no commit (chased 07:55)** |  |
| 4-12 | season-blind market; can't buy food | C8, C2 | partly / WIP | buying food DONE-b; seasonal stall goods next push (C2); fewer busier squares after |
| W1, W2, W10 | names; month labels | C1 | DONE-b | 6371b169 the Six for the great houses, no mechanical women's names, all twelve Persian months, the chronicle |
| W3, W4 | crown; guards' kit | C13 | DONE | 4b0b21b2 plain kidaris, gorytos |
| W5, W6, W13, W14, W15, W17, W22 | dialogue fixes | C8 | DONE-b | 0c1b9d46 |
| W7 | Pulvar/Medus | C3, C8, C1 | partly | 677621a9 data names; **history.ts:40 (C1) and life.ts:308 (C8): unverified** |
| W8 | "tomb attributed to Xerxes" | C3 | DONE | 677621a9 "the second tomb being cut" |
| W9 | 'Frataraka' in a 467 name | lead | DONE | "official hall north of the Terrace" |
| W11 | washing lines across the lanes | C2 | DONE | D-663 |
| W12 | commoners' tables | C2 | DONE | D-664 |
| W16 | talk download size in Settings | C11 | SENT? | unverified |
| W18 | halmi used as a palace pass | C5 | **SENT, no commit (chased 07:55)** |  |
| W19 | millet; nightingale | C3, C4 | **WIP / SENT** | millet C3; nightingale -> C4 06:5x |
| W20 | delegation gifts as stand-ins | C13 | DONE-b | dee79fa5 the gifts drawn |
| W21 | figurines; latrines and refuse pits | C1, C2 | WIP | C2: refuse heap and latrine screen in the courts, next push; figurines C1 |

## The pattern behind most of these holes

At least 9 tests or code rules enforce an absence that later directions overrode. Any fill must change them too.
- `tests/surfaces_s6.test.ts:25`: clay paint "the Treasury walls alone".
- `tests/polychromy.test.ts:54,84`: "faces, animals and the background carry no paint"; "no gilding on an unpainted animal".
- `tests/polychromy.test.ts:125`: Treasury column stone pinned to plain `limestone_carved`.
- `tests/religion.test.ts:47`: bans 'temple' and 'shrine' in the town precinct.
- `tests/plain.test.ts:356`: bans the word 'qanat'.
- `research/RELIEFS_AND_COLOUR.md:116`: "Relief background: no evidence found … Do not paint it by default".
- `court.json` and `research/COURT.md` 5b: "He is never staged … no procession, no speech, no reaction"; "NO procession is
  staged".
- `events_calendar.json`: E-24 (delegations), E-35 (tukta feast) and E-36 (the king's gifts) are all `rule: never`.
- `src/audio/voices.ts:8-18` and `musicClaims.ts:20` (M-15): "published words only … never joined into new sentences"; every
  song "a vocalise without words".

Text that still calls a state "evidence-strict" should be read as stale wherever UD-14 and UD-29 apply. Examples:
`court.ts:3`, `furnish_palaces.ts:12`, and the "Evidence only" option in `src/ui/shell.ts:241`.

## Ranked holes

| # | Hole | Evidence | What 467 BC most probably had (tier, why) | Fix | Owner |
|---|---|---|---|---|---|
| 1 | **The world is empty where the player looks.** People appear in 3 of the 46 final frames (cov-037 one man, the cov-042 file of men, and horses in sb-spawn-morning). Empty: the Terrace at noon (cov-252), the Apadana hall (cov-294), the Gate (cov-350), the Treasury (cov-112/154/182), lanes and courts (cov-028/098/142/224/266), plain and roads (cov-406/476). | Court absent (about 2/3 of the year): about 575 people by day for the whole 12.5 ha Terrace (`population.json` zones.terrace.court_absent; `tests/court.test.ts:49` only caps it at under 1200). C10's s17 census: "nobody within 250 m" at 16 coverage points. | Even with the king away, the Terrace was a working seat. The treasury and archive staff of the PF/PT tablets, the garrison, and hundreds of kurtaš on the Hall of 100 Columns and the Xerxes buildings (B: rations for ~2,700 people in groups). Town lanes busy all day. (B) | L | C1 (population, court) + C5 (popview: what is drawn near the player) |
| 2 | **A new game shows no court for 24–72 real hours. When it comes, the king is rarely seen and never staged.** | `newGame.ts:1-12` starts the game "at dawn 1-3 days … before the seed's arrival", at `timeScale 1` (`main.ts:143`). King on audience only ~2 mornings in 5, 08:30–11:00 (`court.json` audience_share 0.4); otherwise "inside the Hadish and not drawn" (`court.ts:14,773`). He arrives on foot (`court.ts:523`); the royal chariot stays parked (`fauna.ts:182`). | The game should start inside the residence, or at the hour of the arrival column. The king seen daily: to and from the Apadana, on the chariot with the parasol and fly-whisk bearers, the guard drawn up, heralds, a crowd lining the road (Xenophon Cyr. 8.3, already in sources.json). (B/C) | M | C1 (newGame, court, courtYear) |
| 3 | **The Terrace's colour, second half: reliefs, capitals, colossi, frames and inscriptions are still the ruin.** | Relief faces, animals and backgrounds are bare stone (`relief_field.ts:366`, `relief_figures.ts:14`; test-locked, `polychromy.test.ts:54,84`). Bull and lion capitals, protomes and the Gate colossi are unpainted (Q-020: capital paint "per the capital research", never built). Dark door and window frames are mirror-black (`render/materials.ts:351`, Q-072; the fluorapatite white coat is B). Inscriptions have no colour in the signs (`materials.ts:1473`). Treasury shafts are kept "restrained: no figured motif, no gilding" (SITE_SPEC:337, Q-426). | Fully polychrome reliefs: skin, eyes, beards, garments, harness, coloured grounds. Gilded or painted capitals and colossi (eyes, horns, harness). Frames coated. Painted-in signs. Pigment traces on the Apadana and Tripylon reliefs (Nagel 2010–13, the ISAC polychromy work) and the Susa brick colour scheme. (B) | M | C10 (src/arch, reliefAtlas); render/materials.ts is unowned (C7/lead) |
| 4 | **The town is nine separate 200 m blocks in open grass, and the Terrace foot is a lawn.** The first view of the game (sb-spawn-first, sb-spawn-morning) is an empty field with dark lumps in front of a lone platform. From the plain the Terrace is a small white box with no city around it (sb-plain-rain). | `settlement/plan.ts:43-55`: quarters of 150–230 m set 500–2,100 m from the Terrace, each kept clear of "the Terrace approach (e −620…262, n −245…185)". Crude cloud frames: the town is a small compact grid in grass. | The capital of Pārsa (Fars) was a continuous built belt at the Terrace foot: nobles' estates and gardens, workshops, stores, the road, brick yards and orchards between the quarters. The excavated patches (Persepolis West, the Firuzi estates) are what survived, not the edge of the city. (B/C) | L | C2 (settlement, fill). The approach rule is the lead's call. |
| 5 | **Every house is the same buff mud, with grey doors and no colour or cloth.** Lanes read as corridors of identical brown walls (cov-028/037/098/142/266/336). | `settlement/surfaces.ts:13`: "mud plaster … local soil tone"; `house_plaster` is loam with a per-house tint. Doors are weathered poplar. There is no whitewash, gypsum or painted door anywhere. | Lime or gypsum washes on better fronts and door surrounds. Red ochre or blue door frames. Painted niches. Hangings, mats and drying cloth on walls and roofs. Awnings over doors. Plants in courts. (C, the same bias as the Terrace) | M | Unowned: settlement/surfaces.ts is outside C2's ownership; give it to C2 |
| 6 | **467 stone and timber are weathered like the ruin.** | `render/grime.ts:3-4`: "amplitudes judged against the references' ruin", `LICHEN terrace 0.12, terrace_foot 0.16`. `scans.ts:34-40`: dressed stone uses a weathered boulder scan ("lichen-grey and rust mottle at 45 %"). Palace plaster has losses (`materials.ts:323`). Royal joinery uses the `rough_wood` scan (`scans.ts:85`). | Stone 15–50 years old, kept by a court: crisp arrises, no lichen, at most dust and drip stains. Planed and probably painted cedar. (B) | S | Unowned (render/grime, scans, materials): C7 or the lead |
| 7 | **Night is near black, and the player carries no light.** | `sky/exposure.ts:19` (0.011 on a moonless night). A house lamp is `power 0.08, range 3.5` (`world/fire.ts:33`). There is no torch, lamp or inventory. Night frames cov-000/056/364/448 show little. | Oil lamps in every doorway, torches at the gates and on the Terrace, braziers, the moon. A visitor would carry a lamp or a torch. A AAA night is readable and dramatic, not black. (B/C) | M | C4 (sky, fire); the player's light belongs to C5 |
| 8 | **The public site is about two sessions behind.** | `pages.yml:7` deploys only `s14-int`. Its tip is s15 (2 Oct 19:53). These files are not live: intro.ts, player/motion.ts, audio/library.ts, the audio manifest, converse/ownlines.ts. | Not a 467 question. Anyone who opens the URL meets s15. (s17.md held the deploy back on the budget.) | S once the budget passes | Lead |
| 9 | **Talking is hard to find, and the fallback looks like a failure.** | The title hint says "E a door, a person" (`shell.ts:151`). E plays one canned attested line, only on detailed agents (`world.ts:674-689`). Real talk is T (type) and hold V (speak), which are in no key list or Controls screen (`converse/ui.ts:181`). The 1.5 B model needs about 1.6 GB of VRAM. The fallback answers carry "this graphics card cannot run the talk" (`ui.ts:162`) and a debug line ("heard … tier C …; 3.2 s; ask: refused"). The fallback voice skips the volume, reverb and position chain (`ui.ts:79`). The bulk population ignores E. | Not a 467 question. The headline feature (UD-18, UD-31) must be found in 10 seconds: a prompt when the player looks at someone, one key, a period-styled panel, and fallback replies shown as speech, not as an error. | M | C11 (src/ui, src/shell) + C8 (converse) |
| 10 | **Court ceremony never happens.** No arrival procession, no tribute or New Year day, no feast, no gifts, no proskynesis, no music with the column. | `court.ts:11` "no procession is staged". E-24/E-35/E-36 are `never`; E-27 is a log line only (`calendar.ts:386`). "The bow with a hand before the mouth is not posed" (`court.ts:885`). `performers.ts:29`: "no soldiers', street or foreign music". | The Apadana reliefs are themselves the programme: delegations with gifts and animals led up the stairs by ushers, audience with the bow, banquets at the king's table (Heracleides), trumpets and drums with the guard. The game's best spectacle, and it is missing. (B) | L | C1 (court, courtYear, calendar) + audio performers (unowned) |
| 11 | **Most clothes are undyed, with little jewellery.** | `looks.ts:218` worker dress `['wool','linen','brown','grey','wool']`, dye strength 0–0.55. `garments.ts` `DYE_BY_WEALTH.poor` is undyed. Guards 60 % ochre, brown or linen (`looks.ts:210`). Torques on 30 % of Persians and 15 % of guards. Jewellery shares are "NOT SEEN, C". | Madder red, woad blue and weld yellow were cheap and common, at least as bands and trim. The court and guards wore vivid patterned robes (the Susa archers). Gold torques, bracelets and earrings were general among Persians of rank. Crowds should read as colour. (B) | S–M | Unowned (people/looks, wardrobe): give it to C8 or C5 |
| 12 | **The soundscape is mostly synthesis.** | 7 of 37 bed layers are recordings (`soundplan.ts:25-41` against `public/audio/manifest.json`). The town, Terrace, river, village, worksite and hall are filtered noise. Donkey, horse, camel and every songbird are oscillators (`soundscape.ts:67,141,158`). 5.1 MB of audio ships in total. | Not a 467 question: a AAA open world is carried by recorded ambience. Vagon's `tools/audio/fetch.mjs` is still owed. | M (fetch) | Vagon (fetch) + unowned audio beds (C7/lead) |
| 13 | **The plain's working places are not built, and there are no brick fields beside a live construction site.** | `popgeo.ts:316-331`: the mill, stockyard, brickyard, tannery and oil press are "NOT BUILT", work done on open ground. Kitchen gardens are not built (`:616`). The garrison quarters are not built (B63). The quarrymen's huts are not built (B80). Brick squads go to 'brickyard', which is bare ground (`population.ts:1884`). No house anywhere is being built or repaired. | Walled mill and bakery yards, folds, tannery pits, a press house. Acres of mud bricks drying in rows beside mixing pits and straw stacks, visible from the Terrace. Houses going up and being re-plastered. (B) | M–L | C2 (settlement) / C1 (popgeo) / C3 (plain) |
| 14 | **The palace halls are empty or stored, and most palace openings are bare holes.** The Apadana (cov-294) and Gate (cov-350) are empty stone forests on red floors. | `furnish_palaces.ts:12`: with the court absent the furnishings are "rolled, covered and stored". The Hadish apartments are not built (`:17`); the Apadana storerooms are solid (`terrace.ts:277`). Windows have "no shutters modelled" (SITE_SPEC:27, Q-087). Hangings hang only on the front porch rows of 4 buildings (`dressings.ts:22`). Ceilings are unpainted (Q-351). Standards don't move (`dressings.ts:14`). | Even off-season, curtains in the doorways, hangings, guards at the doors, servants cleaning, lamps. Shutters or grilles. Painted soffits. Banners that move. (C) | M | C10 (src/arch) + unowned furnish_palaces (C7/lead) |
| 15 | **People talk to each other in isolated words and hums; there are no songs with words; overheard talk is templated.** | `voices.ts:8-18`: single attested lexicon entries, never joined. Egyptians, Lydians, Carians, Bactrians, Sogdians, Thracians and others only hum. `overheard.ts:6-8` uses templates (UD-23's model-driven exchanges are still pending, HANDOFF:60). Every song is a wordless vocalise (M-15). Magi chant "WITHOUT WORDS". | UD-24 already loosened §10: reconstructed period speech, tier C. Fluent murmur in every tongue (`lang/reconstruct.ts` exists but serves overheard topics only). Songs with sung (reconstructed) lines. Magi reciting (Avestan Yasna is the obvious basis; the CLAUDE.md ritual rule still bars invented liturgy, so use recitation, not words). (C) | M | C8 (speech, voices, overheard) |
| 16 | **The water is a modern channel.** | `plain/rivers.ts:4`: the modern OSM course with one trapezoid section; frames show a ruler-straight canal with a fence of reeds (cov-504, crude frames). The paradise channels are flat sheets with no feed or outlet (`settlement/water.ts:3`). There are no qanats (test-banned). There is no bridge or ferry on the royal road over the Kur, though it is "too deep to ford March-May" (`crossings.ts:3`). Irrigation is main canals only, with no field ditches, sluices or shadufs. | A braided, meandering Pulvar with gravel bars, cut banks, pools and fish weirs. Garden rills fed from the canal through sluices. Qanat shaft lines down the Rahmat fans (Polybius 10.28: B). A ferry raft or timber bridge on the Susa road. (B/C) | M–L | C3 (plain, river); the paradise water is C2's |
| 17 | **The world does not notice the player.** | `settings.ts:26` defaults `playerMode: 'observer'`: guards and access never react unless 'visitor' is chosen. `translation: false` means overheard talk and inscriptions have no gloss, while the talk panel always shows English. The map (M) and chronicle (J) need the translation layer. | UD-21, UD-25 and UD-32 want a sandbox that reacts: a stranger is challenged at the Gate, stared at, offered bread. The out-of-world aids should default to on, at least gently. | S | Unowned (core/settings.ts): the lead; behaviour C5 / C8 |
| 18 | **There are almost no horses, no cavalry, no gallop and no hunt.** | WORLD_INVENTORY G19 (cavalry and horse lines) is MISSING. `COURT.md:31` says the retinue's animals are "tended but not drawn". Every animal walks (GB44); couriers never hurry. The royal hunt (G11) is missing. | A royal residence ringed with Nisaean horses, stables and grooms exercising mounts. Mounted nobles. Galloping royal-road couriers (the angarium, Hdt 8.98). (A/B) | M | C1 (court) + C9 (fauna) |
| 19 | **There are no shrines and no religion at home.** | `precinct.ts:5`: "NOT BUILT … no fire temple, no roofed shrine, no statue" (test-locked). The household niche is left out (SETTLEMENT:147). There is no household devotion (GC15) and no tomb cult at Naqsh-e Rustam (G35). | The PF tablets record Elamite and other cults (offerings for Humban, Adad and others, the lan offering): small sanctuaries, offering tables, figurines and niches in Elamite and Babylonian households. Fire temples stay out (rightly). (A/B) | M | C2 (precinct) |
| 20 | **The elite estates, the garden pavilion and the Dasht-e Gohar hall are mud houses or boxes, and Naqsh-e Rustam is unpainted and half-inscribed.** | `settlement.json` `estates_bagh_e_firuzi` is a "34 m courtyard house". `settlement/plan.ts:274-358` builds the pavilion and halls from box and cylinder props. `plain/naqsh.ts` has no paint; the Elamite and Babylonian DNa/DNb are "NOT carved [PLACEHOLDER]" (`:367`). | Porticoed estates with stone column bases, glazed brick and painted rooms. A modelled pavilion. Painted tomb reliefs with all three versions of the texts. (B) | M | C2; Naqsh is C3 |
| 21 | **There are no seasonal or one-off marks.** | Kuh-e Rahmat (2,216 m) is under the January snowline of 2,350 m (`weather/climate.ts:38`), so it is never capped in an ordinary winter. No comet: Pliny NH 2.149 records one in 467/466 (GB3). No floods, dust walls, house fires or locusts (GA59, G68). No run-off in lanes after rain (GB7). Heat shimmer is behind `?heat=1` (`pipeline.ts:66`). | A white ridge for weeks in a wetter climate. The 467 comet, the one sky event that dates the year. A spring flood over the fords. A dust storm. (A for the comet, B/C for the rest) | S–M | Unowned (weather) / C4 (sky) |
| 22 | **Some visible faults read as broken, not as old.** | sb-town-from-rahmat: the foreground ridge is a black striped stretched mesh. Coverage cameras that face a wall or are black: cov-056 (vegetation filling the view), cov-070, cov-112, cov-322 (black). Black floating blobs in the sky (sb-town-from-rahmat). The Treasury floor mirrors like glass (cov-182). The garden reads as trees on flat ground with drawn lines (cov-014/280). | Not a 467 question. The coverage set also under-samples: about 5 of 40 views judge nothing. | S–M each | C4 (terrain mesh); harness C6; garden C2 |
| 23 | **Movement in a world of several km is a 1.35–1.95 m/s walk.** | `player/motion.ts:22`. There is no horse, cart or boat ride. The opening starts 3.8 km out (`intro.ts:35`). | The brief rules out fast travel, but riding a hired donkey or horse, or sitting on a cart, is period-true and keeps the walking pace honest. (C) | M | C5 |
| 24 | **Faces at 0.3–3 m read as game NPCs.** | B112; `playing.ts`: "the rig has a jaw and no lips". The fallback voice is PLACEHOLDER-quality (`converse/voice.ts:11`). | Not a 467 question. | L | C14 (people up close) |
| 25 | **Page memory and load.** | `bench-reports/load_s17.md`: memory 5.5–5.7 GB against a 5 GB target; the world pops in as shaders compile (`main.ts:626`). | Not a 467 question. | L | C9 |

### Smaller holes from the same sweep, unranked
- Royal women never appear (`court.json` groups.women); the litters are missing.
- Punishment is never shown (`deeds/law.ts:79`).
- Personal seals worn by everyone (GC8: only 2 designs).
- Toddlers walking (GA40); barefoot poor (GA8); stripping to the waist in heat (GC22).
- Cats, ducks and geese, bats, rats, storks and visible flies are not built (`fauna.json:103`).
- Delegation dress is partly modelled (`COURT.md:97-119`).
- No household latrines, no roof sleeping, no fruit drying on roofs (G24, G23, GA6).
- Private rock tombs and the Akhor Rostam niches are "not placed".
- Diodorus' triple wall and bronze gates were set aside (`DECISIONS.md:869`): only the E fortification is built.
- No trees or planters on the Terrace (`fillPlan.ts:14`).
- The Treasury's Greek "Penelope" statue (booty of 480) could stand there.
- Portico floors are bare limestone; the ceremonial courts are compacted fill (Q-027).
- The baked person prose loads only for seed 1 (`ui.ts:73`), but every new game gets a new seed.
- Quality changes need a reload, and the dialog doesn't say so.
- Day, hour and time-scale sliders, a debug menu, are shown to players.

## Checked and fine (not holes)
- Present: markets with awnings, washing lines, far-LOD house roofs, the paradise channels and basins, fords with a hide boat,
  main canals, villages, the waystation, Naqsh-e Rustam's tombs and Ka'ba, hearth and kiln smoke, rain, hail, lightning and
  snowfall, moon phases, flood levels, harvest stages, scaffolds and the masons' yard on the Hall of 100 Columns, torches and
  braziers placed, drains and cisterns, merlons, the throne, canopy and carpets when the court is resident, red plaster hall
  floors, painted Treasury shafts, magi at offerings, archery drill, kurtaš gangs, ox carts, dogs and flocks.
- The talk is on by default (`talk: true`). The opening plays by default and is skippable. The Grand Stair is climbable.
- Rightly absent (after 467): the Artaxerxes III stair, palaces H, G and A3, the unfinished gate, the Rahmat tombs, Naqsh-e
  Rajab's reliefs, the Frataraka complex, the Sasanian altars, fire temples.

# Second pass (deeper): the people, the ruin rules, the first ten minutes, faces

## New measurement: the people exist in the simulation but not in the frames (the new #1)

`npx tsx tools/dev/life_census.ts --seed 1 --days 30,200 --hours 9.5,15.5` counts the people the renderer is fed: 515 coverage
points, people within 60 m. Day 30 has the court, day 200 does not. Full output: handoff/s18/holes_life_census.txt.

| sub-area | points | moments empty | people per moment (work / idle / moving) |
|---|---|---|---|
| terrace:open | 31 | 9 % | 107 / 82 / 12 |
| terrace:apadana:roofed | 15 | 15 % | 121 / 40 / 13 |
| terrace:gate_nations:roofed | 8 | 0 % | 93 / 80 / 22 |
| town:lanes | 48 | 0 % | 62 / 86 / 2 |
| town:courts | 37 | 0 % | 79 / 98 / 3 |
| plain:fields | 22 | 88 % | 0.2 / 0.1 / 0 |
| plain:roads | 19 | 79 % | 0.4 / 0.3 / 0.1 |
| plain:river | 13 | 77 % | 4.3 / 2.2 / 0.1 |
| far:quarries | 5 | 100 % | 0 |
| plain:open | 12 | 100 % | 0 |

Day 200 still feeds 41,000 people (62,000 on day 30).

The s17 final frames of the same sub-areas show almost nobody:
- the Apadana on day 200 at 08:48 (cov-294): empty;
- the Terrace on day 168 at 12:35 (cov-252): empty;
- the Gate on day 241 at 16:16 (cov-350): empty;
- town courts and lanes (cov-037/098/142/266): one man or nobody.

So the census says the Terrace and town are crowded, and the pixels say they are empty. In the coverage json the `life` field
is empty for all 46 views, so no frame counted its drawn people. Nobody has noticed the gap because the people check is a node
census and the look check is a frame.

**Hole C1 (rank 1, above every row of pass 1).** Life that is simulated but not drawn.
- Fix: a counted render first. One Terrace view and one lane view, with `crowd.nearPeople()` counted against people_trace at
  the same moment. Then fix whatever drops them: the lazy plans within the frame budget (`popview.ts:13,366`, "pending"),
  impostors not shown, people in rooms, or the coverage page's own load.
- Fix size: S to find, unknown to fix.
- Owner: C5 (popview, crowd) with C6 (cloud eyes) counting.

**Hole C2 (rank 4).** The working land is empty even in the simulation.
- Fields are empty at 88 % of point-moments in spring and autumn mornings; roads 79 %; the river 77 %; the quarries 100 %,
  although the quarries feed a live building site and C3's stone carts run them.
- 467 BC (B): spring and autumn are the peak field seasons (ploughing, weeding, irrigating, harvest); the Fortification
  tablets record work gangs on the crown fields.
- Owner: C1 (population: work places and field gangs) + C3 (plain).

## The ruin rules still written in the data and research (feeds every builder)

The full sweep of research/*.md, src/data/*.json, DECISIONS and the blocklist found about 60 surviving absence rules. About
35 should be OVERTURNED (the evidence is silent) and about 20 KEPT (built after 467, or attested absent). The text still
steers whoever reads it.

**Stale everywhere.** "Court ABSENT is the default and the evidence-strict state" survives in 9 places, although D-236 and
D-252 made the court come and go by default: COURT.md:5, court.json:6-7, events_calendar.json:7, population.json:9,
town.json:3, EVENTS.md:11, PEOPLE.md:53 and :290, DECISIONS.md:37.
- Fix: rewrite them to "the court is resident from about Nisannu 6-18 to E-26; court absent is a setting".
- Fix size: S. Owner: C13 (court) for the data; the lead for the research files.

New holes this pass found (not in pass 1), ranked:

| # | Hole | Evidence | 467 BC most probably (tier) | Fix | Owner |
|---|---|---|---|---|---|
| P2-1 | ~~RETRACTED (third pass): skin tone IS tied to origin since D-155 (looks.ts ORIGIN_TONE, Q-240: Egyptian 0.62, Indian 0.68, Kushite 0.84 … Thracian 0.2); D-092's line was superseded.~~ Was: **Skin tone is not tied to origin**: a Kushite, an Indian and a Persian are drawn from the same range | DECISIONS D-092 (DECISIONS.md:229): "Nothing is tied to origin: no evidence was read" | Kushite, Indian, Egyptian and Arab workers and delegates visibly darker. The Apadana delegations are the evidence of who came. (A for who; B for skin) | S | C13 (looks) |
| P2-2 | **The delegations' animals, chariots and dress are left out**: lioness, okapi, ibex and chariots "NOT drawn", animals "stay at the camp"; mantles, cloaks, shawls, tassels and the chin wrap "not modelled" | delegations.json:5-87; fauna.json:76; COURT.md:90-112,191 | The Apadana stair reliefs (A): every delegation leads its gifts and animals up the stair. | M | C13 + C9 (fauna) |
| P2-3 | **Nobles' and delegates' robes are plain; the throne's lion bands are not drawn; relief eyes have no pupils** | Q-427 "every other garment plain"; Q-238; RELIEFS_AND_COLOUR:114,117 | Patterned borders (the Susa archers, the Oxus finds, B). Lion bands on the throne covers (B). Painted pupils. | S–M | C13 (dress); C10 (throne, reliefs) |
| P2-4 | **No storks, bats, cats, rats or flies; mules and camels left off the plain for budget; no herders' bands on the move; reins not drawn and wheels do not turn** | fauna.json:85,103; Q-563; DECISIONS.md:3888-3890; blocklist `later-animals` keeps cats out | Storks on columns and roofs (a Fars signature), bats at dusk, cats as mousers in the stores (long kept in Egypt and the Near East), turning wheels. (B) | M | C9 (fauna, smallLife); the wheels and reins belong to C9 or V5 |
| P2-5 | **Corner-tower stairs and walkable roofs are not built; the Hadish S balcony is not modelled** | Q-630; site_spec.json:356 | Roofs were living and working space; the towers had stairs. (B) | M | C10 |
| P2-6 | **The drum transport's last 250 m and the ascent to the Terrace are not modelled** | Q-710 | An earthen ramp and sledge road on the N side, with gangs hauling. The most cinematic labour on site. (B) | M | C10 / C1 |
| P2-7 | **No festive dress or toys; the women's necklaces, rouge and false hair are left out** | DECISIONS.md:4348, :4240; Q-435 | Best clothes at festivals and weddings; toys (both found in Near Eastern contexts, B); Xenophon's Median court make-up. | S–M | C13 |
| P2-8 | **The blocklist bans probable things in its wording**: `modern-landscape` bans "tents" and "villages"; `gold-everything` bans "gilding outside attested zones"; `qanat?` treats silence as absence | ANACHRONISM_BLOCKLIST.md:11,25,45 | Write "modern tents and villages"; "gilding beyond probable zones"; unblock qanats. | S | Lead (research) |
| P2-9 | **Akhor Rostam niches, private rock tombs, the E-foot cistern and the Rahmat quarry faces are not built** | Q-085, Q-428, Q-565; settlement.json:2050,2069 | The Rahmat quarries behind the Terrace were being cut in 467 (B). | M | C3 (plain) / C10 (cistern) |
| P2-10 | **No seasonal soil moisture; no gates barred at night** | Q-603; access.json:39 | Dark spring loam; town and Terrace gates shut after dark (B/C). | S | C3; C5 (access) |

Keep (correct absences, confirmed): no music at a Persian sacrifice (HDT 1.132); no fire temple, cult statue or altar fire
(HDT 1.131); no musicians on the Persepolis reliefs; the Artaxerxes III stair, the 32-column hall, Palace H and the Unfinished
Gate; buried foundation tablets; silk; windcatchers, domes and fired-brick houses; cheetahs; the weirs outside the extent.

## The first ten minutes as a newcomer, minute by minute

1. **Loading (44–60 s; memory 5.5–5.7 GB).** The Rahmat skyline and "There is no map, no marker and no guide. Walk, listen,
   and ask the people." Good tone.
   - Hole: there is no hint of HOW to ask. Talk is T and V; the hint says E.
2. **Title over the live world, then the 85 s wordless opening.** It starts at sunrise + 1.45 h and runs 3.8 km out at the
   river.
   - Hole: on the public site (s14-int) none of this exists yet.
3. **First step.** The spawn is grid e −175 n 122 facing the W face of the Terrace across the approach.
   - Hole: the field is empty, scattered with dark lumps (sb-spawn-first / -morning). The façade is in shade (the sun is
     behind Kuh-e Rahmat). The court arrives in 1–3 game days = 24–72 real hours.
   - What the player sees: a lone grey platform, a few horses, nobody near. A AAA opening would put the player in motion
     among people within 10 s: the road thronged before the arrival, a herald riding past, the stair full.
4. **Walking to the stair: 300+ m at 1.35 m/s, about 4 min, with nothing to meet.** There are no road folk on the approach
   in the frames (C10's road folk are unseen in a render).
5. **The stair and the Gate.** Climbable and imposing (sb-stair-climb), but grey stone throughout.
   - Hole: no guard visible at the head of the stair in the frame, though 16 guard posts exist (`GUARD_POSTS`,
     population.ts:153). In 'observer' mode nobody challenges the player.
6. **Pressing E at a person:** a single attested line, no subtitle (translation is off by default), nothing from the bulk
   population.
   - Hole: the player concludes people can't be talked to. T is never discovered.
7. **What the player understands after 10 minutes:** the date and place (the title's dedication, "the nineteenth year of
   Xerxes · 467 BCE"); that the world is big and quiet; that people mostly ignore you.
   - What they don't understand: who they are, why they are here, that they can speak (the headline feature), and where
     anything is (the map needs the translation layer, which is off).
   - Fix: the visitor default (C5, now owned); translation on by default, or at least overheard subtitles (lead, settings);
     a look-at prompt "T speak" (C11); the start inside the residence (C13 / C1).

## Faces and bodies (judged from the s17 crowd frame cov-042 at 3–10 m, and V3's report)

At 3–10 m (cov-042, the Terrace at dawn, the court resident):
- Guards wear grey cylinder caps that read as putty or clay, not felt.
- The tunics are flat primary colours (yellow, cobalt blue, green) with blotchy patch decals that read as paint stains or
  camouflage, not wear or pattern.
- Every figure holds the same arms-forward pose.
- They wear short tunics and trousers. Persian guards on the reliefs wear the pleated court robe and the fluted headdress: a
  file of "Immortals" in riding dress, all in the same pose, reads as a mod, not as the court.

At 0.3–3 m (V3, s17 report_people.md):
- "Faces at 0.3-0.7 m still read as game NPCs": MakeHuman heads, painted-looking brows, flat eyes.
- The rig has a jaw and no lips (`playing.ts`), so there are no mouth shapes while talking. Talking is the headline feature,
  and the face the player talks to does not move its mouth.

**Hole F1 (rank 6).** Faces, mouths and the guards' look.
- Fix: L for faces (needs the GPU box). M for the guard dress (the court robe and headdress variant, no blotch decals, pose
  variety).
- Owner: C13 (dress and looks); faces and lips are Vagon V3 (no cloud agent owns humanRig or humanMaterial: unowned in the
  cloud).

## Delta ranking (how the second pass changes the top of the list)
1. **C1** life simulated but not drawn (new; C5 + C6).
2. Pass-1 #2 court timing (C13 / C1).
3. Pass-1 #3 the Terrace colour (C10).
4. **C2** the working land empty even in the simulation (new; C1 + C3).
5. Pass-1 #4 and #5, town shape and colour (C2).
6. **F1** faces, lips, guards' dress and pose (new; C13 + C14).
7. Pass-1 #9 plus the newcomer's ten minutes: talk undiscoverable (C11, C8, C5).
8. **P2-2** the delegations with their animals (new; C13, C9). (P2-1 retracted.)
9. The stale "court absent default" text in 9 files (new; C13, lead).

# Fourth pass: a stranger's walk through 467 BC, judged by top AAA open worlds and by an Achaemenid scholar

Method:
- I walked the code and data in four parallel walks: the approach, stair and court; the town and a home; the plain, sky and
  year; and the voice, the words and the music.
- Nothing was rendered.
- Owners follow handoff/s18/sessions.md. "Unowned" means no s18 agent holds the file, so it goes to C7 or the lead by the
  rules.

**What already holds up (none of it needs work):**
- **The sky.**
  - Stars are precessed to 467 (HYG catalogue with astronomy-engine; Polaris is not at the pole).
  - Planets, Moon phase and eclipses are computed for the real dates.
  - Sunrise is computed for 29.9° N.
- **The calendar.** Parker and Dubberstein Babylonian months; 1 Nisannu of Xerxes' year 19 = 17 April 467.
- **Crops and trees.**
  - The crops are right: no rice, dates, cotton or citrus.
  - The trees are right: no eucalyptus or pine.
- **Animals.** Lions in the reeds, onager, gazelle, cheetah and 27 bird species.
- **The Terrace's numbers.**
  - XPa above each Gate colossus in three languages.
  - The bull and lamassu types are at the right Gate doors.
  - The Grand Stair has 63 + 48 steps with ~10.8 cm risers and a double reverse flight.
  - Every column count is right.
  - The Hall of 100 Columns is drawn about 30 % raised.
  - The audience panel is still at the centre of the Apadana stairs.
  - Herodotus' apple and pomegranate spear butts are there.
- **Daily life.**
  - Barley bread, beer, wine and sesame oil.
  - Carinated Achaemenid bowls and saucer lamps.
  - Elamite on clay; Aramaic in ink on leather.
  - Weighed silver, no coins in daily use.
  - Mats and chests; stools only in richer houses.
- **Talk.**
  - Languages by origin, with Aramaic as the lingua franca.
  - The talk prompt knows the king and year.
  - Artabanus' plot is fenced off.
  - Each voice is unique.
  - In-world music uses Pythagorean tuning.

## A. What breaks presence, ranked (screen share × time × how jarring)

| # | Hole | Evidence | Right (tier) | Fix | Owner |
|---|---|---|---|---|---|
| 4-1 | **The world never notices the stranger.** By default you walk through the Gate, into the "Harem" among 300 women, into the Treasury, and up to the enthroned king, and nobody reacts. Walking into a family's house or room draws a nod ("the town sees strangers every day"). | `settings.ts:26` playerMode 'observer'; `court.json:90` "never staged … no reaction"; `converse/sight.ts:39-85` checks only where the person is, never where the stranger is; `:83` | B: guards on every stair and door relief; a stranger in the house or before the throne is an alarm. The default goes to visitor (owned). Guards bar even an observer. People shout a trespasser out of the house, and the lane hears of it (a trespass deed). | S default; M reactions | C5 (default), C13 (court), C8 (sight, deeds) |
| 4-2 | **Nothing moves in the wind.** Grass, sward, stubble, thistle and camelthorn are static. Crops, reeds and trees sway on one fixed world axis, swinging evenly with no lean and no gusts, while the hearth smoke follows the real wind. Walking through barley parts nothing. | `plain/groundCover.ts` (no positionNode or time term); `groundFlora.ts:141`; `plain/crops.ts:33,44`; `plain/riparian.ts:76`; `trees/render.ts:209`; `hearthSmoke.ts:174` windWorld | A: AAA's main life cue (Ghost of Tsushima, RDR2). Pass windWorld() as a uniform, add a travelling gust wave and a steady lean, and bend plants around the player. | S–M | C3 |
| 4-3 | **The visitor mode is invisible walls and a glued escort.** A closed zone teleports you back. The Apadana and every palace are closed even on court days, so a stranger can never be led in, though delegations are. The escort is pinned 1.4 m in front of the camera, swings with the mouse and has no collision. | `main.ts:477` teleport; `world/visitor/controller.ts:62,79`; `access.json:353` | AAA practice: a guard steps in and lowers his spear. An errand puts the stranger at the back of a petitioners' party led in by an usher. The escort walks at the shoulder on the nav grid. | M | C5 (visitor; src/world/visitor is unowned, give it to C5) |
| 4-4 | **The house is mimed.** Grinding, kneading and baking happen on a random court cell with no quern, trough or oven (no work objects). Only 22 % of courts have an oven, yet everyone bakes at home. No house has an indoor hearth (35 % have no hearth at all). Winter nights get a fleece, not a fire. The evening meal is a 0.3 h "placeholder" warming. | `popgeo.ts:207`; `activities.ts:150` bake has no work object; `town_rules.ts:19` ovenShare 0.22; `interiors/plan.ts:207-216`, `:242`; `quarter.ts:357`; `population.ts:2534` "A placeholder activity" | B: the saddle quern and tannur; hearths in Iron Age Iranian rooms (Hasanlu, Nush-i Jan, Godin). Snap each act to its object or the neighbour's oven, add a room hearth lit in the cold season, and give the main meal 1–1.5 h of cooking. | M | C1 (popgeo, population); C2 (ovens: town_rules, quarter); interiors unowned (C7); C8 (activities) |
| 4-5 | **Wild animals behave like force fields.** Onager and gazelle slide round the player on a 150 m circle and snap back. No flight, no scatter, no alarm, silent hooves. Herds never walk to water at dawn and dusk. | `beasts.ts:114-117` keepAway; `:119` BEAST_CALLS night calls only; `:94` | A: a flee state with heading, speed and timer, then regroup out of sight (RDR2). Hoofbeats and alarm snorts. The dawn walk to the river. | M | Unowned (src/world/beasts.ts): C9 (fauna) |
| 4-6 | **The score uses the project's own banned clichés, is not wired, and has no switch.** A solo "duduk" (cor anglais), a ney, D minor in equal temperament, "Phrygian/harmonic-minor colours". Brief §11 bans "equal-temperament harmony, and oud, duduk, santur or orchestral 'ancient Persia' clichés". D-760 is cited in code but missing from DECISIONS.md. `startScore` and `themeTrack` are never called; the 146 s theme with a 124.7 s "title" mark is set against an 85 s opening with no title card. One slider is shared with musicians in the world. | `tools/score/cues/00_main_theme.ts:1-10,73`; `tools/score/orchestra.ts:12`; `blocklist.json` music-cliche; `public/audio/score/manifest.json`; `score.ts:31` | UD-38/39 allow an out-of-world score but don't require the Gladiator duduk. Record D-760. Write the theme without duduk or hijaz shorthand, or render it in a Pythagorean Scala tuning (sfizz). Cut it to the opening's 85 s, add a Score toggle and slider, and duck it near performers. | M | C11 (in progress: check before calling it broken) |
| 4-7 | **The court ceremony's details are wrong.** The parasol bearer walks his own route, so the parasol is often not over the king, and he holds it up indoors under the canopy. The audience lacks the bow with the hand before the mouth, the hazarapatiš who presents petitioners, the crown prince and the weapon bearer. | `activities.ts:428-429`; `court.ts:885,778`; `furnish_palaces.ts:311`; `court.json` king.label | B: the door jambs show the parasol always over the king; the Treasury audience relief shows a canopy, a Mede hand to mouth, and the prince behind. | M | C13 (court; activities.ts notes are C8's) |
| 4-8 | **The out-of-world text looks like a dev tool.** The talk panel: inline Georgia, a lowercase prompt, raw sim verbs ("…: done") and raw `why` strings. Every tablet reading carries a licence and BLOCKERS paragraph. The Treasury text says "No Persepolis Treasury text could be read for this build (B18)". The map footer: "OpenStreetMap ruin traces and the Phase 4 corrections". The chronicle shows "(D-209)", "(C)", unglossed BAR/halmi/šip, clock times, and raw zone ids ("turned back at hall100"). Controls lists F3 as "Evidence overlay" though it is the dev HUD with [PLACEHOLDER]. The loading text says "no map" while M is the map. Settings show "Ultra (full target)" and a "World seed 123…" label. | `converse/ui.ts:63-66,165-167`; `ui/translation.ts:65,172,184,241`; `people/calendar.ts:294-361`; `world/visitor/controller.ts:75-87`; `ui/shell.ts:48,113,233,249` | AAA polish: prose verbs; one line "English: the project's own translation (tier C)"; place-name labels; glosses on first use; "at the first watch". | S each | C11 (ui, shell, translation, converse panel styling), C1 (chronicle lines in people/calendar.ts), C5 (visitor strings) |
| 4-9 | **The night sky is flat.** The Moon is a blank white disc (no maria, no orange moonrise). Stars stay at full brightness down to 0° (no extinction, no twinkle). One cumulus layer all year (no cirrus, no winter stratus). No heat shimmer on summer afternoons. | `sky/skySystem.ts:276,287`; `sky/clouds.ts:29`; `sky/halo.ts:5`; `render/pipeline.ts:66` `?heat=1` only | A: the near side of the Moon is fixed. A PD NASA albedo map, air-mass reddening (already computed at `skySystem.ts:433`), extinction (`extinctionK` exists), a seasonal 2D cirrus deck, and the shimmer on by default. | S–M | C4 |
| 4-10 | **Animals keep the wrong hours.** Birds keep fixed clock hours: sparrows and crows until 18:30 in December (sunset 17:08), no sparrows at a 04:53 June sunrise. Jackals start before a June sunset. The bats' sunset table runs 10–23 min late. Birdsong hours are fixed too. | `wildlife.ts:33-34,106,476`; `audio/soundscape.ts:150-154` | A: tie the windows to sun.rise and sun.set, as beasts.ts:104 and the cock crow already do. | S | C9 (wildlife); soundscape unowned (C7) |
| 4-11 | **The stranger leaves no trace.** No footprints in snow, mud or dust, no dust kicked up, crops not flattened. | none in src/world or src/player | A: a standard AAA feedback loop. | M | C5 |
| 4-12 | **The market is season-blind, and the stranger can't buy a meal.** Fresh pomegranates and apples all year; no bread, beer, onions or live animals; "every square of every quarter is a market". The stranger eats off-screen from his purse and can't buy bread or beer or sit down to eat. | `fillPlan.ts:6,42-55`; `speech/stranger.ts:367`; the SAct goods are grain, fuel and goods only | C: seasonal goods (`economy/plans.ts:46` has the list); bread and beer sellers at their doors (lives.json lane_seller); fewer market squares. | S–M | C2 (fillPlan); speech/stranger unowned (C8) |

## B. Cheap scholar's winces (each S, under an hour)

| # | Wince | Evidence | Right (tier) | Owner |
|---|---|---|---|---|
| W1 | Ordinary men are named after Darius' Six (Vidarna, Vindafarnā, Utāna, Bagabuxša, Gaubaruva, Ardumaniš) | `population.ts:2150` DB_MEN | A: DB §68. Drop them from the everyday pool, as the kings and the "liars" already are | C1 |
| W2 | 144 of 158 Persian women's names are built mechanically from 14 elements × ~10 endings, giving doubled names (*Čiθračiθrā) and royal elements on poor women (*Xšaθrastrī). Men use Elamite tablet spellings, wives Old Persian with diacritics. A thin pool falls back to any culture (a Greek sister of an Elamite girl). | `names_recalled.json` _meta; `population.ts:2192` | A/B: one display register (the tablets' Elamite spelling, or plain Latin th/ch/kh); drop doubled and xšaθra- names; fall back to a related pool (Syrian to Babylonian, Ionian to Lydian) and keep a family's culture | C1 (+ the names data) |
| W3 | The king's crown has a crenellated rim | `outfits.ts:348` | B: at Persepolis (the Treasury relief, the jambs) a plain, slightly flaring cylinder; the crenellated crown is Bisitun's and the coins' | C13 |
| W4 | Shield guards also carry bow and quiver (`always: [... 'quiver','bow']`), against the data's own note. Median-dress guards wear a lappeted hood. Their activity text says "bow and quiver" where the Median files carry a gorytos. 30 % of Persian guards wear the Susa fillet. | `outfits.ts:356,367,337`; `looks.ts:229,285`; `court.ts:506,522,584` | B: Apadana and Tripylon guards carry spear and shield, or spear, bow and quiver. Median dress means a rounded felt cap, a gorytos and an akinakes. The fluted headdress for Persian spearmen. | C13 |
| W5 | "About two weeks ago": Persis had no seven-day week | `converse/words.ts:29`; `converse/life.ts:188` | B: days, half-months, months | C8 |
| W6 | The stranger's day wage is paid in silver (1/30 shekel) | `speech/stranger.ts:67` | A: hired labour was paid in kind (barley QA plus beer or wine; WAGE_GRAIN exists at :58) | unowned (C8) |
| W7 | People say "the river Pulvar" (a modern name); the data calls it "Araxes? of the Greeks" | `converse/life.ts:308`; `people/history.ts:40`; `plain.json:312,1286` | B: Pulvar = Medus, Kur = Araxes (Strabo 15.3.6, Curtius 5.4.7); in talk, "the river" or "the little river" | C8 (life), C1 (history), C3 (plain.json) |
| W8 | The map says "Tomb attributed to Xerxes" while he is alive; plus "Ka'ba-ye Zardosht" and "?" in labels | `plain.json:2802` | "The king's tomb being cut"; "the stone tower"; no question marks on labels | C3 |
| W9 | A present-in-467 building is named after the post-Achaemenid "Frataraka" complex, and that name is drawn on the map | `settlement.json:266` | "~1 ha building N of the Terrace" | C2 |
| W10 | The clock leads with the Babylonian month and gives Old Persian names for only 4 months ("others unknown"), though events_calendar.json holds all 12 Elamite and Old Persian names | `core/calendar.ts:32`; `core/clock.ts:28` | A: Persepolis scribes dated by the Elamite months; Old Persian 9 of 12 attested (DB) | C1 |
| W11 | Washing lines strung across the lanes (a modern Mediterranean image) | `fillPlan.ts:12` | C: dried on flat roofs and court walls | C2 |
| W12 | Low wooden tables for meals in most houses | `interiors/plan.ts:265` | C: a cloth on the mat; tables are elite | unowned (interiors: C7) |
| W13 | Spoken replies are padded with random dictionary nouns ("spearman… one… bread") | `converse/voice.ts:53` | Pad with hums, never bare nouns | C8 |
| W14 | The fallback lines say "sir" and dodge the king ("the king is in his halls…") | `converse/ownlines.ts:55,119` | "my lord"; "Xšayaršā the king, son of Darius, in his nineteenth year" | C8 |
| W15 | The reply fence treats 'coin', 'asia' and 'europe' as modern, misses hello, hey, yeah, cool and "no problem", and an NPC silently takes "coins" as silver | `converse/fence.ts:15`; `speech/verbs.ts:49`; `talk.ts:200` | A: darics and sigloi were struck from c. 500 (rare in Persis): the NPC is puzzled and says "silver, weighed". Asia and Europe are Herodotus' own words. Add the slang. | C8 |
| W16 | The talk download is quoted as "about 0.5 GB"; it is ~1.1 GB (TALK_MB) | `ui/shell.ts:261`; `converse/models.ts:44` | Generate the figure from TALK_MB | C11 |
| W17 | Loan interest is "a tenth more after the harvest" in one place and ~20 % a year in another | `economy/plans.ts:352` vs `economy/world.ts:7` | B: Neo-Babylonian loans ran ~20 % a year | C8 |
| W18 | The halmi (a travel and ration authorisation) is used as a palace pass | `world/visitor/controller.ts:75-87`; `visitor/access.ts:1` | B for what a halmi is: call it "your master's sealed letter", or label the use C | C5 |
| W19 | No millet beside the sesame, though the code's own Herodotus 3.117 note pairs them; no nightingale in the spring gardens | `plain/seasonal.ts:64`; `soundscape.ts:150-185` | B | C3; soundscape unowned |
| W20 | Gifts are stand-ins (Elamite bows and Gandharan shields drawn as cloth, the Kushite tusk as a sack, armlets as bowls) | `delegations.json:16,64,100` | B: the Apadana reliefs show distinct objects | C13 (+ C14 props) |
| W21 | No household figurines (Babylonian, Elamite and Egyptian homes; research rule overturned in D-771), no latrine or refuse pit | grep finds none in src | B/C | C2 / interiors (C7) |
| W22 | `src/data/lives_baked_s1.json` still ships (a 2-year-old remembering brickmaking, a married 7-year-old, a kite), gated off by D-348 | `converse/ui.ts:73-78` | Delete or regenerate | C8 |

Not cheap, recorded:
- **Kokoro voices.** The voice pools borrow modern accents: Persians get British and Hindi prosody, Greeks Italian (`neural/identity.ts:37`). Honest tier C, but audible: PLACEHOLDER-QUALITY (C8).
- **"Persepolis … 467 BCE" on the title** is fine: it is out-of-world English, the user's own layer. The fence's ban applies only to in-world speech.
