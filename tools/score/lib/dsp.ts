// The score's mixing desk, offline (node): FFT convolution (the hall), biquads (RBJ), a glue compressor, a look-ahead
// limiter and BS.1770 loudness. Float32 stereo throughout; everything here is deterministic.

// ------------------------------------------------------------------------------------------------------------------ FFT
/** in-place radix-2 complex FFT (re, im of length 2^k); inverse when inv */
export function fft(re: Float64Array, im: Float64Array, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inv ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) { const a = i + k, b = a + h, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/** x convolved with h (overlap-add, block = the IR's padded size); output length x + h - 1 */
export function convolve(x: Float32Array, h: Float32Array): Float32Array {
  let N = 1; while (N < h.length * 2) N <<= 1; const B = N - h.length + 1;
  const Hr = new Float64Array(N), Hi = new Float64Array(N); Hr.set(h); fft(Hr, Hi);
  const out = new Float32Array(x.length + h.length - 1), re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s < x.length; s += B) {
    re.fill(0); im.fill(0); const e = Math.min(x.length, s + B); for (let i = s; i < e; i++) re[i - s] = x[i];
    let silent = true; for (let i = 0; i < e - s; i++) if (re[i] !== 0) { silent = false; break; } if (silent) continue;
    fft(re, im);
    for (let k = 0; k < N; k++) { const a = re[k] * Hr[k] - im[k] * Hi[k], b = re[k] * Hi[k] + im[k] * Hr[k]; re[k] = a; im[k] = b; }
    fft(re, im, true);
    const lim = Math.min(N, out.length - s); for (let i = 0; i < lim; i++) out[s + i] += re[i];
  }
  return out;
}

// -------------------------------------------------------------------------------------------------------------- biquads
export type BqType = 'lp' | 'hp' | 'bp' | 'peak' | 'lowshelf' | 'highshelf';
export function biquad(x: Float32Array, sr: number, type: BqType, f: number, q = 0.707, gainDb = 0): Float32Array {
  const A = 10 ** (gainDb / 40), w = (2 * Math.PI * f) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else { const s = 2 * Math.sqrt(A) * al, up = type === 'lowshelf' ? 1 : -1;
    b0 = A * ((A + 1) - up * (A - 1) * cw + s); b1 = up * 2 * A * ((A - 1) - up * (A + 1) * cw); b2 = A * ((A + 1) - up * (A - 1) * cw - s);
    a0 = (A + 1) + up * (A - 1) * cw + s; a1 = -up * 2 * ((A - 1) + up * (A + 1) * cw); a2 = (A + 1) + up * (A - 1) * cw - s; }
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}

// ---------------------------------------------------------------------------------------------------------- dynamics
/** stereo glue compressor (RMS detector, soft knee), linked; returns new channels */
export function compress(ch: Float32Array[], sr: number, o: { thr: number; ratio: number; att: number; rel: number; knee?: number; makeup?: number }): Float32Array[] {
  const n = ch[0].length, out = ch.map(() => new Float32Array(n)), ka = Math.exp(-1 / (o.att * sr)), kr = Math.exp(-1 / (o.rel * sr)), knee = o.knee ?? 6;
  let env = 0, gdb = 0; const rms = Math.exp(-1 / (0.01 * sr));
  for (let i = 0; i < n; i++) {
    let p = 0; for (const c of ch) p = Math.max(p, c[i] * c[i]); env = rms * env + (1 - rms) * p;
    const lv = 10 * Math.log10(env + 1e-12), over = lv - o.thr;
    const want = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * (1 - 1 / o.ratio) : ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / o.ratio);
    gdb = want > gdb ? ka * gdb + (1 - ka) * want : kr * gdb + (1 - kr) * want;
    const g = 10 ** ((-gdb + (o.makeup ?? 0)) / 20); for (let c = 0; c < ch.length; c++) out[c][i] = ch[c][i] * g;
  }
  return out;
}

/** look-ahead brickwall limiter to `ceilDb` (sample peak; the ceiling sits 0.5 dB under the true-peak target) */
export function limit(ch: Float32Array[], sr: number, ceilDb = -1.5, lookMs = 5, relMs = 120): Float32Array[] {
  const n = ch[0].length, L = Math.max(1, Math.round((lookMs / 1000) * sr)), ceil = 10 ** (ceilDb / 20), kr = Math.exp(-1 / ((relMs / 1000) * sr));
  const need = new Float32Array(n); for (let i = 0; i < n; i++) { let p = 0; for (const c of ch) p = Math.max(p, Math.abs(c[i])); need[i] = p > ceil ? ceil / p : 1; }
  // the gain at i is the minimum of what the next L samples need, ramped in over the look-ahead and released slowly
  const minAhead = new Float32Array(n); { const dq: number[] = []; for (let i = n - 1; i >= 0; i--) { while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop(); dq.push(i); while (dq[0] > i + L) dq.shift(); minAhead[i] = need[dq[0]]; } }
  // a box filter of length L over the windowed minimum: the gain glides down over the look-ahead and reaches the need exactly
  // at the peak; then a one-pole release (never above what the box gives)
  const box = new Float32Array(n); { let acc = 0; for (let i = 0; i < n; i++) { acc += minAhead[i] - (i >= L ? minAhead[i - L] : 0); box[i] = acc / Math.min(i + 1, L); } }
  const out = ch.map(() => new Float32Array(n)); let g = 1;
  for (let i = 0; i < n; i++) { const t = Math.min(box[i], need[i]); g = t < g ? t : kr * g + (1 - kr) * t;
    for (let c = 0; c < ch.length; c++) out[c][i] = ch[c][i] * g; }
  return out;
}

// ------------------------------------------------------------------------------------------------------------ loudness
/** BS.1770-4 integrated loudness (LUFS) of a stereo signal at 48 kHz (K-weighting coefficients of the standard) */
export function lufs(ch: Float32Array[], sr = 48000): number {
  if (sr !== 48000) throw new Error('lufs: 48 kHz only');
  const k = (x: Float32Array) => { // stage 1 shelf, stage 2 high-pass (the standard's 48 kHz coefficients)
    const s1 = iir(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
    return iir(s1, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]); };
  const w = ch.map(k), blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z: number[] = [];
  for (let s = 0; s + blk <= w[0].length; s += hop) { let e = 0; for (const c of w) { let a = 0; for (let i = s; i < s + blk; i++) a += c[i] * c[i]; e += a / blk; } z.push(e); }
  const L = (e: number) => -0.691 + 10 * Math.log10(e + 1e-15);
  const abs = z.filter(e => L(e) > -70); if (!abs.length) return -70;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, g = abs.filter(e => L(e) > rel);
  return L(g.reduce((a, b) => a + b, 0) / g.length);
}
function iir(x: Float32Array, b: number[], a: number[]) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }

/** true peak (dBTP) by 4x oversampling (windowed-sinc interpolation) */
export function truePeak(ch: Float32Array[]): number {
  const taps = 12, os = 4; let pk = 0; const kern: number[][] = [];
  for (let f = 1; f < os; f++) { const k: number[] = []; for (let j = -taps; j <= taps; j++) { const t = j - f / os, s = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t), w = 0.5 + 0.5 * Math.cos((Math.PI * t) / (taps + 1)); k.push(s * w); } kern.push(k); }
  for (const c of ch) for (let i = 0; i < c.length; i++) { pk = Math.max(pk, Math.abs(c[i]));
    if (Math.abs(c[i]) < 0.5) continue; // inter-sample overs only matter near the top
    for (const k of kern) { let v = 0; for (let j = -taps; j <= taps; j++) { const q = i + j; if (q >= 0 && q < c.length) v += c[q] * k[j + taps]; } pk = Math.max(pk, Math.abs(v)); } }
  return 20 * Math.log10(pk + 1e-12);
}

// --------------------------------------------------------------------------------------------------------------- utils
export const db = (x: number) => 10 ** (x / 20);
/** a seeded generator (mulberry32) for every random choice in the score: the same inputs give the same music */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
