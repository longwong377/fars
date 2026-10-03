// s18 C9 (D-740): the people's scanned layers as one KTX2 array, a format-only change (the art stays C14's): the 12 skin
// layers, the 4 cloth layers (RGB the scan, A its height) and the garments' fold layers (people_cloth_folds.png, its squares
// stacked vertically), in src/people/humanScans.ts's order and at its size, rows top-down as its DataArrayTexture. UASTC with
// zstd and mips: BC7 on the GPU (1 byte a texel; the hand-packed RGBA8 array was 107 MB with mips), no jpg decoded or packed
// on the page. humanScans.ts loads it when scans_ktx.json matches the layers it would pack, else packs the jpgs as before.
//   KTX=<ktx> npx tsx tools/bake_world/ktx_humans.ts
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { twin } from './ktx_twin';
const KTX = process.env.KTX ?? 'C:/Program Files/KTX-Software/bin/ktx.exe', DIR = 'public/generated/humans/scans', tmp = join(DIR, 'tmp-ktx');
const meta = JSON.parse(readFileSync(join(DIR, 'scans.json'), 'utf8')), n: number = meta.size;
const F = JSON.parse(readFileSync('public/models/people/people_cloth.json', 'utf8')).folds as { file: string; layers: number } | undefined;
mkdirSync(tmp, { recursive: true }); const h = createHash('sha1'), pngs: string[] = []; h.update(`v1|${n}`);
const raw = async (p: string) => { const b = readFileSync(p); h.update(b); return (await sharp(b).resize(n, n, { fit: 'fill' }).ensureAlpha().raw().toBuffer()); };
const put = async (k: string, px: Buffer) => { const f = join(tmp, `${String(pngs.length).padStart(2, '0')}_${k}.png`); await sharp(px, { raw: { width: n, height: n, channels: 4 } }).png({ compressionLevel: 1 }).toFile(f); pngs.push(f); };
// s18 C14 (D-790): the skin's micro-relief tile (tools/humans/skin_pores.mjs, ShareTextures CC0) in every skin layer's alpha
// (the jpgs have none; humanMaterial.ts lays it triplanar); hashed last (after the folds)
const PORES = 'tools/humans/data/skin_pores.png', poreA = existsSync(PORES) ? await sharp(readFileSync(PORES)).resize(n, n, { fit: 'fill' }).greyscale().raw().toBuffer() : null;
for (const s of meta.skin) { const d = await raw(join(DIR, `skin_${String(s.layer).padStart(2, '0')}.jpg`)); if (poreA) for (let i = 0; i < n * n; i++) d[i * 4 + 3] = poreA[i]; await put(s.id, d); }
for (const c of meta.cloth) { const d = await raw(join(DIR, `cloth_${c.layer}.jpg`)), H = await raw(join(DIR, `cloth_${c.layer}_h.jpg`));
  for (let i = 0; i < n * n; i++) d[i * 4 + 3] = H[i * 4]; await put(c.id, d); } // (the height in alpha, as the page packs it)
if (F) { const b = readFileSync(join('public/models/people', F.file)); h.update(b); const m = await sharp(b).metadata(), lh = Math.round(m.height! / F.layers);
  for (let k = 0; k < F.layers; k++) await put(`fold${k}`, await sharp(b).extract({ left: 0, top: k * lh, width: m.width!, height: lh }).resize(n, n, { fit: 'fill' }).ensureAlpha().raw().toBuffer()); }
if (poreA) h.update(readFileSync(PORES));
const src = h.digest('hex').slice(0, 16), out = join(DIR, 'scans.ktx2'), mf = join(DIR, 'scans_ktx.json'), old = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : null;
if (old?.src === src && existsSync(out) && !process.env.FORCE) console.log('scans.ktx2 is current');
else { const t = Date.now();
  const args = ['create', '--format', 'R8G8B8A8_SRGB', '--assign-tf', 'srgb', '--layers', String(pngs.length), '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', process.env.RDO ?? '1',
    '--zstd', '18', '--generate-mipmap', '--threads', process.env.THREADS ?? '4', ...pngs, out];
  execFileSync(KTX, args, { stdio: ['ignore', 'ignore', 'inherit'] }); // (D-740: its ETC1S twin, before ready; the cloud's ktx stand-in has no ETC1S: the old twin is kept, its layers and size
  // unchanged, so the page swaps in the full file as before)
  try { twin(KTX, args, out); } catch (e) { console.warn('scans.ktx2: the ETC1S twin was not rebuilt (kept):', (e as Error).message.split('\n')[0]); }
  console.log(`scans.ktx2: ${pngs.length} layers, ${((Date.now() - t) / 1000).toFixed(0)} s, ${(readFileSync(out).length / 1048576).toFixed(1)} MB`); }
writeFileSync(mf, JSON.stringify({ about: 'D-740: the skin, cloth and fold layers as one KTX2 array (tools/bake_world/ktx_humans.ts); humanScans.ts loads it when skin, cloth and folds match', src, size: n,
  skin: meta.skin.length, cloth: meta.cloth.length, folds: F ? { file: F.file, layers: F.layers } : null }, null, 1));
rmSync(tmp, { recursive: true, force: true });
