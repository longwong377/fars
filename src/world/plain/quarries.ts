// Quarries of the plain (Phase 7): Sivand (Barrington point, +-100 m, B) and Majdabad (map-scale, +-3 km: C position, so C).
// Both are Achaemenid (Barrington "Classical"); the Majdabad quarry is a plausible Terrace stone source (C). A quarry needs
// rock: an outcrop face (regional slope > 25 %) within MOVE_MAX_M of the point is used, the move recorded; otherwise the
// quarry is worked into a low bed of limestone standing out of the ground at the point itself (D-600, s17: the 80 m far ring
// that both lie on cannot show a 5 m outcrop, and the rule moved Majdabad 1.45 km off its point and left Sivand unbuilt).
// The workings (C): an outcrop ridge of scanned rock (hills/bedrock.ts kit), cut back in three stepped benches of fresh pale
// stone with a row of half-cut blocks on each bench (their channels open), the working floor, spoil heaps of chips, cut
// blocks waiting to be hauled, and the camp's huts.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial, SURFACES } from '../../render/materials';
import { feature, tag } from './data';
import { Rng } from '../../core/rng';
import { QUARRY_HUTS } from './quarry_camp';
import { rockKit, bakedRockPiece, rockMaterialOf, rockTint, ROCK_LOD_GAP, BEDROCK, type RockKit } from '../hills/bedrock';

/** D-600: the farthest a quarry is moved to an outcrop face (m); beyond it the quarry is worked where its point is */
export const MOVE_MAX_M = 300;

/** D-256: a quarry's working frame (grid m): its point on the rock, the move from the gazetteer point, and the face's frame
 *  (local u along the face, v downhill: `at(u, v)` gives the grid point). The quarrymen and the drum hauls
 *  (world/traffic.ts) work in this frame, as the workings are built in it */
export interface QuarrySite { id: string; x: number; y: number; moved: number; rot: number; at: (u: number, v: number) => [number, number] }
/** the two quarries' sites on the rock (pure: the terrain and the plain.json points; no geometry) */
export function quarrySites(terrain: { heightAt(x: number, z: number): number }): QuarrySite[] {
  const out: QuarrySite[] = [];
  const slopeAt = (x: number, y: number) => { const h = (a: number, b: number) => terrain.heightAt(a, -b); return [(h(x + 15, y) - h(x - 15, y)) / 30, (h(x, y + 15) - h(x, y - 15)) / 30] as [number, number]; };
  for (const id of ['quarry_sivand', 'quarry_majdabad']) {
    const f = feature(id); if (!f.present_467) continue;
    let [x, y] = f.xy as [number, number], moved = 0;
    const steep = (px: number, py: number) => Math.hypot(...slopeAt(px, py)) > 0.25;
    if (!steep(x, y)) { let found = false; for (let d = 50; d <= Math.min(f.unc_m, MOVE_MAX_M) && !found; d += 50) for (let a = 0; a < 360; a += 10) { const px = f.xy[0] + d * Math.cos(a * Math.PI / 180), py = f.xy[1] + d * Math.sin(a * Math.PI / 180); if (steep(px, py)) { x = px; y = py; moved = d; found = true; break; } } void found; }
    // the workings open downhill; on near-flat ground (< 3 %) toward the Terrace, the way the stone goes
    const [gx, gy] = slopeAt(x, y), gl = Math.hypot(gx, gy), tl = Math.hypot(x, y) || 1;
    const dx = gl > 0.03 ? -gx / gl : -x / tl, dy = gl > 0.03 ? -gy / gl : -y / tl; // downhill (grid)
    const rot = Math.atan2(dy, dx) - Math.PI / 2; // local +v faces downhill
    const X = x, Y = y;
    out.push({ id, x, y, moved, rot, at: (u, v) => [X + u * Math.cos(rot) - v * Math.sin(rot), Y + u * Math.sin(rot) + v * Math.cos(rot)] });
  }
  return out;
}
/** D-600: the workings' measures (m; site frame: u along the face, v out of it; all C, after the Achaemenid quarries of
 *  the Persepolis region: benches cut ~1.5 m a step, blocks of column-drum and wall-block size cut free by channels) */
export const QUARRY = { width: 30, front: 4, back: 30, step: 5, rise: 2.0, benches: 3, floor: [-4, 12] as [number, number],
  block: { w: 2.2, d: 1.4, h: 1.1, gap: 0.22, lifted: 0.3, /** per bench (the frame budget: the stone shares the fords' unculled draw) */ most: 8 },
  /** spoil heaps: centre (u, v), radius, height (piles of the talus scan, 2-3 overlapping, fresh pale chips) */ heaps: [[-23, 9, 8, 2.4], [22, 11, 7, 2.0], [-12, 21, 6, 1.6]] as [number, number, number, number][],
  /** column drums: radius, height (the Apadana's shafts ~1.6-1.9 m across, C), segments, how many lie by the way out */ drum: { r: 0.9, h: 1.1, seg: 18, lying: 3 },
  /** the outcrop: pieces either side and behind, their scale (x the outcrop scan's 4 m) and sunk share */ ridge: { side: 9, behind: 9, top: 4, scale: [4.2, 6] as [number, number], sink: 0.15 },
  /** chips on the heaps and the floor: count per heap, on the floor, their scale */ chips: { heap: 24, floor: 30, scale: [0.07, 0.24] as [number, number] } } as const;
/** a rock piece of the workings: variant, world position, yaw, scale (x, y, z), tint, level class ('ridge' or 'chip') */
interface QPiece { v: number; p: [number, number, number]; yaw: number; s: [number, number, number]; c: [number, number, number]; chip: boolean }
/** fresh-broken limestone (the spoil and chips): the cut stone's own albedo (materials.ts limestone), +-8 % (C) */
const freshTint = (a: number): [number, number, number] => { const c = new THREE.Color().setRGB(...(SURFACES.limestone.albedo as [number, number, number]), THREE.SRGBColorSpace); const f = 0.92 + 0.16 * a; return [c.r * f, c.g * f, c.b * f]; };
/** the outcrop around the cut and the chips (positions only; the kit's shapes join when it has loaded) */
function quarryRockPieces(S: QuarrySite, gAt: (u: number, v: number) => number, y0: number, rng: Rng): QPiece[] {
  const Q = QUARRY, out: QPiece[] = [], put = (u: number, v: number, sc: number, ys: number, sink: number, chip: boolean, y?: number, variant = 0, fresh = chip) => {
    const [px, py] = S.at(u, v), g = y ?? gAt(u, v), a = rng.next(), b = rng.next(), hgt = variant === 2 ? 1.53 : 1.33;
    out.push({ v: variant, p: [px, g - hgt * sc * ys * sink, -py], yaw: rng.range(0, Math.PI * 2), s: [sc, sc * ys, sc * rng.range(0.85, 1.15)], c: fresh ? freshTint(a) : rockTint(a, b, 0.6), chip }); };
  const R = Q.ridge;
  for (const side of [-1, 1]) for (let i = 0; i < R.side; i++) put(side * (Q.width / 2 + rng.range(3, 12)), rng.range(-Q.back - 4, -2), rng.range(R.scale[0], R.scale[1]), rng.range(0.9, 1.2), R.sink, false);
  for (let i = 0; i < R.behind; i++) put(rng.range(-Q.width / 2 - 8, Q.width / 2 + 8), rng.range(-Q.back - 14, -Q.back - 2), rng.range(R.scale[0], R.scale[1]), rng.range(0.9, 1.2), R.sink, false);
  // the bed's weathered top above the highest bench (flattened pieces on it)
  for (let i = 0; i < R.top; i++) put(rng.range(-Q.width / 2 + 6, Q.width / 2 - 6), rng.range(-Q.back + 4, -Q.front - Q.step * (Q.benches - 1) - 6), rng.range(2, 3), 0.35, 0.3, false, y0 + Q.rise * Q.benches);
  // the spoil heaps: overlapping piles of the rubble scan (talus03, 9 x 1.5 x 5.6 m at scale 1) raised to the heap's height,
  // fresh and pale; chips strewn round their toes and over the floor
  for (const [hu, hv, Rr, H] of Q.heaps) { for (let i = 0; i < 3; i++) { const a = rng.range(0, Math.PI * 2), r = i ? Rr * 0.35 : 0, sc = (Rr * 2) / 9 * (i ? 0.7 : 1);
      put(hu + r * Math.cos(a), hv + r * Math.sin(a), sc, H / (1.53 * sc) * (i ? 0.75 : 1), 0.25, false, undefined, 2, true); }
    for (let i = 0; i < Q.chips.heap; i++) { const r = Rr * rng.range(0.8, 1.25), a = rng.range(0, Math.PI * 2);
      put(hu + r * Math.cos(a), hv + r * Math.sin(a), rng.range(Q.chips.scale[0], Q.chips.scale[1]), rng.range(0.5, 1), 0.3, true); } }
  for (let i = 0; i < Q.chips.floor; i++) put(rng.range(-Q.width / 2, Q.width / 2), rng.range(Q.floor[0] + 1, Q.floor[1]), rng.range(Q.chips.scale[0], Q.chips.scale[1] * 0.7), rng.range(0.5, 1), 0.3, true, y0 + 0.06);
  return out;
}
export interface QuarryBuild { group: THREE.Group; sites: QuarrySite[]; boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[]; /** D-600: the outcrop and the chips once the rock kit has loaded, and their level by the camera's distance */ update: (cam: THREE.Vector3) => void }
export function buildQuarries(terrain: Terrain, seed = 1): QuarryBuild {
  const group = new THREE.Group(); group.name = 'plain-quarries';
  const sites: QuarrySite[] = [], boxes: QuarryBuild['boxes'] = [], geos: THREE.BufferGeometry[] = [], ranges: { id: string; moved: number; geos: number }[] = [];
  const rocks: { S: QuarrySite; y0: number; pieces: QPiece[] }[] = [];
  for (const S of quarrySites(terrain)) {
    const { id, moved, rot } = S;
    sites.push(S); const first = geos.length;
    const rng = new Rng(seed, id);
    // D-600: the workings (all C). Levels from the working floor y0 (the ground at the face's foot)
    const gAt = (u: number, v: number) => { const [px, py] = S.at(u, v); return terrain.heightAt(px, -py); };
    const y0 = gAt(0, 2), Q = QUARRY;
    const slab = (u: number, v: number, w: number, d: number, yb: number, yt: number) => { const [px, py] = S.at(u, v), h = yt - yb;
      const b = new THREE.BoxGeometry(w, h, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateY(rot); b.translate(px, (yb + yt) / 2, -py); geos.push(b);
      boxes.push({ c: new THREE.Vector3(px, (yb + yt) / 2, -py), h: new THREE.Vector3(w / 2, h / 2, d / 2), rot }); };
    // the working floor (bedrock levelled by the work, its chips trodden in)
    slab(0, Q.floor[0] / 2 + Q.floor[1] / 2, Q.width + 4, Q.floor[1] - Q.floor[0], y0 - 1.2, y0 + 0.06);
    // three benches stepping back into the bed; on each, at its front, a row of half-cut blocks standing in their channels
    // (some already lifted out, their sockets open), the bed behind them whole
    for (let k = 0; k < Q.benches; k++) {
      const vF = -Q.front - Q.step * k, vB = -Q.back, w = Q.width - 4 * k, top = y0 + Q.rise * (k + 1), bl = Q.block;
      slab(0, (vF + vB) / 2, w, vF - vB, y0 - 1.5, top - bl.h);                                   // the bench's body
      slab(0, (vF - bl.d - bl.gap + vB) / 2, w, vF - bl.d - bl.gap - vB, top - bl.h, top);          // the bed behind the row
      const n = Math.min(bl.most, Math.floor((w + bl.gap) / (bl.w + bl.gap))), u0 = -((n * (bl.w + bl.gap) - bl.gap) / 2) + bl.w / 2;
      for (let i = 0; i < n; i++) if (!rng.chance(bl.lifted)) slab(u0 + i * (bl.w + bl.gap), vF - bl.d / 2, bl.w, bl.d, top - bl.h, top - rng.range(0, 0.04));
    }
    // cut blocks waiting to be hauled, by the way out (u 0, +v)
    for (let k = 0; k < 7; k++) { const u = rng.range(5, 13) * (k % 2 ? 1 : -1), v = rng.range(3, 10), w = rng.range(1.4, 2.6), d = rng.range(0.9, 1.4), h = rng.range(0.8, 1.1), g = gAt(u, v);
      slab(u, v, w, d, g - 0.15, g + h); }
    // (the spoil heaps are piles of the scanned rubble: quarryRockPieces)
    rocks.push({ S, y0, pieces: quarryRockPieces(S, gAt, y0, rng) });
    if (id === QUARRY_HUTS.site) { const H = QUARRY_HUTS, sw = (H.w - H.door) / 2; // B80: the camp's huts (walls, a doorway, a slab roof)
      for (const [cu, cv] of H.at) {
        const [hx, hy] = S.at(cu, cv), g0 = terrain.heightAt(hx, -hy), top = H.h + 0.25; // walls rise from the hut's centre ground
        const wall = (u: number, v: number, w: number, d: number) => { const [px, py] = S.at(u, v), g = terrain.heightAt(px, -py), hh = g0 + top - g;
          const b = new THREE.BoxGeometry(w, hh + 1, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateY(rot); b.translate(px, g + (hh - 1) / 2, -py); geos.push(b);
          boxes.push({ c: new THREE.Vector3(px, g + (hh - 1) / 2, -py), h: new THREE.Vector3(w / 2, (hh + 1) / 2, d / 2), rot }); };
        wall(cu, cv + H.d / 2 - H.wall / 2, H.w, H.wall); // back (downhill)
        wall(cu - H.w / 2 + H.wall / 2, cv, H.wall, H.d - 2 * H.wall); wall(cu + H.w / 2 - H.wall / 2, cv, H.wall, H.d - 2 * H.wall); // sides
        wall(cu - H.w / 2 + sw / 2, cv - H.d / 2 + H.wall / 2, sw, H.wall); wall(cu + H.w / 2 - sw / 2, cv - H.d / 2 + H.wall / 2, sw, H.wall); // front, the doorway between
        const r = new THREE.BoxGeometry(H.w + 0.3, 0.3, H.d + 0.3).toNonIndexed(); r.deleteAttribute('uv'); r.rotateY(rot); r.translate(hx, g0 + top + 0.15, -hy); geos.push(r); // slabs under earth
        boxes.push({ c: new THREE.Vector3(hx, g0 + top + 0.15, -hy), h: new THREE.Vector3((H.w + 0.3) / 2, 0.15, (H.d + 0.3) / 2), rot });
      } }
    ranges.push({ id, moved, geos: geos.length - first });
  }
  if (geos.length) {
    const m = new THREE.Mesh(mergeGeometries(geos)!, surfaceMaterial('rubble')); m.name = 'plain-quarries'; m.castShadow = m.receiveShadow = true; // (the material it wears in the world: merged into the fords' rubble draw)
    // one merged mesh for both sites; F3 describes the site whose faces were hit (Sivand B, Majdabad C: D-228), and the mesh
    // as a whole carries the lower tier
    const siteTag = (id: string, moved: number) => tag(feature(id), `${feature(id).name ?? id}: ${feature(id).note} Moved ${moved} m to rock (regional slope > 25 %); the workings (cut benches, blocks, spoil) and the camp's dry-stone huts are reconstruction (C)`);
    const ends: { end: number; id: string; moved: number }[] = []; let v = 0, k = 0;
    for (const r of ranges) { for (let i = 0; i < r.geos; i++) v += geos[k++].getAttribute('position').count; ends.push({ end: v / 3, id: r.id, moved: r.moved }); }
    m.userData = { ...tag({ tier: 'C', src: ranges.map(r => feature(r.id).src).join(';') }, `quarries: ${sites.map(s => `${s.id} (${feature(s.id).tier}, +-${feature(s.id).unc_m} m, moved ${s.moved} m to rock)`).join(', ')}; workings reconstructed (C)`),
      describe: (hit: any) => { const e = ends.find(q => (hit?.faceIndex ?? Infinity) < q.end); return e ? siteTag(e.id, e.moved) : null; } };
    group.add(m);
  }
  // the outcrop's pieces stand as solids too (their footprint, a little inside the scan's extent)
  for (const r of rocks) for (const q of r.pieces) if (!q.chip) { const w = 4.04 * q.s[0] * 0.35, d = 3.75 * q.s[2] * 0.35, h = 1.33 * q.s[1];
    boxes.push({ c: new THREE.Vector3(q.p[0], q.p[1] + h / 2, q.p[2]), h: new THREE.Vector3(w, h / 2, d), rot: q.yaw }); }
  // the rock: per quarry one mesh (culled on its own) with three merged levels, built when the kit is there; a level changes
  // where the outcrop's largest piece's gap between levels spans 2 px (bedrock.ts ROCK_LOD_GAP)
  let rockMeshes: { m: THREE.Mesh; levels: THREE.BufferGeometry[]; x: number; z: number }[] | null = null;
  const build = (kit: RockKit) => {
    const mat = rockMaterialOf(kit, 'ground'); if (!mat || !kit.ground.length) return [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    return rocks.map(r => {
      const levels = [0, 1, 2].map(l => { const parts: THREE.BufferGeometry[] = [];
        for (const pc of r.pieces) { m4.compose(new THREE.Vector3(...pc.p), q.setFromAxisAngle(up, pc.yaw), new THREE.Vector3(...pc.s)); parts.push(bakedRockPiece(kit, 'ground', pc.v, pc.chip ? 2 : l, m4, pc.c)); }
        const g = mergeGeometries(parts.map(p => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv', 'rtint', 'rorg'].includes(k)) p.deleteAttribute(k); return p; }))!;
        g.computeBoundingSphere(); return g; });
      const m = new THREE.Mesh(levels[2], mat); m.name = `plain-quarries:rock:${r.S.id}`; m.castShadow = m.receiveShadow = true;
      m.userData = tag({ tier: 'C', src: 'POLYHAVEN-CC0' }, 'the quarry\'s outcrop, spoil heaps and chips (D-600): CC0 rock scans (Poly Haven, hills/bedrock.ts kit) re-tinted to the limestone palette; every place C');
      group.add(m); return { m, levels, x: r.S.x, z: -r.S.y }; });
  };
  const gap = ROCK_LOD_GAP.outcrop05 ?? [0.07, 0.64], sMax = QUARRY.ridge.scale[1], dNear = (gap[0] * sMax * BEDROCK.pxRad) / 2, dMid = (gap[1] * sMax * BEDROCK.pxRad) / 2;
  const update = (cam: THREE.Vector3) => {
    if (!rockMeshes) { const kit = rockKit(); if (!kit) return; rockMeshes = build(kit); }
    for (const R of rockMeshes) { const d = Math.hypot(R.x - cam.x, R.z - cam.z), g = R.levels[d < dNear ? 0 : d < dMid ? 1 : 2]; if (R.m.geometry !== g) R.m.geometry = g; }
  };
  // column drums roughed out at the quarry (the Terrace's columns were raised from drums: construction.ts, traffic.ts's
  // hauls): lying on the floor by the way out, and one standing half-freed on the lowest bench; per quarry one draw (C)
  const drumMat = surfaceMaterial('limestone_carved');
  for (const r of rocks) {
    const S = r.S, rng = new Rng(seed, S.id + ':drums'), parts: THREE.BufferGeometry[] = [], D = QUARRY.drum;
    const drum = (u: number, v: number, y: number, lying: boolean, yaw: number) => { const [px, py] = S.at(u, v), c = new THREE.CylinderGeometry(D.r, D.r * 1.02, D.h, D.seg, 1);
      if (lying) c.rotateZ(Math.PI / 2); c.rotateY(S.rot + yaw); c.translate(px, y + (lying ? D.r : D.h / 2), -py); parts.push(c);
      boxes.push({ c: new THREE.Vector3(px, y + (lying ? D.r : D.h / 2), -py), h: lying ? new THREE.Vector3(D.h / 2, D.r, D.r) : new THREE.Vector3(D.r * 0.8, D.h / 2, D.r * 0.8), rot: S.rot + yaw }); };
    for (let k = 0; k < D.lying; k++) { const u = (k % 2 ? 1 : -1) * rng.range(3, 6), v = rng.range(10, 14); drum(u, v, terrain.heightAt(...(([a, b]) => [a, -b] as [number, number])(S.at(u, v))) - 0.12, true, rng.range(-0.4, 0.4)); }
    drum(-QUARRY.width / 2 + 4, -QUARRY.front - QUARRY.block.d / 2, r.y0 + QUARRY.rise - QUARRY.block.h, false, 0);
    const m = new THREE.Mesh(mergeGeometries(parts.map(g => g.toNonIndexed()))!, drumMat); m.name = `plain-quarries:drums:${S.id}`; m.castShadow = m.receiveShadow = true;
    m.userData = tag({ tier: 'C', src: 'RECON' }, 'column drums roughed out at the quarry, waiting for the sledge (D-600; C)'); group.add(m);
  }
  return { group, sites, boxes, update };
}
