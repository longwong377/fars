# Research extract A — Terrace site specification (Persepolis / Pārsa)

Agent: research subagent A. Date: 2026-09-22.

## READ FIRST — what is broken / unverified

1. **The primary target was unreachable.** Schmidt, *Persepolis I* (OIP 68, 1953) could not be opened: isac.uchicago.edu,
   oi.uchicago.edu and archive.org (incl. the djvu.txt full text) are all refused by the network egress proxy
   (`EGRESS_BLOCKED` / CONNECT 403), both via WebFetch and curl. The same applies to iranicaonline.org, wikipedia.org,
   livius.org, persee.fr, jstor, academia.edu, researchgate, hathitrust, books.google, core.ac.uk, witpress, smarthistory.
   Only github.com / raw.githubusercontent.com and the WebSearch tool were reachable.
2. **Consequently, no value below was read by me on a page I could see.** Every value came from a WebSearch result summary
   (the search engine's extract of the named page) or from a GitHub-hosted plain-text copy of an old Wikipedia revision.
   The "source" column names the page the search engine attributed the statement to. **No page numbers are given anywhere
   — all are "page not verified".** Treat every row as needing re-verification against OIP 68 before it enters
   `SITE_SPEC.md`.
3. Tier column describes the evidence status of the *physical fact* (A = attested by remains / excavation; B = inferred;
   C = reconstructed). The separate "verif." marker in the note says how I obtained it:
   - `SR-Ir` = search-result extract attributed to Encyclopaedia Iranica (scholarly tertiary; best available here)
   - `SR-ISAC` = search-result extract attributed to ISAC photographic-archive page text (derived from Schmidt's captions)
   - `SR-pop` = search-result extract from popular/travel/aggregator sites (low confidence)
   - `WP-copy` = old Wikipedia "Persepolis" text via raw.githubusercontent.com (anassalamah/nlp-project) (low confidence)
4. Many parameters requested (interaxial spacing, base/shaft diameters, capital heights, wall thicknesses, doorway sizes,
   most stair flights) were **not obtainable** — listed as GAPS at the end of each block rather than guessed.

## Tables

### Terrace (overall)

| structure | parameter | value | unit | source (author, title, page/plate/figure) | tier | note |
|---|---|---|---|---|---|---|
| Terrace | N–S extent | ~455 | m | search extract for "Persepolis terrace dimensions" (pages returned: Iranica "Persepolis"; Livius "Persepolis, Terrace"; attribution among these not resolvable); page not verified | A | SR-pop/SR-Ir mixed. Irregular outline; "455 × 300" is an approximate envelope, not a rectangle |
| Terrace | E–W extent | ~300 | m | same as above; page not verified | A | SR-pop/SR-Ir mixed |
| Terrace | area | ~125,000 | m² | WP-copy ("125,000 square metre terrace"); also search extract; page not verified | A | consistent with 455 × 300 envelope minus irregularities |
| Terrace | height of N and W retaining walls above ground | ~12 | m | search extract attributed to Iranica "Persepolis" (Shahbazi): "rose some 12 m above the ground"; page not verified | A | SR-Ir |
| Terrace | retaining-wall height range (varies with ground slope) | 4–12 (13–41 ft) | m | search extract, source page not identifiable (1911 Britannica / travel pages in result set); page not verified | A | SR-pop |
| Terrace | height of terrace "above surrounding land" | 14 | m | search extract, travel/aggregator page; page not verified | B | SR-pop; conflicts with 12 m — see Conflicts |
| Terrace | "central part" height | 18 | m | search extract (unattributed); page not verified | B | SR-pop; probably conflates with the Hadish bedrock level (see Hadish) |
| Terrace | construction | partly artificial fill, partly cut from the rock of Kuh-e Rahmat; E side against the mountain | — | WP-copy; search extract; page not verified | A | |
| Terrace | wall facing | large dressed stone blocks laid without mortar; fill of earth and rock; metal clamps ("hooks") | — | search extract (unattributed); page not verified | A | SR-pop; clamp form (dovetail) not confirmed by any extract |
| Terrace | west-side double stair rise band ("from 5 to 13 m on the west side") | 5–13 | m | WP-copy; page not verified | B | wording garbled in source; do not use without primary check |
| Terrace | underground drains | tunnels cut through the rock beneath the platform | — | search extract (brewminate / worldhistory set); page not verified | A | SR-pop; Schmidt excavated the drain system — check OIP 68 |
| Terrace | cistern | large cistern cut at the E foot of Kuh-e Rahmat behind the platform | — | search extract; page not verified | A | SR-pop; dimensions GAP |

GAPS: terrace datum vs. plain (absolute m a.s.l.), per-side wall heights, parapet, block sizes, clamp form.

### Grand (Persepolis) Stairway — "Stairs of All Nations"

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Grand Stairway | form | double reversing (symmetrical) stair on the W side of the terrace wall | — | search extract (Livius "Stairs of All Nations"; WP); page not verified | A | |
| Grand Stairway | total steps (each side) | 111 | steps | WP-copy; search extract; page not verified | A | SR-pop/WP |
| Grand Stairway | steps per flight | 63 to landing + 48 to terrace | steps | search extract (unattributed); page not verified | A | 63+48 = 111 ✓ |
| Grand Stairway | flight width | 6.9 | m | WP-copy; search extract; page not verified | A | |
| Grand Stairway | tread | 0.31 | m | WP-copy; page not verified | A | |
| Grand Stairway | riser | 0.10 | m | WP-copy; page not verified | A | 111 × 0.10 ≈ 11.1 m total rise — consistent with ~12 m W wall. Check OIP 68 |
| Grand Stairway | builder | Xerxes I | — | search extract attributed to Livius; page not verified | B | Iranica extract instead lists "the monumental stairway" among Darius's works — see Conflicts |

GAPS: landing dimensions, total run, parapet form.

### Gate of All Nations (Gate of Xerxes)

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Gate of Xerxes | plan | square hall, 4 columns, 3 doorways (W, E, S) | — | search extract (Iranica / Livius / ISAC set); page not verified | A | |
| Gate of Xerxes | hall side | ~25 | m | WP-copy ("approximately 25 m in length"); page not verified | A | |
| Gate of Xerxes | hall area | 612 | m² | search extract (unattributed; result set incl. Iranica, Livius); page not verified | A | √612 ≈ 24.7 m ✓ consistent with ~25 m |
| Gate of Xerxes | column height | 16.5 | m | search extract (two independent phrasings; result set incl. Iranica & History Today); page not verified | A | |
| Gate of Xerxes | doorway height | 10 | m | search extract; page not verified | A | |
| Gate of Xerxes | doorway guardians | human-headed winged bulls on E doorway; (bulls on W doorway per general literature — not confirmed here) | — | search extract; page not verified | A | |
| Gate of Xerxes | roof | cedar beams | — | search extract (History Today); page not verified | B | |
| Gate of Xerxes | builder / name | Xerxes I; named "Gateway of All Lands" in his inscription (XPa) | — | search extract quoting XPa; page not verified | A | |

GAPS: wall thickness, doorway widths, column base/capital type and heights.

### Apadana

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Apadana | main hall | ~60 × 60 (square) | m | search extract attributed to Iranica "Persepolis"; WP-copy "each side 60 m"; page not verified | A | common "60.5 m" value NOT confirmed by any reachable source |
| Apadana | hall columns | 36 (6 × 6) | columns | search extract attributed to Iranica "Persepolis" and "Apadāna"; page not verified | A | |
| Apadana | porticoes | 3 (N, W, E), 12 columns each (2 × 6) | — | search extract attributed to Iranica "Persepolis"; page not verified | A | total 36 + 36 = 72 |
| Apadana | total columns | 72 | columns | WP-copy; many | A | |
| Apadana | column height (hall) | "more than 19" | m | search extract attributed to Iranica "Apadāna" ("Thirty-six stone columns, each more than 19 m in height with a square base, a fluted shaft, and a composite capital"); page not verified | A | SR-Ir |
| Apadana | column height | 19.50 | m | search extract attributed to Iranica "Persepolis" ("The columns soared to a height of 19.50 meters"); page not verified | A | SR-Ir |
| Apadana | column height | 19 | m | WP-copy ("Each column is 19 m high with a square Taurus and plinth") | A | |
| Apadana | column height incl. capital | ~19 (62 ft) shaft+base / ~20 (65 ft) with capital | m | search extract (unattributed) ; page not verified | B | SR-pop |
| Apadana | column height (popular) | 24 / 25 | m | search extracts from Smarthistory, Ancient Origins, WP "Apadana" | C | rejected — see Conflicts |
| Apadana | column bases | hall: square two-stepped base; N (and E) portico: same composition as the Gate of All Lands columns (bell base); W portico: double-bull capitals set directly on fluted shaft | — | search extract attributed to Iranica "Persepolis"; page not verified | A | |
| Apadana | capitals | double-bull (also lion / griffin forms reported for other buildings) | — | search extract; page not verified | A | assignment of capital type per portico needs OIP 68 |
| Apadana | shaft fluting | ~48 flutes (large columns 40–48) | flutes | search extract (WP "Persian column"/"Fluting"); page not verified | A | SR-pop |
| Apadana | corner towers | 4, reported as "four-story" | — | search extract attributed to Iranica "Persepolis"; page not verified | B | storey count is an interpretation |
| Apadana | south side | storage- and guardrooms | — | same | A | |
| Apadana | platform height above terrace | ~2.5 (8.2 ft) | m | search extract (kavehfarrokh.com / ancient-origins); page not verified | A | SR-pop — check OIP 68 |
| Apadana | N and E stairways | each: four flights — two projecting central flights converging on a central landing, two ascending at the extremities | — | search extract (quoted wording, likely Iranica/Farrokh); page not verified | A | step count, riser, width GAP |
| Apadana | portico size | 60 × 25 | m | search extract (unattributed) | C | suspicious; probably confuses portico with the portico+stair zone. Do not use |
| Apadana | foundation deposits | 2 stone boxes, NE and SE corners, each with gold + silver tablet of Darius I (DPh); found 1933 (Herzfeld/Krefter) with coin hoard | — | search extract (WP "Apadana hoard"; ISAC "Miscellaneous finds"); page not verified | A | |
| Apadana | date | begun by Darius I (deposit dated c. 515 BCE); completed by Xerxes I | — | search extracts (WP "Apadana hoard"; WP "Apadana"); page not verified | B | Iranica extract notes a late chronology (Stronach) refuted by Root 1988 on seal evidence |

GAPS: interaxial spacing, base diameter/height, shaft diameter, capital height, wall thickness (mud brick), tower plan size, stair riser/tread/width, roof beam dimensions.

### Tachara (Palace of Darius)

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Tachara | overall | 40 × 30 | m | search extract (Farrokh / WP "Tachara" set); page not verified | A | |
| Tachara | area | 1,160 | m² | search extract (WP "Tachara"); page not verified | A | "smallest palace on the Terrace" |
| Tachara | main hall | 15.15 × 15.42 | m | search extract (WP "Tachara"); page not verified | A | precise figure — likely derived from OIP 68; verify |
| Tachara | hall columns | 12 (3 × 4) | columns | same | A | |
| Tachara | portico | GAP (8 columns commonly stated, not confirmed) | — | — | — | |
| Tachara | builder | Darius I (Iranica extract: Darius built platform, monumental stairway, Tripylon and his private palace) | — | search extract attributed to Iranica; page not verified | B | |

### Hadish (Palace of Xerxes)

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Hadish | size | "twice the size of the Tačara" | — | search extract attributed to Iranica "Persepolis"; page not verified | A | |
| Hadish | platform | hewn from bedrock, 18 m above the plain | m | same | A | SR-Ir |
| Hadish | hall | square, 36 columns | columns | same | A | |
| Hadish | N portico | 12 columns | columns | same | A | |
| Hadish | S balcony | long balcony behind four-stepped crenellations, overlooking the plain | — | same | A | |
| Hadish | flanking apartments | each: 4-column hall, storage and guardrooms, tower | — | same | A | |
| Hadish | openings | 19 windows, 4 niches (monolithic), full drainage system | — | same | A | |
| Hadish | stairs | two double-reversed sculpted staircases from W and E courtyards; two plain staircases either side of the balcony down to the "Harem" (E one restored 1978) | — | same | A | |
| Hadish | builder | Xerxes I (named *hadiš* in its inscription) | — | same | A | |

### Hall of a Hundred Columns (Throne Hall)

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Hundred-Column Hall | hall | 68.5 × 68.5 | m | search extract (Livius "Hall of 100 Columns") ; page not verified | A | |
| Hundred-Column Hall | hall (alt.) | 70 × 70 | m | WP-copy; ISAC extract | A | rounded; see Conflicts |
| Hundred-Column Hall | columns | 100 (10 × 10) | columns | name + many | A | |
| Hundred-Column Hall | column height | ~14 | m | search extract (unattributed, persianempire.org/Lonely Planet set) | B | SR-pop — verify |
| Hundred-Column Hall | N portico | 16 columns, flanked by two colossal bulls built into tower walls | — | search extract (ISAC "Throne Hall" text) | A | SR-ISAC |
| Hundred-Column Hall | doorways | 8 stone doorways; N & S jambs throne-scene reliefs, E & W jambs king-vs-monster | — | ISAC "Throne Hall" text via search extract | A | SR-ISAC |
| Hundred-Column Hall | builder | begun by Xerxes I, completed by Artaxerxes I (end of 5th c. BCE in ISAC text) | — | ISAC "Throne Hall" text via search extract; page not verified | A | |

### Tripylon (Central Palace / Council Hall)

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Tripylon | plan | central room with 3 gates: N (to Apadana), E (to Hundred-Column Hall), S (to Hadish and "Palace D") | — | search extract (Livius "Tripylon"); page not verified | A | |
| Tripylon | columns | 4 (commonly stated; extract only says "small columned hall") | columns | — | B | GAP: confirm |
| Tripylon | builder | disputed: Darius I (Iranica extract) vs. Xerxes I after Apadana and Throne Hall (Livius extract) | — | see Conflicts | B | |

GAPS: dimensions, stair (reliefs of guards/nobles) steps.

### Treasury

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Treasury | first phase (Darius) | 120 × 60, W–E long axis | m | search extract attributed to Iranica "Persepolis"; page not verified | A | SR-Ir |
| Treasury | later phases | enlarged northwards by Darius, then by Xerxes (final shape) | — | same | A | final outline GAP (130–134 × 78 m often cited — NOT confirmed) |
| Treasury | largest hall | 99 columns ("Treasure Hall of 99 Columns") | columns | ISAC photographic-archive caption via search extract | A | SR-ISAC |
| Treasury | columns | wooden shafts, plastered and painted, on stone bases (square double plinths or discoid slabs on square plinths) | — | search extract attributed to Iranica; page not verified | A | |
| Treasury | walls | clay-based paint on walls noted by Schmidt | — | search extract (npj Heritage Science 2016); page not verified | A | |
| Treasury | location | SE corner of Terrace | — | Iranica extract | A | |

### "Harem of Xerxes"

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Harem | main wing | service quarter, rectangular courtyard, 8-column portico (2 × 4), 12-column hall (3 × 4) + chambers | — | search extract attributed to Iranica "Persepolis"/"Harem"; page not verified | A | |
| Harem | apartments | 6 in main wing (2 rows) + 16 in W wing; each a 4-column hall + 1–2 side rooms/storerooms along a long corridor | — | same | A | |
| Harem | enclosure | thick surrounding wall; single small entrance at SW corner | — | same | A | |
| Harem | identification | "Harem" is Schmidt's identification (Iranica calls it sound) | — | same | B | |
| Harem | modern state | main wing restored by Herzfeld/Krefter 1931–34 as expedition house; front is the site museum | — | ISAC "Harem of Xerxes" via search extract | A | modern restoration ≠ ancient elevation |

### Unfinished Gate, Palace H, Palace G

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Unfinished Gate | location | N of the Hundred-Column Hall forecourt, E of "Army Street" | — | Livius "Unfinished Gate" via search extract | A | |
| Unfinished Gate | date | probably begun by Artaxerxes III, continued by Artaxerxes IV / Darius III | — | same | B | |
| Palace H | attribution | Artaxerxes I; very little survives | — | Livius "Palace of Artaxerxes" via search extract | B | |
| Palace G | attribution | post-Achaemenid build on site of a destroyed older building, perhaps a palace of Artaxerxes III | — | Livius via search extract | B | |

GAPS: all dimensions.

### Fortifications, garrison, water

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| E fortification | wall thickness | 10 | m | search extract (ISAC "Miscellaneous Structures" result set; wording matches Schmidt-derived captions); page not verified | A | mud brick; row of square mud-brick towers along E edge at foot of Kuh-e Rahmat |
| Mountain fortification | course | towered wall from the Terrace corners up the slope and along the crest of Kuh-e Rahmat | — | same | A | |
| Garrison quarters | location / character | near SE corner of Terrace at the foot of the mountain; modest, insubstantial; garrison and perhaps artisans | — | same | B | function inferred from contents |
| Mural walls (tertiary) | "first wall 7 m, second 14 m, third 27 m" | 7 / 14 / 27 | m | WP-copy (derived from Diodorus 17.71) | C | literary, not archaeological — do not model as attested |

## Conflicts

1. **Apadana column height (the headline dispute).**
   - Reachable scholarly-tertiary values cluster at **19–20 m**: Iranica "Apadāna" "more than 19 m"; Iranica "Persepolis"
     19.50 m; old Wikipedia text 19 m; an unattributed extract "62 ft (19 m) … with capitals 65 ft (20 m)".
   - Popular values **24–25 m** appear only on Smarthistory, Ancient Origins, current Wikipedia "Apadana", travel pages,
     with no traceable excavation source.
   - Schmidt's own figure (OIP 68) **could not be read** — resolution against the excavation report is NOT done.
   - Working resolution (for SITE_SPEC, pending primary check): column height base-to-top-of-capital **≈19.5 m, tier A,
     unverified**. Hypothesis (tier C): the 24–25 m figures add the Apadana platform (~2.5–3 m) and/or the roof
     entablature to the column height, i.e. they measure roof/cornice level above the terrace or plain, not the column.
     19.5 + ~2.6 + ~2 m of beams/roof ≈ 24 m, which would explain the popular number. Log in OPEN_QUESTIONS.md.
2. **Terrace height**: 12 m (Iranica extract, N & W walls) vs "14 m above surrounding land" (popular) vs "4–12 m varying with
   slope" vs 18 m (Hadish bedrock above plain, Iranica). Probably all true at different points: wall height varies with
   the ground; 18 m is the highest built level (Hadish), not the wall. Needs the OIP 68 contour plan.
3. **Hundred-Column Hall**: 68.5 m (Livius) vs 70 m (WP, ISAC caption). 70 is likely a rounding. Prefer 68.5 pending OIP 68.
4. **Grand Stairway / Tripylon attribution**: Iranica extract assigns "the monumental stairway" and the Tripylon to Darius I;
   Livius assigns the Stairs of All Nations to Xerxes and says most scholars date the Tripylon to Xerxes after the Apadana
   and Throne Hall. Unresolved. (Note the Iranica "monumental stairway" may mean the terrace stair as planned, with the
   Xerxes Gate added later.)
5. **Apadana hall side**: only "60 m" confirmed; the commonly quoted 60.5 m is unconfirmed.
6. **Apadana portico 60 × 25 m** (one extract) is implausible for a 2 × 6 column portico and is rejected.

## Sources consulted

Reached only through WebSearch result extracts (the page itself was NOT fetchable):
1. A. Sh. Shahbazi, "Persepolis", *Encyclopaedia Iranica* — https://www.iranicaonline.org/articles/persepolis/ (blocked for fetch)
2. "Apadāna", *Encyclopaedia Iranica* — https://www.iranicaonline.org/articles/apadana/ (blocked for fetch; author not verified)
3. "Harem i. In ancient Iran", *Encyclopaedia Iranica* — https://www.iranicaonline.org/articles/harem-i/ (blocked)
4. ISAC Persepolis photographic archive pages (text derived from Schmidt's expedition): Throne Hall https://isac.uchicago.edu/collections/photographic-archives/persepolis/throne-hall ; Treasury …/persepolis/treasury ; Harem of Xerxes …/persepolis/harem-xerxes ; Miscellaneous Structures …/persepolis/miscellaneous-structures-persepolis ; Miscellaneous finds …/persepolis/miscellaneous-finds (all blocked for fetch)
5. Livius (J. Lendering) — Terrace, Stairs of All Nations, Tripylon, Hall of 100 Columns, Unfinished Gate, Palace of Artaxerxes: https://www.livius.org/articles/place/persepolis/ (blocked)
6. Wikipedia "Apadana", "Tachara", "Apadana hoard", "Persian column" — https://en.wikipedia.org/wiki/Apadana etc. (blocked)
7. Smarthistory, "Persepolis: The Audience Hall of Darius and Xerxes" — https://smarthistory.org/persepolis-the-audience-hall-of-darius-and-xerxes/ (blocked; source of the 24 m figure)
8. K. Farrokh, Tachara / Hadish / Apadana pages — https://www.kavehfarrokh.com/ (not fetched)
9. npj Heritage Science 2016, "Painted plaster and glazed brick fragments from Achaemenid Pasargadae and Persepolis" — https://www.nature.com/articles/s40494-016-0072-7 (not fetched)

Reached directly:
10. Old Wikipedia "Persepolis" plain text, GitHub copy — https://raw.githubusercontent.com/anassalamah/nlp-project/master/wikipedia%20pages/Persepolis.txt (fetched; tertiary; revision date unknown)

Unreachable (primary / high value — must be retried from a network that allows them):
- E. F. Schmidt, *Persepolis I* (OIP 68, 1953): https://isac.uchicago.edu/research/publications/oip/oip-68-persepolis-i-structures-reliefs-inscriptions ; https://archive.org/details/oip68 ; https://archive.org/stream/oip68/oip68_djvu.txt — all EGRESS_BLOCKED
- E. F. Schmidt, *Persepolis II* (OIP 69): https://isac.uchicago.edu/research/publications/oip/oip-69-persepolis-ii-contents-treasury-and-other-discoveries — blocked
- A. B. Tilia, *Studies and Restorations at Persepolis and Other Sites of Fārs* (IsMEO, Rome 1972/1978) — no online copy found
- F. Krefter, *Persepolis Rekonstruktionen* (1971) — no online copy found
- "Assessment of structural components of Iranian heritage building: Persepolis" (WIT Press STR09) — https://www.witpress.com/Secure/elibrary/papers/STR09/STR09015FU1.pdf — blocked
- "An Investigation of the Geometric Proportions of Bell-Shaped Column Bases and Bull Capitals at Persepolis…" (academia.edu/9702012) — blocked
