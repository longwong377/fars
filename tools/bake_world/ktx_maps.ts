// s18 C9 (D-740): images loaded one by one through three's TextureLoader re-encoded as KTX2, a format-only change (the art
// stays its owners'): UASTC, zstd, mips: BC7 on the GPU (a 2048² map 5.6 MB instead of 22.4 MB as RGBA8 with mips). Each
// entry keeps its loader's texel orientation (flipY: TextureLoader's default true -> rows bottom-up, as ktx_scans.ts; false
// for the GLB atlases), and gets a 128-px thumbnail (<name>.thumb.jpg) for the loaders that read the image's colours
// (loaders.ts loadMap sets texture.userData.thumb). Listed in public/ktx_maps.json with the hash of the source.
//   KTX=<ktx> npx tsx tools/bake_world/ktx_maps.ts
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { twin } from './ktx_twin';
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', LIST = 'public/ktx_maps.json';
/** path under public/ -> sRGB colour (else linear data), flipY as its loader uploads it */
const MAPS: Record<string, { srgb: boolean; flipY: boolean }> = {
  'models/land/ground_diff.jpg': { srgb: true, flipY: false }, 'models/land/ground_nor.jpg': { srgb: false, flipY: false }, 'models/land/ground_arm.jpg': { srgb: false, flipY: false },
  'models/land/cover_diff.jpg': { srgb: true, flipY: false }, 'models/land/cover_nor.jpg': { srgb: false, flipY: false }, 'models/land/cover_arm.jpg': { srgb: false, flipY: false },
};
const done: Record<string, string> = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')).maps ?? {} : {};
for (const [p, o] of Object.entries(MAPS)) {
  const src = `public/${p}`, base = src.replace(/\.(jpg|png|webp)$/, ''), out = base + '.ktx2', thumb = base + '.thumb.jpg', h = createHash('sha1').update(readFileSync(src)).update(JSON.stringify(o)).digest('hex').slice(0, 16);
  if (done[p] === h && existsSync(out) && existsSync(thumb) && !process.env.FORCE) continue;
  const t = Date.now();
  const args = ['create', '--format', o.srgb ? 'R8G8B8_SRGB' : 'R8G8B8_UNORM', '--assign-tf', o.srgb ? 'srgb' : 'linear', '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '0.5',
    ...(o.flipY ? ['--convert-texcoord-origin', 'bottom-left'] : []), '--zstd', '18', '--generate-mipmap', '--threads', process.env.THREADS ?? '4', src, out];
  execFileSync(KTX, args, { stdio: ['ignore', 'ignore', 'inherit'] }); twin(KTX, args, out); // (D-740: its ETC1S twin, before ready)
  await sharp(src).resize(128, 128, { fit: 'fill' }).jpeg({ quality: 90 }).toFile(thumb);
  done[p] = h; writeFileSync(LIST, JSON.stringify({ about: 'D-740: images re-encoded as KTX2 (tools/bake_world/ktx_maps.ts); src/render/loaders.ts loadMap loads the .ktx2 (and its .thumb.jpg) for a listed path', maps: Object.fromEntries(Object.entries(done).sort()) }, null, 1));
  console.log(`${p}: ${((Date.now() - t) / 1000).toFixed(0)} s, ${(statSync(src).size / 1048576).toFixed(1)} -> ${(statSync(out).size / 1048576).toFixed(1)} MB`);
}
