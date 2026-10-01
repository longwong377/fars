// One-command agent worktree (session 14): a branch off the integration tip in ../fars-wt/<name>, node_modules linked
// (a junction to the main tree's: no npm ci, no 1 GB copy) and models linked, its own Vite port written to .wtport.
//   node tools/dev/mkwt.mjs <name> [base]       base defaults to s14-int (else HEAD)
// Prints the path and the port; the agent then works only there (CLAUDE.md: never edit a tree a render is serving).
import { existsSync, mkdirSync, symlinkSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const [name, baseArg] = process.argv.slice(2);
if (!name) { console.error('usage: mkwt.mjs <name> [base]'); process.exit(2); }
const main = resolve('.'), wt = resolve(main, '..', 'fars-wt', name), git = (...a) => execFileSync('git', a, { cwd: main, encoding: 'utf8' }).trim();
const has = b => { try { git('rev-parse', '--verify', '--quiet', b); return true; } catch { return false; } };
const base = baseArg ?? (has('s14-int') ? 's14-int' : 'HEAD'), branch = `s14-${name}`;
if (existsSync(wt)) { console.error(`${wt} exists`); process.exit(1); }
mkdirSync(resolve(main, '..', 'fars-wt'), { recursive: true });
git('worktree', 'add', ...(has(branch) ? [wt, branch] : ['-b', branch, wt, base]));
symlinkSync(join(main, 'node_modules'), join(wt, 'node_modules'), 'junction');
for (const d of ['mlc-ai', 'onnx-community', 'mlc-libs']) { const s = join(main, 'public/models', d), t = join(wt, 'public/models', d);
  if (existsSync(s) && !existsSync(t)) symlinkSync(s, t, 'junction'); }
execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: wt });
// ports 5182..5199, one per worktree (the train uses 5181, the main tree 5173)
const used = new Set(readdirSync(resolve(main, '..', 'fars-wt')).map(d => { try { return +readFileSync(join(main, '..', 'fars-wt', d, '.wtport'), 'utf8'); } catch { return 0; } }));
let port = 5182; while (used.has(port)) port++;
writeFileSync(join(wt, '.wtport'), String(port));
console.log(`${wt}\nbranch ${branch} from ${base}\nE2E_PORT=${port}`);
