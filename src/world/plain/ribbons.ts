// Linear features draped on the terrain (Phase 7): canal spoil banks and the village tracks. Both are ribbons whose
// vertices sit on the rendered/walked terrain (Terrain.heightAt, D-035) and rise with camera distance like the rivers
// (rivers.ts liftNode), so the terrain's coarse far LODs never bury them. Canals: water at ground level between two low
// earthen banks (irrigation_systems_sumner rule, C); tracks: compacted earth with wheel ruts (villages_unlocated.tracks, C).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, positionWorld, vec3, float, mix, smoothstep, abs, mx_noise_float, color, max } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import { surfaceMaterial, type Layer } from '../../render/materials';
import { liftNode } from './rivers';
import type { Canal } from './canals';
import type { Village } from './villages';
import { feature, settlementRoads, distToSegment, tag } from './data';
import { hash2, unit, cellU } from './fields';

const SOIL = new THREE.Color().setRGB(0.43, 0.36, 0.27, THREE.SRGBColorSpace);
/** a ribbon over a grid polyline: `profile` gives [lateral offset, height above ground, attribute t] per cross-section vertex */
function ribbon(pts: [number, number][], terrain: Terrain, profile: [number, number, number][], step: number, out: { pos: number[]; col: number[]; att: number[]; idx: number[] }) {
  // resample
  const P: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step)); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
  P.push(pts[pts.length - 1]);
  const per = profile.length, base = out.pos.length / 3;
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    const g0 = terrain.heightAt(P[i][0], -P[i][1]);
    for (const [u, h, t] of profile) {
      const x = P[i][0] + nx * u, y = P[i][1] + ny * u, g = Math.abs(u) < 1.5 ? g0 : terrain.heightAt(x, -y);
      out.pos.push(x, g + h, -y); out.col.push(SOIL.r, SOIL.g, SOIL.b); out.att.push(t);
    }
    if (i > 0) { const s0 = base + (i - 1) * per, s1 = base + i * per; // profile listed right (negative u) to left: counter-clockwise from above
      for (let k = 0; k + 1 < per; k++) out.idx.push(s0 + k, s1 + k, s0 + k + 1, s0 + k + 1, s1 + k, s1 + k + 1); }
  }
}
function mesh(name: string, buf: { pos: number[]; col: number[]; att: number[]; idx: number[] }, mat: THREE.Material, userData: any): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3)); g.setAttribute('lat', new THREE.Float32BufferAttribute(buf.att, 1));
  g.setIndex(buf.idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; m.frustumCulled = false; m.userData = userData; return m;
}

export function canalBanks(canals: Canal[], terrain: Terrain): THREE.Mesh {
  const rule = feature('irrigation_systems_sumner').procedural_rule, crest = rule.bank_crest_m as number;
  const buf = { pos: [] as number[], col: [] as number[], att: [] as number[], idx: [] as number[] };
  for (const c of canals) {
    const w = c.width / 2;
    ribbon(c.pts, terrain, [[-(w + 2.2), 0.03, 1], [-(w + 0.7), crest, 0.5], [-w, 0.02, 0], [0, -0.25, 0], [w, 0.02, 0], [w + 0.7, crest, 0.5], [w + 2.2, 0.03, 1]], 12.5, buf);
  }
  const mat = surfaceMaterial('earth', { vertexColors: true, variant: 'canalbank', modify: (L: Layer) => {
    const t = attribute('lat', 'float');
    const grass = color(new THREE.Color().setRGB(0.27, 0.36, 0.14, THREE.SRGBColorSpace)), wet = color(new THREE.Color().setRGB(0.25, 0.21, 0.16, THREE.SRGBColorSpace));
    let alb = mix(L.alb, grass.mul(mx_noise_float(positionWorld.mul(1.7)).mul(0.2).add(1)), smoothstep(0.1, 0.45, t).mul(float(1).sub(smoothstep(0.7, 1.0, t))).mul(0.8));
    alb = mix(alb, wet, float(1).sub(smoothstep(0.0, 0.2, t)));
    return { alb, rough: L.rough, height: L.height };
  } });
  mat.positionNode = positionLocal.add(vec3(0, liftNode(positionLocal), 0));
  return mesh('plain-canal-banks', buf, mat, tag(feature('irrigation_systems_sumner'), 'canal spoil banks and water: procedural rule (off-takes every 2-4 km, contour at 0.5 m/km, 1.5-3 m wide: C)'));
}

/** village tracks: minimum spanning tree over the villages plus each village's link to its nearest settlement.json road (C) */
export function trackLines(villages: Village[]): [number, number][][] {
  const n = villages.length, inTree = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1), edges: [number, number][] = [];
  inTree[0] = true; for (let j = 1; j < n; j++) { best[j] = Math.hypot(villages[j].x - villages[0].x, villages[j].y - villages[0].y); from[j] = 0; }
  for (let k = 1; k < n; k++) {
    let bi = -1; for (let j = 0; j < n; j++) if (!inTree[j] && (bi < 0 || best[j] < best[bi])) bi = j;
    inTree[bi] = true; edges.push([from[bi], bi]);
    for (let j = 0; j < n; j++) if (!inTree[j]) { const d = Math.hypot(villages[j].x - villages[bi].x, villages[j].y - villages[bi].y); if (d < best[j]) { best[j] = d; from[j] = bi; } }
  }
  const lines: [number, number][][] = [];
  for (const [a, b] of edges) { const A = villages[a], B = villages[b]; if (Math.hypot(A.x - B.x, A.y - B.y) < 9000) lines.push([[A.x, A.y], [B.x, B.y]]); }
  const roads = settlementRoads();
  for (const v of villages) {
    let bd = Infinity, bp: [number, number] | null = null;
    for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i];
      const d = distToSegment(v.x, v.y, ax, ay, bx, by); if (d < bd) { bd = d; const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((v.x - ax) * dx + (v.y - ay) * dy) / (dx * dx + dy * dy))); bp = [ax + t * dx, ay + t * dy]; } }
    if (bp && bd < 6000 && bd > v.r) lines.push([[v.x, v.y], bp]);
  }
  // meander gently (a track follows field edges, not a ruled line): +-12 m at ~700 m wavelength, zero at the ends
  return lines.map(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(L / 25)), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, ph = unit(hash2(cellU(a[0]), cellU(b[1]), 95)) * 6.28;
    return Array.from({ length: n + 1 }, (_, k) => { const t = k / n, o = Math.sin(t * L / 700 * 6.28 + ph) * 12 * Math.sin(Math.PI * t); return [a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o] as [number, number]; }); });
}
export function tracksMesh(lines: [number, number][][], terrain: Terrain, width = feature('villages_unlocated').tracks.width_m as number, name = 'plain-tracks'): THREE.Mesh {
  const w = width / 2;
  const buf = { pos: [] as number[], col: [] as number[], att: [] as number[], idx: [] as number[] };
  // skip stretches that would climb a mountainside (a track goes round, C): cut the line where the ground is steep
  for (const line of lines) {
    let run: [number, number][] = [];
    const flush = () => { if (run.length > 3) ribbon(run, terrain, [[-(w + 1.2), 0.02, -1.4], [-w, 0.05, -1], [w, 0.05, 1], [w + 1.2, 0.02, 1.4]], 18, buf); run = []; };
    for (let i = 0; i < line.length; i++) { const [x, y] = line[i]; const s = Math.abs(terrain.heightAt(x + 10, -y) - terrain.heightAt(x - 10, -y)) / 20 + Math.abs(terrain.heightAt(x, -y - 10) - terrain.heightAt(x, -y + 10)) / 20;
      if (s > 0.1) flush(); else run.push([x, y]); }
    flush();
  }
  const mat = surfaceMaterial('earth', { vertexColors: true, variant: 'track', modify: (L: Layer) => {
    const t = abs(attribute('lat', 'float'));
    const packed = color(new THREE.Color().setRGB(0.58, 0.51, 0.40, THREE.SRGBColorSpace));
    const rut = float(1).sub(smoothstep(0.08, 0.2, abs(t.sub(0.55)))); // two wheel ruts
    const core = float(1).sub(smoothstep(0.85, 1.25, t));
    let alb = mix(L.alb, packed.mul(mx_noise_float(positionWorld.mul(0.9)).mul(0.08).add(1)), core.mul(0.85));
    alb = alb.mul(float(1).sub(rut.mul(0.12).mul(core)));
    return { alb, rough: L.rough, height: L.height ? L.height.mul(max(float(0.3), float(1).sub(core))).sub(rut.mul(0.03)) : null };
  } });
  mat.positionNode = positionLocal.add(vec3(0, liftNode(positionLocal).mul(0.5), 0));
  return mesh(name, buf, mat, tag(feature('villages_unlocated').tracks as any, name === 'plain-tracks' ? 'village tracks: reconstructed courses (C), 3.5 m compacted earth' : 'settlement.json roads beyond the settlement zones (courses C; drawn here only when PLAIN_DRAWS_SETTLEMENT_ROADS)'));
}
