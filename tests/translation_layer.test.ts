// The translation layer (src/ui/translation.ts; brief §9.4, §10): off by default and hidden when off (no English
// anywhere on screen then); when on, the inscription reading is of the version looked at (Phase 8 review A-M2 / B-M1),
// subtitles show what is heard and the language by name (B-minor 1, 2), and no translation is claimed that the build
// may not show (B-C2, D-167). A minimal DOM stand-in is enough: the layer only creates elements and sets their text.
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
    // and where Schmitt's words it shows differ from the carved sign sequence (D-177)
    expect(TL.inscriptionReading('DNb', 'op')!.notes.join(' ')).toMatch(/differs from it in \d+ words/);
  });
  it('shows no translation it may not show, and says why (Livius is all rights reserved; D-167, B17)', () => {
    const r = TL.inscriptionReading('XPa', 'op')!;
    expect(r.translation).toMatch(/No published English translation is shown/); expect(r.translation).toMatch(/All rights reserved/); expect(r.translation).toMatch(/B17/);
    // a stem gloss never fires on the bare stem (api "also" is not api- "water")
    expect(r.words.find(w => w.w === 'api')?.gloss ?? null).toBeNull();
  });
});
