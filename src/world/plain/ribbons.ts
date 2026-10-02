// Linear features draped on the terrain (Phase 7): canal spoil banks and the village tracks. Both are ribbons whose
// vertices sit on the rendered/walked terrain (Terrain.heightAt, D-035) and rise with camera distance like the rivers
// (rivers.ts liftNode), so the terrain's coarse far LODs never bury them. Canals: water at ground level between two low
// earthen banks (irrigation_systems_sumner rule, C); tracks: compacted earth with wheel ruts (villages_unlocated.tracks, C).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionWorld, vec3, float, mix, smoothstep, abs, mx_noise_float, color, max } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial, WEATHER, type Layer } from '../../render/materials';
import { groundScan, groundLoaded } from '../../render/scans';
import { liftNode } from './rivers';
import type { Canal } from './canals';
import type { Village } from './villages';
import { feature, settlementRoads, distToSegment, tag } from './data';
import { hash2, unit, cellU } from './fields';

const SOIL = new THREE.Color().setRGB(0.43, 0.36, 0.27, THREE.SRGBColorSpace);
/** a ribbon over a grid polyline: `profile` gives [lateral offset, height above ground, attribute t] per cross-section vertex */
function ribbon(pts: [number, number][], terrain: Terrain, profile: [number, number, number][], step: number, out: { pos: number[]; col: number[]; att: number[]; idx: number[] }) {
  // resample
  const P: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
  P.push(pts[pts.length - 1]);
  const per = profile.length, base = out.pos.length / 3;
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    const g0 = terrain.heightAt(P[i][0], -P[i][1]);
    for (const [u, h, t] of profile) {
      const x = P[i][0] + nx * u, y = P[i][1] + ny * u, g = Math.abs(u) < 1.5 ? g0 : terrain.heightAt(x, -y);
      out.pos.push(x, g + h, -y); out.col.push(SOIL.r, SOIL.g, SOIL.b); out.att.push(t);
    }
    if (i > 0) { const s0 = base + (i - 1) * per, s1 = base + i * per; // profile listed right (negative u) to left: counter-clockwise from above
      for (let k = 0; k + 1 < per; k++) out.idx.push(s0 + k, s1 + k, s0 + k + 1, s0 + k + 1, s1 + k, s1 + k + 1); }
  }
}
function mesh(name: string, buf: { pos: number[]; col: number[]; att: number[]; idx: number[] }, mat: THREE.Material, userData: any): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3)); g.setAttribute('lat', new THREE.Float32BufferAttribute(buf.att, 1));
  g.setIndex(buf.idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; m.frustumCulled = false; m.userData = userData; return m;
}

export function canalBanks(canals: Canal[], terrain: Terrain): THREE.Mesh {
  const rule = feature('irrigation_systems_sumner').procedural_rule, crest = rule.bank_crest_m as number;
  const buf = { pos: [] as number[], col: [] as number[], att: [] as number[], idx: [] as number[] };
  for (const c of canals) {
    const w = c.width / 2;
    ribbon(c.pts, terrain, [[-(w + 2.2), 0.03, 1], [-(w + 0.7), crest, 0.5], [-w, 0.02, 0], [0, -0.25, 0], [w, 0.02, 0], [w + 0.7, crest, 0.5], [w + 2.2, 0.03, 1]], 12.5, buf);
  }
  const mat = surfaceMaterial('earth', { vertexColors: true, variant: 'canalbank', scan: false, modify: (L: Layer) => {
    const t = attribute('lat', 'float');
    // D-302: the spoil's dust (wet: mud), the bank's herbs and the wet mud at the water with their ground scans (identity in node)
    const G = { dust: groundScan('dust', 2.0, { scale2: 9.1 }), mud: groundScan('mud', 1.6), green: groundScan('green', 2.5) }, on = groundLoaded();
    const det = (c: any, w = 0.85): any => mix(vec3(1), c, w), wetG = WEATHER.wetness.mul(0.9);
    const base = on ? attribute('color', 'vec3').mul(det(mix(G.dust.c, G.mud.c, wetG))) : L.alb;
    const grass = color(new THREE.Color().setRGB(0.27, 0.36, 0.14, THREE.SRGBColorSpace)), wet = color(new THREE.Color().setRGB(0.25, 0.21, 0.16, THREE.SRGBColorSpace));
    const gA = smoothstep(0.1, 0.45, t).mul(float(1).sub(smoothstep(0.7, 1.0, t))).mul(0.8), gE = on ? smoothstep(-1.4, 1.4, G.green.h.mul(0.5).add(gA.mul(2).sub(1).mul(2.4))).mul(0.9) : gA;
    let alb = mix(base, grass.mul(det(G.green.c)).mul(mx_noise_float(positionWorld.mul(1.7)).mul(0.2).add(1)), gE);
    const wA = float(1).sub(smoothstep(0.0, 0.2, t));
    alb = mix(alb, wet.mul(det(G.mud.c)), wA);
    const hS = mix(mix(mix(G.dust.h, G.mud.h, wetG).mul(0.006), G.green.h.mul(0.012), gE), G.mud.h.mul(0.006), wA);
    return { alb, rough: L.rough, height: on ? hS : L.height };
  } });
  mat.positionNode = positionLocal.add(vec3(0, liftNode(positionLocal), 0));
  return mesh('plain-canal-banks', buf, mat, tag(feature('irrigation_systems_sumner'), 'canal spoil banks and water: procedural rule (off-takes every 2-4 km, contour at 0.5 m/km, 1.5-3 m wide: C)'));
}

/** village tracks: minimum spanning tree over the villages plus each village's link to its nearest settlement.json road (C) */
export function trackLines(villages: Village[]): [number, number][][] {
  const n = villages.length, inTree = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1), edges: [number, number][] = [];
  inTree[0] = true; for (let j = 1; j < n; j++) { best[j] = Math.hypot(villages[j].x - villages[0].x, villages[j].y - villages[0].y); from[j] = 0; }
  for (let k = 1; k < n; k++) {
    let bi = -1; for (let j = 0; j < n; j++) if (!inTree[j] && (bi < 0 || best[j] < best[bi])) bi = j;
    inTree[bi] = true; edges.push([from[bi], bi]);
    for (let j = 0; j < n; j++) if (!inTree[j]) { const d = Math.hypot(villages[j].x - villages[bi].x, villages[j].y - villages[bi].y); if (d < best[j]) { best[j] = d; from[j] = bi; } }
  }
  const lines: [number, number][][] = [];
  for (const [a, b] of edges) { const A = villages[a], B = villages[b]; if (Math.hypot(A.x - B.x, A.y - B.y) < 9000) lines.push([[A.x, A.y], [B.x, B.y]]); }
  const roads = settlementRoads();
  for (const v of villages) {
    let bd = Infinity, bp: [number, number] | null = null;
    for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i];
      const d = distToSegment(v.x, v.y, ax, ay, bx, by); if (d < bd) { bd = d; const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((v.x - ax) * dx + (v.y - ay) * dy) / (dx * dx + dy * dy))); bp = [ax + t * dx, ay + t * dy]; } }
    if (bp && bd < 6000 && bd > v.r) lines.push([[v.x, v.y], bp]);
  }
  // meander gently (a track follows field edges, not a ruled line): +-12 m at ~700 m wavelength, zero at the ends
  return lines.map(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(L / 25)), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, ph = unit(hash2(cellU(a[0]), cellU(b[1]), 95)) * 6.28;
    return Array.from({ length: n + 1 }, (_, k) => { const t = k / n, o = Math.sin(t * L / 700 * 6.28 + ph) * 12 * Math.sin(Math.PI * t); return [a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o] as [number, number]; }); });
}
/** s17 (D-560, for C6's quarries): the quarrymen's worn path from each quarry down to the nearest track or road, found on
 *  the terrain (A* on a 25 m grid: length weighted by slope, nothing steeper than 1 in 3; the hauling of blocks on sledges
 *  wants the gentlest way down, C); smoothed, as a track line. `targets`: the lines it may join */
export const QUARRY_PATH = { cell: 25, maxSlope: 0.33, reach: 9000 } as const;
export function quarryPaths(sites: { x: number; y: number }[], targets: [number, number][][], terrain: { heightAt(x: number, z: number): number }): [number, number][][] {
  const out: [number, number][][] = [], C = QUARRY_PATH.cell;
  for (const q of sites) {
    // the nearest target point bounds the search box (with a margin for the way round)
    let bd = Infinity, bp: [number, number] = [q.x, q.y];
    for (const L of targets) for (let i = 1; i < L.length; i++) { const [ax, ay] = L[i - 1], [bx, by] = L[i], d = distToSegment(q.x, q.y, ax, ay, bx, by);
      if (d < bd) { bd = d; const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / (dx * dx + dy * dy || 1))); bp = [ax + t * dx, ay + t * dy]; } }
    if (bd > QUARRY_PATH.reach) continue;
    const m = Math.max(1500, bd * 0.6), x0 = Math.min(q.x, bp[0]) - m, y0 = Math.min(q.y, bp[1]) - m, nx = Math.ceil((Math.max(q.x, bp[0]) + m - x0) / C) + 1, ny = Math.ceil((Math.max(q.y, bp[1]) + m - y0) / C) + 1;
    const N = nx * ny, hgt = new Float32Array(N), goal = new Uint8Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) hgt[j * nx + i] = terrain.heightAt(x0 + i * C, -(y0 + j * C));
    for (const L of targets) for (let k = 1; k < L.length; k++) { const [ax, ay] = L[k - 1], [bx, by] = L[k], len = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t <= len; t += C / 2) { const px = ax + (bx - ax) * t / (len || 1), py = ay + (by - ay) * t / (len || 1), i = Math.round((px - x0) / C), j = Math.round((py - y0) / C); if (i >= 0 && j >= 0 && i < nx && j < ny) goal[j * nx + i] = 1; } }
    // A* (a binary heap on f), 8 neighbours (g and f in float64: float32 rounding re-fired the same relaxation without end)
    const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), hx = Math.round((bp[0] - x0) / C), hy = Math.round((bp[1] - y0) / C);
    const heap: number[] = [], f = new Float64Array(N), push = (n: number) => { heap.push(n); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (f[heap[p]] <= f[n]) break; heap[c] = heap[p]; c = p; } heap[c] = n; };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { let c = 0; for (;;) { let l = 2 * c + 1; if (l >= heap.length) break; if (l + 1 < heap.length && f[heap[l + 1]] < f[heap[l]]) l++; if (f[heap[l]] >= f[last]) break; heap[c] = heap[l]; c = l; } heap[c] = last; } return top; };
    const s0 = Math.round((q.y - y0) / C) * nx + Math.round((q.x - x0) / C); g[s0] = 0; f[s0] = Math.hypot(hx * C - (q.x - x0), hy * C - (q.y - y0)); push(s0);
    let end = -1;
    while (heap.length) { const n = pop(); if (goal[n]) { end = n; break; } const i = n % nx, j = (n - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = b * nx + a, d = C * Math.hypot(di, dj), sl = Math.abs(hgt[k] - hgt[n]) / d; if (sl > QUARRY_PATH.maxSlope && n !== s0) continue;
        const ng = g[n] + d * (1 + 40 * sl * sl); if (ng < g[k]) { g[k] = ng; from[k] = n; f[k] = ng + Math.hypot((a - hx) * C, (b - hy) * C); push(k); } } }
    if (end < 0) continue;
    const pts: [number, number][] = []; for (let n = end; n >= 0; n = from[n]) { const i = n % nx; pts.push([x0 + i * C, y0 + ((n - i) / nx) * C]); }
    pts.reverse(); pts[0] = [q.x, q.y];
    // smoothed (three passes of a 3-point average, the ends kept)
    for (let pass = 0; pass < 3; pass++) for (let k = 1; k < pts.length - 1; k++) pts[k] = [(pts[k - 1][0] + pts[k][0] + pts[k + 1][0]) / 3, (pts[k - 1][1] + pts[k][1] + pts[k + 1][1]) / 3];
    out.push(pts);
  }
  return out;
}
/** `steep`: the lines (by index) drawn whatever the slope (the quarry paths: the village tracks are cut where the ground climbs) */
export function tracksMesh(lines: [number, number][][], terrain: Terrain, width = feature('villages_unlocated').tracks.width_m as number, name = 'plain-tracks', steep: Set<number> = new Set()): THREE.Mesh {
  const w = width / 2;
  const buf = { pos: [] as number[], col: [] as number[], att: [] as number[], idx: [] as number[] };
  // skip stretches that would climb a mountainside (a track goes round, C): cut the line where the ground is steep
  for (const [li, line] of lines.entries()) {
    let run: [number, number][] = [];
    const flush = () => { if (run.length > 3) ribbon(run, terrain, [[-(w + 1.2), 0.02, -1.4], [-w, 0.05, -1], [w, 0.05, 1], [w + 1.2, 0.02, 1.4]], 18, buf); run = []; };
    for (let i = 0; i < line.length; i++) { const [x, y] = line[i]; const s = Math.abs(terrain.heightAt(x + 10, -y) - terrain.heightAt(x - 10, -y)) / 20 + Math.abs(terrain.heightAt(x, -y - 10) - terrain.heightAt(x, -y + 10)) / 20;
      if (s > 0.1 && !steep.has(li)) flush(); else run.push([x, y]); }
    flush();
  }
  const mat = surfaceMaterial('earth', { vertexColors: true, variant: 'track', scan: false, modify: (L: Layer) => {
    const t = abs(attribute('lat', 'float'));
    // D-302: the trodden track's packed earth and fine gravel (wet: mud) over the dust of its verges, with their scans
    const G = { dust: groundScan('dust', 2.0, { scale2: 9.1 }), packed: groundScan('packed', 2.0, { scale2: 8.3 }), mud: groundScan('mud', 1.6) }, on = groundLoaded();
    const det = (c: any, w = 0.85): any => mix(vec3(1), c, w), wetG = WEATHER.wetness.mul(0.9);
    const base = on ? attribute('color', 'vec3').mul(det(mix(G.dust.c, G.mud.c, wetG))) : L.alb;
    const packed = color(new THREE.Color().setRGB(0.58, 0.51, 0.40, THREE.SRGBColorSpace));
    const rut = float(1).sub(smoothstep(0.08, 0.2, abs(t.sub(0.55)))); // two wheel ruts
    const core = float(1).sub(smoothstep(0.85, 1.25, t));
    let alb = mix(base, packed.mul(det(mix(G.packed.c, G.mud.c, wetG))).mul(mx_noise_float(positionWorld.mul(0.9)).mul(0.08).add(1)), core.mul(0.85));
    alb = alb.mul(float(1).sub(rut.mul(0.12).mul(core)));
    const hS = mix(mix(G.dust.h, G.mud.h, wetG).mul(0.006), mix(G.packed.h, G.mud.h, wetG).mul(0.008), core.mul(0.85)).sub(rut.mul(0.03));
    return { alb, rough: L.rough, height: on ? hS : (L.height ? L.height.mul(max(float(0.3), float(1).sub(core))).sub(rut.mul(0.03)) : null) };
  } });
  mat.positionNode = positionLocal.add(vec3(0, liftNode(positionLocal).mul(0.5), 0));
  return mesh(name, buf, mat, tag(feature('villages_unlocated').tracks as any, name === 'plain-tracks' ? 'village tracks: reconstructed courses (C), 3.5 m compacted earth' : 'settlement.json roads beyond the settlement zones (courses C; drawn here only when PLAIN_DRAWS_SETTLEMENT_ROADS)'));
}
