// D-249: every house a body can walk into. After the plan's doors are settled (Site.connectPlots, Site.settleDoors), the
// cells a body can reach from the site's edge are measured with the routes' own rules (walk.ts siteReach: the walls as
// built, 0.4-0.7 m thick, and the fittings' colliders; a cell's and a crossed edge's room >= BODY_MIN). A place of a plot
// (a room, its court, its yard) that no body reaches although the raster joins it (a lane pocket behind a gap narrower
// than a body, two walls offset across a one-cell passage, a door narrowed at both jambs) gets a door on a wall between it
// and a reached cell: a place of the same plot first, else the lane (the plot's street door then moves there when its own
// lane is out of reach). The new door's opening must stay clear (>= 0.8 m) with no fitting in its way. Deterministic,
// no random draw. Pure data; the plan (plan.ts) calls it before the houses' fixtures are placed.
import { Site, ROOM, type P2 } from './site';
import { siteReach, cellHasRoom, resetSiteCaches, openCode, BODY_MIN } from './walk';

export function ensureAccess(s: Site, min = 0.8): { opened: number; resited: number; left: number } {
  if (s.meta.kind !== 'quarter') return { opened: 0, resited: 0, left: 0 }; // (the walled compounds: every place reached, reach_census.ts)
  const N = s.W * s.H, W = s.W; let opened = 0, resited = 0, left = 0;
  const cellsOf = (e: number): [number, number] => e < N ? [e, e + W] : [e - N, e - N + 1];
  const fits = s.fittings.filter(f => f.kind !== 'tree' && f.kind !== 'channel' && f.kind !== 'ditch' && f.kind !== 'pool' && f.kind !== 'midden' && f.kind !== 'pen_dung');
  const inWay = (e: number) => { const [a, b] = cellsOf(e), p: P2 = [s.cu(a % W), s.cv((a / W) | 0)], q: P2 = [s.cu(b % W), s.cv((b / W) | 0)];
    return fits.some(f => { const t = Math.max(0, Math.min(1, (f.u - p[0]) * (q[0] - p[0]) + (f.v - p[1]) * (q[1] - p[1]))); return Math.hypot(f.u - p[0] - t * (q[0] - p[0]), f.v - p[1] - t * (q[1] - p[1])) < 0.65; }); };
  const byPlot = new Map<number, number[]>(); for (let k = 0; k < N; k++) { const c = s.cell[k]; if (c >= 0) (byPlot.get(c) ?? byPlot.set(c, []).get(c)!).push(k); }
  const region = (k: number) => s.sub[k] === ROOM ? -1 - s.room[k] : s.sub[k];
  for (let round = 0; round < 3; round++) {
    resetSiteCaches(s); const r = siteReach(s); let changed = false; left = 0;
    for (const p of s.plots) {
      if (!p.door || p.kind === 'garden') continue; const cells = byPlot.get(p.idx); if (!cells) continue;
      const shut = new Map<number, number[]>();
      for (const k of cells) if (!r[k] && cellHasRoom(s, k, BODY_MIN)) { const g = region(k); (shut.get(g) ?? shut.set(g, []).get(g)!).push(k); }
      for (const [, ks] of [...shut].sort((a, b) => a[0] - b[0])) {
        let best: { e: number; k: number; kk: number; score: number } | null = null;
        for (const k of ks) { const i = k % W, j = (k / W) | 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!s.inb(i + di, j + dj)) continue; const kk = s.k(i + di, j + dj); if (!r[kk]) continue;
            const c = s.cell[kk]; if (c !== p.idx && !openCode(c)) continue;
            const e = s.edgeBetween(k, kk); if (s.doors.has(e) || s.noWall.has(e) || !s.edgeWall(k, kk)) continue;
            s.doors.add(e); const cl = s.doorClear(e); s.doors.delete(e); if (cl < min || inWay(e)) continue;
            const score = c === p.idx ? 0 : 1;
            if (!best || score < best.score || (score === best.score && e < best.e)) best = { e, k, kk, score }; } }
        if (!best) { left += ks.length; continue; }
        s.doors.add(best.e); opened++; changed = true;
        if (best.score === 1 && !r[p.door.out]) { p.door = { cell: best.k, out: best.kk }; resited++; }
      }
    }
    if (!changed) break;
  }
  // (s17 C1, D-550, B580) a house still shut in at a pinched frontage (each of its lane edges narrowed at both jambs by the
  // neighbours' wall ends: C9's walk bots) gets a door on a lane edge whose crossing walls stop short of the door's line
  // (Site.jambs), kept only when the house is then reached; the street door moves there. Both houses' plans otherwise intact
  if (left) { resetSiteCaches(s); let r = siteReach(s);
    for (const p of s.plots) { if (!p.door || p.kind === 'garden') continue; const cells = byPlot.get(p.idx); if (!cells || cells.some(k => r[k]) || !cells.some(k => cellHasRoom(s, k, BODY_MIN))) continue;
      let done = false;
      for (const k of cells) { if (done) break; const i = k % W, j = (k / W) | 0;
        for (const di of [1, -1]) { if (!s.inb(i + di, j)) continue; const kk = s.k(i + di, j); if (!openCode(s.cell[kk]) || !r[kk]) continue; // (doors in walls along v: the only ones the crossing walls narrow)
          const e = s.edgeBetween(k, kk); if (s.noWall.has(e) || inWay(e)) continue; const vi = di > 0 ? i + 1 : i, J = [j * (W + 1) + vi, (j + 1) * (W + 1) + vi];
          const had = s.doors.has(e), hadJ = J.map(x => s.jambs.has(x)); s.doors.add(e); for (const x of J) s.jambs.add(x); resetSiteCaches(s); const r2 = siteReach(s);
          if (r2[k] && s.doorClear(e) >= min) { p.door = { cell: k, out: kk }; r = r2; opened++; resited++; left -= cells.length; done = true; break; }
          if (!had) s.doors.delete(e); J.forEach((x, q) => { if (!hadJ[q]) s.jambs.delete(x); }); } }
      resetSiteCaches(s); } }
  resetSiteCaches(s);
  return { opened, resited, left };
}
