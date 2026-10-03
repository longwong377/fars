// s18 C9 (D-740): the trees' bark array as one KTX2 (format only; the art stays C3's): every scan's layer packed by the
// page's own barkTexels (src/world/trees/assets.ts) from the same jpgs, rows as the images' (top-down, as its
// DataArrayTexture), UASTC + zstd + mips, linear: BC7 on the GPU. bark.json lists the scans (the page uses it only when
// they are its BARK_SCANS, in order).   KTX=<ktx> npx tsx tools/bake_world/ktx_bark.ts
import './node_env';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const { BARK_SCANS, barkTexels } = await import('../../src/world/trees/assets');
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', DIR = 'public/models/trees/bark', tmp = join(DIR, 'tmp-ktx'); mkdirSync(tmp, { recursive: true });
const pngs: string[] = []; let R = 0;
for (const [k, s] of BARK_SCANS.entries()) {
  const px = async (f: string) => { const { data, info } = await sharp(readFileSync(join(DIR, f))).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };
  const [dif, nor] = await Promise.all([px(`${s}_diff.jpg`), px(`${s}_nor.jpg`)]); R ||= dif.W;
  if (dif.W !== R || dif.H !== R || nor.W !== R) throw new Error(`bark ${s}: ${dif.W}x${dif.H} (want ${R})`);
  const out = new Uint8Array(R * R * 4); barkTexels(dif.d, nor.d, R, out, 0);
  const f = join(tmp, `${String(k).padStart(2, '0')}.png`); await sharp(Buffer.from(out), { raw: { width: R, height: R, channels: 4 } }).png({ compressionLevel: 1 }).toFile(f); pngs.push(f);
}
const out = join(DIR, 'bark.ktx2');
execFileSync(KTX, ['create', '--format', 'R8G8B8A8_UNORM', '--assign-tf', 'linear', '--layers', String(pngs.length), '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '1',
  '--zstd', '18', '--generate-mipmap', '--threads', process.env.THREADS ?? '4', ...pngs, out], { stdio: ['ignore', 'ignore', 'inherit'] });
writeFileSync(join(DIR, 'bark.json'), JSON.stringify({ about: 'D-740: the bark layers as one KTX2 array (tools/bake_world/ktx_bark.ts); src/world/trees/assets.ts loads it when scans is its BARK_SCANS', size: R, scans: BARK_SCANS, bytes: statSync(out).size,
  sources: Object.fromEntries(BARK_SCANS.flatMap(s => [`${s}_diff.jpg`, `${s}_nor.jpg`]).map(f => [f, createHash('sha1').update(readFileSync(join(DIR, f))).digest('hex').slice(0, 16)])) }, null, 1));
rmSync(tmp, { recursive: true, force: true }); console.log(`bark.ktx2: ${pngs.length} layers ${R}², ${(statSync(out).size / 1048576).toFixed(1)} MB`);
