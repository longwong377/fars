// Procedural people (Phase 3). Rigged humanoids with period dress built from MATERIAL_CULTURE (research), every part skinned
// rigidly to one bone. PLACEHOLDER for photoreal humans (brief §9.3): forms are simplified; faces are abstract, not scans.
// Dress: Persian court robe (long, pleated, wide sleeves, fluted headgear) and Median riding dress (knee tunic, trousers,
// rounded cap) as on the reliefs (B); workers' short tunics, women's long dress + mantle (C, MATERIAL_CULTURE).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';

export type Dress = 'persian' | 'median' | 'worker' | 'woman' | 'child' | 'guard';
export const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand', 'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot'] as const;
export type BoneName = typeof BONES[number];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<BoneName, number>;

/** skeleton for a 1.70 m adult; heights (m) are bone heads in bind pose */
export function makeSkeleton(): { bones: THREE.Bone[]; skeleton: THREE.Skeleton; root: THREE.Bone } {
  const P: Record<BoneName, [BoneName | null, number, number, number]> = {
    hips: [null, 0, 0.95, 0], spine: ['hips', 0, 0.15, 0], chest: ['spine', 0, 0.2, 0], neck: ['chest', 0, 0.2, 0], head: ['neck', 0, 0.1, 0],
    l_upper: ['chest', 0.19, 0.15, 0], l_fore: ['l_upper', 0, -0.29, 0], l_hand: ['l_fore', 0, -0.26, 0],
    r_upper: ['chest', -0.19, 0.15, 0], r_fore: ['r_upper', 0, -0.29, 0], r_hand: ['r_fore', 0, -0.26, 0],
    l_thigh: ['hips', 0.09, -0.02, 0], l_shin: ['l_thigh', 0, -0.44, 0], l_foot: ['l_shin', 0, -0.43, 0],
    r_thigh: ['hips', -0.09, -0.02, 0], r_shin: ['r_thigh', 0, -0.44, 0], r_foot: ['r_shin', 0, -0.43, 0],
  };
  const bones: THREE.Bone[] = BONES.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach((n, i) => { const [p, x, y, z] = P[n]; bones[i].position.set(x, y, z); if (p) bones[BI[p]].add(bones[i]); });
  return { bones, skeleton: new THREE.Skeleton(bones), root: bones[0] };
}
/** world-space bind position of a bone head */
const BIND: Record<BoneName, THREE.Vector3> = (() => { const { root, bones } = makeSkeleton(); root.updateMatrixWorld(true); return Object.fromEntries(BONES.map((n, i) => [n, new THREE.Vector3().setFromMatrixPosition(bones[i].matrixWorld)])) as any; })();

type C3 = [number, number, number];
// dyed/undyed textile palette (C): madder red, woad/indigo blue, weld yellow, undyed wool, linen, brown
export const TEXTILE: Record<string, C3> = { madder: [0.55, 0.14, 0.1], woad: [0.16, 0.22, 0.45], weld: [0.72, 0.6, 0.25], wool: [0.72, 0.66, 0.54], linen: [0.84, 0.81, 0.73], brown: [0.4, 0.3, 0.22], purple: [0.36, 0.14, 0.3], green: [0.3, 0.4, 0.25] };
const SKIN: C3[] = [[0.62, 0.45, 0.33], [0.55, 0.38, 0.27], [0.48, 0.33, 0.23], [0.7, 0.53, 0.4], [0.4, 0.27, 0.18]];
const HAIR: C3 = [0.05, 0.04, 0.035];

function part(g: THREE.BufferGeometry, bone: BoneName, col: C3): THREE.BufferGeometry {
  const gg = g.index ? g.toNonIndexed() : g; gg.deleteAttribute('uv');
  const n = gg.getAttribute('position').count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), cc = new Float32Array(n * 3);
  const c = new THREE.Color().setRGB(col[0], col[1], col[2], THREE.SRGBColorSpace);
  for (let i = 0; i < n; i++) { si[i * 4] = BI[bone]; sw[i * 4] = 1; cc.set([c.r, c.g, c.b], i * 3); }
  gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); gg.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); gg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  return gg;
}
/** a tapered limb segment from bone head a down to b (in bind pose world coords) */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg = 8) {
  const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1);
  const mid = a.clone().add(b).multiplyScalar(0.5); const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)); g.translate(mid.x, mid.y, mid.z); return g;
}
const lathe = (prof: [number, number][], seg = 16, pleats = 0) => { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (pleats) { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.05 * Math.sin(a * pleats) * Math.max(0, 1 - p.getY(i) / 0.9); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); }
  return g; };

export interface Appearance { dress: Dress; main: C3; second: C3; skin: C3; beard: boolean; hat: 'fluted' | 'cap' | 'band' | 'mantle' | 'none'; height: number; build: number }
export function randomAppearance(dress: Dress, rng: Rng): Appearance {
  const pick = (k: string[]) => TEXTILE[rng.pick(k)];
  const main = dress === 'persian' || dress === 'guard' ? pick(['madder', 'purple', 'weld', 'woad', 'linen']) : dress === 'median' ? pick(['woad', 'madder', 'green', 'weld', 'brown']) : dress === 'woman' ? pick(['madder', 'woad', 'wool', 'weld', 'brown', 'linen']) : pick(['wool', 'brown', 'linen', 'wool']);
  const second = pick(['woad', 'madder', 'weld', 'wool', 'brown']);
  const female = dress === 'woman';
  return { dress, main, second, skin: rng.pick(SKIN), beard: !female && dress !== 'child', hat: dress === 'persian' || dress === 'guard' ? 'fluted' : dress === 'median' ? 'cap' : female ? 'mantle' : rng.chance(0.5) ? 'band' : 'none',
    height: dress === 'child' ? rng.range(0.62, 0.8) : (female ? 0.94 : 1) * rng.range(0.94, 1.06), build: rng.range(0.9, 1.12) };
}

/** Build a skinned body geometry for an appearance (bind pose, feet at y=0, facing +Z). */
export function bodyGeometry(a: Appearance): THREE.BufferGeometry {
  const B = BIND, P: THREE.BufferGeometry[] = []; const w = a.build;
  const skin = a.skin, m = a.main, s = a.second;
  // head, hair, beard, headgear
  P.push(part(new THREE.SphereGeometry(0.095, 12, 10).scale(0.9, 1.1, 1).translate(0, B.head.y + 0.09, 0.01), 'head', skin));
  P.push(part(new THREE.ConeGeometry(0.018, 0.04, 5).rotateX(Math.PI / 2).translate(0, B.head.y + 0.09, 0.105), 'head', skin)); // nose
  P.push(part(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, B.head.y + 0.1, -0.012), 'head', HAIR)); // hair cap
  P.push(part(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.9, 0.7).translate(0, B.head.y + 0.05, -0.085), 'head', HAIR)); // hair bunched at the nape (reliefs)
  if (a.beard) P.push(part(new THREE.ConeGeometry(0.07, 0.16, 8).rotateX(Math.PI).translate(0, B.head.y + 0.0, 0.045), 'head', HAIR));
  if (a.hat === 'fluted') P.push(part(lathe([[0, 0], [0.098, 0], [0.108, 0.13], [0, 0.13]], 16, 14).translate(0, B.head.y + 0.16, 0), 'head', m === TEXTILE.linen ? TEXTILE.weld : s));
  if (a.hat === 'cap') P.push(part(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.2, 1).translate(0, B.head.y + 0.1, -0.01), 'head', s));
  if (a.hat === 'band') P.push(part(new THREE.TorusGeometry(0.095, 0.012, 4, 14).rotateX(Math.PI / 2).translate(0, B.head.y + 0.15, 0), 'head', s));
  if (a.hat === 'mantle') P.push(part(lathe([[0, 0.34], [0.11, 0.3], [0.14, 0.12], [0.22, -0.08], [0.26, -0.3]], 14).translate(0, B.head.y - 0.12, -0.01), 'head', s));
  // neck, torso
  P.push(part(limb(B.head, B.neck, 0.045, 0.05), 'neck', skin));
  const torso = lathe([[0.001, 0], [0.16 * w, 0.02], [0.17 * w, 0.22], [0.2 * w, 0.42], [0.12, 0.55], [0.001, 0.56]], 12).translate(0, B.spine.y - 0.12, 0);
  P.push(part(torso, 'chest', m));
  // arms: sleeves (wide for the court robe) + hands
  for (const side of ['l', 'r'] as const) {
    const u = B[`${side}_upper`], f = B[`${side}_fore`], h = B[`${side}_hand`];
    const wide = a.dress === 'persian' || a.dress === 'guard';
    P.push(part(limb(u, f, 0.055, wide ? 0.09 : 0.05), `${side}_upper`, m));
    P.push(part(limb(f, h, wide ? 0.11 : 0.045, wide ? 0.13 : 0.04), `${side}_fore`, a.dress === 'worker' || a.dress === 'child' ? skin : m));
    P.push(part(new THREE.SphereGeometry(0.04, 6, 5).scale(0.8, 1.2, 0.6).translate(h.x, h.y - 0.05, h.z), `${side}_hand`, skin));
  }
  // lower body
  const long = a.dress === 'persian' || a.dress === 'guard' || a.dress === 'woman';
  if (long) { // ankle-length robe, pleated (reliefs; B for the Persian court robe)
    P.push(part(lathe([[0.17 * w, 0.95], [0.2 * w, 0.8], [0.3, 0.3], [0.36, 0.04], [0.001, 0.04]], 18, a.dress === 'woman' ? 0 : 18), 'hips', m));
    if (a.dress !== 'woman') P.push(part(new THREE.TorusGeometry(0.17 * w, 0.02, 4, 16).rotateX(Math.PI / 2).translate(0, 0.95, 0), 'hips', s)); // belt
  } else { // knee-length tunic
    P.push(part(lathe([[0.17 * w, 0.97], [0.2 * w, 0.8], [0.25, 0.5], [0.001, 0.5]], 14), 'hips', m));
    P.push(part(new THREE.TorusGeometry(0.17 * w, 0.018, 4, 14).rotateX(Math.PI / 2).translate(0, 0.93, 0), 'hips', s));
  }
  for (const side of ['l', 'r'] as const) {
    const t = B[`${side}_thigh`], sh = B[`${side}_shin`], ft = B[`${side}_foot`];
    const legCol: C3 = a.dress === 'median' ? s : long ? m : skin; // Median trousers (B); bare legs for workers
    P.push(part(limb(t, sh, 0.075, 0.055), `${side}_thigh`, legCol));
    P.push(part(limb(sh, ft, 0.05, 0.04), `${side}_shin`, a.dress === 'median' ? s : long ? m : skin));
    P.push(part(new THREE.BoxGeometry(0.09, 0.06, 0.24).translate(ft.x, ft.y + 0.03, 0.06), `${side}_foot`, TEXTILE.brown)); // shoes: flat leather (MATERIAL_CULTURE)
  }
  const g = mergeGeometries(P)!; g.computeBoundingSphere();
  return g; // bind size (1.70 m); the renderer scales the whole rig by a.height so bones and skin stay matched
}
export const bindPositions = BIND;

/** props: spear with pomegranate butt, sack, jar, tablet, mallet, basket */
export function propGeometry(kind: string): THREE.BufferGeometry | null {
  switch (kind) {
    case 'spear': { const s = new THREE.CylinderGeometry(0.015, 0.015, 2.2, 5).translate(0, 1.1, 0); const tip = new THREE.ConeGeometry(0.03, 0.2, 6).translate(0, 2.3, 0); const butt = new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.02, 0);
      return mergeGeometries([s, tip, butt].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }))!; }
    case 'sack': return new THREE.SphereGeometry(0.22, 8, 6).scale(1, 0.75, 0.7);
    case 'jar': return new THREE.LatheGeometry([[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    case 'tablet': return new THREE.BoxGeometry(0.06, 0.02, 0.05);
    case 'mallet': return mergeGeometries([new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5).translate(0, -0.15, 0), new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6).rotateZ(Math.PI / 2).translate(0, -0.3, 0)].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }))!;
    case 'basket': return new THREE.CylinderGeometry(0.18, 0.13, 0.18, 10, 1, true);
    default: return null;
  }
}
