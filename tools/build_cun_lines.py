"""The carved Elamite and Babylonian: the edition's lines, as the stone stood in 467 (D-184, D-184; Phase 8 reviews round 2
minor 1, round 3 M1).

Each version's LINES are read from the CC0 ARIo edition in CATF (data/corpus/ario_catf.json) and converted sign by sign
with the OSL sign converter of tools/build_inscriptions.py, applying the edition's marks as for the Old Persian:
  - <x>   a sign the scribe omitted, supplied by the editor: NOT carved (it was never on the stone);
  - <<x>> an extra sign the engraver cut: carved;
  - [x]   a sign lost since antiquity and restored by the editor: carved (the stone was whole in 467), tier C, counted;
  - x# x? x!  damaged / uncertain / corrected readings: carved as read;
  - (…)   CATF parentheses round a sign group (e.g. {DISZ}(LU2.MESZ-)ir-ra): carved as written, counted and logged
          (their meaning in ARIo is not stated in the repository: Q-293).
No word spaces (the royal texts do not space words). Stored per version: `<ver>_lines` (the carved lines) and
`<ver>_marks` (the counts). Checked: the carved lines, joined, equal the ARIo running text's signs (`<ver>_cuneiform`,
tools/build_inscriptions.py) with exactly the omitted signs taken out; the build stops otherwise.

    python3 tools/build_cun_lines.py        (after tools/build_inscriptions.py and tools/build_op_signs.ts)
"""
import difflib, json, re, sys
sys.path.insert(0, 'tools')
from build_inscriptions import lookup

SUBS = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
def norm(line):
    """CATF notation → the running text's (sz → š, index digits → subscripts, ' → ʾ); language and logogram marks dropped;
    the edition's brackets kept for convert()"""
    l = re.sub(r"^\d+'?\.\s*", '', line)
    l = re.sub(r'%[a-z]+\s*', '', l)
    l = l.replace('_', '').rstrip(';').strip()
    l = l.replace('sz', 'š').replace('SZ', 'Š').replace('s,', 'ṣ').replace('S,', 'Ṣ').replace('t,', 'ṭ').replace('T,', 'Ṭ').replace("'", 'ʾ')
    l = re.sub(r'(?<=[A-Za-zšŠṣṢṭṬ])(\d+)', lambda m: m.group(1).translate(SUBS), l)
    return l.strip('-').strip()

def sign_of(tok, det):
    t = tok.strip()
    if not t or t in ('x', '...'): return None
    return (lookup(t) or lookup(t.upper()) or lookup(t.lower())) if det else lookup(t)

def convert(line, st, marks, missing):
    """one CATF line → its carved cuneiform; `st` carries the bracket states across lines"""
    out, tok, det = [], '', False
    def flush():
        nonlocal tok
        t, tok = tok, ''
        if not t: return
        u = sign_of(t, det)
        if u is None:
            if t not in ('x', '...'): missing.append(t)
            return
        if st['omit']: marks['omitted'] += 1; marks['omitted_signs'].append(u); return
        if st['excess']: marks['excess'] += 1
        if st['restored']: marks['restored'] += 1
        if st['paren']: marks['paren'] += 1
        out.append(u)
    l, i = norm(line), 0
    while i < len(l):
        if l.startswith('<<', i): flush(); st['excess'] = True; i += 2; continue
        if l.startswith('>>', i): flush(); st['excess'] = False; i += 2; continue
        c = l[i]; i += 1
        if c == '<': flush(); st['omit'] = True
        elif c == '>': flush(); st['omit'] = False
        elif c == '[': flush(); st['restored'] = True
        elif c == ']': flush(); st['restored'] = False
        elif c == '(': flush(); st['paren'] = True
        elif c == ')': flush(); st['paren'] = False
        elif c == '{': flush(); det = True
        elif c == '}': flush(); det = False
        elif c in ' -.': flush()
        elif c in '#?!*': pass
        else: tok += c
    flush()
    return ''.join(out)

def main():
    ins = json.load(open('src/data/inscriptions.json', encoding='utf8'))
    ed = json.load(open('data/corpus/ario_catf.json', encoding='utf8'))['texts']
    problems = []
    for sig, t in ins.items():
        if sig == '_meta': continue
        for ver in ('el', 'bab'):
            t.pop(f'{ver}_lines', None); t.pop(f'{ver}_marks', None)
            run = (t.get(f'{ver}_cuneiform') or '').replace(' ', '')
            lines = ed.get(sig, {}).get(ver) or []
            if not run or not lines: continue
            st = {'omit': False, 'excess': False, 'restored': False, 'paren': False}
            marks = {'omitted': 0, 'omitted_signs': [], 'excess': 0, 'restored': 0, 'paren': 0}
            missing = []
            conv = [convert(l, st, marks, missing) for l in lines]
            # the check: the running text (which includes the supplied signs) less exactly the omitted signs
            ops = [o for o in difflib.SequenceMatcher(None, run, ''.join(conv), autojunk=False).get_opcodes() if o[0] != 'equal']
            dropped = ''.join(run[a:b] for tag, a, b, c, d in ops if tag == 'delete')
            if missing or any(o[0] != 'delete' for o in ops) or sorted(dropped) != sorted(''.join(marks['omitted_signs'])):
                problems.append(f'{sig} {ver}: lines do not equal the running text less the omitted signs ({ops[:3]}, unmapped {missing[:5]})'); continue
            t[f'{ver}_lines'] = conv
            t[f'{ver}_marks'] = {k: v for k, v in marks.items() if k != 'omitted_signs'}
            t.setdefault('tier', {})[f'{ver}_lines'] = "A (the edition's lines and signs, ARIo CATF; no word spaces); the signs the editor restored ([…]) C, counted in el/bab_marks; signs the scribe omitted (<…>) not carved (D-184)"
            print(sig, ver, 'lines', len(conv), {k: v for k, v in marks.items() if k != 'omitted_signs'})
        if t.get('tier', {}).get('version_split', '').startswith('C'):
            t['tier']['version_split'] = 'A (verified: every carved Elamite and Babylonian version equals its ARIo CATF lines sign for sign, tools/build_cun_lines.py)'
    if problems: print('\n'.join(problems)); sys.exit(1)
    json.dump(ins, open('src/data/inscriptions.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
