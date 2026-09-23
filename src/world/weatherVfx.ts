// Precipitation and lightning (brief §5.3): rain streaks / snowflakes in a volume around the camera, advected by the
// weather wind; lightning = sky flash + brief directional light, rate from the climate's thunder statistics; the
// out-of-world "lightning-flash warning" setting caps the flash brightness.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { attribute, vec4, vec3, float, uv, smoothstep, abs } from 'three/tsl';
import { Rng } from '../core/rng';

export class WeatherVfx {
  readonly group = new THREE.Group();
  private rain: THREE.InstancedMesh; private snow: THREE.InstancedMesh;
  private drops: Float32Array; private flakes: Float32Array;
  private rng = new Rng(1, 'weather-vfx');
  readonly flash = new THREE.DirectionalLight(0xdfe6ff, 0);
  private flashT = -1; private nextStrike = 5;
  onThunder: (delay: number, strength: number) => void = () => {};
  constructor(private maxDrops: number) {
    this.group.name = 'weather-vfx';
    const R = 18, H = 14;
    this.drops = new Float32Array(maxDrops * 3); this.flakes = new Float32Array(maxDrops * 3);
    for (let i = 0; i < maxDrops; i++) { for (const a of [this.drops, this.flakes]) { a[i * 3] = (this.rng.next() - 0.5) * 2 * R; a[i * 3 + 1] = this.rng.next() * H; a[i * 3 + 2] = (this.rng.next() - 0.5) * 2 * R; } }
    const streak = new THREE.PlaneGeometry(0.012, 0.55);
    const rm = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const u = uv(); rm.colorNode = vec4(vec3(0.72, 0.76, 0.82), 1); rm.opacityNode = smoothstep(0.0, 0.4, u.y).mul(smoothstep(0.6, 1.0, u.y).oneMinus()).mul(0.35);
    this.rain = new THREE.InstancedMesh(streak, rm, maxDrops); this.rain.frustumCulled = false; this.rain.count = 0;
    const flake = new THREE.PlaneGeometry(0.03, 0.03);
    const sm = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    sm.colorNode = vec4(vec3(0.95, 0.96, 1.0), 1); sm.opacityNode = smoothstep(0.2, 0.5, abs(u.x.sub(0.5)).add(abs(u.y.sub(0.5)))).oneMinus().mul(0.9);
    this.snow = new THREE.InstancedMesh(flake, sm, maxDrops); this.snow.frustumCulled = false; this.snow.count = 0;
    this.group.add(this.rain, this.snow, this.flash, this.flash.target);
    void attribute; void float;
  }
  update(dt: number, camera: THREE.Camera, cond: { rain: number; snowFall: number; windMs: number; windDirDeg: number; lightning: boolean }, flashCap: number): number {
    const R = 18, H = 14, cp = camera.position, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const wr = ((cond.windDirDeg + 180 - 341) * Math.PI) / 180, wx = Math.sin(wr) * cond.windMs, wz = -Math.cos(wr) * cond.windMs;
    const nr = Math.floor(this.maxDrops * Math.min(1, cond.rain)), ns = Math.floor(this.maxDrops * Math.min(1, cond.snowFall));
    const wrap = (v: number, c: number, r: number) => { const d = v - c; return c + (((d + r) % (2 * r)) + 2 * r) % (2 * r) - r; };
    // rain: 6.5 m/s fall (C, typical drop terminal velocity), tilted by wind
    const tilt = Math.atan2(Math.hypot(wx, wz), 6.5);
    for (let i = 0; i < nr; i++) {
      const a = this.drops; a[i * 3] += wx * dt; a[i * 3 + 1] -= 6.5 * dt; a[i * 3 + 2] += wz * dt;
      if (a[i * 3 + 1] < cp.y - 2) a[i * 3 + 1] += H;
      const x = wrap(a[i * 3], cp.x, R), z = wrap(a[i * 3 + 2], cp.z, R), y = cp.y - 2 + (((a[i * 3 + 1] - cp.y + 2) % H) + H) % H;
      e.set(0, Math.atan2(cp.x - x, cp.z - z), 0); q.setFromEuler(e); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt * Math.sign(wx + wz)));
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); this.rain.setMatrixAt(i, m4);
    }
    this.rain.count = nr; this.rain.instanceMatrix.needsUpdate = nr > 0;
    for (let i = 0; i < ns; i++) {
      const a = this.flakes; a[i * 3] += (wx * 0.8 + Math.sin(i + a[i * 3 + 1]) * 0.3) * dt; a[i * 3 + 1] -= 1.0 * dt; a[i * 3 + 2] += (wz * 0.8 + Math.cos(i * 1.3 + a[i * 3 + 1]) * 0.3) * dt;
      const x = wrap(a[i * 3], cp.x, R), z = wrap(a[i * 3 + 2], cp.z, R), y = cp.y - 2 + (((a[i * 3 + 1] - cp.y + 2) % H) + H) % H;
      m4.compose(new THREE.Vector3(x, y, z), camera.quaternion, new THREE.Vector3(1, 1, 1)); this.snow.setMatrixAt(i, m4);
    }
    this.snow.count = ns; this.snow.instanceMatrix.needsUpdate = ns > 0;
    // lightning: Poisson strikes while `lightning` (≈ one per 25 s at the storm's height, C)
    let flashOut = 0;
    if (cond.lightning) { this.nextStrike -= dt; if (this.nextStrike <= 0) { this.flashT = 0; this.nextStrike = 8 + this.rng.next() * 35; const dist = 1 + this.rng.next() * 9; this.onThunder(dist / 0.343, 1 / dist); } }
    if (this.flashT >= 0) {
      this.flashT += dt; const t = this.flashT;
      const f = t < 0.08 ? 1 : t < 0.18 ? 0.2 : t < 0.26 ? 0.8 : Math.max(0, 1 - (t - 0.26) * 4);
      flashOut = f * flashCap; if (t > 0.6) this.flashT = -1;
      this.flash.position.copy(cp).add(new THREE.Vector3(200, 600, -300)); this.flash.target.position.copy(cp);
    }
    this.flash.intensity = flashOut * 6;
    return flashOut;
  }
}
