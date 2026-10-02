// s17 C2 (D-560): the roadside rules (verge.ts) and the no-copies helpers (variety.ts)
import { describe, it, expect, afterAll } from 'vitest';
import { setVergePaths, vergeZone } from '../src/world/plain/verge';
import { twinFree, resolveCell, sameLook, bumpYaw } from '../src/world/plain/variety';
import { coverCell } from '../src/world/plain/groundCover';
import { vergeFloraItems } from '../src/world/groundFlora';
import { vergeRockItems } from '../src/world/groundRocks';
import { plotAt } from '../src/world/plain/fields';
import { plotAnchor } from '../src/world/plain/trees';

const ZONES = { data: new Uint8Array(4 * 4 * 4), n: 4, half: 40960, cell: 64 * 320, ground: null } as any; // all natural ground
const env = { ground: () => 0, zones: ZONES };
describe('the roadside (verge.ts)', () => {
  afterAll(() => setVergePaths(null));
  it('tread, median and verge of a track', () => {
    setVergePaths([{ pts: [[0, 0], [200, 0]], hw: 1.75, kind: 'track' }]);
    expect(vergeZone(50, 0.2)?.zone).toBe('median'); expect(vergeZone(50, 1.2)?.zone).toBe('tread');
    expect(vergeZone(50, 3)?.zone).toBe('verge'); expect(vergeZone(50, 6)).toBeNull();
  });
  it('no grass on the tread, dense grass on the verge, weeds and edge stones there', () => {
    setVergePaths([{ pts: [[0, 0], [400, 0]], hw: 1.75, kind: 'track' }]);
    let tread = 0, verge = 0, vergeCells = 0;
    for (let ix = 10; ix < 190; ix++) for (const iz of [-1, 0, 1, 2]) { // grid n = -z: cells at n 0..2 (tread) and 2..4 (verge)
      for (const it of coverCell(env, ix, -iz - 1, 1, 107, { green: 0.8, dry: 0.1 })) { const z = vergeZone(it.x, -it.z)?.zone; if (z === 'tread' && it.kind !== 'dung') tread++; if (z === 'verge') verge++; }
      if (vergeZone((ix + 0.5) * 2, (iz + 0.5) * 2)?.zone === 'verge') vergeCells++; }
    expect(tread).toBe(0); expect(verge / vergeCells).toBeGreaterThan(1.5);
    let weeds = 0, stones = 0; for (let ix = 0; ix < 50; ix++) for (const iy of [-1, 0]) { weeds += vergeFloraItems(1, 'thistle', ix, iy).length + vergeFloraItems(1, 'camelthorn', ix, iy).length; stones += vergeRockItems(1, ix, iy, 12).length; }
    expect(weeds).toBeGreaterThan(100); expect(stones).toBeGreaterThan(50);
  });
});
describe('no copies within 20 m (variety.ts)', () => {
  type I = { e: number; n: number; s: number; asp: number; yaw: number };
  const twin = (a: I, b: I) => sameLook(a, b), bump = (t: I, k: number) => ({ ...t, yaw: bumpYaw(t.yaw, k) });
  it('twinFree turns every copy of an earlier item', () => {
    const list: I[] = Array.from({ length: 8 }, (_, i) => ({ e: i * 2, n: 0, s: 1, asp: 1, yaw: 0 }));
    const out = twinFree(list, twin, bump);
    for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++) if (twin(out[i], out[j])) throw new Error(`copy ${i} ${j}`);
  });
  it('resolveCell is the same whoever asks, and turns copies of the cells before', () => {
    const raw = (x: number, y: number): I[] => [{ e: x * 8 + 4, n: y * 8 + 4, s: 1, asp: 1, yaw: 0 }];
    const a = resolveCell(3, 3, 8, raw, twin, bump), b = resolveCell(3, 3, 8, raw, twin, bump);
    expect(a).toEqual(b); expect(a[0].yaw).not.toBe(0);
  });
  it('an orchard plot is anchored inside itself', () => {
    for (let k = 0; k < 200; k++) { const x0 = k * 137.1, z0 = k * -91.7, p = plotAt(x0, z0), [x, z] = plotAnchor(p.seed[0], p.seed[1], p.h, [x0, z0]); expect(plotAt(x, z).h).toBe(p.h); }
  });
});
import { fieldItems, villageItems, HARVEST } from '../src/world/plain/fieldFill';
describe('the farm year near the walker (fieldFill.ts)', () => {
  const IRR = { data: new Uint8Array(4 * 4 * 4).map((_, i) => (i % 4 === 0 ? 255 : 0)), n: 4, half: 40960, cell: 64 * 320, ground: null } as any; // irrigated everywhere
  const count = (doy: number, m: string) => fieldItems(IRR, 0, 0, doy).filter(it => it.m === m).length;
  it('sheaves and stooks only in the harvest weeks, none in spring', () => {
    expect(count(107, 'wo_sheaves') + count(107, 'wo_stooks')).toBe(0);
    const h = HARVEST.barley!; let sheaves = 0, stooks = 0; for (const d of [h + 2, h + 8, h + 14, HARVEST.wheat! + 6]) { sheaves += count(d, 'wo_sheaves'); stooks += count(d, 'wo_stooks'); }
    expect(sheaves).toBeGreaterThan(20); expect(stooks).toBeGreaterThan(20);
    expect(count(240, 'wo_sheaves') + count(240, 'wo_stooks')).toBe(0);
  });
  it('the floor threshes in summer, the straw stands in stacks to spring, the fold all year', () => {
    const V = [{ id: 'v', x: 0, y: 0, r: 60, floor: [100, 0] as [number, number] }], by = (d: number) => villageItems(V, d).map(i => i.m);
    expect(by(107)).not.toContain('wo_threshing_floor'); expect(by(107)).toContain('wo_fold');
    expect(by(190)).toContain('wo_threshing_floor'); expect(by(190)).toContain('wo_grain_heap');
    expect(by(300).filter(m => m === 'wo_fodder').length).toBe(4); expect(by(30)).toContain('wo_fodder'); expect(by(110)).not.toContain('wo_fodder');
  });
});
import { fieldTrees } from '../src/world/plain/trees';
describe('the field-edge trees (trees.ts fieldTrees)', () => {
  const IRR = { data: new Uint8Array(4 * 4 * 4).map((_, i) => (i % 4 === 0 ? 255 : 0)), n: 4, half: 40960, cell: 64 * 320, ground: null } as any;
  it('a few tens a square kilometre, the same from any window, none on a track', () => {
    setVergePaths([{ pts: [[-600, 0], [600, 0]], hw: 1.75, kind: 'track' }]);
    const a = fieldTrees(IRR, 0, 0, 564), b = fieldTrees(IRR, 100, 0, 700).filter(t => Math.hypot(t.x, t.y) <= 564);
    expect(a.length).toBeGreaterThan(10); expect(a.length).toBeLessThan(120);
    expect(b.map(t => t.seed).sort()).toEqual(a.map(t => t.seed).sort());
    for (const t of a) expect(vergeZone(t.x, t.y)).toBeNull();
    setVergePaths(null);
  });
});
