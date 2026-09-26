// Dust devils on the summer plain (session 9; WORLD_INVENTORY G7, B): on hot, bright, light-wind afternoons the heated ground of
// the Marvdasht sends up whirling columns of dust that wander across the fields and fallow for a few minutes. Where and when is
// closed-form in (seed, world time): the plain within DEVIL_R of the viewer is cut into 1 km cells, each 90 s slot of a cell
// may start one devil (the chance scaled by today's heat), which then drifts with the wind (plus a wander) for its life,
// growing and fading. Only over open dry ground (the caller's `open` test: not the town, not water, not the slopes). Drawn as
// a leaning, twisting column of camera-facing dust cards lit like the dust of D-220 (one InstancedMesh, fogged with the
// scene). Heights 30-150 m, base 3-8 m wide spreading to 10-25 m at the top (C: the common size of desert dust devils).
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { uniform, uv, vec3, length, smoothstep, mx_noise_float, attribute, float, positionWorld, cameraPosition, normalize, dot, pow } from 'three/tsl';
import { smokeSkyRadiance, type SmokeSky } from './fire';

export const DEVIL_R = 6000, DEVIL_CELL = 1000, DEVIL_SLOT = 90, DEVIL_PUFFS = 26, DEVIL_MAX = 12;
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;

/** how favourable the afternoon is (0-1): May-September, 11:30-17:30, air over 28 C, little cloud, wind 1-7 m/s, dry ground (C) */
export function devilWeather(month: number, hour: number, tempC: number, cloud: number, windMs: number, wetness: number): number {
  if (month < 4 || month > 8 || hour < 11.5 || hour > 17.5 || wetness > 0.2) return 0;
  const heat = Math.min(1, Math.max(0, (tempC - 28) / 8)), sun = Math.max(0, 1 - cloud / 0.4), wind = windMs < 1 ? windMs : windMs <= 7 ? 1 : Math.max(0, 1 - (windMs - 7) / 3);
  const day = Math.sin(Math.PI * (hour - 11.5) / 6);
  return heat * sun * wind * day;
}
export interface Devil { key: number; e: number; n: number; age: number; life: number; h: number; base: number; top: number; spin: number; lean: [number, number] }
/** the devils alive at world time t (s) around the viewer (grid e, n); `wind` the drift (grid m/s); `open(e, n)` the ground test */
export function devilsAt(seed: number, t: number, viewer: [number, number], strength: number, wind: [number, number], open: (e: number, n: number) => boolean, out: Devil[] = []): Devil[] {
  out.length = 0; if (strength <= 0) return out;
  const i0 = Math.floor((viewer[0] - DEVIL_R) / DEVIL_CELL), i1 = Math.floor((viewer[0] + DEVIL_R) / DEVIL_CELL), j0 = Math.floor((viewer[1] - DEVIL_R) / DEVIL_CELL), j1 = Math.floor((viewer[1] + DEVIL_R) / DEVIL_CELL);
  const kNow = Math.floor(t / DEVIL_SLOT), back = Math.ceil(360 / DEVIL_SLOT);
  for (let ix = i0; ix <= i1; ix++) for (let iy = j0; iy <= j1; iy++) for (let k = kNow - back; k <= kNow; k++) {
    if (u01(seed, ix, iy, k, 1) >= 0.05 * strength) continue;
    const life = 120 + 240 * u01(seed, ix, iy, k, 2), t0 = k * DEVIL_SLOT + DEVIL_SLOT * u01(seed, ix, iy, k, 3), age = t - t0; if (age < 0 || age > life) continue;
    const e0 = (ix + u01(seed, ix, iy, k, 4)) * DEVIL_CELL, n0 = (iy + u01(seed, ix, iy, k, 5)) * DEVIL_CELL; if (!open(e0, n0)) continue;
    const wa = u01(seed, ix, iy, k, 6) * 6.283, e = e0 + wind[0] * age + 25 * Math.sin(age / 40 + wa), n = n0 + wind[1] * age + 25 * Math.cos(age / 53 + wa);
    if (Math.hypot(e - viewer[0], n - viewer[1]) > DEVIL_R) continue;
    const H = 30 + 120 * u01(seed, ix, iy, k, 7) ** 1.5;
    out.push({ key: h32(seed, ix, iy, k), e, n, age, life, h: H, base: 3 + 5 * u01(seed, ix, iy, k, 8), top: 10 + 15 * u01(seed, ix, iy, k, 9), spin: (u01(seed, ix, iy, k, 10) < 0.5 ? -1 : 1) * (1.5 + u01(seed, ix, iy, k, 11)), lean: [wind[0] * 3, wind[1] * 3] });
    if (out.length >= DEVIL_MAX) return out;
  }
  return out;
}
/** a devil's strength over its life: rising in the first 15 %, holding, dying away in the last 30 % */
export const devilEnvelope = (age: number, life: number) => Math.min(1, age / (0.15 * life), Math.max(0, (life - age) / (0.3 * life)));

export class DustDevils {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh; private alpha: THREE.InstancedBufferAttribute;
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  private list: Devil[] = [];
  readonly stats = { devils: 0, puffs: 0, strength: 0 };
  constructor(private seed: number) {
    this.group.name = 'dust-devils';
    const g = new THREE.PlaneGeometry(1, 1), n = DEVIL_MAX * DEVIL_PUFFS;
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); g.setAttribute('aAlpha', this.alpha);
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const u = uv(), r = length(u.sub(0.5)).mul(2), soft = smoothstep(0.15, 1.0, r).oneMinus().mul(mx_noise_float(vec3(u.mul(2.6), attribute('aAlpha', 'float').mul(97))).mul(0.4).add(0.6));
    const OMEGA = 0.95, G = 0.5, TINT = [0.95, 0.85, 0.7]; // as the dust of D-220 (C)
    const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir), hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    m.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(vec3(TINT[0] * OMEGA, TINT[1] * OMEGA, TINT[2] * OMEGA)); m.opacityNode = soft.mul(attribute('aAlpha', 'float'));
    m.forceSinglePass = true;
    this.mesh = new THREE.InstancedMesh(g, m, n); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 4; this.mesh.name = 'dust:devils';
    this.mesh.userData = { tier: 'B', src: 'RECON', note: 'dust devils over the dry summer plain on hot afternoons (B: a common sight of the Iranian plateau; sizes, numbers and timing C)' };
    this.group.add(this.mesh);
  }
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  /** t world seconds; the viewer's grid position; ground(e, n) world y; the day's weather; open(e, n): open dry ground */
  /** `wind`: the wind toward which the air moves (grid m/s, as the birds' drift in world.ts) */
  update(t: number, camera: THREE.Camera, viewer: [number, number], ground: (e: number, n: number) => number, w: { month: number; hour: number; tempC: number; cloud: number; windMs: number; wetness: number }, wind: [number, number], open: (e: number, n: number) => boolean) {
    const s = devilWeather(w.month, w.hour, w.tempC, w.cloud, w.windMs, w.wetness); this.stats.strength = +s.toFixed(2);
    const drift: [number, number] = [wind[0] * 0.6, wind[1] * 0.6]; // a devil moves at ~60 % of the surface wind (C)
    devilsAt(this.seed, t, viewer, s, drift, open, this.list);
    const m4 = new THREE.Matrix4(), q = camera.quaternion, v = new THREE.Vector3(), sc = new THREE.Vector3(); let k = 0;
    for (const d of this.list) { const env = devilEnvelope(d.age, d.life), y0 = ground(d.e, d.n);
      for (let j = 0; j < DEVIL_PUFFS; j++) { const f = j / (DEVIL_PUFFS - 1), y = f * d.h, r = d.base / 2 + (d.top - d.base) / 2 * f * f, ang = d.spin * t + j * 0.9 + (d.key % 97);
        const wob = 0.35 * r * Math.sin(ang); v.set(d.e + f * f * d.lean[0] + wob * Math.cos(ang), y0 + y, -(d.n + f * f * d.lean[1]) + wob * Math.sin(ang));
        const size = r * 2.2 + 2; m4.compose(v, q, sc.set(size, size * 0.9, size)); this.mesh.setMatrixAt(k, m4);
        this.alpha.array[k] = env * (0.28 - 0.18 * f) * (j === 0 ? 1.4 : 1); k++; } }
    this.mesh.count = k; this.mesh.visible = k > 0; if (k) { this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true; }
    this.stats.devils = this.list.length; this.stats.puffs = k;
  }
}
