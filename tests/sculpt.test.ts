// Sculpted column orders and doorway colossi (D-018): dimensions, flute counts, triangle budgets, mesh sanity,
// colossus footprint, LOD switching and the freshness of the precomputed pieces.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import type { Box, Column, ColumnOrder } from '../src/arch/parts';
import { columnMesh, colossusMesh, colossusFrontProjections, sculptIndex, sculptHash, sculptInputs, sculptParams, piece, encodePiece, decodePiece, srow, PieceName, Lod } from '../src/arch/sculpt';
import { columnGeometry, InstancedLOD, buildMeshes, cutWall } from '../src/arch/meshes';
import { weldPositions, NormMesh } from '../src/arch/sdf';
import { snail } from '../src/arch/sculpt_models';
import S from '../src/data/sculpture.json';
import sources from '../src/data/sources.json';

const { parts } = buildTerrace();
const columns = parts.filter(p => p.type === 'column') as Column[];
const orders = new Map<string, { o: ColumnOrder; built: number; building: string }>();
for (const c of columns) orders.set(`${JSON.stringify(c.order)}|${c.built.toFixed(2)}`, { o: c.order, built: c.built, building: c.building });
const complete = [...orders.values()].filter(x => x.built >= 1);
const colossi = parts.filter(p => p.type === 'box' && p.sculpt) as Box[];
const BUDGET = srow('lod', 'budget');

function bbox(m: NormMesh) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], m.pos[i + k]); b[k + 3] = Math.max(b[k + 3], m.pos[i + k]); }
  return b;
}
/** concave minima around the shaft cross-section at height y (plane ∩ triangles): local minima of the radius that lie
 *  inside the chord between the neighbouring maxima (arrises) by more than 1 mm, so flat polygon facets do not count */
function fluteMinima(m: NormMesh, y: number, rMax: number) {
  const pts: [number, number, number, number][] = []; // angle, radius, x, z
  for (let t = 0; t < m.idx.length; t += 3) {
    const v = [0, 1, 2].map(k => m.idx[t + k] * 3);
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3], ya = m.pos[a + 1] - y, yb = m.pos[b + 1] - y;
      if ((ya < 0) === (yb < 0) || ya === yb) continue;
      const s = ya / (ya - yb), x = m.pos[a] + (m.pos[b] - m.pos[a]) * s, z = m.pos[a + 2] + (m.pos[b + 2] - m.pos[a + 2]) * s;
      const r = Math.hypot(x, z); if (r < rMax) pts.push([Math.atan2(z, x), r, x, z]);
    }
  }
  pts.sort((p, q) => p[0] - q[0]);
  const u: typeof pts = []; for (const p of pts) if (!u.length || p[0] - u[u.length - 1][0] > 1e-7) u.push(p);
  const n = u.length, at = (i: number) => u[((i % n) + n) % n];
  const isMax = (i: number) => at(i)[1] >= at(i - 1)[1] && at(i)[1] >= at(i + 1)[1];
  let minima = 0;
  for (let i = 0; i < n; i++) {
    if (!(at(i)[1] < at(i - 1)[1] - 1e-6 && at(i)[1] <= at(i + 1)[1] + 1e-9)) continue;
    let l = i - 1; while (!isMax(l) && l > i - n) l--; let r = i + 1; while (!isMax(r) && r < i + n) r++;
    const A = at(l), B = at(r), P = at(i), ex = B[2] - A[2], ez = B[3] - A[3], len = Math.hypot(ex, ez) || 1;
    const depth = ((P[2] - A[2]) * ez - (P[3] - A[3]) * ex) / len; // distance of P from the chord, positive toward the axis
    if (Math.abs(depth) > 1e-3 && Math.sign(depth) === Math.sign(-(A[2] * ez - A[3] * ex))) minima++;
  }
  return minima;
}
function sanity(m: NormMesh, what: string) {
  for (let i = 0; i < m.pos.length; i++) { expect(Number.isFinite(m.pos[i]), `${what} position`).toBe(true); expect(Number.isFinite(m.nrm[i]), `${what} normal NaN`).toBe(true); }
  for (let i = 0; i < m.nrm.length; i += 3) expect(Math.abs(Math.hypot(m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]) - 1), `${what} normal length`).toBeLessThan(1e-3);
  let degenerate = 0;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
    const ux = m.pos[b] - m.pos[a], uy = m.pos[b + 1] - m.pos[a + 1], uz = m.pos[b + 2] - m.pos[a + 2], vx = m.pos[c] - m.pos[a], vy = m.pos[c + 1] - m.pos[a + 1], vz = m.pos[c + 2] - m.pos[a + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2 < 1e-10) degenerate++;
  }
  expect(degenerate, `${what}: degenerate triangles`).toBe(0);
}
/** a ray at world (x, y) coming from the passage side (grid north offset s·∞ from the jamb centre cn) toward the wall: the
 *  first surface it meets, as the grid-north offset from cn measured toward the passage (s·(n − cn)); null if it misses */
function passageHit(m: NormMesh, x: number, y: number, cn: number, s: number): number | null {
  let best: number | null = null;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
    const ax = m.pos[a] - x, ay = m.pos[a + 1] - y, bx = m.pos[b] - x, by = m.pos[b + 1] - y, cx = m.pos[c] - x, cy = m.pos[c + 1] - y;
    const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(d) < 1e-14) continue;
    const u = (bx * cy - by * cx) / d, v = (cx * ay - cy * ax) / d, w = 1 - u - v; // barycentrics of (x, y) in the xy projection
    if (u < 0 || v < 0 || w < 0) continue;
    const off = s * (-(u * m.pos[a + 2] + v * m.pos[b + 2] + w * m.pos[c + 2]) - cn); // world z = −grid north
    if (best === null || off > best) best = off;
  }
  return best;
}
/** edges used by exactly one triangle once coincident positions are welded (0 for closed surfaces) */
function openEdges(m: NormMesh) {
  const w = weldPositions({ pos: m.pos, idx: m.idx }, 1e-5), cnt = new Map<number, number>(), nv = w.pos.length / 3;
  for (let t = 0; t < w.idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = w.idx[t + k], b = w.idx[t + (k + 1) % 3], key = Math.min(a, b) * nv + Math.max(a, b); cnt.set(key, (cnt.get(key) ?? 0) + 1); }
  let open = 0; for (const c of cnt.values()) if (c === 1) open++;
  return open;
}

describe('sculpture.json rows', () => {
  it('every row has v/u/src/tier/note, known source keys, tier C (shape proportions) or B', () => {
    for (const [g, rows] of Object.entries<any>(S)) { if (g.startsWith('_')) continue;
      for (const [k, r] of Object.entries<any>(rows)) {
        for (const f of ['v', 'u', 'src', 'tier', 'note']) expect(r, `${g}.${k}.${f}`).toHaveProperty(f);
        expect(['B', 'C'], `${g}.${k}.tier`).toContain(r.tier);
        expect(r.note.length, `${g}.${k}.note`).toBeGreaterThan(8);
        for (const s of String(r.src).split(';')) expect(Object.keys(sources), `${g}.${k} src ${s}`).toContain(s);
      } }
  });
});

describe('sculpted columns (D-018)', () => {
  it('every order spans exactly 0 … SITE_SPEC column height at both LODs (built < 1: base + raised shaft)', () => {
    for (const { o, built, building } of orders.values()) for (const lod of [0, 1] as Lod[]) {
      const b = bbox(columnMesh(o, built, lod));
      const top = built >= 1 ? o.height : o.baseH + (o.height - o.baseH - o.capitalH) * built;
      expect(b[1], `${building} ${lod}`).toBeCloseTo(0, 4); expect(b[4], `${building} built ${built} lod ${lod}`).toBeCloseTo(top, 3);
    }
    const ap = columnGeometry(complete.find(x => x.building === 'apadana')!.o); ap.computeBoundingBox(); expect(ap.boundingBox!.max.y - ap.boundingBox!.min.y).toBeCloseTo(19.5, 2);
  });
  it('capital types follow SITE_SPEC: Apadana hall + N/E porticoes composite, W portico and the palaces double-bull, Treasury plain', () => {
    const ap = columns.filter(c => c.building === 'apadana');
    expect(ap.filter(c => c.order.capital === 'composite').length).toBe(60); expect(ap.filter(c => c.order.capital === 'bull').length).toBe(12);
    expect(columns.filter(c => c.building === 'gate_nations').every(c => c.order.capital === 'composite')).toBe(true);
    for (const b of ['tachara', 'hadish', 'hall100', 'harem', 'tripylon']) expect(columns.filter(c => c.building === b).every(c => c.order.capital === 'bull'), b).toBe(true);
    expect(columns.filter(c => c.building === 'treasury').every(c => c.order.capital === 'plain')).toBe(true);
    const hall = ap.find(c => c.order.base === 'square2')!; expect(hall.order.capitalH).toBe(7.8); // SITE_SPEC capital_height (composite)
  });
  it('flute count: concave minima around the mid-shaft cross-section = SITE_SPEC flutes (LOD0 and LOD1); timber and unfinished shafts unfluted', () => {
    for (const { o, built, building } of orders.values()) {
      const shaftH = o.height - o.baseH - o.capitalH; if (shaftH * built < 0.5) continue;
      const ymid = o.baseH + (shaftH * built) / 2;
      for (const lod of [0, 1] as Lod[]) {
        const n = fluteMinima(columnMesh(o, built, lod), ymid, o.shaftD * 0.6);
        const fluted = built >= 1 && o.material !== 'timber';
        expect(n, `${building} built ${built} lod ${lod}`).toBe(fluted ? o.flutes : 0);
      }
    }
    expect(complete.find(x => x.building === 'apadana')!.o.flutes).toBe(48);
  });
  it('flutes stop short of the shaft ends (plain bands above the torus and below the capital)', () => {
    const { o } = complete.find(x => x.building === 'apadana')!;
    const F = srow('shaft', 'flutes'), y0 = o.baseH, y1 = o.height - o.capitalH;
    expect(fluteMinima(columnMesh(o, 1, 0), y0 + F.stop_bottom * o.shaftD * 0.5, o.shaftD * 0.6)).toBe(0);
    expect(fluteMinima(columnMesh(o, 1, 0), y1 - F.stop_top * o.shaftD * 0.5, o.shaftD * 0.6)).toBe(0);
    expect(fluteMinima(columnMesh(o, 1, 0), y0 + F.stop_bottom * o.shaftD + o.shaftD, o.shaftD * 0.6)).toBe(48);
  });
  it('triangle budgets per LOD for every order', () => {
    for (const { o, built, building } of orders.values()) {
      const t0 = columnMesh(o, built, 0).idx.length / 3, t1 = columnMesh(o, built, 1).idx.length / 3;
      expect(t0, `${building} LOD0`).toBeLessThanOrEqual(BUDGET.column_lod0); expect(t1, `${building} LOD1`).toBeLessThanOrEqual(BUDGET.column_lod1);
      expect(t1).toBeLessThan(t0);
    }
  });
  it('no NaN normals, unit normals, no degenerate triangles; closed surfaces (no open edges)', () => {
    for (const { o, built, building } of orders.values()) for (const lod of [0, 1] as Lod[]) {
      const m = columnMesh(o, built, lod); sanity(m, `${building} lod ${lod}`); expect(openEdges(m), `${building} lod ${lod} open edges`).toBe(0);
    }
    for (const n of ['protome', 'volute', 'colossus_bull', 'colossus_lamassu'] as PieceName[]) for (const lod of [0, 1] as Lod[]) {
      const m = piece(n, lod); sanity(m, `${n} ${lod}`); expect(openEdges(m), `${n} ${lod} open edges`).toBe(0);
    }
  });
});

describe('doorway colossi (D-018)', () => {
  it('four colossi: bulls in the W doorway, human-headed winged bulls in the E doorway (SITE_SPEC guardians), heads facing out', () => {
    expect(colossi.length).toBe(4);
    const cx = parts.find(p => p.building === 'gate_nations' && p.kind === 'floor') as Box;
    for (const c of colossi) {
      const west = c.c[0] < cx.c[0];
      expect(c.sculpt!.model).toBe(west ? 'bull' : 'lamassu'); expect(c.sculpt!.facing).toBe(west ? -1 : 1);
      expect(Math.sign(cx.c[1] - c.c[1])).toBe(c.sculpt!.passage); // relief faces the door axis
      expect(c.tier).toBe('C'); expect(c.placeholder).toBeFalsy();
    }
  });
  it('each colossus fits inside its plinth footprint box, on the plinth, and fills it (not a sliver)', () => {
    for (const c of colossi) {
      const plinth = parts.find(p => p.type === 'box' && p.kind === 'plinth' && Math.hypot(p.c[0] - c.c[0], p.c[1] - c.c[1]) < 1e-6) as Box;
      expect(plinth).toBeTruthy();
      for (const lod of [0, 1] as Lod[]) {
        const b = bbox(colossusMesh(c, lod)), tol = 1e-3;
        // world x = grid east, z = −grid north
        expect(b[0]).toBeGreaterThanOrEqual(plinth.c[0] - plinth.size[0] / 2 - tol); expect(b[3]).toBeLessThanOrEqual(plinth.c[0] + plinth.size[0] / 2 + tol);
        expect(-b[5]).toBeGreaterThanOrEqual(plinth.c[1] - plinth.size[1] / 2 - tol); expect(-b[2]).toBeLessThanOrEqual(plinth.c[1] + plinth.size[1] / 2 + tol);
        expect(b[1]).toBeGreaterThanOrEqual(plinth.y1 - tol); expect(b[4]).toBeLessThanOrEqual(c.y1 + tol);
        expect(b[3] - b[0]).toBeGreaterThan(plinth.size[0] * 0.95); expect(b[4] - b[1]).toBeGreaterThan((c.y1 - c.y0) * 0.95);
      }
    }
  });
  it('the fore-part stands in the round at the outer end and the relief is on the passage side', () => {
    const fr = colossusFrontProjections(parts as Box[]);
    colossi.forEach((c, ci) => {
      const m = colossusMesh(c, 0), f = c.sculpt!.facing, s = c.sculpt!.passage, H = c.y1 - c.y0;
      // in front of the jamb block (the part projecting beyond the wall face): head high up, hooves on the plinth, and
      // narrower than the block (in the round, not a slab)
      let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < m.pos.length; i += 3) if (f * (m.pos[i] - c.c[0]) > c.size[0] / 2 - fr[ci] + 0.05) { y0 = Math.min(y0, m.pos[i + 1]); y1 = Math.max(y1, m.pos[i + 1]); z0 = Math.min(z0, m.pos[i + 2]); z1 = Math.max(z1, m.pos[i + 2]); }
      expect(y1 - c.y0).toBeGreaterThan(H * 0.75); expect(y0 - c.y0).toBeLessThan(0.05); expect(z1 - z0).toBeLessThan(c.size[1] * 0.85);
      // at mid-height, halfway along the body, the passage-side surface is carved back (relief) while the wall side is flat:
      // rays cast from the passage toward the wall over a 7 × 7 grid (x ± 0.5 m, y ± 0.3 m) all hit the carving, and most
      // of them hit it off the box face (surface sampling, independent of how the simplifier spread the vertices)
      const y = (c.y0 + c.y1) / 2; let wallMost = Infinity, hits = 0, flat = 0;
      for (let i = 0; i < m.pos.length; i += 3) wallMost = Math.min(wallMost, s * (-m.pos[i + 2] - c.c[1]));
      for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) {
        const n = passageHit(m, c.c[0] - 0.5 + a / 6, y - 0.3 + (b / 6) * 0.6, c.c[1], s);
        if (n === null) continue; hits++; if (Math.abs(n - c.size[1] / 2) < 1e-3) flat++;
      }
      expect(hits).toBe(49); expect(flat / hits).toBeLessThan(0.5);
      expect(wallMost).toBeCloseTo(-c.size[1] / 2, 3); // the back of the jamb block is the wall-side face of the box
    });
  });
  it('triangle budgets per LOD', () => {
    for (const n of ['colossus_bull', 'colossus_lamassu'] as PieceName[]) { expect(piece(n, 0).idx.length / 3).toBeLessThanOrEqual(BUDGET.colossus_lod0); expect(piece(n, 1).idx.length / 3).toBeLessThanOrEqual(BUDGET.colossus_lod1); }
  });
  it('parts: the wall ring is cut around each colossus and plinth (no overlap in parts, colliders or render; D-032)', () => {
    const walls = parts.filter(p => p.type === 'box' && p.kind === 'wall' && p.building === 'gate_nations') as Box[];
    const cutters = parts.filter(p => p.type === 'box' && p.building === 'gate_nations' && (p.sculpt || p.kind === 'plinth')) as Box[];
    expect(cutters.length).toBe(8);
    const ov = (p: Box, c: Box) => Math.max(0, Math.min(p.c[0] + p.size[0] / 2, c.c[0] + c.size[0] / 2) - Math.max(p.c[0] - p.size[0] / 2, c.c[0] - c.size[0] / 2)) * Math.max(0, Math.min(p.c[1] + p.size[1] / 2, c.c[1] + c.size[1] / 2) - Math.max(p.c[1] - p.size[1] / 2, c.c[1] - c.size[1] / 2)) * Math.max(0, Math.min(p.y1, c.y1) - Math.max(p.y0, c.y0));
    for (const w of walls) for (const c of cutters) expect(ov(w, c), `wall at ${w.c} vs ${c.kind} at ${c.c}`).toBeLessThan(1e-6);
    for (const w of walls) { // nothing left to cut: cutting again removes no volume (≤ 1 cm³; floating-point residue at shared faces)
      const vol = (b: Box) => b.size[0] * b.size[1] * (b.y1 - b.y0), again = cutWall(w, cutters);
      if (again) expect(Math.abs(again.reduce((q, b) => q + vol(b), 0) - vol(w))).toBeLessThan(1e-6);
    }
    // the wall still stands over every colossus (from its top to the wall top), so the doorway reads as before
    for (const c of cutters.filter(q => q.sculpt)) expect(walls.some(w => ov({ ...w, y0: c.y0, y1: c.y1 }, c) > 0 && Math.abs(w.y0 - c.y1) < 1e-9), `wall above ${c.c}`).toBe(true);
    const g = buildMeshes(parts.filter(p => p.building === 'gate_nations'));
    expect(g.group.children.filter(o => o.name.startsWith('gate_nations:colossus')).length).toBe(4);
    for (const o of g.group.children.filter(o => o.name.startsWith('gate_nations:colossus'))) { expect(o.userData.tier).toBe('C'); expect(o.userData.placeholder).toBe(false); expect(o.userData.note).toMatch(/NEEDS #10/); }
  });
  it('door leaves hang at the inner end and stand open against the inner wall face, clear of the colossi and the passage', () => {
    const leaves = parts.filter(p => p.type === 'box' && p.kind === 'door_leaf' && p.building === 'gate_nations') as Box[];
    const floor = parts.find(p => p.building === 'gate_nations' && p.kind === 'floor') as Box, hs = Math.sqrt(612);
    expect(leaves.length).toBe(6);
    for (const l of leaves) {
      // inside the hall square, touching its boundary (the inner wall face)
      const x0 = l.c[0] - l.size[0] / 2, x1 = l.c[0] + l.size[0] / 2, y0 = l.c[1] - l.size[1] / 2, y1 = l.c[1] + l.size[1] / 2;
      const hx0 = floor.c[0] - hs / 2, hx1 = floor.c[0] + hs / 2, hy0 = floor.c[1] - hs / 2, hy1 = floor.c[1] + hs / 2;
      expect(x0).toBeGreaterThanOrEqual(hx0 - 0.02); expect(x1).toBeLessThanOrEqual(hx1 + 0.02); expect(y0).toBeGreaterThanOrEqual(hy0 - 0.02); expect(y1).toBeLessThanOrEqual(hy1 + 0.02);
      expect(Math.min(Math.abs(x0 - hx0), Math.abs(x1 - hx1), Math.abs(y0 - hy0), Math.abs(y1 - hy1))).toBeLessThan(0.02);
      for (const c of colossi) { // clearance to every colossus box, in plan (m)
        const dx = Math.max(0, Math.max(x0, c.c[0] - c.size[0] / 2) - Math.min(x1, c.c[0] + c.size[0] / 2)), dy = Math.max(0, Math.max(y0, c.c[1] - c.size[1] / 2) - Math.min(y1, c.c[1] + c.size[1] / 2));
        expect(Math.hypot(dx, dy), 'leaf clear of the colossus').toBeGreaterThan(0);
      }
    }
  });
});

describe('carving details (D-029)', () => {
  it('curls are snail curls: a spiral groove cuts each boss, neighbouring locks coil in opposite senses (not plain domes)', () => {
    const C = srow('colossus', 'curls'), at = (u0: number, rr: number, a: number) => snail(u0 + rr * C.rad * Math.cos(a), rr * C.rad * Math.sin(a), C.pitch, C.rad, C.turns, C.groove_w, C.groove_d);
    for (const u0 of [0, C.pitch]) { // two neighbouring locks in the same row
      let lo = Infinity, hi = -Infinity; for (let k = 0; k < 90; k++) { const v = at(u0, 0.5, (k / 90) * 2 * Math.PI); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      expect(hi - lo, 'the groove crosses a circle of half the lock radius (a dome would be constant there)').toBeGreaterThan(0.3);
      expect(lo).toBeLessThan(Math.sqrt(0.75) - 0.3);
    }
    // handedness: the groove's angle grows with the radius in opposite senses on the two locks
    const grooveAngle = (u0: number, rr: number) => { let best = Infinity, ba = 0; for (let k = 0; k < 360; k++) { const a = (k / 360) * 2 * Math.PI, v = at(u0, rr, a); if (v < best) { best = v; ba = a; } } return ba; };
    const turn = (u0: number) => { let d = grooveAngle(u0, 0.62) - grooveAngle(u0, 0.5); d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; return Math.sign(d); };
    expect(turn(0) * turn(C.pitch)).toBe(-1);
  });
  it('protome horns read as horns: they spread at least 0.4 D out from the head axis and rise above the skull', () => {
    const H = srow('protome', 'head'), m = piece('protome', 0), skullTop = H.skull_c[1] + H.skull_r[1];
    // the unit protome is fitted to its box at load; in the piece's own frame (D units) measure the head region of one bull
    let zMax = 0, yMax = -Infinity; for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i] > H.skull_c[0] - 0.3) { zMax = Math.max(zMax, Math.abs(m.pos[i + 2])); yMax = Math.max(yMax, m.pos[i + 1]); }
    expect(zMax).toBeGreaterThan(0.4); expect(yMax).toBeGreaterThan(skullTop + 0.05);
    let len = 0; for (let k = 1; k < H.horn.length; k++) len += Math.hypot(...H.horn[k].map((v: number, j: number) => v - H.horn[k - 1][j]) as [number, number, number]);
    expect(len, 'horn length along the curve (D)').toBeGreaterThan(0.45); expect(H.horn_r[0]).toBeGreaterThan(0.07);
  });
  it('the lamassu beard and chest curls are separate: a smooth band of chest between them (rays along the front)', () => {
    const HM = srow('colossus', 'human_head'), BE = srow('colossus', 'beard'), BD = srow('colossus', 'body'), m = piece('colossus_lamassu', 0);
    const beardBottom = HM.beard_c[1] - HM.beard_h[1];
    const frontX = (y: number, z: number) => { let best = -Infinity; // first surface met by a ray from +x at (y, z)
      for (let t = 0; t < m.idx.length; t += 3) {
        const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
        const ay = m.pos[a + 1] - y, az = m.pos[a + 2] - z, by = m.pos[b + 1] - y, bz = m.pos[b + 2] - z, cy = m.pos[c + 1] - y, cz = m.pos[c + 2] - z;
        const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay); if (Math.abs(d) < 1e-14) continue;
        const u = (by * cz - bz * cy) / d, v = (cy * az - cz * ay) / d, w = 1 - u - v; if (u < 0 || v < 0 || w < 0) continue;
        best = Math.max(best, u * m.pos[a] + v * m.pos[b] + w * m.pos[c]); }
      return best; };
    // roughness = mean |second difference| of the front profile at 1 cm steps, beside the median plane (the legs are below)
    const rough = (y0: number, y1: number) => { let s = 0, n = 0; for (const z of [BD.zc - 0.15, BD.zc + 0.15]) { const p: number[] = []; for (let y = y0; y <= y1 + 1e-9; y += 0.01) p.push(frontX(y, z)); for (let i = 1; i < p.length - 1; i++) { s += Math.abs(p[i + 1] - 2 * p[i] + p[i - 1]); n++; } } return s / n; };
    const gap = rough(beardBottom - BE.chest_gap + 0.03, beardBottom - 0.03), curls = rough(beardBottom - BE.chest_gap - 0.4, beardBottom - BE.chest_gap - 0.1);
    expect(gap * 3, `gap ${gap.toFixed(4)} vs curls ${curls.toFixed(4)}`).toBeLessThan(curls);
  });
});

describe('LOD and precomputed pieces', () => {
  it('instanced columns switch per instance between LOD0 and LOD1 with the camera distance (perspective cameras only)', () => {
    const o = complete.find(x => x.building === 'apadana')!.o, SW = srow('lod', 'switch');
    const at = new Float32Array([0, 0, 0, o.height, 100, 0, 0, o.height, 200, 0, 0, o.height]);
    const lod = new InstancedLOD([columnGeometry(o, 1, 0), columnGeometry(o, 1, 1)], new THREE.MeshBasicNodeMaterial(), at, SW.column, SW.hysteresis);
    expect(lod.counts()).toEqual([0, 3]);
    const cam = new THREE.PerspectiveCamera(); cam.position.set(95, 2, 5); cam.updateMatrixWorld();
    lod.update(cam); expect(lod.counts()).toEqual([1, 2]);
    const sun = new THREE.OrthographicCamera(); sun.position.set(0, 50, 0); sun.updateMatrixWorld();
    lod.update(sun); expect(lod.counts()).toEqual([1, 2]); // shadow pass keeps the view's selection
    cam.position.set(100 + SW.column + SW.hysteresis + 1, 2, 5); cam.updateMatrixWorld(); lod.update(cam); expect(lod.counts()).toEqual([0, 3]);
    cam.position.set(100 + SW.column, 2, 0); cam.updateMatrixWorld(); lod.update(cam); expect(lod.counts()).toEqual([0, 3]); // hysteresis: no flicker at the threshold
  });
  it('precomputed pieces are up to date with their inputs (else: npx tsx tools/build_sculpt.ts)', () => {
    const idx = sculptIndex(); expect(idx, 'public/generated/sculpt.json missing').toBeTruthy();
    const fr = colossusFrontProjections(parts as Box[]); const front = fr.reduce((a, b) => a + b, 0) / fr.length;
    expect(Math.max(...fr) - Math.min(...fr)).toBeLessThan(0.02);
    expect(idx!.params.colossusFront).toBeCloseTo(front, 2);
    expect(idx!.hash).toBe(sculptHash(sculptInputs(p => readFileSync(p, 'utf8'), sculptParams(front))));
  });
  it('binary round trip keeps positions within the quantisation step', () => {
    const m = piece('protome', 1), d = decodePiece(encodePiece(m)), b = bbox(m);
    expect(d.idx).toEqual(m.idx);
    for (let i = 0; i < m.pos.length; i++) expect(Math.abs(d.pos[i] - m.pos[i])).toBeLessThanOrEqual(((b[(i % 3) + 3] - b[i % 3]) / 65535) * 0.51 + 1e-6);
  });
});
