// s15/load (D-354): the CC0 surface scans (public/textures/<id>/{diff,arm,nor}.jpg) as GPU-compressed KTX2 (UASTC with RDO,
// Zstandard, their own mips; the page transcodes to BC7 on this GPU): a 2048² map holds 5.3 MB on the GPU instead of 21 MB
// as RGBA8 with mips, and no decoded image stays in the page. Rows stored bottom-up (the jpgs are uploaded flipped, flipY), so
// both forms put the same texel at the same uv. Written beside each jpg (<map>.ktx2); src/render/scans.ts loads
// the KTX2 when public/textures/ktx.json lists it and the jpg otherwise. Skips a map whose jpg is unchanged since its encode. One encode at a time (4 threads).
//   LONG=1 node tools/dev/cpu_slot.mjs load -- npx tsx tools/bake_world/ktx_scans.ts [id,...]
// (default: every scan the materials load through the texture path, SCAN_USE; the ground layers are one array texture, apart)
import { readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { SCAN_USE } from '../../src/render/scans';
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', DIR = 'public/textures', only = process.argv[2]?.split(',');
const USED = new Map<string, Set<string>>(); for (const u of Object.values(SCAN_USE) as any[]) for (const [id, nor] of [[u.scan, u.nor], ...(u.rock ? [[u.rock.scan, false]] : [])]) { const m = USED.get(id) ?? new Set(['diff', 'arm']); if (nor) m.add('nor'); USED.set(id, m); }
const MAPS: Record<string, [string, string]> = { diff: ['R8G8B8_SRGB', 'srgb'], arm: ['R8G8B8_UNORM', 'linear'], nor: ['R8G8B8_UNORM', 'linear'] };
const LIST = join(DIR, 'ktx.json'), sha = (p: string) => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 16);
const done: Record<string, string> = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')).maps ?? {} : {};
// the list: each encoded map and the hash of the jpg it was made from (a changed jpg is encoded again)
const writeList = () => writeFileSync(LIST, JSON.stringify({ about: 'D-354: the scans encoded as KTX2 (tools/bake_world/ktx_scans.ts), each with the hash of its jpg; src/render/scans.ts loads these instead of their jpg', maps: Object.fromEntries(Object.entries(done).sort()) }, null, 1));
let n = 0, inB = 0, outB = 0; const t0 = Date.now();
for (const id of readdirSync(DIR)) {
  if (only ? !only.includes(id) : !USED.has(id)) continue; const d = join(DIR, id); if (!statSync(d).isDirectory()) continue;
  for (const [map, [fmt, tf]] of Object.entries(MAPS)) { if (!only && !USED.get(id)!.has(map)) continue;
    const src = join(d, `${map}.jpg`), dst = join(d, `${map}.ktx2`); if (!existsSync(src)) continue;
    const h = sha(src); if (existsSync(dst) && done[`${id}/${map}`] === h) { inB += statSync(src).size; outB += statSync(dst).size; continue; }
    const t = Date.now();
    execFileSync(KTX, ['create', '--format', fmt, '--assign-tf', tf, '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '0.5',
      '--convert-texcoord-origin', 'bottom-left', '--zstd', '18', '--generate-mipmap', '--threads', '4', src, dst], { stdio: ['ignore', 'ignore', 'inherit'] });
    done[`${id}/${map}`] = h; writeList(); n++; inB += statSync(src).size; outB += statSync(dst).size;
    console.log(`${id}/${map}: ${((Date.now() - t) / 1000).toFixed(1)} s, ${(statSync(src).size / 1048576).toFixed(1)} -> ${(statSync(dst).size / 1048576).toFixed(1)} MB`);
  }
}
console.log(`encoded ${n} in ${((Date.now() - t0) / 1000).toFixed(0)} s; jpg ${(inB / 1048576).toFixed(0)} MB, ktx2 ${(outB / 1048576).toFixed(0)} MB`);
