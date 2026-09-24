// Procedural PBR materials (Phase 3). No texture library is reachable (BLOCKERS B7), so surfaces are procedural in TSL:
// world-space noise for stone mottling, tooling and joints; porosity-driven darkening when wet; puddle smoothing on flat
// ground; snow on up-facing surfaces; a procedural height field per surface that perturbs the shading normal (surface
// gradient from screen-space derivatives), so plaster, fill and stone read as surfaces rather than flat colour.
// Albedo values are from the colour research where available (research/RELIEFS_AND_COLOUR.md), otherwise C. Every
// material carries tier metadata for the dev overlay.
//
// Session 4 photoreal triage (D-157, all C): a broad tone at 6, 1.5 and 0.4 m with a faint chroma shift and repair patches
// (the old mottling gave 1–2 % 1σ, measured on a CPU mirror of the noise: tests/surfaces.test.ts); ashlar with varied
// course heights and block lengths, per-block tone with a warm/cool split, a per-block normal tilt and worn arrises either
// side of the hairline joint; on the architecture's own meshes (surfaceMaterial(…, { arch: true }), whose vertices carry
// the part's base height and, for hall floors, the floor's box) a splash and dust band at the foot of walls and traffic
// wear along the floors' axes; indirect specular from the sky environment (envmap.ts) on the smoother surfaces.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, normalWorld, normalView, positionView, mx_noise_float, mx_worley_noise_float, vec2, vec3, float, mix, smoothstep, max, min, clamp, color, abs, fract, step, attribute, sign, fwidth, exp, floor, dot, cameraViewMatrix, vec4 } from 'three/tsl';
import PC from '../data/polychromy.json';
import { linearToSrgb, munsellY, srgbToLinear } from '../core/colour';
import { SkySpecularNode } from './envmap';
import { incisionNodes } from './incision';
import type { Atlas } from '../arch/carving';

export const WEATHER = { wetness: uniform(0), snow: uniform(0), puddles: uniform(0) };
/** seasonal ground cover (0..1): green = living herb layer, dry = standing straw/stubble (set per frame from the date; season.ts) */
export const SEASON = { green: uniform(0.8), dry: uniform(0.1) };
/** A/B switch for measurements (D-157; window.__parsaSurf.surf): 1 = the session-4 triage surfaces; 0 = no broad tone, no
 *  wall-foot band or floor wear, block tone at the old ±8 %, no worn arrises or block tilt (the varied coursing stays) */
export const SURF_AB = uniform(1);
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaSurf = { ...((globalThis as any).__parsaSurf ?? {}), surf: SURF_AB };

export interface Joints {
  course: number; block: number; width: number; dark: number;
  /** varied coursing (D-157): course heights between vary.course[0] and [1] (m; pairs of courses share 2 × `course`),
   *  block lengths `block` × (1 ± jitter/2), a bond offset hashed per course; horizontal faces get slabs of the same
   *  pattern (rows along z). Without it: the regular running bond of D-029 */
  vary?: { course: [number, number]; jitter: number };
  /** worn arris either side of the joint (m) and how much it darkens the albedo inside it (D-157) */
  lip?: number; lipDark?: number;
  /** warm/cool split of the block tone (± fraction of red and blue) and the per-block normal tilt (radians, ±) */
  warmCool?: number; tilt?: number;
}
export interface SurfaceDef {
  albedo: [number, number, number]; roughness: number; porosity: number; noiseScale: number; noiseAmp: number;
  /** masonry joints (D-029): course height and block length (m, C pattern), joint width (m) and how much a joint darkens the
   *  albedo inside it. Drawn as an anti-aliased hairline (box-filtered over the pixel footprint), never as a sunk groove */
  joints?: Joints; metal?: number; tier: string; note: string;
  /** procedural relief (m): amplitude of the height field used for the shading normal, and its base frequency (1/m) */
  bump?: { amp: number; freq: number };
  /** use another surface on up-facing faces (e.g. the Terrace platform: ashlar retaining walls, fill on top) */
  top?: string;
  /** scattered chips / stones: fraction of area and their albedo */
  chips?: { cover: number; size: number; albedo: [number, number, number] };
  /** vertical weathering streaks on rock faces (run-off, varnish): albedo darkened by up to `amp` in bands `1/freq` m
   *  wide, stretched ~12× vertically (C) */
  streaks?: { amp: number; freq: number };
  /** herb layer that follows SEASON (ground surfaces only) */
  herbs?: number;
  /** ashlar only: each block (the joint pattern's course × block cells) gets its own tone, ±this fraction of the albedo:
   *  quarried stone varies from block to block (D-148, C) */
  blockTone?: number;
  /** fine grain at millimetre–centimetre scale (tool marks, grit, trowel texture): height amplitude (m), frequency (1/m)
   *  and albedo variation, faded out where one period spans fewer than ~3–7 pixels, so surfaces keep detail at arm's
   *  length (brief §8.3 "detail at 1 m") and never shimmer far away (D-147, C) */
  micro?: { amp: number; freq: number; alb?: number };
  /** roughness variation (C): ±this fraction of the roughness in broad patches (0.3–3 m): polish and wear of floors, the
   *  burnish and dull spots of plaster (session 4: large planes read as uniform CG surfaces) */
  roughVar?: number;
  /** broad tone (D-157, C): `sd` = the 1σ of the albedo factor from three noise octaves at 6, 1.5 and 0.4 m (patching,
   *  float passes, dust, stone from different beds); `chroma` = 1σ of a red–blue shift; `patch` = the tone step of repair
   *  patches (+ lighter, − darker; ~20 % of the area, soft 10 cm edges). Replaces the broad and middle octaves of the old
   *  mottling (1–2 % 1σ, measured); its fine octave stays as grain */
  tone?: { sd: number; chroma?: number; patch?: number };
  /** splash and dust band at the foot of walls (arch meshes: the part's base height is a vertex attribute): its strength
   *  (1 = the albedo 20 % toward the earth and ~5 % darker at the foot, fading out 0.2–0.45 m up) (D-157, C) */
  foot?: number;
  /** traffic wear on hall and portico floors (arch meshes: the floor's box is a vertex attribute): the albedo darker and
   *  the roughness lower by these fractions along the floor's axes, where the doorways of these halls lie (D-157, C) */
  wear?: { alb: number; rough: number };
  /** run-off streaks below the top of exposed stone (arch meshes: the part's top height is a vertex attribute): the albedo
   *  darker by up to this fraction in vertical streaks ~10:1, strongest just under the coping and gone ~3 m down (D-157, C) */
  runoff?: number;
}
/** neutral grey of luminous reflectance Y (linear) as the sRGB triple the surface table uses */
function grey(Y: number): [number, number, number] { const v = linearToSrgb(Y); return [v, v, v]; }
/** hairline ashlar joints (D-029): width 0.8 mm (C: anathyrosis gives tight contact bands, Q-071); a joint that fine is a
 *  shadowed slot, its albedo 60 % darker. D-157: courses 0.8–1.3 m high, blocks 1.15–3.45 m long (2.3 m ± 50 %), a
 *  bond offset per course (the pattern is C: the Terrace walls' polygonal layout is not modelled, Q-071); each joint's
 *  arrises worn round over 5 mm either side (25 % darker on average: the rounded lip turns from the light and is
 *  partly shaded), so the joint pattern reads at 5–30 m while the joint itself stays 0.8 mm; blocks ±13 % in tone with
 *  a ±3 % warm/cool split and tilted by up to ±0.43° */
const HAIRLINE: Joints = { course: 1.05, block: 2.3, width: 0.0008, dark: 0.6, vary: { course: [0.8, 1.3], jitter: 1.0 }, lip: 0.005, lipDark: 0.25, warmCool: 0.03, tilt: 0.0075 };
export const SURFACES: Record<string, SurfaceDef> = {
  // Persepolis grey limestone, freshly dressed (C until colour research lands): mid-grey, slightly warm. Ashlar dry-laid
  // without mortar (SITE_SPEC terrace.wall_material, B: 'dry-laid'; Grand Stair 'dry-jointed', B) and, by the Achaemenid
  // practice of anathyrosis (recollection, C; Q-071), fitted to hairline joints: 0.8 mm (C), not a sunk mortar groove
  limestone: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.13, tone: { sd: 0.065, chroma: 0.01 }, foot: 1, wear: { alb: 0.05, rough: 0.2 }, runoff: 0.08, bump: { amp: 0.0015, freq: 6 }, micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'dressed grey limestone, dry-laid ashlar with hairline joints (B dry-laid; joint width C, Q-071); albedo C pending calibration photo (NEEDS #13)' },
  // carved members (column bases, shafts and capitals, colossi, relief figures): the same stone with no masonry joints drawn
  // (the block layout of carved members is unknown; a joint may cross a carving only as a hairline) and a finer, rubbed
  // finish (D-029, C)
  limestone_carved: { albedo: [0.44, 0.43, 0.40], roughness: 0.55, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.1, tone: { sd: 0.06, chroma: 0.01 }, bump: { amp: 0.0004, freq: 14 }, micro: { amp: 0.00012, freq: 130, alb: 0.03 }, tier: 'C', note: 'carved limestone (columns, colossi, reliefs): joint-free rubbed finish (D-029, C); albedo C pending calibration photo (NEEDS #13)' },
  // polished dark grey limestone of the door and window frames: 'dark grey limestone from Majdabad' (RELIEFS_AND_COLOUR §4,
  // Iranica via search extract: B). 'Dark grey' = N3 on the GSA rock-colour chart → luminous reflectance 6.4 % (ASTM D1535):
  // albedo C (D-031). Was 0.013 (sRGB 0.12), i.e. black. Whether frames carried the whitish finishing coat is Q-072
  limestone_dark: { albedo: grey(munsellY(3)), roughness: 0.18, porosity: 0.1, noiseScale: 2, noiseAmp: 0.05, tone: { sd: 0.05, chroma: 0.006 }, foot: 0.5, micro: { amp: 0.00003, freq: 160, alb: 0.02 }, tier: 'B/C', note: 'polished dark grey limestone (door/window frames): stone B (Majdabad dark grey, Iranica); albedo N3 = 6.4 % C (D-031); whitish finishing coat? (Q-072)' },
  // mud plaster on mud brick, coated with a greyish yellow-green clay paint: attested at Pasargadae and, per Schmidt, on
  // the Treasury walls (Stein et al. 2016, npj Herit. Sci., search extract: B for the coating); tone and extent C
  mudbrick: { albedo: [0.58, 0.57, 0.45], roughness: 0.93, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.09, tone: { sd: 0.1, chroma: 0.018, patch: -0.07 }, foot: 1, bump: { amp: 0.004, freq: 1.4 }, micro: { amp: 0.0006, freq: 55, alb: 0.05 }, tier: 'B/C', note: 'mud plaster with greyish yellow-green clay paint (Pasargadae; Treasury walls per Schmidt, via Stein et al. 2016: B); tone and extent C' },
  plaster: { albedo: [0.78, 0.74, 0.66], roughness: 0.85, porosity: 0.7, noiseScale: 0.8, noiseAmp: 0.08, roughVar: 0.1, tone: { sd: 0.09, chroma: 0.015, patch: 0.05 }, foot: 1, bump: { amp: 0.0022, freq: 2.4 }, micro: { amp: 0.00025, freq: 70, alb: 0.03 }, tier: 'C', note: 'lime/gypsum plaster' },
  // albedo (C, session 4): a hematite-like reflectance (~4–7 % below 580 nm rising to 30–50 % above 620 nm) integrated
  // with CIE 1931 / D65 gives linear ≈ (0.25–0.53, 0.034–0.085, 0.036–0.059), R/G 6–7.5; the old (0.48, 0.14, 0.10) sRGB
  // was R/G 11 (too little green and blue: the floors rendered as carpet red). Pigment B, value C
  plaster_red: { albedo: [0.56, 0.23, 0.20], roughness: 0.35, porosity: 0.3, noiseScale: 0.9, noiseAmp: 0.07, roughVar: 0.35, tone: { sd: 0.06, chroma: 0.012, patch: -0.04 }, wear: { alb: 0.05, rough: 0.3 }, bump: { amp: 0.0006, freq: 4 }, micro: { amp: 0.0001, freq: 85, alb: 0.03 }, tier: 'B', note: 'lime-plaster floor with two hematite-rich paint coats, deep red over white (Stein et al. 2016; flooring-plaster study 2022, Treasury/Edifice C/Tachara: search extracts, B); polish C' },
  bronze: { albedo: [0.55, 0.38, 0.2], roughness: 0.35, porosity: 0.0, noiseScale: 3, noiseAmp: 0.08, metal: 1, tier: 'C', note: 'bronze fittings' },
  timber: { albedo: [0.32, 0.23, 0.15], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, bump: { amp: 0.002, freq: 5 }, micro: { amp: 0.0003, freq: 60, alb: 0.06 }, tier: 'C', note: 'cedar/timber beams' },
  glazed: { albedo: [0.12, 0.33, 0.48], roughness: 0.25, porosity: 0.05, noiseScale: 3, noiseAmp: 0.06, foot: 0.5, tier: 'C', note: 'glazed brick' },
  // open ground on the plain: loam with stones and a seasonal herb layer (C; fields and crops are Phase 7)
  earth: { albedo: [0.47, 0.39, 0.29], roughness: 0.95, porosity: 0.9, noiseScale: 0.4, noiseAmp: 0.14, bump: { amp: 0.02, freq: 0.9 }, chips: { cover: 0.06, size: 0.35, albedo: [0.55, 0.53, 0.49] }, herbs: 1, micro: { amp: 0.0005, freq: 70, alb: 0.08 }, tier: 'C', note: 'plain surface: loam, stones and a seasonal herb layer (C); fields Phase 7' },
  // the open courts of the Terrace: no source found for their surface (OPEN_QUESTIONS Q-027). Compacted fill with
  // limestone dressing chips over the levelled platform (C)
  court_fill: { albedo: [0.50, 0.46, 0.39], roughness: 0.9, porosity: 0.7, noiseScale: 0.5, noiseAmp: 0.1, tone: { sd: 0.08, chroma: 0.015 }, bump: { amp: 0.004, freq: 2.5 }, chips: { cover: 0.12, size: 0.06, albedo: [0.64, 0.62, 0.57] }, micro: { amp: 0.0004, freq: 70, alb: 0.06 }, tier: 'C', note: 'Terrace open court: compacted fill with limestone chips (surface unknown, Q-027: C)' },
  terrace: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.13, tone: { sd: 0.065, chroma: 0.01 }, foot: 1, runoff: 0.08, bump: { amp: 0.0015, freq: 6 }, top: 'court_fill', micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'Terrace platform: dressed limestone retaining walls, dry-laid with hairline joints (Q-071); open court surface C (Q-027)' },
  scaffold: { albedo: [0.45, 0.35, 0.24], roughness: 0.85, porosity: 0.5, noiseScale: 3, noiseAmp: 0.1, tier: 'C', note: 'timber scaffold poles' },
  rubble: { albedo: [0.5, 0.48, 0.44], roughness: 0.9, porosity: 0.5, noiseScale: 2, noiseAmp: 0.2, bump: { amp: 0.01, freq: 3 }, micro: { amp: 0.0015, freq: 32, alb: 0.06 }, tier: 'C', note: 'stone chips' },
};

/** shading normal from a procedural height field (view space; surface-gradient method, Mikkelsen 2010) */
function bumped(h: any) {
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy(), n = normalView;
  const r1 = dpdy.cross(n), r2 = n.cross(dpdx), det = dpdx.dot(r1);
  const grad = sign(det).mul(h.dFdx().mul(r1).add(h.dFdy().mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}

/** pixel coverage of a line of width w (m) repeating every `period` m along the scalar world coordinate x: the line box-filtered
 *  over the pixel footprint (fwidth), so a sub-pixel hairline fades to a faint line with distance instead of aliasing or
 *  widening. Arithmetic only (no select(), D-012). */
function hairline(x: any, period: number, w: number) {
  const dist = abs(fract(x.div(period).add(0.5)).sub(0.5)).mul(period); // m from the nearest joint
  const px = fwidth(x).max(1e-6), h = px.mul(0.5);
  const overlap = min(float(w / 2), dist.add(h)).sub(max(float(-w / 2), dist.sub(h))).max(0); // [−w/2, w/2] ∩ pixel
  return clamp(overlap.div(px), 0, 1);
}
/** box-filtered pixel coverage of the band |d| ≤ hw around a line, d (m, ≥ 0) = the pixel centre's distance from it, px =
 *  the pixel footprint along d (as hairline(), for a pattern that is not periodic) */
function bandCover(d: any, px: any, hw: number) {
  const h = px.mul(0.5);
  return clamp(min(float(hw), d.add(h)).sub(max(float(-hw), d.sub(h))).max(0).div(px), 0, 1);
}
/** Dave Hoskins' "hash without sine" (hash12): a value in [0, 1) from two floats (course and block indices). No sin():
 *  float precision is kept for large indices. CPU mirror: tests/lib/mx_noise_cpu.ts hash12 */
function hash12(x: any, y: any) {
  const q = fract(vec3(x, y, x).mul(0.1031));
  const r = q.add(dot(q, q.yzx.add(33.33)));
  return fract(r.x.add(r.y).mul(r.z));
}

/** broad tone octaves (D-157): wavelength (m) and weight. Normalised by the measured 1σ of mx_noise_float (vec3), 0.265
 *  (tests/lib/mx_noise_cpu.ts, 200,000 samples), so that SurfaceDef.tone.sd is the 1σ of the albedo factor */
export const TONE_OCTAVES: [number, number][] = [[6, 1], [1.5, 0.6], [0.4, 0.35]];
export const MX_NOISE_SD = 0.265;
export const TONE_NORM = 1 / (MX_NOISE_SD * Math.hypot(...TONE_OCTAVES.map(o => o[1])));
export const TONE_OFFSETS: [number, number, number][] = [[0, 0, 0], [17.3, 5.1, 9.7], [3.9, 41.7, 23.3]];
/** the chroma field: two octaves (4 m, 1.1 m) */
export const CHROMA_OCTAVES: [number, number, [number, number, number]][] = [[4, 0.8, [51.1, 7.3, 13.9]], [1.1, 0.45, [2.2, 71.3, 5.5]]];
export const CHROMA_NORM = 1 / (MX_NOISE_SD * Math.hypot(0.8, 0.45));
/** repair patches: a 2.5 m noise wobbled by a 0.7 m one, above a threshold (≈ 20 % of the area; the edge ~10 cm wide) */
export const PATCH = { lambda: 2.5, wobble: 0.7, wAmp: 0.35, lo: 0.2, hi: 0.26, off: [31.7, 3.3, 8.1] as [number, number, number], off2: [4.3, 19.9, 27.1] as [number, number, number] };
/** the band-limit of a tone octave: 1 while a period spans more than ~7 pixels, 0 below ~3 (as the micro grain, D-147) */
const bandLimit = (fp: any, lambda: number) => float(1).sub(smoothstep(0.15, 0.35, fp.div(lambda)));
const v3 = (a: [number, number, number]) => vec3(a[0], a[1], a[2]);
/** the broad tone as an RGB factor on the albedo (D-157) */
function toneFactor(p: any, T: NonNullable<SurfaceDef['tone']>): any {
  const fp = fwidth(p).length().max(1e-6);
  let t: any = float(0);
  TONE_OCTAVES.forEach(([lam, w], i) => { t = t.add(mx_noise_float(p.div(lam).add(v3(TONE_OFFSETS[i]))).mul(w).mul(bandLimit(fp, lam))); });
  const g = float(1).add(t.mul(T.sd * TONE_NORM).mul(SURF_AB));
  let f: any = vec3(g, g, g);
  if (T.chroma) {
    let c: any = float(0);
    for (const [lam, w, o] of CHROMA_OCTAVES) c = c.add(mx_noise_float(p.div(lam).add(v3(o))).mul(w).mul(bandLimit(fp, lam)));
    c = c.mul(T.chroma * CHROMA_NORM).mul(SURF_AB);
    f = f.mul(vec3(float(1).add(c), float(1), float(1).sub(c)));
  }
  if (T.patch) {
    const n = mx_noise_float(p.div(PATCH.lambda).add(v3(PATCH.off))).add(mx_noise_float(p.div(PATCH.wobble).add(v3(PATCH.off2))).mul(PATCH.wAmp));
    f = f.mul(float(1).add(smoothstep(PATCH.lo, PATCH.hi, n).mul(T.patch).mul(SURF_AB)));
  }
  return f.max(0.2);
}

/** Varied ashlar (D-157): the distances (m) to the nearest bed and head joint and the course and block indices, for a
 *  pattern of courses along `b` (m, across the courses) and blocks along `a` (m, along a course). Course heights:
 *  pairs of courses share 2 × J.course, split at a hashed height; head joints: a hashed bond offset per course, each
 *  joint jittered by ±jitter/2 of the block length (a block is never shorter than (1 − jitter) × J.block) */
function ashlarCells(a: any, b: any, J: Joints) {
  const V = J.vary!, H = J.course * 2;
  const k = floor(b.div(H)), f = b.sub(k.mul(H));
  const split = hash12(k, 7.13).mul(V.course[1] - V.course[0]).add(V.course[0]);
  const c = k.mul(2).add(step(split, f));
  const dBed = min(min(f, abs(f.sub(split))), float(H).sub(f));
  const L = J.block, u = a.sub(hash12(c, 3.71).mul(L)).div(L), j0 = floor(u);
  const u0 = j0.add(hash12(c, j0).sub(0.5).mul(V.jitter * 0.5)), u1 = j0.add(1).add(hash12(c, j0.add(1)).sub(0.5).mul(V.jitter * 0.5));
  const dHead = min(abs(u.sub(u0)), abs(u.sub(u1))).mul(L);
  const blk = j0.sub(1).add(step(u0, u)).add(step(u1, u));
  return { dBed, dHead, c, blk };
}

export interface Layer { alb: any; rough: any; height: any | null; tilt?: any }
/** albedo, roughness and height of one surface definition (before weather). `arch`: the architecture's own meshes, whose
 *  vertices carry the part's base height (`y0`) and, on hall floors, the floor's box (`pbox`: centre x, z, half size x, z) */
function layer(d: SurfaceDef, base: any, arch = false): Layer {
  const p = positionWorld, n = normalWorld;
  // mottling: broad variation (metre scale) + fine grain; mx_noise is ~[-1,1] so amplitudes are fractions of albedo. With a
  // broad tone (D-157) only the fine octave stays (as grain), the broad field is toneFactor()
  const fine = mx_noise_float(p.mul(d.noiseScale * 9.0)).mul(d.noiseAmp * 0.12);
  const mott = d.tone ? fine.add(mx_noise_float(p.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(p.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).mul(float(1).sub(SURF_AB)))
    : mx_noise_float(p.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(p.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).add(fine);
  let alb = base.mul(float(1).add(mott));
  if (d.tone) alb = alb.mul(toneFactor(p, d.tone));
  let rough: any = float(d.roughness);
  if (d.roughVar) rough = rough.mul(float(1).add(mx_noise_float(p.mul(0.9).add(3.7)).mul(0.7).add(mx_noise_float(p.mul(3.1).add(1.3)).mul(0.3)).mul(d.roughVar))).clamp(0.04, 1);
  let height: any = null, tilt: any = undefined;
  if (d.bump) { // two octaves of relief: broad undulation (trowel / settling) + fine grain
    height = mx_noise_float(p.mul(d.bump.freq)).mul(d.bump.amp).add(mx_noise_float(p.mul(d.bump.freq * 5.3)).mul(d.bump.amp * 0.35));
  }
  if (d.micro) { // fine grain, band-limited by the pixel footprint (D-147)
    const fade = float(1).sub(smoothstep(0.15, 0.35, fwidth(p).length().max(1e-6).mul(d.micro.freq)));
    height = (height ?? float(0)).add(mx_noise_float(p.mul(d.micro.freq)).mul(d.micro.amp).mul(fade));
    alb = alb.mul(float(1).add(mx_noise_float(p.mul(d.micro.freq * 1.9).add(7.3)).mul(d.micro.alb ?? 0.04).mul(fade)));
  }
  if (d.joints && d.joints.vary) { // varied ashlar (D-157): hairline joints with worn arrises, per-block tone and tilt
    const J = d.joints, vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y))), flat = smoothstep(0.7, 0.9, n.y);
    // vertical faces: courses up the wall, blocks along the face's own horizontal axis (rotated walls keep their lengths)
    const hl = vec2(n.x, n.z).length().max(1e-3), tx = n.z.div(hl), tz = n.x.negate().div(hl);
    const t = p.x.mul(tx).add(p.z.mul(tz));
    const W = ashlarCells(t, p.y, J);
    // up-facing faces: slabs in rows along z, blocks along x; the height enters the hash so every stair tread is its own
    // block row
    const S = ashlarCells(p.x, p.z, J);
    const hw = J.width / 2, lw = hw + (J.lip ?? 0);
    const pxY = fwidth(p.y).max(1e-6), pxT = fwidth(t).max(1e-6), pxX = fwidth(p.x).max(1e-6), pxZ = fwidth(p.z).max(1e-6);
    const slotV = max(bandCover(W.dBed, pxY, hw), bandCover(W.dHead, pxT, hw)), lipV = max(bandCover(W.dBed, pxY, lw), bandCover(W.dHead, pxT, lw));
    const slotH = max(bandCover(S.dBed, pxZ, hw), bandCover(S.dHead, pxX, hw)), lipH = max(bandCover(S.dBed, pxZ, lw), bandCover(S.dHead, pxX, lw));
    // slab joints only on up-facing faces of parts at least 1.5 m across both ways (landings, pavements): a stair tread is
    // a block of its own (its arrises are the geometry's), a parapet's coping one block across (arch meshes: pbox)
    const slabs = arch ? (() => { const B = attribute('pbox', 'vec4'); return step(0.75, min(abs(B.z), abs(B.w))); })() : float(0);
    const flatJ = flat.mul(slabs);
    const slot = slotV.mul(vert).add(slotH.mul(flatJ)), lip = lipV.sub(slotV).max(0).mul(vert).add(lipH.sub(slotH).max(0).mul(flatJ));
    alb = alb.mul(float(1).sub(slot.mul(J.dark)).sub(lip.mul((J.lipDark ?? 0) * 1).mul(SURF_AB)));
    rough = mix(rough, float(1), slot);
    // per block: tone ± blockTone (the old ±8 % at SURF_AB = 0), a warm/cool split, and a tilt of the block's face
    // tread heights in 5.8 cm bins, scaled and offset off round numbers: a tread at a round height (0.10 m × k) would sit
    // exactly on a bin edge and speckle between two tones
    const riseRow = floor(p.y.mul(17.3).add(0.371));
    const idV = hash12(W.blk.add(0.37), W.c.add(11.3)), idH = hash12(S.blk.add(riseRow.mul(7.1)).add(0.37), S.c.add(11.3));
    const wcV = hash12(W.c.mul(1.618).add(5.1), W.blk.add(2.9)), wcH = hash12(S.c.mul(1.618).add(riseRow).add(5.1), S.blk.add(2.9));
    const amp = mix(float(0.08), float(d.blockTone ?? 0.08), SURF_AB);
    const id = mix(idH, idV, vert), wc = mix(wcH, wcV, vert).mul(2).sub(1).mul((J.warmCool ?? 0)).mul(SURF_AB);
    const tone = float(1).add(id.mul(2).sub(1).mul(amp));
    alb = alb.mul(vec3(tone.mul(float(1).add(wc)), tone.mul(float(1).add(wc.mul(0.2))), tone.mul(float(1).sub(wc.mul(1.2)))));
    if (J.tilt) {
      const a1 = mix(hash12(S.blk.add(2.3), S.c.add(riseRow).add(9.1)), hash12(W.blk.add(2.3), W.c.add(9.1)), vert).mul(2).sub(1);
      const a2 = mix(hash12(S.c.add(riseRow).add(4.4), S.blk.add(6.6)), hash12(W.c.add(4.4), W.blk.add(6.6)), vert).mul(2).sub(1);
      // world tangents: along the course and up the wall (vertical faces), x and z (up-facing faces)
      const T1 = mix(vec3(1, 0, 0), vec3(tx, 0, tz), vert), T2 = mix(vec3(0, 0, 1), vec3(0, 1, 0), vert);
      tilt = T1.mul(a1).add(T2.mul(a2)).mul(J.tilt).mul(vert.add(flat)).mul(SURF_AB);
    }
    // the worn arris, resolved near the camera: a rounded lip falling 1.5 mm into the joint over `lip` either side (faded
    // out where the lip spans fewer than ~2 px; beyond, the albedo band above stands for it)
    if (J.lip) {
      const dmin = mix(min(S.dBed, S.dHead), min(W.dBed, W.dHead), vert), r = float(1).sub(dmin.div(lw)).max(0);
      const resolved = smoothstep(1.5, 3, float(lw).div(fwidth(p).length().max(1e-6)));
      height = (height ?? float(0)).sub(r.mul(r).mul(0.0015).mul(resolved).mul(vert.add(flatJ)).mul(SURF_AB));
    }
  } else if (d.joints) { // hairline ashlar joints (D-029): visual only, never sunk; on vertical faces only
    const J = d.joints;
    const vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y)));
    const bed = hairline(p.y, J.course, J.width);
    const s = p.x.add(p.z), head = hairline(s.add(step(0.5, fract(p.y.div(J.course * 2))).mul(J.block / 2)), J.block, J.width);
    const line = max(bed, head).mul(vert);
    alb = alb.mul(float(1).sub(line.mul(J.dark)));
    if (d.blockTone) { // per-block tone from the cell indices of the same joint pattern (hash of course × block)
      const ci = p.y.div(J.course).floor(), bi = s.add(step(0.5, fract(p.y.div(J.course * 2))).mul(J.block / 2)).div(J.block).floor();
      const hsh = fract(ci.mul(127.1).add(bi.mul(311.7)).sin().mul(43758.5453)).mul(2).sub(1);
      alb = alb.mul(float(1).add(hsh.mul(d.blockTone)));
    }
    rough = mix(rough, float(1), line);
  }
  if (d.chips) { // scattered stones/chips: cells of a Worley field below a threshold, raised and lighter
    const w = mx_worley_noise_float(p.xz.div(d.chips.size));
    const chip = float(1).sub(smoothstep(d.chips.cover * 0.9, d.chips.cover * 1.6, w)).mul(smoothstep(0.4, 0.8, n.y)); // (reversed smoothstep edges are undefined in WGSL)
    alb = mix(alb, color(new THREE.Color().setRGB(...d.chips.albedo, THREE.SRGBColorSpace)).mul(float(1).add(mott)), chip);
    rough = mix(rough, float(0.7), chip);
    // raised by about the chip's own radius (≈ cover × size in cell units; a pebble's proportions). It was size × 0.25:
    // 8.7 cm over a 2.5 cm chip on the earth, near-vertical bump normals, so every light chip rendered as a dark ring (session 3)
    if (height) height = height.add(chip.mul(d.chips.size * d.chips.cover * 0.6));
  }
  if (d.streaks) { // vertical weathering streaks: noise fast across the face, slow down it (C)
    const f = d.streaks.freq, q = vec3(p.x.mul(f), p.y.mul(f * 0.08), p.z.mul(f));
    const st = smoothstep(0.1, 0.75, mx_noise_float(q).mul(0.5).add(0.5).add(mx_noise_float(q.mul(3.1)).mul(0.15)));
    alb = alb.mul(float(1).sub(st.mul(d.streaks.amp)));
  }
  if (d.herbs) { // seasonal herb layer (C): green in spring, straw in summer, sparse in winter
    // Session 4: the cover was one field of 3 m blobs with hard edges, which read from the Terrace as camouflage. Now a
    // local density that varies slowly (25 m and 7 m scales) is dithered by tufts ~0.3 m across; where a tuft spans
    // under ~2 px the tufts give way to their mean (the density), so the far ground is a soft mottle, never blobs or
    // shimmer (band-limited as in D-147)
    const q = p.xz;
    const dens = clamp(float(0.5).add(mx_noise_float(q.mul(0.04)).mul(0.35)).add(mx_noise_float(q.mul(0.15).add(5.1)).mul(0.25)), 0, 1);
    const tq = q.mul(3.1), tuft = mx_noise_float(tq).add(mx_noise_float(q.mul(9.7).add(2.3)).mul(0.5)).mul(0.5).add(0.5); // ~[0, 1]
    const thr = float(1).sub(dens), w = fwidth(tuft).mul(1.5).add(0.06);
    const fine = smoothstep(thr.sub(w), thr.add(w), tuft);
    const far = smoothstep(0.35, 0.9, fwidth(tq).length()); // tuft spacing under ~2 px: use the mean
    const patch = mix(fine, dens, far);
    const up = smoothstep(0.8, 0.97, n.y);
    const cover = patch.mul(up).mul(d.herbs);
    const green = color(new THREE.Color().setRGB(0.31, 0.36, 0.18, THREE.SRGBColorSpace)), straw = color(new THREE.Color().setRGB(0.62, 0.55, 0.36, THREE.SRGBColorSpace));
    const veg = mix(straw, green, SEASON.green.div(SEASON.green.add(SEASON.dry).max(0.001)));
    const tint = float(1).add(mx_noise_float(q.mul(1.3).add(9.1)).mul(0.12)).add(mott.mul(1.5)); // tuft-to-tuft tone
    const amount = cover.mul(SEASON.green.add(SEASON.dry).min(1)).mul(0.85);
    alb = mix(alb, veg.mul(tint), amount);
    rough = mix(rough, float(0.85), amount);
    if (height) height = height.add(amount.mul(tuft).mul(0.02).mul(float(1).sub(far)));
  }
  if (arch && d.foot) { // splash and dust at the foot of walls (D-157, C): 0–~0.4 m above the part's base, noisy top edge
    const y0 = attribute('y0', 'float'), h = p.y.sub(y0);
    const vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y)));
    const along = vec3(p.x, float(0), p.z);
    const top = clamp(float(0.32).add(mx_noise_float(along.mul(1.3).add(vec3(3.1, 0, 7.7))).mul(0.3)).add(mx_noise_float(along.mul(5.3).add(vec3(1.9, 0, 2.3))).mul(0.12)), 0.18, 0.48); // 0.2–0.45 m (never an empty smoothstep ramp)
    const strength = clamp(float(0.75).add(mx_noise_float(along.mul(0.35).add(vec3(9.3, 0, 4.1))).mul(1.2)), 0.25, 1.15); // patchy along the wall
    const band = float(1).sub(smoothstep(top.sub(0.1), top.add(0.05), h)).mul(float(0.6).add(float(1).sub(smoothstep(0, top, h)).mul(0.4)))
      .mul(step(-0.01, h)).mul(vert).mul(strength).mul(d.foot).mul(SURF_AB);
    alb = mix(alb, DIRT, band.mul(0.2)).mul(float(1).sub(band.mul(0.05)));
    rough = mix(rough, float(0.95), band.mul(0.5));
  }
  if (arch && d.runoff) { // run-off below the tops of exposed stone (D-157, C): streaks fast across the face, slow down it
    const below = attribute('ytop', 'float').sub(p.y), vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y)));
    const q = vec3(p.x.mul(2.2), p.y.mul(0.2), p.z.mul(2.2));
    const st = smoothstep(0.15, 0.65, mx_noise_float(q.add(vec3(4.1, 0.3, 7.9))).mul(0.5).add(0.5).add(mx_noise_float(q.mul(2.7)).mul(0.15)));
    const fade = float(1).sub(smoothstep(0.2, 3, below)).mul(step(0, below));
    alb = alb.mul(float(1).sub(st.mul(fade).mul(vert).mul(d.runoff).mul(SURF_AB)));
  }
  if (arch && d.wear) { // traffic wear along the axes of hall and portico floors (D-157, C). pbox = (cx, cz, ±hx, hz): hx > 0
    // marks a floor (hall floor finish, portico floor, pavement, landing), hx < 0 any other part
    const B = attribute('pbox', 'vec4'), up = smoothstep(0.8, 0.95, n.y), has = step(0.5, B.z);
    const hx = abs(B.z).max(0.1), hz = abs(B.w).max(0.1); // never an empty smoothstep ramp (NaN) on parts without a box
    const dx = abs(p.x.sub(B.x)), dz = abs(p.z.sub(B.y)), sq = (x: any) => x.mul(x);
    // paths ~2.5 m wide through the centre along both axes, fading toward the ends; a floor much longer one way than the
    // other (a portico) keeps only the path across it, to the hall's door; broken up by a 1.5 m noise
    const keepX = float(1).sub(step(hz.mul(1.6), hx)), keepZ = float(1).sub(step(hx.mul(1.6), hz));
    const alongX = exp(sq(dz.div(1.3)).negate()).mul(float(1).sub(smoothstep(hx.mul(0.6), hx, dx))).mul(keepX);
    const alongZ = exp(sq(dx.div(1.3)).negate()).mul(float(1).sub(smoothstep(hz.mul(0.6), hz, dz))).mul(keepZ);
    const wear = max(alongX, alongZ).mul(float(0.7).add(mx_noise_float(p.mul(0.65).add(vec3(2.7, 0, 8.1))).mul(0.6))).clamp(0, 1).mul(up).mul(has).mul(SURF_AB);
    alb = alb.mul(float(1).sub(wear.mul(d.wear.alb)));
    rough = rough.mul(float(1).sub(wear.mul(d.wear.rough)));
  }
  return { alb, rough, height, tilt };
}
/** the earth's albedo (linear): what splash and dust at a wall's foot tend toward (D-157) */
const DIRT = vec3(...(SURFACES.earth.albedo.map(c => srgbToLinear(c) * 0.9) as [number, number, number]));

/** surfaces whose specular reads the sky environment (D-157): the smoother ones (the red floors, polished frames, dressed
 *  and carved limestone, bronze, glazed brick); the rough plasters, mud plaster, fill and ground keep only the sun's
 *  highlight (their sky reflection is a few per cent at grazing angles, and the probe lookup of the specular occlusion
 *  costs as much as the diffuse one) */
export const SKY_SPECULAR_MAX_ROUGHNESS = 0.7;
const wantsSkySpecular = (d: SurfaceDef) => (d.metal ?? 0) > 0 || d.roughness < SKY_SPECULAR_MAX_ROUGHNESS;
/** a standard node material whose environment is the sky specular (envmap.ts): radiance only, no irradiance. A subclass so
 *  that clones (door fittings, roof slabs) keep it */
export class SurfaceNodeMaterial extends THREE.MeshStandardNodeMaterial {
  skySpecular = false;
  setupEnvironment(builder: any): any { return this.skySpecular ? new SkySpecularNode() : super.setupEnvironment(builder); }
  customProgramCacheKey(): string { return super.customProgramCacheKey() + (this.skySpecular ? '|skyspec' : ''); }
  copy(source: any): this { super.copy(source); this.skySpecular = !!source.skySpecular; return this; }
}

const cache = new Map<string, THREE.MeshStandardNodeMaterial>();
const lin = (a: [number, number, number]) => color(new THREE.Color().setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace));
export function surfaceMaterial(name: string, opts: { vertexColors?: boolean; variant?: string; arch?: boolean; modify?: (L: Layer, d: SurfaceDef) => Layer } = {}): THREE.MeshStandardNodeMaterial {
  const key = name + (opts.vertexColors ? '+vc' : '') + (opts.variant ? '+' + opts.variant : '') + (opts.arch ? '+arch' : ''); // `modify` (Phase 7 plain layers) needs its own `variant` key
  const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES[name] ?? SURFACES.limestone;
  const m = new SurfaceNodeMaterial(); // vertex colours are read explicitly below; the vertexColors flag would multiply them in a second time
  const n = normalWorld;
  const base = opts.vertexColors ? attribute('color', 'vec3') : lin(d.albedo);
  let L = layer(d, base, !!opts.arch);
  if (d.top && SURFACES[d.top]) { // up-facing faces use another surface (sharp transition at the arris)
    const T = layer(SURFACES[d.top], lin(SURFACES[d.top].albedo), !!opts.arch); const t = smoothstep(0.7, 0.9, n.y);
    L = { alb: mix(L.alb, T.alb, t), rough: mix(L.rough, T.rough, t), height: L.height && T.height ? mix(L.height, T.height, t) : (L.height ?? T.height), tilt: L.tilt ? L.tilt.mul(float(1).sub(t)) : undefined };
  }
  if (opts.modify) L = opts.modify(L, d); // e.g. fields, crops and woodland over the plain's earth (src/world/plain/terrainPlain.ts)
  finish(m, L, d);
  m.userData = { tier: d.tier, note: d.note };
  cache.set(key, m);
  return m;
}
/** weather on top of a layer, then the material's colour, roughness, metalness and normal nodes */
function finish(m: THREE.MeshStandardNodeMaterial, L: Layer, d: SurfaceDef) {
  const p = positionWorld, n = normalWorld;
  let alb = L.alb;
  // weather: wet darkening (porous surfaces up to ~45% darker), gloss; puddles on near-horizontal surfaces; snow cover
  const up = smoothstep(0.75, 0.95, n.y);
  const wet = WEATHER.wetness.mul(float(0.55).add(up.mul(0.45)));
  alb = alb.mul(float(1).sub(wet.mul(d.porosity * 0.5)));
  // puddles: only in the low spots of a broad noise field (≈15% of flat area at full puddle state), never a uniform sheen
  const puddle = up.mul(WEATHER.puddles).mul(smoothstep(0.68, 0.74, mx_noise_float(p.mul(0.12)).mul(0.5).add(0.5)));
  // snow: zero when snow = 0 (noise only modulates coverage, never adds snow on its own)
  const snowMask = clamp(up.mul(WEATHER.snow).mul(float(1.6).sub(mx_noise_float(p.mul(0.8)).add(1).mul(0.3))), 0, 1);
  m.colorNode = mix(alb, vec3(0.92, 0.93, 0.96), snowMask);
  m.roughnessNode = mix(mix(L.rough, L.rough.mul(0.45), wet), float(0.05), puddle).max(float(0.04)).mul(float(1).sub(snowMask.mul(0.1))).add(snowMask.mul(0.1));
  m.metalnessNode = float(d.metal ?? 0);
  // relief flattens under water and snow; the per-block tilt (world space, D-157) is added to the bumped normal
  const flatten = float(1).sub(puddle).mul(float(1).sub(snowMask));
  const nb = L.height ? bumped(L.height.mul(flatten)) : null;
  if (L.tilt) m.normalNode = (nb ?? normalView).add(cameraViewMatrix.mul(vec4(L.tilt.mul(flatten), 0)).xyz).normalize();
  else if (nb) m.normalNode = nb;
  // sky specular (D-157): the smoother surfaces reflect the sky environment (radiance only; envmap.ts)
  if (wantsSkySpecular(d)) {
    if (m instanceof SurfaceNodeMaterial) m.skySpecular = true;
    else (m as any).setupEnvironment = () => new SkySpecularNode(); // (materials built elsewhere as plain standard ones)
  }
}

/** Painted carved stone (relief figures, D-030, D-151): the joint-free carved limestone under a matte mineral paint film,
 *  and gold leaf where the carving was gilded. Per vertex: `color` = the pigment's linear albedo (src/data/polychromy.json),
 *  `paint` = coverage (0 = bare stone: background, faces, animals; < 1 on worn arrises, relief_field.paintCoverage), `gilt` =
 *  1 on gilded masses. Per pixel: the film's optical thickness varies at brush scale (opacity 1 - exp(-hiding * t): the light
 *  stone shows through thin brushing), small flaked losses (more on worn arrises) expose the stone, pigment grain modulates
 *  the albedo, the film is dull (rough) where the stone is rubbed smooth, and it stands a fraction of a millimetre proud
 *  (visible at the edge of a loss). Gilding (D-151) is gold metal: metalness 1, the F0 of gold, a burnished roughness, lost
 *  with the paint on worn arrises. The renderer has no environment map, which left metal black in shade (D-030 drew gold
 *  as a yellow film for that reason); here the lighting model reflects the skylight into the metal's specular lobe: the
 *  radiance round the reflection is taken as the skylight's irradiance at the point / pi (the hemisphere light, through the
 *  light probes indoors, so gold in a doorway is as dim as the doorway). Arithmetic masks only (D-012). */
export function paintedStoneMaterial(): THREE.MeshStandardNodeMaterial {
  const key = 'painted-stone'; const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES.limestone_carved, F = (PC as any).paint.film.v, LS = (PC as any).paint.loss.v, G = (PC as any).paint.gold.v;
  const p = positionWorld;
  const S = layer(d, lin(d.albedo));
  const pig = attribute('color', 'vec3'), cov = attribute('paint', 'float'), gilt = attribute('gilt', 'float');
  const n01 = (x: any) => mx_noise_float(x).mul(0.5).add(0.5);
  const thick = n01(p.mul(F.brush_freq)).mul(1 - F.thickness_min).add(F.thickness_min);
  const opacity = float(1).sub(exp(thick.mul(-F.hiding)));
  const lossField = n01(p.mul(LS.freq)).add(float(1).sub(cov).mul(LS.wear_bias));
  const kept = float(1).sub(smoothstep(LS.level - LS.soft, LS.level + LS.soft, lossField));
  const leaf = clamp(gilt, 0, 1).mul(smoothstep(0.05, 0.35, cov)).mul(kept); // gold leaf where it is not lost
  const film = clamp(cov, 0, 1).mul(opacity).mul(kept).mul(float(1).sub(leaf));
  const grain = float(1).add(mx_noise_float(p.mul(F.grain_freq)).mul(F.grain_amp));
  const gold = vec3(G.f0[0], G.f0[1], G.f0[2]).mul(float(1).add(mx_noise_float(p.mul(G.grain_freq)).mul(G.grain_amp)));
  const L: Layer = { alb: mix(mix(S.alb, pig.mul(grain), film), gold, leaf), rough: mix(mix(S.rough, float(F.roughness), film), float(G.roughness), leaf), height: (S.height ?? float(0)).add(film.add(leaf).mul(F.relief)) };
  class GiltLighting extends (THREE as any).PhysicalLightingModel {
    indirectSpecular(builder: any) {
      const ctx = builder.context; // the skylight's irradiance (hemisphere light / probes), reflected by the gold only
      ctx.radiance.addAssign(ctx.irradiance.mul(leaf).mul(1 / Math.PI));
      super.indirectSpecular(builder);
    }
  }
  const m = new THREE.MeshStandardNodeMaterial();
  finish(m, L, d);
  m.metalnessNode = leaf;
  (m as any).setupLightingModel = () => new GiltLighting();
  m.userData = { tier: 'C', note: 'carved limestone (joint-free) with a matte mineral paint film: pigments B (RELIEFS_AND_COLOUR §3a), colour values, film and wear C (src/data/polychromy.json, D-030); gilding drawn as gold leaf (metal, D-151): gilding on the reliefs B (Iranica "Persepolis": traces of gold; Nagel 2010 "color and gilding"), the technique and the gilded zones C (Q-231)' };
  cache.set(key, m);
  return m;
}

/** Incised signs (D-166; src/render/incision.ts): the host stone's own surface (the same world-space layer and weather as the
 *  face they are cut into, so the cut is the stone, not a dark inlay), its normal replaced inside the cut by the cut's wall
 *  normal, its skylight occluded with depth, and the uncut face discarded (the host mesh shows there). A small depth bias
 *  keeps the quads in front of the face they lie on. `surface` is the host's SURFACES key */
export function incisedMaterial(surface: string, atlas: Atlas): THREE.MeshStandardNodeMaterial {
  const key = `incised:${surface}:${atlas.tex.uuid}`; const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES[surface] ?? SURFACES.limestone;
  const m = new SurfaceNodeMaterial();
  finish(m, layer(d, lin(d.albedo)), d);
  const I = incisionNodes(atlas);
  m.normalNode = I.normalView; m.aoNode = I.ao; m.opacityNode = I.mask; m.alphaTest = 0.5;
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4;
  m.userData = { tier: 'C', note: `incised signs in ${surface} (D-166): the stone's own surface; V-section, walls at 45° (C)` };
  cache.set(key, m);
  return m;
}
