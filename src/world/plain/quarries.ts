// Quarries of the plain (Phase 7): Sivand (Barrington point, +-100 m, B) and Majdabad (map-scale, +-3 km: C position).
// Both are Achaemenid (Barrington "Classical"); the Majdabad quarry is a plausible Terrace stone source (C). A quarry needs
// rock: the point is moved to the nearest outcrop (regional slope > 25 %) within its stated uncertainty, and the move is
// recorded. The workings (stepped cut faces, cut blocks, a spoil heap) are reconstruction (C).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial } from '../../render/materials';
import { feature, tag } from './data';
import { Rng } from '../../core/rng';

export interface QuarryBuild { group: THREE.Group; sites: { id: string; x: number; y: number; moved: number }[]; boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[] }
export function buildQuarries(terrain: Terrain, seed = 1): QuarryBuild {
  const group = new THREE.Group(); group.name = 'plain-quarries';
  const sites: QuarryBuild['sites'] = [], boxes: QuarryBuild['boxes'] = [], geos: THREE.BufferGeometry[] = [];
  const slopeAt = (x: number, y: number) => { const h = (a: number, b: number) => terrain.heightAt(a, -b); return [(h(x + 15, y) - h(x - 15, y)) / 30, (h(x, y + 15) - h(x, y - 15)) / 30] as [number, number]; };
  for (const id of ['quarry_sivand', 'quarry_majdabad']) {
    const f = feature(id); if (!f.present_467) continue;
    let [x, y] = f.xy as [number, number], moved = 0;
    const steep = (px: number, py: number) => Math.hypot(...slopeAt(px, py)) > 0.25;
    if (!steep(x, y)) { let found = false; for (let d = 50; d <= f.unc_m && !found; d += 50) for (let a = 0; a < 360; a += 10) { const px = f.xy[0] + d * Math.cos(a * Math.PI / 180), py = f.xy[1] + d * Math.sin(a * Math.PI / 180); if (steep(px, py)) { x = px; y = py; moved = d; found = true; break; } } if (!found) continue; }
    sites.push({ id, x, y, moved });
    const [gx, gy] = slopeAt(x, y), gl = Math.hypot(gx, gy), dx = -gx / gl, dy = -gy / gl; // downhill (grid)
    const rot = Math.atan2(dy, dx) - Math.PI / 2; // local +v faces downhill
    const rng = new Rng(seed, id);
    const put = (u: number, v: number, w: number, d: number, h: number) => { // u along the face, v downhill; base on the ground at the front
      const px = x + u * Math.cos(rot) - v * Math.sin(rot), py = y + u * Math.sin(rot) + v * Math.cos(rot), g = terrain.heightAt(px, -py);
      const b = new THREE.BoxGeometry(w, h + 1, d).toNonIndexed(); b.deleteAttribute('uv'); b.rotateY(rot); b.translate(px, g + (h - 1) / 2, -py); geos.push(b);
      boxes.push({ c: new THREE.Vector3(px, g + (h - 1) / 2, -py), h: new THREE.Vector3(w / 2, (h + 1) / 2, d / 2), rot });
    };
    for (let k = 0; k < 3; k++) put(0, -4 * k, 26 - 5 * k, 4, 2.2 + k * 0.6); // stepped benches of freshly cut stone
    for (let k = 0; k < 7; k++) put(rng.range(-12, 12), rng.range(4, 14), rng.range(1.2, 2.6), rng.range(0.8, 1.4), rng.range(0.7, 1.1)); // cut blocks waiting to be hauled
    for (let k = 0; k < 10; k++) put(rng.range(14, 24) * (rng.chance(0.5) ? 1 : -1), rng.range(0, 10), rng.range(2, 5), rng.range(2, 5), rng.range(0.3, 1.0)); // spoil (chips)
    void dx; void dy;
  }
  if (geos.length) {
    const m = new THREE.Mesh(mergeGeometries(geos)!, surfaceMaterial('limestone')); m.name = 'plain-quarries'; m.castShadow = m.receiveShadow = true;
    m.userData = tag(feature('quarry_sivand'), `quarries: Sivand (B, +-100 m) and Majdabad (C, +-3 km); moved to rock: ${sites.map(s => `${s.id} ${s.moved} m`).join(', ')}; workings reconstructed (C)`);
    group.add(m);
  }
  return { group, sites, boxes };
}
