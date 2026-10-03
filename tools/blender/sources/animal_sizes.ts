// V5 D-520: the species' sizes for tools/blender/animals_real.mjs (animals.ts ANIMAL_BUILD: body length, withers height, girth), as JSON
import { ANIMAL_BUILD } from '../../../src/people/animals';
console.log(JSON.stringify(Object.fromEntries(Object.entries(ANIMAL_BUILD).map(([k, b]) => [k, { len: b.len, h: b.h, girth: b.girth, biped: !!b.biped, head: b.head }]))));
