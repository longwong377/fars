// D-680: the season's cloud types (cloudKind.ts) and the deck/veil shaders building with them
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { cloudKind, cirrusToday, doyOf } from '../src/sky/cloudKind';
import { VolumetricClouds } from '../src/sky/clouds';
import { Air } from '../src/sky/aerial';
import { SkySystem } from '../src/sky/skySystem';

describe('D-680 the season\'s clouds', () => {
  it('winter sheets, spring and summer cumulus, autumn cirrus', () => {
    const jan = cloudKind(15), apr = cloudKind(105), jul = cloudKind(196), oct = cloudKind(288);
    expect(jan.stratus).toBeGreaterThan(0.6); expect(apr.stratus).toBeLessThan(0.2); expect(jul.stratus).toBeLessThan(0.05);
    expect(oct.cirrus).toBeGreaterThan(jan.cirrus); expect(oct.cirrus).toBeGreaterThan(jul.cirrus);
    expect(doyOf(0)).toBe(106); expect(cirrusToday(288, 0.3, 1)).toBe(0);
    for (let d = 0; d < 365; d += 3) { const k = cloudKind(d); expect(k.stratus).toBeGreaterThanOrEqual(0); expect(k.cirrus).toBeGreaterThan(0); }
  });
  it('the deck and the dome build (WGSL)', () => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas }); r.hasFeature = () => true;
    const c = new VolumetricClouds(9000, 'high', new (Air as any)()); const sky: any = new SkySystem(new THREE.Scene(), 256, 'test');
    for (const o of [c.mesh, sky.sky]) { const b = new (THREE as any).WGSLNodeBuilder(o, r); b.scene = new THREE.Scene(); b.camera = new THREE.PerspectiveCamera(); b.material = o.material; b.build(); expect(b.fragmentShader.length).toBeGreaterThan(1000); }
  });
});
