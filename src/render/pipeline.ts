// Post-processing per quality (brief §8): GI + AO (SSGI, visibility bitmask), temporal AA (TRAA), bloom, AgX tone mapping.
//
// GI composite (high/ultra; D-012). The scene pass already contains direct light plus the hemisphere light (the analytic
// skylight). SSGI returns an AO term and one bounce of screen-space diffuse light from nearby surfaces. They are combined
// so that each term is counted once:
//   out = scene − (1 − AO) · skylightDiffuse + albedo · bounce
// where skylightDiffuse = albedo · hemiIrradiance(n) / π is recomputed here from the same hemisphere-light uniforms, so the
// AO only occludes the skylight (never the sun, whose occlusion is the shadow map), and sky pixels are excluded from the
// SSGI as occluders and as light sources (patched node, src/render/ssgi.ts).
// giIntensity: with uniform sectors weighted by the receiver cosine, a surface fully enclosed by radiance L accumulates
// 2L/π per slice, while a Lambert surface under that enclosure reflects albedo·L; so the scale is π/2 (C, derivation only).
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, sample, velocity, diffuseColor, vec4, vec3, uniform, mix, max, select, float } from 'three/tsl';
import { ssgi } from './ssgi';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Quality } from '../core/settings';

export const GI_SCALE = Math.PI / 2;

export class Pipeline {
  rp: THREE.RenderPipeline | null = null;
  readonly flash = uniform(0); // lightning flash (additive)
  /** debug / measurement: 0 = full composite, 1 = scene pass only, 2 = AO only (grey), 3 = bounce only */
  readonly debugView = uniform(0);
  private hemiSky = uniform(new THREE.Color());
  private hemiGround = uniform(new THREE.Color());
  private camWorld: any;
  constructor(private renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, readonly quality: Quality, private hemi?: THREE.HemisphereLight) {
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
      const node = ssgi(col, dep, nrm, camera) as any;
      node.sliceCount.value = quality === 'ultra' ? 3 : 2; node.stepCount.value = quality === 'ultra' ? 16 : 8;
      node.giIntensity.value = GI_SCALE;
      const ao = node.getAONode().r, bounce = node.getGINode().rgb;
      // sky pixels: nothing writes depth there (D-007), so the depth is the clear value
      const reversed = renderer.reversedDepthBuffer === true && (renderer.backend as any).isWebGPUBackend === true;
      const d = dep.r; const isSky = reversed ? d.lessThanEqual(0.0) : d.greaterThanEqual(1.0);
      // world-space normal from the view-space normal (camera rotation), for the hemisphere-light weight
      this.camWorld = uniform(camera.matrixWorld);
      const nW = this.camWorld.mul(vec4(unpackRGBToNormal(nrmTex.rgb), 0)).xyz.normalize();
      const hemiIrr = mix(this.hemiGround, this.hemiSky, nW.y.mul(0.5).add(0.5));
      const sky = dif.rgb.mul(hemiIrr).mul(1 / Math.PI);
      const lit = max(col.rgb.sub(sky.mul(float(1).sub(ao))).add(dif.rgb.mul(bounce)), vec3(0));
      const dbg = this.debugView;
      const chosen = select(dbg.equal(1), col.rgb, select(dbg.equal(2), vec3(ao), select(dbg.equal(3), bounce, lit)));
      composite = vec4(select(isSky, col.rgb, chosen), col.a);
    }
    let out: any = traa(composite, dep, vel, camera);
    const b = bloom(out, 0.12, 0.35, 0.9);
    out = out.add(b).add(this.flash);
    this.rp = new THREE.RenderPipeline(renderer, out);
  }
  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.hemi) { // hemisphere-light uniforms follow the light (colour × intensity, as HemisphereLightNode does)
      this.hemiSky.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity);
      this.hemiGround.value.copy(this.hemi.groundColor).multiplyScalar(this.hemi.intensity);
    }
    if (this.rp) this.rp.render(); else this.renderer.render(scene, camera);
  }
}
