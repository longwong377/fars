"""The published lineation of the Elamite and Babylonian versions (D-184; Phase 8 review round 2, minor 1).

The carved Elamite and Babylonian signs are the ARIo running text converted sign by sign (tools/build_inscriptions.py,
`el_cuneiform` / `bab_cuneiform`, words separated by modern spaces). The same edition in CATF (data/corpus/ario_catf.json)
gives each version's LINES. Each CATF line is converted with the same sign converter (atf_to_cun) after its notation is
brought to the running text's (sz → š, index digits → subscripts, _logograms_ upper case, ' → ʾ); if the lines, joined, are
exactly the running text's signs (spaces removed), the running text's signs are cut into those lines and stored as
`el_lines` / `bab_lines` (no word spaces: Achaemenid Elamite and Babylonian royal texts do not space words). Where they do
not match exactly, nothing is stored and the panel flows the text as before (reported).

    python3 tools/build_cun_lines.py        (after tools/build_inscriptions.py and tools/build_op_signs.ts)
"""
import json, re, sys
sys.path.insert(0, 'tools')
from build_inscriptions import atf_to_cun

SUBS = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
def norm(line):
    l = re.sub(r"^\d+'?\.\s*", '', line)
    l = re.sub(r'%[a-z]+\s*', '', l)
    # _…_ marks logograms (Sumerograms); their CATF readings are sign values the converter knows in lower case: drop the
    # marks. Restoration and damage marks change no sign: drop them
    l = re.sub(r'[_\[\]#?!]', '', l).rstrip(';').strip()
    l = l.replace('sz', 'š').replace('SZ', 'Š').replace('s,', 'ṣ').replace('S,', 'Ṣ').replace('t,', 'ṭ').replace('T,', 'Ṭ').replace("'", 'ʾ')
    l = re.sub(r'(?<=[A-Za-zšŠṣṢṭṬ])(\d+)', lambda m: m.group(1).translate(SUBS), l)
    l = re.sub(r'[()]', '', l)  # CATF (LU2.MESZ-): a sign group written as the running text writes it
    return l.strip('-').strip()

def main():
    ins = json.load(open('src/data/inscriptions.json', encoding='utf8'))
    ed = json.load(open('data/corpus/ario_catf.json', encoding='utf8'))['texts']
    for sig, t in ins.items():
        if sig == '_meta': continue
        for ver in ('el', 'bab'):
            t.pop(f'{ver}_lines', None)
            run = (t.get(f'{ver}_cuneiform') or '').replace(' ', '')
            lines = ed.get(sig, {}).get(ver) or []
            if not run or not lines: continue
            conv = [atf_to_cun(norm(l))[0].replace(' ', '') for l in lines]
            if ''.join(conv) == run:
                t[f'{ver}_lines'] = conv
                t.setdefault('tier', {})[f'{ver}_lines'] = "A (the edition's lines, ARIo CATF; no word spaces)"
                print(sig, ver, 'lines', len(conv))
            else:
                a, b = ''.join(conv), run
                i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
                print(sig, ver, 'NO MATCH: lines give', len(a), 'code units, the running text', len(b), 'first difference at', i)
    json.dump(ins, open('src/data/inscriptions.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
