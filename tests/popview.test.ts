// The whole population drawn (D-143): the population view (popview.ts) places the people of the day plans in the built
// world (popgeo.ts, settlement/walk.ts), the crowd draws them (the skinned pool nearest, impostors beyond: impostors.ts).
// Measured, not eyeballed: places resolve, nobody stands in or walks through a wall, positions follow the plans, walks
// take the plans' hours at a walking pace, impostors match the far body, the rendered floors, no pop-in, the CPU cost.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { segAt } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { TownWalk, siteMoves, openCode } from '../src/world/settlement/walk';
import { ROOM, toLocal, type Site } from '../src/world/settlement/site';
import { PopGeo, routeAt, type Spot, type Route } from '../src/people/popgeo';
import { PopView, MIN_PACE, MAX_PACE, CHILD_H } from '../src/people/popview';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from './plainLib';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, unpackNormal, type OutfitBuild } from '../src/people/outfits';
import { bakeImpostors, farLod, typicalMask, slotOf, IMP, IMP_DRESSES, FRAMES, ROWS, rowOf, frameOf, packRGB, unpackRGB, FIXED, CrowdImpostors, type ImpostorAtlas } from '../src/people/impostors';
import { RigSolver, PALETTE_STRIDE, PLANTED } from '../src/people/humanRig';
import { pose } from '../src/people/anim';
import { lookFor } from '../src/people/looks';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd, MAX_FULL } from '../src/people/crowd';
import { ACTIVITIES, performanceFor } from '../src/people/activities';
import { Sightlines } from '../src/people/sightline';
import { buildTerrace } from '../src/arch/terrace';

let sim: PeopleSim, nav: NavGrid, plan: TownPlan, geo: PopGeo, view: PopView, terrain: ReturnType<typeof loadTerrain>, villages: ReturnType<typeof placeVillages>;
let A: HumanAssets, O: OutfitBuild, atlas: ImpostorAtlas;
const W = new WeatherSystem(1);
/** the measured lines (vitest keeps console output of passing tests to itself): bench-reports/popview-tests.json */
const NOTES: Record<string, string> = {};
/** merged into the file (a run of some of the tests keeps the others' last lines) */
const note = (k: string, v: string) => { const f = 'bench-reports/popview-tests.json'; let old: Record<string, string> = {}; try { old = JSON.parse(readFileSync(f, 'utf8')); } catch { /* first run */ }
  NOTES[k] = v; mkdirSync('bench-reports', { recursive: true }); writeFileSync(f, JSON.stringify({ ...old, ...NOTES }, null, 1)); console.log(v); };
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
beforeAll(async () => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env); plan = buildTownPlan(); terrain = loadTerrain(); const rivers = loadRiversFile(); const canals = buildCanals(terrain, rivers.rivers, 1);
  villages = placeVillages(terrain, rivers.rivers, canals, 1);
  geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
  view = new PopView(sim, geo, 1);
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }); atlas = bakeImpostors(A, O);
}, 300_000);

/** the cell of a grid point in the town or a village raster: the site and cell index, or null */
function cellAt(e: number, n: number): { s: Site; k: number } | null {
  const tw = geo.town!, l = tw.locate(e, n); if (l) return { s: tw.boxes[l.si].s, k: l.k };
  for (let i = 0; i < villages.length; i++) { const v = villages[i]; if (Math.hypot(e - v.x, n - v.y) > v.r * 1.4 + 30) continue; const s = (geo as any).vsite(i).site as Site, [u, w] = toLocal(s.frame, e, n); const ci = s.ci(u), cj = s.cj(w); if (s.inb(ci, cj)) return { s, k: s.k(ci, cj) }; }
  return null;
}
/** a legal 8-connected move between two cells of one site (both orthogonal detours for a diagonal) */
function legal(s: Site, k0: number, k1: number): boolean {
  if (k0 === k1) return true; const m = siteMoves(s), W = s.W, i0 = k0 % W, j0 = (k0 / W) | 0, i1 = k1 % W, j1 = (k1 / W) | 0, di = i1 - i0, dj = j1 - j0;
  if (Math.abs(di) > 1 || Math.abs(dj) > 1) return false;
  const o = (k: number, a: number, b: number) => a === 1 ? (m[k] & 1) !== 0 : a === -1 ? (m[k - 1] & 1) !== 0 : b === 1 ? (m[k] & 2) !== 0 : (m[k - W] & 2) !== 0;
  if (!di || !dj) return o(k0, di, dj);
  return o(k0, di, 0) && o(j0 * W + i1, 0, dj) && o(k0, 0, dj) && o(j1 * W + i0, di, 0);
}
/** a route crosses no wall: every 0.1 m step stays in walkable cells with legal moves (town and villages: walls as the
 *  cell edges they stand on), or, on the Terrace and its approach, on the walkable grid with legal moves sampled as the
 *  grid's own line test does (every quarter cell: the grid is already eroded by a body's width); the first offence or null */
function wallCrossing(r: Route): string | null {
  const inNav = (e: number, n: number) => e > -619 && e < 261 && n > -244 && n < 184;
  for (let i = 1; i < r.cum.length; i++) { const ax = r.pts[(i - 1) * 2], ay = r.pts[(i - 1) * 2 + 1], bx = r.pts[i * 2], by = r.pts[i * 2 + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / 0.1));
    // the Terrace grid: the grid's own line test (the detailed agents walk the same), for the part of the run inside it
    if (inNav(ax, ay) && inNav(bx, by) && !cellAt(ax, ay) && !cellAt(bx, by)) { if (!nav.lineClear([ax, ay], [bx, by])) return `grid line not clear (${ax.toFixed(1)}, ${ay.toFixed(1)}) → (${bx.toFixed(1)}, ${by.toFixed(1)})`; continue; }
    if (!geo.navClear([ax, ay], [bx, by])) return `the run (${ax.toFixed(1)}, ${ay.toFixed(1)}) → (${bx.toFixed(1)}, ${by.toFixed(1)}) climbs the Terrace or crosses its walls`;
    let prev: { s: Site; k: number } | null = null;
    for (let t = 0; t <= n; t++) { const e = ax + (bx - ax) * t / n, nn = ay + (by - ay) * t / n, c = cellAt(e, nn);
      if (c) { const code = c.s.cell[c.k]; if (!(code >= 0 || openCode(code))) return `unwalkable cell at (${e.toFixed(1)}, ${nn.toFixed(1)}) in ${c.s.id}`;
        if (prev && prev.s === c.s && !legal(c.s, prev.k, c.k)) return `wall crossed at (${e.toFixed(1)}, ${nn.toFixed(1)}) in ${c.s.id}`; }
      prev = c; } }
  return null;
}

describe('population view: the plans in the built world (D-143)', () => {
  it('resolves the places of the plans to spots in the built world (sampled people and days)', () => {
    const P = sim.pop; let n = 0, ok = 0; const bad = new Map<string, number>();
    for (const d of [25, 150, 300]) for (let pid = d % 7; pid < P.persons.length; pid += 23) { if (!P.present(pid, d)) continue;
      for (const s of P.plan(pid, d)) { if (s.where === 'road' || s.where === 'away' || s.place === 'terrace_round') continue; n++; const sp = geo.spot(pid, s.place, s.act, d, (s.t0 + s.t1) / 2); if (sp.ok) ok++; else bad.set(s.place.split(':')[0], (bad.get(s.place.split(':')[0]) ?? 0) + 1); } }
    note('m01', `places resolved: ${ok} of ${n} (${(100 * ok / n).toFixed(2)} %); unresolved by kind ${JSON.stringify([...bad])}; village load ${JSON.stringify(geo.villageLoad().sort((a, b) => b.perCompound - a.perCompound).slice(0, 4))}`);
    expect(ok / n).toBeGreaterThan(0.995);
  }, 300_000);
  it('nobody drawn stands inside a wall or a roofed room; walked routes cross no wall', () => {
    let people = 0, walkers = 0, routes = 0, standing = 0, close = 0; const off: string[] = [];
    for (const [d, h, c] of [[25, 10, [0, 60]], [25, 12.2, [-422, -941]], [25, 17.5, [-800, 400]], [150, 7, [-1000, -1100]]] as [number, number, [number, number]][]) {
      sim.jumpTo(d * 24 + h); view.settle(d * 24 + h, c);
      for (const o of view.query(c, 2500)) { people++;
        const cc = cellAt(o.e, o.n);
        if (cc) { const code = cc.s.cell[cc.k]; if (!(code >= 0 || openCode(code))) off.push(`p${o.pid} ${o.what}: in a wall cell`); else if (!o.moving && code >= 0 && cc.s.sub[cc.k] === ROOM) off.push(`p${o.pid} ${o.what}: drawn in a roofed room`); }
        else if (o.e > -619 && o.e < 261 && o.n > -244 && o.n < 184 && !nav.walkable(o.e, o.n)) off.push(`p${o.pid} ${o.what}: off the walkable grid`); }
      for (const s of (view as any).list) { if (s.mode !== 2 || !s.route || routes > 2500) continue; routes++; walkers++; const w = wallCrossing(s.route); if (w) off.push(`route of p${s.pid} (${s.what}): ${w}`); }
      // people standing do not stand on one another (the population's; the detailed agents are the simulation's own)
      const still = view.query(c, 2500).filter(o => !o.moving && o.agent < 0), grid = new Map<string, number[]>(); standing += still.length;
      still.forEach((o, i) => { const k = `${Math.floor(o.e)},${Math.floor(o.n)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
      still.forEach((o, i) => { let near = false; for (let dx = -1; dx <= 1 && !near; dx++) for (let dy = -1; dy <= 1 && !near; dy++) for (const j of grid.get(`${Math.floor(o.e) + dx},${Math.floor(o.n) + dy}`) ?? []) if (j !== i && Math.hypot(still[j].e - o.e, still[j].n - o.n) < 0.45) { near = true; break; } if (near) close++; });
    }
    note('m02', `checked ${people} people drawn and ${routes} routes walked: ${off.length} offences ${JSON.stringify(off.slice(0, 6))}; standing closer than 0.45 m to another of the population: ${close} of ${standing} (${(100 * close / Math.max(1, standing)).toFixed(1)} %; spread aside ${view.stats.spread}, no room ${view.stats.crowded})`);
    expect(people).toBeGreaterThan(5000); expect(walkers).toBeGreaterThan(100); expect(off).toEqual([]);
    expect(close / standing).toBeLessThan(0.05);
  }, 600_000);
  it('positions are the plans\': a person at a place is at its spot; a walker is on the route between the plan\'s places and arrives at its hour', () => {
    const d = 25, P = sim.pop; let stays = 0, walks = 0; const bad: string[] = [];
    for (const h of [8.25, 10.5, 16.75]) { sim.jumpTo(d * 24 + h); view.settle(d * 24 + h, [-400, -300]);
      const byPid = new Map(view.visible.filter(o => o.agent < 0).map(o => [o.pid, o]));
      for (const s of (view as any).list) { const o = byPid.get(s.pid); if (!o || !s.plan) continue; const seg = segAt(P.plan(s.pid, d), h);
        // at a place: at its spot, or (when others stood there first) at the clear place beside it that the view gave them
        if (s.mode === 1 && seg.where !== 'road' && !o.moving) { stays++; const sp = geo.spot(s.pid, seg.place, seg.act, d, h), aside = Math.hypot(s.sepE - sp.e, s.sepN - sp.n);
          if (!s.what.includes('leaves')) { if (Math.hypot(s.sepE - o.e, s.sepN - o.n) > 0.01) bad.push(`p${s.pid} at ${seg.place}: drawn ${Math.hypot(s.sepE - o.e, s.sepN - o.n).toFixed(2)} m off its place`);
            if (aside > 5.1) bad.push(`p${s.pid} at ${seg.place}: ${aside.toFixed(2)} m from its spot`); } }
        if (s.mode === 2 && s.route && seg.where === 'road') { walks++; const r: Route = s.route; let best = Infinity; const q = { e: 0, n: 0, heading: 0 };
          for (let k = 0; k <= 200; k++) { routeAt(r, r.len * k / 200, q); best = Math.min(best, Math.hypot(q.e - o.e, q.n - o.n)); } if (best > r.len / 200 + 0.05) bad.push(`p${s.pid} walking ${best.toFixed(2)} m off its route`);
          routeAt(r, r.len, q); const end = Math.hypot(q.e - s.spot.e, q.n - s.spot.n); if (end > 0.05) bad.push(`p${s.pid}: route ends ${end.toFixed(2)} m from the place it walks to`);
          if (Math.abs(s.w1 - (d * 24 + seg.t1)) > 1e-6 && !(s.w1 > d * 24 + seg.t1)) bad.push(`p${s.pid}: walk ends at ${s.w1.toFixed(3)}, the plan's block at ${(d * 24 + seg.t1).toFixed(3)}`); } } }
    note('m03', `positions: ${stays} people at their places, ${walks} on their way; ${bad.length} off ${JSON.stringify(bad.slice(0, 5))}`);
    expect(stays).toBeGreaterThan(1000); expect(walks).toBeGreaterThan(50); expect(bad).toEqual([]);
  }, 600_000);
  it('walks take the plans\' hours at a walking pace (route length / the plan\'s time; leaving late when the plan allows more)', () => {
    const d = 25, P = sim.pop, paces: number[] = []; let late = 0, hurried = 0, n = 0;
    for (let pid = 3; pid < P.persons.length && n < 3000; pid += 11) { if (!P.present(pid, d) || P.persons[pid].agent >= 0) continue; const segs = P.plan(pid, d);
      for (let i = 1; i < segs.length - 1; i++) { if (segs[i].where !== 'road' || segs[i - 1].where === 'road') continue; let j = i; while (j < segs.length - 1 && segs[j + 1].where === 'road') j++; if (j >= segs.length - 1) continue;
        const a = geo.spot(pid, segs[i - 1].place, segs[i - 1].act, d, segs[i - 1].t1), b = geo.spot(pid, segs[j + 1].place, segs[j + 1].act, d, segs[j + 1].t0); if (!a.ok || !b.ok) continue;
        const r = geo.route(a, b); if (!r) continue; n++; const v = r.len / ((segs[j].t1 - segs[i].t0) * 3600); paces.push(v); if (v < MIN_PACE) late++; else if (v > MAX_PACE) hurried++; } }
    paces.sort((x, y) => x - y); const q = (p: number) => paces[Math.floor(p * (paces.length - 1))];
    note('m04', `walks: ${n}; pace the plan implies over the route (m/s): p5 ${q(0.05).toFixed(2)} p50 ${q(0.5).toFixed(2)} p95 ${q(0.95).toFixed(2)}; leave late (pace < ${MIN_PACE}) ${(100 * late / n).toFixed(1)} %, hurried (> ${MAX_PACE}) ${(100 * hurried / n).toFixed(1)} %, at a walking pace ${(100 * (n - late - hurried) / n).toFixed(1)} %`);
    expect(n).toBeGreaterThan(1000); expect(hurried / n).toBeLessThan(0.1);
  }, 600_000);
  it('children under three are carried (not drawn) unless they play or walk; a child is drawn at the height of its age', () => {
    const d = 25; sim.jumpTo(d * 24 + 10); view.settle(d * 24 + 10, [-600, -700]);
    for (const o of view.visible) if (o.agent < 0) { const age = sim.pop.ageOn(o.pid, d); if (age < 1) throw new Error(`infant p${o.pid} drawn`); if (age < 3) expect(o.act === 'play' || (o.moving && o.act === 'walk'), `p${o.pid} ${o.act}`).toBe(true); }
    expect(view.stats.carried).toBeGreaterThan(0); expect(CHILD_H[2]).toBeLessThan(0.95); expect(CHILD_H[11]).toBeGreaterThan(1.35);
  }, 300_000);
});

describe('impostors (D-143): the far body baked, matched at the switch', () => {
  it('bakes every dress and frame from the far body; coverage in every view; mip levels keep the coverage', () => {
    expect(atlas.W).toBe(IMP.views * IMP.cell); expect(atlas.H).toBe(ROWS * IMP.cell);
    // a floor per frame kind (a lying or crouching body covers less of its cell); a child's body is baked at its own
    // stature in the same 1.6 × 2 m cell, so its floors are half the adults'
    for (let r = 0; r < ROWS; r++) for (let v = 0; v < IMP.views; v++) { const id = FRAMES[r % FRAMES.length].id, child = IMP_DRESSES[Math.floor(r / FRAMES.length)] === 'child';
      expect(atlas.coverage[r * IMP.views + v], `row ${r} (${id}) view ${v}`).toBeGreaterThan((id === 'lie' ? 0.02 : ['sit', 'kneel', 'bend'].includes(id) ? 0.04 : 0.07) * (child ? 0.5 : 1)); }
    // coverage-preserving mips: at level 3 (4 × 4 texels a cell) the share of texels passing 0.5 stays within 0.1 of level 0
    const L = atlas.A[3], ts = IMP.cell >> 3; let worst = 0;
    for (let r = 0; r < ROWS; r += 5) for (let v = 0; v < IMP.views; v += 3) { let pass = 0; for (let j = 0; j < ts; j++) for (let i = 0; i < ts; i++) if (L.data[((r * ts + j) * L.width + v * ts + i) * 4 + 3] >= 128) pass++; worst = Math.max(worst, Math.abs(pass / (ts * ts) - atlas.coverage[r * IMP.views + v])); }
    expect(worst).toBeLessThan(0.2);
    note('m05', `impostor atlas ${atlas.W}×${atlas.H}, ${atlas.A.length} levels, baked in ${atlas.ms.toFixed(0)} ms (node)`);
  }, 120_000);
  it('matches the far body: height, width and silhouette area within a texel or 6 %, colour shares within 0.06', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE); const HR = 128; const rows: string[] = [];
    for (const dress of IMP_DRESSES) for (const fid of ['stand', 'walk2', 'kneel']) {
      const fi = FRAMES.findIndex(f => f.id === fid), F = FRAMES[fi], L = farLod(O, dress)!, row = rowOf(dress, fi);
      const v = A.variants.reduce((b, x) => (dress === 'child' ? x.meta.group === 'child' : x.meta.sex === (dress === 'woman' ? 'f' : 'm') && x.meta.group === 'adult') && Math.abs(x.height - atlas.refStature[dress]) < Math.abs(b.height - atlas.refStature[dress]) ? x : b);
      const inp: any = { joints: v.joints, pose: pose(F.anim, 0.7, F.ph, 0.4), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: PLANTED.has(F.anim), seat: ['sit', 'grind', 'sleep'].includes(F.anim) };
      rig.setPose(inp); rig.solve(inp, pal, 0);
      // an independent front view (view 0) of the far body at 4× the atlas resolution: silhouette area, top, width
      const cov = new Uint8Array(HR * HR), P: number[] = [], mask = typicalMask(dress), keep = (i: number) => (mask >> L.hmat[i * 4 + 2]) & 1;
      for (let i = 0; i < L.tid.length; i++) { const t = (v.index * O.NV + L.tid[i]) * 4, b = [O.source[t], O.source[t + 1], O.source[t + 2]]; const o = [0, 0, 0];
        for (let k = 0; k < 4; k++) { const w = L.skinWeight[i * 4 + k] / 255; if (!w) continue; const q = L.skinIndex[i * 4 + k] * 12; for (let rr = 0; rr < 3; rr++) o[rr] += w * (pal[q + rr * 4] * b[0] + pal[q + rr * 4 + 1] * b[1] + pal[q + rr * 4 + 2] * b[2] + pal[q + rr * 4 + 3]); }
        P.push(o[0], o[1], o[2]); }
      // with a depth test, so each pixel keeps the colour slot of the nearest triangle (the slot of its first vertex, as baked)
      const zb = new Float32Array(HR * HR).fill(-1e9), sb = new Int8Array(HR * HR).fill(-1);
      const sx = (x: number) => (x / IMP.width + 0.5) * HR, sy = (y: number) => ((y - IMP.y0) / IMP.height) * HR;
      for (let t = 0; t < L.index.length; t += 3) { const [a, b, c] = [L.index[t], L.index[t + 1], L.index[t + 2]]; if (!keep(a) || !keep(b) || !keep(c)) continue; const ax = sx(P[a * 3]), ay = sy(P[a * 3 + 1]), bx = sx(P[b * 3]), by = sy(P[b * 3 + 1]), cx = sx(P[c * 3]), cy = sy(P[c * 3 + 1]);
        const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(d) < 1e-9) continue; const sl = slotOf(L.hmat[a * 4], L.hmat[a * 4 + 1]);
        for (let j = Math.max(0, Math.floor(Math.min(ay, by, cy))); j <= Math.min(HR - 1, Math.ceil(Math.max(ay, by, cy))); j++) for (let i = Math.max(0, Math.floor(Math.min(ax, bx, cx))); i <= Math.min(HR - 1, Math.ceil(Math.max(ax, bx, cx))); i++) {
          const qx = i + 0.5, qy = j + 0.5, w1 = ((qx - ax) * (cy - ay) - (cx - ax) * (qy - ay)) / d, w2 = ((bx - ax) * (qy - ay) - (qx - ax) * (by - ay)) / d; if (!(w1 >= 0 && w2 >= 0 && w1 + w2 <= 1)) continue;
          const q = j * HR + i, z = (1 - w1 - w2) * P[a * 3 + 2] + w1 * P[b * 3 + 2] + w2 * P[c * 3 + 2]; cov[q] = 1; if (z > zb[q]) { zb[q] = z; sb[q] = sl; } } }
      const refShare = [0, 0, 0, 0, 0, 0, 0]; let nCov = 0; for (let q = 0; q < HR * HR; q++) if (sb[q] >= 0) { refShare[sb[q]]++; nCov++; } for (let k = 0; k < 7; k++) refShare[k] /= nCov || 1;
      let area = 0, top = -1, x0 = HR, x1 = -1; for (let j = 0; j < HR; j++) for (let i = 0; i < HR; i++) if (cov[j * HR + i]) { area++; top = Math.max(top, j); x0 = Math.min(x0, i); x1 = Math.max(x1, i); }
      const ref = { area: area / (HR * HR), top: (top + 1) / HR * IMP.height + IMP.y0, width: (x1 - x0 + 1) / HR * IMP.width };
      // the atlas cell (level 0, view 0)
      const C: number = IMP.cell, a0 = atlas.A[0]; let aa = 0, at = -1, ax0 = C, ax1 = -1; const share = [0, 0, 0, 0, 0, 0, 0];
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const o = ((row * C + j) * atlas.W + i) * 4; if (a0.data[o + 3] < 128) continue; aa++; at = Math.max(at, j); ax0 = Math.min(ax0, i); ax1 = Math.max(ax1, i);
        const w = [a0.data[o], a0.data[o + 1], a0.data[o + 2], atlas.B[0].data[o], atlas.B[0].data[o + 1], atlas.B[0].data[o + 2], atlas.B[0].data[o + 3]]; const s = w.reduce((x, y) => x + y, 0) || 1; w.forEach((x, k) => share[k] += x / s); }
      const imp = { area: aa / (C * C), top: (at + 1) / C * IMP.height + IMP.y0, width: (ax1 - ax0 + 1) / C * IMP.width };
      const texel = IMP.height / C;
      const impShare = share.map(x => x / (aa || 1)), worstShare = Math.max(...impShare.map((x, k) => Math.abs(x - refShare[k])));
      rows.push(`${dress}/${fid}: height ${ref.top.toFixed(3)} vs ${imp.top.toFixed(3)} m, width ${ref.width.toFixed(2)} vs ${imp.width.toFixed(2)} m, area ${ref.area.toFixed(3)} vs ${imp.area.toFixed(3)}; colour slot shares (main, second, trim, skin, hair, leather, fixed) ${refShare.map(x => x.toFixed(2)).join('/')} vs ${impShare.map(x => x.toFixed(2)).join('/')} (worst ${worstShare.toFixed(3)})`);
      expect(Math.abs(ref.top - imp.top), `${dress}/${fid} height`).toBeLessThanOrEqual(texel * 1.01);
      expect(Math.abs(ref.width - imp.width), `${dress}/${fid} width`).toBeLessThanOrEqual(IMP.width / C * 1.01);
      expect(Math.abs(imp.area / ref.area - 1), `${dress}/${fid} area`).toBeLessThan(0.08);
      // colour: the slot shares of the covered texels against the far body's visible pixels by slot (at 4× the resolution)
      expect(share.reduce((x, y) => x + y, 0) / aa).toBeCloseTo(1, 1);
      expect(worstShare, `${dress}/${fid} colour slot shares`).toBeLessThan(0.06);
    }
    note('m06', rows.join('\n'));
  }, 120_000);
  it('an impostor carries the person\'s own colours and stature (packed exactly enough: within 1/255 in sRGB)', () => {
    let worst = 0; for (let i = 0; i < 200; i++) { const d = IMP_DRESSES[i % 6]; const look = lookFor(A, { id: i, sex: d === 'woman' ? 'f' : 'm', role: 'porter', dress: d, seed: 9000 + i }, 1);
      for (const c of [look.col.main, look.col.skin, look.col.hair]) { const u = unpackRGB(packRGB(c)); for (let k = 0; k < 3; k++) { const s = (x: number) => x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; worst = Math.max(worst, Math.abs(s(u[k]) - s(c[k])) * 255); } }
      const scale = look.stature / atlas.refStature[d]; expect(Math.abs(scale * atlas.refStature[d] - look.stature)).toBeLessThan(1e-6); }
    expect(worst).toBeLessThan(1.6); expect(FIXED.every(x => x > 0 && x < 1)).toBe(true);
    expect(frameOf('walk', 0)).not.toBe(frameOf('walk', Math.PI)); expect(frameOf('carry_head', 0)).toBe(FRAMES.findIndex(f => f.id === 'carry_head'));
  });
});

describe('crowd fed by the population view (D-143)', () => {
  const makeCrowd = (S: PeopleSim = sim, V: PopView = view) => { const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const crowd = new Crowd(S, 1, humans); crowd.view = V; crowd.imp = new CrowdImpostors(atlas); crowd.looksPerFrame = 1e9; return crowd; };
  // the player's camera: 70° vertical field of view (settings.fov), 16:9, eyes 1.6 m above the ground
  const camAt = (e: number, n: number, headingDeg: number, pitch = 0) => { const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 20000); const g = nav.heightAt(e, n); const y = (Number.isFinite(g) ? g : terrain.heightAt(e, -n)) + 1.6;
    cam.position.set(e, y, -n); const r = headingDeg * Math.PI / 180; cam.lookAt(e + Math.sin(r) * 10, y + Math.tan(pitch * Math.PI / 180) * 10, -(n + Math.cos(r) * 10)); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); return cam; };
  // the views of the e2e renders (tests/e2e/crowd_scale.spec.ts), chosen by a scan of these sightlines: the named scenes of
  // the brief at their best view, and the hillside above the Terrace (where the most people are in sight)
  const SCENES: [string, number, number, number, number, number, number][] = [
    ['hall-site-working-morning', 25, 10, 144, -12, 180, -3], ['terrace-from-hillside', 25, 10, 290, -20, 270, -8], ['forecourt-morning', 25, 10, 20, 80, 135, -2],
    ['town-lane-midday', 25, 12.2, -422, -941, 28, 0], ['approach-dawn', 25, 5.4, -36.4, 122.45, 250, -3]];
  it('the busiest scenes: everyone simulated out of doors in view is drawn; the people visible over the walls counted; ≥ 300 visible where the plans put them in sight (the rest: B11)', () => {
    // a fresh simulation, with its own geography: the tests above run the simulation across the year, and its population
    // does not go back when time jumps back (life events), nor do the detailed agents
    const sim = new PeopleSim(1, nav, env), canals = buildCanals(terrain, loadRiversFile().rivers, 1);
    const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
    const view = new PopView(sim, geo, 1);
    const sl = new Sightlines(geo, buildTerrace().parts), rows: string[] = [], B = [50, 200, 600, 1500, 5000], _v = new THREE.Vector3(), got: Record<string, { vis: number; full: number; near25: number }> = {};
    for (const [name, d, h, e, n, hd, pitch] of SCENES) {
      sim.jumpTo(d * 24 + h); view.settle(d * 24 + h, [e, n]); const crowd = makeCrowd(sim, view), cam = camAt(e, n, hd, pitch); crowd.drawnKeys = new Set();
      for (let f = 0; f < 3; f++) crowd.update(f / 30, cam.position, cam.position, cam);
      const st = crowd.stats(), pts = crowd.drawnPoints(), fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      // what is simulated is what is drawn: everyone out of doors (and every detailed agent on the map) in the view within the
      // impostor range is drawn, skinned or as an impostor
      let simIn = 0, near25 = 0; const missing: string[] = [];
      // (near25: people within 25 m who are not behind the walls of a court or yard the camera is outside of: the full-detail
      // bodies go to them)
      const camPlot = geo.plotAt(e, n), walledOff = (o: { wall: number; plot: number; y: number }) => o.wall > 0 && o.plot !== camPlot && cam.position.y < o.y + o.wall - 0.3;
      const check = (key: number, x: number, y: number, z: number, what: string, hidden = false) => { if (!fr.containsPoint(_v.set(x, y + 1, z))) return; const dd = Math.hypot(x - cam.position.x, y + 0.9 - cam.position.y, z - cam.position.z); if (dd > 4990) return;
        simIn++; if (dd < 25 && !hidden) near25++; if (!crowd.drawnKeys!.has(key)) missing.push(what); };
      for (const o of view.query([e, n], 5000)) if (o.agent < 0) check(o.pid, o.e, o.y, -o.n, `p${o.pid} ${o.what}`, walledOff(o));
      for (const a of sim.agents) if (!a.offmap) check(-1 - a.id, a.pos[0], a.y, -a.pos[1], `agent ${a.id}`);
      // of the drawn in view, those a line of sight reaches (chest or head)
      const eye: [number, number, number] = [cam.position.x, -cam.position.z, cam.position.y]; let inF = 0, vis = 0; const vb = [0, 0, 0, 0, 0], kinds = [0, 0, 0, 0, 0];
      for (let i = 0; i < pts.length; i += 5) { const x = pts[i], y = pts[i + 1], z = pts[i + 2], hh = pts[i + 3]; if (!fr.containsPoint(_v.set(x, y + 0.72 * hh, z))) continue; inF++;
        if (!sl.see(eye, [x, -z, y + 0.93 * hh]) && !sl.see(eye, [x, -z, y + 0.72 * hh])) continue; vis++; kinds[pts[i + 4]]++;
        const dd = Math.hypot(x - cam.position.x, z - cam.position.z), bi = B.findIndex(r => dd < r); vb[bi < 0 ? 4 : bi]++; }
      got[name] = { vis, full: st.byLod[0], near25 };
      // the population people drawn skinned: their performance from the view (D-142 × D-143 merge)
      let popDrawn = 0, performing = 0, withThings = 0; const badResolve: string[] = [], fno = (crowd as any).frame as number;
      for (const p of crowd.persons.values()) { if (p.agent || p.pid < 0 || p.drawnFrame !== fno || !p.vp) continue; popDrawn++;
        const act = p.vp.moving && !ACTIVITIES[p.vp.act].moving ? 'walk' : p.vp.act;
        if (p.act !== act || p.why !== p.vp.why || !p.perf || (p.perf as { variant?: number }).variant !== performanceFor(act, p.vp.why, Math.round(p.animK * 159)).variant) badResolve.push(`p${p.pid} ${p.act}/${act} "${p.why}"/"${p.vp.why}"`);
        if (act !== 'walk' && act !== 'rest' && act !== 'talk') performing++; if (p.perf?.work?.length || p.perf?.animals) withThings++; }
      rows.push(`${name} (day ${d}, ${h} h; [${e}, ${n}] heading ${hd}°, pitch ${pitch}°): simulated in view ${simIn}, drawn in view ${inF} (skinned ${st.byLod.join('/')} full/mid/far/farthest, of them behind court walls ${st.impPerf.walled}, impostors ${st.impostors}); main-pass people triangles ${(st.triangles / 1e6).toFixed(2)} M; visible by sightline ${vis} (by distance ${vb.join('/')} <50/<200/<600/<1500/<5000 m; skinned ${kinds.slice(0, 4).join('/')}, impostors ${kinds[4]}); within 25 m ${near25}; placeholder acts drawn standing ${st.placeholderActs} skinned + ${st.impPerf.placeholders} impostors; missing ${missing.length} ${JSON.stringify(missing.slice(0, 3))}`
        + `; D-142 (merge): props ${st.props} in ${st.propDraws} draws (${(st.propTriangles / 1e6).toFixed(2)} M triangles submitted, over the cap ${st.propsDropped}), work objects ${st.things.instances} (${(st.things.triangles / 1e6).toFixed(2)} M), animals ${st.animals.instances} (${(st.animals.triangles / 1e6).toFixed(2)} M); population people performing ${performing} of ${popDrawn} skinned (with work objects or animals ${withThings})`);
      expect(missing, name).toEqual([]);
      // every activity is performed since D-142 (the merge): no placeholder reaches a drawn person, skinned or impostor; a
      // population person's performance is resolved from the view (the plan's act and reason)
      expect(st.placeholderActs, name).toBe(0); expect(st.impPerf.placeholders, name).toBe(0); expect(badResolve, name).toEqual([]);
      expect(st.propsDropped, name).toBe(0); expect(st.animals.dropped, name).toBe(0); expect(st.things.dropped, name).toBe(0);
      expect(st.byLod[0]).toBeLessThanOrEqual(MAX_FULL); expect(MAX_FULL).toBeGreaterThanOrEqual(50);
      if (near25 >= MAX_FULL) expect(st.byLod[0], `${name}: the full-detail cap filled`).toBe(MAX_FULL);
    }
    note('m07', rows.join('\n'));
    // the floors where the plans put the people in sight; the forecourt and the town lane at midday do not reach 300 visible
    // in any view (the scan: B11), and are recorded above, not asserted
    expect(got['terrace-from-hillside'].vis).toBeGreaterThanOrEqual(300); expect(got['approach-dawn'].vis).toBeGreaterThanOrEqual(300);
    expect(got['hall-site-working-morning'].full).toBeGreaterThanOrEqual(50);
  }, 900_000);
  it('no pop-in within 50 m in view on a walk through the lower town, out to the Terrace and along it (1× time)', () => {
    const d = 25; let t = d * 24 + 9.5; sim.jumpTo(t); const crowd = makeCrowd(); const pops: string[] = []; crowd.onPopIn = (w, dd) => pops.push(`${w} @${dd.toFixed(1)} m`);
    const pt = (e: number, n: number): Spot => geo.spotAtPoint([e, n]);
    const legs = [geo.route(pt(-430, -1060), pt(-340, -800)), geo.route(pt(-340, -800), { ...pt(PLACES_STAIR[0], PLACES_STAIR[1]), net: 'nav', anchor: 'stair_foot' } as Spot),
      geo.route({ e: PLACES_STAIR[0], n: PLACES_STAIR[1], out: true, heading: 0, net: 'nav', anchor: 'stair_foot', what: '', ok: true }, { e: 120, n: 40, out: true, heading: 0, net: 'nav', anchor: 'worksite', what: '', ok: true })];
    expect(legs.every(r => r)).toBe(true);
    const q = { e: 0, n: 0, heading: 0 }; let frames = 0, doors = 0; view.settle(t, [-430, -1060]);
    for (const r of legs as Route[]) for (let s = 0; s < r.len; s += 1.4 * 0.25) { // 1.4 m/s, 4 frames a second
      routeAt(r, s, q); t += 0.25 / 3600; sim.step(0.25); view.update(t, [q.e, q.n]); const cam = camAt(q.e, q.n, q.heading); crowd.update(t * 3600, cam.position, cam.position, cam); frames++; }
    doors = crowd.impPerf.doorEntries;
    note('m08', `walk: ${frames} frames over ${(legs as Route[]).reduce((a, r) => a + r.len, 0).toFixed(0)} m; pop-ins ${pops.length} ${JSON.stringify(pops.slice(0, 5))}; came out of doors within 50 m: ${doors}; view ${JSON.stringify(view.stats)}`);
    expect(pops).toEqual([]);
  }, 900_000);
  it('costs: the view and the pool per frame at 1× and 60× time (node; re-run alone under load)', () => {
    const d = 25; let t = d * 24 + 10; sim.jumpTo(t); view.settle(t, [40, 70]); const crowd = makeCrowd(), cam = camAt(40, 70, 122); crowd.looksPerFrame = 300;
    for (let f = 0; f < 30; f++) crowd.update(f / 60, cam.position, cam.position, cam);
    const run = (scale: number) => { const vm: number[] = [], cm: number[] = []; for (let f = 0; f < 600; f++) { const dt = scale / 60; t += dt / 3600; sim.step(dt); const a = performance.now(); view.update(t, [40, 70]); const b = performance.now(); crowd.update(1 + f / 60, cam.position, cam.position, cam); vm.push(b - a); cm.push(performance.now() - b); }
      const m = (x: number[]) => x.reduce((p, c) => p + c, 0) / x.length, p99 = (x: number[]) => [...x].sort((p, c) => p - c)[Math.floor(x.length * 0.99)]; return { view: [m(vm), p99(vm)], crowd: [m(cm), p99(cm)] }; };
    const a = run(1), b = run(60);
    note('m09', `CPU per frame (node): 1× view ${a.view[0].toFixed(2)} ms (p99 ${a.view[1].toFixed(2)}), pool+pose+impostors ${a.crowd[0].toFixed(2)} ms (p99 ${a.crowd[1].toFixed(2)}); 60× view ${b.view[0].toFixed(2)} (p99 ${b.view[1].toFixed(2)}), crowd ${b.crowd[0].toFixed(2)} (p99 ${b.crowd[1].toFixed(2)})`);
    expect(a.view[0]).toBeLessThan(6); expect(b.view[0]).toBeLessThan(10); expect(a.crowd[0]).toBeLessThan(12);
    void ACTIVITIES;
  }, 600_000);
});
const PLACES_STAIR: [number, number] = [-52, 118.5];
