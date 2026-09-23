# Phase 4b spec rows (D-048..D-052): windows and niches, timber door leaves with metal fittings, door states and sealing,
# door-jamb and stair relief programmes of the Tachara, Hadish, Tripylon, Hall of 100 Columns and Harem. Idempotent:
# rows are (re)written by key. Run: python3 tools/apply_phase4b_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


# ---------------- global: openings, doors, sealing, relief sizes ----------------
row('global', 'r_window', {'width_of_door': 0.5, 'sill': 1.2, 'sill_block': 0.25}, 'm', 'WP-EXT;IR-PERS;RECON', 'C',
    'window openings through the wall in monolithic dark-stone frames (Tachara "monolithic door/window/niche frames", WP-EXT C; '
    'Hadish 19 windows, IR-PERS B count). Width half the building\'s main door (C), sill 1.2 m above the floor (C), head level '
    'with the door head so lintels and cornices run level (C); frame = r_door_frame jambs, lintel and cornice plus a sill '
    'block of sill_block (C). Positions and sizes NOT SEEN (Q-087); no glazing (blocklist glass-windows), no shutters modelled')
row('global', 'r_niche', {'depth': 0.5}, 'm', 'WP-EXT;IR-PERS;RECON', 'C',
    'blind niches: window-shaped recesses in the inner wall face with the same frame as the windows (Tachara stone frames, '
    'WP-EXT C; Hadish 4 niches, IR-PERS B count); depth C (Q-087)')
row('global', 'r_door_leaf', {'thickness': 0.12, 'post_r': 0.07, 'bands': 4, 'band_h': 0.08, 'band_t': 0.006,
                              'boss_r': 0.022, 'boss_pitch': 0.2, 'gap': 0.01, 'shoe_h': 0.14, 'swing_s': 1.5, 'reach': 2.2,
                              'bronze_metalness': 0.35, 'boss_range': 40},
    'm', 'WP-EXT;RECON', 'C',
    'timber double-leaf doors of the stone-framed palace doorways (C: analogue of the Gate of All Nations, whose pivot sockets '
    'show two-leaf doors, WP extract C). Each leaf turns on a vertical post (post_r) standing in a stone socket, its foot shod '
    'in bronze (shoe_h; Near Eastern pivot doors, RECOLLECTION); bronze bands across both faces (bands x band_h x band_t; '
    'bronze-banded doors are a Neo-Assyrian analogue, RECOLLECTION, NOT SEEN for Persepolis) studded with bronze bosses '
    '(boss_r at boss_pitch; as gate_nations.r_door_leaves, C). Timber species not known (C). Leaves hang at the inner end of '
    'the passage and swing 180 deg through the hall to lie against the inner wall face (the D-032 Gate rule, C; Q-088), so '
    'the jamb reliefs on the reveals stay visible. swing_s = time to open or close (1.5 s, C); reach = how far a person can '
    'work a leaf from (C). bronze_metalness: the fittings are drawn partly metallic because the renderer has no environment '
    'reflection and full metal reads black in shade (the D-030 precedent for gilding, C); boss_range: bosses are drawn on '
    'leaves within this distance of the camera (a 22 mm stud is under a pixel beyond it, C)')
row('global', 'r_door_sealing', {'height': 1.1, 'knob_r': 0.035, 'lump': [0.11, 0.08, 0.045], 'cord_r': 0.006,
                                 'bar': [0.1, 0.08], 'clay_srgb': [0.56, 0.45, 0.34]}, 'm', 'MATCULT-R;RECON', 'C',
    'fastening of a sealed or barred door: a bronze knob on each leaf at height, a cord wound between them and a clay lump '
    'pressed over the cord and impressed with a seal (sealing practice B: seals rolled on tablets and string, PFA via '
    'MATCULT; sealed labels on Treasury goods C; the peg-and-cord door sealing is a Near Eastern practice, RECOLLECTION, '
    'NOT SEEN at Persepolis: C, Q-089); a timber bar across both leaves on the inside of a barred door (bar section, C); '
    'clay_srgb: unfired clay, the colour of the Treasury storage jars (furnish.ts, C)')
row('global', 'r_door_schedule', {'open': 6.5, 'close': 17.5, 'keeper_look': 60}, 'h', 'RECON', 'C',
    'hours when a scheduled door (Treasury N entrance, Hall of 99 Columns store) stands open; outside them it is barred or '
    'sealed (C; the same working day as the building-site sounds in world.ts). People at the door are let through; the '
    'doorkeeper also lets the visitor through the barred entrance (observer mode: nothing is barred, brief §1; visitor-mode '
    'guards use door.locked); the store keeper does not seal the store while the visitor is inside it (within keeper_look m '
    'beyond the door, C), and a sealed store never opens for the visitor from outside')
row('global', 'r_jamb_relief', {'figure_of_door': 0.4, 'ground': 0.15, 'margin': 0.12, 'depth_factor': 1.2,
                                'attendant_scale': 0.78, 'register_gap': 0.05}, 'm', 'WP-EXT;ISAC-PA;SI-ARCH;RECON', 'C',
    'door-jamb reliefs on the two reveals of a stone-framed doorway: the leading royal figure is figure_of_door x the clear '
    'door height (C; sizes NOT SEEN, verify on Schmidt 1953 plates), standing on a ground line `ground` above the floor, '
    '`margin` clear at each end of the jamb; depth r_relief_depth x depth_factor (within r_relief_carving, C); attendants at '
    'attendant_scale of the king (hierarchic scale, C); figures walk into the hall (C)')
row('global', 'r_stair_relief', {'central_register': 1.4, 'central_ground': 0.3, 'panel_width': 2.4, 'glyph': 0.06,
                                 'line_gap': 0.03, 'guards_per_side': 4, 'bearer_rows': 3},
    'm', 'SI-ARCH;ISAC-PA;IR-PERS;RECON', 'C',
    'Phase 4 stair reliefs: parapet registers are r_stair_parapet.height tall on the outer face of each flight and follow '
    'the slope (C); central facades carry a register of central_register m on a ground line central_ground above the court '
    '(C) with the inscription panel (panel_width, glyph height, line gap as the XPb panel, C) between guards_per_side guards '
    '(C; Q-P4-08 for the Tripylon); throne-bearer scenes have bearer_rows rows of bearers (C)')

# the Gate's leaves become working doors of the door system (D-051); the D-032 'reveal' layout option is gone
gl = spec['gate_nations']['r_door_leaves']
gl['note'] = gl['note'].split(' D-051:')[0].replace('`hang: "reveal"` restores the old layout', 'the old layout (hang "reveal") is no longer built') + \
    '. D-051: the leaves are working doors (doors.ts, global.r_door_leaf fittings; this row keeps their thickness); open by default'

# ---------------- windows and niches (positions: offsets along the wall from the hall centre, m) ----------------
row('tachara', 'r_windows', {'S': [-4.69, 4.69]}, 'm', 'WP-EXT;RECON', 'C',
    'two windows in the hall S wall, one either side of the main doorway, centred in the free wall between the door frame '
    'and the hall corner (C; RECOLLECTION of window frames flanking the Tachara doorway, NOT SEEN; Q-087)')
row('tachara', 'r_niches', {'N': [0.0], 'E': [-3.86, 3.86], 'W': [-3.86, 3.86]}, 'm', 'WP-EXT;RECON', 'C',
    'blind niches on the inner faces of the walls to the side rooms: N wall between the two doorways, E and W walls on the '
    'aisles between the column rows (C; Q-087)')
row('hadish', 'r_windows', {'N': [-11.7, 0.0, 11.7], 'S': [-11.7, -7.8, -3.9, 3.9, 7.8, 11.7]}, 'm', 'IR-PERS;RECON', 'C',
    '9 of the 19 windows (count B) in the hall walls that face the portico (N) and the balcony (S), on the aisle axes between '
    'the column rows (3.9 m pitch) where the door frames leave room (C). The other 10 belong to the apartments, which are '
    'not modelled (C; Q-087)')
row('hadish', 'r_niches', {'E': [-7.8, 7.8], 'W': [-7.8, 7.8]}, 'm', 'IR-PERS;RECON', 'C',
    'the 4 niches (count B) in the hall walls to the E and W apartments, either side of the apartment doorways on the aisle '
    'axes (positions C; Q-087)')

# ---------------- door states ----------------
OPEN_NOTE = 'palace doors stand open by day and can be closed; people open a closed door as they pass (C, D-051)'
row('gate_nations', 'r_door_state', {'W': 'open', 'E': 'open', 'S': 'open'}, '', 'RECON', 'C', OPEN_NOTE)
row('apadana', 'r_door_state', {'N': 'open', 'W': 'open', 'E': 'open', 'S': 'open'}, '', 'RECON', 'C',
    OPEN_NOTE + '; leaves as global.r_door_leaf (C); no jamb reliefs found for the Apadana hall doorways (left plain)')
row('tachara', 'r_door_state', {'S_main': 'open', 'N_W': 'open', 'N_E': 'open'}, '', 'RECON', 'C', OPEN_NOTE)
row('hadish', 'r_door_state', {'N_W': 'open', 'N_E': 'open', 'S': 'open', 'E': 'open', 'W': 'open'}, '', 'RECON', 'C', OPEN_NOTE)
row('harem', 'r_door_state', {'N': 'open', 'S': 'open', 'E': 'open', 'W': 'open'}, '', 'RECON', 'C', OPEN_NOTE)
row('tripylon', 'r_door_state', {}, '', 'CHRON-C;RECON', 'C',
    'no leaves hung: under construction in 467 (walls at half height, no roof); joinery is fitted last (C)')
row('hall100', 'r_door_state', {}, '', 'CHRON-C;RECON', 'C',
    'no leaves hung: under construction in 467 (walls at a third of their height, no roof) (C)')
row('treasury', 'r_door_state', {'N': 'scheduled_locked', 'E': 'sealed', 'hall99': 'scheduled_sealed'}, '', 'IRANTOUR-TREAS;MATCULT-R;RECON', 'C',
    'N: the working entrance in 467 (entrances_history, C), open in working hours (global.r_door_schedule) and barred at '
    'night; E: a secondary door in the outer wall (REF-PLAN gap, C) kept barred and sealed; hall99: the store of the '
    'Hall of 99 Columns, open while the store staff work (people place treasury_store) and sealed with clay outside working '
    'hours (C; sealing global.r_door_sealing, Q-089). Barred and sealed doors do not open for the visitor; door.id and '
    'door.locked are the hooks for visitor-mode guards')

row('treasury', 'r_door_height', 4.5, 'm', 'RECON', 'C',
    'clear height of the enclosure doorways N and E (as the Hall of 99 Columns doorway, r_hall99_walls, C); the brick wall '
    'closes over them (the doorway gaps ran to the wall top before, D-051)')

# ---------------- relief programmes ----------------
row('tripylon', 'relief_state_467', 'carved', '', 'IR-PERS;SI-ARCH;RECON', 'C',
    'stair and jamb reliefs carved and painted by 467 although the brickwork is unfinished (C): the Tripylon is dated to '
    'Darius I by Iranica (extract, B) and its E-jamb king is captioned "Darius I" with crown prince Xerxes (SI-ARCH, B), which '
    'would put the carving before 486; stone members were set and carved before the mud brick rose (D-015, C). Contested '
    '(Xerxes / Artaxerxes I dating, LIVIUS): Q-086')
row('hall100', 'relief_state_467', 'blocked_out', '', 'ISAC-PA;IR-PERS;RECON', 'C',
    'jamb reliefs blocked out, not finished: the outlines cut back and the masses roughed out, no detail, no paint (C). The '
    'hall was begun by Xerxes and completed by Artaxerxes I (ISAC-PA, B) and in 467 its shafts are ~30% raised '
    '(construction_state, C); the finished programme is attested (door_reliefs, B), its carving date is not. The roughed-out '
    'stage follows the Unfinished Gate figures (RECOLLECTION, NOT SEEN). Q-086')
row('tachara', 'door_jamb_reliefs', {
    'S_main': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'B', 'note': 'king with attendants on the main doorway (WP-EXT, B); a parasol- and a fly-whisk-bearer (C, as on the Harem S door)'},
    'N_W': {'programme': 'hero', 'beasts': ['lion', 'monster'], 'tier': 'B', 'note': 'royal hero vs lion / monster (WP-EXT, B); which doorway and jamb C'},
    'N_E': {'programme': 'attendants', 'props': ['towel', 'flask'], 'tier': 'B', 'note': 'attendants with towel and perfume flask (ISAC-PA, WP-EXT: B); which doorway C'}},
    '', 'WP-EXT;ISAC-PA;RECON', 'B/C',
    'jamb programme of the Tachara doorways (B motifs; assignment to the modelled doorways C). The lance-bearers with wicker '
    'shields of the W rooms (B) have no modelled doorway (the hall W wall has none in the model) and are not placed')
row('hadish', 'door_jamb_reliefs', {
    'N_W': {'programme': 'king', 'attendants': ['parasol', 'towel'], 'tier': 'B', 'note': 'king with parasol- and towel-bearers, labelled "Darius the king" (FARROKH/SI-ARCH, B)'},
    'N_E': {'programme': 'king', 'attendants': ['parasol', 'towel'], 'tier': 'C', 'note': 'NOT FOUND: reconstructed as the NW doorway (C, analogue)'},
    'E': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'B', 'note': 'king and attendants with XPe above (SI-ARCH, B); XPe is not in inscriptions.json and is not carved (C)'},
    'W': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'C', 'note': 'XPe on the W doorway (FARROKH, B); the figures reconstructed as the E doorway (C, analogue)'},
    'S': {'programme': 'plain', 'tier': 'C', 'note': 'no programme found for the balcony doorway: left plain'}},
    '', 'FARROKH;SI-ARCH;RECON', 'B/C', 'jamb programme of the Hadish hall doorways')
row('tripylon', 'door_jamb_reliefs', {
    'E': {'programme': 'throne_bearers', 'tier': 'B', 'note': 'king (Darius I) with the crown prince (Xerxes) on a throne carried by representatives of the nations (SI-ARCH, B); rows and count C'},
    'S': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'B', 'note': 'king and attendants (SI-ARCH, B); attendant props C'},
    'N': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'B', 'note': 'king with attendants (extract, B; which jamb C)'}},
    '', 'SI-ARCH;REF-PLAN;RECON', 'B/C', 'jamb programme of the Tripylon doorways (carving state: relief_state_467)')
row('hall100', 'door_jamb_reliefs', {
    'N': {'programme': 'throne_guards', 'registers': 5, 'tier': 'B', 'note': 'throne/audience scene with the king enthroned (BRIT-H100, B); registers of guards below: "5 registers" NOT SEEN (C)'},
    'S': {'programme': 'throne_bearers', 'tier': 'B', 'note': 'king enthroned, throne borne by representatives of the subject nations (B); rows C'},
    'E': {'programme': 'hero', 'beasts': ['lion', 'bull', 'monster'], 'tier': 'B', 'note': 'royal hero in combat with lion / bull / monster (B)'},
    'W': {'programme': 'hero', 'beasts': ['lion', 'bull', 'monster'], 'tier': 'B', 'note': 'royal hero in combat with lion / bull / monster (B)'}},
    '', 'BRIT-H100;IR-PERS;ISAC-PA', 'B', 'jamb programme of the eight doorways (both doors of a wall share it; carving state: relief_state_467)')
row('harem', 'door_jamb_reliefs', {
    'S': {'programme': 'king', 'attendants': ['whisk', 'parasol'], 'tier': 'B', 'note': 'Xerxes entering, followed by a fly-whisk bearer and a parasol bearer (ISAC-PA, B)'},
    'E': {'programme': 'hero', 'beasts': ['monster'], 'tier': 'B', 'note': 'royal hero stabbing a lion-headed monster / rampant griffin (ISAC-PA, SI-ARCH: B); monster form C'},
    'W': {'programme': 'hero', 'beasts': ['lion'], 'tier': 'B', 'note': 'royal hero fighting a lion (ISAC-PA, B)'},
    'N': {'programme': 'king', 'attendants': ['whisk', 'parasol'], 'tier': 'C', 'note': 'NOT SEEN ("probably king with attendants"): reconstructed as the S doorway (C, analogue)'}},
    '', 'ISAC-PA;SI-ARCH;RECON', 'B/C', 'jamb programme of the Harem hall doorways')

open(P, 'w').write(json.dumps(spec, indent=1, ensure_ascii=False) + '\n')
print('phase 4b rows written')
