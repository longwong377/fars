// The carved Old Persian is the published sign sequence (D-177; Phase 8 review C1, both lenses). Everything here tests the
// SHIPPED path: src/arch/inscription_text.ts panelText(), which decor.ts and naqsh.ts carve, read back sign by sign and word
// by word, per inscription, against
//  - the published sign-by-sign transliteration (Kent's convention; data/corpus/op_translit.json, D-176), re-derived here from
//    the corpus lines and the listed corrections of slips of the copy (data/corpus/op_sign_decisions.json), not read from
//    the build's own output: every word of every carved text, Xerxes' name included;
//  - Kent's orthographic rules, written out by hand for the words the reviews measured (final -y/-v, unwritten nasals,
//    ṛ as a-r, Xerxes' name xa-ša-ya-a-ra-ša-a …), independent of the speller;
//  - the reviewers' own method (Kent's rules applied to Schmitt's normalised words): every carved word it would spell
//    otherwise is a listed glide, logogram or reading difference of the two editions (research/OP_SIGNS.md, Q-288);
//  - the project's own lexicon (research/LEXICON/old_persian.json sign_spelling).
// The letter-by-letter spelling the world carved before (toCuneiform on ARIo's transcription) fails these tests: the last
// block measures by how much.
import { describe, it, expect } from 'vitest';
import inscriptions from '../src/data/inscriptions.json';
import lexicon from '../research/LEXICON/old_persian.json';
import corpus from '../data/corpus/op_translit.json';
import decisions from '../data/corpus/op_sign_decisions.json';
import { spellNormalised, spellKent, parseSigns, carvedLines, corpusWords, SIGN, WORD_DIVIDER, LOST } from '../src/lang/oldPersian';
import { panelText } from '../src/arch/inscription_text';

const INS = inscriptions as Record<string, any>, CORPUS = corpus as Record<string, any>;
const FIX = (decisions as any).corrections as { id: string; copy: string; read: string; count: number; evidence: string; why: string }[];
/** every Old Persian text carved in the world (DPh: sealed plates, not carved) */
const CARVED_OP = ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DNa', 'DNb', 'DPa', 'DPb', 'DPc', 'DPd', 'DPe'];
const NAME = Object.fromEntries(Object.entries(SIGN).map(([k, c]) => [String.fromCodePoint(c), k]));
/** the carved characters of a panel read back into sign groups (a group = the signs between two dividers; a group broken
 *  across lines is one group) */
function carvedGroups(lines: string[]): string[] {
  const groups: string[][] = [[]];
  for (const l of lines) for (const ch of l) {
    if (ch === WORD_DIVIDER) { groups.push([]); continue; }
    groups[groups.length - 1].push(ch === '\u00a0' ? LOST : NAME[ch] ?? `?${ch}`);
  }
  return groups.filter(g => g.length).map(g => g.join('-'));
}
/** the published sign sequence of a text, re-derived from the corpus: its words (with the listed corrections), grouped as the
 *  stone divides them (two words with no divider between them are one group) */
function publishedGroups(id: string): { groups: string[]; words: number; fixed: number } {
  let fixed = 0;
  const W = corpusWords(CORPUS[id].lines, copy => { const f = FIX.find(c => c.id === id && c.copy === copy); if (f) fixed++; return f ? f.read : null; });
  const groups: string[] = [];
  W.forEach((w, i) => { const s = w.signs.join('-'); if (i > 0 && !w.divBefore) groups[groups.length - 1] += '-' + s; else groups.push(s); });
  return { groups, words: W.length, fixed };
}
/** Kent's orthography by hand, sign by sign, for the words the reviews measured and a few more of each rule */
const HAND: Record<string, string> = {
  Xšayaṛšā: 'xa-ša-ya-a-ra-ša-a', Xšayaṛšām: 'xa-ša-ya-a-ra-ša-a-ma',           // the king's name (review C1 rule 4)
  θāti: 'θa-a-ta-i-ya', pātu: 'pa-a-tu-u-va', 'nai̯': 'na-i-ya', 'vasai̯': 'va-sa-i-ya', 'dūrai̯': 'du-u-ra-i-ya', api: 'a-pa-i-ya', // final -i/-u + y/v
  aniyašci: 'a-na-i-ya-ša-ca-i-ya', avašci: 'a-va-ša-ca-i-ya', tayapati: 'ta-ya-pa-ta-i-ya', 'utamai̯': 'u-ta-ma-i-ya', 'tayamai̯': 'ta-ya-ma-i-ya', 'vai̯natai̯': 'va-i-na-ta-i-ya',
  Gandāra: 'ga-da-a-ra', Hinduš: 'ha-i-du-u-ša', Zranka: 'za-ra-ka', 'hantaxšatai̯': 'ha-ta-xa-ša-ta-i-ya', handugām: 'ha-du-u-ga-a-ma', // nasal before a consonant unwritten
  ṛštika: 'a-ra-ša-ta-i-ka', kṛtam: 'ka-ra-ta-ma', vazṛka: 'va-za-ra-ka',       // ṛ written a-r / Ca-r
  'A.uramazdā': 'a-u-ra-ma-za-da-a', 'Dārayava.uš': 'da-a-ra-ya-va-u-ša', Haxāmanišiya: 'ha-xa-a-ma-na-i-ša-i-ya', puça: 'pa-u-ça', xšāyaθiya: 'xa-ša-a-ya-θa-i-ya',
  Ūja: 'u-va-ja', duvarθim: 'du-u-va-ra-θa-i-ma', Visadahyum: 'vi-i-sa-da-ha-ya-u-ma', būmim: 'ba-u-mi-i-ma', 'akunau̯š': 'a-ku-u-na-u-ša',
};

describe('Old Persian: the carved signs are the published sign sequence (shipped path, per inscription, word by word)', () => {
  it('every word of every carved Old Persian text is the corpus word\'s signs (re-derived from the corpus), Xerxes\' name included', () => {
    let words = 0, groupsChecked = 0, mismatches = 0, fixed = 0; const bad: string[] = [], per: string[] = [];
    for (const id of CARVED_OP) {
      expect(CORPUS[id], `${id}: a carved text without a corpus copy`).toBeTruthy();
      const want = publishedGroups(id), got = carvedGroups(panelText(id, 'op')!.lines);
      expect(got.length, `${id}: word groups carved vs published`).toBe(want.groups.length);
      want.groups.forEach((g, i) => { groupsChecked++; if (got[i] !== g) { mismatches++; bad.push(`${id} #${i}: carved ${got[i]}, published ${g}`); } });
      words += want.words; fixed += want.fixed; per.push(`${id} ${want.words}`);
    }
    console.log(`published sign sequence: ${words} corpus words in ${groupsChecked} divided groups checked (${per.join(', ')}); ${mismatches} mismatches; ${fixed} words carved as corrected slips of the copy`);
    expect(bad).toEqual([]);
    expect(words).toBeGreaterThan(1000);
    expect(fixed).toBe(FIX.reduce((n, c) => n + c.count, 0));
  });
  it('every panel carves exactly the stored sign sequence, in period signs only', () => {
    for (const id of CARVED_OP) {
      const t = INS[id], p = panelText(id, 'op')!;
      expect(t.op_signs?.length, id).toBeGreaterThan(0); expect(p.font, id).toBe('op'); expect(p.lined, id).toBe(true);
      expect(p.lines, id).toEqual(carvedLines(t.op_signs));
      for (const l of p.lines) for (const ch of l) { const c = ch.codePointAt(0)!; expect(c === 0xa0 || (c >= 0x103a0 && c <= 0x103d5), `${id}: ${ch}`).toBe(true); }
    }
  });
  it("Xerxes' name is xa-ša-ya-a-ra-ša-a on every Xerxes text and wherever it is carved, never the letter-by-letter xa-ša-ya-ra-ša-a", () => {
    let n = 0;
    for (const id of CARVED_OP) {
      const g = carvedGroups(panelText(id, 'op')!.lines);
      if (id.startsWith('XP')) expect(g.filter(x => x.startsWith('xa-ša-ya-a-ra-ša-a')).length, id).toBeGreaterThan(0);
      expect(g.some(x => /^xa-ša-(ha-)?ya-ra-ša/.test(x) || x.startsWith('xa-ša-ha-ya')), id).toBe(false);
      for (const r of INS[id].op_words as any[]) if (/^Xšayaṛš/.test(r.ario ?? '')) { n++; expect(r.signs, `${id} ${r.ario}`).toMatch(/^xa-ša-ya-a-ra-ša-a/); }
    }
    expect(n).toBeGreaterThanOrEqual(14);
  });
  it('each correction of the copy is used as listed and meets its evidence (Schmitt\'s reading, the copy elsewhere, or the convention)', () => {
    const all = Object.entries(CORPUS).filter(([k]) => k !== '_meta').flatMap(([, v]) => corpusWords(v.lines).map(w => w.copy.replace(/\|/g, '')));
    for (const c of FIX) {
      const W = corpusWords(CORPUS[c.id].lines), hits = W.filter(w => w.copy === c.copy);
      expect(hits.length, `${c.id} ${c.copy}`).toBe(c.count);
      const signs = spellKent(c.read.replace(/\|/g, '')).join('-');
      if (c.evidence === 'ario') {
        const row = (INS[c.id].op_words as any[]).find(r => String(r.read ?? '').split(' ').includes(c.read));
        expect(row?.ario, `${c.id} ${c.copy}: aligned with a word of Schmitt's`).toBeTruthy();
        expect(String(row.ario).split(' ').map((w: string) => spellNormalised(w).join('-')).join('-'), `${c.id} ${c.copy} → ${c.read}`).toBe(signs);
      } else if (c.evidence === 'copy') expect(all, `${c.id} ${c.read} stands elsewhere in the corpus`).toContain(c.read.replace(/\|/g, ''));
      else { expect(c.evidence).toBe('convention'); expect(c.copy.replace(/([bcdfghjklmnprstvxzθšç])\1/g, '$1'), c.copy).toBe(c.read); }
      expect(c.why.length, c.copy).toBeGreaterThan(20);
    }
  });
  it('the corpus holds transliteration lines only (D-176): no translation, commentary or page text; its licence basis stated', () => {
    const meta = String(CORPUS._meta);
    for (const s of ['public domain', 'Kent', '1953', 'Lecoq', '1997', 'Electronic-Old-Persian-Library/Old-Persian-Dataset', 'CC-BY-NC', 'All rights reserved', 'NOT stored']) expect(meta, s).toContain(s);
    for (const [id, v] of Object.entries(CORPUS)) {
      if (id === '_meta') continue;
      expect(Object.keys(v).sort(), id).toEqual(['file', 'lines', 'sha256']);
      for (const l of v.lines as string[]) for (const t of l.split(/[\s\\]+/).filter(Boolean)) expect(t, `${id}: "${t}" in "${l}"`).toMatch(/^[A-Za-zâîûθšçŠÛ\-+()]+$/);
      // no English: a transliterated word never is one of these
      expect((v.lines as string[]).join(' ').split(/[\s\\]+/).filter(t => /^(the|and|of|to|is|in|by|king|god|this|that|which|who|I|me|my|he|his)$/.test(t)), id).toEqual([]);
    }
  });
  it('every word of Schmitt\'s edition is accounted for: carved (aligned with a corpus word) or listed as not carved', () => {
    for (const id of CARVED_OP) {
      const words = String(INS[id].op_translit).split(/\s+/).filter(Boolean), rows = (INS[id].op_words as any[]).flatMap(r => String(r.ario ?? '').split(' ').filter(Boolean));
      expect(rows, id).toEqual(words);
      for (const r of INS[id].op_words as any[]) if (r.cmp === 'ario-only') expect(r.signs, `${id} ${r.ario}`).toBeNull();
    }
    // DNb: the corpus's lost signs are left uncut, one blank per lost sign (not closed up, not invented)
    const plus = (CORPUS.DNb.lines as string[]).join('').split('').filter(c => c === '+').length;
    expect(carvedGroups(panelText('DNb', 'op')!.lines).join('-').split('-').filter(s => s === LOST).length).toBe(plus);
    expect(plus).toBe(26);
  });
  it('the reviewers\' method (Kent\'s rules on Schmitt\'s words): every carved word it spells otherwise is a listed glide, logogram or reading difference', () => {
    let n = 0, differ = 0; const cls: Record<string, number> = {};
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!r.ario || !r.signs) continue;
      n++;
      const rule = String(r.ario).split(' ').map((w: string) => spellNormalised(w).join('-')).join('-'), carved = String(r.signs).replace(/ : | /g, '-');
      if (rule === carved) { expect(r.cmp, `${id} ${r.ario}`).toBe('same'); continue; }
      differ++; cls[r.cmp] = (cls[r.cmp] ?? 0) + 1;
      expect(['glide', 'logogram', 'reading'], `${id} ${r.ario} (${rule}) carved ${carved} (${r.copy}): unlisted`).toContain(r.cmp);
    }
    console.log(`reviewers' method: ${differ} of ${n} aligned word groups carved otherwise, all listed in research/OP_SIGNS.md: ${JSON.stringify(cls)}`);
    expect(differ / n).toBeLessThan(0.1);
  });
  it('the words the reviews measured are spelled as Kent spells them (hand-written expectations)', () => {
    const seen = new Set<string>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!(r.ario in HAND) || r.cmp !== 'same') continue;
      seen.add(r.ario); expect(r.signs, `${id} ${r.ario}`).toBe(HAND[r.ario]);
    }
    for (const w of ['Xšayaṛšā', 'Xšayaṛšām', 'θāti', 'pātu', 'nai̯', 'Gandāra', 'hantaxšatai̯', 'handugām', 'ṛštika']) expect(seen.has(w), `${w} is carved somewhere`).toBe(true);
  });
  it("the lines are the corpus's: the same number of lines for every carved text", () => {
    for (const id of CARVED_OP) expect(INS[id].op_signs.length, id).toBe(CORPUS[id].lines.length);
    expect(INS.XPa.op_signs.length).toBe(20); expect(INS.DNa.op_signs.length).toBe(60); expect(INS.DNb.op_signs.length).toBe(60); expect(INS.DPd.op_signs.length).toBe(24);
    expect(INS.XPa.op_signs[4]).toMatch(/fa-ra-ma$/); expect(INS.XPa.op_signs[5]).toMatch(/^a-ta-a-ra-ma : /); // XPa 5-6: fram-âtâram
  });
  it("the project's lexicon spells every carved word it holds as it is carved", () => {
    const carved = new Map<string, Set<string>>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) if (r.ario && r.signs && r.cmp === 'same' && !String(r.ario).includes(' ')) (carved.get(r.ario) ?? carved.set(r.ario, new Set()).get(r.ario)!).add(r.signs);
    // an entry whose spelling is of another form than its `form` (logged: Q-291, for the lexicon's owner)
    const OTHER_FORM: Record<string, string> = { Mudrāya: 'the entry spells and voices the attested nom. pl. Mudrāyā (DSf: mu-u-da-ra-a-ya-a, IPA mudraːjaː); the carved DNa word is the name Mudrāya' };
    let n = 0;
    for (const e of lexicon as any[]) {
      if (!e.sign_spelling || !carved.has(e.form)) continue;
      n++;
      if (e.form in OTHER_FORM) { expect([...carved.get(e.form)!], e.form).not.toContain(e.sign_spelling); continue; }
      expect([...carved.get(e.form)!], `lexicon ${e.form}`).toContain(e.sign_spelling);
    }
    expect(n).toBeGreaterThan(30);
  });
});

describe('Old Persian orthography (src/lang/oldPersian.ts)', () => {
  it('spells Kent-convention (graphemic) words, logograms and lost signs', () => {
    expect(spellKent('xšâyathiya').join('-')).toBe('xa-ša-a-ya-θa-i-ya');
    expect(spellKent('Xšayâršâ').join('-')).toBe('xa-ša-ya-a-ra-ša-a');
    expect(spellKent('θâtiy').join('-')).toBe('θa-a-ta-i-ya');
    expect(spellKent('pâtuv').join('-')).toBe('pa-a-tu-u-va');
    expect(spellKent('naiy').join('-')).toBe('na-i-ya');
    expect(spellKent('paruvzanânâm').join('-')).toBe('pa-ru-u-va-za-na-a-na-a-ma');
    expect(spellKent('Gadâra').join('-')).toBe('ga-da-a-ra');
    expect(spellKent('XŠânâm').join('-')).toBe('XŠ-a-na-a-ma');
    expect(spellKent('DHyûnâm').join('-')).toBe('DH¹-ya-u-na-a-ma');
    expect(spellKent('+++').join('-')).toBe('x-x-x');
  });
  it('reads corpus lines into words: dividers, run-on words, words without a divider, a sign-by-sign print', () => {
    const W = corpusWords(['baga \\ vazraka \\ Aura-', 'mazdâ \\ hya \\ Aurahya Mazdâha \\']);
    expect(W.map(w => w.copy)).toEqual(['baga', 'vazraka', 'Aura|mazdâ', 'hya', 'Aurahya', 'Mazdâha']);
    expect(W[2].signs.join('-')).toBe('a-u-ra-ma-za-da-a'); expect(W[2].breaks).toEqual([3]);
    expect(W[5].divBefore).toBe(false); expect(W.trailing).toBe(true);
    expect(corpusWords(['da-a-ra-ya-va-u-ša \\ xa-ša-a-', 'ya-tha-i-ya'])[1].signs.join('-')).toBe('xa-ša-a-ya-θa-i-ya');
  });
  it('applies all of Kent\'s rules to a normalised word', () => {
    for (const [w, s] of Object.entries(HAND)) expect(spellNormalised(w).join('-'), w).toBe(s);
    expect(spellNormalised('x-di-i-y').join('-')).toBe('x-di-i-ya'); // the edition's own sign transliteration of a damaged word
    expect(spellNormalised('Kṛkā').join('-')).toBe('ka-ra-ka-a');
  });
  it('parses a sign-by-sign line and rejects an unknown sign', () => {
    expect(parseSigns('ba-ga : va-za-ra-ka : a')).toEqual(['ba', 'ga', ':', 'va', 'za', 'ra', 'ka', ':', 'a']);
    expect(() => parseSigns('ba-qa')).toThrow();
  });
});

describe('the letter-by-letter spelling the world carved before D-177 fails these checks', () => {
  /** src/lang/oldPersian.ts spellWord at cd83211, fed ARIo's transcription (as decor.ts and naqsh.ts did): every letter a sign,
   *  ṛ as r, no final glide, nasals written */
  const old = (w: string) => spellKent(w.replace(/ṛ/g, 'r')).join('-');
  it("it misspells the king's name, the reviews' words and about one carved word in five", () => {
    expect(old('Xšayaṛšā')).toBe('xa-ša-ya-ra-ša-a'); expect(old('θāti')).toBe('θa-a-ta-i'); expect(old('Gandāra')).toBe('ga-na-da-a-ra');
    let words = 0, wrong = 0;
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!r.ario || !r.signs || String(r.ario).includes(' ') || String(r.ario).includes('-') || r.ario === 'x') continue;
      words++; if (old(r.ario) !== String(r.signs).replace(/ : | /g, '-')) wrong++;
    }
    console.log(`the old spelling differs from the carving in ${wrong} of ${words} words`);
    expect(wrong / words).toBeGreaterThan(0.15);
  });
});
