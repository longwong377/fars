# ACCESS: visitor mode in 467 BCE (the sealed travel authorisation, who may go where, the errand, the stop)

Machine-readable: `src/data/access.json`. The lead builds visitor mode from that file; this file explains it.
Frame and ids: the grid and the place, post, building and zone ids of `src/data/site_spec.json`,
`src/data/geo/footprints.json`, `src/data/people_places.json`, `src/data/settlement.json`, `src/data/town.json` and
`src/data/town_plots.json`. **No new geometry is introduced.** Every coordinate in access.json is copied from one of
those files, and the row names the source field.
Access key: `FT` = read in full this session; `SX` = web-search extract of a named page (capped at B); `NS` = not seen
(capped at C). Every scholarly host is still blocked (BLOCKERS B6). GitHub raw was reachable, so four sets of texts were
read in full: the CDLI dump (the 67 PF texts), Herodotus and Xenophon's *Cyropaedia* (Perseus TEI), and the King James
Bible (for Ezra, Nehemiah and Esther).

## Read this first: what is weak, uncertain or reconstructed
1. **No text describes anyone being stopped or checked at Persepolis.** Every Terrace guard post, every rule and every
   step of the stop procedure is **C**. The check that *is* attested, in the Darius-era archive, happens at the ration
   point. A supplier issues travel rations against a *halmi* and records whose halmi it was, and the receipt goes to
   Persepolis for accounting (B).
2. **Guards in the tablets are not confirmed.** The brief says the tablets attest guards at Persepolis. No PF or PT guard
   text was retrieved (PEOPLE §4 GAP). The only extract on the PF "lance-bearers" says they served mainly as **labour
   inspectors and escorts of groups, not as military guards** (HENK2002, SX). The Terrace garrison of the build (100 men,
   D-023, Q-043) stays C.
3. **The *halmi* evidence is Darius-era** (509–493 BCE). There is one later exemplar, Aršāma's travel authorisation
   (late 5th century, SX). Using the halmi in 467 relies on continuity between the two: B for the institution, C for
   any detail. **Nobody is known to have issued halmis in 467.** The issuer of the visitor's halmi is a decision
   (D-101), not evidence.
4. **Rules by zone are C, with two exceptions:**
   - "All visitors had to pass through [the Gate of All Nations], the only entrance to the terrace" (ISAC caption, SX,
     B).
   - Xerxes blocked the older southern approach when the NW stairway was finished (Livius, SX, B/C).
5. **Greek and biblical passages describe other palaces.** They cover Susa, Babylon and the Median court, and they are
   literary claims. They are B for "a Persian practice" and never A for Persepolis. Esther is late and literary: C.
6. **No evidence gives the processing time for any document.** Every wait in the errand is C.
7. **The errand is a composite.** Each part has a B-grade parallel:
   - Treasury letters addressed to the treasurer;
   - halmis issued at the point of departure;
   - rations issued against the sealed document.

   The chain itself, the places in the town and the timing are C.
8. **Two lexicon entries marked "NOT SEEN" are attested in texts read this session:**
   - *hal-mi* "sealed document" in PF 15 (FT);
   - *du-iš-da* "(he) received" in 26 of the 67 CDLI-PF texts (FT).

   Two words the errand needs are attested but missing from the lexicon: *hu-ut-lak* "messenger" (PF 45, FT) and
   *kur-min* "supplied by / allocation" (47 texts, FT). The lexicon file was not changed, because that is outside this
   task (Q-127).
9. **The town has no rendered road station.** town.json `station` (−1800, 600) is abstract, and the only rendered
   station is the Kur way-station, 11 km W. The errand therefore runs through the rendered storehouse, official
   building and stable (C, D-104).
10. **A conflict with the simulation.** Aršāma's clause reads "If he should be more than one day in a place, then for
    these days do not give them any rations". Travellers in the simulation draw station rations for 1–5 days (E-21,
    `travellers_stay`). See Q-128.

## 0. Sources new in this pass (added to `src/data/sources.json`; details in SOURCES.md)
| key | what | access |
|---|---|---|
| KJV-BIBLE | King James Bible (public domain): Nehemiah 2:1–10; Ezra 5:6–17, 6:1–2; Esther 2:19–21, 3:12–15, 4:2, 4:11 | FT |
| ARSHAMA-TA | Aršāma's travel authorisation for his steward Nakhthor (Bodleian Aramaic letters; Oxford "Travel authorisation by Arshama"; Bodleian Arshama project) | SX |
| HALMI-SX | search summaries of Henkelman's work on the *halmi* (esp. "The seal of prince Aršāma: from Persepolis to Oxford", 2020) and Iranica "Persepolis administrative archives". **Which sentence comes from which page cannot be verified** | SX |
| MDPI-ARACH2025 | "Deciphering Arachosian Tribute at Persepolis", *Religions* 16/8 (2025) 965 (NN 0859, Maudadda) | SX |
| HUNARA2024 | "One Person, Several Names: Median or Old Persian?", *Hunara* 2/1 (2024) (Kaudama with a halmi of Zisramaš = Ziššawiš) | SX |
| POTTS2024 | D. T. Potts, "Similarities and differences between the office of the Achaemenid *barrišdama* and the Safavid-Qajar *mihmāndār*", *Ktèma* 49 (2024) 207–21 | SX (abstract) |
| HENK2002 | W. Henkelman, "Exit der Posaunenbläser: on lance-guards and lance-bearers in the Persepolis Fortification archive", ARTA 2002.007 | SX (abstract) |
| SEALDOC2018 | "El documento sellado en la Persia aqueménida" (ResearchGate, 2018): *miyatukkaš* = OIr. \*viyātika- | SX |
| AZZONI2019 | A. Azzoni, ARTA 2019.003: Aramaic *ptp* "rations" on PF 0999 | SX |
| PFA-ISAC | ISAC Persepolis Fortification Archive project pages; ARTA 2007.001; the find-spot of the PF tablets (key named in PEOPLE.md but missing from sources.json until now) | SX |
| ALEX-HIST | Alexander historians via search extracts: Diodorus 17.71 (Persepolis citadel and treasury); Arrian, *Anabasis* 6.29 (guardians of Cyrus' tomb) | SX |

These are 11 new keys, against a cap of about 10. KJV-BIBLE and ALEX-HIST carry only the gate and guard analogies.
Existing keys used: CDLI-PF, HDT, XEN-CYR, IR-ADMIN, IR-PET, IR-TREAS, IR-PERS, IR-FORT, HYLAND2022, RATION-30,
PT-WAGE, ISAC-PA, ISAC-FINDS, IRANTOUR-TREAS, LIVIUS, LIVIUS-TR, LIVIUS-TREAS, ROYALROAD-GIS, REF-PLAN, GONDET2009,
GONDET2018, TOLAJORI2017, PW2017, BAKER2014, QANAT-WH2018, POTTS2023, RELIEF-R, EVENTS-R, PEOPLE-R, RECON, DERIVED.

## 1. The travel authorisation: *halmi*
### 1.1 The word
| claim | source | access | tier |
|---|---|---|---|
| Elamite *hal-mi* in a grain transfer: "30 bar of grain, supplied by Karma, (in accordance with) a sealed document of Irtuppiya, Kadukku received, and took (it to the place) Matezziš" (month 4, year 21) | CDLI-PF PF 15 (transliteration `hal-mi {hal}ir-tup-pi-ia-na`; Hallock's translation) | FT | **A** (word, spelling and sense; Darius-era) |
| *halmi* literally "seal"; derived senses "seal impression", "sealed document", "letter order", "travel authorisation" | HALMI-SX | SX | B |
| in the PF the term "denotes a document (probably sealed with the royal seal) which individuals carry", not the king's seal itself | IR-ADMIN | SX | B |
| *miyatukkaš* (OIr. \*viyātika-, "travel pass") and *halmi* used more or less interchangeably | SEALDOC2018 | SX | B |
| Aramaic: no word for the document was retrieved. The lexicon has ʾgrh "letter", ḥtm "to seal", ʿzqh "signet ring" | research/LEXICON/aramaic.json | – | B (the words) |

### 1.2 Who issued it
| issuer | example (as given by the source) | source | access | tier |
|---|---|---|---|---|
| the king | "He (Maudadda) carried a sealed document (travel authorization) from the King, he went to Barrikana (\*Parikāna-), twelfth month": flour from Mirayauda for Maudadda and his aides, bound for Arachosia (NN 0859) | MDPI-ARACH2025 | SX | B |
| the head of the Pārsa administration (Parnakka) | "16 quarts of wine, supplied by Ušaya, Aššašturrana the battle-axe bearer received as ration. He went to the king. He carried a sealed document of Parnaka." | RATION-30 | SX | B |
| his deputy (Ziššawiš) | "Kaudama carries a halmi from Zisramaš (= Ziššawiš), and they started off their journey from Persepolis in the month Ānāmaka of the year 22" | HUNARA2024 | SX | B |
| "the king or officials of satrapal level" | "Travelers along the road carried sealed documents issued by the king or officials of satrapal level stating the scale on which they were entitled to be fed" | IR-PET, IR-ADMIN | SX | B |
| the satrap at Susa | "Travel away from Susa is indicated by the halmi of Bakabana, the satrap in Susa"; "the highest deputy of a satrap, such as Ziššawiš in Parsa, could also issue halmis in some areas" | HALMI-SX | SX | B (page attribution uncertain) |
| the satrap at Sardis | Lycian *marataš* whose travel Artaphernes (Irdapirna) authorised; Irdapirna in NN 0196 (year 27) | HYLAND2022; HALMI-SX | SX | B |
| a satrap, later | Aršāma's authorisation for his steward: "the only surviving example of a halmi, an authorisation from a satrap to a lower official to travel on a royal road … and draw supplies from road-stations en route" | ARSHAMA-TA | SX | A (the object survives) / B as a model for 467 |

**Pattern (B, inferred from the rows above):** the issuer belongs to the place the journey starts from. Journeys from
Susa carry the Susa satrap's halmi; journeys from Pārsa carry halmis of Parnakka or Ziššawiš; the Lycians from Sardis
travel under Artaphernes. Journeys to or from the court carry the king's halmi. **In 467 none of these men is attested,
and the holders of the offices at Susa and at Pārsa are unknown** (PEOPLE §1c; Q-120).

### 1.3 What it said
| element | evidence | source | tier |
|---|---|---|---|
| the bearer by name, his party and where he goes | the Q texts name the recipient and the party, and say where they went ("He went to the king"; "he went to Barrikana") | RATION-30, MDPI-ARACH2025 (SX) | B |
| the scale of rations per day | "stating the scale on which they were entitled to be fed" | IR-PET (SX) | B |
| the officials along the route, by name | Aršāma addresses Marduk, Nabudalani, Zatohi, Upastabar, Bagapharna, Phradapharna and Gavazana, officers at places on the road; the provisions are "given by each officer in turn, in accordance with the stages of the journey from province to province until he reached Egypt" | ARSHAMA-TA (SX) | A (that document) / B (as a model) |
| rations in that letter | Nakhthor: 2 measures of white meal, 3 of grey meal, 2 of wine or beer and 1 sheep a day. His 10 servants: 1 measure of meal each a day, with hay for the horses. Two Cilicians and one craftsman: 1 measure each | ARSHAMA-TA (SX) | A / B |
| a limit on stays | "If he should be more than one day in a place, then for these days do not give them any rations." | ARSHAMA-TA (SX) | A / B |
| the PF travel ration | 1–1.5 L flour + about 1 L drink per person per day; 1,633 Lycians drew 2,450 L of flour (1.5 L each) | HYLAND2022 (SX); PEOPLE §P5.2 | B |
| drink | "In texts with wine or beer as travel rations, the amount most commonly issued is one quart per person per day" | search summary of the achemenet "Selected Fortification texts" PDF (SX) | B |
| **not known** | whether a halmi stated the bearer's business (e.g. "carries a letter for the treasurer"); how long it stayed valid; whether it covered the return journey | – | GAP |

### 1.4 Form, carrying, showing
| claim | source | access | tier |
|---|---|---|---|
| the traveller carries it: "he carried a sealed document of X" (the Q-text formula as translated) | RATION-30, MDPI-ARACH2025, IR-ADMIN | SX | B |
| leather, with a sealed bulla that "constituted an essential component, completing and conferring the necessary authority to the record and adding a seal image that suppliers and other officials throughout the empire had learned to recognise" | HALMI-SX | SX | B |
| the Aršāma letters survive as leather ("parchment") letters, with two leather bags and clay sealings | ARSHAMA-TA | SX | A (objects) / B (for 467) |
| shown at each ration point. The receipt tablet is "sealed by supplier and recipient", goes "back to Persepolis as a record of the transaction", and is drawn up "at road stations and later delivered to Persepolis for accounting purposes" | IR-PET, IR-ADMIN | SX | B |
| stations with food reserves on the main roads "at intervals of one day's journey" | IR-PET (SX); HDT 5.52.1 "all along it are the king's road stations and very good resting places" (FT, claim) | SX / FT | B |
| a royal letter is handed to a royal scribe and read out ("all of the governors of the King have scribes"); the spearmen obey what it says | HDT 3.128.3–4 | FT | B (claim; Sardis, Darius I) |
| clay or leather? The Elamite Q texts *record* the halmi and are not the halmi. Whether any halmi was clay is unknown | – | – | C (Q-122) |

### 1.5 What it entitled
- **Travel rations at the stations,** for each day of travel (B, §1.3). The Aršāma letter adds **fodder for the
  animals** (A for that document, B for 467).
- **Guides:** the *barrišdama*, "charged with escorting select individuals and large groups on journeys, some of which
  were over hundreds of kilometers" (POTTS2024, SX, B). The build gives the visitor **no** guide (C, D-101).
- **Horses for express messengers** at stations a day apart: HDT 8.98 (FT, a claim, B); *pirradaziš* "express
  messenger" (lexicon, B).
- **Letters to officials on the way, and an escort** (a later analogy, B/C): "let letters be given me to the governors
  beyond the river, that they may convey me over … Now the king had sent captains of the army and horsemen with me"
  (Nehemiah 2:7–9, KJV-BIBLE, FT; set at Susa in the 20th year of Artaxerxes I, 22 years after 467).
- **As a "letter order",** an official's halmi authorised a store to issue goods to a named receiver (PF 15, A,
  Darius-era).
- **Not attested:** that a halmi opened any door on the Terrace. In the build it identifies a traveller on state
  business, and a guard judges what that allows (§2, C).

### 1.6 Checks: what we can say and what we cannot
- **Attested practice (B):** the check at the ration point (§1.4).
- **Roads (B, Greek claims):** "the roads were guarded" (HDT 1.123.3, under the Medes; 5.35.3, under Darius). A message
  was hidden "so that the bearer of this seemingly blank tablet might not be troubled by the way-wardens" (7.239.3).
  There were "a defile … and a great fortress to guard it" at the Halys, and "two defiles and … two fortresses" at the
  Cilician border (5.52.2).
- **Palace gates elsewhere (B, claims):**
  - HDT 3.72 and 3.77 (Susa, 522): "guards are stationed all around". They let the leading Persians pass "and no one
    asked any questions". In the court, "the eunuchs that carry messages … asked the seven why they had come".
  - HDT 3.118: "the gatekeeper and the messenger forbade him".
  - HDT 3.140 (Susa): Syloson "sat in the king's antechamber"; "the doorkeeper brought word of this to the king", then
    "brought Syloson in".
  - XEN-CYR 7.5.25–27 (Babylon): "we shall find a guard before the gates, for one is always posted there"; the gates
    were locked at night.
  - XEN-CYR 4.5.14: "the sentinels, following the instructions of Cyrus, refused to admit them before daylight".
  - XEN-CYR 7.5.68: the palace guard of spearmen stood "about the palace day and night, whenever he was in residence;
    but whenever he went away anywhere, they went along".
- **Officials questioning strangers (B/C, biblical):** Ezra 5:9–10: "Who commanded you …? We asked their names also,
  to certify thee, that we might write the names".
- **Late and literary (C):** Esther 2:19–21 and 4:2 describe people sitting "in the king's gate" and "keepers of the
  threshold".
- **At Persepolis: nothing.** The Gate's bench is B (IR-PERS, ISAC-PA). The reading of it as "designed for delegations
  waiting to be summoned before the king" is modern and tertiary (SX, C).
- **Conclusion:** a check at the Gate of All Nations and at the Treasury door is **C**, built on B practice from other
  places.

### 1.7 The visitor's halmi in the build (D-101)
| item | value | tier |
|---|---|---|
| issuer | the satrap at Susa, named by office only. The halmi covers the journey Susa → Pārsa (the pattern in §1.2) | C (B pattern) |
| bearer | the visitor as a messenger (Elam. *hutlak*, PF 45, "(He is) a messenger of Irtuppiya", A Darius-era) of an unnamed official; alone; no guide | C |
| form | folded leather, tied, with a clay bulla. **Never opened in the world.** No Aramaic text is rendered: brief §10 allows only published texts, and none fits (Aršāma's letter names other people and dates c. 410) | B (form) / C (instance) |
| scale | 1.5 qa flour and 1 qa wine or beer a day | B |
| what else he carries | a sealed letter for the treasurer at Pārsa. Its content is unknown to the visitor and is never shown. Leather with a bulla, as inter-provincial letters are (Aršāma), and the letter language is Aramaic (LANGUAGES.md) | C (B form) |
| what it does in the world | rations at the storehouse or station; a reason to be let through the Gate and escorted to the Treasury door; the stamp of state business on the visitor. It does **not** open palaces, the Apadana, the Treasury's interior or the garrison | C |

## 2. The Terrace in 467, court absent: who could go where
### 2.1 What is known
| fact | source | access | tier |
|---|---|---|---|
| Xerxes named the Gate "The Gate of All Countries", "for all visitors had to pass through this, the only entrance to the terrace, on their way to the Throne Hall to pay homage to the king" | ISAC-PA (Gate of Xerxes page) | SX | B (fact of the single entrance); the "homage" gloss is C |
| "The original approach to the Persepolis platform was from the south, but Xerxes blocked that entry when he finished the north-western stairway"; the S part was reorganised 480–470 | LIVIUS ("Terrace, Southeastern access") | SX | B/C (tertiary) |
| the Gate: "one spacious room", four columns; "parallel to the inner walls of this room ran a stone bench, interrupted at the doorways"; W entrance, E and S exits; bulls W, man-bulls E | ISAC-PA; IR-PERS | SX | B |
| the Treasury: "the entrance opened toward a line of small guardhouses" (first phase, W); later a N entrance; extended N under Xerxes with a large hall "and several guardrooms"; "one controlled entrance" | IRANTOUR-TREAS, LIVIUS-TREAS; ISAC-PA summary | SX | C (tertiary; Q-P4-12) |
| the Treasury held weapons (arrowheads and scabbard tips by the hundred), sealed stores (199 sealings, many with string marks from bags, boxes or containers) and, in 330, "vaults … packed full of silver and gold" | ISAC-FINDS; IR-TREAS; ALEX-HIST (Diod. 17.71) | SX | B (finds) / B claim (Diodorus) |
| the "garrison quarters": "near the southeast corner of the Terrace, at the foot of the mountain, were buildings of modest size and insubstantial structure, whose contents indicate that they were quarters for members of the garrison and perhaps for artisans" ‖ "their function is unknown … the name is just conventional" | ISAC-PA ‖ LIVIUS | SX | B ‖ conflict; working value: garrison quarters (C) |
| Apadana S side: "storage- and guardrooms"; Hadish flanking suites each with a guardroom | IR-PERS; _extract_B | SX | B / C |
| guards in Persian and Median dress on the stair façades (Apadana, Tachara XPc, Hadish XPd, Tripylon) | RELIEFS_AND_COLOUR, SITE_SPEC | SX | B (motif; **not** a list of posts) |
| the E fortification: a 10 m mud-brick wall with towers along the E edge, joined to a towered wall up the slope and along the crest of the Kuh-i Rahmat | IR-FORT; ISAC-PA | SX | B |
| Diodorus: the citadel had "a triple wall" with gates of bronze, "the gates themselves were for security" | ALEX-HIST | SX | claim; **the triple wall is not adopted** (the excavated Terrace does not show it; SITE_SPEC) |
| the palace guard is at the palace only while the king is | XEN-CYR 7.5.68 | FT | B (claim) |
| the PF tablets were found "at the northeastern corner of the platform … in two small spaces of a bastion in the casemate fortification wall", "near the staircase in the tower"; "the entrance to the rooms were bricked up in antiquity" | PFA-ISAC | SX | B (the date of the bricking-up is unknown) |
| the PT tablets were found in "a northeastern room of the Treasury"; a group in Room 33 (1936); inscribed chert objects "almost exclusively in Treasury Hall 38"; "most of them concentrated in or around a single room" | IR-TREAS | SX | B |

### 2.2 The four rule levels (for the visitor; observer mode bars nothing)
| rule | meaning | who stops the visitor |
|---|---|---|
| **open** | walk in freely. People may look, but nobody asks | nobody |
| **business** | only with the halmi shown and a stated business that belongs to this place (the errand's current step names it). Without it, the visitor is turned back | the check posts of the zone |
| **escort** | only with a guard or official walking beside him, given at a check post when the business lies beyond. Alone, he is turned back | the posts, and any guard who meets him alone |
| **closed** | no entry in this mode, and no escort offered. The only exceptions are ones the errand names explicitly | bar posts; any guard |

Night (sunset to sunrise): the Terrace is **closed** to the visitor, and he is turned back at the stair heads. The
analogy is XEN-CYR 4.5.14 and 7.5.27 (B claims); the rule is C. The town's lanes stay open.

### 2.3 Terrace zones (court absent; rule by day / by night / with the "seasonal pattern" court setting)
| zone id (source) | day | night | court resident | checked at | tier | basis |
|---|---|---|---|---|---|---|
| `town` → `stair_foot` (people_places; the plain approach) | open | open | open | – | C | the plain below the Terrace; the depot is where caravans unload (people_places) |
| `grand_stair` (footprints, site_spec) | open | closed | open | post_stair_n, post_stair_s (watch) | C | the only ascent in 467 (ISAC-PA, LIVIUS: B). Porters use it all day (sim). The stair-head guards watch, and turn people back at night |
| `gate_nations` / `gate_hall` (site_spec, people_places) | business | closed | business | post_gate_w1, post_gate_w2 (check) | C (B single entrance) | "all visitors had to pass through this" (B); the stop and the waiting bench are C (§4) |
| `terrace_courts` (the open ground inside the Terrace outline: forecourt, the court E of the Apadana, the Hall 100 forecourt, the Tripylon N court) | escort | closed | escort | post_gate_s1, post_gate_s2 (check), and any guard | C | a stranger is not left to walk the royal Terrace alone. Recognised on a later day while the same errand is open, he may go on alone to the place of business (§6) |
| `treasury_street` (the ~12 m street between the Hall 100 S wall and the Treasury N wall: site_spec treasury.r_north_wall_y note) | business | closed | business | post_treas_1–4 (check) | C | where the visitor hands in the letter and waits for the answer |
| `apadana`, `apadana_hall` and the Apadana N and E stairs | closed | closed | closed (audience only by summons; not part of the errand) | post_apa_w, post_apa_e (bar) | C | D-003: the king is absent and the Apadana is closed. Access by summons when he is present: HDT 1.99, 3.118, 3.140 (B) |
| `tachara`, `hadish`, `harem` (and their courts and stairs) | closed | closed | closed | post_tachara_1–2, post_hadish_1–2, post_harem_1–2 (bar) | C | palaces with the king away: caretakers only (PEOPLE §P5.6). With the king present: the royal household (XEN-CYR 7.5.68, B) |
| `tripylon` | closed | closed | closed | proposed: Tripylon narrow E stair foot (bar, unplaced) | C | under construction; set between the palaces |
| `hall100` and `worksite`, `worksite_capital`, `work_hearth`, `oven`, `querns` (the masons' yard and camp) | closed | closed | closed | any guard; the foreman | C | a royal building site and its camp; seen from the court in passing |
| `treasury` (building) and `treasury_store` | closed | closed | closed | post_treas_1–4 (check at the door) | C (B guardrooms, tertiary) | the one controlled entrance and the guardrooms (C); silver and stores (B). The visitor stays at the door |
| `treasury_desk` (the scribes' room; the PT find-spot) | closed (errand variant B: escort) | closed | closed | post_treas_1–4 | C | default: the letter goes in and the visitor waits outside. Variant B (the lead chooses): escorted to the scribes for the hand-over |
| `garrison` with `garrison_sleep`, `garrison_hearth_s/m/n`, `water` | closed | closed | closed | proposed: garrison W and S doors (bar, unplaced) | C | soldiers' quarters (ISAC-PA B / LIVIUS conflict) |
| `fortification_e` and `pf_archive_findspot` (NE bastion: terrace outline vertices 31–36) | closed | closed | closed | – | C | the wall and its towers. The PF rooms were storage and were later bricked up (B); in 467 they are not an office (D-104) |
| `palace_h`, `unfinished_gate` (absent in 467) | – | – | – | – | B (chronology) | not built in 467. The unfinished-gate site is part of the Hall 100 forecourt (`terrace_courts`) |

### 2.4 Guard posts (people_places ids; kinds: **check** = stop and ask, **watch** = look and stop only if the zone behind is closed to the visitor, **bar** = stand in the way of a closed zone)
| post | at (people_places) | kind | note |
|---|---|---|---|
| post_stair_n, post_stair_s | (−39.3, 134.3), (−39.3, 110.7) | watch by day, bar at night | heads of the upper flights. The sim's CHECK_POSTS includes them. Proposed: they watch and the Gate checks, so the visitor is stopped once, not three times (C) |
| post_gate_w1, post_gate_w2 | (−18.8, 120.4), (−18.8, 128.8) | check | **the check**: "halmi?", the bulla, the business, then wait on the bench for an escort |
| post_gate_s1, post_gate_s2 | (−3.4, 103.4), (3.6, 103.4) | check | inner door to the courts: only escorted visitors pass |
| post_apa_w, post_apa_e | (−42.0, 60.5), (45.8, 60.5) | bar | the Apadana N stair |
| post_treas_1, post_treas_2 (+ post_treas_3, post_treas_4 while E-81 runs) | (204.4, −76.4), (208.8, −76.4), (202.2, −76.4), (211.0, −76.4) | check | the letter is handed over here. A courier's letter reaching the Treasury doubles the door (E-81, D-023) |
| post_tachara_1/2, post_hadish_1/2, post_harem_1/2 | (−25.0, −100.4), (−17.6, −100.4); (5.0, −120.0), (5.0, −126.0); (107.3, −77.0), (111.7, −77.0) | bar | palaces closed |
| *proposed, unplaced:* garrison W door | (183.27, 32.0) (site_spec garrison.r_doors) | bar | no guard is placed there today |
| *proposed, unplaced:* garrison S door | (201.8, −66.3) (site_spec garrison.r_doors) | bar | opens on the Treasury street |
| *proposed, unplaced:* Treasury E door | (217.5, −134.5) (site_spec treasury.doors E) | bar | the mountain-side door |
| *proposed, unplaced:* Harem N passage | (109.5, −73.0) (site_spec harem.r_entrances) | bar | off the Treasury street |
| *proposed, unplaced:* Tripylon narrow E stair foot | (101.0, −58.0) (site_spec tripylon.stair_e_narrow) | bar | off the Treasury street |
| *proposed:* Gate E door | (ref: site_spec gate_nations.doors "E"; no coordinate in the data) | bar (court absent) / check (court resident) | the avenue E to the Hall 100 forecourt. C |

### 2.5 With the court resident (setting "seasonal pattern", C)
The guards are at full ceremonial strength (brief §9.1), and the royal guard stands at the palaces (XEN-CYR 7.5.68, B).
The Apadana and the palaces are **closed except by summons**, and the summons goes through a doorkeeper and messenger
(HDT 3.118, 3.140, B). The Gate stays the check. The errand is unchanged: the Treasury is not the king's audience.

## 3. The town and the plain
| zone id (source) | rule | who checks | tier | basis |
|---|---|---|---|---|
| roads: `road_royal_west`, `road_pasargadae`, `road_naqsh_e_rustam`, `road_south_tirazzish`, `road_spur_ajori` (settlement.json) | open | – | C (B that roads were watched: HDT, way-wardens) | the visitor on foot; road guards away from the plain are not modelled |
| `town_lanes` (settlement.json town_elements; the quarters of town_plots) | open, day and night | – | C | no curfew is attested; nothing to invent |
| `town_houses` | closed (unless invited; invitation not modelled) | the household | C | private courtyard houses (BAKER2014 analogue) |
| `town_workshops` | business (the visitor may watch from the door) | the craftsmen | C | treasury and private workshops |
| `town_yards`, `town_pens` | closed | – | C | private |
| `town_wells` | open | – | C | wells in squares |
| `town_stores` = `stores-0001` (door (−234.2, −537.8)) | business | the storekeeper (supplier, *kurmin*/*ullira*) and his watchman | C place / B practice | rations against the halmi (§1.4) |
| `town_stables` = `stables-0001` (door (−1459.1, 374.4)) | business | the grooms | C | proposed here as the post station and the visitor's lodging (D-104) |
| `official_court` = `official-0001` in `north_official_complex` (door (−51.5, 599.5)) | business | a doorkeeper | C (B existence of an official building, GONDET2018) | where the return halmi is issued (D-104) |
| `area_b_yard` in `pw_area_b_craft` | business | the craftsmen | C | a state craft yard (kiln, pigments) |
| `pw_area_a`, `zone_persepolis_west`, `zone_lower_town_south` (outside plots) | open | – | C | the town's open ground |
| `area_c_ditch_garden` (`pw_area_c_garden`), `town_gardens_orchards` (orchard_1–8) | closed | a gardener | C | walled gardens |
| `paradise_bagh_e_firuzi` with `tol_ajori_gate` ((−2381, 2290)); `estates_bagh_e_firuzi` (estate_1–4) | closed | the gate-keeper or household | C | walled royal or elite gardens and estates (gardens *partetaš* with their workers: SETTLEMENT §4, B) |
| `zone_bagh_e_firuzi`, `zone_dasht_e_gohar` (outside the walls) | open | – | C | |
| `garden_dasht_e_gohar`, `hall_dasht_e_gohar` | closed | – | C | walled garden; columned hall |
| `takht_e_rustam`, `canal_kuh_e_rahmat` | open | – | C | |
| `waystation_kur_west` = `waystation-0001` (door (−10996.1, 494.5)) | business | the station keeper | C place / B practice | halmi → rations and lodging |
| plain villages and fields (plain.json) | open | – | C | |
| Naqsh-e Rustam: `nr_darius_tomb`, `nr_xerxes_tomb`, `nr_kaba` (plain.json) | open to the cliff foot; the tomb chambers and the Ka'ba door closed | – | C | Magi guarded Cyrus' tomb with a small house by the way up and rations from the king (ALEX-HIST: Arrian 6.29, B claim for Pasargadae). Whether the Naqsh-e Rustam tombs had guardians in 467 is unknown, so none is placed |

## 4. What a guard does when he stops someone
| step | attested or claimed (B at best) | the build (C) |
|---|---|---|
| a guard is always there | "a guard before the gates, for one is always posted there" (XEN-CYR 7.5.25); "guards are stationed all around" (HDT 3.72.1) | the paired posts of §2.4, manned by the rota (D-023) |
| men of standing pass | "out of respect … allowed them to pass … no one asked any questions" (HDT 3.77.1) | the visitor is not of that standing, so he is stopped. A known Terrace official is not (sim) |
| the question | the court messengers "asked the seven why they had come" (HDT 3.77.2); "Who commanded you …? We asked their names also" (Ezra 5:9–10) | one guard steps half a pace into the way, raises an open hand and asks **"halmi?"** (line `el.ask_document.halmi`). The spear stays upright, butt to the ground, as the relief guards stand (B stance); it is **never levelled** |
| the document | a royal letter is given to a scribe to read (HDT 3.128.3); the bulla carries "a seal image that suppliers and other officials … had learned to recognise" (HALMI-SX) | the guard looks at the bulla and does not read the leather. The letter's bulla and its address, given by gesture and "ʾgrh … gdbr" (letter … treasurer), are the business |
| word goes in; the stranger waits | "sat in the king's antechamber … the doorkeeper brought word … [and] brought Syloson in" (HDT 3.140.1–3) | at the Gate: the visitor sits on the bench in the Gate hall while one guard fetches an escort (the patrol pair or an off-watch man, D-023). At the Treasury: the letter is carried in and the visitor waits in the street |
| refusal | "the gatekeeper and the messenger forbade him" (HDT 3.118.2) | a flat hand and a gesture back toward the stair or out of the street. **No** words beyond the lexicon; no threat |
| if he walks on | – | the two men of the post close the way with their bodies. The patrol pair comes, and they walk him to the edge of the zone (the stair head, or the Gate for the courts). **No blows, no weapons, no arrest, no punishment shown** (brief §9.1 no combat; §12 not sensational) |
| memory | the guards at Susa knew the leading Persians by sight (HDT 3.77.1) | an encounter of kind `stopped` is logged (lives.json familiarity 0.5; half-life 6 days), and the next meeting follows §6 |

Not used (sensational or off-period): Intaphernes cutting off the gatekeepers' ears and noses (HDT 3.118); Esther's death
penalty for entering the inner court uncalled (Esther 4:11, late literary); Diodorus' triple wall.

## 5. The errand: a sealed letter for the treasurer at Pārsa
### 5.1 Why this errand
- **The Treasury archive is the one archive that is live in 467.** Its dated texts peak in Xerxes years 19–20
  (IR-TREAS, SX, B).
- **Its "letters" are orders from officials, addressed to the treasurer,** to pay silver for work. An example: "To Shaka
  the treasurer, Budkama declares that Herdkama, the Egyptian, was the chief of a team of one hundred laborers, and is
  entitled to three karšâ and two-and-a-half shekels of silver as his wage" (PT-WAGE, IR-PET; SX, B).
- **The tablets were kept in a NE room of the Treasury** (IR-TREAS, SX, B).
- **Messengers who carry an official's order** are attested: "(He is) a messenger of Irtuppiya" (PF 45, FT, A
  Darius-era).
- **Halmis for journeys that start from Pārsa** are issued by the Pārsa administration (HUNARA2024, SX, B).
- **Travel rations are drawn against the sealed document** (B).

Every link is B, and the chain is C.

The Fortification archive (PF) is **not** a destination. It is Darius-era (509–493) and stored in the NE bastion,
whose entrance was bricked up at an unknown date (PFA-ISAC, SX). In 467 it is a dead store (C). The receipts from the
road stations still went "to Persepolis for accounting" in Darius' time (B), and the office that received them in 467
is unknown (Q-126).

### 5.2 Steps (access.json `errand.steps`)
| # | place (id; at) | what happens | who (PEOPLE.md roles) | wait | tier |
|---|---|---|---|---|---|
| 0 (optional prologue) | `waystation-0001` (door (−10996.1, 494.5)) | show the halmi; draw the day's ration; the keeper's scribe writes a receipt that the keeper and the visitor seal | station keeper (supplier), scribe | 0.5–1 h | B practice / C place |
| 1 | `stores-0001` (door (−234.2, −537.8)) | on arrival in the town: show the halmi and draw the day's ration (1.5 qa flour, 1 qa wine or beer); a receipt is sealed | storekeeper (*kurmin* / *ullira*), a scribe | 0.3–1 h, queue included | B / C |
| 2 | `stair_foot` (−52, 118.5) → `grand_stair` | the climb: open. The stair-head guards watch | guards (watch) | – | C |
| 3 | `post_gate_w1` / `post_gate_w2` | **the stop**: "halmi?"; the bulla; the letter's bulla and "ʾgrh … gdbr"; a guard goes for an escort | gate guards | on the bench in `gate_hall` 0.2–0.7 h | C |
| 4 | escorted: `gate_hall` → `post_gate_s1/s2` → `forecourt` → (nav-grid route) → `treasury_street` | walk with the escort. Doors of closed zones are passed, not entered | one guard | – | C |
| 5 | `post_treas_1–4` | hand over the letter. A Treasury man takes it to the scribes' room (`treasury_desk`). The visitor waits in the street until word comes back: tomorrow. The escort walks him back to the Gate and he leaves the Terrace | door guards; a Treasury staff member; a scribe | 0.5–1.5 h in the street | C |
| 6 | `stables-0001` (door (−1459.1, 374.4)): lodging, D-104; `stores-0001`: the waiting day's keep | the night in town. His keep while he waits on business: a question, since Aršāma's rule gives no rations for extra days (Q-128); in the build the storekeeper issues it against the halmi (C) | groom; storekeeper | overnight | C |
| 7 | `post_gate_w1/w2` → `treasury_street` → `post_treas_1–4` | next morning. **Recognised** at the Gate (§6): a nod, and he goes on alone to the Treasury street (or escorted if not recognised). He receives the Treasury's sealed answer to the sender (a clay tablet sealed on its left edge, the PT form, B; or leather with a bulla) | gate guards; door guards; a scribe | 0.3–1 h at the door | C |
| 8 | `official-0001` (door (−51.5, 599.5)) | ask for a halmi for the return journey. Journeys that start from Pārsa carry a halmi of the Pārsa administration (B pattern). Show the Susa halmi and the Treasury's answer; the doorkeeper takes them in; wait | doorkeeper; a scribe; the official (the office of Parnakka's successor; unnamed in 467) | same day if before midday, otherwise next morning | C |
| 9 | `stores-0001` | draw the first day's ration for the road | storekeeper | 0.3–1 h | B / C |
| 10 | `road_royal_west` → the town edge (`terrace_edge` in town.json, or waystation-0001) | leave. The errand closes | – | – | C |

**Timing (C):**
- **Handed in before midday:** the answer comes the next morning, from sunrise + 1 h. **Handed in after midday:** it
  comes the morning after next.
- **If silver is being weighed out at the Treasury that day** (E-05 is running), add one day.
- **Terrace hours for the visitor:** sunrise + 0.5 h to sunset − 0.5 h. This matches the work day in lives.json.
- **Nothing here is evidence.** The rules are there only so the waiting is visible and the next day is different.

### 5.3 Words (only lexicon ids; tiers from research/LEXICON)
| use | available now (lexicon id, tier) | missing (evidence found this pass) |
|---|---|---|
| the guard's question | `el:halmi` (lexicon C; **attested A** in PF 15, FT; line `el.ask_document.halmi` exists) | – |
| greeting | `arc:šlm` (B), `arc:mrʾ` (B); line `arc.greet.slm_mra` exists | the suffixed form mrʾy "my lord" (Q-024) |
| naming the business | `arc:ʾgrh` "letter" (B), `arc:gdbr` "treasurer" (B), `arc:gnz` "treasury" (B), `arc:ḥtm` "to seal" (B), `arc:ʿzqh` "signet ring" (B), `arc:spr` "scribe" (B), `arc:ktb` "to write" (B) | Elam. *kapnuškira* "treasurer" (IR-TREAS, SX, B); Elam. *hutlak* "messenger" (**A**, PF 45, CDLI-PF FT) |
| the king or satrap as issuer | `el:sunki` (B), `op:xšāyaθiya` (A), `arc:mlk` (B), `arc:ʾḥšdrpn` "satrap" (B) | Elam. *sunkina* "of the king" (the genitive in *-na* is attested with a personal name in PF 15, *Irtuppiya-na*, but the lexicon lacks the form); *miyatukkaš* (SX, B) |
| rations | `el:QA` (B), `el:marriš` (B), `arc:lḥm` "bread" (B), `arc:ḥmr` "wine" (B), `arc:ḥd`/`arc:trn`/`arc:tlt` (B), `arc:ywm` "day" (B); `el:ullira` "supplier" (B); `el:dušda` "(he) received" (lexicon C; **attested A**, 26 PF texts, FT) | Elam. *kurmin* "supplied by / allocation" (**A**, 47 PF texts, FT); Aram. *ptp* "ration" (AZZONI2019, SX, B); Elam. *gal* "ration" (NS) |
| place names | `el:Parsa` (B), `op:Pārsa` (A), `op:duvarθi-` "gateway" (A), `el:missadahuiš` (A) | Susa (Elam. Šušan, NS) |
| come, go, wait, tomorrow, yes, no, stop | **none in any lexicon** (Q-022, Q-023, Q-024) | gesture only |
| the written document (OP) | `op:dipi-` "inscription, written document" (B) | an OP everyday use is not attested |

Candidate lines, all composed and all C:
- guard: `el:halmi` (rising; exists);
- visitor: `arc:ʾgrh` + `arc:gdbr` ("letter … treasurer"), said while showing the bulla;
- scribe: `arc:ywm` + `arc:ḥd` ("one day"), with a gesture to come back.

Word order in composed Aramaic sequences is not attested (C). No Elamite sentence is composed, because only single
words are safe.

### 5.4 Where the two archives fit
- **Treasury archive (PT),** `treasury_desk` at (192, −84): the scribes' room where the letter is read and recorded.
  The PT tablets were found in a NE room of the Treasury (B). In the build, the desk is C. A record kept with the
  treasure has a biblical parallel: "search was made in the house of the rolls, where the treasures were laid up"
  (Ezra 6:1, KJV-BIBLE, FT; B/C).
- **Fortification archive (PF),** `pf_archive_findspot`: closed; not a place of business in 467 (C, D-104).
- **The office that issues halmis and receives station receipts in 467:** unknown. `official-0001` is the working value
  (C, Q-126).

## 6. Memory and recognition (lives.json `familiarity`: stopped 0.5, recognise ≥ 0.25, half-life 6 days)
| case | the guard's behaviour | tier |
|---|---|---|
| familiarity ≥ recognise, and the last stop at this post ended **admitted**, and the same errand is still open | a nod; no question. For `terrace_courts` the rule relaxes from escort to business, so the visitor may walk to the place of business alone | C (B: HDT 3.77.1, known men pass unquestioned) |
| familiarity ≥ recognise, and the last stop ended **turned back** | he steps into the way at once, without the question, and gestures back | C |
| familiarity ≥ nod but below recognise | the full check, with a glance of recognition | C |
| the errand is closed | the full check again: the old business no longer counts | C |

A guard who stopped the visitor yesterday recognises him today: 0.5 × 2^(−1/6) ≈ 0.45 ≥ 0.25. After about six days
without meeting, the recognition fades.

## 7. Open questions and decisions
- **Open questions:** Q-120 to Q-129 (research/OPEN_QUESTIONS.md). They cover:
  - the issuer of halmis in 467;
  - checks at Persepolis;
  - the halmi's form;
  - the Terrace posts;
  - the Treasury entrance and the scribes' room;
  - processing time;
  - the office of the Pārsa administration;
  - the lexicon upgrades;
  - rations for extra days;
  - the Gate versus the stair heads, and night closure.
- **Decisions:** D-100 to D-104 (DECISIONS.md). They cover:
  - the access rules;
  - the visitor's documents;
  - the errand;
  - the stop and memory;
  - the town places of the errand.
