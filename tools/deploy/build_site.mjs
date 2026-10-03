// s15/ship (D-368): the static site for GitHub Pages (https://longwong377.github.io/fars/), from a clean checkout alone.
//   node tools/deploy/build_site.mjs            bake the world cache in node, vite build under /fars/, check the host's limits
//   PARSA_BASE=/ node tools/deploy/build_site.mjs   the same at the root of a host (a local static check)
//   SKIP_BAKE=1 ...                              no node bake (the page then builds every unit live)
// Nothing on this machine is used: the models load from Hugging Face's CDN on a public origin (src/people/converse/models.ts),
// the world cache is baked here in node from the sources in git (tools/bake_world/bake.ts), the rest is public/ in git.
// GitHub Pages: no custom headers (no COOP/COEP: the page runs without cross-origin isolation; nothing in it needs
// SharedArrayBuffer), no Git LFS, 1 GB a site, 100 MB a file. The script fails when the dist breaks a limit.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, lstatSync, rmSync } from 'node:fs';
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
run(`npx vite build${process.env.NOMINIFY ? ' --minify false' : ''}${process.env.SOURCEMAP ? ' --sourcemap' : ''}`, { PARSA_BASE: base }); // (NOMINIFY=1 / SOURCEMAP=1: names and source files for tools/deploy/boot_profile.mjs) lap('vite build');

// s18 C9 (D-740): the jpgs a visit never asks for leave the dist: every scan map with a KTX2 listed in textures/ktx.json (the
// page loads the KTX2: its ETC1S twin first on a BC7 GPU, else the full file, src/render/lowfirst.ts), and, when the ground's
// KTX2 array is there, the ground layers' diff/disp jpgs (src/render/scans.ts GROUND). The dev server keeps them (?scanjpg A/B).
{ const T = join(dist, 'textures'), lf = join(T, 'ktx.json'); let n = 0, b = 0; const rm = f => { if (existsSync(f)) { b += lstatSync(f).size; rmSync(f); n++; } };
  const listed = existsSync(lf) ? Object.keys(JSON.parse(readFileSync(lf, 'utf8')).maps ?? {}).filter(k => existsSync(join(T, k + '.ktx2'))) : [];
  for (const k of listed) rm(join(T, k + '.jpg'));
  if (existsSync(join(T, 'ground/ground.ktx2'))) { // (the layers' scan ids, read from scans.ts's GROUND table)
    const src = readFileSync(join(root, 'src/render/scans.ts'), 'utf8'), body = /export const GROUND = \{([\s\S]*?)\} as const/.exec(src)?.[1] ?? '';
    const ids = [...body.matchAll(/:\s*'([^']+)'/g)].map(m => m[1]); if (ids.length < 8) throw new Error(`build_site: GROUND table not read (${ids.length} ids)`);
    for (const id of ids) for (const f of ['diff', 'disp']) rm(join(T, id, f + '.jpg')); }
  // (and the other images whose KTX2 the page loads instead: ktx_maps.json's, the people's scan layers, the bark scans)
  const mf = join(dist, 'ktx_maps.json'); if (existsSync(mf)) for (const k of Object.keys(JSON.parse(readFileSync(mf, 'utf8')).maps ?? {})) if (existsSync(join(dist, k.replace(/\.(jpg|png|webp)$/, '.ktx2')))) rm(join(dist, k));
  const H = join(dist, 'generated/humans/scans'); if (existsSync(join(H, 'scans.ktx2'))) { for (const f of readdirSync(H)) if (/^(skin|cloth)_.*\.jpg$/.test(f)) rm(join(H, f)); rm(join(dist, 'models/people/people_cloth_folds.png')); }
  const BK = join(dist, 'models/trees/bark'); if (existsSync(join(BK, 'bark.ktx2'))) for (const f of readdirSync(BK)) if (f.endsWith('.jpg')) rm(join(BK, f));
  // (and the scans no code loads: a textures/<id> whose id no source file under src/ names apart from the scans' metadata
  // (src/data/scans.json), and the ground-only layers' other maps (the array takes diff and disp only))
  { const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : /\.ts$/.test(e.name) ? [join(d, e.name)] : []);
    const code = walk(join(root, 'src')).map(f => readFileSync(f, 'utf8')).join('\n'), body = /export const GROUND = \{([\s\S]*?)\} as const/.exec(code)?.[1] ?? '';
    const groundIds = new Set([...body.matchAll(/:\s*'([^']+)'/g)].map(m => m[1])), codeNoGround = code.replace(body, '');
    for (const id of existsSync(T) ? readdirSync(T) : []) { const d = join(T, id); if (!lstatSync(d).isDirectory()) continue;
      const named = new RegExp(`['"/]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"/]`).test(codeNoGround);
      if (named) continue; // (used by a material, a bake or a loader)
      if (groundIds.has(id) && !existsSync(join(T, 'ground/ground.ktx2'))) continue; // (the jpg ground path needs diff/disp)
      for (const f of readdirSync(d)) if (/\.(jpg|ktx2)$/.test(f) && !(groundIds.has(id) && f.endsWith('.ktx2'))) rm(join(d, f)); } } // (an unused scan's KTX2 too: the ktx.json step below drops its entry)
  lap(`jpgs with a KTX2 left out: ${n} files, ${(b / 1048576).toFixed(1)} MB`); }
// textures low first (src/render/lowfirst.ts): a 512-px copy of every scan jpg beside it, and textures/low.json (each full
// file's size): a first visit loads the copies before it can walk and the full scans after (sharp, in the lockfile)
{ const sharp = (await import('sharp')).default, T = join(dist, 'textures'), man = {}; let full = 0, low = 0;
  for (const id of existsSync(T) ? readdirSync(T) : []) { const d = join(T, id); if (!lstatSync(d).isDirectory()) continue;
    for (const f of readdirSync(d)) { if (!f.endsWith('.jpg') || f.endsWith('.low.jpg')) continue;
      const src = join(d, f), meta = await sharp(src).metadata(), out = join(d, f.replace(/\.jpg$/, '.low.jpg'));
      if (!meta.width || meta.width <= 512) continue;
      await sharp(src).resize({ width: 512, height: Math.round(512 * meta.height / meta.width) }).jpeg({ quality: 85 }).toFile(out);
      man[`${id}/${f.replace(/\.jpg$/, '')}`] = [meta.width, meta.height]; full += lstatSync(src).size; low += lstatSync(out).size; } }
  writeFileSync(join(T, 'low.json'), JSON.stringify(man));
  lap(`textures low first: ${Object.keys(man).length} copies, ${(low / 1048576).toFixed(1)} MB for ${(full / 1048576).toFixed(1)} MB of scans`); }
// D-393, D-580: the files the page prefetches from its first seconds (src/core/prefetch.ts): the measured list in the order the
// page asks for them (tools/deploy/boot_list.mjs), those this build has; '*' expanded here (hashed world-cache units), '{seed}'
// kept for the page (a world's own units; counted by the first seed this build baked)
{ const want = readFileSync(join(root, 'tools/deploy/boot_files.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const esc = x => x.replace(/[.+?^$()|[\]\\]/g, '\\$&');
  const expand = p => { const d = p.slice(0, p.lastIndexOf('/')), re = new RegExp('^' + esc(p.slice(d.length + 1)).replace('\\{seed\\}', '{seed}').split('*').join('([0-9a-f]+)').replace('{seed}', '(?<seed>\\d+)') + '$');
    const fs = existsSync(join(dist, d)) ? readdirSync(join(dist, d)) : [];
    return [...new Set(fs.map(f => re.exec(f)).filter(Boolean).map(m => `${d}/${m.groups?.seed ? m[0].replace(new RegExp(`(?<=[-_])${m.groups.seed}(?=[_.])`), '{seed}') : m[0]}`))]; };
  const have = [...new Set(want.flatMap(expand))], sizeOf = p => { const f = expand(p.replace('{seed}', '*'))[0] ?? p; try { return lstatSync(join(dist, f.replace('{seed}', ''))).size; } catch { return 0; } };
  let b = 0; for (const p of have) b += sizeOf(p);
  writeFileSync(join(dist, 'boot-files.json'), JSON.stringify(have));
  lap(`boot files to warm: ${have.length} of ${want.length} listed, ${(b / 1048576).toFixed(1)} MB`); }
// D-580: the optional KTX2 lists (src/render/scans.ts reads them and falls back to the jpgs without them) written empty when
// the build has none, so a visit logs no 404 for them (scans.ts: no maps listed / no matching ground meta -> the jpgs)
// (and a listed KTX2 scan the build lacks is dropped from the list: the page then loads its jpg, no 404)
{ const f = join(dist, 'textures/ktx.json'); if (existsSync(f)) { const j = JSON.parse(readFileSync(f, 'utf8')), m = j.maps ?? {}, drop = Object.keys(m).filter(k => !existsSync(join(dist, 'textures', k + '.ktx2')));
  for (const k of drop) delete m[k]; writeFileSync(f, JSON.stringify(j)); lap(`KTX2 scans listed: ${Object.keys(m).length}${drop.length ? ` (${drop.length} missing, dropped: ${drop.join(', ')})` : ''}`); } }
for (const [f, v] of [['textures/ktx.json', { about: 'no KTX2 scans in this build (tools/bake_world/ktx_scans.ts)', maps: {} }], ['textures/ground/ground.json', { about: 'no KTX2 ground array in this build (tools/bake_world/ktx_ground.ts)', res: 0, layers: [] }]])
  if (!existsSync(join(dist, f))) { (await import('node:fs')).mkdirSync(join(dist, f, '..'), { recursive: true }); writeFileSync(join(dist, f), JSON.stringify(v)); }
// GitHub Pages: no Jekyll (it would drop files and folders starting with _), the limits checked
writeFileSync(join(dist, '.nojekyll'), '');
// the service worker's build stamp (public/sw.js): a new deploy is a new worker, which drops the old build's cache
{ const sw = join(dist, 'sw.js'), id = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { return 'nogit'; } })() + '-' + Date.now().toString(36);
  if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, 'utf8').replace('__PARSA_BUILD__', id)); }
// D-580: every file's content hash (public/sw.js carries a file over from the previous deploy's cache when it is unchanged)
{ const { createHash } = await import('node:crypto'), man = {}, skip = new Set(['sw.js', 'index.html', 'site.json', 'site-files.json']);
  const walkH = d => { for (const n of readdirSync(d)) { const p = join(d, n), st = lstatSync(p); if (st.isDirectory()) walkH(p); else { const r = p.slice(dist.length + 1).split('\\').join('/'); if (!skip.has(r)) man[r] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 16); } } };
  walkH(dist); writeFileSync(join(dist, 'site-files.json'), JSON.stringify(man)); lap(`content hashes: ${Object.keys(man).length} files`); }
const files = []; const walk = d => { for (const n of readdirSync(d)) { const p = join(d, n), s = lstatSync(p); if (s.isDirectory()) walk(p); else files.push([p.slice(dist.length + 1).split('\\').join('/'), s.size]); } };
walk(dist);
const total = files.reduce((a, [, b]) => a + b, 0), big = files.filter(([, b]) => b > 100e6), top = [...files].sort((a, b) => b[1] - a[1]).slice(0, 8);
const MB = b => (b / 1048576).toFixed(1) + ' MB';
console.log(`[site] dist: ${files.length} files, ${MB(total)}; largest: ${top.map(([f, b]) => `${f} ${MB(b)}`).join(', ')}`);
writeFileSync(join(dist, 'site.json'), JSON.stringify({ base, builtAt: new Date().toISOString(), commit: (() => { try { return execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { return null; } })(), files: files.length, bytes: total }, null, 1));
if (big.length) throw new Error(`files over GitHub Pages' 100 MB limit: ${big.map(([f, b]) => `${f} ${MB(b)}`).join(', ')}`);
if (total > 1e9) throw new Error(`the site is ${MB(total)}: over GitHub Pages' 1 GB limit`);
// s18 C9 (D-740): the deploy's own ceiling, under Pages' 1 GB so a growth is caught before it breaks the site (the budget, by
// part, in handoff/s18/report_c9.md: the title film 12 MB, the score 44 MB); SITE_MAX_MB=… overrides for a local check
{ const max = +(process.env.SITE_MAX_MB ?? 950) * 1048576; if (total > max) throw new Error(`the site is ${MB(total)}: over the deploy's ${MB(max)} ceiling (D-740); prune or re-encode before adding`); }
lap('done');
