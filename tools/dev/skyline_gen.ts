// C5 (s17, D-590): the loading screen's backdrop: the real skyline seen from the plain at dawn, from the committed terrain
// (B heightfield), cut into ridge layers by distance so the screen can draw them with aerial perspective. Writes
// src/shell/skyline.json: per layer, the elevation angle (deg) per column across the view. Run: npx tsx tools/dev/skyline_gen.ts
import { writeFileSync } from 'node:fs';
import { loadTerrain } from '../../tests/plainLib';
import { readFileSync } from 'node:fs';

const T = loadTerrain();
// from the plain NW of the Terrace, eye 1.7 m, looking SE over the Terrace at Kuh-e Rahmat (grid azimuth, 0 = grid north)
const VIEW = { e: -1500, n: 1700, eye: 1.7, az: 120, hfov: 96, cols: 320 };
const BANDS = [[0, 1800], [1800, 5000], [5000, 14000], [14000, 60000]]; // m: near plain, the Terrace's hill, Rahmat, far ranges
const x0 = VIEW.e, z0 = -VIEW.n, y0 = T.heightAt(x0, z0) + VIEW.eye;
const layers = BANDS.map(() => new Array<number>(VIEW.cols).fill(-2));
for (let c = 0; c < VIEW.cols; c++) {
  const az = ((VIEW.az - VIEW.hfov / 2 + (VIEW.hfov * (c + 0.5)) / VIEW.cols) * Math.PI) / 180;
  const dx = Math.sin(az), dz = -Math.cos(az);
  for (let d = 20; d < 60000; d += d < 2000 ? 10 : d < 10000 ? 25 : 80) {
    const x = x0 + dx * d, z = z0 + dz * d; let h: number;
    try { h = T.heightAt(x, z); } catch { break; }
    if (!Number.isFinite(h)) break;
    const a = (Math.atan2(h - y0, d) * 180) / Math.PI; // heightAt already carries the curvature drop
    const b = BANDS.findIndex(([lo, hi]) => d >= lo && d < hi);
    if (b >= 0 && a > layers[b][c]) layers[b][c] = a;
  }
}
// the Terrace in 467 as masses (the platform at the court level, y 0; its roofed halls over it: heights over the court C, by
// eye from the reconstruction's own buildings, a silhouette only): the elevation of the highest mass per column
const FP = JSON.parse(readFileSync('src/data/geo/footprints.json', 'utf8'));
const TOPS: Record<string, number> = { terrace: 0.6, apadana: 22, gate_nations: 18.5, tachara: 11, hadish: 12, tripylon: 12, hall100: 5, treasury: 8, harem: 8, garrison: 7, palace_h: 9, unfinished_gate: 4, grand_stair: 1.5 };
const terrace = new Array<number>(VIEW.cols).fill(-2);
for (const [k, top] of Object.entries(TOPS)) { const f = FP[k]; if (!f) continue; const [e0, n0, e1, n1] = f.bounds; const poly: [number, number][] = f.polygon;
  const inside = (e: number, n: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
  for (let e = e0; e <= e1; e += 2) for (let n = n0; n <= n1; n += 2) { if (!inside(e, n)) continue;
    const dx = e - VIEW.e, dn = n - VIEW.n, d = Math.hypot(dx, dn); let az = (Math.atan2(dx, dn) * 180) / Math.PI; if (az < 0) az += 360;
    const c = Math.floor(((az - (VIEW.az - VIEW.hfov / 2)) / VIEW.hfov) * VIEW.cols); if (c < 0 || c >= VIEW.cols) continue;
    const a = (Math.atan2(top - y0, d) * 180) / Math.PI; if (a > terrace[c]) terrace[c] = a; } }
// each layer drawn over the farther ones: a nearer ridge's silhouette never below what it hides (max with nothing: as is)
const out = { note: 'the skyline from grid (-1500, 1700) looking grid 120 deg (ESE) over Kuh-e Rahmat, 96 deg wide; elevation angles (deg) per column by distance band (tools/dev/skyline_gen.ts, D-590; terrain B, the cut C)', view: VIEW, bands: BANDS,
  layers: layers.map(l => l.map(v => +v.toFixed(3))), terrace: terrace.map(v => +v.toFixed(3)) };
writeFileSync('src/shell/skyline.json', JSON.stringify(out));
console.log(layers.map((l, i) => `band ${i}: min ${Math.min(...l).toFixed(2)} max ${Math.max(...l).toFixed(2)}`).join('\n'));
