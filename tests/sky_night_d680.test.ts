// D-680: the night sky: stars come out one by one through the twilights (limiting magnitude), and the star sprites build
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { SkySystem, starLimitMag } from '../src/sky/skySystem';

describe('D-680 stars through the twilight', () => {
  it('none in daylight, the brightest at the end of civil twilight, the faintest only in astronomical night', () => {
    expect(starLimitMag(5)).toBeLessThan(-2);
    expect(starLimitMag(-6)).toBeGreaterThan(0); expect(starLimitMag(-6)).toBeLessThan(1.5); // Sirius, Vega, Arcturus, the planets
    expect(starLimitMag(-9)).toBeGreaterThan(2.5); expect(starLimitMag(-9)).toBeLessThan(3.5);
    expect(starLimitMag(-18)).toBeCloseTo(6.5); expect(starLimitMag(-40)).toBeCloseTo(6.5);
    for (let a = 4; a > -30; a -= 0.5) expect(starLimitMag(a - 0.5)).toBeGreaterThanOrEqual(starLimitMag(a));
  });
  it('the star sprites build (WGSL)', () => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas }); r.hasFeature = () => true;
    const sky: any = new SkySystem(new THREE.Scene(), 256, 'test');
    const g = sky.stars.geometry; for (const [a, n] of [['bright', 1], ['tint', 3], ['mag', 1]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(3 * n), n));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const b = new (THREE as any).WGSLNodeBuilder(sky.stars, r); b.scene = new THREE.Scene(); b.camera = new THREE.PerspectiveCamera(); b.material = sky.stars.material; b.build();
    expect(b.fragmentShader).toContain('exp');
  });
});
describe('D-680 the Moon\'s face', () => {
  it('the moon material builds with its maria (WGSL)', () => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas }); r.hasFeature = () => true;
    const sky: any = new SkySystem(new THREE.Scene(), 256, 'test');
    const b = new (THREE as any).WGSLNodeBuilder(sky.moon, r); b.scene = new THREE.Scene(); b.camera = new THREE.PerspectiveCamera(); b.material = sky.moon.material; b.build();
    expect((b.fragmentShader.match(/exp\(/g) ?? []).length).toBeGreaterThan(8);
  });
});
