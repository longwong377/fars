// Distant rain shafts (brief §1.1 moment "rain moving across the plain toward the columns"; §5.3). The weather gives each
// wet day one rain episode at the Terrace (weatherState.ts); its cell is modelled as a moving object: before the episode
// it stands upwind and drifts in on the steering wind, afterwards it moves off downwind (WeatherSystem.rainCell). The
// cell is a cluster of vertical columns from the ground to the cloud base. Each column is drawn analytically, with no
// raymarch: its opacity is 1 − exp(−σ·chord), where the chord through a cylinder at a side point seen horizontally is
// 2R·|cos θ| (θ between the view and the surface normal). Streaks drift down; the top fades into the cloud base; scene
// fog supplies the aerial perspective. σ and the shapes are C: rain shafts read as translucent grey curtains at
// 5–40 km. Snow cells are paler and softer.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, cameraPosition, normalWorld, normalize, vec3, vec2, float, dot, abs, exp, smoothstep, clamp, mx_noise_float, length, max } from 'three/tsl';
import type { Terrain } from '../terrain/heightfield';
import { azAltToWorld } from '../sky/ephemeris';
import { CLOUD_BASE } from '../sky/clouds';
import { Rng } from '../core/rng';

const SIGMA = 0.0003; // 1/m extinction in the shaft (C: a 6 km chord through a heavy core → ~0.85 opacity)
interface Shaft { mesh: THREE.Mesh; radius: ReturnType<typeof uniform>; off: [number, number]; scale: number }

export class RainShafts {
  readonly group = new THREE.Group();
  private shafts: Shaft[] = [];
  private uTint = uniform(new THREE.Color(0.55, 0.58, 0.63)); private uStrength = uniform(0); private uTime = uniform(0); private uSnow = uniform(0);
  constructor(private terrain: Terrain, count = 5) {
    this.group.name = 'rain-shafts';
    const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
    const rng = new Rng(3, 'rain-shafts');
    for (let i = 0; i < count; i++) {
      const R = uniform(1000);
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, fog: true });
      const v = normalize(cameraPosition.sub(positionWorld)), n = normalWorld;
      const cosT = abs(dot(vec2(n.x, n.z), vec2(v.x, v.z)).div(max(length(vec2(v.x, v.z)), 1e-3)));
      const chord = R.mul(2).mul(cosT);
      const y01 = clamp(positionWorld.y.sub(this.baseY).div(max(this.topY.sub(this.baseY), 1)), 0, 1);
      const streak = mx_noise_float(vec3(positionWorld.x.mul(0.004), positionWorld.y.mul(0.0006).add(this.uTime.mul(0.012)), positionWorld.z.mul(0.004))).mul(0.3).add(0.8);
      const fade = float(1).sub(smoothstep(0.7, 1.0, y01)).mul(smoothstep(0.0, 0.03, y01));
      m.colorNode = this.uTint;
      m.opacityNode = float(1).sub(exp(chord.mul(-SIGMA).mul(float(1).sub(this.uSnow.mul(0.4))))).mul(fade).mul(streak).mul(this.uStrength);
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 2;
      mesh.userData = { tier: 'C', src: 'RECON', note: 'rain cell shafts: position from the weather episode timing and the steering wind; optics C' };
      this.group.add(mesh);
      const ang = rng.range(0, Math.PI * 2), dist = i === 0 ? 0 : rng.range(0.6, 1.4);
      this.shafts.push({ mesh, radius: R, off: [Math.cos(ang) * dist, Math.sin(ang) * dist], scale: i === 0 ? 1 : rng.range(0.4, 0.8) });
    }
  }
  private baseY = uniform(-50); private topY = uniform(1500);
  /** place the cell for this moment; `cell` from WeatherSystem.rainCell; hides the shafts when the player is inside the
   *  rain (the local streaks and fog take over) or the cell is beyond the far terrain */
  update(dt: number, camPos: THREE.Vector3, cell: { distanceM: number; bearingTrueDeg: number; intensity: number; snow: boolean; radiusM: number } | null, skyTint: THREE.Color) {
    this.uTime.value += dt;
    const show = !!cell && cell.distanceM > cell.radiusM * 0.8 && cell.distanceM < 70000;
    for (const s of this.shafts) s.mesh.visible = show;
    if (!show || !cell) return;
    const [dx, , dz] = azAltToWorld(cell.bearingTrueDeg, 0); // unit vector toward the cell (world x/z)
    const cx = dx * cell.distanceM, cz = dz * cell.distanceM;
    const ground = this.terrain.heightAt(cx, cz);
    this.baseY.value = ground - 60; this.topY.value = camPos.y + CLOUD_BASE;
    for (const s of this.shafts) {
      const r = cell.radiusM * s.scale, x = cx + s.off[0] * cell.radiusM, z = cz + s.off[1] * cell.radiusM;
      s.mesh.position.set(x, this.baseY.value, z); s.mesh.scale.set(r, this.topY.value - this.baseY.value, r); s.radius.value = r;
    }
    this.uStrength.value = cell.intensity; this.uSnow.value = cell.snow ? 1 : 0;
    this.uTint.value.copy(skyTint).multiplyScalar(cell.snow ? 1.1 : 0.8);
  }
}
