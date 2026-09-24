// Parts → Three.js meshes (merged per building+material; columns instanced per order with two distance LODs; doorway
// colossi as sculpture) and Rapier colliders (always the parts' own boxes/prisms).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Part, Prism, Box, Column, ColumnOrder, Material } from './parts';
import type { Physics } from '../player/physics';
import { columnMesh, columnMeshesByMaterial, memberMaterials, toGeometry, colossusMesh, colossusFrontProjections, setColossusFront, sculptIndex, srow, Lod } from './sculpt';
export { cutWall } from './parts';

/** Greybox materials (Phase 2): flat albedos from pigment/stone references are Phase 3; these are neutral and tagged C. */
const ALBEDO: Record<Material, [number, number, number]> = {
  limestone: [0.62, 0.6, 0.56], limestone_dark: [0.28, 0.28, 0.28], mudbrick: [0.66, 0.56, 0.44], mudbrick_painted: [0.58, 0.57, 0.45], plaster: [0.8, 0.76, 0.68],
  plaster_red: [0.5, 0.16, 0.12], bronze: [0.55, 0.4, 0.22],
  timber: [0.36, 0.27, 0.19], glazed: [0.2, 0.4, 0.55], earth: [0.5, 0.42, 0.32], scaffold: [0.45, 0.35, 0.24], rubble: [0.55, 0.52, 0.48],
  court_fill: [0.5, 0.46, 0.39], terrace: [0.62, 0.6, 0.56],
};
import { surfaceMaterial } from '../render/materials';
import { pointInPoly } from './parts';
import { ceilingTimbers } from './ceilings';
const matCache = new Map<string, THREE.MeshStandardNodeMaterial>();
/** flat greybox material (plan-overlay tests, tools); the world uses procedural surfaces (render/materials.ts) */
export function flatMaterial(m: Material) {
  let x = matCache.get(m);
  if (!x) { const [r, g, b] = ALBEDO[m]; x = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace), roughness: m === 'glazed' ? 0.35 : 0.9, metalness: 0 }); matCache.set(m, x); }
  return x;
}
/** carved members (column orders, colossi) are drawn in the joint-free carved variant of their stone (D-029): masonry joints
 *  belong to coursed ashlar, not to a capital, a shaft or a colossus */
const CARVED: Partial<Record<Material, string>> = { limestone: 'limestone_carved' };
export let material: (m: Material) => THREE.Material = m => surfaceMaterial(m);
export let carvedMaterial: (m: Material) => THREE.Material = m => surfaceMaterial(CARVED[m] ?? m);
/** the merged part meshes' material: the surface's architecture variant, which reads the per-vertex part attributes
 *  (`y0`, `pbox`: the wall-foot band and floor wear, D-157) */
let archMaterial: (m: Material) => THREE.Material = m => surfaceMaterial(m, { arch: true });
let flatMode = false;
export function useFlatMaterials(flat: boolean) {
  flatMode = flat;
  material = flat ? flatMaterial : (m => surfaceMaterial(m)); carvedMaterial = flat ? flatMaterial : (m => surfaceMaterial(CARVED[m] ?? m));
  archMaterial = flat ? flatMaterial : (m => surfaceMaterial(m, { arch: true }));
}

/** a roof casts its shadow from its top faces (D-114). three renders a FrontSide material's back faces into the shadow map,
 *  which for a roof slab is its underside: capital tops and wall heads that touch the ceiling then lie within the depth
 *  bias of the stored occluder and received direct sun inside the halls (seen once the halls were lit by the probes). */
const roofMats = new WeakMap<THREE.Material, THREE.Material>();
function roofMaterial(m: THREE.Material): THREE.Material {
  let r = roofMats.get(m);
  if (!r) { r = m.clone(); r.shadowSide = THREE.FrontSide; r.userData = { ...m.userData }; roofMats.set(m, r); }
  return r;
}
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

// ---- bevels (D-157, C) -------------------------------------------------------------------------------------------------
// Every arris was a perfect 90° edge with no highlight line. Stone arrises get a 10 mm flat chamfer (dressed and worn
// edges: 5–15 mm), plastered mud brick a 30 mm rounded arris (smooth normals across the strip: 20–40 mm). Only the
// render geometry is bevelled: colliders, the walkable grid and the light probes keep the parts' own boxes. An edge is
// bevelled only where it is a free arris: where another part continues either face across it (a wall built of several
// boxes, a wall under a roof, a step against its parapet, a jamb against its wall) it stays sharp, so no false groove
// is cut into a continuous surface. Prisms (the Terrace platform) are not bevelled.
/** chamfer / rounding size (m) and whether its normals are rounded, per material; none for the rest (timber, floors, fill) */
export const BEVEL: Partial<Record<Material, { r: number; round: boolean }>> = {
  limestone: { r: 0.01, round: false }, limestone_dark: { r: 0.008, round: false }, terrace: { r: 0.01, round: false }, glazed: { r: 0.005, round: false },
  mudbrick: { r: 0.03, round: true }, mudbrick_painted: { r: 0.03, round: true }, plaster: { r: 0.03, round: true },
};
/** kinds never bevelled (thin finishes, moving leaves, roofs, sculpture boxes) */
const NO_BEVEL = new Set(['floor_finish', 'roof', 'door_leaf', 'colossus']);
type V3 = [number, number, number];
interface Plane { n: V3; d: number; box: number /* index of the box face (0..5), −1 for a chamfer */; parents?: [number, number] }
const FACE_N: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** the 12 edges of a box as pairs of face indices (FACE_N) */
export const BOX_EDGES: [number, number][] = [[0, 2], [0, 3], [1, 2], [1, 3], [0, 4], [0, 5], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** a convex polygon in plane `P`, clipped by every other plane (keep n·x ≤ d): Sutherland–Hodgman from a large square */
function clipFace(P: Plane, planes: Plane[], S: number): V3[] {
  const n = P.n, c: V3 = [n[0] * P.d, n[1] * P.d, n[2] * P.d];
  const a: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: V3 = [a[1] * n[2] - a[2] * n[1], a[2] * n[0] - a[0] * n[2], a[0] * n[1] - a[1] * n[0]]; const ul = Math.hypot(...u); u[0] /= ul; u[1] /= ul; u[2] /= ul;
  const v: V3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]; // u × v = n (counter-clockwise seen from outside)
  let poly: V3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [c[0] + S * (s * u[0] + t * v[0]), c[1] + S * (s * u[1] + t * v[1]), c[2] + S * (s * u[2] + t * v[2])] as V3);
  for (const Q of planes) {
    if (Q === P || poly.length === 0) continue;
    const out: V3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], da = dot3(Q.n, A) - Q.d, db = dot3(Q.n, B) - Q.d;
      if (da <= 1e-9) out.push(A);
      if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
    }
    poly = out;
  }
  // drop repeated vertices (a clip exactly through a vertex)
  return poly.filter((q, i) => { const r = poly[(i + 1) % poly.length]; return Math.hypot(q[0] - r[0], q[1] - r[1], q[2] - r[2]) > 1e-7; });
}
/** A box (half extents h, centred on the origin, local axes) with the flagged edges chamfered by r: the convex polyhedron
 *  of the 6 face planes and one 45° plane per bevelled edge, each face clipped by all the others. `round`: a chamfer's
 *  vertices take the normals of the box faces they lie on (a rounded arris in shading); else the chamfer's own normal.
 *  Returns non-indexed positions and normals. */
export function bevelledBox(h: V3, r: number, edges: boolean[], round: boolean): { pos: number[]; nrm: number[] } {
  const planes: Plane[] = FACE_N.map((n, i) => ({ n, d: Math.abs(dot3(n, h)), box: i }));
  BOX_EDGES.forEach(([a, b], k) => {
    if (!edges[k]) return;
    const na = FACE_N[a], nb = FACE_N[b], s = Math.SQRT1_2, n: V3 = [(na[0] + nb[0]) * s, (na[1] + nb[1]) * s, (na[2] + nb[2]) * s];
    planes.push({ n, d: (planes[a].d + planes[b].d - r) * s, box: -1, parents: [a, b] });
  });
  const S = 4 * Math.max(h[0], h[1], h[2]) + 1, pos: number[] = [], nrm: number[] = [];
  for (const P of planes) {
    const poly = clipFace(P, planes, S); if (poly.length < 3) continue;
    const vn = poly.map(q => {
      if (P.box >= 0 || !round) return P.n;
      // on its parent faces' lines: those faces' normals; at a gable apex (where three chamfers meet) the corner's
      // normal, from every box face within r of the vertex
      const on = P.parents!.filter(i => Math.abs(dot3(planes[i].n, q) - planes[i].d) < 1e-6);
      const near = on.length ? on : [0, 1, 2, 3, 4, 5].filter(i => planes[i].d - dot3(planes[i].n, q) <= r + 1e-6);
      const m = near.reduce((acc, i) => [acc[0] + FACE_N[i][0], acc[1] + FACE_N[i][1], acc[2] + FACE_N[i][2]] as V3, [0, 0, 0] as V3);
      const l = Math.hypot(...m); return [m[0] / l, m[1] / l, m[2] / l] as V3;
    });
    // vertices snapped to 1 µm, so a corner computed through different clipping orders is the same vertex in every face
    const snap = (q: V3) => q.map(x => Math.round(x * 1e6) / 1e6);
    for (let i = 1; i + 1 < poly.length; i++) for (const j of [0, i, i + 1]) { pos.push(...snap(poly[j])); nrm.push(...vn[j]); }
  }
  return { pos, nrm };
}
/** "is this world point inside a part?" over all parts except door leaves, on a 4 m grid of the parts' plan bounds */
export class PartIndex {
  private cells = new Map<number, number[]>(); private CELL = 4;
  constructor(private parts: Part[]) {
    parts.forEach((p, i) => {
      if (p.type === 'box' && p.door) return;
      const [x0, x1, n0, n1] = planBounds(p);
      for (let gx = Math.floor(x0 / this.CELL); gx <= Math.floor(x1 / this.CELL); gx++) for (let gy = Math.floor(n0 / this.CELL); gy <= Math.floor(n1 / this.CELL); gy++) {
        const k = gx * 100003 + gy; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(i);
      }
    });
  }
  /** point in world coordinates (x east, y up, z = −north) */
  /** the highest top (y1) of a part whose plan contains (x, −z) and whose top is at or below yTop (roofs, leaves and
   *  `except` left out); NaN if none: the floor, landing, tread or court in front of a face (D-157 wall-foot band) */
  topBelow(x: number, z: number, yTop: number, except: Part): number {
    const e = x, n = -z, list = this.cells.get(Math.floor(e / this.CELL) * 100003 + Math.floor(n / this.CELL)); if (!list) return NaN;
    let best = NaN;
    for (const i of list) {
      const p = this.parts[i]; if (p === except || p.kind === 'roof') continue;
      const top = p.type === 'column' ? p.y0 + p.order.baseH + (p.order.height - p.order.baseH) * p.built : p.y1;
      if (top > yTop + 0.01 || !(top > best || Number.isNaN(best))) continue;
      if (p.type === 'column') { if (Math.abs(e - p.c[0]) <= p.order.baseW / 2 && Math.abs(n - p.c[1]) <= p.order.baseW / 2) best = top; continue; }
      if (p.type === 'prism') { if (pointInPoly(e, n, p.polygon)) best = top; continue; }
      const c = Math.cos(-(p.rot ?? 0)), s = Math.sin(-(p.rot ?? 0)), de = e - p.c[0], dn = n - p.c[1];
      if (Math.abs(de * c - dn * s) <= p.size[0] / 2 && Math.abs(de * s + dn * c) <= p.size[1] / 2) best = top;
    }
    return best;
  }
  inside(x: number, y: number, z: number, except: Part): boolean {
    const e = x, n = -z, list = this.cells.get(Math.floor(e / this.CELL) * 100003 + Math.floor(n / this.CELL)); if (!list) return false;
    for (const i of list) {
      const p = this.parts[i]; if (p === except) continue;
      if (p.type === 'column') { const o = p.order, top = p.y0 + o.baseH + (o.height - o.baseH) * p.built; if (y >= p.y0 && y <= top && Math.abs(e - p.c[0]) <= o.baseW / 2 && Math.abs(n - p.c[1]) <= o.baseW / 2) return true; continue; }
      if (y < p.y0 || y > p.y1) continue;
      if (p.type === 'prism') { if (pointInPoly(e, n, p.polygon)) return true; continue; }
      const c = Math.cos(-(p.rot ?? 0)), s = Math.sin(-(p.rot ?? 0)), de = e - p.c[0], dn = n - p.c[1];
      const le = de * c - dn * s, ln = de * s + dn * c;
      if (Math.abs(le) <= p.size[0] / 2 && Math.abs(ln) <= p.size[1] / 2) return true;
    }
    return false;
  }
}
function planBounds(p: Part): [number, number, number, number] {
  if (p.type === 'prism') { let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity; for (const [x, n] of p.polygon) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); n0 = Math.min(n0, n); n1 = Math.max(n1, n); } return [x0, x1, n0, n1]; }
  if (p.type === 'column') { const r = p.order.baseW / 2; return [p.c[0] - r, p.c[0] + r, p.c[1] - r, p.c[1] + r]; }
  const R = Math.hypot(p.size[0], p.size[1]) / 2; return [p.c[0] - R, p.c[0] + R, p.c[1] - R, p.c[1] + R];
}
/** which of a box's 12 edges are free arrises: at 5 points along the edge, the space just beyond each of its two faces
 *  (3 cm out, 3 cm in from the edge) is not inside another part */
export function freeArrises(b: Box, index: { inside(x: number, y: number, z: number, except: Part): boolean }, eps = 0.03): boolean[] {
  const h: V3 = [b.size[0] / 2, (b.y1 - b.y0) / 2, b.size[1] / 2], rot = b.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot), cy = (b.y0 + b.y1) / 2;
  // local (box) → world: rotateY(rot) then translate (as boxGeometry)
  const W = (q: V3): V3 => [q[0] * c + q[2] * s + b.c[0], q[1] + cy, -q[0] * s + q[2] * c - b.c[1]];
  return BOX_EDGES.map(([a, bb]) => {
    const na = FACE_N[a], nb = FACE_N[bb], ax = [0, 1, 2].find(i => na[i] === 0 && nb[i] === 0)!;
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const e: V3 = [(na[0] + nb[0]) * h[0], (na[1] + nb[1]) * h[1], (na[2] + nb[2]) * h[2]]; e[ax] = (f - 0.5) * 2 * h[ax];
      const pA = W([e[0] + eps * (na[0] - nb[0]), e[1] + eps * (na[1] - nb[1]), e[2] + eps * (na[2] - nb[2])]);
      const pB = W([e[0] + eps * (nb[0] - na[0]), e[1] + eps * (nb[1] - na[1]), e[2] + eps * (nb[2] - na[2])]);
      if (index.inside(pA[0], pA[1], pA[2], b) || index.inside(pB[0], pB[1], pB[2], b)) return false;
    }
    return true;
  });
}
/** the render geometry of a box part with its free arrises bevelled (null: nothing to bevel) */
function bevelledBoxGeometry(b: Box, index: PartIndex, stats: BevelStats): THREE.BufferGeometry | null {
  const B = BEVEL[b.material]; if (!B || NO_BEVEL.has(b.kind) || b.sculpt || b.door) return null;
  const h: V3 = [b.size[0] / 2, (b.y1 - b.y0) / 2, b.size[1] / 2], r = Math.min(B.r, 0.5 * Math.min(h[0], h[1], h[2]));
  if (r < 0.002) return null;
  const edges = freeArrises(b, index); const k = edges.filter(Boolean).length; stats.edges += 12; stats.bevelled += k;
  if (!k) return null;
  const { pos, nrm } = bevelledBox(h, r, edges, B.round);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.rotateY(b.rot ?? 0); g.translate(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]);
  return g;
}
export interface BevelStats { edges: number; bevelled: number; trisFlat: number; trisBevelled: number }
/** kinds whose up-facing faces are walked floors: their box goes to the `pbox` attribute with +hx (floor wear, D-157) */
const FLOORS = new Set(['floor_finish', 'portico_floor', 'pavement', 'landing', 'floor']);
/** per-vertex part attributes for the architecture variant of the surface materials (D-157): `y0` = the part's base height
 *  (wall-foot band), `pbox` = (centre x, centre z, ±half size x, half size z) in world axes (+ for floors: traffic wear;
 *  the sizes also gate the slab joints of large up-facing parts), `ytop` = the part's top (run-off streaks) */
function partAttributes(g: THREE.BufferGeometry, p: Box | Prism, index: PartIndex) {
  const n = g.getAttribute('position').count, y0 = new Float32Array(n).fill(-1000), box = new Float32Array(n * 4);
  // `y0`: the floor in front of each vertex of a vertical face (5 cm out along its normal, the highest part top at or below
  // the part's own top): a wall's floor, a parapet's tread or court, a jamb's threshold. Parts founded deep (stairs,
  // the platform at −20 m) and the lintel zone above a door get the surface they really stand on; where nothing is in
  // front (the Terrace's outer walls over the plain: the terrain is not a part) there is no band (−1000)
  // One value per face (the vertices sharing a normal): a probe at the middle of the face's bottom edge, so a face never
  // interpolates between the floor and, near a corner, the top of the wall it abuts
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), faces = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const ny = N.getY(i); if (Math.abs(ny) > 0.5) continue;
    const k = `${N.getX(i).toFixed(2)},${ny.toFixed(2)},${N.getZ(i).toFixed(2)}`; (faces.get(k) ?? faces.set(k, []).get(k)!).push(i);
  }
  for (const idx of faces.values()) {
    let yMin = Infinity; for (const i of idx) yMin = Math.min(yMin, P.getY(i));
    let x = 0, z = 0, m = 0; for (const i of idx) if (P.getY(i) < yMin + 0.01) { x += P.getX(i); z += P.getZ(i); m++; }
    const nx = N.getX(idx[0]), nz = N.getZ(idx[0]), l = Math.hypot(nx, nz) || 1;
    const f = index.topBelow(x / m + (nx / l) * 0.05, z / m + (nz / l) * 0.05, p.y1, p);
    if (Number.isFinite(f)) for (const i of idx) y0[i] = f;
  }
  let cx: number, cz: number, hx: number, hz: number;
  if (p.type === 'box') { const r = p.rot ?? 0, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r)); cx = p.c[0]; cz = -p.c[1]; hx = (p.size[0] * c + p.size[1] * s) / 2; hz = (p.size[0] * s + p.size[1] * c) / 2; }
  else { const [x0, x1, n0, n1] = planBounds(p); cx = (x0 + x1) / 2; cz = -(n0 + n1) / 2; hx = (x1 - x0) / 2; hz = (n1 - n0) / 2; }
  const sx = FLOORS.has(p.kind) ? hx : -hx;
  for (let i = 0; i < n; i++) box.set([cx, cz, sx, hz], i * 4);
  g.setAttribute('y0', new THREE.BufferAttribute(y0, 1)); g.setAttribute('pbox', new THREE.BufferAttribute(box, 4));
  g.setAttribute('ytop', new THREE.BufferAttribute(new Float32Array(n).fill(p.y1), 1)); // run-off streaks below the part's top
}
/** A/B for measurements (window.__parsaSurf.bevels(on)): swap the merged part meshes between their bevelled and their
 *  plain geometry */
const bevelSwap: { mesh: THREE.Mesh; bevelled: THREE.BufferGeometry; plain: THREE.BufferGeometry }[] = [];
export function setBevels(on: boolean) { for (const s of bevelSwap) s.mesh.geometry = on ? s.bevelled : s.plain; }
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaSurf = { ...((globalThis as any).__parsaSurf ?? {}), bevels: setBevels };

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

export interface BuiltArch { group: THREE.Group; triangles: number; colliders: number; bevel: BevelStats }
/** opts.dynamicDoors: door leaves (parts with `door`, D-051) get no static collider, because the world's door system
 *  (doors.ts) gives each a kinematic one that follows its swing. Without it (walkable-grid build, offline bots) a leaf is a
 *  static collider in its walkable-grid pose. Leaves are never drawn here: the door system draws them. */
export function buildMeshes(parts: Part[], phys?: Physics, opts: { dynamicDoors?: boolean } = {}): BuiltArch {
  const group = new THREE.Group(); group.name = 'architecture';
  const byKey = new Map<string, { geos: THREE.BufferGeometry[]; plain: THREE.BufferGeometry[]; parts: Part[] }>();
  const index = new PartIndex(parts), bstats: BevelStats = { edges: 0, bevelled: 0, trisFlat: 0, trisBevelled: 0 };
  if (opts.dynamicDoors) bevelSwap.length = 0;
  const cols = new Map<string, { order: ColumnOrder; built: number; parts: Column[] }>();
  const colossi = parts.filter(p => p.type === 'box' && p.sculpt) as Box[];
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
    const leaf = p.type === 'box' && !!p.door;
    if (phys && p.solid !== false && p.kind !== 'roof' && !(leaf && opts.dynamicDoors)) {
      const pos = g.getAttribute('position').array as Float32Array; const idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
      phys.addTrimesh(new Float32Array(pos), idx, { building: p.building, kind: p.kind }); colliders++;
    }
    if (p.type === 'box' && p.sculpt) continue; // rendered as sculpture below; the box is the collider only
    if (leaf) continue; // drawn (and moved) by the door system
    // walls around sculpted jambs are already cut in the parts (terrace.ts: parts.cutWall). The render geometry is the part's
    // own, with its free arrises bevelled (D-157); the collider above stays the plain box
    const plain = g.clone(), rg = (p.type === 'box' ? bevelledBoxGeometry(p, index, bstats) : null) ?? g.clone();
    partAttributes(rg, p, index); partAttributes(plain, p, index);
    bstats.trisFlat += plain.getAttribute('position').count / 3; bstats.trisBevelled += rg.getAttribute('position').count / 3;
    const key = `${p.building}|${p.material}|${p.tier}|${p.placeholder ? 1 : 0}`;
    if (!byKey.has(key)) byKey.set(key, { geos: [], plain: [], parts: [] }); const e = byKey.get(key)!; e.geos.push(rg); e.plain.push(plain); e.parts.push(p);
  }
  // the timber ceilings under the roofs (D-188): render geometry only, merged per building (no colliders, no bevels)
  for (const p of ceilingTimbers(parts)) {
    const g = boxGeometry(p); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    partAttributes(g, p, index);
    const key = `${p.building}|${p.material}|${p.tier}|0|ceiling`;
    if (!byKey.has(key)) byKey.set(key, { geos: [], plain: [], parts: [] }); const e = byKey.get(key)!; e.geos.push(g); e.plain.push(g.clone()); e.parts.push(p);
  }
  let tris = 0;
  for (const [key, { geos, plain, parts: ps }] of byKey) {
    const [building, mat, tier, ph, extra] = key.split('|');
    const g = mergeGeometries(geos)!; tris += g.getAttribute('position').count / 3;
    const roof = ps.every(p => p.kind === 'roof');
    // a timber roof takes the roof surface: cedar with reed matting on its underside, the ceiling (D-188)
    const m = new THREE.Mesh(g, roof ? roofMaterial(mat === 'timber' && !flatMode ? surfaceMaterial('roof_timber', { arch: true }) : archMaterial(mat as Material)) : archMaterial(mat as Material)); m.castShadow = m.receiveShadow = true; m.name = `${building}:${mat}${extra ? ':' + extra : ''}`;
    if (opts.dynamicDoors) bevelSwap.push({ mesh: m, bevelled: g, plain: mergeGeometries(plain)! }); // the world's build only
    m.userData = { tier, src: [...new Set(ps.map(p => p.src))].join(';'), placeholder: ph === '1', note: `greybox (Phase 2): ${[...new Set(ps.map(p => p.kind))].join(', ')}`, building };
    group.add(m);
  }
  const SW = srow('lod', 'switch');
  for (const [, c] of cols) {
    // one InstancedLOD per member surface (a stone order is one; the Treasury's stone base, plastered shaft and timber
    // capital are three, sculpture.json shaft.members)
    const L0 = columnMeshesByMaterial(c.order, c.built, 0), L1 = columnMeshesByMaterial(c.order, c.built, 1), M = memberMaterials(c.order);
    const at = new Float32Array(c.parts.length * 4); c.parts.forEach((p, i) => at.set([p.c[0], p.y0, -p.c[1], c.order.baseH + (c.order.height - c.order.baseH) * c.built], i * 4));
    const b = c.parts[0].building, split = L0.length > 1;
    for (const { material: mat, mesh } of L0) {
      const g0 = toGeometry(mesh), g1 = toGeometry(L1.find(x => x.material === mat)!.mesh);
      const lod = new InstancedLOD([g0, g1], carvedMaterial(mat), at, SW.column, SW.hysteresis);
      const members = (['base', 'shaft', 'capital'] as const).filter(k => M[k] === mat).join(' + ');
      const paintMissing = split && mat === 'plaster'; // the Treasury shafts were painted 'in bright colours' (B); colours not found
      lod.name = `${b}:columns${split ? ':' + mat : ''}`;
      lod.userData = { tier: c.parts[0].tier, src: `${c.parts[0].src};RECON${split ? ';ISAC-PA' : ''}`, placeholder: paintMissing, building: b,
        note: `column order ${c.order.id} (${c.order.base} base, ${c.order.capital} capital)${split ? `, ${members} in ${mat}` : ''}: dimensions SITE_SPEC; carving procedural sculpture, form C (D-018; scans would replace it, NEEDS #10)${c.built < 1 ? '; under construction: unfluted drums' : ''}${paintMissing ? '; PLACEHOLDER paint: shafts attested painted in bright colours (B), colours and pattern not found, shown as bare lime plaster (Q-020)' : ''}` };
      lod.levels.forEach((im, k) => { im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; });
      tris += (g0.index!.count / 3) * c.parts.length;
      group.add(lod);
    }
  }
  if (colossi.length) {
    const fr = colossusFrontProjections(parts as Box[]); const front = fr.reduce((a, b) => a + b, 0) / fr.length;
    setColossusFront(front);
    const idx = sculptIndex(); if (idx && Math.abs(idx.params.colossusFront - front) > 0.05) console.warn(`sculpt: colossi were generated for a ${idx.params.colossusFront.toFixed(2)} m fore-part, the layout gives ${front.toFixed(2)} m (rerun npx tsx tools/build_sculpt.ts)`);
    for (const p of colossi) {
      const meshes = ([0, 1] as Lod[]).map(l => { const m = new THREE.Mesh(toGeometry(colossusMesh(p, l)), carvedMaterial(p.material)); m.castShadow = m.receiveShadow = true; return m; });
      const centre = new THREE.Vector3(p.c[0], (p.y0 + p.y1) / 2, -p.c[1]);
      const lod = new MeshLOD(meshes, centre, SW.colossus, SW.hysteresis); lod.name = `${p.building}:colossus:${p.sculpt!.model}`;
      lod.userData = { tier: p.tier, src: p.src, placeholder: false, building: p.building, note: `${p.note ?? 'colossus'}; carved form reconstructed from the type (RECOLLECTION), not measured; licensed scans would replace it (NEEDS #10)` };
      meshes.forEach((m, k) => { m.name = `${lod.name}:lod${k}`; m.userData = lod.userData; });
      tris += meshes[0].geometry.index!.count / 3;
      group.add(lod);
    }
  }
  return { group, triangles: tris, colliders, bevel: bstats };
}
