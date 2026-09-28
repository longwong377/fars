// PARSA animals (D-326; BLENDER_PLAN row 4): builds every species' modelled body from the project's own anatomy.
//   node tools/blender/animals.mjs [species ...] [--jobs=N] [--blender-jobs=N] [--check] [--work=T:/fars-blender/animals]
// For each species of tools/blender/animals.json (all, or those named):
//  1. the sources (npx tsx tools/blender/sources/animal.ts: base.ply + high.ply from src/people/animalForm.ts);
//  2. the Blender stage (tools/blender/animals.py: decimated levels, UVs, Cycles bakes of normal, occlusion, albedo and coat
//     mask from the dense source; one Draco GLB with lod0 and lod1);
//  3. KTX2 (UASTC + zstd, mipmaps; the albedo sRGB, the normal map linear) with the KTX-Software CLI;
//  4. public/models/animals/<sp>.glb, <sp>_albedo.ktx2, <sp>_nrm.ktx2 and public/models/animals/manifest.json (input hash,
//     output hashes, triangles, bytes; what src/people/animalModels.ts loads and tests/animal_models.test.ts checks).
// --check: list the species whose inputs changed since their build (exit 1 if any).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { animalHash } from './lib/animal_inputs.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
process.chdir(ROOT);
const args = process.argv.slice(2), flag = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : args.includes(`--${k}`) ? true : d; };
const REG = JSON.parse(readFileSync('tools/blender/animals.json', 'utf8'));
const WORK = flag('work', 'T:/fars-blender/animals'), JOBS = +flag('jobs', 6), BJOBS = +flag('blender-jobs', 3), CHECK = !!flag('check', false);
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const OUT = 'public/models/animals', MAN = `${OUT}/manifest.json`;
const sha = b => createHash('sha256').update(b).digest('hex');
const want = args.filter(a => !a.startsWith('--')); const list = want.length ? want : Object.keys(REG.species);
for (const s of list) if (!REG.species[s]) { console.error(`unknown species ${s}`); process.exit(2); }
const log = (...a) => console.log('[animals]', ...a);

const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { assets: {} };
if (CHECK) { let st = 0; for (const sp of list) { const ok = man.assets[sp]?.inHash === animalHash(sp); if (!ok) st++; log(sp, ok ? 'current' : 'STALE'); } process.exit(st ? 1 : 0); }

const run = (cmd, argv, opts = {}) => new Promise((res, rej) => { const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', c => (c === 0 ? res(out) : rej(new Error(`${cmd} ${argv.slice(0, 4).join(' ')} exited ${c}\n${out.slice(-2000)}`)))); });
async function pool(items, n, fn) { const q = [...items], errs = []; await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const it = q.shift(); try { await fn(it); } catch (e) { errs.push([it, e]); console.error(`[animals] ${it} FAILED: ${e.message}`); } } })); return errs; }

mkdirSync(OUT, { recursive: true });
const t0 = Date.now(), ktxV = spawnSync(KTX, ['--version'], { encoding: 'utf8' }).stdout?.trim();
const blenderV = /Blender (\S+)/.exec(spawnSync(BLENDER, ['--version'], { encoding: 'utf8' }).stdout ?? '')?.[1] ?? '?';
log(`${list.length} species; Blender ${blenderV}; ${ktxV ?? 'no ktx'}; work ${WORK}`);
// 1. sources (node, parallel)
const srcErr = await pool(list, JOBS, async sp => { const C = REG.classes[REG.species[sp]], w = `${WORK}/${sp}`; mkdirSync(w, { recursive: true });
  const o = await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'tools/blender/sources/animal.ts', w, sp, String(C.cell[0]), String(C.cell[1])], { shell: process.platform === 'win32' }); log(o.trim().split('\n').pop()); });
// 2-4. Blender, KTX2, record (parallel Blender processes, each on a share of the cores)
const threads = Math.max(2, Math.floor(16 / BJOBS));
const ok = list.filter(sp => !srcErr.some(([s]) => s === sp));
const bErr = await pool(ok, BJOBS, async sp => {
  const C = REG.classes[REG.species[sp]], w = `${WORK}/${sp}`, src = JSON.parse(readFileSync(`${w}/source.json`, 'utf8')), Lb = src.bounds.max[2] - src.bounds.min[2], bk = REG.bake;
  const job = { sp, base: `${w}/base.ply`, high: `${w}/high.ply`, out_dir: w, tris: C.tris, tex: C.tex, cage: +(bk.cage_per_len * Lb).toFixed(4), ray: +(bk.ray_per_len * Lb).toFixed(4),
    ao_samples: bk.ao_samples, ao_distance: +(bk.ao_distance_per_len * Lb).toFixed(4), uv_angle: bk.uv_angle, uv_margin: bk.uv_margin, margin: bk.margin, normal_samples: bk.normal_samples, emit_samples: bk.emit_samples, device: 'CPU', threads };
  writeFileSync(`${w}/job.json`, JSON.stringify(job, null, 1));
  await run(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/animals.py', '--', `${w}/job.json`]);
  const st = JSON.parse(readFileSync(`${w}/stats.json`, 'utf8'));
  for (const [k, tf, fmt] of [['albedo', 'srgb', 'R8G8B8A8_SRGB'], ['nrm', 'linear', 'R8G8B8A8_UNORM']])
    await run(KTX, ['create', '--format', fmt, '--assign-tf', tf, '--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18', '--generate-mipmap', `${w}/${sp}_${k}.png`, `${w}/${sp}_${k}.ktx2`]);
  const files = {}; for (const f of [`${sp}.glb`, `${sp}_albedo.ktx2`, `${sp}_nrm.ktx2`]) { const b = readFileSync(`${w}/${f}`); copyFileSync(`${w}/${f}`, `${OUT}/${f}`); files[f] = { bytes: b.length, sha256: sha(b) }; }
  man.assets[sp] = { inHash: animalHash(sp), class: REG.species[sp], files, tris: [st.lod0, st.lod1], tex: st.tex, lod1At: +(REG.lod1_per_len * (src.bounds.max[2] - src.bounds.min[2])).toFixed(1),
    source: { high: src.high.tris, base: src.base.tris, cell: [src.cellH, src.cellB] }, ao_mean: +st.ao_mean.toFixed(3), mask_mean: +st.mask_mean.toFixed(3), blender: blenderV, device: st.device, ktx: ktxV, tier: 'C', src: 'RECON' };
  log(`${sp}: lod0 ${st.lod0} / lod1 ${st.lod1} tris, ${Object.values(files).reduce((a, f) => a + f.bytes, 0)} B, ${st.seconds} s`);
  const sorted = Object.fromEntries(Object.keys(man.assets).sort().map(k => [k, man.assets[k]]));
  writeFileSync(MAN, JSON.stringify({ about: 'Generated by tools/blender/animals.mjs (D-326); do not edit. Per species: the input hash, the files (GLB with lod0 + lod1, KTX2 albedo+coat-mask and normal+occlusion maps) with their sha256, triangles per level, map size, the distance lod1 takes over (m).', assets: sorted }, null, 1) + '\n');
});
// the decoders the loader uses are the pipeline's (public/models/lib/: tools/blender/build.mjs copies them)
log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s; failed: ${[...srcErr, ...bErr].map(([s]) => s).join(', ') || 'none'}`);
process.exit(srcErr.length + bErr.length ? 1 : 0);
