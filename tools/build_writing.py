"""Build src/data/writing.json: the texts written or impressed on objects in the world (Phase 8 writing on objects, D-179).

Only published texts, stored as the ancient text in its standard transliteration and its sign sequence (never a modern
translation or commentary): the seal inscriptions come from ARIo (Schmitt 2009, CC0; mirror SLAB-NLP/Akk
data/jsonl/ario.jsonl, the same file tools/build_inscriptions.py reads). Elamite and Babylonian ATF are converted sign by
sign through the ORACC Sign List exactly as for the carved inscriptions (atf_to_cun); Old Persian is stored sign by sign
(the standard spelling of these three words, the same words the carved XPa-XPe use) and converted to code points by the
Unicode names of the Old Persian signs, so the rendered signs do not depend on the runtime spelling rules.

The Persepolis Treasury tablets' own texts (Cameron 1948/1958/1965) are NOT reachable from this sandbox (BLOCKERS B6, B18).
Since D-198 the tablets carry texts RECONSTRUCTED by the project on the Treasury tablets' published formulary (silver paid
to named groups of kurtaš as rations: IR-TREAS, IR-PET, search extracts) in the receipt formulary of the Fortification
texts read in full (Hallock PF via CDLI): `recon_texts`, tier C, each labelled "reconstructed on the Treasury tablets'
published formulary — not a surviving text (C)". The formulary is kept strictly: every word is checked below against
research/LEXICON/elamite.json (its transliteration or its quoted attestation, A/B; silver KU₃.BABBAR is the one C word),
every personal name against src/data/names.json (A as names; the persons are the project's), every numeral against the
PF numeral notation; the build stops on anything else. No sign sequence is invented: the words' own ATF → OSL."""
import json, re, sys, unicodedata, os
sys.path.insert(0, os.path.dirname(__file__))
from build_inscriptions import atf_to_cun  # noqa: E402  (module guarded by __main__; parses data/corpus/osl.asl on import)

ARIO = {json.loads(l)['id_text']: json.loads(l)['raw_text'] for l in open('data/corpus/ario.jsonl', encoding='utf8')}

OP_NAME = {'a': 'A', 'i': 'I', 'u': 'U', 'da': 'DA', 'ma': 'MA', 'ra': 'RA', 'ya': 'YA', 'va': 'VA', 'ša': 'SHA', 'xa': 'XA', 'θa': 'THA'}
def op_signs_to_cun(signs):
    out = []
    for s in signs:
        if s == '|': out.append(unicodedata.lookup('OLD PERSIAN WORD DIVIDER')); continue
        out.append(unicodedata.lookup('OLD PERSIAN SIGN ' + OP_NAME[s]))
    return ''.join(out)

def seal_text(tid, ario, op_translit, op_signs, el_atf=None, bab_atf=None, ident=''):
    raw = ARIO[ario]
    # the version split of the ARIo running text is by content (the OP words, then the Elamite, then the Babylonian ATF):
    # every piece must occur verbatim in the ARIo text (checked here)
    for piece in [op_translit, el_atf, bab_atf]:
        if piece: assert piece in raw, (tid, piece, raw)
    t = {'kind': 'seal_inscription', 'ario': ario, 'ario_raw': raw, 'ident': ident,
         'op_translit': op_translit, 'op_signs': op_signs, 'op_cuneiform': op_signs_to_cun(op_signs)}
    if el_atf:
        cun, miss = atf_to_cun(el_atf); t.update(el_atf=el_atf, el_cuneiform=cun, el_unmapped=miss)
    if bab_atf:
        cun, miss = atf_to_cun(bab_atf); t.update(bab_atf=bab_atf, bab_cuneiform=cun, bab_unmapped=miss)
    t['tier'] = {'text': 'A (ARIo standard edition, CC0)', 'op_signs': 'B (standard spelling of attested words, checked against the carved XP texts)',
                 'el_bab_signs': 'B (ATF indices -> OSL)', 'version_split': 'B (by content; each piece occurs verbatim in the ARIo text)', 'identification': ident}
    return t

texts = {
    # the royal-name formula of Darius' inscribed seals, in Old Persian, Elamite and Babylonian. ARIo Q007203 is identified by content as SDa (the London cylinder seal, BM 89132).
    'SDa': seal_text('SDa', 'Q007203', 'adam Dārayava.uš xšāyaθiya',
                     ['a', 'da', 'ma', '|', 'da', 'a', 'ra', 'ya', 'va', 'u', 'ša', '|', 'xa', 'ša', 'a', 'ya', 'θa', 'i', 'ya'],
                     'DIŠ.u₂ DIŠ.da-ri-ia-ma-u-iš DIŠ.EŠŠANA', 'ana-ku {m}da-ri-ia₂-muš LUGAL GAL-u₂',
                     'B: ARIo Q007203 by content = SDa (trilingual royal-name seal formula of Darius I)'),
    # the royal-name formula of Xerxes, Old Persian only: ARIo Q009270 (a Xerxes seal inscription, identified by content)
    'XSeal': seal_text('XSeal', 'Q009270', 'adam Xšayaṛšā xšāyaθiya',
                       ['a', 'da', 'ma', '|', 'xa', 'ša', 'ya', 'a', 'ra', 'ša', 'a', '|', 'xa', 'ša', 'a', 'ya', 'θa', 'i', 'ya'],
                       None, None, 'B: ARIo Q009270 by content = an Old Persian royal-name seal inscription of Xerxes'),
}
for t in texts.values():
    assert not t.get('el_unmapped') and not t.get('bab_unmapped'), t

# ------------------------------------------------------------------------------------------------ reconstructed PT texts
# The Treasury memoranda the scribes' room shows (D-198). Each line is a list of words; a word is
#   ('lex', ATF, lexicon form)      a word of research/LEXICON/elamite.json, spelled as its transliteration or as quoted in its attestation
#   ('name', ATF, name, suffix)      a personal name of src/data/names.json in its CDLI spelling, plus a grammatical suffix ('' or '-na')
#   ('num', ATF)                     a numeral in the PF notation (CDLI ATF of Hallock's PF texts)
LABEL = 'reconstructed on the Treasury tablets\' published formulary — not a surviving text (C)'
EL = {e['form']: e for e in json.load(open('research/LEXICON/elamite.json', encoding='utf8'))}
NAMES = {n['name']: n for n in json.load(open('src/data/names.json', encoding='utf8'))['names']}
SUBS = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
def cdli_to_atf(s):
    """CDLI ASCII ATF (names.json) → the Unicode ATF of the repository (sz → š, index digits → subscripts)"""
    s = s.replace('sz', 'š').replace('SZ', 'Š')
    return re.sub(r'(?<=[a-zšA-ZŠ])(\d+)', lambda m: m.group(1).translate(SUBS), s)
NUM = re.compile(r'^(\d+(/\d+)?\((diš|u|diš@v)\))(-na|-um-me-man-na)?$')
nodet = lambda s: re.sub(r'\{[^}]*\}', '', s)
def tokens_in(s):
    return set(re.split(r'[\s"“”(),;:]+', s.normalize('NFC') if hasattr(s, 'normalize') else unicodedata.normalize('NFC', s)))

def check_word(w):
    kind, atf = w[0], w[1]
    if kind == 'lex':
        e = EL[w[2]]  # KeyError: not a lexicon word
        where = unicodedata.normalize('NFC', f"{e.get('transliteration', '')} {e.get('attested', '')}")
        toks = set(re.split(r'[\s"“”(),;:…]+', where))
        ok = atf in toks or nodet(atf) in {nodet(t) for t in toks}
        assert ok, f'{atf}: not spelled so in the lexicon entry {w[2]} ({where[:120]})'
        return {'w': atf, 'kind': 'word', 'lex': w[2], 'gloss': e['gloss'], 'tier': str(e['tier']), 'src': e['src'],
                'spelling': 'as in the lexicon entry' + ('' if atf in toks else ' (the determinative as written in PF)')}
    if kind == 'name':
        n = NAMES[w[2]]
        base = cdli_to_atf(n['atf']); assert atf == base + w[3], (atf, base, w[3])
        assert w[3] in ('', '-na')
        return {'w': atf, 'kind': 'name', 'name': w[2], 'gloss': f"{w[2]} (a personal name; {'-na: of, by (after kurmin)' if w[3] else 'the name alone'})",
                'tier': 'A (name form, PF via CDLI) / C (this person)', 'src': ['CDLI-PF'], 'attested_in': n['texts']}
    if kind == 'num':
        for part in atf.split(): assert NUM.match(part), atf
        return {'w': atf, 'kind': 'numeral', 'gloss': 'numeral (PF notation)', 'tier': 'A (notation)', 'src': ['CDLI-PF']}
    raise ValueError(w)

def recon_text(tid, kind, lines, english, date, notes):
    rows, lines_atf, lines_cun = [], [], []
    for line in lines:
        ws = [check_word(w) for w in line]; rows.extend(ws)
        a = ' '.join(w['w'] for w in ws); lines_atf.append(a)
        cun, miss = atf_to_cun(a); assert not miss, (tid, miss); lines_cun.append(cun.replace(' ', ''))
    for w in rows: assert w['tier'][0] in 'ABC'
    el_atf = ' '.join(lines_atf)
    return {'kind': kind, 'label': LABEL, 'reconstructed': True, 'date': date,
            'el_atf': el_atf, 'lines_atf': lines_atf, 'lines_cuneiform': lines_cun, 'el_cuneiform': ''.join(lines_cun),
            'words': rows, 'english': english,
            'english_label': 'the project\'s English rendering of its own reconstruction (C)',
            'tier': {'text': 'C (' + LABEL + ')', 'words': 'A/B per word (lexicon, PF via CDLI; ARIo for karša); KU₃.BABBAR "silver" C as an Elamite word',
                     'names': 'A as names (PF via CDLI); the persons of 467 are the project\'s (C)', 'signs': 'B (ATF indices → OSL, as for the carved texts)',
                     'date': 'C (chosen to fit every day of the simulated year: D-198)', 'layout': 'C (lines, no word spaces, sign height)'},
            'notes': notes, 'src': ['CDLI-PF', 'ARIO', 'IR-TREAS', 'IR-PET', 'OSL', 'RECON']}

L = lambda atf, form: ('lex', atf, form)
N = lambda atf, name, suf='': ('name', atf, name, suf)
SILVER = [L('kur-ša-um', 'karša'), L('KU₃.BABBAR', 'KU₃.BABBAR'), L('kur-min₂', 'kurmin'), N('{hal}ir-še-na-na', 'Iršena', '-na')]
TREAS = L('{aš}ka₄-ap-nu-iš-ki-ma', 'kapnuški')
recon_texts = {
    # the filed tablets (the archive on the benches): a memorandum of the last months of year 18, written before year 19
    # began, so that it is in the archive on every day the world shows (D-198)
    'PTR-1': recon_text('PTR-1', 'treasury_memorandum_reconstructed', [
        [('num', '6(diš)'), *SILVER[:3]],
        [SILVER[3], TREAS],
        [N('{hal}man-ma-ak-ka₄', 'Manmakka'), L('a-ak', 'ak'), L('{hal}ak-ka₄-ia-še', 'akkayaše')],
        [L('du-iš-da', 'dušda'), L('{hal}kur-taš', 'kurtaš'), L('gal-li', 'gal')],
        [L('{aš}be-ul', 'beul'), ('num', '1(u) 8(diš)-na'), L('{an}ITI.MEŠ', 'ITI.MEŠ')],
        [L('{an}sa-mi-ia-maš', 'Samiyamaš'), L('a-ak', 'ak')],
        [L('{an}mi-ia-kan₂-na-iš-na', 'Miyakannaš'), L('PAP', 'PAP'), ('num', '2(diš)')],
        [L('{an}ITI.MEŠ', 'ITI.MEŠ'), L('ha-tu-ma', 'hatuma')],
    ], '6 karša of silver, at the disposal of Iršena, in the treasury: Manmakka and his companions received (it), (as) rations (of) workers. '
       '18th year (of Xerxes), the eleventh and the twelfth month: in total a period of two months.',
       {'regnal_year': 18, 'king': 'Xerxes', 'months': [11, 12], 'bce': '468/7 (the months: early 467)', 'written': 'by the end of year 18 (C)'},
       ['A memorandum, not a letter-order: the letter-order\'s address ("Tell PN, the treasurer: PN says …", Elamite tiriš) and its command to pay are not written, because the address verb and the imperative are not sourced here (tiriš was removed with the EWB data, D-192); the receipt formulary of the Fortification texts (amount, kurmin PN-na "at the disposal of", the receivers, dušda "received", the date) is kept word for word.',
        'Silver in lieu of rations: "(as) rations (of) workers" (kurtaš galli, PF 50) stands for it; the rate per head and the ration it replaces are not written (their Elamite words are not sourced).',
        'The amount in karša only (the shekel is not sourced); 6 karša for a group over two months is C (PEOPLE.md §3c).'])
    ,
    # the fresh tablets on the drying board: the first month of year 19, the month the world begins in
    'PTR-2': recon_text('PTR-2', 'treasury_memorandum_reconstructed', [
        [('num', '3(diš) 1/2(diš)'), *SILVER[:2]],
        SILVER[2:],
        [TREAS],
        [N('{hal}ba-ka₄-du-iš-da', 'Bakadušda'), L('a-ak', 'ak')],
        [N('{hal}kar-ki-iš', 'Karkiš'), L('du-iš-da', 'dušda')],
        [L('{hal}kur-taš', 'kurtaš'), L('gal-li', 'gal')],
        [L('{an}ITI.MEŠ', 'ITI.MEŠ'), L('{an}ha-du-kan₂-nu-ia-na', 'Hadukannaš')],
        [L('{aš}be-ul', 'beul'), ('num', '1(u) 9(diš@v)-na')],
    ], '3½ karša of silver, at the disposal of Iršena, in the treasury: Bakadušda and Karkiš received (it), (as) rations (of) workers. '
       'First month, 19th year (of Xerxes).',
       {'regnal_year': 19, 'king': 'Xerxes', 'months': [1], 'bce': '467 (1 Nisannu = 17 April 467)', 'written': 'in the first month of year 19 (C)'},
       ['"Bakadušda and Karkiš received (it)" is the wording of PF 13 (P382699), with the same two names; "19th year" is spelled as in PF 59 (P382745).',
        'Dated to the first month because the world opens on its first day and runs through the year: a fresh tablet of a later month would stand in the room before it was written (D-198).',
        'As PTR-1: a memorandum, the amount in karša, the rations it stands for not itemised.'])
    ,
    # the tablet being written: the scribe has impressed the amount, the source and the first receiver; the verb, the
    # purpose and the date are not yet written (the data holds only what is impressed)
    'PTR-3': recon_text('PTR-3', 'treasury_memorandum_reconstructed_unfinished', [
        [('num', '2(diš)'), *SILVER[:2]],
        SILVER[2:],
        [TREAS],
        [N('{hal}ir-ti-ma', 'Irtima')],
    ], '2 karša of silver, at the disposal of Iršena, in the treasury: Irtima … (the scribe has written no further).',
       {'regnal_year': 19, 'king': 'Xerxes', 'months': None, 'bce': '467/6', 'written': 'being written; the date line is not yet reached'},
       ['Unfinished: only the impressed signs are data; nothing of the rest is supplied.']),
}

meta = {
    'what': 'texts written or impressed on objects in the world (tablets, sealings, leather): the published seal texts (texts, A) as the ancient text in standard transliteration and its sign sequence; and the Treasury memoranda RECONSTRUCTED by the project on the Treasury tablets\' published formulary (recon_texts, C; not surviving texts; D-198). English renderings are the project\'s (C), shown only in the translation layer',
    'built_by': 'tools/build_writing.py from data/corpus/ario.jsonl (ARIo, Schmitt 2009, CC0), data/corpus/osl.asl (ORACC OSL), research/LEXICON/elamite.json and src/data/names.json',
    'decision': 'D-179; D-198 (the reconstructed Treasury memoranda)',
}
out = {'_meta': meta, 'texts': texts, 'recon_texts': recon_texts}
# the seals and the written objects
out['seals'] = {
    'PTS-treasurer-Darius': {
        'text': 'SDa', 'tier': 'C', 'placeholder': False,
        'attested': 'B: a royal seal with a trilingual royal-name inscription of Darius was still used under Xerxes and was at the disposal of the chief of the Treasury (search extracts of Iranica, Persepolis Administrative Archives / Persepolis Elamite Tablets: WRITING-SX, IR-TREAS)',
        'wording': 'C: the exact wording on that seal is not reachable here; the SDa formula (the same royal-name formula, ARIo Q007203) stands for it (Q-320)',
        'design': 'C reconstruction: the royal hero holding two rampant lions (the royal seals of Darius and Xerxes show the king victorious over animals or monsters: WRITING-SX, B), a trilingual inscription panel, ground and border lines; no licensed image of the seal was available (B6)',
        'height_mm': 26, 'roll_mm': 62, 'src': ['WRITING-SX', 'IR-TREAS', 'ARIO', 'OSL', 'NOTO', 'RECON'],
    },
    'PTS-Xerxes-hero': {
        'text': 'XSeal', 'tier': 'C', 'placeholder': False,
        'attested': 'B: a Treasury seal impression "Hero Triumphant with Xerxes Inscription" (ISAC Photographic Archives, Contents of the Treasury, caption seen as a search extract: ISAC-FINDS); Treasury sealings share seals with the Treasury tablets (WRITING-SX)',
        'wording': 'C: the inscription of that seal is not reachable here; ARIo Q009270 (an Old Persian royal-name formula of Xerxes) stands for it (Q-320)',
        'design': 'C reconstruction: the royal hero stabbing a rampant lion, an Old Persian inscription panel, ground and border lines',
        'height_mm': 24, 'roll_mm': 58, 'src': ['ISAC-FINDS', 'WRITING-SX', 'ARIO', 'NOTO', 'RECON'],
    },
}
PT_WHY = ('no Persepolis Treasury text is reachable (Cameron OIP 65 and JNES 1958/1965 on blocked hosts, B6; the CDLI dump '
          'carries no PT text): the text is RECONSTRUCTED by the project on the published formulary, every word, name and '
          'numeral from the sourced lexicon, names and PF notation (D-198); BLOCKERS B18, NEEDS #15')
PT_COMMON = {'seal': 'PTS-treasurer-Darius', 'sealed_on': 'left edge (C, SITE_SPEC treasury.r_scribes_room)',
             'cord_hole': 'B: holes and remnants of cords at a corner of the Treasury tablets indicate they were tied to leather scrolls (Cameron\'s inference, via WRITING-SX)',
             'reverse': 'uninscribed (C: the memoranda fit the obverse)', 'tier': 'C',
             'src': ['IR-TREAS', 'IR-PET', 'WRITING-SX', 'MATCULT-R', 'CDLI-PF', 'RECON']}
out['objects'] = {
    'pt_letter': {
        'what': 'Persepolis Treasury tablet (PT type), Elamite, filed on the benches of the Treasury scribes\' room; carried by scribes (prop "tablet"). Every filed tablet shows the same text (one face of the writing atlas: an economy of the build)',
        'text': None, 'recon': 'PTR-1', 'placeholder': False, 'reconstructed': True, 'recon_why': PT_WHY, **PT_COMMON,
    },
    'pt_letter_fresh': {
        'what': 'Persepolis Treasury tablet (PT type), Elamite, fresh, drying on the board by the scribe\'s desk, written and sealed on the left edge',
        'text': None, 'recon': 'PTR-2', 'placeholder': False, 'reconstructed': True, 'recon_why': PT_WHY, **PT_COMMON,
    },
    'pt_letter_unfinished': {
        **PT_COMMON, 'what': 'Persepolis Treasury tablet (PT type), Elamite, being written: four lines so far, the last one short, not yet sealed',
        'text': None, 'recon': 'PTR-3', 'placeholder': False, 'reconstructed': True, 'recon_why': PT_WHY, 'seal': None, 'sealed_on': 'not yet sealed',
    },
    'leather_scroll': {
        'what': 'a rolled Aramaic document on leather, tied with a cord and sealed with a clay bulla; the text is inside the roll and not shown',
        'text': None, 'placeholder': False, 'text_visible': False,
        'why_no_text': 'no leather document from Persepolis survives; the Aramaic letters on leather (Arshama, Egypt) are only the type (B/C); nothing is written where it could be seen. Not reconstructed (D-198): the Aramaic lexicon has no sourced word for the Treasury\'s own formulary (fortress byrtʾ, segan sgnʾ, "this" znh, "before" qdm are not in it), so no text is composed',
        'seal': 'PTS-treasurer-Darius', 'tier': 'C',
        'attested': 'B: Aramaic on parchment at Persepolis (Fortification texts on Aramaic scribes and parchment, IR-PET/WRITING-SX); Treasury tablets were tied to leather scrolls with an Aramaic duplicate (Cameron\'s inference, WRITING-SX); leather letters with a bulla (Arshama letters: type, HALMI-SX)',
        'src': ['WRITING-SX', 'IR-PET', 'HALMI-SX', 'ARSHAMA-BOD', 'RECON'],
    },
    'door_sealing': {
        'what': 'clay sealing over the cord between the knobs of a sealed Treasury door, with a rolled seal impression',
        'text': 'XSeal', 'seal': 'PTS-Xerxes-hero', 'placeholder': False, 'tier': 'C',
        'src': ['MATCULT-R', 'ISAC-FINDS', 'WRITING-SX', 'ARIO', 'RECON'],
    },
}
json.dump(out, open('src/data/writing.json', 'w'), ensure_ascii=False, indent=1)
print('recon', {k: (len(v['el_cuneiform']), len(v['words'])) for k, v in recon_texts.items()})
print('texts', {k: (len(v['op_cuneiform']), len(v.get('el_cuneiform', '')), len(v.get('bab_cuneiform', ''))) for k, v in texts.items()})
