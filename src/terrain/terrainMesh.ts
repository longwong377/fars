// Chunked, distance-LOD terrain meshes for the three rings (brief §6 Streaming; D-006). Each ring is split into
// 128-cell chunks; each chunk picks a power-of-two vertex step by camera distance and hides cracks with skirts.
// Coarser rings skip the chunks covered by the finer ring (the ring extents are chunk-aligned by construction).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionWorld, uniform, vec2, vec3, vec4, float, max, abs, mix, smoothstep, sqrt, dot, texture, normalView, cameraViewMatrix } from 'three/tsl';
import { Ring, Terrain } from './heightfield';
import { surfaceMaterial } from '../render/materials';

interface Chunk { ring: Ring; r0: number; c0: number; cells: number; center: THREE.Vector3; radius: number; lods: Map<number, THREE.BufferGeometry>; mesh: THREE.Mesh; step: number; err: number[] | null }
const STEPS = [1, 2, 4, 8, 16];
/** LOD thresholds (geomipmapping, de Boer 2000): a step is allowed when its worst height error, seen from the camera,
 *  subtends ≤ ERR_RAD (≈ 1.5 px at 1440p / 70° vertical FOV) and its vertex spacing ≤ SPACING_RAD (keeps shading and
 *  silhouettes from turning into large facets even on flat ground) */
const ERR_RAD = 0.0013, SPACING_RAD = 0.02;
/** D-356: whether the near ring casts into the sun's cascades (off; ?tcast=1 for the A/B) */
export const TERRAIN_CASTS = { on: typeof location !== 'undefined' && new URLSearchParams(location.search).get('tcast') === '1' };

/** Ground colour: procedural and tier C. It will be replaced by calibrated materials in Phase 3 (flagged in the dev overlay). */
function groundColour(h: number, slope: number, out: THREE.Color) {
  // alluvial plain: pale buff-brown loam; slopes: limestone scree; very steep: darker rock. D-232: the plain's dry calcareous
  // loam Munsell 10YR 5.5/3 (Y 0.24; was 10YR 4/2, Y 0.12, a moist soil's colour), the rock warm grey-brown 10YR 5/2 and
  // 10YR 3.5/2 (terrainPlain.ts HILL; was a neutral grey): the photographs' and the satellite image's buff mountain and plain
  const soil = [0.606, 0.512, 0.398], rock = [0.530, 0.467, 0.393], dark = [0.381, 0.318, 0.249];
  const s = Math.min(1, Math.max(0, (slope - 0.15) / 0.35)), d = Math.min(1, Math.max(0, (slope - 0.9) / 0.6));
  const c = soil.map((v, i) => v * (1 - s) + rock[i] * s).map((v, i) => v * (1 - d) + dark[i] * d);
  out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
}

/** worst vertical error (m) of each decimation step (STEPS) of the chunk of `cells` cells from sample (r0, c0) against the
 *  full-resolution heights: the bilinear surface of the decimated grid versus every sample it skips (node-side too:
 *  tools/dev/far_pop.ts, which measures the pops on the drawn triangles themselves) */
export function stepErrors(ring: Ring, r0: number, c0: number, cells: number): number[] {
  const H = (r: number, c: number) => ring.at(Math.min(ring.n - 1, r), Math.min(ring.n - 1, c));
  return STEPS.map(s => { if (s === 1) return 0; let worst = 0;
    for (let i = 0; i <= cells; i++) { const ri = Math.floor(i / s) * s, ty = (i - ri) / s, ri2 = Math.min(cells, ri + s);
      for (let j = 0; j <= cells; j++) { const cj = Math.floor(j / s) * s, tx = (j - cj) / s, cj2 = Math.min(cells, cj + s);
        if (!ty && !tx) continue;
        const h = (H(r0 + ri, c0 + cj) * (1 - tx) + H(r0 + ri, c0 + cj2) * tx) * (1 - ty) + (H(r0 + ri2, c0 + cj) * (1 - tx) + H(r0 + ri2, c0 + cj2) * tx) * ty;
        worst = Math.max(worst, Math.abs(h - H(r0 + i, c0 + j))); } }
    return worst; });
}
/** the height inside one grid cell as the mesh draws it: two triangles split along the (r, c+1)-(r+1, c) diagonal (a: (r, c),
 *  b: (r, c+1), c: (r+1, c), d: (r+1, c+1); fx along c, fy along r) */
export const triAt = (a: number, b: number, c: number, d: number, fx: number, fy: number) =>
  fx + fy <= 1 ? a + (b - a) * fx + (c - a) * fy : d + (c - d) * (1 - fx) + (b - d) * (1 - fy);
/** the coarsest step whose height error and vertex spacing, seen from distance d (m), stay under ERR_RAD and SPACING_RAD
 *  divided by the detail bias */
export function pickStep(err: number[], d: number, cell: number, lodBias: number): number {
  let step = 1;
  for (let k = 1; k < STEPS.length; k++) { const s = STEPS[k]; if (err[k] / d <= ERR_RAD / lodBias && (s * cell) / d <= SPACING_RAD / lodBias) step = s; else break; }
  return step;
}
export const TERRAIN_LOD = { STEPS, ERR_RAD, SPACING_RAD } as const;
/** the drawn height of chunk sample (i, j) (0..cells, chunk-relative) on the grid decimated to `step` (its triangles) */
export function decimatedAt(ring: Ring, r0: number, c0: number, cells: number, step: number, i: number, j: number): number {
  const ri = Math.min(cells - step, Math.floor(i / step) * step), cj = Math.min(cells - step, Math.floor(j / step) * step);
  const A = (r: number, c: number) => ring.at(Math.min(ring.n - 1, r0 + r), Math.min(ring.n - 1, c0 + c));
  return triAt(A(ri, cj), A(ri, cj + step), A(ri + step, cj), A(ri + step, cj + step), (j - cj) / step, (i - ri) / step);
}
/** D-600, geomorphing (CDLOD, Strugar 2009): each level's vertices carry their offset to the next coarser level's surface
 *  ('tmorph'), and the chunk slides toward that surface over the last half of its distance band, so when it switches to the
 *  coarser level (or back) the two draw the same surface: no pop. Measured before (tools/dev/far_pop.ts, 515 routes at the
 *  player's lens): 32 pops over 2 px, worst 2.5 px at high; the alternative of a stricter error bound cost +41 % triangles.
 *  The share of the morph (0..1) at camera distance d for the step pickStep chose: */
export function morphShare(err: number[], d: number, cell: number, lodBias: number, step: number): number {
  const k = STEPS.indexOf(step); if (k < 0 || k >= STEPS.length - 1) return 0;
  const at = (q: number) => Math.max((err[q] * lodBias) / ERR_RAD, (STEPS[q] * cell * lodBias) / SPACING_RAD);
  const hi = at(k + 1), lo = Math.max(k ? at(k) : 0, hi * MORPH_FROM);
  return hi <= lo ? 1 : Math.min(1, Math.max(0, (d - lo) / (hi - lo)));
}
/** the morph runs over this share of a level's far distance to its end */
export const MORPH_FROM = 0.5;
/** D-600: the per-pixel ring normals (?ringnormals=0 for the A/B) */
export const TERRAIN_RING_NORMALS = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('ringnormals') === '0') };
/** the per-chunk morph share, read for each drawn chunk (the shadow and coverage passes too) */
const uMorph = uniform(0).onObjectUpdate(({ object }: any) => object?.tmorph ?? 0);
/** the terrain chunks' vertex position: the level's own plus its share of the slide to the coarser level */
export const TERRAIN_MORPH_POSITION = positionLocal.add(vec3(0, attribute('tmorph', 'float').mul(uMorph), 0));

/** D-600: each ring's full-resolution surface normal (x, z; y implied) as a texture the terrain samples per pixel. The
 *  vertex normals were the only lighting normal: on a coarse level they sit 0.02 rad apart (~19 px at the player's lens), so
 *  a far hill shaded as smooth blobs ("a smooth dune", sessions/s11.md) and changed its shading when its level changed. Now
 *  the lighting carries the ring's own 4 / 16 / 80 m detail at every distance and every level. RG8, 127 = 0 (no bias on the
 *  flat plain); one atlas of 4,099 x 1,793 (14.7 MB) */
export function ringNormalData(ring: Ring): Uint8Array {
  const n = ring.n, h = ring.h, k2 = 1 / (2 * ring.cell), out = new Uint8Array(n * n * 2);
  for (let r = 0; r < n; r++) { const ru = (r > 0 ? r - 1 : 0) * n, rd = (r < n - 1 ? r + 1 : n - 1) * n, row = r * n;
    for (let c = 0; c < n; c++) {
      const dx = (h[row + (c < n - 1 ? c + 1 : n - 1)] - h[row + (c > 0 ? c - 1 : 0)]) * k2, dz = (h[rd + c] - h[ru + c]) * k2, il = 127 / Math.sqrt(dx * dx + 1 + dz * dz), k = (row + c) * 2;
      out[k] = 127 - Math.round(dx * il); out[k + 1] = 127 - Math.round(dz * il);
    } }
  return out;
}
/** the decoded normal (world) at byte pair (a, b) */
export const decodeRingNormal = (a: number, b: number): [number, number, number] => { const x = (a - 127) / 127, z = (b - 127) / 127; return [x, Math.sqrt(Math.max(0, 1 - x * x - z * z)), z]; };
/** the per-pixel ring normal node (world): near, mid and far rings blended across the finer ring's edge as the plain's
 *  landform maps are (terrainPlain.ts hillBase) */
function ringNormalNode(terrain: Terrain) {
  // one RG8 atlas, the rings side by side (near, mid, far; one sampler: the plain's material is near the stage's limit)
  const rings = [terrain.near, terrain.mid, terrain.far], W = rings.reduce((a, r) => a + r.n, 0), Ht = Math.max(...rings.map(r => r.n));
  const data = new Uint8Array(W * Ht * 2).fill(127), x0: number[] = [];
  let ox = 0; for (const ring of rings) { const d = ringNormalData(ring), n = ring.n; x0.push(ox);
    for (let r = 0; r < n; r++) data.set(d.subarray(r * n * 2, (r + 1) * n * 2), (r * W + ox) * 2); ox += n; }
  const t = new THREE.DataTexture(data, W, Ht, THREE.RGFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  const q = positionWorld.xz, at = (k: number) => { const ring = rings[k], g = q.add(ring.half).div(ring.cell).clamp(0, ring.n - 1).add(0.5);
    const e = texture(t, g.add(vec2(x0[k], 0)).div(vec2(W, Ht))).rg.mul(255 / 127).sub(1); return vec3(e.x, sqrt(max(float(0), float(1).sub(dot(e, e)))), e.y); };
  const cheb = max(abs(q.x), abs(q.y)), nr = terrain.near, md = terrain.mid;
  const inNear = float(1).sub(smoothstep(nr.half - 96, nr.half - 24, cheb)), inMid = float(1).sub(smoothstep(md.half - 400, md.half - 48, cheb));
  return mix(mix(at(2), at(1), inMid), at(0), inNear).normalize();
}

export class TerrainMesh {
  readonly group = new THREE.Group();
  private chunks: Chunk[] = [];
  private material: THREE.MeshStandardNodeMaterial;
  private morphed: THREE.Material | null = null;
  /** the per-pixel ring normal (world), built on first use */
  private ringN: any = null;
  constructor(readonly terrain: Terrain, private lodBias = 1) {
    this.group.name = 'terrain';
    this.material = surfaceMaterial('earth', { vertexColors: true });
    this.group.userData = { tier: 'B', src: 'COP-DEM', note: 'Copernicus GLO-30 bare-earth approximation (D-006); ground colour procedural C' };
    // the chunks are Terrain.chunks(): the same list the physics colliders are built from (physics.ts, audit D M1)
    for (const tc of terrain.chunks()) {
      const { ring, r0, c0, cells: CH, x0, z0, size } = tc;
      let hmin = Infinity, hmax = -Infinity;
      for (let r = 0; r <= CH; r += 4) for (let c = 0; c <= CH; c += 4) { const h = ring.at(r0 + r, c0 + c); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      const center = new THREE.Vector3(x0 + size / 2, (hmin + hmax) / 2, z0 + size / 2);
      const radius = Math.hypot(size / 2, size / 2, (hmax - hmin) / 2);
      const mesh = new THREE.Mesh(undefined, this.material);
      // D-356: the terrain casts no sun-cascade shadow (TERRAIN_CASTS). At a low sun (dawn, dusk) a heightfield in its own
      // cascades shadows itself across whole cascades (the depth error over one texel is texel / tan(sun altitude): ~1.8 m in
      // the 50-160 m cascade at 3 deg, against its 9 cm bias): the s14 baseline drew the plain from ~50 m out near-black at
      // both hours. The terrain's own shadows at the landform scale are the horizon map's (D-156: every occluder past 40 m);
      // the hills' rock and ledges near the eye are meshes of their own and still cast
      mesh.receiveShadow = true; mesh.castShadow = TERRAIN_CASTS.on && ring === this.terrain.near; mesh.matrixAutoUpdate = false;
      mesh.userData = this.group.userData;
      this.chunks.push({ ring, r0, c0, cells: CH, center, radius, lods: new Map(), mesh, step: -1, err: null });
      this.group.add(mesh);
    }
  }
  private buildGeometry(ch: Chunk, step: number): THREE.BufferGeometry {
    const { ring } = ch, n = ch.cells / step + 1, cell = ring.cell;
    const x0 = -ring.half + ch.c0 * cell, z0 = -ring.half + ch.r0 * cell;
    const verts = n * n + 4 * n; // + skirts
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3), mor = new Float32Array(verts);
    const s2 = step * 2, coarse = STEPS.includes(s2) && ch.cells % s2 === 0;
    const tmp = new THREE.Color();
    const H = (r: number, c: number) => ring.at(Math.min(ring.n - 1, Math.max(0, r)), Math.min(ring.n - 1, Math.max(0, c)));
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = ch.r0 + i * step, c = ch.c0 + j * step, h = H(r, c);
      pos[k * 3] = x0 + j * step * cell; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + i * step * cell;
      const dx = (H(r, c + 1) - H(r, c - 1)) / (2 * cell), dz = (H(r + 1, c) - H(r - 1, c)) / (2 * cell);
      const l = Math.hypot(dx, 1, dz); nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
      groundColour(h, Math.hypot(dx, dz), tmp); col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      if (coarse) mor[k] = decimatedAt(ring, ch.r0, ch.c0, ch.cells, s2, i * step, j * step) - h;
      k++;
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    // skirts: duplicate edge vertices dropped by an amount proportional to the cell size
    const drop = step * cell * 0.6 + 1;
    const edges: number[][] = [[...Array(n).keys()].map(j => j), [...Array(n).keys()].map(j => (n - 1) * n + j), [...Array(n).keys()].map(i => i * n), [...Array(n).keys()].map(i => i * n + n - 1)];
    for (let e = 0; e < 4; e++) {
      const base = k;
      for (const v of edges[e]) { mor[k] = mor[v]; pos.set([pos[v * 3], pos[v * 3 + 1] - drop, pos[v * 3 + 2]], k * 3); nor.set(nor.subarray(v * 3, v * 3 + 3), k * 3); col.set(col.subarray(v * 3, v * 3 + 3), k * 3); k++; }
      for (let t = 0; t < n - 1; t++) { const a = edges[e][t], b = edges[e][t + 1], c = base + t, d = base + t + 1; idx.push(a, c, b, b, c, d, a, b, c, b, d, c); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('tmorph', new THREE.BufferAttribute(mor, 1));
    g.setIndex(verts > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(ch.center, ch.radius);
    return g;
  }
  private chunkErrors(ch: Chunk): number[] { return stepErrors(ch.ring, ch.r0, ch.c0, ch.cells); }
  /** choose LOD per chunk: the coarsest step whose height error and vertex spacing, seen from the camera, stay under
   *  ERR_RAD and SPACING_RAD ÷ lodBias: the bias is a detail factor (high 1; ultra 1.5 finer, test 0.35 coarser). It was a
   *  multiplier, so the scale ran backwards: ultra drew the coarsest terrain (3.3 M tris at the stair-dawn view) and test the
   *  finest (9.9 M) (Phase 6+7 review, session 8, C1) */
  update(camPos: THREE.Vector3) {
    for (const ch of this.chunks) {
      const d = Math.max(1, camPos.distanceTo(ch.center) - ch.radius);
      const err = (ch.err ??= this.chunkErrors(ch));
      const step = pickStep(err, d, ch.ring.cell, this.lodBias);
      (ch.mesh as any).tmorph = morphShare(err, d, ch.ring.cell, this.lodBias, step);
      // the morph rides on whatever material the chunks wear (the plain's replaces this one: plain/index.ts)
      const mat = ch.mesh.material as THREE.MeshStandardNodeMaterial;
      if (mat !== this.morphed) { this.hook(mat); this.morphed = mat; }
      if (step !== ch.step) {
        let g = ch.lods.get(step); if (!g) { g = this.buildGeometry(ch, step); ch.lods.set(step, g); }
        ch.mesh.geometry = g; ch.step = step;
      }
    }
  }
  /** the material's hooks (once per material): the geomorph position, and the ring normal under its own normal: the
   *  material's normal (its bump and tilts over the vertex normal) moved by the ring normal's difference from the vertex's */
  private hook(mat: THREE.MeshStandardNodeMaterial) {
    if ((mat as any).__terrainHooked) return; (mat as any).__terrainHooked = true;
    mat.positionNode = TERRAIN_MORPH_POSITION;
    if (TERRAIN_RING_NORMALS.on) { this.ringN ??= ringNormalNode(this.terrain);
      const nv = cameraViewMatrix.mul(vec4(this.ringN, 0)).xyz;
      mat.normalNode = ((mat.normalNode as any) ?? normalView).add(nv.sub(normalView)).normalize(); }
    mat.needsUpdate = true;
  }
  stats() { let tris = 0; for (const ch of this.chunks) tris += (ch.mesh.geometry.index?.count ?? 0) / 3; return { chunks: this.chunks.length, tris }; }
}
