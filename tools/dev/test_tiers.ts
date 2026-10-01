// dev (D-251, the speed plan D-248 step 2): classify the vitest files into a fast tier (run while working) and a gate tier
// (the heavy people and world suites, run once at the session gate through tools/dev/cpu_slot.sh), from a measured run.
// Usage: tools/dev/cpu_slot.sh npx vitest run --maxWorkers=1 --reporter=json --outputFile=<report.json>
//        npx tsx tools/dev/test_tiers.ts <report.json> [fast limit s = 20] [--merge]
// Writes tests/tiers.json: { measured, limit_s, files: { <file>: seconds }, gate: [<file>…] }. The guards are always fast.
// --merge (D-360): the report's files replace their old timings, the other files keep theirs (a partial run, e.g. the files
// added since the last measurement). Files that failed are listed (failed) but stay in their tier by time: a failure is not
// hidden by moving it to the slow tier.
// `npm run test:fast` skips the gate files; `npm run test:slow` runs only them; `npm test` (and the session gate) still runs
// every file: no test is dropped.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { relative } from 'node:path';
const args = process.argv.slice(2), merge = args.includes('--merge'), [rep, lim = '20'] = args.filter(a => a !== '--merge');
const r = JSON.parse(readFileSync(rep, 'utf8'));
const old = merge && existsSync('tests/tiers.json') ? JSON.parse(readFileSync('tests/tiers.json', 'utf8')) : null;
const files: Record<string, number> = { ...(old?.files ?? {}) }, failed = new Set<string>(old?.failed ?? []);
for (const t of r.testResults) { const f = relative(process.cwd(), t.name).split('\\').join('/'); files[f] = Math.round((t.endTime - t.startTime) / 100) / 10; if (t.status !== 'passed') failed.add(f); else failed.delete(f); }
const GUARDS = ['tests/gates_ratchet.test.ts', 'tests/scope_ledger.test.ts', 'tests/defaults.test.ts', 'tests/language.test.ts', 'tests/coverage_board.test.ts'];
const gate = Object.entries(files).filter(([f, s]) => s > +lim && !GUARDS.includes(f)).map(([f]) => f).sort();
const sum = (fs: string[]) => fs.reduce((a, f) => a + files[f], 0);
writeFileSync('tests/tiers.json', JSON.stringify({ measured: new Date().toISOString(), limit_s: +lim, note: merge ? `merged: ${r.testResults.length} files re-measured on ${new Date().toISOString().slice(0, 10)}, the rest from ${old?.measured ?? '?'}; regenerate with tools/dev/test_tiers.ts` : 'seconds per file; regenerate with tools/dev/test_tiers.ts', total_s: Math.round(sum(Object.keys(files))), fast_s: Math.round(sum(Object.keys(files).filter(f => !gate.includes(f)))), files, failed: [...failed].sort(), gate }, null, 1) + '\n');
console.log(`${Object.keys(files).length} files, ${gate.length} in the gate tier (${failed.size} failed or timed out); fast tier ${Math.round(sum(Object.keys(files).filter(f => !gate.includes(f))))} s of ${Math.round(sum(Object.keys(files)))} s`);
