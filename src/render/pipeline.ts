// Post-processing per quality (brief §8): GI (SSGI) or AO (GTAO), temporal AA (TRAA), bloom, AgX tone mapping.
import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, packNormalToRGB, unpackRGBToNormal, sample, velocity, diffuseColor, vec4, add, uniform } from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import type { Quality } from '../core/settings';

export class Pipeline {
  rp: THREE.RenderPipeline | null = null;
  readonly flash = uniform(0); // lightning flash (additive)
  constructor(private renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, readonly quality: Quality) {
    if (quality === 'test' || quality === 'low') return; // direct render (MSAA in the renderer)
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({ output, diffuseColor, normal: packNormalToRGB(normalView), velocity }));
    const col = scenePass.getTextureNode('output'), dep = scenePass.getTextureNode('depth'), nrmTex = scenePass.getTextureNode('normal');
    const vel = scenePass.getTextureNode('velocity'), dif = scenePass.getTextureNode('diffuseColor');
    const nrm = sample((uv: any) => unpackRGBToNormal(nrmTex.sample(uv)));
    let composite: any;
    if (quality === 'medium') {
      composite = col; // TRAA only: GTAO's shader module fails to compile under SwiftShader (logged D-009); medium keeps AA without AO
    } else {
      const gi = ssgi(col, dep, nrm, camera) as any;
      gi.sliceCount.value = quality === 'ultra' ? 3 : 2; gi.stepCount.value = quality === 'ultra' ? 16 : 8;
      composite = vec4(add(col.rgb.mul(gi.a), dif.rgb.mul(gi.rgb)), col.a);
    }
    let out: any = traa(composite, dep, vel, camera);
    const b = bloom(out, 0.12, 0.35, 0.9);
    out = out.add(b).add(this.flash);
    this.rp = new THREE.RenderPipeline(renderer, out);
  }
  render(scene: THREE.Scene, camera: THREE.Camera) { if (this.rp) this.rp.render(); else this.renderer.render(scene, camera); }
}
