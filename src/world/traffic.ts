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
//  - D-256 (WORLD_INVENTORY G30; gap hunts A505, A506, P-034, P-063): the quarrymen at work at the Majdabad quarry (the Sivand
//    quarry is not built: no rock within its 100 m, plain/quarries.ts) and the column drums the construction counts in
//    (construction.ts, E-61 "a column drum arrived from the quarry") dragged across the plain on a sledge behind two yoke of
//    oxen, with a gang of three beside it: out of the quarry, over the plain to the royal road and along it to the Terrace,
//    round its W foot to the drum ground at the N foot, where the ground stands at the court's level (the last 250 m into the
//    masons' yard, and how the drums went up, are the labour gang's and not modelled: Q-710). The haul moves only in the
//    daylight (sunrise + 1 h to sunset − 1 h) at 0.4 m/s, halting for the night by the road; the team goes back to the quarry
//    with the empty sledge. Every part of this is C (D-256).
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
import { h01, openGround } from './fauna';
import type { QuarrySite } from './plain/quarries';
import { hutSleepSpot } from './plain/quarry_camp';
import { RoadFolk } from './roadFolk';
import type { Tent } from '../people/camps';

const FEAT = Object.fromEntries((settlement as any).features.map((f: any) => [f.id, f])) as Record<string, any>;
const PLACE = Object.fromEntries(((places as any).places ?? (places as any)).map((p: any) => [p.id, p])) as Record<string, any>;
/** the pace of a loaded string, of a courier walking his horse in, of an ox cart (m/s; C) */
export const PACE = { string: 1.0, courier: 1.8, cart: 0.9 } as const;
/** D-256: the drum haul (C): the loaded sledge's pace behind two yoke of oxen, the empty sledge's back, the daylight it moves in
 *  (h after sunrise, before sunset), the hour at the drum ground before the construction counts the drum in at the yard, the
 *  hold there while it is levered off, the gang beside it, the quarry's men and the share of hauls from Majdabad (all C) */
export const DRUM = { pace: 0.4, back: 0.8, dawn: 1.0, dusk: 1.0, before: 1.0, hold: 1.2, gang: 3, quarrymen: 14 } as const;
/** D-256: the drum ground at the Terrace's N foot, where the ground stands level with the court (grid m; C, Q-710) */
export const DRUM_GROUND: P2 = [150, 272];
/** a string's length along the road (m): five animals nose to tail and the driver (C) */
const STRING_M = 13, CAMEL_M = 16, CART_M = 9;

export interface Mover { key: string; kind: 'pack' | 'camel' | 'courier' | 'cart' | 'drum' | 'quarry' | 'foot'; e: number; n: number; heading: number; act: ActivityId; why: string;
  /** (D-570: the road folk's women and children: roadFolk.ts) */
  look: { id: number; sex: 'm' | 'f'; role: string; dress: 'worker' | 'median' | 'woman' | 'child'; origin: string; seed: number; age?: 'adult' | 'elder' | 'child' };
  /** D-570: who a road traveller is (roadFolk.ts's register): the household's head by name, the person's place in it, home and
   *  livelihood (for the dev overlay, and for the talk system once it reaches the crowd's extras) */
  life?: { name: string; role: string; home: string; livelihood: string };
  /** D-570: the population's pid when the traveller is one of its people (roadFolk.ts bindPids) */
  pid?: number }
export interface Route { pts: P2[]; cum: number[]; len: number }
export const route = (pts: P2[]): Route => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };
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

export interface TrafficSource { caravan(d: number): { h: number; sacks: number } | null; cal: { ctx(d: number): { couriers: { t: number; treasury: boolean }[]; deliveries: { t: number; id: string; qty: number; place: string }[];
  /** D-256: the day's events (E-61's drum arrivals), its sun, weather and month (the quarry's working day) */
  events?: { t: number; id: string; text: string }[]; sun?: { rise: number; set: number }; wx?: { wet: boolean; stormH: [number, number] | null }; month?: number; heatRest?: boolean } };
  /** D-570 (court setting): the court's tents, pitched as each household reaches its camp and struck on the leave day */
  court?: { tents: Tent[] } | null }
/** D-256: one drum's haul: the travel spans (absolute h) out and back, where it is along the routes */
export interface DrumHaul { key: string; arrive: number; out: [number, number][]; back: [number, number][]; seed: number }
export class Traffic {
  /** the routes (grid metres): the caravan in from the W to the stair foot and back to the stable; the south road in to the
   *  storehouse gate; the courier in to the stable and out on the south road */
  readonly routes: Record<'caravanIn' | 'caravanOut' | 'storeIn' | 'courierIn' | 'courierOut' | 'timberIn', Route>;
  private days = new Map<number, Mover[]>(); private plans = new Map<number, Plan[]>();
  /** D-256: the quarry (built on the rock: plain/quarries.ts), the drum route from its camp to the drum ground, and the hauls */
  quarry: QuarrySite | null = null; drumRoute: Route | null = null; private hauls = new Map<number, DrumHaul[]>();
  /** D-256: the quarries as built (world.ts passes plain/quarries.ts quarrySites); the haul's route from the first (Majdabad):
   *  out of the camp straight to the nearest point of the royal road, along it to its Terrace end, round the Terrace's W foot
   *  (clear of the tether lines of the stair foot, D-227) and along the N foot to the drum ground (C) */
  setQuarries(sites: QuarrySite[]) {
    const q = sites.find(x => x.id === 'quarry_majdabad') ?? sites[0]; if (!q) return; this.quarry = q;
    const W = FEAT.road_royal_west.polyline as P2[], camp = q.at(0, 24), f = foot(W, camp);
    this.drumRoute = route([camp, f.p, ...W.slice(0, f.i + 1).reverse(), [-200, 40], [-200, 250], [-60, 300], DRUM_GROUND]);
  }
  /** D-256: the day's drums: every E-61 arrival of the day is a haul that left the quarry a day or more before and arrives at
   *  the drum ground DRUM.before h before the construction counts it in at the yard; its travel spans are the daylight windows
   *  walked back from there (closed form; the calendar's days are computed forward as needed) */
  haulsArriving(d: number): DrumHaul[] {
    let H = this.hauls.get(d); if (H) return H; H = [];
    if (this.drumRoute && d >= 0) { const C = this.src.cal.ctx(d), R = this.drumRoute, need = R.len / DRUM.pace / 3600, needBack = R.len / DRUM.back / 3600;
      (C.events ?? []).filter(e => e.id === 'E-61' && /drum arrived from the quarry/.test(e.text)).forEach((e, k) => {
        const arrive = e.t - DRUM.before, out: [number, number][] = [], back: [number, number][] = [];
        let left = need, t = arrive; for (let g = 0; g < 12 && left > 1e-6; g++) { const dd = Math.floor(t / 24), w = this.window(dd); const b = Math.min(t, w[1]), a = Math.max(w[0], b - left); if (b > a) { out.unshift([a, b]); left -= b - a; } t = dd * 24 - 1e-6; }
        left = needBack; t = arrive + DRUM.hold; for (let g = 0; g < 12 && left > 1e-6; g++) { const dd = Math.floor(t / 24), w = this.window(dd); const a = Math.max(t, w[0]), b = Math.min(w[1], a + left); if (b > a) { back.push([a, b]); left -= b - a; } t = (dd + 1) * 24; }
        H!.push({ key: `dh${d}:${k}`, arrive, out, back, seed: d * 227 + k }); }); }
    this.hauls.set(d, H); if (this.hauls.size > 24) this.hauls.delete(this.hauls.keys().next().value!); return H;
  }
  /** the haul's daylight on day d (absolute h): sunrise + DRUM.dawn to sunset − DRUM.dusk */
  private window(d: number): [number, number] { const s = this.src.cal.ctx(Math.max(0, d)).sun ?? { rise: 6, set: 18 }; return [d * 24 + s.rise + DRUM.dawn, d * 24 + s.set - DRUM.dusk]; }
  /** metres along a set of spans at absolute time t (h), at a pace (m/s) */
  private static done(spans: [number, number][], t: number, pace: number) { let h = 0; for (const [a, b] of spans) h += Math.max(0, Math.min(t, b) - a); return h * 3600 * pace; }
  /** D-256: the drum hauls on the road at time t (h): the driver and his two yoke with the drum on its sledge, the gang beside
   *  it; halted by the road at night (unyoking at dusk, asleep by the sledge); at the drum ground the drum levered off; the
   *  team back to the quarry with the empty sledge */
  private drumMovers(t: number, out: Mover[], near?: { e: number; n: number; r: number }) {
    const R = this.drumRoute; if (!R) return; const d = Math.floor(t / 24);
    for (let dd = d; dd <= d + 4; dd++) for (const H of this.haulsArriving(dd)) {
      const t0 = H.out[0]?.[0] ?? H.arrive, tb = H.back.length ? H.back[H.back.length - 1][1] : H.arrive + DRUM.hold; if (t < t0 - 1.5 || t > tb) continue;
      const lastOut = H.out.length ? H.out[H.out.length - 1][1] : H.arrive, moving = (sp: [number, number][]) => sp.some(([a, b]) => t >= a && t < b);
      let s: number, dir = 1, act: ActivityId, why: string, gangAct: ActivityId, gangWhy: string;
      if (t < t0) { s = 0; act = 'tend_animals'; why = 'yoking the oxen to the drum sledge at the quarry camp'; gangAct = 'haul'; gangWhy = 'the gang roping the drum down on the sledge for the haul'; }
      else if (t <= lastOut + 1e-9) { s = Traffic.done(H.out, t, DRUM.pace); if (moving(H.out)) { act = 'walk'; why = 'driving two yoke of oxen dragging a column drum on its sledge from the quarry to the Terrace'; gangAct = 'walk'; gangWhy = 'walking beside the drum sledge with the levers and the rollers'; }
        else { const D0 = Math.floor(t / 24), lt = t - D0 * 24, [w0, w1] = this.window(D0).map(x => x - D0 * 24); const eve = lt >= w1 && lt < w1 + 1.2, morn = lt >= w0 - 0.9 && lt < w0;
          act = eve || morn ? 'tend_animals' : 'sleep'; why = eve ? 'unyoking the oxen by the drum sledge at the halt, giving them straw and water' : morn ? 'yoking the oxen to the drum sledge at first light' : 'asleep by the drum sledge where the haul halted for the night';
          gangAct = eve || morn ? 'eat' : 'sleep'; gangWhy = eve ? 'the evening meal by the drum sledge at the halt' : morn ? 'bread before the road, by the drum sledge' : 'asleep by the drum sledge where the haul halted for the night'; } }
      else if (t < H.arrive + DRUM.hold) { s = R.len; act = 'tend_animals'; why = 'holding the oxen at the drum ground while the drum is levered off the sledge'; gangAct = 'haul'; gangWhy = 'levering the drum off the sledge at the drum ground, for the gang of the Terrace to take in'; }
      else { dir = -1; s = R.len - Traffic.done(H.back, t, DRUM.back);
        if (moving(H.back)) { act = 'walk'; why = 'driving the oxen back to the quarry with the empty sledge'; gangAct = 'walk'; gangWhy = 'walking back to the quarry beside the empty sledge'; }
        else { act = 'sleep'; why = 'asleep by the empty sledge where the team halted for the night'; gangAct = 'sleep'; gangWhy = 'asleep by the empty sledge where the team halted for the night'; } }
      const a = along(R, s), hd = dir > 0 ? a.heading : a.heading + Math.PI;
      if (near && Math.hypot(a.e - near.e, a.n - near.n) > near.r + 30) continue;
      const look = (i: number) => ({ id: -52000 - ((H.seed * 7 + i) % 8000), sex: 'm' as const, role: i ? 'porter' : 'mason', dress: 'worker' as const, origin: 'Persian', seed: 70000 + ((H.seed * 13 + i) % 90000) });
      out.push({ key: H.key, kind: 'drum', e: a.e, n: a.n, heading: hd, act, why, look: look(0) });
      // the gang: beside the sledge (9 m behind the driver: activities.ts DRUM_BEHIND), a pace to either side (C)
      const c = Math.cos(hd), sn = Math.sin(hd);
      for (let i = 1; i <= DRUM.gang; i++) { const back = 7.5 + 1.6 * i, side = (i % 2 ? 1 : -1) * (2.2 + 0.4 * i);
        out.push({ key: `${H.key}:${i}`, kind: 'drum', e: a.e - sn * back + c * side, n: a.n - c * back - sn * side, heading: hd, act: gangAct, why: gangWhy, look: look(i) }); }
    }
  }
  /** D-256: the quarrymen at Majdabad at time t (h): on a working day (no rain, no storm on the working day) from sunrise +
   *  0.5 h to sunset − 0.5 h, a third cutting the channels at the face, the rest roughing out drums among the blocks, three of
   *  them loading a drum on the sledge in the hour before a haul leaves; the midday meal at the camp and, when the heat rests
   *  the work (E-64), a rest in the shade; the evening meal at the camp by the fire; asleep at the camp in the open in the warm
   *  months (May to September: C), in the cold months in the camp's huts, which are not built (B80: not drawn) */
  private quarryMovers(t: number, out: Mover[], near?: { e: number; n: number; r: number }) {
    const Q = this.quarry; if (!Q) return; if (near && Math.hypot(Q.x - near.e, Q.y - near.n) > near.r + 60) return;
    const d = Math.floor(t / 24), h = t - d * 24, C = this.src.cal.ctx(d), sun = C.sun ?? { rise: 6, set: 18 }, wx = C.wx, month = C.month ?? 1;
    const storm = !!wx?.stormH && wx.stormH[0] < sun.set && wx.stormH[1] > sun.rise, work = !wx?.wet && !storm;
    const w0 = sun.rise + 0.5, w1 = sun.set - 0.5, warm = [2, 3, 4, 5, 6].includes(month);
    // (a haul leaving today: its first span starts today, after the loading)
    const leaving = [d + 1, d + 2, d + 3].flatMap(x => this.haulsArriving(x)).find(H => H.out.length && Math.floor(H.out[0][0] / 24) === d);
    const camp = (i: number): P2 => Q.at(-6 + 3 * (i % 5), 22 + 2.2 * Math.floor(i / 5)), face = (i: number): P2 => Q.at(-11 + 4.5 * i, 2.9), block = (i: number): P2 => Q.at(-12 + 3.4 * (i % 8), 6 + 3.5 * Math.floor(i / 8));
    for (let i = 0; i < DRUM.quarrymen; i++) {
      const look = { id: -61000 - i, sex: 'm' as const, role: 'mason', dress: 'worker' as const, origin: 'Persian', seed: 81000 + i };
      let at: P2, head = Q.rot + Math.PI, act: ActivityId, why: string;
      const loading = leaving && i < 3 && h >= leaving.out[0][0] - d * 24 - 1.5 && h < leaving.out[0][0] - d * 24;
      if (work && h >= w0 && h < w1 && !(h >= 12 && h < 12.6) && !(C.heatRest && h >= 12.6 && h < 15)) {
        // (round the sledge the driver stands by at the camp: activities.ts sleep/tend_animals 'drum sledge' puts it 2.6 m to his side)
        if (loading) { const R0 = this.drumRoute!, a0 = along(R0, 0), sd = [[1.1, 0.6, Math.PI / 2], [4.1, 0.6, -Math.PI / 2], [2.6, 2.6, Math.PI]][i]; const c = Math.cos(a0.heading), sn = Math.sin(a0.heading);
          // (sd: metres to the driver's right, ahead, and the turn to face the sledge)
          at = [a0.e + c * sd[0] + sn * sd[1], a0.n - sn * sd[0] + c * sd[1]]; act = 'quarry'; why = 'loading a rough drum onto the sledge for the haul to the Terrace'; head = a0.heading + sd[2]; }
        else if (i < 5) { at = face(i); act = 'quarry'; why = 'cutting the channel round the next drum at the face'; head = Q.rot + Math.PI; }
        else { at = block(i - 5); act = 'quarry'; why = 'roughing out a column drum among the blocks'; head = Q.rot + Math.PI * (i % 2); } }
      else if (work && h >= 12 && h < 12.6) { at = camp(i); act = 'eat'; why = 'the midday meal of bread and onions at the quarry camp'; }
      else if (work && C.heatRest && h >= 12.6 && h < 15) { at = camp(i); act = 'rest'; why = 'resting in the shade of the rock through the heat'; }
      else if (h >= sun.set - 0.3 && h < sun.set + 0.6) { at = camp(i); act = 'eat'; why = 'the evening meal at the quarry camp by the fire'; }
      else if (!work && h >= w0 && h < w1) { if (wx?.wet) { at = Q.at(...hutSleepSpot(i)); act = 'rest'; why = 'sheltering from the rain in the quarry camp\'s hut'; head = Q.rot + (i % 2 ? Math.PI / 2 : -Math.PI / 2); } else { at = camp(i); act = 'rest'; why = 'at the quarry camp: no cutting today'; } }
      else if (warm && !wx?.wet) { at = camp(i); act = 'sleep'; why = 'asleep at the quarry camp in the open, in a cloak'; }
      else { at = Q.at(...hutSleepSpot(i)); act = 'sleep'; why = warm ? 'asleep in the quarry camp\'s hut out of the rain' : 'asleep in the quarry camp\'s stone hut, out of the cold'; head = Q.rot + (i % 2 ? Math.PI / 2 : -Math.PI / 2); } // (B80: the huts, quarries.ts QUARRY_HUTS)
      // (the men face the face (uphill, −v) at their work; at the camp they sit round it)
      const inHut = /hut/.test(why);
      out.push({ key: `qm:${i}`, kind: 'quarry', e: at[0], n: at[1], heading: act === 'quarry' || inHut ? head : Q.rot + 2 * Math.PI * (i / DRUM.quarrymen), act, why, look });
    }
  }
  /** D-570: the hinterland's people on the four roads (roadFolk.ts) */
  readonly folk: RoadFolk;
  constructor(private seed: number, private src: TrafficSource, plan: TownPlan | null) {
    this.folk = new RoadFolk(seed, src.cal, plan); if (src.court?.tents?.length) this.buildTrain(src.court.tents, plan);
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
      // session 9 (G77): the roof timbers come in along the royal road and round the Terrace's W foot to the drum ground (C)
      timberIn: route([...wIn, [-200, 40], [-200, 250], [-60, 300], DRUM_GROUND]),
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
    // session 9 (G77): roof timber for the building works: in the dry months (Apr-Oct) a train of 2-3 ox carts of beams on about one day
    // in nine, arriving at the drum ground between 09:00 and 16:00, unloaded in ~1.5 h and driven back the way they came (C)
    { const mo = C.month, dry = mo === undefined ? true : mo >= 1 && mo <= 7; // (the calendar's regnal month: 1 = April)
      if (dry && R.timberIn && h01(this.seed, d, 77) < 1 / 9) { const n = 2 + (h01(this.seed, d, 78) < 0.5 ? 1 : 0), arrive = 9 + 7 * h01(this.seed, d, 79);
        for (let i = 0; i < n; i++) P.push({ key: `tb${d}:${i}`, kind: 'cart', in: R.timberIn, arrive, gap: i * CART_M, hold: 1.5, out: null, seed: d * 211 + i,
          whyIn: 'driving an ox cart of roof timbers to the drum ground for the building works', whyHold: 'holding the timber cart while the beams are levered off at the drum ground', whyOut: 'driving the emptied timber cart back to the royal road' }); } }
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
    this.drumMovers(t, out, near); this.quarryMovers(t, out, near); // (D-256)
    this.folk.at(t, out, near); // (D-570)
    this.trainMovers(t, out, near); // (D-570)
    return out;
  }
  /** D-570 (court setting; UD-09, UD-10 "king coming and leaving"): the court's baggage train. Every household that lodges in a
   *  tent brings its baggage along the royal road from the W (the court comes from Susa: the royal road, A; its baggage
   *  animals: HDT 7.40-41 on Xerxes' train, a claim, B; the rest C): a string of pack animals with a driver (camels for a
   *  pavilion's household, donkeys and mules for the others), reaching the camp half an hour before the tent is pitched
   *  (court.ts: the hour each household arrives), along the road to the point nearest its camp and across to the camp; on the
   *  leave day, after the tents are struck, the strings go back out along the road over the morning and the day (C) */
  train: { t0: number; dir: 1 | -1; R: Route; key: string; camel: boolean; seed: number }[] = []; private trainMax = 0;
  private buildTrain(tents: Tent[], plan: TownPlan | null) {
    const W = FEAT.road_royal_west.polyline as P2[], far = (W.length > 4 ? W.slice(0, 5) : W) as P2[], routes = new Map<string, Route>();
    const campC = new Map<string, P2>(); for (const t of tents) { const c = campC.get(t.camp); campC.set(t.camp, c ? [c[0] + t.e, c[1] + t.n] : [t.e, t.n]); }
    const nOf = new Map<string, number>(); for (const t of tents) nOf.set(t.camp, (nOf.get(t.camp) ?? 0) + 1);
    for (const [k, c] of campC) { const ce: P2 = [c[0] / nOf.get(k)!, c[1] / nOf.get(k)!], f = foot(far, ce);
      // (in along the road from two of its bends beyond the camp's turning, then off the road to the camp's edge facing it, where
      // its picket lines stand: fauna.ts; not through the tents)
      const Rc = Math.max(...tents.filter(t => t.camp === k).map(t => Math.hypot(t.e - ce[0], t.n - ce[1]) + Math.max(t.w, t.d))) + 6, dd = Math.hypot(f.p[0] - ce[0], f.p[1] - ce[1]);
      const edge: P2 = dd > Rc ? [ce[0] + (f.p[0] - ce[0]) * Rc / dd, ce[1] + (f.p[1] - ce[1]) * Rc / dd] : f.p;
      const L = far.slice(f.i + 1).reverse(), direct = route([...L.slice(Math.max(0, L.length - 2)), f.p, edge]);
      // (a camp S of the royal road whose straight leg off it would cross the town's plots: in along the royal road to the
      // Terrace's W foot and out along the south road to the point nearest the camp; the first route clear of the plots wins)
      const S = FEAT.road_south_tirazzish.polyline as P2[], fs = foot(S, ce), ds = Math.hypot(fs.p[0] - ce[0], fs.p[1] - ce[1]);
      const edgeS: P2 = ds > Rc ? [ce[0] + (fs.p[0] - ce[0]) * Rc / ds, ce[1] + (fs.p[1] - ce[1]) * Rc / ds] : fs.p;
      const viaS = route([W[2], W[1], W[0], [-150, -120], ...S.slice(0, fs.i + 1), fs.p, edgeS]);
      const clear = (R: Route) => { if (!plan) return true; for (let x = 0; x <= R.len; x += 4) { const q = along(R, x); if (!openGround(plan, q.e, q.n)) return false; } return true; };
      routes.set(k, clear(direct) ? direct : clear(viaS) ? viaS : direct); }
    for (const t of tents) { const R = routes.get(t.camp)!, camel = t.kind === 'pavilion', pace = PACE.string, u = h01(this.seed, 8800 + t.i, 1);
      if (t.pitch !== undefined) this.train.push({ t0: t.pitch - 0.5 - R.len / pace / 3600, dir: 1, R, key: `ct${t.camp}:${t.i}:in`, camel, seed: t.i });
      if (t.strike !== undefined && t.strike < 1e8) this.train.push({ t0: t.strike + 0.5 + 7 * u * u, dir: -1, R, key: `ct${t.camp}:${t.i}:out`, camel, seed: t.i }); }
    this.train.sort((a, b) => a.t0 - b.t0); this.trainMax = Math.max(0, ...[...routes.values()].map(R => R.len / PACE.string / 3600));
  }
  private trainMovers(t: number, out: Mover[], near?: { e: number; n: number; r: number }) {
    const T = this.train; if (!T.length) return; let lo = 0, hi = T.length; const from = t - this.trainMax; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m].t0 < from) lo = m + 1; else hi = m; }
    for (let i = lo; i < T.length && T[i].t0 <= t; i++) { const x = T[i], s = (t - x.t0) * 3600 * PACE.string; if (s > x.R.len) continue;
      const a = along(x.R, x.dir > 0 ? s : x.R.len - s), hd = x.dir > 0 ? a.heading : a.heading + Math.PI; if (near && Math.hypot(a.e - near.e, a.n - near.n) > near.r) continue;
      const why = x.camel ? (x.dir > 0 ? 'leading a string of Bactrian camels with the baggage of a household of the court to its camp' : 'leading a string of Bactrian camels with the court’s baggage out along the royal road, the court leaving')
        : (x.dir > 0 ? 'leading a string of pack donkeys with the baggage of a household of the court to its camp' : 'leading a string of pack donkeys with the court’s baggage out along the royal road, the court leaving');
      out.push({ key: x.key, kind: x.camel ? 'camel' : 'pack', e: a.e, n: a.n, heading: hd, act: 'walk', why,
        look: { id: -470000 - (x.seed % 20000), sex: 'm', role: 'porter', dress: x.camel ? 'median' : 'worker', origin: x.camel ? 'Median' : 'Persian', seed: 600000 + (x.seed % 90000) } }); }
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
