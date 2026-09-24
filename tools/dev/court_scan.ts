// The court in full assembly (D-182, B11): a scan of viewpoints ON the Terrace (the Gate, the forecourt, the way to the
// Apadana, the courts E of it) × 16 headings for the most people visible by the 2.5-D sightlines (sightline.ts), with
// the court resident, at a day and hour. Eye 1.6 m, 70° vertical field of view at 16:9, people within 600 m.
// Usage: npx tsx tools/dev/court_scan.ts [day=30] [hour=10] [e0 e1 n0 n1 step]   → prints the ten best views
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { PopGeo } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { Sightlines } from '../../src/people/sightline';
import { buildTerrace } from '../../src/arch/terrace';

const a = process.argv.slice(2).map(Number); const day = a[0] ?? 30, hour = a[1] ?? 10; const [e0, e1, n0, n1, st] = a.length >= 7 ? a.slice(2, 7) : [-45, 110, -60, 140, 5];
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env, { court: true }), plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
const view = new PopView(sim, geo, 1); const t = day * 24 + hour; sim.jumpTo(t); view.settle(t, [40, 40]);
const ppl: [number, number, number][] = view.query([40, 40], 900).map(o => [o.e, o.n, o.y]); for (const x of sim.agents) if (!x.offmap) ppl.push([x.pos[0], x.pos[1], x.y]);
const sl = new Sightlines(geo, buildTerrace().parts); const rows: { e: number; n: number; hd: number; vis: number }[] = [];
const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000), v = new THREE.Vector3();
for (let e = e0; e <= e1; e += st) for (let n = n0; n <= n1; n += st) {
  if (!nav.walkable(e, n)) continue; const y0 = nav.heightAt(e, n) + 1.6, eye: [number, number, number] = [e, n, y0];
  const seen: [number, number, number][] = []; for (const [x, yN, y] of ppl) { const dd = Math.hypot(x - e, yN - n); if (dd > 600 || dd < 0.8) continue; if (sl.see(eye, [x, yN, y + 1.62]) || sl.see(eye, [x, yN, y + 1.25])) seen.push([x, yN, y]); }
  for (let hd = 0; hd < 360; hd += 22.5) { cam.position.set(e, y0, -n); const r = hd * Math.PI / 180; cam.lookAt(e + Math.sin(r) * 10, y0 + Math.tan(-2 * Math.PI / 180) * 10, -(n + Math.cos(r) * 10)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let vis = 0; for (const [x, yN, y] of seen) if (fr.containsPoint(v.set(x, y + 1.2, -yN))) vis++; rows.push({ e, n, hd, vis }); }
}
rows.sort((p, q) => q.vis - p.vis);
const top = rows.slice(0, 10); console.log(`day ${day} ${hour}:00, ${ppl.length} people within 900 m of the Terrace, ${rows.length / 16} viewpoints:`); for (const r of top) console.log(JSON.stringify(r));
mkdirSync('bench-reports', { recursive: true }); writeFileSync(`bench-reports/court-scan-d${day}-h${hour}.json`, JSON.stringify({ day, hour, box: [e0, e1, n0, n1, st], people: ppl.length, top: rows.slice(0, 40) }, null, 1));
