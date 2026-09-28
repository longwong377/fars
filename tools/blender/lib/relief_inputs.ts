// The inputs of the carved-relief atlas (D-320) and their hash: tools/blender/relief_atlas.ts writes it into
// src/data/relief_atlas.json and tests/relief_atlas.test.ts recomputes it, so an atlas whose figure code, field code, paint
// data, carving values or bake settings changed after its build fails the test until the atlas is rebuilt.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const RELIEF_ATLAS_FILES = [
  'src/arch/relief_figures.ts', 'src/arch/relief_field.ts', 'src/data/polychromy.json', 'src/core/colour.ts', 'src/core/rng.ts',
  'tools/blender/relief_atlas.ts', 'tools/blender/relief_bake.py', 'tools/blender/lib/relief_census.ts',
];
/** frames: per definition the key and the frame it is baked in (depth ratio, height, largest height, coarse texel) */
export function reliefAtlasInputs(frames: { key: string; rho: number; S: number; sMax: number; coarse: boolean }[], root = '.') {
  const h = createHash('sha256'), labels: string[] = [];
  const put = (label: string, b: Buffer) => { labels.push(label); h.update(label); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b); };
  for (const p of RELIEF_ATLAS_FILES) put(p, readFileSync(`${root}/${p}`));
  const spec = JSON.parse(readFileSync(`${root}/src/data/site_spec.json`, 'utf8'));
  put('site_spec:apadana.r_relief_carving', Buffer.from(JSON.stringify(spec.apadana.r_relief_carving.v)));
  put('frames', Buffer.from(JSON.stringify(frames.map(f => [f.key, +f.rho.toFixed(5), +f.S.toFixed(4), +f.sMax.toFixed(4), f.coarse]))));
  return { hash: h.digest('hex'), labels };
}
