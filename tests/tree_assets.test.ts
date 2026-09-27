// The Blender tree assets (D-327; tools/blender/trees.mjs, public/models/trees/): current against their inputs (species
// data, model and atlas code, bark choices, the Blender scripts), within the game's triangle budgets, the leaf tiles
// covering what the procedural tiles covered (the card sizes are calibrated on those), every species' bark scan present
// and ledgered, and the kit drawing them: the Blender wood template at the same triangles per level, and the levels of
// detail and impostors still agreeing in silhouette and colour with the rendered tiles.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
// @ts-ignore (plain node module)
import { treeInputHash } from '../tools/blender/lib/tree_inputs.mjs';
import { loadTreeAssetsNode } from '../src/world/trees/assets_node';
import { BARK_SPECIES, BARK_SCANS, type TreeAssets } from '../src/world/trees/assets';
import { SPECIES } from '../src/world/trees/species';
import { allModels, TRIS, M0, M1, SIDES0, SIDES1, K0, K1 } from '../src/world/trees/model';
import { TILE_NAMES } from '../src/world/trees/atlas';
import { calibrateCards } from '../src/world/trees/kitdata';
import { ImpostorBaker, groupStates, NV, srgbToLinear } from '../src/world/trees/impostor';
import { TreeKit, NearTreeSet } from '../src/world/trees/render';
import { foliageTable } from '../src/world/plain/seasonal';
import { groupIndex } from '../src/world/trees/species';

const DIR = 'public/models/trees';
let A: TreeAssets;
beforeAll(async () => { A = (await loadTreeAssetsNode('.'))!; }, 60_000);

describe('the Blender tree assets are built, current and within budget', () => {
  it('the manifest lists every file with its hash, and its inputs hash as at the build', () => {
    const man = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
    expect(man.inHash, 'stale: run node tools/blender/trees.mjs').toBe(treeInputHash(man.settings));
    for (const [f, e] of Object.entries(man.files) as [string, any][]) {
      const b = readFileSync(`${DIR}/${f}`); expect(createHash('sha256').update(b).digest('hex'), f).toBe(e.sha256);
    }
    // reproduced by `node tools/blender/trees.mjs --verify` from these very inputs (Cycles on the GPU: decoded texels compared)
    expect(man.verify?.ok, 'run node tools/blender/trees.mjs --verify').toBe(true); expect(man.verify.inHash).toBe(man.inHash);
    expect(man.bytes).toBeLessThan(11e6); // the class's download (T-K7 counts it; D-327 rev 2 cut it from 17.8 MB)
  });
  it('the leaf atlas: every tile rendered, covering what the procedural tile covers (+-15 %; the cards are calibrated on it)', () => {
    const man = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
    expect(A.atlas.source).toBe('blender'); expect(A.atlas.tile).toBe(man.tile);
    TILE_NAMES.forEach((n, t) => { const p = man.atlas.tiles[t].procFill; expect(Math.abs(A.atlas.fill[t] / p - 1), `${n} fill ${A.atlas.fill[t]} vs ${p}`).toBeLessThan(0.15); });
    // the rendered shade varies within a tile (the leaves' own occlusion and veins): not a flat fill
    const L = A.atlas.levels[0], T = A.atlas.tile; let s = 0, s2 = 0, n = 0;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const o = (j * L.width + i) * 4; if (L.data[o + 3] < 128) continue; const v = L.data[o] / 255; s += v; s2 += v * v; n++; }
    const m = s / n, sd = Math.sqrt(s2 / n - m * m); expect(sd / m).toBeGreaterThan(0.08);
  });
  it('the wood: every model at both levels, within the levels\' triangle budgets, its mesh the size of its model', () => {
    const models = allModels();
    expect(A.wood[0].tmax).toBe(M0 * SIDES0 * 2); expect(A.wood[1].tmax).toBe(M1 * SIDES1 * 2);
    for (const m of models) {
      const r = m.si * 3 + m.variant, t0 = A.wood[0].tris[r], t1 = A.wood[1].tris[r];
      expect(t0, `${m.species.id}/${m.variant} lod0`).toBeGreaterThan(300); expect(t0).toBeLessThanOrEqual(A.wood[0].tmax);
      expect(t1, `${m.species.id}/${m.variant} lod1`).toBeGreaterThan(40); expect(t1).toBeLessThanOrEqual(A.wood[1].tmax);
      // the corners' extent: from the foot (a little below ground) to near the top of the skeleton, unit normals, finite uv
      const L = A.wood[0], W = L.width; let ymin = 1e9, ymax = -1e9, bad = 0;
      for (let c = 0; c < t0 * 3; c++) { const o = ((r * 3) * W + c) * 4, n = ((r * 3 + 1) * W + c) * 4; ymin = Math.min(ymin, L.data[o + 1]); ymax = Math.max(ymax, L.data[o + 1]);
        if (Math.abs(Math.hypot(L.data[n], L.data[n + 1], L.data[n + 2]) - 1) > 1e-3 || !Number.isFinite(L.data[o + 3] + L.data[n + 3])) bad++; }
      const top = Math.max(...m.segs.slice(0, m.used.segs).map(s => s.b[1]));
      expect(ymin, `${m.species.id} foot`).toBeLessThan(0.05); expect(ymax / top, `${m.species.id} top`).toBeGreaterThan(0.9); expect(ymax / top).toBeLessThan(1.1);
      expect(bad, `${m.species.id} normals/uv`).toBe(0);
      // unused corners are zero-sized
      const o = ((r * 3) * W + t0 * 3) * 4; if (t0 < L.tmax) expect(Math.abs(L.data[o]) + Math.abs(L.data[o + 1]) + Math.abs(L.data[o + 2])).toBe(0);
    }
  });
  it('every species has a CC0 bark scan in the game and in the asset ledger', () => {
    const ledger = readFileSync('ASSET_LEDGER.md', 'utf8');
    for (const s of SPECIES) { const b = BARK_SPECIES[s.id]; expect(b, s.id).toBeTruthy(); expect(BARK_SCANS).toContain(b.scan);
      for (const f of ['diff', 'nor']) expect(existsSync(`${DIR}/bark/${b.scan}_${f}.jpg`), `${b.scan}_${f}`).toBe(true);
      expect(ledger.includes(b.scan), `ASSET_LEDGER.md: ${b.scan}`).toBe(true); }
  });
});

describe('the kit draws them (world-wide: every tree layer shares the kit)', () => {
  it('the wood template has the levels\' triangles (TRIS unchanged) and the kit says what it draws', () => {
    const kit = TreeKit.get({ impostorPx: 64 });
    expect(kit.atlas.source).toBe('blender'); expect(kit.wood).not.toBeNull();
    const tri = (m: any) => m.geometry.index.count / 3;
    const n0 = new NearTreeSet(kit, 0, 4, true, 't'), n1 = new NearTreeSet(kit, 1, 4, false, 't');
    expect(tri(n0.wood) + tri(n0.leaves)).toBe(TRIS.lod0); expect(tri(n1.wood) + tri(n1.leaves)).toBe(TRIS.lod1);
    expect(TRIS.lod0).toBe(M0 * SIDES0 * 2 + K0 * 2); expect(TRIS.lod1).toBe(M1 * SIDES1 * 2 + K1 * 2);
    expect(kit.assetNote()).not.toContain('PLACEHOLDER: procedural leaf'); expect(kit.assetNote()).toContain('Cycles');
  });
  it('with the rendered tiles, LOD1 keeps LOD0\'s silhouette and colour and the impostor keeps LOD1\'s (summer and April)', () => {
    const models = calibrateCards(allModels());
    const bake = (lod: 0 | 1, px: number, doy: number) => { const b = new ImpostorBaker(models, A.atlas, px, lod, A.wood), st = groupStates(foliageTable(doy));
      models.forEach((m, r) => b.bakeRow(r, st[groupIndex(m.species.group)])); const lv = b.levels().col[0].data;
      return models.map((m, r) => { let n = 0; const c = [0, 0, 0]; for (let j = 0; j < px; j++) for (let i = 0; i < NV * px; i++) { const o = ((r * px + j) * b.width + i) * 4; if (lv[o + 3] < 128) continue; n++; for (let k = 0; k < 3; k++) c[k] += srgbToLinear(lv[o + k] / 255); }
        const t = m.T / px; return { area: n * t * t / NV, lum: (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / Math.max(1, n) }; }); };
    for (const doy of [200, 105]) {
      const L0 = bake(0, 128, doy), L1 = bake(1, 128, doy), I = bake(1, 64, doy);
      models.forEach((m, r) => {
        expect(Math.abs(L1[r].area / L0[r].area - 1), `${m.species.id} ${doy} LOD1/LOD0 area`).toBeLessThan(0.25);
        expect(Math.abs(L1[r].lum / L0[r].lum - 1), `${m.species.id} ${doy} LOD1/LOD0 lum`).toBeLessThan(0.12);
        expect(Math.abs(I[r].area / L1[r].area - 1), `${m.species.id} ${doy} imp/LOD1 area`).toBeLessThan(0.15);
        expect(Math.abs(I[r].lum / L1[r].lum - 1), `${m.species.id} ${doy} imp/LOD1 lum`).toBeLessThan(0.08);
      });
    }
  }, 180_000);
});
