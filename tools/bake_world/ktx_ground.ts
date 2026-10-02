// s15/load (D-354): the ground's twelve scan layers (src/render/scans.ts GROUND: RGB the scan's colour, A its height: the
// displacement map, or the colour's luminance where there is none) as one KTX2 array texture (UASTC + RDO, Zstandard, mips):
// BC7 on the GPU, 64 MB instead of 256 MB, and the page skips decoding 24 jpgs and packing 192 MB by hand. The heights' mean
// and sd (the page measured them on load) are written beside it. Rows top-down, as the page's DataArrayTexture (no flip).
//   LONG=1 node tools/dev/cpu_slot.mjs load -- npx tsx tools/bake_world/ktx_ground.ts
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { GROUND, GROUND_RES } from '../../src/render/scans';
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', DIR = 'public/textures', R = GROUND_RES, OUT = join(DIR, 'ground');
const keys = Object.keys(GROUND) as (keyof typeof GROUND)[], tmp = join(OUT, 'tmp'); mkdirSync(tmp, { recursive: true });
const h = createHash('sha1'); h.update(`v1|${R}|${keys.join(',')}`);
const raw = async (p: string) => { const b = readFileSync(p); h.update(b); return (await sharp(b).resize(R, R, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data; };
const stats: Record<string, { hMean: number; hSd: number }> = {}, pngs: string[] = [];
for (const k of keys) {
  const id = GROUND[k], diff = await raw(join(DIR, id, 'diff.jpg')), dp = join(DIR, id, 'disp.jpg'), disp = existsSync(dp) ? await raw(dp) : null;
  const out = Buffer.alloc(R * R * 4); let s = 0, s2 = 0, n = 0;
  for (let p = 0, i = 0; p < R * R; p++, i += 4) { const c = p * 3;
    const hh = disp ? disp[c] : Math.round(0.2126 * diff[c] + 0.7152 * diff[c + 1] + 0.0722 * diff[c + 2]);
    out[i] = diff[c]; out[i + 1] = diff[c + 1]; out[i + 2] = diff[c + 2]; out[i + 3] = hh;
    if ((i & 60) === 0) { s += hh; s2 += hh * hh; n++; } } // (the page's own sampling)
  const m = s / n / 255; stats[k] = { hMean: m, hSd: Math.sqrt(Math.max(1e-6, s2 / n / 65025 - m * m)) };
  const f = join(tmp, `${k}.png`); await sharp(out, { raw: { width: R, height: R, channels: 4 } }).png({ compressionLevel: 1 }).toFile(f); pngs.push(f);
  console.log(`${k} (${id}): height mean ${m.toFixed(3)} sd ${stats[k].hSd.toFixed(3)}${disp ? '' : ' (luminance)'}`);
}
const src = h.digest('hex').slice(0, 16), meta = join(OUT, 'ground.json'), old = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : null;
if (old?.src === src && existsSync(join(OUT, 'ground.ktx2'))) console.log('ground.ktx2 is current');
else { const t = Date.now();
  execFileSync(KTX, ['create', '--format', 'R8G8B8A8_SRGB', '--assign-tf', 'srgb', '--layers', String(keys.length), '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '0.5',
    '--zstd', '18', '--generate-mipmap', '--threads', '4', ...pngs, join(OUT, 'ground.ktx2')], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`ground.ktx2: ${((Date.now() - t) / 1000).toFixed(0)} s`); }
writeFileSync(meta, JSON.stringify({ about: 'D-354: the ground layers as one KTX2 array (tools/bake_world/ktx_ground.ts); layer order and the heights\' mean and sd', src, res: R, layers: keys, stats }, null, 1));
rmSync(tmp, { recursive: true, force: true });
