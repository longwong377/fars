// Decided defaults are the defaults (MASTER_PLAN T-K10, the second critique §4.1): every DECISIONS entry that sets a default
// names this test, and this test reads the code, so a decision cannot be logged while the build keeps the old behaviour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { chooseWorldSeed } from '../src/core/seed';

describe('decided defaults (T-K10)', () => {
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
  it('D-236: a new world seed per new game (not the fixed seed 1) when no seed is given', () => {
    const m = new Map<string, string>(), store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    const seeds = new Set(Array.from({ length: 20 }, () => { m.clear(); return chooseWorldSeed(null, false, store); }));
    expect(seeds.size).toBeGreaterThan(18);
  });
  it.todo('D-239: a new game begins at dawn 1–3 days before the court\'s seed-chosen arrival (needs the arrival simulated: MASTER_PLAN §6 programme)');
});
