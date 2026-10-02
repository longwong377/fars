// Parts → Three.js meshes (merged per building+material; columns instanced per order with two distance LODs; doorway
// colossi as sculpture) and Rapier colliders (always the parts' own boxes/prisms).
import * as THREE from 'three/webgpu';
import { ADIST_OFF } from '../render/blockface';
import { arrisEdgesOfBox, edgeSeed, aseedOf, ARRIS_MATS, type ArrisEdge } from './arris';
import { prismArrisGeometry, finishProtoEdges } from './arris_prism';
import { verticalFaces, chunkFaces, type JointFace } from './arris_joints';
import { planarFaces, planarBounds, planarWorld } from './arris_slabs';
import { mudFace, HardIndex, MUD_MATS } from './mudface';
/** D-364: the treads, risers and slabs of a dressed-stone part whose joints the near field grooves (arris_slabs.ts); a chunk whose
 *  every sample, 3 cm out of the face, lies inside another part (a riser's back against the next step, a slab under a floor) left out */
function planarJointFaces(rg: THREE.BufferGeometry, p: Part, stair: [number, number, number, number] | undefined, index: PartIndex): JointFace[] {
  if (p.type === 'column') return [];
  const PB = rg.getAttribute('pbox'), pbox: [number, number, number, number] = PB ? [PB.getX(0), PB.getY(0), PB.getZ(0), PB.getW(0)] : [0, 0, -1, -1];
  return planarFaces(rg, p.material, stair).filter(pf => { const [u0, u1, v0, v1] = planarBounds(pf);
    for (const fu of [0.1, 0.5, 0.9]) for (const fv of [0.1, 0.5, 0.9]) { const q = planarWorld(pf, u0 + (u1 - u0) * fu, v0 + (v1 - v0) * fv).addScaledVector(pf.N, 0.03); if (!index.inside(q.x, q.y, q.z, p)) return true; }
    return false; })
    .map(pf => ({ n: pf.N, d: pf.d, t0: 0, t1: 0, y0: p.y0, y1: p.y1, surf: p.material, y0attr: pf.y0, pbox, ytop: p.y1, stair, pf }));
}
/** rev 4: a wall chunk every sample of which lies against (3 cm in front of it is inside) another part */
function faceCovered(F: JointFace, p: Part, index: PartIndex): boolean {
  for (const ft of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) { const t = F.t0 + (F.t1 - F.t0) * ft, y = F.y0 + (F.y1 - F.y0) * fy, x = F.n.z * t + F.n.x * (F.d + 0.03), z = -F.n.x * t + F.n.z * (F.d + 0.03);
    if (!index.inside(x, y, z, p)) return false; }
  return true;
}
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { packGeo, unpackGeo, type GeoPack } from '../world/cache/geo';
import type { Part, Prism, Box, Column, ColumnOrder, Material } from './parts';
import type { Physics } from '../player/physics';
import { columnMesh, columnMeshesByMaterial, memberMaterials, toGeometry, colossusMesh, colossusFrontProjections, setColossusFront, sculptIndex, srow, Lod, protomeBox, protomeMesh, voluteBox, voluteMesh } from './sculpt';
import { model, fitLevel, placeLevel, bakedMaterial, registerSwap } from '../render/models';
import { frameGeometries, type FrameGeoStats } from './frames';
import { frameMaterial } from '../render/decorAssets';
import { memberBox, memberMesh, type MemberName, type ShaftKind } from './sculpt';
import { modelledParts, memberModel, shaftModel, shaftGeometry, columnSeed, columnBaked, bakedSurface } from './column_models';
export { cutWall } from './parts';

/** Greybox materials (Phase 2): flat albedos from pigment/stone references are Phase 3; these are neutral and tagged C. */
const ALBEDO: Record<Material, [number, number, number]> = {
  limestone: [0.62, 0.6, 0.56], limestone_dark: [0.28, 0.28, 0.28], mudbrick: [0.66, 0.56, 0.44], mudbrick_painted: [0.58, 0.57, 0.45], plaster: [0.8, 0.76, 0.68],
  plaster_red: [0.5, 0.16, 0.12], bronze: [0.55, 0.4, 0.22],
  timber: [0.36, 0.27, 0.19], glazed: [0.2, 0.4, 0.55], earth: [0.5, 0.42, 0.32], scaffold: [0.45, 0.35, 0.24], rubble: [0.55, 0.52, 0.48],
  court_fill: [0.5, 0.46, 0.39], terrace: [0.62, 0.6, 0.56], roof_earth: [0.61, 0.54, 0.42], mudbrick_bare: [0.6, 0.52, 0.41], steel: [0.3, 0.3, 0.31],
};
import { surfaceMaterial, paintedShaftMaterial } from '../render/materials';
import { pointInPoly } from './parts';
import { v } from './spec';
import { labToLinear } from '../core/colour';
import PC from '../data/polychromy.json';
/** the Treasury shafts' paint for an order (D-214, Q-020; SITE_SPEC treasury.r_shaft_paint: the pigments of
 *  src/data/polychromy.json, the lattice and bands C) */
function shaftPaint(o: ColumnOrder): THREE.Material {
  const R = v<any>('treasury', 'r_shaft_paint'), pig = (k: string) => { const L = (PC as any).pigment[k].v; return labToLinear(L[0], L[1], L[2]); };
  return paintedShaftMaterial({ ground: pig(R.ground), line: pig(R.line), band: pig(R.band), around: R.around, lozenge_h: R.lozenge_h, line_w: R.line_w, band_h: R.band_h, edge_w: R.edge_w, y0: o.baseH, y1: o.height - o.capitalH, D: o.shaftD });
}
import { ceilingTimbers } from './ceilings';
import { roofEdges, wallFeet, type RoofEdges } from './roofedge';
import { buildPieces } from './palacekit';
/** D-276: parts that are colliders only: the round fittings world/furnish.ts draws (storage jars, querns) */
export const COLLIDER_ONLY = new Set(['jar', 'quern']);
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
export const isFlatMode = () => flatMode; // (D-392: in the baked architecture's key)
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
/** D-276: a ceiling joist as the three faces anyone sees (its underside and its two long sides): its top lies against the
 *  roof slab and its ends in the walls or on the beams, so 6 triangles instead of 12 (the ceilings' triangle budget,
 *  tests/surfaces_s6.test.ts, with the room ranges' ceilings added) */
export const JOIST_TRIS = 6;
export function joistGeometry(b: Box): THREE.BufferGeometry {
  const g = boxGeometry(b), alongX = b.size[0] >= b.size[1]; // (the ceilings' boxes are grid-aligned: ceilings.ts)
  // non-indexed BoxGeometry: faces +x, −x, +y, −y, +z, −z, six vertices each; keep −y and the two faces along the length
  const keep = [3, ...(alongX ? [4, 5] : [0, 1])], out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal'] as const) { const a = g.getAttribute(name).array as Float32Array, r = new Float32Array(keep.length * 18);
    keep.forEach((f, i) => r.set(a.subarray(f * 18, f * 18 + 18), i * 18)); out.setAttribute(name, new THREE.BufferAttribute(r, 3)); }
  return out;
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
  mudbrick: { r: 0.03, round: true }, mudbrick_painted: { r: 0.03, round: true }, plaster: { r: 0.03, round: true }, mudbrick_bare: { r: 0.015, round: true }, plaster_red: { r: 0.03, round: true } /* D-334: the floor coat's cove at the wall foot */,
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
export function bevelledBox(h: V3, r: number, edges: boolean[], round: boolean, seeds: number[] = []): { pos: number[]; nrm: number[]; adist: number[]; aseed: number[] } {
  const planes: Plane[] = FACE_N.map((n, i) => ({ n, d: Math.abs(dot3(n, h)), box: i }));
  BOX_EDGES.forEach(([a, b], k) => {
    if (!edges[k]) return;
    const na = FACE_N[a], nb = FACE_N[b], s = Math.SQRT1_2, n: V3 = [(na[0] + nb[0]) * s, (na[1] + nb[1]) * s, (na[2] + nb[2]) * s];
    planes.push({ n, d: (planes[a].d + planes[b].d - r) * s, box: -1, parents: [a, b] });
  });
  const S = 4 * Math.max(h[0], h[1], h[2]) + 1, pos: number[] = [], nrm: number[] = [], adist: number[] = [], aseed: number[] = [];
  // D-321: per vertex, the distance (m) to each of the face's four bevelled arrises (the box faces round it, in FACE_N order),
  // stored as d − ADIST_OFF so a geometry without the attribute (read as 0) has none; affine over the planar face, so the
  // interpolated value is the exact distance at every fragment (materials.ts: chips and margins along the free arrises)
  const around = (a: number) => [0, 1, 2, 3, 4, 5].filter(b => dot3(FACE_N[a], FACE_N[b]) === 0);
  const edgeOf = (a: number, b: number) => BOX_EDGES.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
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
    const ad = poly.map(q => P.box < 0 ? [0, ADIST_OFF, ADIST_OFF, ADIST_OFF].map(x => x - ADIST_OFF) // (the chamfer lies on its arris)
      : around(P.box).map(b => edges[edgeOf(P.box, b)] ? planes[b].d - dot3(FACE_N[b], q) - ADIST_OFF : 0));
    // rev 3: per arris, its strip row and offset (arris.ts aseedOf), in the same order as 'adist'
    const sd = P.box < 0 ? [aseedOf(seeds[edgeOf(P.parents![0], P.parents![1])] ?? 0), 0, 0, 0] : around(P.box).map(b => edges[edgeOf(P.box, b)] ? aseedOf(seeds[edgeOf(P.box, b)] ?? 0) : 0);
    for (let i = 1; i + 1 < poly.length; i++) for (const j of [0, i, i + 1]) { pos.push(...snap(poly[j])); nrm.push(...vn[j]); adist.push(...ad[j]); aseed.push(...sd); }
  }
  return { pos, nrm, adist, aseed };
}
/** "is this world point inside a part?" over all parts except door leaves, on a 4 m grid of the parts' plan bounds */
/** D-334 (Q-922, C): the buildings whose halls and rooms are drawn with painted plaster inside (materials.ts SurfaceDef paint):
 *  the finished palaces and the Treasury (clay paint on its walls: Schmidt via Stein et al. 2016, B), not the garrison's
 *  service ranges, the fortification, or the halls still under construction in 467 (the Hall of 100 Columns, the Tripylon) */
/** D-334: the surface a part is drawn in: a mud-brick wall still under construction in 467 stands in its bare courses (the
 *  plaster is the last coat, laid when the brickwork is done: C); every other part its own material */
export const renderMaterial = (p: Part): Material => p.material.startsWith('mudbrick') && /under construction/.test(p.note ?? '') ? 'mudbrick_bare' : p.material;
export const PAINTED_INTERIORS = new Set<string>(v<any>('global', 'r_interior_paint').buildings); // SITE_SPEC global.r_interior_paint
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
  /** D-334: whether a roof of this building stands over the point (world x, y, z): the plan inside a roof box whose underside
   *  is above y (an interior face of a hall or a room looks at this) */
  roofOver(x: number, y: number, z: number, building: string): boolean {
    const e = x, n = -z, list = this.cells.get(Math.floor(e / this.CELL) * 100003 + Math.floor(n / this.CELL)); if (!list) return false;
    for (const i of list) { const p = this.parts[i]; if (p.kind !== 'roof' || p.type !== 'box' || p.building !== building || p.y0 < y) continue;
      const c = Math.cos(-(p.rot ?? 0)), s = Math.sin(-(p.rot ?? 0)), de = e - p.c[0], dn = n - p.c[1];
      if (Math.abs(de * c - dn * s) <= p.size[0] / 2 && Math.abs(de * s + dn * c) <= p.size[1] / 2) return true; }
    return false;
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
  // D-334: the rotated box's own bounds (was its circumscribed square: a 70 m parapet filled every cell of a 70 m square, and
  // every lookup there walked it)
  const r = p.rot ?? 0, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), ex = (cs * p.size[0] + sn * p.size[1]) / 2, ey = (sn * p.size[0] + cs * p.size[1]) / 2;
  return [p.c[0] - ex, p.c[0] + ex, p.c[1] - ey, p.c[1] + ey];
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
  // rev 3: each edge's seed from its world midpoint (arris.ts edgeSeed: the band and the maps read the same chips)
  const M = new THREE.Matrix4().makeRotationY(b.rot ?? 0).setPosition(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]);
  const seeds = BOX_EDGES.map(([i, j]) => edgeSeed(new THREE.Vector3(...FACE_N[i].map((x, c) => (x + FACE_N[j][c]) * h[c]) as V3).applyMatrix4(M)));
  const { pos, nrm, adist, aseed } = bevelledBox(h, r, edges, B.round, seeds);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('adist', new THREE.Float32BufferAttribute(adist, 4)); g.setAttribute('aseed', new THREE.Float32BufferAttribute(aseed, 4)); g.userData.arris = { edges, r }; // (D-321 rev 2: the near-field arris bands)
  g.rotateY(b.rot ?? 0); g.translate(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]);
  return g;
}
export interface BevelStats { edges: number; bevelled: number; trisFlat: number; trisBevelled: number }
/** kinds whose up-facing faces are walked floors: their box goes to the `pbox` attribute with +hx (floor wear, D-157) */
const FLOORS = new Set(['floor_finish', 'portico_floor', 'pavement', 'landing', 'floor']);
/** Stair blocks (D-218): the Grand Stair's steps were cut "4-5 steps from single blocks" (SITE_SPEC
 *  grand_stair.block_construction, IR-PERS: B); every other flight is drawn the same way by analogy (C). The step parts of
 *  each flight (same building, tread and width, same line across the run) are ordered by height and grouped into block rows
 *  of 4 or 5 steps (hashed per row). Per step: [row index, flight seed in 0.1…0.9 (negative on the first step of a row, whose
 *  tread carries the row's joint), run direction x, z (world, rising)]. The material reads it as the `stair` attribute */
export function stairRows(parts: Part[]): Map<Part, [number, number, number, number]> {
  const out = new Map<Part, [number, number, number, number]>(), flights = new Map<string, { b: Box; run: [number, number]; along: number }[]>();
  for (const p of parts) {
    if (p.type !== 'box' || p.kind !== 'step') continue;
    const r = p.rot ?? 0, c = Math.cos(r), s = Math.sin(r), runLocal = p.size[0] <= p.size[1] ? 0 : 1;
    const run: [number, number] = runLocal === 0 ? [c, s] : [-s, c]; // grid (e, n) unit along the run (sign fixed below)
    const across = -run[1] * p.c[0] + run[0] * p.c[1];
    const k = `${p.building}|${Math.min(...p.size).toFixed(3)}|${Math.max(...p.size).toFixed(2)}|${(((r % Math.PI) + Math.PI) % Math.PI).toFixed(3)}|${runLocal}|${Math.round(Math.abs(across) * 20) * Math.sign(across)}`;
    (flights.get(k) ?? flights.set(k, []).get(k)!).push({ b: p, run, along: run[0] * p.c[0] + run[1] * p.c[1] });
  }
  // a line of steps may hold several flights (the Grand Stair's mirrored halves): split where consecutive treads do not touch
  const chains: [string, { b: Box; run: [number, number]; along: number }[]][] = [];
  for (const [k, L] of flights) {
    L.sort((a, b) => a.along - b.along);
    // (or where the heights stop rising the same way: two flights rising apart from a common foot, the Hadish stairs)
    const tread = Math.min(...L[0].b.size); let ch = [L[0]], n = 0, dir = 0;
    for (let i = 1; i < L.length; i++) {
      const dy = L[i].b.y1 - L[i - 1].b.y1, s = Math.abs(dy) < 1e-4 ? 0 : Math.sign(dy);
      if (L[i].along - L[i - 1].along > tread * 1.5 || s === 0 || (dir !== 0 && s !== dir)) { chains.push([`${k}|${n++}`, ch]); ch = []; dir = 0; }
      else dir = s;
      ch.push(L[i]);
    }
    chains.push([`${k}|${n}`, ch]);
  }
  for (const [k, F] of chains) {
    F.sort((a, b) => a.b.y1 - b.b.y1);
    // the rising direction: from the lowest step toward the highest (a single step: its run axis as found)
    const sgn = F.length > 1 && F[F.length - 1].along < F[0].along ? -1 : 1;
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    const seed = 0.1 + 0.8 * ((h % 1000) / 1000);
    let row = 0, left = 4 + ((h >>> 3) & 1);
    F.forEach((f, i) => {
      if (i > 0 && left === 0) { row++; left = 4 + (((h >>> 5) + row * 7) % 2); }
      const first = i === 0 || out.get(F[i - 1].b)![0] !== row;
      out.set(f.b, [row, first ? -seed : seed, sgn * f.run[0], -sgn * f.run[1]]); // grid n → world −z
      left--;
    });
  }
  return out;
}
/** per-vertex part attributes for the architecture variant of the surface materials (D-157): `y0` = the part's base height
 *  (wall-foot band), `pbox` = (centre x, centre z, ±half size x, half size z) in world axes (+ for floors: traffic wear;
 *  the sizes also gate the slab joints of large up-facing parts), `ytop` = the part's top (run-off streaks), `stair` = the
 *  step's block row (stairRows, D-218; zeros for any other part) */
function partAttributes(g: THREE.BufferGeometry, p: Box | Prism, index: PartIndex, stair?: [number, number, number, number]) {
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
  // D-334: 'inner' = 1 on a vertical face that looks into a roofed hall or room of its own building (a probe 0.3 m out along the
  // face's normal at mid height, under one of the building's roofs): the painted interiors (materials.ts paint); 0 elsewhere
  const inner = new Float32Array(n);
  if (p.material.startsWith('mudbrick') && PAINTED_INTERIORS.has(p.building) && !/under construction/.test(p.note ?? '')) for (const idx of faces.values()) {
    let x = 0, y = 0, z = 0; for (const i of idx) { x += P.getX(i); y += P.getY(i); z += P.getZ(i); } x /= idx.length; y /= idx.length; z /= idx.length;
    const nx = N.getX(idx[0]), nz = N.getZ(idx[0]), l = Math.hypot(nx, nz) || 1;
    if (index.roofOver(x + (nx / l) * 0.3, Math.min(y, p.y1 - 0.2), z + (nz / l) * 0.3, p.building)) for (const i of idx) inner[i] = 1;
  }
  g.setAttribute('inner', new THREE.BufferAttribute(inner, 1));
  const st = new Float32Array(n * 4); if (stair) for (let i = 0; i < n; i++) st.set(stair, i * 4);
  g.setAttribute('stair', new THREE.BufferAttribute(st, 4));
  if (!g.getAttribute('adist')) g.setAttribute('adist', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); // D-321: no free arris
  if (!g.getAttribute('aseed')) g.setAttribute('aseed', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
}
/** D-334: the part attributes of a roof-edge or wall-foot box without the per-face probes: its floor is its own foot for a wall
 *  foot (the skirting's band continues over it) and none for the wall heads (no foot band up there); no floor box, no stair, not
 *  an inner face; the run-off from its own top */
function edgeAttributes(g: THREE.BufferGeometry, p: Box) {
  const n = g.getAttribute('position').count, box = new Float32Array(n * 4), r = p.rot ?? 0, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const hx = (p.size[0] * c + p.size[1] * s) / 2, hz = (p.size[0] * s + p.size[1] * c) / 2;
  for (let i = 0; i < n; i++) box.set([p.c[0], -p.c[1], -hx, hz], i * 4);
  g.setAttribute('y0', new THREE.BufferAttribute(new Float32Array(n).fill(p.kind === 'wall_foot' ? p.y0 : -1000), 1)); g.setAttribute('pbox', new THREE.BufferAttribute(box, 4));
  g.setAttribute('ytop', new THREE.BufferAttribute(new Float32Array(n).fill(p.y1), 1)); g.setAttribute('inner', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('stair', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  if (!g.getAttribute('adist')) g.setAttribute('adist', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  if (!g.getAttribute('aseed')) g.setAttribute('aseed', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); // (D-321 rev 3's arris seeds: none here)
}
/** A/B for measurements (window.__parsaSurf.bevels(on)): swap the merged part meshes between their bevelled and their
 *  plain geometry */
const bevelSwap: { mesh: THREE.Mesh; bevelled: THREE.BufferGeometry; plain: THREE.BufferGeometry }[] = [];
export function setBevels(on: boolean) { if (!bevelSwap.length) console.warn('[arch] no plain geometry kept: load with ?bevelswap (D-392)'); for (const s of bevelSwap) s.mesh.geometry = on ? s.bevelled : s.plain; }
/** D-392 (s15/load): the plain twins are built only for that A/B (?bevelswap): nothing else draws them (page memory, load) */
const KEEP_PLAIN = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bevelswap');
/** D-392: the parts' render geometry as the baked world keeps it (per merged mesh: its key, geometry and what its userData
 *  names; the arris edges and joint faces; the bevel counts), read back instead of bevelling, cutting and merging again */
export type ArchBake = { meshes: { key: string; g: GeoPack; src: string; kinds: string; roof: boolean }[]; arris: ArrisEdge[]; jointFaces: JointFace[]; bstats: BevelStats; frames: FrameGeoStats | null; tris: number };
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
  /** at: per instance [x, y0, z, height] (world); switch: distance to the instance's vertical axis segment (m); seeds: per
   *  instance two numbers carried as the instanced attribute `colSeed` (D-328: the shaft tiles' offsets), reordered with the
   *  instances whenever the levels are reassigned */
  constructor(geos: THREE.BufferGeometry[], mat: THREE.Material, private at: Float32Array, private switchAt: number, private hyst: number, private seeds?: Float32Array) {
    super();
    const n = at.length / 4, m4 = new THREE.Matrix4();
    this.levels = geos.map(g => {
      if (seeds) g.setAttribute('colSeed', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
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
  /** a level's geometries that carry colSeed: its own, and its procedural twin's when the A/B swap gave it one (D-305) */
  readonly seedTwins: THREE.BufferGeometry[][] = [];
  private seedGeos(L: number) { const im = this.levels[L], out = [im.geometry, ...(this.seedTwins[L] ?? [])]; return out.filter(g => g.getAttribute('colSeed')); }
  private assign() {
    const m4 = new THREE.Matrix4(), cnt = this.levels.map(() => 0);
    for (let i = 0; i < this.level.length; i++) {
      const L = this.level[i], im = this.levels[L];
      if (this.seeds) for (const g of this.seedGeos(L)) { const a = g.getAttribute('colSeed') as THREE.InstancedBufferAttribute; a.setXY(cnt[L], this.seeds[i * 2], this.seeds[i * 2 + 1]); a.needsUpdate = true; }
      m4.makeTranslation(this.at[i * 4], this.at[i * 4 + 1], this.at[i * 4 + 2]); im.setMatrixAt(cnt[L]++, m4);
    }
    this.levels.forEach((im, k) => { im.count = cnt[k]; im.visible = cnt[k] > 0; im.instanceMatrix.needsUpdate = true; });
  }
}
/** Two-level distance LOD for one mesh (colossi); same camera rule as InstancedLOD */
/** the affine map (row-major 3x4) that places a colossus piece (reference box, sculpture.json colossus) in its part's box, as
 *  sculpt.ts colossusMesh does (a test holds them equal): scaled to the box, mirrored so the head faces `facing` and the relief
 *  the passage */
export function colossusPlacement(p: Box): number[] {
  const RB = srow('colossus', 'reference_box'), L = p.size[0], W = p.size[1], H = p.y1 - p.y0, f = p.sculpt!.facing, s = p.sculpt!.passage;
  return [(L / RB.L) * f, 0, 0, p.c[0], 0, H / RB.H, 0, p.y0, 0, 0, -(W / RB.W) * s, -p.c[1]];
}
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


const MEMBER_WHAT: Record<MemberName, string> = {
  base_bell: 'bell base (foot, bell with pendant leaves under a row of scalloped tongues, horizontally fluted torus)', base_square2: 'square base (two stepped plinths, fluted torus)',
  base_plain: 'plain drum base with its torus', bells: 'palm and calyx bells of the composite capital (drooping palm leaves, bead row, ribbed calyx with its crown of sepal tips)',
  collar: 'collar of the double-bull capital', capital_plain: 'timber bolster and abacus of the plain capital',
};
/** D-328: one lathe member of an order drawn by its Blender-built model at the instances `at` ([x, y0, z, height] each), fitted
 *  to the order's member box, the procedural member as its A/B twin; null when the model is not loaded */
export function memberLOD(o: ColumnOrder, m: MemberName, b: string, at: Float32Array, rec: { tier: string; src: string; name?: string; note?: string }): { lod: InstancedLOD; tris: number } | null {
  const MM = memberModel(m); if (!MM || flatMode) return null;
  const SW = srow('lod', 'switch'), [lo, hi] = memberBox(o, m)!, M = memberMaterials(o), mat = m.startsWith('base_') ? M.base : M.capital, surf = CARVED[mat] ?? mat;
  const geos = MM.lods.map(g => fitLevel(g, lo, hi)), mats = MM.maps.map((map, k) => columnBaked(`${MM.id}:${k}:${surf}`, bakedSurface(surf, `${MM.id}:${k}`), map, false));
  const lod = new InstancedLOD(geos, mats[0], at, SW.column, SW.hysteresis);
  lod.name = rec.name ?? `${b}:columns:${m}`;
  lod.userData = { tier: rec.tier, src: `${rec.src};RECON;PHOTO`, placeholder: false, building: b, model: MM.id,
    note: rec.note ?? `${MEMBER_WHAT[m]} of the ${o.id} order, ${mat}: the game's own member (sculpture.json, SITE_SPEC dimensions; form C) baked in Blender from a dense carved source after the photographed members (D-328; tools/blender/columns.json: motifs B, layout and sizes C): normal and occlusion maps on the same triangles` };
  lod.levels.forEach((im, k) => { im.material = mats[k] ?? mats[0]; im.name = `${lod.name}:lod${k}`; im.userData = lod.userData;
    const pm = memberMesh(o, m, k as Lod); if (pm) registerSwap(im, [toGeometry(pm), carvedMaterial(mat)]); });
  return { lod, tris: (geos[0].index!.count / 3) * (at.length / 4) };
}
/** D-328: the shafts of one column state drawn with the baked tile `kind` (column_models.ts): the game's own shaft levels with tile
 *  coordinates, the map offset per column (colSeed from its grid position), the procedural shaft as the A/B twin */
export function shaftLOD(o: ColumnOrder, built: number, st: { fluted?: boolean }, kind: ShaftKind, b: string, at: Float32Array, grid: [number, number][], rec: { tier: string; src: string; name?: string; note?: string }): { lod: InstancedLOD; tris: number } {
  const SM = shaftModel(kind)!, SW = srow('lod', 'switch'), M = memberMaterials(o), mat = M.shaft, surf = CARVED[mat] ?? mat;
  const painted = M.shaft === 'plaster' && M.base !== M.shaft && o.id === 'treasury'; // the Treasury's painted shafts (D-214)
  const geos = ([0, 1] as Lod[]).map(l => shaftGeometry(o, built, l, st.fluted)!);
  const seeds = new Float32Array(grid.length * 2); grid.forEach((p, i) => seeds.set(columnSeed(p[0], p[1], o.flutes), i * 2));
  const mats = SM.maps.map((map, k) => columnBaked(`${SM.id}:${k}:${surf}${painted ? ':paint:' + o.shaftD : ''}`, painted ? () => shaftPaint(o).clone() as THREE.MeshStandardNodeMaterial : bakedSurface(surf, `${SM.id}:${k}`), map, true));
  const lod = new InstancedLOD(geos, mats[0], at, SW.column, SW.hysteresis, seeds);
  lod.name = rec.name ?? `${b}:columns:shaft`;
  lod.userData = { tier: rec.tier, src: `${rec.src};RECON`, placeholder: false, building: b, model: SM.id,
    note: rec.note ?? `shaft of the ${o.id} order (${kind === 'shaft_drums' ? 'unfluted drums' : kind === 'shaft_plaster' ? 'plastered timber post' : o.flutes + ' flutes'}), ${mat}${painted ? ', painted (D-214)' : ''}: the game's own shaft (SITE_SPEC diameter, taper, flute count) with the baked map of a Blender-built tile three drums tall and the whole way round (D-328: hand-cut flute arrises, drum joints, the dressing; offset per column by whole flutes and drums; form C)` };
  const stand = (k: Lod) => toGeometry(columnMeshesByMaterial(o, built, k, { fluted: st.fluted, capital: false, omit: { base_bell: true, base_square2: true, base_plain: true } }).find(x => x.material === mat)!.mesh);
  lod.levels.forEach((im, k) => { im.material = mats[k] ?? mats[0]; im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; lod.seedTwins[k] = [im.geometry];
    registerSwap(im, [stand(k as Lod), painted ? shaftPaint(o) : carvedMaterial(mat)]); });
  return { lod, tris: (geos[0].index!.count / 3) * grid.length };
}
export interface BuiltArch { /** D-330: the carved stone frames (frames.ts; null: drawn as boxes: flat mode or no trim) */ frames: FrameGeoStats | null; group: THREE.Group; triangles: number; colliders: number; bevel: BevelStats; /** D-321 rev 2: the dressed stone's free arrises (arris.ts ArrisField) */ arris: ArrisEdge[]; /** rev 4: their walls' faces, whose joints the near field grooves */ jointFaces: JointFace[]; /** D-334: the wall heads and roof edges (render geometry) */ roofEdges?: RoofEdges & { pieceTriangles: number } }
/** opts.dynamicDoors: door leaves (parts with `door`, D-051) get no static collider, because the world's door system
 *  (doors.ts) gives each a kinematic one that follows its swing. Without it (walkable-grid build, offline bots) a leaf is a
 *  static collider in its walkable-grid pose. Leaves are never drawn here: the door system draws them. */
/** opts.colossusFront: the colossi's fore-part length (m) to carve with, instead of measuring it against these parts' walls
 *  (the Now view, D-201: the walls are gone, the carving is not) */
export function buildMeshes(parts: Part[], phys?: Physics, opts: { dynamicDoors?: boolean; colossusFront?: number; /** D-334: leave out the wall heads and roof edges */ noRoofEdges?: boolean; /** D-354: mudFace through the baked world */ mud?: typeof mudFace; /** D-392: the parts' render geometry through the baked world */ bake?: { get(): ArchBake | null; put(b: ArchBake): void } } = {}): BuiltArch {
  const group = new THREE.Group(); group.name = 'architecture';
  const baked = opts.bake?.get() ?? null;
  const byKey = new Map<string, { geos: THREE.BufferGeometry[]; plain: THREE.BufferGeometry[]; parts: Part[] }>();
  // D-334: the wall heads and roof edges (roofedge.ts): render-only boxes drawn with the parts (bevelled, merged per building and
  // material; no colliders: solid false), and the modelled pieces instanced below. Not in the Now view (its parts carry `now`)
  const RE = opts.noRoofEdges || parts.some(p => (p as any).now) ? null : roofEdges(parts);
  if (RE) RE.boxes.push(...wallFeet(parts)); // D-334: the wall feet (the floor coat or the skirting against the foot)
  const all: Part[] = RE ? [...parts, ...RE.boxes] : parts, edgeSet = new Set<Part>(RE?.boxes ?? []);
  const index = new PartIndex(all), bstats: BevelStats = { edges: 0, bevelled: 0, trisFlat: 0, trisBevelled: 0 };
  // D-364 (B186): the mud-brick faces bowed by one world field (mudface.ts), faded against the parts set into them; not in flat
  // mode (plan overlays) nor the Now view (no mud brick stands there)
  const hard = baked || flatMode || parts.some(p => (p as any).now) || (typeof process !== 'undefined' && process.env?.MUDFACE === '0') ? null : new HardIndex(all); // (MUDFACE=0, node: the A/B)
  const stairs = stairRows(parts), arris: ArrisEdge[] = [], jointFaces: JointFace[] = [];
  if (opts.dynamicDoors) bevelSwap.length = 0;
  const cols = new Map<string, { order: ColumnOrder; built: number; parts: Column[] }>();
  const colossi = parts.filter(p => p.type === 'box' && p.sculpt) as Box[];
  let colliders = 0;
  // D-330: the stone frames of doors, windows and niches carved (stepped fasciae, the cavetto cornice) on the Blender trim,
  // when it is loaded; their boxes stay the colliders
  const frames = !baked && !flatMode && frameMaterial('limestone_dark') ? frameGeometries(parts, index) : null;
  for (const p of all) {
    if (p.type === 'column') {
      const k = `${p.building}|${p.order.id}|${p.order.base}|${p.order.capital}|${p.order.shaftD}|${p.order.height}|${p.built.toFixed(2)}`;
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
    if (COLLIDER_ONLY.has(p.kind)) continue; // D-276: storage jars and querns: drawn round by world/furnish.ts; the box is the collider
    if (leaf) continue; // drawn (and moved) by the door system
    if (baked) continue; // D-392: the render geometry comes from the baked world
    // walls around sculpted jambs are already cut in the parts (terrace.ts: parts.cutWall). The render geometry is the part's
    // own, with its free arrises bevelled (D-157); the collider above stays the plain box
    // rev 4 (D-321): a dressed-stone prism's render geometry carries the arris attributes and records its free arrises
    const pa = p.type === 'prism' && ARRIS_MATS.has(p.material) ? prismArrisGeometry(p, index) : null;
    const fg = p.type === 'box' ? frames?.byPart.get(p) : undefined;
    const plain = fg ?? (KEEP_PLAIN ? g.clone() : g); let rg = fg ?? (p.type === 'box' ? bevelledBoxGeometry(p, index, bstats) : pa?.geo) ?? g.clone();
    if (edgeSet.has(p)) { edgeAttributes(rg, p as Box); if (plain !== rg && KEEP_PLAIN) edgeAttributes(plain, p as Box); } // D-334: the roof edges' own (no probes: ~4 k boxes)
    else { partAttributes(rg, p, index, stairs.get(p)); if (plain !== rg && KEEP_PLAIN) partAttributes(plain, p, index, stairs.get(p)); }
    if (pa && p.type === 'prism') arris.push(...finishProtoEdges(p, p.material, pa.edges, rg));
    // rev 4: the joints of its vertical faces, grooved near the eye (the steps: stairJointEdges below)
    if (ARRIS_MATS.has(p.material) && !(p.type === 'box' && p.kind === 'step')) jointFaces.push(...chunkFaces(verticalFaces(rg, p.material, p.y1), stairs.get(p)).filter(F => !faceCovered(F, p, index))); // (a chunk against another part has no joints to show)
    if (ARRIS_MATS.has(p.material) && !fg) jointFaces.push(...planarJointFaces(rg, p, stairs.get(p), index)); // D-364: the treads, risers and slabs
    if (p.type === 'box' && rg.userData.arris && ARRIS_MATS.has(p.material)) arris.push(...arrisEdgesOfBox(p, rg.userData.arris.edges, BOX_EDGES, rg.userData.arris.r, rg));
    if (hard && !fg && !edgeSet.has(p) && MUD_MATS.has(renderMaterial(p))) rg = (opts.mud ?? mudFace)(rg, hard, renderMaterial(p) === 'mudbrick_bare' ? 0.5 : 1); // D-364 (not the roof edges: the string course at the roof line covers the step; nor the wall feet)
    bstats.trisFlat += plain.getAttribute('position').count / 3; bstats.trisBevelled += rg.getAttribute('position').count / 3;
    const key = `${p.building}|${renderMaterial(p)}|${p.tier}|${p.placeholder ? 1 : 0}${edgeSet.has(p) && p.material === "timber" ? "|edge" : ""}${fg ? '|frame' : ''}`; // (D-334: the roof edges' timber its own mesh: a building's timber roofs keep the roof surface; the rest merges with the building's own)
    if (!byKey.has(key)) byKey.set(key, { geos: [], plain: [], parts: [] }); const e = byKey.get(key)!; e.geos.push(rg); if (KEEP_PLAIN) e.plain.push(plain); e.parts.push(p);
  }
  // the timber ceilings under the roofs (D-188): render geometry only, merged per building (no colliders, no bevels)
  for (const p of baked ? [] : ceilingTimbers(parts)) {
    const g = p.kind === 'ceiling_joist' ? joistGeometry(p) : boxGeometry(p); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    partAttributes(g, p, index);
    const key = `${p.building}|${p.material}|${p.tier}|0|ceiling`;
    if (!byKey.has(key)) byKey.set(key, { geos: [], plain: [], parts: [] }); const e = byKey.get(key)!; e.geos.push(g); if (KEEP_PLAIN) e.plain.push(g.clone()); e.parts.push(p);
  }
  let tris = 0; const bakeOut: { key: string; g: THREE.BufferGeometry; src: string; kinds: string; roof: boolean }[] = [];
  for (const [key, { geos, plain, parts: ps }] of byKey) {
    // (D-364: the mud-brick faces are indexed, the roof edges merged with them not: the latter take a sequential index)
    if (geos.some(q => q.index) && geos.some(q => !q.index)) for (const q of geos) if (!q.index) q.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: q.getAttribute('position').count }, (_, i) => i), 1));
    const g = mergeGeometries(geos)!; tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const roof = ps.every(p => p.kind === 'roof');
    bakeOut.push({ key, g, src: [...new Set(ps.map(p => p.src))].join(';'), kinds: [...new Set(ps.map(p => p.kind))].join(', '), roof });
  }
  if (baked) { for (const m of baked.meshes) bakeOut.push({ key: m.key, g: unpackGeo(m.g), src: m.src, kinds: m.kinds, roof: m.roof }); arris.push(...baked.arris); jointFaces.push(...baked.jointFaces); Object.assign(bstats, baked.bstats); tris = baked.tris; }
  else opts.bake?.put({ meshes: bakeOut.map(m => ({ key: m.key, g: packGeo(m.g), src: m.src, kinds: m.kinds, roof: m.roof })), arris, jointFaces, bstats, frames: frames?.stats ?? null, tris });
  for (const { key, g, src, kinds, roof } of bakeOut) {
    const [building, mat, tier, ph, extra] = key.split('|');
    // a timber roof takes the roof surface: cedar with reed matting on its underside, the ceiling (D-188)
    const m = new THREE.Mesh(g, roof ? roofMaterial(mat === 'timber' && !flatMode ? surfaceMaterial('roof_timber', { arch: true }) : archMaterial(mat as Material)) : extra === 'frame' ? frameMaterial(mat)! : archMaterial(mat as Material)); m.castShadow = m.receiveShadow = true; m.name = `${building}:${mat}${extra ? ':' + extra : ''}`;
    const plain = byKey.get(key)?.plain; if (opts.dynamicDoors && KEEP_PLAIN && plain?.length) bevelSwap.push({ mesh: m, bevelled: g, plain: mergeGeometries(plain)! }); // the world's build only
    m.userData = { tier, src, placeholder: ph === '1', building, note: extra === 'frame'
      ? `stone frames (${kinds}): three stepped fasciae round the opening and the cavetto (Egyptian gorge) cornice with its tongues, after the rock tombs' doorways (global.r_frame_profile, C; D-330), carved on the Blender-baked trim (worn, chipped arrises)`
      : `greybox (Phase 2): ${kinds}` };
    group.add(m);
  }
  const SW = srow('lod', 'switch');
  // D-328: the members drawn by their Blender-built models, gathered over every column group that carries them (a base is the
  // same whatever the shaft above it: the Hall of 100 Columns' many construction states share one draw of their bases)
  const memberDraws = new Map<string, { order: ColumnOrder; member: MemberName; b: string; tier: string; src: string; at: number[] }>();
  for (const [, c] of cols) {
    // one InstancedLOD per member surface (a stone order is one; the Treasury's stone base, plastered shaft and timber
    // capital are three, sculpture.json shaft.members)
    // D-305: the double-bull protome from the Blender pipeline (public/models/capital_protome.glb) when it is loaded: the
    // capitals are then built without their procedural protome, which is drawn as its own instanced pair of levels below
    // D-306: likewise the composite capital's volute member (public/models/capital_volute.glb)
    // D-328: likewise every lathe member (column_<member>.glb) and the shaft (column_shaft_<kind>.glb, a tile on the game's own
    // shaft); what no model draws stays procedural
    const PM = !flatMode && c.built >= 1 && protomeBox(c.order) ? model('capital_protome') : null;
    const VM = !flatMode && c.built >= 1 && voluteBox(c.order) ? model('capital_volute') : null;
    const MP = modelledParts(c.order, c.built, {}, flatMode);
    const st = { ...(PM ? { protome: false } : {}), ...(VM ? { volute: false } : {}), omit: MP.omit };
    const L0 = columnMeshesByMaterial(c.order, c.built, 0, st), L1 = columnMeshesByMaterial(c.order, c.built, 1, st), M = memberMaterials(c.order);
    const at = new Float32Array(c.parts.length * 4); c.parts.forEach((p, i) => at.set([p.c[0], p.y0, -p.c[1], c.order.baseH + (c.order.height - c.order.baseH) * c.built], i * 4));
    const b = c.parts[0].building, split = memberMaterials(c.order).base !== M.shaft || M.shaft !== M.capital;
    // the Treasury shafts were painted 'in bright colours' (B); colours not found: since D-214 the most probable scheme (C)
    const paintedShaft = split && M.shaft === 'plaster' && c.order.id === 'treasury'; // (D-276: the garrison's and the Harem's plastered posts are not the Treasury's painted shafts)
    for (const { material: mat, mesh } of L0) {
      const g0 = toGeometry(mesh), g1 = toGeometry(L1.find(x => x.material === mat)!.mesh);
      const painted = paintedShaft && mat === 'plaster';
      const lod = new InstancedLOD([g0, g1], painted && !flatMode ? shaftPaint(c.order) : carvedMaterial(mat), at, SW.column, SW.hysteresis);
      const members = (['base', 'shaft', 'capital'] as const).filter(k => M[k] === mat).join(' + ');
      lod.name = `${b}:columns${split ? ':' + mat : ''}`;
      lod.userData = { tier: c.parts[0].tier, src: `${c.parts[0].src};RECON${split ? ';ISAC-PA' : ''}${painted ? ';RELIEF-R;STEIN2016' : ''}`, placeholder: false, building: b,
        note: `column order ${c.order.id} (${c.order.base} base, ${c.order.capital} capital)${split ? `, ${members} in ${mat}` : ''}: dimensions SITE_SPEC; carving procedural sculpture, form C (D-018; scans would replace it, NEEDS #10)${c.built < 1 ? '; under construction: unfluted drums' : ''}${painted ? '; the shafts painted in bright colours (B): colours and pattern not found, drawn in the most probable scheme after the Persepolis and Pasargadae painted plaster (red-ochre ground, white lozenge lattice, Egyptian-blue bands at foot and head: C; D-214, treasury.r_shaft_paint, Q-020)' : ''}${MP.members.length || MP.shaft ? `; PROCEDURAL parts left where no Blender-built model is loaded (the others: D-328)` : ''}` };
      lod.levels.forEach((im, k) => { im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; });
      tris += (g0.index!.count / 3) * c.parts.length;
      group.add(lod);
    }
    // D-328: the shaft, the game's own triangles with the tile's baked map
    if (MP.shaft) { const r = shaftLOD(c.order, c.built, {}, MP.shaft, b, at, c.parts.map(p => p.c), { tier: c.parts[0].tier, src: c.parts[0].src }); tris += r.tris; group.add(r.lod); }
    for (const m of MP.members) {
      const k = `${b}|${m}|${JSON.stringify(c.order)}`;
      if (!memberDraws.has(k)) memberDraws.set(k, { order: c.order, member: m, b, tier: c.parts[0].tier, src: c.parts[0].src, at: [] });
      memberDraws.get(k)!.at.push(...at);
    }
    const members: [ReturnType<typeof model>, typeof protomeBox, typeof protomeMesh, string, string][] = [
      [PM, protomeBox, protomeMesh, 'protome', `double-bull protome of the ${c.order.capital} capital`],
      [VM, voluteBox, voluteMesh, 'volute', 'vertical double-volute member of the composite capital'],
    ];
    for (const [MM, boxOf, meshOf, part, what] of members) {
      if (!MM) continue;
      const [lo, hi] = boxOf(c.order)!, mat = M.capital, surf = CARVED[mat] ?? mat, b = c.parts[0].building;
      const geos = MM.lods.map(g => fitLevel(g, lo, hi)), mats = MM.maps.map((map, k) => bakedMaterial(surf, map, `${MM.id}:${k}`));
      const lod = new InstancedLOD(geos, mats[0], at, SW.column, SW.hysteresis);
      lod.name = `${b}:columns:${part}`;
      lod.userData = { tier: c.parts[0].tier, src: `${c.parts[0].src};RECON;PHOTO`, placeholder: false, building: b, model: MM.id,
        note: `${what}, ${mat}: the project's own model (sculpture.json, form C, D-151) baked in Blender (D-305) with the carving of the photographed capitals (D-306: bead rows, collar with rosettes, pendant, ridged mane / rosette-ended rolls with ringed barrels; layout C): normal and occlusion maps on the same triangles` };
      lod.levels.forEach((im, k) => { im.material = mats[k] ?? mats[0]; im.name = `${lod.name}:lod${k}`; im.userData = lod.userData;
        const pm = meshOf(c.order, k as Lod); if (pm) registerSwap(im, [toGeometry(pm), carvedMaterial(mat)]); });
      tris += (geos[0].index!.count / 3) * c.parts.length;
      group.add(lod);
    }
  }
  for (const d of memberDraws.values()) { const r = memberLOD(d.order, d.member, d.b, new Float32Array(d.at), { tier: d.tier, src: d.src }); if (r) { tris += r.tris; group.add(r.lod); } }
  if (colossi.length) {
    const fr = opts.colossusFront === undefined ? colossusFrontProjections(parts as Box[]) : []; const front = opts.colossusFront ?? fr.reduce((a, b) => a + b, 0) / fr.length;
    setColossusFront(front);
    const idx = sculptIndex(); if (idx && Math.abs(idx.params.colossusFront - front) > 0.05) console.warn(`sculpt: colossi were generated for a ${idx.params.colossusFront.toFixed(2)} m fore-part, the layout gives ${front.toFixed(2)} m (rerun npx tsx tools/build_sculpt.ts)`);
    for (const p of colossi) {
      // D-306: the colossus from the Blender pipeline (public/models/colossus_<model>.glb: the game's own levels with baked
      // normal + occlusion maps of the carving, bead rows, collar, mane, feathers) when it is loaded; the procedural piece otherwise
      const CM = flatMode ? null : model(`colossus_${p.sculpt!.model}`), surf = CARVED[p.material] ?? p.material;
      const meshes = ([0, 1] as Lod[]).map(l => {
        const stand = toGeometry(colossusMesh(p, l));
        const m = CM && CM.lods[l] ? new THREE.Mesh(placeLevel(CM.lods[l], colossusPlacement(p)), bakedMaterial(surf, CM.maps[l], `${CM.id}:${l}`)) : new THREE.Mesh(stand, carvedMaterial(p.material));
        if (CM && CM.lods[l]) registerSwap(m, [stand, carvedMaterial(p.material)]);
        m.castShadow = m.receiveShadow = true; return m;
      });
      const centre = new THREE.Vector3(p.c[0], (p.y0 + p.y1) / 2, -p.c[1]);
      const lod = new MeshLOD(meshes, centre, SW.colossus, SW.hysteresis); lod.name = `${p.building}:colossus:${p.sculpt!.model}`;
      lod.userData = { tier: p.tier, src: p.src, placeholder: false, building: p.building, ...(CM ? { model: CM.id } : {}), note: CM?.entry.src.includes('SKFB') ? `${p.note ?? 'colossus'}; form and carving from a licensed digital sculpt (${CM.entry.src}; D-365: CC-BY-4.0, ASSET_LEDGER.md), fitted to the colossus box on the jamb block, tier C` : `${p.note ?? 'colossus'}; carved form reconstructed from the type (RECOLLECTION), not measured; licensed scans would replace it (NEEDS #10)${CM ? '; its carving (bead rows, collar, mane, feathers after the photographs: layout C) baked in Blender as normal and occlusion maps (D-306)' : ''}` };
      meshes.forEach((m, k) => { m.name = `${lod.name}:lod${k}`; m.userData = lod.userData; });
      tris += meshes[0].geometry.index!.count / 3;
      group.add(lod);
    }
  }
  let roofEdgesOut: BuiltArch['roofEdges'];
  if (RE) { const P = buildPieces(RE.pieces, flatMode); group.add(P.group); tris += P.triangles; roofEdgesOut = { ...RE, pieceTriangles: P.triangles }; }
  return { group, triangles: tris, colliders, bevel: bstats, arris, jointFaces, roofEdges: roofEdgesOut, frames: baked ? baked.frames : frames?.stats ?? null };
}
