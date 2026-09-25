// The animals that live about the town, the villages, the paradise and the river, not led at work (D-210; gap audit
// REVIEWS/gap_audit.md items 5, 10, 11, 15, 36). Everything here is a reconstruction (C) unless src/data/fauna.json says
// otherwise, and every count, place and behaviour is written there with its analogy:
//  - yard dogs: in about one town house in eight and one village compound in four (population.json household template
//    "0-1 dog"; dogs 100-400 for the town), two at the state stable and at the way-station; lying by the door, getting up
//    to nose about the yard; they stand, turn to a stranger in the lane (the visitor) within 14 m and bark;
//  - strays at the middens: one to three at about half the town's middens, nosing about them by day, lying up in the heat,
//    keeping their distance from people;
//  - hens and a cock in about three town yards in ten and two village compounds in five, pecking about the yard by day and
//    roosting indoors at night; the cocks crow at first light; the state poultry yard (PF 2034, B) beside the royal stores:
//    150 birds in a ring of wattle hurdles with a mud-brick coop;
//  - the paradise's game: Mesopotamian fallow deer and goitered gazelle grazing in the Bagh-e Firuzi garden, lying up at
//    midday, drawing off from a person on foot;
//  - a sounder of wild boar rooting at the Pulvar's reedy margin below the Bagh-e Firuzi from dusk to dawn.
// Positions are closed-form in (seed, time) like the birds and jackals (D-054); the only state is the short-lived alarm of
// a dog at the visitor. Drawn with the working animals' rig (people/animals.ts Animals: one draw per species in view,
// near shadow cascades only) out to DRAW_R of the camera.
import * as THREE from 'three/webgpu';
import { Animals, type AnimalInst, type Species } from '../people/animals';
import { STAIR_FOOT, type TerraceFoot } from './terraceFoot';
/** D-227: the stair foot's animals are drawn from this far (m; the plain views from the Terrace see them at 40-400 m) */
export const FOOT_DRAW_R = 700;
import { workGeometry } from '../people/workObjects';
import type { TownPlan } from './settlement/plan';
import { plotCells } from './settlement/walk';
import { toLocal, toGrid, ROOM, type Frame, type P2 } from './settlement/site';
import type { Place } from '../audio/soundscape';
import townData from '../data/town.json';
import faunaData from '../data/fauna.json';

const fr = (x: number) => x - Math.floor(x);
/** a stable hash in [0, 1) of (seed, a, b) */
export const h01 = (seed: number, a: number, b = 0) => { let h = (seed * 2654435761) ^ Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 13), 0x45d9f3b); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const F = faunaData as any;
/** shares, counts and draw radii (fauna.json; C) */
export const FAUNA = {
  yardDogTown: F.dog.yard_share_town as number, yardDogVillage: F.dog.yard_share_village as number, strayMiddenShare: F.dog.stray_midden_share as number,
  henTown: F.poultry.yard_share_town as number, henVillage: F.poultry.yard_share_village as number, poultryYard: F.poultry.state_yard_birds as number,
  deer: F.fallow_deer.count as [number, number], gazelle: F.goitered_gazelle.count as [number, number], boar: F.wild_boar.count as number,
  drawR: { dog: 300, hen: 120, game: 450, boar: 300 },
} as const;
export const FAC: Record<string, P2> = Object.fromEntries((townData as any).facilities.map((f: any) => [f.id, f.at as P2]));

interface Yard { spots: P2[]; bed: P2; door: P2 }
interface YardDog { yard: Yard; seed: number; where: 'town' | 'village' | 'stable' }
interface Strays { c: P2; spots: P2[]; n: number; seed: number }
interface HenYard { yard: Yard; n: number; cock: boolean; seed: number; r?: number }
export interface VillageIn { id: string; x: number; y: number; r: number; comps: { x: number; y: number; w: number; d: number; angle: number; rooms: { u0: number; v0: number; u1: number; v1: number }[]; gate: number }[] }
export interface FaunaCtx { t: number; hour: number; /** the day (D-227: the foot's tether lines) */ day?: number; month: number; sun: { rise: number; set: number }; player: P2 | null; cam: { x: number; y: number; z: number }; dt: number; rain: number }

/** a coarse point grid (50 m cells) for the per-frame radius queries */
class Grid<T> { private m = new Map<number, T[]>(); constructor(private cell = 50) {}
  private key(i: number, j: number) { return (i + 4096) * 8192 + (j + 4096); }
  add(e: number, n: number, v: T) { const k = this.key(Math.floor(e / this.cell), Math.floor(n / this.cell)); const a = this.m.get(k); if (a) a.push(v); else this.m.set(k, [v]); }
  near(e: number, n: number, r: number, out: T[] = []): T[] { out.length = 0; const c = this.cell, i0 = Math.floor((e - r) / c), i1 = Math.floor((e + r) / c), j0 = Math.floor((n - r) / c), j1 = Math.floor((n + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = this.m.get(this.key(i, j)); if (a) for (const v of a) out.push(v); } return out; } }

export class Fauna {
  readonly group = new THREE.Group();
  readonly animals = new Animals(1024, 'animals:fauna');
  readonly yardDogs: YardDog[] = []; readonly strays: Strays[] = []; readonly henYards: HenYard[] = [];
  poultry: { c: P2; n: number } | null = null; paradise: { frame: Frame } | null = null; boarPath: P2[] = [];
  /** a sound at an animal (the soundscape's strike kinds: 'bark', 'cockcrow', 'cluck', 'grunt') */
  onSound?: (kind: string, pos: { x: number; y: number; z: number }) => void;
  private dogGrid = new Grid<number>(); private henGrid = new Grid<number>(); private strayGrid = new Grid<number>();
  private townPts = new Grid<P2>(60); private waterPts = new Grid<P2>(60); private treePts = new Grid<P2>(60); private dungPts = new Grid<P2>(40);
  /** dogs alarmed by the visitor: index → the time the alarm began */
  private alarm = new Map<number, number>(); private nextCrow = 0; private q: number[] = []; private m4 = new THREE.Matrix4(); private qt = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0);
  private drawn: { e: number; n: number }[] = [];
  /** statistics of the last update (dev overlay, tests) */
  readonly stats = { drawn: 0, bySpecies: {} as Record<string, number>, barks: 0, crows: 0 };

  constructor(private seed: number, plan: TownPlan | null, villages: VillageIn[], private ground: (e: number, n: number) => number,
    water: { rivers: { pts: P2[]; half: number }[]; canals: P2[][] } = { rivers: [], canals: [] }) {
    this.group.name = 'fauna'; this.group.add(this.animals.group);
    if (plan) this.fromTown(plan);
    villages.forEach((v, vi) => this.fromVillage(v, vi));
    for (const L of [...water.rivers.map(r => r.pts), ...water.canals]) for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < d; s += 25) this.waterPts.add(a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d, [a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d]); }
    this.boarPath = boarReach(water.rivers, FAC.river);
    this.yardDogs.forEach((d, i) => this.dogGrid.add(d.yard.bed[0], d.yard.bed[1], i));
    this.henYards.forEach((h, i) => this.henGrid.add(h.yard.bed[0], h.yard.bed[1], i));
    this.strays.forEach((s, i) => this.strayGrid.add(s.c[0], s.c[1], i));
    if (this.poultry) { const g = workGeometry('hurdles'), mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 }); mat.vertexColors = true;
      const m = new THREE.Mesh(g, mat); const [e, n] = this.poultry.c; m.position.set(e, this.ground(e, n), -n); m.castShadow = m.receiveShadow = true;
      m.userData = { tier: 'C', src: 'IR-PET;RECON', note: 'the state poultry yard (PF 2034 poultry, IR-PET fodder for poultry: B; where and how kept C; D-210)' }; m.name = 'fauna:poultry_yard'; this.group.add(m); }
  }
  // ---------------------------------------------------------------- where they live
  private fromTown(plan: TownPlan) {
    let hi = 0;
    for (const s of plan.sites) for (const p of s.plots) {
      const cells = plotCells(s, p.idx), open = cells.open; const [i0, j0, i1, j1] = p.rect, c = s.grid((s.cu(i0) + s.cu(i1 - 1)) / 2, (s.cv(j0) + s.cv(j1 - 1)) / 2);
      if (p.kind === 'house' || p.kind === 'house_large' || p.kind === 'elite') this.townPts.add(c[0], c[1], c);
      if (p.kind === 'garden') for (let k = 0; k < open.length; k += 97) { const g = s.cellGrid(open[k]); this.treePts.add(g[0], g[1], g); }
      if (!open.length) continue;
      // the yard's spots: open cells of the plot, each in a straight line over the plot's open cells from the bed and from
      // every other spot, so an animal walking between them never crosses a wall (courts can be L-shaped)
      const clear = (a: P2, b: P2) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let q = 0; q <= d; q += 0.4) { const [u, v] = toLocal(s.frame, a[0] + (b[0] - a[0]) * q / (d || 1), a[1] + (b[1] - a[1]) * q / (d || 1)), i = s.ci(u), j = s.cj(v);
        if (!s.inb(i, j)) return false; const k = s.k(i, j); if (s.cell[k] !== p.idx || s.sub[k] === ROOM) return false; } return true; };
      const yard = (): Yard => { const pick = (u: number) => s.cellGrid(open[Math.floor(u * open.length) % open.length]);
        const door = p.door ? s.cellGrid(p.door.cell) : pick(0.5); let bed = pick(0.1), bd = 1e9; for (let k = 0; k < open.length; k += Math.max(1, Math.floor(open.length / 60))) { const g = s.cellGrid(open[k]), d = Math.hypot(g[0] - door[0], g[1] - door[1]); if (d < bd) { bd = d; bed = g; } }
        const spots: P2[] = [bed]; for (let q = 0; q < 24 && spots.length < 5; q++) { const g = pick(h01(this.seed, hi, 10 + q)); if (spots.every(o => clear(o, g))) spots.push(g); }
        return { spots, bed, door }; };
      hi++;
      if (p.kind === 'house' || p.kind === 'house_large') {
        if (h01(this.seed, hi, 1) < FAUNA.yardDogTown) this.yardDogs.push({ yard: yard(), seed: hi * 7 + 1, where: 'town' });
        if (h01(this.seed, hi, 2) < FAUNA.henTown) this.henYards.push({ yard: yard(), n: 3 + Math.floor(h01(this.seed, hi, 3) * 4), cock: h01(this.seed, hi, 4) < 0.6, seed: hi * 7 + 2 });
      } else if (p.kind === 'stable' || p.kind === 'station') for (let k = 0; k < 2; k++) this.yardDogs.push({ yard: yard(), seed: hi * 7 + 3 + k, where: 'stable' });
    }
    for (const t of plan.trees) this.treePts.add(t.c[0], t.c[1], t.c);
    // strays at about half of the middens (a quarter's middens by the house backs, the kiln's, the stable's, the station's)
    plan.middens.forEach((m, mi) => { this.dungPts.add(m.c[0], m.c[1], m.c); if (m.kind !== 'midden' || h01(this.seed, 7000 + mi) >= FAUNA.strayMiddenShare) return;
      const spots: P2[] = []; for (let k = 0; k < 24 && spots.length < 6; k++) { const a = h01(this.seed, 7100 + mi, k) * Math.PI * 2, r = 2 + 8 * h01(this.seed, 7200 + mi, k), e = m.c[0] + r * Math.cos(a), n = m.c[1] + r * Math.sin(a);
        if (openGround(plan, e, n) && lineOpen(plan, m.c, [e, n])) spots.push([e, n]); }
      if (spots.length >= 2) this.strays.push({ c: m.c, spots, n: 1 + Math.floor(h01(this.seed, 7300 + mi) * 3), seed: 7400 + mi }); });
    // the state poultry yard: the nearest open disc of 12 m beside the royal stores (C)
    const at = FAC.royal_store; outer: for (let r = 20; r < 200; r += 6) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, e = at[0] + r * Math.cos(a), n = at[1] + r * Math.sin(a);
      let ok = true; for (let q = 0; q < 24 && ok; q++) { const b = (q / 24) * Math.PI * 2; for (const rr of [0, 6, 12]) if (!openGround(plan, e + rr * Math.cos(b), n + rr * Math.sin(b))) { ok = false; break; } }
      if (ok) { this.poultry = { c: [e, n], n: FAUNA.poultryYard }; this.dungPts.add(e, n, [e, n]); break outer; } }
    const par = plan.sites.find(s => s.id === 'paradise'); if (par) { this.paradise = { frame: par.frame }; }
  }
  private fromVillage(v: VillageIn, vi: number) {
    v.comps.forEach((c, ci) => {
      const ca = Math.cos(c.angle), sa = Math.sin(c.angle), W = (u: number, w: number): P2 => [c.x + u * ca - w * sa, c.y + u * sa + w * ca];
      this.townPts.add(c.x, c.y, [c.x, c.y]);
      const inRoom = (u: number, w: number) => c.rooms.some(r => u > r.u0 - 0.6 && u < r.u1 + 0.6 && w > r.v0 - 0.6 && w < r.v1 + 0.6);
      const k = 100000 + vi * 1000 + ci, spots: P2[] = [];
      const gu = c.gate * (c.w - 3), loc: P2[] = [[gu, -c.d / 2 + 1.3]], clearL = (a: P2, b: P2) => { for (let q = 0; q <= 1; q += 0.05) if (inRoom(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q)) return false; return true; };
      for (let q = 0; q < 20 && loc.length < 5; q++) { const u = (h01(this.seed, k, q) - 0.5) * (c.w - 2.4), w = (h01(this.seed, k, 50 + q) - 0.5) * (c.d - 2.4); if (!inRoom(u, w) && loc.every(o => clearL(o, [u, w]))) loc.push([u, w]); }
      if (loc.length < 3) return; for (const [u, w] of loc) spots.push(W(u, w)); const bed = spots[0], yard: Yard = { spots, bed, door: W(gu, -c.d / 2) };
      if (h01(this.seed, k, 101) < FAUNA.yardDogVillage) this.yardDogs.push({ yard, seed: k * 3 + 1, where: 'village' });
      if (h01(this.seed, k, 102) < FAUNA.henVillage) this.henYards.push({ yard, n: 3 + Math.floor(h01(this.seed, k, 103) * 4), cock: h01(this.seed, k, 104) < 0.6, seed: k * 3 + 2 });
      if (h01(this.seed, k, 105) < 0.5) this.dungPts.add(spots[0][0], spots[0][1], spots[0]); // the animals' corner of the yard
    });
  }
  /** D-210 (court setting only, gap audit items 16, 17): the royal chariot with its two horses standing in the yoke and two
   *  covered wagons with their mules beside them, at the edge of the court's camp facing the Terrace (fauna.json
   *  court_vehicles; C) */
  readonly vehicles: { kind: 'chariot' | 'wagon'; e: number; n: number; heading: number }[] = [];
  addCourtVehicles(c: P2, r: number) {
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }); mat.vertexColors = true;
    const put = (kind: 'chariot' | 'wagon', e: number, n: number, heading: number) => { const m = new THREE.Mesh(workGeometry(kind), mat); m.position.set(e, this.ground(e, n), -n); m.rotation.y = Math.PI - heading;
      m.castShadow = m.receiveShadow = true; m.name = `fauna:${kind}`; m.userData = { tier: kind === 'chariot' ? 'B' : 'C', src: 'APA-RELIEF;HDT;FAUNA-RECOLL', note: `${kind === 'chariot' ? 'the royal chariot' : 'a covered wagon (harmamaxa)'} at the court's camp (court setting; fauna.json court_vehicles; D-210)` };
      this.group.add(m); this.vehicles.push({ kind, e, n, heading }); };
    put('chariot', c[0] + r + 14, c[1] - 6, 0); put('wagon', c[0] + r + 14, c[1] + 8, 0); put('wagon', c[0] + r + 14, c[1] + 18, 0);
  }
  /** how many of each (dev overlay, tests, fauna.json's checks) */
  counts() {
    const dogs = { town: 0, village: 0, stable: 0 }; for (const d of this.yardDogs) dogs[d.where]++;
    const strays = this.strays.reduce((a, s) => a + s.n, 0), hens = this.henYards.reduce((a, h) => a + h.n + (h.cock ? 1 : 0), 0);
    return { yardDogsTown: dogs.town, yardDogsVillage: dogs.village, stableDogs: dogs.stable, strays, henYards: this.henYards.length, hens, poultryYard: this.poultry?.n ?? 0,
      deer: this.paradise ? FAUNA.deer[0] + FAUNA.deer[1] : 0, gazelle: this.paradise ? FAUNA.gazelle[0] + FAUNA.gazelle[1] : 0, boar: this.boarPath.length ? FAUNA.boar : 0 };
  }
  // ---------------------------------------------------------------- closed-form behaviour
  /** a yard dog at time t: lying at its bed by the door most of the day and all night, up now and then to nose about the
   *  yard; alarmed (the visitor within 14 m): standing, facing the visitor */
  yardDogAt(i: number, c: FaunaCtx, out: AnimalInst & { e: number; n: number }) {
    const d = this.yardDogs[i], night = c.hour < c.sun.rise - 0.4 || c.hour > c.sun.set + 0.8, T = 90 + 60 * h01(d.seed, 1), k = Math.floor((c.t + h01(d.seed, 2) * T) / T), u = fr((c.t + h01(d.seed, 2) * T) / T);
    const up = !night && h01(d.seed, k) < 0.4, A = up ? d.yard.spots[k % d.yard.spots.length] : d.yard.bed, B = up ? d.yard.spots[(k + 1) % d.yard.spots.length] : d.yard.bed;
    const walking = up && u > 0.8, w = walking ? smooth((u - 0.8) / 0.2) : 0, e = A[0] + (B[0] - A[0]) * w, n = A[1] + (B[1] - A[1]) * w;
    Object.assign(out, { sp: 'dog' as Species, e, n, x: 0, z: 0, yaw: walking ? Math.atan2(B[0] - A[0], B[1] - A[1]) : Math.atan2(d.yard.door[0] - e, d.yard.door[1] - n) + 0.5 * Math.sin(c.t * 0.03 + i),
      phase: (2 * Math.PI * c.t * 1.0) / 0.95, walk: walking ? 1 : 0, graze: up && !walking && fr(c.t / 9 + i * 0.3) < 0.4 ? 1 : 0, lie: up ? 0 : 1, coat: h01(d.seed, 9) });
    const al = this.alarm.get(i); if (al !== undefined && c.player) { out.lie = 0; out.walk = 0; out.graze = 0; out.yaw = Math.atan2(c.player[0] - e, c.player[1] - n); }
    return out;
  }
  private strayAt(g: Strays, j: number, c: FaunaCtx, out: AnimalInst & { e: number; n: number }) {
    const s = g.seed * 13 + j, T = 40 + 30 * h01(s, 1), k = Math.floor((c.t + h01(s, 2) * T) / T), u = fr((c.t + h01(s, 2) * T) / T), hot = c.hour > 11.5 && c.hour < 16;
    const A = g.spots[(k + j) % g.spots.length], B = g.spots[(k + j + 1) % g.spots.length], walking = u > 0.75, w = walking ? smooth((u - 0.75) / 0.25) : 0;
    let e = A[0] + (B[0] - A[0]) * w, n = A[1] + (B[1] - A[1]) * w;
    const lying = !walking && (hot || h01(s, k, 3) < 0.35);
    Object.assign(out, { sp: 'dog' as Species, e, n, x: 0, z: 0, yaw: walking ? Math.atan2(B[0] - A[0], B[1] - A[1]) : h01(s, k, 4) * 6.28, phase: (2 * Math.PI * c.t) / 0.95, walk: walking ? 1 : 0, graze: !walking && !lying ? 1 : 0, lie: lying ? 1 : 0, coat: h01(s, 9) });
    // strays keep their distance: within 10 m of the visitor they get up and draw off (C)
    if (c.player) { const dx = e - c.player[0], dn = n - c.player[1], d = Math.hypot(dx, dn); if (d < 10 && d > 0.01) { const k2 = (10 - d) / d; e += dx * k2; n += dn * k2; out.e = e; out.n = n; out.lie = 0; out.graze = 0; out.walk = 1; out.yaw = Math.atan2(dx, dn); } }
    return out;
  }
  private henAt(y: HenYard, j: number, c: FaunaCtx, out: AnimalInst & { e: number; n: number }, sc: { s: number }) {
    const s = y.seed * 17 + j, T = 7 + 6 * h01(s, 1), k = Math.floor((c.t + h01(s, 2) * T) / T), u = fr((c.t + h01(s, 2) * T) / T), sp: Species = y.cock && j === y.n ? 'cock' : 'hen';
    let A: P2, B: P2;
    if (y.r) { const pt = (q: number): P2 => { const a = h01(s, q) * Math.PI * 2, r = Math.sqrt(h01(s, q, 5)) * y.r!; return [y.yard.bed[0] + r * Math.cos(a), y.yard.bed[1] + r * Math.sin(a)]; }; A = pt(k); B = pt(k + 1); }
    else { const sp0 = y.yard.spots; const a = sp0[(k + j) % sp0.length], b = sp0[(k + j + 1) % sp0.length], o = (q: number) => (h01(s, q) - 0.5) * 1.6; A = [a[0] + o(k), a[1] + o(k + 99)]; B = [b[0] + o(k + 1), b[1] + o(k + 100)]; }
    const walking = u > 0.55, w = walking ? smooth((u - 0.55) / 0.45) : 0, e = A[0] + (B[0] - A[0]) * w, n = A[1] + (B[1] - A[1]) * w;
    Object.assign(out, { sp, e, n, x: 0, z: 0, yaw: walking ? Math.atan2(B[0] - A[0], B[1] - A[1]) : h01(s, k, 6) * 6.28 + 0.4 * Math.sin(c.t * 0.5 + j), phase: (2 * Math.PI * c.t * 0.25) / 0.22, walk: walking ? 1 : 0,
      graze: !walking && fr(c.t * 0.9 + j * 0.37) < 0.45 ? 1 : 0, lie: 0, coat: h01(s, 9) });
    sc.s = 0.85 + 0.3 * h01(s, 11); return out;
  }
  /** the paradise's game: a herd's centre drifts slowly over the garden (closed form); each animal grazes about it, walks to
   *  a new spot, lies up at midday; within 25 m of the visitor it draws off (C) */
  gameAt(kind: 'deer' | 'gazelle', j: number, c: FaunaCtx, out: AnimalInst & { e: number; n: number }) {
    const P = this.paradise!, s = (kind === 'deer' ? 900 : 950) + j, g = kind === 'deer' ? 1 : 2, [nf, nm] = kind === 'deer' ? FAUNA.deer : FAUNA.gazelle;
    const cu = 15 + 110 * Math.sin(c.t / 5400 + g * 2.1) * (0.8 + 0.2 * Math.sin(c.t / 1700 + g)), cv = 85 * Math.sin(c.t / 4100 + g * 1.3);
    const T = 30 + 20 * h01(s, 1), k = Math.floor((c.t + h01(s, 2) * T) / T), u = fr((c.t + h01(s, 2) * T) / T), spot = (q: number): P2 => { const a = h01(s, q) * Math.PI * 2, r = 3 + 11 * Math.sqrt(h01(s, q, 3)); return [cu + r * Math.cos(a), cv + r * Math.sin(a)]; };
    const A = spot(k), B = spot(k + 1), walking = u > 0.7, w = walking ? smooth((u - 0.7) / 0.3) : 0, midday = c.hour > 11 && c.hour < 15.5 && h01(s, Math.floor(c.t / 1800)) < 0.7;
    let [e, n] = toGrid(P.frame, A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w);
    const sp: Species = kind === 'deer' ? (j < nf ? 'deer' : 'stag') : (j < nf ? 'gazelle' : 'gazelle_m'); void nm;
    const gA = toGrid(P.frame, A[0], A[1]), gB = toGrid(P.frame, B[0], B[1]), dir = walking ? Math.atan2(gB[0] - gA[0], gB[1] - gA[1]) : h01(s, k, 5) * 6.28;
    Object.assign(out, { sp, e, n, x: 0, z: 0, yaw: dir, phase: (2 * Math.PI * c.t * 0.8) / 1.1, walk: walking && !midday ? 1 : 0, graze: !walking && !midday ? 1 : 0, lie: midday && !walking ? 1 : 0, coat: h01(s, 9) });
    if (c.player) { const dx = e - c.player[0], dn = n - c.player[1], d = Math.hypot(dx, dn); if (d < 25 && d > 0.01) { const f = (25 - d) * 0.9 / d; e += dx * f; n += dn * f;
      const [lu, lv] = toLocal(P.frame, e, n), cl = (x: number, a: number) => Math.max(-a, Math.min(a, x)); [e, n] = toGrid(P.frame, cl(lu, 150), cl(lv, 115)); // (the garden wall stops them)
      out.e = e; out.n = n; out.walk = 1; out.graze = 0; out.lie = 0; out.yaw = Math.atan2(dx, dn); } }
    return out;
  }
  /** the boar sounder at the river margin, dusk to dawn: the sow and her young rooting as they move slowly along the reeds */
  boarAt(j: number, c: FaunaCtx, out: AnimalInst & { e: number; n: number }, sc: { s: number }) {
    const L = this.boarPath, m = L.length - 1, v = 0.12, s0 = (c.t * v) % (2 * m * 20), q = s0 / 20, back = q > m, qq = back ? 2 * m - q : q, i = Math.min(m - 1, Math.floor(qq)), f = qq - i;
    const a = L[i], b = L[i + 1], lag = j * 2.2, dir = Math.atan2(b[0] - a[0], b[1] - a[1]) + (back ? Math.PI : 0), off = (h01(900 + j, 1) - 0.5) * 3;
    const e = a[0] + (b[0] - a[0]) * f - Math.sin(dir) * lag + Math.cos(dir) * off, n = a[1] + (b[1] - a[1]) * f - Math.cos(dir) * lag - Math.sin(dir) * off, root = fr(c.t / 11 + j * 0.3) < 0.7;
    Object.assign(out, { sp: 'boar' as Species, e, n, x: 0, z: 0, yaw: dir + 0.5 * Math.sin(c.t * 0.1 + j), phase: (2 * Math.PI * c.t * 0.5) / 0.95, walk: root ? 0 : 1, graze: root ? 1 : 0, lie: 0, coat: h01(900 + j, 9) });
    sc.s = j === 0 ? 1 : 0.5 + 0.1 * h01(900 + j, 3); return out;
  }
  // ---------------------------------------------------------------- per frame
  update(c: FaunaCtx) {
    const A = this.animals, cam: P2 = [c.cam.x, -c.cam.z], st = this.stats; A.begin(c.t); st.drawn = 0; st.bySpecies = {}; this.drawn.length = 0;
    const o = { sp: 'dog', e: 0, n: 0, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0 } as AnimalInst & { e: number; n: number }, sc = { s: 1 };
    const push = (s = 1) => { const y = this.ground(o.e, o.n); this.qt.setFromAxisAngle(this.up, Math.PI - o.yaw); /* o.yaw: the compass heading atan2(de, dn); the rig faces +Z */ this.m4.compose(_v.set(o.e, y, -o.n), this.qt, _s.set(s, s, s)); A.push(o, this.m4); st.drawn++; st.bySpecies[o.sp] = (st.bySpecies[o.sp] ?? 0) + 1; this.drawn.push({ e: o.e, n: o.n }); };
    const day = c.hour > c.sun.rise - 0.2 && c.hour < c.sun.set + 0.3, night = !day, dawn = c.hour > c.sun.rise - 1.3 && c.hour < c.sun.rise + 1.0;
    const sound = (kind: string, e: number, n: number, h: number) => this.onSound?.(kind, { x: e, y: this.ground(e, n) + h, z: -n });
    // yard dogs: the alarm at the visitor (14 m in, 20 m out), barking fast at first, then now and then (C)
    for (const i of this.dogGrid.near(cam[0], cam[1], FAUNA.drawR.dog, this.q)) { this.yardDogAt(i, c, o);
      if (c.player) { const d = Math.hypot(o.e - c.player[0], o.n - c.player[1]), al = this.alarm.get(i);
        if (d < 14 && al === undefined) { this.alarm.set(i, c.t); this.yardDogAt(i, c, o); } else if (d > 20 && al !== undefined) this.alarm.delete(i);
        const a2 = this.alarm.get(i); if (a2 !== undefined && Math.random() < c.dt / (c.t - a2 < 10 ? 1.4 : 6)) { sound('bark', o.e, o.n, 0.5); st.barks++; } }
      if (night && Math.random() < c.dt / 400) { sound('bark', o.e, o.n, 0.5); st.barks++; } // a dog answering the night (C)
      push(); }
    for (const gi of this.strayGrid.near(cam[0], cam[1], FAUNA.drawR.dog, [])) { const g = this.strays[gi]; for (let j = 0; j < g.n; j++) { this.strayAt(g, j, c, o); push(0.92); } }
    // hens and cocks by day (at night they roost indoors: not drawn); the cocks crow at first light (at most one every 5 s)
    if (day) { for (const hi of this.henGrid.near(cam[0], cam[1], FAUNA.drawR.hen, [])) { const y = this.henYards[hi]; for (let j = 0; j <= y.n - (y.cock ? 0 : 1); j++) { this.henAt(y, j, c, o, sc); push(sc.s); } }
      if (this.poultry && Math.hypot(this.poultry.c[0] - cam[0], this.poultry.c[1] - cam[1]) < FAUNA.drawR.hen + 20) { const y: HenYard = { yard: { spots: [], bed: this.poultry.c, door: this.poultry.c }, n: this.poultry.n, cock: false, seed: 555, r: 7.5 };
        for (let j = 0; j < y.n; j++) { this.henAt(y, j, c, o, sc); if (j % 19 === 0) o.sp = 'cock'; push(sc.s); } } }
    if (dawn && c.t >= this.nextCrow) { const near = this.henGrid.near(cam[0], cam[1], 250, []).filter(i => this.henYards[i].cock); if (near.length && Math.random() < c.dt * Math.min(1, near.length * 0.02)) {
      const y = this.henYards[near[Math.floor(Math.random() * near.length)]]; sound('cockcrow', y.yard.bed[0], y.yard.bed[1], 0.6); st.crows++; this.nextCrow = c.t + 5; } }
    if (day && Math.random() < c.dt / 5) { const near = this.henGrid.near(cam[0], cam[1], 30, []); if (near.length) { const y = this.henYards[near[0]]; sound('cluck', y.yard.spots[0][0], y.yard.spots[0][1], 0.25); } }
    // the paradise's game
    if (this.paradise) { const pc = this.paradise.frame.c; if (Math.hypot(pc[0] - cam[0], pc[1] - cam[1]) < FAUNA.drawR.game + 200) {
      for (const [kind, [a, b]] of [['deer', FAUNA.deer], ['gazelle', FAUNA.gazelle]] as const) for (let j = 0; j < a + b; j++) { this.gameAt(kind, j, c, o); if (Math.hypot(o.e - cam[0], o.n - cam[1]) < FAUNA.drawR.game) push(); } } }
    // the boar at the river margin, dusk to dawn; now and then a grunt
    if (this.boarPath.length > 1 && (c.hour > c.sun.set - 0.3 || c.hour < c.sun.rise + 0.5)) { const b0 = this.boarPath[Math.floor(this.boarPath.length / 2)];
      if (Math.hypot(b0[0] - cam[0], b0[1] - cam[1]) < FAUNA.drawR.boar + 400) for (let j = 0; j < FAUNA.boar; j++) { this.boarAt(j, c, o, sc); if (Math.hypot(o.e - cam[0], o.n - cam[1]) > FAUNA.drawR.boar) continue; push(sc.s);
        if (j === 0 && Math.hypot(o.e - cam[0], o.n - cam[1]) < 70 && Math.random() < c.dt / 20) sound('grunt', o.e, o.n, 0.4); } }
    // the court's vehicles and their animals (court setting)
    for (const v of this.vehicles) { if (Math.hypot(v.e - cam[0], v.n - cam[1]) > FAUNA.drawR.game) continue; const ch = v.heading, s = Math.sin(ch), co = Math.cos(ch);
      const team: [number, number, Species][] = v.kind === 'chariot' ? [[0.55, 2.43, 'horse'], [-0.55, 2.43, 'horse']] : [[1.8, 1.2, 'mule'], [2.6, -0.4, 'mule']];
      team.forEach(([x, z, sp], j) => { const graze = v.kind === 'wagon' && fr(c.t / 21 + j * 0.4) < 0.6;
        Object.assign(o, { sp, e: v.e - co * x + s * z, n: v.n + s * x + co * z, x: 0, z: 0, yaw: ch + (v.kind === 'wagon' ? 0.6 * j - 0.3 : 0), phase: 0, walk: 0, graze: graze ? 1 : 0, lie: 0, coat: h01(77, j) }); push(); }); }
    // D-227: the tether lines at the foot of the Grand Stair (terraceFoot.ts), within FOOT_DRAW_R of it
    if (this.foot) { const vis = Math.hypot(STAIR_FOOT[0] - cam[0], STAIR_FOOT[1] - cam[1]) < FOOT_DRAW_R; this.foot.group.visible = vis;
      if (vis) this.foot.update(c.day ?? 0, c.hour, c.t, a => { Object.assign(o, a); push(); }); }
    A.end();
  }
  /** D-227: the tether lines at the stair foot (terraceFoot.ts): drawn with this rig */
  foot: TerraceFoot | null = null;
  addTerraceFoot(f: TerraceFoot) { this.foot = f; this.group.add(f.group); }
  /** the listener's surroundings for the soundscape (audio/soundscape.ts Place): houses, water, trees, dung and middens,
   *  animals near (C: the distances at which each counts) */
  placeAt(e: number, n: number): Place {
    const near = (g: Grid<P2>, r: number) => { let b = 1e9; for (const p of g.near(e, n, r, [])) b = Math.min(b, Math.hypot(p[0] - e, p[1] - n)); return b; };
    let an = 1e9; for (const p of this.drawn) an = Math.min(an, Math.hypot(p.e - e, p.n - n));
    const fac = (id: string, r: number) => { const f = FAC[id]; return f ? Math.hypot(f[0] - e, f[1] - n) - r : 1e9; };
    const stock = Math.min(fac('stockyard', 30), fac('station', 40));
    return { town: 1 - smooth((near(this.townPts, 300) - 40) / 260), water: 1 - smooth((near(this.waterPts, 280) - 25) / 250), trees: 1 - smooth((near(this.treePts, 140) - 15) / 120),
      midden: 1 - smooth((near(this.dungPts, 40) - 4) / 20), animals: Math.max(1 - smooth((an - 2) / 10), 1 - smooth(stock / 40)) };
  }
}
const _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** is a grid point on open ground of the town (a lane, a square or outside every plot)? */
export function openGround(plan: TownPlan, e: number, n: number): boolean {
  for (const s of plan.sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; if (s.cell[s.k(i, j)] >= 0) return false; }
  return true;
}
/** is the straight line between two grid points on open ground all the way (sampled every 0.7 m)? */
export function lineOpen(plan: TownPlan, a: P2, b: P2): boolean { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= d; s += 0.7) if (!openGround(plan, a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d)) return false; return true; }
/** the boar's reach: about 400 m of the river margin nearest the town's river place (town.json `river`: the Pulvar by the
 *  Bagh-e Firuzi), 2 m beyond the channel's top edge on the town side, among the reeds, every point of the centreline (C) */
export function boarReach(rivers: { pts: P2[]; half: number }[], at: P2 | undefined): P2[] {
  if (!at || !rivers.length) return []; let best = { r: -1, i: -1, d: 1e9 };
  rivers.forEach((R, r) => R.pts.forEach((p, i) => { const d = Math.hypot(p[0] - at[0], p[1] - at[1]); if (d < best.d) best = { r, i, d }; }));
  if (best.r < 0 || best.d > 3000) return []; const L = rivers[best.r].pts, off = rivers[best.r].half + 2, out: P2[] = [];
  for (let i = Math.max(1, best.i - 10); i < Math.min(L.length - 1, best.i + 10); i++) { const a = L[i - 1], b = L[i + 1], dx = b[0] - a[0], dn = b[1] - a[1], l = Math.hypot(dx, dn) || 1;
    let nx = -dn / l, nn = dx / l; if ((at[0] - L[i][0]) * nx + (at[1] - L[i][1]) * nn < 0) { nx = -nx; nn = -nn; } out.push([L[i][0] + nx * off, L[i][1] + nn * off]); }
  return out;
}
