// The people's Blender-built assets (D-307): hair cards with their strand atlas (KTX2), garment drape from Blender's cloth
// solver. Built by `node tools/blender/build.mjs people_hair people_cloth` (tools/blender/people.json, lib/people.mjs);
// Blender is not needed here: this test reads what the build wrote and holds it to the registry, the budgets and the fit.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, BUILT, COSTUMES, COSTUME_OF, DRESSES, type OutfitBuild } from '../src/people/outfits';
import { readPeopleModels, placeCards, headHeight, drapeFrames, applyDrape, DRAPE_UNIT, type PeopleModels } from '../src/people/peopleModels';
import { HB, PART, PRM_CARD, MAT } from '../src/people/humanFormat';
import { bellyFrame, bellyOffset, BELLY } from '../src/people/drape';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
// @ts-ignore plain node module shared with the build
import { readPeopleRegistry, readPeopleManifest, peopleInputHash, PEOPLE_DIR } from '../tools/blender/lib/people.mjs';

const REG = readPeopleRegistry(), MAN = readPeopleManifest();
const ids = Object.keys(REG.assets);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
let A: HumanAssets, M: PeopleModels, O: OutfitBuild, O0: OutfitBuild;
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  M = readPeopleModels(f => { try { return readFileSync('public/' + f); } catch { return null; } });
  await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), models: M });
  O0 = buildOutfits(A, { lods: [0], dresses: ['persian', 'woman', 'worker'] });
}, 180_000);

describe('the people\'s Blender assets are built, current, reproduced, within budget and ledgered (D-307)', () => {
  it('every registered asset is built and listed', () => {
    expect(ids.sort()).toEqual(['people_cloth', 'people_hair']);
    expect(Object.keys(MAN.assets).sort()).toEqual([...ids].sort());
  });
  for (const id of ids) describe(id, () => {
    const E = REG.assets[id], m = MAN.assets[id];
    it('its files are the ones the build recorded (sha256)', () => {
      expect(Object.keys(m.files).sort()).toEqual([...E.outputs].sort());
      for (const f of E.outputs) expect(sha(readFileSync(`${PEOPLE_DIR}/${f}`)), f).toBe(m.files[f].sha256);
    });
    it('current: its inputs hash as when it was built (else node tools/blender/build.mjs ' + id + ')', () => expect(peopleInputHash(id, E)).toBe(m.inHash));
    it('reproducible: a second build gave the same bytes (build.mjs --verify)', () => {
      expect(m.reproduced, 'run node tools/blender/build.mjs --verify ' + id).toBeTruthy();
      for (const f of E.outputs) expect(m.reproduced.files[f], f).toBe(m.files[f].sha256);
    });
    it('within budget: download, GPU, triangles per card set', () => {
      expect(m.bytes).toBeLessThanOrEqual(E.budget.bytes);
      if (E.budget.gpu_bytes) expect(m.gpuBytes).toBeLessThanOrEqual(E.budget.gpu_bytes);
      for (const [k, lim] of Object.entries(E.budget.tris ?? {})) expect(m.stats[k].tris, k).toBeLessThanOrEqual(lim as number);
    });
    it('the ledger lists it', () => expect(readFileSync('ASSET_LEDGER.md', 'utf8')).toContain(E.ledger));
  });
});

describe('hair cards (people_hair)', () => {
  it('the atlas is KTX2, UASTC with zstd supercompression and a full mip chain, 2048 px', () => {
    const b = readFileSync(`${PEOPLE_DIR}/people_hair_atlas.ktx2`);
    expect(b.subarray(0, 12).toString('latin1')).toBe('\xABKTX 20\xBB\r\n\x1A\n');
    const w = b.readUInt32LE(20), h = b.readUInt32LE(24), levels = b.readUInt32LE(40), scheme = b.readUInt32LE(44);
    expect([w, h]).toEqual([2048, 2048]); expect(levels).toBe(12); expect(scheme).toBe(2); // 2 = zstd
  });
  it('every card vertex is anchored on the body (valid triangles and barycentrics) and placed finite on every variant', () => {
    const C = M.cards!; expect(C).toBeTruthy();
    for (const [id, S] of Object.entries(C.sets)) {
      for (let i = 0; i < S.anchor.length; i++) expect(S.anchor[i]).toBeLessThan(A.NO);
      for (let v = 0; v < S.meta.n; v++) { const u = S.bary[v * 2], w = S.bary[v * 2 + 1]; expect(u).toBeGreaterThanOrEqual(-1e-4); expect(w).toBeGreaterThanOrEqual(-1e-4); expect(u + w).toBeLessThanOrEqual(1 + 1e-4); }
      for (const v of A.variants) { const P = placeCards(S, v.pos, 1); for (const x of P) expect(Number.isFinite(x), id).toBe(true); }
    }
  });
  it('cards stay outside the head (their offsets point out of the anchor\'s surface) and away from the eyes and mouth', () => {
    const C = M.cards!;
    for (const vid of ['m03', 'm13', 'f02', 'c01']) {
      const v = A.byId[vid]; let top = 0, chin = 0; for (let i = 0; i < A.NO; i++) { if (A.orig[i] === A.meta.landmarks.head_top) top = i; if (A.orig[i] === A.meta.landmarks.chin) chin = i; }
      const s = headHeight(v.pos, top, chin) / C.meta.headH, eyeY = v.eyeY, hz = v.joints[HB.head * 3 + 2];
      for (const [id, S] of Object.entries(C.sets)) {
        const P = placeCards(S, v.pos, s); let inside = 0, eyes = 0;
        for (let k = 0; k < S.meta.n; k++) {
          const a = S.anchor[k * 3], b = S.anchor[k * 3 + 1], c = S.anchor[k * 3 + 2], u = S.bary[k * 2], w = S.bary[k * 2 + 1], x = 1 - u - w;
          const n = [0, 1, 2].map(e => v.nrm[a * 3 + e] * u + v.nrm[b * 3 + e] * w + v.nrm[c * 3 + e] * x), q = [0, 1, 2].map(e => v.pos[a * 3 + e] * u + v.pos[b * 3 + e] * w + v.pos[c * 3 + e] * x);
          const dq = Math.hypot(P[k * 3] - q[0], P[k * 3 + 1] - q[1], P[k * 3 + 2] - q[2]); // (a card hanging free below where it left the head may pass under that point's tangent plane: only the part lying on the head is tested)
          if (dq < 0.02 && (P[k * 3] - q[0]) * n[0] + (P[k * 3 + 1] - q[1]) * n[1] + (P[k * 3 + 2] - q[2]) * n[2] < -0.001) inside++;
          // in front of the eyes: within 2.5 cm of eye height, 5 cm of the midline, forward of the brow
          if (id !== 'brows' && id !== 'hair_bob' && Math.abs(P[k * 3 + 1] - eyeY) < 0.018 && Math.abs(P[k * 3]) < 0.05 && P[k * 3 + 2] > hz + 0.06) eyes++;
        }
        expect(inside / S.meta.n, `${vid} ${id} inside`).toBeLessThan(0.03);
        expect(eyes, `${vid} ${id} over the eyes`).toBe(0);
      }
    }
  });
  it('the costumes with their cards keep the triangle budgets [42000, 7000, 3200, 800]; cards only at full detail', () => {
    const budget = [42000, 7000, 3200, 800];
    for (const d of BUILT) for (const C of O.costumes[d]) {
      expect(C.triangles, `${d} LOD${C.lod}`).toBeLessThanOrEqual(budget[C.lod]);
      let cards = 0; for (let k = 0; k < C.tid.length; k++) if (C.hmat[k * 4] === MAT.hair && C.hmat[k * 4 + 3] === PRM_CARD) cards++;
      if (C.lod === 0) expect(cards, `${d} cards`).toBeGreaterThan(0); else expect(cards, `${d} LOD${C.lod}`).toBe(0);
    }
    for (const d of DRESSES) expect(COSTUMES[COSTUME_OF[d]].always).toContain('brows');
  });
});

describe('garment drape (people_cloth)', () => {
  it('every drape set matches its piece\'s vertices and is visible but sane (rms 2-80 mm; nothing flies off)', () => {
    const D = M.drape!; expect(D).toBeTruthy();
    for (const [k, S] of Object.entries(D.sets)) {
      const [key] = k.split('|'); expect(O.geos![key]?.n, k).toBe(S.meta.n);
      expect(S.meta.max, k).toBeLessThan(key.startsWith('veil') ? 0.25 : 0.2); // (D-322: the veil, cut as an open sheet flaring off the back, falls in to the back by up to 21 cm when simulated)
      if (/skirt|sleeves|veil/.test(key)) expect(S.meta.rms, k).toBeGreaterThan(0.005);
    }
  });
  it('the drape is in the costumes: a skirt differs from its procedural placement by the settled displacement', () => {
    const v = A.byId.f02, key = 'dress_skirt@0', g = O.geos![key];
    const a = v.index * O.NV * 4 + O.pieceBase[key] * 4, b = v.index * O0.NV * 4 + O0.pieceBase[key] * 4;
    let ss = 0; for (let i = 0; i < g.n; i++) for (let e = 0; e < 3; e++) ss += (O.source[a + i * 4 + e] - O0.source[b + i * 4 + e]) ** 2;
    expect(Math.sqrt(ss / g.n)).toBeGreaterThan(0.01);
  });
  it('D-313: the belt is a tied sash: knot and hanging ends at every LOD, their Blender drape for men and women, the ends 20+ cm below the waist', () => {
    const D = M.drape!;
    for (const lod of [0, 1, 2]) for (const grp of ['men', 'women']) { const k = `belt@${lod}|${grp}`, S = D.sets[k]; expect(S, k).toBeTruthy(); expect(S.meta.rms, k).toBeGreaterThan(0.001); expect(S.meta.max, k).toBeLessThan(0.06); }
    for (const vid of ['m03', 'f02']) { const v = A.byId[vid], g = O.geos!['belt@0'], a = v.index * O.NV * 4 + O.pieceBase['belt@0'] * 4, waist = v.joints[HB.spine_01 * 3 + 1];
      let lo = 9; for (let i = 0; i < g.n; i++) { const y = O.source[a + i * 4 + 1]; expect(Number.isFinite(y)).toBe(true); lo = Math.min(lo, y); }
      expect(waist - lo, vid).toBeGreaterThan(0.2); expect(waist - lo, vid).toBeLessThan(0.35); }
  });
  it('drape frames are orthonormal and applying a zero drape changes nothing', () => {
    const g = O0.geos!['robe_skirt@0'], v = A.byId.m03, b = v.index * O0.NV * 4 + O0.pieceBase['robe_skirt@0'] * 4;
    const pos = new Float32Array(g.n * 3); for (let i = 0; i < g.n; i++) for (let e = 0; e < 3; e++) pos[i * 3 + e] = O0.source[b + i * 4 + e];
    const F = drapeFrames(pos, g.index, g.n);
    for (let i = 0; i < g.n; i += 7) for (let r = 0; r < 3; r++) { const x = F.subarray(i * 9 + r * 3, i * 9 + r * 3 + 3); expect(Math.hypot(x[0], x[1], x[2])).toBeCloseTo(1, 4); }
    const q = pos.slice(); applyDrape(q, g.index, new Int16Array(g.n * 3)); expect(Array.from(q)).toEqual(Array.from(pos)); void DRAPE_UNIT;
  });
  it('the skirts stay outside the legs and their waists stay under the belt (within 3 cm of the fitted waist)', () => {
    for (const [vid, key] of [['m03', 'tunic_skirt@0'], ['m08', 'work_skirt@0'], ['f02', 'dress_skirt@0'], ['f05', 'dress_skirt@0'], ['c02', 'child_skirt@0']] as const) {
      const v = A.byId[vid], g = O.geos![key], a = v.index * O.NV * 4 + O.pieceBase[key] * 4, b = v.index * O0.NV * 4 + O0.pieceBase[key] * 4;
      if (!O0.geos![key]) continue;
      for (let i = 0; i < g.n; i++) { if (g.uv[i * 2 + 1] > 0.04) continue; const d = Math.hypot(O.source[a + i * 4] - O0.source[b + i * 4], O.source[a + i * 4 + 1] - O0.source[b + i * 4 + 1], O.source[a + i * 4 + 2] - O0.source[b + i * 4 + 2]); expect(d, `${vid} ${key} waist`).toBeLessThan(0.03); }
      // no skirt vertex inside a thigh (the thigh's own vertices' radius about its bone at that height)
      const th = ['thigh_l', 'thigh_r'] as const; let inside = 0, n = 0;
      for (let i = 0; i < g.n; i++) { if (g.ao[i] === 150) continue; const p = [O.source[a + i * 4], O.source[a + i * 4 + 1], O.source[a + i * 4 + 2]]; n++;
        for (const t of th) { const j = v.joints[HB[t] * 3], jy = v.joints[HB[t] * 3 + 1], jz = v.joints[HB[t] * 3 + 2], cy = v.joints[HB[t === 'thigh_l' ? 'calf_l' : 'calf_r'] * 3 + 1];
          if (p[1] > jy - 0.05 || p[1] < cy + 0.05) continue; if (Math.hypot(p[0] - j, p[2] - jz) < 0.045) inside++; } }
      expect(inside / Math.max(1, n), `${vid} ${key} in a thigh`).toBeLessThan(0.01);
    }
    void PART;
  });
});

describe('garments re-cut from simulated patterns (D-322)', () => {
  const SIM = ['robe_upper', 'robe_skirt', 'robe_sleeves', 'tunic_upper', 'tunic_skirt', 'trousers', 'work_upper', 'work_skirt', 'work_trousers', 'dress_upper', 'dress_skirt', 'child_upper', 'child_skirt', 'kandys', 'headcloth', 'veil', 'belt'];
  it('every garment piece of every built costume has its settled drape at every level of detail, for every group that wears it', () => {
    const D = M.drape!; expect(D.meta.version).toBe(2);
    const P = REG.assets.people_cloth.source.args.pieces;
    for (const id of SIM) { expect(P[id], id).toBeTruthy(); for (const lod of [0, 1, 2]) for (const grp of P[id].groups) {
      const key = O.geos![`${id}@${lod}`] ? `${id}@${lod}` : `${id}@1`; expect(D.sets[`${key}|${grp}`], `${key}|${grp}`).toBeTruthy(); } }
    // and every piece that is cloth in a built costume is one of them (nothing left procedural)
    for (const d of BUILT) for (const id of [...COSTUMES[d].always, ...COSTUMES[d].opt]) if (/upper|skirt|sleeves|trousers|kandys|headcloth|veil|belt/.test(id)) expect(SIM, `${d} ${id}`).toContain(id);
  });
  it('the fold layers: a 1024 x 2048 PNG, and a fold atlas coordinate on every simulated piece\'s outer vertices at every level', () => {
    const D = M.drape!, F = D.meta.folds!; expect(F.file).toBe('people_cloth_folds.png'); expect(F.layers).toBe(2); expect(F.texelsPerMetre).toBeGreaterThan(80);
    const b = readFileSync(`${PEOPLE_DIR}/${F.file}`); expect(b.readUInt32BE(16)).toBe(1024); expect(b.readUInt32BE(20)).toBe(2048);
    for (const [k, f] of Object.entries(D.fuv)) { const g = O.geos![k]; expect(g?.n, k).toBe(f.length / 2); let inAtlas = 0; for (let i = 0; i < g.n; i++) if (f[i * 2] >= 0) { expect(f[i * 2]).toBeLessThanOrEqual(1); inAtlas++; } expect(inAtlas / g.n, k).toBeGreaterThan(0.4); }
    // in the costumes: below full detail the coordinate is offset by 2 (the second layer)
    for (const C of O.costumes.woman) { let n = 0; for (let k = 0; k < C.fuv.length / 2; k++) if (C.fuv[k * 2] >= 0) { n++; expect(C.fuv[k * 2] >= 2).toBe(C.lod >= 1); } expect(n, `woman LOD${C.lod}`).toBeGreaterThan(100); }
  });
  it('the headcloth lies over the dress (D-313\'s see-through: it had settled inside it), the sash over the skirt', () => {
    for (const [vid, outerK, underK] of [['f02', 'headcloth@0', 'dress_upper@0'], ['f05', 'headcloth@0', 'dress_upper@0'], ['f02', 'belt@0', 'dress_skirt@0']] as const) {
      const v = A.byId[vid], go = O.geos![outerK], gu = O.geos![underK], ao = v.index * O.NV * 4 + O.pieceBase[outerK] * 4, au = v.index * O.NV * 4 + O.pieceBase[underK] * 4;
      const U = new Float32Array(gu.n * 3); for (let i = 0; i < gu.n; i++) for (let e = 0; e < 3; e++) U[i * 3 + e] = O.source[au + i * 4 + e];
      const N = drapeFrames(U, gu.index, gu.n); let inside = 0, n = 0;
      for (let i = 0; i < go.n; i++) { if (go.ao[i] === 150) continue; const p = [0, 1, 2].map(e => O.source[ao + i * 4 + e]); let best = -1, bd = 0.03 ** 2;
        for (let j = 0; j < gu.n; j++) { const d = (U[j * 3] - p[0]) ** 2 + (U[j * 3 + 1] - p[1]) ** 2 + (U[j * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = j; } }
        if (best < 0) continue; n++; const s = [0, 1, 2].reduce((x, e) => x + (p[e] - U[best * 3 + e]) * N[best * 9 + e], 0); if (s < -0.002) inside++; }
      expect(n, `${vid} ${outerK}`).toBeGreaterThan(20); expect(inside / n, `${vid} ${outerK} inside ${underK}`).toBeLessThan(0.05);
    }
  });
  it('the skirts fold: at full detail the lower skirt deviates round the body from its own smooth outline by more than the procedural tube did', () => {
    const fold = (OO: OutfitBuild, vid: string, key: string) => { const v = A.byId[vid], g = OO.geos![key], a = v.index * OO.NV * 4 + OO.pieceBase[key] * 4, zc = v.joints[HB.pelvis * 3 + 2];
      const B = 72, sum = new Float64Array(B), cnt = new Float64Array(B);
      for (let i = 0; i < g.n; i++) { if (g.ao[i] === 150 || g.uv[i * 2 + 1] < 0.55 || g.uv[i * 2 + 1] > 0.85) continue; const x = OO.source[a + i * 4], z = OO.source[a + i * 4 + 2] - zc, k = Math.floor(((Math.atan2(x, z) / (2 * Math.PI)) + 1) % 1 * B); sum[k] += Math.hypot(x, z); cnt[k]++; }
      const r = Array.from(sum, (x, k) => (cnt[k] ? x / cnt[k] : NaN)); let ss = 0, n = 0;
      for (let k = 0; k < B; k++) { if (Number.isNaN(r[k])) continue; let m = 0, c = 0; for (let d = -6; d <= 6; d++) { const q = r[(k + d + B) % B]; if (!Number.isNaN(q)) { m += q; c++; } } ss += (r[k] - m / c) ** 2; n++; }
      return Math.sqrt(ss / n); };
    for (const [vid, key] of [['f02', 'dress_skirt@0'], ['m03', 'robe_skirt@0']] as const) {
      const sim = fold(O, vid, key), proc = fold(O0, vid, key); expect(sim, `${vid} ${key}: ${(sim * 1000).toFixed(1)} mm vs procedural ${(proc * 1000).toFixed(1)}`).toBeGreaterThan(Math.max(0.003, proc));
    }
  });
});

describe('the belly through the drape (D-292, D-307)', () => {
  it('at term the dress falls from the bump: its front below the dome moves forward (fading to the hem), the body under it does not, and the dress stays ahead of the body', () => {
    const v = A.byId.f02, F = bellyFrame(A, v), key = 'dress_skirt@0', g = O.geos![key], a0 = v.index * O.NV * 4 + O.pieceBase[key] * 4;
    const c = F.yc + BELLY.rise[0] + BELLY.rise[1];
    let near = 0, nNear = 0;
    for (let i = 0; i < g.n; i++) { const x = O.source[a0 + i * 4], y = O.source[a0 + i * 4 + 1], z = O.source[a0 + i * 4 + 2]; if (Math.abs(x) > 0.03 || z < F.z0 - 0.02) continue;
      const o = bellyOffset(x, y, z, 1, F, true); if (y < c - 0.08 && y > c - 0.2) { near += o.dz; nNear++; }
      expect(o.dz).toBeGreaterThanOrEqual(bellyOffset(x, y, z, 1, F, false).dz); }
    expect(nNear).toBeGreaterThan(0); expect(near / nNear, 'the front 8-20 cm below the centre of the dome').toBeGreaterThan(0.05);
    // the body is never moved by the fall (it is cloth only)
    for (let i = 0; i < A.NO; i += 3) { const x = v.pos[i * 3], y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2]; if (y > c) continue; expect(bellyOffset(x, y, z, 1, F).dz).toBe(bellyOffset(x, y, z, 1, F, false).dz); }
  });
});
