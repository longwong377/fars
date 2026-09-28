// PARSA small life (D-332; BLENDER_PLAN rows 13 and 20): builds the modelled birds, small creatures and ground flora.
//   node tools/blender/life.mjs <birds|small|flora> [id ...] [--procs=N] [--threads=T] [--work=T:/fars-assets-s12/smalllife/<class>] [--check]
// For the class's registry (tools/blender/life_<class>.json), all ids or those named:
//  1. the Blender stage (tools/blender/life_<class>.py), the ids shared among N headless Blender processes: each id's
//     parametric model, its dense source, the Cycles bakes and one plain GLB with its levels (see the script's header);
//  2. KTX2 (UASTC + zstd, mipmaps; the albedo sRGB with its coverage in alpha, the normal map linear with the occlusion in
//     alpha) with the KTX-Software CLI;
//  3. public/models/life/<id>.glb, <id>_albedo.ktx2, <id>_nrm.ktx2 and public/models/life/manifest.json (the class, the
//     input hash, the output hashes, the levels' triangles, the map size and the model's own numbers the game needs: what
//     src/world/lifeModels.ts loads and tests/life_models.test.ts checks).
// --check: list the ids whose inputs changed since their build (exit 1 if any).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
process.chdir(ROOT);
const args = process.argv.slice(2), flag = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : args.includes(`--${k}`) ? true : d; };
const CLS = args[0]; if (!['birds', 'small', 'flora'].includes(CLS)) { console.error('class: birds | small | flora'); process.exit(2); }
const REGP = `tools/blender/life_${CLS}.json`, REG = JSON.parse(readFileSync(REGP, 'utf8'));
const WORK = flag('work', `T:/fars-assets-s12/smalllife/${CLS}`), PROCS = +flag('procs', 4), THREADS = +flag('threads', 4), CHECK = !!flag('check', false);
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const OUT = 'public/models/life', MAN = `${OUT}/manifest.json`;
const sha = b => createHash('sha256').update(b).digest('hex');
const want = args.slice(1).filter(a => !a.startsWith('--')), list = want.length ? want : Object.keys(REG.species);
for (const s of list) if (!REG.species[s]) { console.error(`unknown ${CLS} id ${s}`); process.exit(2); }
const log = (...a) => console.log('[life]', ...a);
/** the input hash of an id: its registry entry and the registry's shared numbers, the scripts */
export const lifeHash = id => sha(JSON.stringify({ e: REG.species[id], shared: Object.fromEntries(Object.entries(REG).filter(([k]) => k !== 'species' && k !== 'about')) })
  + readFileSync(`tools/blender/life_${CLS}.py`, 'utf8') + readFileSync('tools/blender/life_lib.py', 'utf8'));

const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: 'D-332: the modelled small life (tools/blender/life.mjs)', assets: {} };
if (CHECK) { let st = 0; for (const id of list) { const ok = man.assets[id]?.inHash === lifeHash(id); if (!ok) st++; log(id, ok ? 'current' : 'STALE'); } process.exit(st ? 1 : 0); }
const run = (cmd, argv) => new Promise((res, rej) => { const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', d => { out += d; for (const l of String(d).split('\n')) if (l.startsWith('[life]') && !l.includes('baked')) console.log(l.slice(0, 160)); }); p.stderr.on('data', d => out += d);
  p.on('close', c => (c === 0 ? res(out) : rej(new Error(`${cmd} ${argv.slice(0, 5).join(' ')} exited ${c}\n${out.slice(-2500)}`)))); });

mkdirSync(OUT, { recursive: true }); mkdirSync(WORK, { recursive: true });
const t0 = Date.now(), ktxV = spawnSync(KTX, ['--version'], { encoding: 'utf8' }).stdout?.trim();
const blenderV = /Blender (\S+)/.exec(spawnSync(BLENDER, ['--version'], { encoding: 'utf8' }).stdout ?? '')?.[1] ?? '?';
log(`${CLS}: ${list.length} ids; Blender ${blenderV}; ${ktxV ?? 'no ktx'}; ${PROCS} processes; work ${WORK}`);
const groups = Array.from({ length: Math.min(PROCS, list.length) }, () => []); list.forEach((id, i) => groups[i % groups.length].push(id));
const errs = [];
await Promise.all(groups.map(async (ids, g) => {
  const jp = `${WORK}/job_${g}.json`; writeFileSync(jp, JSON.stringify({ reg: REGP, ids, out: WORK, device: 'CPU', threads: THREADS }, null, 1));
  try { await run(BLENDER, ['-b', '--factory-startup', '--python', `tools/blender/life_${CLS}.py`, '--', jp]); } catch (e) { errs.push(e); console.error(e.message); }
}));
const stats = {}; for (const [g, ids] of groups.entries()) { const p = `${WORK}/stats_${ids[0]}_${ids.length}.json`; if (existsSync(p)) Object.assign(stats, JSON.parse(readFileSync(p, 'utf8'))); }
for (const id of list) {
  const st = stats[id]; if (!st) { console.error(`[life] ${id}: no stats (failed)`); continue; }
  for (const [k, tf, fmt] of [['albedo', 'srgb', 'R8G8B8A8_SRGB'], ['nrm', 'linear', 'R8G8B8A8_UNORM']])
    await run(KTX, ['create', '--format', fmt, '--assign-tf', tf, '--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18', '--generate-mipmap', `${WORK}/${id}_${k}.png`, `${WORK}/${id}_${k}.ktx2`]);
  const files = {}; for (const f of [`${id}.glb`, `${id}_albedo.ktx2`, `${id}_nrm.ktx2`]) { const b = readFileSync(`${WORK}/${f}`); copyFileSync(`${WORK}/${f}`, `${OUT}/${f}`); files[f] = { bytes: b.length, sha256: sha(b) }; }
  const e = REG.species[id]; const { seconds, device, ...keep } = st;
  man.assets[id] = { class: CLS, name: e.name, of: e.of ?? id, inHash: lifeHash(id), files, ...keep, blender: blenderV, device, ktx: ktxV, tier: 'C', src: 'RECON' };
  log(`${id}: ${JSON.stringify(st.tris)} tris, ${Object.values(files).reduce((a, f) => a + f.bytes, 0)} B`);
}
man.assets = Object.fromEntries(Object.keys(man.assets).sort().map(k => [k, man.assets[k]]));
writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n');
log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${errs.length} failed process(es)`);
process.exit(errs.length ? 1 : 0);
