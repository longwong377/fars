// D-296 (UD-18): speaking with the people in the world (?converse). Out of world: the typing box and the reply panel belong
// to the translation layer (English); in the world the person answers in their own voice and language (voice.ts).
//   T: type to the nearest person within 3 m;  hold V: speak (microphone; Whisper in the browser);  Esc: close.
// The model loads on the first ?converse visit (cached by the browser after it); without WebGPU nothing here runs and the
// people live as before. The simulation stays the source of truth: the model only answers, it changes nothing.
import * as THREE from 'three/webgpu';
import { Mind, Ears, Mic, EnglishVoice } from './mind';
import { lifeRecord, type LifeRecord } from './life';
import { heardReply } from './voice';
import type { Turn } from './prompt';

export const DEFAULT_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const NEAR_M = 3;
interface Ctx { world: any; camera: THREE.Camera; clock: { dayIndex: number; localHour: number; t: number }; seed: number; englishVoice?: boolean }
export interface Near { pid: number; agent: number | null; name: string; d: number; e: number; n: number }

/** the nearest person within 3 m of the eye (detailed agents and the population's people drawn around the player) */
export function nearest(world: any, eye: { e: number; n: number }, r = NEAR_M): Near | null {
  const P = world.people; if (!P) return null; let best: Near | null = null;
  const consider = (pid: number, agent: number | null, e: number, n: number) => { const d = Math.hypot(e - eye.e, n - eye.n); if (d <= r && (!best || d < best.d)) best = { pid, agent, name: P.sim.pop.nameOf(pid)?.replace(/^\*/, '') ?? '', d, e, n }; };
  for (const a of P.sim.agents) if (!a.offmap && a.pid >= 0) consider(a.pid, a.id, a.pos[0], a.pos[1]);
  for (const o of P.view?.visible ?? []) if (o.pid >= 0) consider(o.pid, null, o.e, o.n);
  return best;
}

export function mountConverse(c: Ctx) {
  const gpu = !!(navigator as any).gpu; const mind = new Mind(); let ears: Ears | null = null; let en: EnglishVoice | null = null;
  const P = new URLSearchParams(location.search); const model = P.get('model') ?? DEFAULT_MODEL;
  const panel = document.createElement('div'); panel.id = 'converse';
  panel.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(720px,92vw);font:15px/1.4 Georgia,serif;color:#f1e6cf;background:rgba(20,16,11,.72);padding:10px 14px;border-radius:6px;z-index:20;display:none';
  const line = document.createElement('div'); const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'say something (Enter), Esc to close';
  input.style.cssText = 'width:100%;box-sizing:border-box;margin-top:6px;background:rgba(0,0,0,.35);color:inherit;border:1px solid #6b5a42;padding:5px;font:inherit;display:none';
  const small = document.createElement('div'); small.style.cssText = 'font:11px system-ui,sans-serif;opacity:.7;margin-top:4px';
  panel.append(line, input, small); document.body.append(panel);
  const show = (html: string, note = '') => { panel.style.display = 'block'; line.innerHTML = html; small.textContent = note; };
  const state = { status: gpu ? 'idle' : 'no WebGPU: the people live as before', loaded: false, busy: false, last: null as any, history: new Map<number, Turn[]>(), log: [] as any[] };
  let audio: AudioContext | null = null;
  const play = (data: Float32Array, rate: number) => { audio ??= new AudioContext(); const b = audio.createBuffer(1, data.length, rate); b.getChannelData(0).set(data); const s = audio.createBufferSource(); s.buffer = b; s.connect(audio.destination); s.start(); };
  const eye = () => ({ e: c.camera.position.x, n: -c.camera.position.z });
  async function ensure() {
    if (state.loaded || !gpu) return state.loaded;
    state.status = 'loading'; show('<i>…</i>', `loading ${model} (out of world; cached after the first visit)`);
    await mind.load(model, p => { small.textContent = `loading the model: ${(p.progress * 100).toFixed(0)}%`; });
    state.loaded = true; state.status = 'ready'; return true;
  }
  /** say `text` to the nearest person: the answer (translation layer) and the heard reply (their own voice) */
  async function say(text: string, heardMs = 0): Promise<any> {
    const near = nearest(c.world, eye()); if (!near) { show('<i>No one is near enough to hear you.</i>'); return null; }
    if (!(await ensure())) return null;
    const sim = c.world.people.sim; const day = c.clock.dayIndex, hour = c.clock.localHour;
    const L: LifeRecord = lifeRecord(sim.pop, sim.cal, near.pid, day, hour);
    const key = near.agent ?? -1 - near.pid; const knows = near.agent !== null ? sim.memory.greeting(near.agent, sim.t) : 'none';
    if (near.agent !== null) sim.memory.note(near.agent, 'addressed', sim.t);
    const hist = state.history.get(near.pid) ?? [];
    await primeP; state.busy = true; show(`<b>${L.name}</b> <i>…</i>`, 'translation layer');
    const t0 = performance.now(); const a = await mind.answer(L, knows, hist, text); state.busy = false;
    hist.push({ role: 'user', content: text }, { role: 'assistant', content: a.ok ? a.text : '' }); state.history.set(near.pid, hist.slice(-8));
    let heard = null as any;
    if (a.ok) { const h = heardReply(sim.pop, near.pid, day, a.text, c.seed); heard = { lang: h.lang, units: h.units.map(u => u.translit || u.gloss), seconds: h.seconds };
      play(h.data, h.rate); if (c.englishVoice || P.has('english')) { en ??= new EnglishVoice(); en.load().then(() => en!.say(a.text)).then(r => play(r.data, r.rate)).catch(() => {}); } }
    show(a.ok ? `<b>${L.name}</b>: ${a.text}` : `<b>${L.name}</b> <i>shrugs and turns back to the work.</i>`, `translation layer (English, out of world); heard: ${heard ? heard.lang : 'nothing'}; ${((performance.now() - t0 + heardMs) / 1000).toFixed(1)} s`);
    const row = { pid: near.pid, name: L.name, d: +near.d.toFixed(2), said: text, reply: a.text, ok: a.ok, hits: a.hits, ms: performance.now() - t0 + heardMs, ttft: a.ttftMs, heard, key };
    state.last = row; state.log.push(row); return row;
  }
  const mic = new Mic(); let recording = false;
  addEventListener('keydown', e => {
    if (e.target === input) return;
    if (e.code === 'KeyT' && !e.repeat) { panel.style.display = 'block'; input.style.display = 'block'; input.focus(); e.preventDefault(); e.stopPropagation(); }
    if (e.code === 'KeyV' && !e.repeat && !recording && gpu) { recording = true; show('<i>(listening)</i>'); mic.start().catch(err => { recording = false; show(`<i>no microphone: ${err}</i>`); }); }
  }, true);
  addEventListener('keyup', async e => {
    if (e.code !== 'KeyV' || !recording) return; recording = false;
    const s = await mic.stop(); if (s.length < 3200) { show('<i>(too short)</i>'); return; }
    ears ??= new Ears(); if (!(ears as any).w) await ears.load();
    const h = await ears.hear(s); show(`<i>you:</i> ${h.text}`); if (h.text) say(h.text, h.ms);
  });
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { input.style.display = 'none'; input.blur(); panel.style.display = 'none'; }
    if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim(); input.value = ''; input.style.display = 'none'; input.blur(); say(t); } });
  input.addEventListener('keyup', e => e.stopPropagation());
  // prime the model with the nearest person's life as the stranger comes near (within 6 m), so the answer costs only the question
  let primeP: Promise<any> = Promise.resolve();
  setInterval(() => { if (!state.loaded || state.busy) return; const n = nearest(c.world, eye(), 6); if (!n) return; const sim = c.world.people.sim;
    const L = lifeRecord(sim.pop, sim.cal, n.pid, c.clock.dayIndex, c.clock.localHour); const knows = n.agent !== null ? sim.memory.greeting(n.agent, sim.t) : 'none';
    state.busy = true; primeP = mind.prime(L, knows).then(ms => { if (ms) state.log.push({ primed: n.pid, ms }); }).finally(() => { state.busy = false; }); }, 500);
  const api = { state, say, nearest: () => nearest(c.world, eye()), load: ensure, mind, hear: async (samples: number[]) => { ears ??= new Ears(); if (!(ears as any).w) await ears.load(); return ears.hear(Float32Array.from(samples)); } };
  (window as any).__converse = api; return api;
}
