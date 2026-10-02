// D-296 (UD-18): the in-browser model stacks measured for speaking with the people (tools/dev/fetch_models.mjs downloads
// them; the licences are in ASSET_LEDGER.md and the models' manifest). Out of world: nothing here is shown in the world.
export interface LlmSpec { id: string; lib: string; params: string; licence: string; vramMB: number }
const WASM = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/';
export const LLMS: LlmSpec[] = [
  // D-376 (UD-31): the default: 285 MB of weights (8 shards + a 7 MB tokenizer), ~945 MB of VRAM; the talk bundle's whole
  // download (this, Kokoro's 163 / 92 MB model and its 28 MB of style voices) stays under 600 MB
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', lib: 'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', params: '0.5B', licence: 'Apache-2.0', vramMB: 945 },
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
/** D-376 (UD-31): the talk on by default: the model every visitor gets, and the bundle's download in MB (Hugging Face's files:
 *  the LLM's shards and tokenizer, Kokoro's fp16 model (WebGPU with shader-f16) or its q8 model (WASM), the 54 style voices of
 *  510 x 256 floats; Whisper base q8 (encoder 23 + merged decoder 54) only when the microphone is turned on) */
// s16 (D-394): 1.5B over 0.5B: the ship lab's 12 prompts, 0/12 fence refusals and grounded answers vs 2/12 and mostly broken; 951 MB streams while the player walks (people answer with their own line until it is ready)
export const TALK_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const TALK_MB = { llm: 951, kokoroWebgpu: 163, kokoroWasm: 92, voices: 28, whisperOnMic: 77 } as const;
export const TTS = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** the WebLLM app config for the given models (their Hugging Face and GitHub URLs: served locally by localModels()) */
export function appConfig(ids: string[], origin: string) {
  // (?hfmodels on the dev server: the public paths, for a model the local store does not hold: the lab's comparisons, D-393)
  const local = isLocal(origin) && !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('hfmodels'));
  // (s15/ship D-393: on a public origin the weights are kept in IndexedDB: Hugging Face serves them from its Xet CDN
  // (us.aws.cdn.hf.co), whose responses Chrome's Cache Storage refuses (Cache.add/put: "network error", measured 2026-10-02,
  // while a plain fetch of the same URL succeeds): with the 'cache' backend the talk model never loaded on the site)
  return { cacheBackend: (local ? 'cache' : 'indexeddb') as 'cache' | 'indexeddb', model_list: LLMS.filter(m => ids.includes(m.id)).map(m => ({ model: local ? `${origin}/models/mlc-ai/${m.id}` : `https://huggingface.co/mlc-ai/${m.id}`, model_id: m.id, model_lib: local ? `${origin}/models/mlc-libs/${m.lib}` : WASM + m.lib, vram_required_MB: m.vramMB, low_resource_required: true, overrides: { context_window_size: 4096 } })) };
}

/** in a dev tree (localhost), the model files come from the dev server's /models/ (a junction to the asset store outside git,
 *  laid out as Hugging Face's own paths); on a public URL they come from Hugging Face and GitHub, cached by the browser */
// (s15/ship D-393: the dev server only: a built site served on localhost has no /models/ store and takes the public paths)
export const isLocal = (origin: string) => !!(import.meta as any).env?.DEV && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
export function localModels(origin: string) {
  if (!isLocal(origin)) return;
  const g = globalThis as any; if (g.__modelsLocal) return; g.__modelsLocal = true; const real = g.fetch.bind(g);
  const map = (u: string) => u.startsWith('https://huggingface.co/') ? `${origin}/models/${u.slice(23)}` : u.startsWith(WASM) ? `${origin}/models/mlc-libs/${u.slice(WASM.length)}` : null;
  g.fetch = (input: any, init?: any) => { const u = typeof input === 'string' ? input : input?.url; const m = u ? map(u) : null;
    // (D-376: a model the local store does not hold, the new small default among them, comes from the network)
    return m ? real(m, init).then((r: Response) => r.ok ? r : real(input, init)) : real(input, init); };
}
