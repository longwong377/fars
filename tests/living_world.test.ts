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
import { depHashFor } from '../tools/dev/coverage_dep';

const DEP = depHashFor('tests/living_world.test.ts'); // D-360: the board's dependency hash, taken before the run
const D0 = 150, D1 = 156; let mk: () => PeopleSim;
const OUT: Record<string, unknown> = {};
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  mk = () => new PeopleSim(1, nav, env);
}, 300_000);

describe('talk that changes the world (T-E13)', () => {
  let S: PeopleSim, S2: PeopleSim;
  it('a seeded week with no player: talk events with a consequence within 3 days, on the real economy', () => {
    S = mk(); const t0 = performance.now(); const r = S.living.report(D0, D1); const ms = performance.now() - t0;
    const E = S.economy(); const base = new Economy(1, householdsOf(S.pop)); for (let d = 0; d <= E.day; d++) base.step(d);
    const kinds = (e: Economy, re: RegExp) => e.events.filter(v => re.test(v.kind)).length;
    const talkEv = E.events.filter(v => v.kind === 'given' || v.kind === 'news' || v.kind === 'visit' || v.kind === 'lent_by_stranger' || v.kind === 'hired_by_stranger').length;
    Object.assign(OUT, { week: [D0, D1], days: S.living.day + 1, ms: Math.round(ms), msPerDay: +(ms / (S.living.day + 1)).toFixed(1), stats: S.living.stats, noPlayer: r,
      economy: { talkEvents: talkEv, withTalk: { events: E.events.length, hunger: kinds(E, /^hunger$/), illness: kinds(E, /^illness$/), death: kinds(E, /^death$/), theft: kinds(E, /theft|steal/) },
        withoutTalk: { events: base.events.length, hunger: kinds(base, /^hunger$/), illness: kinds(base, /^illness$/), death: kinds(base, /^death$/), theft: kinds(base, /theft|steal/) } } });
    console.log('[living]', JSON.stringify(OUT)); mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/living_world.json', JSON.stringify(OUT, null, 1));
    expect(r.talks).toBeGreaterThan(400); // s13 living4: ~550+ a week
    expect(E.events.length).not.toBe(base.events.length); // the talk changed the economy's course
    expect(r.share * 100).toBeGreaterThanOrEqual(50);
  }, 900_000);

  it('player deeds spread; a day is the same whatever the sim’s present and whatever was asked first', () => {
    S2 = mk(); S2.t = 300 * 24; // the sim's present far from the measured week
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
    const ev = { id: 'T-E13', commit, dep: DEP, tool: 'tests/living_world.test.ts', value: +(Math.min((OUT.noPlayer as any).share, r2.playerShare) * 100).toFixed(1), unit: '%', detail: OUT };
    mkdirSync('REVIEWS/evidence/E', { recursive: true }); writeFileSync('REVIEWS/evidence/E/T-E13.json', JSON.stringify(ev, null, 1) + '\n');
    console.log('[living]', JSON.stringify(ev));
    expect(r2.playerEvents).toBeGreaterThan(0);
    expect(r2.playerShare * 100).toBeGreaterThanOrEqual(50);
  }, 900_000);

  it('save mid-week, load: the rest of the week replays identically (talks, the economy, the plans)', () => {
    const MID = 153; S2.t = MID * 24 + 12; const snap = JSON.parse(JSON.stringify(S2.save()));
    const S4 = mk(); S4.load(snap); S4.living.report(D0, D1);
    const key = (s: PeopleSim) => s.living.talks.filter(t => t.day >= MID && t.day <= D1).map(t => `${t.day}:${t.a}:${t.b}:${t.kind}:${t.label ?? ''}:${t.done?.day ?? '-'}:${JSON.stringify(t.intents.map(i => i.payload))}`);
    expect(key(S4).length).toBeGreaterThan(0); expect(key(S4)).toEqual(key(S2));
    const doers = [...new Set(S2.living.talks.filter(t => t.done && t.done.day >= MID && t.done.day <= D1).map(t => `${t.doer}:${t.done!.day}`))].slice(0, 40);
    for (const k of doers) { const [pid, d] = k.split(':').map(Number); expect(JSON.stringify(S4.pop.plan(pid, d)), k).toBe(JSON.stringify(S2.pop.plan(pid, d))); }
    const E2 = S2.economy(), E4 = S4.economy(); const ev = (E: typeof E2) => JSON.stringify(E.events.filter(v => v.day >= MID && v.day <= D1));
    expect(ev(E4)).toBe(ev(E2));
    Object.assign(OUT, { replay: { savedAtDay: MID, talksCompared: key(S4).length, plansCompared: doers.length, economyEventsIdentical: true } });
    // a late-year save loads at once: the talk state is in the save, the economy replays its intents (D-344)
    const S5 = mk(); S5.t = 300 * 24 + 10; const tg = performance.now(); S5.economy(); const genMs = performance.now() - tg;
    const lateStr = JSON.stringify(S5.save()), late = JSON.parse(lateStr); const bytes = { total: lateStr.length, living: JSON.stringify(late.living).length, econ: JSON.stringify(late.econ).length };
    const S6 = mk(); const tl = performance.now(); S6.load(late); S6.economy(); const econMs = performance.now() - tl; const lateTalks = S5.living.talks.filter(t => t.done && t.done.day > 300 && t.done.h0 >= 0).slice(0, 20);
    for (const t of lateTalks) S6.pop.plan(t.doer, t.done!.day); const loadMs = performance.now() - tl;
    for (const t of lateTalks) expect(JSON.stringify(S6.pop.plan(t.doer, t.done!.day))).toBe(JSON.stringify(S5.pop.plan(t.doer, t.done!.day)));
    S5.living.advance(303); S6.living.advance(303); const k3 = (s: PeopleSim) => s.living.talks.filter(t => t.day > 300).map(t => `${t.id}:${t.day}:${t.a}:${t.b}:${t.kind}`);
    expect(k3(S6)).toEqual(k3(S5));
    Object.assign(OUT, { lateLoad: { day: 300, generateMs: Math.round(genMs), loadMs: Math.round(loadMs), restoreMs: Math.round(econMs), intentsToCome: late.econ.intents.length, saveBytes: bytes, plansCompared: lateTalks.length, nextDaysIdentical: true } });
    // D-347: the economy restored from its snapshot, not replayed: the load itself (restore and resume) under 2 s of node time,
    // the whole people's save under 1 MB (was 3.6-10.5 s and 6.6 MB); the 20 plans read after it are reported in loadMs
    expect(econMs).toBeLessThan(2000); expect(bytes.total).toBeLessThan(1_000_000);
    const f = 'REVIEWS/evidence/E/T-E13.json'; const e = JSON.parse(readFileSync(f, 'utf8')); e.detail = OUT; writeFileSync(f, JSON.stringify(e, null, 1) + '\n');
  }, 900_000);
});
