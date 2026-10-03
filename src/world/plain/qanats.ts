// D-670 (s18, the lead's ask from C12's holes audit): qanats on the plain. No qanat in Fars is archaeologically dated to the
// Achaemenids (QANAT-WH2018, Q-052), but nothing says there were none: Polybius (10.28) has the Persian kings granting the use
// of land for five generations to whoever brought water to it underground, and the technique is attested in Iron Age Oman. By
// the project's gap rule (D-207: the most probable reconstruction where the evidence is silent) they are drawn, tier C: lines
// of shaft mounds (the spoil thrown up round each shaft, a dark hole in its crown) running from the hill feet down the
// alluvial fans onto the plain, the shafts 20-45 m apart and their mounds larger upslope where the shafts are deeper; the
// gallery's water surfaces at the line's foot. Where: heads on the fans at the foot of the hills (ground falling 2-8 %)
// within ~14 km of the Apadana, >= 1.2 km apart; each line follows the fall of the ground for 0.7-5 km and stops short of the
// settlement zones, the Terrace, the rivers, the roads and the villages (C for all of it).
// Drawn as one instanced mound per shaft, in 3 km tiles (one InstancedMesh each, shown within QANAT.drawR of the viewer).
import * as THREE from 'three/webgpu';
import type { Terrain } from '../../terrain/heightfield';
import { PointIndex, settlementRoads, settlementZones, pointInPolygon, baseCourse, type RiverProfile } from './data';
import { hash2, unit, cellU } from './fields';
import { TERRACE_BOX } from './townGround';
import { surfaceMaterial } from '../../render/materials';

export const QANAT = { reach: 14000, headCell: 300, headKeep: 0.5, minSep: 900, step: 30, len: [700, 5000] as [number, number], tile: 3000, drawR: 3200 } as const;
export const QANAT_TAG = { tier: 'C', src: 'QANAT-WH2018;POLYBIUS-10.28;RECON', note: 'qanat shaft mounds (D-670): no Achaemenid qanat is dated in Fars (Q-052), none is ruled out; Polybius 10.28 has the Persian kings rewarding underground water works; placed by rule on the hill-foot fans, C' };

export interface Shaft { e: number; n: number; r: number; h: number }
export interface QanatLine { id: number; shafts: Shaft[] }

/** the qanat lines (pure: the page, the tests and the census): rivers on their drawn course, villages as placed */
export function qanatLines(terrain: Terrain, rivers: RiverProfile[], villages: { x: number; y: number; r: number }[]): QanatLine[] {
  const asl = (e: number, n: number) => terrain.aslAt(e, -n);
  const fall = (e: number, n: number): [number, number, number] => { const d = 40, gx = (asl(e + d, n) - asl(e - d, n)) / (2 * d), gy = (asl(e, n + d) - asl(e, n - d)) / (2 * d), g = Math.hypot(gx, gy); return [-gx / (g || 1), -gy / (g || 1), g]; };
  const water = new PointIndex(300); for (const r of rivers) { water.addPolyline(r, 20); water.addPolyline(baseCourse(r), 20); }
  const roads = new PointIndex(200); for (const r of settlementRoads()) roads.addPolyline(r.pts, 10);
  const zones = settlementZones();
  const blocked = (e: number, n: number) => water.any(e, n, 90) || roads.any(e, n, 14) || zones.some(z => pointInPolygon(e, n, z))
    || Math.hypot(Math.max(TERRACE_BOX.e0 - e, 0, e - TERRACE_BOX.e1), Math.max(TERRACE_BOX.n0 - n, 0, n - TERRACE_BOX.n1)) < 250
    || villages.some(v => Math.hypot(v.x - e, v.y - n) < v.r + 60);
  const heads: [number, number, number][] = [], C = QANAT.headCell, R = QANAT.reach;
  for (let i = Math.floor(-R / C); i <= Math.floor(R / C); i++) for (let j = Math.floor(-R / C); j <= Math.floor(R / C); j++) {
    const a = cellU(i), b = cellU(j), k = unit(hash2(a, b, 401)); if (k > QANAT.headKeep) continue;
    const e = (i + 0.2 + 0.6 * unit(hash2(a, b, 402))) * C, n = (j + 0.2 + 0.6 * unit(hash2(a, b, 403))) * C;
    if (Math.hypot(e, n) > R) continue; const [, , g] = fall(e, n); if (g < 0.015 || g > 0.1 || blocked(e, n)) continue;
    heads.push([e, n, k]);
  }
  heads.sort((p, q) => p[2] - q[2]);
  const out: QanatLine[] = [], kept: [number, number][] = [];
  for (const [e0, n0] of heads) {
    if (kept.some(([e, n]) => Math.hypot(e - e0, n - n0) < QANAT.minSep)) continue;
    const id = out.length, salt = cellU(Math.round(e0)) ^ cellU(Math.round(n0)), maxL = QANAT.len[0] + (QANAT.len[1] - QANAT.len[0]) * unit(hash2(salt, 7, 404));
    const pts: [number, number][] = [[e0, n0]]; let [dx, dy] = fall(e0, n0), e = e0, n = n0, L = 0, flat = 0;
    while (L < maxL) {
      const [fx, fy, g] = fall(e, n); // follow the fall, turning at most ~20 deg a step
      let nx = dx * 0.75 + fx * 0.25, ny = dy * 0.75 + fy * 0.25; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const e1 = e + nx * QANAT.step, n1 = n + ny * QANAT.step; if (blocked(e1, n1)) break;
      e = e1; n = n1; dx = nx; dy = ny; L += QANAT.step; pts.push([e, n]);
      if (g < 0.006) { flat += QANAT.step; if (flat > 600) break; }
    }
    if (L < QANAT.len[0]) continue;
    // shafts: 20-45 m apart, closer toward the foot (C); mounds larger upslope (deeper shafts)
    const shafts: Shaft[] = []; let s = 0, next = 0;
    for (let i = 1; i < pts.length; i++) { const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      while (next <= s + seg) { const f = (next - s) / seg, x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, up = 1 - next / L;
        const hh = hash2(salt, shafts.length, 405);
        shafts.push({ e: x, n: y, r: 1.6 + 2.6 * up * (0.75 + 0.5 * unit(hh)), h: 0.35 + 0.8 * up * (0.7 + 0.6 * unit(hash2(hh, 1, 406))) });
        next += 20 + 25 * up + 6 * (unit(hash2(hh, 2, 407)) - 0.5); }
      s += seg; }
    out.push({ id, shafts }); kept.push([e0, n0]);
  }
  return out;
}

/** a shaft mound of unit radius and height: a ring of spoil (crest at 0.55) round a dark shaft mouth (radius 0.18), its rim
 *  slumped in; vertex colours carry the spoil's tone (paler fresh spoil on the crest, the dark hole) */
function moundGeometry(): THREE.BufferGeometry {
  const prof: [number, number, number][] = [[0, -0.9, 0.06], [0.18, -0.2, 0.1], [0.24, 0.7, 0.7], [0.5, 1.0, 1.0], [0.8, 0.5, 0.95], [1.05, -0.05, 0.88]];
  const seg = 9, pos: number[] = [], col: number[] = [], idx: number[] = [], soil = new THREE.Color().setRGB(0.62, 0.52, 0.41, THREE.SRGBColorSpace); // the plain's loam (rivers.ts), the spoil a little paler
  for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), wob = 1 + 0.08 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 5);
    for (const [r, y, t] of prof) { pos.push(r * wob * c, y, r * wob * s); col.push(soil.r * t, soil.g * t, soil.b * t); } }
  const P = prof.length; for (let k = 0; k < seg; k++) for (let i = 0; i < P - 1; i++) { const a = k * P + i, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export class Qanats {
  readonly group = new THREE.Group(); readonly lines: QanatLine[]; private tiles: { c: [number, number]; mesh: THREE.InstancedMesh }[] = [];
  constructor(terrain: Terrain, rivers: RiverProfile[], villages: { x: number; y: number; r: number }[]) {
    this.group.name = 'plain-qanats'; this.group.userData = { ...QANAT_TAG, placeholder: false };
    this.lines = qanatLines(terrain, rivers, villages);
    const geo = moundGeometry(), mat = surfaceMaterial('earth', { vertexColors: true }), byTile = new Map<string, Shaft[]>();
    for (const l of this.lines) for (const s of l.shafts) { const k = `${Math.floor(s.e / QANAT.tile)},${Math.floor(s.n / QANAT.tile)}`; let a = byTile.get(k); if (!a) byTile.set(k, a = []); a.push(s); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [k, list] of byTile) { const [ti, tj] = k.split(',').map(Number), mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => { q.setFromAxisAngle(up, (s.e * 0.37 + s.n * 0.11) % 6.283); m4.compose(p.set(s.e, terrain.heightAt(s.e, -s.n) - 0.08, -s.n), q, sc.set(s.r, s.h, s.r)); mesh.setMatrixAt(i, m4);
      });
      mesh.computeBoundingSphere(); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = `qanat-tile:${k}`; mesh.userData = this.group.userData; mesh.visible = false;
      this.group.add(mesh); this.tiles.push({ c: [(ti + 0.5) * QANAT.tile, (tj + 0.5) * QANAT.tile], mesh }); }
  }
  /** the viewer (grid e, n): tiles within reach shown */
  update(e: number, n: number) { for (const t of this.tiles) t.mesh.visible = Math.hypot(t.c[0] - e, t.c[1] - n) < QANAT.drawR + QANAT.tile * 0.71; }
  stats() { return { lines: this.lines.length, shafts: this.lines.reduce((a, l) => a + l.shafts.length, 0), tiles: this.tiles.length }; }
}
