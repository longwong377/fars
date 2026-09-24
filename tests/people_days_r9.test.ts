// Phase 5 shadow review round 8 (REVIEWS/shadow_phase5_r8.md, reviewer A; REVIEWS/shadow_phase5_r8_b.md, reviewer B; D-196):
// the transhumant band's arrival day (44216 on Ululu 23, day 171: 10 h 45 min on the move from the hill camp, and a herding
// man's day without the flock), and the year-wide invariants that sweep the class: planCheck (g) a day's stage on foot and
// (h) a herding man and the flock. The sweep also found the travellers' arrival day "on the road" from midnight.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { type Seg } from '../src/people/population';
import { invariants, STAGE_CAP_H } from '../src/people/planCheck';
import { WeatherSystem } from '../src/weather/weatherState';
import { REGNAL_DAYS } from '../src/people/calendar';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let P: any;
beforeAll(() => { P = (new PeopleSim(1, nav(), env) as any).pop; });
const onFoot = (g: Seg[]) => g.filter(s => (s.where === 'road' && (s.act === 'walk' || s.act === 'herd')) || (s.act === 'offmap' && /^(coming down from the hills|on the road)/.test(s.why))).reduce((a, s) => a + s.t1 - s.t0, 0);

describe('r8 (B S1, A): the band comes down into the plain', () => {
  it('44216 on Ululu 23 (day 171, index 170): a stage of a few hours from the hill camp, in the plain in the morning, and the flock met and folded at the camp', () => {
    const g: Seg[] = P.plan(44216, 170);
    expect(onFoot(g)).toBeLessThanOrEqual(STAGE_CAP_H);
    const arrive = g.find(s => s.place === 'road:arrival')!; expect(arrive.t0).toBeGreaterThanOrEqual(8 - 1e-6); expect(arrive.t0).toBeLessThanOrEqual(11 + 1e-6);
    expect(g.some(s => /^flock:/.test(s.place) && s.act === 'tend_animals')).toBe(true);
  });
  it('year-wide: every band and travelling party within the stage on foot, and no herding man without the flock ((g), (h): were 353 herder and 655 traveller person-days over 7 h)', () => {
    const ids = P.persons.filter((p: any) => p.job === 'herder' || p.job === 'traveller').map((p: any) => p.id); let n = 0; const bad: string[] = [];
    for (const pid of ids) { let prev: Seg[] | null = null;
      for (let d = 0; d < REGNAL_DAYS; d++) { if (!P.present(pid, d)) { prev = null; continue; } const g: Seg[] = P.plan(pid, d); n++;
        for (const f of invariants(P, pid, d, g, prev)) if ((f.kind === 'stage' || f.kind === 'flock') && bad.length < 5) bad.push(`${pid} d${d} ${f.note}`);
        prev = g; } }
    expect(n).toBeGreaterThan(5000); expect(bad).toEqual([]);
  }, 600_000);
  it('a travelling party sleeps at the last station and sets out in the morning (was "on the road" from midnight)', () => {
    const t = P.persons.filter((p: any) => p.job === 'traveller').slice(0, 60);
    for (const p of t) { const g: Seg[] = P.plan(p.id, p.arrive); const first = g[0]; if (first.act === 'offmap' && first.t1 >= 23.9) continue;
      expect(first.act, `${p.id} d${p.arrive} ${first.why}`).toBe('sleep'); }
  });
});
