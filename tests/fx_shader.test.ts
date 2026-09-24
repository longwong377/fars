// Effect materials (colourOnly, src/render/fx.ts) generate a fragment output in every kind of pass (session 5): in the
// post pipeline's MRT pass (colour to `output`, zeros to the G-buffer) and in a direct render into an unnamed target (the
// renderer's frame-buffer target at quality test/low), where an MRT that matches no attachment produced an empty WGSL
// struct and every flame, smoke, haze, rain and snow material failed to compile on the device.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { mrt, output, vec4 } from 'three/tsl';
import { colourOnly } from '../src/render/fx';

function makeRenderer(): any {
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false });
  r.hasFeature = () => true;
  return r;
}
function fragment(renderer: any, mat: THREE.Material): string {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1000);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); scene.add(mesh);
  const b = new (THREE as any).WGSLNodeBuilder(mesh, renderer);
  b.scene = scene; b.camera = camera; b.material = mat; b.lightsNode = renderer.lighting.getNode(scene, camera);
  b.build();
  return b.fragmentShader as string;
}
const emptyStruct = (wgsl: string) => /struct\s+\w+\s*\{\s*\}/.test(wgsl);
const fx = () => colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));

describe('effect materials (colourOnly) compile in every pass', () => {
  it('a direct render into an unnamed target (quality test/low): colour to attachment 0, no empty struct', () => {
    const r = makeRenderer();
    const rt = new THREE.RenderTarget(64, 64); // as Renderer._getFrameBufferTarget: one texture, no name
    r.setRenderTarget(rt);
    const f = fragment(r, fx());
    expect(emptyStruct(f)).toBe(false);
    expect(f).toMatch(/@location\(\s*0\s*\)/);
  });
  it('the MRT pass (quality medium and up): the pipeline outputs, colour in `output`', () => {
    const r = makeRenderer();
    const rt = new THREE.RenderTarget(64, 64, { count: 4 });
    ['output', 'diffuseColor', 'normal', 'velocity'].forEach((n, i) => (rt.textures[i].name = n));
    r.setRenderTarget(rt);
    r.setMRT(mrt({ output, diffuseColor: vec4(1), normal: vec4(1), velocity: vec4(1) }));
    const f = fragment(r, fx());
    expect(emptyStruct(f)).toBe(false);
    for (let i = 0; i < 4; i++) expect(f).toMatch(new RegExp(`@location\\(\\s*${i}\\s*\\)`));
  });
});
