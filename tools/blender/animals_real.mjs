// PARSA animals, the library route (V5, D-520): species whose body is a ready-made, realistically textured model.
//   node tools/blender/animals_real.mjs [species ...] [--work=T:/fars-blender/real]
// For each species of tools/blender/animals_real.json (all, or those named):
//  1. the source GLB (Objaverse: huggingface.co/datasets/allenai/objaverse, the Sketchfab model's own licence: CC-BY or
//     CC-BY-NC; ASSET_LEDGER.md) fetched once into the work folder;
//  2. tools/blender/animals_real.py: the body in the rig's frame, its landmarks (rig.json), lod0/lod1 and the baked maps;
//  3. KTX2 (as animals.mjs) and public/models/animals/<sp>.* with a manifest entry marked real, carrying the rig landmarks
//     (animalModels.ts registers them: animalReal.ts) and the source's credit.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { realHash } from './lib/animal_inputs.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
process.chdir(ROOT);
const args = process.argv.slice(2), flag = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const REG = JSON.parse(readFileSync('tools/blender/animals_real.json', 'utf8'));
// the species' sizes (animals.ts ANIMAL_BUILD: body length, withers height, girth)
const BUILD = JSON.parse(spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'tools/blender/sources/animal_sizes.ts'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout.trim().split(/\r?\n/).pop());
const WORK = flag('work', 'T:/fars-blender/real'), JOBS = +flag('jobs', 3);
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const OUT = 'public/models/animals', MAN = `${OUT}/manifest.json`;
const sha = b => createHash('sha256').update(b).digest('hex');
const want = args.filter(a => !a.startsWith('--')); const list = want.length ? want : Object.keys(REG.species);
const log = (...a) => console.log('[animals_real]', ...a);
const run = (cmd, argv) => new Promise((res, rej) => { const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && cmd.endsWith('.cmd') }); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', c => (c === 0 ? res(out) : rej(new Error(`${cmd} exited ${c}\n${out.slice(-2500)}`)))); });
const man = JSON.parse(readFileSync(MAN, 'utf8'));
const q = [...list]; const errs = [];
await Promise.all(Array.from({ length: JOBS }, async () => { while (q.length) { const sp = q.shift(); try {
  const e = REG.species[sp], C = REG.classes[e.class], b = BUILD[sp], w = `${WORK}/${sp}`; mkdirSync(w, { recursive: true });
  const glb = e.derive ? `${w}/source.glb` : `${WORK}/_src/${e.uid}.glb`; mkdirSync(`${WORK}/_src`, { recursive: true });
  // s18 C14 (D-790): a species derived from another's built library body (its processed lod0 and maps; animals_derive.py)
  if (e.derive) { const D = e.derive, dm = man.assets[D.from]; if (!dm?.real) throw new Error(`derive: ${D.from} is not a built library model`);
    const { ktx2rgba } = await import('./lib/ktx2png.mjs'), sharp = (await import('sharp')).default;
    for (const k of ['albedo', 'nrm']) { const { w: W, h: Hh, data } = await ktx2rgba(`${OUT}/${D.from}_${k}.ktx2`); await sharp(Buffer.from(data), { raw: { width: W, height: Hh, channels: 4 } }).png().toFile(`${w}/donor_${k}.png`); }
    const dj = { recipe: D.recipe, glb: `${OUT}/${D.from}.glb`, albedo: `${w}/donor_albedo.png`, nrm: `${w}/donor_nrm.png`, out: `${w}/derived.glb`, rig: dm.rig };
    writeFileSync(`${w}/derive.json`, JSON.stringify(dj, null, 1));
    log(await run(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/animals_derive.py', '--', `${w}/derive.json`]).then(o => o.split('\n').filter(l => l.includes('[animals_derive]')).join('\n')));
    copyFileSync(`${w}/derived.glb`, glb); }
  else if (!existsSync(glb)) { const r = await fetch(`https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/${e.shard}/${e.uid}.glb`); if (!r.ok) throw new Error(`fetch ${r.status}`); writeFileSync(glb, Buffer.from(await r.arrayBuffer())); }
  // the gear of a pack or riding animal, from the anatomy (tools/blender/sources/animal_gear.ts)
  let gear = null; if (e.gear) { await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'tools/blender/sources/animal_gear.ts', w, sp, '0.006']); gear = `${w}/gear.ply`; }
  const job = { sp, gear, glb, out_dir: w, tris: C.tris, tex: C.tex, len: b.len, h: b.h, girth: b.girth, biped: b.biped, head: b.head, rot: e.rot ?? null, kz: e.kz ?? null, drop: e.drop ?? [], tint: e.tint ?? null, tail_r: e.tail_r ?? null, no_udder: !!e.no_udder, device: 'GPU' };
  writeFileSync(`${w}/job.json`, JSON.stringify(job, null, 1));
  await run(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/animals_real.py', '--', `${w}/job.json`]);
  const st = JSON.parse(readFileSync(`${w}/stats.json`, 'utf8')), rig = JSON.parse(readFileSync(`${w}/rig.json`, 'utf8'));
  for (const [k, tf, fmt] of [['albedo', 'srgb', 'R8G8B8A8_SRGB'], ['nrm', 'linear', 'R8G8B8A8_UNORM']])
    await run(KTX, ['create', '--format', fmt, '--assign-tf', tf, '--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18', '--generate-mipmap', `${w}/${sp}_${k}.png`, `${w}/${sp}_${k}.ktx2`]);
  const files = {}; for (const f of [`${sp}.glb`, `${sp}_albedo.ktx2`, `${sp}_nrm.ktx2`]) { const bb = readFileSync(`${w}/${f}`); copyFileSync(`${w}/${f}`, `${OUT}/${f}`); files[f] = { bytes: bb.length, sha256: sha(bb) }; }
  const r4 = v => Array.isArray(v) ? v.map(r4) : typeof v === 'object' && v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r4(x)])) : typeof v === 'number' ? +v.toFixed(4) : v;
  man.assets[sp] = { inHash: realHash(sp), class: e.class, real: true, files, tris: [st.lod0, st.lod1], tex: st.tex, lod1At: +(REG.lod1_per_len * b.len).toFixed(1), ao_mean: +st.ao_mean.toFixed(3), mask_mean: 1,
    rig: r4(rig), source: { uid: e.uid, name: e.name, author: e.author, licence: e.licence, url: `https://sketchfab.com/3d-models/${e.uid}`, ...(e.derive ? { derived: `${e.derive.recipe} from ${e.derive.from} (modified: tools/blender/animals_derive.py)` } : {}) }, device: st.device, tier: 'C', src: 'LIBRARY' };
  log(`${sp}: lod0 ${st.lod0} / lod1 ${st.lod1}, ${Object.values(files).reduce((a, f) => a + f.bytes, 0)} B, ${st.seconds} s; scale ${rig.scale.toFixed(3)} kz ${rig.kz.toFixed(3)}`);
} catch (err) { errs.push(sp); console.error(`[animals_real] ${sp} FAILED: ${err.message}`); } } }));
const sorted = Object.fromEntries(Object.keys(man.assets).sort().map(k => [k, man.assets[k]]));
writeFileSync(MAN, JSON.stringify({ ...man, assets: sorted }, null, 1) + '\n');
log(`failed: ${errs.join(', ') || 'none'}`); process.exit(errs.length ? 1 : 0);
