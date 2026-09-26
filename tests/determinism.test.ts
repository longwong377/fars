// One seed drives all randomness (brief §6; MASTER_PLAN §6 order, step 1; T-E7, T-F6): the world replays from its seed, so
// nothing in src may draw on Math.random; and each audio noise buffer starts its own sequence (audit D: one fixed seed made
// every footstep, strike and crackle one waveform).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { noiseSeed } from '../src/audio/engine';

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
});
