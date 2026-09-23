import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { decodeHorizonMap, fromHalf, curvDrop, curvatureDropOrigin, localTiltDeg, type HorizonMeta } from '../src/terrain/horizonMap';
import { sunHorizon } from '../src/sky/ephemeris';
import { WorldClock } from '../src/core/clock';

// D-156 (triage item 7): the baked terrain horizon map against independent ray casts over the DEM. The reference caster
// below uses Terrain.aslAt (heightfield.ts, not the bake's own sampler), fine steps (2 m, growing to 0.2 % of the
// distance) and the same curvature-with-refraction law; like the map it ignores occluders nearer than the level's dmin.
const tmeta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(tmeta.rings[k], new Uint16Array(readFileSync(`public/${tmeta.rings[k].file}`).buffer.slice(0)), tmeta.court_asl);
const T = new Terrain(tmeta, ring('near'), ring('mid'), ring('far'));
const hmeta: HorizonMeta & { terrainHash: string } = JSON.parse(readFileSync('public/generated/horizon_map.json', 'utf8'));
const MAP = decodeHorizonMap(hmeta, new Uint8Array(inflateSync(readFileSync(`public/${hmeta.file}`))));
const DEG = Math.PI / 180;

/** reference skyline elevation (deg) from world (x, z) at `asl` toward a true azimuth */
function cast(x: number, z: number, asl: number, azTrue: number, dmin: number): number {
  const g = (azTrue - 341) * DEG, dx = Math.sin(g), dz = -Math.cos(g); let best = -1e9;
  for (let s = dmin; s < 150000; s += Math.max(2, s * 0.002)) {
    const px = x + dx * s, pz = z + dz * s; if (Math.abs(px) > 71680 || Math.abs(pz) > 71680) break;
    const t = (T.aslAt(px, pz) - asl - curvDrop(s)) / s; if (t > best) best = t;
  }
  return Math.atan(best) / DEG;
}
const dminAt = (x: number, z: number) => MAP.levels[MAP.levelAt(x, z).l].dmin;
const LANDING = { x: -40.2, z: -122.45, asl: tmeta.court_asl + 1.6 }; // the Grand Stair's top landing, eye height
/** local mean time (h) on day `day` when the sun's upper limb (limb = 1) or centre (0) first clears a skyline function */
function firstSun(day: number, skyline: (az: number) => number, limb: number): number {
  for (let m = 5 * 60; m < 9 * 60; m += 0.25) {
    const s = sunHorizon(new WorldClock(day, m / 60).jdUT);
    if (s.altitude + limb * 0.2665 >= skyline(s.azimuth)) return m / 60;
  }
  return NaN;
}
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

describe('terrain horizon map (D-156)', () => {
  it('was baked from the committed terrain rings', () => {
    const hash = createHash('sha256'); for (const k of ['near', 'mid', 'far'] as const) hash.update(readFileSync(`public/${tmeta.rings[k].file}`));
    expect(hmeta.terrainHash, 're-run npx tsx tools/build_horizon.ts after npm run terrain').toBe(hash.digest('hex').slice(0, 16));
  });

  it('matches DEM ray casts over the sun\'s and moon\'s azimuths: tight where people and buildings are, looser on rugged slopes', () => {
    // groups: [points, max mean error, max p90, max worst] (deg). Where people and buildings stand the skyline is set by
    // occluders 0.4–60 km away and the 40 m / 256 m texels resolve it; on rugged slopes occluders within ~100 m set it and
    // neighbouring 40 m texels differ by 10–20° (a ravine 800 m E of the Terrace: the resolution limit, logged in D-156;
    // the cascaded shadow maps cover such terrain within 600 m of the eye)
    const groups: [string, [string, number, number, number][], number, number, number][] = [
      ['valley floor, Terrace, Naqsh-e Rustam, town (40 m and 256 m levels)', [
        ['landing', LANDING.x, LANDING.z, LANDING.asl], ['Apadana', 0, 0, tmeta.court_asl + 1.6], ['plain 3 km W', -3000, 400, 0],
        ['Naqsh-e Rustam foot', 600, -5950, 0], ['tomb of Artaxerxes II', 300, -20, 0], ['Tol-e Ajori', -2475, -2365, 0],
        ['plain 8 km SW', -6000, 5000, 0], ['plain 12 km NW', -9000, -8000, 0]], 0.25, 0.5, 1.5],
      ['far plain (1,120 m level)', [['plain 30 km W', -30000, 2000, 0], ['50 km S', 8000, 48000, 0]], 0.35, 0.8, 1.5],
      ['Kuh-e Rahmat, open slope', [['slope 1.4 km E', 1400, 300, 0]], 0.5, 1.3, 2.5],
      ['Kuh-e Rahmat, ravine (resolution limit)', [['ravine 800 m E', 800, 100, 0]], 3, 5, 7],
    ];
    const rows: string[] = [];
    for (const [g, pts, mMax, p90Max, wMax] of groups) for (const [name, x, z, a] of pts) {
      const asl = a || T.aslAt(x, z) + 2, dmin = dminAt(x, z), errs: number[] = [];
      for (let az = 55; az <= 305; az += 2.5) errs.push(Math.abs(MAP.elevation(x, z, asl, az) - cast(x, z, asl, az, dmin)));
      errs.sort((p, q) => p - q);
      const mean = errs.reduce((s, v) => s + v, 0) / errs.length, p90 = errs[Math.floor(errs.length * 0.9)], w = errs[errs.length - 1];
      rows.push(`${g}: ${name}: mean ${mean.toFixed(3)}° p90 ${p90.toFixed(2)}° max ${w.toFixed(2)}°`);
      expect(mean, rows[rows.length - 1]).toBeLessThan(mMax); expect(p90, rows[rows.length - 1]).toBeLessThan(p90Max); expect(w, rows[rows.length - 1]).toBeLessThan(wMax);
    }
    writeFileSync('bench-reports/horizon-map-accuracy.txt', rows.join('\n') + '\n');
  });

  it('first sun on the Grand Stair landing on day 0 (17 Apr 467 BCE): ~06:26 local mean time, the map within 2 min of the DEM', () => {
    const ref = firstSun(0, az => cast(LANDING.x, LANDING.z, LANDING.asl, az, 5), 0);
    const map = firstSun(0, az => MAP.elevation(LANDING.x, LANDING.z, LANDING.asl, az), 0);
    const limb = firstSun(0, az => cast(LANDING.x, LANDING.z, LANDING.asl, az, 5), 1);
    expect(Math.abs(map - ref) * 60, `centre: DEM ${hm(ref)}, map ${hm(map)}; upper limb ${hm(limb)}`).toBeLessThan(2);
    expect(ref).toBeGreaterThan(6 + 20 / 60); expect(ref).toBeLessThan(6 + 32 / 60);
    // the old dawn slot (05:51, sun +2.5°): the landing and the Apadana lie in Kuh-e Rahmat's shadow
    const s = sunHorizon(new WorldClock(0, 5.85).jdUT);
    expect(MAP.visibility(LANDING.x, 1.6, LANDING.z, s.altitude, s.azimuth)).toBe(0);
    expect(MAP.visibility(0, 20, 0, s.altitude, s.azimuth)).toBe(0); // a column top 20 m over the court
    // later in the year and at other hours the map keeps within 2 min of the DEM
    for (const day of [60, 150, 240]) {
      const r = firstSun(day, az => cast(LANDING.x, LANDING.z, LANDING.asl, az, 5), 0), mp = firstSun(day, az => MAP.elevation(LANDING.x, LANDING.z, LANDING.asl, az), 0);
      expect(Math.abs(mp - r) * 60, `day ${day}: DEM ${hm(r)}, map ${hm(mp)}`).toBeLessThan(2.5);
    }
  });

  it('the receiver\'s height counts: a column top 20 m above the court sees a lower skyline, as the DEM says', () => {
    for (const az of [80, 85, 90, 100, 250, 270]) {
      for (const dy of [0, 13, 20, 33]) {
        const asl = tmeta.court_asl + dy, ref = cast(0, 0, asl, az, dminAt(0, 0)), m = MAP.elevation(0, 0, asl, az);
        expect(Math.abs(m - ref), `az ${az} court +${dy} m: map ${m.toFixed(2)} DEM ${ref.toFixed(2)}`).toBeLessThan(0.7);
      }
      expect(MAP.elevation(0, 0, tmeta.court_asl + 20, az)).toBeLessThan(MAP.elevation(0, 0, tmeta.court_asl, az));
    }
  });

  it('at 05:51 on day 0 the mountain\'s shadow reaches ~10 km out over the western plain (map and DEM agree)', () => {
    const s = sunHorizon(new WorldClock(0, 5.85).jdUT), g = (s.azimuth + 180 - 341) * DEG, dx = Math.sin(g), dz = -Math.cos(g); // away from the sun
    const edge = (lit: (x: number, z: number) => boolean) => { for (let d = 0; d < 40000; d += 100) { const x = LANDING.x + dx * d, z = LANDING.z + dz * d; if (lit(x, z)) return d; } return Infinity; };
    const ref = edge((x, z) => { const a = T.aslAt(x, z) + 2; return cast(x, z, a, s.azimuth, dminAt(x, z)) < s.altitude + localTiltDeg(x, z, s.altitude, s.azimuth); });
    const map = edge((x, z) => MAP.visibility(x, T.heightAt(x, z) + 2, z, s.altitude, s.azimuth) > 0.5);
    expect(ref, 'shadow edge (DEM)').toBeGreaterThan(5000); expect(ref).toBeLessThan(16000);
    expect(Math.abs(map - ref), `shadow edge: DEM ${ref} m, map ${map} m`).toBeLessThan(0.1 * ref + 300);
  });

  it('bakes the per-frame GPU atlases: the shader formula on bilinear texel parameters reproduces the CPU model', () => {
    // emulate horizonShadow.ts on the baked half-float atlases (sun: lines, its reference heights read from the moon's
    // chord atlas's B channel, as the sky system binds them; moon: chord)
    const [W, H] = MAP.atlasSize, lines = MAP.bakeAtlas(86.2, new Uint16Array(W * H * 4), true), chord = MAP.bakeAtlas(123.4, new Uint16Array(W * H * 4));
    const refOnly = MAP.refAtlas(new Uint16Array(W * H * 4), 4, 2);
    for (let i = 2; i < refOnly.length; i += 4) if (refOnly[i] !== chord[i]) throw new Error(`reference height ${i >> 2}: refAtlas ${refOnly[i]} vs chord bake ${chord[i]}`);
    MAP.bakeAtlas(86.2, chord);
    const ref = chord;
    const bil = (buf: Uint16Array, ch: number, stride: number, l: number, x: number, z: number) => {
      const L = MAP.levels[l], u0 = MAP.levels.slice(0, l).reduce((s, q) => s + q.n, 0);
      const gx = Math.min(L.n - 0.5, Math.max(0.5, (x - L.cx + L.half) / L.cell)) - 0.5, gz = Math.min(L.n - 0.5, Math.max(0.5, (z - L.cz + L.half) / L.cell)) - 0.5;
      const c0 = Math.min(L.n - 2, Math.floor(gx)), r0 = Math.min(L.n - 2, Math.floor(gz)), fx = gx - c0, fz = gz - r0;
      const at = (r: number, c: number) => fromHalf(buf[(r * W + u0 + c) * stride + ch]);
      return (at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx) * (1 - fz) + (at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx) * fz;
    };
    let worstL = 0, worstC = 0, n = 0; const rows: string[] = [];
    for (let i = 0; i < 400; i++) {
      const l = i % 3, L = MAP.levels[l], s = L.half * 0.9, x = L.cx + ((i * 0.618034) % 1) * 2 * s - s, z = L.cz + ((i * 0.414214 + 0.3) % 1) * 2 * s - s;
      const yg = T.heightAt(x, z) + [1, 5, 15, 30][i % 4], asl = yg + tmeta.court_asl + curvatureDropOrigin(x, z);
      const yr = yg - bil(ref, 2, 4, l, x, z);
      const eL = L.flat ? bil(lines, 0, 4, l, x, z) : Math.max(bil(lines, 0, 4, l, x, z) - bil(lines, 1, 4, l, x, z) * yr, bil(lines, 2, 4, l, x, z) - bil(lines, 3, 4, l, x, z) * (yr - 50));
      const eC = bil(chord, 0, 4, l, x, z) + bil(chord, 1, 4, l, x, z) * (yg - bil(chord, 2, 4, l, x, z));
      const cpuL = MAP.levelElevation(l, x, z, asl, 86.2), cpuC = MAP.levelElevation(l, x, z, asl, 86.2, true);
      worstL = Math.max(worstL, Math.abs(eL - cpuL)); worstC = Math.max(worstC, Math.abs(eC - cpuC)); n++;
      if (Math.abs(eL - cpuL) > 0.1) rows.push(`level ${l} (${x.toFixed(0)}, ${z.toFixed(0)}) +${(yg - T.heightAt(x, z)).toFixed(0)} m: gpu ${eL.toFixed(2)} cpu ${cpuL.toFixed(2)}`);
    }
    // the same formula on half floats: e0 to ~0.03°, the reference height to 2⁻¹¹ of itself × the slope
    expect(worstL, rows.slice(0, 8).join('\n')).toBeLessThan(0.15);
    expect(worstC).toBeLessThan(0.15);
  });
});
