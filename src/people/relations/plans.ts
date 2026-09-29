// D-348 (ROADMAP 3e, step 2): the relations laid into the day plans. The meetings the relations layer records (world.ts
// Relations.meets) become parts of the two people's days: a suitor's visit to the woman's house (she sits with him, her
// family by) or his walk beside her to the well and back when she draws water; on the day the families agree a marriage,
// the groom and his father at the bride's house with her and her father (the bride-gift and the dowry); lovers' word apart
// in the lane. A meeting is laid only where both base days are free over its whole span, in daylight (the living errands'
// window, D-344), not minding a little one, not on the road; each side's part names the other (Seg.with), so the two are
// at the same place. Pure: a function of the seed, the population and the relations' state, like the plans themselves.
// The hook: Population.bonds (one line in Population.plan, under the economy's and the stranger's layers).
import type { Population, Seg, Where } from '../population';
import type { ActivityId } from '../activities';
import { splice } from '../talk';
import { MINDING, reasonOk } from '../planCheck';
import type { Relations, Meet } from './world';

const FREE = new Set<ActivityId>(['rest', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
const DAY_START = 8, DAY_END = 17.5;
const free = (s: Seg) => FREE.has(s.act) && !/the heat/.test(s.why) && s.where !== 'road' && s.where !== 'away' && !s.place.startsWith('@') && s.with === undefined && !MINDING.test(s.why);
const sg = (t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where, withP?: number): Seg => ({ t0, t1, place, act, why, where, ...(withP !== undefined ? { with: withP } : {}) });
interface Lay { h0: number; h1: number; segs: Seg[]; meet: Meet }

export class RelPlans {
  private days = new Map<number, Map<number, Lay[]>>();
  private overlaid = new Map<string, Seg[]>();
  stats = { meets: 0, laid: 0 };
  constructor(readonly rel: Relations, readonly pop: Population) {}
  touches(pid: number, day: number) { return this.day(day).has(pid); }
  dueOf(pid: number, day: number) { return this.rel.dueOf(pid, day); }
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c) return c;
    let segs = base; for (const L of this.day(day).get(pid) ?? []) { const over = base.filter(s => s.t1 > L.h0 + 1e-9 && s.t0 < L.h1 - 1e-9); if (over.length && over.every(free)) segs = splice(segs, L.h0, L.h1, L.segs); }
    if (this.overlaid.size > 20000) this.overlaid.clear(); this.overlaid.set(k, segs); return segs;
  }
  /** the day's meetings as laid (pid → its parts): for the tests and the dev overlay */
  lays(day: number) { return this.day(day); }
  /** after a player act replays the relations (their meetings may change) */
  reset() { this.days.clear(); this.overlaid.clear(); }

  private day(d: number): Map<number, Lay[]> {
    let m = this.days.get(d); if (m) return m; this.rel.advance(d); m = new Map(); this.days.set(d, m); if (this.days.size > 30) this.days.delete(this.days.keys().next().value!);
    const busy = new Set<number>();
    for (const x of this.rel.meets.get(d) ?? []) { this.stats.meets++; const parts = this.lay(x, d, busy); if (!parts) continue; this.stats.laid++;
      for (const [pid, L] of parts) { busy.add(pid); (m.get(pid) ?? m.set(pid, []).get(pid)!).push(L); } }
    return m;
  }
  private where(h: number): Where { return this.pop.households[h]?.zone === 'plain' ? 'plain' : 'town'; }
  /** a visitor's part: walk there, the stay, walk back, within one free stretch of his base day */
  private visit(pid: number, d: number, place: string, W: Where, a: number, b: number, why: string, withP: number, meet: Meet): [number, Lay] | null {
    const P = this.pop, base = P.basePlan(pid, d);
    for (const s of base) { if (!free(s) || s.t0 > a || s.t1 < b) continue; const w = P.walkH(s.place, place, d, s.where, W); if (s.t0 > a - w + 1e-9 || s.t1 < b + w - 1e-9 || a - w < DAY_START) continue;
      const segs = [...(w > 0.01 ? [sg(a - w, a, `road:${W}`, 'walk', `on the way to ${place.startsWith('well:') ? 'the well' : place.startsWith('lane:') ? 'the lane' : 'the house'}`, 'road')] : []), sg(a, b, place, 'talk', why, W, withP), ...(w > 0.01 ? [sg(b, b + w, `road:${s.where}`, 'walk', 'walking back', 'road')] : [])];
      if (!segs.every(x => x.where === 'road' || reasonOk(x.act, x.why))) return null; return [pid, { h0: a - w, h1: b + w, segs, meet }]; }
    return null;
  }
  /** a host's part: at home (or in the lane before the house), free over [a, b] */
  private host(pid: number, d: number, place: string, W: Where, a: number, b: number, why: string, withP: number, meet: Meet, atHome = true): [number, Lay] | null {
    const P = this.pop, home = P.households[P.home(pid, d)]?.home, s = P.basePlan(pid, d).find(x => x.t0 <= a + 1e-9 && x.t1 >= b - 1e-9);
    if (!s || !free(s) || (atHome && s.place !== home)) return null; return [pid, { h0: a, h1: b, segs: [sg(a, b, place, 'talk', why, W, withP)], meet }];
  }
  private lay(x: Meet, d: number, busy: Set<number>): [number, Lay][] | null {
    const P = this.pop; if ([x.a, x.b, x.c, x.hostKin].some(p => p !== undefined && busy.has(p))) return null;
    // (the relations' own weddings move a bride by homeOf; the plans still keep her in her old house: the meeting is at the plans' house)
    const hh = P.home(x.b, d), H = P.households[hh]; if (!H || (H.zone !== 'town' && H.zone !== 'plain')) return null;
    const W = this.where(hh), home = H.home, lane = `lane:${H.q}`;
    const len = x.kind === 'negotiate' ? 1.5 : x.kind === 'court' ? 0.75 : 0.5;
    // the time: the first free stretch of the host's base day in daylight long enough for the meeting
    if (x.kind === 'court') { // a walk beside her to the well when she draws water there
      for (const s of P.basePlan(x.b, d)) { if (s.act !== 'draw_water' || !s.place.startsWith('well:') || s.with !== undefined || s.t0 < DAY_START || s.t1 > DAY_END || s.t1 - s.t0 < 0.1) continue;
        const v = this.visit(x.a, d, s.place, W, s.t0, s.t1, 'talking with her by the well as she draws the water: courting', x.b, x); if (v) return [v]; } }
    for (const s of P.basePlan(x.b, d)) {
      if (!free(s) || s.place !== home) continue;
      for (let a = Math.max(s.t0, DAY_START + 0.5); a + len <= Math.min(s.t1, DAY_END); a += 0.5) {
        const b = a + len, parts: [number, Lay][] = [];
        if (x.kind === 'court') { const h = this.host(x.b, d, home, W, a, b, 'talking with her suitor, her family by', x.a, x); const v = h && this.visit(x.a, d, home, W, a, b, 'visiting her family’s house, courting her', x.b, x); if (!h || !v) continue; parts.push(h, v); }
        else if (x.kind === 'lovers') { const h = this.host(x.b, d, lane, W, a, b, 'talking apart in the lane with a lover', x.a, x); const v = h && this.visit(x.a, d, lane, W, a, b, 'talking apart in the lane with a lover', x.b, x); if (!h || !v) continue; parts.push(h, v); }
        else { const h = this.host(x.b, d, home, W, a, b, 'talking over the marriage with his family: the bride-gift and the dowry', x.a, x); const v = h && this.visit(x.a, d, home, W, a, b, 'visiting her father’s house to agree the marriage: the bride-gift and the dowry', x.b, x); if (!h || !v) continue; parts.push(h, v);
          if (x.hostKin !== undefined) { const k = this.host(x.hostKin, d, home, W, a, b, 'talking over the marriage of the daughter of the house with the groom’s family', x.a, x); if (k) parts.push(k); }
          if (x.c !== undefined) { const c = this.visit(x.c, d, home, W, a, b, 'visiting the bride’s house with his son to agree the marriage', x.a, x); if (c) parts.push(c); } }
        return parts;
      }
    }
    return null;
  }
}
