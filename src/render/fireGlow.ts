// The far fires' light as a deferred term of the post composite (D-355, session 14, agent frame; B125, B193).
//
// Every forward point light is evaluated in every lit material's fragment shader, and the SET of visible lights is part of
// each material's shader key: three rebuilt and recompiled every lit pipeline whenever the number of lit fires within reach
// changed (dusk, walking at night: the D-353 bisect's 447 s first frame for the fire group). Now the forward lights are a
// fixed set from frame 0 (FireSystem: always visible, intensity 0 when free), capped at FORWARD_FIRE_LIGHTS at high, and the
// next GLOW_MAX nearest lit fires are added here, in screen space, from the G-buffer the composite already reads: the same
// candela, flicker, inverse-square fall-off with three's cut-off window, Lambert diffuse, the room confinement (D-216) and
// the baked architectural occlusion (D-222). What they lack against a forward light: the specular highlight, the SSGI
// bounce of their light, and transparent surfaces (C; logged in D-355).
import * as THREE from 'three/webgpu';
import { Fn, uniformArray, Loop, If, float, vec3, max, min, dot, length, step, clamp, int } from 'three/tsl';
import { fireOccNode } from '../world/fireOcc';

/** forward point lights of the fires per quality (the nearest; specular and every material) */
export const FORWARD_FIRE_LIGHTS = { test: 2, low: 4, medium: 8, high: 4, ultra: 8 } as const;
/** deferred fire lights in the composite (high/ultra only: lower qualities have no composite) */
export const GLOW_MAX = 12;
/** the margin a confined light reaches into its hall's walls (m; fire.ts ROOM_MARGIN, mirrored to avoid an import cycle) */
const ROOM_MARGIN = 0.8;

/** per deferred light: A = (position, cut-off), B = (colour × intensity, room mode), C = room box (x0, x1, z0, z1),
 *  D = (room y0, y1, occlusion tile, half-space flag). D-530: with D.w = 1 (a daylight port, B.w = 0) C is a half-space instead
 *  of a room: the light reaches only points p with dot(p − A.xyz, C.xyz) > C.w (the room side of a doorway). Written by FireSystem.update, read by the composite */
export const FIRE_GLOW = {
  A: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4()),
  B: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4()),
  C: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4()),
  D: Array.from({ length: GLOW_MAX }, () => new THREE.Vector4(0, 0, -1, 0)),
  /** how many entries are in use (the rest have zero colour); CPU side only */
  n: 0,
};

/** CPU mirror of the per-light term (renderer units of irradiance on a surface of normal n at p, before the albedo / π) */
export function glowIrradianceCPU(i: number, p: THREE.Vector3, n: THREE.Vector3): number[] {
  const A = FIRE_GLOW.A[i], B = FIRE_GLOW.B[i], C = FIRE_GLOW.C[i], D = FIRE_GLOW.D[i];
  const dx = A.x - p.x, dy = A.y - p.y, dz = A.z - p.z, d = Math.hypot(dx, dy, dz);
  if (!(d < A.w)) return [0, 0, 0];
  const ndl = Math.max(0, (n.x * dx + n.y * dy + n.z * dz) / Math.max(d, 1e-4));
  const w = Math.min(1, Math.max(0, 1 - Math.pow(d / A.w, 4))), att = (1 / Math.max(d * d, 0.01)) * w * w;
  const M = ROOM_MARGIN, inB = p.x > C.x - M && p.x < C.y + M && p.z > C.z - M && p.z < C.w + M && p.y > D.x - M && p.y < D.y + M ? 1 : 0;
  const mask0 = B.w > 0 ? inB : B.w < 0 ? 1 - inB : 1;
  const mask = D.w > 0.5 ? mask0 * ((p.x - A.x) * C.x + (p.y - A.y) * C.y + (p.z - A.z) * C.z > C.w ? 1 : 0) : mask0;
  return [B.x * att * ndl * mask, B.y * att * ndl * mask, B.z * att * ndl * mask];
}

let nodes: { A: any; B: any; C: any; D: any } | null = null, fn: any = null;
/** TSL: the summed irradiance of the deferred fire lights at world point p with world normal n (vec3) */
export function fireGlowIrradiance(p: any, n: any): any {
  // (inside Fn: a Loop outside a function's stack is not recorded in the shader)
  fn ??= Fn(([p, n]: any[]) => glowBody(p, n));
  return fn(p, n);
}
function glowBody(p: any, n: any): any {
  nodes ??= { A: uniformArray(FIRE_GLOW.A, 'vec4'), B: uniformArray(FIRE_GLOW.B, 'vec4'), C: uniformArray(FIRE_GLOW.C, 'vec4'), D: uniformArray(FIRE_GLOW.D, 'vec4') };
  const { A, B, C, D } = nodes;
  const E = vec3(0).toVar('fireGlowE');
  Loop({ start: int(0), end: int(GLOW_MAX), type: 'int', condition: '<' }, ({ i }: any) => {
    const a = A.element(i), b = B.element(i);
    const dv = a.xyz.sub(p), d = length(dv);
    If(d.lessThan(a.w).and(b.x.add(b.y).add(b.z).greaterThan(0)), () => {
      const c = C.element(i), e = D.element(i), M = ROOM_MARGIN;
      const ndl = max(dot(n, dv.div(max(d, 1e-4))), 0);
      const w = clamp(float(1).sub(d.div(a.w).pow(4)), 0, 1), att = float(1).div(max(d.mul(d), 0.01)).mul(w.mul(w));
      const inB = step(c.x.sub(M), p.x).mul(step(p.x, c.y.add(M))).mul(step(c.z.sub(M), p.z)).mul(step(p.z, c.w.add(M)))
        .mul(step(e.x.sub(M), p.y)).mul(step(p.y, e.y.add(M)));
      const pos = max(b.w, 0), neg = max(b.w.negate(), 0);
      const half = step(c.w, dot(p.sub(a.xyz), c.xyz)), hs = e.w;
      const mask = float(1).sub(pos).add(pos.mul(inB)).mul(float(1).sub(neg.mul(inB))).mul(float(1).sub(hs).add(hs.mul(half)));
      const occ = fireOccNode(a.xyz, e.z, p, n);
      E.addAssign(b.xyz.mul(att.mul(ndl).mul(mask).mul(occ)));
    });
  });
  return min(E, vec3(1e6));
}
