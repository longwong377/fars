// Post-step of the people's garments (D-307, re-cut D-322): reads what Blender's cloth solver settled (tools/blender/
// cloth.py: <piece>_<group>.settled.f32, Blender axes, on the refined cut of people_cloth.ts) and gives every level of detail
// of every simulated piece its drape: each vertex of the piece as the game builds it (outfits.ts, LOD 0-2) finds the nearest
// point of the refined fitted cut and takes the settled cloth there, low-passed to what that level can carry (a Gaussian over
// the settled displacement, σ half the vertex's shortest edge: a fold narrower than the level's mesh is not aliased into
// it), written as the displacement from its procedural placement on the group's reference body in the piece's own local
// frame (peopleModels.drapeFrame), so the game adds it on every body of the group. A tube's lining (cavity 150) follows the
// nearest outer vertex. An outer layer (the registry's `over`: sash, headcloth, veil, kandys) is kept at least `gap` outside
// the pieces under it as they are drawn at the same level (the low-pass fills the under-layer's valleys).
// Writes people_cloth.json / .bin (Int16, 0.1 mm) and post_stats.json.
// Usage: npx tsx tools/blender/sources/people_cloth_post.ts <srcDir> <outDir> <argsJson>
import { writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../../../src/people/humanAssets';
import { buildOutfits, geoKeyOf, type Geo } from '../../../src/people/outfits';
import { BinWriter, drapeFrames, DRAPE_UNIT, type DrapeMeta, type DrapeSetMeta } from '../../../src/people/peopleModels';
import { readPLY } from '../lib/ply';

const [srcDir, outDir, argJson] = process.argv.slice(2);
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
const job = JSON.parse(readFileSync(`${srcDir}/job.json`, 'utf8'));
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const LODS: number[] = ARGS.lods ?? [0, 1, 2];
const O = buildOutfits(A, { lods: LODS }); const geos = O.geos!;
const W = new BinWriter(); const sets: Record<string, DrapeSetMeta> = {}; const stats: Record<string, any> = {};
const rd = (p: string) => { const b = readFileSync(p); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
type V3 = [number, number, number];

/** closest point on triangle abc to p: [distance², u, v, w] (barycentrics of a, b, c) (Ericson, Real-Time Collision Detection 5.1.5) */
function closestTri(p: V3, a: V3, b: V3, c: V3): [number, number, number, number] {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dt = (x: number[], y: number[]) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const d1 = dt(ab, ap), d2 = dt(ac, ap); let u = 1, v = 0, w = 0;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; } else {
    const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]], d3 = dt(ab, bp), d4 = dt(ac, bp);
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); u = 1 - t; v = t; w = 0; } else {
        const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], d5 = dt(ab, cp), d6 = dt(ac, cp);
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); u = 1 - t; v = 0; w = t; } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - t; w = t; } else {
              const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; } } } } } }
  const q = [a[0] * u + b[0] * v + c[0] * w, a[1] * u + b[1] * v + c[1] * w, a[2] * u + b[2] * v + c[2] * w];
  return [(q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2, u, v, w];
}
/** a uniform grid over a mesh's triangles and vertices (cell `h` m) for nearest-point and radius queries */
class Grid {
  cells = new Map<string, number[]>(); vcells = new Map<string, number[]>();
  constructor(public P: Float32Array, public idx: ArrayLike<number>, public h: number) {
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`, f = (x: number) => Math.floor(x / h);
    for (let t = 0; t < idx.length; t += 3) { let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let e = 0; e < 3; e++) for (let k = 0; k < 3; k++) { const x = P[idx[t + e] * 3 + k]; lo[k] = Math.min(lo[k], x); hi[k] = Math.max(hi[k], x); }
      for (let x = f(lo[0]); x <= f(hi[0]); x++) for (let y = f(lo[1]); y <= f(hi[1]); y++) for (let z = f(lo[2]); z <= f(hi[2]); z++) { const k = key(x, y, z); let c = this.cells.get(k); if (!c) this.cells.set(k, c = []); c.push(t / 3); } }
    for (let i = 0; i < P.length / 3; i++) { const k = key(f(P[i * 3]), f(P[i * 3 + 1]), f(P[i * 3 + 2])); let c = this.vcells.get(k); if (!c) this.vcells.set(k, c = []); c.push(i); }
  }
  v(i: number): V3 { return [this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]]; }
  /** nearest point: [triangle, u, v, w, distance] (searching rings of cells outward until the best is closer than the ring) */
  nearest(p: V3): [number, number, number, number, number] {
    const h = this.h, c0 = [Math.floor(p[0] / h), Math.floor(p[1] / h), Math.floor(p[2] / h)]; let best: [number, number, number, number, number] = [-1, 0, 0, 0, Infinity]; const seen = new Set<number>();
    for (let r = 0; r < 64; r++) {
      for (let x = c0[0] - r; x <= c0[0] + r; x++) for (let y = c0[1] - r; y <= c0[1] + r; y++) for (let z = c0[2] - r; z <= c0[2] + r; z++) {
        if (Math.max(Math.abs(x - c0[0]), Math.abs(y - c0[1]), Math.abs(z - c0[2])) !== r) continue; const c = this.cells.get(`${x},${y},${z}`); if (!c) continue;
        for (const t of c) { if (seen.has(t)) continue; seen.add(t); const a = this.idx[t * 3], b = this.idx[t * 3 + 1], cc = this.idx[t * 3 + 2]; const [d2, u, v, w] = closestTri(p, this.v(a), this.v(b), this.v(cc)); if (d2 < best[4]) best = [t, u, v, w, d2]; } }
      if (best[0] >= 0 && Math.sqrt(best[4]) < r * h) break; }
    best[4] = Math.sqrt(best[4]); return best;
  }
  /** vertices within `rad` of p */
  within(p: V3, rad: number): number[] {
    const h = this.h, out: number[] = [], r2 = rad * rad, lo = p.map(x => Math.floor((x - rad) / h)), hi = p.map(x => Math.floor((x + rad) / h));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const c = this.vcells.get(`${x},${y},${z}`); if (!c) continue;
      for (const i of c) { const d2 = (this.P[i * 3] - p[0]) ** 2 + (this.P[i * 3 + 1] - p[1]) ** 2 + (this.P[i * 3 + 2] - p[2]) ** 2; if (d2 <= r2) out.push(i); } }
    return out;
  }
}
const components = (n: number, idx: ArrayLike<number>) => { const par = Int32Array.from({ length: n }, (_, i) => i); const find = (a: number): number => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); par[b] = a; par[find(c)] = a; } return Int32Array.from({ length: n }, (_, i) => find(i)); };
const isOuterOf = (kind: string, g: Geo) => Uint8Array.from({ length: g.n }, (_, i) => (kind === 'upper' || kind === 'legs' || g.ao[i] !== 150 ? 1 : 0));
const vnormals = (P: Float32Array, idx: ArrayLike<number>, n: number) => { const F = drapeFrames(P, idx, n), N = new Float32Array(n * 3); for (let i = 0; i < n; i++) N.set(F.subarray(i * 9, i * 9 + 3), i * 3); return N; };

/** the final (drawn) positions of each piece's level on the group's reference body, for the outer layers' clamp */
const drawn = new Map<string, { P: Float32Array; g: Geo; outer: Uint8Array }>();
// stage 1 first: an outer layer is kept outside what is drawn under it
const order = [...job.sims].sort((a: any, b: any) => (a.stage ?? 1) - (b.stage ?? 1) || a.name.localeCompare(b.name));
for (const S of order) {
  const v = A.byId[S.variant], P = ARGS.pieces[S.piece];
  const F = rd(S.fitted), n = F.length / 3, fidx = readPLY(S.cloth).idx;
  const sb = rd(S.cloth.replace('.ply', '.settled.f32')), pin = rd(S.pin), tgt = rd(S.target);
  for (const q of sb) if (!Number.isFinite(q)) throw new Error(`${S.name}: the solver returned a non-finite position`);
  // the settled cloth (a pinned vertex takes its target exactly, a partly pinned one in proportion: the solver's pins are
  // springs, and a few millimetres of drift at the sleeves' pinned cuffs tore them open in the first render), game axes
  const D = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const w = Math.min(1, Math.max(0, pin[i])), bl = (k: number) => sb[i * 3 + k] * (1 - w) + tgt[i * 3 + k] * w;
    const x = bl(0), y = bl(2), z = -bl(1); D[i * 3] = x - F[i * 3]; D[i * 3 + 1] = y - F[i * 3 + 1]; D[i * 3 + 2] = z - F[i * 3 + 2]; }
  const comp = components(n, fidx), grid = new Grid(F, fidx, 0.04);
  const keys = [...new Set(LODS.map(l => geoKeyOf(S.piece, l)))];
  for (const key of keys) {
    const g = geos[key]; if (!g) continue;
    const base = v.index * O.NV * 4 + O.pieceBase[key] * 4, pos = new Float32Array(g.n * 3); for (let i = 0; i < g.n; i++) for (let e = 0; e < 3; e++) pos[i * 3 + e] = O.source[base + i * 4 + e];
    const outer = isOuterOf(S.kind, g), out = pos.slice();
    // each outer vertex's own spacing: its shortest edge (σ = lowpass × it: a tube's columns, not its rings, bound the folds it carries)
    const el: number[][] = Array.from({ length: g.n }, () => []);
    for (let t = 0; t < g.index.length; t += 3) for (let e = 0; e < 3; e++) { const a = g.index[t + e], b = g.index[t + (e + 1) % 3]; if (!outer[a] || !outer[b]) continue; const d = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]); if (d > 0.004) { el[a].push(d); el[b].push(d); } }
    const lp = ARGS.lowpass ?? 0.5; let lo = 0;
    for (let i = 0; i < g.n; i++) { if (!outer[i]) continue; const p: V3 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const [t, u, vv, ww] = grid.nearest(p), a = fidx[t * 3], b = fidx[t * 3 + 1], c = fidx[t * 3 + 2];
      const q: V3 = [0, 1, 2].map(e => F[a * 3 + e] * u + F[b * 3 + e] * vv + F[c * 3 + e] * ww) as V3;
      const es = el[i].sort((x, y) => x - y), h = es.length ? es[0] : 0.02, sg = Math.max(0.004, lp * h), cm = comp[a];
      let sw = 0; const acc = [0, 0, 0];
      for (const j of grid.within(q, 2.5 * sg)) { if (comp[j] !== cm) continue; const d2 = (F[j * 3] - q[0]) ** 2 + (F[j * 3 + 1] - q[1]) ** 2 + (F[j * 3 + 2] - q[2]) ** 2, w = Math.exp(-d2 / (2 * sg * sg)); sw += w; for (let e = 0; e < 3; e++) acc[e] += D[j * 3 + e] * w; }
      const dq = sw > 0 ? acc.map(x => x / sw) : [0, 1, 2].map(e => D[a * 3 + e] * u + D[b * 3 + e] * vv + D[c * 3 + e] * ww);
      for (let e = 0; e < 3; e++) out[i * 3 + e] = q[e] + dq[e]; lo++; }
    // linings: the nearest outer vertex's move
    for (let i = 0; i < g.n; i++) { if (outer[i]) continue; let best = -1, bd = 1e9;
      for (let k = 0; k < g.n; k++) { if (!outer[k]) continue; const d = (pos[k * 3] - pos[i * 3]) ** 2 + (pos[k * 3 + 1] - pos[i * 3 + 1]) ** 2 + (pos[k * 3 + 2] - pos[i * 3 + 2]) ** 2; if (d < bd) { bd = d; best = k; } }
      if (best >= 0) for (let e = 0; e < 3; e++) out[i * 3 + e] = pos[i * 3 + e] + out[best * 3 + e] - pos[best * 3 + e]; }
    // an outer layer stays `gap` outside the level's drawn pieces under it (their nearest point, along their normal)
    let pushed = 0;
    for (const u of S.over ?? []) { const U = job.sims.find((x: any) => x.name === u), dr = drawn.get(`${geoKeyOf(U.piece, LODS.find(l => geoKeyOf(S.piece, l) === key)!)}|${S.group}`); if (!dr) continue;
      const ui: number[] = []; for (let t = 0; t < dr.g.index.length; t += 3) if (dr.outer[dr.g.index[t]] && dr.outer[dr.g.index[t + 1]] && dr.outer[dr.g.index[t + 2]]) ui.push(dr.g.index[t], dr.g.index[t + 1], dr.g.index[t + 2]);
      const ug = new Grid(dr.P, ui, 0.04), UN = vnormals(dr.P, ui, dr.g.n), gap = P.gap ?? 0.004;
      for (let i = 0; i < g.n; i++) { const p: V3 = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]], [t, a1, b1, c1, d] = ug.nearest(p); if (t < 0 || d > 0.05) continue;
        const ia = ui[t * 3], ib = ui[t * 3 + 1], ic = ui[t * 3 + 2], nq = [0, 1, 2].map(e => UN[ia * 3 + e] * a1 + UN[ib * 3 + e] * b1 + UN[ic * 3 + e] * c1), nl = Math.hypot(nq[0], nq[1], nq[2]) || 1;
        const qq = [0, 1, 2].map(e => dr.P[ia * 3 + e] * a1 + dr.P[ib * 3 + e] * b1 + dr.P[ic * 3 + e] * c1), s = ((p[0] - qq[0]) * nq[0] + (p[1] - qq[1]) * nq[1] + (p[2] - qq[2]) * nq[2]) / nl;
        const need = (outer[i] ? gap : gap * 0.5) - s; if (need > 0 && s > -0.03) { for (let e = 0; e < 3; e++) out[i * 3 + e] += (nq[e] / nl) * need; pushed++; } } }
    drawn.set(`${key}|${S.group}`, { P: out, g, outer });
    // into the local frames of the procedural placement
    const Fr = drapeFrames(pos, g.index, g.n); const d = new Int16Array(g.n * 3); let ss = 0, mx = 0;
    for (let i = 0; i < g.n; i++) { const w = [out[i * 3] - pos[i * 3], out[i * 3 + 1] - pos[i * 3 + 1], out[i * 3 + 2] - pos[i * 3 + 2]]; const m = Math.hypot(w[0], w[1], w[2]); ss += m * m; mx = Math.max(mx, m);
      for (let a = 0; a < 3; a++) { const f = Fr.subarray(i * 9 + a * 3, i * 9 + a * 3 + 3); const c = w[0] * f[0] + w[1] * f[1] + w[2] * f[2]; d[i * 3 + a] = Math.max(-32767, Math.min(32767, Math.round(c / DRAPE_UNIT))); } }
    const rms = Math.sqrt(ss / g.n);
    sets[`${key}|${S.group}`] = { n: g.n, group: S.group, frame: 'shell', d: W.add(d), rms: +rms.toFixed(5), max: +mx.toFixed(5), note: `${S.kind}: settled by Blender's cloth solver on ${S.variant} (${S.outer} vertices, ${S.levels} Loop levels), low-passed to this level` };
    stats[`${key}|${S.group}`] = { rms_mm: +(rms * 1000).toFixed(1), max_mm: +(mx * 1000).toFixed(1), sampled: lo, pushed };
  }
}
const meta: DrapeMeta = { version: 2, groups: ARGS.groups, sets };
writeFileSync(`${outDir}/people_cloth.bin`, W.bytes());
writeFileSync(`${outDir}/people_cloth.json`, JSON.stringify(meta, null, 1) + '\n');
writeFileSync(`${outDir}/post_stats.json`, JSON.stringify(stats, null, 1));
console.log('[people_cloth_post]', Object.keys(sets).length, 'sets', JSON.stringify(stats));
