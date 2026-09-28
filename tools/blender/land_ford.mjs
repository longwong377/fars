// The fords' cobbles and hide boat (session 12, D-335): tools/blender/land_ford.py (own work, Blender 5.0.1) ->
// public/models/land/ford.glb (plain GLB: position, normal, COLOR_0 = colour x baked occlusion) merged into
// public/models/land/manifest.json as class `ford` (src/world/plain/fordDetail.ts loads it). Run: node tools/blender/land_ford.mjs
import { readFileSync, writeFileSync, copyFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const WORK = process.env.WORK ?? 'T:/fars-assets-s12/land/ford', OUT = 'public/models/land';
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
if (!process.env.NOBLEND) { const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/land_ford.py', '--', WORK], { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`blender exited ${r.status}`); }
const MAN = `${OUT}/manifest.json`, man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', classes: {} };
copyFileSync(`${WORK}/ford.glb`, `${OUT}/ford.glb`);
man.classes.ford = { licence: 'CC0-1.0 (project: own work, tools/blender/land_ford.py)', source: 'PARSA',
  files: { 'ford.glb': { bytes: statSync(`${OUT}/ford.glb`).size, sha256: createHash('sha256').update(readFileSync(`${OUT}/ford.glb`)).digest('hex') } },
  pieces: JSON.parse(readFileSync(`${WORK}/ford.json`, 'utf8')).pieces };
writeFileSync(MAN, JSON.stringify(man, null, 1));
console.log('ford:', man.classes.ford.pieces.map(p => `${p.id} ${JSON.stringify(p.tris)}`).join('; '), (statSync(`${OUT}/ford.glb`).size / 1e6).toFixed(2), 'MB');
