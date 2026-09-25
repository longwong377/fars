// The Marvdasht plain in 467 BCE (Phase 7): rivers, canals, fields and crops, orchards, woodland, villages, tracks,
// quarries and Naqsh-e Rustam, built from src/data/plain.json (+ read-only settlement.json) and driven by the date.
// Everything placed traces to a plain.json feature and carries {tier, src, note, placeholder} for the dev overlay (F3).
//
// Budget (D-039, D-120): the plain adds a fixed handful of draw calls whatever the view (terrain material layer: 0;
// rivers + canal water: 2; canal banks: 1; tracks: 1; villages: one per occupied 8 km cell; far tree impostors: 1; mid
// ring impostors: 1; orchard rows: 1; near trees: wood + leaves at LOD0, LOD1 with shadows and LOD1 without: 6 (+ shadow
// cascades; empty sets draw nothing); near crops: 1; reeds, rushes and grass at the water: 1; Naqsh-e Rustam: 7;
// quarries: 1). Measured in tests/e2e/plain.spec.ts.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import type { Physics } from '../../player/physics';
import type { Quality } from '../../core/settings';
import { loadRivers, RiversData, feature, tag, settlementRoads } from './data';
import { buildCanals, Canal } from './canals';
import { placeVillages, buildVillageMeshes, Village, Box } from './villages';
import { buildZones, ZoneMap } from './fields';
import { PlainGround } from './terrainPlain';
import { buildRivers } from './rivers';
import { canalBanks, trackLines, tracksMesh } from './ribbons';
import { riparianTrees, canalTrees, orchardPlots, orchardPlotTrees, woodlandTrees, orchardRows, instOf, Tree, TREE_TAG } from './trees';
import { TRIS } from '../trees/model';
import { TreeKit, NearTreeSet, ImpostorSet, impostorPx, registerShadowLight, widenedFrustum, shadowSunDir, treeViewClass, VIEW_CULL, type TreeInst } from '../trees/render';
import { nearCrops } from './crops';
import { buildNaqsh } from './naqsh';
import { buildQuarries } from './quarries';
import { doyOf, riverState, marginState } from './seasonal';
import { riparianMargins } from './riparian';
import { buildTownGround } from './townGround';
import { bakeTerrainDetail } from '../../terrain/terrainDetail';
import type { TownPlan } from '../settlement/plan';

/** r3: 3-D tree radius; maxNear: 3-D trees at most; lod0R: full-detail radius (LOD0, at most MAX_LOD0 trees); rMid: the
 *  mid ring of per-tree impostors (orchards, woodland) ends here; maxMid: its instances at most (D-120). r3 is 0.9x the
 *  D-120 radii since D-149: LOD1 has 120 smaller leaf-cluster cards (was 80; 368 triangles, was 288), and the 19%
 *  smaller ring pays for them (village P22 at high: 1,979 3-D trees, 0.82 M triangles at r3 250 m) */
export const PLAIN_QUALITY: Record<Quality, { r3: number; maxNear: number; cropR: number; cropStep: number; lod0R: number; rMid: number; maxMid: number }> = {
  test: { r3: 145, maxNear: 700, cropR: 18, cropStep: 0.42, lod0R: 30, rMid: 450, maxMid: 14000 },
  low: { r3: 180, maxNear: 900, cropR: 20, cropStep: 0.45, lod0R: 35, rMid: 550, maxMid: 18000 },
  medium: { r3: 200, maxNear: 1300, cropR: 24, cropStep: 0.4, lod0R: 40, rMid: 700, maxMid: 24000 },
  high: { r3: 225, maxNear: 1800, cropR: 30, cropStep: 0.36, lod0R: 50, rMid: 900, maxMid: 32000 },
  ultra: { r3: 290, maxNear: 2600, cropR: 38, cropStep: 0.33, lod0R: 70, rMid: 1200, maxMid: 44000 },
};
/** trees that cast shadows: the nearest SHADOW_N within SHADOW_R m of the camera; at most MAX_LOD0 at full detail */
const SHADOW_N = 400, SHADOW_R = 120, MAX_LOD0 = 300;
/** species the player pushes through (no trunk collider) */
const SHRUBS = new Set(['tamarisk', 'almond', 'pomegranate', 'vine']);
/** Phase 6 owns the four settlement.json roads (D-040): the plain draws them only if this is switched on at merge */
export const PLAIN_DRAWS_SETTLEMENT_ROADS = false;

export interface PlainBuild {
  group: THREE.Group; data: { rivers: RiversData; canals: Canal[]; villages: Village[]; zones: ZoneMap };
  update(dt: number, ctx: any): void;
  stats(): Record<string, number>; summary(): string;
  /** dev: every plain tree within R of grid (e, n), as [e, n, crown width] */
  treesAround(e: number, n: number, R: number): number[][];
  /** tests (D-228): the near 3-D trees placed around the camera (LOD0, LOD1 casting shadows, LOD1 without) and the sets
   *  that draw them after the view cull */
  nearTrees(): { placed: TreeInst[][]; sets: NearTreeSet[]; models: TreeKit['models'] };
}
export async function buildPlain(scene: THREE.Scene, terrain: Terrain, phys: Physics | null, opts: { quality: Quality; seed: number; fetchJson?: (p: string) => Promise<any>; town?: TownPlan | null; /** the court setting's retinue camps (D-199): trodden ground */ camps?: { c: [number, number]; r: number }[]; /** D-227: the Terrace's drain mouths (herbs below them) */ drains?: { at: [number, number]; n: [number, number] }[] }): Promise<PlainBuild> {
  const t0 = performance.now(), Q = PLAIN_QUALITY[opts.quality] ?? PLAIN_QUALITY.high;
  const group = new THREE.Group(); group.name = 'plain';
  group.userData = tag(feature('fields_irrigated_pulvar'), 'the Marvdasht plain, 467 BCE (plain.json)');
  const detailP = bakeTerrainDetail(terrain); // the hills' landform maps, off the main thread while the rest builds (D-190)
  const rivers = await loadRivers(opts.fetchJson);
  const canals = buildCanals(terrain, rivers.rivers, opts.seed);
  const villages = placeVillages(terrain, rivers.rivers, canals, opts.seed);
  // the town's used ground (D-190): only with the town as built (?notown and the plain tests keep the D-040 boundary)
  const townGround = opts.town ? buildTownGround(opts.town, opts.camps ?? [], opts.drains ?? []) : null;
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: townGround,
    sites: opts.town?.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
  const tGen = performance.now() - t0;
  // terrain: the plain's field / crop / woodland layer on the existing chunks (no new draw calls)
  const tDet = performance.now(), detail = await detailP, detailWaitMs = performance.now() - tDet;
  const ground = new PlainGround(zones, detail); ground.treeR.value = Q.rMid; // the painted canopy gives way to the mid-ring impostors
  const terrainGroup = scene.getObjectByName('terrain');
  terrainGroup?.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ground.material; });
  if (terrainGroup) terrainGroup.userData.note = `${terrainGroup.userData.note}; fields, crops, orchard floors and woodland canopy from plain.json zones (C)`;
  // water, banks, canals, tracks
  const rv = buildRivers(terrain, rivers.rivers, canals); group.add(rv.group);
  // reeds, rushes and grass at the water (riparian.ts, D-149): on the corridor as drawn, around the camera
  const floodDepth = rivers.rivers.map(r => (feature(r.id).flow_by_month as { month: string; depth_m: number }[]).reduce((m, q) => Math.max(m, q.depth_m), 0)) as [number, number];
  const margins = riparianMargins(rv.profiles, canals, terrain, opts.quality, floodDepth); group.add(margins.mesh);
  const cb = canalBanks(canals, terrain); group.add(cb);
  const tr = tracksMesh(trackLines(villages), terrain); group.add(tr);
  if (PLAIN_DRAWS_SETTLEMENT_ROADS) for (const r of settlementRoads()) group.add(tracksMesh([r.pts], terrain, r.width, 'plain-road-' + r.id)); // off by default (D-040)
  // villages
  const vb = buildVillageMeshes(villages, terrain, opts.seed); group.add(vb.group);
  // trees (D-120): one kit (models, leaf atlas, impostor atlas) shared with the town gardens
  const kit = TreeKit.get({ impostorPx: impostorPx(opts.quality) }); registerShadowLight(scene); kit.lod0R.value = Q.lod0R; kit.configure(opts.quality);
  const nearC = uniform(new THREE.Vector3(1e9, 0, 1e9)), nearR = uniform(0); // the 3-D set: centre and radius
  const midC = ground.paintC, midR = ground.treeR; // the mid ring: centre and radius (the terrain paints woodland beyond it)
  const lineTrees = [...riparianTrees(rivers.rivers, opts.seed).map(t => ({ t, where: 'riparian woodland (river_*.riparian)' })), ...canalTrees(canals, opts.seed).map(t => ({ t, where: 'canal tree line' }))];
  const far = new ImpostorSet(kit, lineTrees.length, { c: nearC, r: nearR }, 20000, 'plain-trees-far'); group.add(far.mesh);
  far.set(lineTrees.map(q => instOf(q.t, terrain, q.where)));
  const plots = orchardPlots(zones, villages);
  const orch = orchardRows(kit, plots, terrain, { c: midC, r: midR }, nearR, 16000); group.add(orch);
  const mid = new ImpostorSet(kit, Q.maxMid, { c: nearC, r: nearR }, 1e6, 'plain-trees-mid'); group.add(mid.mesh);
  // the nearest trees (within SHADOW_R, at most SHADOW_N) cast shadows; the rest of the 3D set does not (shadow passes cost
  // their triangles once per cascade, D-040)
  const lod0 = new NearTreeSet(kit, 0, MAX_LOD0, true, 'plain-trees'), lod1s = new NearTreeSet(kit, 1, SHADOW_N, true, 'plain-trees'), lod1n = new NearTreeSet(kit, 1, Q.maxNear, false, 'plain-trees-noshadow');
  for (const s of [lod0, lod1s, lod1n]) for (const m of [s.wood, s.leaves]) group.add(m);
  for (const m of [far.mesh, orch, mid.mesh]) m.userData = { ...m.userData, ...TREE_TAG(), describe: m.userData.describe };
  const crops = nearCrops(zones, ground.cropTex, ground.day, kit.wind, Q.cropR, Q.cropStep);
  crops.mesh.userData = tag(feature('fields_irrigated_pulvar'), 'standing crops: plot crop and phenology from the zone mix and crop calendar (plain.json crops: B calendar, C heights and layout)');
  group.add(crops.mesh);
  // Naqsh-e Rustam and the quarries
  const nr = buildNaqsh(terrain, rivers.nrAncientFootAsl); group.add(nr.group);
  const qb = buildQuarries(terrain, opts.seed); group.add(qb.group);
  // Naqsh-e Rustam's meshes cast shadows near the cliff, except the relief sets', which manage their own (their shadow proxies are the only relief
  // draws in the shadow passes, D-048: switching every mesh under the group drew the carved figures into all 4 cascades, D-228)
  const nrCasters: THREE.Mesh[] = []; nr.group.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.name.startsWith('relief:')) nrCasters.push(o as THREE.Mesh); });
  if (phys) { nr.colliders(phys); for (const b of qb.boxes) phys.addBox(b.c, b.h, b.rot); }
  const tBuild = performance.now() - t0;

  // lazy colliders near the player: village boxes, river corridor trimeshes, tree trunks
  const villageColl = new Map<string, any[]>(), riverColl = new Map<number, any>();
  let trunkColl: any[] = [], lastTrunk = new THREE.Vector3(1e9, 0, 1e9);
  /** colliders exist around the player and around the camera (a free test camera places itself on what it can hit) */
  const syncColliders = (p: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }) => {
    if (!phys) return;
    const dist = (x: number, z: number) => Math.min(Math.hypot(x - p.x, z - p.z), Math.hypot(x - c.x, z - c.z));
    for (const v of villages) { const d = dist(v.x, -v.y) - v.r, has = villageColl.has(v.id);
      if (d < 500 && !has) villageColl.set(v.id, (vb.boxes.get(v.id) ?? []).filter((b: Box) => !b.door).map((b: Box) => phys.addBox(new THREE.Vector3(b.cx, b.cy, b.cz), new THREE.Vector3(b.hx, b.hy, b.hz), b.rot)));
      else if (d > 800 && has) { for (const c of villageColl.get(v.id)!) phys.world.removeCollider(c, false); villageColl.delete(v.id); } }
    rv.segments.forEach((s, i) => { const d = dist(s.cx, -s.cy), has = riverColl.has(i);
      if (d < 600 && !has) riverColl.set(i, phys.addTrimesh(s.pos, s.idx, { tier: 'C', what: 'river corridor' }));
      else if (d > 900 && has) { phys.world.removeCollider(riverColl.get(i), false); riverColl.delete(i); } });
  };
  // orchard trees per plot, computed once when first needed (plotAt over the plot's grid is the costly part)
  const plotTrees = new Map<number, Tree[]>();
  const treesOfPlot = (p: typeof plots[number]) => { let l = plotTrees.get(p.h); if (!l) { l = orchardPlotTrees(zones, p.sx, p.sz); plotTrees.set(p.h, l); } return l; };
  // near trees: every tree kind within R3 of the camera, nearest first: LOD0, then LOD1 casting shadows, then LOD1
  let lastNear = new THREE.Vector3(1e9, 0, 1e9), nearList: Tree[] = [];
  const rebuildNear = (cam: THREE.Vector3) => {
    const R = Q.r3, cx = cam.x, cy = -cam.z, list: { t: Tree; d: number; where: string }[] = [];
    for (const q of lineTrees) { const t = q.t; if (Math.abs(t.x - cx) < R && Math.abs(t.y - cy) < R) { const d = Math.hypot(t.x - cx, t.y - cy); if (d < R) list.push({ t, d, where: q.where }); } }
    for (const p of plots) if (Math.hypot(p.sx - cam.x, p.sz - cam.z) < R + 150) for (const t of treesOfPlot(p)) { const d = Math.hypot(t.x - cx, t.y - cy); if (d < R) list.push({ t, d, where: 'orchard (orchards_gardens)' }); }
    for (const t of woodlandTrees(zones, cam.x, cam.z, R)) list.push({ t, d: Math.hypot(t.x - cx, t.y - cy), where: 'woodland (woodland rule)' });
    list.sort((a, b) => a.d - b.d);
    const cap = MAX_LOD0 + SHADOW_N + Q.maxNear, kept = list.slice(0, cap);
    const a: TreeInst[] = [], b: TreeInst[] = [], c: TreeInst[] = [];
    for (const q of kept) { const r = instOf(q.t, terrain, q.where);
      if (q.d < Q.lod0R && a.length < MAX_LOD0) a.push(r); else if (q.d < SHADOW_R && b.length < SHADOW_N) b.push(r); else if (c.length < Q.maxNear) c.push(r); else break; }
    placed = { a, b, c }; cullKey.dirty = true;
    const n = a.length + b.length + c.length;
    nearList = list.slice(0, n).map(q => q.t);
    // the impostors take over exactly where the 3-D set stops (at R3, or at the first tree the caps left out)
    nearC.value.set(cam.x, 0, cam.z); nearR.value = n < list.length ? list[n].d : R;
  };
  // view culling of the near sets (D-228): the main pass draws the trees in view, the shadow passes the casters whose
  // shadow can be seen; redone when the view turns, the camera moves or the sun moves (VIEW_CULL)
  let placed: { a: TreeInst[]; b: TreeInst[]; c: TreeInst[] } = { a: [], b: [], c: [] };
  const cullKey = { dirty: true, pos: new THREE.Vector3(1e9, 0, 0), q: new THREE.Quaternion(), fov: 0, aspect: 0, sun: new THREE.Vector3(), hasSun: false };
  const sunNow = new THREE.Vector3(), fr = new THREE.Frustum(), DEG = Math.PI / 180;
  const cullNear = (cam: any) => {
    if (!cam?.isPerspectiveCamera) { if (cullKey.dirty) { lod0.set(placed.a); lod1s.set(placed.b); lod1n.set(placed.c); cullKey.dirty = false; } return; } // no view (headless callers): everything
    const toSun = shadowSunDir(sunNow), k = cullKey;
    const stale = k.dirty || cam.position.distanceTo(k.pos) > VIEW_CULL.moveM || cam.quaternion.angleTo(k.q) > VIEW_CULL.turnDeg * DEG || cam.fov !== k.fov || cam.aspect !== k.aspect
      || !!toSun !== k.hasSun || (toSun && toSun.angleTo(k.sun) > VIEW_CULL.sunDeg * DEG);
    if (!stale) return;
    k.dirty = false; k.pos.copy(cam.position); k.q.copy(cam.quaternion); k.fov = cam.fov; k.aspect = cam.aspect; k.hasSun = !!toSun; if (toSun) k.sun.copy(toSun);
    widenedFrustum(cam, VIEW_CULL.marginDeg, fr);
    const split = (recs: TreeInst[], caster: boolean) => { const seen: TreeInst[] = [], shade: TreeInst[] = [];
      for (const r of recs) { const v = treeViewClass(r, kit.models, fr, cam.position, toSun, caster); if (v === 1) seen.push(r); else if (v === 2) shade.push(r); }
      return { recs: seen.concat(shade), mainN: seen.length }; };
    const A = split(placed.a, true), B = split(placed.b, true), C = split(placed.c, false);
    lod0.set(A.recs, A.mainN); lod1s.set(B.recs, B.mainN); lod1n.set(C.recs);
  };
  // mid ring: every orchard tree of the plots whose centre is within rMid, and every woodland tree within rMid, as
  // impostors (those inside the near radius collapse in the shader); the rows and the painted canopy start beyond
  let lastMid = new THREE.Vector3(1e9, 0, 1e9), midCount = 0;
  const rebuildMid = (cam: THREE.Vector3) => {
    const R = Q.rMid, recs: TreeInst[] = [];
    for (const p of plots) if (Math.hypot(p.sx - cam.x, p.sz - cam.z) < R) for (const t of treesOfPlot(p)) recs.push(instOf(t, terrain, 'orchard (orchards_gardens)'));
    for (const t of woodlandTrees(zones, cam.x, cam.z, R)) recs.push(instOf(t, terrain, 'woodland (woodland rule)'));
    midCount = mid.set(recs); midC.value.set(cam.x, 0, cam.z);
  };
  const syncTrunks = (p: { x: number; y: number; z: number }) => {
    if (!phys || Math.hypot(p.x - lastTrunk.x, p.z - lastTrunk.z) < 15) return;
    lastTrunk = new THREE.Vector3(p.x, p.y, p.z); for (const c of trunkColl) phys.world.removeCollider(c, false); trunkColl = [];
    const R = phys.R;
    for (const t of nearList) { const d = Math.hypot(t.x - p.x, t.y + p.z); if (d > 40) break; if (SHRUBS.has(t.sp)) continue; // shrubs are pushed through
      const r = Math.max(0.12, t.h * 0.02), y = terrain.heightAt(t.x, -t.y);
      trunkColl.push(phys.world.createCollider(R.ColliderDesc.cylinder(1.5, r).setTranslation(t.x, y + 1.5, -t.y))); }
  };
  let lastDay = NaN, flow: { pulvar: ReturnType<typeof riverState>; kur: ReturnType<typeof riverState>; margins: ReturnType<typeof marginState> } | null = null;
  const hemi = (() => { let h: THREE.HemisphereLight | null = null; scene.traverse(o => { if ((o as any).isHemisphereLight) h = o as THREE.HemisphereLight; }); return h as THREE.HemisphereLight | null; })();
  const skyC = new THREE.Color(), horC = new THREE.Color();
  const update = (dt: number, ctx: any) => {
    const day = ctx.clock.dayIndex as number;
    if (day !== lastDay) { lastDay = day; const doy = doyOf(day);
      ground.setDay(doy); kit.setDay(doy); margins.setDay(doy); flow = { pulvar: riverState('river_pulvar', day), kur: riverState('river_kur', day), margins: marginState(doy) }; }
    if (hemi) skyC.copy(hemi.color).multiplyScalar(hemi.intensity);
    if (scene.fog) horC.copy((scene.fog as THREE.FogExp2).color); // the fog colour is the calibrated horizon radiance (D-060)
    rv.update(flow!, { sky: skyC, horizon: horC });
    kit.wind.value = ctx.cond?.windMs ?? 2;
    const cam: THREE.Vector3 = ctx.camera.position;
    // the mid ring is rebuilt before the near set moves far enough to leave it (its centre stays within (rMid - r3) / 4)
    if (Math.hypot(cam.x - lastMid.x, cam.z - lastMid.z) > (Q.rMid - Q.r3) * 0.25) { lastMid = cam.clone(); rebuildMid(cam); }
    if (Math.hypot(cam.x - lastNear.x, cam.z - lastNear.z) > Q.r3 * 0.08) { lastNear = cam.clone(); rebuildNear(cam); }
    cullNear(ctx.camera);
    crops.update(cam, terrain); margins.update(cam); (margins as any).wind.value = kit.wind.value;
    // shadow casting only near the camera (the CSM cascades end at 600 m; a far caster would still be drawn into every
    // cascade its bounding sphere touches): village cells, Naqsh-e Rustam and the quarries
    for (const c of vb.cells) c.mesh.castShadow = c.centres.some(([x, z]) => Math.hypot(x - cam.x, z - cam.z) < 900);
    const nrNear = Math.hypot(600 - cam.x, -6124 - cam.z) < 1200; for (const m of nrCasters) m.castShadow = nrNear;
    nr.texts.visible = Math.hypot(600 - cam.x, -6124 - cam.z) < 600; // the DNa/DNb carving (~0.2 M triangles) only near the cliff
    const qNear = qb.sites.some(s => Math.hypot(s.x - cam.x, -s.y - cam.z) < 900); qb.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = qNear; });
    const pp = ctx.player?.position ?? cam; syncColliders(pp, cam); syncTrunks(pp);
    void dt;
  };
  const placedTris = () => placed.a.length * TRIS.lod0 + (placed.b.length + placed.c.length) * TRIS.lod1;
  const stats = () => ({ canals: canals.length, villages: villages.length, compounds: vb.compounds, villageTris: vb.tris, riverTris: rv.stats().tris, lineTrees: lineTrees.length, orchardPlots: plots.length,
    nearTrees: placed.a.length + placed.b.length + placed.c.length, lod0Trees: placed.a.length, shadowTrees: placed.a.length + placed.b.length, nearTreeTris: placedTris(), nearR: Math.round(nearR.value),
    nearTreesDrawn: lod0.drawn() + lod1s.drawn() + lod1n.drawn(), shadowTreesDrawn: lod0.count() + lod1s.count(),
    midTrees: midCount, orchardRows: orch.userData.rows, treeKitMs: Math.round(kit.buildMs), treeBakeMs: Math.round(kit.bakeMs), treeBakes: kit.bakes,
    crops: crops.count(), margins: margins.count(), naqshTris: nr.tris, genMs: Math.round(tGen), buildMs: Math.round(tBuild),
    detailMs: Math.round(detail.near.ms + detail.mid.ms), detailWaitMs: Math.round(detailWaitMs), townPaths: townGround?.runs ?? 0 });
  /** every plain tree (lines, orchards, woodland) within R of grid (e, n), as [e, n, crown width] (dev: rig framing) */
  const treesAround = (e: number, n: number, R: number): number[][] => {
    const out: number[][] = [], add = (t: Tree) => { if (Math.hypot(t.x - e, t.y - n) < R) out.push([t.x, t.y, t.w]); };
    for (const q of lineTrees) add(q.t);
    for (const p of plots) if (Math.hypot(p.sx - e, p.sz + n) < R + 150) for (const t of treesOfPlot(p)) add(t);
    for (const t of woodlandTrees(zones, e, -n, R)) add(t);
    return out;
  };
  return { group, data: { rivers, canals, villages, zones }, update, stats, treesAround, nearTrees: () => ({ placed: [placed.a, placed.b, placed.c], sets: [lod0, lod1s, lod1n], models: kit.models }),
    summary: () => { const s = stats(); return `plain: ${s.villages} villages (${s.compounds} compounds), ${s.canals} canals, ${s.lineTrees} river/canal trees, ${s.orchardPlots} orchard plots, near trees ${s.nearTrees} (LOD0 ${s.lod0Trees}), mid-ring impostors ${s.midTrees}, crop tufts ${s.crops}, built in ${s.buildMs} ms`; } };
}
