# The Apadana foundation deposits (session 3, D-068): the stone boxes with the DPh gold and silver plates, built under the
# hall corners. Idempotent. Run: python3 tools/apply_foundation_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


row('apadana', 'r_foundation_deposits',
    {'corners': ['NE', 'SE'], 'box_outer': [0.62, 0.62, 0.46], 'box_wall': 0.08, 'lid': 0.1, 'top_below_floor': 0.45,
     'plates': [{'metal': 'gold', 'size': [0.33, 0.33, 0.0015]}, {'metal': 'silver', 'size': [0.33, 0.33, 0.0015]}],
     'inscription': 'DPh'},
    'm', 'ISAC-PA;LIVIUS-AI;RECON', 'C',
    'the foundation deposits of the Apadana: in each stone box a gold and a silver plate inscribed with DPh in Old Persian, '
    'Elamite and Babylonian (ARIo Q007164; the same wording as DH from Hamadan). Existence and contents B '
    '(apadana.foundation_deposits, ISAC-PA; LIVIUS-AI DPh: "two golden and two silver tablets"). Corners: the boxes found at '
    'NE and SE (Q-016: 2 boxes vs 4 corners; Livius names one box at NE); plate size 33 x 33 cm from recollection (NOT SEEN, '
    'C); box size, thickness, lid and depth below the floor C; centred under the outer corner of the hall wall (C). The coins '
    'reported beneath the boxes are not modelled (not in the retrieved sources). Sealed since the foundation: nothing in the '
    'world shows them; the translation layer names them at the corner')
json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('foundation deposit row written')
