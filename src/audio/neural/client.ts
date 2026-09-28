// D-336 (UD-22): the main thread's side of the people's voices: one worker (neural_worker.ts), a cache of rendered clips per
// person and unit (a person says one of their few hundred published units; the same person saying the same unit again is
// the same clip, played with this utterance's own small pitch and pace variation: voices.ts utter), and the priorities.
// `get` never waits: it returns the clip when it is ready and queues the render when it is not (the speaker waits, silent,
// as a formant render over budget did before: the jaw moves only with the voice).
import type { NeuralVoice } from './identity';
import { voiceKey } from './identity';
import { phonemesFor } from './kokoro';

export const PRIO = { reply: 0, near: 1, voice: 2, bed: 3 } as const;
export interface NeuralStats { ready: boolean; device: string; loadMs: number; renders: number; renderMs: number; queuedMs: number; cached: number; pending: number; errors: number; lastError: string }
export class NeuralVoices {
  private w: Worker | null = null; private seq = 1;
  private pending = new Map<number, { key: string | null; res: (x: { pcm: Float32Array; rate: number; ms: number } | null) => void }>();
  private clips = new Map<string, Float32Array>(); private inflight = new Set<string>();
  readonly stats: NeuralStats = { ready: false, device: '', loadMs: 0, renders: 0, renderMs: 0, queuedMs: 0, cached: 0, pending: 0, errors: 0, lastError: '' };
  /** the clips kept (a clip of ~1.5 s is ~140 kB; 1200 is ~170 MB at most, most units are shorter) */
  maxClips = 1200;
  readonly ready: Promise<boolean>;
  constructor(o: { device?: 'webgpu' | 'wasm'; dtype?: string } = {}) {
    this.ready = new Promise(res => {
      try { this.w = new Worker(new URL('./neural_worker.ts', import.meta.url), { type: 'module' }); } catch (e) { this.stats.lastError = String(e); res(false); return; }
      this.w.onmessage = (e: MessageEvent) => { const m = e.data;
        if (m.type === 'loaded') { this.stats.ready = true; this.stats.device = m.device; this.stats.loadMs = m.ms; res(true); return; }
        if (m.type === 'error' && m.id === undefined) { this.stats.lastError = m.error; res(false); return; }
        const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); this.stats.pending = this.pending.size;
        if (m.type === 'audio') { this.stats.renders++; this.stats.renderMs += m.ms; this.stats.queuedMs += m.queued;
          if (p.key) { this.inflight.delete(p.key); if (m.pcm.length) this.put(p.key, m.pcm); } p.res({ pcm: m.pcm, rate: m.rate, ms: m.ms }); }
        else { if (m.error !== 'dropped') { this.stats.errors++; this.stats.lastError = m.error; } if (p.key) this.inflight.delete(p.key); p.res(null); } };
      this.w.onerror = e => { this.stats.lastError = String(e.message ?? e); res(false); };
      this.w.postMessage({ type: 'load', device: o.device, dtype: o.dtype });
    });
  }
  private put(k: string, pcm: Float32Array) { this.clips.set(k, pcm); if (this.clips.size > this.maxClips) this.clips.delete(this.clips.keys().next().value!); this.stats.cached = this.clips.size; }
  private ask(m: any, key: string | null): Promise<{ pcm: Float32Array; rate: number; ms: number } | null> {
    if (!this.w) return Promise.resolve(null); const id = this.seq++;
    return new Promise(res => { this.pending.set(id, { key, res }); this.stats.pending = this.pending.size; this.w!.postMessage({ type: 'speak', id, ...m }); });
  }
  /** a published unit (its IPA) in a person's voice: the clip if rendered, else null and the render queued */
  get(v: NeuralVoice, unitId: string, ipa: string, intonation: 'fall' | 'rise' | 'level', prio: number, variant = 0): Float32Array | null {
    const k = `${voiceKey(v)}|${unitId}|${intonation}|${variant}`; const c = this.clips.get(k);
    if (c) { this.clips.delete(k); this.clips.set(k, c); return c; }
    if (!this.stats.ready || this.inflight.has(k) || this.inflight.size > 48) return null;
    const ph = phonemesFor(ipa, intonation); if (!ph) return null;
    this.inflight.add(k); this.ask({ prio, phonemes: ph, voice: v, speed: variant ? 1 + 0.06 * variant : 1 }, k); return null;
  }
  /** the whole clip, waited for (a conversation's reply): phonemes of the period language, or a text of the opt-in layer */
  say(v: NeuralVoice, o: { phonemes?: string; text?: string; lang?: 'fa' | 'en' }, prio: number = PRIO.reply) { return this.ask({ prio, voice: v, ...o }, null); }
  /** drop the queued renders of this priority and below (the listener moved far) */
  drop(below: number) { this.w?.postMessage({ type: 'drop', below }); }
  lines(): string[] { const s = this.stats; return [`neural voices (D-336, Kokoro-82M ${s.device || 'not loaded'}): ${s.renders} renders, ${(s.renders ? s.renderMs / s.renders : 0).toFixed(0)} ms each, queued ${(s.renders ? s.queuedMs / s.renders : 0).toFixed(0)} ms, ${s.cached} clips, ${s.pending} pending${s.errors ? `, ${s.errors} errors (${s.lastError.slice(0, 60)})` : ''}`]; }
  dispose() { this.w?.terminate(); this.w = null; }
}
