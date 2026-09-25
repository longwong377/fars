// D-227: line of sight over the town (node; measurement only). A 0.5 m max-height raster of the town's up-facing
// surfaces (walls' tops, roofs, parapets, ovens, kilns), ray marching against it and the terrain, the moment cameras, and
// what a fire's light on its courtyard's walls and floor sends toward a camera.
import * as THREE from 'three/webgpu';
import type { Terrain } from '../../src/terrain/heightfield';
import { sunHorizon } from '../../src/sky/ephemeris';
import { START_JDN, LMT_OFFSET_H } from '../../src/core/calendar';

/** the sun's altitude (deg) at a local hour of a day (the world clock's jdUT) */
export function sunAltAt(day: number, hour: number): number { return sunHorizon(START_JDN + day + hour / 24 - 0.5 - LMT_OFFSET_H / 24).altitude; }

export interface Raster { x0: number; z0: number; c: number; nx: number; nz: number; h: Float32Array; filled: number }
const NONE = -1e9;
/** max height of the up-facing triangles of the town's meshes (settlement:*: walls, roofs, ovens, the Tol-e Ajori gate), on
 *  a `cell` m grid (sampled at cell / 2.5 inside each triangle, so a 0.4 m wall marks the cells it crosses) */
export function heightRaster(group: THREE.Object3D, cell = 0.5, only: RegExp = /^settlement:/, clip?: { x0: number; x1: number; z0: number; z1: number }): Raster {
  const meshes: THREE.Mesh[] = []; group.updateMatrixWorld(true);
  group.traverse((o: any) => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.getAttribute('position') && only.test(o.name) && !/ground|refuse|haze|water|road|canal/.test(o.name)) meshes.push(o); });
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const m of meshes) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox!; x0 = Math.min(x0, b.min.x); z0 = Math.min(z0, b.min.z); x1 = Math.max(x1, b.max.x); z1 = Math.max(z1, b.max.z); }
  if (clip) { x0 = Math.max(x0, clip.x0); z0 = Math.max(z0, clip.z0); x1 = Math.min(x1, clip.x1); z1 = Math.min(z1, clip.z1); }
  const nx = Math.ceil((x1 - x0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1, h = new Float32Array(nx * nz).fill(NONE);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  let filled = 0; const st = cell / 2.5;
  for (const m of meshes) { const p = m.geometry.getAttribute('position'), idx = m.geometry.index, N = idx ? idx.count : p.count;
    for (let t = 0; t < N; t += 3) { const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
      if (clip && (Math.max(a.x, b.x, c.x) < x0 || Math.min(a.x, b.x, c.x) > x1 || Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1)) continue;
      e1.subVectors(b, a); e2.subVectors(c, a); n.crossVectors(e1, e2); const L = n.length(); if (L < 1e-9 || Math.abs(n.y) / L < 0.5) continue;
      const l1 = e1.length(), l2 = e2.length(), s1 = Math.max(1, Math.ceil(l1 / st)), s2 = Math.max(1, Math.ceil(l2 / st));
      for (let i = 0; i <= s1; i++) for (let j = 0; i / s1 + j / s2 <= 1 + 1e-9 && j <= s2; j++) { const u = i / s1, v = j / s2;
        const x = a.x + e1.x * u + e2.x * v, y = a.y + e1.y * u + e2.y * v, z = a.z + e1.z * u + e2.z * v;
        const ix = Math.floor((x - x0) / cell), iz = Math.floor((z - z0) / cell); if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const k = iz * nx + ix; if (h[k] === NONE) filled++; if (y > h[k]) h[k] = y; } } }
  return { x0, z0, c: cell, nx, nz, h, filled };
}
export function rasterAt(R: Raster, x: number, z: number): number { const ix = Math.floor((x - R.x0) / R.c), iz = Math.floor((z - R.z0) / R.c); return ix < 0 || iz < 0 || ix >= R.nx || iz >= R.nz ? NONE : R.h[iz * R.nx + ix]; }
/** is the segment eye → target clear of the town's surfaces and the ground? (cells within `skip` m of the target, measured
 *  horizontally, are not tested: the target's own wall or hearth ring) */
export function losClear(R: Raster, T: Terrain, eye: THREE.Vector3, tg: THREE.Vector3, skip = 0.4): boolean {
  const dx = tg.x - eye.x, dy = tg.y - eye.y, dz = tg.z - eye.z, Lh = Math.hypot(dx, dz), L = Math.hypot(dx, dy, dz); if (L < 1e-6) return true;
  const step = R.c * 0.5, n = Math.ceil(L / step);
  for (let i = 1; i < n; i++) { const t = i / n, x = eye.x + dx * t, y = eye.y + dy * t, z = eye.z + dz * t;
    if (Lh * (1 - t) < skip) break;
    if (rasterAt(R, x, z) > y) return false;
    if (i % 8 === 0 && T.heightAt(x, z) > y + 0.05) return false; }
  return true;
}
export interface Cam { n: string; e: number; n_: number; eye: number; absY?: number; az: number; pitch: number; fov: number; hour: number; aspect: number }
/** the moment cameras (tests/e2e/moments.spec.ts; the Terrace one at the floor's y ≈ 0 as smoke_dust.test.ts has it) */
export const CAMS: (Cam & { n: string })[] = [
  { n: 'town-smoke-dusk', e: -50.5, n_: -120, eye: 1.6, absY: 1.6, az: 205, pitch: -1.5, fov: 24, hour: 18.8, aspect: 16 / 9 },
  { n: 'town-smoke-dusk-rahmat', e: 380, n_: -60, eye: 1.6, az: 228, pitch: -4, fov: 40, hour: 18.8, aspect: 16 / 9 },
];
/** is world point p inside the camera's frame? */
export function inFrustum(c: Cam, eye: THREE.Vector3, p: THREE.Vector3): boolean {
  const dx = p.x - eye.x, dz = p.z - eye.z, dy = p.y - eye.y, az = ((Math.atan2(dx, -dz) * 180) / Math.PI + 341 + 720) % 360;
  let da = az - c.az; da = ((da + 540) % 360) - 180;
  const el = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI, vh = c.fov / 2, hh = (Math.atan(Math.tan((vh * Math.PI) / 180) * c.aspect) * 180) / Math.PI;
  return Math.abs(da) < hh && Math.abs(el - c.pitch) < vh;
}
/** directions over the sphere (Fibonacci), each with solid angle 4π / N */
export function sphereDirs(N: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) { const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * ga; out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  return out;
}
const DIRS = sphereDirs(128);
/** the fire's light on the walls and floor round it, as the camera sees it: Σ over the visible lit patches of ρ/π · dω · cos θ
 *  (candela toward the eye per candela of the fire; a Lambertian surface lit by a point source); `flameY` the light's height
 *  above the fire's base. Rays from the fire that clear the walls go to the sky (and the smoke) */
export function wallGlow(R: Raster, T: Terrain, eye: THREE.Vector3, f: THREE.Vector3, rho: number, flameY = 0.25, reach = 14): number {
  const o = new THREE.Vector3(f.x, f.y + flameY, f.z), dw = (4 * Math.PI) / DIRS.length, P = new THREE.Vector3(), nrm = new THREE.Vector3(), v = new THREE.Vector3();
  let J = 0; const st = R.c * 0.5;
  for (const d of DIRS) {
    let hit = 0; // 1 wall, 2 floor
    for (let s = st; s < reach; s += st) { const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if (Math.hypot(x - f.x, z - f.z) > 0.45 && rasterAt(R, x, z) > y) { hit = 1; P.set(o.x + d.x * (s - st), y - d.y * st, o.z + d.z * (s - st)); nrm.set(-d.x, 0, -d.z).normalize(); break; }
      const g = T.heightAt(x, z); if (y < g) { hit = 2; P.set(x, g + 0.05, z); nrm.set(0, 1, 0); break; } }
    if (!hit) continue;
    v.subVectors(eye, P); const L = v.length(); const cv = nrm.dot(v) / L; if (cv <= 0) continue;
    if (losClear(R, T, eye, P, 0.3)) J += (rho / Math.PI) * dw * cv;
  }
  return J;
}

/** a fire as the measurement needs it (fire.ts FireSource) */
export interface FireAt { pos: THREE.Vector3; kind: string; sched?: string; seed: number; group?: string }
export interface ViewStats { lit: number; inFrustum: number; dMin: number; dMed: number; dMax: number; flameSeen: number; flameSum: number; glowFires: number; glowSum: number; byKind: Record<string, { lit: number; seen: number }> }
/** what a camera sees of the lit fires: those in its frame, those whose flame is in its line of sight (any of three points up
 *  the flame), the flame light it gets (in units of one fire's candela, the three points' share), and their light on their
 *  walls and floors it sees (wallGlow, candela per candela of the fire) */
export function viewStats(R: Raster, T: Terrain, cam: Cam, eye: THREE.Vector3, fires: FireAt[], isLit: (i: number) => boolean, rho = 0.2, maxD = 3000): ViewStats {
  const out: ViewStats = { lit: 0, inFrustum: 0, dMin: 0, dMed: 0, dMax: 0, flameSeen: 0, flameSum: 0, glowFires: 0, glowSum: 0, byKind: {} }; const dist: number[] = [];
  fires.forEach((f, i) => { if (!isLit(i)) return; out.lit++; if (!inFrustum(cam, eye, f.pos) || eye.distanceTo(f.pos) > maxD) return; out.inFrustum++; dist.push(eye.distanceTo(f.pos));
    const k = `${f.kind}:${f.sched ?? '-'}`, bk = (out.byKind[k] ??= { lit: 0, seen: 0 }); bk.lit++;
    let v = 0; for (const dy of [0.05, 0.25, 0.45]) if (losClear(R, T, eye, new THREE.Vector3(f.pos.x, f.pos.y + dy, f.pos.z))) v++;
    if (v) { out.flameSeen++; bk.seen++; } out.flameSum += v / 3;
    const g = wallGlow(R, T, eye, f.pos, rho); out.glowSum += g; if (g > 0) out.glowFires++; });
  dist.sort((a, b) => a - b); if (dist.length) { out.dMin = dist[0]; out.dMed = dist[dist.length >> 1]; out.dMax = dist[dist.length - 1]; }
  return out;
}
/** the share of the sphere (sr) of a fire's light that meets no wall, roof or floor within `reach` m: what leaves its court */
export function escapeSr(R: Raster, T: Terrain, f: THREE.Vector3, flameY = 0.25, reach = 14): number {
  const o = new THREE.Vector3(f.x, f.y + flameY, f.z), st = R.c * 0.5; let n = 0;
  for (const d of DIRS) { let hit = false;
    for (let s = st; s < reach && !hit; s += st) { const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if ((Math.hypot(x - f.x, z - f.z) > 0.45 && rasterAt(R, x, z) > y) || y < T.heightAt(x, z)) hit = true; }
    if (!hit) n++; }
  return (4 * Math.PI * n) / DIRS.length;
}
/** the region (world x, z) holding the lit fires a camera frames, with a margin: the raster's clip */
export function frameClip(cam: Cam, eye: THREE.Vector3, fires: FireAt[], margin = 60, maxD = 3000) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const f of fires) if (inFrustum(cam, eye, f.pos) && eye.distanceTo(f.pos) <= maxD) { x0 = Math.min(x0, f.pos.x); x1 = Math.max(x1, f.pos.x); z0 = Math.min(z0, f.pos.z); z1 = Math.max(z1, f.pos.z); }
  x0 = Math.min(x0, eye.x); x1 = Math.max(x1, eye.x); z0 = Math.min(z0, eye.z); z1 = Math.max(z1, eye.z);
  return { x0: x0 - margin, x1: x1 + margin, z0: z0 - margin, z1: z1 + margin };
}
