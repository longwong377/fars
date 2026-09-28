// D-336 (UD-22): the people's voices in a worker. Kokoro-82M on WebGPU (WASM when the GPU is not there or fails), one short
// synthesis per message (a unit or a sentence: each a short dispatch, well within the Windows watchdog). Requests are queued
// by priority (a conversation's reply first, then the voices near the listener, then the murmur bed's grains) and the
// newest-first within a priority, so a talker who has walked away does not hold up the one in front of you.
// Messages in:  {type:'load', device?, dtype?}  {type:'speak', id, prio, phonemes?, text?, lang?, voice, speed?}  {type:'drop', below}
// Messages out: {type:'loaded', ms, device}  {type:'audio', id, pcm, rate, ms, queued}  {type:'error', id?, error}
import { KokoroRunner } from './runner';
import { KOKORO_REPO, KOKORO_RATE, espeakToKokoro } from './kokoro';
import { localModels } from '../../people/converse/models';
import type { NeuralVoice } from './identity';

localModels(self.location.origin);
let K: KokoroRunner | null = null; let device = 'webgpu';
interface Job { id: number; prio: number; t: number; phonemes?: string; text?: string; lang?: 'fa' | 'en'; voice: NeuralVoice; speed?: number }
const queue: Job[] = []; let busy = false;
const post = (m: any, t?: Transferable[]) => (self as any).postMessage(m, t ?? []);
const voiceData = async (n: string) => (await fetch(`https://huggingface.co/${KOKORO_REPO}/resolve/main/voices/${n}.bin`)).arrayBuffer();

async function pump() {
  if (busy || !K) return; busy = true;
  try {
    while (queue.length) {
      queue.sort((a, b) => a.prio - b.prio || (a.prio === 0 ? a.t - b.t : b.t - a.t)); const j = queue.shift()!; const t0 = performance.now();
      try {
        let ph = j.phonemes ?? '';
        if (!ph && j.text && j.lang) { const { espeakIpa } = await import('./g2p'); ph = espeakToKokoro(await espeakIpa(j.text, j.lang), j.lang); }
        const pcm = ph ? await K.speak(ph, j.voice, { speed: j.speed }) : new Float32Array(0);
        post({ type: 'audio', id: j.id, pcm, rate: KOKORO_RATE, ms: performance.now() - t0, queued: t0 - j.t, phonemes: ph }, [pcm.buffer]);
      } catch (err) { post({ type: 'error', id: j.id, error: String((err as any)?.message ?? err) }); if (/device|lost|disposed|GPU/i.test(String(err))) await reload(); }
    }
  } finally { busy = false; }
}
async function load(dev: string, dtype: any) {
  K = await KokoroRunner.load({ device: dev as any, dtype, voiceData }); device = dev;
}
/** the GPU device lost (the watchdog under a busy card): load again, on WASM if WebGPU fails twice */
let lost = 0;
async function reload() { lost++; K = null; try { await load(lost > 1 ? 'wasm' : device, lost > 1 ? 'q8' : 'fp32'); } catch { /* the voices stay silent */ } }

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'load') {
    const t0 = performance.now(); const want = m.device ?? ((navigator as any).gpu ? 'webgpu' : 'wasm');
    try { await load(want, m.dtype ?? (want === 'webgpu' ? 'fp32' : 'q8')); }
    catch (err) { if (want === 'wasm') { post({ type: 'error', error: String(err) }); return; } try { await load('wasm', 'q8'); } catch (e2) { post({ type: 'error', error: String(e2) }); return; } }
    // warm the kernels (the first call compiles them)
    await K!.raw('ha.', new Float32Array(256), 1);
    post({ type: 'loaded', ms: performance.now() - t0, device }); pump();
  } else if (m.type === 'speak') { queue.push({ ...m, t: performance.now() }); pump(); }
  else if (m.type === 'drop') { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].prio >= m.below) { post({ type: 'error', id: queue[i].id, error: 'dropped' }); queue.splice(i, 1); } }
};
