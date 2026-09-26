// Coverage harness (D-235): the sampler covers every walkable area with points on walkable ground, deterministically, and
// the committed sample is in sync; the ID pass's override shaders generate WGSL (node, no GPU); the F3 records resolve
// placeholders as the dev overlay does (per face in merged meshes); the frame analysis finds flat regions, sky holes,
// tiling and low detail on synthetic buffers; the report aggregates and ranks worst-first; scene variety flags identical days.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { texture, positionLocal, vec3 } from 'three/tsl';
import { samplePoints, loadWorld, onNav, townCells, slopeDeg, allocate, AREA_WEIGHTS, TOWN_WEIGHTS, PLAIN_WEIGHTS, FAR_WEIGHTS, BUILT_EDGES, MAX_SLOPE, WORLD_STATES, type CovFile } from '../tools/dev/coverage_points';
import { CoveragePass, analyseFrame, idShares, type CovEntry } from '../src/dev/coverage';
import { aggregate, varietyOf, score, normKey, reportMd, type Rec } from '../tools/dev/coverage_report';

let A: CovFile;
beforeAll(() => { A = samplePoints(1); }, 120_000);

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
  it('is deterministic by seed, and the committed sample is the seed-1 sample', () => {
    const B = samplePoints(1), C = samplePoints(2);
    expect(JSON.stringify(B)).toBe(JSON.stringify(A));
    expect(JSON.stringify(C.points.map(p => [p.e, p.n]))).not.toBe(JSON.stringify(A.points.map(p => [p.e, p.n])));
    const F = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8'));
    expect(F.points).toEqual(A.points); expect(F.variety).toEqual(A.variety);
  });
  it('spreads world states over every area, revisits places at contrasting states, and sets up the variety days', () => {
    for (const a of Object.keys(AREA_WEIGHTS)) { const n = new Set(A.points.filter(p => p.area === a).map(p => p.state)).size; expect(n, a).toBeGreaterThanOrEqual(a === 'rahmat' ? 6 : 8); }
    const rev = A.points.filter(p => p.revisit); expect(rev.length).toBeGreaterThan(50);
    for (const r of rev) { const f = A.points.find(p => p.place === r.place && !p.revisit)!; expect(f).toBeTruthy(); expect(r.state).not.toBe(f.state); expect([r.e, r.n, r.az]).toEqual([f.e, f.n, f.az]); }
    expect(A.variety.length).toBe(5); for (const v of A.variety) expect(v.days.length).toBe(3);
    // chunks are ordered by state (one page load steps through them)
    const si = A.points.map(p => WORLD_STATES.findIndex(s => s.id === p.state)); for (let i = 1; i < si.length; i++) expect(si[i]).toBeGreaterThanOrEqual(si[i - 1]);
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
  it('flags scenes that are identical across days, and empty ones', () => {
    const Y = Array.from({ length: 64 * 36 }, (_, i) => i % 200), same = { objects: { a: 0.5 }, people: ['p1', 'p2'], acts: { walk: 2 }, animals: 0, impostors: 0, Y };
    expect(varietyOf([{ ...same, day: 25 }, { ...same, day: 26 }]).verdict).toMatch(/FAIL/);
    expect(varietyOf([{ ...same, day: 25 }, { ...same, day: 26, people: ['p7'], acts: { hoe: 1 }, Y: Y.map(v => v + 20) }]).verdict).toBe('differs');
    expect(varietyOf([{ ...same, people: [], acts: {}, day: 25 }, { ...same, people: [], acts: {}, day: 33 }]).verdict).toMatch(/EMPTY/);
  });
});
