# §13.1 Independent geometry: diff of extraction A vs extraction B
Both subagents worked independently (neither read the other's file). Neither could read Schmidt (B6), so the
diff is between two independent *extractions of secondary sources*, plus B's independent OSM/DEM measurements.
"Resolution" says what went into `src/data/site_spec.json`.

| Parameter | A | B | Agree? | Resolution |
|---|---|---|---|---|
| Terrace extent | ~455 × 300 m | Iranica 300 × 455; OSM 318 × 474 (grid) | yes (source) / OSM +4% | OSM outline for geometry (it is georeferenced); Iranica envelope logged |
| Terrace area | ~125,000 m² | 125,000 (Iranica Fort.); OSM 120,629 | yes | OSM |
| W wall / landing height | ~12 m | landing 12 m; DSM relief 12–16 m | yes | 12.0 m (B) |
| Grand Stair steps | 111 = 63 + 48 | 111 = 63 + 48 | yes | B |
| Stair width / tread / riser | 6.9 / 0.31 / 0.10 | 6.9 / 0.31 / 0.10 (same WP origin) | yes, but not independent (same tertiary source) | riser derived 12/111 = 0.108 (C) |
| Grand Stair builder | disputed (Iranica Darius / Livius Xerxes) | disputed (WP 519 BC / Iranica Xerxes clamps) | yes (both disputed) | standing in 467 either way |
| Gate hall | ~25 m side, 612 m² | 612 m² | yes | 24.74 m (derived) |
| Gate column height | 16.5 m | over 16.5 m | yes | 16.5 (B) |
| Gate door height | 10 m | not given | — | 10 (C) |
| Apadana hall | ~60 × 60 | "at least 58" / 60 | partial | 60.5 (C) pending Schmidt |
| Apadana columns | 36 + 3 × 12 = 72 | same | yes | B |
| Apadana column height | 19.5 (working), 24–25 rejected | >19 / 19.50, 24 rejected | yes | 19.5 (B) |
| Apadana podium | ~2.5 m (popular) | 3 m (Iranica) | **no** | 3.0 (Iranica outranks popular) |
| Apadana stairs | four flights each (no length) | 81.67 m long, 3 parts | complementary | B |
| Apadana walls | not obtained | >5 m (5.32), >20 m high | — | B |
| Tachara | 40 × 30; hall 15.15 × 15.42; 12 cols | 40 × 30; 3×4; 15.15×15.42 suspect | yes | overall B; hall size C (conflict with 3×4 grid) |
| Tachara platform | not obtained | 2.2–3.0 above Apadana level | — | 2.6 (B) |
| Hadish | twice Tachara; bedrock 18 m above plain; 36 + 12 cols | same + WP 55 × 40 | yes | B/C |
| Hall of 100 Columns | 68.5 (Livius) / 70 | 68.50 (Iranica) / 70 popular | yes | 68.5 (B) |
| H100 column height | ~14 (popular) | "nearly 14" (Iranica) | yes | 14 (B) |
| Treasury phase 1 | 120 × 60 | 120 × 60 | yes | B; final outline from OSM |
| Harem | 2×4 portico, 3×4 hall, 6 + 16 apartments | 2×4, 3×4 | yes | B |
| E fortification | 10 m thick | curtain ~7 m high | complementary | B |
| Tripylon builder | disputed | disputed | yes | under construction in 467 (C) |

**Independent (non-Schmidt) check:** OSM/Overture footprints (traced from modern imagery) + Copernicus DSM + Sentinel-2.
The plan-overlay IoU test (§13.2) therefore runs against OSM footprints until Schmidt's plan is supplied. This is
logged as an exception: it tests "built model vs modern ruin footprint", not "vs excavation plan".
