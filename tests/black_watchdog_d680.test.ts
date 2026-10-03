// D-680: the black-frame watchdog (pipeline.ts watchMeter/enterSafe): a post pipeline whose output stays black in daylight
// while the scene draws is given up for the renderer's own output; night, loading and slow readbacks never trip it
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Pipeline, WATCHDOG } from '../src/render/pipeline';

const P: any = Pipeline.prototype;
const fresh = () => ({ safeMode: null, rp: {}, meterTarget: {}, wd: { armedAt: 0, lastT: 0, black: 0, timeouts: 0, faults: 0 }, enterSafe: P.enterSafe, watchMeter: P.watchMeter });
let t = 0; afterEach(() => { vi.restoreAllMocks(); delete (globalThis as any).__safeMode; });
const run = (o: any, samples: (number | 'unwritten' | 'timeout')[], draws = 400, lux = 50000, start = 0) => {
  t = start; vi.spyOn(performance, 'now').mockImplementation(() => t); vi.spyOn(console, 'warn').mockImplementation(() => {});
  o.watchMeter(-1, draws, lux); // arms
  t += WATCHDOG.graceMs + 1;
  for (const s of samples) { o.watchMeter(s, draws, lux); t += WATCHDOG.everyMs + 1; }
  return o;
};
describe('D-680 black-frame watchdog', () => {
  it('three unwritten (black) meter samples in daylight switch to the safe path, logged once', () => {
    const o = run(fresh(), ['unwritten', 'unwritten', 'unwritten']);
    expect(o.safeMode).toMatch(/black/); expect((globalThis as any).__safeMode?.reason).toBe(o.safeMode); expect(o.meterTarget).toBeNull();
  });
  it('a lit frame in between resets the count; two blacks do nothing', () => {
    expect(run(fresh(), ['unwritten', 'unwritten', -2, 'unwritten', 'unwritten']).safeMode).toBeNull();
  });
  it('never at night, never while the scene draws little, never inside the grace', () => {
    expect(run(fresh(), ['unwritten', 'unwritten', 'unwritten', 'unwritten'], 400, 0.01).safeMode).toBeNull();
    expect(run(fresh(), ['unwritten', 'unwritten', 'unwritten', 'unwritten'], 10).safeMode).toBeNull();
    const o = fresh(); t = 0; vi.spyOn(performance, 'now').mockImplementation(() => t); o.watchMeter(-1, 400, 5e4);
    for (let i = 0; i < 10; i++) { t += 1500; o.watchMeter('unwritten', 400, 5e4); } expect(o.safeMode).toBeNull(); // 15 s < grace
  });
  it('slow readbacks need ten timeouts in a row', () => {
    expect(run(fresh(), Array(9).fill('timeout')).safeMode).toBeNull();
    expect(run(fresh(), Array(10).fill('timeout')).safeMode).toMatch(/readback/);
  });
});
