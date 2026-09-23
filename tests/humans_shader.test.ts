// The human material's TSL graph builds to WGSL (WebGPU) and GLSL (the WebGL2 fallback) in node, with a sun and a
// hemisphere light, for the main material, its previous-frame (velocity) path and the shadow-only copy (D-155). This
// catches graph errors (types, missing methods, a swallowed expression) before a browser run: the shared render queue
// allows three runs. It is not a compiler (no naga or tint in node): WGSL/GLSL validity is checked by the browser runs
// (tests/e2e/humanlab.spec.ts). The renderer is never initialised; its feature queries are stubbed.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, type OutfitBuild } from '../src/people/outfits';
import { HumanGPU } from '../src/people/humanGPU';

let A: HumanAssets, O: OutfitBuild;
beforeAll(() => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  O = buildOutfits(A, { dresses: ['persian'], lods: [0, 2] });
}, 60_000);

function build(kind: 'wgsl' | 'glsl', which: 'main' | 'shadow', velocity = false) {
  const tex = () => { const t = new THREE.Texture(); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const gpu = new HumanGPU(A, O, { skin: tex(), eye: tex() }, { capacity: 16 });
  const cm = [...gpu.costumes.values()][0]; const mesh = which === 'main' ? cm.mesh : cm.shadow!.mesh;
  const canvas: any = { style: {}, width: 4, height: 4, addEventListener() {}, removeEventListener() {}, getContext() { return null; }, getRootNode() { return null; } };
  const renderer: any = new (THREE as any).WebGPURenderer({ canvas, forceWebGL: kind === 'glsl' });
  renderer.hasFeature = () => false; if (renderer.backend) renderer.backend.hasFeature = () => false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  scene.add(sun, hemi, mesh);
  const Builder = kind === 'wgsl' ? (THREE as any).WGSLNodeBuilder : (THREE as any).GLSLNodeBuilder;
  const builder = new Builder(mesh, renderer); builder.scene = scene; builder.camera = cam; builder.material = mesh.material;
  builder.lightsNode = renderer.lighting.getNode(scene, cam); builder.lightsNode.setLights([sun, hemi]);
  if (velocity) builder.needsPreviousData = () => true;
  builder.build();
  return { frag: String(builder.fragmentShader ?? ''), vert: String(builder.vertexShader ?? '') };
}

describe('the human material builds (D-155)', () => {
  for (const kind of ['wgsl', 'glsl'] as const) {
    it(`${kind}: main, velocity and shadow-only`, () => {
      const m = build(kind, 'main');
      expect(m.frag.length).toBeGreaterThan(20000); expect(m.vert.length).toBeGreaterThan(5000);
      // the lighting model is in: the Charlie sheen's floor, the Kajiya–Kay exponents, the wrapped diffuse
      expect(m.frag).toMatch(/0\.0078125/); expect(m.frag).toMatch(/80\.0/); expect(m.frag).toMatch(/14\.0/);
      const v = build(kind, 'main', true); expect(v.vert.length).toBeGreaterThan(m.vert.length); // previous-frame skinning
      const s = build(kind, 'shadow'); expect(s.vert.length).toBeGreaterThan(5000);
    }, 60_000);
  }
});
