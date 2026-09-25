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
import { uniform, positionWorld, normalWorld, normalView, positionView, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, vec2, vec3, float, mix, smoothstep, max, min, clamp, color, abs, fract, step, attribute, sign, fwidth, exp, floor, dot, cameraViewMatrix, vec4, texture, positionGeometry, atan, sin, cos, instanceIndex, mx_worley_noise_float_2d } from 'three/tsl';
import PC from '../data/polychromy.json';
import { linearToSrgb, munsellY, srgbToLinear } from '../core/colour';
import { SkySpecularNode } from './envmap';
import { incisionNodes } from './incision';
import type { Atlas } from '../arch/carving';
import { roofedNode } from './probes/roofs';

export const WEATHER = { wetness: uniform(0), snow: uniform(0), puddles: uniform(0) };
/** seasonal ground cover (0..1): green = living herb layer, dry = standing straw/stubble (set per frame from the date; season.ts) */
export const SEASON = { green: uniform(0.8), dry: uniform(0.1) };
/** the masons' yard's dressing waste on the court fill (D-188; set by the construction view, src/world/construction.ts):
 *  `rect` = the yard (world x0, z0, x1, z1), `amount` = how much is being dressed there (0 none … 1), `work` = a block
 *  being carved (world x, z, radius, 0/1). Stone chips 4× denser and a film of limestone dust (C: dressing on site is B,
 *  the yard's place and the waste's spread C) */
/** trodden ground on the courts (D-188, C): a 1 m map over the Terrace (grid x −100…300, y −200…200) of how much the fill
 *  is walked: a fan out of every doorway (its width, fading over ~10 m) and paths ~2.5 m wide from each doorway to the two
 *  nearest doorways of other buildings (the courts are open: people cross them door to door). Built by setTraffic() from
 *  the Terrace's doorways (world.ts); 0 until then */
export const TRAFFIC = { N: 400, x0: -100, y0: -200, cell: 1, tex: null as any };
{
  const t = new THREE.DataTexture(new Uint8Array(TRAFFIC.N * TRAFFIC.N), TRAFFIC.N, TRAFFIC.N, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; TRAFFIC.tex = t;
}
/** the trodden-ground map from the doorways (grid centres c, outward normals n, widths); returns the map (0…1) */
export function trafficMap(doorways: { building: string; c: [number, number]; n: [number, number]; width: number }[]): Float32Array {
  const { N, x0, y0, cell } = TRAFFIC, m = new Float32Array(N * N);
  const stamp = (ax: number, ay: number, bx: number, by: number, w0: number, w1: number, s0: number, fade: number) => {
    const L = Math.hypot(bx - ax, by - ay); if (L < 1e-3) return;
    const ux = (bx - ax) / L, uy = (by - ay) / L, pad = Math.max(w0, w1);
    const ix0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - x0) / cell)), ix1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + pad - x0) / cell));
    const iy0 = Math.max(0, Math.floor((Math.min(ay, by) - pad - y0) / cell)), iy1 = Math.min(N - 1, Math.ceil((Math.max(ay, by) + pad - y0) / cell));
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      const px = x0 + (ix + 0.5) * cell - ax, py = y0 + (iy + 0.5) * cell - ay, s = px * ux + py * uy; if (s < 0 || s > L) continue;
      const d = Math.abs(px * uy - py * ux), w = w0 + (w1 - w0) * (s / L), a = s0 * Math.exp(-s / fade) * Math.max(0, 1 - (d / w) ** 2);
      const k = iy * N + ix; m[k] = 1 - (1 - m[k]) * (1 - a);
    }
  };
  for (const d of doorways) for (const sg of [1, -1]) // a fan either side of the doorway, widening from its width
    stamp(d.c[0], d.c[1], d.c[0] + sg * d.n[0] * 12, d.c[1] + sg * d.n[1] * 12, d.width * 0.6, d.width * 1.4, 0.9, 7);
  for (const d of doorways) {
    const near = doorways.filter(e => e.building !== d.building).map(e => ({ e, L: Math.hypot(e.c[0] - d.c[0], e.c[1] - d.c[1]) })).filter(q => q.L < 90).sort((a, b) => a.L - b.L).slice(0, 2);
    for (const { e } of near) stamp(d.c[0], d.c[1], e.c[0], e.c[1], 1.3, 1.3, 0.55, 1e9);
  }
  return m;
}
export function setTraffic(doorways: Parameters<typeof trafficMap>[0]) {
  const m = trafficMap(doorways), img = TRAFFIC.tex.image.data as Uint8Array;
  for (let i = 0; i < m.length; i++) img[i] = Math.round(255 * Math.min(1, m[i]));
  TRAFFIC.tex.needsUpdate = true;
}
export const DEBRIS = { rect: uniform(new THREE.Vector4(0, 0, 0, 0)), amount: uniform(0), work: uniform(new THREE.Vector4(0, 0, 1, 0)) };
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
  /** D-218: the per-block tone as a 1σ (a triangular distribution: most blocks near the mean, a few much lighter or darker)
   *  instead of SurfaceDef.blockTone's uniform ± range */
  blockSd?: number;
}
/** the stone inside each block (D-218, C), in block-local terms so every feature stops at the joints: bedding laminae (bands
 *  parallel to the bed on vertical faces, a cloudy mottle on bedding planes), 1σ `beds` of the albedo factor per block on
 *  average (blocks from 0.25× to 1.75× of it); stylolites (dark wavy seams along the bed, in a share of the blocks);
 *  fossil moulds and pits (dark, a Worley scatter of `pits.cell` m cells, radius `r` cells on average, per-block density);
 *  and the tool: chisel facets (tiles `tool.l` × `tool.w` m along a per-block stroke direction, each tilted up to
 *  ±`tool.tilt` rad) with fine striations (`tool.pitch` m, `tool.groove` m deep) inside them. All band-limited by the pixel
 *  footprint; the pits' and seams' mean darkening is divided out, so the mean albedo (and the probe bake) is unchanged */
export interface StoneDef {
  beds: number;
  stylo: { share: number; w: number; dark: number };
  pits: { cell: number; r: number; dark: number; depth: number };
  tool: { l: number; w: number; tilt: number; pitch: number; groove: number };
  /** foot polish on stair treads (D-218): roughness lowered by up to this fraction at the middle of the flight */
  polish?: number;
}
/** a monolith (D-218): one stone with no joints of its own, its tone per instance (the merlons: a stepped outline of
 *  `steps` steps, `w` wide and `h` tall in its geometry's frame); dust on its ledges and run-off streaks under them */
export interface MonolithDef { w: number; h: number; steps: number; dust: number; runoff: number }
export interface SurfaceDef {
  albedo: [number, number, number]; roughness: number; porosity: number; noiseScale: number; noiseAmp: number;
  /** masonry joints (D-029): course height and block length (m, C pattern), joint width (m) and how much a joint darkens the
   *  albedo inside it. Drawn as an anti-aliased hairline (box-filtered over the pixel footprint), never as a sunk groove */
  joints?: Joints; metal?: number; tier: string; note: string;
  /** procedural relief (m): amplitude of the height field used for the shading normal, and its base frequency (1/m) */
  bump?: { amp: number; freq: number };
  /** use another surface on up-facing faces (e.g. the Terrace platform: ashlar retaining walls, fill on top) */
  top?: string;
  /** use another surface on down-facing faces (the roofs: reed matting on the ceiling, D-188) */
  under?: string;
  /** a plaited reed mat (D-188, C): reeds `reed` m wide, woven in squares of `cell` m whose reeds alternate between the two
   *  axes; each reed a rounded ridge `amp` m high with its own tone (±6 %) */
  weave?: { reed: number; cell: number; amp: number };
  /** scattered chips / stones: fraction of area and their albedo */
  chips?: { cover: number; size: number; albedo: [number, number, number] };
  /** vertical weathering streaks on rock faces (run-off, varnish): albedo darkened by up to `amp` in bands `1/freq` m
   *  wide, stretched ~12× vertically (C) */
  streaks?: { amp: number; freq: number; stretch?: number };
  /** a rock face's jointed blocks (D-217, C): each block (a cell `size` m: across, up, across; its edges warped by noise)
   *  gets its own tone, ±`tone` of the albedo, and each bed (the rows) a tone of its own, ±`bed` */
  rockBlocks?: { size: [number, number, number]; tone: number; bed: number };
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
   *  the roughness lower by these fractions along the floor's axes, where the doorways of these halls lie (D-157, C).
   *  A negative `rough` raises it: feet polish hard stone, but grit carried on feet scuffs a soft painted plaster coat
   *  (D-216) */
  wear?: { alb: number; rough: number };
  /** run-off streaks below the top of exposed stone (arch meshes: the part's top height is a vertex attribute): the albedo
   *  darker by up to this fraction in vertical streaks ~10:1, strongest just under the coping and gone ~3 m down (D-157, C) */
  runoff?: number;
  /** plaster work (D-188, C): `float` = the arcs of float and trowel passes (strength, 1 = ±2.5 % albedo, ±6 % roughness,
   *  a 0.25 mm ridge, arcs ~5 cm apart round centres ~0.45 m apart); `cracks` = hairline shrinkage cracks (1.2 mm, ~55 %
   *  darker, a polygon network of ~0.3 m cells over about a third of the wall, in patches) */
  plasterWork?: { float?: number; cracks?: number };
  /** ground only (D-188, C): a broad tone at 30 and 12 m (1σ of the albedo factor) and a chroma shift, so a court or a
   *  field of fill is not one flat plane; the chips' density varies with it (more stones where the fill is thin) */
  macro?: { sd: number; chroma?: number };
  /** the masons' yard's dressing waste reaches this surface (DEBRIS, D-188) */
  debris?: boolean;
  /** trodden paths from the doorways (TRAFFIC, D-188) */
  traffic?: boolean;
  /** a coarser scatter of stones (D-188): Worley cells of `size` m, `cover` as chips, their albedo */
  pebbles?: { cover: number; size: number; albedo: [number, number, number] };
  /** the stone inside each block (D-218) */
  stone?: StoneDef;
  /** one stone per instance (D-218: the merlons) */
  monolith?: MonolithDef;
  /** the foot of a plastered mud-brick wall (D-218, C; arch meshes): a renewed skirting coat up to `h` m (± 0.12 m, its upper
   *  edge a slight step), damper and darker by `dark`, with a whitish salt tide line (`salt`) along the top of the damp */
  skirt?: { h: number; dark: number; salt: number };
}
/** neutral grey of luminous reflectance Y (linear) as the sRGB triple the surface table uses */
function grey(Y: number): [number, number, number] { const v = linearToSrgb(Y); return [v, v, v]; }
/** the sRGB triple with luminous reflectance Y (linear) and the chromaticity of the sRGB triple `hue` (D-188) */
export function atY(Y: number, hue: [number, number, number]): [number, number, number] {
  const l = hue.map(srgbToLinear), y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  return l.map(c => +linearToSrgb((c * Y) / y).toFixed(4)) as [number, number, number];
}
/** the Terrace's local limestone: 'bright/light grey' (Iranica "Persepolis", search extract: B). 'Light grey' = N7 on the
 *  GSA rock-colour chart, the same reading of a colour name as D-031's N3 for the 'dark grey' Majdabad stone → luminous
 *  reflectance 42 % (ASTM D1535); the slight warmth of the old value kept (C). Was sRGB 0.44/0.43/0.40 (Y 15.5 %, N4.6:
 *  'medium grey'), under which dressed stone in open shade rendered charcoal (§8.2 rubric fix 2, D-188) */
const LIMESTONE: [number, number, number] = atY(munsellY(7), [0.44, 0.43, 0.40]);
/** hairline ashlar joints (D-029): width 0.8 mm (C: anathyrosis gives tight contact bands, Q-071); a joint that fine is a
 *  shadowed slot, its albedo 60 % darker. D-157: courses 0.8–1.3 m high, blocks 1.15–3.45 m long (2.3 m ± 50 %), a
 *  bond offset per course (the pattern is C: the Terrace walls' polygonal layout is not modelled, Q-071); each joint's
 *  arrises worn round over 5 mm either side (25 % darker on average: the rounded lip turns from the light and is
 *  partly shaded), so the joint pattern reads at 5–30 m while the joint itself stays 0.8 mm; blocks ±13 % in tone with
 *  a ±3 % warm/cool split and tilted by up to ±0.43° */
const HAIRLINE: Joints = { course: 1.05, block: 2.3, width: 0.0008, dark: 0.6, vary: { course: [0.8, 1.3], jitter: 1.0 }, lip: 0.006, lipDark: 0.05, warmCool: 0.05, tilt: 0.01, blockSd: 0.17 };
/** D-218 (rubric s7 pass 2, fix 2: "every ashlar surface reads as poured concrete", sunlit Ystd/Y 0.04–0.08 measured against
 *  0.15–0.35 for real stone). The session-4 values above were changed: each arris is rounded over 3–9 mm (per block) and
 *  drawn as a filtered normal (the lip turned 40° toward the joint over its share of the pixel), so the joint reads as a
 *  light and a dark line in sun at 5–30 m while the joint itself stays 0.8 mm; blocks 1σ 14 % in tone (triangular), ±5 %
 *  warm/cool, tilted up to ±0.57°. Inside the block, STONE: laminae 1σ 6 %, stylolites in 45 % of the blocks (2.4 mm, 45 %
 *  darker), pits in 2.2 cm cells (r 0.12 cell, 50 % darker, 1.5 mm deep; up to 1.7× denser in fossil-rich blocks), chisel
 *  facets 8 × 3 cm tilted ±1.1° with 4 mm striations 0.12 mm deep, foot polish on the treads. All C (the stone's bedding,
 *  stylolites and fossils: a grey Cretaceous-type limestone, RECOLLECTION; the toothed chisel at Pasargadae and Persepolis:
 *  Nylander 1970, RECOLLECTION, NOT SEEN), the amplitudes calibrated to the rubric's photographic range (Q-480) */
const STONE: StoneDef = { beds: 0.09, stylo: { share: 0.45, w: 0.0024, dark: 0.45 }, pits: { cell: 0.022, r: 0.12, dark: 0.5, depth: 0.0015 }, tool: { l: 0.08, w: 0.03, tilt: 0.02, pitch: 0.004, groove: 0.00012 }, polish: 0.4 };
/** stair blocks along the step (D-218, C): 1.9 m ± 30 %; the row's joint crosses the first tread of each row 6 cm in front of
 *  the next riser (the blocks' 4–5 steps per row: grand_stair.block_construction, B) */
export const STAIR_BLOCK = { length: 1.9, jitter: 0.6, rowJoint: 0.06 };
/** the worn arris as a normal (D-218): the tangent added per unit of the lip's pixel coverage (0.84 ≈ the lip's mean slope, 40°) */
export const ARRIS_K = 0.84;
export const SURFACES: Record<string, SurfaceDef> = {
  // Persepolis light grey limestone, freshly dressed (LIMESTONE above: stone B, N7 C). Ashlar dry-laid
  // without mortar (SITE_SPEC terrace.wall_material, B: 'dry-laid'; Grand Stair 'dry-jointed', B) and, by the Achaemenid
  // practice of anathyrosis (recollection, C; Q-071), fitted to hairline joints: 0.8 mm (C), not a sunk mortar groove
  limestone: { albedo: LIMESTONE, roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.13, stone: STONE, tone: { sd: 0.075, chroma: 0.01 }, foot: 1, wear: { alb: 0.05, rough: 0.2 }, runoff: 0.08, bump: { amp: 0.0015, freq: 6 }, micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'dressed light grey limestone (Iranica, B), dry-laid ashlar with hairline joints (B dry-laid; joint width C, Q-071); albedo N7 = 42 % C (D-188) pending calibration photo (NEEDS #13); D-218: block tone 1σ 14 %, rounded arrises, laminae, stylolites, pits, chisel facets (C, Q-480); stairs in blocks of 4–5 steps (B, Grand Stair; others C), treads foot-polished (C)' },
  // the merlons (D-218, rubric s7 fix 10: 'box stacks'): each a monolith of the same stone, its own tone, no joints across it
  // (it sits on its coping on the chamfered foot joint), dust on the step ledges and faint run-off under them (C)
  limestone_merlon: { albedo: LIMESTONE, roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, blockTone: 0.13, joints: HAIRLINE, stone: STONE, monolith: { w: 0.9, h: 0.9, steps: 4, dust: 0.14, runoff: 0.07 }, tone: { sd: 0.075, chroma: 0.01 }, bump: { amp: 0.0015, freq: 6 }, micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'four-stepped merlon: one block of the dressed light grey limestone (monolith C), its own tone, dust on the ledges and run-off (C, D-218)' },
  // carved members (column bases, shafts and capitals, colossi, relief figures): the same stone with no masonry joints drawn
  // (the block layout of carved members is unknown; a joint may cross a carving only as a hairline) and a finer, rubbed
  // finish (D-029, C)
  limestone_carved: { albedo: LIMESTONE, roughness: 0.55, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.1, tone: { sd: 0.06, chroma: 0.01 }, bump: { amp: 0.0004, freq: 14 }, micro: { amp: 0.00012, freq: 130, alb: 0.03 }, tier: 'C', note: 'carved light grey limestone (columns, colossi, reliefs): joint-free rubbed finish (D-029, C); albedo N7 C (D-188) pending calibration photo (NEEDS #13)' },
  // polished dark grey limestone of the door and window frames: 'dark grey limestone from Majdabad' (RELIEFS_AND_COLOUR §4,
  // Iranica via search extract: B). 'Dark grey' = N3 on the GSA rock-colour chart → luminous reflectance 6.4 % (ASTM D1535):
  // albedo C (D-031). Was 0.013 (sRGB 0.12), i.e. black. Whether frames carried the whitish finishing coat is Q-072.
  // D-218 (rubric s7 fix 2, 'the Tachara should be glossy near-black'): mirror-polished (roughness 0.18 → 0.10) and, as a
  // polish removes the surface scatter that lightens a honed face, the diffuse albedo N3 → N2.7 (6.4 → 5.2 %, C)
  limestone_dark: { albedo: grey(munsellY(2.7)), roughness: 0.1, porosity: 0.1, noiseScale: 2, noiseAmp: 0.05, tone: { sd: 0.05, chroma: 0.006 }, foot: 0.5, micro: { amp: 0.00003, freq: 160, alb: 0.02 }, tier: 'B/C', note: 'polished dark grey limestone (door/window frames): stone B (Majdabad dark grey, Iranica); D-218: mirror polish (the Tachara\'s "Hall of Mirrors" name, WP: C) as roughness 0.10 and the polished diffuse albedo N2.7 = 5.2 % (N3, the colour name, less the surface scatter a polish removes: C; Q-482); whitish finishing coat? (Q-072)' },
  // mud plaster on mud brick (D-188, Q-028): the evidenced default finish of the palace walls. Earthen plaster fragments
  // are reported from Persepolis and Pasargadae (Stein et al. 2016, npj Herit. Sci., search extract: B); the local loam
  // with straw, finished fine: a light buff (sRGB 0.64/0.55/0.43, L* 60, the town render's hue lightened as a fine clay
  // finish dries, C). The greyish yellow-green clay paint is attested only for the Treasury (Schmidt) and at
  // Pasargadae: `mudbrick_painted` below, used by the Treasury alone
  mudbrick: { albedo: [0.64, 0.55, 0.43], roughness: 0.93, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.09, tone: { sd: 0.1, chroma: 0.018, patch: -0.07 }, foot: 1, skirt: { h: 0.5, dark: 0.1, salt: 0.35 }, runoff: 0.1, plasterWork: { float: 1, cracks: 1 }, bump: { amp: 0.006, freq: 1.4 }, micro: { amp: 0.0006, freq: 55, alb: 0.05 }, tier: 'B/C', note: 'mud plaster on mud brick: earthen plaster B (Stein et al. 2016, search extract); its tone C (D-188). The green clay paint is not extended beyond the Treasury (Q-028); D-218: a renewed skirting coat ~0.5 m, rising damp and a salt tide line at the foot, hand-laid undulation ±6 mm (all C, Q-483)' },
  // the Treasury's walls: mud plaster coated with a greyish yellow-green clay paint, attested at Pasargadae and, per
  // Schmidt, on the Treasury walls (Stein et al. 2016, npj Herit. Sci., search extract: B for the coating); tone C
  mudbrick_painted: { albedo: [0.58, 0.57, 0.45], roughness: 0.9, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.09, tone: { sd: 0.1, chroma: 0.018, patch: -0.07 }, foot: 1, skirt: { h: 0.5, dark: 0.1, salt: 0.35 }, runoff: 0.1, plasterWork: { float: 1, cracks: 1 }, bump: { amp: 0.006, freq: 1.4 }, micro: { amp: 0.0006, freq: 55, alb: 0.05 }, tier: 'B/C', note: 'Treasury walls: mud plaster with a greyish yellow-green clay paint (Treasury walls per Schmidt; Pasargadae: via Stein et al. 2016, B); tone C; extent to other buildings open (Q-028)' },
  plaster: { albedo: [0.78, 0.74, 0.66], roughness: 0.85, porosity: 0.7, noiseScale: 0.8, noiseAmp: 0.08, roughVar: 0.1, tone: { sd: 0.09, chroma: 0.015, patch: 0.05 }, foot: 1, bump: { amp: 0.0022, freq: 2.4 }, micro: { amp: 0.00025, freq: 70, alb: 0.03 }, tier: 'C', note: 'lime/gypsum plaster' },
  // albedo (C, session 4): a hematite-like reflectance (~4–7 % below 580 nm rising to 30–50 % above 620 nm) integrated
  // with CIE 1931 / D65 gives linear ≈ (0.25–0.53, 0.034–0.085, 0.036–0.059), R/G 6–7.5; the old (0.48, 0.14, 0.10) sRGB
  // was R/G 11 (too little green and blue: the floors rendered as carpet red). Pigment B, value C
  plaster_red: { albedo: [0.56, 0.23, 0.20], roughness: 0.35, porosity: 0.3, noiseScale: 0.9, noiseAmp: 0.07, roughVar: 0.35, tone: { sd: 0.06, chroma: 0.012, patch: -0.04 }, wear: { alb: 0.05, rough: -0.3 }, bump: { amp: 0.0006, freq: 4 }, micro: { amp: 0.0001, freq: 85, alb: 0.03 }, tier: 'B', note: 'lime-plaster floor with two hematite-rich paint coats, deep red over white (Stein et al. 2016; flooring-plaster study 2022, Treasury/Edifice C/Tachara: search extracts, B); polish C; the traffic lanes scuffed duller, not polished (D-216, C)' },
  bronze: { albedo: [0.55, 0.38, 0.2], roughness: 0.35, porosity: 0.0, noiseScale: 3, noiseAmp: 0.08, metal: 1, tier: 'C', note: 'bronze fittings' },
  // cedar (SITE_SPEC gate_nations.roof 'cedar beams', C; cedar from Lebanon for the Susa palace, DSf: A there): heartwood
  // light brown to reddish, darkened over 20–50 years under a roof: CIELAB L* 50, a* 9, b* 22 (C, D-188). Was sRGB
  // 0.32/0.23/0.15 (Y 5 %: a dark stained wood), under which the portico soffits rendered near-black
  timber: { albedo: [0.57, 0.44, 0.32], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, bump: { amp: 0.002, freq: 5 }, micro: { amp: 0.0003, freq: 60, alb: 0.06 }, tier: 'C', note: 'cedar beams (roof: SITE_SPEC, C); tone C (D-188)' },
  // the roofs: cedar (sides, top) with reed matting on the ceiling between the joists (D-188: cedar beams and an earth roof,
  // SITE_SPEC C; matting under the earth is the region's flat-roof build-up, RECOLLECTION, C). Reed, aged under the roof
  // and a little smoked: sRGB 0.55/0.47/0.33 (C)
  roof_timber: { albedo: [0.57, 0.44, 0.32], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, bump: { amp: 0.002, freq: 5 }, micro: { amp: 0.0003, freq: 60, alb: 0.06 }, under: 'matting', tier: 'C', note: 'roof: cedar beams (SITE_SPEC, C) with reed matting on the ceiling (C, D-188)' },
  matting: { albedo: [0.55, 0.47, 0.33], roughness: 0.9, porosity: 0.8, noiseScale: 1, noiseAmp: 0.1, tone: { sd: 0.06, chroma: 0.01 }, weave: { reed: 0.012, cell: 0.09, amp: 0.0015 }, tier: 'C', note: 'reed matting under the roof earth (C, D-188)' },
  // glazed brick (session 7: the frieze read as one flat blue slab): laid in courses with thin dark joints, each brick's glaze
  // its own tone (firing and glaze thickness). Brick 0.33 × 0.09 m face and 8 mm joints: the Achaemenid glazed bricks of
  // Susa are of this order (RECOLLECTION, NOT SEEN: C); colour and placement C (SITE_SPEC r_frieze)
  glazed: { albedo: [0.12, 0.33, 0.48], roughness: 0.25, porosity: 0.05, noiseScale: 3, noiseAmp: 0.06, foot: 0.5, joints: { course: 0.09, block: 0.33, width: 0.008, dark: 0.45 }, blockTone: 0.09, tier: 'C', note: 'glazed brick in courses (brick size C, recollection of the Susa bricks; colour and placement C)' },
  // open ground on the plain: loam with stones and a seasonal herb layer (C; fields and crops are Phase 7)
  earth: { albedo: [0.47, 0.39, 0.29], roughness: 0.95, porosity: 0.9, noiseScale: 0.4, noiseAmp: 0.14, bump: { amp: 0.02, freq: 0.9 }, chips: { cover: 0.06, size: 0.35, albedo: [0.55, 0.53, 0.49] }, herbs: 1, micro: { amp: 0.0005, freq: 70, alb: 0.08 }, tier: 'C', note: 'plain surface: loam, stones and a seasonal herb layer (C); fields Phase 7' },
  // the open courts of the Terrace: no source found for their surface (OPEN_QUESTIONS Q-027). Compacted fill with
  // limestone dressing chips over the levelled platform (C)
  court_fill: { albedo: [0.50, 0.46, 0.39], roughness: 0.9, porosity: 0.7, noiseScale: 0.5, noiseAmp: 0.1, tone: { sd: 0.1, chroma: 0.015 }, macro: { sd: 0.08, chroma: 0.015 }, debris: true, traffic: true, pebbles: { cover: 0.07, size: 0.45, albedo: [0.66, 0.64, 0.59] }, bump: { amp: 0.004, freq: 2.5 }, chips: { cover: 0.12, size: 0.06, albedo: [0.64, 0.62, 0.57] }, micro: { amp: 0.0004, freq: 70, alb: 0.06 }, tier: 'C', note: 'Terrace open court: compacted fill with limestone chips (surface unknown, Q-027: C)' },
  terrace: { albedo: LIMESTONE, roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.13, stone: STONE, tone: { sd: 0.075, chroma: 0.01 }, foot: 1, runoff: 0.08, bump: { amp: 0.0015, freq: 6 }, top: 'court_fill', micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'Terrace platform: dressed limestone retaining walls, dry-laid with hairline joints (Q-071); open court surface C (Q-027)' },
  scaffold: { albedo: [0.45, 0.35, 0.24], roughness: 0.85, porosity: 0.5, noiseScale: 3, noiseAmp: 0.1, tier: 'C', note: 'timber scaffold poles' },
  rubble: { albedo: LIMESTONE, roughness: 0.9, porosity: 0.5, noiseScale: 2, noiseAmp: 0.2, bump: { amp: 0.01, freq: 3 }, micro: { amp: 0.0015, freq: 32, alb: 0.06 }, tier: 'C', note: 'stone chips: the Terrace limestone (albedo as `limestone`, D-188)' },
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
  // distances to the bed joints below and above (D-218: the side tells the worn arris which way it faces)
  const above = step(split, f), dBelow = f.sub(above.mul(split)), dAbove = mix(split, float(H), above).sub(f);
  const dBed = min(dBelow, dAbove), sBed = step(dBelow, dAbove).mul(2).sub(1); // +1: the nearest bed joint is below
  return { dBed, sBed, c, ...headCells(a, J.block, V.jitter, c) };
}
/** head joints along a course `c` (D-157): a hashed bond offset, each joint jittered by ±jitter/2 of the block length L.
 *  Returns the distance (m) to the nearest head joint, its side (sHead +1: the joint is at smaller `a`) and the block index */
function headCells(a: any, L: number, jitter: number, c: any) {
  const u = a.sub(hash12(c, 3.71).mul(L)).div(L), j0 = floor(u);
  const u0 = j0.add(hash12(c, j0).sub(0.5).mul(jitter * 0.5)), u1 = j0.add(1).add(hash12(c, j0.add(1)).sub(0.5).mul(jitter * 0.5));
  const d0 = abs(u.sub(u0)), d1 = abs(u.sub(u1)), near0 = step(d0, d1);
  const dHead = min(d0, d1).mul(L), sHead = sign(u.sub(mix(u1, u0, near0)));
  const blk = j0.sub(1).add(step(u0, u)).add(step(u1, u));
  return { dHead, sHead, blk };
}
/** bandCover() with the half width as a node */
function bandCoverN(d: any, px: any, hw: any) {
  const h = px.mul(0.5);
  return clamp(min(hw, d.add(h)).sub(max(hw.negate(), d.sub(h))).max(0).div(px), 0, 1);
}
/** per-block random values in [0, 1) from a block's two indices (D-218): t1, t2 (tone), w (warm/cool) are hashes; the rest
 *  are cheap decorrelated mixes of them. CPU mirror: tests/surfaces_d218.test.ts */
interface Ids { t1: any; t2: any; w: any; a: any; b: any; c: any; d: any; e: any; f: any; g: any; h: any }
function blockIds(blk: any, c: any): Ids {
  const t1 = hash12(blk.add(0.37), c.add(11.3)), w = hash12(c.mul(1.618).add(5.1), blk.add(2.9)), t2 = hash12(blk.mul(0.71).add(19.1), c.add(3.3));
  const mixh = (x: number, y: number, z: number) => fract(t1.mul(x).add(w.mul(y)).add(t2.mul(z)));
  return { t1, t2, w, a: mixh(97.1, 0, 13.3), b: mixh(61.7, 17.3, 0), c: mixh(0, 29.9, 43.1), d: mixh(71.3, 0, 11.7), e: mixh(7.1, 53.9, 0), f: mixh(5.9, 0, 23.3), g: mixh(0, 37.1, 19.7), h: mixh(13.7, 41.3, 3.1) };
}
/** the per-block tone (RGB factor): D-218's triangular 1σ `blockSd` or D-157's uniform ±`blockTone`; the warm/cool split */
function blockToneFactor(J: Joints, d: SurfaceDef, id: Ids) {
  const tri = J.blockSd !== undefined;
  const dev = tri ? id.t1.add(id.t2).sub(1) : id.t1.mul(2).sub(1);
  const tone = float(1).add(dev.mul(mix(float(0.08), float(tri ? J.blockSd! * Math.sqrt(6) : (d.blockTone ?? 0.08)), SURF_AB)));
  const wc = id.w.mul(2).sub(1).mul(J.warmCool ?? 0).mul(SURF_AB);
  return vec3(tone.mul(float(1).add(wc)), tone.mul(float(1).add(wc.mul(0.2))), tone.mul(float(1).sub(wc.mul(1.2))));
}
/** 1σ of mx_noise_float(vec2), measured on the CPU mirror (tests/lib/mx_noise_cpu.ts, 200,000 samples) */
export const MX_NOISE2_SD = 0.319;
/** the laminae's two octaves: wavelength (m) and weight (D-218) */
export const LAMINAE: [number, number][] = [[0.35, 1], [0.09, 0.5]];
export const LAM_NORM = 1 / (MX_NOISE2_SD * Math.hypot(...LAMINAE.map(o => o[1])));
/** the stylolites' spacing (m) in a block: 0.22 + 0.35 × a hash */
export const STYLO_SPACING: [number, number] = [0.22, 0.35];
/** the mean albedo factor of the pits over the blocks (mean cover 1 − exp(−π r²) at the per-block radius r × (0.3 + 1.4 h),
 *  h uniform), divided out so that the stone's mean albedo is unchanged */
export function pitMean(P: StoneDef['pits']) { let s = 0; const N = 256; for (let i = 0; i < N; i++) { const r = P.r * (0.3 + 1.4 * (i + 0.5) / N); s += 1 - P.dark * (1 - Math.exp(-Math.PI * r * r)); } return s / N; }
/** the mean albedo factor of the stylolites on vertical faces: share × darkening × seam width / spacing */
export function styloMean(S: StoneDef['stylo']) { let s = 0; const N = 256; for (let i = 0; i < N; i++) s += S.w / (STYLO_SPACING[0] + STYLO_SPACING[1] * (i + 0.5) / N); return 1 - S.share * S.dark * s / N; }
/** the stone inside a block (StoneDef, D-218): `q` = the face's own 2-D frame (m: along the course or x, up the wall or z),
 *  `vs` = 1 on vertical faces, `id` = the block's random values, `fp` = the pixel footprint (m). Returns the albedo factor,
 *  a height to add and a tilt in the face frame (radians along q.x, q.y) */
function stoneDetail(S: StoneDef, q: any, vs: any, id: Ids, fp: any) {
  // bedding laminae: bands along the bed on vertical faces (slightly wavy, varying along the block), a stretched mottle on
  // bedding planes (up-facing). Per-block amplitude 0.25–1.75 × beds; each octave band-limited (fades under ~3–7 px)
  const amp = float(S.beds * LAM_NORM).mul(float(0.25).add(id.c.mul(1.5))).mul(SURF_AB);
  const wave = sin(q.x.mul(2.1).add(id.d.mul(40))).mul(0.03), stretch = mix(float(0.6), float(0.12), vs);
  let lam: any = float(0);
  LAMINAE.forEach(([L, w], i) => { lam = lam.add(mx_noise_float(vec2(q.y.add(wave).div(L), q.x.div(L).mul(stretch).add((i ? id.e : id.d).mul(37.7)))).mul(w).mul(bandLimit(fp, L))); });
  let f: any = float(1).add(lam.mul(amp));
  // stylolites (vertical faces, a share of the blocks): dark seams along the bed with their sawtooth and a slow wave
  const present = step(id.f, float(S.stylo.share)).mul(vs).mul(SURF_AB);
  const sp = float(STYLO_SPACING[0]).add(id.g.mul(STYLO_SPACING[1]));
  const y2 = q.y.add(sin(q.x.mul(6.1).add(id.g.mul(50))).mul(0.018)).add(sin(q.x.mul(19.3).add(id.a.mul(23))).mul(0.007)).add(abs(fract(q.x.div(0.008)).mul(2).sub(1)).mul(0.003));
  const dist = abs(fract(y2.div(sp).add(id.c)).sub(0.5)).mul(sp);
  const seam = bandCoverN(dist, fwidth(dist).max(1e-6), float(S.stylo.w / 2)).mul(present);
  f = f.mul(float(1).sub(seam.mul(S.stylo.dark))).div(mix(float(1), float(styloMean(S.stylo)), vs.mul(SURF_AB)));
  // fossil moulds and pits: a Worley scatter, denser in some blocks; resolved near, their mean cover beyond (D-147 rule)
  const cq = q.div(S.pits.cell), wv = mx_worley_noise_float_2d(cq);
  const r = float(S.pits.r).mul(float(0.3).add(id.h.mul(1.4)));
  const near = float(1).sub(smoothstep(0.25, 0.6, fwidth(cq).length()));
  const pitN = float(1).sub(smoothstep(r.mul(0.75), r, wv));
  const pit = mix(float(1).sub(exp(r.mul(r).mul(-Math.PI))), pitN, near).mul(SURF_AB);
  f = f.mul(float(1).sub(pit.mul(S.pits.dark))).div(mix(float(1), float(pitMean(S.pits)), SURF_AB));
  let h: any = pitN.mul(near).mul(-S.pits.depth).mul(SURF_AB);
  // the tool: chisel facets along a per-block stroke direction (45° ± 40°), each tilted; fine striations inside them
  const ang = float(Math.PI / 4).add(id.b.sub(0.5).mul(1.4)), cs = cos(ang), sn = sin(ang);
  const u = q.x.mul(cs).add(q.y.mul(sn)), v = q.y.mul(cs).sub(q.x.mul(sn));
  const iv = floor(v.div(S.tool.w)), iu = floor(u.div(S.tool.l).add(hash12(iv, 1.7)));
  const vis = float(1).sub(smoothstep(0.15, 0.35, fp.div(S.tool.w))).mul(SURF_AB);
  const tf = vec2(hash12(iu, iv.add(5.5)).sub(0.5), hash12(iv.add(2.2), iu).sub(0.5)).mul(2 * S.tool.tilt).mul(vis);
  const visS = float(1).sub(smoothstep(0.15, 0.35, fp.div(S.tool.pitch))).mul(SURF_AB);
  h = h.add(sin(v.mul((2 * Math.PI) / S.tool.pitch)).mul(S.tool.groove).mul(visS));
  return { f, h, tf };
}

/** D-218: the lattice-free frame of the surface noise. mx_noise_float is Perlin gradient noise on the integer lattice: on a
 *  plane that is a lattice plane (a floor at y = 0 or at any height where y × frequency is a whole number, a wall at such an x
 *  or z) it is zero on a regular grid of nodes, and its bump normals drew a quilt of pyramids 1/frequency apart over the
 *  floor (the Grand Stair's top landing at the court datum y = 0, under the braziers at grazing light: lead's brazier-close
 *  render, session 7). The world position is turned into a frame rotated about two axes (Rz 0.47 · Rx 0.61 rad) before it
 *  enters the noise, so no axis-aligned floor or wall is a lattice plane; the rotation keeps lengths, so every frequency,
 *  band limit and 1σ is unchanged */
export const NOISE_FRAME: [number, number, number][] = [[0.89157, -0.37121, 0.25944], [0.45289, 0.73077, -0.51075], [0, 0.57287, 0.81965]];
const latticeFree = (p: any) => vec3(dot(p, v3(NOISE_FRAME[0])), dot(p, v3(NOISE_FRAME[1])), dot(p, v3(NOISE_FRAME[2])));
export interface Layer { alb: any; rough: any; height: any | null; tilt?: any }
/** albedo, roughness and height of one surface definition (before weather). `arch`: the architecture's own meshes, whose
 *  vertices carry the part's base height (`y0`) and, on hall floors, the floor's box (`pbox`: centre x, z, half size x, z) */
function layer(d: SurfaceDef, base: any, arch = false): Layer {
  const p = positionWorld, n = normalWorld, pr = latticeFree(p); // pr: the noise's own frame (D-218, below)
  // mottling: broad variation (metre scale) + fine grain; mx_noise is ~[-1,1] so amplitudes are fractions of albedo. With a
  // broad tone (D-157) only the fine octave stays (as grain), the broad field is toneFactor()
  const fine = mx_noise_float(pr.mul(d.noiseScale * 9.0)).mul(d.noiseAmp * 0.12);
  const mott = d.tone ? fine.add(mx_noise_float(pr.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(pr.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).mul(float(1).sub(SURF_AB)))
    : mx_noise_float(pr.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(pr.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).add(fine);
  let alb = base.mul(float(1).add(mott));
  if (d.tone) alb = alb.mul(toneFactor(pr, d.tone));
  let rough: any = float(d.roughness);
  if (d.roughVar) rough = rough.mul(float(1).add(mx_noise_float(p.mul(0.9).add(3.7)).mul(0.7).add(mx_noise_float(p.mul(3.1).add(1.3)).mul(0.3)).mul(d.roughVar))).clamp(0.04, 1);
  let height: any = null, tilt: any = undefined;
  if (d.bump) { // two octaves of relief: broad undulation (trowel / settling) + fine grain
    // band-limited by the pixel footprint as the micro grain is (D-217): an octave whose period spans under ~3 px fades to
    // its mean. Unfiltered, the fine octave (5.3 × freq: 0.31 m on the Naqsh cliff) aliased from 200 m and its screen-space
    // bump normals drew a moiré of wavy lines over the whole face (rubric s7 pass 2, R9)
    const fpB = fwidth(p).length().max(1e-6), bandB = (freq: number) => float(1).sub(smoothstep(0.15, 0.35, fpB.mul(freq)));
    height = mx_noise_float(pr.mul(d.bump.freq)).mul(d.bump.amp).mul(bandB(d.bump.freq)).add(mx_noise_float(pr.mul(d.bump.freq * 5.3)).mul(d.bump.amp * 0.35).mul(bandB(d.bump.freq * 5.3)));
  }
  if (d.micro) { // fine grain, band-limited by the pixel footprint (D-147)
    const fade = float(1).sub(smoothstep(0.15, 0.35, fwidth(p).length().max(1e-6).mul(d.micro.freq)));
    height = (height ?? float(0)).add(mx_noise_float(pr.mul(d.micro.freq)).mul(d.micro.amp).mul(fade));
    alb = alb.mul(float(1).add(mx_noise_float(pr.mul(d.micro.freq * 1.9).add(7.3)).mul(d.micro.alb ?? 0.04).mul(fade)));
  }
  if (d.plasterWork) { // plaster work (D-188, C): float arcs and hairline shrinkage cracks, band-limited by the pixel footprint
    const PW = d.plasterWork, fp = fwidth(p).length().max(1e-6);
    if (PW.float) {
      // a float swept in arcs: rings ~5 cm apart round the centres of 0.45 m cells (3-D cells: any wall plane cuts them in
      // circles), shown in patches (a pass here and there, not a pattern over the whole wall)
      const F1 = mx_worley_noise_vec2(p.div(0.45).add(vec3(5.3, 1.7, 9.1)), 1).x.max(0).sqrt().mul(0.45);
      const ring = abs(fract(F1.div(0.05)).mul(2).sub(1)); // 0 on an arc's ridge … 1 between
      const vis = float(1).sub(smoothstep(0.12, 0.3, fp.div(0.05))).mul(smoothstep(-0.1, 0.35, mx_noise_float(p.div(1.3).add(vec3(2.2, 8.4, 0.6))))).mul(PW.float).mul(SURF_AB);
      const r0 = ring.sub(0.5).mul(vis);
      alb = alb.mul(float(1).add(r0.mul(0.05)));
      rough = rough.mul(float(1).add(r0.mul(0.12)));
      height = (height ?? float(0)).add(float(1).sub(ring).mul(0.00025).mul(vis));
    }
    if (PW.cracks) {
      // shrinkage cracks along the borders of ~0.3 m cells (distance to the border ≈ (F2 − F1)/2), 1.2 mm wide: a sub-pixel
      // crack box-filters to a faint line with distance (bandCover), never aliasing
      const W = mx_worley_noise_vec2(p.div(0.3).add(vec3(13.1, 4.9, 7.3)), 1);
      const dB = W.y.max(0).sqrt().sub(W.x.max(0).sqrt()).mul(0.15);
      const where = smoothstep(0.15, 0.45, mx_noise_float(p.div(1.8).add(vec3(7.7, 3.1, 1.9))));
      const crack = bandCover(dB, fwidth(dB).max(1e-6), 0.0006).mul(where).mul(PW.cracks).mul(SURF_AB);
      alb = alb.mul(float(1).sub(crack.mul(0.55)));
      rough = mix(rough, float(1), crack);
      height = (height ?? float(0)).sub(crack.mul(0.0008).mul(float(1).sub(smoothstep(0.3, 0.8, fp.div(0.0024)))));
    }
  }
  if (d.weave) { // plaited reed mat (D-188, C), band-limited: where a reed spans under ~3 px only the cells' tone remains
    const W = d.weave, q = p.xz, cell = floor(q.div(W.cell)), alt = fract(cell.x.add(cell.y).mul(0.5)).mul(2); // 0 | 1
    const u = mix(q.x, q.y, alt), other = mix(cell.y, cell.x, alt);
    const r = fract(u.div(W.reed)), ridge = float(1).sub(r.mul(2).sub(1).mul(r.mul(2).sub(1)));
    const vis = float(1).sub(smoothstep(0.15, 0.35, fwidth(u).div(W.reed)));
    const tone = hash12(floor(u.div(W.reed)).add(alt.mul(517.3)), other).sub(0.5);
    const cellTone = hash12(cell.x.add(3.1), cell.y.add(8.7)).sub(0.5);
    alb = alb.mul(float(1).add(tone.mul(0.12).mul(vis)).sub(float(1).sub(ridge).mul(0.1).mul(vis)).add(cellTone.mul(0.06)));
    height = (height ?? float(0)).add(ridge.mul(W.amp).mul(vis));
  }
  if (d.macro) { // ground: broad tone at 30 and 12 m, and a faint chroma shift (D-188, C)
    const q = p.xz;
    const m = mx_noise_float(q.div(30).add(vec2(3.3, 7.1))).add(mx_noise_float(q.div(12).add(vec2(9.4, 1.2))).mul(0.6)).mul(d.macro.sd / (MX_NOISE_SD * Math.hypot(1, 0.6))).mul(SURF_AB);
    const c = mx_noise_float(q.div(22).add(vec2(5.5, 2.8))).mul((d.macro.chroma ?? 0) / MX_NOISE_SD).mul(SURF_AB);
    alb = alb.mul(vec3(float(1).add(m).add(c), float(1).add(m), float(1).add(m).sub(c))).max(0);
  }
  if (d.monolith && d.joints) { // one stone per instance (D-218: the merlons): tone, stone detail, ledge dust, run-off
    const J = d.joints, M = d.monolith, vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y))), flat = smoothstep(0.7, 0.9, n.y), vs = step(0.5, vert);
    const hl = vec2(n.x, n.z).length().max(1e-3), tx = n.z.div(hl), tz = n.x.negate().div(hl), t = p.x.mul(tx).add(p.z.mul(tz));
    const iid = float(instanceIndex);
    const ids = blockIds(iid.add(0.5), float(517.3));
    alb = alb.mul(blockToneFactor(J, d, ids));
    const Tq1 = mix(vec3(1, 0, 0), vec3(tx, 0, tz), vs), Tq2 = mix(vec3(0, 0, 1), vec3(0, 1, 0), vs);
    if (J.tilt) tilt = Tq1.mul(ids.a.mul(2).sub(1)).add(Tq2.mul(ids.e.mul(2).sub(1))).mul(J.tilt).mul(vert.add(flat)).mul(SURF_AB);
    if (d.stone) {
      const q = mix(vec2(p.x, p.z), vec2(t, p.y), vs);
      const R = stoneDetail(d.stone, q, vs, ids, fwidth(p).length().max(1e-6));
      alb = alb.mul(R.f); height = (height ?? float(0)).add(R.h);
      const tq = Tq1.mul(R.tf.x).add(Tq2.mul(R.tf.y)); tilt = tilt ? tilt.add(tq) : tq;
    }
    // dust on the ledges (up-facing), run-off streaks under each ledge (the stepped outline's top above the point, in the
    // geometry's own frame: x across −w/2…w/2, y up from the foot)
    const pg = positionGeometry, sw = M.w / 2 / M.steps, sh = M.h / M.steps;
    const top = min(float(M.steps), floor(float(M.w / 2 + 0.002).sub(abs(pg.x)).div(sw)).add(1)).mul(sh), below = top.sub(pg.y).max(0);
    const st = smoothstep(0.1, 0.7, mx_noise_float(vec3(p.x.mul(9), p.y.mul(0.8), p.z.mul(9)).add(vec3(3.3, 1.1, 7.7))).mul(0.5).add(0.5));
    alb = alb.mul(float(1).sub(st.mul(float(1).sub(smoothstep(0.02, 0.2, below))).mul(vert).mul(M.runoff).mul(SURF_AB)));
    alb = mix(alb, DIRT, flat.mul(M.dust).mul(smoothstep(-0.3, 0.3, mx_noise_float(p.mul(4.1).add(vec3(1.3, 0, 5.5))))).mul(SURF_AB));
  } else if (d.joints && d.joints.vary) { // varied ashlar (D-157, D-218): hairline joints with worn arrises, per-block tone and tilt
    const J = d.joints, vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y))), flat = smoothstep(0.7, 0.9, n.y), vs = step(0.5, vert);
    // vertical faces: courses up the wall, blocks along the face's own horizontal axis (rotated walls keep their lengths)
    const hl = vec2(n.x, n.z).length().max(1e-3), tx = n.z.div(hl), tz = n.x.negate().div(hl);
    const t = p.x.mul(tx).add(p.z.mul(tz));
    const W = ashlarCells(t, p.y, J);
    // up-facing faces: slabs in rows along z, blocks along x; the height enters the hash so every tread of a non-step part
    // (a stepped parapet) is its own block row
    const S = ashlarCells(p.x, p.z, J);
    // tread heights in 5.8 cm bins, scaled and offset off round numbers: a tread at a round height (0.10 m × k) would sit
    // exactly on a bin edge and speckle between two tones
    const riseRow = floor(p.y.mul(17.3).add(0.371));
    // stairs (D-218): the steps of a flight in block rows of 4–5 (arch meshes: the `stair` attribute, meshes.ts stairRows);
    // blocks along the step (`across`), the row's joint across the first tread of each row. ST.zw = the rising direction
    const ST = arch ? attribute('stair', 'vec4') : vec4(0, 0, 0, 0), B = arch ? attribute('pbox', 'vec4') : vec4(0, 0, -1, -1);
    const isStep = step(0.05, abs(ST.y)), sdx = ST.z, sdz = ST.w;
    const across = p.z.mul(sdx).sub(p.x.mul(sdz)), cStair = ST.x.add(abs(ST.y).mul(1000));
    const SH = headCells(across, STAIR_BLOCK.length, STAIR_BLOCK.jitter, cStair);
    const along = p.x.sub(B.x).mul(sdx).add(p.z.sub(B.y).mul(sdz));
    const tHalf = abs(B.z).mul(abs(sdx)).add(abs(B.w).mul(abs(sdz))), wHalf = abs(B.z).mul(abs(sdz)).add(abs(B.w).mul(abs(sdx))).max(0.1);
    const rowAt = along.sub(tHalf.sub(STAIR_BLOCK.rowJoint)), rowD = abs(rowAt).add(float(1).sub(step(ST.y, -0.05)).mul(1e3));
    // a step's side faces (normal along the step) carry no head joints: `across` is constant over them
    const headMask = float(1).sub(isStep.mul(vs).mul(step(0.7, abs(n.z.mul(sdx).sub(n.x.mul(sdz))))));
    const big = float(1e3);
    const dB = mix(mix(S.dBed, W.dBed, vs), mix(rowD, big, vs), isStep), sB = mix(mix(S.sBed, W.sBed, vs), mix(sign(rowAt), float(0), vs), isStep);
    const dH = mix(mix(S.dHead, W.dHead, vs), SH.dHead, isStep), sH = mix(mix(S.sHead, W.sHead, vs), SH.sHead, isStep);
    const pxB = mix(mix(fwidth(p.z), fwidth(p.y), vs), mix(fwidth(along), fwidth(p.y), vs), isStep).max(1e-6);
    const pxH = mix(mix(fwidth(p.x), fwidth(t), vs), fwidth(across), isStep).max(1e-6);
    // world tangents: T1 along the head-joint coordinate, T2 across the bed joints
    const T1 = mix(mix(vec3(1, 0, 0), vec3(tx, 0, tz), vs), vec3(sdz.negate(), 0, sdx), isStep);
    const T2 = mix(mix(vec3(0, 0, 1), vec3(0, 1, 0), vs), mix(vec3(sdx, 0, sdz), vec3(0, 1, 0), vs), isStep);
    // per block: two indices → hashes (the steps of one row and block share them, riser and tread alike)
    const blkU = mix(mix(S.blk.add(riseRow.mul(7.1)), W.blk, vs), SH.blk, isStep), cU = mix(mix(S.c, W.c, vs), cStair, isStep);
    const ids = blockIds(blkU, cU);
    // slab joints only on up-facing faces of parts at least 1.5 m across both ways (landings, pavements) and on stair treads
    // (their rows and blocks, D-218); a parapet's coping is one block across (arch meshes: pbox)
    const slabs = arch ? step(0.75, min(abs(B.z), abs(B.w))) : float(0);
    const jmask = vs.add(float(1).sub(vs).mul(flat).mul(max(slabs, isStep)));
    const hw = J.width / 2, lw = float(J.lip ?? 0).mul(float(0.5).add(ids.b)).add(hw); // the arris rounded over 3–9 mm (lip 6 mm)
    const slotB = bandCover(dB, pxB, hw), slotH = bandCover(dH, pxH, hw).mul(headMask);
    const lipB = bandCoverN(dB, pxB, lw).sub(slotB).max(0), lipH = bandCoverN(dH, pxH, lw).mul(headMask).sub(slotH).max(0);
    const slot = max(slotB, slotH).mul(jmask), lip = max(lipB, lipH).mul(jmask);
    alb = alb.mul(float(1).sub(slot.mul(J.dark)).sub(lip.mul(J.lipDark ?? 0).mul(SURF_AB)));
    rough = mix(rough, float(1), slot);
    // the worn arris as a filtered normal (D-218): over its share of the pixel, the rounded lip turns ~40° toward the joint
    // (away from the block's face): the upper block's lower arris looks down, the lower block's upper arris up, so in sun a
    // bed joint is a dark and a light line a few mm apart, as a real rounded joint is. Replaces D-157's height lip
    tilt = T1.mul(sH.mul(lipH)).add(T2.mul(sB.mul(lipB))).mul(-ARRIS_K).mul(jmask).mul(SURF_AB);
    alb = alb.mul(blockToneFactor(J, d, ids));
    if (J.tilt) tilt = tilt.add(T1.mul(ids.a.mul(2).sub(1)).add(T2.mul(ids.e.mul(2).sub(1))).mul(J.tilt).mul(vert.add(flat)).mul(SURF_AB));
    let polish: any = float(0);
    if (arch && d.stone?.polish) { // foot polish on the treads (D-218, C): the middle of the flight, most toward the nosing
      const across0 = B.y.mul(sdx).sub(B.x.mul(sdz)), lat = abs(across.sub(across0)).div(wHalf);
      const front = clamp(float(0.5).sub(along.div(tHalf.max(0.05).mul(2))), 0, 1);
      polish = isStep.mul(flat).mul(float(1).sub(smoothstep(0.3, 0.9, lat))).mul(float(0.55).add(front.mul(0.45))).mul(SURF_AB);
      rough = rough.mul(float(1).sub(polish.mul(d.stone.polish)));
      alb = alb.mul(float(1).sub(polish.mul(0.04)));
      // grit and dust at the ends of the treads, where no one walks (C)
      alb = mix(alb, DIRT, isStep.mul(flat).mul(smoothstep(0.8, 1.0, lat)).mul(0.12).mul(SURF_AB));
    }
    if (d.stone) {
      // face frame: (along the course or x, up the wall or z); the steps' faces use the same world frame
      const q = mix(vec2(p.x, p.z), vec2(t, p.y), vs);
      const R = stoneDetail(d.stone, q, vs, ids, fwidth(p).length().max(1e-6));
      const worn = float(1).sub(polish.mul(0.8)); // the treads' tool marks and pit edges worn smooth where they are polished
      alb = alb.mul(R.f); height = (height ?? float(0)).add(R.h.mul(worn));
      const Tq1 = mix(vec3(1, 0, 0), vec3(tx, 0, tz), vs), Tq2 = mix(vec3(0, 0, 1), vec3(0, 1, 0), vs);
      tilt = tilt.add(Tq1.mul(R.tf.x).add(Tq2.mul(R.tf.y)).mul(worn));
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
  // the masons' yard (D-188): 0…1 inside the yard (soft 1.5 m edges, ragged) and round a block in work
  let debris: any = null;
  if (d.debris) {
    const R = DEBRIS.rect, Wk = DEBRIS.work, x = p.x, z = p.z, rag = mx_noise_float(p.xz.div(2.3).add(vec2(1.7, 6.2))).mul(1.2);
    const inX = smoothstep(0, 1.5, min(x.sub(R.x), R.z.sub(x)).add(rag)), inZ = smoothstep(0, 1.5, min(z.sub(R.y), R.w.sub(z)).add(rag));
    const work = float(1).sub(smoothstep(Wk.z.mul(0.4), Wk.z, vec2(x.sub(Wk.x), z.sub(Wk.y)).length().sub(rag))).mul(Wk.w);
    debris = max(inX.mul(inZ).mul(DEBRIS.amount).mul(0.7), work).clamp(0, 1);
  }
  // trodden ground (D-188): compacted fill along the doorway fans and door-to-door paths, ragged at the edges
  let trod: any = null;
  if (d.traffic) {
    const T = TRAFFIC, tuv = vec2(p.x.sub(T.x0).div(T.cell * T.N), p.z.negate().sub(T.y0).div(T.cell * T.N));
    const raw = texture(T.tex, tuv).r;
    trod = smoothstep(0.08, 0.7, raw.add(mx_noise_float(p.xz.div(1.1).add(vec2(8.8, 2.2))).mul(0.25))).mul(smoothstep(0.7, 0.9, n.y)).mul(SURF_AB);
  }
  if (d.chips) { // scattered stones/chips: cells of a Worley field below a threshold, raised and lighter
    const cq = p.xz.div(d.chips.size), w = mx_worley_noise_float(cq);
    // D-188: the density varies over ~7 m (thin and thick spreads, ×0.35…1.7), and where a cell spans under ~3 px the chips
    // give way to their mean cover (Poisson cells: 1 − exp(−π r²) inside the threshold radius r ≈ 1.25 × cover): the far
    // court was a regular sparkle of aliased chips, one "stamp" repeated over the whole ground (§8.2 rubric fix 10)
    let cv: any = clamp(float(1).add(mx_noise_float(p.xz.div(7).add(vec2(4.2, 9.9))).mul(0.9)), 0.35, 1.7).mul(d.chips.cover);
    if (debris) cv = cv.mul(float(1).add(debris.mul(3))).min(0.45);
    if (trod) cv = cv.mul(float(1).sub(trod.mul(0.7))); // the chips trodden in
    const near = float(1).sub(smoothstep(0.25, 0.6, fwidth(cq).length()));
    const mean = float(1).sub(exp(cv.mul(1.25).mul(cv.mul(1.25)).mul(-Math.PI)));
    const chipN = float(1).sub(smoothstep(cv.mul(0.9), cv.mul(1.6), w)); // (reversed smoothstep edges are undefined in WGSL)
    const chip = mix(mean, chipN, near).mul(smoothstep(0.4, 0.8, n.y));
    alb = mix(alb, color(new THREE.Color().setRGB(...d.chips.albedo, THREE.SRGBColorSpace)).mul(float(1).add(mott)), chip);
    rough = mix(rough, float(0.7), chip);
    // raised by about the chip's own radius (≈ cover × size in cell units; a pebble's proportions). It was size × 0.25:
    // 8.7 cm over a 2.5 cm chip on the earth, near-vertical bump normals, so every light chip rendered as a dark ring (session 3)
    if (height) height = height.add(chip.mul(near).mul(d.chips.size * d.chips.cover * 0.6));
    if (debris) alb = mix(alb, lin(LIMESTONE).mul(1.05), debris.mul(0.3)); // limestone dust over the yard
  }
  if (d.pebbles) { // D-188: a second, coarser scatter (stones and spalls 4–8 cm; the chips above are 1–2 cm and give way to
    // their mean beyond ~2 m at 540 rows): the texture of the fill at 3–20 m; denser in the masons' yard, fewer where trodden
    const P = d.pebbles, pq = p.xz.div(P.size).add(vec2(17.7, 3.1)), w2 = mx_worley_noise_float(pq);
    let pc: any = clamp(float(1).add(mx_noise_float(p.xz.div(11).add(vec2(2.4, 7.7))).mul(0.8)), 0.3, 1.7).mul(P.cover);
    if (debris) pc = pc.mul(float(1).add(debris.mul(3))).min(0.4);
    if (trod) pc = pc.mul(float(1).sub(trod.mul(0.8)));
    const nearP = float(1).sub(smoothstep(0.25, 0.6, fwidth(pq).length()));
    const meanP = float(1).sub(exp(pc.mul(1.25).mul(pc.mul(1.25)).mul(-Math.PI)));
    const peb = mix(meanP, float(1).sub(smoothstep(pc.mul(0.8), pc.mul(1.5), w2)), nearP).mul(smoothstep(0.4, 0.8, n.y));
    const tone = float(0.85).add(mx_noise_float(pq.mul(1.7)).mul(0.25)); // stone to stone
    alb = mix(alb, color(new THREE.Color().setRGB(...P.albedo, THREE.SRGBColorSpace)).mul(tone), peb);
    rough = mix(rough, float(0.75), peb);
    if (height) height = height.add(peb.mul(nearP).mul(P.size * P.cover * 0.5));
  }
  if (trod) { // compacted: a little darker and warmer (fines and dirt worked in), smoother (C)
    alb = alb.mul(vec3(float(1).sub(trod.mul(0.08)), float(1).sub(trod.mul(0.1)), float(1).sub(trod.mul(0.13))));
    rough = rough.sub(trod.mul(0.12));
  }
  if (d.rockBlocks) { // jointed rock (D-217): a tone per block and per bed, the cells' edges warped (world space: no projection)
    const B = d.rockBlocks, w = mx_noise_float(p.mul(0.07).add(vec3(3.3, 1.1, 7.7))).mul(0.9);
    const bi = floor(p.x.div(B.size[0]).add(w)), bj = floor(p.y.div(B.size[1]).add(w.mul(0.6)).add(p.x.mul(0.011))), bk = floor(p.z.div(B.size[2]).add(w));
    const hb = fract(sin(bi.mul(127.1).add(bj.mul(311.7)).add(bk.mul(74.7))).mul(43758.5453)).mul(2).sub(1);
    const hr = fract(sin(bj.mul(269.5).add(19.19)).mul(43758.5453)).mul(2).sub(1);
    alb = alb.mul(float(1).add(hb.mul(B.tone)).add(hr.mul(B.bed)));
  }
  if (d.streaks) { // vertical weathering streaks: noise fast across the face, slow down it (C)
    const f = d.streaks.freq, q = vec3(p.x.mul(f), p.y.mul(f * (d.streaks.stretch ?? 0.08)), p.z.mul(f));
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
    // D-188: 25 % toward the earth and 12 % darker at the foot (was 20 % and 5 %: on the buff mud plaster, the earth's own
    // hue, the band did not read): rain splash and rising damp darken a plastered foot more than it tints it (C)
    alb = mix(alb, DIRT, band.mul(0.25)).mul(float(1).sub(band.mul(0.12)));
    rough = mix(rough, float(0.95), band.mul(0.5));
  }
  if (arch && d.skirt) { // the foot of a plastered mud-brick wall (D-218, C): a renewed skirting coat, damp and a salt tide line
    const K = d.skirt, h = p.y.sub(attribute('y0', 'float')), vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y)));
    const along = vec3(p.x, float(0), p.z), aa = fwidth(h).max(1e-4), on = step(-0.01, h).mul(vert).mul(SURF_AB);
    // the coat's upper edge wanders ±0.12 m along the wall (re-plastered in stretches) and stands 4 mm proud
    const top = float(K.h).add(mx_noise_float(along.mul(0.45).add(vec3(2.1, 0, 6.3))).mul(0.3)).add(mx_noise_float(along.mul(3.1).add(vec3(5.2, 0, 1.4))).mul(0.03));
    const coat = float(1).sub(smoothstep(top.sub(aa).sub(0.004), top.add(aa), h)).mul(on);
    alb = alb.mul(vec3(float(1).sub(coat.mul(0.03)), float(1).sub(coat.mul(0.05)), float(1).sub(coat.mul(0.08)))); // fresher: less bleached
    height = (height ?? float(0)).add(coat.mul(0.004));
    // rising damp to ~3/4 of the coat, darkest at the foot, its edge a whitish salt line in patches
    const dampTop = top.mul(0.75).add(mx_noise_float(along.mul(1.7).add(vec3(8.1, 0, 3.9))).mul(0.06));
    const damp = float(1).sub(smoothstep(dampTop.sub(0.12), dampTop, h)).mul(float(0.6).add(float(1).sub(smoothstep(float(0), dampTop, h)).mul(0.4))).mul(on);
    alb = alb.mul(float(1).sub(damp.mul(K.dark)));
    rough = mix(rough, float(0.97), damp.mul(0.5));
    const salt = bandCoverN(abs(h.sub(dampTop)), aa, float(0.012)).mul(smoothstep(-0.2, 0.3, mx_noise_float(along.mul(0.9).add(vec3(4.4, 0, 9.2))))).mul(on);
    alb = mix(alb, vec3(0.78, 0.77, 0.74), salt.mul(K.salt));
  }
  if (arch && d.runoff) { // run-off below the tops of exposed stone (D-157, C): streaks fast across the face, slow down it
    const below = attribute('ytop', 'float').sub(p.y), vert = float(1).sub(smoothstep(0.3, 0.7, abs(n.y)));
    const q = vec3(p.x.mul(2.2), p.y.mul(0.2), p.z.mul(2.2));
    const st = smoothstep(0.15, 0.65, mx_noise_float(q.add(vec3(4.1, 0.3, 7.9))).mul(0.5).add(0.5).add(mx_noise_float(q.mul(2.7)).mul(0.15)));
    const fade = float(1).sub(smoothstep(0.2, 3, below)).mul(step(0, below)).mul(float(1).sub(roofedNode())); // no rain under the roofs (D-188)
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
    const wear = max(alongX, alongZ).mul(float(0.7).add(mx_noise_float(pr.mul(0.65).add(vec3(2.7, 0, 8.1))).mul(0.6))).clamp(0, 1).mul(up).mul(has).mul(SURF_AB);
    alb = alb.mul(float(1).sub(wear.mul(d.wear.alb)));
    rough = rough.mul(float(1).sub(wear.mul(d.wear.rough))).min(1);
    // dust along the walls (D-188, C): a swept floor keeps a film of dust and grit within ~0.4 m of its edges, where the
    // broom does not reach, thicker in the corners, patchy; the floor's box edges are its walls
    const edge = min(hx.sub(dx), hz.sub(dz)).max(0), corner = float(1).sub(smoothstep(0.2, 1.2, max(hx.sub(dx), hz.sub(dz))));
    const dust = float(1).sub(smoothstep(0.04, 0.45, edge)).mul(float(0.6).add(corner.mul(0.4)))
      .mul(smoothstep(-0.35, 0.25, mx_noise_float(pr.mul(1.7).add(vec3(6.1, 0, 3.3))))).mul(up).mul(has).mul(SURF_AB);
    alb = mix(alb, DIRT, dust.mul(0.3));
    rough = mix(rough, float(0.9), dust.mul(0.7));
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
  if (d.under && SURFACES[d.under]) { // down-facing faces use another surface (the ceiling's matting, D-188)
    const U = layer(SURFACES[d.under], lin(SURFACES[d.under].albedo), !!opts.arch); const t = smoothstep(0.7, 0.9, n.y.negate());
    L = { alb: mix(L.alb, U.alb, t), rough: mix(L.rough, U.rough, t), height: L.height && U.height ? mix(L.height, U.height, t) : (L.height ?? U.height), tilt: L.tilt ? L.tilt.mul(float(1).sub(t)) : undefined };
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
  // nothing is wet, puddled or snowed on under the halls' roofs (session 5: probes/roofs.ts)
  const open = float(1).sub(roofedNode());
  const wet = WEATHER.wetness.mul(float(0.55).add(up.mul(0.45))).mul(open);
  alb = alb.mul(float(1).sub(wet.mul(d.porosity * 0.5)));
  // puddles: only in the low spots of a broad noise field (≈15% of flat area at full puddle state), never a uniform sheen
  const puddle = up.mul(WEATHER.puddles).mul(open).mul(smoothstep(0.68, 0.74, mx_noise_float(p.mul(0.12)).mul(0.5).add(0.5)));
  // snow: zero when snow = 0 (noise only modulates coverage, never adds snow on its own)
  const snowMask = clamp(up.mul(WEATHER.snow).mul(open).mul(float(1.6).sub(mx_noise_float(p.mul(0.8)).add(1).mul(0.3))), 0, 1);
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
    else { (m as any).setupEnvironment = () => new SkySpecularNode(); (m as any).skySpecular = true; } // (materials built elsewhere as plain standard ones; the flag tells the SSR composite, D-216)
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
  // the paint's noise fields are faded to their mean where their period falls under ~3 pixels (D-204): the ~7 mm losses and the
  // pigment grain, point-sampled per pixel from a few metres away, turned every painted surface into salt-and-pepper speckle
  // and broke the paint edge along each outline into dots. The pixel footprint is |fwidth(world position)| in metres
  const foot = fwidth(p).length();
  const n01 = (x: any, freq: number) => mix(mx_noise_float(x).mul(0.5).add(0.5), float(0.5), smoothstep(0.2, 0.45, foot.mul(freq)));
  const thick = n01(p.mul(F.brush_freq), F.brush_freq).mul(1 - F.thickness_min).add(F.thickness_min);
  const opacity = float(1).sub(exp(thick.mul(-F.hiding)));
  const lossField = n01(p.mul(LS.freq), LS.freq).add(float(1).sub(cov).mul(LS.wear_bias));
  const kept = float(1).sub(smoothstep(LS.level - LS.soft, LS.level + LS.soft, lossField));
  const leaf = clamp(gilt, 0, 1).mul(smoothstep(0.05, 0.35, cov)).mul(kept); // gold leaf where it is not lost
  const film = clamp(cov, 0, 1).mul(opacity).mul(kept).mul(float(1).sub(leaf));
  const grain = float(1).add(mx_noise_float(p.mul(F.grain_freq)).mul(F.grain_amp).mul(float(1).sub(smoothstep(0.2, 0.45, foot.mul(F.grain_freq)))));
  const gold = vec3(G.f0[0], G.f0[1], G.f0[2]).mul(float(1).add(mx_noise_float(p.mul(G.grain_freq)).mul(G.grain_amp)));
  // the carving's own sky occlusion (D-217, relief_field.carvingOcclusion): the skylight at the foot of each contour and in
  // the folds scaled by 1 − 0.85 × occlusion, and grime held in the recesses (up to 15 % darker, C)
  const occ = clamp(attribute('ao', 'float'), 0, 1);
  const L: Layer = { alb: mix(mix(S.alb, pig.mul(grain), film), gold, leaf).mul(float(1).sub(occ.mul(0.15))), rough: mix(mix(S.rough, float(F.roughness), film), float(G.roughness), leaf), height: (S.height ?? float(0)).add(film.add(leaf).mul(F.relief)) };
  class GiltLighting extends (THREE as any).PhysicalLightingModel {
    indirectSpecular(builder: any) {
      const ctx = builder.context; // the skylight's irradiance (hemisphere light / probes), reflected by the gold only
      ctx.radiance.addAssign(ctx.irradiance.mul(leaf).mul(1 / Math.PI));
      super.indirectSpecular(builder);
    }
  }
  const m = new THREE.MeshStandardNodeMaterial();
  finish(m, L, d);
  m.aoNode = float(1).sub(occ.mul(0.85));
  m.metalnessNode = leaf;
  (m as any).setupLightingModel = () => new GiltLighting();
  m.userData = { tier: 'C', note: 'carved limestone (joint-free) with a matte mineral paint film: pigments B (RELIEFS_AND_COLOUR §3a), colour values, film and wear C (src/data/polychromy.json, D-030); gilding drawn as gold leaf (metal, D-151): gilding on the reliefs B (Iranica "Persepolis": traces of gold; Nagel 2010 "color and gilding"), the technique and the gilded zones C (Q-231); the brush, loss and grain noise of the film fade to their mean where a period falls under ~3 px (D-204)' };
  cache.set(key, m);
  return m;
}

/** Incised signs (D-177; src/render/incision.ts): the host stone's own surface (the same world-space layer and weather as the
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
  m.userData = { tier: 'C', note: `incised signs in ${surface} (D-177): the stone's own surface; V-section, walls at 45° (C)` };
  cache.set(key, m);
  return m;
}

/** the paint of the Treasury's plastered timber shafts (D-214, gap audit item 29, Q-020; SITE_SPEC treasury.r_shaft_paint, C):
 *  a ground, a lattice of lozenges `around` per turn and `lozenge_h` m tall drawn in lines `line_w` m wide, and a band `band_h`
 *  m tall at the foot and at the head of the shaft, edged `edge_w` m in the line colour. Colours are linear-light RGB. The
 *  pattern is in the column's own frame (positionGeometry: the axis vertical at x = z = 0, y from the foot of the base;
 *  y0..y1 the shaft), so every instance is painted alike; the plaster's own tone stays under the film; edges are filtered
 *  over the pixel footprint (fwidth), so the lattice does not shimmer at a distance */
export interface ShaftPaint { ground: [number, number, number]; line: [number, number, number]; band: [number, number, number]; around: number; lozenge_h: number; line_w: number; band_h: number; edge_w: number; y0: number; y1: number; D: number }
export function paintedShaftMaterial(P: ShaftPaint): THREE.MeshStandardNodeMaterial {
  const d = SURFACES.plaster, plasterLin = d.albedo.map(srgbToLinear) as [number, number, number];
  const m = surfaceMaterial('plaster', { variant: `shaft-paint:${JSON.stringify(P)}`, modify: (L: Layer) => {
    const pg = positionGeometry, h = pg.y, u = atan(pg.z, pg.x).div(2 * Math.PI).add(0.5); // turns round the axis, 0..1
    const W = (Math.PI * P.D) / P.around, k = Math.hypot(1 / W, 1 / P.lozenge_h), hw = float((P.line_w / 2) * k); // half a line, in lattice units
    const a = u.mul(P.around), b = h.sub(P.y0 + P.band_h).div(P.lozenge_h);
    const d1 = abs(fract(a.add(b).add(0.5)).sub(0.5)), d2 = abs(fract(a.sub(b).add(0.5)).sub(0.5));
    const lineOf = (q: any) => { const f = fwidth(q).max(1e-4); return float(1).sub(smoothstep(hw.sub(f), hw.add(f), q)); };
    const lattice = max(lineOf(d1), lineOf(d2));
    // the bands at the foot and the head, and their inner edges in the line colour (filtered over the pixel footprint)
    const aa = fwidth(h).max(1e-4), above = (y: number) => smoothstep(float(y).sub(aa), float(y).add(aa), h);
    const fTop = P.y0 + P.band_h, hBot = P.y1 - P.band_h;
    const band = max(float(1).sub(above(fTop)), above(hBot));
    const edge = max(above(fTop).mul(float(1).sub(above(fTop + P.edge_w))), above(hBot - P.edge_w).mul(float(1).sub(above(hBot))));
    const field = float(1).sub(band).sub(edge).max(0);
    let paint: any = mix(vec3(...P.ground), vec3(...P.line), lattice.mul(field));
    paint = mix(paint, vec3(...P.band), band); paint = mix(paint, vec3(...P.line), edge);
    // the film over the plaster: the plaster's tone (its albedo against its mean) modulates the paint (float and brush marks)
    const tone = L.alb.div(vec3(...plasterLin)).clamp(0.6, 1.4);
    return { alb: paint.mul(tone), rough: L.rough.mul(0.9), height: L.height, tilt: L.tilt };
  } });
  m.userData = { tier: 'C', note: `the Treasury shafts' paint (D-214, Q-020): painted 'in bright colours' (B); the scheme after the Persepolis and Pasargadae painted plaster (Stein et al. 2016, B) and the red floors: a ground, a lattice of lozenges in the line colour (${P.around} per turn, ${P.lozenge_h} m tall), bands at the foot and the head (all C; treasury.r_shaft_paint)` };
  return m;
}
