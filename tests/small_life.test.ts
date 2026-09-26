// Session 9 (WORLD_INVENTORY G42, G59-G62): the small life around the viewer and the bats at dusk. Closed-form in time
// (continuous, deterministic), gated by season, hour, rain and wind, placed by each cell's context; a lizard slips away when
// someone comes within 3 m.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { SmallLife, SMALL, CELL, FLOWERS, FLOWER_R, dartAt, smallAt, type CellCtx, type SmallPose } from '../src/world/smallLife';
import { bloomAt, MID_MONTH } from '../src/world/plain/seasonal';
import { BIRDS, batHours, batAt, SUNSET_BY_MONTH, type BirdPose } from '../src/world/wildlife';

// a test world: a midden at the origin, a canal edge along n = 40, rock E of e = 60, fields W of e = -40, steppe between
const ctxAt = (e: number, n: number): CellCtx => Math.hypot(e, n) < 6 ? 'midden' : Math.abs(n - 40) < 6 ? 'water' : e > 60 ? 'rock' : e < -40 ? 'field' : 'steppe';
const mk = () => new SmallLife(7, { ground: () => 0, ctxAt });
const counts = (s: SmallLife) => Object.fromEntries([...s.meshes].map(([k, m]) => [k, m.count]));

describe('the small life (session 9)', () => {
  it('in July at noon: flies at the midden, dragonflies at the water; no butterflies (their months are spring and autumn)', () => {
    const s = mk(); s.update(6, 12, 50000, [0, 20], 0, 2); const c = counts(s);
    expect(c.fly).toBeGreaterThanOrEqual(5); expect(c.dragonfly).toBeGreaterThan(0); expect(c.butterfly).toBe(0);
  });
  it('in April by day butterflies over field and steppe; rock agamas on rock; nothing by night, in January, in rain', () => {
    const s = mk(); s.update(3, 11, 1000, [0, 0], 0, 2); expect(counts(s).butterfly).toBeGreaterThan(0);
    s.update(3, 11, 1000, [80, 0], 0, 2); expect(counts(s).lizard).toBeGreaterThan(0);
    for (const [m, h, rain] of [[3, 23, 0], [0, 12, 0], [6, 12, 0.6]] as const) { s.update(m, h, 1000, [0, 20], rain, 2); expect(Object.values(counts(s)).reduce((a, b) => a + b, 0), `${m} ${h} ${rain}`).toBe(0); }
  });
  it('the insects keep to their context: every fly is within 8 m of the midden, every dragonfly over the water strip', () => {
    const s = mk(); s.update(6, 12, 777, [0, 20], 0, 2); const v = new THREE.Vector3(), M = new THREE.Matrix4();
    const f = s.meshes.get('fly')!; for (let i = 0; i < f.count; i++) { f.getMatrixAt(i, M); v.setFromMatrixPosition(M); expect(Math.hypot(v.x, v.z)).toBeLessThan(CELL + 2); expect(v.y).toBeGreaterThan(0.05); expect(v.y).toBeLessThan(0.6); }
    const d = s.meshes.get('dragonfly')!; for (let i = 0; i < d.count; i++) { d.getMatrixAt(i, M); v.setFromMatrixPosition(M); expect(Math.abs(-v.z - 40)).toBeLessThan(6 + CELL + 4); expect(v.y).toBeGreaterThan(0.4); expect(v.y).toBeLessThan(2.2); }
  });
  it('motion is continuous and deterministic in world time (no saved state)', () => {
    const a: SmallPose = { e: 0, n: 0, up: 0, heading: 0, flap: 0, visible: false }, b = { ...a };
    for (const k of Object.keys(SMALL) as (keyof typeof SMALL)[]) for (let t = 100; t < 160; t += 0.37) {
      smallAt(k, 3, 2, 5, 0, t, a); smallAt(k, 3, 2, 5, 0, t + 1 / 60, b);
      // top speeds (C): a fly's dart ~5 m/s, a dragonfly ~10 m/s, a butterfly ~4 m/s, an agama's dash ~3.5 m/s
      const vmax = { fly: 6, dragonfly: 11, butterfly: 4.5, lizard: 4 }[k];
      expect(Math.hypot(a.e - b.e, a.n - b.n) * 60, `${k} at ${t}`).toBeLessThan(vmax);
    }
    const s1 = mk(), s2 = mk(); s1.update(3, 11, 4321, [0, 0], 0, 2); s2.update(3, 11, 4321, [0, 0], 0, 2);
    expect(Array.from(s1.meshes.get('butterfly')!.instanceMatrix.array)).toEqual(Array.from(s2.meshes.get('butterfly')!.instanceMatrix.array));
    const d = dartAt(9, 10, 2, 3, 0.5); expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(3);
  });
  it('a lizard slips away when someone comes within 3 m, and stays gone for a while', () => {
    const s = mk(); s.update(5, 12, 2000, [100, 0], 0, 2); const n0 = counts(s).lizard; expect(n0).toBeGreaterThan(0);
    const M = new THREE.Matrix4(), v = new THREE.Vector3(); s.meshes.get('lizard')!.getMatrixAt(0, M); v.setFromMatrixPosition(M);
    s.update(5, 12, 2000.5, [v.x + 1, -v.z], 0, 2); s.update(5, 12, 2001, [100, 0], 0, 2);
    expect(counts(s).lizard).toBe(n0 - 1);
  });
  it('bats hunt from 20 minutes after sunset for two hours, Mar-Oct, 3-12 m up', () => {
    expect(BIRDS.bat.months).not.toContain(0); expect(BIRDS.bat.months).toContain(5);
    const [a, b] = batHours(5); expect(a).toBeCloseTo(SUNSET_BY_MONTH[5] + 0.33, 5); expect(b - a).toBeGreaterThan(1.5);
    expect(SUNSET_BY_MONTH[5] - SUNSET_BY_MONTH[11]).toBeGreaterThan(1.7); // June vs December at 30 N (C)
    const p: BirdPose = { pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false };
    for (let t = 0; t < 300; t += 1.3) { batAt([0, 0], 0, 11, t, p); expect(p.pos.y).toBeGreaterThan(1); expect(p.pos.y).toBeLessThan(12.5); expect(Math.hypot(p.pos.x, p.pos.z)).toBeLessThan(16); }
  });
  it('the spring flowers bloom by the calendar: violet and yellow in March, red in May, nothing in winter or summer (G71)', () => {
    const at = (m: number) => bloomAt(MID_MONTH[m]);
    expect(at(0)).toEqual({ violet: 0, yellow: 0, red: 0 }); expect(at(6)).toEqual({ violet: 0, yellow: 0, red: 0 });
    expect(at(2).violet).toBeGreaterThan(0.5); expect(at(2).yellow).toBeGreaterThan(0.5); expect(at(2).red).toBe(0);
    expect(at(4).red).toBeGreaterThan(0.5); expect(at(4).violet).toBe(0);
  });
  it('flowers near the walker in spring only, heads of the species colours, fewer in the fields (their verges) than on the steppe', () => {
    const s = mk(), ape = bloomAt(MID_MONTH[3]);
    s.update(3, 12, 1000, [0, 0], 0, 2, ape); const steppe = s.flowers.count; expect(steppe).toBeGreaterThan(20);
    s.update(3, 12, 1000, [-200, 0], 0, 2, ape); const field = s.flowers.count; expect(field).toBeLessThan(steppe);
    s.update(6, 12, 1000, [0, 0], 0, 2, bloomAt(MID_MONTH[6])); expect(s.flowers.count).toBe(0);
    s.update(3, 12, 1000, [0, 0], 0, 2, ape);
    const col = s.flowers.geometry.getAttribute('fcol'), fh = s.flowers.geometry.getAttribute('fh');
    const M = new THREE.Matrix4(), v = new THREE.Vector3();
    for (let i = 0; i < s.flowers.count; i++) { expect(Object.values(FLOWERS).some(f => f.rgb.every((c, k) => Math.abs(c - [col.getX(i), col.getY(i), col.getZ(i)][k]) < 1e-4)), `flower ${i} colour`).toBe(true);
      expect(fh.getX(i)).toBeGreaterThan(0.05); expect(fh.getX(i)).toBeLessThan(0.95);
      s.flowers.getMatrixAt(i, M); v.setFromMatrixPosition(M); expect(Math.hypot(v.x, v.z)).toBeLessThan(FLOWER_R + CELL * 1.5); }
  });
});
