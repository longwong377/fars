// Session 12 (D-310): the CC0 scanned classes. Node cannot load the GLBs, so stand-in scans (boxes) are registered: the test
// checks the routing (every builder draws from the scans when they are loaded), the placements and the fitting, and that the
// committed manifest lists real files with their hashes.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { _setScanProp, scanShape, propsFor, type ScanProp } from '../src/render/scanProps';
import type { CellCtx } from '../src/world/smallLife';

const fake = (id: string, role: string, size: [number, number, number]): ScanProp => {
  const g = new THREE.BoxGeometry(...size).translate(0, size[1] / 2, 0); g.computeBoundingBox();
  return { id, entry: { file: '', role, licence: 'CC0 1.0', source: '', bytes: 0, sha256: '', srcTris: 12, tris: {}, size_m: size, tex: 512 }, lods: [g, g.clone()], map: null, normal: null, arm: null, mean: [0.5, 0.5, 0.5], size };
};
for (const [id, role, s] of [['stone_01', 'stone', [0.15, 0.07, 0.09]], ['rock_07', 'stone', [0.17, 0.14, 0.32]], ['namaqualand_boulder_02', 'boulder', [2.5, 0.9, 1.2]], ['rock_face_02', 'outcrop', [2.7, 2.5, 2.1]],
  ['shrub_03_v1', 'cushion', [0.2, 0.4, 0.15]], ['shrub_03_v2', 'cushion', [0.18, 0.35, 0.12]], ['nettle_plant_v1', 'thistle', [0.08, 0.13, 0.09]], ['ceramic_vase_01', 'jar', [0.2, 0.4, 0.2]], ['wicker_basket_01', 'basket', [0.38, 0.12, 0.3]]] as const)
  _setScanProp(fake(id, role, s as unknown as [number, number, number]));

const ctxAt = (e: number, n: number): CellCtx => e > 100 ? 'rock' : e > 0 ? 'steppe' : e > -100 ? 'field' : Math.abs(n) < 50 ? 'water' : 'none';

describe('CC0 scanned classes (D-310)', () => {
  it('loose rock: stones and boulders on rock and steppe, few in fields, none at the water; static', async () => {
    const { GroundRocks, ROCK_R } = await import('../src/world/groundRocks');
    const mk = () => new GroundRocks(3, { ground: () => 0, ctxAt } as any);
    const a = mk(); expect(a.active).toBe(true); a.update([180, 0]); const rock = { ...a.stats };
    a.update([50, 300]); const steppe = { ...a.stats }; a.update([-200, 0]); const water = { ...a.stats };
    expect(rock.stone).toBeGreaterThan(steppe.stone); expect(rock.boulder).toBeGreaterThan(steppe.boulder); expect(water.stone + water.boulder).toBeLessThan(steppe.stone);
    const b = mk(); a.update([180, 0]); b.update([180, 0]);
    a.slots.stone.forEach((S, i) => expect(Array.from(S.mesh.instanceMatrix.array.slice(0, S.mesh.count * 16))).toEqual(Array.from(b.slots.stone[i].mesh.instanceMatrix.array.slice(0, S.mesh.count * 16))));
    const M = new THREE.Matrix4(), p = new THREE.Vector3(); for (const S of a.slots.boulder) for (let i = 0; i < S.mesh.count; i++) { S.mesh.getMatrixAt(i, M); p.setFromMatrixPosition(M); expect(Math.hypot(p.x - 180, p.z)).toBeLessThanOrEqual(ROCK_R.boulder + 1e-6); }
    expect(a.slots.boulder.length).toBe(4); // two scans (boulder + outcrop) x two levels
  });
  it('ground flora: the scans carry every placement; the stand-ins hidden', async () => {
    const { GroundFlora } = await import('../src/world/groundFlora');
    const f = new GroundFlora(3, { ground: () => 0, ctxAt }); f.update(4, [180, 0]);
    for (const k of ['cushion', 'camelthorn', 'thistle'] as const) { const S = f.scan.get(k)!; expect(S).toBeTruthy(); expect(f.meshes.get(k)!.visible).toBe(false);
      expect(S.slots.reduce((s, m) => s + m.count, 0)).toBe(f.meshes.get(k)!.count); }
  });
  it('jars and baskets: the builders take the scan fitted to their own box', async () => {
    const { jarGeometry } = await import('../src/world/furnish'); const { propGeometry } = await import('../src/people/props');
    const j = jarGeometry(0.17, 0.55, 40, 1); j.computeBoundingBox(); const b = j.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(0.34, 5); expect(b.max.y - b.min.y).toBeCloseTo(0.55, 5); expect(b.min.y).toBeCloseTo(0, 5);
    expect(j.getAttribute('position').count).toBe(24); // the (box) scan's vertices, not the 40-segment lathe
    const pj = propGeometry('jar')!; expect(pj.getAttribute('position').count).toBe(36); // the box, non-indexed by paint()
    expect(scanShape('basket', 0, [0.36, 0.18, 0.36])).not.toBeNull(); expect(propsFor('boulder').length).toBe(1);
  });
  it('the committed manifest: every GLB exists with its recorded sha256, CC0, two levels', () => {
    const man = JSON.parse(readFileSync('public/models/props/manifest.json', 'utf8'));
    expect(Object.keys(man.assets).length).toBeGreaterThanOrEqual(40);
    for (const [id, a] of Object.entries<any>(man.assets)) {
      expect(existsSync('public/' + a.file), id).toBe(true); expect(a.licence).toBe('CC0 1.0');
      expect(createHash('sha256').update(readFileSync('public/' + a.file)).digest('hex')).toBe(a.sha256);
      expect(a.tris.lod1).toBeLessThanOrEqual(a.tris.lod0); if (!a.parts) expect(a.tris.lod0).toBeLessThanOrEqual(3000); // (a scan's budget; the modelled props, D-325, have their own: tests/model_props.test.ts)
    }
  });
});
