// D-296 (UD-18): the in-browser model stacks measured for speaking with the people (tools/dev/fetch_models.mjs downloads
// them; the licences are in ASSET_LEDGER.md and the models' manifest). Out of world: nothing here is shown in the world.
export interface LlmSpec { id: string; lib: string; params: string; licence: string; vramMB: number }
const WASM = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/';
export const LLMS: LlmSpec[] = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', lib: 'Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '1.5B', licence: 'Apache-2.0', vramMB: 1630 },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', lib: 'Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '1.2B', licence: 'Llama 3.2 Community License', vramMB: 879 },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', lib: 'Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '3.2B', licence: 'Llama 3.2 Community License', vramMB: 2264 },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', lib: 'Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '3.1B', licence: 'Qwen Research License (non-commercial)', vramMB: 2505 },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', lib: 'gemma-2-2b-it-q4f16_1_cs1k-webgpu.wasm', params: '2.6B', licence: 'Gemma Terms of Use', vramMB: 1895 },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', lib: 'Phi-3.5-mini-instruct-q4f16_1_cs1k-webgpu.wasm', params: '3.8B', licence: 'MIT', vramMB: 3672 },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm', params: '2B', licence: 'Apache-2.0', vramMB: 2245 },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', lib: 'Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '7.6B', licence: 'Apache-2.0', vramMB: 5107 },
];
export const ASRS = ['onnx-community/whisper-base', 'onnx-community/whisper-small'] as const;
export const TTS = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** the WebLLM app config for the given models (their Hugging Face and GitHub URLs: served locally by localModels()) */
export function appConfig(ids: string[], origin: string) {
  const local = isLocal(origin);
  return { cacheBackend: 'cache' as const, model_list: LLMS.filter(m => ids.includes(m.id)).map(m => ({ model: local ? `${origin}/models/mlc-ai/${m.id}` : `https://huggingface.co/mlc-ai/${m.id}`, model_id: m.id, model_lib: local ? `${origin}/models/mlc-libs/${m.lib}` : WASM + m.lib, vram_required_MB: m.vramMB, low_resource_required: true, overrides: { context_window_size: 4096 } })) };
}

/** in a dev tree (localhost), the model files come from the dev server's /models/ (a junction to the asset store outside git,
 *  laid out as Hugging Face's own paths); on a public URL they come from Hugging Face and GitHub, cached by the browser */
export const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
export function localModels(origin: string) {
  if (!isLocal(origin)) return;
  const g = globalThis as any; if (g.__modelsLocal) return; g.__modelsLocal = true; const real = g.fetch.bind(g);
  const map = (u: string) => u.startsWith('https://huggingface.co/') ? `${origin}/models/${u.slice(23)}` : u.startsWith(WASM) ? `${origin}/models/mlc-libs/${u.slice(WASM.length)}` : null;
  g.fetch = (input: any, init?: any) => { const u = typeof input === 'string' ? input : input?.url; const m = u ? map(u) : null;
    return m ? real(m, init) : real(input, init); };
}
