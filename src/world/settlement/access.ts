// D-249: every house a body can walk into. After the plan's doors are settled (Site.connectPlots, Site.settleDoors), the
// cells a body can reach from the site's edge are measured with the routes' own rules (walk.ts siteReach: the walls as
// built, 0.4-0.7 m thick, and the fittings' colliders; a cell's and a crossed edge's room >= BODY_MIN). A place of a plot
// (a room, its court, its yard) that no body reaches although the raster joins it (a lane pocket behind a gap narrower
// than a body, two walls offset across a one-cell passage, a door narrowed at both jambs) gets a door on a wall between it
// and a reached cell: a place of the same plot first, else the lane (the plot's street door then moves there when its own
// lane is out of reach). The new door's opening must stay clear (>= 0.8 m) with no fitting in its way. Deterministic,
// no random draw. Pure data; the plan (plan.ts) calls it before the houses' fixtures are placed.
import { Site, ROOM, LANE, type P2 } from './site';
import { siteReach, cellHasRoom, resetSiteCaches, openCode, BODY_MIN } from './walk';

/** s18 C2 (D-660): the clear width a door through a cut-back corner may keep (m): a narrow door, wider than a body turned
 *  sideways and the player's capsule (0.56 m; a poor house's door: C) */
const NARROW_DOOR = 0.6;
export function ensureAccess(s: Site, min = 0.8): { opened: number; resited: number; left: number } {
  if (s.meta.kind !== 'quarter') return { opened: 0, resited: 0, left: 0 }; // (the walled compounds: every place reached, reach_census.ts)
  const N = s.W * s.H, W = s.W; let opened = 0, resited = 0, left = 0, cut = 0, widened = 0;
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
          // (the lead's call: the player must walk in) still pinched by a third house's wall end across the lane corner: that
          // house's corner cell is cut back to the lane (a cut-back corner, common in the region's mud-brick lanes: C), kept
          // only when this house is then reached and the other keeps every place it had reached
          { const cand: number[] = []; for (let b2 = -1; b2 <= 1; b2++) for (let a2 = -1; a2 <= 1; a2++) { const ni = (kk % W) + a2, nj = ((kk / W) | 0) + b2; if (!s.inb(ni, nj)) continue; const n = s.k(ni, nj), q = s.cell[n];
              if (q < 0 || n === k) continue; const Q = s.plots[q]; if (!Q || (q !== p.idx && Q.door && (Q.door.cell === n || Q.door.out === n)) || (byPlot.get(q)?.length ?? 0) <= 8) continue; cand.push(n); } // (this house's own corner too)
            const sets: number[][] = [...cand.map(n => [n]), ...cand.flatMap((n, x) => cand.slice(x + 1).map(m => [n, m]))];
            for (const set of sets) { const saved = set.map(n => [n, s.cell[n], s.sub[n], s.room[n]] as const), qs = [...new Set(set.map(n => s.cell[n]))];
              const before = qs.map(q => (byPlot.get(q) ?? []).filter(x => !set.includes(x) && r2[x]).length);
              for (const n of set) { s.cell[n] = LANE; s.sub[n] = 0; s.room[n] = -1; } resetSiteCaches(s); const r3 = siteReach(s);
              if (r3[k] && s.doorClear(e) >= min && qs.every((q, x) => q === p.idx || (byPlot.get(q) ?? []).filter(y => !set.includes(y) && r3[y]).length >= before[x])) {
                for (const q of qs) byPlot.set(q, (byPlot.get(q) ?? []).filter(x => !set.includes(x))); p.door = { cell: k, out: kk }; r = r3; opened++; resited++; left -= cells.length; done = true; cut += set.length; break; }
              // (the lead's last try) the house's own corner cut back: its street door through the cut corner, from a cell of the
              // house beside a cut cell (a door in a wall along u first: nothing narrows it)
              if (qs.every((q, x) => q === p.idx || (byPlot.get(q) ?? []).filter(y => !set.includes(y) && r3[y]).length >= before[x])) for (const n of set) { if (done || !r3[n]) continue;
                const ni = n % W, nj = (n / W) | 0;
                for (const [a2, b2] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) { if (!s.inb(ni + a2, nj + b2)) continue; const m = s.k(ni + a2, nj + b2); if (s.cell[m] !== p.idx) continue;
                  const e3 = s.edgeBetween(m, n); if (s.noWall.has(e3) || inWay(e3)) continue; const had3 = s.doors.has(e3); s.doors.add(e3); resetSiteCaches(s); const r4 = siteReach(s);
                  if (r4[m] && s.doorClear(e3) >= min) { for (const q of qs) byPlot.set(q, (byPlot.get(q) ?? []).filter(x => !set.includes(x))); p.door = { cell: m, out: n }; r = r4; opened++; resited++; left -= cells.length; done = true; cut += 1; break; }
                  if (!had3) s.doors.delete(e3); }
                resetSiteCaches(s); }
              if (done) break;
              for (const [n, c0, s0, m0] of saved) { s.cell[n] = c0; s.sub[n] = s0; s.room[n] = m0; } }
            if (!done) resetSiteCaches(s); }
          if (done) break;
          if (!had) s.doors.delete(e); J.forEach((x, q) => { if (!hadJ[q]) s.jambs.delete(x); }); } }
      resetSiteCaches(s); } }
  // s18 C2 (D-660, B580) the last two: a house landlocked by its neighbours' courts whose one lane contact is a corner cell,
  // where the two crossing walls (0.7 m thick) leave a slot of 0.02-0.3 m whatever door is cut. Up to three connected cells
  // at that corner (a neighbour's or the house's own; never a door's cell, never a plot left under 8 cells) are cut back to
  // the lane, the door goes through the cut from the house, kept only when the house is then reached and every other plot
  // keeps every place it had reached, and at least half the house's cells with room for a body are then reached (the cut that reaches most kept) (a cut-back corner, the region's mud-brick lanes: C)
  if (left) { resetSiteCaches(s); let r = siteReach(s);
    for (const p of s.plots) { if (!p.door || p.kind === 'garden') continue; const cells = byPlot.get(p.idx); if (!cells || cells.some(k => r[k]) || !cells.some(k => cellHasRoom(s, k, BODY_MIN))) continue;
      const roomy = cells.filter(k => cellHasRoom(s, k, BODY_MIN)).length, own = new Set(cells), nb4 = (k: number) => { const i = k % W, j = (k / W) | 0, o: number[] = []; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (s.inb(i + a, j + b)) o.push(s.k(i + a, j + b)); return o; };
      const isDoorCell = (n: number) => { const q = s.cell[n]; const Q = q >= 0 ? s.plots[q] : null; return !!Q?.door && (Q.door.cell === n || Q.door.out === n); };
      const open = (n: number) => openCode(s.cell[n]) && r[n];
      // the corner cells: plot cells (this house's or a neighbour's) next to a reached lane cell and within two cells of the house
      const near = (n: number) => { const i = n % W, j = (n / W) | 0; return cells.some(k => Math.abs(k % W - i) <= 2 && Math.abs(((k / W) | 0) - j) <= 2); };
      const cand = new Set<number>(); for (const k of cells) for (const a of nb4(k)) for (const n of [a, ...nb4(a)]) if (s.cell[n] >= 0 && !isDoorCell(n) && near(n) && (byPlot.get(s.cell[n])?.length ?? 0) > 8) cand.add(n);
      const C = [...cand].sort((a, b) => a - b), sets: number[][] = [];
      const grow = (set: number[]) => { if (set.length && set.some(n => nb4(n).some(open))) sets.push(set); if (set.length === 3) return; const last = set.length ? set[set.length - 1] : -1;
        for (const n of C) if (n > last && (!set.length || set.some(m => nb4(m).includes(n)))) grow([...set, n]); };
      grow([]); sets.sort((a, b) => a.length - b.length);
      let best: { set: number[]; m: number; n: number; got: number; extra: number[] } | null = null;
      let trials = 0; for (const set of sets) { if ((best && set.length > best.set.length) || trials > 40) break; /* (the smallest cut that works; at most 40 floods a house: each re-derives the site's walls) */ const qs = [...new Set(set.map(n => s.cell[n]))], saved = set.map(n => [n, s.cell[n], s.sub[n], s.room[n]] as const);
        const before = qs.map(q => (byPlot.get(q) ?? []).filter(x => !set.includes(x) && r[x]).length);
        for (const n of set) { s.cell[n] = LANE; s.sub[n] = 0; s.room[n] = -1; }
        for (const n of set) for (const m of nb4(n)) { if (!own.has(m) || set.includes(m)) continue;
          const e = s.edgeBetween(m, n); if (s.noWall.has(e) || inWay(e)) continue; const had = s.doors.has(e); s.doors.add(e); resetSiteCaches(s); let r2 = siteReach(s); trials++;
          const got = cells.filter(k => !set.includes(k) && r2[k]).length;
          if (r2[m] && got >= 0.5 * roomy && (!best || got > best.got) && s.doorClear(e) >= Math.min(min, NARROW_DOOR)) {
            // (a neighbour's room the cut left without its way out gets an inner door to a reached place of its own, as above)
            const extra: number[] = []; for (const q of qs) { if (q === p.idx) continue; const lost = (byPlot.get(q) ?? []).filter(y => !set.includes(y) && r[y] && !r2[y]);
              let tries = 0; for (const k of lost) { if (r2[k] || tries >= 4 || trials > 40) continue; for (const kk of nb4(k)) { if (s.cell[kk] !== q || !r2[kk]) continue; const e2 = s.edgeBetween(k, kk); if (s.doors.has(e2) || s.noWall.has(e2) || !s.edgeWall(k, kk) || inWay(e2)) continue;
                s.doors.add(e2); if (s.doorClear(e2) < min) { s.doors.delete(e2); continue; } resetSiteCaches(s); const r3 = siteReach(s); trials++; tries++; if (!r3[k]) { s.doors.delete(e2); resetSiteCaches(s); continue; } extra.push(e2); r2 = r3; break; } } }
            if (qs.every((q, x) => (byPlot.get(q) ?? []).filter(y => !set.includes(y) && r2[y]).length >= before[x])) best = { set, m, n, got, extra: [...extra] };
            for (const e2 of extra) s.doors.delete(e2); }
          if (!had) s.doors.delete(e); }
        for (const [n, c0, s0, m0] of saved) { s.cell[n] = c0; s.sub[n] = s0; s.room[n] = m0; } }
      if (best) { const { set, m, n } = best, qs = [...new Set(set.map(x => s.cell[x]))]; for (const x of set) { s.cell[x] = LANE; s.sub[x] = 0; s.room[x] = -1; }
        s.doors.add(s.edgeBetween(m, n)); for (const e2 of best.extra) s.doors.add(e2); for (const q of qs) byPlot.set(q, (byPlot.get(q) ?? []).filter(x => !set.includes(x))); p.door = { cell: m, out: n };
        resetSiteCaches(s); r = siteReach(s); opened++; resited++; left -= cells.length; cut += set.length; }
      resetSiteCaches(s); } }
  // s18 C2 (D-660, B690) a lane pocket no body can walk into (its only exit a one-cell lane between two plots' 0.7 m walls,
  // 0.15 m of room): the corridor widened by a cell into the larger plot along it (its one-cell stretch and the two exit cells
  // beyond), kept when the pocket is then reached and every plot keeps every place it had reached (a lane widened where a
  // yard gave up its edge: C)
  { resetSiteCaches(s); let r = siteReach(s); const isOpen = (k: number) => openCode(s.cell[k]);
    const nb = (k: number, a: number, b: number) => { const i = k % W + a, j = ((k / W) | 0) + b; return s.inb(i, j) ? s.k(i, j) : -1; };
    const seen = new Uint8Array(N);
    for (let k0 = 0; k0 < N; k0++) { if (seen[k0] || r[k0] || !isOpen(k0)) continue; const comp: number[] = [], q = [k0]; seen[k0] = 1;
      while (q.length) { const k = q.pop()!; comp.push(k); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = nb(k, a, b); if (kk >= 0 && !seen[kk] && !r[kk] && isOpen(kk)) { seen[kk] = 1; q.push(kk); } } }
      if (comp.length < 8) continue; const inC = new Set(comp);
      // the corridor: pocket cells open on one axis only, and the reached open cells the pocket meets (the exit)
      const exits = new Set<number>(); for (const k of comp) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = nb(k, a, b); if (kk >= 0 && r[kk] && isOpen(kk)) exits.add(kk); }
      if (!exits.size) continue;
      for (const far of [false, true]) {
      const cut = new Set<number>(); let bad = false;
      const side = (k: number, axisU: boolean) => { const c = axisU ? [nb(k, 0, 1), nb(k, 0, -1)] : [nb(k, 1, 0), nb(k, -1, 0)];
        const ok = c.filter(n => n >= 0 && s.cell[n] >= 0 && !(s.plots[s.cell[n]].door && (s.plots[s.cell[n]].door!.cell === n || s.plots[s.cell[n]].door!.out === n)) && (byPlot.get(s.cell[n])?.length ?? 0) > 60);
        ok.sort((x, y) => (byPlot.get(s.cell[y])?.length ?? 0) - (byPlot.get(s.cell[x])?.length ?? 0)); return ok[0] ?? -1; };
      for (const k of comp) { const o = (a: number, b: number) => { const n = nb(k, a, b); return n >= 0 && isOpen(n); };
        const wide = (o(0, 1) || o(0, -1)) && (o(1, 0) || o(-1, 0)); if (wide) continue; const axisU = o(1, 0) || o(-1, 0); const n = side(k, axisU); if (n < 0) { bad = true; break; } cut.add(n); }
      for (const x of exits) { const k = comp.find(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => nb(c, a, b) === x)); if (k === undefined) continue; const axisU = Math.abs(x - k) === 1, n = side(x, axisU); if (n >= 0) cut.add(n);
        // (and, the second try, one beyond: the two wall corners across the junction can leave a diagonal slot)
        const x2 = x + (x - k); if (far && x2 >= 0 && x2 < N && isOpen(x2)) { const n2 = side(x2, axisU); if (n2 >= 0) cut.add(n2); } }
      if (bad || !cut.size || cut.size > 24) break;
      const set = [...cut], qs = [...new Set(set.map(n => s.cell[n]))], saved = set.map(n => [n, s.cell[n], s.sub[n], s.room[n]] as const);
      const before = qs.map(q2 => (byPlot.get(q2) ?? []).filter(x => !cut.has(x) && r[x]).length);
      for (const n of set) { s.cell[n] = LANE; s.sub[n] = 0; s.room[n] = -1; } resetSiteCaches(s); const r2 = siteReach(s);
      // (a large yard may lose a corner cell or two of its 0.2 %: its own wall end against the widened lane)
      if (comp.filter(k => r2[k]).length >= 0.9 * comp.length && qs.every((q2, x) => (byPlot.get(q2) ?? []).filter(y => !cut.has(y) && r2[y]).length >= before[x] - Math.floor(before[x] * 0.002))) {
        for (const q2 of qs) byPlot.set(q2, (byPlot.get(q2) ?? []).filter(x => !cut.has(x))); r = r2; widened += set.length; break; }
      for (const [n, c0, s0, m0] of saved) { s.cell[n] = c0; s.sub[n] = s0; s.room[n] = m0; } resetSiteCaches(s); } } }
  resetSiteCaches(s);
  return { opened, resited, left };
}
