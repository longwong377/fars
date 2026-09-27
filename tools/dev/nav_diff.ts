// dev (D-276): the walkable grid before (git HEAD's public/generated/nav.i16) and after (the working tree's): cells lost and
// gained, and the lost cells that lie outside every room range's block (a region cut off by the new walls would show here).
// npx tsx tools/dev/nav_diff.ts [ref=HEAD]
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NAV } from '../../src/people/navgrid';
import { terraceRanges } from '../../src/arch/terrace_rooms';

const ref = process.argv[2] ?? 'HEAD';
const before = new Int16Array(new Uint8Array(execFileSync('git', ['show', `${ref}:public/generated/nav.i16`], { maxBuffer: 1 << 26 })).buffer);
const after = new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0));
const blocks = terraceRanges().flatMap(B => B.ranges.map(({ R }) => R)).map(R => ({ id: R.id, x: [R.x[0] - 3, R.x[1] + 3], y: [R.y[0] - 3, R.y[1] + 3] }));
let lost = 0, gained = 0; const outside: Record<string, number> = {};
for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) {
  const k = j * NAV.w + i, a = before[k] !== NAV.blocked, b = after[k] !== NAV.blocked;
  if (a && !b) { lost++; const e = NAV.e0 + (i + 0.5) * NAV.cell, n = NAV.n0 + (j + 0.5) * NAV.cell;
    if (!blocks.some(q => e > q.x[0] && e < q.x[1] && n > q.y[0] && n < q.y[1])) { const key = `${Math.round(e / 10) * 10},${Math.round(n / 10) * 10}`; outside[key] = (outside[key] ?? 0) + 1; } }
  if (!a && b) gained++;
}
console.log(`lost ${lost}, gained ${gained}; lost outside the range blocks (+3 m): ${Object.values(outside).reduce((x, y) => x + y, 0)}`);
console.log(Object.entries(outside).sort((p, q) => q[1] - p[1]).slice(0, 30).map(([k, v]) => `${k}: ${v}`).join('\n'));
