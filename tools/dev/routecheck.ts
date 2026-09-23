// dev: validate walkthrough routes against the walkable grid offline (every target walkable, every leg has a path)
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { ROUTES } from '../../tests/e2e/lib/routes';
const nav = await NavGrid.load(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
let bad = 0;
for (const [area, R] of Object.entries(ROUTES)) {
  let pos = R.start;
  for (const [e, n, what] of R.targets) {
    const w = nav.walkable(e, n), h = nav.heightAt(e, n), path = nav.findPath(pos, [e, n]);
    if (!w || !path) { bad++; console.log(`✗ ${area}: ${what} (${e}, ${n}) walkable=${w} h=${h.toFixed?.(2)} path=${!!path}`); }
    else if (R.levels[what] !== undefined && Math.abs(h - R.levels[what]) > 0.05) { bad++; console.log(`✗ ${area}: ${what} level ${h.toFixed(2)} ≠ ${R.levels[what]}`); }
    pos = [e, n];
  }
  console.log(`${area}: ${R.targets.length} targets checked`);
}
process.exit(bad ? 1 : 0);
