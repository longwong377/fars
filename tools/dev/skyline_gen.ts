// C5 (s17, D-590): the loading screen's backdrop: the real skyline seen from the plain at dawn, from the committed terrain
// (B heightfield), cut into ridge layers by distance so the screen can draw them with aerial perspective. Writes
// src/shell/skyline.json: per layer, the elevation angle (deg) per column across the view. Run: npx tsx tools/dev/skyline_gen.ts
import { writeFileSync } from 'node:fs';
import { loadTerrain } from '../../tests/plainLib';

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
// each layer drawn over the farther ones: a nearer ridge's silhouette never below what it hides (max with nothing: as is)
const out = { note: 'the skyline from grid (-1500, 1700) looking grid 120 deg (ESE) over Kuh-e Rahmat, 96 deg wide; elevation angles (deg) per column by distance band (tools/dev/skyline_gen.ts, D-590; terrain B, the cut C)', view: VIEW, bands: BANDS,
  layers: layers.map(l => l.map(v => +v.toFixed(3))) };
writeFileSync('src/shell/skyline.json', JSON.stringify(out));
console.log(layers.map((l, i) => `band ${i}: min ${Math.min(...l).toFixed(2)} max ${Math.max(...l).toFixed(2)}`).join('\n'));
