// dev (D-251, the speed plan D-248 step 2): classify the vitest files into a fast tier (run while working) and a gate tier
// (the heavy people and world suites, run once at the session gate through tools/dev/cpu_slot.sh), from a measured run.
// Usage: tools/dev/cpu_slot.sh npx vitest run --maxWorkers=1 --reporter=json --outputFile=<report.json>
//        npx tsx tools/dev/test_tiers.ts <report.json> [fast limit s = 20]
// Writes tests/tiers.json: { measured, limit_s, files: { <file>: seconds }, gate: [<file>…] }. The guards are always fast.
// `npm run test:fast` skips the gate files; `npm test` (and the session gate) still runs every file: no test is dropped.
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
const [rep, lim = '20'] = process.argv.slice(2);
const r = JSON.parse(readFileSync(rep, 'utf8'));
const files: Record<string, number> = {};
for (const t of r.testResults) files[relative(process.cwd(), t.name)] = Math.round((t.endTime - t.startTime) / 100) / 10;
const GUARDS = ['tests/gates_ratchet.test.ts', 'tests/scope_ledger.test.ts', 'tests/defaults.test.ts', 'tests/language.test.ts'];
const gate = Object.entries(files).filter(([f, s]) => s > +lim && !GUARDS.includes(f)).map(([f]) => f).sort();
const sum = (fs: string[]) => fs.reduce((a, f) => a + files[f], 0);
writeFileSync('tests/tiers.json', JSON.stringify({ measured: new Date().toISOString(), limit_s: +lim, note: 'seconds per file with --maxWorkers=1 on the session-9 box; regenerate with tools/dev/test_tiers.ts', total_s: Math.round(sum(Object.keys(files))), fast_s: Math.round(sum(Object.keys(files).filter(f => !gate.includes(f)))), files, gate }, null, 1) + '\n');
console.log(`${Object.keys(files).length} files, ${gate.length} in the gate tier; fast tier ${Math.round(sum(Object.keys(files).filter(f => !gate.includes(f))))} s of ${Math.round(sum(Object.keys(files)))} s`);
