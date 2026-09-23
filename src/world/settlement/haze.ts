// Smoke haze over the town (brief §1.1 "smoke rising from the town at dusk as lamps are lit", §5.4). The fire system
// draws puffs only near the camera (fire.ts SMOKE_RANGE); from a distance the town's hundreds of hearths read as a low
// haze. Each quarter carries a few large soft sheets whose opacity follows the share of its own hearths, ovens and kilns
// that are lit right now (the fire schedules), thicker in the still evening air, drifting with the wind. Deterministic
// in time (no accumulation), so frozen test renders show it. Density, height and colour are C.
import * as THREE from 'three/webgpu';
import { uniform, uv, vec3, vec4, length, smoothstep, mx_noise_float, attribute, time, float } from 'three/tsl';
import type { TownPlan } from './plan';
import type { FireSystem, FireKind } from '../fire';
import { Rng } from '../../core/rng';

interface Puff { site: string; base: THREE.Vector3; size: number; h: number; ph: number }
export class TownHaze {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh; private alpha: THREE.InstancedBufferAttribute; private puffs: Puff[] = [];
  private uCol = uniform(new THREE.Color(0.5, 0.48, 0.46));
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
    m.colorNode = vec4(this.uCol, float(1)); m.opacityNode = soft.mul(nz).mul(attribute('aAlpha', 'float'));
    this.mesh = new THREE.InstancedMesh(g, m, N); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.name = 'settlement:haze';
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'town smoke haze: opacity follows the lit share of the quarter\'s hearths, ovens and kilns (fire schedules, C); density, height and colour C' };
    this.group.add(this.mesh);
  }
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, hour: number, sky: any) {
    void dt; void sky;
    if (!this.siteFires.size) { this.fire.fires.forEach((f, i) => { if (!f.group) return; if (!this.siteFires.has(f.group)) this.siteFires.set(f.group, []); this.siteFires.get(f.group)!.push(i); }); }
    for (const [site, list] of this.siteFires) { let lit = 0; for (const i of list) if (this.fire.fires[i].lit) lit++; this.lastFrac.set(site, list.length ? lit / list.length : 0); }
    // light on the smoke: daylight falls off through twilight to a faint night level (moon and fires), warm at low sun
    const day = Math.min(1, Math.max(0.025, (sunAlt + 8) / 22)), warm = Math.max(0, 1 - Math.abs(sunAlt - 2) / 10);
    this.uCol.value.setRGB((0.5 + 0.1 * warm) * day, (0.48 + 0.03 * warm) * day, (0.47 - 0.05 * warm) * day);
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
