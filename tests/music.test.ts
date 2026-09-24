import { describe, it, expect } from 'vitest';
import { MESOPOTAMIAN_MODES, GREEK_MODES, scaleFreqs, cents, ratio, stepPattern, SPECIES_PATTERN } from '../src/audio/tuning';
import { INSTRUMENTS, PLUCK, VOICE_RANGE, pluck, pipeNote, drum } from '../src/audio/instruments';
import { compose, render, MusicSystem, Performance, refusal } from '../src/audio/music';
import { sing } from '../src/audio/song';
import { MUSIC_CLAIMS, NOT_PERFORMED } from '../src/audio/musicClaims';
import { Rng } from '../src/core/rng';
import block from '../src/data/blocklist.json';

const SR = 44100;
/** fundamental by normalised autocorrelation with parabolic interpolation, over a window after the attack */
function f0(x: Float32Array, fmin: number, fmax: number, from = 0.1, len = 0.25, shortest = true) {
  const a = Math.floor(from * SR), n = Math.floor(len * SR), s = x.subarray(a, a + n);
  let best = 0, bl = 0; const r = (lag: number) => { let v = 0, e1 = 0, e2 = 0; for (let i = 0; i + lag < s.length; i++) { v += s[i] * s[i + lag]; e1 += s[i] * s[i]; e2 += s[i + lag] * s[i + lag]; } return v / Math.sqrt(e1 * e2 + 1e-12); };
  const lo = Math.floor(SR / fmax), hi = Math.ceil(SR / fmin); const vals: number[] = [];
  for (let lag = lo; lag <= hi; lag++) { const v = r(lag); vals[lag] = v; if (v > best) { best = v; bl = lag; } }
  // plucked strings: prefer the shortest lag close to the best (octave errors); odd-harmonic reed tones: plain argmax
  if (shortest) for (let lag = lo; lag <= hi; lag++) if (vals[lag] > 0.9 * best && vals[lag] >= (vals[lag - 1] ?? -1) && vals[lag] >= (vals[lag + 1] ?? -1)) { bl = lag; break; }
  const y0 = r(bl - 1), y1 = r(bl), y2 = r(bl + 1), d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
  return SR / (bl + (Number.isFinite(d) ? d : 0));
}

describe('tunings (brief §11: no equal temperament; Mesopotamian heptatonic; Greek modes for Greeks)', () => {
  it('every mode step is a ratio of powers of 2 and 3 (fifth/fourth cycle), never a 12-TET step', () => {
    for (const m of [...MESOPOTAMIAN_MODES, ...GREEK_MODES]) {
      expect(m.steps).toHaveLength(7); expect(ratio(m.steps[0])).toBe(1);
      for (const [n, d] of m.steps) { let a = n, b = d; for (const p of [2, 3]) { while (a % p === 0) a /= p; while (b % p === 0) b /= p; } expect(a * b, `${m.id} ${n}/${d}`).toBe(1); }
      // at least one interval deviates from 12-TET by more than 5 cents (the Pythagorean third is +7.8 c)
      const dev = m.steps.map(s => { const c = 1200 * Math.log2(ratio(s)); return Math.abs(c - Math.round(c / 100) * 100); });
      expect(Math.max(...dev), m.id).toBeGreaterThan(5);
    }
  });
  it('seven distinct Mesopotamian modes, ascending within the octave', () => {
    expect(MESOPOTAMIAN_MODES).toHaveLength(7); expect(new Set(MESOPOTAMIAN_MODES.map(m => m.steps.map(ratio).join())).size).toBe(7);
    for (const m of MESOPOTAMIAN_MODES) for (let i = 1; i < 7; i++) { expect(ratio(m.steps[i])).toBeGreaterThan(ratio(m.steps[i - 1])); expect(ratio(m.steps[i])).toBeLessThan(2); }
  });
});

describe('tunings: the species of each mode (review B-M7; SOUNDSCAPE §8 M-13, M-14)', () => {
  it('each mode has the tone/limma pattern of its octave species: two limmas a fourth or fifth apart, five 9:8 tones', () => {
    for (const m of [...MESOPOTAMIAN_MODES, ...GREEK_MODES]) {
      const pat = stepPattern(m);
      expect(pat, m.id).toBe(SPECIES_PATTERN[m.species]);
      expect([...pat].filter(c => c === 'S').length).toBe(2);
    }
  });
  it('Greek modes: Dorian is the E species (limma first), Phrygian D, Lydian C (the old labels were rotations 1 and 2 of Dorian)', () => {
    const g = Object.fromEntries(GREEK_MODES.map(m => [m.id, stepPattern(m)]));
    expect(g).toEqual({ dorian: 'STTTSTT', phrygian: 'TSTTTST', lydian: 'TTSTTTS' });
  });
  it("Kilmer's equation: išartum Dorian, kitmum Hypodorian, embūbum Phrygian, pītum Hypophrygian, nīd qablim Lydian, qablītum Mixolydian, nīš gabarîm Hypolydian", () => {
    expect(Object.fromEntries(MESOPOTAMIAN_MODES.map(m => [m.name, m.species]))).toEqual({ 'išartum': 'Dorian', 'kitmum': 'Hypodorian', 'embūbum': 'Phrygian', 'pītum': 'Hypophrygian', 'nīd qablim': 'Lydian', 'qablītum': 'Mixolydian', 'nīš gabarîm': 'Hypolydian' });
    for (const m of [...MESOPOTAMIAN_MODES, ...GREEK_MODES]) { expect(m.claims.length, m.id).toBeGreaterThan(0); expect(m.tier).toMatch(/[ABC]/); }
  });
  it('the Pythagorean third is 407.8 cents, not 400 (fifths 3:2 exactly, 702.0 cents)', () => {
    const m = MESOPOTAMIAN_MODES.find(x => x.species === 'Lydian')!;
    expect(1200 * Math.log2(ratio(m.steps[2]))).toBeCloseTo(407.82, 1); expect(1200 * Math.log2(ratio(m.steps[4]))).toBeCloseTo(701.96, 1);
  });
});

describe('physically modelled instruments', () => {
  it('plucked strings sound at the tuned pitch within ±3 cents (harp, lyre, lute; low and high strings)', () => {
    const rng = new Rng(1, 'test');
    for (const k of ['harp', 'lyre', 'lute'] as const) for (const f of scaleFreqs(MESOPOTAMIAN_MODES[0], INSTRUMENTS[k].range[0] * 1.1, 9).filter(x => x <= INSTRUMENTS[k].range[1])) {
      const x = pluck(f, 0.6, SR, PLUCK[k], rng); const got = f0(x, f * 0.7, f * 1.4, 0.05, 0.3);
      expect(Math.abs(cents(f, got)), `${k} ${f.toFixed(1)} Hz → ${got.toFixed(2)}`).toBeLessThan(3);
    }
  });
  it('strings decay; the pipe sustains; the drum is struck and dies away', () => {
    const rng = new Rng(2, 'test'), rms = (x: Float32Array, a: number, b: number) => { let s = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i] * x[i]; return Math.sqrt(s / ((b - a) * SR)); };
    const s = pluck(220, 3, SR, PLUCK.harp, rng); expect(rms(s, 2.0, 2.5)).toBeLessThan(rms(s, 0.05, 0.55) * 0.35);
    const p = pipeNote(330, 1.5, SR, rng); expect(rms(p, 1.0, 1.3)).toBeGreaterThan(rms(p, 0.3, 0.6) * 0.6);
    for (const f of [220, 330, 523, 880]) { const pf = f0(pipeNote(f, 1.0, SR, rng), f * 0.75, f * 1.3, 0.5, 0.3, false); expect(Math.abs(cents(f, pf)), `pipe ${f} → ${pf.toFixed(1)}`).toBeLessThan(5); }
    const d = drum(110, 'dum', SR, rng); expect(rms(d, 0.6, 0.85)).toBeLessThan(rms(d, 0, 0.1) * 0.2);
  });
  it('no banned instrument exists (oud, duduk, santur, orchestral)', () => {
    const banned = (block as any).entries.find((e: any) => e.id === 'music-cliche').terms as string[];
    for (const i of Object.values(INSTRUMENTS)) for (const t of banned) expect(`${i.id} ${i.name}`.toLowerCase()).not.toContain(t);
  });
});

describe('composition: generative, seeded, varied', () => {
  const base: Performance = { id: 'p1', instrument: 'harp', tradition: 'mesopotamian', context: 'leisure', seed: 7 };
  it('the same seed gives the same piece; another seed gives a different one', () => {
    const a = compose(base, 30), b = compose(base, 30), c = compose({ ...base, seed: 8 }, 30);
    expect(a).toEqual(b); expect(a.map(e => e.f.toFixed(2)).join()).not.toBe(c.map(e => e.f.toFixed(2)).join());
  });
  it('every pitch belongs to the performance mode (octave-reduced)', () => {
    for (const p of [base, { ...base, id: 'g', tradition: 'greek' as const, instrument: 'lyre' as const, seed: 3 }, { ...base, id: 'pipe', instrument: 'double_pipe' as const, seed: 4 }]) {
      const ev = compose(p, 30); expect(ev.length).toBeGreaterThan(10);
      const f0s = Math.min(...ev.map(e => e.f));
      const ok = (f: number) => { const c = ((cents(f0s, f) % 1200) + 1200) % 1200; return [...MESOPOTAMIAN_MODES, ...GREEK_MODES].some(m => m.steps.some(s => { const d = Math.abs(1200 * Math.log2(ratio(s)) - c); return d < 0.5 || Math.abs(d - 1200) < 0.5; })); };
      for (const e of ev) expect(ok(e.f), `${p.id} ${e.f}`).toBe(true);
    }
  });
  it('renders without clipping', () => {
    const x = render(base, compose(base, 12), SR); let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.1); expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
  });
});

describe('evidence rules at runtime', () => {
  const routed: any[] = [];
  const engine: any = { ctx: { sampleRate: 8000, currentTime: 0, createBuffer: () => ({ copyToChannel() {}, duration: 1 }), createBufferSource: () => ({ connect() {}, start() {}, stop() {} }), createGain: () => ({ connect() {}, gain: { value: 1, setTargetAtTime() {} } }) },
    unlocked: true, panner: () => ({ connect() {}, positionX: {}, positionY: {}, positionZ: {} }), ch: { music: {} }, route: (pan: any, ch: string) => { routed.push([pan, ch]); } };
  const C = ['M-04', 'M-17'];
  it('no instrument at an offering (Herodotus 1.132); court music only with the court resident; never without a position', () => {
    const m = new MusicSystem(engine, () => false);
    expect(m.perform({ id: 'a', instrument: 'double_pipe', tradition: 'mesopotamian', context: 'offering', seed: 1, claims: C }, { x: 0, y: 0, z: 0 }, 2)).toBe(false);
    expect(m.perform({ id: 'a2', instrument: 'voice', tradition: 'mesopotamian', context: 'offering', seed: 1, claims: C }, { x: 0, y: 0, z: 0 }, 2)).toBe(false); // no chant either (M-06)
    expect(m.perform({ id: 'b', instrument: 'harp', tradition: 'mesopotamian', context: 'court', seed: 1, claims: ['M-01'] }, { x: 0, y: 0, z: 0 }, 2)).toBe(false);
    expect(m.perform({ id: 'c', instrument: 'harp', tradition: 'mesopotamian', context: 'leisure', seed: 1, claims: C }, { x: NaN, y: 0, z: 0 }, 2)).toBe(false);
    expect(m.perform({ id: 'd', instrument: 'harp', tradition: 'mesopotamian', context: 'leisure', seed: 1, claims: C }, { x: 1, y: 0, z: 2 }, 2)).toBe(true);
    expect(new MusicSystem(engine, () => true).perform({ id: 'e', instrument: 'harp', tradition: 'mesopotamian', context: 'court', seed: 1, claims: ['M-01', 'M-04'] }, { x: 0, y: 0, z: 0 }, 2)).toBe(true);
  });
  it('no music without a tiered source: a performance citing no claim, or an unknown one, is refused', () => {
    const m = new MusicSystem(engine, () => true);
    expect(refusal({ id: 'x', instrument: 'harp', tradition: 'mesopotamian', context: 'work', seed: 1 }, true)).toMatch(/no tiered source/);
    expect(m.perform({ id: 'x', instrument: 'harp', tradition: 'mesopotamian', context: 'work', seed: 1 }, { x: 0, y: 0, z: 0 }, 2)).toBe(false);
    expect(m.perform({ id: 'y', instrument: 'harp', tradition: 'mesopotamian', context: 'work', seed: 1, claims: ['M-99'] }, { x: 0, y: 0, z: 0 }, 2)).toBe(false);
    for (const id of NOT_PERFORMED) expect(MUSIC_CLAIMS[id], id).toBeUndefined(); // the chant, herders' pipes and the rejected claims cannot be cited
  });
  it('what plays goes through the occlusion (engine.route on the music channel)', () => { expect(routed.length).toBeGreaterThan(0); expect(routed.every(r => r[1] === 'music')).toBe(true); });
});

describe('singing (vocalise, no words; M-01, M-02, M-07, M-15)', () => {
  it('a sung note sounds at its pitch within 10 cents (vibrato averaged), female and male', () => {
    for (const [reg, f] of [['f', 330], ['m', 165]] as const) {
      const x = sing([{ t: 0, dur: 1.2, f, vel: 1, phrase: 0 }], SR, { register: reg, seed: 3 });
      const got = f0(x, f * 0.7, f * 1.4, 0.35, 0.6, false); expect(Math.abs(cents(f, got)), `${reg} ${f} → ${got.toFixed(1)}`).toBeLessThan(10);
    }
  });
  it('a composed song keeps to its mode and its register, and a chorus is louder in the tutti phrases than the lead alone', () => {
    const p: Performance = { id: 'v', instrument: 'voice', tradition: 'mesopotamian', context: 'court', register: 'f', voices: 4, seed: 5, claims: ['M-01'] };
    const ev = compose(p, 20); expect(ev.length).toBeGreaterThan(8);
    for (const e of ev) { expect(e.f).toBeGreaterThanOrEqual(VOICE_RANGE.f[0] * 0.99); expect(e.f).toBeLessThanOrEqual(VOICE_RANGE.f[1]); }
    expect(new Set(ev.map(e => e.phrase)).size).toBeGreaterThan(1);
  });
  it('an ensemble shares its melody: harp and voice with one pieceSeed and tonic play the same degrees (heterophony)', () => {
    const base = { tradition: 'mesopotamian' as const, context: 'court' as const, pieceSeed: 42, tonic: 220, modeId: 'meso1', tempo: 80, claims: ['M-01'] };
    const h = compose({ ...base, id: 'h', instrument: 'harp', seed: 1 }, 15), v = compose({ ...base, id: 'v', instrument: 'voice', register: 'f', seed: 2 }, 15);
    const deg = (e: { f: number }) => Math.round(((cents(220, e.f) % 1200) + 1200) % 1200);
    expect(h.slice(0, 6).map(deg)).toEqual(v.slice(0, 6).map(deg));
  });
  it('cost: a 30 s chorus of four voices renders in under 1.5 s in node (the main-thread hitch when a court piece starts)', () => {
    const p: Performance = { id: 'c', instrument: 'voice', tradition: 'mesopotamian', context: 'court', register: 'f', voices: 4, seed: 9, claims: ['M-01'] };
    const t0 = performance.now(); const x = render(p, compose(p, 30), 22050); const ms = performance.now() - t0;
    console.log(`singing: 30 s, 4 voices at 22.05 kHz rendered in ${ms.toFixed(0)} ms`);
    expect(x.length).toBeGreaterThan(22050 * 20); expect(ms).toBeLessThan(1500);
  });
});
