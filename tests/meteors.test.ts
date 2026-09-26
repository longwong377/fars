// Sporadic meteors (session 9; src/sky/meteors.ts): a pure function of (seed, time), the hourly rates and magnitudes of the model,
// never by day, and paths on the sky above the horizon.
import { describe, it, expect } from 'vitest';
import { meteorsAt, meteorRate, meteorDir, METEOR_R, METEOR_LIMIT_MAG, METEOR_DRAWN_MAG } from '../src/sky/meteors';

function night(seed: number, day: number, h0: number, h1: number) { const seen = new Map<number, any>();
  for (let t = h0 * 3600; t < h1 * 3600; t += 0.1) for (const m of meteorsAt(seed, day, t)) seen.set(m.start, m); return [...seen.values()]; }
describe('meteors', () => {
  it('are the same whenever and however often they are asked for', () => {
    expect(meteorsAt(1, 101, 3600 * 2 + 17.3)).toEqual(meteorsAt(1, 101, 3600 * 2 + 17.3));
    expect(night(1, 40, 2, 3)).toEqual(night(1, 40, 2, 3));
  });
  it('come at the model\'s rate: the drawn share of the sporadic rate, more before dawn than in the evening', () => {
    const share = Math.pow(METEOR_R, METEOR_DRAWN_MAG - METEOR_LIMIT_MAG); let dawn = 0, eve = 0;
    for (let d = 0; d < 60; d++) { dawn += night(7, d, 4, 5).length; eve += night(7, d, 20, 21).length; }
    expect(dawn / 60).toBeCloseTo(meteorRate(4.5) * share, 0); expect(eve / 60).toBeCloseTo(meteorRate(20.5) * share, 0);
    expect(dawn).toBeGreaterThan(eve);
  });
  it('start above 15° and are unit directions along their path', () => {
    for (const m of night(3, 10, 0, 4)) { expect(m.s[1]).toBeGreaterThan(Math.sin((15 * Math.PI) / 180) - 1e-9); const d = meteorDir(m, m.dur); expect(Math.hypot(...d)).toBeCloseTo(1, 9); expect(m.mag).toBeLessThanOrEqual(METEOR_DRAWN_MAG); }
  });
});
