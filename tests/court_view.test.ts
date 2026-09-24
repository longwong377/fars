// The court in full assembly, drawn (D-182; B11, B12, B13): with the court setting the court's people are drawn by the
// population view and the crowd like everyone else. Measured in node: the court's places resolve in the built world; the
// crowd at the COURT scenes of tests/e2e/crowd_scale.spec.ts and at the views with the most people visible found by the
// scan of the 2.5-D sightlines (tools/dev/court_scan.ts; sightline.ts as tests/popview.test.ts): everyone out of doors in
// view drawn, no placeholder performance, the visible counted, the people's main-pass triangles.
// The numbers go to bench-reports/court-view.json (the lead renders the browser frames: tests/e2e/crowd_scale.spec.ts).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { PopGeo, routeAt, type Spot, type Route } from '../src/people/popgeo';
import { PopView } from '../src/people/popview';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from './plainLib';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, type OutfitBuild } from '../src/people/outfits';
import { bakeImpostors, CrowdImpostors, type ImpostorAtlas } from '../src/people/impostors';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd, MAX_FULL } from '../src/people/crowd';
import { Sightlines } from '../src/people/sightline';
import { buildTerrace } from '../src/arch/terrace';
import { COURT_PLACES } from '../src/people/court';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid, sim: PeopleSim, plan: TownPlan, geo: PopGeo, view: PopView, terrain: ReturnType<typeof loadTerrain>, A: HumanAssets, O: OutfitBuild, atlas: ImpostorAtlas;
const OUT: Record<string, unknown> = {};
const save = () => { mkdirSync('bench-reports', { recursive: true }); let old: Record<string, unknown> = {}; try { old = JSON.parse(readFileSync('bench-reports/court-view.json', 'utf8')); } catch { /* first */ } writeFileSync('bench-reports/court-view.json', JSON.stringify({ ...old, ...OUT }, null, 1)); };
beforeAll(async () => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env, { court: true }); plan = buildTownPlan(); terrain = loadTerrain(); const rivers = loadRiversFile(); const canals = buildCanals(terrain, rivers.rivers, 1);
  const villages = placeVillages(terrain, rivers.rivers, canals, 1);
  geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
  view = new PopView(sim, geo, 1);
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }); atlas = bakeImpostors(A, O);
}, 600_000);

const camAt = (e: number, n: number, headingDeg: number, pitch = 0) => { const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000); const g = nav.heightAt(e, n); const y = (Number.isFinite(g) ? g : terrain.heightAt(e, -n)) + 1.6;
  cam.position.set(e, y, -n); const r = headingDeg * Math.PI / 180; cam.lookAt(e + Math.sin(r) * 10, y + Math.tan(pitch * Math.PI / 180) * 10, -(n + Math.cos(r) * 10)); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); return cam; };
const makeCrowd = () => { const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
  const crowd = new Crowd(sim, 1, humans); crowd.view = view; crowd.imp = new CrowdImpostors(atlas); crowd.looksPerFrame = 1e9; return crowd; };

describe('the court in full assembly, drawn (D-182)', () => {
  it('the court’s places resolve in the built world (every Terrace place, the camp)', () => {
    const K = sim.pop.court!, bad: string[] = [];
    for (const p of COURT_PLACES) { const sp = geo.spot(K.first, p.id, 'rest', 10, 10); if (!sp.ok || !sp.out) bad.push(`${p.id}: ${sp.what}`); }
    for (let pid = K.first; pid < K.first + 200; pid++) { const sp = geo.spot(pid, 'court_camp', 'rest', 10, 10); if (!sp.ok) bad.push(`camp ${pid}: ${sp.what}`); }
    // a sample of every court person's places over two days
    let n = 0, ok = 0; for (let pid = K.first; pid < K.end; pid += 7) for (const d of [3, 40]) { if (!sim.pop.present(pid, d)) continue;
      for (const s of sim.pop.plan(pid, d)) { if (s.where === 'road' || s.where === 'away') continue; n++; if (geo.spot(pid, s.place, s.act, d, (s.t0 + s.t1) / 2).ok) ok++; else if (bad.length < 20) bad.push(`${pid} ${s.place}`); } }
    expect(bad).toEqual([]); expect(ok).toBe(n);
  });
  // the scenes: the COURT scenes of tests/e2e/crowd_scale.spec.ts, and the views with the most people visible found by the
  // scan (tools/dev/court_scan.ts: 1,034 viewpoints on the Terrace every 5 m × 16 headings, day 0 10:00: the W end of the
  // forecourt looking E, 741; the foot of the Apadana's N portico looking NNW, 709; a coarse scan of the Terrace every 15 m
  // and the hillside, × 8 headings: the hillside at [330, 20] looking W, 2,816 on day 0 and 3,191 on day 30)
  const SC: [string, number, number, number, number, number, number][] = [
    ['court-forecourt', 0, 10, 20, 80, 135, -2], ['court-from-hillside', 0, 10, 290, -20, 270, -8],
    ['court-forecourt-w', 0, 10, -35, 85, 90, -2], ['court-apadana-n', 0, 10, 0, 55, 337.5, -2], ['court-hillside-best', 30, 10, 330, 20, 270, -2], ['court-forecourt-w-day30', 30, 10, -35, 85, 90, -2]];
  it('the COURT scenes and the scan’s best views: everyone out of doors in view drawn, no placeholder, the visible counted (≥ 300 in the best view on the Terrace: B11), the people’s triangles', () => {
    const sl = new Sightlines(geo, buildTerrace().parts), rows: string[] = [], res: Record<string, unknown> = {}, _v = new THREE.Vector3();
    for (const [name, d, h, e, n, hd, pitch] of SC) {
      sim.jumpTo(d * 24 + h); view.settle(d * 24 + h, [e, n]); const crowd = makeCrowd(), cam = camAt(e, n, hd, pitch); crowd.drawnKeys = new Set();
      for (let f = 0; f < 3; f++) crowd.update(f / 30, cam.position, cam.position, cam);
      const st = crowd.stats(), pts = crowd.drawnPoints(), fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const missing: string[] = []; let simIn = 0, courtIn = 0; const K = sim.pop.court!;
      const camPlot = geo.plotAt(e, n);
      for (const o of view.query([e, n], 5000)) { if (o.agent >= 0) continue; if (!fr.containsPoint(_v.set(o.e, o.y + 1, -o.n))) continue; const dd = Math.hypot(o.e - cam.position.x, o.y + 0.9 - cam.position.y, -o.n - cam.position.z); if (dd > 4990) continue;
        simIn++; if (K.owns(o.pid)) courtIn++; void camPlot; if (!crowd.drawnKeys!.has(o.pid)) missing.push(`p${o.pid} ${o.what}`); }
      const eye: [number, number, number] = [cam.position.x, -cam.position.z, cam.position.y]; let inF = 0, vis = 0;
      for (let i = 0; i < pts.length; i += 5) { const x = pts[i], y = pts[i + 1], z = pts[i + 2], hh = pts[i + 3]; if (!fr.containsPoint(_v.set(x, y + 0.72 * hh, z))) continue; inF++;
        if (sl.see(eye, [x, -z, y + 0.93 * hh]) || sl.see(eye, [x, -z, y + 0.72 * hh])) vis++; }
      res[name] = { day: d, hour: h, at: [e, n], heading: hd, pitch, simulatedInView: simIn, courtInView: courtIn, drawnInView: inF, visible: vis, skinnedByLod: st.byLod, impostors: st.impostors, peopleTrianglesM: +(st.triangles / 1e6).toFixed(2), propTrianglesM: +(st.propTriangles / 1e6).toFixed(2), props: st.props, workObjectsM: +(st.things.triangles / 1e6).toFixed(3), animalsM: +(st.animals.triangles / 1e6).toFixed(3), placeholderActs: st.placeholderActs + st.impPerf.placeholders, missing: missing.length };
      rows.push(`${name}: ${JSON.stringify(res[name])}`);
      expect(missing.slice(0, 5), name).toEqual([]); expect(st.placeholderActs, name).toBe(0); expect(st.impPerf.placeholders, name).toBe(0);
      expect(st.byLod[0]).toBeLessThanOrEqual(MAX_FULL);
    }
    OUT.scenes = res; save(); console.log(rows.join('\n'));
    // the brief's floor (§9.2: ≥ 300 visible in the busiest scenes, e.g. a court day in the Apadana forecourt): in the best
    // view on the Terrace, by the node sightlines (the browser's depth probe is the lead's: crowd_scale.spec.ts)
    expect((res['court-forecourt-w'] as any).visible).toBeGreaterThanOrEqual(300);
  }, 1_800_000);
  it('no pop-in within 50 m in view on a walk up the Grand Stair, through the Gate and the forecourt to the Apadana and round to the guards’ court, the court resident (1× time, day 30 from 07:40: the court coming up)', () => {
    const d = 30; let t = d * 24 + 7.67; sim.jumpTo(t); const crowd = makeCrowd(); const pops: string[] = []; crowd.onPopIn = (w, dd) => pops.push(`${w} @${dd.toFixed(1)} m`);
    const at = (e: number, n: number, anchor: string): Spot => ({ e, n, out: true, heading: 0, net: 'nav', anchor, what: '', ok: true });
    const legs = [geo.route(at(-52, 118.5, 'stair_foot'), at(0, 100, 'forecourt')), geo.route(at(0, 100, 'forecourt'), at(0, 58, 'forecourt')), geo.route(at(0, 58, 'forecourt'), at(150, 142, 'court_guard_mess'))];
    expect(legs.every(r => r)).toBe(true);
    const q = { e: 0, n: 0, heading: 0 }; let frames = 0; view.settle(t, [-52, 118.5]);
    for (const r of legs as Route[]) for (let s = 0; s < r.len; s += 1.4 * 0.25) { routeAt(r, s, q); t += 0.25 / 3600; sim.step(0.25); view.update(t, [q.e, q.n]); const cam = camAt(q.e, q.n, q.heading); crowd.update(t * 3600, cam.position, cam.position, cam); frames++; }
    OUT.popin = { frames, metres: +(legs as Route[]).reduce((a, r) => a + r.len, 0).toFixed(0), popins: pops.length, examples: pops.slice(0, 5), doorEntries: crowd.impPerf.doorEntries }; save(); console.log(JSON.stringify(OUT.popin));
    expect(pops).toEqual([]);
  }, 900_000);
});
