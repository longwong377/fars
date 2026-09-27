// The inputs of the Blender tree assets (D-327) and their hash: tools/blender/trees.mjs writes it into
// public/models/trees/manifest.json and tests/tree_assets.test.ts recomputes it, so assets built from other species data,
// model or atlas code, bark choices or Blender scripts fail the test until `node tools/blender/trees.mjs` is run again.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const TREE_INPUTS = ['src/data/trees.json', 'src/data/tree_bark.json', 'src/world/trees/model.ts', 'src/world/trees/species.ts', 'src/world/trees/atlas.ts', 'src/world/trees/kitdata.ts',
  'tools/blender/sources/trees_src.ts', 'tools/blender/trees_atlas.py', 'tools/blender/trees_wood.py', 'tools/blender/trees.mjs'];
export function treeInputHash(settings, root = '.') {
  const h = createHash('sha256'); h.update(JSON.stringify(settings)); h.update('\0');
  for (const p of TREE_INPUTS) { const b = readFileSync(`${root}/${p}`); h.update(p); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b); }
  return h.digest('hex');
}
