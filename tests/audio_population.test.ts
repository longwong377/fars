// The town is not mute (D-245; MASTER_PLAN §6 order step 1; T-G1, T-G2, T-G2b, T-G3, T-G3e): a limiter on the master bus,
// voices from the whole population (not only the 135 detailed agents) in their own languages and their own voices, published
// words only and wordless voice for peoples without a corpus (T-K1a2), beds that never loop, the rivers heard. All in node on
// the recording mock context (tools/dev/audio_graph.ts): the graph the real code builds, with the real samples.
import { describe, it, expect } from 'vitest';
import { AudioEngine, LIMITER, ceilingCurve } from '../src/audio/engine';
import { Soundscape } from '../src/audio/soundscape';
import { NoiseStream } from '../src/audio/beds';
import { PopulationVoices, personVoice, voiceDist, voiceLang, WORDLESS, unitsFor, type NearPerson } from '../src/audio/voices';
import { WaterSound, FLOW } from '../src/audio/water';
import { planUtterance, renderPlan } from '../src/audio/speech';
import { LEXICON, murmurEligible, type LangId } from '../src/lang/lexicon';
import { LINES } from '../src/people/speech_lines';
import { findModernWords } from '../src/lang/modern';
import { voiceIdentity, nearPerson } from '../src/people/talkers';
import { MockContext, limiterReport, loopReport, sourceLevel, masterBus, truePeak, bestPath, segmentXcorrPN, playAt } from '../tools/dev/audio_graph';
import { FormantBackend } from '../src/audio/speech';
import { syntheticScene, runScene } from '../tools/dev/audio_render';

const engineOn = () => { const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext); e.setVolumes({ master: 0.9, ambience: 1, voices: 1, music: 1, effects: 1 }); return { ctx, e }; };
const drive = (ctx: MockContext, secs: number, f: (dt: number) => void) => { for (let i = 0; i < secs * 30; i++) { f(1 / 30); ctx.advance(1 / 30); } };

describe('the master bus (T-G1)', () => {
  it('ends in a limiter and a ceiling that everything passes; the modelled bus holds full-scale +6 dB noise under -1 dBTP', () => {
    const { ctx } = engineOn(), L = limiterReport(ctx);
    expect(L.feeds).toBe(1); expect(L.ceilingPresent).toBe(true); expect(L.compressorPresent).toBe(true); expect(L.trimMatchesMakeup).toBe(true);
    expect(L.ceilingBoundDbfs).toBeLessThanOrEqual(-5.9);
    expect(ctx.destination.inputs[0].oversample).toBe(LIMITER.oversample);
    let s = 99; const noise = new Float32Array(12000).map(() => 2 * (((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1));
    expect(truePeak(masterBus(noise, 48000, ceilingCurve()))).toBeLessThanOrEqual(-1);
  });
});

describe('voices from the population (T-G3, D-241, T-K1a2)', () => {
  it('a person of the population (not a detailed agent) gets a voice identity from their origin, age and own seed', () => {
    const pop: any = { persons: [{ origin: 'Ionian', sex: 'f' }, { origin: 'Lydian', sex: 'm' }], ageOn: (pid: number) => (pid ? 44 : 9) };
    const a = voiceIdentity(null, 0, pop, 100, 1), b = voiceIdentity(null, 1, pop, 100, 1);
    expect(a).toMatchObject({ lang: 'Ionian', sex: 'f', age: 9 }); expect(a.seed).not.toBe(b.seed);
    const n = nearPerson('p0', a, 'talk', false, 1, 0, 2, 'market'); expect(n.talking).toBe(true); expect(nearPerson('p0', a, 'talk', true, 1, 0, 2, null).talking).toBe(false);
  });
  it('languages by origin; a people without a corpus is wordless, never given Aramaic; a listed second language is used', () => {
    expect(voiceLang('Ionian').lang).toBe('grc'); expect(voiceLang('Persian').lang).toBe('op'); expect(voiceLang('Elamite').lang).toBe('el'); expect(voiceLang('Babylonian').lang).toBe('bab'); expect(voiceLang('Syrian').lang).toBe('arc');
    for (const o of ['Egyptian', 'Lydian', 'Carian', 'Bactrian', 'Sogdian', 'Thracian', 'Cappadocian', 'Lycian', 'West Semitic']) expect(voiceLang(o).lang, o).toBeNull();
    expect(voiceLang('Egyptian', ['Egyptian', 'Aramaic']).lang).toBe('arc');
  });
  it('no two voices in earshot alike; each person keeps their own voice from their seed', () => {
    expect(personVoice({ seed: 5, sex: 'm', age: 30 })).toEqual(personVoice({ seed: 5, sex: 'm', age: 30 }));
    const S = syntheticScene(40, 7), R = runScene(S, 12, 7), vs = [...new Map(R.voices.log!.map(u => [u.key, u.voice])).values()];
    expect(vs.length).toBeGreaterThan(30);
    let min = Infinity; for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) min = Math.min(min, voiceDist(vs[i], vs[j]));
    expect(min).toBeGreaterThanOrEqual(1);
  });
  it('everyone talking within 15 m is voiced and heard above -40 dB; only published units and wordless voice are said', () => {
    const S = syntheticScene(60, 3), R = runScene(S, 30, 3), log = R.voices.log!, lis = S.listener;
    const near = S.people.filter(p => p.talking && Math.hypot(p.x - lis.x, p.z - lis.z) <= 15);
    expect(near.length).toBeGreaterThan(20);
    for (const p of near) { const mine = log.filter(u => u.key === p.key); expect(mine.length, p.key).toBeGreaterThan(0);
      for (const u of mine.slice(0, 3)) expect(sourceLevel(u.src as any, u.t0, lis).db, `${p.key} ${u.unit}`).toBeGreaterThan(-40); }
    const published = new Set<string>([...LINES.map(l => l.id), ...(Object.keys(LEXICON) as LangId[]).flatMap(l => LEXICON[l].filter(murmurEligible).map(e => e.id))]);
    for (const u of log) if (u.lang === 'wordless') expect(u.unit.startsWith('wordless:')).toBe(true); else expect(published.has(u.unit), u.unit).toBe(true);
    // the Egyptians and Lydians of the scene hum; nobody of theirs speaks another people's words
    const wordlessKeys = new Set(S.people.filter(p => voiceLang(p.lang, p.langs).lang === null).map(p => p.key));
    expect(wordlessKeys.size).toBeGreaterThan(0);
    for (const u of log) if (wordlessKeys.has(u.key)) expect(u.lang).toBe('wordless');
    expect(log.some(u => u.kind === 'bed')).toBe(true); // the talkers beyond the clear voices are heard as the grain bed
    for (const w of WORDLESS) expect(findModernWords(w.ipa, { ipa: true }), w.ipa).toEqual([]);
    for (const l of ['op', 'el', 'arc', 'bab', 'grc'] as LangId[]) expect(unitsFor(l).words.length).toBeGreaterThan(40);
  });
  it('a voice claims the jaw only while it plays (a visible speaker is a heard speaker)', () => {
    const { ctx, e } = engineOn(), v = new PopulationVoices(e, { seed: 2 });
    const people: NearPerson[] = [0, 1].map(i => ({ key: `p${i}`, x: i, y: 0, z: 2, talking: true, lang: 'Elamite', sex: 'm', age: 30 + i * 9, seed: 11 + i, group: 'g' }));
    let spoke = 0; drive(ctx, 10, dt => { v.update(dt, people, { x: 0, y: 1.6, z: 0 }); for (const [, s] of v.speaking) if (ctx.currentTime >= s.from && ctx.currentTime < s.to) spoke++; });
    expect([...v.claimed].sort()).toEqual(['p0', 'p1']); expect(spoke).toBeGreaterThan(30);
  });
  it('the synthesiser gives every hashed seed its own noise (the float product lost its low bits: one noise for all)', () => {
    const plan = planUtterance('ʃaʃa', { sex: 'm', age: 30, pitch: 1, rate: 1 }, { lang: 'arc' });
    const a = renderPlan(plan, 16000, 3_000_000_001), b = renderPlan(plan, 16000, 3_000_007_920);
    let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); expect(d / a.length).toBeGreaterThan(1e-3);
  });
});

describe('the repeat detector finds what it must (T-G2 anti-proxy: after pitch normalisation)', () => {
  it('a voice render played 3-5 % faster or slower is found as a repeat (> 0.9); the same word in two voices is not', () => {
    const fb = new FormantBackend(16000), a = fb.renderSync({ ipa: 'zaumin', lang: 'el', voice: { sex: 'f', age: 30, pitch: 1.05, rate: 1, seed: 9 } }).data;
    for (const r of [1.03, 0.95]) expect(segmentXcorrPN(a, 16000, playAt(a, r), 16000).r, `rate ${r}`).toBeGreaterThan(0.9);
    const v1 = personVoice({ seed: 101, sex: 'm', age: 30 }), v2 = personVoice({ seed: 202, sex: 'm', age: 30 });
    const b = fb.renderSync({ ipa: 'zaumin', lang: 'el', voice: v1 }).data, c = fb.renderSync({ ipa: 'zaumin', lang: 'el', voice: v2 }).data;
    expect(segmentXcorrPN(b, 16000, c, 16000).r).toBeLessThan(0.9);
  });
});

describe('beds without loops (T-G2b, T-G2)', () => {
  it('wind, rain, flies and fires play fresh segments: no looped source, no buffer started twice', () => {
    const { ctx, e } = engineOn(), sound = new Soundscape(e), lis = { x: 0, y: 1.6, z: 0 };
    drive(ctx, 40, dt => sound.update(dt, { hour: 12, month: 5, windMs: 6, rain: 0.6, insideSpace: 'open', nearColumns: true, stepPhase: 0, running: false, surface: 'stone', fires: [{ id: 'a', lit: true, pos: { x: 3, y: 0, z: 0 } }, { id: 'b', lit: true, pos: { x: -4, y: 0, z: 1 } }],
      listener: lis, worksite: null, workHours: false, place: { town: 1, water: 0, trees: 0, midden: 1, animals: 1 }, tempC: 25 }));
    const L = loopReport(ctx); expect(L.loopedSources).toBe(0); expect(L.reusesWithin60s).toBe(0); expect(L.buffersStarted).toBeGreaterThan(30);
    expect(L.distinctBuffers).toBe(L.buffersStarted);
  });
  it('a stream refuses a segment shorter than its crossfades and look-ahead', () => {
    const { e } = engineOn(); expect(() => new NoiseStream(e, 'pink', { seg: 1, fade: 0.5 })).toThrow();
  });
});

describe('running water (T-G3e)', () => {
  it('a river is heard above -40 dB at 50 m from its bank in the month of lowest flow; nothing plays far from water', () => {
    const low = FLOW.indexOf(Math.min(...FLOW) as typeof FLOW[number]);
    for (const [dist, on] of [[50, true], [400, false]] as const) {
      const { ctx, e } = engineOn(), w = new WaterSound(e, [{ pts: [[-3000, 0], [3000, 0]], half: 11.6, kind: 'river' }]), lis = { x: 0, y: 1.6, z: -(11.6 + dist) };
      drive(ctx, 6, () => w.update(lis, low));
      const t = ctx.currentTime - 0.5, playing = ctx.starts.filter(s => s.kind === 'source' && s.buffer && s.startedAt! <= t && s.stopAt > t && bestPath(s, t, lis)?.panner);
      if (!on) { expect(playing.length).toBe(0); continue; }
      const db = 10 * Math.log10(playing.reduce((a, s) => a + 10 ** (sourceLevel(s, t, lis).db / 10), 0));
      expect(db).toBeGreaterThan(-40); expect(w.near.river).toBeCloseTo(dist, 0);
    }
  });
});
