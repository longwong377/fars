// D-227: the ground at the foot of the Grand Stair (the approach, the Terrace foot: trodden, no fields, D-190). From the top of
// the stair, 14 m up, a pixel of the plain 100-200 m out covers 1-4 m along the view (D-223), so marks in the earth do not
// survive; what does is what stands up off it, and bands that run along the view. Here, all reconstruction (C, D-207: the
// most probable fill where the sources are silent):
//  - tether lines on the trodden ground either side of the approach, 50-120 m W of the stair foot: the animals of the day's
//    deliveries and the mounts of those who went up the stair (the palace's kitchens, stores and offices were supplied by
//    pack animal; PF travel and fodder texts ration donkeys, mules, horses and camels on the roads: B for the animals in the
//    service, C for these lines, their place and numbers; donkeys and saddle horses only, for the draw budget), standing tied to a ground rope between two stakes, heads at a
//    heap of fodder, from mid-morning to mid-afternoon; their loads set down beside them in pairs of sacks;
//  - the dung swept up along each line into low heaps, and the fodder (straw and chaff) piled at the line's end;
// All positions are closed-form in (seed, day, hour) like the town's animals (fauna.ts, D-210). Drawn with the animals' rig
// (the fauna's Animals: one draw per species in view) and two meshes: the heaps and stakes (static), the loads (instanced).
import * as THREE from 'three/webgpu';
import type { AnimalInst, Species } from '../people/animals';

export type P2 = [number, number];
/** the stair foot and the approach (people_places.json stair_foot, town) */
export const STAIR_FOOT: P2 = [-52, 118.5];
/** the tether lines (grid e, n): from end a to end b; slots every `pitch` m along them. N of the approach and S of it, parallel
 *  to it (C) */
export const FOOT_LINES: { id: string; a: P2; b: P2; pitch: number }[] = [
  { id: 'north', a: [-104, 141], b: [-150, 143], pitch: 1.7 },
  { id: 'south', a: [-98, 97], b: [-136, 95], pitch: 1.7 },
];
/** the day's traffic at the foot (C): slots filled on an ordinary day, arrivals from 07:00 to 10:30, departures from 12:30 to
 *  16:30; the species of a slot's animal (shares: C, the delivery donkey the commonest) */
export const FOOT_DAY = { fill: [0.35, 0.8] as [number, number], arrive: [7, 10.5] as [number, number], leave: [12.5, 16.5] as [number, number],
  species: [['donkey', 0.75], ['horse_saddle', 0.25]] as [Species, number][] };
/* (D-227 render 2: with four species (donkey, mule, saddle horse, camel) and shadow-casting heaps and loads the stair view drew 22
   more calls (each species once per near shadow cascade too), over the plain views' budget of 10: two species, and the low heaps
   and loads cast no shadow; mules and camels at the foot are left out, C) */
const fr = (x: number) => x - Math.floor(x);
export const hf = (a: number, b = 0, c = 0) => fr(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);

export interface FootSlot { line: number; k: number; e: number; n: number; yaw: number }
/** every slot on the lines: the animal stands across the line, its head toward the rope (yaw: compass heading atan2(de, dn)) */
export function footSlots(): FootSlot[] {
  const out: FootSlot[] = [];
  FOOT_LINES.forEach((L, li) => { const dx = L.b[0] - L.a[0], dy = L.b[1] - L.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    // on the approach side of the rope, facing it (C): from the stair they stand broadside-on
    const side = li === 0 ? 1 : -1, nx = -uy * side, ny = ux * side;
    for (let s = 0, k = 0; s <= len; s += L.pitch, k++) { const e = L.a[0] + ux * s + nx * 1.2, n = L.a[1] + uy * s + ny * 1.2;
      out.push({ line: li, k, e, n, yaw: Math.atan2(-nx, -ny) }); } });
  return out;
}
/** the animal at a slot at (day, hour), or null: filled on the day with the day's share, between its arrival and departure */
export function footAnimal(slot: FootSlot, day: number, hour: number, seed: number, t: number, out: AnimalInst & { e: number; n: number }): (AnimalInst & { e: number; n: number }) | null {
  const D = FOOT_DAY, share = D.fill[0] + (D.fill[1] - D.fill[0]) * hf(seed, day, 11), id = slot.line * 100 + slot.k;
  if (hf(seed + id, day, 1) > share) return null;
  const a = D.arrive[0] + (D.arrive[1] - D.arrive[0]) * hf(seed + id, day, 2), b = D.leave[0] + (D.leave[1] - D.leave[0]) * hf(seed + id, day, 3);
  if (hour < a || hour > b) return null;
  let u = hf(seed + id, day, 4), sp: Species = 'donkey'; for (const [s, p] of D.species) { if (u < p) { sp = s; break; } u -= p; }
  // eating at the fodder most of the time, now and then head up and a shift of the feet (C)
  const eat = fr(t / (17 + 9 * hf(id, 5)) + hf(id, 6)) < 0.7 ? 1 : 0;
  Object.assign(out, { sp, e: slot.e, n: slot.n, x: 0, z: 0, yaw: slot.yaw + (hf(id, day, 7) - 0.5) * 0.5, phase: t * 1.3 + id, walk: 0, graze: eat, lie: 0, coat: hf(seed + id, day, 8) });
  return out;
}

/** the static heaps and stakes: for each line two stakes, a fodder heap at its W end, dung heaps along it (C sizes: dung swept
 *  into mounds ~1-1.6 m across and 0.2-0.35 m high; a fodder heap 2.4 × 1.6 m, 0.8 m high) */
export interface Heap { kind: 'dung' | 'fodder' | 'stake'; c: P2; r: number; h: number }
export function footHeaps(seed: number): Heap[] {
  const out: Heap[] = [];
  FOOT_LINES.forEach((L, li) => { const dx = L.b[0] - L.a[0], dy = L.b[1] - L.a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, side = li === 0 ? 1 : -1, nx = -uy * side, ny = ux * side;
    out.push({ kind: 'stake', c: L.a, r: 0.05, h: 0.9 }, { kind: 'stake', c: L.b, r: 0.05, h: 0.9 });
    out.push({ kind: 'fodder', c: [L.b[0] + ux * 3, L.b[1] + uy * 3], r: 1.2, h: 0.8 });
    for (let k = 0; k < 4; k++) { const s = len * (0.15 + 0.23 * k) + (hf(seed, li, k) - 0.5) * 3, off = 3.2 + 1.5 * hf(seed, li, 10 + k);
      out.push({ kind: 'dung', c: [L.a[0] + ux * s + nx * off, L.a[1] + uy * s + ny * off], r: 0.5 + 0.3 * hf(seed, li, 20 + k), h: 0.2 + 0.15 * hf(seed, li, 30 + k) }); } });
  return out;
}
const COL: Record<Heap['kind'], [number, number, number]> = { dung: [0.36, 0.31, 0.24], /* dried dung and trodden straw (render 2: the fresh 0.24 read as black dots at dawn; C) */ fodder: [0.72, 0.62, 0.4], stake: [0.36, 0.27, 0.18] };
/** one mesh of the heaps (low domes) and stakes, on the ground `g(e, n)` (world y) */
export function heapsGeometry(heaps: Heap[], g: (e: number, n: number) => number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = []; const c = new THREE.Color();
  for (const hp of heaps) { c.setRGB(...COL[hp.kind], THREE.SRGBColorSpace); const base = pos.length / 3, y0 = g(hp.c[0], hp.c[1]);
    if (hp.kind === 'stake') { const s = 6; for (let i = 0; i < s; i++) { const a = (i / s) * Math.PI * 2; for (const y of [y0 - 0.1, y0 + hp.h]) { pos.push(hp.c[0] + Math.cos(a) * hp.r, y, -hp.c[1] + Math.sin(a) * hp.r); col.push(c.r, c.g, c.b); } }
      for (let i = 0; i < s; i++) { const a = base + 2 * i, b = base + 2 * ((i + 1) % s); idx.push(a, b, a + 1, b, b + 1, a + 1); } continue; }
    // a dome: rings of 10 on 4 heights, elongated 1.5× for the fodder heap, its top flattened; its foot sunk 5 cm (C)
    const S = 10, R = 4, ex = hp.kind === 'fodder' ? 1.5 : 1, rot = hf(hp.c[0], hp.c[1]) * Math.PI;
    for (let j = 0; j <= R; j++) { const t = j / R, rr = hp.r * Math.cos(t * Math.PI * 0.5) * (j === R ? 0 : 1), y = y0 - 0.05 + (hp.h + 0.05) * Math.sin(t * Math.PI * 0.5) ** (hp.kind === 'fodder' ? 0.6 : 1);
      for (let i = 0; i < S; i++) { const a = (i / S) * Math.PI * 2, lx = Math.cos(a) * rr * ex, lz = Math.sin(a) * rr, w = 1 + 0.12 * (hf(hp.c[0] + i, hp.c[1] + j) - 0.5);
        pos.push(hp.c[0] + (lx * Math.cos(rot) - lz * Math.sin(rot)) * w, y, -hp.c[1] + (lx * Math.sin(rot) + lz * Math.cos(rot)) * w); const k = 0.85 + 0.25 * t; col.push(c.r * k, c.g * k, c.b * k); } }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) { const a = base + j * S + i, b = base + j * S + ((i + 1) % S), a2 = a + S, b2 = b + S; idx.push(a, a2, b, b, a2, b2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
/** a load set down: a pair of sacks side by side (one instance per occupied slot; 0.55 × 0.35 × 0.4 m each, C) */
export function loadGeometry(): THREE.BufferGeometry {
  const a = new THREE.BoxGeometry(0.55, 0.4, 0.35, 1, 1, 1).translate(0, 0.2, -0.2), b = new THREE.BoxGeometry(0.55, 0.38, 0.35).translate(0.05, 0.19, 0.2);
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const g of [a, b]) { const o = pos.length / 3; pos.push(...(g.getAttribute('position').array as Float32Array)); nor.push(...(g.getAttribute('normal').array as Float32Array)); for (const i of g.index!.array as Uint16Array) idx.push(i + o); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx); return geo;
}

/** the foot's meshes and the animals each frame. `ground(e, n)`: world y */
export class TerraceFoot {
  readonly group = new THREE.Group();
  readonly slots = footSlots(); readonly heaps: Heap[];
  private loads: THREE.InstancedMesh; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0);
  /** occupied slots in the last update */
  occupied = 0;
  constructor(private seed: number, private ground: (e: number, n: number) => number) {
    this.group.name = 'terrace-foot'; this.heaps = footHeaps(seed);
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 }); mat.vertexColors = true;
    const hm = new THREE.Mesh(heapsGeometry(this.heaps, ground), mat); hm.name = 'terrace-foot:heaps'; hm.castShadow = false; hm.receiveShadow = true; hm.matrixAutoUpdate = false;
    hm.userData = { tier: 'C', src: 'RECON', note: 'the tether lines at the foot of the Grand Stair (D-227, all C): stakes of a ground rope, the dung swept into heaps, straw and chaff piled for the animals; places and sizes C' };
    const lm = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, color: new THREE.Color().setRGB(0.6, 0.52, 0.38, THREE.SRGBColorSpace) });
    this.loads = new THREE.InstancedMesh(loadGeometry(), lm, this.slots.length); this.loads.name = 'terrace-foot:loads'; this.loads.castShadow = false; this.loads.receiveShadow = true; this.loads.count = 0; this.loads.frustumCulled = false;
    this.loads.userData = { tier: 'C', src: 'RECON', note: 'loads set down beside the tethered animals: pairs of sacks (D-227, C)' };
    this.group.add(hm, this.loads);
  }
  /** the animals at (day, hour) pushed through `push` (the fauna's rig), and the loads beside the pack animals */
  update(day: number, hour: number, t: number, push: (o: AnimalInst & { e: number; n: number }) => void) {
    const o = { sp: 'donkey', e: 0, n: 0, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0 } as AnimalInst & { e: number; n: number };
    let k = 0; this.occupied = 0;
    for (const s of this.slots) { if (!footAnimal(s, day, hour, this.seed, t, o)) continue; this.occupied++; push(o);
      if (o.sp === 'horse_saddle') continue; // a mount carries no load
      const bx = s.e + Math.sin(s.yaw + Math.PI / 2) * 0.9, bn = s.n + Math.cos(s.yaw + Math.PI / 2) * 0.9;
      this.q.setFromAxisAngle(this.up, Math.PI - s.yaw + 0.3 * (hf(s.k, s.line) - 0.5)); this.m4.compose(new THREE.Vector3(bx, this.ground(bx, bn), -bn), this.q, new THREE.Vector3(1, 1, 1)); this.loads.setMatrixAt(k++, this.m4); }
    this.loads.count = k; this.loads.instanceMatrix.needsUpdate = true; this.loads.visible = k > 0;
  }
}
