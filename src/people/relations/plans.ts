// D-348 (ROADMAP 3e, step 2): the relations laid into the day plans. The meetings the relations layer records (world.ts
// Relations.meets) become parts of the two people's days: a suitor's visit to the woman's house (she sits with him, her
// family by) or his walk beside her to the well and back when she draws water; on the day the families agree a marriage,
// the groom and his father at the bride's house with her and her father (the bride-gift and the dowry); lovers' word apart
// in the lane. A meeting is laid only where both base days are free over its whole span, in daylight (the living errands'
// window, D-344), not minding a little one, not on the road; each side's part names the other (Seg.with), so the two are
// at the same place. Pure: a function of the seed, the population and the relations' state, like the plans themselves.
// The hook: Population.bonds (one line in Population.plan, under the economy's and the stranger's layers).
import { wetHours, type Population, type Seg, type Where } from '../population';
import type { ActivityId } from '../activities';
import { splice } from '../talk';
import { MINDING, reasonOk } from '../planCheck';
import type { Relations, Meet } from './world';

const FREE = new Set<ActivityId>(['rest', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
const DAY_START = 8, DAY_END = 17.5;
const free = (s: Seg) => FREE.has(s.act) && !/the heat|household/.test(s.why) && s.where !== 'road' && s.where !== 'away' && !s.place.startsWith('@') && s.with === undefined && !MINDING.test(s.why);
// (D-359: each part tagged, so the dev overlay and the visibility count (tools/dev/visible_week.ts) find it)
const sg = (t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where, withP?: number): Seg => ({ t0, t1, place, act, why, where, ...(withP !== undefined ? { with: withP } : {}), ev: 'D-348 relations (C)' });
interface Lay { h0: number; h1: number; segs: Seg[]; meet: Meet }
/** a stretch of the day a meeting may take: dry, and not beside the rest through the heat (a gap in it would break the stretch) */
function clear(P: Population, base: Seg[], d: number, t0: number, t1: number) {
  if (wetHours(P.cal.ctx(d).wx, t0 - 0.25, t1 + 0.25) > 0) return false;
  return !base.some(s => /the heat/.test(s.why) && s.t1 > t0 - 0.6 && s.t0 < t1 + 0.6);
}

export class RelPlans {
  /** each day's meetings by person (the first of the day for each person is the one laid: no order of asking matters) */
  private idx = new Map<number, { by: Map<number, Meet[]>; first: Map<number, Meet> }>();
  private laidOf = new Map<Meet, [number, Lay][] | null>();
  private overlaid = new Map<string, Seg[]>();
  stats = { meets: 0, laid: 0 };
  constructor(readonly rel: Relations, readonly pop: Population) {}
  touches(pid: number, day: number) { return this.index(day).by.has(pid); }
  dueOf(pid: number, day: number) { return this.rel.dueOf(pid, day); }
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c) return c;
    let segs = base; for (const m of this.index(day).by.get(pid) ?? []) for (const [who, L] of this.layOf(m) ?? []) { if (who !== pid) continue;
      const over = base.filter(s => s.t1 > L.h0 + 1e-9 && s.t0 < L.h1 - 1e-9); if (over.length && over.every(free)) segs = splice(segs, L.h0, L.h1, L.segs); }
    if (this.overlaid.size > 20000) this.overlaid.clear(); this.overlaid.set(k, segs); return segs;
  }
  /** the day's meetings as laid (pid → its parts): for the tests and the dev overlay */
  lays(day: number) { const m = new Map<number, Lay[]>(); this.index(day); for (const x of this.rel.meets.get(day) ?? []) for (const [pid, L] of this.layOf(x) ?? []) (m.get(pid) ?? m.set(pid, []).get(pid)!).push(L); return m; }
  /** after a player act replays the relations (their meetings may change) */
  reset() { this.idx.clear(); this.laidOf.clear(); this.overlaid.clear(); }

  private index(d: number) {
    let x = this.idx.get(d); if (x) return x; this.rel.advance(d); x = { by: new Map(), first: new Map() }; this.idx.set(d, x); if (this.idx.size > 60) { const k = this.idx.keys().next().value!; for (const m of this.rel.meets.get(k) ?? []) this.laidOf.delete(m); this.idx.delete(k); }
    for (const m of this.rel.meets.get(d) ?? []) for (const p of [m.a, m.b, m.c, m.hostKin]) { if (p === undefined) continue; (x.by.get(p) ?? x.by.set(p, []).get(p)!).push(m); if (!x.first.has(p)) x.first.set(p, m); }
    return x;
  }
  private layOf(m: Meet) {
    if (this.laidOf.has(m)) return this.laidOf.get(m)!; const x = this.index(m.day); this.stats.meets++;
    const parts = [m.a, m.b].every(p => x.first.get(p) === m) ? this.lay(m, m.day, new Set([m.c, m.hostKin].filter((p): p is number => p !== undefined && x.first.get(p) !== m))) : null;
    if (parts) this.stats.laid++; this.laidOf.set(m, parts); return parts;
  }
  private where(h: number): Where { return this.pop.households[h]?.zone === 'plain' ? 'plain' : 'town'; }
  /** a visitor's part: walk there, the stay, walk back, within one free stretch of his base day */
  private visit(pid: number, d: number, place: string, W: Where, a: number, b: number, why: string, withP: number, meet: Meet): [number, Lay] | null {
    const P = this.pop, base = P.basePlan(pid, d);
    for (const s of base) { if (!free(s) || s.t0 > a || s.t1 < b) continue; const w = P.walkH(s.place, place, d, s.where, W); if (s.t0 > a - w + 1e-9 || s.t1 < b + w - 1e-9 || a - w < DAY_START || !clear(P, base, d, a - w, b + w)) continue;
      const segs = [...(w > 0.01 ? [sg(a - w, a, `road:${W}`, 'walk', `on the way to ${place.startsWith('well:') ? 'the well' : place.startsWith('lane:') ? 'the lane' : 'the house'}`, 'road')] : []), sg(a, b, place, 'talk', why, W, withP), ...(w > 0.01 ? [sg(b, b + w, `road:${s.where}`, 'walk', 'walking back', 'road')] : [])];
      if (!segs.every(x => x.where === 'road' || reasonOk(x.act, x.why))) return null; return [pid, { h0: a - w, h1: b + w, segs, meet }]; }
    return null;
  }
  /** a host's part: at home (or in the lane before the house), free over [a, b] */
  private host(pid: number, d: number, place: string, W: Where, a: number, b: number, why: string, withP: number, meet: Meet, atHome = true): [number, Lay] | null {
    const P = this.pop, home = P.households[P.home(pid, d)]?.home, base = P.basePlan(pid, d), s = base.find(x => x.t0 <= a + 1e-9 && x.t1 >= b - 1e-9);
    if (!s || !free(s) || (atHome && s.place !== home) || !clear(P, base, d, a, b)) return null; return [pid, { h0: a, h1: b, segs: [sg(a, b, place, 'talk', why, W, withP)], meet }];
  }
  private lay(x: Meet, d: number, busy: Set<number>): [number, Lay][] | null {
    const P = this.pop; // (busy: the companions who have another meeting first that day)
    // (the relations' own weddings move a bride by homeOf; the plans still keep her in her old house: the meeting is at the plans' house)
    const hh = P.home(x.b, d), H = P.households[hh]; if (!H || (H.zone !== 'town' && H.zone !== 'plain')) return null;
    const W = this.where(hh), home = H.home, lane = `lane:${H.q}`;
    const len = x.kind === 'negotiate' ? 1.5 : x.kind === 'court' ? 0.75 : 0.5;
    // the time: the first free stretch of the host's base day in daylight long enough for the meeting
    if (x.kind === 'court') { // a walk beside her to the well when she draws water there
      for (const s of P.basePlan(x.b, d)) { if (s.act !== 'draw_water' || !s.place.startsWith('well:') || s.with !== undefined || s.t0 < DAY_START || s.t1 > DAY_END || s.t1 - s.t0 < 0.1) continue;
        // (D-359: at her well, the one nearest her house: `well:<q>:<her house>`; a bare well:<q> is drawn at the visitor's own)
        const v = this.visit(x.a, d, `${s.place.split(':').slice(0, 2).join(':')}:${hh}`, W, s.t0, s.t1, 'talking with her by the well as she draws the water: courting', x.b, x); if (v) return [v]; } }
    for (const s of P.basePlan(x.b, d)) {
      if (!free(s) || s.place !== home) continue;
      for (let a = Math.max(s.t0, DAY_START + 0.5); a + len <= Math.min(s.t1, DAY_END); a += 0.5) {
        const b = a + len, parts: [number, Lay][] = [];
        if (x.kind === 'court') { const h = this.host(x.b, d, home, W, a, b, 'talking with her suitor, her family by', x.a, x); const v = h && this.visit(x.a, d, home, W, a, b, 'visiting her family’s house, courting her', x.b, x); if (!h || !v) continue; parts.push(h, v); }
        else if (x.kind === 'lovers') { const h = this.host(x.b, d, lane, W, a, b, 'talking apart in the lane with a lover', x.a, x); const v = h && this.visit(x.a, d, `${lane}:${hh}`, W, a, b, 'talking apart in the lane with a lover', x.b, x); if (!h || !v) continue; parts.push(h, v); } /* (D-359: the visitor at the lane outside her door) */
        else { const h = this.host(x.b, d, home, W, a, b, 'talking over the marriage with his family: the bride-gift and the dowry', x.a, x); const v = h && this.visit(x.a, d, home, W, a, b, 'visiting her father’s house to agree the marriage: the bride-gift and the dowry', x.b, x); if (!h || !v) continue; parts.push(h, v);
          if (x.hostKin !== undefined && !busy.has(x.hostKin)) { const k = this.host(x.hostKin, d, home, W, a, b, 'talking over the marriage of the daughter of the house with the groom’s family', x.a, x); if (k) parts.push(k); }
          if (x.c !== undefined && !busy.has(x.c)) { const c = this.visit(x.c, d, home, W, a, b, 'visiting the bride’s house with his son to agree the marriage', x.a, x); if (c) parts.push(c); } }
        return parts;
      }
    }
    return null;
  }
}
