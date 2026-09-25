// The royal inscriptions on the Terrace (Phase 8 review lens A, M5 and M6; D-177; src/data/royal_inscriptions.json): which texts stand where in 467, in all
// their versions, and how they are carved (incised into the host stone, not raised on it).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs, inscriptionAtlas, hostFace } from '../src/arch/decor';
import { atlasDepthEm } from '../src/arch/carving';
import { v } from '../src/arch/spec';
import { INSCRIPTION_INFO } from '../src/ui/translation';
import programme from '../src/data/royal_inscriptions.json';
import chronology from '../src/data/chronology.json';
import { installProbeLight } from '../src/render/probes/runtime';

let B: ReturnType<typeof buildTerrace>, g: THREE.Group;
beforeAll(async () => {
  await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
  B = buildTerrace(); g = buildInscriptions(B.manifest, B.parts, buildPhase4Reliefs(B.doorways).inscriptions); g.updateMatrixWorld(true);
}, 120_000);
const carved = () => g.children.filter(c => c.name.startsWith('inscription:') && !c.name.endsWith(':pick')) as THREE.Mesh[];
// copies carved: a mesh carries one (a flat field) or several (the column-base rings of D-214: one mesh per text and version)
const count = (id: string, ver: string) => carved().filter(m => m.name === `inscription:${id}:${ver}`).reduce((n, m) => n + ((m.userData.carved as any[])?.length ?? 1), 0);

describe('the royal inscriptions standing on the Terrace in 467 are carved, in all their versions (M5)', () => {
  it('each text is carved as often and in as many versions as its placement row says', () => {
    // the programme's carved rows (src/data/royal_inscriptions.json; XPa: one trilingual above each colossus, Q-289)
    const want: [string, string, number][] = (programme.carved as any[]).filter(c => !c.id.startsWith('DN')).flatMap(c => Object.entries(c.versions as Record<string, number>).map(([ver, n]) => [c.id, ver, n] as [string, string, number]));
    expect(want.length).toBe(38); // D-214: + XPg (op), XPk, XPj, XPm (three versions each)
    // nothing carved that the programme does not list
    for (const m of carved()) expect(want.some(([id, ver]) => m.name === `inscription:${id}:${ver}`), m.name).toBe(true);
    for (const [id, ver, n] of want) expect(count(id, ver), `${id} ${ver}`).toBe(n);
    for (const m of carved()) expect(g.getObjectByName(m.name + ':pick'), m.name).toBeTruthy();
  });
  it('every carved text stands on a building present in 467 and is named in the translation layer', () => {
    const where: Record<string, string[]> = { XPa: ['gate_nations'], XPb: ['apadana'], XPg: ['apadana'], XPc: ['tachara'], XPd: ['hadish'], XPe: ['hadish'], XPk: ['hadish'], XPj: ['hadish'], XPm: ['hadish'],
      DPa: ['tachara'], DPb: ['hadish', 'tachara'], DPc: ['tachara'], DPd: ['terrace'], DPe: ['terrace'], DPf: ['terrace'], DPg: ['terrace'] };
    for (const id of new Set(carved().map(m => m.userData.inscription as string))) {
      expect(where[id], id).toBeTruthy();
      for (const b of where[id]) expect((chronology as any).structures.find((s: any) => s.id === b)?.present, `${id}: ${b} in 467`).toBe(true);
      expect(INSCRIPTION_INFO[id], `${id} in the translation layer`).toBeTruthy();
    }
  });
  it('DPd-DPg stand on the south face of the Terrace wall, below the court; DPc on the window cornices', () => {
    const S = v<any>('terrace', 'r_south_wall_inscriptions');
    for (const id of S.texts) {
      const m = carved().find(q => q.userData.inscription === id)!, b = new THREE.Box3().setFromObject(m), n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
      expect(n.z, `${id} faces grid south`).toBeGreaterThan(0.95); // world +z = grid south
      expect(b.max.y, id).toBeLessThan(0); expect(b.min.y, id).toBeGreaterThan(-S.top_below_court - S.height - 0.4);
      expect(-b.getCenter(new THREE.Vector3()).z, `${id} on the S edge`).toBeLessThan(-230);
    }
    const frames = B.parts.filter((p: any) => p.building === 'tachara' && p.kind === 'window_frame') as any[], top = Math.max(...frames.map(f => f.y1));
    for (const m of carved().filter(q => q.userData.inscription === 'DPc')) { const b = new THREE.Box3().setFromObject(m); expect(b.max.y).toBeLessThanOrEqual(top + 0.03); expect(b.min.y).toBeGreaterThan(top - 0.4); }
  });
});

describe('the signs are cut into the stone, not raised on it (M6)', () => {
  it('every sign lies on its host face (within 1 mm), in the host stone\'s own material', () => {
    // (the garment lines and the column-base rings of D-214 follow a carved or curved surface: tested in their own block)
    for (const m of carved().filter(q => !q.userData.garment && !q.userData.ring)) {
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
      let zmax = 0; for (let i = 0; i < pos.count; i++) zmax = Math.max(zmax, Math.abs(pos.getZ(i)));
      expect(zmax, `${m.name}: quads off the face`).toBeLessThanOrEqual(0.001);
      expect(['limestone', 'limestone_carved', 'limestone_dark', 'terrace'], `${m.name} host`).toContain(m.userData.host);
      const mat = m.material as any; expect(mat.opacityNode && mat.normalNode && mat.aoNode, `${m.name}: incised material`).toBeTruthy();
      expect(mat.userData.note, m.name).toMatch(new RegExp(`incised signs in ${m.userData.host}`));
      expect(m.castShadow, m.name).toBe(false);
    }
  });
  it('snapped panels sit on the face of the box they are carved on (no gap, nothing proud)', () => {
    const snapped = carved().filter(q => q.userData.snapped);
    expect(snapped.length).toBeGreaterThanOrEqual(24); // XPb 6, XPc 3, XPd 3, XPe 12, DPa 6, DPb 6 (the D-214 fields stand on their own stones: tested below)
    for (const m of snapped) {
      const o = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld), X = new THREE.Vector3(1, 0, 0).transformDirection(m.matrixWorld);
      const c = o.clone().addScaledVector(X, 0.3).addScaledVector(new THREE.Vector3(0, 1, 0), -0.1); // a point inside the field
      const h = hostFace(B.parts, [c.x, -c.z], c.y, [Math.round(n.x), Math.round(-n.z)] as any, 0.05);
      expect(h, m.name).toBeTruthy(); expect(Math.abs(h!.d), m.name).toBeLessThan(0.002);
    }
  });
  it('the cut is a V-section at 45°: depth 0 outside the outline, rising at most one unit per unit inward, deepest inside', () => {
    for (const font of ['op', 'cun'] as const) {
      const A = inscriptionAtlas(font);
      for (const [ch, c] of [...A.cells].slice(0, 40)) {
        if (!c.w) continue;
        // outside the sign's bounding box (in the margin) nothing is cut
        expect(atlasDepthEm(A, ch, c.ox + 0.5 / A.tpe, c.oy + 0.5 / A.tpe), ch).toBe(0);
        // the depth field is 1-Lipschitz (walls at 45°) up to the 8-bit step and half a texel
        const q = A.maxDepthEm / 255, step = 1 / A.tpe;
        for (let r = 1; r < c.h - 1; r += 3) for (let k = 1; k < c.w - 1; k += 3) {
          const x = c.ox + (k + 0.5) / A.tpe, y = c.oy + (r + 0.5) / A.tpe, d = atlasDepthEm(A, ch, x, y);
          expect(Math.abs(atlasDepthEm(A, ch, x + step, y) - d), ch).toBeLessThanOrEqual(step * 1.5 + 2 * q);
        }
        expect(c.maxDepthEm, ch).toBeGreaterThan(0.01);
      }
    }
  });
  it('the cut is lit as a cut, not as a raised sign: with a low sun on one side the far wall of each stroke is lit and the near wall shaded (incision.ts\'s wall normal, from the atlas)', () => {
    // incision.ts: n = normalize(T·∂d/∂x + B·∂d/∂y + N), d = the depth INTO the stone; a raised sign (height h OUT of the
    // stone, n = (−∂h/∂x, …)) would tilt the other way and light the near wall instead. Sun low from −x: L = (−0.8, 0, 0.6)
    const L = [-0.8, 0, 0.6];
    let checked = 0;
    for (const font of ['op', 'cun'] as const) {
      const A = inscriptionAtlas(font);
      for (const [ch, c] of [...A.cells].slice(0, 30)) {
        if (!c.w) continue;
        // along the row through the cell's middle: the first and last cut texels are a stroke's near (−x) and far (+x) walls
        const y = c.oy + (Math.floor(c.h / 2) + 0.5) / A.tpe, xs: number[] = [];
        for (let k = 1; k < c.w - 1; k++) { const x = c.ox + (k + 0.5) / A.tpe; if (atlasDepthEm(A, ch, x, y) > (2 * A.maxDepthEm) / 255) xs.push(x); }
        if (xs.length < 6) continue;
        const e = 1 / A.tpe, depth = (x: number, yy = y) => atlasDepthEm(A, ch, x, yy);
        const lit = (x: number) => { const gx = (depth(x + e) - depth(x - e)) / (2 * e), gy = (depth(x, y + e) - depth(x, y - e)) / (2 * e); return (gx * L[0] + gy * L[1] + L[2]) / Math.hypot(gx, gy, 1); };
        expect(lit(xs[xs.length - 1] - e), `${font} ${ch}: the wall facing the sun (the stroke's far side) is lit more than the near wall`).toBeGreaterThan(lit(xs[0] + e));
        expect(depth(xs[0]), `${font} ${ch}: the cut deepens inward from its edge`).toBeGreaterThan(depth(xs[0] - 2 * e));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('the cut depths are millimetres, stated in each panel\'s note (C)', () => {
    expect(g.userData.note, 'every carved text fits its field in its own lines').not.toMatch(/DOES NOT FIT/);
    // a garment line's signs are under a centimetre (D-214), so its cut is under a millimetre deep
    for (const m of carved()) { expect(m.userData.depth, m.name).toBeGreaterThan(m.userData.garment ? 0.0005 : 0.0015); expect(m.userData.depth, m.name).toBeLessThan(0.015); expect(m.userData.note, m.name).toMatch(/V-section at 45°, deepest [\d.]+ mm/); }
    console.log(g.userData.note);
  });
  it('the dev overlay says what the Old Persian signs rest on: the published sign sequence, word for word (B)', () => {
    for (const m of carved().filter(q => q.userData.version === 'op')) {
      expect(m.userData.note, m.name).not.toMatch(/signs by Kent rules — C/);
      expect(m.userData.note, m.name).toMatch(/the published sign-by-sign edition \(ORACC ARIo in CATF.*\d+ words sign for sign with their dividers \(A\)/);
      expect(m.userData.tier, m.name).toBe('B'); expect(m.userData.src, m.name).toMatch(/ARIO-CATF/);
    }
  });
  it('the programme\'s gaps are flagged: every copy standing in 467 and not carved is listed, with why, in the dev overlay data (A-M5)', () => {
    const miss = programme.missing as any[];
    // D-214 carved the anta copies of XPc and XPd, the garment lines DPb and XPk, XPj and XPm and XPg's plaque; what is left is
    // XPg on glazed bricks and the Naqsh-e Rustam versions and captions not in the corpus or not placed
    expect(miss.map(m => m.id)).toEqual(['XPg', 'DNa', 'DNb', 'DNc, DNd, DNe']);
    for (const m of miss) { expect(m.why.length, m.id).toBeGreaterThan(20); expect(m.q, m.id).toBe('Q-290'); }
    expect(g.userData.placeholder).toBe(true); expect(g.userData.missing.length).toBe(miss.length);
    expect(g.userData.summary).toMatch(/NOT carved \[PLACEHOLDER: Q-290/);
    // a carved text with copies not carved says so on its panels (XPg: its glazed bricks); the texts whose every copy is now
    // carved say nothing of the kind
    for (const m of carved().filter(q => q.userData.inscription === 'XPg')) expect(m.userData.note, m.name).toMatch(/NOT carved \(Q-290\).*glazed bricks/);
    for (const id of ['XPc', 'XPd', 'DPb', 'XPk', 'XPj', 'XPm']) for (const m of carved().filter(q => q.userData.inscription === id)) expect(m.userData.note, m.name).not.toMatch(/NOT carved/);
    // every id the layer can name is in the programme (carved, missing or hidden)
    const ids = new Set([...programme.carved, ...programme.missing, ...programme.hidden].flatMap((r: any) => String(r.id).split(/,\s*/)));
    for (const id of Object.keys(INSCRIPTION_INFO)) expect(ids.has(id), id).toBe(true);
  });
});

describe('the incised material generates its shaders (WGSL, node; as tests/shader_build.test.ts)', () => {
  it('every host stone × script the carving uses builds a vertex and a fragment shader with the depth march', () => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const renderer: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(renderer); renderer.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun, sun.target);
    const seen = new Set<any>(), fails: string[] = [];
    for (const m of carved()) {
      if (seen.has(m.material)) continue; seen.add(m.material);
      try {
        const b = new (THREE as any).WGSLNodeBuilder(m, renderer); b.scene = scene; b.camera = camera; b.material = m.material; b.lightsNode = renderer.lighting.getNode(scene, camera); b.build();
        if (!b.fragmentShader || !/carveUV|nodeVarying/.test(b.vertexShader + b.fragmentShader)) fails.push(`${m.name}: no carving in the shader`);
      } catch (e: any) { fails.push(`${m.name}: ${String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`); }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5); // limestone_carved, limestone, limestone_dark (op, cun), terrace
    expect(fails).toEqual([]);
  });
});
