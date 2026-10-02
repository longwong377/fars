// D-600 (s17, far land): the terrain's level-of-detail pops and seams along walked routes, in node, measured in pixels at
// the player's lens (60 deg vertical, 1080 px). Routes: from every coverage point (tests/data/coverage_points.json), a
// walk of ROUTE_M along its heading at eye height, the camera looking along the heading at the point's pitch.
//  - pop: a chunk whose step changes between two positions 1 m apart: the largest screen move of any of its full-resolution
//    samples in view between the old and the new surface (both as the mesh draws them: triangles of the decimated grid);
//  - seam: every SEAM_M along the route, between each pair of chunks that share an edge (the same ring, or the near/mid and
//    mid/far ring borders) and are in view: the largest screen gap between the two drawn edges (the skirts hide the hole,
//    not the step);
//  - cost: triangles drawn (all chunks) and in the view frustum.
// Usage: npx tsx tools/dev/far_pop.ts [bias=1] [routeM=300] [--every=N (every Nth point)] [--no-morph] [--write]
// Writes bench-reports/far-pop.txt with --write. Exit 1 when the worst pop or seam exceeds 2 px.
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { loadTerrain } from '../../tests/plainLib';
import { stepErrors, pickStep, triAt, decimatedAt, morphShare, TERRAIN_LOD } from '../../src/terrain/terrainMesh';
import type { Ring, TerrainChunk } from '../../src/terrain/heightfield';

const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
const BIAS = +(pos[0] ?? 1), ROUTE_M = +(pos[1] ?? 300), EVERY = +(args.find(a => a.startsWith('--every='))?.slice(8) ?? 1), SEAM_M = 10;
const FOV = 60, H = 1080, W = 1920, LIMIT_PX = 2;
const T = loadTerrain(), chunks = T.chunks();
const pts: any[] = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points.filter((_: unknown, i: number) => i % EVERY === 0);

interface C { ch: TerrainChunk; center: THREE.Vector3; radius: number; err: number[]; step: number; m: number }
const CS: C[] = chunks.map(ch => {
  let lo = Infinity, hi = -Infinity; for (let r = 0; r <= ch.cells; r += 4) for (let c = 0; c <= ch.cells; c += 4) { const h = ch.ring.at(ch.r0 + r, ch.c0 + c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return { ch, center: new THREE.Vector3(ch.x0 + ch.size / 2, (lo + hi) / 2, ch.z0 + ch.size / 2), radius: Math.hypot(ch.size / 2, ch.size / 2, (hi - lo) / 2), err: stepErrors(ch.ring, ch.r0, ch.c0, ch.cells), step: -1, m: 0 };
});
const MORPH = !args.includes('--no-morph');
/** a vertex of the grid decimated to `step` as drawn: its height plus the morph share m of its slide to the 2x coarser level */
function vert(ring: Ring, r0: number, c0: number, cells: number, step: number, m: number, r: number, c: number) {
  const h = ring.at(Math.min(ring.n - 1, r0 + r), Math.min(ring.n - 1, c0 + c));
  return m && step < 16 ? h + m * (decimatedAt(ring, r0, c0, cells, step * 2, r, c) - h) : h;
}
/** the drawn height at chunk-relative grid position (gi, gj) (fractional allowed) at a step and morph share */
function drawnG(ring: Ring, r0: number, c0: number, cells: number, step: number, m: number, gi: number, gj: number) {
  const ri = Math.max(0, Math.min(cells - step, Math.floor(gi / step) * step)), cj = Math.max(0, Math.min(cells - step, Math.floor(gj / step) * step));
  const V = (r: number, c: number) => vert(ring, r0, c0, cells, step, m, r, c);
  return triAt(V(ri, cj), V(ri, cj + step), V(ri + step, cj), V(ri + step, cj + step), Math.max(0, Math.min(1, (gj - cj) / step)), Math.max(0, Math.min(1, (gi - ri) / step)));
}
const drawnAt = (c: C, step: number, m: number, i: number, j: number) => drawnG(c.ch.ring, c.ch.r0, c.ch.c0, c.ch.cells, step, m, i, j);
/** the drawn height of a chunk at world (x, z) on its own edge or inside */
function drawnWorld(c: C, x: number, z: number) {
  const { ring, r0, c0 } = c.ch; return drawnAt(c, c.step, c.m, (z + ring.half) / ring.cell - r0, (x + ring.half) / ring.cell - c0);
}
// shared edges: for each chunk, its four sides; pairs found by matching world segments (the finer chunk's side lies inside
// the coarser's side across a ring border)
interface Edge { a: C; b: C; x0: number; z0: number; x1: number; z1: number; stepM: number }
const edges: Edge[] = [];
{
  const key = (v: number) => Math.round(v * 10);
  const sides = new Map<string, { c: C; lo: number; hi: number }[]>();
  for (const c of CS) { const { x0, z0, size } = c.ch;
    for (const [axis, at, lo, hi] of [['z', z0, x0, x0 + size], ['z', z0 + size, x0, x0 + size], ['x', x0, z0, z0 + size], ['x', x0 + size, z0, z0 + size]] as const) {
      const k = `${axis}${key(at)}`; (sides.get(k) ?? sides.set(k, []).get(k)!).push({ c, lo, hi }); } }
  for (const [k, list] of sides) { const axis = k[0], at = +k.slice(1) / 10;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const A = list[i], B = list[j]; if (A.c === B.c) continue;
      const lo = Math.max(A.lo, B.lo), hi = Math.min(A.hi, B.hi); if (hi - lo < 1) continue;
      const stepM = Math.min(A.c.ch.ring.cell, B.c.ch.ring.cell);
      edges.push(axis === 'z' ? { a: A.c, b: B.c, x0: lo, z0: at, x1: hi, z1: at, stepM } : { a: A.c, b: B.c, x0: at, z0: lo, x1: at, z1: hi, stepM }); } }
}

const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 2e5), fr = new THREE.Frustum(), m4 = new THREE.Matrix4(), sph = new THREE.Sphere();
const pa = new THREE.Vector3(), pb = new THREE.Vector3();
const inView = (v: THREE.Vector3) => fr.containsPoint(v);
/** screen distance (px) between two world points (both must be in front of the camera) */
function px(a: THREE.Vector3, b: THREE.Vector3) { pa.copy(a).project(cam); pb.copy(b).project(cam); return Math.hypot((pa.x - pb.x) * W / 2, (pa.y - pb.y) * H / 2); }
const va = new THREE.Vector3(), vb = new THREE.Vector3();

let worstPop = { px: 0, at: '' }, worstSeam = { px: 0, at: '' }, nPops = 0, popsOver = 0, seamsOver = 0, seamChecks = 0, frames = 0;
const popHist = [0, 0, 0, 0, 0], hb = (v: number) => (v < 0.5 ? 0 : v < 1 ? 1 : v < 2 ? 2 : v < 4 ? 3 : 4);
let trisAll = 0, trisView = 0, nCost = 0, trisMax = 0;
const tris = (c: C) => { const n = c.ch.cells / c.step; return 2 * n * n + 4 * 2 * n; }; // + skirts
const byRing: Record<string, { pops: number; worst: number }> = { near: { pops: 0, worst: 0 }, mid: { pops: 0, worst: 0 }, far: { pops: 0, worst: 0 } };
const t0 = Date.now();
for (const p of pts) {
  const az = (p.az * Math.PI) / 180, de = Math.sin(az), dn = Math.cos(az), pitch = ((p.pitch ?? 0) * Math.PI) / 180;
  for (const c of CS) c.step = -1;
  for (let s = 0; s <= ROUTE_M; s += 1) {
    const e = p.e + de * s, n = p.n + dn * s, x = e, z = -n;
    const g = p.area === 'terrace' ? Math.max(0, T.surfaceAt(x, z)) : T.surfaceAt(x, z), y = g + (p.eye ?? 1.6);
    cam.position.set(x, y, z); cam.lookAt(x + de * Math.cos(pitch) * 100, y + Math.sin(pitch) * 100, z - dn * Math.cos(pitch) * 100); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    fr.setFromProjectionMatrix(m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); frames++;
    let all = 0, view = 0;
    for (const c of CS) {
      const d = Math.max(1, cam.position.distanceTo(c.center) - c.radius), step = pickStep(c.err, d, c.ch.ring.cell, BIAS), m = MORPH ? morphShare(c.err, d, c.ch.ring.cell, BIAS, step) : 0;
      const vis = fr.intersectsSphere(sph.set(c.center, c.radius));
      if (c.step > 0 && step !== c.step && vis) {
        // the pop: every full-resolution sample in view, old surface vs new
        const { ring, r0, c0, cells } = c.ch; let worst = 0;
        const stride = Math.max(1, Math.min(step, c.step) / 2);
        for (let i = 0; i <= cells; i += stride) for (let j = 0; j <= cells; j += stride) {
          const wx = -ring.half + (c0 + j) * ring.cell, wz = -ring.half + (r0 + i) * ring.cell;
          va.set(wx, drawnAt(c, c.step, c.m, i, j), wz); if (!inView(va)) continue;
          vb.set(wx, drawnAt(c, step, m, i, j), wz); worst = Math.max(worst, px(va, vb)); }
        nPops++; popHist[hb(worst)]++; if (worst > LIMIT_PX) popsOver++;
        const rr = byRing[c.ch.ringName]; rr.pops++; rr.worst = Math.max(rr.worst, worst);
        if (worst > worstPop.px) worstPop = { px: worst, at: `${p.id} +${s} m: ${c.ch.key} step ${c.step}->${step} at ${(d).toFixed(0)} m` };
      }
      c.step = step; c.m = m; const t = tris(c); all += t; if (vis) view += t;
    }
    trisAll += all; trisView += view; nCost++; trisMax = Math.max(trisMax, view);
    if (s % SEAM_M === 0) for (const E of edges) {
      if (!fr.intersectsSphere(sph.set(E.a.center, E.a.radius)) || !fr.intersectsSphere(sph.set(E.b.center, E.b.radius))) continue;
      if (E.a.step === E.b.step && E.a.ch.ring === E.b.ch.ring) continue; // same ring, same step: identical edge vertices
      const L = Math.hypot(E.x1 - E.x0, E.z1 - E.z0), st = E.stepM; seamChecks++;
      for (let u = 0; u <= L; u += st) { const wx = E.x0 + (E.x1 - E.x0) * (u / L), wz = E.z0 + (E.z1 - E.z0) * (u / L);
        va.set(wx, drawnWorld(E.a, wx, wz), wz); if (!inView(va)) continue; vb.set(wx, drawnWorld(E.b, wx, wz), wz);
        const v = px(va, vb); if (v > LIMIT_PX) seamsOver++;
        if (v > worstSeam.px) worstSeam = { px: v, at: `${p.id} +${s} m: ${E.a.ch.key}@${E.a.step} | ${E.b.ch.key}@${E.b.step} at (${wx.toFixed(0)}, ${wz.toFixed(0)}), ${cam.position.distanceTo(va).toFixed(0)} m` }; }
    }
  }
}
const lines = [`terrain LOD pops and seams along the coverage routes (tools/dev/far_pop.ts; D-600; ${new Date().toISOString().slice(0, 10)}); geomorph ${MORPH ? 'on' : 'off (--no-morph)'}`,
  `lens ${FOV} deg vertical at ${W}x${H}; detail bias ${BIAS} (high 1, ultra 1.5, medium 0.75, low 0.5, test 0.35); ERR_RAD ${TERRAIN_LOD.ERR_RAD}, SPACING_RAD ${TERRAIN_LOD.SPACING_RAD}`,
  `${pts.length} routes of ${ROUTE_M} m from the coverage points (every ${EVERY}), ${frames} positions 1 m apart, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  `pops (a chunk changing step in view): ${nPops}; screen move < 0.5 px ${popHist[0]}, 0.5-1 ${popHist[1]}, 1-2 ${popHist[2]}, 2-4 ${popHist[3]}, > 4 ${popHist[4]}; over ${LIMIT_PX} px: ${popsOver}`,
  `  worst pop ${worstPop.px.toFixed(2)} px (${worstPop.at})`,
  ...Object.entries(byRing).map(([k, v]) => `  ${k} ring: ${v.pops} pops, worst ${v.worst.toFixed(2)} px`),
  `seams (two drawn chunk edges apart, in view; checked every ${SEAM_M} m): ${seamChecks} edge checks; samples over ${LIMIT_PX} px: ${seamsOver}; worst ${worstSeam.px.toFixed(2)} px (${worstSeam.at})`,
  `cost: terrain triangles drawn (all chunks; three culls per chunk) mean ${(trisAll / nCost / 1e6).toFixed(2)} M, in the view frustum mean ${(trisView / nCost / 1e6).toFixed(2)} M, worst ${(trisMax / 1e6).toFixed(2)} M`];
console.log(lines.join('\n'));
if (args.includes('--write')) writeFileSync(`bench-reports/far-pop${BIAS === 1 ? '' : '-' + BIAS}${MORPH ? '' : '-nomorph'}.txt`, lines.join('\n') + '\n');
process.exit(worstPop.px > LIMIT_PX || worstSeam.px > LIMIT_PX ? 1 : 0);
