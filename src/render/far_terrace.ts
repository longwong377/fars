// D-361 (B175, BLENDER_PLAN row 19): the Terrace's far levels. From the town and the plain (150 m to 4 km) the Terrace drew
// its near shapes: 1.41 M triangles in 136 draws (tools/dev/far_terrace_cost.ts), the columns' and reliefs' coarsest levels
// included. Here every mesh of the Terrace (the merged building meshes, the columns' and colossi's distance levels, the
// reliefs' far chunks and far sets, the merlons and roof edges) gets up to three far levels, made from ITS OWN geometry as
// the page built it (model GLBs, relief atlas and all): an index-only simplification (meshoptimizer: the vertex buffer and
// every attribute stay, only the triangles change; vertices shared by position with different attributes are seams it keeps)
// to an absolute error bound per level. A level is drawn when the camera is far enough that its error is under a quarter of a
// pixel at the current lens and resolution (so a long lens keeps the near shapes further out), with 5 % hysteresis. The
// material, the transform, the instances and their attributes are the near level's own: the look cannot drift from the near
// one, and a mesh whose near geometry changes (a rebuilt construction yard, the A/B model swap) is re-read on the next scan.
// Measured and recorded in DECISIONS D-361: tools/blender/far_terrace_cost.ts.
import * as THREE from 'three/webgpu';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { FAR_ERR, FAR_PX, FAR_MIN, farIndices, type FarInput } from './far_terrace_simplify';
export { FAR_ERR, FAR_PX, FAR_MIN, farIndices, type FarInput };

const HYST = 1.05, MIN_TRIS = 48, RESCAN_S = 1;

interface Entry { o: THREE.Mesh; near: THREE.BufferGeometry; levels: (THREE.BufferGeometry | null)[]; box: THREE.Box3; cur: number; tris: number[]; job: number }

let ready = false;
const readyP = MeshoptSimplifier.ready.then(() => { ready = true; });
export const farTerraceReady = () => readyP;

/** the input of a simplification: the index, the positions and the weighed attributes (the normal; the first UV set) */
export function farInput(g: THREE.BufferGeometry, lockBorder: boolean): FarInput {
  const pos = g.getAttribute('position') as THREE.BufferAttribute; const nv = pos.count;
  const P = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }
  const idx = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: nv }, (_, i) => i);
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined, uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const na = (nrm ? 3 : 0) + (uv ? 2 : 0), A = new Float32Array(Math.max(1, nv * na));
  for (let i = 0; i < nv; i++) { let k = i * na; if (nrm) { A[k++] = nrm.getX(i); A[k++] = nrm.getY(i); A[k++] = nrm.getZ(i); } if (uv) { A[k++] = uv.getX(i); A[k++] = uv.getY(i); } }
  return { idx, P, A, na, nrm: !!nrm, uv: !!uv, lockBorder };
}
/** a far level: the near geometry's attributes (shared: instanced ones too, which InstancedLOD rewrites) and a new index */
export function farGeometry(g: THREE.BufferGeometry, idx: Uint32Array, level: number): THREE.BufferGeometry {
  const f = new THREE.BufferGeometry(), nv = g.getAttribute('position').count;
  for (const [k, a] of Object.entries(g.attributes)) f.setAttribute(k, a);
  f.setIndex(new THREE.BufferAttribute(nv > 65535 ? idx : Uint16Array.from(idx), 1));
  if (!g.boundingSphere) g.computeBoundingSphere();
  f.boundingBox = g.boundingBox; f.boundingSphere = g.boundingSphere;
  f.userData = { ...g.userData, farLevel: level }; f.name = g.name;
  return f;
}
/** the far levels of a geometry, built here (node, tests, a test render) */
export function farLevels(g: THREE.BufferGeometry, lockBorder: boolean): { levels: (THREE.BufferGeometry | null)[]; err: number[] } {
  const r = farIndices(farInput(g, lockBorder));
  return { levels: r.idx.map((x, k) => (x ? farGeometry(g, x, k + 1) : null)), err: r.err };
}

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const _b = new THREE.Box3(), _m = new THREE.Matrix4();

export class FarTerrace {
  private E = new Map<THREE.Mesh, Entry>();
  private roots: THREE.Object3D[] = [];
  private t = RESCAN_S;
  private worker: Worker | null = null; private jobs = new Map<number, { e: Entry; near: THREE.BufferGeometry }>(); private nextJob = 1;
  /** what is drawn now: triangles of the registered meshes (instances counted), per level; simplifications built so far */
  stats = { meshes: 0, tris: 0, nearTris: 0, byLevel: [0, 0, 0, 0, 0], built: 0, buildMs: 0, pending: 0, inFlight: 0, worker: false };
  /** heightPx: the drawing buffer's height (px); useWorker: simplify off the main thread (the page; node builds in line) */
  constructor(roots: THREE.Object3D[], private heightPx: () => number = () => Math.min(2160, Math.max(720, ((globalThis as any).innerHeight ?? 1080) * ((globalThis as any).devicePixelRatio ?? 1))), useWorker = typeof Worker !== 'undefined') {
    for (const r of roots) this.addRoot(r);
    if (useWorker) try {
      const w = new Worker(new URL('./far_terrace_worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<{ job: number; idx: (Uint32Array | null)[]; ms: number; error?: string }>) => {
        const j = this.jobs.get(ev.data.job); this.jobs.delete(ev.data.job); if (!j) return;
        if (ev.data.error) { console.warn('[far-terrace] worker:', ev.data.error); this.dropWorker(); return; }
        if (j.e.near !== j.near || j.e.job !== ev.data.job) return; // re-read meanwhile
        this.adopt(j.e, ev.data.idx.map((x, k) => (x ? farGeometry(j.near, x, k + 1) : null))); this.stats.buildMs += ev.data.ms;
      };
      w.onerror = (ev: ErrorEvent) => { console.warn('[far-terrace] worker failed, building in line:', ev.message); this.dropWorker(); };
      this.worker = w; this.stats.worker = true;
    } catch { this.worker = null; }
  }
  private dropWorker() { this.worker?.terminate(); this.worker = null; this.stats.worker = false; for (const j of this.jobs.values()) j.e.job = 0; this.jobs.clear(); }
  addRoot(r: THREE.Object3D) { this.roots.push(r); this.t = RESCAN_S; }
  private adopt(e: Entry, levels: (THREE.BufferGeometry | null)[]) { e.levels = levels; e.tris = [tris(e.near), ...levels.map(g => (g ? tris(g) : 0))]; e.job = 0; this.stats.built++; }
  private scan() {
    const seen = new Set<THREE.Mesh>();
    for (const r of this.roots) r.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh || (m as any).isBatchedMesh || (m as any).isSkinnedMesh || m.userData?.noFar) return;
      const g = m.geometry; if (!g?.getAttribute('position') || (Array.isArray(m.material) && g.groups.length) || g.drawRange.start !== 0 || g.drawRange.count !== Infinity || g.morphAttributes.position) return;
      seen.add(m);
      const e = this.E.get(m);
      if (e && (m.geometry === e.near || e.levels.includes(m.geometry))) return;
      // new, or its owner swapped the near geometry (the A/B model swap, a rebuilt yard): (re)read it
      if (tris(g) < MIN_TRIS) { if (e) this.E.delete(m); return; }
      this.E.set(m, { o: m, near: g, levels: [], box: this.bound(m, g), cur: 0, tris: [tris(g)], job: 0 });
    });
    for (const [m, e] of this.E) if (!seen.has(m)) { if (m.geometry !== e.near && e.levels.includes(m.geometry)) m.geometry = e.near; this.E.delete(m); }
  }
  /** the world box of a mesh (every instance slot of an instanced one: the InstancedLOD levels trade instances) */
  private bound(m: THREE.Mesh, g: THREE.BufferGeometry) {
    if (!g.boundingBox) g.computeBoundingBox();
    m.updateWorldMatrix(true, false);
    const im = m as THREE.InstancedMesh;
    if (!im.isInstancedMesh) return g.boundingBox!.clone().applyMatrix4(m.matrixWorld);
    const box = new THREE.Box3(), n = im.instanceMatrix.count;
    for (let i = 0; i < n; i++) { im.getMatrixAt(i, _m); _b.copy(g.boundingBox!).applyMatrix4(_m); box.union(_b); }
    return box.applyMatrix4(m.matrixWorld);
  }
  /** the distance (m) from which level k (1..) is drawn for this lens and resolution */
  switchAt(camera: THREE.Camera, k: number) {
    const cam = camera as THREE.PerspectiveCamera, fov = cam.isPerspectiveCamera ? cam.fov / (cam.zoom || 1) : 60;
    const alpha = 2 * Math.tan((fov * Math.PI) / 360) / this.heightPx(); // radians a pixel
    return Math.max(FAR_MIN, FAR_ERR[k - 1] / (FAR_PX * alpha));
  }
  /** per frame: the level of every registered mesh for the camera. budgetMs >= 1e6 (a test render): every level it needs
   *  built now, in line; otherwise the worker builds them (or the main thread within budgetMs when there is none) */
  update(camera: THREE.Camera, budgetMs = 3, dt = 1 / 60) {
    if (!ready) return this.stats;
    const now = budgetMs >= 1e6;
    this.t += dt; if (this.t >= RESCAN_S || now) { this.t = 0; this.scan(); }
    const D = FAR_ERR.map((_, k) => this.switchAt(camera, k + 1));
    const p = camera.getWorldPosition(new THREE.Vector3()), t0 = performance.now();
    const S = this.stats; S.meshes = this.E.size; S.tris = 0; S.nearTris = 0; S.byLevel.fill(0); S.pending = 0;
    for (const e of this.E.values()) {
      const d = e.box.distanceToPoint(p);
      let want = 0; for (let k = FAR_ERR.length; k >= 1; k--) if (d > D[k - 1] * (e.cur >= k ? 1 / HYST : HYST)) { want = k; break; }
      const im = e.o as THREE.InstancedMesh, n = im.isInstancedMesh ? im.count : 1;
      if (want > 0 && n > 0 && e.levels.length === 0) {
        const lock = !im.isInstancedMesh && !e.o.name.startsWith('relief');
        if (this.worker && !now) {
          if (!e.job) { const I = farInput(e.near, lock), job = this.nextJob++; e.job = job; this.jobs.set(job, { e, near: e.near });
            this.worker.postMessage({ job, I }, [I.idx.buffer, I.P.buffer, I.A.buffer]); }
          S.pending++;
        } else if (now || performance.now() - t0 < budgetMs) { const t1 = performance.now(); this.adopt(e, farLevels(e.near, lock).levels); S.buildMs += performance.now() - t1; }
        else S.pending++;
      }
      // the nearest built level at or below the wanted one
      let lv = 0; for (let k = Math.min(want, e.levels.length); k >= 1; k--) if (e.levels[k - 1]) { lv = k; break; }
      const g = lv ? e.levels[lv - 1]! : e.near; if (e.o.geometry !== g) e.o.geometry = g; e.cur = want;
      if (n > 0) { S.tris += e.tris[lv] * n; S.nearTris += e.tris[0] * n; S.byLevel[lv] += e.tris[lv] * n; }
    }
    S.inFlight = this.jobs.size;
    return S;
  }
  /** every mesh back to its near geometry (A/B) */
  reset() { for (const e of this.E.values()) { e.o.geometry = e.near; e.cur = 0; } }
  /** the registered meshes (the cost tool, tests) */
  entries() { return [...this.E.values()]; }
  dispose() { this.reset(); this.dropWorker(); }
}
