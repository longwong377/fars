// The s17 scoreboard and focus trains (sessions/s17-vagon-v2.md): one page load renders a fixed view set through
// tests/e2e/coverage.spec.ts (SET=), keeps the full frames, and publishes them to branch s17-renders so the cloud agents
// can see the GPU's pictures.
//   node tools/dev/scoreboard.mjs run [--set tests/data/scoreboard_s17.json] [--tree <path>] [--q high] [--port 5182] [--label scoreboard]
//   node tools/dev/scoreboard.mjs focus <asks.json> [--worst 5 --from <coverage json of the last scoreboard>]   build a focus set
//   node tools/dev/scoreboard.mjs publish <stamp-dir> [--label <name>]                               push frames to s17-renders
// asks.json: [{ id, e, n, eye, az, pitch, day, hour, w, why, cast? }] (the agents' asks, e.g. from handoff/s17/asks_vagon.md).
// Output: <TRAIN_ROOT>/sb/<stamp>-<label>/{<id>.png, coverage.json, index.md}; published as renders/<stamp>-<label>/<id>.jpg
// (1280 px) + index.md on s17-renders. Runs through gpu_slot (the GPU's one queue). The tree must not be edited while it runs.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const [cmd, ...a] = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const ROOT = process.env.TRAIN_ROOT ?? (process.platform === 'win32' ? 'C:/Users/Administrator/fars-train' : join(tmpdir(), 'fars-train'));
const stampNow = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function index(dir, set, cov) {
  const rows = Object.values(cov).filter(r => r && r.id);
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  const ids = [...(set.ids ?? []), ...(set.extra ?? []).map(x => x.id)];
  let md = `# ${basename(dir)}\n\n${ids.length} views. Columns: area/sub, state, placeholder-or-untiered share (A1), flat region (A2f), clipped (A3c), draw calls, ms.\n\n| view | area | state | A1 | A2f | A3c | draws | ms |\n|---|---|---|---|---|---|---|---|\n`;
  for (const id of ids) { const r = by[id];
    md += r ? `| ${id} | ${r.sub ?? r.area} | ${r.state} | ${r.shares?.phOrUntiered ?? '-'} | ${r.gate?.flatRegion ?? '-'} | ${r.gate?.clipped ?? '-'} | ${r.drawCalls ?? '-'} | ${r.ms ?? '-'} |\n` : `| ${id} | MISSING | | | | | | |\n`; }
  writeFileSync(join(dir, 'index.md'), md); return md;
}

if (cmd === 'run') {
  const set = resolve(opt('--set', 'tests/data/scoreboard_s17.json')), tree = resolve(opt('--tree', '.')), label = opt('--label', 'scoreboard');
  const S = JSON.parse(readFileSync(set, 'utf8')), n = (S.ids?.length ?? 0) + (S.extra?.length ?? 0);
  // s17 (D-472): ONE full-world train at a time, and only with 16 GB free. Four train pages at once (7-10 GB each while
  // building) plus six agents' probes hung WMI, reset the T4 (device removed) and took the Claude app down (23:20 UTC).
  mkdirSync(ROOT, { recursive: true });
  const LOCK = join(ROOT, 'train.lock'), alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  if (existsSync(LOCK)) { const o = JSON.parse(readFileSync(LOCK, "utf8")); if (o.pid > 0 && alive(o.pid)) { console.error(`refused: train ${o.label} (pid ${o.pid}) is running since ${o.since}; one full-world train at a time`); process.exit(3); } }
  const freeGB = (await import('./boxguard.mjs')).freeGB(); // the smaller of free RAM and free COMMIT (D-472)
  if (freeGB < 24 && !process.env.FORCE) { console.error(`refused: ${freeGB.toFixed(1)} GB free (RAM or commit) < 24 GB (a train page commits up to ~18 GB)`); process.exit(3); }
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() }));
  process.on('exit', () => { try { if (JSON.parse(readFileSync(LOCK, 'utf8')).pid === process.pid) writeFileSync(LOCK, '{"pid":0}'); } catch {} });
  const dir = join(ROOT, 'sb', `${stampNow()}-${label}`); mkdirSync(dir, { recursive: true });
  const out = join(dir, 'coverage.json'), slot = join(tree, 'tools/dev/gpu_slot.mjs');
  const env = { ...process.env, PW_CHANNEL: process.env.PW_CHANNEL ?? 'chrome', SET: set, FULL_DIR: dir, OUT: out, Q: opt('--q', 'high'),
    TIMEOUT: String(2400 + 900 * n), PW_TIMEOUT: String(2400 + 900 * n), E2E_PORT: opt('--port', '5182'), NOHMR: '1' }; // T4: ~17 min to ready, ~13 min a new state
  console.log(`scoreboard ${label}: ${n} views on ${tree} -> ${dir}`);
  const t0 = Date.now();
  const pw = ['npx', 'playwright', 'test', 'tests/e2e/coverage.spec.ts', `--project=${process.env.PW_PROJECT ?? 'gpu'}`];
  const res = existsSync(slot) && !process.env.NOSLOT ? spawnSync('node', [slot, `sb-${label}`, '--', ...pw], { cwd: tree, env, stdio: 'inherit', shell: true })
    : spawnSync(pw[0], pw.slice(1), { cwd: tree, env, stdio: 'inherit', shell: true });
  const md = index(dir, S, existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {});
  console.log(md); console.log(`${((Date.now() - t0) / 60000).toFixed(1)} min, exit ${res.status}; publish: node tools/dev/scoreboard.mjs publish ${dir}`);
  process.exit(res.status ?? 1);
} else if (cmd === 'focus') {
  // the agents' asks + the worst views of the last scoreboard (highest A1, then flat), as one set
  const asks = a[0] && existsSync(a[0]) ? JSON.parse(readFileSync(a[0], 'utf8')) : [];
  const from = opt('--from'), worst = +opt('--worst', 5), sb = JSON.parse(readFileSync('tests/data/scoreboard_s17.json', 'utf8'));
  let ids = [];
  if (from && existsSync(from)) ids = Object.values(JSON.parse(readFileSync(from, 'utf8'))).filter(r => r?.id && !r.error && !r.extra)
    .sort((x, y) => (y.shares?.phOrUntiered ?? 0) - (x.shares?.phOrUntiered ?? 0) || (y.gate?.flatRegion ?? 0) - (x.gate?.flatRegion ?? 0)).slice(0, worst).map(r => r.id);
  const extra = asks.map((x, i) => ({ place: x.id ?? `ask-${i}`, area: x.area ?? 'ask', sub: x.sub ?? 'ask', cast: x.cast ?? null, state: `${x.hour}h/${x.w}`, month: 0, band: '-', weather: x.w, extra: true, ...x, id: x.id ?? `ask-${i}` }));
  const f = opt('--out', 'tests/data/focus_s17.json');
  writeFileSync(f, JSON.stringify({ about: 'a focus train set (tools/dev/scoreboard.mjs focus); not frozen', source: sb.source, ids, extra }, null, 1));
  console.log(`focus set ${f}: ${ids.length} worst scoreboard views + ${extra.length} asks; run: node tools/dev/scoreboard.mjs run --set ${f} --label focus`);
} else if (cmd === 'publish') {
  // frames -> 1280 px JPEG on branch s17-renders (a separate worktree, so the serving tree is never touched)
  const dir = resolve(a[0]), name = basename(dir), wt = resolve(opt('--wt', join(ROOT, 'renders-wt')));
  const git = (args, cwd = wt) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`); return r.stdout; };
  if (!existsSync(wt)) {
    spawnSync('git', ['fetch', 'origin', 's17-renders'], { stdio: 'inherit' });
    const has = spawnSync('git', ['rev-parse', '--verify', 'origin/s17-renders']).status === 0;
    git(has ? ['worktree', 'add', '-B', 's17-renders', wt, 'origin/s17-renders'] : ['worktree', 'add', '--orphan', '-b', 's17-renders', wt], process.cwd());
  } else git(['pull', '--ff-only', 'origin', 's17-renders']);
  const sharp = (await import('sharp')).default, dst = join(wt, 'renders', name); mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.png') && !f.endsWith('-mask.png')) await sharp(join(dir, f)).resize({ width: 1280 }).jpeg({ quality: 84 }).toFile(join(dst, f.replace(/\.png$/, '.jpg')));
    else if (f === 'index.md' || f === 'coverage.json') copyFileSync(join(dir, f), join(dst, f));
  }
  git(['add', '-A', 'renders']); git(['commit', '-m', `renders: ${name}`]); // a data-only orphan branch (its worktree has no .githooks, so no guards apply)
  for (let i = 0, d = 2; ; i++, d *= 2) { const r = spawnSync('git', ['push', '-u', 'origin', 's17-renders'], { cwd: wt, stdio: 'inherit' }); if (r.status === 0) break; if (i === 3) throw new Error('push failed'); spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${d * 1000})`]); }
  console.log(`published ${name} to s17-renders (renders/${name}/)`);
} else { console.error('usage: scoreboard.mjs run|focus|publish (see the header)'); process.exit(2); }
