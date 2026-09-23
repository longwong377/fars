// Smoke haze over the town (brief §1.1 "smoke rising from the town at dusk as lamps are lit", §5.4). The fire system
// draws puffs only near the camera (fire.ts SMOKE_RANGE); from a distance the town's hundreds of hearths read as a low
// haze. Each quarter carries a few large soft sheets whose opacity follows the share of its own hearths, ovens and kilns
// that are lit right now (the fire schedules), thicker in the still evening air, drifting with the wind. Deterministic
// in time (no accumulation), so frozen test renders show it. Density, height and colour are C.
import * as THREE from 'three/webgpu';
import { uniform, uv, vec3, length, smoothstep, mx_noise_float, attribute, time, float, positionWorld, cameraPosition, normalize, dot, pow } from 'three/tsl';
import type { TownPlan } from './plan';
import type { FireSystem, FireKind } from '../fire';
import { Rng } from '../../core/rng';

interface Puff { site: string; base: THREE.Vector3; size: number; h: number; ph: number }
export class TownHaze {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh; private alpha: THREE.InstancedBufferAttribute; private puffs: Puff[] = [];
  // light on the smoke (session 3, D-060): single scattering of the sky seen across the view (the calibrated horizon
  // radiance) and of the sun through a forward-peaked phase function; albedo ω (C). Before, a hand-set grey that did not
  // follow the sky and glowed against a calibrated dusk.
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  private siteFires = new Map<string, number[]>(); private lastFrac = new Map<string, number>();
  private maxA = 0;
  constructor(plan: TownPlan, H: (e: number, n: number) => number, private fire: FireSystem, _idx: { site: string; kind: FireKind }[]) {
    this.group.name = 'settlement:haze';
    for (const s of plan.sites) { if (s.meta.kind !== 'quarter' && s.id !== 'official' && s.id !== 'waystation') continue;
      const rng = new Rng(467, 'haze:' + s.id); const n = s.meta.kind === 'quarter' ? Math.max(3, Math.round(s.W * s.H / 9000)) : 2; const R = Math.min(s.W, s.H) * 0.35;
      for (let i = 0; i < n; i++) { const a = rng.range(0, 6.28), r = R * Math.sqrt(rng.next()); const e = s.frame.c[0] + Math.cos(a) * r, nn = s.frame.c[1] + Math.sin(a) * r;
        this.puffs.push({ site: s.id, base: new THREE.Vector3(e, H(e, nn), -nn), size: rng.range(0.6, 1.0) * Math.min(s.W, s.H) * 0.55, h: rng.range(9, 22), ph: rng.range(0, 100) }); } }
    const N = Math.max(1, this.puffs.length), g = new THREE.PlaneGeometry(1, 1);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); g.setAttribute('aAlpha', this.alpha);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const u = uv(), r = length(u.sub(0.5)).mul(2);
    const soft = smoothstep(0.15, 1.0, r).oneMinus();
    const nz = mx_noise_float(vec3(u.x.mul(2.5), u.y.mul(1.6), time.mul(0.02))).mul(0.35).add(0.65);
    const OMEGA = 0.9, G = 0.6; // smoke single-scattering albedo and Henyey–Greenstein asymmetry (C: wood smoke, forward-scattering)
    const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir);
    const hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    m.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(OMEGA); m.opacityNode = soft.mul(nz).mul(attribute('aAlpha', 'float'));
    this.mesh = new THREE.InstancedMesh(g, m, N); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'settlement:haze';
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'town smoke haze: opacity follows the lit share of the quarter\'s hearths, ovens and kilns (fire schedules, C); density, height and colour C' };
    this.group.add(this.mesh);
  }
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, hour: number, sky: any) {
    void dt; void sunAlt;
    if (!this.siteFires.size) { this.fire.fires.forEach((f, i) => { if (!f.group) return; if (!this.siteFires.has(f.group)) this.siteFires.set(f.group, []); this.siteFires.get(f.group)!.push(i); }); }
    for (const [site, list] of this.siteFires) { let lit = 0; for (const i of list) if (this.fire.fires[i].lit) lit++; this.lastFrac.set(site, list.length ? lit / list.length : 0); }
    // light on the smoke: the sky's horizon radiance across the view and the direct sun (its irradiance and colour)
    if (sky?.horizon) this.uSky.value.copy(sky.horizon);
    if (sky?.sun) { this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir); }
    // still evening air holds the smoke low (C): stronger after sunset, weaker with wind
    const evening = hour >= 12 && sunAlt < 5 ? 1.4 : 1.0, windK = 1 / (1 + windMs * 0.25);
    const wr = ((windDirDeg + 180 - 341) * Math.PI) / 180, wx = Math.sin(wr), wz = -Math.cos(wr);
    const m4 = new THREE.Matrix4(), q = camera.quaternion, p = new THREE.Vector3(), s = new THREE.Vector3();
    const t = (performance.now() / 1000) * 0.02; this.maxA = 0;
    this.puffs.forEach((pf, i) => {
      const frac = this.lastFrac.get(pf.site) ?? 0, a = Math.min(0.32, 0.4 * Math.pow(frac, 0.8) * evening * windK);
      const drift = (Math.sin(t + pf.ph) * 0.5 + 0.5) * 30 * Math.min(1, windMs / 4);
      p.set(pf.base.x + wx * drift, pf.base.y + pf.h + (1 - windK) * -3, pf.base.z + wz * drift);
      s.set(pf.size * 1.6, pf.size * 0.55, 1); m4.compose(p, q, s); this.mesh.setMatrixAt(i, m4);
      this.alpha.array[i] = a; this.maxA = Math.max(this.maxA, a);
    });
    this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true; this.mesh.visible = this.maxA > 0.003;
  }
  stats() { return { puffs: this.puffs.length, maxAlpha: +this.maxA.toFixed(3), lit: Object.fromEntries([...this.lastFrac].map(([k, v]) => [k, +v.toFixed(2)])) }; }
}
