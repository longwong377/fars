// The Marvdasht plain in 467 BCE (Phase 7): rivers, canals, fields and crops, orchards, woodland, villages, tracks,
// quarries and Naqsh-e Rustam, built from src/data/plain.json (+ read-only settlement.json) and driven by the date.
// Everything placed traces to a plain.json feature and carries {tier, src, note, placeholder} for the dev overlay (F3).
//
// Budget (D-039): the plain adds a fixed handful of draw calls whatever the view (terrain material layer: 0; rivers +
// canal water: 2; canal banks: 1; tracks: 1; villages: one per occupied 8 km cell; far trees: 1; orchard rows: 1; near
// trees: 2 (+ shadow cascades); near crops: 1; Naqsh-e Rustam: 7; quarries: 1). Measured in tests/e2e/plain.spec.ts.
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
import { FoliageState, riparianTrees, canalTrees, orchardPlots, orchardPlotTrees, woodlandTrees, nearTrees, farBillboards, orchardRows, Tree, TREE_TAG } from './trees';
import { nearCrops } from './crops';
import { buildNaqsh } from './naqsh';
import { buildQuarries } from './quarries';
import { doyOf, riverState } from './seasonal';

export const PLAIN_QUALITY: Record<Quality, { r3: number; maxNear: number; cropR: number; cropStep: number }> = {
  test: { r3: 160, maxNear: 700, cropR: 18, cropStep: 0.42 },
  low: { r3: 200, maxNear: 900, cropR: 20, cropStep: 0.45 },
  medium: { r3: 220, maxNear: 1300, cropR: 24, cropStep: 0.4 },
  high: { r3: 250, maxNear: 1800, cropR: 30, cropStep: 0.36 },
  ultra: { r3: 320, maxNear: 2600, cropR: 38, cropStep: 0.33 },
};
/** trees that cast shadows: the nearest SHADOW_N within SHADOW_R m of the camera */
const SHADOW_N = 400, SHADOW_R = 120;
/** Phase 6 owns the four settlement.json roads (D-040): the plain draws them only if this is switched on at merge */
export const PLAIN_DRAWS_SETTLEMENT_ROADS = false;

export interface PlainBuild {
  group: THREE.Group; data: { rivers: RiversData; canals: Canal[]; villages: Village[]; zones: ZoneMap };
  update(dt: number, ctx: any): void;
  stats(): Record<string, number>; summary(): string;
}
export async function buildPlain(scene: THREE.Scene, terrain: Terrain, phys: Physics | null, opts: { quality: Quality; seed: number; fetchJson?: (p: string) => Promise<any> }): Promise<PlainBuild> {
  const t0 = performance.now(), Q = PLAIN_QUALITY[opts.quality] ?? PLAIN_QUALITY.high;
  const group = new THREE.Group(); group.name = 'plain';
  group.userData = tag(feature('fields_irrigated_pulvar'), 'the Marvdasht plain, 467 BCE (plain.json)');
  const rivers = await loadRivers(opts.fetchJson);
  const canals = buildCanals(terrain, rivers.rivers, opts.seed);
  const villages = placeVillages(terrain, rivers.rivers, canals, opts.seed);
  const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
  const tGen = performance.now() - t0;
  // terrain: the plain's field / crop / woodland layer on the existing chunks (no new draw calls)
  const ground = new PlainGround(zones);
  const terrainGroup = scene.getObjectByName('terrain');
  terrainGroup?.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ground.material; });
  if (terrainGroup) terrainGroup.userData.note = `${terrainGroup.userData.note}; fields, crops, orchard floors and woodland canopy from plain.json zones (C)`;
  // water, banks, canals, tracks
  const rv = buildRivers(terrain, rivers.rivers, canals); group.add(rv.group);
  const cb = canalBanks(canals, terrain); group.add(cb);
  const tr = tracksMesh(trackLines(villages), terrain); group.add(tr);
  if (PLAIN_DRAWS_SETTLEMENT_ROADS) for (const r of settlementRoads()) group.add(tracksMesh([r.pts], terrain, r.width, 'plain-road-' + r.id)); // off by default (D-040)
  // villages
  const vb = buildVillageMeshes(villages, terrain, opts.seed); group.add(vb.group);
  // trees
  const foliage = new FoliageState();
  const wind = uniform(2);
  const r3 = uniform(Q.r3);
  const lineTrees = [...riparianTrees(rivers.rivers, opts.seed), ...canalTrees(canals, opts.seed)];
  const far = farBillboards(lineTrees, terrain, foliage, r3, 20000); far.userData = TREE_TAG(); group.add(far);
  const plots = orchardPlots(zones, villages);
  const orch = orchardRows(plots, terrain, foliage, r3, 16000); orch.userData = TREE_TAG(); group.add(orch);
  // the nearest trees (within SHADOW_R, at most SHADOW_N) cast shadows; the rest of the 3D set does not (shadow passes cost
  // their triangles once per cascade, D-040)
  const near = nearTrees(SHADOW_N, foliage, wind, true), nearNS = nearTrees(Q.maxNear, foliage, wind, false);
  for (const m of [near.wood, near.crown, nearNS.wood, nearNS.crown]) { m.userData = TREE_TAG(); group.add(m); }
  const crops = nearCrops(zones, ground.cropTex, ground.day, wind, Q.cropR, Q.cropStep);
  crops.mesh.userData = tag(feature('fields_irrigated_pulvar'), 'standing crops: plot crop and phenology from the zone mix and crop calendar (plain.json crops: B calendar, C heights and layout)');
  group.add(crops.mesh);
  // Naqsh-e Rustam and the quarries
  const nr = buildNaqsh(terrain, rivers.nrAncientFootAsl); group.add(nr.group);
  const qb = buildQuarries(terrain, opts.seed); group.add(qb.group);
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
  // near trees: every tree kind within R3 of the camera, nearest first
  let lastNear = new THREE.Vector3(1e9, 0, 1e9), nearList: Tree[] = [];
  const rebuildNear = (cam: THREE.Vector3) => {
    const R = Q.r3, cx = cam.x, cy = -cam.z, list: Tree[] = [];
    for (const t of lineTrees) if (Math.abs(t.x - cx) < R && Math.abs(t.y - cy) < R && Math.hypot(t.x - cx, t.y - cy) < R) list.push(t);
    for (const p of plots) if (Math.hypot(p.sx - cam.x, p.sz - cam.z) < R + 150) for (const t of orchardPlotTrees(zones, p.sx, p.sz)) if (Math.hypot(t.x - cx, t.y - cy) < R) list.push(t);
    for (const t of woodlandTrees(zones, cam.x, cam.z, R)) list.push(t);
    list.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    nearList = list; const k = Math.min(SHADOW_N, list.findIndex(t => Math.hypot(t.x - cx, t.y - cy) > SHADOW_R) >>> 0);
    near.set(list.slice(0, k), terrain); nearNS.set(list.slice(k), terrain);
  };
  const syncTrunks = (p: { x: number; y: number; z: number }) => {
    if (!phys || Math.hypot(p.x - lastTrunk.x, p.z - lastTrunk.z) < 15) return;
    lastTrunk = new THREE.Vector3(p.x, p.y, p.z); for (const c of trunkColl) phys.world.removeCollider(c, false); trunkColl = [];
    const R = phys.R;
    for (const t of nearList) { const d = Math.hypot(t.x - p.x, t.y + p.z); if (d > 40) break; if (t.shape === 3) continue; // shrubs are pushed through
      const r = Math.max(0.12, t.h * 0.02), y = terrain.heightAt(t.x, -t.y);
      trunkColl.push(phys.world.createCollider(R.ColliderDesc.cylinder(1.5, r).setTranslation(t.x, y + 1.5, -t.y))); }
  };
  let lastDay = NaN, flow: { pulvar: ReturnType<typeof riverState>; kur: ReturnType<typeof riverState> } | null = null;
  const hemi = (() => { let h: THREE.HemisphereLight | null = null; scene.traverse(o => { if ((o as any).isHemisphereLight) h = o as THREE.HemisphereLight; }); return h as THREE.HemisphereLight | null; })();
  const skyC = new THREE.Color(), horC = new THREE.Color();
  const update = (dt: number, ctx: any) => {
    const day = ctx.clock.dayIndex as number;
    if (day !== lastDay) { lastDay = day; const doy = doyOf(day);
      ground.setDay(doy); foliage.setDay(doy); flow = { pulvar: riverState('river_pulvar', day), kur: riverState('river_kur', day) }; }
    if (hemi) skyC.copy(hemi.color).multiplyScalar(hemi.intensity);
    if (scene.fog) horC.copy((scene.fog as THREE.FogExp2).color); // the fog colour is the calibrated horizon radiance (D-060)
    rv.update(flow!, { sky: skyC, horizon: horC });
    wind.value = ctx.cond?.windMs ?? 2;
    const cam: THREE.Vector3 = ctx.camera.position;
    if (Math.hypot(cam.x - lastNear.x, cam.z - lastNear.z) > Q.r3 * 0.08) { lastNear = cam.clone(); rebuildNear(cam); }
    crops.update(cam, terrain);
    // shadow casting only near the camera (the CSM cascades end at 600 m; a far caster would still be drawn into every
    // cascade its bounding sphere touches): village cells, Naqsh-e Rustam and the quarries
    for (const c of vb.cells) c.mesh.castShadow = c.centres.some(([x, z]) => Math.hypot(x - cam.x, z - cam.z) < 900);
    const nrNear = Math.hypot(600 - cam.x, -6124 - cam.z) < 1200; nr.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = nrNear; });
    const qNear = qb.sites.some(s => Math.hypot(s.x - cam.x, -s.y - cam.z) < 900); qb.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = qNear; });
    const pp = ctx.player?.position ?? cam; syncColliders(pp, cam); syncTrunks(pp);
    void dt;
  };
  const stats = () => ({ canals: canals.length, villages: villages.length, compounds: vb.compounds, villageTris: vb.tris, riverTris: rv.stats().tris, lineTrees: lineTrees.length, orchardPlots: plots.length,
    nearTrees: near.count() + nearNS.count(), shadowTrees: near.count(), crops: crops.count(), naqshTris: nr.tris, genMs: Math.round(tGen), buildMs: Math.round(tBuild) });
  return { group, data: { rivers, canals, villages, zones }, update, stats,
    summary: () => { const s = stats(); return `plain: ${s.villages} villages (${s.compounds} compounds), ${s.canals} canals, ${s.lineTrees} river/canal trees, ${s.orchardPlots} orchard plots, near trees ${s.nearTrees}, crop tufts ${s.crops}, built in ${s.buildMs} ms`; } };
}
