// Pop-in diagnosis for the court walk (D-182): the walk of tests/court_view.test.ts through the population view alone; a
// person out of doors within 50 m in view who was not out of doors (within 60 m) in the previous frame and did not come
// through a door is printed with what the view said of them in the frames before.
// Usage: npx tsx tools/dev/court_popin.ts [day=30] [hour=7.67]
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { PopGeo, routeAt, type Spot, type Route } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';

const a = process.argv.slice(2).map(Number); const d = a[0] ?? 30; let t = d * 24 + (a[1] ?? 7.67);
const W = new WeatherSystem(1);
const env = (x: number): Env => { const dd = Math.floor(x / 24), c = W.conditions(dd, x - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env, { court: true }), plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
const view = new PopView(sim, geo, 1); sim.jumpTo(t);
const at = (e: number, n: number, anchor: string): Spot => ({ e, n, out: true, heading: 0, net: 'nav', anchor, what: '', ok: true });
const legs = [geo.route(at(-52, 118.5, 'stair_foot'), at(0, 100, 'forecourt')), geo.route(at(0, 100, 'forecourt'), at(0, 58, 'forecourt')), geo.route(at(0, 58, 'forecourt'), at(150, 142, 'court_guard_mess'))] as Route[];
view.settle(t, [-52, 118.5]);
const q = { e: 0, n: 0, heading: 0 }; let prev = new Set<number>(); const last = new Map<number, string>(); let frames = 0, pops = 0;
const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000), v = new THREE.Vector3();
for (const r of legs) for (let s = 0; s < r.len; s += 1.4 * 0.25) {
  routeAt(r, s, q); t += 0.25 / 3600; sim.step(0.25); view.update(t, [q.e, q.n]); frames++;
  const g = nav.heightAt(q.e, q.n) + 1.6; cam.position.set(q.e, g, -q.n); const rr = q.heading * Math.PI / 180; cam.lookAt(q.e + Math.sin(rr) * 10, g, -(q.n + Math.cos(rr) * 10)); cam.updateMatrixWorld();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const now = new Set<number>();
  for (const o of view.query([q.e, q.n], 60)) { now.add(o.pid); const dd = Math.hypot(o.e - q.e, o.n - q.n);
    if (frames > 2 && !prev.has(o.pid) && dd < 50 && o.entry !== 1 && fr.containsPoint(v.set(o.e, o.y + 1, -o.n))) { pops++; const h = t - d * 24;
      console.log(`pop-in frame ${frames} (${h.toFixed(4)} h) p${o.pid} ${sim.pop.court?.roleOf(o.pid) ?? sim.pop.persons[o.pid].job} @${dd.toFixed(1)} m: now "${o.what}" act ${o.act} moving ${o.moving}; before: "${last.get(o.pid) ?? '(not near)'}"`);
      const segs = sim.pop.plan(o.pid, d); for (const x of segs) if (x.t1 > h - 0.3 && x.t0 < h + 0.1) console.log(`   ${x.t0.toFixed(4)}-${x.t1.toFixed(4)} ${x.where} ${x.place} ${x.act} ${x.why}`); } }
  for (const [pid] of last) if (!now.has(pid)) last.delete(pid);
  for (const pid of now) last.set(pid, view.describe(pid));
  // also remember what the view says of the people near who are not out of doors
  prev = now;
}
console.log(`frames ${frames}, pop-ins ${pops}; view ${JSON.stringify(view.stats)}`);
