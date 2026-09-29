// D-345 (ROADMAP 3d): wardrobes and the daily change of clothes, node side. On a seeded week: how often people change,
// that nobody wears one outfit all week, that the plans' laundering trips wash what nobody wears that day, that people are
// out of their day clothes only asleep (in the shift), and that the answer replays identically whatever order it is asked in.
// The measures go to bench-reports/wardrobe.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Wardrobes, type OutfitAt } from '../src/people/wardrobe/world';

const D0 = 20, D1 = 26; let S: PeopleSim; let W: Wardrobes; let sample: number[] = [];
const key = (o: OutfitAt) => o.garments.map(g => g.id).sort().join('|');
beforeAll(() => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const Wx = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = Wx.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  S = new PeopleSim(1, nav, env); W = new Wardrobes(S.pop, 1, (p, d) => S.pop.plan(p, d));
  const P = S.pop; sample = P.persons.filter(p => (p.zone === 'town' || p.zone === 'plain') && P.present(p.id, D0) && P.present(p.id, D1) && p.age >= 3).filter((_, i) => i % 300 === 0).map(p => p.id);
}, 300_000);

describe('wardrobes (ROADMAP 3d)', () => {
  const OUT: Record<string, unknown> = {};
  it('a seeded week: people change, nobody wears one outfit all week, out of day clothes only asleep', () => {
    let transitions = 0, oneOutfit = 0, dayChanges = 0, bareAwake = 0, best = 0, mourning = 0, cloaks = 0, wraps = 0; const perPerson: number[] = [];
    for (const pid of sample) {
      let prev = '', n = 0; const keys = new Set<string>(), days = new Set<string>();
      for (let d = D0; d <= D1; d++) {
        const ds = W.daySet(pid, d); if (ds) { days.add(ds.ids.slice().sort().join('|')); if (ds.set === 'best') best++; if (ds.set === 'mourning') mourning++; }
        for (let h = 0; h < 24; h += 0.5) {
          const o = W.outfitAt(pid, d, h); const k = key(o); keys.add(k); if (prev && k !== prev) n++; prev = k;
          if (o.state === 'dressed' && !o.garments.some(g => g.slot === 'body')) bareAwake++;
          if (o.garments.some(g => g.slot === 'over')) cloaks++; if (o.garments.some(g => g.kind === 'wrap')) wraps++;
        }
      }
      transitions += n; perPerson.push(n); if (keys.size < 2) oneOutfit++; if (days.size >= 2) dayChanges++;
    }
    Object.assign(OUT, { week: [D0, D1], people: sample.length, changesPerPersonWeek: +(transitions / sample.length).toFixed(1), minChanges: Math.min(...perPerson),
      inOneOutfitAllWeek: oneOutfit, withTwoOrMoreDaySets: dayChanges, shareChangingDayClothes: +(dayChanges / sample.length).toFixed(3), dressedWithoutBodyGarment: bareAwake, bestDays: best, mourningDays: mourning, halfHoursCloaked: cloaks, halfHoursWrapped: wraps });
    { const pid = sample[3], hh = S.pop.home(pid, D0); (OUT as any).debug = Array.from({ length: 7 }, (_, i) => { const d = D0 + i; const ds = W.daySet(pid, d)!; return { d, ids: ds.ids, dirt: W.garments(hh, d).filter(g => g.owner === pid).map(g => [g.id, W.stateAtEnd(hh, d, g.id)?.dirt.toFixed(3)]) }; }); mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/wardrobe.json', JSON.stringify(OUT, null, 1)); }
    // occasions: a house in mourning and a festival or wedding day, found in the first months, dress as the day asks
    const P = S.pop; let mournSeen = 0, bestSeen = 0;
    for (let i = 0; i < P.persons.length && (mournSeen < 5 || bestSeen < 5); i += 37) { const p = P.persons[i]; if (p.zone !== 'town' && p.zone !== 'plain') continue;
      for (let d = 30; d < 90; d += 3) { if (!P.present(i, d)) continue;
        if (mournSeen < 5 && P.mourning(i, d)) { expect(W.outfitAt(i, d, 12).set).toBe('mourning'); mournSeen++; break; }
        if (bestSeen < 5 && (P.festDay(i, d) || P.weddingOf(i, d))) { const o = W.outfitAt(i, d, 12); if (o.state === 'dressed') { expect(o.set).toBe('best'); bestSeen++; } break; } } }
    Object.assign(OUT, { occasionsChecked: { mourning: mournSeen, best: bestSeen } });
    expect(sample.length).toBeGreaterThan(50);
    expect(oneOutfit).toBe(0);
    expect(bareAwake).toBe(0);
    expect(dayChanges / sample.length).toBeGreaterThan(0.5);
  }, 900_000);

  it('the plans’ laundering trips wash what nobody wears that day', () => {
    const P = S.pop; let checked = 0, reset = 0, houses = 0;
    const hhs = [...new Set(P.persons.filter(p => (p.zone === 'town' || p.zone === 'plain') && P.present(p.id, D0)).filter((_, i) => i % 97 === 0).map(p => P.home(p.id, D0)))].slice(0, 120);
    for (const hh of hhs) for (let d = D0; d <= D1; d++) {
      const ms = P.membersOn(hh, d); const laundry = ms.some(m => P.plan(m, d).some(s => /washing (the household’s clothes|clothes) at the water/.test(s.why))); if (!laundry) continue; houses++;
      const worn = new Set(ms.flatMap(m => W.daySet(m, d)?.ids ?? []));
      for (const g of W.garments(hh, d)) { if (worn.has(g.id)) continue; const before = W.stateAtEnd(hh, d - 1, g.id); const after = W.stateAtEnd(hh, d, g.id); if (!before || !after || before.dirt <= 0.01) continue; checked++; if (after.dirt === 0) reset++; }
    }
    Object.assign(OUT, { laundryHouseDays: houses, dirtyGarmentsChecked: checked, washedClean: reset });
    expect(houses).toBeGreaterThan(0); expect(checked).toBeGreaterThan(0); expect(reset).toBe(checked);
  }, 900_000);

  it('replays identically in any order of asking; the ledger (make, mend, hand down) is kept by save/load', () => {
    const W2 = new Wardrobes(S.pop, 1, (p, d) => S.pop.plan(p, d));
    const probe = sample.slice(0, 25);
    for (const pid of [...probe].reverse()) for (let d = D1; d >= D0; d -= 2) for (const h of [3, 9.5, 15, 21]) expect(JSON.stringify(W2.outfitAt(pid, d, h))).toBe(JSON.stringify(W.outfitAt(pid, d, h)));
    const pid = probe[0], hh = S.pop.home(pid, D0); const g = W.garments(hh, D0).find(x => x.owner === pid && x.slot === 'body')!;
    W2.buy(hh, pid, 'cloak', 'good', D0 + 1, 'madder'); W2.mend(g.id, D0 + 2);
    const W3 = new Wardrobes(S.pop, 1, (p, d) => S.pop.plan(p, d)); W3.load(JSON.parse(JSON.stringify(W2.save())));
    expect(W3.garments(hh, D0 + 3).length).toBe(W.garments(hh, D0 + 3).length + 1);
    expect(JSON.stringify(W3.outfitAt(pid, D0 + 3, 10))).toBe(JSON.stringify(W2.outfitAt(pid, D0 + 3, 10)));
    expect(W3.stateAtEnd(hh, D0 + 2, g.id)!.wear).toBeLessThan(W.stateAtEnd(hh, D0 + 2, g.id)!.wear);
    OUT.replay = { people: probe.length, identical: true, ledgerRoundTrip: true };
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/wardrobe.json', JSON.stringify(OUT, null, 1));
  }, 900_000);
});
