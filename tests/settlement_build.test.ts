// Phase 6 settlement, built headless (no GPU): geometry budget of the generated meshes, fires registered with the fire
// system, colliders, and an offline walk (same Rapier colliders and player controller as the game) from the Terrace
// approach into the lanes of the nearest quarter and through a street door into a house.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { Physics } from '../src/player/physics';
import { Player } from '../src/player/player';
import { FireSystem } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { Site, P2 } from '../src/world/settlement/site';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
let P: Physics, town: Settlement, fire: FireSystem;
// the whole town at quality high (houses, fires, the tree kit): a build, not a timed budget, so it gets the time a loaded
// machine needs (it timed out at vitest's default 10 s while renders and a soak shared the cores)
beforeAll(async () => { P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 }); fire = new FireSystem(4); town = new Settlement(P, T, fire, 'high'); P.step(1 / 60); }, 120_000);

describe('settlement geometry budget (whole-frame proxy: settlement ≤ 150 draw calls, ≤ 2 M triangles)', () => {
  it('meshes and triangles of everything the settlement adds', () => {
    let meshes = 0, tris = 0, inst = 0;
    town.group.traverse((o: any) => { if (!o.isMesh) return; meshes++; const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += o.isInstancedMesh ? t * o.count : t; if (o.isInstancedMesh) inst++; });
    console.log(`[settlement] ${meshes} meshes (${inst} instanced), ${(tris / 1e6).toFixed(3)} M triangles if everything were drawn once; build ${town.info.buildMs.toFixed(0)} ms; ${town.info.colliders} collider boxes; ${town.info.fires} fires`);
    // every mesh drawn once in the main pass: the worst case (all in view) must leave room for shadow cascades
    expect(meshes).toBeLessThanOrEqual(45);
    expect(tris).toBeLessThanOrEqual(1.2e6);
  });
  it('hearths, ovens and kilns join the fire system with schedules and site groups', () => {
    const town_ = fire.fires.filter(f => f.group);
    expect(town_.length).toBe(town.info.fires);
    expect(town_.length).toBeGreaterThan(900);
    const kinds = new Set(town_.map(f => f.kind)); for (const k of ['hearth', 'oven', 'kiln']) expect(kinds.has(k as any)).toBe(true);
    for (const f of town_) { expect(f.sched).toBeTruthy(); expect(f.tier).toBe('C'); }
    // fires stand on the ground (terrain.heightAt, D-035)
    for (const f of town_.slice(0, 200)) expect(Math.abs(f.pos.y - T.heightAt(f.pos.x, f.pos.z))).toBeLessThan(1.2);
  });
  it('every face of the merged town meshes names its plot or object, with a tier (dev overlay F3)', () => {
    let checked = 0;
    town.group.traverse((o: any) => { if (!o.isMesh || typeof o.userData.describe !== 'function') return; const n = o.geometry.index.count / 3;
      for (let f = 0; f < n; f += Math.max(1, Math.floor(n / 50))) { const d = o.userData.describe({ faceIndex: f }); expect(d, `${o.name} face ${f}`).toBeTruthy(); expect(['A', 'B', 'C', 'B/C']).toContain(d.tier); checked++; } });
    expect(checked).toBeGreaterThan(200);
  });
  it('F3 flags the houses\' box-slab walls, roofs and fixed doors as PLACEHOLDER (§3.7; Phase 6+7 review M4, D-228)', () => {
    let houses = 0, flagged = 0;
    town.group.traverse((o: any) => { if (!o.isMesh || typeof o.userData.describe !== 'function') return; const n = o.geometry.index.count / 3;
      for (let f = 0; f < n; f += Math.max(1, Math.floor(n / 200))) { const d = o.userData.describe({ faceIndex: f }); if (!d || !/: (large )?courtyard house/.test(d.note)) continue; houses++; if (d.placeholder === true && d.note.includes('PLACEHOLDER')) flagged++; } });
    expect(houses).toBeGreaterThan(20); expect(flagged).toBe(houses);
  });
});

describe('walk into the town (offline bot: game colliders and player controller)', () => {
  it('from the Terrace approach through the lanes of q_w1 to the farthest street door, and inside the house', () => {
    const s = town.plan.sites.find(x => x.id === 'q_w1')!;
    // walkable vertices: all four cells around the vertex are open ground (lane, square, plain) → ≥ 0.65 m clear of walls
    const open = (i: number, j: number) => { if (!s.inb(i, j)) return true; return Site.open(s.cell[s.k(i, j)]); };
    const V = (i: number, j: number) => open(i, j) && open(i - 1, j) && open(i, j - 1) && open(i - 1, j - 1);
    const W1 = s.W + 1, vk = (i: number, j: number) => j * W1 + i;
    // BFS from every boundary vertex (the open plain around the quarter)
    const dist = new Int32Array(W1 * (s.H + 1)).fill(-1), from = new Int32Array(W1 * (s.H + 1)).fill(-1), q: number[] = [];
    for (let i = 0; i <= s.W; i++) for (const j of [0, s.H]) if (V(i, j)) { dist[vk(i, j)] = 0; q.push(vk(i, j)); }
    for (let j = 0; j <= s.H; j++) for (const i of [0, s.W]) if (V(i, j) && dist[vk(i, j)] < 0) { dist[vk(i, j)] = 0; q.push(vk(i, j)); }
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % W1, j = (k / W1) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > s.W || jj > s.H || !V(ii, jj)) continue; const kk = vk(ii, jj); if (dist[kk] < 0) { dist[kk] = dist[k] + 1; from[kk] = k; q.push(kk); } } }
    // the house whose door is farthest along the lanes from the plain
    let best: { p: any; v: number; d: number } | null = null;
    for (const p of s.plots) { if (!p.door || !p.capacity || p.kind === 'workshop') continue; const o = p.door.out, oi = o % s.W, oj = (o / s.W) | 0;
      for (const [vi, vj] of [[oi, oj], [oi + 1, oj], [oi, oj + 1], [oi + 1, oj + 1]]) { const d = dist[vk(vi, vj)]; if (d > 0 && (!best || d > best.d)) best = { p, v: vk(vi, vj), d }; } }
    expect(best).toBeTruthy();
    const verts: number[] = []; for (let k = best!.v; k >= 0; k = from[k]) verts.push(k); verts.reverse();
    const vg = (k: number): P2 => s.grid(s.u0 + (k % W1), s.v0 + ((k / W1) | 0));
    // keep turning points only
    const path: P2[] = [vg(verts[0])]; for (let x = 1; x + 1 < verts.length; x++) { const a = verts[x - 1], b = verts[x], c = verts[x + 1]; if ((b - a) !== (c - b)) path.push(vg(b)); } path.push(vg(verts[verts.length - 1]));
    const dp = s.doorPoints(best!.p)!; path.push(s.grid(...dp.out), s.grid(...dp.mid), s.grid(...dp.inside));
    const lanePathM = best!.d;
    // start on the approach W of the Grand Stair (the game's spawn), walk to the quarter's edge, then the lanes
    const start: P2 = [-175, 122.45];
    let x = start[0], z = -start[1]; P.updateTerrain(T, { x, y: 0, z }); town.streamColliders(x, z, Infinity); P.step(1e-4);
    const pl = new Player(P, x, P.castRayDown(x, z, 400) ?? T.heightAt(x, z), z); pl.maxFall = 0; pl.fallStartY = null;
    const step = (yawDeg: number, fwd: number, dt: number) => { P.updateTerrain(T, pl.position); town.streamColliders(pl.position.x, pl.position.z, Infinity); pl.update(dt, { forward: fwd, right: 0, run: false, yaw: -((yawDeg - 341) * Math.PI) / 180, pitch: 0 }); P.step(Math.max(1 / 240, dt)); };
    for (let i = 0; i < 30; i++) step(0, 0, 1 / 30); pl.maxFall = 0;
    const walkTo = (e: number, n: number, tol: number) => { let t = 0, last = 0, bestD = Infinity;
      while (t < 900) { const p = pl.position, de = e - p.x, dn = n + p.z, d = Math.hypot(de, dn); if (d < tol) return true; if (d < bestD - 0.05) { bestD = d; last = t; } if (t - last > 5) return false;
        step(Math.atan2(de, dn) * 180 / Math.PI + 341, 1, 1 / 30); t += 1 / 30; } return false; };
    let reached = 0; const fails: string[] = [];
    for (const [k, [e, n]] of path.entries()) { const ok = walkTo(e, n, k === path.length - 1 ? 0.3 : 0.35); if (!ok) { fails.push(`waypoint ${k}/${path.length} (${e.toFixed(1)}, ${n.toFixed(1)}) from (${pl.position.x.toFixed(1)}, ${(-pl.position.z).toFixed(1)})`); break; } reached++; }
    console.log(`[walk] ${reached}/${path.length} waypoints; lane path ${lanePathM} m to ${best!.p.id}; live colliders ${town.info.liveColliders}; max fall ${pl.maxFall.toFixed(2)} m`);
    expect(fails).toEqual([]);
    expect(pl.maxFall).toBeLessThan(0.6);
    // inside the house: the plot's cell under the player, feet on the ground
    const p = pl.position; const g: P2 = [p.x, -p.z]; const loc = [(g[0] - s.frame.c[0]) * Math.cos(s.frame.theta) + (g[1] - s.frame.c[1]) * Math.sin(s.frame.theta), -(g[0] - s.frame.c[0]) * Math.sin(s.frame.theta) + (g[1] - s.frame.c[1]) * Math.cos(s.frame.theta)];
    expect(s.cell[s.k(s.ci(loc[0]), s.cj(loc[1]))]).toBe(best!.p.idx);
    expect(Math.abs(pl.feetY - T.heightAt(p.x, p.z))).toBeLessThan(0.3);
    void THREE;
  }, 300_000);
});
