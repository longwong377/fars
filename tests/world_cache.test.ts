// s14/load (D-354): the baked world is the built world. pack/unpack is lossless; every unit node can build, built live,
// has the same identity (content hash without timings) as its baked entry when that entry is fresh; a stale or missing
// entry is reported, never used (the page falls back to the live build: src/world/cache/worldCache.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pack, unpack, hashArrays, registerClass } from '../src/world/cache/pack';
import { identity } from '../src/world/cache/worldCache';
import { sourceHashes, closure } from '../tools/bake_world/srchash.mjs';
import { nodeUnits } from '../tools/bake_world/units';

describe('world cache: pack', () => {
  it('round-trips plain data and typed arrays bit for bit', () => {
    const v = { a: 1, b: 'x', n: null, inf: -Infinity, f: new Float32Array([1.5, -0, NaN, 3e38]), i: new Uint32Array([1, 2 ** 32 - 1]), deep: [{ u8: new Uint8Array([7, 8, 9]), d: new Float64Array([Math.PI]) }, true], s: new Int16Array(0) };
    const u = unpack<any>(pack(v));
    expect(u.a).toBe(1); expect(u.b).toBe('x'); expect(u.n).toBe(null); expect(u.inf).toBe(-Infinity);
    expect(new Uint8Array(u.f.buffer, u.f.byteOffset, 16)).toEqual(new Uint8Array(v.f.buffer)); expect(u.f).toBeInstanceOf(Float32Array);
    expect(Array.from(u.i)).toEqual([1, 2 ** 32 - 1]); expect(Array.from(u.deep[0].u8)).toEqual([7, 8, 9]); expect(u.deep[0].d[0]).toBe(Math.PI); expect(u.deep[1]).toBe(true); expect(u.s.length).toBe(0);
    expect(identity(u)).toBe(identity(v));
  });
  it('identity ignores timings and sees one changed value', () => {
    const a = { ms: 1, x: new Float32Array([1, 2, 3]) }, b = { ms: 99, x: new Float32Array([1, 2, 3]) }, c = { ms: 1, x: new Float32Array([1, 2, 3.0001]) };
    expect(identity(a)).toBe(identity(b)); expect(identity(a)).not.toBe(identity(c));
    expect(hashArrays([1, 2], [3])).not.toBe(hashArrays([1], [2, 3]));
  });
});

describe('world cache: pack, graphs (s15, D-386)', () => {
  it('keeps shared objects shared, cycles, Maps, Sets and registered classes', () => {
    class Box { constructor(public w = 1, public h = 2) {} area() { return this.w * this.h; } }
    registerClass(Box, 'TestBox');
    const shared = { tag: 'x', a: new Float32Array([1, 2]) }, ring: any = { name: 'ring' }; ring.self = ring;
    const v = { p: shared, q: [shared, shared.a], m: new Map<any, any>([['k', shared], [3, new Set([1, 'two'])]]), b: new Box(3, 4), ring };
    const u = unpack<any>(pack(v));
    expect(u.p).toBe(u.q[0]); expect(u.q[1]).toBe(u.p.a); expect(Array.from(u.p.a)).toEqual([1, 2]);
    expect(u.m).toBeInstanceOf(Map); expect(u.m.get('k')).toBe(u.p); expect([...u.m.get(3)]).toEqual([1, 'two']);
    expect(u.b).toBeInstanceOf(Box); expect(u.b.area()).toBe(12); expect(u.ring.self).toBe(u.ring);
    expect(identity(u)).toBe(identity(v));
    class Unknown { x = 1 } expect(() => pack({ z: new Unknown() })).toThrow(/unregistered/);
  });
});

describe('world cache: geometry (s15, the mud-brick faces)', () => {
  it('a mud face read back from its packed form is the live one, and its key sees its input', async () => {
    const THREE = await import('three/webgpu');
    const { mudFace } = await import('../src/arch/mudface');
    const { packGeo, unpackGeo, geoHash } = await import('../src/world/cache/geo');
    const g = new THREE.BoxGeometry(6, 3, 0.8, 2, 2, 1).toNonIndexed(); g.deleteAttribute('uv'); g.translate(3, 1.5, 0);
    const live = mudFace(g, null, 1), back = unpackGeo(unpack<any>(pack(packGeo(live))));
    for (const k of Object.keys(live.attributes)) expect(Array.from(back.getAttribute(k).array as any)).toEqual(Array.from(live.getAttribute(k).array as any));
    expect(Array.from(back.index!.array as any)).toEqual(Array.from(live.index!.array as any));
    const g2 = g.clone(); (g2.getAttribute('position').array as Float32Array)[0] += 0.001;
    expect(geoHash(g, 1)).toBe(geoHash(g.clone(), 1)); expect(geoHash(g2, 1)).not.toBe(geoHash(g, 1)); expect(geoHash(g, 0.5)).not.toBe(geoHash(g, 1));
  });
});

describe('world cache: source hashes', () => {
  it('follow the import closure (a unit sees the modules its entry imports)', () => {
    const files = closure('.', ['src/people/outfit_worker.ts']).map((f: string) => f.replace(/\\/g, '/'));
    expect(files.some((f: string) => f.endsWith('src/people/outfits.ts'))).toBe(true);
    expect(files.some((f: string) => f.endsWith('src/people/humanAssets.ts'))).toBe(true);
    const h = sourceHashes('.') as Record<string, string>;
    for (const u of ['outfits', 'impostors', 'detail']) expect(h[u]).toMatch(/^[0-9a-f]{16}$/);
  });
});

/** a baked entry's bytes (stored gzipped since D-386) */
const readEntry = (file: string) => { const b = readFileSync(`public/world-cache/${file}`); const u = b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b; return new Uint8Array(u.buffer, u.byteOffset, u.byteLength); };

describe('world cache: the town plan (s15, D-386)', () => {
  it('read back from its packed form is the live plan, its Sites working', async () => {
    const { buildTownPlan } = await import('../src/world/settlement/plan');
    const live = buildTownPlan(), back = unpack<any>(pack(live));
    expect(identity(back)).toBe(identity(live));
    expect(back.sites[0].grid(1, 2)).toEqual(live.sites[0].grid(1, 2)); expect(back.groups).toBeInstanceOf(Map);
    const mf = 'public/world-cache/manifest.json', M = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { entries: {} }, e = M.entries['townplan|v1'];
    if (!e) { console.warn('[world-cache] townplan|v1: not baked (npx tsx tools/bake_world/bake.ts)'); return; }
    if (e.src !== (sourceHashes('.') as Record<string, string>).townplan) { console.warn('[world-cache] townplan|v1: stale'); return; }
    expect(identity(unpack(readEntry(e.file)))).toBe(identity(live));
  }, 120_000);
});

describe('world cache: the baked units equal the live build', () => {
  const mf = 'public/world-cache/manifest.json', M = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { entries: {} };
  const src = sourceHashes('.') as Record<string, string>;
  for (const u of nodeUnits()) {
    it(`${u.unit}|${u.key}`, async () => {
      const e = M.entries[`${u.unit}|${u.key}`];
      const live = await u.compute();
      expect(identity(unpack(pack(live)))).toBe(identity(live));
      if (!e) { console.warn(`[world-cache] ${u.unit}|${u.key}: not baked (npx tsx tools/bake_world/bake.ts)`); return; }
      if (e.src !== src[u.unit]) { console.warn(`[world-cache] ${u.unit}|${u.key}: stale (the page builds it live)`); return; }
      const b = readEntry(e.file);
      expect(identity(unpack(b))).toBe(identity(live));
    }, 600_000);
  }
});
