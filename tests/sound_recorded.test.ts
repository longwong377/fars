// D-620: the recorded sound: the plan's catalogue agrees with the fetch list and the soundscape; the library loads nothing
// before it is started and keeps its budget; a bed never repeats a stretch within 60 s; one-shots and footsteps play their
// recordings and fall back to the synthesis; the fetch's licence, word and speech screens.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AudioEngine } from '../src/audio/engine';
import { Soundscape, STRIKE_KINDS, BIRDS, STRIKE_AT } from '../src/audio/soundscape';
import { SoundLibrary, DECODED_BUDGET, type Manifest } from '../src/audio/library';
import { BedDeck, BedMixer, Shots, REPEAT_S } from '../src/audio/sampler';
import { BED_LAYERS, ONESHOT_SETS, FOOT_SURFACES, IR_KINDS, bedPlan, bedTime, airOf, soundPlace, footSurface, speciesSlug, seasonOf } from '../src/audio/soundplan';
import { Rng } from '../src/core/rng';
import { MockContext } from '../tools/dev/audio_graph';
import { census, WHERE } from '../tools/dev/sound_census';
// @ts-expect-error a node script without types
import { licenceClass, rejectedBy, speechiness } from '../tools/audio/fetch.mjs';

const engineOn = () => { const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext); e.setVolumes({ master: 0.9, ambience: 1, voices: 1, music: 1, effects: 1 }); return { ctx, e }; };
const drive = (ctx: MockContext, secs: number, f: (dt: number) => void) => { for (let i = 0; i < secs * 30; i++) { f(1 / 30); ctx.advance(1 / 30); } };
/** a library over a fake manifest whose files decode to silent mock buffers of the listed length (at 1 kHz: cheap) */
function fakeLib(ctx: MockContext, sections: Manifest['sections'], fail: string[] = []) {
  const fetched: string[] = [], man: Manifest = { version: 1, sections };
  const durOf = (file: string) => Object.values(sections).flatMap(s => Object.values(s ?? {}).flat()).find(r => r.file === file)?.dur ?? 1;
  const lib = new SoundLibrary('/', {
    fetch: async url => { fetched.push(url); if (url.endsWith('manifest.json')) return new TextEncoder().encode(JSON.stringify(man)).buffer as ArrayBuffer; if (fail.some(f => url.endsWith(f))) return null; return new TextEncoder().encode(url).buffer as ArrayBuffer; },
    decode: async data => { const f = new TextDecoder().decode(data).replace(/^\/audio\//, ''); return ctx.createBuffer(2, Math.round(durOf(f) * 1000), 1000) as unknown as AudioBuffer; },
  });
  return { lib, fetched };
}
const settle = () => new Promise(r => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 20; i++) await settle(); };

describe('the plan and the fetch list agree (D-620)', () => {
  const list = JSON.parse(readFileSync('tools/audio/fetch_list.json', 'utf8')) as { items: { section: string; key: string; q: string[] }[] };
  it('every bed layer, one-shot set and footstep surface is listed, and the list names nothing the world does not play', () => {
    const keys = (s: string) => new Set(list.items.filter(i => i.section === s).map(i => i.key));
    expect([...BED_LAYERS].filter(l => !keys('beds').has(l))).toEqual([]);
    expect([...ONESHOT_SETS].filter(l => !keys('oneshots').has(l))).toEqual([]);
    expect(FOOT_SURFACES.filter(s => !keys('foot').has(`${s}_walk`))).toEqual([]);
    expect([...keys('beds')].filter(k => !(BED_LAYERS as readonly string[]).includes(k))).toEqual([]);
    expect([...keys('oneshots')].filter(k => !(ONESHOT_SETS as readonly string[]).includes(k))).toEqual([]);
    expect(list.items.every(i => i.q.length > 0)).toBe(true);
  });
  it('every work and animal sound has a one-shot set and a placement; every ambient species has a set', () => {
    for (const k of STRIKE_KINDS) { expect(ONESHOT_SETS as readonly string[], k).toContain(k); expect(STRIKE_AT[k], k).toBeDefined(); }
    for (const b of BIRDS) expect(ONESHOT_SETS as readonly string[], b.id).toContain(speciesSlug(b.id));
  });
  it('every bed layer is played by some place, time, season and weather (none listed for nothing)', () => {
    const used = new Set<string>();
    for (const w of Object.values(WHERE)) for (let m = 0; m < 12; m++) for (const h of [1, 5.8, 9, 13, 18.2, 22]) for (const wx of ['clear', 'rain', 'storm', 'dust', 'snow', 'mist'])
      for (const b of bedPlan(w, h, m, { ...airOf(wx), wetness: wx === 'mist' ? 0.7 : airOf(wx).wetness }, { rise: 6, set: 18 })) used.add(b.layer);
    // the canal plays at the channels (water.ts), the hearth also at every fire (soundscape)
    expect(BED_LAYERS.filter(l => !used.has(l) && l !== 'canal')).toEqual([]);
  });
  it('the census: every coverage stratum x band x weather x season has its beds listed; the rooms are fetched; the place table is right', () => {
    const r = census();
    expect(r.placeErr).toEqual([]); expect(r.missing).toBe(0); expect(r.cells).toBe(r.strata * 8 * 9 * 4);
    expect(Object.values(r.irs).every(s => s === 'fetched')).toBe(true);
    expect(Object.keys(r.irs).sort()).toEqual([...IR_KINDS].sort());
  });
  it('places, times, seasons and surfaces', () => {
    expect(bedTime('pre-dawn')).toBe('night'); expect(bedTime('noon')).toBe('day'); expect(bedTime('dusk')).toBe('dusk');
    expect(seasonOf(3)).toBe('spring'); expect(seasonOf(7)).toBe('summer'); expect(seasonOf(11)).toBe('winter');
    expect(soundPlace({ e: 0, n: 0, feetY: 13, insideSpace: 'apadana' })).toBe('hall');
    expect(soundPlace({ e: 50, n: 0, feetY: 13, insideSpace: 'open' })).toBe('terrace');
    // rain and snow underfoot; the walk's own kind wins
    expect(footSurface('earth', WHERE.plain, 3, { rain: 0, windMs: 2, wetness: 0.9 })).toBe('mud');
    expect(footSurface('earth', WHERE.plain, 0, { rain: 0, windMs: 2, snowCover: 0.8 })).toBe('snow');
    expect(footSurface('stone', WHERE.hall, 5, { rain: 0, windMs: 2 })).toBe('plaster');
    expect(footSurface('wood', WHERE.town, 5, { rain: 0, windMs: 2 })).toBe('wood');
    // a heavy rain plays the heavy bed, indoors the roof's
    expect(bedPlan(WHERE.plain, 12, 3, airOf('storm')).map(b => b.layer)).toContain('rain_heavy');
    expect(bedPlan(WHERE.hall, 12, 3, airOf('rain')).map(b => b.layer)).toContain('rain_roof');
  });
});

describe('the library (D-620)', () => {
  it('fetches nothing before start; then the manifest, then only what is asked, two at a time; a failed file is missing', async () => {
    const { ctx } = engineOn(), { lib, fetched } = fakeLib(ctx, { beds: { town_day: [{ file: 'beds/town_day_0.ogg', dur: 120 }] }, oneshots: { bark: [{ file: 'oneshots/bark_0.ogg', dur: 1 }, { file: 'oneshots/bark_1.ogg', dur: 1 }] } }, ['bark_1.ogg']);
    expect(lib.get('beds/town_day_0.ogg')).toBeNull(); // (asked before the start: queued, not fetched — the io is the fake one)
    lib.start(ctx as unknown as BaseAudioContext); await flush();
    expect(fetched[0]).toBe('/audio/manifest.json'); expect(lib.state).toBe('ready');
    expect(lib.ready('oneshots', 'bark')).toHaveLength(0); await flush();
    expect(lib.ready('oneshots', 'bark')).toHaveLength(1); expect(lib.missing('oneshots/bark_1.ogg')).toBe(true);
    expect(fetched.some(u => u.includes('town_day'))).toBe(true);
  });
  it('keeps the decoded bytes under the budget, never dropping a pinned file', async () => {
    const { ctx } = engineOn(), big = DECODED_BUDGET / (2 * 4 * 1000) * 0.6; // each file 60 % of the budget (2 ch, 1 kHz)
    const { lib } = fakeLib(ctx, { beds: { a: [{ file: 'a.ogg', dur: big }], b: [{ file: 'b.ogg', dur: big }], c: [{ file: 'c.ogg', dur: big }] } });
    lib.start(ctx as unknown as BaseAudioContext); await flush();
    lib.get('a.ogg'); await flush(); lib.pin('a.ogg', true);
    lib.get('b.ogg'); await flush(); lib.get('c.ogg'); await flush();
    expect(lib.decodedBytes).toBeLessThanOrEqual(DECODED_BUDGET); expect(lib.get('a.ogg')).not.toBeNull();
  });
});

describe('beds, one-shots and footsteps from recordings (D-620)', () => {
  it('a bed never repeats a stretch of its recording within 60 s, crossfades, and stops when out of the plan', async () => {
    const { ctx, e } = engineOn(), { lib } = fakeLib(ctx, { beds: { town_day: [{ file: 'beds/town_day_0.ogg', dur: 120 }] } });
    lib.start(ctx as unknown as BaseAudioContext); await flush();
    const deck = new BedDeck(e, lib, 'town_day', new Rng(3, 't')); deck.target = 1; deck.tick(1 / 30); await flush();
    drive(ctx, 600, dt => deck.tick(dt));
    expect(deck.log.length).toBeGreaterThan(15);
    for (let i = 0; i < deck.log.length; i++) for (let j = i + 1; j < deck.log.length; j++) {
      const a = deck.log[i], b = deck.log[j]; if (b.at - a.at >= REPEAT_S) continue;
      expect(a.from < b.to && b.from < a.to, `stretch ${a.from.toFixed(0)}-${a.to.toFixed(0)} again after ${(b.at - a.at).toFixed(0)} s`).toBe(false);
    }
    // consecutive stretches overlap by the crossfade (a continuous bed)
    for (let i = 1; i < deck.log.length; i++) expect(deck.log[i].at).toBeLessThan(deck.log[i - 1].at + (deck.log[i - 1].to - deck.log[i - 1].from));
    deck.target = 0; const n = deck.log.length; drive(ctx, 30, dt => deck.tick(dt)); expect(deck.log.length).toBeLessThanOrEqual(n + 1);
  });
  it('the mixer plays the plan from recordings and reports the layers still synthesised', async () => {
    const { ctx, e } = engineOn(), { lib } = fakeLib(ctx, { beds: { town_day: [{ file: 'beds/town_day_0.ogg', dur: 120 }] } });
    lib.start(ctx as unknown as BaseAudioContext); await flush();
    const mix = new BedMixer(e, lib), plan = bedPlan(WHERE.town, 12, 3, airOf('rain'));
    mix.update(1 / 30, plan); await flush(); drive(ctx, 5, dt => mix.update(dt, plan));
    expect([...mix.recorded]).toEqual(['town_day']); expect(mix.unrecorded.has('rain_light')).toBe(true);
  });
  it('a recorded strike replaces its synthesis, never the same recording twice running; without one the synthesis plays', async () => {
    const { ctx, e } = engineOn(), recs = [0, 1, 2, 3].map(i => ({ file: `oneshots/bark_${i}.ogg`, dur: 0.8 }));
    const { lib } = fakeLib(ctx, { oneshots: { bark: recs }, foot: { gravel_walk: recs.map((r, i) => ({ ...r, file: `foot/gravel_walk_${i}.ogg` })) } });
    lib.start(ctx as unknown as BaseAudioContext); await flush();
    const sound = new Soundscape(e, lib); lib.ready('oneshots', 'bark'); lib.ready('foot', 'gravel_walk'); await flush();
    const osc0 = ctx.nodes.filter(n => n.kind === 'oscillator').length;
    const used: string[] = [];
    for (let i = 0; i < 12; i++) { const n0 = ctx.starts.length; sound.strike('bark', { x: 5, y: 0, z: 0 }); used.push(...ctx.starts.slice(n0).filter(s => s.buffer).map(s => String(s.buffer!.length))); ctx.advance(1); }
    expect(sound.shots.played).toBe(12); expect(ctx.nodes.filter(n => n.kind === 'oscillator').length).toBe(osc0); // no synthesised bark
    sound.strike('hammer', { x: 5, y: 0, z: 0 }); expect(sound.shots.synthesised).toBe(1); // no hammer recording: the synthesis
    expect(ctx.nodes.filter(n => n.kind === 'oscillator').length).toBeGreaterThan(osc0);
    // footsteps: the gravel set on the hillside
    const st = new Shots(e, lib); expect(st.step('gravel', false)).toBe(true); expect(st.step('water', false)).toBe(true); // (the gravel's, the nearest)
    expect(st.step('rug', false)).toBe(false); // (nothing near recorded: the synthesis)
  });
});

describe('the fetch screens (D-620)', () => {
  it('licences: CC0, CC BY, CC BY-NC taken; SA, ND and sampling+ refused', () => {
    expect(licenceClass('Creative Commons 0')).toBe('CC0'); expect(licenceClass('http://creativecommons.org/publicdomain/zero/1.0/')).toBe('CC0');
    expect(licenceClass('https://creativecommons.org/licenses/by/4.0/')).toBe('CC BY'); expect(licenceClass('Attribution NonCommercial')).toBe('CC BY-NC');
    expect(licenceClass('CC BY-SA 4.0')).toBeNull(); expect(licenceClass('https://creativecommons.org/licenses/by-nd/3.0/')).toBeNull(); expect(licenceClass('Sampling+')).toBeNull();
    expect(licenceClass('All rights reserved')).toBeNull();
  });
  it('words: a modern sound or speech in the title, tags or description rejects it (whole words)', () => {
    expect(rejectedBy('Village ambience with distant traffic', ['traffic'])).toEqual(['traffic']);
    expect(rejectedBy('Market crowd, people talking', ['talking', 'crowd'])).toEqual(['talking', 'crowd']);
    expect(rejectedBy('Carpenter sawing', ['car'])).toEqual([]);
  });
  it('speechiness: steady noise low, a syllable-rate envelope high', () => {
    const sr = 16000, n = sr * 20, noise = new Float32Array(n), talk = new Float32Array(n); let s = 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let i = 0; i < n; i++) { const w = rnd(); noise[i] = 0.2 * w; const t = i / sr, syl = Math.max(0, Math.sin(2 * Math.PI * 4.5 * t)); talk[i] = 0.3 * syl ** 2 * Math.sin(2 * Math.PI * (140 + 400 * syl) * t) + 0.003 * w; }
    expect(speechiness(noise, sr)).toBeLessThan(2); expect(speechiness(talk, sr)).toBeGreaterThan(5.5);
  });
});
