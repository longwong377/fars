// D-227: the near plain below the Terrace, as the stair's top sees it (plain.spec stair-noon-plain: grid (−36.4, 122.45), 1.6 m
// over the landing, true azimuth 251°, pitch −3°, 40° lens). What survives the pixel footprint at 40-400 m from ~14 m up:
// things that stand up off the ground (the tether lines' animals, loads, heaps), bands along the view (the approach worn as a
// track), and herbs in patches large enough to span many pixels. Measured here: where they are, how many, and their cost
// against the plain view budget (≤ 10 draw calls, ≤ 0.5 M triangles added: README budgets).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { waterPlan } from '../src/arch/waterworks';
import { buildTownPlan } from '../src/world/settlement/plan';
import { buildTownGround, groundAt, herbPatch, TERRACE_BOX, FAN, PATCH, type GroundMap } from '../src/world/plain/townGround';
import { TerraceFoot, footSlots, footAnimal, FOOT_LINES, STAIR_FOOT, heapsGeometry, footHeaps, loadGeometry } from '../src/world/terraceFoot';
import { Animals, type AnimalInst } from '../src/people/animals';
import { APPROACH_W } from '../src/world/settlement/water';
import { inFrustum, type Cam } from './lib/townLos';
import { loadTerrain } from './plainLib';

const T = loadTerrain(), H = (e: number, n: number) => T.heightAt(e, -n);
const CAM: Cam = { n: 'stair-noon-plain', e: -36.4, n_: 122.45, eye: 1.6, absY: 1.6, az: 251, pitch: -3, fov: 40, hour: 11, aspect: 16 / 9 };
const eye = new THREE.Vector3(CAM.e, CAM.absY!, -CAM.n_);
let G0: GroundMap, G: GroundMap, drains: { at: [number, number]; n: [number, number] }[];
beforeAll(() => {
  const B = buildTerrace(), plan = buildTownPlan();
  drains = waterPlan(B.parts, H).drains.map(d => ({ at: d.at as [number, number], n: d.n as [number, number] }));
  G0 = buildTownGround(plan, [], [], false); G = buildTownGround(plan, [], drains);
}, 240_000);

describe('herbs at the foot: patches between the paths and fans below the drains (D-227)', () => {
  it('about a third of the foot keeps herb in patches tens of metres across; the approach itself stays trodden', () => {
    let n = 0, patch = 0, cut = 0; const runs: number[] = []; let run = 0;
    for (let e = -560; e <= -80; e += 4) { const p = herbPatch(e, 60), t0 = groundAt(G0, e, 60)[1], t1 = groundAt(G, e, 60)[1]; void t0; if (p > 0.5) run += 4; else if (run) { runs.push(run); run = 0; } void t1; }
    for (let e = -600; e <= TERRACE_BOX.e0; e += 4) for (let nn = -150; nn <= 300; nn += 4) { const a = groundAt(G0, e, nn)[1]; if (a < 0.2) continue; n++; const b = groundAt(G, e, nn)[1];
      if (herbPatch(e, nn) > 0.5) patch++; if (b < a * 0.7) cut++; }
    const mean = runs.reduce((s, r) => s + r, 0) / Math.max(1, runs.length);
    console.log(`foot W of the Terrace: ${n} trodden samples, in a patch ${(100 * patch / n).toFixed(1)} %, herb back (trodden share cut ≥ 30 %) ${(100 * cut / n).toFixed(1)} %; patch runs along n = 60: ${runs.length}, mean ${mean.toFixed(0)} m`);
    expect(cut / n).toBeGreaterThan(0.2); expect(cut / n).toBeLessThan(0.5); expect(mean).toBeGreaterThan(15);
    for (let e = -560; e <= -70; e += 10) expect(groundAt(G, e, 120.5)[1]).toBeCloseTo(groundAt(G0, e, 120.5)[1], 5); // within PATCH.clear of the approach
    expect(PATCH.clear).toBeGreaterThan(APPROACH_W / 2);
  });
  it('below each W and S drain mouth a fan of herbs runs out from the wall', () => {
    expect(drains.length).toBeGreaterThanOrEqual(8); let ok = 0, eligible = 0;
    for (const d of drains) { const p = (t: number): [number, number] => [d.at[0] + d.n[0] * t, d.at[1] + d.n[1] * t];
      const a0 = groundAt(G0, ...p(5))[1], a1 = groundAt(G, ...p(5))[1], far0 = groundAt(G0, ...p(FAN.len + 8))[1], far1 = groundAt(G, ...p(FAN.len + 8))[1];
      if (a0 < 0.2) continue; eligible++; if (a1 < a0 * (FAN.keep + 0.2) && (herbPatch(...p(FAN.len + 8)) > 0 || Math.abs(far1 - far0) < 0.02)) ok++; }
    console.log(`drain fans: ${ok} of ${eligible} drains on trodden ground (${drains.length} drains) with the herbs back 5 m out, and not beyond the fan`);
    expect(eligible).toBeGreaterThanOrEqual(4); expect(ok).toBeGreaterThanOrEqual(Math.ceil(eligible * 0.8));
  });
});

describe('the tether lines at the stair foot (D-227)', () => {
  it('stand 50-120 m W of the stair foot, in the stair view\'s frame at 40-400 m, filled by day and empty at night', () => {
    const slots = footSlots(); expect(slots.length).toBeGreaterThan(40);
    for (const s of slots) { const d = Math.hypot(s.e - CAM.e, s.n - CAM.n_); expect(d).toBeGreaterThan(40); expect(d).toBeLessThan(400);
      expect(inFrustum(CAM, eye, new THREE.Vector3(s.e, H(s.e, s.n) + 0.8, -s.n))).toBe(true);
      expect(Math.hypot(s.e - STAIR_FOOT[0], s.n - STAIR_FOOT[1])).toBeGreaterThan(40); expect(Math.hypot(s.e - STAIR_FOOT[0], s.n - STAIR_FOOT[1])).toBeLessThan(120); }
    const o = {} as AnimalInst & { e: number; n: number }, count = (day: number, h: number) => slots.filter(s => footAnimal(s, day, h, 1, 0, o)).length;
    const noon = count(0, 11), night = count(0, 22), dawn = count(0, 5.5), days = Array.from({ length: 30 }, (_, d) => count(d, 11));
    console.log(`animals at the lines: day 0 11:00 ${noon}, 05:30 ${dawn}, 22:00 ${night}; over 30 days at 11:00 ${Math.min(...days)}-${Math.max(...days)}`);
    expect(noon).toBeGreaterThan(8); expect(night).toBe(0); expect(dawn).toBe(0); expect(Math.min(...days)).toBeGreaterThan(3);
    expect(FOOT_LINES.length).toBe(2);
  });
  it('costs at most 6 draw calls and well under 0.5 M triangles in the plain view (animals, loads, heaps; the approach track and herbs add none)', () => {
    const foot = new TerraceFoot(1, H), A = new Animals(); A.begin(0); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    foot.update(0, 11, 0, a => { m4.compose(new THREE.Vector3(a.e, H(a.e, a.n), -a.n), q, new THREE.Vector3(1, 1, 1)); A.push(a, m4); }); A.end();
    const st = A.stats(), heaps = heapsGeometry(footHeaps(1), H), load = loadGeometry(), loadsN = (foot as any).loads.count as number;
    const tris = st.triangles + heaps.index!.count / 3 + (load.index!.count / 3) * loadsN, draws = st.draws + 1 + (loadsN ? 1 : 0);
    console.log(`stair foot at 11:00: ${foot.occupied} animals (${st.draws} species draws, ${(st.triangles / 1e3).toFixed(1)} k tris), ${loadsN} loads, heaps ${heaps.index!.count / 3} tris; total ${draws} draws, ${(tris / 1e3).toFixed(1)} k tris`);
    expect(draws).toBeLessThanOrEqual(6); expect(tris).toBeLessThan(0.5e6);
  });
});
