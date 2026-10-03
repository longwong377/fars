// D-296 (UD-18): speaking with the people in the world (?converse). Out of world: the typing box and the reply panel belong
// to the translation layer (English); in the world the person answers in their own voice and language (voice.ts).
//   T: type to the nearest person within 3 m;  hold V: speak (microphone; Whisper in the browser);  Esc: close.
// The model loads on the first ?converse visit (cached by the browser after it); without WebGPU nothing here runs and the
// people live as before. The simulation stays the source of truth (D-315, UD-21): the person stops and turns to the
// stranger while they talk; what the stranger asks them to do is decided by the simulation and done as new steps of their
// day (turn.ts, people/talk.ts); what passed is remembered in the save and told on to kin and friends.
import { requestOf } from './intent';
import { parseDeed } from '../deeds/parse';
import { fromModel } from '../deeds/extract';
import * as THREE from 'three/webgpu';
import { Mind, Ears, Mic, EnglishVoice } from './mind';
import { OwnMind } from './ownlines';
import { lifeRecord, type LifeRecord } from './life';
import { heardReply, heardReplyNeural, replyVoice, type HearIn } from './voice';
import { unitsFor, voiceLang, WORDLESS } from '../../audio/voices';
import { toFarsi, FarsiTranslator, type FarsiRoute } from './farsi';
import type { Turn } from './prompt';
import { talkTurn } from './turn';
import { TALK_MODEL } from './models';
import { Approaches } from './approach';
import { earshot, ambientFor, rmsDbOf, noteOverheard, EARSHOT, type Listener, type Heard } from './earshot';

/** D-370: the sandbox step as the translation layer notes it (out of world) */
const SANDBOX_DONE: Record<string, string> = { seek_work: 'taken on as a hand', meal: 'you eat with them', stay: 'taken in as a guest', join: 'taken in', petition: 'the petition will be heard', give: 'given', claim: 'they heard who you say you are', leave_stay: 'you leave the house', quit: 'you leave the work', leave_group: 'you leave them', hear: 'they say it slowly for you', buy: 'bought, after haggling', sell: 'sold, after haggling', daywork: 'taken on for the day: carry loads at the market till evening' };
// D-376 (UD-31): the default is the small model of the talk bundle (models.ts TALK_MODEL, ~285 MB); gemma-2-2b (D-296's choice on
// the T4, ~1.9 GB) stays one ?model= away for the lab's comparisons
export const DEFAULT_MODEL = TALK_MODEL;
export const NEAR_M = 3;
/** D-336: the Farsi of the opt-in layer by default: the conversation model's own Persian of its reply (measured against NLLB-600M: DECISIONS D-336) */
export const FARSI_ROUTE: FarsiRoute = 'llm';
interface Ctx { world: any; camera: THREE.Camera; clock: { dayIndex: number; localHour: number; t: number }; seed: number; englishVoice?: boolean; /** D-336: settings.hearIn (the opt-in layer) */ settings?: { hearIn?: HearIn; keys?: Record<string, string> } }
export interface Near { pid: number; agent: number | null; name: string; d: number; e: number; n: number }

/** D-370 (UD-25 (10)): everyone within r m of the eye (the people a stranger addressing a group is heard by) */
export function within(world: any, eye: { e: number; n: number }, r = 6): number[] {
  const P = world.people; if (!P) return []; const out = new Set<number>();
  for (const a of P.sim.agents) if (!a.offmap && a.pid >= 0 && Math.hypot(a.pos[0] - eye.e, a.pos[1] - eye.n) <= r) out.add(a.pid);
  for (const o of P.view?.visible ?? []) if (o.pid >= 0 && Math.hypot(o.e - eye.e, o.n - eye.n) <= r) out.add(o.pid);
  return [...out];
}
/** the nearest person within 3 m of the eye (detailed agents and the population's people drawn around the player) */
export function nearest(world: any, eye: { e: number; n: number }, r = NEAR_M): Near | null {
  const P = world.people; if (!P) return null; let best: Near | null = null;
  const consider = (pid: number, agent: number | null, e: number, n: number) => { const d = Math.hypot(e - eye.e, n - eye.n); if (d <= r && (!best || d < best.d)) best = { pid, agent, name: P.sim.pop.nameOf(pid)?.replace(/^\*/, '') ?? '', d, e, n }; };
  for (const a of P.sim.agents) if (!a.offmap && a.pid >= 0) consider(a.pid, a.id, a.pos[0], a.pos[1]);
  for (const o of P.view?.visible ?? []) if (o.pid >= 0) consider(o.pid, null, o.e, o.n);
  return best;
}
/** D-379 (UD-25): the people around the eye as listeners (detailed agents and the population's people drawn), with the way they face */
export function listeners(world: any, eye: { e: number; n: number }, r: number = EARSHOT.maxM): (Listener & { agent: number | null })[] {
  const P = world.people; if (!P) return []; const out = new Map<number, Listener & { agent: number | null }>();
  for (const a of P.sim.agents) if (!a.offmap && a.pid >= 0 && Math.hypot(a.pos[0] - eye.e, a.pos[1] - eye.n) <= r) out.set(a.pid, { pid: a.pid, agent: a.id, e: a.pos[0], n: a.pos[1], facing: a.heading });
  for (const o of P.view?.visible ?? []) if (o.pid >= 0 && !out.has(o.pid) && Math.hypot(o.e - eye.e, o.n - eye.n) <= r) out.set(o.pid, { pid: o.pid, agent: null, e: o.e, n: o.n, facing: o.heading });
  return [...out.values()];
}

export function mountConverse(c: Ctx) {
  const gpu = !!(navigator as any).gpu; const mind = new Mind(), ownMind = new OwnMind(); let ears: Ears | null = null; let en: EnglishVoice | null = null;
  const P = new URLSearchParams(location.search); const model = P.get('model') ?? DEFAULT_MODEL;
  const panel = document.createElement('div'); panel.id = 'converse';
  panel.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(720px,92vw);font:15px/1.4 Georgia,serif;color:#f1e6cf;background:rgba(20,16,11,.72);padding:10px 14px;border-radius:6px;z-index:20;display:none';
  const line = document.createElement('div'); const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'say something (Enter), Esc to close';
  input.style.cssText = 'width:100%;box-sizing:border-box;margin-top:6px;background:rgba(0,0,0,.35);color:inherit;border:1px solid #6b5a42;padding:5px;font:inherit;display:none';
  const small = document.createElement('div'); small.style.cssText = 'font:11px system-ui,sans-serif;opacity:.7;margin-top:4px';
  panel.append(line, input, small); document.body.append(panel);
  // D-720 (the holes audit #9): the player sees the words and the keys only; the out-of-world notes (what was heard, the ask's
  // verdict, timings, why the people answer in their own lines) are the dev overlay's (?debug, or F3 on)
  let devOn = P.has('debug'); addEventListener('keydown', e => { if (e.code === (c.settings?.keys?.overlay ?? 'F3')) devOn = !devOn; });
  const dev = () => devOn;
  const KEYS = 'E speak with whoever you face · T type · hold V say it aloud · Esc walk on';
  const show = (html: string, note = '') => { panel.style.display = 'block'; line.innerHTML = html; small.textContent = dev() ? note : KEYS; };
  const state = { approach: null as any, status: gpu ? 'idle' : 'no WebGPU: the people answer in their own lines', progress: 0, loaded: false, busy: false, last: null as any, history: new Map<number, Turn[]>(), log: [] as any[], /** D-315: the conversation in progress (person, its id) */ talking: null as null | { pid: number; conv: number; r: number }, /** D-379: the last words as the world heard them (who heard, the one spoken to, who turned to look; the render side reads it) */ heard: null as null | (Heard & { t: number; words: string }) };
  /** D-315: the conversation ends (the stranger walks off or closes the talk): the person goes back to the day */
  const endTalk = () => { const k = state.talking; if (!k) return; state.talking = null; c.world.people?.sim?.talk.release(k.pid, c.world.people.sim.t); };
  // (D-720, W22: the baked prose of seed 1 (D-296) is gone: it was junk under D-348's gate (a two-year-old remembering brickmaking,
  // a married seven-year-old); the life record is the simulation's own. A new bake (tools/dev/bake_lives.mjs) can come back here)
  const prose = (_pid: number): string | null => null;
  // D-336: the opt-in layer (settings.hearIn; ?hear=fa|en for tests) and the route of its Farsi (?farsi=llm|nllb; D-336 measured)
  const hearIn = (): HearIn => (P.get('hear') as HearIn | null) ?? c.settings?.hearIn ?? 'own';
  const faRoute = (): FarsiRoute => (P.get('farsi') as FarsiRoute | null) ?? FARSI_ROUTE; const nllb = new FarsiTranslator();
  let audio: AudioContext | null = null;
  const play = (data: Float32Array, rate: number) => { audio ??= new AudioContext(); const b = audio.createBuffer(1, data.length, rate); b.getChannelData(0).set(data); const s = audio.createBufferSource(); s.buffer = b; s.connect(audio.destination); s.start(); };
  const eye = () => ({ e: c.camera.position.x, n: -c.camera.position.z });
  /** D-720: the person the stranger faces within reach (in front, within about 45°), if any */
  const facing = (): Near | null => { const E = eye(), y = yaw() * Math.PI / 180; let best: Near | null = null;
    for (const pid of within(c.world, E, NEAR_M)) { const L = listeners(c.world, E, NEAR_M).find(l => l.pid === pid); if (!L) continue; const de = L.e - E.e, dn = L.n - E.n, d = Math.hypot(de, dn);
      if (d > 0.2 && (de * Math.sin(y) + dn * Math.cos(y)) / d < 0.7) continue; if (!best || d < best.d) best = { pid, agent: L.agent, name: c.world.people.sim.pop.nameOf(pid)?.replace(/^\*/, '') ?? '', d, e: L.e, n: L.n }; }
    return best; };
  /** the way the stranger faces (compass degrees: 0 = north, +n) */
  const yaw = () => { const v = new THREE.Vector3(); c.camera.getWorldDirection(v); return ((Math.atan2(v.x, -v.z) * 180 / Math.PI) + 360) % 360; };
  /** D-379 (UD-25): the words carry by loudness and distance: who hears, the one spoken to (named, faced, else nearest who
   *  hears clearly), the bystanders who overhear (a memory row each), who turns to look on a shout */
  function hear(text: string, rmsDb?: number): { H: Heard; near: Near | null } {
    const sim = c.world.people?.sim, E = eye(), L = listeners(c.world, E);
    const H = earshot(L, { ...E, yawDeg: yaw() }, text, pid => sim?.pop.nameOf(pid), { rmsDb, ambientDb: ambientFor(c.clock.localHour) });
    state.heard = { ...H, t: sim?.t ?? 0, words: text };
    // D-395: the heads of those in earshot turn to a shout (crowd.ts plays it: react.ts 'turn')
    if (H.look.length) c.world.people?.crowd?.reactions?.fromHeard(H.look, [c.camera.position.x, c.camera.position.y, c.camera.position.z]);
    const to = H.to ? L.find(l => l.pid === H.to!.pid)! : null;
    return { H, near: to ? { pid: to.pid, agent: to.agent, name: sim.pop.nameOf(to.pid)?.replace(/^\*/, '') ?? '', d: H.to!.d, e: to.e, n: to.n } : null };
  }
  // D-376 (UD-31): the model streams in after the world is shown (preload, from main.ts after the first frames), quietly: no
  // loading UI in the world; the progress is in the out-of-world status only. A WebGPU adapter that cannot hold the model
  // (no adapter, or a buffer limit under the model's largest shard) leaves the people answering in their own lines
  let loading: Promise<boolean> | null = null; let loadTries = 0;
  async function fits(): Promise<boolean> {
    try { const ad = await (navigator as any).gpu?.requestAdapter(); if (!ad) return false; return (ad.limits?.maxBufferSize ?? 0) >= 256 * 1024 * 1024 && (ad.limits?.maxStorageBufferBindingSize ?? 0) >= 128 * 1024 * 1024; } catch { return false; }
  }
  function ensure(): Promise<boolean> {
    if (state.loaded || !gpu) return Promise.resolve(state.loaded);
    return loading ??= (async () => { if (!(await fits())) { state.status = 'this GPU cannot hold the model: the people answer in their own lines'; return false; }
      state.status = 'loading';
      try { await mind.load(model, p => { state.progress = p.progress; }); state.loaded = true; state.status = 'ready'; return true; }
      catch (e) { state.status = `the model did not load: ${String(e).slice(0, 120)}`; loading = null;
        // (s15/ship D-393: a fetch from Hugging Face's CDN failed once on a cold visit under load: tried again, three times, 20 s apart)
        if (++loadTries < 4) setTimeout(() => void ensure(), 20_000); return false; } })();
  }
  /** say `text` to the nearest person: the answer (translation layer) and the heard reply (their own voice) */
  async function say(text: string, heardMs = 0, rmsDb?: number): Promise<any> {
    // D-379: the one spoken to by earshot (the nearest within 3 m when the people are not drawn as listeners)
    const E = hear(text, rmsDb); const near = E.near ?? (E.H.loudness === 'whisper' ? null : nearest(c.world, eye()));
    if (!near) { show(E.H.heard.length ? '<i>They hear a voice, but not your words.</i>' : '<i>No one is near enough to hear you.</i>'); return null; }
    { const sim = c.world.people.sim; noteOverheard(sim.talk, E.H, sim.t, state.talking?.pid === near.pid ? state.talking.conv : sim.t, text); }
    // D-376: before the model is ready (or where it cannot run) the person still answers: a line of their own in their own
    // language and voice, chosen by how often they have met the stranger; never a loading screen in the world
    // D-720: they answer from their own life (ownlines.ts) through the same turn as the model: the asks, deeds, memory and gossip
    // are the simulation's either way (the three stock glosses answered 150 of 150 questions in the follow-thirty audit)
    const own = !state.loaded; if (own) void ensure(); const m = own ? ownMind : mind;
    const sim = c.world.people.sim; const day = c.clock.dayIndex, hour = c.clock.localHour;
    const L: LifeRecord = lifeRecord(sim.pop, sim.cal, near.pid, day, hour);
    const key = near.agent ?? -1 - near.pid;
    const hist = state.history.get(near.pid) ?? [];
    if (state.talking?.pid !== near.pid) { endTalk(); state.talking = { pid: near.pid, conv: sim.t, r: Math.max(NEAR_M, near.d) }; }
    if (!own) await primeP; state.busy = true; show(`<b>${L.name}</b> <i>…</i>`, 'translation layer');
    // (D-315: the words and the deed together: the pause, the memory, the ask decided by the simulation, the memory row)
    // D-370 (UD-25 (10)): words to a group ("everyone", "all of you", "good people") reach every house within earshot: a claim
    // or news is heard by all of them; an ask is answered by the first house that would (the nearest person speaks)
    if (/^\s*(everyone|all of you|good people|friends|listen|people of)/i.test(text)) { const clear = E.H.heard.filter(h => h.clear).map(h => h.pid), others = (clear.length ? clear : within(c.world, eye())).filter(p => p !== near.pid);
      for (const g of c.world.people.sim.strangerAskGroup(others, text)) if (g.verdict.ok && (g.act.a === 'claim' || g.act.a === 'hear')) c.world.people.sim.strangerDo(g.act); }
    const t0 = performance.now(); const ap = state.approach && state.approach.pid === near.pid ? state.approach.opening : undefined; if (ap) state.approach = null;
    // D-459 (UD-32): words the grammar reads as no deed and no ask, and that are not a plain question, are read by the model as a
    // deed (any deed: the world and the person decide it in the turn)
    const hourNow = sim.t - Math.floor(sim.t / 24) * 24;
    const mdj = mind.engine && !/\?\s*$/.test(text) && !requestOf(text) && !sim.strangerAsk(near.pid, text) && !parseDeed(text, 'player', { addressee: near.pid, hour: hourNow }) ? await mind.readDeed(text) : null;
    const mdeed = mdj ? fromModel(mdj, 'player', { addressee: near.pid, hour: hourNow, said: text, named: w => sim.namedIn(w, near.pid) }) : null;
    const T = await talkTurn(m, sim, near.pid, text, { conv: state.talking!.conv, history: hist, prose: prose(near.pid), approached: ap, deed: mdeed }); const a = T.answer; state.busy = false;
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
      // (D-720: every voice at the speaker, through the world's mixer: volume, reverb and place; the bare context only without a world)
      else { const f = heardReply(sim.pop, near.pid, day, a.text, c.seed, 24000, agent); heard = { lang: f.lang, layer: 'own', units: f.units.map(u => u.translit || u.gloss), seconds: f.seconds, backend: 'formant' }; if (c.world.sayPcm) c.world.sayPcm(key, f.data, f.rate, at); else play(f.data, f.rate); }
      if (c.englishVoice || P.has('english')) { en ??= new EnglishVoice(); en.load().then(() => en!.say(a.text)).then(r => { if (c.world.sayPcm) c.world.sayPcm(key, r.data, r.rate, at); else play(r.data, r.rate); }).catch(() => {}); } }
    // (D-370: what the sandbox step did, out of world, under the words: taken on, taken in, heard, refused and why)
    const sb = T.sandbox ? ` <br><i>(${T.sandbox.done?.ok ? SANDBOX_DONE[T.sandbox.act.a] ?? 'done' : T.sandbox.verdict.ok ? 'they would not' : T.sandbox.verdict.why})</i>` : '';
    // D-459: an open deed's outcome, out of world (what was done, or why not)
    const dd = T.deed ? ` <br><i>(${T.deed.done?.out.ok ? `${T.deed.deed.verb.replace(/_/g, ' ')}${T.deed.deed.act ? `: ${T.deed.deed.act.replace(/_/g, ' ')}` : ''}: done` : T.deed.out.ok ? 'they would not' : T.deed.out.why})</i>` : '';
    show((a.ok ? `<b>${L.name}</b>: ${a.text}` : `<b>${L.name}</b> <i>shrugs and turns back to the work.</i>`) + sb + dd, `translation layer (English, out of world)${own ? ownNote() : ''}; heard: ${heard ? (heard.layer === 'own' ? `${heard.lang} “${heard.units.join(' … ')}” (the person's own words, tier C: not a rendering of this English)` : `${heard.layer === 'fa' ? 'Farsi' : 'English'} (opt-in, in their own voice): “${heard.text}”`) : 'nothing'}; ${((performance.now() - t0 + heardMs) / 1000).toFixed(1)} s${T.decision ? `; ${T.decision.kind}: ${T.decision.ok ? (T.decision.noop ? 'nothing to change' : 'done') : 'refused'} (${T.decision.reason})` : ''}`);
    const row = { pid: near.pid, name: L.name, d: +near.d.toFixed(2), said: text, reply: a.text, ok: a.ok, hits: a.hits, ms: performance.now() - t0 + heardMs, ttft: a.ttftMs, heard, key, ask: T.ask, tag: T.tag, decision: T.decision ? { kind: T.decision.kind, ok: T.decision.ok, reason: T.decision.reason, noop: !!T.decision.noop } : null, memory: T.memory, ...(own ? { own: true } : {}) };
    state.last = row; state.log.push(row); return row;
  }
  /** D-590 (C5, assigned by the cloud lead): why the person answered in their own lines, said honestly (out of world) */
  const ownNote = () => { const st = state.status ?? '';
    if (st === 'loading') return `; the talk is still arriving (${(state.progress * 100).toFixed(0)} %): until it does, the people answer from their own lines`;
    if (/did not load/.test(st)) return '; the talk could not be fetched in this browser, so the people answer from their own lines (reload to try again)';
    if (/cannot hold|no WebGPU/.test(st)) return '; this graphics card cannot run the talk, so the people answer from their own lines';
    return ''; };
  /** D-376: begin streaming the model in (main.ts calls it after the first frames; idempotent) */
  const preload = () => { if (gpu) void ensure(); };
  const mic = new Mic(); let recording = false;
  addEventListener('keydown', e => {
    if (e.target === input) return;
    // D-720 (the holes audit #9): E (the interact key) speaks with whoever the stranger faces within reach, anyone of the
    // population, not only the detailed agents: a greeting first, then the words are theirs to type or say; a door faced with
    // no one before it is still E's (main.ts onInteract)
    if (e.code === (c.settings?.keys?.interact ?? 'KeyE') && !e.repeat) { const n = facing(); if (n) { e.preventDefault(); e.stopImmediatePropagation();
      if (state.talking?.pid !== n.pid && !state.busy) void say('Greetings.');
      panel.style.display = 'block'; input.style.display = 'block'; input.focus(); return; } }
    if (e.code === 'KeyT' && !e.repeat) { panel.style.display = 'block'; input.style.display = 'block'; input.focus(); e.preventDefault(); e.stopPropagation(); }
    if (e.code === 'KeyV' && !e.repeat && !recording && gpu) { recording = true; show('<i>(listening)</i>'); mic.start().catch(err => { recording = false; show(`<i>no microphone: ${err}</i>`); }); }
  }, true);
  addEventListener('keyup', async e => {
    if (e.code !== 'KeyV' || !recording) return; recording = false;
    const s = await mic.stop(); if (s.length < 3200) { show('<i>(too short)</i>'); return; }
    ears ??= new Ears(); if (!(ears as any).w) await ears.load();
    const h = await ears.hear(s); show(`<i>you:</i> ${h.text}`); if (h.text) say(h.text, h.ms, rmsDbOf(s));
  });
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { input.style.display = 'none'; input.blur(); panel.style.display = 'none'; endTalk(); }
    if (e.key === 'Enter' && input.value.trim()) { const t = input.value.trim(); input.value = ''; input.style.display = 'none'; input.blur(); say(t); } });
  input.addEventListener('keyup', e => e.stopPropagation());
  // prime the model with the nearest person's life as the stranger comes near (within 6 m), so the answer costs only the question
  let primeP: Promise<any> = Promise.resolve(); let prefetchedFor = -1;
  // D-375: someone may come up to the stranger (their house's need, or a friendly house's invitation: approach.ts), checked every
  // few seconds among the people within 15 m while no talk is going on; they stop and turn, and the panel says who and what
  let approaches: Approaches | null = null; let approachAt = 0;
  setInterval(() => {
    if (!state.talking && !state.busy && c.world.people?.sim && performance.now() - approachAt > 4000) { approachAt = performance.now();
      const sim = c.world.people.sim; approaches ??= new Approaches(sim); const a = approaches.next(within(c.world, eye(), 15));
      if (a) { sim.talkAddressed(a.pid); state.talking = { pid: a.pid, conv: sim.t, r: 15 } as any; state.approach = a;
        show(`<b>${sim.pop.nameOf(a.pid)?.replace(/^\*/, '') ?? 'Someone'}</b> <i>${a.opening}.</i>`, 'translation layer (out of world): answer, or walk on'); } }
    // (D-315: the stranger walked away from the one they were talking with: the talk ends, the person goes back to the day)
    if (state.talking && !state.busy) { const k = state.talking, sim = c.world.people?.sim, a = sim?.pop.persons[k.pid]?.agent ?? -1, e = eye();
      const at = a >= 0 ? sim.agents[a].pos : (c.world.people?.view?.visible ?? []).find((o: any) => o.pid === k.pid); const d = at ? Math.hypot((at.e ?? at[0]) - e.e, (at.n ?? at[1]) - e.n) : Infinity; if (d > k.r + 1.5) endTalk(); }
    { // D-336: the lines of the nearest person's language rendered ahead in their voice (their heard reply starts at once)
      const nv = c.world.neural, n6 = nv?.stats.ready && hearIn() === 'own' ? nearest(c.world, eye(), 6) : null;
      if (n6 && n6.pid !== prefetchedFor) { prefetchedFor = n6.pid; const sim = c.world.people.sim, { neural: v, id } = replyVoice(sim.pop, n6.pid, c.clock.dayIndex, c.seed, n6.agent !== null ? sim.agents[n6.agent] : null);
        const L = voiceLang(id.lang, id.langs).lang; nv.prefetch(v, L ? unitsFor(L).lines.slice(0, 32) : WORDLESS); } }
    if (!state.loaded || state.busy) return; const n = nearest(c.world, eye(), 6); if (!n) return; const sim = c.world.people.sim;
    const L = lifeRecord(sim.pop, sim.cal, n.pid, c.clock.dayIndex, c.clock.localHour); const mem = sim.talk.recall(n.pid, sim.t, 2);
    const knows = (sim.talk.rows.get(n.pid)?.length ?? 0) > 0 ? 'recognise' : n.agent !== null ? sim.memory.greeting(n.agent, sim.t) : mem.length ? 'nod' : 'none';
    state.busy = true; primeP = mind.prime(L, knows, prose(n.pid), mem).then(ms => { if (ms) state.log.push({ primed: n.pid, ms }); }).catch(() => mind.forget()).finally(() => { state.busy = false; }); }, 500);
  const api = { state, say, preload, nearest: () => nearest(c.world, eye()), load: ensure, mind, hear: async (samples: number[]) => { ears ??= new Ears(); if (!(ears as any).w) await ears.load(); return ears.hear(Float32Array.from(samples)); } };
  (window as any).__converse = api; return api;
}
