// D-680: the far cascade (src/render/sunShadows.ts): its fit holds the Terrace and the town at every sun, its texel stays
// fine enough for a building at 600 m+, and it adds no sampler to a lit material (the T4's 16 per fragment stage, D-300)
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { farCascadeFit, FAR_BOX, FAR_CASCADE, FAR_ON, installSunCascades } from '../src/render/sunShadows';
import { TERRACE_BOX } from '../src/world/plain/townGround';
import { surfaceMaterial } from '../src/render/materials';
import { setScanTexturesForTest } from '../src/render/scans';
import { installProbeLight } from '../src/render/probes/runtime';
import { registerSettlementSurfaces } from '../src/world/settlement/surfaces';

const sunAt = (altDeg: number, azDeg: number) => { const a = THREE.MathUtils.degToRad(altDeg), z = THREE.MathUtils.degToRad(azDeg); return new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a)).normalize(); };

describe('D-680 far cascade fit', () => {
  it('holds the Terrace and the town box at every sun; texel under 0.9 m; the near plane leaves room sunward', () => {
    // the Terrace (grid m: e east, n north; world z = -n) lies inside the box
    expect(FAR_BOX.x0).toBeLessThanOrEqual(TERRACE_BOX.e0); expect(FAR_BOX.x1).toBeGreaterThanOrEqual(TERRACE_BOX.e1);
    expect(FAR_BOX.z0).toBeLessThanOrEqual(-TERRACE_BOX.n1); expect(FAR_BOX.z1).toBeGreaterThanOrEqual(-TERRACE_BOX.n0);
    const cam = new THREE.OrthographicCamera(), v = new THREE.Vector3();
    for (const alt of [2, 5, 15, 30, 60, 82]) for (const az of [60, 90, 135, 180, 225, 270, 300]) {
      const s = sunAt(alt, az), f = farCascadeFit(s);
      cam.position.copy(f.pos); cam.lookAt(f.target); cam.left = f.left; cam.right = f.right; cam.top = f.top; cam.bottom = f.bottom; cam.near = f.near; cam.far = f.far;
      cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      for (const x of [FAR_BOX.x0, FAR_BOX.x1]) for (const y of [FAR_BOX.y0, FAR_BOX.y1]) for (const z of [FAR_BOX.z0, FAR_BOX.z1]) {
        v.set(x, y, z).project(cam);
        expect(Math.abs(v.x), `${alt}/${az}`).toBeLessThanOrEqual(1.0001); expect(Math.abs(v.y)).toBeLessThanOrEqual(1.0001); expect(Math.abs(v.z)).toBeLessThanOrEqual(1.0001);
      }
      // a caster FAR_CASCADE.margin m sunward of the box's top centre is still in front of the near plane
      v.copy(f.target).setY(FAR_BOX.y1).addScaledVector(s, FAR_CASCADE.margin * 0.9).project(cam); expect(v.z).toBeGreaterThanOrEqual(-1);
      expect(f.texel, `${alt}/${az}`).toBeLessThan(0.9);
    }
  });
});

describe('D-680 far cascade samplers (node)', () => {
  it('a lit surface binds as many samplers with the far cascade as without it, and reads the far map by textureLoad', () => {
    registerSettlementSurfaces(); setScanTexturesForTest();
    try {
      const build = (far: boolean) => {
        FAR_ON.on = far;
        const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
        const r: any = new (THREE as any).WebGPURenderer({ canvas }); installProbeLight(r); r.hasFeature = () => true; r.hasCompatibility = () => true; r.shadowMap.enabled = true;
        const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 30000), sun = new THREE.DirectionalLight(0xffffff, 3);
        sun.castShadow = true; sun.position.set(100, 300, 50); scene.add(new THREE.HemisphereLight(), sun, sun.target);
        installSunCascades(sun, 'high');
        const g = new THREE.BoxGeometry(); for (const [a, n] of [['y0', 1], ['ytop', 1], ['stair', 4], ['pbox', 4]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * n), n));
        const m = surfaceMaterial('house_plaster', { arch: true });
        const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = cam; b.material = m; b.lightsNode = r.lighting.getNode(scene, cam); b.lightsNode.setLights([sun]); b.build();
        const fs = b.fragmentShader as string;
        return { samplers: (fs.match(/: sampler[;\s]|sampler_comparison/g) ?? []).length, loads: (fs.match(/textureLoad\(/g) ?? []).length };
      };
      const off = build(false), on = build(true);
      expect(on.samplers).toBe(off.samplers);
      expect(on.loads).toBeGreaterThanOrEqual(off.loads + 4);
    } finally { setScanTexturesForTest(false); FAR_ON.on = true; }
  }, 600_000);
});
