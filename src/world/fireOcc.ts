// Fire-light occlusion (D-222, BLOCKERS B24): the Terrace's fires stand where the architecture puts them, so what each
// fire's light can reach is baked once, offline, against the architecture's parts (tools/build_fire_occ.ts): per fire an
// octahedral map of the distance along each direction from the light to the middle of the first solid it meets (the
// "second-depth" midpoint between the ray's entry into and exit from that solid, capped at MID_CAP beyond the entry, so
// the lit face sits well in front of the stored depth and needs almost no bias). All the maps share one atlas texture, so
// every fire light in a material costs one sampled-texture binding in total (the shadow-casting point lights needed a
// cube map each and broke WebGPU's 16-texture limit at 12 lights: B24 approach 2).
// Only the Terrace's fixed fires are baked; the town's hearths and anything that moves (people, props) cast no fire
// shadow. The runtime multiplies each point light's colour by the lookup (fire.ts), after the room mask (D-216).
import * as THREE from 'three/webgpu';
import { float, vec2, ivec2, abs, floor, fract, clamp, length, step, positionWorld, normalWorld, max, min, mix, texture } from 'three/tsl';

/** texels along a tile's side (an octahedral map: ~1.4° per texel at 128) */
export const OCC_TILE = 128;
/** tiles per atlas row */
export const OCC_COLS = 8;
/** farthest distance stored (m): beyond the brazier's cut-off (22 m × 2.2 = 48.4 m), so "nothing hit" reads as lit */
export const OCC_FAR = 60;
/** the stored depth lies at most this far beyond the first surface (m): halfway into a 0.6 m parapet, 1 m into a slab */
export const MID_CAP = 1;
/** the shading point is moved this far along its normal before the lookup (m), and compared with this bias (m + × r) */
export const OCC_NORMAL_OFFSET = 0.04, OCC_BIAS = 0.02, OCC_BIAS_R = 0.01;
/** slope-scaled bias (session 8): a texel spans ~r·OCC_SLOPE across the ray, so on a surface the light grazes at angle θ from
 *  its normal the surface's own distance varies by ~r·OCC_SLOPE·tan θ within one texel (and its PCF neighbour); without it the
 *  open floor round a brazier (light 1.37 m up) was 11 % falsely shadowed in the octahedral texels' diamonds (brazier-close
 *  render: rows of triangles). tan θ is capped (OCC_TAN_MAX) and the whole bias kept inside MID_CAP, so an occluder a few
 *  decimetres in front of a surface still shades it */
export const OCC_SLOPE = 0.06, OCC_TAN_MAX = 12, OCC_BIAS_MAX = 0.9;
/** the depth bias (m) at distance r for a surface whose normal makes cos θ with the light direction */
export function occBias(r: number, cosT: number): number {
  const c = Math.max(Math.abs(cosT), 1e-3), tan = Math.min(Math.sqrt(Math.max(0, 1 - c * c)) / c, OCC_TAN_MAX);
  return Math.min(OCC_BIAS + OCC_BIAS_R * r + OCC_SLOPE * r * tan, OCC_BIAS_MAX);
}

/** octahedral encoding (y up): unit direction → [0, 1]² */
export function octEncode(x: number, y: number, z: number): [number, number] {
  const a = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1; let u = x / a, v = z / a;
  if (y < 0) { const su = u >= 0 ? 1 : -1, sv = v >= 0 ? 1 : -1; const nu = (1 - Math.abs(v)) * su, nv = (1 - Math.abs(u)) * sv; u = nu; v = nv; }
  return [u * 0.5 + 0.5, v * 0.5 + 0.5];
}
/** octahedral decoding: [0, 1]² → unit direction (y up) */
export function octDecode(s: number, t: number): [number, number, number] {
  const u = s * 2 - 1, v = t * 2 - 1, y = 1 - Math.abs(u) - Math.abs(v);
  let x = u, z = v;
  if (y < 0) { x = (1 - Math.abs(v)) * (u >= 0 ? 1 : -1); z = (1 - Math.abs(u)) * (v >= 0 ? 1 : -1); }
  const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
}

/** what a ray tracer must answer for the bake (TraceScene: tools/build_fire_occ.ts) */
export interface OccTracer {
  intersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin?: number, tmax?: number): { t: number } | null;
  inside(x: number, y: number, z: number, pad?: number): boolean;
}
/** one fire's tile: distances (m) per texel, row-major OCC_TILE × OCC_TILE; null when the light sits inside a solid */
export function bakeTile(tr: OccTracer, lx: number, ly: number, lz: number): Float32Array | null {
  if (tr.inside(lx, ly, lz)) return null;
  const out = new Float32Array(OCC_TILE * OCC_TILE);
  for (let j = 0; j < OCC_TILE; j++) for (let i = 0; i < OCC_TILE; i++) {
    const [dx, dy, dz] = octDecode((i + 0.5) / OCC_TILE, (j + 0.5) / OCC_TILE);
    const h1 = tr.intersect(lx, ly, lz, dx, dy, dz, 1e-4, OCC_FAR);
    let d = OCC_FAR;
    if (h1) { const t1 = h1.t; const h2 = tr.intersect(lx + dx * t1, ly + dy * t1, lz + dz * t1, dx, dy, dz, 1e-3, MID_CAP * 2);
      d = Math.min(t1 + (h2 ? h2.t / 2 : MID_CAP), t1 + MID_CAP, OCC_FAR); }
    out[j * OCC_TILE + i] = d;
  }
  return out;
}

/** the baked atlas as the runtime holds it */
export interface FireOcc { tile: number; cols: number; rows: number; data: Float32Array; fires: { kind: string; pos: [number, number, number] }[]; partsHash?: string }
/** the tile of the fire whose light stands at (x, y, z), or −1 */
export function tileOf(occ: FireOcc | null, x: number, y: number, z: number): number {
  if (!occ) return -1;
  for (let i = 0; i < occ.fires.length; i++) { const p = occ.fires[i].pos; if (Math.abs(p[0] - x) < 0.02 && Math.abs(p[1] - y) < 0.02 && Math.abs(p[2] - z) < 0.02) return i; }
  return -1;
}
/** CPU mirror of the shader's lookup (nearest texel, no filtering): 1 lit, 0 shadowed */
export function occAt(occ: FireOcc, tile: number, lx: number, ly: number, lz: number, px: number, py: number, pz: number, nx = 0, ny = 0, nz = 0): number {
  if (tile < 0) return 1;
  const x = px + nx * OCC_NORMAL_OFFSET - lx, y = py + ny * OCC_NORMAL_OFFSET - ly, z = pz + nz * OCC_NORMAL_OFFSET - lz, r = Math.hypot(x, y, z) || 1e-6;
  const [s, t] = octEncode(x / r, y / r, z / r), T = occ.tile;
  const i = Math.min(T - 1, Math.max(0, Math.floor(s * T))), j = Math.min(T - 1, Math.max(0, Math.floor(t * T)));
  const d = occ.data[((Math.floor(tile / occ.cols) * T + j) * occ.cols * T) + (tile % occ.cols) * T + i];
  const cosT = nx || ny || nz ? (x * nx + y * ny + z * nz) / r : 1;
  return r - occBias(r, cosT) <= d ? 1 : 0;
}

let OCC: FireOcc | null = null;
let TEX: THREE.DataTexture | null = null;
/** load public/generated/fire_occ.{json,f16}; without them every fire light is unoccluded (as before D-222) */
export async function loadFireOcc(base: string): Promise<FireOcc | null> {
  try {
    const [j, b] = await Promise.all([fetch(base + 'generated/fire_occ.json'), fetch(base + 'generated/fire_occ.f16')]);
    if (!j.ok || !b.ok) return null;
    const meta = await j.json(), h = new Uint16Array(await b.arrayBuffer()), data = new Float32Array(h.length);
    for (let i = 0; i < h.length; i++) data[i] = THREE.DataUtils.fromHalfFloat(h[i]);
    OCC = { ...meta, data }; return OCC;
  } catch { return null; }
}
export function fireOcc(): FireOcc | null { return OCC; }
export function setFireOcc(o: FireOcc | null) { OCC = o; TEX = null; }
function occTexture(): THREE.DataTexture {
  if (TEX) return TEX;
  const o = OCC, W = o ? o.cols * o.tile : 1, H = o ? o.rows * o.tile : 1;
  const t = new THREE.DataTexture(o ? o.data : new Float32Array([OCC_FAR]), W, H, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; TEX = t; return t;
}
/** TSL: 1 where the light at `lightPos` (uniform vec3) reaches the shaded point, 0 in the shade of the architecture, a
 *  bilinear blend of four texel tests between (percentage-closer filtering); `tile` (uniform float) < 0 → 1 */
export function fireOccNode(lightPos: any, tile: any) {
  const tex = texture(occTexture()), T = OCC?.tile ?? 1, cols = OCC?.cols ?? 1;
  const d = positionWorld.add(normalWorld.mul(OCC_NORMAL_OFFSET)).sub(lightPos), r = max(length(d), 1e-4), n = d.div(r);
  const a = abs(n.x).add(abs(n.y)).add(abs(n.z)), p = vec2(n.x, n.z).div(a);
  // the lower hemisphere folds over the diagonals; step, not select (no runtime select under TRAA: HANDOFF gotchas)
  const sg = vec2(step(0, p.x).mul(2).sub(1), step(0, p.y).mul(2).sub(1));
  const fold = vec2(float(1).sub(abs(p.y)), float(1).sub(abs(p.x))).mul(sg);
  const lower = step(n.y, 0), q = mix(p, fold, lower).mul(0.5).add(0.5);
  const f = q.mul(T).sub(0.5), i0 = floor(f), w = fract(f);
  const c = max(abs(normalWorld.dot(n)), 1e-3), tanT = min(float(1).sub(c.mul(c)).max(0).sqrt().div(c), OCC_TAN_MAX);
  const tx = floor(tile.mod(cols)).mul(T), ty = floor(tile.div(cols)).mul(T), bias = min(r.mul(OCC_BIAS_R).add(OCC_BIAS).add(r.mul(tanT).mul(OCC_SLOPE)), OCC_BIAS_MAX);
  const tap = (ox: number, oy: number) => {
    const c = clamp(i0.add(vec2(ox, oy)), 0, T - 1);
    const s = tex.load(ivec2(c.x.add(tx).toInt(), c.y.add(ty).toInt())).r;
    return step(r.sub(bias), s);
  };
  const v = mix(mix(tap(0, 0), tap(1, 0), w.x), mix(tap(0, 1), tap(1, 1), w.x), w.y);
  return mix(v, float(1), step(tile, -0.5));
}
