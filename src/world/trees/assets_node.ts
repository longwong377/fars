// Node side of assets.ts (tests, tools): the Blender tree assets read from public/models/trees/ on disk (WebP decoded
// with sharp), without the bark textures (GPU only). Not imported by the game.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { atlasFromImages } from './atlas';
import { woodLevels, setTreeAssets, type TreeAssets } from './assets';
import { SPECIES } from './species';

export async function loadTreeAssetsNode(root = '.', install = true): Promise<TreeAssets | null> {
  const dir = `${root}/public/models/trees`; if (!existsSync(`${dir}/manifest.json`)) return null;
  const sharp = createRequire(import.meta.url)('sharp');
  const img = async (f: string) => { const { data, info } = await sharp(`${dir}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, o = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) o.set(data.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4); return { d: o, W, H }; };
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')), col = await img('leaf_col.webp'), tilt = await img('leaf_tilt.webp');
  const bin = readFileSync(`${dir}/wood.bin`), ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length);
  const a: TreeAssets = { manifest, atlas: atlasFromImages(col.d, tilt.d, col.W, col.H, [0, manifest.shadeB], tilt.W, tilt.H), wood: woodLevels(JSON.parse(readFileSync(`${dir}/wood.json`, 'utf8')), ab, SPECIES.length * 3), bark: null };
  if (install) setTreeAssets(a);
  return a;
}
