// Language lint (brief §10: "The build fails on any modern-language text or audio that would be rendered or played in
// the world. Code, data keys, research files and out-of-world UI are excluded."). Run alone with `npm run lint:lang`.
//
// What is in-world, and how each is checked:
//  1. speech lines (src/people/speech_lines.ts): the only in-world field is `words` (lexicon ids); the heard IPA and its
//     transliteration are scanned for modern words. Any new field on a line fails until it is classed here.
//  2. carved inscription text (src/data/inscriptions.json → src/arch/inscription_text.ts panelText, the one path decor.ts
//     and naqsh.ts carve): the rendered strings must be period script only; the transliterations and sign sequences that
//     generate them are scanned for modern words; no unmapped signs. (Their spelling: tests/lang.test.ts, D-177.)
//  3. lexicon native-script fields (future tablets/labels): period script of the right block only.
//  3b. writing on objects (src/data/writing.json → src/world/writing.ts, D-179, D-198): the seal inscriptions and the
//     Treasury tablets' reconstructed memoranda impressed in clay, captured at the font while the writing atlas bakes, are
//     exactly the data's sign sequences; their transliterations are scanned for modern words; a written object without a
//     published text must be flagged (placeholder, hidden, or a reconstructed text labelled as not surviving, C).
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
import { panelText } from '../src/arch/inscription_text';
import { buildProfile, pseudoPhrase, murmurLangFor, murmurSource } from '../src/audio/murmur';
import { tokenizeIpa } from '../src/audio/phonemes';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs } from '../src/arch/decor';
import { buildNaqsh } from '../src/world/plain/naqsh';
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

describe('language lint: every source that can reach the canvas', () => {
  /** files allowed to draw text into the 3D world, with what they draw (the carved text itself is checked glyph by glyph
   *  below: what they render is captured at the font) */
  const IN_WORLD_TEXT_SITES: Record<string, string> = {
    'src/arch/decor.ts': 'carved inscriptions from inscriptions.json (panelText: op_signs / *_cuneiform), captured and checked below',
    'src/arch/carving.ts': 'the carving itself (glyph outlines → depth atlas; layoutText / carvedGeometry of the lines it is given; no text of its own)',
    'src/arch/marks.ts': 'masons\' and sculptors\' marks (D-212): four drawn shapes, not a script (double lozenge, circle, cross, L), cut through carving.ts; no text, no font',
    'src/world/plain/naqsh.ts':'DNa/DNb Old Persian from inscriptions.json (panelText op_signs), captured and checked below',
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
    'src/people/converse/ui.ts': 'speaking with the people (?converse, D-296): the typing box and the reply in the translation layer (English)', 'src/dev/converseLab.ts': 'the conversation lab page (converse.html, dev only, D-296)',
    'src/shell/progress.ts': "the loading screen's progress (D-393; English, before the world is shown)",
    'src/shell/intro.ts': 'the opening (D-590): its one out-of-world hint (any key skips) over the letterbox; the shots are the world itself',
    'src/shell/film.ts': 'the title film (D-761): its one out-of-world hint (any key begins it, Esc skips) over the letterboxed film; the film itself writes only the place\'s name in its own script',
  };
  const TEXT_3D = /\b(TextGeometry|textPanelGeometry|layoutText|carvedGeometry|carvedBlockGeometry|CSS2DObject|CSS3DObject|SpriteText|TroikaText)\b/;
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
      if (IN_WORLD_TEXT_SITES[f]) // the text argument: 1st for canvas fillText/strokeText, 2nd for layoutText(font, lines, …) / textPanelGeometry(fontKey, text, …)
        expect(/\b(fillText|strokeText)\(\s*['"`]/.test(src) || /\b(layoutText|textPanelGeometry)\(\s*[^,()]+,\s*[\['"`]/.test(src), `${f} passes a string literal to a text API`).toBe(false);
    }
    for (const f of [...Object.keys(IN_WORLD_TEXT_SITES), ...Object.keys(OUT_OF_WORLD_TEXT_SITES)]) expect(statSync(join(root, f)).isFile(), `stale registry entry ${f}`).toBe(true);
  });
  /** data strings in a non-Latin script, and where they may be: the in-world fields (period scripts, checked above) and
   *  out-of-world notes (source titles, the Greek of a citation). A new one fails until it is classed. */
  const SCRIPT_FIELDS: { file: RegExp; key: RegExp; world: boolean; why: string }[] = [
    { file: /^src\/data\/inscriptions\.json$/, key: /^\.\w+\.(el|bab)_(cuneiform|lines\.\d+)$/, world: true, why: 'the carved Elamite and Babylonian text, running and in the edition\'s lines (cuneiform only, checked above and read back from the carved meshes below)' },
    { file: /^src\/data\/inscriptions\.json$/, key: /^\.\w+\.op_(cuneiform|signs|words)(\.\d+)*(\.\w+)?(\.\d+)?$/, world: false, why: 'the Old Persian sign data the carving converts (the carved result is checked at the font below)' },
    { file: /^src\/data\/writing\.json$/, key: /^\.texts\.\w+\.(op|el|bab)_cuneiform$/, world: true, why: 'the seal inscriptions impressed in clay (writing.ts; captured at the font and checked below)' },
    { file: /^src\/data\/writing\.json$/, key: /^\.recon_texts\.[\w-]+\.(el_cuneiform|lines_cuneiform\.\d+)$/, world: true, why: 'the Treasury tablets\' reconstructed memoranda impressed in clay (writing.ts; D-198; captured at the font and checked below)' },
    { file: /^src\/data\/geo\/footprints\.json$/, key: /^\.\w+\.osm_name$/, world: false, why: 'OpenStreetMap names of the ruins (modern Persian): provenance of the footprints only; no source file reads osm_name (checked)' },
    { file: /^src\/data\/sources\.json$/, key: /^\.[\w-]+\.(access|cite)$/, world: false, why: 'citations (the Greek of Od. 1.123): dev overlay and translation layer only' },
    { file: /^src\/data\/names\.json$/, key: /^\.names\.\d+\.origin_basis$/, world: false, why: 'etymology notes (Old Iranian reconstructions in scholarly transliteration: ϑ, β): dev overlay only' },
  ];
  /** a non-Latin script: two or more letters of a modern or period script in a row, or any letter of one outside the
   *  Greek letters that transliteration and IPA use singly (θ Θ ϑ δ χ γ β ε φ: xšāyaθiya, Θūravāhara, bagaδušta) */
  const NON_LATIN = /[\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u0dff\u1f00-\u1fff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\ufb50-\ufdff\ufe70-\ufeff\u{10840}-\u{1085f}\u{103a0}-\u{103df}\u{12000}-\u{1254f}]|[\u0370-\u03ff]{2}|[\u0370-\u0397\u0399-\u03b1\u03b6\u03b7\u03b9-\u03c5\u03c8-\u03d0\u03d2-\u03ff]/u;
  it('data files (src/data, public): strings in a non-Latin script appear only in registered fields; the in-world ones are period script', () => {
    const files = [...walk(join(root, 'src/data'), /\.json$/), ...walk(join(root, 'public'), /\.json$/)].map(rel).filter(f => f !== 'public/voices/manifest.json' && !f.startsWith('public/models/')); // public/models: the in-browser models' files (D-296; outside git, a junction to the asset store: tokenizers of every script, never shown)
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
    'public/textures/Fabric043/diff.jpg': 'CC0 scan albedo (Fabric043; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Fabric043/arm.jpg': 'CC0 scan AO/roughness/metal pack (Fabric043; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Leather014/diff.jpg': 'CC0 scan albedo (Leather014; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Leather014/arm.jpg': 'CC0 scan AO/roughness/metal pack (Leather014; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Metal013/diff.jpg': 'CC0 scan albedo (Metal013; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Metal013/arm.jpg': 'CC0 scan AO/roughness/metal pack (Metal013; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Tatami001/diff.jpg': 'CC0 scan albedo (Tatami001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Tatami001/arm.jpg': 'CC0 scan AO/roughness/metal pack (Tatami001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Wicker010B/diff.jpg': 'CC0 scan albedo (Wicker010B; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/Wicker010B/arm.jpg': 'CC0 scan AO/roughness/metal pack (Wicker010B; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/aerial_ground_rock/diff.jpg': 'CC0 scan albedo (aerial_ground_rock; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/aerial_ground_rock/arm.jpg': 'CC0 scan AO/roughness/metal pack (aerial_ground_rock; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/brown_mud_dry/diff.jpg': 'CC0 scan albedo (brown_mud_dry; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/brown_mud_dry/arm.jpg': 'CC0 scan AO/roughness/metal pack (brown_mud_dry; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_block_wall/diff.jpg': 'CC0 scan albedo (clay_block_wall; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_block_wall/arm.jpg': 'CC0 scan AO/roughness/metal pack (clay_block_wall; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_floor_001/diff.jpg': 'CC0 scan albedo (clay_floor_001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_floor_001/arm.jpg': 'CC0 scan AO/roughness/metal pack (clay_floor_001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/models/impostors/people_imp_a.ktx2': 'the far people’s impostor atlas (colour-slot weights, normals, occlusion and depth of posed people), rendered by Blender/Cycles from the project’s own people (D-331; its contact sheet viewed by the impostors agent, session 12: figures only, no text)',
    'public/models/impostors/people_imp_b.ktx2': 'the far people’s impostor atlas (colour-slot weights, normals, occlusion and depth of posed people), rendered by Blender/Cycles from the project’s own people (D-331; its contact sheet viewed by the impostors agent, session 12: figures only, no text)',
    'public/models/impostors/people_imp_n.ktx2': 'the far people’s impostor atlas (colour-slot weights, normals, occlusion and depth of posed people), rendered by Blender/Cycles from the project’s own people (D-331; its contact sheet viewed by the impostors agent, session 12: figures only, no text)',
    'public/models/monuments/ajori/brick_n.ktx2': 'Tol-e Ajori gate, Blender-carved and Cycles-baked (D-329): normal map and firing tone of the carved brick tile; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/ajori/glaze_a.ktx2': 'Tol-e Ajori gate, Blender-carved and Cycles-baked (D-329): occlusion/roughness of the glazed atlas; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/ajori/glaze_c.ktx2': 'Tol-e Ajori gate, Blender-carved and Cycles-baked (D-329): colour of the glazed atlas: blue ground, the aurochs, the mušḫuššu, white rosettes; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/ajori/glaze_n.ktx2': 'Tol-e Ajori gate, Blender-carved and Cycles-baked (D-329): normal map of the glazed atlas; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/ajori/light_a.ktx2': 'Tol-e Ajori gate, Blender-carved and Cycles-baked (D-329): light map (occlusion, weathering) of the gate; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/cliff_a.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the cliff face: occlusion and run-off albedo; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/cliff_n.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the cliff face: normal map (joints, bedding, flutes, spalls); its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/facade_a.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the tomb façade: occlusion; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/facade_n.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the tomb façade: normal map; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/kaba_a.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the Ka’ba: occlusion; its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/monuments/naqsh/kaba_n.ktx2': 'Naqsh-e Rustam, Blender-built and Cycles-baked (D-329): the Ka’ba: normal map (recesses, joints); its PNG viewed in a contact sheet (ajori_naqsh agent, session 12), KTX2 of the same: no text',
    'public/models/people/people_hair_atlas.ktx2': 'the hair-card strand atlas, rendered by Blender/Cycles from hair curves shaded by MakeHuman CC0 hair (D-307, D-323; its PNG viewed by the hairhands agent, session 12: locks of strands only, no text)',
    'public/models/people/people_hair_normal.ktx2': 'the normal atlas of the hair cards, rendered by Blender/Cycles from the same hair curves (D-323; its PNG viewed by the hairhands agent, session 12: locks of strands only, no text)',
    'public/models/life/bat_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/bat_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/beeeater_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/beeeater_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/bulbul_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/bulbul_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/chukar_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/chukar_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/crane_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/crane_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/crow_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/crow_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/dove_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/dove_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/duck_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/duck_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/duck_f_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/duck_f_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/egret_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/egret_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/heron_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/heron_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/hoopoe_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/hoopoe_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/jackdaw_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/jackdaw_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/kestrel_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/kestrel_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/kite_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/kite_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/lark_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/lark_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/magpie_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/magpie_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/owl_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/owl_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/raptor_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/raptor_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/roller_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/roller_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sandgrouse_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sandgrouse_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sparrow_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sparrow_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sparrow_f_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/sparrow_f_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/starling_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/starling_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/stork_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/stork_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/swallow_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/swallow_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/swift_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/swift_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/vulture_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/vulture_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/wheatear_albedo.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/wheatear_nrm.ktx2': 'a bird plumage map (albedo with feather-tip coverage, or normal + occlusion) baked by Blender/Cycles from the parametric bird and its palette (D-332); no text source in the pipeline; the agent viewed the sparrow and stork maps and every species contact sheet (session 12): uv blocks of plumage only, no text',
    'public/models/life/butterfly_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/butterfly_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/crab_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/crab_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/dragonfly_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/dragonfly_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/fly_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/fly_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/frog_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/frog_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/hedgehog_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/hedgehog_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/jird_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/jird_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/lizard_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/lizard_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/porcupine_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/porcupine_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/scorpion_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/scorpion_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/snail_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/snail_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/snake_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/snake_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/tortoise_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/tortoise_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/turtle_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/turtle_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/camelthorn_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/camelthorn_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/cushion_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/cushion_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_crown_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_crown_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_red_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_red_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_violet_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_violet_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_yellow_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/flower_yellow_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/rose_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/rose_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/thistle_albedo.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/thistle_nrm.ktx2': 'a ground plant map (albedo with leaf coverage, or normal + occlusion) baked by Blender/Cycles from the modelled plant (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/jackal_albedo.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/life/jackal_nrm.ktx2': 'a small creature map (albedo with coverage, or normal + occlusion) baked by Blender/Cycles from its modelled body (D-332); no text source in the pipeline; the agent viewed the contact sheets (session 12): no text',
    'public/models/animals/boar_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/boar_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/calf_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/calf_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/camel_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/camel_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/camel_pack_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/camel_pack_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cheetah_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cheetah_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cock_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cock_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cow_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/cow_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/deer_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/deer_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/dog_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/dog_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/donkey_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/donkey_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/donkey_pack_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/donkey_pack_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/dromedary_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/dromedary_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/fox_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/fox_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/gazelle_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/gazelle_m_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/gazelle_m_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/gazelle_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/goat_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/goat_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hare_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hare_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hen_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hen_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/horse_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/horse_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/horse_saddle_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/horse_saddle_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hyena_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/hyena_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/leopard_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/leopard_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/lion_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/lion_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/lioness_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/lioness_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/mule_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/mule_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/mule_pack_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/mule_pack_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/onager_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/onager_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/ox_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/ox_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/sheep_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/sheep_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/stag_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/stag_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/urial_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/urial_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/wild_goat_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/wild_goat_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/wolf_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/wolf_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/zebu_albedo.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/animals/zebu_nrm.ktx2': 'an animal coat map (albedo with coat mask, or normal + occlusion) baked by Blender/Cycles from the anatomy SDFs (D-326); no text source in the pipeline; the lead decoded and viewed the lion, boar and horse albedos (session 12): UV islands of coat only, no text',
    'public/models/people/people_cloth_folds.png': 'the garments fold-height atlas, baked from the Blender cloth simulations (D-322; viewed by the lead, session 12: fold charts only, no text)',
    'public/models/land/ground_diff.jpg': 'the ground rock atlas of the hills (D-335; CC0 Poly Haven scans of rock outcrops, talus and scree, diff): viewed by the land agent in a contact sheet, session 12: rock and gravel only, no text',
    'public/models/land/ground_nor.jpg': 'the ground rock atlas of the hills (D-335; CC0 Poly Haven scans of rock outcrops, talus and scree, nor): viewed by the land agent in a contact sheet, session 12: rock and gravel only, no text',
    'public/models/land/ground_arm.jpg': 'the ground rock atlas of the hills (D-335; CC0 Poly Haven scans of rock outcrops, talus and scree, arm): viewed by the land agent in a contact sheet, session 12: rock and gravel only, no text',
    'public/models/land/cover_diff.jpg': 'the ground cover atlas (D-335; CC0 Poly Haven grass scans and a painted straw and dung cell, diff): viewed by the land agent in a contact sheet, session 12: grass blades, straw and dung only, no text',
    'public/models/land/cover_nor.jpg': 'the ground cover atlas (D-335; CC0 Poly Haven grass scans and a painted straw and dung cell, nor): viewed by the land agent in a contact sheet, session 12: grass blades, straw and dung only, no text',
    'public/models/land/cover_arm.jpg': 'the ground cover atlas (D-335; CC0 Poly Haven grass scans and a painted straw and dung cell, arm): viewed by the land agent in a contact sheet, session 12: grass blades, straw and dung only, no text',
    'public/models/land/ledgeface_diff.jpg': 'the ledges face (D-335; baked in Blender from the CC0 Poly Haven scan coastal_cliff_04, albedo): viewed by the land agent, session 12: a bedded cliff face only, no text',
    'public/models/land/ledgeface_nor.jpg': 'the ledges face (D-335; baked in Blender from the CC0 Poly Haven scan coastal_cliff_04, normal): viewed by the land agent, session 12: a bedded cliff face only, no text',
    'public/models/land/ledgeface_height.png': 'the ledges face (D-335; baked in Blender from the CC0 Poly Haven scan coastal_cliff_04, relief): viewed by the land agent, session 12: a bedded cliff face only, no text',
    'public/models/props/carpet_pile_n.png': 'the carpets knotted-pile normal map (D-325; viewed by the lead, session 12: pile rows only, no text)',
    'public/models/trees/bark/bark_brown_02_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_brown_02_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_platanus_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_platanus_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_willow_02_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_willow_02_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_willow_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/bark_willow_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/chinese_cedar_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/chinese_cedar_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/chinese_hackberry_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/chinese_hackberry_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_camphor_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_camphor_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_cedar_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_cedar_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_sycamore_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_sycamore_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_zelkova_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/japanese_zelkova_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/jolcham_oak_bark_01_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/jolcham_oak_bark_01_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/metasequoia_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/metasequoia_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/pine_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/pine_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/sakura_bark_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/sakura_bark_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/tree_bark_03_diff.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/bark/tree_bark_03_nor.jpg': 'a CC0 Poly Haven bark scan (colour or normal) for the trees (D-327); bark photographs; the lead viewed bark_platanus_diff (session 12): bark only, no text',
    'public/models/trees/leaf_col.webp': 'the trees leaf/blossom/twig card atlas rendered by Blender/Cycles (D-327; leaf_col viewed by the lead, session 12: coded sprays only, no text)',
    'public/models/trees/leaf_tilt.webp': 'the trees leaf/blossom/twig card atlas rendered by Blender/Cycles (D-327; leaf_col viewed by the lead, session 12: coded sprays only, no text)',
    'public/textures/blockface/blockface.ktx2': 'the dressed-stone tool-mark set baked by Blender/Cycles (D-321; layer 0 decoded and viewed by the lead, session 12: chisel strokes only, no text)',
    'public/textures/housewall_bake/bake.jpg': 'the Blender-baked mud-plaster wall detail (D-324; viewed by the lead, session 12: plaster and cracks only, no text)',
    'public/textures/palacewall_bake/bake.ktx2': 'the Blender-baked palace mud-plaster detail (D-334; its source PNG viewed lit by the palacewalls agent, session 12: float arcs, chaff, pits and hairline cracks only, no text)',
    'public/textures/palaceroof_bake/bake.ktx2': 'the Blender-baked rolled clay-and-straw roof coat (D-334; its source PNG viewed lit by the palacewalls agent, session 12: roller tracks, straw, grit and cracks only, no text)',
    'public/models/reliefs/nao.ktx2': 'the carved-relief atlas, normal + occlusion + gilding of every relief figure baked by Blender/Cycles (D-320; layers decoded and viewed by the reliefs agent, session 12: carved figures only, no text: the inscriptions are cut by incision.ts, not baked here)',
    'public/models/reliefs/paint.ktx2': 'the carved-relief atlas, the paint of the figures on the same grid (D-320; decoded and viewed, session 12: flat pigments and the robe patterns, no text)',
    'public/generated/humans/scans/cloth_0.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_0_h.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_1.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_1_h.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_2.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_2_h.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_3.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/cloth_3_h.jpg': 'cloth scan layer (CC0) (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_00.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_01.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_02.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_03.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_04.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_05.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_06.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_07.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_08.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_09.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_10.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/generated/humans/scans/skin_11.jpg': 'skin layer from the MakeHuman CC0 skins, logo margins masked (D-304/D-307; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/clay_floor_001/nor.jpg': 'CC0 scan normal map (clay_floor_001; D-300); viewed in a contact sheet by the lead, session 11: no text',
    'public/textures/rock_boulder_dry/arm.jpg': 'CC0 scan AO/roughness/metal pack (rock_boulder_dry; D-300); viewed in a contact sheet by the lead, session 11: no text',
    'public/textures/rock_boulder_dry/diff.jpg': 'CC0 scan albedo (rock_boulder_dry; D-300); viewed in a contact sheet by the lead, session 11: no text',
    'public/textures/rock_boulder_dry/nor.jpg': 'CC0 scan normal map (rock_boulder_dry; D-300); viewed in a contact sheet by the lead, session 11: no text',
    'public/textures/brown_mud_02/diff.jpg': 'CC0 scan albedo (brown_mud_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/brown_mud_02/arm.jpg': 'CC0 scan AO/roughness/metal pack (brown_mud_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/brown_mud_02/disp.jpg': 'CC0 scan displacement (height) (brown_mud_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dirt/diff.jpg': 'CC0 scan albedo (dirt; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dirt/arm.jpg': 'CC0 scan AO/roughness/metal pack (dirt; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dirt/disp.jpg': 'CC0 scan displacement (height) (dirt; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dry_river_pebbles/diff.jpg': 'CC0 scan albedo (dry_river_pebbles; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dry_river_pebbles/arm.jpg': 'CC0 scan AO/roughness/metal pack (dry_river_pebbles; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/dry_river_pebbles/disp.jpg': 'CC0 scan displacement (height) (dry_river_pebbles; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/farm_soil/diff.jpg': 'CC0 scan albedo (farm_soil; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/farm_soil/arm.jpg': 'CC0 scan AO/roughness/metal pack (farm_soil; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/farm_soil/disp.jpg': 'CC0 scan displacement (height) (farm_soil; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/grass_ground/diff.jpg': 'CC0 scan albedo (grass_ground; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/grass_ground/arm.jpg': 'CC0 scan AO/roughness/metal pack (grass_ground; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/grass_ground/disp.jpg': 'CC0 scan displacement (height) (grass_ground; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/mud_cracked_dry_riverbed_002/diff.jpg': 'CC0 scan albedo (mud_cracked_dry_riverbed_002; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/mud_cracked_dry_riverbed_002/arm.jpg': 'CC0 scan AO/roughness/metal pack (mud_cracked_dry_riverbed_002; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/mud_cracked_dry_riverbed_002/disp.jpg': 'CC0 scan displacement (height) (mud_cracked_dry_riverbed_002; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rock_face_03/diff.jpg': 'CC0 scan albedo (rock_face_03; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rock_face_03/arm.jpg': 'CC0 scan AO/roughness/metal pack (rock_face_03; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rock_face_03/disp.jpg': 'CC0 scan displacement (height) (rock_face_03; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocks_ground_09/diff.jpg': 'CC0 scan albedo (rocks_ground_09; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocks_ground_09/arm.jpg': 'CC0 scan AO/roughness/metal pack (rocks_ground_09; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocks_ground_09/disp.jpg': 'CC0 scan displacement (height) (rocks_ground_09; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail/diff.jpg': 'CC0 scan albedo (rocky_trail; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail/arm.jpg': 'CC0 scan AO/roughness/metal pack (rocky_trail; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail/disp.jpg': 'CC0 scan displacement (height) (rocky_trail; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail_02/diff.jpg': 'CC0 scan albedo (rocky_trail_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail_02/arm.jpg': 'CC0 scan AO/roughness/metal pack (rocky_trail_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/rocky_trail_02/disp.jpg': 'CC0 scan displacement (height) (rocky_trail_02; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/withered_grass/diff.jpg': 'CC0 scan albedo (withered_grass; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/withered_grass/arm.jpg': 'CC0 scan AO/roughness/metal pack (withered_grass; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/withered_grass/disp.jpg': 'CC0 scan displacement (height) (withered_grass; D-302; viewed in a contact sheet by the lead, session 11: no text)',
    'public/textures/clay_plaster/diff.jpg': 'CC0 scan albedo (clay_plaster; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_plaster/arm.jpg': 'CC0 scan AO/roughness/metal pack (clay_plaster; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/cliff_side/diff.jpg': 'CC0 scan albedo (cliff_side; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/cliff_side/arm.jpg': 'CC0 scan AO/roughness/metal pack (cliff_side; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_ground_01/diff.jpg': 'CC0 scan albedo (dry_ground_01; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_ground_01/arm.jpg': 'CC0 scan AO/roughness/metal pack (dry_ground_01; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_ground_rocks/diff.jpg': 'CC0 scan albedo (dry_ground_rocks; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_ground_rocks/arm.jpg': 'CC0 scan AO/roughness/metal pack (dry_ground_rocks; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_mud_field_001/diff.jpg': 'CC0 scan albedo (dry_mud_field_001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/dry_mud_field_001/arm.jpg': 'CC0 scan AO/roughness/metal pack (dry_mud_field_001; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/gravelly_sand/diff.jpg': 'CC0 scan albedo (gravelly_sand; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/gravelly_sand/arm.jpg': 'CC0 scan AO/roughness/metal pack (gravelly_sand; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/grey_plaster_02/diff.jpg': 'CC0 scan albedo (grey_plaster_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/grey_plaster_02/arm.jpg': 'CC0 scan AO/roughness/metal pack (grey_plaster_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/hessian_230/diff.jpg': 'CC0 scan albedo (hessian_230; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/hessian_230/arm.jpg': 'CC0 scan AO/roughness/metal pack (hessian_230; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/mud_cracked_dry_03/diff.jpg': 'CC0 scan albedo (mud_cracked_dry_03; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/mud_cracked_dry_03/arm.jpg': 'CC0 scan AO/roughness/metal pack (mud_cracked_dry_03; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/clay_block_wall/arm.ktx2': 'KTX2 encoding of the checked clay_block_wall/arm.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/clay_block_wall/diff.ktx2': 'KTX2 encoding of the checked clay_block_wall/diff.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/dirt_floor/arm.ktx2': 'KTX2 encoding of the checked dirt_floor/arm.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/dirt_floor/diff.ktx2': 'KTX2 encoding of the checked dirt_floor/diff.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/raked_dirt/arm.ktx2': 'KTX2 encoding of the checked raked_dirt/arm.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/raked_dirt/diff.ktx2': 'KTX2 encoding of the checked raked_dirt/diff.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/stone_wall/arm.ktx2': 'KTX2 encoding of the checked stone_wall/arm.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/stone_wall/diff.ktx2': 'KTX2 encoding of the checked stone_wall/diff.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/stone_wall/nor.ktx2': 'KTX2 encoding of the checked stone_wall/nor.jpg (V2 D-490, ktx.exe; same pixels: no text)',
    'public/textures/weathered_planks/arm.jpg': 'CC0 Poly Haven Weathered Planks AO/roughness/metal pack (C1 D-550 door leaves; viewed in a contact sheet by the cloud lead, session 17: boards and nail heads, no text)',
    'public/textures/weathered_planks/diff.jpg': 'CC0 Poly Haven Weathered Planks colour (C1 D-550 door leaves; viewed in a contact sheet by the cloud lead, session 17: boards and nail heads, no text)',
    'public/textures/dirt_floor/arm.jpg': 'CC0 scan AO/roughness/metal pack (dirt_floor; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/dirt_floor/diff.jpg': 'CC0 scan colour (dirt_floor; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/raked_dirt/arm.jpg': 'CC0 scan AO/roughness/metal pack (raked_dirt; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/raked_dirt/diff.jpg': 'CC0 scan colour (raked_dirt; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/stone_wall/arm.jpg': 'CC0 scan AO/roughness/metal pack (stone_wall; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/stone_wall/diff.jpg': 'CC0 scan colour (stone_wall; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/stone_wall/nor.jpg': 'CC0 scan normal map (stone_wall; V2 D-490; viewed in a contact sheet by the cloud lead, session 17: no text)',
    'public/textures/rock_surface/diff.jpg': 'CC0 scan albedo (rock_surface; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/rock_surface/arm.jpg': 'CC0 scan AO/roughness/metal pack (rock_surface; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/rock_wall_02/diff.jpg': 'CC0 scan albedo (rock_wall_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/rock_wall_02/arm.jpg': 'CC0 scan AO/roughness/metal pack (rock_wall_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/rough_wood/diff.jpg': 'CC0 scan albedo (rough_wood; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/rough_wood/arm.jpg': 'CC0 scan AO/roughness/metal pack (rough_wood; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/sandy_gravel_02/diff.jpg': 'CC0 scan albedo (sandy_gravel_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/textures/sandy_gravel_02/arm.jpg': 'CC0 scan AO/roughness/metal pack (sandy_gravel_02; viewed in a contact sheet, session 11 D-301: no text)',
    'public/models/decor/frame_trim.ktx2': 'the trim of the stone frames (tangent normal + AO) baked by Blender/Cycles from the carved profiles (D-330); its PNG viewed by the decor_tents agent, session 12: tongues, arrises and chips only, no text',
  };
  it('every raster or vector image shipped is registered as looked at and free of text', () => {
    const imgs = walk(join(root, 'public'), /\.(png|jpe?g|webp|gif|avif|bmp|ktx2|basis|svg|ico)$/i).map(rel);
    for (const f of imgs) expect(RASTERS[f], `${f}: an image nobody has checked for text`).toBeTruthy();
    for (const f of Object.keys(RASTERS)) expect(imgs, `stale image entry ${f}`).toContain(f);
  });
});

describe('language lint: the carved signs are the inscription data\'s sign sequence', () => {
  it('what the carving code cuts (Terrace and Naqsh-e Rustam, read back from each carved mesh) is exactly the data\'s signs', async () => {
    await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
    const { manifest, parts, doorways } = buildTerrace(); const p4 = buildPhase4Reliefs(doorways);
    const roots = [buildInscriptions(manifest, parts, p4.inscriptions), buildNaqsh(loadTerrain(), loadRiversFile().nrAncientFootAsl).group];
    const squash = (s: string) => s.replace(/\s+/g, ''); // a lost sign (no-break space) is left uncut: not in the cut sequence
    const seen = new Map<string, number>(); let meshes = 0, signs = 0;
    for (const r of roots) r.traverse((o: any) => {
      if (!o.isMesh || !o.geometry?.getAttribute('carveUV')) return;
      meshes++;
      const list = o.userData.carved as { id: string; ver: 'op' | 'el' | 'bab'; signs: string }[];
      expect(list?.length, `${o.name}: a carved mesh must say what it cuts`).toBeGreaterThan(0);
      // a mesh's quads are its blocks' signs, one quad per sign
      expect(o.geometry.getAttribute('carveUV').count, o.name).toBe((o.geometry.index ? 4 : 6) * list.reduce((n, c) => n + [...c.signs].length, 0));
      for (const c of list) {
        const want = panelText(c.id, c.ver); expect(want, `${o.name}: ${c.id} ${c.ver} has no text`).toBeTruthy();
        expect(c.signs, `${o.name}: ${c.id} ${c.ver} carved signs differ from the data's`).toBe(squash(want!.lines.join('')));
        expect(nonPeriodChars(c.signs, [c.ver === 'op' ? 'oldPersian' : 'cuneiform']), `${c.id} ${c.ver}`).toEqual([]);
        seen.set(`${c.id}.${c.ver}`, (seen.get(`${c.id}.${c.ver}`) ?? 0) + 1); signs += [...c.signs].length;
      }
    });
    for (const id of ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DPa', 'DPb', 'DPc', 'DPd', 'DPe', 'DNa', 'DNb']) expect(seen.get(`${id}.op`) ?? 0, `${id} Old Persian carved`).toBeGreaterThan(0);
    for (const id of ['XPa', 'XPb', 'XPc', 'XPd', 'XPe', 'DPa', 'DPb', 'DPc']) for (const v of ['el', 'bab']) expect(seen.get(`${id}.${v}`) ?? 0, `${id} ${v} carved`).toBeGreaterThan(0);
    expect(seen.get('DPf.el') ?? 0).toBeGreaterThan(0); expect(seen.get('DPg.bab') ?? 0).toBeGreaterThan(0);
    console.log(`carved and checked: ${meshes} meshes, ${signs} signs; ${[...seen].map(([k, n]) => `${k}×${n}`).join(' ')}`);
  }, 180_000);
});

describe('language lint: writing on objects (tablets, sealings, leather; D-179)', () => {
  const W = writingData as any;
  it('the transliterations of the written texts contain no modern word, and every written object names a text or is flagged', () => {
    for (const [id, t] of Object.entries<any>(W.texts)) for (const f of ['op_translit', 'el_atf', 'bab_atf']) if (t[f]) expect(findModernWords(t[f]), `${id}.${f}`).toEqual([]);
    for (const [id, t] of Object.entries<any>(W.recon_texts)) for (const l of [t.el_atf, ...t.lines_atf]) expect(findModernWords(l), `${id}: ${l}`).toEqual([]);
    // a published text; or a reconstructed one that says, in its data, that it is not a surviving text (C); or a flag
    for (const [id, o] of Object.entries<any>(W.objects)) expect(o.text ? !!W.texts[o.text]
      : o.recon ? W.recon_texts[o.recon]?.reconstructed === true && /not a surviving text \(C\)/.test(W.recon_texts[o.recon].label) && o.reconstructed === true
      : o.placeholder === true || o.text_visible === false, id).toBe(true);
  });
  it('what the clay shows (captured at the font while the atlas bakes) is exactly the seal texts\' and the reconstructed tablet texts\' sign sequences, period script only', async () => {
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
    const texts = Object.fromEntries([...Object.entries<any>(W.texts).map(([k, t]) => [k, (t.op_cuneiform + (t.el_cuneiform ?? '') + (t.bab_cuneiform ?? '')).replace(/\s+/g, '')]),
      ...Object.entries<any>(W.recon_texts).map(([k, t]) => [k, (t.lines_cuneiform as string[]).join('').replace(/\s+/g, '')])] as [string, string][]);
    for (const [k, t] of Object.entries<any>(W.recon_texts)) expect((t.lines_cuneiform as string[]).join(''), `${k}: the lines are the running text`).toBe(t.el_cuneiform);
    let pos = 0; const seen = new Set<string>();
    while (pos < stream.length) { const hit = Object.entries(texts).find(([, t]) => stream.startsWith(t, pos)); expect(hit, `after ${pos} code units the clay shows something that is not a whole text of the data`).toBeTruthy(); seen.add(hit![0]); pos += hit![1].length; }
    for (const s of Object.values<any>(W.seals)) expect(seen.has(s.text), `seal text ${s.text} impressed`).toBe(true);
    for (const o of Object.values<any>(W.objects)) if (o.recon) expect(seen.has(o.recon), `tablet text ${o.recon} impressed`).toBe(true);
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
