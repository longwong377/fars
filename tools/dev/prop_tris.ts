// dev (D-255): triangles of each carried prop kind and of each carried-prop union (the budgets of tests/performances.test.ts:
// the small objects' union ≤ 1000, the long tools' ≤ 700). Usage: npx tsx tools/dev/prop_tris.ts [kind ...]
import { propGeometry, propUnionGeometry, PROP_CLASSES } from '../../src/people/props';
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : PROP_CLASSES.flat();
for (const k of kinds) { const g = propGeometry(k); console.log(k, g ? g.getAttribute('position').count / 3 : 'none'); }
console.log('unions', PROP_CLASSES.map((_, c) => propUnionGeometry(c).getAttribute('position').count / 3).join(' / '));
