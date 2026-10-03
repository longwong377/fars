// D-670 (the lead's ledger row 16): the river works. Shadufs (well sweeps) lift water from the rivers and the canals onto the
// fields, on the bank top facing the water, and a bridge of boats carries the royal road over the Kur where it crosses (its
// deck rides on the water: it rises and falls with the river's level through the year). The shaduf's spot is where its
// worker stands (C1 staffs them: waterworksLayout().spots). All C (the devices by analogy: the shaduf of the Assyrian
// reliefs and Egyptian tombs; Herodotus' and Xenophon's bridges of boats; their places here by rule).
import * as THREE from 'three/webgpu';
import type { CorridorSection } from './rivers';
import type { Canal } from './canals';
import type { Crossing } from './crossings';
import type { RiverProfile } from './data';
import { settlementZones, pointInPolygon } from './data';
import { vergeZone } from './verge';
import { kitMesh, type WorkItem, type WorkSpot } from './works';
import { riverState, doyOf } from './seasonal';
import { curvatureDrop } from '../../terrain/heightfield';

export const WATERWORKS = { riverEvery: 420, canalEvery: 330, reach: 12000, calm: 150, bay: 6 } as const;
export const WATERWORKS_TAG = { tier: 'C', src: 'RECON;HDT;XEN-ANAB', note: 'shadufs on the river and canal banks and a bridge of boats on the royal road over the Kur (D-670): the devices by analogy (Assyrian reliefs, Egyptian tombs; Herodotus 7.36, Xenophon Anabasis 2.4), their places by rule (C)' };

export interface WaterworksLayout { shadufs: (WorkItem & { y: number })[]; shore: (WorkItem & { y: number })[]; bays: { e: number; n: number; rot: number; bankAsl: number; bedDepth: number }[]; spots: WorkSpot[] }

/** where the works stand (pure): rivers as drawn (their corridor sections), canals, crossings */
export function waterworksLayout(profiles: CorridorSection[][], rivers: RiverProfile[], canals: Canal[], crossings: Crossing[], ground: (e: number, n: number) => number): WaterworksLayout {
  const zones = settlementZones(), out: WaterworksLayout = { shadufs: [], shore: [], bays: [], spots: [] };
  const ok = (e: number, n: number) => !vergeZone(e, n) && !zones.some(z => pointInPolygon(e, n, z)) && !crossings.some(c => Math.hypot(c.x - e, c.y - n) < WATERWORKS.calm);
  const add = (e: number, n: number, y: number, toE: number, toN: number, id: string) => {
    const rot = Math.atan2(toE, -toN); out.shadufs.push({ m: 'wo_shaduf', e, n, rot, s: [1, 1, 1], y });
    out.spots.push({ facility: id, act: 'lift', e: e + toE * 2.9 + toN * 0.5, n: n + toN * 2.9 - toE * 0.5, yaw: rot }); };
  // rivers: every ~420 m along the reach within 12 km of the Apadana, the sides alternating, on the bank top (the corridor's
  // channel-top vertex: index 3 right, 8 left)
  profiles.forEach((prof, ri) => { let next = 200, k = 0;
    for (const q of prof) { if (q.s < next) continue; next = q.s + WATERWORKS.riverEvery; if (Math.hypot(q.x, q.y) > WATERWORKS.reach) continue;
      const side = k++ % 2 ? 1 : -1, idx = side > 0 ? 8 : 3, u = q.off[idx] + side * 1.6, e = q.x + q.nx * u, n = q.y + q.ny * u;
      if (!ok(e, n)) continue; add(e, n, q.hy[idx] - 0.05, -side * q.nx, -side * q.ny, `shaduf:${rivers[ri]?.id ?? ri}:${Math.round(q.s)}`); } });
  // the fishermen's shore (D-670): every ~1.1 km of river within 10 km, on the side away from that reach's shaduf: a willow
  // fish trap set in the shallows at the margin, a plank skiff drawn up on the bank and a net drying on poles (C)
  profiles.forEach((prof, ri) => { let next = 650, k = 0;
    for (const q of prof) { if (q.s < next) continue; next = q.s + 1100; if (Math.hypot(q.x, q.y) > 10000) continue;
      const side = k++ % 2 ? -1 : 1, top = side > 0 ? 8 : 3, slope = side > 0 ? 7 : 2, tx = q.tx, ty = q.ty, along = Math.atan2(tx, -ty);
      const at = (u: number): [number, number] => [q.x + q.nx * u, q.y + q.ny * u], [te, tn] = at(q.off[slope]), [be, bn] = at(q.off[top] + side * 2.6);
      if (!ok(be, bn)) continue;
      out.shore.push({ m: 'wo_fish_trap', e: te, n: tn, rot: along + 0.4, s: [1.2, 1.2, 1.2], y: q.hy[slope] - 0.25 });
      out.shore.push({ m: 'wo_skiff', e: be, n: bn, rot: along + side * 0.35, s: [1, 1, 1], y: q.hy[top] - 0.05 });
      const ne = be + tx * 7, nn = bn + ty * 7; out.shore.push({ m: 'wo_net_poles', e: ne, n: nn, rot: along, s: [1, 1, 1], y: q.hy[top] });
      const id = `shore:${rivers[ri]?.id ?? ri}:${Math.round(q.s)}`;
      out.spots.push({ facility: id, act: 'fish', e: be - q.nx * side * 1.5, n: bn - q.ny * side * 1.5, yaw: Math.atan2(-q.nx * side, q.ny * side) }, { facility: id, act: 'mend', e: ne + q.nx * side * 1.2, n: nn + q.ny * side * 1.2, yaw: along }); } });
  // canals: every ~330 m on alternate banks, beyond their first 100 m
  for (const c of canals) { let s = 0, next = 100, k = 0;
    for (let i = 1; i < c.pts.length; i++) { const [ax, ay] = c.pts[i - 1], [bx, by] = c.pts[i], L = Math.hypot(bx - ax, by - ay); s += L; if (s < next) continue; next = s + WATERWORKS.canalEvery;
      if (Math.hypot(bx, by) > WATERWORKS.reach) continue;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, side = k++ % 2 ? 1 : -1, u = c.width / 2 + 1.4, e = bx + nx * u * side, n = by + ny * u * side;
      if (!ok(e, n)) continue; add(e, n, ground(e, n) + 0.3, -side * nx, -side * ny, `shaduf:${c.id}:${Math.round(s)}`); } }
  // the bridge of boats: where the royal road crosses the Kur, bays along the road over the channel and its margins
  for (const c of crossings) { if (c.river !== 'river_kur' || !/royal/.test(c.road)) continue; const rv = rivers.find(r => r.id === c.river)!;
    // the road's direction at the crossing is across the river: the river's normal
    const nx = -c.ty, ny = c.tx, span = rv.topWidth, nb = Math.ceil(span / WATERWORKS.bay), rot = Math.atan2(nx, -ny);
    for (let b = 0; b < nb; b++) { const t = (b + 0.5) * WATERWORKS.bay - nb * WATERWORKS.bay / 2;
      out.bays.push({ e: c.x + nx * t, n: c.y + ny * t, rot, bankAsl: rv.bank[c.i], bedDepth: rv.channel.bank_height_m }); } }
  return out;
}

export class Waterworks {
  readonly group = new THREE.Group(); readonly layout: WaterworksLayout; private bridge: THREE.InstancedMesh | null = null; private court: number; private lastDay = NaN;
  constructor(layout: WaterworksLayout, ground: (e: number, n: number) => number, courtAsl: number) {
    this.layout = layout; this.court = courtAsl; this.group.name = 'plain-waterworks'; this.group.userData = { ...WATERWORKS_TAG };
    const sh = kitMesh('wo_shaduf', layout.shadufs, ground, 2); if (sh) { sh.castShadow = true; sh.userData = this.group.userData; this.group.add(sh); }
    for (const mName of ['wo_fish_trap', 'wo_skiff', 'wo_net_poles']) { const list = layout.shore.filter(i => i.m === mName); if (!list.length) continue;
      const m = kitMesh(mName, list, ground, 2); if (m) { m.castShadow = mName !== 'wo_fish_trap'; m.userData = this.group.userData; this.group.add(m); } }
    if (layout.bays.length) { this.bridge = kitMesh('wo_pontoon', layout.bays.map(b => ({ m: 'wo_pontoon', e: b.e, n: b.n, rot: b.rot, s: [1, 1, 1] as [number, number, number], y: 0 })), ground, 2);
      if (this.bridge) { this.bridge.castShadow = true; this.bridge.userData = this.group.userData; this.group.add(this.bridge); } }
  }
  /** the bridge rides on the Kur's level of the day */
  update(dayIndex: number) {
    if (!this.bridge || dayIndex === this.lastDay) return; this.lastDay = dayIndex;
    const st = riverState('river_kur', dayIndex), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    this.layout.bays.forEach((b, i) => { const y = b.bankAsl - b.bedDepth + st.depth - this.court - curvatureDrop(b.e, -b.n);
      q.setFromAxisAngle(up, b.rot); m4.compose(p.set(b.e, y, -b.n), q, one); this.bridge!.setMatrixAt(i, m4); });
    this.bridge.instanceMatrix.needsUpdate = true; this.bridge.computeBoundingSphere(); void doyOf;
  }
  stats() { return { shadufs: this.layout.shadufs.length, shore: this.layout.shore.length, bays: this.layout.bays.length, spots: this.layout.spots.length }; }
}
