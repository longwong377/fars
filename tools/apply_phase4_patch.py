"""Apply research/_phase4_spec_patch.json to src/data/site_spec.json (Phase 4, session 2), plus the other session-2 spec
fixes (render-only thicknesses that were generator literals, the garrison W door move). Re-run from a clean spec.
Rows are copied as proposed, except: patch keys that collide with existing rows of a different meaning are renamed
(`portico` -> `portico_layout`), `floor` rows marked "unchanged" are skipped, and a few derived reconstruction rows the
generator needs are added (each C, with its derivation in the note). New source keys go into src/data/sources.json.
Idempotent: re-running overwrites the same keys."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec_p, src_p, patch_p = ROOT / 'src/data/site_spec.json', ROOT / 'src/data/sources.json', ROOT / 'research/_phase4_spec_patch.json'
spec, sources, patch = json.loads(spec_p.read_text()), json.loads(src_p.read_text()), json.loads(patch_p.read_text())
RENAME = {('hadish', 'portico'): 'portico_layout', ('harem', 'portico'): 'portico_layout'}
for b, rows in patch.items():
    if b.startswith('_') or b in ('unfinished_gate', 'access_graph'): continue
    for k, r in rows.items():
        if k == 'floor' and 'unchanged' in r.get('note', ''): continue
        spec[b][RENAME.get((b, k), k)] = r
spec['global']['r_access_graph'] = patch['access_graph']
R = lambda v, u, note, src='RECON', tier='C': {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}
# ---- derived / reconstruction rows the generator needs (C unless stated) ----
spec['tachara']['r_hall_centre_y'] = R(-80.0, 'm', 'hall centre between the S main doorway (y -88) and the N doorway pair (y -72) read on REF-PLAN (doors row); replaces r_hall_offset_n, which left the N rooms only ~6 m deep', 'REF-PLAN', 'C')
if 'SUPERSEDED' not in spec['tachara']['r_hall_offset_n']['note']: spec['tachara']['r_hall_offset_n']['note'] += ' [SUPERSEDED in Phase 4 by r_hall_centre_y; unused]'
spec['global']['r_stair_parapet'] = R({'thickness': 0.3, 'height': 0.9, 'open_steps': 5}, 'm', 'outer parapet of the Phase-4 palace stairs: 0.3 m (patch flight notes), height as the Apadana stair parapet order of magnitude; the first open_steps steps at each flight foot are left open so the flight can be entered from the side (C)')
spec['hadish']['r_hall_wall'] = R(2.8, 'm', 'hall wall thickness (was r_wall; unchanged value)')
spec['tripylon']['r_n_portico'] = R({'x': [79.0, 84.0], 'y': -56.5}, 'm', '2-column N portico, columns read on REF-PLAN (PHASE4_ACCESS §5)', 'REF-PLAN', 'B')
spec['tripylon']['r_e_corridor'] = R({'x': [91.5, 99.5], 'y': [-74.2, -70.2], 'landing_y': [-74.2, -65.0]}, 'm', 'corridor from the E doorway (89.5, -72.2) to the head of the narrow E stair, at floor level; landing strip at the stair head down to where the 7 m flight ends (the flight run 20 x 0.35 is shorter than the 13 m zone). Width = E door +/- ~1.3 m')
spec['tripylon']['r_stair_e_start_level'] = R(0.0, 'm', 'the narrow E stair starts at the court (0): the proposed foot level 0.5 has no source and no passage floor is modelled, so its 20 risers become 2.6/20 = 0.13 (C)')
spec['tripylon']['r_stair_s_flight'] = R({'x': 82.0, 'top_y': -102.0, 'steps': 26, 'riser': 0.1, 'tread': 0.3, 'width': 2.4}, 'm', 'small S stair: from the S court edge (s_portico_court) down S to the area E of the Hadish (0); dimensions as the N flights (C, NOT SEEN, verify)')
if 'Phase 4' not in spec['tripylon']['r_column_built']['note']: spec['tripylon']['r_column_built']['note'] += ' (Phase 4: hall now 15.46 m, row hall)'
spec['hall100']['r_portico_extent'] = R({'front_y': 27.0, 'towers_x': [[105.0, 115.0], [175.0, 185.0]]}, 'm', 'portico N edge ~y 27 and antae towers x 105..115 / 175..185 read on REF-PLAN (r_portico_step note)', 'REF-PLAN', 'B')
spec['hall100']['r_step_tread'] = R(0.35, 'm', 'tread of the portico step band and door thresholds (C)')
spec['hall100']['r_threshold_steps'] = R(3, 'steps', 'external steps down from the raised floor at the W, E and S doorways so they are walkable both ways (C, NOT SEEN, verify)')
spec['harem']['r_hall_wall'] = R(1.8, 'm', 'hall wall thickness (C)')
spec['harem']['r_portico_rows_y'] = R([-128.0, -131.8], 'm', 'two portico rows between the front (-125) and the hall N wall (-134.5 - wall): evenly spaced (C)')
spec['harem']['r_entrance_steps'] = R({'steps': 7, 'tread': 0.35}, '', 'steps down from the raised wing floor (1.0) to the court outside each entrance: low risers (~0.14) like the palace stairs (C)')
spec['global']['r_floor_finish'] = R(0.01, 'm', 'render-only thickness of the plaster floor coat drawn over hall floors (the attested coat is ~2 cm white + ≤1.5 mm red; flooring-plaster study 2022, search extract); not collidable')
fr = spec['gate_nations']['r_frieze']; fr['v'].update({'thickness': 0.06, 'offset': 0.03})
if 'thickness' not in fr['note']: fr['note'] += '; band thickness 0.06 and offset 0.03 from the wall face (render, C; were literals in the generator before session 2)'
gd = spec['garrison']['r_doors']
if gd['v'][0]['at'] == [183.27, 22.5]:
    gd['v'][0]['at'] = [183.27, 32.0]; gd['note'] += '; W door moved from y 22.5 to 32 in Phase 4: the Hall of 100 Columns portico and its E anta tower (REF-PLAN) now occupy y 8.3..27 there (C)'
spec['global']['r_door_frame'] = R({'jamb': 0.6, 'projection': 0.08, 'lintel': 0.8, 'cornice_height': 0.35, 'cornice_projection': 0.12}, 'm', 'stone door frames: jambs lining the opening, lintel and a projecting cornice block (the cavetto "Egyptian" cornice of Persepolis doorways: NOT SEEN, verify). Frames of polished stone are reported for the Tachara (tachara.stone_frames, WP-EXT, C); elsewhere C. In unfinished buildings the frames stand complete above the low walls: stone elements were set before the mud brick (C). Sizes C')
spec['tripylon']['r_door_height'] = R(6.0, 'm', 'doorway height about 2.2 x width (tripylon.doors note; C)')
spec['treasury']['r_hall99_walls'] = R({'thickness': 2.0, 'door_width': 3.0, 'door_height': 4.5, 'roof': 0.6}, 'm', 'walls, N doorway and timber roof of the Hall of 99 Columns (a roofed hall: hall99, ISAC-PA B; wall line one bay outside the column grid, door on the axis facing the N entrance, sizes C)')
spec['treasury']['r_benches'] = R({'height': 0.5, 'depth': 0.8, 'gap': 1.0}, 'm', 'mud-brick benches along the inner walls of the hall carrying stored goods (arrangement C); gap = free wall length left at each corner and beside the door')
spec['treasury']['stored_goods'] = R([
  {'item': 'alabaster_vessel', 'share': 0.4, 'note': 'Egyptian calcite (alabaster) bowls and bottles, some inscribed (ISAC-FINDS, B)'},
  {'item': 'blue_vessel', 'share': 0.1, 'note': 'vessels of Egyptian-blue compound (ISAC-FINDS, B)'},
  {'item': 'chert_set', 'share': 0.2, 'note': 'green-chert mortars, pestles and plates with Aramaic ink texts (ISAC-FINDS, B)'},
  {'item': 'arrow_bundle', 'share': 0.2, 'note': 'bundles of bronze-tipped arrows; arrowheads and scabbard tips by the hundred among the finds (ISAC-FINDS, B; bundling C)'},
  {'item': 'sealed_jar', 'share': 0.1, 'note': 'jars sealed with clay labels (sealed labels on stored goods: C, verify in Schmidt Persepolis II)'}], '', 'what the Treasury held (types B, search extracts of ISAC Contents of the Treasury); quantities and placement C', 'ISAC-FINDS', 'B')
spec['harem']['r_door_height'] = R(4.0, 'm', 'main hall doorway height, about 2/3 of the 6 m columns (C, NOT SEEN, verify)')
spec['harem']['r_entrance_width'] = R(2.4, 'm', 'width of the enclosure entrances (r_entrances), as the hall N door (C)')
if 'SUPERSEDED' not in spec['treasury']['r_doors']['note']: spec['treasury']['r_doors']['note'] += ' [SUPERSEDED in Phase 4 by doors (REF-PLAN): this point lies in the street N of the Treasury]'
for k, s in patch['_sources_new'].items(): sources[k] = s
sources.setdefault('ISAC-FINDS', {'cite': "ISAC Photographic Archives, 'Miscellaneous finds' / 'Contents of the Treasury' (Schmidt, Persepolis II)", 'url': 'https://isac.uchicago.edu/collections/photographic-archives/persepolis/miscellaneous-finds', 'access': 'search-extract only; page not verified (MATERIAL_CULTURE.md)'})
spec_p.write_text(json.dumps(spec, indent=1, ensure_ascii=False) + '\n')
src_p.write_text(json.dumps(sources, indent=1, ensure_ascii=False) + '\n')
print('applied; rows now:', {b: len(spec[b]) for b in ('tachara', 'hadish', 'tripylon', 'hall100', 'harem', 'treasury')})
