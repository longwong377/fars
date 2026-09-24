// The incised-sign shading (D-166; geometry and depth atlas: src/arch/carving.ts). Each carved sign is a quad on the stone
// face; its atlas cell holds the depth of the cut at every point (a V-section, walls at 45°). Per pixel:
//  - the view ray enters the face at the quad and is marched into the depth field (parallax occlusion: 16 steps and a
//    linear refinement), so the cut's far wall shows and its near wall hides as the eye moves, as in a real incision;
//  - where the face is uncut (depth 0 under the pixel) the pixel is discarded and the stone behind it shows;
//  - the cut's wall at the hit point is lit by its own normal (the depth field's gradient: the wall facing the sun is lit,
//    the other in shade) in the host stone's own material (the same world-space surface as the face, materials.ts), and
//    receives less skylight the deeper it lies (an occlusion of up to 30 % at the root of the V, C).
// What it is not: the stone mesh is not cut, so a sign seen edge-on has no notch in the stone's silhouette, and the sun's
// shadow map does not resolve the millimetre walls (their self-shadow is the normal's own N·L).
import * as THREE from 'three/webgpu';
import { attribute, texture, positionWorld, cameraPosition, modelWorldMatrix, cameraViewMatrix, vec2, vec3, vec4, float, Fn, Loop, If, Break, int, normalize, dot, cross, clamp, smoothstep, max } from 'three/tsl';
import type { Atlas } from '../arch/carving';

export interface IncisionNodes { mask: any; normalView: any; ao: any; depth: any }
/** the nodes of one atlas (opentype font): mask (1 inside the cut), the view-space normal of the cut's wall, the skylight
 *  occlusion and the depth (m) at the hit point */
export function incisionNodes(A: Atlas): IncisionNodes {
  const tex = A.tex, W = A.width, H = A.height, TPE = A.tpe, MAXD = A.maxDepthEm;
  const uv0 = attribute('carveUV', 'vec2'), em = attribute('carveEm', 'float');
  const depthAt = (p: any) => texture(tex, p).level(float(0)).r.mul(MAXD).mul(em);
  const out = Fn(() => {
    const T = normalize(modelWorldMatrix.mul(vec4(attribute('carveT', 'vec3'), 0)).xyz).toVar(), B = normalize(modelWorldMatrix.mul(vec4(attribute('carveB', 'vec3'), 0)).xyz).toVar(), N = normalize(cross(T, B)).toVar();
    const V = normalize(cameraPosition.sub(positionWorld)).toVar();
    const vz = max(dot(V, N), float(0.2)); // beyond ~78° from the normal the march is clamped (the sign is then a few px tall)
    // atlas uv per metre along the face, and the uv shift per metre of depth along the view ray (away from the eye)
    const k = vec2(float(TPE / W).div(em), float(TPE / H).div(em));
    const du = vec2(dot(V, T).negate(), dot(V, B).negate()).div(vz).mul(k).toVar();
    const d0 = depthAt(uv0);
    const zMax = float(MAXD).mul(em), dz = zMax.div(16).toVar();
    const z = float(0).toVar(), p = vec2(uv0).toVar(), hPrev = d0.toVar();
    Loop({ start: int(0), end: int(16), type: 'int', condition: '<', name: 'ci' } as any, () => {
      const zn = z.add(dz), pn = uv0.add(du.mul(zn)), hn = depthAt(pn);
      If(hn.lessThan(zn), () => { // the ray passed under the cut's surface between z and zn: refine linearly
        const a = hPrev.sub(z), b = hn.sub(zn), t = clamp(a.div(max(a.sub(b), 1e-6)), 0, 1);
        z.addAssign(dz.mul(t)); p.assign(uv0.add(du.mul(z))); Break();
      });
      z.assign(zn); p.assign(pn); hPrev.assign(hn);
    });
    // the wall's normal from the depth gradient (central differences, one texel): n = (∂d/∂x, ∂d/∂y, 1) in the face's frame
    const tx = float(1 / W), ty = float(1 / H), m = float(TPE).div(em).mul(0.5); // 1 / (2 texels in metres)
    const gx = depthAt(p.add(vec2(tx, 0))).sub(depthAt(p.sub(vec2(tx, 0)))).mul(m), gy = depthAt(p.add(vec2(0, ty))).sub(depthAt(p.sub(vec2(0, ty)))).mul(m);
    const nW = normalize(T.mul(gx).add(B.mul(gy)).add(N));
    const nV = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
    const depth = depthAt(p);
    const ao = float(1).sub(smoothstep(0, float(0.05).mul(em), depth).mul(0.3));
    return vec4(nV, ao);
  })();
  const mask = depthAt(uv0).greaterThan(float(0.0002).mul(em)).select(float(1), float(0));
  return { mask, normalView: out.xyz, ao: out.w, depth: depthAt(uv0) };
}
export type { THREE };
