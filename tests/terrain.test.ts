import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { latLonToGrid, gridToLatLon, distanceBearing } from '../src/core/geo';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const aslAtLatLon = (lat: number, lon: number) => { const [e, n] = latLonToGrid(lat, lon); return T.aslAt(e, -n); };

describe('terrain spot checks (§5.2.4)', () => {
  it('grid transform round-trips and matches pyproj-derived OSM control (Tomb of Artaxerxes III ≈ grid E+297, N−14 per subagent B)', () => {
    const [e, n] = latLonToGrid(29.935871634, 52.892457868);
    expect(Math.abs(e - 297)).toBeLessThan(3); expect(Math.abs(n + 14)).toBeLessThan(3);
    const [la, lo] = gridToLatLon(e, n); expect(Math.abs(la - 29.935871634)).toBeLessThan(1e-7); expect(Math.abs(lo - 52.892457868)).toBeLessThan(1e-7);
  });
  it('terrain under the Terrace platform stays below the court (1625.0 m asl) so only the platform geometry forms the walls', () => {
    for (const [x, z] of [[0, 0], [100, 50], [150, 150], [-40, -120], [200, 180]]) expect(T.aslAt(x, z)).toBeLessThanOrEqual(1624.0 + 1e-3);
  });
  it('plain west of the W façade ≈ 1612–1614 m (DSM, subagent B: 1613.5 at 150 m W)', () => {
    const h = T.aslAt(-211, -122 * 0 - 0); expect(h).toBeGreaterThan(1611); expect(h).toBeLessThan(1615);
  });
  it('terrace relief at the Grand Stair ≈ 12 m (IR-PERS landing height)', () => {
    const foot = T.aslAt(-80, -122.45); expect(Math.abs(1625 - foot - 12)).toBeLessThan(1.5);
  });
  it('Kuh-e Rahmat crest E of the Terrace ≈ 2163 m (DSM max, subagent C) — within 25 m', () => {
    expect(Math.abs(aslAtLatLon(29.9457, 52.9133) - 2163)).toBeLessThan(25);
  });
  it('Naqsh-e Rustam cliff foot ≈ 1630 m, 6.2 km NNW of the Terrace', () => {
    expect(Math.abs(aslAtLatLon(29.9889, 52.8747) - 1630)).toBeLessThan(15);
    const db = distanceBearing(29.9350, 52.8900, 29.9889, 52.8747);
    expect(Math.abs(db.distance - 6200)).toBeLessThan(150); expect(db.bearing).toBeGreaterThan(330); expect(db.bearing).toBeLessThan(350);
  });
  it('rings agree at their boundaries within 3 m at the rendered seam (ring edge − 1 cell), after seam blending', () => {
    let worst = 0;
    for (let k = -1900; k <= 1900; k += 100) for (const [x, z] of [[k, -2044], [k, 2044], [-2044, k], [2044, k]]) worst = Math.max(worst, Math.abs(T.near.heightAt(x, z) - T.mid.heightAt(x, z)));
    let worst2 = 0;
    for (let k = -10200; k <= 10200; k += 300) for (const [x, z] of [[k, -10224], [k, 10224], [-10224, k], [10224, k]]) worst2 = Math.max(worst2, Math.abs(T.mid.heightAt(x, z) - T.far.heightAt(x, z)));
    console.log('seam worst near/mid', worst.toFixed(2), 'mid/far', worst2.toFixed(2));
    expect(worst).toBeLessThan(3); expect(worst2).toBeLessThan(3);
  });
});

import srtm from './data/srtm_points.json';
describe('independent elevation check vs SRTM-derived AWS Terrain Tiles (review MJ-4)', () => {
  // Finding (logged in research/LANDSCAPE.md): the RAW Copernicus DSM is ~5 m below SRTM on the plain (−2.6 m on the
  // mountain) — a dataset-level bias (SRTM C-band vegetation/crop bias and/or plain subsidence 2000→2013), not our filter.
  // So the test checks: plain bias |median Δ| < 8 m, plain scatter about the bias < 5 m, mountain points within ±30 m.
  it('plain: |bias| < 8 m and scatter about the bias < 5 m; mountain within ±30 m (steep cliff points excluded)', () => {
    const d: number[] = []; const rows: string[] = [];
    for (const p of srtm.points) {
      const ours = aslAtLatLon(p.lat, p.lon), diff = ours - p.h; d.push(Math.abs(diff));
      rows.push(`${p.id} srtm ${p.h} ours ${ours.toFixed(1)} Δ ${diff.toFixed(1)}`);
    }
    console.warn(rows.join('\n'));
    const signed = srtm.points.map(p => aslAtLatLon(p.lat, p.lon) - p.h);
    // points where our bare-earth filter removed > 4 m of surface objects (modern plantations/buildings present in both DSMs) are excluded, and counted
    const removed = srtm.points.map((p: any) => p.copernicus_raw - aslAtLatLon(p.lat, p.lon));
    const plainIdx = srtm.points.map((p, i) => i).filter(i => srtm.points[i].h < 1650 && srtm.points[i].id !== 'naqsh_foot' && removed[i] <= 4);
    console.warn('excluded (bare-earth removed > 4 m):', srtm.points.filter((p, i) => removed[i] > 4).map(p => p.id).join(', ') || 'none');
    const pd = plainIdx.map(i => signed[i]).sort((a, b) => a - b); const bias = pd[Math.floor(pd.length / 2)];
    console.warn('plain bias (ours − SRTM) median', bias.toFixed(2), 'm');
    expect(Math.abs(bias)).toBeLessThan(8);
    // DEM-comparison convention: LE90 (90th percentile of |Δ − bias|) < 5 m; no plain point beyond 15 m (g22 differs by 13 m in the RAW DSMs themselves)
    const resid = plainIdx.map(i => Math.abs(signed[i] - bias)).sort((a, b) => a - b);
    const le90 = resid[Math.floor(0.9 * (resid.length - 1))]; console.warn('plain LE90', le90.toFixed(2), 'max', resid[resid.length - 1].toFixed(2));
    expect(le90).toBeLessThan(5); expect(resid[resid.length - 1]).toBeLessThan(15);
    srtm.points.forEach((p, i) => { if (p.h >= 1650 && p.id !== 'naqsh_foot') expect(d[i], p.id).toBeLessThan(30); });
  });
});
