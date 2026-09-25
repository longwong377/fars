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
import { opticalDepth, Z0, type AirOptics } from '../sky/aerial';

/** debug (?shaftdbg=1|2|3|4): 1 = solid red at full strength; 2 = red, optical-depth term only; 3 = red, height fade only;
 *  4 = the real tint at full strength, and the live values logged (console.error, once a second) */
const DBG = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('shaftdbg') : null;
/** extinction at a shaft's core (1/m) for a rain rate in mm/h: σ ≈ 0.3 km⁻¹ · R^0.63 (the visibility-in-rain relation
 *  after Marshall–Palmer drop sizes; 14 mm/h → 1.6 km⁻¹, visibility ~2 km inside the shaft; C). The old constant
 *  0.00025 /m over a 6 km column (session 7) read as an even veil, never as a curtain (rubric pass 2, R6) */
export function rainSigma(rateMmH: number) { return 0.0003 * Math.pow(Math.max(0.1, rateMmH), 0.63); }
/** the rain rate a cell of this intensity carries in its shafts (mm/h; C: 2 mm/h at a light cell, 20 at the heaviest) */
export const shaftRate = (intensity: number) => 2 + 18 * intensity;
/** the shafts inside a cell of radius `R`: offsets (fractions of R) and core radii (fractions of R). A convective rain
 *  area holds a few shafts 1–4 km across (C), not one column the size of the area */
export function shaftLayout(count: number, seed = 3): { off: [number, number]; scale: number }[] {
  const rng = new Rng(seed, 'rain-shafts'), out: { off: [number, number]; scale: number }[] = [];
  for (let i = 0; i < count; i++) { const ang = rng.range(0, Math.PI * 2), dist = i === 0 ? 0 : rng.range(0.25, 0.75);
    out.push({ off: [Math.cos(ang) * dist, Math.sin(ang) * dist], scale: i === 0 ? 0.28 : rng.range(0.12, 0.24) }); }
  return out;
}
interface Shaft { mesh: THREE.Mesh; radius: ReturnType<typeof uniform>; trans: ReturnType<typeof uniform>; sigma: ReturnType<typeof uniform>; off: [number, number]; scale: number }

export class RainShafts {
  readonly group = new THREE.Group();
  private shafts: Shaft[] = [];
  private uTint = uniform(new THREE.Color(0.55, 0.58, 0.63)); private uStrength = uniform(0); private uTime = uniform(0); private uSnow = uniform(0);
  constructor(private terrain: Terrain, count = 7) {
    this.group.name = 'rain-shafts';
    const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
    const lay = shaftLayout(count);
    for (let i = 0; i < count; i++) {
      const R = uniform(1000), TR = uniform(1), SG = uniform(0.001);
      // (no scene fog on the mesh: it would veil the curtain at the distance of the mesh's surface — seen from inside the 2R
      // mesh, the far wall 2–3 R off — not of the rain, which lies about the column's core. The contrast is scaled instead by
      // the air's transmittance to the core (TR, set per frame from the aerial optics), and what shows through is the sky
      // behind, which already carries the in-scatter: session 7, the solid-red debug shafts came out a faint pink)
      const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, fog: false }));
      const v = normalize(cameraPosition.sub(positionWorld)), n = normalWorld;
      const cosT = abs(dot(vec2(n.x, n.z), vec2(v.x, v.z)).div(max(length(vec2(v.x, v.z)), 1e-3)));
      const tau = R.mul(SG).mul(Math.sqrt(Math.PI)).mul(exp(float(1).sub(cosT.mul(cosT)).mul(-4))); // Gaussian column, mesh at 2R
      const y01 = clamp(positionWorld.y.sub(this.baseY).div(max(this.topY.sub(this.baseY), 1)), 0, 1);
      const streak = mx_noise_float(vec3(positionWorld.x.mul(0.0015), positionWorld.y.mul(0.0004).add(this.uTime.mul(0.01)), positionWorld.z.mul(0.0015))).mul(0.15).add(0.9);
      const fade = float(1).sub(smoothstep(0.8, 1.0, y01)) /* the curtain runs up into the cloud base (it faded out from 0.4 of the height) */.mul(smoothstep(0.0, 0.03, y01));
      m.colorNode = DBG && DBG !== '4' ? color(1, 0, 0) : this.uTint;
      const optic = float(1).sub(exp(tau.negate().mul(float(1).sub(this.uSnow.mul(0.4)))));
      m.opacityNode = DBG === '1' || DBG === '4' ? this.uStrength : DBG === '2' ? optic : DBG === '3' ? fade : optic.mul(fade).mul(streak).mul(this.uStrength).mul(TR);
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 2;
      mesh.userData = { tier: 'C', src: 'RECON', note: 'rain cell shafts: position from the weather episode timing and the steering wind; optics C' };
      this.group.add(mesh);
      this.shafts.push({ mesh, radius: R, trans: TR, sigma: SG, off: lay[i].off, scale: lay[i].scale });
    }
  }
  private lastLog = -1e9;
  private baseY = uniform(-50); private topY = uniform(1500);
  /** the cell for the cloud layer (world x, world z, radius, strength; strength 0 = none): clouds.ts thickens the cloud above it */
  readonly cellWorld = new THREE.Vector4(0, 0, 1, 0);
  /** place the cell for this moment; `cell` from WeatherSystem.rainCell; hides the shafts when the player is inside the
   *  rain (the local streaks and fog take over) or the cell is beyond the far terrain */
  update(dt: number, camPos: THREE.Vector3, cell: { distanceM: number; bearingTrueDeg: number; intensity: number; snow: boolean; radiusM: number } | null, skyTint: THREE.Color, air?: AirOptics) {
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
      s.mesh.position.set(x, this.baseY.value, z); s.mesh.scale.set(2 * r, this.topY.value - this.baseY.value, 2 * r); s.radius.value = r; s.sigma.value = rainSigma(shaftRate(cell.intensity));
      // inside the mesh's 2R cylinder the far wall is drawn (BackSide): a ray leaving the cylinder at angle θ to its normal passes
      // the axis at the same b = 2R·sin θ as one entering it, so the optical-depth term is the same (session 7: the cell was
      // hidden whenever its centre came within 2.1 R — at 11:27 on day 299 a 6 km cell 8.5 km out, the §1.1 rain moment)
      const inside = Math.hypot(x - camPos.x, z - camPos.z) < 2 * r;
      const m = s.mesh.material as THREE.Material; const side = inside ? THREE.BackSide : THREE.FrontSide; if (m.side !== side) { m.side = side; m.needsUpdate = true; }
      s.mesh.visible = true;
      // the air's transmittance (green channel) along the level path to the column's core
      const dCore = Math.max(0, Math.hypot(x - camPos.x, z - camPos.z));
      s.trans.value = air ? Math.exp(-opticalDepth(air, Z0 + 40, Z0 + 40, dCore)[1]) : 1;
    }
    this.uStrength.value = 1; this.uSnow.value = cell.snow ? 1 : 0;
    this.uTint.value.copy(skyTint).multiplyScalar(cell.snow ? 1.05 : 0.35); // skyTint: the calibrated horizon radiance (D-060); a curtain under the thick cell cloud is well shaded (C)
    this.cellWorld.set(cx, cz, cell.radiusM, cell.intensity);
    if (DBG === '4' && (this.uTime.value as number) - this.lastLog > 1) { this.lastLog = this.uTime.value as number;
      console.error('shaftdbg', JSON.stringify({ tint: this.uTint.value.toArray().map((x: number) => +x.toPrecision(3)), sky: skyTint.toArray().map(x => +x.toPrecision(3)), cam: camPos.toArray().map(Math.round),
        shafts: this.shafts.map(s => ({ vis: s.mesh.visible, side: (s.mesh.material as THREE.Material).side, r: Math.round(s.radius.value as number), sg: +(s.sigma.value as number).toPrecision(3), tr: +(s.trans.value as number).toPrecision(3), pos: s.mesh.position.toArray().map(Math.round), h: Math.round(s.mesh.scale.y) })) })); }
  }
}
