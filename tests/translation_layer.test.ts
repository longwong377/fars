// The translation layer (src/ui/translation.ts; brief §9.4, §10): off by default and hidden when off (no English
// anywhere on screen then); when on, the inscription reading is of the version looked at (Phase 8 review A-M2 / B-M1),
// subtitles show what is heard and the language by name (B-minor 1, 2), no translation is claimed that the build may not
// show (B-C2, D-167), and the English shown is the project's own, of the version looked at, tier C and labelled so (D-198).
// A minimal DOM stand-in is enough: the layer only creates elements and sets their text.
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/settings';
import { LINE_BY_ID } from '../src/people/speech_lines';

class FakeEl {
  className = ''; textContent = ''; hidden = false; children: FakeEl[] = []; width = 0; height = 0; style = { setProperty() {} };
  constructor(readonly tag: string) {}
  append(...c: FakeEl[]) { this.children.push(...c); }
  replaceChildren(...c: FakeEl[]) { this.children = c; }
  /** all text in this element and below */
  get text(): string { return [this.textContent, ...this.children.map(c => c.text)].filter(Boolean).join(' '); }
}
let TL: typeof import('../src/ui/translation');
beforeAll(async () => {
  (globalThis as any).document = { createElement: (t: string) => new FakeEl(t), body: new FakeEl('body') };
  TL = await import('../src/ui/translation');
});
const ctx = (sub: any) => ({ camera: null as any, inscriptions: null, subtitle: sub, subtitleAt: 0, now: 1, player: { e: 0, n: 0, yawDeg: 0 }, events: [], timeLabel: () => '', places: {} });
const subOf = (id: string) => { const l = LINE_BY_ID.get(id)!; return { lineId: l.id, lang: l.lang, translit: l.translit, gloss: l.gloss, tier: l.tier }; };
const rootOf = (layer: any) => layer.root as FakeEl;

describe('translation layer', () => {
  it('is off by default, and when off it is hidden and shows no text, whatever is said', () => {
    expect(DEFAULT_SETTINGS.translation).toBe(false);
    const layer = new TL.TranslationLayer(() => DEFAULT_SETTINGS);
    layer.update(ctx(subOf('grc.greet.khaire_xeine')));
    expect(rootOf(layer).hidden).toBe(true); expect(rootOf(layer).text).toBe('');
    layer.toggle('map'); layer.toggle('chronicle'); expect(layer.panelOpen).toBe(false); // M and J do nothing while it is off
  });
  it('when on, subtitles show what is heard, the language by name and the line\'s source', () => {
    const on: Settings = { ...DEFAULT_SETTINGS, translation: true };
    const layer = new TL.TranslationLayer(() => on);
    layer.update(ctx(subOf('grc.greet.khaire_xeine')));
    const t = rootOf(layer).text; expect(rootOf(layer).hidden).toBe(false);
    expect(t).toContain('Greek (Ionic)'); expect(t).not.toMatch(/\bgrc\b/); expect(t).toContain('Od. 1.123');
    layer.update(ctx(subOf('op.remark.parsa_uvaspa'))); // heard /paːrsa uwaspaː umartijaː/: the inflected forms, not the stems
    expect(rootOf(layer).text).toContain('Pārsa uvaspā umartiyā');
    layer.update(ctx(subOf('arc.greet.slm'))); expect(rootOf(layer).text).toContain('šəlām'); // not the skeleton šlm
  });
  it('an inscription panel is read in its own version: the Elamite panel shows the Elamite text, the Babylonian the Babylonian', () => {
    const op = TL.inscriptionReading('XPa', 'op')!, elv = TL.inscriptionReading('XPa', 'el')!, bab = TL.inscriptionReading('XPa', 'bab')!;
    expect(op.words[0].w).toBe('baga'); expect(elv.words[0].w).toBe('{d}na-ap'); expect(bab.words[0].w).toBe('DINGIR');
    expect(elv.versionName).toBe('Elamite'); expect(elv.translitSource).toContain('Elamite');
    // each version's glosses come from its own lexicon
    expect(elv.words.find(w => w.w === '{d}u-ra-mas-da')?.gloss).toMatch(/Ahuramazda/);
    expect(bab.words.find(w => w.w === 'qaq-qa-ru')?.gloss).toMatch(/earth/);
    for (const r of [op, elv, bab]) expect(r.covered).toBeGreaterThan(20);
    // a version the corpus mirror does not hold is flagged as unavailable, never filled from another version
    const dna = TL.inscriptionReading('DNa', 'el')!; expect(dna.words).toEqual([]); expect(dna.notes.join(' ')).toMatch(/not in the corpus mirror/);
    // the layer says which versions are carved: XPb in all three (two panels), DNa in Old Persian only (Q-290)
    expect(TL.inscriptionReading('XPb', 'op')!.carved).toMatch(/Old Persian, Elamite and Babylonian/);
    expect(TL.inscriptionReading('DNa', 'op')!.carved).toMatch(/Old Persian version only/);
    // and what the stone has that Schmitt's normalised words do not show: the engraver's omissions are not carved (D-184)
    expect(TL.inscriptionReading('DNb', 'op')!.notes.join(' ')).toMatch(/[1-9]\d* signs he omitted .* are not \(\d+ whole words/);
  });
  it('shows no published translation it may not show, and says why (Livius is all rights reserved; D-167, B17)', () => {
    const r = TL.inscriptionReading('XPa', 'op')!;
    expect(r.translation).toMatch(/no published English translation is shown/i); expect(r.translation).toMatch(/All rights reserved/); expect(r.translation).toMatch(/B17/);
    expect(r.translation).toMatch(/project's own translation from the ARIo edition \(tier C; D-198\)/);
    // §12 stated as D-192 reads it: any licence that permits personal non-commercial use with credit (CC-BY-SA included)
    expect(r.translation).not.toMatch(/only CC0/); expect(r.translation).toMatch(/CC-BY-SA: D-192/);
    // a stem gloss never fires on the bare stem (api "also" is not api- "water")
    expect(r.words.find(w => w.w === 'api')?.gloss ?? null).toBeNull();
  });
  it('every carved text has the project\'s English of each version the corpus holds, tier C, with the label; none of a version it lacks (D-198)', () => {
    const LABEL = 'Translation by the project from the ARIo edition; not a published translation; verify against Schmitt 2009 / Kent 1953';
    expect(TL.PROJECT_TRANSLATION_LABEL).toBe(LABEL);
    let n = 0;
    for (const id of Object.keys(TL.INSCRIPTION_INFO)) for (const v of ['op', 'el', 'bab']) {
      const r = TL.inscriptionReading(id, v)!;
      if (!r.words.length) { expect(r.english, `${id} ${v}: no text, no translation`).toBeNull(); continue; }
      expect(r.english, `${id} ${v}`).toBeTruthy(); expect(r.english!.tier).toBe('C'); expect(r.english!.label).toBe(LABEL); expect(r.english!.en.length).toBeGreaterThan(20); n++;
    }
    expect(n, 'versions translated (15 texts; the seal texts are in tests/writing.test.ts)').toBe(33);
    // each version is translated from its own words: the Babylonian "gave" where the Old Persian "created"
    expect(TL.inscriptionReading('XPa', 'op')!.english!.en).toMatch(/^Ahuramazda is a great god, who created this earth/);
    expect(TL.inscriptionReading('XPa', 'bab')!.english!.en).toMatch(/^Ahuramazda is a great god, who gave this earth/);
    expect(TL.inscriptionReading('XPa', 'bab')!.english!.en).toMatch(/Uispidāʾi/);
    // restorations and the engraver's omissions are marked, and the edition's restored words listed
    expect(TL.inscriptionReading('DNb', 'op')!.english!.en).toMatch(/⟨and I give much to loyal men⟩/); expect(TL.inscriptionReading('DNb', 'op')!.english!.en).toMatch(/\[the weak man\]/);
    expect(TL.inscriptionReading('XPd', 'op')!.english!.edition_restored_words.join(' ')).toMatch(/A\.uramazdā \(3 of 7 signs\)/);
    // the project's own wording, not the published ones' (Kent's and Livius' formulae; D-167)
    for (const id of Object.keys(TL.INSCRIPTION_INFO)) for (const v of ['op', 'el', 'bab']) { const e = TL.projectTranslation(id, v)?.en ?? '';
      for (const kent of ['A great god is Ahuramazda', 'yonder sky', 'containing all kinds of men', 'one lord of many', 'Saith Darius', 'I am Xerxes the Great King']) expect(e.includes(kent), `${id} ${v}: "${kent}"`).toBe(false); }
  });
  it('the inscription panel in the layer shows the English with its label, marks and tier', () => {
    const on: Settings = { ...DEFAULT_SETTINGS, translation: true };
    const layer = new TL.TranslationLayer(() => on) as any;
    const els: FakeEl[] = layer.inscriptionView('XPc', 'el'); const t = els.map(e => e.text).join(' ');
    expect(t).toContain('English of the Elamite version — Translation by the project from the ARIo edition; not a published translation; verify against Schmitt 2009 / Kent 1953 (tier C)');
    expect(t).toContain('this palace Darius the king made'); expect(t).toMatch(/Marks: \( \) words added for English sense/);
    const dna: FakeEl[] = layer.inscriptionView('DNa', 'el'); expect(dna.map(e => e.text).join(' ')).not.toContain('English of');
  });
});
