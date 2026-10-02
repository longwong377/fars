// D-387 (UD-24): reconstructed period speech for overheard talk. Deterministic; the same English word is the same form in a
// language; attested lexicon words are used where they fit; every sentence is accepted by both synthesis paths (the formant
// tokenizer, the voice model's symbols); no generated form spells a modern word or an anachronism-blocklist term; word order
// per language (verb last in Old Persian, Elamite, Babylonian; not last in Aramaic when an object follows the subject).
import { describe, it, expect } from 'vitest';
import { reconstruct, reconstructedUnit, pseudoFor, romanise } from '../src/lang/reconstruct';
import { LANG_IDS, type LangId } from '../src/lang/lexicon';
import { unitsFor } from '../src/audio/voices';
import { tokenizeIpa } from '../src/audio/phonemes';
import { toKokoro } from '../src/audio/neural/kokoro';
import { findModernWords, romanisedWords } from '../src/lang/modern';
import blocklist from '../src/data/blocklist.json';

const SENTENCES = ['barley is dear this month', 'bread is dear this year', 'the house owes silver', 'I give you silver and you give me barley',
  'give me silver until the harvest', 'the father of the house died', 'the mother of the house died', 'may the god keep his house',
  'may the god keep the children', 'a son was born in the house', 'a daughter was born in the house', 'the son took a wife',
  'may the god give them many sons', 'the child is sick', 'the work is heavy this month', 'the king gives the rations', 'the workers are many',
  'the king builds a great house', 'today is the feast of the god', 'there is meat and wine', 'the harvest is good this year',
  'the barley is in the field', 'a stranger came to the town', 'may the god keep the stranger', 'the water is low this month',
  'may the god give rain', 'the rain is good for the barley', 'may the god keep the field', 'the workers are not many'];
const BLOCK = new Set((blocklist as any).entries.flatMap((e: any) => e.terms as string[]).flatMap((t: string) => t.toLowerCase().split(/[^a-z]+/)).filter((w: string) => w.length >= 4));

describe('reconstructed period speech (D-387)', () => {
  it('is deterministic, and the same English word is the same form in a language', () => {
    for (const l of LANG_IDS) {
      const seen = new Map<string, string>();
      for (const s of SENTENCES) {
        const r = reconstruct(s, l), again = reconstruct(s, l);
        expect(again).toEqual(r);
        expect(r.tier).toBe('C'); expect(r.words.length).toBeGreaterThan(0); expect(r.gloss).toContain(s);
        for (const w of r.words) { const k = w.en === 'children' || w.en === 'sons' || w.en === 'workers' || w.en === 'rations' ? w.en.replace(/(ren|s)$/, '') : w.en;
          if (seen.has(k) && !['child', 'son', 'worker', 'ration'].includes(k)) expect(w.form, `${l} ${k}`).toBe(seen.get(k)); seen.set(k, w.form); }
      }
      expect(pseudoFor('lantern-wick', l)).toBe(pseudoFor('lantern-wick', l));
    }
  });
  it('uses the attested lexicon word where one fits', () => {
    const att = (s: string, l: LangId, en: string) => reconstruct(s, l).words.find(w => w.en === en)!;
    expect(att('the king gives the rations', 'op', 'king').form).toBe('xšāyaθiya');
    expect(att('may the god keep his house', 'op', 'god').form).toBe('baga');
    expect(att('may the god keep his house', 'op', 'keep').form).toBe('pātu');
    expect(att('the house owes silver', 'op', 'silver').form).toBe('ṛdata');
    expect(att('barley is dear this month', 'bab', 'barley').form).toBe('uṭṭatu');
    expect(att('bread is dear this year', 'arc', 'bread').form).toBe('laḥm');
    expect(att('the king gives the rations', 'el', 'rations').form).toBe('gal');
    for (const l of LANG_IDS) for (const s of SENTENCES) for (const w of reconstruct(s, l).words) if (w.attested) expect(unitsFor(l).words.some(u => u.translit === w.form && u.ipa === w.ipa), `${l} ${w.form}`).toBe(true);
    // Old Persian has no attested word for barley: a cognate (Av. yauua-), flagged
    const y = att('barley is dear this month', 'op', 'barley'); expect(y.attested).toBe(false); expect(y.src).toBe('cognate');
  });
  it('every sentence is accepted by both synthesis paths', () => {
    for (const l of LANG_IDS) for (const s of SENTENCES) {
      const r = reconstruct(s, l);
      expect(() => tokenizeIpa(r.ipa), `${l}: ${r.ipa}`).not.toThrow(); expect(tokenizeIpa(r.ipa).length).toBeGreaterThan(0);
      for (const w of r.words) { expect(toKokoro(w.ipa).length, `${l} ${w.form} ${w.ipa}`).toBeGreaterThan(0); expect(tokenizeIpa(w.ipa).length).toBeGreaterThan(0); }
      const u = reconstructedUnit(s, l); expect(u.tier).toBe('C'); expect(u.ipa).toBe(r.ipa); expect(u.id.startsWith(`rc:${l}:`)).toBe(true);
    }
    // the rule's forms over a wider vocabulary
    for (const l of LANG_IDS) for (const en of ['lantern', 'plough', 'loan', 'neighbour', 'quarrel', 'shepherd', 'fever', 'well', 'roof', 'oven', 'basket', 'donkey']) {
      const f = pseudoFor(en, l); expect(tokenizeIpa(f).length, `${l} ${en} ${f}`).toBeGreaterThan(0); expect(toKokoro(f).length).toBeGreaterThan(0);
    }
  });
  it('no generated form is a modern word or a blocklisted term', () => {
    const check = (ipa: string, form: string, what: string) => {
      expect(findModernWords(ipa, { ipa: true }), what).toEqual([]); expect(findModernWords(form), what).toEqual([]);
      for (const w of [...romanisedWords(ipa, { ipa: true }), ...romanisedWords(form)]) expect(BLOCK.has(w), what).toBe(false);
    };
    for (const l of LANG_IDS) {
      for (const s of SENTENCES) for (const w of reconstruct(s, l).words) if (!w.attested) check(w.ipa, w.form, `${l} ${w.en} → ${w.form}`);
      for (const en of ['lantern', 'plough', 'loan', 'neighbour', 'quarrel', 'shepherd', 'fever', 'well', 'roof', 'oven', 'basket', 'donkey', 'low', 'dark', 'cheap', 'flood'])
        { const f = pseudoFor(en, l); check(f, romanise(f, l), `${l} ${en} → ${f}`); }
    }
  });
  it('word order by the language: verb last in OP, Elamite and Babylonian; Aramaic verb not last (VSO/SVO)', () => {
    for (const l of ['op', 'el', 'bab'] as LangId[]) for (const s of ['the king builds a great house', 'the son took a wife', 'the king gives the rations']) {
      const ws = reconstruct(s, l).words; expect(ws[ws.length - 1].pos, `${l}: ${s}`).toBe('v');
    }
    for (const s of ['the king builds a great house', 'the son took a wife', 'the king gives the rations']) for (const seed of [0, 1, 2, 3]) {
      const ws = reconstruct(s, 'arc', seed).words; expect(ws[ws.length - 1].pos, `arc: ${s}`).not.toBe('v'); expect(ws.findIndex(w => w.pos === 'v')).toBeLessThanOrEqual(1);
    }
    // Greek keeps the English order (subject, verb, object)
    expect(reconstruct('the son took a wife', 'grc').words.map(w => w.pos)).toEqual(['n', 'v', 'n']);
    // the demonstrative follows its noun in Babylonian and Aramaic, precedes it in Old Persian
    const pos = (l: LangId) => reconstruct('barley is dear this month', l).words.map(w => w.en);
    expect(pos('bab').slice(-2)).toEqual(['month', 'this']); expect(pos('arc').slice(-2)).toEqual(['month', 'this']); expect(pos('op').slice(-2)).toEqual(['this', 'month']);
  });
});
