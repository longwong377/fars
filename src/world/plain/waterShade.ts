// Water surfaces (C): one shading model for the Pulvar and the Kur, the canals of the plain (rivers.ts) and the town's
// garden channels, pools and canal (settlement/water.ts). Arithmetic only (no runtime select(), D-012).
//
// Ripples are band-limited, advected gradient noise, not wave trains: four octaves of 3-D noise (wavelengths 2.4 m to
// 0.17 m) in the flow's frame (along, across, and a slow time axis), carried downstream at the flow's speed, streakier
// along the flow than across it. Each octave's slope is taken by finite differences and faded out where its wavelength
// spans fewer than ~3-8 pixels (fwidth of the world position), so distant water never aliases into the regular stripes
// of the two cosine trains it replaced (session 4 renders); what the faded octaves would have done to the reflection
// is kept as roughness (a distant rippled surface reflects a blurred sky). The body is dark and deep in mid-channel and
// shows its bed in the shallows (absorption with depth, per channel); turbid flood water is an opaque silty brown. The
// sky is reflected with Fresnel (F0 0.02) from the calibrated horizon radiance (the fog colour, D-060) up to the
// hemisphere's sky, as before.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, cameraPosition, vec3, float, mix, smoothstep, length, dot, normalize, max, exp, mx_noise_float, time, fwidth, color, clamp } from 'three/tsl';

/** sky and horizon radiance the water reflects; set every frame by the plain (index.ts, from the hemisphere light and
 *  the fog colour). Shared by every water material. */
export const WATER_SKY = { sky: uniform(new THREE.Color(0.5, 0.6, 0.8)), horizon: uniform(new THREE.Color(0.7, 0.72, 0.75)) };
/** ripple octaves: wavelength (m), slope amplitude (C) */
export const RIPPLE_OCTAVES: [number, number][] = [[2.4, 0.075], [1.0, 0.07], [0.42, 0.06], [0.17, 0.05]];

/** Rippled water normal (world, unit) and the slope lost to band-limiting (0..~0.25). s, u: position along and across
 *  the flow (m); T, B: world unit vectors along and across the flow; speed (m/s); amp: slope scale (1 = a brisk river) */
export function rippleNormal(s: any, u: any, T: any, B: any, speed: any, amp: any) {
  const fp = max(length(fwidth(positionWorld.xz)), 1e-4); // metres per pixel
  let gs: any = float(0), gu: any = float(0), lost: any = float(0);
  RIPPLE_OCTAVES.forEach(([lam, a], k) => {
    const f = 1 / lam, e = 0.18, adv = s.sub(time.mul(speed));
    const q = vec3(adv.mul(f), u.mul(f * 1.7), time.mul(0.18 + 0.1 * k).add(k * 13.1)); // streaky along the flow; evolves slowly
    const n0 = mx_noise_float(q), ns = mx_noise_float(q.add(vec3(e, 0, 0))), nu = mx_noise_float(q.add(vec3(0, e * 1.7, 0)));
    const w = float(1).sub(smoothstep(lam * 0.12, lam * 0.33, fp)); // fades out below ~3-8 px per wavelength
    const k2 = amp.mul(a).mul(w);
    gs = gs.add(ns.sub(n0).div(e).mul(k2)); gu = gu.add(nu.sub(n0).div(e * 1.7).mul(k2).mul(1.7));
    lost = lost.add(amp.mul(a).mul(float(1).sub(w)));
  });
  return { n: normalize(vec3(0, 1, 0).sub(T.mul(gs)).sub(B.mul(gu))), lost };
}
const lin = (r: number, g: number, b: number): any => color(new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
/** body colour (the diffuse albedo standing for light scattered back from inside the water): absorption with the local
 *  depth d (m) over the bed; turbid (0..1) flood water is an opaque silty brown (C) */
export function waterBody(d: any, turbid: any, bed: any = lin(0.26, 0.22, 0.16)) {
  const deep = lin(0.045, 0.07, 0.06), silty = lin(0.25, 0.21, 0.145);
  const tr = exp(vec3(1.1, 0.42, 0.34).mul(d).negate() as any) as any; // per channel: red is lost first, the deep body is dark green
  const clear = bed.mul(tr).add(deep.mul(vec3(1).sub(tr)));
  const tt = exp(d.mul(-9)); // turbid water: the bed shows only in the first few centimetres
  const murky = bed.mul(tt).add(silty.mul(float(1).sub(tt)));
  return mix(clear, murky, turbid);
}
/** Fresnel sky reflection (emissive radiance) for the world normal nW; `dull` (0..1) takes some off where the surface
 *  is broken (riffles). `bank` (optional): the reflected ray's elevation (sin) below which it meets the far bank and its
 *  reeds rather than the sky, and the fraction of the sky above that the riparian trees stand in: at grazing angles a
 *  river mirrors its far bank dark, not a pale band of sky (C) */
export function skyReflection(nW: any, dull: any = float(0), bank: { sin: any; trees: any; treeSin: any } | null = null) {
  const V = normalize(cameraPosition.sub(positionWorld)), cosT = clamp(dot(nW, V), 0, 1), m = float(1).sub(cosT);
  const F = float(0.02).add(m.mul(m).mul(m).mul(m).mul(m).mul(0.98));
  const R = V.negate().reflect(nW);
  let rad: any = mix(WATER_SKY.horizon, WATER_SKY.sky, smoothstep(0.0, 0.5, R.y)).mul(1 / Math.PI);
  if (bank) {
    // the bank, reeds and trees: lit earth and foliage at about a third of the horizon's radiance, greener (C)
    const bankRad = (WATER_SKY.horizon as any).mul(vec3(0.26, 0.3, 0.22)).mul(1 / Math.PI);
    const onBank = float(1).sub(smoothstep(bank.sin.mul(0.8), bank.sin.mul(1.2).add(0.004), R.y));
    const onTrees = float(1).sub(smoothstep(bank.treeSin.mul(0.7), bank.treeSin.mul(1.3).add(0.004), R.y)).mul(bank.trees);
    rad = mix(rad, bankRad, max(onBank, onTrees));
  }
  return rad.mul(F).mul(float(1).sub(dull.mul(0.5)));
}
/** roughness: still water is a mirror (0.04); the slope that band-limiting took out, and broken water, roughen it */
export const waterRoughness = (lost: any, broken: any = float(0)) => clamp(float(0.04).add(lost.mul(1.4)).add(broken.mul(0.25)), 0.04, 0.4);
