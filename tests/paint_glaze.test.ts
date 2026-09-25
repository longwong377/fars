// D-214 (gap audit items 28 and 29): the Apadana's glazed-brick frieze (apadana.r_glazed_frieze), the Treasury shafts' paint
// (treasury.r_shaft_paint, Q-020) and the guards' robe pattern on the reliefs (polychromy.json paint.robe_pattern); all C.
// Measured: where the frieze stands and what it is made of, that the paint's shader builds and replaces the placeholder,
// and that the pattern lands on the guards' robes and nowhere else.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { buildGlazedFrieze, friezeFaces } from '../src/arch/glazed';
import { reliefLodMesh } from '../src/arch/reliefs';
import { v } from '../src/arch/spec';
import { labToLinear } from '../src/core/colour';
import type { Box } from '../src/arch/parts';
import PC from '../src/data/polychromy.json';
import { installProbeLight } from '../src/render/probes/runtime';

let B: ReturnType<typeof buildTerrace>;
beforeAll(() => { B = buildTerrace(); }, 120_000);
const lin = (s: number[]) => { const c = new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };

describe('the Apadana\'s glazed-brick frieze (apadana.r_glazed_frieze)', () => {
  it('one band on every outer face of the four corner towers, under their tops and above the portico roofs, of the glazes found at Persepolis', () => {
    const F = v<any>('apadana', 'r_glazed_frieze'), faces = friezeFaces(B.parts), m = buildGlazedFrieze(B.parts)!;
    const towers = B.parts.filter(p => p.building === 'apadana' && p.kind === 'tower') as Box[];
    expect(towers.length).toBe(4); expect(faces.length).toBe(16);
    for (const f of faces) { const t = towers.find(q => `${q.c[1] > 0 ? 'N' : 'S'}${q.c[0] > 0 ? 'E' : 'W'}` === f.tower)!; expect(f.y1).toBeCloseTo(t.y1 - F.top_below, 6); expect(f.y1 - f.y0).toBeCloseTo(F.courses * F.course, 6); }
    const roofTop = Math.max(...(B.parts.filter(p => p.building === 'apadana' && p.kind === 'roof') as Box[]).map(r => r.y1));
    expect(Math.min(...faces.map(f => f.y0)), 'the band clears the portico roofs').toBeGreaterThan(roofTop);
    // every vertex on a tower face: outside the tower by at most the band's projection and the rosettes' relief
    const pos = m.geometry.getAttribute('position'), reach = F.proud + F.relief + 0.004;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), n = -pos.getZ(i);
      const out = Math.min(...towers.map(t => Math.max(Math.abs(x - t.c[0]) - t.size[0] / 2, Math.abs(n - t.c[1]) - t.size[1] / 2)));
      expect(out).toBeGreaterThan(-1e-6); expect(out).toBeLessThan(reach + F.proud);
      expect(y).toBeGreaterThanOrEqual(Math.min(...faces.map(f => f.y0)) - 1e-6); expect(y).toBeLessThanOrEqual(Math.max(...faces.map(f => f.y1)) + 1e-6);
    }
    // the rosettes: centred at `pitch` along each face
    expect(m.userData.rosettes).toBe(faces.reduce((q, f) => q + Math.floor((f.length - F.rosette_d) / F.pitch) + 1, 0));
    // the colours are the three glazes of the row (green ground, yellow rosettes and borders, grey centres and lines)
    const want = [F.glaze.ground, F.glaze.figure, F.glaze.line].map(lin), col = m.geometry.getAttribute('color'), seen = new Set<number>();
    for (let i = 0; i < col.count; i++) { const k = want.findIndex(w => Math.abs(w[0] - col.getX(i)) + Math.abs(w[1] - col.getY(i)) + Math.abs(w[2] - col.getZ(i)) < 1e-6); expect(k, `vertex ${i}`).toBeGreaterThanOrEqual(0); seen.add(k); }
    expect(seen.size).toBe(3);
    // no figured panel, one draw, a small budget
    expect(m.userData.note).toMatch(/no figured panels/); expect(m.userData.tier).toBe('C');
    expect(pos.count / 3).toBeLessThan(20_000);
    console.log(`glazed frieze: ${faces.length} faces, ${m.userData.rosettes} rosettes, ${pos.count / 3} triangles, 1 draw`);
  });
});

describe('the Treasury shafts\' paint (treasury.r_shaft_paint, Q-020)', () => {
  it('the plastered shafts are drawn painted (no longer a placeholder), in the row\'s pigments, and the paint\'s shaders build', () => {
    const g = buildMeshes(B.parts.filter(p => p.building === 'treasury')), lod = g.group.children.find(o => o.name === 'treasury:columns:plaster') as any;
    expect(lod).toBeTruthy(); expect(lod.userData.placeholder).toBe(false); expect(lod.userData.note).toMatch(/D-214/);
    const mat = lod.levels[0].material; expect(mat.userData.note).toMatch(/Treasury shafts' paint/);
    const R = v<any>('treasury', 'r_shaft_paint'), order = (B.parts.find(p => p.building === 'treasury' && p.type === 'column') as any).order;
    for (const k of [R.ground, R.line, R.band]) expect((PC as any).pigment[k], k).toBeTruthy();
    // the bands at foot and head fit the shaft with the lattice between them
    const shaft = order.height - order.baseH - order.capitalH;
    expect(2 * (R.band_h + R.edge_w) + R.lozenge_h).toBeLessThan(shaft);
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const renderer: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(renderer); renderer.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun, sun.target);
    for (const im of lod.levels) { // (built on a plain mesh of the level's geometry: the pattern is in the column's own frame, instancing aside)
      const one = new THREE.Mesh(im.geometry, im.material), b = new (THREE as any).WGSLNodeBuilder(one, renderer); b.scene = scene; b.camera = camera; b.material = im.material; b.lightsNode = renderer.lighting.getNode(scene, camera); b.build();
      expect(b.fragmentShader).toMatch(/atan2?\(/);
    }
  });
});

describe('the guards\' robe pattern on the reliefs (polychromy.json paint.robe_pattern)', () => {
  it('white ringed dots on the long robe and a yellow-ochre border at the hem on the guards; none on a noble\'s robe', () => {
    const P = (PC as any).pigment, white = labToLinear(P.white.v[0], P.white.v[1], P.white.v[2]), ochre = labToLinear(P.yellow_ochre.v[0], P.yellow_ochre.v[1], P.yellow_ochre.v[2]);
    const count = (kind: string, seed: number, rgb: number[], y0: number, y1: number) => { const m = reliefLodMesh(kind, seed, 513, 0); let n = 0;
      for (let i = 0; i < m.verts; i++) { const x = m.pos[i * 3], y = m.pos[i * 3 + 1]; if (m.paint[i] <= 0 || y < y0 || y > y1 || Math.abs(x) > 0.09) continue;
        if (Math.abs(m.col[i * 3] - rgb[0]) + Math.abs(m.col[i * 3 + 1] - rgb[1]) + Math.abs(m.col[i * 3 + 2] - rgb[2]) < 2e-3) n++; } return n; };
    expect((PC as any).paint.robe_pattern.v.kinds).toEqual(['guard']);
    for (const s of [0, 1]) { expect(count('guard', s, white, 0.12, 0.45), `guard ${s}: dots on the robe`).toBeGreaterThan(20); expect(count('guard', s, ochre, 0.0, 0.08), `guard ${s}: the hem border`).toBeGreaterThan(5); }
    expect(count('persian', 0, white, 0.12, 0.45), 'a noble\'s robe stays plain').toBe(0);
    expect(count('servant', 0, white, 0.12, 0.45), 'a servant\'s stays plain').toBe(0);
  });
});
