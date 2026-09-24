#!/usr/bin/env python3
"""The personal-name pools from licensed evidence only (D-193; D-192: a source whose licence cannot be established is not
usable). Rewrites src/data/names.json in place, idempotently:

 - drops every name that rests on the EWB lemma base alone (DigitalPasts/ALP-MEGA2024 states no licence; Q-294);
 - keeps the names read in the Hallock PF texts carried by CDLI (tools/build_names.py's CDLI part; CDLI terms of use: free
   re-use with mention of CDLI), each with its text ids, and strips what came from EWB (the lemma and page, and the origin
   guesses read from its etyma);
 - guesses each name's origin again from its own spelling (C): an Old Iranian or an Elamite element listed below, else
   "unknown" (the list is RECOLLECTION of the onomastic literature, e.g. Mayrhofer 1973, Tavernier 2007: NOT SEEN);
 - adds the ordinary people's names that research/PEOPLE.md cites with a PF or PT text (tier B: the name form from a
   secondary citation of that text).

Usage: python3 tools/names_licensed.py
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'src', 'data', 'names.json')

# Old Iranian elements as the Elamite scribes wrote them (C): baga- "god", arta- "truth", miθra-, fra-/farnah-, aspa-
# "horse", -pāta "protected", vahu- "good", ātr- "fire", manya-, -dāta "given", čiça- "seed, lineage"
IRANIAN = [(r'^ba-(ka4|gi|ku)-', 'baga- "god"'), (r'^ir-(da|ti|tam5|tup)', 'arta- "truth"'), (r'^mi-(isz-sza2|ut-ra)', 'miθra-'),
           (r'(^|-)pir2-r[ai]', 'fra-/farnah-'), (r'(isz|asz2)-ba(-|$)', 'aspa- "horse"'), (r'-ba-(ad-)?da$', '-pāta "protected"'),
           (r'^u-man|^u2-man', 'vahu-manah "good thought"'), (r'^ha-tur', 'ātr- "fire"'), (r'^man-ia-', 'manya-'),
           (r'-da-ad-da$|-da-da$', '-dāta "given"'), (r'^ti-isz-sza2|^zi2-isz-szu', 'čiça- "seed, lineage"'), (r'^mar-du-nu-ia$', 'the Greek form Mardonius of the translation')]
# Elamite elements (C): Humban (hu-pan/um-ban), Napir, Šutruk, Kutir, the verbal base ut- "make", sunki "king"
ELAMITE = [(r'^hu-pan|^um-ban|^hu-ban', 'Humban'), (r'^na-pir', 'Napir'), (r'^szu-ut-ru', 'Šutruk'), (r'^ku-ti-ir', 'Kutir'),
           (r'^u2-ti-ra$', 'ut- "make"'), (r'^su-un-ka4', 'sunki "king"')]

# research/PEOPLE.md §2: ordinary people's names cited with a text (the officials, the royal women and the uncertain readings
# there are notable or unreadable, and are kept out of the pools as such)
PEOPLE = [
    {'name': 'Babiruš', 'sex': 'm', 'texts': ['PF 1288'], 'origin_guess': 'unknown', 'origin_basis': 'a name from the ethnonym "Babylonian" (research/PEOPLE.md §2: Iranica "Personal names iii", SX); the bearer\'s own origin is not stated'},
    {'name': 'Hiduš', 'sex': 'm', 'texts': ['PF 0596'], 'origin_guess': 'unknown', 'origin_basis': 'a name from the ethnonym "Indian" (research/PEOPLE.md §2: Iranica "Personal names iii", SX)'},
]

def origin(atf):
    t = re.sub(r'\{[^}]*\}', '', atf)
    for rx, why in IRANIAN:
        if re.search(rx, t): return 'Iranian', f'C: the Old Iranian element {why} in the spelling {atf} (RECOLLECTION of the onomastic literature, e.g. Mayrhofer 1973, Tavernier 2007: NOT SEEN)'
    for rx, why in ELAMITE:
        if re.search(rx, t): return 'Elamite', f'C: the Elamite element {why} in the spelling {atf} (RECOLLECTION: NOT SEEN)'
    return 'unknown', 'C: no diagnostic element in the spelling'

def main():
    d = json.load(open(PATH, encoding='utf-8'))
    kept = []
    for n in d['names']:
        if n.get('source') != 'CDLI' and n.get('source') != 'PEOPLE-R': continue  # EWB-only names: licence not established
        if n.get('source') == 'PEOPLE-R': continue  # re-added below
        n.pop('ewb', None); n.pop('ewb_freq', None)
        if 'gentilic' not in n.get('origin_basis', '') and 'Mannaraziyan' not in n.get('origin_basis', ''):
            n['origin_guess'], n['origin_basis'] = origin(n['atf'])
        n['tier'] = 'A (name form, primary text) / C (origin guess)'
        kept.append(n)
    have = {n['name'] for n in kept}
    for p in PEOPLE:
        if p['name'] in have: continue
        kept.append({**p, 'count': len(p['texts']), 'archive': 'PF' if p['texts'][0].startswith('PF') else 'PT', 'source': 'PEOPLE-R', 'tier': 'B (name form, secondary citation of the text) / C (origin guess)'})
    meta = d['_meta']
    meta['generated'] = '2026-09-24'
    meta['source'] = [s for s in meta['source'] if s['id'] == 'CDLI'] + [{'id': 'PEOPLE-R', 'what': 'names of ordinary people cited with a PF or PT text in research/PEOPLE.md §2 (from search extracts of the Iranica articles and PT studies)', 'licence': 'the name forms and text ids are facts cited from the literature; nothing of the articles is bundled'}]
    meta['removed'] = ('D-193 (D-192, Q-294): the 484 names that rested on the EWB lemma base alone (DigitalPasts/ALP-MEGA2024, no licence stated) are removed, '
                       'and the EWB lemma, page and etymon-based origin guesses of the CDLI names are stripped; the origin is guessed again from the spelling (tools/names_licensed.py). '
                       'No woman\'s name is in the licensed evidence read (the one {munus} name in the 67 PF texts, abbamuš, is a title): women are unnamed (population.ts nameFor, sim.ts pickName)')
    meta['method'] = meta.get('method', '').split(' EWB:')[0] + ' Origins (C): tools/names_licensed.py IRANIAN/ELAMITE element lists.'
    meta['tiers'] = {'A': 'name form read in a primary text (CDLI transliteration of Hallock PF).', 'B': 'name form from a secondary citation of a PF or PT text (research/PEOPLE.md).', 'C': 'origin_guess: from an onomastic element in the spelling, not from an ethnic label in the text.'}
    f = meta.get('fields', {}); f.pop('ewb_freq', None); f['archive'] = '"PF" = attested in a CDLI PF text (or cited PF text); "PT" = a cited PT text'; meta['fields'] = f
    d['names'] = kept
    json.dump(d, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(PATH, 'a').write('\n')
    import collections
    print(len(kept), collections.Counter((n['sex'], n['origin_guess']) for n in kept if not n.get('notable') and not n.get('reading_uncertain')))

if __name__ == '__main__': main()
