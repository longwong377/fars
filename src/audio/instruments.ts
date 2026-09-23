// Physically modelled instruments (brief §11 "Production: physical-modelling synthesis"), as pure DSP on Float32Arrays so
// they render the same in the browser and in node tests. Only instruments with period and regional evidence (research/
// SOUNDSCAPE.md §2: vertical angular harp, round-bodied lyre, long-necked lute, double pipe B/C; frame drum, clappers C).
// Banned (brief §11): oud, duduk, santur, orchestral instruments; they do not exist here. Sizes and timbres are C.
//  - strings: Karplus–Strong waveguide (delay line + loss filter), a first-order allpass for the fractional delay so the
//    pitch lands on the tuning (tested to ±3 cents), an excitation shaped by the plucking finger or plectrum, and a
//    two-resonance body filter (soundbox);
//  - double pipe: reed + cylindrical bore waveguide (Smith/STK clarinet model: a cylindrical bore closed at the reed
//    end, as the aulos-type pipe is usually reconstructed, C), with bore losses in the loop and a fractional bore length
//    (pitch within ±2 cents), breath noise and a drone pipe;
//  - frame drum: modal membrane (ideal circular-membrane mode ratios), struck centre ('dum') or rim ('tek');
//  - clappers: short band-passed noise bursts.
import { Rng } from '../core/rng';

export type InstrumentId = 'harp' | 'lyre' | 'lute' | 'double_pipe' | 'frame_drum' | 'clappers';
export interface InstrumentInfo { id: InstrumentId; name: string; strings?: number; range: [number, number]; tier: string; src: string; note: string }
export const INSTRUMENTS: Record<InstrumentId, InstrumentInfo> = {
  harp: { id: 'harp', name: 'vertical angular harp', strings: 9, range: [150, 700], tier: 'B type / C sound', src: 'SOUND-R', note: 'vertical and horizontal angular harps on Elamite reliefs (Kul-e Farah, Madaktu); 9 strings per UET VII 74 (heptatonic + 2 octave strings)' },
  lyre: { id: 'lyre', name: 'round-bodied lyre', strings: 9, range: [180, 800], tier: 'B/C', src: 'SOUND-R', note: 'among five instruments in Achaemenid depictions (extract; source not seen)' },
  lute: { id: 'lute', name: 'long-necked lute', range: [110, 600], tier: 'B/C', src: 'SOUND-R', note: 'lutes in Elamite art from c. 1300 BCE; in Achaemenid depictions (extract)' },
  double_pipe: { id: 'double_pipe', name: 'double pipe (reed)', range: [220, 900], tier: 'B/C', src: 'SOUND-R', note: 'aulos-type double pipe in Achaemenid depictions (extract); never at sacrifice (Herodotus 1.132)' },
  frame_drum: { id: 'frame_drum', name: 'frame drum', range: [70, 160], tier: 'C', src: 'SOUND-R', note: 'Mesopotamian standard; no Achaemenid-specific source seen' },
  clappers: { id: 'clappers', name: 'clappers', range: [1000, 3000], tier: 'C', src: 'SOUND-R', note: 'Mesopotamian standard; no Achaemenid-specific source seen' },
};

/** RBJ biquad (peaking / lowpass / bandpass), direct form I, in place */
function biquad(x: Float32Array, sr: number, type: 'peak' | 'lp' | 'bp', f: number, q: number, gainDb = 0) {
  const w = 2 * Math.PI * f / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q), A = 10 ** (gainDb / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const x0 = x[i], y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0; }
  return x;
}

export interface PluckOpts { t60: number; brightness: number; position: number; body: [number, number][]; plectrum: boolean; gain: number }
export const PLUCK: Record<'harp' | 'lyre' | 'lute', PluckOpts> = {
  // gut strings plucked by the fingers; soundbox resonances (C)
  harp: { t60: 2.6, brightness: 0.45, position: 0.18, body: [[260, 4], [820, 3]], plectrum: false, gain: 0.5 },
  lyre: { t60: 1.8, brightness: 0.55, position: 0.14, body: [[330, 5], [1100, 3]], plectrum: true, gain: 0.45 },
  lute: { t60: 1.3, brightness: 0.7, position: 0.1, body: [[220, 4], [1500, 2]], plectrum: true, gain: 0.45 },
};

/** a plucked string at f Hz for `dur` s (Karplus–Strong with fractional-delay allpass and loss filter) */
export function pluck(f: number, dur: number, sr: number, o: PluckOpts, rng: Rng, vel = 1): Float32Array {
  const n = Math.floor(dur * sr), out = new Float32Array(n);
  // loop delay P = M (buffer) + b (loss filter's phase delay) + frac (allpass): M whole samples, frac in [0.1, 1.1)
  const b = 0.5 - 0.3 * (o.brightness - 0.5); // loss filter mix: brighter strings keep more high partials
  const P = sr / f, M = Math.floor(P - b - 0.1), frac = P - b - M, C = (1 - frac) / (1 + frac);
  const g = 0.001 ** (1 / (f * o.t60)); // per-period loss giving the wanted T60
  const buf = new Float32Array(M);
  // excitation: noise shaped by the plucking position (comb) and finger softness (lowpass)
  let lp = 0; const soft = o.plectrum ? 0.75 : 0.35 + 0.3 * o.brightness;
  for (let i = 0; i < M; i++) { const w = rng.range(-1, 1); lp += soft * (w - lp); buf[i] = lp; }
  const k = Math.max(1, Math.round(o.position * M)); const ex = buf.slice(); for (let i = 0; i < M; i++) buf[i] = ex[i] - ex[(i + k) % M] * 0.9;
  let idx = 0, prev = 0, apX = 0, apY = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx];
    const avg = (1 - b) * cur + b * prev; prev = cur;
    const ap = C * avg + apX - C * apY; apX = avg; apY = ap; // first-order allpass (fractional delay)
    buf[idx] = ap * g; out[i] = cur; idx = (idx + 1) % M;
  }
  for (const [bf, q] of o.body) biquad(out, sr, 'peak', bf, q, 5);
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = o.gain * vel / peak; const rel = Math.min(n, Math.floor(0.02 * sr));
  for (let i = 0; i < n; i++) out[i] *= gain * (i > n - rel ? (n - i) / rel : 1);
  return out;
}

/** in-loop bore loss (one-pole coefficient, C): 0.3 keeps every note from 220 to 880 Hz on its fundamental; with the
 *  fractional bore the pitch is within ±2 cents of the tuning (measured, tests/music.test.ts) */
const PIPE_LOSS = 0.3, PIPE_DELAY_TRIM = 0;
/** double pipe: melody reed-bore waveguide + optional drone pipe at `drone` Hz (C) */
export function pipeNote(f: number, dur: number, sr: number, rng: Rng, drone: number | null = null, vel = 1): Float32Array {
  const n = Math.floor(dur * sr), out = new Float32Array(n);
  const voice = (freq: number, amp: number) => {
    // STK Clarinet: loop = bore delay + reflection filter (−0.95) + reed table (offset 0.7, slope −0.3). The reflection
    // filter is a one-pole lowpass (bore wall and radiation losses rise with frequency), which keeps the pipe on its
    // fundamental instead of overblowing to the 3rd/5th/7th mode; its phase delay a/(1 − a) is taken out of the bore
    const a = PIPE_LOSS, half = sr / freq * 0.5 - a / (1 - a) - PIPE_DELAY_TRIM, L = Math.max(2, Math.floor(half - 0.1)), frac = half - L, C = (1 - frac) / (1 + frac);
    const d = new Float32Array(L); let di = 0, z1 = 0, apX = 0, apY = 0;
    const att = 0.04 * sr, rel = 0.06 * sr; const vibF = 4.8 + rng.range(-0.4, 0.4);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / att) * Math.min(1, (n - i) / rel);
      const breath = amp * env * (0.55 + 0.02 * Math.sin(2 * Math.PI * vibF * i / sr)) * (1 + 0.12 * rng.range(-1, 1));
      const bore = d[di]; const ap = C * bore + apX - C * apY; apX = bore; apY = ap; // fractional bore length
      z1 = (1 - a) * ap + a * z1; const refl = -0.95 * z1; // one-pole lowpass reflection
      const pd = refl - breath; const reed = Math.max(-1, Math.min(1, 0.7 - 0.3 * pd));
      d[di] = breath + pd * reed; di = (di + 1) % L; out[i] += bore * 0.5;
    }
  };
  voice(f, vel); if (drone) voice(drone, 0.8 * vel);
  biquad(out, sr, 'lp', 3500, 0.7);
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i])); for (let i = 0; i < n; i++) out[i] *= 0.4 / peak;
  return out;
}

/** frame drum stroke: modal membrane (ideal circular membrane mode ratios), 'dum' = centre, 'tek' = rim */
const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501];
export function drum(f0: number, stroke: 'dum' | 'tek', sr: number, rng: Rng, vel = 1): Float32Array {
  const dur = stroke === 'dum' ? 0.9 : 0.35, n = Math.floor(dur * sr), out = new Float32Array(n);
  MEMBRANE.forEach((m, k) => { const a = (stroke === 'dum' ? 1 / (1 + k * 1.5) : 0.35 + (k % 3) * 0.2) * vel, tau = (stroke === 'dum' ? 0.35 : 0.12) / (1 + k * 0.6), f = f0 * m, ph = rng.range(0, 6.28);
    for (let i = 0; i < n; i++) out[i] += a * Math.exp(-i / sr / tau) * Math.sin(2 * Math.PI * f * i / sr + ph); });
  const hit = Math.floor(0.006 * sr); for (let i = 0; i < hit; i++) out[i] += rng.range(-1, 1) * (1 - i / hit) * (stroke === 'tek' ? 0.6 : 0.25) * vel;
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i])); for (let i = 0; i < n; i++) out[i] *= 0.5 * vel / peak;
  return out;
}
export function clap(sr: number, rng: Rng, vel = 1): Float32Array {
  const n = Math.floor(0.08 * sr), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.range(-1, 1) * Math.exp(-i / sr / 0.012) * vel;
  return biquad(out, sr, 'bp', 1800 + rng.range(-200, 200), 2.5);
}
