// Old Persian cuneiform (U+103A0 block): sign names, Kent's orthographic rules and the carved sign sequence.
//
// Three inputs, one sign inventory (sign names as Kent prints them: a i u ka ku ga gu xa ca ja ji ta tu da di du θa pa ba fa
// na nu ma mi mu ya va vi ra ru la sa za ša ça ha; logograms XŠ DH¹ DH² BG BU AM¹ AM² AMha; "x" = a lost sign):
//  - `catfWords(lines)`: the published sign-by-sign edition itself, ORACC ARIo in CATF (Schmitt 2009, CC0;
//    data/corpus/ario_catf.json, D-184): the stone's signs as edited, with the engraver's extra signs (<<…>>, carved), the signs
//    he omitted (<…>, NOT carved) and the editor's restorations of later damage ([…], carved, C). This is what the world carves;
//  - `spellNormalised(word)`: a normalised transcription (Schmitt 2009, ORACC ARIo: θāti, pātu, Xšayaṛšā, Gandāra), which
//    is phonological; Kent's orthographic rules turn it into signs (below). Used to compare, word by word, what the stone has
//    with what the rules predict (research/OP_SIGNS.md), and for the lexicon;
//  - `spellKent(word)`: a Kent-style transliteration (θātiy, pātuv, Xšayāršā, XŠm), for the lexicon's sign spellings;
//  - `parseSigns(line)`: a sign-by-sign line ("ba-ga : va-za-ra-ka"), the form src/data/inscriptions.json stores for every
//    carved Old Persian line (op_signs), built by tools/build_op_signs.ts (D-184).
// Everything carved goes through `signsToCuneiform`; the world never re-derives a spelling at runtime.
export const SIGN: Record<string, number> = {
  a: 0x103a0, i: 0x103a1, u: 0x103a2, ka: 0x103a3, ku: 0x103a4, ga: 0x103a5, gu: 0x103a6, xa: 0x103a7, ca: 0x103a8, ja: 0x103a9, ji: 0x103aa,
  ta: 0x103ab, tu: 0x103ac, da: 0x103ad, di: 0x103ae, du: 0x103af, θa: 0x103b0, pa: 0x103b1, ba: 0x103b2, fa: 0x103b3, na: 0x103b4, nu: 0x103b5,
  ma: 0x103b6, mi: 0x103b7, mu: 0x103b8, ya: 0x103b9, va: 0x103ba, vi: 0x103bb, ra: 0x103bc, ru: 0x103bd, la: 0x103be, sa: 0x103bf, za: 0x103c0,
  ša: 0x103c1, ça: 0x103c2, ha: 0x103c3,
  // logograms (Unicode names AURAMAZDAA-1/-2, AURAMAZDAAHA, XSHAAYATHIYA, DAHYAAUSH-1/-2, BAGA, BUUMISH)
  'AM¹': 0x103c8, 'AM²': 0x103c9, AMha: 0x103ca, 'XŠ': 0x103cb, 'DH¹': 0x103cc, 'DH²': 0x103cd, BG: 0x103ce, BU: 0x103cf,
};
export const WORD_DIVIDER = String.fromCodePoint(0x103d0);
/** a sign lost in the edition (ARIo "x", Kent "+"): carved as a blank of one sign's width (the stone had a sign there in 467,
 *  but which is not known; nothing is invented) */
export const LOST = 'x';
const CONS: Record<string, string> = { k: 'k', g: 'g', x: 'x', c: 'c', j: 'j', t: 't', d: 'd', θ: 'θ', p: 'p', b: 'b', f: 'f', n: 'n', m: 'm', y: 'y', v: 'v', r: 'r', l: 'l', s: 's', z: 'z', š: 'š', ç: 'ç', h: 'h' };
const HAS_I = new Set(['d', 'm', 'v', 'j']);
const HAS_U = new Set(['k', 'g', 't', 'd', 'n', 'm', 'r']);
const VOWELS = 'aāiīuū';
const LOGO_PREFIX: [RegExp, string][] = [[/^XŠ(?![A-ZŠ])/, 'XŠ'], [/^DH(?![A-Z])/, 'DH¹'], [/^BG(?![A-Z])/, 'BG'], [/^BU(?![A-Z])/, 'BU'], [/^AMha/, 'AMha'], [/^AM(?![A-Z])/, 'AM¹']];

/** letters → tokens: Kent's â î û as ā ī ū, th as θ and sh as š (Kent-style input only: the Livius copy writes both forms), ṛ as
 *  ar, non-syllabic i̯ u̯ as i u, ī̆ ū̆ (length unknown) as i u, "+" (Kent: a lost sign) as a lost-sign token; hiatus dots,
 *  restoration brackets and anything else dropped */
function letters(word: string, kent = false): string[] {
  const w = word.normalize('NFC').replace(/̆/g, '').normalize('NFD').replace(/([ui])̯/g, '$1').normalize('NFC').toLowerCase()
    .replace(/â/g, 'ā').replace(/î/g, 'ī').replace(/û/g, 'ū').replace(/ṛ/g, 'ar');
  const k = kent ? w.replace(/th/g, 'θ').replace(/sh/g, 'š') : w;
  return [...k].filter(ch => VOWELS.includes(ch) || CONS[ch] || ch === '+');
}
/** tokens (vowels and consonants, already in written order) → signs, the syllabary's own rules: a consonant takes the sign of
 *  its following vowel (Ca; Ci/Cu where the script has one, else Ca then i/u); long ā is Ca-a; a vowel not taken by a
 *  consonant (initial, or the second part of a diphthong) is its own sign; a consonant before a consonant or at the end is Ca.
 *  `start` receives, per sign, the index of the token it begins at (to break a word where a line of the text breaks it) */
function syllabify(t: string[], start: number[] = []): string[] {
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const p = t[i], at = i;
    const push = (...s: string[]) => { out.push(...s); start.push(at, ...s.slice(1).map(() => at + 1)); };
    if (p === '+') { push(LOST); continue; }
    if (VOWELS.includes(p)) { push(p === 'a' || p === 'ā' ? 'a' : p === 'i' || p === 'ī' ? 'i' : 'u'); continue; }
    const C = CONS[p], n = t[i + 1];
    if (n === 'a') { push(C + 'a'); i++; }
    else if (n === 'ā') { push(C + 'a', 'a'); i++; }
    else if (n === 'i' || n === 'ī') { push(HAS_I.has(C) ? C + 'i' : C + 'a', 'i'); i++; }
    else if (n === 'u' || n === 'ū') { push(HAS_U.has(C) ? C + 'u' : C + 'a', 'u'); i++; }
    else push(C + 'a');
  }
  for (const s of out) if (s !== LOST && !(s in SIGN)) throw new Error(`no Old Persian sign ${s}`);
  return out;
}
/** a Kent-style (graphemic) transliteration → signs. A leading capital logogram (XŠ, DH, BG, BU, AM, AMha) is that logogram,
 *  the rest its phonetic complement ("XŠm" = XŠ-ma, "XŠhyā" = XŠ-ha-ya-a); "+" is a lost sign; "(ma)" a restored one.
 *  A word the text breaks across lines is given as its pieces: the signs are those of the whole word (a consonant at a line
 *  end takes the sign of the vowel that opens the next line: "ak|unauš" a-ku | u-na-u-ša), `breaks` the sign index at which
 *  each later piece begins */
export function spellKentParts(pieces: string[]): { signs: string[]; breaks: number[] } {
  const logo: string[] = [], toks: string[] = [], cuts: number[] = [];
  pieces.forEach((piece, k) => {
    let w = piece.replace(/[()]/g, '');
    if (k === 0) for (const [re, lg] of LOGO_PREFIX) if (re.test(w)) { logo.push(lg); w = w.replace(re, ''); break; }
    if (k > 0) cuts.push(toks.length);
    toks.push(...letters(w, true));
  });
  const start: number[] = [], signs = syllabify(toks, start);
  const breaks = cuts.map(c => logo.length + start.filter(s => s < c).length);
  return { signs: [...logo, ...signs], breaks };
}
export const spellKent = (word: string) => spellKentParts([word]).signs;
/** Kent's orthographic rules on a normalised (phonological) transcription (Kent 1953 §§ 10–29 as summarised in
 *  research/LANGUAGES.md; Schmitt's transcription conventions from ARIo):
 *   1. ṛ is written ar (word-initial a-ra: ṛštika a-ra-ša-ta-i-ka; after a consonant Ca-ra: kṛtam ka-ra-ta-ma; after a
 *      vowel a-ra: Xšayaṛšā xa-ša-ya-a-ra-ša-a);
 *   2. n before a consonant is not written (Gandāra ga-da-a-ra, hantaxšatai̯ ha-ta-xa-ša-ta-i-ya), nor m before b or p;
 *   3. a word-final i/ī (also of the diphthong ai̯) is followed by y, a final u/ū (also au̯) by v (θāti θa-a-ta-i-ya, pātu
 *      pa-a-tu-u-va, dūrai̯ du-u-ra-i-ya, hau̯ ha-u-va);
 *   4. word-initial ū before a consonant is written u-v (Ūja u-va-ja, ūnarā u-va-na-ra-a);
 *   5. then the syllabary (syllabify): ā after a consonant Ca-a, initial ā a single a, i/u after a consonant Ci-i / Cu-u or
 *      Ca-i / Ca-u, ai̯/au̯ Ca-i / Ca-u.
 *  Hyphenated groups are enclitic chains (avākaram-ci-mai̯) unless every part is a sign name (a-x, x-di-i-y: the edition's own
 *  sign transliteration of a damaged word, taken sign by sign). "x" alone is a lost sign. */
export function spellNormalised(word: string): string[] {
  if (word === 'x') return [LOST];
  const parts = word.split('-');
  if (parts.length > 1 && parts.every(p => p === 'x' || isSignName(p))) return parts.map(p => (p === 'x' ? LOST : signName(p)));
  const w = parts.join('').replace(/\./g, '');
  let t = letters(w);
  // 4. initial ū + consonant → u v
  if (/^ū/.test(w.normalize('NFC').toLowerCase().replace(/û/g, 'ū')) && t.length > 1 && CONS[t[1]]) t = ['u', 'v', ...t.slice(1)];
  // 2. nasals before consonants
  t = t.filter((c, i) => { const n = t[i + 1]; if (!n || !CONS[n]) return true; if (c === 'n') return false; if (c === 'm' && (n === 'b' || n === 'p')) return false; return true; });
  // 3. final glides
  const last = t[t.length - 1];
  if (last === 'i' || last === 'ī') t.push('y'); else if (last === 'u' || last === 'ū') t.push('v');
  return syllabify(t);
}
const signName = (p: string) => { const q = p.normalize('NFC'); if (q in SIGN) return q; if (q.length === 1 && CONS[q]) return q + 'a'; throw new Error(`not a sign name: ${p}`); };
const isSignName = (p: string) => { try { signName(p); return true; } catch { return false; } };

/** ARIo's CATF sign names (data/corpus/ario_catf.json, D-184) → sign names: a consonant letter is its Ca sign, the Ci / Cu
 *  signs are written out (mi, di, vi, ji, ku, gu, tu, du, nu, mu, ru), `disz` is ma, `munus` fa, `sz` ša and `xsz` the
 *  logogram XŠ (written _%peo xsz_) */
const CATF_SIGN: Record<string, string> = { disz: 'ma', munus: 'fa', sz: 'ša', xsz: 'XŠ', a: 'a', i: 'i', u: 'u' };
export function catfSign(t: string): string {
  if (t in CATF_SIGN) return CATF_SIGN[t];
  if (t in SIGN) return t;
  if (CONS[t] && t + 'a' in SIGN) return t + 'a';
  throw new Error(`unknown ARIo sign "${t}"`);
}
/** signs carved where the edition has "[...]" (lost, not restored: how many is not known): blanks of this many signs (C) */
export const LOST_RUN = 3;
/** one carved sign of the edition, with the edition's mark on it: restored (in […]: lost since antiquity, restored by the
 *  editor; the stone was whole in 467, so it is carved, tier C) or excess (<<…>>: an extra sign the engraver cut, carved as
 *  the stone has it) */
export interface EdSign { s: string; restored?: boolean; excess?: boolean }
/** one word of the edition as the stone divides it: its signs, the line it starts on, the sign indices where later lines
 *  begin, whether a divider stands before it (at the end of the previous line when `divAtEnd`), and the signs the engraver
 *  omitted (<…>: supplied by the editor, NOT on the stone, NOT carved), by name */
export interface EdWord { signs: EdSign[]; line: number; breaks: number[]; divBefore: boolean; divAtEnd: boolean; omitted: string[]; lost?: boolean }
/** the Old Persian lines of the CATF edition ("12. a-u-r-disz-z-d-a-h-a : i-disz-disz : …") → its words, in order. A word
 *  runs on across a line end marked "-;" / "-"; ":" is the word divider (an omitted one, <:>, is not carved; an extra one cut
 *  inside a word, <<:>>, is); "[...]" a lost stretch (LOST_RUN blanks); the damage marks #, ?, ! are dropped (the sign is read).
 *  Throws on any sign name it does not know */
export function catfWords(lines: string[]): EdWord[] & { trailing?: boolean } {
  const out: EdWord[] & { trailing?: boolean } = [];
  // the edition's bracket states run on across pieces and lines: […] restored, <…> supplied (omitted by the engraver),
  // <<…>> extra (cut by the engraver)
  let cur: EdWord | null = null, pendingDiv = false, divAtEnd = false, restored = false, omit = false, excess = false, line = 0, pendingOmit: string[] = [];
  const word = (): EdWord => {
    if (!cur) { cur = { signs: [], line, breaks: [], divBefore: pendingDiv && out.length > 0, divAtEnd: pendingDiv && divAtEnd, omitted: pendingOmit }; out.push(cur); pendingDiv = false; divAtEnd = false; pendingOmit = []; }
    return cur;
  };
  const sign = (t: string) => {
    if (!t) return;
    if (omit) { (cur ? (cur as EdWord).omitted : pendingOmit).push(catfSign(t)); return; } // not on the stone: noted on the word it falls in, or the next
    const e: EdSign = { s: catfSign(t) }; if (restored) e.restored = true; if (excess) e.excess = true; word().signs.push(e);
  };
  const divider = () => { if (omit) return; cur = null; pendingDiv = true; divAtEnd = false; }; // an omitted divider is not carved
  lines.forEach((raw, li) => {
    line = li;
    let l = raw.replace(/^\d+'?\.\s*/, '').replace(/_%peo\s+/g, '').replace(/_/g, '').replace(/[#?!]/g, '').trim();
    const runOn = /-;?\s*$/.test(l); l = l.replace(/-;?\s*$/, '').replace(/;\s*$/, '').trim();
    const cont = /^-/.test(l); l = l.replace(/^-/, '');
    if (!cont) cur = null; else if (cur) (cur as EdWord).breaks.push((cur as EdWord).signs.length); // a new line starts a new word unless the edition marks the run-on
    const parts = l.split(/\s+/).filter(Boolean);
    parts.forEach((p, pi) => {
      let i = 0, tok = '';
      const flush = () => { sign(tok); tok = ''; };
      while (i < p.length) {
        if (p.startsWith('<<', i)) { flush(); excess = true; i += 2; continue; }
        if (p.startsWith('>>', i)) { flush(); excess = false; i += 2; continue; }
        if (p.startsWith('...', i)) { flush(); if (!omit) { const w = word(); for (let k = 0; k < LOST_RUN; k++) w.signs.push({ s: LOST }); w.lost = true; } i += 3; continue; }
        const c = p[i++];
        if (c === '<') { flush(); omit = true; } else if (c === '>') { flush(); omit = false; }
        else if (c === '[') { flush(); restored = true; } else if (c === ']') { flush(); restored = false; }
        else if (c === '-') flush();
        else if (c === ':') { flush(); divider(); }
        else tok += c;
      }
      flush();
      if (!(runOn && pi === parts.length - 1)) cur = null; // a space ends a word, divider or not; a run-on line's last word goes on
    });
    if (!runOn) { if (pendingDiv) divAtEnd = true; cur = null; }
  });
  if (pendingOmit.length && out.length) out[out.length - 1].omitted.push(...pendingOmit);
  const words = out.filter(w => w.signs.length) as EdWord[] & { trailing?: boolean };
  words.trailing = pendingDiv; // the text ends with a divider
  return words;
}
/** edition words → the carved lines, sign by sign ("ba-ga : va-za-ra-ka : a-u-ra-"): a divider before each word that has one
 *  (at the end of the previous line where the edition puts it there), a word broken across lines broken at the same sign */
export function edSignLines(words: EdWord[] & { trailing?: boolean }): string[] {
  const lines: string[][] = [[]]; let cur = words.length ? words[0].line : 0;
  words.forEach((w, i) => {
    const div = i > 0 && w.divBefore, names = w.signs.map(x => x.s);
    if (div && w.divAtEnd && cur < w.line) lines[lines.length - 1].push(':');
    while (cur < w.line) { lines.push([]); cur++; }
    if (div && !(w.divAtEnd && lines[lines.length - 1].length === 0 && lines.length > 1 && lines[lines.length - 2].at(-1) === ':')) lines[lines.length - 1].push(':');
    let from = 0;
    for (const b of w.breaks) if (b > from && b < names.length) { lines[lines.length - 1].push(names.slice(from, b).join('-')); lines.push([]); cur++; from = b; }
    lines[lines.length - 1].push(names.slice(from).join('-'));
  });
  if (words.trailing) lines[lines.length - 1].push(':');
  return lines.map(l => l.join(' ')).filter(Boolean);
}

/** a sign-by-sign line ("ba-ga : va-za-ra-ka : a-u-ra-") → sign names and dividers (":"); a group without a divider after it
 *  continues on the next line */
export function parseSigns(line: string): string[] {
  const out: string[] = [];
  for (const tok of line.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === ':') { out.push(':'); continue; }
    for (const s of tok.split('-').filter(Boolean)) { if (s !== LOST && !(s in SIGN)) throw new Error(`no Old Persian sign ${s} in "${line}"`); out.push(s); }
  }
  return out;
}
/** sign names → the carved characters: a sign's code point, 𐏐 for a divider, a no-break space for a lost sign (the layout
 *  keeps its width: decor.ts) */
export function signsToCuneiform(signs: string[]): string {
  return signs.map(s => (s === ':' ? WORD_DIVIDER : s === LOST ? ' ' : String.fromCodePoint(SIGN[s]))).join('');
}
/** the carved lines of an inscription's Old Persian version (inscriptions.json op_signs), as cuneiform strings */
export function carvedLines(opSigns: string[]): string[] { return opSigns.map(l => signsToCuneiform(parseSigns(l))); }
/** a sign sequence as Kent prints it (a-u-ra-ma-za-da-a) */
export const signString = (signs: string[]) => signs.join('-');
