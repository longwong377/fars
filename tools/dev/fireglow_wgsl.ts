// dev (D-355): node-side checks of the fire lights' shader cost, in seconds instead of a GPU page load.
// (1) the deferred fire term (src/render/fireGlow.ts) built into WGSL: a TSL error, or a Loop dropped outside Fn, shows here;
// (2) a lit surface's fragment shader (materials.ts surfaceMaterial, the probe field and the fire occlusion atlas loaded, a
// hemisphere light and a shadow-casting sun) with the fire system's forward lights as the world makes them: the session-13
// set (12 at high) against D-355's 4, with their colour nodes (room mask, occlusion atlas). Size and texture loads are what
// every lit pixel of every lit material pays.
// Usage: npx tsx tools/dev/fireglow_wgsl.ts [surface] [out.wgsl]
import * as THREE from 'three/webgpu';
import { readFileSync, writeFileSync } from 'node:fs';
import { positionWorld, normalWorld, vec4 } from 'three/tsl';
(globalThis as any).location = { search: '' };
const [surface = 'limestone', out] = process.argv.slice(2);
const { setFireOcc } = await import('../../src/world/fireOcc');
{ const meta = JSON.parse(readFileSync('public/generated/fire_occ.json', 'utf8')), b = readFileSync('public/generated/fire_occ.f16'), h = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const data = new Float32Array(h.length); for (let i = 0; i < h.length; i++) data[i] = THREE.DataUtils.fromHalfFloat(h[i]); setFireOcc({ ...meta, data }); }
const { installProbeLight, setProbeField } = await import('../../src/render/probes/runtime'), { decodeField } = await import('../../src/render/probes/field');
{ const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
  setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note }); }
const { fireGlowIrradiance, GLOW_MAX, FORWARD_FIRE_LIGHTS } = await import('../../src/render/fireGlow');
const { FireSystem, LEGACY_FIRE_LIGHTS } = await import('../../src/world/fire');
const { surfaceMaterial } = await import('../../src/render/materials');
const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1000);
const build = (mesh: THREE.Mesh, scene: THREE.Scene) => {
  const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material;
  b.lightsNode = r.lighting.getNode(scene, camera); const ls: any[] = []; scene.traverse((o: any) => { if (o.isLight && o.visible) ls.push(o); }); b.lightsNode.setLights(ls);
  const t = performance.now(); b.build(); return { f: b.fragmentShader as string, ms: performance.now() - t, lights: ls.length };
};
const stat = (f: string) => ({ chars: f.length, textureLoad: (f.match(/textureLoad/g) ?? []).length, textureSample: (f.match(/textureSample\w*\(/g) ?? []).length });
// (1) the deferred term
{ const m = new (THREE as any).MeshBasicNodeMaterial(); m.colorNode = vec4(fireGlowIrradiance(positionWorld, normalWorld), 1);
  const g = build(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m), new THREE.Scene()); if (out) writeFileSync(out, g.f);
  const loops = (g.f.match(/for \(/g) ?? []).length; console.log(`deferred term (${GLOW_MAX} fires): ${JSON.stringify(stat(g.f))}, loops ${loops}${loops ? '' : '  <-- BROKEN: the loop is missing'}`); }
// (2) a lit surface with the forward fire lights, before and after
for (const [tag, n, glow] of [['session 13 (12 forward)', LEGACY_FIRE_LIGHTS, 0], ['D-355 (4 forward + 12 deferred)', FORWARD_FIRE_LIGHTS.high, GLOW_MAX], ['no fire lights', 0, 0]] as const) {
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x886644, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; scene.add(sun, sun.target);
  if (n) { const F = new FireSystem(n, 0, 512, glow); scene.add(F.group); }
  const g = build(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial(surface as any)), scene);
  console.log(`${surface} with ${tag}: ${g.lights} lights in the key, fragment ${JSON.stringify(stat(g.f))}, node build ${g.ms.toFixed(0)} ms`);
}
