// dev (D-226): the carved edge's profile across the back of a Persian noble's robe (register figure, 0.741 m, 4.5 cm deep):
// height (mm) against the distance inside the outline, on the L0 field. `git stash`-free before/after: run on each tree.
//   npx tsx tools/dev/relief_edge_profile.ts
import { rasterize } from '../../src/arch/relief_field';
import { figureDef } from '../../src/arch/relief_figures';
const S = 0.741, D = 0.045, f = rasterize(figureDef('persian', 0), 1025, false);
for (const yF of [0.3, 0.6]) {
  const j = Math.round((yF - f.y0) / f.cell); let i = 0; while (i < f.n && f.h[j * f.n + i] <= 0) i++; // the back outline (leftmost carved point)
  const out: string[] = [];
  for (const mm of [0, 1, 2, 3, 5, 8, 12, 20, 30, 45]) { const k = i + Math.round(mm / 1000 / S / f.cell); out.push(`${mm} mm: ${(Math.max(0, f.h[j * f.n + k]) * D * 1000).toFixed(1)}`); }
  let peak = 0; for (let q = i; q < f.n; q++) peak = Math.max(peak, f.h[j * f.n + q]);
  console.log(`y ${yF} (figure units): height in from the back outline — ${out.join(', ')}; the row's peak ${(peak * D * 1000).toFixed(1)} mm`);
}
