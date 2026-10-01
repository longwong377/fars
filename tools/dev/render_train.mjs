// The render train (session 14): one batched full-world page load renders every agent's views at once, instead of each
// agent paying its own ~15 min load and holding a GPU slot. Agents request; the lead (or a timer) runs the train on the
// integration tree, where the agents' merged work lives.
//
//   node tools/dev/render_train.mjs request <agent> <view,view,...> [extra.json]   queue views (moment names and/or own shots)
//   node tools/dev/render_train.mjs status                                        what is queued, what ran
//   node tools/dev/render_train.mjs run [--tree <path>] [--q high] [--port 5181]   render the queue in one load (GPU slot)
//
// extra.json: [{ n, day, hour, w, v: [x, z, eye, heading, pitch], fov? }] (moments.spec.ts EXTRA). Views are prefixed with
// the agent's name so two agents never collide. Output: <ROOT>/out/<stamp>/<agent>/<view>.png and index.md (per agent, the
// files it asked for); requests move to <ROOT>/done/<stamp>/. The queue lives on C: (T: may be wiped when the machine stops).
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const ROOT = process.env.TRAIN_ROOT ?? 'C:/Users/Administrator/fars-train', Q = join(ROOT, 'queue');
mkdirSync(Q, { recursive: true });
const [cmd, ...a] = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
const reqs = () => readdirSync(Q).filter(f => f.endsWith('.json')).map(f => ({ f, ...JSON.parse(readFileSync(join(Q, f), 'utf8')) }));

if (cmd === 'request') {
  const [agent, views = '', extra] = a;
  if (!agent) { console.error('request <agent> <views> [extra.json]'); process.exit(2); }
  const own = extra ? JSON.parse(readFileSync(extra, 'utf8')).map(s => ({ ...s, n: `${agent}--${s.n}` })) : [];
  const r = { agent, at: new Date().toISOString(), views: views.split(',').filter(Boolean), extra: own };
  writeFileSync(join(Q, `${agent}.json`), JSON.stringify(r, null, 1)); // one live request per agent: a new one replaces it
  console.log(`queued ${r.views.length + own.length} views for ${agent}; next train: node tools/dev/render_train.mjs status`);
} else if (cmd === 'status') {
  for (const r of reqs()) console.log(`${r.agent}\t${r.at}\t${[...r.views, ...r.extra.map(s => s.n)].join(',')}`);
  const out = join(ROOT, 'out'); if (existsSync(out)) console.log('runs:', readdirSync(out).sort().slice(-5).join(' '));
} else if (cmd === 'run') {
  { const { activeAgents } = await import('./boxguard.mjs'), b = activeAgents(); // session 15: the train runs between waves only
    if (b.length && !process.env.FORCE) { console.error(`refused: agents still building (${b.join(', ')}); run between waves (FORCE=1 overrides)`); process.exit(3); } }
  const rs = reqs(); if (!rs.length) { console.log('queue empty'); process.exit(0); }
  const tree = resolve(opt('--tree') ?? '.'), stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extra = rs.flatMap(r => r.extra), xf = join(ROOT, `extra-${stamp}.json`); writeFileSync(xf, JSON.stringify(extra));
  const only = [...new Set([...rs.flatMap(r => r.views), ...extra.map(s => s.n)])];
  console.log(`train ${stamp}: ${only.length} views for ${rs.map(r => r.agent).join(', ')} on ${tree}`);
  const env = { ...process.env, PW_CHANNEL: 'chrome', BATCH: '1', NOHMR: '1', Q: opt('--q') ?? 'high', TAG: `train${stamp}`,
    ONLY: only.join(','), EXTRA: extra.length ? xf : '', TIMEOUT: String(900 + 120 * only.length), PW_TIMEOUT: String(900 + 120 * only.length),
    E2E_PORT: opt('--port') ?? '5181' };
  const t0 = Date.now();
  const res = spawnSync('node', [join(tree, 'tools/dev/gpu_slot.mjs'), `train-${stamp}`, '--', 'npx', 'playwright', 'test', 'tests/e2e/moments.spec.ts', '--project=gpu'],
    { cwd: tree, env, stdio: 'inherit', shell: true });
  const dir = join(ROOT, 'out', stamp), done = join(ROOT, 'done', stamp); mkdirSync(done, { recursive: true });
  let idx = `# Render train ${stamp} (${((Date.now() - t0) / 60000).toFixed(1)} min, exit ${res.status})\n`;
  for (const r of rs) {
    mkdirSync(join(dir, r.agent), { recursive: true }); idx += `\n## ${r.agent}\n`;
    for (const n of [...r.views, ...r.extra.map(s => s.n)]) {
      const src = join(tree, 'shots', `moment-${n}-train${stamp}-gpu.png`), dst = join(dir, r.agent, `${n}.png`);
      if (existsSync(src)) { copyFileSync(src, dst); idx += `- ${n}: ${dst}\n`; } else idx += `- ${n}: MISSING (see the run log)\n`;
    }
    renameSync(join(Q, r.f), join(done, r.f));
  }
  writeFileSync(join(dir, 'index.md'), idx); console.log(idx);
  process.exit(res.status ?? 1);
} else { console.error('usage: render_train.mjs request|status|run'); process.exit(2); }
