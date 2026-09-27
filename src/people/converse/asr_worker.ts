// D-296: speech recognition (Whisper, transformers.js on WebGPU) in its own worker. Messages: {type:'load', model, dtype} ->
// {type:'loaded', ms}; {type:'run', audio: Float32Array (16 kHz mono)} -> {type:'text', text, ms}; errors -> {type:'error'}
import { pipeline, env } from '@huggingface/transformers';
import { localModels, isLocal } from './models';
localModels(self.location.origin);
env.allowLocalModels = false; if (isLocal(self.location.origin)) env.useBrowserCache = false; // the files are on the local disk already (see llm_worker.ts)
let asr: any = null;
const post = (m: any) => (self as any).postMessage(m);
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      const t0 = performance.now();
      asr = await pipeline('automatic-speech-recognition', m.model, { device: m.device ?? 'webgpu', dtype: m.dtype });
      await asr(new Float32Array(16000), { language: 'english', task: 'transcribe' }); // warm: the first run compiles the shaders
      post({ type: 'loaded', ms: performance.now() - t0 });
    } else if (m.type === 'run') {
      const t0 = performance.now();
      const out = await asr(m.audio, { language: 'english', task: 'transcribe' });
      post({ type: 'text', text: String(out.text ?? '').trim(), ms: performance.now() - t0 });
    }
  } catch (err) { post({ type: 'error', error: String((err as any)?.stack ?? err) }); }
};
