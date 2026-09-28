// D-330: the inputs of each decor asset (tools/blender/decor.mjs): their bytes decide whether a build is stale
// (tests/decor_assets.test.ts recomputes the hash against src/data/decor_assets.json).
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const DECOR_INPUTS = {
  trim: ['tools/blender/decor_trim.py', 'tools/blender/sources/frame_trim.ts', 'src/arch/frames.ts', 'src/data/site_spec.json'],
  merlon: ['tools/blender/decor_merlon.py', 'tools/blender/sources/merlon.ts', 'tools/blender/bake.py', 'src/data/site_spec.json'],
  tents: ['tools/blender/decor_tents.py', 'tools/blender/sources/tents.ts', 'src/world/tentForms.ts', 'src/people/camps.ts'],
};
export const decorInputHash = (id, root = '.') => { const h = createHash('sha256'); for (const p of DECOR_INPUTS[id]) { const b = existsSync(`${root}/${p}`) ? readFileSync(`${root}/${p}`) : Buffer.alloc(0); h.update(p); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b.toString('utf8').replace(/\r\n/g, '\n')); } return h.digest('hex'); };
