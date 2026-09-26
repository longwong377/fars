// A recording Web Audio context for node (D-245; MASTER_PLAN axis G). Node has no OfflineAudioContext and the repo has no
// node-web-audio-api, so the soundscape cannot be rendered by the browser's engine here. This mock records the graph the
// real code builds (every node, parameter, connection, buffer, start and stop) with real sample data in every buffer, and
// the analysis below measures what can be measured from it:
//  - the limiter: every path to the destination passes the ceiling, whose curve bounds every sample (T-G1 anti-proxy);
//  - loops: looped sources and any buffer started twice within 60 s (T-G2b, T-G2);
//  - the level of each source at the listener (dBFS): the RMS of its buffer through the filters on its path (RBJ biquads
//    run on the samples), times the gains, the panner's distance law and the master bus (T-G3, T-G3e);
//  - a dry mix: every buffer source summed at its start time through its path's gains and filters (no HRTF, no reverb, no
//    oscillators), then the master bus modelled (compressor without look-ahead, the make-up trim, the ceiling curve) and
//    its true peak by 4× oversampling (T-G1, a model: not the browser's render).
import { LIMITER, limiterMakeup } from '../../src/audio/engine';

export class MockParam {
  value: number; events: { k: 'set' | 'lin' | 'exp' | 'target' | 'curve'; v: number; t: number; tau?: number; curve?: Float32Array; dur?: number }[] = [];
  inputs: MockNode[] = [];
  constructor(v: number, readonly owner: MockNode, readonly name: string) { this.value = v; }
  setValueAtTime(v: number, t: number) { this.events.push({ k: 'set', v, t }); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push({ k: 'lin', v, t }); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push({ k: 'exp', v, t }); return this; }
  setTargetAtTime(v: number, t: number, tau: number) { this.events.push({ k: 'target', v, t, tau }); return this; }
  setValueCurveAtTime(curve: ArrayLike<number>, t: number, dur: number) { this.events.push({ k: 'curve', v: curve[curve.length - 1], t, curve: Float32Array.from(curve), dur }); return this; }
  cancelScheduledValues(t: number) { this.events = this.events.filter(e => e.t < t); return this; }
  cancelAndHoldAtTime(t: number) { return this.cancelScheduledValues(t); }
  /** the parameter's value at time t from its automation (the Web Audio rules, simplified: events in time order) */
  at(t: number): number {
    let v = this.value, vt = 0; const ev = [...this.events].sort((a, b) => a.t - b.t);
    for (let i = 0; i < ev.length; i++) { const e = ev[i];
      if (e.k === 'lin' || e.k === 'exp') { if (t >= e.t) { v = e.v; vt = e.t; continue; } if (t > vt) { const f = (t - vt) / (e.t - vt); v = e.k === 'lin' ? v + (e.v - v) * f : v > 0 && e.v > 0 ? v * (e.v / v) ** f : v; } return v; }
      if (e.t > t) break;
      if (e.k === 'set') { v = e.v; vt = e.t; }
      else if (e.k === 'target') { const end = i + 1 < ev.length ? Math.min(t, ev[i + 1].t) : t; v = e.tau! > 0 ? e.v + (v - e.v) * Math.exp(-(end - e.t) / e.tau!) : e.v; vt = end; }
      else if (e.k === 'curve') { const f = Math.min(1, (t - e.t) / e.dur!), c = e.curve!, x = f * (c.length - 1), j = Math.min(c.length - 2, Math.floor(x)); v = c[j] + (c[j + 1] - c[j]) * (x - j); vt = Math.min(t, e.t + e.dur!); }
    }
    return v;
  }
}
export class MockBuffer {
  readonly duration: number; private ch: Float32Array[];
  constructor(readonly numberOfChannels: number, readonly length: number, readonly sampleRate: number) { this.ch = Array.from({ length: numberOfChannels }, () => new Float32Array(length)); this.duration = length / sampleRate; }
  getChannelData(i: number) { return this.ch[i]; }
  copyToChannel(src: Float32Array, i: number, off = 0) { this.ch[i].set(src, off); }
  copyFromChannel(dst: Float32Array, i: number, off = 0) { dst.set(this.ch[i].subarray(off, off + dst.length)); }
}
let NID = 0;
export class MockNode {
  readonly id = ++NID; outputs: (MockNode | MockParam)[] = []; inputs: MockNode[] = []; params: Record<string, MockParam> = {};
  // buffer sources and oscillators
  buffer: MockBuffer | null = null; loop = false; loopStart = 0; loopEnd = 0; startedAt: number | null = null; stopAt = Infinity; onended: (() => void) | null = null; ended = false;
  type = ''; panningModel = 'HRTF'; distanceModel = 'inverse'; refDistance = 1; maxDistance = 10000; rolloffFactor = 1; curve: Float32Array | null = null; oversample = 'none';
  constructor(readonly kind: string, readonly ctx: MockContext) { ctx.nodes.push(this); }
  p(name: string, v: number) { const q = new MockParam(v, this, name); this.params[name] = q; (this as any)[name] = q; return q; }
  connect(d: MockNode | MockParam) { this.outputs.push(d); if (d instanceof MockNode) d.inputs.push(this); else d.inputs.push(this); return d; }
  disconnect() { for (const d of this.outputs) { const a = d.inputs; const i = a.indexOf(this); if (i >= 0) a.splice(i, 1); } this.outputs = []; }
  start(t = 0) { this.startedAt = Math.max(t, this.ctx.currentTime); this.ctx.starts.push(this); }
  stop(t = 0) { this.stopAt = Math.max(t, this.ctx.currentTime); }
}
export class MockContext {
  sampleRate: number; currentTime = 0; state = 'running'; nodes: MockNode[] = []; starts: MockNode[] = [];
  destination: MockNode; listener: any;
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate; this.destination = new MockNode('destination', this);
    const L = new MockNode('listener', this); for (const [k, v] of [['positionX', 0], ['positionY', 0], ['positionZ', 0], ['forwardX', 0], ['forwardY', 0], ['forwardZ', -1], ['upX', 0], ['upY', 1], ['upZ', 0]] as const) L.p(k, v); this.listener = L;
  }
  resume() { return Promise.resolve(); }
  createGain() { const n = new MockNode('gain', this); n.p('gain', 1); return n; }
  createBiquadFilter() { const n = new MockNode('biquad', this); n.type = 'lowpass'; n.p('frequency', 350); n.p('Q', 1); n.p('gain', 0); n.p('detune', 0); return n; }
  createPanner() { const n = new MockNode('panner', this); for (const k of ['positionX', 'positionY', 'positionZ', 'orientationX', 'orientationY', 'orientationZ']) n.p(k, 0); return n; }
  createBufferSource() { const n = new MockNode('source', this); n.p('playbackRate', 1); n.p('detune', 0); return n; }
  createOscillator() { const n = new MockNode('oscillator', this); n.type = 'sine'; n.p('frequency', 440); n.p('detune', 0); return n; }
  createBuffer(ch: number, len: number, sr: number) { return new MockBuffer(ch, len, sr); }
  createConvolver() { return new MockNode('convolver', this); }
  createDynamicsCompressor() { const n = new MockNode('compressor', this); n.p('threshold', -24); n.p('knee', 30); n.p('ratio', 12); n.p('attack', 0.003); n.p('release', 0.25); return n; }
  createWaveShaper() { return new MockNode('shaper', this); }
  /** advance the clock; sources whose stop time passed end (onended) */
  advance(dt: number) { this.currentTime += dt; for (const n of this.starts) if (!n.ended && n.stopAt <= this.currentTime) { n.ended = true; n.onended?.(); } }
  /** buffer sources started in [t0, t1) */
  sourcesIn(t0: number, t1: number) { return this.starts.filter(n => n.kind === 'source' && n.startedAt! >= t0 && n.startedAt! < t1); }
}

// ------------------------------------------------------------------------------------------------ analysis
const dB = (x: number) => 20 * Math.log10(Math.max(1e-12, x));
/** the largest absolute sample */
export const peakOf = (x: ArrayLike<number>) => { let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; } return m; };
/** the limiter: what feeds the destination, whether it is the ceiling, the ceiling's bound, the chain above it */
export function limiterReport(ctx: MockContext) {
  const into = ctx.destination.inputs, sh = into.length === 1 && into[0].kind === 'shaper' ? into[0] : null;
  const bound = sh?.curve ? peakOf(sh.curve) : Infinity;
  const trim = sh?.inputs.length === 1 ? sh.inputs[0] : null, comp = trim?.inputs.length === 1 ? trim.inputs[0] : null;
  return { feeds: into.length, ceilingPresent: !!sh, ceilingBoundDbfs: dB(bound), compressorPresent: comp?.kind === 'compressor', compressor: comp?.kind === 'compressor' ? { threshold: comp.params.threshold.value, ratio: comp.params.ratio.value, knee: comp.params.knee.value, attack: comp.params.attack.value } : null,
    trimMatchesMakeup: !!trim && Math.abs((trim.params.gain?.value ?? 0) * limiterMakeup(comp?.params.threshold.value ?? LIMITER.threshold, comp?.params.ratio.value ?? LIMITER.ratio) - 1) < 1e-6 };
}
/** looped sources, and buffers (≥ 0.3 s) started again within 60 s (a repeat whose period is the interval) */
export function loopReport(ctx: MockContext, win = 60) {
  const looped = ctx.starts.filter(n => n.kind === 'source' && n.loop && n.buffer).map(n => ((n.loopEnd > n.loopStart ? n.loopEnd - n.loopStart : n.buffer!.duration) / Math.max(1e-6, n.params.playbackRate.value)));
  const byBuf = new Map<MockBuffer, number[]>(); for (const n of ctx.starts) if (n.kind === 'source' && n.buffer && n.buffer.duration >= 0.3) { let a = byBuf.get(n.buffer); if (!a) byBuf.set(n.buffer, a = []); a.push(n.startedAt!); }
  let reuses = 0, shortestReuse = Infinity; for (const a of byBuf.values()) { a.sort((x, y) => x - y); for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; if (d < win) { reuses++; shortestReuse = Math.min(shortestReuse, d); } } }
  return { loopedSources: looped.length, shortestLoopS: looped.length ? Math.min(...looped) : Infinity, buffersStarted: [...byBuf.values()].reduce((s, a) => s + a.length, 0), distinctBuffers: byBuf.size, reusesWithin60s: reuses, shortestReuseS: shortestReuse };
}
/** RBJ biquad over samples (lowpass, highpass, bandpass (0 dB peak)) */
export function biquad(x: Float32Array, sr: number, type: string, f0: number, Q: number): Float32Array {
  const w = 2 * Math.PI * Math.min(f0, sr * 0.49) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Math.max(1e-4, Q)); let b0: number, b1: number, b2: number;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; } else if (type === 'bandpass') { b0 = al; b1 = 0; b2 = -al; } else return x;
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** the panner's distance gain (Web Audio distance models) and the equal-power law's gain at the centre (−3 dB per ear) */
export function pannerGain(n: MockNode, lis: { x: number; y: number; z: number }, t: number) {
  const P = n.params, d = Math.hypot(P.positionX.at(t) - lis.x, P.positionY.at(t) - lis.y, P.positionZ.at(t) - lis.z), r = n.refDistance, m = n.maxDistance, k = n.rolloffFactor;
  const dc = Math.max(r, Math.min(d, m)); let g: number;
  if (n.distanceModel === 'linear') g = 1 - k * (dc - r) / (m - r); else if (n.distanceModel === 'exponential') g = (dc / r) ** -k; else g = r / (r + k * (dc - r));
  return { g: g * (n.panningModel === 'equalpower' ? Math.SQRT1_2 : 1), d };
}
export interface Path { gain: number; filters: { type: string; f: number; Q: number }[]; panner: MockNode | null; d: number }
/** the loudest path from a node to the destination at time t: gains (their automation at t), filters, the panner's law;
 *  the convolver's (reverb) branch is left out, the compressor counts as its make-up gain (the level is below threshold) */
export function bestPath(n: MockNode, t: number, lis: { x: number; y: number; z: number }, depth = 0): Path | null {
  if (n.kind === 'destination') return { gain: 1, filters: [], panner: null, d: 0 };
  if (depth > 40 || n.kind === 'convolver') return null;
  let own = 1; const filt: Path['filters'] = []; let pan: MockNode | null = null, d = 0;
  if (n.kind === 'gain') own = n.params.gain.at(t);
  else if (n.kind === 'biquad') filt.push({ type: n.type, f: n.params.frequency.at(t), Q: n.params.Q.at(t) });
  else if (n.kind === 'panner') { const pg = pannerGain(n, lis, t); own = pg.g; pan = n; d = pg.d; }
  else if (n.kind === 'compressor') own = limiterMakeup(n.params.threshold.value, n.params.ratio.value);
  let best: Path | null = null;
  for (const o of n.outputs) { if (!(o instanceof MockNode)) continue; const p = bestPath(o, t, lis, depth + 1); if (p && (!best || p.gain > best.gain)) best = p; }
  if (!best) return null;
  return { gain: best.gain * own, filters: [...filt, ...best.filters], panner: pan ?? best.panner, d: pan ? d : best.d };
}
/** a source's samples through its path's filters, times its gains (mono, at the buffer's rate) */
export function throughPath(src: MockNode, path: Path): Float32Array {
  let x = Float32Array.from(src.buffer!.getChannelData(0)); const sr = src.buffer!.sampleRate * src.params.playbackRate.value;
  for (const f of path.filters) x = biquad(x, sr, f.type, f.f, f.Q) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < x.length; i++) x[i] *= path.gain;
  return x;
}
export const rms = (x: ArrayLike<number>, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
/** the level (dBFS RMS) of a buffer source at the listener: RMS of its active part through its path (filters, gains) */
export function sourceLevel(src: MockNode, t: number, lis: { x: number; y: number; z: number }): { db: number; d: number; path: Path | null } {
  const path = bestPath(src, t, lis); if (!path || !src.buffer) return { db: -Infinity, d: NaN, path };
  const y = throughPath(src, path); const x = src.buffer.getChannelData(0), pk = peakOf(x) || 1;
  // the active part: from the first to the last sample above −40 dB of the peak (the render's leading and trailing silence out)
  let a = 0, b = x.length; while (a < b && Math.abs(x[a]) < pk * 0.01) a++; while (b > a && Math.abs(x[b - 1]) < pk * 0.01) b--;
  return { db: dB(rms(y, a, b)), d: path.d, path };
}

// ------------------------------------------------------------------------------------------------ dry mix and true peak
/** every buffer source started in [t0, t1) summed at its start (mono, `sr`), through its path at its start time */
export function dryMix(ctx: MockContext, t0: number, t1: number, lis: { x: number; y: number; z: number }, sr = 48000): Float32Array {
  const out = new Float32Array(Math.ceil((t1 - t0) * sr));
  for (const s of ctx.starts) { if (s.kind !== 'source' || !s.buffer) continue; const st = s.startedAt!, stop = Math.min(s.stopAt, t1); if (stop <= t0 || st >= t1) continue;
    const path = bestPath(s, Math.max(st, t0), lis); if (!path || path.gain < 1e-6) continue;
    const y = throughPath(s, path), rate = s.buffer.sampleRate * s.params.playbackRate.value, len = y.length;
    for (let i = Math.max(0, Math.floor((st - t0) * sr)); i < out.length; i++) { const tt = t0 + i / sr; if (tt >= stop) break;
      let u = (tt - st) * rate; if (u < 0) continue; if (s.loop) u %= len; if (u >= len - 1) break; const j = Math.floor(u); out[i] += y[j] + (y[j + 1] - y[j]) * (u - j); } }
  return out;
}
/** the master bus modelled: a feed-forward compressor (peak detector, hard knee, attack/release, NO look-ahead: harsher than
 *  the browser's), its make-up gain, the trim, then the ceiling curve (linear interpolation, as a WaveShaper) */
export function masterBus(x: Float32Array, sr: number, curve: Float32Array, o: { threshold: number; ratio: number; attack: number; release: number } = LIMITER, lookahead = 0.006): Float32Array { // (the ceiling at the engine's oversampling)
  // the detector runs `lookahead` s ahead of the signal it turns down (Chromium's compressor kernel delays its signal 6 ms;
  // Firefox uses the same kernel): 0 = none (harsher)
  const y = new Float32Array(x.length), aA = Math.exp(-1 / (o.attack * sr)), aR = Math.exp(-1 / (o.release * sr)), mk = limiterMakeup(o.threshold, o.ratio), trim = 1 / mk, la = Math.round(lookahead * sr); let env = 0;
  const gain = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[Math.min(x.length - 1, i + la)]); env = a > env ? aA * env + (1 - aA) * a : aR * env + (1 - aR) * a;
    const e = dB(env); gain[i] = 10 ** ((e > o.threshold ? (o.threshold + (e - o.threshold) / o.ratio) - e : 0) / 20); }
  for (let i = 0; i < x.length; i++) y[i] = x[i] * gain[i] * mk * trim;
  return shape(y, curve, LIMITER.oversample === '4x' ? 4 : 1);
}
/** true peak (dBTP): 4× oversampling by a 48-tap windowed-sinc interpolator per phase (after ITU-R BS.1770-4 annex 2) */
export function truePeak(x: Float32Array): number {
  const P = 4, T = 12, h: number[][] = [];
  for (let p = 0; p < P; p++) { const row: number[] = []; for (let k = -T; k < T; k++) { const t = k + (p / P); const s = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t); const w = 0.5 + 0.5 * Math.cos(Math.PI * t / T); row.push(s * w); } h.push(row); }
  let m = 0;
  for (let i = 0; i < x.length; i++) { m = Math.max(m, Math.abs(x[i])); for (let p = 1; p < P; p++) { let v = 0; const row = h[p]; for (let k = -T; k < T; k++) { const j = i + k; if (j >= 0 && j < x.length) v += x[j] * row[k + T]; } m = Math.max(m, Math.abs(v)); } }
  return dB(m);
}
/** the largest normalised cross-correlation of a segment of `win` s (default 0.3) of `a` found in `b` at any lag within
 *  ±maxLag s, both resampled to 4 kHz by averaging (F0 and F1 kept). A segment counts only where both sides are sound for
 *  most of it: at least `cover` (70 %) of its 10 ms frames above 10 % of the signal's loudest frame (RMS). A 0.1 s vowel in
 *  0.3 s of near-silence is not a 0.3 s repeat, and silence does not repeat. `cover` 0 checks every window */
export function maxSegmentXcorr(a: Float32Array, srA: number, b: Float32Array, srB: number, win = 0.3, maxLag = 0.3, cover = 0.7): number {
  const R = 4000, ds = (x: Float32Array, sr: number) => { const k = sr / R, n = Math.floor(x.length / k), y = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = Math.floor(i * k); j < Math.floor((i + 1) * k); j++) { s += x[j]; c++; } y[i] = s / Math.max(1, c); } return y; };
  const A = ds(a, srA), B = ds(b, srB), W = Math.floor(win * R), L = Math.floor(maxLag * R), F = 40; let best = 0;
  // per-sample activity prefix sums (a sample is active when its 10 ms frame is above 10 % of the loudest frame's RMS)
  const act = (X: Float32Array) => { const nf = Math.ceil(X.length / F), fr = new Float64Array(nf); let mx = 0;
    for (let f = 0; f < nf; f++) { let e = 0, c = 0; for (let i = f * F; i < Math.min(X.length, (f + 1) * F); i++) { e += X[i] * X[i]; c++; } fr[f] = Math.sqrt(e / Math.max(1, c)); mx = Math.max(mx, fr[f]); }
    const P = new Float64Array(X.length + 1); for (let i = 0; i < X.length; i++) P[i + 1] = P[i] + (fr[Math.floor(i / F)] > 0.1 * mx ? 1 : 0); return P; };
  const PA = act(A), PB = act(B), ok = (P: Float64Array, s: number) => cover <= 0 || (P[s + W] - P[s]) >= cover * W;
  for (let s = 0; s + W <= A.length; s += Math.floor(W / 4)) {
    if (!ok(PA, s)) continue; let ea = 0; for (let i = 0; i < W; i++) ea += A[s + i] * A[s + i]; if (ea < 1e-9) continue;
    for (let lag = -L; lag <= L; lag++) { const o = s + lag; if (o < 0 || o + W > B.length || !ok(PB, o)) continue; let ab = 0, eb = 0; for (let i = 0; i < W; i++) { const v = B[o + i]; ab += A[s + i] * v; eb += v * v; } if (eb < 1e-9) continue; const r = ab / Math.sqrt(ea * eb); if (r > best) best = r; }
  }
  return best;
}
/** the mean F0 (Hz, geometric) of the voiced 40 ms frames of a signal (YIN's cumulative mean normalised difference, threshold 0.15,
 *  parabolic refinement; 70–400 Hz), or 0 when none is voiced */
export function medianF0(x: Float32Array, sr: number): number {
  const N = Math.floor(0.04 * sr), lo = Math.floor(sr / 400), hi = Math.floor(sr / 70), f0s: number[] = [], d = new Float64Array(hi + 2);
  for (let s = 0; s + N + hi + 1 < x.length; s += N >> 3) { let e = 0; for (let i = 0; i < N; i++) e += x[s + i] * x[s + i]; if (e < 1e-5) continue;
    let run = 0; d[0] = 1;
    for (let l = 1; l <= hi + 1; l++) { let v = 0; for (let i = 0; i < N; i++) { const q = x[s + i] - x[s + i + l]; v += q * q; } run += v; d[l] = run > 0 ? v * l / run : 1; }
    let bl = -1; for (let l = lo; l <= hi; l++) if (d[l] < 0.15) { while (l + 1 <= hi && d[l + 1] < d[l]) l++; bl = l; break; }
    if (bl < 0) continue;
    const y0 = d[bl - 1], y1 = d[bl], y2 = d[bl + 1], den = y0 - 2 * y1 + y2, off = den !== 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / den)) : 0;
    f0s.push(sr / (bl + off)); }
  // the geometric mean over the voiced frames (5 ms apart): invariant to a uniform change of speed, unlike the median
  return f0s.length ? Math.exp(f0s.reduce((a, v) => a + Math.log(v), 0) / f0s.length) : 0;
}
/** `x` played at `rate` (linear interpolation): pitch and tempo scaled together, as a pitch-shifted sample is */
export function playAt(x: Float32Array, rate: number): Float32Array { // (Catmull-Rom cubic interpolation)
  const n = Math.floor((x.length - 2) / rate), y = new Float32Array(n), at = (k: number) => x[Math.max(0, Math.min(x.length - 1, k))];
  for (let i = 0; i < n; i++) { const u = i * rate, j = Math.floor(u), f = u - j, p0 = at(j - 1), p1 = at(j), p2 = at(j + 1), p3 = at(j + 2);
    y[i] = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0))); }
  return y; }
/** MASTER_PLAN T-G2 anti-proxy "cross-correlation after pitch normalisation": the larger of the plain segment correlation
 *  and the correlation after `b` is played at the rate that brings its median F0 to `a`'s (a pitch-shifted copy is found) */
export function segmentXcorrPN(a: Float32Array, srA: number, b: Float32Array, srB: number): { r: number; plain: number; normalised: number; singleWindow: number } {
  const plain = maxSegmentXcorr(a, srA, b, srB), fa = medianF0(a, srA), fb = medianF0(b, srB), q = fa > 0 && fb > 0 ? fa / fb : 1, bn = Math.abs(q - 1) > 0.002 ? playAt(b, q) : null;
  let normalised = bn ? maxSegmentXcorr(a, srA, bn, srB) : plain;
  // the F0 estimate is good to ~1-2 %, and a 1 % error decorrelates 0.3 s of voice: the rate is searched ±2.4 % around it in
  // 0.6 % steps, then ±0.6 % in 0.15 % steps around the best when a likeness shows (> 0.4)
  if (fa > 0 && fb > 0) { let bestR = q, bestV = normalised;
    for (let k = -4; k <= 4; k++) if (k) { const r = q * (1 + 0.006 * k), v = maxSegmentXcorr(a, srA, playAt(b, r), srB); if (v > bestV) { bestV = v; bestR = r; } }
    if (bestV > 0.4) for (let k = -4; k <= 4; k++) if (k) bestV = Math.max(bestV, maxSegmentXcorr(a, srA, playAt(b, bestR * (1 + 0.0015 * k)), srB));
    normalised = Math.max(normalised, bestV); }
  const singleWindow = Math.max(maxSegmentXcorr(a, srA, b, srB, 0.3, 0.3, 0), bn ? maxSegmentXcorr(a, srA, bn, srB, 0.3, 0.3, 0) : 0);
  return { r: Math.max(plain, normalised), plain, normalised, singleWindow };
}

// ------------------------------------------------------------------------------------------------ the limiter study (T-G1)
/** a windowed-sinc low-pass FIR (cutoff as a fraction of the sample rate; Blackman window, unity DC gain) */
function sincLP(cut: number, taps: number): Float32Array { const h = new Float32Array(taps), M = (taps - 1) / 2; let s = 0;
  for (let i = 0; i < taps; i++) { const t = i - M, x = t === 0 ? 2 * cut : Math.sin(2 * Math.PI * cut * t) / (Math.PI * t), w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (taps - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (taps - 1)); h[i] = x * w; s += h[i]; }
  for (let i = 0; i < taps; i++) h[i] /= s; return h; }
function fir(x: Float32Array, h: Float32Array): Float32Array { const y = new Float32Array(x.length), M = (h.length - 1) >> 1;
  for (let i = 0; i < x.length; i++) { let v = 0; for (let k = 0; k < h.length; k++) { const j = i + M - k; if (j >= 0 && j < x.length) v += x[j] * h[k]; } y[i] = v; } return y; }
/** the ceiling curve applied as a WaveShaper does (linear interpolation over −1…1); `os` 4: at 4× the rate, band-limited up
 *  and down (an emulation of oversample '4x', not the browser's own resampler) */
export function shape(x: Float32Array, curve: Float32Array, os: 1 | 4 = 1): Float32Array {
  const f = (v: number) => { const u = (Math.max(-1, Math.min(1, v)) + 1) / 2 * (curve.length - 1), j = Math.min(curve.length - 2, Math.floor(u)); return curve[j] + (curve[j + 1] - curve[j]) * (u - j); };
  if (os === 1) return x.map(f);
  const up = new Float32Array(x.length * 4); for (let i = 0; i < x.length; i++) up[i * 4] = x[i] * 4;
  const h = sincLP(0.125, 64), u = fir(up, h).map(f), d = fir(u, h), y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = d[i * 4]; return y;
}
