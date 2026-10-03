// D-760 (UD-38, UD-39): the score in the world: what the director chooses (never the cue just heard, nothing heard lately
// while anything fresh fits, the hour's tags binding, the opening's own theme never in the world), its silences, and the
// catalogue on disk (every cue it names is there in both encodings).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { chooseCue, fitness, phaseOf, placeOf, DIRECTOR, DUCK, type Catalogue, type ScoreContext } from '../src/audio/score';

const cat: Catalogue = { cues: {
  main_theme: { title: 'theme', tags: ['main', 'film'], seconds: 140 },
  dawn1: { title: '', tags: ['dawn'], seconds: 180 }, dawn2: { title: '', tags: ['dawn', 'terrace'], seconds: 180 },
  day1: { title: '', tags: ['day'], seconds: 200 }, day2: { title: '', tags: ['day', 'road'], seconds: 200 }, day3: { title: '', tags: ['day', 'terrace'], seconds: 200 },
  night1: { title: '', tags: ['night'], seconds: 200 }, rain1: { title: '', tags: ['rain'], seconds: 150 }, any1: { title: '', tags: [], seconds: 160 },
} };
const day: ScoreContext = { hour: 11, rise: 6, set: 18, place: 'terrace', rain: false };

describe('the score director (D-760)', () => {
  it('reads the hour', () => {
    expect(phaseOf({ hour: 5.5, rise: 6, set: 18 })).toBe('dawn'); expect(phaseOf({ hour: 12, rise: 6, set: 18 })).toBe('day');
    expect(phaseOf({ hour: 17, rise: 6, set: 18 })).toBe('dusk'); expect(phaseOf({ hour: 23, rise: 6, set: 18 })).toBe('night');
  });
  it('never plays the opening theme in the world, nor a cue of another hour, nor rain music in the dry', () => {
    expect(fitness(cat.cues.main_theme, day)).toBe(0); expect(fitness(cat.cues.night1, day)).toBe(0); expect(fitness(cat.cues.rain1, day)).toBe(0);
    expect(fitness(cat.cues.day3, day)).toBeGreaterThan(fitness(cat.cues.day2, day));
  });
  it('never repeats the last cue, and nothing heard lately while a fresh cue fits', () => {
    const history: { id: string; at: number }[] = []; let now = 0;
    for (let i = 0; i < 60; i++) { const id = chooseCue(cat, day, history, now, (i * 0.618) % 1)!;
      expect(id).not.toBe(history[history.length - 1]?.id); history.push({ id, at: now }); now += 900; }
    // with four cues fitting a dry day (day1-3, any1) and eight not to be repeated, the least recent is taken: none twice in a row
    const ids = history.map(h => h.id); expect(new Set(ids).size).toBe(4);
    const fresh: { id: string; at: number }[] = [{ id: 'day1', at: 0 }, { id: 'day3', at: 100 }];
    for (let r = 0; r < 1; r += 0.05) expect(['day2', 'any1']).toContain(chooseCue(cat, day, fresh, 200, r));
  });
  it('ducks under a conversation, and leans away from a cue like the last', () => {
    expect(DUCK).toBeLessThanOrEqual(0.35);
    const cat2: Catalogue = { cues: { r1: { title: '', tags: ['day', 'road'], seconds: 100 }, r2: { title: '', tags: ['day', 'road'], seconds: 100 }, t1: { title: '', tags: ['day'], seconds: 100 } } };
    const ctx: ScoreContext = { hour: 11, rise: 6, set: 18, place: 'road', rain: false };
    let r2 = 0; for (let r = 0.005; r < 1; r += 0.01) if (chooseCue(cat2, ctx, [{ id: 'r1', at: 0 }], 5000, r) === 'r2') r2++;
    expect(r2).toBeLessThan(60); // without the lean the road cue (weight 3) would take 75 of 100
  });
  it('keeps long silences', () => { expect(DIRECTOR.gap[0]).toBeGreaterThanOrEqual(180); expect(DIRECTOR.firstAfter[0]).toBeGreaterThanOrEqual(120); });
  it('knows the places', () => { expect(placeOf(100, 0)).toBe('terrace'); expect(placeOf(-175, 122)).toBe('town'); expect(placeOf(-1500, 1500)).toBe('road'); expect(placeOf(4000, 0)).toBe('plain'); });
});

describe('the score on disk (D-760)', () => {
  const man = 'public/audio/score/manifest.json';
  const m = JSON.parse(readFileSync(man, 'utf8')) as Catalogue;
  it('has the theme (in the film) and every cue of the world in Opus, each under 4 MB; the opening\'s also in AAC', () => {
    expect(m.cues.main_theme?.marks?.title).toBeGreaterThan(100);
    for (const [id, c] of Object.entries(m.cues)) { if (c.tags.includes('film')) continue;
      for (const e of c.tags.includes('opening') ? ['webm', 'm4a'] : ['webm']) { const f = `public/audio/score/${id}.${e}`; expect(existsSync(f), f).toBe(true); expect(statSync(f).size).toBeLessThan(4e6); } }
  });
  it('holds an hour of music for the world, every hour of the day and the rain covered', () => {
    const world = Object.values(m.cues).filter(c => !c.tags.includes('film'));
    expect(world.reduce((a, c) => a + c.seconds, 0)).toBeGreaterThanOrEqual(3600);
    for (const t of ['dawn', 'day', 'dusk', 'night', 'rain', 'terrace', 'road']) expect(world.filter(c => c.tags.includes(t)).length, t).toBeGreaterThanOrEqual(2);
  });
  it('cuts the opening on the bars of its music', async () => {
    const { SHOTS, barAt, INTRO_SECONDS } = await import('../src/shell/intro');
    let t = 0; const bars = Array.from({ length: 40 }, (_, i) => barAt(i + 1));
    for (const s of SHOTS) { t += s.dur; expect(bars.some(b => Math.abs(b - t) < 0.01), `${s.id} ends at ${t.toFixed(2)} s`).toBe(true); }
    expect(bars.some(b => Math.abs(b - INTRO_SECONDS) < 0.01)).toBe(true);
  });
});
