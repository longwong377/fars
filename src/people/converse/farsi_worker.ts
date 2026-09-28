// D-336: English to Persian (NLLB-200 distilled 600M, q8, transformers.js) in a worker, for the Farsi opt-in layer.
// Messages: {type:'load', device} -> {type:'loaded', ms}; {type:'fa', id, text} -> {type:'fa', id, fa, ms}; errors {type:'error'}
import { pipeline, env } from '@huggingface/transformers';
import { localModels, isLocal } from './models';
localModels(self.location.origin);
env.allowLocalModels = false; if (isLocal(self.location.origin)) env.useBrowserCache = false;
export const NLLB = 'Xenova/nllb-200-distilled-600M';
let tr: any = null;
const post = (m: any) => (self as any).postMessage(m);
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === 'load') { const t0 = performance.now(); tr = await pipeline('translation', NLLB, { dtype: 'q8', device: m.device ?? 'wasm' }); post({ type: 'loaded', ms: performance.now() - t0 }); }
    else if (m.type === 'fa') { const t0 = performance.now(); const out = await tr(m.text, { src_lang: 'eng_Latn', tgt_lang: 'pes_Arab', max_new_tokens: 120, num_beams: 2 });
      post({ type: 'fa', id: m.id, fa: String(out[0]?.translation_text ?? '').trim(), ms: performance.now() - t0 }); }
  } catch (err) { post({ type: 'error', id: m.id, error: String((err as any)?.message ?? err) }); }
};
