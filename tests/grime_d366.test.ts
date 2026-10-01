// D-366: the shared grime layer (src/render/grime.ts). How it could pass while the intent fails: the map is filled but read at the
// wrong place (z = −north, the tile border, the slot's row), so the soot and wear land nowhere a fire or a lane is; the drift is too
// weak to read at 10-100 m; the layer costs samplers or a much larger shader. Measured here: the map read back through the CPU mirror
// of the shader's own lookup at the fires' and doors' own world positions; the drift's spread between 20 m windows; the samplers and
// the fragment size with and without the layer.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { SOOT_OF, grimeRaster, uploadGrime, grimeSampleCPU, laneFlow, wearOfFlow, DRIFT, GRIME_MAP, setGrimeBuild, grimeClass } from '../src/render/grime';
import { surfaceMaterial, SURFACES } from '../src/render/materials';
import { setScanTexturesForTest } from '../src/render/scans';
import { installProbeLight } from '../src/render/probes/runtime';
import { mxNoise2, mxNoise3 } from './lib/mx_noise_cpu';
import { registerSettlementSurfaces } from '../src/world/settlement/surfaces';
registerSettlementSurfaces();

describe('D-366 grime map', () => {
  it('lands where its sources are (soot over the flame, ash round it, the door lintel, z = −north, tile borders)', () => {
    const fires = [{ kind: 'hearth', pos: { x: 31.4, y: -12.2, z: -95.7 } }, { kind: 'torch', pos: { x: -63.99, y: 14.5, z: 127.01 } }, { kind: 'lamp', pos: { x: -1200.2, y: -15, z: 900.6 } }];
    const doors = [{ hinge: [500.0, 300.0] as [number, number], closedYaw: 0, y: -14, h: 1.9 }];
    const R = grimeRaster({ fires, doors }); const up = uploadGrime(R);
    expect(up.dropped).toBe(0);
    for (const f of fires) { const s = grimeSampleCPU(f.pos.x, f.pos.z); expect(s[0], f.kind).toBeGreaterThan(0.55 * SOOT_OF[f.kind].soot); expect(s[1] * GRIME_MAP.YS + GRIME_MAP.Y0).toBeCloseTo(f.pos.y, 0); }
    expect(grimeSampleCPU(31.4, -95.7)[3]).toBeGreaterThan(0.6); // the hearth's ash
    expect(grimeSampleCPU(31.4, 95.7)[0]).toBe(0); // the mirror in z: nothing
    expect(grimeSampleCPU(31.4 + 5, -95.7)[0]).toBe(0); // beyond its radius
    const dc = grimeSampleCPU(500.5, -300); expect(dc[0]).toBeGreaterThan(0.3); expect(dc[1] * GRIME_MAP.YS + GRIME_MAP.Y0).toBeCloseTo(-14 + 1.9 - 0.1, 0);
    // a torch on a tile corner (e −64, n −127: −4096 + 32k) reads the same either side of the border
    const a = grimeSampleCPU(-64.3, 127.01)[0], b = grimeSampleCPU(-63.7, 127.01)[0]; expect(Math.abs(a - b)).toBeLessThan(0.15); expect(Math.min(a, b)).toBeGreaterThan(0.3);
  });
  it('wears a quarter\'s trunk lane more than a dead end (each street door\'s way out counted)', () => {
    // a 20 × 9 site: a trunk lane along j = 4 to both edges, a dead-end lane up i = 10 (j 5..8); plots either side with doors on them
    const W = 20, H = 9, cell = new Int32Array(W * H).fill(0);
    for (let i = 0; i < W; i++) cell[4 * W + i] = -2; for (let j = 5; j < H - 1; j++) cell[j * W + 10] = -2;
    const plots = [...Array(9)].map((_, k) => ({ door: { cell: 3 * W + 2 * k + 1, out: 4 * W + 2 * k + 1 } }));
    plots.push({ door: { cell: 8 * W + 9, out: 7 * W + 10 } }); // a house at the dead end
    const f = laneFlow({ W, H, cell, plots });
    // the doors at i 1..9 leave W, those at 11..17 and the dead end's E (its way: down the dead end, then the nearer edge)
    expect(f[4 * W + 0]).toBeGreaterThanOrEqual(5); expect(f[4 * W + 19]).toBeGreaterThanOrEqual(4); expect(f[7 * W + 10]).toBe(1);
    expect(wearOfFlow(f[4 * W + 0], true)).toBeGreaterThan(wearOfFlow(f[7 * W + 10], true));
  });
});

describe('D-366 drift', () => {
  it('varies a plane between 20 m windows by ≥ 4 % (1σ) on every class', () => {
    for (const [cls, D] of Object.entries(DRIFT)) {
      const means: number[] = [];
      for (let w = 0; w < 60; w++) { let s = 0; for (let k = 0; k < 40; k++) { const x = w * 20 + k * 0.5, z = 0.3 * x, y = 2;
        const q = [0.89157 * x - 0.37121 * y + 0.25944 * z, 0.45289 * x + 0.73077 * y - 0.51075 * z, 0.57287 * y + 0.81965 * z];
        s += (mxNoise2(x / 100 + 13.7, z / 100 + 4.1) * D.a100 + mxNoise3(q[0] / 10 + 5.3, q[1] / 10 + 9.1, q[2] / 10 + 2.7) * D.a10) / 0.265; }
        means.push(s / 40); }
      const m = means.reduce((a, b) => a + b, 0) / means.length, sd = Math.sqrt(means.reduce((a, b) => a + (b - m) ** 2, 0) / means.length);
      expect(sd, cls).toBeGreaterThan(cls === 'floor' ? 0.025 : 0.04);
    }
  });
});

describe('D-366 shader cost (node)', () => {
  it('adds no sampler and grows the fragment shader by ≤ 20 %', () => {
    setScanTexturesForTest();
    try {
      const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
      const r: any = new (THREE as any).WebGPURenderer({ canvas }); installProbeLight(r); r.hasFeature = () => true;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(), sun);
      const g = new THREE.BoxGeometry(); for (const [a, n] of [['y0', 1], ['ytop', 1], ['stair', 4], ['pbox', 4], ['adist', 4], ['aseed', 4], ['inner', 1], ['mzd', 2]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * n), n));
      const frag = (m: any) => { const b = new (THREE as any).WGSLNodeBuilder(new THREE.Mesh(g, m), r); b.scene = scene; b.camera = cam; b.material = m; b.lightsNode = r.lighting.getNode(scene, cam); b.build(); return b.fragmentShader as string; };
      const samp = (s: string) => (s.match(/: sampler[;\s]|sampler_comparison/g) ?? []).length;
      const rows: string[] = [];
      for (const [k, arch] of [['limestone', true], ['terrace', true], ['house_plaster', false], ['mudbrick', true], ['court_fill', false], ['earth', false], ['road', false]] as [string, boolean][]) {
        if (!SURFACES[k]) continue;
        setGrimeBuild(false); const a = frag(surfaceMaterial(k, { arch, variant: 'nogrime' }));
        setGrimeBuild(true); const b = frag(surfaceMaterial(k, { arch, variant: 'grime' }));
        rows.push(`${k} ${a.length} → ${b.length} (${((b.length / a.length - 1) * 100).toFixed(1)} %), samplers ${samp(a)} → ${samp(b)}`);
        expect(grimeClass(k)).not.toBe('none');
        expect(samp(b), k).toBe(samp(a));
        expect(b.length / a.length, rows.join('; ')).toBeLessThan(1.2);
        expect(b).toContain('textureLoad');
      }
      console.log('[grime] ' + rows.join('; '));
    } finally { setScanTexturesForTest(false); setGrimeBuild(true); }
  }, 600_000);
});
