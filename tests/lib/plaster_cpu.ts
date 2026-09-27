// CPU mirror of the mud-plastered wall of src/render/materials.ts layer() (D-188 plaster work, D-285 plastering campaign and rain
// wash), per pixel on a vertical wall as the shader evaluates it: the fine mottle, the broad tone with its repair patches, the
// micro grain, the float arcs, the lifts and bays with their overlap ridges, the rain wash and the run-off below the top; the
// height field (bump octaves, micro, seams, rills) differentiated over the pixel (the shader's screen-space derivative) into a
// shading normal; a Lambert sun + sky, AgX, linear Y out. Left out: the shrinkage cracks (1.2 mm, a third of the wall: under a
// pixel beyond ~2 m, their mean darkening < 1 %), the skirting coat and foot band (patches are taken above them). Not bit-exact
// where the shader uses Worley noise (the float arcs: a jittered grid with its own hash, statistically the same).
import { mxNoise3, hash12 } from './mx_noise_cpu';
import { ashlarCells, rot, agxGrey, runoffAt, smoothstep } from './stone_cpu';
import { TONE_OCTAVES, TONE_NORM, TONE_OFFSETS, PATCH, MX_NOISE_SD, type SurfaceDef } from '../../src/render/materials';
import { srgbToLinear } from '../../src/core/colour';

const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const bandLimit = (fp: number, lambda: number) => 1 - smoothstep(0.15, 0.35, fp / lambda);
const bandCover = (d: number, px: number, hw: number) => { const h = px / 2; return clamp(Math.max(0, Math.min(hw, d + h) - Math.max(-hw, d - h)) / px, 0, 1); };

/** a jittered-grid 3-D Worley F1 distance (cell units) */
function worley3(x: number, y: number, z: number) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z); let best = 1e9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const a = X + i, b = Y + j, c = Z + k;
    const cx = a + hash12(a + 0.13, b + 7.7 * c), cy = b + hash12(a + 3.1 * c, b + 0.9), cz = c + hash12(c + 5.3, a + 1.7 * b);
    best = Math.min(best, Math.hypot(cx - x, cy - y, cz - z));
  }
  return best;
}

let d285 = true;
/** D-285 on (the shipped surfaces) or off (before D-285), for before/after comparisons */
export function setPlaster285(on: boolean) { d285 = on; }

/** the wall's frame: x = m along the face (= t in the shader), y = m above the wall's base (world y = base + y), z = the face's
 *  out-of-plane coordinate. World position (x, base + y, z): the face lies in a plane of constant z with t = x (normal +z) */
export interface PlasterWall { base: number; top: number; z: number }

/** albedo factor and height (m) at a point, fp = |fwidth(p)| (m) */
function albHeight(d: SurfaceDef, W: PlasterWall, x: number, y: number, fp: number) {
  const wy = W.base + y, [rx, ry, rz] = rot(x, wy, W.z);
  const ns = d.noiseScale, na = d.noiseAmp;
  let f = 1 + mxNoise3(rx * ns * 9, ry * ns * 9, rz * ns * 9) * na * 0.12 * bandLimit(fp, 1 / (ns * 9));
  if (d.tone) {
    let t = 0; TONE_OCTAVES.forEach(([lam, w], i) => { const o = TONE_OFFSETS[i]; t += w * mxNoise3(rx / lam + o[0], ry / lam + o[1], rz / lam + o[2]) * bandLimit(fp, lam); });
    let g = 1 + t * d.tone.sd * TONE_NORM;
    if (d.tone.patch) {
      const n = mxNoise3(rx / PATCH.lambda + PATCH.off[0], ry / PATCH.lambda + PATCH.off[1], rz / PATCH.lambda + PATCH.off[2]) + mxNoise3(rx / PATCH.wobble + PATCH.off2[0], ry / PATCH.wobble + PATCH.off2[1], rz / PATCH.wobble + PATCH.off2[2]) * PATCH.wAmp;
      g *= 1 + smoothstep(PATCH.lo, PATCH.hi, n) * d.tone.patch;
    }
    f *= Math.max(0.2, g);
  }
  let h = 0;
  if (d.bump) {
    const k = d.bump.freq, b1 = 1 - smoothstep(0.15, 0.35, fp * k), b2 = 1 - smoothstep(0.15, 0.35, fp * k * 5.3);
    h += mxNoise3(rx * k, ry * k, rz * k) * d.bump.amp * b1 + mxNoise3(rx * k * 5.3, ry * k * 5.3, rz * k * 5.3) * d.bump.amp * 0.35 * b2;
  }
  if (d.micro) {
    const fade = 1 - smoothstep(0.15, 0.35, fp * d.micro.freq), q = d.micro.freq;
    h += mxNoise3(rx * q, ry * q, rz * q) * d.micro.amp * fade;
    f *= 1 + mxNoise3(rx * q * 1.9 + 7.3, ry * q * 1.9 + 7.3, rz * q * 1.9 + 7.3) * (d.micro.alb ?? 0.04) * fade;
  }
  if (d.plasterWork?.float) { // the float arcs (world p, unrotated)
    const F1 = worley3(x / 0.45 + 5.3, wy / 0.45 + 1.7, W.z / 0.45 + 9.1) * 0.45, ring = Math.abs(fract(F1 / 0.05) * 2 - 1);
    const vis = (1 - smoothstep(0.12, 0.3, fp / 0.05)) * smoothstep(-0.1, 0.35, mxNoise3(x / 1.3 + 2.2, wy / 1.3 + 8.4, W.z / 1.3 + 0.6)) * d.plasterWork.float;
    f *= 1 + (ring - 0.5) * vis * 0.05; h += (1 - ring) * 0.00025 * vis;
  }
  const PW = d.plasterWeather;
  if (PW && d285) {
    const wob = mxNoise3(rx * ns * 1.7, ry * ns * 1.7, rz * ns * 1.7) * (0.07 / MX_NOISE_SD * 0.5); // the mottle's ~1 m octave
    const L = ashlarCells(x + wob, y + wob * 0.8, { course: (PW.lift[0] + PW.lift[1]) / 2, block: PW.bay, width: 0, dark: 0, vary: { course: PW.lift, jitter: 1.0 } });
    const b1 = hash12(L.blk + 0.37, L.c + 11.3), b2 = hash12(L.blk * 0.71 + 19.1, L.c + 3.3), b3 = hash12(L.c * 1.618 + 5.1, L.blk + 2.9);
    const dE = Math.min(L.dBed, L.dHead), feather = smoothstep(0, 0.4, dE);
    const g = (b1 + b2 - 1) * PW.sd * Math.sqrt(6) * feather, ch = (b3 - 0.5) * 2 * PW.chroma * feather;
    f *= 1 + g + 0.2126 * ch - 0.0722 * 1.4 * ch; // luminance of (1+g+ch, 1+g, 1+g−1.4ch)
    const Hd = PW.hand, ang = Math.PI / 4 + (hash12(L.blk + 7.7, L.c + 1.3) - 0.5) * 1.75, ca = Math.cos(ang), sa = Math.sin(ang);
    const u = x * ca + y * sa, v = y * ca - x * sa, zS = u * 0.41 + v * 0.29;
    const n1 = mxNoise3(u / Hd.len + b1 * 37, v / Hd.wid + b2 * 19, zS) * bandLimit(fp, Hd.wid);
    const n2 = mxNoise3(u / (Hd.len / 2.8) + b2 * 23, v / (Hd.wid / 2.8) + b1 * 11, zS * 2.8 + 5.1) * bandLimit(fp, Hd.wid / 2.8);
    const rel = n1 + n2 * 0.4;
    h += rel * Hd.amp / MX_NOISE_SD;
    const mot = n1 + n2 * 0.6; // session 11: the relief's noises (the coat lighter on its ridges)
    f *= 1 + mot * Hd.mottle / (MX_NOISE_SD * Math.hypot(1, 0.6));
    const seam = bandCover(dE, fp / Math.SQRT2, 0.0125) * (hash12(L.blk + 5.3, L.c + 0.7) >= 0.5 ? 1 : 0);
    if (PW.seam > 0) { f *= 1 - seam * PW.seam; h += seam * 0.0008; }
  }
  if (d.runoff) f *= runoffAt(d, x, wy, W.z, W.top);
  const below = W.top - wy;
  if (PW && d285 && d.runoff && below >= 0) { // the rain wash: lanes between the run-off streaks (materials.ts, the run-off block)
    const r0 = mxNoise3(x * 2.2 + 4.1, wy * 0.2 + 0.3, W.z * 2.2 + 7.9) * 0.5 + 0.5, fade = 1 - smoothstep(0.3, PW.washH, below);
    const lane = smoothstep(0.52, 0.82, 1 - r0);
    f *= 1 + lane * fade * PW.wash + fade * 0.025; h -= lane * fade * 0.0015 * bandLimit(fp, 0.12);
  }
  return { f, h };
}

/** albedo factor and shading normal (wall frame) of the plaster at a point, per pixel of size px */
export function plasterPixel(d: SurfaceDef, W: PlasterWall, x: number, y: number, px: number) {
  const fp = px * Math.SQRT2, e = px * 0.5, A = albHeight(d, W, x, y, fp);
  const tx = -(albHeight(d, W, x + e, y, fp).h - albHeight(d, W, x - e, y, fp).h) / (2 * e);
  const ty = -(albHeight(d, W, x, y + e, fp).h - albHeight(d, W, x, y - e, fp).h) / (2 * e);
  const l = Math.hypot(tx, ty, 1);
  return { f: A.f, n: [tx / l, ty / l, 1 / l] as [number, number, number] };
}

export interface PlasterView { dist: number; fovDeg: number; rows: number; sun: [number, number, number]; sky?: number; outY: number; patch: [number, number, number, number] }
/** render a patch of sunlit plaster wall (x0, y0 above the base, width, height in m): linear Y after AgX, its region Ystd/Y and
 *  the mean Ystd/Y in square windows of `win` pixels */
export function renderPlaster(d: SurfaceDef, W: PlasterWall, V: PlasterView, win = 16) {
  const px = (2 * Math.tan((V.fovDeg * Math.PI) / 360) * V.dist) / V.rows, [x0, y0, w, h] = V.patch;
  const nx = Math.max(4, Math.round(w / px)), ny = Math.max(4, Math.round(h / px));
  const s = V.sun, sl = Math.hypot(...s), L = s.map(c => c / sl), sky = V.sky ?? 0.15, rho = srgbToLinear(d.albedo[1]);
  const lin = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const P = plasterPixel(d, W, x0 + (i + 0.5) * px, y0 + (j + 0.5) * px, px);
    lin[j * nx + i] = rho * P.f * (Math.max(0, P.n[0] * L[0] + P.n[1] * L[1] + P.n[2] * L[2]) + sky);
  }
  let m = 0; for (const v of lin) m += v; m /= lin.length;
  let lo = 0.01, hi = 100; for (let it = 0; it < 60; it++) { const k = Math.sqrt(lo * hi); if (agxGrey(m * k) < V.outY) lo = k; else hi = k; }
  const k = Math.sqrt(lo * hi), out = Array.from(lin, v => agxGrey(v * k));
  const stat = (a: number[]) => { const mu = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - mu) ** 2, 0) / a.length) / mu; };
  const wins: number[] = [];
  for (let j = 0; j + win <= ny; j += win >> 1) for (let i = 0; i + win <= nx; i += win >> 1) {
    const a: number[] = []; for (let jj = 0; jj < win; jj++) for (let ii = 0; ii < win; ii++) a.push(out[(j + jj) * nx + i + ii]); wins.push(stat(a));
  }
  return { px, nx, ny, out, region: stat(out), windows: wins.length ? wins.reduce((p, q) => p + q, 0) / wins.length : NaN, n: wins.length };
}
