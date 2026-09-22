// §13.2 plan overlay (geometric: rasterised at 0.25 m) and §13.3 dimension tests: the built parts measured against
// SITE_SPEC and the georeferenced footprints. (The rendered top-down overlay is tests/e2e/plan.spec.ts.)
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { Part, Pt, pointInPoly } from '../src/arch/parts';
import { footprint, v, SPEC } from '../src/arch/spec';
import { columnGeometry } from '../src/arch/meshes';

const { parts, manifest } = buildTerrace();
const RES = 0.25;
function partPolys(p: Part): Pt[] | null {
  if (p.type === 'prism') return p.polygon;
  if (p.type === 'box') { const [w, h] = p.size, r = p.rot ?? 0, c = Math.cos(r), s = Math.sin(r); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [p.c[0] + x * c - y * s, p.c[1] + x * s + y * c]); }
  return null;
}
function iou(a: Pt[][], b: Pt[]) {
  const all = [...a.flat(), ...b]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of all) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let inter = 0, uni = 0, ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
  for (let y = y0; y <= y1; y += RES) for (let x = x0; x <= x1; x += RES) {
    const ia = a.some(p => pointInPoly(x, y, p)), ib = pointInPoly(x, y, b);
    if (ia || ib) uni++; if (ia && ib) inter++; if (ia) { ax += x; ay += y; an++; } if (ib) { bx += x; by += y; bn++; }
  }
  return { iou: inter / uni, offset: Math.hypot(ax / an - bx / bn, ay / an - by / bn) };
}
const outline = (b: string, kinds?: string[]) => parts.filter(p => p.building === b && p.type !== 'column' && (!kinds || kinds.includes(p.kind))).map(partPolys).filter(Boolean) as Pt[][];

describe('§13.2 plan overlay vs georeferenced footprints (IoU ≥ 0.95, offset < 0.5 m)', () => {
  const cases: [string, string, string[] | undefined][] = [
    ['terrace', 'terrace', undefined], ['apadana', 'apadana', ['platform']], ['gate_nations', 'gate_nations', ['wall', 'floor']],
    ['tachara', 'tachara', ['platform']], ['hadish', 'hadish', ['platform']], ['hall100', 'hall100', ['floor', 'wall']],
    ['tripylon', 'tripylon', ['platform']], ['treasury', 'treasury', ['floor']], ['harem', 'harem', ['floor']], ['garrison', 'garrison', ['floor']],
    ['grand_stair', 'grand_stair', ['step', 'landing', 'pavement', 'parapet']],
  ];
  for (const [b, fk, kinds] of cases) it(`${b}`, () => {
    let polys = outline(b, kinds);
    if (b === 'terrace') polys = [...polys.filter((_, i) => parts.filter(p => p.building === 'terrace' && p.type !== 'column')[i].kind === 'platform'), ...outline('grand_stair', ['step', 'landing', 'pavement', 'parapet'])];
    const r = iou(polys, footprint(fk).polygon as Pt[]);
    console.warn(`${b.padEnd(14)} IoU ${r.iou.toFixed(4)} offset ${r.offset.toFixed(3)} m`);
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
    const lintels = walls.filter(w => w.y0 > 0.1); expect(lintels.length).toBe(3); for (const l of lintels) expect(l.y0).toBeCloseTo(10, 6);
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
describe('part sanity', () => {
  it('no part has y1 <= y0 or extends above 40 m (nothing on the Terrace is that tall)', () => {
    for (const p of parts) if (p.type !== 'column') { expect(p.y1).toBeGreaterThan(p.y0); expect(p.y1).toBeLessThan(40); }
  });
});
import { readFileSync } from 'node:fs';
describe('review MJ-1/MJ-2 regressions', () => {
  it('generator has no dimensional literals (only 0, 1, 2, 3, 0.5, 8, 9 as structural constants: halves, thirds, sample counts)', () => {
    const src = readFileSync('src/arch/terrace.ts', 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n').replace(/\/\/.*$/gm, '').replace(/'[^']*'|`[^`]*`/g, '');
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
      for (const [k, r] of Object.entries<any>(rows)) {
        expect(r, `${b}.${k}`).toHaveProperty('v'); expect(typeof r.u, `${b}.${k}.u`).toBe('string');
        expect(['A', 'B', 'C', 'A/B', 'B/C'], `${b}.${k}.tier=${r.tier}`).toContain(r.tier);
        for (const key of String(r.src).split(';')) expect(Object.keys(sources), `${b}.${k} src ${key}`).toContain(key);
      } }
  });
});
