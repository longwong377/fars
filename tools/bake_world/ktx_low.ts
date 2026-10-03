// s18 C9 (D-740): the KTX2 scans' low-first twins. For every map public/textures/ktx.json lists (the UASTC scans,
// tools/bake_world/ktx_scans.ts) and the ground's array (ground/ground.ktx2, tools/bake_world/ktx_ground.ts), an ETC1S
// (BasisLZ) copy `<map>.low.ktx2` from the same source at the same size, with the same mips and texel origin: Basis transcodes
// both to the same GPU format (BC7 on the T4), so src/render/lowfirst.ts draws the twin before ready and swaps the UASTC mips
// into the same texture after it. Listed in public/textures/ktx_low.json with the hash of the source they were made from.
//   KTX=<ktx> npx tsx tools/bake_world/ktx_low.ts [key,...]
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import sharp from 'sharp';
import { GROUND, GROUND_RES } from '../../src/render/scans';
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', DIR = 'public/textures', only = process.argv[2]?.split(',');
const LIST = join(DIR, 'ktx_low.json'), sha = (p: string) => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 16);
const done: Record<string, string> = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')).maps ?? {} : {};
const writeList = () => writeFileSync(LIST, JSON.stringify({ about: 'D-740: ETC1S twins of the KTX2 scans (tools/bake_world/ktx_low.ts), each with the hash of the full KTX2 it stands in for; src/render/lowfirst.ts loads them first', maps: Object.fromEntries(Object.entries(done).sort()) }, null, 1));
// (qlevel 128: a twin is on screen for the first minute only; ~0.5-1 MB a 2048² map)
const ETC1S = ['--encode', 'basis-lz', '--clevel', '2', '--qlevel', '128', '--generate-mipmap', '--threads', process.env.THREADS ?? '2'];
const scans = Object.keys(JSON.parse(readFileSync(join(DIR, 'ktx.json'), 'utf8')).maps) as string[];
let n = 0, full = 0, low = 0; const t0 = Date.now();
for (const k of scans) {
  if (only && !only.includes(k)) continue;
  const [id, map] = k.split('/'), src = join(DIR, id, `${map}.jpg`), ref = join(DIR, id, `${map}.ktx2`), dst = join(DIR, id, `${map}.low.ktx2`);
  if (!existsSync(src) || !existsSync(ref)) continue;
  const h = sha(ref); full += statSync(ref).size;
  if (existsSync(dst) && done[k] === h) { low += statSync(dst).size; continue; }
  const [fmt, tf] = map === 'diff' ? ['R8G8B8_SRGB', 'srgb'] : ['R8G8B8_UNORM', 'linear'];
  execFileSync(KTX, ['create', '--format', fmt, '--assign-tf', tf, ...ETC1S, '--convert-texcoord-origin', 'bottom-left', src, dst], { stdio: ['ignore', 'ignore', 'inherit'] });
  done[k] = h; writeList(); n++; low += statSync(dst).size;
  console.log(`${k}: ${(statSync(ref).size / 1048576).toFixed(1)} -> ${(statSync(dst).size / 1048576).toFixed(2)} MB`);
}
// the ground's array: the same layers (diff RGB, height A) as ktx_ground.ts, top-down rows
const G = join(DIR, 'ground', 'ground.ktx2');
if (existsSync(G) && (!only || only.includes('ground/ground'))) {
  const h = sha(G); full += statSync(G).size;
  if (done['ground/ground'] !== h || !existsSync(join(DIR, 'ground', 'ground.low.ktx2'))) {
    const tmp = join(DIR, 'ground', 'tmp-low'); mkdirSync(tmp, { recursive: true }); const R = GROUND_RES, pngs: string[] = [];
    for (const key of Object.keys(GROUND) as (keyof typeof GROUND)[]) {
      const id = GROUND[key], raw = async (p: string) => (await sharp(readFileSync(p)).resize(R, R, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
      const diff = await raw(join(DIR, id, 'diff.jpg')), dp = join(DIR, id, 'disp.jpg'), disp = existsSync(dp) ? await raw(dp) : null, out = Buffer.alloc(R * R * 4);
      for (let p = 0, i = 0; p < R * R; p++, i += 4) { const c = p * 3; out[i] = diff[c]; out[i + 1] = diff[c + 1]; out[i + 2] = diff[c + 2]; out[i + 3] = disp ? disp[c] : Math.round(0.2126 * diff[c] + 0.7152 * diff[c + 1] + 0.0722 * diff[c + 2]); }
      const f = join(tmp, `${key}.png`); await sharp(out, { raw: { width: R, height: R, channels: 4 } }).png({ compressionLevel: 1 }).toFile(f); pngs.push(f);
    }
    const dst = join(DIR, 'ground', 'ground.low.ktx2');
    execFileSync(KTX, ['create', '--format', 'R8G8B8A8_SRGB', '--assign-tf', 'srgb', '--layers', String(pngs.length), ...ETC1S, ...pngs, dst], { stdio: ['ignore', 'ignore', 'inherit'] });
    rmSync(tmp, { recursive: true, force: true }); done['ground/ground'] = h; writeList(); n++;
    console.log(`ground/ground: ${(statSync(G).size / 1048576).toFixed(1)} -> ${(statSync(dst).size / 1048576).toFixed(2)} MB`);
  }
  low += statSync(join(DIR, 'ground', 'ground.low.ktx2')).size;
}
writeList();
console.log(`made ${n} twins in ${((Date.now() - t0) / 1000).toFixed(0)} s; full KTX2 ${(full / 1048576).toFixed(0)} MB, twins ${(low / 1048576).toFixed(0)} MB`);
