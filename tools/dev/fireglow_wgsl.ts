// dev (D-355): build the deferred fire term (src/render/fireGlow.ts) into a material's WGSL in node (three's WGSL node
// builder, the fire occlusion atlas loaded): a TSL error shows here in seconds, not after a GPU page load.
// Usage: npx tsx tools/dev/fireglow_wgsl.ts [out.wgsl]
import * as THREE from 'three/webgpu';
import { writeFileSync } from 'node:fs';
import { positionWorld, normalWorld, vec4 } from 'three/tsl';
(globalThis as any).location = { search: '' };
const { fireGlowIrradiance } = await import('../../src/render/fireGlow');
const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1000);
const m = new (THREE as any).MeshBasicNodeMaterial(); m.colorNode = vec4(fireGlowIrradiance(positionWorld, normalWorld), 1);
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = m;
b.build();
const f: string = b.fragmentShader;
if (process.argv[2]) writeFileSync(process.argv[2], f);
console.log('fragment WGSL', f.length, 'chars;', (f.match(/for \(/g) ?? []).length, 'loops;', (f.match(/textureLoad/g) ?? []).length, 'textureLoad');
