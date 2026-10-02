// s14/load (D-354): the baked world is the built world. pack/unpack is lossless; every unit node can build, built live,
// has the same identity (content hash without timings) as its baked entry when that entry is fresh; a stale or missing
// entry is reported, never used (the page falls back to the live build: src/world/cache/worldCache.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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
      const b = readFileSync(`public/world-cache/${e.file}`);
      expect(identity(unpack(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)))).toBe(identity(live));
    }, 600_000);
  }
});
