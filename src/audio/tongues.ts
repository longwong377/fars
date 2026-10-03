// D-720 (UD-23, UD-24; the holes audit #15): THE TONGUES WITHOUT A LEXICON. Eight peoples of the town had no published words
// here (Egyptian, Lydian, Carian, Lycian, Cappadocian, Bactrian, Sogdian, Thracian) and so only hummed (T-K1a2: never another
// people's words for them). UD-24 loosens §10 for the people's own talk: "voiced as reconstructed period speech, flagged
// tier C". Each tongue here has a sound profile set by hand from what is known of the language's sounds and syllables (C:
// the sources named per tongue; no word is claimed), and the everyday sentences of the town are rendered in it word by word:
// each English word one form, always the same in that tongue (keyed by tongue and word), built from the tongue's own onsets,
// vowels and codas, in its word order (verb last in the Anatolian and Iranian tongues, verb first in Egyptian). Never a form
// of another people's lexicon, never a modern word. The gloss (English) is the translation layer's; the units are 'line's of
// the speaker's own voice (voices.ts). Pure and deterministic.
import type { Intonation } from './speech';
import type { Unit } from './voices';
import { tokenizeIpa } from './phonemes';
import { toKokoro } from './neural/kokoro';
import { findModernWords } from '../lang/modern';
import { Rng, hashString } from '../core/rng';

type W = Record<string, number>;
interface Tongue { name: string; src: string; onsets: W; nuclei: W; codas: W; finals: W; syl: number[]; order: 'sov' | 'vso' | 'svo' }
// (weights: relative frequency, C; the phones are the synthesiser's own symbols)
const TONGUES: Record<string, Tongue> = {
  Egyptian: { name: 'Egyptian', order: 'vso', src: 'Late Egyptian and Demotic as reconstructed from Coptic (Loprieno 1995; Allen 2020): many stops and fricatives, ḥ and ʿ, short open syllables, a reduced vowel', syl: [0, 3, 5, 2],
    onsets: { p: 3, t: 5, k: 3, b: 2, m: 4, n: 5, r: 4, s: 4, ʃ: 2, h: 3, ħ: 2, x: 1, f: 2, w: 3, j: 2, ʔ: 2, ʕ: 2, d: 2, '': 2 }, nuclei: { a: 5, e: 3, o: 3, u: 2, i: 2, 'ə': 3, 'oː': 1, 'eː': 1 },
    codas: { '': 6, n: 2, r: 1, t: 2, f: 1, s: 1 }, finals: { '': 4, t: 2, f: 2, n: 2, s: 1, k: 1 } },
  Lydian: { name: 'Lydian', order: 'sov', src: 'Lydian inscriptions of Sardis as read by Gusmani and Melchert: many sibilants and nasal vowels written, few voiced stops, -k and -ś endings', syl: [0, 2, 5, 3],
    onsets: { t: 3, k: 3, p: 2, s: 5, ʃ: 3, d: 2, b: 1, m: 3, n: 4, l: 4, r: 3, w: 2, f: 2, '': 3 }, nuclei: { a: 5, e: 3, i: 4, u: 2, o: 2, 'aː': 1 }, codas: { '': 5, n: 2, l: 1, s: 2, r: 1, t: 1 },
    finals: { '': 2, k: 3, s: 3, ʃ: 2, n: 2, l: 1, t: 1 } },
  Carian: { name: 'Carian', order: 'sov', src: 'Carian as deciphered by Adiego (2007): Anatolian sounds, clusters with r and l, -ś and -n endings', syl: [0, 2, 5, 3],
    onsets: { k: 3, t: 3, p: 2, b: 2, d: 2, s: 3, ʃ: 2, m: 3, n: 3, r: 3, l: 3, w: 2, kr: 1, tr: 1, '': 2 }, nuclei: { a: 5, e: 3, i: 3, o: 3, u: 2 }, codas: { '': 5, r: 2, l: 2, n: 1, s: 1 },
    finals: { '': 3, s: 2, ʃ: 2, n: 3, r: 1, t: 1 } },
  Lycian: { name: 'Lycian', order: 'sov', src: 'Lycian A of the tomb and stele inscriptions (Melchert 2004): t, k, p, h, many nasals, -e and -i endings, x', syl: [0, 2, 5, 3],
    onsets: { t: 5, k: 3, p: 3, h: 3, x: 2, m: 3, n: 4, l: 3, r: 2, s: 2, w: 2, d: 1, j: 1, '': 2 }, nuclei: { a: 5, e: 4, i: 3, u: 2 }, codas: { '': 6, n: 2, m: 1, t: 1 },
    finals: { '': 5, n: 2, h: 1, s: 1, i: 0 } },
  Cappadocian: { name: 'Cappadocian', order: 'sov', src: 'the Iranian speech of Cappadocia (Old Persian and Median kin, C): Iranian sounds with Anatolian vowels', syl: [0, 2, 5, 3],
    onsets: { p: 2, t: 3, k: 3, b: 3, d: 3, ɡ: 2, m: 3, n: 3, r: 3, s: 3, ʃ: 2, x: 2, f: 2, θ: 1, w: 2, j: 2, '': 3 }, nuclei: { a: 7, i: 3, u: 3, e: 1, 'aː': 2 }, codas: { '': 5, r: 2, n: 2, s: 1, t: 1 },
    finals: { '': 5, a: 0, ʃ: 1, n: 1, t: 1 } },
  Bactrian: { name: 'Bactrian', order: 'sov', src: 'Bactrian as later written in Greek letters (Sims-Williams): East Iranian, voiced fricatives, ð and ɣ for d and g, -o endings', syl: [0, 2, 5, 2],
    onsets: { b: 3, ð: 3, ɡ: 2, p: 2, t: 3, k: 3, m: 3, n: 3, r: 4, l: 2, s: 3, ʃ: 2, x: 2, f: 2, w: 2, j: 2, z: 2, '': 3 }, nuclei: { a: 6, o: 4, i: 3, u: 2, e: 1 }, codas: { '': 5, r: 2, n: 2, ʃ: 1, z: 1 },
    finals: { '': 3, o: 0, ð: 1, n: 1, ʃ: 1, z: 1 } },
  Sogdian: { name: 'Sogdian', order: 'sov', src: 'Sogdian of the later letters and sutras (Gershevitch; Yoshida): East Iranian, many fricatives (β, ð, x, ʃ), -ʹk and -y endings', syl: [0, 2, 5, 3],
    onsets: { β: 2, ð: 3, x: 3, ʃ: 3, s: 2, t: 3, k: 3, p: 2, m: 3, n: 3, r: 4, w: 2, j: 2, z: 2, f: 2, '': 3 }, nuclei: { a: 6, i: 3, u: 3, e: 1, 'aː': 2 }, codas: { '': 5, r: 2, n: 2, x: 1, ʃ: 1, t: 1 },
    finals: { '': 3, k: 2, i: 0, n: 1, ʃ: 1, t: 1 } },
  Thracian: { name: 'Thracian', order: 'svo', src: 'Thracian names and glosses (Duridanov; the Ezerovo ring): an Indo-European tongue of b, d, z, -as, -is and -on endings', syl: [0, 2, 5, 3],
    onsets: { b: 4, d: 4, z: 3, s: 3, t: 3, k: 3, p: 2, ɡ: 2, m: 3, n: 3, r: 3, l: 3, w: 2, '': 2 }, nuclei: { a: 5, e: 4, i: 4, o: 3, u: 3 }, codas: { '': 5, r: 1, l: 1, n: 1, s: 1, z: 1 },
    finals: { '': 2, s: 4, z: 1, n: 2, r: 1 } },
};
// (sounds the synthesiser has no symbol for, mapped to its nearest: β → w, ð → z (voiced dental fricative), ɣ → x: C)
const NEAR: Record<string, string> = { β: 'w', ð: 'z', ɣ: 'x' };
const speakable = (ipa: string) => { try { return tokenizeIpa(ipa).length > 0 && toKokoro(ipa).length > 0; } catch { return false; } };
const pickW = (m: W, r: Rng) => { let t = 0; for (const v of Object.values(m)) t += v; let x = r.next() * t; for (const [k, v] of Object.entries(m)) { x -= v; if (x < 0) return k; } return Object.keys(m)[0]; };

/** the tongue a people speaks, when it has no lexicon of its own here (null: none, or one with a lexicon) */
export function tongueOf(label: string): string | null { return TONGUES[label] ? label : null; }
export const TONGUE_NAMES = Object.keys(TONGUES);

const formCache = new Map<string, string>();
/** the form of an English word in a tongue: the same word always the same form (never a modern word) */
export function tongueWord(tongue: string, en: string): string {
  const k = `${tongue}|${en}`, c = formCache.get(k); if (c) return c; const T = TONGUES[tongue];
  const r = new Rng(hashString(`tongue:${k}`) >>> 0, 'tongues.word'); let w = 'a';
  for (let a = 0; a < 40; a++) {
    let tot = 0; T.syl.forEach(v => { tot += v; }); let x = r.next() * tot, n = 1; for (let i = 1; i < T.syl.length; i++) { x -= T.syl[i]; if (x < 0) { n = i; break; } }
    w = ''; for (let s = 0; s < n; s++) w += pickW(T.onsets, r) + pickW(T.nuclei, r) + pickW(s === n - 1 ? T.finals : T.codas, r);
    w = [...w].map(ch => NEAR[ch] ?? ch).join('');
    if (w.length >= 2 && speakable(w) && !findModernWords(w, { ipa: true }).length) break;
  }
  formCache.set(k, w); return w;
}
const FUNCTION = new Set('a an the of to in on at is are was were be been it its and or but for with by from as that this these those i you he she we they me him her us them my your his our their do does did will shall not no'.split(' '));
const VERBS = new Set('come comes came go goes went give gives gave take took bring brings brought eat eats ate sell sells sold buy bought work works worked carry carries die died born sick pray prays fell fall rains rain dear owe owes keep keeps make made build builds cut cuts sleep sleeps see saw know knew say says said call calls wait waits help helps run'.split(' '));
/** an English sentence in a tongue, word by word in its order (tier C); the English stays the gloss */
export function tongueSentence(tongue: string, english: string): { ipa: string; translit: string } {
  const T = TONGUES[tongue]; let ws = english.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(t => t && !FUNCTION.has(t));
  const vs = ws.filter(t => VERBS.has(t)), rest = ws.filter(t => !VERBS.has(t));
  if (T.order === 'sov') ws = [...rest, ...vs]; else if (T.order === 'vso') ws = [...vs, ...rest];
  const forms = ws.map(t => tongueWord(tongue, t)); const ipa = forms.join(' ');
  return { ipa, translit: forms.map(f => f.replace(/ː/g, '').replace(/ʃ/g, 'š').replace(/ħ/g, 'ḥ').replace(/ʕ/g, 'ʿ').replace(/ʔ/g, 'ʾ').replace(/ə/g, 'e').replace(/θ/g, 'th').replace(/ɡ/g, 'g').replace(/j/g, 'y')).join(' ') };
}
/** what the people of the town say to each other day to day (the translation layer's English; tier C) */
export const EVERYDAY: readonly string[] = [
  'the barley is dear this month', 'bread and beer at the ration day', 'my son is sick', 'the child sleeps', 'come and eat with us',
  'where is your brother', 'the work is heavy today', 'the overseer counts the men', 'the water is low in the channel', 'the rain came in the night',
  'my wife bakes bread', 'the king builds a great house', 'the stone is hard', 'we go home at evening', 'give me the jar',
  'the donkey is lame', 'my mother is old', 'the festival comes soon', 'the gods keep the house', 'a stranger came to the town',
  'how is your father', 'the goats are in the field', 'the harvest is good', 'he owes me silver', 'the market is full today',
  'my daughter is married', 'the fire is out', 'bring the water', 'the road from home is long', 'my people are far away',
  'the wool is spun', 'the guard stands at the gate', 'the night is cold', 'my brother works the stone', 'the baby cries',
  'the oil is sold', 'we pray at the fire', 'the sheep came down from the hills', 'tomorrow is the ration day', 'the bread is good',
];
const unitCache = new Map<string, Unit[]>();
/** the units a speaker of the tongue says: the everyday sentences in it (lines in their own voice) */
export function tongueUnits(tongue: string): Unit[] {
  const c = unitCache.get(tongue); if (c) return c;
  const us = EVERYDAY.map((en, i) => { const s = tongueSentence(tongue, en), h = hashString(`${tongue}|${en}`) >>> 0;
    return { id: `tg:${tongue}:${i}`, ipa: s.ipa, intonation: (/^(where|how)\b/.test(en) ? 'rise' : h % 5 === 0 ? 'level' : 'fall') as Intonation, kind: 'line' as const,
      parts: s.ipa.split(' ').map(f => `tg:${tongue}:${f}`), tier: 'C', gloss: `${en} (reconstructed ${tongue} speech, tier C)`, translit: s.translit }; }).filter(u => speakable(u.ipa));
  unitCache.set(tongue, us); return us;
}
/** a sentence (a life's fact) in a tongue as a unit */
export function tongueUnit(tongue: string, english: string): Unit {
  const s = tongueSentence(tongue, english);
  return { id: `tg:${tongue}:${(hashString(`${tongue}|${english}`) >>> 0).toString(36)}`, ipa: s.ipa, intonation: /\?\s*$/.test(english) ? 'rise' : 'fall', kind: 'line', parts: s.ipa.split(' ').map(f => `tg:${tongue}:${f}`), tier: 'C', gloss: `${english} (reconstructed ${tongue} speech, tier C)`, translit: s.translit };
}
/** the tongue's provenance (F3) */
export const tongueSource = (tongue: string) => TONGUES[tongue]?.src ?? '';
