// D-340 (UD-26, UD-07/UD-08; T-F9): the economy's decisions are planned stretches of real people's days at real places.
// On a seeded week the economy's events are given to people and laid into their day plans (Population.plan): the test
// counts them by kind, checks every laid stretch is a performed activity, that the day stays whole (no gap, no overlap) and
// that nobody moves between places without a walk, that the same seed lays the same days, and that a save and a load lay
// them again the same. How the test could pass while the intent fails: steps laid at places nobody can reach, or laid only
// for the easy kinds (the market) while the court and the lenders stay empty; so the places are checked against the
// population's walking model and the kinds beyond the market are counted and required.
import { describe, it, expect, beforeAll } from 'vitest';
import { ACTIVITIES } from '../src/people/activities';
import type { PeopleSim } from '../src/people/sim';
import type { Seg } from '../src/people/population';
import { h32, salt } from '../src/people/hash';
import { makeSim, layDay } from '../tools/dev/econ_day';
import { checkPlan } from '../src/people/planCheck';
import { segAt } from '../src/people/population';

// two seeded weeks: one anywhere in the year, one in the lean months (Tebetu to Addaru, days 266-346: the stores run low and
// the crises gather there: the economy's own seasonality, tools/dev/econ_day.ts)
const SEED = 1, D0 = h32(SEED, salt('econ-plans-week')) % 347, D1 = 266 + (h32(SEED, salt('econ-plans-lean')) % 74);
const WEEK = [...Array(7).keys()].map(i => D0 + i), LEAN = [...Array(7).keys()].map(i => D1 + i);
let S: PeopleSim; const got: Record<string, [number, number]> = {}, lean: Record<string, [number, number]> = {}; const plans = new Map<string, Seg[]>();
beforeAll(() => {
  S = makeSim(SEED);
  for (const [days, into] of [[WEEK, got], [LEAN, lean]] as const) for (const d of days) { S.t = d * 24; const { by, plans: p } = layDay(S, d);
    for (const [k, [g, l]] of Object.entries(by)) { const b = into[k] ?? (into[k] = [0, 0]); b[0] += g; b[1] += l; } for (const [pid, x] of p) plans.set(`${pid}:${d}`, x); }
}, 600_000);

const econ = (s: Seg) => !!s.ev?.startsWith('D-340');
describe('the economy in the day plans (D-340)', () => {
  it('lays economy-driven steps on a seeded week, beyond the market', () => {
    const own = Object.entries(got).filter(([k]) => k !== 'with_mother').map(([, v]) => v), given = own.reduce((a, b) => a + b[0], 0), laid = own.reduce((a, b) => a + b[1], 0);
    console.log(`week ${D0}-${D0 + 6}: ${given} given, ${laid} laid; ${JSON.stringify(got)}`);
    // (a step is refused when it would break the plan checks: out in the rain, a meal missed, a baby unfed, too long on foot)
    expect(laid).toBeGreaterThanOrEqual(120);
    expect(laid / given).toBeGreaterThanOrEqual(0.6);
    const beyond = Object.entries(got).filter(([k, [, l]]) => l > 0 && !/^(buy|buy_fuel|sell)$/.test(k)).map(([k]) => k);
    expect(beyond.length).toBeGreaterThanOrEqual(3);
  });
  it('in a seeded lean week the lenders, the day hire, the petitions, the thieves and the court are in the plans', () => {
    const laid = (k: string) => lean[k]?.[1] ?? 0;
    console.log(`lean week ${D1}-${D1 + 6}: ${JSON.stringify(lean)}`);
    const crisis = ['loan', 'loan_refused', 'wage_work', 'petition', 'relief', 'petition_refused', 'theft', 'robbed', 'accusation', 'arrest', 'let_go', 'suit', 'time_granted', 'debt_labour', 'acquitted', 'fined', 'beaten', 'bound_labour', 'kin_help', 'house_fire', 'neighbours_help', 'pledge_seized'];
    expect(crisis.filter(k => laid(k) > 0).length).toBeGreaterThanOrEqual(8);
    expect(laid('theft') + laid('arrest') + laid('accusation')).toBeGreaterThan(0);
    expect(laid('petition')).toBeGreaterThan(0); expect(laid('wage_work')).toBeGreaterThan(0);
    const all = Object.entries(lean).filter(([k]) => k !== 'with_mother').map(([, v]) => v).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]); expect(all[1] / all[0]).toBeGreaterThanOrEqual(0.6);
  });
  it('every laid stretch is performed, the day stays whole, and nobody moves without a walk', () => {
    let n = 0, bad: string[] = [];
    for (const [k, p] of plans) {
      for (let i = 0; i < p.length; i++) { const s = p[i]; if (!(s.act in ACTIVITIES)) bad.push(`${k} ${s.act} not an activity`); if (!(s.t1 > s.t0 - 1e-9)) bad.push(`${k} ${s.t0}-${s.t1}`);
        if (i && Math.abs(p[i - 1].t1 - s.t0) > 1e-6) bad.push(`${k} gap/overlap at ${s.t0}`); }
      if (Math.abs(p[0].t0) > 1e-6 || Math.abs(p[p.length - 1].t1 - 24) > 1e-6) bad.push(`${k} does not span the day: ${p[0].t0}-${p[p.length - 1].t1}`);
      const idx = p.map((s, i) => (econ(s) ? i : -1)).filter(i => i >= 0); if (!idx.length) continue; n++;
      // around each run of economy stretches: a change of place only across a walk
      const lo = Math.max(0, idx[0] - 1), hi = Math.min(p.length - 1, idx[idx.length - 1] + 1); let last: string | null = null, walked = false;
      for (let i = lo; i <= hi; i++) { const s = p[i]; if (s.where === 'road') { walked = true; continue; }
        if (last !== null && s.place !== last && !walked && !s.place.startsWith('@')) bad.push(`${k} ${last} -> ${s.place} at ${s.t0.toFixed(2)} without a walk`); last = s.place; walked = false; }
      // the plan checks (planCheck.ts) find nothing in the laid day that the day as the world made it did not have
      const [pid, d] = k.split(':').map(Number), count = (x: Seg[]) => { const m: Record<string, number> = {}; for (const i of checkPlan(S.pop, pid, d, x, null)) m[i.kind] = (m[i.kind] ?? 0) + 1; return m; };
      const b0 = count(S.pop.basePlan(pid, d)), b1 = count(p); for (const [kind, c] of Object.entries(b1)) if (c > (b0[kind] ?? 0)) bad.push(`${k} plan check ${kind}: ${checkPlan(S.pop, pid, d, p, null).filter(i => i.kind === kind).map(i => i.note).slice(-1)[0]?.slice(0, 140)}`);
      // a little one with someone is where that one is
      for (const s of p) if (s.with !== undefined && econ(s)) { const o = segAt(S.pop.plan(s.with, d), (s.t0 + s.t1) / 2); if (o.place !== s.place && !(o.where === 'road' && s.where === 'road')) bad.push(`${k} apart from ${s.with} at ${s.t0.toFixed(2)}`); }
      for (const s of p.filter(econ)) if (s.where !== 'road') { const w = S.pop.walkH('official_bldg', s.place, +k.split(':')[1], 'town', s.where); if (!Number.isFinite(w)) bad.push(`${k} ${s.place} unreachable`); }
    }
    console.log(`${n} person-days with economy steps checked; ${bad.length} problems`, bad.slice(0, 8));
    expect(n).toBeGreaterThan(100); expect(bad).toEqual([]);
  });
  it('the same seed lays the same days, and a save and a load lay them again', () => {
    // (D-347: a save keeps the economy as it stands and its recent days whole, not every day since the first: the plans laid
    // again are those of the save's own day, the last of the lean week)
    const d = LEAN[LEAN.length - 1], keys = [...plans.keys()].filter(k => +k.split(':')[1] === d && plans.get(k)!.some(econ)).sort().slice(0, 40);
    expect(keys.length).toBeGreaterThan(5);
    const T = makeSim(SEED); T.t = S.t; T.load(JSON.parse(JSON.stringify(S.save())));
    for (const k of keys.filter(x => +x.split(':')[1] === d)) { const [pid] = k.split(':').map(Number); expect(JSON.stringify(T.pop.plan(pid, d))).toBe(JSON.stringify(plans.get(k))); }
  }, 300_000);
});
