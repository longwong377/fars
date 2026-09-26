// Breath visible in the cold (session 9; WORLD_INVENTORY G5, A physics): below about 6 C, and more in damp air, each exhaled
// breath condenses into a small cloud that forms in front of the mouth, spreads and drifts and is gone in about a second. Drawn
// for the people near the listener (within BREATH_R, facing the way the crowd draws them) and for the walker's own breath in
// front of the eye. Each person breathes on their own rhythm (3-4.5 s, from their key); a walker's breath quickens (C). One
// InstancedMesh of camera-facing soft cards lit like the dust (D-220), white (water droplets scatter all colours alike).
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { uniform, uv, vec3, length, smoothstep, mx_noise_float, attribute, float, positionWorld, cameraPosition, normalize, dot, pow } from 'three/tsl';
import { smokeSkyRadiance, type SmokeSky } from './fire';

export const BREATH_R = 12, BREATH_MAX = 64;
/** how visible breath is (0-1): nothing above 6 C, full by -2 C; damp air shows it more (C) */
export const breathVisibility = (tempC: number, rh: number) => Math.min(1, Math.max(0, (6 - tempC) / 8)) * Math.min(1, Math.max(0.5, rh / 60));
const hash = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
/** a breath's cloud at `age` s after the exhale starts (life ~1.3 s): its distance from the mouth, size and opacity */
export function puff(age: number): { out: number; size: number; alpha: number } | null {
  if (age < 0 || age > 1.3) return null;
  const k = age / 1.3; return { out: 0.08 + 0.3 * Math.sqrt(k), size: 0.06 + 0.32 * Math.sqrt(k), alpha: Math.min(1, age / 0.12) * (1 - k) * (1 - k) };
}
/** the phase of someone's breathing at t: the age of their current exhale (or null between breaths) */
export function breathAge(key: string, t: number, moving: boolean): number | null {
  const h = hash(key), P = (moving ? 2.4 : 3.2) + (h % 1000) / 1000 * 1.3, ph = ((h >>> 10) % 1000) / 1000 * P, a = ((t + ph) % P);
  return a <= 1.3 ? a : null;
}

export class BreathFx {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh; private alpha: THREE.InstancedBufferAttribute;
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  readonly stats = { puffs: 0, visibility: 0 };
  constructor() {
    this.group.name = 'breath';
    const g = new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(BREATH_MAX), 1); g.setAttribute('aAlpha', this.alpha);
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const u = uv(), r = length(u.sub(0.5)).mul(2), soft = smoothstep(0.05, 1.0, r).oneMinus().mul(mx_noise_float(vec3(u.mul(3), attribute('aAlpha', 'float').mul(31))).mul(0.35).add(0.65));
    const G = 0.6, cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir), hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    m.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(0.95); m.opacityNode = soft.mul(attribute('aAlpha', 'float'));
    m.forceSinglePass = true;
    this.mesh = new THREE.InstancedMesh(g, m, BREATH_MAX); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 5; this.mesh.name = 'breath:puffs';
    this.mesh.userData = { tier: 'A', src: 'RECON', note: 'breath condensing in cold air (A: physics; thresholds and rhythm C)' };
    this.group.add(this.mesh);
  }
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  /** t: seconds; people near the listener (world feet position, yaw, whether they walk); the walker (eye position, view
   *  direction, moving); the air */
  update(t: number, camera: THREE.Camera, people: readonly { key: string; x: number; y: number; z: number; yaw?: number; age: number; moving?: boolean }[], self: { moving: boolean } | null, air: { tempC: number; rh: number }) {
    const vis = breathVisibility(air.tempC, air.rh); this.stats.visibility = +vis.toFixed(2); let k = 0;
    if (vis > 0.02) {
      const m4 = new THREE.Matrix4(), q = camera.quaternion, v = new THREE.Vector3(), s = new THREE.Vector3(), cp = camera.position;
      const put = (x: number, y: number, z: number, fx: number, fz: number, age: number) => { const P = puff(age); if (!P || k >= BREATH_MAX) return;
        v.set(x + fx * P.out, y + 0.1 * age, z + fz * P.out); m4.compose(v, q, s.set(P.size, P.size, P.size)); this.mesh.setMatrixAt(k, m4); this.alpha.array[k] = 0.35 * vis * P.alpha; k++; };
      for (const p of people) { if (Math.hypot(p.x - cp.x, p.z - cp.z) > BREATH_R) continue; const age = breathAge(p.key, t, !!p.moving); if (age == null) continue;
        const yaw = p.yaw ?? 0, fx = Math.sin(yaw), fz = Math.cos(yaw), mouth = p.age < 12 ? 1.0 : 1.52; put(p.x + fx * 0.12, p.y + mouth, p.z + fz * 0.12, fx, fz, age); }
      if (self) { const age = breathAge('self', t, self.moving); if (age != null) { const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); put(cp.x + d.x * 0.25, cp.y - 0.12, cp.z + d.z * 0.25, d.x, d.z, age); } }
    }
    this.mesh.count = k; this.mesh.visible = k > 0; if (k) { this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true; }
    this.stats.puffs = k;
  }
}
