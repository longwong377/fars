// D-670 (s18 C3): the Pulvar and the Kur meander. The courses in plain.json are the modern OSM lines at ~450 m vertex
// spacing (Pleiades/OSM, C for 467), so between vertices tools/build_terrain.py carved and rivers.ts drew ruler-straight
// reaches: a canal, not a river. This post-process of build_terrain.py's outputs keeps the course (the meander belt is
// centred on the OSM line) and adds a reconstructed meander train (C): a free alluvial channel on a gentle plain bends with
// a wavelength of ~10-14 channel widths and a bend radius of ~2-3.5 widths (Leopold & Wolman's regime relations, general
// fluvial geomorphology, B for rivers in general, C for these two), straighter in some reaches and tighter in others.
// It then fills the old straight trench in the heightfield back to the floodplain on either side, carves the new course
// by build_terrain.py's own rule (every sample within top/2 + cell of the centreline lowered to the bed - margin), and
// rewrites public/generated/rivers.json (centreline every 20 m; the bank and floodplain levels carried over from the
// base course by its parameter, so the bed stays non-increasing downstream).
//
// Run after `python tools/build_terrain.py`, and again whenever the roads, canals or villages change (a re-run first undoes the
// last meander from the base course and the prior samples it kept):
//   npx tsx tools/plain/meander.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { mxNoise2 } from '../../src/render/mx_noise_cpu';
import { Terrain, Ring } from '../../src/terrain/heightfield';
import { parseRivers, PointIndex, settlementRoads } from '../../src/world/plain/data';
import { roadRiverCrossings } from '../../src/world/plain/crossings';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { WORLD_SEED_POOL } from '../../src/core/seed';

const G = 'public/generated/';
const riversJ = JSON.parse(readFileSync(G + 'rivers.json', 'utf8'));
const terrainJ = JSON.parse(readFileSync(G + 'terrain.json', 'utf8'));
// re-run (the roads or the canals changed): undo the last meander first, from the course and the samples it kept
if (riversJ._meta.meander) {
  for (const k of ['mid', 'far']) { const m = terrainJ.rings[k], b = readFileSync('public/' + m.file), raw = new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const p = riversJ.prior[k], d = new Uint16Array(Buffer.from(p.d, 'base64').buffer.slice(0)), v = new Uint16Array(Buffer.from(p.v, 'base64').buffer.slice(0));
    let i = 0, j = 0, at = 0; while (j < v.length) { let dl = d[i++]; if (dl === 0) { dl = d[i] * 65536 + d[i + 1]; i += 2; } at += dl; raw[at] = v[j++]; }
    writeFileSync('public/' + m.file, Buffer.from(raw.buffer)); }
  for (const r of Object.values<any>(riversJ.rivers)) { r.x = r.base_x; r.y = r.base_y; r.bank = r.base_bank;
    r.floodplain = r.base_floodplain ?? r.base_bank; delete r.base_x; delete r.base_y; delete r.base_bank; delete r.base_floodplain; }
  delete riversJ.prior; delete riversJ._meta.meander; console.log('undid the previous meander');
}

// ---------------------------------------------------------------- the heightfield rings (asl, row 0 = grid north)
interface RingF { name: string; half: number; cell: number; n: number; asl_min: number; step: number; file: string; h: Float64Array }
const rings: RingF[] = (['mid', 'far'] as const).map(name => { const m = terrainJ.rings[name]; const buf = readFileSync('public/' + m.file);
  const raw = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2), h = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) h[i] = m.asl_min + raw[i] * m.step;
  return { name, ...m, h }; });
const sample = (R: RingF, x: number, y: number) => { const gx = Math.min(R.n - 1.0001, Math.max(0, (x + R.half) / R.cell)), gy = Math.min(R.n - 1.0001, Math.max(0, (R.half - y) / R.cell));
  const c = Math.floor(gx), r = Math.floor(gy), fx = gx - c, fy = gy - r, i = r * R.n + c, h = R.h;
  return (h[i] * (1 - fx) + h[i + 1] * fx) * (1 - fy) + (h[i + R.n] * (1 - fx) + h[i + R.n + 1] * fx) * fy; };

// ---------------------------------------------------------------- what the meanders keep clear of
// the canals and villages of every pool seed (placed on the course and ground as build_terrain.py left them, which is how
// the game places them: canals.ts and villages.ts read data.ts baseCourse/priorTerrain): the river bends away from a
// canal (beyond its first 200 m, whose head is joined to the water) by top/2 + 30 m and from a village by r + 60 m
const T0 = (() => { const g = (k: string) => { const m = terrainJ.rings[k], b = readFileSync('public/' + m.file); return new Ring(m, new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), terrainJ.court_asl); };
  return new Terrain(terrainJ, g('near'), g('mid'), g('far')); })();
const R0 = parseRivers(riversJ).rivers;
const obst = new PointIndex(200); let obstN = 0;
for (const seed of WORLD_SEED_POOL) { const C = buildCanals(T0, R0, seed), V = placeVillages(T0, R0, C, seed);
  for (const c of C) { let s = 0; for (let i = 1; i < c.pts.length; i++) { s += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]); if (s > 200) { obst.add(c.pts[i][0], c.pts[i][1], 0); obstN++; } } }
  for (const v of V) for (let a = 0; a < 24; a++) for (const f of [0, 0.5, 1]) { obst.add(v.x + v.r * f * Math.cos(a * Math.PI / 12), v.y + v.r * f * Math.sin(a * Math.PI / 12), Math.round(v.r)); obstN++; } }
// the roads: the river crosses each where it did (calm, no swing within ~250 m of the crossing) and bends away from them elsewhere
const XING = roadRiverCrossings(R0, settlementRoads()).map(c => [c.x, c.y] as [number, number]);
for (const rd of settlementRoads()) for (let i = 1; i < rd.pts.length; i++) { const [ax, ay] = rd.pts[i - 1], [bx, by] = rd.pts[i], L = Math.hypot(bx - ax, by - ay);
  for (let a = 0; a < L; a += 10) { const x = ax + (bx - ax) * a / L, y = ay + (by - ay) * a / L; if (XING.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 260)) continue; obst.add(x, y, 1); obstN++; } }
const calmAt = (x: number, y: number) => { let d = 1e9; for (const [cx, cy] of XING) d = Math.min(d, Math.hypot(cx - x, cy - y)); return Math.min(1, Math.max(0, (d - 120) / 160)); };
console.log('obstacles', obstN, 'crossings', XING.length);
/** is a channel centre at (x, y) clear of every canal and village? */
const clearAt = (x: number, y: number, top: number) => { const [d, k] = obst.nearest(x, y, top / 2 + 360); if (k < 0) return true; const t = obst.tags[k];
  return t === 0 ? d > top / 2 + 30 : t === 1 ? d > top / 2 + 14 : d > 60 + top / 2; };

/** how far a line may swing to its left and right at each sample before the channel meets a canal or a village */
function lims(bx: number[], by: number[], top: number) {
  const n = bx.length, L: number[] = [], R: number[] = [];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2); let tx = bx[b] - bx[a], ty = by[b] - by[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    for (const [side, arr] of [[1, L], [-1, R]] as const) { let o = 0; while (o < 260 && clearAt(bx[i] - ty * (o + 4) * side, by[i] + tx * (o + 4) * side, top)) o += 4; arr.push(o); } }
  return { L, R };
}
// ---------------------------------------------------------------- the meander train
const smoothNoise = (s: number, L: number, salt: number) => mxNoise2(s / L + salt * 17.31, salt * 3.7 + 0.5); // ~[-1, 1]
interface Course { x: number[]; y: number[]; t: number[] }
/** a sine-generated curve (Langbein & Leopold 1966: the channel's direction swings as w sin(2 pi s / M) about the valley
 *  line, the shape of least total bending; B for alluvial rivers in general, C here) walked along the base line: arc
 *  wavelength M ~ 13-19 widths, swing w 0.55-1.2 rad (sinuosity ~1.1-1.5), a third harmonic for the bends' skew, and a
 *  slow pull back to the base line so the belt stays centred on the OSM course */
function meander(x: number[], y: number[], top: number, salt: number, keepEnd: boolean): Course {
  const n = x.length;
  // the base: the OSM line with its 450 m vertices rounded off (gaussian, sigma 80 m = 4 samples), the ends held
  const sm = (a: number[]) => a.map((_, i) => { let s = 0, w = 0; for (let k = -12; k <= 12; k++) { const j = Math.min(n - 1, Math.max(0, i + k)), g = Math.exp(-(k * k) / 32); s += a[j] * g; w += g; } return s / w; });
  const bx0 = sm(x), by0 = sm(y);
  // a slow wander of the belt itself (+-~110 m over 1-3 km; C): the OSM vertices' straight 450 m chords are not the river's
  const S0 = [0]; for (let i = 1; i < n; i++) S0.push(S0[i - 1] + Math.hypot(bx0[i] - bx0[i - 1], by0[i] - by0[i - 1]));
  const bx: number[] = [], by: number[] = [], l0 = lims(bx0, by0, top);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2); let tx = bx0[b] - bx0[a], ty = by0[b] - by0[a]; const l = Math.hypot(tx, ty) || 1;
    const tp = Math.min(1, S0[i] / 900) * (keepEnd ? Math.min(1, (S0[n - 1] - S0[i]) / 1200) : 1) * calmAt(bx0[i], by0[i]);
    let wv = (75 * smoothNoise(S0[i], 1900, salt + 9) + 35 * smoothNoise(S0[i], 800, salt + 10)) * tp * (top / 23) ** 0.5;
    let mL = 1e9, mR = 1e9; for (let k = Math.max(0, i - 15); k <= Math.min(n - 1, i + 15); k++) { mL = Math.min(mL, l0.L[k]); mR = Math.min(mR, l0.R[k]); }
    wv = Math.max(-0.45 * mR, Math.min(0.45 * mL, wv));
    bx.push(bx0[i] - (ty / l) * wv); by.push(by0[i] + (tx / l) * wv); }
  const S = [0]; for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(bx[i] - bx[i - 1], by[i] - by[i - 1]));
  const L = S[n - 1];
  const at = (p: number) => { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= p) lo = m; else hi = m; }
    const f = Math.min(1, Math.max(0, (p - S[lo]) / Math.max(1e-6, S[hi] - S[lo]))); const a = Math.max(0, lo - 2), b = Math.min(n - 1, hi + 2);
    let tx = bx[b] - bx[a], ty = by[b] - by[a]; const l = Math.hypot(tx, ty) || 1;
    return { x: bx[lo] + (bx[hi] - bx[lo]) * f, y: by[lo] + (by[hi] - by[lo]) * f, tx: tx / l, ty: ty / l, t: lo + f }; };
  // how far the belt may swing to each side at each base sample before it meets a canal or a village (D-670)
  const { L: limL, R: limR } = lims(bx, by, top);
  const limAt = (t: number, arr: number[]) => { let m = 1e9; for (let k = Math.max(0, Math.floor(t) - 2); k <= Math.min(n - 1, Math.ceil(t) + 2); k++) m = Math.min(m, arr[k]); return m; };
  const ds = 2; let p = 0, off = 0, phi = smoothNoise(0, 1, salt) * 3, s2 = 0, drift = 0;
  const raw: { x: number; y: number; t: number }[] = [];
  while (p < L) {
    const b = at(p);
    const taper = Math.min(1, p / 700) * (keepEnd ? Math.min(1, (L - p) / 1000) : Math.min(1, (L - p) / 300)) * calmAt(b.x, b.y);
    const M = top * (15 + 4 * smoothNoise(s2, 2600, salt) + 4.5 * smoothNoise(s2, 430, salt + 5)); // arc wavelength: bend to bend unlike
    // the swing: straighter and freer reaches; less where the base line itself bends hard (no loops onto itself)
    const ba = at(Math.max(0, p - M / 4)), bb = at(Math.min(L, p + M / 4)), kb = Math.abs(Math.atan2(ba.tx * bb.ty - ba.ty * bb.tx, ba.tx * bb.tx + ba.ty * bb.ty)) / (M / 2);
    const w = Math.max(0.2, Math.min(1.3, 0.82 + 0.28 * smoothNoise(s2, 3300, salt + 1) + 0.42 * smoothNoise(s2, 470, salt + 6))) * taper * Math.min(1, Math.max(0.15, 1 - 0.4 * kb * M));
    let th = w * Math.sin(phi) + 0.13 * w * Math.cos(3 * phi);
    drift += (off - drift) * ds / M; // the belt's mean offset over about a wavelength
    th -= Math.max(-0.5, Math.min(0.5, (drift * 1.6 + off * (1 - taper) * 3) / M * 2 * Math.PI));
    // the walls: steer back toward the base line well before a limit, and never past it
    const lL = limAt(b.t, limL), lR = limAt(b.t, limR);
    if (off > 0.6 * lL) th -= Math.min(0.9, (off - 0.6 * lL) / Math.max(8, 0.4 * lL)); if (-off > 0.6 * lR) th += Math.min(0.9, (-off - 0.6 * lR) / Math.max(8, 0.4 * lR));
    off = Math.max(-lR, Math.min(lL, off));
    raw.push({ x: b.x - b.ty * off, y: b.y + b.tx * off, t: b.t });
    off += ds * Math.sin(th); p += ds * Math.cos(th); s2 += ds; phi += (2 * Math.PI * ds) / M;
  }
  const e = at(L); raw.push({ x: e.x - e.ty * off * 0, y: e.y + e.tx * off * 0, t: n - 1 });
  // resample every 20 m along the new line, carrying the base parameter (index into the old arrays)
  const out: Course = { x: [raw[0].x], y: [raw[0].y], t: [raw[0].t] }; let need = 20;
  for (let i = 1; i < raw.length; i++) { let seg = Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y), from = 0;
    while (from + need <= seg) { from += need; const f = from / seg; out.x.push(raw[i - 1].x + (raw[i].x - raw[i - 1].x) * f); out.y.push(raw[i - 1].y + (raw[i].y - raw[i - 1].y) * f); out.t.push(raw[i - 1].t + (raw[i].t - raw[i - 1].t) * f); need = 20; }
    need -= seg - from; void seg; }
  const last = raw[raw.length - 1]; if (Math.hypot(out.x[out.x.length - 1] - last.x, out.y[out.y.length - 1] - last.y) > 2) { out.x.push(last.x); out.y.push(last.y); out.t.push(last.t); }
  if (keepEnd) { out.x[out.x.length - 1] = x[n - 1]; out.y[out.y.length - 1] = y[n - 1]; }
  return out;
}
const lerpAt = (a: number[], t: number) => { const i = Math.min(a.length - 2, Math.floor(t)), f = t - i; return a[i] + (a[i + 1] - a[i]) * f; };

// ---------------------------------------------------------------- the old trench filled, the new course carved
/** nearest-point index over a dense line (bucketed) */
function lineIndex(px: number[], py: number[], cell: number) {
  const m = new Map<string, number[]>(); px.forEach((x, i) => { const k = `${Math.floor(x / cell)},${Math.floor(py[i] / cell)}`; let a = m.get(k); if (!a) m.set(k, a = []); a.push(i); });
  return (x: number, y: number, r: number): [number, number] => { let bd = r, bi = -1; const cx = Math.floor(x / cell), cy = Math.floor(y / cell), k = Math.ceil(r / cell);
    for (let i = cx - k; i <= cx + k; i++) for (let j = cy - k; j <= cy + k; j++) for (const q of m.get(`${i},${j}`) ?? []) { const d = Math.hypot(px[q] - x, py[q] - y); if (d < bd) { bd = d; bi = q; } }
    return [bd, bi]; };
}
const dense = (x: number[], y: number[], v: number[][], step = 4) => { const X: number[] = [], Y: number[] = [], V: number[][] = v.map(() => []);
  for (let i = 0; i < x.length - 1; i++) { const seg = Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]), k = Math.max(1, Math.ceil(seg / step));
    for (let j = 0; j < k; j++) { const f = j / k; X.push(x[i] + (x[i + 1] - x[i]) * f); Y.push(y[i] + (y[i + 1] - y[i]) * f); v.forEach((a, q) => V[q].push(a[i] + (a[i + 1] - a[i]) * f)); } }
  X.push(x[x.length - 1]); Y.push(y[y.length - 1]); v.forEach((a, q) => V[q].push(a[a.length - 1])); return { X, Y, V }; };

const stats: Record<string, any> = {};
// every sample this tool changes keeps its value as build_terrain.py left it (data.ts priorTerrain: the canals and villages
// are placed on that ground, so the meanders move none of them)
const prior = new Map<RingF, Map<number, number>>(rings.map(R => [R, new Map()]));
const setH = (R: RingF, i: number, v: number) => { const m = prior.get(R)!; if (!m.has(i)) m.set(i, Math.round((R.h[i] - R.asl_min) / R.step)); R.h[i] = v; };
for (const [rid, r] of Object.entries<any>(riversJ.rivers)) {
  const ch = r.channel, top = r.top_width_m, H = ch.bank_height_m;
  const salt = rid === 'river_pulvar' ? 1 : 2;
  const c = meander(r.x, r.y, top, salt, rid === 'river_pulvar'); // the Pulvar's end meets the Kur where it did
  const bank = c.t.map(t => lerpAt(r.bank, t)), flood = c.t.map(t => lerpAt(r.floodplain, t));
  for (let i = 1; i < bank.length; i++) bank[i] = Math.min(bank[i], bank[i - 1]); // non-increasing downstream (as built)
  for (const R of rings) {
    const margin = 0.3 + 0.002 * R.cell * 2, rc = top / 2 + R.cell, rcNew = top / 2 + R.cell * 1.42; // (the new carve covers a cell's diagonal: the bilinear surface stays under the bed everywhere on the line)
    // 1. fill the old trench: each carved sample back to the line between the floodplain samples either side of it
    const od = dense(r.x, r.y, [r.bank.map((b: number) => b - H), r.floodplain]), oNear = lineIndex(od.X, od.Y, 64);
    const nd = dense(c.x, c.y, [bank.map(b => b - H)]), nNear = lineIndex(nd.X, nd.Y, 64);
    const x0 = Math.min(...od.X, ...nd.X) - rcNew - R.cell, x1 = Math.max(...od.X, ...nd.X) + rcNew + R.cell, y0 = Math.min(...od.Y, ...nd.Y) - rcNew - R.cell, y1 = Math.max(...od.Y, ...nd.Y) + rcNew + R.cell;
    const c0 = Math.max(0, Math.floor((x0 + R.half) / R.cell)), c1 = Math.min(R.n - 1, Math.ceil((x1 + R.half) / R.cell));
    const r0 = Math.max(0, Math.floor((R.half - y1) / R.cell)), r1 = Math.min(R.n - 1, Math.ceil((R.half - y0) / R.cell));
    const fill: [number, number][] = []; let filled = 0, carved = 0;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const x = cc * R.cell - R.half, y = R.half - rr * R.cell; const [d, k] = oNear(x, y, rc + 0.5); if (k < 0) continue;
      const i = rr * R.n + cc; if (R.h[i] > od.V[0][k] - margin + 0.05) continue; // not carved (the ground was already lower: left)
      const a = Math.max(0, k - 3), b = Math.min(od.X.length - 1, k + 3); let tx = od.X[b] - od.X[a], ty = od.Y[b] - od.Y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const u = (x - od.X[k]) * -ty + (y - od.Y[k]) * tx, W = rc + 1.6 * R.cell;
      const hl = sample(R, od.X[k] + ty * W, od.Y[k] - tx * W), hr = sample(R, od.X[k] - ty * W, od.Y[k] + tx * W); // u > 0: left
      // (never above the old profile's floodplain: in a valley the samples either side stand on the slopes)
      const fpOld = od.V[1][k];
      const f = Math.min(1, Math.max(0, (u + W) / (2 * W))); fill.push([i, Math.min(hr + (hl - hr) * f, fpOld + 0.3)]); void d;
    }
    for (const [i, v] of fill) { setH(R, i, v); filled++; }
    // 2. carve the new course by build_terrain.py's rule
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const x = cc * R.cell - R.half, y = R.half - rr * R.cell; const [, k] = nNear(x, y, rcNew); if (k < 0) continue;
      const i = rr * R.n + cc, v = nd.V[0][k] - margin; if (R.h[i] > v) { setH(R, i, v); carved++; }
    }
    stats[`${rid}:${R.name}`] = { filled, carved };
  }
  let Lold = 0, Lnew = 0; for (let i = 1; i < r.x.length; i++) Lold += Math.hypot(r.x[i] - r.x[i - 1], r.y[i] - r.y[i - 1]); for (let i = 1; i < c.x.length; i++) Lnew += Math.hypot(c.x[i] - c.x[i - 1], c.y[i] - c.y[i - 1]);
  stats[rid] = { points: [r.x.length, c.x.length], sinuosity_added: +(Lnew / Lold).toFixed(3) };
  r.base_x = r.x; r.base_y = r.y; r.base_bank = r.bank; r.base_floodplain = r.floodplain; // the course as build_terrain.py left it (the canals and villages are placed on it: data.ts baseCourse)
  r.x = c.x.map(v => Math.round(v * 10) / 10); r.y = c.y.map(v => Math.round(v * 10) / 10);
  r.bank = bank.map(v => Math.round(v * 100) / 100); r.floodplain = flood.map(v => Math.round(v * 100) / 100);
}
for (const R of rings) { const raw = new Uint16Array(R.h.length); for (let i = 0; i < raw.length; i++) raw[i] = Math.max(0, Math.min(65535, Math.round((R.h[i] - R.asl_min) / R.step)));
  writeFileSync('public/' + R.file, Buffer.from(raw.buffer)); }
// the prior samples, per ring: index deltas (u16; 0 = escape, then the delta as two u16) and the raw u16 values, base64
riversJ.prior = {};
for (const R of rings) { const m = [...prior.get(R)!.entries()].sort((a, b) => a[0] - b[0]), d: number[] = []; let last = 0;
  for (const [i] of m) { const dl = i - last; if (dl > 0 && dl < 65536) d.push(dl); else d.push(0, dl >>> 16, dl & 65535); last = i; }
  riversJ.prior[R.name] = { n: m.length, d: Buffer.from(new Uint16Array(d).buffer).toString('base64'), v: Buffer.from(new Uint16Array(m.map(e => e[1])).buffer).toString('base64') }; }
riversJ._meta.meander = 'D-670: the OSM course (C) rounded and given a reconstructed meander train (C): wavelength ~12 widths, bend radius 1.7-3.5 widths, straighter and freer reaches (tools/plain/meander.ts); the old straight trench filled, the new course carved';
writeFileSync(G + 'rivers.json', JSON.stringify(riversJ));
console.log(JSON.stringify(stats, null, 1));
