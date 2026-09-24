// Writing on objects (Phase 8, D-179, D-198; REVIEWS/phase8.md M4): the seal texts are published texts with their sign
// sequence in data; the Treasury tablets carry memoranda RECONSTRUCTED on the published formulary from sourced words only,
// labelled "not a surviving text (C)" in data, F3 and the translation layer; the signs impressed are the data's; the
// records are honest about what was impressed; the carried tablet is the written tablet's form; the translation layer
// shows ids, transliterations and the project's English (C, labelled).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { WRITING, REGIONS, writingAtlas, rebakeWritingAtlas, loadWritingFonts, reliefRms, tabletSize, ptTabletGeometry, writtenMeta } from '../src/world/writing';
import { buildTerrace } from '../src/arch/terrace';
import { buildScribesRoom } from '../src/world/furnish';
import { DoorSystem } from '../src/arch/doors';
import { nonPeriodChars, findModernWords } from '../src/lang/modern';
import { PROP_NOTES, propGeometry } from '../src/people/props';
import { writingReading, TRANSLATION_STATUS, PROJECT_TRANSLATION_LABEL } from '../src/ui/translation';
import elLex from '../research/LEXICON/elamite.json';
import namesJson from '../src/data/names.json';
import { INSCRIPTION_PICK_LAYER } from '../src/arch/decor';

const ario = new Map<string, string>(readFileSync('data/corpus/ario.jsonl', 'utf8').trim().split('\n').map(l => { const j = JSON.parse(l); return [j.id_text, j.raw_text]; }));
/** Old Persian signs → code points (Unicode 5.1 Old Persian block), independent of the build script's name lookup */
const OP_CP: Record<string, number> = { a: 0x103a0, i: 0x103a1, u: 0x103a2, xa: 0x103a7, θa: 0x103b0, da: 0x103ad, ma: 0x103b6, ya: 0x103b9, va: 0x103ba, ra: 0x103bc, ša: 0x103c1, '|': 0x103d0 };
const fontFetch = async (p: string) => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const { parts, manifest } = buildTerrace();

describe('writing on objects: the data', () => {
  it('every text is a published text: its ARIo record verbatim, each version a verbatim piece of it, its signs from data', () => {
    const T = Object.entries(WRITING.texts); expect(T.length).toBeGreaterThan(0);
    for (const [id, t] of T) {
      const raw = ario.get(t.ario); expect(raw, `${id}: ARIo ${t.ario}`).toBeTruthy(); expect((t as any).ario_raw, id).toBe(raw);
      for (const f of ['op_translit', 'el_atf', 'bab_atf'] as const) if (t[f]) expect(raw!.includes(t[f]!), `${id}.${f} is in ${t.ario}`).toBe(true);
      expect(t.op_cuneiform, `${id}: op signs → code points`).toBe(String.fromCodePoint(...t.op_signs.map(s => { expect(OP_CP[s], s).toBeTruthy(); return OP_CP[s]; })));
      expect(t.op_signs.filter(s => s === '|').length + 1, `${id}: one word per divider`).toBe(t.op_translit.split(' ').length);
      expect(nonPeriodChars(t.op_cuneiform, ['oldPersian']), id).toEqual([]);
      for (const v of ['el', 'bab'] as const) if ((t as any)[`${v}_atf`]) { expect((t as any)[`${v}_unmapped`], `${id} ${v}`).toEqual([]); expect(nonPeriodChars((t as any)[`${v}_cuneiform`], ['cuneiform']), `${id} ${v}`).toEqual([]); expect(((t as any)[`${v}_cuneiform`] as string).length).toBeGreaterThan(3); }
      expect(t.tier.text.startsWith('A'), id).toBe(true);
    }
  });
  it('every seal names a text; every written object names a published text, a reconstructed one, or is flagged (placeholder, or its text not visible)', () => {
    for (const [id, s] of Object.entries(WRITING.seals)) { expect(WRITING.texts[s.text], id).toBeTruthy(); expect(s.tier).toBe('C'); expect(s.design).toMatch(/^C/); expect(s.wording).toMatch(/^C/); }
    for (const [id, o] of Object.entries(WRITING.objects)) {
      if (o.text) expect(WRITING.texts[o.text], id).toBeTruthy();
      else if (o.recon) expect(WRITING.recon_texts[o.recon]?.reconstructed, id).toBe(true);
      else expect(o.placeholder || o.text_visible === false, `${id}: no text and neither a placeholder nor hidden`).toBe(true);
      if (o.placeholder) expect(String(o.placeholder_why ?? '')).toMatch(/B18/);
      if (o.seal) expect(WRITING.seals[o.seal], id).toBeTruthy();
      for (const k of o.src) expect(JSON.parse(readFileSync('src/data/sources.json', 'utf8'))[k], `${id}: source ${k}`).toBeTruthy();
    }
    // no PT text is reachable (B18): the tablets carry reconstructed memoranda, never claimed as surviving texts
    for (const id of ['pt_letter', 'pt_letter_fresh', 'pt_letter_unfinished']) { const o = WRITING.objects[id]; expect(o.text, id).toBeNull(); expect(o.recon, id).toMatch(/^PTR-\d$/); expect(o.reconstructed, id).toBe(true); expect(String(o.recon_why)).toMatch(/B18/); }
  });
  it('the reconstructed Treasury memoranda: labelled C, every word from the sourced lexicon, every name attested, every numeral in the PF notation, nothing else (D-198)', () => {
    const lex = new Map((elLex as any[]).map(e => [e.form, e])), names = new Map((namesJson as any).names.map((n: any) => [n.name, n]));
    const nodet = (w: string) => w.replace(/\{[^}]*\}/g, '');
    const R = Object.entries(WRITING.recon_texts); expect(R.length).toBe(3);
    for (const [id, t] of R) {
      expect(t.label, id).toMatch(/not a surviving text \(C\)$/); expect(t.tier.text, id).toMatch(/^C /); expect(t.reconstructed).toBe(true);
      expect(t.words.map(w => w.w).join(' '), `${id}: the words are the running text`).toBe(t.el_atf); expect(t.lines_atf.join(' ')).toBe(t.el_atf);
      for (const w of t.words) {
        if (w.kind === 'word') { const e = lex.get(w.lex!); expect(e, `${id}: ${w.w} (${w.lex}) is a lexicon word`).toBeTruthy();
          const where = `${e.transliteration} ${e.attested}`.split(/[\s"“”(),;:…]+/); expect(where.includes(w.w) || where.map(nodet).includes(nodet(w.w)), `${id}: ${w.w} spelled as in the lexicon`).toBe(true);
          expect(w.lex === 'KU₃.BABBAR' ? 'C' : 'AB', `${id}: ${w.w} tier`).toContain(String(e.tier)[0]); }
        else if (w.kind === 'name') { const n = names.get(w.name!) as any; expect(n, `${id}: ${w.name} is in names.json`).toBeTruthy(); expect(n.tier).toMatch(/^A/); }
        else { expect(w.kind).toBe('numeral'); for (const p of w.w.split(' ')) expect(p, id).toMatch(/^\d+(\/\d+)?\((diš|u|diš@v)\)(-na)?$/); }
        for (const k of w.src) expect(JSON.parse(readFileSync('src/data/sources.json', 'utf8'))[k], `${id}: source ${k}`).toBeTruthy();
      }
      expect(nonPeriodChars(t.el_cuneiform, ['cuneiform']), id).toEqual([]); expect(t.english.length, id).toBeGreaterThan(20);
    }
    // the dates fit every day of the simulated year (1 Nisannu 19 Xerxes → Addaru): the archive's text is of year 18, the
    // fresh tablets' of the first month of year 19, the tablet being written has no date yet
    const d = (k: string) => WRITING.recon_texts[WRITING.objects[k].recon as string].date;
    expect(d('pt_letter').regnal_year).toBe(18); expect(d('pt_letter_fresh')).toMatchObject({ regnal_year: 19, months: [1] }); expect(d('pt_letter_unfinished').months).toBeNull();
  });
});

describe('writing on objects: the relief and its honesty', () => {
  it('without the fonts the seal inscriptions are not impressed, and the sealing says so (placeholder)', () => {
    const a = rebakeWritingAtlas(); expect(a.baked.glyphs).toBe(false); expect(a.baked.texts).toEqual([]);
    const m = writtenMeta('door_sealing', 'door'); const d = (m.describe as () => any)();
    expect(d.placeholder).toBe(true); expect(d.note).toMatch(/NOT impressed/);
    const t = (writtenMeta('pt_letter', 'tablet').describe as () => any)(); expect(t.placeholder).toBe(true); expect(t.reconstructed).toBe(true); expect(t.note).toMatch(/RECONSTRUCTED TEXT PTR-1 .*NOT impressed/);
  });
  it('with the fonts: the signs drawn are exactly the seal texts and the tablets\' texts, whole, and the records claim their impression', async () => {
    await loadWritingFonts(fontFetch);
    const a = rebakeWritingAtlas(); expect(a.baked.glyphs).toBe(true);
    expect([...a.baked.texts].sort()).toEqual(['PTR-1', 'PTR-2', 'PTR-3', 'SDa', 'XSeal']);
    // the stream is a concatenation of whole texts (each tablet face its memorandum; each turn of a roll its seal's text)
    const whole = Object.fromEntries([...Object.values(WRITING.seals).map(s => { const T = WRITING.texts[s.text]; return [s.text, (T.op_cuneiform + (T.el_cuneiform ?? '') + (T.bab_cuneiform ?? '')).replace(/\s+/g, '')]; }),
      ...Object.entries(WRITING.recon_texts).map(([k, t]) => [k, t.el_cuneiform])] as [string, string][]);
    let s = a.baked.signs, n = 0; while (s.length) { const hit = Object.values(whole).find(t => s.startsWith(t)); expect(hit, `signs drawn: ${s.slice(0, 12)}…`).toBeTruthy(); s = s.slice(hit!.length); n++; }
    expect(n).toBeGreaterThanOrEqual(2);
    const d = ((writtenMeta('door_sealing', 'door').describe as () => any)());
    expect(d.placeholder).toBe(false); expect(d.note).toMatch(/impressed/); expect(d.note).not.toMatch(/NOT impressed/);
    for (const [id, r] of [['pt_letter', 'PTR-1'], ['pt_letter_fresh', 'PTR-2'], ['pt_letter_unfinished', 'PTR-3']]) {
      const t = ((writtenMeta(id, 'tablet').describe as () => any)());
      expect(t.placeholder, `${id}: its reconstructed text is impressed`).toBe(false); expect(t.reconstructed).toBe(true);
      expect(t.note).toMatch(new RegExp(`RECONSTRUCTED TEXT ${r} \\(reconstructed on the Treasury tablets' published formulary — not a surviving text \\(C\\)`)); expect(t.note).toMatch(/: impressed/);
    }
  });
  it('the impressions are relief in the height field, measured: wedges on the faces, the seal band, the door sealing\'s inscription panel', () => {
    const rms = (id: keyof typeof REGIONS, box?: [number, number, number, number]) => reliefRms(id, box);
    expect(rms('obv_full', [5, 5, 60, 40])).toBeGreaterThan(0.06); // the memorandum's signs (mm)
    expect(rms('obv_fresh', [5, 5, 60, 40])).toBeGreaterThan(0.06);
    expect(rms('obv_part', [5, 3, 40, 22])).toBeGreaterThan(0.06);
    expect(rms('obv_part', [5, 30, 80, 60]), 'the unfinished tablet is blank below its last line').toBeLessThan(0.05);
    expect(rms('obv_full', [5, 52, 85, 62]), 'the memoranda fit the obverse, above its foot').toBeLessThan(0.05);
    expect(rms('edge_seal')).toBeGreaterThan(0.1);
    // the door sealing: inside the rolled band (its inscription panel) against a band-free corner of the face
    const df = REGIONS.door_face, S = WRITING.seals['PTS-Xerxes-hero'], u0 = (df.w * df.mm - S.roll_mm * 1.1) / 2, t0 = (df.h * df.mm - S.height_mm) / 2;
    const panel = rms('door_face', [u0 + S.roll_mm - 17 - 4 + 1, t0 + 6, u0 + S.roll_mm - 2 - 4 - 1, t0 + S.height_mm - 6]), corner = rms('door_face', [3, 3, 9, 9]);
    expect(panel, `panel ${panel.toFixed(3)} vs corner ${corner.toFixed(3)} mm`).toBeGreaterThan(3 * corner);
  });
});

describe('writing on objects: in the world', () => {
  it('the scribes\' room: written objects carry their record (tier, text id, seal, sources); the tablets are placeholders; cost is small', () => {
    const g = buildScribesRoom((manifest.treasury as any).scribesRoom, (manifest.treasury as any).scribesShelves);
    let draws = 0, tris = 0; const picks: THREE.Object3D[] = [];
    g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; if (m.layers.isEnabled(INSCRIPTION_PICK_LAYER) && !m.layers.isEnabled(0)) { picks.push(m); return; }
      draws++; const idx = m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count; tris += (idx / 3) * ((m as any).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1); });
    for (const [n, w, t] of [['scribes:tablets_filed', 'pt_letter', 'PTR-1'], ['scribes:tablets_fresh', 'pt_letter_fresh', 'PTR-2'], ['scribes:tablet_unfinished', 'pt_letter_unfinished', 'PTR-3']]) {
      const o = g.getObjectByName(n)!; expect(o.userData.writing, n).toBe(w); expect(o.userData.text).toBe(t); expect(o.userData.reconstructed, n).toBe(true);
      expect(o.userData.placeholder, `${n}: fonts loaded, the text is impressed`).toBe(false); expect(String(o.userData.note)).toMatch(/RECONSTRUCTED text PTR-\d, C: not a surviving text/);
      expect(((o as THREE.Mesh).material as any).normalMap, n).toBe(writingAtlas().texture); }
    expect(g.getObjectByName('scribes:tablet_unfinished')!.userData.seal, 'the tablet being written is not sealed yet').toBe('—');
    for (const n of ['scribes:leather_scrolls', 'scribes:bullae']) { const o = g.getObjectByName(n)!; expect(o.userData.writing, n).toBe('leather_scroll'); expect(o.userData.seal).toBe('PTS-treasurer-Darius'); }
    expect(picks.length).toBeGreaterThanOrEqual(3); for (const p of picks) expect(String(p.userData.inscription)).toMatch(/^writing:/);
    expect(draws, 'draw calls of the scribes\' room').toBeLessThanOrEqual(9);
    expect(tris, 'triangles of the scribes\' room').toBeLessThan(40000);
  });
  it('the door sealing is a clay lump with the rolled impression, and its record is the writing record', () => {
    const doors = new DoorSystem(parts);
    const lump = doors.group.getObjectByName('door-sealing:treasury:E') as THREE.Mesh; expect(lump).toBeTruthy();
    expect((lump.material as any).normalMap).toBe(writingAtlas().texture); expect(lump.geometry.getAttribute('uv')).toBeTruthy();
    expect(lump.userData.writing).toBe('door_sealing'); expect(lump.userData.text).toBe('XSeal'); expect(lump.userData.seal).toBe('PTS-Xerxes-hero');
    // the knobs and cord do not claim an impression any more
    doors.group.traverse(o => { if (o !== lump && /impressed with a seal/.test(String(o.userData?.note ?? ''))) throw new Error(`${o.name} claims an impression`); });
    const pk = doors.group.getObjectByName('writing:door_sealing:treasury:E:pick')!; expect(pk.layers.isEnabled(INSCRIPTION_PICK_LAYER)).toBe(true);
  });
  it('the carried tablet is the written tablet\'s form at its LOD, and says the text is a placeholder', () => {
    const [tw, th, tt] = tabletSize(), g = propGeometry('tablet')!; g.computeBoundingBox(); const s = g.boundingBox!.getSize(new THREE.Vector3());
    expect(Math.abs(s.x / tw - 1)).toBeLessThan(0.08); expect(Math.abs(s.z / th - 1)).toBeLessThan(0.08); // the rounded edges take up to 6 % expect(s.y).toBeLessThanOrEqual(tt + 1e-6); expect(s.y).toBeGreaterThan(tt * 0.6);
    expect(PROP_NOTES.tablet.note).toMatch(/pt_letter/); expect(PROP_NOTES.tablet.note).toMatch(/RECONSTRUCTED .* not a surviving text \(C/);
    expect(ptTabletGeometry('full', 2).index!.count / 3).toBeLessThanOrEqual(40);
  });
  it('the translation layer shows the text id, transliteration and the project\'s English, labelled; a reconstructed text says so first', () => {
    const d = writingReading('door_sealing')!; const all = d.lines.join('\n');
    expect(all).toMatch(/ARIo Q009270/); expect(all).toMatch(/adam Xšayaṛšā xšāyaθiya/); expect(d.lines).toContain(TRANSLATION_STATUS);
    expect(all).toMatch(/English \(project translation, C\): “I am Xerxes the king\.”/); expect(all).toContain(PROJECT_TRANSLATION_LABEL);
    const L = writingReading('pt_letter')!.lines, p = L.join('\n');
    expect(L[0]).toMatch(/^RECONSTRUCTED TEXT PTR-1: reconstructed on the Treasury tablets' published formulary — not a surviving text \(C\)/);
    expect(p).toMatch(/Xerxes year 18, months 11 and 12/); expect(p).toMatch(/Line 1 \(Elamite, ATF\): 6\(diš\) kur-ša-um KU₃\.BABBAR kur-min₂/);
    expect(p).toMatch(/English \(the project's English rendering of its own reconstruction \(C\)\): “6 karša of silver/);
    expect(p).toMatch(/ARIo Q007203/); expect(p).toMatch(/DIŠ\.u₂/); // the seal's text, from ARIo
    const u = writingReading('pt_letter_unfinished')!.lines.join('\n'); expect(u).toMatch(/PTR-3/); expect(u).not.toMatch(/Sealed with/);
  });
  it('the transliterations stored contain no modern word', () => {
    for (const [id, t] of Object.entries(WRITING.texts)) for (const f of ['op_translit', 'el_atf', 'bab_atf'] as const) if (t[f]) expect(findModernWords(t[f]!), `${id}.${f}`).toEqual([]);
    for (const [id, t] of Object.entries(WRITING.recon_texts)) expect(findModernWords(t.el_atf), id).toEqual([]);
  });
});
