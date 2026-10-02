// s14/load (D-354): the baked world is the built world. pack/unpack is lossless; every unit node can build, built live,
// has the same identity (content hash without timings) as its baked entry when that entry is fresh; a stale or missing
// entry is reported, never used (the page falls back to the live build: src/world/cache/worldCache.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pack, unpack, hashArrays } from '../src/world/cache/pack';
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
      let b = readFileSync(`public/world-cache/${e.file}`); if (e.gz) b = gunzipSync(b);
      expect(identity(unpack(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)))).toBe(identity(live));
    }, 600_000);
  }
});

describe('world cache: s15 (D-392) the whole build baked', () => {
  it('packs Sets, Maps and three vectors (revived as Vector3)', async () => {
    const THREE = await import('three/webgpu'); await import('../src/world/cache/geo');
    const v = { s: new Set([3, 1, 2]), m: new Map<string, any>([['a', [[1, 2], [3, 4]]], ['b', null]]), e: [{ a: new THREE.Vector3(1, -2, 3.5), n: 1 }] };
    const u = unpack<any>(pack(v));
    expect(u.s).toBeInstanceOf(Set); expect([...u.s]).toEqual([3, 1, 2]);
    expect(u.m).toBeInstanceOf(Map); expect(u.m.get('a')).toEqual([[1, 2], [3, 4]]); expect(u.m.get('b')).toBe(null);
    expect(u.e[0].a).toBeInstanceOf(THREE.Vector3); expect(u.e[0].a.toArray()).toEqual([1, -2, 3.5]);
    expect(identity(u)).toBe(identity(v));
  });
  it('the town plan read back from its baked state is the plan computed live', async () => {
    const { buildTownPlan, snapSite, restoreSite } = await import('../src/world/settlement/plan');
    const P = buildTownPlan(), snaps = P.sites.map(snapSite), back = unpack<any[]>(pack(snaps));
    for (const [i, s] of P.sites.entries()) {
      const t = Object.create(Object.getPrototypeOf(s)); Object.assign(t, s); restoreSite(t, back[i]);
      expect(identity(snapSite(t))).toBe(identity(snaps[i]));
      expect(t.doors).toBeInstanceOf(Set); expect(t.cell).toBeInstanceOf(Int32Array);
      expect(t.cellGrid(5)).toEqual(s.cellGrid(5));
    }
  }, 300_000);
});
