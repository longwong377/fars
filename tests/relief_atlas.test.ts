// The carved-relief atlas (D-320; src/arch/relief_atlas.ts, tools/blender/relief_atlas.ts): complete (every figure the world
// draws has its baked rectangle), current (built from the code and data now in the tree), the files the build recorded, and
// the atlas levels cut the triangles the vertex-painted ones drew (research/BLENDER_PLAN.md row 3: -0.6 to -1 M).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import { ATLAS_INDEX, ATLAS_LODS, atlasEntry, atlasUV } from '../src/arch/relief_atlas';
import { ReliefSet, setReliefAtlas, updateReliefs, reliefLodMesh, lodGeometryAtlas, lodGrid, RELIEF_LODS } from '../src/arch/reliefs';
import { buildTerrace } from '../src/arch/terrace';
import { buildReliefs, buildPhase4Reliefs, apadanaFacades } from '../src/arch/decor';
import { census, bakeFrame, type DefUse } from '../tools/blender/lib/relief_census';
import { reliefAtlasInputs } from '../tools/blender/lib/relief_inputs';
import { SILHOUETTE_ERROR } from '../src/arch/relief_field';

const A = ATLAS_INDEX;
let uses: Map<string, DefUse>;
beforeAll(async () => { uses = await census(); }, 300_000);

describe('the carved-relief atlas (D-320)', () => {
  it('is built: two KTX2 array textures with the sizes and hashes the build recorded', () => {
    expect(A.version, 'src/data/relief_atlas.json: run npx tsx tools/blender/relief_atlas.ts --device=GPU').toBeGreaterThan(0);
    for (const k of ['nao', 'paint'] as const) {
      const f = 'public/' + A.files[k]; expect(existsSync(f), f).toBe(true);
      const b = readFileSync(f); expect(b.length).toBe(A.bytes[k]);
      expect(createHash('sha256').update(b).digest('hex'), `${f} is the file the build wrote`).toBe(A.sha[k]);
      // KTX2 header: identifier, pixel size, layer count, UASTC (Basis supercompression 0 with zstd = 2)
      expect(b.subarray(1, 7).toString('latin1')).toBe('KTX 20');
      expect(b.readUInt32LE(20)).toBe(A.size); expect(b.readUInt32LE(24)).toBe(A.size);
      expect(Math.max(1, b.readUInt32LE(32))).toBe(A.layers);
      expect(b.readUInt32LE(40), 'mipmapped').toBeGreaterThan(8);
      expect(b.readUInt32LE(44), 'zstd supercompression').toBe(2);
    }
  });
  it('covers every relief figure definition the world draws (Apadana, Phase 4, Naqsh-e Rustam, the rosettes)', () => {
    const missing = [...uses.keys()].filter(k => !A.defs[k]);
    expect(missing, 'definitions not in the atlas').toEqual([]);
    expect(uses.size).toBeGreaterThan(200);
  });
  it('is current: its inputs (figure and field code, paint data, carving values, bake settings, the census frames) hash as at the build', () => {
    const now = reliefAtlasInputs([...uses.values()].map(u => ({ key: u.key, ...bakeFrame(u) }))).hash;
    expect(now, 'the atlas is stale: rerun npx tsx tools/blender/relief_atlas.ts --device=GPU').toBe(A.inHash);
  });
  it('every rectangle lies inside its page, none overlap, and the texel is at most 1.7 mm on the stone at the largest height drawn (canopy 3.4 mm)', () => {
    const byLayer = new Map<number, [number, number, number, number][]>();
    for (const [k, e] of Object.entries(A.defs)) {
      const [x, y, w, h] = e.px; expect(x >= 0 && y >= 0 && x + w <= A.size && y + h <= A.size, k).toBe(true); expect(e.layer).toBeLessThan(A.layers);
      const r = byLayer.get(e.layer) ?? []; for (const [x2, y2, w2, h2] of r) expect(x < x2 + w2 && x2 < x + w && y < y2 + h2 && y2 < y + h, `${k} overlaps`).toBe(false);
      r.push(e.px); byLayer.set(e.layer, r);
      const u = uses.get(k); if (!u) continue; const f = bakeFrame(u), texel = e.cell * f.sMax;
      expect(texel, k).toBeLessThanOrEqual((f.coarse ? 2 : 1) * A.texel_m * 1.08 + 1e-9);
    }
  });
  it('the atlas coordinate of a vertex lands in its figure\'s rectangle (with the margin), mirrored or not; the frame keeps the bitangent up', () => {
    for (const [kind, seed] of [['guard', 0], ['lion_bull', 0], ['king', 0], ['rosette', 0]] as const) {
      const e = atlasEntry(kind, seed)!; const m = reliefLodMesh(kind, seed, 65, 3, true);
      for (const mirror of [false, true]) {
        const g = lodGeometryAtlas(m, mirror, e, 1), ruv = g.getAttribute('ruv'), tan = g.getAttribute('tangent'), pos = g.getAttribute('position');
        for (let i = 0; i < ruv.count; i++) {
          const tx = ruv.getX(i) * A.size, ty = ruv.getY(i) * A.size;
          expect(tx >= e.px[0] - 0.5 && tx <= e.px[0] + e.px[2] + 0.5 && ty >= e.px[1] - 0.5 && ty <= e.px[1] + e.px[3] + 0.5, `${kind} vertex ${i}`).toBe(true);
          expect(ruv.getZ(i)).toBe(e.layer);
          // the texel under the vertex is the grid point at the vertex's unmirrored figure position
          const [u] = atlasUV(e, (mirror ? -1 : 1) * pos.getX(i), pos.getY(i), A.size); expect(Math.abs(u - ruv.getX(i))).toBeLessThan(1e-6); // (clamped to the rectangle)
        }
        expect(tan.getX(0)).toBe(mirror ? -1 : 1); expect(tan.getW(0), 'w: bitangent = (normal x tangent) w = +y').toBe(mirror ? -1 : 1);
      }
    }
  });
});

describe('the atlas levels (ATLAS_LODS)', () => {
  it('keep every outline cell-exact (their error bounds are under the silhouette error) and the legacy switch distances', () => {
    ATLAS_LODS.forEach((l, i) => { expect(l.err).toBeLessThan(SILHOUETTE_ERROR); expect(l.dist).toBe(RELIEF_LODS[i].dist); });
  });
  it('every relief set of the Terrace is drawn with the atlas when atlas mode is on, and the placements are right-handed', () => {
    setReliefAtlas(true);
    try {
      const { manifest, doorways } = buildTerrace() as any;
      const sets = [...buildReliefs(manifest).children, ...buildPhase4Reliefs(doorways).group.children].filter((c): c is ReliefSet => c instanceof ReliefSet);
      expect(sets.length).toBeGreaterThan(5);
      for (const s of sets) { expect(s.atlas, s.name).toBe(true); for (const it of s.items) expect(it.X.clone().cross(it.Y).dot(it.Z), s.name).toBeGreaterThan(0); }
    } finally { setReliefAtlas(false); }
  });
  it('cut the relief triangles the vertex-painted levels drew by 0.6-1 M where they were most (the Phase 4 jambs, the audience panel, the Apadana walk)', () => {
    const measure = (atlas: boolean) => {
      setReliefAtlas(atlas);
      const { manifest, doorways } = buildTerrace() as any;
      const ap = buildReliefs(manifest), p4 = buildPhase4Reliefs(doorways).group;
      const sets = [...ap.children, ...p4.children].filter((c): c is ReliefSet => c instanceof ReliefSet);
      const at = (e: number, y: number, n: number) => new THREE.Vector3(e, y, -n), tris = () => sets.reduce((s, q) => s + q.stats.tris, 0);
      let jamb = 0, panel = 0, walk = 0;
      for (const d of doorways.filter((q: any) => q.framed)) for (const off of [0, 1.2]) for (const sd of [-1, 1]) { updateReliefs(at(d.c[0] + d.u[0] * sd * (d.width / 2 - 0.4) - d.n[0] * off, d.y0 + 1.6, d.c[1] + d.u[1] * sd * (d.width / 2 - 0.4) - d.n[1] * off), 1e9); jamb = Math.max(jamb, tris()); }
      for (const f of apadanaFacades(manifest)) {
        for (const off of [2, 4, 6]) { updateReliefs(at(f.origin[0] + f.normal[0] * off, 1.6, f.origin[1] + f.normal[1] * off), 1e9); panel = Math.max(panel, tris()); }
        for (let a = -f.length / 2; a <= f.length / 2; a += 8) for (const off of [1.2, 4, 15]) { updateReliefs(at(f.origin[0] + f.along[0] * a + f.normal[0] * off, 1.6, f.origin[1] + f.along[1] * a + f.normal[1] * off), 1e9); walk = Math.max(walk, tris()); }
      }
      for (const s of sets) s.dispose();
      setReliefAtlas(false);
      return { jamb, panel, walk };
    };
    const before = measure(false), after = measure(true);
    console.warn(`relief triangles, vertex-painted levels -> atlas levels: jambs ${before.jamb} -> ${after.jamb}, audience panel ${before.panel} -> ${after.panel}, Apadana walk ${before.walk} -> ${after.walk}`);
    expect(before.jamb - after.jamb, 'jambs').toBeGreaterThanOrEqual(0.6e6);
    expect(before.panel - after.panel, 'audience panel').toBeGreaterThanOrEqual(0.6e6);
    expect(after.walk, 'Apadana walk').toBeLessThan(before.walk * 0.6);
  }, 600_000);
  it('the atlas grid of a figure is never finer than the legacy one at the same level', () => {
    for (const ext of [0.07, 0.78, 1.8, 3.4]) ATLAS_LODS.forEach((_, l) => expect(lodGrid(ext, l, ATLAS_LODS)).toBeLessThanOrEqual(lodGrid(ext, l)));
  });
});
