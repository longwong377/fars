// D-250 (the load's cost is SwiftShader compiling pipelines): the probe lookup as a loop over the volume table generates less
// WGSL than the unrolled lookup, and instanced meshes of different instance counts get one vertex program. Code generation
// in node only (three's WGSL node builder); the pixels are checked by an A/B render (DECISIONS D-250).
import { describe, it, expect, afterAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { surfaceMaterial } from '../src/render/materials';
import { installProbeLight, setProbeField, setProbeLoop, volumeTable } from '../src/render/probes/runtime';
import { decodeField, gridExtent } from '../src/render/probes/field';
import { setShareInstancing } from '../src/render/shareInstancing';

function renderer(): any {
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
  r.backend.device = { limits: { maxUniformBufferBindingSize: 65536, maxStorageBufferBindingSize: 134217728 } };
  return r;
}
function build(r: any, mesh: THREE.Mesh) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000), hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6);
  scene.add(hemi, mesh);
  const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material;
  b.lightsNode = r.lighting.getNode(scene, camera); b.lightsNode.setLights([hemi]); b.build();
  return { v: b.vertexShader as string, f: b.fragmentShader as string };
}
const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
const field = { volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note };
afterAll(() => { setProbeLoop(false); setShareInstancing(false); setProbeField(null); });

describe('shared shaders (D-250)', () => {
  it('the volume table holds every volume\'s box, fades, grid and atlas tile', () => {
    const rows = volumeTable(field.volumes, field.volumes.map((_: any, i: number) => [i * 10, 0] as [number, number]));
    expect(rows.length).toBe(7 * field.volumes.length);
    field.volumes.forEach((v: any, i: number) => { const g = gridExtent(v), R = rows.slice(i * 7, i * 7 + 7);
      expect(R[0]).toEqual([g.x0, g.x1, g.y0, g.y1]); expect(R[1]).toEqual([g.z0, g.z1, i * 10, 0]);
      expect(R[4]).toEqual([...v.origin, v.dims[0]]); expect(R[5]).toEqual([...v.spacing, v.dims[1]]); expect(R[6][0]).toBe(v.dims[2]); });
  });
  it('the looped probe lookup generates a loop and less code than the unrolled one', () => {
    setProbeField(field);
    setProbeLoop(false); const un = build(renderer(), new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial('limestone', { variant: 'd250-un' })));
    setProbeLoop(true); const lp = build(renderer(), new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial('limestone', { variant: 'd250-lp' })));
    expect(lp.f).toMatch(/for \( var i : i32 = 0; i < \d+; i \+\+ \)/);
    expect(un.f).not.toMatch(/for \( var i : i32 = 0; i < \d+; i \+\+ \)/);
    expect(lp.f.length).toBeLessThan(un.f.length * 0.85);
  });
  it('instanced meshes of different counts share one vertex program when sharing is on', () => {
    const mat = new THREE.MeshStandardNodeMaterial(), geo = new THREE.BoxGeometry(1, 1, 1);
    const vOf = (n: number) => build(renderer(), new THREE.InstancedMesh(geo, mat, n)).v.replace(/NodeBuffer_\d+/g, 'NB');
    setShareInstancing(false); expect(vOf(4)).not.toBe(vOf(24));
    setShareInstancing(true); expect(vOf(4)).toBe(vOf(24)); expect(vOf(4)).toBe(vOf(900));
  });
});
