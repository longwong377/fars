// Sky specular environment (D-157, C). Polished floors, polished dark stone and bronze reflect the sky and the ground:
// without an environment the only specular light in the scene was the sun's highlight, so the red floors, the jambs
// (roughness 0.18) and the bronze (metalness 1, no diffuse term) rendered matte or black.
//
// The environment is the scene's own sky dome (SkySystem's calibrated Preetham + twilight table, the same nodes the
// visible sky draws, D-060/D-116) above the horizon and the D-153 ground radiance (the hemisphere light's ground colour
// × intensity / π: the sunlit ground's reflection) below it, captured into a 64 px cube and prefiltered for GGX by three's
// PMREMGenerator. It is re-captured when the sun moves more than 0.5°, or the sky's or the ground's light changes by more
// than 2 % (weather, haze, the eye's gain). The sun's disc is masked out of the capture: its specular is the direct
// light's (a disc in the environment would double every sun highlight).
//
// It adds indirect SPECULAR radiance only (SkySpecularNode): no irradiance, because the diffuse skylight is the
// hemisphere light and, inside the roofed halls, the light probes (D-110 … D-112). Inside the probe volumes the sky
// visibility around the reflected ray comes from the probe field (registered by the pipeline, which owns the probe
// lookup) and becomes a specular occlusion through Lagarde & de Rousiers' cone fit (below), so the halls do not mirror
// the sky: the field's L1 visibility is a cosine-wide average, and without the fit a polished floor seen at a grazing
// angle (Fresnel ≈ 0.4) turned a 0.3 % sky visibility into a uniform blue sheen brighter than its own diffuse light.
import * as THREE from 'three/webgpu';
import { LightingNode } from 'three/webgpu';
import { pmremTexture, positionViewDirection, normalView, roughness, cameraWorldMatrix, cameraViewMatrix, isolate, positionWorld, normalWorld, normalWorldGeometry, step, cameraPosition, normalize, vec3, vec4, mix, smoothstep, dot, uniform, float, clamp, pow, exp2 } from 'three/tsl';

/** cube face size of the captured environment (px): a texel spans 1.4°, finer than the GGX lobe of the most polished
 *  surface in the scene at its prefiltered level (roughness 0.18) */
export const ENV_CUBE = 64;
/** re-capture when the sun has moved this far (deg) or the sky/ground light changed by this fraction */
export const ENV_SUN_STEP = 0.5, ENV_LIGHT_STEP = 0.02;
/** the sun's disc is masked within this angle of the sun (deg): the disc (0.27° radius) and the texel it falls in */
export const ENV_DISC_MASK: [number, number] = [0.55, 0.9];

/** a render target in PMREMGenerator's CubeUV layout (the same parameters as its own _createRenderTarget) */
function cubeUVTarget(size: number): THREE.RenderTarget {
  const lodMax = Math.floor(Math.log2(size)), cube = 2 ** lodMax;
  const rt = new THREE.RenderTarget(3 * Math.max(cube, 16 * 7), 4 * cube, {
    magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false, type: THREE.HalfFloatType,
    format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: true,
  });
  rt.texture.mapping = THREE.CubeUVReflectionMapping; rt.texture.name = 'sky environment (PMREM)'; (rt.texture as any).isPMREMTexture = true;
  rt.scissorTest = true;
  return rt;
}

/** the shared environment state: the prefiltered target every surface material samples, the specular occlusion the
 *  pipeline registers (probe field), and an intensity (1; 0 for A/B measurements, window.__parsaSurf.env) */
export const skyEnv = {
  target: cubeUVTarget(ENV_CUBE),
  /** (world position, world normal, world reflection direction[, the direction the lookup stands off along: the
   *  reflection about the geometric normal, D-187]) → the sky's visibility around the reflection (0..1: the probe
   *  field's cosine-weighted sky irradiance for that direction over an open sky's) */
  occlusion: null as null | ((p: any, n: any, r: any, rOff?: any) => any),
  intensity: uniform(1),
  captures: 0,
};

/** TSL (materials): the surface's geometric (interpolated vertex) normal in world space, turned to the side the shading
 *  normal faces (back faces of double-sided materials): the direction the probe lookups stand off along (D-187; the
 *  bumped shading normal moved them across the probes' reach steps) */
export const geometricNormalWorld = () => normalWorldGeometry.mul(step(0, dot(normalWorldGeometry, normalWorld)).mul(2).sub(1));

/** Specular occlusion from an ambient visibility `vis` (Lagarde & de Rousiers 2014, Moving Frostbite to PBR §4.10.2: a
 *  fit of the visible fraction of the specular cone given a visibility cone): saturate((n·v + vis)^(2^(−16·roughness − 1))
 *  − 1 + vis), at the fixed roughness OCC_ROUGH (D-181). It falls to 0 at grazing angles unless the visibility is high,
 *  so a sky visibility of a few per cent (a hall seen through its doors) gives a polished floor no sky sheen, while in the
 *  open (vis 1) it stays 1. Both bases are ≥ 0 (no NaN from pow). */
export const specularOcclusion = (vis: any, dotNV: any, _rough?: any) =>
  clamp(pow(clamp(dotNV, 0, 1).add(vis), float(OCC_EXP)).sub(1).add(vis), 0, 1);
/** The roughness the fit is evaluated at, for every surface (D-181). At a grazing view and a sky visibility of a few per
 *  cent the fit goes from 0 to ≈ vis between roughness 0.25 and 0.45, so the red floors' polish and wear mottling
 *  (roughness 0.35 ± 35 % in 0.3–3 m patches) switched whole patches between no sky and the sky through the doors: white
 *  blotches over the Hadish floor (session-6 render at quality test; gone with the environment off). The occlusion is a
 *  large-scale visibility (the probes' cosine-wide L1, 2 m apart), too coarse to be modulated by a pixel's roughness; the
 *  roughness still shapes the highlight through the prefiltered level and the BRDF. 0.35 = the red floor's own roughness:
 *  the floors keep the D-157 behaviour on average (no sky sheen at grazing angles in a hall); matte stone indoors gets
 *  less grazing sky than the fit's ≈ vis, which it hardly shows anyway. */
export const OCC_ROUGH = 0.35;
const OCC_EXP = 2 ** (-16 * OCC_ROUGH - 1);
/** CPU mirror of specularOcclusion (tests, tests/lib/occ_check.ts) */
export const specularOcclusionCPU = (vis: number, nv: number, _r?: number) =>
  Math.min(1, Math.max(0, Math.pow(Math.min(1, Math.max(0, nv)) + vis, OCC_EXP) - 1 + vis));

/** Indirect specular from the sky environment, and no irradiance (EnvironmentNode adds both). The lookup mirrors three's
 *  EnvironmentNode: the reflected view vector bent toward the normal by roughness⁴, the prefiltered level by roughness. */
const ENV_DEBUG = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('envdbg') : null;
export class SkySpecularNode extends LightingNode {
  static get type() { return 'SkySpecularNode'; }
  setup(builder: any): any {
    const r2 = roughness.mul(roughness);
    const refl = positionViewDirection.negate().reflect(normalView);
    const dirWorld = mix(refl, normalView, r2.mul(r2)).normalize().transformDirection(cameraWorldMatrix);
    const env: any = pmremTexture(skyEnv.target.texture);
    const radiance: any = isolate(env.context({ getUV: () => dirWorld, getTextureLevel: () => roughness }));
    // the lookup stands off along the reflection about the GEOMETRIC normal (D-187): the micro-relief's tilts moved it
    // across the probes' reach steps, and the sky sheen of the red floors came and went pixel by pixel (the blue-white
    // specks at the scribes' doorway, session-6 rubric)
    const gV = geometricNormalWorld().transformDirection(cameraViewMatrix), reflG = positionViewDirection.negate().reflect(gV);
    const offWorld = mix(reflG, gV, r2.mul(r2)).normalize().transformDirection(cameraWorldMatrix);
    const vis = skyEnv.occlusion ? skyEnv.occlusion(positionWorld, normalWorld, dirWorld, offWorld) : float(1);
    const occ = specularOcclusion(vis, dot(normalView, positionViewDirection), roughness);
    // debug (?envdbg=occ, chosen when the shader is built): the sky visibility (red) and the occlusion (green) as radiance
    if (ENV_DEBUG === 'occ') { builder.context.radiance.addAssign(vec3(vis, occ, 0).mul(0.05)); return undefined; }
    builder.context.radiance.addAssign(radiance.mul(occ).mul(skyEnv.intensity));
    return undefined;
  }
}

/** Captures the sky dome and the ground into skyEnv.target when the light has changed (call once per frame, before the
 *  frame is rendered). `sky` is the SkyMesh of SkySystem (its calibrated colour node is reused as is). */
export class SkyEnvCapture {
  private gen: THREE.PMREMGenerator;
  private scene = new THREE.Scene();
  private groundL = uniform(new THREE.Color(0, 0, 0));
  private sunDir = uniform(new THREE.Vector3(0, 1, 0));
  private last = { sun: new THREE.Vector3(0, -1, 0), sky: [-1, -1, -1], ground: [-1, -1, -1], turb: -1 };
  constructor(private renderer: THREE.WebGPURenderer, private sky: any) {
    this.gen = new THREE.PMREMGenerator(renderer);
    const skyMat = sky.material as any, mat = new THREE.NodeMaterial() as any;
    mat.side = THREE.BackSide; mat.depthTest = false; mat.depthWrite = false; mat.fog = false; mat.name = 'sky environment dome';
    mat.vertexNode = skyMat.vertexNode; // SkyMesh's vertex stage feeds the sun and extinction varyings its colour node reads
    const d = normalize(positionWorld.sub(cameraPosition));
    const disc = float(1).sub(smoothstep(Math.cos((ENV_DISC_MASK[1] * Math.PI) / 180), Math.cos((ENV_DISC_MASK[0] * Math.PI) / 180), dot(d, this.sunDir)));
    // the horizon: sky above, the sunlit ground's radiance below (a 1.5° blend; the terrain's own skyline is not modelled)
    const above = smoothstep(-0.02, 0.006, d.y);
    mat.colorNode = vec4(mix(this.groundL, skyMat.colorNode.xyz.mul(disc), above), 1);
    const dome = new THREE.Mesh(sky.geometry, mat); dome.frustumCulled = false; dome.scale.setScalar(10);
    this.scene.add(dome);
  }
  /** re-capture if the sun or the light changed enough (or `force`); returns whether it captured */
  update(hemi: THREE.HemisphereLight | undefined, force = false): boolean {
    const s = this.sky, sd = new THREE.Vector3().copy(s.sunPosition.value).normalize();
    const I = hemi ? hemi.intensity : 1, sc = hemi ? [hemi.color.r * I, hemi.color.g * I, hemi.color.b * I] : [0.6, 0.6, 0.6];
    const gc = hemi ? [hemi.groundColor.r * I, hemi.groundColor.g * I, hemi.groundColor.b * I] : [0.1, 0.1, 0.1];
    const L = this.last, turb = s.turbidity.value as number;
    const changed = (a: number[], b: number[]) => a.some((x, i) => Math.abs(x - b[i]) > ENV_LIGHT_STEP * Math.max(Math.abs(b[i]), 1e-6));
    const moved = sd.angleTo(L.sun) > (ENV_SUN_STEP * Math.PI) / 180;
    if (!force && !moved && !changed(sc, L.sky) && !changed(gc, L.ground) && Math.abs(turb - L.turb) < 0.01) return false;
    L.sun.copy(sd); L.sky = sc; L.ground = gc; L.turb = turb;
    this.sunDir.value.copy(sd);
    this.groundL.value.setRGB(gc[0] / Math.PI, gc[1] / Math.PI, gc[2] / Math.PI);
    const disc = s.showSunDisc.value; s.showSunDisc.value = 0;
    skyEnv.target.scissorTest = true; // as PMREMGenerator allocates its targets (its cleanup turns it off)
    try { this.gen.fromScene(this.scene, 0, 0.1, 100, { size: ENV_CUBE, renderTarget: skyEnv.target } as any); }
    finally { s.showSunDisc.value = disc; }
    skyEnv.captures++;
    return true;
  }
}
