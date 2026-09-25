// Distant rain shafts (brief §1.1 moment "rain moving across the plain toward the columns"; §5.3). The weather gives each
// wet day one rain episode at the Terrace (weatherState.ts); its cell is modelled as a moving object: before the episode
// it stands upwind and drifts in on the steering wind, afterwards it moves off downwind (WeatherSystem.rainCell). The
// cell is a cluster of vertical columns from the ground to the cloud base, each with a Gaussian density profile across it
// (a hard-walled cylinder read as a solid white drum, session 3). Drawn analytically, with no raymarch: the mesh is a
// cylinder of twice the core radius; a view ray meeting its side at angle θ to the surface normal (horizontal) passes the
// axis at b = 2R·sin θ, and the optical depth through a Gaussian column is σ·R·√π·exp(−b²/R²) = σ·R·√π·exp(−4 sin²θ).
// Streaks drift down; the top fades into the cloud base; scene fog supplies the aerial perspective. Colour: a rain curtain
// under the cloud deck is shaded and reads darker than the horizon sky behind it (C, 0.7 of the calibrated horizon
// radiance, D-060); snow is slightly brighter. σ and the shapes are C.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { color, uniform, positionWorld, cameraPosition, normalWorld, normalize, vec3, vec2, float, dot, abs, exp, smoothstep, clamp, mx_noise_float, length, max } from 'three/tsl';
import type { Terrain } from '../terrain/heightfield';
import { azAltToWorld } from '../sky/ephemeris';
import { CLOUD_BASE } from '../sky/clouds';
import { Rng } from '../core/rng';

/** debug (?shaftdbg=1|2|3): 1 = solid red at full strength; 2 = red, optical-depth term only; 3 = red, height fade only */
const DBG = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('shaftdbg') : null;
const SIGMA = 0.00025; // 1/m extinction at the core (C: a 4.4 km core radius → optical depth ~2 through the middle, ~0.86 opacity)
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
      const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, fog: true }));
      const v = normalize(cameraPosition.sub(positionWorld)), n = normalWorld;
      const cosT = abs(dot(vec2(n.x, n.z), vec2(v.x, v.z)).div(max(length(vec2(v.x, v.z)), 1e-3)));
      const tau = R.mul(SIGMA * Math.sqrt(Math.PI)).mul(exp(float(1).sub(cosT.mul(cosT)).mul(-4))); // Gaussian column, mesh at 2R
      const y01 = clamp(positionWorld.y.sub(this.baseY).div(max(this.topY.sub(this.baseY), 1)), 0, 1);
      const streak = mx_noise_float(vec3(positionWorld.x.mul(0.0015), positionWorld.y.mul(0.0004).add(this.uTime.mul(0.01)), positionWorld.z.mul(0.0015))).mul(0.15).add(0.9);
      const fade = float(1).sub(smoothstep(0.4, 1.0, y01)).mul(smoothstep(0.0, 0.03, y01));
      m.colorNode = DBG ? color(1, 0, 0) : this.uTint;
      const optic = float(1).sub(exp(tau.negate().mul(float(1).sub(this.uSnow.mul(0.4)))));
      m.opacityNode = DBG === '1' ? this.uStrength : DBG === '2' ? optic : DBG === '3' ? fade : optic.mul(fade).mul(streak).mul(this.uStrength);
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 2;
      mesh.userData = { tier: 'C', src: 'RECON', note: 'rain cell shafts: position from the weather episode timing and the steering wind; optics C' };
      this.group.add(mesh);
      const ang = rng.range(0, Math.PI * 2), dist = i === 0 ? 0 : rng.range(0.6, 1.4);
      this.shafts.push({ mesh, radius: R, off: [Math.cos(ang) * dist, Math.sin(ang) * dist], scale: i === 0 ? 1 : rng.range(0.4, 0.8) });
    }
  }
  private baseY = uniform(-50); private topY = uniform(1500);
  /** the cell for the cloud layer (world x, world z, radius, strength; strength 0 = none): clouds.ts thickens the cloud above it */
  readonly cellWorld = new THREE.Vector4(0, 0, 1, 0);
  /** place the cell for this moment; `cell` from WeatherSystem.rainCell; hides the shafts when the player is inside the
   *  rain (the local streaks and fog take over) or the cell is beyond the far terrain */
  update(dt: number, camPos: THREE.Vector3, cell: { distanceM: number; bearingTrueDeg: number; intensity: number; snow: boolean; radiusM: number } | null, skyTint: THREE.Color) {
    this.uTime.value += dt;
    const show = !!cell && cell.distanceM > cell.radiusM * 0.8 && cell.distanceM < 70000;
    for (const s of this.shafts) s.mesh.visible = false;
    this.cellWorld.w = 0;
    if (!show || !cell) return;
    const [dx, , dz] = azAltToWorld(cell.bearingTrueDeg, 0); // unit vector toward the cell (world x/z)
    const cx = dx * cell.distanceM, cz = dz * cell.distanceM;
    const ground = this.terrain.heightAt(cx, cz);
    this.baseY.value = ground - 60; this.topY.value = camPos.y + CLOUD_BASE;
    for (const s of this.shafts) {
      const r = cell.radiusM * s.scale, x = cx + s.off[0] * cell.radiusM, z = cz + s.off[1] * cell.radiusM;
      s.mesh.position.set(x, this.baseY.value, z); s.mesh.scale.set(2 * r, this.topY.value - this.baseY.value, 2 * r); s.radius.value = r;
      // inside the mesh's 2R cylinder the far wall is drawn (BackSide): a ray leaving the cylinder at angle θ to its normal passes
      // the axis at the same b = 2R·sin θ as one entering it, so the optical-depth term is the same (session 7: the cell was
      // hidden whenever its centre came within 2.1 R — at 11:27 on day 299 a 6 km cell 8.5 km out, the §1.1 rain moment)
      const inside = Math.hypot(x - camPos.x, z - camPos.z) < 2 * r;
      const m = s.mesh.material as THREE.Material; const side = inside ? THREE.BackSide : THREE.FrontSide; if (m.side !== side) { m.side = side; m.needsUpdate = true; }
      s.mesh.visible = true;
    }
    this.uStrength.value = cell.intensity; this.uSnow.value = cell.snow ? 1 : 0;
    this.uTint.value.copy(skyTint).multiplyScalar(cell.snow ? 1.05 : 0.35); // skyTint: the calibrated horizon radiance (D-060); a curtain under the thick cell cloud is well shaded (C)
    this.cellWorld.set(cx, cz, cell.radiusM, cell.intensity);
  }
}
