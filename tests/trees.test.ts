// Trees (D-120 to D-122): species data, the generated models measured against their species' proportions, the
// levels of detail and the impostors against each other (silhouette area and colour), the seasonal card states, the
// triangle count per level of detail, and the orchard row impostors' cut (the grey domes of village P22, D-121).
// Everything runs headless on the same pure-JS generators the renderer uses.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { SPECIES, refForm, speciesIndex } from '../src/world/trees/species';
import { allModels, cardState, rowOf, VARIANTS, M0, M1, K0, K1, SIDES0, SIDES1, TRIS, type TreeModel } from '../src/world/trees/model';
import { TILE_NAMES, tileIndex, type Atlas } from '../src/world/trees/atlas';
import { calibrateAndDrawAtlas } from '../src/world/trees/kitdata';
import { ImpostorBaker, groupStates, NV, srgbToLinear } from '../src/world/trees/impostor';
import { TreeKit, NearTreeSet, ImpostorSet, treeInst } from '../src/world/trees/render';
import { TREE_GROUPS, foliage, foliageTable } from '../src/world/plain/seasonal';
import { groupIndex } from '../src/world/trees/species';

const sources = JSON.parse(readFileSync('src/data/sources.json', 'utf8'));
let models: TreeModel[], atlas: Atlas;
beforeAll(() => { models = allModels(); atlas = calibrateAndDrawAtlas(models); }, 60_000);

/** measured form of a model in full leaf: height, crown width, crown base (m), from its cards and branches */
function measure(m: TreeModel) {
  const cs = m.cards.slice(0, m.used.cards), ext = (c: typeof cs[number]) => c.size * 0.5 * 0.7; // a card's reach beyond its centre (the spray fills ~70 % of it)
  const top = Math.max(...cs.map(c => c.c[1] + ext(c)), ...m.segs.slice(0, m.used.segs).map(s => s.b[1]));
  const radii = cs.map(c => Math.hypot(c.c[0], c.c[2]) + ext(c)).sort((a, b) => a - b), bottoms = cs.map(c => c.c[1] - ext(c)).sort((a, b) => a - b);
  return { H: top, W: 2 * radii[Math.floor(radii.length * 0.95)], CB: Math.max(0, bottoms[Math.floor(bottoms.length * 0.03)]) };
}

describe('species data (src/data/trees.json)', () => {
  it('every species has a presence tier and source, C form values with a source, sane ranges, a foliage group and atlas tiles', () => {
    for (const s of SPECIES) {
      expect(['A', 'B', 'C']).toContain(s.presence.tier); expect(s.tier).toBe('C');
      for (const k of `${s.presence.src};${s.src}`.split(';')) expect(sources[k], `${s.id}: source ${k}`).toBeTruthy();
      for (const r of [s.height_m, s.crown_width_ratio, s.crown_base_ratio, s.stems, s.limbs]) expect(r[0]).toBeLessThanOrEqual(r[1]);
      expect(TREE_GROUPS as readonly string[]).toContain(s.group);
      for (const t of [s.leaf.tile, s.twig_tile, ...(s.blossom_tile ? [s.blossom_tile] : [])]) expect(TILE_NAMES as readonly string[]).toContain(t);
      expect(s.bark.every(v => v > 0.1 && v < 0.7)).toBe(true); // sRGB-encoded bark albedo
    }
    // groups that blossom have species with a blossom tile, and no species without one belongs to a blossoming group
    for (const s of SPECIES) expect(!!s.blossom_tile, s.id).toBe(foliage(s.group, 0).blossom > 0 || foliage(s.group, 60).blossom > 0 || foliage(s.group, 95).blossom > 0 || foliage(s.group, 150).blossom > 0);
  });
});

describe('generated models match their species (height, crown width, crown base, trunk, stems)', () => {
  it('every variant: height within 8 %, crown width / height within the species range (+-12 %), crown base within +-0.08 H', () => {
    console.log(models.map(m => { const s = m.species, f = refForm(s), q = measure(m); return `${s.id}/${m.variant}: H ${q.H.toFixed(1)} (ref ${f.H.toFixed(1)}), W/H ${(q.W / f.H).toFixed(2)} [${s.crown_width_ratio}], CB/H ${(q.CB / f.H).toFixed(2)} [${s.crown_base_ratio}]`; }).join('\n'));
    for (const m of models) {
      const s = m.species, f = refForm(s), q = measure(m);
      expect(Math.abs(q.H / f.H - 1), `${s.id}/${m.variant} height`).toBeLessThan(0.08);
      expect(q.W / f.H, `${s.id}/${m.variant} crown width`).toBeGreaterThan(s.crown_width_ratio[0] * 0.88);
      expect(q.W / f.H, `${s.id}/${m.variant} crown width`).toBeLessThan(s.crown_width_ratio[1] * 1.12);
      expect(q.CB / f.H, `${s.id}/${m.variant} crown base`).toBeGreaterThan(s.crown_base_ratio[0] - 0.08);
      expect(q.CB / f.H, `${s.id}/${m.variant} crown base`).toBeLessThan(s.crown_base_ratio[1] + 0.08);
    }
  });
  it('trunk diameter at the foot is the species dbh ratio (+-35 %, x0.6 per stem of a multi-stem tree) and the stem count is in range', () => {
    for (const m of models) {
      const s = m.species, stems = m.segs.slice(0, m.used.segs).filter(g => g.level === 0 && g.a[1] < 0.1);
      expect(stems.length, `${s.id}/${m.variant} stems`).toBeGreaterThanOrEqual(s.stems[0]); expect(stems.length, `${s.id}/${m.variant} stems`).toBeLessThanOrEqual(s.stems[1]);
      const want = s.dbh_ratio * m.H * (stems.length > 1 ? 0.6 : 1);
      for (const g of stems) expect(Math.abs((2 * g.ra) / 1.15 / want - 1), `${s.id} dbh`).toBeLessThan(0.35);
    }
  });
  it('species read apart: poplar and cypress narrow, plane and mulberry broad domes, fig and oak wider than tall, tamarisk multi-stemmed', () => {
    const wr = (id: string) => { const ms = models.filter(m => m.species.id === id).map(measure); return ms.reduce((a, q) => a + q.W / q.H, 0) / ms.length; };
    expect(wr('poplar')).toBeLessThan(0.45); expect(wr('cypress')).toBeLessThan(0.32);
    expect(wr('plane')).toBeGreaterThan(0.65); expect(wr('mulberry')).toBeGreaterThan(0.8);
    expect(wr('fig')).toBeGreaterThan(1.0); expect(wr('oak')).toBeGreaterThan(0.95);
    expect(wr('plane') / wr('poplar')).toBeGreaterThan(1.8);
    for (const m of models.filter(q => q.species.id === 'tamarisk')) expect(m.segs.filter(g => g.level === 0 && g.a[1] < 0.1).length).toBeGreaterThanOrEqual(4);
    // the willow's outer shoots hang: its cards point down on average, a poplar's point up
    const upY = (id: string) => { const cs = models.filter(m => m.species.id === id).flatMap(m => m.cards.slice(0, m.used.cards)); return cs.reduce((a, c) => a + c.up[1], 0) / cs.length; };
    expect(upY('willow')).toBeLessThan(upY('poplar') - 0.3);
  });
  it('every card slot and segment slot is used or zero-sized (vertex pulling: fixed slot counts)', () => {
    for (const m of models) { expect(m.segs.length).toBe(M0); expect(m.cards.length).toBe(K0); expect(m.used.cards).toBe(K0);
      for (const g of m.segs.slice(m.used.segs)) expect(g.ra + g.rb).toBe(0); }
  });
});

describe('seasons (seasonal.ts foliage -> model.ts cardState)', () => {
  const share = (id: string, doy: number) => { const m = models[rowOf(speciesIndex(id), 0)], g = foliage(m.species.group, doy); let L = 0, B = 0, T = 0;
    for (const c of m.cards) { const s = cardState(c, g.leaf, g.blossom); L += s.isL; B += s.isB; T += s.isT; } return { L: L / K0, B: B / K0, T: T / K0 }; };
  it('deciduous trees are bare twig sprays in January (the branch structure shows), evergreens keep their leaves', () => {
    for (const id of ['plane', 'willow', 'poplar', 'apple', 'fig', 'oak', 'mulberry']) expect(share(id, 15).T, id).toBe(1);
    for (const id of ['cypress', 'olive']) expect(share(id, 15).L, id).toBe(1);
  });
  it('apple and pear blossom before full leaf (late March), wild almond in February, pomegranate in May-June; figs never', () => {
    expect(share('apple', 92).B).toBeGreaterThan(0.6); expect(share('pear', 92).B).toBeGreaterThan(0.6);
    expect(share('almond', 58).B).toBeGreaterThan(0.6); expect(share('pomegranate', 150).B).toBeGreaterThan(0.6);
    for (const d of [60, 92, 150]) expect(share('fig', d).B).toBe(0);
    expect(share('plane', 200).L).toBe(1);
    // leaf-out is gradual: half-way through, some cards are leaves and some still twigs
    const mid = share('plane', 95); expect(mid.L).toBeGreaterThan(0.2); expect(mid.T).toBeGreaterThan(0.2);
  });
});

describe('levels of detail and impostors agree (silhouette area, colour)', () => {
  /** per model row: covered area (m^2) and mean linear albedo of the baked views */
  const bakeStats = (lod: 0 | 1, px: number, doy: number) => {
    const b = new ImpostorBaker(models, atlas, px, lod), st = groupStates(foliageTable(doy));
    models.forEach((m, r) => b.bakeRow(r, st[groupIndex(m.species.group)]));
    return models.map((m, r) => { let n = 0; const c = [0, 0, 0];
      for (let j = 0; j < px; j++) for (let i = 0; i < NV * px; i++) { const o = ((r * px + j) * b.width + i) * 4; if (b.col[o + 3] < 0.5) continue; n++; for (let k = 0; k < 3; k++) c[k] += srgbToLinear(b.col[o + k]); }
      const texel = m.T / px; return { area: (n * texel * texel) / NV, col: c.map(v => v / Math.max(1, n)) }; });
  };
  for (const [doy, label] of [[200, 'summer'], [105, 'April (blossom, leaf-out)'], [15, 'winter']] as const)
    it(`LOD1 keeps LOD0's silhouette area (+-25 %) and colour (+-12 % luminance); the 64 px impostor keeps LOD1's area (+-15 %, bare +-20 %) and colour (+-8 %): ${label}`, () => {
      const L0 = bakeStats(0, 128, doy), L1 = bakeStats(1, 128, doy), I = bakeStats(1, 64, doy);
      const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      console.log(label + '\n' + models.map((m, r) => `${m.species.id}/${m.variant}: area LOD0 ${L0[r].area.toFixed(1)} LOD1 ${L1[r].area.toFixed(1)} imp ${I[r].area.toFixed(1)} m2; lum LOD0 ${lum(L0[r].col).toFixed(3)} LOD1 ${lum(L1[r].col).toFixed(3)} imp ${lum(I[r].col).toFixed(3)}`).join('\n'));
      models.forEach((m, r) => {
        expect(Math.abs(L1[r].area / L0[r].area - 1), `${m.species.id} LOD1/LOD0 area`).toBeLessThan(0.25);
        expect(Math.abs(lum(L1[r].col) / lum(L0[r].col) - 1), `${m.species.id} LOD1/LOD0 luminance`).toBeLessThan(0.12);
        // bare crowns: twig sprays are a texel or two wide at 64 px, so their covered area depends on resolution
        expect(Math.abs(I[r].area / L1[r].area - 1), `${m.species.id} impostor/LOD1 area`).toBeLessThan(doy === 15 ? 0.2 : 0.15);
        expect(Math.abs(lum(I[r].col) / lum(L1[r].col) - 1), `${m.species.id} impostor/LOD1 luminance`).toBeLessThan(0.08); });
    }, 120_000);
});

describe('triangles per level of detail (render.ts templates)', () => {
  it('LOD0 = 64 segments x 6 sides x 2 + 320 cards x 2; LOD1 = 16 x 4 x 2 + 80 x 2; impostor 2', () => {
    const kit = TreeKit.get({ impostorPx: 64 });
    const tri = (m: THREE.Mesh) => (m.geometry.index!.count / 3);
    const n0 = new NearTreeSet(kit, 0, 4, true, 't'), n1 = new NearTreeSet(kit, 1, 4, false, 't');
    expect(tri(n0.wood) + tri(n0.leaves)).toBe(TRIS.lod0); expect(tri(n1.wood) + tri(n1.leaves)).toBe(TRIS.lod1);
    expect(TRIS.lod0).toBe(M0 * SIDES0 * 2 + K0 * 2); expect(TRIS.lod1).toBe(M1 * SIDES1 * 2 + K1 * 2);
    expect(TRIS.lod0).toBe(1408); expect(TRIS.lod1).toBe(288);
    const imp = new ImpostorSet(kit, 4, { c: { xz: null }, r: 0 } as any, 1000, 't'); expect(tri(imp.mesh)).toBe(TRIS.impostor);
    // instance counts follow the records; the dev overlay (F3) picks a tree and names its species and tiers
    n0.set([treeInst('plane', 0, 0, 0, 19, 15, 7, 'test'), treeInst('fig', 30, 0, 0, 5, 6, 9, 'test')]); expect(n0.count()).toBe(2); expect(n0.tris()).toBe(2 * TRIS.lod0);
    const rc = new THREE.Raycaster(new THREE.Vector3(0, 10, 40), new THREE.Vector3(0, 0, -1)); rc.far = 400;
    const hits: any[] = []; n0.leaves.raycast(rc, hits); expect(hits.length).toBe(1);
    const d = n0.leaves.userData.describe(hits[0]); expect(d.tier).toBe('C'); expect(d.note).toContain('Platanus orientalis'); expect(d.src).toContain('IR-RIPARIAN');
  });
  it('the kit builds the impostor atlas for every model row and view, and re-bakes only groups that changed', () => {
    const kit = TreeKit.get({ impostorPx: 64 }), img: any = kit.impCol.image;
    expect(img.width).toBe(NV * 64); expect(img.height).toBe(models.length * 64); expect(kit.impCol.mipmaps.length).toBeGreaterThan(3);
    const b0 = kit.bakes; kit.setDay(200); expect(kit.bakes).toBe(b0 + 1); kit.setDay(201); kit.setDay(201); expect(kit.bakes).toBeLessThanOrEqual(b0 + 2);
    expect(models.length).toBe(SPECIES.length * VARIANTS); expect(tileIndex('twig_fine')).toBeGreaterThan(0);
  });
});
