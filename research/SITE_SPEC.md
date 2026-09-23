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
| interior_floor | "plaster_red" | material | RELIEF-R | B | Persepolis floors: lime plaster with two hematite-rich coats, deep red over white on pink plaster (Stein et al. 2016, search extract) |
| r_access_graph | [["court0", "tachara_s_court", "C: via the Palace G court / passage at the Tachara SE corner (x -6..-3, y -100..-108) - NOT SEEN, verify"], ["tachara_s_court", "tachara", "stair_s (B existence)"], ["tachara_s_court", "hadish", "stair_w (B existence)"], ["hadish_e_court", "hadish", "stair_e (B existence)"], ["tripylon_s_court", "hadish_e_court", "Tripylon stair_s (B existence, C position)"], ["court0", "tripylon", "stair_n (B)"], ["tripylon", "e_passage", "stair_e_narrow (B existence)"], ["e_passage", "hall100_w_court", "open passage N (REF-PLAN)"], ["e_passage", "harem", "N_passage gap (C)"], ["hall100_forecourt", "hall100", "portico step band (C) + N doors"], ["hall100_treasury_street", "treasury", "N door (C)"], ["hadish", "harem_w_wing", "balcony stairs SW/SE (B existence, C geometry)"]] |  | RECON | C | proposed minimum walkable graph for Phase 4; court levels C |
| r_stair_parapet | {"thickness": 0.3, "height": 0.9, "open_steps": 5} | m | RECON | C | outer parapet of the Phase-4 palace stairs: 0.3 m (patch flight notes), height as the Apadana stair parapet order of magnitude; the first open_steps steps at each flight foot are left open so the flight can be entered from the side (C) |

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
| inscription_placement | "XPa above each of the 4 colossi (one trilingual per colossus pair side; which version on which jamb C)" |  | ISAC-PA;LANG-R | B | search extract; version-to-jamb assignment C |
| r_inscription_panel | {"width": 3.2, "height": 2.4, "above_colossus": 0.5, "glyph_height": 0.075, "line_gap": 0.035} | m | RECON | C | inscription panel above each colossus (C) |
| r_colossus_plinth | 1.2 | m | RECON | C | colossi stand on plinths projecting from the façade (reconstruction references, C) |
| r_frieze | {"height": 0.9, "above_door": 0.4} | m | RECON | C | painted/glazed palmette frieze band above each doorway lintel (reconstruction references; glazed brick fragments at Persepolis B; placement C) |
| r_door_leaves | {"thickness": 0.25, "boss_pitch": 0.45} | m | RECON | C | timber double doors with bronze bosses turning on pivot sockets (pivot sockets: WP extract C; leaves/bosses C) |

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
| r_stair_layout | "3 equal parts along the façade; central part: two flights converging on a central landing; outer parts: flights rising toward the centre onto landings at podium height adjoining the portico" |  | IR-PERS | B | four flights per stair (IR-PERS, B); the exact arrangement of flights and landings is C |
| south_side | "storage- and guardrooms on the S side" |  | IR-PERS | B | search extract |
| relief_programme | {"E": {"right_wing": "nobles", "left_wing": "delegations", "centre": "audience"}, "N": {"right_wing": "delegations", "left_wing": "nobles", "centre": "audience"}} |  | IR-APAD;RELIEF-R | B | E façade: N wing nobles/guards/horses/chariots in 3 tiers, centre panel, S wing 23 delegations (search extract, B); N façade mirrors (which wing has the delegations NOT found, C). Centre = audience scene in 467 (Tilia 1972 via Iranica, B derived) |
| r_facade_thickness | 0.6 | m | RECON | C | relief-bearing façade wall along the outer edge of each stair zone |
| r_registers | {"count": 3, "bottom": 0.3, "height": 0.82, "gap": 0.06} | m | RECON | C | 3 registers (B); register height and figure height NOT found (C): figures ~0.78 m |
| r_figure_spacing | 0.62 | m | RECON | C | spacing of walking figures in file (C) |
| r_delegation_members | 4 |  | RECON | C | members per delegation incl. usher (counts per delegation NOT found; C) |
| r_relief_depth | 0.045 | m | RECON | C | low-relief depth (C) |
| r_relief_carving | {"depth_min": 0.03, "depth_max": 0.08, "figure_fill": 0.95, "panel_depth_factor": 1.5, "embed": 0.001} | m | RECON | C | carved low relief (D-015): peak projection of any relief within depth_min..depth_max (the brief's ~3-8 cm low relief; NOT SEEN in a publication, verify on Schmidt 1953 plates / squeezes); register figures peak at r_relief_depth, large panels (audience, spandrel combats) at r_relief_depth x panel_depth_factor; a standing figure incl. headgear fills figure_fill of the register height; the relief base is set embed into the wall face |
| r_audience_panel | {"width": 6.2, "height": 2.6} | m | RECON | C | audience panel size (C; the Treasury audience reliefs' dimensions were not obtained) |
| r_crenellation | {"width": 0.9, "height": 0.9, "steps": 4} | m | RECON | C | four-stepped crenellations crowning the stair façades (motif B, IR-PERS; size C) |
| r_parapet_height | 1.0 | m | RECON | C | stair parapet above the flights/landings (C); crenellations stand on it |
| r_rosette | {"diameter": 0.07, "pitch": 0.11} | m | RECON | C | rosette border bands between registers and around panels (motif seen in reconstructions, references/INDEX.md; size C) |
| r_cypress_band | {"height": 0.75, "pitch": 0.42} | m | RECON | C | cypress rows along the diagonal flight parapets (reconstruction references; C) |

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
| r_hall_offset_n | 3.0 | m | RECON | C | hall centre N of building centre (S portico in front) [SUPERSEDED in Phase 4 by r_hall_centre_y; unused] |
| r_wall | 2.4 | m | RECON | C | mud-brick wall thickness |
| r_wall_above_columns | 1.5 | m | RECON | C | wall top above column top (roof zone) |
| r_doors | {"S": {"width": 2.4, "height": 5.5}, "N": {"width": 1.8, "height": 4.5}} | m | RECON | C | doorway sizes (monolithic stone frames; sizes not obtained) |
| r_shaft | 0.9 | m | RECON | C | shaft diameter |
| r_portico_gap | 4.5 | m | RECON | C | portico column row distance S of the hall wall |
| r_portico_row_spacing | 4.2 | m | RECON | C | portico row spacing |
| r_roof | {"extend_s": 12.0, "offset_n": -2.0, "thickness": 1.5} | m | RECON | C | roof slab covering hall + portico |
| r_south_court_level | 0.0 | m | RECON | C | court S of the Tachara, reached by its S stair (FARROKH/WP-EXT: 'connected to the south court by a double reversed stairway'); its level is not known - datum assumed |
| stair_s_present_467 | true |  | SI-ARCH;ISAC-PA | B | S stairway carries Xerxes' XPc on its central facade (caption 'Central Facade of Southern Stairway: Persian Guards Flanking Xerxes Inscription, XPcb'), so it stands in 467 |
| stair_w_present_467 | false |  | WP-EXT;ISAC-PA | B | W (NW) stairway + new W doorway added by Artaxerxes III (A3Pa 'This stone staircase was made by me'): ABSENT in 467. Plan shows it as a band at x -38.5..-37.5, y -68..-82 (REF-PLAN) - do not build |
| stair_s_zone | {"x": [-36.5, -5.5], "y_facade": -101.0, "y_building_front": -99.2} | m | REF-PLAN | B | plan hatch band along the whole S front (x -36.5..-5.5 +/-1.5; band y -100.5..-101.5). The plan draws stairs schematically (~1 m bands), so the depth is not measured. OSM S edge -100.4..-100.9 = outer edge of the stair: the stair lies INSIDE the OSM tachara polygon |
| stair_s_layout | "two flights parallel to the S facade, rising from the W and E ends toward a central landing at floor level that opens N onto the portico; projecting central facade panel" |  | ISAC-PA;SI-ARCH;FARROKH | C | 'Western flight of the Southern stairway' (ISAC caption) implies a W and an E flight (B); 'double reversed' (FARROKH/WP extract) would imply 4 flights - conflict logged (Q-P4-02). Direction of rise (toward the centre) by analogy with the Apadana central part (C) |
| stair_s_flights | [{"id": "W", "foot": [-36.0, -100.1], "head": [-28.2, -100.1], "z0": 0.0, "z1": 2.6, "width": 1.5, "steps": 26, "riser": 0.1, "tread": 0.3}, {"id": "E", "foot": [-6.0, -100.1], "head": [-13.8, -100.1], "z0": 0.0, "z1": 2.6, "width": 1.5, "steps": 26, "riser": 0.1, "tread": 0.3}, {"id": "central_landing", "x": [-28.2, -13.8], "y": [-101.5, -99.2], "z": 2.6}] | m | RECON | C | geometry reconstructed inside the plan zone; flight clear width 1.5 m, 0.3 m outer parapet; riser/tread C (Grand Stair analogues are C too) |
| stair_s_reliefs | {"central_facade": "Persian guards flanking Xerxes inscription XPc (trilingual); lion-attacking-bull in the corner angles", "flight_parapets": "files of servants climbing with animals (kids), wineskins, covered dishes/food; dress alternates Persian/Median", "crenellation": "four-stepped (Persepolis stair convention)"} |  | SI-ARCH;ISAC-PA;WP-EXT;FARROKH | B | search extracts of captions and Iranica text; crenellation by analogy (C) |
| doors | [{"id": "S_main", "wall": "hall S wall (portico to hall)", "at": [-21.3, -88.0], "width": 2.4, "height": 5.5}, {"id": "N_pair", "wall": "hall N wall to the two 4-column N rooms", "offsets_x": [-6.0, 6.0], "y": -72.0, "width": 1.8, "height": 4.5}] | m | RECON;WP-EXT | C | existence B (main doorway with king relief, monolithic frames; rooms N/W/E, WP-EXT/ISAC-PA extracts); positions C on the building axis x=-21.3 (OSM centre); sizes = existing r_doors (C). Door jambs: king with attendants (main), lance-bearers with wicker shields (W rooms), attendants with towel and perfume flask (chambers), royal hero vs lion/monster (B, extracts; which jamb C) |
| r_three_small_stairways | "ISAC says 'three small stairways descended' from the Tachara; only the S stair (and A3's later W stair) are identified - the third is unidentified" |  | ISAC-PA | C | Q-P4-03 |
| r_hall_centre_y | -80.0 | m | REF-PLAN | C | hall centre between the S main doorway (y -88) and the N doorway pair (y -72) read on REF-PLAN (doors row); replaces r_hall_offset_n, which left the N rooms only ~6 m deep |

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
| r_courts_level | {"west_court": 0.0, "east_court": 0.0, "north_court_on_platform": 6.0} | m | RECON | C | W and E courtyards (FARROKH: the stairs 'ascended the Hadis from the western and eastern courtyards') at datum; the N courtyard lies on the platform between the stairs and the portico (REF-PLAN/REF-SCHMIDT open area x -3..40, y -109..-134) |
| north_court | {"x": [-3.0, 40.0], "y": [-134.0, -109.0]} | m | REF-PLAN;REF-SCHMIDT | B | open area N of the 12-column portico inside the platform outline in both plans (Schmidt ~23 x 30 m); the 'north courtyard of the Hadish' of the extracts |
| stair_w_zone | {"x": [-5.8, 2.5], "y": [-131.0, -115.0], "centre_y": -123.0} | m | REF-PLAN | B | strip along the W edge of the N courtyard bounded by walls at x~-3 and x~2.5 (REF-PLAN, +/-2); recessed inside the OSM W edge (-5.8), like the Grand Stair in the terrace |
| stair_e_zone | {"x": [50.0, 59.5], "y": [-128.5, -112.5], "centre_y": -120.5} | m | REF-PLAN | B | hatched projection E of the NE 4-column room (hatch x 55..59.5, wing walls y -112..-114 and -126..-128; +/-2); projects ~8 m beyond the OSM E edge (51.3) |
| stairs_layout | "both W and E: double-reversed (Grand-Stair type, 4 flights): outer lane lower flights rise from the centre outward to end landings, reverse, inner-lane upper flights rise back to a central top landing that opens onto the N courtyard" |  | FARROKH;SI-ARCH | C | 'double reversed' and W/E courtyards: B (Iranica via extract). 'Central facade' of the W stair and N/S 'wings' of the E stair (SI-ARCH captions, B) fit this type. Lane split and flight geometry C |
| stair_w_flights | [{"id": "W_lower_N", "foot": [-3.8, -123.0], "head": [-3.8, -116.5], "z0": 0.0, "z1": 3.0, "width": 3.4, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "W_lower_S", "foot": [-3.8, -123.0], "head": [-3.8, -129.5], "z0": 0.0, "z1": 3.0, "width": 3.4, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "W_landing_N", "x": [-5.8, 2.5], "y": [-116.5, -115.0], "z": 3.0}, {"id": "W_landing_S", "x": [-5.8, 2.5], "y": [-131.0, -129.5], "z": 3.0}, {"id": "W_upper_N", "foot": [0.35, -116.5], "head": [0.35, -123.0], "z0": 3.0, "z1": 6.0, "width": 3.7, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "W_upper_S", "foot": [0.35, -129.5], "head": [0.35, -123.0], "z0": 3.0, "z1": 6.0, "width": 3.7, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "W_top_exit", "x": [2.5, 4.5], "y": [-124.5, -121.5], "z": 6.0, "note": "opening E onto the N courtyard"}] | m | RECON | C | total rise 6.0 (floor C); 4 x 25 risers of 0.12, tread 0.26, lanes 4.0 / 4.3 m incl. 0.3 m parapets. Lower flights meet at the centre with no gap (zone too short for one) - if the true rise is ~5 m use 21 risers of 0.12 and tread 0.30 |
| stair_e_flights | [{"id": "E_lower_N", "foot": [57.5, -120.5], "head": [57.5, -114.0], "z0": 0.0, "z1": 3.0, "width": 3.4, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "E_lower_S", "foot": [57.5, -120.5], "head": [57.5, -127.0], "z0": 0.0, "z1": 3.0, "width": 3.4, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "E_landing_N", "x": [50.0, 59.5], "y": [-114.0, -112.5], "z": 3.0}, {"id": "E_landing_S", "x": [50.0, 59.5], "y": [-128.5, -127.0], "z": 3.0}, {"id": "E_upper_N", "foot": [52.75, -114.0], "head": [52.75, -120.5], "z0": 3.0, "z1": 6.0, "width": 4.9, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "E_upper_S", "foot": [52.75, -127.0], "head": [52.75, -120.5], "z0": 3.0, "z1": 6.0, "width": 4.9, "steps": 25, "riser": 0.12, "tread": 0.26}, {"id": "E_top_exit", "x": [42.0, 50.0], "y": [-122.0, -119.0], "z": 6.0, "note": "passage W past the NE 4-column room to the N courtyard (C)"}] | m | RECON | C | mirror of the W stair shifted to the E zone (centre y -120.5); outer lane x 55.5..59.5 (hatch), inner lane 50.0..55.5 |
| stair_w_reliefs | {"central_facade": "Persian guards flanking Xerxes inscription XPd (OP/El/Ak)", "flights": "servants carrying animals (ibex/kids) and food containers, as on the Tachara", "wings": "Persian guards"} |  | SI-ARCH;FARROKH;ISAC-PA | B | captions 'Central Facade of Western Stairway ... XPdb' and 'sculptures similar to that of the Tachara' (extracts) |
| stair_e_reliefs | {"wing_outer_faces": "Persian guards ('South Facade of South Wing')", "flights": "servants with animals and vessels (C, by the Iranica 'similar to the Tachara')"} |  | SI-ARCH;FARROKH | B | flight reliefs C |
| stairs_balcony | [{"id": "SW", "near": [-5.0, -176.0]}, {"id": "SE", "near": [49.0, -176.0]}] | m | FARROKH;RECON | C | existence B: 'two unadorned staircases on either side of the balcony (the eastern one restored in 1978) led down to the Harem'. Positions only (ends of the S balcony band y -174.5..-177, REF-PLAN); direction S/down to the Harem W wing; geometry and lower level NOT SEEN, verify |
| hall | {"interior_x": [8.5, 35.5], "interior_y": [-173.0, -146.0], "centre": [22.0, -159.5], "interaxial": 3.9} | m | REF-PLAN;REF-SCHMIDT | B | 6x6 hall measured ~27 m square (REF-PLAN) / ~25 m (REF-SCHMIDT); column pitch 3.8-4.0 m in both. CONFLICTS with r_interaxial 5.4 (C) => 38 m hall. Q-P4-06 |
| portico_layout | {"rows_y": [-136.5, -140.5], "x": [12.0, 32.0]} | m | REF-PLAN;REF-SCHMIDT | B | 12 columns (2x6) between the hall and the N courtyard (both plans; Schmidt y ~ -137) |
| doors | [{"id": "N_pair", "wall": "hall N wall (portico to hall)", "offsets_x_from_22": [-6.0, 6.0], "y": -146.0, "width": 2.6, "height": 6.0}, {"id": "S", "wall": "hall S wall to the balcony", "at": [22.0, -173.0], "width": 2.6, "height": 6.0}, {"id": "E", "wall": "hall E wall to the E apartment", "at": [35.5, -159.5], "width": 2.6, "height": 6.0}, {"id": "W", "wall": "hall W wall to the W apartment", "at": [8.5, -159.5], "width": 2.6, "height": 6.0}] | m | FARROKH;SI-ARCH;RECON | C | count and walls B (Iranica via FARROKH: 'a doorway to a long balcony on the south ... another pair to a twelve-columned portico on the north, and two more to flanking apartments'). Positions C: on hall axes, N pair on bay axes; sizes = existing r_doors (C). Jambs: king with parasol- and towel-bearers (NW doorway labelled 'Darius the king', B); XPe above king and attendants on the E doorway (B, SI-ARCH); W doorway XPe (B, 'two large Xerxes inscriptions on the eastern and western doorways') |
| r_hall_wall | 2.8 | m | RECON | C | hall wall thickness (was r_wall; unchanged value) |

## hall100 — state in 467 BCE: **under_construction**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.5 | m | RECON | C |  |
| hall_side | 68.5 | m | IR-PERS | B | popular 70 m |
| hall_columns | [10, 10] | grid | IR-PERS | B |  |
| interaxial | 6.23 | m | DERIVED | C | hall_side/11 |
| column_height | 14.0 | m | IR-PERS | B | 'nearly 14 m' |
| portico | [8, 2] | cols | IR-PERS | B | 16 columns; 2x8 inferred |
| doors | [{"id": "N1", "wall": "N", "at": [133.9, 6.0], "width": 3.3}, {"id": "N2", "wall": "N", "at": [158.9, 6.0], "width": 3.3}, {"id": "S1", "wall": "S", "at": [133.9, -64.0], "width": 3.3}, {"id": "S2", "wall": "S", "at": [158.9, -64.0], "width": 3.3}, {"id": "W1", "wall": "W", "at": [111.0, -16.5], "width": 2.5}, {"id": "W2", "wall": "W", "at": [111.0, -41.5], "width": 2.5}, {"id": "E1", "wall": "E", "at": [182.0, -16.5], "width": 2.5}, {"id": "E2", "wall": "E", "at": [182.0, -41.5], "width": 2.5}] | m | REF-PLAN;REF-SCHMIDT;ISAC-PA | B | 8 doorways (ISAC-PA), 2 per wall, symmetric at +/-12.5 m from the hall centre (REF-PLAN pairs centred 146.2/147.1 in x, spacing 25.3; REF-SCHMIDT +/-12.0-12.2 m; i.e. on the aisle between the 2nd and 3rd column from the centre). Placed about the OSM centre (146.4,-29.0); REF-PLAN's own W/E pairs sit 1.4-2.3 m further S. +/-1.5 m; widths +/-0.7 (N/S gaps 3.5-3.8 in REF-PLAN, ~3 in REF-SCHMIDT; E/W 'smaller', 2.2). Heights not found (C) |
| construction_state | "column bases set; ~30% of shafts raised; walls to 1/3 height; portico bulls blocked out" |  | RECON | C | begun by Xerxes, finished by Artaxerxes I |
| r_wall_top_above_columns | 2.0 | m | RECON | C | wall top above column top when finished; under construction walls stand at 1/3 of that |
| r_door_width | 3.2 | m | RECON | C | 8 doorways, 2 per side |
| r_portico_gap | 4.5 | m | RECON | C |  |
| r_portico_row_spacing | 5.5 | m | RECON | C |  |
| r_construction_probs | {"raised": 0.3, "partial": 0.25, "partial_min": 0.35, "partial_span": 0.3} |  | RECON | C | construction state distribution: 30% raised (construction_state), 25% partial shafts; rest bases only (C) |
| floor_alt | 1.0 | m | SG-H100;IR-APAD | C | weak alternative to the current 0.5 (C): 'two meters below the Apadana platform' (SG-H100, tertiary) with podium 3.0 (IR-APAD). Q-P4-09 |
| stairs | "none attested: the N portico opens on the forecourt; no stair found in either plan" |  | REF-PLAN;REF-SCHMIDT;BRIT-H100 | B | plans show no hatch around the hall |
| r_portico_step | {"x": [117.0, 176.0], "y_edge": 27.0, "steps": 3, "riser": "floor/3"} | m | RECON | C | low step band along the portico front so the raised floor is walkable (NOT SEEN, verify); portico N edge ~y 27 (REF-PLAN, towers at x 105..115 and 175..185) |
| door_reliefs | {"N": "throne/audience scene: king enthroned (5 registers of guards below - NOT SEEN, verify)", "S": "king enthroned, throne borne by representatives of the subject nations", "E": "royal hero in combat with lion/bull/monster", "W": "royal hero in combat with lion/bull/monster"} |  | BRIT-H100;IR-PERS | B | extracts; register count C |
| r_door_height | 8.5 | m | RECON | C | NOT SEEN, verify: ~0.6 x column height (14 m), the ratio of the Gate of All Nations door (10 m, C) to its columns |
| r_portico_extent | {"front_y": 27.0, "towers_x": [[105.0, 115.0], [175.0, 185.0]]} | m | REF-PLAN | B | portico N edge ~y 27 and antae towers x 105..115 / 175..185 read on REF-PLAN (r_portico_step note) |
| r_step_tread | 0.35 | m | RECON | C | tread of the portico step band and door thresholds (C) |
| r_threshold_steps | 3 | steps | RECON | C | external steps down from the raised floor at the W, E and S doorways so they are walkable both ways (C, NOT SEEN, verify) |

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
| r_column_built | 0.5 |  | RECON | C | column shafts half raised (Phase 4: hall now 15.46 m, row hall) |
| hall | {"interior_x": [74.2, 89.5], "interior_y": [-80.8, -64.5], "side": 15.46, "centre": [81.9, -72.7]} | m | REF-PLAN;IR-PERS | B | hall 15.46 m square (Iranica extract, B) = plan interior 15.3 x 16.3 m (REF-PLAN). Replaces r_hall 12.0 (C). 4 columns at ~5 m pitch (plan) = r_interaxial 5.0 |
| stair_n_zone | {"x": [67.0, 97.0], "y": [-55.0, -47.0]} | m | REF-PLAN;OSM | B | light-green band N of the N portico (portico columns at y -56.5, x 79/84); OSM modern shelter a1bf0b covers x 65..103, y -61..-43 (the stair is under the shelter today). +/-1.5 |
| stair_n_layout | "two corresponding flights parallel to the N facade rising from the W and E ends to a projecting central landing, then a terrace in front of the 2-column N portico" |  | IR-PERS | B | 'ascended from the court by a sculptured stairway with two corresponding flights, which gives access to a portico'; 'front wall of the projecting central landing of the north stairway' (extracts). Flight direction C |
| stair_n_flights | [{"id": "W", "foot": [67.5, -49.5], "head": [75.3, -49.5], "z0": 0.0, "z1": 2.6, "width": 2.4, "steps": 26, "riser": 0.1, "tread": 0.3}, {"id": "E", "foot": [96.5, -49.5], "head": [88.7, -49.5], "z0": 0.0, "z1": 2.6, "width": 2.4, "steps": 26, "riser": 0.1, "tread": 0.3}, {"id": "central_landing", "x": [75.3, 88.7], "y": [-51.0, -47.0], "z": 2.6}, {"id": "upper_terrace", "x": [67.0, 97.0], "y": [-55.0, -51.0], "z": 2.6}] | m | RECON | C | flights in the strip y -48..-51 (plan lines at -48 and -51); central landing projects ~1 m (C) |
| stair_n_reliefs | {"central_panel": "winged disc flanked by two seated sphinxes (with palm trees); below, two antithetic groups of Persian/Median guards flanking a blank field (4 per group per one extract; 9 'Persian' soldiers flanking an OP inscription of Xerxes per another - Q-P4-08)", "flight_facades": "Persian and Median nobles ascending", "inner_faces": "servants/'clergy' bringing animals and food (per the Tehran stair description - which stair is uncertain)", "corners": "lion attacking bull - NOT SEEN, verify"} |  | IR-PERS;SI-ARCH;COMMONS-TRIP | B | extracts; corner lion-bull C |
| stair_s | {"near": [82.0, -102.5], "direction": "descending S from the Tripylon S courtyard toward the area E of the Hadish"} | m | IR-PERS;COMMONS-TRIP;RECON | C | existence B: 'a small courtyard of the Tripylon was connected by a small stairway to the area east of the Hadish'; COMMONS-TRIP calls the Tehran stair 'the main staircase from the southern side' (conflict Q-P4-07). Position C (on axis at the S end of the courtyard); geometry NOT SEEN, verify |
| stair_e_narrow | {"x": [99.5, 102.5], "foot": [101.0, -58.0], "head": [101.0, -71.0], "z0": 0.5, "z1": 2.6, "steps": 20, "riser": 0.105, "tread": 0.35} | m | REF-PLAN;IR-PERS;RECON | C | existence B ('eastern entrance through a corridor ... linked by a narrow staircase to the Harem and to the Hundred Column Hall', extract). Zone B: grey hatch in the 5 m passage between the Tripylon E wall (x 98.5) and Hall100 W wall (x 103), y -58..-71 (REF-PLAN +/-1.5). Direction and levels C |
| doors | [{"id": "N", "wall": "hall N wall (portico to hall)", "at": [82.0, -63.3], "width": 2.8}, {"id": "E", "wall": "hall E wall to the E corridor", "at": [89.5, -72.2], "width": 2.7}, {"id": "S", "wall": "hall S wall to the S portico", "at": [82.0, -81.8], "width": 2.8}] | m | REF-PLAN;SI-ARCH | B | three doorways N/E/S, no W door (name 'Tripylon'; plan gaps in the hall walls, +/-1.5 m, width +/-0.7). Heights not found (C, use ~2.2 x width). Jambs: E - king (Darius I) with crown prince (Xerxes) on a throne carried by representatives of the nations (SI-ARCH, B); S - king and attendants (SI-ARCH, B); N - king with attendants (generic extract, which jamb C) |
| s_portico_court | {"portico_columns_y": -89.5, "court": {"x": [70.0, 95.0], "y": [-102.0, -90.0]}} | m | REF-PLAN;IR-PERS | B | 'the southern doorway opens into another portico and through this into a small courtyard' (extract); plan +/-2 |
| r_n_portico | {"x": [79.0, 84.0], "y": -56.5} | m | REF-PLAN | B | 2-column N portico, columns read on REF-PLAN (PHASE4_ACCESS §5) |
| r_e_corridor | {"x": [91.5, 99.5], "y": [-74.2, -70.2], "landing_y": [-74.2, -65.0]} | m | RECON | C | corridor from the E doorway (89.5, -72.2) to the head of the narrow E stair, at floor level; landing strip at the stair head down to where the 7 m flight ends (the flight run 20 x 0.35 is shorter than the 13 m zone). Width = E door +/- ~1.3 m |
| r_stair_e_start_level | 0.0 | m | RECON | C | the narrow E stair starts at the court (0): the proposed foot level 0.5 has no source and no passage floor is modelled, so its 20 risers become 2.6/20 = 0.13 (C) |
| r_stair_s_flight | {"x": 82.0, "top_y": -102.0, "steps": 26, "riser": 0.1, "tread": 0.3, "width": 2.4} | m | RECON | C | small S stair: from the S court edge (s_portico_court) down S to the area E of the Hadish (0); dimensions as the N flights (C, NOT SEEN, verify) |

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
| r_doors | [{"at": [201.8, -66.3], "width": 2.4}] | m | RECON | C | single NE entrance, reached through the garrison court (position and width C; the Treasury had one controlled entrance per ISAC-PA summary, not verified) [SUPERSEDED in Phase 4 by doors (REF-PLAN): this point lies in the street N of the Treasury] |
| r_north_wall_y | -78.0 | m | REF-PLAN;REF-SCHMIDT | B | N outer wall at y -79.5 (REF-PLAN) / -77 (REF-SCHMIDT); OSM treasury N edge -66.1 includes the ~12 m street between the Hall of 100 Columns (S wall -64/-66) and the Treasury. Other edges: W 140.5 (OSM 140.1), E 217.5 (OSM 220.4), S -212.5 (OSM -215.4). Q-P4-11 |
| entrances_history | {"phase1": "single entrance on the W side, opening on a line of small guardrooms", "phase2": "second entrance added in the N wall", "phase3_xerxes": "W part demolished for the Harem; building extended"} |  | IRANTOUR-TREAS | C | tertiary paraphrase of Schmidt 1939 (verify); implies the N entrance is the working one in 467 (C) |
| doors | [{"id": "N", "wall": "N outer wall, onto the Hall100-Treasury street", "at": [206.6, -78.0], "width": 2.4}, {"id": "E", "wall": "E outer wall", "at": [217.5, -134.5], "width": 2.0}] | m | REF-PLAN;RECON | C | only 2 m gaps in REF-PLAN's buttressed outer wall (x 205.8..207.5 in the N wall; y -133.8..-135.2 in the E wall); REF-SCHMIDT shows no gaps at its scale. Replaces the r_doors NE point [201.8,-66.3] which lies on the OSM edge, i.e. in the street |

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
| r_main_wing_extent | {"x": [98.0, 134.0], "y": [-207.0, -73.0]} | m | REF-PLAN;REF-SCHMIDT | B | main wing in both plans runs N of the museum_modern footprint (y -126.5..-210) to ~y -73 (REF-PLAN; Schmidt ~-95): the court N of the portico and the N rooms are missing from the current model. +/-3 |
| court | {"x": [101.0, 127.0], "y": [-125.0, -112.0]} | m | REF-PLAN;ISAC-PA | B | 'portico facing a spacious courtyard on the north' (ISAC extract); open area in REF-PLAN (+/-3; REF-SCHMIDT puts it ~8 m further N, Q-P4-10) |
| portico_layout | {"front_y": -125.0, "x": [105.0, 121.5], "rows": 2, "cols": 4} | m | REF-PLAN;IR-PERS | B | 8 columns 2x4 (B); front opening between antae x 105..121.5 (REF-PLAN); ~ OSM museum N edge -126.5 |
| hall | {"interior_x": [106.5, 123.0], "interior_y": [-150.5, -134.5]} | m | REF-PLAN | B | 12 columns (3x4, B); ~16.5 m square (+/-3) |
| doors | [{"id": "N", "wall": "hall N wall (portico to hall)", "at": [114.8, -134.5], "width": 2.4, "jambs": "NOT SEEN, verify (probably king with attendants)"}, {"id": "S", "wall": "hall S wall to the apartments", "at": [113.0, -150.5], "width": 2.0, "jambs": "Xerxes entering, followed by a fly-whisk bearer and a parasol bearer"}, {"id": "E", "wall": "hall E wall", "at": [123.0, -142.5], "width": 2.0, "jambs": "royal hero stabbing a lion-headed monster / rampant griffin"}, {"id": "W", "wall": "hall W wall", "at": [106.5, -142.5], "width": 2.0, "jambs": "royal hero fighting a lion"}] | m | ISAC-PA;SI-ARCH;REF-PLAN | B | 4 doorways and their reliefs B (extracts, SI-ARCH title 'Eastern Wall of Main Hall, North Jamb ... Royal Hero Stabbing a Rampant Griffin'). Positions from REF-PLAN wall gaps/axes +/-2.5; widths C |
| r_portico_step | {"x": [105.0, 121.5], "y_edge": -125.0, "steps": 3} | m | RECON | C | portico front step band from the court (level difference NOT SEEN, verify) |
| r_entrances | [{"id": "N_passage", "at": [109.5, -73.0], "note": "gap in the N wall at the Hall100 SW corner, reached from the passage of the Tripylon narrow stair"}, {"id": "W_corridor", "at": [99.7, -114.0], "note": "opening from the N-S corridor inside the W wall into the court"}] | m | REF-PLAN;IR-PERS | C | plan gaps (weak, +/-3); connection Tripylon-Harem-Hall100 by a narrow stair is B (extract) |
| r_hall_wall | 1.8 | m | RECON | C | hall wall thickness (C) |
| r_portico_rows_y | [-128.0, -131.8] | m | RECON | C | two portico rows between the front (-125) and the hall N wall (-134.5 - wall): evenly spaced (C) |
| r_entrance_steps | {"steps": 7, "tread": 0.35} |  | RECON | C | steps down from the raised wing floor (1.0) to the court outside each entrance: low risers (~0.14) like the palace stairs (C) |
| r_door_height | 4.0 | m | RECON | C | main hall doorway height, about 2/3 of the 6 m columns (C, NOT SEEN, verify) |
| r_entrance_width | 2.4 | m | RECON | C | width of the enclosure entrances (r_entrances), as the hall N door (C) |

## garrison — state in 467 BCE: **standing**
| parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|
| floor | 0.0 | m | RECON | C |  |
| note | "modest mud-brick rooms near E/SE foot of mountain; OSM label 'guardhouse & hall of 32 columns' (32-column hall absent in 467: RECON)" |  | ISAC-PA | B |  |
| r_wall | {"thickness": 1.2, "height": 4.0} | m | RECON | C | modest mud-brick rooms |
| r_floor_raise | 0.2 | m | RECON | C |  |
| r_doors | [{"at": [183.27, 22.5], "width": 2.4}, {"at": [201.8, -66.3], "width": 2.4}] | m | RECON | C | doorways: W onto the court N of the Hall of 100 Columns; S into the Treasury NE entrance (positions C) |

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
| REF-PLAN | references/Persepolis Plan.webp (user-supplied colour plan, redrawn from Schmidt; provenance uncertain) registered to the grid by tools/plan_check.py references/Persepolis Plan.webp | measured in this project (research/PHASE4_ACCESS.md); ~2.1 px/m; not redistributed |
| REF-SCHMIDT | references/palace-of-darius-i-and-xerxes.webp (black-and-white Schmidt-style Terrace plan, legend A-P, 100 m bar) references/palace-of-darius-i-and-xerxes.webp | measured in this project; ~1.85 px/m; cross-check only |
| SI-ARCH | Smithsonian NMAA Archives: Ernst Herzfeld Papers (FSA.A.06) and Myron Bement Smith Collection (FSA.A.04), Persepolis photograph captions (excavation-era titles), incl. DPLA mirrors https://www.si.edu/object/archives/components/sova-fsa-a-06-ref27137 | search-extract only (titles); si.edu and dp.la blocked |
| FARROKH | K. Farrokh, pages 'The Palace of Xerxes (the Hadis)' and 'The Tachara (Winter Palace) of Persepolis' (reproduce Encyclopaedia Iranica 'Persepolis' text) https://www.kavehfarrokh.com/ancient-prehistory-651-a-d/achaemenids/the-palace-of-xerxes-the-hadis/ | search-extract only; host blocked |
| COMMONS-TRIP | Wikimedia Commons, Category 'Staircase - Persepolis - Tripylon - 5th century BC - National museum of Iran - Inventory number 2012' (description) https://commons.wikimedia.org/wiki/Category:Staircase_-_Persepolis_-_Tripylon_-_5th_century_BC_-_National_museum_of_Iran_-_Inventory_number_2012 | search-extract only (tertiary) |
| BRIT-H100 | Encyclopaedia Britannica, 'Hall of the Hundred Columns' https://www.britannica.com/place/Hall-of-the-Hundred-Columns | search-extract only (tertiary) |
| SG-H100 | StudyGuides.com, 'Hall of One Hundred Columns' ('two meters below the Apadana platform') https://studyguides.com/ | search-extract only; weak tertiary - C at most |
| IRANTOUR-TREAS | irantour.tours, 'Persepolis The Treasury' (paraphrase of Schmidt's Treasury phases) https://www.irantour.tours/iran-cities/shiraz/shiraz-historical-sites/persepolis-the-treasury.html/ | search-extract only; tertiary; verify against Schmidt 1939/1953 |
