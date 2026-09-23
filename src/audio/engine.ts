// Spatial audio engine (brief §11): Web Audio with HRTF panning, per-channel mixer (ambience, voices, music, effects),
// convolution reverb whose impulse response is generated from each space's dimensions and materials (Sabine RT60),
// and zone-based reverb switching. All sources are procedural (no recordings needed; CC0 by construction).
export type Channel = 'ambience' | 'voices' | 'music' | 'effects';
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
  /** HRTF panner at a world position (listener updated each frame) */
  panner(x: number, y: number, z: number, ref = 4, max = 400): PannerNode {
    const p = this.ctx!.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; return p;
  }
  setListener(pos: { x: number; y: number; z: number }, fwd: { x: number; y: number; z: number }) {
    if (!this.ctx) return; const l = this.ctx.listener, t = this.ctx.currentTime;
    if (l.positionX) { l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02); l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else (l as any).setPosition(pos.x, pos.y, pos.z);
  }
  noiseBuffer(seconds: number, colour: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
    const c = this.ctx!, n = Math.floor(c.sampleRate * seconds), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0, seed = 987654;
    for (let i = 0; i < n; i++) { const w = ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
      if (colour === 'white') d[i] = w; else if (colour === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    return b;
  }
}
