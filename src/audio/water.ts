// Running water (D-245; MASTER_PLAN T-G3e "rivers within 50 m audible"; audit D M13: "no continuous water sound for rivers
// or canals"). The Pulvar, the Kur and the irrigation canals of the plain (world/plain: rivers.json, canals.ts) sound where
// the listener is near them: for each kind the nearest point of the nearest channel carries a source that follows the
// listener along the bank. A river is a low rumble (brown noise under 400 Hz) and a wandering gurgle at the banks (pink
// noise through a band-pass whose centre and level drift slowly); a canal is a smaller trickle. Both are NoiseStreams
// (src/audio/beds.ts: never a loop). A channel is a line source: its level falls ~3 dB per doubling of distance, not 6, so
// the panner's roll-off is ROLLOFF (0.4, inverse model). Loudness follows the river's regime by month (FLOW: snowmelt high water in
// spring, low water in late summer; C, from the general regime of the Zagros rivers, no gauge series read). Tier C
// throughout: the design, the levels and the regime. Rivers and canals are not occluded by the Terrace (they are far from it).
import type { AudioEngine } from './engine';
import { NoiseStream } from './beds';
import { Rng } from '../core/rng';

type P2 = [number, number];
export interface WaterLine { pts: readonly P2[]; half: number; kind: 'river' | 'canal' }
/** relative flow by month (0 = January; C: the snowmelt regime, high Mar–May, lowest Aug–Sep) */
export const FLOW = [0.7, 0.8, 1, 1, 0.9, 0.65, 0.5, 0.42, 0.42, 0.48, 0.58, 0.66] as const;
/** how far each kind is heard (m) and its level at the panner's reference distance */
export const WATER_KIND = { river: { reach: 150, rumble: 1.4, gurgle: 0.95 }, canal: { reach: 60, rumble: 0.25, gurgle: 0.65 } } as const;

/** the panner's roll-off for a channel (a line source over soft ground falls ~3–4 dB per doubling; C) */
export const ROLLOFF = 0.4;

interface Src { kind: 'river' | 'canal'; pan: PannerNode; gain: GainNode; rumble: NoiseStream; gurgle: NoiseStream; bp: BiquadFilterNode; on: boolean; d: number; at: P2 }

/** nearest point on a set of polylines, from a 100 m bucket grid of their segments */
export class LineIndex {
  private cells = new Map<number, number[]>(); private segs: { a: P2; b: P2; half: number }[] = [];
  constructor(lines: readonly WaterLine[], readonly cell = 100) {
    for (const L of lines) for (let i = 0; i < L.pts.length - 1; i++) {
      const a = L.pts[i], b = L.pts[i + 1], k = this.segs.push({ a, b, half: L.half }) - 1;
      const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell), j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) { const h = x * 73856093 ^ y * 19349663; let c = this.cells.get(h); if (!c) this.cells.set(h, c = []); c.push(k); }
    }
  }
  get size() { return this.segs.length; }
  /** the nearest point on any line within `r` of (e, n) and its distance to the water's edge (≥ 0), or null */
  nearest(e: number, n: number, r: number): { at: P2; d: number; half: number } | null {
    const c = this.cell, i0 = Math.floor((e - r) / c), i1 = Math.floor((e + r) / c), j0 = Math.floor((n - r) / c), j1 = Math.floor((n + r) / c);
    let best: { at: P2; d: number; half: number } | null = null, bd = Infinity; const seen = new Set<number>();
    for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) for (const k of this.cells.get(x * 73856093 ^ y * 19349663) ?? []) {
      if (seen.has(k)) continue; seen.add(k); const { a, b, half } = this.segs[k];
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, u = L2 > 0 ? Math.max(0, Math.min(1, ((e - a[0]) * dx + (n - a[1]) * dy) / L2)) : 0;
      const px = a[0] + u * dx, py = a[1] + u * dy, d = Math.hypot(e - px, n - py);
      if (d < bd && d - half <= r) { bd = d; best = { at: [px, py], d: Math.max(0, d - half), half }; }
    }
    return best;
  }
}

export class WaterSound {
  private idx: Record<'river' | 'canal', LineIndex>;
  private src: Partial<Record<'river' | 'canal', Src>> = {};
  private rng: Rng; private nextQ = 0;
  /** the last update's nearest water per kind (tests, overlay): distance to the edge (m), or Infinity */
  readonly near = { river: Infinity, canal: Infinity };
  constructor(readonly e: AudioEngine, lines: readonly WaterLine[], readonly ground: (e: number, n: number) => number = () => 0, seed = 1) {
    this.idx = { river: new LineIndex(lines.filter(l => l.kind === 'river')), canal: new LineIndex(lines.filter(l => l.kind === 'canal')) };
    this.rng = new Rng(seed, 'water');
  }
  private make(kind: 'river' | 'canal', at: P2): Src {
    const e = this.e, c = e.ctx!, K = WATER_KIND[kind];
    const rumble = new NoiseStream(e, 'brown', { seg: 6, fade: 0.6, sampleRate: 8000 }), gurgle = new NoiseStream(e, 'pink', { seg: 5, fade: 0.5, sampleRate: 16000 });
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'river' ? 400 : 700; const rg = c.createGain(); rg.gain.value = K.rumble;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'river' ? 1100 : 1900; bp.Q.value = kind === 'river' ? 1.1 : 1.6; const gg = c.createGain(); gg.gain.value = K.gurgle;
    // the gurgle drifts: its centre (±25 %) and its level (±35 %) on two slow incommensurate oscillators, their rates by seed
    const lf1 = c.createOscillator(), lg1 = c.createGain(), lf2 = c.createOscillator(), lg2 = c.createGain();
    lf1.frequency.value = 0.11 + 0.06 * this.rng.next(); lg1.gain.value = bp.frequency.value * 0.25; lf1.connect(lg1); lg1.connect(bp.frequency);
    lf2.frequency.value = 0.29 + 0.17 * this.rng.next(); lg2.gain.value = K.gurgle * 0.35; lf2.connect(lg2); lg2.connect(gg.gain); lf1.start(); lf2.start();
    const gain = c.createGain(); gain.gain.value = 0;
    const y = this.ground(at[0], at[1]) + 0.2, pan = e.panner(at[0], y, -at[1], kind === 'river' ? 4 : 2, 600);
    pan.panningModel = 'equalpower'; pan.rolloffFactor = ROLLOFF;
    rumble.out.connect(lp); lp.connect(rg); rg.connect(gain); gurgle.out.connect(bp); bp.connect(gg); gg.connect(gain); gain.connect(pan); e.route(pan, 'ambience');
    return { kind, pan, gain, rumble, gurgle, bp, on: false, d: Infinity, at };
  }
  /** once a frame: the listener (world coordinates: x east, z = −north) and the month (0 = January) */
  update(listener: { x: number; y: number; z: number }, month: number) {
    const c = this.e.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime, e = listener.x, n = -listener.z;
    const query = t >= this.nextQ; if (query) this.nextQ = t + 0.25;
    for (const kind of ['river', 'canal'] as const) {
      const K = WATER_KIND[kind];
      if (query) { const h = this.idx[kind].size ? this.idx[kind].nearest(e, n, K.reach) : null; this.near[kind] = h ? h.d : Infinity;
        let s = this.src[kind];
        if (h && !s) s = this.src[kind] = this.make(kind, h.at);
        if (s) { s.d = this.near[kind]; s.on = !!h;
          if (h) { s.at = h.at; const y = this.ground(h.at[0], h.at[1]) + 0.2; s.pan.positionX.setTargetAtTime(h.at[0], t, 0.3); s.pan.positionY.setTargetAtTime(y, t, 0.3); s.pan.positionZ.setTargetAtTime(-h.at[1], t, 0.3); }
          s.gain.gain.setTargetAtTime(h ? FLOW[((month % 12) + 12) % 12] : 0, t, 0.8); } }
      const s = this.src[kind]; if (s && s.on) { s.rumble.tick(); s.gurgle.tick(); }
    }
  }
  /** the sources (tests and the offline measurement) */
  sources(): { kind: 'river' | 'canal'; pan: PannerNode; on: boolean; d: number }[] { return Object.values(this.src).filter((s): s is Src => !!s).map(s => ({ kind: s.kind, pan: s.pan, on: s.on, d: s.d })); }
}
