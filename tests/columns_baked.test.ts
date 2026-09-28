// D-328 (BLENDER_PLAN rows 1 and 4): every turned and boxed member of every column, and every shaft, is drawn from a
// Blender-built model world-wide. What could pass while the intent fails, and is measured here: a member model that stands
// somewhere else than the procedural member (fitted to the wrong box, lying on its side), levels that are not the game's own
// triangles, a shaft tile whose map the game reads with other coordinates or tangents than the bake wrote it with (the
// relief would light from the wrong side or slide off the flutes), an order or a construction state for which no model
// exists (the class replaced "except" somewhere), and a column that draws a part twice or not at all.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
// @ts-ignore plain node module shared with the build
import { parseGLB, glbContent } from '../tools/blender/lib/glb.mjs';
// @ts-ignore plain node module shared with the build
import { readRegistry } from '../tools/blender/lib/inputs.mjs';
import { buildTerrace } from '../src/arch/terrace';
import { order } from '../src/arch/orders';
import { MEMBERS, MEMBER_REF, memberMesh, memberBox, orderMembers, columnMesh, shaftKind, shaftUV, shaftRows, shaftDrumH, SHAFT_TILE, protomeMesh, voluteMesh, type Lod } from '../src/arch/sculpt';
import { columnSeed, drumGeometry } from '../src/arch/column_models';
import { fitLevel } from '../src/render/models';
import type { Column } from '../src/arch/parts';

const REG = readRegistry(), MAN = JSON.parse(readFileSync('public/models/manifest.json', 'utf8'));
const cols = buildTerrace().parts.filter(p => p.type === 'column') as Column[];
const H100 = order('hall100', { base: 'bell', capital: 'bull' });

describe('the columns\' Blender-built parts (D-328)', () => {
  it('every column of the world: each of its members and its shaft has a registered, built model (580 columns; and every construction state of the Hall of 100 Columns)', () => {
    expect(cols.length).toBe(580);
    const need = new Map<string, number>();
    const count = (id: string) => need.set(id, (need.get(id) ?? 0) + 1);
    for (const c of cols) {
      for (const m of orderMembers(c.order)) if (m.startsWith('base_') || c.built >= 1) count(`column_${m}`);
      if (shaftRows(c.order, c.built, 0)) { const k = shaftKind(c.order, c.built); expect(k, `${c.building} shaft`).toBeTruthy(); count(`column_${k}`); }
    }
    for (const fl of [false, true]) for (let d = 1; d <= 9; d++) { const built = d / 9, k = shaftKind(H100, built, fl); expect(k).toBeTruthy(); count(`column_${k}`); }
    for (const id of need.keys()) { expect(REG.assets[id], `${id} registered`).toBeTruthy(); expect(MAN.assets[id], `${id} built`).toBeTruthy(); }
    expect([...need.keys()].sort()).toEqual(Object.keys(REG.assets).filter(k => k.startsWith('column_')).sort()); // and nothing registered that no column uses
  });
  for (const m of MEMBERS) describe(`column_${m}`, () => {
    const [b, opts] = MEMBER_REF[m], ref = order(b, opts), M = MAN.assets[`column_${m}`];
    it('its levels are the game\'s own member of the reference order (triangles; bounds within the Draco quantisation)', () => {
      const { json } = parseGLB(readFileSync(`public/${M.file}`));
      for (const lod of [0, 1] as Lod[]) {
        const pc = memberMesh(ref, m, lod)!, [lo, hi] = [0, 1].map(k => new THREE.Box3().setFromArray(pc.pos)[k ? 'max' : 'min'].toArray());
        expect(M.lods[lod].tris, `lod${lod}`).toBe(pc.idx.length / 3);
        const mesh = json.meshes.find((x: any) => x.name === `lod${lod}`), a = json.accessors[mesh.primitives[0].attributes.POSITION];
        const tol = 2e-4 * Math.max(...hi.map((x, k) => x - lo[k])) + 1e-4;
        for (let k = 0; k < 3; k++) { expect(Math.abs(a.min[k] - lo[k]), `lod${lod} min ${k}`).toBeLessThan(tol); expect(Math.abs(a.max[k] - hi[k]), `lod${lod} max ${k}`).toBeLessThan(tol); }
      }
    });
    it('fitted to every order that carries it, a level fills that order\'s member box exactly', () => {
      const orders = new Map(cols.filter(c => orderMembers(c.order).includes(m)).map(c => [JSON.stringify(c.order), c.order]));
      expect(orders.size).toBeGreaterThan(0);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(memberMesh(ref, m, 0)!.pos, 3));
      for (const o of orders.values()) {
        const [lo, hi] = memberBox(o, m)!, f = fitLevel(g, lo, hi); f.computeBoundingBox();
        expect(f.boundingBox!.min.toArray().map(x => +x.toFixed(4))).toEqual(lo.map(x => +x.toFixed(4)));
        expect(f.boundingBox!.max.toArray().map(x => +x.toFixed(4))).toEqual(hi.map(x => +x.toFixed(4)));
      }
    });
  });
  it('a column without its modelled parts plus those parts is the whole column (nothing drawn twice or dropped), every order and LOD', () => {
    const orders = new Map(cols.map(c => [`${JSON.stringify(c.order)}|${c.built}`, c]));
    for (const c of orders.values()) for (const lod of [0, 1] as Lod[]) {
      const o = c.order, whole = columnMesh(o, c.built, lod).idx.length / 3, omit: Record<string, boolean> = { shaft: true };
      let parts = 0;
      for (const m of orderMembers(o)) if (m.startsWith('base_') || c.built >= 1) { omit[m] = true; parts += memberMesh(o, m, lod)!.idx.length / 3; }
      const sh = shaftUV(o, c.built, lod); if (sh) parts += sh.idx.length / 3;
      const rest = columnMesh(o, c.built, lod, { omit }).idx.length / 3;
      expect(rest + parts, `${o.id} built ${c.built} lod ${lod}`).toBe(whole);
      // what is left is the protome and the volute member (their own models, D-305/D-306) or nothing
      const pv = c.built >= 1 ? (protomeMesh(o, lod)?.idx.length ?? 0) / 3 + (voluteMesh(o, lod)?.idx.length ?? 0) / 3 : 0;
      expect(rest, `${o.id} rest`).toBe(pv);
    }
  });
});

describe('the shaft tiles: the game reads each map as the bake wrote it (D-328)', () => {
  it('shaftUV: same triangles as the procedural shaft, u = angle / 2pi, v = height over three drums, tangent = d/du (w = +1)', () => {
    for (const [o, built] of [[order('apadana', { base: 'bell', capital: 'composite' }), 1], [H100, 1], [H100, 0.44], [order('treasury', { base: 'square2', capital: 'plain', material: 'timber' }), 1]] as const) {
      for (const lod of [0, 1] as Lod[]) {
        const m = shaftUV(o, built, lod)!, vt = SHAFT_TILE.drums * shaftDrumH(o);
        expect(m.idx.length).toBe(columnMesh(o, built, lod, { omit: { base_bell: true, base_square2: true, base_plain: true }, capital: false }).idx.length);
        for (let v = 0; v < m.pos.length / 3; v++) {
          const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2]; if (Math.hypot(x, z) < 1e-3) continue; // cap centres
          const cap = Math.abs(m.nrm[v * 3 + 1]) > 0.99; if (cap) continue;
          const th = Math.atan2(z, x), u = m.uv[v * 2]; let du = u - ((th / (2 * Math.PI) + 1) % 1); du -= Math.round(du);
          expect(Math.abs(du)).toBeLessThan(1e-4);
          expect(Math.abs(m.uv[v * 2 + 1] - (y - o.baseH) / vt)).toBeLessThan(1e-4);
          const t = [m.tan[v * 4], m.tan[v * 4 + 1], m.tan[v * 4 + 2]]; expect(t[0] * -Math.sin(th) + t[2] * Math.cos(th)).toBeGreaterThan(0.95); expect(m.tan[v * 4 + 3]).toBe(1);
        }
      }
    }
  });
  for (const k of ['shaft_f48', 'shaft_f40', 'shaft_drums', 'shaft_plaster']) it(`column_${k}: the tile's GLB carries the same coordinate frame (its decoded UVs and MikkTSpace tangents agree with the analytic ones)`, async () => {
    const buf = readFileSync(`public/models/column_${k}.glb`), { json } = parseGLB(buf), C = await glbContent(buf);
    for (const lod of [0, 1]) {
      const mesh = json.meshes.find((x: any) => x.name === `lod${lod}`), names = Object.keys(mesh.primitives[0].extensions.KHR_draco_mesh_compression.attributes);
      const g = C.geo.find((x: any) => x.mesh === `lod${lod}`), at = (n: string) => g.parts[names.indexOf(n)] as Float32Array;
      const P = at('POSITION'), U = at('TEXCOORD_0'), T = at('TANGENT'), N = at('NORMAL');
      let ymin = Infinity, ymax = -Infinity; for (let v = 0; v < P.length / 3; v++) { ymin = Math.min(ymin, P[v * 3 + 1]); ymax = Math.max(ymax, P[v * 3 + 1]); }
      let worstU = 0, worstV = 0, worstT = 1, sign = 0;
      for (let v = 0; v < P.length / 3; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], th = Math.atan2(z, x);
        let du = U[v * 2] - ((th / (2 * Math.PI) + 1) % 1); du -= Math.round(du); worstU = Math.max(worstU, Math.abs(du));
        worstV = Math.max(worstV, Math.abs(U[v * 2 + 1] - (y - ymin) / (ymax - ymin)));
        const tx = -Math.sin(th), tz = Math.cos(th); worstT = Math.min(worstT, T[v * 4] * tx + T[v * 4 + 2] * tz); sign += T[v * 4 + 3];
        void N;
      }
      expect(worstU, `lod${lod} u`).toBeLessThan(2e-3); expect(worstV, `lod${lod} v`).toBeLessThan(2e-3);
      expect(worstT, `lod${lod} tangent along d/du`).toBeGreaterThan(0.95); expect(sign / (P.length / 3), `lod${lod} handedness +1`).toBeGreaterThan(0.99);
    }
  });
  it('the per-column tile offset is whole flutes and whole drums, and deterministic', () => {
    for (const [x, z] of [[1, 2], [-40.5, 17.25], [100, -3]]) {
      const [a, b] = columnSeed(x, z, 48); expect(Math.abs(a * 48 - Math.round(a * 48))).toBeLessThan(1e-9); expect(Math.abs(b * 3 - Math.round(b * 3))).toBeLessThan(1e-9);
      expect(columnSeed(x, z, 48)).toEqual([a, b]);
    }
    const s = new Set(cols.filter(c => c.building === 'apadana').map(c => columnSeed(c.c[0], c.c[1], 48).join(','))); expect(s.size).toBeGreaterThan(20);
  });
  it('the yard\'s dressed drums carry the drum tile\'s frame (u round, v up, tangent d/du, their seed)', () => {
    const g = drumGeometry(0.58, 1.15, 24, [3, 0, -4], [0.25, 1 / 3], 3.45), P = g.getAttribute('position'), U = g.getAttribute('uv'), T = g.getAttribute('tangent'), S = g.getAttribute('colSeed');
    for (let i = 0; i < 50; i++) { const th = Math.atan2(P.getZ(i) + 4, P.getX(i) - 3); let du = U.getX(i) - ((th / (2 * Math.PI) + 1) % 1); du -= Math.round(du); expect(Math.abs(du)).toBeLessThan(1e-5); expect(T.getX(i) * -Math.sin(th) + T.getZ(i) * Math.cos(th)).toBeGreaterThan(0.999); expect(S.getX(i)).toBe(0.25); }
  });
});
