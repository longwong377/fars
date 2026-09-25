// The carved Old Persian is the published sign sequence (D-184; Phase 8 review C1 of both rounds). Everything here tests the
// SHIPPED path: src/arch/inscription_text.ts panelText(), which decor.ts and naqsh.ts carve, read back sign by sign, against
//  - the published sign-by-sign edition, ORACC ARIo in CATF (Schmitt 2009, CC0; data/corpus/ario_catf.json), re-read here by
//    this file's own small parser (not the build's): every sign, word divider and logogram of every carved text, as the stone
//    stood in 467 (the engraver's extra signs carved, his omissions not, the editor's restorations of later damage carved).
//    Any difference fails unless it is in EXCEPTIONS below, with its reason (logged in Q-288);
//  - the words the reviews named (Xerxes' name; Hāxāmanišiya's extra a; adāraiya; DPb's XŠ; Auramazdā<ma>iy; Su-gu-da; the
//    dividers of paruvzanānām and Ariyaciça), written out by hand;
//  - Kent's orthographic rules on Schmitt's normalised words (the reviewers' round-1 method): every carved word they would
//    spell otherwise is classed (glide, logogram, engraver, reading, damaged) in research/OP_SIGNS.md;
//  - the project's own lexicon (research/LEXICON/old_persian.json sign_spelling).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import inscriptions from '../src/data/inscriptions.json';
import lexicon from '../research/LEXICON/old_persian.json';
import edition from '../data/corpus/ario_catf.json';
import { spellNormalised, spellKent, parseSigns, carvedLines, catfWords, SIGN, WORD_DIVIDER, LOST, LOST_RUN } from '../src/lang/oldPersian';
import { panelText } from '../src/arch/inscription_text';

const INS = inscriptions as Record<string, any>, ED = (edition as any).texts as Record<string, { q: string; op: string[] }>;
/** every Old Persian text carved in the world (DPh: sealed plates, not carved) */
const CARVED_OP = ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DNa', 'DNb', 'DPa', 'DPb', 'DPc', 'DPd', 'DPe'];
/** documented differences between the carving and the edition (id, the edition's tokens, the carved tokens, why; Q-288).
 *  None: the carving is the edition. A new difference must be added here with its reason, or the test fails. */
const EXCEPTIONS: { id: string; edition: string; carved: string; why: string }[] = [];
const NAME = Object.fromEntries(Object.entries(SIGN).map(([k, c]) => [String.fromCodePoint(c), k]));
/** the carved characters of a panel read back as a stream of sign names, ":" for a divider, "x" for an uncut blank */
const carvedStream = (id: string) => [...panelText(id, 'op')!.lines.join('')].map(ch => (ch === WORD_DIVIDER ? ':' : ch === ' ' ? LOST : NAME[ch] ?? `?${ch}`));
/** the carved characters read back into sign groups (a group = the signs between two dividers) */
function carvedGroups(lines: string[]): string[] {
  const groups: string[][] = [[]];
  for (const l of lines) for (const ch of l) { if (ch === WORD_DIVIDER) { groups.push([]); continue; } groups[groups.length - 1].push(ch === ' ' ? LOST : NAME[ch] ?? `?${ch}`); }
  return groups.filter(g => g.length).map(g => g.join('-'));
}
/** the edition's Old Persian, re-read independently of the build (after the Phase 8 round-2 reviewer's method): the stone
 *  as it stood in 467 = the sign line with <<extra>> kept, <omitted> dropped, [restored] kept, [...] → LOST_RUN blanks,
 *  damage marks dropped; CATF sign names → sign names */
function editionStream(id: string): string[] {
  const CI = new Set(['mi', 'di', 'vi', 'ji', 'ku', 'gu', 'tu', 'du', 'nu', 'mu', 'ru']);
  const name = (t: string) => (['a', 'i', 'u'].includes(t) || CI.has(t) ? t : ({ disz: 'ma', munus: 'fa', sz: 'ša', xsz: 'XŠ' } as Record<string, string>)[t] ?? t + 'a');
  let text = ED[id].op.map(l => l.replace(/^\d+'?\.\s*/, '')).join('\n');
  text = text.replace(/_%peo\s+/g, '').replace(/_/g, '').replace(/<<([^>]*)>>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/[\[\]#?!;]/g, '');
  const out: string[] = [];
  for (const part of text.split(/[\s-]+/).filter(Boolean)) {
    if (part === ':') { out.push(':'); continue; }
    for (const piece of part.split(/(:|\.\.\.)/).filter(Boolean)) out.push(...(piece === ':' ? [':'] : piece === '...' ? Array(LOST_RUN).fill(LOST) : [name(piece)]));
  }
  return out;
}

describe('Old Persian: the carved signs are the published sign-by-sign edition (ARIo in CATF, CC0), sign for sign', () => {
  it('every carved text equals the edition, sign by sign, with its dividers and logograms (no difference outside EXCEPTIONS)', () => {
    let signs = 0, dividers = 0; const diffs: string[] = [], per: string[] = [];
    for (const id of CARVED_OP) {
      const want = editionStream(id), got = carvedStream(id);
      const n = Math.max(want.length, got.length);
      let first = -1; for (let i = 0; i < n; i++) if (want[i] !== got[i]) { first = i; break; }
      if (first >= 0) {
        const e = want.slice(first, first + 6).join(' '), c = got.slice(first, first + 6).join(' ');
        if (!EXCEPTIONS.some(x => x.id === id && e.startsWith(x.edition) && c.startsWith(x.carved))) diffs.push(`${id} at ${first}: edition ${e} | carved ${c} (${want.length} vs ${got.length})`);
      }
      signs += want.filter(s => s !== ':').length; dividers += want.filter(s => s === ':').length; per.push(`${id} ${want.length}`);
    }
    console.log(`ARIo CATF vs carved: ${signs} signs and ${dividers} dividers in ${CARVED_OP.length} texts (${per.join(', ')}); ${diffs.length} differences outside the ${EXCEPTIONS.length} listed`);
    expect(diffs).toEqual([]);
    expect(signs).toBeGreaterThan(5000);
  });
  it('the words the round-2 review named are carved as the stone has them', () => {
    const W = (id: string, ario: string) => (INS[id].op_words as any[]).find(r => r.ario === ario);
    expect(W('XPa', 'Haxāmanišiya').signs).toBe('ha-a-xa-a-ma-na-i-ša-i-ya'); // the engraver's extra a (<<a>>) is on the stone
    expect(W('XPa', 'Haxāmanišiya').excess).toEqual(['a']);
    expect((INS.DNa.op_words as any[]).filter(r => r.ario === 'adāraya').map(r => r.signs)).toContain('a-da-a-ra-i-ya'); // DNa 22: a-d-a-r-i-y
    expect(W('DPb', 'xšāyaθiya').signs).toBe('XŠ'); // the logogram the stone writes
    expect(W('DNa', 'A.uramazdāmai̯').signs).toBe('a-u-ra-ma-za-da-a-i-ya'); // <disz>: the ma the engraver omitted is not cut
    expect(W('DNa', 'A.uramazdāmai̯').omitted).toEqual(['ma']);
    expect(W('DPe', 'Suguda').signs).toBe('sa-u-gu-da'); // s-u-gu-<u>-d: no u after gu on this stone
    expect(W('DNa', 'Suguda').signs).toBe('sa-u-gu-u-da'); // DNa has it
    const g = (id: string) => carvedGroups(panelText(id, 'op')!.lines);
    expect(g('XPa')).toContain('pa-ru-u-va-za-na-a-na-a-ma'); // no divider inside paruvzanānām on XPa (XPc has one)
    expect(g('XPc')).toContain('pa-ru-u-va');
    expect(g('DNa')).toContain('a-ra-i-ya-ca-i-ça');
    for (const id of ['XPd', 'XPe', 'DPd']) expect(panelText(id, 'op')!.lines.at(-1)!.endsWith(WORD_DIVIDER), `${id} ends with a divider`).toBe(true);
    expect(panelText('DPb', 'op')!.lines.at(-1)!.endsWith(WORD_DIVIDER), 'DPb ends without one').toBe(false);
  });
  it("Xerxes' name is xa-ša-ya-a-ra-ša-a on every Xerxes text and wherever it is carved, never the letter-by-letter xa-ša-ya-ra-ša-a", () => {
    let n = 0;
    for (const id of CARVED_OP) {
      const g = carvedGroups(panelText(id, 'op')!.lines);
      if (id.startsWith('XP')) expect(g.filter(x => x.startsWith('xa-ša-ya-a-ra-ša-a')).length, id).toBeGreaterThan(0);
      expect(g.some(x => /^xa-ša-(ha-)?ya-ra-ša/.test(x)), id).toBe(false);
      for (const r of INS[id].op_words as any[]) if (/^Xšayaṛš/.test(r.ario ?? '')) { n++; expect(r.signs, `${id} ${r.ario}`).toMatch(/^xa-ša-ya-a-ra-ša-a/); }
    }
    expect(n).toBeGreaterThanOrEqual(14);
  });
  it('every panel carves exactly the stored sign sequence, in the edition\'s lines, in period signs only', () => {
    for (const id of CARVED_OP) {
      const t = INS[id], p = panelText(id, 'op')!;
      expect(p.font, id).toBe('op'); expect(p.lined, id).toBe(true);
      expect(p.lines, id).toEqual(carvedLines(t.op_signs));
      expect(t.op_signs.length, `${id}: the edition's line count`).toBe(ED[id].op.length);
      for (const l of p.lines) for (const ch of l) { const c = ch.codePointAt(0)!; expect(c === 0xa0 || (c >= 0x103a0 && c <= 0x103d5), `${id}: ${ch}`).toBe(true); }
    }
  });
  it('every word of Schmitt\'s normalised text is accounted for: aligned with a word on the stone, or omitted by the engraver', () => {
    for (const id of CARVED_OP) {
      const words = String(INS[id].op_translit).split(/\s+/).filter(Boolean), rows = (INS[id].op_words as any[]).filter(r => r.ario).map(r => r.ario);
      expect(rows, id).toEqual(words);
      for (const r of INS[id].op_words as any[]) if (r.cmp === 'ario-only') expect(r.signs, `${id} ${r.ario}`).toBeNull();
    }
    // DNb: the words the engraver left out (Schmitt supplies them from XPl) are not carved; unrestored stretches are blanks
    expect((INS.DNb.op_words as any[]).filter(r => r.cmp === 'ario-only').map(r => r.ario)).toContain('avanā');
    expect(carvedStream('DNb').filter(s => s === LOST).length).toBe(6 * LOST_RUN);
  });
  it('the reviewers\' round-1 method (Kent\'s rules on Schmitt\'s words): every carved word it spells otherwise is classed', () => {
    let n = 0, differ = 0; const cls: Record<string, number> = {};
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!r.ario || !r.signs) continue;
      n++;
      if (spellNormalised(r.ario).join('-') === r.signs) { expect(r.cmp, `${id} ${r.ario}`).toBe('same'); continue; }
      differ++; cls[r.cmp] = (cls[r.cmp] ?? 0) + 1;
      expect(['glide', 'logogram', 'engraver', 'reading', 'damaged'], `${id} ${r.ario}: ${r.signs}`).toContain(r.cmp);
    }
    console.log(`Kent's rules on Schmitt's words: ${differ} of ${n} carved words spelled otherwise on the stone, all classed: ${JSON.stringify(cls)}`);
    expect(differ / n).toBeLessThan(0.06);
  });
  it('the edition file is CC0 and the scraped Livius copy is gone (D-184 replaces D-176)', () => {
    const meta = String((edition as any)._meta);
    for (const s of ['CC0', 'oracc/catf', 'ario.catf', 'sha256 eb8de252']) expect(meta, s).toContain(s);
    expect(existsSync('data/corpus/op_translit.json')).toBe(false); expect(existsSync('data/corpus/op_sign_decisions.json')).toBe(false);
  });
  it("the project's lexicon spells every carved word it holds as it is carved", () => {
    const carved = new Map<string, Set<string>>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) if (r.ario && r.signs && r.cmp === 'same') (carved.get(r.ario) ?? carved.set(r.ario, new Set()).get(r.ario)!).add(r.signs);
    // an entry whose spelling is of another form than its `form` (logged: Q-291, for the lexicon's owner)
    const OTHER_FORM: Record<string, string> = { Mudrāya: 'the entry spells the attested nom. pl. Mudrāyā (DSf: mu-u-da-ra-a-ya-a); the carved DNa/DPe word is the name Mudrāya' };
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

/** Kent's orthography by hand, sign by sign, for the words the reviews measured and a few more of each rule */
const HAND: Record<string, string> = {
  Xšayaṛšā: 'xa-ša-ya-a-ra-ša-a', Xšayaṛšām: 'xa-ša-ya-a-ra-ša-a-ma', θāti: 'θa-a-ta-i-ya', pātu: 'pa-a-tu-u-va', 'nai̯': 'na-i-ya', 'vasai̯': 'va-sa-i-ya',
  'dūrai̯': 'du-u-ra-i-ya', api: 'a-pa-i-ya', aniyašci: 'a-na-i-ya-ša-ca-i-ya', 'utamai̯': 'u-ta-ma-i-ya', Gandāra: 'ga-da-a-ra', 'hantaxšatai̯': 'ha-ta-xa-ša-ta-i-ya',
  handugām: 'ha-du-u-ga-a-ma', ṛštika: 'a-ra-ša-ta-i-ka', kṛtam: 'ka-ra-ta-ma', vazṛka: 'va-za-ra-ka', 'A.uramazdā': 'a-u-ra-ma-za-da-a', 'Dārayava.uš': 'da-a-ra-ya-va-u-ša',
  Haxāmanišiya: 'ha-xa-a-ma-na-i-ša-i-ya', puça: 'pa-u-ça', xšāyaθiya: 'xa-ša-a-ya-θa-i-ya', Ūja: 'u-va-ja', duvarθim: 'du-u-va-ra-θa-i-ma', būmim: 'ba-u-mi-i-ma', 'akunau̯š': 'a-ku-u-na-u-ša',
};
describe('Old Persian orthography and the edition reader (src/lang/oldPersian.ts)', () => {
  it('the words the reviews measured are carved as Kent spells them wherever the stone agrees with the rules', () => {
    const seen = new Set<string>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) if (r.ario in HAND && r.cmp === 'same') { seen.add(r.ario); expect(r.signs, `${id} ${r.ario}`).toBe(HAND[r.ario]); }
    for (const w of ['Xšayaṛšā', 'Xšayaṛšām', 'θāti', 'pātu', 'nai̯', 'Gandāra', 'hantaxšatai̯', 'handugām', 'ṛštika']) expect(seen.has(w), `${w} is carved somewhere`).toBe(true);
    for (const [w, s] of Object.entries(HAND)) expect(spellNormalised(w).join('-'), w).toBe(s);
  });
  it('reads the edition: run-on words, dividers, logograms, extra, omitted and restored signs, lost stretches', () => {
    const W = catfWords(['1. h-<<a>>-x-a-disz-n-i-sz-;', '2. -i-y : _%peo xsz_ : a-u-r-disz-z-d-a-<disz>-i-y : [d]-a#-[r-y]-v-u-sz', "3. : <a-v-n-a :> x-sz-nu-u-t : [...]-di-i-y :"]);
    expect(W.map(w => w.signs.map(s => s.s).join('-'))).toEqual(['ha-a-xa-a-ma-na-i-ša-i-ya', 'XŠ', 'a-u-ra-ma-za-da-a-i-ya', 'da-a-ra-ya-va-u-ša', 'xa-ša-nu-u-ta', 'x-x-x-di-i-ya']);
    expect(W[0].breaks).toEqual([8]); expect(W[0].signs[1].excess).toBe(true); expect(W[2].omitted).toEqual(['ma']);
    expect(W[3].signs.filter(s => s.restored).map(s => s.s)).toEqual(['da', 'ra', 'ya']); expect(W[3].divBefore).toBe(true);
    expect(W[3].omitted).toEqual([]); expect(W[4].omitted).toEqual(['a', 'va', 'na', 'a']); // a whole omitted word is noted on the word after it expect(W[5].lost).toBe(true); expect(W.trailing).toBe(true);
    expect(spellKent('XŠânâm').join('-')).toBe('XŠ-a-na-a-ma');
  });
  it('parses a sign-by-sign line and rejects an unknown sign', () => {
    expect(parseSigns('ba-ga : va-za-ra-ka : a')).toEqual(['ba', 'ga', ':', 'va', 'za', 'ra', 'ka', ':', 'a']);
    expect(() => parseSigns('ba-qa')).toThrow();
  });
});

describe('the letter-by-letter spelling the world carved before D-177 fails these checks', () => {
  /** src/lang/oldPersian.ts spellWord at cd83211, fed ARIo's transcription (as decor.ts and naqsh.ts did) */
  const old = (w: string) => spellKent(w.replace(/ṛ/g, 'r')).join('-');
  it("it misspells the king's name, the reviews' words and about one carved word in five", () => {
    expect(old('Xšayaṛšā')).toBe('xa-ša-ya-ra-ša-a'); expect(old('θāti')).toBe('θa-a-ta-i'); expect(old('Gandāra')).toBe('ga-na-da-a-ra');
    let words = 0, wrong = 0;
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!r.ario || !r.signs || String(r.ario).includes('-') || r.ario === 'x') continue;
      words++; if (old(r.ario) !== r.signs) wrong++;
    }
    console.log(`the old spelling differs from the carving in ${wrong} of ${words} words`);
    expect(wrong / words).toBeGreaterThan(0.15);
  });
});

describe('Elamite and Babylonian: the carved lines are the edition\'s, as the stone stood in 467 (D-184; round-3 review M1)', () => {
  const EDX = (edition as any).texts as Record<string, Record<string, string[]>>;
  /** the edition's marks counted straight from the CATF lines (independent of tools/build_cun_lines.py): signs inside <…>
   *  (omitted by the scribe) or inside […] (restored), a sign being a reading between separators */
  const count = (lines: string[], open: string, close: string) => {
    let n = 0, depth = 0, tok = '';
    const text = lines.map(l => l.replace(/^\d+'?\.\s*/, '').replace(/%[a-z]+\s*/g, '').replace(/_/g, '')).join(' ').replace(/<<[^>]*>>/g, m => m.replace(/[<>]/g, ''));
    const flush = () => { if (tok && depth > 0 && !['x', '...'].includes(tok)) n++; tok = ''; };
    for (const c of text) {
      if (c === open) { flush(); depth++; } else if (c === close) { flush(); depth = Math.max(0, depth - 1); }
      else if (/[\s\-.{}()]/.test(c)) flush(); else if (!/[#?!*<>[\]]/.test(c)) tok += c;
    }
    flush(); return n;
  };
  const carvedCun = Object.entries(INS).filter(([k]) => k !== '_meta').flatMap(([id, t]) => (['el', 'bab'] as const).filter(v => t[`${v}_cuneiform`]).map(v => [id, v] as const));
  it('every carved Elamite and Babylonian version is in the edition\'s lines, without word spaces', () => {
    expect(carvedCun.length).toBe(26); // D-214: + XPj, XPk, XPm (Elamite and Babylonian)
    for (const [id, v] of carvedCun) {
      const p = panelText(id, v)!;
      expect(p.lined, `${id} ${v}`).toBe(true); expect(p.lines.length, `${id} ${v}`).toBe(EDX[id][v].length);
      expect(p.lines.join('').includes(' '), `${id} ${v}: word spaces`).toBe(false);
    }
  });
  it('the signs the scribe omitted (<…>) are not carved, the restored ones ([…]) are counted (tier C): counted from the edition', () => {
    let omitted = 0, restored = 0;
    for (const [id, v] of carvedCun) {
      const L = EDX[id][v], m = INS[id][`${v}_marks`], o = count(L, '<', '>'), r = count(L, '[', ']');
      expect(m, `${id} ${v}`).toBeTruthy();
      expect(m.omitted, `${id} ${v} omitted`).toBe(o); expect(m.restored, `${id} ${v} restored`).toBe(r);
      // the carved lines are the running text (which includes the supplied signs) less exactly the omitted ones
      const run = [...String(INS[id][`${v}_cuneiform`]).replace(/\s+/g, '')], cut = [...panelText(id, v)!.lines.join('')];
      expect(run.length - cut.length, `${id} ${v}: signs dropped`).toBe(o);
      omitted += o; restored += r;
    }
    expect(omitted).toBe(2); expect(restored).toBe(115); // D-214: XPk's Elamite and Babylonian are mostly restored (18, 12)
    // the two the round-3 review named: XPa El {d}u-ra-mas-da-<na> and XPd El sza2-ak-<ri>
    expect(panelText('XPa', 'el')!.lines[10]).toContain('𒀭𒌋𒊏𒈦𒁕𒄭'); expect(panelText('XPa', 'el')!.lines[10]).not.toContain('𒁕𒈾𒄭');
    expect(panelText('XPd', 'el')!.lines[7].endsWith('𒀝')).toBe(true);
    expect(String(INS.XPa.tier.version_split)).toMatch(/^A/);
  });
});
