"""Extract the carved texts' lines from ORACC ARIo in CATF (oracc/catf ario.catf, CC0: "Canonical ATF version of Oracc data
which is permitted to be released under CC0"; R. Schmitt's edition, 2009) into data/corpus/ario_catf.json (D-184).

For each text the Old Persian, Elamite and Akkadian (Babylonian) lines are kept verbatim, as the edition numbers them,
with their editorial marks (<<x>> an extra sign the engraver cut, <x> a sign the engraver omitted and the editor supplies,
[x] a sign lost since antiquity and restored, x# damaged, [...] lost and not restored). Nothing else of the file is kept.

    python3 tools/extract_ario_catf.py /path/to/ario.catf
    (the file: https://raw.githubusercontent.com/oracc/catf/master/ario.catf, 166,028 bytes, sha256 eb8de252…)
"""
import hashlib, json, re, sys

IDS = {'XPa': 'Q007209', 'XPb': 'Q007210', 'XPc': 'Q007211', 'XPd': 'Q007212', 'XPe': 'Q007213', 'DPh': 'Q007164',
       'DNa': 'Q007152', 'DNb': 'Q007153', 'DPa': 'Q007157', 'DPb': 'Q007158', 'DPc': 'Q007159', 'DPd': 'Q007160',
       'DPe': 'Q007161', 'DPf': 'Q007162', 'DPg': 'Q007163',
       # D-214 (gap audit items 27, 28): Xerxes' texts on the Apadana plaque and glazed bricks (XPg = Xerxes I 11), on column
       # bases (XPj = Xerxes I 14, XPm = Xerxes I 17) and on his garment on a relief (XPk = Xerxes I 15): ARIo numbers its
       # Xerxes texts in the sigla's order (XPa = Xerxes I 05 ... XPe = 09), and each is confirmed by content (research/LANGUAGES.md)
       'XPg': 'Q007215', 'XPj': 'Q007218', 'XPk': 'Q007219', 'XPm': 'Q007221'}
VER = {'Persian': 'op', 'Elamite': 'el', 'Akkadian': 'bab'}

def main(path):
    raw = open(path, 'rb').read()
    txt = raw.decode('utf-8')
    blocks = {}
    for b in re.split(r'\n(?=&Q)', txt):
        m = re.match(r'&(Q\d+) = (.*)', b)
        if m: blocks[m.group(1)] = (m.group(2).strip(), b)
    out = {'_meta': (
        "ORACC ARIo (R. Schmitt, Die altpersischen Inschriften der Achaimeniden, 2009; digitised by MOCCI/ORACC) in Canonical ATF, "
        "file ario.catf of https://github.com/oracc/catf (master; README: 'Canonical ATF version of Oracc data which is permitted to be "
        f"released under CC0'), {len(raw)} bytes, sha256 {hashlib.sha256(raw).hexdigest()}, read 2026-09-24. Only the lines of the texts "
        "the world carves or holds are kept, per version, verbatim, with the edition's line numbers and editorial marks. Licence CC0 "
        "(ASSET_LEDGER 'ARIo CATF'). Extracted by tools/extract_ario_catf.py; the carved Old Persian sign sequence is built from it by "
        "tools/build_op_signs.ts (D-184)."), 'texts': {}}
    for sig, q in IDS.items():
        name, b = blocks[q]
        ver, t = None, {'q': q, 'name': name, 'op': [], 'el': [], 'bab': []}
        for l in b.split('\n'):
            m = re.match(r'@m=locator (\w+)', l)
            if m: ver = VER[m.group(1)]; continue
            # XPg (Q007215) heads its only version '@h1 Old Persian version' with no locator line (D-214)
            m = re.match(r'@h1 (Old Persian|Elamite|Akkadian) version', l)
            if m: ver = {'Old Persian': 'op', 'Elamite': 'el', 'Akkadian': 'bab'}[m.group(1)]; continue
            m = re.match(r"^(\d+'?)\.\s(.*)$", l)
            if m and ver: t[ver].append(m.group(1) + '. ' + m.group(2).rstrip())
        out['texts'][sig] = t
    json.dump(out, open('data/corpus/ario_catf.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open('data/corpus/ario_catf.json', 'a').write('\n')
    print({k: {v: len(t[v]) for v in ('op', 'el', 'bab')} for k, t in out['texts'].items()})

if __name__ == '__main__':
    main(sys.argv[1])
