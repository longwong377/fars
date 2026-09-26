// dev (D-250): build every surface shader in node and count how many distinct programs remain once numeric literals are ignored
// (how far per-surface uniforms would merge the surface pipelines). Usage: npx tsx tools/dev/surface_structs.ts
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { surfaceMaterial, SURFACES } from '../../src/render/materials';
import { installProbeLight, setProbeField, setProbeLoop } from '../../src/render/probes/runtime';
import { decodeField } from '../../src/render/probes/field';
process.chdir('/home/user/fars');
const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note } as any);
setProbeLoop(true);
const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6); scene.add(hemi);
const out: Record<string, string[]> = {}; let tot = 0;
for (const k of Object.keys(SURFACES)) for (const arch of [false, true]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial(k, { arch }));
  const b = new (THREE as any).WGSLNodeBuilder(m, r); b.scene = scene; b.camera = camera; b.material = m.material; b.lightsNode = r.lighting.getNode(scene, camera); b.lightsNode.setLights([hemi]);
  try { b.build(); } catch (e) { continue; }
  const f: string = b.fragmentShader; tot++;
  const norm = f.replace(/-?\d+\.\d+(e-?\d+)?|\b\d+u?\b/g, '#');
  (out[norm] ??= []).push(k + (arch ? '+arch' : ''));
}
const groups = Object.values(out).sort((a, b) => b.length - a.length);
console.log(`${tot} surface shaders; ${groups.length} distinct once numbers are ignored`);
for (const g of groups.slice(0, 15)) console.log(g.length, g.slice(0, 8).join(' '));
