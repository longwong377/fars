// The surface materials' shaders are generated in node (three's WGSL node builder, no GPU): a TSL error (a wrong type, a
// missing attribute, a reversed smoothstep built from constants) throws here instead of blanking a render run (D-157).
// This checks code generation only, not WGSL validation by a device.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { surfaceMaterial, paintedStoneMaterial, SURFACES } from '../src/render/materials';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { installProbeLight, setProbeField } from '../src/render/probes/runtime';
import { decodeField } from '../src/render/probes/field';
import { Pipeline } from '../src/render/pipeline';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { readFileSync } from 'node:fs';

function makeRenderer(): any {
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false });
  installProbeLight(r);
  r.hasFeature = () => true; // no device: feature queries (texture filtering of the environment's float target) answer yes
  return r;
}
function build(renderer: any, scene: THREE.Scene, camera: THREE.Camera, mesh: THREE.Mesh) {
  const b = new (THREE as any).WGSLNodeBuilder(mesh, renderer);
  b.scene = scene; b.camera = camera; b.material = mesh.material;
  b.lightsNode = renderer.lighting.getNode(scene, camera);
  b.build();
  return { vertex: b.vertexShader as string, fragment: b.fragmentShader as string };
}

describe('surface shaders build (WGSL, node)', () => {
  it('the architecture meshes, every surface and the painted stone generate WGSL', () => {
    const renderer = makeRenderer(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
    scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun, sun.target);
    const { parts } = buildTerrace();
    const arch = buildMeshes(parts.filter(p => p.building === 'apadana' || p.building === 'gate_nations' || p.building === 'grand_stair'));
    const meshes: THREE.Mesh[] = []; arch.group.traverse((o: any) => { if (o.isMesh && !o.isInstancedMesh) meshes.push(o); });
    for (const k of Object.keys(SURFACES)) meshes.push(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial(k)));
    meshes.push(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paintedStoneMaterial()));
    const fails: string[] = [];
    for (const m of meshes) {
      try { const s = build(renderer, scene, camera, m); if (!s.fragment || s.fragment.length < 100) fails.push(`${m.name}: empty`); }
      catch (e: any) { fails.push(`${m.name || (m.material as any).userData?.note?.slice(0, 40)}: ${String(e?.message ?? e).slice(0, 300)}`); }
    }
    expect(fails).toEqual([]);
  });
  it('the post graph (composite with the probe lookups, SSGI with contact samples, SSR, the environment capture) generates WGSL', () => {
    const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
    setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note });
    (globalThis as any).location = { search: '' };
    const renderer = makeRenderer(); renderer.setSize(960, 540, false);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    const sky: any = new SkyMesh(); scene.add(sky);
    const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
    scene.add(hemi, sun, sun.target);
    const pipe: any = new Pipeline(renderer, scene, camera, 'high', hemi);
    pipe.build();
    const fails: string[] = [];
    const built: string[] = [];
    const tryBuild = (name: string, mat: any) => { built.push(name); try { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); const b = new (THREE as any).WGSLNodeBuilder(q, renderer); b.scene = scene; b.camera = camera; b.material = mat; b.build(); if (!b.fragmentShader) fails.push(name + ': empty'); } catch (e: any) { fails.push(`${name}: ${String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ').slice(0, 500)}`); } };
    const out = new (THREE as any).NodeMaterial(); out.fragmentNode = pipe.rp.outputNode; tryBuild('composite', out);
    // the SSGI and SSR nodes set their own quad materials up while the composite is built
    const walk = (n: any, seen = new Set<any>()): any[] => { if (!n || typeof n !== 'object' || seen.has(n)) return []; seen.add(n); const r = n.isNode ? [n] : []; for (const k of Object.keys(n)) { const v = n[k]; if (v && typeof v === 'object' && (v.isNode || Array.isArray(v))) r.push(...walk(v, seen)); } return r; };
    // their own passes: set each node up (as the renderer does before its first frame), then build its quad material
    const setupBuilder = () => { const b = new (THREE as any).WGSLNodeBuilder(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new (THREE as any).NodeMaterial()), renderer); b.scene = scene; b.camera = camera; return b; };
    for (const n of walk(pipe.rp.outputNode)) {
      if (n.constructor?.name === 'SSGINode') { try { n.setup(setupBuilder()); tryBuild('ssgi', n._material); } catch (e: any) { fails.push('ssgi setup: ' + String(e?.message ?? e).slice(0, 300)); } }
      if (n.constructor?.name === 'SSRNode') { try { n.setup(setupBuilder()); tryBuild('ssr', n._ssrMaterial); } catch (e: any) { fails.push('ssr setup: ' + String(e?.message ?? e).slice(0, 300)); } }
    }
    // the environment's dome material (SkyMesh nodes, masked sun disc, ground below the horizon)
    const env = pipe.env; tryBuild('environment dome', env.scene.children[0].material);
    setProbeField(null);
    expect(fails).toEqual([]);
    expect(built).toEqual(expect.arrayContaining(['composite', 'ssgi', 'ssr', 'environment dome']));
  });
});
