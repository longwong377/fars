// Music (brief §11): only what someone in the world is playing. No background score. Every piece is a C-tier composition
// from B-tier ingredients (research/SOUNDSCAPE.md): the instruments of src/audio/instruments.ts, the tunings of
// src/audio/tuning.ts (never equal temperament), and generative variation so no two performances are the same.
// Evidence rules carried here:
//  - at sacrifice there is no instrument at all: a magus chants unaccompanied (Herodotus 1.132, B). `perform` refuses an
//    instrument for the 'offering' context (the chant is speech, src/audio/speech.ts);
//  - court music (singing and playing at the king's supper; the women's night watch "singing and playing": Heracleides
//    via Athenaeus, B for the court in general) only when the court is resident (the out-of-world court setting, D-003);
//  - work songs and herders' pipes are C and used sparingly (the caller decides who plays and when).
// Composition (C throughout): phrases walk the mode stepwise with occasional fourth/fifth leaps and close on the first
// or fifth degree; plucked strings add string-pair dyads (fourths/fifths) at phrase ends, as the string-pair tuning
// texts suggest (C); a seeded motif is stated, varied and restated.
import { Rng } from '../core/rng';
import type { AudioEngine } from './engine';
import { INSTRUMENTS, InstrumentId, PLUCK, VOICE_RANGE, pluck, pipeNote, drum, clap } from './instruments';
import { MESOPOTAMIAN_MODES, GREEK_MODES, Mode, scaleFreqs } from './tuning';
import { sing } from './song';
import { knownClaim } from './musicClaims';

export type Tradition = 'mesopotamian' | 'greek';
export type MusicContext = 'court' | 'work' | 'herding' | 'leisure' | 'offering';
export interface Performance { id: string; instrument: InstrumentId; tradition: Tradition; context: MusicContext; modeId?: string; seed: number; tempo?: number;
  /** a voice's register and how many sing (a chorus: the lead first, then all on alternate phrases) */
  register?: 'f' | 'm'; voices?: number;
  /** the first degree (Hz): an ensemble's parts share it, and a shared `pieceSeed` gives them the same melody (heterophony) */
  tonic?: number; pieceSeed?: number;
  /** research/SOUNDSCAPE.md §8 claim ids this playing rests on; `MusicSystem.perform` refuses a performance without them */
  claims?: string[] }
export interface NoteEv { t: number; dur: number; f: number; vel: number; dyad?: number; stroke?: 'dum' | 'tek' | 'clap'; drone?: number; phrase?: number }
/** the playable range of a performance's instrument (a voice: its register's) */
export const rangeOf = (p: Performance): [number, number] => (p.instrument === 'voice' ? VOICE_RANGE[p.register ?? 'f'] : INSTRUMENTS[p.instrument].range);

export function modeFor(p: Performance): Mode {
  const set = p.tradition === 'greek' ? GREEK_MODES : MESOPOTAMIAN_MODES;
  return set.find(m => m.id === p.modeId) ?? set[new Rng(p.seed, 'mode').int(0, set.length - 1)];
}

/** note events for about `seconds` of playing */
export function compose(p: Performance, seconds: number): NoteEv[] {
  const rng = new Rng(p.pieceSeed ?? p.seed, p.pieceSeed != null ? 'compose:piece' : `compose:${p.id}`), info = INSTRUMENTS[p.instrument], range = rangeOf(p);
  const beat = 60 / (p.tempo ?? rng.range(72, 104));
  const ev: NoteEv[] = [];
  if (p.instrument === 'frame_drum' || p.instrument === 'clappers') {
    // rhythmic cycles of 4–7 beats, seeded (C)
    const len = rng.int(4, 7); const cyc = Array.from({ length: len }, (_, i) => (i === 0 ? 'dum' : rng.chance(0.35) ? 'dum' : rng.chance(0.75) ? 'tek' : null)) as ('dum' | 'tek' | null)[];
    const f0 = rng.range(range[0], range[1] * 0.8);
    for (let t = 0, i = 0; t < seconds; t += beat / 2, i++) { const s = cyc[i % len]; if (!s) continue;
      ev.push({ t: t + rng.range(-0.01, 0.01), dur: 0.5, f: f0, vel: (s === 'dum' ? 0.9 : 0.6) * rng.range(0.85, 1), stroke: p.instrument === 'clappers' ? 'clap' : s }); }
    return ev;
  }
  const mode = modeFor(p);
  const nStr = info.strings ?? 9;
  const f0r = range[0] * rng.range(1, 1.25), f0 = p.tonic ?? f0r;
  // the tonic moved by octaves into the instrument's range (an ensemble's parts share one tonic)
  let base = f0; while (base < range[0] * 0.99) base *= 2; while (base > range[0] * 2.01) base /= 2;
  const freqs = scaleFreqs(mode, base, nStr).filter(f => f <= range[1]);
  const top = freqs.length - 1;
  // a seeded motif of 4–6 degrees, then variations (transposed by a step, rhythm altered, ornamented)
  const motif: number[] = []; let d = rng.int(0, Math.min(4, top));
  for (let i = 0; i < rng.int(4, 6); i++) { motif.push(d); d = Math.max(0, Math.min(top, d + (rng.chance(0.75) ? rng.pick([-1, 1]) : rng.pick([-4, -3, 3, 4])))); }
  const rhythms = [[1, 1, 2], [1.5, 0.5, 1, 1], [1, 1, 1, 1], [2, 1, 1], [0.5, 0.5, 1, 2]];
  let t = 0, phraseN = 0;
  const drone = p.instrument === 'double_pipe' ? freqs[0] / 2 * (rng.chance(0.5) ? 1 : 1.5) : undefined; // drone on the first or fifth degree (C)
  while (t < seconds) {
    const variant = rng.int(0, 3); const shift = variant === 1 ? rng.pick([-1, 1]) : 0;
    const phrase = motif.map(x => Math.max(0, Math.min(top, x + shift)));
    if (variant === 2) phrase.splice(rng.int(1, phrase.length - 1), 0, Math.max(0, Math.min(top, phrase[0] + rng.pick([-1, 1])))); // ornament
    if (variant === 3) phrase.reverse();
    // cadence on the first or fifth degree
    phrase.push(rng.chance(0.6) ? 0 : Math.min(top, 4));
    const rh = rng.pick(rhythms);
    phrase.forEach((deg, i) => {
      const len = rh[i % rh.length] * beat, last = i === phrase.length - 1;
      const note: NoteEv = { t: t + rng.range(-0.015, 0.015), dur: last ? beat * 2.5 : len * 1.8, f: freqs[deg], vel: rng.range(0.7, 1) * (i === 0 ? 1 : 0.9), drone, phrase: phraseN };
      if (last && p.instrument !== 'double_pipe' && p.instrument !== 'lute' && p.instrument !== 'voice') { const pair = deg + (deg + 4 <= top ? 4 : -3); if (pair >= 0 && pair <= top) note.dyad = freqs[pair]; } // string pair (C)
      ev.push(note); t += last ? beat * 2 : len;
    });
    t += beat * rng.range(0.5, 1.5); phraseN++; // breath between phrases
  }
  return ev.filter(e => e.t < seconds);
}

/** render events to a mono buffer (pure; node-testable) */
export function render(p: Performance, events: NoteEv[], sr: number): Float32Array {
  if (p.instrument === 'voice') return sing(events, sr, { register: p.register ?? 'f', seed: p.seed, voices: p.voices });
  const end = events.reduce((m, e) => Math.max(m, e.t + e.dur + 1), 0), out = new Float32Array(Math.ceil(end * sr));
  const rng = new Rng(p.seed, `render:${p.id}`);
  const add = (x: Float32Array, t: number) => { const o = Math.max(0, Math.floor(t * sr)); for (let i = 0; i < x.length && o + i < out.length; i++) out[o + i] += x[i]; };
  for (const e of events) {
    if (e.stroke === 'clap') add(clap(sr, rng, e.vel), e.t);
    else if (e.stroke) add(drum(e.f, e.stroke, sr, rng, e.vel), e.t);
    else if (p.instrument === 'double_pipe') add(pipeNote(e.f, e.dur, sr, rng, e.drone ?? null, e.vel), e.t);
    else { const o = PLUCK[p.instrument as 'harp' | 'lyre' | 'lute']; add(pluck(e.f, Math.max(e.dur, o.t60 * 0.8), sr, o, rng, e.vel), e.t);
      if (e.dyad) add(pluck(e.dyad, o.t60 * 0.8, sr, o, rng, e.vel * 0.8), e.t + 0.03); }
  }
  let peak = 1e-9; for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.95) for (let i = 0; i < out.length; i++) out[i] *= 0.95 / peak;
  return out;
}

/** a voice renders at this rate at most (the formant voice has nothing above ~5 kHz; halves the cost; Web Audio resamples) */
export const VOICE_SR = 22050;
/** can this performance be played at all (the evidence rules, without the audio context)? the reason when not */
export function refusal(p: Performance, courtResident: boolean, pos?: { x: number; y: number; z: number }): string | null {
  if (p.context === 'offering') return 'no instrument or song at an offering (Herodotus 1.132; the chant is not attested: M-06)';
  if (p.context === 'court' && !courtResident) return 'court music only with the court resident (D-003, M-16)';
  if (!p.claims?.length) return 'no tiered source (SOUNDSCAPE §8 claim) for this playing';
  const bad = p.claims.filter(c => !knownClaim(c)); if (bad.length) return `unknown claim ids ${bad.join(', ')}`;
  if (pos && !Number.isFinite(pos.x + pos.y + pos.z)) return 'no position (nobody is playing)';
  return null;
}
/** runtime: plays performances at their performers' positions (HRTF panner, 'music' channel, occluded by the built
 *  geometry); nothing without a performer and a tiered source. Pieces render in a worker (music_worker.ts) when the
 *  browser has one, so a new piece does not stall a frame; in node (tests) they render inline. */
export class MusicSystem {
  private active = new Map<string, { p: Performance; src: AudioBufferSourceNode; panner: PannerNode; gain: GainNode; ends: number }>();
  /** performances waiting for their render: the latest position of the performer */
  private pending = new Map<string, { token: number; p: Performance; pos: { x: number; y: number; z: number } }>();
  private worker: Worker | null = null; private token = 0;
  /** the render time of the last performance started (ms; in the worker when there is one) */
  lastRenderMs = 0;
  constructor(private engine: AudioEngine, private courtResident: () => boolean = () => false) {
    if (typeof Worker !== 'undefined') try {
      this.worker = new Worker(new URL('./music_worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (ev: MessageEvent<{ token: number; pcm: Float32Array; sr: number; ms: number }>) => {
        const d = ev.data; this.lastRenderMs = d.ms;
        for (const [id, w] of this.pending) if (w.token === d.token) { this.pending.delete(id); this.start(w.p, w.pos, d.pcm, d.sr); }
      };
    } catch { this.worker = null; }
  }
  /** start a performance at a world position; returns false when the evidence rules forbid it (true: it will play) */
  perform(p: Performance, pos: { x: number; y: number; z: number }, seconds = 40): boolean {
    const e = this.engine; if (!e.ctx || !e.unlocked) return false;
    if (refusal(p, this.courtResident(), pos)) return false;
    this.stop(p.id, 0);
    const sr = p.instrument === 'voice' ? Math.min(e.ctx.sampleRate, VOICE_SR) : e.ctx.sampleRate;
    if (this.worker) { const token = ++this.token; this.pending.set(p.id, { token, p, pos: { ...pos } }); this.worker.postMessage({ token, p, seconds, sr }); return true; }
    const t0 = performance.now(); const pcm = render(p, compose(p, seconds), sr); this.lastRenderMs = performance.now() - t0;
    this.start(p, pos, pcm, sr); return true;
  }
  private start(p: Performance, pos: { x: number; y: number; z: number }, pcm: Float32Array, sr: number) {
    const e = this.engine, c = e.ctx; if (!c) return;
    const b = c.createBuffer(1, pcm.length, sr); b.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const src = c.createBufferSource(); src.buffer = b; const pan = e.panner(pos.x, pos.y, pos.z, 3, 250);
    const gain = c.createGain(); gain.gain.value = 1; src.connect(gain); gain.connect(pan);
    e.route(pan, 'music', c.currentTime + b.duration);
    src.start();
    this.active.set(p.id, { p, src, panner: pan, gain, ends: c.currentTime + b.duration });
    src.onended = () => { if (this.active.get(p.id)?.src === src) this.active.delete(p.id); };
  }
  /** follow performers as they move; stop anyone who is no longer performing */
  update(positions: Map<string, { x: number; y: number; z: number }>) {
    for (const [id, w] of this.pending) { const p = positions.get(id); if (!p) this.pending.delete(id); else w.pos = { ...p }; }
    for (const [id, a] of this.active) { const p = positions.get(id); if (!p) { this.stop(id); continue; } a.panner.positionX.value = p.x; a.panner.positionY.value = p.y; a.panner.positionZ.value = p.z; }
  }
  /** stop a performance, fading over `fade` seconds (a song is not cut off dead) */
  stop(id: string, fade = 1.5) {
    this.pending.delete(id);
    const a = this.active.get(id); if (!a) return; const c = this.engine.ctx;
    try { if (c && fade > 0) { a.gain.gain.setTargetAtTime(0, c.currentTime, fade / 3); a.src.stop(c.currentTime + fade); } else a.src.stop(); } catch { /* already ended */ }
    this.active.delete(id);
  }
  /** is this performance sounding or about to (rendering)? */
  isPlaying(id: string) { if (this.pending.has(id)) return true; const a = this.active.get(id), c = this.engine.ctx; return !!a && (!c || c.currentTime < a.ends); }
  get playing() { return [...this.active.keys()]; }
  /** what plays now, for the dev overlay */
  info() { return [...this.active.values()].map(a => ({ id: a.p.id, instrument: a.p.instrument, context: a.p.context, claims: a.p.claims ?? [], panner: a.panner, ends: a.ends })); }
}
