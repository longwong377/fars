// The plain's ground cover pieces (session 12, D-335): grass tufts from CC0 Poly Haven scans (grass_medium_02,
// grass_medium_01, grass_bermuda_01; raw files with sha256 in T:/fars-assets-s12/models/manifest.json) and the modelled
// stubble and dung -> public/models/land/cover.glb + cover_{diff,nor,arm}.jpg, merged into public/models/land/manifest.json
// as class `cover` (src/world/plain/groundCover.ts loads it). Run: node tools/blender/land_cover.mjs (Blender headless, ~1 min)
import { readFileSync, writeFileSync, copyFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const WORK = process.env.WORK ?? 'T:/fars-assets-s12/land/cover', OUT = 'public/models/land';
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
if (!process.env.NOBLEND) { const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/land_cover.py', '--', WORK], { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`blender exited ${r.status}`); }
const MAN = `${OUT}/manifest.json`, man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : { about: '', classes: {} };
const files = ['cover.glb', 'cover_diff.jpg', 'cover_nor.jpg', 'cover_arm.jpg'];
for (const f of files) copyFileSync(`${WORK}/${f}`, `${OUT}/${f}`);
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
man.classes.cover = { licence: 'CC0-1.0 (the grass scans, Poly Haven); the stubble and dung modelled for the project (tools/blender/land_cover.py)', source: 'Poly Haven; PARSA',
  files: Object.fromEntries(files.map(f => [f, { bytes: statSync(`${OUT}/${f}`).size, sha256: sha(`${OUT}/${f}`) }])),
  sources: ['grass_medium_02', 'grass_medium_01', 'grass_bermuda_01'].map(id => ({ id, url: `https://polyhaven.com/a/${id}` })),
  pieces: JSON.parse(readFileSync(`${WORK}/cover.json`, 'utf8')).pieces };
writeFileSync(MAN, JSON.stringify(man, null, 1));
console.log('cover:', man.classes.cover.pieces.length, 'pieces,', (Object.values(man.classes.cover.files).reduce((s, f) => s + f.bytes, 0) / 1e6).toFixed(1), 'MB');
