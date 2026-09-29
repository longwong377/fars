// D-314 (UD-07, UD-08, UD-18; B99): the lives' prose bake on the CPU, no browser and no GPU, so it runs on the cloud box too.
// The same messages, parser and checks as the in-browser bake (src/people/converse/bake.ts, D-296), a GGUF model through
// node-llama-cpp, a JSON grammar so every reply parses, and a resumable log (one JSON line per person) so a long bake can
// stop and go on. Setup (once): npm ci --prefix tools/bake-cpu; the model file from research/MODELS_MANIFEST.json (bake_cpu).
//   npx tsx tools/bake-cpu/bake.mts [--model <gguf>] [--seed 1] [--day 150] [--n all|<k>] [--threads 8] [--log <jsonl>]
//   npx tsx tools/bake-cpu/bake.mts --write [--log <jsonl>]   (writes src/data/lives_baked_s1.json from the log's passing rows)
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { lifeRecord } from '../../src/people/converse/life';
import { bakeMessages, parseBake, checkBake, bakedWho } from '../../src/people/converse/bake';
import { buildTestSet } from '../../src/people/converse/testset';

const A = process.argv.slice(2), opt = (k: string, d: string) => { const i = A.indexOf('--' + k); return i >= 0 ? A[i + 1] : d; };
const seed = +opt('seed', '1'), day = +opt('day', '150'), log = opt('log', `T:/fars-assets-s12/lead/bake_s${seed}.jsonl`);
const modelPath = opt('model', 'T:/fars-assets-s12/lead/Qwen3-4B-Instruct-2507-Q4_K_M.gguf');

const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed), env = (t: number) => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(seed, nav, env);
const rows = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

if (A.includes('--write')) {
  // the checks again with the tree's current fence and name lists, on each record rebuilt from the sim
  const kept = rows.filter(r => r.seed === seed).map(r => { const b = parseBake(r.raw ?? ''); if (!b) return null; const check = checkBake(b, lifeRecord(S.pop, S.cal, r.pid, r.day, 12)); return check.ok ? { seed, pid: r.pid, day: r.day, model: r.model, ms: r.ms, ...b, check, name: r.name, job: r.job, who: bakedWho(S.pop.persons[r.pid]) } : null; }).filter(Boolean);
  // the rows already shipped (the session-11 browser bake) stay where this bake has no passing row of its own
  const outF = `src/data/lives_baked_s${seed}.json`, old = existsSync(outF) ? JSON.parse(readFileSync(outF, 'utf8')).rows ?? [] : [];
  const have = new Set(kept.map((r: any) => r.pid)); kept.push(...old.filter((r: any) => !have.has(r.pid)));
  const out = { _meta: { what: 'the baked prose layer of people’s lives (D-296, D-314): written offline by a local model from each person’s record (life.ts) and checked (bake.ts checkBake: the fence, names only of the record); keyed to world seed and pid; tier C', model: rows[0]?.model, seed, day, baked: rows.length, kept: kept.length, when: new Date().toISOString() }, rows: kept };
  writeFileSync(outF, JSON.stringify(out, null, 1)); console.log('kept', kept.length, 'of', rows.length);
  process.exit(0);
}

// the people: every class first (the T-E9 test set's order), then every other adult present on the day
const first = buildTestSet(S.pop, seed + 7, 300).map(c => c.pid);
const everyone = S.pop.persons.map((_: unknown, i: number) => i);
const adults = [...new Set([...first, ...everyone])].filter(pid => S.pop.ageOn(pid, day) >= 14 && S.pop.present(pid, day));
const nArg = opt('n', 'all'), todo = adults.filter(p => !rows.some(r => r.pid === p && r.seed === seed)).slice(0, nArg === 'all' ? Infinity : +nArg);
console.log(`seed ${seed} day ${day}: ${adults.length} adults, ${rows.length} baked, ${todo.length} to bake now`);

const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
const llama = await getLlama({ gpu: false });
const model = await llama.loadModel({ modelPath });
const K = +opt('par', '4'); // parallel sequences: CPU decoding is memory-bound, so K people at once cost little more than one
const context = await model.createContext({ contextSize: 2048 * K, sequences: K, threads: +opt('threads', '8') });
const str = { type: 'string' } as const;
const grammar = await llama.createGrammarForJsonSchema({ type: 'object', properties: { backstory: str, memories: { type: 'array', items: str }, hope: str, worry: str,
  opinions: { type: 'array', items: { type: 'object', properties: { name: str, view: str } } }, saying: str } } as any);
const name = modelPath.split(/[\\/]/).pop()!.replace(/\.gguf$/, '');
let ok = 0, next = 0;
const worker = async () => { const seq = context.getSequence(); while (next < todo.length) { const pid = todo[next++]; await seq.clearHistory();
    const L = lifeRecord(S.pop, S.cal, pid, day, 12), [sys, user] = bakeMessages(L), t0 = performance.now();
    const session = new LlamaChatSession({ contextSequence: seq, systemPrompt: sys.content });
    let raw = '';
    try { raw = await session.prompt(user.content, { grammar, maxTokens: 760, temperature: 0.7, topP: 0.9 }); } catch (e) { raw = ''; console.log('fail', pid, String(e).slice(0, 200)); }
    session.dispose({ disposeSequence: false });
    const b = parseBake(raw), check = b ? checkBake(b, L) : null, ms = Math.round(performance.now() - t0); if (check?.ok) ok++;
    appendFileSync(log, JSON.stringify({ seed, pid, day, model: name, ms, raw, check, name: L.name, job: (L as any).job }) + '\n');
    console.log(pid, L.name, (ms / 1000).toFixed(1), 's', check?.ok ? 'ok' : JSON.stringify(check), `(${ok} ok)`);
} };
await Promise.all(Array.from({ length: K }, worker));
