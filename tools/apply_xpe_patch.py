# XPe on the Hadish E and W doorways (session 3, D-066): the jamb programme rows name the inscription, and a global row sizes
# jamb inscriptions. Idempotent. Run: python3 tools/apply_xpe_patch.py && python3 tools/spec_to_md.py
import json

P = 'src/data/site_spec.json'
spec = json.load(open(P))


def row(b, k, v, u, src, tier, note):
    spec[b][k] = {'v': v, 'u': u, 'src': src, 'tier': tier, 'note': note}


J = spec['hadish']['door_jamb_reliefs']
J['v']['E'].update({'inscription': 'XPe',
                    'note': 'king and attendants with XPe above (SI-ARCH, B); XPe carved above the figures on both reveals, '
                            'the three versions stacked (global.r_jamb_inscription, C)'})
J['v']['W'].update({'inscription': 'XPe',
                    'note': 'XPe on the W doorway (FARROKH, B); the figures reconstructed as the E doorway (C, analogue); XPe '
                            'carved above them as on the E doorway (C)'})
row('global', 'r_jamb_inscription',
    {'glyph': 0.08, 'line_gap': 0.04, 'version_gap': 0.12, 'versions': ['op', 'el', 'bab'], 'top_margin': 0.25, 'width_of_reveal': 0.9, 'flat': True},
    'm', 'SI-ARCH;FARROKH;RECON', 'C',
    'a door-jamb inscription (XPe on the Hadish E and W doorways: "XPe above king and attendants", SI-ARCH B; "two large '
    'Xerxes inscriptions on the eastern and western doorways", FARROKH B): carved on each reveal above the figures, the '
    'Old Persian, Elamite and Babylonian versions stacked top to bottom (order C), each version in lines of glyph m signs '
    '(C: "large", size NOT SEEN) with line_gap between lines and version_gap between versions, the stack starting '
    'top_margin below the reveal top and spanning width_of_reveal of the reveal (C). Whether each reveal carries all three '
    'versions or one each is NOT SEEN (Q-090)')
json.dump(spec, open(P, 'w'), indent=1, ensure_ascii=False)
open(P, 'a').write('\n')
print('XPe rows written')
