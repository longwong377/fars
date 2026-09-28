// PARSA (D-329): the Naqsh-e Rustam sources for tools/blender/naqsh.py, from the game's own code (src/world/plain/naqsh.ts)
// and data (plain.json naqsh_e_rustam, the terrain, the ancient foot level). Writes into <work>:
//  cliff_low.bin  the game's cliff sheet as Blender takes it: float32 triangles, per vertex X = x along the face, Y = depth into
//                 the rock, Z = height above the ancient foot, then U, V (Blender's v = 1 - three's v)
//  cliff_grid.bin the base surface every STEP m over the face (float32 depth, the crest-clamped heights), the dressed blend
//                 round the façades (u8), the joint-bounded blocks' column and bed (i16), the façade holes (u8)
// and returns the numbers the script needs (grid shape, façade and Ka'ba dimensions, the tombs' positions).
import { readFileSync, writeFileSync } from 'node:fs';
import { Ring, Terrain, type TerrainMeta } from '../../src/terrain/heightfield';
import { naqshCliffSource } from '../../src/world/plain/naqsh';
import { PLAIN, feature } from '../../src/world/plain/data';

export const STEP = 0.08;
export function writeNaqshSource(work: string) {
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0) as ArrayBuffer), meta.court_asl);
  const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const foot = JSON.parse(readFileSync('public/generated/rivers.json', 'utf8')).naqsh_e_rustam.ancient_foot_asl as number;
  const S = naqshCliffSource(T, foot);
  // the low sheet
  const g = S.geo, P = g.getAttribute('position'), UV = g.getAttribute('uv'), n = P.count, low = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) { const [x, d, h] = S.toFace(P.getX(i), P.getY(i), P.getZ(i)); low.set([x, d, h, UV.getX(i), 1 - UV.getY(i)], i * 5); }
  writeFileSync(`${work}/cliff_low.bin`, Buffer.from(low.buffer));
  // the base surface grid
  const x0 = S.xa, nx = Math.round((S.xb - S.xa) / STEP) + 1, h0 = -1.5; let hMax = 0; for (let i = 0; i < nx; i++) hMax = Math.max(hMax, S.crest(x0 + i * STEP));
  const nh = Math.ceil((hMax - h0) / STEP) + 2;
  const depth = new Float32Array(nx * nh), hgt = new Float32Array(nx * nh), dressed = new Uint8Array(nx * nh), col = new Int16Array(nx * nh), bed = new Int16Array(nx * nh), hole = new Uint8Array(nx * nh);
  const crest = new Float32Array(nx);
  for (let i = 0; i < nx; i++) crest[i] = S.crest(x0 + i * STEP);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * STEP, h = Math.min(h0 + j * STEP, crest[i]), k = j * nx + i, b = S.block(x, h);
    depth[k] = S.depth(x, h); hgt[k] = h; dressed[k] = Math.round(S.dressed(x, h) * 255); col[k] = b.col; bed[k] = b.bed; hole[k] = S.inHole(x, h) ? 1 : 0;
  }
  const parts = [depth, hgt, dressed, col, bed, hole, crest].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  writeFileSync(`${work}/cliff_grid.bin`, Buffer.concat(parts));
  const NR = PLAIN.naqsh_e_rustam;
  return {
    cliff: { x0, nx, h0, nh, step: STEP, xa: S.xa, xb: S.xb, H: S.H, low_verts: n, fy: S.f.fy },
    facade: { ...NR.facade, colX: [-5.6, -2.1, 2.1, 5.6], col_r: 0.38, bearer_h: 1.35, span: 8.6, tombs: S.tombs },
    kaba: { ...NR.kaba, xy: feature('nr_kaba').xy },
  };
}
