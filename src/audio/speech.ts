// Minimal speech pipeline (brief §10 "Voice", Phase 3 "a minimal speech … pipeline").
//
//   lexicon IPA ──tokenizeIpa──▶ phones ──planUtterance──▶ 5 ms parameter frames ──renderPlan──▶ PCM ──▶ Web Audio
//                                  (phonemes.ts)            (durations, formant       (Klatt-type source-filter:     (AudioBuffer →
//                                                            targets, prosody)         glottal pulse + cascade        HRTF panner →
//                                                                                      formants, frication noise)     e.ch.voices)
//
// No external TTS and no network service: the synthesiser is ~300 lines of DSP in this file. It renders to a PCM array
// rather than to a live node graph so the same code can (a) be measured in node by the unit tests (formant peaks,
// frication bands, durations, declination), (b) pre-render lines at build time later ("pre-rendered at build time where
// possible"), and (c) be swapped: anything that implements VoiceBackend (recordings, a better TTS) replaces it without
// touching callers ("the pipeline accepts better voices or my own recordings later").
//
// Honesty: everything acoustic here is tier C — generic formant values, invented prosody rules (the accent of Old Persian
// and Elamite is unknown), a robotic source model. It is a PLACEHOLDER-QUALITY voice: intelligibility/naturalness have not
// been rated by the reviewer yet (brief §10 acceptance).
import type { AudioEngine } from './engine';
import { tokenizeIpa, syllabify, Phone } from './phonemes';
import type { LangId } from '../lang/lexicon';

export interface Vec3 { x: number; y: number; z: number }
export interface VoiceParams {
  sex: 'm' | 'f';
  /** years; < 13 renders a child voice */
  age: number;
  /** multiplier on the sex/age base F0 (≈0.8–1.25) */
  pitch: number;
  /** multiplier on speaking rate (1 = default; >1 faster) */
  rate: number;
  /** extra breathiness 0–1 (optional) */
  breath?: number;
  /** jitter/noise seed (deterministic output) */
  seed?: number;
}
export type Intonation = 'fall' | 'rise' | 'level';

/** Stress placement per language. None is attested; all are working rules (tier C), logged in OPEN_QUESTIONS. */
export type StressRule = 'penult-weight' | 'initial' | 'final' | 'last-heavy';
export const STRESS_RULES: Record<LangId, { rule: StressRule; tier: 'C'; note: string }> = {
  op: { rule: 'penult-weight', tier: 'C', note: 'Old Persian accent is not recoverable from the script; a weight-sensitive penult/antepenult rule is a neutral default' },
  el: { rule: 'initial', tier: 'C', note: 'Achaemenid Elamite accent unknown; word-initial stress assumed' },
  arc: { rule: 'final', tier: 'C', note: 'mostly final stress as in the Tiberian tradition of Biblical Aramaic (a much later vocalisation) — applied to 5th-c. Imperial Aramaic by assumption' },
  bab: { rule: 'last-heavy', tier: 'C', note: 'Akkadian stress is not written; the usual modern reconstruction (last non-final heavy syllable, else the first) is assumed for Late Babylonian' },
  grc: { rule: 'penult-weight', tier: 'C', note: 'Greek lexicon IPA marks the edition accent (ˈ, a pitch accent, rendered as prominence); unmarked words (crowd murmur) fall back to a weight-sensitive penult rule' },
};

export function voiceBase(v: VoiceParams): { f0: number; formantScale: number; breath: number } {
  let f0: number, formantScale: number, breath: number;
  if (v.age < 13) { f0 = 275; formantScale = 1.28; breath = 0.1; }
  else if (v.sex === 'f') { f0 = v.age > 50 ? 190 : 205; formantScale = 1.16; breath = 0.08; }
  else { f0 = v.age > 55 ? 122 : v.age < 18 ? 150 : 115; formantScale = v.age < 18 ? 1.08 : 1; breath = 0.03; }
  return { f0: f0 * v.pitch, formantScale, breath: breath + (v.breath ?? 0) };
}

export interface Frame {
  f0: number; av: number; ah: number; af: number;
  F1: number; F2: number; F3: number; B1: number; B2: number; B3: number;
  ff: number; fbw: number; nasal: number; trill: number;
}
export interface Segment { sym: string; manner: string; start: number; end: number; stressed: boolean; word: number }
export interface Plan { frames: Frame[]; frameSec: number; duration: number; segments: Segment[]; f0Base: number; formantScale: number }

interface Phase {
  dur: number; av: number; ah: number; af: number; F: [number, number, number]; B1: number; ff: number; fbw: number;
  nasal: number; trill: number; burst?: boolean; creak?: boolean; stressedNucleus?: boolean; seg?: number;
}

const FRAME = 0.005;

function stressIndex(n: number, sylls: ReturnType<typeof syllabify>, rule: StressRule): number {
  if (n <= 1) return 0;
  if (rule === 'initial') return 0;
  if (rule === 'final') return n - 1;
  if (rule === 'last-heavy') { for (let k = n - 2; k >= 0; k--) if (sylls[k].heavy) return k; return 0; }
  if (sylls[n - 2].heavy || n === 2) return n - 2;
  return n - 3;
}

/**
 * Turn an IPA string into timed synthesis frames. Deterministic (no randomness here).
 * Throws IpaError for an unmapped symbol.
 */
export function planUtterance(ipa: string, voice: VoiceParams, opts: { lang?: LangId; intonation?: Intonation } = {}): Plan {
  const phones = tokenizeIpa(ipa);
  const { f0: f0Base, formantScale: sc, breath } = voiceBase(voice);
  const rule = STRESS_RULES[opts.lang ?? 'arc'].rule;
  const rate = Math.max(0.4, voice.rate);
  // stress + phrase-final syllable
  const stressed = new Set<Phone>(), finalSyl = new Set<Phone>();
  const words = new Map<number, Phone[]>();
  for (const p of phones) { if (!words.has(p.word)) words.set(p.word, []); words.get(p.word)!.push(p); }
  const lastWord = Math.max(...words.keys());
  for (const [w, ps] of words) {
    const syl = syllabify(ps); if (!syl.length) continue;
    const marked = syl.findIndex(s => [...s.onset, s.nucleus].some(p => p.stressMark === 1));
    const si = marked >= 0 ? marked : stressIndex(syl.length, syl, rule);
    stressed.add(syl[si].nucleus);
    if (w === lastWord) { const s = syl[syl.length - 1]; for (const p of [s.nucleus, ...s.coda]) finalSyl.add(p); }
  }
  const scale3 = (F: readonly number[]): [number, number, number] => [F[0] * sc, F[1] * sc, F[2] * sc];
  const nextVowel = (i: number) => { for (let k = i + 1; k < phones.length; k++) if (phones[k].def.manner === 'vowel') return phones[k]; return null; };
  const prevVowel = (i: number) => { for (let k = i - 1; k >= 0; k--) if (phones[k].def.manner === 'vowel') return phones[k]; return null; };
  const phases: Phase[] = [];
  const segments: Segment[] = [];
  const silence = (dur: number): Phase => ({ dur, av: 0, ah: 0, af: 0, F: scale3([500, 1500, 2500]), B1: 90, ff: 3000, fbw: 1000, nasal: 0, trill: 0 });
  phases.push(silence(0.03));
  phones.forEach((p, i) => {
    const d = p.def, prev = phones[i - 1], next = phones[i + 1];
    const pharCtx = [prev, p, next].some(q => q && (q.pharyngealised || q.def.place === 'pharyngeal'));
    const lenK = (p.long ? (d.manner === 'vowel' ? 1.75 : 1.8) : 1) * (finalSyl.has(p) ? 1.3 : 1) / rate;
    const nv = nextVowel(i) ?? prevVowel(i);
    const colour = (w: number): [number, number, number] => { // blend consonant locus with the neighbouring vowel
      const v = nv ? nv.def.F : d.F; return scale3([d.F[0] * w + v[0] * (1 - w), d.F[1] * w + v[1] * (1 - w), d.F[2] * w + v[2] * (1 - w)]);
    };
    const segStart = phases.length;
    switch (d.manner) {
      case 'vowel': {
        const isStressed = stressed.has(p);
        let F = scale3(d.F);
        if (pharCtx) F = [F[0] * 1.08, F[1] * 0.85, F[2]];
        const dur = p.glide ? 0.045 / rate : (d.dur / 1000) * lenK * (isStressed ? 1.2 : 1);
        const v: Phase = { dur, av: p.glide ? 0.8 : isStressed ? 1 : 0.82, ah: breath, af: 0, F, B1: 80, ff: 3000, fbw: 1000, nasal: 0, trill: 0, stressedNucleus: isStressed };
        if (prev?.sym === 'ʔ' && dur > 0.06) { phases.push({ ...v, dur: 0.04, creak: true, stressedNucleus: false }); v.dur -= 0.04; }
        phases.push(v);
        break;
      }
      case 'stop': case 'affricate': {
        const clos = (d.dur / 1000) * (p.long ? 1.8 : 1) / rate;
        const locus = scale3([200, d.F[1] * 0.6 + (nv ? nv.def.F[1] * 0.4 : d.F[1] * 0.4), d.F[2]]);
        phases.push({ dur: clos, av: d.voiced ? 0.2 : 0, ah: 0, af: 0, F: locus, B1: 120, ff: 3000, fbw: 1000, nasal: 0, trill: 0, creak: d.place === 'glottal' });
        if (d.burst) phases.push({ dur: 0.008, av: d.voiced ? 0.3 : 0, ah: 0, af: d.burst.amp, F: locus, B1: 120, ff: d.burst.f, fbw: d.burst.bw, nasal: 0, trill: 0, burst: true });
        if (d.manner === 'affricate' && d.fric) phases.push({ dur: 0.075 / rate, av: 0, ah: 0, af: d.fric.amp, F: colour(0.5), B1: 120, ff: d.fric.f, fbw: d.fric.bw, nasal: 0, trill: 0 });
        else if (!d.voiced && d.place !== 'glottal' && (p.aspirated || (next && next.def.voiced))) {
          // aspirated stops (Greek pʰ tʰ kʰ) get a long voiceless release, plain voiceless stops a short one (C)
          const asp = (p.aspirated ? 0.07 : p.word !== prev?.word || (next && stressed.has(next)) ? 0.035 : 0.02) / rate;
          phases.push({ dur: asp, av: 0, ah: 0.35, af: 0, F: colour(0.2), B1: 150, ff: 3000, fbw: 1000, nasal: 0, trill: 0 });
        }
        break;
      }
      case 'fricative': {
        const dur = (d.dur / 1000) * (p.long ? 1.8 : 1) / rate * (finalSyl.has(p) ? 1.15 : 1);
        const F = d.aspirate ? colour(0.25) : colour(0.5);
        phases.push({ dur, av: d.voiced ? (d.place === 'pharyngeal' ? 0.7 : 0.45) : 0, ah: d.aspirate ? 0.5 : 0, af: d.fric ? d.fric.amp : 0,
          F: d.place === 'pharyngeal' && d.voiced ? scale3(d.F) : F, B1: 110, ff: d.fric?.f ?? 3000, fbw: d.fric?.bw ?? 1000, nasal: 0, trill: 0, creak: d.place === 'pharyngeal' && d.voiced });
        break;
      }
      case 'nasal':
        phases.push({ dur: (d.dur / 1000) * lenK, av: 0.55, ah: 0, af: 0, F: scale3(d.F), B1: 160, ff: 3000, fbw: 1000, nasal: 1, trill: 0 });
        break;
      case 'approximant': case 'lateral':
        phases.push({ dur: (d.dur / 1000) * lenK, av: d.manner === 'lateral' ? 0.75 : 0.8, ah: 0, af: 0, F: scale3(d.F), B1: 100, ff: 3000, fbw: 1000, nasal: 0, trill: 0 });
        break;
      case 'trill': {
        const syll = p.syllabic;
        const isStressed = stressed.has(p);
        phases.push({ dur: (syll ? 0.09 : d.dur / 1000) * lenK * (isStressed ? 1.2 : 1), av: syll ? 0.9 : 0.7, ah: 0, af: 0,
          F: syll ? scale3([500, 1350, 1700]) : scale3(d.F), B1: 100, ff: 3000, fbw: 1000, nasal: 0, trill: 1, stressedNucleus: isStressed });
        break;
      }
    }
    for (let k = segStart; k < phases.length; k++) phases[k].seg = segments.length;
    segments.push({ sym: p.sym + (p.long ? 'ː' : ''), manner: d.manner, start: 0, end: 0, stressed: stressed.has(p), word: p.word });
  });
  phases.push(silence(0.09));
  // lay phases on the time axis
  let t = 0; const starts: number[] = [];
  for (const ph of phases) { starts.push(t); t += ph.dur; }
  const T = t;
  for (let k = 0; k < phases.length; k++) {
    const s = phases[k].seg; if (s == null) continue;
    if (segments[s].start === 0 && segments[s].end === 0) segments[s].start = starts[k];
    segments[s].end = starts[k] + phases[k].dur;
  }
  // prosody: declination, stress bumps, final fall/rise, creak
  const bumps = phases.map((ph, k) => (ph.stressedNucleus ? starts[k] + ph.dur / 2 : -1)).filter(c => c >= 0);
  const intonation = opts.intonation ?? 'fall';
  const nF = Math.ceil(T / FRAME) + 1;
  const frames: Frame[] = [];
  const aF = 1 - Math.exp(-FRAME / 0.022), aA = 1 - Math.exp(-FRAME / 0.006), aN = 1 - Math.exp(-FRAME / 0.004);
  let k = 0, cur: Frame | null = null;
  for (let f = 0; f < nF; f++) {
    const tf = f * FRAME;
    while (k < phases.length - 1 && tf >= starts[k] + phases[k].dur) k++;
    const ph = phases[k];
    let f0 = f0Base * (1.08 - 0.16 * (tf / T));
    const tail = T - 0.09 - tf; // time to the end of the last phone
    if (tail < 0.28) { const u = Math.min(1, Math.max(0, 1 - tail / 0.28)); f0 *= intonation === 'rise' ? 1 + 0.28 * u : intonation === 'fall' ? 1 - 0.14 * u : 1; }
    let b = 0; for (const c of bumps) b += Math.exp(-(((tf - c) / 0.07) ** 2));
    f0 *= 1 + 0.14 * Math.min(1, b);
    if (ph.creak) f0 *= 0.72;
    const ampDecl = 1 - 0.22 * (tf / T);
    const tgt: Frame = { f0, av: ph.av * ampDecl, ah: ph.ah * ampDecl, af: ph.af, F1: ph.F[0], F2: ph.F[1], F3: ph.F[2], B1: ph.B1 * Math.sqrt(sc), B2: 100 * sc, B3: 160 * sc,
      ff: ph.ff, fbw: ph.fbw, nasal: ph.nasal, trill: ph.trill };
    if (!cur) cur = { ...tgt };
    else {
      cur.f0 += (tgt.f0 - cur.f0) * 0.5;
      for (const key of ['F1', 'F2', 'F3', 'B1', 'B2', 'B3'] as const) cur[key] += (tgt[key] - cur[key]) * aF;
      cur.av += (tgt.av - cur.av) * aA; cur.ah += (tgt.ah - cur.ah) * aA; cur.nasal += (tgt.nasal - cur.nasal) * aA;
      cur.af = ph.burst ? tgt.af : cur.af + (tgt.af - cur.af) * aN;
      cur.ff = tgt.ff; cur.fbw = tgt.fbw; cur.trill = tgt.trill;
    }
    frames.push({ ...cur });
  }
  return { frames, frameSec: FRAME, duration: T, segments, f0Base, formantScale: sc };
}

// ---------------------------------------------------------------- DSP
/** Klatt digital resonator (unity DC gain), coefficients from centre f and bandwidth bw at sample period T. */
class Resonator {
  a = 1; b = 0; c = 0; y1 = 0; y2 = 0;
  set(f: number, bw: number, sr: number) {
    const T = 1 / sr; this.c = -Math.exp(-2 * Math.PI * bw * T); this.b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T); this.a = 1 - this.b - this.c;
  }
  run(x: number) { const y = this.a * x + this.b * this.y1 + this.c * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
}
/** RBJ band-pass (0 dB peak) for frication noise. */
class BandPass {
  b0 = 0; b2 = 0; a1 = 0; a2 = 0; x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(f: number, bw: number, sr: number) {
    f = Math.min(f, sr * 0.45); const w = (2 * Math.PI * f) / sr, Q = Math.max(0.3, f / Math.max(bw, 50)), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
    this.b0 = al / a0; this.b2 = -al / a0; this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) { const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
/** Rosenberg-type glottal flow pulse over one period (phase 0–1): rise 40 %, fall 16 %, closed 44 %. */
function glottalFlow(ph: number): number {
  if (ph < 0.4) return 0.5 * (1 - Math.cos((Math.PI * ph) / 0.4));
  if (ph < 0.56) return Math.cos((Math.PI * (ph - 0.4)) / 0.32);
  return 0;
}

/** Relative level of frication/aspiration against voicing (set by measurement in tests/speech.test.ts). */
const FRIC_GAIN = 0.9, ASP_GAIN = 0.12, BURST_GAIN = 1.3;

/** Render a plan to mono PCM. Deterministic for a given seed. Peak-normalised to `peak`. */
export function renderPlan(plan: Plan, sampleRate = 24000, seed = 1, peak = 0.8): Float32Array {
  const n = Math.ceil(plan.duration * sampleRate);
  const out = new Float32Array(n);
  const R = [new Resonator(), new Resonator(), new Resonator(), new Resonator(), new Resonator()];
  const Rn = new Resonator(); Rn.set(270 * plan.formantScale, 110, sampleRate);
  const fr = new BandPass();
  const sc = plan.formantScale;
  R[3].set(Math.min(3500 * sc, sampleRate * 0.45), 300, sampleRate); R[4].set(Math.min(4500 * sc, sampleRate * 0.47), 450, sampleRate);
  let s = (seed * 2654435761) >>> 0 || 1;
  const noise = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; };
  let phase = 0, prevFlow = 0, jit = 0, shim = 1, hp = 0, hpIn = 0;
  const F = plan.frames, fs = plan.frameSec;
  let p: Frame = F[0];
  const UPD = 24;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (i % UPD === 0) {
      const fi = Math.min(F.length - 1.001, t / fs), k = Math.floor(fi), u = fi - k, A = F[k], B = F[Math.min(k + 1, F.length - 1)];
      const L = (x: number, y: number) => x + (y - x) * u;
      p = { f0: L(A.f0, B.f0), av: L(A.av, B.av), ah: L(A.ah, B.ah), af: L(A.af, B.af), F1: L(A.F1, B.F1), F2: L(A.F2, B.F2), F3: L(A.F3, B.F3),
        B1: L(A.B1, B.B1), B2: L(A.B2, B.B2), B3: L(A.B3, B.B3), ff: A.ff, fbw: A.fbw, nasal: L(A.nasal, B.nasal), trill: A.trill };
      R[0].set(p.F1, p.B1, sampleRate); R[1].set(p.F2, p.B2, sampleRate); R[2].set(Math.min(p.F3, sampleRate * 0.44), p.B3, sampleRate);
      fr.set(p.ff, p.fbw, sampleRate);
    }
    // glottal source (flow derivative = source + lip radiation), jitter 1 %, shimmer 3 %
    phase += (p.f0 * (1 + jit)) / sampleRate;
    if (phase >= 1) { phase -= 1; jit = noise() * 0.01; shim = 1 + noise() * 0.03; }
    const flow = glottalFlow(phase);
    let voice = (flow - prevFlow) * (sampleRate / p.f0) * 0.12 * p.av * shim; prevFlow = flow;
    if (p.trill > 0.5) voice *= 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(2 * Math.PI * 26 * t));
    const asp = noise() * p.ah * ASP_GAIN * (0.6 + 0.4 * flow);
    let y = voice + asp;
    for (let r = 0; r < 5; r++) y = R[r].run(y);
    if (p.nasal > 0.01) y = y * (1 - 0.6 * p.nasal) + Rn.run(voice) * 0.9 * p.nasal; else Rn.run(voice);
    const fric = fr.run(noise() * p.af) * (p.af > 0.5 ? BURST_GAIN : FRIC_GAIN);
    const x = y + fric;
    // DC blocker (~40 Hz)
    hp = x - hpIn + 0.995 * hp; hpIn = x;
    out[i] = hp;
  }
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) { const g = peak / m; for (let i = 0; i < n; i++) out[i] *= g; }
  // 4 ms fade in/out
  const fd = Math.floor(sampleRate * 0.004); for (let i = 0; i < fd && i < n; i++) { const g = i / fd; out[i] *= g; out[n - 1 - i] *= g; }
  return out;
}

// ---------------------------------------------------------------- swappable backends
export interface SpeechRequest { ipa: string; lang?: LangId; voice: VoiceParams; intonation?: Intonation; lineId?: string; voiceKey?: string }
export interface AudioClip { sampleRate: number; data: Float32Array; backend: string; tier: string }
/**
 * A voice backend turns a request into audio. Backends are tried in order; the first non-null result wins, so a
 * RecordingBackend placed before the FormantBackend replaces synthesis line by line as recordings arrive.
 */
export interface VoiceBackend {
  readonly id: string;
  render(req: SpeechRequest, ctx: BaseAudioContext | null): Promise<AudioClip | AudioBuffer | null>;
}

/** The built-in formant synthesiser (tier C, placeholder quality). */
export class FormantBackend implements VoiceBackend {
  readonly id = 'formant';
  constructor(readonly sampleRate = 24000) {}
  renderSync(req: SpeechRequest): AudioClip {
    const plan = planUtterance(req.ipa, req.voice, { lang: req.lang, intonation: req.intonation });
    return { sampleRate: this.sampleRate, data: renderPlan(plan, this.sampleRate, req.voice.seed ?? 1), backend: this.id, tier: 'C' };
  }
  render(req: SpeechRequest): Promise<AudioClip> { return Promise.resolve(this.renderSync(req)); }
}

/** Only same-origin relative paths: the pipeline must never call a network service. */
export function assertLocalUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) throw new Error(`speech: recordings must be local relative paths, got ${url}`);
  return url;
}

/**
 * Pre-rendered or recorded lines (e.g. `public/voices/<lineId>.<voiceKey>.ogg`). The manifest maps
 * `lineId` or `lineId|voiceKey` to a local URL and the tier of the recording (a recording by a speaker of a modern
 * descendant language is still C for pronunciation). Lines without an entry fall through to the next backend.
 */
export class RecordingBackend implements VoiceBackend {
  readonly id = 'recording';
  constructor(private manifest: Record<string, { url: string; tier: string }>, private fetcher: (url: string) => Promise<ArrayBuffer> = u => fetch(assertLocalUrl(u)).then(r => r.arrayBuffer())) {
    for (const v of Object.values(manifest)) assertLocalUrl(v.url);
  }
  async render(req: SpeechRequest, ctx: BaseAudioContext | null): Promise<AudioBuffer | null> {
    if (!req.lineId || !ctx) return null;
    const m = this.manifest[`${req.lineId}|${req.voiceKey ?? ''}`] ?? this.manifest[req.lineId];
    if (!m) return null;
    return ctx.decodeAudioData(await this.fetcher(m.url));
  }
}

export function clipToBuffer(ctx: BaseAudioContext, clip: AudioClip): AudioBuffer {
  const b = ctx.createBuffer(1, clip.data.length, clip.sampleRate); b.getChannelData(0).set(clip.data); return b;
}

// ---------------------------------------------------------------- playback
/** What the speech layer needs from a line (people/speech_lines.ts `resolveLine` produces it). */
export interface SpeakableLine { id: string; lang: LangId; ipa: string; translit: string; gloss: string; tier: string; intonation?: Intonation }
/** Out-of-world subtitle payload for the translation layer (English lives only here). */
export interface Subtitle { lineId: string; lang: LangId; translit: string; gloss: string; tier: string; speakerId?: string | number; backend: string }

export class SpeechHandle {
  duration = NaN; playing = false; ended = false; backend = '';
  private src: AudioBufferSourceNode | null = null; private pan: PannerNode | null = null; private stopped = false;
  ready: Promise<boolean>;
  onEnded: (() => void) | null = null;
  constructor(readonly line: SpeakableLine | null, private pos: Vec3, start: (h: SpeechHandle) => Promise<boolean>) { this.ready = start(this); }
  /** @internal */ attach(src: AudioBufferSourceNode, pan: PannerNode) {
    if (this.stopped) { try { src.stop(); } catch { /* not started */ } return; }
    this.src = src; this.pan = pan; this.playing = true;
    src.onended = () => { this.playing = false; this.ended = true; try { pan.disconnect(); } catch { /* already */ } this.onEnded?.(); };
  }
  get position() { return this.pos; }
  /** the panner once playing (the dev overlay reads its occlusion) */
  get panner() { return this.pan; }
  setPosition(p: Vec3) {
    this.pos = p; const pan = this.pan; if (!pan) return; const t = pan.context.currentTime;
    pan.positionX.setTargetAtTime(p.x, t, 0.05); pan.positionY.setTargetAtTime(p.y, t, 0.05); pan.positionZ.setTargetAtTime(p.z, t, 0.05);
  }
  stop() { this.stopped = true; if (this.src) try { this.src.stop(); } catch { /* not started */ } }
}

export class Speech {
  readonly active: SpeechHandle[] = [];
  private cache = new Map<string, { buf: AudioBuffer; backend: string }>();
  /** hook for the out-of-world translation layer; called when a line starts playing */
  onSubtitle: ((s: Subtitle, h: SpeechHandle) => void) | null = null;
  constructor(readonly e: AudioEngine, readonly backends: VoiceBackend[] = [new FormantBackend()], readonly maxCache = 96) {}

  private key(req: SpeechRequest) { const v = req.voice; return `${req.lineId ?? ''}|${req.ipa}|${req.lang}|${req.intonation}|${v.sex}|${v.age}|${v.pitch.toFixed(3)}|${v.rate.toFixed(3)}|${v.breath ?? 0}|${v.seed ?? 1}`; }

  /** Render (or fetch from cache) the audio for a request; tries each backend in order. */
  async buffer(req: SpeechRequest): Promise<{ buf: AudioBuffer; backend: string } | null> {
    const ctx = this.e.ctx; if (!ctx) return null;
    const k = this.key(req); const hit = this.cache.get(k);
    if (hit) { this.cache.delete(k); this.cache.set(k, hit); return hit; }
    for (const b of this.backends) {
      let r: AudioClip | AudioBuffer | null = null;
      try { r = await b.render(req, ctx); } catch (err) { console.warn(`speech backend ${b.id} failed`, err); continue; }
      if (!r) continue;
      const buf = 'data' in r ? clipToBuffer(ctx, r) : r;
      const v = { buf, backend: b.id };
      this.cache.set(k, v); if (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value!);
      return v;
    }
    return null;
  }

  /** Speak a scripted line at a world position through the voices channel. */
  say(line: SpeakableLine, voice: VoiceParams, pos: Vec3, opts: { speakerId?: string | number; voiceKey?: string; delay?: number; gain?: number } = {}): SpeechHandle {
    return this.play({ ipa: line.ipa, lang: line.lang, voice, intonation: line.intonation, lineId: line.id, voiceKey: opts.voiceKey }, pos, line, opts);
  }
  /** Speak raw IPA (used for chants/murmur experiments); no subtitle. */
  sayIpa(req: SpeechRequest, pos: Vec3, opts: { delay?: number; gain?: number } = {}): SpeechHandle { return this.play(req, pos, null, opts); }

  private play(req: SpeechRequest, pos: Vec3, line: SpeakableLine | null, opts: { speakerId?: string | number; delay?: number; gain?: number }): SpeechHandle {
    const h = new SpeechHandle(line, pos, async handle => {
      const e = this.e; if (!e.ctx || !e.unlocked) return false;
      const r = await this.buffer(req); if (!r || !e.ctx) return false;
      const c = e.ctx, src = c.createBufferSource(); src.buffer = r.buf;
      const g = c.createGain(); g.gain.value = opts.gain ?? 1;
      const p = handle.position, pan = e.panner(p.x, p.y, p.z, 1.5, 80);
      src.connect(g); g.connect(pan); e.route(pan, 'voices', c.currentTime + (opts.delay ?? 0) + r.buf.duration); // occluded by the built geometry (D-178)
      handle.duration = r.buf.duration; handle.backend = r.backend;
      handle.attach(src, pan);
      src.start(c.currentTime + (opts.delay ?? 0));
      if (line) this.onSubtitle?.({ lineId: line.id, lang: line.lang, translit: line.translit, gloss: line.gloss, tier: line.tier, speakerId: opts.speakerId, backend: r.backend }, handle);
      return true;
    });
    this.active.push(h);
    return h;
  }
  /** Drop finished handles (call once per frame or less). */
  update() { for (let i = this.active.length - 1; i >= 0; i--) if (this.active[i].ended) this.active.splice(i, 1); }
  stopAll() { for (const h of this.active) h.stop(); }
}
