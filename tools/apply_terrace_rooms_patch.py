# The Terrace's unbuilt interiors (session 10, D-276): the room ranges of the Treasury beyond the Hall of 99 Columns and the
# N range, the Harem's apartments and service rooms beyond its main hall, the garrison's quarters, and the royal guard's
# mess. Positions read on REF-PLAN resampled into the grid (research/PHASE4_ACCESS.md transform: grid = s R [px, -py] + t,
# s 0.47284 m/px, R rot(-18.51 deg), t (-37.664, 300.563); the plan's wall fill read at ~2.1 px/m, +-1 m) where the plan
# draws walls; the rest reconstruction by analogy (C). A range is a block of rooms in a row (src/arch/rooms.ts): outer faces
# x, y; split along `axis` at the cross-wall centrelines `cuts` (or into `n` equal rooms); each room's doorway on the `door`
# side (units[i] overrides a room's use, doorways, posts or back room); `omit` = sides whose wall a neighbour or the
# enclosure already stands on (the block's rooms run to that edge); `into` = those of them that are the enclosure's
# inner face, into which the block's walls run a wall thickness (the traced faces are not quite straight); `open` =
# sides left open on a row of posts.
# Idempotent. Run: python3 tools/apply_terrace_rooms_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


# ---------------------------------------------------------------- shared fittings
row('global', 'r_room_fittings', {
    'mat': [0.8, 1.9], 'mat_t': 0.03, 'mat_gap': 0.12, 'wall_gap': 0.1,
    'door_clear': 0.5, 'approach': 3.5, 'aisle': 1.3,
    'hearth_r': 0.55, 'hearth_clear': 1.6, 'hearth_places': 4, 'mess_places': 6, 'post_clear': 0.45,
    'lamp_h': 1.2, 'ledge': [0.36, 0.24, 0.1],
    'jar_r': 0.3, 'jar_h': 0.75, 'jar_pitch': 0.75, 'jars_quarters': 3, 'jars_store': 4, 'jars_service': 6, 'mats_apartment': 8,
    'quern': [0.55, 0.4], 'querns_service': 2,
    'bench': {'height': 0.45, 'depth': 0.7, 'gap': 0.8},
    'work_off': 0.8, 'work_pitch': 1.4},
    'm', 'MATCULT-R;SCHMIDT1953;RECON', 'C',
    'D-276: fittings of the Terrace rooms by use (all C; types from the town\'s houses, D-234, and MATERIAL_CULTURE): '
    'reed sleeping mats (mat w x l, thickness mat_t) laid head to the wall with mat_gap between them and wall_gap from the '
    'wall, none within door_clear of a doorway\'s leaf sweep or in its approach (a strip as wide as the doorway + 2 aisle/2, '
    'approach m deep) or within hearth_clear of the hearth or post_clear of a post; hearth_places / mess_places: the places round a hearth where the men sit to eat (quarters and kitchens / the mess); the aisle is the free way kept down the '
    'room between the rows. A clay hearth ring (hearth_r) in each quarters room and the kitchens; a saucer lamp on a mud '
    'ledge (ledge w x d x t) lamp_h up the back wall; storage jars (jar_r, jar_h) in a row at jar_pitch along a wall by '
    'the door; querns in the kitchens; an apartment\'s back room at most mats_apartment sleeping places (a household: the lady, her children and her women, C); mud-brick benches (height, depth; gap = free wall at the corners and by the door) '
    'along the walls of the stores carrying the stored goods (treasury.stored_goods). work_off: a storekeeper\'s place in '
    'front of a bench face (off the aisle), every work_pitch along it')

# ---------------------------------------------------------------- Treasury
row('treasury', 'r_rooms', {'wall': 1.2, 'clear': 4.5, 'roof': 0.5, 'hall_clear': 5.5, 'hall_roof': 0.6, 'post': 0.45,
                            'door_width': 1.2, 'door_height': 2.4, 'inner_width': 1.0, 'inner_height': 2.2},
    'm', 'REF-PLAN;RECON', 'C',
    'D-276: the Treasury\'s inner rooms: mud-brick walls (wall), clear height under a flat timber-and-earth roof (roof) as '
    'the N range (r_n_range_height, C); the two columned store halls of the S part taller (hall_clear, hall_roof) on timber '
    'posts (post = shaft diameter, as the Hall of 99 Columns\' plastered timber shafts, r_shaft, C). Doorways: door_width '
    'x door_height, as the N range\'s doorways read on REF-PLAN (1.1-1.3 m, B) with a timber lintel (C); inner openings '
    '(between a room and its back room) inner_width x inner_height (C)')
row('treasury', 'room_ranges', [
    {'id': 'w_stores', 'into': ['W'], 'use': 'store', 'x': [142.57, 153.2], 'y': [-152.5, -93.55], 'axis': 'y', 'n': 7, 'door': 'E', 'omit': ['W'],
     'note': 'store rooms along the W enclosure wall, entered from the corridor W of the Hall of 99 Columns (C: REF-PLAN draws the W part as a columned hall 145-181 x -115..-152 where the model has its Hall of 99 Columns, Q-730)'},
    {'id': 'e_stores_s', 'into': ['E'], 'use': 'store', 'x': [207.2, 217.89], 'y': [-152.5, -137.5], 'axis': 'y', 'n': 2, 'door': 'W', 'omit': ['E'],
     'note': 'store rooms along the E enclosure wall S of the passage to the E door (C; REF-PLAN has rooms and a corridor here, x 206-217)'},
    {'id': 'e_stores_n', 'into': ['E'], 'use': 'store', 'x': [207.2, 217.89], 'y': [-131.5, -93.55], 'axis': 'y', 'n': 4, 'door': 'W', 'omit': ['E'],
     'note': 'store rooms along the E enclosure wall N of the passage to the E door (C)'},
    {'id': 'sw_hall_a', 'into': ['W'], 'use': 'hall', 'x': [142.57, 168.0], 'y': [-181.0, -157.0], 'axis': 'y', 'n': 1, 'omit': ['W'], 'hall': True,
     'units': {'0': {'doors': [{'side': 'N', 'at': 155.0}, {'side': 'E', 'at': -170.0}], 'columns': [4, 4]}}, 'door': 'N',
     'note': 'columned store hall in the SW, 4 x 4 posts (REF-PLAN: walls 144-168 x -158.5..-181, column dots 4 x 4 at ~4.2 m, B); doorways N to the S corridor and E to the court (C)'},
    {'id': 'sw_hall_b', 'into': ['W', 'S'], 'use': 'hall', 'x': [142.57, 168.0], 'y': [-212.68, -181.0], 'axis': 'y', 'n': 1, 'omit': ['W', 'S', 'N'], 'hall': True,
     'units': {'0': {'doors': [{'side': 'E', 'at': -193.0}], 'columns': [4, 5]}}, 'door': 'E',
     'note': 'second columned store hall S of it (REF-PLAN: 144-168 x -182.5..-206, column dots 4 x 4; the model runs it to the S enclosure wall with a fifth row, C); doorway E to the court (C)'},
    {'id': 'court_n', 'into': ['E'], 'use': 'store', 'x': [168.0, 217.89], 'y': [-168.0, -157.0], 'axis': 'x', 'n': 5, 'door': 'S', 'omit': ['W', 'E'],
     'units': {'1': {'use': 'passage', 'doors': [{'side': 'S'}, {'side': 'N'}]}, '3': {'doors': [{'side': 'N'}]}, '4': {'doors': [{'side': 'N'}]}},
     'note': 'rooms on the N side of the S court (REF-PLAN: a range 170-199 x -154..-168 with an inner wall at -165, B), continued E over the E range; the second is the way from the S corridor into the court, the two E rooms open N onto the corridor (C)'},
    {'id': 'court_s', 'into': ['S'], 'use': 'store', 'x': [168.0, 199.0], 'y': [-212.77, -204.0], 'axis': 'x', 'n': 4, 'door': 'N', 'omit': ['W', 'S', 'E'],
     'note': 'store rooms along the S enclosure wall, entered from the court (REF-PLAN: small rooms 175-212 x -206..-212, B; count C)'},
    {'id': 'e_range', 'into': ['E', 'S'], 'use': 'store', 'x': [199.0, 217.89], 'y': [-212.84, -168.0], 'axis': 'y', 'cuts': [-197.4, -188.2, -178.6], 'door': 'W', 'omit': ['E', 'S'],
     'units': {'0': {'doors': [{'side': 'W', 'at': -201.0}]}},
     'note': 'rooms E of the court (REF-PLAN: N-S walls at x 199-200 and 205-207, cross walls at y -165 and -196, B; the model\'s rooms 18 m deep, C)'},
], 'm', 'REF-PLAN;SCHMIDT1953;RECON', 'B/C',
    'D-276: the Treasury\'s room ranges beyond the Hall of 99 Columns and the N range. REF-PLAN (Schmidt-derived, +-1 m) '
    'draws the whole Treasury as halls, courts and ranges of rooms; the S part (S of y -152) is laid out here as the plan draws '
    'it: two columned halls in the SW, a court with rooms N, E and S of it (B for the walls read, C for the rest). N of that the '
    'model keeps its Hall of 99 Columns where D-067 put it (C; the plan\'s halls there are laid out differently, Q-730): store '
    'rooms fill the strips W and E of it between corridors 4 m wide, the E door\'s passage left clear. Every room is roofed; '
    'store rooms have benches along their walls and a sealed or barred door (r_room_doors)')
row('treasury', 'r_room_doors', {'w_stores': 'scheduled_sealed', 'e_stores_s': 'scheduled_sealed', 'e_stores_n': 'scheduled_sealed',
                                 'court_n': 'scheduled_locked', 'court_s': 'scheduled_locked', 'e_range': 'scheduled_locked'},
    '', 'MATCULT-R;RECON', 'C',
    'D-276: door leaves of the store rooms by range: the rooms along the enclosure walls N of the S corridor hold the valuables '
    '(treasury.stored_goods) and are sealed outside working hours like the Hall of 99 Columns (door sealing: global.r_door_sealing, '
    'B practice); the S part\'s rooms are barred (C). The columned halls and the passage have no leaves (C)')

# ---------------------------------------------------------------- Harem
row('harem', 'r_rooms', {'wall': 1.0, 'clear': 5.0, 'roof': 0.5, 'post': 0.5, 'door_width': 1.4, 'door_height': 2.8,
                         'inner_width': 1.0, 'inner_height': 2.4},
    'm', 'ISAC-PA;RECON', 'C',
    'D-276: the Harem\'s apartments and service rooms: mud-brick walls, a flat roof, clear height (C: below the main hall\'s 6 m '
    'columns); each apartment\'s hall has four columns (ISAC-PA: "each 4-column hall", B), drawn as timber posts on stone '
    'bases (post = shaft diameter, C); doorways door_width x door_height (C); the opening to each apartment\'s back room '
    'inner_width x inner_height (C)')
row('harem', 'room_ranges', [
    {'id': 'apt_w', 'into': ['S'], 'use': 'apartment', 'x': [100.2, 111.0], 'y': [-207.64, -152.3], 'axis': 'y', 'cuts': [-198.7, -194.7, -173.75], 'door': 'E', 'omit': ['S'],
     'columns': [2, 2], 'back': 3.2,
     'units': {'1': {'use': 'passage', 'doors': [{'side': 'W'}, {'side': 'E'}], 'columns': [0, 0], 'back': 0}},
     'note': 'the main wing\'s W apartments (REF-PLAN: two columns of units S of the hall, y -155..-205, B), each a 4-column hall with a back room on the W; the second from the S is the passage from the W wing\'s corridor into the main wing (C)'},
    {'id': 'apt_e', 'into': ['S', 'E'], 'use': 'apartment', 'x': [115.0, 132.17], 'y': [-207.86, -152.3], 'axis': 'y', 'n': 3, 'door': 'W', 'omit': ['S', 'E'],
     'columns': [2, 2], 'back': 4.5,
     'note': 'the main wing\'s E apartments (REF-PLAN, B; the corridor between the two columns of units, x 111-115, from the hall\'s S doorway, C)'},
    {'id': 'side_w', 'into': [], 'use': 'store', 'x': [100.2, 104.7], 'y': [-152.3, -132.7], 'axis': 'y', 'n': 1, 'omit': ['E', 'S'],
     'units': {'0': {'doors': [{'side': 'E', 'at': -142.5, 'width': 2.0, 'via': True}]}}, 'door': 'W',
     'note': 'the narrow store room W of the main hall, entered by the hall\'s W doorway (C)'},
    {'id': 'side_e', 'into': ['E'], 'use': 'store', 'x': [124.8, 132.51], 'y': [-152.3, -132.7], 'axis': 'y', 'n': 1, 'omit': ['W', 'E', 'S'],
     'units': {'0': {'doors': [{'side': 'W', 'at': -142.5, 'width': 2.0, 'via': True}]}}, 'door': 'E',
     'note': 'the store room E of the main hall, entered by the hall\'s E doorway (C)'},
    {'id': 'n_range', 'into': ['W', 'E'], 'use': 'service', 'x': [100.2, 131.9], 'y': [-112.0, -100.0], 'axis': 'x', 'n': 3, 'door': 'S', 'omit': ['W', 'E'],
     'units': {'1': {'use': 'passage', 'doors': [{'side': 'S'}, {'side': 'N'}]}},
     'note': 'the kitchens and stores on the N side of the court (REF-PLAN draws rooms here, y -95..-112, B; their use C); the middle room is the way to the N hall (C)'},
    {'id': 'n_hall', 'into': ['W', 'E', 'N'], 'use': 'service', 'x': [100.2, 131.9], 'y': [-100.0, -75.2], 'axis': 'y', 'n': 1, 'omit': ['W', 'E', 'N', 'S'],
     'units': {'0': {'doors': [{'side': 'S', 'at': 116.05, 'width': 1.4, 'via': True}, {'side': 'N', 'at': 109.5, 'width': 2.4, 'via': True}], 'columns': [4, 3]}}, 'door': 'S', 'hall': True,
     'note': 'the columned hall N of the court, reached from the N passage of the Tripylon stair and through the N range (REF-PLAN draws column dots here, B; 4 x 3 posts and its use as the household\'s hall C)'},
    {'id': 'ww_n_a', 'into': ['W', 'N'], 'use': 'apartment', 'x': [-4.05, 48.5], 'y': [-195.2, -183.34], 'axis': 'x', 'n': 4, 'door': 'S', 'omit': ['W', 'N'],
     'columns': [2, 2], 'back': 3.2,
     'note': 'the W wing\'s N row of apartments, W half (REF-PLAN: units ~11-13 m wide in two rows along y -178..-206, B; ISAC-PA: 16 in the W wing, B)'},
    {'id': 'ww_n_b', 'into': [], 'use': 'apartment', 'x': [51.5, 100.2], 'y': [-195.2, -183.6], 'axis': 'x', 'n': 4, 'door': 'S', 'omit': ['E'],
     'columns': [2, 2], 'back': 3.2,
     'note': 'the W wing\'s N row, E half; a 3 m slot between the halves (C)'},
    {'id': 'ww_s_a', 'into': ['W'], 'use': 'apartment', 'x': [-4.46, 48.6], 'y': [-208.2, -198.2], 'axis': 'x', 'n': 4, 'door': 'N', 'omit': ['W', 'E'],
     'columns': [2, 2], 'back': 2.6,
     'note': 'the W wing\'s S row, W part (REF-PLAN, B); a corridor 3 m wide between the rows (C)'},
    {'id': 'ww_s_b', 'into': ['S'], 'use': 'apartment', 'x': [48.6, 89.0], 'y': [-219.95, -198.2], 'axis': 'x', 'n': 3, 'door': 'N', 'omit': ['S'],
     'columns': [2, 2], 'back': 7.0,
     'note': 'the W wing\'s S row where the wing reaches further S (x 46-91 to y -222: the traced outline and REF-PLAN, B); deeper apartments with larger back rooms (C)'},
    {'id': 'ww_s_c', 'into': [], 'use': 'apartment', 'x': [89.0, 100.2], 'y': [-207.6, -198.2], 'axis': 'x', 'n': 1, 'door': 'N', 'omit': ['W', 'E'],
     'columns': [2, 2], 'back': 2.6,
     'note': 'the sixteenth W-wing apartment, at the E end of the S row (C)'},
], 'm', 'REF-PLAN;ISAC-PA;RECON', 'B/C',
    'D-276: the Harem\'s room ranges beyond its main hall: the main wing\'s six apartments S of the hall (ISAC-PA: 6 in the main '
    'wing, each with a 4-column hall, B; REF-PLAN two columns of three units, B), the rooms beside the hall, the kitchens and '
    'the columned hall N of the court, and the W wing\'s sixteen apartments in two rows (ISAC-PA 16, B; REF-PLAN rows, B). '
    'Corridors, doorways and back rooms C. The W wing is reached from the main wing\'s corridor through a passage room (C)')

# ---------------------------------------------------------------- Garrison
row('garrison', 'r_rooms', {'wall': 1.0, 'clear': 3.2, 'roof': 0.4, 'post': 0.35, 'door_width': 1.4, 'door_height': 2.2,
                            'inner_width': 1.0, 'inner_height': 2.1},
    'm', 'SCHMIDT1953;RECON', 'C',
    'D-276: the garrison\'s quarters: "modest mud-brick rooms" (garrison.note, ISAC-PA B); walls, a flat roof of poles and earth '
    'under the enclosure\'s 4 m wall top, clear height, timber posts under the roof of the wider rooms (REF-PLAN draws rows of '
    'column dots in them, B; posts C), doorways door_width x door_height (C)')
row('garrison', 'room_ranges', [
    {'id': 'quarters_s', 'into': [], 'use': 'quarters', 'x': [190.5, 214.0], 'y': [-60.0, 25.5], 'axis': 'y', 'cuts': [-49.0, -41.5, -23.0, -8.5, 15.0], 'door': 'W',
     'units': {'0': {'columns': [3, 1]}, '1': {'use': 'store'}, '2': {'columns': [3, 2]}, '3': {'columns': [3, 2]}, '4': {'columns': [3, 3]},
               '5': {'use': 'service', 'columns': [3, 1]}},
     'note': 'the S range of quarters E of the garrison street (REF-PLAN: a N-S street x 190-195 along the W and rooms 196-213 E of it with cross walls at y 25.5, 15, -8.5, -23, -41.5, -49 and rows of column dots, B); the narrow room the garrison\'s store, the N room its kitchen (C)'},
    {'id': 'quarters_n', 'into': ['N'], 'use': 'quarters', 'x': [190.5, 214.0], 'y': [76.0, 118.4], 'axis': 'y', 'cuts': [90.0, 104.0], 'door': 'W', 'omit': ['N'],
     'columns': [3, 1],
     'note': 'the N range of quarters (C: REF-PLAN draws rooms along the W side here, 180-195 x 75-120; the model continues the street and the S range\'s rooms)'},
    {'id': 'guard_mess', 'into': [], 'floor': 0.0, 'use': 'mess', 'x': [131.0, 171.0], 'y': [145.5, 154.0], 'axis': 'x', 'n': 1, 'door': 'S', 'open': ['S'],
     'units': {'0': {'doors': []}},
     'note': 'the royal guard\'s mess: an open-fronted hall on posts along the N side of the guards\' court (court.json court_guard_mess: the food carried out to the court for the bodyguard, Heracleides via Athenaeus 4.145, B claim; the hall C), where the night watch sits by the fire under a roof (Q-652)'},
], 'm', 'REF-PLAN;SCHMIDT1953;RECON', 'B/C',
    'D-276: the garrison\'s quarters: rows of rooms along a street (REF-PLAN, B; Schmidt\'s garrison quarters, SCHMIDT1953 B), '
    'the 32-column hall\'s site left as the garrison\'s open court (absent in 467, garrison.note), lanes S (to the S door), N '
    '(to the W door and the court) and a passage E of the rooms (C). Sleeping mats along the walls and between the post rows, a '
    'hearth and a lamp in each quarters room (C; the royal guard\'s sleeping places, court.json court_guard_quarters, and the '
    'garrison\'s, garrison_sleep: B63), the mess on the guards\' court (C)')

# ---------------------------------------------------------------- the ways kept clear between the ranges
AISLE_NOTE = ('D-276: the corridors, streets and passages between the room ranges, kept clear: nobody is placed standing in '
              'them (people/popgeo.ts; with every room\'s doorway approaches and the passage rooms), so the ways stay walkable (the '
              'walk bots found people standing in the Treasury\'s and the Harem\'s ways). Rectangles x, y (grid m) between the '
              'ranges\' faces (C)')
row('treasury', 'r_aisles', [
    {'id': 'w_corridor', 'x': [153.2, 157.23], 'y': [-152.5, -93.55]}, {'id': 'e_passage', 'x': [203.23, 207.2], 'y': [-152.5, -93.55]},
    {'id': 'n_corridor', 'x': [142.57, 217.89], 'y': [-93.55, -86.4]}, {'id': 's_corridor', 'x': [142.57, 217.89], 'y': [-157.0, -147.95]},
    {'id': 'e_door', 'x': [207.2, 217.89], 'y': [-137.5, -131.5]}], 'm', 'RECON', 'C', AISLE_NOTE)
row('harem', 'r_aisles', [
    {'id': 'main_corridor', 'x': [111.0, 115.0], 'y': [-207.86, -152.3]}, {'id': 'ww_corridor', 'x': [-4.5, 100.2], 'y': [-198.2, -195.2]},
    {'id': 'ww_slot', 'x': [48.5, 51.5], 'y': [-195.2, -183.3]}], 'm', 'RECON', 'C', AISLE_NOTE)
row('garrison', 'r_aisles', [
    {'id': 'street_s', 'x': [184.48, 190.5], 'y': [-65.05, 35.8]}, {'id': 'street_n', 'x': [183.86, 190.5], 'y': [70.0, 118.4]},
    {'id': 's_lane', 'x': [184.48, 219.17], 'y': [-65.05, -60.0]}, {'id': 'n_lane', 'x': [183.86, 219.17], 'y': [70.0, 76.0]},
    {'id': 'e_passage_s', 'x': [214.0, 219.17], 'y': [-60.0, 25.5]}, {'id': 'e_passage_n', 'x': [214.0, 219.15], 'y': [76.0, 118.4]}], 'm', 'RECON', 'C', AISLE_NOTE)

# ---------------------------------------------------------------- the royal kitchens (court.json court_kitchen)
row('terrace', 'r_rooms', {'wall': 0.9, 'clear': 3.4, 'roof': 0.4, 'post': 0.35, 'door_width': 1.6, 'door_height': 2.3,
                           'inner_width': 1.0, 'inner_height': 2.1},
    'm', 'RECON', 'C',
    'D-276: the royal kitchens\' rooms: mud-brick walls, a flat roof of poles and earth, clear height, doorways (all C)')
row('terrace', 'room_ranges', [
    {'id': 'royal_kitchens', 'into': [], 'floor': 0.0, 'use': 'service', 'x': [-44.0, -18.0], 'y': [-176.0, -160.0], 'axis': 'x', 'n': 3, 'door': 'N',
     'note': 'the king\'s kitchens: three rooms with hearths, querns and jars on the open ground W of the Hadish where court.json puts court_kitchen (the kitchens are NOT LOCATED on the Terrace, Q-332: C); built so the cooks the plan keeps indoors after dark have their roof (D-276: until then they stood under the Hadish\'s traced footprint, which is not a roof)'},
], 'm', 'RECON', 'C',
    'D-276: the royal kitchens (court.json court_kitchen, NOT LOCATED: Q-332), three roofed rooms opening N onto the open ground '
    'W of the Hadish (C)')

# ---------------------------------------------------------------- the Treasury's stock (the lead's gap hunt s10 C, D-276)
row('treasury', 'stored_goods', [
    {'item': 'alabaster_vessel', 'share': 0.22, 'note': 'Egyptian calcite (alabaster) bowls and bottles, some inscribed (ISAC-FINDS, B)'},
    {'item': 'blue_vessel', 'share': 0.06, 'note': 'vessels of Egyptian-blue compound (ISAC-FINDS, B)'},
    {'item': 'chert_set', 'share': 0.12, 'note': 'green-chert mortars, pestles and plates with Aramaic ink texts (ISAC-FINDS, B)'},
    {'item': 'arrow_bundle', 'share': 0.12, 'note': 'bundles of bronze-tipped arrows; arrowheads and scabbard tips by the hundred among the finds (ISAC-FINDS, B; bundling C)'},
    {'item': 'sealed_jar', 'share': 0.06, 'note': 'jars sealed with clay labels (sealed labels on stored goods: C, verify in Schmidt Persepolis II)'},
    {'item': 'silver_phiale', 'share': 0.06, 'note': 'silver and gold phialai (omphalos bowls) stacked: the Treasury held the king\'s plate and bullion (ALEX-HIST: the treasure carried off from Persepolis, B claim; Achaemenid phialai are known from other hoards, B type); the form C'},
    {'item': 'gold_rhyton', 'share': 0.02, 'note': 'gold drinking horns (rhyta) among the plate (Achaemenid gold rhyta known from other finds, B type; here C)'},
    {'item': 'textile_bale', 'share': 0.1, 'note': 'folded garments and cloth in bales: garments and textiles were issued and stored as wealth (Persepolis tablets, B practice; bales C)'},
    {'item': 'scale_armour', 'share': 0.05, 'note': 'scale corslets folded flat: bronze and iron armour scales among the Treasury finds (ISAC-FINDS, B; folded corslets C)'},
    {'item': 'shield', 'share': 0.04, 'note': 'round shields leaning by the arrows (weapons stored in the Treasury, ISAC-FINDS B; the shields\' form C)'},
    {'item': 'bead_bowl', 'share': 0.03, 'note': 'bowls of lapis lazuli and carnelian beads (beads of both stones among the finds, ISAC-FINDS B; in bowls C)'},
    {'item': 'ivory_tusk', 'share': 0.02, 'note': 'raw elephant ivory (ivory objects among the finds, ISAC-FINDS B; tusks as stock C)'},
    {'item': 'glass_bowl', 'share': 0.03, 'note': 'cut-glass bowls (Achaemenid cut glass, B type; at the Treasury C)'},
    {'item': 'bitumen_jar', 'share': 0.07, 'note': 'jars coated and stoppered with bitumen (bitumen from Elam used as sealant, B practice; here C)'},
], '', 'ISAC-FINDS;ALEX-HIST;RECON', 'B',
    'what the Treasury held (types B, search extracts of ISAC Contents of the Treasury; D-276 adds the plate, textiles, armour, '
    'beads, ivory and cut glass the gap hunt s10 C found missing, each tiered in its note); quantities and placement C')

# the garrison's water point moved out of the N quarters into its court (people_places.json water): its well-head with it
C = spec['terrace']['r_cisterns']
C['v']['heads'] = [h if h['serves'] != 'water' else {'at': [215.3, 55.0], 'serves': 'water'} for h in C['v']['heads']]
if 'D-276' not in C['note']:
    C['note'] += ' D-276: the garrison\'s water point moved from inside the N quarters (212, 106) to its court (216.5, 55); the head 1.2 m W of it'

json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('terrace room rows written')
