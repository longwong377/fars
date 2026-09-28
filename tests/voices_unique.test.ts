// T-E11 (UD-22, D-336): every person has a unique natural voice, in their own period language by default and, with the
// opt-in layer, in Farsi or English in the same voice. The measurement is tools/dev/voices_eval.ts (the models run in node:
// Kokoro-82M, WavLM-SV, ECAPA, UTMOS; outside git, tools/dev/fetch_models.mjs voices), which writes the evidence this test
// reads; the code paths it measures are checked here directly (identity, the language of the default, the opt-in off by
// default and in the same identity, the population's voices speaking through the neural voice, no formant when it is up).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { neuralVoice, voiceKey, VOICE_POOL } from '../src/audio/neural/identity';
import { toKokoro, phonemesFor, tokenize, VOCAB, retract, blendStyle, BASE_VOICES, STYLE_DIM, STYLE_ROWS } from '../src/audio/neural/kokoro';
import { replyJobs, sentences, chunks } from '../src/people/converse/voice';
import { fenceFa } from '../src/people/converse/farsi';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { PopulationVoices, unitsFor, WORDLESS, type NearPerson } from '../src/audio/voices';
import { LEXICON, LANG_IDS } from '../src/lang/lexicon';
import { LINES } from '../src/people/speech_lines';
import { AudioEngine } from '../src/audio/engine';

const EV = 'REVIEWS/evidence/s12-voices/T-E11.json';
const T = JSON.parse(readFileSync('gates/thresholds.json', 'utf8')); const TH = (T.thresholds ?? T).find?.((x: any) => x.id === 'T-E11') ?? Object.values(T).flat().find((x: any) => x?.id === 'T-E11');

describe('a voice per person (D-336)', () => {
  it('is stable for the person, and differs between people of one sex, age and people', () => {
    const a = neuralVoice({ seed: 5, sex: 'm', age: 30, lang: 'Persian' });
    expect(neuralVoice({ seed: 5, sex: 'm', age: 30, lang: 'Persian' })).toEqual(a);
    const keys = new Set(Array.from({ length: 2000 }, (_, i) => voiceKey(neuralVoice({ seed: 1000 + i, sex: 'm', age: 30, lang: 'Persian' }))));
    expect(keys.size).toBe(2000);
  });
  it('blends only style voices of the person\'s sex (children: the women\'s voices at a shorter tract), older voices slower', () => {
    for (let i = 0; i < 400; i++) {
      const sex = i % 2 ? 'f' : 'm', age = [4, 9, 20, 35, 50, 60, 75][i % 7], v = neuralVoice({ seed: i * 31 + 7, sex, age, lang: ['Persian', 'Ionian', 'Syrian', 'Egyptian'][i % 4] });
      expect(v.mix.length).toBe(3); expect(new Set(v.mix.map(m => m[0])).size).toBe(3);
      for (const [n, w] of v.mix) { expect(VOICE_POOL[age < 13 ? 'f' : sex]).toContain(n); expect(w).toBeGreaterThan(0); }
      if (age < 13) expect(v.tract).toBeGreaterThan(1.1); else expect(v.tract).toBeLessThan(1.07);
      if (age >= 55) expect(v.speed).toBeLessThan(1.0);
    }
  });
  it('the style blend and the tract resampling are what the model gets (a style row per length; pitch and length scaled)', () => {
    const tab = new Map(BASE_VOICES.map(([n], i) => [n, Float32Array.from({ length: STYLE_ROWS * STYLE_DIM }, (_, k) => (k % STYLE_DIM === 0 ? i : 0) + Math.floor(k / STYLE_DIM))]));
    const s = blendStyle(n => tab.get(n)!, [['af_heart', 1], ['am_adam', 3]], 12);
    expect(s[1]).toBeCloseTo(10); // row = tokens − 2
    const x = Float32Array.from({ length: 24000 }, (_, i) => Math.sin(2 * Math.PI * 200 * i / 24000)), y = retract(x, 1.25);
    expect(y.length).toBe(Math.floor(24000 / 1.25));
    let z = 0; for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) z++; expect(z).toBeGreaterThan(195); expect(z).toBeLessThan(205); // 250 Hz over the 0.8 s left
  });
});

describe('the period languages by default (§10; D-336)', () => {
  it('every published unit of every language maps onto the model\'s phonemes (nothing dropped but marks it has no symbol for)', () => {
    for (const l of LANG_IDS) { const U = unitsFor(l);
      for (const u of [...U.lines, ...U.words]) { const p = toKokoro(u.ipa); expect(p.length, `${l} ${u.id} ${u.ipa}`).toBeGreaterThan(0);
        expect([...p].every(c => c in VOCAB)).toBe(true); expect(p.length).toBeGreaterThanOrEqual(Math.floor(u.ipa.replace(/[ˈˌ̧̩͡ˤ]/g, '').length * 0.6)); } }
    for (const u of WORDLESS) expect(toKokoro(u.ipa).length).toBeGreaterThan(0);
    expect(toKokoro('d͡ʒiːwaː')).toBe('ʤiːwaː'); expect(toKokoro('laħm')).toBe('lahm'); expect(toKokoro('wazr̩ka')).toBe('wazəɾka'); expect(toKokoro('ħintˤaː')).toBe('hintɑː');
    expect(phonemesFor('haʃijam', 'rise')).toBe('haʃijam?'); expect(tokenize('ab')).toEqual([0, VOCAB.a, VOCAB.b, 0]);
  });
  it('the heard reply is the person\'s own language\'s units by default; the opt-in layer is the same reply in Farsi or English', () => {
    expect(DEFAULT_SETTINGS.hearIn).toBe('own');
    const units = unitsFor('op').lines.slice(0, 2);
    const own = replyJobs('own', units, 'Yes, my wife is at home.');
    expect(own).toEqual(units.map(u => ({ phonemes: phonemesFor(u.ipa, u.intonation) })));
    expect(replyJobs('en', units, 'Yes. My wife is at home.')).toEqual([{ text: 'Yes.', lang: 'en' }, { text: 'My wife is at home.', lang: 'en' }]);
    expect(replyJobs('fa', units, 'Yes.', 'بله. زنم در خانه است.')).toEqual([{ text: 'بله.', lang: 'fa' }, { text: 'زنم در خانه است.', lang: 'fa' }]);
    expect(sentences('Not far. The gods willing!')).toEqual(['Not far.', 'The gods willing!']);
    expect(chunks('Not too bad, not too bad, the stair is a bit steep. My son helps.')).toEqual(['Not too bad, not too bad,', 'the stair is a bit steep.', 'My son helps.']);
  });
  it('the Farsi fence: Persian script only, nothing modern, not the site\'s later names', () => {
    expect(fenceFa('زن من در خانه جو آرد می‌کند.')).toEqual([]);
    expect(fenceFa('من در تخت جمشید کار می‌کنم')).toContain('Takht-e Jamshid'); expect(fenceFa('یه پرسپولیس با نامه')).toContain('Persepolis');
    expect(fenceFa('I work in the field')).toContain('not Persian script'); expect(fenceFa('تلفن داری؟')).toContain('phone');
  });
});

describe('the population speaks in the neural voices when they are up (D-336)', () => {
  // a fake engine and a fake neural client: the clip comes back at once; the formant synthesiser must not be used
  const ctxMock = () => { const node = () => ({ connect: () => {}, disconnect: () => {}, gain: { value: 1, setTargetAtTime: () => {} }, frequency: { value: 0 }, Q: { value: 0 }, type: '', playbackRate: { value: 1 }, start: () => {}, stop: () => {}, buffer: null as any, positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 }, panningModel: '' });
    return { state: 'running', currentTime: 10, sampleRate: 48000, createBuffer: (_c: number, n: number, r: number) => ({ duration: n / r, getChannelData: () => new Float32Array(n) }), createBufferSource: node, createGain: node, createBiquadFilter: node, createPanner: node }; };
  it('every talker near the listener is voiced by their own neural clip, and none by the formant synthesiser', () => {
    const ctx = ctxMock() as any; const e = { ctx, unlocked: true, panner: () => ctx.createPanner(), route: () => ctx.createGain() } as unknown as AudioEngine;
    const asked: string[] = []; const nv = { stats: { ready: true }, has: () => true, prefetch: () => {}, get: (v: any, unit: string) => { asked.push(`${v.key}|${unit}`); return new Float32Array(12000); } } as any;
    const V = new PopulationVoices(e, { seed: 3 }); V.neural = nv; V.log = [];
    const people: NearPerson[] = Array.from({ length: 12 }, (_, i) => ({ key: `p${i}`, x: (i % 4) * 5, y: 0, z: Math.floor(i / 4) * 5, talking: true, lang: ['Persian', 'Elamite', 'Syrian', 'Ionian'][i % 4], sex: i % 2 ? 'f' : 'm', age: 20 + i * 3, seed: 100 + i, group: `g${i >> 1}` }));
    for (let k = 0; k < 400; k++) { ctx.currentTime = 10 + k * 0.05; V.update(0.05, people, { x: 5, y: 1.6, z: 5 }); }
    expect(V.stats.neural).toBeGreaterThan(20); expect(V.stats.formant).toBe(0);
    const speakers = new Set(V.log!.map(u => u.key)); expect(speakers.size).toBeGreaterThanOrEqual(10);
    // each speaker's clips were asked in their own identity (one key per person)
    expect(new Set(asked.map(a => a.split('|')[0])).size).toBeGreaterThanOrEqual(10);
    expect(V.lines()[0]).toMatch(/D-336 natural voices/); expect(V.lines()[0]).not.toMatch(/PLACEHOLDER/);
  });
});

describe('T-E11: the measured share (tools/dev/voices_eval.ts)', () => {
  it('the threshold is the gate\'s own', () => { expect(TH?.value).toBe(95); expect(TH?.tool).toBe('tests/voices_unique.test.ts'); });
  it.runIf(existsSync(EV))('the evidence: >= 60 people of every class, sex, age band and language community; unique, natural, own language, the opt-in in the same voice', () => {
    const ev = JSON.parse(readFileSync(EV, 'utf8'));
    expect(ev.id).toBe('T-E11'); expect(ev.n).toBeGreaterThanOrEqual(TH.sample_min);
    const rows = ev.rows as any[]; expect(rows.length).toBe(ev.n);
    expect(new Set(rows.map(r => r.pid)).size).toBe(rows.length);
    for (const b of ['mchild', 'fchild', 'madult', 'fadult', 'melder', 'felder']) expect(ev.cover.bands, b).toContain(b);
    expect(ev.cover.langs).toEqual(expect.arrayContaining(['op', 'el', 'arc', 'grc', 'wordless']));
    expect(rows.every(r => r.backend === 'kokoro')).toBe(true);
    // recount the share from the rows (the rows carry the measurements; the flags are recomputed from them)
    const pass = rows.filter(r => r.maxSim < 0.86 && r.mos >= 3.5 && r.mosEn >= 3.5 && r.mosFa >= 3.5 && r.ownLang && r.rank1En && r.rank1Fa).length;
    expect(+(100 * pass / rows.length).toFixed(1)).toBe(ev.value);
    expect(ev.value).toBeGreaterThanOrEqual(TH.value);
  });
});
void LEXICON; void LINES;
