// Session 5: rain, wetness, puddles and snow stop at the roofed halls' eaves (src/render/probes/roofs.ts). Before, the rain
// streaks fell inside the Apadana hall and its floor darkened and puddled in rain like the open court.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { setProbeField, installProbeLight } from '../src/render/probes/runtime';
import { decodeField } from '../src/render/probes/field';
import { roofedAt, roofBoxes } from '../src/render/probes/roofs';
import { surfaceMaterial } from '../src/render/materials';
import { WeatherVfx } from '../src/world/weatherVfx';

function load() {
  const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
  setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note });
}
function frag(mat: THREE.Material, mesh?: THREE.Mesh): string {
  const canvas: any = { style: {}, width: 64, height: 64, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(46, 1, 0.05, 1000), m = mesh ?? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); scene.add(m);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun, sun.target);
  const b = new (THREE as any).WGSLNodeBuilder(m, r); b.scene = scene; b.camera = cam; b.material = m.material; b.lightsNode = r.lighting.getNode(scene, cam); b.build();
  return b.fragmentShader;
}

describe('under the roofs (session 5)', () => {
  it('the roofed halls are dry and the courts are not: Apadana hall and N portico under the roof, the N court and the Grand Stair landing open', () => {
    load();
    expect(roofBoxes().length).toBeGreaterThanOrEqual(6);
    expect(roofedAt(10.55, 3.0, -12.4)).toBe(1); // the Apadana hall floor (apadana-hall-in)
    expect(roofedAt(22, 7.5, 150)).toBe(1); // the Hadish hall (hadish-hall: grid y −150 → z 150)
    expect(roofedAt(1.9, 1.0, -58)).toBe(0); // the N court, 10 m out from the N portico (apadana-enter)
    expect(roofedAt(-39.6, 1.0, -122.45)).toBe(0); // the Grand Stair's top landing
    expect(roofedAt(10.55, 30, -12.4)).toBe(0); // above the Apadana's roof
    setProbeField(null);
    expect(roofBoxes().length).toBe(0);
  });
  it('the surface and precipitation shaders read the roof boxes (built after the field loads)', () => {
    load();
    const withRoofs = frag(surfaceMaterial('plaster'));
    const vfx = new WeatherVfx(16), rain = (vfx.group.children[0] as THREE.Mesh);
    const rainF = frag(rain.material as THREE.Material); // on a plain mesh: an instanced one needs a device's limits
    setProbeField(null);
    const without = frag(surfaceMaterial('plaster'));
    expect(withRoofs.length).toBeGreaterThan(without.length); // the box tests are in the shader only when the boxes exist
    expect(rainF.length).toBeGreaterThan(100);
  });
});
