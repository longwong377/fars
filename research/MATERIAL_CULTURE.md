# MATERIAL_CULTURE (Persepolis, 467 BCE)

**Read this first: what is weak.** All hosts are blocked (BLOCKERS B6), so nothing here was read in full.
`SX` = search extract of a named page (page not verified), capped at **tier B**. `NS` = not seen this session (a model
prior of the reliefs and finds), capped at **tier C**; verify before modelling. Most of the relief evidence (dress, weapons,
furniture) is directly visible in photographs. Once PDFs or photos arrive (NEEDS #1–#4), many NS rows can be raised to A by
citing a plate. Source keys shared with PEOPLE.md are defined there.

## Source keys (new; add to `src/data/sources.json`)
| key | cite | url | access |
|---|---|---|---|
| IR-CLOTH | Iranica, "Clothing ii. In the Median and Achaemenid periods" | https://www.iranicaonline.org/articles/clothing-ii/ | SX |
| IR-CAND | Iranica, "Candys"; Wikipedia "Kandys" | https://www.iranicaonline.org/articles/candys-gk/ | SX |
| IR-WOMEN | Iranica "Women i"; J. Bakker, "Achaemenid visual representations of women", Iranica | https://www.iranicaonline.org/articles/achaemenid-visual-representations-of-women/ | SX |
| APAD-ANIM | Apadana delegations: TheCollector "Bas-reliefs of Persepolis"; Iranica/academia "Keeping and displaying royal tribute animals" | https://www.thecollector.com/fascinating-facts-from-the-bas-reliefs-of-persepolis/ | SX |
| STONE | Nylander 1965/1970 (titles); Iranica "Greece vii"; *IJAS* "Stoneworking techniques at Persepolis from quarry to the Terrace" | https://ijas.usb.ac.ir/article_6863.html | SX |
| ISAC-FINDS | ISAC Photographic Archives, "Miscellaneous finds" / "Contents of the Treasury" (Schmidt, *Persepolis II*) | https://isac.uchicago.edu/collections/photographic-archives/persepolis/miscellaneous-finds | SX |
| PFA-ISAC, IR-PET, IR-IMM, SUSA-ARCH | see PEOPLE.md | | SX |

## Dress
| item | description | source | tier | note |
|---|---|---|---|---|
| Two court costumes | (1) **riding costume**: tiara (soft cap), sleeved tunic, trousers, cloak; (2) **Persian court robe** (Greek *kypassis*?) | IR-CLOTH (SX) | B | Reliefs show both, side by side |
| Persian court robe | a single wide piece girt at the waist with a cloth belt, falling below in tiers of pleats to form a "skirt"; wide sleeves in folds | IR-CAND (SX) | B | King and nobles; guards in Persian dress. D-225: modelled as the reliefs carve it — a stack of vertical pleats at the front, diagonal folds from the hips back to the hem, broad folds behind, the hem higher in front, the sleeves cut on the slant; baked in the mesh (C for the cut and every size, Q-540) |
| Royal robe colour | Darius, Xerxes, Artaxerxes I all shown in the same pleated robe, "originally red or purple" | IR-CLOTH (SX) | B | Paint evidence: see Nagel 2023 (not reached) |
| Fluted headgear | tall fluted hat (probably from an Assyrian feathered headdress), worn by Persian-dress nobles and guards | IR-CLOTH (SX) | B | Only the king wears the tiara upright |
| Kandys | full-length sleeved coat slung over the shoulders with **empty sleeves hanging**; arms put into the sleeves in the king's presence (Xenophon) | IR-CAND (SX) | B | Median dress; often purple or of skins (Greek sources) |
| Trousers (*anaxyrides*), sleeved tunic (*sarapis*) | part of the Median riding costume with the kandys | IR-CAND (SX) | B | |
| Soft cap / bashlyk | rounded felt cap with neck flaps and chin cover (Median guards, grooms) | NS | C | visible on the Apadana reliefs; verify from a plate |
| Workers' dress | knee-length belted tunic, trousers or bare legs, no ornaments | NS | C | no worker imagery retrieved. Pull from delegation servants and animal handlers |
| Weather clothing | kandys and sheepskins in winter; felt caps | NS / IR-CAND "skins" (SX) | C | |
| Women: elite | many-folded Persian dress belted at the front, an elaborate necklace, a crenellated ("turreted") crown, bobbed hair (statuette of a high-ranking Persian woman from Egypt) | IR-WOMEN (SX) | B | |
| Women: Pazyryk tapestry | Persian women with crowns and a **long veil falling down the back** | IR-WOMEN (SX) | B | Hermitage. Achaemenid-period import. D-215: the court women's dress (robe, crown, veil; C, Q-435) |
| Women: seals | PFS 77*: a woman enthroned, a female servant behind (Neo-Elamite style); women in art almost always uncovered | IR-WOMEN (SX) | B | Chador-like covering only on Ergili relief, Pazyryk and some seals. **The chador itself is blocklisted** |
| Women: workers | no imagery. Reconstruct as the ordinary tunic with a mantle or headcloth | reconstruction | C | label C in the overlay. D-155: the cloth covers the head and the back of the neck, ends a little below the shoulders, and hangs down the front of the chest and the back (Q-249) |
| Children | no imagery; smaller tunics | reconstruction | C | |

## Delegation dress and the king's ceremonial dress (D-199; court setting only)
**Read first:** the identifications of the Apadana's 23 delegations and every detail below are recollections of Walser
1966 (WALSER1966) and of Schmidt 1953's plates and of photographs of the E stair, **NOT SEEN** this session: verify against
the plates (NEEDS_FROM_ME #1, #16). The full table is `src/data/delegations.json` and research/COURT.md section 5a.
| item | description | source | tier | note |
|---|---|---|---|---|
| The delegations' dress | 23 peoples in their own dress on the Apadana N and E stairs, each led by the hand by an usher: the Median riding dress (Medes, Armenians, Arians, Arachosians, Cappadocians, Parthians, Sagartians, Sogdians), long girt garments (Elamites, Babylonians, Lydians, Assyrians, Egyptians, Ionians, Arabs, Libyans, Kushites), knee-length tunics with trousers and boots or bare legs (Scythians, Bactrians, Gandharans, Thracians, Cilicians), a wrap to the knee and bare above (Indians) | APA-RELIEF (SX); WALSER1966, SCHMIDT1953 (NOT SEEN) | B form / C detail | delegations.json; costumes envoy, envoy_short, envoy_bare, median (outfits.ts) |
| Headgear by people | the Saka's tall pointed cap (Old Persian Sakā tigraxaudā, "pointed-cap Saka", in the royal lists: A for the name); Median soft caps; low caps of the lowland peoples (tassels and lappets not modelled); bands round the hair (Elamites' fillet, Bactrians, Gandharans, Indians, Arabs); bareheaded Ionians and Libyans | APA-RELIEF; DB-SKUNXA (NOT SEEN) | B (the pointed cap) / C | pieces cap_pointed, cap_low, headband, fillet, cap_soft |
| The delegations' gifts | vessels (the Armenians' griffin-handled amphora), bowls, armlets, cloth and garments, weapons, skins, baskets on a yoke (Indians), a tusk (Kushites); animals (horses, camels, bulls, rams, a lioness with cubs, an okapi) and chariots | APA-RELIEF, APAD-ANIM (SX) | B | carried as the prop system allows (bowl, jar, cloth, basket, sack, spear); the animals and chariots are NOT shown |
| Colours of the delegations' dress | the reliefs' paint is mostly lost | RELIEFS_AND_COLOUR | C | the D-189 natural dyes chosen per people for plausibility (delegations.json dyes), not from evidence |
| The king's ceremonial dress | the Persian court robe, the tall cylindrical crown, the long squared beard, a long staff in the right hand and a lotus flower in the left; a parasol held over him by an attendant, a fly-whisk and towel carried behind him by another (beardless) | HADISH-JAMB (door jambs of the Tachara, Hadish, Tripylon; NOT SEEN this session), TREAS-AUD (SX) | B | robe purple or red (IR-CLOTH, B; the dye C); the crown's dentate rim, the gold band, sizes C; costume king (the Persian mesh + the crown piece) |
| The throne and footstool | a high-backed chair with lion's-paw feet and a footstool (Treasury audience relief) | TREAS-AUD (SX) | B | work object 'throne': gilded wood and sizes C, fitted to the enthroned pose on the rig (seat 0.525 m, footstool 0.105 m) |
| Tents of the court's camps | Persian tents in the field (Herodotus 9.70: Mardonius' tent; 9.80: tents adorned with gold and silver in the Persian camp; 7.119: on the march a tent for Xerxes while the army camped in the open air: claims about an army, B, read this session); forms by analogy: a ridge tent of undyed wool or linen on two poles and a ridge pole, the black goat-hair tent of Iranian and Near-Eastern herders (ethnographic), a larger peaked tent of dyed cloth for Persians of rank | HDT (FT; claims) | B (tents) / C (forms, sizes, colours, lines) | camps.ts TENT_KINDS; world/courtCamps.ts |

## Hair and beards (D-155)
| item | description | source | tier | note |
|---|---|---|---|---|
| Court dressing of hair and beard | Persian- and Median-dress men on the Persepolis reliefs: the hair gathered in a bushy mass at the nape, the beard long and squared, both carved as rows of small snail curls; the long beard's lower part as wavy vertical locks ending in a row of curls | RELIEF-R; NS (a model prior of the Apadana and Tripylon reliefs; verify from a plate) | B for the carved convention, C for real hair | rendered as curls jittered in rows and blended with natural curls, not as carved shells (the literal pattern read as sculpture); Q-241. D-225: the long beard's hanging mass in 6 stacked rows of spiral curls (the D-155 wavy locks read as a combed block to the s7 reviewer), rolls in the mesh for the court dressing only; Q-543 |
| Median court grooming | the Median king "adorned with pencillings beneath his eyes, with rouge rubbed on his face, and with a wig of false hair — the common Median fashion"; Cyrus "encouraged also the fashion of pencilling the eyes" (8.1.41); "beauty-doctors who pencil their eyes" (8.8.20) | Xenophon, *Cyropaedia* 1.3.2, 8.1.41, 8.8.20 (read, session 7: XEN-CYR-EYES) | B (claim) | D-215: eye paint (the lashes' roots filled dark) for the king, the court women and half the Persian-dress nobles, a share of the town's women (C, Q-434); rouge and wigs not modelled; evidence that court hair was dressed, Q-241 |
| Hair and beard colour | painted dark blue on the reliefs (a convention); natural dark brown to black rendered, greying with age | RELIEFS_AND_COLOUR §3b | C | |
| Working men's beards | shorter, untrimmed beards of varied density; no relief evidence for workers | reconstruction | C | three densities (looks.ts) |
| Egyptians shaven | the Egyptians shave head and chin and let them grow only in mourning | Herodotus 2.36 (NS) | C | workers of Egyptian origin get no beard (D-092) |
| Thracians' colouring | the Thracians say their gods are "blue-eyed and red-haired" | Xenophanes fr. 16 DK (NS) | C | a Greek stereotype: a small share of Thracians get light eyes or auburn hair; Q-244 |
| Elite woman's bob | bobbed hair on the statuette of a high-ranking Persian woman from Egypt | IR-WOMEN (SX) | B | rendered as a bob hanging to the jaw line over the ears; length, fringe and parting C (Q-245) |
| Skin and eye colour by origin | not attested for any people of the empire (the reliefs paint by convention) | reconstruction from the modern regional cline (Jablonski & Chaplin 2000, title only) | C | Q-240, Q-244 |

## Colours and fabrics
| item | description | source | tier | note |
|---|---|---|---|---|
| Susa guard robes | patterned with checkers, rosettes and stars in turquoise, yellow and brown | SUSA-ARCH (SX) | B | glazed brick, Darius I |
| Purple or red | royal robe; kandys often purple | IR-CLOTH, IR-CAND (SX) | B | |
| Textiles in treasury workshops | treasury personnel probably include textile handlers (Baratkama dossier) | HENK2023 (SX) | C | |
| Wool, linen | the base fabrics | NS | C | **Silk: reject** (one low-quality extract says so; no evidence) |
| Dyes | madder red, indigo or woad, kermes, murex purple (royal) | NS | C | verify |
| Dyes in the Achaemenid world | madder (Rubia tinctorum) and indigotin identified by chromatography on the Pazyryk textiles, c. 400 BCE; the Pazyryk carpet's insect red placed in the steppe, not the Iranian plateau; red, yellow and blue the working palette | Sci. Rep. 11 (2021), "X-ray microscopy reveals the outstanding craftsmanship of Siberian Iron Age textile dyers" (https://www.nature.com/articles/s41598-021-84747-z; search extract, SX) | B | the palette of D-189 (looks.ts DYES); colours in CIELAB are C (Q-360) |

## Footwear and jewellery
| item | description | source | tier | note |
|---|---|---|---|---|
| Shoes | simple flat-soled shoes, probably leather; sometimes high boots | IR-CLOTH (SX) | B | Persian dress: low shoes with three straps and buttons on the reliefs (NS) |
| Boots | Median and riding dress: ankle boots tied with laces | NS | C | |
| Torque | a neck ring with animal-head terminals; worn by nobles and some guards; given as a royal gift | NS | C | Apadana reliefs; the Treasury relief (verify) |
| Bracelets | bracelets with animal-head terminals; also gifts in the Apadana delegations; "the bracelets on their wrists" are Median (Cyr. 1.3.2, read) | NS; XEN-CYR-EYES | C | D-215: plain gold rings at the wrists by rank, bronze for a share of the town's women (terminals not modelled; Q-432) |
| Earrings | ring earrings on guards and nobles | NS | C | D-215: gold hoops by rank, bronze for a share of the town's women (Q-432) |
| Necklace | on the elite woman (Egypt statuette) | IR-WOMEN (SX) | B | |

## Weapons of guards
| item | description | source | tier | note |
|---|---|---|---|---|
| Spear | long spear with a spherical butt (apple or pomegranate), silver or gold | SUSA-ARCH; IR-IMM (SX); HDT 7.41 (read: HDT-7.41-61) | B | Golden pomegranates for the 1,000, silver for the 9,000, apples of gold for those nearest the king (Herodotus 7.41). D-215: the king's spearmen (court setting) golden apples; one Persian-dress guard in ten golden pomegranates (C, Q-438) |
| Bow | composite bow over the shoulder | SUSA-ARCH (SX) | B | |
| Quiver | large quiver, called "wicker" in one caption; on the back | SUSA-ARCH (SX) | B | Persepolis reliefs also show a bow case (*gorytos*) on the Median guards (NS, C) |
| Akinakes | short sword in a scabbard hung at the right thigh, with a scabbard-tip chape. Median dress | Wikipedia "Acinaces" (search list only); scabbard tips in the Treasury (ISAC-FINDS, SX) | B | |
| Wicker shield | large oval or violin-shaped wicker shield on the Persepolis stair guards; the Persians' "wicker bucklers, with quivers hanging beneath them" (Herodotus 7.61, read) | NS; HDT-7.41-61 | C (form); B (claim) | verify from the Apadana/Tripylon photos. D-215: violin-shaped, held at the side by a share of the Persian-dress guards (Q-433) |
| Arrowheads | "hundreds of pieces of martial equipment such as arrowheads and scabbard tips" in the Treasury | ISAC-FINDS (SX) | B | trilobate bronze type (NS, C) |
| Scale armour | worn under the tunic (Herodotus 7.61) | NS | B per brief | hidden |

## Tools
| item | description | source | tier | note |
|---|---|---|---|---|
| Toothed (claw) chisel | parallel-line tooling; attested at Pasargadae (Palace P) | STONE (SX) | B | Nylander: Greek/Ionian technique |
| Masons' marks | on blocks at Persepolis and Susa. They resemble letters of the **Lydian** alphabet. They show separate teams carving at once, with the same teams on both Apadana stairs | STONE (SX) | B | Useful for "a mason's mark on a block" (brief §1). **Built (D-212):** four shapes only (the reliefs' "double diamond", ROAF1983; circle, cross, L of Pasargadae, PAS-MARKS), 68 on the Apadana stair reliefs' background and one on each dressed drum's bedding face; positions and sizes C (Q-393) |
| Stoneworking sequence | quarry → terrace: setting, attaching, dressing on site. Unfinished sculptures and capitals exist | STONE (SX) | B | |
| Drill, point, flat chisel, mallet, bronze or iron tools, dovetail clamps | — | NS | C | clamps are also noted in SITE_SPEC (SX) |
| Carpentry | treasury personnel include wood handlers and carpentry-supply staff | HENK2023 (SX) | B | tools are NS (adze, saw, bow-drill), C |
| Mortars and pestles | green-chert ritual mortars, pestles and plates found in the Treasury, with Aramaic ink inscriptions | ISAC-FINDS (SX; "mortars and pestles") | B | the chert and the ink texts are NS (C). The inscriptions are dated to the Xerxes/Artaxerxes era (verify) |

## Vessels
| item | description | source | tier | note |
|---|---|---|---|---|
| Egyptian alabaster (calcite) vessels | bowls and bottles, some inscribed with dates, as tribute from Egypt, stored in the Treasury | ISAC-FINDS (SX) | B | inscribed to Xerxes (NS) |
| Egyptian-blue vessels | vessels of a bluish-green artificial compound | ISAC-FINDS (SX) | B | |
| Rhyta, phialai (fluted bowls), amphorae with animal handles | brought by delegations on the Apadana (Lydians, Armenians and others) | APAD-ANIM (gold and silver, SX); forms NS | B/C | |
| Storage jars | large ceramic jars for grain, wine and beer. Wine is counted in marriš (≈10 L) | NS; unit SX | C | |
| Everyday pottery | plain buff wheel-made wares | NS | C | |

## Furniture
| item | description | source | tier | note |
|---|---|---|---|---|
| Throne and footstool | the king enthroned with a footstool, the crown prince standing behind (Treasury Audience relief) | x.com/HistContent caption (SX) | B | footstool NS |
| Throne-bearers | 28 peoples lift the throne platform (Hall of 100 Columns / Tripylon door reliefs) | NS | C | Hall of 100 Columns is under construction in 467 |
| Parasol and fly-whisk | carried behind the king | brief §9.1; NS | C | |
| Incense burners | tall stands before the king (Treasury relief) | NS | C | built as bronze stands with a stepped conical lid (D-212) |
| Couches and tables | "couches gilded and silver-plated", "golden and silver couches richly covered, and tables of gold and silver" in the establishment Xerxes left to Mardonius | HDT 9.80, 9.82 (FT, Greek claim) | B | form after the Assurbanipal garden relief (ASB-GARDEN, analogy, NS); built D-212, C |
| Wall hangings | "gaily coloured tapestry" (Mardonius' establishment); hangings of white, green and blue on silver rings at Susa | HDT 9.82 (B claim); Esther 1:6 (late literary, NS) | B / C | built D-212: banded wool on gilded rods, C |
| Pile carpets | knotted wool pile, ~1.83 × 2.00 m, red field of squares, borders of deer and horsemen; Achaemenid style, c. 400 BCE | PAZYRYK (recollection, NS) | B (craft, size) | built D-212: field of squares in a border, C |
| Stools, footstools, chests, lamp stands, storage jars | ordinary household and palace pieces | NS | C | built D-212 (stored with the court away, in use with it); lamps are clay oil lamps, never candles (blocklist) |

## Writing
| item | description | source | tier | note |
|---|---|---|---|---|
| Elamite clay tablets | the main administrative medium; PT: 139 Elamite + 1 Akkadian published | IR-TREAS (SX) | B | Tongue-shaped (PF) or larger rectangular PT letters (NS) |
| Aramaic | ≈850 Aramaic Fortification tablets and fragments; ink or incised | PFA-ISAC (SX) | B | Aramaic on leather (parchment) is attested in the empire (Arshama letters, NS); in 467 Persepolis, C |
| Seals | impressions of thousands of **cylinder and stamp** seals; ≈5–6,000 sealed tablets without text | PFA-ISAC (SX) | B | Seals rolled across the tablet or string. PFS 77* (a woman) |
| Seal owners | seals tied to named officials (e.g. Parnakka's seal) | IR-PET (SX) | B | |
| Treasury uninscribed labels/bullae | sealed labels on stored goods | NS | C | verify in Schmidt, *Persepolis II* |

## Transport
| item | description | source | tier | note |
|---|---|---|---|---|
| Chariots | brought by the Syrians and Libyans on the Apadana | APAD-ANIM (SX) | B | spoked wheels allowed (blocklist) |
| Horses | brought by 7 of the 23 delegations (Medes, Armenians, Cappadocians, two Saka groups, Sagartians, Thracians) | APAD-ANIM (SX) | B | no stirrups (blocklist) |
| Bactrian camel | two-humped, led by the Bactrians | APAD-ANIM (SX) | B | |
| Dromedary | led by the Arabians | APAD-ANIM (SX) | B | |
| Horse rations | bread and wine given to horses in the PF | Potts 2023, "Pain et vin" (title, SX) | B | |
| Donkeys and mules | pack transport; carts | NS | C | commodity transport in the PF is SX (B) |
| Travellers | carry sealed authorisations stating their ration scale | IR-PET (SX) | B | drives visitor mode |

## Food
| item | description | source | tier | note |
|---|---|---|---|---|
| Barley, flour | the staple ration | IR-PET (SX) | B | |
| Wheat (*tarmu*) | "probably wheat" | IR-PET/Cooking (SX) | B | |
| Dates, fruit | in the journals | IR-PET (SX) | B | dates were imported to Fars from the lowlands (NS) |
| Wine, beer | rations; also offerings to gods and priests | IR-PET (SX) | B | |
| Sheep, goats | rations and sacrifices | IR-PET; Henkelman "Animal sacrifice" (title) | B | |
| Poultry | fodder for poultry is recorded | IR-PET (SX) | B | |
| Bread | barley flatbread baked on griddles or in tannur ovens | NS | C | |

## Animals present
| animal | context | source | tier |
|---|---|---|---|
| Horses | stables, couriers, delegations | APAD-ANIM, IR-PET (SX) | B |
| Camels (Bactrian, dromedary) | caravans | APAD-ANIM (SX) | B |
| Sheep, goats | flocks managed by the PF administration | IR-PET (SX) | B |
| Poultry | fed on fodder | IR-PET (SX) | B |
| Donkeys, mules | pack animals | NS | C |
| Dogs | herding and guarding | NS | C |
| Zebu, lions, oryx, okapi, wild ass | delegation or tribute imagery only. **Not live in 467 by default** | APAD-ANIM (SX) | B (imagery) |
