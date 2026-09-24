// Language lint (brief §10: "The build fails on any modern-language text or audio that would be rendered or played in
// the world. Code, data keys, research files and out-of-world UI are excluded."). Run alone with `npm run lint:lang`.
//
// What is in-world, and how each is checked:
//  1. speech lines (src/people/speech_lines.ts): the only in-world field is `words` (lexicon ids); the heard IPA and its
//     transliteration are scanned for modern words. Any new field on a line fails until it is classed here.
//  2. carved inscription text (src/data/inscriptions.json → src/arch/inscription_text.ts panelText, the one path decor.ts
//     and naqsh.ts carve): the rendered strings must be period script only; the transliterations and sign sequences that
//     generate them are scanned for modern words; no unmapped signs. (Their spelling: tests/lang.test.ts, D-165.)
//  3. lexicon native-script fields (future tablets/labels): period script of the right block only.
//  4. any other in-world text: source files that call a text-rendering API must be registered here and use no literals.
//  5. crowd murmur: generated pseudo-words are scanned for modern words.
// Out-of-world (excluded): gloss, note, src, ids, tiers, intent, roles — the translation layer, subtitles and dev overlay.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LINE_DEFS, LINES } from '../src/people/speech_lines';
import { findModernWords, nonPeriodChars, romanisedWords, MODERN_WORDS, PERIOD_SCRIPTS } from '../src/lang/modern';
import { allLexEntries, lexEntry, citationForm, LANG_IDS, LEXICON, type LangId } from '../src/lang/lexicon';
import sources from '../src/data/sources.json';
import { panelText } from '../src/arch/inscription_text';
import { buildProfile, pseudoPhrase, murmurLangFor } from '../src/audio/murmur';
import { Rng } from '../src/core/rng';
import inscriptions from '../src/data/inscriptions.json';

/** Line fields that never reach the world (subtitle layer, dev overlay, selection logic). */
const LINE_OUT_OF_WORLD = new Set(['id', 'lang', 'intent', 'intonation', 'roles', 'gloss', 'phraseTier', 'usageTier', 'src', 'note']);
const LINE_IN_WORLD = new Set(['words']);

/**
 * Attested ancient words that happen to spell a common modern word. They are allowed ONLY when they come from their own
 * lexicon entry (never as free text). Each key must be a real lexicon id and each word a real collision (checked).
 */
const LEXICON_HOMOGRAPHS: Record<string, { words: string[]; why: string }> = {
  'el:hi': { words: ['hi'], why: 'Elamite demonstrative "this" (XPa, XPd)' },
  'arc:br': { words: ['bar'], why: 'Aramaic "son" (bar)' },
  'arc:ḥd': { words: ['had'], why: 'Aramaic "one" (ḥad)' },
  'arc:mrʾ': { words: ['mr'], why: 'consonantal spelling mrʾ "lord"' },
  'op:dāta-': { words: ['data'], why: 'Old Persian dāta- "law"' },
  'grc:ouk': { words: ['ok'], why: 'Greek οὐκ "not" (5th-c. [oːk], Herodotus passim)' },
};
/** Same for the inscription transliterations (ARIo text, A): token → where it occurs. */
const INSCRIPTION_HOMOGRAPHS: Record<string, { words: string[]; why: string }> = {
  el_atf: { words: ['hi', 'um', 'hate', 'da'], why: 'Elamite hi "this"; um (XPa); ha-te (XPb, XPd); {AŠ}da (XPd) — syllable strings of the ARIo text' },
};

describe('language lint: the detector itself', () => {
  it('catches English, placeholders, modern Persian and other modern words; passes ancient words', () => {
    expect(findModernWords('hello there')).toEqual(expect.arrayContaining(['hello', 'there']));
    expect(findModernWords('TODO placeholder')).toEqual(expect.arrayContaining(['todo', 'placeholder']));
    expect(findModernWords('salam khoda hafez')).toEqual(expect.arrayContaining(['salam', 'khoda', 'hafez']));
    expect(findModernWords('ʃaloːm', { ipa: true })).toEqual(['shalom']); // modern Hebrew greeting spelled in IPA
    expect(findModernWords('baga vazṛka A.uramazdā')).toEqual([]);
    expect(findModernWords('xʃaːjaθija', { ipa: true })).toEqual([]);
    expect(MODERN_WORDS.size).toBeGreaterThan(400);
  });
  it('script check rejects Latin, Arabic/Persian and Hebrew letters in script-only strings', () => {
    expect(nonPeriodChars('𐎲𐎥 𐏐', ['oldPersian'])).toEqual([]);
    expect(nonPeriodChars('𐎲𐎥 A', ['oldPersian'])[0]).toMatch(/latin/);
    expect(nonPeriodChars('سلام', ['cuneiform'])[0]).toMatch(/arabicPersian/);
    expect(nonPeriodChars('שלום', ['imperialAramaic'])[0]).toMatch(/hebrew/);
  });
  it('homograph allowlists are real lexicon entries and real collisions (no stale exemptions)', () => {
    for (const [id, h] of Object.entries(LEXICON_HOMOGRAPHS)) {
      const e = lexEntry(id); expect(e, id).toBeTruthy();
      const found = new Set([...romanisedWords(e!.form), ...(e!.ipa ? romanisedWords(e!.ipa, { ipa: true }) : [])]);
      for (const w of h.words) { expect(found.has(w), `${id} → ${w}`).toBe(true); expect(MODERN_WORDS.has(w)).toBe(true); }
    }
  });
});

describe('language lint: speech lines', () => {
  it('every line field is classified; the only in-world field is `words` (lexicon ids)', () => {
    for (const d of LINE_DEFS) for (const k of Object.keys(d)) expect(LINE_OUT_OF_WORLD.has(k) || LINE_IN_WORLD.has(k), `${d.id}.${k} is unclassified`).toBe(true);
  });
  it('every word is an entry of the line’s own lexicon (no invented words)', () => {
    for (const d of LINE_DEFS) for (const w of d.words) { const e = lexEntry(w); expect(e, `${d.id}: ${w}`).toBeTruthy(); expect(e!.lang).toBe(d.lang); }
    expect(LINES.length).toBe(LINE_DEFS.length);
  });
  it('what is heard (IPA) and its transliteration contain no modern word', () => {
    for (const l of LINES) {
      const allow = new Set(l.def.words.flatMap(w => LEXICON_HOMOGRAPHS[w]?.words ?? []));
      expect(findModernWords(l.ipa, { ipa: true, allow }), `${l.id} ipa "${l.ipa}"`).toEqual([]);
      expect(findModernWords(l.translit, { allow }), `${l.id} translit "${l.translit}"`).toEqual([]);
      for (const e of l.entries) expect(l.translit.split(' ')).toContain(citationForm(e));
    }
  });
  it('Old Persian lines are short (≤ 3 words) and every line is tiered and glossed for the subtitle layer', () => {
    for (const l of LINES) {
      if (l.lang === 'op') expect(l.def.words.length, l.id).toBeLessThanOrEqual(3);
      expect(['A', 'B', 'C']).toContain(l.tier);
      expect(l.gloss.length).toBeGreaterThan(0);
      expect(l.def.src.length).toBeGreaterThan(0);
    }
  });
});

describe('language lint: inscriptions and scripts rendered in the world', () => {
  const ins = inscriptions as Record<string, any>;
  const texts = Object.entries(ins).filter(([k]) => k !== '_meta');
  it('carved text is period script only (what src/arch/decor.ts and naqsh.ts carve: panelText)', () => {
    expect(texts.length).toBeGreaterThan(0);
    for (const [id, t] of texts) {
      for (const ver of ['op', 'el', 'bab'] as const) { const p = panelText(id, ver); if (p) expect(nonPeriodChars(p.lines.join(' '), [ver === 'op' ? 'oldPersian' : 'cuneiform']), `${id} ${ver}`).toEqual([]); }
      if (t.op_translit) expect(panelText(id, 'op'), `${id}: an Old Persian text without a carved sign sequence`).toBeTruthy();
      expect(t.el_unmapped, `${id} El unmapped signs`).toEqual([]);
      expect(t.bab_unmapped, `${id} Bab unmapped signs`).toEqual([]);
    }
  });
  it('the transliterations that generate the carved signs contain no modern word', () => {
    for (const [id, t] of texts) for (const f of ['op_translit', 'el_atf', 'bab_atf']) {
      const allow = new Set(INSCRIPTION_HOMOGRAPHS[f]?.words ?? []);
      expect(findModernWords(t[f], { allow }), `${id}.${f}`).toEqual([]);
    }
  });
  it('lexicon native-script fields use their own period script block', () => {
    // one block per language, typed over every LangId: a new language fails to compile until its script is classed here
    const block: Record<LangId, keyof typeof PERIOD_SCRIPTS> = { op: 'oldPersian', el: 'cuneiform', arc: 'imperialAramaic', bab: 'cuneiform', grc: 'greekIonic' };
    const n: Record<string, number> = {};
    for (const e of allLexEntries()) if (e.script) { n[e.lang] = (n[e.lang] ?? 0) + 1; expect(nonPeriodChars(e.script, [block[e.lang]]), e.id).toEqual([]); }
    for (const l of LANG_IDS) expect(n[l] ?? 0, `${l} entries with a native script`).toBeGreaterThan(30);
  });
  it('Greek is written as in the 5th c.: capitals only; lower case, accents and breathings are rejected', () => {
    expect(nonPeriodChars('ΧΑΙΡΕ ΞΕΙΝΕ', ['greekIonic'])).toEqual([]);
    expect(nonPeriodChars('χαῖρε', ['greekIonic']).length).toBeGreaterThan(0);  // lower case + circumflex
    expect(nonPeriodChars('Ἴωνες', ['greekIonic']).length).toBeGreaterThan(0);  // breathing + accent (Greek Extended)
    expect(nonPeriodChars('ΧΑΙΡΕ', ['cuneiform'])[0]).toMatch(/greekModern/); // Greek is never allowed on a cuneiform surface
    for (const e of allLexEntries()) if (e.lang === 'grc') expect(e.script, e.id).toMatch(/^[Α-Ω ]+$/);
  });
  it('every lexicon entry is tiered and cites known source keys (fail-closed)', () => {
    const keys = new Set(Object.keys(sources as Record<string, unknown>));
    for (const l of LANG_IDS) expect(LEXICON[l].length, l).toBeGreaterThan(40);
    for (const e of allLexEntries()) {
      expect(['A', 'B', 'C'], `${e.id} tier "${e.tier}"`).toContain(e.tier.trim()[0]);
      expect(e.src.length, `${e.id} has no source key`).toBeGreaterThan(0);
      for (const k of e.src) expect(keys.has(k), `${e.id}: source key ${k} is not in src/data/sources.json`).toBe(true);
    }
  });
});

describe('language lint: other in-world text', () => {
  /** files allowed to draw text into the 3D world, with what they draw (checked above) */
  const IN_WORLD_TEXT_SITES: Record<string, string> = {
    'src/arch/decor.ts': 'carved inscriptions from inscriptions.json (panelText: op_signs / *_cuneiform), checked above',
    'src/arch/carving.ts': 'the carving itself (layoutText / carvedGeometry of the lines it is given; no text of its own)',
    'src/world/plain/naqsh.ts': 'DNa/DNb Old Persian from inscriptions.json (panelText op_signs), checked above',
  };
  const TEXT_API = /\b(fillText|strokeText|TextGeometry|textPanelGeometry|layoutText|carvedGeometry|carvedBlockGeometry|CSS2DObject|CSS3DObject|SpriteText|TroikaText)\b/;
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  const root = join(__dirname, '..');
  it('only registered files render text in-world, and never from a string literal', () => {
    const files = walk(join(root, 'src')).map(p => relative(root, p).split('\\').join('/')).filter(p => !p.startsWith('src/ui/'));
    for (const f of files) {
      const src = readFileSync(join(root, f), 'utf8');
      if (!TEXT_API.test(src)) continue;
      expect(IN_WORLD_TEXT_SITES[f], `${f} renders text in-world but is not registered in the language lint`).toBeTruthy();
      // the text argument: 1st for canvas fillText/strokeText, 2nd for layoutText(font, lines, …) (a literal or an array of them)
      expect(/\b(fillText|strokeText)\(\s*['"`]/.test(src) || /\blayoutText\(\s*[^,()]+,\s*[\['"`]/.test(src), `${f} passes a string literal to a text API`).toBe(false);
    }
  });
});

describe('language lint: crowd murmur', () => {
  it('pseudo-phrases in every language contain no modern word (2,000 phrases per language)', () => {
    for (const lang of LANG_IDS) {
      const p = buildProfile(lang), r = new Rng(7, `lint:${lang}`);
      for (let i = 0; i < 2000; i++) { const ph = pseudoPhrase(p, r); expect(findModernWords(ph.ipa, { ipa: true }), `${lang}: ${ph.ipa}`).toEqual([]); }
    }
  });
  it('languages without a lexicon fall back to the Aramaic profile and are flagged C; Babylonian and Greek use their own', () => {
    for (const l of ['Egyptian', 'Lydian', 'unknown']) { const m = murmurLangFor(l); expect(m.lang).toBe('arc'); expect(m.fallback).toBe(true); expect(m.tier).toBe('C'); }
    expect(murmurLangFor('Elamite')).toMatchObject({ lang: 'el', fallback: false });
    expect(murmurLangFor('Babylonian')).toMatchObject({ lang: 'bab', fallback: false });
    expect(murmurLangFor('Greek')).toMatchObject({ lang: 'grc', fallback: false });
  });
});
