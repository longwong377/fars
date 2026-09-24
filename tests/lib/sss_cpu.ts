// CPU mirror of the screen-space sun contact shadows (three r186 SSSNode and the patched src/render/sss.ts, D-188) on an
// analytic scene: a ground plane (y = 0) and optional walls, a perspective camera, a full-resolution depth buffer (each
// texel's exact view-space point) and the half-resolution march. With nothing in the scene that can shadow the sunlit
// surfaces, every pixel it marks shadowed is a false hit (self-shadowing).
export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));
/** a scene plane: points x with dot(n, x) = d, facing n; the ground and walls */
export interface Plane { n: V3; d: number }
export interface SSSCase { W: number; H: number; fovDeg: number; eye: V3; pitchDeg: number; sunAltDeg: number; sunAzDeg: number; planes: Plane[]; maxDistance: number; thickness: number; quality: number; scale: number; seed?: number; jitter?: [number, number] }
/** fraction of the sunlit, non-sky half-resolution pixels marked shadowed, by the original node ('orig') or the patched one */
export function falseShadowRate(C: SSSCase, mode: 'orig' | 'patched'): { lit: number; shadowed: number; rate: number } {
  const { W, H } = C, t = Math.tan((C.fovDeg * Math.PI) / 360), asp = W / H, p = (C.pitchDeg * Math.PI) / 180;
  // camera basis (world): forward along −z pitched, right +x, up
  const fwd: V3 = [0, Math.sin(p), -Math.cos(p)], right: V3 = [1, 0, 0], up = cross(right, fwd);
  const toView = (w: V3): V3 => { const q = sub(w, C.eye); return [dot(q, right), dot(q, up), -dot(q, fwd)]; }; // view: −z forward
  const rayDir = (u: number, v: number): V3 => norm(add(add(mul(right, (2 * u - 1) * t * asp), mul(up, (1 - 2 * v) * t)), fwd)); // uv y down
  const hit = (u: number, v: number): { P: V3; n: V3 } | null => {
    const r = rayDir(u, v); let best = Infinity, bn: V3 | null = null;
    for (const pl of C.planes) { const den = dot(pl.n, r); if (Math.abs(den) < 1e-9) continue; const s = (pl.d - dot(pl.n, C.eye)) / den; if (s > 0.05 && s < best && s < 5000) { best = s; bn = pl.n; } }
    return bn ? { P: toView(add(C.eye, mul(r, best))), n: bn } : null;
  };
  // full-resolution depth buffer: the view-space point at each texel centre
  const buf: (V3 | null)[] = new Array(W * H);
  // `jitter` (px): the depth rendered with a sub-pixel projection offset (TRAA) that the reconstruction does not know
  const [jx, jy] = C.jitter ?? [0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = hit((x + 0.5 + jx) / W, (y + 0.5 + jy) / H); buf[y * W + x] = h ? h.P : null; }
  const texel = (u: number, v: number) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(H - 1, Math.max(0, Math.floor(v * H))); return { P: buf[y * W + x], u: (x + 0.5) / W, v: (y + 0.5) / H }; };
  // the point on the view ray through (u, v) at view depth z (getViewPosition with a texel's depth at another uv)
  const atDepth = (u: number, v: number, z: number): V3 => { const r = rayDir(u, v), rv = toView(add(C.eye, r)), o = toView(C.eye); const dv = sub(rv, o); const s = z / dv[2]; return mul(dv, s); };
  const alt = (C.sunAltDeg * Math.PI) / 180, az = (C.sunAzDeg * Math.PI) / 180;
  const sunW: V3 = [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
  const sunV = sub(toView(add(C.eye, sunW)), toView(C.eye));
  // project a view point to half-resolution pixel coordinates
  const Wh = Math.round(W * C.scale), Hh = Math.round(H * C.scale);
  const proj = (P: V3) => { const x = P[0] / (-P[2] * t * asp), y = P[1] / (-P[2] * t); return [((x + 1) / 2) * Wh, ((1 - y) / 2) * Hh] as [number, number]; };
  let seed = C.seed ?? 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let lit = 0, shadowed = 0;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < Wh; i++) {
    const u = (i + 0.5) / Wh, v = (j + 0.5) / Hh, h = hit(u, v); if (!h) continue;
    const nW = h.n; if (dot(nW, sunW) <= 0.05) continue; // only sunlit faces
    lit++;
    let P0: V3, d0: [number, number], nPlane: V3 | null = null, tol = 0;
    if (mode === 'orig') { const T = texel(u, v); if (!T.P) continue; P0 = atDepth(u, v, T.P[2]); d0 = [i + 0.5, j + 0.5]; }
    else {
      const T = texel(u, v); if (!T.P) continue; P0 = T.P; d0 = [T.u * Wh, T.v * Hh];
      const nV = norm(sub(toView(add(C.eye, nW)), toView(C.eye))); nPlane = nV; tol = 0.01 + 0.002 * -P0[2];
    }
    const P1 = add(P0, mul(sunV, C.maxDistance)), d1 = proj(P1);
    const xl = d1[0] - d0[0], yl = d1[1] - d0[1], total = Math.hypot(xl, yl), steps = Math.floor(Math.max(Math.abs(xl), Math.abs(yl)) * C.quality);
    const off = rnd() + rnd();
    for (let k = 0; k < steps; k++) {
      const xy: [number, number] = [d0[0] + (xl / steps) * (k + off), d0[1] + (yl / steps) * (k + off)];
      if (xy[0] < 0 || xy[0] > Wh || xy[1] < 0 || xy[1] > Hh) break;
      let su = xy[0] / Wh, sv = xy[1] / Hh; const T = texel(su, sv); if (!T.P) continue;
      if (mode === 'patched') { su = T.u; sv = T.v; }
      const s = Math.min(1, Math.hypot(su * Wh - d0[0], sv * Hh - d0[1]) / Math.max(total, 1e-6));
      const ray = add(P0, mul(sub(P1, P0), s)), delta = -(ray[2] - T.P[2]);
      const above = nPlane ? dot(sub(T.P, P0), nPlane) : Infinity;
      if (delta > 0 && delta < C.thickness && above > tol) { shadowed++; break; }
    }
  }
  return { lit, shadowed, rate: shadowed / Math.max(lit, 1) };
}
