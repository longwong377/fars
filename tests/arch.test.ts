// §13.2 plan overlay (geometric: rasterised at 0.25 m) and §13.3 dimension tests: the built parts measured against
// SITE_SPEC and the georeferenced footprints. (The rendered top-down overlay is tests/e2e/plan.spec.ts.)
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { Part, Pt, pointInPoly } from '../src/arch/parts';
import { footprint, v, SPEC } from '../src/arch/spec';
import { columnGeometry } from '../src/arch/meshes';
import { polyUnion, polyIntersection, rectPoly } from '../src/arch/poly';

const { parts, manifest } = buildTerrace();
const RES = 0.25;
function partPolys(p: Part): Pt[] | null {
  if (p.type === 'prism') return p.polygon;
  if (p.type === 'box') { const [w, h] = p.size, r = p.rot ?? 0, c = Math.cos(r), s = Math.sin(r); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [p.c[0] + x * c - y * s, p.c[1] + x * s + y * c]); }
  return null;
}
function iou(a: Pt[][], bs: Pt[][]) {
  const all = [...a.flat(), ...bs.flat()]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of all) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let inter = 0, uni = 0, ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
  for (let y = y0; y <= y1; y += RES) for (let x = x0; x <= x1; x += RES) {
    const ia = a.some(p => pointInPoly(x, y, p)), ib = bs.some(p => pointInPoly(x, y, p));
    if (ia || ib) uni++; if (ia && ib) inter++; if (ia) { ax += x; ay += y; an++; } if (ib) { bx += x; by += y; bn++; }
  }
  return { iou: inter / uni, offset: Math.hypot(ax / an - bx / bn, ay / an - by / bn) };
}
const outline = (b: string, kinds?: string[]) => parts.filter(p => p.building === b && p.type !== 'column' && (!kinds || kinds.includes(p.kind))).map(partPolys).filter(Boolean) as Pt[][];

// Phase 4 corrected five outlines against the traced OSM ruins, from the two registered plans (REF-PLAN, REF-SCHMIDT; B).
// Those buildings are compared with the trace plus the documented correction; every such reason is printed.
const ring = (k: string) => (footprint(k).polygon as Pt[]).slice(0, -1);
const fp = (k: string) => footprint(k).bounds;
const corrected: Record<string, { ref: () => Pt[][]; why: string }> = {
  hadish: { ref: () => polyUnion(ring('hadish'), rectPoly(v<any>('hadish', 'stair_e_zone').x, v<any>('hadish', 'stair_e_zone').y)).map(p => p.outer),
    why: 'E stair zone (REF-PLAN, B) projects ~8 m beyond the traced E edge' },
  tripylon: { ref: () => { const Z = v<any>('tripylon', 'stair_n_zone'), F = v<any[]>('tripylon', 'stair_n_flights'), SC = v<any>('tripylon', 's_portico_court'), EC = v<any>('tripylon', 'r_e_corridor'), EN = v<any>('tripylon', 'stair_e_narrow'), [x0, y0, x1, y1] = fp('tripylon');
      return polyUnion(ring('tripylon'), rectPoly(Z.x, [y1, F.find(f => f.id === 'upper_terrace').y[1]]), rectPoly(SC.court.x, [SC.court.y[0], y0]), rectPoly([x1, EC.x[1]], EC.y), rectPoly(EN.x, EC.landing_y)).map(p => p.outer); },
    why: 'the trace is only the hall core; the N portico and stair-head terrace, the S court and the E corridor (REF-PLAN, B zones; C levels) are added' },
  treasury: { ref: () => polyIntersection(ring('treasury'), rectPoly([fp('treasury')[0] - 1, fp('treasury')[2] + 1], [fp('treasury')[1] - 1, v('treasury', 'r_north_wall_y')])).map(p => p.outer),
    why: 'the traced N edge includes the ~12 m street S of the Hall of 100 Columns; N wall at y −78 on both plans' },
  harem: { ref: () => polyUnion(ring('harem'), rectPoly(v<any>('harem', 'r_main_wing_extent').x, v<any>('harem', 'r_main_wing_extent').y)).map(p => p.outer),
    why: 'the main wing runs N of the modern museum footprint to y ~−73 on both plans' },
};
describe('§13.2 plan overlay vs georeferenced footprints (IoU ≥ 0.95, offset < 0.5 m)', () => {
  const STAIR = ['step', 'landing', 'parapet'];
  const cases: [string, string, string[] | undefined][] = [
    ['terrace', 'terrace', undefined], ['apadana', 'apadana', ['platform']], ['gate_nations', 'gate_nations', ['wall', 'floor']],
    ['tachara', 'tachara', ['platform', ...STAIR]], ['hadish', 'hadish', ['platform', ...STAIR]], ['hall100', 'hall100', ['floor', 'wall']],
    ['tripylon', 'tripylon', ['platform']], ['treasury', 'treasury', ['floor']], ['harem', 'harem', ['floor']], ['garrison', 'garrison', ['floor']],
    ['grand_stair', 'grand_stair', ['step', 'landing', 'pavement', 'parapet']],
  ];
  for (const [b, fk, kinds] of cases) it(`${b}`, () => {
    let polys = outline(b, kinds);
    if (b === 'terrace') polys = [...polys.filter((_, i) => parts.filter(p => p.building === 'terrace' && p.type !== 'column')[i].kind === 'platform'), ...outline('grand_stair', ['step', 'landing', 'pavement', 'parapet'])];
    const c = corrected[b]; const r = iou(polys, c ? c.ref() : [footprint(fk).polygon as Pt[]]);
    console.warn(`${b.padEnd(14)} IoU ${r.iou.toFixed(4)} offset ${r.offset.toFixed(3)} m${c ? `  [vs trace + documented correction: ${c.why}]` : ''}`);
    expect(r.iou).toBeGreaterThanOrEqual(0.95); expect(r.offset).toBeLessThan(0.5);
  });
});

describe('§13.3 dimension tests (built parts vs SITE_SPEC)', () => {
  it('Grand Stair: 111 steps per side (63 + 48), riser 12/111 m, tread 0.31, top landing at the court (0 ± 1 mm)', () => {
    expect(manifest.grand_stair.stepsNorth).toBe(111); expect(manifest.grand_stair.stepsSouth).toBe(111);
    const steps = parts.filter(p => p.building === 'grand_stair' && p.kind === 'step') as any[];
    const tops = [...new Set(steps.map(s => +s.y1.toFixed(4)))].sort((a, b) => a - b);
    const diffs = tops.slice(1).map((t, i) => t - tops[i]);
    for (const d of diffs) expect(Math.abs(d - v('grand_stair', 'riser'))).toBeLessThan(1e-3);
    expect(Math.abs(Math.max(...tops) - 0)).toBeLessThan(1e-3);
    expect(Math.abs(Math.min(...tops) - (-12 + v('grand_stair', 'riser')))).toBeLessThan(1e-3);
    for (const s of steps) expect(Math.min(...s.size)).toBeCloseTo(v('grand_stair', 'tread'), 6);
  });
  it('Apadana: 36 hall + 36 portico columns; height 19.5; interaxial 8.64; hall interior 60.5 between wall faces; podium 3.0', () => {
    const cols = parts.filter(p => p.building === 'apadana' && p.type === 'column') as any[];
    expect(cols.length).toBe(72);
    const hall = cols.filter(c => c.order.base === 'square2');
    expect(hall.length).toBe(36);
    const xs = [...new Set(hall.map(c => +c.c[0].toFixed(3)))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(v('apadana', 'interaxial'), 3);
    const g = columnGeometry(hall[0].order, 1); g.computeBoundingBox(); expect(g.boundingBox!.max.y - g.boundingBox!.min.y).toBeCloseTo(v('apadana', 'column_height'), 2);
    for (const c of cols) expect(c.y0).toBe(v('apadana', 'podium_height'));
    const walls = parts.filter(p => p.building === 'apadana' && p.kind === 'wall') as any[];
    const [cx, cy] = v<number[]>('apadana', 'hall_centre');
    const innerW = Math.min(...walls.filter(w => w.c[0] > cx + 20).map(w => w.c[0] - w.size[0] / 2)) - Math.max(...walls.filter(w => w.c[0] < cx - 20).map(w => w.c[0] + w.size[0] / 2));
    expect(innerW).toBeCloseTo(v('apadana', 'hall_side'), 3);
    const innerN = Math.min(...walls.filter(w => w.c[1] > cy + 20).map(w => w.c[1] - w.size[1] / 2)) - Math.max(...walls.filter(w => w.c[1] < cy - 20).map(w => w.c[1] + w.size[1] / 2));
    expect(innerN).toBeCloseTo(v('apadana', 'hall_side'), 3);
  });
  it('Gate of All Nations: 4 columns of 16.5 m, 3 doorways 10 m high, square hall 24.74 m', () => {
    const cols = parts.filter(p => p.building === 'gate_nations' && p.type === 'column') as any[];
    expect(cols.length).toBe(4); const g = columnGeometry(cols[0].order, 1); g.computeBoundingBox(); expect(g.boundingBox!.max.y).toBeCloseTo(16.5, 2);
    const walls = parts.filter(p => p.building === 'gate_nations' && p.kind === 'wall') as any[];
    const jambs = parts.filter(p => p.building === 'gate_nations' && p.type === 'box' && (p.kind === 'colossus' || p.kind === 'plinth')) as any[];
    const overJamb = (w: any) => jambs.some(c => Math.abs(w.c[0] - c.c[0]) < (w.size[0] + c.size[0]) / 2 && Math.abs(w.c[1] - c.c[1]) < (w.size[1] + c.size[1]) / 2);
    const lintels = walls.filter(w => w.y0 > 0.1 && !overJamb(w)); expect(lintels.length).toBe(3); for (const l of lintels) expect(l.y0).toBeCloseTo(10, 6);
    const overColossi = walls.filter(w => w.y0 > 0.1 && overJamb(w)); expect(overColossi.length).toBe(4); // the wall ring is cut around the colossus jambs (D-032)
    expect(manifest.gate_nations.hallInteriorX).toBeCloseTo(Math.sqrt(612), 2);
  });
  it('Hall of 100 Columns: 10 × 10 grid at 68.5/11 m, 16-column portico; under construction (some shafts not raised)', () => {
    const cols = parts.filter(p => p.building === 'hall100' && p.type === 'column') as any[];
    expect(cols.length).toBe(116); expect(manifest.hall100.raised).toBeGreaterThan(10); expect(manifest.hall100.raised).toBeLessThan(90);
  });
  it('Tachara 12 + 8 columns on a platform 2.6 m above the court; Hadish 36 + 12 on 6.0 m', () => {
    expect(manifest.tachara.hallColumns).toBe(12); expect(manifest.tachara.porticoColumns).toBe(8); expect(manifest.tachara.floor).toBe(2.6);
    expect(manifest.hadish.hallColumns).toBe(36); expect(manifest.hadish.porticoColumns).toBe(12); expect(manifest.hadish.floor).toBe(6.0);
  });
  it('chronology: no part belongs to a structure absent in 467 BCE', () => {
    const absent = ['palace_h', 'palace_g', 'palace_a3', 'unfinished_gate', 'tombs_rahmat', 'modern', 'modern_roof'];
    for (const p of parts) expect(absent).not.toContain(p.building);
  });
  it('every part carries tier and source keys', () => {
    for (const p of parts) { expect(['A', 'B', 'C']).toContain(p.tier); expect(p.src.length).toBeGreaterThan(0); }
    void SPEC;
  });
});
describe('§13.3 Phase 4 dimension tests (stairs, doors, corrected outlines)', () => {
  const steps = (b: string) => parts.filter(p => p.building === b && p.kind === 'step') as any[];
  const risersOf = (ss: any[]) => { const tops = [...new Set(ss.map(q => +q.y1.toFixed(4)))].sort((a, b) => a - b); return tops.slice(1).map((t, i) => t - tops[i]); };
  it('Tachara S stair: 2 flights × 26 risers of 0.10 m up to the 2.6 m floor, central landing at floor level; hall centre y −80', () => {
    const ss = steps('tachara'); expect(ss.length).toBe(52); expect(Math.max(...ss.map(q => q.y1))).toBeCloseTo(v('tachara', 'floor'), 6);
    for (const d of risersOf(ss)) expect(d).toBeCloseTo(0.1, 6);
    const land = parts.find(p => p.building === 'tachara' && p.kind === 'landing') as any; expect(land.y1).toBeCloseTo(2.6, 6);
    expect(manifest.tachara.hallCentreY).toBe(-80);
    const nWalls = (parts.filter(p => p.building === 'tachara' && p.kind === 'wall') as any[]).filter(w => w.c[1] > -80 + 7);
    expect(nWalls.filter(w => w.y0 === 2.6).length).toBe(3); // two N doorways (to the two N rooms) split the N wall into three runs
    expect(nWalls.filter(w => w.y0 > 2.6).length).toBe(2); // with a lintel zone above each
  });
  it('Hadish: hall 27 m between wall faces, 6 × 6 at 3.9 m; W and E stairs 4 flights × 25 risers of 0.12 m to the 6.0 m floor', () => {
    expect(manifest.hadish.hallInterior).toBe(27); expect(manifest.hadish.stairSteps).toBe(200);
    const ss = steps('hadish'); expect(Math.max(...ss.map(q => q.y1))).toBeCloseTo(6.0, 6);
    for (const d of risersOf(ss)) expect(d).toBeCloseTo(0.12, 6);
    const cols = parts.filter(p => p.building === 'hadish' && p.type === 'column' && Math.abs((p as any).c[1] + 159.5) < 14) as any[];
    const xs = [...new Set(cols.map(c => +c.c[0].toFixed(3)))].sort((a, b) => a - b); expect(xs.length).toBe(6);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(3.9, 6);
  });
  it('Tripylon: hall 15.46 m, doorways N/E/S only; N stair 2 × 26 risers to 2.6; narrow E stair 20 risers', () => {
    expect(manifest.tripylon.hallInterior).toBe(15.46); expect(manifest.tripylon.doors).toBe(3);
    const walls = parts.filter(p => p.building === 'tripylon' && p.kind === 'wall') as any[];
    const W = walls.filter(w => w.c[0] < 81.9 - 7); expect(W.length).toBe(1); // no W doorway
    const ss = steps('tripylon'); expect(Math.max(...ss.map(q => q.y1))).toBeCloseTo(2.6, 6); expect(ss.length).toBe(26 * 2 + 26 + 20);
  });
  it('Hall of 100 Columns: 8 doorways at ±12.5 m from the centre; portico step band and thresholds reach the 0.5 m floor', () => {
    const walls = parts.filter(p => p.building === 'hall100' && p.kind === 'wall') as any[]; expect(walls.length).toBe(4 * 3);
    const ss = steps('hall100'); expect(ss.length).toBe(3 + 6 * 3); expect(Math.max(...ss.map(q => q.y1))).toBeCloseTo(v('hall100', 'floor'), 6);
  });
  it('Treasury N wall at y −78 (street to the Hall of 100 Columns kept open); Harem main wing reaches y −73', () => {
    expect(manifest.treasury.northWallY).toBe(-78); expect(manifest.harem.northEdge).toBe(-73);
    const tWalls = parts.filter(p => p.building === 'treasury' && p.kind === 'wall') as any[];
    for (const w of tWalls) expect(w.c[1]).toBeLessThan(-78 + 0.1);
  });
  it('every Phase-4 flight top meets a floor or landing (no gap above 1 mm)', () => {
    for (const b of ['tachara', 'hadish', 'tripylon', 'hall100', 'harem']) {
      const lv = new Set([0, ...parts.filter(p => p.building === b && p.type !== 'column' && ['platform', 'landing', 'floor', 'portico_floor'].includes(p.kind)).map(p => +(p as any).y1.toFixed(3))]);
      const tops = steps(b).map(q => +q.y1.toFixed(3)); const maxTop = Math.max(...tops, 0);
      expect([...lv].some(l => Math.abs(l - maxTop) < 1e-3), `${b} top ${maxTop} vs ${[...lv]}`).toBe(true);
    }
  });
});
describe('part sanity', () => {
  it('no part has y1 <= y0 or extends above 40 m (nothing on the Terrace is that tall)', () => {
    for (const p of parts) if (p.type !== 'column') { expect(p.y1).toBeGreaterThan(p.y0); expect(p.y1).toBeLessThan(40); }
  });
});
import { readFileSync } from 'node:fs';
describe('review MJ-1/MJ-2 regressions', () => {
  it('generator has no dimensional literals (only 0, 1, 2, 3, 0.5, 8, 9 as structural constants: halves, thirds, sample counts)', () => {
    const src = readFileSync('src/arch/terrace.ts', 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, ''); // strings in order of appearance (a "…'…'…" string is one token)
    const lits = [...src.matchAll(/(?<![\w.])(\d+\.?\d*(?:e-?\d+)?)(?![\w])/g)].map(m => m[1]).filter(n => !['0', '1', '2', '3', '0.5', '8', '9'].includes(n));
    expect(lits).toEqual([]);
  });
  it('Apadana N and E stair landings adjoin the podium edge (no trench) and no step lies inside a landing', () => {
    const ap = parts.filter(p => p.building === 'apadana') as any[];
    const landings = ap.filter(p => p.kind === 'landing'), steps = ap.filter(p => p.kind === 'step');
    expect(landings.length).toBe(6); expect(steps.length).toBe(4 * 2 * 30);
    const nEdge = manifest.apadana.nStairEdge as number;
    const nLand = landings.filter(l => l.c[1] > nEdge - 1); // N stair landings lie N of the podium edge
    for (const l of nLand) expect(Math.abs((l.c[1] - l.size[1] / 2) - nEdge)).toBeLessThan(1e-6);
    const inside = (s: any, l: any) => Math.abs(s.c[0] - l.c[0]) < (l.size[0] - s.size[0]) / 2 - 1e-6 && Math.abs(s.c[1] - l.c[1]) < (l.size[1] - s.size[1]) / 2 - 1e-6;
    for (const s of steps) for (const l of landings) expect(inside(s, l)).toBe(false);
    for (const l of landings) expect(l.y1).toBeCloseTo(v('apadana', 'podium_height'), 6);
  });
});
import sources from '../src/data/sources.json';
describe('SITE_SPEC integrity', () => {
  it('every row has v/u/src/tier, valid source keys and a tier in {A,B,C,A/B,B/C}', () => {
    for (const [b, rows] of Object.entries<any>(SPEC)) { if (b.startsWith('_')) continue;
      for (const [k, r] of Object.entries<any>(rows)) { if (typeof r !== 'object') continue; // 'state'/'footprint' are plain keys
        expect(r, `${b}.${k}`).toHaveProperty('v'); expect(typeof r.u, `${b}.${k}.u`).toBe('string');
        expect(['A', 'B', 'C', 'A/B', 'B/C'], `${b}.${k}.tier=${r.tier}`).toContain(r.tier);
        for (const key of String(r.src).split(';')) expect(Object.keys(sources), `${b}.${k} src ${key}`).toContain(key);
      } }
  });
});
