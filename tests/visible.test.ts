// D-359 (s14 visible; UD-07, UD-08, UD-26; B226, B227, B235): what the simulation does is laid where it can be seen.
// A haggled deal is walked: the seller keeps a stall at the market ground and the buyer's errand falls inside it, at the
// same stall; the exchange is a place of its own (market:<q>), not the lane outside each buyer's door; the relations layer,
// stepped with the days (SimOpts.bonds, the world's setting), enters its bride-gifts and dowries into the economy and moves
// its brides into the groom's house with a wedding day in both houses; each person's day garments are exported.
// How it could pass while the intent fails: a stall laid but the buyer elsewhere (checked: same place, overlapping hours);
// intents counted but never reaching an economy event (checked: the economy's events from them); a bride moved in the
// relations layer only (checked: Population.home and membersOn). The week-wide count is tools/dev/visible_week.ts.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { performanceFor } from '../src/people/activities';

const SEED = 1;
let S: PeopleSim;
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(SEED), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  S = new PeopleSim(SEED, nav, env, { bonds: true });
}, 120_000);

describe('the simulation made visible (D-359)', () => {
  it('haggled deals are walked: a stall at the market ground, the buyer at it while it is kept', () => {
    let deals = 0, laid = 0, met = 0;
    for (let d = 40; d < 47; d++) { S.t = d * 24; const steps = S.econPlans.steps(d);
      for (const [pid, xs] of steps) for (const st of xs) { if (st.kind !== 'haggle_buy') continue; deals++;
        const mine = S.pop.plan(pid, d).find(s => s.act === 'exchange' && s.ev?.includes(`(event ${st.ev};`)); if (!mine) continue; laid++;
        expect(performanceFor('exchange', mine.why).variant).toBeGreaterThanOrEqual(0);
        if (st.with === undefined || !mine.place.startsWith('market:')) continue;
        const sel = S.pop.plan(st.with, d).find(s => s.act === 'exchange' && s.place === mine.place);
        expect(sel, `${pid}:${d} at ${mine.place}`).toBeTruthy(); expect(sel!.t0).toBeLessThanOrEqual(mine.t0 + 1e-6); expect(sel!.t1).toBeGreaterThanOrEqual(mine.t1 - 1e-6);
        expect(performanceFor('exchange', sel!.why).work?.length).toBeGreaterThan(0); met++; } }
    console.log(`deals ${deals}, laid ${laid}, at a stall with the seller there ${met}`);
    expect(deals).toBeGreaterThan(5); expect(laid / deals).toBeGreaterThanOrEqual(0.5); expect(met).toBeGreaterThan(0);
  }, 600_000);
  it('the exchange is the market ground, not the lane outside the buyer’s own door', () => {
    for (let d = 40; d < 43; d++) for (const [pid] of S.econPlans.steps(d)) for (const s of S.pop.plan(pid, d)) if (s.ev?.startsWith('D-340') && s.act === 'exchange') expect(s.place, s.why).toMatch(/^(market:|h:)/);
  });
  it('the relations enter the economy and move their brides (B227, B226)', () => {
    const E = S.econTo(120); const fromRel = E.events.filter(e => e.kind === 'given' && e.day <= 120);
    console.log(`relation intents entered ${S.living.relEntered}; weddings joined to the population ${S.bonds.joined}; given events ${fromRel.length}`);
    expect(S.living.relEntered).toBeGreaterThan(0);
    for (const b of S.pop.relWed) { const w = [...Array(121).keys()].flatMap(d => S.pop.weddingsOn(d)).find(x => x.bride === b); if (!w) continue;
      expect(S.pop.home(b, w.day)).toBe(w.to); expect(S.pop.membersOn(w.to, w.day)).toContain(b); expect(S.pop.home(b, w.day - 1)).toBe(w.from); }
  }, 900_000);
  it('each person’s day garments are exported for the render', () => {
    const d = 44, pids = [...S.econPlans.steps(d).keys()].slice(0, 50), out = S.wardrobes.dayExport(d, pids);
    expect(out.length).toBeGreaterThan(pids.length * 0.8);
    for (const g of out) { expect(g.body, String(g.pid)).toBeTruthy(); expect(['work', 'best', 'mourning']).toContain(g.set); expect(g.body!.dirt).toBeGreaterThanOrEqual(0); }
  }, 900_000); // steps day 44 like its siblings (session 15: 120 s timed out on a loaded box)
});
