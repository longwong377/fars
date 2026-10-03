// The score's writing desk: the composer writes in BEATS with dynamics marks; a Performance turns that into what a player
// does in SECONDS: the tempo map with its rubato, onsets spread like a section's (never on the grid), legato overlaps, the
// dynamics as continuous CC1 swells (each long note breathes: a messa di voce inside the phrase's hairpin), vibrato that
// blooms on held notes (CC21), velocity as the bite of the attack. Nothing here is random at run time: every spread comes
// from the cue's seed.
import type { MidiPart, Note } from './midi';
import { rng } from './dsp';
import { ORCH, type Art, type InstId } from '../orchestra';

// ------------------------------------------------------------------------------------------------------------- pitches
const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'D4', 'Bb3', 'C#5' -> MIDI (C4 = 60) */
export function pc(s: string): number {
  const m = /^([A-G])(#|b|bb|##)?(-?\d)$/.exec(s.trim()); if (!m) throw new Error(`pitch? ${s}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : m[2] === '##' ? 2 : m[2] === 'bb' ? -2 : 0;
  return 12 * (+m[3] + 1) + NAMES[m[1]] + acc;
}
/** a line in shorthand: "D4:2 A4:1 G4:.5 F4:.5 | E4:1.5 r:.5" (r = rest; '|' is only for the eye; '~' ties to the next:
 *  "D4:2~ D4:1"; '>' accent, '.' staccato mark, '-' tenuto, written after the length: "A4:1>") */
export interface LNote { b: number; d: number; p: number; acc?: '>' | '.' | '-'; tie?: boolean }
export function line(s: string, at = 0, transpose = 0): LNote[] {
  const out: LNote[] = []; let b = at;
  for (const tok of s.split(/\s+/).filter(t => t && t !== '|')) {
    const m = /^([^:]+):([\d.\/]+)([>.\-~]*)$/.exec(tok); if (!m) throw new Error(`token? ${tok}`);
    const d = m[2].includes('/') ? +m[2].split('/')[0] / +m[2].split('/')[1] : +m[2];
    if (m[1] !== 'r') { const tie = m[3].includes('~'), acc = (m[3].replace('~', '') || undefined) as LNote['acc'];
      const prev = out[out.length - 1];
      if (prev?.tie && prev.p === pc(m[1]) + transpose && Math.abs(prev.b + prev.d - b) < 1e-6) { prev.d += d; prev.tie = tie; }
      else out.push({ b, d, p: pc(m[1]) + transpose, acc, tie }); }
    b += d;
  }
  return out;
}
/** chords in shorthand at given beats: [[beat, dur, 'D3 A3 F4']] */
export function chords(list: [number, number, string][], transpose = 0): LNote[] {
  return list.flatMap(([b, d, ps]) => ps.split(/\s+/).filter(Boolean).map(p => ({ b, d, p: pc(p) + transpose })));
}

// ----------------------------------------------------------------------------------------------------------- tempo map
/** tempo points [beat, bpm]; linear in between (an accelerando or a ritardando is a ramp); fermatas as [beat, extra s] */
export class Tempo {
  private table: { b: number; s: number }[] = [];
  constructor(private pts: [number, number][], private holds: [number, number][] = [], private endBeat = 1024) {
    let s = 0; const step = 1 / 64; this.table.push({ b: 0, s: 0 });
    for (let b = 0; b < endBeat; b += step) { s += (60 / this.bpm(b + step / 2)) * step; for (const [hb, hs] of holds) if (hb >= b && hb < b + step) s += hs; this.table.push({ b: b + step, s }); }
  }
  bpm(b: number) { const p = this.pts; if (b <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (b < p[i][0]) { const [b0, t0] = p[i - 1], [b1, t1] = p[i]; return t0 + ((t1 - t0) * (b - b0)) / (b1 - b0); } return p[p.length - 1][1]; }
  /** seconds at beat b */
  s(b: number) { const step = 1 / 64, i = Math.max(0, Math.min(this.table.length - 2, Math.floor(b / step))), f = b / step - i; return this.table[i].s + (this.table[i + 1].s - this.table[i].s) * f; }
}

// ---------------------------------------------------------------------------------------------------------- performance
/** a part: one instrument, one articulation; dynamics are 0 (niente) .. 1 (fff) at beats: the phrase's hairpins */
export interface Part { id: string; inst: InstId; art: Art; notes: LNote[]; dyn: [number, number][]; /** semitone bends [beat, st] */ bend?: [number, number][];
  /** extra seconds of lead for slow attacks (pads): the swell begins this much before the beat */ lead?: number;
  /** a soloist's vibrato depth 0..1 (default: sections .45, soloists .6) */ vib?: number;
  /** mix: gain (dB) and an optional pan/depth override */ gain?: number; pan?: number; depth?: number;
  /** the octave doubling written as a separate stem? no: doublings are separate parts */ }

/** dynamics level -> CC1 (SSO maps CC1 to gain and brightness; 0.0 is ~pp, 1.0 is ff and beyond) */
const cc1 = (x: number) => 18 + 109 * Math.max(0, Math.min(1, x));
const dynAt = (dyn: [number, number][], b: number) => { if (!dyn.length) return 0.6; if (b <= dyn[0][0]) return dyn[0][1];
  for (let i = 1; i < dyn.length; i++) if (b < dyn[i][0]) { const [b0, v0] = dyn[i - 1], [b1, v1] = dyn[i]; const u = (b - b0) / (b1 - b0); return v0 + (v1 - v0) * (u * u * (3 - 2 * u)); }
  return dyn[dyn.length - 1][1]; };

/** the instruments whose legato samples are not looped (SSO's section brass and solo winds) */
const ONE_SHOT_LEGATO = new Set<InstId>(['tpt', 'tbn', 'btbn', 'tuba', 'hnSolo', 'fl', 'afl', 'ob', 'eh', 'cl', 'bcl', 'bsn', 'cbsn']);

export function perform(part: Part, tempo: Tempo, seed: number): MidiPart {
  const I = ORCH[part.inst], R = rng(seed), gauss = () => { let a = 0; for (let i = 0; i < 4; i++) a += R(); return (a - 2) * 0.866; };
  const legato = part.art === 'leg', short = part.art === 'stac' || part.art === 'pizz' || part.art === 'hit' || part.art === 'mar';
  const notes: Note[] = [], breaths: [number, number, number][] = [], vibPts: [number, number][] = [[0, 0]];
  const sorted = [...part.notes].sort((a, b) => a.b - b.b || a.p - b.p);
  // the section's own drift: a slow wander of a few ms that all its notes share (players breathe together), plus each note's spread
  const drift = (t: number) => (I.jitter / 1000) * 0.6 * Math.sin(t * 0.37 + seed) * Math.sin(t * 0.11 + seed * 0.3);
  for (let k = 0; k < sorted.length; k++) {
    const n = sorted[k]; if (n.p < I.lo - 0.5 || n.p > I.hi + 0.5) throw new Error(`${part.id}: ${n.p} outside ${part.inst} ${I.lo}-${I.hi} at beat ${n.b}`);
    const t0 = tempo.s(n.b), t1 = tempo.s(n.b + n.d), len = t1 - t0, d = dynAt(part.dyn, n.b);
    if (legato && len > 4.3 && ONE_SHOT_LEGATO.has(part.inst)) console.warn(`  ! ${part.id}: a ${len.toFixed(1)} s legato note at beat ${n.b} (the samples run ~4 s): hold it with 'sus'`);
    const jit = (gauss() * I.jitter) / 1000 + drift(t0);
    // velocity: the attack's bite: louder and accented notes bite; long notes at piano swell in softly; repeated short notes vary
    let v = short ? 40 + 80 * d : 30 + 70 * d * (len < 0.6 ? 1.15 : len > 2.5 ? 0.7 : 1);
    if (n.acc === '>') v += 22; if (n.acc === '-') v -= 6; v += gauss() * (short ? 6 : 4);
    // length: legato overlaps the next note of the line (the sampler slurs), detached notes breathe a little, staccato is short
    const next = sorted.slice(k + 1).find(m => m.b > n.b + 1e-6);
    let dur = len;
    if (legato && next && Math.abs(next.b - (n.b + n.d)) < 1e-3) dur = len + 0.07 + R() * 0.03;
    else if (n.acc === '.' || part.art === 'stac') dur = Math.min(len * 0.5, 0.25);
    else if (!legato && !short) dur = len - Math.min(0.12, len * 0.08);
    const at = Math.max(0, t0 + jit - (part.lead ?? 0) * (k === 0 || !legato ? 1 : 0));
    notes.push({ t: at, dur: Math.max(0.05, dur + (part.lead ?? 0) * 0.5), p: n.p, v: Math.max(8, Math.min(127, v)) });
    // the note's own breath inside the hairpin: long notes rise a little to their middle and ease off at the end
    if (!I.perc && len > 1.2) breaths.push([t0, t1, 0.05 + 0.04 * R()]);
    // vibrato: none at the attack, blooming over the first second of a held note
    if (!I.perc && len > 0.7) { const depth = part.vib ?? (part.inst.endsWith('Solo') || part.inst === 'eh' || part.inst === 'afl' ? 0.62 : 0.45);
      vibPts.push([t0, 10], [t0 + Math.min(1.1, len * 0.45), 127 * depth * (0.7 + 0.6 * d)], [t1, 127 * depth * 0.8]); }
  }
  const cc: Record<number, [number, number][]> = {};
  if (!I.perc) {
    // CC1 every 40 ms: the composer's hairpin at that moment plus the breath of the note sounding then
    const end = tempo.s(part.notes.reduce((a, n) => Math.max(a, n.b + n.d), 0)) + 2, curve: [number, number][] = [];
    let bLo = 0;
    for (let t = 0; t < end; t += 0.04) {
      let lo = bLo, hi = 4096; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (tempo.s(m) < t) lo = m; else hi = m; } bLo = Math.max(0, lo - 1);
      let br = 0; for (const [t0, t1, sw] of breaths) if (t >= t0 && t < t1) { const u = (t - t0) / (t1 - t0); br = sw * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 1.5 - 0.03 * u; }
      curve.push([+t.toFixed(3), cc1(dynAt(part.dyn, lo) + br)]);
    }
    cc[1] = curve; cc[21] = vibPts.sort((a, b) => a[0] - b[0]);
  }
  const bend = part.bend?.map(([b, st]) => [tempo.s(b), st] as [number, number]);
  return { notes, cc, bend };
}
/** a cue as the composer hands it over */
export interface Cue {
  id: string; title: string; /** what it is for (the director's tags) */ tags: string[];
  tempo: Tempo; parts: Part[]; /** seconds the cue lasts (the tail rings on past it) */ seconds: number;
  /** markers for the film's edit (s): name -> time */ marks?: Record<string, number>;
  /** the target loudness for the master (LUFS) */ lufs?: number;
}
