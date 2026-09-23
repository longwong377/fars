// Speech pipeline: IPA → synth mapping coverage, and measurements of the rendered audio (brief §3.4: verify by
// measurement). The synthesiser is tier C placeholder quality; these tests check that it does what it claims
// (vowel formant regions, fricative spectra, stop closures, prosody), not that it sounds like an ancient speaker.
import { describe, it, expect } from 'vitest';
import { tokenizeIpa, PHONES, IpaError, syllabify } from '../src/audio/phonemes';
import { planUtterance, renderPlan, FormantBackend, RecordingBackend, assertLocalUrl, voiceBase, VoiceParams } from '../src/audio/speech';
import { buildProfile, pseudoPhrase } from '../src/audio/murmur';
import { LINES, pickLine, voiceFor, LINE_DEFS, LEXICON_GAPS } from '../src/people/speech_lines';
import { allLexEntries, isSpeakable, lexEntry, cleanIpa } from '../src/lang/lexicon';
import { Rng } from '../src/core/rng';

const SR = 24000;
const MALE: VoiceParams = { sex: 'm', age: 30, pitch: 1, rate: 1, seed: 3 };
const dB = (x: number) => 20 * Math.log10(x + 1e-12);
function rms(d: Float32Array, a: number, b: number) { let s = 0, n = 0; for (let i = Math.floor(a * SR); i < Math.min(d.length, Math.floor(b * SR)); i++) { s += d[i] * d[i]; n++; } return Math.sqrt(s / Math.max(1, n)); }
/** Goertzel magnitude at f over [a,b] s with a Hann window */
function mag(d: Float32Array, a: number, b: number, f: number) {
  const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR), c = 2 * Math.cos((2 * Math.PI * f) / SR); let s1 = 0, s2 = 0;
  for (let i = i0; i < i1; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); const s = d[i] * w + c * s1 - s2; s2 = s1; s1 = s; }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2));
}
/** band energy (dB) — sum of squared magnitudes over a 25 Hz grid */
function band(d: Float32Array, a: number, b: number, lo: number, hi: number) { let e = 0; for (let f = lo; f <= hi; f += 25) e += mag(d, a, b, f) ** 2; return 10 * Math.log10(e + 1e-12); }
function centroid(d: Float32Array, a: number, b: number) { let num = 0, den = 0; for (let f = 500; f <= 11000; f += 100) { const m = mag(d, a, b, f) ** 2; num += f * m; den += m; } return num / den; }
/** F0 by autocorrelation over [a,b] */
function f0(d: Float32Array, a: number, b: number) {
  const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR); let best = 0, lag = 0;
  for (let L = Math.floor(SR / 400); L <= Math.floor(SR / 70); L++) { let s = 0; for (let i = i0; i + L < i1; i++) s += d[i] * d[i + L]; if (s > best) { best = s; lag = L; } }
  return SR / lag;
}
const render = (ipa: string, v = MALE, o: Parameters<typeof planUtterance>[2] = { lang: 'op' }) => { const p = planUtterance(ipa, v, o); return { p, d: renderPlan(p, SR, v.seed ?? 1) }; };
const seg = (p: ReturnType<typeof planUtterance>, sym: string, nth = 0) => p.segments.filter(s => s.sym === sym)[nth];

describe('IPA → synthesiser mapping', () => {
  it('every IPA symbol of every lexicon entry referenced by a speech line is mapped', () => {
    for (const l of LINES) for (const id of l.def.words) {
      const e = lexEntry(id)!; const ph = tokenizeIpa(e.ipa!);
      expect(ph.length, id).toBeGreaterThan(0);
      for (const p of ph) expect(PHONES[p.sym], `${id}: ${p.sym}`).toBeTruthy();
    }
  });
  it('every speakable entry of all three lexicons tokenizes (murmur profiles use them all)', () => {
    const bad: string[] = [];
    for (const e of allLexEntries()) if (isSpeakable(e)) try { tokenizeIpa(e.ipa!); } catch (err) { bad.push(`${e.id}: ${(err as Error).message}`); }
    expect(bad).toEqual([]);
  });
  it('unmapped symbols are an error, never silently dropped', () => {
    expect(() => tokenizeIpa('ðɪs')).toThrow(IpaError);
    expect(() => tokenizeIpa('ːa')).toThrow(IpaError);
  });
  it('cleans lexicon IPA fields: notes, alternatives, logograms', () => {
    expect(cleanIpa('puça (ç value disputed: [θr]/[ç]/[s])')).toBe('puça');
    expect(cleanIpa('malk / malkaː')).toBe('malk');
    expect(cleanIpa('–')).toBeNull(); expect(cleanIpa(null)).toBeNull();
  });
  it('length, gemination, syllabic r, tie bar, pharyngealisation and diphthongs', () => {
    const at = tokenizeIpa('attata'); expect(at.map(p => p.sym + (p.long ? 'ː' : '')).join('')).toBe('atːata');
    expect(tokenizeIpa('wazr̩ka').find(p => p.sym === 'r')!.syllabic).toBe(true);
    expect(tokenizeIpa('tat͡ʃaram')[2].sym).toBe('t͡ʃ');
    expect(tokenizeIpa('ħintˤaː').find(p => p.sym === 't')!.pharyngealised).toBe(true);
    const nb = tokenizeIpa('naibam'); expect(nb[2].glide).toBe(true); expect(syllabify(nb).length).toBe(2);
    expect(syllabify(tokenizeIpa('xʃaːjaθija')).length).toBe(4);
  });
});

describe('formant synthesiser: measured output', () => {
  const vowel = (v: string) => { const { p, d } = render(v, MALE, { lang: 'op', intonation: 'level' }); const s = p.segments[0]; return { d, a: s.start + 0.04, b: s.end - 0.03 }; };
  it('vowels put their energy in the right formant regions', () => {
    const A = vowel('aː'), I = vowel('iː'), U = vowel('uː');
    // /a/: strong F1 (~730 Hz) region
    expect(band(A.d, A.a, A.b, 600, 900) - band(A.d, A.a, A.b, 1900, 2600)).toBeGreaterThan(15);
    // /i/: high F2 (~2250 Hz) far above /u/'s
    const i2 = band(I.d, I.a, I.b, 1900, 2700) - band(I.d, I.a, I.b, 150, 3500);
    const u2 = band(U.d, U.a, U.b, 1900, 2700) - band(U.d, U.a, U.b, 150, 3500);
    expect(i2 - u2).toBeGreaterThan(20);
    // /u/: low F2 (~850 Hz)
    expect(band(U.d, U.a, U.b, 600, 1000) - band(U.d, U.a, U.b, 1900, 2700)).toBeGreaterThan(20);
  });
  it('fricatives: /s/ is high-frequency noise, /ʃ/ lower, /x/ lower still; all weaker than the vowels', () => {
    const cs: Record<string, number> = {};
    for (const c of ['s', 'ʃ', 'x']) {
      const { p, d } = render(`a${c}a`); const s = seg(p, c); cs[c] = centroid(d, s.start + 0.02, s.end - 0.02);
      expect(dB(rms(d, s.start + 0.02, s.end - 0.02)), c).toBeLessThan(dB(rms(d, seg(p, 'a').start + 0.02, seg(p, 'a').end - 0.02)) - 5);
    }
    expect(cs.s).toBeGreaterThan(4800); expect(cs['ʃ']).toBeGreaterThan(2200); expect(cs['ʃ']).toBeLessThan(cs.s - 1000); expect(cs.x).toBeLessThan(cs['ʃ']);
  });
  it('voiceless stops have a silent closure then a burst', () => {
    const { p, d } = render('ata'); const t = seg(p, 't'), a = seg(p, 'a');
    const closure = rms(d, t.start + 0.015, t.start + 0.045), vow = rms(d, a.start + 0.02, a.end - 0.02);
    expect(dB(closure)).toBeLessThan(dB(vow) - 30);
  });
  it('prosody: F0 declines across a statement and rises at the end of a question', () => {
    const { p, d } = render('baɡa wazr̩ka auramazdaː', MALE, { lang: 'op', intonation: 'fall' });
    const first = seg(p, 'a', 0), last = p.segments[p.segments.length - 1];
    expect(f0(d, first.start + 0.01, first.end - 0.01)).toBeGreaterThan(f0(d, last.start + 0.05, last.end - 0.02) * 1.1);
    const q = planUtterance('halmi', MALE, { lang: 'el', intonation: 'rise' }), s = planUtterance('halmi', MALE, { lang: 'el', intonation: 'fall' });
    const endF0 = (pl: typeof q) => pl.frames[Math.floor((pl.duration - 0.1) / pl.frameSec)].f0;
    expect(endF0(q)).toBeGreaterThan(endF0(s) * 1.25);
  });
  it('stress follows the per-language working rule (all C) and lengthens the stressed vowel', () => {
    const op = planUtterance('martija', MALE, { lang: 'op' }).segments.filter(s => s.manner === 'vowel');
    expect(op.map(s => s.stressed)).toEqual([true, false, false]); // light penult → antepenult
    const arc = planUtterance('ʃəlaːm', MALE, { lang: 'arc' }).segments.filter(s => s.manner === 'vowel');
    expect(arc.map(s => s.stressed)).toEqual([false, true]);
    const el = planUtterance('uramasda', MALE, { lang: 'el' }).segments.filter(s => s.manner === 'vowel');
    expect(el[0].stressed).toBe(true);
    const mid = planUtterance('mamama', MALE, { lang: 'el' }).segments.filter(s => s.manner === 'vowel');
    expect(mid[0].end - mid[0].start).toBeGreaterThan((mid[1].end - mid[1].start) * 1.1);
    // Babylonian: last non-final heavy syllable, else the first (i.qab.bi → qab; bab.ba.nuː → bab)
    expect(planUtterance('iqabbi', MALE, { lang: 'bab' }).segments.filter(s => s.manner === 'vowel').map(s => s.stressed)).toEqual([false, true, false]);
    expect(planUtterance('babbanuː', MALE, { lang: 'bab' }).segments.filter(s => s.manner === 'vowel').map(s => s.stressed)).toEqual([true, false, false]);
    // Greek: the lexicon's accent mark wins over the fallback rule (ἡμέρη ɛːˈmerɛː)
    expect(planUtterance('ɛːˈmerɛː', MALE, { lang: 'grc' }).segments.filter(s => s.manner === 'vowel').map(s => s.stressed)).toEqual([false, true, false]);
  });
  it('aspirated stops (Greek pʰ tʰ kʰ) are tokenized and released with a longer voiceless interval than plain ones', () => {
    const k = tokenizeIpa('ˈkʰaire'); expect(k[0].sym).toBe('k'); expect(k[0].aspirated).toBe(true);
    expect(() => tokenizeIpa('aʰ')).toThrow(IpaError);
    const dur = (ipa: string) => { const p = planUtterance(ipa, MALE, { lang: 'grc' }); const a = p.segments.find(s => s.sym === 'a')!; const kk = p.segments[0]; return a.start - kk.start; };
    expect(dur('kʰa')).toBeGreaterThan(dur('ka') + 0.03);
  });
  it('voices: female and child are higher than male, children have shorter vocal tracts; rate shortens', () => {
    expect(voiceBase({ ...MALE, sex: 'f' }).f0).toBeGreaterThan(voiceBase(MALE).f0 * 1.5);
    expect(voiceBase({ ...MALE, age: 8 }).formantScale).toBeGreaterThan(voiceBase({ ...MALE, sex: 'f' }).formantScale);
    const { d: dm } = render('aː', MALE), { d: df } = render('aː', { ...MALE, sex: 'f' });
    expect(f0(df, 0.06, 0.2)).toBeGreaterThan(f0(dm, 0.06, 0.2) * 1.5);
    expect(planUtterance('ʃəlaːm', { ...MALE, rate: 1.5 }).duration).toBeLessThan(planUtterance('ʃəlaːm', MALE).duration * 0.8);
  });
  it('is deterministic per seed, finite, and peak-normalised', () => {
    const a = render('ʃəlaːm maːreːʔ').d, b = render('ʃəlaːm maːreːʔ').d, c = render('ʃəlaːm maːreːʔ', { ...MALE, seed: 9 }).d;
    expect(a).toEqual(b); expect(a).not.toEqual(c);
    let m = 0; for (const x of a) { expect(Number.isFinite(x)).toBe(true); m = Math.max(m, Math.abs(x)); }
    expect(m).toBeGreaterThan(0.5); expect(m).toBeLessThanOrEqual(0.8001);
  });
  it('every scripted line renders to 0.3–4 s of audio', () => {
    const fb = new FormantBackend(SR);
    for (const l of LINES) { const c = fb.renderSync({ ipa: l.ipa, lang: l.lang, voice: MALE, intonation: l.intonation }); const s = c.data.length / c.sampleRate; expect(s, l.id).toBeGreaterThan(0.3); expect(s, l.id).toBeLessThan(4); expect(c.tier).toBe('C'); }
  });
});

describe('swappable backends', () => {
  it('recordings must be local: network URLs are refused', () => {
    expect(() => assertLocalUrl('https://example.com/a.ogg')).toThrow();
    expect(() => assertLocalUrl('//cdn.example/a.ogg')).toThrow();
    expect(assertLocalUrl('voices/arc.greet.slm.m1.ogg')).toBe('voices/arc.greet.slm.m1.ogg');
    expect(() => new RecordingBackend({ x: { url: 'http://x/y.ogg', tier: 'C' } })).toThrow();
  });
  it('a recording backend passes on lines it has no recording for (next backend synthesises)', async () => {
    const rb = new RecordingBackend({ 'arc.greet.slm': { url: 'voices/slm.ogg', tier: 'C' } }, async () => { throw new Error('must not fetch'); });
    expect(await rb.render({ ipa: 'ʃəlaːm', voice: MALE, lineId: 'arc.count.hd_trn_tlt' }, {} as BaseAudioContext)).toBeNull();
  });
});

describe('speech lines: selection', () => {
  it('Persians greet in Aramaic (no attested OP greeting); Old-Persian-only speakers and Egyptians answer with gesture', () => {
    expect(pickLine({ langs: ['Old Persian', 'Aramaic'], intent: 'greet' })!.line.lang).toBe('arc');
    expect(pickLine({ langs: ['Old Persian'], intent: 'greet' })).toBeNull();
    expect(pickLine({ langs: ['Egyptian'], intent: 'greet' })).toBeNull();
    expect(pickLine({ langs: ['Old Persian', 'Elamite'], intent: 'farewell' })!.line.lang).toBe('op');
  });
  it('Babylonian and Greek speakers get lines in their own language (D-105, D-106); Egyptians and Lydians still gesture', () => {
    expect(pickLine({ langs: ['Babylonian'], intent: 'greet' })!.line.lang).toBe('bab');
    expect(pickLine({ langs: ['Greek', 'Aramaic'], intent: 'greet', role: 'mason' })!.line.lang).toBe('grc');
    // the sim lists Aramaic first for its Babylonians: Aramaic where it has a line, Babylonian where it has none
    expect(pickLine({ langs: ['Aramaic', 'Babylonian'], intent: 'greet', role: 'scribe' })!.line.lang).toBe('arc');
    expect(pickLine({ langs: ['Aramaic', 'Babylonian'], intent: 'pious', role: 'scribe' })!.line.lang).toBe('bab');
    for (const lang of ['Lydian', 'Egyptian']) expect(pickLine({ langs: [lang], intent: 'greet' })).toBeNull();
    const per: Record<string, number> = {};
    for (const l of LINES) per[l.lang] = (per[l.lang] ?? 0) + 1;
    for (const lang of ['op', 'el', 'arc', 'bab', 'grc']) expect(per[lang] ?? 0, lang).toBeGreaterThanOrEqual(10);
    for (const intent of ['greet', 'reply', 'farewell', 'refuse'] as const) for (const lang of ['Aramaic', 'Babylonian', 'Greek'])
      expect(pickLine({ langs: [lang], intent }), `${lang} ${intent}`).not.toBeNull();
  });
  it('role-restricted lines only go to those roles', () => {
    expect(pickLine({ langs: ['Elamite'], intent: 'ask_document', role: 'guard' })!.line.id).toBe('el.ask_document.halmi');
    expect(pickLine({ langs: ['Elamite'], intent: 'ask_document', role: 'child' })).toBeNull();
  });
  it('voices are deterministic per person; children get child voices', () => {
    expect(voiceFor({ seed: 5, sex: 'f' })).toEqual(voiceFor({ seed: 5, sex: 'f' }));
    expect(voiceFor({ seed: 5, sex: 'm', role: 'child' }).age).toBeLessThan(13);
  });
  it('every omitted line is recorded as a lexicon gap with an open-question id', () => {
    expect(LEXICON_GAPS.length).toBeGreaterThan(5);
    for (const g of LEXICON_GAPS) expect(g.q).toMatch(/^Q-\d{3}$/);
    expect(LINE_DEFS.some(d => d.lang === 'op')).toBe(true);
  });
});

describe('crowd murmur profiles', () => {
  it('are built from each lexicon and differ in the way the languages do', () => {
    const op = buildProfile('op'), el = buildProfile('el'), arc = buildProfile('arc');
    expect(arc.nuclei.get('ə')).toBeGreaterThan(0); expect(op.nuclei.has('ə')).toBe(false);
    expect([...arc.initialOnsets.keys()]).toContain('ʔ');
    expect([...op.initialOnsets.keys()]).toContain('xʃ');
    expect(op.nuclei.get('aː')).toBeGreaterThan(10);
    expect(el.finalCodas.get('ʃ')).toBeGreaterThan(3);
  });
  it('pseudo-phrases are deterministic per seed, pronounceable by the synthesiser, and not lexicon words', () => {
    const p = buildProfile('el');
    expect(pseudoPhrase(p, new Rng(4, 'x'))).toEqual(pseudoPhrase(p, new Rng(4, 'x')));
    const forms = new Set(allLexEntries().map(e => e.ipa));
    const r = new Rng(2, 'y'); let same = 0;
    for (let i = 0; i < 200; i++) { const ph = pseudoPhrase(p, r); expect(() => tokenizeIpa(ph.ipa)).not.toThrow(); for (const w of ph.ipa.split(' ')) if (forms.has(w)) same++; }
    expect(same).toBeLessThan(40); // mostly non-words; an occasional real short word is harmless
  });
});

describe('pre-rendered voices (eSpeak-NG from the lexicon IPA; tools/build_speech.py)', () => {
  it('every scripted line has all six voice classes, as local clips of plausible length; voice classes cover every speaker', async () => {
    const { readFileSync, statSync } = await import('node:fs');
    const { LINES, voiceKeyFor, voiceFor } = await import('../src/people/speech_lines');
    const man = JSON.parse(readFileSync('public/voices/manifest.json', 'utf8'));
    // languages with no eSpeak voice are declared formant-only in the manifest (D-107): they must have no clip at all (the
    // runtime formant synthesiser voices them) and a stated reason; every other line needs all six clips
    const formantOnly: Record<string, string> = man._meta.formant_only ?? {};
    expect(Object.keys(formantOnly)).toEqual(['bab']);
    for (const l of LINES) for (const k of ['m1', 'm2', 'm3', 'f1', 'f2', 'c1']) {
      const c = man.clips[`${l.id}|${k}`];
      if (formantOnly[l.lang]) { expect(c, `${l.id}|${k} is formant-only`).toBeUndefined(); expect(formantOnly[l.lang].length).toBeGreaterThan(20); continue; }
      expect(c, `${l.id}|${k}`).toBeTruthy();
      expect(c.url).toMatch(/^voices\/[^/]+\.ogg$/); const size = statSync('public/' + c.url).size; expect(size).toBeGreaterThan(1500); expect(size).toBeLessThan(40000);
    }
    // no orphan clips: every manifest entry belongs to a current line
    const ids = new Set(LINES.map(l => l.id));
    for (const key of Object.keys(man.clips)) expect(ids.has(key.split('|')[0]), key).toBe(true);
    const keys = new Set<string>(); for (let s = 0; s < 400; s++) for (const sex of ['m', 'f'] as const) for (const role of ['guard', 'child', 'baker']) keys.add(voiceKeyFor(voiceFor({ seed: s, sex, role })));
    expect([...keys].sort()).toEqual(['c1', 'f1', 'f2', 'm1', 'm2', 'm3']);
  });
});
