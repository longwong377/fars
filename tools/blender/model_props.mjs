// The project's modelled props (session 12, D-325): runs tools/blender/model_props.py (Blender, headless) for the given
// ids (all by default) and writes public/models/props/m_<id>.glb (no Draco, no UVs, no maps: levels lod0 / lod1 of named
// parts, the baked occlusion as COLOR_0) with their entries in public/models/props/manifest.json (shared with the CC0 scans
// of tools/blender/ph_props.mjs; src/render/scanProps.ts loads both).
//   node tools/blender/model_props.mjs [id ...]
// TARGETS: per asset and part, the triangles of lod0 and lod1 (the modelled surface is collapsed to them; parts not listed
// keep their modelled count at lod0 and 35 % at lod1, or the asset's own lod1 share). The numbers are budgets (C): a piece
// seen at arm's length in a room gets 1-4 k triangles, a thing carried or instanced by the hundred a few hundred.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const OUT = 'public/models/props', WORK = process.env.WORK ?? 'T:/fars-assets-s12/props/models';
export const TARGETS = {
  couch: { metal: [2400, 800], mattress: [900, 300], bolster: [192, 64] },
  couch_covered: { metal: [1200, 400], cover: [3000, 1000] },
  table: { metal: [2400, 800] },
  footstool: { frame: [1200, 400] },
  burner: { bronze: [4000, 1400] },
  throne: { gilt: [4000, 1400], cushion: [600, 200] },
  hanging: { cloth: [2400, 800], band: [1600, 500], rod: [700, 250] },
  canopy: { gilt: [1200, 400], cloth: [2400, 800], band: [4000, 1400] },
  mat: { matting: [2600, 900] },
  hearth: { stone: [2200, 700], ash: [300, 100] },
  vat: { clay: [3000, 1000] },
  sack: { cloth: [1500, 450], cord: [120, 40] },
  sack_lying: { cloth: [1400, 420], cord: [120, 40] },
};
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const src = readFileSync('tools/blender/model_props.py', 'utf8');
const ids = want.length ? want : [...src.matchAll(/^def a_(\w+)\(/gm)].map(m => m[1]);
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const job = `${WORK}/job.json`;
writeFileSync(job, JSON.stringify({ out_dir: WORK, ids, targets: TARGETS }));
const t0 = Date.now();
const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/model_props.py', '--', job], { encoding: 'utf8', maxBuffer: 1 << 28 });
const log = (r.stdout ?? '') + (r.stderr ?? '');
for (const l of log.split('\n')) if (/\[model_props\]|Error|Traceback|\[mp\]/.test(l)) console.log(l.slice(0, 220));
if (r.status !== 0) throw new Error(`blender exited ${r.status}`);
const rep = JSON.parse(readFileSync(`${WORK}/model_props.out.json`, 'utf8'));
const MAN = `${OUT}/manifest.json`, man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', assets: {} };
for (const id of ids) {
  const R = rep[id]; if (!R) throw new Error(`no output for ${id}`);
  const buf = readFileSync(`${WORK}/${id}.glb`), key = `m_${id}`;
  writeFileSync(`${OUT}/${key}.glb`, buf);
  const parts = [...new Set(Object.keys(R.tris).map(k => k.split('__')[1]))];
  const sum = l => Object.entries(R.tris).filter(([k]) => k.startsWith(`lod${l}__`)).reduce((s, [, v]) => s + v, 0);
  man.assets[key] = { file: `models/props/${key}.glb`, of: id, role: 'model', parts, licence: 'CC0 1.0', author: 'the project: a script-built model, no third-party source', source: 'tools/blender/model_props.py (D-325)', bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'), tris: { lod0: sum(0), lod1: sum(1) }, partTris: R.tris, box: R.box, ao: R.ao, size_m: [0, 1, 2].map(i => R.box[1][i] - R.box[0][i]), tex: 0 };
}
writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n');
const mine = Object.values(man.assets).filter(a => a.role === 'model');
console.log(`[model_props] ${ids.length} built in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${mine.length} modelled props in the manifest, ${(mine.reduce((s, a) => s + a.bytes, 0) / 1e6).toFixed(2)} MB`);
