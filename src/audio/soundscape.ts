// Procedural soundscape (brief §11; research/SOUNDSCAPE.md). Every layer is synthesised in Web Audio:
//  wind (filtered noise ∝ wind speed, column whistle inside colonnades), rain on stone, thunder, fire crackle at each lit
//  fire, birds by season/time (see-see partridge & chukar on the slope, hoopoe, bee-eater Apr–Sep, swallows, sparrows,
//  jackals at dusk/night), masons' chisels at the Hall of 100 Columns site during working hours, footsteps by surface.
// No music plays unless someone in the world is playing (none yet). Tiers: species B/C (SOUND-R), sound designs C.
import { AudioEngine, Space } from './engine';
import { Rng } from '../core/rng';

export const SPACES: Record<string, Space> = {
  open: { id: 'open', volume: 2e6, surface: 1e6, alpha: 0.9 },
  // Apadana hall: 60.5 m square × ~19.5 m; plaster walls, lime-plaster floor, timber ceiling; hangings/furnishings assumed (ᾱ 0.14, C)
  apadana: { id: 'apadana', volume: 60.5 * 60.5 * 19.5, surface: 2 * 60.5 * 60.5 + 4 * 60.5 * 19.5, alpha: 0.14 },
  gate: { id: 'gate', volume: 24.74 * 24.74 * 17, surface: 2 * 24.74 * 24.74 + 4 * 24.74 * 17, alpha: 0.1 },
  portico: { id: 'portico', volume: 60 * 18 * 19, surface: 60 * 18 * 2 + 60 * 19, alpha: 0.5 },
};

type Bird = { id: string; months: number[]; hours: [number, number][]; call: (e: AudioEngine, out: AudioNode, t: number, r: Rng) => void; rate: number; tier: string };
const chirp = (e: AudioEngine, out: AudioNode, t: number, f0: number, f1: number, dur: number, gain: number) => {
  const c = e.ctx!, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
};
export const BIRDS: Bird[] = [
  { id: 'see-see partridge', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5, 8.5], [17, 19.5]], rate: 0.12, tier: 'B species / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 4 + r.int(0, 3); i++) chirp(e, o, t + i * 0.28, 1500, 1900, 0.12, 0.05); } },
  { id: 'chukar', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5.5, 9], [16.5, 19]], rate: 0.08, tier: 'B/C',
    call: (e, o, t, r) => { for (let i = 0; i < 5 + r.int(0, 4); i++) chirp(e, o, t + i * 0.18, 700 + i * 30, 900 + i * 30, 0.1, 0.05); } },
  { id: 'hoopoe', months: [2, 3, 4, 5, 6, 7], hours: [[6, 11], [15, 18]], rate: 0.06, tier: 'C',
    call: (e, o, t) => { for (let i = 0; i < 3; i++) chirp(e, o, t + i * 0.22, 480, 450, 0.12, 0.06); } },
  { id: 'bee-eater', months: [3, 4, 5, 6, 7, 8], hours: [[7, 18]], rate: 0.1, tier: 'B range / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 2 + r.int(0, 3); i++) chirp(e, o, t + i * 0.35 + r.next() * 0.1, 2400, 2000, 0.09, 0.03); } },
  { id: 'swallow', months: [2, 3, 4, 5, 6, 7, 8], hours: [[6, 19]], rate: 0.25, tier: 'C',
    call: (e, o, t, r) => { for (let i = 0; i < 6; i++) chirp(e, o, t + i * 0.07, 3500 + r.next() * 1500, 4200 + r.next() * 800, 0.04, 0.015); } },
  { id: 'house sparrow', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[5.5, 19]], rate: 0.3, tier: 'C',
    call: (e, o, t, r) => { for (let i = 0; i < 2 + r.int(0, 4); i++) chirp(e, o, t + i * 0.2, 3000, 2600, 0.08, 0.02); } },
  { id: 'golden jackal', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hours: [[19.5, 24], [0, 4.5]], rate: 0.015, tier: 'B species / C call',
    call: (e, o, t, r) => { for (let i = 0; i < 5; i++) chirp(e, o, t + i * 0.45 + r.next() * 0.2, 700 + r.next() * 300, 1300 + r.next() * 200, 0.4, 0.03); } },
  { id: 'crickets', months: [3, 4, 5, 6, 7, 8, 9], hours: [[20, 24], [0, 4]], rate: 1.5, tier: 'C',
    call: (e, o, t, r) => { chirp(e, o, t + r.next() * 0.1, 4500, 4500, 0.05, 0.004); } },
];

export class Soundscape {
  private windSrc?: AudioBufferSourceNode; private windGain?: GainNode; private windFilter?: BiquadFilterNode; private whistle?: BiquadFilterNode; private whistleGain?: GainNode;
  private rainSrc?: AudioBufferSourceNode; private rainGain?: GainNode; private birdBus?: GainNode;
  private fireNodes = new Map<string, { gain: GainNode; pan: PannerNode }>();
  private rng = new Rng(1, 'soundscape'); private nextStep = 0; private nextChisel = 0; private started = false;
  lastSpace = 'open';
  constructor(readonly e: AudioEngine) {}
  private start() {
    const e = this.e, c = e.ctx!; this.started = true;
    const loop = (buf: AudioBuffer) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    this.windSrc = loop(e.noiseBuffer(6, 'pink')); this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(e.ch.ambience);
    this.whistle = c.createBiquadFilter(); this.whistle.type = 'bandpass'; this.whistle.Q.value = 18; this.whistle.frequency.value = 520; this.whistleGain = c.createGain(); this.whistleGain.gain.value = 0;
    this.windSrc.connect(this.whistle); this.whistle.connect(this.whistleGain); this.whistleGain.connect(e.ch.ambience);
    this.rainSrc = loop(e.noiseBuffer(5, 'white')); const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 900; this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    this.rainSrc.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(e.ch.ambience);
    this.birdBus = c.createGain(); this.birdBus.gain.value = 1; this.birdBus.connect(e.ch.ambience);
  }
  thunder(delay: number, strength: number) {
    const e = this.e; if (!e.ctx) return; const c = e.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = e.noiseBuffer(6, 'brown'); const g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180 + 400 * strength;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.min(1, 0.6 * strength + 0.2), t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
    s.connect(f); f.connect(g); g.connect(e.ch.effects); s.start(t); s.stop(t + 6);
  }
  /** a one-shot from a person's work at a world position (driven by the animation, so what you hear is what is done) */
  strike(kind: string, pos: { x: number; y: number; z: number }) {
    const e = this.e, c = e.ctx; if (!c) return; const t = c.currentTime;
    if (kind === 'chisel') { // iron/bronze chisel on limestone (C)
      const p = e.panner(pos.x, pos.y + 1, pos.z, 3, 300), o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2200 + this.rng.next() * 900;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06); o.connect(g); g.connect(p); p.connect(e.ch.effects); o.start(t); o.stop(t + 0.08);
    } else if (kind === 'quern') { // stone rubbing on stone: band-passed brown noise swell
      const p = e.panner(pos.x, pos.y + 0.4, pos.z, 2, 60), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = e.noiseBuffer(0.7, 'brown'); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 0.65); s.connect(f); f.connect(g); g.connect(p); p.connect(e.ch.effects); s.start(t);
    } else if (kind === 'dice') { // knucklebones on a hard floor: two or three clicks
      const p = e.panner(pos.x, pos.y + 0.2, pos.z, 1.5, 40);
      for (let i = 0; i < 3; i++) { const o = c.createOscillator(), g = c.createGain(), tt = t + i * (0.06 + this.rng.next() * 0.05); o.type = 'square'; o.frequency.value = 1400 + this.rng.next() * 600;
        g.gain.setValueAtTime(0.03, tt); g.gain.exponentialRampToValueAtTime(0.0003, tt + 0.02); o.connect(g); g.connect(p); o.start(tt); o.stop(tt + 0.03); }
      p.connect(e.ch.effects);
    }
  }
  footstep(surface: 'stone' | 'earth' | 'plaster', run: boolean) {
    const e = this.e; if (!e.ctx) return; const c = e.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = e.noiseBuffer(0.12, surface === 'earth' ? 'brown' : 'white');
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = surface === 'stone' ? 1800 : surface === 'plaster' ? 1200 : 400; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime((run ? 0.12 : 0.07) * (surface === 'earth' ? 1.6 : 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    s.connect(f); f.connect(g); g.connect(e.ch.effects); s.start(t);
  }
  update(dt: number, ctx: { hour: number; month: number; windMs: number; rain: number; insideSpace: string; nearColumns: boolean; stepPhase: number; running: boolean; surface: 'stone' | 'earth' | 'plaster';
    fires: { id: string; lit: boolean; pos: { x: number; y: number; z: number } }[]; listener: { x: number; y: number; z: number }; worksite: { x: number; y: number; z: number } | null; workHours: boolean }) {
    const e = this.e; if (!e.ctx || e.ctx.state !== 'running') return; if (!this.started) this.start();
    const c = e.ctx, t = c.currentTime;
    const sp = SPACES[ctx.insideSpace] ?? SPACES.open; e.setSpace(sp, ctx.insideSpace === 'open' ? 0.05 : 0.35);
    const inside = ctx.insideSpace === 'apadana' || ctx.insideSpace === 'gate';
    this.windGain!.gain.setTargetAtTime(Math.min(0.5, 0.03 + ctx.windMs * 0.04) * (inside ? 0.25 : 1), t, 0.5);
    this.windFilter!.frequency.setTargetAtTime(250 + ctx.windMs * 120, t, 0.5);
    this.whistleGain!.gain.setTargetAtTime(ctx.nearColumns ? Math.min(0.08, Math.max(0, ctx.windMs - 3) * 0.015) : 0, t, 0.8);
    this.rainGain!.gain.setTargetAtTime(ctx.rain * (inside ? 0.12 : 0.35), t, 0.4);
    // birds: Poisson calls by species season/time; muffled inside
    this.birdBus!.gain.setTargetAtTime((inside ? 0.25 : 1) * (1 - ctx.rain * 0.8), t, 0.5);
    for (const b of BIRDS) {
      if (!b.months.includes(ctx.month)) continue; if (!b.hours.some(([a, z]) => ctx.hour >= a && ctx.hour < z)) continue;
      if (this.rng.next() < b.rate * dt) {
        const ang = this.rng.next() * Math.PI * 2, dist = 15 + this.rng.next() * 80;
        const p = e.panner(ctx.listener.x + Math.cos(ang) * dist, ctx.listener.y + 3 + this.rng.next() * 15, ctx.listener.z + Math.sin(ang) * dist, 6);
        p.connect(this.birdBus!); b.call(e, p, t + 0.02, this.rng);
      }
    }
    // fires: crackle source per lit fire within 40 m
    for (const f of ctx.fires) {
      const d = Math.hypot(f.pos.x - ctx.listener.x, f.pos.y - ctx.listener.y, f.pos.z - ctx.listener.z);
      let n = this.fireNodes.get(f.id);
      if (f.lit && d < 40 && !n) { const s = c.createBufferSource(); s.buffer = e.noiseBuffer(3, 'pink'); s.loop = true; const lf = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 900;
        const g = c.createGain(); g.gain.value = 0; const pan = e.panner(f.pos.x, f.pos.y, f.pos.z, 1.5, 60); s.connect(lf); lf.connect(g); g.connect(pan); pan.connect(e.ch.effects); s.start(); n = { gain: g, pan }; this.fireNodes.set(f.id, n); }
      if (n) { n.gain.gain.setTargetAtTime(f.lit && d < 40 ? 0.08 * (0.7 + 0.3 * Math.random()) : 0, t, 0.05); if (this.rng.next() < dt * 6 && f.lit && d < 25) { // crackle pops
          const s = c.createBufferSource(); s.buffer = e.noiseBuffer(0.02, 'white'); const g = c.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03); s.connect(g); g.connect(n.pan); s.start(t); } }
    }
    // generic worksite chisels only when no simulated masons drive `strike` (kept for audio tests without people)
    if (ctx.worksite && ctx.workHours && (this.nextChisel -= dt) <= 0) {
      this.nextChisel = 0.35 + this.rng.next() * 0.6;
      const p = e.panner(ctx.worksite.x + (this.rng.next() - 0.5) * 30, ctx.worksite.y + 1, ctx.worksite.z + (this.rng.next() - 0.5) * 30, 3, 300);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2200 + this.rng.next() * 900;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06); o.connect(g); g.connect(p); p.connect(e.ch.effects); o.start(t); o.stop(t + 0.08);
    }
    // footsteps from the player's gait phase (two per stride)
    const stepIdx = Math.floor(ctx.stepPhase / Math.PI); if (stepIdx !== this.nextStep) { if (this.nextStep !== 0) this.footstep(ctx.surface, ctx.running); this.nextStep = stepIdx; }
  }
}
