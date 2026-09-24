// The carved Old Persian is the published sign sequence (D-165; Phase 8 review C1, both lenses). Everything here tests the
// SHIPPED path: src/arch/inscription_text.ts panelText(), which decor.ts and naqsh.ts carve, read back sign by sign and
// word by word, per inscription, against
//  - the edition's words (ARIo, Schmitt 2009): none dropped, none added, in order (DNb's avākaram-ci-mai̯ included);
//  - Kent's orthographic rules, written out by hand for the words the reviews measured (final -y/-v, unwritten nasals,
//    ṛ as a-r, Xerxes' name xa-ša-ya-a-ra-ša-a …), independent of the speller;
//  - Kent's transliteration (the Livius copy, data/corpus/livius_op.json): every word carved by the rule that Kent spells
//    the same way reproduces his signs, and every word carved from Kent's spelling is his;
//  - the project's own lexicon (research/LEXICON/old_persian.json sign_spelling).
// The letter-by-letter spelling the world carved before (toCuneiform on ARIo's transcription) fails these tests: the last
// block measures by how much.
import { describe, it, expect } from 'vitest';
import inscriptions from '../src/data/inscriptions.json';
import lexicon from '../research/LEXICON/old_persian.json';
import kentCopy from '../data/corpus/livius_op.json';
import { spellNormalised, spellKent, parseSigns, carvedLines, SIGN, WORD_DIVIDER, LOST } from '../src/lang/oldPersian';
import { panelText } from '../src/arch/inscription_text';

const INS = inscriptions as Record<string, any>;
/** a Kent word's signs: a sign-by-sign copy (DPa) as printed, else by Kent's orthography */
const kentSigns = (k: string) => (/^([a-zθšç]+-)+[a-zθšç]+$/.test(k) ? k.split('-').map(s => (s === 'tha' ? 'θa' : s)) : spellKent(k)).join('-');
const OP_IDS = Object.keys(INS).filter(k => k !== '_meta' && INS[k].op_translit);
const CARVED_OP = ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DNa', 'DNb', 'DPa', 'DPb', 'DPc', 'DPd', 'DPe']; // DPh: sealed, not carved
const NAME = Object.fromEntries(Object.entries(SIGN).map(([k, c]) => [String.fromCodePoint(c), k]));
/** the carved characters of a panel read back into sign groups (a group = the signs between two dividers; a group broken
 *  across lines is one group) */
function carvedGroups(lines: string[]): string[] {
  const groups: string[][] = [[]];
  for (const l of lines) for (const ch of l) {
    if (ch === WORD_DIVIDER) { groups.push([]); continue; }
    groups[groups.length - 1].push(ch === ' ' ? LOST : NAME[ch] ?? `?${ch}`);
  }
  return groups.filter(g => g.length).map(g => g.join('-'));
}
/** Kent's orthography by hand, sign by sign, for the words the reviews measured and a few more of each rule */
const HAND: Record<string, string> = {
  Xšayaṛšā: 'xa-ša-ya-a-ra-ša-a', Xšayaṛšām: 'xa-ša-ya-a-ra-ša-a-ma',           // the king's name (review C1 rule 4)
  θāti: 'θa-a-ta-i-ya', pātu: 'pa-a-tu-u-va', 'nai̯': 'na-i-ya', 'vasai̯': 'va-sa-i-ya', 'dūrai̯': 'du-u-ra-i-ya', api: 'a-pa-i-ya', // final -i/-u + y/v
  aniyašci: 'a-na-i-ya-ša-ca-i-ya', avašci: 'a-va-ša-ca-i-ya', tayapati: 'ta-ya-pa-ta-i-ya', 'utamai̯': 'u-ta-ma-i-ya', 'tayamai̯': 'ta-ya-ma-i-ya', 'vai̯natai̯': 'va-i-na-ta-i-ya',
  Gandāra: 'ga-da-a-ra', Hinduš: 'ha-i-du-u-ša', Zranka: 'za-ra-ka', 'hantaxšatai̯': 'ha-ta-xa-ša-ta-i-ya', handugām: 'ha-du-u-ga-a-ma', // nasal before a consonant unwritten
  ṛštika: 'a-ra-ša-ta-i-ka', kṛtam: 'ka-ra-ta-ma', vazṛka: 'va-za-ra-ka',       // ṛ written a-r / Ca-r
  'A.uramazdā': 'a-u-ra-ma-za-da-a', 'Dārayava.uš': 'da-a-ra-ya-va-u-ša', Haxāmanišiya: 'ha-xa-a-ma-na-i-ša-i-ya', puça: 'pa-u-ça', xšāyaθiya: 'xa-ša-a-ya-θa-i-ya',
  Ūja: 'u-va-ja', duvarθim: 'du-u-va-ra-θa-i-ma', Visadahyum: 'vi-i-sa-da-ha-ya-u-ma', būmim: 'ba-u-mi-i-ma', 'akunau̯š': 'a-ku-u-na-u-ša', 'avākaram-ci-mai̯': 'a-va-a-ka-ra-ma-ca-i-ma-i-ya',
};
/** the Kent copy's words (the tool's reading of the copy is not reused: dividers and spaces only; run-on words joined) */
function kentWordsOf(id: string): string[] {
  const k = (kentCopy as any)[id]; if (!k) return [];
  return (k.lines as string[]).map(l => l.trim()).join('\n').replace(/-\n/g, '').replace(/([^\\\s])\n(?=[^\\\s])/g, '$1').split(/[\\\s]+/).filter(Boolean);
}

describe('Old Persian: the carved signs are the published sign sequence (shipped path, per inscription, word by word)', () => {
  it('every carved Old Persian text has a stored sign sequence and the panel carves exactly it', () => {
    for (const id of CARVED_OP) {
      const t = INS[id], p = panelText(id, 'op')!;
      expect(t.op_signs?.length, id).toBeGreaterThan(0);
      expect(p.font, id).toBe('op');
      expect(p.lines, id).toEqual(carvedLines(t.op_signs));
      for (const l of p.lines) for (const ch of l) { const c = ch.codePointAt(0)!; expect(c === 0xa0 || (c >= 0x103a0 && c <= 0x103d5), `${id}: ${ch}`).toBe(true); }
    }
  });
  it('the carved sign groups, read back from the panel, are the op_words rows in order (nothing dropped or added)', () => {
    for (const id of CARVED_OP) {
      const groups = carvedGroups(panelText(id, 'op')!.lines), rows: string[] = [];
      // a row with div: false follows the previous word without a divider (Kent: "Aurahya Mazdâha", "hadâ vithaibiš")
      for (const r of INS[id].op_words as any[]) { const g = String(r.signs).split(' : '); if (r.div === false && rows.length) rows[rows.length - 1] += '-' + g.shift(); rows.push(...g); }
      expect(groups, id).toEqual(rows);
    }
  });
  it('every word of the edition (ARIo) is carved, in order: DNb keeps avākaram-ci-mai̯ and its damaged words', () => {
    for (const id of CARVED_OP) {
      const words = String(INS[id].op_translit).split(/\s+/).filter(Boolean), rows = (INS[id].op_words as any[]).flatMap(r => String(r.ario).split(' ').filter(Boolean));
      expect(rows, id).toEqual(words);
    }
    const dnb = INS.DNb.op_words as any[];
    expect(dnb.find(r => r.ario === 'avākaram-ci-mai̯')?.signs).toBe('a-va-a-ka-ra-ma-ca-i-ma-i-ya');
    // a sign lost in the edition is carved as a blank of one sign (not closed up, not invented): one per x
    const lostInEdition = String(INS.DNb.op_translit).split(/\s+/).reduce((n, w) => n + w.split('-').filter(p => p === 'x').length, 0);
    expect(carvedGroups(panelText('DNb', 'op')!.lines).join('-').split('-').filter(s => s === LOST).length).toBe(lostInEdition);
    expect(lostInEdition).toBe(6);
  });
  it('the words the reviews measured are spelled as Kent spells them (hand-written expectations)', () => {
    const seen = new Set<string>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (!(r.ario in HAND) || r.basis === 'kent') continue; // Kent's own spelling (a logogram in XPc) is tested below
      seen.add(r.ario);
      expect(r.signs, `${id} ${r.ario}`).toBe(HAND[r.ario]);
    }
    for (const w of ['Xšayaṛšā', 'Xšayaṛšām', 'θāti', 'pātu', 'nai̯', 'Gandāra', 'hantaxšatai̯', 'handugām', 'ṛštika', 'avākaram-ci-mai̯']) expect(seen.has(w), `${w} is carved somewhere`).toBe(true);
  });
  it("Xerxes' name is xa-ša-ya-a-ra-ša-a on every Xerxes text, never the letter-by-letter xa-ša-ya-ra-ša-a", () => {
    for (const id of ['XPa', 'XPb', 'XPc', 'XPd', 'XPe']) {
      const g = carvedGroups(panelText(id, 'op')!.lines);
      expect(g.filter(x => x.startsWith('xa-ša-ya-a-ra-ša-a')).length, id).toBeGreaterThan(0);
      expect(g.some(x => x.startsWith('xa-ša-ya-ra-ša')), id).toBe(false);
    }
  });
  it('each row is what its basis says: the rule on the ARIo word, or Kent\'s own spelling (logogram, written glide, listed override)', () => {
    const overrides = new Set(['DNb|uvṛštika']);
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      const groups = String(r.signs).split(' : ');
      if (r.basis.startsWith('rule')) {
        const rule = String(r.ario).split(' ').map(w => spellNormalised(w).join('-'));
        expect(groups.join('-'), `${id} ${r.ario}`).toBe(rule.join('-'));
      } else {
        expect(r.basis, `${id} ${r.ario}`).toBe('kent');
        expect(['LOGO', 'GLIDE'].includes(r.class) || overrides.has(`${id}|${r.ario}`), `${id} ${r.ario}: ${r.class}`).toBe(true);
        expect(groups.join('-'), `${id} ${r.ario} = Kent ${r.kent}`).toBe(String(r.kent).split(' ').map(kentSigns).join('-'));
      }
      if (r.basis === 'rule=kent') expect(String(r.kent).split(' ').map(kentSigns).join('-'), `${id} ${r.ario} vs Kent ${r.kent}`).toBe(groups.join('-'));
    }
  });
  it("Kent's transliteration and the rule agree on nearly every word (the differences are listed in research/OP_SIGNS.md)", () => {
    const rows: string[] = [];
    for (const id of CARVED_OP.filter(i => (kentCopy as any)[i])) {
      const w = (INS[id].op_words as any[]).filter(r => r.class !== 'LOGO'), agree = w.filter(r => r.basis === 'rule=kent').length; // XPc's logograms: Kent only
      rows.push(`${id}: ${agree}/${w.length}`);
      // DNb's last lines are read differently by Kent and Schmitt (a damaged surface); elsewhere the two witnesses agree on >= 90 %
      expect(agree / w.length, id).toBeGreaterThan(id === 'DNb' ? 0.78 : 0.9);
    }
    console.log('rule = Kent: ' + rows.join(', '));
  });
  it("the carved words are in Kent's copy, word for word, where Kent reads the same word (every Kent word is accounted for)", () => {
    for (const id of CARVED_OP.filter(i => (kentCopy as any)[i])) {
      const kw = kentWordsOf(id).map(k => k.replace(/-/g, '')), rows = (INS[id].op_words as any[]).filter(r => r.kent).flatMap(r => String(r.kent).split(' ')).map(k => k.replace(/-/g, ''));
      // every Kent word the carving cites occurs in the copy, in order
      let j = 0; for (const k of rows) { const at = kw.indexOf(k, j); expect(at, `${id}: Kent word ${k}`).toBeGreaterThanOrEqual(0); j = at + 1; }
    }
  });
  it("the lines are Kent's: the same number of lines as the copy for every text with a copy", () => {
    for (const id of CARVED_OP.filter(i => (kentCopy as any)[i])) expect(INS[id].op_signs.length, id).toBe((kentCopy as any)[id].lines.length);
    expect(INS.XPa.op_signs.length).toBe(20); expect(INS.DNa.op_signs.length).toBe(60); expect(INS.DNb.op_signs.length).toBe(60); expect(INS.DPd.op_signs.length).toBe(24);
    expect(INS.XPa.op_signs[4]).toMatch(/fa-ra-ma$/); expect(INS.XPa.op_signs[5]).toMatch(/^a-ta-a-ra-ma : /); // Kent XPa 5-6: fram-âtâram
  });
  it("the project's lexicon spells every carved word it holds as it is carved", () => {
    const carved = new Map<string, Set<string>>();
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) if (!String(r.ario).includes(' ')) (carved.get(r.ario) ?? carved.set(r.ario, new Set()).get(r.ario)!).add(r.signs);
    // an entry whose spelling is of another form than its `form` (logged: Q-283, for the lexicon's owner)
    const OTHER_FORM: Record<string, string> = { Mudrāya: 'the entry spells and voices the attested nom. pl. Mudrāyā (DSf: mu-u-da-ra-a-ya-a, IPA mudraːjaː); the carved DNa/DPe word is the name Mudrāya' };
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
  it('spells Kent-style (graphemic) words, logograms and lost signs', () => {
    expect(spellKent('xšâyathiya').join('-')).toBe('xa-ša-a-ya-θa-i-ya');
    expect(spellKent('Xšayâršâ').join('-')).toBe('xa-ša-ya-a-ra-ša-a');
    expect(spellKent('θâtiy').join('-')).toBe('θa-a-ta-i-ya');
    expect(spellKent('XŠânâm').join('-')).toBe('XŠ-a-na-a-ma');
    expect(spellKent('DHyûnâm').join('-')).toBe('DH¹-ya-u-na-a-ma');
    expect(spellKent('+++').join('-')).toBe('x-x-x');
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

describe('the letter-by-letter spelling the world carved before D-165 fails these checks', () => {
  /** src/lang/oldPersian.ts spellWord at cd83211, fed ARIo's transcription (as decor.ts and naqsh.ts did): every letter a sign,
   *  ṛ as r, no final glide, nasals written */
  const old = (w: string) => spellKent(w.replace(/ṛ/g, 'r')).join('-');
  it("it misspells the king's name, the reviews' words and about one carved word in five", () => {
    expect(old('Xšayaṛšā')).toBe('xa-ša-ya-ra-ša-a'); expect(old('θāti')).toBe('θa-a-ta-i'); expect(old('Gandāra')).toBe('ga-na-da-a-ra');
    let words = 0, wrong = 0;
    for (const id of CARVED_OP) for (const r of INS[id].op_words as any[]) {
      if (String(r.ario).includes(' ') || r.ario === 'x' || String(r.ario).includes('-')) continue;
      words++; if (old(r.ario) !== String(r.signs).replace(/ : /g, '-')) wrong++;
    }
    console.log(`the old spelling differs from the carving in ${wrong} of ${words} words`);
    expect(wrong / words).toBeGreaterThan(0.15);
  });
});
