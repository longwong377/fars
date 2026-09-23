// Bake the terrain horizon map (D-156; src/terrain/horizonMap.ts) from the committed terrain rings
// (public/generated/terrain_{near,mid,far}.u16, tools/build_terrain.py). Writes public/generated/horizon_map.{json,dat}.
// Usage: npx tsx tools/build_horizon.ts [--check]   (~1–3 min on one core; --check bakes a 32² corner only and prints timing)
// Every ray is marched from one texel (the level's dmin) out to the far ring's edge on the true DEM heights, with the
// Earth's curvature seen through refraction (k = 0.13), in steps of half the local ring cell, growing to 1 % of the
// distance (the angular error of a missed peak stays under ~0.3° × its slope); a ray stops once even the highest
// terrain (3,647 m asl) could no longer rise above the skyline found so far.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { HORIZON_LAYOUT, HORIZON_PLANES, HORIZON_PLANE_DELTA, curvDrop, deltaU8, slopeCode, type HorizonMeta } from '../src/terrain/horizonMap';

interface RingM { half: number; cell: number; n: number; asl_min: number; step: number; file: string; min: number; max: number }
const tmeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8')) as { court_asl: number; rings: Record<'near' | 'mid' | 'far', RingM> };
const ringAsl = (k: 'near' | 'mid' | 'far') => {
  const m = tmeta.rings[k], raw = new Uint16Array(readFileSync(`public/${m.file}`).buffer.slice(0)), a = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) a[i] = m.asl_min + raw[i] * m.step;
  return { m, a };
};
const NEAR = ringAsl('near'), MID = ringAsl('mid'), FAR = ringAsl('far');
const HMAX = Math.max(NEAR.m.max, MID.m.max, FAR.m.max) + 1;
/** true height asl at world (x, z): the finest ring that holds the point (the same margins as Terrain.heightAt) */
function bil(R: { m: RingM; a: Float32Array }, x: number, z: number) {
  const { n, cell, half } = R.m, gx = (x + half) / cell, gy = (z + half) / cell;
  const c0 = Math.max(0, Math.min(n - 2, Math.floor(gx))), r0 = Math.max(0, Math.min(n - 2, Math.floor(gy)));
  const fx = Math.max(0, Math.min(1, gx - c0)), fy = Math.max(0, Math.min(1, gy - r0)), i = r0 * n + c0, h = R.a;
  return (h[i] * (1 - fx) + h[i + 1] * fx) * (1 - fy) + (h[i + n] * (1 - fx) + h[i + n + 1] * fx) * fy;
}
const NH = NEAR.m.half - 8, MH = MID.m.half - 32, FH = FAR.m.half;
function asl(x: number, z: number) {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax <= NH && az <= NH) return bil(NEAR, x, z);
  if (ax <= MH && az <= MH) return bil(MID, x, z);
  return bil(FAR, x, z);
}
function stepAt(x: number, z: number) { const m = Math.max(Math.abs(x), Math.abs(z)); return m <= NH ? 2 : m <= MH ? 8 : 40; }

const L = HORIZON_LAYOUT, AZ = L.azimuths, DH = L.dl.h;
/** skyline tangents from (x, z) for receivers at y1 and y1 + DH (asl) toward grid direction (dx, dz), and the distances
 *  of the occluders that define them */
function march(x: number, z: number, y1: number, dx: number, dz: number, dmin: number): [number, number, number, number] {
  const y2 = y1 + DH; let b1 = -1e9, b2 = -1e9, s1 = dmin, s2 = dmin;
  for (let s = dmin; ; ) {
    const px = x + dx * s, pz = z + dz * s;
    if (Math.abs(px) > FH || Math.abs(pz) > FH) break;
    const c = curvDrop(s), h = asl(px, pz) - c;
    const t1 = (h - y1) / s, t2 = (h - y2) / s;
    if (t1 > b1) { b1 = t1; s1 = s; } if (t2 > b2) { b2 = t2; s2 = s; }
    if ((HMAX - c - y2) / s < b2) break;
    s += Math.max(stepAt(px, pz), s * 0.01);
  }
  return [b1, b2, s1, s2];
}

const check = process.argv.includes('--check');
const planes: Uint8Array[] = []; let total = 0;
const t0 = Date.now();
const stats: string[] = [];
for (const lv of L.levels) {
  const n = lv.n, cell = (2 * lv.half) / n, nn = n * n, span = check ? 32 : n;
  const ref = new Uint16Array(nn), e0 = new Uint8Array(AZ.n * nn), dl = new Uint8Array(AZ.n * nn), x1 = new Uint8Array(AZ.n * nn), x2 = new Uint8Array(AZ.n * nn);
  const dirs = Array.from({ length: AZ.n }, (_, a) => { const g = ((AZ.a0 + a * AZ.da - 341) * Math.PI) / 180; return [Math.sin(g), -Math.cos(g)]; });
  let clampedE = 0, clampedD = 0;
  const tl = Date.now();
  const cx = lv.cx ?? 0, cz = lv.cz ?? 0;
  for (let r = 0; r < span; r++) {
    const z = cz - lv.half + (r + 0.5) * cell;
    for (let c = 0; c < span; c++) {
      const x = cx - lv.half + (c + 0.5) * cell, k = r * n + c;
      const R = asl(x, z) + L.ref.offset;
      ref[k] = Math.max(0, Math.min(65535, Math.round((R - L.ref.asl0) / L.ref.step)));
      const Rq = L.ref.asl0 + ref[k] * L.ref.step;
      for (let a = 0; a < AZ.n; a++) {
        const [b1, b2, s1, s2] = march(x, z, Rq, dirs[a][0], dirs[a][1], lv.dmin);
        const e1 = (Math.atan(b1) * 180) / Math.PI, e2 = (Math.atan(b2) * 180) / Math.PI;
        const q = Math.round((e1 - L.elev.e0) / L.elev.step); if (q > 255) clampedE++;
        e0[a * nn + k] = Math.max(0, Math.min(255, q));
        const qd = lv.flat ? 0 : Math.round(Math.max(0, e1 - e2) / L.dl.step); if (qd > 255) clampedD++;
        dl[a * nn + k] = Math.min(255, qd);
        if (!lv.flat && Rq < L.slopeBelowAsl) { // the two occluders' lines: d e / d y = −cos²e / d (rad per m), against the stored chord's slope
          const sc = (Math.min(255, qd) * L.dl.step) / DH, k1 = (180 / Math.PI) * Math.cos(Math.atan(b1)) ** 2 / s1, k2 = (180 / Math.PI) * Math.cos(Math.atan(b2)) ** 2 / s2;
          x1[a * nn + k] = slopeCode(Math.max(0, k1 - sc), L.slope); x2[a * nn + k] = slopeCode(Math.max(0, sc - k2), L.slope);
        }
      }
    }
    if (!check && r % 32 === 31) console.log(`  level ±${lv.half} m: row ${r + 1}/${n} (${((Date.now() - tl) / 1000).toFixed(0)} s)`);
  }
  stats.push(`±${lv.half} m @ ${cell} m: ${((Date.now() - tl) / 1000).toFixed(1)} s, e0 clamped ${clampedE}, Δ clamped ${clampedD}`);
  // reference plane (u16 LE, delta along x), then per azimuth e0 and Δ (u8, delta along x)
  const rb = new Uint8Array(2 * nn);
  for (let r = 0; r < n; r++) { let p = 0; for (let c = 0; c < n; c++) { const i = r * n + c, d = (ref[i] - p) & 0xffff; p = ref[i]; rb[2 * i] = d & 255; rb[2 * i + 1] = d >> 8; } }
  planes.push(rb); total += rb.length;
  for (let a = 0; a < AZ.n; a++) {
    const P = { e0, dl, x1, x2 };
    for (const k of HORIZON_PLANES) { const src = P[k].subarray(a * nn, (a + 1) * nn), pl = new Uint8Array(nn); if (HORIZON_PLANE_DELTA[k]) deltaU8(src, n, pl, 0); else pl.set(src); planes.push(pl); total += nn; }
  }
}
const raw = new Uint8Array(total); { let o = 0; for (const p of planes) { raw.set(p, o); o += p.length; } }
console.log(stats.join('\n'), `\ntotal ${((Date.now() - t0) / 1000).toFixed(1)} s, raw ${(total / 1e6).toFixed(2)} MB`);
if (check) process.exit(0);
const z = deflateSync(raw, { level: 9 });
const hash = createHash('sha256'); for (const k of ['near', 'mid', 'far'] as const) hash.update(readFileSync(`public/${tmeta.rings[k].file}`));
const meta: HorizonMeta & { terrainHash: string } = {
  version: 1, tier: 'C',
  note: 'terrain horizon map (D-156): skyline elevation per texel and azimuth from the committed terrain rings (B heightfield), curvature with refraction k 0.13; derived, C',
  azimuths: AZ, elev: L.elev, dl: L.dl, slope: L.slope, slopeBelowAsl: L.slopeBelowAsl, ref: L.ref, court_asl: tmeta.court_asl, levels: L.levels,
  file: 'generated/horizon_map.dat', bytes: total, terrainHash: hash.digest('hex').slice(0, 16),
};
writeFileSync('public/generated/horizon_map.dat', z);
writeFileSync('public/generated/horizon_map.json', JSON.stringify(meta, null, 1));
console.log(`wrote public/generated/horizon_map.dat (${(z.length / 1e6).toFixed(2)} MB deflated from ${(total / 1e6).toFixed(2)} MB) and horizon_map.json`);
