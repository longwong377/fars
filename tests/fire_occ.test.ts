// Fire-light occlusion (D-222, BLOCKERS B24): the baked atlas matches the architecture and the fires, the octahedral map
// round-trips, and the case B24 was opened for: the Apadana N stair's landing braziers no longer light the N court floor
// through the stair's parapet and façade, while the landing round them stays lit.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { terraceFireLights } from '../src/world/firePlaces';
import { octEncode, octDecode, occAt, bakeTile, tileOf, OCC_TILE, type FireOcc, type OccTracer } from '../src/world/fireOcc';

let occ: FireOcc; let T: ReturnType<typeof buildTerrace>;
beforeAll(() => {
  const meta = JSON.parse(readFileSync('public/generated/fire_occ.json', 'utf8')), b = readFileSync('public/generated/fire_occ.f16');
  const h = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2), data = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) data[i] = THREE.DataUtils.fromHalfFloat(h[i]);
  occ = { ...meta, data }; T = buildTerrace();
});

describe('fire-light occlusion (D-222)', () => {
  it('octahedral encoding round-trips every direction to within a texel', () => {
    for (let k = 0; k < 2000; k++) {
      const z = 1 - 2 * ((k + 0.5) / 2000), r = Math.sqrt(1 - z * z), ph = k * 2.39996, d: [number, number, number] = [r * Math.cos(ph), z, r * Math.sin(ph)];
      const [s, t] = octEncode(...d), e = octDecode(s, t);
      expect(Math.acos(Math.min(1, d[0] * e[0] + d[1] * e[1] + d[2] * e[2]))).toBeLessThan(1e-6);
    }
  });
  it('the bake is current: parts hash, tile size and the fires list match the tree (else rerun tools/build_fire_occ.ts)', () => {
    expect(occ.partsHash).toBe(createHash('sha1').update(JSON.stringify(T.parts)).digest('hex').slice(0, 16));
    expect(occ.tile).toBe(OCC_TILE);
    expect(occ.fires).toEqual(terraceFireLights(T.manifest, T.parts, T.doorways));
    expect(occ.data.length).toBe(occ.cols * occ.tile * occ.rows * occ.tile);
    // the scribes' room lamp (session 8) is one of them, on the bench by its place in SITE_SPEC
    expect(occ.fires.some(f => f.kind === 'lamp' && Math.hypot(f.pos[0] - 188.9, -f.pos[2] - -80.95) < 0.01)).toBe(true);
  });
  it('B24: the N stair braziers light their landing but not the N court floor behind the parapet', () => {
    const a: any = T.manifest.apadana, n0 = a.nStairEdge + 1.5;
    const ks = occ.fires.map((f, i) => [f, i] as const).filter(([f]) => f.kind === 'brazier' && Math.abs(-f.pos[2] - n0) < 0.01);
    expect(ks.length).toBe(2);
    for (const [f, k] of ks) {
      const [lx, ly, lz] = f.pos, floorY = ly - 1.37; // the landing the brazier stands on (LIFT 1.02 + the light's height 0.35)
      let landing = 0, landingN = 0, court = 0, courtN = 0;
      for (let de = -3; de <= 3; de += 1) for (let dn = -3; dn <= 3; dn += 1) { landingN++; landing += occAt(occ, k, lx, ly, lz, lx + de, floorY + 0.01, lz - dn, 0, 1, 0); }
      // the court floor (y 0) straight N of the stair, 6–14 m N of the brazier, within 4 m of its line
      for (let de = -4; de <= 4; de += 1) for (let dn = 6; dn <= 14; dn += 1) { courtN++; court += occAt(occ, k, lx, ly, lz, lx + de, 0.01, lz - dn, 0, 1, 0); }
      expect(landing / landingN, `brazier ${k}: landing lit share`).toBeGreaterThan(0.95);
      expect(court / courtN, `brazier ${k}: court lit share`).toBeLessThan(0.05);
    }
  });
  it('no false self-shadow on the open floor round a brazier (slope-scaled bias; brazier-close rendered rows of triangles)', () => {
    for (const k of occ.fires.map((f, i) => [f, i] as const).filter(([f]) => f.kind === 'brazier' && Math.abs(f.pos[0] + 33.4) < 0.01).map(([, i]) => i)) {
      const [lx, ly, lz] = occ.fires[k].pos, fy = ly - 1.37; let lit = 0, n = 0;
      for (let dx = -3; dx <= 3; dx += 0.1) for (let dz = -3; dz <= 3; dz += 0.1) { if (Math.hypot(dx, dz) < 0.4) continue; n++; lit += occAt(occ, k, lx, ly, lz, lx + dx, fy, lz + dz, 0, 1, 0); }
      expect(lit / n, `stair-head brazier ${k}: lit share of the floor within 3 m`).toBeGreaterThan(0.99);
    }
  });
  it('a fire inside a solid is left unoccluded, and an unknown light maps to no tile (lit everywhere)', () => {
    const solid: OccTracer = { intersect: () => ({ t: 0.1 }), inside: () => true };
    expect(bakeTile(solid, 0, 0, 0)).toBeNull();
    expect(tileOf(occ, 1e6, 0, 0)).toBe(-1);
    expect(occAt(occ, -1, 0, 0, 0, 5, 0, 0)).toBe(1);
  });
  it('an open sky tile: nothing hit reads as lit out to the far distance', () => {
    const open: OccTracer = { intersect: () => null, inside: () => false };
    const t = bakeTile(open, 0, 0, 0)!; const one: FireOcc = { tile: OCC_TILE, cols: 1, rows: 1, data: t, fires: [] };
    expect(occAt(one, 0, 0, 0, 0, 30, -2, 7)).toBe(1);
  });
});
