// D-347 (s13 simjoin; UD-26, UD-24; T-F9, T-E13, T-H3r): the new systems joined into one saved simulation.
// (1) The economy's snapshot: restored at a day, it goes on exactly as the economy that ran (events and state), and a restored
//     snapshot saves the same bytes. (2) The economy's illness and death reach the Population: every economy death of a household
//     is one death of a member that day (the year's own, or one the economy laid), no one dies twice, and each illness of the
//     economy lies on a member as a sickbed. (3) Laundry days and baths in the plans at a period-plausible rate (C).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';

describe('D-347: the economy saved as it stands', () => {
  it('a snapshot restored goes on as the economy that ran; it re-saves byte-identically; it is small', () => {
    const pop = new Population(7), hs = householdsOf(pop);
    const a = new Economy(7, hs); for (let d = 0; d <= 150; d++) a.step(d);
    const s1 = JSON.stringify(a.snapshot()); const b = Economy.restore(JSON.parse(s1), hs);
    expect(JSON.stringify(b.snapshot())).toBe(s1);
    for (let d = 151; d <= 200; d++) { a.step(d); b.step(d); }
    const ev = (e: Economy) => JSON.stringify(e.events.filter(v => v.day > 150));
    expect(ev(b)).toBe(ev(a)); expect(b.events.length).toBe(a.events.length);
    expect(JSON.stringify(b.snapshot())).toBe(JSON.stringify(a.snapshot()));
    expect(s1.length).toBeLessThan(700_000);
  }, 300_000);
});

describe('D-347: the economy’s illness and death on the people; washing and bathing in the plans', () => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const S = new PeopleSim(1, nav, env); const P = S.pop;
  it('one mortality: every economy death is a member’s death that day; illnesses lie on a member', () => {
    S.t = 90 * 24; const E = S.economy(); const hh = new Set(E.hh.keys());
    const dead = (P as any).econDead as Map<number, { day: number; was: number }>; const sickBy = (P as any).econSick as Map<number, [number, number][]>;
    let econDeaths = 0, popDeaths = 0, laid = 0; const seen = new Set<number>();
    for (let d = 0; d <= 90; d++) {
      for (const i of P.lifeOn(d).deaths) { expect(seen.has(i), `person ${i} dies twice`).toBe(false); seen.add(i); if (hh.has(`h:${P.persons[i].hh}`)) popDeaths++; expect(P.persons[i].dies).toBe(d); }
    }
    E.events.forEach(v => { if (v.kind === 'death' && v.day <= 90) econDeaths++; });
    for (const [pid, x] of dead) { if (x.day <= 90) laid++; expect(P.present(pid, x.day)).toBe(true); expect(P.present(pid, x.day + 1)).toBe(false); expect(P.sick(pid, x.day)).toBe(true); }
    expect(econDeaths).toBe(popDeaths); // the same deaths, counted once in each
    // each economy illness lies on a member of the house that day (a sickbed in the Population)
    let ill = 0, onBed = 0; E.events.forEach(v => { if (v.kind !== 'illness' || v.day > 90 || v.day < 10) return; ill++; const h = +v.actor.slice(2);
      if (P.membersOn(h, v.day).some(m => sickBy.get(m)?.some(([a, b]) => a <= v.day && v.day < b))) onBed++; });
    expect(ill).toBeGreaterThan(100); expect(onBed).toBe(ill);
    console.log('[simjoin] days 0-90:', JSON.stringify({ econDeaths, popDeaths, laidByEconomy: laid, illnesses: ill, onSickbed: onBed }));
  }, 600_000);
  it('laundry days and baths: a period-plausible rate (C: a wash day every 6-9 days, a bath every 5-8 days)', () => {
    const hs = P.households.filter(H => (H.zone === 'town' || H.zone === 'plain') && H.members.length).filter((_, i) => i % 80 === 0);
    let hd = 0, laundry = 0, pd = 0, bath = 0;
    for (let d = 20; d <= 26; d++) for (const H of hs) { hd++; let L = false;
      for (const m of P.membersOn(H.id, d)) { if (!P.present(m, d)) continue; pd++; const pl = P.plan(m, d); if (pl.some(s => /washing the household’s clothes at the water/.test(s.why))) L = true; if (pl.some(s => /^bathing/.test(s.why))) bath++; }
      if (L) laundry++; }
    console.log('[simjoin] washing:', JSON.stringify({ houseDays: hd, laundry, personDays: pd, bath, stats: S.washPlans.stats }));
    expect(laundry / hd).toBeGreaterThan(0.06); expect(bath / pd).toBeGreaterThan(0.06); // (was 9 of ~840 house-days a week and no baths: D-345)
  }, 600_000);
});
