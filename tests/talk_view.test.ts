// D-315 (UD-21): the stranger's deeds as the player SEES them: the population view (popview.ts) carries out the plan steps
// the simulation laid over a person's day, like any other step. Measured on the built town (popgeo.ts), no pixels:
//   - a person of the town asked the way to the well walks there along the lanes, stands at the well pointing it out, and
//     walks back to the day (their position, update by update, against the well's spot);
//   - a person following the stranger walks on the stranger's own way, 1.5 m behind them, and after it walks the way back;
//   - a person the stranger speaks to stops where they are and turns to face the stranger, then catches up with the day.
// (How this could pass while the intent fails: a plan step nobody draws, or drawn at a place the step does not name. So
// the check is the view's position against the step's place, not the plan's words.)
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { segAt } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan } from '../src/world/settlement/plan';
import { PopGeo } from '../src/people/popgeo';
import { PopView } from '../src/people/popview';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from './plainLib';

let nav: NavGrid, geo: PopGeo, mk: () => { sim: PeopleSim; view: PopView };
const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const sim0 = new PeopleSim(1, nav, env);
  geo = new PopGeo({ pop: sim0.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
  mk = () => { const sim = sim0; return { sim, view: new PopView(sim, geo, 1) }; };
}, 300_000);

/** a town person at leisure at home out of doors at an hour of day 150 (the view draws them), not a detailed agent */
function townPerson(sim: PeopleSim, view: PopView, d: number, ok: (pid: number, h: number) => boolean): [number, number] {
  for (const p of sim.pop.persons) { if (p.zone !== 'town' || p.agent >= 0 || !sim.pop.present(p.id, d) || sim.pop.ageOn(p.id, d) < 16) continue;
    for (const s of sim.pop.plan(p.id, d)) if (s.t0 > 7 && s.t1 < 17 && s.t1 - s.t0 > 0.6 && s.place.startsWith('h:') && ok(p.id, s.t0 + 0.2)) return [p.id, s.t0 + 0.2]; }
  void view; return [-1, 0];
}
const where = (view: PopView, pid: number) => view.visible.find(o => o.pid === pid) ?? null;

describe('the stranger’s deeds, as the population view shows them (popview.ts)', () => {
  it('asked the way to the well, a townsman walks there along the lanes, points it out, and walks back to the day', () => {
    const { sim, view } = mk(); const d = 150; let got = false;
    for (let tries = 0; tries < 12 && !got; tries++) {
      const [pid, h] = townPerson(sim, view, d, (x, hh) => { const q = sim.pop.households[sim.pop.home(x, d)].q; return !!q && hh > 0 && x % 40 === tries; }); if (pid < 0) continue;
      const t = d * 24 + h; sim.t = t; const r = sim.talkAct(pid, { kind: 'lead_to', arg: 'the well' }, t); if (!r.ok) continue;
      const q = sim.pop.households[sim.pop.home(pid, d)].q; const well = geo.spot(pid, `well:${q}`, 'talk', d, h + 0.2, false); if (!well.ok) continue;
      const P = sim.pop.plan(pid, d), at = P.find(s => s.place === `well:${q}`)!, walk = segAt(P, h + 0.001);
      const centre: [number, number] = [well.e, well.n]; const track: { t: number; d: number; act: string; moving: boolean }[] = [];
      for (let tt = t - 0.02; tt < d * 24 + r.h1 + 0.05; tt += 0.02) { sim.t = tt; view.settle(tt, centre); const o = where(view, pid); track.push({ t: tt - d * 24, d: o ? Math.hypot(o.e - well.e, o.n - well.n) : NaN, act: o?.act ?? '-', moving: !!o?.moving }); }
      const atWell = track.filter(x => x.t >= at.t0 && x.t <= at.t1 && Number.isFinite(x.d));
      const walking = track.filter(x => x.t > walk.t0 + 0.005 && x.t < walk.t1 - 0.005 && Number.isFinite(x.d));
      if (!atWell.length || walking.length < 2) continue; // (indoors at the start, or the lane out of the view's range: next person)
      expect(Math.max(...atWell.map(x => x.d)), 'standing at the well').toBeLessThan(4);
      expect(walking.some(x => x.moving), 'walking there').toBe(true); expect(walking[0].d, 'from further off').toBeGreaterThan(walking[walking.length - 1].d);
      const after = track.filter(x => x.t > r.h1 + 0.02 && Number.isFinite(x.d)); if (after.length) expect(Math.max(...after.map(x => x.d)), 'gone from the well afterwards').toBeGreaterThan(3);
      got = true;
    }
    expect(got, 'a townsman found who was drawn walking to the well').toBe(true);
  }, 900_000);
  it('a follower walks on the stranger’s way 1.5 m behind; spoken to, a person stops and turns to face the stranger', () => {
    const { sim, view } = mk(); const d = 151;
    const [pid, h] = townPerson(sim, view, d, x => sim.pop.persons[x].sex === 'm' && sim.pop.ageOn(x, d) < 55 && sim.pop.persons[x].rank <= 1); expect(pid).toBeGreaterThanOrEqual(0);
    const t = d * 24 + h; sim.t = t; view.settle(t, [0, 0]);
    // the stranger stands in the lane by the house and walks 30 m along a straight line of the town's own ground (the way
    // itself is the stranger's: here a line, the view walks it as given)
    const home = geo.spot(pid, `h:${sim.pop.home(pid, d)}`, 'rest', d, h, false); const p0: [number, number] = [home.e + 3, home.n];
    sim.player = p0; sim.talk.step(t, p0);
    const r = sim.talkAct(pid, { kind: 'follow' }, t); if (!r.ok) { expect(r.reason).toMatch(/wary|mind|time|fitting|anxious|work|woman|old|leader/); return; }
    let tt = t; for (let k = 1; k <= 30; k++) { tt += 1 / 3600; const p: [number, number] = [p0[0] + k, p0[1]]; sim.player = p; sim.talk.step(tt, p); }
    sim.t = tt; view.settle(tt, p0); const o = where(view, pid)!; expect(o, 'drawn while following').toBeTruthy();
    expect(Math.hypot(o.e - (p0[0] + 30 - 1.5), o.n - p0[1])).toBeLessThan(0.3); expect(o.heading).toBeCloseTo(90, 0);
    // the walk back retraces the way (after the following ends)
    const P = sim.pop.plan(pid, d), f = P.find(s => s.place === '@stranger')!, b = P.find(s => s.place.startsWith('@back:'))!;
    sim.talk.step(d * 24 + f.t1 + 1e-4, [p0[0] + 30, p0[1]]); const tb = d * 24 + (b.t0 + b.t1) / 2; sim.t = tb; view.settle(tb, p0);
    const ob = where(view, pid)!; expect(ob?.moving).toBe(true); expect(Math.abs(ob.n - p0[1])).toBeLessThan(0.5); expect(ob.e).toBeGreaterThan(p0[0] - 1); expect(ob.e).toBeLessThan(p0[0] + 30);
    // spoken to: a second person stops and faces the stranger
    const [q, hq] = townPerson(sim, view, d, x => x !== pid && x % 7 === 3); const tq = d * 24 + hq; sim.t = tq; view.settle(tq, [0, 0]); const oq = where(view, q);
    if (oq) { const me: [number, number] = [oq.e + 2, oq.n + 2]; sim.player = me; sim.talk.step(tq, me); sim.talkAddressed(q); const e0 = oq.e, n0 = oq.n;
      for (let k = 1; k <= 20; k++) { sim.t = tq + k / 3600; view.update(sim.t, [e0, n0]); }
      const o2 = where(view, q)!; expect(o2.act).toBe('talk'); expect(o2.moving).toBe(false); expect(o2.heading).toBeCloseTo(45, 0); expect(Math.hypot(o2.e - e0, o2.n - n0)).toBeLessThan(0.3); }
  }, 300_000);
});
