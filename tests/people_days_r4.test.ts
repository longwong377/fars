// The soak after the round-3 merge (D-139) failed two gates; D-140 fixes their causes. These tests reproduce both
// failures on the round-3 code (commit be6db72) and hold the fixes:
//  - plansWellFormed ("apart", day 123): a well trip left a 0.36-second "at home" sliver in a mother's plan between two
//    trips; her children's plans, which drop pieces under 1e-4 h, walked straight through it;
//  - populationVariety (41397, a girl of three present seven days): small children were kept in all day on a storm or a
//    dust day, and a visit to a kinswoman's house was cut to the one plan segment she was in at its middle.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { Seg, segAt } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { SOAK_GATES } from '../tools/soak';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env); P = (sim as any).pop; });

/** the soak's "apart" rule (planCheck.ts checkDay): a person "with" another is where that one is, at the middle of the piece */
const apart = (pid: number, d: number): string | null => { for (const s of P.plan(pid, d) as Seg[]) { if (s.with === undefined) continue; const mid = (s.t0 + s.t1) / 2, o = segAt(P.plan(s.with, d), mid);
  if (o.place !== s.place && !(o.where === 'road' && s.where === 'road')) return `${pid} d${d} ${s.t0.toFixed(4)} ${s.place} (${s.act}) but ${s.with} at ${o.place} (${o.act})`; } return null; };
/** the soak's near-copy share (tools/soak.ts pairStats): 48 half-hour buckets of place|act; a pair is a near-copy when at
 *  least NEAR_COPY of the buckets agree */
const nearCopyShare = (pid: number) => { const days: number[] = []; for (let d = 0; d < 354; d++) if (P.present(pid, d)) days.push(d);
  const sig = days.map(d => { const segs: Seg[] = P.plan(pid, d); return Array.from({ length: 48 }, (_, b) => { const s = segAt(segs, b * 0.5 + 0.5 - 1e-6); return `${s.place}|${s.act}`; }); });
  const lim = Math.floor(48 * (1 - SOAK_GATES.NEAR_COPY) + 1e-9); let pairs = 0, near = 0;
  for (let x = 0; x < sig.length; x++) for (let y = x + 1; y < sig.length; y++) { let diff = 0; for (let b = 0; b < 48; b++) if (sig[x][b] !== sig[y][b]) diff++; pairs++; if (diff <= lim) near++; }
  return { days: days.length, share: pairs ? near / pairs : 0 }; };
const OUTING = /^(playing in the lane with the neighbours|playing outside the door with the neighbours|playing on the doorstep|playing at a neighbour’s house|at a kinswoman’s house in the lane)/;

describe('plans well formed: nobody is "with" someone who is elsewhere (D-140)', () => {
  it('the children of household 9660 on day 123 are where their mother is (the soak failure after round 3)', () => {
    const d = 123, h = P.home(42000, d); const mem: number[] = P.membersOn(h, d); expect(mem).toContain(42002); expect(mem).toContain(42003);
    for (const x of mem) expect(apart(x, d)).toBeNull();
    // the mother's two well trips in a row now run on from one to the next, with no 0.36-second sliver at home between them
    const ms: Seg[] = P.plan(42000, d); for (const s of ms) expect(s.t1 - s.t0, `${s.t0.toFixed(4)} ${s.act} ${s.why}`).toBeGreaterThanOrEqual(0.001);
  });
  it('no plan holds a sliver (every piece but the day\'s first and last lasts 3.6 s or more, a walk that is the only way between two places excepted) and no time is NaN', () => {
    let n = 0;
    for (let pid = 0; pid < P.persons.length; pid += 13) for (const d of [3, 123, 201, 300]) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d); n++;
      for (let i = 0; i < segs.length; i++) { const s = segs[i]; expect(Number.isFinite(s.t0) && Number.isFinite(s.t1), `${pid} d${d} ${s.act} @ ${s.place}: ${s.t0}-${s.t1}`).toBe(true);
        if (s.t1 - s.t0 >= 0.001 || i === 0 || i === segs.length - 1) continue; const pv = segs[i - 1], nx = segs[i + 1];
        expect(s.where === 'road' && !!pv && !!nx && pv.where !== 'road' && nx.where !== 'road' && pv.place !== nx.place, `${pid} d${d} ${s.t0.toFixed(5)}-${s.t1.toFixed(5)} ${s.act} @ ${s.place} (${s.why})`).toBe(true); } }
    expect(n).toBeGreaterThan(10000);
  }, 180_000);
  it('the gardeners of the estates walk to the estate\'s trees in a real time (the trees were a NaN place)', () => {
    let seen = 0;
    for (let pid = 0; pid < P.persons.length; pid++) { if (P.persons[pid].job !== 'gardener') continue; for (const d of [5, 50, 200]) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d);
      if (!segs.some(s => /:trees$/.test(s.place))) continue; seen++; let t = 0; for (const s of segs) { expect(s.t0, `${pid} d${d}`).toBeCloseTo(t, 6); expect(s.t1).toBeGreaterThanOrEqual(s.t0); t = s.t1; } expect(t).toBe(24); } }
    expect(seen).toBeGreaterThan(10);
  }, 120_000);
  it('households on sampled days: every child with its mother, minder or host is where that one is', () => {
    let checked = 0;
    for (const d of [0, 60, 123, 180, 240, 300]) for (let h = 0; h < P.households.length; h += 17) { const H = P.households[h]; if (H.zone !== 'town' && H.zone !== 'plain') continue;
      for (const x of P.membersOn(h, d) as number[]) { if (P.persons[x].age >= 14) continue; checked++; expect(apart(x, d)).toBeNull(); } }
    expect(checked).toBeGreaterThan(3000);
  }, 180_000);
});

describe('a toddler\'s day varies for real (D-140)', () => {
  it('41397, a girl of three present seven days, is not a near-copy of herself (the soak failure after round 3)', () => {
    const r = nearCopyShare(41397); expect(r.days).toBe(7); expect(r.share).toBeLessThan(SOAK_GATES.MAX_NEAR_COPY_SHARE);
  });
  it('small children go out after a storm has passed and before the dust rises, and are kept in during them', () => {
    let out = 0, days = 0;
    for (let d = 0; d < 354; d++) { const wx = P.cal.ctx(d).wx; if (!wx.storm && !wx.dust) continue; days++;
      const keepIn: [number, number][] = [...(wx.stormH ? [wx.stormH] : []), ...(wx.dustH ? [wx.dustH] : [])];
      for (let pid = d % 3; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if (p.job !== 'child' || p.age < 2 || p.age > 4 || !P.present(pid, d)) continue;
        for (const s of P.plan(pid, d) as Seg[]) { if (!OUTING.test(s.why)) continue; out++;
          for (const [a, b] of keepIn) expect(s.t1 <= a + 1e-6 || s.t0 >= b - 1e-6, `${pid} d${d} ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.why} in [${a}, ${b}]`).toBe(true); } } }
    expect(days).toBeGreaterThan(5); expect(out, 'outings on storm and dust days').toBeGreaterThan(100);
  }, 180_000);
  it('a toddler taken to a kinswoman\'s house stays while she is at home (41397, day 3), and the host is at home throughout every visit', () => {
    const segs: Seg[] = P.plan(41397, 3); const v = segs.find(s => /kinswoman’s house/.test(s.why) && s.t0 < 11);
    expect(v, 'the morning visit to the kinswoman on day 3').toBeTruthy(); expect(v!.t1 - v!.t0).toBeGreaterThan(0.5);
    let visits = 0;
    for (let pid = 0; pid < P.persons.length; pid += 5) { const p = P.persons[pid]; if (p.job !== 'child' || p.age < 1 || p.age > 4) continue;
      for (const d of [20, 110, 230]) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) { if (!/neighbour’s house with|kinswoman’s house in the lane/.test(s.why) || s.with === undefined) continue; visits++;
        const hp: Seg[] = P.plan(s.with, d); for (const t of [s.t0 + 0.01, (s.t0 + s.t1) / 2, s.t1 - 0.01]) { const g = segAt(hp, t); expect(g.place, `${pid} d${d} host ${s.with} at ${t.toFixed(2)}`).toBe(s.place); expect(g.act).not.toBe('sleep'); } } } }
    expect(visits).toBeGreaterThan(50);
  }, 180_000);
  it('toddlers present a few weeks or less: none is a near-copy of itself at the soak\'s gate', () => {
    let n = 0, worst = 0;
    for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || p.age < 1 || p.age > 4 || p.born >= 0 || p.agent >= 0) continue;
      let k = 0; for (let d = 0; d < 354 && k <= 40; d++) if (P.present(pid, d)) k++; if (k < 2 || k > 40) continue;
      const r = nearCopyShare(pid); n++; worst = Math.max(worst, r.share); expect(r.share, `${pid} (${r.days} days)`).toBeLessThan(SOAK_GATES.MAX_NEAR_COPY_SHARE); }
    expect(n).toBeGreaterThan(30); expect(worst).toBeLessThan(0.08);
  }, 180_000);
});
