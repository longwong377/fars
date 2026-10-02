// s17 C7 (D-610): the furnished rooms' own kit pieces (tools/blender/interior_props.py) built and entered in
// public/models/props/manifest.json as m_i_<id>.glb (model_props.mjs's format: levels lod0..lod2 of named parts, the baked
// occlusion as COLOR_0; src/render/scanProps.ts loads them with the rest). In the cloud: BLENDER=tools/blender/bpy_cli.sh.
//   node tools/blender/interior_props.mjs [id ...]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const OUT = 'public/models/props', WORK = process.env.WORK ?? (process.platform === 'win32' ? 'T:/fars-assets-s17/interior' : '/tmp/fars-interior');
/** triangles per part at lod0, lod1, lod2 (a room is seen from its doorway; a ring holds a few dozen rooms) */
export const TARGETS = {
  i_cushion: { textile: [900, 300, 70], cord: [300, 100, 30] },
  i_onions: { bulb: [1600, 520, 130], stem: [500, 160, 40], cord: [60, 30, 16] },
  i_herbs: { leaf: [1400, 450, 110], stem: [400, 130, 30], cord: [120, 40, 16] },
  i_low_table: { wood: [1200, 400, 120] },
  i_wheel: { stone: [500, 160, 50], wood: [700, 230, 70], clay: [300, 100, 30] },
  i_bedding: { mud: [400, 140, 40], textile_a: [900, 300, 80], textile_b: [1000, 330, 90] },
};
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const src = readFileSync('tools/blender/interior_props.py', 'utf8');
const ids = want.length ? want : [...src.matchAll(/^def a_(\w+)\(/gm)].map(m => m[1]);
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const job = `${WORK}/job.json`;
writeFileSync(job, JSON.stringify({ out_dir: WORK, ids, targets: TARGETS }));
const t0 = Date.now();
const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/interior_props.py', '--', job], { encoding: 'utf8', maxBuffer: 1 << 28 });
const log = (r.stdout ?? '') + (r.stderr ?? '');
for (const l of log.split('\n')) if (/\[interior_props\]|Error|Traceback|line \d+/.test(l)) console.log(l.slice(0, 220));
if (r.status !== 0) throw new Error(`blender exited ${r.status}`);
const rep = JSON.parse(readFileSync(`${WORK}/interior_props.out.json`, 'utf8'));
const MAN = `${OUT}/manifest.json`, man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', assets: {} };
for (const id of ids) {
  const R = rep[id]; if (!R) throw new Error(`no output for ${id}`);
  const buf = readFileSync(`${WORK}/${id}.glb`), key = `m_${id}`;
  writeFileSync(`${OUT}/${key}.glb`, buf);
  const parts = [...new Set(Object.keys(R.tris).map(k => k.split('__')[1]))];
  const sum = l => Object.entries(R.tris).filter(([k]) => k.startsWith(`lod${l}__`)).reduce((s, [, v]) => s + v, 0);
  man.assets[key] = { file: `models/props/${key}.glb`, of: id, role: 'model', parts, licence: 'CC0 1.0', author: 'the project: a script-built model, no third-party source', source: 'tools/blender/interior_props.py (D-610)', bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'), tris: { lod0: sum(0), lod1: sum(1), lod2: sum(2) }, partTris: R.tris, box: R.box, ao: R.ao, size_m: [0, 1, 2].map(i => R.box[1][i] - R.box[0][i]), tex: 0 };
  console.log(`[interior_props] ${key}: ${(buf.length / 1024).toFixed(0)} KB, lod2 ${sum(2)} triangles, ${R.seconds} s`);
}
writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n');
console.log(`[interior_props] ${ids.length} built in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
