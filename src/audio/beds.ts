// Beds without loops (D-245; MASTER_PLAN T-G2b "shortest non-generative bed loop" ≥ 30 s, T-G2 no repeat within 60 s).
// Audit D: wind, rain, the column whistle and the flies were 4–6 s noise loops, and every fire's crackle a 3 s loop; frozen
// noise at those periods can be learnt by the ear. A NoiseStream never loops: it plays a chain of segments, each a fresh
// noise buffer with its own generator seed (AudioEngine.noiseBuffer, noiseSeed), overlapped by an equal-power crossfade.
// Nothing repeats, so the "loop" is infinite; the cost is one short buffer per segment (generated at a low sample rate for
// the low-band beds) and a segment scheduled a little ahead from the frame loop (tick). If the frame loop stalls (a hidden
// tab) for longer than the look-ahead, the stream falls silent and fades back in on the next tick: a gap, never a loop.
import type { AudioEngine } from './engine';

const FADE_N = 64;
const FADE_IN = new Float32Array(FADE_N), FADE_OUT = new Float32Array(FADE_N);
for (let i = 0; i < FADE_N; i++) { const a = (i / (FADE_N - 1)) * Math.PI / 2; FADE_IN[i] = Math.sin(a); FADE_OUT[i] = Math.cos(a); }
/** how far ahead of the context's clock the next segment is scheduled (s) */
export const STREAM_LOOKAHEAD = 1.5;

export interface NoiseStreamOptions {
  /** segment length (s) and crossfade (s); a segment must outlast two crossfades and the look-ahead */
  seg?: number; fade?: number;
  /** the buffers' sample rate (Hz): a low rate for low-band beds (the context resamples); default the context's */
  sampleRate?: number;
}

export class NoiseStream {
  /** the stream's output: connect it to the bed's filters */
  readonly out: GainNode;
  readonly seg: number; readonly fade: number; readonly sampleRate: number | undefined;
  /** segments scheduled so far (tests, overlay) */
  segments = 0;
  private next = -1;
  constructor(readonly e: AudioEngine, readonly colour: 'white' | 'pink' | 'brown', o: NoiseStreamOptions = {}) {
    this.seg = o.seg ?? 6; this.fade = o.fade ?? 0.6; this.sampleRate = o.sampleRate;
    if (this.seg < 2 * this.fade + STREAM_LOOKAHEAD) throw new Error('NoiseStream: segment shorter than two crossfades and the look-ahead');
    this.out = e.ctx!.createGain();
  }
  /** keep the chain ahead of the clock (call once a frame while the bed is wanted; stop calling and it ends by itself) */
  tick() {
    const c = this.e.ctx; if (!c) return; const now = c.currentTime;
    if (this.next < now) this.next = now + 0.02; // first call, or the loop stalled past the chain's end: fade in afresh
    while (this.next < now + STREAM_LOOKAHEAD) this.schedule(this.next);
  }
  private schedule(t: number) {
    const c = this.e.ctx!, L = this.seg, F = this.fade, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.e.noiseBuffer(L, this.colour, this.sampleRate);
    g.gain.value = 0; g.gain.setValueCurveAtTime(FADE_IN, t, F); g.gain.setValueCurveAtTime(FADE_OUT, t + L - F, F);
    s.connect(g); g.connect(this.out); s.start(t); s.stop(t + L);
    s.onended = () => { try { s.disconnect(); g.disconnect(); } catch { /* gone */ } };
    this.next = t + L - F; this.segments++;
  }
}
