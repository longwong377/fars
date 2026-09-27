// Dev page (converse.html, not part of the game; D-296): the people's simulation without the renderer, one person's life,
// and the in-browser model stacks, measured: the language models (load, first-token time, tokens/s), speech recognition,
// the English voice, the T-E9 test set and the bake of the lives. Test API: window.__lab (tests/e2e/converse.spec.ts).
import { NavGrid } from '../people/navgrid';
import { PeopleSim, type Env } from '../people/sim';
import { WeatherSystem } from '../weather/weatherState';
import { lifeRecord, lifeBrief, type LifeRecord } from '../people/converse/life';
import { Mind, Ears, EnglishVoice, Mic } from '../people/converse/mind';
import { LLMS } from '../people/converse/models';
import { buildTestSet, score, type Scored } from '../people/converse/testset';
import { heardReply } from '../people/converse/voice';
import { systemPrompt } from '../people/converse/prompt';
import { bakeMessages, parseBake, checkBake, type Baked } from '../people/converse/bake';
import { buildTalkSet, runTalkSet } from '../people/converse/talkset';
import { talkOpts } from '../people/converse/turn';
import { groundFact } from '../people/converse/ground';

const $ = (id: string) => document.getElementById(id)!;
const P = new URLSearchParams(location.search);
const SEED = +(P.get('seed') ?? 1);
let sim: PeopleSim | null = null; let make: (() => PeopleSim) | null = null;
async function world() {
  if (sim) return sim;
  const bin = (p: string) => fetch('/' + p).then(r => r.arrayBuffer());
  const nav = await NavGrid.load(bin);
  const W = new WeatherSystem(SEED), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  make = () => new PeopleSim(SEED, nav, env); sim = make(); return sim;
}
const mind = new Mind(); let ears: Ears | null = null; let voice: EnglishVoice | null = null;
const rec = async (pid: number, day: number, hour: number) => { const S = await world(); return lifeRecord(S.pop, S.cal, pid, day, hour); };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };

const lab = {
  ready: false, errors: [] as string[],
  adapter: async () => { const a = await (navigator as any).gpu?.requestAdapter(); if (!a) return null; const i = a.info ?? {}; return { vendor: i.vendor, arch: i.architecture, device: i.device, desc: i.description, f16: a.features.has('shader-f16'), maxBuf: a.limits.maxBufferSize, maxStorage: a.limits.maxStorageBufferBindingSize }; },
  world: async () => { const t0 = performance.now(); const S = await world(); return { ms: performance.now() - t0, persons: S.pop.persons.length }; },
  life: async (pid: number, day: number, hour: number) => { const L = await rec(pid, day, hour); return { L, brief: lifeBrief(L), system: systemPrompt(L, 'none') }; },
  models: () => LLMS.map(m => m.id),
  load: async (model: string) => { const r = await mind.load(model, p => { $('status').textContent = `${(p.progress * 100).toFixed(0)}% ${p.text.slice(0, 80)}`; }); $('status').textContent = `${model} loaded in ${(r.ms / 1000).toFixed(1)} s`; return r; },
  /** a raw completion (diagnosis): the messages as given */
  raw: async (msgs: any[], max = 32) => { const t0 = performance.now(); const r = await mind.engine!.chat.completions.create({ messages: msgs, max_tokens: max, temperature: 0 } as any) as any; return { text: r.choices[0].message.content, usage: r.usage, ms: performance.now() - t0 }; },
  /** empty the browser's model caches (one profile holds a few models before its quota is spent) */
  clearCache: async () => { const k = await caches.keys(); for (const n of k) await caches.delete(n); return k; },
  unload: async () => { await mind.unload(); return true; },
  ask: async (pid: number, day: number, hour: number, said: string, history: any[] = []) => { const L = await rec(pid, day, hour); return mind.answer(L, 'none', history, said); },
  /** the language model's bench: n answers of the test set's first people (the same prompts for every model) */
  benchLLM: async (n = 12) => {
    const S = await world(); const T = buildTestSet(S.pop, SEED, Math.max(n, 12)).slice(0, n); const rows: any[] = [];
    for (const c of T) { const L = lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour); const a = await mind.answer(L, 'none', [], c.prompt); rows.push({ primeMs: a.primeMs, kind: c.kind, job: c.job, prompt: c.prompt, reply: a.text, ms: a.totalMs, ttft: a.ttftMs, tokens: a.tokens, prefillTps: a.prefillTps, decodeTps: a.decodeTps, tries: a.tries, ok: a.ok, hits: a.hits }); }
    return { model: mind.model, n: rows.length, msMedian: median(rows.map(r => r.ms)), msP90: pct(rows.map(r => r.ms), 0.9), ttftMedian: median(rows.map(r => r.ttft)), decodeTps: median(rows.map(r => r.decodeTps)), prefillTps: median(rows.map(r => r.prefillTps)), tokensMedian: median(rows.map(r => r.tokens)), fenceFails: rows.filter(r => !r.ok).length, retries: rows.filter(r => r.tries > 1).length, rows };
  },
  /** T-E9: the whole seeded set, typed (or through speech recognition when `spoken` gives each case's 16 kHz samples) */
  testSet: async (n = 72, from = 0, to = 1e9) => {
    const S = await world(); const T = buildTestSet(S.pop, SEED, n).slice(from, to); const out: Scored[] = [];
    for (const c of T) { const L = lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour); const a = await mind.answer(L, 'none', [], c.prompt, null, 64, talkOpts.pick ? { ground: groundFact(L, c.prompt) } : {}); out.push({ ...score(c, L, a.text, a.totalMs, a.ttftMs, a.tries, a.ok), primeMs: a.primeMs, raw: a.raw, tokens: a.tokens } as any); }
    return out;
  },
  /** D-315 (T-E10): the request-and-recall set with the loaded model: requests [from, to) of the seeded set and their recalls,
   *  the requests in one world, the recalls in the save reloaded into another (talkset.ts runTalkSet) */
  /** D-315: where the memory goes ('near' | 'top': turn.ts talkOpts) */
  memoryMode: (m: 'near' | 'top') => { talkOpts.memory = m; return m; },
  /** D-315: the picked facts and the judge on or off (turn.ts talkOpts.pick; testSet's life fact) */
  pick: (on: boolean) => { talkOpts.pick = on; return on; },
  talkSet: async (n = 64, from = 0, to = 1e9) => { const S = await world(); const all = buildTalkSet(S.pop, S.cal, SEED, n);
    const keep = (c: { i: number; kind: string; of?: number }) => c.kind === 'recall' || c.kind === 'heard' ? c.of! >= from && c.of! < to : c.i >= from && c.i < to;
    const r = await runTalkSet(mind, make!, all.filter(keep), s => { $('status').textContent = s; }); const { world: _w, ...rest } = r; void _w;
    return { model: mind.model, ...rest, res: r.res.map(x => ({ i: x.c.i, kind: x.c.kind, job: x.c.job, say: x.c.say, reply: x.reply, deed: x.deed, pass: x.pass, why: x.why, ms: x.ms, memory: x.memory, raw: x.raw })) }; },
  cases: async (n = 72) => { const S = await world(); return buildTestSet(S.pop, SEED, n); },
  /** a spoken case: the samples go through speech recognition, then the person answers; the time is both together */
  spoken: async (i: number, samples: number[], n = 72) => {
    const S = await world(); const c = buildTestSet(S.pop, SEED, n)[i]; const L = lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour);
    const primeMs = await mind.prime(L, 'none'); const t0 = performance.now(); const h = await ears!.hear(Float32Array.from(samples)); const a = await mind.answer(L, 'none', [], h.text);
    const s = score(c, L, a.text, performance.now() - t0, a.ttftMs + h.ms, a.tries, a.ok); return { ...s, asr: h.text, asrMs: h.ms, primeMs };
  },
  loadEars: async (model?: string, dtype?: any) => { ears?.dispose(); ears = new Ears(); return ears.load(model, dtype); },
  hear: async (samples: number[]) => ears!.hear(Float32Array.from(samples)),
  loadVoice: async (dtype?: string, device?: string) => { voice?.dispose(); voice = new EnglishVoice(); return voice.load(dtype, device); },
  say: async (text: string) => { const r = await voice!.say(text); return { ms: r.ms, seconds: r.data.length / r.rate, rate: r.rate, rms: Math.sqrt(r.data.reduce((a, x) => a + x * x, 0) / r.data.length) }; },
  /** the heard reply (the person's own language: attested or composed lines from the lexicon and wordless voice) */
  heard: async (pid: number, day: number, hour: number, english: string) => { const S = await world(); const h = heardReply(S.pop, pid, day, english, SEED); return { units: h.units.map(u => ({ id: u.id, translit: u.translit, gloss: u.gloss, tier: u.tier })), seconds: h.seconds, lang: h.lang, rms: h.rms }; },
  /** the bake (tools/dev/bake_lives.ts): one person's memories written by the loaded model from their record */
  bake: async (pid: number, day: number) => { const L = await rec(pid, day, 12); const t0 = performance.now();
    const r = await mind.engine!.chat.completions.create({ messages: bakeMessages(L), max_tokens: 420, temperature: 0.7, top_p: 0.9 } as any) as any;
    const raw = r.choices[0].message.content as string; const b: Baked | null = parseBake(raw); return { pid, raw, baked: b, check: b ? checkBake(b, L) : null, ms: performance.now() - t0, record: L }; },
  /** the people of the bake: adults present on the day, seeded, every class in turn */
  bakePeople: async (n: number, day: number) => { const S = await world(); const T = buildTestSet(S.pop, SEED + 7, n * 3).filter(c => S.pop.ageOn(c.pid, day) >= 14 && S.pop.present(c.pid, day)); return [...new Set(T.map(c => c.pid))].slice(0, n); },
};
(window as any).__lab = lab;
addEventListener('error', e => lab.errors.push(String(e.message)));
addEventListener('unhandledrejection', e => lab.errors.push(String((e as any).reason)));

// the page's own controls (for a person trying it by hand)
const sel = $('model') as HTMLSelectElement; for (const m of LLMS) sel.add(new Option(m.id, m.id));
$('load').onclick = () => lab.load(sel.value).catch(e => { $('status').textContent = String(e); });
let L: LifeRecord | null = null; const hist: any[] = [];
const cur = async () => { L = await rec(+($('pid') as HTMLInputElement).value, +($('day') as HTMLInputElement).value, +($('hour') as HTMLInputElement).value); $('life').textContent = lifeBrief(L); return L; };
$('who').onclick = () => { hist.length = 0; cur(); };
const answer = async (said: string) => { const R = L ?? await cur(); const a = await mind.answer(R, 'none', hist, said); hist.push({ role: 'user', content: said }, { role: 'assistant', content: a.text });
  const d = document.createElement('p'); d.innerHTML = `<b>you:</b> ${said}<br><span class="reply">${R.name}: ${a.text}</span> <small>(${(a.totalMs / 1000).toFixed(1)} s${a.ok ? '' : ', fence: ' + a.hits.map(h => h.term).join(',')})</small>`; $('out').prepend(d); };
$('ask').onclick = () => { const s = ($('said') as HTMLInputElement).value; ($('said') as HTMLInputElement).value = ''; answer(s); };
const mic = new Mic(); $('mic').onpointerdown = () => mic.start(); $('mic').onpointerup = async () => { const a = await mic.stop(); if (!ears) { ears = new Ears(); await ears.load(); } const h = await ears.hear(a); answer(h.text); };
world().then(() => { lab.ready = true; $('status').textContent = 'world ready; no model'; });
