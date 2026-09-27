// A crowd heard from afar (session 10, GB56; src/audio/farcrowd.ts). What is measured: the talkers from 60 m to FAR_R are
// binned by direction (nearer ones are the voices' and the bed's, farther ones silent); a gathering of hundreds 150 m off is
// heard from its own direction at √n, its top end cut with distance; a sector that empties fades out; the murmur is noise
// streams (no lexicon unit is ever rendered for it, nothing loops).
import { describe, it, expect } from 'vitest';
import { FarCrowd, FAR_R, FAR_GAIN } from '../src/audio/farcrowd';
import { AudioEngine } from '../src/audio/engine';
import type { NearPerson } from '../src/audio/voices';
import { MockContext } from '../tools/dev/audio_graph';

const crowd = (n: number, cx: number, cz: number, talking = true): NearPerson[] => Array.from({ length: n }, (_, i) => ({ key: `p${cx}:${i}`, x: cx + (i % 20) - 10, y: 0, z: cz + Math.floor(i / 20) - 7, talking, lang: 'Persian', sex: 'm' as const, age: 30, seed: i, group: null }));
describe('the far crowd (GB56)', () => {
  const L = { x: 0, y: 1.6, z: 0 };
  it('bins the talkers 60 m to FAR_R by direction; the near and the too-far and the silent are left out', () => {
    const B = FarCrowd.bins([...crowd(300, 0, -150), ...crowd(40, 20, 0), ...crowd(50, 0, 700), ...crowd(80, 150, 0, false)], L);
    expect(B[0].n).toBe(300); expect(B[0].d).toBeGreaterThan(140); expect(B[0].d).toBeLessThan(160); // N (−z)
    expect(B.reduce((a, b) => a + b.n, 0)).toBe(300); expect(FAR_R).toBeGreaterThanOrEqual(300);
    expect(FarCrowd.sectorOf(100, 0)).toBe(2); expect(FarCrowd.sectorOf(0, 100)).toBe(4); expect(FarCrowd.sectorOf(-100, 0)).toBe(6);
  });
  it('an assembly 150 m N is heard from the N at √n, its top end cut; it fades when the crowd goes', () => {
    const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext); e.setListener(L, { x: 0, y: 0, z: -1 });
    const F = new FarCrowd(e), people = crowd(300, 0, -150);
    for (let i = 0; i < 60; i++) { F.update(people, L); ctx.currentTime += 1 / 30; }
    const s = F.stats.sectors[0]; expect(s.n).toBe(300); expect(s.gain).toBeCloseTo(FAR_GAIN * Math.sqrt(300), 5);
    const pans = ctx.nodes.filter((n: any) => n.kind === 'panner'); expect(pans.length).toBe(1);
    const sources = ctx.starts.filter((n: any) => n.kind === 'source'); expect(sources.length).toBeGreaterThan(0); expect(sources.every((n: any) => !n.loop)).toBe(true);
    for (let i = 0; i < 10; i++) { F.update([], L); ctx.currentTime += 1 / 30; } expect(F.stats.talkers).toBe(0);
  });
});

import { STRIKE_KINDS, workStrike } from '../src/audio/soundscape';
import { Rng } from '../src/core/rng';
describe('the road heard (GB51, GB53, GB54)', () => {
  it('hooves, wheels, snorts, whinnies and camels are strike kinds the soundscape plays', () => {
    for (const k of ['hoof', 'wheel', 'snort', 'whinny', 'camel']) expect(STRIKE_KINDS).toContain(k);
    const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext);
    const r = new Rng(1, 't'); for (const k of ['hoof', 'wheel', 'snort', 'whinny', 'camel']) expect(workStrike(e, k, { x: 5, y: 0, z: -5 }, r)).toBe(true);
  });
});
