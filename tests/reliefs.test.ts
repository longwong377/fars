// Carved low-relief figures (D-019): metadata, carving depth, figure height vs register, normals, placement, triangle budget.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildReliefs, apadanaFacades, buildPhase4Reliefs } from '../src/arch/decor';
import { phase4Programmes } from '../src/arch/relief_programmes';
import { ATTENDANT_SCALE, ROUGH, baseKind } from '../src/arch/relief_figures';
import { RELIEF_KINDS, FIGURE_KINDS, DELEGATIONS, ReliefSet, RELIEF_LODS, reliefLodMesh, lodGeometry, lodGrid, updateReliefs, buildRegister, planFacade, planAudience, facadeItems, genStats, RELIEF_META, PIGMENT } from '../src/arch/reliefs';
import type { Placement } from '../src/arch/reliefs';
import { kindBounds, figureDef, CANOPY_H } from '../src/arch/relief_figures';
import { rasterize, rtinErrors, extractLod, poly, SILHOUETTE_ERROR } from '../src/arch/relief_field';
import type { FigureDef } from '../src/arch/relief_field';
import { srgbToLinear } from '../src/core/colour';
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

// ---------------- Phase 4 programmes (D-049) and the far representation (D-048) ----------------
describe('Phase 4 relief programmes (D-049)', () => {
  const { doorways } = buildTerrace();
  const progs = phase4Programmes(doorways), byName = (n: string) => progs.find(p => p.name === n)!;
  const count = (p: { items: any[] }, k: string) => p.items.filter(i => i.kind === k).length;
  it('the attested motifs are carved where the research puts them', () => {
    const ts = byName('relief:tachara-stair'); expect(count(ts, 'servant')).toBeGreaterThanOrEqual(20); expect(count(ts, 'guard')).toBe(8); expect(count(ts, 'lion_bull')).toBe(2);
    expect(ts.inscriptions.map(i => i.id)).toEqual(['XPc']);
    const hs = byName('relief:hadish-stairs'); expect(count(hs, 'servant')).toBeGreaterThanOrEqual(20); expect(count(hs, 'guard')).toBeGreaterThanOrEqual(12); expect(hs.inscriptions.map(i => i.id)).toEqual(['XPd']);
    const tr = byName('relief:tripylon-stair'); expect(count(tr, 'persian') + count(tr, 'mede')).toBeGreaterThanOrEqual(20);
    for (const [k, n] of [['winged_disc', 1], ['sphinx', 2], ['palm', 2]] as const) expect(count(tr, k), k).toBe(n);
    expect(tr.items.filter(i => i.kind === 'lion_bull').every(i => (i.meta as any).tier === 'C')).toBe(true); // corners NOT SEEN
    const at = (b: string, door: string) => byName(`relief:${b}-jambs`).items.filter(i => String((i.meta as any).where).startsWith(`${b}:${door} `));
    expect(at('tachara', 'S_main').map(i => i.kind)).toEqual(['king_attendants', 'king_attendants']);
    expect(at('tachara', 'N_W').map(i => [i.kind, i.seed])).toEqual([['hero', 0], ['hero', 2]]); // lion / monster
    expect(at('harem', 'E').every(i => i.kind === 'hero' && i.seed === 2)).toBe(true); expect(at('harem', 'W').every(i => i.kind === 'hero' && i.seed === 0)).toBe(true);
    expect(at('hadish', 'S')).toEqual([]); // no programme found: left plain
    const te = at('tripylon', 'E'); expect(te.filter(i => i.kind === 'bearer').length).toBeGreaterThanOrEqual(12); expect(te.filter(i => i.kind === 'dais').length).toBe(2); expect(te.filter(i => i.kind === 'king').length).toBe(2);
    const h100 = byName('relief:hall100-jambs'); expect(h100.items.length).toBeGreaterThan(40); expect(h100.items.every(i => i.kind.endsWith(ROUGH))).toBe(true); // blocked out in 467
    for (const p of progs) for (const i of p.items) { expect(['A', 'B', 'C']).toContain((i.meta as any).tier); expect(String((i.meta as any).programme).length).toBeGreaterThan(2); }
    expect(ATTENDANT_SCALE).toBe(v<any>('global', 'r_jamb_relief').attendant_scale);
  });
  it('jamb figures stand on the reveal of their doorway, within its depth and height, walking into the hall', () => {
    for (const p of progs.filter(q => q.name.endsWith('-jambs'))) for (const it of p.items) {
      const id = String((it.meta as any).where).split(' ')[0], d = doorways.find(q => q.id === id)!;
      const e = it.o.x, n = -it.o.z, along = (e - d.c[0]) * d.u[0] + (n - d.c[1]) * d.u[1], across = (e - d.c[0]) * d.n[0] + (n - d.c[1]) * d.n[1];
      expect(Math.abs(Math.abs(along) - d.width / 2), `${id} ${it.kind} on a reveal`).toBeLessThan(1e-6);
      const zg = [it.Z.x, -it.Z.z], xg = [it.X.x, -it.X.z];
      expect(zg[0] * -Math.sign(along) * d.u[0] + zg[1] * -Math.sign(along) * d.u[1], 'faces the opening').toBeCloseTo(1, 6);
      const b = kindBounds(baseKind(it.kind), it.seed), sx = it.mirror ? -1 : 1, xn = xg[0] * d.n[0] + xg[1] * d.n[1];
      const half = d.depth / 2 + d.proj + 1e-6;
      for (const x of [b[0], b[2]]) expect(Math.abs(across + sx * x * it.S * xn), `${id} ${it.kind} within the jamb depth`).toBeLessThanOrEqual(half);
      expect(it.o.y + b[1] * it.S, `${id} ${it.kind} above the floor`).toBeGreaterThanOrEqual(d.y0 - 1e-6);
      expect(it.o.y + b[3] * it.S, `${id} ${it.kind} below the lintel`).toBeLessThanOrEqual(d.y0 + d.height + 1e-6);
      expect(sx * xn, `${id} ${it.kind} walks into the hall`).toBeGreaterThan(0);
    }
  });
  it('relief depths stay within r_relief_carving; blocked-out figures carry no paint', () => {
    for (const p of progs) for (const it of p.items) { const peak = it.D * reliefLodMesh(it.kind, it.seed, 65, 3).maxH; expect(peak).toBeLessThanOrEqual(CV.depth_max + 1e-9); expect(peak).toBeGreaterThanOrEqual(CV.depth_min * 0.8); }
    for (const k of ['king~rough', 'bearer~rough', 'hero~rough']) { const m = reliefLodMesh(k, 1, 129, 2); expect(Math.max(...m.paint), k).toBe(0); expect(m.tris).toBeGreaterThan(50); }
  });
  it(`all relief sets: ≤ ${TRI_BUDGET / 1e6} M relief triangles in front of every Phase 4 jamb and stair face; a far set collapses to one draw`, () => {
    const p4 = buildPhase4Reliefs(doorways).group, sets = [set, ...p4.children.filter(c => c instanceof ReliefSet) as ReliefSet[]];
    let worst = 0, where = '';
    const probe = (e: number, n: number, y: number, what: string) => { updateReliefs(new THREE.Vector3(e, y, -n), 1e9); const t = sets.reduce((s, q) => s + q.stats.tris, 0); if (t > worst) { worst = t; where = what; } };
    for (const d of doorways.filter(q => q.framed)) for (const off of [0, 1.2]) for (const s of [-1, 1]) probe(d.c[0] + d.u[0] * s * (d.width / 2 - 0.4) - d.n[0] * off, d.c[1] + d.u[1] * s * (d.width / 2 - 0.4) - d.n[1] * off, d.y0 + 1.6, `${d.id} jamb ${s} off ${off}`);
    for (const p of progs.filter(q => q.name.endsWith('stair'))) for (const it of p.items.filter((_, i) => i % 3 === 0)) for (const off of [1.2, 4]) probe(it.o.x + it.Z.x * off, -(it.o.z + it.Z.z * off), it.o.y + 1.2, `${p.name} off ${off}`);
    console.warn(`all relief sets: worst ${worst} triangles at ${where}`);
    expect(worst).toBeLessThanOrEqual(TRI_BUDGET);
    // from the Grand Stair foot every set is far: one merged mesh per set, no figure in any batch, no shadow proxy
    updateReliefs(new THREE.Vector3(-60, 1.6, -122), 1e9);
    let draws = 0, chunks = 0; for (const s of sets) { draws += s.stats.draws; chunks += s.stats.chunks; expect(s.stats.byLod.reduce((a, b) => a + b, 0), s.name).toBe(0); expect(s.stats.proxies).toBe(0); expect(s.stats.farDraws, s.name).toBe(1); }
    console.warn(`from the Grand Stair foot: ${draws} relief draws for ${sets.reduce((q, s) => q + s.items.length, 0)} figures in ${chunks} chunks`);
    expect(draws).toBeLessThanOrEqual(3 * sets.length); // the set mesh and at most the two rosette meshes
    // before the Tachara S stair: its near chunk is in the batch with a shadow proxy; the Apadana stays merged
    updateReliefs(new THREE.Vector3(-21, 1.6, 103), 1e9);
    const ts = sets.find(s => s.name === 'relief:tachara-stair')!; expect(ts.stats.byLod.reduce((a, b) => a + b, 0)).toBeGreaterThan(0); expect(ts.stats.proxies).toBeGreaterThan(0);
    expect(set.stats.farChunks).toBe(set.stats.chunks); expect(set.stats.farDraws).toBe(1);
    expect(ts.stats.farDraws).toBe(ts.stats.farChunks); expect(ts.stats.farChunks).toBeLessThan(ts.stats.chunks); // partly near: one draw per far chunk
  });
});

// ---------------- D-204: the audience panel recomposed; the carved edge (anti-aliased, cut back, refined, painted to its foot) ----------------
describe('the audience panel (D-204)', () => {
  const AP = v<any>('apadana', 'r_audience_panel'), figH = R.height * CV.figure_fill, plan = planAudience();
  const scene = plan.figures.filter(p => Math.abs(p.along) < AP.width / 2 && p.kind !== 'canopy');
  it('the Treasury audience composition, left to right, centred within the panel', () => {
    expect(scene.map(p => p.kind)).toEqual(['guard', 'weapon_bearer', 'attendant', 'crown_prince', 'king', 'incense_burner', 'incense_burner', 'official', 'guard']);
    expect(scene.find(p => p.kind === 'attendant')!.variant % 4, 'the attendant carries the towel').toBe(2);
    expect(scene.map(p => p.facing)).toEqual([1, 1, 1, 1, 1, 1, 1, -1, -1]);
    for (const p of scene) {
      const b = kindBounds(p.kind, p.variant), S = figH * p.scale;
      for (const x of [b[0], b[2]]) expect(Math.abs(p.along + p.facing * x * S), `${p.kind} within the panel`).toBeLessThanOrEqual(AP.width / 2);
      expect(p.y).toBe(R.bottom);
    }
  });
  it('hierarchic scale: standing figures fill figure_of_panel of the height, the seated king reaches their heads, the canopy above them', () => {
    const top = (p: Placement) => p.y + kindBounds(p.kind, p.variant)[3] * figH * p.scale;
    const standing = scene.filter(p => ['guard', 'weapon_bearer', 'attendant', 'crown_prince', 'official'].includes(p.kind)), king = scene.find(p => p.kind === 'king')!;
    for (const p of standing) expect((top(p) - R.bottom) / AP.height, p.kind).toBeGreaterThan(AP.figure_of_panel * 0.85); // a headband stands lower than tall headgear
    const headLine = Math.max(...standing.map(top));
    expect(headLine - R.bottom).toBeLessThanOrEqual(AP.figure_of_panel * AP.height * 1.01); // a spear tip or crown may pass the unit height by a little
    expect(Math.abs(top(king) - headLine) / (headLine - R.bottom), 'the king\'s crown at the standing figures\' heads').toBeLessThan(0.05);
    const can = plan.figures.filter(p => p.kind === 'canopy'), Ls = AP.width / AP.canopy.segments;
    expect(can.length).toBe(AP.canopy.segments);
    expect(CANOPY_H).toBe(AP.canopy.rel_height);
    for (const c of can) {
      expect(c.y, 'the canopy above the heads').toBeGreaterThan(headLine);
      expect(c.y + CANOPY_H * figH * c.scale, 'the canopy under the panel\'s top').toBeLessThanOrEqual(R.bottom + AP.height + 1e-6);
      expect(figH * c.scale).toBeCloseTo(Ls, 9); expect(c.minLod).toBe(1);
    }
    const xs = can.map(c => c.along).sort((a, b) => a - b);
    expect(xs[0] - Ls / 2).toBeCloseTo(-AP.width / 2, 9); expect(xs[xs.length - 1] + Ls / 2).toBeCloseTo(AP.width / 2, 9);
  });
  it('the canopy segments tile: the band meets itself across the segment ends', () => {
    const f = rasterize(figureDef('canopy', 0), 257), n = f.n; let worst = 0;
    for (let j = 0; j < n; j++) { const a = f.h[j * n], b = f.h[j * n + n - 1]; if (a > 0 || b > 0) worst = Math.max(worst, Math.abs(a - b)); }
    expect(worst, 'height mismatch at the seam (relief-depth units)').toBeLessThan(0.03);
  });
  it('a canopy item is never drawn at L0', () => {
    const it = facadeItems(apadanaFacades(manifest)[0], plan).items.find(i => i.kind === 'canopy')!;
    const rs = new ReliefSet([it]); updateReliefs(it.o.clone().addScaledVector(it.Z, 0.3), 1e9);
    expect(rs.stats.byLod[0]).toBe(0); expect(rs.stats.byLod[1]).toBeGreaterThan(0); rs.dispose();
  });
});

describe('the carved edge (D-204)', () => {
  // a plain rectangle whose right edge falls between grid points, meshed at the L2 grid and error bound
  const rect: FigureDef = { masses: [{ add: [poly([[-0.2, 0.1], [0.2123, 0.1], [0.2123, 0.9], [-0.2, 0.9]])], amp: 0.6, round: 0.03, edge: 0.5, colour: PIGMENT.cinnabar }], bounds: [-0.5, 0, 0.5, 1] };
  const f = rasterize(rect, 129, true), L2 = RELIEF_LODS[2], m = extractLod(f, rtinErrors(f), L2.err, L2.grad);
  const col = Math.round((0.2123 - f.x0) / f.cell) * f.cell + f.x0;
  const near = (x: number) => { const out: number[] = []; for (let q = 0; q < m.verts; q++) if (Math.abs(m.pos[q * 3] - x) < f.cell * 0.5 && m.pos[q * 3 + 1] > 0.2 && m.pos[q * 3 + 1] < 0.8) out.push(q); return out; };
  it('the step is anti-aliased: the height of the outline column rises smoothly as the outline moves across it', () => {
    const i = Math.round((0.2123 - f.x0) / f.cell), j = Math.round((0.5 - f.y0) / f.cell), x = f.x0 + i * f.cell, hs: number[] = [];
    for (let k = -4; k <= 4; k++) {
      const e = x + (k / 10) * f.cell, g = rasterize({ ...rect, masses: [{ ...rect.masses[0], add: [poly([[-0.2, 0.1], [e, 0.1], [e, 0.9], [-0.2, 0.9]])] }] }, 129, true);
      hs.push(g.h[j * g.n + i]);
    }
    for (let k = 1; k < hs.length; k++) { expect(hs[k], `outline at +${k - 4}/10 cell`).toBeGreaterThan(hs[k - 1]); expect(hs[k] - hs[k - 1]).toBeLessThan(0.35 * (hs[hs.length - 1] - hs[0])); }
  });
  it('the background at the foot is cut back below the wall face, and every grid row of the outline is in the mesh (straight silhouette)', () => {
    let feet = 0; for (let q = 0; q < m.verts; q++) if (m.pos[q * 3 + 2] < 0) feet++;
    expect(feet).toBeGreaterThan(100);
    const rows = new Set(near(col + f.cell).filter(q => m.pos[q * 3 + 2] < 0).map(q => Math.round(m.pos[q * 3 + 1] / f.cell)));
    expect(rows.size, 'a cut-back foot vertex on every row between y 0.2 and 0.8').toBeGreaterThanOrEqual(Math.floor(0.6 / f.cell) - 1);
  });
  it('the normals along a straight outline agree (no sawtooth of light and shade)', () => {
    const g = near(col).map(q => m.grad[q * 2]);
    const mean = g.reduce((a, b) => a + b, 0) / g.length, sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) ** 2, 0) / g.length);
    expect(Math.abs(mean)).toBeGreaterThan(1);
    expect(sd / Math.abs(mean), 'spread of the outline normals').toBeLessThan(0.05);
  });
  it('the step is painted to its foot: the background vertices of a LOD mesh take the paint of the carving beside them', () => {
    let feet = 0, painted = 0; const red = PIGMENT.cinnabar.map(srgbToLinear);
    for (let q = 0; q < m.verts; q++) if (m.pos[q * 3 + 2] <= 0) { feet++; if (m.paint[q] > 0 && Math.abs(m.col[q * 3] - red[0]) < 1e-6) painted++; }
    expect(painted / feet).toBeGreaterThan(0.95);
  });
  it('surface detail survives the coarse LODs, prefiltered (it was dropped beyond 4 m)', () => {
    const def = figureDef('persian', 0), bare: FigureDef = { ...def, masses: def.masses.map(q => ({ ...q, detail: undefined })) };
    const a = rasterize(def, 129, true), b = rasterize(bare, 129, true); let d2 = 0, k = 0;
    for (let q = 0; q < a.h.length; q++) if (a.h[q] > 0 && b.h[q] > 0) { d2 += (a.h[q] - b.h[q]) ** 2; k++; }
    expect(Math.sqrt(d2 / k), 'RMS of the detail at the L2 grid (relief-depth units)').toBeGreaterThan(0.015);
  });
});

describe('the far LODs keep the figure (D-217; rubric s7 pass 2, R2: animals drawn as grey clouds from 8-20 m)', () => {
  it('every LOD keeps the outline cell-exact: its error bound is under the silhouette error', () => {
    for (const [l, L] of RELIEF_LODS.entries()) expect(L.err, `L${l}`).toBeLessThan(SILHOUETTE_ERROR);
  });
  it('a large figure keeps at most 2× its band\'s cell at L2-L4 (the lion-and-bull, 3.26 m across, had 25 and 51 mm cells)', () => {
    const man = buildTerrace().manifest, a = man.apadana as any, face = apadanaFacades(man)[0];
    const items = facadeItems(face, planFacade(face, { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium })).items;
    const lb = items.find(q => q.kind === 'lion_bull')!, b = kindBounds('lion_bull', 0), ext = Math.max(b[2] - b[0], b[3] - b[1]) * lb.S;
    expect(ext).toBeGreaterThan(3);
    for (const l of [2, 3, 4]) expect(ext / (lodGrid(ext, l) - 1), `L${l}`).toBeLessThanOrEqual(2 * RELIEF_LODS[l].cell + 1e-9);
  });
  it('the lion-and-bull at L3 (14-28 m) is a figure, not a cloud: no triangle spans from behind the wall face to the top across more than a cell', () => {
    // a triangle joining the foot's cut-back (behind the face) to the figure's top over several cells is a cloud piece: at L3
    // before D-217 (error bound 0.3 over the silhouette's 0.2) the whole outline was made of them
    const spansOf = (n: number, err: number) => { const f = rasterize(figureDef('lion_bull', 0), n, true), m = extractLod(f, rtinErrors(f), err, 1), cell = f.cell; let spans = 0;
    for (let t = 0; t < m.index.length; t += 3) { const q = [0, 1, 2].map(k => m.index[t + k]), z = q.map(k => m.pos[k * 3 + 2]); if (Math.min(...z) >= -0.2 || Math.max(...z) <= 0.4) continue;
      const xs = q.map(k => m.pos[k * 3]), ys = q.map(k => m.pos[k * 3 + 1]); if (Math.max(...xs) - Math.min(...xs) > 2.5 * cell || Math.max(...ys) - Math.min(...ys) > 2.5 * cell) spans++; }
      return spans; };
    const now = spansOf(lodGrid(3.26, 3), RELIEF_LODS[3].err), before = spansOf(65, 0.3);
    console.log(`lion-and-bull L3: cloud triangles ${before} before D-217 (65², bound 0.3), ${now} now`);
    expect(before).toBeGreaterThan(10); expect(now).toBe(0);
  });
  it('the carving shades its own contours: sky occlusion at the foot of a step, none on the open top', () => {
    const rect: FigureDef = { masses: [{ add: [poly([[-0.2, 0.1], [0.2, 0.1], [0.2, 0.9], [-0.2, 0.9]])], amp: 0.6, round: 0.03, edge: 0.5, colour: PIGMENT.cinnabar }], bounds: [-0.5, 0, 0.5, 1] };
    const f = rasterize(rect, 257, false), m = extractLod(f, rtinErrors(f), RELIEF_LODS[1].err, 1);
    let foot = 0, top = 0, nf = 0, nt = 0;
    for (let q = 0; q < m.verts; q++) { const x = m.pos[q * 3], y = m.pos[q * 3 + 1], z = m.pos[q * 3 + 2]; if (y < 0.3 || y > 0.7) continue;
      if (z < 0 && Math.abs(Math.abs(x) - 0.2) < 0.01) { foot += m.ao[q]; nf++; } if (Math.abs(x) < 0.1 && z > 0.5) { top += m.ao[q]; nt++; } }
    expect(nf).toBeGreaterThan(10); expect(nt).toBeGreaterThan(0);
    expect(foot / nf, 'the foot of the contour').toBeGreaterThan(0.2); expect(top / nt, 'the open top').toBeLessThan(0.03);
  });
});
