// Trees of the plain (Phase 7). Where they stand comes from plain.json (all placement C): riparian woodland along the
// Pulvar and the Kur (river_*.riparian: plane, white willow, poplar, tamarisk), tree lines along the canals (plane,
// willow, mulberry), orchards in the 300 m ring around each village (orchards_gardens: fig, apple, pear, mulberry,
// pomegranate; one species per plot), and open oak woodland with wild almond and pistachio scrub on the slopes (woodland
// rule, thinned near the capital). What they look like comes from src/data/trees.json through the shared tree kit
// (src/world/trees: species form C, presence B), and their leaves follow the date (seasonal.ts).
//
// Layers (D-120): within the near radius R3 of the near set's centre every tree is 3-D (render.ts NearTreeSet: LOD0
// within LOD0_R, LOD1 beyond; shadows from the nearest SHADOW_N within SHADOW_R); from there to the mid radius every
// orchard and woodland tree is a baked impostor quad (one instanced draw, rebuilt around the camera); beyond the mid
// radius the river and canal trees stay single impostors (one static instanced draw), the orchards become row impostors
// (vertical quads along the exact tree rows of each plot sampling the same impostor atlas; a plot is drawn as rows only
// when its centre lies beyond the mid radius, and no row fragment is drawn within R3 of the camera), and woodland is the
// canopy pattern the terrain shader paints at the same hash positions (terrainPlain.ts), beyond the mid radius.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionWorld, cameraPosition, cameraViewMatrix, vec2, vec3, vec4, float, floor, fract, sin, cos, atan, mod, length, max, normalize, step } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import { Rng } from '../../core/rng';
import { feature, tag, RiverProfile, pointInPolygon, settlementZones } from './data';
import type { Canal } from './canals';
import { hash2, unit, cellU, SALT, ZoneMap, zoneAt, landUseAt, plotAt } from './fields';
import type { Village } from './villages';
import { TreeKit, treeInst, speciesSize, type TreeInst } from '../trees/render';
import { NV } from '../trees/impostor';
import { VARIANTS, rowOf, allModels } from '../trees/model';
import { speciesIndex, SPECIES } from '../trees/species';

/** a tree of the plain: grid position, species (trees.json id), height and crown width (m), seed */
export interface Tree { x: number; y: number; sp: string; h: number; w: number; seed: number }

// ---------------------------------------------------------------- placement
export function riparianTrees(rivers: RiverProfile[], seed = 1): Tree[] {
  const out: Tree[] = []; const rng = new Rng(seed, 'plain-riparian');
  for (const r of rivers) {
    const rip = feature(r.id).riparian, band = rip.band_m, step = rip.mean_spacing_m / 2;
    for (let i = 0; i + 1 < r.x.length; i++) {
      const tx = r.x[i + 1] - r.x[i], ty = r.y[i + 1] - r.y[i], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
      for (let a = 0; a < l; a += step) for (const side of [-1, 1]) {
        const s = i * 20 + a, clump = unit(hash2(cellU(s / 220), side + 5, 71)) * 0.6 + unit(hash2(cellU(s / 70), side + 9, 72)) * 0.4;
        if (clump < rip.gap_share || !rng.chance(0.75)) continue; // gaps: fords, grazing, cut-over banks (C)
        const u = r.topWidth / 2 + 2 + rng.next() ** 1.4 * band;
        const x = r.x[i] + (tx / l) * a + nx * side * u + rng.range(-3, 3), y = r.y[i] + (ty / l) * a + ny * side * u + rng.range(-3, 3);
        const pick = rng.next(), nearWater = u < r.topWidth / 2 + 10;
        // species mix (C): tamarisk thickets at the water's edge; planes, willows and poplars behind
        const sp = nearWater && pick < 0.45 ? 'tamarisk' : pick < 0.35 ? 'plane' : pick < 0.65 ? 'willow' : pick < 0.85 ? 'poplar' : 'tamarisk';
        const { h, w } = speciesSize(sp, rng.next(), rng.next());
        out.push({ x, y, sp, h, w, seed: rng.int(0, 1 << 30) });
      }
    }
  }
  return out;
}
export function canalTrees(canals: Canal[], seed = 1): Tree[] {
  const out: Tree[] = []; const rng = new Rng(seed, 'plain-canal-trees');
  for (const c of canals) for (let i = 1; i < c.pts.length; i++) {
    const [ax, ay] = c.pts[i - 1], [bx, by] = c.pts[i], l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
    for (let a = 0; a < l; a += 11) for (const side of [-1, 1]) {
      if (!rng.chance(0.28)) continue;
      const u = c.width / 2 + 2.5 + rng.range(0, 2), x = ax + ((bx - ax) * a) / l + nx * side * u, y = ay + ((by - ay) * a) / l + ny * side * u;
      const pick = rng.next(), sp = pick < 0.4 ? 'plane' : pick < 0.8 ? 'willow' : 'mulberry';
      // canal planes are younger than the riparian stands: the lower half of the species' heights (C)
      const { h, w } = speciesSize(sp, rng.next() * (sp === 'plane' ? 0.5 : 1), rng.next());
      out.push({ x, y, sp, h, w, seed: rng.int(0, 1 << 30) });
    }
  }
  return out;
}
/** orchard species of a plot (orchards_gardens + crops.fruit_trees: fig, apple, pear, mulberry, pomegranate; shares C) */
const ORCHARD: [string, number][] = [['fig', 0.22], ['apple', 0.2], ['pear', 0.18], ['mulberry', 0.13], ['pomegranate', 0.27]];
export function orchardSpecies(plotHash: number) { let u = unit(hash2(plotHash, 3, 81)); for (const [sp, p] of ORCHARD) { if (u < p) return sp; u -= p; } return 'pomegranate'; }
export const ORCHARD_SPACING = () => feature('orchards_gardens').rule.tree_spacing_m as number;
/** orchard trees of one plot on a 7 m grid in the plot's strip frame (orchards_gardens rule), as the terrain shader sees the plot */
export function orchardPlotTrees(zm: ZoneMap, seedX: number, seedZ: number): Tree[] {
  const pu = landUseAt(zm, seedX, seedZ); if (pu.row !== 'orchard_floor') return [];
  const p = pu.plot, sp = ORCHARD_SPACING();
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle), out: Tree[] = [];
  const species = orchardSpecies(p.h);
  // walk a grid around the seed in the strip frame and keep points of this plot, 2 m inside its edge
  const nu = Math.ceil((p.w * 1.6) / sp), nv = Math.ceil((p.l * 1.6) / sp);
  for (let i = -nu; i <= nu; i++) for (let j = -nv; j <= nv; j++) {
    const u = i * sp, v = j * sp, x = seedX + u * ca - v * sa, z = seedZ + u * sa + v * ca;
    const q = plotAt(x, z); if (q.h !== p.h || q.edge < 2) continue;
    const hs = hash2(cellU(x), cellU(z), 82), { h, w } = speciesSize(species, unit(hs), unit(hash2(hs, 5, 83)));
    out.push({ x, y: -z, sp: species, h, w, seed: hs & 0x3fffffff });
  }
  return out;
}
/** orchard plots of every village ring (unique plot seeds; world x/z) */
export function orchardPlots(zm: ZoneMap, villages: Village[]): { sx: number; sz: number; angle: number; w: number; l: number; h: number }[] {
  const seen = new Set<number>(), out: { sx: number; sz: number; angle: number; w: number; l: number; h: number }[] = [];
  const ring = feature('orchards_gardens').rule.ring_m as number;
  for (const v of villages) for (let dx = -(v.r + ring); dx <= v.r + ring; dx += 12) for (let dy = -(v.r + ring); dy <= v.r + ring; dy += 12) {
    const d = Math.hypot(dx, dy); if (d < v.r || d > v.r + ring) continue;
    const x = v.x + dx, z = -(v.y + dy), pu = landUseAt(zm, x, z);
    if (pu.row !== 'orchard_floor' || seen.has(pu.plot.h)) continue;
    seen.add(pu.plot.h); out.push({ sx: pu.plot.seed[0], sz: pu.plot.seed[1], angle: pu.plot.angle, w: pu.plot.w, l: pu.plot.l, h: pu.plot.h });
  }
  return out;
}
/** woodland trees in a square around (x, z) (world): the same 10 m jittered cells the terrain shader draws as crowns */
export function woodlandTrees(zm: ZoneMap, cx: number, cz: number, R: number): Tree[] {
  const out: Tree[] = [];
  for (let i = Math.floor((cx - R) / 10); i <= Math.floor((cx + R) / 10); i++) for (let j = Math.floor((cz - R) / 10); j <= Math.floor((cz + R) / 10); j++) {
    const a = cellU(i), b = cellU(j);
    const x = (i + 0.2 + 0.6 * unit(hash2(a, b, SALT.tx))) * 10, z = (j + 0.2 + 0.6 * unit(hash2(a, b, SALT.tz))) * 10;
    if (Math.hypot(x - cx, z - cz) > R) continue;
    const cover = (zoneAt(zm, x, z)[3] / 255) * 0.5;
    if (!(unit(hash2(a, b, SALT.tree)) <= cover * 2.2)) continue;
    // the crown the terrain paints at this cell: radius 2.5-4.5 m (woodland rule crowns 5-9 m)
    const r = 2.5 + 2.0 * unit(hash2(a, b, SALT.tsize)), su = unit(hash2(a, b, 55));
    const sp = su < 0.35 ? (su < 0.19 ? 'almond' : 'pistachio') : 'oak'; // pistachio-almond scrub 35 % (C)
    const hu = unit(hash2(a, b, 56)), sz = speciesSize(sp, hu, 0.5);
    out.push({ x, y: -z, sp, h: sz.h, w: sp === 'oak' ? 2 * r : sz.w, seed: hash2(a, b, 57) & 0x3fffffff });
  }
  return out;
}
/** Per-instance transform done in the vertex shader (used by the near crop tufts, crops.ts): instanced attributes ipos
 *  (base, world), iscl (scale x, y, z, yaw) */
export function instanceTransform(local: any, iscl: any, ipos: any) {
  const c = cos(iscl.w), s = sin(iscl.w), l = local.mul(iscl.xyz);
  return vec3(l.x.mul(c).add(l.z.mul(s)), l.y, l.z.mul(c).sub(l.x.mul(s))).add(ipos);
}
export function instanceNormal(n: any, iscl: any) { const c = cos(iscl.w), s = sin(iscl.w); return normalize(cameraViewMatrix.mul(vec4(n.x.mul(c).add(n.z.mul(s)), n.y, n.z.mul(c).sub(n.x.mul(s)), 0)).xyz); }
export function keepOutOfZones(trees: Tree[]): Tree[] { const z = settlementZones(); return trees.filter(t => !z.some(p => pointInPolygon(t.x, t.y, p))); }
/** the drawn record of a plain tree (ground height from the terrain) */
export const instOf = (t: Tree, terrain: Terrain, where: string): TreeInst => treeInst(t.sp, t.x, terrain.heightAt(t.x, -t.y), -t.y, t.h, t.w, t.seed, where);

// ---------------------------------------------------------------- far: orchard row impostors
export interface RowPlot { sx: number; sz: number; angle: number; w: number; l: number; h: number }
/** Row impostors of the orchard plots: for each plot, vertical quads along the grid lines of its trees in both
 *  directions (trees at i x 7 m, j x 7 m from the plot seed in the strip frame, as orchardPlotTrees), spanning the
 *  plot's inner extent. A fragment finds its tree column along the row, that tree's size and variant from a hash, and
 *  samples the plot species' impostor from the side the camera sees it. A plot's rows collapse (per vertex, the plot
 *  centre is the same for all its rows) when its centre lies within `mid.r` of `mid.c` (the mid ring draws those trees
 *  one by one), and every fragment within `nearR` of the camera is discarded (P22 grey domes: the old rows faded per
 *  vertex, so a long row passing beside the camera kept its height, D-121). */
export function orchardRows(kit: TreeKit, plots: RowPlot[], terrain: Terrain, mid: { c: any; r: any }, nearR: any, outer: number): THREE.Mesh {
  const sp = ORCHARD_SPACING(); const pos: number[] = [], rowA: number[] = [], rowB: number[] = [], rowC: number[] = [], idx: number[] = [];
  const models = allModels();
  let rows = 0;
  for (const p of plots) {
    const species = orchardSpecies(p.h), si = speciesIndex(species), s = SPECIES[si], H = models[rowOf(si, 0)].H;
    let top = 0; for (let v = 0; v < VARIANTS; v++) { const m = models[rowOf(si, v)]; top = Math.max(top, (m.T + m.y0) * (s.height_m[1] / H)); } // tallest tree's tile top (m)
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const pt = (u: number, v: number): [number, number] => [p.sx + u * ca - v * sa, p.sz + u * sa + v * ca];
    const nu = Math.floor((p.w * 0.42) / sp), nv = Math.floor((p.l * 0.42) / sp);
    const addRow = (u0: number, v0: number, u1: number, v1: number, line: number) => {
      const [x0, z0] = pt(u0, v0), [x1, z1] = pt(u1, v1), b = pos.length / 3, L = Math.hypot(x1 - x0, z1 - z0);
      const y0 = terrain.heightAt(x0, z0), y1 = terrain.heightAt(x1, z1);
      pos.push(x0, y0, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1);
      // rowA: along (m; trees at (k + 0.5) x spacing), up 0/1, quad height, trees in the row; rowB: plot centre x, z,
      // species index, line hash; rowC: the species' height range over its reference model height
      for (const [al, up] of [[0, 0], [L, 0], [0, 1], [L, 1]]) { rowA.push(al, up, top, Math.round(L / sp)); rowB.push(p.sx, p.sz, si, (p.h % 9973) + line * 0.001); rowC.push(s.height_m[0] / H, s.height_m[1] / H); }
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); rows++;
    };
    // lines of constant u (along v) and of constant v (along u); each spans its trees +- half a spacing
    for (let i = -nu; i <= nu; i++) addRow(i * sp, -(nv + 0.5) * sp, i * sp, (nv + 0.5) * sp, i + 100);
    for (let j = -nv; j <= nv; j++) addRow(-(nu + 0.5) * sp, j * sp, (nu + 0.5) * sp, j * sp, j + 300);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('rowA', new THREE.Float32BufferAttribute(rowA, 4)); g.setAttribute('rowB', new THREE.Float32BufferAttribute(rowB, 4)); g.setAttribute('rowC', new THREE.Float32BufferAttribute(rowC, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const A = attribute('rowA', 'vec4'), B = attribute('rowB', 'vec4'), C = attribute('rowC', 'vec2');
  const vis = step(mid.r, length(B.xy.sub(mid.c.xz))).mul(float(1).sub(step(float(outer), length(positionLocal.xz.sub(cameraPosition.xz)))));
  m.positionNode = positionLocal.add(vec3(0, A.y.mul(A.z).mul(vis), 0));
  // fragment: the tree columns either side of this point (a crown can be wider than the spacing), each with its size,
  // variant and yaw from a hash of plot, line and column (C at this distance: the mid ring draws the exact trees nearer)
  const along = A.x, upM = A.y.mul(A.z), toCam = cameraPosition.xz.sub(positionWorld.xz), dir = toCam.div(max(length(toCam), 1e-3));
  const col0 = floor(along.div(sp)), side = step(col0.add(0.5).mul(sp), along).mul(2).sub(1);
  const column = (col: any) => {
    const rnd = (k: number) => fract(sin(col.mul(12.9898).add(B.w.mul(78.233)).add(k * 37.719)).mul(43758.5453));
    const variant = floor(rnd(2).mul(VARIANTS - 0.001)), row = B.z.mul(VARIANTS).add(variant), sp2 = kit.spRec(2, row), T = sp2.x, y0 = sp2.y;
    const k = C.x.add(C.y.sub(C.x).mul(rnd(1))), yaw = rnd(3).mul(6.28); // tree height / reference height, in the species' range
    const dx = along.sub(col.add(0.5).mul(sp));
    const uvT = vec2(dx.div(T.mul(k)).add(0.5), upM.div(k).sub(y0).div(T));
    const c = cos(yaw), s = sin(yaw), f = mod(atan(dir.x.mul(c).sub(dir.y.mul(s)), dir.x.mul(s).add(dir.y.mul(c))).div(Math.PI * 2).add(1).mul(NV), NV);
    const smp = kit.impostorSample(row, f, uvT);
    const real = step(0, col).mul(step(col, A.w.sub(1))); // columns beyond the row's ends hold no tree
    const a = smp.a.mul(step(0, uvT.x)).mul(step(uvT.x, 1)).mul(step(0, uvT.y)).mul(step(uvT.y, 1)).mul(real);
    return { col: smp.col, n: smp.n, a };
  };
  const s0 = column(col0), s1 = column(col0.add(side));
  const pick = step(s0.a, s1.a); // the neighbour's crown is in front where it covers more
  const nearCut = step(nearR, length(positionWorld.xz.sub(cameraPosition.xz))); // per fragment: never within the near radius
  m.colorNode = vec4(s0.col.mul(float(1).sub(pick)).add(s1.col.mul(pick)), max(s0.a, s1.a).mul(nearCut));
  const n = normalize(s0.n.mul(float(1).sub(pick)).add(s1.n.mul(pick)));
  const right = vec3(dir.y, 0, dir.x.negate()), nW = right.mul(n.x).add(vec3(0, 1, 0).mul(n.y)).add(vec3(dir.x, 0, dir.y).mul(n.z));
  m.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
  m.alphaTest = 0.5; m.roughnessNode = float(0.8);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'plain-orchards-far'; mesh.frustumCulled = false; mesh.userData = { ...TREE_TAG(), rows };
  return mesh;
}
export const TREE_TAG = () => tag(feature('orchards_gardens'), 'trees of the plain: riparian (river_*.riparian), canal lines, orchards (orchards_gardens), woodland (woodland rule); species presence B, form C (src/data/trees.json), placement C; far trees are impostors baked from the same models');
export { VARIANTS };
