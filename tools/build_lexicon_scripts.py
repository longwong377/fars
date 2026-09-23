"""Fill (or check, with --check) the native-script field of research/LEXICON/*.json from each entry's transliteration.

  Old Persian  sign_spelling (xa-ša-a-ya-…)  -> U+103A0 signs, one per syllable       (tier_script C: Kent's rules, D-011)
  Elamite      transliteration (ATF)          -> Cuneiform via the ORACC Sign List      (tier_script B: ATF indices -> OSL)
  Babylonian   transliteration (ATF)          -> Cuneiform via the ORACC Sign List      (tier_script B)
  Aramaic      consonantal form (šlm)         -> Imperial Aramaic U+10840 letters        (tier_script B)
  Greek        edition form (χαῖρε)           -> capitals without accents or breathings (tier_script B: Ionic alphabet;
                                                  period inscriptions have no lower case, accents or breathings; East Ionic
                                                  is psilotic, so no h is written)

Entries whose transliteration is marked '(sign spelling not verified)', or whose ATF has a sign the OSL cannot map, keep
script = null (the language lint only checks non-null scripts, and a null script is never rendered). Run from the repo
root: python3 tools/build_lexicon_scripts.py [--check]"""
import json, re, sys, unicodedata, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_inscriptions import atf_to_cun  # OSL value -> sign table (reads data/corpus/osl.asl)

R = 'research/LEXICON/'
OP_SIGN = {'a': 0x103a0, 'i': 0x103a1, 'u': 0x103a2, 'ka': 0x103a3, 'ku': 0x103a4, 'ga': 0x103a5, 'gu': 0x103a6, 'xa': 0x103a7, 'ca': 0x103a8,
           'ja': 0x103a9, 'ji': 0x103aa, 'ta': 0x103ab, 'tu': 0x103ac, 'da': 0x103ad, 'di': 0x103ae, 'du': 0x103af, 'θa': 0x103b0, 'pa': 0x103b1,
           'ba': 0x103b2, 'fa': 0x103b3, 'na': 0x103b4, 'nu': 0x103b5, 'ma': 0x103b6, 'mi': 0x103b7, 'mu': 0x103b8, 'ya': 0x103b9, 'va': 0x103ba,
           'vi': 0x103bb, 'ra': 0x103bc, 'ru': 0x103bd, 'la': 0x103be, 'sa': 0x103bf, 'za': 0x103c0, 'ša': 0x103c1, 'ça': 0x103c2, 'ha': 0x103c3}
ARC = dict(zip(['ʾ', 'b', 'g', 'd', 'h', 'w', 'z', 'ḥ', 'ṭ', 'y', 'k', 'l', 'm', 'n', 's', 'ʿ', 'p', 'ṣ', 'q', 'r', 'š', 'ś', 't'],
               [0x10840, 0x10841, 0x10842, 0x10843, 0x10844, 0x10845, 0x10846, 0x10847, 0x10848, 0x10849, 0x1084a, 0x1084b, 0x1084c,
                0x1084d, 0x1084e, 0x1084f, 0x10850, 0x10851, 0x10852, 0x10853, 0x10854, 0x10854, 0x10855]))

def op_script(e):
    sp = e.get('sign_spelling')
    if not sp: return None
    return ''.join(chr(OP_SIGN[s]) for s in sp.split('-'))

def atf_script(e):
    tr = (e.get('transliteration') or '').strip()
    if not tr or 'not verified' in tr: return None
    tr = re.sub(r'\([^)]*\)', ' ', tr).split(' / ')[0].split(';')[0].strip()
    tr = re.sub(r'\s+', ' ', tr)
    if not tr: return None
    cun, missing = atf_to_cun(tr)
    return None if missing or not cun.strip() else cun

def arc_script(e):
    f = e['form'].lower()  # proper names are capitalised in the romanisation only
    if not all(c in ARC for c in f): return None
    return ''.join(chr(ARC[c]) for c in f)

def grc_script(e):
    g = e.get('greek')
    if not g: return None
    s = unicodedata.normalize('NFD', g)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return unicodedata.normalize('NFC', s).upper()

JOBS = [('old_persian.json', op_script), ('elamite.json', atf_script), ('babylonian.json', atf_script), ('aramaic.json', arc_script), ('greek.json', grc_script)]

def main():
    check = '--check' in sys.argv
    bad = 0
    for f, fn in JOBS:
        rows = json.load(open(R + f, encoding='utf8'))
        filled = changed = 0
        for e in rows:
            if e['form'].startswith('('): continue
            want = fn(e)
            if f == 'elamite.json' and want is None and e.get('script'):
                want = e['script']  # keep an earlier hand-checked script where the ATF cannot be converted
            if want != e.get('script'):
                changed += 1
                if check: print(f'{f}: {e["form"]}: script {e.get("script")!r} != {want!r}'); bad += 1
                else: e['script'] = want
            if want: filled += 1
            if want and e.get('tier_script') in (None, '-', '–'): e['tier_script'] = 'B'
        if not check:
            with open(R + f, 'w', encoding='utf8') as fh:
                json.dump(rows, fh, ensure_ascii=False, indent=1); fh.write('\n')
        print(f'{f}: {len(rows)} entries, {filled} with native script, {changed} {"differ" if check else "updated"}')
    if bad: sys.exit(1)

if __name__ == '__main__':
    main()
