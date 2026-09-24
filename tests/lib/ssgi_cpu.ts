// CPU mirror of the SSGI node's ambient occlusion (src/render/ssgi.ts: the visibility-bitmask horizon samples and the
// D-157 contact samples) on an analytic scene: a floor, boxes and vertical cylinders seen by a perspective camera, a
// full-resolution depth buffer (each texel's exact view-space point and normal), nearest-texel depth reads as the node
// does. The temporal noise (6 rotations × 4 offsets, accumulated by TRAA) is averaged by evaluating every frame.
// `reference` is the physical target: the cosine-weighted share of the hemisphere blocked within aoNearRadius, by rays.
export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]), norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x)), fract = (x: number) => x - Math.floor(x);

/** scene solids (world, y up): the floor y = 0, axis-aligned boxes, vertical cylinders standing on y0 */
export type Solid = { kind: 'box'; min: V3; max: V3 } | { kind: 'cyl'; x: number; z: number; r: number; y0: number; y1: number };
export interface Scene { solids: Solid[]; floor?: boolean }

/** nearest hit along a ray (t > eps): distance and outward normal */
export function raycast(S: Scene, o: V3, r: V3, tMax = 1e5): { t: number; n: V3 } | null {
  let best = tMax, bn: V3 | null = null;
  if (S.floor !== false && Math.abs(r[1]) > 1e-12) { const t = -o[1] / r[1]; if (t > 1e-6 && t < best) { best = t; bn = [0, 1, 0]; } }
  for (const s of S.solids) {
    if (s.kind === 'box') {
      let t0 = -Infinity, t1 = Infinity, ax0 = -1, sg0 = 0;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(r[a]) < 1e-12) { if (o[a] < s.min[a] || o[a] > s.max[a]) { t0 = Infinity; break; } continue; }
        let ta = (s.min[a] - o[a]) / r[a], tb = (s.max[a] - o[a]) / r[a], sg = -1;
        if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; }
        if (ta > t0) { t0 = ta; ax0 = a; sg0 = sg; }
        if (tb < t1) t1 = tb;
      }
      if (t0 <= t1 && t0 > 1e-6 && t0 < best && ax0 >= 0) { best = t0; bn = [0, 0, 0]; bn[ax0] = sg0; }
    } else {
      const dx = o[0] - s.x, dz = o[2] - s.z, A = r[0] * r[0] + r[2] * r[2];
      if (A > 1e-12) {
        const B = 2 * (dx * r[0] + dz * r[2]), C = dx * dx + dz * dz - s.r * s.r, D = B * B - 4 * A * C;
        if (D >= 0) {
          const t = (-B - Math.sqrt(D)) / (2 * A), y = o[1] + r[1] * t;
          if (t > 1e-6 && t < best && y >= s.y0 && y <= s.y1) { best = t; bn = norm([dx + r[0] * t, 0, dz + r[2] * t]); }
        }
      }
      if (Math.abs(r[1]) > 1e-12) { // top cap
        const t = (s.y1 - o[1]) / r[1], px = o[0] + r[0] * t - s.x, pz = o[2] + r[2] * t - s.z;
        if (t > 1e-6 && t < best && px * px + pz * pz <= s.r * s.r) { best = t; bn = [0, 1, 0]; }
      }
    }
  }
  return bn ? { t: best, n: bn } : null;
}

export interface Cam { W: number; H: number; fovDeg: number; eye: V3; yawDeg: number; pitchDeg: number }
export interface AOParams {
  sliceCount: number; stepCount: number; radius: number; expFactor: number; thickness: number; useLinearThickness: boolean;
  thicknessRef: number; aoNearRadius: number; nearSteps: number; aoIntensity: number;
  /** PĀRSA candidate fixes (off = the node as it is): the contact samples' own thickness (m, grows as the main one does) */
  nearThickness?: number;
}
export const HIGH: AOParams = { sliceCount: 2, stepCount: 8, radius: 12, expFactor: 2, thickness: 0.25, useLinearThickness: true, thicknessRef: 8, aoNearRadius: 1.2, nearSteps: 4, aoIntensity: 1 };

export function makeView(C: Cam, S: Scene) {
  const t = Math.tan((C.fovDeg * Math.PI) / 360), asp = C.W / C.H, p = (C.pitchDeg * Math.PI) / 180, yw = (C.yawDeg * Math.PI) / 180;
  const fwd: V3 = [-Math.sin(yw) * Math.cos(p), Math.sin(p), -Math.cos(yw) * Math.cos(p)], right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  const toViewDir = (w: V3): V3 => [dot(w, right), dot(w, up), -dot(w, fwd)];
  const toView = (w: V3): V3 => toViewDir(sub(w, C.eye));
  const rayDir = (u: number, v: number): V3 => norm(add(add(mul(right, (2 * u - 1) * t * asp), mul(up, (1 - 2 * v) * t)), fwd));
  const P: (V3 | null)[] = new Array(C.W * C.H), N: (V3 | null)[] = new Array(C.W * C.H), Wp: (V3 | null)[] = new Array(C.W * C.H);
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const r = rayDir((x + 0.5) / C.W, (y + 0.5) / C.H), h = raycast(S, C.eye, r, 5000), k = y * C.W + x;
    if (h) { const w = add(C.eye, mul(r, h.t)); Wp[k] = w; P[k] = toView(w); N[k] = toViewDir(h.n); } else { P[k] = null; N[k] = null; Wp[k] = null; }
  }
  const halfProjScale = (C.H / (t * 2)) * 0.5;
  return { C, P, N, Wp, halfProjScale, rayDir, toView, eye: C.eye };
}
export type View = ReturnType<typeof makeView>;

// three's TSL helpers, as the node calls them
const randTSL = (x: number, y: number) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
const ign = (x: number, y: number) => fract(52.9829189 * fract(x * 0.06711056 + y * 0.00583715));
const fastAcos = (v: number) => { let o = Math.abs(v) * -0.156583 + Math.PI / 2; o *= Math.sqrt(1 - Math.abs(v)); return v >= 0 ? o : Math.PI - o; };
const TEMP_ROT = [60, 300, 180, 240, 120, 0], SPATIAL = [0, 0.5, 0.25, 0.75];
const MAX_RAY = 32;
const popc = (b: number) => { let c = 0; b >>>= 0; while (b) { c += b & 1; b >>>= 1; } return c; };
/** the node's sector bitfield between two normalised horizons (WGSL: shift amounts are taken modulo 32) */
function sectorBits(fb0: number, fb1: number): number {
  const start = Math.floor(fb0 * MAX_RAY) >>> 0, ang = Math.ceil((fb1 - fb0) * MAX_RAY) >>> 0;
  if (ang <= 0) return 0;
  const mask = (0xffffffff >>> ((32 - ang) % 32)) >>> 0;
  return (mask << (start % 32)) >>> 0;
}

/** the node's (ao full, ao near) at pixel (x, y) for one frame (frameId selects the temporal rotation and offset) */
export function aoAt(V: View, A: AOParams, x: number, y: number, frameId: number): { ao: number; aoNear: number } | null {
  const { W, H } = V.C, k = y * W + x, vp = V.P[k], vn = V.N[k];
  if (!vp || !vn) return null;
  const tDir = TEMP_ROT[frameId % 6] / 360, tOff = SPATIAL[frameId % 4];
  const sx = x + 0.5, sy = y + 0.5, u = sx / W, v = sy / H;
  const noiseOffset = 0.25 * ((((sy - sx) | 0) & 3) >>> 0), noiseDir = ign(sx, sy);
  const jit = tDir * 0.02, initialRayStep = fract(noiseOffset + tOff) + randTSL((u + jit) * 2 - 1, (v + jit) * 2 - 1);
  const viewDir = norm(mul(vp, -1));
  let stepRadius = (A.radius * (W / 2)) / 16; stepRadius /= A.stepCount + 1;
  const radiusVS = Math.max(1, A.stepCount - 1) * stepRadius;
  const stepNear = (A.aoNearRadius * V.halfProjScale * 2) / Math.max(-vp[2], 1e-3);
  const fetch = (su: number, sv: number): V3 | null => { const ix = Math.floor(su * W), iy = Math.floor(sv * H); if (ix < 0 || iy < 0 || ix >= W || iy >= H) return null; return V.P[iy * W + ix]; };
  let ao = 0, aoNear = 0;
  for (let i = 0; i < A.sliceCount; i++) {
    const rot = (i + noiseDir + tDir) * (Math.PI / A.sliceCount);
    const sliceDir: V3 = [Math.cos(rot), Math.sin(rot), 0], tex = [sliceDir[0] / W, sliceDir[1] / H];
    const planeNormal = norm(cross(sliceDir, viewDir)), tangent = cross(viewDir, planeNormal);
    const projN = sub(vn, mul(planeNormal, dot(vn, planeNormal))), cosN = clamp(dot(norm(projN), viewDir), -1, 1);
    const n = -Math.sign(dot(projN, tangent)) * Math.acos(cosN);
    let global = 0, near = 0;
    const sampleOne = (right: boolean, off: number, thick: number, fromMain: boolean) => {
      const ud = right ? [1, -1] : [-1, 1], sd = right ? 1 : -1;
      const su = u + tex[0] * off * ud[0], sv = v + tex[1] * off * ud[1];
      if (su <= 0 || sv <= 0 || su >= 1 || sv >= 1) return false;
      const sp = fetch(su, sv); if (!sp) return true; // sky: Continue
      const d = sub(sp, vp), p2s = norm(d);
      const ltm = A.useLinearThickness ? Math.max(-sp[2] / A.thicknessRef, 1) : 1;
      const back = norm(sub(sub(sp, mul(viewDir, ltm * thick)), vp));
      let f = fastAcos(clamp(dot(p2s, viewDir), -1, 1)), b = fastAcos(clamp(dot(back, viewDir), -1, 1));
      f = clamp((sd * -f - (n - Math.PI / 2)) / Math.PI); b = clamp((sd * -b - (n - Math.PI / 2)) / Math.PI);
      const [lo, hi] = right ? [b, f] : [f, b];
      const bits = sectorBits(lo, hi);
      if (fromMain) global = (global | bits) >>> 0;
      if (len(d) < A.aoNearRadius) near = (near | bits) >>> 0;
      return true;
    };
    for (const right of [true, false]) {
      for (let s = 0; s < A.stepCount; s++) {
        const off = Math.pow(Math.abs((stepRadius * (s + initialRayStep)) / radiusVS), A.expFactor) * radiusVS;
        if (!sampleOne(right, Math.max(off, s + 1), A.thickness, true)) break;
      }
    }
    for (const right of [true, false]) {
      for (let s = 0; s < A.nearSteps; s++) {
        const tt = (s + fract(initialRayStep) + 0.5) / A.nearSteps;
        if (!sampleOne(right, Math.max(tt * tt * stepNear, s + 1), A.nearThickness ?? A.thickness, false)) break;
      }
    }
    ao += popc(global) / MAX_RAY; aoNear += popc(near) / MAX_RAY;
  }
  ao /= A.sliceCount; aoNear /= A.sliceCount;
  return { ao: Math.pow(1 - clamp(ao), A.aoIntensity), aoNear: Math.pow(1 - clamp(aoNear), A.aoIntensity) };
}

/** TRAA-accumulated (ao, aoNear): the mean over 24 frames (every rotation × offset pair) and a pixel neighbourhood */
export function aoMean(V: View, A: AOParams, x: number, y: number, r = 1): { ao: number; aoNear: number; n: number } {
  let a = 0, b = 0, n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let f = 0; f < 24; f++) {
    const q = aoAt(V, A, x + dx, y + dy, f); if (!q) continue; a += q.ao; b += q.aoNear; n++;
  }
  return { ao: a / Math.max(n, 1), aoNear: b / Math.max(n, 1), n };
}

/** physical reference: 1 − the cosine-weighted share of the hemisphere over the texel's world point blocked within R */
export function referenceAO(V: View, S: Scene, x: number, y: number, R: number, n = 4096): number {
  const k = y * V.C.W + x, w = V.Wp[k], nv = V.N[k]; if (!w || !nv) return 1;
  // world normal: invert the view basis through a hit ray (recompute from the scene)
  const h = raycast(S, V.eye, norm(sub(w, V.eye)), 1e5); const N = h ? h.n : [0, 1, 0] as V3;
  const o = add(w, mul(N, 1e-4));
  const t1: V3 = Math.abs(N[1]) < 0.9 ? norm(cross(N, [0, 1, 0])) : norm(cross(N, [1, 0, 0])), t2 = cross(N, t1);
  let blocked = 0; const g = Math.round(Math.sqrt(n));
  for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
    const u1 = (i + 0.5) / g, u2 = (j + 0.5) / g, rr = Math.sqrt(u1), ph = 2 * Math.PI * u2;
    const d = norm(add(add(mul(t1, rr * Math.cos(ph)), mul(t2, rr * Math.sin(ph))), mul(N, Math.sqrt(1 - u1))));
    if (raycast(S, o, d, R)) blocked++;
  }
  return 1 - blocked / (g * g);
}
