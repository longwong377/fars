// The fill's modelled props (session 15, D-367): runs tools/blender/fill_props.py (Blender, headless; model_props.py's library
// and level/AO pipeline) and writes public/models/props/m_fill_<id>.glb with their entries in public/models/props/manifest.json
// (role 'model', loaded by src/render/scanProps.ts like every modelled prop: model('fill_<id>')).
//   node tools/dev/cpu_slot.mjs fillprops -- node tools/blender/fill_props.mjs [id ...]
// TARGETS: per part, the triangles of lod0 / lod1 / lod2 (budgets, C: instanced by the hundred in the lanes, so lod1 a few
// hundred to ~2 k per piece).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const OUT = 'public/models/props', WORK = process.env.WORK ?? 'C:/Users/Administrator/fill-work';
export const TARGETS = {
  stall: { wood: [3200, 1000, 400], mud: [400, 150, 60], cloth: [2600, 800, 300], cord: [80, 40, 16] },
  awning: { wood: [1800, 600, 240], cloth: [2400, 700, 260], cord: [80, 40, 16] },
  produce: { wicker: [1600, 500, 200], fruit: [2400, 700, 220] },
  grain: { cloth: [900, 300, 120], grain: [700, 220, 80], wood: [200, 60, 30] },
  bolts: { reed: [24, 12, 12], textile_a: [900, 300, 100], textile_b: [900, 300, 100] },
  pots: { reed: [24, 12, 12], clay: [4000, 1200, 400] },
  line: { cord: [160, 80, 40], wood: [80, 40, 20], cloth_a: [900, 300, 120], cloth_b: [700, 240, 100] },
  bundle: { wood: [2400, 700, 250], cord: [120, 50, 20] },
  standard: { wood: [900, 300, 120], stone: [400, 150, 60], cloth: [1800, 600, 200], gilt: [1400, 450, 150] },
  chips: { fines: [1600, 500, 200], stone: [3000, 900, 300] },
  block: { stone: [2400, 700, 250], wood: [500, 160, 60] },
  scaffold: { wood: [6000, 1800, 600], cord: [1200, 300, 0] },
  rubble: { mud: [1200, 400, 150], brick: [1600, 500, 160] },
  // s17 C1 (D-550): the lanes' and doorways' lesser things
  litter: { straw: [1400, 420, 140], dung: [500, 160, 60], clay: [120, 60, 24], wood: [150, 60, 24] },
  matlean: { reed: [2400, 700, 180] },
  basket_tall: { wicker: [1600, 500, 160], cord: [160, 60, 24] },
  winnow: { wicker: [1200, 360, 120] },
  reed_awning: { wood: [1800, 600, 220], reed: [1800, 520, 180], cord: [80, 40, 16] },
  skin: { wood: [120, 50, 20], hide: [900, 300, 100], cord: [120, 50, 20] },
};
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const src = readFileSync('tools/blender/fill_props.py', 'utf8');
const ids = want.length ? want : [...src.matchAll(/^def a_(\w+)\(/gm)].map(m => m[1]);
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const job = `${WORK}/job.json`;
// (a part whose lod2 target is 0 is left at lod1)
const targets = Object.fromEntries(Object.entries(TARGETS).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([p, t]) => [p, t[2] ? t : t.slice(0, 2)]))]));
writeFileSync(job, JSON.stringify({ out_dir: WORK, ids, targets }));
const t0 = Date.now();
const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/fill_props.py', '--', job], { encoding: 'utf8', maxBuffer: 1 << 28 });
const log = (r.stdout ?? '') + (r.stderr ?? '');
for (const l of log.split('\n')) if (/\[fill_props\]|Error|Traceback|\[mp\]|line \d+/.test(l)) console.log(l.slice(0, 260));
if (r.status !== 0) throw new Error(`blender exited ${r.status}`);
const rep = JSON.parse(readFileSync(`${WORK}/fill_props.out.json`, 'utf8'));
const MAN = `${OUT}/manifest.json`, man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', assets: {} };
for (const id of ids) {
  const key0 = `fill_${id}`, R = rep[key0]; if (!R) throw new Error(`no output for ${id}`);
  const buf = readFileSync(`${WORK}/${key0}.glb`), key = `m_${key0}`;
  writeFileSync(`${OUT}/${key}.glb`, buf);
  const parts = [...new Set(Object.keys(R.tris).map(k => k.split('__')[1]))];
  const sum = l => Object.entries(R.tris).filter(([k]) => k.startsWith(`lod${l}__`)).reduce((s, [, v]) => s + v, 0);
  man.assets[key] = { file: `models/props/${key}.glb`, of: key0, role: 'model', parts, licence: 'CC0 1.0', author: 'the project: a script-built model, no third-party source', source: 'tools/blender/fill_props.py (D-367)', bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'), tris: { lod0: sum(0), lod1: sum(1), lod2: sum(2) }, partTris: R.tris, box: R.box, ao: R.ao, size_m: [0, 1, 2].map(i => R.box[1][i] - R.box[0][i]), tex: 0 };
  console.log(`[fill_props] ${key}: lod0 ${sum(0)} lod1 ${sum(1)} lod2 ${sum(2)} tris, size ${man.assets[key].size_m.map(v => v.toFixed(2)).join(' x ')} m, ${(buf.length / 1024).toFixed(0)} KB`);
}
writeFileSync(MAN, JSON.stringify(man, null, 1) + '\n');
console.log(`[fill_props] ${ids.length} built in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
