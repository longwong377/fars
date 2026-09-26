// D-257: the Pasargadae road's course (settlement.json road_pasargadae) was digitised on the modern Pulvar's line, so the
// road as drawn crossed the river 14 times and ran inside its channel for ~400 m. A road up a valley keeps to a bank and
// crosses only where the valley forces it. This redraws the course beyond its third vertex (5.2 km NE of the Terrace) as
// the least-cost path over a 40 m grid of the valley: distance x (1 + (slope/5 %)^2), ground steeper than 25 % impassable
// (35 % within 250 m of the river: a gorge road cut into the side, Tang-e Bulaghi, C), entering the channel costs a ford
// (8 km), the wet margin (< 70 m) and leaving the valley floor (> 700 m) cost extra; then simplified (15 m) without any
// shortcut coming nearer the river than the path it replaces. Prints the checks; --write stores the polyline.
//   npx tsx tools/dev/reroute_pasargadae.ts [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';

const T = loadTerrain(), R = loadRiversFile(), rv = R.rivers.find(r => r.id === 'river_pulvar')!;
const S = JSON.parse(readFileSync('src/data/settlement.json', 'utf8')), road = S.features.find((f: any) => f.id === 'road_pasargadae');
const P = JSON.parse(readFileSync('src/data/plain.json', 'utf8')), quarry = P.features.find((f: any) => f.id === 'quarry_sivand').xy as [number, number];
const n = rv.x.length;
const nearestIdx = (x: number, y: number) => { let b = 0, bd = Infinity; for (let k = 0; k < n; k++) { const d = Math.hypot(rv.x[k] - x, rv.y[k] - y); if (d < bd) { bd = d; b = k; } } return [b, bd] as const; };
const distRiver = (x: number, y: number) => nearestIdx(x, y)[1];
// the side (left of downstream = +1) of a point
const sideOf = (x: number, y: number) => { const [k] = nearestIdx(x, y), a = Math.max(0, k - 2), b = Math.min(n - 1, k + 2), tx = rv.x[b] - rv.x[a], ty = rv.y[b] - rv.y[a]; return Math.sign(tx * (y - rv.y[k]) - ty * (x - rv.x[k])); };
const side = sideOf(...quarry);
const keep = 3; // vertices 0..2 unchanged (Terrace to the first crossing at 5.2 km)
const pts = road.polyline as [number, number][], start = pts[keep - 1], end = pts[pts.length - 1];
const [k0] = nearestIdx(...start), [k1] = nearestIdx(...end); // river indices: upstream first, so k1 < k0
const slope = (x: number, y: number) => { const h = (a: number, b: number) => T.heightAt(a, -b); return Math.hypot(h(x + 15, y) - h(x - 15, y), h(x, y + 15) - h(x, y - 15)) / 30; };
// least-cost path over a 40 m grid of the valley: distance x (1 + slope penalty), ground over 25 % impassable, a cell in
// the channel costs a ford (3 km), a cell within 70 m of it costs double (a road keeps off the wet margin)
const G = 40, x0 = Math.min(start[0], end[0]) - 3000, x1 = Math.max(start[0], end[0]) + 3000, y0 = Math.min(start[1], end[1]) - 3000, y1 = Math.max(start[1], end[1]) + 3000;
const NX = Math.ceil((x1 - x0) / G) + 1, NY = Math.ceil((y1 - y0) / G) + 1, N = NX * NY;
const cx = (i: number) => x0 + (i % NX) * G, cy = (i: number) => y0 + Math.floor(i / NX) * G;
const dRiv = new Float32Array(N).fill(1e9);
for (let k = 0; k < n; k++) { const ix = Math.round((rv.x[k] - x0) / G), iy = Math.round((rv.y[k] - y0) / G);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const jx = ix + dx, jy = iy + dy; if (jx < 0 || jy < 0 || jx >= NX || jy >= NY) continue; const j = jy * NX + jx; dRiv[j] = Math.min(dRiv[j], Math.hypot(cx(j) - rv.x[k], cy(j) - rv.y[k])); } }
// chamfer distance transform (m) from the river cells, so "in the valley" is known everywhere
for (let pass = 0; pass < 2; pass++) for (let q = 0; q < N; q++) { const i = pass ? N - 1 - q : q, ix = i % NX, iy = Math.floor(i / NX), sg = pass ? 1 : -1;
  for (const [dx, dy, w] of [[sg, 0, G], [0, sg, G], [sg, sg, G * Math.SQRT2], [-sg, sg, G * Math.SQRT2]] as const) { const jx = ix + dx, jy = iy + dy; if (jx < 0 || jy < 0 || jx >= NX || jy >= NY) continue; const v = dRiv[jy * NX + jx] + w; if (v < dRiv[i]) dRiv[i] = v; } }
// a gorge road may be cut into the side (Tang-e Bulaghi, C): up to 35 % within 250 m of the river, 25 % elsewhere; a road
// that leaves the valley floor (over 700 m from the river) pays 2x
const cellCost = new Float32Array(N);
for (let i = 0; i < N; i++) { const sl = slope(cx(i), cy(i)), d = dRiv[i]; cellCost[i] = sl > (d < 250 ? 0.35 : 0.25) ? Infinity : 1 + (sl / 0.05) ** 2 + (d < 32 ? 8000 / G : d < 70 ? 1 : 0) + (d > 700 ? 2 : 0); }
const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
const heap: number[] = [], hk: number[] = [];
const push = (i: number, d: number) => { heap.push(i); hk.push(d); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= hk[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hk[p], hk[c]] = [hk[c], hk[p]]; c = p; } };
const pop = () => { const top = heap[0], tk = hk[0], li = heap.pop()!, lk = hk.pop()!; if (heap.length) { heap[0] = li; hk[0] = lk; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && hk[l] < hk[m]) m = l; if (r < heap.length && hk[r] < hk[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hk[m], hk[c]] = [hk[c], hk[m]]; c = m; } } return [top, tk] as const; };
const idx = (p: [number, number]) => Math.round((p[1] - y0) / G) * NX + Math.round((p[0] - x0) / G);
const si = idx(start as any), ei = idx(end as any); dist[si] = 0; push(si, 0);
while (heap.length) { const [i, d] = pop(); if (d > dist[i]) continue; if (i === ei) break; const ix = i % NX, iy = Math.floor(i / NX);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const jx = ix + dx, jy = iy + dy; if (jx < 0 || jy < 0 || jx >= NX || jy >= NY) continue; const j = jy * NX + jx;
    const nd = d + G * Math.hypot(dx, dy) * (cellCost[i] + cellCost[j]) / 2; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(j, nd); } } }
const course: [number, number][] = []; for (let i = ei; i >= 0; i = prev[i]) { course.push([cx(i), cy(i)]); if (i === si) break; } course.reverse();
course.splice(0, 1); course.pop(); // the ends are the kept vertex and the road's end
// Douglas-Peucker to ~15 m, then check every 8 m of the result
// a shortcut may not come nearer the river than the raw path it replaces (keeps the path off the water in the gorge)
const minDAlong = (q: [number, number][]) => { let m = Infinity; for (let i = 0; i + 1 < q.length; i++) { const [a, b] = [q[i], q[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= L; t += 8) m = Math.min(m, distRiver(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L)); } return m; };
const dp = (p: [number, number][], eps: number): [number, number][] => { if (p.length < 3) return p; const [a, b] = [p[0], p[p.length - 1]]; let md = -1, mi = 0;
  for (let i = 1; i < p.length - 1; i++) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, d = Math.abs(dy * p[i][0] - dx * p[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > md) { md = d; mi = i; } }
  const split = md > eps || minDAlong([a, b]) < Math.min(40, minDAlong(p)) - 2;
  return split ? [...dp(p.slice(0, mi + 1), eps).slice(0, -1), ...dp(p.slice(mi), eps)] : [a, b]; };
const out: [number, number][] = [...pts.slice(0, keep), ...dp(course, 15).map(p => [Math.round(p[0]), Math.round(p[1])] as [number, number]), end];
const segX = (a: number[], b: number[], c: number[], d: number[]) => { const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx; if (!den) return false; const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
let crossings = 0, minD = Infinity, length = 0; const slopes: number[] = [];
for (let i = 0; i + 1 < out.length; i++) { const [a, b] = [out[i], out[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); length += L;
  for (let k = 1; k < n; k++) if (segX(a, b, [rv.x[k - 1], rv.y[k - 1]], [rv.x[k], rv.y[k]])) crossings++;
  if (i >= keep - 1) for (let s = 8; s <= L; s += 8) { const x = a[0] + (b[0] - a[0]) * s / L, y = a[1] + (b[1] - a[1]) * s / L; minD = Math.min(minD, distRiver(x, y)); slopes.push(slope(x, y)); } }
slopes.sort((p, q) => p - q); const pct = (q: number) => +slopes[Math.floor(q * (slopes.length - 1))].toFixed(3);
console.log(JSON.stringify({ vertices: out.length, km: +(length / 1000).toFixed(1), river_crossings: crossings, min_dist_to_river_m: Math.round(minD), slope_p50: pct(0.5), slope_p95: pct(0.95), slope_p99: pct(0.99), slope_max: pct(1), over10pct: slopes.filter(v => v > 0.1).length * 8, quarry_dist_m: Math.round(Math.min(...out.map(p => Math.hypot(p[0] - quarry[0], p[1] - quarry[1])))) }));
writeFileSync(process.env.OUT ?? '/dev/null', JSON.stringify({ road: out, orig: pts, river: Array.from(rv.x, (x, i) => [x, rv.y[i]]) }));
if (process.argv.includes('--write')) { road.polyline = out; road.course_note = 'D-257: polyline beyond 5.2 km redrawn as a least-cost valley path (tools/dev/reroute_pasargadae.ts): the modern trace (polyline_latlon) lies on the river line and crossed it 14 times; the redrawn road crosses the Pulvar 3 times, each at a ford (plain/crossings.ts); course C';
  // splice only the road's polyline and note into the file's own text (JSON.stringify would rewrite 8.0 as 8 and the \\u escapes)
  writeFileSync(process.env.ROUTE_OUT ?? 'road_pasargadae.route.json', JSON.stringify({ polyline: out, course_note: road.course_note }));
  console.log('route written; merge it with: python3 -c "import json;r=json.load(open(\'road_pasargadae.route.json\'));t=open(\'src/data/settlement.json\').read();S=json.loads(t);f=[f for f in S[\'features\'] if f[\'id\']==\'road_pasargadae\'][0];f.update(r);open(\'src/data/settlement.json\',\'w\').write(json.dumps(S,indent=1)+\'\\n\')"'); }
