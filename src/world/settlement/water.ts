// Water, roads and the canal of the settlement (Phase 6). Earth roads (settlement.json, 6-8 m, courses C) and the
// Kuh-e Rahmat canal (2 m wide, C course) are ribbons draped on the terrain (heightAt samples, lifted a few centimetres
// and depth-offset); garden channels, pools, ditches and well water are flat water surfaces. Roads are cut into ~1 km
// pieces that hide beyond 6 km (they are sub-pixel there). One water mesh for everything.
import * as THREE from 'three/webgpu';
import { positionWorld, mx_noise_float, vec3, float, time } from 'three/tsl';
import { surfaceMaterial } from '../../render/materials';
import type { TownPlan } from './plan';
import type { P2 } from './site';
import { ROWS, FEATURES } from './plan';

const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** resample a polyline every `step` metres */
export function resample(pts: P2[], step: number): P2[] {
  const out: P2[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push(lerp2(pts[i], pts[i + 1], k / n)); }
  return out;
}
/** a ribbon of width w along pts, draped: y = ground + lift; returns position/normal/index arrays */
function ribbon(pts: P2[], w: number, H: (e: number, n: number) => number, lift: number, off = 0, dropEdge = 0) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // left normal (grid)
    for (const s of [-1, 1]) { const e = pts[i][0] + nx * (off + s * w / 2), n = pts[i][1] + ny * (off + s * w / 2); pos.push(e, H(e, n) + lift - dropEdge, -n); nor.push(0, 1, 0); }
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  return { pos, nor, idx };
}
function geo(parts: { pos: number[]; nor: number[]; idx: number[] }[]) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const p of parts) { const o = pos.length / 3; pos.push(...p.pos); nor.push(...p.nor); for (const i of p.idx) idx.push(i + o); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.computeVertexNormals(); return g;
}

export function waterMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.08, metalness: 0 });
  // still water: dark, faintly green-brown; a slow noise in the roughness stands in for wind ripples (C)
  const p = positionWorld, r = mx_noise_float(vec3(p.x.mul(1.5), p.z.mul(1.5), time.mul(0.3))).mul(0.5).add(0.5);
  m.colorNode = vec3(0.045, 0.065, 0.06); m.roughnessNode = float(0.05).add(r.mul(0.12));
  m.userData = { tier: 'C', note: 'still water (garden channels, pools, wells, canal), C' };
  return m;
}

export function buildWaterAndRoads(plan: TownPlan, H: (e: number, n: number) => number) {
  const group = new THREE.Group(); group.name = 'settlement:water_roads'; let tris = 0, meshes = 0;
  // water
  const wparts: { pos: number[]; nor: number[]; idx: number[] }[] = [];
  for (const w of plan.water) {
    if (w.kind === 'well') { const [e, n] = w.pts[0], y = H(e, n) + 0.04, r = 0.55, pos: number[] = [e, y, -n], nor: number[] = [0, 1, 0], idx: number[] = [];
      for (let s = 0; s <= 10; s++) { const a = (s / 10) * Math.PI * 2; pos.push(e + Math.cos(a) * r, y, -n + Math.sin(a) * r); nor.push(0, 1, 0); if (s > 0) idx.push(0, s + 1, s); }
      wparts.push({ pos, nor, idx }); continue; }
    const step = w.kind === 'canal' ? 8 : 3;
    wparts.push(ribbon(resample(w.pts, step), w.width, H, w.kind === 'canal' ? 0.12 : w.kind === 'ditch' ? 0.03 : 0.1));
  }
  const wg = geo(wparts); const wm = new THREE.Mesh(wg, waterMaterial()); wm.name = 'settlement:water'; wm.receiveShadow = true; wm.matrixAutoUpdate = false;
  wm.userData = { tier: 'C', src: 'MAYS2010;PW2017;RECON', note: 'water: Kuh-e Rahmat canal (C course), garden channels and pools (Pasargadae analogy B, C here), Area C ditches (PW2017 B), wells (C)' };
  group.add(wm); tris += (wg.index!.count / 3); meshes++;
  // canal banks: dug earth thrown up either side (C: 1.2 m wide, 0.45 m high)
  const cf = FEATURES.canal_kuh_e_rahmat; const cpts = resample(cf.polyline, 8); const bw = cf.width_m / 2 + 0.7;
  const banks = geo([ribbon(cpts, 1.2, H, 0.45, bw), ribbon(cpts, 1.2, H, 0.45, -bw), ribbon(cpts, 0.35, H, 0.25, bw + 0.75), ribbon(cpts, 0.35, H, 0.25, -bw - 0.75), ribbon(cpts, 0.35, H, 0.25, bw - 0.75), ribbon(cpts, 0.35, H, 0.25, -bw + 0.75)]);
  const bm = new THREE.Mesh(banks, surfaceMaterial('bank')); bm.name = 'settlement:canal_banks'; bm.receiveShadow = true; bm.castShadow = false; bm.matrixAutoUpdate = false;
  bm.userData = { tier: 'C', src: cf.src, note: 'Kuh-e Rahmat canal banks (course and section C; existence B)' }; group.add(bm); tris += banks.index!.count / 3; meshes++;
  // roads: one mesh for all of them (a single draw call, receive-only); samples every 8 m within 4 km, 40 m beyond
  const roadMat = surfaceMaterial('road'); (roadMat as any).polygonOffset = true; (roadMat as any).polygonOffsetFactor = -2; (roadMat as any).polygonOffsetUnits = -2;
  const rparts: { pos: number[]; nor: number[]; idx: number[] }[] = [];
  for (const r of plan.roads) {
    const all = resample(r.pts, 8), near = all.filter(p => Math.hypot(p[0], p[1]) <= 4000), farPts = all.filter((p, i) => Math.hypot(p[0], p[1]) > 4000 && i % 5 === 0);
    // keep the order along the road: split into runs of near / far samples
    let run: P2[] = [], runFar = false;
    const flush = () => { if (run.length > 1) rparts.push(ribbon(run, r.width, H, runFar ? 0.4 : 0.06)); };
    all.forEach((p, i) => { const far = Math.hypot(p[0], p[1]) > 4000; if (far && i % 5 !== 0 && i !== all.length - 1) return; if (far !== runFar && run.length) { run.push(p); flush(); run = [p]; runFar = far; return; } runFar = far; run.push(p); });
    flush(); void near; void farPts;
  }
  const rg = geo(rparts); const rm = new THREE.Mesh(rg, roadMat); rm.name = 'settlement:roads'; rm.receiveShadow = true; rm.matrixAutoUpdate = false;
  rm.userData = { tier: 'C', src: 'LIVIUS-TR;PLEIADES-FARS;ROYALROAD-GIS;SUMNER1986;RECON', note: 'earth roads 6-8 m (settlement.json): to Naqsh-e Rustam, to Pasargadae up the Pulvar, the royal road W toward Susa, S to Tirazziš; courses C (Q-054); spur to the Tol-e Ajori gate C' };
  group.add(rm); tris += rg.index!.count / 3; meshes++;
  const update = (_cam: THREE.Vector3) => {};
  return { group, tris, meshes, update };
}
