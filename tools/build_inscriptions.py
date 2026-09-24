"""Build src/data/inscriptions.json from the ARIo corpus (Schmitt 2009, CC0; mirror SLAB-NLP/Akk data/jsonl/ario.jsonl)
and the ORACC Sign List (oracc/osl 00lib/osl.asl). Old Persian is kept as transliteration (converted to signs at runtime by
src/lang/oldPersian.ts, Kent's rules, tier C for the spelling). Elamite and Babylonian ATF are converted sign by sign:
ATF readings with indices identify signs uniquely, so the conversion is deterministic (tier B; unmapped tokens listed)."""
import json, re, unicodedata
osl = open('data/corpus/osl.asl', encoding='utf8').read().split('\n')
val2u, name2u = {}, {}
cur_u, cur_name = None, None
for line in osl:
    if line.startswith('@sign ') or line.startswith('@form '):
        cur_name = line.split(None, 1)[1].strip(); cur_u = None
    elif line.startswith('@ucun'):
        cur_u = line.split('\t', 1)[1].strip() if '\t' in line else line.split(None, 1)[1].strip()
        if cur_name and cur_name not in name2u: name2u[cur_name] = cur_u
    elif line.startswith('@v') and cur_u:
        v = line.split(None, 1)[1].strip().rstrip('?')
        if v.startswith('-') or v.startswith('%'): continue
        val2u.setdefault(v, cur_u)
SUB = str.maketrans('₀₁₂₃₄₅₆₇₈₉', '0123456789')
def lookup(tok):
    t = tok.strip()
    if not t: return ''
    for cand in (t, t.lower()):
        if cand in val2u: return val2u[cand]
    if t.upper() == t and t in name2u: return name2u[t]
    # ATF uppercase logograms use sign names with subscripts, e.g. LU₂ → LU2 in some lists
    alt = t.translate(SUB)
    if alt in name2u: return name2u[alt]
    return None
def atf_to_cun(atf):
    out, missing = [], []
    for word in atf.split():
        signs = []
        for part in re.split(r'(\{[^}]+\})', word):
            if not part: continue
            if part.startswith('{'):
                d = part[1:-1]; u = lookup(d) or lookup(d.upper()) or lookup(d.lower())
                if u: signs.append(u)
                else: missing.append(part)
                continue
            for tok in re.split(r'[-.]', part):
                tok = tok.strip('[]<>#!?*')
                if not tok or tok in ('x', '...'): continue
                u = lookup(tok)
                if u: signs.append(u)
                else: missing.append(tok)
        out.append(''.join(signs))
    return ' '.join(out), missing
def main():
    texts = {json.loads(l)['id_text']: json.loads(l)['raw_text'] for l in open('data/corpus/ario.jsonl', encoding='utf8')}
    IDS = {'XPa': 'Q007209', 'XPb': 'Q007210', 'XPc': 'Q007211', 'XPd': 'Q007212', 'XPe': 'Q007213', 'DPh': 'Q007164', 'DNa': 'Q007152', 'DNb': 'Q007153',
           # Darius' texts on the Terrace (D-177; identified by content, ARIo order DPa..DPg = Q007157..Q007163): DPa 'haya imam tacaram
           # akunau̯š' (Q007147 is an OP-only copy of the same text; the trilingual is used), DPb the titulary without 'xšāyaθiyānām',
           # DPc 'ardastāna aθangai̯na', DPd 'iyam dahyāu̯š Pārsa', DPe the list of lands, DPf the Elamite and DPg the Babylonian
           # companion texts of the Terrace south wall
           'DPa': 'Q007157', 'DPb': 'Q007158', 'DPc': 'Q007159', 'DPd': 'Q007160', 'DPe': 'Q007161', 'DPf': 'Q007162', 'DPg': 'Q007163'}  # DNa/DNb: Darius I's tomb, Naqsh-e Rustam (identified by content: DNa 'Ariyaciça', 'gāθum', 'patikarā'; DNb 'ima frašam ... upari Dārayava.um')
    res = {}
    for sig, q in IDS.items():
        raw = texts[q]
        # split versions: OP runs until the first Elamite token (determinative braces); Babylonian begins at the second 'a-na-ku' block? use the ARIo convention:
        m = re.search(r'\{', raw)
        # texts in one language only (DPd, DPe: Old Persian; DPf: Elamite; DPg: Babylonian), and DPc, whose Elamite opens with
        # a word without a determinative (har-da-is₂-ta₂-na, the loan of OP ardastāna): its OP ends before the first ATF
        # (hyphenated) token
        if sig in ('DPf', 'DPg'): m = re.match('', raw)
        elif sig == 'DPc': m = re.search(r'\S+-\S+', raw)
        op = raw[:m.start()].strip() if m else raw
        rest = raw[m.start():] if m else ''
        # Babylonian versions of Xerxes texts open with 'DINGIR GAL₂' / '{d}u₂-ra-ma-az-da' patterns; split at the first occurrence of ' DINGIR ' or 'AN GAL'
        # texts that do not open with a god line start their Babylonian with the king's name under the Babylonian person determinative {m}
        # (Elamite writes {DIŠ}): XPe (Xerxes' titulary) and DPh (the Apadana foundation plates, ARIo Q007164; Q007148 is DH,
        # the same wording from Hamadan). The fallback is per text so the other entries stay byte-identical.
        # DPa and DPb (Darius' titulary) as DPh; DPc's Babylonian begins after the Elamite verb hu-ut-tuk-ka₄ ('made'), with
        # ku-bu-ur-ri-e (C: the split of the running text); DPf is Elamite and DPg Babylonian throughout
        SPLIT = {'XPe': r'\{m\}hi-ši-ʾ-ar-ši', 'DPh': r'\{m\}', 'DPa': r'\{m\}', 'DPb': r'\{m\}', 'DPc': r'ku-bu-ur-ri-e', 'DPg': r'^'}
        b = None if sig == 'DPf' else re.search(SPLIT[sig], rest) if sig in SPLIT else re.search(r'\bDINGIR\b|\bAN GAL\b|\bil-lu\b', rest)
        el, bab = (rest[:b.start()].strip(), rest[b.start():].strip()) if b else (rest.strip(), '')
        elc, elm = atf_to_cun(el); bac, bam = atf_to_cun(bab)
        res[sig] = {'ario': q, 'op_translit': op, 'el_atf': el, 'el_cuneiform': elc, 'el_unmapped': sorted(set(elm)), 'bab_atf': bab, 'bab_cuneiform': bac, 'bab_unmapped': sorted(set(bam)),
                    'tier': {'text': 'A (standard edition, via CC0 mirror)', 'op_signs': 'C (Kent orthographic rules)', 'el_bab_signs': 'B (ATF indices → OSL)', 'version_split': 'C (heuristic split of the ARIo running text)'}}
        print(sig, 'OP words', len(op.split()), '| El tokens unmapped', len(set(elm)), '| Bab unmapped', len(set(bam)), '| bab len', len(bab.split()))
    json.dump({'_meta': 'ARIo (Schmitt 2009, CC0) via SLAB-NLP/Akk mirror; signs via oracc/osl; tools/build_inscriptions.py', **res}, open('src/data/inscriptions.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
