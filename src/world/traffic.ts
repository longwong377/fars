// The animals that travel, with the people who lead them (D-210; gap audit REVIEWS/gap_audit.md items 6, 16). Each is tied
// to an event the simulation already schedules, so the porters, the storekeepers and the grooms of the station meet what
// arrives when the plans say it does:
//  - the day's caravan of goods for the Treasury (Population.caravan: its hour and its sacks; PeopleSim unloads it at the
//    stair foot): strings of five pack donkeys and mules, two sacks an animal, led in along the royal road from the W to the
//    stair foot, held there while the porters take the loads up, then led back unladen to the state stable; on about one
//    day in six the caravan comes with a string of Bactrian camels (population.json camel 0-20 "caravans from outside
//    Fars"; the Apadana reliefs' camels; C);
//  - the grain deliveries to the royal stores and the storehouse (E-06, E-06b: their hour and quantity; "pack donkeys (C)
//    4-40" in E-06's participants): strings of pack donkeys up the south road to the storehouse's gate, about 10 BAR an
//    animal (C), held while the grain is measured in (E-15), then led away unladen; a large delivery also brings one to
//    three ox carts (C: carts are silent at Persepolis, Assyrian reliefs by analogy);
//  - the royal couriers (E-20: their hour; HDT 8.98, a claim): a rider walking his horse in along the royal road to the state
//    stable that stands in for the road station, and, for a letter not for Persepolis, a fresh rider leaving on the south
//    road (no stirrups: blocklist).
// Everything is closed form in the simulation's time (hours): where each driver and rider is, walking at the pace of his
// animals (1.0 m/s loaded, C; a courier 1.8 m/s, walking the horse near the station, C). world.ts draws each one within
// reach of the camera as a crowd extra performing the activity (activities.ts walk / tend_animals variants: the string, the
// mount, the cart come with the performance). Routes follow settlement.json's roads (courses C, Q-054) and keep off the
// Terrace and every town plot (tests/fauna.test.ts).
import type { TownPlan } from './settlement/plan';
import type { P2 } from './settlement/site';
import settlement from '../data/settlement.json';
import places from '../data/people_places.json';
import type { ActivityId } from '../people/activities';
import { h01 } from './fauna';

const FEAT = Object.fromEntries((settlement as any).features.map((f: any) => [f.id, f])) as Record<string, any>;
const PLACE = Object.fromEntries(((places as any).places ?? (places as any)).map((p: any) => [p.id, p])) as Record<string, any>;
/** the pace of a loaded string, of a courier walking his horse in, of an ox cart (m/s; C) */
export const PACE = { string: 1.0, courier: 1.8, cart: 0.9 } as const;
/** a string's length along the road (m): five animals nose to tail and the driver (C) */
const STRING_M = 13, CAMEL_M = 16, CART_M = 9;

export interface Mover { key: string; kind: 'pack' | 'camel' | 'courier' | 'cart'; e: number; n: number; heading: number; act: ActivityId; why: string;
  look: { id: number; sex: 'm'; role: string; dress: 'worker' | 'median'; origin: string; seed: number } }
interface Route { pts: P2[]; cum: number[]; len: number }
const route = (pts: P2[]): Route => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };
/** a point s metres along a route (clamped) and the heading there (rad, atan2(de, dn)) */
export function along(R: Route, s: number): { e: number; n: number; heading: number } {
  const x = Math.max(0, Math.min(R.len, s)); let i = 1; while (i < R.cum.length - 1 && R.cum[i] < x) i++;
  const a = R.pts[i - 1], b = R.pts[i], L = R.cum[i] - R.cum[i - 1] || 1, f = (x - R.cum[i - 1]) / L;
  return { e: a[0] + (b[0] - a[0]) * f, n: a[1] + (b[1] - a[1]) * f, heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
/** the foot of a point on a polyline (segment index and point) */
function foot(L: P2[], q: P2): { i: number; p: P2 } { let best = { i: 0, p: L[0], d: 1e18 };
  for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1], dx = b[0] - a[0], dn = b[1] - a[1], l2 = dx * dx + dn * dn, t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dn) / l2)), p: P2 = [a[0] + dx * t, a[1] + dn * t], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) best = { i, p, d }; } return best; }

export interface TrafficSource { caravan(d: number): { h: number; sacks: number } | null; cal: { ctx(d: number): { couriers: { t: number; treasury: boolean }[]; deliveries: { t: number; id: string; qty: number; place: string }[] } } }
export class Traffic {
  /** the routes (grid metres): the caravan in from the W to the stair foot and back to the stable; the south road in to the
   *  storehouse gate; the courier in to the stable and out on the south road */
  readonly routes: Record<'caravanIn' | 'caravanOut' | 'storeIn' | 'courierIn' | 'courierOut', Route>;
  private days = new Map<number, Mover[]>(); private plans = new Map<number, Plan[]>();
  constructor(private seed: number, private src: TrafficSource, plan: TownPlan | null) {
    const W = FEAT.road_royal_west.polyline as P2[], S = FEAT.road_south_tirazzish.polyline as P2[], stair = (PLACE.stair_foot?.at ?? [-52, 118.5]) as P2;
    const site = (id: string) => plan?.sites.find(s => s.id === id);
    const st = site('stables'), sto = site('stores');
    const stableGate: P2 = st ? st.grid(0, -st.H / 2 - 1.5) : [-1458, 371]; const storeGate: P2 = sto ? sto.grid(sto.W / 2 + 1.5, 0) : [-232, -537];
    // the stable's gate faces S, away from the road: the way round its E end (corners 5 m out; C)
    const round: P2[] = st ? [st.grid(st.W / 2 + 5, st.H / 2 + 5), st.grid(st.W / 2 + 5, -st.H / 2 - 5)] : [];
    const wIn = [W[4], W[3], W[2], W[1], W[0]] as P2[]; // from 4 km beyond the Tol-e Ajori gate to the Terrace's W foot
    const fs = foot(W, stableGate), fS = foot(S, storeGate), lerp = (a: P2, b: P2, f: number): P2 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    // (the stable's gate is off the road's first segment, the storehouse's off the south road's first: both checked in the tests)
    const sFar = lerp(S[1], S[2], 0.15), sOut = lerp(S[0], S[1], 0.03), wRev = W.slice(1, fs.i + 1).reverse(), sRev = S.slice(1, fS.i + 1).reverse();
    this.routes = {
      caravanIn: route([...wIn, stair]),
      caravanOut: route([stair, W[0], ...W.slice(1, fs.i + 1), fs.p, ...round, stableGate]),
      storeIn: route([sFar, S[1], ...sRev.filter(p => p !== S[1]), fS.p, storeGate]),
      courierIn: route([W[4], W[3], W[2], W[1], ...wRev.filter(p => p !== W[1]), fs.p, ...round, stableGate]),
      courierOut: route([stableGate, ...[...round].reverse(), fs.p, ...W.slice(0, fs.i + 1).reverse(), sOut, S[1], sFar]),
    };
  }
  /** the day's journeys (cached): who, on which route, arriving or leaving when (h), how far behind the head (m) */
  private dayPlans(d: number): Plan[] {
    let P = this.plans.get(d); if (P) return P; P = [];
    const cv = this.src.caravan(d), C = this.src.cal.ctx(d), R = this.routes;
    if (cv) { const camels = h01(this.seed, d, 61) < 1 / 6 ? 1 : 0, animals = Math.ceil(cv.sacks / 2) - camels * 8, strings = Math.max(1, Math.ceil(animals / 5));
      for (let i = 0; i < strings + camels; i++) { const camel = i >= strings, gap = i * STRING_M + (camel ? 4 : 0);
        P.push({ key: `cv${d}:${i}`, kind: camel ? 'camel' : 'pack', in: R.caravanIn, arrive: cv.h, gap, hold: 0.3 + 0.02 * i, out: R.caravanOut, seed: d * 131 + i,
          whyIn: camel ? 'leading a string of Bactrian camels with the caravan to the Treasury' : 'leading a string of pack donkeys with the caravan to the Treasury (the day’s goods)',
          whyHold: camel ? 'holding the camels at the stair foot while the porters take the loads up' : 'holding the string at the stair foot while the porters take the loads up',
          whyOut: camel ? 'leading the unladen camels back to the state stable' : 'leading the unloaded string back to the state stable' }); } }
    C.deliveries.forEach((x, k) => { if (x.place !== 'royal_store' && x.place !== 'store_town') return;
      const carts = x.qty >= 800 ? Math.min(3, Math.floor(x.qty / 400)) : 0, animals = Math.max(4, Math.min(40, Math.round((x.qty - carts * 60) / 10))), strings = Math.ceil(animals / 5);
      for (let i = 0; i < carts + strings; i++) { const cart = i < carts, gap = i < carts ? i * CART_M : carts * CART_M + (i - carts) * STRING_M;
        P.push({ key: `dl${d}:${k}:${i}`, kind: cart ? 'cart' : 'pack', in: R.storeIn, arrive: x.t, gap, hold: 0.5, out: null, seed: d * 173 + k * 11 + i,
          whyIn: cart ? 'driving an ox cart of grain to the storehouse (E-06)' : 'leading a string of pack donkeys with grain to the storehouse (E-06)',
          whyHold: cart ? 'holding the ox cart at the storehouse while the grain is measured in (E-06, E-15)' : 'holding the string at the storehouse while the grain is measured in (E-06, E-15)',
          whyOut: cart ? 'driving the emptied ox cart away' : 'leading the unloaded string away down the south road' }); } });
    C.couriers.forEach((x, k) => {
      P.push({ key: `cu${d}:${k}`, kind: 'courier', in: R.courierIn, arrive: x.t, gap: 0, hold: 0, out: null, seed: d * 191 + k, whyIn: 'a courier riding in to the road station on a relay horse (E-20)', whyHold: '', whyOut: '' });
      if (!x.treasury) P.push({ key: `co${d}:${k}`, kind: 'courier', in: null, arrive: x.t + 0.4, gap: 0, hold: 0, out: R.courierOut, seed: d * 197 + k, whyIn: '', whyHold: '', whyOut: 'a courier riding out on a fresh horse with the letter for the next station (E-20)' }); });
    this.plans.set(d, P); if (this.plans.size > 8) this.plans.delete(this.plans.keys().next().value!); return P;
  }
  /** everyone on the move or holding their animals at simulation time t (h), within `r` m of a grid point (all if omitted) */
  at(t: number, out: Mover[] = [], near?: { e: number; n: number; r: number }): Mover[] {
    out.length = 0; const d = Math.floor(t / 24);
    for (const dd of [d - 1, d]) for (const p of this.dayPlans(dd)) { const h = t - dd * 24, m = this.where(p, h); if (!m) continue;
      if (near && Math.hypot(m.e - near.e, m.n - near.n) > near.r) continue; out.push(m); }
    return out;
  }
  private where(p: Plan, h: number): Mover | null {
    const v = p.kind === 'courier' ? PACE.courier : p.kind === 'cart' ? PACE.cart : PACE.string, sec = (h - p.arrive) * 3600;
    const look = { id: -30000 - (Math.abs(p.seed) % 20000), sex: 'm' as const, role: p.kind === 'courier' ? 'courier' : 'porter', dress: (p.kind === 'courier' || p.kind === 'camel' ? 'median' : 'worker') as 'median' | 'worker',
      origin: p.kind === 'camel' ? (h01(p.seed, 3) < 0.5 ? 'Bactrian' : 'Arachosian') : 'Persian', seed: 50000 + (Math.abs(p.seed) % 100000) };
    const mk = (R: Route, s: number, act: ActivityId, why: string, flip = false): Mover => { const a = along(R, s); return { key: p.key, kind: p.kind, e: a.e, n: a.n, heading: flip ? a.heading + Math.PI : a.heading, act, why, look }; };
    if (p.in && sec < 0) { const s = p.in.len - p.gap + sec * v; if (s < 0) return null; return mk(p.in, s, 'walk', p.whyIn); }
    if (p.in && sec < p.hold * 3600) return p.hold ? mk(p.in, p.in.len - p.gap, 'tend_animals', p.whyHold) : null;
    if (!p.out && p.in && p.hold) { const s = p.in.len - p.gap - (sec - p.hold * 3600) * v; if (s < 0) return null; return mk(p.in, s, 'walk', p.whyOut, true); } // back the way they came
    // on the way out: the strings turn about where they stood, so the last in is the first out (C)
    if (p.out) { const s0 = p.in ? p.gap + (sec - p.hold * 3600) * v : sec * v; if (s0 < 0 || s0 > p.out.len) return null; return mk(p.out, s0, 'walk', p.whyOut); }
    return null;
  }
}
interface Plan { key: string; kind: Mover['kind']; in: Route | null; arrive: number; gap: number; hold: number; out: Route | null; seed: number; whyIn: string; whyHold: string; whyOut: string }
