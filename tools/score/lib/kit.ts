// The arranger's kit (D-760): the in-game cues are written as harmony and phrases; this turns a progression into parts an
// orchestrator would write: pads voice-led from chord to chord (each voice moving to the nearest note of the next chord, ties
// kept), bass lines, harp and string arpeggios, the low strings' ostinati, drum figures. The melodies stay hand-written
// (lib/write.ts line()); the kit never invents a tune.
import { pc, type LNote } from './write';

// ------------------------------------------------------------------------------------------------------------- chords
const Q: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], '5': [0, 7],
  '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], m6: [0, 3, 7, 9], '6': [0, 4, 7, 9], m9: [0, 3, 7, 10, 14],
};
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export interface Chord { root: number; tones: number[]; bass: number; sym: string }
/** 'Dm', 'Bb', 'F#m7', 'Gsus4', 'C/E', 'D5' -> pitch classes */
export function chord(sym: string): Chord {
  const m = /^([A-G])(#|b)?([a-z0-9]*)(?:\/([A-G])(#|b)?)?$/.exec(sym); if (!m) throw new Error(`chord? ${sym}`);
  const acc = (a?: string) => (a === '#' ? 1 : a === 'b' ? -1 : 0), root = (NOTE[m[1]] + acc(m[2]) + 12) % 12;
  const q = Q[m[3]]; if (!q) throw new Error(`quality? ${sym}`);
  const tones = q.map(i => (root + i) % 12), bass = m[4] ? (NOTE[m[4]] + acc(m[5]) + 12) % 12 : root;
  return { root, tones, bass, sym };
}
export interface ChordAt extends Chord { b: number; d: number }
/** a progression: 'Dm:4 Bb:2 C:2 | ...' (lengths in beats; '|' for the eye) starting at beat `at` */
export function prog(spec: string, at = 0): ChordAt[] {
  const out: ChordAt[] = []; let b = at;
  for (const tok of spec.split(/\s+/).filter(t => t && t !== '|')) { const [s, d] = tok.split(':'); const len = d ? +d : 4; out.push({ ...chord(s), b, d: len }); b += len; }
  return out;
}
export const endOf = (p: ChordAt[]) => p.length ? p[p.length - 1].b + p[p.length - 1].d : 0;

// --------------------------------------------------------------------------------------------------------- voice-leading
/** the voicings of a chord with n voices inside [lo, hi]: every chord tone present when n allows, no two voices closer than a
 *  second in the low register (under C3 a fifth), the top voice no more than an octave above the next */
function voicings(c: Chord, n: number, lo: number, hi: number): number[][] {
  const cands: number[] = []; for (let p = lo; p <= hi; p++) if (c.tones.includes(p % 12)) cands.push(p);
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === n) {
      const pcs = new Set(acc.map(p => p % 12)), need = Math.min(n, c.tones.length);
      if (pcs.size < need) return;
      for (let i = 1; i < acc.length; i++) { const gap = acc[i] - acc[i - 1]; if (gap < (acc[i - 1] < 48 ? 7 : acc[i - 1] < 55 ? 3 : 1)) return; if (gap > 12 && i < acc.length - 1) return; }
      out.push([...acc]); return;
    }
    for (let i = start; i < cands.length; i++) { acc.push(cands[i]); rec(i + 1, acc); acc.pop(); if (out.length > 4000) return; }
  };
  rec(0, []); return out;
}
/** voice-led chords: n voices in [lo, hi] (note names); each chord takes the voicing nearest the last (the first: the one
 *  whose mean is nearest `centre`); notes held through a change are tied */
export function pad(chs: ChordAt[], lo: string, hi: string, n: number, centre?: string, opts: { tie?: boolean; split?: number } = {}): LNote[] {
  const L = pc(lo), H = pc(hi), C = centre ? pc(centre) : (L + H) / 2; let prev: number[] | null = null; const out: LNote[] = [];
  for (const c of chs) {
    let vs = voicings(c, n, L, H); for (let w = 1; !vs.length && w <= 6; w++) vs = voicings(c, n, L - w, H + w); // widen a little where the range is too tight for the chord
    if (!vs.length) throw new Error(`no voicing of ${c.sym} with ${n} voices in ${lo}-${hi}`);
    let best = vs[0], cost = Infinity;
    for (const v of vs) { const k = prev ? v.reduce((a, p, i) => a + Math.abs(p - prev![i]), 0) : Math.abs(v.reduce((a, p) => a + p, 0) / n - C); if (k < cost) { cost = k; best = v; } }
    const split = opts.split ?? c.d; // re-articulate long chords every `split` beats (a sustained section breathes)
    for (let s = 0; s < c.d; s += split) for (const p of best) {
      const len = Math.min(split, c.d - s), last = out.find(o => o.p === p && Math.abs(o.b + o.d - (c.b + s)) < 1e-6);
      if (last && opts.tie !== false && s === 0) last.d += len; else out.push({ b: c.b + s, d: len, p });
    }
    prev = best;
  }
  return out;
}
/** the bass: each chord's bass note in [lo, hi] (nearest the last), held, or in a figure ('root' | 'pulse' quarter notes |
 *  'walk' root-fifth-octave-fifth | 'doum' long-short as a frame drum's) */
export function bass(chs: ChordAt[], lo: string, hi: string, figure: 'root' | 'pulse' | 'walk' | 'doum' = 'root'): LNote[] {
  const L = pc(lo), H = pc(hi); let prev = (L + H) / 2; const out: LNote[] = [];
  for (const c of chs) {
    let best = -1, d = Infinity; for (let p = L; p <= H; p++) if (p % 12 === c.bass && Math.abs(p - prev) < d) { d = Math.abs(p - prev); best = p; }
    if (best < 0) throw new Error(`bass: no ${c.sym} bass in ${lo}-${hi}: give the range an octave`);
    prev = best; const fifth = best + 7 <= H ? best + 7 : best - 5;
    if (figure === 'root') out.push({ b: c.b, d: c.d, p: best });
    else if (figure === 'pulse') for (let s = 0; s < c.d; s++) out.push({ b: c.b + s, d: 1, p: best, acc: s === 0 ? '>' : undefined });
    else if (figure === 'walk') for (let s = 0; s < c.d; s++) out.push({ b: c.b + s, d: 1, p: [best, fifth, best + 12 <= H ? best + 12 : best, fifth][s % 4] });
    else for (let s = 0; s < c.d; s += 2) { out.push({ b: c.b + s, d: 1.5, p: best, acc: '>' }); out.push({ b: c.b + s + 1.5, d: 0.5, p: best }); }
  }
  return out;
}
/** an arpeggio through each chord's tones in [lo, hi]: `pattern` indexes the chord's notes from the bottom (it wraps up an
 *  octave past the top), one per `step` beats; notes ring `ring` beats (a harp lets them sound) */
export function arp(chs: ChordAt[], lo: string, hi: string, pattern: number[], step = 0.5, ring = 2): LNote[] {
  const L = pc(lo), H = pc(hi), out: LNote[] = [];
  for (const c of chs) {
    const tones: number[] = []; for (let p = L; p <= H; p++) if (c.tones.includes(p % 12)) tones.push(p);
    const bassFirst = tones.findIndex(p => p % 12 === c.bass), seq = bassFirst > 0 ? tones.slice(bassFirst) : tones;
    for (let k = 0, s = 0; s < c.d - 1e-6; k++, s += step) { const i = pattern[k % pattern.length]; const p = seq[i % seq.length] + 12 * Math.floor(i / seq.length); let q = p; while (q > H) q -= 12; out.push({ b: c.b + s, d: ring, p: q }); }
  }
  return out;
}
/** a low-strings ostinato: eighths grouped `groups` (e.g. [3, 3, 2]); each group starts on the chord's bass (accented), then
 *  `fill` intervals above it */
export function ostinato(chs: ChordAt[], lo: string, hi: string, groups = [3, 3, 2], fill = [0, 12, 7]): LNote[] {
  const b = bass(chs, lo, hi, 'root'), out: LNote[] = [];
  for (const r of b) { let k = 0, s = 0; while (s < r.d - 1e-6) { for (const g of groups) for (let i = 0; i < g && s < r.d - 1e-6; i++, s += 0.5) { const iv = i === 0 ? 0 : fill[(i - 1) % fill.length]; out.push({ b: r.b + s, d: 0.5, p: r.p + iv <= pc(hi) ? r.p + iv : r.p, acc: i === 0 ? '>' : undefined }); } k++; } }
  return out;
}
/** a drum figure per bar in eighths ('X' strong, 'x' light, '.' rest) from bar `from` to `to` (inclusive), bars of `bpb` beats */
export function figure(from: number, to: number, fig: string, key: number, bpb = 4, sub = 0.5): LNote[] {
  const f = fig.replace(/\s/g, ''), out: LNote[] = [];
  for (let b = from; b <= to; b++) for (let i = 0; i < f.length; i++) if (f[i] !== '.') out.push({ b: (b - 1) * bpb + i * sub, d: sub, p: key, acc: f[i] === 'X' ? '>' : undefined });
  return out;
}
/** octave-fold notes into an instrument's range */
export function fold(notes: LNote[], lo: string, hi: string): LNote[] { const L = pc(lo), H = pc(hi); return notes.map(n => { let p = n.p; while (p < L) p += 12; while (p > H) p -= 12; return { ...n, p }; }); }
/** shift notes in time */
export const at = (notes: LNote[], beats: number) => notes.map(n => ({ ...n, b: n.b + beats }));
/** a hairpin envelope across [b0, b1]: from v0 rising to peak at the middle (or `at`), down to v1 */
export const swell = (b0: number, b1: number, v0: number, peak: number, v1: number, atU = 0.6): [number, number][] => [[b0, v0], [b0 + (b1 - b0) * atU, peak], [b1, v1]];
