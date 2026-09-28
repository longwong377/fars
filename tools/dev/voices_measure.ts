// D-336 (T-E11): the measuring instruments for the people's voices, node only (onnxruntime-node): the speaker embedding
// (WavLM-Base-Plus-SV, microsoft; its same-speaker threshold 0.86 cosine, from its model card), a second one (WeSpeaker
// ECAPA-TDNN-512, VoxCeleb; 80-band fbank, cosine), the naturalness predictor (UTMOS22 strong: a MOS on 1-5 trained on
// listeners' ratings of synthetic speech), and the Kokoro runner over the model store. The models live outside git
// (tools/dev/fetch_models.mjs voices; VOICE_MODELS or T:/fars-assets-s12/voices/models).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KokoroRunner } from '../../src/audio/neural/runner';
import { KOKORO_REPO } from '../../src/audio/neural/kokoro';

export const MODELS = process.env.VOICE_MODELS ?? 'T:/fars-assets-s12/voices/models';
export const haveModels = () => existsSync(join(MODELS, KOKORO_REPO, 'resolve/main/onnx/model.onnx')) && existsSync(join(MODELS, 'Xenova/wavlm-base-plus-sv/resolve/main/onnx/model.onnx'));
const file = (repo: string, f: string) => join(MODELS, repo, 'resolve/main', f);

export async function kokoro(dtype: 'fp32' | 'q8' = 'fp32') {
  return KokoroRunner.load({ root: MODELS, device: (process.env.VOICE_DEVICE as any) ?? 'cpu', dtype, voiceData: async n => { const b = readFileSync(file(KOKORO_REPO, `voices/${n}.bin`)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
}
let ort: any = null;
const session = async (p: string) => { ort ??= await import('onnxruntime-node'); return ort.InferenceSession.create(p, { intraOpNumThreads: +(process.env.ORT_THREADS ?? 4), executionProviders: process.env.VOICE_DEVICE === 'dml' ? ['dml', 'cpu'] : ['cpu'] }); };

/** 24 kHz (or any rate) to 16 kHz, windowed sinc */
export function to16k(x: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return x; const r = rate / 16000, n = Math.floor(x.length / r), y = new Float32Array(n), taps = 24, fc = Math.min(1, 1 / r) * 0.95;
  for (let i = 0; i < n; i++) { const t = i * r, c = Math.floor(t); let a = 0, ws = 0; for (let k = c - taps + 1; k <= c + taps; k++) { if (k < 0 || k >= x.length) continue; const d = t - k; const s = d === 0 ? 1 : Math.sin(Math.PI * fc * d) / (Math.PI * fc * d); const w = s * (0.5 + 0.5 * Math.cos(Math.PI * d / taps)); a += w * x[k]; ws += w; } y[i] = ws ? a / ws : 0; }
  return y;
}

export class Instruments {
  private constructor(private sWavlm: any, private sEcapa: any, private sUtmos: any) {}
  static async load(o: { ecapa?: boolean; utmos?: boolean } = {}) {
    return new Instruments(await session(file('Xenova/wavlm-base-plus-sv', 'onnx/model.onnx')),
      o.ecapa === false ? null : await session(file('Wespeaker/wespeaker-ecapa-tdnn512-LM', 'voxceleb_ECAPA512_LM.onnx')),
      o.utmos === false ? null : await session(file('TigreGotico/utmos-onnx', 'utmos22_strong.onnx')));
  }
  /** WavLM-SV x-vector (512), L2-normalised */
  async wavlm(x16: Float32Array): Promise<Float32Array> {
    const s = this.sWavlm, feeds: any = { input_values: new ort.Tensor('float32', x16, [1, x16.length]) };
    if (s.inputNames.includes('attention_mask')) feeds.attention_mask = new ort.Tensor('int64', new BigInt64Array(x16.length).fill(1n), [1, x16.length]);
    const out = await s.run(feeds); const e = (out.embeddings ?? out[s.outputNames.at(-1)]).data as Float32Array; return norm(Float32Array.from(e));
  }
  /** WeSpeaker ECAPA embedding (192), L2-normalised: 80 log-mel fbank (25 ms / 10 ms, Kaldi-like), mean-normalised */
  async ecapa(x16: Float32Array): Promise<Float32Array | null> {
    if (!this.sEcapa) return null; const F = fbank(x16), T = F.length / 80;
    const s = this.sEcapa, out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', F, [1, T, 80]) }); return norm(Float32Array.from(out[s.outputNames[0]].data as Float32Array));
  }
  /** UTMOS22 strong (1-5) */
  async mos(x16: Float32Array): Promise<number | null> {
    if (!this.sUtmos) return null; const out = await this.sUtmos.run({ wave: new ort.Tensor('float32', x16, [1, x16.length]) }); return (out.mos.data as Float32Array)[0];
  }
}
export const norm = (v: Float32Array) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; for (let i = 0; i < v.length; i++) v[i] /= s; return v; };
export const cos = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** Kaldi-style 80-band log-mel fbank at 16 kHz (povey window, pre-emphasis 0.97, dither off), cepstral mean removed */
export function fbank(x: Float32Array, nMel = 80): Float32Array {
  const win = 400, hop = 160, nfft = 512, T = Math.max(1, 1 + Math.floor((x.length - win) / hop)), out = new Float32Array(T * nMel);
  const mel = (f: number) => 1127 * Math.log(1 + f / 700), lo = mel(20), hi = mel(8000), bins = nfft / 2 + 1;
  const W: Float32Array[] = []; for (let m = 0; m < nMel; m++) { const a = lo + (hi - lo) * m / (nMel + 1), c = lo + (hi - lo) * (m + 1) / (nMel + 1), b = lo + (hi - lo) * (m + 2) / (nMel + 1); const w = new Float32Array(bins);
    for (let k = 0; k < bins; k++) { const f = mel(k * 16000 / nfft); w[k] = f > a && f < b ? (f <= c ? (f - a) / (c - a) : (b - f) / (b - c)) : 0; } W.push(w); }
  const re = new Float64Array(nfft), im = new Float64Array(nfft), pov = Float64Array.from({ length: win }, (_, i) => Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * i / (win - 1)), 0.85));
  for (let t = 0; t < T; t++) {
    re.fill(0); im.fill(0); let mean = 0; for (let i = 0; i < win; i++) mean += (x[t * hop + i] ?? 0) * 32768; mean /= win;
    for (let i = win - 1; i >= 0; i--) { const s = (x[t * hop + i] ?? 0) * 32768 - mean, p = i ? (x[t * hop + i - 1] ?? 0) * 32768 - mean : s; re[i] = (s - 0.97 * p) * pov[i]; }
    fft(re, im);
    for (let m = 0; m < nMel; m++) { let e = 0; const w = W[m]; for (let k = 0; k < bins; k++) if (w[k]) e += w[k] * (re[k] * re[k] + im[k] * im[k]); out[t * nMel + m] = Math.log(Math.max(e, 1.19e-7)); }
  }
  for (let m = 0; m < nMel; m++) { let s = 0; for (let t = 0; t < T; t++) s += out[t * nMel + m]; s /= T; for (let t = 0; t < T; t++) out[t * nMel + m] -= s; }
  return out;
}
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
}
/** a 16-bit mono WAV */
export function wav(path: string, x: Float32Array, rate: number) {
  const b = Buffer.alloc(44 + x.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i); writeFileSync(path, b);
}
