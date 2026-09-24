// Singing (brief §11; research/SOUNDSCAPE.md §8 M-01, M-02, M-07, M-15; D-178). No song text is attested for any of the
// singing the evidence reports (the court women at supper and through the night; Greek work songs by trade), so every
// song is a vocalise on open vowels with no words: nothing in any language is invented (§10). The voice is the speech
// synthesiser's own source-filter model (src/audio/speech.ts renderPlan: Rosenberg glottal pulse, Klatt resonators),
// driven by the composition's notes instead of phones: portamento between notes, a late vibrato, and one vowel per
// phrase. A chorus ("one of them leads, and then all the rest sing in concert", M-01) is the lead alone for the first
// phrase, then the others join on alternate phrases, each slightly off in pitch and time (C: the reading of "leads" as
// call and response is a reconstruction). All sound design is C.
import { renderPlan, type Frame, type Plan } from './speech';
import { Rng } from '../core/rng';
import type { NoteEv } from './music';

/** open vowels (F1, F2, F3 of an adult male, Hz; scaled by the register) */
const VOWELS: [number, number, number][] = [[730, 1250, 2500], [570, 880, 2450], [460, 850, 2450], [560, 1800, 2500]];
const FRAME = 0.005;
export interface SingOpts { register: 'f' | 'm'; seed: number; detuneCents?: number; delay?: number; formant?: number; vibrato?: number }

/** one voice singing the notes (vowels only) as a speech-synthesiser plan */
export function songPlan(events: NoteEv[], o: SingOpts): Plan {
  const rng = new Rng(o.seed, 'song-plan'), sc = (o.register === 'f' ? 1.17 : 1) * (o.formant ?? 1);
  const det = 2 ** ((o.detuneCents ?? 0) / 1200), delay = o.delay ?? 0;
  const ev = [...events].sort((a, b) => a.t - b.t);
  const T = ev.reduce((m, e) => Math.max(m, e.t + e.dur), 0) + delay + 0.3, nF = Math.ceil(T / FRAME) + 1;
  const vowelOf = new Map<number, [number, number, number]>(); const vibRate = 4.8 + rng.range(0, 1), vibDepth = o.vibrato ?? 0.006;
  const frames: Frame[] = []; let k = -1, cur: Frame | null = null;
  const aF = 1 - Math.exp(-FRAME / 0.03), aA = 1 - Math.exp(-FRAME / 0.035), aV = 1 - Math.exp(-FRAME / 0.05);
  for (let f = 0; f < nF; f++) {
    const tf = f * FRAME - delay;
    while (k + 1 < ev.length && ev[k + 1].t <= tf) k++;
    const n = k >= 0 ? ev[k] : null, on = !!n && tf < n.t + n.dur;
    const ph = n?.phrase ?? 0; if (!vowelOf.has(ph)) vowelOf.set(ph, VOWELS[rng.int(0, VOWELS.length - 1)]);
    const V = vowelOf.get(ph)!, f0n = (n?.f ?? ev[0]?.f ?? 200) * det;
    const into = n ? tf - n.t : 0, vib = into > 0.2 ? 1 + vibDepth * Math.sin(2 * Math.PI * vibRate * tf) * Math.min(1, (into - 0.2) / 0.3) : 1;
    // a high voice lifts its first formant above the fundamental (formant tuning, C)
    const F1 = Math.max(V[0] * sc, f0n * 1.15);
    const tgt: Frame = { f0: f0n * vib, av: on ? 0.9 * (n!.vel ?? 1) : 0, ah: on ? 0.04 : 0, af: 0, F1, F2: V[1] * sc, F3: V[2] * sc, B1: 90 * Math.sqrt(sc), B2: 110 * sc, B3: 170 * sc, ff: 3000, fbw: 1000, nasal: 0, trill: 0 };
    if (!cur) cur = { ...tgt };
    else { cur.f0 += (tgt.f0 - cur.f0) * (on ? aF : 0); for (const key of ['F1', 'F2', 'F3', 'B1', 'B2', 'B3'] as const) cur[key] += (tgt[key] - cur[key]) * aV;
      cur.av += (tgt.av - cur.av) * aA; cur.ah += (tgt.ah - cur.ah) * aA; }
    frames.push({ ...cur });
  }
  return { frames, frameSec: FRAME, duration: T, segments: [], f0Base: ev[0]?.f ?? 200, formantScale: sc };
}

/** sing the notes: one voice, or a chorus of `voices` (the lead alone in the first phrase, then all on odd phrases) */
export function sing(events: NoteEv[], sr: number, o: { register: 'f' | 'm'; seed: number; voices?: number }): Float32Array {
  const nV = Math.max(1, o.voices ?? 1), rng = new Rng(o.seed, 'song-chorus');
  const lead = renderPlan(songPlan(events, { register: o.register, seed: o.seed }), sr, o.seed, 0.8);
  if (nV === 1) return lead;
  const tutti = events.filter(e => (e.phrase ?? 0) % 2 === 1), out = new Float32Array(lead.length + Math.ceil(0.2 * sr)); out.set(lead);
  if (tutti.length) for (let v = 1; v < nV; v++) {
    const x = renderPlan(songPlan(tutti, { register: o.register, seed: o.seed + 101 * v, detuneCents: rng.range(-8, 8), delay: rng.range(0, 0.04), formant: rng.range(0.95, 1.05), vibrato: rng.range(0.004, 0.009) }), sr, o.seed + v, 0.8);
    for (let i = 0; i < x.length && i < out.length; i++) out[i] += x[i] * 0.8;
  }
  let peak = 1e-9; for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}
