// D-296 (UD-18): the person's mind in the browser: the language model (WebLLM, in a worker), speech recognition (Whisper,
// in a worker) and the out-of-world English voice (Kokoro, in a worker). Loaded only on request (?converse or the dev lab);
// without WebGPU the people live as before. Every answer is checked by the fence before it is shown (fence.ts); a failed
// answer is asked again once with the failure named, and still failing, nothing is said (the person shrugs: T-E9 counts it).
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { appConfig } from './models';
import { fenceHits, type FenceHit } from './fence';
import { primeParts, tidy, type Knows, type Turn } from './prompt';
import { hearAsPerson } from './hear';
import type { LifeRecord } from './life';

export interface Answer { heard?: string; recovered?: boolean; text: string; raw: string; ok: boolean; hits: FenceHit[]; tries: number; ttftMs: number; totalMs: number; primeMs: number; tokens: number; prefillTps: number; decodeTps: number }
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
  async prime(L: LifeRecord, knows: Knows, prose?: string | null): Promise<number> {
    const key = [L.seed, L.pid, L.day, Math.floor(L.hour), knows].join('|'); if (key === this.primedFor) return 0;
    const t0 = performance.now(); const P = primeParts(L, knows, prose); const msgs: Msg[] = [{ role: 'system', content: P.system }];
    for (const f of P.facts) { msgs.push({ role: 'user', content: f });
      const r = await this.engine!.chat.completions.create({ messages: msgs, max_tokens: 24, temperature: 0.7, ...this.extra() } as any) as any;
      msgs.push({ role: 'assistant', content: r.choices[0].message.content ?? '' }); }
    this.conv = msgs; this.primedFor = key; return performance.now() - t0;
  }
  /** forget the primed person (another comes near) */
  forget() { this.conv = []; this.primedFor = ''; }

  /** one answer as the person (primed first if need be): streamed (first-token time measured), tidied, fenced; on a fence
   *  failure the person is told the word they cannot know and answers again once. The talk stays in the model's cache */
  recoveries = 0;
  /** the answer, and if the GPU device was lost on the way (the Windows watchdog under a busy card: DXGI_ERROR_DEVICE_HUNG),
   *  the model reloaded and the answer asked once more (the time counts: T-E9 fails it when it runs past 4 s) */
  async answer(L: LifeRecord, knows: Knows, history: Turn[], said: string, prose?: string | null, maxTokens = 64): Promise<Answer> {
    const t0 = performance.now();
    try { return await this.answerOnce(L, knows, history, said, prose, maxTokens); }
    catch (e) { if (!/disposed|device|lost|mapAsync|unmapped/i.test(String(e))) throw e;
      this.recoveries++; console.warn('[converse] GPU device lost; reloading the model', String(e).slice(0, 200)); await this.unload().catch(() => {}); await this.load(this.model);
      const a = await this.answerOnce(L, knows, history, said, prose, maxTokens); return { ...a, totalMs: performance.now() - t0, recovered: true } as Answer; }
  }
  private async answerOnce(L: LifeRecord, knows: Knows, _history: Turn[], said: string, prose?: string | null, maxTokens = 64): Promise<Answer> {
    const primeMs = await this.prime(L, knows, prose);
    const e = this.engine!; const t0 = performance.now(); let ttft = -1, tokens = 0, raw = '', text = '', hits: FenceHit[] = [], tries = 0, prefill = 0, decode = 0;
    const h = hearAsPerson(said); // the fence on the way in (hear.ts): later words reach the person as "…"
    let msgs: Msg[] = [...this.conv, { role: 'user', content: `The stranger says: “${h.text}”${h.note ? ` (${h.note}.)` : ''} (Answer as ${L.name}, from your own life.)` }];
    while (tries < 2) {
      tries++; raw = '';
      const stream = await e.chat.completions.create({ messages: msgs, stream: true, stream_options: { include_usage: true }, max_tokens: maxTokens, temperature: 0.7, top_p: 0.9, frequency_penalty: 0.3, presence_penalty: 0.1, ...this.extra() } as any) as any;
      for await (const ch of stream) { const d = ch.choices?.[0]?.delta?.content ?? ''; if (d && ttft < 0) ttft = performance.now() - t0; raw += d;
        if (ch.usage) { tokens += ch.usage.completion_tokens; prefill = ch.usage.extra?.prefill_tokens_per_s ?? prefill; decode = ch.usage.extra?.decode_tokens_per_s ?? decode; } }
      msgs = [...msgs, { role: 'assistant', content: raw }];
      text = tidy(raw); hits = fenceHits(text);
      if (!hits.length && text.length > 1) break;
      const words = [...new Set(hits.map(h => `“${h.term}”`))].join(', ');
      msgs.push({ role: 'user', content: hits.length ? `(Say that again as yourself: you do not know ${words}, and you never speak of what is to come.)` : '(Answer me as yourself, briefly.)' });
    }
    this.conv = msgs;
    return { heard: h.text, text, raw, ok: !hits.length && text.length > 1, hits, tries, ttftMs: ttft, totalMs: performance.now() - t0, primeMs, tokens, prefillTps: prefill, decodeTps: decode };
  }
}

/** speech recognition in a worker */
export class Ears {
  w: Worker | null = null; private pending: ((m: any) => void) | null = null;
  async load(model = 'onnx-community/whisper-base', dtype: any = { encoder_model: 'fp16', decoder_model_merged: 'fp16' }): Promise<number> {
    this.w = new Worker(new URL('./asr_worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = e => { const p = this.pending; this.pending = null; p?.(e.data); };
    const r = await this.ask({ type: 'load', model, dtype }); if (r.type === 'error') throw new Error(r.error); return r.ms;
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
