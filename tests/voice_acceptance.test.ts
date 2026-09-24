// The machine part of the §10 voice acceptance (D-167, D-185). tools/voice_acceptance.py measures every pre-rendered clip
// (Praat pitch and formants) and writes research/voice_acceptance.json; this test checks that the report measured exactly
// the clips that ship (by sha256), and recomputes the D-185 thresholds from its per-clip numbers, so neither a re-render
// without a re-measurement nor an edited summary can pass. The acceptance itself is a human rating (REAL_HARDWARE_TODO
// H8): these are its measurable preconditions, not the rating.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LINES } from '../src/people/speech_lines';
import { markStress } from '../src/audio/speech';

const rep = JSON.parse(readFileSync('research/voice_acceptance.json', 'utf8'));
const man = JSON.parse(readFileSync('public/voices/manifest.json', 'utf8'));
/** D-185's thresholds; the report must have used these (a lowered threshold in the report fails here) */
const T = { T1_sd: 1.0, T2_median_st: 3.0, T2_min_st: 2.0, T2_share: 0.8, T3_rise_st: 1.0, T3_fall_st: -1.0, T3_share: 0.9, T4_inside: 0.85 };
const GROUP: Record<string, string> = { m1: 'men', m2: 'men', m3: 'men', f1: 'women', f2: 'women', c1: 'children' };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const clips: any[] = rep.clips;

describe('voice acceptance, machine part (tools/voice_acceptance.py; D-185)', () => {
  it('the report measured exactly the clips that ship, with D-185\'s thresholds and the Hillenbrand 1995 norms', () => {
    expect(rep._meta.thresholds).toEqual(T);
    const measured = new Map(clips.map(c => [`${c.line}|${c.voice}`, c.sha256]));
    expect([...measured.keys()].sort()).toEqual(Object.keys(man.clips).sort());
    for (const [key, c] of Object.entries<any>(man.clips)) expect(measured.get(key), `${key}: re-run tools/voice_acceptance.py`).toBe(c.sha256);
    // H95 vowdata (tokens pooled): men 131.2 ± 22.0, women 220.4 ± 23.2, children (boys + girls) 236.9 ± 25.9
    expect(rep._meta.norms.men.f0_mean).toBeCloseTo(131.2, 0); expect(rep._meta.norms.women.f0_mean).toBeCloseTo(220.4, 0);
    expect(rep._meta.norms.children.f0_mean).toBeGreaterThan(230); expect(rep._meta.norms.children.f0_mean).toBeLessThan(245);
  });

  it('what the clips voice: the line\'s IPA with the formant voice\'s stress marked, and the utterance type', () => {
    for (const L of LINES) {
      const v = man.lines[L.id]; if (!v) continue; // formant-only (Babylonian)
      expect(markStress(L.ipa, L.lang).replace(/ˈ/g, ''), L.id).toBe(L.ipa.normalize('NFC').replace(/ˈ/g, ''));
      expect(v.stressed, `${L.id}: stale stress (re-run tools/build_speech.py)`).toBe(markStress(L.ipa, L.lang));
      expect(['statement', 'greeting', 'command', 'question', 'list']).toContain(v.utterance);
      if (L.intonation === 'rise') expect(v.utterance, L.id).toBe('question');
      expect(rep.lines[L.id]?.utterance, L.id).toBe(v.utterance);
    }
  });

  it('T1 pitch: every voice class\'s median F0 lies within its Hillenbrand group mean ± 1 SD (D-167: men were 2 SD low)', () => {
    for (const key of Object.keys(GROUP)) {
      const n = rep._meta.norms[GROUP[key]], f = median(clips.filter(c => c.voice === key).map(c => c.f0_median));
      expect(f, `${key} median F0`).toBeGreaterThanOrEqual(n.f0_mean - T.T1_sd * n.f0_sd);
      expect(f, `${key} median F0`).toBeLessThanOrEqual(n.f0_mean + T.T1_sd * n.f0_sd);
    }
  });

  it('T2 not monotone: median F0 5-95 % range ≥ 3 semitones and ≥ 80 % of clips ≥ 2 (D-167: 0.6-1.5)', () => {
    const r = clips.map(c => c.range_st);
    expect(median(r)).toBeGreaterThanOrEqual(T.T2_median_st);
    expect(r.filter(x => x >= T.T2_min_st).length / r.length).toBeGreaterThanOrEqual(T.T2_share);
  });

  it('T3 contour by utterance type: questions end rising; statements, greetings and commands end falling', () => {
    const ut = (c: any) => man.lines[c.line].utterance;
    const falling = (c: any) => c.nuclear_fall_st <= T.T3_fall_st && c.nuclear_rise_st < T.T3_rise_st;
    const rising = (c: any) => c.nuclear_rise_st >= T.T3_rise_st && c.nuclear_fall_st > T.T3_fall_st;
    const q = clips.filter(c => ut(c) === 'question'); expect(q.length).toBeGreaterThan(0);
    for (const c of q) expect(rising(c), `${c.line}|${c.voice} does not end rising`).toBe(true);
    for (const t of ['statement', 'greeting', 'command']) {
      const cs = clips.filter(c => ut(c) === t); expect(cs.length, t).toBeGreaterThan(0);
      expect(cs.filter(falling).length / cs.length, `${t}: share ending in a fall`).toBeGreaterThanOrEqual(T.T3_share);
    }
  });

  it('T4 vowels: the median share of loud voiced frames inside the Hillenbrand vowel space is ≥ 85 % per talker group', () => {
    for (const g of ['men', 'women', 'children']) {
      const v = clips.filter(c => GROUP[c.voice] === g && c.vowel_inside != null).map(c => c.vowel_inside);
      expect(median(v), g).toBeGreaterThanOrEqual(T.T4_inside);
    }
  });
});
