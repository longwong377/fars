// Trees of the plain (Phase 7). Where they stand comes from plain.json (all placement C): riparian woodland along the
// Pulvar and the Kur (river_*.riparian: plane, willow, poplar, tamarisk), tree lines along the canals, orchards in the
// 300 m ring around each village (orchards_gardens: fig, apple, pear, mulberry, pomegranate), and open oak woodland with
// pistachio-almond scrub on the slopes (woodland rule, thinned near the capital). Their leaves follow the date
// (seasonal.ts foliage: leaf-out, autumn colour, bare winter, blossom).
//
// Drawing (D-038): near the camera (R3) every tree is a 3D instance (wood + crown, 2 draw calls, shadows); beyond it the
// riparian and canal trees are camera-facing billboards (1 draw call, one static mesh) and the orchards are "row
// impostors": vertical quads along the orchard rows with a scalloped crown line (1 draw call). Woodland beyond R3 is the
// canopy pattern the terrain shader draws at the same hash positions (terrainPlain.ts).
import * as THREE from 'three/webgpu';
import { attribute, uniform, positionLocal, positionGeometry, normalGeometry, cameraPosition, cameraViewMatrix, vec2, vec3, vec4, float, int, ivec2, mix, smoothstep, length, normalize, textureLoad, mx_noise_float, uv, step, clamp, max, abs, fract, sin, cos, time, positionWorld } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { Rng } from '../../core/rng';
import { feature, tag, RiverProfile, pointInPolygon, settlementZones } from './data';
import type { Canal } from './canals';
import { TREE_GROUPS, TreeGroup, foliageTable } from './seasonal';
import { hash2, unit, cellU, SALT, ZoneMap, zoneAt, landUseAt, plotAt } from './fields';
import type { Village } from './villages';

export interface Tree { x: number; y: number; g: number; h: number; r: number; shape: number; seed: number }
/** crown shapes: 0 round (plane, fruit, mulberry), 1 columnar (poplar), 2 weeping/oval (willow), 3 shrub (tamarisk, almond), 4 spreading (oak) */
const G = (g: TreeGroup) => TREE_GROUPS.indexOf(g);

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
        let g: number, h: number, rr: number, shape: number;
        if (nearWater && pick < 0.45) { g = G('tamarisk'); h = rng.range(2.5, 5); rr = rng.range(1.5, 2.8); shape = 3; }
        else if (pick < 0.35) { g = G('plane'); h = rng.range(14, 24); rr = h * rng.range(0.32, 0.42); shape = 0; }
        else if (pick < 0.65) { g = G('willow_poplar'); h = rng.range(6, 11); rr = h * rng.range(0.4, 0.5); shape = 2; }
        else if (pick < 0.85) { g = G('willow_poplar'); h = rng.range(13, 21); rr = h * rng.range(0.12, 0.16); shape = 1; }
        else { g = G('tamarisk'); h = rng.range(2.5, 5); rr = rng.range(1.5, 2.8); shape = 3; }
        out.push({ x, y, g, h, r: rr, shape, seed: rng.int(0, 1 << 30) });
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
      const pick = rng.next();
      if (pick < 0.4) out.push({ x, y, g: G('plane'), h: rng.range(10, 20), r: 0, shape: 0, seed: rng.int(0, 1 << 30) });
      else if (pick < 0.8) out.push({ x, y, g: G('willow_poplar'), h: rng.range(6, 10), r: 0, shape: 2, seed: rng.int(0, 1 << 30) });
      else out.push({ x, y, g: G('mulberry'), h: rng.range(6, 9), r: 0, shape: 0, seed: rng.int(0, 1 << 30) });
      const t = out[out.length - 1]; t.r = t.shape === 2 ? t.h * 0.45 : t.h * 0.38;
    }
  }
  return out;
}
const FRUIT: { h: [number, number]; r: number }[] = [{ h: [4, 6], r: 0.45 }, { h: [4.5, 7], r: 0.4 }, { h: [5, 8], r: 0.38 }, { h: [3, 5], r: 0.42 }]; // fig, apple/pear, mulberry-like, pomegranate (C sizes)
/** orchard trees of one plot on a 7 m grid in the plot's strip frame (orchards_gardens rule), as the terrain shader sees the plot */
export function orchardPlotTrees(zm: ZoneMap, seedX: number, seedZ: number): Tree[] {
  const pu = landUseAt(zm, seedX, seedZ); if (pu.row !== 'orchard_floor') return [];
  const p = pu.plot, sp = feature('orchards_gardens').rule.tree_spacing_m as number;
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle), out: Tree[] = [];
  const kind = unit(hash2(p.h, 3, 81)), fr = FRUIT[Math.min(3, Math.floor(kind * 4))];
  // walk a grid around the seed in the strip frame and keep points of this plot, 2 m inside its edge
  const nu = Math.ceil((p.w * 1.6) / sp), nv = Math.ceil((p.l * 1.6) / sp);
  for (let i = -nu; i <= nu; i++) for (let j = -nv; j <= nv; j++) {
    const u = i * sp, v = j * sp, x = seedX + u * ca - v * sa, z = seedZ + u * sa + v * ca;
    const q = plotAt(x, z); if (q.h !== p.h || q.edge < 2) continue;
    const hs = hash2(cellU(x), cellU(z), 82), h = fr.h[0] + (fr.h[1] - fr.h[0]) * unit(hs);
    out.push({ x, y: -z, g: kind < 0.75 ? G('fruit') : G('mulberry'), h, r: h * fr.r, shape: 0, seed: hs & 0x3fffffff });
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
  const out: Tree[] = []; const wl = feature('woodland').rule;
  for (let i = Math.floor((cx - R) / 10); i <= Math.floor((cx + R) / 10); i++) for (let j = Math.floor((cz - R) / 10); j <= Math.floor((cz + R) / 10); j++) {
    const a = cellU(i), b = cellU(j);
    const x = (i + 0.2 + 0.6 * unit(hash2(a, b, SALT.tx))) * 10, z = (j + 0.2 + 0.6 * unit(hash2(a, b, SALT.tz))) * 10;
    if (Math.hypot(x - cx, z - cz) > R) continue;
    const cover = (zoneAt(zm, x, z)[3] / 255) * 0.5;
    if (!(unit(hash2(a, b, SALT.tree)) <= cover * 2.2)) continue;
    const r = 2.5 + 2.0 * unit(hash2(a, b, SALT.tsize)), scrub = unit(hash2(a, b, 55)) < 0.35;
    const h = scrub ? 2 + 2 * unit(hash2(a, b, 56)) : wl.height_m[0] + (wl.height_m[1] - wl.height_m[0]) * unit(hash2(a, b, 56));
    out.push({ x, y: -z, g: scrub ? G('almond_pistachio') : G('oak'), h, r: scrub ? r * 0.5 : r, shape: scrub ? 3 : 4, seed: hash2(a, b, 57) & 0x3fffffff });
  }
  return out;
}
export function keepOutOfZones(trees: Tree[]): Tree[] { const z = settlementZones(); return trees.filter(t => !z.some(p => pointInPolygon(t.x, t.y, p))); }

// ---------------------------------------------------------------- shared foliage state
export class FoliageState {
  readonly data = new Float32Array(2 * TREE_GROUPS.length * 4);
  readonly tex: THREE.DataTexture;
  constructor() { this.tex = new THREE.DataTexture(this.data, 2, TREE_GROUPS.length, THREE.RGBAFormat, THREE.FloatType); this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.needsUpdate = true; }
  setDay(doy: number) { this.data.set(foliageTable(doy)); this.tex.needsUpdate = true; }
  /** leaf colour+amount and blossom colour+amount of group g (TSL) */
  leaf(g: any) { return textureLoad(this.tex, ivec2(int(0), int(g))); }
  blossom(g: any) { return textureLoad(this.tex, ivec2(int(1), int(g))); }
}
const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

// ---------------------------------------------------------------- near: 3D instances
function woodGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const cyl = (r0: number, r1: number, a: THREE.Vector3, b: THREE.Vector3, seg = 5) => {
    const g = new THREE.CylinderGeometry(r1, r0, 1, seg, 1, true); const d = b.clone().sub(a), L = d.length();
    g.scale(1, L, 1); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
    g.deleteAttribute('uv'); return g; };
  const base = new THREE.Vector3(0, -0.05, 0), fork = new THREE.Vector3(0, 0.42, 0);
  parts.push(cyl(0.035, 0.025, base, fork, 6));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4, tip = new THREE.Vector3(Math.cos(a) * 0.32, 0.78, Math.sin(a) * 0.32); parts.push(cyl(0.02, 0.008, fork, tip, 4));
    for (let t = 0; t < 2; t++) { const b = a + (t ? 0.6 : -0.6), s = fork.clone().lerp(tip, 0.6), e = new THREE.Vector3(Math.cos(b) * 0.5, 0.95, Math.sin(b) * 0.5); parts.push(cyl(0.008, 0.003, s, e, 3)); } }
  return mergeGeometries(parts)!;
}
function crownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blobs = [[0, 0.7, 0, 0.62], [0.26, 0.6, 0.12, 0.46], [-0.2, 0.64, -0.2, 0.47]];
  for (const [bi, [x, y, z, r]] of blobs.entries()) {
    const g = new THREE.IcosahedronGeometry(1, 1); g.deleteAttribute('uv');
    const p = g.getAttribute('position') as THREE.BufferAttribute, nrm = g.getAttribute('normal') as THREE.BufferAttribute; const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i);
      // lumpy but closed: the radius is a smooth function of direction (shared corners move together; the geometry is non-indexed)
      const k = 0.9 + 0.1 * Math.sin(3.1 * dx + 1.7 * dz + bi) + 0.06 * Math.sin(5.3 * dy - 2.2 * dx + 2 * bi);
      p.setXYZ(i, x + dx * r * k, y + dy * r * k * 0.8, z + dz * r * k); c.set([x, y, z], i * 3);
      nrm.setXYZ(i, dx, dy, dz); // soft, rounded shading (radial normals) instead of facets
    }
    g.setAttribute('blob', new THREE.BufferAttribute(c, 3)); parts.push(g);
  }
  return mergeGeometries(parts)!;
}
/** Per-instance transform done in the vertex shader (three applies InstancedMesh matrices *before* positionNode, so the
 *  crown's leaf-fall deformation, which works in template space, needs its own instancing): instanced attributes
 *  ipos (base, world), iscl (scale x, y, z, yaw) and tree (group, seed) on an InstancedBufferGeometry drawn by a Mesh. */
export function instanceTransform(local: any, iscl: any, ipos: any) {
  const c = cos(iscl.w), s = sin(iscl.w), l = local.mul(iscl.xyz);
  return vec3(l.x.mul(c).add(l.z.mul(s)), l.y, l.z.mul(c).sub(l.x.mul(s))).add(ipos);
}
export function instanceNormal(n: any, iscl: any) { const c = cos(iscl.w), s = sin(iscl.w); return normalize(cameraViewMatrix.mul(vec4(n.x.mul(c).add(n.z.mul(s)), n.y, n.z.mul(c).sub(n.x.mul(s)), 0)).xyz); }
export interface NearTrees { wood: THREE.Mesh; crown: THREE.Mesh; set(trees: Tree[], terrain: Terrain): void; count(): number }
export function nearTrees(max: number, foliage: FoliageState, wind: any, castShadow = true): NearTrees {
  const mk = (g: THREE.BufferGeometry) => { const ig = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(g.attributes)) ig.setAttribute(k, a); if (g.index) ig.setIndex(g.index); ig.instanceCount = 0; return ig; };
  const woodG = mk(woodGeometry()), crownG = mk(crownGeometry());
  const posA = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3), sclA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), gAttr = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  for (const g of [woodG, crownG]) { g.setAttribute('ipos', posA); g.setAttribute('iscl', sclA); g.setAttribute('tree', gAttr); }
  const ipos = attribute('ipos', 'vec3'), iscl = attribute('iscl', 'vec4'), t = attribute('tree', 'vec2'), grp = t.x, sd = t.y;
  const leaf = foliage.leaf(grp), bl = foliage.blossom(grp);
  const amount = clamp(leaf.w.mul(0.85).add(bl.w.mul(0.7)).add(0.001), 0, 1);
  // crown: blobs shrink toward their centres as leaves fall (bare in winter), sway a little in the wind
  const blob = attribute('blob', 'vec3'), pg = positionGeometry;
  const shrunk = blob.add(pg.sub(blob).mul(amount.mul(0.85).add(0.15).mul(step(0.02, amount))));
  const sway: any = sin(time.mul(1.3).add(sd.mul(0.001))).mul(wind).mul(0.012).mul(pg.y).mul(iscl.y);
  const cm = new THREE.MeshStandardNodeMaterial();
  cm.positionNode = instanceTransform(shrunk, iscl, ipos).add(vec3(sway, 0, sway.mul(0.6)));
  cm.normalNode = instanceNormal(normalGeometry, iscl);
  const tint = mx_noise_float(pg.mul(6).add(sd.mul(0.00001))).mul(0.12).add(1).mul(fract(sd.mul(0.000013)).mul(0.25).add(0.88));
  const bmix = bl.w.div(bl.w.add(leaf.w).max(0.001));
  cm.colorNode = mix(leaf.xyz, bl.xyz, bmix).mul(tint);
  cm.roughnessNode = float(0.8);
  const crown = new THREE.Mesh(crownG, cm); crown.name = castShadow ? 'plain-trees-crown' : 'plain-trees-crown-far'; crown.castShadow = castShadow; crown.receiveShadow = true; crown.frustumCulled = false;
  const wm = new THREE.MeshStandardNodeMaterial(); wm.positionNode = instanceTransform(positionGeometry, iscl, ipos); wm.normalNode = instanceNormal(normalGeometry, iscl);
  wm.colorNode = vec3(0.24, 0.2, 0.16).mul(mx_noise_float(positionGeometry.mul(9).add(sd.mul(0.00001))).mul(0.1).add(1)); wm.roughnessNode = float(0.9);
  const wood = new THREE.Mesh(woodG, wm); wood.name = castShadow ? 'plain-trees-wood' : 'plain-trees-wood-far'; wood.castShadow = castShadow; wood.receiveShadow = true; wood.frustumCulled = false;
  let n = 0;
  return { wood, crown, count: () => n,
    set(trees: Tree[], terrain: Terrain) {
      n = Math.min(max, trees.length);
      for (let i = 0; i < n; i++) { const tr = trees[i];
        const wf = [1.0, 1.0, 1.0, 1.1, 1.25][tr.shape];
        let w = (tr.r / 0.62) * wf, hy = tr.h; // crown template radius ~0.62 at the main blob
        if (tr.shape === 1) w = tr.r / 0.4; if (tr.shape === 3) { w = tr.r / 0.55; hy = tr.h * 1.1; }
        posA.setXYZ(i, tr.x, terrain.heightAt(tr.x, -tr.y), -tr.y); sclA.setXYZW(i, w, hy, w, (tr.seed % 628) / 100);
        gAttr.setXY(i, tr.g, tr.seed % 100000);
      }
      woodG.instanceCount = crownG.instanceCount = n; posA.needsUpdate = sclA.needsUpdate = gAttr.needsUpdate = true;
    } };
}

// ---------------------------------------------------------------- far: billboards and orchard row impostors
/** camera-facing billboards (cylindrical), collapsed inside `inner` m and beyond `outer` m of the camera */
export function farBillboards(trees: Tree[], terrain: Terrain, foliage: FoliageState, inner: any, outer: number): THREE.Mesh {
  const n = trees.length, pos = new Float32Array(n * 4 * 3), cor = new Float32Array(n * 4 * 2), att = new Float32Array(n * 4 * 4), idx = new Uint32Array(n * 6);
  trees.forEach((t, i) => {
    const y = terrain.heightAt(t.x, -t.y);
    for (let k = 0; k < 4; k++) { pos.set([t.x, y, -t.y], (i * 4 + k) * 3); cor.set([k & 1 ? 1 : -1, k & 2 ? 1 : 0], (i * 4 + k) * 2); att.set([t.g, t.r, t.h, t.shape], (i * 4 + k) * 4); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.BufferAttribute(cor, 2)); g.setAttribute('tree', new THREE.BufferAttribute(att, 4)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const c = attribute('corner', 'vec2'), a = attribute('tree', 'vec4');
  const toCam = positionLocal.xz.sub(cameraPosition.xz), dist = length(toCam);
  const dir = toCam.div(dist.max(1e-3)), right = vec3(dir.y.negate(), 0, dir.x);
  const vis = smoothstep(inner.mul(0.85), inner, dist).mul(float(1).sub(smoothstep(outer * 0.8, outer, dist)));
  const wdt = mix(a.y, a.y.mul(1.2), step(2.5, a.w)).mul(vis), hgt = a.z.mul(vis);
  m.positionNode = positionLocal.add(right.mul(c.x.mul(wdt))).add(vec3(0, c.y.mul(hgt), 0));
  // silhouette: crown ellipse over a thin trunk; winter crowns thin to a branch haze
  const u = uv(); void u;
  const cu = c.x, cv = c.y;
  const crownBase = mix(float(0.3), float(0.05), step(2.5, a.w)); // shrubs and oaks carry foliage lower
  const ey = cv.sub(crownBase).div(float(1).sub(crownBase)).mul(2).sub(1);
  const ell = float(1).sub(smoothstep(0.85, 1.0, length(vec2(cu, ey))));
  const leaf = foliage.leaf(a.x), bl = foliage.blossom(a.x), amount = clamp(leaf.w.add(bl.w.mul(0.8)), 0, 1);
  const noise = mx_noise_float(vec3(cu.mul(3.1), cv.mul(4.3), a.y.mul(7.7))).mul(0.5).add(0.5);
  const crownMask = ell.mul(step(noise, amount.mul(0.9).add(0.25)));
  const trunk = step(abs(cu), 0.07).mul(step(cv, crownBase.add(0.1)));
  m.opacityNode = max(crownMask, trunk); m.alphaTest = 0.5;
  const bmix = bl.w.div(bl.w.add(leaf.w).max(0.001));
  const leafCol = mix(leaf.xyz, bl.xyz, bmix).mul(noise.mul(0.3).add(0.75));
  const bare = vec3(0.3, 0.27, 0.23);
  m.colorNode = mix(mix(bare, leafCol, smoothstep(0.1, 0.4, amount)), vec3(0.2, 0.17, 0.13), trunk.mul(float(1).sub(crownMask)));
  m.normalNode = vec3(0, 0, 1); // view-facing normal: lit like a crown seen from the side
  m.roughnessNode = float(0.85);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'plain-trees-far'; mesh.frustumCulled = false;
  return mesh;
}
/** orchard row impostors: vertical quads along the tree rows (both directions) of each orchard plot */
export function orchardRows(plots: ReturnType<typeof orchardPlots>, terrain: Terrain, foliage: FoliageState, inner: any, outer: number): THREE.Mesh {
  const sp = 14; const pos: number[] = [], att: number[] = [], idx: number[] = [];
  const addQuad = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const b = pos.length / 3, y0 = terrain.heightAt(x0, z0), y1 = terrain.heightAt(x1, z1), L = Math.hypot(x1 - x0, z1 - z0);
    pos.push(x0, y0, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1); att.push(0, 0, L, h, L, 0, L, h, 0, 1, L, h, L, 1, L, h);
    idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  };
  for (const p of plots) {
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle), h = 5 + 1.5 * unit(hash2(p.h, 3, 83));
    const W = p.w * 0.42, Lh = p.l * 0.42; // stay inside the (irregular) plot
    const pt = (u: number, v: number): [number, number] => [p.sx + u * ca - v * sa, p.sz + u * sa + v * ca];
    for (let u = -W + sp / 2; u <= W; u += sp) { const [x0, z0] = pt(u, -Lh), [x1, z1] = pt(u, Lh); addQuad(x0, z0, x1, z1, h); }
    for (let v = -Lh + sp / 2; v <= Lh; v += sp) { const [x0, z0] = pt(-W, v), [x1, z1] = pt(W, v); addQuad(x0, z0, x1, z1, h); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('row', new THREE.Float32BufferAttribute(att, 4)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const r = attribute('row', 'vec4'); // (along m, up 0/1, length, height)
  const dist = length(positionLocal.xz.sub(cameraPosition.xz));
  const vis = smoothstep(inner.mul(0.85), inner, dist).mul(float(1).sub(smoothstep(outer * 0.8, outer, dist)));
  m.positionNode = positionLocal.add(vec3(0, r.y.mul(r.w).mul(vis), 0));
  const along = r.x, up = r.y;
  const per = fract(along.div(7)).sub(0.5).mul(2); // one crown per 7 m
  const top = float(1).sub(per.mul(per).mul(0.35)); // scalloped crown line
  const fruitLeaf = foliage.leaf(float(G('fruit'))), fruitBl = foliage.blossom(float(G('fruit')));
  const amount = clamp(fruitLeaf.w.add(fruitBl.w.mul(0.8)), 0, 1);
  const noise = mx_noise_float(vec3(along.mul(0.8), up.mul(5.0), r.z.mul(0.1))).mul(0.5).add(0.5);
  const crown = step(0.28, up).mul(step(up, top)).mul(step(noise, amount.mul(0.85).add(0.2)));
  const trunk = step(abs(per), 0.05).mul(step(up, 0.3));
  m.opacityNode = max(crown, trunk); m.alphaTest = 0.5;
  const bmix = fruitBl.w.div(fruitBl.w.add(fruitLeaf.w).max(0.001));
  m.colorNode = mix(mix(vec3(0.3, 0.27, 0.23), mix(fruitLeaf.xyz, fruitBl.xyz, bmix).mul(noise.mul(0.3).add(0.75)), smoothstep(0.1, 0.4, amount)), vec3(0.2, 0.17, 0.13), trunk.mul(float(1).sub(crown)));
  m.normalNode = vec3(0, 0, 1); m.roughnessNode = float(0.85);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'plain-orchards-far'; mesh.frustumCulled = false;
  void normalize; void vec4; void uniform; void lin;
  return mesh;
}
export const TREE_TAG = () => tag(feature('orchards_gardens'), 'trees of the plain: riparian (river_*.riparian), canal lines, orchards (orchards_gardens), woodland (woodland rule); species B, placement and size C; far trees are billboards / row impostors');
