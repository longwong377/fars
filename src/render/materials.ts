// Procedural PBR materials (Phase 3). No texture library is reachable (BLOCKERS B7), so surfaces are procedural in TSL:
// world-space noise for stone mottling, tooling and joints; porosity-driven darkening when wet; puddle smoothing on flat
// ground; snow on up-facing surfaces; a procedural height field per surface that perturbs the shading normal (surface
// gradient from screen-space derivatives), so plaster, fill and stone read as surfaces rather than flat colour.
// Albedo values are from the colour research where available (research/RELIEFS_AND_COLOUR.md), otherwise C. Every
// material carries tier metadata for the dev overlay.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, normalWorld, normalView, positionView, mx_noise_float, mx_worley_noise_float, vec3, float, mix, smoothstep, max, clamp, color, abs, fract, step, attribute, sign } from 'three/tsl';

export const WEATHER = { wetness: uniform(0), snow: uniform(0), puddles: uniform(0) };
/** seasonal ground cover (0..1): green = living herb layer, dry = standing straw/stubble (set per frame from the date; season.ts) */
export const SEASON = { green: uniform(0.8), dry: uniform(0.1) };

export interface SurfaceDef {
  albedo: [number, number, number]; roughness: number; porosity: number; noiseScale: number; noiseAmp: number;
  joints?: { course: number; block: number; width: number }; metal?: number; tier: string; note: string;
  /** procedural relief (m): amplitude of the height field used for the shading normal, and its base frequency (1/m) */
  bump?: { amp: number; freq: number };
  /** use another surface on up-facing faces (e.g. the Terrace platform: ashlar retaining walls, fill on top) */
  top?: string;
  /** scattered chips / stones: fraction of area and their albedo */
  chips?: { cover: number; size: number; albedo: [number, number, number] };
  /** herb layer that follows SEASON (ground surfaces only) */
  herbs?: number;
}
export const SURFACES: Record<string, SurfaceDef> = {
  // Persepolis grey limestone, freshly dressed (C until colour research lands): mid-grey, slightly warm
  limestone: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: { course: 1.05, block: 2.2, width: 0.012 }, bump: { amp: 0.0015, freq: 6 }, tier: 'C', note: 'dressed grey limestone; albedo C pending calibration photo (NEEDS #13)' },
  limestone_dark: { albedo: [0.12, 0.12, 0.125], roughness: 0.18, porosity: 0.1, noiseScale: 2, noiseAmp: 0.05, tier: 'B', note: 'polished dark limestone (door/window frames)' },
  // mud plaster on mud brick, coated with a greyish yellow-green clay paint: attested at Pasargadae and, per Schmidt, on
  // the Treasury walls (Stein et al. 2016, npj Herit. Sci., search extract: B for the coating); tone and extent C
  mudbrick: { albedo: [0.58, 0.57, 0.45], roughness: 0.93, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.07, bump: { amp: 0.004, freq: 1.4 }, tier: 'B/C', note: 'mud plaster with greyish yellow-green clay paint (Pasargadae; Treasury walls per Schmidt, via Stein et al. 2016: B); tone and extent C' },
  plaster: { albedo: [0.78, 0.74, 0.66], roughness: 0.85, porosity: 0.7, noiseScale: 0.8, noiseAmp: 0.05, bump: { amp: 0.0015, freq: 3 }, tier: 'C', note: 'lime/gypsum plaster' },
  plaster_red: { albedo: [0.48, 0.14, 0.1], roughness: 0.35, porosity: 0.3, noiseScale: 0.9, noiseAmp: 0.04, bump: { amp: 0.0006, freq: 4 }, tier: 'B', note: 'lime-plaster floor with two hematite-rich paint coats, deep red over white (Stein et al. 2016; flooring-plaster study 2022, Treasury/Edifice C/Tachara: search extracts, B); polish C' },
  bronze: { albedo: [0.55, 0.38, 0.2], roughness: 0.35, porosity: 0.0, noiseScale: 3, noiseAmp: 0.08, metal: 1, tier: 'C', note: 'bronze fittings' },
  timber: { albedo: [0.32, 0.23, 0.15], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, bump: { amp: 0.002, freq: 5 }, tier: 'C', note: 'cedar/timber beams' },
  glazed: { albedo: [0.12, 0.33, 0.48], roughness: 0.25, porosity: 0.05, noiseScale: 3, noiseAmp: 0.06, tier: 'C', note: 'glazed brick' },
  // open ground on the plain: loam with stones and a seasonal herb layer (C; fields and crops are Phase 7)
  earth: { albedo: [0.47, 0.39, 0.29], roughness: 0.95, porosity: 0.9, noiseScale: 0.4, noiseAmp: 0.14, bump: { amp: 0.02, freq: 0.9 }, chips: { cover: 0.06, size: 0.35, albedo: [0.55, 0.53, 0.49] }, herbs: 1, tier: 'C', note: 'plain surface: loam, stones and a seasonal herb layer (C); fields Phase 7' },
  // the open courts of the Terrace: no source found for their surface (OPEN_QUESTIONS Q-027). Compacted fill with
  // limestone dressing chips over the levelled platform (C)
  court_fill: { albedo: [0.50, 0.46, 0.39], roughness: 0.9, porosity: 0.7, noiseScale: 0.5, noiseAmp: 0.1, bump: { amp: 0.004, freq: 2.5 }, chips: { cover: 0.12, size: 0.06, albedo: [0.64, 0.62, 0.57] }, tier: 'C', note: 'Terrace open court: compacted fill with limestone chips (surface unknown, Q-027: C)' },
  terrace: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: { course: 1.05, block: 2.2, width: 0.012 }, bump: { amp: 0.0015, freq: 6 }, top: 'court_fill', tier: 'C', note: 'Terrace platform: dressed limestone retaining walls; open court surface C (Q-027)' },
  scaffold: { albedo: [0.45, 0.35, 0.24], roughness: 0.85, porosity: 0.5, noiseScale: 3, noiseAmp: 0.1, tier: 'C', note: 'timber scaffold poles' },
  rubble: { albedo: [0.5, 0.48, 0.44], roughness: 0.9, porosity: 0.5, noiseScale: 2, noiseAmp: 0.2, bump: { amp: 0.01, freq: 3 }, tier: 'C', note: 'stone chips' },
};

/** shading normal from a procedural height field (view space; surface-gradient method, Mikkelsen 2010) */
function bumped(h: any) {
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy(), n = normalView;
  const r1 = dpdy.cross(n), r2 = n.cross(dpdx), det = dpdx.dot(r1);
  const grad = sign(det).mul(h.dFdx().mul(r1).add(h.dFdy().mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}

interface Layer { alb: any; rough: any; height: any | null }
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
  if (d.joints) { // ashlar joints: thin dark lines on block courses (visual only; the true block layout is Phase 4 work)
    const jy = abs(fract(p.y.div(d.joints.course)).sub(0.5)).mul(2);
    const jx = abs(fract(p.x.add(p.z).div(d.joints.block).add(step(0.5, fract(p.y.div(d.joints.course * 2))).mul(0.5))).sub(0.5)).mul(2);
    const line = max(smoothstep(1 - d.joints.width * 8, 1, jy), smoothstep(1 - d.joints.width * 4, 1, jx).mul(step(0.3, abs(n.y).oneMinus())));
    alb = alb.mul(float(1).sub(line.mul(0.35)));
    if (height) height = height.sub(line.mul(0.004)); // joints are sunk
  }
  if (d.chips) { // scattered stones/chips: cells of a Worley field below a threshold, raised and lighter
    const w = mx_worley_noise_float(p.xz.div(d.chips.size));
    const chip = float(1).sub(smoothstep(d.chips.cover * 0.9, d.chips.cover * 1.6, w)).mul(smoothstep(0.4, 0.8, n.y)); // (reversed smoothstep edges are undefined in WGSL)
    alb = mix(alb, color(new THREE.Color().setRGB(...d.chips.albedo, THREE.SRGBColorSpace)).mul(float(1).add(mott)), chip);
    rough = mix(rough, float(0.7), chip);
    if (height) height = height.add(chip.mul(d.chips.size * 0.25));
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
export function surfaceMaterial(name: string, opts: { vertexColors?: boolean } = {}): THREE.MeshStandardNodeMaterial {
  const key = name + (opts.vertexColors ? '+vc' : '');
  const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES[name] ?? SURFACES.limestone;
  const m = new THREE.MeshStandardNodeMaterial(); // vertex colours are read explicitly below; the vertexColors flag would multiply them in a second time
  const p = positionWorld, n = normalWorld;
  const lin = (a: [number, number, number]) => color(new THREE.Color().setRGB(a[0], a[1], a[2], THREE.SRGBColorSpace));
  const base = opts.vertexColors ? attribute('color', 'vec3') : lin(d.albedo);
  let L = layer(d, base);
  if (d.top && SURFACES[d.top]) { // up-facing faces use another surface (sharp transition at the arris)
    const T = layer(SURFACES[d.top], lin(SURFACES[d.top].albedo)); const t = smoothstep(0.7, 0.9, n.y);
    L = { alb: mix(L.alb, T.alb, t), rough: mix(L.rough, T.rough, t), height: L.height && T.height ? mix(L.height, T.height, t) : (L.height ?? T.height) };
  }
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
  m.userData = { tier: d.tier, note: d.note };
  cache.set(key, m);
  return m;
}
