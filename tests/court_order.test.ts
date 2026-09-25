// The court as an assembly (D-221; rubric s7 pass 2 item 7): with the court setting the king's spearmen stand in close
// files at their posts, the parties wait together at their own places before the Apadana's N stair in the order they go
// up (each called party led by an usher), the petitioners in lines, and those waiting face what they wait on. Measured in
// node over the population view's people (tests/lib/court_order.ts) at court mornings, audience mornings among them.
// Before D-221 (the same metric, days 30, 31, 33, 40 at 09:00-11:00): guards ordered 0.5 % of 1,941 (the posts strung out
// 2.0-3.8 m apart, stepped aside by whoever stood there first), party cohesion 8.6 % of 2,801 (members spread at random
// over the forecourt), mean cosine to the focus 0.009 and 18.6 % within 30° (random headings): tools/dev/court_order.ts.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan } from '../src/world/settlement/plan';
import { PopGeo } from '../src/people/popgeo';
import { PopView } from '../src/people/popview';
import { segAt } from '../src/people/population';
import { COURT, COURT_PLACES, COURT_SLOTS, courtKeepClear } from '../src/people/court';
import { courtOrder } from './lib/court_order';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid, sim: PeopleSim, geo: PopGeo, view: PopView;
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env, { court: true }); geo = new PopGeo({ pop: sim.pop, nav, town: buildTownPlan(), seed: 1 }); view = new PopView(sim, geo, 1);
}, 600_000);

describe('the court as an assembly (D-221)', () => {
  it('the posts of each line stand in close files: file_spacing_m apart, one heading, on walkable ground, clear of the parties’ places', () => {
    const S = COURT.day.file_spacing_m; expect(S).toBeGreaterThanOrEqual(0.8); expect(S).toBeLessThanOrEqual(1.3);
    const byLine = new Map<string, typeof COURT_PLACES>(); for (const p of COURT_PLACES) if (p.kind === 'post' && p.anchor) (byLine.get(p.anchor!) ?? byLine.set(p.anchor!, []).get(p.anchor!)!).push(p);
    for (const [line, ps] of byLine) { const hd = new Set(ps.map(p => p.heading)); expect(hd.size, line).toBe(1);
      for (let k = 1; k < ps.length; k++) expect(Math.hypot(ps[k].at[0] - ps[k - 1].at[0], ps[k].at[1] - ps[k - 1].at[1]), `${line} ${k}`).toBeCloseTo(S, 1);
      for (const p of ps) { expect(nav.walkable(p.at[0], p.at[1]), p.id).toBe(true); expect(courtKeepClear(p.at[0], p.at[1]) && Math.abs(p.at[0]) >= 6.8, p.id).toBe(false); } }
    expect(COURT_SLOTS.every(s => s.posts.length === 10)).toBe(true);
  });
  it('each day’s order: the parties called go up in turn, each with its own usher, never two before the throne at once; everyone with a place in the forecourt', () => {
    const K = sim.pop.court!; let turns = 0, ushered = 0;
    for (let d = 1; d < 116; d++) { const o = K.dayOrder(d); if (!o.turns.length) continue; const Kd = K.kingDay(d); expect(Kd.aud).toBe(true);
      o.turns.forEach((t, k) => { turns++; if (t.usher >= 0) ushered++; expect(t.tTurn).toBeGreaterThanOrEqual(Kd.a0); expect(t.tDone).toBeLessThanOrEqual(Kd.a1 + 1e-6); expect(t.tIn).toBeLessThan(t.tTurn);
        if (k) expect(t.tTurn).toBeGreaterThanOrEqual(o.turns[k - 1].tDone - 1e-9);
        const pa = K.parties[t.party]; expect(o.station.has(pa.i) || o.line.has(pa.i), `d${d} party ${pa.i}`).toBe(true); });
      expect(new Set(o.turns.map(t => t.usher).filter(u => u >= 0)).size).toBe(o.turns.filter(t => t.usher >= 0).length); }
    expect(turns).toBeGreaterThan(300); expect(ushered / turns).toBeGreaterThan(0.95);
    // the usher's plan: at the head of his party in the forecourt before its turn, before the king with it
    const d = 32, o = K.dayOrder(d), t = o.turns.find(x => x.usher >= 0)!, us = sim.pop.plan(t.usher, d), lead = sim.pop.plan(K.parties[t.party].members[0], d);
    expect(segAt(us, t.tIn - 0.1).place).toBe('forecourt_wait'); expect(segAt(lead, t.tIn - 0.1).place).toBe('forecourt_wait');
    expect(segAt(us, (t.tTurn + t.tDone) / 2).place).toBe('court_audience_front'); expect(segAt(lead, (t.tTurn + t.tDone) / 2).place).toBe('court_audience_front');
  });
  it('drawn: the spearmen in close files facing their line, the parties together, those waiting facing what they wait on (after D-221; the before values in the header)', () => {
    const rows: string[] = [], tot = { g: 0, go: 0, w: 0, wn: 0, fn: 0, fc: 0, f30: 0 };
    for (const [d, h] of [[30, 10], [32, 9.5], [32, 10], [38, 9], [43, 8.5]] as const) {
      const t = d * 24 + h; sim.jumpTo(t); view.settle(t, [10, 40]); const m = courtOrder(view, [10, 20], 140);
      rows.push(`day ${d} ${h}: guards ${m.guardsOrdered}/${m.guards} (median ${m.guardSpacingMedian.toFixed(2)} m), parties ${m.partyNear}/${m.waiting} in ${m.parties}, focus ${m.focusCos.toFixed(3)} / ${(100 * m.focus30).toFixed(1)} % of ${m.focusN}`);
      expect(m.guards).toBeGreaterThan(100); expect(m.guardShare, `day ${d} ${h}`).toBeGreaterThanOrEqual(0.8); expect(m.guardSpacingMedian).toBeCloseTo(COURT.day.file_spacing_m, 1);
      expect(m.waiting).toBeGreaterThan(100); expect(m.partyShare, `day ${d} ${h}`).toBeGreaterThanOrEqual(0.9);
      expect(m.focusCos).toBeGreaterThanOrEqual(0.95); expect(m.focus30).toBeGreaterThanOrEqual(0.95);
      tot.g += m.guards; tot.go += m.guardsOrdered; tot.w += m.waiting; tot.wn += m.partyNear; tot.fn += m.focusN; tot.fc += m.focusCos * m.focusN; tot.f30 += m.focus30 * m.focusN; }
    console.log(rows.join('\n'));
    // (before D-221: 0.5 %, 8.6 %, 0.009, 18.6 %)
    expect(tot.go / tot.g).toBeGreaterThanOrEqual(0.9); expect(tot.wn / tot.w).toBeGreaterThanOrEqual(0.95); expect(tot.fc / tot.fn).toBeGreaterThanOrEqual(0.97); expect(tot.f30 / tot.fn).toBeGreaterThanOrEqual(0.97);
  }, 900_000);
});
