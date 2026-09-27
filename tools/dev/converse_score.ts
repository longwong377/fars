// D-296 (T-E9): the score of a conversation test-set run (tools/dev/converse_drive.mjs with the lab's testSet job), per model:
// the pass share, the failures by kind, the latencies, and my own reading where it differs from the automatic one (a JSON of
// {model: {i: 'pass'|'fail: why'}} passed as the second argument overrides the automatic verdict, each override listed).
// Writes the evidence (REVIEWS/evidence/s11-conversation/T-E9.json) for the chosen model with --evidence <model>.
// Usage: npx tsx tools/dev/converse_score.ts <run.json> [judged.json] [--evidence <model>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { depHashFor } from './coverage_dep';

const [runPath, maybeJudged] = process.argv.slice(2); const judgedPath = maybeJudged && !maybeJudged.startsWith('--') ? maybeJudged : null;
const evIdx = process.argv.indexOf('--evidence'); const evModel = evIdx > 0 ? process.argv[evIdx + 1] : null;
const run = JSON.parse(readFileSync(runPath, 'utf8')).result as Record<string, { loadMs: number; gpuLoaded: number; rows: any[] }>;
const judged = judgedPath ? JSON.parse(readFileSync(judgedPath, 'utf8')) : {};
const q = (a: number[], p: number) => { const s = a.slice().sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : NaN; };
const out: any = {};
for (const [model, v] of Object.entries(run)) {
  const J = judged[model] ?? {}; const rows = v.rows.map(r => { const j = J[r.i]; const pass = j ? j === 'pass' : r.pass; return { ...r, auto: r.pass, pass, judged: j ?? null }; });
  const n = rows.length, pass = rows.filter(r => r.pass).length; const kinds: Record<string, [number, number]> = {};
  for (const r of rows) { kinds[r.kind] ??= [0, 0]; kinds[r.kind][1]++; if (r.pass) kinds[r.kind][0]++; }
  const why: Record<string, number> = {}; for (const r of rows.filter(x => !x.auto)) for (const w of r.why) { const k = w.split(':')[0].split(' ')[0]; why[k] = (why[k] ?? 0) + 1; }
  out[model] = { n, pass, share: +(100 * pass / n).toFixed(1), autoPass: rows.filter(r => r.auto).length, overrides: rows.filter(r => r.judged && (r.judged === 'pass') !== r.auto).map(r => ({ i: r.i, auto: r.auto, judged: r.judged })),
    kinds, autoFailWhy: why, msMedian: q(rows.map(r => r.ms), 0.5), msP90: q(rows.map(r => r.ms), 0.9), msMax: q(rows.map(r => r.ms), 1), ttftMedian: q(rows.map(r => r.ttftMs), 0.5), primeMedian: q(rows.map(r => r.primeMs ?? 0), 0.5), primeP90: q(rows.map(r => r.primeMs ?? 0), 0.9),
    within4sWithPrime: rows.filter(r => r.ms + (r.primeMs ?? 0) <= 4000).length, retries: rows.filter(r => r.tries > 1).length, loadMs: Math.round(v.loadMs), gpuLoadedMB: v.gpuLoaded };
}
console.log(JSON.stringify(out, null, 1));
if (evModel) {
  const o = out[evModel]; const commit = execSync('git rev-parse --short HEAD').toString().trim();
  mkdirSync('REVIEWS/evidence/s11-conversation', { recursive: true });
  writeFileSync('REVIEWS/evidence/s11-conversation/T-E9.json', JSON.stringify({ id: 'T-E9', value: o.share, n: o.n, commit, tool: 'src/people/', dep: depHashFor('src/people/'), unit: '%', status: o.share >= 95 && o.n >= 60 ? 'PASS' : 'FAIL',
    model: evModel, pass: o.pass, kinds: o.kinds, msMedian: o.msMedian, msP90: o.msP90, primeMedian: o.primeMedian, overrides: o.overrides,
    note: 'the seeded T-E9 set (src/people/converse/testset.ts, 72 cases, every class and hour, 30 adversarial), typed, run in the conversation lab on the T4 (tools/dev/converse_drive.mjs); a pass: no fence hit, grounded in the person’s own life, answered within 4 s of the prompt (the person primed with their life as the stranger comes near: primeMs, not counted); overrides are the agent’s own reading of each reply (D-296)' }, null, 1));
  console.log('evidence written');
}
