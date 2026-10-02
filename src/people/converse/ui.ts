// D-296 (UD-18): speaking with the people in the world (?converse). Out of world: the typing box and the reply panel belong
// to the translation layer (English); in the world the person answers in their own voice and language (voice.ts).
//   T: type to the nearest person within 3 m;  hold V: speak (microphone; Whisper in the browser);  Esc: close.
// The model loads on the first ?converse visit (cached by the browser after it); without WebGPU nothing here runs and the
// people live as before. The simulation stays the source of truth (D-315, UD-21): the person stops and turns to the
// stranger while they talk; what the stranger asks them to do is decided by the simulation and done as new steps of their
// day (turn.ts, people/talk.ts); what passed is remembered in the save and told on to kin and friends.
import * as THREE from 'three/webgpu';
import { Mind, Ears, Mic, EnglishVoice } from './mind';
import { lifeRecord, type LifeRecord } from './life';
import { heardReply, heardReplyNeural, replyVoice, type HearIn } from './voice';
import { unitsFor, voiceLang, WORDLESS } from '../../audio/voices';
import { toFarsi, FarsiTranslator, type FarsiRoute } from './farsi';
import type { Turn } from './prompt';
import { bakedProse, bakedWho } from './bake';
import { talkTurn } from './turn';

/** D-370: the sandbox step as the translation layer notes it (out of world) */
const SANDBOX_DONE: Record<string, string> = { seek_work: 'taken on as a hand', stay: 'taken in as a guest', join: 'taken in', petition: 'the petition will be heard', give: 'given', claim: 'they heard who you say you are', leave_stay: 'you leave the house', quit: 'you leave the work', leave_group: 'you leave them', hear: 'they say it slowly for you' };
export const DEFAULT_MODEL = 'gemma-2-2b-it-q4f16_1-MLC'; // D-296: measured on the T4 (the lab's T-E9 runs): the most natural voice of the 1-3 B models that fit 4 s and the watchdog
export const NEAR_M = 3;
/** D-336: the Farsi of the opt-in layer by default: the conversation model's own Persian of its reply (measured against NLLB-600M: DECISIONS D-336) */
export const FARSI_ROUTE: FarsiRoute = 'llm';
interface Ctx { world: any; camera: THREE.Camera; clock: { dayIndex: number; localHour: number; t: number }; seed: number; englishVoice?: boolean; /** D-336: settings.hearIn (the opt-in layer) */ settings?: { hearIn?: HearIn } }
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
  const state = { status: gpu ? 'idle' : 'no WebGPU: the people live as before', loaded: false, busy: false, last: null as any, history: new Map<number, Turn[]>(), log: [] as any[], /** D-315: the conversation in progress (person, its id) */ talking: null as null | { pid: number; conv: number } };
  /** D-315: the conversation ends (the stranger walks off or closes the talk): the person goes back to the day */
  const endTalk = () => { const k = state.talking; if (!k) return; state.talking = null; c.world.people?.sim?.talk.release(k.pid, c.world.people.sim.t); };
  // the baked prose layer (D-296): only for the world it was baked for (seed 1: src/data/lives_baked_s1.json)
  let baked = new Map<number, any>(); if (c.seed === 1) import('../../data/lives_baked_s1.json').then(m => { baked = new Map(((m as any).default ?? m).rows.map((r: any) => [r.pid, r])); }).catch(() => {});
  const prose = (pid: number) => { const b = baked.get(pid), p = c.world.people?.sim?.pop?.persons[pid]; return bakedProse(b && p && b.who === bakedWho(p) ? b : null); }; // (D-348: only while the pid is still the person it was baked for)
  // D-336: the opt-in layer (settings.hearIn; ?hear=fa|en for tests) and the route of its Farsi (?farsi=llm|nllb; D-336 measured)
  const hearIn = (): HearIn => (P.get('hear') as HearIn | null) ?? c.settings?.hearIn ?? 'own';
  const faRoute = (): FarsiRoute => (P.get('farsi') as FarsiRoute | null) ?? FARSI_ROUTE; const nllb = new FarsiTranslator();
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
    const key = near.agent ?? -1 - near.pid;
    const hist = state.history.get(near.pid) ?? [];
    if (state.talking?.pid !== near.pid) { endTalk(); state.talking = { pid: near.pid, conv: sim.t }; }
    await primeP; state.busy = true; show(`<b>${L.name}</b> <i>…</i>`, 'translation layer');
    // (D-315: the words and the deed together: the pause, the memory, the ask decided by the simulation, the memory row)
    const t0 = performance.now(); const T = await talkTurn(mind, sim, near.pid, text, { conv: state.talking!.conv, history: hist, prose: prose(near.pid) }); const a = T.answer; state.busy = false;
    hist.push({ role: 'user', content: text }, { role: 'assistant', content: a.ok ? a.text : '' }); state.history.set(near.pid, hist.slice(-8));
    let heard = null as any;
    if (a.ok) {
      // D-336 (UD-22): the person's own natural voice, in their own language, or (the opt-in layer) the same reply in Farsi or
      // English; played at them in the world's sound (sayPcm), piece by piece as it renders
      const nv = c.world.neural, agent = near.agent !== null ? sim.agents[near.agent] : null, layer = hearIn(); let fa: Awaited<ReturnType<typeof toFarsi>> = null;
      if (layer === 'fa') fa = await toFarsi(a.text, { route: faRoute(), mind, nllb }).catch(() => null);
      const faOk = !!fa && !fa.hits.length, key = near.agent !== null ? `a${near.agent}` : `p${near.pid}`, at = { x: near.e, y: c.camera.position.y - 0.1, z: -near.n };
      const tH = performance.now();
      const h = nv?.stats.ready ? await heardReplyNeural(nv, sim.pop, near.pid, day, a.text, c.seed, { hearIn: layer === 'fa' && !faOk ? 'en' : layer, farsi: faOk ? fa!.fa : null, agent,
        onChunk: (pcm, rate) => { if (c.world.sayPcm) c.world.sayPcm(key, pcm, rate, at); else play(pcm, rate); } }) : null;
      if (h) heard = { lang: h.lang, layer: h.layer, units: h.units.map(u => u.translit || u.gloss), text: h.text, seconds: h.seconds, backend: 'kokoro', firstMs: h.firstMs, totalMs: performance.now() - tH, fa: fa ? { route: fa.route, ms: fa.ms, hits: fa.hits } : null };
      else { const f = heardReply(sim.pop, near.pid, day, a.text, c.seed, 24000, agent); heard = { lang: f.lang, layer: 'own', units: f.units.map(u => u.translit || u.gloss), seconds: f.seconds, backend: 'formant' }; play(f.data, f.rate); }
      if (c.englishVoice || P.has('english')) { en ??= new EnglishVoice(); en.load().then(() => en!.say(a.text)).then(r => play(r.data, r.rate)).catch(() => {}); } }
    // (D-370: what the sandbox step did, out of world, under the words: taken on, taken in, heard, refused and why)
    const sb = T.sandbox ? ` <br><i>(${T.sandbox.done?.ok ? SANDBOX_DONE[T.sandbox.act.a] ?? 'done' : T.sandbox.verdict.ok ? 'they would not' : T.sandbox.verdict.why})</i>` : '';
    show((a.ok ? `<b>${L.name}</b>: ${a.text}` : `<b>${L.name}</b> <i>shrugs and turns back to the work.</i>`) + sb, `translation layer (English, out of world); heard: ${heard ? (heard.layer === 'own' ? `${heard.lang} “${heard.units.join(' … ')}” (the person's own words, tier C: not a rendering of this English)` : `${heard.layer === 'fa' ? 'Farsi' : 'English'} (opt-in, in their own voice): “${heard.text}”`) : 'nothing'}; ${((performance.now() - t0 + heardMs) / 1000).toFixed(1)} s${T.decision ? `; ${T.decision.kind}: ${T.decision.ok ? (T.decision.noop ? 'nothing to change' : 'done') : 'refused'} (${T.decision.reason})` : ''}`);
    const row = { pid: near.pid, name: L.name, d: +near.d.toFixed(2), said: text, reply: a.text, ok: a.ok, hits: a.hits, ms: performance.now() - t0 + heardMs, ttft: a.ttftMs, heard, key, ask: T.ask, tag: T.tag, decision: T.decision ? { kind: T.decision.kind, ok: T.decision.ok, reason: T.decision.reason, noop: !!T.decision.noop } : null, memory: T.memory };
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
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { input.style.display = 'none'; input.blur(); panel.style.display = 'none'; endTalk(); }
    if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim(); input.value = ''; input.style.display = 'none'; input.blur(); say(t); } });
  input.addEventListener('keyup', e => e.stopPropagation());
  // prime the model with the nearest person's life as the stranger comes near (within 6 m), so the answer costs only the question
  let primeP: Promise<any> = Promise.resolve(); let prefetchedFor = -1;
  setInterval(() => {
    // (D-315: the stranger walked away from the one they were talking with: the talk ends, the person goes back to the day)
    if (state.talking && !state.busy) { const k = state.talking, sim = c.world.people?.sim, a = sim?.pop.persons[k.pid]?.agent ?? -1, e = eye();
      const at = a >= 0 ? sim.agents[a].pos : (c.world.people?.view?.visible ?? []).find((o: any) => o.pid === k.pid); const d = at ? Math.hypot((at.e ?? at[0]) - e.e, (at.n ?? at[1]) - e.n) : Infinity; if (d > NEAR_M + 1.5) endTalk(); }
    { // D-336: the lines of the nearest person's language rendered ahead in their voice (their heard reply starts at once)
      const nv = c.world.neural, n6 = nv?.stats.ready && hearIn() === 'own' ? nearest(c.world, eye(), 6) : null;
      if (n6 && n6.pid !== prefetchedFor) { prefetchedFor = n6.pid; const sim = c.world.people.sim, { neural: v, id } = replyVoice(sim.pop, n6.pid, c.clock.dayIndex, c.seed, n6.agent !== null ? sim.agents[n6.agent] : null);
        const L = voiceLang(id.lang, id.langs).lang; nv.prefetch(v, L ? unitsFor(L).lines.slice(0, 32) : WORDLESS); } }
    if (!state.loaded || state.busy) return; const n = nearest(c.world, eye(), 6); if (!n) return; const sim = c.world.people.sim;
    const L = lifeRecord(sim.pop, sim.cal, n.pid, c.clock.dayIndex, c.clock.localHour); const mem = sim.talk.recall(n.pid, sim.t, 2);
    const knows = (sim.talk.rows.get(n.pid)?.length ?? 0) > 0 ? 'recognise' : n.agent !== null ? sim.memory.greeting(n.agent, sim.t) : mem.length ? 'nod' : 'none';
    state.busy = true; primeP = mind.prime(L, knows, prose(n.pid), mem).then(ms => { if (ms) state.log.push({ primed: n.pid, ms }); }).catch(() => mind.forget()).finally(() => { state.busy = false; }); }, 500);
  const api = { state, say, nearest: () => nearest(c.world, eye()), load: ensure, mind, hear: async (samples: number[]) => { ears ??= new Ears(); if (!(ears as any).w) await ears.load(); return ears.hear(Float32Array.from(samples)); } };
  (window as any).__converse = api; return api;
}
