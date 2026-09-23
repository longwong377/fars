// Procedural PBR materials (Phase 3). No texture library is reachable (BLOCKERS B7), so surfaces are procedural in TSL:
// world-space noise for stone mottling, tooling and joints; porosity-driven darkening when wet; puddle smoothing on flat
// ground; snow on up-facing surfaces; a procedural height field per surface that perturbs the shading normal (surface
// gradient from screen-space derivatives), so plaster, fill and stone read as surfaces rather than flat colour.
// Albedo values are from the colour research where available (research/RELIEFS_AND_COLOUR.md), otherwise C. Every
// material carries tier metadata for the dev overlay.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, normalWorld, normalView, positionView, mx_noise_float, mx_worley_noise_float, vec3, float, mix, smoothstep, max, min, clamp, color, abs, fract, step, attribute, sign, fwidth, exp } from 'three/tsl';
import PC from '../data/polychromy.json';
import { linearToSrgb, munsellY } from '../core/colour';

export const WEATHER = { wetness: uniform(0), snow: uniform(0), puddles: uniform(0) };
/** seasonal ground cover (0..1): green = living herb layer, dry = standing straw/stubble (set per frame from the date; season.ts) */
export const SEASON = { green: uniform(0.8), dry: uniform(0.1) };

export interface SurfaceDef {
  albedo: [number, number, number]; roughness: number; porosity: number; noiseScale: number; noiseAmp: number;
  /** masonry joints (D-029): course height and block length (m, C pattern), joint width (m) and how much a joint darkens the
   *  albedo inside it. Drawn as an anti-aliased hairline (box-filtered over the pixel footprint), never as a sunk groove */
  joints?: { course: number; block: number; width: number; dark: number }; metal?: number; tier: string; note: string;
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
}
/** neutral grey of luminous reflectance Y (linear) as the sRGB triple the surface table uses */
function grey(Y: number): [number, number, number] { const v = linearToSrgb(Y); return [v, v, v]; }
/** hairline ashlar joints (D-029): course 1.05 m and block 2.2 m (the pattern is C: the true block layout is not modelled);
 *  width 0.8 mm (C: anathyrosis gives tight contact bands, Q-071); a joint that fine is a shadowed slot, its albedo 60 % darker */
const HAIRLINE = { course: 1.05, block: 2.2, width: 0.0008, dark: 0.6 };
export const SURFACES: Record<string, SurfaceDef> = {
  // Persepolis grey limestone, freshly dressed (C until colour research lands): mid-grey, slightly warm. Ashlar dry-laid
  // without mortar (SITE_SPEC terrace.wall_material, B: 'dry-laid'; Grand Stair 'dry-jointed', B) and, by the Achaemenid
  // practice of anathyrosis (recollection, C; Q-071), fitted to hairline joints: 0.8 mm (C), not a sunk mortar groove
  limestone: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.08, bump: { amp: 0.0015, freq: 6 }, micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'dressed grey limestone, dry-laid ashlar with hairline joints (B dry-laid; joint width C, Q-071); albedo C pending calibration photo (NEEDS #13)' },
  // carved members (column bases, shafts and capitals, colossi, relief figures): the same stone with no masonry joints drawn
  // (the block layout of carved members is unknown; a joint may cross a carving only as a hairline) and a finer, rubbed
  // finish (D-029, C)
  limestone_carved: { albedo: [0.44, 0.43, 0.40], roughness: 0.55, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.1, bump: { amp: 0.0004, freq: 14 }, micro: { amp: 0.00012, freq: 130, alb: 0.03 }, tier: 'C', note: 'carved limestone (columns, colossi, reliefs): joint-free rubbed finish (D-029, C); albedo C pending calibration photo (NEEDS #13)' },
  // polished dark grey limestone of the door and window frames: 'dark grey limestone from Majdabad' (RELIEFS_AND_COLOUR §4,
  // Iranica via search extract: B). 'Dark grey' = N3 on the GSA rock-colour chart → luminous reflectance 6.4 % (ASTM D1535):
  // albedo C (D-031). Was 0.013 (sRGB 0.12), i.e. black. Whether frames carried the whitish finishing coat is Q-072
  limestone_dark: { albedo: grey(munsellY(3)), roughness: 0.18, porosity: 0.1, noiseScale: 2, noiseAmp: 0.05, micro: { amp: 0.00003, freq: 160, alb: 0.02 }, tier: 'B/C', note: 'polished dark grey limestone (door/window frames): stone B (Majdabad dark grey, Iranica); albedo N3 = 6.4 % C (D-031); whitish finishing coat? (Q-072)' },
  // mud plaster on mud brick, coated with a greyish yellow-green clay paint: attested at Pasargadae and, per Schmidt, on
  // the Treasury walls (Stein et al. 2016, npj Herit. Sci., search extract: B for the coating); tone and extent C
  mudbrick: { albedo: [0.58, 0.57, 0.45], roughness: 0.93, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.07, bump: { amp: 0.004, freq: 1.4 }, micro: { amp: 0.0006, freq: 55, alb: 0.05 }, tier: 'B/C', note: 'mud plaster with greyish yellow-green clay paint (Pasargadae; Treasury walls per Schmidt, via Stein et al. 2016: B); tone and extent C' },
  plaster: { albedo: [0.78, 0.74, 0.66], roughness: 0.85, porosity: 0.7, noiseScale: 0.8, noiseAmp: 0.05, bump: { amp: 0.0015, freq: 3 }, micro: { amp: 0.00025, freq: 70, alb: 0.03 }, tier: 'C', note: 'lime/gypsum plaster' },
  plaster_red: { albedo: [0.48, 0.14, 0.1], roughness: 0.35, porosity: 0.3, noiseScale: 0.9, noiseAmp: 0.04, bump: { amp: 0.0006, freq: 4 }, micro: { amp: 0.0001, freq: 85, alb: 0.03 }, tier: 'B', note: 'lime-plaster floor with two hematite-rich paint coats, deep red over white (Stein et al. 2016; flooring-plaster study 2022, Treasury/Edifice C/Tachara: search extracts, B); polish C' },
  bronze: { albedo: [0.55, 0.38, 0.2], roughness: 0.35, porosity: 0.0, noiseScale: 3, noiseAmp: 0.08, metal: 1, tier: 'C', note: 'bronze fittings' },
  timber: { albedo: [0.32, 0.23, 0.15], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, bump: { amp: 0.002, freq: 5 }, micro: { amp: 0.0003, freq: 60, alb: 0.06 }, tier: 'C', note: 'cedar/timber beams' },
  glazed: { albedo: [0.12, 0.33, 0.48], roughness: 0.25, porosity: 0.05, noiseScale: 3, noiseAmp: 0.06, tier: 'C', note: 'glazed brick' },
  // open ground on the plain: loam with stones and a seasonal herb layer (C; fields and crops are Phase 7)
  earth: { albedo: [0.47, 0.39, 0.29], roughness: 0.95, porosity: 0.9, noiseScale: 0.4, noiseAmp: 0.14, bump: { amp: 0.02, freq: 0.9 }, chips: { cover: 0.06, size: 0.35, albedo: [0.55, 0.53, 0.49] }, herbs: 1, micro: { amp: 0.0012, freq: 55, alb: 0.08 }, tier: 'C', note: 'plain surface: loam, stones and a seasonal herb layer (C); fields Phase 7' },
  // the open courts of the Terrace: no source found for their surface (OPEN_QUESTIONS Q-027). Compacted fill with
  // limestone dressing chips over the levelled platform (C)
  court_fill: { albedo: [0.50, 0.46, 0.39], roughness: 0.9, porosity: 0.7, noiseScale: 0.5, noiseAmp: 0.1, bump: { amp: 0.004, freq: 2.5 }, chips: { cover: 0.12, size: 0.06, albedo: [0.64, 0.62, 0.57] }, micro: { amp: 0.0007, freq: 55, alb: 0.06 }, tier: 'C', note: 'Terrace open court: compacted fill with limestone chips (surface unknown, Q-027: C)' },
  terrace: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: HAIRLINE, blockTone: 0.08, bump: { amp: 0.0015, freq: 6 }, top: 'court_fill', micro: { amp: 0.00018, freq: 95, alb: 0.035 }, tier: 'C', note: 'Terrace platform: dressed limestone retaining walls, dry-laid with hairline joints (Q-071); open court surface C (Q-027)' },
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

export interface Layer { alb: any; rough: any; height: any | null }
/** albedo, roughness and height of one surface definition (before weather) */
function layer(d: SurfaceDef, base: any): Layer {
  const p = positionWorld, n = normalWorld;
  // mottling: broad variation (metre scale) + fine grain; mx_noise is ~[-1,1] so amplitudes are fractions of albedo
  const mott = mx_noise_float(p.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(p.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).add(mx_noise_float(p.mul(d.noiseScale * 9.0)).mul(d.noiseAmp * 0.12));
  let alb = base.mul(float(1).add(mott));
  let rough: any = float(d.roughness);
  let height: any = null;
  if (d.bump) { // two octaves of relief: broad undulation (trowel / settling) + fine grain
    height = mx_noise_float(p.mul(d.bump.freq)).mul(d.bump.amp).add(mx_noise_float(p.mul(d.bump.freq * 5.3)).mul(d.bump.amp * 0.35));
  }
  if (d.micro) { // fine grain, band-limited by the pixel footprint (D-147)
    const fade = float(1).sub(smoothstep(0.15, 0.35, fwidth(p).length().max(1e-6).mul(d.micro.freq)));
    height = (height ?? float(0)).add(mx_noise_float(p.mul(d.micro.freq)).mul(d.micro.amp).mul(fade));
    alb = alb.mul(float(1).add(mx_noise_float(p.mul(d.micro.freq * 1.9).add(7.3)).mul(d.micro.alb ?? 0.04).mul(fade)));
  }
  if (d.joints) { // hairline ashlar joints (D-029): visual only, never sunk; on vertical faces only
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
  if (d.herbs) { // seasonal herb layer in patches (C): green in spring, straw in summer, sparse in winter
    const patch = smoothstep(-0.1, 0.45, mx_noise_float(p.xz.mul(0.35)).add(mx_noise_float(p.xz.mul(2.2)).mul(0.35)));
    const up = smoothstep(0.8, 0.97, n.y);
    const cover = patch.mul(up).mul(d.herbs);
    const green = color(new THREE.Color().setRGB(0.30, 0.36, 0.16, THREE.SRGBColorSpace)), straw = color(new THREE.Color().setRGB(0.62, 0.55, 0.36, THREE.SRGBColorSpace));
    const veg = mix(straw, green, SEASON.green.div(SEASON.green.add(SEASON.dry).max(0.001)));
    const amount = cover.mul(SEASON.green.add(SEASON.dry).min(1)).mul(0.85);
    alb = mix(alb, veg.mul(float(1).add(mott.mul(2))), amount);
    rough = mix(rough, float(0.85), amount);
    if (height) height = height.add(amount.mul(mx_noise_float(p.mul(14)).abs().mul(0.03)));
  }
  return { alb, rough, height };
}

const cache = new Map<string, THREE.MeshStandardNodeMaterial>();
const lin = (a: [number, number, number]) => color(new THREE.Color().setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace));
export function surfaceMaterial(name: string, opts: { vertexColors?: boolean; variant?: string; modify?: (L: Layer, d: SurfaceDef) => Layer } = {}): THREE.MeshStandardNodeMaterial {
  const key = name + (opts.vertexColors ? '+vc' : '') + (opts.variant ? '+' + opts.variant : ''); // `modify` (Phase 7 plain layers) needs its own `variant` key
  const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES[name] ?? SURFACES.limestone;
  const m = new THREE.MeshStandardNodeMaterial(); // vertex colours are read explicitly below; the vertexColors flag would multiply them in a second time
  const n = normalWorld;
  const base = opts.vertexColors ? attribute('color', 'vec3') : lin(d.albedo);
  let L = layer(d, base);
  if (d.top && SURFACES[d.top]) { // up-facing faces use another surface (sharp transition at the arris)
    const T = layer(SURFACES[d.top], lin(SURFACES[d.top].albedo)); const t = smoothstep(0.7, 0.9, n.y);
    L = { alb: mix(L.alb, T.alb, t), rough: mix(L.rough, T.rough, t), height: L.height && T.height ? mix(L.height, T.height, t) : (L.height ?? T.height) };
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
  // relief flattens under water and snow
  if (L.height) m.normalNode = bumped(L.height.mul(float(1).sub(puddle)).mul(float(1).sub(snowMask)));
}

/** Painted carved stone (relief figures, D-030): the joint-free carved limestone under a matte mineral paint film. Per
 *  vertex: `color` = the pigment's linear albedo (src/data/polychromy.json), `paint` = coverage (0 = bare stone: background,
 *  faces, animals; < 1 on worn arrises, relief_field.paintCoverage). Per pixel: the film's optical thickness varies at brush
 *  scale (opacity 1 - exp(-hiding * t): the light stone shows through thin brushing), small flaked losses (more on worn
 *  arrises) expose the stone, pigment grain modulates the albedo, the film is dull (rough) where the stone is rubbed smooth,
 *  and it stands a fraction of a millimetre proud (visible at the edge of a loss). Arithmetic masks only (D-012). */
export function paintedStoneMaterial(): THREE.MeshStandardNodeMaterial {
  const key = 'painted-stone'; const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES.limestone_carved, F = (PC as any).paint.film.v, LS = (PC as any).paint.loss.v;
  const m = new THREE.MeshStandardNodeMaterial(), p = positionWorld;
  const S = layer(d, lin(d.albedo));
  const pig = attribute('color', 'vec3'), cov = attribute('paint', 'float');
  const n01 = (x: any) => mx_noise_float(x).mul(0.5).add(0.5);
  const thick = n01(p.mul(F.brush_freq)).mul(1 - F.thickness_min).add(F.thickness_min);
  const opacity = float(1).sub(exp(thick.mul(-F.hiding)));
  const lossField = n01(p.mul(LS.freq)).add(float(1).sub(cov).mul(LS.wear_bias));
  const kept = float(1).sub(smoothstep(LS.level - LS.soft, LS.level + LS.soft, lossField));
  const film = clamp(cov, 0, 1).mul(opacity).mul(kept);
  const grain = float(1).add(mx_noise_float(p.mul(F.grain_freq)).mul(F.grain_amp));
  const L: Layer = { alb: mix(S.alb, pig.mul(grain), film), rough: mix(S.rough, float(F.roughness), film), height: (S.height ?? float(0)).add(film.mul(F.relief)) };
  finish(m, L, d);
  m.userData = { tier: 'C', note: 'carved limestone (joint-free) with a matte mineral paint film: pigments B (RELIEFS_AND_COLOUR §3a), colour values, film and wear C (src/data/polychromy.json, D-030)' };
  cache.set(key, m);
  return m;
}
