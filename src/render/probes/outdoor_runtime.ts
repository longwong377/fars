// The outdoor light field at run time (D-357; format and CPU mirror: outdoor.ts). One RGBA8 data texture read with
// textureLoad only (no sampler: the fragment stage's 16 are spoken for, B122), the regions as a uniform table; the lookup
// is the CPU mirror's (outdoor.ts lookupRegion) in TSL: the region holding the point (first match, a loop), the 2 × 2
// columns round the lookup point with the corners behind a wall left out (the town's cell-edge walls), each column's two
// layers round the point's height above that column's ground, validity-weighted, the corners above a column's roof left out;
// each probe's ambient cubes read for the normal in the region's axes.
// Sampled through probeAmbient (runtime.ts): the hemisphere light's irradiance and the post composite's skylight.
import * as THREE from 'three/webgpu';
import { uniform, uniformArray, textureLoad, ivec2, int, vec2, vec3, vec4, float, mix, max, min, clamp, floor, smoothstep, step, dot, abs, Fn, Loop } from 'three/tsl';
import { OutMeta, OUT_TEX_W, OUT_TEXELS, OUT_BIAS, OUT_VALID, A_S, A_U, TINT_MAX, afternoonWeight } from './outdoor';

let META: OutMeta | null = null, TEX: THREE.DataTexture | null = null, ROWS: any = null, DATA: Uint8Array | null = null;
/** the afternoon weight of the sun channel (0 morning … 1 afternoon), set per frame (setOutdoorSun) */
export const outdoorPm = uniform(0.5);
/** A/B (?outdoor=0, or setOutdoorEnabled before the shaders are built): 0 = the field is not looked up */
let ENABLED = typeof location === 'undefined' || new URLSearchParams(location.search).get('outdoor') !== '0';
export const outdoorOn = uniform(1);
export function setOutdoorEnabled(on: boolean) { ENABLED = on; }
export const outdoorMeta = () => META;
export const outdoorData = () => DATA;
const NROW = 6;

export async function loadOutdoor(base = '/'): Promise<OutMeta | null> {
  try {
    const [mj, bin] = await Promise.all([fetch(`${base}lightmaps/outdoor.json`), fetch(`${base}lightmaps/outdoor.lmz`)]);
    if (!mj.ok || !bin.ok) throw new Error(`HTTP ${mj.status}/${bin.status}`);
    const meta = await mj.json(); let buf = new Uint8Array(await bin.arrayBuffer());
    // gzip as written by the bake (a server may already have inflated it: the magic decides)
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if (buf.byteLength !== meta.width * meta.height * 4) throw new Error(`outdoor field ${buf.byteLength} B, meta says ${meta.width}×${meta.height}`);
    setOutdoorField(meta, buf);
  } catch (e) { console.warn('[outdoor light] no outdoor field; the open sky and D-309b outdoors', e); META = null; TEX = null; }
  return META;
}
export function setOutdoorField(meta: OutMeta | null, data: Uint8Array | null) {
  META = meta; DATA = data; TEX = null; ROWS = null; if (!meta || !data) return;
  const t = new THREE.DataTexture(data, meta.width, meta.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.name = 'outdoor light field'; t.needsUpdate = true;
  TEX = t;
  ROWS = uniformArray(meta.regions.flatMap(R => [
    new THREE.Vector4(R.c[0], R.c[1], Math.cos(R.theta), Math.sin(R.theta)),
    new THREE.Vector4(R.u0, R.v0, 1 / R.cell, R.cell),
    new THREE.Vector4(R.W, R.H, R.L, R.flags ? 1 : 0),
    new THREE.Vector4(R.y0, R.dy, R.gmin, R.grange),
    new THREE.Vector4(R.lo[0], R.lo[1], R.hi[0], R.hi[1]),
    new THREE.Vector4(R.edge, R.probeBase, R.colBase, R.cstep),
  ]), 'vec4');
}
/** per frame: which half of the day's sun the bounce takes (the direction toward the sun, world) */
export function setOutdoorSun(dir: { x: number; z: number }) { if (META) outdoorPm.value = afternoonWeight(dir.x, dir.z, META.sunAm, META.sunPm); }
export const outdoorBytes = () => (META ? META.width * META.height * 4 : 0);
export function outdoorSummary() { return META ? `outdoor light (C, D-357): ${META.regions.length} regions, ${(outdoorBytes() / 1048576).toFixed(1)} MB` : 'outdoor light: none'; }

/** TSL: the field at world p (normal n for the irradiance, `off` the direction the lookup point stands off along). S = the
 *  sky's irradiance colour, U = the horizontal direct sun's. Returns E (mixed with `hemi` by the weight) and the weight. */
export function outdoorAmbient(p: any, n: any, S: any, U: any, hemi: any, directSky = false, off: any = n): { E: any; w: any } {
  if (!META || !TEX || !ROWS || !ENABLED || !META.regions.length) return { E: hemi, w: float(0) };
  const T = TEX, V = ROWS, NR = META.regions.length, TW = OUT_TEX_W;
  const load = (idx: any) => { const y = floor(idx.div(TW)); return textureLoad(T, ivec2(int(idx.sub(y.mul(TW))), int(y))); };
  // the region holding p (first match; the regions do not overlap where it matters: the town's sites lie apart)
  const find = Fn(([pp]: [any]) => { const vi = float(0).toVar(), found = float(0).toVar();
    Loop(NR, ({ i }: { i: any }) => { const r0 = V.element(i.mul(NROW)), r1 = V.element(i.mul(NROW).add(1)), r2 = V.element(i.mul(NROW).add(2));
      const de = pp.x.sub(r0.x), dn = pp.z.negate().sub(r0.y), u = de.mul(r0.z).add(dn.mul(r0.w)), v = dn.mul(r0.z).sub(de.mul(r0.w));
      const fu = u.sub(r1.x).mul(r1.z), fv = v.sub(r1.y).mul(r1.z);
      const inside = step(0, fu).mul(step(fu, r2.x)).mul(step(0, fv)).mul(step(fv, r2.y));
      vi.addAssign(inside.mul(float(1).sub(found)).mul(float(i))); found.assign(max(found, inside)); });
    return vec2(vi, found); });
  const hit = find(p), base = int(hit.x).mul(NROW), inside = hit.y, row = (k: number) => V.element(base.add(k));
  const R0 = row(0), R1 = row(1), R2 = row(2), R3 = row(3), R4 = row(4), R5 = row(5);
  const loc = (x: any, z: any) => { const de = x.sub(R0.x), dn = z.negate().sub(R0.y); return vec2(de.mul(R0.z).add(dn.mul(R0.w)).sub(R1.x).mul(R1.z), dn.mul(R0.z).sub(de.mul(R0.w)).sub(R1.y).mul(R1.z)); };
  const q = p.add(off.mul(OUT_BIAS)), fp = loc(p.x, p.z), fq = loc(q.x, q.z);
  const W = R2.x, H = R2.y, L = R2.z;
  const gx = clamp(fq.x.sub(0.5), 0, W.sub(1.001)), gz = clamp(fq.y.sub(0.5), 0, H.sub(1.001));
  const i0 = min(floor(gx), W.sub(2)), j0 = min(floor(gz), H.sub(2)), tx = gx.sub(i0), tz = gz.sub(j0);
  const ci = step(i0.add(1), floor(clamp(fp.x, 0, W.sub(0.001)))), cj = step(j0.add(1), floor(clamp(fp.y, 0, H.sub(0.001))));
  const colAt = (a: any, b: any) => load(R5.z.add(j0.add(b).mul(W)).add(i0.add(a)));
  const c00 = colAt(0, 0), c10 = colAt(1, 0), c01 = colAt(0, 1), c11 = colAt(1, 1);
  const bits = (c: any) => { const f = floor(c.z.mul(255).add(0.5)); const e = f.sub(floor(f.div(2)).mul(2)); return vec2(e, floor(f.div(2))).mul(R2.w); };
  const b00 = bits(c00), b01 = bits(c01), b10 = bits(c10);
  const wX0 = b00.x, wX1 = b01.x, wZ0 = b00.y, wZ1 = b10.y; // the block's inner edges: x-edge at row j0 / j1, z-edge at column i0 / i1
  const xE = (r: any) => mix(wX0, wX1, r), zE = (c: any) => mix(wZ0, wZ1, c);
  const reach = (a: number, b: number) => {
    const sx = abs(float(a).sub(ci)), sz = abs(float(b).sub(cj));
    const diag = max(float(1).sub(xE(cj)).mul(float(1).sub(zE(float(a)))), float(1).sub(zE(ci)).mul(float(1).sub(xE(float(b)))));
    return float(1).sub(sx).mul(float(1).sub(sz)).add(sx.mul(float(1).sub(sz)).mul(float(1).sub(xE(cj)))).add(float(1).sub(sx).mul(sz).mul(float(1).sub(zE(ci)))).add(sx.mul(sz).mul(diag));
  };
  // the normal in the region's axes, and the weights of a cube's faces for it (Σ n_a² · face(sign n_a))
  const nu = n.x.mul(R0.z).sub(n.z.mul(R0.w)), nv = n.x.mul(R0.w).add(n.z.mul(R0.z)).negate(), ny = n.y;
  const pu = step(0, nu), pv = step(0, nv), py = step(0, ny), u2 = nu.mul(nu), v2 = nv.mul(nv), y2 = ny.mul(ny);
  const wH = vec4(u2.mul(pu), u2.mul(float(1).sub(pu)), v2.mul(pv), v2.mul(float(1).sub(pv))), wV = vec2(y2.mul(py), y2.mul(float(1).sub(py)));
  const face = (h: any, v: any, A: number) => dot(h.mul(h), wH).add(dot(v.mul(v), wV)).mul(A); // stored as sqrt(E / A)
  const acc = (vec4 as any)(0, 0, 0, 0).toVar(), accT = (vec4 as any)(0, 0, 0, 0).toVar(), accG = (vec2 as any)(0, 0).toVar();
  const pm = outdoorPm;
  const corner = (a: number, b: number, c: any) => {
    const wb = (a ? tx : float(1).sub(tx)).mul(b ? tz : float(1).sub(tz)).mul(reach(a, b));
    const g = R3.z.add(c.x.mul(255 * 256).add(c.y.mul(255)).div(65535).mul(R3.w)), ceil = mix(c.w.mul(255).mul(R5.w), float(1e4), step(0.999, c.w));
    accG.addAssign((vec2 as any)(wb.mul(g), wb));
    const hq = q.y.sub(g), hk = clamp(hq.sub(R3.x).div(R3.y), 0, L.sub(1)), k0 = min(floor(hk), L.sub(2)), fk = hk.sub(k0), above = step(ceil, hq);
    for (const [kk, wk] of [[k0, float(1).sub(fk)], [k0.add(1), fk]] as [any, any][]) {
      const pb = R5.y.add(kk.mul(H).add(j0.add(b)).mul(W).add(i0.add(a)).mul(OUT_TEXELS));
      const t0 = load(pb), t1 = load(pb.add(1)), t5 = load(pb.add(5)), w = wb.mul(wk).mul(t5.y).mul(float(1).sub(above));
      const eS = face(t0, t1.xy, A_S);
      let eU: any = float(0);
      if (!directSky) { const t2 = load(pb.add(2)), t3 = load(pb.add(3)), t4 = load(pb.add(4)); eU = mix(face(t2, t3.xy, A_U), face(t4, t3.zw, A_U), pm); }
      acc.addAssign(vec4(eS, eU, t5.x, 1).mul(w));
      accT.addAssign(vec4(t1.z.mul(TINT_MAX), t1.w.mul(TINT_MAX), 0, 0).mul(w));
    }
  };
  corner(0, 0, c00); corner(1, 0, c10); corner(0, 1, c01); corner(1, 1, c11);
  const wsum = acc.w, inv = float(1).div(max(wsum, 1e-6)), eS = acc.x.mul(inv), eU = acc.y.mul(inv), tr = accT.x.mul(inv), tb = accT.y.mul(inv), fb = clamp(acc.z.mul(inv), 0, 1);
  const ground = accG.x.div(max(accG.y, 1e-6)), hy = p.y.sub(ground);
  const ramp = (a: any, b: any, x: any) => clamp(x.sub(a).div(max(b.sub(a), 1e-6)), 0, 1);
  const wy = ramp(R4.x, R4.y, hy).mul(float(1).sub(ramp(R4.z, R4.w, hy)));
  const eu = min(min(fp.x, W.sub(fp.x)), min(fp.y, H.sub(fp.y))).mul(R1.w), we = clamp(eu.div(max(R5.x, 1e-3)), 0, 1);
  const w = inside.mul(wy).mul(we).mul(smoothstep(OUT_VALID[0], OUT_VALID[1], wsum)).mul(outdoorOn);
  const tint = vec3(tr, max(float(1).sub(tr.mul(0.2126)).sub(tb.mul(0.0722)).div(0.7152), 0), tb);
  const E = directSky ? S.mul(eS).mul(float(1).sub(fb)) : S.mul(mix(vec3(1, 1, 1), tint, fb)).mul(eS).add(U.mul(tint).mul(eU));
  return { E: mix(hemi, E, w), w };
}
