# Stair crenellations (session 3, D-065): the four-stepped merlons on the parapets of the Grand Stair and the Phase-4
# palace stairs. Idempotent: rows are (re)written by key. Run: python3 tools/apply_crenellation_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


row('global', 'r_stair_crenellation',
    {'width': 0.9, 'height': 0.9, 'steps': 4, 'pitch': 1.035, 'max_depth': 0.45,
     'buildings': ['grand_stair', 'tachara', 'hadish', 'tripylon']},
    'm', 'IR-PERS;SI-ARCH;RECON', 'C',
    'four-stepped merlons crowning the stair parapets. Motif B on the Apadana stairs (IR-PERS, apadana.r_crenellation); on '
    'the Tachara S stair by analogy (tachara.stair_s_reliefs "Persepolis stair convention", C); on the Grand Stair per '
    'grand_stair.parapet_height (C); on the Hadish and Tripylon stairs by the same convention (C, NOT SEEN). Size as the '
    'Apadana merlon (0.9 x 0.9 m, C), pitch 1.15 x width as on the Apadana (C); depth = the parapet thickness up to '
    'max_depth (the Apadana merlon depth, C). Each merlon stands on the lowest parapet block under it (no merlon floats '
    'over a lower step; C). The terrace-edge parapet is left plain: terrace.parapet_height assumes crenellations but no '
    'source for them was reached (the motif is attested on stairs). The Hadish S balcony "behind four-stepped '
    'crenellations" (B) is not modelled (Q-P4 balcony geometry NOT SEEN).')

json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('r_stair_crenellation written')
