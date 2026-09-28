// PARSA (D-329): builds the Blender-modelled monuments (BLENDER_PLAN rows 15-16) and writes them where the game loads them.
//   node tools/blender/monuments.mjs [ajori|naqsh ...] [--device=GPU] [--preview] [--work=T:/fars-assets-s12/ajori_naqsh/<id>] [--check]
// Per asset: its numbers from the project's own data (the plan through tsx), one headless Blender run (tools/blender/<id>.py:
// height-field tiles carved and baked in Cycles, the model built, its light map baked, exported as a plain GLB), the PNG maps
// re-encoded as JPEG (sharp; normals 4:4:4 at q 95), then public/models/monuments/<id>.glb, public/models/monuments/<id>/*.jpg
// and the asset's entry in public/models/monuments/manifest.json (sha256 of every file, triangles per mesh, the bake's
// statistics, the input hash: tests/monuments.test.ts recomputes it). --device=GPU runs Blender through the GPU slots.
// --check: exit 1 when an asset's inputs changed since its build.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
process.chdir(ROOT);
const args = process.argv.slice(2), flag = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : args.includes(`--${k}`) ? true : d; };
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const SLOT = process.env.GPU_SLOT_SCRIPT ?? 'C:/Users/Administrator/fars-assets/gpu_slot.mjs';
const OUT = 'public/models/monuments', MAN = `${OUT}/manifest.json`;
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const log = (...a) => console.log('[monuments]', ...a);
const tsx = (code) => { const f = resolve('.mon_tmp.ts'); writeFileSync(f, code); try { return execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', f], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 28 }).trim().split(/\r?\n/).pop(); } finally { try { unlinkSync(f); } catch {} } };

export const ASSETS = {
  ajori: {
    script: 'tools/blender/ajori.py', files: ['tools/blender/ajori.py', 'tools/blender/ajori_tiles.py', 'tools/blender/ajori_model.py', 'tools/blender/mon_lib.py'],
    data: () => ({ plan: JSON.parse(tsx("import {AJORI} from './src/world/settlement/plan'; console.log(JSON.stringify(AJORI))")) }),
    maps: { brick_n: [95, false], glaze_n: [95, false], glaze_a: [92, false], glaze_c: [92, true], light_a: [92, false] },
    tier: 'B/C', src: 'TOLAJORI2017;AJORI-BRICK2018;AMADORI2023;WP-ISHTAR',
    note: 'Tol-e Ajori gate: plan B (TOLAJORI2017), baked-brick facing B (AJORI-BRICK2018), glazes, sunk outlines, rosettes and the two motifs B (AMADORI2023); brick module, relief depth, rows, drawing, merlons, height and weathering C',
  },
  naqsh: {
    script: 'tools/blender/naqsh.py', files: ['tools/blender/naqsh.py', 'tools/blender/naqsh_facade.py', 'tools/blender/naqsh_kaba.py', 'tools/blender/mon_lib.py', 'tools/blender/naqsh_src.ts', 'src/data/plain.json', 'tools/blender/sources/protome.ts', 'src/arch/sculpt_models.ts', 'tools/blender/carving.json'],
    data: () => { const w = flag('work', 'T:/fars-assets-s12/ajori_naqsh/naqsh'); mkdirSync(w, { recursive: true }); const d = JSON.parse(tsx(`import {writeNaqshSource} from './tools/blender/naqsh_src'; console.log(JSON.stringify(writeNaqshSource(${JSON.stringify(w)})))`));
      // the capitals' protome: the project's own source (the Apadana model and carving) at a cell fit for 20 m and beyond
      if (!existsSync(`${w}/protome/high.ply`)) execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'tools/blender/sources/protome.ts', `${w}/protome`, '0.007', '1000', '1'], { stdio: 'inherit', shell: process.platform === 'win32' });
      // the game's cliff as handed over (not naqsh.ts's text: its builder changes without changing the cliff)
      const src_sha = ['cliff_low.bin', 'cliff_grid.bin'].map(f => sha(readFileSync(`${w}/${f}`)));
      return { ...d, src_sha, protome_dir: `${w}/protome`, ao_samples: 48, ao_samples_facade: 96 }; },
    maps: { cliff_n: [93, false], cliff_a: [92, false], facade_n: [95, false], facade_a: [92, false], kaba_n: [95, false], kaba_a: [92, false] },
    tier: 'B/C', src: 'NR-ACHAEMENICA;NR-IRANICA;WP-NR;LIVIUS-NR;RECON',
    note: 'Naqsh-e Rustam: the cliff as a Blender-baked rock surface (strata, joints, fissures, flutes, spalls: C), the tomb façades\' carved architecture (programme B, forms C) and the Ka\'ba (B/C)',
  },
};
export function inputHash(id, data) {
  const h = createHash('sha256');
  for (const p of ASSETS[id].files) { const b = readFileSync(p); h.update(p); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b); }
  h.update(JSON.stringify(data ?? null)); return h.digest('hex');
}
const sha = (b) => createHash('sha256').update(b).digest('hex');

const want = args.filter(a => !a.startsWith('--')); const ids = want.length ? want : Object.keys(ASSETS);
const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', assets: {} };
man.about = 'Generated by tools/blender/monuments.mjs (D-329); do not edit. Per asset: the plain GLB (named meshes: position, normal, TEXCOORD_0, TEXCOORD_1 = the light map), its KTX2 maps (normal RGB OpenGL, or for the Ajori brick_n R G the normal and B the albedo x2 with the joint occlusion; aux R occlusion, G albedo x2, B roughness; colour), sha256 of each, triangles per mesh, the bake statistics, the Blender version and device, the input hash.';
if (flag('check', false)) { let bad = 0; for (const id of ids) { const ok = man.assets[id]?.inHash === inputHash(id, ASSETS[id].data()); log(id, ok ? 'current' : 'STALE'); bad += ok ? 0 : 1; } process.exit(bad ? 1 : 0); }
const sharp = (await import('sharp')).default;
for (const id of ids) {
  const A = ASSETS[id], t0 = Date.now(), WORK = flag('work', `T:/fars-assets-s12/ajori_naqsh/${id}`); mkdirSync(WORK, { recursive: true });
  const data = A.data(), device = flag('device', 'CPU');
  const job = `${WORK}/job.json`; writeFileSync(job, JSON.stringify({ out_dir: WORK, device, stages: id === 'naqsh' ? ['cliff', 'facade', 'kaba'] : ['tiles', 'model'], preview: !!flag('preview', false), ...data }));
  const MAPS_ONLY = !!flag('maps-only', false);
  const bl = [BLENDER, '-b', '--factory-startup', '--python', A.script, '--', job];
  const r = MAPS_ONLY ? { status: 0, stdout: '', stderr: '' } : device === 'GPU' ? spawnSync('node', [SLOT, `blender-${id}`, '--', ...bl.map(x => (x.includes(' ') ? `"${x}"` : x))], { encoding: 'utf8', maxBuffer: 1 << 28 })
    : spawnSync(bl[0], bl.slice(1), { encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  for (const l of out.split('\n')) if (/\[mon\]|Error|Traceback|line \d+/.test(l)) console.log(l.slice(0, 240));
  if (r.status !== 0) throw new Error(`blender exited ${r.status}`);
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  const glb = readFileSync(`${WORK}/${id}.glb`); writeFileSync(`${OUT}/${id}.glb`, glb);
  const stats = JSON.parse(readFileSync(`${WORK}/model_stats.json`, 'utf8'));
  const maps = {};
  // KTX2 (UASTC + zstd, box-filtered mipmaps): the GPU keeps them block-compressed (BC7 on desktop, 1 byte a texel) where the
  // JPEGs decoded to 4 bytes a texel plus mips (~200 MB for both sites); the colour map in sRGB, the rest linear
  for (const f of readdirSync(`${OUT}/${id}`)) if (/.(jpg|ktx2)$/.test(f)) unlinkSync(`${OUT}/${id}/${f}`);
  for (const [k, [, srgb]] of Object.entries(A.maps)) {
    const f = `${OUT}/${id}/${k}.ktx2`, rgba = `${WORK}/${k}.rgba.png`, img = sharp(`${WORK}/${k}.png`), meta = await img.metadata();
    await img.ensureAlpha(1).png({ compressionLevel: 1 }).toFile(rgba);
    const kr = spawnSync(KTX, ['create', '--format', srgb ? 'R8G8B8A8_SRGB' : 'R8G8B8A8_UNORM', '--assign-tf', srgb ? 'srgb' : 'linear', '--assign-primaries', srgb ? 'bt709' : 'none',
      '--generate-mipmap', '--mipmap-filter', 'box', '--encode', 'uastc', '--uastc-quality', '1', '--uastc-rdo', '--zstd', '18', rgba, f], { encoding: 'utf8' });
    if (kr.status !== 0) throw new Error(`ktx ${k}: ${kr.stderr}`);
    const b = readFileSync(f); maps[k] = { file: `models/monuments/${id}/${k}.ktx2`, w: meta.width, h: meta.height, bytes: b.length, sha256: sha(b), ...(srgb ? { srgb: true } : {}) };
  }
  const tris = Object.fromEntries(Object.entries(stats).filter(([k]) => k.startsWith('tris_')).map(([k, v]) => [k.slice(5), v]));
  man.assets[id] = { file: `models/monuments/${id}.glb`, sha256: sha(glb), bytes: glb.length, tris, maps, tier: A.tier, src: A.src, note: A.note,
    blender: stats.blender, device: stats.device, inHash: inputHash(id, data), stats: Object.fromEntries(Object.entries(stats).filter(([, v]) => typeof v === 'number')) };
  writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n');
  const mb = (glb.length + Object.values(maps).reduce((s, m) => s + m.bytes, 0)) / 1e6;
  log(`${id}: ${JSON.stringify(tris)} triangles, ${mb.toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
