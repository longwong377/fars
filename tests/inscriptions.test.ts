// The royal inscriptions on the Terrace (Phase 8 review lens A, M5 and M6; D-166): which texts stand where in 467, in all
// their versions, and how they are carved (incised into the host stone, not raised on it).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs, inscriptionAtlas, hostFace } from '../src/arch/decor';
import { atlasDepthEm } from '../src/arch/carving';
import { v } from '../src/arch/spec';
import { INSCRIPTION_INFO } from '../src/ui/translation';
import chronology from '../src/data/chronology.json';
import { installProbeLight } from '../src/render/probes/runtime';

let B: ReturnType<typeof buildTerrace>, g: THREE.Group;
beforeAll(async () => {
  await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
  B = buildTerrace(); g = buildInscriptions(B.manifest, B.parts, buildPhase4Reliefs(B.doorways).inscriptions); g.updateMatrixWorld(true);
}, 120_000);
const carved = () => g.children.filter(c => c.name.startsWith('inscription:') && !c.name.endsWith(':pick')) as THREE.Mesh[];
const count = (id: string, ver: string) => carved().filter(m => m.name === `inscription:${id}:${ver}`).length;

describe('the royal inscriptions standing on the Terrace in 467 are carved, in all their versions (M5)', () => {
  it('each text is carved as often and in as many versions as its placement row says', () => {
    const want: [string, string, number][] = [
      ['XPa', 'op', 4], ['XPa', 'el', 4], ['XPa', 'bab', 4], // one trilingual above each colossus (Q-282)
      ['XPb', 'op', 2], ['XPb', 'el', 2], ['XPb', 'bab', 2], // N and E stairs; OP on one panel, Bab and El on another
      ['XPc', 'op', 1], ['XPc', 'el', 1], ['XPc', 'bab', 1], ['XPd', 'op', 1], ['XPd', 'el', 1], ['XPd', 'bab', 1],
      ['XPe', 'op', 4], ['XPe', 'el', 4], ['XPe', 'bab', 4],
      ['DPa', 'op', 2], ['DPa', 'el', 2], ['DPa', 'bab', 2], ['DPb', 'op', 2], ['DPb', 'el', 2], ['DPb', 'bab', 2],
      ['DPc', 'op', 4], ['DPc', 'el', 4], ['DPc', 'bab', 4], // every window frame the model has
      ['DPd', 'op', 1], ['DPe', 'op', 1], ['DPf', 'el', 1], ['DPg', 'bab', 1],
    ];
    for (const [id, ver, n] of want) expect(count(id, ver), `${id} ${ver}`).toBe(n);
    for (const m of carved()) expect(g.getObjectByName(m.name + ':pick'), m.name).toBeTruthy();
  });
  it('every carved text stands on a building present in 467 and is named in the translation layer', () => {
    const where: Record<string, string> = { XPa: 'gate_nations', XPb: 'apadana', XPc: 'tachara', XPd: 'hadish', XPe: 'hadish', DPa: 'tachara', DPb: 'hadish', DPc: 'tachara', DPd: 'terrace', DPe: 'terrace', DPf: 'terrace', DPg: 'terrace' };
    for (const id of new Set(carved().map(m => m.userData.inscription as string))) {
      expect(where[id], id).toBeTruthy();
      expect((chronology as any).structures.find((s: any) => s.id === where[id])?.present, `${id}: ${where[id]} in 467`).toBe(true);
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
    for (const m of carved()) {
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
    for (const m of carved().filter(q => ['XPb', 'XPc', 'XPd', 'XPe', 'DPa', 'DPb'].includes(q.userData.inscription))) {
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
  it('the cut depths are millimetres, stated in each panel\'s note (C)', () => {
    for (const m of carved()) { expect(m.userData.depth, m.name).toBeGreaterThan(0.0015); expect(m.userData.depth, m.name).toBeLessThan(0.015); expect(m.userData.note, m.name).toMatch(/V-section at 45°, deepest [\d.]+ mm/); }
    console.log(g.userData.note);
  });
  it("the dev overlay says what the Old Persian signs rest on (no 'Kent rules — C' label for a text with Kent's copy)", () => {
    for (const m of carved().filter(q => q.userData.version === 'op')) {
      expect(m.userData.note, m.name).not.toMatch(/signs by Kent rules — C/);
      if (m.userData.inscription !== 'DPc') { expect(m.userData.note, m.name).toMatch(/= Kent's transliteration for \d+ of \d+ words \(B\)/); expect(m.userData.tier, m.name).toBe('B'); }
    }
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
