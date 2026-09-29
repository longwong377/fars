// D-347 (UD-26; ROADMAP 3d): laundry days and bathing in the day plans, so the clothes of the wardrobe (world.ts) are washed at
// a period-plausible rate and the people wash their bodies (tier C throughout: no text of the period gives the rate).
//
// LAUNDRY: every town and plain household has a wash day every 6-9 days (its own seeded rhythm, or the day after when nobody
// could go; C, by analogy with
// pre-modern households of the region, where the washing was a weekly or fortnightly women's task at the water): one of its
// women of 12 or more (else a man) takes the household's clothes to the quarter's water, washes them (1-1.5 h) and brings them
// home; the wardrobe washes every household garment nobody wears that day (world.ts LAUNDRY_HOUSE). A Persian household washes
// on the bank with water drawn up in a jar, never in the stream (Herodotus 1.138, a Greek claim: B; as D-292). Not on a wet day,
// a festival, a wedding or in mourning; a day with no free stretch goes without.
// BATHING: everyone of four or more bathes every 5-8 days (their own rhythm): at home from a basin of water in the courtyard
// (tend_body, as the morning wash; C); in the warm months (Ayyaru to Ulūlu) men and boys of the non-Persian households bathe in
// the quarter's canal instead (C; the Persians keep out of running water, B as above).
//
// PURE: a function of the seed, the day and the base day plans; nothing is saved. Population.plan lays it over the base plan
// (below the economy's steps and the stranger's), keeping clear of the living world's errands (LivingWorld.windows).
import { coldWear, dustWear, type Population, type Seg, type Where } from '../population';
import type { ActivityId } from '../activities';
import { u01, h32, salt } from '../hash';
import { splice } from '../talk';
import { MINDING, checkPlan } from '../planCheck';
import { dateOf } from '../calendar';

const S = salt('washing');
const FREE = new Set<ActivityId>(['rest', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
/** the laundry goes in daylight (8-17.5 h); a bath before the evening meal too (to 19.5 h) */
const LAUNDRY = { lo: 8, hi: 17.5, dur: [1, 1.5] }, BATH = { lo: 9, hi: 19.5, dur: [0.4, 0.7] };
export const LAUNDRY_WORDS = 'washing the household’s clothes at the water', LAUNDRY_WORDS_JAR = 'washing the household’s clothes at the water, on the bank, with water drawn up in a jar';
export const BATH_HOME = 'bathing at home from a basin of water in the courtyard', BATH_CANAL = 'bathing in the canal, the day’s dust washed off';
type Step = { kind: 'laundry' | 'bath' | 'bath_canal' };

export class WashPlans {
  private cache = new Map<string, Seg[]>();
  private washer = new Map<string, number>();
  /** laid and refused steps by kind (for the tests and the dev overlay) */
  readonly stats = { laundry: [0, 0], bath: [0, 0], bath_canal: [0, 0] } as Record<Step['kind'], [number, number]>;
  constructor(readonly pop: Population, readonly seed: number, private avoid: (pid: number, day: number) => [number, number][] = () => []) {}

  private zoneOk(h: number) { const H = this.pop.households[h]; return !!H && (H.zone === 'town' || H.zone === 'plain'); }
  private able(pid: number, d: number) { const P = this.pop, p = P.persons[pid]; return p.agent < 0 && P.present(pid, d) && !P.sick(pid, d) && !P.mourning(pid, d) && !P.weddingOf(pid, d) && !P.festDay(pid, d); }
  /** the household's wash day (its own rhythm of 6-9 days) */
  laundryDay(h: number, d: number) { const per = 6 + (h32(this.seed, S, h, 1) % 4); return (d + h32(this.seed, S, h, 2)) % per === 0; }
  /** who takes the washing to the water that day (-1: nobody) */
  washerOf(h: number, d: number, again = true): number {
    const k = `${h}:${d}:${again ? 1 : 0}`; const c = this.washer.get(k); if (c !== undefined) return c;
    let w = -1;
    // (the wash day, or the day after it when nobody could go on it: rain, a feast, no free hour)
    const due = this.laundryDay(h, d) || (again && d > 0 && this.laundryDay(h, d - 1) && this.washerOf(h, d - 1, false) < 0);
    if (this.zoneOk(h) && due && !this.pop.cal.ctx(d).wx.wet) {
      const P = this.pop, ms = P.membersOn(h, d).filter(x => P.ageOn(x, d) >= 12 && this.able(x, d));
      // (not on a day the house's own plans already take the washing to the water: a servant's round, a man's own)
      if (P.membersOn(h, d).some(x => P.present(x, d) && P.basePlan(x, d).some(s => s.act === 'wash'))) ms.length = 0;
      // the women first (from a seeded one on), then the men: the first whose day has room for it takes it
      const r = h32(this.seed, S, h, d, 3), rot = (xs: number[]) => xs.map((_, i) => xs[(i + r) % xs.length]);
      for (const c of [...rot(ms.filter(x => P.persons[x].sex === 'f')), ...rot(ms.filter(x => P.persons[x].sex !== 'f'))])
        if (this.lay(c, d, P.basePlan(c, d), { kind: 'laundry' }, this.avoid(c, d), this.checker(c, d, P.basePlan(c, d)))) { w = c; break; }
    }
    this.washer.set(k, w); if (this.washer.size > 200000) this.washer.clear(); return w;
  }
  private bathKind(pid: number, d: number): Step['kind'] | null {
    const P = this.pop, p = P.persons[pid]; if (P.ageOn(pid, d) < 4) return null;
    const per = 5 + (h32(this.seed, S, pid, 4) % 4); if ((d + h32(this.seed, S, pid, 5)) % per !== 0) return null;
    const h = P.home(pid, d); if (!this.zoneOk(h) || !this.able(pid, d)) return null;
    const m = (dateOf(d) as any).month as number, warm = m >= 2 && m <= 6;
    return warm && p.sex === 'm' && P.ageOn(pid, d) >= 6 && !P.households[h].persian && !this.pop.cal.ctx(d).wx.wet ? 'bath_canal' : 'bath';
  }
  private steps(pid: number, d: number): Step[] {
    const out: Step[] = []; const h = this.pop.home(pid, d);
    if (this.washerOf(h, d) === pid) out.push({ kind: 'laundry' });
    const b = this.bathKind(pid, d); if (b) out.push({ kind: b });
    return out;
  }

  // ------------------------------------------------------------------ Population.plan's hook
  touches(pid: number, d: number) { return this.checking === 0 && this.steps(pid, d).length > 0; }
  /** while a plan is checked, the others' plans it reads are their own days (no re-entry) */
  private checking = 0;
  overlay(pid: number, d: number, base: Seg[]): Seg[] {
    const k = `${pid}:${d}`, c = this.cache.get(k); if (c) return c;
    let segs = base; const busy = this.avoid(pid, d), ok = this.checker(pid, d, base);
    for (const st of this.steps(pid, d)) { const r = this.lay(pid, d, segs, st, busy, ok); this.stats[st.kind][r ? 0 : 1]++; if (r) segs = r; }
    this.cache.set(k, segs); if (this.cache.size > 60000) this.cache.clear(); return segs;
  }
  /** a laid day must add none of the plan checks' issues to the day as the world made it (planCheck.ts) */
  private checker(pid: number, d: number, base: Seg[]) { let iss: Map<string, number> | null = null;
    return (x: Seg[]) => { iss ??= this.issues(pid, d, base); for (const [kind, n] of this.issues(pid, d, x)) if (n > (iss.get(kind) ?? 0)) return false; return true; }; }
  private issues(pid: number, d: number, segs: Seg[]) { const m = new Map<string, number>(); this.checking++; try { for (const x of checkPlan(this.pop, pid, d, segs, null)) m.set(x.kind, (m.get(x.kind) ?? 0) + 1); } finally { this.checking--; } return m; }
  /** nobody is "with" this person in the window (a little one of the house, a toddler visiting from kin), and for a trip
   *  away no one of the house eats with them then (the household's meal words would lie) */
  private othersOk(pid: number, d: number, h0: number, h1: number, away: boolean) {
    const P = this.pop, hid = P.home(pid, d);
    if (away) for (const x of P.membersOn(hid, d)) if (x !== pid && P.present(x, d) && P.basePlan(x, d).some(s => s.act === 'eat' && s.t1 > h0 && s.t0 < h1)) return false;
    return nobodyWith(P, pid, d, h0, h1);
  }
  private lay(pid: number, d: number, segs: Seg[], st: Step, busy: [number, number][], ok: (x: Seg[]) => boolean): Seg[] | null {
    const P = this.pop, h = P.home(pid, d), H = P.households[h], W: Where = H.zone === 'plain' ? 'plain' : 'town';
    const win = st.kind === 'laundry' ? LAUNDRY : BATH, water = `canal:${H.q}`;
    const dur = win.dur[0] + (win.dur[1] - win.dur[0]) * u01(this.seed, S, pid, d, 6);
    for (const s of segs) {
      if (!FREE.has(s.act) || s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || s.with !== undefined || MINDING.test(s.why) || s.ev) continue;
      if (st.kind === 'bath' && s.place !== H.home) continue; // (the bath at home: from a stretch at home)
      const away = st.kind !== 'bath', w = away ? P.walkH(s.place, water, d, s.where, W) : 0;
      const m = away ? 0.05 : 0, h0 = Math.max(s.t0 + m, win.lo), h1 = h0 + 2 * w + dur; if (h1 > Math.min(s.t1 - m, win.hi)) continue; // (a few minutes there before and after: one walk is one walk)
      if (busy.some(([a, b]) => a < h1 && b > h0) || !this.othersOk(pid, d, h0, h1, away)) continue;
      const put = (x: Seg): Seg => x; // (dressed against the cold and the dust as the day's own stretches are: population.ts coldWear, dustWear)
      const mid: Seg[] = [];
      if (st.kind === 'bath') mid.push(put(sg(h0, h1, H.home, 'tend_body', BATH_HOME, s.where)));
      else {
        const why = st.kind === 'laundry' ? (H.persian ? LAUNDRY_WORDS_JAR : LAUNDRY_WORDS) : BATH_CANAL, act: ActivityId = st.kind === 'laundry' ? 'wash' : 'tend_body';
        if (w > 0.01) mid.push(put(sg(h0, h0 + w, `road:${W}`, st.kind === 'laundry' ? 'carry_sack' : 'walk', st.kind === 'laundry' ? 'carrying the washing to the water' : 'going down to the canal to bathe', 'road')));
        mid.push(put(sg(h0 + w, h0 + w + dur, water, act, why, W)));
        if (w > 0.01) mid.push(put(sg(h0 + w + dur, h1, `road:${s.where}`, st.kind === 'laundry' ? 'carry_sack' : 'walk', st.kind === 'laundry' ? 'carrying the washing home' : 'walking back from the canal', 'road')));
      }
      if (away) { const wx = P.cal.ctx(d).wx; dustWear(mid, wx); coldWear(mid, wx); } const out = splice(segs, h0, h1, mid); if (!ok(out)) continue; // (the plan checks find nothing new: planCheck.ts)
      return out;
    }
    return null;
  }
}
const RKIN = new WeakMap<Population, { rk: Map<number, number[]>; byQ: Map<string, number[]>; days: Map<string, Map<number, [number, number][]>> }>();
/** D-347: nobody is "with" this person between h0 and h1 in their own day: no little one of the house, and no toddler visiting
 *  from the houses that count this one as kin or from the houses of its members' friends (population.ts, a toddler's outing
 *  to a kinswoman's or a neighbour's house). The errands laid over a day (washing; the living world's; the economy's) keep to it */
export function nobodyWith(P: Population, pid: number, d: number, h0: number, h1: number, visitorsOnly = false, raw = false, houseOnly = false): boolean {
  const hid = P.home(pid, d), H = P.households[hid];
  if (!visitorsOnly) for (const x of P.membersOn(hid, d)) { if (x === pid || !P.present(x, d) || P.ageOn(x, d) >= 14) continue;
    for (const s of raw ? P.rawPlan(x, d) : P.basePlan(x, d)) if (s.with === pid && s.t1 > h0 && s.t0 < h1) return false; }
  // the hosts of a little one kept or visiting (a woman, a girl minding): of a house that is the child's kin (anywhere), or of the
  // same quarter (a neighbour minding it, a friend of its mother: population.ts); the children under 14 (their planners' own days)
  if (houseOnly) return true;
  let ix = RKIN.get(P); if (!ix) { const rk = new Map<number, number[]>(), byQ = new Map<string, number[]>(); for (const X of P.households) { for (const k of X.kin) (rk.get(k) ?? rk.set(k, []).get(k)!).push(X.id); const qk = `${X.zone}|${X.q}`; (byQ.get(qk) ?? byQ.set(qk, []).get(qk)!).push(X.id); }
    ix = { rk, byQ, days: new Map() }; RKIN.set(P, ix); }
  // (who is "with" whom among the children of the quarter and of the house's kin on the day, once per quarter and day)
  const key = `${H.zone}|${H.q}|${d}`; let w = ix.days.get(key);
  if (!w) { w = new Map(); if (ix.days.size > 400) ix.days.clear(); ix.days.set(key, w);
    for (const h of new Set([...(ix.byQ.get(`${H.zone}|${H.q}`) ?? []), ...(ix.rk.get(hid) ?? []), ...H.kin])) for (const x of P.membersOn(h, d)) { if (!P.present(x, d) || P.ageOn(x, d) >= 14) continue;
      for (const s of P.rawPlan(x, d)) if (s.with !== undefined && P.home(s.with, d) !== h) (w.get(s.with) ?? w.set(s.with, []).get(s.with)!).push([s.t0, s.t1]); } }
  return !(w.get(pid) ?? []).some(([a, b]) => b > h0 && a < h1);
}
function sg(t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where): Seg { return { t0: Math.min(24, t0), t1: Math.min(24, t1), place, act, why, where, ev: 'D-347' }; }
