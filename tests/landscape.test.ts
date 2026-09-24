// D-190 (session 6): the hills below the DEM's 30 m (terrain/terrainDetail.ts), the town's used ground and worn paths
// (plain/townGround.ts), rain-fed crop/fallow by block and the plain's far fade (plain/terrainPlain.ts). Headless.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { bakeDetail, bakeTerrainDetail, DETAIL_RING, type Detail } from '../src/terrain/terrainDetail';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { buildTownGround, groundAt, desireLines, PATH_W, TERRACE_BOX, type GroundMap } from '../src/world/plain/townGround';
import { buildZones, landUseAt, ROTATION, RAINFED_BARLEY, rainfedThreshold, plotAt } from '../src/world/plain/fields';
import { settlementZones, pointInPolygon } from '../src/world/plain/data';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages } from '../src/world/plain/villages';
import { PlainGround } from '../src/world/plain/terrainPlain';
import { toLocal } from '../src/world/settlement/site';

const T = loadTerrain(), R = loadRiversFile();
let D: Detail, plan: TownPlan, G: GroundMap;
beforeAll(async () => { D = await bakeTerrainDetail(T); plan = buildTownPlan(); G = buildTownGround(plan); }, 120_000);

describe('the hills below the DEM (terrainDetail.ts)', () => {
  it('reads the rings and never moves a height; deterministic', () => {
    const before = T.near.h.slice(0, 5000); const again = bakeDetail(T.near, DETAIL_RING.near);
    expect(Array.from(T.near.h.slice(0, 5000))).toEqual(Array.from(before));
    expect(Buffer.compare(Buffer.from(again.data), Buffer.from(D.near.data))).toBe(0);
    // the perturbation used for routing stays within the DEM's relative error (GLO-30: < 2 m at <= 20 %, < 4 m steeper)
    expect(DETAIL_RING.near.perturb).toBeLessThanOrEqual(2); expect(DETAIL_RING.mid.perturb).toBeLessThanOrEqual(4);
  });
  it('Kuh-e Rahmat E of the Terrace: gullies as a sparse net on its slopes (not parallel hatching, not everywhere), rock-shedding spurs and soil-holding hollows both present', () => {
    for (const [k, m] of [['near', D.near], ['mid', D.mid]] as const) {
      let hill = 0, gully = 0, cvx = 0, ccv = 0;
      for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) {
        const x = -m.half + c * m.cell, z = -m.half + r * m.cell; if (x < 400 || x > 2000 || Math.abs(z) > 1600) continue; // the massif E of the Terrace
        const i = (r * m.n + c) * 4, s = m.data[i + 2] / 255 * 1.5; if (s < 0.25) continue;
        hill++; if (m.data[i] > 127) gully++; if (m.data[i + 1] > 150) cvx++; if (m.data[i + 1] < 106) ccv++;
      }
      console.log(k, { hill, gullyShare: +(gully / hill).toFixed(3), convex: +(cvx / hill).toFixed(3), concave: +(ccv / hill).toFixed(3), ms: Math.round(m.ms) });
      expect(hill, k).toBeGreaterThan(1000);
      expect(gully / hill, k).toBeGreaterThan(0.01); expect(gully / hill, k).toBeLessThan(0.15);
      expect(cvx / hill, k).toBeGreaterThan(0.03); expect(ccv / hill, k).toBeGreaterThan(0.03);
    }
  });
  it('the gullies follow the DEM: gully samples drain more area than their neighbours across the slope', () => {
    // a gully sample's log-area (A) exceeds the mean of the samples 3 cells to either side along the contour
    const m = D.near; let n = 0, more = 0;
    for (let r = 120; r < 900; r += 3) for (let c = 620; c < 1010; c += 3) { const i = (r * m.n + c); if (m.data[i * 4] < 200) continue;
      const hx = T.near.h[i + 1] - T.near.h[i - 1], hz = T.near.h[i + m.n] - T.near.h[i - m.n], L = Math.hypot(hx, hz); if (L < 1e-3) continue;
      const tx = Math.round(-hz / L * 3), tz = Math.round(hx / L * 3); const side = (m.data[(i + tz * m.n + tx) * 4 + 3] + m.data[(i - tz * m.n - tx) * 4 + 3]) / 2;
      n++; if (m.data[i * 4 + 3] > side) more++; }
    expect(n).toBeGreaterThan(50); expect(more / n).toBeGreaterThan(0.8);
  });
});

describe('the town\'s used ground (townGround.ts)', () => {
  it('desire lines: a few dozen clear runs, each from a site\'s lane mouth, the stair foot or a facility (not the lane graph\'s web)', () => {
    const L = desireLines(plan); expect(L.length).toBeGreaterThan(15); expect(L.length).toBeLessThan(120);
    expect(G.runs).toBe(L.length);
  });
  it('a worn path is continuous between the 4 m samples: along every desire line in the near ring, the filtered distance stays within the path (but where two paths meet)', () => {
    let worst = 0, n = 0, out = 0;
    for (const l of desireLines(plan)) { const Ls = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
      for (let t = 6; t < Ls - 6; t += 0.7) { const e = l.a[0] + (l.b[0] - l.a[0]) * t / Ls, nn = l.a[1] + (l.b[1] - l.a[1]) * t / Ls;
        if (Math.abs(e) > 2000 || Math.abs(nn) > 2000) continue; const d = groundAt(G, e, nn)[0]; worst = Math.max(worst, d); n++; if (d > PATH_W / 2) out++; } }
    console.log({ n, out, worst }); // a sample between two paths' nearest vectors (a junction or a crossing) interpolates two lines
    expect(n).toBeGreaterThan(1000); expect(out / n).toBeLessThan(0.01); expect(worst).toBeLessThan(2.5);
  });
  it('no plot is cultivated inside or beside a built site, on the Terrace or its approach; the open ground between the quarters is', () => {
    const canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
    const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: G, sites: plan.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
    for (const s of plan.sites) for (let u = -s.W / 2; u <= s.W / 2; u += 7) for (let v = -s.H / 2; v <= s.H / 2; v += 7) {
      const c = Math.cos(s.frame.theta), sn = Math.sin(s.frame.theta), e = s.frame.c[0] + u * c - v * sn, nn = s.frame.c[1] + u * sn + v * c;
      expect(landUseAt(Z, e, -nn).use, `${s.id} at ${e.toFixed(0)},${nn.toFixed(0)}`).toBe('natural'); }
    for (let e = TERRACE_BOX.e0 - 100; e <= TERRACE_BOX.e1; e += 9) for (let nn = TERRACE_BOX.n0 - 100; nn <= TERRACE_BOX.n1 + 100; nn += 9) expect(landUseAt(Z, e, -nn).use).toBe('natural');
    // the settlement zones' open ground (> 80 m from any site, in the near ring): mostly cultivated
    const zones = settlementZones(); let open = 0, cult = 0;
    for (let e = -2000; e <= 2000; e += 23) for (let nn = -2000; nn <= 2000; nn += 23) {
      if (!zones.some(z => pointInPolygon(e, nn, z))) continue;
      if (plan.sites.some(s => { const [u, v] = toLocal(s.frame, e, nn); return Math.abs(u) < s.W / 2 + 80 && Math.abs(v) < s.H / 2 + 80; })) continue;
      if (e > -700 && e < 420 && nn > -420 && nn < 400) continue; // the Terrace, its approach and margins
      if (groundAt(G, e, nn)[2] < 0.5) continue; // roads, canals
      if (Math.abs(T.heightAt(e + 32, -nn) - T.heightAt(e - 32, -nn)) / 64 > 0.06) continue; // steep ground
      open++; if (landUseAt(Z, e, -nn).use === 'irrigated') cult++; }
    console.log({ open, cult }); expect(open).toBeGreaterThan(200); expect(cult / open).toBeGreaterThan(0.7);
  });
  it('the Terrace foot and the quarters are trodden; the far plain is not', () => {
    expect(groundAt(G, -80, 122)[1]).toBeGreaterThan(0.6);
    const q = plan.sites.find(s => s.meta.kind === 'quarter')!; expect(groundAt(G, q.frame.c[0], q.frame.c[1])[1]).toBeGreaterThan(0.4);
    expect(groundAt(G, 1900, -1900)[1]).toBe(0); expect(groundAt(G, 5000, 0)).toEqual([99, 0, 1]);
  });
});

describe('the plain at a distance', () => {
  it('rain-fed land: crop and fallow years by district keep the data mix (40 % barley)', () => {
    expect((ROTATION.crop + ROTATION.fallow) / 2).toBeCloseTo(RAINFED_BARLEY, 9);
    let crop = 0, n = 0; for (let i = 0; i < 4000; i++) { const p = plotAt(-30000 + (i * 7919) % 60000, -30000 + (i * 104729) % 60000); n++; if (rainfedThreshold(p.dc) === ROTATION.crop) crop++; }
    expect(Math.abs(crop / n - 0.5)).toBeLessThan(0.06);
  });
  it('the terrain material with the hills, the town ground and the rotation generates WGSL', () => {
    const canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
    const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: G });
    const pg = new PlainGround(Z, D); pg.setDay(102);
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    const sun = new THREE.DirectionalLight(0xffffff, 3); scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun);
    const g = new THREE.PlaneGeometry(2, 2); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(0.5), 3));
    const mesh = new THREE.Mesh(g, pg.material); const b = new (THREE as any).WGSLNodeBuilder(mesh, r);
    b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
    expect(String(b.fragmentShader).length).toBeGreaterThan(1000);
  });
});
