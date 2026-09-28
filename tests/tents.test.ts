// D-330: the court camps' tents as pitched cloth (src/world/tentForms.ts, courtCamps.ts; tools/blender/decor.mjs tents):
// the forms are closed where held and rigged to the ground; every tent of every camp takes the instanced levels; what is drawn
// stays in budget at the densest viewpoint, and the far level stays the ≤ 20-triangle shell of D-199.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { tentForm, panelAt } from '../src/world/tentForms';
import { CourtCampTents, shellGeometry, rigGeometry, TENT_LOD } from '../src/world/courtCamps';
import { TENT_KINDS, CAMPS, type Tent, type TentKind } from '../src/people/camps';
import { setDecorForTest } from '../src/render/decorAssets';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim } from '../src/people/sim';
import META from '../src/data/decor_assets.json';

const KINDS = Object.keys(TENT_KINDS) as TentKind[];
let tents: Tent[] = [];
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  tents = new PeopleSim(1, nav, () => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 }) as any, { court: true }).pop.court!.tents;
}, 180_000);
/** a stand-in level with `n` triangles (the node tests load no GLB) */
const levelOf = (n: number) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 9), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 9), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 2)); return g; };
describe('tent forms (D-330)', () => {
  for (const kind of KINDS) it(`${kind}: its poles stand on the ground, its ropes run from the cloth to pegs on the ground, its panels hold at their pins`, () => {
    const F = tentForm(kind), K = TENT_KINDS[kind];
    expect(F.poles.length).toBeGreaterThan(1); for (const p of F.poles) { expect(Math.min(p.a[1], p.b[1])).toBeGreaterThanOrEqual(0); expect(Math.max(p.a[1], p.b[1])).toBeLessThanOrEqual(K.h + 1e-6); }
    expect(F.ropes.length).toBeGreaterThan(4); for (const r of F.ropes) { expect(r.b[1]).toBe(0); expect(r.a[1]).toBeGreaterThan(0.3); expect(F.pegs.some(g => Math.hypot(g[0] - r.b[0], g[2] - r.b[2]) < 1e-6)).toBe(true); }
    for (const P of F.panels) for (const [s, t] of P.pins) { const q = panelAt(kind, P.id, s, t); expect(Math.abs(q[0])).toBeLessThanOrEqual(K.w / 2 + 1e-6); expect(Math.abs(q[2])).toBeLessThanOrEqual(K.d / 2 + 1e-6); expect(q[1]).toBeGreaterThanOrEqual(0); expect(q[1]).toBeLessThanOrEqual(K.h + 1e-6); }
  });
  it('the far level is the D-199 shell (≤ 20 triangles) and the rigs are modest', () => {
    for (const kind of KINDS) { const s = shellGeometry(kind); expect((s.index ? s.index.count : s.getAttribute('position').count) / 3).toBeLessThanOrEqual(20);
      expect(rigGeometry(kind, 0).getAttribute('position').count / 3).toBeLessThan(1500); expect(rigGeometry(kind, 1).getAttribute('position').count / 3).toBeLessThan(200); }
  });
});
describe('the camps drawn from the models (D-330)', () => {
  it('every tent of every camp in the instanced levels; near a camp\'s centre the modelled levels, within the triangle budget; far, the shells', () => {
    const L = (META as any).assets.tents?.lods as Record<string, Record<string, { tris: number }>> | undefined;
    const tris = (k: TentKind, l: number) => L?.[k]?.[`lod${l}`]?.tris ?? [1600, 320][l];
    const tex = new THREE.DataTexture(new Uint8Array(64).fill(128), 4, 4);
    setDecorForTest({ tents: Object.fromEntries(KINDS.map(k => [k, { lods: [levelOf(tris(k, 0)), levelOf(tris(k, 1))], maps: [tex, tex], names: ['lod0', 'lod1'] }])) });
    try {
      const C = new CourtCampTents(tents, () => 1600); C.setTime(NaN);
      expect(C.info.tents).toBe(tents.length); expect(C.info.modelled.sort()).toEqual([...KINDS].sort()); expect(C.info.tris / C.info.tents).toBeLessThanOrEqual(20); // (nobody near: every tent its shell)
      const rows: Record<string, unknown> = {}; let worst = 0;
      for (const c of CAMPS) { C.update(c.c[0], -c.c[1], 0); const b = C.info.byLevel; rows[c.id] = { lod0: b[0], lod1: b[1], shells: b[2], ktris: +(C.info.tris / 1e3).toFixed(1) };
        expect(b[0] + b[1] + b[2]).toBe(tents.length); worst = Math.max(worst, C.info.tris);
        const near = tents.filter(t => t.camp === c.id && Math.hypot(t.e - c.c[0], t.n - c.c[1]) < TENT_LOD.lod0 - TENT_LOD.hyst).length; expect(b[0]).toBeGreaterThanOrEqual(near); }
      console.log('tents drawn by camp centre:', JSON.stringify(rows));
      expect(worst, 'triangles drawn at the densest camp centre').toBeLessThan(400_000);
    } finally { setDecorForTest(null); }
  }, 120_000);
});
