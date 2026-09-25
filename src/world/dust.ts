// Dust raised by work and feet (brief §5.4 "dust on feet and hems", §5.2 "wind in … dust and smoke"; rubric s7 pass 2 fix 5;
// D-220): the masons dressing stone at the Hall of a Hundred Columns (limestone dust off the chisel), the gangs hauling
// drums on sledges, and the people, pack animals, carts and flocks walking on dry earth. Nothing on the Terrace's paving
// or in the roofed halls (their floors are stone or plaster), a little on the Terrace's courts, none on wet ground or snow
// or in rain (the weather's surface wetness, weatherState.ts). Each emitter gets a few soft puffs on a cycle closed-form
// in time — a walker's lie where the walker was `age` seconds ago — so frozen test renders show them. One draw call (a pool
// of DUST_MAX camera-facing puffs, the nearest emitters first). Optical depths, sizes and lives C (no measurement of
// ancient work dust; by eye from dry-soil work and flocks on unpaved tracks).
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { uniform, uv, vec3, length, smoothstep, mx_noise_float, attribute, float, positionWorld, cameraPosition, normalize, dot, pow } from 'three/tsl';
import { smokeSkyRadiance, type SmokeSky, type RoomBox } from './fire';
import { windWorld } from './hearthSmoke';

export type DustKind = 'walk' | 'animal' | 'flock' | 'cart' | 'mason' | 'haul';
/** per kind (all C): puffs per emitter, life (s), optical depth through a fresh puff, its size (m) and growth (m/s), rise (m/s),
 *  the height it starts at (m), its offset ahead of the emitter (m: the block in front of a mason, the drum's sledge ahead of
 *  the gang) and whether it trails behind a moving emitter (walkers, animals, carts) or stays at a working one */
export const DUST: Record<DustKind, { k: number; life: number; tau: number; size0: number; grow: number; rise: number; y0: number; ahead: number; trail: boolean; stone: boolean }> = {
  walk: { k: 2, life: 3, tau: 0.05, size0: 0.3, grow: 0.3, rise: 0.08, y0: 0.12, ahead: 0, trail: true, stone: false },
  animal: { k: 2, life: 3.5, tau: 0.07, size0: 0.4, grow: 0.35, rise: 0.1, y0: 0.15, ahead: 0, trail: true, stone: false },
  flock: { k: 1, life: 4, tau: 0.08, size0: 0.5, grow: 0.4, rise: 0.12, y0: 0.15, ahead: 0, trail: true, stone: false },
  cart: { k: 3, life: 4, tau: 0.1, size0: 0.6, grow: 0.45, rise: 0.12, y0: 0.2, ahead: 0, trail: true, stone: false },
  // limestone dust off the point and the claw chisel, a puff at each blow drifting off the block (C)
  mason: { k: 3, life: 2.5, tau: 0.09, size0: 0.25, grow: 0.3, rise: 0.15, y0: 0.9, ahead: 0.8, trail: false, stone: true },
  haul: { k: 4, life: 3.5, tau: 0.12, size0: 0.6, grow: 0.45, rise: 0.1, y0: 0.2, ahead: 6.2, trail: false, stone: false },
};
/** emitters farther than this from the eye raise no drawn dust (a walker's puff is under a pixel beyond) */
export const DUST_R = 220, DUST_MAX = 640;
/** how much dust dry ground gives up now: 1 on dry earth, falling to 0 as the surface's wetness reaches 0.25; none in rain or
 *  on snow (C). Stone dust off the chisel flies whatever the ground, but not in rain */
export function dryFactor(c: { wetness: number; snowCover: number; rain: number }, stone = false): number {
  if (c.rain > 0.05) return 0; if (stone) return 1;
  if (c.snowCover > 0.05) return 0; return Math.max(0, 1 - c.wetness / 0.25);
}
/** the ground under an emitter at world y (the Terrace's floor is at y ≈ 0, the plain 12-20 m below): earth off the Terrace
 *  (1), the Terrace's courts of trodden fill (0.3, D-188), nothing in a roofed hall (C) */
export function groundFactor(x: number, y: number, z: number, rooms: RoomBox[] = []): number {
  if (y < -1) return 1;
  for (const r of rooms) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && y > r.y0 - 0.5 && y < r.y1) return 0;
  return 0.3;
}
/** one dust puff of an emitter at world time t (offsets in the emitter's frame turned to the world, m) */
export function dustPuff(kind: DustKind, seed: number, j: number, t: number, fwd: [number, number], speed: number, wind: [number, number, number], out: { x: number; y: number; z: number; size: number; alpha: number }) {
  const D = DUST[kind], cyc = t / D.life + j / D.k + seed * 0.618, ph = cyc - Math.floor(cyc), age = ph * D.life, n = Math.floor(cyc);
  const hsh = (a: number) => { const v = Math.sin(seed * 12.9898 + j * 78.233 + n * 37.719 + a * 4.581) * 43758.5453; return v - Math.floor(v); };
  const back = D.trail ? speed * age : 0, side = (hsh(1) - 0.5) * (D.trail ? 0.6 : 0.5), along = D.ahead + (D.trail ? 0 : (hsh(2) - 0.5) * 0.4) - back;
  out.x = fwd[0] * along + fwd[1] * side + wind[0] * 0.8 * age; out.z = fwd[1] * along - fwd[0] * side + wind[2] * 0.8 * age;
  out.y = D.y0 + D.rise * age; out.size = D.size0 + D.grow * age;
  // optical depth through the puff diluted as it grows (the fresh puff's size over its size now), faded in and out (C)
  out.alpha = (1 - Math.exp(-D.tau * (D.size0 / out.size))) * Math.min(1, age * 3) * (1 - ph);
  return out;
}
interface Emitter { kind: DustKind; x: number; y: number; z: number; fx: number; fz: number; speed: number; seed: number; d2: number }
export class DustSystem {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh; private alpha: THREE.InstancedBufferAttribute;
  private em: Emitter[] = []; private eye = new THREE.Vector3();
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  rooms: RoomBox[] = [];
  /** last frame: emitters taken, puffs drawn, and the dry factor */
  readonly stats = { emitters: 0, puffs: 0, dry: 0, byKind: {} as Record<string, number> };
  constructor() {
    this.group.name = 'dust';
    const g = new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(DUST_MAX), 1); g.setAttribute('aAlpha', this.alpha);
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const u = uv(), r = length(u.sub(0.5)).mul(2), soft = smoothstep(0.1, 1.0, r).oneMinus().mul(mx_noise_float(vec3(u.mul(3.2), attribute('aAlpha', 'float').mul(40))).mul(0.3).add(0.7));
    // mineral dust scatters more and more forward than smoke, tinted by the loess it is made of (C)
    const OMEGA = 0.95, G = 0.5, TINT = [0.95, 0.85, 0.7];
    const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir), hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    m.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(vec3(TINT[0] * OMEGA, TINT[1] * OMEGA, TINT[2] * OMEGA)); m.opacityNode = soft.mul(attribute('aAlpha', 'float'));
    m.forceSinglePass = true; // a camera-facing card: one pass (three draws a double-sided transparent twice)
    this.mesh = new THREE.InstancedMesh(g, m, DUST_MAX); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 4; this.mesh.name = 'dust:puffs';
    this.mesh.userData = { tier: 'C', src: 'RECON;PEOPLE-SIM', note: 'dust (D-220): off the masons\' chisels at the Hall of a Hundred Columns and the hauling gangs\' sledges, and behind people, pack animals, carts and flocks walking on dry earth (none on paving, in the halls, on wet ground, snow or in rain: the weather\'s surface wetness); who works and walks is the people sim\'s; amounts, sizes and lives C' };
    this.group.add(this.mesh);
  }
  /** start a frame's emitters (the crowd and the working animals call emit() while they are drawn) */
  begin(eye: THREE.Vector3) { this.em.length = 0; this.eye.copy(eye); }
  /** an emitter: world position, the direction it faces (yaw, three's convention: forward = (sin yaw, cos yaw) in world x, z),
   *  its speed (m/s) and a stable seed */
  emit(kind: DustKind, x: number, y: number, z: number, yaw: number, speed: number, seed: number) {
    const dx = x - this.eye.x, dz = z - this.eye.z, d2 = dx * dx + dz * dz; if (d2 > DUST_R * DUST_R) return;
    this.em.push({ kind, x, y, z, fx: Math.sin(yaw), fz: Math.cos(yaw), speed, seed, d2 });
  }
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  /** build the puffs of this frame's emitters at world time t in the weather `cond` */
  update(t: number, camera: THREE.Camera, cond: { wetness: number; snowCover: number; rain: number; windMs: number; windDirDeg: number }) {
    const dry = dryFactor(cond), stone = dryFactor(cond, true), wind = windWorld(cond.windDirDeg, cond.windMs);
    this.em.sort((a, b) => a.d2 - b.d2);
    const m4 = new THREE.Matrix4(), q = camera.quaternion, v = new THREE.Vector3(), s = new THREE.Vector3(), P = { x: 0, y: 0, z: 0, size: 0, alpha: 0 };
    let k = 0, taken = 0; const by: Record<string, number> = {};
    for (const e of this.em) {
      const D = DUST[e.kind], f = (D.stone ? stone : dry * groundFactor(e.x, e.y, e.z, this.rooms)); if (f <= 0) continue;
      const K = e.d2 > 90 * 90 ? Math.max(1, D.k >> 1) : D.k; if (k + K > DUST_MAX) break; taken++; by[e.kind] = (by[e.kind] ?? 0) + 1;
      for (let j = 0; j < K; j++) {
        dustPuff(e.kind, e.seed, j, t, [e.fx, e.fz], e.speed, wind, P);
        v.set(e.x + P.x, e.y + P.y, e.z + P.z); m4.compose(v, q, s.set(P.size, P.size, P.size)); this.mesh.setMatrixAt(k, m4);
        this.alpha.array[k] = P.alpha * f; k++;
      }
    }
    this.mesh.count = k; this.mesh.visible = k > 0; this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true;
    this.stats.emitters = taken; this.stats.puffs = k; this.stats.dry = +dry.toFixed(2); this.stats.byKind = by;
  }
}
