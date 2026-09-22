# SITE_SPEC — Terrace (generated from `src/data/site_spec.json` by `tools/spec_to_md.py`; edit the JSON, not this file)

**Status:** Phase 0 spec. Primary sources blocked (BLOCKERS B6); every row awaits re-verification against Schmidt 1953.

Frame: Persepolis grid: origin Apadana OSM centroid; +x grid east, +y grid north; grid north 341 deg true. Heights relative to COURT datum unless stated.

Footprint polygons: `src/data/geo/footprints.json` (OSM/Overture, ODbL; `tools/osm_to_grid.py`).

## global
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| origin_lat | 29.9351174 | deg | PLEIADES | B | Apadana platform vertex-mean centroid; Wikipedia coord agrees within 9 m |
| origin_lon | 52.8894969 | deg | PLEIADES | B |  |
| grid_north_true | 341.0 | deg | DERIVED | B | length-weighted W facade bearing 161.0/341.0 over 435 m; S edges 72.0 => orthogonal within 1 deg (subagent B) |
| plain_at_stair_asl | 1613.0 | m | COP-DEM | B | DSM 150 m W of W facade 1613.5; modern surface. Ancient ground level unknown (OPEN_QUESTIONS Q-003) |
| stair_total_rise | 12.0 | m | IR-PERS | B | upper landing '12 m above the ground' |
| court_asl | 1625.0 | m | DERIVED | B | plain_at_stair_asl + stair_total_rise; DSM terrace 1625-1628 consistent |
| r_east_side_x | 200.0 | m | DERIVED | C | grid-east threshold separating the terrace's E (mountain/fortification) side from the W/N/S outline; E-side edges get no parapet (fortification instead) |
| r_found_depth | 20.0 | m | DERIVED | C | platform/stair prisms extend this far below the court so no gap shows at the terrain (technical, not architectural) |
| r_column_proportions | {"base_h_frac": 0.075, "base_h_max": 1.6, "base_w_over_shaft": 1.55, "default_shaft_over_h": 0.0833, "shaft_min": 0.6, "capital_frac_default": 0.18, "composite_split": [0.23, 0.33, 0.44], "bell_taper": 0.45, "torus": [1.02, 0.14], "shaft_top_ratio": 0.93, "square2_lower_scale": 1.25, "plain_base": [1.2, 1.3], "capital_boxes": {"bell_r": [1.5, 0.95], "volute": [1.25, 0.9], "protome": [3.4, 1.1], "plain": 1.4}} |  | RECON | C | greybox column proportions where a building's row is missing (C); composite capital split bell/volute/protome |

## terrace — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| extent_ns | 473.4 | m | OSM | B | OSM outline bounds in grid frame (-238.72..234.66); Iranica '300 x 455' envelope; conflict logged |
| extent_ew | 318.0 | m | OSM | B | bounds -61.50..256.46 |
| area | 120491 | m2 | OSM | B | area of the Pleiades/OSM outline in the grid frame (tools/osm_to_grid.py); Iranica/WP 125,000 m2 |
| retaining_wall_height_w | 12.0 | m | IR-PERS | B | N and W walls 'some 12 m'; actual per-point height = court - terrain |
| wall_material | "dressed grey limestone blocks, dry-laid, metal clamps" |  | IR-PERS | B |  |
| parapet_height | 1.0 | m | RECON | C | no source reached; low crenellated parapet assumed on stepped four-tier crenellation motif attested on stairs |
| fill | "earth and rock fill, partly bedrock" |  | WP-COPY | C |  |
| stair_recess | "terrace platform = OSM terrace polygon minus grand_stair footprint (the stair is recessed into the W wall)" |  | DERIVED | B | OSM terrace outline follows the stair's outer edge |
| r_parapet_thickness | 0.6 | m | RECON | C | parapet thickness; inset so its outer face is flush with the wall face |

## grand_stair — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| steps_lower | 63 | steps | IR-PERS | B |  |
| steps_upper | 48 | steps | IR-PERS | B |  |
| flight_width | 6.9 | m | WP-COPY | C | OSM lanes 6.5 (W) and 8.4 (E) m incl. parapets; modelled flights 6.2 (W) / 6.9 (E) inside 0.3–0.75 m parapets |
| tread | 0.31 | m | WP-COPY | C |  |
| riser | 0.1081 | m | DERIVED | C | stair_total_rise/111; WP gives 0.10 m (111x0.10=11.1 m vs 12 m landing, conflict C-2) |
| west_lane_x | [-47.1, -40.6] | m | OSM | B | lower flights (from plain) in the outer lane |
| east_lane_x | [-40.6, -32.2] | m | OSM | B | upper flights, terrace side |
| y_extent | [80.07, 164.83] | m | OSM | B | outer landings at the ends |
| centre_y | 122.45 | m | DERIVED | B | midpoint of y_extent |
| layout | "lower flights start at centre and rise outward (N and S) to outer landings, reverse 180 deg (two 90 deg turns), upper flights rise back toward the centre to a common top landing facing the Gate" |  | IR-PERS | B | direction of lower flights: RECON C |
| block_construction | "4-5 steps cut from single blocks, rectangular clamps" |  | IR-PERS | B |  |
| lower_flight_y | [131.4, 150.9] | m | DERIVED | C | north half (mirrored about centre_y): 63 x 0.31 = 19.5 m run, ending at the outer landing |
| outer_landing | {"west_lane_y": [150.9, 164.8], "east_lane_y": [150.9, 157.8], "h": 6.81} | m | DERIVED | C | L-shaped landing: lower flight arrives in W lane, turn 90 deg E across to E lane, turn 90 deg S (Iranica's two 90-deg turns); h = 63 x riser |
| upper_flight_y | [136.0, 150.9] | m | DERIVED | C | 48 x 0.31 = 14.9 m run in E lane, rising toward centre |
| top_landing_y | [108.9, 136.0] | m | DERIVED | C | common upper landing in E lane at court level, open to the court on the E (Gate W door at y~124.6) |
| central_gap | [113.5, 131.4] | m | DERIVED | C | plain-level space between the two lower flights (W lane); retaining wall behind |
| parapet_height | 1.0 | m | RECON | C | stair parapets with stepped crenellations (motif attested on Apadana stairs, IR-PERS); height not obtained |
| r_flight_width_w | 6.2 | m | DERIVED | C | W-lane flight width inside 0.15 m parapets (lane 6.5 m, OSM) |
| r_parapet_step_group | 7 | steps | RECON | C | parapet modelled as stepped blocks each covering this many steps (greybox approximation of a sloped parapet) |

## gate_nations — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.0 | m | RECON | C | at court level at the top of the Grand Stair |
| hall_area | 612 | m2 | IR-PERS | B |  |
| hall_side | 24.74 | m | DERIVED | B | sqrt(612) |
| columns | [2, 2] | grid | IR-PERS | B | four columns |
| column_height | 16.5 | m | IR-PERS | B | 'over 16.5 m' |
| interaxial | 8.25 | m | DERIVED | C | hall_side/3, assuming wall-to-column = one bay |
| outer_size | [33.1, 34.9] | m | OSM | B | ruin footprint incl. walls |
| wall_thickness | 4.63 | m | DERIVED | C | ((33.1+34.9)/2 - 24.74)/2; OSM outer includes wall faces |
| door_height | 10.0 | m | WP-EXT | C |  |
| door_width | 3.8 | m | RECON | C | no source reached |
| doors | ["W", "E", "S"] |  | IR-PERS | B | W entrance, E and S exits |
| bench | [0.52, 0.52] | m | IR-PERS | B | stone bench along the walls, h x w |
| guardians | {"W": "bulls", "E": "human-headed winged bulls"} |  | IR-PERS | B |  |
| wall_finish | "mud brick with glazed tile facing (green, blue, orange; rosettes, palms)" |  | IR-PERS | B |  |
| roof | "cedar beams" |  | WP-EXT | C |  |
| platform_footprint | "gate_nations" | key | OSM | B | plan overlay compares the built outer wall outline with this footprint |
| r_roof_above_capital | 2.0 | m | RECON | C | beams + earth roof above the capitals |
| r_roof_thickness | 1.2 | m | RECON | C | roof slab |
| r_colossus | {"length": 5.0, "width": 1.6, "height": 5.5} | m | RECON | C | doorway colossi (bulls W, human-headed winged bulls E): height 5.5 from a weak popular source (C), length/width proportional; placed in the door reveals |
| inscription_placement | "XPa above each of the 4 colossi (one trilingual per colossus pair side; which version on which jamb C)" |  | B | search extract; version-to-jamb assignment C | ISAC-PA;LANG-R |
| r_inscription_panel | {"width": 3.2, "height": 2.4, "above_colossus": 0.5, "glyph_height": 0.075, "line_gap": 0.035} | m | RECON | C | inscription panel above each colossus (C) |

## apadana — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| podium_height | 3.0 | m | IR-APAD | B | '3 m higher than the level of a spacious open court' |
| hall_side | 60.5 | m | RECON | C | Iranica 'at least 58 m' and '60 x 60' (B); 60.5 widely quoted but unconfirmed |
| hall_centre | [1.9, -4.9] | m | DERIVED | C | x: platform midline (-61.5..65.35); y: N platform edge 52.0 - portico_depth_n 21.3 - wall 5.32 - half hall 30.25; leaves 15.3 m for S storerooms |
| hall_columns | [6, 6] | grid | IR-APAD | B |  |
| interaxial | 8.64 | m | DERIVED | C | hall_side/7, wall-to-column = one bay |
| column_height | 19.5 | m | IR-PERS | B | '19.50 m'; popular 24-25 m rejected (OPEN_QUESTIONS Q-001) |
| shaft_diameter_base | 1.6 | m | RECON | C | not obtained |
| flutes | 48 |  | WP-EXT | C | 'large columns 40-48' |
| hall_base | "square two-stepped plinth + torus" |  | IR-PERS | B |  |
| portico_base | "bell base" |  | IR-PERS | B |  |
| capital | "composite: bell/palm, volute block, double-bull protome" |  | IR-COL | B | capital composite '8 m' quoted (unclear scope) |
| capital_height | 7.8 | m | RECON | C | close to '8 m' extract |
| porticoes | {"N": [6, 2], "W": [2, 6], "E": [2, 6]} | cols | IR-APAD | B | 12 columns each |
| wall_thickness | 5.32 | m | IR-APAD | B | 'well over 5 m', one extract 5.32 |
| wall_height | 20.5 | m | IR-APAD | B | 'over 20 m' |
| building_height | 22.0 | m | IR-APAD | B | 'nearly 22 m' (roof) |
| corner_towers | 4 |  | IR-PERS | B |  |
| stairs | {"N": {"length": 81.67}, "E": {"length": 81.67}} | m | IR-PERS | B | each in 3 equal parts, double-reversed, four-stepped crenellations; E stair lies under a modern roof in OSM |
| stair_riser | 0.1 | m | RECON | C | step count not obtained; 30 steps for 3.0 m assumed |
| foundation_deposits | "stone boxes under corners with gold + silver plates (DPh); Iranica/ISAC extracts disagree: 2 boxes (NE, SE) vs 4 corners" |  | ISAC-PA | B | conflict Q-016 |
| portico_depth_n | 21.3 | m | DERIVED | C | 2 rows at 1 and 2 bays from hall wall face (2 x 8.64) + 4.0 m to platform edge |
| platform_footprint | "apadana" | key | OSM | B | platform incl. porticoes, towers; excludes N/E stair runs |
| r_door | {"width": 4.0, "height": 10.0} | m | RECON | C | hall doorways (not obtained) |
| r_tower_extra | 2.0 | m | RECON | C | corner towers rise this far above the roof (four-storey towers reported, B; height C) |
| r_storeroom_height | 8.0 | m | RECON | C | S storerooms |
| r_stair_tread | 0.38 | m | RECON | C | Apadana stair tread (not obtained) |
| r_stair_width | 7.0 | m | RECON | C | Apadana stair flight width / depth of the stair zone (not obtained) |
| r_stair_layout | "3 equal parts along the façade; central part: two flights converging on a central landing; outer parts: flights rising toward the centre onto landings at podium height adjoining the portico" |  | B | four flights (IR-PERS); exact arrangement C | IR-PERS |
| south_side | "storage- and guardrooms on the S side" |  | IR-PERS | B | search extract |
| relief_programme | {"E": {"right_wing": "nobles", "left_wing": "delegations", "centre": "audience"}, "N": {"right_wing": "delegations", "left_wing": "nobles", "centre": "audience"}} |  | IR-APAD;RELIEF-R | B | E façade: N wing nobles/guards/horses/chariots in 3 tiers, centre panel, S wing 23 delegations (search extract, B); N façade mirrors (which wing has the delegations NOT found, C). Centre = audience scene in 467 (Tilia 1972 via Iranica, B derived) |
| r_facade_thickness | 0.6 | m | RECON | C | relief-bearing façade wall along the outer edge of each stair zone |
| r_registers | {"count": 3, "bottom": 0.3, "height": 0.82, "gap": 0.06} | m | RECON | C | 3 registers (B); register height and figure height NOT found (C): figures ~0.78 m |
| r_figure_spacing | 0.62 | m | RECON | C | spacing of walking figures in file (C) |
| r_delegation_members | 4 |  | RECON | C | members per delegation incl. usher (counts per delegation NOT found; C) |
| r_relief_depth | 0.045 | m | RECON | C | low-relief depth (C) |
| r_audience_panel | {"width": 6.2, "height": 2.6} | m | RECON | C | audience panel size (C; the Treasury audience reliefs' dimensions were not obtained) |
| r_crenellation | {"width": 0.9, "height": 0.9, "steps": 4} | m | RECON | C | four-stepped crenellations crowning the stair façades (motif B, IR-PERS; size C) |

## tachara — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 2.6 | m | IR-PERS | B | 2.20-3.00 above Apadana level (court) |
| overall | [30, 40] | m | IR-PERS | B | 40 x 30, long axis N-S; OSM 33.3 x 44.1 |
| hall_columns | [3, 4] | grid | IR-PERS | B |  |
| hall_size | [15.15, 15.42] | m | WP-EXT | C | suspect vs 3x4 grid (conflict C-7) |
| portico | [4, 2] | cols | IR-PERS | B | 8 columns, S side |
| north_rooms | 2 | rooms of 4 columns | WP-EXT | C |  |
| column_height | 8.0 | m | RECON | C | not obtained |
| stone_frames | "monolithic door/window/niche frames, dark polished limestone" |  | WP-EXT | C | brief §4.4 seed fact; only a WP extract seen |
| stairs | "S double stair with servant reliefs (NW stair is Artaxerxes III: absent)" |  | IR-PERS | B |  |
| platform_footprint | "tachara" | key | OSM | B | OSM 33.4 x 44.1 = platform incl. S stair; building 30 x 40 (IR) sits on it (conflict logged Q-017) |
| r_hall_offset_n | 3.0 | m | RECON | C | hall centre N of building centre (S portico in front) |
| r_wall | 2.4 | m | RECON | C | mud-brick wall thickness |
| r_wall_above_columns | 1.5 | m | RECON | C | wall top above column top (roof zone) |
| r_doors | {"S": {"width": 2.4, "height": 5.5}, "N": {"width": 1.8, "height": 4.5}} | m | RECON | C | doorway sizes (monolithic stone frames; sizes not obtained) |
| r_shaft | 0.9 | m | RECON | C | shaft diameter |
| r_portico_gap | 4.5 | m | RECON | C | portico column row distance S of the hall wall |
| r_portico_row_spacing | 4.2 | m | RECON | C | portico row spacing |
| r_roof | {"extend_s": 12.0, "offset_n": -2.0, "thickness": 1.5} | m | RECON | C | roof slab covering hall + portico |

## hadish — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 6.0 | m | DERIVED | C | '18 m above the plain' (IR-PERS) - stair_total_rise 12; DSM S terrace 1628.5-1630.5 suggests 3.5-5.5 (modern rubble/erosion); Q-018 |
| overall | [40, 55] | m | WP-EXT | C | 'twice Tachara'; OSM 57.3 x 73.8 incl. stairs |
| hall_columns | [6, 6] | grid | IR-PERS | B |  |
| portico | [6, 2] | cols | WP-EXT | C | 12 columns N |
| column_height | 10.0 | m | RECON | C |  |
| windows | 19 |  | IR-PERS | B |  |
| niches | 4 |  | IR-PERS | B |  |
| platform_footprint | "hadish" | key | OSM | B | OSM 57.3 x 73.8 = platform incl. W/E stairs; building 40 x 55 (WP) on it (Q-017) |
| r_interaxial | 5.4 | m | RECON | C | hall interaxial (not obtained; 36-column hall about 38 m square) |
| r_hall_offset_n | 2.0 | m | RECON | C | hall centre N of footprint centre |
| r_wall | 2.8 | m | RECON | C | wall thickness |
| r_wall_above_columns | 1.8 | m | RECON | C | roof zone |
| r_doors | {"N_offsets": [-8.0, 8.0], "width": 2.6, "height": 6.0} | m | RECON | C | N portico doorways (2, per WP extract) and S door to balcony; sizes C |
| r_shaft | 0.9 | m | RECON | C | shaft diameter |
| r_portico_gap | 4.5 | m | RECON | C |  |
| r_portico_row_spacing | 4.6 | m | RECON | C |  |
| r_roof | {"offset_n": 5.0, "extend": 10.0} | m | RECON | C | roof slab |

## hall100 — state in 467 BCE: **under_construction**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.5 | m | RECON | C |  |
| hall_side | 68.5 | m | IR-PERS | B | popular 70 m |
| hall_columns | [10, 10] | grid | IR-PERS | B |  |
| interaxial | 6.23 | m | DERIVED | C | hall_side/11 |
| column_height | 14.0 | m | IR-PERS | B | 'nearly 14 m' |
| portico | [8, 2] | cols | IR-PERS | B | 16 columns; 2x8 inferred |
| doors | 8 |  | ISAC-PA | B |  |
| construction_state | "column bases set; ~30% of shafts raised; walls to 1/3 height; portico bulls blocked out" |  | RECON | C | begun by Xerxes, finished by Artaxerxes I |
| r_wall_top_above_columns | 2.0 | m | RECON | C | wall top above column top when finished; under construction walls stand at 1/3 of that |
| r_door_width | 3.2 | m | RECON | C | 8 doorways, 2 per side |
| r_portico_gap | 4.5 | m | RECON | C |  |
| r_portico_row_spacing | 5.5 | m | RECON | C |  |
| r_construction_probs | {"raised": 0.3, "partial": 0.25, "partial_min": 0.35, "partial_span": 0.3} |  | RECON | C | construction state distribution: 30% raised (construction_state), 25% partial shafts; rest bases only (C) |

## tripylon — state in 467 BCE: **under_construction**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 2.6 | m | IR-PERS | B | 2.60 above Apadana court |
| hall_columns | [2, 2] | grid | RECON | C | 4 commonly stated |
| column_height | 8.0 | m | RECON | C |  |
| r_hall | 12.0 | m | RECON | C | central room interior (not obtained) |
| r_wall | 2.2 | m | RECON | C |  |
| r_wall_fraction_built | 0.5 |  | RECON | C | walls built to half height (under construction) |
| r_door_width | 2.2 | m | RECON | C | 3 doorways N/E/S |
| r_shaft | 0.8 | m | RECON | C |  |
| r_interaxial | 5.0 | m | RECON | C |  |
| r_column_built | 0.5 |  | RECON | C | column shafts half raised |

## treasury — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.0 | m | RECON | C |  |
| phase1 | [120, 60] | m | IR-PERS | B | W-E axis |
| hall99 | 99 | columns | ISAC-PA | B | wooden plastered and painted shafts on stone bases |
| column_height | 6.0 | m | RECON | C |  |
| r_floor_raise | 0.3 | m | RECON | C | floor above court |
| r_wall | {"thickness": 2.5, "height": 7.0} | m | RECON | C | enclosure walls |
| r_shaft | 0.55 | m | RECON | C | plastered wooden shaft |
| r_hall99_grid | [9, 11] | cols | RECON | C | factorisation of 99 (hall99, ISAC-PA) into a grid: C |
| r_hall99_offset_n | 20.0 | m | RECON | C | hall position N of footprint centre |
| r_hall99_spacing | 4.2 | m | RECON | C |  |

## harem — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 1.0 | m | RECON | C |  |
| portico | [4, 2] | cols | IR-PERS | B |  |
| hall_columns | [3, 4] | grid | IR-PERS | B |  |
| apartments | 22 |  | ISAC-PA | B | 6 in main wing + 16 W wing, each 4-column hall |
| column_height | 6.0 | m | RECON | C |  |
| r_wall | {"thickness": 2.2, "height": 7.0} | m | RECON | C |  |
| r_main_wing_footprint | "museum_modern" | key | ISAC-PA | B | the main wing lies under the modern museum (Krefter rebuild) footprint (ISAC-PA; B), so its position comes from that footprint; the modern building itself is absent |
| r_shaft | 0.6 | m | RECON | C |  |
| r_interaxial | 4.5 | m | RECON | C |  |
| r_hall_offset_n | 8.0 | m | RECON | C |  |
| r_portico_offset_s | 14.0 | m | RECON | C |  |
| r_portico_row_spacing | 4.0 | m | RECON | C |  |

## garrison — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.0 | m | RECON | C |  |
| note | "modest mud-brick rooms near E/SE foot of mountain; OSM label 'guardhouse & hall of 32 columns' (32-column hall absent in 467: RECON)" |  | ISAC-PA | B |  |
| r_wall | {"thickness": 1.2, "height": 4.0} | m | RECON | C | modest mud-brick rooms |
| r_floor_raise | 0.2 | m | RECON | C |  |

## fortification_e — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| wall_thickness | 10.0 | m | ISAC-PA | B | mud brick, E edge at mountain foot |
| curtain_height | 7.0 | m | IR-FORT | B |  |
| tower_extra_height | 5.0 | m | IR-FORT | B | 'standing 5 m high' ambiguous |
| tower_spacing | 20.0 | m | RECON | C |  |
| r_tower | {"length": 7.0, "extra_width": 2.0} | m | RECON | C | tower plan (not obtained) |

## absent_in_467
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| list | ["palace_h", "palace_a3_osm", "unfinished_gate", "tomb_a2", "modern_roof_a1bf0b", "museum_modern"] | footprint keys | DERIVED | B | derived from src/data/chronology.json (present=false); garrison footprint also covers the later 32-column hall — garrison rebuilt as modest rooms only (C) |

## Source keys
| key | citation | access |
|---|---|---|
| IR-PERS | A. Sh. Shahbazi, 'Persepolis', Encyclopaedia Iranica online https://www.iranicaonline.org/articles/persepolis/ | search-extract only (host blocked, B6); page not verified |
| IR-APAD | 'Apadāna', Encyclopaedia Iranica online https://www.iranicaonline.org/articles/apadana/ | search-extract only; page not verified |
| IR-FORT | 'Fortifications', Encyclopaedia Iranica online https://www.iranicaonline.org/articles/fortifications-/ | search-extract only |
| IR-COL | 'Columns' / 'Capitals', Encyclopaedia Iranica online https://www.iranicaonline.org/articles/capitals/ | search-extract only |
| IR-TREAS | 'Persepolis Administrative Archives ii. Treasury Archive', Encyclopaedia Iranica https://www.iranicaonline.org/articles/persepolis-admin-archive/ | search-extract only |
| WP-COPY | Wikipedia 'Persepolis' (undated plain-text copy) https://raw.githubusercontent.com/anassalamah/nlp-project/master/wikipedia%20pages/Persepolis.txt | read in full (tertiary) |
| WP-EXT | Wikipedia articles (Tachara, Hadish, Apadana, Gate of All Nations) https://en.wikipedia.org/ | search-extract only |
| ISAC-PA | ISAC Persepolis photographic archive pages (Schmidt expedition captions) https://isac.uchicago.edu/collections/photographic-archives/persepolis/ | search-extract only |
| LIVIUS | J. Lendering, Livius.org Persepolis pages https://www.livius.org/articles/place/persepolis/ | search-extract only |
| OSM | OpenStreetMap building footprints via Overture Maps release 2026-08-19.0 (theme=buildings) s3://overturemaps-us-west-2/release/2026-08-19.0/ | downloaded; processed by tools/osm_to_grid.py; ODbL |
| PLEIADES | Pleiades places 922695, 774842748, 658615446 (OSM-derived outlines), GitHub mirror ryanfb/pleiades-geojson https://github.com/ryanfb/pleiades-geojson | downloaded; CC-BY |
| COP-DEM | Copernicus GLO-30 DSM tiles N29E052, N29E053, N30E052, N30E053 (DLR/Airbus, EU/ESA) s3://copernicus-dem-30m/ | downloaded |
| S2 | Copernicus Sentinel-2 L2A S2A_39RXP_20240712 TCI s3://sentinel-cogs/sentinel-s2-l2a-cogs/39/R/XP/2024/7/ | downloaded |
| PD1956 | R. A. Parker & W. H. Dubberstein, Babylonian Chronology 626 B.C.–A.D. 75 (1956), pp. 25–46; machine-readable transcription https://github.com/seanredmond/parker_and_dubberstein | downloaded |
| WMO-CLINO | WMO Climatological Standard Normals 1991–2020, Shiraz 40848 (IRIMO submission) https://github.com/wmo-im/WMO-climatological-normals-CLINO | downloaded |
| KING2022 | R. King, 'Trips to the King, Taxation, and the New Year in the PFA', Iran 63/1 (2022) https://doi.org/10.1080/05786967.2022.2101936 | abstract only |
| BRISSET2019 | Brisset et al. 2019, Lake Maharlou core, J. Paleolimnology https://link.springer.com/article/10.1007/s10933-018-0048-6 | abstract only |
| SUMNER1986 | W. Sumner, 'Achaemenid Settlement in the Persepolis Plain', AJA 90.1 (1986) https://doi.org/10.2307/505980 | search-extract only |
| SCHMIDT1953 | E. F. Schmidt, Persepolis I (OIP 68, 1953) https://isac.uchicago.edu/research/publications/oip/oip-68-persepolis-i-structures-reliefs-inscriptions | UNREACHABLE (B6) — cited only as the authority values must be re-checked against |
| DERIVED | Derived in this project from other rows (formula in note)  | n/a |
| RECON | Reconstruction judgement in this project (reason in note)  | n/a |
| LIVIUS-NR | J. Lendering, Livius.org, Naqš-e Rustam pages (tombs; Elamite relief) https://www.livius.org/articles/place/naqs-e-rustam/ | search-extract only |
| ALVAREZMON | J. Álvarez-Mon & Y. Wicks, 'Naqsh-e Rustam, Elamite relief' (Google Arts & Culture) https://artsandculture.google.com/asset/naqsh-e-rustam-elamite-relief/6QFTCP4TFlD8Yw | search-extract only: Elamite relief 7 x 2.5 m, overcarved by Bahram II (Sasanian) |
| RESIDENCE2021 | 'The So-called Achaemenid Capitals and the Problem of Royal Court Residence', Iran 62/1 (2021) https://doi.org/10.1080/05786967.2021.1960881 | title/abstract via search extract only |
| WP-PERS-SEASON | Wikipedia 'Persepolis' (current): Persepolis occupied seasonally, a royal spring/summer residence; mobile court https://en.wikipedia.org/wiki/Persepolis | search-extract only (tertiary) |
| CHRON-C | research/_chronology_C.md (subagent C, rows from Iranica/Livius/ISAC extracts) research/_chronology_C.md | project file |
| RELIEF-R | research/RELIEFS_AND_COLOUR.md (subagent; search extracts of ISAC, Iranica, Lerner 2024, Stein 2016, Askari Chaverdi 2016) research/RELIEFS_AND_COLOUR.md | project file; underlying sources search-extract only |
| LANG-R | research/LANGUAGES.md (subagent; Livius/Kent via GitHub mirrors; ARIo) research/LANGUAGES.md | project file |
| ARIO | R. Schmitt 2009, Die altpersischen Inschriften der Achaimeniden (ARIo, ORACC), CC0; mirror SLAB-NLP/Akk data/jsonl/ario.jsonl https://github.com/SLAB-NLP/Akk | downloaded |
| OSL | ORACC Sign List (oracc/osl, 00lib/osl.asl) https://github.com/oracc/osl | downloaded |
| NOTO | Noto Sans Old Persian / Cuneiform / Imperial Aramaic (SIL OFL 1.1), notofonts.github.io https://github.com/notofonts/notofonts.github.io | downloaded |
| PEOPLE-R | research/PEOPLE.md (subagent; search extracts) research/PEOPLE.md | project file |
| MATCULT-R | research/MATERIAL_CULTURE.md (subagent; search extracts) research/MATERIAL_CULTURE.md | project file |
| SOUND-R | research/SOUNDSCAPE.md (subagent; Perseus via GitHub; search extracts) research/SOUNDSCAPE.md | project file |
| HYG41 | HYG star database v4.1 (astronexus), CC BY-SA 4.0 https://github.com/astronexus/HYG-Database | downloaded |
| SRTM-TILES | AWS Terrain Tiles (Tilezen terrarium, SRTM-derived) s3://elevation-tiles-prod | downloaded (39 check points) |
