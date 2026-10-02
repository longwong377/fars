// D-456: the shipped talk model over the real briefs, at scale. ~200 people of seeds 1 and 7 (ages, jobs, zones), each met
// by the stranger for five turns through the game's own path (converse/turn.ts talkTurn -> mind.ts: the prime, the notes,
// the ground fact, the fence retry, the judge), the model calls sent to the CPU runner of the exact MLC weights
// (tools/dev/talkeval/qwen_mlc.py serve). Writes one JSON line per turn; score.ts reads them.
//   python3 tools/dev/talkeval/qwen_mlc.py <mlc dir> serve 8765 &
//   npx tsx tools/dev/talkeval/run.ts <out.jsonl> [people=200] [workers=10] [url=http://127.0.0.1:8765]
import { writeFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { simAt } from '../../../tests/sim_fixture';
import { Mind } from '../../../src/people/converse/mind';
import { talkTurn, type TurnOut } from '../../../src/people/converse/turn';
import { lifeRecord } from '../../../src/people/converse/life';
import { systemPrompt, approxTokens } from '../../../src/people/converse/prompt';
import { u01, salt } from '../../../src/people/hash';
import type { PeopleSim } from '../../../src/people/sim';

const [out = 'talk_eval.jsonl', nPeople = '200', nWorkers = '10', url = 'http://127.0.0.1:8765'] = process.argv.slice(2);
const SETS = [{ seed: 1, day: 150, hour: 11 }, { seed: 7, day: 150, hour: 16 }];
/** what the stranger says: greeting, family, work, home (an ask), and one thing the person cannot know (rotated) */
const UNKNOWABLE = ['Who will be king after Xerxes?', 'What will become of King Xerxes and his Terrace?', 'Have you heard of the city of Rome?',
  'How many soldiers does the king have in all his lands?', 'What is the name of the king of the Indians?', 'What did the king eat this morning?'];
const turnsFor = (k: number): [string, string][] => [['greet', 'Greetings, friend. Who are you?'], ['family', 'Tell me about your family. Who lives in your house?'],
  ['work', 'What work do you do?'], ['home', 'Where do you live? Will you take me to your house?'], ['unknowable', UNKNOWABLE[k % UNKNOWABLE.length]]];

/** an engine with WebLLM's call shape (the parts mind.ts uses) over the CPU runner; every call logged into `calls` */
function httpEngine(calls: any[]) {
  return { chat: { completions: { create: async (req: any) => {
    const msgs = req.messages, seed = parseInt(createHash('sha1').update(JSON.stringify(msgs)).digest('hex').slice(0, 8), 16);
    const body = { messages: msgs, max_tokens: req.max_tokens ?? 64, temperature: req.temperature ?? 0.7, top_p: req.top_p ?? 0.8, frequency_penalty: req.frequency_penalty ?? 0, presence_penalty: req.presence_penalty ?? 0, repetition_penalty: 1.1, seed };
    const t0 = Date.now(); const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) }); const j: any = await r.json();
    calls.push({ kind: msgs[0]?.role === 'system' && /^You are a person of Parsa/.test(msgs[0].content) ? 'talk' : 'judge', last: msgs[msgs.length - 1].content, text: j.text, ms: Date.now() - t0, ...j });
    const usage = { completion_tokens: j.completion_tokens, prompt_tokens: j.prompt_tokens, extra: { prefill_tokens_per_s: (j.prompt_tokens - j.cached_tokens) / Math.max(j.prefill_s, 1e-6), decode_tokens_per_s: j.completion_tokens / Math.max(j.total_s - j.ttft_s, 1e-6) } };
    if (req.stream) return (async function* () { yield { choices: [{ delta: { content: j.text } }] }; yield { choices: [], usage }; })();
    return { choices: [{ message: { content: j.text } }], usage };
  } } } };
}

/** ~n/2 people of a seed: present, eight or older, spread over zones, jobs and ages by a keyed draw (round-robin over strata) */
function pick(sim: PeopleSim, day: number, n: number): number[] {
  const P = sim.pop, band = (a: number) => a < 14 ? 'child' : a < 30 ? 'young' : a < 50 ? 'adult' : 'old', strata = new Map<string, number[]>();
  for (const p of P.persons) { if (!P.present(p.id, day)) continue; const a = P.ageOn(p.id, day); if (a < 8) continue;
    const k = `${p.zone}|${p.job}|${band(a)}`; if (!strata.has(k)) strata.set(k, []); strata.get(k)!.push(p.id); }
  for (const v of strata.values()) v.sort((a, b) => u01(sim.seed, salt('talkeval'), a) - u01(sim.seed, salt('talkeval'), b));
  const keys = [...strata.keys()].sort((a, b) => u01(sim.seed, salt('talkeval-k'), a.length * 997 + a.charCodeAt(0) + a.charCodeAt(a.length - 1) * 31) - u01(sim.seed, salt('talkeval-k'), b.length * 997 + b.charCodeAt(0) + b.charCodeAt(b.length - 1) * 31) || a.localeCompare(b));
  const outp: number[] = []; for (let r = 0; outp.length < n; r++) { let any = false; for (const k of keys) { const v = strata.get(k)!; if (v[r] !== undefined) { any = true; outp.push(v[r]); if (outp.length >= n) break; } } if (!any) break; }
  return outp;
}

async function main() {
  writeFileSync(out, ''); const t00 = Date.now(); let done = 0;
  for (const S of SETS) {
    const sim = simAt(S.seed, S.day, S.hour, { asks: true }); sim.econTo(S.day + 1); sim.t = S.day * 24 + S.hour;
    const people = pick(sim, S.day, Math.ceil(Number(nPeople) / SETS.length)); let next = 0;
    console.log(`seed ${S.seed}: ${people.length} people`);
    const worker = async () => {
      while (next < people.length) {
        const k = next++, pid = people[k], p = sim.pop.persons[pid], calls: any[] = [], m = new Mind(); (m as any).engine = httpEngine(calls); m.model = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
        const L = lifeRecord(sim.pop, sim.cal, pid, S.day, S.hour), sys = systemPrompt(L, 'none');
        const facts = { name: L.name, byname: L.byname, sex: L.sex, age: L.age, job: p.job, sub: p.sub, zone: p.zone, work: L.job, home: L.home, origin: L.origin,
          household: L.household.map(h => ({ name: h.name, rel: h.rel, age: h.age })), friends: L.friends.map(f => f.name), kinHouses: L.kinHouses, sysTokens: approxTokens(sys) };
        const conv = sim.t; const history: { role: 'user' | 'assistant'; content: string }[] = [];
        for (const [kind, said] of turnsFor(k + S.seed)) {
          const c0 = calls.length; let o: TurnOut;
          try { o = await talkTurn(m, sim, pid, said, { conv, history }); } catch (e) { appendFileSync(out, JSON.stringify({ seed: S.seed, pid, kind, said, error: String(e) }) + '\n'); continue; }
          history.push({ role: 'user', content: said }, { role: 'assistant', content: o.answer.text });
          const mine = calls.slice(c0);
          appendFileSync(out, JSON.stringify({ seed: S.seed, pid, kind, said, facts, system: (m as any).conv?.[0]?.content ?? sys, text: o.answer.text, raw: o.answer.raw, ok: o.answer.ok, hits: o.answer.hits, tries: o.answer.tries,
            tag: o.tag, request: o.request, ask: o.ask, decision: o.decision ? { ok: o.decision.ok, kind: o.decision.kind, reason: o.decision.reason } : null, saidNo: o.saidNo, retold: o.retold, judged: o.judged ?? null, refused: o.refused ?? null, sandbox: o.sandbox ? { a: o.sandbox.act.a, ok: o.sandbox.verdict.ok } : null,
            calls: mine.map(c => ({ kind: c.kind, last: c.last, text: c.text, tok: c.completion_tokens, ptok: c.prompt_tokens, cached: c.cached_tokens, prefill_s: c.prefill_s, total_s: c.total_s, ttft_s: c.ttft_s, batch: c.batch })) }) + '\n');
        }
        done++; if (done % 10 === 0) console.log(`${done} people, ${((Date.now() - t00) / 60000).toFixed(1)} min`);
      }
    };
    await Promise.all(Array.from({ length: Number(nWorkers) }, worker));
  }
  console.log(`done: ${done} people in ${((Date.now() - t00) / 60000).toFixed(1)} min`);
}
main();
