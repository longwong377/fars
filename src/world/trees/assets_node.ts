// Node side of assets.ts (tests, tools): the Blender tree assets read from public/models/trees/ on disk (PNG decoded with
// the pngjs bundled in playwright-core), without the bark textures (GPU only). Not imported by the game.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { atlasFromImages } from './atlas';
import { woodLevels, setTreeAssets, type TreeAssets } from './assets';
import { SPECIES } from './species';

export function loadTreeAssetsNode(root = '.', install = true): TreeAssets | null {
  const dir = `${root}/public/models/trees`; if (!existsSync(`${dir}/manifest.json`)) return null;
  const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
  const png = (f: string) => { const p = PNG.sync.read(readFileSync(`${dir}/${f}`)), W = p.width, H = p.height, o = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) o.set(p.data.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4); return { d: o, W, H }; };
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')), col = png('leaf_col.png'), tilt = png('leaf_tilt.png');
  const bin = readFileSync(`${dir}/wood.bin`), ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length);
  const a: TreeAssets = { manifest, atlas: atlasFromImages(col.d, tilt.d, col.W, col.H, [0, manifest.shadeB]), wood: woodLevels(JSON.parse(readFileSync(`${dir}/wood.json`, 'utf8')), ab, SPECIES.length * 3), bark: null };
  if (install) setTreeAssets(a);
  return a;
}
