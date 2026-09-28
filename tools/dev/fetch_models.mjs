// D-296 (UD-18): download the in-browser speech, language and voice models into the asset store outside git
// (C:\Users\Administrator\fars-assets\models, or MODELS_DIR), laid out as Hugging Face's own `<repo>/resolve/main/<file>` so
// the browser libraries (WebLLM, transformers.js) load them from the dev server's /models/ path unchanged; every file is
// recorded in manifest.json there (source URL, licence, bytes, sha256). Usage: node tools/dev/fetch_models.mjs [group ...]
// Groups: llm (the measured language models), bake (the offline bake model), asr (Whisper), tts (Kokoro). Re-runs skip
// files already present with the recorded size and sha256.
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = process.env.MODELS_DIR ?? 'C:/Users/Administrator/fars-assets/models';
const MAN = join(ROOT, 'manifest.json');
const WASM = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/';
/** repo, the files wanted (all when omitted), the WebLLM model library (wasm) */
const GROUPS = {
  llm: [
    { repo: 'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC', licence: 'Apache-2.0 (Qwen/Qwen2.5-1.5B-Instruct)', lib: 'Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC', licence: 'Llama 3.2 Community License (meta-llama/Llama-3.2-1B-Instruct)', lib: 'Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC', licence: 'Llama 3.2 Community License (meta-llama/Llama-3.2-3B-Instruct)', lib: 'Llama-3.2-3B-Instruct-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/Qwen2.5-3B-Instruct-q4f16_1-MLC', licence: 'Qwen Research License, non-commercial (Qwen/Qwen2.5-3B-Instruct)', lib: 'Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/gemma-2-2b-it-q4f16_1-MLC', licence: 'Gemma Terms of Use (google/gemma-2-2b-it)', lib: 'gemma-2-2b-it-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC', licence: 'MIT (microsoft/Phi-3.5-mini-instruct)', lib: 'Phi-3.5-mini-instruct-q4f16_1_cs1k-webgpu.wasm' },
    { repo: 'mlc-ai/Qwen3.5-2B-q4f16_1-MLC', licence: 'Apache-2.0 (Qwen/Qwen3.5-2B)', lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm' },
  ],
  bake: [{ repo: 'mlc-ai/Qwen2.5-7B-Instruct-q4f16_1-MLC', licence: 'Apache-2.0 (Qwen/Qwen2.5-7B-Instruct)', lib: 'Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm' }],
  asr: [
    { repo: 'onnx-community/whisper-base', licence: 'MIT (openai/whisper-base; ONNX export by onnx-community)', only: /^(config\.json|generation_config\.json|preprocessor_config\.json|tokenizer\.json|tokenizer_config\.json|special_tokens_map\.json|added_tokens\.json|vocab\.json|merges\.txt|normalizer\.json|onnx\/(encoder_model(_fp16)?|decoder_model_merged(_q4|_fp16)?)\.onnx)$/ },
    { repo: 'onnx-community/whisper-small', licence: 'MIT (openai/whisper-small; ONNX export by onnx-community)', only: /^(config\.json|generation_config\.json|preprocessor_config\.json|tokenizer\.json|tokenizer_config\.json|special_tokens_map\.json|added_tokens\.json|vocab\.json|merges\.txt|normalizer\.json|onnx\/(encoder_model_fp16|decoder_model_merged_q4)\.onnx)$/ },
  ],
  // D-336 (UD-22): the people's own voices. Kokoro-82M with every one of its 54 style voices (a person's voice is a blend
  // of them: audio/neural), the speaker-verification models that measure that every voice is unique (T-E11), a naturalness
  // (MOS) predictor, the English-to-Farsi translator of the opt-in layer, and Piper's 904-speaker LibriTTS-R voice (the
  // measured alternative). Usage: MODELS_DIR=T:/fars-assets-s12/voices/models node tools/dev/fetch_models.mjs voices
  voices: [
    { repo: 'onnx-community/Kokoro-82M-v1.0-ONNX', licence: 'Apache-2.0 (hexgrad/Kokoro-82M; ONNX export by onnx-community)', only: /^(config\.json|tokenizer\.json|tokenizer_config\.json|onnx\/model(_fp16|_q8f16|_quantized)?\.onnx|voices\/[a-z]{2}_[a-z]+\.bin)$/ },
    { repo: 'Xenova/wavlm-base-plus-sv', licence: 'MIT (microsoft/wavlm-base-plus-sv; ONNX export by Xenova)', only: /^(config\.json|preprocessor_config\.json|onnx\/model(_quantized)?\.onnx)$/ },
    { repo: 'Wespeaker/wespeaker-ecapa-tdnn512-LM', licence: 'CC-BY-4.0 (WeSpeaker, VoxCeleb ECAPA-TDNN 512)', only: /^(config\.yaml|voxceleb_ECAPA512_LM\.onnx)$/ },
    { repo: 'TigreGotico/utmos-onnx', licence: 'MIT (UTMOS22 strong, sarulab-speech; ONNX export by TigreGotico)', only: /^(utmos22_strong\.onnx|export_utmos\.py)$/ },
    { repo: 'Xenova/nllb-200-distilled-600M', licence: 'CC-BY-NC-4.0 (facebook/nllb-200-distilled-600M; personal non-commercial use)', only: /^(config\.json|generation_config\.json|special_tokens_map\.json|tokenizer\.json|tokenizer_config\.json|onnx\/(encoder_model_quantized|decoder_model_merged_quantized)\.onnx)$/ },
    { repo: 'rhasspy/piper-voices', licence: 'MIT (Piper) / CC-BY-4.0 (LibriTTS-R data)', only: /^en\/en_US\/libritts_r\/medium\/(en_US-libritts_r-medium\.onnx(\.json)?|MODEL_CARD)$/ },
  ],
  tts: [{ repo: 'onnx-community/Kokoro-82M-v1.0-ONNX', only: /^(config\.json|tokenizer\.json|tokenizer_config\.json|onnx\/model(_q8f16|_fp16)?\.onnx|voices\/(af_heart|am_michael|bf_emma|bm_george)\.bin)$/ }],
};

const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { _meta: { what: 'model downloads for PĀRSA (D-296, UD-18): outside git; served to the dev server at /models/ (public/models junction)', layout: '<repo>/resolve/main/<file>; WebLLM libraries under mlc-libs/' }, files: {} };
const save = () => writeFileSync(MAN, JSON.stringify(man, null, 1));
const sha = p => new Promise((res, rej) => { const h = createHash('sha256'); createReadStream(p).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });

async function get(url, out, meta) {
  const rec = man.files[out.replace(ROOT + '/', '')];
  if (existsSync(out) && rec && statSync(out).size === rec.bytes) return rec;
  mkdirSync(dirname(out), { recursive: true });
  for (let tries = 0; ; tries++) {
    try { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(`${r.status} ${url}`);
      await pipeline(Readable.fromWeb(r.body), createWriteStream(out)); break; }
    catch (e) { if (tries >= 3) throw e; console.warn('retry', url, String(e)); }
  }
  const bytes = statSync(out).size, h = await sha(out);
  if (meta.sha256 && meta.sha256 !== h) throw new Error(`sha256 mismatch ${url}`);
  const row = { source: url, licence: meta.licence, bytes, sha256: h, fetched: new Date().toISOString().slice(0, 10) };
  man.files[out.replace(ROOT + '/', '')] = row; save(); return row;
}

async function repo(g) {
  const info = await (await fetch(`https://huggingface.co/api/models/${g.repo}`)).json();
  const licence = g.licence ?? info.cardData?.license ?? (info.tags ?? []).find(t => t.startsWith('license:'))?.slice(8) ?? 'see model card';
  const base = info.cardData?.base_model ? ` (base ${[].concat(info.cardData.base_model).join(', ')})` : '';
  const tree = await (await fetch(`https://huggingface.co/api/models/${g.repo}/tree/main?recursive=1`)).json();
  let n = 0, bytes = 0;
  for (const f of tree) { if (f.type !== 'file' || (g.only && !g.only.test(f.path)) || /^(\.gitattributes|README\.md)$/.test(f.path)) continue;
    const r = await get(`https://huggingface.co/${g.repo}/resolve/main/${f.path}`, `${ROOT}/${g.repo}/resolve/main/${f.path}`, { licence: licence + base, sha256: f.lfs?.oid });
    n++; bytes += r.bytes; }
  if (g.lib) { const r = await get(WASM + g.lib, `${ROOT}/mlc-libs/${g.lib}`, { licence: 'Apache-2.0 (mlc-ai/binary-mlc-llm-libs)' }); bytes += r.bytes; }
  console.log(`${g.repo}: ${n} files, ${(bytes / 1e6).toFixed(0)} MB, licence ${licence}`);
}

const want = process.argv.slice(2); const groups = want.length ? want : ['llm', 'asr', 'tts'];
mkdirSync(ROOT, { recursive: true });
for (const k of groups) for (const g of GROUPS[k]) await repo(g);
