// D-339, D-341 (UD-24, UD-21; T-E13): talk that changes the world, on the real economy (D-338). Over a seeded week with no
// player input: the share of the people's own talk events with a consequence in the simulation within 3 game days (an errand
// in the doer's executed plan AND the economy's state changed by it that day, or news passed on), and the share of player
// changes that reach at least one other person. Also: the talk changes the economy's course (its events differ from a run
// without talk), and a day's plan does not depend on the sim's present or on which day was asked first.
// Evidence: REVIEWS/evidence/E/T-E13.json (with the commit hash); the >= 50 % gate is asserted after it is written.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';

const D0 = 150, D1 = 156; let mk: () => PeopleSim;
const OUT: Record<string, unknown> = {};
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  mk = () => new PeopleSim(1, nav, env);
}, 300_000);

describe('talk that changes the world (T-E13)', () => {
  let S: PeopleSim;
  it('a seeded week with no player: talk events with a consequence within 3 days, on the real economy', () => {
    S = mk(); const t0 = performance.now(); const r = S.living.report(D0, D1); const ms = performance.now() - t0;
    const E = S.economy(); const base = new Economy(1, householdsOf(S.pop)); for (let d = 0; d <= E.day; d++) base.step(d);
    const kinds = (e: Economy, re: RegExp) => e.events.filter(v => re.test(v.kind)).length;
    const talkEv = E.events.filter(v => v.kind === 'given' || v.kind === 'news' || v.kind === 'visit' || v.kind === 'lent_by_stranger' || v.kind === 'hired_by_stranger').length;
    Object.assign(OUT, { week: [D0, D1], days: S.living.day + 1, ms: Math.round(ms), msPerDay: +(ms / (S.living.day + 1)).toFixed(1), stats: S.living.stats, noPlayer: r,
      economy: { talkEvents: talkEv, withTalk: { events: E.events.length, hunger: kinds(E, /^hunger$/), illness: kinds(E, /^illness$/), death: kinds(E, /^death$/), theft: kinds(E, /theft|steal/) },
        withoutTalk: { events: base.events.length, hunger: kinds(base, /^hunger$/), illness: kinds(base, /^illness$/), death: kinds(base, /^death$/), theft: kinds(base, /theft|steal/) } } });
    console.log('[living]', JSON.stringify(OUT));
    expect(r.talks).toBeGreaterThan(50);
    expect(E.events.length).not.toBe(base.events.length); // the talk changed the economy's course
    expect(r.share * 100).toBeGreaterThanOrEqual(50);
  }, 900_000);

  it('player deeds spread; a day is the same whatever the sim’s present and whatever was asked first', () => {
    const S2 = mk(); S2.t = 300 * 24; // the sim's present far from the measured week
    const P = S2.pop; const picks = P.persons.filter(p => p.zone === 'town' && p.age >= 16 && P.present(p.id, D0) && !P.sick(p.id, D0)).filter((_, i) => i % 211 === 0).slice(0, 8);
    for (const p of picks) S2.talkAct(p.id, { kind: 'go_home' }, D0 * 24 + 16);
    const r2 = S2.living.report(D0, D1);
    const key = (s: PeopleSim) => s.living.talks.filter(t => t.day <= D0).map(t => `${t.day}:${t.a}:${t.b}:${t.kind}:${t.done?.day ?? '-'}`);
    expect(key(S2)).toEqual(key(S));
    const T = S.living.talks.find(t => t.done && !t.news && t.day <= D0)!; expect(T).toBeTruthy();
    expect(JSON.stringify(S2.pop.plan(T.doer, T.done!.day))).toBe(JSON.stringify(S.pop.plan(T.doer, T.done!.day)));
    expect(S.pop.plan(T.doer, T.done!.day).find(s => s.ev === `living:${T.id}`)?.place).toBe(T.target);
    Object.assign(OUT, { withPlayer: { playerEvents: r2.playerEvents, playerPropagated: r2.playerPropagated, playerShare: r2.playerShare, share: r2.share, why: r2.why } });
    let commit = 'unknown'; try { commit = execSync('git rev-parse HEAD').toString().trim(); if (execSync('git status --porcelain -- src tests').toString().trim()) commit += '-dirty'; } catch { /* no git */ }
    const ev = { id: 'T-E13', commit, tool: 'tests/living_world.test.ts', value: +(Math.min((OUT.noPlayer as any).share, r2.playerShare) * 100).toFixed(1), unit: '%', detail: OUT };
    mkdirSync('REVIEWS/evidence/E', { recursive: true }); writeFileSync('REVIEWS/evidence/E/T-E13.json', JSON.stringify(ev, null, 1) + '\n');
    console.log('[living]', JSON.stringify(ev));
    expect(r2.playerEvents).toBeGreaterThan(0);
    expect(r2.playerShare * 100).toBeGreaterThanOrEqual(50);
  }, 900_000);
});
