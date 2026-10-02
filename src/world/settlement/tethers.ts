// The town's household animals at their tethers (s17 C1, D-550): the donkey, the goats or the sheep a household keeps
// (houseplan.ts lifeOf: about 45 % of the houses) stand tied in its court at night and in the heat of the day, and the
// donkey (sometimes the goats) by day at a peg in the lane beside the street door (fillPlan.ts doorThings), as in the
// region's villages and old town quarters (C: RECOLLECTION, NOT SEEN; donkeys and small stock kept in town: PF rations for
// animals, B). Drawn with the working animals' rig (people/animals.ts; their looks are the animals' own), within DRAW_R of
// the eye; closed-form poses from the hour and a hash (no state): standing at the manger or the fodder, head down a while,
// shifting a step, the goats lying through the midday heat.
import * as THREE from 'three/webgpu';
import { Animals, type AnimalInst, type Species } from '../../people/animals';
import { hashString } from '../../core/rng';
import type { Site } from './site';
import type { FillItem } from '../fillPlan';

export interface Tether { e: number; n: number; /** the compass heading the animal stands along (atan2(de, dn)) */ yaw: number; sp: Species; count: number; lane: boolean; plot: string; seed: number }
const DRAW_R = 70;
const h01 = (...v: number[]) => { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h / 4294967296; };
const SP = (a: string | undefined): [Species, number] => a === 'donkey' || a === undefined ? ['donkey', 1] : a === 'goats' ? ['goat', 2] : ['sheep', 2];

/** every tether of the town: the lane pegs of the fill and the courts' tether fixtures (houseplan.ts; alt 0 donkey, 1 goats, 2 sheep) */
export function townTethers(sites: Site[], items: FillItem[]): Tether[] {
  const out: Tether[] = [];
  for (const it of items) { if (!it.tether || it.m !== 'peg') continue; const [sp, c] = SP(it.tether);
    // the peg's front faces the lane; the animal stands along the wall, 0.8 m out, its head toward the peg
    const fe = Math.sin(it.rot), fn = -Math.cos(it.rot), side = h01(hashString(it.plot ?? ''), 3) < 0.5 ? 1 : -1, ae = fn * side, an = -fe * side;
    out.push({ e: it.e + fe * 0.55 + ae * 0.95, n: it.n + fn * 0.55 + an * 0.95, yaw: Math.atan2(-ae, -an), sp, count: sp === 'donkey' ? 1 : c, lane: true, plot: it.plot ?? '', seed: hashString(`${it.plot}:lane`) });
  }
  for (const s of sites) for (const f of s.fixtures ?? []) { if (f.kind !== 'tether') continue; const P = s.plots[f.plot]; if (!P) continue;
    const sp: Species = f.alt === 0 ? 'donkey' : f.alt === 1 ? 'goat' : 'sheep', nu = Math.cos(f.rot), nv = Math.sin(f.rot); // (into the court)
    const [e, n] = s.grid(f.u + nu * 0.85, f.v + nv * 0.85), [e1, n1] = s.grid(f.u + nu * 0.85 - nv, f.v + nv * 0.85 + nu); // (along the wall)
    out.push({ e, n, yaw: Math.atan2(e1 - e, n1 - n), sp, count: sp === 'donkey' ? 1 : 2, lane: false, plot: P.id, seed: hashString(`${P.id}:court`) });
  }
  return out;
}

export class TownTethers {
  readonly group = new THREE.Group();
  readonly animals = new Animals(256, 'animals:tethers');
  private grid = new Map<number, number[]>(); private laneOf = new Set<string>();
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0); private v = new THREE.Vector3(); private sc = new THREE.Vector3(1, 1, 1);
  drawn = 0;
  constructor(readonly tethers: Tether[], private ground: (e: number, n: number) => number) {
    this.group.name = 'tethers'; this.group.add(this.animals.group);
    this.group.userData = { tier: 'C', src: 'PF;RECON', note: 'the households\' donkeys, goats and sheep at their tethers: in the court, the donkey by day at a peg by the street door (s17 C1, D-550; C)' };
    tethers.forEach((t, i) => { const k = this.key(t.e, t.n); (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(i); if (t.lane) this.laneOf.add(t.plot); });
  }
  private key(e: number, n: number) { return (Math.floor(e / 50) + 4096) * 8192 + Math.floor(n / 50) + 4096; }
  /** is the animal at this tether now? the lane peg by day (7-18.5 h, no rain); the court otherwise */
  static present(t: Tether, hour: number, laneUsed: boolean, rain = 0) { const day = hour > 7 && hour < 18.5 && rain < 0.3; return t.lane ? day : !(day && laneUsed); }
  /** one animal's pose at the tether (j: 0, 1 of the small stock) at time t (s), hour h */
  static pose(t: Tether, j: number, time: number, hour: number, out: AnimalInst & { e: number; n: number }) {
    const s = t.seed + j * 7919, T = 30 + 40 * h01(s, 1), k = Math.floor((time + h01(s, 2) * T) / T);
    const step = (h01(s, k, 3) - 0.5) * 0.5, side = j ? (j % 2 ? 0.7 : -0.7) : 0, a = t.yaw, ae = Math.sin(a), an = Math.cos(a);
    const midday = hour > 12 && hour < 15.5, night = hour < 6 || hour > 20.5, lie = t.sp !== 'donkey' && (night || midday) && h01(s, k, 4) < 0.7;
    Object.assign(out, { sp: t.sp, e: t.e + ae * step + an * side, n: t.n + an * step - ae * side, x: 0, z: 0, yaw: a + (h01(s, k, 5) - 0.5) * 0.5 + (j ? 0.4 * j : 0),
      phase: 0, walk: 0, graze: !lie && h01(s, k, 6) < 0.55 ? 1 : 0, lie: lie ? 1 : 0, coat: h01(s, 9) });
    return out;
  }
  update(time: number, hour: number, eye: { x: number; y: number; z: number }, rain = 0) {
    const A = this.animals, ce = eye.x, cn = -eye.z, o = { sp: 'donkey', e: 0, n: 0, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0 } as AnimalInst & { e: number; n: number };
    A.begin(time, eye); this.drawn = 0;
    const i0 = Math.floor((ce - DRAW_R) / 50), i1 = Math.floor((ce + DRAW_R) / 50), j0 = Math.floor((cn - DRAW_R) / 50), j1 = Math.floor((cn + DRAW_R) / 50);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const ti of this.grid.get((i + 4096) * 8192 + j + 4096) ?? []) { const t = this.tethers[ti];
      if (Math.hypot(t.e - ce, t.n - cn) > DRAW_R || !TownTethers.present(t, hour, this.laneOf.has(t.plot), rain)) continue;
      for (let a = 0; a < t.count; a++) { TownTethers.pose(t, a, time, hour, o); const y = this.ground(o.e, o.n);
        this.q.setFromAxisAngle(this.up, Math.PI - o.yaw); this.m4.compose(this.v.set(o.e, y, -o.n), this.q, this.sc); A.push(o, this.m4); this.drawn++; } }
    A.end();
  }
}
