// D-456 (with D-459): the shipped 1.5B reading free speech as a deed (deeds/extract.ts deedPrompt + DEED_SCHEMA), against the
// hand-written meanings of tools/dev/talkeval/deed_lines.ts, beside the grammar (deeds/parse.ts). Two ways of decoding:
// constrained (the schema: keys forced in order, enums chosen among their values, greedy: the CPU runner's /deed, the stand-in
// for WebLLM's json_schema) and free (greedy text, the first {...} parsed and held to the closed sets as fromModel does).
//   python3 tools/dev/talkeval/qwen_mlc.py <mlc dir> serve 8765 &
//   npx tsx tools/dev/talkeval/deeds.ts <out.json> [url=http://127.0.0.1:8765]
import { writeFileSync } from 'node:fs';
import { DEED_SCHEMA, deedPrompt } from '../../../src/people/deeds/extract';
import { parseDeed } from '../../../src/people/deeds/parse';
import { DEED_LINES, type DeedLine } from './deed_lines';
import { post } from './http';

const [out = 'deed_eval.json', url = 'http://127.0.0.1:8765'] = process.argv.slice(2);
const props = DEED_SCHEMA.properties as Record<string, any>;
const fields = Object.entries(props).map(([key, p]) => p.enum ? { key, kind: 'enum', options: p.enum } : p.type === 'integer' ? { key, kind: 'int', min: p.minimum, max: p.maximum } : { key, kind: 'string' });
const ctx = { addressee: 5, hour: 10, pointed: 9, named: (w: string) => /\b(father|mother|husband|wife|brother|son|child|smith|baker|scribe|headman|overseer|neighbour|Bagadata)\b/i.test(w) ? 7 : null };

type Got = { verb: string; who?: string; name?: string; activity?: string; good?: string; qty?: number; when?: string; force?: string } | null;
function score(l: DeedLine, g: Got) {
  const v = g?.verb ?? 'none', ok: Record<string, boolean | null> = { verb: l.verbs.includes(v) };
  ok.act = l.act ? l.act.includes(g?.activity ?? 'none') : null; ok.good = l.good ? l.good.includes(g?.good ?? 'none') : null;
  ok.who = l.who ? (g?.who ?? 'you') === l.who : null; ok.name = l.name ? new RegExp(l.name, 'i').test(g?.name ?? '') : null;
  ok.qty = l.qty !== undefined ? g?.qty === l.qty : null; ok.when = l.when ? g?.when === l.when : null; ok.force = l.force ? l.force.includes(g?.force ?? 'none') : null;
  return ok;
}
const fromGrammar = (said: string): Got => { const d = parseDeed(said, 'player', ctx); if (!d) return null;
  return { verb: d.verb, who: d.third !== undefined || (d.target !== undefined && d.target !== 5) ? (d.target === 9 || d.third === 9 ? 'other' : 'named') : 'you', name: d.third === 7 || d.target === 7 ? said : '', activity: d.act ?? 'none', good: d.good ?? 'none', qty: d.qty, when: !d.inH ? 'now' : d.inH > 14 ? 'tomorrow' : d.inH > 6 ? 'tonight' : 'later', force: d.force === undefined ? 'none' : d.force >= 1 ? 'deadly' : d.force >= 0.7 ? 'hard' : 'light' }; };
const closed = (j: any): Got => { if (!j || typeof j !== 'object') return null; const o: any = {};
  for (const [k, p] of Object.entries(props)) { const x = j[k]; o[k] = p.enum ? (p.enum.includes(x) ? x : (k === 'verb' ? 'invalid' : 'none')) : p.type === 'integer' ? (Number.isInteger(x) ? x : 0) : typeof x === 'string' ? x : ''; } return o; };

async function main() {
  const rows: any[] = []; const t0 = Date.now();
  for (const l of DEED_LINES) {
    const p = deedPrompt(l.said), messages = [{ role: 'system', content: p.system }, { role: 'user', content: p.user }];
    const c: any = await post(url + '/deed', { messages, fields });
    const f: any = await post(url, { messages, max_tokens: 110, temperature: 0, repetition_penalty: 1.0, seed: 1 });
    let fj: any = null, parseErr = ''; const m = /\{[\s\S]*?\}/.exec(f.text); try { fj = m ? JSON.parse(m[0]) : null; if (!m) parseErr = 'no json'; } catch (e) { parseErr = 'bad json'; }
    const g = fromGrammar(l.said), cg = c.json as Got, fg = closed(fj);
    rows.push({ said: l.said, want: l, grammar: g, constrained: cg, free: fg, freeText: f.text, parseErr, ok: { grammar: score(l, g), constrained: score(l, cg), free: score(l, fg) },
      ms: { constrained: Math.round(c.total_s * 1000), constrainedPrefill: Math.round(c.prefill_s * 1000), constrainedGen: c.gen_tokens, free: Math.round(f.total_s * 1000), freeTok: f.completion_tokens, promptTokens: c.prompt_tokens } });
    if (rows.length % 25 === 0) console.log(`${rows.length}/${DEED_LINES.length} ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  const share = (k: 'grammar' | 'constrained' | 'free', f: string) => { const xs = rows.map(r => r.ok[k][f]).filter(x => x !== null); return `${xs.filter(Boolean).length}/${xs.length} (${(100 * xs.filter(Boolean).length / Math.max(1, xs.length)).toFixed(0)} %)`; };
  const summary: any = {}; for (const k of ['grammar', 'constrained', 'free'] as const) summary[k] = Object.fromEntries(['verb', 'act', 'good', 'who', 'name', 'qty', 'when', 'force'].map(f => [f, share(k, f)]));
  const deedLines = rows.filter(r => !r.want.verbs.includes('none')), talkLines = rows.filter(r => r.want.verbs.length === 1 && r.want.verbs[0] === 'none');
  for (const k of ['grammar', 'constrained', 'free'] as const) { summary[k].deedRead = `${deedLines.filter(r => (r[k]?.verb ?? 'none') !== 'none').length}/${deedLines.length}`; summary[k].talkKeptAsTalk = `${talkLines.filter(r => (r[k]?.verb ?? 'none') === 'none').length}/${talkLines.length}`; }
  summary.free.parseErrors = rows.filter(r => r.parseErr).length; summary.free.invalidVerb = rows.filter(r => r.free?.verb === 'invalid').length;
  const q = (a: number[], p: number) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  summary.latency = { promptTokensMedian: q(rows.map(r => r.ms.promptTokens), 0.5), constrainedMsMedian: q(rows.map(r => r.ms.constrained), 0.5), constrainedPrefillMsMedian: q(rows.map(r => r.ms.constrainedPrefill), 0.5), constrainedTokensMedian: q(rows.map(r => r.ms.constrainedGen), 0.5), freeMsMedian: q(rows.map(r => r.ms.free), 0.5), freeTokensMedian: q(rows.map(r => r.ms.freeTok), 0.5) };
  // the confusions (verb wrong), by want -> got, for the report
  const conf = (k: 'constrained' | 'free' | 'grammar') => rows.filter(r => !r.ok[k].verb).map(r => `${r.said} | want ${r.want.verbs.join('/')} | got ${r[k]?.verb ?? 'none'}`);
  summary.wrong = { constrained: conf('constrained'), free: conf('free'), grammar: conf('grammar') };
  writeFileSync(out, JSON.stringify({ summary, rows }, null, 1)); console.log(JSON.stringify({ ...summary, wrong: undefined }, null, 1));
}
main();
