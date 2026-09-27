// The Blender asset pipeline (D-305): every generated asset stays within its budget, is current with its inputs, was
// reproduced byte for byte by a second build, and fits the game where its procedural stand-in stood.
// (Blender is not needed here: tools/blender/build.mjs builds; --verify reproduces; this test reads what they wrote.)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three/webgpu';
// @ts-ignore plain node module shared with the build
import { measureGLB, sha256, parseGLB, MAP_TOL, GEO_TOL } from '../tools/blender/lib/glb.mjs';
// @ts-ignore plain node module shared with the build
import { readRegistry, inputHash } from '../tools/blender/lib/inputs.mjs';
import { order } from '../src/arch/orders';
import { protomeBox, protomeMesh, columnMesh, piece, voluteBox, voluteMesh, colossusMesh, toGeometry, pieceModel, sculptParams } from '../src/arch/sculpt';
import { buildTerrace } from '../src/arch/terrace';
import { colossusPlacement } from '../src/arch/meshes';
import type { Box } from '../src/arch/parts';
import { buildRelief, march } from '../tools/blender/lib/carving';
import { fitLevel, placeLevel, bakedMaterial } from '../src/render/models';

const REG = readRegistry(), MAN = JSON.parse(readFileSync('public/models/manifest.json', 'utf8'));
const ids = Object.keys(REG.assets);

describe('Blender-built assets (D-305)', () => {
  it('every registered asset is built and listed; nothing unregistered ships', () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(Object.keys(MAN.assets).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(existsSync(`public/${MAN.assets[id].file}`), id).toBe(true);
  });
  for (const id of ids) describe(id, () => {
    const E = REG.assets[id], M = MAN.assets[id], buf = readFileSync(`public/${M.file}`), G = measureGLB(buf);
    it('the file is the one the build recorded (sha256)', () => expect(sha256(buf)).toBe(M.outHash));
    it('current: its inputs (data, model code, bake settings) hash as when it was built (else: node tools/blender/build.mjs ' + id + ')', () =>
      expect(inputHash(id, E)).toBe(M.inHash));
    it('reproducible: a second build from the same inputs gave the same bytes, or (D-306) the same decoded geometry and maps within tolerance (build.mjs --verify)', () => {
      expect(M.reproduced, 'not yet reproduced: run node tools/blender/build.mjs --verify ' + id).toBeTruthy();
      expect(M.reproduced.outHash).toBe(M.outHash);
      if (M.reproduced.mode === 'content') {
        expect(M.reproduced.geometry).toBe(true);
        for (const g of M.reproduced.geo) { expect(g.frac).toBeLessThanOrEqual(GEO_TOL.frac); expect(g.max).toBeLessThanOrEqual(GEO_TOL.max); }
        for (const m of M.reproduced.maps) { expect(m.frac).toBeLessThanOrEqual(MAP_TOL.frac); expect(m.max).toBeLessThanOrEqual(MAP_TOL.max); }
      }
    });
    it('within budget: triangles per level, map sizes, download, GPU memory', () => {
      E.lods.forEach((_: unknown, i: number) => {
        const m = G.meshes[`lod${i}`]; expect(m, `lod${i}`).toBeTruthy();
        expect(m.tris).toBeLessThanOrEqual(E.budget.tris[i]);
      });
      G.images.forEach((im: any, i: number) => { expect(im.w).toBeLessThanOrEqual(E.budget.tex[i]); expect(im.h).toBeLessThanOrEqual(E.budget.tex[i]); });
      expect(G.bytes).toBeLessThanOrEqual(E.budget.glb_bytes);
      expect(G.gpuBytes).toBeLessThanOrEqual(E.budget.gpu_bytes);
    });
    it('each level carries UVs, normals, tangents (Draco) and its packed normal + occlusion map', () => {
      const { json } = parseGLB(buf);
      expect(json.extensionsUsed).toContain('KHR_draco_mesh_compression');
      E.lods.forEach((_: unknown, i: number) => {
        const m = G.meshes[`lod${i}`];
        for (const a of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'draco']) expect(m.attrs, `lod${i} ${a}`).toContain(a);
        const mat = G.materials[m.materials[0]]; expect(mat.normalTexture, `lod${i} map`).not.toBeNull();
        expect(G.images[G.textures[mat.normalTexture].source].w).toBe(E.lods[i].tex);
      });
      // the maps are not blank: the occlusion's mean is recorded by the bake and lies strictly between 0 and 1
      for (const L of M.lods) { expect(L.ao_mean).toBeGreaterThan(0.2); expect(L.ao_mean).toBeLessThan(0.99); }
    });
    it('the ledger lists it', () => expect(readFileSync('ASSET_LEDGER.md', 'utf8')).toContain(E.ledger));
  });
  it('the decoders the game serves are three\'s own (public/models/lib = node_modules/three/examples/jsm/libs)', () => {
    for (const f of ['draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js', 'draco/draco_decoder.js', 'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm'])
      expect(sha256(readFileSync(`public/models/lib/${f}`)), f).toBe(sha256(readFileSync(`node_modules/three/examples/jsm/libs/${f}`)));
  });
});

describe('the capital protome in the game (D-305)', () => {
  const MAN0 = MAN.assets.capital_protome;
  it('the levels stand as the game\'s pieces do: same axes and extent (accessor bounds within the Draco quantisation)', () => {
    // (the first build passed every other test lying on its side: y and z swapped by the PLY import, D-305)
    const { json } = parseGLB(readFileSync(`public/${MAN0.file}`));
    for (const lod of [0, 1] as const) {
      const mesh = json.meshes.find((m: any) => m.name === `lod${lod}`), a = json.accessors[mesh.primitives[0].attributes.POSITION];
      const bb = new THREE.Box3().setFromArray(piece('protome', lod).pos);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(a.min[k] - bb.min.getComponent(k)), `lod${lod} min[${k}]`).toBeLessThan(2e-3);
        expect(Math.abs(a.max[k] - bb.max.getComponent(k)), `lod${lod} max[${k}]`).toBeLessThan(2e-3);
      }
    }
  });
  it('the baked levels keep the game\'s own triangles (the bake adds maps, not geometry)', () => {
    expect(MAN0.lods[0].tris).toBe(piece('protome', 0).idx.length / 3);
    expect(MAN0.lods[1].tris).toBe(piece('protome', 1).idx.length / 3);
  });
  for (const b of ['apadana', 'hall100', 'harem']) it(`${b}: the column without its protome plus the protome is the whole column`, () => {
    const o = order(b, { capital: 'bull' }), box = protomeBox(o)!;
    for (const lod of [0, 1] as const) {
      const whole = columnMesh(o, 1, lod).idx.length / 3, without = columnMesh(o, 1, lod, { protome: false }).idx.length / 3, pm = protomeMesh(o, lod)!;
      expect(without + pm.idx.length / 3).toBe(whole);
      // the stand-in fills the box exactly (fitTo), and so does the fitted model level (fitLevel)
      const bb = new THREE.Box3().setFromArray(pm.pos);
      expect(bb.min.toArray().map(x => +x.toFixed(4))).toEqual(box[0].map(x => +x.toFixed(4)));
      expect(bb.max.toArray().map(x => +x.toFixed(4))).toEqual(box[1].map(x => +x.toFixed(4)));
    }
  });
  it('fitLevel fits the box and keeps unit normals and tangents perpendicular to them', () => {
    const g = new THREE.SphereGeometry(1, 24, 12); g.computeTangents();
    const f = fitLevel(g, [-2, 5, -0.5], [2, 7, 0.5]); f.computeBoundingBox();
    expect(f.boundingBox!.min.toArray().map(x => +x.toFixed(5))).toEqual([-2, 5, -0.5]);
    expect(f.boundingBox!.max.toArray().map(x => +x.toFixed(5))).toEqual([2, 7, 0.5]);
    const N = f.getAttribute('normal'), T = f.getAttribute('tangent'), P = f.getAttribute('position');
    let worst = 0, worstN = 0;
    for (let i = 0; i < N.count; i++) {
      const n = new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i)), t = new THREE.Vector3(T.getX(i), T.getY(i), T.getZ(i));
      worstN = Math.max(worstN, Math.abs(n.length() - 1)); worst = Math.max(worst, Math.abs(n.dot(t)));
      // an ellipsoid's normal is the gradient of x²/a² + y²/b² + z²/c²
      const p = new THREE.Vector3(P.getX(i), P.getY(i) - 6, P.getZ(i)), gr = new THREE.Vector3(p.x / 4, p.y / 1, p.z / 0.25).normalize();
      if (p.length() > 0.1) expect(n.dot(gr)).toBeGreaterThan(0.999);
    }
    expect(worstN).toBeLessThan(1e-5); expect(worst).toBeLessThan(1e-5);
  });
  it('the baked material is the carved stone with the map as normal (under the stone\'s own relief) and as occlusion', () => {
    const tex = new THREE.Texture(); const m = bakedMaterial('limestone_carved', tex, 'test:0');
    expect(m.normalNode).toBeTruthy(); expect(m.aoNode).toBeTruthy(); expect(m.colorNode).toBeTruthy();
    expect(bakedMaterial('limestone_carved', tex, 'test:0')).toBe(m); // cached
  });
});

describe('KTX2 maps (D-306: KTX-Software 4.4.2)', () => {
  for (const id of ids) it(`${id}: every map is KTX2 (UASTC, zstd, mipmapped) routed through KHR_texture_basisu`, () => {
    const M = MAN.assets[id], { json } = parseGLB(readFileSync(`public/${M.file}`)), G = measureGLB(readFileSync(`public/${M.file}`));
    expect(M.textures).toBe('ktx2');
    expect(json.extensionsUsed).toContain('KHR_texture_basisu');
    for (const im of G.images) { expect(im.mimeType).toBe('image/ktx2'); expect(im.format).toBe('ktx2'); expect(im.levels, 'mip levels').toBe(Math.log2(im.w) + 1); }
    for (const t of json.textures) { expect(t.extensions?.KHR_texture_basisu?.source).toBeTypeOf('number'); expect(t.source).toBeUndefined(); }
  });
});

describe('the volute member and the colossi in the game (D-306)', () => {
  for (const [id, name] of [['capital_volute', 'volute'], ['colossus_bull', 'colossus_bull'], ['colossus_lamassu', 'colossus_lamassu']] as const) {
    it(`${id}: the levels keep the game's triangles and stand where the game's pieces do (bounds within the Draco quantisation)`, () => {
      const { json } = parseGLB(readFileSync(`public/${MAN.assets[id].file}`));
      for (const lod of [0, 1] as const) {
        // Blender's weld (bake.py) drops a triangle whose corners coincide, or that repeats another's three corners (the
        // lamassu's LOD1 has one, left by the simplifier): the rest are the game's own
        const pc = piece(name, lod), key = (i: number) => [0, 1, 2].map(k => pc.pos[i * 3 + k].toFixed(6)).join(','), seen = new Set<string>();
        let dropped = 0; for (let t = 0; t < pc.idx.length; t += 3) { const ks = [key(pc.idx[t]), key(pc.idx[t + 1]), key(pc.idx[t + 2])], k = [...ks].sort().join('|'); if (new Set(ks).size < 3 || seen.has(k)) dropped++; seen.add(k); }
        expect(dropped, `lod${lod}`).toBeLessThanOrEqual(2);
        expect(MAN.assets[id].lods[lod].tris, `lod${lod}: ${dropped} degenerate or repeated`).toBe(pc.idx.length / 3 - dropped);
        const mesh = json.meshes.find((m: any) => m.name === `lod${lod}`), a = json.accessors[mesh.primitives[0].attributes.POSITION];
        const bb = new THREE.Box3().setFromArray(piece(name, lod).pos), tol = name === 'volute' ? 2e-3 : 5e-3;
        for (let k = 0; k < 3; k++) { expect(Math.abs(a.min[k] - bb.min.getComponent(k)), `lod${lod} min[${k}]`).toBeLessThan(tol); expect(Math.abs(a.max[k] - bb.max.getComponent(k)), `lod${lod} max[${k}]`).toBeLessThan(tol); }
      }
    });
  }
  for (const b of ['apadana', 'gate_nations']) it(`${b}: the composite column without its volute and protome plus both is the whole column; the boxes agree`, () => {
    const o = order(b, { capital: 'composite' }), vb = voluteBox(o)!;
    for (const lod of [0, 1] as const) {
      const whole = columnMesh(o, 1, lod).idx.length / 3, without = columnMesh(o, 1, lod, { protome: false, volute: false }).idx.length / 3;
      expect(without + voluteMesh(o, lod)!.idx.length / 3 + protomeMesh(o, lod)!.idx.length / 3).toBe(whole);
      const bb = new THREE.Box3().setFromArray(voluteMesh(o, lod)!.pos);
      expect(bb.min.toArray().map(x => +x.toFixed(4))).toEqual(vb[0].map(x => +x.toFixed(4)));
      expect(bb.max.toArray().map(x => +x.toFixed(4))).toEqual(vb[1].map(x => +x.toFixed(4)));
    }
  });
  it('colossusPlacement places a level exactly as colossusMesh places the procedural piece, mirrored ones included', () => {
    const { parts } = buildTerrace(), cols = parts.filter((p: any) => p.type === 'box' && p.sculpt) as Box[];
    expect(cols.length).toBe(4);
    expect(new Set(cols.map(p => `${p.sculpt!.facing}|${p.sculpt!.passage}`)).size, 'the four face both ways').toBeGreaterThan(1);
    for (const p of cols) {
      const want = colossusMesh(p, 1), g = placeLevel(toGeometry(piece(`colossus_${p.sculpt!.model}` as any, 1)), colossusPlacement(p));
      const P = g.getAttribute('position').array as Float32Array, N = g.getAttribute('normal').array as Float32Array;
      let dp = 0, dn = 0; for (let i = 0; i < P.length; i++) { dp = Math.max(dp, Math.abs(P[i] - want.pos[i])); dn = Math.max(dn, Math.abs(N[i] - want.nrm[i])); }
      expect(dp).toBeLessThan(1e-4); expect(dn).toBeLessThan(2e-3);
      // the winding follows the mirror, as transformNorm's does
      const I = g.index!.array; for (let t = 0; t < 30; t += 3) expect([I[t], I[t + 1], I[t + 2]]).toEqual([want.idx[t], want.idx[t + 1], want.idx[t + 2]]);
    }
  });
  it('placeLevel under a mirror flips the tangents\' handedness (the baked normals keep pointing out of the surface)', () => {
    const g = new THREE.PlaneGeometry(1, 1); g.computeTangents();
    const m = placeLevel(g, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]), T = m.getAttribute('tangent'), N = m.getAttribute('normal');
    expect(T.getW(0)).toBe(-g.getAttribute('tangent').getW(0));
    expect(T.getX(0)).toBeCloseTo(-g.getAttribute('tangent').getX(0)); expect(N.getZ(0)).toBeCloseTo(1);
  });
});

describe('the carving layer (D-306: map-only relief after the photographs)', () => {
  const C = JSON.parse(readFileSync('tools/blender/carving.json', 'utf8'));
  it('every motif is data with a tier, a photograph and a note', () => {
    for (const k of ['protome', 'colossus_bull', 'colossus_lamassu']) for (const m of [...C[k].motifs, ...(C[k].fields ?? [])]) {
      expect(m.tier, `${k}.${m.name}`).toMatch(/^[ABC]$/); expect(m.note?.length).toBeGreaterThan(20);
      for (const s of String(m.src).split(';')) expect(C.photos[s], `${k}.${m.name} photo ${s}`).toBeTruthy();
    }
  });
  it('the protome\'s motifs land on its surface: every path projects, the relief is zero away from them and within the bake\'s cage', () => {
    const M = pieceModel('protome', sculptParams(0), 0), { R, log } = buildRelief(M.f, C.protome.motifs, 0.06, 0.01);
    expect(log.counts.beads).toBeGreaterThan(150); expect(log.counts.rosettes).toBeGreaterThan(5); expect(log.counts.strips).toBe(2);
    for (const m of C.protome.motifs) expect(log[m.name], m.name).toBeTruthy();
    const cage = REG.assets.capital_protome.bake.cage;
    expect(R.hmax).toBeLessThan(cage); // the bake's rays reach every carved point from the game's level
    expect(R.at(-1.5, 0.1, 0)).toBe(0); // the back of the far bull's base: no motif there
    // a bead's crown: its centre stands out of the model by its height
    const B = C.protome.motifs.find((m: any) => m.name === 'belly'), { R: R2 } = buildRelief(M.f, [B], 0.06, 0.01);
    let top = 0; for (let x = 0.2; x < 0.9; x += 0.004) { const h = march(M.f, [x, B.path.pts[1][1], 2], [0, 0, -1]); if (h) top = Math.max(top, R2.at(h.p[0], h.p[1], h.p[2])); }
    expect(top).toBeGreaterThan(B.h * 0.9); expect(top).toBeLessThanOrEqual(B.h + 1e-9);
  });
});
