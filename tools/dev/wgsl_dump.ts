// dev (D-250): generate a surface material's WGSL in node (three's WGSL node builder, the baked probe field loaded, a hemisphere
// light and a shadow-casting sun, as in the page) and report its size and the most repeated lines: what makes the 100-270 KB
// fragment shaders that SwiftShader takes seconds each to compile. Usage: npx tsx tools/dev/wgsl_dump.ts [surface] [out.wgsl]
import * as THREE from 'three/webgpu';
import { readFileSync, writeFileSync } from 'node:fs';
import { surfaceMaterial, SURFACES } from '../../src/render/materials';
import { installProbeLight, setProbeField } from '../../src/render/probes/runtime';
import { decodeField } from '../../src/render/probes/field';
const [name = Object.keys(SURFACES)[0], out] = process.argv.slice(2);
(globalThis as any).location = { search: '' };
const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
if (!process.env.NOPROBES) setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note });
const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
// the page's lights, sky, aerial fog node and post pipeline (sky specular occlusion), as main.ts builds them at quality Q
const { SkySystem } = await import('../../src/sky/skySystem'), { Pipeline } = await import('../../src/render/pipeline');
const Q = (process.env.Q ?? 'test') as any; r.setSize(960, 540, false);
const sky: any = new SkySystem(scene, 1024, Q); new Pipeline(r, scene, camera, Q, sky.hemi);
if (process.env.NOFOG) (scene as any).fogNode = null;
for (let i = 0; i < +(process.env.FIRES ?? 0); i++) { const l = new THREE.PointLight(0xffaa66, 1, 20, 2); l.position.set(i, 2, 0); scene.add(l); } // the fire system's lights (fire.ts)
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial(name));
const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, camera); { const ls: any[] = []; scene.traverse((o: any) => { if (o.isLight) ls.push(o); }); const drop = (process.env.DROP ?? '').split(',').filter(Boolean).map(Number);
  if (process.env.LIST) console.log(ls.map((l, i) => `${i}:${l.type}:${l.name}:${l.castShadow ? 'shadow' : ''}`).join(' '));
  b.lightsNode.setLights(ls.filter((_, i) => !drop.includes(i))); }
b.fogNode = (scene as any).fogNode;
const t = performance.now(); b.build(); const ms = performance.now() - t;
const f: string = b.fragmentShader, v: string = b.vertexShader;
if (out) { writeFileSync(out, f); writeFileSync(out.replace(/\.wgsl$/, '') + '.vert.wgsl', v); }
const lines = f.split('\n').map(l => l.trim().replace(/nodeVar\d+|nodeConst\d+|nodeTemp\d+|\d+(\.\d+)?/g, '#')).filter(l => l.length > 20);
const cnt = new Map<string, number>(); for (const l of lines) cnt.set(l, (cnt.get(l) ?? 0) + 1);
console.log(`${name}: fragment ${f.length} chars, ${f.split('\n').length} lines; vertex ${v.length}; build ${ms.toFixed(0)} ms`);
console.log(`textureSample* calls: ${(f.match(/textureSample\w*\(/g) ?? []).length}; fn declarations: ${(f.match(/\nfn /g) ?? []).length}`);
for (const [l, n] of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(String(n).padStart(5), l.slice(0, 150));
