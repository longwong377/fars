# Treasury N range and the scribes' room (session 3, D-067): the range of rooms along the inside of the Treasury N wall,
# measured on REF-PLAN resampled into the grid (research/PHASE4_ACCESS.md transform: grid = s R [px, -py] + t,
# s 0.47284 m/px, R rot(-18.51 deg), t (-37.664, 300.563)); the plan fill of the inner walls is read along y -85.5 and
# x/y scan lines (+-0.5 m at ~2.1 px/m). Idempotent. Run: python3 tools/apply_treasury_rooms_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


row('treasury', 'n_range',
    {'inner_face_n': -80.5, 'inner_wall': [-86.4, -84.7], 'x': [143.0, 212.7],
     'hall_doors': [[153.0, 154.1], [168.5, 169.6], [184.0, 185.1], [199.1, 200.4]],
     'cross_walls': [[144.2, 146.0], [159.2, 160.7], [176.4, 178.1], [192.0, 193.8]],
     'e_wall': {'x': [210.7, 212.0], 'door_y': [-83.7, -82.0]},
     'rooms': [[146.0, 159.2], [160.7, 176.4], [178.1, 192.0], [193.8, 210.7]]},
    'm', 'REF-PLAN', 'B',
    'a range of four rooms along the inside of the Treasury N wall, 4.2 m deep, read on REF-PLAN (Schmidt-derived colour '
    'plan, provenance uncertain; +-0.5 m): inner wall S face -86.4, N face -84.7 (the enclosure inner face is -80.5), one '
    'doorway from the S into each room (hall_doors), cross walls between the rooms running the full depth (no doorways seen '
    'in them); the E room is the entrance vestibule of the N door (205.8-207.6) and has a doorway at the N end of its E '
    'wall (door_y) to the space along the E enclosure wall. The inner wall ends at 212.7 (the plan continues an E corridor '
    'S from there and a hypostyle hall S of the range; neither is modelled: C). A thin rectangle drawn in the vestibule '
    '(x 192-203.7, y -82.7..-84.7) is not interpreted (NOT SEEN at the plan\'s resolution)')
row('treasury', 'r_n_range_height', {'clear': 4.5, 'roof': 0.5, 'door_height': 2.6}, 'm', 'RECON', 'C',
    'clear height of the N-range rooms under a flat timber-and-earth roof (roof thickness), and the clear height of their '
    'doorways (C; mud-brick walls and a lintel over each doorway; no stone frames seen on the plan)')
row('treasury', 'scribes_room', {'room': 2, 'desk': [186.8, -83.2], 'desk_heading': 90}, 'm', 'IR-TREAS;REF-PLAN', 'C',
    'the scribes\' room: the PT tablets were found in "a northeastern room of the Treasury" (IR-TREAS, SX, B); which room '
    'is C: the NE room of the N range beside the entrance vestibule (rooms[2], x 178.1-192.0). The desk (where the scribe '
    'sits, grid) is 1.2 m from the S doorway (184.0-185.1) for its daylight, facing grid E (heading deg from grid N, C)')
row('treasury', 'r_scribes_room', {'bench': {'height': 0.45, 'depth': 0.7, 'gap': 0.6}, 'tablet': [0.09, 0.065, 0.025],
                                   'tablets_per_m': 14, 'drying_board': [0.6, 0.35], 'clay_lump': 0.12, 'baskets': 3},
    'm', 'IR-TREAS;MATCULT-R;RECON', 'C',
    'furnishing of the scribes\' room: a mud-brick bench along the N and W walls (gap = free wall at the corners and by the '
    'door) carrying filed tablets in rows (tablets_per_m per row, two rows); PT letters are rectangular tablets '
    '(MATERIAL_CULTURE, NOT SEEN: size C) sealed on the left edge; a board of fresh tablets drying by the desk, a lump of '
    'clay kept moist under a cloth, and reed baskets of tablets on the floor (all C: types from the archive practice, B; '
    'number and arrangement C)')

json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('treasury N range rows written')
