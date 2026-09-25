// D-220 (rubric s7 pass 2 fix 5: "smoke and dust; no frame contains any"): the households' fires from the people sim's day,
// the near smoke puffs closed-form in time (frozen renders showed none: the old pool spawned at a rate × dt, and a test
// render has dt = 0), the smoke layer over the town and the villages, and the dust of work and feet on dry ground.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { FireSystem, PUFFS, SMOKE_RANGE, SMOKE_MAX } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { hearthSpans, ovenSpans, phaseAt, SmokeModel, cellTau, columnMass, sourceTau, PHASE_GH, FLAMING, BINS, BIN_H, addSpans, layerHeights, layerPeak, type SmokeCell, type SmokeSite } from '../src/world/hearthSmoke';
import { LandSmoke, insideCell } from '../src/world/landSmoke';
import { DustSystem, dryFactor, groundFactor, DUST, DUST_R } from '../src/world/dust';
import { loadTerrain, loadRiversFile } from './plainLib';
import { placeVillages } from '../src/world/plain/villages';
import { buildCanals } from '../src/world/plain/canals';
import { sunTimes } from '../src/people/calendar';

const hd = { breakfast: 6.2, bLen: 0.4, supper: 17.9, sLen: 0.45, bake: true, bakeAM: true, bakeH: 0.6 };
describe('household fires from the people sim\'s day (D-220)', () => {
  it('the evening fire is lit by the cook 0.35 h before the meal, smokes as it catches, burns through the meal, then embers', () => {
    const s = hearthSpans(hd, 18.58, false);
    expect(phaseAt(s, 17.5)).toBe('out'); expect(phaseAt(s, 17.6)).toBe('lighting'); expect(phaseAt(s, 18.0)).toBe('flaming');
    expect(phaseAt(s, 18.6)).toBe('smoulder'); expect(phaseAt(s, 19.5)).toBe('out');
    expect(phaseAt(s, 5.95)).toBe('lighting'); expect(phaseAt(s, 6.3)).toBe('flaming'); expect(phaseAt(s, 12)).toBe('out');
    // a cool evening keeps it low until bedtime, then banks it
    const c = hearthSpans(hd, 18.58, true); expect(phaseAt(c, 19.0)).toBe('low'); expect(phaseAt(c, 19.3)).toBe('smoulder');
    expect(PHASE_GH.lighting).toBeGreaterThan(3 * PHASE_GH.flaming); expect(PHASE_GH.smoulder).toBeLessThan(PHASE_GH.flaming);
    expect(FLAMING.has('smoulder')).toBe(false); expect(FLAMING.has('lighting')).toBe(true);
    const o = ovenSpans(hd); expect(phaseAt(o, 6.2 - 0.05 - 0.6 - 0.2)).toBe('firing'); expect(phaseAt(o, 5.9)).toBe('baking');
    expect(ovenSpans({ ...hd, bake: false })).toEqual([]);
  });
  it('column mass: a leaky box, zero before the fires, steady at flux × residence, clearing after', () => {
    const c = new Float32Array(BINS); for (let b = Math.floor(17 / BIN_H); b < Math.floor(18 / BIN_H); b++) c[b] = 3600; // 1 g/s for an hour
    expect(columnMass(c, 1e5, 300, 1, 16.9)).toBe(0);
    const tr = 1 / (1 / 300 + 1 / 2400), steady = (1 / 1e5) * tr; // g/m²
    expect(Math.abs(columnMass(c, 1e5, 300, 1, 17.99) / steady - 1)).toBeLessThan(0.01);
    expect(columnMass(c, 1e5, 300, 1, 18.5)).toBeLessThan(steady * 0.01);
    expect(columnMass(c, 1e5, 300, 4, 17.99)).toBeLessThan(columnMass(c, 1e5, 300, 1, 17.99) * 0.4); // the wind ventilates it
  });
  it('the layer lies low in the still air of dusk and dawn and is mixed up by day (peak 14 m at dusk)', () => {
    const d = layerHeights(-4), n = layerHeights(60); expect(d.H1).toBe(30); expect(layerPeak(d.H1, d.H2)).toBeGreaterThan(10); expect(layerPeak(d.H1, d.H2)).toBeLessThan(20);
    expect(n.H1).toBeGreaterThan(500);
  });
});

// ---- with the real population, town and villages ------------------------------------------------------------------
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let model: SmokeModel, fire: FireSystem, P: any, H: (e: number, n: number) => number;
const DAY = 14, SET = sunTimes(DAY).set;
/** the sun's altitude at an hour of DAY near sunset (deg): ~0.15°/min around it (C: enough for the layer's heights) */
const altNear = (h: number) => -0.833 - (h - SET) * 60 * 0.2;
beforeAll(() => {
  const sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env);
  P = (sim as any).pop;
  const T = loadTerrain(); H = (e, n) => T.heightAt(e, -n); fire = new FireSystem(0);
  const town = new Settlement(null, T, fire, 'test');
  const R = loadRiversFile(), C = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, C, 1);
  const sites: SmokeSite[] = [...town.plan.sites.map((s: any) => ({ id: s.id, e: s.frame.c[0], n: s.frame.c[1], R: Math.sqrt(s.W * s.H) / 2, kind: 'quarter' as const })),
    ...V.map(v => ({ id: v.id, e: v.x, n: v.y, R: (v.r * Math.sqrt(Math.PI)) / 2, kind: 'village' as const, pop: v.pop }))];
  model = new SmokeModel(P, fire.fires, sites, H);
}, 240_000);
const ray = (cells: SmokeCell[], e: number, n: number, y: number, te: number, tn: number, ty: number) => {
  const o: [number, number, number] = [e, y, -n], d = [te - e, ty - y, -tn + n], L = Math.hypot(d[0], d[1], d[2]);
  return cells.reduce((s, c) => s + cellTau(c, o, [d[0] / L, d[1] / L, d[2] / L]), 0);
};
describe('the town\'s hearths follow the households living in their plots (D-220)', () => {
  it('links nearly every house hearth and oven to its household; flames only while cooking or lighting', () => {
    const L = model.linkStats(); expect(L.linked).toBeGreaterThan(1000); expect(L.linked / L.fires).toBeGreaterThan(0.85);
    expect(L.quarters.q_s1).toBeGreaterThan(200);
    const c = W.conditions(DAY, SET - 0.5); model.update(DAY, SET - 0.5, c.windMs, c.windDirDeg, altNear(SET - 0.5));
    let bad = 0, lit = 0, smoking = 0; for (let i = 0; i < fire.fires.length; i++) { const ph = model.phaseOf(i, SET - 0.5); if (ph === null) continue;
      if ((model.lit[i] === 1) !== FLAMING.has(ph)) bad++; if (model.lit[i] === 1) lit++; if (model.gh[i] > 0) smoking++; }
    expect(bad).toBe(0); expect(lit).toBeGreaterThan(500); // the evening meal: most of the town's hearths burn
    expect(smoking).toBeGreaterThanOrEqual(lit);
    model.update(DAY, 12, 1, 200, 70); let noon = 0; for (let i = 0; i < fire.fires.length; i++) if (model.gh[i] > 0) noon++;
    expect(noon).toBeLessThan(lit * 0.05); // no household fire at midday (the midday meal is bread: C)
  });
});
describe('the smoke layer over the town and the villages (D-220)', () => {
  const at = (h: number, wind?: number) => { const c = W.conditions(DAY, h); return model.update(DAY, h, wind ?? c.windMs, c.windDirDeg, h > 10 && h < 17 ? 60 : altNear(h)); };
  it('reads from the Terrace over the S quarters at dusk on a still evening (τ ≥ 0.1), not at noon nor after midnight', () => {
    const dusk = at(18.8), tD = ray(dusk, -50.5, -120, 1.6, -900, -1300, H(-900, -1300) + 4), tD1 = ray(dusk, -50.5, -120, 1.6, -600, -1000, H(-600, -1000) + 4);
    console.log('τ Terrace → S quarters at 18:48', tD.toFixed(3), tD1.toFixed(3), 'cells', dusk.length);
    expect(tD).toBeGreaterThan(0.1); expect(tD1).toBeGreaterThan(0.1);
    expect(tD).toBeLessThan(2); // a haze, not a wall
    const noon = at(12.5); expect(ray(noon, -50.5, -120, 1.6, -900, -1300, H(-900, -1300) + 4)).toBeLessThan(0.03);
    const late = at(23.5); expect(late.length).toBe(0);
  });
  it('reads from Kuh-e Rahmat over the W and S quarters (τ ≥ 0.05) and from the Stair over a village of the plain at dawn', () => {
    const dusk = at(18.8), y = H(380, -60) + 1.6;
    const tW = ray(dusk, 380, -60, y, -935, -95, H(-935, -95) + 4), tS = ray(dusk, 380, -60, y, -815, -1095, H(-815, -1095) + 4);
    console.log('τ Rahmat → W quarter', tW.toFixed(3), '→ S quarter', tS.toFixed(3)); expect(Math.max(tW, tS)).toBeGreaterThan(0.05);
    const dawn = model.update(DAY, 5.4, W.conditions(DAY, 5.4).windMs, W.conditions(DAY, 5.4).windDirDeg, -0.1);
    const tV = ray(dawn, -36, 135, 1.6, -4369, 1870, H(-4369, 1870) + 5); console.log('τ Stair → village p21 at dawn', tV.toFixed(3)); expect(tV).toBeGreaterThan(0.05);
  });
  it('the wind thins and carries it off', () => {
    const still = ray(at(18.8, 0.5), -50.5, -120, 1.6, -900, -1300, H(-900, -1300) + 4), windy = ray(at(18.8, 6), -50.5, -120, 1.6, -900, -1300, H(-900, -1300) + 4);
    expect(windy).toBeLessThan(still * 0.5);
  });
  it('the renderer takes every cell in one instanced draw; the inside mesh only while the eye is in a cell', () => {
    const cells = at(18.8), L = new LandSmoke(); L.update(cells, { x: -50.5, y: 1.6, z: 120 });
    expect(L.count).toBe(Math.min(cells.length, 96)); expect(cells.length).toBeGreaterThan(20);
    const q = cells.find(c => c.id === 'q_s1')!; const eye = { x: q.cx, y: q.gy0 + 2, z: q.cz }; expect(insideCell(q, eye)).toBe(true);
    L.update(cells, eye); expect(L.inside).toBeGreaterThanOrEqual(1);
    const draws = L.group.children.filter(o => o.visible).length; expect(draws).toBeLessThanOrEqual(2);
  });
});
describe('near smoke puffs, closed-form in time (D-220)', () => {
  const cam = () => { const c = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 5000); c.position.set(0, 1.6, 10); c.updateMatrixWorld(); return c; };
  const one = (kind: 'hearth' | 'brazier' | 'torch', at = new THREE.Vector3(0, 0, 0)) => { const f = new FireSystem(0); f.add(kind, at, { tier: 'C', src: 'T', note: 't' }); f.build(); return f; };
  it('a lit hearth near the eye has PUFFS.hearth puffs in a frozen render (dt = 0); none unlit or beyond SMOKE_RANGE', () => {
    const f = one('hearth'); f.update(0, cam(), -5, 1, 200, 0, 0, 19);
    expect(f.stats().lit).toBe(1); expect(f.stats().smoke).toBe(PUFFS.hearth);
    const day = one('hearth'); day.update(0, cam(), 40, 1, 200, 0, 0, 12); expect(day.stats().smoke).toBe(0);
    const far = one('hearth', new THREE.Vector3(SMOKE_RANGE + 50, 0, 0)); far.update(0, cam(), -5, 1, 200, 0, 0, 19); expect(far.stats().smoke).toBe(0);
  });
  it('opacity follows the fire\'s emission: lighting > cooking > embers; a charcoal brazier is nearly clear, a pitch torch sooty', () => {
    const maxA = (f: FireSystem) => Math.max(...Array.from(((f as any).smokeAlpha.array as Float32Array).slice(0, f.stats().smoke)));
    const byGh = (gh: number) => { const f = one('hearth'); f.setSimState(Int8Array.from([gh >= 18 ? 1 : 0]), Float32Array.from([gh])); f.update(0, cam(), -5, 0.5, 200, 0, 0, 19); return maxA(f); };
    const lighting = byGh(PHASE_GH.lighting), cooking = byGh(PHASE_GH.flaming), embers = byGh(PHASE_GH.smoulder);
    console.log('near puff peak opacity: lighting', lighting.toFixed(3), 'cooking', cooking.toFixed(3), 'embers', embers.toFixed(3));
    expect(lighting).toBeGreaterThan(2 * cooking); expect(cooking).toBeGreaterThan(embers); expect(lighting).toBeGreaterThan(0.08); expect(lighting).toBeLessThan(0.5);
    const b = one('brazier'); b.update(0, cam(), -5, 0.5, 200, 0, 0, 21); expect(maxA(b)).toBeLessThan(0.01);
    const t = one('torch'); t.update(0, cam(), -5, 0.5, 200, 0, 0, 21); expect(maxA(t)).toBeGreaterThan(0.02); expect(sourceTau('torch', 25)).toBeGreaterThan(sourceTau('hearth', PHASE_GH.flaming)); // a narrow sooty thread
    expect(sourceTau('hearth', PHASE_GH.lighting)).toBeCloseTo(0.111, 2);
  });
  it('the pool fills nearest first and never overflows; the puffs rise and drift downwind', () => {
    const f = new FireSystem(0); for (let i = 0; i < 200; i++) f.add('hearth', new THREE.Vector3(i * 1.2 - 120, 0, -20), { tier: 'C', src: 'T', note: 't' }); f.build();
    f.update(0, cam(), -5, 3, 270, 0, 0, 19); expect(f.stats().smoke).toBeLessThanOrEqual(SMOKE_MAX); expect(f.stats().smoke).toBeGreaterThan(SMOKE_MAX - PUFFS.hearth);
    const g = one('hearth'); g.update(0, cam(), -5, 3, 270, 0, 5, 19); const m = new THREE.Matrix4(), p = new THREE.Vector3(); let sy = 0, sx = 0;
    for (let i = 0; i < g.stats().smoke; i++) { (g as any).smoke.getMatrixAt(i, m); p.setFromMatrixPosition(m); sy += p.y; sx += p.x; }
    expect(sy / g.stats().smoke).toBeGreaterThan(1); // above the flame
    // a west wind (from 270° true) carries it toward grid east of true east: the mean drift has a positive x
    expect(sx / g.stats().smoke).toBeGreaterThan(0.5);
  });
});
describe('dust of work and feet (D-220)', () => {
  it('only on dry ground: none on wet ground, snow or in rain; stone dust off the chisel whatever the ground, not in rain', () => {
    expect(dryFactor({ wetness: 0, snowCover: 0, rain: 0 })).toBe(1); expect(dryFactor({ wetness: 0.3, snowCover: 0, rain: 0 })).toBe(0);
    expect(dryFactor({ wetness: 0, snowCover: 0.5, rain: 0 })).toBe(0); expect(dryFactor({ wetness: 0, snowCover: 0, rain: 0.3 })).toBe(0);
    expect(dryFactor({ wetness: 0.8, snowCover: 0, rain: 0 }, true)).toBe(1); expect(dryFactor({ wetness: 0.8, snowCover: 0, rain: 0.3 }, true)).toBe(0);
    // after the rain of day 2-4 the ground stays wet into day 5 (weatherState wetness), dry by day 10
    expect(dryFactor(W.conditions(3, 12))).toBe(0); expect(dryFactor(W.conditions(10, 12))).toBeGreaterThan(0.9);
  });
  it('puffs per emitter, fewer far, none beyond DUST_R; nothing in a roofed hall; the Terrace courts a little', () => {
    const d = new DustSystem(), eye = new THREE.Vector3(0, 1.6, 0), cam = new THREE.PerspectiveCamera(); cam.position.copy(eye);
    d.rooms = [{ x0: -10, x1: 10, z0: 40, z1: 60, y0: 0, y1: 12 }];
    const dry = { wetness: 0, snowCover: 0, rain: 0, windMs: 1, windDirDeg: 250 }, wet = { ...dry, wetness: 0.6 };
    d.begin(eye); d.emit('walk', 5, -15, 5, 0, 1.3, 1); d.emit('walk', 120, -15, 0, 0, 1.3, 2); d.emit('walk', DUST_R + 10, -15, 0, 0, 1.3, 3);
    d.emit('mason', 0, 0.1, 50, 0, 0, 4); d.emit('walk', 0, 0.1, 30, 0, 1.3, 5); d.emit('walk', 0, 0.1, 52, 0, 1.3, 6); d.update(0, cam, dry);
    // the near and far walkers on the plain and the one on the Terrace's court; none beyond DUST_R nor in the hall; the mason's
    // stone dust wherever he works
    expect(d.stats.byKind.walk).toBe(3); expect(d.stats.byKind.mason).toBe(1);
    expect(d.stats.puffs).toBe(2 * DUST.walk.k + Math.max(1, DUST.walk.k >> 1) + DUST.mason.k);
    expect(groundFactor(0, 0.1, 50, d.rooms)).toBe(0); expect(groundFactor(0, 0.1, 30, d.rooms)).toBe(0.3); expect(groundFactor(0, -15, 0)).toBe(1);
    d.begin(eye); d.emit('walk', 5, -15, 5, 0, 1.3, 1); d.emit('mason', 5, 0.1, 5, 0, 0, 4); d.update(0, cam, wet);
    expect(d.stats.byKind.walk ?? 0).toBe(0); expect(d.stats.byKind.mason).toBe(1);
  });
  it('a walker\'s puffs lie behind the walker, at the ankles, rising and fading', () => {
    const d = new DustSystem(), eye = new THREE.Vector3(0, 1.6, 0), cam = new THREE.PerspectiveCamera();
    d.begin(eye); d.emit('walk', 0, -15, 0, 0, 1.3, 7); d.update(1.7, cam, { wetness: 0, snowCover: 0, rain: 0, windMs: 0, windDirDeg: 0 });
    const m = new THREE.Matrix4(), p = new THREE.Vector3(); for (let i = 0; i < d.stats.puffs; i++) { (d as any).mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); expect(p.z).toBeLessThan(0.3); expect(p.y).toBeLessThan(-15 + 0.6); }
  });
});
void addSpans;

// the crowd reports its dust emitters while it draws (render 2 found none in any view: the world cleared them after the
// crowd had drawn; dust.begin now runs before crowd.update, world.ts). Here the crowd and its animals feed a DustSystem
describe('the crowd feeds the dust (D-220)', () => {
  it('a walker, a herder walking and a mason dressing stone report emitters; a resting man none (the herd\'s animals: not asserted, none walked here)', async () => {
    const { decodeHumanAssets, meshoptSimplify } = await import('../src/people/humanAssets');
    const { buildOutfits } = await import('../src/people/outfits'); const { HumanGPU } = await import('../src/people/humanGPU');
    const { Crowd } = await import('../src/people/crowd'); const { propOf } = await import('../src/people/popview');
    const b = readFileSync('public/generated/humans/humans.bin');
    const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
    const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const crowd = new Crowd(null, 1, { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } } as any);
    crowd.view = { lookInput: (pid: number) => ({ id: 100000 + pid, sex: 'm', role: 'porter', dress: 'worker', origin: 'persian', seed: 7777 + pid * 31 }), childStature: () => null,
      geo: { plotAt: () => 0 }, stats: {}, pop: { persons: [], nameOf: () => null } } as any;
    const vp = (pid: number, e: number, n: number, act: any, why: string, o: any = {}) => ({ pid, e, n, y: -15, heading: 180, act, moving: false, why, place: '', prop: propOf(act, null), carryNote: null, speed: 0, entry: 0, what: 'test', agent: -1, plot: 0, wall: 0, hh: -1, ...o });
    const V = [vp(1, 2, 8, 'walk', 'walking', { moving: true, speed: 1.3 }), vp(2, -2, 9, 'dress_stone', 'dressing a block for the Hall of a Hundred Columns'),
      vp(3, 4, 14, 'herd', 'driving the flock out to the stubble', { moving: true, speed: 0.9 }), vp(4, -4, 10, 'rest', 'resting')];
    const P = V.map(v => [crowd.attachPop(v.pid), v] as const), frame = () => (crowd as any).frame as number;
    const d = new DustSystem(), taps: string[] = []; crowd.dustTap = (k, x, y, z, yaw, s, sd) => { taps.push(k); d.emit(k, x, y, z, yaw, s, sd); };
    let animals = 0; crowd.animals.onPush = (a, M) => { if (a.walk > 0.2) { animals++; const p = new THREE.Vector3().setFromMatrixPosition(M); d.emit('flock', p.x, p.y, p.z, 0, 1, a.coat * 1e4); } };
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, -13.4, 0); cam.lookAt(0, -14, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    for (let f = 0; f < 3; f++) { taps.length = 0; animals = 0; d.begin(cam.position); for (const [p, v] of P) { p.vp = v as any; p.vpFrame = frame() + 1; } crowd.update(f / 30, cam.position, cam.position, cam); }
    d.update(0.5, cam, { wetness: 0, snowCover: 0, rain: 0, windMs: 1, windDirDeg: 250 });
    console.log('dust taps', JSON.stringify(taps), 'walking animals', animals, 'dust', JSON.stringify(d.stats));
    expect(taps).toContain('walk'); expect(taps).toContain('mason'); expect(taps.filter(k => k === 'walk').length).toBeLessThanOrEqual(2); // the walker (and the herder)
    expect(d.stats.puffs).toBeGreaterThan(0); expect(d.stats.byKind.mason).toBe(1);
  }, 240_000);
});

// the shaders build (three's WGSL node builder in node: catches TSL type errors; the device's WGSL validation needs a render)
describe('smoke and dust shaders build to WGSL (D-220)', () => {
  const build = (mesh: THREE.Mesh) => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
    r.backend.device = { limits: { maxUniformBufferBindingSize: 65536 } }; // (instanced meshes ask the device's limits)
    const rt = new THREE.RenderTarget(64, 64); r.setRenderTarget(rt);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 5000); scene.add(mesh);
    const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
    return { v: b.vertexShader as string, f: b.fragmentShader as string };
  };
  it('the smoke layer (both meshes), the dust puffs and the near smoke puffs', () => {
    const L = new LandSmoke(); for (const m of L.group.children as THREE.Mesh[]) { const s = build(m); expect(s.f.length).toBeGreaterThan(500); expect(s.f).toMatch(/exp/); }
    const D = new DustSystem(); const sd = build(D.group.children[0] as THREE.Mesh); expect(sd.f.length).toBeGreaterThan(200);
    const f = new FireSystem(0); f.add('hearth', new THREE.Vector3(), { tier: 'C', src: 'T', note: 't' }); f.build();
    const sm = f.group.getObjectByName('fire:smoke') as THREE.Mesh; expect(build(sm).f.length).toBeGreaterThan(200);
  });
});
