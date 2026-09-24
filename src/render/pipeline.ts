// Post-processing per quality (brief §8): GI + AO (SSGI, visibility bitmask), screen-space reflections (SSR), temporal AA
// (TRAA), bloom, AgX tone mapping.
//
// Skylight and light probes (D-110 … D-112). Every lit material receives the hemisphere light (the analytic skylight)
// through ProbeHemisphereLightNode: inside the light-probe volumes of the roofed buildings its irradiance is the light the
// openings let in (sky, sunlit courts, bounces; src/render/probes), outside them the plain hemisphere light, unchanged.
// That holds at every quality, since it is in the materials. The smoother surfaces also reflect the sky environment
// (envmap.ts, D-157): captured here when the light changes, with a specular occlusion from the same probe field.
//
// GI composite (high/ultra; D-012, D-157). The scene pass already contains direct light plus that skylight. SSGI returns an
// AO term and one bounce of screen-space diffuse light from nearby surfaces. They are combined so that each term is
// counted once:
//   out = scene − (1 − AO) · skylightDiffuse + albedo · bounce
// where skylightDiffuse = albedo · E_sky(p, n) / π is recomputed here from the same uniforms and the same probe lookup
// (p from the depth buffer), so the AO only occludes the skylight (never the sun, whose occlusion is the shadow map), and
// sky pixels are excluded from the SSGI as occluders and as light sources (patched node, src/render/ssgi.ts). w is the
// probe field's weight: inside the volumes the probes already carry the large-scale occlusion, so AO is the SSGI's
// short-range contact AO (green channel); outside them the stronger of the full-radius and the contact AO.
// D-157 (lead's item 6): the SSGI is fed the DIRECT light only (the scene minus skylightDiffuse), so its bounce is the
// bounce of the sun (and fires) as they fall NOW, and it is added inside the probe volumes too: a sunlit patch on a
// hall's floor lights the walls and the ceiling around it. The probes keep the skylight's bounces (their S channel);
// their U channel is the sun's bounce averaged over the year, which overlaps the screen-space bounce (C; measured in
// D-157). Outside the volumes the skylight's own screen-space bounce is dropped (the hemisphere light's ground term,
// D-153, carries the dominant outdoor bounce).
// giIntensity: with uniform sectors weighted by the receiver cosine, a surface fully enclosed by radiance L accumulates
// 2L/π per slice, while a Lambert surface under that enclosure reflects albedo·L; so the scale is π/2 (C, derivation only).
//
// SSR (high/ultra, D-157): three's SSRNode on the scene colour for surfaces smoother than roughness 0.5 (the red floors,
// the polished frames, bronze, wet stone), mirror rays blurred by roughness, weighted by the split-sum specular
// reflectance of each pixel; where a ray hits, it replaces the sky environment the material reflected (the composite
// re-evaluates that term with the material's own lookup and specular occlusion).
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, sample, velocity, diffuseColor, vec4, vec3, uniform, mix, max, float, uv, getViewPosition, logarithmicDepthToViewZ, viewZToPerspectiveDepth, clamp, min, vec2, metalness, roughness, Fn, dot, normalize, luminance, smoothstep, pmremTexture, EnvironmentBRDF, reflect } from 'three/tsl';
import { ssgi } from './ssgi';
import { ssgi as ssgiOrig } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { sss } from 'three/addons/tsl/display/SSSNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { meterNode } from './meter';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Quality } from '../core/settings';
import { installProbeLight, updateProbeLights, probeAmbient, probeSun } from './probes/runtime';
import { SkyEnvCapture, skyEnv, specularOcclusion } from './envmap';
import { addAirLight } from './airlight';

export const GI_SCALE = Math.PI / 2;
/** bloom threshold (scene radiance, before exposure) at the outdoor exposures; scaled for interior exposures (D-141) */
export const BLOOM_THRESHOLD = 0.9, BLOOM_STRENGTH = 0.12;
/** the glare's input saturates at this many times display white (after exposure), as a sensor does: an interior exposed
 *  hundreds of times the outdoor one cannot feed a sunlit doorway at 100–400× white into the glare (session 4 triage) */
export const BLOOM_SAT = 16;
/** the bloom radius (the weight of its broad mips) outdoors; it falls to 0 (the narrow mips) at interior exposures */
export const BLOOM_RADIUS = 0.35;
/** SSGI (D-157): thickness of a depth sample (m; it grows with the view distance beyond 8 m, ssgi.ts), and the contact AO's
 *  radius (m) with its own samples per side and slice (3 of 4 within 0.5 m) */
export const SSGI_THICKNESS = 0.25, SSGI_CONTACT_RADIUS = 1.2, SSGI_CONTACT_STEPS = 4;
/** SSR (D-157): surfaces below this roughness reflect (fading out over the last 0.1), rays reach 30 m from the reflecting
 *  plane, depth samples 0.3 m thick */
export const SSR_MAX_ROUGHNESS = 0.5, SSR_MAX_DISTANCE = 30, SSR_THICKNESS = 0.3;
/** sun contact shadows (D-157): screen-space rays toward the sun, 0.6 m long, against depth samples 6 cm thick; they darken
 *  only the pixel's share of direct sun (estimated as below), where the shadow map's texels and bias (6 cm, D-146) leave a
 *  plinth or a step nosing without its contact shadow */
export const SSS_MAX_DISTANCE = 0.6, SSS_THICKNESS = 0.06;

export class Pipeline {
  rp: THREE.RenderPipeline | null = null;
  readonly flash = uniform(0); // lightning flash (additive)
  private hemiSky = uniform(new THREE.Color());
  private hemiGround = uniform(new THREE.Color());
  private camWorld: any;
  private sun: THREE.DirectionalLight | undefined;
  private built = false;
  private bloomNode: unknown = null;
  /** the frame meter's render target (D-159: centre-weighted log luminance before exposure; null at test/low quality) */
  meterTarget: THREE.RenderTarget | null = null;
  private meterZero = uniform(0);
  /** the absolute exposure (renderer.toneMappingExposure), for the glare's saturation cap */
  private expAbs = uniform(1);
  /** the sky environment's capture (D-157; null when the scene has no SkyMesh) */
  private env: SkyEnvCapture | null = null;
  private sssDebug: any = null;
  /** a debug view chosen at run time (window.__parsaSurf.post(name); '' = the image): the post graph is rebuilt on the
   *  next frame (tests and diagnostics only; the old graph's targets are left to the garbage collector) */
  private debugView: string | null = null;
  setDebugView(v: string) { this.debugView = v; this.built = false; this.rp = null; }
  /** A/B switches for measurements (window.__parsaSurf; 1 = on): SSR, sun contact shadows (sss), the direct-only SSGI input with its bounce inside
   *  the probe volumes (0 = the session-4 composite: full scene into the SSGI, bounce × (1 − w)), the contact AO outdoors */
  readonly ab = { ssr: uniform(1), giDirect: uniform(1), contact: uniform(1), sss: uniform(1) };
  /** the sun as the composite's contact-shadow estimate sees it: direction toward the sun (world) and colour × intensity */
  private sunDirW = uniform(new THREE.Vector3(0, 1, 0)); private sunE = uniform(new THREE.Color(0, 0, 0));
  constructor(private renderer: THREE.WebGPURenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, readonly quality: Quality, private hemi?: THREE.HemisphereLight) {
    installProbeLight(renderer); // before any material is built
    // the sun: the shadow-casting directional light (SkySystem.sun); the sky dome (SkySystem.sky) for the environment
    let skyMesh: any = null;
    scene.traverse(o => { if (!this.sun && (o as any).isDirectionalLight && o.castShadow) this.sun = o as THREE.DirectionalLight; if (!skyMesh && (o as any).isSkyMesh) skyMesh = o; });
    if (skyMesh) this.env = new SkyEnvCapture(renderer, skyMesh);
    // the sky's visibility around a reflected ray, for the environment's specular occlusion (D-157): the probe field's
    // L1 sky irradiance for the reflection direction, looked up 0.9 m out along it, against the open sky's (1 + r_y)/2;
    // 1 outside the volumes. Built into each material when its shader is built (the probes have loaded by then); the
    // materials and the composite turn it into an occlusion with envmap.specularOcclusion
    skyEnv.occlusion = (p: any, _n: any, r: any) => {
      const open = r.y.mul(0.5).add(0.5).max(0.05);
      const P = probeAmbient(p, r, vec3(1, 1, 1), vec3(0, 0, 0), vec3(open, open, open), true); // direct sky only (D-181)
      return clamp(luminance(P.E).div(open), 0, 1);
    };
    (globalThis as any).__parsaSurf = { ...((globalThis as any).__parsaSurf ?? {}), ...this.ab, env: skyEnv.intensity, envCaptures: () => skyEnv.captures, post: (v: string) => this.setDebugView(v) };
  }
  /** the post graph is built at the first render, after the world (and its light probes) has loaded: the composite reads
   *  the probe volumes as constants */
  private build() {
    this.built = true;
    const { renderer, scene, camera, quality } = this;
    if (quality === 'test' || quality === 'low') return; // direct render (MSAA in the renderer)
    // no MSAA in the scene pass: TRAA is the anti-aliasing here, and it copies the depth into a single-sample history
    // texture (a 4-sample source failed WebGPU validation on every frame before session 2)
    const scenePass = pass(scene, camera, { samples: 0 } as any);
    // MRT: metalness rides in the diffuse colour's alpha and roughness in the normal's (SSR, D-157); materials without a
    // PBR model (sky, stars, clouds) write 0 and 1, decided when each material's shader is built
    const pbr = (node: any, other: number) => Fn(([], builder: any) => (builder.material?.isMeshStandardNodeMaterial ? node : float(other)))();
    scenePass.setMRT(mrt({ output, diffuseColor: vec4(diffuseColor.rgb, pbr(metalness, 0)), normal: vec4(packNormalToRGB(normalView), pbr(roughness, 1)), velocity }));
    const col = scenePass.getTextureNode('output'), dep = scenePass.getTextureNode('depth'), nrmTex = scenePass.getTextureNode('normal');
    const vel = scenePass.getTextureNode('velocity'), dif = scenePass.getTextureNode('diffuseColor');
    const nrm = sample((uv: any) => unpackRGBToNormal(nrmTex.sample(uv).rgb));
    let composite: any;
    if (quality === 'medium') {
      composite = col; // TRAA only: GTAO's shader module fails to compile under SwiftShader (logged D-009); medium keeps AA without AO
    } else {
      const V = this.debugView ?? new URLSearchParams(location.search).get('post') ?? ''; // debug: orig = unpatched three node; scene | ao | aonear | gi | probe | plain | direct | ssr | env | sss = debug views
      // world-space normal from the view-space normal (camera rotation), for the hemisphere-light weight
      this.camWorld = uniform(camera.matrixWorld);
      const nV = unpackRGBToNormal(nrmTex.rgb), nW = this.camWorld.mul(vec4(nV, 0)).xyz.normalize();
      const hemiIrr = mix(this.hemiGround, this.hemiSky, nW.y.mul(0.5).add(0.5));
      // world position from the depth buffer (as the SSGI node reconstructs it); the depth is kept off the clear value so
      // a sky pixel yields a far but finite point (its AO is 1 and GI 0, so its skylight term drops out)
      // (reversed Z needs nothing more: the camera's projection matrix and its inverse are reversed)
      const near = float(camera.near), far = float(camera.far);
      let d: any = clamp(dep.r, 1e-7, 1 - 1e-7);
      if (renderer.logarithmicDepthBuffer) d = viewZToPerspectiveDepth(logarithmicDepthToViewZ(d, near, far), near, far);
      const pView = getViewPosition(uv(), d, uniform(camera.projectionMatrixInverse));
      const pWorld = this.camWorld.mul(vec4(pView, 1)).xyz;
      const P = probeAmbient(pWorld, nW, this.hemiSky, probeSun, hemiIrr);
      const w = P.w, sky = dif.rgb.mul(P.E).mul(1 / Math.PI);
      // the SSGI's input: the direct light only (D-157; ab.giDirect = 0: the whole scene, as in session 4)
      const colDirect = max(col.rgb.sub(sky.mul(this.ab.giDirect)), vec3(0));
      const node = (V.includes('orig') ? ssgiOrig(col, dep, nrm, camera) : ssgi(vec4(colDirect, 1), dep, nrm, camera)) as any;
      node.sliceCount.value = quality === 'ultra' ? 3 : 2; node.stepCount.value = quality === 'ultra' ? 16 : 8;
      node.giIntensity.value = GI_SCALE;
      if (!V.includes('orig')) {
        node.thickness.value = SSGI_THICKNESS; node.useLinearThickness.value = true;
        node.aoNearRadius.value = SSGI_CONTACT_RADIUS; node.nearSteps.value = SSGI_CONTACT_STEPS;
      }
      const aoTex = node.getAONode(), aoFull = aoTex.r, aoNear = V.includes('orig') ? aoTex.r : aoTex.g, bounce = node.getGINode().rgb;
      // sky pixels come out of the SSGI pass with AO 1 and GI 0 (patched node), so the composite leaves them unchanged
      const ao = mix(mix(aoFull, min(aoFull, aoNear), this.ab.contact), aoNear, w);
      const bounceW = mix(float(1).sub(w), float(1), this.ab.giDirect);
      const lit = max(col.rgb.sub(sky.mul(float(1).sub(ao))).add(dif.rgb.mul(bounce).mul(bounceW)), vec3(0));
      // ---- SSR (D-157) ----------------------------------------------------------------------------------------------
      const vV = normalize(pView.negate()), dotNV = clamp(dot(nV, vV), 0, 1);
      const rough = nrmTex.a, metal = dif.a, F0 = mix(vec3(0.04, 0.04, 0.04), dif.rgb, metal);
      const spec: any = EnvironmentBRDF({ dotNV, specularColor: F0, specularF90: float(1), roughness: rough }), specY = luminance(spec).max(1e-4);
      const notSky = (renderer as any).reversedDepthBuffer && (renderer.backend as any).isWebGPUBackend ? smoothstep(0, 1e-9, dep.r) : float(1).sub(smoothstep(1 - 1e-7, 1, dep.r));
      const gate = float(1).sub(smoothstep(SSR_MAX_ROUGHNESS - 0.1, SSR_MAX_ROUGHNESS, rough)).mul(notSky);
      // SSRNode (mirror mode) weights a hit by `metalnessNode` × its own Fresnel term sin²θ = 1 − (n·v)², which the
      // split-sum reflectance already contains: divided out
      const fres = float(1).sub(dotNV.mul(dotNV)).max(0.05);
      // the colour the rays fetch is capped at BLOOM_SAT × display white (D-183): a brazier flame (HDR, no depth) times the
      // SSR weights overflowed the node's half-float target, and the Inf became NaN in TRAA: black streaks on the surfaces
      // that reflected the flame (dawn-glow-e at high, session 6). A reflection brighter than that saturates anyway.
      const colSSR = vec4(min(col.rgb, vec3(float(BLOOM_SAT).div(this.expAbs.max(1e-6)))), col.a);
      const S: any = ssr(colSSR, dep, nrm, { metalnessNode: specY.div(fres).mul(gate).mul(this.ab.ssr), roughnessNode: rough, camera } as any);
      S.maxDistance.value = SSR_MAX_DISTANCE; S.thickness.value = SSR_THICKNESS; S.quality.value = quality === 'ultra' ? 0.5 : 0.3;
      S.resolutionScale = quality === 'ultra' ? 1 : 0.5; // half resolution at high: the reflections of these surfaces are blurred anyway
      // the sky environment the material reflected (the same lookup and specular occlusion as SkySpecularNode: the
      // dominant direction, the probe field's visibility through the cone fit), removed where a ray hits, by the node's own
      // falloff (1 − plane distance / max distance)²; alpha = the hit's distance along the ray
      const r4 = rough.mul(rough).mul(rough).mul(rough);
      const Rw = this.camWorld.mul(vec4(mix(reflect(vV.negate(), nV), nV, r4).normalize(), 0)).xyz;
      const envOcc = specularOcclusion(skyEnv.occlusion ? skyEnv.occlusion(pWorld, nW, Rw) : float(1), dotNV, rough);
      const envSpec = spec.mul((pmremTexture as any)(skyEnv.target.texture, Rw, rough)).mul(envOcc).mul(skyEnv.intensity);
      const hit = clamp(S.a.mul(50), 0, 1), fall = float(1).sub(clamp(S.a.mul(dotNV).div(SSR_MAX_DISTANCE), 0, 1));
      const ssrAdd = S.rgb.mul(spec.div(specY)).sub(envSpec.mul(hit).mul(fall.mul(fall))).mul(gate).mul(this.ab.ssr);
      // ---- sun contact shadows (D-157) --------------------------------------------------------------------------------
      // the pixel's share of direct sun: its direct light (scene − skylight) bounded by the unshadowed Lambert sun term
      // albedo · E_sun · max(0, n·l) / π, so a pixel the shadow map already darkens loses nothing more
      let sunLoss: any = vec3(0);
      if (this.sun) {
        const C: any = sss(dep, camera, this.sun); C.maxDistance.value = SSS_MAX_DISTANCE; C.thickness.value = SSS_THICKNESS; C.quality.value = 0.5;
        C.resolutionScale = quality === 'ultra' ? 1 : 0.5;
        const sunEst = dif.rgb.mul(this.sunE).mul(max(dot(nW, this.sunDirW), 0)).mul(1 / Math.PI);
        sunLoss = min(max(col.rgb.sub(sky), vec3(0)), sunEst).mul(float(1).sub(C.r)).mul(notSky).mul(this.ab.sss);
        this.sssDebug = vec3(C.r);
      }
      const litR = max(lit.add(ssrAdd).sub(sunLoss), vec3(0));
      // [reserved: the air-light pass (another agent) joins here]
      // debug views are chosen when the pipeline is built (?post=scene|ao|aonear|gi|probe|plain|direct|ssr|env|sss; probe =
      // (w, AO near, AO full) as RGB): a runtime select() on these texture nodes inside the TRAA input made the first-frame
      // node build run away and crash the page (session-2 bisect)
      const chosen = V.includes('scene') ? col.rgb : V.includes('aonear') ? vec3(aoNear) : V.includes('ao') ? vec3(ao) : V.includes('gi') ? bounce
        : V.includes('probe') ? vec3(w, aoNear, aoFull) : V.includes('plain') ? col.rgb.mul(aoFull).add(dif.rgb.mul(bounce)) : V.includes('direct') ? colDirect
        : V.includes('ssr') ? S.rgb.mul(spec.div(specY)) : V.includes('env') ? envSpec : V.includes('sss') ? (this.sssDebug ?? vec3(1)) : litR;
      composite = vec4(chosen, col.a);
    }
    composite = addAirLight(composite, dep, camera, this.sun); // D-156 (item 15): sunlit dust in the halls' air, before TRAA — src/render/airlight.ts
    let out: any = traa(composite, dep, vel, camera);
    const bin = vec4(min(out.rgb, vec3(float(BLOOM_SAT).div(this.expAbs.max(1e-6)))), float(1)); // sensor-like saturation (display terms)
    const b = bloom(bin, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD); this.bloomNode = b;
    // frame meter (D-159): the TRAA output before exposure, averaged into a tiny float target each frame; its sample
    // joins the graph at weight 0 so the render-to-texture runs with the pipeline
    const meter = meterNode(out); this.meterTarget = meter.renderTarget;
    out = out.add(b).add(this.flash).add(meter.sample(vec2(0.5, 0.5)).x.mul(this.meterZero));
    this.rp = new THREE.RenderPipeline(renderer, out);
  }
  /** The bloom threshold applies to the scene before exposure. Interior exposures (D-141) run up to hundreds of times the
   *  outdoor range, so a fixed threshold would flood a hall's view with glare from every sunlit doorway. `rel` = exposure /
   *  X_MAX: at or below 1 (every outdoor and night state) the threshold is the session-3 value; above it, the threshold
   *  scales down with the exposure so it stays the same in display terms. */
  setExposure(rel: number, abs = rel) {
    const b = this.bloomNode as any, r = Math.max(1, rel);
    this.expAbs.value = abs;
    if (b?.threshold && 'value' in b.threshold) b.threshold.value = BLOOM_THRESHOLD / r;
    // a tight kernel at interior exposures: the broad mips fade out by 8× the outdoor range (a lens's glare is a sharp core
    // with a weak tail; the broad Gaussian stack veiled the near columns in the Hadish hall)
    if (b?.radius && 'value' in b.radius) { const t = Math.min(1, Math.max(0, (r - 1) / 7)); b.radius.value = BLOOM_RADIUS * (1 - t * t * (3 - 2 * t)); }
    // the glow is a fraction of the source added before exposure: a doorway 1,000× brighter than an adapted hall would
    // haze half the frame (first interior render, D-141). Strength falls as 1/√(exposure above the outdoor range) (C).
    if (b?.strength && 'value' in b.strength) b.strength.value = BLOOM_STRENGTH / Math.sqrt(r);
  }
  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.hemi) { // hemisphere-light uniforms follow the light (colour × intensity, as HemisphereLightNode does)
      this.hemiSky.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity);
      this.hemiGround.value.copy(this.hemi.groundColor).multiplyScalar(this.hemi.intensity);
    }
    updateProbeLights(this.hemi, this.sun);
    if (this.sun) { // the contact shadows' sun (D-157)
      this.sunDirW.value.subVectors(this.sun.position, this.sun.target.position).normalize();
      this.sunE.value.copy(this.sun.color).multiplyScalar(this.sun.visible ? this.sun.intensity : 0);
    }
    this.env?.update(this.hemi); // the sky environment, re-captured when the sun or the light has changed (D-157)
    if (!this.built) this.build();
    if (this.rp) this.rp.render(); else this.renderer.render(scene, camera);
  }
}
