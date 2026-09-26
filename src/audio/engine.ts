// Spatial audio engine (brief §11): Web Audio with HRTF panning, per-channel mixer (ambience, voices, music, effects),
// convolution reverb whose impulse response is generated from each space's dimensions and materials (Sabine RT60),
// and zone-based reverb switching. All sources are procedural (no recordings needed; CC0 by construction).
export type Channel = 'ambience' | 'voices' | 'music' | 'effects';
/** occlusion of one source at the listener (src/audio/occlusion.ts; D-178): dB ≤ 0, low-pass cutoff, the path taken */
export interface Occlusion { gainDb: number; cutoffHz: number; path: string }
interface Routed { lp: BiquadFilterNode; g: GainNode; ends: number; last: Occlusion | null; ch: Channel }
export interface Space { id: string; volume: number; surface: number; alpha: number } // m³, m², mean absorption
/** Sabine: RT60 = 0.161 V / (S·ᾱ) (s). */
export const rt60 = (s: Space) => (0.161 * s.volume) / (s.surface * s.alpha);

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; ch!: Record<Channel, GainNode>;
  private dry!: GainNode; private wet!: GainNode; private conv!: ConvolverNode;
  private irCache = new Map<string, AudioBuffer>(); currentSpace = '';
  unlocked = false;
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
    this.ctx = new Ctx({ latencyHint: 'interactive' }); const c = this.ctx!;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.dry = c.createGain(); this.wet = c.createGain(); this.conv = c.createConvolver();
    this.dry.connect(this.master); this.conv.connect(this.wet); this.wet.connect(this.master);
    this.ch = {} as any;
    for (const k of ['ambience', 'voices', 'music', 'effects'] as Channel[]) { const g = c.createGain(); g.connect(this.dry); g.connect(this.conv); this.ch[k] = g; }
    this.unlocked = true;
  }
  setVolumes(v: { master: number; ambience: number; voices: number; music: number; effects: number }) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.master, t, 0.1);
    for (const k of Object.keys(this.ch) as Channel[]) this.ch[k].gain.setTargetAtTime((v as any)[k], t, 0.1);
  }
  /** synthetic IR: exponentially decaying stereo noise with early reflections from the room's size (C: a statistical room model). */
  private makeIR(s: Space): AudioBuffer {
    const c = this.ctx!, T = Math.min(8, Math.max(0.25, rt60(s))), sr = c.sampleRate, n = Math.floor(sr * Math.min(T * 1.2, 8));
    const b = c.createBuffer(2, n, sr), L = Math.cbrt(s.volume);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let seed = 12345 + ch * 777;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = rnd() * Math.exp((-6.9 * t) / T) * (t < 0.005 ? t / 0.005 : 1) * 0.5; }
      for (let k = 1; k <= 6; k++) { const i = Math.floor(((L * k * 0.6) / 343) * sr); if (i < n) d[i] += (ch ? -1 : 1) * 0.6 * Math.pow(1 - s.alpha, k); }
    }
    return b;
  }
  setSpace(s: Space, wetLevel: number) {
    if (!this.ctx || this.currentSpace === s.id) return;
    let ir = this.irCache.get(s.id); if (!ir) { ir = this.makeIR(s); this.irCache.set(s.id, ir); }
    this.conv.buffer = ir; this.currentSpace = s.id; this.wet.gain.setTargetAtTime(wetLevel, this.ctx.currentTime, 0.3);
  }
  /** occlusion by the built geometry (world coordinates of source and listener); null = none (tests, no architecture) */
  occluder: ((src: { x: number; y: number; z: number }, lis: { x: number; y: number; z: number }) => Occlusion) | null = null;
  private routed = new Map<PannerNode, Routed>(); private rr: PannerNode[] = []; private rrI = 0;
  private listenerPos = { x: 0, y: 0, z: 0 };
  /** occlusion cost and state for the dev overlay and the budget (queries run in the last update, its time) */
  readonly occlStats = { tracked: 0, queries: 0, ms: 0 };
  /** connect a spatial source's panner to a channel through its occlusion (panner → low-pass → gain → channel). The
   *  panner's own position is the source's; `ends` (context time) lets one-shots and finished clips be dropped. */
  route(pan: PannerNode, ch: Channel, ends = Infinity): GainNode {
    const c = this.ctx!, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 20000;
    pan.connect(lp); lp.connect(g); g.connect(this.ch[ch]);
    const r: Routed = { lp, g, ends, last: null, ch }; this.routed.set(pan, r); this.rr.push(pan);
    this.applyOcclusion(pan, r, true); // the first value at once (a one-shot is never heard unoccluded)
    return g;
  }
  /** a routed source is finished: disconnect its occlusion nodes */
  release(pan: PannerNode) { const r = this.routed.get(pan); if (!r) return; try { r.g.disconnect(); r.lp.disconnect(); } catch { /* gone */ } this.routed.delete(pan); }
  /** the occlusion last applied to a routed source (dev overlay) */
  occlusionOf(pan: PannerNode | null | undefined): Occlusion | null { return pan ? this.routed.get(pan)?.last ?? null : null; }
  private applyOcclusion(pan: PannerNode, r: Routed, now: boolean) {
    if (!this.occluder || !this.ctx) return;
    const o = this.occluder({ x: pan.positionX.value, y: pan.positionY.value, z: pan.positionZ.value }, this.listenerPos); r.last = o; this.occlStats.queries++;
    const t = this.ctx.currentTime, gain = 10 ** (o.gainDb / 20), fc = Math.min(o.cutoffHz, this.ctx.sampleRate * 0.45);
    if (now) { r.g.gain.value = gain; r.lp.frequency.value = fc; } else { r.g.gain.setTargetAtTime(gain, t, 0.12); r.lp.frequency.setTargetAtTime(fc, t, 0.12); }
  }
  /** re-query the occlusion of up to `budget` routed sources (round robin), and drop finished ones. Call once per frame
   *  after setListener. Measured cost per query ~0.1 ms (tests/occlusion.test.ts), so the default budget is ~0.4 ms */
  updateOcclusion(budget = 4) {
    if (!this.ctx) return; const t0 = performance.now(), now = this.ctx.currentTime; this.occlStats.queries = 0;
    if (this.rr.length !== this.routed.size) { this.rr = [...this.routed.keys()]; this.rrI = 0; }
    for (const [pan, r] of this.routed) if (now > r.ends + 0.5) this.release(pan);
    if (this.rr.length !== this.routed.size) { this.rr = [...this.routed.keys()]; this.rrI = 0; }
    for (let k = 0; k < Math.min(budget, this.rr.length); k++) { this.rrI = (this.rrI + 1) % this.rr.length; const pan = this.rr[this.rrI], r = this.routed.get(pan); if (r) this.applyOcclusion(pan, r, false); }
    this.occlStats.tracked = this.routed.size; this.occlStats.ms = performance.now() - t0;
  }
  /** HRTF panner at a world position (listener updated each frame) */
  panner(x: number, y: number, z: number, ref = 4, max = 400): PannerNode {
    const p = this.ctx!.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; return p;
  }
  setListener(pos: { x: number; y: number; z: number }, fwd: { x: number; y: number; z: number }) {
    if (!this.ctx) return; const l = this.ctx.listener, t = this.ctx.currentTime; this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    if (l.positionX) { l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02); l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else (l as any).setPosition(pos.x, pos.y, pos.z);
  }
  private noiseN = 0;
  /** a fresh noise buffer: each call starts its own sequence (audit D: one fixed seed made every footstep, strike and fire
   *  crackle the same waveform, so repeats were audible; MASTER_PLAN T-G2, T-G2f) */
  noiseBuffer(seconds: number, colour: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
    const c = this.ctx!, n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0, seed = noiseSeed(++this.noiseN);
    for (let i = 0; i < n; i++) { const w = ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
      if (colour === 'white') d[i] = w; else if (colour === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    return b;
  }
}
/** the n-th noise buffer's generator seed (a 32-bit mix of n; distinct for every n below 2³²) */
export function noiseSeed(n: number): number { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
