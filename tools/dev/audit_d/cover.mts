import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { NavGrid, NAV } = await import('/home/user/fars/src/people/navgrid');
const { ROUTES, SLICE } = await import('/home/user/fars/tests/e2e/lib/routes');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const { w, h, cell, e0, n0 } = NAV; const BL = -32768;
const cov = new Uint8Array(w * h); const R = 5; // metres either side of the walked line
const mark = (e: number, n: number) => { const i0 = Math.floor((e - R - e0) / cell), i1 = Math.floor((e + R - e0) / cell), j0 = Math.floor((n - R - n0) / cell), j1 = Math.floor((n + R - n0) / cell);
  for (let j = Math.max(0, j0); j <= Math.min(h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(w - 1, i1); i++) { const ce = e0 + (i + .5) * cell, cn = n0 + (j + .5) * cell; if ((ce - e) ** 2 + (cn - n) ** 2 <= R * R) cov[j * w + i] = 1; } };
const all = { slice: SLICE, ...ROUTES } as any;
for (const k of Object.keys(all)) { let pos = all[k].start; for (const [e, n] of all[k].targets) { const p = nav.findPath(pos, [e, n]); if (!p) continue; for (let q = 1; q < p.length; q++) { const [a, b] = [p[q - 1], p[q]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 1) mark(a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L); } pos = p[p.length - 1]; } }
let walk = 0, cw = 0, tw = 0, tc = 0; // terrace = cells whose height > -3 m (the court level ~0..6) and e > -40
for (let k = 0; k < w * h; k++) { if (nav.hcm[k] === BL) continue; walk++; if (cov[k]) cw++; const hh = nav.hcm[k] / 100, e = e0 + ((k % w) + .5) * cell; if (hh > -2 && e > -45) { tw++; if (cov[k]) tc++; } }
console.log(`nav grid walkable ${(walk * cell * cell / 1e4).toFixed(1)} ha; within ${R} m of a bot route: ${(100 * cw / walk).toFixed(1)} %`);
console.log(`Terrace-top walkable ${(tw * cell * cell / 1e4).toFixed(1)} ha; within ${R} m of a bot route: ${(100 * tc / tw).toFixed(1)} %`);
