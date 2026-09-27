// D-292 (gap hunter C; WORLD_INVENTORY GC27, GC24, GC23): the herd boy's sling, a word and a look at the well before a
// wedding, the hurts of the heavy work. (The wordless lullaby, GA29, is in tests/audio_population.test.ts.)
// How this could pass while the intent fails (said before building): the sling drawn on a grown man or a girl, or on every
// boy (a drill, not a habit); the groom "at the well" while the bride is elsewhere, or with no walk there; the courting
// on the wedding day or after it; a limp on a scribe, or so many hurt men that the lanes limp. Each is measured below.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildPop, sampleDays } from '../tools/dev/body_trace';
import { segAt, type Population, type Seg } from '../src/people/population';
import { performanceFor } from '../src/people/activities';
import { WORK_ANIMS, WORK_META } from '../src/people/workAnims';
import L from '../src/data/lives.json';

let P: Population;
beforeAll(() => { P = buildPop(1); }, 240_000);

describe('the herd boy\'s sling (GC27, D-292)', () => {
  it('about 45 % of herd boys of 8-17 carry and use a sling; never a grown man, never a girl', () => {
    const share = (sex: 'm' | 'f', age: number) => { let n = 0; for (let s = 0; s < 4000; s++) if (performanceFor('herd', 'herding the flock on the pasture', s * 7919 + 13, undefined, { sex, age } as any).anim === 'sling') n++; return n / 4000; };
    expect(share('m', 12)).toBeGreaterThan(0.38); expect(share('m', 12)).toBeLessThan(0.52);
    expect(share('m', 30)).toBe(0); expect(share('f', 12)).toBe(0); expect(share('m', 7)).toBe(0);
    expect(WORK_ANIMS).toContain('sling'); expect(WORK_META.sling.ground).toBe('feet');
  });
});

describe('a word and a look at the well before the wedding (GC24, D-292)', () => {
  it('the groom is at the bride\'s well while she draws water, on days before the wedding only, and walks there and back', () => {
    let pairs = 0; const bad: string[] = [];
    for (let pid = 0; pid < P.persons.length; pid++) { const B = P.persons[pid]; if (B.sex !== 'f' || B.spouse === undefined || B.marry >= 1e9) continue;
      for (let d = Math.max(0, B.marry - (L as any).body_care.court_days - 2); d <= B.marry + 1; d++) { const c = P.courtingOn(pid, d); if (!c) continue;
        const [b, g, a, e] = c, m = (a + e) / 2; if (d >= B.marry) bad.push(`${pid} courted on d${d}, wedding d${B.marry}`);
        const sb = segAt(P.plan(b, d), m), sg = segAt(P.plan(g, d), m), gs: Seg[] = P.plan(g, d); pairs++;
        if (sb.act !== 'draw_water' || !sb.place.startsWith('well:') || sg.place !== sb.place || sg.act !== 'talk' || sg.with !== b) bad.push(`${pid} d${d}: ${sb.act}@${sb.place} / ${sg.act}@${sg.place}`);
        const k = gs.findIndex(s => s.t0 <= m && s.t1 > m); if (k > 0 && gs[k - 1].place !== sg.place && gs[k - 1].where !== 'road') bad.push(`${pid} d${d}: no walk to the well`); } }
    expect(bad.slice(0, 5)).toEqual([]); expect(pairs).toBeGreaterThan(10);
  }, 600_000);
});

describe('the hurts of the heavy work (GC23, D-292)', () => {
  it('only men of 14-60 of the heavy work are hurt; a hurt lasts 3-12 days; about 2 % of such men limp on a given day', () => {
    const heavy = new Set(['builder', 'porter', 'farmer', 'herder', 'groom', 'camp']); let n = 0, hurt = 0, other = 0; const lens: number[] = [];
    for (const d of sampleDays(1, 6)) for (let pid = 0; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if (!P.present(pid, d)) continue; const h = P.injuryOn(pid, d);
      if (!(p.sex === 'm' && heavy.has(p.job) && p.agent < 0 && P.ageOn(pid, d) >= 14 && P.ageOn(pid, d) <= 60)) { if (h) other++; continue; }
      n++; if (h) { hurt++; lens.push(h.days); expect(d - h.day).toBeLessThan(h.days); expect(h.how.length).toBeGreaterThan(5); } }
    expect(other).toBe(0); expect(n).toBeGreaterThan(2000);
    expect(hurt / n).toBeGreaterThan(0.008); expect(hurt / n).toBeLessThan(0.04);
    expect(Math.min(...lens)).toBeGreaterThanOrEqual(3); expect(Math.max(...lens)).toBeLessThanOrEqual(12);
  }, 240_000);
});
