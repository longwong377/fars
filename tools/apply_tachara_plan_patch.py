# Tachara plan from REF-PLAN (session 3, D-130): the walls, doorways, windows, niches, columns and rooms of the Palace of
# Darius measured on REF-PLAN resampled into the grid (research/PHASE4_ACCESS.md transform: grid = s R [px, -py] + t,
# s 0.47284 m/px, R rot(-18.51 deg), t (-37.664, 300.563)), bilinear, 0.02 m steps. A wall face is where R+G+B crosses
# 392, half-way between the yellow floor (~545) and the olive wall fill (~239): wall faces are medians over 3-12 scan
# lines across the wall; openings are the runs above 392 along the wall's centre line (doorways, windows: the whole
# thickness; niches: on one face only, the wall's middle staying dark); columns are the tone-weighted centroids of the
# dark dots. The plan is ~2.1 px/m and of uncertain provenance (Schmidt-derived colour plan): +-0.5 m (tier B).
# Idempotent. Run: python3 tools/apply_tachara_plan_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))
T = spec['tachara']


def row(k, v, u, src, tier, note):
    T[k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


def supersede(k, why):
    tag = '[SUPERSEDED by ' + why + '; unused] '
    if not T[k]['note'].startswith('[SUPERSEDED'):
        T[k]['note'] = tag + T[k]['note']


# ---- walls: axis-aligned rectangles between measured faces (x = grid east, y = grid north). Where two walls meet, the
# through wall keeps the junction; the S ends stop at the building front of the S stair zone (y -99.2, stair_s_zone)
W = lambda i, x, y: {'id': i, 'x': x, 'y': y}
walls = [
    W('N_outer', [-36.5, -6.7], [-59.85, -58.25]),     # N outer wall (the Apadana's S side lies 1.6 m N of it)
    W('W_outer_N', [-36.5, -35.6], [-71.4, -59.85]),   # outer walls of the N part are ~1.0 m, of the S part ~1.45 m
    W('E_outer_N', [-7.7, -6.7], [-71.4, -59.85]),
    W('N_line', [-36.5, -6.7], [-72.85, -71.4]),       # hall N wall, running on to the outer walls
    W('W_outer_S', [-36.5, -35.05], [-99.2, -72.85]),
    W('E_outer_S', [-8.05, -6.7], [-99.2, -72.85]),
    W('S_line', [-35.05, -8.05], [-90.05, -88.55]),    # hall S wall, running on between the outer walls
    W('hall_W', [-31.0, -29.5], [-88.55, -72.85]),
    W('portico_W', [-31.0, -29.5], [-99.2, -90.05]),
    W('hall_E', [-13.6, -12.1], [-88.55, -75.9]),
    W('hall_E_N', [-13.6, -12.75], [-75.9, -72.85]),   # the hall E wall is thinner beside the E1 room
    W('portico_E', [-13.6, -12.1], [-99.2, -90.05]),
    W('W_x1', [-35.05, -31.0], [-77.8, -77.0]),        # cross walls of the W and E strips
    W('W_x2', [-35.05, -31.0], [-85.3, -84.5]),
    W('E_x1', [-12.1, -8.05], [-76.75, -75.9]),
    W('E_x2', [-12.1, -8.05], [-85.0, -84.3]),
    W('SW_front', [-35.05, -31.0], [-99.2, -98.0]),    # S walls of the rooms either side of the portico
    W('SE_front', [-12.1, -8.05], [-99.2, -98.0]),
    W('NW_thin', [-33.45, -32.7], [-71.4, -59.85]),    # thinner walls of the N part (drawn as lighter lines)
    W('NWR_E', [-23.2, -22.4], [-71.4, -59.85]),
    W('NER_W', [-20.85, -20.0], [-71.4, -59.85]),
    W('NER_E', [-10.5, -9.85], [-71.4, -59.85]),
    W('NW_part', [-35.6, -33.45], [-63.95, -63.1]),    # partitions across the narrow N rooms
    W('NE_part', [-9.85, -7.7], [-63.65, -63.0]),
    W('C_part', [-22.4, -20.85], [-65.75, -65.35]),
]
row('plan_walls', walls, 'm', 'REF-PLAN', 'B',
    'walls of the Tachara read on REF-PLAN (+-0.5 m): x/y = the measured faces of each wall (grid). The hall walls are '
    '~1.5 m thick (the model\'s 2.4 m r_wall was C), the outer walls ~1.45 m in the S part and ~1.0 m in the N part, the '
    'walls of the N rooms 0.75-0.85 m, the partitions 0.4-0.85 m. Uninterpreted: a second outline 0.5 m outside the E '
    'outer wall of the S part (x -6.4..-5.7; a platform or pavement edge?), and the step in the outline E of the building '
    'at y -71 (Q-180)')

# ---- openings: doorways (door = stone-framed with timber leaves, gap = plain opening under a lintel), windows (through
# the wall) and blind niches (in one face). `at` = centre along the wall (x for E-W walls, y for N-S walls), width =
# the run above the threshold along the wall's centre line (doorways, windows) or along the face (niches); `side` =
# the side the door leaves open to and the jamb figures walk toward (doorways), or the face a niche is cut in; `h` = the
# height class in r_doors (C)
O = lambda i, wall, at, w, kind, side, h, **k: {'id': i, 'wall': wall, 'at': at, 'width': w, 'kind': kind, 'side': side, 'h': h, **k}
openings = [
    O('S_main', 'S_line', -21.5, 1.4, 'door', 'N', 'S'),          # main doorway, portico to hall (1.38 through)
    O('win_SW', 'S_line', -27.8, 0.95, 'window', 'N', 'S'),       # four windows in the hall S wall, between the columns
    O('win_SWc', 'S_line', -24.8, 0.95, 'window', 'N', 'S'),
    O('win_SEc', 'S_line', -18.2, 0.9, 'window', 'N', 'S'),
    O('win_SE', 'S_line', -15.1, 0.95, 'window', 'N', 'S'),
    O('N_W', 'N_line', -24.9, 1.3, 'door', 'S', 'N'),             # hall to the NW four-column room
    O('N_E', 'N_line', -18.25, 1.3, 'door', 'S', 'N'),            # hall to the NE four-column room
    O('E1_N', 'N_line', -11.9, 1.0, 'gap', 'S', 'inner'),         # E1 to the NE four-column room
    O('niche_NW', 'N_line', -28.0, 0.8, 'niche', 'S', 'side'),    # niches in the hall face of the N wall
    O('niche_N', 'N_line', -21.7, 0.9, 'niche', 'S', 'side'),
    O('niche_NE', 'N_line', -15.2, 1.0, 'niche', 'S', 'side'),
    O('W_N', 'hall_W', -74.95, 1.35, 'door', 'E', 'side'),        # hall to the W rooms W1 and W2
    O('W_S', 'hall_W', -82.8, 1.3, 'door', 'E', 'side'),
    O('niche_W1', 'hall_W', -78.85, 1.05, 'niche', 'E', 'side'),
    O('niche_W2', 'hall_W', -86.8, 1.1, 'niche', 'E', 'side'),
    O('P_W', 'portico_W', -91.95, 0.95, 'door', 'E', 'portico'),  # portico to the SW room
    O('niche_PW', 'portico_W', -96.3, 0.95, 'niche', 'E', 'portico'),
    O('E_S', 'hall_E', -82.7, 1.4, 'door', 'W', 'side'),          # hall to E2
    O('niche_E1', 'hall_E', -78.75, 1.05, 'niche', 'W', 'side'),
    O('niche_E2', 'hall_E', -86.65, 1.15, 'niche', 'W', 'side'),
    O('niche_EN', 'hall_E_N', -74.7, 0.95, 'niche', 'W', 'side'), # read as a niche, not a doorway (Q-181)
    O('P_E', 'portico_E', -91.9, 1.0, 'door', 'W', 'portico'),    # portico to the SE room
    O('niche_PE', 'portico_E', -96.1, 1.0, 'niche', 'W', 'portico'),
    O('W3', 'W_x2', -33.8, 1.0, 'gap', 'S', 'inner'),             # W2 to W3
    O('E3', 'E_x2', -9.4, 0.95, 'gap', 'S', 'inner'),             # E2 to E3
    O('NW_side', 'NW_thin', -69.95, 1.2, 'gap', 'W', 'inner'),    # NW room to its narrow W room
    O('corridor', 'NER_W', -69.95, 1.0, 'gap', 'W', 'inner'),     # NE room to the corridor between the N rooms
    O('NE_side', 'NER_E', -69.75, 1.1, 'gap', 'E', 'inner'),      # NE room to its narrow E room
    O('NW_part', 'NW_part', -34.55, 0.9, 'gap', 'N', 'inner'),
    O('NE_part', 'NE_part', -8.8, 0.85, 'gap', 'N', 'inner'),
    O('C_part', 'C_part', -21.6, 0.8, 'gap', 'N', 'inner'),
    O('A3_W', 'W_outer_S', -75.0, 1.35, 'gap', 'E', 'inner', present_467=False),  # Artaxerxes III's W doorway: not built
]
row('plan_openings', openings, 'm', 'REF-PLAN;WP-EXT;RECON', 'B/C',
    'doorways, windows and niches read on REF-PLAN (positions and widths B, +-0.5 m; narrow openings read narrower than '
    'they are, as the plan blurs a gap under ~2 px). Doorways reach floor tone through the whole wall; the niches lighten '
    'one face only. The hall has the S main doorway, four windows beside it (the model had two), two N doorways on the '
    'aisles (at -24.9 and -18.25, not the model\'s -27.3 / -15.3), two W doorways, one E doorway, and seven niches on the '
    'aisles; the portico has a doorway into each corner room. Which doorways have stone frames and leaves (door) and which '
    'are plain openings under a lintel (gap) is C: frames on the doorways of the hall and the portico (the Tachara\'s '
    '"monolithic door/window/niche frames", WP-EXT C), plain openings between the small rooms, where a 0.6 m jamb does '
    'not fit. A3_W: the plan has a doorway through the outer W wall facing the ghosted NW stair of Artaxerxes III (A3Pa, '
    'stair_w_present_467 = false); it belongs with that stair and is not built in 467 (C). The partial gap in the hall E '
    'wall at y -74.7 is read as a niche (Q-181). Heights: r_doors (C)')
row('plan_columns', {'hall': {'x': [-26.4, -23.25, -20.05, -16.85], 'y': [-76.85, -80.75, -84.65]},
                     'portico': {'x': [-26.35, -23.1, -20.0, -16.75], 'y': [-94.0, -97.85]},
                     'n_rooms': {'x': [[-29.55, -26.35], [-16.9, -13.65]], 'y': [-63.7, -67.6]}}, 'm', 'REF-PLAN', 'B',
    'column centres read on REF-PLAN (tone-weighted centroids of the column dots, +-0.5 m): the hall has 4 columns across '
    '(grid E-W, pitch 3.2 m) in 3 rows (pitch 3.9 m), in line with the 4 x 2 portico; the model had them 3 across and 4 '
    'deep on a 5.05 m pitch (hall_columns [3, 4] read the other way, Q-182). Each N room has 4 columns (2 x 2). The '
    'portico rows are 1.5 m further S than the model\'s r_portico_gap / r_portico_row_spacing (C) put them')
R = lambda i, x, y, note: {'id': i, 'x': x, 'y': y, 'note': note}
rooms = [
    R('hall', [-29.5, -13.6], [-88.55, -72.85], '12-column hall, 15.9 x 15.7 m between the plan faces'),
    R('portico', [-29.5, -13.6], [-99.2, -90.05], '8-column portico, open to the S stair'),
    R('W1', [-35.05, -31.0], [-77.0, -72.85], 'W room entered from the hall (lance-bearers on the jambs)'),
    R('W2', [-35.05, -31.0], [-84.5, -77.8], 'W room entered from the hall (lance-bearers on the jambs)'),
    R('W3', [-35.05, -31.0], [-88.55, -85.3], 'small room entered from W2'),
    R('SW', [-35.05, -31.0], [-98.0, -90.05], 'room W of the portico'),
    R('E1', [-12.75, -8.05], [-75.9, -72.85], 'small room entered from the NE room'),
    R('E2', [-12.1, -8.05], [-84.3, -76.75], 'E room entered from the hall'),
    R('E3', [-12.1, -8.05], [-88.55, -85.0], 'small room entered from E2'),
    R('SE', [-12.1, -8.05], [-98.0, -90.05], 'room E of the portico'),
    R('NW_room', [-32.7, -23.2], [-71.4, -59.85], 'NW four-column room'),
    R('NE_room', [-20.0, -10.5], [-71.4, -59.85], 'NE four-column room'),
    R('corridor', [-22.4, -20.85], [-71.4, -59.85], 'narrow room between the N rooms, entered from the NE room; a partition with an opening at y -65.5 (a stair to the roof? NOT SEEN, Q-183)'),
    R('NW_side', [-35.6, -33.45], [-71.4, -59.85], 'narrow room W of the NW room, a partition with an opening at y -63.5'),
    R('NE_side', [-9.85, -7.7], [-71.4, -59.85], 'narrow room E of the NE room, a partition with an opening at y -63.3'),
]
row('plan_rooms', rooms, 'm', 'REF-PLAN', 'B',
    'rooms of the Tachara between the plan_walls faces (REF-PLAN, +-0.5 m): the hall and portico, four rooms along each '
    'side, two four-column rooms N of the hall with narrow rooms beside them and a narrow room between them. Their use is '
    'not known (C); the room notes only say how each is entered on the plan')
row('r_doors', {'S': {'height': 5.5}, 'N': {'height': 4.5}, 'side': {'height': 4.5}, 'portico': {'height': 3.5}, 'inner': {'height': 2.6}},
    'm', 'RECON', 'C',
    'clear door heights by class (widths are measured, plan_openings): S = the main doorway, N = the hall N doorways, side '
    '= the hall W and E doorways (as N), portico = the doorways from the portico to the corner rooms (0.95-1.0 m wide; '
    'height C), inner = the plain openings between the small rooms (lintel height as the Treasury N range, C). Windows and '
    'niches: head at the height of their class (windows S, as D-050), sill global.r_window.sill (C)')
row('r_door_state', {'S_main': 'open', 'N_W': 'open', 'N_E': 'open', 'W_N': 'open', 'W_S': 'open', 'E_S': 'open', 'P_W': 'open', 'P_E': 'open'},
    '', 'RECON', 'C', 'palace doors stand open by day and can be closed; people open a closed door as they pass (C, D-051); '
    'every stone-framed doorway of plan_openings has a pair of leaves')
row('door_jamb_reliefs', {
    'S_main': {'programme': 'king', 'attendants': ['parasol', 'whisk'], 'tier': 'B', 'note': 'king with attendants on the main doorway (WP-EXT, B); a parasol- and a fly-whisk-bearer (C, as on the Harem S door)'},
    'N_W': {'programme': 'hero', 'beasts': ['lion', 'monster'], 'tier': 'B', 'note': 'royal hero vs lion / monster (WP-EXT, B); which doorway and jamb C'},
    'N_E': {'programme': 'attendants', 'props': ['towel', 'flask'], 'tier': 'B', 'note': 'attendants with towel and perfume flask (ISAC-PA, WP-EXT: B); which doorway C'},
    'W_N': {'programme': 'lance_bearers', 'tier': 'B', 'note': 'lance-bearers with wicker shields on the doorways of the W rooms (WP-EXT, ISAC-PA: B); one figure per jamb C'},
    'W_S': {'programme': 'lance_bearers', 'tier': 'B', 'note': 'lance-bearers with wicker shields on the doorways of the W rooms (WP-EXT, ISAC-PA: B); one figure per jamb C'},
    'P_W': {'programme': 'lance_bearers', 'tier': 'B', 'note': 'the SW room is a W room too (W of the portico): lance-bearers (B motif; that this doorway is meant C)'},
    'E_S': {'programme': 'attendants', 'props': ['towel', 'flask'], 'tier': 'C', 'note': 'attendants with towel and perfume flask belong to the chambers (doors note, extract); the E rooms as chambers is C'}},
    '', 'WP-EXT;ISAC-PA;RECON', 'B/C',
    'jamb programme of the Tachara doorways (motifs B; assignment to the doorways of plan_openings C, except the king on '
    'the main doorway and the lance-bearers on the W-room doorways). The portico\'s E doorway (P_E) is left plain: no '
    'programme found (D-049 rule). Figures walk into the hall or portico (the doorway side)')

# ---- existing rows: evidence updated, superseded rows marked
T['north_rooms'].update({'src': 'WP-EXT;REF-PLAN', 'tier': 'B', 'note': 'two rooms of 4 columns (2 x 2) N of the hall on REF-PLAN (plan_rooms NW_room, NE_room; D-130)'})
T['hall_columns']['note'] = '12 columns; on REF-PLAN 4 across (grid E-W) x 3 deep, in line with the portico (plan_columns; Q-182)'
T['hall_size']['note'] = 'suspect vs 3x4 grid (conflict C-7); REF-PLAN 15.9 x 15.7 between the wall faces, within its +-0.5 m per face (plan_rooms hall, used by the model; Q-008)'
T['stair_w_present_467']['note'] = T['stair_w_present_467']['note'].split(' The outer W doorway')[0].rstrip('. ') + \
    '. The outer W doorway at y -75 on REF-PLAN faces this stair and is not built either (plan_openings A3_W, D-130)'
for k, why in [('doors', 'plan_openings (D-130)'), ('r_windows', 'plan_openings (D-130)'), ('r_niches', 'plan_openings (D-130)'),
               ('r_hall_centre_y', 'plan_rooms (D-130)'), ('r_wall', 'plan_walls (D-130)'), ('r_portico_gap', 'plan_columns (D-130)'),
               ('r_portico_row_spacing', 'plan_columns (D-130)')]:
    supersede(k, why)
T['r_roof']['note'] = 'roof slab (C): one flat timber-and-earth roof over the whole building at the column tops (D-130: the ' \
    'side and N rooms are roofed with the hall and portico); only thickness is used (extend_s / offset_n: superseded)'

json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('tachara plan rows written')
