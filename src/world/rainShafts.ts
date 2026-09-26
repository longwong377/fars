// Distant rain shafts (brief §1.1 moment "rain moving across the plain toward the columns"; §5.3). The weather gives each
// wet day one rain episode at the Terrace (weatherState.ts); its cell is modelled as a moving object: before the episode
// it stands upwind and drifts in on the steering wind, afterwards it moves off downwind (WeatherSystem.rainCell). The
// cell is a cluster of vertical columns from the ground to the cloud base, each with a Gaussian density profile across it
// (a hard-walled cylinder read as a solid white drum, session 3). Drawn analytically, with no raymarch: the mesh is a
// cylinder of twice the core radius; a view ray meeting its side at angle θ to the surface normal (horizontal) passes the
// axis at b = 2R·sin θ, and the optical depth through a Gaussian column is σ·R·√π·exp(−b²/R²) = σ·R·√π·exp(−4 sin²θ).
//
// Shading (D-219). The curtain is a medium in front of whatever lies behind it: out = α·L_c + (1 − α)·behind, with
//   α   = (1 − e^{−τ}) · height profile · streaks                     (the rain's own opacity; no air term)
//   L_c = T_air · k · J + (1 − T_air) · J                                (the curtain's light as the eye receives it)
// J is the air's in-scatter source in the ray's direction — the calibrated horizon sky in that direction (aerial.ts: an
// infinitely long horizontal path's in-scatter IS the horizon sky), read on the GPU from the same table as the fog and the
// clouds; T_air the air's transmittance from the eye to the column's core (per channel, the same optical depth as the fog
// node); k the rain's radiance relative to J: a thick rain column under the cell's deep cloud is lit by the dim light
// beneath it (C: 0.42 near the ground, 0.22 at the cloud base; snow 1.05). Against the sky (behind = J) the curtain darkens
// the sky by α·T_air·(1 − k); against far terrain it also veils it. Before (session 7) the colour was a CPU copy of the
// fog colour × 0.35 and the opacity carried T_air: the sky inside the shafts' mask measured the same as outside (212/212,
// v5 render); the colour now comes from the same GPU table as the sky it is drawn over, so the two cannot drift apart.
// Streaks drift down; the top fades into the cloud base. σ, k and the shapes are C.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { color, uniform, positionWorld, cameraPosition, normalWorld, normalize, vec3, vec2, float, dot, abs, exp, smoothstep, clamp, mx_noise_float, length, max, mix, acos } from 'three/tsl';
import type { Terrain } from '../terrain/heightfield';
import { azAltToWorld } from '../sky/ephemeris';
import { CLOUD_BASE } from '../sky/clouds';
import { Rng } from '../core/rng';
import { opticalDepth, Z0, type AirOptics, type Air } from '../sky/aerial';

/** debug (?shaftdbg=…, or RainShafts.debug at run time): 1 = solid red at full opacity; 2 = red at the real opacity;
 *  4 = the real colour at full opacity. Live values: RainShafts.stats() (window.__parsa.world scene, group 'rain-shafts') */
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
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** optical depth along a view ray through a Gaussian column of core optical depth `tauCore` (σ·R·√π), the ray meeting the
 *  2R mesh at cos θ to its normal (the ray's miss distance b = 2R sin θ) */
export const shaftTau = (tauCore: number, cosT: number) => tauCore * Math.exp(-4 * (1 - cosT * cosT));
/** the curtain's density over its height (y01: 0 at the ground, 1 at the cloud base): it stands on the ground and runs up
 *  into the cloud base (C) */
export const shaftProfile = (y01: number) => smooth(0, 0.03, y01) * (1 - smooth(0.78, 1.0, y01));
/** the rain's radiance relative to the horizon sky J in the same direction (C): shaded by the cell's deep cloud, darker
 *  toward the cloud base; falling snow is brighter than rain */
export const shaftShade = (y01: number, snow: boolean) => (snow ? 1.05 : 0.42 - 0.2 * Math.min(1, Math.max(0, y01)));
/** the curtain's opacity (streaks = 1: their mean) */
export const shaftAlpha = (tau: number, y01: number, snow: boolean, streak = 1) => (1 - Math.exp(-tau * (snow ? 0.6 : 1))) * shaftProfile(y01) * streak;
/** how much darker the sky reads through the curtain than beside it: 1 − out / J with behind = J (per unit J) */
export const skyDarkening = (alpha: number, tAir: number, k: number) => alpha * tAir * (1 - k);

/** Rainbows (session 9, T-J5): sunlight scattered back by the falling drops, on the rain itself, at the angle θ from the
 *  antisolar point. Geometry B (Descartes' minimum-deviation angles for water, n ≈ 1.331-1.343 across the visible band,
 *  smeared by the Sun's 0.53° disc): the primary red at 42.3°, green 41.5°, blue 40.8°; the secondary reversed and ~43 % as
 *  bright, red 50.5°, green 51.3°, blue 52.6°; the sky inside the primary brighter (the light the drops send inside it) and
 *  Alexander's dark band between the bows. The bow's brightness relative to the Sun is C (BOW_GAIN), checked on screen. */
export const BOW = { primary: [42.3, 41.5, 40.8], secondary: [50.5, 51.3, 52.6], sigma: [0.45, 0.6], secondaryShare: 0.43, inside: 0.18 };
export const BOW_GAIN = 0.03;
/** the bow's spectral weight per channel at θ degrees from the antisolar point (1 = the primary's peak) */
export function bowWeight(thetaDeg: number): [number, number, number] {
  const g = (c: number, s: number) => Math.exp(-0.5 * ((thetaDeg - c) / s) ** 2);
  const inside = BOW.inside * smooth(20, 40.6, thetaDeg) * (thetaDeg < 40.8 ? 1 : 0); // brighter toward the bow, fading toward the antisolar point
  return [0, 1, 2].map(i => g(BOW.primary[i], BOW.sigma[0]) + BOW.secondaryShare * g(BOW.secondary[i], BOW.sigma[1]) + inside) as [number, number, number];
}

interface Shaft { mesh: THREE.Mesh; radius: any; core: any; sigma: any; off: [number, number]; scale: number; dist: number; tAir: number }

export class RainShafts {
  readonly group = new THREE.Group();
  private shafts: Shaft[] = [];
  private uTime = uniform(0); private uSnow = uniform(0);
  /** the rainbow's light source: the direction to the sun (world) and its colour × intensity × its visibility at the rain (0 when
   *  the sun is down, behind cloud or snow falls: no bow in snow) */
  private uSunW = uniform(new THREE.Vector3(0, 1, 0)); private uBowE = uniform(new THREE.Color(0, 0, 0));
  /** the fallback curtain colour when no air is given (tests, no sky): the fog colour × k */
  private uTint = uniform(new THREE.Color(0.25, 0.26, 0.28));
  /** debug switches (uniforms, so a page can flip them between screenshots): red colour, full opacity */
  readonly dbgRed = uniform(DBG === '1' || DBG === '2' ? 1 : 0); readonly dbgFull = uniform(DBG === '1' || DBG === '4' ? 1 : 0);
  private baseY = uniform(-50); private topY = uniform(1500);
  private air: Air | null = null;
  private snow = false;
  /** the cell for the cloud layer (world x, world z, radius, strength; strength 0 = none): clouds.ts thickens the cloud above
   *  it; the materials (WEATHER.cell) wet the ground under it and the sun is shaded by its cloud */
  readonly cellWorld = new THREE.Vector4(0, 0, 1, 0);
  constructor(private terrain: Terrain, count = 7) {
    this.group.name = 'rain-shafts'; this.group.userData.api = this;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
    const lay = shaftLayout(count);
    for (let i = 0; i < count; i++) {
      const R = uniform(1000), SG = uniform(0.001), C = uniform(new THREE.Vector3());
      // (no scene fog on the mesh: the fog would veil the curtain at the mesh surface's distance, 2–3 R off the core seen
      // from inside; the air is applied here, to the core)
      const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide, fog: false }));
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 2;
      mesh.userData = { tier: 'C', src: 'RECON', note: 'rain cell shafts: position from the weather episode timing and the steering wind; optics C (D-219)' };
      this.group.add(mesh);
      this.shafts.push({ mesh, radius: R, core: C, sigma: SG, off: lay[i].off, scale: lay[i].scale, dist: 0, tAir: 1 });
      this.build(this.shafts[i]);
    }
  }
  /** the material's nodes; with the air (after the first update that has it) the colour is J and T_air on the GPU */
  private build(s: Shaft) {
    const m = s.mesh.material as THREE.MeshBasicNodeMaterial, R = s.radius, SG = s.sigma, air = this.air;
    const v = normalize(cameraPosition.sub(positionWorld)), n = normalWorld;
    const cosT = abs(dot(vec2(n.x, n.z), vec2(v.x, v.z)).div(max(length(vec2(v.x, v.z)), 1e-3)));
    const tau = R.mul(SG).mul(Math.sqrt(Math.PI)).mul(exp(float(1).sub(cosT.mul(cosT)).mul(-4))); // Gaussian column, mesh at 2R
    const y01 = clamp(positionWorld.y.sub(this.baseY).div(max(this.topY.sub(this.baseY), 1)), 0, 1);
    // streaks: vertical striations ~200 m across, a few km tall, falling at ~7 m/s (C)
    const nz = mx_noise_float(vec3(positionWorld.x.mul(1 / 220), positionWorld.y.mul(1 / 1800).add(this.uTime.mul(7 / 1800)), positionWorld.z.mul(1 / 220)));
    const streak = clamp(nz.mul(0.35).add(0.9), 0.45, 1.2);
    const profile = smoothstep(0.0, 0.03, y01).mul(float(1).sub(smoothstep(0.78, 1.0, y01)));
    const alpha = float(1).sub(exp(tau.negate().mul(float(1).sub(this.uSnow.mul(0.4))))).mul(profile).mul(streak);
    const k = mix(float(0.42).sub(y01.mul(0.2)), float(1.05), this.uSnow);
    let col: any;
    if (air) {
      const J = air.jNode(positionWorld.sub(cameraPosition));
      const core = vec3(s.core.x, positionWorld.y, s.core.z);
      const tAir = exp(air.opticalDepthNode(cameraPosition, core).negate());
      col = J.mul(vec3(1).sub(tAir.mul(float(1).sub(k))));
    } else col = this.uTint.mul(k.div(0.42));
    // the rainbow: the antisolar angle of this view ray, the bow's spectral weight (bowWeight's GPU copy), times the rain's opacity
    const th = acos(clamp(dot(v.negate(), this.uSunW.negate()), -1, 1)).mul(180 / Math.PI), g = (c: number, sg: number) => exp(th.sub(c).div(sg).mul(th.sub(c).div(sg)).mul(-0.5));
    const inside = float(BOW.inside).mul(smoothstep(20, 40.6, th)).mul(float(1).sub(smoothstep(40.6, 40.9, th)));
    const bow = vec3(...([0, 1, 2].map(i => g(BOW.primary[i], BOW.sigma[0]).add(g(BOW.secondary[i], BOW.sigma[1]).mul(BOW.secondaryShare)).add(inside)) as [any, any, any]));
    col = col.add(bow.mul(this.uBowE).mul(BOW_GAIN).mul(float(1).sub(this.uSnow)));
    m.colorNode = mix(col, color(1, 0, 0), this.dbgRed);
    m.opacityNode = mix(alpha, float(1), this.dbgFull);
    m.needsUpdate = true;
  }
  /** debug: 0 = real, 1 = solid red, 2 = red at the real opacity, 4 = the real colour at full opacity */
  debug(mode: number) { this.dbgRed.value = mode === 1 || mode === 2 ? 1 : 0; this.dbgFull.value = mode === 1 || mode === 4 ? 1 : 0; }
  /** the live values (CPU mirrors) for a debug log */
  stats() {
    return { cell: this.cellWorld.toArray().map(Math.round), air: !!this.air, snow: this.snow, baseY: Math.round(this.baseY.value as number), topY: Math.round(this.topY.value as number),
      shafts: this.shafts.map(s => { const tc = (s.sigma.value as number) * (s.radius.value as number) * Math.sqrt(Math.PI), a = shaftAlpha(tc, 0.4, this.snow);
        return { vis: s.mesh.visible, side: (s.mesh.material as THREE.Material).side, r: Math.round(s.radius.value as number), d: Math.round(s.dist), tauCore: +tc.toFixed(2), tAir: +s.tAir.toFixed(3), alphaCore: +a.toFixed(3), skyDark: +skyDarkening(a, s.tAir, shaftShade(0.4, this.snow)).toFixed(3) }; }) };
  }
  /** place the cell for this moment; `cell` from WeatherSystem.rainCell; hides the shafts when the player is inside the
   *  rain (the local streaks and fog take over) or the cell is beyond the far terrain. `air`: the SkySystem's air (the
   *  colour is built from it on the GPU); `skyTint`: the fog colour, the fallback without it */
  update(dt: number, camPos: THREE.Vector3, cell: { distanceM: number; bearingTrueDeg: number; intensity: number; snow: boolean; radiusM: number } | null, skyTint: THREE.Color, air?: Air | AirOptics | null,
    sun?: { dirW: THREE.Vector3; rgb: THREE.Color; visible: number }) {
    this.uTime.value += dt;
    if (sun) { this.uSunW.value.copy(sun.dirW); (this.uBowE.value as THREE.Color).copy(sun.rgb).multiplyScalar(Math.max(0, sun.visible)); } else (this.uBowE.value as THREE.Color).setRGB(0, 0, 0);
    const A = air && (air as Air).jNode ? (air as Air) : null, optics: AirOptics | undefined = A ? A.optics : (air as AirOptics | undefined) ?? undefined;
    if (A && A !== this.air) { this.air = A; for (const s of this.shafts) this.build(s); }
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
      (s.core.value as THREE.Vector3).set(x, 0, z);
      // inside the mesh's 2R cylinder the far wall is drawn (BackSide): a ray leaving the cylinder at angle θ to its normal passes
      // the axis at the same b = 2R·sin θ as one entering it, so the optical-depth term is the same (session 7: the cell was
      // hidden whenever its centre came within 2.1 R — at 11:27 on day 299 a 6 km cell 8.5 km out, the §1.1 rain moment)
      s.dist = Math.hypot(x - camPos.x, z - camPos.z);
      const inside = s.dist < 2 * r;
      const m = s.mesh.material as THREE.Material; const side = inside ? THREE.BackSide : THREE.FrontSide; if (m.side !== side) { m.side = side; m.needsUpdate = true; }
      s.mesh.visible = true;
      s.tAir = optics ? Math.exp(-opticalDepth(optics, Z0 + 40, Z0 + 40, s.dist)[1]) : 1; // (CPU mirror, for stats and tests)
    }
    this.snow = cell.snow; this.uSnow.value = cell.snow ? 1 : 0;
    this.uTint.value.copy(skyTint).multiplyScalar(0.42);
    this.cellWorld.set(cx, cz, cell.radiusM, cell.intensity);
  }
}
