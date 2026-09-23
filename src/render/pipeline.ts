// Post-processing per quality (brief §8): GI + AO (SSGI, visibility bitmask), temporal AA (TRAA), bloom, AgX tone mapping.
//
// Skylight and light probes (D-110 … D-112). Every lit material receives the hemisphere light (the analytic skylight)
// through ProbeHemisphereLightNode: inside the light-probe volumes of the roofed buildings its irradiance is the light the
// openings let in (sky, sunlit courts, bounces; src/render/probes), outside them the plain hemisphere light, unchanged.
// That holds at every quality, since it is in the materials.
//
// GI composite (high/ultra; D-012). The scene pass already contains direct light plus that skylight. SSGI returns an AO
// term and one bounce of screen-space diffuse light from nearby surfaces. They are combined so that each term is counted
// once:
//   out = scene − (1 − AO) · skylightDiffuse + albedo · bounce · (1 − w)
// where skylightDiffuse = albedo · E_sky(p, n) / π is recomputed here from the same uniforms and the same probe lookup
// (p from the depth buffer), so the AO only occludes the skylight (never the sun, whose occlusion is the shadow map), and
// sky pixels are excluded from the SSGI as occluders and as light sources (patched node, src/render/ssgi.ts). w is the
// probe field's weight: inside the volumes the probes already carry the large-scale occlusion and the bounce, so AO is the
// SSGI's short-range contact AO (green channel) and the screen-space bounce is left out; outside them (w = 0) the
// composite is exactly the one before the probes.
// giIntensity: with uniform sectors weighted by the receiver cosine, a surface fully enclosed by radiance L accumulates
// 2L/π per slice, while a Lambert surface under that enclosure reflects albedo·L; so the scale is π/2 (C, derivation only).
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, sample, velocity, diffuseColor, vec4, vec3, uniform, mix, max, float, uv, getViewPosition, logarithmicDepthToViewZ, viewZToPerspectiveDepth, clamp, min } from 'three/tsl';
import { ssgi } from './ssgi';
import { ssgi as ssgiOrig } from 'three/addons/tsl/display/SSGINode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Quality } from '../core/settings';
import { installProbeLight, updateProbeLights, probeAmbient, probeSun } from './probes/runtime';

export const GI_SCALE = Math.PI / 2;
/** bloom threshold (scene radiance, before exposure) at the outdoor exposures; scaled for interior exposures (D-141) */
export const BLOOM_THRESHOLD = 0.9, BLOOM_STRENGTH = 0.12;
/** the glare's input saturates at this many times display white (after exposure), as a sensor does: an interior exposed
 *  hundreds of times the outdoor one cannot feed a sunlit doorway at 100–400× white into the glare (session 4 triage) */
export const BLOOM_SAT = 16;
/** the bloom radius (the weight of its broad mips) outdoors; it falls to 0 (the narrow mips) at interior exposures */
export const BLOOM_RADIUS = 0.35;

export class Pipeline {
  rp: THREE.RenderPipeline | null = null;
  readonly flash = uniform(0); // lightning flash (additive)
  private hemiSky = uniform(new THREE.Color());
  private hemiGround = uniform(new THREE.Color());
  private camWorld: any;
  private sun: THREE.DirectionalLight | undefined;
  private built = false;
  private bloomNode: unknown = null;
  /** the absolute exposure (renderer.toneMappingExposure), for the glare's saturation cap */
  private expAbs = uniform(1);
  constructor(private renderer: THREE.WebGPURenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, readonly quality: Quality, private hemi?: THREE.HemisphereLight) {
    installProbeLight(renderer); // before any material is built
    // the sun: the shadow-casting directional light (SkySystem.sun)
    scene.traverse(o => { if (!this.sun && (o as any).isDirectionalLight && o.castShadow) this.sun = o as THREE.DirectionalLight; });
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
    scenePass.setMRT(mrt({ output, diffuseColor, normal: packNormalToRGB(normalView), velocity }));
    const col = scenePass.getTextureNode('output'), dep = scenePass.getTextureNode('depth'), nrmTex = scenePass.getTextureNode('normal');
    const vel = scenePass.getTextureNode('velocity'), dif = scenePass.getTextureNode('diffuseColor');
    const nrm = sample((uv: any) => unpackRGBToNormal(nrmTex.sample(uv)));
    let composite: any;
    if (quality === 'medium') {
      composite = col; // TRAA only: GTAO's shader module fails to compile under SwiftShader (logged D-009); medium keeps AA without AO
    } else {
      const V = new URLSearchParams(location.search).get('post') ?? ''; // debug: orig = unpatched three node; scene | ao | aonear | gi | probe | plain = debug views
      const node = (V.includes('orig') ? ssgiOrig(col, dep, nrm, camera) : ssgi(col, dep, nrm, camera)) as any;
      node.sliceCount.value = quality === 'ultra' ? 3 : 2; node.stepCount.value = quality === 'ultra' ? 16 : 8;
      node.giIntensity.value = GI_SCALE;
      const aoTex = node.getAONode(), aoFull = aoTex.r, aoNear = V.includes('orig') ? aoTex.r : aoTex.g, bounce = node.getGINode().rgb;
      // sky pixels come out of the SSGI pass with AO 1 and GI 0 (patched node), so the composite leaves them unchanged
      // world-space normal from the view-space normal (camera rotation), for the hemisphere-light weight
      this.camWorld = uniform(camera.matrixWorld);
      const nW = this.camWorld.mul(vec4(unpackRGBToNormal(nrmTex.rgb), 0)).xyz.normalize();
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
      const w = P.w, ao = mix(aoFull, aoNear, w);
      const sky = dif.rgb.mul(P.E).mul(1 / Math.PI);
      const lit = max(col.rgb.sub(sky.mul(float(1).sub(ao))).add(dif.rgb.mul(bounce).mul(float(1).sub(w))), vec3(0));
      // debug views are chosen when the pipeline is built (?post=scene|ao|aonear|gi|probe|plain; probe = (w, AO near, AO full)
      // as RGB): a runtime select() on these
      // texture nodes inside the TRAA input made the first-frame node build run away and crash the page (session-2 bisect)
      const chosen = V.includes('scene') ? col.rgb : V.includes('aonear') ? vec3(aoNear) : V.includes('ao') ? vec3(ao) : V.includes('gi') ? bounce
        : V.includes('probe') ? vec3(w, aoNear, aoFull) : V.includes('plain') ? col.rgb.mul(aoFull).add(dif.rgb.mul(bounce)) : lit;
      composite = vec4(chosen, col.a);
    }
    let out: any = traa(composite, dep, vel, camera);
    const bin = vec4(min(out.rgb, vec3(float(BLOOM_SAT).div(this.expAbs.max(1e-6)))), float(1)); // sensor-like saturation (display terms)
    const b = bloom(bin, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD); this.bloomNode = b;
    out = out.add(b).add(this.flash);
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
    if (!this.built) this.build();
    if (this.rp) this.rp.render(); else this.renderer.render(scene, camera);
  }
}
