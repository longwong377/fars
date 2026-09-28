// The inputs of the Cycles-rendered people impostors (D-331) and their hash: tools/blender/impostors.mjs writes it into
// public/models/impostors/manifest.json and tests/impostor_assets.test.ts recomputes it, so an atlas rendered from other
// bodies, garments, cards, poses or scripts fails the test until `node tools/blender/impostors.mjs` is run again.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const IMP_INPUTS = ['public/generated/humans/humans.bin', 'public/generated/humans/humans.json', 'public/models/people/people_hair.bin', 'public/models/people/people_hair.json',
  'public/models/people/people_hair_atlas.ktx2', 'public/models/people/people_cloth.bin', 'public/models/people/people_cloth.json',
  'src/people/outfits.ts', 'src/people/drape.ts', 'src/people/anim.ts', 'src/people/humanRig.ts', 'src/people/workAnims.ts',
  'tools/blender/sources/people_imp_src.ts', 'tools/blender/people_impostors.py', 'tools/blender/sources/people_imp_post.ts'];
export function impInputHash(settings, root = '.') {
  const h = createHash('sha256'); h.update(JSON.stringify(settings)); h.update('\0');
  for (const p of IMP_INPUTS) { const b = readFileSync(`${root}/${p}`); h.update(p); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b); }
  return h.digest('hex');
}
