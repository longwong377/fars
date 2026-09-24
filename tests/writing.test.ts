// Writing on objects (Phase 8, D-179; REVIEWS/phase8.md M4): the texts are published texts with their sign sequence in
// data; the signs impressed are those; a placeholder says so; the door sealing's record is honest about its impression;
// the carried tablet is the written tablet's form; the translation layer shows transliterations and ids, no translation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { WRITING, REGIONS, writingAtlas, rebakeWritingAtlas, loadWritingFonts, reliefRms, tabletSize, ptTabletGeometry, writtenMeta } from '../src/world/writing';
import { buildTerrace } from '../src/arch/terrace';
import { buildScribesRoom } from '../src/world/furnish';
import { DoorSystem } from '../src/arch/doors';
import { nonPeriodChars, findModernWords } from '../src/lang/modern';
import { PROP_NOTES, propGeometry } from '../src/people/props';
import { writingReading, TRANSLATION_STATUS } from '../src/ui/translation';
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
  it('every seal names a text; every written object names a published text or is flagged (placeholder, or its text not visible)', () => {
    for (const [id, s] of Object.entries(WRITING.seals)) { expect(WRITING.texts[s.text], id).toBeTruthy(); expect(s.tier).toBe('C'); expect(s.design).toMatch(/^C/); expect(s.wording).toMatch(/^C/); }
    for (const [id, o] of Object.entries(WRITING.objects)) {
      if (o.text) expect(WRITING.texts[o.text], id).toBeTruthy();
      else expect(o.placeholder || o.text_visible === false, `${id}: no text and neither a placeholder nor hidden`).toBe(true);
      if (o.placeholder) expect(String(o.placeholder_why ?? '')).toMatch(/B18/);
      if (o.seal) expect(WRITING.seals[o.seal], id).toBeTruthy();
      for (const k of o.src) expect(JSON.parse(readFileSync('src/data/sources.json', 'utf8'))[k], `${id}: source ${k}`).toBeTruthy();
    }
    expect(WRITING.objects.pt_letter.placeholder, 'no PT text is reachable: the tablets are placeholders (B18)').toBe(true);
  });
});

describe('writing on objects: the relief and its honesty', () => {
  it('without the fonts the seal inscriptions are not impressed, and the sealing says so (placeholder)', () => {
    const a = rebakeWritingAtlas(); expect(a.baked.glyphs).toBe(false); expect(a.baked.texts).toEqual([]);
    const m = writtenMeta('door_sealing', 'door'); const d = (m.describe as () => any)();
    expect(d.placeholder).toBe(true); expect(d.note).toMatch(/NOT impressed/);
  });
  it('with the fonts: the signs drawn are exactly the seal texts, whole, and the sealing claims its impression', async () => {
    await loadWritingFonts(fontFetch);
    const a = rebakeWritingAtlas(); expect(a.baked.glyphs).toBe(true);
    expect(a.baked.texts.sort()).toEqual(['SDa', 'XSeal']);
    // the stream is a concatenation of whole seal texts (each turn of a roll draws its seal's whole text)
    const whole = Object.fromEntries(Object.values(WRITING.seals).map(s => { const T = WRITING.texts[s.text]; return [s.text, (T.op_cuneiform + (T.el_cuneiform ?? '') + (T.bab_cuneiform ?? '')).replace(/\s+/g, '')]; }));
    let s = a.baked.signs, n = 0; while (s.length) { const hit = Object.values(whole).find(t => s.startsWith(t)); expect(hit, `signs drawn: ${s.slice(0, 12)}…`).toBeTruthy(); s = s.slice(hit!.length); n++; }
    expect(n).toBeGreaterThanOrEqual(2);
    const d = ((writtenMeta('door_sealing', 'door').describe as () => any)());
    expect(d.placeholder).toBe(false); expect(d.note).toMatch(/impressed/); expect(d.note).not.toMatch(/NOT impressed/);
    const t = ((writtenMeta('pt_letter', 'tablet').describe as () => any)()); expect(t.placeholder, 'the tablets stay placeholders: their text is not a published text').toBe(true);
  });
  it('the impressions are relief in the height field, measured: wedges on the faces, the seal band, the door sealing\'s inscription panel', () => {
    const rms = (id: keyof typeof REGIONS, box?: [number, number, number, number]) => reliefRms(id, box);
    expect(rms('obv_full', [5, 5, 60, 40])).toBeGreaterThan(0.06); // wedge impressions (mm)
    expect(rms('obv_part', [5, 45, 80, 60]), 'the unfinished tablet is blank below its last line').toBeLessThan(0.08);
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
    for (const n of ['scribes:tablets_filed', 'scribes:tablets_fresh', 'scribes:tablet_unfinished']) { const o = g.getObjectByName(n)!; expect(o.userData.writing, n).toBe('pt_letter'); expect(o.userData.text).toBe('—'); expect(o.userData.placeholder, n).toBe(true); expect(((o as THREE.Mesh).material as any).normalMap, n).toBe(writingAtlas().texture); }
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
    expect(PROP_NOTES.tablet.note).toMatch(/pt_letter/); expect(PROP_NOTES.tablet.note).toMatch(/PLACEHOLDER/);
    expect(ptTabletGeometry('full', 2).index!.count / 3).toBeLessThanOrEqual(40);
  });
  it('the translation layer shows the text id and transliteration, no translation; the placeholder is said', () => {
    const d = writingReading('door_sealing')!; const all = d.lines.join('\n');
    expect(all).toMatch(/ARIo Q009270/); expect(all).toMatch(/adam Xšayaṛšā xšāyaθiya/); expect(d.lines).toContain(TRANSLATION_STATUS);
    const p = writingReading('pt_letter')!.lines.join('\n'); expect(p).toMatch(/placeholder/); expect(p).toMatch(/ARIo Q007203/); expect(p).toMatch(/DIŠ\.u₂/);
    // nothing but ids, transliterations, sources and status: no English gloss of the seal texts (B17a)
    for (const w of ['I am', 'I, Darius', 'the great king']) { expect(all.includes(w)).toBe(false); }
  });
  it('the transliterations stored contain no modern word', () => {
    for (const [id, t] of Object.entries(WRITING.texts)) for (const f of ['op_translit', 'el_atf', 'bab_atf'] as const) if (t[f]) expect(findModernWords(t[f]!), `${id}.${f}`).toEqual([]);
  });
});
