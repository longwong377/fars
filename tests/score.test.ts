// D-760 (UD-38, UD-39): the score in the world: what the director chooses (never the cue just heard, nothing heard lately
// while anything fresh fits, the hour's tags binding, the opening's own theme never in the world), its silences, and the
// catalogue on disk (every cue it names is there in both encodings).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { chooseCue, fitness, phaseOf, placeOf, DIRECTOR, type Catalogue, type ScoreContext } from '../src/audio/score';

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
  it('keeps long silences', () => { expect(DIRECTOR.gap[0]).toBeGreaterThanOrEqual(180); expect(DIRECTOR.firstAfter[0]).toBeGreaterThanOrEqual(120); });
  it('knows the places', () => { expect(placeOf(100, 0)).toBe('terrace'); expect(placeOf(-175, 122)).toBe('town'); expect(placeOf(-1500, 1500)).toBe('road'); expect(placeOf(4000, 0)).toBe('plain'); });
});

describe('the score on disk (D-760)', () => {
  const man = 'public/audio/score/manifest.json';
  it('has the main theme and every cue in Opus and AAC, each under 6 MB', () => {
    expect(existsSync(man)).toBe(true);
    const m = JSON.parse(readFileSync(man, 'utf8')) as Catalogue; expect(m.cues.main_theme).toBeTruthy();
    for (const id of Object.keys(m.cues)) for (const e of ['ogg', 'm4a']) {
      const f = `public/audio/score/${id}.${e}`; expect(existsSync(f), f).toBe(true); expect(statSync(f).size).toBeLessThan(6e6); }
  });
});
