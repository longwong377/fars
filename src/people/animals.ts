// Animals the work needs (D-142): sheep and goats for the herd, shearing, lambing and the stockyard; the ox pair of the
// plough and the threshing floor; the donkey and horse of the household and the road station. Species from the evidence
// (population.json `animals`, research/PEOPLE.md P5.7: sheep_goat A, horse B, donkey B; cattle are NOT in population.json
// although the plans yoke oxen: Q-193); shapes, sizes and coats are C (procedural, not scans).
// Each animal is a simple rig: a body, a neck and head that pitch down to graze, four legs of two segments that swing in
// a lateral walk (hind-fore-hind-fore) and fold when lying, a tail that swishes. The rig runs in the vertex shader from
// per-vertex part weights and pivots and a per-instance state (gait phase, walk, graze, lie), with the same arithmetic on
// the CPU (deformAnimal) for tests and previews. One InstancedMesh per species: a draw per species in view.
// Placement (animalsFor) is closed-form in time from the performer's spot, like the birds and jackals (D-054): a flock
// grazes about its herder and drifts from spot to spot, the yoked pair walks the furrow ahead of the ploughman, the
// threshing animals circle the floor, a donkey or horse stands to be rubbed down, a sheep lies to be shorn.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionGeometry, vec3, sin, cos, max, float, uniform } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nearCascadesOnly } from './humanGPU';
import type { AnimalSpec } from './activities';

export type Species = 'sheep' | 'goat' | 'ox' | 'donkey' | 'horse';
export const SPECIES: Species[] = ['sheep', 'goat', 'ox', 'donkey', 'horse'];
type RGB = [number, number, number];
interface Build { len: number; h: number; girth: number; neck: number; neckA: number; nb?: number; head: number; headR: number; leg: number; tail: 'fat' | 'short' | 'long' | 'tuft' | 'hair'; ears: 'small' | 'long' | 'mid';
  horns?: 'goat' | 'ox'; mane?: boolean; coat: RGB[]; stride: number; tier: string; note: string }
/** species builds (m; withers height h, body length len, girth; stride = metres per gait cycle). Tiers: species from
 *  the evidence, form C */
export const ANIMAL_BUILD: Record<Species, Build> = {
  sheep: { len: 0.95, h: 0.68, girth: 0.44, neck: 0.32, neckA: 0.6, head: 0.26, headR: 0.075, leg: 0.028, tail: 'fat', ears: 'small', coat: [[0.78, 0.72, 0.6], [0.7, 0.62, 0.5], [0.42, 0.33, 0.25], [0.2, 0.17, 0.15]], stride: 0.75,
    tier: 'A species (PF 58-60, the state flocks) / C form', note: 'sheep, fat-tailed, small (form, size and coat C; the fat tail is a recollection of the region’s breeds, NOT SEEN)' },
  goat: { len: 0.85, h: 0.7, girth: 0.36, neck: 0.33, neckA: 0.75, head: 0.24, headR: 0.065, leg: 0.025, tail: 'short', ears: 'mid', horns: 'goat', coat: [[0.18, 0.15, 0.13], [0.33, 0.25, 0.18], [0.5, 0.45, 0.4]], stride: 0.75,
    tier: 'A species (PF 58-60: goats among the small cattle) / C form', note: 'goat with back-curved horns (form and coat C)' },
  ox: { len: 1.85, h: 1.22, girth: 0.74, neck: 0.5, neckA: 0.5, nb: -0.12, head: 0.46, headR: 0.13, leg: 0.05, tail: 'tuft', ears: 'mid', horns: 'ox', coat: [[0.42, 0.26, 0.16], [0.3, 0.2, 0.13], [0.52, 0.36, 0.22]], stride: 1.5,
    tier: 'C (draught cattle: E-40 “draught animals (C)”; not in population.json, Q-193)', note: 'ox, humpless (the zebu is delegation imagery only: MATERIAL_CULTURE); size and coat C' },
  donkey: { len: 1.25, h: 1.08, girth: 0.5, neck: 0.56, neckA: 0.85, nb: -0.1, head: 0.46, headR: 0.1, leg: 0.034, tail: 'tuft', ears: 'long', mane: true, coat: [[0.46, 0.42, 0.37], [0.36, 0.31, 0.26], [0.55, 0.5, 0.44]], stride: 1.1,
    tier: 'B species (PFAT 0025 donkeys fed bread: POTTS2023) / C form', note: 'donkey, grey-brown with long ears and an upright mane (C)' },
  horse: { len: 1.55, h: 1.38, girth: 0.6, neck: 0.8, neckA: 0.95, nb: -0.15, head: 0.56, headR: 0.1, leg: 0.036, tail: 'hair', ears: 'mid', mane: true, coat: [[0.35, 0.2, 0.12], [0.45, 0.28, 0.15], [0.22, 0.15, 0.11]], stride: 1.6,
    tier: 'B species (horse rations: POTTS2023; relay horses HDT 8.98, a claim) / C form', note: 'horse, small by later standards (withers 1.38 m, C), bay or chestnut' },
};
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** per-vertex rig attributes: aLeg (gait phase offset, is leg, is lower leg, fore 1 / hind −1), aPiv (hip y, z, knee y, z),
 *  aHT (head weight, tail weight, pivot y, z) */
interface Part { g: THREE.BufferGeometry; col: RGB; leg?: [number, number, number, number]; piv?: [number, number, number, number]; ht?: [number, number, number, number] }
function tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg = 6, caps = true) {
  const L = a.distanceTo(b); const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())).translate(a.x, a.y, a.z); return g;
}
/** the neck base (head pivot), the head's centre and direction, and the graze angle that brings the muzzle to the ground */
export function animalFrame(sp: Species) {
  const B = ANIMAL_BUILD[sp], bodyY = B.h - B.girth * 0.5;
  // the neck root: at the barrel's centre for the small stock, lower at the breast for the big animals (nb, x girth)
  const base = new THREE.Vector3(0, bodyY + B.girth * (B.nb ?? 0.04), B.len * 0.4);
  const top = base.clone().add(new THREE.Vector3(0, Math.sin(B.neckA), Math.cos(B.neckA)).multiplyScalar(B.neck));
  const hd = new THREE.Vector3(0, -Math.sin(0.55), Math.cos(0.55)); // the head points forward and down
  const muzzle = top.clone().add(hd.clone().multiplyScalar(B.head));
  // graze: pitch about the neck base (x) until the muzzle is 3 cm above the ground
  let lo = 0, hi = 1.9; for (let i = 0; i < 30; i++) { const a = (lo + hi) / 2, d = muzzle.clone().sub(base); const y = base.y + d.y * Math.cos(a) - d.z * Math.sin(a); if (y > 0.03) lo = a; else hi = a; }
  return { bodyY, base, top, hd, muzzle, graze: (lo + hi) / 2 };
}
/** how far ahead of its centre an animal's muzzle meets the ground when it grazes (local z, m): where its fodder lies */
export function grazeReach(sp: Species) { const F = animalFrame(sp), d = F.muzzle.clone().sub(F.base); return F.base.z + d.y * Math.sin(F.graze) + d.z * Math.cos(F.graze); }
export function animalGeometry(sp: Species): THREE.BufferGeometry {
  const B = ANIMAL_BUILD[sp], F = animalFrame(sp), V = THREE.Vector3, parts: Part[] = [];
  const white: RGB = [1, 1, 1], dark: RGB = [0.14, 0.12, 0.1], horn: RGB = [0.62, 0.56, 0.44];
  // body (coat colour comes from the instance colour: the geometry is white where the coat is)
  parts.push({ g: new THREE.SphereGeometry(1, 12, 8).scale(B.girth * 0.46, B.girth * 0.52, B.len * 0.5).translate(0, F.bodyY, 0), col: white });
  if (B.tail === 'fat') parts.push({ g: new THREE.SphereGeometry(B.girth * 0.26, 7, 5).scale(1.1, 1, 0.8).translate(0, F.bodyY - B.girth * 0.15, -B.len * 0.5), col: white });
  // legs: fore at +z, hind at −z; gait order LH 0, LF .25, RH .5, RF .75 (a lateral walk)
  const hipY = F.bodyY - B.girth * 0.12, kneeY = hipY * 0.45;
  for (const [x, z, ph, fore] of [[0.3, 0.34, 0.25, 1], [-0.3, 0.34, 0.75, 1], [0.3, -0.36, 0, -1], [-0.3, -0.36, 0.5, -1]] as const) {
    const X = x * B.girth, Z = z * B.len, piv: [number, number, number, number] = [hipY, Z, kneeY, Z + (fore > 0 ? 0.01 : -0.03)];
    parts.push({ g: tube(new V(X, hipY, Z), new V(X, kneeY, piv[3]), B.leg * 1.5, B.leg * 1.05), col: white, leg: [ph * 2 * Math.PI, 1, 0, fore], piv });
    parts.push({ g: tube(new V(X, kneeY, piv[3]), new V(X, 0.05, piv[3]), B.leg * 1.0, B.leg * 0.8), col: white, leg: [ph * 2 * Math.PI, 1, 1, fore], piv });
    parts.push({ g: new THREE.BoxGeometry(B.leg * 2.2, 0.05, B.leg * 2.6).translate(X, 0.025, piv[3] + 0.005), col: dark, leg: [ph * 2 * Math.PI, 1, 1, fore], piv });
  }
  // neck and head (head weight 1 about the neck base)
  const ht: [number, number, number, number] = [1, 0, F.base.y, F.base.z];
  parts.push({ g: tube(F.base.clone().add(new V(0, -0.02, -0.04)), F.top, B.girth * 0.26, B.headR * 1.1, 7), col: white, ht });
  const hc = F.top.clone().add(F.hd.clone().multiplyScalar(B.head * 0.5));
  parts.push({ g: new THREE.SphereGeometry(1, 9, 6).scale(B.headR * 1.05, B.headR * 1.15, B.head * 0.55).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), F.hd)).translate(hc.x, hc.y, hc.z), col: white, ht });
  parts.push({ g: new THREE.SphereGeometry(B.headR * 0.8, 6, 4).translate(F.muzzle.x, F.muzzle.y + 0.01, F.muzzle.z - F.hd.z * 0.03), col: sp === 'donkey' ? [1.35, 1.35, 1.35] : [0.7, 0.66, 0.62], ht });
  const earL = B.ears === 'long' ? 0.22 : B.ears === 'mid' ? 0.1 : 0.07;
  for (const s of [-1, 1]) { const e0 = F.top.clone().add(new V(s * B.headR * 0.7, B.headR * 0.7, 0)); const e1 = e0.clone().add(new V(s * earL * (B.ears === 'long' ? 0.25 : 0.8), earL * (B.ears === 'long' ? 0.95 : 0.4), -earL * 0.2));
    parts.push({ g: tube(e0, e1, 0.02 + earL * 0.12, 0.008, 4), col: white, ht }); }
  if (B.horns === 'goat') for (const s of [-1, 1]) { let p = F.top.clone().add(new V(s * 0.03, B.headR * 0.9, 0.02)); const pts = [p]; for (let i = 1; i <= 4; i++) { p = p.clone().add(new V(s * 0.012, 0.045 - i * 0.012, -0.045)); pts.push(p); }
    for (let i = 0; i < 4; i++) parts.push({ g: tube(pts[i], pts[i + 1], 0.016 - i * 0.003, 0.013 - i * 0.003, 4), col: horn, ht }); }
  if (B.horns === 'ox') for (const s of [-1, 1]) { const a = F.top.clone().add(new V(s * B.headR * 0.8, B.headR * 0.6, -0.02)); const b = a.clone().add(new V(s * 0.16, 0.05, 0.03)), c = b.clone().add(new V(s * 0.04, 0.14, 0.06));
    parts.push({ g: tube(a, b, 0.03, 0.022, 5), col: horn, ht }, { g: tube(b, c, 0.022, 0.008, 5), col: horn, ht }); }
  if (B.mane) parts.push({ g: tube(F.base.clone().add(new V(0, B.girth * 0.22, -0.02)), F.top.clone().add(new V(0, B.headR * 0.9, -0.03)), 0.035, 0.025, 4).scale(0.55, 1, 1), col: sp === 'donkey' ? [0.5, 0.5, 0.5] : [0.35, 0.3, 0.28], ht: [0.85, 0, F.base.y, F.base.z] });
  // tail (weight 1 about its root)
  const tr = new V(0, F.bodyY + B.girth * 0.25, -B.len * 0.5), tht: [number, number, number, number] = [0, 1, tr.y, tr.z];
  const tl = B.tail === 'hair' ? 0.62 : B.tail === 'tuft' ? (sp === 'ox' ? 0.75 : 0.45) : B.tail === 'short' ? 0.1 : 0.14;
  const te = tr.clone().add(new V(0, B.tail === 'short' ? tl * 0.6 : -tl, B.tail === 'short' ? -0.05 : -tl * 0.18));
  parts.push({ g: tube(tr, te, B.tail === 'hair' ? 0.06 : 0.022, B.tail === 'hair' ? 0.04 : 0.012, 5), col: B.tail === 'hair' ? [0.5, 0.42, 0.4] : white, ht: tht });
  if (B.tail === 'tuft') parts.push({ g: new THREE.SphereGeometry(0.045, 5, 4).scale(1, 1.8, 1).translate(te.x, te.y, te.z), col: dark, ht: tht });
  // bake attributes
  const gs = parts.map(pt => { const g = pt.g.index ? pt.g.toNonIndexed() : pt.g; g.deleteAttribute('uv'); const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3), leg = new Float32Array(n * 4), piv = new Float32Array(n * 4), ht2 = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { col.set(pt.col.map(c => (c > 1 ? c : lin(c))), i * 3); leg.set(pt.leg ?? [0, 0, 0, 0], i * 4); piv.set(pt.piv ?? [0, 0, 0, 0], i * 4); ht2.set(pt.ht ?? [0, 0, 0, 0], i * 4); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aLeg', new THREE.BufferAttribute(leg, 4)); g.setAttribute('aPiv', new THREE.BufferAttribute(piv, 4)); g.setAttribute('aHT', new THREE.BufferAttribute(ht2, 4)); return g; });
  const g = mergeGeometries(gs)!; g.computeBoundingSphere(); return g;
}
/** rig constants: leg swing and knee flex at a full walk */
export const RIG = { swing: 0.42, knee: 0.75 } as const;
/** the lying drop: the belly on the ground */
export const lieDrop = (sp: Species) => { const B = ANIMAL_BUILD[sp]; return B.h - B.girth * 1.02; };
/** the lying fold of a species, [fore hip, fore knee, hind hip, hind knee] (rad), from its build: the upper leg turns until
 *  the joint below it reaches the ground once the belly is down, and the lower leg lies flat under the body (fore: the
 *  knee forward, the cannon folded back under the chest; hind: the hock back, the cannon forward under the belly) */
export function foldOf(sp: Species): [number, number, number, number] {
  const B = ANIMAL_BUILD[sp], hipY = B.h - B.girth * 0.62, kneeY = hipY * 0.45, u = hipY - kneeY, r = B.leg * 1.5;
  const a = Math.acos(Math.max(-1, Math.min(1, (hipY - lieDrop(sp) - r) / u))), flat = Math.PI / 2 - 0.12;
  return [-a, flat + a, a, -flat - a];
}
/** one vertex of an animal posed on the CPU (the vertex shader's arithmetic; tests and previews) */
export function deformAnimal(sp: Species, p: ArrayLike<number>, leg: ArrayLike<number>, piv: ArrayLike<number>, ht: ArrayLike<number>, st: { phase: number; walk: number; graze: number; lie: number }, time: number, out: number[] = [0, 0, 0]) {
  const F = animalFrame(sp); let x = p[0], y = p[1], z = p[2];
  const ph = st.phase + leg[0], fore = leg[3] > 0 ? 1 : 0;
  const fo = foldOf(sp);
  const a1 = leg[1] * (st.walk * RIG.swing * Math.sin(ph) + st.lie * (fore ? fo[0] : fo[2]));
  const a2 = leg[2] * (st.walk * RIG.knee * Math.max(0, Math.sin(ph - 0.6)) + st.lie * (fore ? fo[1] : fo[3]));
  const rx = (py: number, pz: number, a: number, cy: number, cz: number) => { const dy = py - cy, dz = pz - cz, c = Math.cos(a), s = Math.sin(a); return [cy + dy * c - dz * s, cz + dy * s + dz * c]; };
  [y, z] = rx(y, z, a2, piv[2], piv[3]); [y, z] = rx(y, z, a1, piv[0], piv[1]);
  const ah = ht[0] * (st.graze * F.graze + 0.05 * st.walk * Math.sin(2 * ph) + 0.04 * st.graze * Math.sin(time * 5.3));
  [y, z] = rx(y, z, ah, ht[2], ht[3]);
  const at = ht[1] * 0.3 * Math.sin(time * 1.1 + st.phase * 0.1), c = Math.cos(at), s = Math.sin(at), dx = x, dz = z - ht[3]; if (ht[1]) { x = dx * c + dz * s; z = ht[3] - dx * s + dz * c; }
  y += -st.lie * lieDrop(sp) + st.walk * 0.012 * Math.sin(2 * ph);
  out[0] = x; out[1] = y; out[2] = z; return out;
}

/** an animal to draw: species, place in the performer's frame (x, z, yaw; y offset), state; roll: lying on its side */
export interface AnimalInst { sp: Species; x: number; z: number; yaw: number; y?: number; roll?: number; phase: number; walk: number; graze: number; lie: number; coat: number;
  /** placed relative to the performer's own path (the plough team) instead of the simulation's spot */ follow?: boolean }
const fr = (x: number) => x - Math.floor(x);
const h1 = (a: number, b = 0) => fr(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
const TWO_PI = 2 * Math.PI;
/** the animals of a performance at time t (s), closed form; `path` = the performer's own path state (plough, drive) */
export function animalsFor(spec: AnimalSpec, t: number, seed: number, path?: { s?: number; yaw?: number }): AnimalInst[] {
  const out: AnimalInst[] = [], sp = (i: number) => spec.species[i % spec.species.length];
  switch (spec.kind) {
    case 'flock': { const n = spec.n ?? 10;
      for (let i = 0; i < n; i++) { const s = sp(i), B = ANIMAL_BUILD[s], T = 20 + 8 * h1(seed, i), tg = 0.6 * T, off = h1(i, seed) * T;
        const k = Math.floor((t + off) / T), u = (t + off) - k * T;
        const spot = (m: number) => { const a = 1.6 * Math.sin(0.31 * m + i * 1.9 + seed) + 0.5 * Math.sin(1.13 * m + i), r = 4.5 + 3.5 * Math.sin(0.23 * m + i * 1.7) + 2 * h1(i, 3); return [r * Math.sin(a), 2 + r * Math.cos(a)]; };
        const A = spot(k), Bp = spot(k + 1), w = u < tg ? 0 : Math.min(1, (u - tg) / (T - tg)), dx = Bp[0] - A[0], dz = Bp[1] - A[1];
        const walking = u >= tg; const yaw = Math.atan2(dx, dz) + (walking ? 0 : 0.5 * Math.sin(t * 0.07 + i));
        const look = !walking && fr((t + i * 3.1) / 9) > 0.8;
        out.push({ sp: s, x: A[0] + dx * w, z: A[1] + dz * w, yaw, phase: (TWO_PI * Math.hypot(dx, dz) * w) / B.stride + TWO_PI * h1(k, i), walk: walking ? Math.min(1, (u - tg) * 2, (T - u) * 2) : 0, graze: walking || look ? 0 : 1, lie: 0, coat: h1(seed + i, 7) }); }
      break; }
    case 'team': { const s = path?.s ?? 0; for (let i = 0; i < 2; i++) out.push({ sp: sp(i), x: i ? -0.55 : 0.55, z: 3.35, yaw: 0, phase: (TWO_PI * s) / ANIMAL_BUILD[sp(i)].stride + i * 0.9, walk: 1, graze: 0, lie: 0, coat: h1(seed + i, 5), follow: true }); break; }
    case 'circle': { const a = path?.yaw ?? 0, n = spec.n ?? 2;
      for (let i = 0; i < n; i++) { const r = 2.1 + 0.8 * i, ph = a + 0.25; const x = r * Math.sin(ph), z = r * Math.cos(ph);
        out.push({ sp: sp(i), x, z, yaw: Math.atan2(-Math.cos(ph), Math.sin(ph)), phase: (TWO_PI * r * Math.abs(a)) / ANIMAL_BUILD[sp(i)].stride, walk: 1, graze: 0, lie: 0, coat: h1(seed + i, 5) }); }
      break; }
    case 'beside': { const s = sp(0), B = ANIMAL_BUILD[s], eat = fr(t / 17 + h1(seed)) < 0.72;
      out.push({ sp: s, x: 0.3, z: 0.5 + 0.45 * B.girth, yaw: Math.PI / 2, phase: 0, walk: 0, graze: eat ? 1 : 0, lie: 0, coat: h1(seed, 5) }); break; }
    case 'lying': { const B = ANIMAL_BUILD.sheep;
      out.push({ sp: 'sheep', x: 0.02, z: 0.66, yaw: Math.PI / 2, roll: Math.PI / 2, y: B.girth * 0.45 - (B.h - B.girth * 0.5), phase: 0, walk: 0, graze: 0, lie: 0, coat: h1(seed, 5) });
      for (let i = 0; i < 2; i++) out.push({ sp: sp(i + 1), x: -1.7 - 0.5 * i, z: 1.5 - 0.8 * i, yaw: 0.6 + 1.9 * i + 0.3 * Math.sin(t * 0.05 + i), phase: 0, walk: 0, graze: fr(t / 11 + i * 0.4) < 0.7 ? 1 : 0, lie: 0, coat: h1(seed + i, 9) });
      break; }
    case 'tethered': for (let i = 0; i < 2; i++) out.push({ sp: sp(i), x: 1.9 + 0.5 * i, z: 1.7 - 0.8 * i, yaw: -0.8 + 1.4 * i + 0.4 * Math.sin(t * 0.06 + i * 2), phase: 0, walk: 0, graze: fr(t / 13 + i * 0.5) < 0.6 ? 1 : 0, lie: 0, coat: h1(seed + i, 3) }); break;
    case 'lead': out.push({ sp: sp(0), x: -0.62, z: 0.55, yaw: 0.15 + 0.2 * Math.sin(t * 0.04), phase: 0, walk: 0, graze: fr(t / 15 + h1(seed)) < 0.35 ? 1 : 0, lie: 0, coat: h1(seed, 4) }); break;
  }
  return out;
}

/** the animals: one instanced mesh per species, filled every frame by the crowd (begin / push / end) */
export class Animals {
  readonly group = new THREE.Group();
  private meshes = new Map<Species, { mesh: THREE.InstancedMesh; state: THREE.InstancedBufferAttribute; rot: THREE.InstancedBufferAttribute[]; n: number; box: THREE.Box3 }>();
  private uTime = uniform(0);
  /** animals not drawn this frame because their species' instance cap was full (reported by stats: never silent) */
  dropped = 0;
  constructor(private cap = 512) { this.group.name = 'animals:work'; }
  private mesh(sp: Species) {
    let m = this.meshes.get(sp); if (m) return m;
    const g = animalGeometry(sp), F = animalFrame(sp), drop = lieDrop(sp);
    const state = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4); state.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aState', state);
    // the instance's rotation (its matrix's axes): three.js applies the instance matrix to positionLocal BEFORE the
    // material's positionNode, so the rig deforms the raw geometry position in the animal's own frame and adds the
    // displacement turned by these axes (rotating legs about pivots in world space would throw them across the field)
    const rot = ['aRx', 'aRy', 'aRz'].map(n => { const a = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; });
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 }); mat.vertexColors = true;
    const L = attribute('aLeg', 'vec4'), Pv = attribute('aPiv', 'vec4'), H = attribute('aHT', 'vec4'), S = attribute('aState', 'vec4');
    const rx = (p: any, a: any, cy: any, cz: any) => { const dy = p.y.sub(cy), dz = p.z.sub(cz), c = cos(a), s = sin(a); return vec3(p.x, cy.add(dy.mul(c)).sub(dz.mul(s)), cz.add(dy.mul(s)).add(dz.mul(c))); };
    const ph = S.x.add(L.x), fore = max(L.w, float(0));
    // arithmetic masks only (no select: D-012): fore = 1 for fore legs, 0 for hind
    const fo = foldOf(sp);
    const a1 = L.y.mul(S.y.mul(RIG.swing).mul(sin(ph)).add(S.w.mul(fore.mul(fo[0] - fo[2]).add(fo[2]))));
    const a2 = L.z.mul(S.y.mul(RIG.knee).mul(max(sin(ph.sub(0.6)), 0)).add(S.w.mul(fore.mul(fo[1] - fo[3]).add(fo[3]))));
    const P0 = positionGeometry; let p: any = rx(P0, a2, Pv.z, Pv.w); p = rx(p, a1, Pv.x, Pv.y);
    const ah = H.x.mul(S.z.mul(F.graze).add(S.y.mul(0.05).mul(sin(ph.mul(2)))).add(S.z.mul(0.04).mul(sin(this.uTime.mul(5.3)))));
    p = rx(p, ah, H.z, H.w);
    const at = H.y.mul(0.3).mul(sin(this.uTime.mul(1.1).add(S.x.mul(0.1)))), c = cos(at), s = sin(at), dz = p.z.sub(H.w);
    p = vec3(p.x.mul(c).add(dz.mul(s)), p.y, H.w.sub(p.x.mul(s)).add(dz.mul(c)));
    p = p.add(vec3(0, S.w.mul(-drop).add(S.y.mul(0.012).mul(sin(ph.mul(2)))), 0));
    const d = p.sub(P0);
    mat.positionNode = positionLocal.add(attribute('aRx', 'vec3').mul(d.x)).add(attribute('aRy', 'vec3').mul(d.y)).add(attribute('aRz', 'vec3').mul(d.z)) as any;
    const mesh = new THREE.InstancedMesh(g, mat, this.cap); mesh.count = 0; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = true; mesh.boundingSphere = new THREE.Sphere();
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = `animals:${sp}`; mesh.userData = { tier: 'C', src: 'RECON', note: `${ANIMAL_BUILD[sp].note}; ${ANIMAL_BUILD[sp].tier}` }; mesh.raycast = () => {};
    mesh.setColorAt(0, new THREE.Color(1, 1, 1)); nearCascadesOnly(mesh);
    this.group.add(mesh); m = { mesh, state, rot, n: 0, box: new THREE.Box3() }; this.meshes.set(sp, m); return m;
  }
  begin(time: number) { this.uTime.value = time % 100000; this.dropped = 0; for (const m of this.meshes.values()) { m.n = 0; m.box.makeEmpty(); } }
  /** an animal at a world transform with its state */
  push(a: AnimalInst, M: THREE.Matrix4) {
    const m = this.mesh(a.sp); if (m.n >= this.cap) { this.dropped++; return; } const i = m.n++;
    m.mesh.setMatrixAt(i, M); m.state.setXYZW(i, a.phase % (TWO_PI * 64), a.walk, a.graze, a.lie);
    const e = M.elements; m.rot[0].setXYZ(i, e[0], e[1], e[2]); m.rot[1].setXYZ(i, e[4], e[5], e[6]); m.rot[2].setXYZ(i, e[8], e[9], e[10]);
    const c = ANIMAL_BUILD[a.sp].coat, k = Math.min(c.length - 1, Math.floor(a.coat * c.length)); _c.setRGB(c[k][0], c[k][1], c[k][2], THREE.SRGBColorSpace); m.mesh.setColorAt(i, _c);
    m.box.expandByPoint(_p.setFromMatrixPosition(M));
  }
  end() {
    for (const m of this.meshes.values()) { const im = m.mesh; im.count = m.n; im.visible = m.n > 0; if (!m.n) continue;
      im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, m.n * 16);
      m.state.needsUpdate = true; m.state.clearUpdateRanges(); m.state.addUpdateRange(0, m.n * 4);
      for (const r of m.rot) { r.needsUpdate = true; r.clearUpdateRanges(); r.addUpdateRange(0, m.n * 3); }
      if (im.instanceColor) { im.instanceColor.needsUpdate = true; im.instanceColor.clearUpdateRanges(); im.instanceColor.addUpdateRange(0, m.n * 3); }
      m.box.getBoundingSphere(im.boundingSphere!); im.boundingSphere!.radius += 1.5; }
  }
  stats() { let draws = 0, instances = 0, triangles = 0; const species: Record<string, number> = {};
    for (const [k, m] of this.meshes) if (m.n) { draws++; instances += m.n; triangles += m.n * m.mesh.geometry.getAttribute('position').count / 3; species[k] = m.n; }
    return { draws, instances, triangles, species, dropped: this.dropped }; }
}
const _p = new THREE.Vector3(), _c = new THREE.Color();
