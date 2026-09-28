// Binary PLY writer with texture coordinates (D-328: the shaft tiles, whose map the game samples at its own analytic tile
// coordinates, sculpt.ts shaftUV, so the bake must use the same UVs rather than Smart UV Project). Same axes as lib/ply.ts
// ((x, y, z)game -> (x, -z, y) Blender); the UVs are given in the glTF convention (v up the shaft) and written as Blender's
// (s = u, t = 1 - v), which the glTF exporter turns back into (u, v).
import { writeFileSync } from 'node:fs';
import type { NormMesh } from '../../../src/arch/sdf';

export function writePLYuv(path: string, m: NormMesh, uv?: Float32Array): { verts: number; tris: number; bytes: number } {
  const nv = m.pos.length / 3, nf = m.idx.length / 3, st = uv ? 8 : 0;
  const head = `ply\nformat binary_little_endian 1.0\ncomment PARSA tools/blender (uv)\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\n${uv ? 'property float s\nproperty float t\n' : ''}element face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
  const hb = Buffer.from(head, 'ascii'), body = Buffer.alloc(nv * (24 + st) + nf * 13);
  let o = 0;
  for (let v = 0; v < nv; v++) {
    for (const a of [m.pos, m.nrm]) { body.writeFloatLE(a[v * 3], o); body.writeFloatLE(-a[v * 3 + 2], o + 4); body.writeFloatLE(a[v * 3 + 1], o + 8); o += 12; }
    if (uv) { body.writeFloatLE(uv[v * 2], o); body.writeFloatLE(1 - uv[v * 2 + 1], o + 4); o += 8; }
  }
  for (let f = 0; f < nf; f++) { body.writeUInt8(3, o); o += 1; for (let k = 0; k < 3; k++) { body.writeInt32LE(m.idx[f * 3 + k], o); o += 4; } }
  const buf = Buffer.concat([hb, body]); writeFileSync(path, buf);
  return { verts: nv, tris: nf, bytes: buf.length };
}
