// D-321: the dressed stone's block faces from the Blender-carved detail set (tools/blender/blockface.{json,py,mjs};
// src/render/blockface.ts). Holds: the set is current (its inputs' hash), the shipped KTX2 is the recorded one and an array of
// every layer, the layers' statistics are those of carved stone (not flat, not noise), every dressed-stone surface of the
// world takes it (the whole class, not one hero surface), and no surface exceeds WebGPU's 16 samplers with it loaded.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import META from '../src/data/blockface.json';
import { SURFACES, surfaceMaterial } from '../src/render/materials';
import { setScanTexturesForTest } from '../src/render/scans';
import { setBlockFaceTextureForTest, BF_LAYER } from '../src/render/blockface';
import { installProbeLight } from '../src/render/probes/runtime';
import '../src/world/plain/naqsh'; // kaba_white
import { registerSettlementSurfaces } from '../src/world/settlement/surfaces';

const spec = JSON.parse(readFileSync('tools/blender/blockface.json', 'utf8'));
const hashOf = () => { const h = createHash('sha256'); for (const p of ['tools/blender/blockface.json', 'tools/blender/blockface.py']) { const b = readFileSync(p); h.update(p); h.update('\0'); h.update(String(b.length)); h.update('\0'); h.update(b); } return h.digest('hex'); };

describe('D-321 block-face detail set', () => {
  it('is current: built from the present spec and script (node tools/blender/blockface.mjs)', () => {
    expect(META.inHash).toBe(hashOf());
  });
  it('ships the recorded KTX2: one 2-D array of every layer, 2048 px, mipmapped, under 30 MB', () => {
    const f = 'public/textures/blockface/blockface.ktx2'; expect(existsSync(f)).toBe(true);
    const b = readFileSync(f);
    expect(createHash('sha256').update(b).digest('hex')).toBe(META.outHash);
    expect(b.length).toBeLessThan(30e6);
    const u32 = (o: number) => b.readUInt32LE(o);
    expect(b.subarray(1, 7).toString()).toBe('KTX 20');
    const [w, h, layers, levels] = [u32(20), u32(24), u32(32), u32(40)];
    expect([w, h, layers]).toEqual([spec.res, spec.res, spec.layers.length]);
    expect(levels).toBeGreaterThanOrEqual(10);
  });
  it('the layers are carved stone: tool relief of the measured order, AO in the cavities, strips flat beyond their margin', () => {
    const L = Object.fromEntries(META.layers.map(l => [l.id, l]));
    for (const id of ['claw_a', 'claw_b', 'claw_c']) { // toothed chisel: 0.2-0.6 mm relief (1σ), mean slope 2-7° (D-218's facets ±1.1°, the teeth's ridges)
      expect(L[id].h_sd).toBeGreaterThan(0.2); expect(L[id].h_sd).toBeLessThan(0.6);
      expect(L[id].slope_sd).toBeGreaterThan(0.035); expect(L[id].slope_sd).toBeLessThan(0.12);
    }
    expect(L.flat.slope_sd).toBeLessThan(L.claw_a.slope_sd); // the flat chisel smoother than the claw
    expect(L.point.h_sd).toBeGreaterThan(4 * L.claw_a.h_sd); // the point-dressed foot rougher by far
    expect(L.point.ao_mean).toBeLessThan(0.95);
    for (const l of META.layers) { expect(l.ao_mean).toBeGreaterThan(0.6); expect(l.ao_mean).toBeLessThanOrEqual(1); }
    expect(Object.keys(BF_LAYER)).toEqual(spec.layers.map((l: any) => l.id));
  });
  it('every dressed-stone surface of the world takes the set (the class, world-wide)', () => {
    registerSettlementSurfaces();
    // dressed stone = the limestone of the Terrace and its palaces (walls, stairs, parapets, merlons, the retaining walls and
    // their foot), the Ka'ba-ye Zardosht, Takht-e Rustam, the town's kerbs and well heads, the masons' rough blocks, the rock-cut
    // tomb façades' dressed fields at Naqsh-e Rustam (the same tools on the living rock): every surface of it drawn with a
    // joint pattern or named as dressed stone. Not the class: carved members (reliefs, columns: their own finish), the polished
    // dark frames, rock faces, rubble, brick and plaster
    const dressed = ['limestone', 'limestone_merlon', 'terrace', 'terrace_foot', 'terrace_now', 'kaba_white', 'takht_stone', 'stone_plain', 'stone_rough', 'nr_dressed'];
    for (const k of dressed) expect(SURFACES[k]?.blockFace, k).toBeTruthy();
    expect(SURFACES.terrace_foot.blockFace).toBe('rough');
    // no stone surface with a joint pattern left without it (the bricks, glazed or not, are not stone)
    const jointed = Object.entries(SURFACES).filter(([k, d]) => d.joints && !/brick|glazed/.test(k)).map(([k]) => k);
    expect(jointed.filter(k => !SURFACES[k].blockFace)).toEqual([]);
  });
  it('with every scan and the set loaded no surface declares more than 6 samplers in node (16 on the page, B122)', () => {
    setScanTexturesForTest(); setBlockFaceTextureForTest();
    try {
      const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
      const r: any = new (THREE as any).WebGPURenderer({ canvas }); installProbeLight(r); r.hasFeature = () => true;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(), sun);
      const g = new THREE.BoxGeometry(); for (const [a, n] of [['y0', 1], ['ytop', 1], ['stair', 4], ['pbox', 4]] as const) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * n), n));
      const count = (m: any) => { const b = new (THREE as any).WGSLNodeBuilder(new THREE.Mesh(g, m), r); b.scene = scene; b.camera = cam; b.material = m; b.lightsNode = r.lighting.getNode(scene, cam); b.build(); return { n: ((b.fragmentShader as string).match(/: sampler[;\s]|sampler_comparison/g) ?? []).length, grad: /textureSampleGrad/.test(b.fragmentShader) }; };
      const rows: string[] = [], over: string[] = [], without: string[] = [];
      for (const k of Object.keys(SURFACES).filter(k => SURFACES[k].blockFace)) for (const arch of [false, true]) {
        const c = count(surfaceMaterial(k, { arch, variant: 'bftest' })); rows.push(`${k}${arch ? '+arch' : ''} ${c.n}`);
        if (c.n > 6) over.push(`${k}${arch ? '+arch' : ''}: ${c.n}`);
        if (!c.grad) without.push(k); // the set is sampled (the faces and strips read it with explicit gradients)
      }
      expect(over, rows.join(', ')).toEqual([]);
      expect(without).toEqual([]);
    } finally { setScanTexturesForTest(false); setBlockFaceTextureForTest(false); }
  }, 600_000);
});
