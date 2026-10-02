// Recorded sound at play (D-620): the beds of soundplan.ts as crossfaded stretches of their recordings, the one-shot sets
// (work, animals, birds, thunder) at their world positions through the occlusion, the footsteps by surface and pace.
//  - A bed (BedDeck) never loops: it plays a chain of stretches, each a random window (STRETCH s) of one of its recordings,
//    overlapped by an equal-power crossfade (FADE s), the next window drawn so that no stretch of the recording is heard
//    again within REPEAT_S (T-G2 "no repeat within 60 s"; with one 90 s recording the windows walk round it, with several
//    they alternate). Its level follows the plan with a slow glide; at zero it stops scheduling and lets go of its files.
//  - A one-shot never plays the same recording twice running (the last two are skipped where the set has more), and each
//    play is pitched ±6 % and levelled ±2 dB (C), so a dog's bark or a hammer's ring is never a copy of the one before.
//  - Footsteps alternate the set's recordings the same way, levelled by pace.
// Every level C (mixed by ear against the synthesised beds' measured levels).
import type { AudioEngine } from './engine';
import type { SoundLibrary, Rec } from './library';
import { BED_LAYERS, type BedMix, type FootSurface } from './soundplan';
import { Rng } from '../core/rng';

export const STRETCH: [number, number] = [22, 40];
/** the shortest stretch drawn when the free parts are short (s) */
export const MIN_STRETCH = 9;
export const FADE = 3;
export const REPEAT_S = 60;
const LOOKAHEAD = 2;
/** the beds' level on the ambience channel at gain 1 (recordings at -23 LUFS; measured against the synthesised scenes, below) */
export const BED_LEVEL = 1.0;
/** a layer's own gain over BED_LEVEL, measured (tools/dev/sound_mix.ts: each scene's total with the recordings matched to its
 *  total without them, the synthesis's levels being the ones the gates were set on): at 0.55 the beds came in ~5 dB under
 *  the scenes they replace, the rain ~13 dB under the synthesised rain (which tests hold audible over the wind) */
export const LAYER_GAIN: Partial<Record<string, number>> = { rain_light: 2.5, rain_heavy: 2.5, rain_roof: 2, wind_gusts: 1.5, dust_wind: 1.5 };
/** one-shots and steps are cut to a -3 dBFS peak (tools/audio/fetch.mjs); played at these gains they peak where the synthesised
 *  designs they replace did (a bark's sawtooth at 0.06 through its formants, a step's noise burst at 0.07; C) */
export const SHOT_LEVEL = 0.12, FOOT_LEVEL = 0.1;
const EQ_N = 64, EQ_IN = new Float32Array(EQ_N), EQ_OUT = new Float32Array(EQ_N);
for (let i = 0; i < EQ_N; i++) { const a = (i / (EQ_N - 1)) * Math.PI / 2; EQ_IN[i] = Math.sin(a); EQ_OUT[i] = Math.cos(a); }

export interface Played { file: string; at: number; from: number; to: number }

export class BedDeck {
  readonly out: GainNode; target = 0; level = 0;
  /** the stretches scheduled (tests: the repeat rule), the files held */
  readonly log: Played[] = []; private next = -1; private held = new Set<string>(); private lastFile = '';
  constructor(readonly e: AudioEngine, readonly lib: SoundLibrary, readonly layer: string, private rng: Rng, dest?: AudioNode, readonly level0 = BED_LEVEL * (LAYER_GAIN[layer] ?? 1)) {
    this.out = e.ctx!.createGain(); this.out.gain.value = 0; this.out.connect(dest ?? e.ch.ambience);
  }
  /** is any of the bed's recordings decoded (it can play)? */
  playable(): boolean { return this.lib.ready('beds', this.layer, 0).length > 0; }
  tick(dt: number) {
    const c = this.e.ctx!, now = c.currentTime;
    // the level glides (τ 1.5 s); the deck schedules while it can be heard
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / 1.5)); this.out.gain.setTargetAtTime(this.target * this.level0, now, 1.5);
    if (this.target <= 0 && this.level < 0.003) { this.release(); return; }
    const recs = this.lib.ready('beds', this.layer, 0); if (!recs.length) return;
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + LOOKAHEAD) this.schedule(this.next, recs);
  }
  /** pick a recording and a window not heard within REPEAT_S: the parts of each recording that no stretch started in the last
   *  REPEAT_S covers are free; the window is drawn inside a free part (a random one of those long enough, its length from
   *  STRETCH, shortened to fit down to MIN_STRETCH); with none free, the least recently heard window */
  private pick(t: number, recs: { rec: Rec; buf: AudioBuffer }[]) {
    const free: { r: { rec: Rec; buf: AudioBuffer }; a: number; b: number }[] = [];
    for (const r of recs) {
      const busy = this.log.filter(p => p.file === r.rec.file && t - p.at < REPEAT_S).map(p => [p.from, p.to] as [number, number]).sort((x, y) => x[0] - y[0]);
      let at = 0; for (const [a, b] of busy) { if (a > at) free.push({ r, a: at, b: a }); at = Math.max(at, b); } if (r.buf.duration > at) free.push({ r, a: at, b: r.buf.duration });
    }
    const fits = free.filter(f => f.b - f.a >= MIN_STRETCH && f.r.rec.file !== this.lastFile), ok = fits.length ? fits : free.filter(f => f.b - f.a >= MIN_STRETCH);
    if (ok.length) {
      const f = ok[this.rng.int(0, ok.length - 1)], len = Math.min(f.b - f.a, this.rng.range(STRETCH[0], STRETCH[1]));
      return { r: f.r, from: f.a + this.rng.next() * (f.b - f.a - len), len };
    }
    // nothing free (recordings shorter than REPEAT_S + a stretch): the window heard longest ago
    const r = recs[this.rng.int(0, recs.length - 1)], len = Math.min(r.buf.duration, STRETCH[0]);
    let best = { from: 0, last: Infinity }; for (let k = 0; k < 8; k++) { const from = this.rng.next() * Math.max(0, r.buf.duration - len); let last = -Infinity; for (const p of this.log) if (p.file === r.rec.file && from < p.to && from + len > p.from) last = Math.max(last, p.at); const age = t - last; if (age > best.last || best.last === Infinity) best = { from, last: age }; }
    return { r, from: best.from, len };
  }
  private schedule(t: number, recs: { rec: Rec; buf: AudioBuffer }[]) {
    const c = this.e.ctx!, { r, from, len } = this.pick(t, recs), F = Math.min(FADE, len / 3);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = r.buf;
    g.gain.value = 0; g.gain.setValueCurveAtTime(EQ_IN, t, F); g.gain.setValueCurveAtTime(EQ_OUT, t + len - F, F);
    s.connect(g); g.connect(this.out); s.start(t, from, len); s.stop(t + len);
    s.onended = () => { try { s.disconnect(); g.disconnect(); } catch { /* gone */ } };
    this.log.push({ file: r.rec.file, at: t, from, to: from + len }); if (this.log.length > 64) this.log.shift();
    if (!this.held.has(r.rec.file)) { this.held.add(r.rec.file); this.lib.pin(r.rec.file, true); }
    this.lastFile = r.rec.file; this.next = t + len - F;
  }
  release() { for (const f of this.held) this.lib.pin(f, false); this.held.clear(); this.next = -1; }
}

/** the beds playing now: a deck per layer in the plan; decks out of the plan fade and stop */
export class BedMixer {
  readonly decks = new Map<string, BedDeck>(); private rng = new Rng(7, 'beds');
  /** the layers of the last plan that played from recordings (the synthesis ducks these), and the ones that could not */
  recorded = new Set<string>(); unrecorded = new Set<string>();
  constructor(readonly e: AudioEngine, readonly lib: SoundLibrary) {}
  update(dt: number, plan: BedMix[]) {
    this.recorded.clear(); this.unrecorded.clear();
    for (const b of plan) {
      if (!this.lib.has('beds', b.layer)) { this.unrecorded.add(b.layer); continue; }
      let d = this.decks.get(b.layer); if (!d) this.decks.set(b.layer, d = new BedDeck(this.e, this.lib, b.layer, this.rng));
      d.target = b.gain; if (d.playable()) this.recorded.add(b.layer); else this.unrecorded.add(b.layer);
    }
    for (const [k, d] of this.decks) { if (!plan.some(b => b.layer === k)) d.target = 0; d.tick(dt); if (d.target <= 0 && d.level < 0.003) { d.out.disconnect(); this.decks.delete(k); } }
  }
  line(): string {
    const on = [...this.decks].filter(([, d]) => d.level > 0.02).map(([k, d]) => `${k} ${d.level.toFixed(2)}`);
    return `beds recorded (D-620): ${on.join(' · ') || 'none playing'}${this.unrecorded.size ? ` · synthesised (no recording yet): ${[...this.unrecorded].join(', ')}` : ''}`;
  }
}

/** variety without repeats: the set's recordings in a shuffled order, the last two skipped */
class Picker {
  private last: string[] = [];
  constructor(private rng: Rng) {}
  pick<T extends { rec: Rec }>(xs: T[]): T {
    const fresh = xs.filter(x => !this.last.includes(x.rec.file)), from = fresh.length ? fresh : xs, x = from[this.rng.int(0, from.length - 1)];
    this.last.push(x.rec.file); if (this.last.length > Math.min(2, xs.length - 1)) this.last.shift(); return x;
  }
}

/** a surface without its own recording borrows the nearest one's (by hardness and grain; C) */
export const FOOT_NEAR: Partial<Record<FootSurface, FootSurface[]>> = {
  plaster: ['stone', 'wood'], dust: ['earth', 'gravel'], mud: ['earth', 'grass'], water: ['gravel', 'earth'], gravel: ['earth'], earth: ['gravel', 'dust'],
  grass: ['leaves', 'earth'], leaves: ['grass', 'earth'], snow: ['gravel'], wood: ['plaster', 'stone'], rug: ['plaster', 'earth'], stone: ['plaster'],
};
export interface ShotOpts { h?: number; ref?: number; max?: number; gain?: number; dur?: number; channel?: 'effects' | 'ambience' }
/** the one-shot sets and footsteps from recordings; each call says whether it played (false: the caller synthesises) */
export class Shots {
  private pickers = new Map<string, Picker>(); private rng = new Rng(11, 'shots');
  played = 0; synthesised = 0;
  constructor(readonly e: AudioEngine, readonly lib: SoundLibrary) {}
  private picker(k: string) { let p = this.pickers.get(k); if (!p) this.pickers.set(k, p = new Picker(this.rng)); return p; }
  private voice(buf: AudioBuffer, out: AudioNode, t: number, gain: number, rate: number) {
    const c = this.e.ctx!, s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = gain;
    s.connect(g); g.connect(out); s.start(t); s.onended = () => { try { s.disconnect(); g.disconnect(); } catch { /* gone */ } };
    return buf.duration / rate;
  }
  /** a set's recording at a world position (through the occlusion), or false */
  at(set: string, pos: { x: number; y: number; z: number }, o: ShotOpts = {}, delay = 0): boolean {
    const c = this.e.ctx; if (!c) return false;
    const xs = this.lib.ready('oneshots', set, 1); if (!xs.length) { this.synthesised++; return false; }
    const x = this.picker(set).pick(xs), t = c.currentTime + delay, rate = 1 + this.rng.range(-0.06, 0.06), gain = SHOT_LEVEL * (o.gain ?? 1) * 10 ** (this.rng.range(-2, 2) / 20);
    const p = this.e.panner(pos.x, pos.y + (o.h ?? 0.5), pos.z, o.ref ?? 3, o.max ?? 300);
    const d = this.voice(x.buf, p, t, gain, rate); this.e.route(p, o.channel ?? 'effects', t + d); this.played++; return true;
  }
  /** a set's recording without a position (thunder rolling over the whole sky), or false */
  flat(set: string, o: ShotOpts = {}, delay = 0): boolean {
    const c = this.e.ctx; if (!c) return false;
    const xs = this.lib.ready('oneshots', set, 1); if (!xs.length) { this.synthesised++; return false; }
    const x = this.picker(set).pick(xs); this.voice(x.buf, this.e.ch[o.channel ?? 'effects'], c.currentTime + delay, SHOT_LEVEL * (o.gain ?? 1) * 10 ** (this.rng.range(-2, 2) / 20), 1 + this.rng.range(-0.04, 0.04)); this.played++; return true;
  }
  /** a footstep on a surface at a pace, or false */
  step(surface: FootSurface, run: boolean): boolean {
    const c = this.e.ctx; if (!c) return false;
    let xs = run ? this.lib.ready('foot', `${surface}_run`, 0) : []; const asRun = run && xs.length > 0;
    // the surface's own walk, else the nearest surface that has one (FOOT_NEAR, C) before the synthesis
    for (const s of [surface, ...(FOOT_NEAR[surface] ?? [])]) { if (xs.length) break; if (this.lib.has('foot', `${s}_walk`)) xs = this.lib.ready('foot', `${s}_walk`, 0); }
    if (!xs.length) return false;
    const x = this.picker(`foot:${surface}`).pick(xs), gain = (run && !asRun ? 1.4 : 1) * FOOT_LEVEL * 10 ** (this.rng.range(-1.5, 1.5) / 20);
    this.voice(x.buf, this.e.ch.effects, c.currentTime + 0.005, gain, 1 + this.rng.range(-0.04, 0.04)); this.played++; return true;
  }
}
/** every bed layer the plan can ask for (a guard for the census and the fetch list) */
export const ALL_BEDS: readonly string[] = BED_LAYERS;
