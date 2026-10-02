// s15/ship (D-374): the static site for GitHub Pages (https://longwong377.github.io/fars/), from a clean checkout alone.
//   node tools/deploy/build_site.mjs            bake the world cache in node, vite build under /fars/, check the host's limits
//   PARSA_BASE=/ node tools/deploy/build_site.mjs   the same at the root of a host (a local static check)
//   SKIP_BAKE=1 ...                              no node bake (the page then builds every unit live)
// Nothing on this machine is used: the models load from Hugging Face's CDN on a public origin (src/people/converse/models.ts),
// the world cache is baked here in node from the sources in git (tools/bake_world/bake.ts), the rest is public/ in git.
// GitHub Pages: no custom headers (no COOP/COEP: the page runs without cross-origin isolation; nothing in it needs
// SharedArrayBuffer), no Git LFS, 1 GB a site, 100 MB a file. The script fails when the dist breaks a limit.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd()), dist = join(root, 'dist'), base = process.env.PARSA_BASE ?? '/fars/';
const t0 = Date.now(), lap = (s) => console.log(`[site] ${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } });

// the in-browser models never come from this tree: a junction or folder under public/models/{mlc-ai,onnx-community,mlc-libs}
// (the dev tree's local copies) would be copied into the site; refuse
for (const d of ['mlc-ai', 'onnx-community', 'mlc-libs']) if (existsSync(join(root, 'public/models', d)))
  throw new Error(`public/models/${d} exists (a local model store): build from a clean clone; the site loads the models from Hugging Face`);

if (!process.env.SKIP_BAKE && existsSync(join(root, 'tools/bake_world/bake.ts'))) {
  try { run('npx tsx tools/bake_world/bake.ts'); lap('world cache baked'); }
  catch (e) { console.warn(`[site] world-cache bake failed (${e.message}); the page builds those units live`); }
}
run('npx vite build', { PARSA_BASE: base }); lap('vite build');

// GitHub Pages: no Jekyll (it would drop files and folders starting with _), the limits checked
writeFileSync(join(dist, '.nojekyll'), '');
// the service worker's build stamp (public/sw.js): a new deploy is a new worker, which drops the old build's cache
{ const sw = join(dist, 'sw.js'), id = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { return 'nogit'; } })() + '-' + Date.now().toString(36);
  if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replace('__PARSA_BUILD__', id)); }
const files = []; const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n), s = lstatSync(p); if (s.isDirectory()) walk(p); else files.push([p.slice(dist.length + 1).split('\\').join('/'), s.size]); } };
walk(dist);
const total = files.reduce((a, [, b]) => a + b, 0), big = files.filter(([, b]) => b > 100e6), top = [...files].sort((a, b) => b[1] - a[1]).slice(0, 8);
const MB = b => (b / 1048576).toFixed(1) + ' MB';
console.log(`[site] dist: ${files.length} files, ${MB(total)}; largest: ${top.map(([f, b]) => `${f} ${MB(b)}`).join(', ')}`);
writeFileSync(join(dist, 'site.json'), JSON.stringify({ base, builtAt: new Date().toISOString(), commit: (() => { try { return execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { return null; } })(), files: files.length, bytes: total }, null, 1));
if (big.length) throw new Error(`files over GitHub Pages' 100 MB limit: ${big.map(([f, b]) => `${f} ${MB(b)}`).join(', ')}`);
if (total > 1e9) throw new Error(`the site is ${MB(total)}: over GitHub Pages' 1 GB limit`);
lap('done');
