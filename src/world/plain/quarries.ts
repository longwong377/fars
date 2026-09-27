// Quarries of the plain (Phase 7): Sivand (Barrington point, +-100 m, B) and Majdabad (map-scale, +-3 km: C position, so C).
// Both are Achaemenid (Barrington "Classical"); the Majdabad quarry is a plausible Terrace stone source (C). A quarry needs
// rock: the point is moved to the nearest outcrop (regional slope > 25 %) within its stated uncertainty, and the move is
// recorded. The workings (stepped cut faces, cut blocks, a spoil heap) are reconstruction (C).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial } from '../../render/materials';
import { feature, tag } from './data';
import { Rng } from '../../core/rng';
import { QUARRY_HUTS } from './quarry_camp';

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
    if (!steep(x, y)) { let found = false; for (let d = 50; d <= f.unc_m && !found; d += 50) for (let a = 0; a < 360; a += 10) { const px = f.xy[0] + d * Math.cos(a * Math.PI / 180), py = f.xy[1] + d * Math.sin(a * Math.PI / 180); if (steep(px, py)) { x = px; y = py; moved = d; found = true; break; } } if (!found) continue; }
    const [gx, gy] = slopeAt(x, y), gl = Math.hypot(gx, gy), dx = -gx / gl, dy = -gy / gl; // downhill (grid)
    const rot = Math.atan2(dy, dx) - Math.PI / 2; // local +v faces downhill
    const X = x, Y = y;
    out.push({ id, x, y, moved, rot, at: (u, v) => [X + u * Math.cos(rot) - v * Math.sin(rot), Y + u * Math.sin(rot) + v * Math.cos(rot)] });
  }
  return out;
}
export interface QuarryBuild { group: THREE.Group; sites: QuarrySite[]; boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[] }
export function buildQuarries(terrain: Terrain, seed = 1): QuarryBuild {
  const group = new THREE.Group(); group.name = 'plain-quarries';
  const sites: QuarrySite[] = [], boxes: QuarryBuild['boxes'] = [], geos: THREE.BufferGeometry[] = [], ranges: { id: string; moved: number; geos: number }[] = [];
  for (const S of quarrySites(terrain)) {
    const { id, moved, rot } = S;
    sites.push(S); const first = geos.length;
    const rng = new Rng(seed, id);
    const put = (u: number, v: number, w: number, d: number, h: number) => { // u along the face, v downhill; base on the ground at the front
      const [px, py] = S.at(u, v), g = terrain.heightAt(px, -py);
      const b = new THREE.BoxGeometry(w, h + 1, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateY(rot); b.translate(px, g + (h - 1) / 2, -py); geos.push(b);
      boxes.push({ c: new THREE.Vector3(px, g + (h - 1) / 2, -py), h: new THREE.Vector3(w / 2, (h + 1) / 2, d / 2), rot });
    };
    for (let k = 0; k < 3; k++) put(0, -4 * k, 26 - 5 * k, 4, 2.2 + k * 0.6); // stepped benches of freshly cut stone
    for (let k = 0; k < 7; k++) put(rng.range(-12, 12), rng.range(4, 14), rng.range(1.2, 2.6), rng.range(0.8, 1.4), rng.range(0.7, 1.1)); // cut blocks waiting to be hauled
    for (let k = 0; k < 10; k++) put(rng.range(14, 24) * (rng.chance(0.5) ? 1 : -1), rng.range(0, 10), rng.range(2, 5), rng.range(2, 5), rng.range(0.3, 1.0)); // spoil (chips)
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
    const m = new THREE.Mesh(mergeGeometries(geos)!, surfaceMaterial('limestone')); m.name = 'plain-quarries'; m.castShadow = m.receiveShadow = true;
    // one merged mesh for both sites; F3 describes the site whose faces were hit (Sivand B, Majdabad C: D-228), and the mesh
    // as a whole carries the lower tier
    const siteTag = (id: string, moved: number) => tag(feature(id), `${feature(id).name ?? id}: ${feature(id).note} Moved ${moved} m to rock (regional slope > 25 %); the workings (cut benches, blocks, spoil) and the camp's dry-stone huts are reconstruction (C)`);
    const ends: { end: number; id: string; moved: number }[] = []; let v = 0, k = 0;
    for (const r of ranges) { for (let i = 0; i < r.geos; i++) v += geos[k++].getAttribute('position').count; ends.push({ end: v / 3, id: r.id, moved: r.moved }); }
    m.userData = { ...tag({ tier: 'C', src: ranges.map(r => feature(r.id).src).join(';') }, `quarries: ${sites.map(s => `${s.id} (${feature(s.id).tier}, +-${feature(s.id).unc_m} m, moved ${s.moved} m to rock)`).join(', ')}; workings reconstructed (C)`),
      describe: (hit: any) => { const e = ends.find(q => (hit?.faceIndex ?? Infinity) < q.end); return e ? siteTag(e.id, e.moved) : null; } };
    group.add(m);
  }
  return { group, sites, boxes };
}
