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
  it('court (terrace top) at the Apadana = 1625.0 m asl (SITE_SPEC global.court_asl)', () => {
    expect(Math.abs(T.aslAt(0, 0) - 1625.0)).toBeLessThan(0.1);
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
