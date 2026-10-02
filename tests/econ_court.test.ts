// D-383 (UD-10, UD-26): the court's arrival and departure as an economic shock that chains. A bare Economy with the court's
// days (courtYear(seed)) against the same economy without them, a full year on seeds 1, 7, 42: grain price in the 30 days
// after the arrival vs the 30 before; chains whose path holds a court event; the year's thefts, petitions and defaults with
// and without the court; determinism and the snapshot round trip with the option.
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { chains, householdsOf } from '../src/people/economy/chains';
import { courtYear } from '../src/people/courtYear';

const SEEDS = [1, 7, 42], YEAR = 354;
const COURT_EV = /^(court_arrived|court_table|court_purchase|court_hire|court_left|court_stores_sold|trade_slack|sold_to_court)$/;
const run = (seed: number, hs: ReturnType<typeof householdsOf>, court: boolean, to = YEAR, cb?: (e: Economy, d: number) => void) => {
  const e = new Economy(seed, hs, court ? { court: courtYear(seed) } : {}); for (let d = 0; d < to; d++) { e.step(d); cb?.(e, d); } return e; };
const count = (e: Economy, ...ks: string[]) => e.events.filter(v => ks.includes(v.kind)).length;
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);

describe('D-383 the court in the economy', () => {
  const rows: any[] = [];
  for (const seed of SEEDS) it(`seed ${seed}`, () => {
    const pop = new Population(seed), hs = householdsOf(pop), cy = courtYear(seed);
    const pr: number[] = [], pr0: number[] = [];
    const e = run(seed, hs, true, YEAR, (x, d) => pr.push(x.price('grain', d))), b = run(seed, hs, false, YEAR, (x, d) => pr0.push(x.price('grain', d)));
    const before = mean(pr.slice(Math.max(0, cy.arrive - 30), cy.arrive)), after = mean(pr.slice(cy.arrive, cy.arrive + 30));
    const leaveBefore = mean(pr.slice(cy.leave - 30, cy.leave)), leaveAfter = mean(pr.slice(cy.leave, cy.leave + 30));
    const cs = chains(e.events), cc = cs.filter(c => c.path.some(i => COURT_EV.test(e.events[i].kind)));
    const kinds = (x: Economy) => ({ thefts: count(x, 'theft'), petitions: count(x, 'petition'), defaults: count(x, 'default'), rationCuts: count(x, 'ration_cut'), dear: count(x, 'grain_dear') });
    const ex = [...new Map(cc.map(c => [c.shape, c])).values()].sort((a, b) => b.path.length - a.path.length).slice(0, 6).map(c => c.path.map(i => `${e.events[i].kind}(${e.events[i].actor})`).join(' -> '));
    rows.push({ seed, arrive: cy.arrive, leave: cy.leave, price: { before: +before.toFixed(4), after: +after.toFixed(4), rise: +(after / before).toFixed(3), leaveBefore: +leaveBefore.toFixed(4), leaveAfter: +leaveAfter.toFixed(4) },
      chains: { all: cs.length, court: cc.length, courtShapes: new Set(cc.map(c => c.shape)).size }, with: kinds(e), without: kinds(b),
      hires: count(e, 'court_hire'), courtCuts: e.events.filter(v => v.kind === 'ration_cut' && v.causes.includes(e.court.tableEv)).length,
      dearByCourt: e.events.filter(v => v.kind === 'grain_dear' && v.causes.some(c => e.events[c].kind === 'court_purchase')).length, ex });
    // the court drives the market: grain dearer in the month after the arrival than the month before, easier after it leaves
    expect(after).toBeGreaterThan(before);
    expect(leaveAfter).toBeLessThan(leaveBefore);
    expect(mean(pr.slice(cy.arrive, cy.leave))).toBeGreaterThan(mean(pr0.slice(cy.arrive, cy.leave)));
    expect(count(e, 'court_arrived')).toBe(1); expect(count(e, 'court_left')).toBe(1); expect(count(b, 'court_arrived')).toBe(0);
    expect(cc.length).toBeGreaterThan(0);
    // determinism and the save round trip with the option
    const e2 = run(seed, hs, true); expect(JSON.stringify(e2.events)).toBe(JSON.stringify(e.events));
    for (const cut of [cy.arrive + 5, cy.leave + 3]) {
      const a = run(seed, hs, true, cut), s = JSON.parse(JSON.stringify(a.snapshot()));
      expect(s.court.days).toEqual({ arrive: cy.arrive, leave: cy.leave });
      const r = Economy.restore(s, hs); // (the days come back with the save)
      for (let d = cut; d < YEAR; d++) r.step(d);
      expect(r.events.length).toBe(e.events.length); expect(JSON.stringify(r.events.slice(-80))).toBe(JSON.stringify(e.events.slice(-80)));
    }
    // the bare economy carries nothing of the court
    expect((b.snapshot() as any).court).toBeUndefined();
  }, 600_000);
  it('a lean year (seed 49: a dry winter, the court early): the stores brought ahead fall short and the rations are cut', () => {
    const seed = 49, hs = householdsOf(new Population(seed)), e = run(seed, hs, true, 70), b = run(seed, hs, false, 70);
    const cuts = e.events.filter(v => v.kind === 'ration_cut' && v.causes.includes(e.court.tableEv));
    rows.push({ seed, lean: { cutsWith: cuts.map(v => `${v.day}:${v.amt!.toFixed(2)}`), cutsWithout: count(b, 'ration_cut'),
      ex: chains(e.events).filter(c => c.path.includes(cuts[0]?.id)).sort((x, y) => y.path.length - x.path.length).slice(0, 3).map(c => c.path.map(i => `${e.events[i].kind}(${e.events[i].actor})`).join(' -> ')) } });
    expect(cuts.length).toBeGreaterThan(0); expect(count(b, 'ration_cut')).toBe(0);
  }, 600_000);
  it('reports', () => { console.log(JSON.stringify(rows, null, 1)); });
});
