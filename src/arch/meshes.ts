// Parts → Three.js meshes (merged per building+material; columns instanced per order with two distance LODs; doorway
// colossi as sculpture) and Rapier colliders (always the parts' own boxes/prisms).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Part, Prism, Box, Column, ColumnOrder, Material } from './parts';
import type { Physics } from '../player/physics';
import { columnMesh, toGeometry, colossusMesh, colossusFrontProjections, setColossusFront, sculptIndex, srow, Lod } from './sculpt';

/** Greybox materials (Phase 2): flat albedos from pigment/stone references are Phase 3; these are neutral and tagged C. */
const ALBEDO: Record<Material, [number, number, number]> = {
  limestone: [0.62, 0.6, 0.56], limestone_dark: [0.2, 0.2, 0.21], mudbrick: [0.66, 0.56, 0.44], plaster: [0.8, 0.76, 0.68],
  plaster_red: [0.5, 0.16, 0.12], bronze: [0.55, 0.4, 0.22],
  timber: [0.36, 0.27, 0.19], glazed: [0.2, 0.4, 0.55], earth: [0.5, 0.42, 0.32], scaffold: [0.45, 0.35, 0.24], rubble: [0.55, 0.52, 0.48],
  court_fill: [0.5, 0.46, 0.39], terrace: [0.62, 0.6, 0.56],
};
import { surfaceMaterial } from '../render/materials';
const matCache = new Map<string, THREE.MeshStandardNodeMaterial>();
/** flat greybox material (plan-overlay tests, tools); the world uses procedural surfaces (render/materials.ts) */
export function flatMaterial(m: Material) {
  let x = matCache.get(m);
  if (!x) { const [r, g, b] = ALBEDO[m]; x = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace), roughness: m === 'glazed' ? 0.35 : 0.9, metalness: 0 }); matCache.set(m, x); }
  return x;
}
export let material: (m: Material) => THREE.Material = m => surfaceMaterial(m);
export function useFlatMaterials(flat: boolean) { material = flat ? flatMaterial : (m => surfaceMaterial(m)); }

export function prismGeometry(p: Prism): THREE.BufferGeometry {
  const shape = new THREE.Shape(p.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: p.y1 - p.y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (e, n, h) → (e, h, −n)
  g.translate(0, p.y0, 0);
  return g.index ? g.toNonIndexed() : g;
}
export function boxGeometry(b: Box): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(b.size[0], b.y1 - b.y0, b.size[1]);
  g.rotateY(b.rot ?? 0); // grid CCW rotation = world rotation about +Y (x east, z = −north)
  g.translate(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]);
  return g.toNonIndexed();
}

/** Column geometry in local space (base at y = 0, top at the order's height): the sculpted order (sculpt.ts, D-018).
 *  built < 1: shaft partly raised (unfluted drums), no capital. */
export function columnGeometry(o: ColumnOrder, built = 1, lod: Lod = 0): THREE.BufferGeometry { return toGeometry(columnMesh(o, built, lod)); }

const isPerspective = (c: THREE.Camera) => (c as THREE.PerspectiveCamera).isPerspectiveCamera === true;
/** Per-instance distance LOD for instanced elements. The renderer calls update(camera) on objects flagged isLOD before
 *  drawing their children; only perspective (view) cameras switch levels, so the orthographic shadow pass draws the
 *  same meshes the camera sees (no self-shadowing mismatch). Instances stay instanced: one InstancedMesh per level. */
export class InstancedLOD extends THREE.Object3D {
  readonly isLOD = true; autoUpdate = true;
  readonly levels: THREE.InstancedMesh[];
  private level: Uint8Array;
  /** at: per instance [x, y0, z, height] (world); switch: distance to the instance's vertical axis segment (m) */
  constructor(geos: THREE.BufferGeometry[], mat: THREE.Material, private at: Float32Array, private switchAt: number, private hyst: number) {
    super();
    const n = at.length / 4, m4 = new THREE.Matrix4();
    this.levels = geos.map(g => {
      const im = new THREE.InstancedMesh(g, mat, n);
      for (let i = 0; i < n; i++) { m4.makeTranslation(at[i * 4], at[i * 4 + 1], at[i * 4 + 2]); im.setMatrixAt(i, m4); }
      im.computeBoundingSphere(); // over all instances, once: stays a valid bound whatever the per-level count
      im.castShadow = im.receiveShadow = true; this.add(im); return im;
    });
    this.level = new Uint8Array(n).fill(geos.length - 1);
    this.assign();
  }
  update(camera: THREE.Camera) {
    if (!isPerspective(camera)) return;
    const e = camera.matrixWorld.elements, px = e[12], py = e[13], pz = e[14], A = this.at;
    let changed = false;
    for (let i = 0; i < this.level.length; i++) {
      const dy = Math.max(0, A[i * 4 + 1] - py, py - (A[i * 4 + 1] + A[i * 4 + 3]));
      const d = Math.hypot(px - A[i * 4], dy, pz - A[i * 4 + 2]);
      const want = this.level[i] === 0 ? (d > this.switchAt + this.hyst ? 1 : 0) : (d < this.switchAt - this.hyst ? 0 : 1);
      if (want !== this.level[i]) { this.level[i] = want; changed = true; }
    }
    if (changed) this.assign();
  }
  /** instance counts per level (tests, stats) */
  counts() { return this.levels.map(im => im.count); }
  private assign() {
    const m4 = new THREE.Matrix4(), cnt = this.levels.map(() => 0);
    for (let i = 0; i < this.level.length; i++) {
      const L = this.level[i], im = this.levels[L];
      m4.makeTranslation(this.at[i * 4], this.at[i * 4 + 1], this.at[i * 4 + 2]); im.setMatrixAt(cnt[L]++, m4);
    }
    this.levels.forEach((im, k) => { im.count = cnt[k]; im.visible = cnt[k] > 0; im.instanceMatrix.needsUpdate = true; });
  }
}
/** Two-level distance LOD for one mesh (colossi); same camera rule as InstancedLOD */
export class MeshLOD extends THREE.Object3D {
  readonly isLOD = true; autoUpdate = true;
  constructor(readonly levels: THREE.Mesh[], private centre: THREE.Vector3, private switchAt: number, private hyst: number) {
    super(); for (const m of levels) this.add(m); this.show(levels.length - 1);
  }
  private cur = -1;
  update(camera: THREE.Camera) {
    if (!isPerspective(camera)) return;
    const e = camera.matrixWorld.elements, d = Math.hypot(e[12] - this.centre.x, e[13] - this.centre.y, e[14] - this.centre.z);
    const want = this.cur === 0 ? (d > this.switchAt + this.hyst ? 1 : 0) : (d < this.switchAt - this.hyst ? 0 : 1);
    if (want !== this.cur) this.show(want);
  }
  private show(k: number) { this.cur = k; this.levels.forEach((m, i) => { m.visible = i === k; }); }
}

// render-only jamb cut-outs: where a sculpted jamb (colossus) or its plinth stands inside a wall box, the wall is drawn
// around it (the wall ring has no jamb slots; its collider is left whole)
type AABB = [number, number, number, number, number, number]; // e0 e1 n0 n1 y0 y1
const aabb = (b: Box): AABB => [b.c[0] - b.size[0] / 2, b.c[0] + b.size[0] / 2, b.c[1] - b.size[1] / 2, b.c[1] + b.size[1] / 2, b.y0, b.y1];
function subtractAabb(a: AABB, c: AABB): AABB[] {
  if (a[0] >= c[1] || a[1] <= c[0] || a[2] >= c[3] || a[3] <= c[2] || a[4] >= c[5] || a[5] <= c[4]) return [a];
  const out: AABB[] = [], r = [...a] as AABB;
  for (let ax = 0; ax < 3; ax++) {
    const lo = ax * 2, hi = lo + 1;
    if (r[lo] < c[lo]) { const q = [...r] as AABB; q[hi] = c[lo]; out.push(q); r[lo] = c[lo]; }
    if (r[hi] > c[hi]) { const q = [...r] as AABB; q[lo] = c[hi]; out.push(q); r[hi] = c[hi]; }
  }
  return out;
}
export function cutWall(w: Box, cutters: Box[]): Box[] | null {
  if ((w.rot ?? 0) !== 0) return null;
  let pieces: AABB[] = [aabb(w)], hit = false;
  for (const c of cutters) { const next: AABB[] = []; for (const q of pieces) { const s = subtractAabb(q, aabb(c)); if (s.length !== 1 || s[0] !== q) hit = true; next.push(...s); } pieces = next; }
  if (!hit) return null;
  return pieces.filter(q => q[1] - q[0] > 1e-4 && q[3] - q[2] > 1e-4 && q[5] - q[4] > 1e-4)
    .map(q => ({ ...w, c: [(q[0] + q[1]) / 2, (q[2] + q[3]) / 2], size: [q[1] - q[0], q[3] - q[2]], y0: q[4], y1: q[5] }));
}

export interface BuiltArch { group: THREE.Group; triangles: number; colliders: number }
export function buildMeshes(parts: Part[], phys?: Physics): BuiltArch {
  const group = new THREE.Group(); group.name = 'architecture';
  const byKey = new Map<string, { geos: THREE.BufferGeometry[]; parts: Part[] }>();
  const cols = new Map<string, { order: ColumnOrder; built: number; parts: Column[] }>();
  const colossi = parts.filter(p => p.type === 'box' && p.sculpt) as Box[];
  const cutters = parts.filter(p => p.type === 'box' && (p.sculpt || p.kind === 'plinth')) as Box[];
  let colliders = 0;
  for (const p of parts) {
    if (p.type === 'column') {
      const k = `${p.building}|${p.order.id}|${p.order.base}|${p.order.capital}|${p.order.shaftD}|${p.built.toFixed(2)}`;
      if (!cols.has(k)) cols.set(k, { order: p.order, built: p.built, parts: [] }); cols.get(k)!.parts.push(p);
      if (phys) { phys.addBox({ x: p.c[0], y: p.y0 + (p.order.baseH + (p.order.height - p.order.baseH) * p.built) / 2, z: -p.c[1] }, { x: p.order.baseW / 2, y: (p.order.baseH + (p.order.height - p.order.baseH) * p.built) / 2, z: p.order.baseW / 2 }); colliders++; }
      continue;
    }
    const g = p.type === 'prism' ? prismGeometry(p) : boxGeometry(p);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (phys && p.solid !== false && p.kind !== 'roof') {
      const pos = g.getAttribute('position').array as Float32Array; const idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
      phys.addTrimesh(new Float32Array(pos), idx, { building: p.building, kind: p.kind }); colliders++;
    }
    if (p.type === 'box' && p.sculpt) continue; // rendered as sculpture below; the box is the collider only
    let rg = g;
    if (p.type === 'box' && p.kind === 'wall') {
      const cut = cutWall(p, cutters.filter(c => c.building === p.building));
      if (cut) { rg = cut.length ? mergeGeometries(cut.map(boxGeometry).map(q => { for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; }))! : new THREE.BufferGeometry(); }
    }
    if (!rg.getAttribute('position')) continue;
    const key = `${p.building}|${p.material}|${p.tier}|${p.placeholder ? 1 : 0}`;
    if (!byKey.has(key)) byKey.set(key, { geos: [], parts: [] }); byKey.get(key)!.geos.push(rg); byKey.get(key)!.parts.push(p);
  }
  let tris = 0;
  for (const [key, { geos, parts: ps }] of byKey) {
    const [building, mat, tier, ph] = key.split('|');
    const g = mergeGeometries(geos)!; tris += g.getAttribute('position').count / 3;
    const m = new THREE.Mesh(g, material(mat as Material)); m.castShadow = m.receiveShadow = true; m.name = `${building}:${mat}`;
    m.userData = { tier, src: [...new Set(ps.map(p => p.src))].join(';'), placeholder: ph === '1', note: `greybox (Phase 2): ${[...new Set(ps.map(p => p.kind))].join(', ')}`, building };
    group.add(m);
  }
  const SW = srow('lod', 'switch');
  for (const [, c] of cols) {
    const g0 = columnGeometry(c.order, c.built, 0), g1 = columnGeometry(c.order, c.built, 1);
    const at = new Float32Array(c.parts.length * 4); c.parts.forEach((p, i) => at.set([p.c[0], p.y0, -p.c[1], c.order.baseH + (c.order.height - c.order.baseH) * c.built], i * 4));
    const lod = new InstancedLOD([g0, g1], material(c.order.material), at, SW.column, SW.hysteresis);
    const b = c.parts[0].building;
    lod.name = `${b}:columns`;
    lod.userData = { tier: c.parts[0].tier, src: `${c.parts[0].src};RECON`, placeholder: false, building: b,
      note: `column order ${c.order.id} (${c.order.base} base, ${c.order.capital} capital): dimensions SITE_SPEC; carving procedural sculpture, form C (D-018; scans would replace it, NEEDS #10)${c.built < 1 ? '; under construction: unfluted drums' : ''}` };
    lod.levels.forEach((im, k) => { im.name = `${b}:columns:lod${k}`; im.userData = lod.userData; });
    tris += (g0.index!.count / 3) * c.parts.length;
    group.add(lod);
  }
  if (colossi.length) {
    const fr = colossusFrontProjections(parts as Box[]); const front = fr.reduce((a, b) => a + b, 0) / fr.length;
    setColossusFront(front);
    const idx = sculptIndex(); if (idx && Math.abs(idx.params.colossusFront - front) > 0.05) console.warn(`sculpt: colossi were generated for a ${idx.params.colossusFront.toFixed(2)} m fore-part, the layout gives ${front.toFixed(2)} m (rerun npx tsx tools/build_sculpt.ts)`);
    for (const p of colossi) {
      const meshes = ([0, 1] as Lod[]).map(l => { const m = new THREE.Mesh(toGeometry(colossusMesh(p, l)), material(p.material)); m.castShadow = m.receiveShadow = true; return m; });
      const centre = new THREE.Vector3(p.c[0], (p.y0 + p.y1) / 2, -p.c[1]);
      const lod = new MeshLOD(meshes, centre, SW.colossus, SW.hysteresis); lod.name = `${p.building}:colossus:${p.sculpt!.model}`;
      lod.userData = { tier: p.tier, src: p.src, placeholder: false, building: p.building, note: `${p.note ?? 'colossus'}; carved form reconstructed from the type (RECOLLECTION), not measured; licensed scans would replace it (NEEDS #10)` };
      meshes.forEach((m, k) => { m.name = `${lod.name}:lod${k}`; m.userData = lod.userData; });
      tris += meshes[0].geometry.index!.count / 3;
      group.add(lod);
    }
  }
  return { group, triangles: tris, colliders };
}
