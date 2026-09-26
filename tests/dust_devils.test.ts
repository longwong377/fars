// Session 9 (WORLD_INVENTORY G7): dust devils on hot summer afternoons over the open plain.
import { describe, it, expect } from 'vitest';
import { devilWeather, devilsAt, devilEnvelope, DEVIL_MAX, DEVIL_R } from '../src/world/dustDevils';

describe('dust devils (session 9)', () => {
  it('only on hot, bright, light-wind, dry summer afternoons', () => {
    expect(devilWeather(6, 14, 36, 0.05, 3, 0)).toBeGreaterThan(0.8);
    for (const [m, h, T, c, w, wet] of [[0, 14, 36, 0, 3, 0], [6, 9, 36, 0, 3, 0], [6, 14, 24, 0, 3, 0], [6, 14, 36, 0.6, 3, 0], [6, 14, 36, 0, 12, 0], [6, 14, 36, 0, 3, 0.5]] as const) expect(devilWeather(m, h, T, c, w, wet), `${m} ${h} ${T} ${c} ${w} ${wet}`).toBe(0);
  });
  it('a strong afternoon has a few in view over open ground, none over closed ground; each drifts smoothly with the wind and lives minutes', () => {
    const open = () => true, shut = () => false; let seen = 0;
    for (let t = 50000; t < 53600; t += 60) { const L = devilsAt(1, t, [0, 0], 1, [2, 0], open); seen += L.length; expect(L.length).toBeLessThanOrEqual(DEVIL_MAX); for (const d of L) expect(Math.hypot(d.e, d.n)).toBeLessThanOrEqual(DEVIL_R); }
    expect(seen / 60).toBeGreaterThan(1); expect(devilsAt(1, 50000, [0, 0], 1, [2, 0], shut).length).toBe(0);
    const a = devilsAt(1, 51000, [0, 0], 1, [2, 0], open), b = devilsAt(1, 51001, [0, 0], 1, [2, 0], open);
    for (const d of a) { const e = b.find(x => x.key === d.key); if (!e) continue; expect(Math.hypot(e.e - d.e, e.n - d.n)).toBeLessThan(4); expect(d.life).toBeGreaterThanOrEqual(120); expect(d.life).toBeLessThanOrEqual(360); expect(d.h).toBeGreaterThanOrEqual(30); expect(d.h).toBeLessThanOrEqual(150); }
  });
  it('rises, holds and dies away', () => { expect(devilEnvelope(0, 200)).toBe(0); expect(devilEnvelope(100, 200)).toBe(1); expect(devilEnvelope(200, 200)).toBe(0); });
});
