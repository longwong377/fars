// dev (s18 C5, D-692): who the crowd draws against who the view places, headless. The offline world (people on, the court
// resident), the crowd fed by the population view as world.ts feeds it, the coverage page's sequence at each view: the
// clock set to the view's day and hour (sim.jumpTo), the view settled (world.settle), then frames. Counts within R m and
// in the camera's frustum: placed by the view (and the detailed agents), drawn as bodies (crowd.persons shown this frame)
// and as impostors. Usage: npx tsx tools/dev/drawcount.ts [--r 40] [--frames 3]
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildOfflineWorld } from './lib/offline_world';
import { buildOutfits } from '../../src/people/outfits';
import { bakeImpostors, CrowdImpostors } from '../../src/people/impostors';
import { HumanGPU } from '../../src/people/humanGPU';
import { Crowd } from '../../src/people/crowd';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const R = flag('--r', 40), FRAMES = flag('--frames', 3);
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true });
const sim = W.sim!, view = W.view!, T = W.T;
const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }), atlas = bakeImpostors(A, O);
const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
const crowd = new Crowd(sim, 1, humans as any); crowd.view = view; crowd.imp = new CrowdImpostors(atlas); crowd.looksPerFrame = 1e9;
const P = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points as any[];
const views = [...['cov-252', 'cov-294', 'cov-350', 'cov-037', 'cov-098', 'cov-142', 'cov-266'].map(id => P.find(p => p.id === id)),
  { id: 'c6-lane', e: -478, n: -881, eye: 1.6, az: 189, pitch: -4, day: 0, hour: 10 }];
const ground = (e: number, n: number) => { const g = W.nav.walkable(e, n) ? W.nav.heightAt(e, n) : NaN; return Number.isFinite(g) ? g : T.surfaceAt(e, -n); };
let time = 0;
for (const v of views) {
  const t = v.day * 24 + v.hour; sim.jumpTo(t);
  const y = ground(v.e, v.n) + v.eye, cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000), r = v.az * Math.PI / 180;
  cam.position.set(v.e, y, -v.n); cam.lookAt(v.e + Math.sin(r) * 10, y + Math.tan((v.pitch ?? 0) * Math.PI / 180) * 10, -(v.n + Math.cos(r) * 10)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const inView = (x: number, yy: number, z: number) => fr.containsPoint(new THREE.Vector3(x, yy + 1, z)) && Math.hypot(x - v.e, -z - v.n) < R;
  view.settle(sim.t, [v.e, v.n]);
  const pl = new THREE.Vector3(v.e, y - 1.6, -v.n);
  for (let f = 0; f < FRAMES; f++) { view.update(sim.t, [v.e, v.n]); crowd.update(time += 1 / 30, cam.position, pl, cam); }
  let placed = 0, agents = 0; const near = view.query([v.e, v.n], R); for (const o of near) if (inView(o.e, o.y, -o.n)) placed++;
  const bear = near.slice(0, 400).map(o => Math.round(((Math.atan2(o.e - v.e, o.n - v.n) * 180 / Math.PI - v.az + 540) % 360 - 180) / 30) * 30); const bh: Record<number, number> = {}; for (const x of bear) bh[x] = (bh[x] ?? 0) + 1;
  for (const a of sim.agents) if (!a.offmap && inView(a.pos[0], a.y, -a.pos[1])) agents++;
  let bodies = 0; for (const p of crowd.persons.values()) if (p.shown && p.drawnFrame === (crowd as any).frame && inView(p.root[0], p.root[1], p.root[2])) bodies++;
  let imps = 0; const IL = (crowd as any).impList as any[]; for (let i = 0; i < (crowd as any).nImp; i++) { const e = IL[i]; if (inView(e.x, e.y, e.z)) imps++; }
  console.log(`${v.id.padEnd(8)} d${v.day} ${v.hour.toFixed(2)}h: within ${R} m ${near.length} (bearing from the view's axis ${JSON.stringify(bh)}); in view: placed ${placed} (+${agents} agents) | bodies drawn ${bodies}, impostor candidates ${imps} | crowd ${JSON.stringify({ drawn: crowd.perf.drawn, attached: crowd.perf.attached, imp: crowd.impPerf.drawn, rigClear: (crowd as any).rigClear })} | view pending ${view.stats.pending}`);
}
process.exit(0);
