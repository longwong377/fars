// The far people's impostor atlas rendered in Blender/Cycles (D-331; tools/blender/impostors.mjs): built, current, laid out
// for this build's frames and dresses, within budget, ledgered, and drawing the same people as the CPU bake it replaces
// (per cell coverage against the CPU bake's: a layout shifted by one row or view, or views turned the wrong way, would
// break the correlation). Blender is not needed here: the test reads what the build wrote.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeHumanAssets, meshoptSimplify } from '../src/people/humanAssets';
import { buildOutfits } from '../src/people/outfits';
import { readPeopleModels } from '../src/people/peopleModels';
import { bakeImpostors, IMP, IMP_DRESSES, FRAMES, ROWS, RPC, type ImpostorAtlas } from '../src/people/impostors';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
// @ts-ignore plain node module shared with the build
import { impInputHash } from '../tools/blender/lib/imp_inputs.mjs';

const DIR = 'public/models/impostors', J = JSON.parse(readFileSync(`${DIR}/people_impostors.json`, 'utf8')), MAN = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')).assets.people_impostors;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
/** the download and GPU budgets (D-331): the CPU bake's GPU memory (three RGBA8 textures with mips) is the ceiling */
const CPU_GPU = Math.round(3 * (IMP.cols * IMP.views * IMP.cell) * (RPC * IMP.cell) * 4 * 4 / 3), BYTES = 12e6;
let cpu: ImpostorAtlas;
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  const M = readPeopleModels(f => { try { return readFileSync('public/' + f); } catch { return null; } });
  await MeshoptSimplifier.ready; cpu = bakeImpostors(A, buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), models: M }));
}, 300_000);

describe('the Cycles people impostors (D-331)', () => {
  it('its files are the ones the build recorded (sha256)', () => {
    for (const [f, e] of Object.entries<any>(MAN.files)) expect(sha(readFileSync(`${DIR}/${f}`)), f).toBe(e.sha256);
    for (const k of ['A', 'B', 'N']) expect(MAN.files[J.files[k].file], k).toBeTruthy();
  });
  it('current: its inputs hash as when it was built (else node tools/blender/impostors.mjs)', () => expect(impInputHash(MAN.settings)).toBe(MAN.inHash));
  it('laid out for this build: the frames, dresses, views and cell box of impostors.ts', () => {
    expect(J.frames).toEqual(FRAMES.map(f => f.id)); expect(J.dresses).toEqual(IMP_DRESSES);
    expect([J.views, J.width, J.height, J.y0]).toEqual([IMP.views, IMP.width, IMP.height, IMP.y0]);
    expect(J.rows).toBe(ROWS); expect(J.rpc).toBe(Math.ceil(ROWS / J.cols));
    expect(J.W).toBe(J.cols * J.views * J.cell); expect(J.H).toBe(J.rpc * J.cell); expect(Math.max(J.W, J.H)).toBeLessThanOrEqual(4096);
    expect(J.levels).toBe(Math.log2(J.cell) + 1);
    expect(J.cell).toBeGreaterThanOrEqual(2 * IMP.cell); // (the point: twice the CPU bake's texels a metre)
  });
  it('KTX2 textures of the recorded size and mip count, UASTC with zstd', () => {
    for (const k of ['A', 'B', 'N']) { const b = readFileSync(`${DIR}/${J.files[k].file}`);
      expect(b.subarray(0, 12).toString('latin1'), k).toBe('«KTX 20»\r\n\x1a\n');
      expect([b.readUInt32LE(20), b.readUInt32LE(24), b.readUInt32LE(40), b.readUInt32LE(44)], k).toEqual([J.W, J.H, J.levels, 2]); } // width, height, levels, zstd
  });
  it('within budget: download and GPU memory (no more than the CPU bake it replaces)', () => {
    expect(MAN.bytes).toBeLessThanOrEqual(BYTES); expect(J.gpuBytes).toBeLessThanOrEqual(CPU_GPU);
  });
  it('the same people as the CPU bake: every cell drawn, coverage per cell correlated with the far bodies\'', () => {
    const c = J.coverage as number[], p = Array.from(cpu.coverage); expect(c.length).toBe(p.length);
    // (the full-detail people cover a little more than the far bodies: hair, cards, the garments' folds)
    for (let i = 0; i < c.length; i++) if (p[i] > 0.02) expect(c[i], `row ${Math.floor(i / IMP.views)} view ${i % IMP.views}`).toBeGreaterThan(p[i] * 0.6);
    const m = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length, mc = m(c), mp = m(p);
    let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < c.length; i++) { sxy += (c[i] - mc) * (p[i] - mp); sxx += (c[i] - mc) ** 2; syy += (p[i] - mp) ** 2; }
    expect(sxy / Math.sqrt(sxx * syy)).toBeGreaterThan(0.9);
    expect(mc / mp).toBeGreaterThan(0.9); expect(mc / mp).toBeLessThan(1.6);
  });
  it('the ledger lists it', () => expect(readFileSync('ASSET_LEDGER.md', 'utf8')).toContain('public/models/impostors/'));
});
