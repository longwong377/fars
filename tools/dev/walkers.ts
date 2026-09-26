// dev: walk bots over every walkable area, offline (H workstream; MASTER_PLAN §3 the Walker Test: this is its *wanderer*
// policy over random targets; gates T-H1r, T-H1s and the hard breaks of T-H0). The world is the game's, built headless
// (tools/dev/lib/offline_world.ts: every collider the browser builds, the doors, furnishings, waterworks, the town and the
// plain, the court's camps, the detailed people, the population near the player and the fauna, solid as in the game).
// Per area: random targets (each a place the controller can stand), walked with the game's controller in main.ts simStep
// order at running pace (3.2 m/s; the controller and colliders are the same at walking pace), routed as a person would:
// the walkable grid on the Terrace and its approach, the town's lane graph and doors in the town and the villages, and
// straight across open ground elsewhere (fields, banks, the mountain, camps, Naqsh-e Rustam) with side-steps round
// what is drawn in the way.
// Metrics per area:
//  - reached: share of the random targets reached (T-H1r >= 99 %);
//  - stuck: share of bot time without progress (3 s window, < 0.3 m) (T-H1s <= 0.5 %), and hard stuck events (no 0.5 m of
//    movement in 10 s: T-H0);
//  - falls: feet more than 0.3 m below the drawn ground (T-H0), safety-net rescues (must be 0), drops > 1.5 m (reported);
//  - invisible walls: a stop where nothing drawn stands within 1.2 m ahead at knee, waist or chest height and the drawn
//    ground ahead is walkable (< 40°) (T-H0; D-240);
//  - passable-where-solid: in the town and the villages, a move between raster cells through a wall that has no door (the
//    rasters are what the walls are built from: walk.ts).
// Usage: npx tsx tools/dev/walkers.ts [area,area…|all] [--targets N=200] [--seed S=1] [--json out.json]
//        npx tsx tools/dev/walkers.ts --merge a.json b.json …   (→ bench-reports/walkers-offline.txt and the evidence
//        REVIEWS/evidence/s8-h/T-H1r.json, T-H1s.json: {id, value, n, commit, tool} with the per-area results)
//   areas: terrace approach town compounds precinct burial ajori roads villages fields banks mountain naqsh camps
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three/webgpu';
import { buildOfflineWorld } from './lib/offline_world';
import { TownWalk, passable } from '../../src/world/settlement/walk';
import { PRECINCT, BURIAL } from '../../src/world/settlement/precinct';
import { AJORI } from '../../src/world/settlement/plan';
import { CAMPS } from '../../src/people/camps';
import { NAV } from '../../src/people/navgrid';
import { feature } from '../../src/world/plain/data';
import type { Player } from '../../src/player/player';
import { LANE, SQUARE, OUT, type Site } from '../../src/world/settlement/site';

type P2 = [number, number];
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const ALL = ['terrace', 'approach', 'town', 'compounds', 'precinct', 'burial', 'ajori', 'roads', 'villages', 'fields', 'banks', 'mountain', 'naqsh', 'camps'];
const want = !argv[0] || argv[0].startsWith('--') || argv[0] === 'all' ? ALL : argv[0].split(',');
const N = flag('--targets', 200), SEED = flag('--seed', 1);
const HEAD = 'area | targets | reached | no route | stuck (time share) | hard stuck | fell | rescues | drops>1.5m | invisible walls | stopped by drawn | by a person/animal | by slope | through walls | bot min';
let s = SEED * 7919 + 13; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

// --merge f1.json f2.json …: the per-area results of several runs → the report and the evidence (T-H1r, T-H1s)
if (argv[0] === '--merge') { mergeAndWrite(argv.slice(1)); process.exit(0); }
function mergeAndWrite(files: string[]) {
  const all: Record<string, any> = {}; let meta: any = null;
  for (const f of files) { const j = JSON.parse(readFileSync(f, 'utf8')); meta ??= j.meta; Object.assign(all, j.areas); }
  const ids = Object.keys(all), pct = (r: any) => 100 * r.reached / Math.max(1, r.targets), stuck = (r: any) => 100 * r.stuckT / Math.max(1e-9, r.botT);
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(), tool = 'tools/dev/walkers.ts', pass = 's8-h';
  mkdirSync(`REVIEWS/evidence/${pass}`, { recursive: true });
  const per = Object.fromEntries(ids.map(id => [id, { reached_pct: +pct(all[id]).toFixed(2), targets: all[id].targets, stuck_pct: +stuck(all[id]).toFixed(3), bot_hours: +(all[id].botT / 3600).toFixed(3),
    hard: { stuck: all[id].stuckEvents, fell: all[id].fell, rescues: all[id].rescues, invisible_walls: all[id].walls, through_walls: all[id].throughWalls } }]));
  const worstReach = Math.min(...ids.map(id => pct(all[id]))), worstStuck = Math.max(...ids.map(id => stuck(all[id])));
  // T-H1r: random reachable targets reached per area (the worst area); T-H1s: bot time stuck (the worst area)
  writeFileSync(`REVIEWS/evidence/${pass}/T-H1r.json`, JSON.stringify({ id: 'T-H1r', value: +worstReach.toFixed(2), n: Math.min(...ids.map(id => all[id].targets)), commit, tool, unit: '%', scope: 'area', offline: true, meta, areas: per }, null, 1) + '\n');
  writeFileSync(`REVIEWS/evidence/${pass}/T-H1s.json`, JSON.stringify({ id: 'T-H1s', value: +worstStuck.toFixed(3), n: +Math.min(...ids.map(id => all[id].botT / 3600)).toFixed(3), commit, tool, unit: '%', scope: 'area', offline: true, meta, areas: per }, null, 1) + '\n');
  const out = [`walk bots, offline (tools/dev/walkers.ts at ${commit}; ${meta?.date}; seed ${meta?.seed}; ${meta?.N} targets per area; day 25 10:00, court resident; running pace)`, HEAD,
    ...ids.map(id => row(id, all[id])), '', ...ids.flatMap(id => all[id].examples.map((e: string) => `${id}: ${e}`))];
  writeFileSync('bench-reports/walkers-offline.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
}
function row(id: string, r: any) { return `${id} | ${r.targets} | ${r.reached} (${(100 * r.reached / Math.max(1, r.targets)).toFixed(1)} %) | ${r.noRoute} | ${(100 * r.stuckT / Math.max(1e-9, r.botT)).toFixed(2)} % | ${r.stuckEvents} | ${r.fell} | ${r.rescues} | ${r.drops} | ${r.walls} | ${r.drawnStops} | ${r.livingStops} | ${r.slopeStops} | ${r.throughWalls} | ${(r.botT / 60).toFixed(1)}`; }

const t0 = Date.now();
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true });
console.log(`offline world built in ${(W.buildMs / 1000).toFixed(0)} s`);
const { T, P, nav, scene } = W; scene.updateMatrixWorld(true);
const plan = W.settlement!.plan, townWalk = TownWalk.fromPlan(plan), villages = W.plain!.data.villages;
const vsite = (vi: number) => (W.geo as any).vsite(vi) as { walk: TownWalk; site: Site };
const slope = (x: number, z: number) => { const gx = (T.heightAt(x + 0.75, z) - T.heightAt(x - 0.75, z)) / 1.5, gz = (T.heightAt(x, z + 0.75) - T.heightAt(x, z - 0.75)) / 1.5; return Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI; };

// ---- the areas: a sampler of targets (grid e, n) and a router
type Router = 'nav' | 'town' | 'village' | 'open';
interface Area { id: string; router: Router; sample(): P2 | null; vi?: (p: P2) => number }
const navCell = (keep: (e: number, n: number, h: number) => boolean): P2 | null => { for (let q = 0; q < 400; q++) { const k = Math.floor(rnd() * NAV.w * NAV.h); const v = nav.hcm[k]; if (v === NAV.blocked) continue;
  const e = NAV.e0 + ((k % NAV.w) + 0.5) * NAV.cell, n = NAV.n0 + (Math.floor(k / NAV.w) + 0.5) * NAV.cell; if (nav.walkable(e, n) && keep(e, n, v / 100)) return [e, n]; } return null; };
const siteCell = (sites: Site[], open: boolean): P2 | null => { for (let q = 0; q < 200; q++) { const st = sites[Math.floor(rnd() * sites.length)], k = Math.floor(rnd() * st.W * st.H), c = st.cell[k];
  const ok = open ? c === LANE || c === SQUARE : c >= 0; if (!ok) continue; const loc = townWalk.locate(...st.cellGrid(k)); if (loc) return st.cellGrid(k); } return null; };
const inCircle = (c: P2, r: number): P2 => { const a = rnd() * 2 * Math.PI, d = r * Math.sqrt(rnd()); return [c[0] + d * Math.cos(a), c[1] + d * Math.sin(a)]; };
const inTownSite = (e: number, n: number) => { const l = townWalk.locate(e, n); return !!l && townWalk.boxes[l.si].s.cell[l.k] !== OUT; };
const quarters = plan.sites.filter(q => q.meta.kind === 'quarter' && Math.hypot(q.frame.c[0], q.frame.c[1]) < 3000), comps = plan.sites.filter(q => q.meta.kind === 'compound' && Math.hypot(q.frame.c[0], q.frame.c[1]) < 3500);
const near = villages.map((v, i) => ({ v, i })).filter(q => Math.hypot(q.v.x, q.v.y) < 6000);
const naqsh = feature('nr_kaba').xy as P2, rivers = W.plain!.data.rivers.rivers;
const AREAS: Record<string, Area> = {
  terrace: { id: 'terrace', router: 'nav', sample: () => navCell((e, n, h) => h > -2 && e > -45 && e < 225 && n > -215 && n < 160) },
  approach: { id: 'approach', router: 'nav', sample: () => navCell((e) => e < -45) },
  town: { id: 'town', router: 'town', sample: () => (rnd() < 0.5 ? siteCell(quarters, true) : siteCell(quarters, false)) },
  compounds: { id: 'compounds', router: 'town', sample: () => (rnd() < 0.5 ? siteCell(comps, true) : siteCell(comps, false)) },
  precinct: { id: 'precinct', router: 'open', sample: () => inCircle(PRECINCT.c as P2, 22) },
  burial: { id: 'burial', router: 'open', sample: () => [BURIAL.c[0] + (rnd() * 2 - 1) * BURIAL.half[0], BURIAL.c[1] + (rnd() * 2 - 1) * BURIAL.half[1]] },
  ajori: { id: 'ajori', router: 'open', sample: () => inCircle(AJORI.c, 45) },
  roads: { id: 'roads', router: 'open', sample: () => { const r = plan.roads[Math.floor(rnd() * plan.roads.length)], i = 1 + Math.floor(rnd() * (r.pts.length - 1)), a = r.pts[i - 1], b = r.pts[i], f = rnd();
    const p: P2 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; return Math.hypot(p[0], p[1]) < 4000 ? p : null; } },
  villages: { id: 'villages', router: 'village', sample: () => { const q = near[Math.floor(rnd() * near.length)]; const vs = vsite(q.i).site; for (let k = 0; k < 100; k++) { const c = Math.floor(rnd() * vs.W * vs.H); if (vs.cell[c] >= 0 || vs.cell[c] === OUT) return vs.cellGrid(c); } return null; },
    vi: p => { let b = -1, bd = 1e9; for (const q of near) { const d = Math.hypot(q.v.x - p[0], q.v.y - p[1]); if (d < bd) { bd = d; b = q.i; } } return b; } },
  fields: { id: 'fields', router: 'open', sample: () => { const p = inCircle([-1500, 0], 3500); if (inTownSite(p[0], p[1]) || slope(p[0], -p[1]) > 8 || near.some(q => Math.hypot(q.v.x - p[0], q.v.y - p[1]) < q.v.r + 20) || nav.walkable(p[0], p[1])) return null; return p; } },
  banks: { id: 'banks', router: 'open', sample: () => { const r = rivers[Math.floor(rnd() * rivers.length)], i = Math.floor(rnd() * (r.x.length - 1)), dx = r.x[i + 1] - r.x[i], dy = r.y[i + 1] - r.y[i], L = Math.hypot(dx, dy) || 1, side = rnd() < 0.5 ? -1 : 1, off = r.topWidth / 2 + 1 + rnd() * 5;
    const p: P2 = [r.x[i] - dy / L * off * side, r.y[i] + dx / L * off * side]; return Math.hypot(p[0], p[1]) < 6000 ? p : null; } },
  mountain: { id: 'mountain', router: 'open', sample: () => { const p: P2 = [350 + rnd() * 1550, -1500 + rnd() * 3000]; return slope(p[0], -p[1]) < 36 ? p : null; } },
  naqsh: { id: 'naqsh', router: 'open', sample: () => { const p = inCircle(naqsh, 160); return slope(p[0], -p[1]) < 30 ? p : null; } },
  camps: { id: 'camps', router: 'open', sample: () => { const c = CAMPS[Math.floor(rnd() * CAMPS.length)]; return inCircle(c.c as P2, c.r); } },
};

// ---- a target is a place a body can stand: the floor there, room for the capsule
const shape = new P.R.Capsule(0.6, 0.25), rot = { x: 0, y: 0, z: 0, w: 1 };
function standable(p: P2, router: Router): number | null {
  const x = p[0], z = -p[1]; P.updateTerrain(T, { x, y: 0, z }); W.settlement!.streamColliders(x, z, Infinity); P.step(1e-4);
  const nh = router === 'nav' ? nav.heightAt(p[0], p[1]) : NaN, g = T.heightAt(x, z);
  const floor = P.castRayDown(x, z, Number.isFinite(nh) ? nh + 1.2 : g + (router === 'open' ? 3 : 8));
  if (floor === null) return null;
  if (P.world.intersectionWithShape({ x, y: floor + 0.87 + 0.03, z }, rot, shape)) return null;
  if (router === 'open' && Math.abs(floor - g) < 0.3 && slope(x, z) > 38) return null;
  return floor;
}

// ---- what stopped the bot: the collider ahead (a person or an animal, the terrain, or something else), and for
// anything else whether a drawn surface stands there (any mesh, visible or not in this headless frame, within 1.2 m at
// knee, waist or chest height: the game draws what is near the player)
const rc = new THREE.Raycaster(); rc.far = 1.2;
const drawnAhead = (pl: Player, dx: number, dz: number) => { const p = pl.position, feet = pl.feetY, here = new THREE.Vector3(p.x, feet + 1, p.z); const meshes: THREE.Object3D[] = [];
  scene.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return;
    const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld), r = g.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis(); if (m instanceof THREE.InstancedMesh || c.distanceTo(here) < r + 3) meshes.push(m); });
  for (const h of [0.35, 0.9, 1.45]) for (const a of [-0.5, 0, 0.5]) { const c = Math.cos(a), sn = Math.sin(a), d = new THREE.Vector3(dx * c - dz * sn, 0, dx * sn + dz * c).normalize();
    rc.set(new THREE.Vector3(p.x, feet + h, p.z), d); if (rc.intersectObjects(meshes, false).length) return true; }
  return false; };
const blocker = (pl: Player, dx: number, dz: number): 'living' | 'terrain' | 'other' | null => {
  const p = pl.position, hit = P.world.castShape(p, rot, { x: dx, y: 0, z: dz }, pl.collider.shape, 0, 0.6, true, undefined, undefined, pl.collider, pl.body);
  if (!hit) return null; const c = hit.collider, b = c.parent();
  if (b && W.livingBodies.has(b.handle)) return 'living'; if (c.shapeType() === P.R.ShapeType.HeightField) return 'terrain'; return 'other'; };

// ---- walking
interface Res { targets: number; reached: number; noRoute: number; unreach: number; stuckEvents: number; stuckT: number; botT: number; fell: number; rescues: number; drops: number; walls: number; slopeStops: number; drawnStops: number; livingStops: number; throughWalls: number; examples: string[] }
const DT = 1 / 30;
function runArea(A: Area): Res {
  const R: Res = { targets: 0, reached: 0, noRoute: 0, unreach: 0, stuckEvents: 0, stuckT: 0, botT: 0, fell: 0, rescues: 0, drops: 0, walls: 0, slopeStops: 0, drawnStops: 0, livingStops: 0, throughWalls: 0, examples: [] };
  const ex = (m: string) => { if (R.examples.length < 12) R.examples.push(m); };
  let start: P2 | null = null, sf: number | null = null;
  for (let q = 0; q < 2000 && sf === null; q++) { start = A.sample(); if (start) sf = standable(start, A.router); }
  if (!start || sf === null) { ex('no standable start'); return R; }
  let pl = W.spawn(start[0], -start[1], sf); for (let i = 0; i < 10; i++) W.step(pl, DT, { forward: 0, yaw: 0 });
  const hist: { t: number; x: number; z: number }[] = []; let lastCell: { si: number; k: number; site: Site } | null = null;
  /** one step toward (e, n); returns the distance left */
  const stepTo = (e: number, n: number) => { const p = pl.position, de = e - p.x, dn = n + p.z, yaw = Math.atan2(-de, dn); // yaw 0 faces −z (grid north)
    W.step(pl, DT, { forward: 1, yaw, run: true }); R.botT += DT;
    const q = pl.position, g = T.heightAt(q.x, q.z);
    if (pl.feetY < g - 0.3 && !R.examples.some(x => x.startsWith('fell'))) ex(`fell: feet ${(g - pl.feetY).toFixed(2)} m under the ground at (${q.x.toFixed(1)}, ${(-q.z).toFixed(1)})`);
    if (pl.feetY < g - 0.3) R.fell++;
    hist.push({ t: R.botT, x: q.x, z: -q.z }); while (hist.length && hist[0].t < R.botT - 3) hist.shift();
    if (hist.length > 60 && Math.hypot(hist[0].x - q.x, hist[0].z + q.z) < 0.3) R.stuckT += DT;
    // passable-where-solid in the town and villages: a raster move through a wall without a door
    const tw = A.router === 'village' ? vsite(A.vi!([q.x, -q.z])).walk : townWalk, l = tw.locate(q.x, -q.z);
    if (l) { const site = tw.boxes[l.si].s; if (lastCell && lastCell.site === site && lastCell.k !== l.k) { const k1 = lastCell.k, k2 = l.k, W0 = site.W, di = (k2 % W0) - (k1 % W0), dj = Math.floor(k2 / W0) - Math.floor(k1 / W0);
      const ok = Math.abs(di) + Math.abs(dj) === 1 ? passable(site, k1, k2) : Math.abs(di) <= 1 && Math.abs(dj) <= 1 ? (passable(site, k1, k1 + di) && passable(site, k1 + di, k2)) || (passable(site, k1, k1 + dj * W0) && passable(site, k1 + dj * W0, k2)) : true;
      if (!ok) { R.throughWalls++; ex(`through a wall at (${q.x.toFixed(1)}, ${(-q.z).toFixed(1)}) in ${site.meta.id} (cells ${site.cell[k1]} → ${site.cell[k2]})`); } }
      lastCell = { si: l.si, k: l.k, site }; } else lastCell = null;
    return Math.hypot(e - q.x, n + q.z); };
  /** walk to a point: false when stuck (no 0.05 m of progress for `patience` s) */
  const walkTo = (e: number, n: number, tol: number, patience = 4, maxT = 120) => { let best = Infinity, lp = 0, t = 0;
    while (t < maxT) { const d = stepTo(e, n); t += DT; if (d < tol) return true; if (d < best - 0.05) { best = d; lp = t; } if (t - lp > patience) return false; } return false; };
  /** a stop: why (what is drawn ahead, the ground's slope) */
  const classify = (e: number, n: number) => { const p = pl.position, de = e - p.x, dn = n + p.z, L = Math.hypot(de, dn) || 1, dx = de / L, dz = -dn / L;
    let s0 = 0; for (let k = 0.3; k <= 1.2; k += 0.3) s0 = Math.max(s0, slope(p.x + dx * k, p.z + dz * k));
    const b = blocker(pl, dx, dz);
    if (b === 'living') { R.livingStops++; return 'a person or an animal'; }
    if (s0 > 40) { R.slopeStops++; return 'slope'; }
    if (b !== 'terrain' && drawnAhead(pl, dx, dz)) { R.drawnStops++; return 'drawn'; }
    R.walls++; ex(`invisible wall (${b ?? 'no collider ahead'}) at (${p.x.toFixed(1)}, ${(-p.z).toFixed(1)}) feet ${pl.feetY.toFixed(2)} heading to (${e.toFixed(1)}, ${n.toFixed(1)}), ground slope ${s0.toFixed(0)}°`); return 'invisible'; };
  // the walkable grid's route round the people standing still (as main.ts navPath does for the browser bots)
  const still = (): P2[] => { const o: P2[] = W.sim ? W.sim.agents.filter(a => !a.offmap && !a.walking).map(a => a.pos as P2) : []; if (W.view) for (const v of W.view.visible) if (!v.moving && v.agent < 0) o.push([v.e, v.n]); return o; };
  const route = (from: P2, to: P2): P2[] | null => A.router === 'nav' ? nav.findPathAvoiding(from, to, still(), 0.9) ?? nav.findPath(from, to) : A.router === 'town' ? townWalk.route(from, to) : A.router === 'village' ? vsite(A.vi!(to)).walk.route(from, to) : [from, to];
  for (let ti = 0; ti < N; ti++) {
    // the next target: within 150 m of where the bot is when the area allows (a wanderer), standable
    let tgt: P2 | null = null, floor: number | null = null; const here: P2 = [pl.position.x, -pl.position.z];
    for (let q = 0; q < 300 && floor === null; q++) { const c = A.sample(); if (!c || (q < 250 && Math.hypot(c[0] - here[0], c[1] - here[1]) > 150)) continue; const f = standable(c, A.router); if (f !== null) { tgt = c; floor = f; } }
    if (!tgt) { R.unreach++; continue; }
    R.targets++; const fall0 = pl.maxFall; pl.maxFall = 0;
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const path = route([pl.position.x, -pl.position.z], tgt);
      if (!path) { if (attempt === 0) { R.noRoute++; ex(`no route to (${tgt[0].toFixed(1)}, ${tgt[1].toFixed(1)})`); } break; }
      ok = true;
      for (let i = 1; i < path.length && ok; i++) { const [we, wn] = path[i], last = i === path.length - 1;
        if (walkTo(we, wn, last ? 0.6 : 0.35)) continue;
        // open ground, or a person or an animal in the way anywhere: side-step round it (alternate sides, wider each
        // time), then on; on a route (lanes, doors, the grid) a person standing in the way may also be waited for
        const pp = pl.position, dd = Math.hypot(we - pp.x, wn + pp.z) || 1, byLiving = blocker(pl, (we - pp.x) / dd, -(wn + pp.z) / dd) === 'living';
        let passed = false;
        if (byLiving) for (let k = 0; k < 20 && !passed; k++) { W.step(pl, DT * 15, { forward: 0, yaw: 0 }); R.botT += DT * 15; passed = walkTo(we, wn, last ? 0.6 : 0.35, 1); } // wait (5 s at most) for them to move
        for (let k = 0; k < (A.router === 'open' ? 8 : 4) && !passed; k++) { const p = pl.position, de = we - p.x, dn = wn + p.z, a = Math.atan2(de, dn) + (k % 2 ? -1 : 1) * (0.9 + 0.25 * Math.floor(k / 2)), L = 2.5 + k;
          walkTo(p.x + Math.sin(a) * L, -p.z + Math.cos(a) * L, 0.5, 2, 6); passed = walkTo(we, wn, last ? 0.6 : 0.35, 3); }
        if (!passed) ok = false; }
    }
    if (pl.maxFall > 1.5) R.drops++;
    pl.maxFall = Math.max(fall0, pl.maxFall);
    if (ok) { R.reached++; continue; }
    // not reached: a hard stuck event if the bot has not moved 0.5 m in 10 s; why it stopped
    R.stuckEvents++; const why = classify(tgt[0], tgt[1]);
    if (why !== 'invisible') ex(`not reached (${tgt[0].toFixed(1)}, ${tgt[1].toFixed(1)}) from (${pl.position.x.toFixed(1)}, ${(-pl.position.z).toFixed(1)}): stopped by ${why}`);
    // go on from a fresh standable spot (as a player would turn away)
    P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
    pl = W.spawn(tgt[0], -tgt[1], floor ?? undefined); hist.length = 0; lastCell = null; for (let i = 0; i < 10; i++) W.step(pl, DT, { forward: 0, yaw: 0 });
  }
  R.rescues = pl.rescues;
  P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
  return R;
}

const all: Record<string, Res> = {};
for (const id of want) { const A = AREAS[id]; if (!A) { console.log(`unknown area ${id}`); continue; } const t1 = Date.now(); const r = runArea(A); all[id] = r;
  console.log(row(id, r), `(${((Date.now() - t1) / 1000).toFixed(0)} s)`); for (const e of r.examples) console.log('   ', e);
  const jf = argv.indexOf('--json'); if (jf >= 0) writeFileSync(argv[jf + 1], JSON.stringify({ meta: { date: new Date().toISOString().slice(0, 10), seed: SEED, N }, areas: all }, null, 1)); }
console.log(`(wall clock ${((Date.now() - t0) / 60000).toFixed(0)} min)`);
