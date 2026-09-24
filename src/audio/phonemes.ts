// IPA → synthesiser phoneme mapping (brief §10 "speech is synthesised from the lexicon's IPA, converted to the
// synthesiser's own phoneme format"). Pure data + a tokenizer; no Web Audio here, so it is unit-testable in node.
//
// Formant targets are adult-male reference values (Hz). They are generic phonetic values for these vowel qualities and
// consonant places (Peterson & Barney-type averages and standard locus values from the acoustic-phonetics literature),
// not measurements of any ancient speaker: every value is tier C. Female and child voices scale them (speech.ts).

export type Manner = 'vowel' | 'stop' | 'fricative' | 'affricate' | 'nasal' | 'approximant' | 'trill' | 'lateral';
export type Place = 'labial' | 'dental' | 'alveolar' | 'postalveolar' | 'palatal' | 'velar' | 'uvular' | 'pharyngeal' | 'glottal' | 'vocalic';

export interface PhoneDef {
  manner: Manner; place: Place; voiced: boolean;
  /** formant targets F1–F3 (Hz, adult male). For consonants these are the loci the transitions move toward. */
  F: [number, number, number];
  /** frication noise: centre (Hz), bandwidth (Hz), relative amplitude (0–1) */
  fric?: { f: number; bw: number; amp: number };
  /** release burst: centre (Hz), bandwidth (Hz), relative amplitude */
  burst?: { f: number; bw: number; amp: number };
  /** true for /h/ and /ħ/: noise is excited through the vocal-tract formants (aspiration), not a separate frication pole */
  aspirate?: boolean;
  /** base duration (ms) at rate 1; for stops this is the closure */
  dur: number;
  tier: 'C';
}

const V = (F1: number, F2: number, F3: number, dur: number): PhoneDef => ({ manner: 'vowel', place: 'vocalic', voiced: true, F: [F1, F2, F3], dur, tier: 'C' });

/** Every base symbol the synthesiser knows. Modifiers (ː ˤ ̩ ͡ ˈ ˌ ʰ) are handled by the tokenizer. */
export const PHONES: Record<string, PhoneDef> = {
  // vowels
  a: V(730, 1250, 2500, 85), e: V(420, 1950, 2550, 85), i: V(290, 2250, 2950, 80), o: V(460, 850, 2450, 85), u: V(320, 850, 2300, 80),
  'ɛ': V(560, 1800, 2500, 85), 'ə': V(500, 1450, 2500, 50),
  // Greek (5th-c. Ionic, research/LEXICON/greek.json): front rounded y (lip rounding lowers F2/F3 against i), open-mid ɔ
  y: V(290, 1850, 2250, 80), 'ɔ': V(570, 880, 2450, 85),
  // stops (closure duration; burst centre by place)
  p: { manner: 'stop', place: 'labial', voiced: false, F: [300, 900, 2300], burst: { f: 900, bw: 1600, amp: 0.45 }, dur: 60, tier: 'C' },
  b: { manner: 'stop', place: 'labial', voiced: true, F: [250, 900, 2300], burst: { f: 900, bw: 1600, amp: 0.3 }, dur: 50, tier: 'C' },
  t: { manner: 'stop', place: 'alveolar', voiced: false, F: [300, 1750, 2700], burst: { f: 4000, bw: 2500, amp: 0.55 }, dur: 60, tier: 'C' },
  d: { manner: 'stop', place: 'alveolar', voiced: true, F: [250, 1750, 2700], burst: { f: 3800, bw: 2500, amp: 0.35 }, dur: 50, tier: 'C' },
  k: { manner: 'stop', place: 'velar', voiced: false, F: [300, 1700, 2400], burst: { f: 2000, bw: 900, amp: 0.55 }, dur: 62, tier: 'C' },
  'ɡ': { manner: 'stop', place: 'velar', voiced: true, F: [250, 1700, 2400], burst: { f: 2000, bw: 900, amp: 0.35 }, dur: 52, tier: 'C' },
  q: { manner: 'stop', place: 'uvular', voiced: false, F: [400, 1200, 2400], burst: { f: 1300, bw: 700, amp: 0.55 }, dur: 65, tier: 'C' },
  'ʔ': { manner: 'stop', place: 'glottal', voiced: false, F: [500, 1500, 2500], dur: 45, tier: 'C' },
  // fricatives
  f: { manner: 'fricative', place: 'labial', voiced: false, F: [300, 1000, 2300], fric: { f: 6500, bw: 5000, amp: 0.07 }, dur: 95, tier: 'C' },
  'θ': { manner: 'fricative', place: 'dental', voiced: false, F: [300, 1500, 2600], fric: { f: 6000, bw: 5000, amp: 0.07 }, dur: 95, tier: 'C' },
  s: { manner: 'fricative', place: 'alveolar', voiced: false, F: [300, 1750, 2700], fric: { f: 6200, bw: 1800, amp: 0.55 }, dur: 100, tier: 'C' },
  z: { manner: 'fricative', place: 'alveolar', voiced: true, F: [250, 1750, 2700], fric: { f: 6000, bw: 1800, amp: 0.3 }, dur: 80, tier: 'C' },
  'ʃ': { manner: 'fricative', place: 'postalveolar', voiced: false, F: [300, 2000, 2700], fric: { f: 3000, bw: 1400, amp: 0.55 }, dur: 100, tier: 'C' },
  'ç': { manner: 'fricative', place: 'palatal', voiced: false, F: [300, 2250, 3000], fric: { f: 4200, bw: 1800, amp: 0.4 }, dur: 95, tier: 'C' },
  x: { manner: 'fricative', place: 'velar', voiced: false, F: [350, 1500, 2400], fric: { f: 1600, bw: 1200, amp: 0.4 }, dur: 95, tier: 'C' },
  h: { manner: 'fricative', place: 'glottal', voiced: false, F: [600, 1500, 2500], aspirate: true, dur: 65, tier: 'C' },
  'ħ': { manner: 'fricative', place: 'pharyngeal', voiced: false, F: [750, 1150, 2500], fric: { f: 1200, bw: 900, amp: 0.2 }, aspirate: true, dur: 90, tier: 'C' },
  'ʕ': { manner: 'fricative', place: 'pharyngeal', voiced: true, F: [750, 1100, 2500], dur: 70, tier: 'C' },
  // affricate (closure + frication)
  't͡ʃ': { manner: 'affricate', place: 'postalveolar', voiced: false, F: [300, 2000, 2700], burst: { f: 3200, bw: 2000, amp: 0.5 }, fric: { f: 3000, bw: 1400, amp: 0.5 }, dur: 50, tier: 'C' },
  'd͡ʒ': { manner: 'affricate', place: 'postalveolar', voiced: true, F: [250, 2000, 2700], burst: { f: 3200, bw: 2000, amp: 0.35 }, fric: { f: 3000, bw: 1400, amp: 0.3 }, dur: 45, tier: 'C' },
  // nasals
  m: { manner: 'nasal', place: 'labial', voiced: true, F: [260, 1000, 2300], dur: 65, tier: 'C' },
  n: { manner: 'nasal', place: 'alveolar', voiced: true, F: [260, 1600, 2600], dur: 60, tier: 'C' },
  'ŋ': { manner: 'nasal', place: 'velar', voiced: true, F: [260, 2000, 2500], dur: 65, tier: 'C' },
  // approximants, liquids
  j: { manner: 'approximant', place: 'palatal', voiced: true, F: [280, 2200, 3000], dur: 55, tier: 'C' },
  w: { manner: 'approximant', place: 'labial', voiced: true, F: [300, 700, 2200], dur: 55, tier: 'C' },
  l: { manner: 'lateral', place: 'alveolar', voiced: true, F: [360, 1300, 2700], dur: 60, tier: 'C' },
  r: { manner: 'trill', place: 'alveolar', voiced: true, F: [450, 1300, 1700], dur: 65, tier: 'C' },
};

export interface Phone {
  sym: string; def: PhoneDef; long: boolean; syllabic: boolean; pharyngealised: boolean;
  /** 1 = primary stress marked in the IPA (ˈ), 2 = secondary (ˌ); 0 unmarked (the prosody rule decides) */
  stressMark: 0 | 1 | 2;
  word: number;
  /** second element of a falling diphthong (OP ai, au): a non-syllabic glide */
  glide?: boolean;
  /** aspirated stop (ʰ; Greek φ θ χ = pʰ tʰ kʰ): a longer voiceless release before the next sound */
  aspirated?: boolean;
  /** index of the phone's first character in the NFC-normalised IPA string (where a stress mark would go) */
  pos?: number;
}

const MODIFIERS = new Set(['ː', 'ˤ', '̩', '͡', 'ˈ', 'ˌ', 'ʰ']);
const ALIASES: Record<string, string> = { g: 'ɡ', 'ʧ': 't͡ʃ', 'ʤ': 'd͡ʒ', 'ɹ': 'r', 'ɾ': 'r', 'ɑ': 'a', 'ä': 'a' };

export class IpaError extends Error { constructor(msg: string, readonly symbol: string) { super(msg); } }

/**
 * Tokenize an IPA string into phones. Throws IpaError on any symbol the synthesiser does not map, so that an unmapped
 * lexicon symbol can never be silently dropped (tests/speech.test.ts runs this over every lexicon entry).
 * Doubled consonants (geminates, e.g. Elamite `attata`, `iršarra`) become one long phone.
 */
export function tokenizeIpa(ipa: string): Phone[] {
  const s = ipa.normalize('NFC');
  const out: Phone[] = [];
  let word = 0, stress: 0 | 1 | 2 = 0;
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]; const pos = i;
    if (ch === ' ' || ch === '.' || ch === '​') { if (ch === ' ' && out.length) word++; continue; }
    if (ch === 'ˈ') { stress = 1; continue; }
    if (ch === 'ˌ') { stress = 2; continue; }
    if (MODIFIERS.has(ch)) throw new IpaError(`modifier ${JSON.stringify(ch)} without a base symbol in "${ipa}"`, ch);
    // tie bar: t͡ʃ
    if (s[i + 1] === '͡') { ch = ch + '͡' + s[i + 2]; i += 2; }
    ch = ALIASES[ch] ?? ch;
    const def = PHONES[ch];
    if (!def) throw new IpaError(`IPA symbol ${JSON.stringify(ch)} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}) is not mapped, in "${ipa}"`, ch);
    const p: Phone = { sym: ch, def, long: false, syllabic: def.manner === 'vowel', pharyngealised: false, stressMark: stress, word, pos };
    stress = 0;
    // trailing modifiers
    while (i + 1 < s.length && (s[i + 1] === 'ː' || s[i + 1] === 'ˤ' || s[i + 1] === '̩' || s[i + 1] === 'ʰ')) {
      const m = s[++i];
      if (m === 'ː') p.long = true; else if (m === 'ˤ') p.pharyngealised = true; else if (m === 'ʰ') p.aspirated = true; else p.syllabic = true;
    }
    if (p.aspirated && (def.manner !== 'stop' || def.voiced)) throw new IpaError(`aspiration ʰ on a non-(voiceless stop) ${JSON.stringify(ch)} in "${ipa}"`, 'ʰ');
    const prev = out[out.length - 1];
    if (prev && prev.word === word && prev.sym === p.sym && p.def.manner !== 'vowel' && !prev.long && !prev.aspirated) { prev.long = true; prev.aspirated = p.aspirated; continue; } // geminate
    out.push(p);
  }
  // falling diphthongs: a/e/o + short i/u not followed by a vowel in the same word (OP ai, au; C)
  for (let k = 1; k < out.length; k++) {
    const a = out[k - 1], b = out[k], c = out[k + 1];
    if (a.word === b.word && a.syllabic && 'aeo'.includes(a.sym) && (b.sym === 'i' || b.sym === 'u') && !b.long && !b.stressMark
      && !(c && c.word === b.word && c.def.manner === 'vowel')) { b.syllabic = false; b.glide = true; }
  }
  return out;
}

/** All distinct base symbols in an IPA string (throws on unmapped ones). */
export function ipaSymbols(ipa: string): string[] { return [...new Set(tokenizeIpa(ipa).map(p => p.sym))]; }

/** Syllabify one word's phones: nucleus = vowel or syllabic consonant; a single intervocalic consonant is an onset. */
export interface Syllable { onset: Phone[]; nucleus: Phone; coda: Phone[]; heavy: boolean }
export function syllabify(word: Phone[]): Syllable[] {
  const nuc = word.map((p, i) => (p.syllabic ? i : -1)).filter(i => i >= 0);
  if (!nuc.length) return [];
  const syl: Syllable[] = [];
  for (let k = 0; k < nuc.length; k++) {
    const i = nuc[k], prevEnd = k === 0 ? 0 : nuc[k - 1] + 1;
    const between = word.slice(prevEnd, i);
    // maximal onset of one consonant (two for obstruent + liquid/approximant clusters such as dr, br, fr, xš)
    let onsetN = k === 0 ? between.length : Math.min(between.length, 1);
    if (k > 0 && between.length >= 2) {
      const a = between[between.length - 2], b = between[between.length - 1];
      if ((a.def.manner === 'stop' || a.def.manner === 'fricative') && (b.def.manner === 'trill' || b.def.manner === 'approximant')) onsetN = 2;
    }
    if (k > 0) syl[k - 1].coda = between.slice(0, between.length - onsetN);
    syl.push({ onset: between.slice(between.length - onsetN), nucleus: word[i], coda: [], heavy: false });
  }
  syl[syl.length - 1].coda = word.slice(nuc[nuc.length - 1] + 1);
  // a geminate is one long phone here (tokenizeIpa), kept whole as the next onset; its first half closes the syllable
  // before it, so that syllable counts as heavy (Akkadian i.qab.bi, Elamite at.ta.ta)
  syl.forEach((s, k) => { const nx = syl[k + 1]?.onset[0]; s.heavy = s.nucleus.long || s.coda.length > 0 || !!(nx && nx.long && nx.def.manner !== 'vowel'); });
  return syl;
}
