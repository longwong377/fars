// Town quarter generator (Phase 6, tier C throughout; basis in town_rules.ts). A quarter is an irregular blob of courtyard
// houses packed along a maze of lanes: through streets with jogs, lanes and blind alleys branching off them until no
// ground lies more than `dmax` metres from a lane, a few small squares with wells. Plots are rectangles anchored on a
// lane frontage; leftovers become back yards, store rooms or walled yards. Houses follow the first-millennium Babylonian
// courtyard type (a court with rooms on two to four sides, one street door into a vestibule with a bent axis; B analogue,
// C here). Everything is seeded and deterministic.
import { Rng } from '../../core/rng';
import { Site, Plot, PlotKind, Craft, OUT, LANE, FREE, SQUARE, RES, ROOM, COURT, YARD, shuffle } from './site';
import { HOUSE, capacityFor } from './town_rules';

export interface QuarterOpts {
  mains: number; mainWidth: number; laneWidth: number; alleyWidth: number; dmax: number;
  /** straight streets forced along an axis at a local offset (roads through the quarter) */
  forced?: { axis: 'u' | 'v'; offset: number; width: number }[];
  plotW: [number, number]; plotD: [number, number];
  workshopShare: number; crafts: Craft[];
  squares: number;
  /** reserved rectangles (local metres) kept clear of lanes and plots, filled later by a compound stamp */
  reserve?: [number, number, number, number][];
  /** blob outline: superellipse exponent and radial noise amplitude */
  shape?: { p: number; noise: number };
  row: string; feature: string; idPrefix: string;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** paint a lane of width w along a straight run between cells (i0, j0) → (i1, j1) (axis-aligned) */
function paintRun(s: Site, i0: number, j0: number, i1: number, j1: number, w: number, code = LANE) {
  const lo = -Math.floor(w / 2), hi = lo + w;
  if (j0 === j1) s.paint(Math.min(i0, i1), j0 + lo, Math.max(i0, i1) + 1, j0 + hi, code, c => c === FREE || c === LANE);
  else s.paint(i0 + lo, Math.min(j0, j1), i0 + hi, Math.max(j0, j1) + 1, code, c => c === FREE || c === LANE);
}
/** a run is blocked if its centre line meets a reserved cell */
function runBlocked(s: Site, i0: number, j0: number, i1: number, j1: number) {
  if (j0 === j1) { for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) if (s.at(i, j0) === RES) return true; }
  else for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++) if (s.at(i0, j) === RES) return true;
  return false;
}

export function generateQuarter(s: Site, o: QuarterOpts, rng: Rng) {
  const { W, H } = s;
  // 1. outline: a noisy superellipse (the town edge is house backs, not a straight wall)
  const sp = o.shape ?? { p: 3.2, noise: 0.14 }, ph1 = rng.range(0, 6.28), ph2 = rng.range(0, 6.28);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = s.cu(i) / (W / 2 - 2), y = s.cv(j) / (H / 2 - 2), phi = Math.atan2(y, x);
    const rho = Math.pow(Math.pow(Math.abs(x), sp.p) + Math.pow(Math.abs(y), sp.p), 1 / sp.p);
    const lim = 1 - sp.noise * (0.5 + 0.5 * Math.sin(3 * phi + ph1)) - sp.noise * 0.5 * (0.5 + 0.5 * Math.sin(7 * phi + ph2));
    if (rho > lim) s.cell[s.k(i, j)] = OUT;
  }
  for (const [u0, v0, u1, v1] of o.reserve ?? []) s.paint(s.ci(u0), s.cj(v0), s.ci(u1), s.cj(v1), RES);
  // 2. through streets with jogs, and forced straight streets (roads)
  for (const f of o.forced ?? []) {
    if (f.axis === 'v') { const i = s.ci(f.offset); paintRun(s, i, 0, i, H - 1, f.width); } else { const j = s.cj(f.offset); paintRun(s, 0, j, W - 1, j, f.width); }
  }
  for (let m = 0; m < o.mains; m++) {
    const alongU = m % 2 === 0, len = alongU ? W : H, across = alongU ? H : W;
    let c = Math.round(across / 2 + rng.range(-0.22, 0.22) * across), p = 0;
    while (p < len - 1) {
      const L = rng.int(22, 60), p1 = Math.min(len - 1, p + L);
      if (alongU) { if (!runBlocked(s, p, c, p1, c)) paintRun(s, p, c, p1, c, o.mainWidth); } else if (!runBlocked(s, c, p, c, p1)) paintRun(s, c, p, c, p1, o.mainWidth);
      p = p1;
      if (p < len - 1 && rng.chance(0.6)) { // jog
        const dc = (rng.chance(0.5) ? 1 : -1) * rng.int(2, 6), c1 = Math.max(4, Math.min(across - 5, c + dc));
        if (alongU) paintRun(s, p, c, p, c1, o.mainWidth); else paintRun(s, c, p, c1, p, o.mainWidth);
        c = c1;
      }
    }
  }
  // 3. lanes and blind alleys until every free cell lies within dmax of a lane (several far targets per distance pass)
  const dist = new Int32Array(W * H), src = new Int32Array(W * H), skip = new Uint8Array(W * H), queue = new Int32Array(W * H);
  for (let iter = 0; iter < 200; iter++) {
    dist.fill(-1); let qn = 0; const cell = s.cell;
    for (let k = 0; k < W * H; k++) if (cell[k] === LANE || cell[k] === SQUARE) { dist[k] = 0; src[k] = k; queue[qn++] = k; }
    if (!qn) { paintRun(s, 0, H >> 1, W - 1, H >> 1, o.laneWidth); continue; } // no street at all: seed one
    for (let h = 0; h < qn; h++) { const k = queue[h], i = k % W, d1 = dist[k] + 1, sk = src[k];
      if (i + 1 < W && dist[k + 1] < 0 && cell[k + 1] === FREE) { dist[k + 1] = d1; src[k + 1] = sk; queue[qn++] = k + 1; }
      if (i > 0 && dist[k - 1] < 0 && cell[k - 1] === FREE) { dist[k - 1] = d1; src[k - 1] = sk; queue[qn++] = k - 1; }
      if (k + W < W * H && dist[k + W] < 0 && cell[k + W] === FREE) { dist[k + W] = d1; src[k + W] = sk; queue[qn++] = k + W; }
      if (k >= W && dist[k - W] < 0 && cell[k - W] === FREE) { dist[k - W] = d1; src[k - W] = sk; queue[qn++] = k - W; } }
    // far cells, farthest first; free cells no lane can reach (enclosed by reserved ground) are left for yards
    // bucket by distance (small integers), farthest first, index order within a bucket
    const buckets: number[][] = [];
    for (let k = 0; k < W * H; k++) { const dk = dist[k]; if (dk > o.dmax && cell[k] === FREE && !skip[k]) (buckets[dk] ??= []).push(k); }
    if (!buckets.length) break;
    const far: number[] = []; for (let dd = buckets.length - 1; dd > o.dmax; dd--) if (buckets[dd]) for (const k of buckets[dd]) far.push(k);
    const chosen: number[] = [];
    for (const t of far) { if (chosen.length >= 24) break; const ti = t % W, tj = (t / W) | 0;
      if (chosen.some(c => Math.abs((c % W) - ti) + Math.abs(((c / W) | 0) - tj) < 2 * o.dmax)) continue; chosen.push(t); }
    for (const t of chosen) {
      if (s.cell[t] !== FREE) continue;
      const bd = dist[t], l = src[t], ti = t % W, tj = (t / W) | 0, li = l % W, lj = (l / W) | 0;
      const w = bd > 2 * o.dmax ? o.laneWidth : o.alleyWidth;
      const legs = (uFirst: boolean): [number, number, number, number][] => uFirst ? [[li, lj, ti, lj], [ti, lj, ti, tj]] : [[li, lj, li, tj], [li, tj, ti, tj]];
      const first = rng.chance(0.5); let path = legs(first); if (path.some(r => runBlocked(s, ...r))) path = legs(!first);
      if (path.some(r => runBlocked(s, ...r))) { skip[t] = 1; continue; }
      for (const r of path) if (r[0] !== r[2] || r[1] !== r[3]) paintRun(s, ...r, w);
      // continue beyond the target: up to two random turns; stop on a lane (a loop) or leave a blind alley
      let ci = ti, cj = tj; let dir = path[1][0] !== path[1][2] ? [Math.sign(path[1][2] - path[1][0]), 0] : [0, Math.sign(path[1][3] - path[1][1]) || 1];
      const turns = rng.int(0, 2);
      for (let tn = 0; tn <= turns; tn++) {
        const L = rng.int(4, 18); let ni = ci, nj = cj, hit = false;
        for (let st = 0; st < L; st++) { const xi = ni + dir[0] * (Math.ceil(w / 2) + 1), xj = nj + dir[1] * (Math.ceil(w / 2) + 1); const c = s.at(xi, xj);
          if (c === RES || c === OUT) break; ni += dir[0]; nj += dir[1]; if (c === LANE || c === SQUARE) { hit = true; break; } }
        if (ni !== ci || nj !== cj) paintRun(s, ci, cj, ni, nj, w);
        ci = ni; cj = nj; if (hit || rng.chance(0.35)) break;
        dir = rng.chance(0.5) ? [dir[1], -dir[0]] : [-dir[1], dir[0]];
      }
    }
  }
  // 4. small squares at junctions (wells)
  const lanes: number[] = []; for (let k = 0; k < W * H; k++) if (s.cell[k] === LANE) lanes.push(k);
  shuffle(lanes, rng);
  let nsq = 0;
  for (const k of lanes) { if (nsq >= o.squares) break; const i = k % W, j = (k / W) | 0;
    let a = 0; for (const [di, dj] of DIRS) if (s.at(i + di * 4, j + dj * 4) === LANE) a++;
    if (a < 3 || Math.abs(s.cu(i)) > W * 0.3 || Math.abs(s.cv(j)) > H * 0.3) continue;
    const r = rng.int(3, 5); let clash = false; for (let jj = j - r - 3; jj <= j + r + 3; jj++) for (let ii = i - r - 3; ii <= i + r + 3; ii++) if (s.at(ii, jj) === SQUARE || s.at(ii, jj) === RES) clash = true;
    if (clash) continue;
    s.paint(i - r, j - r, i + r + 1, j + r + 1, SQUARE, c => c === FREE || c === LANE);
    s.fittings.push({ kind: 'well', u: s.cu(i), v: s.cv(j), rot: 0, size: 1, plot: -1, note: 'well in a small square (C; wells and river canals only, no qanats: Q-052)' }); nsq++;
  }
  // 5. slivers of free ground too small for a house become open ground
  cleanupSlivers(s, 30);
  // 6. plots along the lane frontages; a second pass with smaller plots fills the gaps the first one left
  packPlots(s, o, rng, o.plotW, o.plotD, HOUSE.minArea);
  packPlots(s, o, rng, [6, 11], [6, 14], 36);
  assignWorkshops(s, o, rng);
  // 7. leftovers: back yards, store rooms, walled yards
  absorbLeftovers(s, o, rng);
  // 7b. animal pens hugging the town edge (C): walled enclosures on the open ground against the house backs, their
  // gates facing the plain; stockyard flocks and donkeys (PF 58-60, PFAT 0025) had to be kept somewhere
  stampPens(s, o, rng);
  // 8. house plans, doors, fittings
  const extras = new Map<number, number[]>();
  for (let k = 0; k < s.cell.length; k++) { const c = s.cell[k]; if (c < 0) continue; const p = s.plots[c], i = k % s.W, j = (k / s.W) | 0;
    if (i < p.rect[0] || i >= p.rect[2] || j < p.rect[1] || j >= p.rect[3]) { if (!extras.has(c)) extras.set(c, []); extras.get(c)!.push(k); } }
  for (const p of s.plots) layoutPlot(s, p, rng, extras);
  s.recount();
  for (const p of s.plots) p.capacity = capacityFor(p);
  fixDoors(s);
}

function cleanupSlivers(s: Site, minArea: number) {
  const { W, H } = s, seen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) { if (seen[k0] || s.cell[k0] !== FREE) continue;
    const comp = [k0]; seen[k0] = 1;
    for (let h = 0; h < comp.length; h++) { const k = comp[h], i = k % W, j = (k / W) | 0;
      for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj); if (!seen[kk] && s.cell[kk] === FREE) { seen[kk] = 1; comp.push(kk); } } }
    if (comp.length < minArea) for (const k of comp) s.cell[k] = LANE;
  }
}

function packPlots(s: Site, o: QuarterOpts, rng: Rng, plotW: [number, number], plotD: [number, number], minArea: number) {
  const { W, H } = s;
  const front: { k: number; d: [number, number] }[] = [];
  for (let k = 0; k < W * H; k++) { if (s.cell[k] !== FREE) continue; const i = k % W, j = (k / W) | 0;
    const ds = DIRS.filter(([di, dj]) => { const c = s.at(i + di, j + dj); return c === LANE || c === SQUARE; });
    if (ds.length) front.push({ k, d: rng.pick(ds) }); }
  // scan order with local jitter: plots pack along each frontage, not at random spots
  front.sort((a, b) => a.k - b.k);
  for (const f of front) {
    if (s.cell[f.k] !== FREE) continue;
    const i = f.k % W, j = (f.k / W) | 0, n: [number, number] = [-f.d[0], -f.d[1]];
    const wT = rng.int(plotW[0], plotW[1]), dT = rng.int(plotD[0], plotD[1]);
    let best: { a0: number; a1: number; d: number; t: [number, number] } | null = null;
    for (const sg of rng.chance(0.5) ? [1, -1] : [-1, 1]) {
      const t: [number, number] = [n[1] * sg, -n[0] * sg];
      const free = (a: number, b: number) => s.at(i + a * t[0] + b * n[0], j + a * t[1] + b * n[1]) === FREE;
      let a1 = 0; while (a1 < wT && free(a1, 0)) a1++;
      let a0 = 0; while (a1 - a0 < wT && free(a0 - 1, 0)) a0--;
      let d = 0; while (d < dT) { let ok = true; for (let a = a0; a < a1; a++) if (!free(a, d)) { ok = false; break; } if (!ok) break; d++; }
      if (a1 - a0 >= HOUSE.minSide && d >= HOUSE.minSide && (a1 - a0) * d >= minArea && (!best || (a1 - a0) * d > (best.a1 - best.a0) * best.d)) best = { a0, a1, d, t };
    }
    if (!best) continue;
    const { a0, a1, d, t } = best, w = a1 - a0;
    const oi = i + a0 * t[0], oj = j + a0 * t[1];
    const cs: number[] = []; for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) cs.push(s.k(oi + a * t[0] + b * n[0], oj + a * t[1] + b * n[1]));
    const xs = cs.map(k => k % W), ys = cs.map(k => (k / W) | 0);
    const area = w * d;
    const kind: PlotKind = area >= HOUSE.largeArea ? 'house_large' : 'house';
    const p = s.addPlot({ id: `${o.idPrefix}-${String(s.plots.length + 1).padStart(4, '0')}`, kind, rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1], o: [oi, oj], t, n, w, d,
      door: null, court: true, height: rng.range(HOUSE.roofTop[0], HOUSE.roofTop[1]) + (kind === 'house_large' ? 0.4 : 0), parapet: HOUSE.parapet, yardWall: HOUSE.yardWall, outerT: HOUSE.outerT,
      row: o.row, feature: o.feature, note: '' });
    for (const k of cs) s.cell[k] = p.idx;
  }
}
function assignWorkshops(s: Site, o: QuarterOpts, rng: Rng) {
  // workshops: a share of the plots, spread through the quarter
  const cand = s.plots.filter(p => p.w >= 8 && p.d >= 8); shuffle(cand, rng);
  const nW = Math.round(s.plots.length * o.workshopShare);
  for (let x = 0; x < Math.min(nW, cand.length); x++) { cand[x].kind = 'workshop'; cand[x].craft = o.crafts[x % o.crafts.length]; cand[x].row = 'town_workshops'; }
}

/** leftover free cells: each connected piece goes whole to the neighbouring plot with the longest shared edge (straight
 *  party walls, no staircases), or becomes a walled yard of its own if it is large and fronts a lane */
function absorbLeftovers(s: Site, o: QuarterOpts, rng: Rng) {
  const { W, H } = s, seen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) { if (seen[k0] || s.cell[k0] !== FREE) continue;
    const comp = [k0]; seen[k0] = 1;
    for (let h = 0; h < comp.length; h++) { const k = comp[h], i = k % W, j = (k / W) | 0;
      for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj); if (!seen[kk] && s.cell[kk] === FREE) { seen[kk] = 1; comp.push(kk); } } }
    const shared = new Map<number, number>(); let lane = 0, out = 0;
    for (const k of comp) { const i = k % W, j = (k / W) | 0; for (const [di, dj] of DIRS) { const c = s.at(i + di, j + dj); if (c >= 0) shared.set(c, (shared.get(c) ?? 0) + 1); else if (c === LANE || c === SQUARE) lane++; else if (c === OUT) out++; } }
    // ground left at the town's edge stays open plain: the edge is house backs, not a staircase of walled scraps
    if (out > 0) { for (const k of comp) s.cell[k] = OUT; continue; }
    if (comp.length >= 140 && lane >= 4) { // a walled yard (garden, pen or orchard plot) of its own
      const xs = comp.map(k => k % W), ys = comp.map(k => (k / W) | 0);
      const p = s.addPlot({ id: `${o.idPrefix}-${String(s.plots.length + 1).padStart(4, '0')}`, kind: 'yard', rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1],
        o: [Math.min(...xs), Math.min(...ys)], t: [1, 0], n: [0, 1], w: Math.max(...xs) - Math.min(...xs) + 1, d: Math.max(...ys) - Math.min(...ys) + 1,
        door: null, court: false, height: 0, parapet: 0, yardWall: rng.chance(0.4) ? HOUSE.penWall : HOUSE.yardWall, outerT: 0.5, row: 'town_yards', feature: o.feature, note: '' });
      for (const k of comp) { s.cell[k] = p.idx; s.sub[k] = YARD; }
      continue;
    }
    if (!shared.size) { for (const k of comp) s.cell[k] = LANE; continue; }
    const owner = [...shared.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const roofed = comp.length <= 24;
    const rid = roofed ? s.newRoom() : -1;
    for (const k of comp) { s.cell[k] = owner; s.sub[k] = roofed ? ROOM : YARD; s.room[k] = rid; }
  }
}

function stampPens(s: Site, o: QuarterOpts, rng: Rng) {
  const { W, H } = s, want = Math.max(2, Math.round(W * H / 14000)); let made = 0;
  const forced = (o.forced ?? []).map(f => f.axis === 'v' ? { axis: 'v', c: s.ci(f.offset), w: f.width } : { axis: 'u', c: s.cj(f.offset), w: f.width });
  for (let tries = 0; tries < 4000 && made < want; tries++) {
    const pw = rng.int(9, 14), pd = rng.int(8, 12), i0 = rng.int(1, W - pw - 1), j0 = rng.int(1, H - pd - 1);
    if (forced.some(f => f.axis === 'v' ? (i0 + pw > f.c - f.w - 6 && i0 < f.c + f.w + 6) : (j0 + pd > f.c - f.w - 6 && j0 < f.c + f.w + 6))) continue;
    let ok = true, touch = 0, lane = 0;
    for (let j = j0 - 1; j <= j0 + pd && ok; j++) for (let i = i0 - 1; i <= i0 + pw; i++) { const inside = i >= i0 && i < i0 + pw && j >= j0 && j < j0 + pd, c = s.at(i, j);
      if (inside) { if (c !== OUT) { ok = false; break; } } else if (c >= 0) touch++; else if (c === LANE || c === SQUARE) lane++; }
    if (!ok || touch < 6 || lane > 0) continue;
    // keep 4 m from the next pen
    let near = false; for (let j = j0 - 4; j < j0 + pd + 4 && !near; j++) for (let i = i0 - 4; i < i0 + pw + 4; i++) { const c = s.at(i, j); if (c >= 0 && s.plots[c].kind === 'pen') { near = true; break; } }
    if (near) continue;
    const p = s.addPlot({ id: `${o.idPrefix}-${String(s.plots.length + 1).padStart(4, '0')}`, kind: 'pen', rect: [i0, j0, i0 + pw, j0 + pd], o: [i0, j0], t: [1, 0], n: [0, 1], w: pw, d: pd,
      door: null, court: false, height: 0, parapet: 0, yardWall: HOUSE.penWall, outerT: 0.45, row: 'town_pens', feature: o.feature, note: 'animal pen at the town edge (C)' });
    for (let j = j0; j < j0 + pd; j++) for (let i = i0; i < i0 + pw; i++) { const k = s.k(i, j); s.cell[k] = p.idx; s.sub[k] = YARD; }
    // gate: the middle of a side that faces open ground
    const sides: [number, number, number, number][] = [[i0 + (pw >> 1), j0 - 1, i0 + (pw >> 1), j0], [i0 + (pw >> 1), j0 + pd, i0 + (pw >> 1), j0 + pd - 1], [i0 - 1, j0 + (pd >> 1), i0, j0 + (pd >> 1)], [i0 + pw, j0 + (pd >> 1), i0 + pw - 1, j0 + (pd >> 1)]];
    for (const [oi, oj, ii, jj] of shuffle(sides, rng)) { if (s.at(oi, oj) !== OUT || !s.inb(oi, oj)) continue; const k = s.k(ii, jj), ko = s.k(oi, oj); p.door = { cell: k, out: ko }; s.doors.add(s.edgeBetween(k, ko)); break; }
    s.fittings.push({ kind: 'pen_dung', u: s.cu(i0) + pw / 2 - 0.5, v: s.cv(j0) + pd / 2 - 0.5, rot: 0, size: Math.min(pw, pd) * 0.4, plot: p.idx, note: 'dung trodden into the pen floor (C)' });
    s.fittings.push({ kind: 'trough', u: s.cu(i0) + 1.5, v: s.cv(j0) + 1.2, rot: 0, size: 1, plot: p.idx });
    made++;
  }
}

/** rooms, court and doors inside a plot's main rectangle; extra (absorbed) cells keep the class set above */
function layoutPlot(s: Site, p: Plot, rng: Rng, extras: Map<number, number[]>) {
  if (p.kind === 'pen') return; // stamped whole by stampPens
  if (p.kind === 'yard') { layoutYard(s, p, rng); return; }
  const { w, d } = p, cells = (a: number, b: number) => s.ab(p, a, b);
  const R = () => rng.int(HOUSE.roomDepth[0], HOUSE.roomDepth[1]);
  const shop = p.kind === 'workshop';
  // sides with rooms (front always: the vestibule suite on the street)
  let rf = Math.min(R(), d - 3), rb = d >= 10 ? R() : 0, rl = w >= 10 && rng.chance(0.75) ? R() : 0, rr = w >= 13 && rng.chance(shop ? 0.3 : 0.7) ? R() : 0;
  if (shop) { rb = d >= 14 && rng.chance(0.4) ? R() : 0; }
  const fit = () => w - rl - rr >= 3 && d - rf - rb >= 3;
  while (!fit()) { if (rr) rr = 0; else if (rb) rb = 0; else if (rl) rl = 0; else { rf = Math.max(2, rf - 1); if (rf === 2 && !fit()) break; } }
  const court = (a: number, b: number) => a >= rl && a < w - rr && b >= rf && b < d - rb;
  for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) { const k = cells(a, b); s.sub[k] = court(a, b) ? (shop ? YARD : COURT) : ROOM; }
  // rooms: split each strip into lengths of 3-5 m
  const strip = (cellsOf: (x: number) => number[], len: number, lo: number, hi: number) => {
    let x = lo; while (x < hi) { let L = rng.int(HOUSE.roomLen[0], HOUSE.roomLen[1]); if (hi - (x + L) < HOUSE.roomLen[0]) L = hi - x; const rid = s.newRoom(); for (let y = x; y < x + L; y++) for (const k of cellsOf(y)) s.room[k] = rid; x += L; } void len;
  };
  const col = (a: number, b0: number, b1: number) => { const r: number[] = []; for (let b = b0; b < b1; b++) r.push(cells(a, b)); return r; };
  const row = (b: number, a0: number, a1: number) => { const r: number[] = []; for (let a = a0; a < a1; a++) r.push(cells(a, b)); return r; };
  // front and back strips span the full width, but their end rooms must reach the court: the first cut lies past rl, the last before w - rr
  const stripFB = (b0: number, b1: number) => {
    if (b1 <= b0) return;
    const cuts: number[] = [0]; let x = Math.max(rl + 1, Math.min(w, rng.int(HOUSE.roomLen[0], HOUSE.roomLen[1])));
    while (x < w - Math.max(rr + 1, HOUSE.roomLen[0] - 1)) { cuts.push(x); x += rng.int(HOUSE.roomLen[0], HOUSE.roomLen[1]); }
    cuts.push(w);
    for (let c = 0; c + 1 < cuts.length; c++) { const rid = s.newRoom(); for (let a = cuts[c]; a < cuts[c + 1]; a++) for (let b = b0; b < b1; b++) s.room[cells(a, b)] = rid; }
  };
  stripFB(0, rf); stripFB(d - rb, d);
  if (rl) strip(bb => row(bb, 0, rl), 0, rf, d - rb); // side strips run along b
  if (rr) strip(bb => row(bb, w - rr, w), 0, rf, d - rb);
  void col;
  // street door on the front row: near one end (vestibule), onto a lane cell
  const frontCells: { a: number; k: number; out: number }[] = [];
  for (let a = 0; a < w; a++) { const k = cells(a, 0), i = k % s.W, j = (k / s.W) | 0, oi = i - p.n[0], oj = j - p.n[1]; const c = s.at(oi, oj);
    if (Site.open(c) && s.inb(oi, oj)) frontCells.push({ a, k, out: s.k(oi, oj) }); }
  if (frontCells.length) {
    const pref = frontCells.filter(f => f.a >= 1 && f.a <= w - 2); const pool = pref.length ? pref : frontCells;
    const f = rng.chance(0.5) ? pool[Math.min(pool.length - 1, rng.int(0, 1))] : pool[Math.max(0, pool.length - 1 - rng.int(0, 1))];
    p.door = { cell: f.k, out: f.out }; s.doors.add(s.edgeBetween(f.k, f.out));
    // bent axis: the vestibule's door into the court is offset from the street door (>= 2 m)
    if (rf > 0 && s.sub[f.k] === ROOM) {
      const vid = s.room[f.k]; const opts: number[] = [];
      for (let a = 0; a < w; a++) { const k = cells(a, rf - 1); if (s.room[k] !== vid) continue; if (Math.abs(a - f.a) >= 2) opts.push(a); }
      const aa = opts.length ? rng.pick(opts) : f.a; s.doors.add(s.edgeBetween(cells(aa, rf - 1), cells(aa, rf)));
    }
  }
  // each room: a door into the court (or yard); rooms that touch no court get a door into a neighbouring room
  const rooms = new Map<number, number[]>();
  for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) { const k = cells(a, b); if (s.sub[k] === ROOM) { const r = s.room[k]; if (!rooms.has(r)) rooms.set(r, []); rooms.get(r)!.push(k); } }
  for (const [rid, ks] of rooms) {
    if (p.door && s.room[p.door.cell] === rid && rf > 0) continue; // the vestibule has its court door already
    const courtEdges: [number, number][] = [], roomEdges: [number, number][] = [];
    for (const k of ks) { const i = k % s.W, j = (k / s.W) | 0; for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj);
      if (s.cell[kk] !== p.idx) continue; if (s.sub[kk] === COURT || s.sub[kk] === YARD) courtEdges.push([k, kk]); else if (s.sub[kk] === ROOM && s.room[kk] !== rid) roomEdges.push([k, kk]); } }
    const pick = courtEdges.length ? courtEdges[Math.floor(courtEdges.length / 2)] : roomEdges.length ? roomEdges[Math.floor(roomEdges.length / 2)] : null;
    if (pick) s.doors.add(s.edgeBetween(pick[0], pick[1]));
  }
  // absorbed extra cells: store rooms need a door; yards need a door from the house
  linkExtras(s, p, extras.get(p.idx) ?? []);
  fittingsFor(s, p, rng, rf, rb, rl, rr);
}

function linkExtras(s: Site, p: Plot, extra: number[]) {
  const [i0, j0, i1, j1] = p.rect; const seen = new Set<number>();
  for (const k of extra) {
    const i = k % s.W, j = (k / s.W) | 0;
    const key = s.sub[k] === ROOM ? s.room[k] : -2 - k; if (seen.has(key) && s.sub[k] === ROOM) continue;
    // find an edge to a main-rect cell of the plot and open it (yards only into a court or a room)
    for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!(ii >= i0 && ii < i1 && jj >= j0 && jj < j1)) continue; const kk = s.k(ii, jj); if (s.cell[kk] !== p.idx) continue;
      if (s.sub[k] === YARD && s.sub[kk] !== ROOM && s.sub[kk] !== COURT) continue;
      if (!seen.has(key)) { s.doors.add(s.edgeBetween(k, kk)); seen.add(key); } break; }
  }
}

function layoutYard(s: Site, p: Plot, rng: Rng) {
  // door onto the lane: first yard cell with a lane neighbour
  const [i0, j0, i1, j1] = p.rect; const opts: [number, number][] = [];
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = s.k(i, j); if (s.cell[k] !== p.idx) continue;
    for (const [di, dj] of DIRS) { const c = s.at(i + di, j + dj); if ((c === LANE || c === SQUARE) && s.inb(i + di, j + dj)) opts.push([k, s.k(i + di, j + dj)]); } }
  if (opts.length) { const [k, out] = opts[Math.floor(opts.length / 2)]; p.door = { cell: k, out }; s.doors.add(s.edgeBetween(k, out)); }
  // pens (low walls, dung) or garden plots (trees)
  const cells: number[] = []; for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (s.cell[s.k(i, j)] === p.idx) cells.push(s.k(i, j));
  const pen = p.yardWall < HOUSE.yardWall;
  p.kind = pen ? 'pen' : 'yard'; p.row = pen ? 'town_pens' : 'town_yards';
  if (pen) { const c = cells[Math.floor(cells.length / 2)]; s.fittings.push({ kind: 'pen_dung', u: s.cu(c % s.W), v: s.cv((c / s.W) | 0), rot: 0, size: Math.sqrt(cells.length) * 0.45, plot: p.idx }); s.fittings.push({ kind: 'trough', u: s.cu(c % s.W) + 1, v: s.cv((c / s.W) | 0), rot: 0, size: 1, plot: p.idx }); }
  else for (const c of cells) { const i = c % s.W, j = (c / s.W) | 0; if (i % 5 === 2 && j % 5 === 2 && rng.chance(0.7)) s.fittings.push({ kind: 'tree', u: s.cu(i), v: s.cv(j), rot: rng.range(0, 6.28), size: rng.range(0.8, 1.15), plot: p.idx, species: rng.pick(['pomegranate', 'fig', 'apple', 'pear', 'mulberry', 'olive']) }); }
}

function fittingsFor(s: Site, p: Plot, rng: Rng, rf: number, rb: number, rl: number, rr: number) {
  const cw = p.w - rl - rr, cd = p.d - rf - rb; if (cw < 3 || cd < 3) return;
  const pt = (a: number, b: number) => s.abPoint(p, a, b);
  const rot = Math.atan2(p.n[1], p.n[0]);
  const F = (kind: Site['fittings'][0]['kind'], a: number, b: number, size = 1, note?: string, extra: object = {}) => { const [u, v] = pt(a, b); s.fittings.push({ kind, u, v, rot, size, plot: p.idx, note, ...extra }); };
  // court corners and wall-side spots (a, b in cell units from the plot frame corner)
  const A0 = rl + 0.9, A1 = p.w - rr - 0.9, B0 = rf + 0.9, B1 = p.d - rb - 0.9;
  if (p.kind === 'workshop') {
    switch (p.craft) {
      case 'metal': F('forge', A0 + 0.4, B1 - 0.4, 1, 'smithy hearth (treasury metal workshop: PT craftsmen incl. goldsmiths, B existence; place and form C)'); F('anvil', A0 + 1.6, B1 - 1.2); break;
      case 'wood': F('timber', (A0 + A1) / 2, B1 - 0.3, 1, 'timber stack (treasury wood/carpentry handlers, HENK2023 B; place C)', { len: Math.min(5, cw - 1.5) }); F('bench', A0 + 0.5, (B0 + B1) / 2); break;
      case 'textile': for (let x = 0; x < Math.min(3, Math.floor(cw / 2.2)); x++) F('loom', A0 + 0.6 + x * 2.2, B1 - 0.5, 1, 'ground loom (textile handlers probable, HENK2023; form C)'); break;
      case 'bakery': for (let x = 0; x < Math.min(3, Math.floor(cw / 1.8)); x++) F('oven', A0 + 0.4 + x * 1.8, B1 - 0.2, 1, 'bread oven (tannur, C)'); for (let x = 0; x < 3; x++) F('quern', A0 + 0.5 + x * 1.2, B0 + 0.3, 1, 'saddle quern (grinding: PF flour, B; form C)'); break;
      case 'brewery': for (let x = 0; x < Math.min(4, Math.floor(cw / 1.4)); x++) F('vat', A0 + 0.4 + x * 1.4, B1 - 0.2, 1, 'brewing vat (PF 40 "He made beer", A Darius-era; form C)'); F('hearth', A1 - 0.4, B0 + 0.4); break;
      case 'pottery': F('kiln', A1 - 1.0, B1 - 1.0, 1, 'updraft pottery kiln (form C)'); F('jar', A0, B0, 1); F('jar', A0 + 0.7, B0, 0.9); break;
      default: F('hearth', A0 + 0.4, B1 - 0.4);
    }
    // a game left in the yard (C)
    if (rng.chance(0.25)) F('knucklebones', (A0 + A1) / 2 + rng.range(-1, 1), B0 + 0.6, 1, 'knucklebones (astragali) left in the yard: a game known across the period (RECOLLECTION, NOT SEEN; C)');
    return;
  }
  const home = rng.chance(HOUSE.hearthShare);
  if (home) F('hearth', rng.chance(0.5) ? A0 + 0.3 : A1 - 0.3, rng.chance(0.5) ? B0 + 0.3 : B1 - 0.3, 1, 'courtyard hearth (C)');
  if (rng.chance(HOUSE.ovenShare)) F('oven', A1 - 0.1, B1 - 0.1, 1, 'bread oven (tannur, C)');
  const nj = rng.int(1, 3); for (let x = 0; x < nj; x++) F('jar', A0 + x * 0.55, B1 + 0.2, rng.range(0.8, 1.1), 'storage jar (ration grain, wine: PF units, B; form C)');
  if (cw >= 5 && cd >= 5 && rng.chance(HOUSE.courtTreeShare)) F('tree', (A0 + A1) / 2, (B0 + B1) / 2, rng.range(0.6, 0.9), 'courtyard tree (C)', { species: rng.pick(['pomegranate', 'fig', 'mulberry']) });
}

/** doors that open onto open ground not connected to the quarter's exits are moved (or the plot loses its capacity) */
function fixDoors(s: Site) {
  const lab = s.openComponents(), ex = s.exitComponents(lab);
  for (const p of s.plots) {
    if (p.door && ex.has(lab[p.door.out])) continue;
    // try any perimeter edge of the plot onto an exit-connected cell (rooms, courts or yards)
    let found: [number, number] | null = null;
    for (let k = 0; k < s.cell.length && !found; k++) { if (s.cell[k] !== p.idx) continue; const i = k % s.W, j = (k / s.W) | 0;
      for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj); if (Site.open(s.cell[kk]) && ex.has(lab[kk])) { found = [k, kk]; break; } } }
    if (p.door) s.doors.delete(s.edgeBetween(p.door.cell, p.door.out));
    if (found) { p.door = { cell: found[0], out: found[1] }; s.doors.add(s.edgeBetween(found[0], found[1])); }
    else { p.door = null; p.capacity = 0; }
  }
}
export { OUT, LANE, FREE, SQUARE, RES, ROOM, COURT, YARD };
