// Ground vegetation by the water (Phase 7 look, D-149; all placement and form C). Reed beds on the river margins, rushes
// at the wet edge, grass on the upper banks and the corridor's apron, and rushes and grass along the canals, as instanced
// tufts of blades around the camera (one draw call). Species and their standing (plain.json river_*.riparian.margins):
// common reed and rushes by analogy with the wetlands and plateau rivers of Iran today and the Sparganium/Typha-type
// pollen of the Maharlou basin (B for those; C for the Pulvar in 467). Height and colour follow the date in the vertex
// shader (seasonal.ts marginState): in mid-April pale dry culms of last year stand over half a metre of new green shoots;
// in late summer the reeds are 2.5 m tall and plumed and the bank grass is straw. Tufts stand on the corridor mesh as
// drawn (rivers.ts profiles) and on the canal banks' profile (ribbons.ts). They shrink to nothing toward the layer's
// radius, so none pops in, and cast no shadows (receive only).
import * as THREE from 'three/webgpu';
import { attribute, uniform, cameraPosition, cameraViewMatrix, vec3, vec4, float, mix, smoothstep, length, sin, cos, time, clamp, max, step, normalize, fract } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import type { CorridorSection } from './rivers';
import type { Canal } from './canals';
import { feature, tag } from './data';
import { marginState, type MarginState } from './seasonal';
import { hash2, unit, cellU } from './fields';

export const KIND = { reed: 0, rush: 1, grass: 2 } as const;
const BLADES = 14;
/** a tuft of 14 blades (one triangle each, drawn double-sided); per vertex: blade index, 0 base / 1 tip, class (0/1:
 *  for reeds, last year's culm / a new shoot), a random number */
function tuftGeometry() {
  const pos: number[] = [], bl: number[] = [];
  for (let i = 0; i < BLADES; i++) { const r = ((i * 0.6180339) % 1);
    for (const [x, tip] of [[-1, 0], [1, 0], [0, 1]]) { pos.push(x, tip, i); bl.push(i / (BLADES - 1), tip, i % 2, r); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('blade', new THREE.Float32BufferAttribute(bl, 4));
  return g;
}

export interface Margins { mesh: THREE.Mesh; update(cam: THREE.Vector3): boolean; setDay(doy: number): void; count(): number; state(): MarginState }
/** radius (m) of the layer and the (smaller) radius of its bank grass, by quality */
export const MARGIN_R: Record<string, { r: number; grass: number; cap: number }> = {
  test: { r: 45, grass: 26, cap: 5000 }, low: { r: 50, grass: 28, cap: 6000 }, medium: { r: 60, grass: 32, cap: 8000 }, high: { r: 70, grass: 38, cap: 11000 }, ultra: { r: 85, grass: 46, cap: 15000 },
};

export function riparianMargins(profiles: CorridorSection[][], canals: Canal[], terrain: Terrain, quality: string, flood: [number, number]): Margins {
  const Q = MARGIN_R[quality] ?? MARGIN_R.high, R = Q.r, cap = Q.cap;
  const g0 = tuftGeometry(), g = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(g0.attributes)) g.setAttribute(k, a); g.instanceCount = 0;
  const posA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), varA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  g.setAttribute('ipos', posA); g.setAttribute('ivar', varA);
  // ---- the date (seasonal.ts marginState), as uniforms
  const U = { reedNew: uniform(0.5), reedGreen: uniform(1), reedOld: uniform(1), reedOldH: uniform(2.5), plume: uniform(0), rushH: uniform(0.7), rushGreen: uniform(1), grassH: uniform(0.4), grassGreen: uniform(1), wind: uniform(2) };
  let st = marginState(102);
  // ---- vertex shader: blade i of a tuft of kind k
  const P = attribute('position', 'vec3'), bl = attribute('blade', 'vec4'), ipos = attribute('ipos', 'vec3'), iv = attribute('ivar', 'vec4');
  const kind = iv.x, seed = iv.y, scale = iv.z, yaw = iv.w;
  const isReed = float(1).sub(step(0.5, kind)), isRush = step(0.5, kind).mul(float(1).sub(step(1.5, kind))), isGrass = step(1.5, kind);
  const rnd = (k: number) => fract(sin(bl.x.mul(91.7).add(seed.mul(47.3)).add(k * 13.7)).mul(43758.5453));
  const old = bl.z.mul(isReed); // reeds: even blades are last year's culms
  const tuftR = isReed.mul(0.32).add(isRush.mul(0.1)).add(isGrass.mul(0.22));
  const standing = step(rnd(1), U.reedOld); // last year's culms go down as the new ones overtop them
  const hBlade = isReed.mul(mix(U.reedNew, U.reedOldH.mul(standing), old)).add(isRush.mul(U.rushH)).add(isGrass.mul(U.grassH)).mul(rnd(2).mul(0.4).add(0.65)).mul(scale);
  const wBlade = isReed.mul(0.03).add(isRush.mul(0.012)).add(isGrass.mul(0.018)).mul(scale);
  const lean = isReed.mul(0.07).add(isRush.mul(0.12)).add(isGrass.mul(0.42)).mul(rnd(3).mul(0.9).add(0.45));
  // nothing pops in: tufts grow from nothing toward their radius (bank grass is placed only within Q.grass)
  const fadeR = mix(float(R), float(Q.grass), isGrass), d = length(ipos.xz.sub(cameraPosition.xz)), fade = float(1).sub(smoothstep(fadeR.mul(0.72), fadeR, d));
  // blades narrower than a pixel alias into speckle (the reed beds at 30-70 m, the grass past ~7 m): once a blade spans
  // less than ~1.2 px, the blades that remain widen and the others fold away, keeping the tuft's projected area
  // (coverage-preserving level of detail). The rank is the blade's golden-ratio number, so the kept ones stay spread round the tuft
  const pxA = uniform(0.0023); // radians per pixel (set before each draw from the camera and the drawing buffer)
  const wf = max(float(1), length(ipos.sub(cameraPosition)).mul(pxA).mul(1.2).div(max(wBlade, 1e-4))), keep = step(bl.w, float(1).div(wf));
  const a = bl.x.mul(BLADES * 2.39996).add(yaw).add(rnd(6).mul(1.2)), rr = tuftR.mul(rnd(4).mul(0.85).add(0.15));
  const dir = vec3(cos(a), 0, sin(a)), across = vec3(sin(a).negate(), 0, cos(a));
  const base = dir.mul(rr).add(across.mul(P.x.mul(wBlade).mul(wf).mul(0.5)));
  const sway = sin(time.mul(1.9).add(seed.mul(6.28)).add(bl.x.mul(3))).mul(U.wind).mul(0.012);
  const tip = dir.mul(rr.add(lean.mul(hBlade))).add(vec3(sway, hBlade, sway.mul(0.6)));
  const local = mix(base, tip, P.y).mul(fade).mul(keep);
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  m.positionNode = ipos.add(local);
  // lit like a stand of blades (mostly up), not like flat cards
  m.normalNode = normalize(cameraViewMatrix.mul(vec4(normalize(dir.mul(0.45).add(vec3(0, 1, 0))), 0)).xyz);
  // colour: straw culms with dark plumes; green new shoots browning in autumn; rushes dark green with brown tips; grass
  // green to straw; each blade a little different, tips lighter
  const lin = (r: number, g: number, b: number) => vec3(...(new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace).toArray() as [number, number, number]));
  const straw = lin(0.63, 0.57, 0.43), plumeC = lin(0.33, 0.27, 0.25), green = lin(0.27, 0.39, 0.12), brown = lin(0.46, 0.37, 0.24);
  const newC = mix(brown, green, U.reedGreen), top = smoothstep(0.84, 0.95, P.y);
  const reedC = mix(mix(newC, mix(newC, plumeC, U.plume), top), mix(straw, plumeC, top.mul(0.8)), old);
  const rushC = mix(lin(0.17, 0.28, 0.1), lin(0.45, 0.38, 0.22), smoothstep(0.7, 1, P.y).mul(float(1).sub(U.rushGreen)));
  // bank grass: green to straw with the season; about a sixth of the blades are last year's, dry, all year (C)
  const grassC = mix(lin(0.6, 0.53, 0.34), mix(lin(0.25, 0.37, 0.12), lin(0.33, 0.42, 0.13), rnd(8)), U.grassGreen.mul(step(0.16, rnd(7))));
  const col = reedC.mul(isReed).add(rushC.mul(isRush)).add(grassC.mul(isGrass));
  m.colorNode = col.mul(rnd(5).mul(0.24).add(0.88)).mul(P.y.mul(0.35).add(0.72));
  m.roughnessNode = float(0.8);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'plain-margins'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  const buf = new THREE.Vector2();
  mesh.onBeforeRender = (renderer: any, _s: any, camera: any) => { if (!camera?.isPerspectiveCamera) return; renderer.getDrawingBufferSize(buf);
    pxA.value = 2 * Math.tan((camera.fov * Math.PI) / 360) / Math.max(1, camera.zoom * buf.y); };
  const rip = feature('river_pulvar').riparian;
  mesh.userData = tag({ tier: 'C', src: rip.margins?.src ?? rip.src, note: '' }, `river margins and canal edges: ${rip.margins?.note ?? 'reeds, rushes and bank grass (C)'}`);

  // ---- placement around the camera
  const cell = 120, idx = new Map<number, [number, number][]>(), key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
  profiles.forEach((prof, ri) => prof.forEach((q, i) => { const k = key(Math.floor(q.x / cell), Math.floor(q.y / cell)); let l = idx.get(k); if (!l) idx.set(k, l = []); l.push([ri, i]); }));
  /** height (world y) and height above the bed of a section's surface at signed lateral offset u (the drawn profile) */
  const prof = (q: CorridorSection, u: number): [number, number, number] => {
    const ks = u < 0 ? [0, 1, 2, 3, 4, 5, 6] : [0, 7, 8, 9, 10, 11, 12], au = Math.abs(u);
    for (let j = 1; j < ks.length; j++) { const a0 = Math.abs(q.off[ks[j - 1]]), a1 = Math.abs(q.off[ks[j]]);
      if (au <= a1 || j === ks.length - 1) { const f = a1 > a0 ? Math.min(1, Math.max(0, (au - a0) / (a1 - a0))) : 0;
        return [q.hy[ks[j - 1]] + (q.hy[ks[j]] - q.hy[ks[j - 1]]) * f, q.hrel[ks[j - 1]] + (q.hrel[ks[j]] - q.hrel[ks[j - 1]]) * f, q.t[ks[j - 1]] + (q.t[ks[j]] - q.t[ks[j - 1]]) * f]; } }
    return [q.hy[0], 0, 0];
  };
  let n = 0, last = new THREE.Vector3(1e9, 0, 1e9);
  const put = (x: number, y: number, z: number, k: number, h: number) => {
    if (n >= cap) return; posA.setXYZ(n, x, y, z); varA.setXYZW(n, k, unit(h), 0.8 + 0.4 * unit(hash2(h, 7, 3)), unit(hash2(h, 9, 5)) * 6.283); n++; };
  const update = (cam: THREE.Vector3) => {
    if (Math.hypot(cam.x - last.x, cam.z - last.z) < R * 0.1) return false;
    last = cam.clone(); n = 0;
    const cx = cam.x, cy = -cam.z, near: [number, number, number][] = [];
    for (let i = Math.floor((cx - R - 40) / cell); i <= Math.floor((cx + R + 40) / cell); i++) for (let j = Math.floor((cy - R - 40) / cell); j <= Math.floor((cy + R + 40) / cell); j++) {
      for (const [ri, si] of idx.get(key(i, j)) ?? []) { const q = profiles[ri][si]; const dd = Math.hypot(q.x - cx, q.y - cy); if (dd < R + 40) near.push([dd, ri, si]); } }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, ri, si] of near) {
      const q0 = profiles[ri][si], q1 = profiles[ri][si + 1]; if (!q1) continue;
      const L = Math.hypot(q1.x - q0.x, q1.y - q0.y), aprilD = flood[ri] ?? 1.2;
      // a 0.42 x 0.45 m grid; beyond 22 m of the camera 57 % of its points (a 0.55 x 0.6 m density): denser near
      for (let along = 0; along < L; along += 0.42) {
        const f = along / L, sx = q0.x + (q1.x - q0.x) * f, sy = q0.y + (q1.y - q0.y) * f, s = q0.s + along;
        if (Math.hypot(sx - cx, sy - cy) > R + 30) continue;
        const nx = q0.nx + (q1.nx - q0.nx) * f, ny = q0.ny + (q1.ny - q0.ny) * f;
        // reed beds along the margins: patches ~25-90 m long, about half the bank (C); fords and grazed banks between
        const bedA = unit(hash2(cellU(s / 60), ri * 2 + 1, 211)) * 0.65 + unit(hash2(cellU(s / 17), ri * 2 + 1, 212)) * 0.35;
        const bedB = unit(hash2(cellU(s / 60), ri * 2 + 2, 211)) * 0.65 + unit(hash2(cellU(s / 17), ri * 2 + 2, 212)) * 0.35;
        const maxU = Math.abs(q0.off[12]);
        for (let u = -maxU; u <= maxU; u += 0.45) {
          const x = sx + nx * u, y = sy + ny * u, dc = Math.hypot(x - cx, y - cy); if (dc > R) continue;
          const h = hash2(cellU(x / 0.3), cellU(y / 0.3), 213 + ri), r1 = unit(h);
          if (dc >= 22 && unit(hash2(h, 5, 6)) > 0.573) continue;
          const p0 = prof(q0, u), p1 = prof(q1, u), hy = p0[0] + (p1[0] - p0[0]) * f, hrel = p0[1] + (p1[1] - p0[1]) * f, t = p0[2] + (p1[2] - p0[2]) * f;
          const inBed = (u < 0 ? bedA : bedB) > 0.52;
          const jx = (unit(hash2(h, 1, 2)) - 0.5) * 0.5, jy = (unit(hash2(h, 3, 4)) - 0.5) * 0.5;
          if (hrel > 0.18 && hrel < aprilD - 0.05 && t === 0) { // the channel slope between the low summer water and the spring flood level
            if (inBed && r1 < 0.8) put(x + jx, hy, -(y + jy), KIND.reed, h);
            else if (r1 < 0.12) put(x + jx, hy, -(y + jy), KIND.rush, h);
          } else if (hrel >= aprilD - 0.05 && t < 0.75 && dc < Q.grass) { // the upper bank, the bank top and the apron: grass, rushes near the flood line
            const nearFlood = hrel < aprilD + 0.35;
            if (nearFlood && r1 < 0.18) put(x + jx, hy, -(y + jy), KIND.rush, h);
            else if (r1 < 0.62 * (1 - t * 0.6)) put(x + jx, hy + 0.01, -(y + jy), KIND.grass, h);
          }
        }
      }
    }
    // canals: rushes at the wet edge, grass on the spoil banks (irrigation_systems_sumner rule profile, ribbons.ts)
    const crest = feature('irrigation_systems_sumner').procedural_rule.bank_crest_m as number;
    for (const c of canals) {
      const w = c.width / 2;
      for (let i = 1; i < c.pts.length; i++) {
        const [ax, ay] = c.pts[i - 1], [bx, by] = c.pts[i]; if (Math.min(Math.hypot(ax - cx, ay - cy), Math.hypot(bx - cx, by - cy)) > R + 30) continue;
        const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
        for (let along = 0; along < L; along += 0.6) { const sx = ax + (bx - ax) * along / L, sy = ay + (by - ay) * along / L, g0 = terrain.heightAt(sx, -sy);
          for (const side of [-1, 1]) for (let du = -0.15; du <= 2.2; du += 0.5) {
            const u = side * (w + du), x = sx + nx * u, y = sy + ny * u, dc = Math.hypot(x - cx, y - cy); if (dc > R) continue;
            const h = hash2(cellU(x / 0.3), cellU(y / 0.3), 231), r1 = unit(h);
            const bank = du < 0 ? 0.02 : du < 0.7 ? 0.02 + (crest - 0.02) * du / 0.7 : crest + (0.03 - crest) * (du - 0.7) / 1.5; // the ribbon's profile
            const gy = Math.abs(u) < 1.5 ? g0 : terrain.heightAt(x, -y);
            if (du < 0.35) { if (r1 < 0.35) put(x, gy + bank, -y, KIND.rush, h); }
            else if (dc < Q.grass && r1 < 0.5) put(x, gy + bank + 0.01, -y, KIND.grass, h);
          } }
      }
    }
    g.instanceCount = n; posA.needsUpdate = varA.needsUpdate = true;
    return true;
  };
  const setDay = (doy: number) => { st = marginState(doy); for (const k of Object.keys(st) as (keyof MarginState)[]) (U as any)[k].value = st[k]; };
  setDay(102);
  return { mesh, update, setDay, count: () => n, state: () => st, wind: U.wind } as Margins & { wind: any };
}
void clamp; void max;
