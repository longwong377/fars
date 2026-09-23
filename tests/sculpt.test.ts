// Sculpted column orders and doorway colossi (D-014): dimensions, flute counts, triangle budgets, mesh sanity,
// colossus footprint, LOD switching and the freshness of the precomputed pieces.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import type { Box, Column, ColumnOrder } from '../src/arch/parts';
import { columnMesh, colossusMesh, colossusFrontProjections, sculptIndex, sculptHash, sculptInputs, sculptParams, piece, encodePiece, decodePiece, srow, PieceName, Lod } from '../src/arch/sculpt';
import { columnGeometry, InstancedLOD, buildMeshes, cutWall } from '../src/arch/meshes';
import { weldPositions, NormMesh } from '../src/arch/sdf';
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

describe('sculpted columns (D-014)', () => {
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

describe('doorway colossi (D-014)', () => {
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
      // at mid-height, halfway along the body, the passage-side surface is carved back (relief) while the wall side is flat
      const y = (c.y0 + c.y1) / 2, band = (i: number) => Math.abs(m.pos[i + 1] - y) < 0.3 && Math.abs(m.pos[i] - c.c[0]) < 0.5;
      let passageFlat = 0, nPass = 0, wallMost = Infinity;
      for (let i = 0; i < m.pos.length; i += 3) {
        const n = -m.pos[i + 2] - c.c[1]; wallMost = Math.min(wallMost, s * n);
        if (band(i) && s * n > 0) { nPass++; if (Math.abs(s * n - c.size[1] / 2) < 1e-3) passageFlat++; }
      }
      expect(nPass).toBeGreaterThan(8); expect(passageFlat / nPass).toBeLessThan(0.5);
      expect(wallMost).toBeCloseTo(-c.size[1] / 2, 3); // the back of the jamb block is the wall-side face of the box
    });
  });
  it('triangle budgets per LOD', () => {
    for (const n of ['colossus_bull', 'colossus_lamassu'] as PieceName[]) { expect(piece(n, 0).idx.length / 3).toBeLessThanOrEqual(BUDGET.colossus_lod0); expect(piece(n, 1).idx.length / 3).toBeLessThanOrEqual(BUDGET.colossus_lod1); }
  });
  it('render: the wall is drawn around the jamb (cut out), the collider box is kept', () => {
    const walls = parts.filter(p => p.type === 'box' && p.kind === 'wall' && p.building === 'gate_nations') as Box[];
    const cutters = parts.filter(p => p.type === 'box' && (p.sculpt || p.kind === 'plinth')) as Box[];
    const cut = walls.map(w => cutWall(w, cutters)).filter(Boolean) as Box[][];
    expect(cut.length).toBe(4); // the W and E walls on either side of the two colossus doorways
    for (const pieces of cut) for (const p of pieces) for (const c of cutters) {
      const overlap = Math.max(0, Math.min(p.c[0] + p.size[0] / 2, c.c[0] + c.size[0] / 2) - Math.max(p.c[0] - p.size[0] / 2, c.c[0] - c.size[0] / 2)) * Math.max(0, Math.min(p.c[1] + p.size[1] / 2, c.c[1] + c.size[1] / 2) - Math.max(p.c[1] - p.size[1] / 2, c.c[1] - c.size[1] / 2)) * Math.max(0, Math.min(p.y1, c.y1) - Math.max(p.y0, c.y0));
      expect(overlap).toBeLessThan(1e-9);
    }
    const g = buildMeshes(parts.filter(p => p.building === 'gate_nations'));
    expect(g.group.children.filter(o => o.name.startsWith('gate_nations:colossus')).length).toBe(4);
    for (const o of g.group.children.filter(o => o.name.startsWith('gate_nations:colossus'))) { expect(o.userData.tier).toBe('C'); expect(o.userData.placeholder).toBe(false); expect(o.userData.note).toMatch(/NEEDS #10/); }
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
