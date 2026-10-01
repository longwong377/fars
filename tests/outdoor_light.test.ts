// D-357: the outdoor light field (src/render/probes/outdoor*.ts): the encoding, a synthetic lane baked in-process, and the
// shipped bake (public/lightmaps/outdoor.*) against the world it was baked from.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { encL1, decL1, OutMeta, OutRegion, OUT_TEXELS, sampleOutdoor, outIrradiance, afternoonWeight, OUT_TEX_W, fromRegion, groundAt } from '../src/render/probes/outdoor';
import { outProbe, encodeRegion, halfDaySuns, OUT_W, OUT_RAYS, RegionScene } from '../src/render/probes/outdoor_bake';
import { sceneFromParts, srgbToLinear } from '../src/render/probes/trace';
import { BAKE, sphereDirs } from '../src/render/probes/bake';
import type { Part } from '../src/arch/parts';

describe('outdoor light field: encoding', () => {
  it('round-trips L1 within 8-bit precision', () => {
    const b = new Uint8Array(4);
    for (const [a, bx, by, bz] of [[0.5, 0, 0.5, 0], [0.04, 0.01, 0.02, -0.03], [1.2, -0.4, 1.1, 0.2]]) {
      encL1(a, bx, by, bz, 1.5, b, 0); const d = decL1(b[0] / 255, b[1] / 255, b[2] / 255, b[3] / 255, 1.5);
      expect(Math.abs(d[0] - a) / a).toBeLessThan(0.03);
      for (let k = 1; k < 4; k++) expect(Math.abs(d[k] - [a, bx, by, bz][k])).toBeLessThan(0.02 * Math.max(a, 0.05) + 0.01);
    }
  });
  it('the sun channel follows the sun across the day', () => {
    expect(afternoonWeight(1, 0)).toBeLessThan(0.1); expect(afternoonWeight(-1, 0)).toBeGreaterThan(0.9);
    expect(Math.abs(afternoonWeight(0, 1) - 0.5)).toBeLessThan(0.01);
  });
});

/** a 12 × 8 m patch of one cell metre: a lane 2 m wide between two 3.5 m walls, a closed roofed room beyond the north wall,
 *  open ground south; baked in-process with the bake's own estimator */
function syntheticLane(): { meta: OutMeta; tex: Uint8Array; R: OutRegion } {
  const B = { building: 't', tier: 'C' as const, src: 'RECON' }, parts: Part[] = [];
  const box = (e: number, n: number, sx: number, sz: number, y0: number, y1: number, material: string) => parts.push({ ...B, type: 'box', kind: 'wall', material: material as any, c: [e, n], size: [sx, sz], y0, y1 } as any);
  box(6, 3, 12, 0.5, -0.4, 3.5, 'house_plaster');      // south wall of the lane, along v = 3
  box(6, 5, 12, 0.5, -0.4, 3.5, 'house_plaster');      // north wall of the lane, along v = 5 (the room's south wall)
  box(6, 8, 12, 0.5, -0.4, 3.5, 'house_plaster');      // the room's north wall
  box(0, 6.5, 0.5, 3, -0.4, 3.5, 'house_plaster'); box(12, 6.5, 0.5, 3, -0.4, 3.5, 'house_plaster');
  box(6, 6.5, 12.5, 3.5, 3.0, 3.35, 'house_roof');      // its roof
  for (let e = -20; e < 32; e += 4) for (let n = -20; n < 28; n += 4) box(e + 2, n + 2, 4, 4, -1, 0, 'road');
  const albedo = (m: string) => { const a: Record<string, [number, number, number]> = { house_plaster: [0.56, 0.47, 0.36], house_roof: [0.6, 0.53, 0.41], road: [0.66, 0.56, 0.45] }; return (a[m] ?? [0.5, 0.5, 0.5]).map(srgbToLinear) as [number, number, number]; };
  const scene = sceneFromParts(parts, (m: any) => albedo(m), { protome: [1, 1], plain: 1, volute: [1, 1] });
  const W = 12, H = 10, L = 2;
  const flags = new Uint8Array(W * H), ceil = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W; i++) { flags[2 * W + i] |= 2; flags[4 * W + i] |= 2; flags[7 * W + i] |= 2; } // walls on the +j edges of rows 2, 4, 7
  for (let j = 5; j < 8; j++) for (let i = 0; i < W; i++) ceil[j * W + i] = 3.0;
  const R: OutRegion = { id: 'lane', kind: 'town', c: [0, 0], theta: 0, u0: 0, v0: 0, cell: 1, W, H, L, y0: 0.5, dy: 1.5, gmin: -0.5, grange: 1, lo: [-0.9, -0.4], hi: [3.2, 4.6], edge: 0, probeBase: 0, colBase: W * H * L * OUT_TEXELS, flags: true };
  const rs: RegionScene = { R, scene, ground: new Float32Array(W * H), flags, ceil };
  const suns = halfDaySuns(), ctx = { scene, dirs: sphereDirs(OUT_RAYS.bounce), skyDirs: sphereDirs(OUT_RAYS.sky), sun: suns.am, o: { ...BAKE, skyRays: 1, sunRays: 1 }, plain: [0.2, 0.17, 0.12] as [number, number, number] };
  const a = new Float32Array(W * H * L * OUT_W);
  for (let k = 0; k < L; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const [x, z] = fromRegion(R, i + 0.5, j + 0.5); outProbe(ctx, suns.pm, ctx.plain, x, 0.5 + k * 1.5, z, (j * W + i) * 7 + k, a, ((k * H + j) * W + i) * OUT_W);
  }
  const tex = new Uint8Array(Math.ceil((R.colBase + W * H) / OUT_TEX_W) * OUT_TEX_W * 4);
  encodeRegion(rs, a, tex);
  return { meta: { tier: 'C', note: '', built: '', width: OUT_TEX_W, height: tex.length / 4 / OUT_TEX_W, regions: [R], sunAm: suns.amDir, sunPm: suns.pmDir }, tex, R };
}

describe('outdoor light field: a synthetic lane', () => {
  const { meta, tex } = syntheticLane();
  const at = (e: number, n: number, y: number, nrm: [number, number, number]) => { const s = sampleOutdoor(meta, tex, [e, y, -n], nrm)!; return { s, ...outIrradiance(s, nrm, 0.5) }; };
  it('open ground sees the open sky; the lane floor a canyon\'s share; the closed room none', () => {
    const open = at(6, 0.5, 0.02, [0, 1, 0]), lane = at(6, 4, 0.02, [0, 1, 0]), room = at(6, 6.5, 0.02, [0, 1, 0]);
    expect(open.s.w).toBeGreaterThan(0.9); expect(open.sky).toBeGreaterThan(0.75); expect(open.sky).toBeLessThan(1.3);
    expect(lane.sky).toBeGreaterThan(0.1); expect(lane.sky).toBeLessThan(0.55);
    expect(room.sky).toBeLessThan(0.05);
  });
  it('a wall face takes the light of its own side: the lane face of the room wall is not darkened by the room', () => {
    const laneFace = at(6, 4.74, 1.2, [0, 0, 1]); // the room's south wall seen from the lane: normal toward −n = +z
    expect(laneFace.s.w).toBeGreaterThan(0.5); expect(laneFace.sky).toBeGreaterThan(0.08);
  });
  it('the lane\'s shaded side gets the bounce of the sunlit ground and walls', () => {
    const f = at(6, 3.26, 1.2, [0, 0, -1]); expect(f.sun).toBeGreaterThan(0.01);
  });
  it('a roof top above a closed room is left to the open sky (its column\'s probes are under the roof)', () => {
    expect(at(6, 6.5, 3.4, [0, 1, 0]).s.w).toBeLessThan(0.01);
  });
});

const META = 'public/lightmaps/outdoor.json', BIN = 'public/lightmaps/outdoor.bin';
describe.skipIf(!existsSync(META))('outdoor light field: the shipped bake', () => {
  let meta: OutMeta, tex: Uint8Array;
  beforeAll(() => { meta = JSON.parse(readFileSync(META, 'utf8')); tex = new Uint8Array(readFileSync(BIN)); });
  it('matches its size and covers the Terrace and the town\'s roofed sites', () => {
    expect(tex.length).toBe(meta.width * meta.height * 4);
    const ids = new Set(meta.regions.map(r => r.id));
    for (const id of ['terrace', 'q_s1', 'q_s2', 'q_s3', 'q_s4', 'q_w1', 'q_w2', 'q_w3', 'q_n1', 'official', 'stores']) expect(ids.has(id), id).toBe(true);
  });
  it('the lane of lane-with-child is a lane: some sky, far from all of it', () => {
    const p: [number, number, number] = [-333.2, 0, 901.5], R = meta.regions.find(r => r.id === 'q_s1')!;
    const [u, v] = [(-333.2 - R.c[0]) * Math.cos(R.theta) + (-901.5 - R.c[1]) * Math.sin(R.theta), -(-333.2 - R.c[0]) * Math.sin(R.theta) + (-901.5 - R.c[1]) * Math.cos(R.theta)];
    p[1] = groundAt(R, tex, Math.floor(u - R.u0), Math.floor(v - R.v0)) + 0.02;
    const s = sampleOutdoor(meta, tex, p, [0, 1, 0])!; expect(s && s.w).toBeGreaterThan(0.5);
    const e = outIrradiance(s, [0, 1, 0], 0.3); expect(e.sky).toBeGreaterThan(0.05); expect(e.sky).toBeLessThan(0.8);
  });
});
