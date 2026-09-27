// D-296: the out-of-world English voice (Kokoro-82M, kokoro-js on WebGPU): an option only; the heard world stays period.
// Messages: {type:'load', dtype, device} -> {type:'loaded', ms}; {type:'say', text, voice} -> {type:'audio', data, rate, ms}
import { KokoroTTS } from 'kokoro-js';
import { localModels, TTS } from './models';
localModels(self.location.origin);
let tts: any = null;
const post = (m: any, t?: Transferable[]) => (self as any).postMessage(m, t ?? []);
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      const t0 = performance.now();
      tts = await KokoroTTS.from_pretrained(TTS, { dtype: m.dtype ?? 'fp32', device: m.device ?? 'webgpu' });
      await tts.generate('Yes.', { voice: 'bm_george' });
      post({ type: 'loaded', ms: performance.now() - t0 });
    } else if (m.type === 'say') {
      const t0 = performance.now();
      const a = await tts.generate(m.text, { voice: m.voice ?? 'bm_george' });
      const data = a.audio as Float32Array; post({ type: 'audio', data, rate: a.sampling_rate, ms: performance.now() - t0 }, [data.buffer]);
    }
  } catch (err) { post({ type: 'error', error: String((err as any)?.stack ?? err) }); }
};
