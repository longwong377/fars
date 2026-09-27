// Binary PLY (little-endian) writer and reader for the Blender pipeline's intermediate meshes: positions, per-vertex
// normals, triangles. Blender 5 imports the normals as custom split normals (bpy.ops.wm.ply_import), so the analytic
// SDF normals of the project's sculpture reach the bake unchanged.
import { writeFileSync, readFileSync } from 'node:fs';
import type { NormMesh } from '../../../src/arch/sdf';

export function writePLY(path: string, m: NormMesh): { verts: number; tris: number; bytes: number } {
  const nv = m.pos.length / 3, nf = m.idx.length / 3;
  const head = `ply\nformat binary_little_endian 1.0\ncomment PARSA tools/blender\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
  const hb = Buffer.from(head, 'ascii'), body = Buffer.alloc(nv * 24 + nf * 13);
  let o = 0;
  for (let v = 0; v < nv; v++) {
    for (let k = 0; k < 3; k++) { body.writeFloatLE(m.pos[v * 3 + k], o); o += 4; }
    for (let k = 0; k < 3; k++) { body.writeFloatLE(m.nrm[v * 3 + k], o); o += 4; }
  }
  for (let f = 0; f < nf; f++) { body.writeUInt8(3, o); o += 1; for (let k = 0; k < 3; k++) { body.writeInt32LE(m.idx[f * 3 + k], o); o += 4; } }
  const buf = Buffer.concat([hb, body]); writeFileSync(path, buf);
  return { verts: nv, tris: nf, bytes: buf.length };
}

export function readPLY(path: string): NormMesh {
  const buf = readFileSync(path), end = buf.indexOf('end_header\n') + 11, head = buf.subarray(0, end).toString('ascii');
  const nv = +/element vertex (\d+)/.exec(head)![1], nf = +/element face (\d+)/.exec(head)![1];
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(nf * 3);
  let o = end;
  for (let v = 0; v < nv; v++) { for (let k = 0; k < 3; k++) { pos[v * 3 + k] = buf.readFloatLE(o); o += 4; } for (let k = 0; k < 3; k++) { nrm[v * 3 + k] = buf.readFloatLE(o); o += 4; } }
  for (let f = 0; f < nf; f++) { o += 1; for (let k = 0; k < 3; k++) { idx[f * 3 + k] = buf.readInt32LE(o); o += 4; } }
  return { pos, nrm, idx };
}
