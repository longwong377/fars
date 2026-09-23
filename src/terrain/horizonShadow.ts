// The terrain horizon as a shadow term in shading (D-156; horizonMap.ts holds the data). Per frame the sky system bakes,
// for the sun's and the moon's current azimuth, small RGBA16F atlases (the three levels side by side):
//  • the sun: the two-line skyline model (e0, k1, e50, k2) per texel, with the texels' reference heights (the world's
//    apparent y; the sky system keeps them in the moon atlas's B channel): e(y') = max(e0 − k1·y', e50 − k2·(y' − 50)),
//    y' = y − R;
//  • the moon: the chord (e0, slope, reference y, 1): e(y) = e0 + slope·(y − R).
// These nodes return the fraction of the body's disc above the skyline at a world position: one or two bilinear fetches
// per level, the levels blended across their edges (arithmetic masks only: no select(), D-012), the body's altitude
// corrected for the tilt of the local vertical (distance / R), and a smoothstep over the disc (0.53°).
import * as THREE from 'three/webgpu';
import { Fn, texture, vec2, float, max, abs, clamp, mix, smoothstep, positionWorld } from 'three/tsl';
import { EARTH_R, SUN_RADIUS_DEG, HORIZON_OPEN, toHalf, type HorizonLevelMeta } from './horizonMap';

const atlasSize = (levels: HorizonLevelMeta[]): [number, number] => [levels.reduce((s, L) => s + L.n, 0), Math.max(...levels.map(L => L.n))];
/** a DataTexture sized for the atlas, filled "open" (no occluder) so shading before the map loads is unshadowed.
 *  `kind`: 'lines' (e0, k1, e50, k2), 'chord' (e0, slope, y_R, 1) or 'ref' (R channel: y_R) */
export function horizonAtlasTexture(levels: HorizonLevelMeta[], kind: 'lines' | 'chord' | 'ref'): THREE.DataTexture {
  const [W, H] = atlasSize(levels), open = toHalf(HORIZON_OPEN), one = toHalf(1);
  let t: THREE.DataTexture;
  if (kind === 'ref') t = new THREE.DataTexture(new Uint16Array(W * H), W, H, THREE.RedFormat, THREE.HalfFloatType);
  else {
    const d = new Uint16Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { d[4 * i] = open; d[4 * i + 1] = 0; d[4 * i + 2] = kind === 'lines' ? open : 0; d[4 * i + 3] = kind === 'lines' ? 0 : one; }
    t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  }
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.flipY = false;
  t.name = `terrain horizon (${kind})`; t.needsUpdate = true;
  return t;
}

/** `ref` (lines only): the atlas holding the texels' reference heights, in channel `refChannel` (default 'r': a 'ref'
 *  atlas; the sky system passes the moon's chord atlas, channel 'b', so every lit material binds 3 textures for the air
 *  and the horizon, not 4: WebGPU's default limit is 16 sampled textures per stage, D-156) */
export interface HorizonAtlases { levels: HorizonLevelMeta[]; tex: THREE.DataTexture; kind: 'lines' | 'chord'; ref?: THREE.DataTexture; refChannel?: 'r' | 'b' }
/** TSL: visibility (0..1) of a body's disc at world position `p` (default: the fragment's). `altDeg`: the body's apparent
 *  altitude (deg) at the grid origin; `dir`: its unit world direction (the local tilt uses its horizontal part).
 *  `use`: the level indices sampled (default all; the air samples only the coarse ones: its weighting is smooth). */
export function horizonVisibility(A: HorizonAtlases, altDeg: any, dir: any, p: any = positionWorld, use?: number[]): any {
  const [W, H] = atlasSize(A.levels), idx = use ?? A.levels.map((_, i) => i);
  return Fn(() => {
    const x = p.x, z = p.z, y = p.y;
    const e: any[] = [], m: any[] = [];
    for (const l of idx) {
      const L = A.levels[l], cell = (2 * L.half) / L.n, u0 = A.levels.slice(0, l).reduce((s, q) => s + q.n, 0), cx = L.cx ?? 0, cz = L.cz ?? 0;
      m.push(max(abs(x.sub(cx)), abs(z.sub(cz))));
      // continuous texel coordinates (texel i's centre at i + 0.5), clamped inside the level's tile
      const gx = clamp(x.sub(cx).add(L.half).div(cell), 0.5, L.n - 0.5), gz = clamp(z.sub(cz).add(L.half).div(cell), 0.5, L.n - 0.5);
      const uv = vec2(gx.add(u0).div(W), gz.div(H)), s = texture(A.tex, uv);
      if (A.kind === 'chord') e.push(s.r.add(s.g.mul(y.sub(s.b))));
      else if (L.flat) e.push(s.r);
      else { const R = texture(A.ref!, uv), yr = y.sub(A.refChannel === 'b' ? R.b : R.r); e.push(max(s.r.sub(s.g.mul(yr)), s.b.sub(s.a.mul(yr.sub(50))))); }
    }
    // level weights: the finest level up to 10 cells from its edge, blended to the next over 8 cells (horizonMap.levelAt)
    let out: any = e[e.length - 1];
    for (let j = idx.length - 2; j >= 0; j--) {
      const L = A.levels[idx[j]], cell = (2 * L.half) / L.n;
      out = mix(out, e[j], float(1).sub(smoothstep(L.half - 10 * cell, L.half - 2 * cell, m[j])));
    }
    // the body's altitude at (x, z): the local vertical tilts away from the grid origin by distance / R
    const tilt = dir.x.mul(x).add(dir.z.mul(z)).div(max(float(1).sub(dir.y.mul(dir.y)).sqrt(), 0.05)).mul(180 / Math.PI / EARTH_R);
    return smoothstep(out.sub(SUN_RADIUS_DEG), out.add(SUN_RADIUS_DEG), altDeg.add(tilt));
  })();
}
