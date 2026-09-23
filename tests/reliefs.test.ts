// Carved low-relief figures (D-015): metadata, carving depth, figure height vs register, normals, placement, triangle budget.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildReliefs, apadanaFacades } from '../src/arch/decor';
import { RELIEF_KINDS, FIGURE_KINDS, DELEGATIONS, ReliefSet, RELIEF_LODS, reliefLodMesh, lodGeometry, lodGrid, updateReliefs, buildRegister, planFacade, planAudience, genStats, RELIEF_META } from '../src/arch/reliefs';
import { kindBounds, figureDef } from '../src/arch/relief_figures';
import { rasterize } from '../src/arch/relief_field';
import { v } from '../src/arch/spec';
import sources from '../src/data/sources.json';

const { manifest } = buildTerrace();
const t0 = performance.now();
const group = buildReliefs(manifest);
const buildMs = performance.now() - t0, buildGen = genStats.generated;
const set = group.children.find(c => c instanceof ReliefSet) as ReliefSet;
const R = v<any>('apadana', 'r_registers'), CV = v<any>('apadana', 'r_relief_carving'), DEPTH = v<number>('apadana', 'r_relief_depth');
/** stated budget: relief triangles submitted for any camera position along the Apadana stair façades (before frustum culling) */
const TRI_BUDGET = 1_500_000;

describe('relief figure kinds', () => {
  it('every kind carries tier, sources (known keys) and a note', () => {
    expect(RELIEF_KINDS.length).toBeGreaterThanOrEqual(25);
    for (const k of RELIEF_KINDS) {
      const info = FIGURE_KINDS[k];
      expect(['A', 'B', 'C'], k).toContain(info.tier);
      for (const key of info.src.split(';')) expect(Object.keys(sources), `${k} src ${key}`).toContain(key);
      expect(info.note.length, k).toBeGreaterThan(10);
    }
    for (const d of DELEGATIONS) { expect(['B', 'C']).toContain(d.tier); expect(d.note.length).toBeGreaterThan(5); }
    expect(DELEGATIONS.length).toBe(23);
  });
  it('the figure kinds the brief asks for exist', () => {
    for (const k of ['guard', 'mede_guard', 'persian', 'mede', 'usher', 'delegate', 'servant', 'horse', 'bull', 'camel_bactrian', 'dromedary', 'ram', 'lion_bull', 'winged_disc', 'sphinx', 'cypress'])
      expect(RELIEF_KINDS, k).toContain(k);
  });
  it('meshes carry placeholder status and tier C in userData', () => {
    expect(RELIEF_META.tier).toBe('C'); expect(RELIEF_META.placeholder).toBe(true); expect(RELIEF_META.note).toMatch(/procedural low relief; licensed scans would replace \(NEEDS #10\)/);
    group.traverse(o => { if ((o as any).isMesh || (o as any).isBatchedMesh) { if (o.name.startsWith('relief')) { expect(o.userData.tier, o.name).toBe('C'); expect(o.userData.placeholder, o.name).toBe(true); } } });
  });
  it('every kind (and every delegation member) generates finite heights, colours and normals at a coarse grid', () => {
    const cases: [string, number][] = RELIEF_KINDS.map(k => [k, 0]);
    for (let d = 0; d < DELEGATIONS.length; d++) for (let m = 0; m < 3; m++) cases.push(['delegate', d * 10 + m]);
    for (let s = 0; s < 8; s++) cases.push(['servant', s], ['attendant', s]);
    for (const [k, s] of cases) {
      const m = reliefLodMesh(k, s, 65, 3), g = lodGeometry(m, s % 2 === 1);
      expect(m.tris, `${k}:${s}`).toBeGreaterThan(8);
      for (const name of ['position', 'normal', 'color']) { const a = g.getAttribute(name).array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error(`${k}:${s} ${name} not finite`); }
      const n = g.getAttribute('normal').array; for (let i = 0; i < n.length; i += 3) expect(n[i + 2], `${k}:${s} normal faces out of the wall`).toBeGreaterThan(0);
      expect(m.maxH, `${k}:${s} height ≤ relief depth`).toBeLessThanOrEqual(1.0001);
    }
  });
  it('normals at the finest LOD come from the heightfield and are finite for the Apadana kinds', () => {
    for (const k of ['guard', 'mede', 'horse', 'lion_bull']) {
      const g = lodGeometry(reliefLodMesh(k, 0, 257, 1), false), n = g.getAttribute('normal').array;
      let tilted = 0; for (let i = 0; i < n.length; i += 3) { expect(Number.isFinite(n[i]) && Number.isFinite(n[i + 1]) && Number.isFinite(n[i + 2])).toBe(true); if (n[i + 2] < 0.9) tilted++; }
      expect(tilted / (n.length / 3), `${k}: modelled (not flat) surface`).toBeGreaterThan(0.2);
    }
  });
  it('the carving is a heightfield with a crisp outline and rounded modelling (not a flat extrusion)', () => {
    const f = rasterize(figureDef('persian', 0), 257), hs = Array.from(f.h).filter(h => h > 0).sort((a, b) => a - b);
    const q = (p: number) => hs[Math.floor(p * (hs.length - 1))];
    expect(q(0.95) - q(0.1), 'a range of heights across the figure').toBeGreaterThan(0.25);
    expect(q(0.99)).toBeLessThanOrEqual(1);
  });
});

describe('Apadana stair reliefs', () => {
  it(`startup: coarse LOD for every figure (${Math.round(buildMs)} ms incl. ${buildGen} meshes; tests run without workers)`, () => {
    console.warn(`buildReliefs ${buildMs.toFixed(0)} ms, ${set.items.length} figures, ${new Set(set.items.map(i => i.kind + '|' + i.seed)).size} unique figures, ${buildGen} meshes generated`);
    expect(set.items.length).toBeGreaterThan(400);
    expect(buildMs).toBeLessThan(20_000); // sanity bound for slow CI; the browser generates in workers
  });
  it('relief projection depth is within the r_relief_carving range (r_relief_depth for register figures)', () => {
    for (const it of set.items) {
      const m = reliefLodMesh(it.kind, it.seed, 129, 2), peak = it.D * m.maxH;
      expect(peak, `${it.kind} peak projection`).toBeLessThanOrEqual(CV.depth_max + 1e-9);
      expect(peak, `${it.kind} peak projection`).toBeGreaterThanOrEqual(CV.depth_min);
      if (Math.abs(it.S - R.height * CV.figure_fill) < 1e-9) expect(it.D).toBeCloseTo(DEPTH, 9);
    }
  });
  it('register figures stand on the register ground line and fill the register height', () => {
    const regY = Array.from({ length: R.count }, (_, r) => R.bottom + r * (R.height + R.gap));
    let persons = 0;
    for (const it of set.items) {
      if (Math.abs(it.S - R.height * CV.figure_fill) > 1e-9 || FIGURE_KINDS[it.kind].group !== 'person') continue;
      persons++;
      const b = kindBounds(it.kind, it.seed), y0 = it.o.y + b[1] * it.S, y1 = it.o.y + b[3] * it.S;
      const base = regY.find(y => Math.abs(it.o.y - y) < 1e-6);
      expect(base, `${it.kind} on a register line`).toBeDefined();
      expect(y0 - base!, `${it.kind} feet at the ground line`).toBeGreaterThan(-0.02);
      expect(y1 - base!, `${it.kind} top within the register`).toBeLessThanOrEqual(R.height + 1e-6);
      expect(y1 - base!, `${it.kind} fills the register`).toBeGreaterThan(R.height * 0.8); // bare heads are lower than tall headgear
    }
    expect(persons).toBeGreaterThan(200);
  });
  it('the programme: 3 registers of nobles and guards, delegations led by ushers with cypresses, lion-and-bull on every flight', () => {
    const a = manifest.apadana as any, sg = { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium };
    for (const f of apadanaFacades(manifest)) {
      const p = planFacade(f, sg), n = (k: string) => p.figures.filter(x => x.kind === k).length;
      expect(n('usher')).toBeGreaterThanOrEqual(12); expect(n('guard')).toBeGreaterThan(10); expect(n('persian') + n('mede')).toBeGreaterThan(30);
      expect(n('lion_bull')).toBe(sg.spans.filter((s: any) => s.type === 'flight').length);
      for (const u of p.figures.filter(x => x.kind === 'usher')) expect(p.figures.some(x => x.kind === 'delegate' && x.variant === u.variant * 10 && Math.abs(x.along - u.along) < 0.5 && x.y === u.y)).toBe(true);
      // the lion-and-bull stays inside the triangle under the slope
      for (const lb of p.figures.filter(x => x.kind === 'lion_bull')) {
        const s = sg.spans.find((q: any) => lb.along >= q.a0 && lb.along <= q.a1)!, b = kindBounds('lion_bull', 0), S = R.height * CV.figure_fill * lb.scale;
        const low = s.rise > 0 ? s.a0 : s.a1, xs = [b[0], b[2]].map(x => lb.along + lb.facing * x * S), d = xs.map(x => Math.abs(x - low));
        const top = Math.min(...d) * sg.riser / sg.tread + sg.parapet;
        expect(lb.y + b[3] * S, 'lion-bull below the parapet at its low end').toBeLessThan(top + 0.35);
      }
      expect(planAudience().figures.some(x => x.kind === 'king')).toBe(true);
    }
  });
  it(`triangle budget: ≤ ${TRI_BUDGET / 1e6} M relief triangles from any camera position along the façades; finest LOD only near`, () => {
    let worst = 0, at = '';
    for (const f of apadanaFacades(manifest)) for (let a = -f.length / 2; a <= f.length / 2; a += 4) for (const off of [1.2, 4, 15]) {
      const cam = new THREE.Vector3(f.origin[0] + f.along[0] * a + f.normal[0] * off, 1.6, -(f.origin[1] + f.along[1] * a + f.normal[1] * off));
      updateReliefs(cam, 1e9);
      if (set.stats.tris > worst) { worst = set.stats.tris; at = `${f.id} a=${a.toFixed(1)} off=${off}: L0..L3 ${set.stats.byLod.join(' / ')}, rosettes ${set.stats.rosetteTris}`; }
      if (off === 15) expect(set.stats.byLod[0], 'no finest-LOD figure 15 m away').toBe(0);
    }
    console.warn(`relief triangles, worst case ${worst} at ${at}; LOD bands ${RELIEF_LODS.map(l => l.dist).join(' / ')} m`);
    expect(worst).toBeLessThanOrEqual(TRI_BUDGET);
    expect(worst).toBeGreaterThan(100_000);
  });
  it('batched geometry has finite normals and no degenerate NaN positions after LOD switches', () => {
    const bm = set.batch!, n = bm.geometry.getAttribute('normal').array, p = bm.geometry.getAttribute('position').array;
    const used = (bm as any)._nextVertexStart * 3;
    for (let i = 0; i < used; i++) { if (!Number.isFinite(n[i])) throw new Error('NaN normal at ' + i); if (!Number.isFinite(p[i])) throw new Error('NaN position at ' + i); }
  });
});

describe('generic register API', () => {
  it('buildRegister places figures along any wall span, scaled to the register height, walking in the given direction', () => {
    const reg = buildRegister({ start: [10, 2, -5], dir: [0, 0, -1], length: 6, height: 1.2, facing: -1, figures: [{ kind: 'servant', seed: 0 }, { kind: 'servant', seed: 1 }, { kind: 'servant', seed: 2 }, { kind: 'guard' }], slope: 0.1, rosettes: 'below' });
    expect(reg.items.length).toBe(4);
    const figH = 1.2 * CV.figure_fill;
    for (const it of reg.items) {
      expect(it.S).toBeCloseTo(figH, 9); expect(it.mirror).toBe(true); expect(it.o.x).toBeCloseTo(10, 9);
      expect(it.Z.x).toBeCloseTo(1, 9); // dir (0,0,-1) × up = +x: out of the wall toward the viewer
      const along = -(it.o.z + 5); expect(it.o.y).toBeCloseTo(2 + 0.1 * along, 9); // climbing a slope
    }
    // leader first: facing −1 → the leader stands nearest the start (left end)
    expect(-(reg.items[0].o.z + 5)).toBeLessThan(-(reg.items[1].o.z + 5));
    updateReliefs(new THREE.Vector3(12, 3, -8), 1e9);
    expect(reg.stats.tris).toBeGreaterThan(1000);
    reg.dispose();
  });
  it('unknown kinds are rejected', () => {
    expect(() => buildRegister({ start: [0, 0, 0], dir: [1, 0, 0], length: 2, height: 1, facing: 1, figures: [{ kind: 'not_a_kind' }] })).toThrow();
  });
});
