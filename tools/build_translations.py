"""Build src/data/translations.json: the PROJECT'S OWN English translations of every inscription the world carves or the
translation layer lists (and of the two seal texts impressed in clay), one per version (Old Persian, Elamite,
Babylonian), made from the ARIo transliterations in src/data/inscriptions.json and src/data/writing.json (Schmitt 2009,
ORACC; CC0) (D-198, BLOCKERS B17a, NEEDS #14).

Tier C, and labelled so wherever shown: "Translation by the project from the ARIo edition; not a published translation;
verify against Schmitt 2009 / Kent 1953". Made from the edition's own words, with the repository's lexicons and the royal
inscriptions' formulary; literal and plain; no modern published translation's wording is used (no Livius, Kent, Schmitt or
Lecoq sentence was consulted for it: D-167 keeps Livius out of the build, and the others are not reachable here, B6).

Marks in the English:
  ( )   words added for English sense (the implied verb "is", "(of Xerxes)" after a regnal year, a gloss of a name)
  [ ]   words whose signs are mostly restored by the editor after later damage (the stone had them in 467)
  ⟨ ⟩   words the edition supplies that the engraver omitted (never on the stone)
  (?)   an uncertain rendering (the word's sense is not secure, or it is taken from the parallel Old Persian)
  …     signs lost and not restored
Besides the marks, the words with restored signs are listed per version from the edition itself (op_words for the Old
Persian; the CATF lines for the Elamite and Babylonian), so a partly restored word is never hidden.

    python3 tools/build_translations.py      (after tools/build_inscriptions.py, tools/build_op_signs.ts, tools/build_writing.py)
"""
import json, re

LABEL = 'Translation by the project from the ARIo edition; not a published translation; verify against Schmitt 2009 / Kent 1953'

# ------------------------------------------------------------------------------------------------ recurring pieces
def god_op(king):
    return (f'Ahuramazda is a great god, who created this earth, who created that sky, who created man, who created '
            f'well-being for man, who made {king} king, one king of many, one commander of many.')
def god_el(king):
    return (f'Ahuramazda is a great god, who created this earth, who created that heaven, who created man, who created '
            f'well-being (šiyatiš) for man, who made {king} king, one king of many, one commander of many.')
X_OP = ('I am Xerxes, the great king, king of kings, king of the lands of many peoples, king on this great earth far and '
        'wide, the son of Darius the king, an Achaemenid.')
X_EL = ('I am Xerxes, the great king, king of kings, king of the lands of many peoples, king on this earth, the great, the '
        'far-reaching (?), the son of Darius the king, an Achaemenid.')
X_BAB = ('I am Xerxes, the great king, king of kings, king of the lands of all tongues, king of this great, far-reaching '
         'earth, the son of Darius the king, an Achaemenid.')

TR = {
 'XPa': {
  'op': god_op('Xerxes') + ' ' + X_OP + ' Xerxes the king says: By the will of Ahuramazda I made this gateway, All-Lands (Visadahyu). '
        'Much other fine work was done in this Pārsa, which I did and which my father did. Whatever work is seen to be fine, all '
        'that we did by the will of Ahuramazda. Xerxes the king says: May Ahuramazda protect me and my kingdom, and what was done '
        'by me and what was done by my father: that too may Ahuramazda protect.',
  'el': god_el('Xerxes') + ' ' + X_EL + ' Xerxes the king says: By the will of Ahuramazda I made this (gateway) All-Lands '
        '(Missadahuiš). Much other fine (work) was made in this Parsa, which I made and which my father made. What was made and '
        'is seen as fine, all that we made by the will of Ahuramazda. Xerxes the king says: May Ahuramazda protect me, and my '
        'kingdom, and what I made and what my father made: that too may Ahuramazda protect.',
  'bab': 'Ahuramazda is a great god, who gave this earth, who gave that heaven, who gave mankind, who gave good fortune to '
         'mankind, who made Xerxes king, one among many kings, one among many commanders. ' + X_BAB + ' Xerxes the king says: '
         'Under the protection (lit. the shadow) of Ahuramazda I made this gate, whose name is Uispidāʾi (All-Lands). And many '
         'other fine (works) were made in this land Parsa, which I made and which my father made; and whatever works are seen as '
         'fine, all of them we made under the protection of Ahuramazda. Xerxes the king says: May Ahuramazda protect me, and my '
         'kingship and my lands, and what I made and what my father made: those too may Ahuramazda protect.',
 },
 'XPb': {
  'op': god_op('Xerxes') + ' ' + X_OP + ' Xerxes the great king says: What was done by me here, and what was done by me further '
        'off, all that I did by the will of Ahuramazda. May Ahuramazda protect me with the gods, and my kingdom, and what was done '
        'by me.',
  'el': god_el('Xerxes') + ' ' + X_EL + ' Xerxes the great king says: What I made here (?), and what I made further off (?), all that '
        'I made by the will of Ahuramazda. May Ahuramazda protect me with the gods, and (my) kingdom, and what I made.',
  'bab': 'Ahuramazda is a great god, who gave this earth, who gave that heaven, who gave mankind, who gave good fortune to the '
         'people, who gave kingship to Xerxes, one king over many kings, one commander over many. ' + X_BAB + ' Xerxes the great '
         'king says: Under the protection of Ahuramazda I built this house. May Ahuramazda protect me with the gods, and my '
         'kingship, and what I have made.',
 },
 'XPc': {
  'op': god_op('Xerxes') + ' ' + X_OP + ' Xerxes the great king says: By the will of Ahuramazda, this palace (hadiš) Darius the '
        'king built, he who was my father. May Ahuramazda protect me with the gods, and what was done by me, and what was done by '
        'my father Darius the king: that too may Ahuramazda protect with the gods.',
  'el': god_el('Xerxes') + ' I am Xerxes, the great king, king of kings, king of the lands, of the many peoples (?), king on this '
        'earth, the great, the far-reaching (?), the son of Darius the king, an Achaemenid. Xerxes the great king says: By the '
        'will of Ahuramazda this palace Darius the king made, he who (was) my father. May Ahuramazda protect me together with the '
        'gods, and what I made and what my father Darius the king made: that too may Ahuramazda protect together with the gods.',
  'bab': 'The great god Ahuramazda, who created heaven and created this earth, who created the people, who gave good fortune to '
         'the people, who made Xerxes king, king over many kings, who alone gives orders to the whole of all the lands (?). I am '
         'Xerxes, the great king, king of kings, king of the lands of all tongues, king of this great, wide earth, the son of Darius '
         'the king, an Achaemenid. Xerxes the great king says: Under the protection of Ahuramazda, this house Darius the king, my '
         'own father, built. May Ahuramazda protect me with all the gods, and what I have made, and what Darius the king, my own '
         'father, made; and that too may Ahuramazda protect with all the gods.',
 },
 'XPd': {
  'op': god_op('Xerxes') + ' ' + X_OP + ' Xerxes the great king says: By the will of Ahuramazda I built this palace (hadiš). May '
        'Ahuramazda protect me with the gods, and my kingdom, and what was done by me.',
  'el': god_el('Xerxes') + ' ' + X_EL + ' Xerxes the great king says: By the will of Ahuramazda I made this palace. May '
        'Ahuramazda protect me together with the gods, and (my) kingdom, and what I made.',
  'bab': 'Ahuramazda is a great god, who gave this earth, who gave that heaven, who gave mankind, who gave good fortune to the '
         'people, who gave kingship to Xerxes, one king over many kings, one commander over many. ' + X_BAB + ' Xerxes the great '
         'king says: What I made here and what I made in another place, all of it, as much as I made, I made under the protection '
         'of Ahuramazda. May Ahuramazda protect me with the gods, and my kingship, and what I have made.',
 },
 'XPe': {
  'op': 'Xerxes, the great king, king of kings, the son of Darius the king, an Achaemenid.',
  'el': 'Xerxes, the great king, king of kings, the son of Darius the king, an Achaemenid.',
  'bab': 'Xerxes, the great king, king of kings, the son of Darius the king, an Achaemenid.',
 },
 'DPh': {
  'op': 'Darius, the great king, king of kings, king of the lands, the son of Hystaspes, an Achaemenid. Darius the king says: '
        'This is the kingdom which I hold: from the Scythians who are beyond Sogdiana, from there as far as Kush; from India, from '
        'there as far as Sardis; (the kingdom) which Ahuramazda, the greatest of the gods, granted to me. May Ahuramazda protect me '
        'and my royal house.',
  'el': 'Darius, the great king, king of kings, king of the lands, the son of Hystaspes, an Achaemenid. Darius the king says: The '
        'kingdom which I hold: from the Scythians, those beyond (?) Sogdiana, as far as Kush; from India as far as Sardis; which '
        'Ahuramazda gave me, he who is the greatest of the gods. May Ahuramazda protect me and my house.',
  'bab': 'Darius, the great king, king of kings, king of the lands, the son of Hystaspes, an Achaemenid. Darius the king says: '
         'This kingship which I hold, from the land of the Gimirri (the Scythians) who are across (from) Sogdiana as far as Kush, '
         'from India as far as Sardis, which Ahuramazda gave (me), he who is greater than the gods: may Ahuramazda protect me with '
         'the gods, and my house.',
 },
 'DNa': {
  'op': god_op('Darius') + ' I am Darius, the great king, king of kings, king of the lands of all peoples, king on this great earth '
        'far and wide, the son of Hystaspes, an Achaemenid, a Persian, the son of a Persian, an Aryan, of Aryan stock. Darius the '
        'king says: By the will of Ahuramazda these are the lands which I seized outside Persia; I ruled over them; they brought '
        'me tribute; what was said to them by me, that they did; my law, that held them firm: Media, Elam, Parthia, Aria, Bactria, '
        'Sogdiana, Chorasmia, Drangiana, Arachosia, Sattagydia, Gandhara, India, the haoma-(?) Scythians, the Scythians with '
        'pointed caps, Babylonia, Assyria, Arabia, Egypt, Armenia, Cappadocia, Sardis, Ionia, the Scythians who are across the '
        'sea, Skudra, the Ionians who wear the petasos (?), the Libyans, the Kushites, the men of Maka, the Carians. Darius the '
        'king says: When Ahuramazda saw this earth in turmoil, he then granted it to me; he made me king; I am king. By the will '
        'of Ahuramazda I set it in its place; what I said to them, that they did, as was my wish. If now you should think: "How '
        'many are those lands which Darius the king held?", look at the figures who bear the throne; then you will know, then it '
        'will become known to you: the spear of the Persian man has gone far; then it will become known to you: the Persian man '
        'has fought battles far from Persia. Darius the king says: What has been done, all that I did by the will of Ahuramazda. '
        'Ahuramazda brought me help until I had done the work. May Ahuramazda protect me from harm, and my royal house, and this '
        'land. This I ask of Ahuramazda; this may Ahuramazda give me. O man, let the command of Ahuramazda not seem repugnant to '
        'you; do not leave the right path; do not be violent (?).',
 },
 'DNb': {
  'op': 'Ahuramazda is a great god, who created this excellent (work) which is seen, who created well-being for man, who bestowed '
        'wisdom and vigour upon Darius the king. Darius the king says: By the will of Ahuramazda I am of such a kind that I am a '
        'friend to what is right; I am no friend to what is wrong. It is not my wish that the weak man should be wronged because '
        'of the strong; nor is it my wish that the strong man should be wronged because of the weak. What is right, that is my '
        'wish. To the man who follows the Lie I am no friend. I am not hot-tempered. Whatever rises in me in a dispute I hold '
        'firmly by my mind; I am firmly in command of myself. The man who works together (with me), as his work together deserves, '
        'so I care for him; the one who does harm, as his harm deserves, so I punish him. It is not my wish that a man should do '
        'harm; nor is it my wish, if he does harm, that he should go unpunished. What a man says against a man does not convince '
        'me until I have heard the account of both. What a man does or brings according to his powers, ⟨by that⟩ I am satisfied, '
        'and it is much my wish, and I am well pleased, ⟨and I give much to loyal men⟩. Of such a kind are my understanding and my '
        'command: when you see or hear what has been done by me, both in the palace and in the war camp, this is my vigour, over '
        'and above my mind and understanding. This moreover is my vigour: as far as my body has the strength, as a fighter I am a '
        'good fighter. Once my understanding stands in its place, whether I see a rebel or do not see one, by understanding and by '
        'command I then think myself above panic, when I see a rebel as when I do not see one. I am practised (?) both with hands '
        'and with feet. As a horseman I am a good horseman; as a bowman I am a good bowman, both on foot and on horseback; as a '
        'spearman I am a good spearman, both on foot and on horseback. These are the skills which Ahuramazda bestowed upon me, and '
        'I had the strength to bear them. By the will of Ahuramazda, what was done by me I did with these skills which Ahuramazda '
        'bestowed upon me. Young man, make it well known [of what kind] you are, of what kind your skills, of what kind your '
        'conduct. Let [that] not seem [best] to you which [is said] in your ears; listen also to what is said [beyond it]. Young '
        'man, let not [that] [seem] [good] to you [which] … does; what [the weak man] [does], look at that too. Young man, … do '
        'not … (?) … [nor] in well-being (?) become unpractised (?) … let them not … (?) …',
 },
 'DPa': {
  'op': 'Darius, the great king, king of kings, king of the lands, the son of Hystaspes, an Achaemenid, who built this palace (tacara).',
  'el': 'Darius, the great king, king of kings, king of the lands, (king) of all peoples (?), the son of Hystaspes, an Achaemenid, '
        'who made this palace (taccara).',
  'bab': 'Darius, the great king, king of kings, king of the lands of all tongues, the son of Hystaspes, an Achaemenid, who built '
         'this house.',
 },
 'DPb': {
  'op': 'Darius, the great king, the son of Hystaspes, an Achaemenid.',
  'el': 'Darius, the great king, the son of Hystaspes, an Achaemenid.',
  'bab': 'Darius, the great king, the son of Hystaspes, an Achaemenid.',
 },
 'DPc': {
  'op': 'A window frame (?) of stone, made in the house of Darius the king.',
  'el': 'A window frame (?) (hardastana) of stone (?), made in the house of Darius the king.',
  'bab': 'Window frames (?) (kuburrû) of stone, made in the house of Darius the king.',
 },
 'DPd': {
  'op': 'Great Ahuramazda, the greatest of the gods: he made Darius king; he granted him the kingdom. By the will of Ahuramazda '
        'Darius is king. Darius the king says: This land Persia which Ahuramazda granted to me, which is fine, rich in good horses '
        'and in good men, by the will of Ahuramazda and of me, Darius the king, does not fear any other. Darius the king says: May '
        'Ahuramazda bring me help with all the gods; and may Ahuramazda protect this land from an (enemy) army, from a bad year, '
        'from the Lie. May no army, no bad year, no Lie come upon this land. This I ask of Ahuramazda as a favour, with all the '
        'gods; [this] favour may Ahuramazda grant me, [with] all the gods.',
 },
 'DPe': {
  'op': 'I am Darius, the great king, king of kings, king of the lands, of these many (lands), the son of Hystaspes, an '
        'Achaemenid. Darius the king says: By the will of Ahuramazda these are the lands which I held with this Persian army, '
        'which were afraid of me and brought me tribute: Elam, Media, Babylonia, Arabia, Assyria, Egypt, Armenia, Cappadocia, '
        'Sardis, the Ionians who are of the mainland and those who are of the sea, and the lands which are across the sea: '
        'Sagartia, Parthia, Drangiana, Aria, Bactria, Sogdiana, Chorasmia, Sattagydia, Arachosia, India, Gandhara, the Scythians, '
        'Maka. Darius the king says: If you should think thus, "May I not fear another", protect this Persian people. If the '
        'Persian people is protected, well-being, unbroken for the longest time, will come down by Ahura (?) upon this house.',
 },
 'DPf': {
  'el': 'I am Darius, the great king, king of kings, king of the lands, king on this earth, the son of Hystaspes, an Achaemenid. '
        'And Darius the king says: On this place (?) this fortress was built; before (it), no fortress had been built here. By '
        'the will of Ahuramazda I built this fortress. And Ahuramazda so wished (?), together with all the gods, that this fortress '
        'should be built. And I built it, and built it complete (?), fine and strong (?), just as I wished. And Darius the king '
        'says: May Ahuramazda protect me together with all the gods, and this fortress too, and also what was set up (?) on this '
        'place: may it not (be overthrown?) (?) as the hostile (?) man intends (?).',
 },
 'DPg': {
  'bab': 'Ahuramazda is great, who is greatest over all the gods, who created heaven and earth, who created the people, who gave '
         'all good fortune, (by which) the people live in it (the earth); who made Darius king and gave to Darius the king the '
         'kingship over this wide earth, in which are many lands: Persia, Media and the other lands of other tongues, of mountains '
         'and of plain, of this side of the Bitter River (the sea) and of that side of the Bitter River, of this side of the '
         'thirsty land (the desert) and of that side of the thirsty land. Darius the king says: Under the protection of '
         'Ahuramazda, these are the lands which did this (work), which were here (?): Persia, Media and the other lands of other '
         'tongues, of mountains and of plain, of this side of the Bitter River and of that side of the Bitter River, of this side '
         'of the thirsty land and of that side of the thirsty land, according to the order that I laid on them. What I did, all '
         'of it I did under the protection of Ahuramazda. May Ahuramazda protect me with all the gods, me and what I love (?).',
 },
 # D-214 (gap audit items 27, 28): Xerxes' plaque text of the Apadana, his column-base texts and his garment line
 'XPg': {
  'op': 'Xerxes the great king says: By the will of Ahuramazda, much that is good Darius the king, who (was) my father, did '
        'and ordered; and by the will of Ahuramazda I added to that work and did more. May Ahuramazda protect me [together] '
        'with the gods, and my kingdom.',
 },
 'XPj': {
  'op': 'I am Xerxes, the great king, king of kings, king of the lands, king on this earth, the son of Darius the king, an '
        'Achaemenid. Xerxes the king says: This palace (tacara) I built.',
  'el': 'I (am) Xerxes, the great king, king of kings, king of the lands (of the peoples), king on this earth, the son of Darius '
        'the king, an Achaemenid. Xerxes the king says: This palace (taccara) I made.',
  'bab': 'I am Xerxes, the great king, king of kings, king of the lands, king of this earth, the son of Darius the king, an '
         'Achaemenid. Xerxes the king says: This house (taššaru) I built.',
 },
 'XPk': {
  'op': 'Xerxes, the son of Darius the king, [an Achaemenid].',
  'el': 'Xerxes, [the son of Darius the king, an Achaemenid].',
  'bab': 'Xerxes, [the son (?)] of Darius [the king, an Achaemenid].',
 },
 'XPm': {
  'op': 'Xerxes the king says: This palace (tacara) I built.',
  'el': '(Thus) says Xerxes [the king: This palace (taccara) I made].',
  'bab': 'Xerxes the king says: This house (taššaru) I built.',
 },
 # the seal texts impressed in clay (writing.json texts)
 'SDa': {'op': 'I am Darius the king.', 'el': 'I (am) Darius the king.', 'bab': 'I am Darius, the great king.'},
 'XSeal': {'op': 'I am Xerxes the king.'},
}

NOTES = {
 ('XPa', 'op'): ['Visadahyu "All-Lands" (Elamite Missadahuiš, Babylonian Uispidāʾi) is the gateway\'s own name.'],
 ('XPa', 'bab'): ['The Babylonian says "gave" (iddinu) where the Old Persian says "created" (adā).'],
 ('XPb', 'el'): ['"here" and "further off" render the Elamite words (AŠ)ma-at-ta₂ and (AŠ)me-ša₂-me-ra-ka₄-ta₂ by the sense of the Old Persian idā and apataram (?).'],
 ('XPc', 'op'): ['The god\'s name is written as two words here (A.urahya-Māzdaha).'],
 ('XPc', 'el'): ['The titulary\'s "of the many peoples" renders ir-še-ik-ki-ip-in-na … da-na-iš-pe₃-na (?).'],
 ('DPh', 'bab'): ['The Babylonian names the northern peoples Gimirri, where the Old Persian has Sakā (the Scythians).'],
 ('DNa', 'op'): ['The peoples\' names are given in their usual English forms; "haoma-(?)" renders Hau̯mavargā and "who wear the petasos (?)" renders takabarā, both of uncertain sense.'],
 ('DNb', 'op'): ['The end of the text is damaged; the edition leaves several words unread (…).', 'Words in ⟨ ⟩ are in the edition (restored from the parallel text) but were never cut on the stone.'],
 ('DPf', 'el'): ['An Elamite text of its own, with no Old Persian or Babylonian version: several of its words are of uncertain sense (the marks (?)), and the last clause is rendered by the context.'],
 ('DPg', 'bab'): ['A Babylonian text of its own, with no Old Persian or Elamite version.'],
 ('XPg', 'op'): ['An Old Persian text only: the edition gives no Elamite or Babylonian version.'],
 ('XPj', 'op'): ['Xerxes calls his palace tacara here, the word of Darius\' palace texts (DPa).'],
 ('XPk', 'bab'): ['The sign for "son" (A) is read with doubt by the edition (a?).'],
 ('XPm', 'op'): ['The same words as the last sentence of XPj.'],
 ('SDa', 'op'): ['A seal inscription; the three versions stand together on the seal (writing.json).'],
}

# ------------------------------------------------------------------------------------------------ restored words from the edition
SUBS = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
def catf_norm(s):
    s = s.replace('sz', 'š').replace('SZ', 'Š').replace('s,', 'ṣ').replace('S,', 'Ṣ').replace('t,', 'ṭ').replace('T,', 'Ṭ').replace("'", 'ʾ')
    return re.sub(r'(?<=[A-Za-zšŠṣṢṭṬ])(\d+)', lambda m: m.group(1).translate(SUBS), s)
def catf_restored(lines):
    """the words of a version's CATF lines that carry signs inside [ ] (restored by the editor after later damage), in the
    edition's CATF notation (logograms in lower case there), the brackets kept to show which signs"""
    text = ''
    for l in lines:
        l = re.sub(r"^\d+'?\.\s*", '', l)
        l = re.sub(r'%[a-z]+\s*', '', l).replace('_', '').rstrip(';').strip()
        text = text[:-1] + l.lstrip('-') if text.endswith('-') and l.startswith('-') else (text + ' ' + l if text else l)
    out, inside = [], False
    for w in text.split():
        has = inside or '[' in w
        for c in w:
            if c == '[': inside = True
            elif c == ']': inside = False
        if has: out.append(catf_norm(w).replace('#', '').replace('!', '').strip('-'))
    return out

insc = json.load(open('src/data/inscriptions.json', encoding='utf8'))
catf = json.load(open('data/corpus/ario_catf.json', encoding='utf8'))['texts']
writing = json.load(open('src/data/writing.json', encoding='utf8'))
FIELD = {'op': 'op_translit', 'el': 'el_atf', 'bab': 'bab_atf'}
out = {'_meta': {
    'what': 'the project\'s own English translations of the carved inscriptions and the seal texts, per version, from the ARIo transliterations (D-198)',
    'tier': 'C', 'label': LABEL,
    'by': 'the project (session 7, D-198), from the ARIo edition (Schmitt 2009, ORACC; CC0) as stored in src/data/inscriptions.json and writing.json, with the repository lexicons; no published translation used',
    'marks': {'( )': 'words added for English sense', '[ ]': 'words whose signs are mostly restored by the editor after later damage (on the stone in 467)',
              '⟨ ⟩': 'words the edition supplies that the engraver omitted (never on the stone)', '(?)': 'uncertain rendering', '…': 'signs lost, not restored'},
    'verify_against': ['R. Schmitt, Die altpersischen Inschriften der Achaimeniden (2009)', 'R. G. Kent, Old Persian (2nd ed. 1953)'],
    'built_by': 'tools/build_translations.py', 'src': ['PROJ-TR', 'ARIO', 'ARIO-CATF']}, 'texts': {}}
n = 0
for tid, vers in TR.items():
    rec = insc.get(tid) or writing['texts'].get(tid)
    assert rec, tid
    have = {v for v, f in FIELD.items() if str(rec.get(f) or '').strip()}
    assert set(vers) == have, f'{tid}: translated {sorted(vers)} but the data has {sorted(have)}'
    out['texts'][tid] = {}
    for v, en in vers.items():
        restored = []
        if tid in catf and v == 'op':
            for r in insc[tid].get('op_words', []):
                if r.get('restored'): restored.append(f"{r['ario']} ({r['restored']} of {len(r['signs'].split('-'))} signs)")
                elif r.get('cmp') == 'damaged': restored.append(f"{r['ario']} (lost, not restored)")
                elif r.get('cmp') == 'ario-only': restored.append(f"{r['ario']} (in the edition, not on the stone)")
        elif tid in catf and catf[tid].get(v):
            restored = catf_restored(catf[tid][v])
        out['texts'][tid][v] = {'en': en, 'tier': 'C', 'label': LABEL, 'notes': NOTES.get((tid, v), []), 'edition_restored_words': restored}
        n += 1
# every inscription the layer lists and every version the corpus mirror holds has a translation
for tid, rec in insc.items():
    if tid.startswith('_'): continue
    for v, f in FIELD.items():
        if str(rec.get(f) or '').strip(): assert v in out['texts'].get(tid, {}), f'{tid} {v}: no translation'
json.dump(out, open('src/data/translations.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
open('src/data/translations.json', 'a', encoding='utf8').write('\n')
print(f'{n} translations of {len(out["texts"])} texts')
