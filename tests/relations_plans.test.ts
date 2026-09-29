// D-348 (ROADMAP 3e, steps 2 and 4): the relations in the day plans and in the simulation's save. On the sim of seed 1: over
// two weeks the courting visits, walks by the well and lovers' words are laid into both people's plans, each part names the
// other and the two are at the same place, and no plan issue appears that the plan without them does not have (planCheck);
// the families' agreement is laid at the bride's house on its day; the Simulation owns the Relations, saves only the player's
// acts and a reload replays them. Measures go to bench-reports/relations-plans.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { checkPlan } from '../src/people/planCheck';
import { segAt } from '../src/people/population';
import { PLAYER } from '../src/people/relations/world';

let mk: () => PeopleSim; let S: PeopleSim; const OUT: Record<string, unknown> = {};
const write = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/relations-plans.json', JSON.stringify(OUT, null, 1)); };
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  mk = () => new PeopleSim(1, nav, env, { bonds: true }); S = mk();
}, 300_000);

describe('relations in the day plans and the save (D-348)', () => {
  it('two weeks: courting and lovers’ meetings in both plans, together, with no new plan issue', () => {
    const P = S.pop, RP = S.bondPlans, R = S.bonds; const t = performance.now(); R.advance(134); OUT.advanceMs = Math.round(performance.now() - t);
    let meets = 0, parts = 0, apart = 0, newIssues = 0; const kinds: Record<string, number> = {}, notes: string[] = [];
    for (let d = 120; d <= 134; d++) { meets += (R.meets.get(d) ?? []).length;
      for (const [pid, L] of RP.lays(d)) { parts++; const segs = P.plan(pid, d);
        for (const l of L) { kinds[l.meet.kind] = (kinds[l.meet.kind] ?? 0) + 1; const mine = segs.find(s => s.act === 'talk' && s.with !== undefined && s.t0 >= l.h0 - 1e-6 && s.t1 <= l.h1 + 1e-6); expect(mine).toBeDefined();
          const o = segAt(P.plan(mine!.with!, d), (mine!.t0 + mine!.t1) / 2); if (o.place !== mine!.place) apart++; expect(mine!.t0).toBeGreaterThanOrEqual(8); expect(mine!.t1).toBeLessThanOrEqual(17.5 + 1e-6); }
        const b = P.bonds; P.bonds = null; const base = P.plan(pid, d); P.bonds = b; const was = new Set(checkPlan(P, pid, d, base, null).map(i => i.kind));
        for (const i of checkPlan(P, pid, d, segs, null)) if (!was.has(i.kind)) { newIssues++; notes.push(`${d} ${pid} ${i.kind} ${i.note}`); } } }
    Object.assign(OUT, { days: [120, 134], meetsDrawn: meets, partsLaid: parts, byKind: kinds, apart, newIssues, notes: notes.slice(0, 10) }); write();
    expect(kinds.court ?? 0).toBeGreaterThan(10); expect(apart).toBe(0); expect(newIssues).toBe(0);
  }, 900_000);

  it('the families agree the marriage at the bride’s house on the day', () => {
    const P = S.pop, R = S.bonds, RP = S.bondPlans; R.advance(353); let tried = 0, laid = 0;
    for (const e of R.events) { if (e.kind !== 'betroth' || e.a === PLAYER) continue; tried++; const L = RP.lays(e.day).get(e.a)?.find(l => l.meet.kind === 'negotiate'); if (!L) continue; laid++;
      const s = P.plan(e.a, e.day).find(x => x.act === 'talk' && x.with === e.b)!; expect(s.place).toBe(P.households[P.home(e.b, e.day)].home); if (laid >= 12) break; }
    Object.assign(OUT, { negotiationsTried: tried, negotiationsLaid: laid }); write(); expect(laid).toBeGreaterThan(0);
  }, 900_000);

  it('the Simulation owns the Relations; the save keeps only the player’s acts and a reload replays them', () => {
    const A = mk(); A.t = 40 * 24 + 10; expect('bonds' in A.save()).toBe(false);
    const pid = A.pop.persons.find(p => p.sex === 'f' && p.age >= 20 && p.age <= 40 && A.pop.present(p.id, 40) && A.pop.households[p.hh].zone === 'town')!.id;
    expect(A.bondAct(pid, 'gift').ok).toBe(true); A.t += 24; A.bondAct(pid, 'help');
    const s = JSON.parse(JSON.stringify(A.save())); expect(s.bonds.ledger.length).toBe(2);
    const B = mk(); B.load(s); B.bonds.advance(60); A.bonds.advance(60);
    expect(JSON.stringify(B.bonds.memoryOf(pid))).toBe(JSON.stringify(A.bonds.memoryOf(pid))); expect(B.bonds.memoryOf(pid).length).toBe(2);
    OUT.save = { acts: 2, replayed: true }; write();
  }, 900_000);
});
