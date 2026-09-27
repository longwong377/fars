// The inputs of an animal species' build (D-326) and their hash, shared by tools/blender/animals.mjs and
// tests/animal_models.test.ts: the anatomy, the rig's numbers (animals.ts from the species list to the end of animalFrame),
// the SDF library, the source and Blender scripts, the species' registry class and the bake settings.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function animalInputs(sp, root = '.') {
  const R = JSON.parse(readFileSync(`${root}/tools/blender/animals.json`, 'utf8')), cls = R.species[sp];
  const an = readFileSync(`${root}/src/people/animals.ts`, 'utf8'), a0 = an.indexOf('export type Species'), a1 = an.indexOf('/** how far ahead of its centre an animal');
  return [['entry', JSON.stringify({ sp, cls, c: R.classes[cls], bake: R.bake })], ['animals.ts:build+frame', an.slice(a0, a1)],
    ...['src/people/animalForm.ts', 'src/arch/sdf.ts', 'tools/blender/sources/animal.ts', 'tools/blender/animals.py'].map(p => [p, readFileSync(`${root}/${p}`, 'utf8').replace(/\r\n/g, '\n')])];
}
export const animalHash = (sp, root = '.') => { const h = createHash('sha256'); for (const [k, v] of animalInputs(sp, root)) { h.update(k); h.update('\0'); h.update(String(v.length)); h.update('\0'); h.update(v); } return h.digest('hex'); };
