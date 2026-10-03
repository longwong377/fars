// D-570 (s17 C3, the user's UD-08/UD-09/UD-36: the roads busy at the right hours, every traveller with a purpose): the people
// of the hinterland on the four roads into Pārsa. Pārsa sat on the royal road (Susa to the plain, the stations of the PF
// travel texts: A for the road and its traffic in rations, B for its busyness), with the Pulvar valley up the Pasargadae road,
// the villages under Naqsh-e Rustam to the N and Tirazziš to the S. Beyond the modelled plain the roads run through villages
// the population (population.ts, ~44,000 of the plain) does not hold; their households are this file's register (C, D-207:
// the most probable fill where the sources are silent): per road ROAD_HH households, each with a home village up that road,
// a livelihood and its people (a man, his wife, a son, a daughter, now and then an old parent), all pure functions of
// (seed, road, household).
// Each day the calendar decides what the roads carry (EventCalendar.ctx: the month and its farm work, the weather, a festival,
// the court in residence): households come in to Pārsa in the morning with the season's goods (barley and straw after the
// harvest, figs and grapes in the late summer, brushwood and dung cakes in the cold months, cheese and eggs, oil, a goat to
// sell), to buy (ewes, a plough share's worth of barley), to visit kin, to hire on for the harvest; they go home in the
// afternoon with what the goods fetched (the same people, linked), or next morning after a night with kin. Travellers on the
// royal road pass through from Susa to the south and back with their strings. Some halt on the way (a rest, bread by the
// road). The hours are stratified, not looped: every inbound and every outbound stream on every road is filled so that no
// stretch of road near Pārsa stands empty for more than two minutes of dry daylight (tools/dev/road_census.ts measures it);
// in the rain the roads empty but for a few hurrying under their cloaks. All C (D-570).
// Drawn by world.ts as the crowd's extras through Traffic.at (traffic.ts), like the caravan drivers.
import settlement from '../data/settlement.json';
import namesData from '../data/names.json';
import type { ActivityId } from '../people/activities';
import type { TownPlan } from './settlement/plan';
import { toLocal } from './settlement/site';
import type { Route, Mover } from './traffic';
// (pure: no three.js, no world module at run time, so the population and the sim (a worker) can import this file; h01 is
// fauna.ts's hash, route/along traffic.ts's, openGround fauna.ts's, copied for that reason)
const h01 = (seed: number, a: number, b = 0) => { let h = (seed * 2654435761) ^ Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 13), 0x45d9f3b); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const route = (pts: [number, number][]): Route => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };
const along = (R: Route, s: number): { e: number; n: number; heading: number } => {
  const x = Math.max(0, Math.min(R.len, s)); let i = 1; while (i < R.cum.length - 1 && R.cum[i] < x) i++;
  const a = R.pts[i - 1], b = R.pts[i], L = R.cum[i] - R.cum[i - 1] || 1, f = (x - R.cum[i - 1]) / L;
  return { e: a[0] + (b[0] - a[0]) * f, n: a[1] + (b[1] - a[1]) * f, heading: Math.atan2(b[0] - a[0], b[1] - a[1]) }; };
const openGround = (plan: TownPlan, e: number, n: number) => { for (const s of plan.sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; if (s.cell[s.k(i, j)] >= 0) return false; } return true; };

type P2 = [number, number];
const FEAT = Object.fromEntries((settlement as any).features.map((f: any) => [f.id, f])) as Record<string, any>;
/** households on each road's register (C) */
export const ROAD_HH = 600;
/** the Terrace's middle (grid m) and the radius of "near Pārsa" the streams keep busy (C: what the Terrace's edge and the
 *  plain round it see) */
export const PARSA: P2 = [80, 30], NEAR = 2500;
/** the longest spacing (min) between two groups entering one stream in dry daylight: a group on foot takes ~4.4 min to pass
 *  a 250 m stretch, so ≤ 6 min keeps every stretch's empty spell under 2 min (C, measured: road_census.ts) */
export const MAX_SPACING = 5.6;
/** walking paces (m/s; C): on foot, with a loaded string, an ox cart, a family with small children */
export const FOLK_PACE = { foot: 1.25, string: 1.0, cart: 0.9, family: 1.05 } as const;
/** the stair foot's tether lines (terraceFoot.ts FOOT_LINES' N line) where the N roads' folk and the royal road's go in */
const FOOT_IN: P2 = [-104, 141];
/** the roads, how much each carries (roadLitter.ts's weights), where its people live, and where in Pārsa they go: the road's
 *  Pārsa end, then the way on foot to the place (C) */
const ROADS: { id: string; w: number; homes: string[]; tail: P2[]; to: string }[] = [
  { id: 'road_royal_west', w: 1, to: 'the stair foot', tail: [[-110, 60], FOOT_IN], homes: ['a village by the Kur bridge', 'a village of the Kur’s west bank', 'Bessitme on the royal road', 'a hamlet by the Bagh-e Firuzi', 'a village under the Kuh-e Ayub', 'a herders’ hamlet of the western hills'] },
  { id: 'road_south_tirazzish', w: 0.8, to: 'the stair foot', tail: [[-150, -120], [-130, 0], [-110, 60], FOOT_IN], homes: ['Tirazziš', 'a village of the southern plain', 'a hamlet by the salt flats', 'a village on the Tirazziš road', 'a potters’ village of the south'] },
  { id: 'road_pasargadae', w: 0.6, to: 'the stair foot', tail: [[150, 272], [-60, 300], [-130, 200], FOOT_IN], homes: ['a village of the Pulvar valley', 'Pasargadae', 'a village under the Tang-e Bulaghi', 'a hamlet of the Pulvar’s east bank'] },
  { id: 'road_naqsh_e_rustam', w: 0.5, to: 'the stair foot', tail: [[150, 272], [-60, 300], [-130, 200], FOOT_IN], homes: ['a village under Naqsh-e Rustam', 'a hamlet by the Pulvar ford', 'a village of the northern fields', 'a hamlet by the rock tombs'] },
];
const MEN = ((namesData as any).names as { name: string; sex: string }[]).filter(n => n.sex === 'm').map(n => n.name);

export type Livelihood = 'farmer' | 'herder' | 'potter' | 'gardener' | 'fuel' | 'oil' | 'weaver' | 'carter';
const LIVE: [Livelihood, number][] = [['farmer', 0.42], ['herder', 0.12], ['gardener', 0.12], ['fuel', 0.1], ['potter', 0.06], ['oil', 0.06], ['weaver', 0.06], ['carter', 0.06]];
export interface Household { road: number; hh: number; home: string; live: Livelihood; head: string; kids: number; elder: boolean }
/** a household of a road's register (pure: seed, road, index) */
export function household(seed: number, road: number, hh: number): Household {
  const u = (k: number) => h01(seed, 7000 + road * 1000 + hh, k), R = ROADS[road];
  let x = u(1), live: Livelihood = 'farmer'; for (const [l, p] of LIVE) { if (x < p) { live = l; break; } x -= p; }
  return { road, hh, home: R.homes[Math.floor(u(2) * R.homes.length)], live, head: MEN[Math.floor(u(3) * MEN.length)] ?? 'a man', kids: Math.floor(u(4) * 4), elder: u(5) < 0.25 };
}
export type Member = 'head' | 'wife' | 'son' | 'daughter' | 'elder';
/** the household's people (C): the man, his wife, a son and a daughter as the household has children, an old parent */
export const membersOf = (H: Household): Member[] => ['head', 'wife', ...(H.kids > 0 ? ['son'] : []), ...(H.kids > 1 ? ['daughter'] : []), ...(H.elder ? ['elder'] : [])] as Member[];
/** D-570: the hinterland's register for the population (pids, homes and days the sim knows): every household of the four roads
 *  and its people with their sex and age (pure in the seed; the ages C: the man 25-55, his wife 4-10 years younger, the son
 *  and the daughter 6-17, the old parent 58-75) */
export function hinterlandRegister(seed: number) {
  const out: { road: number; roadId: string; hh: number; home: string; live: Livelihood; members: { m: Member; sex: 'm' | 'f'; age: number; name: string | null }[] }[] = [];
  ROADS.forEach((R, ri) => { for (let hh = 0; hh < ROAD_HH; hh++) { const H = household(seed, ri, hh), u = (k: number) => h01(seed, 7500 + ri * 1000 + hh, k), man = 25 + Math.floor(30 * u(1));
    out.push({ road: ri, roadId: R.id, hh, home: H.home, live: H.live, members: membersOf(H).map(m => ({ m, sex: m === 'wife' || m === 'daughter' ? 'f' as const : 'm' as const, name: m === 'head' ? H.head : null,
      age: m === 'head' ? man : m === 'wife' ? Math.max(16, man - 4 - Math.floor(6 * u(2))) : m === 'elder' ? 58 + Math.floor(17 * u(3)) : 6 + Math.floor(11 * u(m === 'son' ? 4 : 5)) })) }); } });
  return out;
}
/** a member's look (the same person every day: seeded by road, household and member) */
const lookOf = (seed: number, H: Household, m: 'head' | 'wife' | 'son' | 'daughter' | 'elder' | 'hand', live = H.live): Mover['look'] => {
  const mi = ['head', 'wife', 'son', 'daughter', 'elder', 'hand'].indexOf(m), id = -200000 - ((H.road * ROAD_HH + H.hh) * 8 + mi), f = m === 'wife' || m === 'daughter';
  return { id, sex: f ? 'f' : 'm', role: live === 'herder' ? 'shepherd' : live === 'potter' || live === 'weaver' ? 'craftsman' : 'farmer', dress: m === 'son' || m === 'daughter' ? (h01(seed, -id, 9) < 0.5 ? 'child' : f ? 'woman' : 'worker') : f ? 'woman' : 'worker',
    origin: 'Persian', seed: 300000 + ((H.road * ROAD_HH + H.hh) * 8 + mi), age: m === 'elder' ? 'elder' : (m === 'son' || m === 'daughter') && h01(seed, -id, 9) < 0.5 ? 'child' : 'adult' };
};

/** who a member of a household is, for the overlay and the talk system: the head by his attested name, the others by him */
export const lifeOf = (H: Household, m: 'head' | 'wife' | 'son' | 'daughter' | 'elder'): Mover['life'] => ({ name: m === 'head' ? H.head : `${H.head}’s ${m === 'elder' ? 'old father' : m}`, role: m, home: H.home, livelihood: H.live });
/** what a trip is for, who goes and how they look on the road in and on the way home (C) */
interface Errand { kind: string; who: ('head' | 'wife' | 'son' | 'daughter' | 'elder')[]; pace: number; inAct: ActivityId[]; inWhy: string[]; outAct: ActivityId[]; outWhy: string[]; stay: [number, number]; overnight?: boolean }
/** the season's goods by regnal month (1 = Nisannu, about April; C: the plain's year, E-40..E-47) */
const GOODS: Record<Livelihood, (m: number) => string> = {
  farmer: m => m >= 3 && m <= 5 ? 'sacks of new barley' : m >= 6 && m <= 8 ? 'sacks of barley and lentils' : m >= 9 ? 'sacks of last year’s barley' : 'sacks of barley and chickpeas',
  herder: m => m <= 2 ? 'cheeses and the spring’s wool' : m <= 6 ? 'cheeses and dried curd' : 'fleeces and goat hair',
  gardener: m => m <= 2 ? 'greens, onions and garlic' : m <= 4 ? 'onions, cucumbers and melons' : m <= 7 ? 'figs, grapes and pomegranates' : 'dried figs and raisins',
  fuel: m => m >= 7 ? 'dung cakes and brushwood' : 'brushwood',
  potter: () => 'jars and bowls packed in straw',
  oil: m => m >= 7 ? 'jars of new sesame oil' : 'jars of sesame oil',
  weaver: () => 'woollen cloth and mats',
  carter: m => m >= 3 && m <= 6 ? 'straw' : 'dung cakes',
};
function errandOf(seed: number, H: Household, d: number, month: number, festival: boolean): Errand {
  const u = (k: number) => h01(seed, 9100 + H.road * 1000 + H.hh, d * 16 + k), goods = GOODS[H.live](month), home = H.home;
  const town = ROADS[H.road].to === 'the town' ? 'the town' : 'Pārsa';
  if (festival && u(1) < 0.5) return { kind: 'festival', who: H.kids ? ['head', 'wife', 'son', 'daughter'] : ['head', 'wife'], pace: FOLK_PACE.family, stay: [4, 6],
    inAct: ['walk', 'walk', 'walk', 'walk'], inWhy: [`walking in to ${town} for the festival, the household in its best`, 'walking in for the festival with her husband', 'walking in for the festival with his parents', 'walking in for the festival with her mother'],
    outAct: ['walk', 'walk', 'walk', 'walk'], outWhy: [`walking home to ${home} from the festival`, `walking home to ${home} from the festival`, 'walking home from the festival, tired', 'walking home from the festival with her mother'] };
  const r = u(2);
  switch (H.live) {
    case 'farmer':
      if (r < 0.45) return { kind: 'string', who: ['head', 'son'], pace: FOLK_PACE.string, stay: [1.5, 3.5], inAct: ['walk', 'walk'], inWhy: [`leading a string of pack donkeys with ${goods} to sell in ${town}`, 'walking beside his father’s string of pack donkeys'],
        outAct: ['walk', 'carry_sack'], outWhy: [`leading the unloaded string home to ${home}, the ${goods.replace(/^sacks of /, '')} sold`, `carrying home a sack of salt and a new sickle bought in ${town}`] };
      if (r < 0.65) return { kind: 'ewes', who: ['head'], pace: FOLK_PACE.foot, stay: [1.5, 3], inAct: ['walk'], inWhy: [`walking in to ${town}’s exchange with silver to buy ewes for the flock`], outAct: ['walk'], outWhy: [`driving the ewes home to ${home}, bought at ${town}’s exchange`] };
      if (r < 0.82) return { kind: 'kin', who: H.kids ? ['wife', 'daughter'] : ['wife'], pace: FOLK_PACE.family, stay: [0, 0], overnight: true, inAct: ['carry_bread', 'walk'], inWhy: [`carrying a basket of bread and cheese to her kin in ${town}`, 'walking with her mother to see their kin'], outAct: ['walk', 'walk'], outWhy: [`walking home to ${home} after a night with her kin in ${town}`, 'walking home with her mother'] };
      return { kind: 'hire', who: ['head', 'son'], pace: FOLK_PACE.foot, stay: [6, 8], inAct: ['walk', 'walk'], inWhy: [month >= 2 && month <= 4 ? `walking in to ${town} to hire on for the harvest of the crown’s fields` : `walking in to ${town} to settle the household’s barley dues with the storekeeper`, 'walking in with his father'],
        outAct: ['carry_sack', 'walk'], outWhy: ['carrying home the day’s wage in barley in a sack', `walking home to ${home} with his father`] };
    case 'herder':
      // (D-570, V3's 'driving a flock': the household's wethers driven in to the exchange, the man and his son, home with the barley)
      if (r < 0.3) return { kind: 'flock', who: H.kids ? ['head', 'son'] : ['head'], pace: 0.85, stay: [1.5, 3], inAct: ['walk', 'walk'], inWhy: [`driving a flock of wethers to sell at ${town}’s exchange`, 'walking behind the flock with his father, his sling ready'],
        outAct: ['carry_sack', 'walk'], outWhy: [`carrying home to ${home} the barley the wethers fetched`, `walking home to ${home} with his father`] };
      if (r < 0.6) return { kind: 'goat', who: ['head'], pace: FOLK_PACE.foot, stay: [1.5, 3], inAct: ['walk'], inWhy: [`leading a goat to sell at ${town}’s exchange`], outAct: ['carry_sack'], outWhy: [`carrying home the barley the goat fetched, to ${home}`] };
      return { kind: 'basket', who: H.kids ? ['wife', 'daughter'] : ['wife'], pace: FOLK_PACE.foot, stay: [1.5, 3], inAct: ['carry_bread', 'carry_jar_head'], inWhy: [`carrying a basket of ${goods} to sell in ${town}`, 'carrying a jar of buttermilk on her head to sell'], outAct: ['walk', 'walk'], outWhy: [`walking home to ${home} with salt and a little silver for the ${goods.split(' ')[0]}`, 'walking home beside her mother'] };
    case 'gardener':
      return { kind: 'basket', who: H.kids ? ['wife', 'son'] : ['wife'], pace: FOLK_PACE.foot, stay: [1.5, 3.5], inAct: ['carry_bread', 'carry_sack'], inWhy: [`carrying a basket of ${goods} to sell in ${town}`, `carrying a sack of ${goods.split(',')[0]} for his mother`], outAct: ['walk', 'walk'], outWhy: [`walking home to ${home}, the basket empty`, 'walking home with his mother'] };
    case 'fuel':
      return { kind: 'fuel', who: H.kids ? ['head', 'son'] : ['head'], pace: FOLK_PACE.foot, stay: [1, 2.5], inAct: ['carry_sack', 'carry_sack'], inWhy: [`carrying bundles of brushwood to sell in ${town}`, 'carrying bundles of brushwood behind his father'], outAct: ['carry_sack', 'walk'], outWhy: [`carrying home to ${home} the barley the fuel fetched`, 'walking home behind his father'] };
    case 'potter':
      return { kind: 'string', who: ['head'], pace: FOLK_PACE.string, stay: [2, 4], inAct: ['walk'], inWhy: [`leading a string of pack donkeys with ${goods} to sell in ${town}`], outAct: ['walk'], outWhy: [`leading the unloaded string home to ${home}, the pots sold`] };
    case 'oil':
      return { kind: 'jar', who: H.kids ? ['head', 'son'] : ['head'], pace: FOLK_PACE.foot, stay: [1.5, 3], inAct: ['carry_jar', 'carry_jar'], inWhy: [`carrying ${goods.replace(/^jars/, 'a jar')} to sell in ${town}`, 'carrying a jar of oil behind his father'], outAct: ['carry_sack', 'walk'], outWhy: [`carrying home to ${home} the barley the oil fetched`, 'walking home behind his father'] };
    case 'weaver':
      return { kind: 'cloth', who: ['wife', 'head'], pace: FOLK_PACE.foot, stay: [2, 4], inAct: ['carry_sack', 'walk'], inWhy: [`carrying a bale of ${goods} to sell in ${town}`, `walking in with his wife to sell her cloth in ${town}`], outAct: ['walk', 'carry_sack'], outWhy: [`walking home to ${home}, the cloth sold`, 'carrying home the wool bought with the cloth’s silver'] };
    case 'carter': default:
      return { kind: 'cart', who: ['head'], pace: FOLK_PACE.cart, stay: [1.5, 3], inAct: ['walk'], inWhy: [`driving an ox cart of ${goods} to sell in ${town}`], outAct: ['walk'], outWhy: [`driving the emptied ox cart home to ${home}`] };
  }
}
/** the traders who pass through Pārsa on the royal road between Susa and the south (C): strings and camels */
const THROUGH = [
  { why: 'leading a string of pack donkeys with bales of cloth on the road from Susa to Tirazziš', back: 'leading a string of pack donkeys with dates and salt fish on the road from Tirazziš to Susa' },
  { why: 'leading a string of Bactrian camels with bales on the road from Susa to the south', back: 'leading a string of Bactrian camels with bales on the road from the south to Susa' },
];

interface Trip { key: string; road: number; dir: 1 | -1; path: Route; t0: number; pace: number; halt: { s: number; a: number; b: number; why: string; act: ActivityId } | null;
  people: { look: Mover['look']; act: ActivityId; why: string; life?: Mover['life']; m?: Member }[]; kind: Mover['kind']; hh?: number;
  /** where the trip runs along each road it uses: path s = s0 + sign * x, x the metres out from the road's Pārsa end */
  on: { ri: number; s0: number; sign: 1 | -1 }[];
  /** (cached by at(): the stay at the stair foot, and the hour after which the trip is over) */
  foot?: { stay: number; spot: P2 } | null; tEnd?: number }
/** the pass of a trip at path position s (absolute h), its halt counted */
const passAt = (T: Trip, s: number) => T.t0 + s / T.pace / 3600 + (T.halt && s > T.halt.s ? T.halt.b - T.halt.a : 0);
/** the spacing (min) the coverage fill keeps between passes at every reference point of a road, both ways together, in dry
 *  daylight: a group passes a 250 m stretch in ~3.7-5 min, so 5.1 min keeps its empty spells under 2 min, the slowest and the halts counted (C; road_census.ts) */
export const PASS_SPACING = 5.1;
type InRec = { H: Household; E: Errand; tArr: number; t0: number };
/** a day's road streams: per road, inbound and outbound trips; cached */
export class RoadFolk {
  private paths: { inn: Route; out: Route; road: number; tail: number }[] = []; private through: { sw: Route; ws: Route; w: number; c: number; s: number } | null = null;
  private days = new Map<number, Trip[]>(); private inbound = new Map<number, { trips: Trip[]; recs: Map<number, InRec[]> }>();
  /** the town plan, when the instance was made without it (the population's: Traffic gives it): keeps the verges off the plots */
  setPlan(plan: TownPlan | null) { if (plan && !this.plan) { this.plan = plan; this.verges.clear(); } }
  constructor(private seed: number, private cal: { ctx(d: number): any }, private plan: TownPlan | null = null) {
    for (const R of ROADS) { const cut = farCut(FEAT[R.id].polyline as P2[]), road = route(cut).len, tail = route([cut[0], ...R.tail]).len;
      const inn = route([...cut.slice().reverse(), ...R.tail]); this.paths.push({ inn, out: route([...inn.pts].reverse()), road, tail }); }
    // the through road: in along the royal road to its Pārsa end, round the Terrace's W foot to the south road and out (C)
    const W = farCut(FEAT.road_royal_west.polyline), S = farCut(FEAT.road_south_tirazzish.polyline);
    const sw = route([...W.slice().reverse(), [-150, -120], ...S]); this.through = { sw, ws: route([...sw.pts].reverse()), w: route(W).len, c: route([W[0], [-150, -120], S[0]]).len, s: route(S).len };
  }
  /** day d's inbound trips and the households they bring (cached; the next day's overnight guests go home from these) */
  private inboundOf(d: number): { trips: Trip[]; recs: Map<number, InRec[]> } {
    const hit = this.inbound.get(d); if (hit) return hit; const trips: Trip[] = [], recs = new Map<number, InRec[]>();
    const C = this.cal.ctx(Math.max(0, d)), sun = C.sun ?? { rise: 6, set: 18 }, month = C.month ?? 1, wx = C.wx ?? {}, fest = !!C.festival, base = d * 24;
    const wet = (h: number) => (!!wx.rain && h >= wx.rain[0] - 0.2 && h < wx.rain[1]) || (!!wx.stormH && h >= wx.stormH[0] - 0.3 && h < wx.stormH[1]);
    const dusty = (h: number) => !!wx.dustH && h >= wx.dustH[0] && h < wx.dustH[1], w0 = sun.rise - 1.0, w1 = sun.set - 0.1;
    // ---- inbound: households coming in, stratified from w0, the market's morning denser than the afternoon (C); in the rain a
    // few hurrying. A trader passing through takes some slots on the royal and the south roads
    ROADS.forEach((R, ri) => {
      const P = this.paths[ri], used = new Set<number>(); let k = 0;
      // (no household twice at once: a day's comers are drawn from the half of the register of the day's parity, the households
      // still at their kin's or going home from them from the other half: dayTrips)
      const pick = () => { for (let g = 0; g < 80; g++) { const hh = 2 * Math.floor(h01(this.seed, 31000 + ri * 97 + d, k++) * ROAD_HH / 2) + (d & 1); if (!used.has(hh) && !this.grazingOn(ri, hh, d)) { used.add(hh); return hh; } } return 2 * (k % (ROAD_HH / 2)) + (d & 1); };
      const list: InRec[] = []; recs.set(ri, list);
      for (let h = w0, g = 0; g < 400 && h < w1; g++) { const wt = wet(h);
        if (!wt || h01(this.seed, 33000 + ri, d * 400 + g) < 0.3) {
          if (ri < 2 && !wt && h01(this.seed, 34000 + ri * 7 + d, g) < 0.15) trips.push(this.throughTrip(d, ri * 1000 + g, base + h, ri === 0 ? 1 : -1));
          else { const H = household(this.seed, ri, pick()), E = errandOf(this.seed, H, d, month, fest), tr = this.trip(`rf${d}:${ri}:i${g}`, ri, 1, base + h, H, E, 'in'); trips.push(tr);
            list.push({ H, E, t0: base + h, tArr: passAt(tr, P.inn.len) }); } }
        h += 16 / 60 / Math.sqrt(R.w) * (0.6 + 0.8 * h01(this.seed, 32000 + ri * 97 + d, g)) * (h > 12.5 ? 2 : 1) * (wt ? 3 : 1) * (dusty(h) ? 1.3 : 1); }
    });
    const r = { trips, recs }; this.inbound.set(d, r); if (this.inbound.size > 6) this.inbound.delete(this.inbound.keys().next().value!); return r;
  }
  /** every trip of day d (pure in seed and the calendar's day) */
  dayTrips(d: number): Trip[] {
    let T = this.days.get(d); if (T) return T; T = [];
    const C = this.cal.ctx(Math.max(0, d)), sun = C.sun ?? { rise: 6, set: 18 }, month = C.month ?? 1, wx = C.wx ?? {}, fest = !!C.festival, base = d * 24;
    const wet = (h: number) => (!!wx.rain && h >= wx.rain[0] - 0.2 && h < wx.rain[1]) || (!!wx.stormH && h >= wx.stormH[0] - 0.3 && h < wx.stormH[1]);
    const dusty = (h: number) => !!wx.dustH && h >= wx.dustH[0] && h < wx.dustH[1], w0 = sun.rise - 1.0, w1 = sun.set - 0.1;
    const inb = this.inboundOf(d); for (const x of inb.trips) T.push(x);
    // ---- outbound: the same day's households going home after their stay; yesterday's overnight guests in the morning
    ROADS.forEach((R, ri) => {
      let g = 0;
      for (const [j, x] of (inb.recs.get(ri) ?? []).entries()) { if (x.E.overnight) continue; const t = x.tArr + x.E.stay[0] + (x.E.stay[1] - x.E.stay[0]) * h01(this.seed, 35000 + ri, d * 400 + j);
        // (the same household going home: no stay at the foot before it, it had its time there coming in)
        if (t - base < sun.set + 0.6 && !wet(t - base)) T!.push({ ...this.trip(`rf${d}:${ri}:o${g++}`, ri, -1, t, x.H, x.E, 'out'), foot: null }); }
      if (d > 0) for (const [j, x] of (this.inboundOf(d - 1).recs.get(ri) ?? []).entries()) if (x.E.overnight) { const t = sun.rise + 0.3 + 3 * h01(this.seed, 36000 + ri, d * 400 + j);
        if (!wet(t)) T!.push(this.trip(`rf${d}:${ri}:o${g++}`, ri, -1, base + t, x.H, x.E, 'out')); }
    });
    // ---- the coverage fill: at reference points every 125 m out to NEAR from each road's Pārsa end, no two passes (either way)
    // further apart than PASS_SPACING in dry daylight; a gap takes a household going home after nights with kin in Pārsa
    // (mornings and afternoons alike) or, before midday, one coming in late (C)
    ROADS.forEach((R, ri) => {
      const P = this.paths[ri], xs: number[] = []; for (let x = 60; x < P.road; x += 125) { const p = along(P.out, P.tail + x); if (Math.hypot(p.e - PARSA[0], p.n - PARSA[1]) < NEAR + 60) xs.push(x); }
      let f = 0; const h0 = base + sun.rise + 0.1, h1 = base + sun.set - 0.1;
      // (the fill's households: not those at their kin's (yesterday's and today's overnight guests), none on the road twice at
      // once: each household's trips today kept apart by an hour; a household takes a second trip only when the register runs
      // short, never overlapping its first)
      const away = new Set<number>([...(this.inboundOf(d - 1).recs.get(ri) ?? []), ...(inb.recs.get(ri) ?? [])].filter(x => x.E.overnight).map(x => x.H.hh));
      for (const v of this.vergeFlocks(d)) if (v.ri === ri) away.add(v.H.hh); // (the herders on the verges today)
      const busy = new Map<number, [number, number][]>(), span = (tr: Trip): [number, number] => [tr.t0 - 1, tr.t0 + tr.path.len / tr.pace / 3600 + (tr.halt ? tr.halt.b - tr.halt.a : 0) + 1];
      for (const tr of T!) if (tr.road === ri && tr.hh !== undefined) (busy.get(tr.hh) ?? busy.set(tr.hh, []).get(tr.hh)!).push(span(tr));
      let fk = 0;
      const pickF = (iv: [number, number]) => { for (const second of [false, true]) for (let g = 0; g < 400; g++) { const hh = Math.floor(h01(this.seed, 37000 + ri * 97 + d + (second ? 500 : 0), fk++) * ROAD_HH);
        const B = busy.get(hh); if (away.has(hh) || this.grazingOn(ri, hh, d) || (B && (!second || B.some(([a, b]) => a < iv[1] && b > iv[0])))) continue; (B ?? busy.set(hh, []).get(hh)!).push(iv); return hh; } return -1; };
      for (let pass = 0; pass < 3; pass++) for (const x of (pass === 1 ? [...xs].reverse() : xs)) {
        const ts: number[] = []; for (const tr of T!) for (const o of tr.on) if (o.ri === ri) { const s = o.s0 + o.sign * x; if (s >= 0 && s <= tr.path.len) ts.push(passAt(tr, s)); }
        ts.push(h0 - PASS_SPACING / 120, h1 + PASS_SPACING / 120); ts.sort((a, b) => a - b);
        for (let i = 1; i < ts.length; i++) { let gap = ts[i] - ts[i - 1]; if (gap * 60 <= PASS_SPACING) continue;
          const n = Math.ceil(gap * 60 / PASS_SPACING) - 1, t0g = ts[i - 1];
          for (let q = 1; q <= n; q++) { const at = t0g + gap * (q + 0.3 * (h01(this.seed, 41000 + ri, d * 4000 + f) - 0.5)) / (n + 1);
            if (wet(at - base)) continue;
            const inward = at - base < 11.5;
            const P0 = this.paths[ri], sx = inward ? P0.road - x : P0.tail + x, est: [number, number] = [at - sx / FOLK_PACE.cart / 3600 - 1, at + (P0.inn.len - sx) / FOLK_PACE.cart / 3600 + 1];
            const hh = pickF(est); if (hh < 0) continue;
            const H = household(this.seed, ri, hh), E0 = errandOf(this.seed, H, d - 1 - (f % 3), month, false);
            const E: Errand = inward ? E0 : { ...E0, overnight: true, outWhy: E0.overnight ? E0.outWhy : E0.outWhy.map(w => w.replace(/^walking home to ([^,]*)/, 'walking home to $1 after two nights with kin in Pārsa')) };
            let tr = this.trip(`rf${d}:${ri}:f${f}`, ri, inward ? 1 : -1, 0, H, E, inward ? 'in' : 'out'); const s = tr.on[0].s0 + tr.on[0].sign * x;
            tr = { ...tr, t0: at - s / tr.pace / 3600, halt: null }; T!.push(tr); f++; ts.splice(i, 0, at); i++; } }
      }
    });
    this.days.set(d, T); if (this.days.size > 4) this.days.delete(this.days.keys().next().value!); return T;
  }
  private trip(key: string, ri: number, dir: 1 | -1, t0: number, H: Household, E: Errand, leg: 'in' | 'out'): Trip {
    const P = this.paths[ri], path = dir === 1 ? P.inn : P.out, acts = leg === 'in' ? E.inAct : E.outAct, whys = leg === 'in' ? E.inWhy : E.outWhy;
    const has = membersOf(H), people = E.who.map((w, i) => ({ w, i })).filter(x => has.includes(x.w)).map(({ w, i }) => ({ look: lookOf(this.seed, H, w), act: acts[i] ?? 'walk', why: whys[i] ?? whys[0], life: lifeOf(H, w), m: w }));
    // a halt on the way (C: a third of the trips): bread or a rest by the road, in the outer half of the near road
    const u = h01(this.seed, 39000 + ri, Math.floor(t0 * 60)), halt = u < 0.33 && !/driving a flock/.test(whys[0] ?? '') ? (() => { const s = path.len * (dir === 1 ? 0.15 + 0.35 * u * 3 : 0.5 + 0.35 * u * 3), a = t0 + s / E.pace / 3600, dur = 0.12 + 0.25 * h01(this.seed, 39500 + ri, Math.floor(t0 * 60));
      const string = /string|ox cart|driving the ewes/.test(people[0]?.why ?? '');
      return { s, a, b: a + dur, act: (string ? 'tend_animals' : u < 0.16 ? 'eat' : 'rest') as ActivityId, why: string ? (/ox cart/.test(people[0].why) ? 'holding the ox cart by the road while the oxen rest' : 'holding the string by the road while the donkeys rest') : u < 0.16 ? 'bread and onions by the road on the way' : 'resting by the road on the way' }; })() : null;
    const kind: Mover['kind'] = /string of pack|unloaded string/.test(people[0]?.why ?? '') ? 'pack' : /ox cart/.test(people[0]?.why ?? '') ? 'cart' : 'foot';
    return { key, road: ri, dir, path, t0, pace: E.pace, halt, people, kind, hh: H.hh, on: [dir === 1 ? { ri, s0: P.road, sign: -1 } : { ri, s0: P.tail, sign: 1 }] };
  }
  private throughTrip(d: number, g: number, t0: number, dir: 1 | -1): Trip {
    const T = THROUGH[h01(this.seed, 40000 + d, g) < 0.25 ? 1 : 0], camel = T === THROUGH[1], seedN = d * 997 + g;
    const look: Mover['look'] = { id: -400000 - (seedN % 60000), sex: 'm', role: 'porter', dress: camel ? 'median' : 'worker', origin: camel ? (h01(this.seed, seedN, 3) < 0.5 ? 'Bactrian' : 'Arachosian') : 'Persian', seed: 500000 + (seedN % 90000), age: 'adult' };
    const X = this.through!, on: Trip['on'] = dir === 1 ? [{ ri: 0, s0: X.w, sign: -1 }, { ri: 1, s0: X.w + X.c, sign: 1 }] : [{ ri: 1, s0: X.s, sign: -1 }, { ri: 0, s0: X.s + X.c, sign: 1 }];
    return { key: `rt${d}:${g}`, road: dir === 1 ? 0 : 1, dir, path: dir === 1 ? X.sw : X.ws, t0, pace: FOLK_PACE.string, halt: null, people: [{ look, act: 'walk', why: dir === 1 ? T.why : T.back }], kind: camel ? 'camel' : 'pack', on };
  }
  /** the herders of the register grazing their flocks on the road verges on the way in (2-3 a road a dry day, out from the
   *  town's edge; a man and his son, from mid-morning for three to six hours, drifting along the verge: C) */
  private verges = new Map<number, { key: string; ri: number; x0: number; side: number; t0: number; t1: number; H: Household }[]>();
  vergeFlocks(d: number) {
    let V = this.verges.get(d); if (V) return V; V = []; const C = this.cal.ctx(Math.max(0, d)), sun = C.sun ?? { rise: 6, set: 18 }, wx = C.wx ?? {};
    if (!wx.wet) ROADS.forEach((R, ri) => { const P = this.paths[ri], n = 2 + (h01(this.seed, 43000 + ri, d) < 0.5 ? 1 : 0);
      const busy = new Set((this.inboundOf(d).recs.get(ri) ?? []).map(x => x.H.hh));
      for (let k = 0; k < n; k++) { const u = (q: number) => h01(this.seed, 43100 + ri * 10 + k, d * 8 + q); let hh = 2 * Math.floor(u(1) * ROAD_HH / 2) + (d & 1), H = household(this.seed, ri, hh);
        for (let g = 0; g < 80 && (H.live !== 'herder' || busy.has(hh) || this.grazingOn(ri, hh, d)); g++) { hh = (hh + 14) % ROAD_HH; H = household(this.seed, ri, hh); } busy.add(hh);
        const t0 = sun.rise + 1 + 3 * u(2), t1 = Math.min(sun.set - 1, t0 + 3 + 3 * u(3));
        // (a stretch of verge clear of the town's plots for the drift and the flock about the herder: both sides tried, then on)
        let x0 = 600 + (P.road - 900) * (k + u(4)) / n, side = (u(5) < 0.5 ? 1 : -1) * (10 + 4 * u(6)), ok = false;
        const clear = (x: number, sd: number) => { for (let dx = -40; dx <= 40; dx += 8) for (const w of [sd - 10 * Math.sign(sd), sd, sd + 12 * Math.sign(sd)]) { const a = along(P.out, P.tail + x + dx), c = Math.cos(a.heading), sn = Math.sin(a.heading);
          if (this.plan && !openGround(this.plan, a.e + c * w, a.n - sn * w)) return false; } return true; };
        for (let g = 0; g < 12 && !ok; g++) { if (clear(x0, side)) ok = true; else if (clear(x0, -side)) { side = -side; ok = true; } else x0 = 600 + ((x0 - 600 + 230) % Math.max(1, P.road - 900)); }
        if (ok) V!.push({ key: `rv${d}:${ri}:${k}`, ri, x0, side, t0: d * 24 + t0, t1: d * 24 + t1, H }); } });
    this.verges.set(d, V); if (this.verges.size > 4) this.verges.delete(this.verges.keys().next().value!); return V;
  }
  /** where a trip's group is at time t: its leader's point and heading, and what they do there when not walking (a halt, the
   *  stay at the stair foot); null when the trip is not under way */
  private pos(T: Trip, t: number): { a: { e: number; n: number; heading: number }; act: ActivityId | null; why: string; at: boolean } | null {
    // at the stair foot (the roads' Pārsa end): a third of the trips stay a while there first or last (selling, holding the string,
    // a word before the road home), at their own spot on the approach, walked to from the road's end (C)
    if (T.tEnd === undefined) { if (T.foot === undefined) T.foot = T.key.startsWith('rf') ? footStay(this.seed, T.key) : null; T.tEnd = T.t0 + T.path.len / T.pace / 3600 + (T.halt ? T.halt.b - T.halt.a : 0) + (T.foot ? 1 : 0); }
    if (t > T.tEnd || t < T.t0 - 1) return null; // (the stay and the walk to it are under an hour either side)
    const F = T.foot ?? null, walkF = F ? Math.hypot(F.spot[0] - FOOT_IN[0], F.spot[1] - FOOT_IN[1]) / T.pace / 3600 : 0;
    let s: number, act: ActivityId | null = null, why = '', at: { e: number; n: number; heading: number } | null = null;
    if (t < T.t0) { if (!F || T.dir !== -1 || t < T.t0 - walkF - F.stay) return null; // (outbound: the stay, then the walk to the road's end)
      const u = Math.max(0, (t - (T.t0 - walkF)) / Math.max(1e-6, walkF)); at = { e: F.spot[0] + (FOOT_IN[0] - F.spot[0]) * u, n: F.spot[1] + (FOOT_IN[1] - F.spot[1]) * u, heading: Math.atan2(FOOT_IN[0] - F.spot[0], FOOT_IN[1] - F.spot[1]) };
      if (t < T.t0 - walkF) { act = T.kind === 'pack' ? 'tend_animals' : T.kind === 'cart' ? 'tend_animals' : 'talk'; why = T.kind === 'pack' ? 'holding the string at the stair foot before the road home' : T.kind === 'cart' ? 'holding the ox cart at the stair foot before the road home' : 'a word with acquaintances at the stair foot before the road home'; } s = 0; }
    else if (T.halt && t >= T.halt.a && t < T.halt.b) { s = T.halt.s; act = T.halt.act; why = T.halt.why; }
    else s = ((t - T.t0) - (T.halt && t >= T.halt.b ? T.halt.b - T.halt.a : 0)) * 3600 * T.pace;
    if (s > T.path.len) { if (!F || T.dir !== 1) return null; const tEnd = T.t0 + T.path.len / T.pace / 3600 + (T.halt ? T.halt.b - T.halt.a : 0), u = (t - tEnd) / Math.max(1e-6, walkF);
      if (t > tEnd + walkF + F.stay) return null; at = { e: FOOT_IN[0] + (F.spot[0] - FOOT_IN[0]) * Math.min(1, u), n: FOOT_IN[1] + (F.spot[1] - FOOT_IN[1]) * Math.min(1, u), heading: Math.atan2(F.spot[0] - FOOT_IN[0], F.spot[1] - FOOT_IN[1]) };
      if (u >= 1) { act = T.kind === 'pack' ? 'tend_animals' : T.kind === 'cart' ? 'tend_animals' : 'exchange'; why = T.kind === 'pack' ? 'holding the string at the stair foot while the goods are sold' : T.kind === 'cart' ? 'holding the ox cart at the stair foot while the load is sold' : 'selling what was brought at the stair foot, to the porters, the guards and the scribes’ servants'; } }
    return { a: at ?? along(T.path, s), act, why, at: !!at };
  }
  /** the i-th of a trip's people where the group is: the others behind the first (a string's driver leads), a pace to the side */
  private member(T: Trip, i: number, a: { e: number; n: number; heading: number }, act: ActivityId | null, why: string, atFoot: boolean): Mover {
    const p = T.people[i], c = Math.cos(a.heading), sn = Math.sin(a.heading), string = T.kind !== 'foot', back = i === 0 ? 0 : (string ? 3.5 : 1.4) * i, side = i === 0 ? 0 : (i % 2 ? 0.8 : -0.8);
    return { key: `${T.key}:${i}`, kind: i === 0 ? T.kind : 'foot', e: a.e - sn * back + c * side, n: a.n - c * back - sn * side, heading: a.heading, act: act && (i === 0 || act !== 'tend_animals') ? act : act ? 'rest' : p.act,
      why: act ? (i === 0 ? why : atFoot ? 'waiting with the others at the stair foot' : 'resting by the road on the way') : p.why, look: p.look, life: p.life,
      ...(this.pidOf && p.m && T.hh !== undefined ? { pid: this.pidOf(T.road, T.hh, p.m) } : {}) };
  }
  // ---------------------------------------------------------------- D-570: the herders' flocks out on the land
  /** where flocks graze (world.ts gives them: fauna.ts grazingSites): the stubble after the harvest, the lower slopes of Kuh-e
   *  Rahmat and the hills, the steppe; none: no grazers drawn (their days still kept) */
  private graze: Record<'hill' | 'stubble' | 'steppe', P2[]> = { hill: [], stubble: [], steppe: [] };
  setGrazing(sites: { e: number; n: number; kind: 'hill' | 'stubble' | 'steppe' }[]) { this.graze = { hill: [], stubble: [], steppe: [] }; for (const x of sites) this.graze[x.kind].push([x.e, x.n]); }
  /** a herder household's grazing spell on day d (C): about half the register's herders take their flock out for twelve days in
   *  thirty-six, camping by it with the son: on the stubble after the harvest (regnal months 3-7, June to October), on the
   *  slopes in spring and autumn (1-2, 8-10), a few on the low steppe in the cold months (11-12, 0) and lambing at home else */
  grazingOn(ri: number, hh: number, d: number): { kind: 'hill' | 'stubble' | 'steppe'; spell: number } | null {
    const H = household(this.seed, ri, hh); if (H.live !== 'herder' || h01(this.seed, 44000 + ri, hh) >= 0.5) return null;
    const off = Math.floor(36 * h01(this.seed, 44100 + ri, hh)), k = Math.floor((d + off) / 36), day = (d + off) - k * 36; if (day >= 12) return null;
    const month = this.cal.ctx(Math.max(0, d)).month ?? 1, kind = month >= 3 && month <= 7 ? 'stubble' : (month >= 1 && month <= 2) || (month >= 8 && month <= 10) ? 'hill' : 'steppe';
    if (kind === 'steppe' && h01(this.seed, 44200 + ri, hh) > 0.4) return null;
    return { kind, spell: k };
  }
  /** the flocks out on day d with their herders' place: the spell's site, the flock drifting over it by day, folded at night */
  grazersOn(d: number) { const out: { ri: number; hh: number; H: Household; kind: 'hill' | 'stubble' | 'steppe'; at: P2; phi: number }[] = [];
    ROADS.forEach((_, ri) => { for (let hh = 0; hh < ROAD_HH; hh++) { const g = this.grazingOn(ri, hh, d); if (!g) continue; const L = this.graze[g.kind]; if (!L.length) continue;
      out.push({ ri, hh, H: household(this.seed, ri, hh), kind: g.kind, at: L[Math.floor(h01(this.seed, 44300 + ri * ROAD_HH + hh, g.spell) * L.length)], phi: 6.28 * h01(this.seed, 44400 + ri, hh) }); } });
    return out; }
  private grazeDay = -1; private grazeList: ReturnType<RoadFolk['grazersOn']> = [];
  private grazers(d: number) { if (d !== this.grazeDay) { this.grazeDay = d; this.grazeList = this.grazersOn(d); } return this.grazeList; }
  /** a grazer at time t: the herder (and his son) by the flock; the flock's middle for fauna.ts's far flocks */
  private grazerMovers(g: ReturnType<RoadFolk['grazersOn']>[number], t: number): Mover[] {
    const d = Math.floor(t / 24), h = t - d * 24, sun = this.cal.ctx(Math.max(0, d)).sun ?? { rise: 6, set: 18 }, day = h > sun.rise - 0.3 && h < sun.set + 0.3;
    const e = g.at[0] + (day ? 60 * Math.sin(t * 0.13 + g.phi) : 0), n = g.at[1] + (day ? 60 * Math.cos(t * 0.09 + g.phi) : 0), hd = t * 0.13 + g.phi;
    const what = g.kind === 'stubble' ? 'on the stubble of the harvested fields' : g.kind === 'hill' ? 'on the slopes' : 'on the steppe';
    const pid = (m: Member) => (this.pidOf ? { pid: this.pidOf(g.ri, g.hh, m) } : {});
    const out: Mover[] = [{ key: `rg${g.ri}:${g.hh}:0`, kind: 'foot', e, n, heading: hd, act: 'herd', why: day ? `grazing the household’s sheep and goats ${what}, out from ${g.H.home} with the flock` : 'watching the flock in its thorn fold through the night, by turns', look: lookOf(this.seed, g.H, 'head'), life: lifeOf(g.H, 'head'), ...pid('head') }];
    if (g.H.kids) out.push({ key: `rg${g.ri}:${g.hh}:1`, kind: 'foot', e: e + 11 * Math.cos(g.phi), n: n + 11 * Math.sin(g.phi), heading: hd + 1, act: day ? 'herd' : 'sleep', why: day ? 'with his father and the flock, keeping the strays in with his sling' : 'asleep by the fold in his cloak', look: lookOf(this.seed, g.H, 'son'), life: lifeOf(g.H, 'son'), ...pid('son') });
    return out;
  }
  /** the flocks out at time t, for fauna.ts to draw beyond the crowd's reach: middle, seed, folded */
  flocksAt(t: number): { e: number; n: number; seed: number; folded: boolean }[] {
    const d = Math.floor(t / 24); return this.grazers(d).map(g => { const m = this.grazerMovers(g, t)[0]; return { e: m.e, n: m.n + 2, seed: g.ri * ROAD_HH + g.hh, folded: m.act !== 'herd' || /night/.test(m.why) }; });
  }
  // ---------------------------------------------------------------- D-570: the road folk as people of the population
  /** (road, household, member) → the population's pid (-1: none); set by the population once it has made them */
  private pidOf: ((road: number, hh: number, m: Member) => number) | null = null;
  /** the population binds its pids: from then on Traffic leaves those people to the population view, which places them by spotOf */
  bindPids(f: (road: number, hh: number, m: Member) => number) { this.pidOf = f; }
  /** a household's trips of day d (indexed per day) */
  private byHH = new Map<number, Map<string, Trip[]>>();
  private tripsOf(road: number, hh: number, d: number): Trip[] {
    if (d < 0) return []; let M = this.byHH.get(d); if (!M) { M = new Map(); for (const T of this.dayTrips(d)) if (T.hh !== undefined) { const k = `${T.road}:${T.hh}`; (M.get(k) ?? M.set(k, []).get(k)!).push(T); }
      this.byHH.set(d, M); if (this.byHH.size > 4) this.byHH.delete(this.byHH.keys().next().value!); }
    return M.get(`${road}:${hh}`) ?? [];
  }
  /** where a member of the register is at time t (h) when on the road or at the stair foot (or on the verge with the flock), with
   *  what they do and why; null when they are at home or in Pārsa (off the map) */
  spotOf(road: number, hh: number, m: Member, t: number): (Mover & { moving: boolean }) | null {
    const d = Math.floor(t / 24);
    for (const dd of [d, d - 1]) for (const T of this.tripsOf(road, hh, dd)) { const i = T.people.findIndex(p => p.m === m); if (i < 0) continue; const q = this.pos(T, t); if (!q) continue;
      const mv = this.member(T, i, q.a, q.act, q.why, q.at); return { ...mv, moving: !q.act && !(q.at && mv.act !== 'walk') }; }
    if (m === 'head' || m === 'son') for (const g of this.grazers(d)) if (g.ri === road && g.hh === hh) { const mv = this.grazerMovers(g, t).find(x => x.key.endsWith(m === 'head' ? ':0' : ':1')); if (mv) return { ...mv, moving: false }; }
    for (const v of this.vergeFlocks(d)) if (v.ri === road && v.H.hh === hh && (m === 'head' || m === 'son') && t >= v.t0 && t <= v.t1) { const g = this.vergeMovers(v, t).find(x => x.key.endsWith(m === 'head' ? ':0' : ':1')); if (g) return { ...g, moving: false }; }
    return null;
  }
  /** a member's day (d) as the population's plan blocks: the trips (place `road:<road id>`, the person's own act and why, from
   *  the first moment they are on the road or at the stair foot to the last), and between them off the map at home, in Pārsa on
   *  the household's business, or at kin's in Pārsa overnight (C) */
  planOf(road: number, hh: number, m: Member, d: number): { t0: number; t1: number; place: string; act: ActivityId; why: string }[] {
    const H = household(this.seed, road, hh), R = ROADS[road], base = d * 24, out: { t0: number; t1: number; place: string; act: ActivityId; why: string }[] = [];
    const G = this.grazingOn(road, hh, d);
    if (G && (m === 'head' || m === 'son')) { // (out with the flock: by it all day, the fold at night; place graze:<kind>, popview asks spotOf)
      const sun = this.cal.ctx(Math.max(0, d)).sun ?? { rise: 6, set: 18 }, a = sun.rise - 0.3, b = sun.set + 0.3, pl = `graze:${G.kind}`;
      return [{ t0: 0, t1: a, place: pl, act: m === 'head' ? 'herd' : 'sleep', why: m === 'head' ? 'watching the flock in its thorn fold through the night, by turns' : 'asleep by the fold in his cloak' },
        { t0: a, t1: b, place: pl, act: 'herd', why: m === 'head' ? `grazing the household’s sheep and goats, out from ${H.home} with the flock` : 'with his father and the flock, keeping the strays in with his sling' },
        { t0: b, t1: 24, place: pl, act: m === 'head' ? 'herd' : 'sleep', why: m === 'head' ? 'watching the flock in its thorn fold through the night, by turns' : 'asleep by the fold in his cloak' }]; }
    const legs: { a: number; b: number; act: ActivityId; why: string; dir: 1 | -1 }[] = [];
    for (const T of this.tripsOf(road, hh, d)) { const p = T.people.find(x => x.m === m); if (!p) continue; this.pos(T, T.t0); const F = T.foot ?? null;
      const walkF = F ? Math.hypot(F.spot[0] - FOOT_IN[0], F.spot[1] - FOOT_IN[1]) / T.pace / 3600 : 0, run = T.path.len / T.pace / 3600 + (T.halt ? T.halt.b - T.halt.a : 0);
      const a = T.dir === -1 && F ? T.t0 - walkF - F.stay : T.t0, b = T.dir === 1 && F ? T.t0 + run + walkF + F.stay : T.t0 + run;
      legs.push({ a: a - base, b: b - base, act: p.act, why: p.why, dir: T.dir }); }
    for (const v of this.vergeFlocks(d)) if (v.ri === road && v.H.hh === hh && (m === 'head' || m === 'son')) legs.push({ a: v.t0 - base, b: v.t1 - base, act: 'herd', why: 'grazing the household’s flock on the road’s verge', dir: 1 });
    legs.sort((x, y) => x.a - y.a);
    const yday = (this.inboundOf(d - 1).recs.get(road) ?? []).some(x => x.E.overnight && x.H.hh === hh && x.E.who.includes(m));
    let t = 0, where = yday ? `at kin’s in Pārsa for the night` : `at home in ${H.home}`;
    for (const L of legs) { const a = Math.max(t, Math.max(0, L.a)); if (a > t + 1e-6) out.push({ t0: t, t1: a, place: `hinterland:${road}:${hh}`, act: 'offmap', why: where });
      const b = Math.min(24, Math.max(a, L.b)); if (b > a) out.push({ t0: a, t1: b, place: `road:${R.id}`, act: L.act, why: L.why }); t = b;
      where = L.dir === -1 ? `at home in ${H.home}` : L.why.startsWith('grazing') ? `at home in ${H.home}` : `in Pārsa on the household’s business`; }
    // (a comer with no road home today is at kin's in Pārsa for the night)
    if (where.startsWith('in Pārsa') && !legs.some(L => L.dir === -1 && L.a > 0)) where = `at kin’s in Pārsa for the night`;
    if (t < 24) out.push({ t0: t, t1: 24, place: `hinterland:${road}:${hh}`, act: 'offmap', why: where });
    return out;
  }
  /** the herder (and his son) on the verge at time t */
  private vergeMovers(v: { key: string; ri: number; x0: number; side: number; t0: number; t1: number; H: Household }, t: number): Mover[] {
    const P = this.paths[v.ri], x = v.x0 + 25 * Math.sin((t - v.t0) * 0.45), a = along(P.out, P.tail + x), c = Math.cos(a.heading), sn = Math.sin(a.heading), e = a.e + c * v.side, n = a.n - sn * v.side;
    const pid = (m: Member) => (this.pidOf ? { pid: this.pidOf(v.ri, v.H.hh, m) } : {});
    const out: Mover[] = [{ key: `${v.key}:0`, kind: 'foot', e, n, heading: a.heading + Math.PI / 2 * Math.sign(v.side), act: 'herd', why: `grazing the household’s sheep and goats on the road’s verge on the way in from ${v.H.home}, to sell wethers at Pārsa`, look: lookOf(this.seed, v.H, 'head'), life: lifeOf(v.H, 'head'), ...pid('head') }];
    if (v.H.kids) out.push({ key: `${v.key}:1`, kind: 'foot', e: e + c * Math.sign(v.side) * 9 + sn * 6, n: n - sn * Math.sign(v.side) * 9 + c * 6, heading: a.heading, act: 'herd', why: 'watching the flock on the verge with his father, keeping it off the road', look: lookOf(this.seed, v.H, 'son'), life: lifeOf(v.H, 'son'), ...pid('son') });
    return out;
  }
  /** everyone of the road streams at time t (h), within `near` (all if omitted), appended to `out`; `all`: the people bound to the
   *  population too (the census: the population view draws them in the game) */
  at(t: number, out: Mover[], near?: { e: number; n: number; r: number }, all = false) {
    const d = Math.floor(t / 24);
    for (const g of this.grazers(d)) for (const mv of this.grazerMovers(g, t)) { if (!all && (mv.pid ?? -1) >= 0) continue; if (near && Math.hypot(mv.e - near.e, mv.n - near.n) > near.r + 20) continue; out.push(mv); }
    for (const v of this.vergeFlocks(d)) { if (t < v.t0 || t > v.t1) continue; for (const mv of this.vergeMovers(v, t)) { if (!all && (mv.pid ?? -1) >= 0) continue;
      if (near && Math.hypot(mv.e - near.e, mv.n - near.n) > near.r + 20) continue; out.push(mv); } }
    for (const dd of [d - 1, d]) { if (dd < 0) continue; for (const T of this.dayTrips(dd)) {
      const q = this.pos(T, t); if (!q) continue; const { a, act, why, at } = q;
      if (near && Math.hypot(a.e - near.e, a.n - near.n) > near.r + 20) continue;
      T.people.forEach((p, i) => { if (!all && this.pidOf && p.m && T.hh !== undefined && this.pidOf(T.road, T.hh, p.m) >= 0) return; // (a person of the population: popview draws them, from spotOf)
        out.push(this.member(T, i, a, act, why, !!at)); });
    } }
    return out;
  }
}
/** a trip's stay at the stair foot (a third of the trips; 0.2-0.45 h) and its spot on the approach between the tether lines (C) */
export function footStay(seed: number, key: string): { stay: number; spot: P2 } | null {
  let h = 2166136261; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  if (h01(seed, h % 1000003, 1) >= 0.35) return null;
  return { stay: 0.2 + 0.25 * h01(seed, h % 1000003, 2), spot: [-148 + 40 * h01(seed, h % 1000003, 3), 104 + 30 * h01(seed, h % 1000003, 4)] };
}
/** a road's polyline cut where it leaves NEAR + 500 m of Pārsa (its Pārsa end first) */
function farCut(L: P2[]): P2[] {
  const out: P2[] = [L[0]], R = NEAR + 500;
  for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], da = Math.hypot(a[0] - PARSA[0], a[1] - PARSA[1]), db = Math.hypot(b[0] - PARSA[0], b[1] - PARSA[1]);
    if (db < R) { out.push(b); continue; }
    let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, p: P2 = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m]; if (Math.hypot(p[0] - PARSA[0], p[1] - PARSA[1]) < R) lo = m; else hi = m; }
    void da; out.push([a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo]); break; }
  return out;
}
