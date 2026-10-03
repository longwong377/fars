// D-670 (C12's fourth pass, "nothing moves in the wind"): one wind for every plant. The weather's wind (speed, and the
// direction it blows from: the same convention as the smoke, hearthSmoke.ts windWorld) sets a steady lean downwind, gusts
// that travel across the land with the wind (patches ~25-60 m across, moving at about the wind's speed: the waves that run
// over a wheat field or a reed bed) and a small flutter of each plant's own. The crops, the reeds and grass at the water,
// the ground cover and the trees all read it, so they lean and ripple the way the smoke drifts (C: the look of wind in
// standing plants; amplitudes per plant by its flexibility).
import * as THREE from 'three/webgpu';
import { uniform, vec2, vec3, float, sin, time, smoothstep, mx_noise_float, dot } from 'three/tsl';
import { windWorld } from '../hearthSmoke';

/** downwind unit vector (world x, z) and speed (m/s) */
export const WIND_FIELD = { dir: uniform(new THREE.Vector2(1, 0)), ms: uniform(2) };
export function setWindField(ms: number, fromDeg: number) { const w = windWorld(fromDeg, 1); WIND_FIELD.dir.value.set(w[0], w[2]); WIND_FIELD.ms.value = ms; }

/** the gust at world (x, z) now, 0 (a lull) .. ~1.3 (a gust's core): a noise field carried downwind */
export function gustAt(p: any) {
  const d = WIND_FIELD.dir, along = dot(p, d), across = p.x.mul(d.y.negate()).add(p.y.mul(d.x));
  const carry = time.mul(WIND_FIELD.ms.max(0.8).mul(0.85));
  const g = mx_noise_float(vec3(along.sub(carry).mul(0.03), across.mul(0.022), time.mul(0.04)))
    .add(mx_noise_float(vec3(along.sub(carry.mul(1.15)).mul(0.09), across.mul(0.07), time.mul(0.09))).mul(0.4));
  return smoothstep(-0.45, 0.65, g).mul(1.3);
}

/** a plant's horizontal bend (world x, z, metres per metre of height above the ground) at world (x, z) = p, with its own
 *  phase: lean + gust downwind and a flutter round it; `flex` scales it (stiff 0.3 .. supple 1.5) */
export function windBend(p: any, phase: any, flex: number | any = 1) {
  const ms = WIND_FIELD.ms, d = WIND_FIELD.dir, k = float(flex);
  const lean = ms.mul(0.006).add(ms.mul(ms).mul(0.0009)).min(0.35); // ~0.02 at 2 m/s, ~0.12 at 8 m/s
  const gust = gustAt(p).mul(ms.mul(0.018)).min(0.45);
  const flut = sin(time.mul(float(2.3).add(ms.mul(0.25))).add(phase.mul(6.283))).mul(ms.mul(0.004).add(0.002));
  const along = lean.add(gust).add(flut), side = sin(time.mul(1.7).add(phase.mul(4.1))).mul(ms.mul(0.003));
  return vec2(d.x.mul(along).sub(d.y.mul(side)), d.y.mul(along).add(d.x.mul(side))).mul(k);
}
