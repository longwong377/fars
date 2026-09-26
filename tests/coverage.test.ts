// Coverage harness (D-235): the sampler covers every walkable area with points on walkable ground, deterministically, and
// the committed sample is in sync; the ID pass's override shaders generate WGSL (node, no GPU); the F3 records resolve
// placeholders as the dev overlay does (per face in merged meshes); the frame analysis finds flat regions, sky holes,
// tiling and low detail on synthetic buffers; the report aggregates and ranks worst-first; scene variety flags identical days.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { texture, positionLocal, vec3 } from 'three/tsl';
import { execFileSync } from 'node:child_process';
import { samplePoints, seedOf, loadWorld, onNav, townCells, slopeDeg, allocate, AREA_WEIGHTS, TOWN_WEIGHTS, PLAIN_WEIGHTS, FAR_WEIGHTS, BUILT_EDGES, MAX_SLOPE, type CovFile } from '../tools/dev/coverage_points';
import { HOUR_BANDS, WEATHERS, classifyBand, classifyWeather, yearTable, pairCoverage } from '../tools/dev/coverage_time';
import { gateMetrics } from '../src/dev/coverage';
import { cell, validate, viewGate, thresholds } from '../tools/dev/coverage_report';
import { CoveragePass, analyseFrame, idShares, type CovEntry } from '../src/dev/coverage';
import { aggregate, varietyOf, score, normKey, reportMd, type Rec } from '../tools/dev/coverage_report';

let A: CovFile;
const F: CovFile = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8'));
beforeAll(() => { A = samplePoints(F.meta.seed, F.meta.commit); }, 180_000);

describe('coverage sampler', () => {
  it('represents every area and sub-area, with the written weights', () => {
    const subs = new Set(A.points.map(p => p.sub)), areas = new Set(A.points.map(p => p.area));
    for (const a of Object.keys(AREA_WEIGHTS)) expect(areas.has(a as any), a).toBe(true);
    for (const s of [...Object.keys(TOWN_WEIGHTS), ...Object.keys(PLAIN_WEIGHTS), ...Object.keys(FAR_WEIGHTS), 'approach', 'terrace:stairs', 'terrace:open', 'rahmat:slopes']) expect(subs.has(s), s).toBe(true);
    for (const E of BUILT_EDGES) expect(subs.has(`edge:${E.id}:in`), E.id).toBe(true);
    // the Terrace's buildings each have a stratum (interiors included: Treasury, Harem, garrison, Gate, halls)
    for (const b of ['apadana', 'tachara', 'hadish', 'hall100', 'tripylon', 'treasury', 'harem', 'garrison', 'gate_nations']) expect([...subs].some(s => s.startsWith(`terrace:${b}:`)), b).toBe(true);
    const first = A.points.filter(p => !p.revisit), base = Object.values(AREA_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(first.length - base)).toBeLessThanOrEqual(12); // edges and the mountain foot shift a few
    expect(first.filter(p => p.area === 'terrace').length).toBe(AREA_WEIGHTS.terrace);
    expect(first.filter(p => p.area === 'town').length).toBe(AREA_WEIGHTS.town);
  });
  it('puts every point on walkable ground', () => {
    const W = loadWorld(), tc = townCells(W), town = new Set<string>();
    for (const cells of tc.values()) for (const c of cells) { const g = c.site.cellGrid(c.k); town.add(`${Math.round(g[0] * 100) / 100},${Math.round(g[1] * 100) / 100}`); }
    const bad: string[] = [];
    for (const p of A.points) {
      if (p.area === 'terrace' || p.area === 'approach' || p.sub === 'rahmat:foot') { if (!onNav(W, p.e, p.n)) bad.push(`${p.id} ${p.sub} off the walkable grid`); }
      else if (p.area === 'town') { if (!town.has(`${p.e},${p.n}`)) bad.push(`${p.id} ${p.sub} not a reachable town cell`); }
      else if (slopeDeg(W, p.e, p.n) > MAX_SLOPE + 1) bad.push(`${p.id} ${p.sub} slope ${slopeDeg(W, p.e, p.n).toFixed(0)}°`);
      if (p.eye !== 1.6) bad.push(`${p.id} eye ${p.eye}`);
    }
    expect(bad).toEqual([]);
  });
  it('is deterministic by seed; the committed sample is the sampler\'s output for a seed taken from a commit hash in history', () => {
    const B = samplePoints(F.meta.seed, F.meta.commit), C = samplePoints(F.meta.seed + 1);
    expect(JSON.stringify(B)).toBe(JSON.stringify(A));
    expect(JSON.stringify(C.points.map(p => [p.e, p.n]))).not.toBe(JSON.stringify(A.points.map(p => [p.e, p.n])));
    expect(F.meta.seed).toBe(seedOf(F.meta.commit!)); // not a chosen number (MASTER_PLAN §4.2)
    expect(() => execFileSync('git', ['cat-file', '-e', `${F.meta.commit}^{commit}`])).not.toThrow();
    expect(F.points).toEqual(A.points); expect(F.variety).toEqual(A.variety);
    expect(() => seedOf('not-a-hash')).toThrow();
  }, 180_000);
  it('spreads months, hour bands and weathers: every one in every area (T-B1m/h/w), world pairs complete (T-B1p), weather by climate', () => {
    for (const a of Object.keys(AREA_WEIGHTS)) { const P = A.points.filter(p => p.area === a);
      expect(new Set(P.map(p => p.month)).size, a).toBe(12); expect(new Set(P.map(p => p.band)).size, a).toBe(HOUR_BANDS.length); expect(new Set(P.map(p => p.weather)).size, a).toBe(WEATHERS.length); }
    expect(pairCoverage(A.points, Object.keys(AREA_WEIGHTS)).share).toBe(1);
    // weather follows the climate (D-242): ordinary states dominate, rare ones hold their floor
    const n = (w: string) => A.points.filter(p => p.weather === w).length; expect(n('clear') + n('cloud')).toBeGreaterThan(A.points.length * 0.6); expect(n('snow')).toBeGreaterThanOrEqual(6);
    // every view's (day, hour) really has its band and (unless forced) its weather in the simulated year
    const T = yearTable(), at = (d: number, h: number) => T[d * 48 + Math.min(47, Math.floor(h * 2))];
    for (const p of A.points) { const c = at(p.day, p.hour); expect(c.band, p.id).toBe(p.band); if (!p.forced) { expect(c.weather, p.id).toBe(p.weather); expect(p.w).toBe('auto'); } }
    // forced snow only in winter (the simulated year has no snow day: FORCE_MONTHS)
    for (const p of A.points.filter(q => q.weather === 'snow')) expect([12, 1, 2], p.id).toContain(p.month);
    const rev = A.points.filter(p => p.revisit); expect(rev.length).toBeGreaterThan(50);
    for (const r of rev) { const f = A.points.find(p => p.place === r.place && !p.revisit)!; expect(f).toBeTruthy(); expect([r.e, r.n, r.az]).toEqual([f.e, f.n, f.az]);
      const dm = Math.min((r.month - f.month + 12) % 12, (f.month - r.month + 12) % 12); expect(dm, r.id).toBeGreaterThanOrEqual(3); expect(r.band).not.toBe(f.band); }
    expect(A.variety.length).toBe(5); for (const v of A.variety) expect(v.days.length).toBe(3);
    for (let i = 1; i < A.points.length; i++) expect(A.points[i].day * 24 + A.points[i].hour).toBeGreaterThanOrEqual(A.points[i - 1].day * 24 + A.points[i - 1].hour);
    expect(A.meta.interimAreas).toMatch(/INTERIM/); expect(A.extras).toEqual([]);
  });
  it('classifies hour bands and weather states', () => {
    expect(classifyBand(-30, 1, -10, 0.9)).toBe('moonless-night'); expect(classifyBand(-30, 1, 30, 0.9)).toBe('moonlit-night'); expect(classifyBand(-30, 1, 30, 0.3)).toBeNull();
    expect(classifyBand(-10, 5, 0, 0)).toBe('pre-dawn'); expect(classifyBand(2, 6, 0, 0)).toBe('dawn'); expect(classifyBand(40, 12, 0, 0)).toBe('noon'); expect(classifyBand(-10, 19, 0, 0)).toBe('dusk');
    const c = { lightning: false, rain: 0, windMs: 3, snowFall: 0, dust: 0, mist: 0, cloud: 0.1 };
    expect(classifyWeather(c)).toBe('clear'); expect(classifyWeather({ ...c, cloud: 0.5 })).toBe('cloud'); expect(classifyWeather({ ...c, rain: 0.5 })).toBe('rain');
    expect(classifyWeather({ ...c, rain: 0.5, windMs: 12 })).toBe('storm'); expect(classifyWeather({ ...c, rain: 0.5, lightning: true })).toBe('lightning');
  });
  it('allocates exactly, sqrt-weighted with a minimum', () => {
    const a = allocate(20, { big: 10000, mid: 100, small: 1 }, 3); expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(20);
    expect(a.small).toBe(3); expect(a.big).toBeGreaterThan(a.mid);
    const b = allocate(10, { x: 1, y: 3 }, 0, 1); expect(b).toEqual({ x: 3, y: 7 }); // ∝ share (largest remainder: 2.5 → 3, 7.5 → 7)
  });
});

function makeRenderer(): any {
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true; return r;
}
function wgsl(renderer: any, scene: THREE.Scene, camera: THREE.Camera, mesh: THREE.Mesh) {
  const b = new (THREE as any).WGSLNodeBuilder(mesh, renderer); b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = renderer.lighting.getNode(scene, camera); b.build();
  return { vertex: b.vertexShader as string, fragment: b.fragmentShader as string };
}
function pass() {
  const root = new THREE.Group(); root.name = 'world'; const terrain = new THREE.Group(); terrain.name = 'terrain';
  return new CoveragePass({ renderer: null as any, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), root, terrain, world: {}, sunAlt: () => 30, advance: () => {}, tick: async () => {} });
}

describe('coverage ID pass', () => {
  it('override materials generate WGSL: plain, per-face flag, a source vertex stage and a cut-out', () => {
    const renderer = makeRenderer(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 110000), P = pass();
    const g = new THREE.BoxGeometry(1, 1, 1); g.setAttribute('covPh', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 128]), 1, 1); tex.needsUpdate = true;
    const src = new THREE.MeshStandardNodeMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }); src.positionNode = positionLocal.add(vec3(0, 0.1, 0));
    const src2 = new THREE.MeshStandardNodeMaterial({ transparent: true }); src2.opacityNode = texture(tex).a;
    for (const m of [new THREE.Mesh(g, P.matFor(null, false)), new THREE.Mesh(g, P.matFor(null, true)), new THREE.Mesh(g, P.matFor(src, false)), new THREE.Mesh(g, P.matFor(src2, true))]) { // (an InstancedMesh needs a device's limits: not built in node)
      const s = wgsl(renderer, scene, camera, m as THREE.Mesh); expect(s.fragment).toContain('fn main'); }
    expect(P.matFor(null, false)).toBe(P.matFor({ side: THREE.FrontSide, uuid: 'x' }, false)); // plain sources share one override
  });
  it('resolves F3 records like the dev overlay: nearest tier, nearest explicit flag, PLACEHOLDER in the note, per-face flags', () => {
    const P = pass(), root = (P as any).c.root as THREE.Group;
    const grp = new THREE.Group(); grp.name = 'settlement'; root.add(grp);
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); a.userData = { tier: 'C', placeholder: true, note: 'x' }; a.name = 'house'; grp.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); b.userData = { tier: 'C', note: 'boxes: PLACEHOLDER until D-234' }; grp.add(b);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); grp.add(c); grp.userData = { tier: 'B', note: 'honest' };
    expect(P.record(a)).toMatchObject({ key: 'settlement/house', top: 'settlement', ph: true, tier: 'C' });
    expect(P.record(b).ph).toBe(true); expect(P.record(c)).toMatchObject({ ph: false, tier: 'B' });
    // per face: faces 0-5 placeholder, 6-11 honest
    const d = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); const fn = (h: any) => ({ placeholder: h.faceIndex < 6 });
    expect(P.facePh(d, fn, false)).toBe('mixed'); const at = d.geometry.getAttribute('covPh'); expect(at).toBeTruthy();
    const idx = d.geometry.index!; expect(at.getX(idx.getX(0))).toBe(1); expect(at.getX(idx.getX(3 * 11))).toBe(0);
    expect(P.facePh(new THREE.Mesh(new THREE.BoxGeometry()), () => ({ placeholder: false }), true)).toBe(false);
  });
});

const E = (over: Partial<CovEntry>[]): CovEntry[] => [{ id: 0, key: '(sky)', top: 'sky', label: 'sky', ph: false, tier: null, tris: 0, area: 0, density: 0, geo: '', mat: '', instances: 0 },
  ...over.map((o, i) => ({ id: i + 1, key: `k${i + 1}`, top: 't', label: 'l', ph: false, tier: 'C', tris: 12, area: 100, density: 0.12, geo: `g${i}`, mat: `m${i}`, instances: 1, ...o }))];
describe('coverage frame analysis', () => {
  const W = 128, H = 64, N = W * H;
  const elevOf = (horizonRow: number) => { const e = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) e[y * W + x] = (horizonRow - y) * 0.5; return e; };
  it('shares: sky, placeholder and a sky hole below the horizon', () => {
    const ids = new Uint16Array(N), elev = elevOf(20); for (let k = 0; k < N; k++) ids[k] = k < 20 * W ? 0 : 1; // sky above row 20, ground below
    for (let x = 0; x < 10; x++) ids[50 * W + x] = 0; // a hole in the ground
    const s = idShares(ids, E([{ ph: true }]), elev, W, H);
    expect(s.shares.sky).toBeCloseTo((20 * W + 10) / N, 4); expect(s.shares.placeholder).toBeCloseTo((N - 20 * W - 10) / N, 4); expect(s.shares.skyHole).toBeCloseTo(10 / N, 4);
    expect(s.objects[0]).toMatchObject({ key: 'k1', ph: true });
  });
  it('finds large flat regions, black blocks by day, low detail, and periodic texture', () => {
    const ids = new Uint16Array(N).fill(1), dist = new Float32Array(N).fill(10), rgba = new Uint8ClampedArray(4 * N), elev = elevOf(-100);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x;
      let v = 120; if (x >= 64) v = 128 + 60 * Math.sin((2 * Math.PI * x) / 12) * (y < 64 ? 1 : 1) + ((x * 7 + y * 13) % 5); // right half: stripes, period 12 px
      rgba.set([v, v, v, 255], 4 * k); if (x >= 64) ids[k] = 2; }
    const ent = E([{ density: 0.1 }, { density: 1e4 }]);
    const f = analyseFrame(rgba, ids, dist, ent, elev, W, H, false);
    expect(f.flatLarge).toBeCloseTo(0.5, 2); expect(f.missing).toBeCloseTo(0.5, 2); // the flat left half
    expect(f.lowDetail).toBeCloseTo(0.5, 2); expect(f.lowObjects[0].key).toBe('k1'); // flat and 0.1 tri/m² at 10 m = 10 tri/sr
    expect(f.tiling.periodic).toBeGreaterThanOrEqual(1); expect(f.tiling.blocks[0].lag).toBe(12);
    const dark = new Uint8ClampedArray(4 * N); for (let k = 0; k < N; k++) dark[4 * k + 3] = 255;
    expect(analyseFrame(dark, ids, dist, ent, elev, W, H, false).black).toBeCloseTo(1, 2);
    expect(analyseFrame(dark, ids, dist, ent, elev, W, H, true).missing).toBeLessThan(analyseFrame(dark, ids, dist, ent, elev, W, H, false).missing); // night: black is not called missing
  });
});

describe('coverage report', () => {
  const rec = (id: string, sub: string, ph: number, miss: number, low: number, objs: Rec['objects'] = []): Rec => ({ id, area: sub.split(':')[0], sub, state: 'am-may', q: 'test',
    shares: { sky: 0.3, placeholder: ph, untiered: 0, skyHole: 0, badId: 0 }, missing: miss, lowDetail: low, flatness: 0.3, objects: objs, frame: { tiling: { textured: 4, periodic: 1 }, lowObjects: [] } });
  it('aggregates per area and sub-area, ranks worst first, and costs placeholder objects by pixels', () => {
    const R = [rec('a', 'town:lanes', 0.6, 0, 0.1, [{ key: 'settlement/cluster q_s1', share: 0.6, ph: true, tier: 'C', tris: 10, density: 0.1 }]),
      rec('b', 'town:lanes', 0.2, 0.1, 0, [{ key: 'settlement/cluster q_s2', share: 0.2, ph: true, tier: 'C', tris: 10, density: 0.1 }]),
      rec('c', 'terrace:open', 0, 0, 0), { id: 'd', area: 'plain', sub: 'plain:roads', state: 'am-may', q: 'test', error: 'boom' } as Rec];
    const A = aggregate(R);
    expect(A.worst.map(r => r.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(A.areas[0].key).toBe('plain'); expect(A.areas.find(a => a.key === 'town')!.ph).toBeCloseTo(0.4, 6);
    expect(A.placeholderObjects[0].key).toBe('settlement/cluster q_s#'); expect(A.placeholderObjects[0].cost).toBeCloseTo(0.8 / 3, 6); expect(A.placeholderObjects[0].views).toBe(2);
    expect(A.failRate).toBeCloseTo(3 / 4, 6); expect(score(R[2])).toBe(0); expect(normKey('a/b12 c3.5')).toBe('a/b# c#');
    const { md } = reportMd(R, {}, { q: 'test', sheet: null, src: 'x' });
    expect(md.indexOf('Read first')).toBeLessThan(md.indexOf('Per area')); expect(md).toContain('settlement/cluster q_s#');
  });
  it('computes the gate metrics of a frame (T-A2f, T-A3c, T-A3k, T-A3n, luma) and the board cells', () => {
    const W = 96, H = 48, iw = 48, ih = 24, d = new Uint8ClampedArray(4 * W * H), ids = new Uint16Array(iw * ih).fill(1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 4 * (y * W + x); const v = x < 48 ? 100 : 100 + ((x * 37 + y * 91) % 40); d.set([v, v, v, 255], i); }
    for (let y = 0; y < 16; y++) for (let x = 80; x < 96; x++) d.set([0, 0, 0, 255], 4 * (y * W + x)); // one black tile
    for (let y = 40; y < 48; y++) for (let x = 0; x < 10; x++) d.set([255, 255, 255, 255], 4 * (y * W + x)); // clipped
    const g = gateMetrics(d, W, H, ids, iw, ih);
    expect(g.blackTiles).toBe(1); expect(g.clipped).toBeCloseTo(80 / (W * H), 4); expect(g.clipped2).toBeCloseTo(80 / (W * H), 4);
    expect(gateMetrics(d, W, H, ids, iw, ih, { flames: [{ x: 5, y: 44, r: 8 }] }).clipped2).toBe(0); // a flame's clipped pixels are excluded expect(g.crush).toBeCloseTo(256 / (W * H), 4); expect(g.flatRegion).toBeGreaterThan(0.3); expect(g.flatRegion).toBeLessThan(0.55);
    const th = thresholds('nope.json'); expect(th.rows['T-A2f'].value).toBe(3);
    const r = (id: string, flat: number, dep = 'h1'): Rec => ({ id, area: 'town', sub: 'town:lanes', state: 's', q: 'test', seed: 7, dep, commit: 'abcdef12', sunAlt: 30, cam: [1, 2, 1.6, 3, 4],
      shares: { sky: 0.3, placeholder: 0, untiered: 0, phOrUntiered: 0, skyHole: 0, badId: 0 }, gate: { flatRegion: flat, clipped: 0, crush: 0, blackTiles: 0, meanLuma: 90 } });
    expect(viewGate(r('a', 0.01))!['T-A2f']).toBeCloseTo(1, 6);
    expect(cell([r('a', 0.01)], 'T-A2f', th.rows['T-A2f'], 'h1').status).toBe('INSUFFICIENT');
    expect(cell([r('a', 0.05)], 'T-A2f', th.rows['T-A2f'], 'h1').status).toBe('FAIL');
    expect(cell(Array.from({ length: 59 }, (_, i) => r(`v${i}`, 0.01)), 'T-A2f', th.rows['T-A2f'], 'h1').status).toBe('PASS');
    expect(cell([r('a', 0.01, 'old')], 'T-A2f', th.rows['T-A2f'], 'h1').status).toBe('STALE');
    const v = validate([r('cov-000', 0), { ...r('cov-001', 0), seed: 8 }, { ...r('cov-002', 0), extra: true }], { meta: { seed: 7 }, points: [{ id: 'cov-000', e: 1, n: 2, eye: 1.6, az: 3, pitch: 4 }] });
    expect(v.ok.map(x => x.id)).toEqual(['cov-000']); expect(v.refused.map(x => x.id)).toEqual(['cov-001']); expect(v.extras.map(x => x.id)).toEqual(['cov-002']);
  });
  it('flags scenes that are identical across days, and empty ones', () => {
    const Y = Array.from({ length: 64 * 36 }, (_, i) => i % 200), same = { objects: { a: 0.5 }, people: ['p1', 'p2'], acts: { walk: 2 }, animals: 0, impostors: 0, Y };
    expect(varietyOf([{ ...same, day: 25 }, { ...same, day: 26 }]).verdict).toMatch(/FAIL/);
    expect(varietyOf([{ ...same, day: 25 }, { ...same, day: 26, people: ['p7'], acts: { hoe: 1 }, Y: Y.map(v => v + 20) }]).verdict).toBe('differs');
    expect(varietyOf([{ ...same, people: [], acts: {}, day: 25 }, { ...same, people: [], acts: {}, day: 33 }]).verdict).toMatch(/EMPTY/);
  });
});
