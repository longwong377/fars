# PHASE4_ACCESS — stairs, doorways and floor levels for the rest of the Terrace (research pass, 2026-09-23)

Proposed data: `research/_phase4_spec_patch.json`. It is **not applied**. It has one row per value, in the `{v,u,src,tier,note}` format of `src/data/site_spec.json`, and new source keys under `_sources_new` (not added to `sources.json`).
Frame: grid x = east, y = north, metres, origin at the Apadana centroid, grid north = 341° true. Heights are metres above the Apadana court (datum 0).

## 0. What is weak or placeholder (read first)

- **No primary source was read.** Schmidt 1953 (OIP 68), Iranica, ISAC, Livius, Wikipedia, Smithsonian and DPLA are all blocked by the egress proxy (BLOCKERS B6). Every textual fact below comes from a **search-engine extract** (capped at B), and several extracts are tertiary (C).
- **Stair geometry is reconstructed (tier C) everywhere.** The two supplied plans (~2 px/m) give each stair's **zone** (where it is, which side, its extent along the façade), which is plan-derived B. They do not show step counts, flight directions or depths. The risers, treads, flight widths and lane splits in the patch are C, and they are chosen so the flights fit the measured zones.
- **Floor levels:** only the Tachara (+2.6) and Tripylon (+2.6) are B. Hadish +6.0 is C (Q-018). Hall of 100 Columns, Harem and Treasury are C with no usable source. **Every court level except the Apadana court is an assumption (0, C).**
- **Door heights:** none found. All door heights are C.
- **Unfinished Gate:** absent in 467 (`chronology.json` present=false). Nothing to model.

## 1. Method and measurement uncertainty

1. **Colour plan** (`references/Persepolis Plan.webp`, key REF-PLAN). I reused the similarity transform fitted by `tools/plan_check.py`, recomputed in scratch without modifying the tool: grid = s·R·[px, −py] + t, with s = 0.47284 m/px, R = rot(−18.51°) and t = (−37.664, 300.563). The fitted scale is within 0.7% of the plan's own scale bar.
   Positions were read on grid-warped crops, from wall-gap intensity profiles along wall centrelines and from character maps of the plan colours.
   - **Readout:** ±0.5–1 m (1 px = 0.47 m).
   - **Registration, checked locally against OSM outlines and extracts:**
     - Tachara: outline within ~1 m.
     - Hall of 100 Columns: N and S door pairs centred at x 146.2 / 147.1 vs the OSM centre 146.4; W and E pairs 1.4–2.3 m further south than the OSM centre.
     - Tripylon: plan hall interior 15.3 × 16.3 m vs 15.46 m (Iranica extract).
     - Hadish: outline within 1–4 m.
   - **Stated uncertainty:** ±1.5–2 m for Tachara, Hadish, Tripylon and Hall of 100 Columns positions; ±3–4 m for the Harem and Treasury (the Harem was an outlier in the global fit). Scale error < 1%.
2. **Schmidt-style plan** (`references/palace-of-darius-i-and-xerxes.webp`, key REF-SCHMIDT). It is drawn in the grid orientation: plan-right = grid north, plan-down = grid east, the buildings are axis-aligned, and the scale bar is 185 px per 100 m.
   - A chamfer fit failed. I used a 2-anchor affine instead, on the Gate columns and the Hall 100 column grid: x = 0.5348·py − 66.2, y = 0.5569·px − 262.6.
   - The two axes differ by 4% in scale (1.87 vs 1.80 px/m), and the Tachara check is off by 6 m in x. So this plan is used **only** for topology, for offsets within a building, and as a cross-check.
   - Its agreements with REF-PLAN: Hadish portico y −137 vs −136.5…−140.5; Hadish N courtyard y −110…−132 vs −109…−134; Hall 100 doors ±12.0–12.2 m vs ±12.65 m; Treasury N wall −77 vs −79.5.
3. **Text:** WebSearch extracts only. Smithsonian archive photo titles (SI-ARCH) are excavation-era captions and the best evidence available here; they are still B.

## 2. Floor levels (datum = Apadana court)

| building / court | level (m) | src | tier | note |
|---|---|---|---|---|
| Tachara floor | 2.6 | IR-PERS | B | 2.20–3.00 |
| Tachara S court | 0.0 | RECON | C | the S stair descends to it (B) |
| Hadish floor | 6.0 | DERIVED | C | "18 m above the plain" − 12. The stair zones (§4) fit a 4-flight stair only at ≤ 6 m with 0.26 m treads, which fits the DSM's 3.5–5.5 better (Q-018, Q-P4-05) |
| Hadish N courtyard (on the platform) | = Hadish floor | REF-PLAN/REF-SCHMIDT | B (layout) | open area x −3…40, y −109…−134 |
| Hadish W and E courtyards | 0.0 | RECON | C | "ascended the Hadiš from the western and eastern courtyards" (B) |
| Tripylon floor | 2.6 | IR-PERS | B | |
| Hall of 100 Columns floor | 0.5 (current) / 1.0 alternative | RECON / SG-H100 | C | "two metres below the Apadana platform" (weak tertiary) |
| Harem main wing | 1.0 | RECON | C | lower than the Hadish (B) |
| Treasury | 0.3 | RECON | C | |

## 3. Tachara (Palace of Darius), standing

| item | position (grid m) | size | layout / decoration | src | tier |
|---|---|---|---|---|---|
| **S stairway: zone** | along the S front x −36.5…−5.5 (±1.5); outer face y ≈ −101.0; building front y ≈ −99.2 | ~31 m long, ~2.3 m deep | lies **inside** the OSM polygon (OSM S edge −100.4…−100.9 is the stair's outer edge) | REF-PLAN | B |
| S stair: existence in 467 | — | — | central façade carries Xerxes' XPc → standing | SI-ARCH, ISAC-PA | B |
| S stair: flights | W foot (−36.0, −100.1) z 0 → head (−28.2, −100.1) z 2.6; E foot (−6.0, −100.1) → head (−13.8, −100.1); central landing x −28.2…−13.8, y −101.5…−99.2 at +2.6, opening N to the portico | 26 risers × 0.10, tread 0.30, clear width 1.5 | two flights rising toward the centre (the ISAC caption says "Western flight of the Southern stairway"). An extract calls it "double reversed" (Q-P4-02) | RECON | C |
| S stair: reliefs | — | — | central façade: Persian guards flanking XPc, lion-and-bull combat in the corner angles. Parapets: servants climbing with kids, wineskins and covered dishes, in alternating Persian and Median dress | SI-ARCH, ISAC-PA, WP-EXT | B |
| W (NW) stairway + W doorway | x ≈ −38, y −68…−82 on the plan | — | built by Artaxerxes III (A3Pa): **absent in 467, do not build** | WP-EXT, ISAC-PA | B |
| Main S doorway (portico → hall) | on the axis x −21.3, hall S wall (≈ y −88) | 2.4 × 5.5 (existing r_doors) | king with attendants; monolithic dark-stone frame | WP-EXT, RECON | existence B, position/size C |
| N doorways (hall → 2 N rooms) | x −21.3 ± 6, y ≈ −72 | 1.8 × 4.5 | lance-bearers (W rooms), servants with towel and perfume flask, royal hero vs lion/monster: which jamb is C | ISAC-PA, WP-EXT | C |

## 4. Hadish (Palace of Xerxes), standing

Key reading: in both plans the Hadish platform has a **N courtyard** (x −3…40, y −109…−134) in front of the 12-column portico (rows at y −136.5 and −140.5, x 12…32). The W and E stairs flank that courtyard. Iranica, via an extract: "Two double reversed staircases bearing sculptures similar to that of the Tačara ascended the Hadiš from the western and eastern courtyards, while two unadorned staircases on either side of the balcony (the eastern one was restored in 1978) led down to the Harem."

| item | position (grid m) | size | layout / decoration | src | tier |
|---|---|---|---|---|---|
| **W stair: zone** | x −5.8…2.5, y −131…−115 (centre y −123), ±2 | 8.3 × 16 m | recessed inside the OSM W edge; faces the W (Tachara S) court | REF-PLAN | B |
| **E stair: zone** | x 50.0…59.5, y −128.5…−112.5 (centre y −120.5), ±2 | 9.5 × 16 m | hatched projection E of the NE 4-column room; ~8 m **beyond** the OSM E edge (51.3) | REF-PLAN | B |
| W/E stair: type | — | — | double-reversed, meaning lower flights in the outer lane rise outward from the centre to end landings, then upper flights in the inner lane return to a central top landing. W stair has a "central façade"; the E stair has N and S "wings" | FARROKH, SI-ARCH | B (type), C (lanes) |
| W/E stair: flights | see the patch (`stair_w_flights`, `stair_e_flights`): 4 flights × 25 risers of 0.12, tread 0.26, lanes 4.0 m and 4.3–5.5 m, end landings 1.5 m at +3.0, top exit onto the N courtyard at +6.0 | — | a 6 m rise only just fits the 16 m zone. If the rise is ~5 m, use 21 × 0.12 with tread 0.30 | RECON | C |
| W stair: reliefs | — | — | central façade: Persian guards flanking Xerxes' XPd. Flights: servants with ibex/kids and food vessels | SI-ARCH, FARROKH | B |
| E stair: reliefs | — | — | outer faces of the wings: Persian guards ("South Facade of South Wing"). Flights as on the W stair | SI-ARCH | B (wings), C (flights) |
| Balcony stairs (2, unadorned) | SW near (−5, −176), SE near (49, −176) | — | descend S to the Harem W wing; geometry and lower level not known | FARROKH | existence B, geometry C (NOT SEEN, verify) |
| Hall | interior x 8.5…35.5, y −173…−146, centre (22, −159.5) | ~27 m square (Schmidt ~25); column pitch 3.8–4.0 | **conflicts with r_interaxial 5.4 → 38 m** (Q-P4-06) | REF-PLAN, REF-SCHMIDT | B |
| Doorways | N pair x 22 ± 6 at y −146; S (to balcony) (22, −173); E (35.5, −159.5); W (8.5, −159.5) | 2.6 × 6.0 (existing) | count and walls are B: 1 S, 2 N, 2 to the apartments. NW doorway: king with parasol- and towel-bearers, labelled "Darius the king". E doorway: XPe above king and attendants. W doorway: XPe | FARROKH, SI-ARCH | count B, positions/sizes C |

## 5. Tripylon (Council Hall), under construction in 467

| item | position (grid m) | size | layout / decoration | src | tier |
|---|---|---|---|---|---|
| Hall | interior x 74.2…89.5, y −80.8…−64.5, centre (81.9, −72.7) | 15.46 m square | **replaces r_hall 12.0 (C)**; 4 columns at ~5 m pitch | IR-PERS, REF-PLAN | B |
| **N stair: zone** | x 67…97, y −55…−47, ±1.5 | 30 × 8 m | N of the 2-column N portico (y −56.5). The OSM modern shelter a1bf0b covers x 65…103, y −61…−43 | REF-PLAN, OSM | B |
| N stair: type | — | — | "two corresponding flights" rising to a "projecting central landing", then a terrace to the portico | IR-PERS (extract) | B |
| N stair: flights | W foot (67.5, −49.5) → head (75.3, −49.5); E foot (96.5, −49.5) → head (88.7, −49.5); central landing x 75.3…88.7, y −51…−47 at +2.6; upper terrace y −55…−51 | 26 × 0.10, tread 0.30, width 2.4 | flights rise toward the centre | RECON | C |
| N stair: reliefs | — | — | central panel: winged disc between two seated sphinxes (and palms); below, guards in two groups flanking a blank field. Flight façades: Persian and Median nobles ascending. Corner lion-and-bull scenes: NOT SEEN, verify | IR-PERS, SI-ARCH, COMMONS-TRIP | B (corners C) |
| S stair (small) | near (82, −102.5), descending S toward the area E of the Hadish | NOT SEEN, verify | "a small courtyard of the Tripylon was connected by a small stairway to the area east of the Hadish". The Tehran museum stair is described as "the main staircase from the southern side" (Q-P4-07) | IR-PERS, COMMONS-TRIP | existence B, position C |
| Narrow E stair | x 99.5…102.5, from foot (101, −58) up to head (101, −71) | 20 × 0.105, tread 0.35 | "E entrance through a corridor … linked by a narrow staircase to the Harem and to the Hundred Column Hall". The plan shows hatching in the 5 m passage between the Tripylon and Hall 100 | IR-PERS, REF-PLAN | zone B, levels C |
| N doorway | (82.0, −63.3) | w 2.8 ± 0.7 | king with attendants (which jamb is C) | REF-PLAN | B |
| E doorway | (89.5, −72.2) | w 2.7 ± 0.7 | king (Darius I) and crown prince (Xerxes), throne carried by representatives of the nations | REF-PLAN, SI-ARCH | B |
| S doorway | (82.0, −81.8) | w 2.8 ± 0.7 | king and attendants → S portico (columns at y −89.5) → small courtyard (y −102…−90) | REF-PLAN, SI-ARCH | B |
| W doorway | none | — | three doors only (N, E, S) | REF-PLAN | B |

## 6. Hall of 100 Columns (Throne Hall), under construction in 467

| item | position (grid m) | size | decoration | src | tier |
|---|---|---|---|---|---|
| Stairs | **none attested**; no hatching around the hall in either plan | — | — | REF-PLAN, REF-SCHMIDT | B |
| Portico step band (for walkability) | x 117…176 at the portico front, y ≈ 27 | 3 steps, riser = floor/3 | — | RECON | C (NOT SEEN, verify) |
| N doors (2) | (133.9, 6.0), (158.9, 6.0) | w 3.3 ± 0.7 | throne/audience scene. "5 registers of guards" is NOT SEEN, verify | REF-PLAN, REF-SCHMIDT, BRIT-H100 | B |
| S doors (2) | (133.9, −64.0), (158.9, −64.0) | w 3.3 | king enthroned, throne borne by the subject nations | same | B |
| W doors (2) | (111.0, −16.5), (111.0, −41.5) | w 2.5 | royal hero vs monsters | same | B |
| E doors (2) | (182.0, −16.5), (182.0, −41.5) | w 2.5 | royal hero vs monsters | same | B |
| Door height | 8.5 | — | NOT SEEN, verify (~0.6 × column height) | RECON | C |

Door pairs sit at **±12.5 m** from the hall centre: REF-PLAN ±12.65, REF-SCHMIDT ±12.0–12.2. That is on the aisle between the 2nd and 3rd columns from the centre. They are placed about the OSM centre (146.4, −29.0); REF-PLAN's own W and E pairs sit 1.4–2.3 m further south.

## 7. Harem of Xerxes, main wing (standing)

| item | position (grid m) | size | decoration | src | tier |
|---|---|---|---|---|---|
| **Main wing extent** | x 98…134, y −207…−73 (±3) | — | the plans put the wing's N courtyard and N rooms **north of** the museum_modern footprint (y −126.5…−210) that the model uses now | REF-PLAN, REF-SCHMIDT | B |
| N courtyard | x 101…127, y −125…−112 | — | "portico facing a spacious courtyard on the north" | ISAC-PA, REF-PLAN | B |
| Portico (2 × 4) | front y −125, between antae x 105…121.5 | — | — | IR-PERS, REF-PLAN | B |
| Portico step band | same front | 3 steps | — | RECON | C |
| Hall (3 × 4) | interior x 106.5…123, y −150.5…−134.5 | ~16.5 m square | — | REF-PLAN | B |
| N door | (114.8, −134.5) | w 2.4 | NOT SEEN, verify | REF-PLAN | C |
| S door | (113.0, −150.5) | w 2.0 | Xerxes entering with fly-whisk and parasol bearers | ISAC-PA | reliefs B, position C |
| E door | (123.0, −142.5) | w 2.0 | royal hero stabbing a lion-headed monster / rampant griffin | ISAC-PA, SI-ARCH | same |
| W door | (106.5, −142.5) | w 2.0 | royal hero fighting a lion | ISAC-PA | same |
| Entrances to the court | N gap at (109.5, −73) off the narrow-stair passage; W corridor opening at (99.7, −114) | — | — | REF-PLAN | C |

## 8. Treasury (standing)

| item | value | src | tier | note |
|---|---|---|---|---|
| **N outer wall** | y ≈ −78 (REF-PLAN −79.5, REF-SCHMIDT −77) | REF-PLAN, REF-SCHMIDT | B | **The OSM N edge (−66.1) includes a ~12 m street** between the Hall 100 S wall and the Treasury. The perimeter wall is currently modelled ~12 m too far north |
| Other edges | W 140.5, E 217.5, S −212.5 (OSM 140.1 / 220.4 / −215.4) | REF-PLAN | B | |
| Entrance history | phase 1: W entrance with guardrooms; phase 2: N entrance added; Xerxes: W part demolished for the Harem | IRANTOUR-TREAS | C | tertiary; verify against Schmidt 1939 |
| N door | (206.6, −78.0), w 2.4 | REF-PLAN, RECON | C | 2 m gap in a buttressed wall; weak |
| E door | (217.5, −134.5), w 2.0 | REF-PLAN | C | weak |

The existing r_doors point [201.8, −66.3] lies on the OSM edge, which is in the street.

## 9. Unfinished Gate

Absent in 467: late Achaemenid, probably Artaxerxes III (`chronology.json` present=false; CHRON-C, LIVIUS, IR-PERS; B). It has no stairs or doors. Its site is part of the Hall 100 forecourt in 467.

## 10. Proposed minimum access graph for Phase 4 (C)

- court 0 → Tachara S court: C. The route runs past the Tachara SE corner, x −6…−3, y −100…−108; NOT SEEN, verify.
- Tachara S court → Tachara (S stair) and → Hadish (W stair).
- Hadish E court → Hadish (E stair).
- Tripylon S courtyard → small S stair → Hadish E court.
- Court 0 → Tripylon (N stair).
- Tripylon E door → narrow stair → passage N (to Hall 100 W side) and S (Harem N gap).
- Hall 100 forecourt → portico step band → N doors.
- Hall 100–Treasury street → Treasury N door.
- Hadish → balcony stairs → Harem W wing.

## Proposed OPEN_QUESTIONS additions

| id | Question | Evidence | Working value | Tier | Unblock |
|---|---|---|---|---|---|
| Q-P4-01 | All Phase-4 stair geometry (risers, treads, flight direction, widths) | only plan zones at ~2 px/m + search extracts | C geometry inside plan-measured zones (`_phase4_spec_patch.json`) | C | Schmidt 1953 figs./plates (Tachara, Hadish, Tripylon stairs) |
| Q-P4-02 | Tachara S stair: 2 flights ("Western flight of the Southern stairway", ISAC) or "double reversed" (4 flights, FARROKH/WP)? | captions vs tertiary text | 2 flights rising toward the centre | C | Schmidt 1953; photos |
| Q-P4-03 | ISAC: "three small stairways descended" from the Tachara: which is the third (besides S, and A3's W)? | ISAC extract | not modelled | C | ISAC Palace of Darius page; Schmidt |
| Q-P4-04 | Court levels: Tachara S court, Hadish W/E courts, Palace G court, Tripylon S court, Harem court | none found | 0 (datum) | C | Schmidt sections/levels |
| Q-P4-05 | Hadish floor +6.0 vs stair zones: a 4-flight stair in a 16 m zone needs treads ≤ 0.26 m at 6 m rise; ~5 m fits normal treads (and the DSM 3.5–5.5) | REF-PLAN zones; IR-PERS "18 m above the plain"; COP-DEM | 6.0, riser 0.12, tread 0.26 | C | Schmidt levels (extends Q-018) |
| Q-P4-06 | Hadish hall size: plans give ~25–27 m square (pitch 3.8–4.0 m); spec r_interaxial 5.4 → 38 m | REF-PLAN, REF-SCHMIDT vs RECON | propose 3.9 m pitch (B, plan) | B/C | Schmidt 1953 |
| Q-P4-07 | Which Tripylon stair is in the National Museum, Tehran: the "main staircase from the southern side" (COMMONS-TRIP) or the N stair (Iranica: nobles on the northern stairs)? Is there a sculptured S stair at all? | tertiary extracts disagree | N stair sculptured, S stair small and plain | C | Schmidt; National Museum catalogue |
| Q-P4-08 | Tripylon N stair central panel: 4 guards per group flanking a blank field, or 9 "Persian" soldiers per row flanking an OP inscription of Xerxes? | two extracts | 4 per group, blank field | C | Schmidt 1953 |
| Q-P4-09 | Hall of 100 Columns floor: 0.5 (C) or ~1.0 ("2 m below the Apadana platform", weak)? Steps at the portico? | SG-H100 | 0.5 + 3-step band | C | Schmidt |
| Q-P4-10 | Harem main wing: extent N of the museum footprint; court/portico/hall y positions differ ~8 m between REF-PLAN and REF-SCHMIDT | plan measurements | REF-PLAN values (portico front y −125) | B/C | Schmidt plan; orthophoto of the rebuilt portico |
| Q-P4-11 | Treasury N wall at y ≈ −78 (both plans) vs OSM −66.1 (includes the street) | REF-PLAN, REF-SCHMIDT, OSM | −78 | B | orthophoto |
| Q-P4-12 | Treasury entrance(s) in 467: W (phase 1), N (phase 2), NE via the garrison (current r_doors, C)? | IRANTOUR-TREAS (tertiary) | N door at x ≈ 206.6 | C | Schmidt 1939 / 1953 |
| Q-P4-13 | Hadish E stair projects ~8 m beyond the OSM E edge while the W stair is recessed inside the W edge: real asymmetry or a drawing artefact? | REF-PLAN | as measured | C | Schmidt plan |

## Sources used (new keys in `_sources_new` of the patch)

REF-PLAN, REF-SCHMIDT (project measurements); SI-ARCH (Smithsonian Herzfeld / M. B. Smith captions, search extracts); FARROKH (reproduces Iranica "Persepolis" on the Hadiš and Tachara); COMMONS-TRIP; BRIT-H100; SG-H100 (weak); IRANTOUR-TREAS (tertiary). Existing keys also used: IR-PERS, IR-APAD, ISAC-PA, WP-EXT, OSM, CHRON-C, LIVIUS.
