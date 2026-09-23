// Light probes at run time (D-110, D-112): the baked field (public/generated/probes.{f16,json}) as three RGBA16F atlases,
// sampled by every lit material through the hemisphere light (the skylight becomes the light each point's openings let
// in) and by the post composite, plus the ambient-visibility estimate the eye adaptation reads for the camera.
//
// Shading (all arithmetic masks, no runtime select(): the composite is TRAA's input, D-012):
//   q = p + n·normalBias (the lookup point stands off the surface, so a wall face samples the probes on its own side)
//   per volume: hard membership of p in the grid box → atlas coordinates of q's two layers (sum of masked terms: the
//   volumes do not overlap); weight = the volume's fade (bake.ts, field.ts) × a validity ramp
//   E_probe = S·mix(1, tint, fb)·max(0, a_S + b_S·n) + U·tint·max(0, a_U + b_U·n)
//   E = mix(E_hemisphere, E_probe, weight)  (outside every volume: exactly the hemisphere light, unchanged)
// The textures are 2-D atlases (layers as tiles, bilinear inside a tile and a linear blend between two tiles), not a
// Data3DTexture: r186 binds that through a 2-D view on WebGPU (validation error, black frame; HANDOFF gotchas).
import * as THREE from 'three/webgpu';
import { HemisphereLightNode } from 'three/webgpu';
import { uniform, texture, vec2, vec3, float, mix, max, min, clamp, floor, smoothstep, step, normalWorld, positionWorld, dot } from 'three/tsl';
import { ProbeField, ProbeVolume, atlasData, decodeField, encodeField, fieldVisibility, gridExtent, openAmbientMean } from './field';
import { SURFACES } from '../materials';
import { srgbToLinear, lum, sceneFromParts, TraceScene } from './trace';
import type { Part } from '../../arch/parts';
import { SPEC } from '../../arch/spec';

let FIELD: ProbeField | null = null;
/** one RGBA16F texture: the three atlases stacked as bands of `height` rows (S channel, U channel, tint + validity), so the
 *  probes cost every material a single texture binding (CSM already binds four shadow maps) */
let ATLAS: { tex: THREE.DataTexture; width: number; height: number; pos: [number, number][] } | null = null;
let META: any = null;
/** horizontal direct sun irradiance U (sun colour × intensity × sin altitude, 0 when the sun is down): the probes' sun
 *  channel. Set every frame (updateProbeLights). */
export const probeSun = uniform(new THREE.Color(0, 0, 0));
const current = { S: 0, U: 0, sun: new THREE.Vector3(0, 1, 0) };
/** the architecture as ray-traceable parts, for the eye's test of direct sun (setProbeOccluders) */
let OCC: TraceScene | null = null;
export function setProbeOccluders(parts: Part[] | null) {
  OCC = parts ? sceneFromParts(parts, () => [0, 0, 0], (SPEC as any).global.r_column_proportions.v.capital_boxes) : null;
}
/** albedo of the open ground the visibility is referred to (the Terrace courts' fill, linear luminance) */
const RHO_OPEN = (() => { const a = SURFACES.court_fill.albedo; return lum(srgbToLinear(a[0]), srgbToLinear(a[1]), srgbToLinear(a[2])); })();

export const probeField = () => FIELD;
export const probeMeta = () => META;
/** load the baked field (call before the first frame is rendered: the shaders are built with the volumes as constants) */
export async function loadProbes(base = '/'): Promise<ProbeField | null> {
  try {
    const [mj, bin] = await Promise.all([fetch(`${base}generated/probes.json`), fetch(`${base}generated/probes.f16`)]);
    if (!mj.ok || !bin.ok) throw new Error(`HTTP ${mj.status}/${bin.status}`);
    META = await mj.json(); const buf = await bin.arrayBuffer();
    setProbeField({ volumes: META.volumes, data: decodeField(new Uint16Array(buf)), count: META.count, normalBias: META.normalBias, tier: META.tier, note: META.note, partsHash: META.partsHash });
  } catch (e) { console.warn('[probes] no light probes; roofed halls get the plain skylight', e); FIELD = null; ATLAS = null; }
  return FIELD;
}
export function setProbeField(F: ProbeField | null) {
  FIELD = F; ATLAS = null; if (!F) return;
  const A = atlasData(F), band = A.width * A.height * 4, all = new Float32Array(band * 3);
  A.textures.forEach((t, i) => all.set(t, i * band));
  const d = new THREE.DataTexture(encodeField(all), A.width, A.height * 3, THREE.RGBAFormat, THREE.HalfFloatType);
  d.minFilter = d.magFilter = THREE.LinearFilter; d.wrapS = d.wrapT = THREE.ClampToEdgeWrapping; d.generateMipmaps = false; d.flipY = false;
  d.name = 'light probes'; d.needsUpdate = true;
  ATLAS = { tex: d, width: A.width, height: A.height, pos: A.pos };
}
/** GPU memory of the atlases (bytes) */
export const probeTextureBytes = () => (ATLAS ? ATLAS.width * ATLAS.height * 3 * 8 : 0);

/** per frame: the sky S (hemisphere colour × intensity) and the sun U the probes scale */
export function updateProbeLights(hemi: THREE.HemisphereLight | undefined, sun: THREE.DirectionalLight | undefined) {
  if (sun) {
    current.sun.subVectors(sun.position, sun.target.position).normalize();
    const s = Math.max(0, current.sun.y) * (sun.visible ? sun.intensity : 0);
    probeSun.value.copy(sun.color).multiplyScalar(s);
  } else probeSun.value.setRGB(0, 0, 0);
  const U = probeSun.value; current.U = lum(U.r, U.g, U.b);
  current.S = hemi ? hemi.intensity * lum(hemi.color.r, hemi.color.g, hemi.color.b) : 0;
}

/** the illuminance at the eye relative to open, sunlit ground (1 outdoors; a few % under a portico; ~0.1 % deep in the
 *  Apadana hall at midday), for the eye adaptation, which scales the outdoor sun + sky by it (D-113):
 *    (probe ambient · A_open + U · sunlit) / (A_open + U)
 *  where the probe ambient is relative to the open-field ambient A_open (both averaged over up and the four horizontal
 *  directions: field.ts), U the horizontal direct sun and `sunlit` one ray toward the sun against the parts. Outside the
 *  probe volumes (and blended across their fading edges) it returns `fallback()` (the upward raycasts), or 1. */
export function probeSkyVisibility(p: { x: number; y: number; z: number }, fallback?: () => number): number {
  const other = () => (fallback ? fallback() : 1);
  if (!FIELD) return other();
  const S = Math.max(current.S, 1e-4), U = current.U, r = fieldVisibility(FIELD, p.x, p.y, p.z, S, U, RHO_OPEN);
  if (r.w <= 0) return other();
  const d = current.sun, sunlit = U > 0 && !(OCC?.occluded(p.x, p.y, p.z, d.x, d.y, d.z, 0.05, 2000) ?? false) ? 1 : 0;
  const A = openAmbientMean(S, U, RHO_OPEN), eye = (r.vis * A + U * sunlit) / (A + U);
  return r.w * eye + (r.w < 0.999 ? (1 - r.w) * other() : 0);
}

/** reversed smoothstep edges are undefined in WGSL/GLSL: a (near-)empty ramp becomes a step */
const ramp = (a: number, b: number, x: any) => (b - a > 1e-3 ? smoothstep(a, b, x) : step(a, x));

/** TSL: the ambient (sky) irradiance at world position p with world normal n. S = hemisphere sky colour × intensity,
 *  U = probeSun, hemi = the hemisphere light's irradiance for n (the fallback). Returns the irradiance and the field weight. */
export function probeAmbient(p: any, n: any, S: any, U: any, hemi: any): { E: any; w: any } {
  if (!FIELD || !ATLAS || !FIELD.volumes.length) return { E: hemi, w: float(0) };
  const q = p.add(n.mul(FIELD.normalBias)), W = ATLAS.width, H = ATLAS.height;
  let uA: any = float(0), uB: any = float(0), vv: any = float(0), fy: any = float(0), fade: any = float(0);
  FIELD.volumes.forEach((v: ProbeVolume, i: number) => {
    const g = gridExtent(v), [u0, v0] = ATLAS!.pos[i], [nx, ny, nz] = v.dims, [rx0, rx1, rz0, rz1] = v.roof, f = v.full;
    const inside = step(g.x0, p.x).mul(step(p.x, g.x1)).mul(step(g.y0, p.y)).mul(step(p.y, g.y1)).mul(step(g.z0, p.z)).mul(step(p.z, g.z1));
    const wx = ramp(g.x0, rx0 - f, p.x).mul(float(1).sub(ramp(rx1 + f, g.x1, p.x)));
    const wz = ramp(g.z0, rz0 - f, p.z).mul(float(1).sub(ramp(rz1 + f, g.z1, p.z)));
    const wy = ramp(v.yLo[0], v.yLo[1], p.y).mul(float(1).sub(ramp(v.yHi[0], v.yHi[1], p.y)));
    const gx = clamp(q.x.sub(v.origin[0]).div(v.spacing[0]), 0, nx - 1);
    const gy = clamp(q.y.sub(v.origin[1]).div(v.spacing[1]), 0, ny - 1);
    const gz = clamp(q.z.sub(v.origin[2]).div(v.spacing[2]), 0, nz - 1);
    const k0 = min(floor(gy), Math.max(0, ny - 2)), k1 = min(k0.add(1), ny - 1);
    uA = uA.add(inside.mul(k0.mul(nx).add(gx).add(u0 + 0.5)));
    uB = uB.add(inside.mul(k1.mul(nx).add(gx).add(u0 + 0.5)));
    vv = vv.add(inside.mul(gz.add(v0 + 0.5)));
    fy = fy.add(inside.mul(gy.sub(k0)));
    fade = fade.add(inside.mul(wx).mul(wz).mul(wy));
  });
  const T = ATLAS.tex, at = (u: any, band: number) => texture(T, vec2(u.div(W), vv.add(band * H).div(3 * H)));
  const s0 = mix(at(uA, 0), at(uB, 0), fy), s1 = mix(at(uA, 1), at(uB, 1), fy), s2 = mix(at(uA, 2), at(uB, 2), fy);
  const val = s2.w, inv = float(1).div(max(val, 1e-4));
  const eS = max(s0.x.add(dot(s0.yzw, n)).mul(inv), 0), eU = max(s1.x.add(dot(s1.yzw, n)).mul(inv), 0);
  const tr = s2.x.mul(inv), tb = s2.y.mul(inv), fb = clamp(s2.z.mul(inv), 0, 1);
  const tint = vec3(tr, max(float(1).sub(tr.mul(0.2126)).sub(tb.mul(0.0722)).div(0.7152), 0), tb);
  const E = S.mul(mix(vec3(1, 1, 1), tint, fb)).mul(eS).add(U.mul(tint).mul(eU));
  const w = fade.mul(smoothstep(0.05, 0.3, val));
  return { E: mix(hemi, E, w), w };
}

/** the hemisphere light with its irradiance replaced by the probe field's (outside the volumes: unchanged) */
export class ProbeHemisphereLightNode extends HemisphereLightNode {
  static get type() { return 'ProbeHemisphereLightNode'; }
  setup(builder: any): any {
    const self = this as any;
    const dotNL = normalWorld.dot(self.lightDirectionNode);
    const hemi = mix(self.groundColorNode, self.colorNode, dotNL.mul(0.5).add(0.5));
    builder.context.irradiance.addAssign(probeAmbient(positionWorld, normalWorld, self.colorNode, probeSun, hemi).E);
    return undefined;
  }
}
/** make every HemisphereLight of this renderer shade through the probes (before the first material is built) */
export function installProbeLight(renderer: THREE.WebGPURenderer) {
  const lib = (renderer as any).library;
  if (lib?.lightNodes?.set) lib.lightNodes.set(THREE.HemisphereLight, ProbeHemisphereLightNode);
}
/** dev overlay / world summary line */
export function probeSummary() {
  if (!FIELD) return 'light probes: none (skylight unoccluded indoors)';
  return `light probes (C): ${FIELD.volumes.length} volumes, ${FIELD.count} probes, ${(probeTextureBytes() / 1048576).toFixed(1)} MB${META?.partsHash ? `, parts ${META.partsHash}` : ''}`;
}
