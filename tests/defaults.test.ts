// Decided defaults are the defaults (MASTER_PLAN T-K10, the second critique §4.1): every DECISIONS entry that sets a default
// names this test, and this test reads the code, so a decision cannot be logged while the build keeps the old behaviour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { chooseWorldSeed, newWorldSeed, WORLD_SEED_POOL } from '../src/core/seed';
import { newGameStart } from '../src/core/newGame';
import { courtYear } from '../src/people/courtYear';
import { sunTimes } from '../src/people/calendar';

describe('decided defaults (T-K10)', () => {
  it('D-376 / UD-31: talking with the people is on by default, with the small model, its bundle under 600 MB, streamed after the first frames', async () => {
    expect(DEFAULT_SETTINGS.talk).toBe(true);
    const { TALK_MODEL, TALK_MB, LLMS, appConfig } = await import('../src/people/converse/models');
    expect(TALK_MODEL).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC'); expect(LLMS.some(m => m.id === TALK_MODEL)).toBe(true);
    expect(TALK_MB.llm + TALK_MB.kokoroWebgpu + TALK_MB.voices).toBeLessThanOrEqual(600); expect(TALK_MB.llm + TALK_MB.kokoroWasm + TALK_MB.voices).toBeLessThanOrEqual(600);
    expect(appConfig([TALK_MODEL], 'https://example.org').model_list[0].model_lib).toMatch(/Qwen2-0\.5B-Instruct-q4f16_1_cs1k-webgpu\.wasm$/);
    const main = readFileSync('src/main.ts', 'utf8'), ui = readFileSync('src/people/converse/ui.ts', 'utf8'), world = readFileSync('src/world/world.ts', 'utf8');
    expect(main).toMatch(/settings\.talk && !P\.has\('test'\)/); expect(main).toMatch(/\+\+shownFrames === 5\) \{ \(world as any\)\.neural\?\.start/);
    expect(ui).toMatch(/export const DEFAULT_MODEL = TALK_MODEL/); expect(world).toMatch(/lazy: true \}\)/);
  });
  it('D-236 / UD-10: the court comes and goes by default (reconstructed, C)', () => {
    expect(DEFAULT_SETTINGS.courtCalendar).toBe('seasonal');
  });
  it('D-238: vertical FOV 60°, head-bob on at ±1.8 cm with no roll', () => {
    expect(DEFAULT_SETTINGS.fov).toBe(60);
    expect(DEFAULT_SETTINGS.headBob).toBe(true);
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toMatch(/Math\.sin\(player\.bobPhase \* 2\) \* 0\.018/);
    expect(main).not.toMatch(/camera\.rotation\.z\s*=|rotateZ\(/); // no camera roll
  });
  it('D-236 (D-392): a first visit draws a world from the baked pool (more than one world across visits); a new game draws afresh', () => {
    const m = new Map<string, string>(), store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    const seeds = new Set(Array.from({ length: 64 }, () => { m.clear(); return chooseWorldSeed(null, false, store); }));
    expect([...seeds].every(s => WORLD_SEED_POOL.includes(s))).toBe(true);
    expect(seeds.size).toBeGreaterThan(4);
    const fresh = new Set(Array.from({ length: 20 }, () => newWorldSeed(store)));
    expect(fresh.size).toBeGreaterThan(18);
  });
  it('D-239 (D-252): a new game begins at dawn 1–3 days before the court\'s seed-chosen arrival; the arrival is the seed\'s alone', () => {
    const seen = new Set<number>();
    for (const seed of [1, 7, 12345, 99991, 424242, 2147483000]) { const y = courtYear(seed), s = newGameStart(seed); seen.add(y.arrive);
      expect(y.arrive - s.day, `seed ${seed}`).toBeGreaterThanOrEqual(1); expect(y.arrive - s.day, `seed ${seed}`).toBeLessThanOrEqual(3);
      expect(s.hour).toBeCloseTo(sunTimes(s.day).rise - 0.4, 2); // dawn: sunrise − 0.4 h (court.json arrival.dawn_before_rise_h)
      expect(y.arrive).toBeGreaterThanOrEqual(6); expect(y.arrive).toBeLessThanOrEqual(18); expect(y.first).toBeGreaterThan(0); expect(y.first).toBeLessThan(s.day + 1); }
    expect(seen.size).toBeGreaterThan(1); // (the day varies with the seed)
    const main = readFileSync('src/main.ts', 'utf8'); expect(main).toMatch(/newGameStart\(SEED, settings\.courtCalendar === 'seasonal'\)/);
    expect(newGameStart(1, false)).toEqual({ day: 0, hour: 7 }); // (the evidence-strict world keeps the old start)
  });
  it('D-336 / UD-22: every person speaks in their own natural voice by default (the neural voices on unless ?neural=0), heard in their own period language; the Farsi/English layer off by default', () => {
    expect(DEFAULT_SETTINGS.hearIn).toBe('own');
    const w = readFileSync('src/world/world.ts', 'utf8'); expect(w).toMatch(/NP\.get\('neural'\) !== '0'/); expect(w).toMatch(/voices\.neural = neural/);
    expect(readFileSync('src/people/converse/ui.ts', 'utf8')).toMatch(/export const FARSI_ROUTE: FarsiRoute = '(llm|nllb)'/);
  });
  it('D-290: the looped probe lookup is the browser default (?probeloop=0 for the unrolled one)', () => {
    expect(readFileSync('src/render/probes/runtime.ts', 'utf8')).toMatch(/get\('probeloop'\) === '0'/);
  });
});
