// D-336: running Kokoro-82M (transformers.js: onnxruntime-web on WebGPU or WASM in the browser, onnxruntime-node in node).
// One synthesis is one short dispatch (a unit or a sentence: well under the Windows watchdog's 2 s on the T4).
import { KOKORO_REPO, KOKORO_RATE, STYLE_DIM, STYLE_ROWS, BASE_VOICES, blendStyle, tokenize, retract, tidyClip } from './kokoro';
import type { NeuralVoice } from './identity';
import { Rng } from '../../core/rng';

export interface RunnerOpts { device?: 'webgpu' | 'wasm' | 'cpu'; dtype?: 'fp32' | 'fp16' | 'q8' | 'q8f16'; /** node: the model store laid out as <repo>/resolve/main/<file> */ root?: string; /** the style voice files */ voiceData: (name: string) => Promise<ArrayBuffer> }
export class KokoroRunner {
  private tables = new Map<string, Float32Array>();
  private constructor(private model: any, private T: any) {}
  static async load(o: RunnerOpts): Promise<KokoroRunner> {
    const tf: any = await import('@huggingface/transformers');
    let id = KOKORO_REPO;
    if (o.root) { tf.env.allowRemoteModels = false; tf.env.allowLocalModels = true; id = `${o.root.replace(/\\/g, '/')}/${KOKORO_REPO}/resolve/main`; } // (a path, not a repo id: read as it is)
    const model = await tf.StyleTextToSpeech2Model.from_pretrained(id, { dtype: o.dtype ?? 'fp32', device: o.device ?? (o.root ? 'cpu' : 'webgpu') });
    const r = new KokoroRunner(model, tf.Tensor);
    await Promise.all(BASE_VOICES.map(async ([n]) => { const b = await o.voiceData(n); const f = new Float32Array(b); if (f.length < STYLE_ROWS * STYLE_DIM) throw new Error(`voice ${n}: ${f.length} floats`); r.tables.set(n, f); }));
    return r;
  }
  table = (n: string) => { const t = this.tables.get(n); if (!t) throw new Error(`no voice ${n}`); return t; };
  private sd: Float32Array | null = null;
  /** per style dimension, the spread (standard deviation) of the 54 voices (at a middle row: 40 tokens) */
  spread(): Float32Array {
    if (this.sd) return this.sd; const row = 40 * STYLE_DIM, n = this.tables.size, m = new Float32Array(STYLE_DIM), s = new Float32Array(STYLE_DIM);
    for (const t of this.tables.values()) for (let i = 0; i < STYLE_DIM; i++) m[i] += t[row + i] / n;
    for (const t of this.tables.values()) for (let i = 0; i < STYLE_DIM; i++) s[i] += (t[row + i] - m[i]) ** 2 / n;
    for (let i = 0; i < STYLE_DIM; i++) s[i] = Math.sqrt(s[i]); return (this.sd = s);
  }
  /** raw synthesis: phonemes (the model's symbols), a style and a speed */
  async raw(phonemes: string, style: Float32Array, speed: number): Promise<Float32Array> {
    const ids = tokenize(phonemes); const T = this.T;
    const { waveform } = await this.model({ input_ids: new T('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]), style: new T('float32', style, [1, STYLE_DIM]), speed: new T('float32', [speed], [1]) });
    return waveform.data as Float32Array;
  }
  /** a person's utterance: their blended style, their pace, their vocal tract; trimmed and levelled (24 kHz) */
  async speak(phonemes: string, v: NeuralVoice, o: { speed?: number } = {}): Promise<Float32Array> {
    const ids = tokenize(phonemes), style = blendStyle(this.table, v.mix, ids.length);
    for (let i = 0; i < STYLE_DIM; i++) style[i] += v.offset?.[i] ?? 0;
    // the person's own step off the blend (identity.ts `jitter`): a seeded direction in the timbre half of the style, each
    // dimension scaled by how much the 54 voices differ there (so the step stays inside the model's own range)
    if (v.jitter) { const sd = this.spread(), d = styleDirection(v.jitterSeed ?? 1); for (let i = 0; i < STYLE_DIM / 2; i++) style[i] += v.jitter * sd[i] * d[i]; }
    const pcm = await this.raw(phonemes, style, (o.speed ?? 1) * v.speed / v.tract);
    return tidyClip(retract(pcm, v.tract), KOKORO_RATE, v.level);
  }
}
/** a seeded unit-normal direction in style space (the person's own step off their blend) */
export function styleDirection(seed: number): Float32Array {
  const r = new Rng(seed >>> 0, 'voice.jitter'), d = new Float32Array(STYLE_DIM); for (let i = 0; i < STYLE_DIM; i++) d[i] = r.normal(); return d;
}
