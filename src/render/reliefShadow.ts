// The relief figures' cast shadows in the sun's light (D-226; data: src/arch/relief_shadow.ts, which has the CPU mirror of
// this march). The sun's colour node (skySystem.ts) is multiplied by reliefShadowNode(positionWorld, sun direction), so every
// lit material receives it: the wall face beside a carved figure and the figure's own surfaces. Per fragment:
//  - the plan grid (in the same 8-bit texture as the heights, below them) gives up to four panels near the point;
//  - the first panel whose reach holds the point (along its wall within REACH of its rectangle, from 5 cm behind the face to
//    the relief's top) is marched: MARCH_STEPS samples of the height atlas (bilinear) along the ray toward the sun, from the
//    point until the ray is above the relief's top or REACH along the wall; a sample higher than the ray occludes, softly
//    over the sun's penumbra and the texel;
//  - elsewhere, and for a wall facing away from the sun, the factor is 1.
// Two texture bindings (the 8-bit atlas and the RGBA32F panel table): every lit material pays for them, and a fragment stage
// may bind only 16 textures (D-216).
import * as THREE from 'three/webgpu';
import { Fn, float, int, ivec2, vec2, vec4, texture, textureLoad, floor, clamp, max, min, smoothstep, length, If, Loop } from 'three/tsl';
import { HSCALE, REACH, SLOTS, MARCH_STEPS, BIAS, SOFT0, SOFT_T, type ReliefShadowData } from '../arch/relief_shadow';

let DATA: ReliefShadowData | null = null, ATLAS: THREE.DataTexture | null = null, PANELS: THREE.DataTexture | null = null, uploaded = -1, lastUpload = -Infinity;
/** the atlas is ~45 MB: while its fields are still arriving from the workers it is uploaded at most every UPLOAD_MS */
const UPLOAD_MS = 2000;
/** hand the atlas to the renderer (before the first frame builds the materials); refreshReliefShadow re-uploads it as it fills */
export function setReliefShadow(D: ReliefShadowData) {
  if (DATA !== D) {
    DATA = D;
    ATLAS = new THREE.DataTexture(D.atlas, D.aw, D.ah, THREE.RedFormat, THREE.UnsignedByteType);
    ATLAS.minFilter = ATLAS.magFilter = THREE.LinearFilter; ATLAS.wrapS = ATLAS.wrapT = THREE.ClampToEdgeWrapping; ATLAS.generateMipmaps = false; ATLAS.flipY = false; ATLAS.name = 'relief shadow atlas';
    ATLAS.unpackAlignment = 1;
    PANELS = new THREE.DataTexture(D.panelData.length ? D.panelData : new Float32Array(16), Math.max(4, D.panels.length * 4), 1, THREE.RGBAFormat, THREE.FloatType);
    PANELS.minFilter = PANELS.magFilter = THREE.NearestFilter; PANELS.generateMipmaps = false; PANELS.flipY = false; PANELS.name = 'relief shadow panels'; PANELS.needsUpdate = true;
  }
  refreshReliefShadow();
}
/** per frame (world.update): upload the atlas if it changed (throttled while fields are still arriving) */
export function refreshReliefShadow(now = performance.now()) {
  const D = DATA; if (!D || !ATLAS || uploaded === D.version) return;
  if (D.jobs.size > 0 && now - lastUpload < UPLOAD_MS) return;
  ATLAS.needsUpdate = true; uploaded = D.version; lastUpload = now;
}
/** GPU memory of the relief shadow textures (bytes) */
export const reliefShadowBytes = () => (DATA ? DATA.aw * DATA.ah + DATA.panels.length * 64 : 0);

/** TSL: the sun's visibility past the relief carving at world point p (1 lit … 0 in the carving's shadow); L = unit vector
 *  toward the sun (world). Built when a material compiles: before setReliefShadow it is the constant 1 */
export function reliefShadowNode(p: any, L: any): any {
  return Fn(() => {
    const D = DATA; if (!D || !D.panels.length || !ATLAS || !PANELS) return float(1);
    const A = ATLAS, PT = PANELS, AW = D.aw, AH = D.ah;
    const cx = int(clamp(floor(p.x.sub(D.gx0).div(D.gc)), 0, D.gw - 1)), cz = int(clamp(floor(p.z.sub(D.gz0).div(D.gc)), 0, D.gh - 1));
    // integer arithmetic throughout (a float carries 24 bits: the grid's texels lie beyond 2^24 in the linear index)
    const cell0 = cz.mul(int(D.gw)).add(cx).mul(int(SLOTS)).add(int(D.gridRow0 * AW)).toVar();
    const found = float(0).toVar(), u = float(0).toVar(), v = float(0).toVar(), w = float(0).toVar();
    const X = vec2(0, 0).toVar(), Z = vec2(0, 0).toVar(), rect = vec4(0, 0, 0, 0).toVar(), T = float(1).toVar(), hmax = float(0).toVar();
    // the slots fill in order, so the first empty one ends the list: a fragment far from any relief reads one texel
    const more = float(1).toVar();
    for (let k = 0; k < SLOTS; k++) If(more.greaterThan(0.5).and(found.lessThan(0.5)), () => {
      const idx = cell0.add(int(k)), id = textureLoad(A, ivec2(idx.mod(int(AW)), idx.div(int(AW)))).r.mul(255).add(0.5).floor();
      If(id.lessThan(0.5), () => { more.assign(0); });
      If(id.greaterThan(0.5), () => {
        const b = int(id).sub(int(1)).mul(int(4));
        const t0 = textureLoad(PT, ivec2(b, int(0))), t1 = textureLoad(PT, ivec2(b.add(int(1)), int(0))), t2 = textureLoad(PT, ivec2(b.add(int(2)), int(0))), t3 = textureLoad(PT, ivec2(b.add(int(3)), int(0)));
        const d = p.sub(t0.xyz), uu = d.x.mul(t1.x).add(d.z.mul(t1.y)), ww = d.x.mul(t1.z).add(d.z.mul(t1.w)), vv = d.y;
        const inU = uu.greaterThanEqual(t3.y).and(uu.lessThanEqual(t3.z)); // the points this panel holds (its slice of the wall)
        const inV = vv.greaterThanEqual(-REACH).and(vv.lessThanEqual(t2.w.mul(t0.w).add(REACH)));
        const inW = ww.greaterThanEqual(-0.05).and(ww.lessThanEqual(t3.x));
        If(inU.and(inV).and(inW), () => {
          found.assign(1); u.assign(uu); v.assign(vv); w.assign(ww); X.assign(t1.xy); Z.assign(t1.zw); rect.assign(t2); T.assign(t0.w); hmax.assign(t3.x);
        });
      });
    });
    const vis = float(1).toVar();
    If(found.greaterThan(0.5), () => {
      const su = L.x.mul(X.x).add(L.z.mul(X.y)), sv = L.y, sw = L.x.mul(Z.x).add(L.z.mul(Z.y));
      If(sw.greaterThan(0.004), () => {
        const hl = max(length(vec2(su, sv)), 1e-4), tEnd = min(hmax.sub(w).div(sw), float(REACH).div(hl)).toVar();
        If(tEnd.greaterThan(0), () => {
          const occ = float(0).toVar();
          Loop({ start: int(0), end: int(MARCH_STEPS), type: 'int', condition: '<', name: 'rs' } as any, ({ rs }: any) => {
            const t = tEnd.mul(float(rs).add(1)).div(MARCH_STEPS);
            // panel texel coordinates, held to the rectangle's one-texel border of zeros (nothing beyond it)
            const q = clamp(vec2(u.add(su.mul(t)), v.add(sv.mul(t))).div(T), vec2(-0.5, -0.5), rect.zw.add(0.5));
            const H = texture(A, rect.xy.add(q).div(vec2(AW, AH))).level(float(0)).r.mul(HSCALE);
            const soft = float(SOFT0).add(t.mul(SOFT_T)).mul(0.5); // centred on the ray's height (edges never reversed: soft > 0)
            occ.assign(max(occ, smoothstep(soft.negate(), soft, H.sub(w.add(sw.mul(t))).sub(BIAS))));
          });
          vis.assign(float(1).sub(occ));
        });
      });
    });
    return vis;
  })();
}
