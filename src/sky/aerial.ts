// Aerial perspective (session 4, D-156; triage item 8): the air between the eye and everything it sees, as an
// exponential-height medium integrated analytically along each view ray, lit by the sky's own horizon radiance in the
// direction of the ray. Replaces the scene's FogExp2 (density 1.2e-5 + 1.2e-4·haze²: a 3–4 % veil at 10 km on a clear
// day, the air of a > 200 km visibility, one colour for every direction).
//
// The medium (per sRGB channel; B where the constants are published, C where they are chosen):
//  • Rayleigh: Bruneton's β(λ) = 1.24062e-6 λ⁻⁴ m⁻¹ (λ in µm) at sea level, scale height 8 km — the D-116 atmosphere's
//    own air; per channel through the same spectral → sRGB weights (atmosphere.ts BIN_RGB): (6.95, 13.63, 31.65)e-6 m⁻¹,
//    i.e. 650 / 549 / 445 nm equivalents.
//  • Aerosol: the D-116 aerosol, whose column above the observer makes the USNO clear-sky extinction k (0.21 per air mass
//    at the weather's clear-day haze 0.25; D-115): σ_M(z) = τ_a / H_M · exp(−(z − 1625 m) / H_M), H_M = 1.2 km (Bruneton),
//    Ångström 0.8 (per channel 0.882 / 1.005 / 1.187 of the 550 nm value). So the aerial perspective, the twilight dome and
//    the sun's colour are one air. At haze 0.25 the plain's air gives σ(550) = 9.0e-5 m⁻¹: Koschmieder's visibility
//    V = 3.912 / σ = 43 km (clear spring day over Marvdasht: 40–70 km, reviewer's range, C), a 59 % veil at 10 km.
//  • Blowing dust (the weather's dust 0..1, C): +4.0e-4 m⁻¹ at dust 1 (V ≈ 8 km, inside the 5–15 km of dust days),
//    Ångström 0.3, the aerosol's scale height.
//  • Mist (the weather's mist 0..1, C): a grey layer over the plain, 2.6e-3 m⁻¹ at 1,600 m asl at mist 1 (V ≈ 1.5 km: WMO
//    "mist" is visibility ≥ 1 km), scale height 100 m, so the valley floor fills and the mountain stands out of it.
//  • Precipitation (C): rain V ≈ 10 km, snowfall V ≈ 2 km at intensity 1, grey, scale height 3 km (to the cloud base).
// Integral along a straight ray from the eye (true height z_c) to a point (z_p) at distance d, for a layer β·e^{−(z−z0)/H}:
//   τ = β d e^{−(z_lo − z0)/H} (1 − e^{−|Δz|/H}) / (|Δz|/H),   z_lo = min(z_c, z_p)
// (heights are true heights: the terrain's apparent curvature drop is added back). Transmittance T = e^{−τ} per channel.
// In-scatter: L_in = J_eff (1 − T), with J the source radiance of the air for the ray's scattering angle θ (to the sun):
// the calibrated sky dome (D-060, D-116) 1.5° above the horizon in the direction that has the same θ — an infinitely long
// horizontal path's in-scatter IS the horizon sky, so the far distance converges exactly to the sky behind it, brighter
// and warmer toward the sun and bluer away (a 64-entry table over θ, dense near the sun; a ray down to the plain below a
// low sun reads the angle it really makes with the sun, not the aureole 1.5° above the horizon). Near the eye the veil is bluer than J, because
// the blue channel's τ is larger. J = J_amb + J_sun: J_amb = ω̄ × the ambient light's mean radiance (sky above, the
// D-153 ground bounce below; C), J_sun the rest; J_sun is weighted by how much of the path the terrain horizon lets the
// sun reach (D-156, horizonMap.ts): v_eff = v_eye + (v_point − v_eye) f(τ), f the in-scatter-weighted position along a
// path whose sunlit fraction varies linearly, so the air in Kuh-e Rahmat's dawn shadow scatters only skylight.
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec3, vec4, float, max, min, abs, exp, sqrt, acos, clamp, dot, length, mix, step, texture, output, positionWorld, cameraPosition } from 'three/tsl';
import { aerosolTauFor, OBSERVER_ALT, GROUND_ALT } from './atmosphere';
import { extinctionK } from './illuminance';
import { EARTH_R, REFRACTION_K } from '../terrain/horizonMap';

type V3 = [number, number, number];
/** Rayleigh extinction at sea level per sRGB channel (Bruneton β(λ) through atmosphere.ts BIN_RGB) */
export const RAYLEIGH_RGB: V3 = [6.952e-6, 1.363e-5, 3.165e-5];
export const H_RAYLEIGH = 8000, H_AEROSOL = 1200, H_MIST = 100, H_PRECIP = 3000;
/** aerosol extinction per channel relative to 550 nm (Ångström 0.8 through BIN_RGB) */
export const AEROSOL_RGB: V3 = [0.882, 1.005, 1.187];
/** blowing dust per channel (Ångström 0.3, C) */
export const DUST_RGB: V3 = [0.953, 1.002, 1.066];
/** extra dust extinction at 550 nm at dust 1 (C: V ≈ 8 km with the clear air) */
export const DUST_BETA = 4.0e-4;
/** mist at 1,600 m asl at mist 1 (C: V ≈ 1.5 km) */
export const MIST_BETA = 3.912 / 1500;
/** rain and snowfall at intensity 1 (C: V ≈ 10 km and 2 km) */
export const RAIN_BETA = 3.912 / 10000, SNOW_BETA = 3.912 / 2000;
/** the plain's level, the reference height of the layers (atmosphere.ts GROUND_ALT) */
export const Z0 = GROUND_ALT;
/** single-scattering albedo of the air mixture for the ambient in-scatter (Rayleigh 1, aerosol 0.9: C) */
export const AIR_ALBEDO = 0.92;
/** the in-scatter table: scattering angle θ, u = √(θ/π) */
export const J_N = 64;

export interface AirState { haze: number; dust?: number; mist?: number; rain?: number; snow?: number }
export interface AirOptics { betaR: V3; betaM: V3; betaMist: number; betaPrecip: number }
/** layer coefficients at the reference height Z0 for a weather state */
export function airOptics(s: AirState): AirOptics {
  const tau = aerosolTauFor(extinctionK(s.haze)), m550 = (tau / H_AEROSOL) * Math.exp(-(Z0 - OBSERVER_ALT) / H_AEROSOL), d = DUST_BETA * Math.max(0, s.dust ?? 0);
  return {
    betaR: RAYLEIGH_RGB.map(b => b * Math.exp(-Z0 / H_RAYLEIGH)) as V3,
    betaM: [0, 1, 2].map(c => m550 * AEROSOL_RGB[c] + d * DUST_RGB[c]) as V3,
    betaMist: MIST_BETA * Math.max(0, s.mist ?? 0),
    betaPrecip: RAIN_BETA * Math.max(0, s.rain ?? 0) + SNOW_BETA * Math.max(0, s.snow ?? 0),
  };
}
/** ∫ e^{−(z−Z0)/H} ds / d along a straight segment between true heights za and zb (m asl) */
export function layerFactor(za: number, zb: number, H: number): number {
  const lo = Math.min(za, zb), x = Math.abs(zb - za) / H;
  return Math.exp(-(lo - Z0) / H) * (x < 1e-4 ? 1 - x / 2 : (1 - Math.exp(-x)) / x);
}
/** optical depth per channel of a segment of length d between true heights zc and zp */
export function opticalDepth(o: AirOptics, zc: number, zp: number, d: number): V3 {
  const fR = layerFactor(zc, zp, H_RAYLEIGH), fM = layerFactor(zc, zp, H_AEROSOL), fm = layerFactor(zc, zp, H_MIST), fp = layerFactor(zc, zp, H_PRECIP);
  return [0, 1, 2].map(c => d * (o.betaR[c] * fR + o.betaM[c] * fM + o.betaMist * fm + o.betaPrecip * fp)) as V3;
}
/** Koschmieder's meteorological visibility (km) at the plain's level, 550 nm (the green channel), 2 % contrast */
export function visibilityKm(o: AirOptics, z = Z0): number {
  const s = o.betaR[1] * Math.exp(-(z - Z0) / H_RAYLEIGH) + o.betaM[1] * Math.exp(-(z - Z0) / H_AEROSOL) + o.betaMist * Math.exp(-(z - Z0) / H_MIST) + o.betaPrecip * Math.exp(-(z - Z0) / H_PRECIP);
  return 3.912 / s / 1000;
}
/** the in-scatter-weighted position along a path of optical depth τ whose sunlit fraction varies linearly from the eye
 *  (0) to the point (1): ∫₀^τ e^{−t} (t/τ) dt / (1 − e^{−τ}); 1/2 for a thin path, → 1/τ for a thick one */
export function pathWeight(tau: number): number {
  if (tau < 0.05) return 0.5 - tau / 12;
  return (1 - Math.exp(-tau) * (1 + tau)) / (tau * (1 - Math.exp(-tau)));
}
/** the true height (m asl) of a world point: apparent y above the court + the rings' curvature drop (heightfield.ts) */
export const trueHeight = (x: number, y: number, z: number, courtAsl: number) => y + courtAsl + ((x * x + z * z) * (1 - REFRACTION_K)) / (2 * EARTH_R);

/** The air: uniforms shared by the scene's fog node, the clouds and the rain shafts, and the in-scatter table. */
export class Air {
  readonly betaR = uniform(new THREE.Vector3()); readonly betaM = uniform(new THREE.Vector3());
  readonly betaMist = uniform(0); readonly betaPrecip = uniform(0);
  /** the ambient part of the in-scatter source (renderer radiance), and the sun's direction (world) */
  readonly jAmb = uniform(new THREE.Color(0, 0, 0)); readonly sunDir = uniform(new THREE.Vector3(0, 1, 0));
  /** the terrain horizon's sun visibility at the eye (D-156), and how much of J is direct sunlight scattered (1 with the
   *  sun up, 0 once it has set: the twilight glow in the haze is skylight, which the terrain does not shadow) */
  readonly vEye = uniform(1); readonly sunUp = uniform(1);
  /** J(θ): the calibrated dome 1.5° above the horizon where the scattering angle is θ, u = √(θ/π) (RGBA half float) */
  readonly jTex: THREE.DataTexture;
  readonly jData = new Float32Array(J_N * 3);
  optics: AirOptics = airOptics({ haze: 0.25 });
  constructor(readonly courtAsl = 1625) {
    this.jTex = new THREE.DataTexture(new Uint16Array(J_N * 4), J_N, 1, THREE.RGBAFormat, THREE.HalfFloatType);
    this.jTex.minFilter = this.jTex.magFilter = THREE.LinearFilter; this.jTex.wrapS = this.jTex.wrapT = THREE.ClampToEdgeWrapping;
    this.jTex.generateMipmaps = false; this.jTex.flipY = false; this.jTex.name = 'air in-scatter'; this.jTex.needsUpdate = true;
    this.setWeather({ haze: 0.25 });
  }
  /** the weather's air (main.ts, every frame) */
  setWeather(s: AirState) {
    const o = this.optics = airOptics(s);
    this.betaR.value.set(o.betaR[0], o.betaR[1], o.betaR[2]); this.betaM.value.set(o.betaM[0], o.betaM[1], o.betaM[2]);
    this.betaMist.value = o.betaMist; this.betaPrecip.value = o.betaPrecip;
  }
  /** fill the in-scatter table from a dome function (world direction → calibrated radiance) and the sun's unit direction;
   *  `amb` = the ambient source radiance (RGB), capped per channel at the table's minimum (it cannot exceed J). Entry i
   *  holds θ_i = π (i/63)²: the dome at 1.5° elevation and the azimuth φ from the sun with cos θ = cos e cos a cos φ + sin e
   *  sin a (angles nearer the sun than any 1.5° direction take φ = 0) */
  setInscatter(dome: (d: V3) => V3, sun: V3, amb: V3) {
    const h = Math.hypot(sun[0], sun[2]), a0 = h > 1e-6 ? Math.atan2(sun[2], sun[0]) : 0, sa = Math.max(-1, Math.min(1, sun[1])), ca = Math.sqrt(1 - sa * sa);
    const e = 1.5 * Math.PI / 180, ce = Math.cos(e), se = Math.sin(e);
    this.sunDir.value.set(sun[0], sun[1], sun[2]);
    const d = this.jTex.image.data as Uint16Array, mn: V3 = [Infinity, Infinity, Infinity];
    for (let i = 0; i < J_N; i++) {
      const u = i / (J_N - 1), th = Math.PI * u * u;
      const phi = ca > 1e-3 ? Math.acos(Math.max(-1, Math.min(1, (Math.cos(th) - se * sa) / (ce * ca)))) : 0, a = a0 + phi;
      const L = dome([Math.cos(a) * ce, se, Math.sin(a) * ce]);
      for (let c = 0; c < 3; c++) { const v = Math.max(0, Math.min(60000, L[c])); this.jData[i * 3 + c] = v; d[i * 4 + c] = THREE.DataUtils.toHalfFloat(v); mn[c] = Math.min(mn[c], v); }
      d[i * 4 + 3] = 0x3c00;
    }
    this.jTex.needsUpdate = true;
    this.jAmb.value.setRGB(Math.min(amb[0], mn[0]), Math.min(amb[1], mn[1]), Math.min(amb[2], mn[2]));
  }
  /** CPU mirror of the table lookup (tests): J at scattering angle θ (rad) */
  jAt(theta: number): V3 {
    const x = Math.sqrt(Math.min(1, Math.max(0, theta / Math.PI))) * (J_N - 1), i = Math.min(J_N - 2, Math.floor(x)), t = x - i;
    return [0, 1, 2].map(c => this.jData[i * 3 + c] * (1 - t) + this.jData[(i + 1) * 3 + c] * t) as V3;
  }

  // ---- TSL ---------------------------------------------------------------------------------------------------------------
  /** true height (m asl) of a world position node */
  zTrue(p: any) { return p.y.add(this.courtAsl).add(p.x.mul(p.x).add(p.z.mul(p.z)).mul((1 - REFRACTION_K) / (2 * EARTH_R))); }
  /** optical depth per channel (vec3) along the segment from `a` to `b` (world position nodes), and its length */
  opticalDepthNode(a: any, b: any): any {
    const za = this.zTrue(a), zb = this.zTrue(b), lo = min(za, zb), dz = abs(zb.sub(za)), d = length(b.sub(a));
    const layer = (H: number) => { const x = max(dz.div(H), 1e-4); return exp(lo.sub(Z0).div(H).negate()).mul(float(1).sub(exp(x.negate())).div(x)); };
    const grey = this.betaMist.mul(layer(H_MIST)).add(this.betaPrecip.mul(layer(H_PRECIP)));
    return this.betaR.mul(layer(H_RAYLEIGH)).add(this.betaM.mul(layer(H_AEROSOL))).add(vec3(grey)).mul(d);
  }
  /** J (vec3) along the world vector `v` from the eye: by its scattering angle to the sun */
  jNode(v: any): any {
    const c = clamp(dot(v.div(max(length(v), 1e-6)), this.sunDir), -1, 1);
    const u = sqrt(acos(c).div(Math.PI));
    return texture(this.jTex, vec2(u.mul(J_N - 1).add(0.5).div(J_N), 0.5)).rgb;
  }
  /** the scene's fog node (three r186 `scene.fogNode`): out = surface · T + J_eff · (1 − T). `sunVis(p)`: the terrain
   *  horizon's sun visibility at a world position (horizonShadow.ts), or null */
  fogNode(sunVis: ((p: any) => any) | null): any {
    return Fn(() => {
      const p = positionWorld, c = cameraPosition, tau = this.opticalDepthNode(c, p), T = exp(tau.negate());
      const jA = this.jAmb as any, J = this.jNode(p.sub(c)), jSun = max(J.sub(jA), vec3(0)); // colour uniforms type-check only against floats (HANDOFF)
      // the sun's share of the path: linear from the eye's visibility to the point's, weighted as the in-scatter is
      const tg = tau.y, big = step(0.05, tg), tb = max(tg, 0.05);
      const f = mix(float(0.5).sub(tg.div(12)), float(1).sub(exp(tb.negate()).mul(tb.add(1))).div(tb.mul(float(1).sub(exp(tb.negate())))), big);
      const vp = sunVis ? sunVis(p) : float(1), veff = mix(this.vEye, vp, clamp(f, 0, 1));
      const Jeff = jA.add(jSun.mul(float(1).sub(this.sunUp.mul(float(1).sub(veff)))));
      return vec4(output.rgb.mul(T).add(Jeff.mul(vec3(1).sub(T))), output.a);
    })();
  }
}
