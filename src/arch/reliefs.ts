// Carved low reliefs (D-019): façade programmes (Apadana stairs, Phase 3; generic registers for Phase 4) placed as carved
// heightfield figures (relief_figures.ts → relief_field.ts), rendered through one BatchedMesh per relief set with a
// level of detail per figure. Figures are procedural low relief, tier C (licensed scans would replace them, NEEDS #10);
// layout B/C per SITE_SPEC; paint per research/RELIEFS_AND_COLOUR.md (hair/beard dark blue B, other colours C).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v } from './spec';
import { Rng } from '../core/rng';
import { FIGURE_KINDS, PIGMENT, DELEGATIONS, SPECIES, defBounds, figureDef, baseKind } from './relief_figures';
const SPECIES_HALF = (k: string) => (SPECIES[k] ? SPECIES[k].L / 2 : 0.3);
import { rasterize, rtinErrors, extractLod, LodMesh, Box, FigureDef } from './relief_field';
import { paintedStoneMaterial } from '../render/materials';
export { FIGURE_KINDS, PIGMENT, DELEGATIONS } from './relief_figures';
export type { KindInfo } from './relief_figures';

/** the carvable figure kinds (see FIGURE_KINDS for tier / source / note of each) */
export const RELIEF_KINDS = Object.keys(FIGURE_KINDS);
export const RELIEF_META = { tier: 'C', src: 'RELIEF-R;MATCULT-R;IR-APAD', placeholder: true, note: 'procedural low relief; licensed scans would replace (NEEDS #10). Carved heightfield figures (D-019); layout B/C; hair/beard dark blue B, other paint C' };

// ---------------- levels of detail ----------------
/** per LOD: target grid cell on the stone (m), largest grid, RTIN error bound (relief-depth units), normal smoothing (cells),
 *  switch distance (m, camera to the figure's bounding sphere). Bands chosen for ≳ 4 px per triangle at 1080p / 70° (D-019):
 *  L0 only at arm's length, where a 1.6 mm cell is ~1 px. */
export const RELIEF_LODS = [
  // L0 grid up to 1025² (D-048): the Phase 4 door-jamb figures are 1.6–3.4 m tall, and at 513² a 2.2 m king had 5 mm cells
  // (≈ 4 px at arm's length); figures under 0.82 m (every Apadana register figure) are unaffected.
  // D-204: L2/L3 prefilter the surface detail (`pre`, relief_field.rasterize) instead of dropping it, and L2 takes its
  // normals over ±2 cells (Sobel; ±1 cell drew the error-driven triangles as a lattice of light and shade). Measured and
  // rejected (tools/relief_budget.ts): L2's grid cap 257² (the audience figures' 14 mm cells → 7 mm: +19 % triangles before
  // the panel at 6 m, +34 % at 2 m), L3's cap 129² (far meshes +76 %), an L2 error bound of 0.07–0.08 (the broad folds only
  // faintly in the mesh, +40 k triangles at 6 m)
  { cell: 0.0016, maxN: 1025, err: 0.03, grad: 1, dist: 1.2, pre: false },
  { cell: 0.0032, maxN: 257, err: 0.06, grad: 1, dist: 4, pre: false },
  { cell: 0.0064, maxN: 129, err: 0.12, grad: 2, dist: 14, pre: true },
  { cell: 0.0128, maxN: 65, err: 0.3, grad: 1, dist: Infinity, pre: true },
];
/** rosettes: carved within ROSETTE_NEAR, a 40-triangle boss within ROSETTE_FAR, not drawn beyond (≤ 1.5 px) */
export const ROSETTE_NEAR = 2.0, ROSETTE_FAR = 40;
const HYST = 1.12; // a finer LOD is dropped only beyond HYST × its switch distance
/** far representation (D-048): WebGPU issues one draw per BatchedMesh instance, so a set's figures are grouped into
 *  spatial chunks of RELIEF_CHUNK m; a chunk whose bounds lie beyond RELIEF_FAR (the coarsest band, where every figure is
 *  at L3 anyway) is drawn as ONE merged mesh of its figures at L3 and its figures leave the batch. Shadows: the figures
 *  cast none (low relief; the 5 cm normal bias of the sun's shadow erases a 4.5 cm relief's self-shadow anyway) except
 *  within RELIEF_SHADOW_RANGE, through the chunk's merged L3 mesh drawn into the shadow maps only. When every chunk of a
 *  set is far, the whole set is one merged mesh (one draw) */
export const RELIEF_CHUNK = 12, RELIEF_FAR = RELIEF_LODS[2].dist, RELIEF_SHADOW_RANGE = 8;
/** grid size (2^k + 1) for a figure whose larger extent on the stone is `extentM` metres, at LOD `lod` */
export function lodGrid(extentM: number, lod: number) {
  const cells = extentM / RELIEF_LODS[lod].cell;
  return Math.min(RELIEF_LODS[lod].maxN, Math.max(17, 2 ** Math.ceil(Math.log2(Math.max(16, cells))) + 1));
}

// ---------------- generation: cache, worker pool, synchronous fallback ----------------
const meshCache = new Map<string, LodMesh>();          // key = kind|seed|n|lod
const bounds = new Map<string, Box>();
export const genStats = { generated: 0, ms: 0, workerJobs: 0 };
const defs = new Map<string, FigureDef>();
/** figure definitions are pure data + SDF closures: built once per kind and seed */
const defOf = (kind: string, seed: number) => { const k = kind + '|' + seed; let d = defs.get(k); if (!d) { d = figureDef(kind, seed); defs.set(k, d); } return d; };
const boundsOf = (kind: string, seed: number) => { const k = kind + '|' + seed; let b = bounds.get(k); if (!b) { b = defBounds(defOf(kind, seed)); bounds.set(k, b); } return b; };
/** synchronous generation of one LOD mesh (node / tests / no-Worker fallback) */
export function reliefLodMesh(kind: string, seed: number, n: number, lod: number): LodMesh {
  const key = `${kind}|${seed}|${n}|${lod}`; let m = meshCache.get(key); if (m) return m;
  const t0 = performance.now();
  const f = rasterize(defOf(kind, seed), n, RELIEF_LODS[lod].pre); m = extractLod(f, rtinErrors(f), RELIEF_LODS[lod].err, RELIEF_LODS[lod].grad, PIGMENT.stone);
  genStats.generated++; genStats.ms += performance.now() - t0;
  meshCache.set(key, m); return m;
}
class WorkerPool {
  private workers: Worker[] = []; private idle: Worker[] = []; private queue: { key: string; job: any }[] = []; private waiting = new Map<number, string>(); private nextId = 1;
  readonly pending = new Set<string>();
  onDone: (() => void) | null = null;
  constructor(n: number) {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./relief_worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent) => { const key = this.waiting.get(e.data.id)!; this.waiting.delete(e.data.id); this.pending.delete(key);
        if (e.data.mesh) { meshCache.set(key, e.data.mesh); genStats.generated++; } else console.error('relief worker', key, e.data.error);
        this.idle.push(w); this.pump(); this.onDone?.(); };
      w.onerror = e => console.error('relief worker error', e.message);
      this.workers.push(w); this.idle.push(w);
    }
  }
  request(key: string, kind: string, seed: number, n: number, lod: number) {
    if (this.pending.has(key) || meshCache.has(key)) return;
    this.pending.add(key); this.queue.push({ key, job: { kind, seed, n, err: RELIEF_LODS[lod].err, grad: RELIEF_LODS[lod].grad, pre: RELIEF_LODS[lod].pre } }); this.pump();
  }
  /** jobs are served nearest-first: the caller re-sorts by priority before pumping */
  prioritise(prio: (key: string) => number) { this.queue.sort((a, b) => prio(a.key) - prio(b.key)); }
  private pump() {
    while (this.idle.length && this.queue.length) { const w = this.idle.pop()!, q = this.queue.shift()!, id = this.nextId++; this.waiting.set(id, q.key); genStats.workerJobs++; w.postMessage({ id, ...q.job }); }
  }
}
let pool: WorkerPool | null | undefined;
function workers(): WorkerPool | null {
  if (pool !== undefined) return pool;
  try { pool = typeof Worker !== 'undefined' && typeof window !== 'undefined' ? new WorkerPool(Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 2) - 1))) : null; }
  catch (e) { console.warn('relief workers unavailable, generating on the main thread', e); pool = null; }
  if (pool) pool.onDone = () => { for (const s of liveSets) s.dirty = true; };
  return pool;
}

// ---------------- geometry: LOD mesh → BufferGeometry in the normalised frame (x, y figure units; z relief-depth units) ----------------
export function lodGeometry(m: LodMesh, mirror: boolean): THREE.BufferGeometry {
  const nv = m.verts, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), sx = mirror ? -1 : 1;
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = m.pos[i * 3] * sx; pos[i * 3 + 1] = m.pos[i * 3 + 1]; pos[i * 3 + 2] = m.pos[i * 3 + 2];
    const nx = -m.grad[i * 2] * sx, ny = -m.grad[i * 2 + 1], l = Math.sqrt(nx * nx + ny * ny + 1);
    nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = 1 / l;
  }
  const idx = new Uint32Array(m.index);
  if (mirror) for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(m.col), 3)); g.setAttribute('paint', new THREE.BufferAttribute(new Float32Array(m.paint), 1));
  g.setAttribute('gilt', new THREE.BufferAttribute(new Float32Array(m.gilt ?? new Float32Array(nv)), 1)); // gold leaf (D-151)
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ---------------- relief sets ----------------
/** one carved figure on a wall: origin on the wall face at the figure's ground line, unit along-wall / up / out-of-wall axes */
export interface ReliefItem { kind: string; seed: number; o: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; Z: THREE.Vector3; S: number; D: number; mirror: boolean; meta?: Record<string, unknown>;
  /** finest LOD this item is ever drawn at (D-204: the audience canopy, above head height, is never at arm's length) */
  minLod?: number }
export interface RosetteItem { o: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; Z: THREE.Vector3; S: number; D: number }
const liveSets = new Set<ReliefSet>();
let reliefMat: THREE.MeshStandardNodeMaterial | null = null;
/** carved limestone with a matte mineral paint film (D-030): no masonry joints, paint coverage per vertex */
const paintMaterial = () => reliefOverride ?? (reliefMat ??= paintedStoneMaterial());
/** the Now view (D-201): relief meshes made while it is on (streamed LODs) take this material, bare weathered stone */
let reliefOverride: THREE.MeshStandardNodeMaterial | null = null;
export function setReliefMaterialOverride(m: THREE.MeshStandardNodeMaterial | null) { reliefOverride = m; }
const carving = () => v<any>('apadana', 'r_relief_carving');
let proxyMat: THREE.MeshBasicNodeMaterial | null = null;
/** shadow proxies (D-048) write nothing in the view passes (no colour, no depth) and are drawn into the shadow maps with
 *  both faces, since a relief heightfield is an open surface */
const shadowProxyMaterial = () => (proxyMat ??= Object.assign(new THREE.MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false }), { shadowSide: THREE.DoubleSide }));
/** a spatial chunk of a relief set: its figures, bounds (world, padded by each figure's radius), merged far mesh and proxy */
interface Chunk { items: number[]; lo: THREE.Vector3; hi: THREE.Vector3; far: THREE.Mesh | null; proxy: THREE.Mesh | null; isFar: boolean; tris: number }

export class ReliefSet extends THREE.Group {
  readonly items: ReliefItem[]; readonly batch: THREE.BatchedMesh | null = null;
  dirty = true;
  private inst: number[] = []; private level: Int8Array; private shown: Int8Array; private grids: number[][] = []; private centres: Float32Array;
  private geoIds = new Map<string, number>(); private geoUse = new Map<string, number>(); private lastCam = new THREE.Vector3(Infinity, 0, 0);
  private rosNear: THREE.InstancedMesh | null = null; private rosettes: RosetteItem[]; private rosMats: THREE.Matrix4[] = [];
  private mats: THREE.Matrix4[] = []; private chunks: Chunk[] = []; private chunkOf: Int32Array;
  /** the whole set merged at L3, drawn instead of the far chunks while every chunk is far (D-048) */
  private whole: THREE.Mesh | null = null;
  /** triangles and draw ranges currently submitted (before frustum culling): per-figure batch instances, merged far
   *  chunks, shadow proxies and the two rosette meshes */
  stats = { tris: 0, byLod: [0, 0, 0, 0], rosetteTris: 0, pending: 0, farTris: 0, draws: 0, farChunks: 0, farDraws: 0, proxies: 0, chunks: 0 };

  /** hideBeyond (m): the set is not drawn (and its LOD work stops) while the camera is farther than this from its bounds;
   *  for sets seen only from kilometres away, where every figure is under a pixel (Naqsh-e Rustam, D-069) */
  private bounds = new THREE.Box3();
  constructor(items: ReliefItem[], rosettes: RosetteItem[] = [], name = 'reliefs', private hideBeyond = Infinity) {
    super(); this.name = name; this.userData = { ...RELIEF_META };
    this.items = items; this.rosettes = rosettes;
    const n = items.length; this.level = new Int8Array(n).fill(-1); this.shown = new Int8Array(n).fill(-1); this.centres = new Float32Array(n * 4); this.chunkOf = new Int32Array(n);
    const byKey = new Map<string, Chunk>();
    items.forEach((it, i) => {
      const b = boundsOf(it.kind, it.seed), ext = Math.max(b[2] - b[0], b[3] - b[1]) * it.S;
      this.grids.push(RELIEF_LODS.map((_, l) => lodGrid(ext, l)));
      const cx = ((b[0] + b[2]) / 2) * (it.mirror ? -1 : 1) * it.S, cy = ((b[1] + b[3]) / 2) * it.S;
      const c = it.o.clone().addScaledVector(it.X, cx).addScaledVector(it.Y, cy), r = (Math.hypot(b[2] - b[0], b[3] - b[1]) / 2) * it.S;
      this.centres.set([c.x, c.y, c.z, r], i * 4);
      const k = [c.x, c.y, c.z].map(q => Math.floor(q / RELIEF_CHUNK)).join(',');
      let ch = byKey.get(k); if (!ch) { ch = { items: [], lo: new THREE.Vector3(Infinity, Infinity, Infinity), hi: new THREE.Vector3(-Infinity, -Infinity, -Infinity), far: null, proxy: null, isFar: false, tris: 0 }; byKey.set(k, ch); this.chunks.push(ch); }
      ch.items.push(i); this.chunkOf[i] = this.chunks.indexOf(ch);
      ch.lo.min(new THREE.Vector3(c.x - r, c.y - r, c.z - r)); ch.hi.max(new THREE.Vector3(c.x + r, c.y + r, c.z + r));
      this.bounds.expandByPoint(ch.lo).expandByPoint(ch.hi);
      this.mats.push(new THREE.Matrix4().makeBasis(it.X.clone().multiplyScalar(it.S), it.Y.clone().multiplyScalar(it.S), it.Z.clone().multiplyScalar(it.D)).setPosition(it.o.clone().addScaledVector(it.Z, -carving().embed)));
    });
    // coarsest LOD of every figure: synchronously when there is no worker pool (node, tests), so the set is complete at
    // once; in the browser the workers generate it and figures appear as their meshes arrive (main thread stays free)
    const wp = workers(); let nv = 0, ni = 0; const seen = new Set<string>();
    items.forEach((it, i) => { const k = this.key(i, 3, false); if (seen.has(k)) return; seen.add(k);
      if (wp) { wp.request(k, it.kind, it.seed, this.grids[i][3], 3); nv += 600; ni += 3000; }
      else { const m = reliefLodMesh(it.kind, it.seed, this.grids[i][3], 3); nv += m.verts; ni += m.index.length; } });
    if (n) {
      (this as any).batch = new THREE.BatchedMesh(n, Math.max(4096, nv * 3 + 200_000), Math.max(12288, ni * 3 + 600_000), paintMaterial());
      // no shadow from the batch (D-048): near chunks cast theirs through a merged coarse proxy
      const bm = this.batch!; bm.name = 'relief:figures'; bm.userData = { ...RELIEF_META }; bm.castShadow = false; bm.receiveShadow = true; bm.sortObjects = false; bm.perObjectFrustumCulled = true;
      let placeholder = -1;
      items.forEach((it, i) => {
        const gid = this.geomId(i, 3);
        if (gid === null && placeholder < 0) { const e = new THREE.BufferGeometry(); e.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)); e.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); e.setAttribute('color', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)); e.setAttribute('paint', new THREE.Float32BufferAttribute([0, 0, 0], 1)); e.setAttribute('gilt', new THREE.Float32BufferAttribute([0, 0, 0], 1)); e.setIndex([0, 1, 2]); placeholder = bm.addGeometry(e); }
        const id = bm.addInstance(gid ?? placeholder);
        bm.setMatrixAt(id, this.mats[i]); this.inst.push(id);
        if (gid !== null) { this.level[i] = 3; this.shown[i] = 3; this.use(this.key(i, 3), 1); } else bm.setVisibleAt(id, false);
      });
      bm.computeBoundingBox(); bm.computeBoundingSphere(); bm.frustumCulled = false; // per-instance culling does the work
      this.add(bm);
    }
    if (rosettes.length) this.buildRosettes();
    this.countTris(); liveSets.add(this);
  }
  private key(i: number, lod: number, withMirror = true) { const it = this.items[i]; return `${it.kind}|${it.seed}|${this.grids[i][lod]}|${lod}` + (withMirror ? (it.mirror ? '|m' : '|n') : ''); }
  private use(k: string, d: number) { this.geoUse.set(k, (this.geoUse.get(k) ?? 0) + d); }
  /** geometry id for item i at a LOD (adds it to the batch if its mesh is ready; null if not generated yet) */
  private geomId(i: number, lod: number): number | null {
    const k = this.key(i, lod); let id = this.geoIds.get(k); if (id !== undefined) return id;
    const m = meshCache.get(this.key(i, lod, false)); if (!m) return null;
    const g = lodGeometry(m, this.items[i].mirror), bm = this.batch!;
    const vc = g.getAttribute('position').count, ic = g.index!.count;
    if ((bm as any)._nextVertexStart + vc > (bm as any)._maxVertexCount || (bm as any)._nextIndexStart + ic > (bm as any)._maxIndexCount) this.makeRoom(vc, ic);
    id = bm.addGeometry(g); g.dispose(); this.geoIds.set(k, id); return id;
  }
  /** free batch space: drop geometries no instance uses, repack, and grow if still short */
  private makeRoom(vc: number, ic: number) {
    const bm = this.batch! as any;
    for (const [k, id] of this.geoIds) if ((this.geoUse.get(k) ?? 0) <= 0 && !k.includes('|3|')) { bm.deleteGeometry(id); this.geoIds.delete(k); this.geoUse.delete(k); }
    bm.optimize();
    if (bm._nextVertexStart + vc > bm._maxVertexCount || bm._nextIndexStart + ic > bm._maxIndexCount)
      bm.setGeometrySize(Math.ceil((bm._maxVertexCount + vc) * 1.5), Math.ceil((bm._maxIndexCount + ic) * 1.5));
  }
  private wanted(i: number, d: number) {
    const cur = this.level[i]; let l = Math.max(this.items[i].minLod ?? 0, RELIEF_LODS.findIndex(x => d < x.dist));
    if (cur >= 0 && l > cur && d < RELIEF_LODS[cur].dist * HYST) l = cur; // hysteresis: keep the finer level a little longer
    return l;
  }
  /** merge a chunk's figures at L3 into one mesh (far representation) and its shadow proxy; false while an L3 mesh is missing */
  private buildFar(ch: Chunk): boolean {
    for (const i of ch.items) if (!meshCache.has(this.key(i, 3, false))) return false;
    const geos = ch.items.map(i => lodGeometry(meshCache.get(this.key(i, 3, false))!, this.items[i].mirror).applyMatrix4(this.mats[i]));
    const g = mergeGeometries(geos)!; geos.forEach(q => q.dispose()); g.computeBoundingSphere();
    ch.tris = g.index!.count / 3;
    const meta = { ...RELIEF_META, note: 'far representation: the chunk\'s figures merged at the coarsest LOD (D-048); ' + RELIEF_META.note };
    ch.far = new THREE.Mesh(g, paintMaterial()); ch.far.name = 'relief:far'; ch.far.userData = meta; ch.far.castShadow = false; ch.far.receiveShadow = true; ch.far.visible = false;
    ch.proxy = new THREE.Mesh(g, shadowProxyMaterial()); ch.proxy.name = 'relief:shadow-proxy'; ch.proxy.userData = { ...meta, note: 'shadow proxy (D-048): drawn into the shadow maps only; ' + RELIEF_META.note }; ch.proxy.castShadow = true; ch.proxy.receiveShadow = false; ch.proxy.visible = false; ch.proxy.raycast = () => {}; // never picked
    this.add(ch.far, ch.proxy);
    return true;
  }
  /** far chunks (one merged mesh each) and shadow proxies for the camera position; the figures of a far chunk leave the batch */
  private updateChunks(cam: THREE.Vector3) {
    let far = 0, prox = 0;
    for (const ch of this.chunks) {
      const dx = Math.max(ch.lo.x - cam.x, 0, cam.x - ch.hi.x), dy = Math.max(ch.lo.y - cam.y, 0, cam.y - ch.hi.y), dz = Math.max(ch.lo.z - cam.z, 0, cam.z - ch.hi.z), d = Math.hypot(dx, dy, dz);
      if (!ch.far) this.buildFar(ch);
      const wantFar = ch.far !== null && d > RELIEF_FAR * (ch.isFar ? 1 : HYST);
      // a hidden instance is parked on its L3 geometry, which is never deleted (BatchedMesh.deleteGeometry removes the
      // instances that still reference a geometry)
      if (wantFar && !ch.isFar) for (const i of ch.items) if (this.shown[i] >= 0) { this.use(this.key(i, this.shown[i]), -1); const g3 = this.geomId(i, 3); if (g3 !== null) this.batch!.setGeometryIdAt(this.inst[i], g3); this.batch!.setVisibleAt(this.inst[i], false); this.shown[i] = -1; }
      ch.isFar = wantFar;
      if (ch.far) { ch.far.visible = wantFar; ch.proxy!.visible = d < RELIEF_SHADOW_RANGE; if (wantFar) far++; if (d < RELIEF_SHADOW_RANGE) prox++; }
    }
    // every chunk far: the whole set as one mesh instead of one per chunk
    const allFar = far === this.chunks.length && far > 0;
    if (allFar && !this.whole) {
      const g = mergeGeometries(this.chunks.map(ch => ch.far!.geometry))!; g.computeBoundingSphere();
      this.whole = new THREE.Mesh(g, paintMaterial()); this.whole.name = 'relief:far-set';
      this.whole.userData = { ...RELIEF_META, note: 'far representation: the whole set merged at the coarsest LOD while every chunk is far (D-048); ' + RELIEF_META.note };
      this.whole.castShadow = false; this.whole.receiveShadow = true; this.add(this.whole);
    }
    if (this.whole) this.whole.visible = allFar;
    if (allFar) for (const ch of this.chunks) ch.far!.visible = false;
    this.stats.farChunks = far; this.stats.farDraws = allFar ? 1 : far; this.stats.proxies = prox; this.stats.chunks = this.chunks.length;
  }
  /** choose each figure's LOD for the camera position; request missing meshes (workers) or build them within budgetMs (sync) */
  update(cam: THREE.Vector3, budgetMs = 4) {
    if (!this.batch) return;
    if (this.hideBeyond < Infinity) {
      const hide = this.bounds.distanceToPoint(cam) > this.hideBeyond;
      if (hide === this.visible) { this.visible = !hide; this.dirty = true; }
      if (hide) return;
    }
    const moved = cam.distanceToSquared(this.lastCam) > 0.04;
    if (!moved && !this.dirty) return;
    this.dirty = false; if (moved) this.lastCam.copy(cam);
    this.updateChunks(cam);
    const wp = workers(), t0 = performance.now(), dist = new Float32Array(this.items.length), c = this.centres;
    for (let i = 0; i < this.items.length; i++) dist[i] = Math.max(0, Math.hypot(cam.x - c[i * 4], cam.y - c[i * 4 + 1], cam.z - c[i * 4 + 2]) - c[i * 4 + 3]);
    const order = Array.from(dist.keys()).filter(i => !this.chunks[this.chunkOf[i]].isFar).sort((a, b) => dist[a] - dist[b]);
    let pending = 0;
    for (const i of order) {
      const want = this.wanted(i, dist[i]); this.level[i] = want;
      let show = want;
      if (!meshCache.has(this.key(i, want, false))) {
        const it = this.items[i];
        if (wp) { wp.request(this.key(i, want, false), it.kind, it.seed, this.grids[i][want], want); pending++; if (this.shown[i] < 0 && want !== 3) wp.request(this.key(i, 3, false), it.kind, it.seed, this.grids[i][3], 3); }
        else if (performance.now() - t0 < budgetMs) reliefLodMesh(it.kind, it.seed, this.grids[i][want], want);
        else { pending++; this.dirty = true; }
        if (!meshCache.has(this.key(i, want, false))) { // fall back to the nearest generated level (coarser first)
          show = -1; for (let l = want + 1; l < 4 && show < 0; l++) if (meshCache.has(this.key(i, l, false))) show = l;
          for (let l = want - 1; l >= 0 && show < 0; l--) if (meshCache.has(this.key(i, l, false))) show = l;
        }
      }
      if (show !== this.shown[i] && show >= 0) {
        const gid = this.geomId(i, show); if (gid === null) continue;
        if (this.shown[i] >= 0) this.use(this.key(i, this.shown[i]), -1); else this.batch.setVisibleAt(this.inst[i], true);
        this.use(this.key(i, show), 1); this.batch.setGeometryIdAt(this.inst[i], gid); this.shown[i] = show;
      }
    }
    if (wp) wp.prioritise(k => { let best = Infinity; for (let i = 0; i < this.items.length; i++) if (k.startsWith(this.items[i].kind + '|' + this.items[i].seed + '|')) best = Math.min(best, dist[i]); return best; });
    this.stats.pending = pending;
    this.updateRosettes(cam);
    this.countTris();
  }
  private countTris() {
    this.stats.byLod = [0, 0, 0, 0]; this.stats.tris = 0; let inBatch = 0;
    for (let i = 0; i < this.items.length; i++) { if (this.shown[i] < 0) continue; inBatch++; const m = meshCache.get(this.key(i, this.shown[i], false)); if (m) { this.stats.byLod[this.shown[i]] += m.tris; this.stats.tris += m.tris; } }
    this.stats.farTris = this.chunks.reduce((s, ch) => s + (ch.isFar ? ch.tris : 0), 0);
    this.stats.tris += this.stats.farTris + this.stats.rosetteTris;
    // view-pass draw ranges before frustum culling (WebGPU: one per batch instance, one per mesh); proxies add one each
    // (they write nothing in the view) and are the only relief draws in the shadow passes
    this.stats.draws = inBatch + this.stats.farDraws + this.stats.proxies + (this.rosNear && this.rosNear.count ? 1 : 0) + (this.rosFar && this.rosFar.count ? 1 : 0);
  }
  /** rosettes (tiny and numerous, so instanced rather than batched): carved LOD near the camera, a painted boss in the mid
   *  range, nothing beyond ROSETTE_FAR; both lists are rebuilt from the camera position */
  private buildRosettes() {
    const RS = this.rosettes, emb = carving().embed, mtx = new THREE.Matrix4();
    for (const r of RS) this.rosMats.push(mtx.clone().makeBasis(r.X.clone().multiplyScalar(r.S), r.Y.clone().multiplyScalar(r.S), r.Z.clone().multiplyScalar(r.D)).setPosition(r.o.clone().addScaledVector(r.Z, -emb)));
    const nearMesh = reliefLodMesh('rosette', 0, lodGrid(RS[0].S * 1.04, 1), 2), meta = { ...RELIEF_META, note: 'rosette border bands (motif from reconstructions, C); ' + RELIEF_META.note };
    const mk = (g: THREE.BufferGeometry, name: string, shadow: boolean) => { const m = new THREE.InstancedMesh(g, paintMaterial(), RS.length); m.count = 0; m.name = name; m.userData = meta; m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; this.add(m); return m; };
    this.rosNear = mk(lodGeometry(nearMesh, false), 'relief:rosettes-carved', true);
    this.rosFar = mk(rosetteBoss(), 'relief:rosettes', false);
    this.rosTris = [nearMesh.tris, this.rosFar.geometry.index!.count / 3];
  }
  private rosFar: THREE.InstancedMesh | null = null; private rosTris = [0, 0];
  private updateRosettes(cam: THREE.Vector3) {
    const near = this.rosNear, far = this.rosFar; if (!near || !far) return;
    let kn = 0, kf = 0;
    for (let i = 0; i < this.rosettes.length; i++) {
      const o = this.rosettes[i].o; if (Math.abs(o.x - cam.x) > ROSETTE_FAR || Math.abs(o.z - cam.z) > ROSETTE_FAR) continue;
      const d = o.distanceTo(cam); if (d < ROSETTE_NEAR) near.setMatrixAt(kn++, this.rosMats[i]); else if (d < ROSETTE_FAR) far.setMatrixAt(kf++, this.rosMats[i]);
    }
    near.count = kn; far.count = kf; near.instanceMatrix.needsUpdate = true; far.instanceMatrix.needsUpdate = true;
    this.stats.rosetteTris = kn * this.rosTris[0] + kf * this.rosTris[1];
  }
  dispose() { liveSets.delete(this); this.batch?.dispose(); this.rosNear?.dispose(); this.rosFar?.dispose(); for (const ch of this.chunks) ch.far?.geometry.dispose(); this.whole?.geometry.dispose(); }
}

/** the mid-range rosette: an octagonal painted boss (Egyptian blue, yellow-ochre centre), 40 triangles, same frame as the carved one */
function rosetteBoss(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [], lin = (c: number[]) => c.map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const blue = lin(PIGMENT.egyptianBlue), yel = lin(PIGMENT.yellowOchre), rings: [number, number, number[]][] = [[0.12, 0.9, yel], [0.3, 0.62, blue], [0.49, 0.05, blue]];
  pos.push(0, 0.5, 0.95); col.push(...yel);
  for (const [r, z, c] of rings) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; pos.push(Math.cos(a) * r, 0.5 + Math.sin(a) * r, z); col.push(...c); }
  for (let k = 0; k < 8; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 8));
  for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 8; k++) { const a = 1 + ring * 8 + k, b = 1 + ring * 8 + ((k + 1) % 8), c = a + 8, d = b + 8; idx.push(a, c, d, a, d, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('paint', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(1), 1)); g.setAttribute('gilt', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0), 1)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** per-frame hook (world.update): LOD selection for every live relief set; budgetMs bounds main-thread generation when no Worker exists */
export function updateReliefs(cam: THREE.Vector3, budgetMs = 4) { for (const s of liveSets) s.update(cam, budgetMs); }
/** meshes still being generated for the current views */
export function reliefsPending() { let n = 0; for (const s of liveSets) n += s.stats.pending; return n + (pool ? pool.pending.size : 0); }
/** resolves when every requested relief mesh is generated and shown (tests / screenshots) */
export async function settleReliefs(cam: THREE.Vector3, timeoutMs = 60_000) {
  const t0 = performance.now();
  for (;;) { for (const s of liveSets) { s.dirty = true; s.update(cam, 1e9); } if (reliefsPending() === 0 || performance.now() - t0 > timeoutMs) return; await new Promise(r => setTimeout(r, 30)); }
}
export function reliefStats() { const out = { sets: liveSets.size, tris: 0, byLod: [0, 0, 0, 0], farTris: 0, draws: 0, farChunks: 0, farDraws: 0, proxies: 0, chunks: 0, pending: reliefsPending(), generated: genStats.generated, workerJobs: genStats.workerJobs };
  for (const s of liveSets) { out.tris += s.stats.tris; out.farTris += s.stats.farTris; out.draws += s.stats.draws; out.farChunks += s.stats.farChunks; out.farDraws += s.stats.farDraws; out.proxies += s.stats.proxies; out.chunks += s.stats.chunks; s.stats.byLod.forEach((t, i) => (out.byLod[i] += t)); } return out; }

// ---------------- generic register API (Phase 4 programmes) ----------------
type V3 = THREE.Vector3 | [number, number, number];
const vec = (a: V3) => (Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : a.clone());
export interface RegisterFigure { kind: string; seed?: number; at?: number; scale?: number; dy?: number; facing?: 1 | -1 }
export interface RegisterSpec {
  /** world point on the wall face at the register's left end (as the viewer faces the wall) */
  start: V3;
  /** horizontal unit direction along the wall, viewer's left → right */
  dir: V3;
  length: number;
  /** world y of the register's ground line (default start.y) */
  baseY?: number;
  /** register height (m): a standing figure incl. headgear fills r_relief_carving.figure_fill of it */
  height: number;
  /** procession direction along dir (+1: figures walk toward the right end) */
  facing: 1 | -1;
  /** in procession order (the leader first); `at` = distance from the start (m) overrides the automatic spacing */
  figures: RegisterFigure[];
  normal?: V3; depth?: number; slope?: number; gap?: number; rosettes?: 'below' | 'above' | 'both'; name?: string;
}
/** Place one register of carved figures on any wall span; returns a relief set (a THREE.Group) that manages its own LOD
 *  once `updateReliefs` runs each frame (world.ts does). */
export function buildRegister(spec: RegisterSpec): ReliefSet {
  const { items, rosettes } = registerItems(spec);
  return new ReliefSet(items, rosettes, spec.name ?? 'relief-register');
}
export function registerItems(spec: RegisterSpec): { items: ReliefItem[]; rosettes: RosetteItem[] } {
  const X = vec(spec.dir).setY(0).normalize(), Y = new THREE.Vector3(0, 1, 0), Z = spec.normal ? vec(spec.normal).normalize() : X.clone().cross(Y).normalize();
  const start = vec(spec.start); if (spec.baseY !== undefined) start.y = spec.baseY;
  const CV = carving(), figH = spec.height * CV.figure_fill, D: number = spec.depth ?? v<number>('apadana', 'r_relief_depth'), gap = spec.gap ?? 0, slope = spec.slope ?? 0;
  const items: ReliefItem[] = [];
  let cursor = 0;
  for (const f of spec.figures) {
    if (!FIGURE_KINDS[baseKind(f.kind)]) throw new Error(`relief kind ${f.kind} unknown (see RELIEF_KINDS)`);
    const s = f.scale ?? 1, w = FIGURE_KINDS[baseKind(f.kind)].w * figH * s;
    const at = f.at ?? (spec.facing > 0 ? spec.length - cursor - w / 2 : cursor + w / 2);
    cursor += w + gap;
    if (at < 0 || at > spec.length) continue; // does not fit
    const facing = f.facing ?? spec.facing;
    items.push({ kind: f.kind, seed: f.seed ?? 0, o: start.clone().addScaledVector(X, at).addScaledVector(Y, (f.dy ?? 0) + slope * at), X, Y, Z, S: figH * s, D, mirror: facing < 0 });
  }
  const rosettes: RosetteItem[] = [];
  if (spec.rosettes) { const RS = v<any>('apadana', 'r_rosette');
    for (const where of spec.rosettes === 'both' ? ['below', 'above'] : [spec.rosettes]) for (let a = RS.pitch / 2; a < spec.length; a += RS.pitch)
      rosettes.push({ o: start.clone().addScaledVector(X, a).addScaledVector(Y, slope * a + (where === 'below' ? -RS.diameter - 0.01 : spec.height + 0.01)), X, Y, Z, S: RS.diameter, D: D * 0.6 }); }
  return { items, rosettes };
}

// ---------------- the Apadana stair façades ----------------
export interface Facade { id: 'N' | 'E'; origin: [number, number]; along: [number, number]; normal: [number, number]; length: number; y0: number; height: number }
export interface Span { a0: number; a1: number; type: 'flight' | 'landing'; rise: 1 | -1 }
/** kind, seed (variant), along-façade position (m), base height above the façade foot (m), facing, scale (× register figure height) */
export interface Placement { kind: string; variant: number; along: number; y: number; facing: 1 | -1; scale: number; depth?: number; minLod?: number }
export interface StairGeom { spans: Span[]; riser: number; tread: number; parapet: number; podium: number }

/** Plan the reliefs on one façade from the stair spans (all dimensions from SITE_SPEC via the terrace manifest).
 *  Viewer's left → right = −L/2 → +L/2. Outer landings carry the registers (delegations on one wing, nobles and guards on
 *  the other, per apadana.relief_programme). Flights carry the lion-and-bull combat in the triangle under the slope and a
 *  cypress row along the parapet. The central landing carries the audience panel (planAudience). */
export function planFacade(f: Facade, g: StairGeom): { figures: Placement[]; rosettes: { a: number; y: number }[] } {
  const prog = v<any>('apadana', 'relief_programme')[f.id], R = v<any>('apadana', 'r_registers'), sp = v('apadana', 'r_figure_spacing');
  const RS = v<any>('apadana', 'r_rosette'), CY = v<any>('apadana', 'r_cypress_band'), CV = v<any>('apadana', 'r_relief_carving'), nDel = v('apadana', 'r_delegation_members');
  const figH = R.height * CV.figure_fill, wOf = (k: string) => FIGURE_KINDS[k].w * figH;
  const out: Placement[] = [], ros: { a: number; y: number }[] = [], rng = new Rng(1, 'relief-' + f.id);
  const wings = g.spans.filter(s => s.type === 'landing' && Math.abs((s.a0 + s.a1) / 2) > 1);
  const delegWings = wings.filter(x => prog[((x.a0 + x.a1) / 2 < 0 ? 'left' : 'right') + '_wing'] !== 'nobles').length;
  let delegIdx = 0;
  for (const w of wings) {
    const wing = (w.a0 + w.a1) / 2 < 0 ? 'left' : 'right', content = prog[wing + '_wing'];
    const facing: 1 | -1 = wing === 'left' ? 1 : -1; // processions walk toward the centre
    for (let r = 0; r < R.count; r++) {
      const y = R.bottom + r * (R.height + R.gap);
      for (let a = w.a0 + RS.pitch / 2; a < w.a1; a += RS.pitch) ros.push({ a, y: y - R.gap / 2 }); // band under each register
      if (content === 'nobles') { // bottom register: guards; above: Persian and Median nobles alternating (B)
        let k = 0; for (let a = w.a0 + sp / 2; a < w.a1 - sp / 2; a += sp, k++)
          out.push({ kind: r === 0 ? (k % 4 === 3 ? 'mede_guard' : 'guard') : (k % 2 ? 'mede' : 'persian'), variant: rng.int(0, 3), along: a, y, facing, scale: 1 });
      } else { // delegations, each led by an usher and separated by a cypress (B); the leader nearest the centre
        // offsets behind the leader in figure heights (C): cypress, usher, the delegate he leads by the hand (hands meet),
        // the animal handler with the animal behind him on a lead, then gift bearers at the file spacing
        const perReg = Math.ceil(DELEGATIONS.length / (R.count * delegWings)), u = figH, file = sp / u;
        let a = facing > 0 ? w.a1 - wOf('cypress') : w.a0 + wOf('cypress'); const step = -facing;
        for (let n = 0; n < perReg && delegIdx < DELEGATIONS.length; n++) {
          const di = delegIdx, d = DELEGATIONS[di], group: Placement[] = [];
          const put = (kind: string, seed: number, off: number) => group.push({ kind, variant: seed, along: a + step * off * u, y, facing, scale: 1 });
          let o = 0; put('cypress', 0, o);
          o += 0.42; put('usher', di, o);
          o += 0.4; put('delegate', di * 10, o);
          for (let m = 1; m < nDel - 1; m++) {
            if (m === 1 && d.animal) { o += file * 0.8; put('delegate', di * 10 + 1, o); o += 0.3 + SPECIES_HALF(d.animal) + 0.62; put(d.animal, 0, o); o += SPECIES_HALF(d.animal) + 0.2; }
            else { o += file; put('delegate', di * 10 + m + 1, o); }
          }
          o += 0.42;
          const end = a + step * o * u;
          if (end < w.a0 + 0.1 || end > w.a1 - 0.1) break; // the delegation does not fit on this register
          out.push(...group); a = end; delegIdx++;
        }
      }
    }
    for (let a = w.a0 + RS.pitch / 2; a < w.a1; a += RS.pitch) ros.push({ a, y: R.bottom + R.count * (R.height + R.gap) - R.gap / 2 });
  }
  for (const s of g.spans.filter(x => x.type === 'flight')) {
    const len = s.a1 - s.a0, slope = g.riser / g.tread, low = s.rise > 0 ? s.a0 : s.a1, dir = s.rise;
    // lion attacking bull in the triangle under the slope, the bull toward the high end (B motif, C composition)
    const dc = len * 0.6, top = dc * slope + g.parapet, k = Math.min((top - 0.15 - R.bottom) / (figH * 1.05), (len * 0.55) / (wOf('lion_bull') * 1.1));
    out.push({ kind: 'lion_bull', variant: 0, along: low + dir * dc, y: R.bottom, facing: dir as 1 | -1, scale: k, depth: v('apadana', 'r_relief_depth') * CV.panel_depth_factor });
    // cypress row along the parapet band, parallel to the slope
    for (let d = CY.pitch; d < len - CY.pitch / 2; d += CY.pitch) {
      const t = d * slope + g.parapet; out.push({ kind: 'cypress', variant: 1, along: low + dir * d, y: Math.max(0.05, t - CY.height - 0.15), facing: 1, scale: CY.height / (figH * 0.93) });
      ros.push({ a: low + dir * d, y: t - 0.1 });
    }
  }
  return { figures: out, rosettes: ros };
}
/** The audience panel at the centre of each façade (D-204; SITE_SPEC apadana.r_audience_panel). The Treasury audience reliefs
 *  stood here in 467 (Tilia 1972 via Iranica, B). The composition follows them: TREAS-AUD (search extract) for the figures
 *  (B); their order and spacing, the canopy and the sizes are RECOLLECTION of the reliefs, NOT SEEN (C). Viewer's left to
 *  right: a Persian guard, the Mede weapon-bearer (axe, bow case), the beardless attendant with a towel, the crown prince with
 *  a lotus, the king enthroned facing right (staff, lotus, footstool), two incense burners, the Median official bowing with
 *  his hand before his mouth, a Persian guard with a spear; the canopy's band across the top. Standing figures are
 *  figure_of_panel of the panel height; the seated king at the same scale reaches their heads (hierarchic scale, C). The
 *  group is centred on the panel. The guards flanking the panel outside it are kept (C). */
export function planAudience(): { figures: Placement[]; rosettes: { a: number; y: number }[] } {
  const AP = v<any>('apadana', 'r_audience_panel'), R = v<any>('apadana', 'r_registers'), CV = v<any>('apadana', 'r_relief_carving'), figH = R.height * CV.figure_fill;
  const S = AP.height * AP.figure_of_panel, Dp = v('apadana', 'r_relief_depth') * CV.panel_depth_factor, out: Placement[] = [], ros: { a: number; y: number }[] = [];
  // positions relative to the king's origin (m): the file behind him, then the burners and the official's side before him
  const f = AP.file * S, bS = (AP.burner_of_figure * S) / defBounds(defOf('incense_burner', 0))[3];
  const scene: [string, number, number, 1 | -1, number][] = [ // kind, seed, along (m, from the king), facing, figure height (m)
    ['guard', 0, -0.48 - 3 * f, 1, S], ['weapon_bearer', 0, -0.48 - 2 * f, 1, S], ['attendant', 2, -0.48 - f, 1, S], ['crown_prince', 1, -0.48, 1, S],
    ['king', 0, 0, 1, S],
    ['incense_burner', 0, 0.44 * S, 1, bS], ['incense_burner', 0, 0.63 * S, 1, bS],
    ['official', 0, 0.85 * S, -1, S], ['guard', 1, 0.85 * S + f + 0.05, -1, S],
  ];
  // centre the group's drawn extent on the panel
  let lo = Infinity, hi = -Infinity;
  for (const [kind, seed, a, facing, h] of scene) { const bb = boundsOf(kind, seed); for (const x of [bb[0], bb[2]]) { const w = a + facing * x * h; lo = Math.min(lo, w); hi = Math.max(hi, w); } }
  const a0 = -(lo + hi) / 2;
  for (const [kind, seed, a, facing, h] of scene) out.push({ kind, variant: seed, along: a0 + a, y: R.bottom, facing, scale: h / figH, depth: Dp });
  // the canopy: equal segments across the panel, its top top_gap under the panel's top border; the lions walk toward the middle.
  // It hangs above head height (from 2.1 m over the façade foot), so it is never drawn at L0 (1.5 mm cells, ~150 k triangles a
  // segment); L1 gives it 6 mm cells
  const C = AP.canopy, Ls = AP.width / C.segments, top = R.bottom + AP.height - C.top_gap;
  for (let i = 0; i < C.segments; i++) { const a = -AP.width / 2 + (i + 0.5) * Ls; out.push({ kind: 'canopy', variant: 0, along: a, y: top - C.rel_height * Ls, facing: a < 0 ? 1 : -1, scale: Ls / figH, depth: Dp, minLod: 1 }); }
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) out.push({ kind: 'guard', variant: i, along: s * (AP.width / 2 + 0.5 + i * 0.7), y: R.bottom, facing: (s > 0 ? -1 : 1) as 1 | -1, scale: 1.35 });
  for (let x = -AP.width / 2; x <= AP.width / 2; x += v<any>('apadana', 'r_rosette').pitch) ros.push({ a: x, y: R.bottom - 0.08 }, { a: x, y: R.bottom + AP.height });
  return { figures: out, rosettes: ros };
}
/** façade placements → relief items in world space (grid e/n → world x = e, z = −n) */
export function facadeItems(f: Facade, plan: { figures: Placement[]; rosettes: { a: number; y: number }[] }): { items: ReliefItem[]; rosettes: RosetteItem[] } {
  const X = new THREE.Vector3(f.along[0], 0, -f.along[1]), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(f.normal[0], 0, -f.normal[1]);
  const R = v<any>('apadana', 'r_registers'), CV = v<any>('apadana', 'r_relief_carving'), figH = R.height * CV.figure_fill, D = v('apadana', 'r_relief_depth'), RS = v<any>('apadana', 'r_rosette');
  const at = (a: number, y: number) => new THREE.Vector3(f.origin[0] + f.along[0] * a, f.y0 + y, -(f.origin[1] + f.along[1] * a));
  return {
    items: plan.figures.map(p => ({ kind: p.kind, seed: p.variant, o: at(p.along, p.y), X, Y, Z, S: figH * p.scale, D: p.depth ?? D, mirror: p.facing < 0, ...(p.minLod ? { minLod: p.minLod } : {}) })),
    rosettes: plan.rosettes.map(r => ({ o: at(r.a, r.y - RS.diameter / 2), X, Y, Z, S: RS.diameter, D: D * 0.6 })),
  };
}
