// Tier 0 (MASTER_PLAN §4.2, D-277): a node pass over the area registry with no render lane. Every 5 m in each unique area
// (4 m in the transect), per cell:
//  - STANDABLE and REACHED: the lowest floor under the cell (downward rays through every surface: a floor is a surface
//    within the 42° climb angle with 1.7 m of headroom, no lower than RESCUE_DEPTH (1 m) under the drawn terrain: no walkable
//    floor lies deeper (player.ts), and the inside of a Terrace part's volume is not a floor; roofs and wall tops above a
//    floor do not count), and whether the
//    walkable envelope (tools/dev/lib/envelope.ts: the full collider set, doors open) reaches it. A standable cell the player
//    cannot reach, with reached ground at its level (± 1.5 m) within 10 m, is a sealed room, a walled court or an island:
//    counted and listed; an unreached floor with no reached ground at its level near it is the top of a wall, a column or
//    a roof (counted apart as "tops", not a finding);
//  - COLLIDER vs DRAWN: on terrain, the collider's floor (the streamed heightfield) against the drawn surface
//    (Terrain.surfaceAt, the triangles terrainMesh.ts draws); on the Terrace, the collider floor against the highest
//    upward-facing drawn triangle within 1 m of it (the Terrace's meshes as buildMeshes draws them). A floor with no drawn
//    surface within 0.3 m is an invisible floor; drawn more than 0.3 m above the collider is "feet in the ground" (§3);
//  - PLACEHOLDER / UNTIERED in view distance: the distinct F3 records (src/dev/coverage.ts CoveragePass.record, the same
//    reading as the renders) flagged placeholder, or carrying no tier, with anything within VIEW_R of the cell;
//  - REPETITION in the view cone: the most instances of one geometry within 30 m in any of four 90° cones.
// What it does NOT see (and says so in its output): meshes the game builds only near the camera (the town's and the
// villages' near tiles, the near trees) are read at the level the offline world holds (the town's merged houses carry the
// same per-face records); the drawn-vs-collider check covers the terrain and the Terrace, not the town or the villages.
// Output: REVIEWS/evidence/s10-instruments/tier0.json (per-area summary; no threshold row names this tool, so it carries no
// `id` and moves no board cell) and a table on stdout.
// Usage: tools/dev/cpu_slot.sh npx tsx tools/dev/tier0.ts [--areas <id,prefix*,…>] [--budget-min 30] [--out <file>]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three/webgpu';
import { buildWalkableWorld } from './lib/walkable_world';
import { loadEnvelope, envelopeAt, terrainLayer, patchBuckets, fillPatch, FLOOR_NY, BODY_H, type Envelope } from './lib/envelope';
import { AreaIndex, inMulti, type Area } from './lib/areas_geo';
import { depHashFor } from './coverage_dep';
import { CoveragePass } from '../../src/dev/coverage';
import { RESCUE_DEPTH } from '../../src/player/player';
import { buildTerrace } from '../../src/arch/terrace';
import { pointInPoly } from '../../src/arch/parts';

export const TOOL = 'tools/dev/tier0.ts', SPACING = 5, SPACING_TRANSECT = 4, VIEW_R = 200, REP_R = 30;
/** a point inside a Terrace box part (centre c, size, turned by rot) */
const inBox = (p: any, e: number, n: number) => { const r = -(p.rot ?? 0), c = Math.cos(r), s = Math.sin(r), de = e - p.c[0], dn = n - p.c[1]; return Math.abs(de * c - dn * s) <= p.size[0] / 2 && Math.abs(de * s + dn * c) <= p.size[1] / 2; };
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

interface Flagged { e: number; n: number; r: number; key: string; ph: boolean; untiered: boolean }
interface Inst { e: number; n: number; geo: string; key: string }
const B = 32, bk = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
class Hash<T> { m = new Map<number, T[]>(); add(e: number, n: number, v: T, r = 0) { for (let i = Math.floor((e - r) / B); i <= Math.floor((e + r) / B); i++) for (let j = Math.floor((n - r) / B); j <= Math.floor((n + r) / B); j++) { const k = bk(i, j); let l = this.m.get(k); if (!l) this.m.set(k, l = []); l.push(v); } }
  near(e: number, n: number, R: number, f: (v: T) => void) { for (let i = Math.floor((e - R) / B); i <= Math.floor((e + R) / B); i++) for (let j = Math.floor((n - R) / B); j <= Math.floor((n + R) / B); j++) { const l = this.m.get(bk(i, j)); if (l) for (const v of l) f(v); } } }

/** the F3 records of everything the offline world draws: flagged ones (placeholder or untiered) with their extent, and every
 *  instance of an instanced or batched mesh by geometry */
function objectIndex(scene: THREE.Scene) {
  scene.updateMatrixWorld(true);
  const cov = new CoveragePass({ root: scene, terrain: new THREE.Object3D() } as any), flagged = new Hash<Flagged>(), inst = new Hash<Inst>(), stats = { meshes: 0, instances: 0, flaggedRecords: new Set<string>(), faceSampled: 0 };
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), box = new THREE.Box3();
  scene.traverse(o => { const me = o as any; if (!(me.isMesh || me.isInstancedMesh || me.isBatchedMesh) || !me.geometry) return; stats.meshes++;
    const rec = cov.record(o), geo = me.geometry.uuid;
    const flag = (e: number, n: number, r: number, ph: boolean, tier: string | null, key: string) => { if (ph || !tier) { flagged.add(e, n, { e, n, r, key, ph, untiered: !tier }, Math.min(r, 2000)); stats.flaggedRecords.add(key); } };
    if (me.isInstancedMesh || me.isBatchedMesh) {
      const N = me.isInstancedMesh ? me.count : (me._instanceInfo?.length ?? 0);
      let ph = rec.ph, tier = rec.tier; if (rec.desc) { try { const d = rec.desc({ instanceId: 0, object: me }); if (d) { if (typeof d.placeholder === 'boolean') ph = d.placeholder; tier = d.tier ?? tier; } } catch { /* keep */ } }
      for (let i = 0; i < N; i++) { if (me.isBatchedMesh && !me._instanceInfo[i]?.active) continue; me.getMatrixAt(i, m); m.premultiply(me.matrixWorld); p.setFromMatrixPosition(m);
        if (!Number.isFinite(p.x) || p.y < -500) continue; stats.instances++; inst.add(p.x, -p.z, { e: p.x, n: -p.z, geo, key: rec.key }); flag(p.x, -p.z, 3, ph, tier, rec.key); }
      return; }
    if (!me.geometry.boundingBox) me.geometry.computeBoundingBox(); box.copy(me.geometry.boundingBox).applyMatrix4(me.matrixWorld); if (box.isEmpty()) return;
    const ce = (box.min.x + box.max.x) / 2, cn = -(box.min.z + box.max.z) / 2, r = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
    if (rec.desc && me.geometry.index) { // merged meshes: sample faces, each carries its own record
      const I = me.geometry.index, P = me.geometry.attributes.position, tris = I.count / 3, step = Math.max(1, Math.floor(tris / 4000)), a = new THREE.Vector3();
      for (let f = 0; f < tris; f += step) { let d: any; try { d = rec.desc({ faceIndex: f, object: me }); } catch { d = null; } if (!d) continue; stats.faceSampled++;
        a.fromBufferAttribute(P, I.getX(3 * f)).applyMatrix4(me.matrixWorld); flag(a.x, -a.z, 4, typeof d.placeholder === 'boolean' ? d.placeholder : rec.ph, d.tier ?? rec.tier, `${rec.key}|${String(d.note ?? d.label ?? '').slice(0, 60)}`); }
      return; }
    flag(ce, cn, r, rec.ph, rec.tier, rec.key);
  });
  return { flagged, inst, stats: { meshes: stats.meshes, instances: stats.instances, flaggedRecords: stats.flaggedRecords.size, faceSampled: stats.faceSampled } };
}

/** upward-facing drawn triangles of the meshes over a box, binned at 2 m (for the drawn-vs-collider check) */
function drawnBins(scene: THREE.Scene, bb: [number, number, number, number]) {
  const bins = new Map<number, number[]>(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), box = new THREE.Box3(); let tris = 0;
  scene.traverse(o => { const me = o as any; if (!me.isMesh || me.isInstancedMesh || me.isBatchedMesh || !me.geometry?.attributes?.position) return;
    if (!me.geometry.boundingBox) me.geometry.computeBoundingBox(); box.copy(me.geometry.boundingBox).applyMatrix4(me.matrixWorld);
    if (box.max.x < bb[0] || box.min.x > bb[2] || -box.min.z < bb[1] || -box.max.z > bb[3]) return;
    const P = me.geometry.attributes.position, I = me.geometry.index, n = I ? I.count / 3 : P.count / 3;
    for (let t = 0; t < n; t++) { const i0 = I ? I.getX(3 * t) : 3 * t, i1 = I ? I.getX(3 * t + 1) : 3 * t + 1, i2 = I ? I.getX(3 * t + 2) : 3 * t + 2;
      a.fromBufferAttribute(P, i0).applyMatrix4(me.matrixWorld); b.fromBufferAttribute(P, i1).applyMatrix4(me.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(me.matrixWorld);
      nrm.subVectors(b, a).cross(c.clone().sub(a)); const L = nrm.length(); if (L < 1e-9 || Math.abs(nrm.y / L) < 0.7) continue;
      const e0 = Math.max(bb[0], Math.min(a.x, b.x, c.x)), e1 = Math.min(bb[2], Math.max(a.x, b.x, c.x)), n0 = Math.max(bb[1], Math.min(-a.z, -b.z, -c.z)), n1 = Math.min(bb[3], Math.max(-a.z, -b.z, -c.z));
      if (e0 > e1 || n0 > n1) continue; tris++;
      const tri = [a.x, -a.z, a.y, b.x, -b.z, b.y, c.x, -c.z, c.y];
      for (let i = Math.floor(e0 / 2); i <= Math.floor(e1 / 2); i++) for (let j = Math.floor(n0 / 2); j <= Math.floor(n1 / 2); j++) { const k = bk(i, j); let l = bins.get(k); if (!l) bins.set(k, l = []); l.push(...tri); } } });
  /** drawn heights of upward triangles over (e, n) */
  const at = (e: number, n: number): number[] => { const l = bins.get(bk(Math.floor(e / 2), Math.floor(n / 2))); if (!l) return []; const out: number[] = [];
    for (let q = 0; q < l.length; q += 9) { const [x0, y0, h0, x1, y1, h1, x2, y2, h2] = l.slice(q, q + 9); const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(d) < 1e-12) continue;
      const w0 = ((y1 - y2) * (e - x2) + (x2 - x1) * (n - y2)) / d, w1 = ((y2 - y0) * (e - x2) + (x0 - x2) * (n - y2)) / d, w2 = 1 - w0 - w1; if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue; out.push(w0 * h0 + w1 * h1 + w2 * h2); }
    return out; };
  return { at, tris };
}

async function main() {
  const t0 = Date.now(), log = (s: string) => console.log(`[tier0 ${((Date.now() - t0) / 1000).toFixed(0)} s] ${s}`), budgetMs = +(arg('--budget-min') ?? 30) * 60000;
  const commit = process.env.RUN_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const w = await buildWalkableWorld(log), P = w.P, R = P.R, W = P.world, EXC = R.QueryFilterFlags.EXCLUDE_KINEMATIC;
  const reg = AreaIndex.load(), cache = 'shots/cache/envelope.bin';
  let E: Envelope; const envDep = depHashFor('tools/dev/areas.ts');
  const cached = existsSync(cache) ? loadEnvelope(w.T, cache) : null;
  if (cached && cached.dep === envDep) { E = cached; log('envelope from the cache'); }
  else { log('envelope cache missing or from another tree: computing it'); const TL = terrainLayer(w.T); E = { T: w.T, terrain: TL, patches: [], mask: new Map() };
    patchBuckets(P).forEach((g, i) => { E.patches.push(fillPatch(P, w.T, TL, g, i)); for (const k of g) E.mask.set(k, i); }); }
  if (reg.reg.meta.dep !== envDep) log(`WARNING: data/areas.json was generated on another tree (dep ${reg.reg.meta.dep} ≠ ${envDep}): regenerate it (npm run areas)`);
  const O = objectIndex(w.scene); log(`objects: ${O.stats.meshes} meshes, ${O.stats.instances} instances, ${O.stats.flaggedRecords} flagged records (placeholder or untiered), ${O.stats.faceSampled} merged faces sampled`);
  const terracePlat = reg.reg.areas.filter(a => a.kind.startsWith('terrace-')), tb = terracePlat.reduce((b, a) => [Math.min(b[0], a.bbox[0]), Math.min(b[1], a.bbox[1]), Math.max(b[2], a.bbox[2]), Math.max(b[3], a.bbox[3])] as [number, number, number, number], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]);
  const D = drawnBins(w.scene, tb); log(`Terrace drawn surfaces: ${D.tris} upward triangles`);
  // the areas: the transect, then every unique area by priority (optionally filtered)
  const want = arg('--areas')?.split(',');
  const pick = (a: Area) => !want || want.some(x => x.endsWith('*') ? a.id.startsWith(x.slice(0, -1)) : a.id === x);
  const list = [...reg.reg.areas.filter(a => a.overlay), ...reg.reg.areas.filter(a => a.role === 'unique' && !a.overlay)].filter(pick);
  const cellsOf = (a: Area) => { const s = a.overlay ? SPACING_TRANSECT : SPACING, out: [number, number][] = [];
    for (let e = Math.ceil(a.bbox[0] / s) * s + s / 2; e < a.bbox[2]; e += s) for (let n = Math.ceil(a.bbox[1] / s) * s + s / 2; n < a.bbox[3]; n += s) {
      if (!inMulti(e, n, a.shape)) continue; if (!a.overlay && reg.primary(e, n)?.id !== a.id) continue; out.push([e, n]); }
    return out; };
  const plan = list.map(a => ({ a, cells: cellsOf(a) })), total = plan.reduce((s, p) => s + p.cells.length, 0); log(`${plan.length} areas, ${total} cells`);
  const down = (e: number, n: number, from: number) => W.castRayAndGetNormal(new R.Ray({ x: e, y: from, z: -n }, { x: 0, y: -1, z: 0 }), 600, true, EXC);
  const headroom = (e: number, n: number, y: number) => W.castRay(new R.Ray({ x: e, y: y + 0.05, z: -n }, { x: 0, y: 1, z: 0 }), BODY_H - 0.05, true, EXC) === null;
  // the Terrace's solid parts are hollow trimesh shells to the physics: a "floor" inside one (the terrain under a platform)
  // is not a floor. Their volumes from the parts (prisms and boxes, y0…y1), bucketed at 8 m.
  const PB = new Map<number, any[]>();
  for (const p of buildTerrace().parts as any[]) { if (!p.solid || (p.type !== 'prism' && p.type !== 'box')) continue; const sh = p.type === 'prism' ? p.polygon : null;
    const r = p.type === 'box' ? Math.hypot(p.size[0], p.size[1]) / 2 : 0, xs = sh ? sh.map((q: number[]) => q[0]) : [p.c[0] - r, p.c[0] + r], ys = sh ? sh.map((q: number[]) => q[1]) : [p.c[1] - r, p.c[1] + r];
    for (let i = Math.floor(Math.min(...xs) / 8); i <= Math.floor(Math.max(...xs) / 8); i++) for (let j = Math.floor(Math.min(...ys) / 8); j <= Math.floor(Math.max(...ys) / 8); j++) { const k = bk(i, j); let l = PB.get(k); if (!l) PB.set(k, l = []); l.push(p); } }
  const insidePart = (e: number, n: number, y: number) => (PB.get(bk(Math.floor(e / 8), Math.floor(n / 8))) ?? []).some(p => y > p.y0 - 0.05 && y < p.y1 - 0.3 && (p.type === 'prism' ? pointInPoly(e, n, p.polygon) : inBox(p, e, n)));
  /** an unreached floor counts when reached ground within 10 m lies at its level (± 1.5 m): a sealed room or court, not the
   *  top of a wall, a column or a roof */
  const sameLevel = (e: number, n: number, f: number) => { for (const r of [2.5, 5, 10]) for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, q = envelopeAt(E, e + r * Math.cos(a), n + r * Math.sin(a)); if (q.reach && Math.abs(q.y - f) <= 1.5) return true; } return false; };
  /** the lowest standable floor under (e, n): every surface from above, stepping through solids */
  const lowestFloor = (e: number, n: number, top: number, bottom: number) => { let y = top, best: number | null = null;
    for (let k = 0; k < 60 && y > bottom; k++) { const h = down(e, n, y); if (!h) break;
      if (h.timeOfImpact < 1e-4) { // inside a solid: leave it through its far side (a non-solid ray from inside finds the exit)
        const x = W.castRay(new R.Ray({ x: e, y, z: -n }, { x: 0, y: -1, z: 0 }), 600, false, EXC); y -= (x && x.timeOfImpact > 1e-4 ? x.timeOfImpact : 0.25) + 0.02; continue; }
      const f = y - h.timeOfImpact; if (f < bottom) break; if (h.normal.y >= FLOOR_NY && headroom(e, n, f) && !insidePart(e, n, f)) best = f; y = f - 0.02; }
    return best; };
  const out: Record<string, any> = {}; let done = 0, spent = 0, sampledAreas = 0;
  for (const { a, cells } of plan) {
    const ta = Date.now(), left = budgetMs - (Date.now() - t0), perCell = done ? spent / done : 0.4, remaining = plan.slice(plan.findIndex(p => p.a === a)).reduce((s, p) => s + p.cells.length, 0);
    const stride = perCell * remaining > left ? Math.max(1, Math.ceil((perCell * remaining) / Math.max(1, left))) : 1; if (stride > 1) sampledAreas++;
    const cx = (a.bbox[0] + a.bbox[2]) / 2, cn = (a.bbox[1] + a.bbox[3]) / 2; P.updateTerrain(w.T, { x: cx, y: 0, z: -cn }, Math.hypot(a.bbox[2] - a.bbox[0], a.bbox[3] - a.bbox[1]) / 2 + 64); P.step(1e-4);
    const S = { cells: 0, standable: 0, reached: 0, unreached: [] as number[][], unreachedN: 0, tops: 0, cvd: { n: 0, over5cm: 0, max: 0, at: null as number[] | null, undrawn: 0, sunk: 0 }, ph: { cells: 0, max: 0, keys: new Map<string, number>() }, un: { cells: 0, max: 0, keys: new Map<string, number>() }, rep: [] as number[], repKeys: new Map<string, number>() };
    for (let ci = 0; ci < cells.length; ci += stride) { const [e, n] = cells[ci]; S.cells++;
      const env = envelopeAt(E, e, n), surf = w.T.surfaceAt(e, -n);
      const floor = lowestFloor(e, n, Math.max(surf, Number.isNaN(env.y) ? surf : env.y) + 40, surf - RESCUE_DEPTH);
      if (floor !== null) { if (env.reach) { S.standable++; S.reached++; }
        else if (sameLevel(e, n, floor)) { S.standable++; S.unreachedN++; if (S.unreached.length < 12) S.unreached.push([+e.toFixed(1), +n.toFixed(1), +floor.toFixed(2)]); }
        else S.tops++; }
      // collider vs drawn
      if (env.layer === 'terrain') { const h = down(e, n, surf + 3); if (h) { const d = surf + 3 - h.timeOfImpact - surf; S.cvd.n++; if (Math.abs(d) > 0.05) S.cvd.over5cm++; if (Math.abs(d) > Math.abs(S.cvd.max)) { S.cvd.max = +d.toFixed(3); S.cvd.at = [e, n]; } } }
      else if (env.reach && e >= tb[0] && e <= tb[2] && n >= tb[1] && n <= tb[3]) { const hs = D.at(e, n).filter(y => Math.abs(y - env.y) <= 1); S.cvd.n++;
        if (!hs.length) S.cvd.undrawn++; else { const d = hs.reduce((b, y) => Math.abs(y - env.y) < Math.abs(b - env.y) ? y : b) - env.y, top = Math.max(...hs) - env.y; if (top > 0.3) S.cvd.sunk++;
          if (Math.abs(d) > 0.05) S.cvd.over5cm++; if (Math.abs(d) > Math.abs(S.cvd.max)) { S.cvd.max = +d.toFixed(3); S.cvd.at = [e, n]; } } }
      // placeholder / untiered in view distance
      const ph = new Set<string>(), un = new Set<string>();
      O.flagged.near(e, n, VIEW_R, f => { if (Math.hypot(f.e - e, f.n - n) - f.r > VIEW_R) return; if (f.ph) ph.add(f.key); if (f.untiered) un.add(f.key); });
      if (ph.size) { S.ph.cells++; S.ph.max = Math.max(S.ph.max, ph.size); for (const k of ph) S.ph.keys.set(k, (S.ph.keys.get(k) ?? 0) + 1); }
      if (un.size) { S.un.cells++; S.un.max = Math.max(S.un.max, un.size); for (const k of un) S.un.keys.set(k, (S.un.keys.get(k) ?? 0) + 1); }
      // repetition in four 90° cones within 30 m
      const cones = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
      O.inst.near(e, n, REP_R, v => { const de = v.e - e, dn = v.n - n, d = Math.hypot(de, dn); if (d > REP_R || d < 0.5) return; const q = Math.floor(((Math.atan2(dn, de) + Math.PI * 2.25) % (Math.PI * 2)) / (Math.PI / 2)) % 4; cones[q].set(v.geo + '|' + v.key, (cones[q].get(v.geo + '|' + v.key) ?? 0) + 1); });
      let best = 0, bestK = ''; for (const c of cones) for (const [k, v] of c) if (v > best) { best = v; bestK = k; } S.rep.push(best); if (bestK) S.repKeys.set(bestK.split('|')[1], (S.repKeys.get(bestK.split('|')[1]) ?? 0) + 1);
    }
    const ms = Date.now() - ta; done += S.cells; spent += ms; const top = (m: Map<string, number>) => [...m].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => ({ key: k, cells: v }));
    const rep = [...S.rep].sort((x, y) => x - y);
    out[a.id] = { kind: a.kind, spacing_m: a.overlay ? SPACING_TRANSECT : SPACING, stride, cells: S.cells, standable: S.standable, reached_pct: S.standable ? +(100 * S.reached / S.standable).toFixed(2) : null, unreached_standable: S.unreachedN, unreached_examples: S.unreached, unreached_tops: S.tops,
      collider_vs_drawn: { n: S.cvd.n, over_5cm_pct: S.cvd.n ? +(100 * S.cvd.over5cm / S.cvd.n).toFixed(2) : null, worst_m: S.cvd.max, worst_at: S.cvd.at, undrawn_floor: S.cvd.undrawn, drawn_over_30cm: S.cvd.sunk },
      placeholder: { cells_pct: S.cells ? +(100 * S.ph.cells / S.cells).toFixed(2) : 0, max_records: S.ph.max, top: top(S.ph.keys) }, untiered: { cells_pct: S.cells ? +(100 * S.un.cells / S.cells).toFixed(2) : 0, max_records: S.un.max, top: top(S.un.keys) },
      repetition: { median: rep[Math.floor(rep.length / 2)] ?? 0, p95: rep[Math.floor(rep.length * 0.95)] ?? 0, max: rep[rep.length - 1] ?? 0, top: top(S.repKeys) }, ms };
    log(`${a.id}: ${S.cells} cells${stride > 1 ? ` (1 in ${stride})` : ''}, reached ${out[a.id].reached_pct} % of ${S.standable} standable, placeholder in view ${out[a.id].placeholder.cells_pct} %, untiered ${out[a.id].untiered.cells_pct} %, repetition max ${out[a.id].repetition.max}, collider-vs-drawn >5 cm ${out[a.id].collider_vs_drawn.over_5cm_pct} % (${Math.round(ms / 1000)} s)`);
  }
  const dir = 'REVIEWS/evidence/s10-instruments', file = arg('--out') ?? `${dir}/tier0.json`; mkdirSync(dir, { recursive: true });
  const res = { tool: TOOL, commit, dep: depHashFor(TOOL), registry_dep: reg.reg.meta.dep, spacing_m: SPACING, spacing_transect_m: SPACING_TRANSECT, view_r_m: VIEW_R, repetition_r_m: REP_R,
    note: 'Tier 0 per-area summary (MASTER_PLAN §4.2). No row of gates/thresholds.json names tools/dev/tier0.ts, so this file carries no id and moves no board cell. Near-level meshes the game builds only round the camera are read at the offline world\'s level; drawn-vs-collider covers the terrain and the Terrace only.',
    meta: { areas: plan.length, cells_planned: total, cells_run: done, sampled_areas: sampledAreas, budget_min: budgetMs / 60000, run_s: Math.round((Date.now() - t0) / 1000), objects: O.stats }, areas: out };
  writeFileSync(file, JSON.stringify(res, null, 1) + '\n'); log(`→ ${file}`);
}
if (process.argv[1]?.endsWith('tier0.ts')) main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
