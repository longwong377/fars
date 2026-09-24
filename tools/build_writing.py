"""Build src/data/writing.json: the texts written or impressed on objects in the world (Phase 8 writing on objects, D-179).

Only published texts, stored as the ancient text in its standard transliteration and its sign sequence (never a modern
translation or commentary): the seal inscriptions come from ARIo (Schmitt 2009, CC0; mirror SLAB-NLP/Akk
data/jsonl/ario.jsonl, the same file tools/build_inscriptions.py reads). Elamite and Babylonian ATF are converted sign by
sign through the ORACC Sign List exactly as for the carved inscriptions (atf_to_cun); Old Persian is stored sign by sign
(the standard spelling of these three words, the same words the carved XPa-XPe use) and converted to code points by the
Unicode names of the Old Persian signs, so the rendered signs do not depend on the runtime spelling rules.

The Persepolis Treasury tablets' own texts (Cameron 1948/1958/1965) are NOT reachable from this sandbox (BLOCKERS B6, B18):
the tablets carry no readable text and are flagged as placeholders in the data this script writes."""
import json, sys, unicodedata, os
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

meta = {
    'what': 'texts written or impressed on objects in the world (tablets, sealings, leather); only published texts, as the ancient text in standard transliteration and its sign sequence; no translation (B17a)',
    'built_by': 'tools/build_writing.py from data/corpus/ario.jsonl (ARIo, Schmitt 2009, CC0) and data/corpus/osl.asl (ORACC OSL)',
    'decision': 'D-179',
}
out = {'_meta': meta, 'texts': texts}
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
out['objects'] = {
    'pt_letter': {
        'what': 'Persepolis Treasury letter-order tablet (PT type), Elamite, being written and filed in the Treasury scribes\' room; carried by scribes (prop "tablet")',
        'text': None, 'placeholder': True,
        'placeholder_why': 'no Persepolis Treasury text is reachable (Cameron OIP 65 and JNES 1958/1965 on blocked hosts, B6; the CDLI dump carries no PT text): the faces carry wedge impressions in lines with NO readable text (no sign sequence is invented); BLOCKERS B18, NEEDS #4',
        'seal': 'PTS-treasurer-Darius', 'sealed_on': 'left edge (C, SITE_SPEC treasury.r_scribes_room)',
        'cord_hole': 'B: holes and remnants of cords at a corner of the Treasury tablets indicate they were tied to leather scrolls (Cameron\'s inference, via WRITING-SX)',
        'tier': 'C', 'src': ['IR-TREAS', 'IR-PET', 'WRITING-SX', 'MATCULT-R', 'RECON'],
    },
    'leather_scroll': {
        'what': 'a rolled Aramaic document on leather, tied with a cord and sealed with a clay bulla; the text is inside the roll and not shown',
        'text': None, 'placeholder': False, 'text_visible': False,
        'why_no_text': 'no leather document from Persepolis survives; the Aramaic letters on leather (Arshama, Egypt) are only the type (B/C); nothing is written where it could be seen',
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
print('texts', {k: (len(v['op_cuneiform']), len(v.get('el_cuneiform', '')), len(v.get('bab_cuneiform', ''))) for k, v in texts.items()})
