// D-692 (s18 C12's hole C1, "life simulated but not drawn"): the crowd draws the people the view places, a second after a
// jump in time with no settle (the player's wait or a coverage page's setTime), and the town's lanes hold their share of
// the people out of doors (the lane outside the street door: popview doorstep). Headless: the offline world, the crowd fed
// by the population view as world.ts feeds it, the impostors baked; counted in the camera's frustum within 40 m.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildOfflineWorld, type OfflineWorld } from '../tools/dev/lib/offline_world';
import { decodeHumanAssets, meshoptSimplify } from '../src/people/humanAssets';
import { buildOutfits } from '../src/people/outfits';
import { bakeImpostors, CrowdImpostors } from '../src/people/impostors';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd } from '../src/people/crowd';
import { TownWalk } from '../src/world/settlement/walk';
import { LANE, SQUARE } from '../src/world/settlement/site';

let W: OfflineWorld, crowd: Crowd;
beforeAll(async () => {
  W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true });
  const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }), img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
  crowd = new Crowd(W.sim!, 1, { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } } as any);
  crowd.view = W.view!; crowd.imp = new CrowdImpostors(bakeImpostors(A, O)); crowd.looksPerFrame = 1e9;
}, 900_000);
// town views of the coverage set (cov-266 courts, cov-037 courts) and C6's lane (q_s1)
const VIEWS = [{ id: 'cov-266', e: -327.94, n: -883.49, az: 178.6, pitch: -2, day: 184, hour: 14.03 }, { id: 'cov-037', e: -535.43, n: 401.14, az: 29.5, pitch: -3.8, day: 14, hour: 11.07 },
  { id: 'c6-lane', e: -478, n: -881, az: 189, pitch: -4, day: 0, hour: 10 }];
describe('the people the view places are drawn (D-692)', () => {
  it('three seconds after a jump in time (no settle), the crowd draws at least 90 % of the people the view places in view within 40 m, and the view places at least 80 % of what a settle would', () => {
    const sim = W.sim!, view = W.view!, rows: string[] = []; let time = 0;
    for (const v of VIEWS) {
      const t = v.day * 24 + v.hour; sim.jumpTo(t);
      const g = W.T.surfaceAt(v.e, -v.n), y = g + 1.6, cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000), r = v.az * Math.PI / 180;
      cam.position.set(v.e, y, -v.n); cam.lookAt(v.e + Math.sin(r) * 10, y + Math.tan(v.pitch * Math.PI / 180) * 10, -(v.n + Math.cos(r) * 10)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const inView = (x: number, yy: number, z: number) => fr.containsPoint(new THREE.Vector3(x, yy + 1, z)) && Math.hypot(x - v.e, -z - v.n) < 40;
      const placedNow = () => view.query([v.e, v.n], 40).filter(o => inView(o.e, o.y, -o.n)).length;
      const drawnNow = () => { let n = 0; for (const p of crowd.persons.values()) if (p.shown && p.drawnFrame === (crowd as any).frame && inView(p.root[0], p.root[1], p.root[2])) n++;
        const IL = (crowd as any).impList as any[]; for (let i = 0; i < (crowd as any).nImp; i++) if (inView(IL[i].x, IL[i].y, IL[i].z)) n++; return n; };
      for (let f = 0; f <= 90; f++) { view.update(sim.t + f / 30 / 3600, [v.e, v.n]); crowd.update(time += 1 / 30, cam.position, new THREE.Vector3(v.e, g, -v.n), cam); }
      const live = placedNow(), drawn = drawnNow();
      view.settle(sim.t + 91 / 30 / 3600, [v.e, v.n]); const settled = placedNow();
      rows.push(`${v.id}: three seconds after the jump ${live} placed, ${drawn} drawn; settled ${settled}`);
      expect(drawn, `${v.id}: drawn of placed`).toBeGreaterThanOrEqual(Math.floor(0.9 * live));
      expect(live, `${v.id}: placed live against settled`).toBeGreaterThanOrEqual(Math.floor(0.8 * settled));
      expect(settled, `${v.id}: somebody in view`).toBeGreaterThan(0);
    }
    console.log(rows.join('\n'));
  }, 900_000);
  it("a jump to the court's gift day (day 19, 08:30): two seconds on, the view places at least half of the people a settle puts within 60 m of the Apadana's N court (C6's frame: 6 of 300+)", () => {
    const sim = W.sim!, view = W.view!, c: [number, number] = [1.9, 75], t = 19 * 24 + 8.5; sim.jumpTo(t);
    for (let f = 0; f <= 60; f++) view.update(t + f / 30 / 3600, c); const live = view.query(c, 60).filter(o => o.agent < 0).length;
    view.settle(t + 61 / 30 / 3600, c); const settled = view.query(c, 60).filter(o => o.agent < 0).length;
    console.log(`gift day, two seconds after the jump: ${live} placed of ${settled} a settle places`); expect(live).toBeGreaterThanOrEqual(0.5 * settled); expect(settled).toBeGreaterThan(300);
  }, 900_000);
  it('a jump in time leaves nobody where the state before it put them (C12 T1): the court day 40 -> day 200, the court away', () => {
    const sim = W.sim!, view = W.view!, c: [number, number] = [0, 80], at = () => view.query(c, 80).filter(o => o.agent < 0 && /forecourt|portico|apadana/.test(o.what)).length;
    sim.jumpTo(40 * 24 + 10); view.settle(sim.t, c); const before = at(); expect(before).toBeGreaterThan(100);
    const t2 = 200 * 24 + 8.8; sim.jumpTo(t2); view.update(t2, c); const after = at();
    console.log(`at the court's places: day 40 ${before}, the first update after the jump to day 200: ${after}`); expect(after).toBe(0);
  }, 900_000);
  it('the lanes hold their share: by day a quarter of the people out of doors within 25 m of a lane point stand or walk in the lane (the mean of three; each at least 15 %)', () => {
    const sim = W.sim!, view = W.view!, tw = TownWalk.fromPlan(W.settlement!.plan), rows: string[] = [], shares: number[] = [];
    for (const [name, c, d, h] of [['q_s1 lane', [-478, -881], 0, 10], ['q_w2 lane', [-1026, 487], 25, 10], ['q_n1', [-236, 711], 25, 16]] as [string, [number, number], number, number][]) {
      sim.jumpTo(d * 24 + h); view.settle(sim.t, c);
      const q = view.query(c, 25).filter(o => o.agent < 0 && !o.indoor); let lane = 0;
      for (const o of q) { const l = tw.locate(o.e, o.n); if (l) { const k = tw.boxes[l.si].s.cell[l.k]; if (k === LANE || k === SQUARE) lane++; } }
      rows.push(`${name} d${d} ${h}h: ${lane} of ${q.length} in the lane`); shares.push(lane / Math.max(1, q.length)); expect(lane / Math.max(1, q.length), name).toBeGreaterThanOrEqual(0.15);
    }
    // (on the mean of the three: q_s1's point is by the Treasury's workshops, whose work stays in their courts)
    expect(shares.reduce((a, b) => a + b, 0) / shares.length).toBeGreaterThanOrEqual(0.25);
    console.log(rows.join('\n') + `\n(doorstep places: ${view.stats.doorstep})`);
  }, 900_000);
});
