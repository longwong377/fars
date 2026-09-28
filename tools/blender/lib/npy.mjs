// Minimal reader of numpy .npy files (float32 / uint8, C order), for the tree asset post-processing (tools/blender/trees.mjs).
import { readFileSync } from 'node:fs';
export function readNpy(path) {
  const b = readFileSync(path);
  if (b[0] !== 0x93 || b.toString('latin1', 1, 6) !== 'NUMPY') throw new Error(`${path}: not a .npy file`);
  const major = b[6], hl = major === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), h0 = major === 1 ? 10 : 12;
  const header = b.toString('latin1', h0, h0 + hl);
  const descr = /'descr':\s*'([^']+)'/.exec(header)[1], shape = /'shape':\s*\(([^)]*)\)/.exec(header)[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (/'fortran_order':\s*True/.test(header)) throw new Error(`${path}: fortran order`);
  const off = h0 + hl, n = shape.reduce((a, x) => a * x, 1);
  const ab = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + n * (descr === '<f4' ? 4 : 1));
  const data = descr === '<f4' ? new Float32Array(ab) : descr === '|u1' ? new Uint8Array(ab) : null;
  if (!data) throw new Error(`${path}: dtype ${descr}`);
  return { shape, data };
}
