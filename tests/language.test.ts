// Language lint (brief §10: "The build fails on any modern-language text or audio that would be rendered or played in
// the world. Code, data keys, research files and out-of-world UI are excluded."). Run alone with `npm run lint:lang`.
//
// What is in-world, and how each is checked:
//  1. speech lines (src/people/speech_lines.ts): the only in-world field is `words` (lexicon ids); the heard IPA and its
//     transliteration are scanned for modern words. Any new field on a line fails until it is classed here.
//  2. carved inscription text (src/data/inscriptions.json → src/arch/decor.ts): the rendered strings must be period
//     script only; the transliterations that generate them are scanned for modern words; no unmapped signs.
//  3. lexicon native-script fields (future tablets/labels): period script of the right block only.
//  3b. writing on objects (src/data/writing.json → src/world/writing.ts, D-179): the seal inscriptions impressed in clay,
//     captured at the font while the writing atlas bakes, are exactly the data's sign sequences; their transliterations
//     are scanned for modern words; a written object without a published text must be flagged (placeholder or hidden).
//     Any source file that turns characters into font outlines (charToGlyph, getPath, ...) must be a registered site.
//  4. any other text: every source file (src/ui included) that renders text is registered as in-world or out-of-world
//     (DOM), none mixes the two, out-of-world files make no textures; data JSON strings in non-Latin scripts only in
//     registered fields; no SVG text; every shipped image registered as checked; the carved signs, captured at the font
//     while the carving code runs, are exactly the inscription data's sign sequence.
//  5. crowd murmur: generated pseudo-words, alone and run together, are scanned (20,000 phrases per language) against
//     the modern-word list, which includes the modern Persian and English words the Phase 8 review heard; only attested
//     entries feed its phonotactics.
//  6. audio: every clip belongs to a current line, the manifest records the IPA it voices (compared with the line), the
//     file's hash and a plausible length per phone (D-167).
// Out-of-world (excluded): gloss, note, src, ids, tiers, intent, roles — the translation layer, subtitles and dev overlay.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LINE_DEFS, LINES } from '../src/people/speech_lines';
import { findModernWords, nonPeriodChars, romanisedWords, MODERN_WORDS, PERIOD_SCRIPTS } from '../src/lang/modern';
import { allLexEntries, lexEntry, spokenForm, LANG_IDS, LEXICON, murmurEligible, type LangId } from '../src/lang/lexicon';
import sources from '../src/data/sources.json';
import { toCuneiform } from '../src/lang/oldPersian';
import { buildProfile, pseudoPhrase, murmurLangFor, murmurSource } from '../src/audio/murmur';
import * as oldPersian from '../src/lang/oldPersian';
import { tokenizeIpa } from '../src/audio/phonemes';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs } from '../src/arch/decor';
import { buildNaqsh, carvableTranslit } from '../src/world/plain/naqsh';
import { loadTerrain, loadRiversFile } from './plainLib';
import { Rng } from '../src/core/rng';
import inscriptions from '../src/data/inscriptions.json';
import writingData from '../src/data/writing.json';
import { loadWritingFonts, rebakeWritingAtlas } from '../src/world/writing';

/** Line fields that never reach the world (subtitle layer, dev overlay, selection logic). */
const LINE_OUT_OF_WORLD = new Set(['id', 'lang', 'intent', 'intonation', 'roles', 'gloss', 'phraseTier', 'usageTier', 'src', 'note']);
const LINE_IN_WORLD = new Set(['words']);

/**
 * Attested ancient words that happen to spell a common modern word. They are allowed ONLY when they come from their own
 * lexicon entry (never as free text). Each key must be a real lexicon id and each word a real collision (checked).
 */
const LEXICON_HOMOGRAPHS: Record<string, { words: string[]; why: string }> = {
  'el:hi': { words: ['hi'], why: 'Elamite demonstrative "this" (XPa, XPd)' },
  'el:nap': { words: ['nap'], why: 'Elamite nap "god" (XPa Elamite 1: {d}na-ap)' },
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
      for (const e of l.entries) expect(l.translit.split(' ')).toContain(spokenForm(e));
    }
  });
  /** consonant skeleton of a romanised form or of IPA: vowels, length, stress, glottals, aspiration and gemination
   *  dropped; v/w, y/j and the Greek romanisation (kh ph th x z) folded */
  const skeleton = (s: string, lang: string, ipa: boolean) => {
    let t = s.normalize('NFC').toLowerCase();
    if (!ipa && lang === 'grc') t = t.replace(/kh/g, 'k').replace(/ph/g, 'p').replace(/th/g, 't').replace(/x/g, 'ks').replace(/z/g, 'zd');
    t = t.replace(/t͡ʃ/g, 'c').replace(/d͡ʒ/g, 'j').replace(/ʃ/g, 's').replace(/ħ/g, 'h').replace(/χ/g, 'x').replace(/ɡ/g, 'g').replace(/ʒ/g, 'z');
    t = t.normalize('NFD').replace(/\p{M}/gu, '');
    t = ipa ? t.replace(/y/g, 'u') : t.replace(/v/g, 'w').replace(/y/g, 'j');
    if (!ipa && lang === 'bab') t = t.replace(/h/g, 'x');
    return t.replace(/[ʔʕʾʿˤʰːˈˌ'’\-.\s]/g, '').replace(/[aeiouəɛɔɪʊ]/g, '').replace(/(.)\1+/g, '$1');
  };
  it('the subtitle shows the form that is heard: each word\'s consonants are those of its IPA (an inflected form, not the stem)', () => {
    for (const l of LINES) for (const e of l.entries) expect(skeleton(spokenForm(e), e.lang, false), `${l.id} ${e.id}: shown "${spokenForm(e)}", heard /${e.ipa}/`).toBe(skeleton(e.ipa!, e.lang, true));
    // the check has teeth: the stem the subtitle used to show is not what is heard
    const naiba = lexEntry('op:naiba-')!; expect(skeleton(naiba.form.replace(/-$/, ''), 'op', false)).not.toBe(skeleton(naiba.ipa!, 'op', true));
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
  it('carved text is period script only (what src/arch/decor.ts renders)', () => {
    expect(texts.length).toBeGreaterThan(0);
    for (const [id, t] of texts) {
      expect(nonPeriodChars(toCuneiform(t.op_translit), ['oldPersian']), `${id} OP`).toEqual([]);
      expect(nonPeriodChars(t.el_cuneiform, ['cuneiform']), `${id} El`).toEqual([]);
      expect(nonPeriodChars(t.bab_cuneiform, ['cuneiform']), `${id} Bab`).toEqual([]);
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

describe('language lint: every source that can reach the canvas', () => {
  /** files allowed to draw text into the 3D world, with what they draw (the carved text itself is checked glyph by glyph
   *  below: what they render is captured at the font) */
  const IN_WORLD_TEXT_SITES: Record<string, string> = {
    'src/arch/decor.ts': 'carved inscriptions from inscriptions.json (Old Persian signs, *_cuneiform), captured and checked below',
    'src/world/plain/naqsh.ts': 'DNa/DNb Old Persian from inscriptions.json, captured and checked below',
    'src/world/writing.ts': 'writing on objects (D-179): seal inscriptions from writing.json impressed in clay (glyph outlines → height field), captured and checked below',
  };
  /** font glyph APIs: a file that turns characters into outlines draws text into the world, whatever it does with them */
  const GLYPH = /\b(charToGlyph|stringToGlyphs|getPath|forEachGlyph)\(/;
  /** files that write text into the page (DOM), never into the canvas: out-of-world by construction (the DOM overlays
   *  the canvas; the translation layer, the menus and the dev overlay are all DOM). Each must stay out of the scene:
   *  none of them may turn a canvas into a texture (checked). */
  const OUT_OF_WORLD_TEXT_SITES: Record<string, string> = {
    'src/ui/translation.ts': 'translation layer: subtitles, inscription readings, map (a DOM canvas), chronicle; off by default',
    'src/ui/shell.ts': 'title screen, menus and settings', 'src/ui/overlay.ts': 'dev overlay (F3)',
    'src/world/bench.ts': 'bench mode report (?bench)', 'src/main.ts': 'the boot-failure message',
  };
  const TEXT_3D = /\b(TextGeometry|textPanelGeometry|CSS2DObject|CSS3DObject|SpriteText|TroikaText)\b/;
  const CANVAS_TEXT = /\b(fillText|strokeText)\b/;
  const DOM_TEXT = /\b(textContent|innerHTML|innerText|outerHTML|createTextNode|insertAdjacentHTML|insertAdjacentText)\b|document\.write\(|\bel\('[a-z0-9]+',\s*'[^']*',\s*[`'"]/;
  const TEXTURE = /\b(CanvasTexture|VideoTexture|DataTexture)\b|new\s+THREE\.Texture\(|\bTextureLoader\b|ImageBitmapLoader/;
  const walk = (d: string, ext: RegExp): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p, ext) : ext.test(p) ? [p] : []; });
  const root = join(__dirname, '..');
  const rel = (p: string) => relative(root, p).split('\\').join('/');
  it('every source file (src/ui included) that renders text is registered, in-world or out-of-world, and none mixes the two', () => {
    for (const f of walk(join(root, 'src'), /\.(ts|js|mjs)$/).map(rel)) {
      const src = readFileSync(join(root, f), 'utf8');
      const t3 = TEXT_3D.test(src), ct = CANVAS_TEXT.test(src), dom = DOM_TEXT.test(src), tex = TEXTURE.test(src);
      if (t3) expect(IN_WORLD_TEXT_SITES[f], `${f} renders text geometry in the world but is not registered`).toBeTruthy();
      if (GLYPH.test(src)) expect(IN_WORLD_TEXT_SITES[f], `${f} draws font glyphs (outlines) but is not registered as an in-world text site`).toBeTruthy();
      if (ct) expect(IN_WORLD_TEXT_SITES[f] ?? OUT_OF_WORLD_TEXT_SITES[f], `${f} draws canvas text but is not registered`).toBeTruthy();
      // a canvas with text that becomes a texture is in the world: only a registered in-world site may do both
      if (ct && tex) expect(IN_WORLD_TEXT_SITES[f], `${f} draws text on a canvas and makes textures`).toBeTruthy();
      if (dom) expect(OUT_OF_WORLD_TEXT_SITES[f], `${f} writes DOM text but is not registered as out-of-world`).toBeTruthy();
      if (OUT_OF_WORLD_TEXT_SITES[f]) expect(tex, `${f} is out-of-world but creates a texture (its text could reach the scene)`).toBe(false);
      if (/<svg\b|<text\b/.test(src)) expect(OUT_OF_WORLD_TEXT_SITES[f], `${f} holds SVG markup (a data-URL texture?)`).toBeTruthy();
      if (IN_WORLD_TEXT_SITES[f]) // the text argument: 1st for canvas fillText/strokeText, 2nd for textPanelGeometry(fontKey, text, …)
        expect(/\b(fillText|strokeText)\(\s*['"`]/.test(src) || /\btextPanelGeometry\(\s*[^,()]+,\s*['"`]/.test(src), `${f} passes a string literal to a text API`).toBe(false);
    }
    for (const f of [...Object.keys(IN_WORLD_TEXT_SITES), ...Object.keys(OUT_OF_WORLD_TEXT_SITES)]) expect(statSync(join(root, f)).isFile(), `stale registry entry ${f}`).toBe(true);
  });
  /** data strings in a non-Latin script, and where they may be: the in-world fields (period scripts, checked above) and
   *  out-of-world notes (source titles, the Greek of a citation). A new one fails until it is classed. */
  const SCRIPT_FIELDS: { file: RegExp; key: RegExp; world: boolean; why: string }[] = [
    { file: /^src\/data\/inscriptions\.json$/, key: /^\.\w+\.(el|bab)_cuneiform$/, world: true, why: 'the carved Elamite and Babylonian text (cuneiform only, checked above and at the font below)' },
    { file: /^src\/data\/inscriptions\.json$/, key: /^\.\w+\.op_(cuneiform|signs|words)(\.\d+)*(\.\w+)?$/, world: false, why: 'the Old Persian sign data the carving converts (the carved result is checked at the font below)' },
    { file: /^src\/data\/writing\.json$/, key: /^\.texts\.\w+\.(op|el|bab)_cuneiform$/, world: true, why: 'the seal inscriptions impressed in clay (writing.ts; captured at the font and checked below)' },
    { file: /^src\/data\/geo\/footprints\.json$/, key: /^\.\w+\.osm_name$/, world: false, why: 'OpenStreetMap names of the ruins (modern Persian): provenance of the footprints only; no source file reads osm_name (checked)' },
    { file: /^src\/data\/sources\.json$/, key: /^\.[\w-]+\.(access|cite)$/, world: false, why: 'citations (the Greek of Od. 1.123): dev overlay and translation layer only' },
    { file: /^src\/data\/names\.json$/, key: /^\.names\.\d+\.origin_basis$/, world: false, why: 'etymology notes (Old Iranian reconstructions in scholarly transliteration: ϑ, β): dev overlay only' },
  ];
  /** a non-Latin script: two or more letters of a modern or period script in a row, or any letter of one outside the
   *  Greek letters that transliteration and IPA use singly (θ Θ ϑ δ χ γ β ε φ: xšāyaθiya, Θūravāhara, bagaδušta) */
  const NON_LATIN = /[\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u0dff\u1f00-\u1fff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\ufb50-\ufdff\ufe70-\ufeff\u{10840}-\u{1085f}\u{103a0}-\u{103df}\u{12000}-\u{1254f}]|[\u0370-\u03ff]{2}|[\u0370-\u0397\u0399-\u03b1\u03b6\u03b7\u03b9-\u03c5\u03c8-\u03d0\u03d2-\u03ff]/u;
  it('data files (src/data, public): strings in a non-Latin script appear only in registered fields; the in-world ones are period script', () => {
    const files = [...walk(join(root, 'src/data'), /\.json$/), ...walk(join(root, 'public'), /\.json$/)].map(rel).filter(f => f !== 'public/voices/manifest.json');
    const found: string[] = [];
    const visit = (f: string, v: unknown, key: string) => {
      if (typeof v === 'string') { if (NON_LATIN.test(v)) { const reg = SCRIPT_FIELDS.find(r => r.file.test(f) && r.key.test(key)); if (!reg) found.push(`${f}${key}: "${v.slice(0, 40)}"`);
        else if (reg.world) expect(nonPeriodChars(v, ['oldPersian', 'cuneiform']), `${f}${key}`).toEqual([]); } return; }
      if (Array.isArray(v)) v.forEach((x, i) => visit(f, x, `${key}.${i}`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(f, x, `${key}.${k}`);
    };
    for (const f of files) visit(f, JSON.parse(readFileSync(join(root, f), 'utf8')), '');
    expect(found, 'non-Latin script in unregistered data fields').toEqual([]);
    for (const f of walk(join(root, 'src'), /\.ts$/)) expect(/\bosm_name\b/.test(readFileSync(f, 'utf8')), `${rel(f)} reads the modern OSM names`).toBe(false);
  });
  it('the voice manifest carries no text but ids, IPA and notes (its IPA is checked against the lines below)', () => {
    const man = JSON.parse(readFileSync(join(root, 'public/voices/manifest.json'), 'utf8'));
    for (const [id, v] of Object.entries<any>(man.lines ?? {})) expect(findModernWords(v.ipa, { ipa: true, allow: new Set(LINES.find(l => l.id === id)?.def.words.flatMap(w => LEXICON_HOMOGRAPHS[w]?.words ?? []) ?? []) }), id).toEqual([]);
  });
  it('SVG and CSS: no SVG text anywhere; generated CSS content only in the out-of-world stylesheet; no stylesheet outside src/ui', () => {
    for (const f of [...walk(join(root, 'public'), /\.svg$/), ...walk(join(root, 'src'), /\.svg$/)].map(rel)) expect(/<text\b|<tspan\b|<foreignObject\b/.test(readFileSync(join(root, f), 'utf8')), `${f} has SVG text`).toBe(false);
    for (const f of walk(join(root, 'src'), /\.css$/).map(rel)) {
      expect(f.startsWith('src/ui/'), `${f}: a stylesheet outside the out-of-world UI`).toBe(true);
      const css = readFileSync(join(root, f), 'utf8'); for (const m of css.matchAll(/content\s*:\s*(['"])(.*?)\1/g)) expect(findModernWords(m[2]).length === 0 || f.startsWith('src/ui/')).toBe(true);
    }
  });
  /** raster images shipped with the app, each looked at: none carries text (fail-closed: a new image must be added here) */
  const RASTERS: Record<string, string> = {
    'public/generated/humans/skin.png': 'skin albedo tile (viewed: no text; Phase 8 lens-A review)',
    'public/generated/humans/eye.png': 'MakeHuman eye texture, no longer sampled (viewed: no text)',
    'public/generated/humans/hair.png': 'hair strand texture (viewed: no text)',
    'public/favicon.svg': 'browser tab icon (out of the world; checked above for SVG text)',
  };
  it('every raster or vector image shipped is registered as looked at and free of text', () => {
    const imgs = walk(join(root, 'public'), /\.(png|jpe?g|webp|gif|avif|bmp|ktx2|basis|svg|ico)$/i).map(rel);
    for (const f of imgs) expect(RASTERS[f], `${f}: an image nobody has checked for text`).toBeTruthy();
    for (const f of Object.keys(RASTERS)) expect(imgs, `stale image entry ${f}`).toContain(f);
  });
});

describe('language lint: the carved signs are the inscription data\'s sign sequence', () => {
  it('what the carving code renders (Terrace and Naqsh-e Rustam, captured at the font) is exactly the data\'s signs', async () => {
    const captured: string[] = [];
    const proto = (opentype as any).Font.prototype, orig = proto.charToGlyph;
    proto.charToGlyph = function (ch: string) { captured.push(ch); return orig.call(this, ch); };
    try {
      await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
      const { manifest, parts, doorways } = buildTerrace(); const p4 = buildPhase4Reliefs(doorways);
      buildInscriptions(manifest, parts, p4.inscriptions);
      buildNaqsh(loadTerrain(), loadRiversFile().nrAncientFootAsl);
    } finally { proto.charToGlyph = orig; }
    const ins = inscriptions as Record<string, any>, OP = oldPersian as any, squash = (s: string) => s.replace(/\s+/g, '');
    // the data's Old Persian sign sequence: `op_signs` (sign-by-sign, with the project's converter) where the data has
    // it, else what the data implies today (the rule speller over the edition text; DNa/DNb without their lacunae)
    const opOf = (id: string) => squash(ins[id].op_signs && typeof OP.carvedLines === 'function' ? OP.carvedLines(ins[id].op_signs).join('') : toCuneiform(['DNa', 'DNb'].includes(id) ? carvableTranslit(id) : ins[id].op_translit));
    const inBlock = (ch: string, a: number, b: number) => { const c = ch.codePointAt(0)!; return c >= a && c <= b; };
    const opStream = captured.filter(c => inBlock(c, 0x103a0, 0x103df)).join(''), cunStream = captured.filter(c => inBlock(c, 0x12000, 0x1254f)).join('');
    /** the stream must be a concatenation of whole expected texts (each panel draws one text, maybe several times) */
    const parse = (stream: string, texts: Record<string, string>) => {
      const seen = new Map<string, number>(); let pos = 0;
      while (pos < stream.length) {
        const hit = Object.entries(texts).filter(([, t]) => t && stream.startsWith(t, pos)).sort((a, b) => b[1].length - a[1].length)[0];
        if (!hit) { const best = Object.entries(texts).map(([k, t]) => { let n = 0; while (n < t.length && stream[pos + n] === t[n]) n++; return [k, n] as const; }).sort((a, b) => b[1] - a[1])[0];
          let q = pos + best[1]; if (/[\udc00-\udfff]/.test(stream[q] ?? '')) q--; // back to the start of the sign (astral: two code units)
          return { ok: false, seen, at: `after ${[...stream.slice(0, pos)].length} signs: nearest ${best[0]}, which agrees for ${[...stream.slice(pos, q)].length} signs; then carved ${[...stream.slice(q)].slice(0, 4).map(c => 'U+' + c.codePointAt(0)!.toString(16)).join(' ')}` }; }
        seen.set(hit[0], (seen.get(hit[0]) ?? 0) + 1); pos += hit[1].length;
      }
      return { ok: true, seen, at: '' };
    };
    const OP_CARVED = ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DNa', 'DNb'];
    const op = parse(opStream, Object.fromEntries(OP_CARVED.map(id => [id, opOf(id)])));
    expect(op.ok, `carved Old Persian is not the data's sign sequence (${op.at})`).toBe(true);
    for (const id of OP_CARVED) expect(op.seen.get(id) ?? 0, `${id} Old Persian carved`).toBeGreaterThan(0);
    const cunTexts: Record<string, string> = {};
    for (const id of ['XPa', 'XPe']) for (const v of ['el', 'bab']) cunTexts[`${id}.${v}`] = squash(ins[id][`${v}_cuneiform`]);
    const cun = parse(cunStream, cunTexts);
    expect(cun.ok, `carved Elamite/Babylonian is not the data's sign sequence (${cun.at})`).toBe(true);
    for (const k of Object.keys(cunTexts)) expect(cun.seen.get(k) ?? 0, k).toBeGreaterThan(0);
    console.log(`carved and checked: Old Persian ${[...op.seen].map(([k, n]) => `${k}×${n}`).join(' ')} (${[...opStream].length} signs drawn); cuneiform ${[...cun.seen].map(([k, n]) => `${k}×${n}`).join(' ')}; sign source: ${OP_CARVED.map(id => `${id} ${ins[id].op_signs && typeof OP.carvedLines === 'function' ? 'op_signs' : 'rule speller'}`).join(', ')}`);
  }, 120_000);
});

describe('language lint: writing on objects (tablets, sealings, leather; D-179)', () => {
  const W = writingData as any;
  it('the transliterations of the written texts contain no modern word, and every written object names a text or is flagged', () => {
    for (const [id, t] of Object.entries<any>(W.texts)) for (const f of ['op_translit', 'el_atf', 'bab_atf']) if (t[f]) expect(findModernWords(t[f]), `${id}.${f}`).toEqual([]);
    for (const [id, o] of Object.entries<any>(W.objects)) expect(o.text ? !!W.texts[o.text] : o.placeholder === true || o.text_visible === false, id).toBe(true);
  });
  it('what the clay shows (captured at the font while the atlas bakes) is exactly the seal texts\' sign sequences, period script only', async () => {
    const captured: string[] = [];
    const proto = (opentype as any).Font.prototype, orig = proto.charToGlyph;
    proto.charToGlyph = function (ch: string) { captured.push(ch); return orig.call(this, ch); };
    try {
      await loadWritingFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
      rebakeWritingAtlas();
    } finally { proto.charToGlyph = orig; }
    const stream = captured.join('');
    expect(stream.length, 'signs drawn').toBeGreaterThan(0);
    expect(nonPeriodChars(stream, ['oldPersian', 'cuneiform'])).toEqual([]);
    const texts = Object.fromEntries(Object.entries<any>(W.texts).map(([k, t]) => [k, (t.op_cuneiform + (t.el_cuneiform ?? '') + (t.bab_cuneiform ?? '')).replace(/\s+/g, '')]));
    let pos = 0; const seen = new Set<string>();
    while (pos < stream.length) { const hit = Object.entries(texts).find(([, t]) => stream.startsWith(t, pos)); expect(hit, `after ${pos} code units the clay shows something that is not a whole seal text`).toBeTruthy(); seen.add(hit![0]); pos += hit![1].length; }
    for (const s of Object.values<any>(W.seals)) expect(seen.has(s.text), `seal text ${s.text} impressed`).toBe(true);
  });
});

describe('language lint: audio that plays in the world', () => {
  const man = JSON.parse(readFileSync('public/voices/manifest.json', 'utf8'));
  /** seconds of an Ogg Opus file: the last page's granule position less the pre-skip, at 48 kHz */
  const oggSeconds = (b: Buffer) => { const last = b.lastIndexOf('OggS'), head = b.indexOf('OpusHead'); return (Number(b.readBigInt64LE(last + 6)) - b.readUInt16LE(head + 10)) / 48000; };
  it('every clip belongs to a current line and voices that line\'s IPA and intonation (stale or swapped audio fails)', () => {
    expect(man.lines, 'the manifest says what each line\'s clips voice').toBeTruthy();
    for (const [key, c] of Object.entries<any>(man.clips)) {
      const id = key.split('|')[0], L = LINES.find(l => l.id === id); expect(L, `${key}: no such line`).toBeTruthy();
      const v = man.lines[id]; expect(v, `${id}: the manifest does not say what its clips voice`).toBeTruthy();
      expect(v.ipa, `${key}: the clip voices /${v.ipa}/, the line is /${L!.ipa}/ (re-run tools/build_speech.py)`).toBe(L!.ipa);
      expect(v.intonation ?? null, key).toBe(L!.intonation ?? null); expect(v.lang, key).toBe(L!.lang);
      expect(['espeak-ng', 'recording'], key).toContain(c.backend);
      if (c.backend === 'recording') { expect(c.source, `${key}: a recording must name its source`).toBeTruthy(); expect(c.licence, `${key}: and its licence`).toBeTruthy(); }
      const buf = readFileSync('public/' + c.url);
      expect(createHash('sha256').update(buf).digest('hex'), `${key}: the file is not the one the manifest records`).toBe(c.sha256);
      const perPhone = oggSeconds(buf) / tokenizeIpa(L!.ipa).length; // a clip in another language or a silent file fails here
      expect(perPhone, `${key} s per phone`).toBeGreaterThan(0.05); expect(perPhone, `${key} s per phone`).toBeLessThan(0.8);
    }
    const onDisk = readdirSync('public/voices').filter(f => f.endsWith('.ogg')).map(f => 'voices/' + f).sort();
    expect(onDisk, 'clips on disk = clips in the manifest').toEqual(Object.values<any>(man.clips).map(c => c.url).sort());
  });
});

describe('language lint: crowd murmur', () => {
  it('pseudo-phrases in every language contain no modern word, alone or run together (20,000 phrases per language)', () => {
    for (const lang of LANG_IDS) {
      const p = buildProfile(lang), r = new Rng(7, `lint:${lang}`);
      for (let i = 0; i < 20000; i++) {
        const ph = pseudoPhrase(p, r), w = ph.ipa.split(' ');
        const bad = [...findModernWords(ph.ipa, { ipa: true }), ...w.slice(1).flatMap((x, k) => findModernWords(w[k] + x, { ipa: true }))];
        if (bad.length) expect(bad, `${lang}: ${ph.ipa}`).toEqual([]);
      }
    }
  });
  it('the modern-word list holds the modern Persian and English words the Phase 8 review heard in the murmur', () => {
    for (const w of ['bia', 'boro', 'bede', 'bash', 'kar', 'set', 'met', 'bet', 'map', 'bus', 'gun', 'sad', 'mad', 'dad']) expect(MODERN_WORDS.has(w), w).toBe(true);
    expect(findModernWords('baːʃ', { ipa: true })).toContain('bash'); expect(findModernWords('kaːr', { ipa: true })).toContain('kar');
  });
  it('murmur sounds come only from attested entries: no tier-C reconstruction (Aramaic myn "water") feeds it', () => {
    for (const lang of LANG_IDS) for (const e of murmurSource(lang)) expect(murmurEligible(e), e.id).toBe(true);
    expect(murmurSource('arc').map(e => e.form)).not.toContain('myn');
    expect(lexEntry('arc:myn')!.tier[0]).toBe('C');
  });
  it('languages without a lexicon fall back to the Aramaic profile and are flagged C; Babylonian and Greek use their own', () => {
    for (const l of ['Egyptian', 'Lydian', 'unknown']) { const m = murmurLangFor(l); expect(m.lang).toBe('arc'); expect(m.fallback).toBe(true); expect(m.tier).toBe('C'); }
    expect(murmurLangFor('Elamite')).toMatchObject({ lang: 'el', fallback: false });
    expect(murmurLangFor('Babylonian')).toMatchObject({ lang: 'bab', fallback: false });
    expect(murmurLangFor('Greek')).toMatchObject({ lang: 'grc', fallback: false });
  });
});
