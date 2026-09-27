// The Blender asset pipeline (D-305): every generated asset stays within its budget, is current with its inputs, was
// reproduced byte for byte by a second build, and fits the game where its procedural stand-in stood.
// (Blender is not needed here: tools/blender/build.mjs builds; --verify reproduces; this test reads what they wrote.)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three/webgpu';
// @ts-ignore plain node module shared with the build
import { measureGLB, sha256, parseGLB } from '../tools/blender/lib/glb.mjs';
// @ts-ignore plain node module shared with the build
import { readRegistry, inputHash } from '../tools/blender/lib/inputs.mjs';
import { order } from '../src/arch/orders';
import { protomeBox, protomeMesh, columnMesh, piece } from '../src/arch/sculpt';
import { fitLevel, bakedMaterial } from '../src/render/models';

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
    it('reproducible: a second build from the same inputs gave the same bytes (build.mjs --verify)', () => {
      expect(M.reproduced, 'not yet reproduced: run node tools/blender/build.mjs --verify ' + id).toBeTruthy();
      expect(M.reproduced.outHash).toBe(M.outHash);
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
