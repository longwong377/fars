// One seed drives all randomness (brief §6; MASTER_PLAN §6 order, step 1; T-E7, T-F6): the world replays from its seed, so
// nothing in src may draw on Math.random; and each audio noise buffer starts its own sequence (audit D: one fixed seed made
// every footstep, strike and crackle one waveform).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { noiseSeed } from '../src/audio/engine';
import { chooseWorldSeed, newWorldSeed, keepWorldSeed } from '../src/core/seed';
import { WORLD_SEED_DEFAULT } from '../src/core/rng';

const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []; });

describe('determinism', () => {
  it('no Math.random anywhere in src (use a named Rng stream from the world seed: src/core/rng.ts)', () => {
    const hits = files('src').flatMap(p => readFileSync(p, 'utf8').split('\n').map((l, i) => [p, i + 1, l] as const))
      .filter(([, , l]) => /Math\.random\s*\(/.test(l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')));
    expect(hits.map(([p, i]) => `${p}:${i}`)).toEqual([]);
  });
  it('noise buffers get distinct generator seeds', () => {
    const s = new Set<number>(); for (let n = 1; n <= 100000; n++) s.add(noiseSeed(n));
    expect(s.size).toBe(100000);
  });
  it('a new world per new game: ?seed wins, tests keep the default, a browser keeps its world, "New world" draws afresh (D-236)', () => {
    const m = new Map<string, string>(), store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    expect(chooseWorldSeed('42', true, store)).toBe(42);
    expect(chooseWorldSeed(null, true, store)).toBe(WORLD_SEED_DEFAULT);
    expect(m.size).toBe(0);
    const a = chooseWorldSeed(null, false, store);
    expect(Number.isInteger(a) && a >= 1).toBe(true);
    expect(chooseWorldSeed(null, false, store)).toBe(a); // the same world on the next visit
    const drawn = new Set([a]); for (let i = 0; i < 50; i++) drawn.add(newWorldSeed(store));
    expect(drawn.size).toBeGreaterThan(48); // fresh each time
    expect(chooseWorldSeed(null, false, store)).toBe(+m.get('parsa.worldSeed')!);
    keepWorldSeed(7, store); expect(chooseWorldSeed(null, false, store)).toBe(7);
  });
});
