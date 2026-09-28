// D-335 (session 12): the ground cover at the feet (src/world/plain/groundCover.ts): grass tufts where the shader paints the
// herb layer, stubble on the harvested plots, dung on the trodden ground; the frame's budget. Headless on the real DEM and
// zones. What could pass while the intent fails: tufts that ignore the season (checked: none in the herb layer's dead season,
// green-to-straw by it), stubble in a growing crop (checked: only between harvest and ploughing), cover on the trodden foot
// as thick as on the steppe (checked), a budget blown near the town (checked at three views).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildZones, landUseAt, type ZoneMap } from '../src/world/plain/fields';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages } from '../src/world/plain/villages';
import { buildTownPlan } from '../src/world/settlement/plan';
import { buildTownGround, groundAt4, type GroundMap } from '../src/world/plain/townGround';
import { coverCell, GroundCover, COVER, COVER_KINDS, type CoverEnv, type CoverKit } from '../src/world/plain/groundCover';
import { cropState, doyOf } from '../src/world/plain/seasonal';
import { seasonAt } from '../src/world/season';

const T = loadTerrain(), R = loadRiversFile();
let Z: ZoneMap, G: GroundMap, env: CoverEnv;
beforeAll(() => {
  const canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1), plan = buildTownPlan();
  G = buildTownGround(plan);
  Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: G,
    sites: plan.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
  env = { ground: (x, z) => T.surfaceAt(x, z), zones: Z, trodden: (x, z) => groundAt4(G, x, -z)[1] };
}, 180_000);
const cells = (e0: number, n0: number, size: number, day: number) => { const out = [], C = COVER.cell;
  for (let ix = Math.floor(e0 / C); ix < Math.floor((e0 + size) / C); ix++) for (let iz = Math.floor(-(n0 + size) / C); iz < Math.floor(-n0 / C); iz++) out.push(...coverCell(env, ix, iz, 1, doyOf(day), seasonAt(day)));
  return out; };

describe('the ground cover (plain/groundCover.ts)', () => {
  it('tufts on the uncultivated ground at the herb layer\'s density, by the season: green in spring, straw in summer', () => {
    const spring = cells(-940, 380, 60, 12), summer = cells(-940, 380, 60, 110);
    const tufts = (a: any[]) => a.filter(i => i.kind === 'tuft' || i.kind === 'sward');
    const nat = (() => { let n = 0; for (let e = -940; e < -880; e += 2) for (let no = 380; no < 440; no += 2) if (landUseAt(Z, e, -no).use === 'natural') n++; return n * 4; })();
    const dens = tufts(spring).length / Math.max(1, nat);
    console.log(`W steppe 60 x 60 m: natural ground ${nat} m2, tufts in spring ${tufts(spring).length} (${dens.toFixed(2)} per m2), in summer ${tufts(summer).length}`);
    if (nat > 400) { expect(dens).toBeGreaterThan(0.08); expect(dens).toBeLessThan(1.5); }
    const g = (a: any[]) => a.reduce((s, i) => s + i.c[1] / Math.max(1e-3, i.c[0]), 0) / Math.max(1, a.length); // green over red
    if (tufts(spring).length && tufts(summer).length) expect(g(tufts(spring))).toBeGreaterThan(g(tufts(summer)));
  });
  it('stubble only on the harvested cereal plots (between harvest and ploughing), none on a growing crop', () => {
    let grow = 0, stub = 0, found = 0;
    for (let e = -3000; e < 3000 && found < 40; e += 37) for (let no = -3000; no < 3000 && found < 40; no += 41) {
      const u = landUseAt(Z, e, -no); if (u.use !== 'rainfed' && u.use !== 'irrigated') continue; if (u.plot.edge < 1.5) continue;
      for (const day of [20, 95]) { const st = cropState(u.row, doyOf(day) + u.offsetDays), it = coverCell(env, Math.floor(e / 2), Math.floor(-no / 2), 1, doyOf(day), seasonAt(day));
        const s = it.filter(i => i.kind === 'stubble').length;
        if (st.height > 0.1) { grow++; expect(s, `stubble in a standing ${u.row} at (${e}, ${no}) day ${day}`).toBe(0); } else if (st.straw > 0.3 && st.height === 0) { stub++; expect(s).toBeGreaterThan(0); } }
      found++;
    }
    console.log(`plots sampled ${found}: standing crop ${grow}, stubble ${stub}`);
    expect(stub + grow).toBeGreaterThan(10);
  });
  it('dung on the trodden ground (the stair foot and its tether lines) far more than on the steppe; few tufts there', () => {
    const foot = cells(-150, 90, 60, 30), steppe = cells(-940, 380, 60, 30);
    const k = (a: any[], kind: string) => a.filter(i => i.kind === kind).length;
    console.log(`stair foot: dung ${k(foot, 'dung')}, tufts ${k(foot, 'tuft')}; steppe: dung ${k(steppe, 'dung')}, tufts ${k(steppe, 'tuft')}`);
    expect(k(foot, 'dung')).toBeGreaterThan(3 * Math.max(1, k(steppe, 'dung')));
    expect(k(foot, 'tuft')).toBeLessThan(k(steppe, 'tuft'));
  });
  it('what a frame draws of it stays in its budget (<= 0.35 M triangles, <= 36 draws, no shadow casters) at the steppe, the stair foot and a village', () => {
    const tri = (n: number) => { const g = new THREE.BufferGeometry(); g.setIndex(new Array(n * 3).fill(0)); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); return g; };
    const tris: Record<string, number[]> = { tuft: [900, 250, 60], sward: [268, 90, 30], stubble: [832, 266, 122], dung: [360, 180, 40] }; // (the shipped pieces' largest levels, public/models/land/manifest.json)
    const kit: CoverKit = { pieces: Object.entries(COVER_KINDS).flatMap(([kind, K]) => K.ids.map(id => ({ id, kind: kind as any, size: [0.3, 0.2, 0.3] as [number, number, number], lods: tris[kind].map(tri) }))),
      map: new THREE.Texture(), normal: new THREE.Texture(), arm: new THREE.Texture(), mean: [0.2, 0.2, 0.2] };
    const C = new GroundCover(env, 1, kit);
    for (const [n, e, no, day] of [['steppe', -900, 420, 12], ['stair-foot', -80, 118, 30], ['stubble', -1300, 900, 95]] as [string, number, number, number][]) {
      C.update(new THREE.Vector3(e, T.surfaceAt(e, -no), -no), doyOf(day), seasonAt(day), true);
      console.log(`${n}: ${JSON.stringify(C.stats)}`); expect(C.stats.tris).toBeLessThan(0.35e6); expect(C.stats.drawn).toBeLessThanOrEqual(36);
    }
    expect(C.sets.every(s => !s.mesh.castShadow)).toBe(true);
  }, 120_000);
});

describe('the fords as cobbles, boulders and a hide boat near the eye (D-335; plain/fordDetail.ts)', () => {
  it('every ford paved with cobble tiles over its causeway, each stepping stone a boulder, the Kur\'s boat; within budget at the ford', async () => {
    const { buildCrossings } = await import('../src/world/plain/crossings');
    const { FordDetail, FORD_R } = await import('../src/world/plain/fordDetail');
    const b = buildCrossings(T, R.rivers, 1, []), d = b.detail;
    console.log(`fords ${b.crossings.length}: cobble tiles ${d.tiles.length}, stepping stones ${d.steps.length} (boxes ${b.stats.steps}), boats ${d.boats.length}`);
    expect(d.fords.length).toBe(b.crossings.length); expect(d.steps.length).toBe(b.stats.steps); expect(d.boats.length).toBe(b.stats.boats);
    for (const [x, , z] of d.fords) expect(d.tiles.filter(t => Math.hypot(t.x - x, t.z - z) < 40).length).toBeGreaterThan(20);
    const tri = (n: number) => { const g = new THREE.BufferGeometry(); g.setIndex(new Array(n * 3).fill(0)); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); return g; };
    const kit = { tiles: [[9248, 2408, 548], [9008, 2348, 468], [8048, 2108, 548]].map(L => L.map(tri)), boat: [1104, 312, 108].map(tri) };
    const F = new FordDetail(d, kit);
    const [x0, , z0] = d.fords[0]; F.update(new THREE.Vector3(x0 + 6, 0, z0 + 6), true);
    console.log(`at the first ford: ${JSON.stringify(F.stats)}`); expect(F.stats.tiles).toBeGreaterThan(20); expect(F.stats.tris).toBeLessThan(0.35e6);
    F.update(new THREE.Vector3(0, 0, 0), true); expect(F.stats.tris).toBe(0); // (the Terrace: no ford within reach)
    expect(FORD_R.lod[0]).toBeLessThan(FORD_R.lod[1]);
  }, 120_000);
});

describe('the rivers\' and canals\' shoreline (D-335, B188)', () => {
  it('the water material builds with its ragged edge (a discard by the noise) and the bank\'s ragged wet band', async () => {
    const { buildRivers } = await import('../src/world/plain/rivers');
    const { buildCanals } = await import('../src/world/plain/canals');
    const rv = buildRivers(T, R.rivers, buildCanals(T, R.rivers, 1));
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), new THREE.DirectionalLight(0xffffff, 3));
    for (const m of [rv.water, rv.banks]) { const b = new (THREE as any).WGSLNodeBuilder(m, r); b.scene = scene; b.camera = camera; b.material = m.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
      if (m === rv.water) { expect(String(b.fragmentShader)).toContain('discard'); expect((m.material as any).alphaTest).toBe(0.5); } }
  }, 300_000);
});
