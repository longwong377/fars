// Procedural PBR materials (Phase 3). No texture library is reachable (BLOCKERS B7), so surfaces are procedural in TSL:
// world-space noise for stone mottling, tooling and joints; porosity-driven darkening when wet; puddle smoothing on flat
// ground; snow on up-facing surfaces. Albedo values are from the colour research where available (research/RELIEFS_AND_COLOUR.md),
// otherwise C. Every material carries tier metadata for the dev overlay.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, normalWorld, mx_noise_float, vec3, float, mix, smoothstep, max, clamp, color, abs, fract, step, min, attribute } from 'three/tsl';

export const WEATHER = { wetness: uniform(0), snow: uniform(0), puddles: uniform(0) };

export interface SurfaceDef { albedo: [number, number, number]; roughness: number; porosity: number; noiseScale: number; noiseAmp: number; joints?: { course: number; block: number; width: number }; metal?: number; tier: string; note: string }
export const SURFACES: Record<string, SurfaceDef> = {
  // Persepolis grey limestone, freshly dressed (C until colour research lands): mid-grey, slightly warm
  limestone: { albedo: [0.44, 0.43, 0.40], roughness: 0.62, porosity: 0.35, noiseScale: 1.3, noiseAmp: 0.12, joints: { course: 1.05, block: 2.2, width: 0.012 }, tier: 'C', note: 'dressed grey limestone; albedo C pending calibration photo (NEEDS #13)' },
  limestone_dark: { albedo: [0.12, 0.12, 0.125], roughness: 0.18, porosity: 0.1, noiseScale: 2, noiseAmp: 0.05, tier: 'B', note: 'polished dark limestone (door/window frames)' },
  mudbrick: { albedo: [0.62, 0.52, 0.40], roughness: 0.92, porosity: 0.8, noiseScale: 0.6, noiseAmp: 0.08, tier: 'C', note: 'mud plaster over mud brick' },
  plaster: { albedo: [0.78, 0.74, 0.66], roughness: 0.85, porosity: 0.7, noiseScale: 0.8, noiseAmp: 0.05, tier: 'C', note: 'lime/gypsum plaster' },
  timber: { albedo: [0.32, 0.23, 0.15], roughness: 0.75, porosity: 0.5, noiseScale: 4, noiseAmp: 0.15, tier: 'C', note: 'cedar/timber beams' },
  glazed: { albedo: [0.12, 0.33, 0.48], roughness: 0.25, porosity: 0.05, noiseScale: 3, noiseAmp: 0.06, tier: 'C', note: 'glazed brick' },
  earth: { albedo: [0.47, 0.39, 0.29], roughness: 0.95, porosity: 0.9, noiseScale: 0.4, noiseAmp: 0.14, tier: 'C', note: 'beaten earth' },
  scaffold: { albedo: [0.45, 0.35, 0.24], roughness: 0.85, porosity: 0.5, noiseScale: 3, noiseAmp: 0.1, tier: 'C', note: 'timber scaffold poles' },
  rubble: { albedo: [0.5, 0.48, 0.44], roughness: 0.9, porosity: 0.5, noiseScale: 2, noiseAmp: 0.2, tier: 'C', note: 'stone chips' },
};

const cache = new Map<string, THREE.MeshStandardNodeMaterial>();
export function surfaceMaterial(name: string, opts: { vertexColors?: boolean } = {}): THREE.MeshStandardNodeMaterial {
  const key = name + (opts.vertexColors ? '+vc' : '');
  const hit = cache.get(key); if (hit) return hit;
  const d = SURFACES[name] ?? SURFACES.limestone;
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: !!opts.vertexColors });
  const p = positionWorld, n = normalWorld;
  const base = opts.vertexColors ? attribute('color', 'vec3') : color(new THREE.Color().setRGB(d.albedo[0], d.albedo[1], d.albedo[2], THREE.SRGBColorSpace));
  // mottling: large + small scale noise
  // mottling: broad variation (metre scale) + fine grain; mx_noise is ~[-1,1] so amplitudes are fractions of albedo
  const mott = mx_noise_float(p.mul(d.noiseScale * 0.18)).mul(d.noiseAmp * 0.6).add(mx_noise_float(p.mul(d.noiseScale * 1.7)).mul(d.noiseAmp * 0.25)).add(mx_noise_float(p.mul(d.noiseScale * 9.0)).mul(d.noiseAmp * 0.12));
  let alb = base.mul(float(1).add(mott));
  if (d.joints) { // ashlar joints: thin dark lines on block courses (visual only; the true block layout is Phase 4 work)
    const jy = abs(fract(p.y.div(d.joints.course)).sub(0.5)).mul(2);
    const jx = abs(fract(p.x.add(p.z).div(d.joints.block).add(step(0.5, fract(p.y.div(d.joints.course * 2))).mul(0.5))).sub(0.5)).mul(2);
    const line = max(smoothstep(1 - d.joints.width * 8, 1, jy), smoothstep(1 - d.joints.width * 4, 1, jx).mul(step(0.3, abs(n.y).oneMinus())));
    alb = alb.mul(float(1).sub(line.mul(0.35)));
  }
  // weather: wet darkening (porous surfaces up to ~45% darker), gloss; puddles on near-horizontal surfaces; snow cover
  const up = smoothstep(0.75, 0.95, n.y);
  const wet = WEATHER.wetness.mul(float(0.55).add(up.mul(0.45)));
  alb = alb.mul(float(1).sub(wet.mul(d.porosity * 0.5)));
  // puddles: only in the low spots of a broad noise field (≈15% of flat area at full puddle state), never a uniform sheen
  const puddle = up.mul(WEATHER.puddles).mul(smoothstep(0.68, 0.74, mx_noise_float(p.mul(0.12)).mul(0.5).add(0.5)));
  // snow: zero when snow = 0 (noise only modulates coverage, never adds snow on its own)
  const snowMask = clamp(up.mul(WEATHER.snow).mul(float(1.6).sub(mx_noise_float(p.mul(0.8)).add(1).mul(0.3))), 0, 1);
  m.colorNode = mix(alb, vec3(0.92, 0.93, 0.96), snowMask);
  m.roughnessNode = mix(mix(float(d.roughness), float(d.roughness * 0.45), wet), float(0.05), puddle).max(float(0.04)).mul(float(1).sub(snowMask.mul(0.1))).add(snowMask.mul(0.1));
  m.metalnessNode = float(d.metal ?? 0);
  m.userData = { tier: d.tier, note: d.note };
  cache.set(key, m);
  return m;
}
void min;
