// D-339 (UD-24, UD-21; T-E13): talk that changes the world. Over a seeded week with no player input, the share of the
// people's own talk events that have a consequence in the simulation within 3 game days (an arrangement laid in the
// doer's executed plan AND applied by the economy, or news passed on); and the share of player-caused changes that reach
// at least one other person. The test REPORTS the measured shares (bench-reports/living_world.json); the >= 50 % gate
// is asserted, and the report is written first so a failure still leaves the measure.
// Economy: FakeEcon is a PLACEHOLDER (living/fakeEcon.ts) until src/people/economy lands.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { LivingWorld } from '../src/people/living/world';
import { FakeEcon } from '../src/people/living/fakeEcon';

let S: PeopleSim; const D0 = 150, D1 = 156;
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  S = new PeopleSim(1, nav, env); S.living.now = () => D0; // the player is in the measured week
}, 300_000);

describe('talk that changes the world (T-E13)', () => {
  it('a seeded week: talk events with a consequence within 3 days, and player changes that propagate', () => {
    const t0 = performance.now(); const L = S.living; const r = L.report(D0, D1); const ms = performance.now() - t0; const why0 = tally(L, D0, D1);
    // the player: five deeds asked of people in the town on the first day (go home, as the stranger urges)
    const P = S.pop; const picks = P.persons.filter(p => p.zone === 'town' && p.age >= 16 && P.present(p.id, D0) && !P.sick(p.id, D0)).filter((_, i) => i % 211 === 0).slice(0, 8);
    for (const p of picks) S.talkAct(p.id, { kind: 'go_home' }, D0 * 24 + 16);
    const r2 = L.report(D0, D1);
    const out = { week: [D0, D1], ms: Math.round(ms), noPlayer: r, withPlayer: { playerEvents: r2.playerEvents, playerPropagated: r2.playerPropagated, playerShare: r2.playerShare, share: r2.share }, why: why0, whyWithPlayer: tally(L, D0, D1) };
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/living_world.json', JSON.stringify(out, null, 1));
    console.log('[living]', JSON.stringify(out));
    expect(r.talks).toBeGreaterThan(100);
    expect(r.share * 100).toBeGreaterThanOrEqual(50);
    expect(r2.playerEvents).toBeGreaterThan(0);
    expect(r2.playerShare * 100).toBeGreaterThanOrEqual(50);
  }, 600_000);

  it('an arrangement is in the doer’s plan as walk-errand-walk, and replays identically from the seed', () => {
    const T = S.living.talks.find(t => t.done?.changes.length && !t.news)!; expect(T).toBeTruthy();
    const plan = S.pop.plan(T.doer, T.done!.day); const i = plan.findIndex(s => s.ev === `living:${T.id}`); expect(i).toBeGreaterThanOrEqual(0);
    expect(plan[i].place).toBe(T.target);
    const L2 = new LivingWorld(S.pop, 1, () => new FakeEcon(1), () => S.talk.events); L2.ensure(D0 - 1); L2.ensure(D1);
    const a = S.living.talks.filter(t => t.day >= D0 && t.day <= D1 - 4).map(t => `${t.a}:${t.b}:${t.intent.kind}`);
    const b = L2.talks.filter(t => t.day >= D0 && t.day <= D1 - 4).map(t => `${t.a}:${t.b}:${t.intent.kind}`);
    expect(b).toEqual(a);
  }, 600_000);
});

function tally(L: LivingWorld, d0: number, d1: number) { const m: Record<string, number> = {}; for (const t of L.talks) if (t.day >= d0 && t.day <= d1 && !t.news) { const k = t.why ?? (!t.done ? "not arranged" : !t.done.changes.length ? "not applied" : S.pop.plan(t.doer, t.done.day).some(s => s.ev === `living:${t.id}`) ? "carried out" : "laid but not in plan"); m[k] = (m[k] ?? 0) + 1; } return m; }
