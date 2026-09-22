# Phase 0 independent review

Reviewer: independent subagent. I did not see how this was built. Date: 2026-09-22.
Audited against PERSEPOLIS_BRIEF.md §2, §3, §4, §13.1, §13.9 and the §14 Phase 0 gate: *"Every filled row sourced and tiered; independent geometry extraction diffed; review passed"*.
Files: research/SITE_SPEC.md, src/data/site_spec.json, src/data/sources.json, src/data/geo/footprints.json, research/GEOMETRY_DIFF.md, CHRONOLOGY.md, OPEN_QUESTIONS.md, ANACHRONISM_BLOCKLIST.md, SUMMARY.md, LANDSCAPE.md, CALENDAR_AND_UNITS.md, DECISIONS.md, BLOCKERS.md, NEEDS_FROM_ME.md, research/_*.md, data/calendar/parker_and_dubberstein.tsv.
All numbers below were recomputed by script from the JSON, TSV and footprint files, not read from the prose.

**VERDICT: FAIL (2 critical)**

---

## CRITICAL (the gate cannot pass while these are open)

### C-1. D-003 models the king as present with no evidence, which contradicts brief §2
Brief §2: "the king is present only on dates the evidence supports. Otherwise he is absent, and the world shows it". The same section says the default start date "is one on which the evidence places the court at Persepolis".
D-003 does both of the following:
- It chooses 1 Nisannu 467 as the default start while stating "Court presence on that date: NOT sourced".
- It models the king as **present from Nisannu to Simanu at tier C, "pending evidence"**.

That inverts the brief's rule, which is absent unless attested. It also leaves the start-date requirement unmet. PROGRESS.md and OPEN_QUESTIONS Q-005 record the assumption honestly, but recording a breach does not make it compliant.
**Fix:** either (a) find a source that places Xerxes or the court at Persepolis on a date in the chosen year and move the default start to that date, or (b) model the king as absent by default and record in D-003 that no 467 date satisfies the "court at Persepolis" start criterion. D-003 must then weigh that cost against the alternatives (see M-9).

### C-2. CHRONOLOGY.md has filled rows with no source
The gate requires every filled row to be sourced. CHRONOLOGY.md is a named Phase 0 deliverable and the filter every asset must pass (§2). These rows fail:
- `garrison`: "standing, B"; builder "–"; Basis column **empty**. No raw extract dates the garrison. `_extract_A/B` give only its location and character.
- `palace_g`: Basis column **empty**. A source (ISAC Misc. structures) exists in `_chronology_C.md` row 15 but is not cited.
- `nr_kaba`: "standing, C"; basis "OPEN_QUESTIONS Q-006", and Q-006 itself cites no source ("disputed", "—").
- Several other rows cite reasoning rather than a source, for example `grand_stair` "predates or accompanies Gate of All Nations", `palace_h` "after 465" and `tombs_rahmat` "4th c.". Their sources exist only in `_chronology_C.md` and are not referenced per row.

No CHRONOLOGY row uses a `sources.json` key, although suitable keys exist (LIVIUS, ISAC-PA, IR-PERS).
**Fix:** give every row a `src` key (adding keys where needed) or mark it explicitly as RECON with a stated reason. Source the garrison's and the Ka'ba-ye Zartosht's state in 467, or tier them C with RECON.

---

## MAJOR

### M-1. Tier inflation: values taken from search extracts are marked A
The project's own rule (BLOCKERS B6, SUMMARY) caps search-extract values at B. Violations:
- `site_spec.json` `apadana.foundation_deposits` is tier **"A/B"**, sourced from ISAC-PA, whose access is "search-extract only". The row also hides a conflict between the extracts: A says 2 boxes at the NE and SE corners, B says 4 boxes under the corners. It is not in GEOMETRY_DIFF. SUMMARY's statement "Nothing in SITE_SPEC is tier A" is therefore false.
- `tachara.stone_frames` is tier **B**, sourced from WP-EXT (Wikipedia search extract), with the justification "brief seed fact". §4.4 says seed facts are "to verify, not trust", so they cannot raise a tier. Extract B's own key puts wiki values at C.
- CHRONOLOGY.md rows marked **A**: terrace, gate_nations, tachara ("standing, complete", A), nr_darius, and both archive rows ("Tier A"). All were read through search extracts (`_chronology_C.md` header). The existence of an inscription (XPa, XPc, DNa) can be A-type evidence, but "Tachara complete in 467" is not what XPc attests. D-003 itself calls the Treasury peak "B" while CHRONOLOGY calls it "A".
- LANDSCAPE.md: the Terrace coordinate is tier **A**, taken from Wikipedia/Wikidata via a search extract. The Sumner survey counts are "A (survey)" via a search extract.

**Fix:** cap all of these at B (or C for wiki values), or state in each file a rule that separates "evidence type" tiers from "verification" tiers and apply it consistently.

### M-2. §13.1 independent geometry extraction: met only in degraded form, and one claimed check was never run
- The brief's check is two independent digitisations of Schmidt's plan. Neither agent read Schmidt (B6). The diff compares two readings of **the same search-engine extracts of the same Iranica and Wikipedia pages**. Agreement therefore largely shows the same source twice, not independent confirmation. GEOMETRY_DIFF admits this only for the stair row. Every "yes" row that traces to one page (Iranica 612 m², 68.5, 19.5, 63+48 and so on) is the same kind of non-independent agreement.
- The **georeferenced geometry that drives placement** was extracted only once: footprints, hall_centre, stair lanes, grid north and origin all come from OSM/Overture/Pleiades via `tools/osm_to_grid.py`, following B's recommendation. Extraction A produced no positional geometry, so nothing positional was diffed.
- GEOMETRY_DIFF and BLOCKERS B1 name **Sentinel-2 as an independent check**. No S2 measurement, comparison or result exists anywhere in the repo (grep: S2 appears only in sources and licence lists). This asserts a check as done when it was not.
- GEOMETRY_DIFF overstates agreement. Harem "6 + 16 apartments" is marked "yes", but extract B gives no apartment count. Rows present in only one extract are missing from the diff: foundation deposits, Army Street 92 × 9.70 m, Tripylon "15.46 m", Apadana capital "8 m", Gate bench.

**Fix:** reword the gate status as a logged exception: numeric diff done, positional diff not possible under B6. Either run the S2 check (for example, terrace outline vs the S2 edge at 10 m, reported with numbers) or delete the claim. Correct the Harem row and add the missing one-sided rows.

### M-3. Apadana hall position contradicts the Apadana's own portico spec
`hall_centre` y = 4.4 (RECON). The hall's outer N wall is then at 4.4 + 60.5/2 + 5.32 = **39.97**. The OSM platform N edge is at y ≈ 52.0–52.4, which leaves a **12.0 m** strip for the N portico. The spec gives a 2-row N portico (`porticoes.N = [6,2]`) at interaxial **8.64 m**, which needs at least ~17.3 m from the wall face plus a margin. On the south side, 24.6 m remains between the hall wall and the platform edge (−55.84). The hall is probably placed about 5–6 m too far north, or the portico depth or interaxial is wrong. No portico-depth row exists.
**Fix:** add a portico depth or portico interaxial row and re-derive hall_centre so both porticoes and the S rooms fit. Log it in OPEN_QUESTIONS.

### M-4. Grand Stair geometry does not close
- The west lane (lower flights) runs from the centre (y = 122.45) to the outer landings (y ≈ 87.4 and 157.8), about **35 m** per side. The lower flight is 63 × 0.31 = **19.5 m**, leaving about 15.5 m per side unexplained.
- The east lane (upper flights) runs 87.49 → 157.79 (70.3 m). Two upper flights are 2 × 48 × 0.31 = **29.8 m**, which implies a 40 m top landing that is not stated anywhere.
- No landing dimensions exist. `flight_width` 6.9 m does not match the lanes the spec uses: west 6.5 m, east 8.4 m.
- The Terrace polygon's west edge at the stair **follows the stair's outer edge** (x ≈ −47). The whole `grand_stair` footprint therefore lies inside `terrace` (intersection fraction 1.0). The line of the retaining wall behind the stair is unspecified, and extruding the terrace polygon to court level would bury the stair.

This is the start of the Phase 3 route (priority #4), so it needs landing and run rows before Phase 2.
**Fix:** add landing and run rows, reconcile tread × steps against the footprint (either the tread is wrong or gaps or landings exist), and specify the wall line behind the stair.

### M-5. The "absent in 467" list does not match the footprint keys
`absent_in_467.list` contains `palace_a3`, `tombs_rahmat` and `modern_roof`. The keys in `footprints.json` are `palace_a3_osm`, `tomb_a2` and `modern_roof_a1bf0b`. A generator or lint that filters by key would keep the Artaxerxes III palace, the Artaxerxes II tomb and the modern shelter roof. `palace_g` has no footprint. The OSM "palace_a3_osm" polygon sits north of the Hadish, where the extracts put Palace G, so the identities of the absent structures are muddled. The garrison footprint includes the "hall of 32 columns", which `_chronology_C` row 13 dates to Artaxerxes III, yet the garrison is marked "standing" with that footprint.
**Fix:** use the same ids in both files. Split or clip the garrison polygon, or flag it.

### M-6. Stated "overall" dimensions contradict the georeferenced footprints, and the conflict is not logged
- Tachara: spec 30 × 40 (B) vs footprint 33.4 × 44.1. The best-case IoU is 1200/1432 = **0.84**.
- Hadish: spec 40 × 55 (C) vs footprint 57.3 × 73.8, so IoU is about **0.52**. Extract B also says Hadish is "laid out east-west", but the footprint's long axis runs N–S.
- Treasury: phase 1 is 120 × 60 with a W–E axis, while the footprint is 80.3 × 149.2 (N–S). That may be expected from the later phases, but the final outline has no dimension row.

The plan-overlay gate (§13.2, ≥ 0.95 IoU) runs against these same OSM footprints (GEOMETRY_DIFF), so these buildings will fail it by construction. No rule says whether the footprint or the stated dimension governs, and only Q-008 (the Tachara hall) is logged.
**Fix:** state the governing rule per building and log each conflict in OPEN_QUESTIONS.

### M-7. Documents say things exist that do not (brief §3.7, "never describe intent as achievement")
Checked at review time:
- CHRONOLOGY.md: "Machine-readable copy: `src/data/chronology.json` (drives the chronology lint…)". **The file does not exist.**
- ANACHRONISM_BLOCKLIST.md: "`src/data/blocklist.json` — the chronology lint (`npm run lint:chrono`) fails the build". **Neither the JSON nor `tools/lint_chrono.ts` exists.**
- NEEDS_FROM_ME #5 refers to `tests/sky/horizons_request.txt`, **missing**. #11 and BLOCKERS B5 refer to `REAL_HARDWARE_TODO.md`, **missing**. #12 says "`public/_headers` already provided", **missing**.
- The Sentinel-2 check is claimed and was not run (see M-2).

**Fix:** create the files or reword each claim as future tense, marked TODO.

### M-8. CHRONOLOGY gaps and one unsupported claim
- The tomb attributed to Xerxes is "absent: cut after his death in 465 (**B**)". No extract supports "after his death". `_chronology_C` row 17 says "attribution only". Royal tombs were usually prepared during the king's lifetime (DNa is from Darius's reign). Tier C at most.
- Missing from the filter entirely: the Naqsh-e Rustam tombs of Artaxerxes I and Darius II (absent), the Elamite relief at Naqsh-e Rustam (present), the Army Road (absent), the Tachara W stair of Artaxerxes III (listed only in a site_spec note), the Hall of 32 Columns, and post-Achaemenid inscriptions on the Terrace (the Middle Persian and Arabic inscriptions in the Tachara are not in the blocklist). There is also no default rule for structures the filter does not list.

**Fix:** add these rows and state a default, for example "unlisted = blocked".

### M-9. D-003 rationale: the year choice is sound, but parts are incomplete or wrong
**Sound:** the decisive argument is correct and well grounded in the brief. The Phase 3 route and priority #4 require the Gate of All Nations, which is Xerxes' work (XPa), so any Darius-era year (including subagent C's 498) breaks the brief's core route. The choice also satisfies "height of glory" (Apadana, Tachara, Hadish, Gate, Harem, Treasury standing) and "construction is an asset" (Hall of 100 Columns, Tripylon). The cost in fewer named people is stated honestly, and the §4.4 seed people are correctly excluded as Darius-era. Regnal arithmetic checks: Xerxes yr 1 = Nisannu 485, so yr 19 = Nisannu 467 BCE = astronomical −466.

**Weak:**
- (a) The brief's start-date criterion (court at Persepolis) is not weighed in the choice of year at all (see C-1).
- (b) 466 BCE (yr 20, the other Treasury peak year) is listed as an alternative but no reason is given for preferring 467.
- (c) Early Artaxerxes I years (for example 464–459) are not considered. They fall within the Treasury Archive (to 458) and have the Hall of 100 Columns further along, which is arguably closer to "height of glory".
- (d) The Baratkama example gives no evidence that he was still treasurer in Xerxes yr 19.
- (e) "Year −466 is intercalary (Addaru II precedes it)" is wrong as stated. Addaru₂ (18 Mar 467, JDN 1550928) closes **Xerxes yr 18**. Yr 19 (17 Apr 467 → 5 Apr 466) has **12 months** (TSV rows 1969–1980; next Nisanu JDN 1551312). CALENDAR_AND_UNITS repeats the error. A calendar layer built from that sentence would insert a 13th month.

---

## MINOR
1. `gate_nations.wall_thickness` = 4.2, but the stated formula "(outer − hall)/2 averaged" gives ((33.1 + 34.9)/2 − 24.74)/2 = **4.63**. 4.2 is the short-side value only.
2. `hadish.floor` = 5.5, but the stated formula "18 m above plain − stair_total_rise" gives 18 − 12 = **6.0**. The DSM note (1628.5–1630.5 − 1625 = 3.5–5.5) supports a different value than the formula.
3. `terrace.extent_ns` = 474, but the footprint bounds give **473.4** (−238.72 → 234.66). GEOMETRY_DIFF quotes the OSM area as 120,629 m², while site_spec and footprints use 120,491 (two different processings of the same outline).
4. No SITE_SPEC row has a **page** field (§4.2 specifies "value, unit, source, page, tier, note"). "Page not verified" is recorded only at source level in sources.json. Add `page: null` with a "not verified" flag per row.
5. The Apadana E stair has no footprint: it is under `modern_roof_a1bf0b`, which is on the absent list. The harem polygon fully contains `museum_modern` (2,970 m² overlap), so removing the museum as "absent" would cut a hole in the Harem.
6. DECISIONS D-002 (ENU, +X east, UTM 39N) and site_spec/osm_to_grid (a grid rotated 19°, tmerc centred on the origin) describe different frames. No transform is recorded.
7. The source cap: SOURCES.md counts 21 keys (19 real sources) plus about 30 pages seen as extracts, against a Phase 0 cap of about 25 (§4.2). Not justified.
8. TASKS.md is stale: the blocklist, SOURCES, OPEN_QUESTIONS and SUMMARY are marked "[ ] not started" although they exist.
9. CALENDAR_AND_UNITS does not note that 1 Nisannu began at sunset on 16 April (the Babylonian day). `_date_decision_C` notes this for 498.
10. Q-008 may be a false conflict. A near-square hall can hold a 3 × 4 grid with unequal bays, so it should not by itself cast doubt on the 15.15 × 15.42 figure.
11. OPEN_QUESTIONS Q-013 contains an unresolved note-to-self ("rice is attested in PF? check").

---

## Checks that passed (recomputed)
- **site_spec.json:** 102 leaf rows. Every row has `v`, `u`, `src` and `tier`, and every `src` key exists in sources.json (0 missing, 0 unknown). Derived rows are never tiered above their inputs: grid_north B←OSM B, court_asl B←B+B, hall_side B←B, interaxials C, riser C.
- **Arithmetic:**
  - riser 12/111 = 0.10811 ✓
  - Gate hall_side √612 = 24.739 ✓; Gate interaxial 24.74/3 = 8.247 ✓
  - Apadana interaxial 60.5/7 = 8.643 ✓; Hall of 100 Columns 68.5/11 = 6.227 ✓
  - steps 63 + 48 = 111 ✓; porticoes Tachara 4×2 = 8, H100 8×2 = 16, Apadana 3 × 12 + 36 = 72 ✓
  - court_asl 1613 + 12 = 1625 ✓
  - Apadana hall_centre x = platform midline (−61.49 + 65.35)/2 = 1.93 ✓
- **footprints.json:** all polygons are valid. Stated area and bounds match the recomputed values within 0.5 m². Terrace 318.0 × 473.4 m. Gate outer 33.0 × 34.9 matches `outer_size` ✓. The Gate centroid y (124.6) aligns with the stair centre (122.45) ✓. The grid rotation sign in `osm_to_grid.py` is correct (bearing 341° maps to +y).
- **Calendar:** TSV row `1550958 -466 4 17 1 "Nisanu" 30` exists. The independently computed Julian JDN of 17 Apr −466 = 1550958 ✓. The CALENDAR_AND_UNITS table (month starts and lengths from Nisannu 467 to Addaru 466) matches TSV rows 1969–1980 ✓. The first four Old Persian month names are correct.
- **Chronology logic for 467:** Gate, Hadish, Harem and the final Treasury standing; H100 and Tripylon under construction; Palace H, Unfinished Gate, the Artaxerxes III works and the Kuh-e Rahmat tombs absent. All of this is consistent with the extracts. The Fortification Archive is correctly closed, and the Treasury Archive active.
- **Honesty of framing:** SUMMARY and PROGRESS lead with what is weak, and B6 is well documented. Rejections of the popular "24–25 m" column height, "1,770 m" altitude, "60 × 25 m portico" and Wikipedia Gate coordinate are sound and logged.

## To pass
Close C-1 and C-2. M-1 to M-9 should be fixed or explicitly logged in OPEN_QUESTIONS or BLOCKERS before Phase 2 starts; M-3, M-4 and M-5 directly feed the Phase 2 generators.

---

## Re-review 1

Reviewer: independent subagent (not the author of the fixes). Date: 2026-09-22. Audited commit 67c85cf against brief §2, §3, §4, §13.1 and the §14 Phase 0 gate.
What I recomputed rather than read from the prose:
- Walked all 114 `site_spec.json` rows: every row has v/u/src/tier and every src key exists in sources.json.
- Checked every `chronology.json` src key and footprint mapping.
- Ran `npx tsx tools/lint_chrono.ts`: OK, 26 structures, 62 terms, exit 0.
- Regenerated SITE_SPEC.md and CHRONOLOGY.md from the JSON in a scratch copy: byte-identical.
- Re-ran `tools/check_terrace_dem.py` in a scratch copy: output byte-identical to DEM_EDGE_CHECK.md. Its grid→tmerc rotation is the correct inverse of `osm_to_grid.py`.
- Recomputed Apadana and Grand Stair closure from footprints.json.
- Checked the calendar table against the P&D JDNs, and ran `src/core/calendar.ts` over the year.

### Status of previous findings

| # | Status | Evidence |
|---|---|---|
| C-1 | **RESOLVED (logged exception)** | D-003, CHRONOLOGY "King and court", Q-005 and BLOCKERS B9: the king is **absent by default**, which complies with §2. The start-date criterion ("evidence places the court") is still unmet. D-003 says so explicitly and argues that no 467 date is better evidenced. The unblock is Henkelman 2010 or the Treasury texts, which are unreachable (B6). Under the judgement rule this is an honest, logged exception, not a gate failure. The "seasonal pattern" court setting is opt-in, out-of-world and labelled C, which is acceptable. |
| C-2 | **RESOLVED** | All 26 chronology rows carry `src` keys that resolve in sources.json, and `lint_chrono` enforces this. The garrison is sourced (ISAC-PA, C). Palace G is sourced. The Ka'ba is on LIVIUS-NR at C. Tol-e Ajori is on CHRON-C at C, which traces to `_chronology_C` row 19 with real URLs. The rule is fail-closed ("unlisted = absent") in `_meta` and in the MD. Residual (minor, R-1 below): `fortification_e` is tier B while its own basis says "date assumed with the Terrace (C)". |
| M-1 | **RESOLVED** (residuals minor) | `foundation_deposits` is B with conflict Q-016. `stone_frames` is C. All CHRONOLOGY rows are B or C, and the archives are B. In LANDSCAPE, the Terrace and Naqsh-e Rustam coordinates and the Sumner counts are B. No site_spec row is tier A, so the SUMMARY claim is now true. Residuals: D-003 still says "XPa, tier A" and "(tier A/B)" while CHRONOLOGY caps those rows at B; `fortification_e` (R-1). |
| M-2 | **RESOLVED (logged exception)** | GEOMETRY_DIFF now states that agreement is extraction consistency, not independent confirmation, and logs the single-source footprints as a gate exception. The Sentinel-2 claim is withdrawn (BLOCKERS B1: "not used as a check"). A real non-Schmidt check now exists and reproduces: DSM vs OSM edge, W side mean −3.2 m / RMS 7.1 m (n=10), S side mean −7.1 m / RMS 11.5 m (n=6). The N side is inconclusive and logged as Q-019. The Harem row is corrected, and a one-sided section was added. Residual (minor): the one-sided list still omits the Apadana capital "8 m", Tripylon "15.46 m" and the foundation-deposit conflict (which is in Q-016). |
| M-3 | **RESOLVED** | `hall_centre` y = −4.9 with `portico_depth_n` 21.3 m (2 × 8.64 + 4.0). Recomputed: the hall's outer N face is at 30.67 and the footprint N edge at x = 1.9 is 52.19, a 21.5 m strip. The outer S face is at −40.47 against a S edge of −55.62, leaving 15.2 m for storerooms. It closes. |
| M-4 | **RESOLVED** | Lower flight 63 × 0.31 = 19.5 m (131.4→150.9). Upper flight 48 × 0.31 = 14.9 m (150.9→136.0). The L-shaped outer landing and a 27.1 m top landing (108.9–136.0) are both stated. The central gap is 17.9 m. The landing height is 63 × 0.1081 = 6.81, and the total is 12.0. It is symmetric about 122.45. The terrace is modelled as the OSM polygon minus the stair footprint, which fixes the burying problem. All new rows are DERIVED at C. |
| M-5 | **RESOLVED** | `absent_in_467.list` uses real footprint keys, and the lint cross-checks it against chronology.json (`palace_a3_osm`, `tomb_a2`, `modern_roof_a1bf0b`, `museum_modern`, `palace_h`, `unfinished_gate`). The garrison's 32-column hall is flagged (C) in both files. Palace G has no footprint and is absent. The palace_a3/G identity question does not change the 467 output, since both are absent. |
| M-6 | **PARTIAL** | Q-017 logs Tachara and Hadish, with a governing rule: the overlay compares the built platform outline, including stairs, with the OSM footprint. Two items are still missing. The Treasury final outline (80 × 149 N–S vs phase 1 at 120 × 60 W–E) has no dimension row and no Q entry. The Hadish orientation conflict (extract says "laid out E–W", footprint long axis is N–S) is not logged. |
| M-7 | **RESOLVED** for the files named in the review. **Regression, see N-2.** | `src/data/chronology.json`, `src/data/blocklist.json`, `tools/lint_chrono.ts` (runs, exit 0), `npm run lint:chrono`, `tests/sky/horizons_request.txt`, `REAL_HARDWARE_TODO.md` and `public/_headers` (COOP/COEP) all exist. The S2 claim is removed. |
| M-8 | **PARTIAL** | Added: the NR later tombs (C, and the Xerxes tomb is no longer B), the Elamite relief, the Army Road (merged into `unfinished_gate`), the Tachara stair of Artaxerxes III, and the 32-column hall. A fail-closed default rule is in place. Still open: post-Achaemenid inscriptions on the Terrace (Middle Persian, Arabic and later graffiti in the Tachara) have no blocklist entry. `ruin-graffiti` covers only "graffiti"; there is no "inscription" or "Middle Persian" term. |
| M-9 | **PARTIAL** | (a) is closed via C-1. (c) is closed: early Artaxerxes I years are considered and rejected with reasons. (e) is fixed in D-003 and CALENDAR_AND_UNITS: year 19 has 12 months, 354 days, and Addaru₂ belongs to year 18. (b) is addressed, but the argument does not discriminate: "yr 19 lies fully before the 465 crisis" applies equally to yr 20, which runs Apr 466 – Mar 465 and ends before Abu 465. 467 vs 466 is therefore an unargued coin-flip. That is harmless but should be stated as such. (d) is still open: nothing shows Baratkama is attested in yr 19. |
| m1 | RESOLVED | `wall_thickness` 4.63, which matches the formula. |
| m2 | RESOLVED | `hadish.floor` 6.0, which matches the formula; the DSM conflict is logged as Q-018. |
| m3 | PARTIAL | `extent_ns` is 473.4 ✓. GEOMETRY_DIFF still quotes an OSM area of 120,629 m² against the spec's 120,491. |
| m4 | OPEN | 0 of 114 spec rows have a `page` field. "Page not verified" is still recorded only at source level. |
| m5 | OPEN | `museum_modern` (absent) still lies wholly inside `harem` (overlap 2,970 m²). Subtracting it would cut a hole in the Harem, and no rule says not to. The Apadana E stair still has no footprint, although its length is given. |
| m6 | OPEN | D-002 still describes ENU +X east / UTM 39N. The spec, terrain (D-006) and tools all use the 19°-rotated tmerc grid. No transform is recorded in DECISIONS. |
| m7 | OPEN | SOURCES.md still says "21 keyed sources"; sources.json now has 26 keys (23 excluding DERIVED, RECON and CHRON-C). There is still no justification for the ~30 extract pages against the ~25 cap. |
| m8 | OPEN | TASKS.md still shows the blocklist, SOURCES, OPEN_QUESTIONS, SUMMARY and review as "[ ]", and every Phase 1 item as "[ ]" although terrain, sky and weather code was committed. |
| m9 | PARTIAL | A calendar.ts comment notes that the day began at the previous sunset. CALENDAR_AND_UNITS says only "months begin at the evening", with no explicit "1 Nisannu began at sunset 16 Apr". |
| m10 | OPEN | Q-008 is unchanged (low impact). |
| m11 | OPEN | Q-013 still reads "rice is attested in PF? check". Rice is also not an enforceable blocklist term. |

### New problems found in this re-review

**N-1 (MAJOR): the month-length column in CALENDAR_AND_UNITS is wrong, and the calendar code inherits the error.**
- The "Days" column copies the TSV `month_days` field. That field is not the length of the month on its row: the JDN differences are Nisannu 1550987 − 1550958 = **29** (the table says 30), Ayyaru **30** (says 29), and so on. Every month is shifted by one.
- The table sums to **355** days, but the same file and D-003 say 354. The correct lengths from the JDNs are 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, which sum to 354.
- Running `src/core/calendar.ts` confirms the effect. `YEAR_END_JDN` = 1551312, which is **1 Nisanu of year 20**, so the simulated year is 355 days long. `babylonianDate()` returns **null** on 5 days of the year: JDN 1551016, 1551105, 1551164, 1551223 and 1551282, the 30th day of each 30-day month.
- The previous review's "calendar passed" check compared the table with the same misread column.
- **Fix:** derive month lengths from successive JDNs, in both the table and `calendar_467.json`. Add a unit test that the year is 354 days with no null dates.

**N-2 (MAJOR, §3.7): new documents again describe things that do not exist.**
- `tests/sky/horizons_request.txt` says "The test tests/sky.horizons.test.ts then compares…". That file does not exist.
- REAL_HARDWARE_TODO says "run `npm run bench`… The run writes `bench-reports/<date>.json`" and "open `?bench=all`". But `npm run bench` points to the missing `tests/e2e/bench.spec.ts`, and no bench mode exists.
- package.json scripts `lint:lang`, `lint:activities` and `soak` point to tools that do not exist, so `npm run lint:all` fails at the second step.
- None of these blocks Phase 0, but they repeat the M-7 pattern. **Fix:** mark them TODO or future tense, or remove the scripts until they exist.

**N-3 (minor): PROGRESS.md is stale and now contradicts D-003.**
- It says "Court presence of the king in spring 467 is assumed (C)", but the default is now absent.
- It says Phase 0 is "review running" and Phases 1–9 "not started", although Phase 1 code is committed.

**N-4 (minor): E/W Apadana porticoes.**
- The hall is centred in x, so the W and E porticoes get about 27.8 m and 27.0 m strips, against 21.5 m on the N. There is no `portico_depth` row for the E and W porticoes.
- The Phase 2 generator will have to invent the E/W depth. Add a row, or state the depth as symmetric with the N portico and put the extra width in the towers.

**N-5 (minor): Tol-e Ajori has no sources.json key of its own.**
- Its only src is the project file CHRON-C. That traces to real URLs, but a direct key such as the ScienceDirect paper would keep the chronology row self-contained.

**R-1 (minor, residual of C-2/M-1): `fortification_e` is tier B, but its basis states that the date is C.**
- Set it to C, or cite a dating source.

### Gate assessment
- **"Every filled row sourced and tiered": true.** This holds for all 114 spec rows and 26 chronology rows, is machine-checked for the chronology, and the MD files regenerate identically from the JSON.
- **"Independent geometry extraction diffed": true, with a logged exception.** The numeric A/B diff is done and honestly caveated. The Schmidt digitisation is impossible under B6. The non-Schmidt check (DSM edge, Wikidata point, grid north) is real and reproducible.
- **King and start date:** these comply with §2's absence rule. The start-date criterion is a logged exception (B9, Q-005, D-003).
- No open item makes the gate text false.

### Must fix before Phase 1 gate / Phase 2 generators (non-blocking for Phase 0)
- N-1: calendar month lengths.
- N-2: phantom test, bench and lint scripts.
- M-6 remainder: the Treasury outline and Hadish orientation.
- M-8 remainder: post-Achaemenid inscriptions.
- m5: museum inside the Harem.
- m6: D-002 frame transform.

VERDICT (re-review 1): PASS
