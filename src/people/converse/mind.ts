// D-296 (UD-18): the person's mind in the browser: the language model (WebLLM, in a worker), speech recognition (Whisper,
// in a worker) and the out-of-world English voice (Kokoro, in a worker). Loaded only on request (?converse or the dev lab);
// without WebGPU the people live as before. Every answer is checked by the fence before it is shown (fence.ts); a failed
// answer is asked again once with the failure named, and still failing, nothing is said (the person shrugs: T-E9 counts it).
import { DEED_SCHEMA, deedPrompt, type ModelDeed } from '../deeds/extract';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { appConfig } from './models';
import { fenceHits, type FenceHit } from './fence';
import { primeParts, tidy, type Knows, type Turn } from './prompt';
import { hearAsPerson } from './hear';
import type { LifeRecord } from './life';
import { parseIntent, type Intent } from './intent';
import { judgePrompt } from './ground';

/** D-315: what the person remembers of the stranger (talk.ts recall) and the simulation's word on what was asked */
export interface AskOpts { memory?: string[]; note?: string; /** a turn that is not the stranger's words (the retelling of a refusal: turn.ts) */ userText?: string; /** D-315: said just before the stranger's words (the memory, near the question) */ before?: string; /** D-315 run 5: the one life fact, in the closing note: "(Answer as X, from your own life: …)" */ ground?: string }
export interface Answer { /** D-315: the tag the model ended with (intent.ts; null: none) */ intent?: Intent | null; heard?: string; recovered?: boolean; text: string; raw: string; ok: boolean; hits: FenceHit[]; tries: number; ttftMs: number; totalMs: number; primeMs: number; tokens: number; prefillTps: number; decodeTps: number }
export interface LoadInfo { ms: number; model: string }
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

export class Mind {
  engine: MLCEngineInterface | null = null; model = ''; private worker: Worker | null = null;
  private conv: Msg[] = []; primedFor = '';
  async load(model: string, onProgress?: (p: { progress: number; text: string }) => void): Promise<LoadInfo> {
    const t0 = performance.now(); const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    this.worker?.terminate(); this.worker = new Worker(new URL('./llm_worker.ts', import.meta.url), { type: 'module' });
    this.engine = await CreateWebWorkerMLCEngine(this.worker, model, { appConfig: appConfig([model], location.origin) as any, initProgressCallback: onProgress });
    this.model = model; this.forget();
    await this.engine.chat.completions.create({ messages: [{ role: 'user', content: 'Say yes.' }], max_tokens: 4, ...this.extra() } as any); // warm the kernels
    return { ms: performance.now() - t0, model };
  }
  private extra() { return /Qwen3/.test(this.model) ? { extra_body: { enable_thinking: false } } : {}; }
  async unload() { await this.engine?.unload(); this.worker?.terminate(); this.engine = null; this.worker = null; this.forget(); }

  /** prime the model with a person's life when the stranger comes near (prompt.ts primeParts): two short read-ins, kept in
   *  the model's cache (WebLLM's multi-round KV reuse) for the talk; returns the time taken (0: already primed for this
   *  person, hour and familiarity) */
  async prime(L: LifeRecord, knows: Knows, prose?: string | null, memory?: string[] | null): Promise<number> {
    const key = [L.seed, L.pid, L.day, Math.floor(L.hour), knows, (memory ?? []).join('|')].join('|'); if (key === this.primedFor) return 0;
    const t0 = performance.now(); const P = primeParts(L, knows, prose, memory); const msgs: Msg[] = [{ role: 'system', content: P.system }];
    for (const f of P.facts) { msgs.push({ role: 'user', content: f });
      const r = await this.engine!.chat.completions.create({ messages: msgs, max_tokens: 24, temperature: 0.7, ...this.extra() } as any) as any;
      msgs.push({ role: 'assistant', content: r.choices[0].message.content ?? '' }); }
    this.conv = msgs; this.primedFor = key; return performance.now() - t0;
  }
  /** D-315: the judge: did this reply agree to what was asked? (the loaded model, two tokens, greedy; outside the person's
   *  talk). null: no clear answer. D-456: the talk stays primed (it was primed afresh after every judge, and the person forgot
   *  the talk so far): the next answer sends the whole talk again and WebLLM reads it in anew */
  judges = 0;
  async judge(asked: string, reply: string): Promise<boolean | null> {
    if (!this.engine) return null; this.judges++;
    const r = await this.engine.chat.completions.create({ messages: judgePrompt(asked, reply), max_tokens: 3, temperature: 0, ...this.extra() } as any) as any;
    const a = String(r.choices?.[0]?.message?.content ?? '').trim().toUpperCase();
    return /^Y/.test(a) ? true : /^N/.test(a) ? false : null;
  }
  /** D-459 (UD-32): the stranger's words read as a deed by the loaded model under the deed schema (deeds/extract.ts: WebLLM's
   *  JSON mode, greedy); null without a model or a clear reading. Outside the person's talk, which is primed again after (as the judge) */
  deedReads = 0;
  async readDeed(said: string): Promise<ModelDeed | null> {
    if (!this.engine) return null; this.deedReads++; const p = deedPrompt(said);
    try { const r = await this.engine.chat.completions.create({ messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }], max_tokens: 80, temperature: 0, response_format: { type: 'json_object', schema: JSON.stringify(DEED_SCHEMA) }, ...this.extra() } as any) as any;
      this.primedFor = ''; return JSON.parse(String(r.choices?.[0]?.message?.content ?? 'null')) as ModelDeed; }
    catch { this.primedFor = ''; return null; }
  }
  /** forget the primed person (another comes near) */
  forget() { this.conv = []; this.primedFor = ''; }

  /** one answer as the person (primed first if need be): streamed (first-token time measured), tidied, fenced; on a fence
   *  failure the person is told the word they cannot know and answers again once. The talk stays in the model's cache */
  recoveries = 0;
  /** the answer, and if the GPU device was lost on the way (the Windows watchdog under a busy card: DXGI_ERROR_DEVICE_HUNG),
   *  the model reloaded and the answer asked once more (the time counts: T-E9 fails it when it runs past 4 s) */
  async answer(L: LifeRecord, knows: Knows, history: Turn[], said: string, prose?: string | null, maxTokens = 64, opts: AskOpts = {}): Promise<Answer> {
    const t0 = performance.now();
    try { return await this.answerOnce(L, knows, history, said, prose, maxTokens, opts); }
    catch (e) { if (!/disposed|device|lost|mapAsync|unmapped|GPUPipelineError|Invalid ShaderModule|is invalid/i.test(String(e))) throw e; // (run 2 of D-315: an invalid shader module on a busy card)
      this.recoveries++; console.warn('[converse] GPU device lost; reloading the model', String(e).slice(0, 200)); await this.unload().catch(() => {}); await this.load(this.model);
      const a = await this.answerOnce(L, knows, history, said, prose, maxTokens, opts); return { ...a, totalMs: performance.now() - t0, recovered: true } as Answer; }
  }
  private async answerOnce(L: LifeRecord, knows: Knows, _history: Turn[], said: string, prose?: string | null, maxTokens = 64, opts: AskOpts = {}): Promise<Answer> {
    const primeMs = await this.prime(L, knows, prose, opts.memory);
    const e = this.engine!; const t0 = performance.now(); let ttft = -1, tokens = 0, raw = '', text = '', hits: FenceHit[] = [], tries = 0, prefill = 0, decode = 0; let intent: Intent | null = null;
    const h = hearAsPerson(said); // the fence on the way in (hear.ts): later words reach the person as "…"
    // (D-315: the simulation's word on what was asked, when the stranger asked for something: "(You can do it.)" / "(You
    // cannot: on watch ...)"; the person's own words and tag follow)
    let msgs: Msg[] = [...this.conv, { role: 'user', content: opts.userText ?? `${opts.before ? opts.before + '\n' : ''}The stranger says: “${h.text}”${h.note ? ` (${h.note}.)` : ''}${opts.note ? ` (${opts.note})` : ''} (Answer as ${L.name}, from your own life${opts.ground ? `: ${opts.ground}` : ''}.)` }];
    while (tries < 2) {
      tries++; raw = '';
      const stream = await e.chat.completions.create({ messages: msgs, stream: true, stream_options: { include_usage: true }, max_tokens: maxTokens, temperature: 0.7, top_p: 0.9, frequency_penalty: 0.3, presence_penalty: 0.1, ...this.extra() } as any) as any;
      for await (const ch of stream) { const d = ch.choices?.[0]?.delta?.content ?? ''; if (d && ttft < 0) ttft = performance.now() - t0; raw += d;
        if (ch.usage) { tokens += ch.usage.completion_tokens; prefill = ch.usage.extra?.prefill_tokens_per_s ?? prefill; decode = ch.usage.extra?.decode_tokens_per_s ?? decode; } }
      msgs = [...msgs, { role: 'assistant', content: raw }];
      const pi = parseIntent(raw); intent = pi.intent; text = tidy(pi.words); hits = fenceHits(text); // (D-315: the tag read and taken out before the words are tidied and fenced)
      if (!hits.length && text.length > 1) break;
      const words = [...new Set(hits.map(h => `“${h.term}”`))].join(', ');
      msgs.push({ role: 'user', content: hits.length ? `(Say that again as yourself: you do not know ${words}, and you never speak of what is to come.)` : '(Answer me as yourself, briefly.)' });
    }
    this.conv = msgs;
    return { intent, heard: h.text, text, raw, ok: !hits.length && text.length > 1, hits, tries, ttftMs: ttft, totalMs: performance.now() - t0, primeMs, tokens, prefillTps: prefill, decodeTps: decode };
  }
}

/** speech recognition in a worker */
export class Ears {
  w: Worker | null = null; private pending: ((m: any) => void) | null = null;
  // D-376 (UD-31): only when the microphone is turned on, and the quantized files (encoder 23 MB + merged decoder 54 MB, on WASM)
  async load(model = 'onnx-community/whisper-base', dtype: any = { encoder_model: 'q8', decoder_model_merged: 'q8' }, device = 'wasm'): Promise<number> {
    this.w = new Worker(new URL('./asr_worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = e => { const p = this.pending; this.pending = null; p?.(e.data); };
    const r = await this.ask({ type: 'load', model, dtype, device }); if (r.type === 'error') throw new Error(r.error); return r.ms;
  }
  private ask(m: any): Promise<any> { return new Promise(res => { this.pending = res; this.w!.postMessage(m); }); }
  async hear(audio16k: Float32Array): Promise<{ text: string; ms: number }> { const r = await this.ask({ type: 'run', audio: audio16k }); if (r.type === 'error') throw new Error(r.error); return r; }
  dispose() { this.w?.terminate(); this.w = null; }
}

/** the out-of-world English voice (an option in the translation layer; never the heard world by default) */
export class EnglishVoice {
  w: Worker | null = null; private pending: ((m: any) => void) | null = null;
  async load(dtype = 'fp32', device = 'webgpu'): Promise<number> {
    this.w = new Worker(new URL('./tts_worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = e => { const p = this.pending; this.pending = null; p?.(e.data); };
    const r = await this.ask({ type: 'load', dtype, device }); if (r.type === 'error') throw new Error(r.error); return r.ms;
  }
  private ask(m: any): Promise<any> { return new Promise(res => { this.pending = res; this.w!.postMessage(m); }); }
  async say(text: string, voice = 'bm_george'): Promise<{ data: Float32Array; rate: number; ms: number }> { const r = await this.ask({ type: 'say', text, voice }); if (r.type === 'error') throw new Error(r.error); return r; }
  dispose() { this.w?.terminate(); this.w = null; }
}

/** microphone capture at 16 kHz mono (push to talk): start() then stop() returns the samples */
export class Mic {
  private ctx: AudioContext | null = null; private stream: MediaStream | null = null; private node: ScriptProcessorNode | null = null; private chunks: Float32Array[] = [];
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext({ sampleRate: 16000 }); const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1); this.chunks = [];
    this.node.onaudioprocess = e => this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(this.node); this.node.connect(this.ctx.destination);
  }
  async stop(): Promise<Float32Array> {
    this.node?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); await this.ctx?.close();
    const n = this.chunks.reduce((a, c) => a + c.length, 0); const out = new Float32Array(n); let o = 0; for (const c of this.chunks) { out.set(c, o); o += c.length; }
    this.chunks = []; return out;
  }
}
