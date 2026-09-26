// D-255 (WORLD_INVENTORY G20, G26-G29, GB4, GB13): the crafts and the records are simulated and performed. Each of the seven
// activities (the smith at the forge, the goldsmith chasing, silver weighed on a balance, a seal rolled, a seal cut, hides
// tanned, sesame pounded for oil) is registered with a performance of its own (not a placeholder, not `inspect`), is given
// by the day plans to named people at its places and hours, and stands at its place in the built town (the smith at his
// workshop's forge with the fire on his left). The detector escape (REVIEWS/escapes.md: silver "weighed" as `inspect`
// passed the activity lint) is closed by planCheck's reason rules: a reason that says weighing, sealing, forging, chasing,
// seal cutting, tanning or pressing is performed as that act or the plan is not well formed.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { ACTIVITIES, performanceFor, type ActivityId } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';
import { reasonOk, checkPlan } from '../src/people/planCheck';
import { nameFor, type Seg } from '../src/people/population';
import { PopGeo } from '../src/people/popgeo';
import { buildTownPlan } from '../src/world/settlement/plan';
import { pose } from '../src/people/anim';
import { STRIKE_KINDS } from '../src/audio/soundscape';
import { toLocal } from '../src/world/settlement/site';

const CRAFT: ActivityId[] = ['smith', 'goldsmith', 'weigh', 'seal', 'cut_seal', 'tan', 'press_oil'];
const loadNav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let sim: PeopleSim;
beforeAll(() => { sim = new PeopleSim(1, loadNav(), env); }, 120_000);

describe('the crafts and the records are performed (D-255)', () => {
  it('each has a performance of its own: its pose cycle, tools, work objects and sounds; none is a placeholder or `inspect`', () => {
    expect(activityLint(ACTIVITIES as any)).toEqual([]);
    for (const a of CRAFT) { const P = ACTIVITIES[a]; expect(P, a).toBeDefined(); expect(P.placeholder ?? false).toBe(false); expect(['inspect', 'idle', 'sit']).not.toContain(P.anim); }
    // the variants the plans' words pick
    expect(performanceFor('smith', 'working the bellows at his father’s forge').anim).toBe('bellows');
    expect(performanceFor('seal', 'sealing the jars and sacks of the store with clay and the store’s seal').anim).toBe('seal_jar');
    expect(performanceFor('seal', 'sealing the tablet of the payment (E-05)').anim).toBe('seal');
    expect(performanceFor('tan', 'turning the hides soaking in the tanning vat').anim).toBe('stir');
    expect(performanceFor('press_oil', 'skimming the oil off the sesame paste in hot water into the jars').anim).toBe('cook');
    expect(performanceFor('weigh', 'weighing out 40 shekels of silver').prop).toBe('balance');
    // the smith's cycle strikes the anvil, breathes the bellows and hisses in the quench: all three kinds sound
    const kinds = new Set<string>(); let last = false; for (let i = 0; i < 20 * 60 * 5; i++) { const po = pose('smith', i * 0.05, 0, 0.3 + (i % 7) * 0.1); if (po.hit && !last) kinds.add(po.hitKind ?? 'hammer'); last = !!po.hit; }
    expect([...kinds].sort()).toEqual(['bellows', 'hammer', 'quench']); for (const k of kinds) expect(STRIKE_KINDS as readonly string[]).toContain(k);
  });
  it('the detector escape is closed: a reason that says weighing, sealing, forging, chasing or tanning performed as another act is caught', () => {
    expect(reasonOk('inspect', 'weighing silver and goods on the balance')).toBe(false);
    expect(reasonOk('weigh', 'weighing silver and goods on the balance')).toBe(true);
    expect(reasonOk('write_tablet', 'sealing the issue tablets')).toBe(false);
    expect(reasonOk('polish_metal', 'treasury workshop: chasing a silver bowl on the stake')).toBe(false);
    expect(reasonOk('craft', 'forging at the forge of the workshop')).toBe(false);
    expect(reasonOk('inspect', 'scraping hides on the beam at the tannery')).toBe(false);
  });
  it('the day plans give each craft to named people at its places and hours (14 days), and the plans stay well formed', () => {
    const P = sim.pop, stat = new Map<ActivityId, { h: number; who: Set<number>; places: Set<string>; named: number; lo: number; hi: number }>();
    const plans = new Map<number, Seg[]>(), bad: string[] = [];
    for (let d = 60; d < 74; d++) for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d); let mine = false;
      for (const s of segs) { if (s.where !== 'road' && !reasonOk(s.act, s.why)) bad.push(`${pid}/${d}: ${s.act} — ${s.why}`);
        if (!CRAFT.includes(s.act)) continue; mine = true; let x = stat.get(s.act); if (!x) stat.set(s.act, x = { h: 0, who: new Set(), places: new Set(), named: 0, lo: 24, hi: 0 });
        x.h += s.t1 - s.t0; if (!x.who.has(pid)) { x.who.add(pid); if (nameFor(P.seed, P.persons[pid])) x.named++; } x.places.add(s.place.split(':')[0]); x.lo = Math.min(x.lo, s.t0); x.hi = Math.max(x.hi, s.t1); }
      if (mine && d === 66) plans.set(pid, segs); }
    expect(bad.slice(0, 10)).toEqual([]);
    const places: Record<ActivityId, string[]> = { smith: ['h', 'ws'], goldsmith: ['ws', 'treasury_inside', 'h'], weigh: ['treasury_store', 'treasury_desk'], seal: ['treasury_store', 'treasury_desk', 'stair_foot', 'gate_hall', 'station', 'store_town'],
      cut_seal: ['ws', 'h'], tan: ['tannery'], press_oil: ['oil_press'] } as any;
    const rows: string[] = [];
    for (const a of CRAFT) { const x = stat.get(a); expect(x, `${a} performed`).toBeDefined();
      rows.push(`${a} ${x!.h.toFixed(0)} h by ${x!.who.size} (${x!.named} named) at ${[...x!.places].join('/')} ${x!.lo.toFixed(1)}-${x!.hi.toFixed(1)}`);
      expect(x!.who.size, a).toBeGreaterThanOrEqual(a === 'smith' ? 5 : 6); expect(x!.named, `${a}: named people (the name pools leave a few unnamed: population.ts nameFor)`).toBeGreaterThanOrEqual(Math.floor(0.95 * x!.who.size));
      for (const pl of x!.places) expect(places[a], `${a} at ${pl}`).toContain(pl);
      expect(x!.lo, `${a} starts after the dawn`).toBeGreaterThan(4.5); expect(x!.hi, `${a} ends by dusk`).toBeLessThan(19.5); }
    console.log(rows.join('\n'));
    // (plansWellFormed for the craftspeople's day: every check of the soak)
    const issues: string[] = []; for (const [pid, segs] of plans) for (const i of checkPlan(P, pid, 66, segs, P.plan(pid, 65).at(-1)!.place, P.plan(pid, 65))) issues.push(`${pid}: ${i.kind} ${i.note}`);
    expect(issues).toEqual([]);
  }, 300_000);
  it('in the built town the smith stands at his workshop’s forge with its fire on his left, the helper at its bellows; the tannery and the press resolve', () => {
    const P = sim.pop, plan = buildTownPlan(), geo = new PopGeo({ pop: P, nav: sim.nav, town: plan, seed: 1 }), d = 66;
    const smiths = P.persons.filter(p => p.job === 'craftsman' && p.sub === 'smith'); expect(smiths.length).toBeGreaterThanOrEqual(5);
    let checked = 0;
    for (const p of smiths) { const sp = geo.spot(p.id, P.households[p.hh].home, 'smith', d, 9); expect(sp.ok, sp.what).toBe(true); expect(sp.what).toMatch(/forge/);
      // the forge fitting nearest the spot, in the performer's frame (heading clockwise from N; left = (−cos h, sin h))
      const site = plan.sites.find(s => { const [u, v] = toLocal(s.frame, sp.e, sp.n); return s.inb(s.ci(u), s.cj(v)); })!; const f = site.fittings.filter(x => x.kind === 'forge').map(x => site.grid(x.u, x.v)).sort((a, b) => Math.hypot(a[0] - sp.e, a[1] - sp.n) - Math.hypot(b[0] - sp.e, b[1] - sp.n))[0];
      const h = sp.heading * Math.PI / 180, de = f[0] - sp.e, dn = f[1] - sp.n, left = -Math.cos(h) * de + Math.sin(h) * dn, ahead = Math.sin(h) * de + Math.cos(h) * dn;
      if (/bellows/.test(sp.what)) { expect(ahead, 'the bellows man faces the forge').toBeGreaterThan(0.8); expect(Math.abs(left)).toBeLessThan(0.1); }
      else { expect(left, 'the forge on the smith’s left').toBeGreaterThan(0.75); expect(left).toBeLessThan(0.95); expect(Math.abs(ahead)).toBeLessThan(0.1); }
      checked++; }
    expect(checked).toBe(smiths.length);
    const tanner = P.persons.find(p => p.sub === 'tanner')!, oil = P.persons.find(p => p.sub === 'oil')!;
    const t = geo.spot(tanner.id, 'tannery', 'tan', d, 9), o = geo.spot(oil.id, 'oil_press', 'press_oil', d, 9);
    expect(t.ok, t.what).toBe(true); expect(o.ok, o.what).toBe(true); expect(Math.hypot(t.e - 428, t.n - 432)).toBeLessThan(25); expect(Math.hypot(o.e + 215, o.n + 690)).toBeLessThan(25);
    // the Treasury's goldsmiths at the forges: two to a forge, never two at one anvil
    const byForge = new Map<string, number>(); for (const q of P.persons) { const f = P.treasuryForge(q.id, d); if (!f) continue; const sp = geo.spot(q.id, 'ws:0', 'smith', d, 9); if (!sp.ok) continue;
      const k = `${sp.e.toFixed(2)},${sp.n.toFixed(2)}`; byForge.set(k, (byForge.get(k) ?? 0) + 1); }
    expect(byForge.size).toBeGreaterThan(0); for (const [k, n] of byForge) expect(n, `people at one spot ${k}`).toBe(1);
  }, 300_000);
});
