// D-300: WebGPU allows 16 samplers per fragment stage (the adapter's sampled-texture limit was raised, D-295; the sampler limit
// was not). Render v4 (session 11, T4) failed the Terrace platform's pipeline at 17 when the wall's scan took a normal map:
// its node-built fragment then declared 8 samplers, render 3's (which passed) 7, so the page adds 9 (shadow maps, light probes,
// the reliefs' shadow atlas, the environment). Every surface's node count must stay at 7 or under
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { surfaceMaterial, paintedStoneMaterial, SURFACES } from '../src/render/materials';
import { setScanTexturesForTest } from '../src/render/scans';
import { installProbeLight } from '../src/render/probes/runtime';
const NODE_MAX = 6; // 16 on the page with one to spare (render 3: 7 passed; render v4: 8 failed; the merged session-11 render
// failed a pipeline at 17 with the Terrace platform at 7: the page's own count varies with the scene's lights)
describe('D-300 fragment samplers with every scan loaded (node)', () => {
  it('no surface exceeds the 16 samplers of a fragment stage on the page', () => {
    setScanTexturesForTest();
    try {
      const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
      const r: any = new (THREE as any).WebGPURenderer({ canvas }); installProbeLight(r); r.hasFeature = () => true;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(), sun);
      const g = new THREE.BoxGeometry(); for (const [a, n] of [['y0', 1], ['ytop', 1], ['stair', 4], ['pbox', 4]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * n), n));
      const count = (m: any) => { const b = new (THREE as any).WGSLNodeBuilder(new THREE.Mesh(g, m), r); b.scene = scene; b.camera = cam; b.material = m; b.lightsNode = r.lighting.getNode(scene, cam); b.build(); return ((b.fragmentShader as string).match(/: sampler[;\s]|sampler_comparison/g) ?? []).length; };
      const over: string[] = [], rows: string[] = [];
      for (const k of Object.keys(SURFACES)) for (const arch of [false, true]) { const n = count(surfaceMaterial(k, { arch })); rows.push(`${k}${arch ? '+arch' : ''} ${n}`); if (n > NODE_MAX) over.push(`${k}${arch ? '+arch' : ''}: ${n}`); }
      const np = count(paintedStoneMaterial()); if (np > NODE_MAX) over.push(`painted stone: ${np}`);
      expect(over, rows.join(', ')).toEqual([]);
    } finally { setScanTexturesForTest(false); }
  }, 600_000);
});
